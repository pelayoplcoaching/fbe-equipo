-- =====================================================================
-- FBE Atletas: enviar las notificaciones cada minuto (Supabase Cron)
-- No es una migración: se ejecuta UNA vez en el SQL Editor, después de desplegar la función
-- «enviar-notificaciones», ponerle sus secretos y guardar en Vault (Integrations → Vault → Add new secret):
--   fbe_notificaciones_url     https://TU_REFERENCIA.supabase.co/functions/v1/enviar-notificaciones
--   fbe_notificaciones_secreto el mismo AVISOS_SECRETO que tienen los secretos de la función
-- (en Vault van cifrados y no quedan en el historial del SQL Editor ni en el texto de la tarea).
--
-- Se puede repetir. Para pararlo: select cron.unschedule('fbe-notificaciones');
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if (select count(*) from vault.secrets where name in ('fbe_notificaciones_url', 'fbe_notificaciones_secreto')) < 2 then
    raise exception 'Faltan los secretos de Vault: fbe_notificaciones_url y fbe_notificaciones_secreto (Integrations → Vault → Add new secret)';
  end if;
  if (select decrypted_secret from vault.decrypted_secrets where name = 'fbe_notificaciones_url') !~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/enviar-notificaciones$' then
    raise exception 'fbe_notificaciones_url debe ser https://TU_REFERENCIA.supabase.co/functions/v1/enviar-notificaciones';
  end if;
end $$;

-- Cada minuto (si ya existía, se actualiza). La región, la de la base (Frankfurt), para que todo se quede en la UE.
select cron.schedule('fbe-notificaciones', '* * * * *', $tarea$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'fbe_notificaciones_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-region', 'eu-central-1',
      'x-fbe-secreto', (select decrypted_secret from vault.decrypted_secrets where name = 'fbe_notificaciones_secreto')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
$tarea$);

-- Para comprobar que va: las últimas ejecuciones y lo que respondió la función
-- select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
-- select status_code, content from net._http_response order by created desc limit 5;
