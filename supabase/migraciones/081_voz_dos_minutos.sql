-- =====================================================================
-- FBE Equipo, migración 081: las notas de voz del chat, de hasta DOS minutos (antes, uno)
--
-- Por qué: un minuto se queda corto para explicar una sensación o una duda (lo pide el coach). La app las graba a poco
-- peso (32 kbps), así que dos minutos caben de sobra en los 3 MB de siempre: el tope de peso y el bucket «voz» no cambian.
--
--   * archivos_audio_valido: una nota de voz dura de 1 a 121 segundos (los dos minutos y un poco de margen por el
--     redondeo). Lo demás, igual que en la 034 (los formatos, hasta 3 MB, su ruta audio-…, sin nombre ni miniatura).
--   * voz_limite_seg(): lo que la app pregunta para saber si ya puede grabar dos minutos (sin esta migración no existe y
--     la app se queda en el minuto de siempre). No lee ni cambia ningún dato.
--   * No se guarda ningún dato nuevo: no cambia la política de privacidad.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 080 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 81 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 081 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 81;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 80) then  -- (2) la anterior
    raise exception 'Falta la migración 080 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Las notas de voz, de 1 a 121 segundos
-- ---------------------------------------------------------------------
alter table public.archivos drop constraint if exists archivos_audio_valido;
alter table public.archivos add constraint archivos_audio_valido
  check (tipo <> 'audio' or (coalesce(mime in ('audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac'), false)
                              and coalesce(bytes between 1 and 3145728, false) and coalesce(duracion_seg between 1 and 121, false)
                              and ruta ~ '/audio-[A-Za-z0-9._-]+\.(webm|ogg|m4a|mp4|mp3|aac)$'
                              and nombre is null and poster_ruta is null and paginas is null));

-- Lo que pregunta la app: ¿cuánto puede durar una nota de voz en esta base?
create or replace function public.voz_limite_seg() returns integer
language sql immutable set search_path = '' as $$ select 120 $$;
comment on function public.voz_limite_seg() is 'Los segundos que puede durar una nota de voz del chat (081: dos minutos). La app la pregunta para saber si ya puede grabarlos.';

-- ---------------------------------------------------------------------
-- 2. Permisos (como al final de 003 a 080)
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
-- (073) la de la cola de las portadas es de un trigger: nadie la llama
revoke execute on function public.portada_fuera() from public, anon, authenticated;
-- (las del reloj, si están)
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('reloj_estado', 'reloj_serie', 'reloj_saltar', 'reloj_elegir', 'reloj_terminar') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
-- (079) la de un trigger: nadie la llama
revoke execute on function public.menu_comida_con_foto() from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;
-- (revisión de la 072) la comprobación de las columnas de música la usa una restricción: el servidor (service_role) también tiene que poder llamarla
grant execute on function fbe_privado.musica_url_valida(text) to service_role;

insert into public.fbe_migraciones (numero) values (81)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
