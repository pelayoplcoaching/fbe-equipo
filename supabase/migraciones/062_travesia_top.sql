-- =====================================================================
-- FBE Equipo, migración 062: La travesía al nivel de los mejores (lo que necesita la base)
--
-- Por qué: las mejoras de «La travesía» (claude/descansos-mejoras-4.md) guardan en el móvil el rango del lobo, sus
-- misiones y sus logros. Esta migración los sube a la base (para no perderlos al cambiar de móvil) y añade lo que es de
-- todo el equipo:
--
--   * travesia_perfil: el rango, las misiones activas, los logros y los potenciadores cogidos de cada atleta. Solo se
--     escribe con guardar_travesia_perfil(), que junta lo del móvil con lo que ya hay (nunca baja de rango ni pierde un
--     logro): así dos móviles no se pisan.
--   * travesia_dia: «la etapa del día». Ese día todo el equipo corre el mismo terreno (la misma semilla, que sale de la
--     fecha), un minuto y hasta tres intentos; cuenta el mejor. sumar_etapa_del_dia() lo apunta y
--     travesia_dia_clasif() da la clasificación del día, con las mismas reglas que travesia_manada() (la 061): solo
--     entre quienes están en la comunidad, y quien no quiere salir en el ranking se ve solo a sí mismo. Se guardan los
--     últimos ocho días.
--   * travesia_aullidos: «aullar a un compañero» desde la clasificación de la travesía (como el ánimo de la comunidad,
--     pero sin aviso: le sale en su siguiente etapa). Uno a cada compañero por día, como mucho 20 al día, solo a quien sale
--     en el ranking. Se guardan dos semanas.
--   * travesia_manada() lleva además, en cada fila de otro, su «perfil» (el mismo identificador que ya usa la comunidad
--     para el ánimo), para poder aullarle.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 061 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 62 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 062 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 62;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 61) then  -- (2) la anterior
    raise exception 'Falta la migración 061 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. El rango, las misiones y los logros de cada atleta
-- ---------------------------------------------------------------------
create table if not exists public.travesia_perfil (
  atleta_id      uuid primary key references public.atletas(id) on delete cascade,
  rango          smallint not null default 0,
  hechas         integer not null default 0,       -- misiones cumplidas en total
  activas        jsonb not null default '[]'::jsonb,   -- [{ "id": "lejos", "valor": 120 }], las tres del rango
  logros         jsonb not null default '{}'::jsonb,   -- { "km1": "2026-11-13" }
  potenciadores  text[] not null default '{}',     -- los que ha cogido alguna vez (iman, luna, aullido)
  actualizada_en timestamptz not null default now()
);
alter table public.travesia_perfil drop constraint if exists travesia_perfil_valido;
alter table public.travesia_perfil add constraint travesia_perfil_valido check (
  rango between 0 and 999 and hechas between 0 and 1000000
  and jsonb_typeof(activas) = 'array' and jsonb_array_length(activas) <= 3
  and jsonb_typeof(logros) = 'object' and potenciadores <@ array['iman', 'luna', 'aullido']
);

-- Junta lo del móvil con lo de la base: el rango más alto; con el mismo rango, cada misión con el valor más alto (con
-- rango nuevo, las del móvil); los logros de los dos (la fecha más antigua); las misiones hechas, el máximo; los
-- potenciadores, todos. Devuelve cómo queda.
create or replace function public.guardar_travesia_perfil(p_rango integer, p_hechas integer, p_activas jsonb, p_logros jsonb, p_potenciadores text[] default '{}')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_atleta uuid := public.mi_atleta_id();
  v_rango integer := least(greatest(coalesce(p_rango, 0), 0), 999);
  v_hechas integer := least(greatest(coalesce(p_hechas, 0), 0), 1000000);
  v_activas jsonb := '[]'::jsonb;
  v_logros jsonb := '{}'::jsonb;
  v_pot text[];
  r public.travesia_perfil;
  x jsonb;
  k text;
  d text;
