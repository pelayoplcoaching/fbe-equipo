-- =====================================================================
-- FBE Equipo, migración 070: Que le acompañe más allá de la app (personalización, tercera ronda)
--
-- Por qué:
--   * La voz del coach: cada mensaje automático puede llevar un audio suyo (hasta 2 minutos). Va a un bucket privado
--     («coach-voz»): lo sube el coach y lo oyen sus atletas mientras ese mensaje lo lleve. Al quitarlo o cambiarlo, el
--     archivo va a la cola de Storage.
--   * Un momento más para los mensajes: 'bienvenida' (su primer mes).
--   * Compañero afín: quien quiera (y salga en el ranking) marca «Busco compañero» y ve a los demás que lo buscan, con
--     su franja y sus días habituales (sacados de cuándo apunta sus series), para invitarles como compañeros de racha.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 069 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 70 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 070 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 70;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 69) then  -- (2) la anterior
    raise exception 'Falta la migración 069 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. La voz del coach (y el momento de bienvenida)
-- ---------------------------------------------------------------------
alter table public.mensajes_coach add column if not exists audio_ruta text;
alter table public.mensajes_coach add column if not exists audio_segundos smallint;
alter table public.mensajes_coach drop constraint if exists mensajes_coach_audio_valido;
alter table public.mensajes_coach add constraint mensajes_coach_audio_valido check (
  (audio_ruta is null and audio_segundos is null)
  or coalesce(audio_ruta ~ '^voz/[0-9a-f-]{36}\.(webm|ogg|m4a|mp4|mp3|aac|wav)$' and audio_segundos between 1 and 120, false)
);
alter table public.mensajes_coach drop constraint if exists mensajes_coach_momento_check;
alter table public.mensajes_coach add constraint mensajes_coach_momento_check check (momento in ('record', 'bloque', 'racha', 'vuelta', 'cumple', 'aniversario', 'meta', 'primera_vez', 'viaje', 'bienvenida',
    'molestia_cuello', 'molestia_hombro', 'molestia_codo', 'molestia_muneca_mano', 'molestia_espalda_alta', 'molestia_zona_lumbar',
    'molestia_cadera', 'molestia_rodilla', 'molestia_tobillo_pie'));

create or replace function public.mensajes_coach() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() and public.mi_atleta_id() is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('momento', m.momento, 'texto', m.texto, 'audio_ruta', m.audio_ruta, 'audio_segundos', m.audio_segundos,
                     'actualizado_en', m.actualizado_en) order by m.momento) from public.mensajes_coach m), '[]'::jsonb);
end $$;
comment on function public.mensajes_coach() is 'Los mensajes del coach para cada momento (con su audio, si lo tiene). Los leen el coach y sus atletas.';

create or replace function public.mensaje_coach_guardar(p_momento text, p_texto text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  if p_momento is null or p_momento not in ('record', 'bloque', 'racha', 'vuelta', 'cumple', 'aniversario', 'meta', 'primera_vez', 'viaje', 'bienvenida',
    'molestia_cuello', 'molestia_hombro', 'molestia_codo', 'molestia_muneca_mano', 'molestia_espalda_alta', 'molestia_zona_lumbar',
    'molestia_cadera', 'molestia_rodilla', 'molestia_tobillo_pie') then raise exception 'Momento no válido'; end if;
  if v is null then delete from public.mensajes_coach where momento = p_momento; return; end if;
  if char_length(v) > 400 then raise exception 'Como mucho 400 caracteres'; end if;
  insert into public.mensajes_coach (momento, texto, actualizado_en) values (p_momento, v, now())
    on conflict (momento) do update set texto = excluded.texto, actualizado_en = now();
end $$;

-- El audio de un mensaje que ya tiene texto (null lo quita)
create or replace function public.mensaje_coach_audio(p_momento text, p_ruta text, p_segundos integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  if not exists (select 1 from public.mensajes_coach where momento = p_momento) then raise exception 'Escribe antes el mensaje' using errcode = '22023'; end if;
  if p_ruta is not null and (p_ruta !~ '^voz/[0-9a-f-]{36}\.(webm|ogg|m4a|mp4|mp3|aac|wav)$' or p_segundos is null or p_segundos not between 1 and 120) then
    raise exception 'Audio no válido (hasta 2 minutos)' using errcode = '22023';
  end if;
  update public.mensajes_coach set audio_ruta = p_ruta, audio_segundos = case when p_ruta is null then null else p_segundos end, actualizado_en = now()
    where momento = p_momento;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coach-voz', 'coach-voz', false, 3145728, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav', 'audio/x-wav'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- ¿Es el audio de un mensaje del coach? (para que lo oigan sus atletas)
create or replace function public.audio_de_coach(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mensajes_coach m where m.audio_ruta = p_ruta)
$$;
drop policy if exists fbe_coach_voz_ver on storage.objects;
create policy fbe_coach_voz_ver on storage.objects for select to authenticated
  using (bucket_id = 'coach-voz' and (public.es_coach() or (public.mi_atleta_id() is not null and public.audio_de_coach(name))));
drop policy if exists fbe_coach_voz_subir on storage.objects;
create policy fbe_coach_voz_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'coach-voz' and public.es_coach() and name ~ '^voz/[0-9a-f-]{36}\.(webm|ogg|m4a|mp4|mp3|aac|wav)$');
drop policy if exists fbe_coach_voz_borrar on storage.objects;
create policy fbe_coach_voz_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'coach-voz' and public.es_coach());
alter table fbe_privado.storage_por_borrar drop constraint if exists storage_por_borrar_bucket_check;
alter table fbe_privado.storage_por_borrar add constraint storage_por_borrar_bucket_check check (bucket in ('archivos', 'voz', 'comunidad', 'apuntes', 'coach-voz'));
create or replace function public.mensaje_coach_audio_fuera() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.audio_ruta is not null and (tg_op = 'DELETE' or new.audio_ruta is distinct from old.audio_ruta) then
    insert into fbe_privado.storage_por_borrar (ruta, bucket) values (old.audio_ruta, 'coach-voz') on conflict do nothing;
  end if;
  return null;
