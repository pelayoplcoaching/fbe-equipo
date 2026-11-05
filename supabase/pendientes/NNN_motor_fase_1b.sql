-- =====================================================================
-- FBE Equipo, migración NNN (BORRADOR, sin numerar): fase 1b del motor «Programar según FBE»
-- (reglas por atleta y propuestas guardadas en la semana)
--
-- PARA INTEGRARLA (lo hace la conversación principal, que es la que numera):
--   1. Mueve este archivo a supabase/migraciones/ con el número que toque (NNN_motor_fase_1b.sql).
--   2. Sustituye NNN por ese número y ANTERIOR por el de la migración previa en los tres sitios marcados.
--   3. Regenera supabase/instalar.sql (node scripts/instalador.mjs) y añade las columnas a test/entorno-supabase.sql
--      si las tablas atletas y semanas se definen allí.
--   4. Añade `reglas_motor: null` a los valores de partida de `atletas` y `propuesta_motor: null` a los de `semanas`
--      en web/src/datos/backend-memoria.js (la demo ya funciona sin ello, pero así las filas nacen completas).
--   5. Al copiar una semana (api.prepararSemanas y similares) NO hay que copiar `propuesta_motor`: es de esa semana.
--   Mientras esta carpeta exista, nada la lee: scripts/instalador.mjs solo mira supabase/migraciones/.
--
-- Qué hace, 1: una columna más en la ficha del atleta, `reglas_motor` (jsonb), donde el coach guarda las reglas propias
-- de ese atleta para el motor: su perfil, hasta qué RPE suma repeticiones, sus rangos de repeticiones por tipo de
-- ejercicio y las reglas de cada ejercicio suyo (cómo progresa, rango, salto de carga y RPE). La forma y la limpieza
-- están en web/src/logica/motor/guardadas.js; la app nunca se fía de lo guardado: al leerlo descarta lo que no entiende.
-- Sin valor (null), el atleta va con las reglas de partida de su nivel, como hasta ahora.
-- Solo el coach la escribe (la tabla atletas no tiene política de escritura para el atleta, que solo lee su ficha).
-- No lleva datos de salud.
--
-- Qué hace, 2: una columna más en la semana, `propuesta_motor` (jsonb), donde queda apuntado, cada vez que el coach
-- aplica una propuesta del motor en esa semana, qué se propuso en cada ejercicio y qué hizo él con ello (aplicada,
-- con otra opción, no aplicada). Sirve para medir el acuerdo real. La forma está en web/src/logica/motor/registro.js.
-- El atleta puede leer la fila de sus semanas publicadas, así que aquí NO van motivos, ni señales de descarga, ni nada
-- del check-in o de las molestias: solo series, repeticiones y kilos propuestos y la decisión. La app no lo enseña
-- al atleta. La escribe solo el coach (el atleta no tiene política de escritura en semanas).
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a ANTERIOR (o con instalar.sql en una
-- base nueva). Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > NNN then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la NNN desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > NNN;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = ANTERIOR) then  -- (2) la migración previa
    raise exception 'Antes de la NNN hace falta la ANTERIOR: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
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

-- ---------------------------------------------------------------------
-- 2. Lo que propuso el motor y lo que se aplicó, en la semana
-- ---------------------------------------------------------------------
alter table public.semanas add column if not exists propuesta_motor jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.semanas'::regclass and conname = 'semanas_propuesta_motor_objeto') then
    alter table public.semanas add constraint semanas_propuesta_motor_objeto
      check (propuesta_motor is null or (jsonb_typeof(propuesta_motor) = 'object' and pg_column_size(propuesta_motor) <= 65536));
  end if;
end $$;
comment on column public.semanas.propuesta_motor is
  'Última propuesta del motor «Programar según FBE» aplicada en esta semana: { v, en, base, tipo, filas }. Sin motivos ni datos de salud. La escribe el coach.';

insert into public.fbe_migraciones (numero) values (NNN)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
