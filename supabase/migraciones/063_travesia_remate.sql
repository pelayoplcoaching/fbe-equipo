-- =====================================================================
-- FBE Equipo, migración 063: el remate de La travesía (lo que necesita la base)
--
-- Por qué: las últimas mejoras del juego del descanso (claude/descansos-mejoras-5.md) que son de todo el equipo:
--
--   * travesia_perfil guarda además las rutas que ha elegido (Picos, Pirineos, el Camino) y sus estrellas doradas, para
--     no perderlas al cambiar de móvil. guardar_travesia_perfil() lleva dos datos más (p_rutas, p_doradas).
--   * travesia_dia guarda el «rastro» de su mejor intento de la etapa del día (dónde iba y a qué altura, cada cuarto de
--     segundo; nada más). travesia_dia_fantasma() da el de un compañero de la comunidad, para correr contra su lobo:
--     el que va justo por delante de su mejor intento (o el primero, si va el primero o aún no ha corrido). Con las reglas
--     de siempre: solo entre quienes están en la comunidad, y nunca el de quien no quiere salir en el ranking.
--   * travesia_liga: las ligas de la semana, en grupos de cinco (bronce, plata y oro). Cada lunes, el primero de cada
--     grupo sube y el último baja; el que entra empieza en bronce. Se calcula sola la primera vez que alguien la mira esa
--     semana (travesia_liga()). Solo quien sale en el ranking; se guardan cuatro semanas.
--   * travesia_reto_equipo: el reto de la semana que pone el coach para todo el equipo («entre todos, 40 km»), con
--     travesia_poner_reto(). travesia_equipo() da el reto con lo que lleva el equipo, y la fiesta del mes.
--   * travesia_fiesta: el día en que el equipo cumple la meta del mes (la de «Tu travesía»: 15 km por cada uno, como
--     poco 50 km). Ese día hay aurora en el juego para todos, y cada uno se lleva una postal especial.
--
-- Lo que suma el equipo se cuenta como en travesia_manada() (la 061): lo de quien no sale en el ranking solo entra si
-- son al menos tres. Nada de esto guarda datos de salud.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 062 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 63 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 063 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 63;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 62) then  -- (2) la anterior
    raise exception 'Falta la migración 062 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Las rutas elegidas y las estrellas doradas, en el perfil del lobo
-- ---------------------------------------------------------------------
alter table public.travesia_perfil add column if not exists rutas text[] not null default '{}';
alter table public.travesia_perfil add column if not exists doradas integer not null default 0;
alter table public.travesia_perfil drop constraint if exists travesia_perfil_remate;
alter table public.travesia_perfil add constraint travesia_perfil_remate check (
  cardinality(rutas) <= 50 and rutas <@ array['picos', 'pirineos', 'camino'] and doradas between 0 and 100000
);