begin
  if v_atleta is null then return null; end if;
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then return null; end if;
  -- (lo que llega, limpio: tres misiones como mucho, con su id y un valor razonable; logros con su fecha)
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
  v_pot := array(select distinct u from unnest(coalesce(p_potenciadores, '{}')) u where u in ('iman', 'luna', 'aullido'));
  perform pg_advisory_xact_lock(hashtext('travesia_perfil:' || v_atleta::text));
  select * into r from public.travesia_perfil where atleta_id = v_atleta;
  if found then
    if r.rango > v_rango then v_activas := r.activas; v_rango := r.rango;
    elsif r.rango = v_rango then
      -- (mismo rango: cada misión, con el valor más alto de los dos)
      select coalesce(jsonb_agg(jsonb_build_object('id', a->>'id', 'valor', greatest((a->>'valor')::integer,
               coalesce((select (b->>'valor')::integer from jsonb_array_elements(r.activas) b where b->>'id' = a->>'id' limit 1), 0)))), '[]'::jsonb)
        into v_activas from jsonb_array_elements(case when jsonb_array_length(v_activas) > 0 then v_activas else r.activas end) a;
    end if;
    for k, d in select key, value #>> '{}' from jsonb_each(r.logros) loop
      if not (v_logros ? k) or (v_logros->>k) > d then v_logros := v_logros || jsonb_build_object(k, d); end if;
    end loop;
    -- (revisión) los logros no crecen sin tope: más de 100, se queda con los que ya tenía
    if (select count(*) from jsonb_object_keys(v_logros)) > 100 then v_logros := coalesce(r.logros, '{}'::jsonb); end if;
    v_hechas := greatest(v_hechas, r.hechas);
    v_pot := array(select distinct u from unnest(v_pot || r.potenciadores) u);
  end if;
  insert into public.travesia_perfil as t (atleta_id, rango, hechas, activas, logros, potenciadores, actualizada_en)
    values (v_atleta, v_rango, v_hechas, v_activas, v_logros, v_pot, now())
  on conflict (atleta_id) do update set rango = excluded.rango, hechas = excluded.hechas, activas = excluded.activas,
    logros = excluded.logros, potenciadores = excluded.potenciadores, actualizada_en = now()
  returning * into r;
  return jsonb_build_object('rango', r.rango, 'hechas', r.hechas, 'activas', r.activas, 'logros', r.logros, 'potenciadores', to_jsonb(r.potenciadores));
end $$;

-- ---------------------------------------------------------------------
-- 2. La etapa del día
-- ---------------------------------------------------------------------
create table if not exists public.travesia_dia (
  atleta_id      uuid not null references public.atletas(id) on delete cascade,
  dia            date not null,                   -- el día (hora de Madrid)
  metros         integer not null default 0,      -- su mejor intento
  estrellas      integer not null default 0,
  intentos       smallint not null default 0,
  actualizada_en timestamptz not null default now(),
  primary key (atleta_id, dia)
);
alter table public.travesia_dia drop constraint if exists travesia_dia_valida;
alter table public.travesia_dia add constraint travesia_dia_valida check (metros between 0 and 2000 and estrellas between 0 and 1000 and intentos between 0 and 3);
create index if not exists travesia_dia_dia_idx on public.travesia_dia (dia);

-- Apunta un intento de hoy (un minuto: como mucho 800 m, que ya es más de lo que se puede correr). Tres intentos al día;
-- cuenta el mejor. Devuelve cómo queda.
create or replace function public.sumar_etapa_del_dia(p_metros integer, p_estrellas integer default 0)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_atleta uuid := public.mi_atleta_id();
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_metros integer := least(greatest(coalesce(p_metros, 0), 0), 800);
  v_estrellas integer := least(greatest(coalesce(p_estrellas, 0), 0), 1000);
  r public.travesia_dia;
