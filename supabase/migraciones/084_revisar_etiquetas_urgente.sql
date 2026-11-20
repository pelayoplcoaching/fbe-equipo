-- =====================================================================
-- FBE Equipo, migración 084: etiquetas propias en «Revisar» y un aviso al móvil cuando llega algo urgente
--
-- Por qué: el coach quiere marcar tarjetas con sus etiquetas («Para la llamada», «Esperando analítica») y filtrar por
-- ellas, igual en el móvil y en el ordenador; y enterarse al momento si un atleta marca una molestia fuerte.
--
--   * revisar_apartados.etiqueta: una etiqueta corta (hasta 30 caracteres) por tarjeta, de cada coach (083).
--   * Molestia fuerte (intensidad 3) en un check-in → una notificación al coach: «<nombre>: algo urgente en su
--     check-in», sin decir qué ni dónde (puede verse con el móvil bloqueado). Una por atleta y semana.
--   * No se guarda ningún dato nuevo de los atletas: no cambia la política de privacidad.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 083 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 84 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 084 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 84;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 83) then  -- (2) la anterior
    raise exception 'Falta la migración 083 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. La etiqueta de cada tarjeta
-- ---------------------------------------------------------------------
alter table public.revisar_apartados add column if not exists etiqueta text;
alter table public.revisar_apartados drop constraint if exists revisar_apartados_etiqueta;
alter table public.revisar_apartados add constraint revisar_apartados_etiqueta check (etiqueta is null or (char_length(etiqueta) between 1 and 30 and etiqueta !~ '[[:cntrl:]]'));
alter table public.revisar_apartados drop constraint if exists revisar_apartados_algo;
alter table public.revisar_apartados add constraint revisar_apartados_algo check (hasta is not null or fijada or etiqueta is not null);
comment on column public.revisar_apartados.etiqueta is 'Revisar (084): la etiqueta del coach para esa tarjeta.';

-- ---------------------------------------------------------------------
-- 2. Molestia fuerte en un check-in → aviso al coach (sin decir qué)
-- ---------------------------------------------------------------------
create or replace function fbe_privado.al_marcar_molestia_fuerte() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  v_nombre text;
begin
  if new.intensidad < 3 or (tg_op = 'UPDATE' and old.intensidad >= 3) then return null; end if;
  select coalesce(fbe_privado.nombre_corto(a.nombre), 'Un atleta') into v_nombre from public.atletas a where a.id = new.atleta_id;
  perform fbe_privado.notificar_seguro(p.id, 'checkin_recibido', v_nombre || ': algo urgente en su check-in',
    'Míralo en Revisar', '#revisar', 'urgente:' || new.atleta_id || ':' || new.semana_inicio)
  from public.perfiles p where p.rol = 'coach' and p.id is distinct from auth.uid();
  return null;
exception when others then
  raise warning 'FBE: aviso de molestia fuerte % no creado: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists molestias_zz_urgente on public.molestias;
create trigger molestias_zz_urgente after insert or update of intensidad on public.molestias
  for each row execute function fbe_privado.al_marcar_molestia_fuerte();

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 083)
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

insert into public.fbe_migraciones (numero) values (84)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
