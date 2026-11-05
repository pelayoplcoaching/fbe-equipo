-- =====================================================================
-- FBE Equipo, migración 042 (v0.70): segunda tanda de mejoras de la comunidad, «constancia en compañía»
--   · Compañeros de racha (comunidad_companeros): un atleta invita a hasta 3 del equipo; el invitado acepta o no, y
--     cualquiera de los dos lo termina cuando quiera. Cada pareja tiene su racha: semanas seguidas en las que LOS DOS han
--     completado su semana (como la racha de siempre: las semanas sin nada publicado de uno no suman ni rompen; la semana en
--     curso suma si los dos la tienen completa y, si no, aún no rompe), contadas desde la semana en que se aceptó. La pareja
--     la ven los dos, el coach y, si ninguno ha elegido «No salir en el ranking», los del equipo (en su perfil).
--     comunidad_invitar_companero(), comunidad_responder_companero(), comunidad_dejar_companero(), comunidad_companeros().
--     El sábado por la tarde (de 19:00 a 22:00, Madrid), crear_recordatorios() avisa a quien aún no ha completado su semana
--     si su compañero sí («Rubén M. ya ha completado su semana: ¿cerráis la racha?»), una vez por pareja y semana, con la
--     preferencia «Equipo».
--   · Retos que cuentan otra cosa (comunidad_retos.medida): sesiones (como siempre), minutos de cardio (de cardio_hecho de las
--     sesiones que cuentan; solo de quien enciende «Contar mis minutos de cardio en los retos», comunidad_miembros.cardio_en_retos,
--     apagado de entrada) o semanas completas (semanas con todo lo publicado hecho).
--   · Retos por equipos (modo «equipos», comunidad_retos.equipos con sus dos nombres): el coach reparte a los del equipo en dos
--     (comunidad_reto_equipos, que solo ve él; comunidad_reto_equipos_guardar()). Cada equipo suma lo de los suyos, sin quien
--     no sale en el ranking (puede estar en un equipo, pero lo suyo no suma: como en «Entre todos», así no se le puede
--     adivinar restando): comunidad_retos_equipos(). Para repartirlos
--     igualados, comunidad_sesiones_recientes() (solo el coach: sesiones de las últimas 4 semanas de cada uno).
--   · Insignias del equipo, calculadas con lo que ya hay (nadie las da a mano): primera publicación, 10 ánimos dados, 25
--     reacciones, 5 retos conseguidos, racha de 4 semanas y racha de 4 con un compañero. comunidad_insignias(): las propias, con
--     su progreso; las de los demás, solo las conseguidas; de quien no sale en el ranking, nada (salvo para él y el coach).
--   · Salir del equipo, que el coach te saque, darse de baja o dejar de tener aceptado lo que se comparte termina sus parejas
--     (un disparador: al volver, no reaparecen); «Descargar mis datos» las lleva. Invitar y aceptar se hacen de uno en uno por
--     persona (pg_advisory_xact_lock), así que el máximo de 3 no se salta con dos peticiones a la vez.
-- Lo que se acepta al entrar no cambia (comunidad-2026-11-b): las parejas son voluntarias (invitar y aceptar), los minutos de
-- cardio se encienden a mano, y las insignias y los retos por equipos salen de lo que ya se comparte.
-- Se ejecuta en el SQL Editor después de la 041 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 42 then
    raise exception 'Esta base ya tiene la migración %: repetir la 042 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 42;» y, después de ella, todas las siguientes en orden, todo en la misma consulta del SQL Editor (una sola transacción).';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 41) then
    raise exception 'Antes de la 042 hace falta la 041: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Validadores (nunca dan un error: con algo raro, false o 0)
-- ---------------------------------------------------------------------
-- El objetivo más alto de un reto según cómo se consigue y qué cuenta (como RETO_MAX en web/src/logica/comunidad.js)
create or replace function public.comunidad_reto_maximo(p_modo text, p_medida text) returns integer
language plpgsql immutable set search_path = '' as $$
begin
  return case
    when p_modo not in ('individual', 'equipo', 'equipos') then 0
    when p_medida = 'sesiones' then case when p_modo = 'individual' then 100 else 5000 end
    when p_medida = 'cardio' then case when p_modo = 'individual' then 3000 else 30000 end
    when p_medida = 'semanas' then case when p_modo = 'individual' then 52 else 1000 end
    else 0 end;
exception when others then
  return 0;
end $$;

-- Los nombres de los dos equipos: dos, distintos, de 1 a 30 letras y con algo visible
create or replace function public.comunidad_equipos_validos(p text[]) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if p is null or cardinality(p) <> 2 or array_ndims(p) <> 1 then return false; end if;
  if p[1] is null or p[2] is null or lower(btrim(p[1])) = lower(btrim(p[2])) then return false; end if;
  return char_length(p[1]) between 1 and 30 and char_length(p[2]) between 1 and 30
     and p[1] = btrim(p[1]) and p[2] = btrim(p[2])
     and public.texto_visible(p[1]) and public.texto_visible(p[2]);
exception when others then
  return false;
end $$;

-- ---------------------------------------------------------------------
-- 2. Columnas y tablas
-- ---------------------------------------------------------------------
alter table public.comunidad_miembros add column if not exists cardio_en_retos boolean not null default false;

alter table public.comunidad_retos add column if not exists medida text not null default 'sesiones';
alter table public.comunidad_retos add column if not exists equipos text[];
alter table public.comunidad_retos drop constraint if exists comunidad_retos_validos;
alter table public.comunidad_retos add constraint comunidad_retos_validos check (
  char_length(titulo) between 1 and 80 and public.texto_visible(titulo)
  and (descripcion is null or (char_length(descripcion) between 1 and 500 and public.texto_visible(descripcion)))
  and desde >= date '2020-01-01' and hasta < date '2100-01-01' and hasta >= desde and hasta - desde <= 366
  and modo in ('individual', 'equipo', 'equipos')
  and medida in ('sesiones', 'cardio', 'semanas')
  and objetivo between 1 and public.comunidad_reto_maximo(modo, medida)
  and (modo = 'equipos') = (equipos is not null)
  and (equipos is null or public.comunidad_equipos_validos(equipos))
);

