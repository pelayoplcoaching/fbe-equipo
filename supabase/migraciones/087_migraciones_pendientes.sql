-- =====================================================================
-- FBE Equipo, migración 087: el aviso de migraciones pendientes
--
-- Por qué: para que la app pueda avisar en Cuenta de que a la base le falta alguna migración (hasta ahora solo se sabía
-- cuando algo nuevo no funcionaba), una función que dice por cuál va. fbe_migraciones sigue cerrada para todos.
--
--   * migracion_actual(): el número de la última migración ejecutada. Solo el coach; a un atleta le da un error.
--   * No crea tablas ni cambia quién ve qué: no cambia la política.
--   (La copia completa no cambia aquí: las tablas tuyas que faltaban ya las pide la app con lo que puedes leer; el rincón
--   de ánimo de cada atleta no va en ella, porque solo lo ve él.)
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 086 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 87 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 087 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 87;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 86) then  -- (2) la anterior
    raise exception 'Falta la migración 086 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Por qué migración va la base (para el aviso de Cuenta)
-- ---------------------------------------------------------------------
create or replace function public.migracion_actual() returns smallint
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  return (select max(numero) from public.fbe_migraciones);
end $$;
comment on function public.migracion_actual() is 'El número de la última migración ejecutada, para que Cuenta avise si falta alguna (087). Solo el coach.';

-- ---------------------------------------------------------------------
-- 2. Permisos (como al final de 003 a 086)
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

insert into public.fbe_migraciones (numero) values (87)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
