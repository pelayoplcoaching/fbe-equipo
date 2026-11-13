-- =====================================================================
-- FBE Equipo, migración 065: Apuntes con los demás (liga, duelos, audio del coach y panel del equipo)
--
-- Por qué: los apuntes ya enseñan, se repasan y llevan la cuenta en el móvil de cada atleta. Esta añade lo que necesita
-- la base para la última tanda de mejoras de los apuntes:
--
--   * apuntes_semanas: los puntos y los apuntes de cada atleta por semana (los manda la app; se queda el mayor). Con
--     ellos, apuntes_liga(): la liga semanal de aprendizaje entre quienes están en la comunidad, con las reglas de la
--     clasificación de la travesía (061): el nombre de la comunidad; quien marcó «No salir en el ranking» no sale (solo
--     se ve a sí mismo) y lo suyo solo suma al total del equipo si son al menos tres.
--   * apuntes_duelos: duelos de cinco preguntas del glosario entre dos de la comunidad (los dos en el ranking), cada uno
--     cuando pueda, durante una semana. La base guarda la semilla (las preguntas salen de ella, iguales para los dos) y
--     los aciertos; los del rival solo se ven después de contestar.
--   * novedades.audio_ruta y audio_segundos: el coach graba una audio-píldora (hasta 5 minutos) en una novedad, un
--     apunte suelto o una pregunta. Va a un bucket privado («apuntes»): lo sube el coach y lo oyen sus atletas mientras
--     esa novedad está publicada. Al quitarla, el archivo va a la cola de Storage.
--   * apuntes_dominio_equipo(): para el coach, cuántos atletas han visto cada apunte, su caja media y cuántos lo dominan
--     (caja 3 o más). Solo cuentas, nunca quién. La app lo junta por temas.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 064 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada. (Si otra rama ha usado ya el número 065, renumerar esta.)
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 65 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 065 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 65;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 64) then  -- (2) la anterior
    raise exception 'Falta la migración 064 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Los puntos de cada semana y la liga
-- ---------------------------------------------------------------------
create table if not exists public.apuntes_semanas (
  atleta_id      uuid not null references public.atletas(id) on delete cascade,
  semana         date not null,                 -- el lunes
  puntos         integer not null default 0 check (puntos between 0 and 20000),
  apuntes        integer not null default 0 check (apuntes between 0 and 2000),
  actualizada_en timestamptz not null default now(),
  primary key (atleta_id, semana),
  check (extract(isodow from semana) = 1)
);
alter table public.apuntes_semanas enable row level security;
drop policy if exists coach_ver on public.apuntes_semanas;
create policy coach_ver on public.apuntes_semanas for select to authenticated using (public.es_coach());
drop policy if exists propio_ver on public.apuntes_semanas;
create policy propio_ver on public.apuntes_semanas for select to authenticated using (atleta_id = public.mi_atleta_id());
drop policy if exists propio_borrar on public.apuntes_semanas;
create policy propio_borrar on public.apuntes_semanas for delete to authenticated using (atleta_id = public.mi_atleta_id());