-- En qué equipo está cada uno en un reto por equipos (0 o 1). Solo lo ve el coach.
create table if not exists public.comunidad_reto_equipos (
  reto_id    uuid not null references public.comunidad_retos(id) on delete cascade,
  atleta_id  uuid not null references public.atletas(id) on delete cascade,
  perfil_id  uuid not null references public.perfiles(id) on delete cascade,
  equipo     smallint not null,
  primary key (reto_id, atleta_id)
);
create index if not exists comunidad_reto_equipos_atleta_idx on public.comunidad_reto_equipos (atleta_id);
create index if not exists comunidad_reto_equipos_perfil_idx on public.comunidad_reto_equipos (perfil_id);
alter table public.comunidad_reto_equipos drop constraint if exists comunidad_reto_equipos_validos;
alter table public.comunidad_reto_equipos add constraint comunidad_reto_equipos_validos check (equipo in (0, 1));

-- Compañeros de racha: una fila por pareja (pendiente o aceptada). Rechazar o terminar la borra.
create table if not exists public.comunidad_companeros (
  id              uuid primary key default gen_random_uuid(),
  de              uuid not null references public.perfiles(id) on delete cascade,   -- quien invita
  para            uuid not null references public.perfiles(id) on delete cascade,   -- quien recibe la invitación
  de_atleta_id    uuid references public.atletas(id) on delete cascade,
  para_atleta_id  uuid references public.atletas(id) on delete cascade,
  estado          text not null default 'pendiente',
  creado_en       timestamptz not null default now(),
  aceptado_en     timestamptz
);
create unique index if not exists comunidad_companeros_pareja_idx on public.comunidad_companeros (least(de, para), greatest(de, para));
create index if not exists comunidad_companeros_de_idx on public.comunidad_companeros (de);
create index if not exists comunidad_companeros_para_idx on public.comunidad_companeros (para);
create index if not exists comunidad_companeros_de_atleta_idx on public.comunidad_companeros (de_atleta_id);
create index if not exists comunidad_companeros_para_atleta_idx on public.comunidad_companeros (para_atleta_id);
alter table public.comunidad_companeros drop constraint if exists comunidad_companeros_validos;
alter table public.comunidad_companeros add constraint comunidad_companeros_validos check (
  de <> para and estado in ('pendiente', 'aceptada') and (estado = 'aceptada') = (aceptado_en is not null)
);

-- ---------------------------------------------------------------------
-- 3. Quién ve qué (lo de los demás, solo dentro; el coach, todo)
-- ---------------------------------------------------------------------
alter table public.comunidad_reto_equipos enable row level security;
alter table public.comunidad_companeros enable row level security;

drop policy if exists coach_ver on public.comunidad_reto_equipos;
create policy coach_ver on public.comunidad_reto_equipos for select to authenticated using (public.es_coach());

-- Las parejas: el coach, todas; cada uno, las suyas (con quien sigue dentro). A los demás, comunidad_companeros().
drop policy if exists coach_ver on public.comunidad_companeros;
create policy coach_ver on public.comunidad_companeros for select to authenticated using (public.es_coach());
drop policy if exists miembro_ver on public.comunidad_companeros;
create policy miembro_ver on public.comunidad_companeros for select to authenticated
  using (public.comunidad_soy_miembro() and (
    (de = auth.uid() and public.comunidad_autor_visible(para)) or (para = auth.uid() and public.comunidad_autor_visible(de))));

-- Desde la 019, cada tabla nueva lleva sus permisos a mano: solo lectura (se escriben con sus funciones)
revoke all on public.comunidad_reto_equipos, public.comunidad_companeros from public, anon, authenticated;
grant select on public.comunidad_reto_equipos, public.comunidad_companeros to authenticated;

-- ---------------------------------------------------------------------
-- 4. Lo que calcula la base (internas)
-- ---------------------------------------------------------------------
-- Lo que lleva un atleta entre dos fechas: sesiones (como siempre), minutos de cardio (de las sesiones que cuentan) o semanas
-- completas (las de lunes entre esas fechas con todo lo publicado hecho; la de esta semana, si ya está completa)
create or replace function fbe_privado.comunidad_valor(p_medida text, p_atleta uuid, p_desde date, p_hasta date) returns integer
language sql stable security definer set search_path = '' as $$
  select case p_medida
    when 'cardio' then (
      select coalesce(sum(case when jsonb_typeof(s.cardio_hecho -> 'minutos') = 'number' then floor((s.cardio_hecho ->> 'minutos')::numeric) else 0 end), 0)::integer
      from fbe_privado.comunidad_sesiones_validas(array[p_atleta]) v join public.sesiones s on s.id = v.sesion_id
      where v.fecha between p_desde and p_hasta)
    when 'semanas' then (
      select count(*)::integer from fbe_privado.comunidad_semanas_de(array[p_atleta]) x
      where x.lunes >= p_desde - (extract(isodow from p_desde)::integer - 1) and x.lunes <= p_hasta and x.hechas >= x.previstas)
    else fbe_privado.comunidad_hechas(p_atleta, p_desde, p_hasta) end
$$;

-- Lo que lleva un atleta en un reto (los minutos de cardio, solo si ha encendido «Contar mis minutos de cardio en los retos»)
create or replace function fbe_privado.comunidad_valor_reto(p_reto uuid, p_atleta uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case when r.medida = 'cardio' and not coalesce((select m.cardio_en_retos from public.comunidad_miembros m where m.atleta_id = p_atleta), false) then 0
                else fbe_privado.comunidad_valor(r.medida, p_atleta, r.desde, r.hasta) end
    from public.comunidad_retos r where r.id = p_reto), 0)
$$;

-- Lo que suma un equipo en un reto por equipos: los suyos que siguen dentro, sin quien no sale en el ranking (puede estar en el
-- equipo, pero lo suyo no suma: si sumara, restando lo que se ve de los demás se sabría lo suyo)
create or replace function fbe_privado.comunidad_total_equipo(p_reto uuid, p_equipo smallint) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(fbe_privado.comunidad_valor_reto(x.reto_id, d.atleta_id)), 0)::integer
  from public.comunidad_reto_equipos x
  join fbe_privado.comunidad_dentro d on d.atleta_id = x.atleta_id and not d.sin_ranking
  where x.reto_id = p_reto and x.equipo = p_equipo
$$;

-- El total de un reto (029), con lo que cuenta cada reto: «Entre todos», sin quien no sale en el ranking; por equipos, los dos
create or replace function fbe_privado.comunidad_total_reto(p_reto uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case when r.modo = 'equipos' then fbe_privado.comunidad_total_equipo(r.id, 0::smallint) + fbe_privado.comunidad_total_equipo(r.id, 1::smallint)
                else (select coalesce(sum(fbe_privado.comunidad_valor_reto(r.id, d.atleta_id)), 0)::integer from fbe_privado.comunidad_dentro d where not d.sin_ranking) end
    from public.comunidad_retos r where r.id = p_reto), 0)
