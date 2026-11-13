-- =====================================================================
-- FBE Equipo, migración 068: las frases del coach, con su voz (sonido, tanda 3)
--
-- Por qué: el coach graba en la app unas frases cortas («¡Vamos!», «Última serie», «¡Récord!», «Buen trabajo»…) y suenan
-- con su voz en esos momentos de la sesión de cada atleta, en lugar de la voz del móvil. Nada de esto guarda datos de los
-- atletas: son audios del coach.
--
--   * voces_coach: una fila por frase (su clave, la ruta del audio y cuánto dura). Solo el coach la escribe, con
--     voces_coach_guardar() y voces_coach_quitar(); la leen él y los atletas (para descargar los audios).
--   * El bucket privado «voces-coach» (como mucho 2 MB por audio y solo audio): sube, cambia y borra el coach; descargan
--     el coach y los atletas con ficha.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 067 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 68 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 068 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 68;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 67) then  -- (2) la anterior
    raise exception 'Falta la migración 067 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Las frases
-- ---------------------------------------------------------------------
create table if not exists public.voces_coach (
  clave          text primary key,
  ruta           text not null unique,
  duracion_ms    integer not null default 0,
  actualizada_en timestamptz not null default now()
);
alter table public.voces_coach drop constraint if exists voces_coach_valida;
alter table public.voces_coach add constraint voces_coach_valida check (
  clave in ('vamos', 'ultima', 'record', 'fin_sesion', 'buen_trabajo', 'fin_descanso')
  and ruta ~ '^voces/[a-z_]{3,20}-[0-9a-f-]{8,40}\.(webm|ogg|m4a|mp4|mp3|aac)$'
  and duracion_ms between 0 and 8000
);

-- Guardar una frase (solo el coach): devuelve la ruta del audio que tenía antes (para borrarlo de Storage) o null
create or replace function public.voces_coach_guardar(p_clave text, p_ruta text, p_duracion_ms integer default 0) returns text
language plpgsql security definer set search_path = '' as $$
declare v_antes text;
begin
  if not public.es_coach() then raise exception 'Solo el coach graba sus frases' using errcode = '42501'; end if;
  select ruta into v_antes from public.voces_coach where clave = p_clave;
  insert into public.voces_coach (clave, ruta, duracion_ms) values (p_clave, p_ruta, least(greatest(coalesce(p_duracion_ms, 0), 0), 8000))
  on conflict (clave) do update set ruta = excluded.ruta, duracion_ms = excluded.duracion_ms, actualizada_en = now();
  return case when v_antes is distinct from p_ruta then v_antes end;
end $$;
-- Quitar una frase (solo el coach): devuelve la ruta de su audio (para borrarlo de Storage) o null
create or replace function public.voces_coach_quitar(p_clave text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_ruta text;
begin
  if not public.es_coach() then raise exception 'Solo el coach quita sus frases' using errcode = '42501'; end if;
  delete from public.voces_coach where clave = p_clave returning ruta into v_ruta;
  return v_ruta;
end $$;

alter table public.voces_coach enable row level security;
drop policy if exists ver on public.voces_coach;
create policy ver on public.voces_coach for select to authenticated using (public.es_coach() or public.mi_atleta_id() is not null);
revoke all on public.voces_coach from public, anon, authenticated;
grant select on public.voces_coach to authenticated;

-- ---------------------------------------------------------------------
-- 2. Los audios, en su bucket privado
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voces-coach', 'voces-coach', false, 2097152, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists fbe_voces_coach_ver on storage.objects;
create policy fbe_voces_coach_ver on storage.objects for select to authenticated
  using (bucket_id = 'voces-coach' and (public.es_coach() or public.mi_atleta_id() is not null));
drop policy if exists fbe_voces_coach_subir on storage.objects;
create policy fbe_voces_coach_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'voces-coach' and public.es_coach());
drop policy if exists fbe_voces_coach_cambiar on storage.objects;
create policy fbe_voces_coach_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'voces-coach' and public.es_coach()) with check (bucket_id = 'voces-coach' and public.es_coach());
drop policy if exists fbe_voces_coach_borrar on storage.objects;
create policy fbe_voces_coach_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'voces-coach' and public.es_coach());

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 067)
-- ---------------------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb), public.salud_recibir(text, jsonb), public.calendario_de(text) from public, anon, authenticated;
revoke execute on function public.sesion_video_proteger(), public.guia_tocar(), public.novedad_tocar() from public, anon, authenticated;
revoke execute on function public.crear_recordatorios_apuntes(timestamptz) from public, anon, authenticated;
revoke execute on function public.novedad_audio_fuera() from public, anon, authenticated;
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('reloj_estado', 'reloj_serie', 'reloj_saltar', 'reloj_elegir', 'reloj_terminar') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (68)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