-- La app manda lo que lleva esta semana (o la pasada, si se quedó sin subir): se queda el mayor de cada cifra
create or replace function public.apuntes_semana_sumar(p_semana date, p_puntos integer, p_apuntes integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_atleta uuid := public.mi_atleta_id();
  v_lunes date := (now() at time zone 'Europe/Madrid')::date - (extract(isodow from (now() at time zone 'Europe/Madrid')::date)::integer - 1);
begin
  if v_atleta is null then raise exception 'Solo un atleta' using errcode = '42501'; end if;
  if p_semana is null or p_semana not in (v_lunes, v_lunes - 7) then raise exception 'Esa semana no vale' using errcode = '22023'; end if;
  if p_puntos is null or p_puntos < 0 or p_puntos > 20000 or p_apuntes is null or p_apuntes < 0 or p_apuntes > 2000 then
    raise exception 'Esas cifras no valen' using errcode = '22023';
  end if;
  insert into public.apuntes_semanas as x (atleta_id, semana, puntos, apuntes) values (v_atleta, p_semana, p_puntos, p_apuntes)
  on conflict (atleta_id, semana) do update set puntos = greatest(x.puntos, excluded.puntos), apuntes = greatest(x.apuntes, excluded.apuntes), actualizada_en = now();
  return true;
end $$;

-- La liga de la semana (para quien está en la comunidad, o el coach): sus filas (nombre de la comunidad, puntos,
-- apuntes y si soy yo), la gente a la que se puede retar (dentro y en el ranking, sin mí) y el total del equipo
create or replace function public.apuntes_liga() returns jsonb
language sql stable security definer set search_path = '' as $$
  with hoy as (select (now() at time zone 'Europe/Madrid')::date as d),
  lunes as (select d - (extract(isodow from d)::integer - 1) as l from hoy),
  semana as (
    select d.perfil_id, d.nombre, d.sin_ranking, s.puntos, s.apuntes
    from public.apuntes_semanas s join fbe_privado.comunidad_dentro d on d.atleta_id = s.atleta_id
    where s.semana = (select l from lunes) and s.puntos > 0
  ),
  tot as (
    select coalesce(sum(puntos) filter (where not sin_ranking), 0) as p_vis, coalesce(sum(puntos) filter (where sin_ranking), 0) as p_oc,
           count(*) filter (where not sin_ranking) as n_vis, count(*) filter (where sin_ranking) as n_oc from semana
  )
  select case when auth.uid() is null or not (public.es_coach() or public.comunidad_soy_miembro()) then null else jsonb_build_object(
    'semana', (select l from lunes),
    'filas', coalesce((select jsonb_agg(jsonb_build_object('nombre', s.nombre, 'puntos', s.puntos, 'apuntes', s.apuntes, 'yo', s.perfil_id = auth.uid()) order by s.puntos desc, s.nombre)
                       from semana s where not s.sin_ranking or s.perfil_id = auth.uid()), '[]'::jsonb),
    'gente', coalesce((select jsonb_agg(jsonb_build_object('id', d.perfil_id, 'nombre', d.nombre) order by d.nombre)
                       from fbe_privado.comunidad_dentro d where not d.sin_ranking and d.perfil_id <> auth.uid()
                         and not public.es_coach() and not exists (select 1 from fbe_privado.comunidad_dentro y where y.perfil_id = auth.uid() and y.sin_ranking)), '[]'::jsonb),
    'equipo', jsonb_build_object('puntos', (select p_vis + case when n_oc >= 3 then p_oc else 0 end from tot),
                                'miembros', (select n_vis + case when n_oc >= 3 then n_oc else 0 end from tot))
  ) end
$$;

-- ---------------------------------------------------------------------
-- 2. Los duelos de cinco preguntas
-- ---------------------------------------------------------------------
create table if not exists public.apuntes_duelos (
  id         uuid primary key default gen_random_uuid(),
  de         uuid not null references public.perfiles(id) on delete cascade,
  para       uuid not null references public.perfiles(id) on delete cascade,
  semilla    integer not null check (semilla between 1 and 2000000000),
  aciertos_de   smallint check (aciertos_de between 0 and 5),
  aciertos_para smallint check (aciertos_para between 0 and 5),
  creado_en  timestamptz not null default now(),
  caduca     date not null,
  check (de <> para)
);
create index if not exists apuntes_duelos_de_idx on public.apuntes_duelos (de, caduca);
create index if not exists apuntes_duelos_para_idx on public.apuntes_duelos (para, caduca);
alter table public.apuntes_duelos enable row level security;
drop policy if exists coach_ver on public.apuntes_duelos;
create policy coach_ver on public.apuntes_duelos for select to authenticated using (public.es_coach());
drop policy if exists mios_ver on public.apuntes_duelos;
create policy mios_ver on public.apuntes_duelos for select to authenticated using (auth.uid() in (de, para) and public.comunidad_soy_miembro());

-- Retar: los dos dentro de la comunidad (abierta) y en el ranking; como mucho tres duelos vivos cada uno y uno vivo
-- entre los mismos dos. Se le avisa al retado.
create or replace function public.apuntes_duelo_retar(p_para uuid, p_semilla integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_yo fbe_privado.comunidad_dentro;
  v_el fbe_privado.comunidad_dentro;
  v_id uuid;
begin
  if v_uid is null or not public.comunidad_activa() or not public.comunidad_soy_miembro() then
    raise exception 'Para retar tienes que estar en la comunidad (y abierta)' using errcode = '42501';
  end if;
  if p_para is null or p_para = v_uid then raise exception 'Contra ti ya juegas cada día' using errcode = '22023'; end if;
  if p_semilla is null or p_semilla < 1 or p_semilla > 2000000000 then raise exception 'Esa semilla no vale' using errcode = '22023'; end if;
  select * into v_yo from fbe_privado.comunidad_dentro d where d.perfil_id = v_uid;
  select * into v_el from fbe_privado.comunidad_dentro d where d.perfil_id = p_para;
  if v_el.perfil_id is null then raise exception 'Esa persona ya no está en el equipo' using errcode = '42501'; end if;
  if v_yo.sin_ranking or v_el.sin_ranking then raise exception 'Los duelos enseñan aciertos: los dos tenéis que salir en el ranking' using errcode = '22023'; end if;
  if (select count(*) from public.apuntes_duelos x where v_uid in (x.de, x.para) and x.caduca >= v_hoy and (x.aciertos_de is null or x.aciertos_para is null)) >= 3 then
    raise exception 'Como mucho tres duelos a la vez' using errcode = '54000';
  end if;
  if (select count(*) from public.apuntes_duelos x where p_para in (x.de, x.para) and x.caduca >= v_hoy and (x.aciertos_de is null or x.aciertos_para is null)) >= 3 then
    raise exception 'Esa persona ya tiene tres duelos: rétale más adelante' using errcode = '54000';
  end if;
  if exists (select 1 from public.apuntes_duelos x where least(x.de, x.para) = least(v_uid, p_para) and greatest(x.de, x.para) = greatest(v_uid, p_para)
             and x.caduca >= v_hoy and (x.aciertos_de is null or x.aciertos_para is null)) then
    raise exception 'Ya tenéis un duelo sin acabar' using errcode = '23505';
  end if;
  insert into public.apuntes_duelos (de, para, semilla, caduca) values (v_uid, p_para, p_semilla, v_hoy + 7) returning id into v_id;
  perform fbe_privado.notificar_seguro(p_para, 'comunidad', left(coalesce(v_yo.nombre, 'Alguien del equipo'), 40) || ' te reta a un duelo de apuntes',
    'Cinco preguntas, cuando puedas. Está en Semana, en «Tus apuntes».', '#semana', 'apuntes_duelo:' || v_id, null,
    (v_hoy + 8)::timestamp at time zone 'Europe/Madrid');
  return v_id;
end $$;

-- Contestar (una vez, mientras no caduque): los aciertos de cinco
create or replace function public.apuntes_duelo_contestar(p_id uuid, p_aciertos smallint) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  x public.apuntes_duelos;
begin
  if p_aciertos is null or p_aciertos < 0 or p_aciertos > 5 then raise exception 'De 0 a 5' using errcode = '22023'; end if;
  select * into x from public.apuntes_duelos d where d.id = p_id and v_uid in (d.de, d.para) for update;
  if not found or not public.comunidad_soy_miembro() then raise exception 'Ese duelo no es tuyo' using errcode = '42501'; end if;
  if x.caduca < (now() at time zone 'Europe/Madrid')::date then raise exception 'Ese duelo ya ha caducado' using errcode = '22023'; end if;
  if (x.de = v_uid and x.aciertos_de is not null) or (x.para = v_uid and x.aciertos_para is not null) then
    raise exception 'Ya lo has contestado' using errcode = '23505';
  end if;
  if x.de = v_uid then update public.apuntes_duelos set aciertos_de = p_aciertos where id = p_id;
  else update public.apuntes_duelos set aciertos_para = p_aciertos where id = p_id; end if;
  return true;
end $$;

-- Los míos (de la última semana y los vivos): el rival por su nombre de la comunidad, la semilla, mis aciertos y los
-- suyos (solo si ya he contestado y sigue dentro y en el ranking)
create or replace function public.apuntes_duelos_mios()
returns table (id uuid, soy_retador boolean, rival_nombre text, semilla integer, mios smallint, suyos smallint, rival_contesto boolean, caduca date, acabado boolean, creado_en timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.id, d.de = auth.uid(), coalesce(dr.nombre, 'Alguien del equipo'), d.semilla,
    case when d.de = auth.uid() then d.aciertos_de else d.aciertos_para end,
    case when (case when d.de = auth.uid() then d.aciertos_de else d.aciertos_para end) is not null and dr.perfil_id is not null and not dr.sin_ranking
         then case when d.de = auth.uid() then d.aciertos_para else d.aciertos_de end end,
    (case when d.de = auth.uid() then d.aciertos_para else d.aciertos_de end) is not null,
    d.caduca,
    (d.aciertos_de is not null and d.aciertos_para is not null) or d.caduca < (now() at time zone 'Europe/Madrid')::date,
    d.creado_en
  from public.apuntes_duelos d
  left join fbe_privado.comunidad_dentro dr on dr.perfil_id = case when d.de = auth.uid() then d.para else d.de end
  where auth.uid() in (d.de, d.para) and public.comunidad_soy_miembro() and d.caduca >= (now() at time zone 'Europe/Madrid')::date - 7
  order by d.creado_en desc
  limit 20
$$;

-- ---------------------------------------------------------------------
-- 3. Las audio-píldoras del coach
-- ---------------------------------------------------------------------
alter table public.novedades add column if not exists audio_ruta text;
alter table public.novedades add column if not exists audio_segundos smallint;
alter table public.novedades drop constraint if exists novedades_audio_valido;
alter table public.novedades add constraint novedades_audio_valido check (
  (audio_ruta is null and audio_segundos is null)
  or coalesce(audio_ruta ~ '^audio/[0-9a-f-]{36}\.(webm|ogg|m4a|mp4|mp3|aac|wav)$' and audio_segundos between 1 and 300, false)
);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('apuntes', 'apuntes', false, 5242880, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav', 'audio/x-wav'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- ¿Es el audio de una novedad publicada? (para que la oigan sus atletas)
create or replace function public.audio_de_apunte(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.novedades n where n.audio_ruta = p_ruta and n.publicada)
$$;
drop policy if exists fbe_apuntes_ver on storage.objects;
create policy fbe_apuntes_ver on storage.objects for select to authenticated
  using (bucket_id = 'apuntes' and (public.es_coach() or (public.mi_atleta_id() is not null and public.audio_de_apunte(name))));
drop policy if exists fbe_apuntes_subir on storage.objects;
create policy fbe_apuntes_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'apuntes' and public.es_coach() and name ~ '^audio/[0-9a-f-]{36}\.(webm|ogg|m4a|mp4|mp3|aac|wav)$');
drop policy if exists fbe_apuntes_borrar on storage.objects;
create policy fbe_apuntes_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'apuntes' and public.es_coach());
-- La cola de Storage sabe de este bucket; al quitar o cambiar el audio de una novedad, el de antes, a la cola
alter table fbe_privado.storage_por_borrar drop constraint if exists storage_por_borrar_bucket_check;
alter table fbe_privado.storage_por_borrar add constraint storage_por_borrar_bucket_check check (bucket in ('archivos', 'voz', 'comunidad', 'apuntes'));
create or replace function public.novedad_audio_fuera() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.audio_ruta is not null and (tg_op = 'DELETE' or new.audio_ruta is distinct from old.audio_ruta) then
    insert into fbe_privado.storage_por_borrar (ruta, bucket) values (old.audio_ruta, 'apuntes') on conflict do nothing;
  end if;
  return null;
end $$;
drop trigger if exists novedad_audio_fuera on public.novedades;
create trigger novedad_audio_fuera after update of audio_ruta or delete on public.novedades
  for each row execute function public.novedad_audio_fuera();

-- ---------------------------------------------------------------------
-- 4. El dominio del equipo (para el coach: solo cuentas)
-- ---------------------------------------------------------------------
create or replace function public.apuntes_dominio_equipo()
returns table (apunte text, atletas integer, caja_media numeric, dominan integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Solo el coach' using errcode = '42501'; end if;
  return query
    select v.apunte, count(*)::integer, round(avg(v.caja), 2), (count(*) filter (where v.caja >= 3))::integer
    from public.apuntes_vistos v join public.atletas a on a.id = v.atleta_id and a.estado <> 'baja'
    group by v.apunte
    order by count(*) desc, v.apunte
    limit 2000;
end $$;
-- Quién participa cada semana (las seis últimas): cuántos atletas han hecho algo y cuántos puntos suman, sin nombres
create or replace function public.apuntes_participacion()
returns table (semana date, atletas integer, puntos integer, activos integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_lunes date := (now() at time zone 'Europe/Madrid')::date - (extract(isodow from (now() at time zone 'Europe/Madrid')::date)::integer - 1);
begin
  if not public.es_coach() then raise exception 'Solo el coach' using errcode = '42501'; end if;
  return query
    select g.l::date, coalesce((select count(*) from public.apuntes_semanas s join public.atletas a on a.id = s.atleta_id and a.estado <> 'baja' where s.semana = g.l::date and (s.puntos > 0 or s.apuntes > 0)), 0)::integer,
           coalesce((select sum(s.puntos) from public.apuntes_semanas s join public.atletas a on a.id = s.atleta_id and a.estado <> 'baja' where s.semana = g.l::date), 0)::integer,
           (select count(*) from public.atletas a where a.estado = 'activo')::integer
    from generate_series(v_lunes - 35, v_lunes, interval '7 days') g(l)
    order by 1;
end $$;

-- ---------------------------------------------------------------------
-- 5. Permisos (como al final de 003 a 064)
-- ---------------------------------------------------------------------
-- (las tablas nuevas: el atleta lee lo suyo y puede borrar sus semanas; lo demás, solo con las funciones)
revoke all on public.apuntes_semanas, public.apuntes_duelos from public, anon, authenticated;
grant select, delete on public.apuntes_semanas to authenticated;
grant select on public.apuntes_duelos to authenticated;
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb), public.salud_recibir(text, jsonb), public.calendario_de(text) from public, anon, authenticated;
revoke execute on function public.sesion_video_proteger(), public.guia_tocar(), public.novedad_tocar() from public, anon, authenticated;
revoke execute on function public.crear_recordatorios_apuntes(timestamptz) from public, anon, authenticated;
revoke execute on function public.novedad_audio_fuera() from public, anon, authenticated;
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

insert into public.fbe_migraciones (numero) values (65)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
