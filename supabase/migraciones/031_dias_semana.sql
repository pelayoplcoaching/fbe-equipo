-- =====================================================================
-- FBE Equipo, migración 031 (v0.53): días de entreno por semana
-- Hay atletas que llevan microciclos que no caben en una semana natural: cada «semana» del programa trae 4 sesiones,
-- pero entrenan 3 días por semana. Con atletas.dias_semana el coach les pone un objetivo semanal (de 1 a 7):
--   · null (de entrada, «Automático»): todo como hasta ahora, cada semana programada con sus sesiones.
--   · De 1 a 7: la constancia, la racha, los anillos, los logros y el cumplimiento se cuentan en la app por semanas de
--     lunes a domingo con ese objetivo (las cuentas las hace la app; la base solo guarda el número).
-- Lo cambia solo el coach, en la ficha del atleta → Datos. El atleta lo lee en su ficha (como hasta ahora: solo puede
-- leerla; no tiene política para cambiar nada de public.atletas). La comunidad (ranking, retos y rachas) no cambia.
-- Se ejecuta en el SQL Editor después de la 030 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 31 then
    raise exception 'Esta base ya tiene la migración %: repetir la 031 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 31;» y, después de ella, todas las siguientes en orden, todo en la misma consulta del SQL Editor (una sola transacción).';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 30) then
    raise exception 'Antes de la 031 hace falta la 030: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. El objetivo de días de entreno por semana (null = automático)
-- ---------------------------------------------------------------------
alter table public.atletas add column if not exists dias_semana smallint;
alter table public.atletas drop constraint if exists atletas_dias_semana_valido;
alter table public.atletas add constraint atletas_dias_semana_valido check (dias_semana is null or dias_semana between 1 and 7);

-- ---------------------------------------------------------------------
-- 2. Permisos: como el resto de la ficha. El coach la cambia con su política coach_todo; el atleta solo tiene atleta_ver
--    (ver su ficha) y ninguna de UPDATE en public.atletas, así que no puede cambiarse el objetivo (ni nada de su ficha).
--    Si algún día se le diera una política para cambiar algo de su ficha, esta columna tendría que quedarse fuera.
-- ---------------------------------------------------------------------

-- Permisos (como al final de 003 a 030)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (31)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
