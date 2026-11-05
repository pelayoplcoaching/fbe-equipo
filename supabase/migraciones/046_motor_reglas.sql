-- =====================================================================
-- FBE Equipo, migración 046: reglas del motor «Programar según FBE» por atleta
--
-- Qué hace: una columna más en la ficha del atleta, `reglas_motor` (jsonb), donde el coach guarda las reglas propias
-- de ese atleta para el motor: su perfil, hasta qué RPE suma repeticiones, sus rangos de repeticiones por tipo de
-- ejercicio y las reglas de cada ejercicio suyo (cómo progresa, rango, salto de carga y RPE). La forma y la limpieza
-- están en web/src/logica/motor/guardadas.js; la app nunca se fía de lo guardado: al leerlo descarta lo que no entiende.
-- Sin valor (null), el atleta va con las reglas de partida de su nivel, como hasta ahora.
-- Solo el coach la escribe (la tabla atletas no tiene política de escritura para el atleta, que solo lee su ficha).
-- No lleva datos de salud.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 045 (o con instalar.sql en una
-- base nueva). Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 46 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 046 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 46;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 45) then  -- (2) la migración previa
    raise exception 'Antes de la 046 hace falta la 045: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Las reglas del motor, en la ficha del atleta
-- ---------------------------------------------------------------------
alter table public.atletas add column if not exists reglas_motor jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.atletas'::regclass and conname = 'atletas_reglas_motor_objeto') then
    -- Un objeto y de tamaño razonable (200 ejercicios con regla propia caben de sobra en 64 kB)
    alter table public.atletas add constraint atletas_reglas_motor_objeto
      check (reglas_motor is null or (jsonb_typeof(reglas_motor) = 'object' and pg_column_size(reglas_motor) <= 65536));
  end if;
end $$;
comment on column public.atletas.reglas_motor is
  'Reglas propias del atleta para el motor «Programar según FBE»: { v, perfil, atleta, porEjercicio }. Las escribe el coach; null = las de partida de su nivel.';

insert into public.fbe_migraciones (numero) values (46)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