begin
  if v_atleta is null then return null; end if;
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then return null; end if;
  perform pg_advisory_xact_lock(hashtext('travesia_dia:' || v_atleta::text));
  delete from public.travesia_dia where dia < v_hoy - 7;   -- (solo los últimos ocho días, los de todos)
  select * into r from public.travesia_dia where atleta_id = v_atleta and dia = v_hoy;
  if found and r.intentos >= 3 then
    return jsonb_build_object('dia', r.dia, 'metros', r.metros, 'estrellas', r.estrellas, 'intentos', r.intentos);
  end if;
  insert into public.travesia_dia as t (atleta_id, dia, metros, estrellas, intentos)
    values (v_atleta, v_hoy, v_metros, v_estrellas, 1)
  on conflict (atleta_id, dia) do update set
    metros = greatest(t.metros, excluded.metros),
    estrellas = case when excluded.metros > t.metros then excluded.estrellas else t.estrellas end,
    intentos = least(t.intentos + 1, 3), actualizada_en = now()
  returning * into r;
  return jsonb_build_object('dia', r.dia, 'metros', r.metros, 'estrellas', r.estrellas, 'intentos', r.intentos);
end $$;

-- La clasificación de hoy, entre quienes están en la comunidad (con las reglas de travesia_manada)
create or replace function public.travesia_dia_clasif() returns jsonb
language sql stable security definer set search_path = '' as $$
  with hoy as (select (now() at time zone 'Europe/Madrid')::date as d)
  select case when auth.uid() is null or not (public.es_coach() or public.comunidad_soy_miembro()) then null else jsonb_build_object(
    'dia', (select d from hoy),
    'filas', coalesce((select jsonb_agg(jsonb_build_object('nombre', c.nombre, 'metros', t.metros, 'yo', c.perfil_id = auth.uid()) order by t.metros desc, c.nombre)
                       from public.travesia_dia t join fbe_privado.comunidad_dentro c on c.atleta_id = t.atleta_id
                       where t.dia = (select d from hoy) and t.metros > 0 and (not c.sin_ranking or c.perfil_id = auth.uid())), '[]'::jsonb)
  ) end
$$;

-- ---------------------------------------------------------------------
-- 3. Aullar a un compañero
-- ---------------------------------------------------------------------
create table if not exists public.travesia_aullidos (
  de             uuid not null references public.perfiles(id) on delete cascade,
  para           uuid not null references public.perfiles(id) on delete cascade,
  atleta_id      uuid references public.atletas(id) on delete cascade,   -- la ficha de quien aúlla (null: el coach)
  para_atleta_id uuid references public.atletas(id) on delete cascade,
  dia            date not null,
  creado_en      timestamptz not null default now(),
  primary key (de, para, dia)
);
alter table public.travesia_aullidos drop constraint if exists travesia_aullidos_validos;
alter table public.travesia_aullidos add constraint travesia_aullidos_validos check (de <> para);
create index if not exists travesia_aullidos_para_idx on public.travesia_aullidos (para, dia);
create index if not exists travesia_aullidos_atleta_idx on public.travesia_aullidos (atleta_id);
create index if not exists travesia_aullidos_para_atleta_idx on public.travesia_aullidos (para_atleta_id);

create or replace function public.travesia_aullar(p_perfil uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_para_atleta uuid;
begin
  -- (revisión) solo quien está en la comunidad y no está silenciado; el coach no aúlla (a nadie le llegaría)
  if v_uid is null or public.es_coach() or not public.comunidad_soy_miembro() then
    raise exception 'Para aullar tienes que estar en la comunidad' using errcode = '42501';
  end if;
  if exists (select 1 from public.comunidad_miembros k where k.perfil_id = v_uid and k.silenciado_hasta > now()) then
    raise exception 'Mientras estás silenciado no puedes aullar' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('travesia_aullar:' || v_uid::text));   -- (dos a la vez no se saltan el tope)
  if p_perfil is null or p_perfil = v_uid then raise exception 'A ti no te puedes aullar' using errcode = '22023'; end if;
  select c.atleta_id into v_para_atleta from fbe_privado.comunidad_dentro c where c.perfil_id = p_perfil and not c.sin_ranking;
  if v_para_atleta is null then raise exception 'Esa persona no está en la clasificación' using errcode = '42501'; end if;
  if exists (select 1 from public.travesia_aullidos a where a.de = v_uid and a.para = p_perfil and a.dia = v_hoy) then
    raise exception 'Hoy ya le has aullado' using errcode = '23505';
  end if;
  if (select count(*) from public.travesia_aullidos a where a.de = v_uid and a.dia = v_hoy) >= 20 then
    raise exception 'Por hoy ya has aullado bastante' using errcode = '22023';
  end if;
  insert into public.travesia_aullidos (de, para, atleta_id, para_atleta_id, dia)
    values (v_uid, p_perfil, public.mi_atleta_id(), v_para_atleta, v_hoy);
  delete from public.travesia_aullidos where dia < v_hoy - 14;   -- (solo dos semanas)
  delete from public.travesia_dia where dia < v_hoy - 7;