-- (la de la 062 tenía cinco datos: se cambia por esta, que lleva dos más)
drop function if exists public.guardar_travesia_perfil(integer, integer, jsonb, jsonb, text[]);
create or replace function public.guardar_travesia_perfil(p_rango integer, p_hechas integer, p_activas jsonb, p_logros jsonb,
  p_potenciadores text[] default '{}', p_rutas text[] default null, p_doradas integer default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_atleta uuid := public.mi_atleta_id();
  v_rango integer := least(greatest(coalesce(p_rango, 0), 0), 999);
  v_hechas integer := least(greatest(coalesce(p_hechas, 0), 0), 1000000);
  v_activas jsonb := '[]'::jsonb;
  v_logros jsonb := '{}'::jsonb;
  v_pot text[];
  v_rutas text[] := '{}';
  v_doradas integer := least(greatest(coalesce(p_doradas, 0), 0), 100000);
  r public.travesia_perfil;
  x jsonb;
  k text;
  d text;
  u text;
begin
  if v_atleta is null then return null; end if;
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then return null; end if;
  if jsonb_typeof(p_activas) = 'array' then
    for x in select * from jsonb_array_elements(p_activas) limit 3 loop
      if jsonb_typeof(x) = 'object' and coalesce(x->>'id', '') ~ '^[a-z0-9]{1,20}$' then
        v_activas := v_activas || jsonb_build_array(jsonb_build_object('id', x->>'id',
          'valor', least(greatest(coalesce(case when (x->>'valor') ~ '^[0-9]{1,9}$' then (x->>'valor')::integer end, 0), 0), 10000000)));
      end if;
    end loop;
  end if;
  if jsonb_typeof(p_logros) = 'object' then
    for k, d in select key, value #>> '{}' from jsonb_each(p_logros) limit 60 loop
      if k ~ '^[a-z0-9]{1,20}$' and d ~ '^20[2-9][0-9]-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' then v_logros := v_logros || jsonb_build_object(k, d); end if;
    end loop;
  end if;
  v_pot := array(select distinct p from unnest(coalesce(p_potenciadores, '{}')) p where p in ('iman', 'luna', 'aullido'));
  -- (las rutas, en orden: la primera que se eligió, la segunda…; solo las tres que hay)
  foreach u in array coalesce(p_rutas, '{}') loop
    exit when cardinality(v_rutas) >= 50;
    if u in ('picos', 'pirineos', 'camino') then v_rutas := v_rutas || u; end if;
  end loop;
  perform pg_advisory_xact_lock(hashtext('travesia_perfil:' || v_atleta::text));
  select * into r from public.travesia_perfil where atleta_id = v_atleta;
  if found then
    if r.rango > v_rango then v_activas := r.activas; v_rango := r.rango;
    elsif r.rango = v_rango then
      select coalesce(jsonb_agg(jsonb_build_object('id', a->>'id', 'valor', greatest((a->>'valor')::integer,
               coalesce((select (b->>'valor')::integer from jsonb_array_elements(r.activas) b where b->>'id' = a->>'id' limit 1), 0)))), '[]'::jsonb)
        into v_activas from jsonb_array_elements(case when jsonb_array_length(v_activas) > 0 then v_activas else r.activas end) a;
    end if;
    for k, d in select key, value #>> '{}' from jsonb_each(r.logros) loop
      if not (v_logros ? k) or (v_logros->>k) > d then v_logros := v_logros || jsonb_build_object(k, d); end if;
    end loop;
    -- (como en la 062 tras su revisión: los logros no crecen sin tope; más de 100, se queda con los que ya tenía)
    if (select count(*) from jsonb_object_keys(v_logros)) > 100 then v_logros := coalesce(r.logros, '{}'::jsonb); end if;
    v_hechas := greatest(v_hechas, r.hechas);
    v_pot := array(select distinct p from unnest(v_pot || r.potenciadores) p);
    -- (las rutas: sin p_rutas, las de la base; con ellas, la lista más larga, y a igualdad la que llega: es la última elección)
    if p_rutas is null or cardinality(r.rutas) > cardinality(v_rutas) then v_rutas := r.rutas; end if;
    v_doradas := greatest(v_doradas, r.doradas);
  end if;
  insert into public.travesia_perfil as t (atleta_id, rango, hechas, activas, logros, potenciadores, rutas, doradas, actualizada_en)
    values (v_atleta, v_rango, v_hechas, v_activas, v_logros, v_pot, v_rutas, v_doradas, now())
  on conflict (atleta_id) do update set rango = excluded.rango, hechas = excluded.hechas, activas = excluded.activas,
    logros = excluded.logros, potenciadores = excluded.potenciadores, rutas = excluded.rutas, doradas = excluded.doradas, actualizada_en = now()
  returning * into r;
  return jsonb_build_object('rango', r.rango, 'hechas', r.hechas, 'activas', r.activas, 'logros', r.logros, 'potenciadores', to_jsonb(r.potenciadores),
                            'rutas', to_jsonb(r.rutas), 'doradas', r.doradas);
end $$;

-- ---------------------------------------------------------------------
-- 2. El fantasma de un compañero en la etapa del día
-- ---------------------------------------------------------------------
-- rastro: [x en decímetros, altura en centímetros, x, altura, …], cada cuarto de segundo de su mejor intento (un minuto:
-- como mucho 240 parejas)
alter table public.travesia_dia add column if not exists rastro smallint[];
alter table public.travesia_dia drop constraint if exists travesia_dia_rastro;
alter table public.travesia_dia add constraint travesia_dia_rastro check (rastro is null or (array_ndims(rastro) = 1 and cardinality(rastro) <= 480));

drop function if exists public.sumar_etapa_del_dia(integer, integer);
create or replace function public.sumar_etapa_del_dia(p_metros integer, p_estrellas integer default 0, p_rastro smallint[] default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_atleta uuid := public.mi_atleta_id();
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_metros integer := least(greatest(coalesce(p_metros, 0), 0), 800);   -- (como en la 062 tras su revisión: un minuto da para eso)
  v_estrellas integer := least(greatest(coalesce(p_estrellas, 0), 0), 1000);
  v_rastro smallint[] := null;
  r public.travesia_dia;
begin
  if v_atleta is null then return null; end if;
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then return null; end if;
  -- (el rastro, solo si tiene sentido: parejas, como mucho 240, dentro de la etapa)
  if p_rastro is not null and array_ndims(p_rastro) = 1 and cardinality(p_rastro) between 2 and 480 and cardinality(p_rastro) % 2 = 0
     and not exists (select 1 from unnest(p_rastro) with ordinality as z(v, i) where v is null or (i % 2 = 1 and (v < 0 or v > 8000)) or (i % 2 = 0 and (v < -200 or v > 1000))) then
    v_rastro := p_rastro;
  end if;
  perform pg_advisory_xact_lock(hashtext('travesia_dia:' || v_atleta::text));
  delete from public.travesia_dia where dia < v_hoy - 7;   -- (solo los últimos ocho días, los de todos; como la 062)
  select * into r from public.travesia_dia where atleta_id = v_atleta and dia = v_hoy;
  if found and r.intentos >= 3 then
    return jsonb_build_object('dia', r.dia, 'metros', r.metros, 'estrellas', r.estrellas, 'intentos', r.intentos);
  end if;
  insert into public.travesia_dia as t (atleta_id, dia, metros, estrellas, intentos, rastro)
    values (v_atleta, v_hoy, v_metros, v_estrellas, 1, v_rastro)
  on conflict (atleta_id, dia) do update set
    metros = greatest(t.metros, excluded.metros),
    estrellas = case when excluded.metros > t.metros then excluded.estrellas else t.estrellas end,
    rastro = case when excluded.metros > t.metros then excluded.rastro else t.rastro end,
    intentos = least(t.intentos + 1, 3), actualizada_en = now()
  returning * into r;
  return jsonb_build_object('dia', r.dia, 'metros', r.metros, 'estrellas', r.estrellas, 'intentos', r.intentos);
end $$;

-- El lobo de un compañero para correr contra él hoy: { nombre, metros, rastro } o null
create or replace function public.travesia_dia_fantasma() returns jsonb
language sql stable security definer set search_path = '' as $$
  with hoy as (select (now() at time zone 'Europe/Madrid')::date as d),
  yo as (select coalesce((select t.metros from public.travesia_dia t where t.atleta_id = public.mi_atleta_id() and t.dia = (select d from hoy)), 0) as m),
  otros as (
    select c.nombre, t.metros, t.rastro
    from public.travesia_dia t join fbe_privado.comunidad_dentro c on c.atleta_id = t.atleta_id
    where t.dia = (select d from hoy) and t.metros > 0 and t.rastro is not null and not c.sin_ranking and c.perfil_id <> auth.uid()
  ),
  elegido as (
    (select * from otros where metros > (select m from yo) order by metros asc, nombre limit 1)
    union all
    (select * from otros where not exists (select 1 from otros where metros > (select m from yo)) order by metros desc, nombre limit 1)
  )
  select case when auth.uid() is null or not public.comunidad_soy_miembro() then null
    else (select jsonb_build_object('nombre', e.nombre, 'metros', e.metros, 'rastro', to_jsonb(e.rastro)) from elegido e limit 1) end
$$;

-- ---------------------------------------------------------------------
-- 3. Las ligas de la semana (grupos de cinco: 0 bronce, 1 plata, 2 oro)
-- ---------------------------------------------------------------------
create table if not exists public.travesia_liga (
  atleta_id uuid not null references public.atletas(id) on delete cascade,
  semana    date not null,                 -- su lunes
  nivel     smallint not null default 0,
  primary key (atleta_id, semana)
);
-- (revisión) el grupo se guarda al hacer las ligas de la semana: no cambia aunque entre o salga alguien
alter table public.travesia_liga add column if not exists grupo smallint not null default 0;
alter table public.travesia_liga drop constraint if exists travesia_liga_valida;
alter table public.travesia_liga add constraint travesia_liga_valida check (nivel between 0 and 2 and grupo between 0 and 999 and extract(isodow from semana) = 1);
create index if not exists travesia_liga_semana_idx on public.travesia_liga (semana, nivel);

-- Los grupos de una semana, tal como se guardaron, con los metros de cada uno esa semana (solo quien sigue en la
-- comunidad y sale en el ranking)
create or replace function fbe_privado.travesia_grupos(p_semana date)
returns table (atleta_id uuid, nivel smallint, grupo integer, metros integer)
language sql stable security definer set search_path = '' as $$
  select l.atleta_id, l.nivel, l.grupo::integer, coalesce(s.metros, 0)
  from public.travesia_liga l
  join fbe_privado.comunidad_dentro c on c.atleta_id = l.atleta_id and not c.sin_ranking
  left join public.travesia_semanas s on s.atleta_id = l.atleta_id and s.semana = p_semana
  where l.semana = p_semana
$$;
revoke all on function fbe_privado.travesia_grupos(date) from public, anon, authenticated;

-- Mi liga de esta semana: { semana, nivel, grupo: [{ nombre, metros, yo }] } ({ fuera: true } si no sale en el ranking;
-- { sin_jugar: true } si no ha jugado en las últimas cuatro semanas: solo entran en la liga quienes juegan)
create or replace function public.travesia_liga() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_lunes date := v_hoy - (extract(isodow from v_hoy)::integer - 1);
  v_prev date;
  v_yo record;
  v_grupo integer;
begin
  if v_uid is null or not public.comunidad_soy_miembro() then return null; end if;
  select c.atleta_id, c.sin_ranking into v_yo from fbe_privado.comunidad_dentro c where c.perfil_id = v_uid;
  if v_yo.atleta_id is null then return null; end if;
  if v_yo.sin_ranking then return jsonb_build_object('semana', v_lunes, 'fuera', true); end if;
  -- (solo si aún no estoy en la liga de esta semana: hacerla o entrar; si ya estoy, se lee y ya)
  if not exists (select 1 from public.travesia_liga l where l.atleta_id = v_yo.atleta_id and l.semana = v_lunes) then
    perform pg_advisory_xact_lock(hashtext('travesia_liga'));
    if not exists (select 1 from public.travesia_liga l where l.semana = v_lunes) then
      -- (la primera vez esta semana: se parte de la última semana con liga; si fue la pasada, el primero de cada grupo sube
      -- si ha corrido y el grupo es de dos o más, y el último baja si el grupo es de tres o más y ha corrido menos que el de
      -- delante; si hubo semanas sin liga, cada uno sigue en su nivel. Luego, grupos de cinco como mucho en cada nivel.)
      v_prev := (select max(l.semana) from public.travesia_liga l where l.semana < v_lunes);
      insert into public.travesia_liga (atleta_id, semana, nivel, grupo)
      select n.atleta_id, v_lunes, n.nivel,
             ((row_number() over (partition by n.nivel order by md5(n.atleta_id::text || v_lunes::text)) - 1)
               % greatest(1, ceil((count(*) over (partition by n.nivel)) / 5.0)::integer))::smallint
      from (
        select g.atleta_id,
               least(2, greatest(0, g.nivel
                 + case when v_prev = v_lunes - 7 and g.puesto = 1 and g.metros > 0 and g.tam >= 2 then 1 else 0 end
                 - case when v_prev = v_lunes - 7 and g.puesto = g.tam and g.tam >= 3 and g.metros < g.delante then 1 else 0 end))::smallint as nivel
        from (select t.*, row_number() over (partition by t.nivel, t.grupo order by t.metros desc, t.atleta_id) as puesto,
                     count(*) over (partition by t.nivel, t.grupo) as tam,
                     lag(t.metros) over (partition by t.nivel, t.grupo order by t.metros desc, t.atleta_id) as delante
              from fbe_privado.travesia_grupos(v_prev) t) g
        where exists (select 1 from public.travesia_semanas s where s.atleta_id = g.atleta_id and s.semana >= v_lunes - 28 and s.metros > 0)
      ) n
      on conflict do nothing;
      delete from public.travesia_liga l where l.semana < v_lunes - 21;   -- (esta semana y las tres anteriores)
    end if;
    -- (quien entra y ha jugado en las últimas cuatro semanas, en bronce: al grupo de bronce más pequeño que tenga sitio, o a uno nuevo)
    if not exists (select 1 from public.travesia_liga l where l.atleta_id = v_yo.atleta_id and l.semana = v_lunes) then
      if not exists (select 1 from public.travesia_semanas s where s.atleta_id = v_yo.atleta_id and s.semana >= v_lunes - 28 and s.metros > 0) then
        return jsonb_build_object('semana', v_lunes, 'sin_jugar', true);
      end if;
      select x.grupo into v_grupo from (
        select l.grupo, count(*) as n from public.travesia_liga l where l.semana = v_lunes and l.nivel = 0 group by l.grupo
      ) x where x.n < 5 order by x.n, x.grupo limit 1;
      if v_grupo is null then
        v_grupo := coalesce((select max(l.grupo) + 1 from public.travesia_liga l where l.semana = v_lunes and l.nivel = 0), 0);
      end if;
      insert into public.travesia_liga (atleta_id, semana, nivel, grupo) values (v_yo.atleta_id, v_lunes, 0, v_grupo) on conflict do nothing;
    end if;
  end if;
  return (
    with g as (select * from fbe_privado.travesia_grupos(v_lunes)),
    mio as (select nivel, grupo from g where atleta_id = v_yo.atleta_id)
    select jsonb_build_object('semana', v_lunes, 'nivel', (select nivel from mio),
      'grupo', coalesce(jsonb_agg(jsonb_build_object('nombre', c.nombre, 'metros', g.metros, 'yo', g.atleta_id = v_yo.atleta_id) order by g.metros desc, c.nombre), '[]'::jsonb))
    from g join fbe_privado.comunidad_dentro c on c.atleta_id = g.atleta_id
    where (g.nivel, g.grupo) = (select nivel, grupo from mio)
  );
end $$;

-- (revisión) La limpieza diaria de la 062, con las ligas: se guardan esta semana y las tres anteriores
create or replace function fbe_privado.travesia_limpiar() returns void
language sql security definer set search_path = '' as $$
  delete from public.travesia_dia where dia < (now() at time zone 'Europe/Madrid')::date - 7;
  delete from public.travesia_aullidos where dia < (now() at time zone 'Europe/Madrid')::date - 14;
  delete from public.travesia_liga where semana < (now() at time zone 'Europe/Madrid')::date - (extract(isodow from (now() at time zone 'Europe/Madrid')::date)::integer - 1) - 21;
$$;
revoke all on function fbe_privado.travesia_limpiar() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. El reto del coach y la fiesta de la manada
-- ---------------------------------------------------------------------
create table if not exists public.travesia_reto_equipo (
  semana         date primary key,           -- su lunes
  metros         integer not null,
  texto          text not null default '',
  actualizado_en timestamptz not null default now()
);
alter table public.travesia_reto_equipo drop constraint if exists travesia_reto_equipo_valido;
alter table public.travesia_reto_equipo add constraint travesia_reto_equipo_valido check (
  metros between 1000 and 10000000 and char_length(texto) <= 80 and extract(isodow from semana) = 1
);

create table if not exists public.travesia_fiesta (
  mes date primary key,                      -- el día 1 del mes
  dia date not null                          -- el día en que el equipo cumplió la meta
);
alter table public.travesia_fiesta drop constraint if exists travesia_fiesta_valida;
alter table public.travesia_fiesta add constraint travesia_fiesta_valida check (extract(day from mes) = 1 and date_trunc('month', dia)::date = mes);

-- (coach) El reto de esta semana para el equipo: los metros y una frase. Sin metros (o 0), se quita.
create or replace function public.travesia_poner_reto(p_metros integer, p_texto text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_lunes date := v_hoy - (extract(isodow from v_hoy)::integer - 1);
begin
  if not public.es_coach() then raise exception 'Solo el coach pone el reto del equipo' using errcode = '42501'; end if;
  if coalesce(p_metros, 0) <= 0 then delete from public.travesia_reto_equipo where semana = v_lunes; return; end if;
  if p_metros < 1000 or p_metros > 10000000 then raise exception 'El reto va de 1 a 10.000 km' using errcode = '22023'; end if;
  insert into public.travesia_reto_equipo (semana, metros, texto) values (v_lunes, p_metros, left(btrim(coalesce(p_texto, '')), 80))
  on conflict (semana) do update set metros = excluded.metros, texto = excluded.texto, actualizado_en = now();
  delete from public.travesia_reto_equipo where semana < v_lunes - 56;
end $$;

-- El reto de la semana (con lo que lleva el equipo) y la fiesta del mes: { reto: { metros, texto, hecho } | null,
-- semana: metros del equipo esta semana, fiesta: { mes, dia } | null }. Si el equipo acaba de cumplir la meta del mes,
-- apunta hoy como el día de la fiesta.
create or replace function public.travesia_equipo() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_lunes date := v_hoy - (extract(isodow from v_hoy)::integer - 1);
  v_mes date := date_trunc('month', v_hoy)::date;
  v_semana integer;
  v_mes_m bigint;
  v_miembros integer;
  r_reto public.travesia_reto_equipo;
  r_fiesta public.travesia_fiesta;
begin
  if auth.uid() is null or not (public.es_coach() or public.comunidad_soy_miembro()) then return null; end if;
  -- (lo del equipo, como en travesia_manada: lo de quien no sale en el ranking, solo si son al menos tres)
  with s as (
    select t.atleta_id, t.semana, t.metros, d.sin_ranking
    from public.travesia_semanas t join fbe_privado.comunidad_dentro d on d.atleta_id = t.atleta_id
  ), oc as (select count(distinct atleta_id) filter (where sin_ranking and date_trunc('month', semana + 3)::date = v_mes) as n_mes,
                   count(distinct atleta_id) filter (where sin_ranking and semana = v_lunes) as n_sem from s)
  select coalesce(sum(metros) filter (where semana = v_lunes and (not sin_ranking or (select n_sem from oc) >= 3)), 0),
         coalesce(sum(metros) filter (where date_trunc('month', semana + 3)::date = v_mes and (not sin_ranking or (select n_mes from oc) >= 3)), 0),
         count(distinct atleta_id) filter (where date_trunc('month', semana + 3)::date = v_mes and (not sin_ranking or (select n_mes from oc) >= 3))
    into v_semana, v_mes_m, v_miembros from s;
  select * into r_reto from public.travesia_reto_equipo where semana = v_lunes;
  select * into r_fiesta from public.travesia_fiesta where mes = v_mes;
  if r_fiesta.mes is null and v_miembros > 0 and v_mes_m >= greatest(50000, v_miembros * 15000) then
    insert into public.travesia_fiesta (mes, dia) values (v_mes, v_hoy) on conflict (mes) do nothing;
    select * into r_fiesta from public.travesia_fiesta where mes = v_mes;
    delete from public.travesia_fiesta where mes < v_mes - interval '24 months';
  end if;
  return jsonb_build_object(
    'semana', v_semana,
    'reto', case when r_reto.semana is null then null else jsonb_build_object('metros', r_reto.metros, 'texto', r_reto.texto, 'hecho', v_semana) end,
    'fiesta', case when r_fiesta.mes is null then null else jsonb_build_object('mes', r_fiesta.mes, 'dia', r_fiesta.dia) end);
end $$;

-- ---------------------------------------------------------------------
-- 5. Quién ve qué
-- ---------------------------------------------------------------------
alter table public.travesia_liga enable row level security;
alter table public.travesia_reto_equipo enable row level security;
alter table public.travesia_fiesta enable row level security;

drop policy if exists coach_ver on public.travesia_liga;
create policy coach_ver on public.travesia_liga for select to authenticated using (public.es_coach());
drop policy if exists coach_borrar on public.travesia_liga;
create policy coach_borrar on public.travesia_liga for delete to authenticated using (public.es_coach());
drop policy if exists atleta_ver on public.travesia_liga;
create policy atleta_ver on public.travesia_liga for select to authenticated using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_borrar on public.travesia_liga;
-- (revisión) el atleta borra lo suyo de semanas pasadas; lo de esta semana no (le cambiaría de grupo)
create policy atleta_borrar on public.travesia_liga for delete to authenticated using (atleta_id = public.mi_atleta_id() and semana < (now() at time zone 'Europe/Madrid')::date - (extract(isodow from (now() at time zone 'Europe/Madrid')::date)::integer - 1));

-- (el reto y la fiesta no son de nadie: el coach los ve y los borra; los demás, con travesia_equipo())
drop policy if exists coach_ver on public.travesia_reto_equipo;
create policy coach_ver on public.travesia_reto_equipo for select to authenticated using (public.es_coach());
drop policy if exists coach_borrar on public.travesia_reto_equipo;
create policy coach_borrar on public.travesia_reto_equipo for delete to authenticated using (public.es_coach());
drop policy if exists coach_ver on public.travesia_fiesta;
create policy coach_ver on public.travesia_fiesta for select to authenticated using (public.es_coach());
drop policy if exists coach_borrar on public.travesia_fiesta;
create policy coach_borrar on public.travesia_fiesta for delete to authenticated using (public.es_coach());

revoke all on public.travesia_liga, public.travesia_reto_equipo, public.travesia_fiesta from public, anon, authenticated;
grant select, delete on public.travesia_liga, public.travesia_reto_equipo, public.travesia_fiesta to authenticated;

-- ---------------------------------------------------------------------
-- 6. Permisos (como al final de 003 a 062)
-- ---------------------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb), public.salud_recibir(text, jsonb), public.calendario_de(text) from public, anon, authenticated;
revoke execute on function public.sesion_video_proteger(), public.guia_tocar(), public.novedad_tocar() from public, anon, authenticated;
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('reloj_estado', 'reloj_serie', 'reloj_saltar', 'reloj_elegir', 'reloj_terminar') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (63)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