$$;

-- ¿Ha conseguido este reto? (029) Individual: su objetivo; «Entre todos»: el total; por equipos: el total de su equipo. No
-- cuenta un reto que ya había acabado la última vez que entró (o volvió) en la comunidad.
create or replace function fbe_privado.comunidad_reto_conseguido(p_reto uuid, p_atleta uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.comunidad_retos r
    join public.comunidad_miembros m on m.atleta_id = p_atleta
    where r.id = p_reto and r.hasta >= (m.entrado_en at time zone 'Europe/Madrid')::date
      and case when r.modo = 'equipo' then fbe_privado.comunidad_total_reto(r.id)
               when r.modo = 'equipos' then coalesce((select fbe_privado.comunidad_total_equipo(r.id, x.equipo) from public.comunidad_reto_equipos x
                                                      where x.reto_id = r.id and x.atleta_id = p_atleta), 0)
               else fbe_privado.comunidad_valor_reto(r.id, p_atleta) end >= r.objetivo)
$$;

-- La racha de dos (y la mejor que han tenido) desde una fecha: semanas en las que los dos han completado la suya. La semana sin
-- nada publicado de uno no suma ni rompe; la de esta semana suma si los dos la tienen completa y, si no, no rompe. Con el mismo
-- atleta dos veces, su racha de siempre (y su mejor racha). Nunca da un error: con algo raro, 0.
create or replace function fbe_privado.comunidad_rachas_pareja(p_a uuid, p_b uuid, p_desde date)
returns table (racha integer, mejor integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_lunes date := fbe_privado.comunidad_lunes();
  v_desde date := coalesce(p_desde, date '2020-01-06');
  v_racha integer := 0;
  v_mejor integer := 0;
  r record;
begin
  v_desde := v_desde - (extract(isodow from v_desde)::integer - 1);
  for r in
    select x.lunes,
           bool_or(x.atleta_id = p_a) as hay_a, bool_and(x.atleta_id <> p_a or x.hechas >= x.previstas) as ok_a,
           bool_or(x.atleta_id = p_b) as hay_b, bool_and(x.atleta_id <> p_b or x.hechas >= x.previstas) as ok_b
    from fbe_privado.comunidad_semanas_de(array[p_a, p_b]) x
    where x.lunes >= v_desde
    group by x.lunes
    order by x.lunes
  loop
    if not (r.ok_a and r.ok_b) then
      if r.lunes < v_lunes then v_racha := 0; end if;
    elsif r.hay_a and r.hay_b then
      v_racha := v_racha + 1;
      v_mejor := greatest(v_mejor, v_racha);
    end if;
  end loop;
  return query select v_racha, v_mejor;
exception when others then
  return query select 0, 0;
end $$;

-- ¿Ha completado su semana? true, false (le falta algo) o null (no tiene nada publicado esta semana)
create or replace function fbe_privado.comunidad_semana_completa(p_atleta uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select x.hechas >= x.previstas from fbe_privado.comunidad_semanas_de(array[p_atleta]) x where x.lunes = fbe_privado.comunidad_lunes() limit 1)
$$;

-- Cuántos compañeros tiene alguien (aceptados, más las invitaciones que ha mandado), esté como esté el otro (las parejas de
-- quien sale, es sacado o se da de baja ya se borran con su disparador)
create or replace function fbe_privado.comunidad_companeros_ocupados(p_perfil uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.comunidad_companeros c
  where p_perfil in (c.de, c.para) and (c.estado = 'aceptada' or c.de = p_perfil)
$$;

-- Invitar y aceptar, de uno en uno por persona: bloquea a las dos (siempre en el mismo orden, así no se esperan la una a la otra)
-- hasta el final de la transacción, y luego se vuelve a contar
create or replace function fbe_privado.comunidad_bloquear_pareja(p_a uuid, p_b uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('comunidad_companeros:' || least(p_a, p_b)::text));
  perform pg_advisory_xact_lock(hashtext('comunidad_companeros:' || greatest(p_a, p_b)::text));
end $$;

-- Las parejas se terminan al salir, al ser sacado o bloqueado, al dejar de tener aceptado el texto vigente, al darse de baja o
-- al desvincular la ficha de su cuenta: así, si vuelve, no reaparecen (va después de comunidad_al_dejar, que retira antes sus
-- avisos pendientes)
create or replace function fbe_privado.comunidad_terminar_parejas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'comunidad_miembros' then
    if (new.salido_en is not null and old.salido_en is null) or (new.bloqueado and not old.bloqueado)
       or (new.version is distinct from old.version and new.version is distinct from public.comunidad_version()) then
      delete from public.comunidad_companeros where new.perfil_id in (de, para);
    end if;
  elsif tg_table_name = 'atletas' then
    if old.perfil_id is not null and ((new.estado = 'baja' and old.estado <> 'baja') or new.perfil_id is distinct from old.perfil_id) then
      delete from public.comunidad_companeros where old.perfil_id in (de, para);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists comunidad_miembros_zzz_parejas on public.comunidad_miembros;
create trigger comunidad_miembros_zzz_parejas after update of salido_en, bloqueado, version on public.comunidad_miembros
  for each row execute function fbe_privado.comunidad_terminar_parejas();
drop trigger if exists atletas_zzz_parejas on public.atletas;
create trigger atletas_zzz_parejas after update of estado, perfil_id on public.atletas
  for each row execute function fbe_privado.comunidad_terminar_parejas();

-- Las insignias de alguien: [clave, lo que lleva, lo que hace falta]
create or replace function fbe_privado.comunidad_insignias_de(p_atleta uuid, p_perfil uuid)
returns table (clave text, valor integer, meta integer)
language sql stable security definer set search_path = '' as $$
  select 'primera_publicacion'::text, (select count(*)::integer from public.comunidad_posts x where x.autor_id = p_perfil and not x.oculta), 1
  union all
  select 'animos_10', (select count(*)::integer from public.comunidad_animos a where a.de = p_perfil), 10
  union all
  select 'reacciones_25', (select count(*)::integer from public.comunidad_reacciones r where r.autor_id = p_perfil), 25
  union all
  select 'retos_5', (select count(*)::integer from public.comunidad_retos r where fbe_privado.comunidad_reto_conseguido(r.id, p_atleta)), 5
  union all
  select 'racha_4', coalesce((select p.mejor from fbe_privado.comunidad_rachas_pareja(p_atleta, p_atleta, null) p), 0), 4
  union all
  select 'pareja_4', coalesce((
    select max(p.mejor) from public.comunidad_companeros c
    join fbe_privado.comunidad_dentro o on o.perfil_id = case when c.de = p_perfil then c.para else c.de end
    cross join lateral fbe_privado.comunidad_rachas_pareja(p_atleta, o.atleta_id, (c.aceptado_en at time zone 'Europe/Madrid')::date) p
    where c.estado = 'aceptada' and p_perfil in (c.de, c.para)), 0), 4
$$;

-- ---------------------------------------------------------------------
-- 5. Retos: lo que cuenta cada uno y los equipos
-- ---------------------------------------------------------------------
-- El progreso de los retos (029), con lo que cuenta cada reto (misma forma). En uno de cardio, solo quien cuenta sus minutos;
-- en uno por equipos, solo los de algún equipo (uno mismo sale siempre).
create or replace function public.comunidad_retos_progreso()
returns table (reto_id uuid, perfil_id uuid, nombre text, hechas integer, objetivo integer, yo boolean)
language sql stable security definer set search_path = '' as $$
  select r.id, d.perfil_id, d.nombre, fbe_privado.comunidad_valor_reto(r.id, d.atleta_id), r.objetivo::integer, d.perfil_id = auth.uid()
  from public.comunidad_retos r
  cross join fbe_privado.comunidad_dentro d
  join public.comunidad_miembros m on m.atleta_id = d.atleta_id
  where (public.es_coach() or public.comunidad_soy_miembro())
    and (not d.sin_ranking or d.perfil_id = auth.uid())
    and (r.medida <> 'cardio' or m.cardio_en_retos or d.perfil_id = auth.uid())
    and (r.modo <> 'equipos' or d.perfil_id = auth.uid()
         or exists (select 1 from public.comunidad_reto_equipos x where x.reto_id = r.id and x.atleta_id = d.atleta_id))
$$;

-- Los equipos de cada reto por equipos: su nombre, lo que suman (sin quien no sale en el ranking) y quiénes salen por su nombre
-- (sin quien no sale en el ranking, salvo uno mismo y para el coach)
create or replace function public.comunidad_retos_equipos()
returns table (reto_id uuid, equipo smallint, nombre text, total integer, personas uuid[])
language sql stable security definer set search_path = '' as $$
  select r.id, e.n::smallint, r.equipos[e.n + 1], fbe_privado.comunidad_total_equipo(r.id, e.n::smallint),
    coalesce((select array_agg(d.perfil_id order by d.nombre) from public.comunidad_reto_equipos x
              join fbe_privado.comunidad_dentro d on d.atleta_id = x.atleta_id
              where x.reto_id = r.id and x.equipo = e.n and (public.es_coach() or not d.sin_ranking or d.perfil_id = auth.uid())), '{}'::uuid[])
  from public.comunidad_retos r cross join generate_series(0, 1) as e(n)
  where r.modo = 'equipos' and auth.uid() is not null and (public.es_coach() or public.comunidad_soy_miembro())
  order by r.id, e.n
$$;

-- El coach reparte un reto por equipos (sustituye el reparto anterior). Solo cuenta a quien está dentro. Devuelve cuántos.
create or replace function public.comunidad_reto_equipos_guardar(p_reto uuid, p_equipo_a uuid[], p_equipo_b uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  if not public.es_coach() then raise exception 'Solo el coach reparte los equipos' using errcode = '42501'; end if;
  if not exists (select 1 from public.comunidad_retos r where r.id = p_reto and r.modo = 'equipos') then
    raise exception 'Ese reto no es por equipos' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(coalesce(p_equipo_a, '{}')) a(id) where a.id = any (coalesce(p_equipo_b, '{}'))) then
    raise exception 'Una persona no puede estar en los dos equipos' using errcode = '22023';
  end if;
  delete from public.comunidad_reto_equipos where reto_id = p_reto;
  insert into public.comunidad_reto_equipos (reto_id, atleta_id, perfil_id, equipo)
  select p_reto, d.atleta_id, d.perfil_id, 0 from fbe_privado.comunidad_dentro d where d.perfil_id = any (coalesce(p_equipo_a, '{}'))
  union all
  select p_reto, d.atleta_id, d.perfil_id, 1 from fbe_privado.comunidad_dentro d where d.perfil_id = any (coalesce(p_equipo_b, '{}'));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Para repartir los equipos igualados (solo el coach): las sesiones que cuentan de las últimas 4 semanas de cada uno
create or replace function public.comunidad_sesiones_recientes()
returns table (perfil_id uuid, nombre text, sesiones integer)
language sql stable security definer set search_path = '' as $$
  select d.perfil_id, d.nombre,
    (select count(*)::integer from fbe_privado.comunidad_sesiones_validas(array[d.atleta_id]) v where v.fecha > fbe_privado.comunidad_hoy() - 28)
  from fbe_privado.comunidad_dentro d
  where public.es_coach()
  order by d.nombre
$$;

-- «Contar mis minutos de cardio en los retos» (apagado de entrada). Devuelve cómo queda.
create or replace function public.comunidad_cardio_en_retos(p_contar boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.comunidad_soy_miembro() then raise exception 'No estás en la comunidad' using errcode = '42501'; end if;
  update public.comunidad_miembros set cardio_en_retos = coalesce(p_contar, false) where perfil_id = auth.uid();
  return coalesce(p_contar, false);
end $$;

-- Compartir un logro (029), con lo que cuenta el reto y, en uno por equipos, el total de su equipo
create or replace function public.comunidad_compartir_logro(p_reto uuid, p_texto text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_atleta uuid;
  r public.comunidad_retos;
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
  v_hechas integer;
  v_equipo smallint;
  v_id uuid;
begin
  if v_uid is null or not public.comunidad_soy_miembro() then
    raise exception 'Para compartir en el equipo tienes que estar en la comunidad' using errcode = '42501';
  end if;
  v_atleta := public.mi_atleta_id();
  select * into r from public.comunidad_retos x where x.id = p_reto;
  if not found then raise exception 'Ese reto ya no está' using errcode = '22023'; end if;
  if not fbe_privado.comunidad_reto_conseguido(r.id, v_atleta) then
    raise exception 'Ese reto aún no está conseguido' using errcode = '22023';
  end if;
  if exists (select 1 from public.comunidad_posts x where x.autor_id = v_uid and x.reto_id = r.id and x.tipo = 'logro') then
    raise exception 'Este logro ya está compartido en el equipo' using errcode = '23505';
  end if;
  select x.equipo into v_equipo from public.comunidad_reto_equipos x where x.reto_id = r.id and x.atleta_id = v_atleta;
  v_hechas := case when r.modo = 'equipo' then fbe_privado.comunidad_total_reto(r.id)
                   when r.modo = 'equipos' then fbe_privado.comunidad_total_equipo(r.id, v_equipo)
                   else fbe_privado.comunidad_valor_reto(r.id, v_atleta) end;
  insert into public.comunidad_posts (autor_id, atleta_id, tipo, texto, reto_id, resumen)
  values (v_uid, v_atleta, 'logro', v_texto, r.id, jsonb_strip_nulls(jsonb_build_object(
    'titulo', r.titulo, 'modo', r.modo, 'medida', r.medida, 'objetivo', r.objetivo, 'hechas', coalesce(v_hechas, 0), 'desde', r.desde, 'hasta', r.hasta,
    'equipo', case when r.modo = 'equipos' and v_equipo is not null then r.equipos[v_equipo + 1] end)))
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 6. Compañeros de racha
-- ---------------------------------------------------------------------
-- Invitar a alguien de dentro (no a uno mismo; hasta 3 compañeros contando las invitaciones mandadas; gasta del cupo de los
-- ánimos). Le llega un aviso sin más texto. Devuelve la pareja.
create or replace function public.comunidad_invitar_companero(p_perfil uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_para_atleta uuid;
  v_id uuid;
begin
  if v_uid is null or not public.comunidad_soy_miembro() then
    raise exception 'Para tener compañeros de racha tienes que estar en la comunidad' using errcode = '42501';
  end if;
  if p_perfil is null or p_perfil = v_uid then raise exception 'Tu compañero de racha tiene que ser otra persona del equipo' using errcode = '22023'; end if;
  select d.atleta_id into v_para_atleta from fbe_privado.comunidad_dentro d where d.perfil_id = p_perfil;
  if v_para_atleta is null then raise exception 'Esa persona ya no está en el equipo' using errcode = '42501'; end if;
  perform fbe_privado.comunidad_bloquear_pareja(v_uid, p_perfil);
  if exists (select 1 from public.comunidad_companeros c where least(c.de, c.para) = least(v_uid, p_perfil) and greatest(c.de, c.para) = greatest(v_uid, p_perfil)) then
    raise exception 'Ya sois compañeros de racha (o hay una invitación pendiente)' using errcode = '23505';
  end if;
  if fbe_privado.comunidad_companeros_ocupados(v_uid) >= 3 then
    raise exception 'Puedes tener hasta 3 compañeros de racha (contando las invitaciones que has mandado)' using errcode = '22023';
  end if;
  if fbe_privado.comunidad_companeros_ocupados(p_perfil) >= 3 then
    raise exception 'Esa persona ya tiene 3 compañeros de racha' using errcode = '22023';
  end if;
  perform fbe_privado.comunidad_gastar_cupo('animo');
  insert into public.comunidad_companeros (de, para, de_atleta_id, para_atleta_id)
  values (v_uid, p_perfil, public.mi_atleta_id(), v_para_atleta)
  returning id into v_id;
  perform fbe_privado.notificar_seguro(p_perfil, 'comunidad', fbe_privado.comunidad_nombre(v_uid) || ' te invita a ser compañeros de racha',
    'Míralo en Equipo.', '#equipo', 'comunidad_companero:' || v_uid || ':' || p_perfil);
  return v_id;
end $$;

-- Aceptar (o no) una invitación recibida. Al aceptar, a quien invitó le llega un aviso. Devuelve si queda aceptada.
create or replace function public.comunidad_responder_companero(p_id uuid, p_aceptar boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  c public.comunidad_companeros;
begin
  if v_uid is null or not public.comunidad_soy_miembro() then
    raise exception 'Para tener compañeros de racha tienes que estar en la comunidad' using errcode = '42501';
  end if;
  select * into c from public.comunidad_companeros x
  where x.id = p_id and x.para = v_uid and x.estado = 'pendiente'
    and exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = x.de);
  if not found then raise exception 'Esa invitación ya no está' using errcode = '42501'; end if;
  -- (de uno en uno: se vuelve a mirar con las dos personas bloqueadas)
  perform fbe_privado.comunidad_bloquear_pareja(c.de, c.para);
  select * into c from public.comunidad_companeros x where x.id = p_id and x.para = v_uid and x.estado = 'pendiente';
  if not found then raise exception 'Esa invitación ya no está' using errcode = '42501'; end if;
  delete from public.notificaciones n where n.estado = 'pendiente' and n.clave = 'comunidad_companero:' || c.de || ':' || c.para;
  if not coalesce(p_aceptar, false) then
    delete from public.comunidad_companeros where id = c.id;
    return false;
  end if;
  if fbe_privado.comunidad_companeros_ocupados(v_uid) >= 3 then
    raise exception 'Ya tienes 3 compañeros de racha: termina con alguno antes de aceptar' using errcode = '22023';
  end if;
  if fbe_privado.comunidad_companeros_ocupados(c.de) > 3 then
    raise exception 'Esa persona ya tiene 3 compañeros de racha' using errcode = '22023';
  end if;
  update public.comunidad_companeros set estado = 'aceptada', aceptado_en = now() where id = c.id;
  perform fbe_privado.notificar_seguro(c.de, 'comunidad', fbe_privado.comunidad_nombre(v_uid) || ' y tú ya sois compañeros de racha',
    'Míralo en Equipo.', '#equipo', 'comunidad_companero_si:' || c.id);
  return true;
end $$;

-- Terminar una pareja (o retirar una invitación mandada): cualquiera de los dos, cuando quiera
create or replace function public.comunidad_dejar_companero(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.comunidad_companeros;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión' using errcode = '42501'; end if;
  delete from public.comunidad_companeros x where x.id = p_id and auth.uid() in (x.de, x.para) returning * into c;
  if c.id is null then raise exception 'Esa pareja ya no está' using errcode = '42501'; end if;
  delete from public.notificaciones n where n.estado = 'pendiente'
    and (n.clave = 'comunidad_companero:' || c.de || ':' || c.para or n.clave = 'comunidad_companero_si:' || c.id
         or n.clave like 'comunidad_pareja:' || c.id || ':%');
end $$;

-- Las parejas de alguien (sin p_perfil, las mías, también las invitaciones pendientes), vistas desde esa persona: con quién,
-- su estado, quién invitó, la racha de los dos y, solo para ellos dos y el coach, si cada uno ha completado ya esta semana.
-- La ven los dos, el coach y, si ninguno de los dos ha elegido «No salir en el ranking», los del equipo.
create or replace function public.comunidad_companeros(p_perfil uuid default null)
returns table (id uuid, perfil_id uuid, nombre text, foto text, estado text, invito boolean, racha integer, mi_semana boolean, su_semana boolean, creado_en timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, o.perfil_id, o.nombre, pf.foto, c.estado, c.de = y.perfil_id,
    case when c.estado = 'aceptada' then coalesce((select r.racha from fbe_privado.comunidad_rachas_pareja(y.atleta_id, o.atleta_id, (c.aceptado_en at time zone 'Europe/Madrid')::date) r), 0) end,
    case when c.estado = 'aceptada' and (public.es_coach() or auth.uid() in (c.de, c.para)) then fbe_privado.comunidad_semana_completa(y.atleta_id) end,
    case when c.estado = 'aceptada' and (public.es_coach() or auth.uid() in (c.de, c.para)) then fbe_privado.comunidad_semana_completa(o.atleta_id) end,
    c.creado_en
  from fbe_privado.comunidad_dentro y
  join public.comunidad_companeros c on y.perfil_id in (c.de, c.para)
  join fbe_privado.comunidad_dentro o on o.perfil_id = case when c.de = y.perfil_id then c.para else c.de end
  join public.perfiles pf on pf.id = o.perfil_id
  where y.perfil_id = coalesce(p_perfil, auth.uid())
    and auth.uid() is not null and (public.es_coach() or public.comunidad_soy_miembro())
    and (c.estado = 'aceptada' or auth.uid() in (c.de, c.para))
    and (public.es_coach() or auth.uid() in (c.de, c.para) or (not y.sin_ranking and not o.sin_ranking))
  order by c.estado, o.nombre
$$;

-- ---------------------------------------------------------------------
-- 7. Insignias
-- ---------------------------------------------------------------------
-- Las insignias de alguien (sin p_perfil, de todos los que se ven): las propias (y, para el coach, las de todos) con su
-- progreso; las de los demás, solo las conseguidas; de quien no sale en el ranking, nada. El progreso, como mucho la meta.
create or replace function public.comunidad_insignias(p_perfil uuid default null)
returns table (perfil_id uuid, clave text, valor integer, meta integer)
language sql stable security definer set search_path = '' as $$
  select d.perfil_id, i.clave, least(i.valor, i.meta), i.meta
  from fbe_privado.comunidad_dentro d
  cross join lateral fbe_privado.comunidad_insignias_de(d.atleta_id, d.perfil_id) i
  where auth.uid() is not null and (public.es_coach() or public.comunidad_soy_miembro())
    and (p_perfil is null or d.perfil_id = p_perfil)
    and (public.es_coach() or d.perfil_id = auth.uid() or (not d.sin_ranking and i.valor >= i.meta))
$$;

-- ---------------------------------------------------------------------
-- 8. Salir, descargar mis datos y lo que se retira
-- ---------------------------------------------------------------------
-- Salir (041): también termina sus parejas (siempre); con p_borrar, como antes
create or replace function public.comunidad_salir(p_borrar boolean default false) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_fotos text[] := '{}';
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión' using errcode = '42501'; end if;
  update public.comunidad_miembros set salido_en = now() where perfil_id = v_uid and salido_en is null;
  delete from public.comunidad_companeros where de = v_uid or para = v_uid;
  if coalesce(p_borrar, false) and not exists (select 1 from public.perfiles p where p.id = v_uid and p.rol = 'coach') then
    select coalesce(array_agg(x.foto_ruta) filter (where x.foto_ruta is not null), '{}') into v_fotos
    from public.comunidad_posts x where x.autor_id = v_uid
      and not exists (select 1 from public.comunidad_reportes r where r.copia_foto = x.foto_ruta and r.resuelto_en is null);
    delete from public.comunidad_reacciones where autor_id = v_uid;
    delete from public.comunidad_comentario_reacciones where autor_id = v_uid;
    delete from public.comunidad_votos where autor_id = v_uid;
    delete from public.comunidad_animos where de = v_uid or para = v_uid;
    delete from public.comunidad_bienvenidas where de = v_uid or para = v_uid;
    delete from public.comunidad_comentarios where autor_id = v_uid;
    delete from public.comunidad_posts where autor_id = v_uid;
  end if;
  return v_fotos;
end $$;

-- Todo lo suyo (041), también sus compañeros de racha (con quién, solo el nombre si sigue dentro)
create or replace function public.comunidad_mis_datos() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'miembro', (select to_jsonb(m) - 'perfil_id' from public.comunidad_miembros m where m.perfil_id = auth.uid()),
    'publicaciones', coalesce((select jsonb_agg((to_jsonb(x) - 'menciones') || jsonb_build_object('menciones', cardinality(x.menciones)) order by x.creado_en)
                               from public.comunidad_posts x where x.autor_id = auth.uid()), '[]'::jsonb),
    'comentarios', coalesce((select jsonb_agg((to_jsonb(c) - 'menciones') || jsonb_build_object('menciones', cardinality(c.menciones)) order by c.creado_en)
                             from public.comunidad_comentarios c where c.autor_id = auth.uid()), '[]'::jsonb),
    'reacciones', coalesce((select jsonb_agg(to_jsonb(r) order by r.creado_en) from public.comunidad_reacciones r where r.autor_id = auth.uid()), '[]'::jsonb),
    'reacciones_comentarios', coalesce((select jsonb_agg(jsonb_build_object('comentario_id', r.comentario_id, 'creado_en', r.creado_en) order by r.creado_en)
                                        from public.comunidad_comentario_reacciones r where r.autor_id = auth.uid()), '[]'::jsonb),
    'votos', coalesce((select jsonb_agg(to_jsonb(v) order by v.creado_en) from public.comunidad_votos v where v.autor_id = auth.uid()), '[]'::jsonb),
    'animos_mandados', coalesce((select jsonb_agg(
                                   case when exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = a.para)
                                        then jsonb_build_object('para', a.para, 'para_nombre', fbe_privado.comunidad_nombre(a.para), 'semana', a.semana, 'creado_en', a.creado_en)
                                        else jsonb_build_object('para_nombre', 'Alguien del equipo', 'semana', a.semana, 'creado_en', a.creado_en) end
                                   order by a.creado_en)
                                 from public.comunidad_animos a where a.de = auth.uid()), '[]'::jsonb),
    'animos_recibidos', coalesce((select jsonb_agg(jsonb_build_object('semana', a.semana, 'creado_en', a.creado_en) order by a.creado_en)
                                  from public.comunidad_animos a where a.para = auth.uid()), '[]'::jsonb),
    'bienvenidas_dadas', coalesce((select jsonb_agg(
                                     case when exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = b.para)
                                          then jsonb_build_object('para', b.para, 'para_nombre', fbe_privado.comunidad_nombre(b.para), 'creado_en', b.creado_en)
                                          else jsonb_build_object('para_nombre', 'Alguien del equipo', 'creado_en', b.creado_en) end
                                     order by b.creado_en)
                                   from public.comunidad_bienvenidas b where b.de = auth.uid()), '[]'::jsonb),
    'bienvenidas_recibidas', coalesce((select jsonb_agg(jsonb_build_object('creado_en', b.creado_en) order by b.creado_en)
                                       from public.comunidad_bienvenidas b where b.para = auth.uid()), '[]'::jsonb),
    'companeros', coalesce((select jsonb_agg(jsonb_build_object(
                              'con', case when exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = case when k.de = auth.uid() then k.para else k.de end)
                                          then fbe_privado.comunidad_nombre(case when k.de = auth.uid() then k.para else k.de end) else 'Alguien del equipo' end,
                              'estado', k.estado, 'invitaste', k.de = auth.uid(), 'creado_en', k.creado_en, 'aceptado_en', k.aceptado_en) order by k.creado_en)
                            from public.comunidad_companeros k where auth.uid() in (k.de, k.para)), '[]'::jsonb),
    'avisos_al_coach', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'post_id', r.post_id, 'comentario_id', r.comentario_id, 'motivo', r.motivo,
                                   'creado_en', r.creado_en, 'resuelto_en', r.resuelto_en) order by r.creado_en)
                                 from public.comunidad_reportes r where r.autor_id = auth.uid()), '[]'::jsonb)
  ) end