end $$;

-- Los aullidos que me han llegado en los últimos siete días, de quienes siguen en la comunidad: [{ nombre, dia }]
create or replace function public.travesia_aullidos_recibidos() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('nombre', c.nombre, 'dia', a.dia) order by a.creado_en desc), '[]'::jsonb)
  from public.travesia_aullidos a join fbe_privado.comunidad_dentro c on c.perfil_id = a.de
  where auth.uid() is not null and a.para = auth.uid() and a.dia >= (now() at time zone 'Europe/Madrid')::date - 7
    and public.comunidad_soy_miembro()   -- (revisión) y solo mientras quien los recibe sigue dentro
$$;

-- (revisión) Lo que caduca se borra aunque nadie juegue: la etapa del día a los ocho días y los aullidos a las dos semanas.
-- Lo llama una tarea diaria (si está pg_cron); además, cada vez que alguien juega la etapa del día o aúlla.
create or replace function fbe_privado.travesia_limpiar() returns void
language sql security definer set search_path = '' as $$
  delete from public.travesia_dia where dia < (now() at time zone 'Europe/Madrid')::date - 7;
  delete from public.travesia_aullidos where dia < (now() at time zone 'Europe/Madrid')::date - 14;
$$;
revoke all on function fbe_privado.travesia_limpiar() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      execute $q$select cron.schedule('fbe-travesia-limpiar', '17 4 * * *', 'select fbe_privado.travesia_limpiar()')$q$;
      raise notice 'FBE: limpieza diaria de La travesía programada (tarea fbe-travesia-limpiar, a las 4:17).';
    exception when others then
      raise warning 'FBE: no se ha podido programar la tarea fbe-travesia-limpiar (%); se limpia igual al jugar.', sqlerrm;
    end;
  else
    raise notice 'FBE: sin pg_cron: lo caducado de La travesía se borra al jugar la etapa del día o al aullar.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. La manada, con el perfil de cada uno (para aullarle)
-- ---------------------------------------------------------------------
create or replace function public.travesia_manada() returns jsonb
language sql stable security definer set search_path = '' as $$
  with hoy as (select (now() at time zone 'Europe/Madrid')::date as d),
  lunes as (select d - (extract(isodow from d)::integer - 1) as l, date_trunc('month', d)::date as mes from hoy),
  semana as (
    select d.perfil_id, d.nombre, d.sin_ranking, t.metros, t.estrellas, t.mejor,
           (t.actualizada_en at time zone 'Europe/Madrid')::date = (select d from hoy) as corre_hoy
    from public.travesia_semanas t join fbe_privado.comunidad_dentro d on d.atleta_id = t.atleta_id
    where t.semana = (select l from lunes) and t.metros > 0
  ),
  mes as (
    select coalesce(sum(t.metros) filter (where not d.sin_ranking), 0) as m_vis, coalesce(sum(t.metros) filter (where d.sin_ranking), 0) as m_oc,
           count(distinct t.atleta_id) filter (where not d.sin_ranking) as n_vis, count(distinct t.atleta_id) filter (where d.sin_ranking) as n_oc
    from public.travesia_semanas t join fbe_privado.comunidad_dentro d on d.atleta_id = t.atleta_id
    where date_trunc('month', t.semana + 3)::date = (select mes from lunes)
  )
  select case when auth.uid() is null or not (public.es_coach() or public.comunidad_soy_miembro()) then null else jsonb_build_object(
    'semana', (select l from lunes),
    'filas', coalesce((select jsonb_agg(jsonb_build_object('nombre', s.nombre, 'metros', s.metros, 'estrellas', s.estrellas, 'mejor', s.mejor, 'yo', s.perfil_id = auth.uid(), 'hoy', s.corre_hoy,
                                                           'perfil', case when s.perfil_id = auth.uid() then null else s.perfil_id end)
                        order by s.metros desc, s.nombre)
                       from semana s where not s.sin_ranking or s.perfil_id = auth.uid()), '[]'::jsonb),
    'equipo', jsonb_build_object('mes', (select mes from lunes), 'metros', (select m_vis + case when n_oc >= 3 then m_oc else 0 end from mes),
                                'miembros', (select n_vis + case when n_oc >= 3 then n_oc else 0 end from mes))
  ) end
