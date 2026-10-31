-- =====================================================================
-- FBE Equipo, migración 025 (v0.39): el fin del descanso avisa aunque la app no esté delante
-- En el iPhone, una app web en segundo plano (con Spotify o YouTube delante, o con la pantalla bloqueada) se
-- congela: el temporizador de descanso no puede sonar hasta que se vuelve a ella. Ahora, al empezar un descanso,
-- la app programa una notificación al móvil para cuando acabe («¡Vamos! Descanso terminado»); si la app sigue
-- delante y suena ella, la anula, y si se salta o se cierra el descanso, también. Solo una por cuenta (la del
-- descanso en marcha: cada uno nuevo, o +15 / −15, la cambia).
--   · public.programar_descanso(p_fin, p_despues) y public.cancelar_descanso(): las usa la app.
--   · fbe_privado.disparar_descansos(): cada 5 segundos (Supabase Cron), si hay alguna que ya toca, llama a la
--     función «enviar-notificaciones» como la tarea de cada minuto (con los mismos secretos de Vault). Si no hay
--     ninguna, no llama a nada. La tarea se programa sola si ya tienes pg_cron, pg_net y los secretos.
--   · Un tipo nuevo de notificación, «descanso», que se puede desactivar en Notificaciones.
-- Se ejecuta en el SQL Editor después de la 024 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 25 then
    raise exception 'Esta base ya tiene la migración %: repetir la 025 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 25;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 24) then
    raise exception 'Antes de la 025 hace falta la 024: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- 1. El tipo nuevo (la lista de la 014 más «descanso»; «not valid» como entonces)
alter table public.notificaciones drop constraint if exists notificaciones_validas;
alter table public.notificaciones add constraint notificaciones_validas check (
  tipo in ('respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario',
           'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido', 'prueba', 'descanso')
  and char_length(titulo) between 1 and 80
  and (cuerpo is null or char_length(cuerpo) <= 160)
  and url in ('#hoy', '#semana', '#checkin', '#progreso', '#perfil', '#atletas', '#revisar', '#cuenta', '#mensajes')
  and char_length(clave) between 1 and 100
  and estado in ('pendiente', 'enviando', 'enviada', 'caducada', 'fallida')
  and (canal is null or canal in ('push', 'email'))
  and intentos between 0 and 100
  and (error is null or char_length(error) <= 200)
) not valid;

alter table public.preferencias_notificaciones drop constraint if exists preferencias_notificaciones_validas;
alter table public.preferencias_notificaciones add constraint preferencias_notificaciones_validas check (
  desactivados <@ array['respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario',
                        'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido', 'descanso']::text[]
  and hora_manana between time '05:00' and time '12:00' and extract(second from hora_manana) = 0
  and hora_tarde between time '12:00' and time '23:30' and extract(second from hora_tarde) = 0
  and dia_checkin between 1 and 7
  and (silencio_desde is null) = (silencio_hasta is null)
  and (silencio_desde is null or (silencio_desde <> silencio_hasta
       and extract(second from silencio_desde) = 0 and extract(second from silencio_hasta) = 0))
);

-- 2. Programarla (o cambiarla) y anularla. Solo al móvil (por email no tiene sentido) y solo si esta cuenta
--    tiene alguno activado. Sale 1 s después del final: si la app está delante, suena ella y la anula antes.
--    Devuelve 'ok', 'sin_canal' (ningún móvil activado) o 'desactivado' (lo quitó en Notificaciones).
create or replace function public.programar_descanso(p_fin timestamptz, p_despues text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not fbe_privado.puede_recibir(v_uid) then
    raise exception 'Solo las cuentas vinculadas a una ficha (o la del coach) reciben notificaciones' using errcode = '42501';
  end if;
  if p_fin is null or p_fin < now() - interval '10 seconds' or p_fin > now() + interval '30 minutes' then
    raise exception 'El descanso tiene que acabar en los próximos 30 minutos' using errcode = '22023';
  end if;
  if exists (select 1 from public.preferencias_notificaciones where usuario_id = v_uid and 'descanso' = any (desactivados)) then
    delete from public.notificaciones where usuario_id = v_uid and clave = 'descanso' and estado = 'pendiente';
    return 'desactivado';
  end if;
  if not exists (select 1 from public.suscripciones_push where usuario_id = v_uid) then return 'sin_canal'; end if;
  insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, url, clave, enviar_desde, caduca_en)
  values (v_uid, 'descanso', '¡Vamos! Descanso terminado',
          case when nullif(btrim(coalesce(p_despues, '')), '') is not null then fbe_privado.linea('Ahora: ' || p_despues, 160) end,
          '#hoy', 'descanso', p_fin + interval '1 second', p_fin + interval '3 minutes')
  on conflict (usuario_id, clave) do update
    set tipo = excluded.tipo, titulo = excluded.titulo, cuerpo = excluded.cuerpo, url = excluded.url,
        creado_en = now(), enviar_desde = excluded.enviar_desde, caduca_en = excluded.caduca_en,
        estado = 'pendiente', canal = null, intentos = 0, tomada_en = null, enviada_en = null, error = null;
  return 'ok';
end $$;

create or replace function public.cancelar_descanso() returns void
language sql security definer set search_path = '' as $$
  delete from public.notificaciones where usuario_id = auth.uid() and clave = 'descanso' and estado = 'pendiente';
$$;

-- 3. El disparador rápido: si hay algún descanso que ya toca, llama a la función de envío (con los secretos
--    de Vault, como la tarea de cada minuto). Si no, nada (así no se llama a la función cada 5 segundos).
create or replace function fbe_privado.disparar_descansos() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secreto text;
begin
  if not exists (select 1 from public.notificaciones
                 where tipo = 'descanso' and estado = 'pendiente' and enviar_desde <= now() and caduca_en > now()) then
    return;
  end if;
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then return; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'fbe_notificaciones_url';
  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'fbe_notificaciones_secreto';
  if v_url is null or v_secreto is null then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-region', 'eu-central-1', 'x-fbe-secreto', v_secreto),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
end $$;

-- Cada 5 segundos, si ya están pg_cron, pg_net y los secretos (como tras notificaciones_programadas.sql). Si
-- aún no, la programa ese archivo cuando lo ejecutes.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net')
     and to_regclass('vault.decrypted_secrets') is not null then
    begin
      execute $q$select cron.schedule('fbe-descansos', '5 seconds', 'select fbe_privado.disparar_descansos()')$q$;
      raise notice 'FBE: avisos del fin del descanso programados (tarea fbe-descansos, cada 5 segundos).';
    exception when others then
      raise warning 'FBE: no se ha podido programar la tarea fbe-descansos (%). Ejecuta supabase/notificaciones_programadas.sql.', sqlerrm;
    end;
  else
    raise notice 'FBE: sin pg_cron, pg_net o Vault todavía: la tarea fbe-descansos la programa supabase/notificaciones_programadas.sql.';
  end if;
end $$;

-- Permisos (como al final de 003 a 024)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (25)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