$$;

-- Quien deja de estar dentro (041): a los demás ya no les llegan sus menciones, sus ánimos, sus bienvenidas ni sus invitaciones
-- pendientes, ni los avisos de sus parejas (el de aceptar y el del sábado)
create or replace function fbe_privado.comunidad_retirar_suyas(p_perfil uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.notificaciones n
  where n.tipo = 'comunidad' and n.url = '#equipo' and n.estado = 'pendiente'
    and (n.clave like 'comunidad_animo:' || p_perfil || ':%' or n.clave like 'comunidad_mencion:%:' || replace(p_perfil::text, '-', '') || ':%'
         or n.clave = 'comunidad_bienvenida:' || p_perfil or n.clave like 'comunidad_companero:' || p_perfil || ':%'
         or exists (select 1 from public.comunidad_companeros c where p_perfil in (c.de, c.para)
                    and (n.clave like 'comunidad_pareja:' || c.id || ':%' or n.clave = 'comunidad_companero_si:' || c.id)));
$$;

-- ---------------------------------------------------------------------
-- 9. El aviso del sábado a las parejas
-- ---------------------------------------------------------------------
-- Los recordatorios (022), el resumen del domingo (041, con su bloque a prueba de fallos de la v0.69.1) y, el sábado de 19:00 a 22:00 (Madrid), a quien tiene sesiones esta
-- semana sin completar y su compañero de racha ya ha completado la suya: «Rubén M. ya ha completado su semana: ¿cerráis la
-- racha?». Una vez por pareja y semana (la clave lleva la pareja y el lunes), con la preferencia «Equipo»; caduca el domingo a
-- las 22:00.
create or replace function public.crear_recordatorios(p_ahora timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_local timestamp := p_ahora at time zone 'Europe/Madrid';
  v_hoy date := (p_ahora at time zone 'Europe/Madrid')::date;
  v_dow integer := extract(isodow from (p_ahora at time zone 'Europe/Madrid'))::integer;
  v_lunes date;
  v_n integer := 0;
  v_m integer;
  v_titulo text;
  v_cuerpo text;
begin
  perform fbe_privado.solo_servidor();
  v_lunes := v_hoy - (v_dow - 1);

  -- Hoy toca… (solo si planificó el día de la sesión en «Tu plan»). Cada consulta elige primero a quién
  -- (materialized: así la notificación solo se crea para esas filas, sin depender del orden del WHERE)
  with x as materialized (
    select d.perfil_id, d.hora_manana, count(*) as n, min(s.nombre) as nombre
    from fbe_privado.destinatarios d
    join public.atletas a on a.id = d.atleta_id and a.entrenamiento
    join public.bloques b on b.atleta_id = d.atleta_id and not b.es_plantilla and b.estado not in ('cancelado', 'finalizado')
    join public.semanas w on w.bloque_id = b.id and w.programacion = 'programada'
    join public.sesiones s on s.semana_id = w.id and s.dia_previsto = v_hoy and not s.completada
    where not ('sesion_hoy' = any (d.desactivados))
      and v_local >= v_hoy + d.hora_manana and v_local < v_hoy + d.hora_manana + interval '2 hours'
    group by d.perfil_id, d.hora_manana
  )
  select count(*) into v_m from x
  where fbe_privado.notificar_seguro(x.perfil_id, 'sesion_hoy',
          case when x.n = 1 then 'Hoy toca ' || x.nombre else 'Hoy tienes ' || x.n || ' sesiones' end,
          case when x.n = 1 then 'La tienes en Hoy.' else 'Las tienes en Hoy.' end,
          '#hoy', 'recordatorio_sesion:' || v_hoy, p_ahora,
          (v_hoy + x.hora_manana + interval '4 hours') at time zone 'Europe/Madrid');
  v_n := v_n + v_m;

  -- El check-in de la semana (el lunes, el de la semana que acaba de terminar, como en la app)
  with d as materialized (
    select d.perfil_id, d.hora_tarde from fbe_privado.destinatarios d
    where d.salud and not ('checkin' = any (d.desactivados)) and d.dia_checkin = v_dow
      and v_local >= v_hoy + d.hora_tarde and v_local < v_hoy + d.hora_tarde + interval '2 hours'
      and not exists (select 1 from public.checkins c
                      where c.atleta_id = d.atleta_id and c.semana_inicio = case when v_dow = 1 then v_lunes - 7 else v_lunes end)
  )
  select count(*) into v_m from d
  where fbe_privado.notificar_seguro(d.perfil_id, 'checkin', '¿Haces el check-in?',
          case when v_dow = 1 then 'El de la semana pasada aún está pendiente.' else 'El de esta semana aún está pendiente.' end,
          '#checkin', 'recordatorio_checkin:' || v_hoy, p_ahora,
          (v_hoy + d.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
  v_n := v_n + v_m;

  -- Por la tarde, una sola: los hábitos que hoy le hacen falta (los diarios sin apuntar y los de x días a la
  -- semana que ya no llegan si se salta hoy) y la nutrición sin apuntar (si tiene plan)
  with x as materialized (
    select * from (
    select d.perfil_id, d.hora_tarde,
      case when 'habitos' = any (d.desactivados) then 0 else (
        select count(*) from public.habitos h
        where h.atleta_id = d.atleta_id and h.activo
          and not exists (select 1 from public.registros_habito r where r.habito_id = h.id and r.fecha = v_hoy)
          and h.dias_semana - (
            select count(*) from public.registros_habito r
            where r.habito_id = h.id and r.fecha >= v_lunes and r.fecha < v_hoy
              and case when h.tipo = 'si_no' then r.valor >= 1
                       when h.sentido = 'al_menos' then r.valor >= h.objetivo
                       else r.valor <= h.objetivo end
          ) >= 8 - v_dow
      ) end as habitos,
      not ('nutricion' = any (d.desactivados))
        and exists (select 1 from public.planes_nutricion pn where pn.atleta_id = d.atleta_id and pn.desde <= v_hoy)
        and exists (select 1 from public.atletas a where a.id = d.atleta_id and a.nutricion)
        and not exists (select 1 from public.registros_nutricion rn where rn.atleta_id = d.atleta_id and rn.fecha = v_hoy) as nutricion
    from fbe_privado.destinatarios d
    where d.salud and v_local >= v_hoy + d.hora_tarde and v_local < v_hoy + d.hora_tarde + interval '2 hours'
    ) y
    where y.habitos > 0 or y.nutricion
  )
  select count(*) into v_m from x
  where fbe_privado.notificar_seguro(x.perfil_id, case when x.habitos > 0 then 'habitos' else 'nutricion' end,
          case when x.habitos > 0 and x.nutricion then
                 case when x.habitos = 1 then 'Te queda un hábito y la nutrición de hoy' else 'Te quedan ' || x.habitos || ' hábitos y la nutrición de hoy' end
               when x.habitos = 1 then 'Te queda un hábito de hoy'
               when x.habitos > 1 then 'Te quedan ' || x.habitos || ' hábitos de hoy'
               else '¿Apuntas lo que has comido hoy?' end,
          case when x.habitos > 0 then 'Apúntalo en Hoy antes de que acabe el día.' else 'Aún no has apuntado la nutrición de hoy.' end,
          '#hoy', 'recordatorio_tarde:' || v_hoy, p_ahora,
          (v_hoy + x.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
  v_n := v_n + v_m;

  -- (v0.69, 041) El domingo por la tarde, el resumen de la semana del equipo (una vez: la clave lleva el día)
  -- (revisión) en su propio bloque: si algo falla aquí, no se pierden los demás recordatorios de esa pasada
  begin
  if v_dow = 7 and v_local >= v_hoy + time '19:00' and v_local < v_hoy + time '22:00' and public.comunidad_activa() then
    select t.titulo, t.cuerpo into v_titulo, v_cuerpo
    from fbe_privado.comunidad_resumen_de_la_semana() r
    cross join lateral public.comunidad_texto_resumen(r.sesiones, r.records, r.semana_completa) t;
    if v_titulo is not null then
      with x as materialized (
        select d.perfil_id from fbe_privado.comunidad_dentro d
        union
        select p.id from public.perfiles p where p.rol = 'coach'
      )
      select count(*) into v_m from x
      where fbe_privado.notificar_seguro(x.perfil_id, 'comunidad', v_titulo, v_cuerpo, '#equipo', 'comunidad_resumen:' || v_hoy, p_ahora,
              (v_hoy + time '23:00') at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  end if;
  exception when others then
    raise warning 'FBE: resumen del domingo no creado: %', sqlerrm;
  end;

  -- (v0.70, 042) El sábado por la tarde, a quien aún no ha completado su semana y su compañero de racha sí (también en su
  -- propio bloque: si falla, los demás recordatorios se crean igual)
  begin
  if v_dow = 6 and v_local >= v_hoy + time '19:00' and v_local < v_hoy + time '22:00' and public.comunidad_activa() then
    with sem as materialized (
      select x.atleta_id, x.hechas >= x.previstas as completa
      from fbe_privado.comunidad_semanas_de(array(select d.atleta_id from fbe_privado.comunidad_dentro d
                                                  where exists (select 1 from public.comunidad_companeros c where c.estado = 'aceptada' and d.perfil_id in (c.de, c.para)))) x
      where x.lunes = v_lunes
    ), x as materialized (
      select c.id, a.perfil_id as falta, b.perfil_id as hecho
      from public.comunidad_companeros c
      join fbe_privado.comunidad_dentro a on a.perfil_id in (c.de, c.para)
      join fbe_privado.comunidad_dentro b on b.perfil_id in (c.de, c.para) and b.perfil_id <> a.perfil_id
      join sem sa on sa.atleta_id = a.atleta_id and not sa.completa
      join sem sb on sb.atleta_id = b.atleta_id and sb.completa
      where c.estado = 'aceptada'
        -- (a uno solo de los dos por pareja y semana)
        and not exists (select 1 from public.notificaciones n where n.clave = 'comunidad_pareja:' || c.id || ':' || v_lunes)
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.falta, 'comunidad', fbe_privado.comunidad_nombre(x.hecho) || ' ya ha completado su semana: ¿cerráis la racha?',
            'Míralo en Equipo.', '#equipo', 'comunidad_pareja:' || x.id || ':' || v_lunes, p_ahora,
            (v_hoy + 1 + time '22:00') at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  end if;
  exception when others then
    raise warning 'FBE: aviso del sábado a las parejas no creado: %', sqlerrm;
  end;
  return v_n;
end $$;

-- Permisos (como al final de 003 a 041)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (42)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