end $$;
drop trigger if exists mensaje_coach_audio_fuera on public.mensajes_coach;
create trigger mensaje_coach_audio_fuera after update of audio_ruta or delete on public.mensajes_coach
  for each row execute function public.mensaje_coach_audio_fuera();

-- ---------------------------------------------------------------------
-- 2. Compañero afín
-- ---------------------------------------------------------------------
alter table public.comunidad_miembros add column if not exists busca_companero boolean not null default false;

create or replace function public.comunidad_busco_companero(p_si boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_dentro record;
begin
  select * into v_dentro from fbe_privado.comunidad_dentro d where d.perfil_id = auth.uid();
  if v_dentro.perfil_id is null then raise exception 'Para buscar compañero tienes que estar en la comunidad' using errcode = '42501'; end if;
  if coalesce(p_si, false) and v_dentro.sin_ranking then raise exception 'Para buscar compañero tienes que salir en el ranking' using errcode = '22023'; end if;
  update public.comunidad_miembros set busca_companero = coalesce(p_si, false) where perfil_id = auth.uid();
  return coalesce(p_si, false);
end $$;

-- Los que también buscan (y salen en el ranking), con su franja y sus días habituales de las últimas 8 semanas (de
-- cuándo apuntan sus series). Solo para quien busca: busca, sin_ranking y la lista de afines (con «yo» en la suya)
create or replace function public.comunidad_afines() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_yo record; v_busca boolean;
begin
  select * into v_yo from fbe_privado.comunidad_dentro d where d.perfil_id = auth.uid();
  if v_yo.perfil_id is null then return null; end if;
  select busca_companero into v_busca from public.comunidad_miembros where perfil_id = auth.uid();
  return jsonb_build_object('busca', coalesce(v_busca, false), 'sin_ranking', v_yo.sin_ranking, 'afines', case when not coalesce(v_busca, false) or v_yo.sin_ranking then '[]'::jsonb else coalesce((
    with habitos as (
      select d.perfil_id, d.nombre,
        (select mode() within group (order by case when h < 12 then 'manana' when h < 16 then 'mediodia' when h < 21 then 'tarde' else 'noche' end)
           from (select extract(hour from s.registrada_en at time zone 'Europe/Madrid')::int as h from public.series s
                 where s.atleta_id = d.atleta_id and s.registrada_en > now() - interval '56 days') x where h >= 5) as franja,
        (select array_agg(y.dow order by y.n desc) from (select extract(isodow from s.registrada_en at time zone 'Europe/Madrid')::int as dow, count(distinct (s.registrada_en at time zone 'Europe/Madrid')::date) as n
           from public.series s where s.atleta_id = d.atleta_id and s.registrada_en > now() - interval '56 days' group by 1 order by 2 desc limit 3) y) as dias,
        (select count(distinct (s.registrada_en at time zone 'Europe/Madrid')::date) from public.series s where s.atleta_id = d.atleta_id and s.registrada_en > now() - interval '56 days') as dias_entreno
      from fbe_privado.comunidad_dentro d join public.comunidad_miembros m on m.perfil_id = d.perfil_id
      where m.busca_companero and not d.sin_ranking
    )
    select jsonb_agg(jsonb_build_object('perfil_id', h.perfil_id, 'nombre', h.nombre, 'franja', h.franja, 'dias', to_jsonb(h.dias), 'por_semana', round(h.dias_entreno / 8.0, 1),
             'yo', h.perfil_id = auth.uid()) order by h.nombre)
    from habitos h), '[]'::jsonb) end);
end $$;
comment on function public.comunidad_afines() is 'Quienes buscan compañero (y salen en el ranking), con su franja y días habituales. Solo para quien también busca.';

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 069)
-- ---------------------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb), public.salud_recibir(text, jsonb), public.calendario_de(text) from public, anon, authenticated;
revoke execute on function public.sesion_video_proteger(), public.guia_tocar(), public.novedad_tocar() from public, anon, authenticated;
revoke execute on function public.crear_recordatorios_apuntes(timestamptz) from public, anon, authenticated;
revoke execute on function public.novedad_audio_fuera() from public, anon, authenticated;
revoke execute on function public.mensaje_coach_audio_fuera() from public, anon, authenticated;
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

insert into public.fbe_migraciones (numero) values (70)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;