$$;

-- ---------------------------------------------------------------------
-- 5. Quién ve qué
-- ---------------------------------------------------------------------
alter table public.travesia_perfil enable row level security;
alter table public.travesia_dia enable row level security;
alter table public.travesia_aullidos enable row level security;

drop policy if exists coach_ver on public.travesia_perfil;
create policy coach_ver on public.travesia_perfil for select to authenticated using (public.es_coach());
drop policy if exists coach_borrar on public.travesia_perfil;
create policy coach_borrar on public.travesia_perfil for delete to authenticated using (public.es_coach());
drop policy if exists atleta_ver on public.travesia_perfil;
create policy atleta_ver on public.travesia_perfil for select to authenticated using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_borrar on public.travesia_perfil;
create policy atleta_borrar on public.travesia_perfil for delete to authenticated using (atleta_id = public.mi_atleta_id());

drop policy if exists coach_ver on public.travesia_dia;
create policy coach_ver on public.travesia_dia for select to authenticated using (public.es_coach());
drop policy if exists coach_borrar on public.travesia_dia;
create policy coach_borrar on public.travesia_dia for delete to authenticated using (public.es_coach());
drop policy if exists atleta_ver on public.travesia_dia;
create policy atleta_ver on public.travesia_dia for select to authenticated using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_borrar on public.travesia_dia;
-- (revisión) el atleta borra lo suyo de días pasados; lo de hoy no (borrarlo daría intentos de más)
create policy atleta_borrar on public.travesia_dia for delete to authenticated using (atleta_id = public.mi_atleta_id() and dia < (now() at time zone 'Europe/Madrid')::date);

-- (los aullidos: cada uno ve los que ha mandado (no los borra: borrarlos daría aullidos de más; se van solos a las dos
-- semanas o con la ficha); los recibidos, solo con travesia_aullidos_recibidos())
drop policy if exists coach_ver on public.travesia_aullidos;
create policy coach_ver on public.travesia_aullidos for select to authenticated using (public.es_coach());
drop policy if exists coach_borrar on public.travesia_aullidos;
create policy coach_borrar on public.travesia_aullidos for delete to authenticated using (public.es_coach());
drop policy if exists mios_ver on public.travesia_aullidos;
create policy mios_ver on public.travesia_aullidos for select to authenticated using (de = auth.uid());
drop policy if exists mios_borrar on public.travesia_aullidos;

-- Desde la 019, cada tabla nueva lleva sus permisos a mano
revoke all on public.travesia_perfil, public.travesia_dia, public.travesia_aullidos from public, anon, authenticated;
grant select, delete on public.travesia_perfil, public.travesia_dia, public.travesia_aullidos to authenticated;

-- ---------------------------------------------------------------------
-- 6. Permisos (como al final de 003 a 061)
-- ---------------------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb), public.salud_recibir(text, jsonb), public.calendario_de(text) from public, anon, authenticated;
revoke execute on function public.sesion_video_proteger(), public.guia_tocar(), public.novedad_tocar() from public, anon, authenticated;
-- (las del reloj, si están)
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('reloj_estado', 'reloj_serie', 'reloj_saltar', 'reloj_elegir', 'reloj_terminar') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (62)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
