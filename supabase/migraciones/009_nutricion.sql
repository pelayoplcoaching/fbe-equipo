-- =====================================================================
-- FBE Atletas, migración 009 (v0.11): nutrición
-- 1. Planes de nutrición: los pone el coach para cada atleta, por versiones (cada cambio vale desde una
--    fecha y los anteriores se quedan como historial). Tres modos: «macros» (kcal, proteína, hidratos y
--    grasa), «kcal_proteina» (solo kcal y proteína) y «sin_contar» (pautas y un «¿has seguido el plan?»).
--    Si se quiere, los días de descanso llevan otras kcal (y otros hidratos y grasa).
-- 2. Registro diario: el atleta apunta los totales del día (de la app con la que cuente) o si ha seguido
--    el plan. Son datos de salud: hace falta su consentimiento, lo escriba quien lo escriba desde la app.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 008. Se puede repetir sin
-- romper nada: las restricciones tienen nombre y se vuelven a crear con la versión vigente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guardia: si la base ya tiene una migración posterior, esta no se repite (desharía lo que
-- cambiaron las siguientes). Al terminar, queda apuntada en fbe_migraciones.
-- ---------------------------------------------------------------------
create table if not exists public.fbe_migraciones (
  numero      smallint primary key,
  aplicada_en timestamptz not null default now()
);
alter table public.fbe_migraciones enable row level security;
revoke all on public.fbe_migraciones from public, anon, authenticated;
do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 9 then
    raise exception 'Esta base ya tiene la migración %: repetir la 009 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 9;» y, después de ella, todas las siguientes en orden.';
  end if;
  -- Y antes, la anterior: la 009 usa funciones de la 008 (sin ella, fallaría luego con errores raros)
  if not exists (select 1 from public.fbe_migraciones where numero = 8) then
    raise exception 'Antes de la 009 hace falta la 008: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 0. Texto con algo visible: no valen solo espacios (de cualquier tipo), saltos de línea, caracteres de
--    control, de formato o invisibles (de ancho cero, de dirección del texto, selectores de variante,
--    etiquetas…). Una sola regla para todos los textos que escribe la gente: avisos (006), hábitos (008)
--    y nutrición (abajo). Inmutable, para poder usarla en las restricciones.
-- ---------------------------------------------------------------------
create or replace function public.texto_visible(t text) returns boolean
language sql immutable strict set search_path = '' as $$
  select regexp_replace(t, E'[[:space:]\u0001-\u001f\u007f-\u009f\u00a0\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u1680\u2000-\u200f\u2028-\u202f\u205f-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff9-\ufffc\U0001d173-\U0001d17a\U000e0000-\U000e007f]', '', 'g') <> ''
$$;

alter table public.avisos drop constraint if exists avisos_texto_valido;
alter table public.avisos add constraint avisos_texto_valido
  check (char_length(texto) between 1 and 600 and public.texto_visible(texto));

alter table public.habitos drop constraint if exists habitos_valido;
alter table public.habitos add constraint habitos_valido check (
  char_length(nombre) between 1 and 60 and public.texto_visible(nombre)
  and tipo in ('numero', 'si_no')
  and sentido in ('al_menos', 'como_mucho')
  and dias_semana between 1 and 7
  and icono in ('pasos', 'proteina', 'agua', 'sueno', 'movilidad', 'verdura', 'libre')
  and orden between 0 and 99
  and (unidad is null or (char_length(unidad) between 1 and 12 and public.texto_visible(unidad)))
  and case tipo
        when 'numero' then objetivo is not null and objetivo > 0 and objetivo < 1000000
        else objetivo is null and unidad is null and sentido = 'al_menos'
      end
);

-- ---------------------------------------------------------------------
-- 1. Planes de nutrición
-- ---------------------------------------------------------------------
create table if not exists public.planes_nutricion (
  id                 uuid primary key default gen_random_uuid(),
  atleta_id          uuid not null references public.atletas(id) on delete cascade,
  desde              date not null,                   -- vale desde este día hasta el siguiente plan
  modo               text not null default 'macros',  -- macros · kcal_proteina · sin_contar
  fase               text not null default 'mantener',-- perder · mantener · ganar · recomposicion
  ritmo_pct          numeric(3,2),                    -- % del peso por semana (−1,50 a +1,00; negativo = bajar)
  kcal               smallint,                        -- días de entreno (o todos, si no hay de descanso)
  proteina_g         smallint,
  carbos_g           smallint,
  grasa_g            smallint,
  fibra_g            smallint,
  kcal_descanso      smallint,                        -- días de descanso, si son distintos
  carbos_descanso_g  smallint,
  grasa_descanso_g   smallint,
  pautas             text,                            -- lo que el atleta lee: comidas, raciones, cómo repartir
  motivo             text,                            -- por qué cambia («Ajuste: 3 semanas sin bajar»)
  creado_en          timestamptz not null default now(),
  unique (atleta_id, desde)
);
-- (la clave única (atleta_id, desde) ya sirve de índice)
drop index if exists public.planes_nutricion_atleta_idx;

-- Cifras razonables y coherentes con el modo: en «macros», kcal y los tres macros (y, si hay día de
-- descanso, sus kcal, hidratos y grasa juntos), con las kcal cuadrando con 4/4/9 kcal por gramo (±5 %, como
-- poco ±50); en «kcal_proteina», solo kcal y proteína (y las kcal dan para esa proteína); «sin_contar», sin
-- cifras. Bajar va con ritmo negativo, ganar con positivo y mantener con 0 (o sin ritmo). Los textos, con
-- algo visible.
alter table public.planes_nutricion drop constraint if exists planes_nutricion_valido;
alter table public.planes_nutricion add constraint planes_nutricion_valido check (
  modo in ('macros', 'kcal_proteina', 'sin_contar')
  and fase in ('perder', 'mantener', 'ganar', 'recomposicion')
  and desde >= date '2020-01-01' and desde < date '2100-01-01'
  and (ritmo_pct is null or ritmo_pct between -1.5 and 1)
  and (fase <> 'perder' or ritmo_pct is null or ritmo_pct < 0)
  and (fase <> 'ganar' or ritmo_pct is null or ritmo_pct > 0)
  and (fase <> 'mantener' or ritmo_pct is null or ritmo_pct = 0)
  and (kcal is null or kcal between 800 and 8000)
  and (kcal_descanso is null or kcal_descanso between 800 and 8000)
  and (proteina_g is null or proteina_g between 20 and 600)
  and (carbos_g is null or carbos_g between 0 and 1500)
  and (carbos_descanso_g is null or carbos_descanso_g between 0 and 1500)
  and (grasa_g is null or grasa_g between 10 and 500)
  and (grasa_descanso_g is null or grasa_descanso_g between 10 and 500)
  and (fibra_g is null or fibra_g between 5 and 150)
  and (pautas is null or (char_length(pautas) <= 4000 and public.texto_visible(pautas)))
  and (motivo is null or (char_length(motivo) <= 280 and public.texto_visible(motivo)))
  and case modo
        when 'macros' then kcal is not null and proteina_g is not null and carbos_g is not null and grasa_g is not null
             and (kcal_descanso is null) = (carbos_descanso_g is null)
             and (kcal_descanso is null) = (grasa_descanso_g is null)
             and abs(kcal - (4 * proteina_g + 4 * carbos_g + 9 * grasa_g)) <= greatest(50, kcal * 0.05)
             and (kcal_descanso is null
                  or abs(kcal_descanso - (4 * proteina_g + 4 * carbos_descanso_g + 9 * grasa_descanso_g)) <= greatest(50, kcal_descanso * 0.05))
        when 'kcal_proteina' then kcal is not null and proteina_g is not null
             and kcal >= 4 * proteina_g and (kcal_descanso is null or kcal_descanso >= 4 * proteina_g)
             and carbos_g is null and grasa_g is null and carbos_descanso_g is null and grasa_descanso_g is null
        else kcal is null and kcal_descanso is null and proteina_g is null and carbos_g is null and grasa_g is null
             and carbos_descanso_g is null and grasa_descanso_g is null and fibra_g is null
      end
);

-- Un plan no cambia de atleta (su historial se quedaría con el otro): se crea uno nuevo
create or replace function public.proteger_plan_nutricion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.atleta_id is distinct from old.atleta_id then
    raise exception 'Un plan de nutrición no se puede pasar a otro atleta: créale uno nuevo' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists planes_nutricion_proteger on public.planes_nutricion;
create trigger planes_nutricion_proteger before update on public.planes_nutricion
  for each row execute function public.proteger_plan_nutricion();

alter table public.planes_nutricion enable row level security;
drop policy if exists coach_todo on public.planes_nutricion;
create policy coach_todo on public.planes_nutricion for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
-- El atleta ve los suyos (también los anteriores y el que empieza el lunes); no los cambia
drop policy if exists atleta_ver on public.planes_nutricion;
create policy atleta_ver on public.planes_nutricion for select to authenticated
  using (atleta_id = public.mi_atleta_id());

-- ---------------------------------------------------------------------
-- 2. Registro diario
-- ---------------------------------------------------------------------
create table if not exists public.registros_nutricion (
  id              uuid primary key default gen_random_uuid(),
  atleta_id       uuid not null references public.atletas(id) on delete cascade,
  fecha           date not null,
  kcal            smallint,
  proteina_g      numeric(5,1),
  carbos_g        numeric(5,1),
  grasa_g         numeric(5,1),
  fibra_g         numeric(4,1),
  completo        boolean not null default true,  -- false: se dejó algo sin apuntar (no cuenta para el gasto)
  cumplido        smallint,                       -- sin contar: 2 sí · 1 casi · 0 no
  nota            text,
  actualizado_en  timestamptz not null default now(),
  unique (atleta_id, fecha)
);
drop index if exists public.registros_nutricion_atleta_idx;

alter table public.registros_nutricion drop constraint if exists registros_nutricion_valido;
alter table public.registros_nutricion add constraint registros_nutricion_valido check (
  fecha >= date '2020-01-01' and fecha < date '2100-01-01'
  and (kcal is null or kcal between 0 and 15000)
  and (proteina_g is null or proteina_g between 0 and 1500)
  and (carbos_g is null or carbos_g between 0 and 2500)
  and (grasa_g is null or grasa_g between 0 and 1000)
  and (fibra_g is null or fibra_g between 0 and 300)
  and (cumplido is null or cumplido in (0, 1, 2))
  and (nota is null or (char_length(nota) <= 280 and public.texto_visible(nota)))
  and (kcal is not null or proteina_g is not null or cumplido is not null)  -- un registro dice algo
);

-- Datos de salud, como los hábitos (008): con el consentimiento del atleta, lo escriba quien lo escriba desde
-- la app (también el coach), y el atleta nada en días que no han llegado (un día de margen por las zonas
-- horarias). Un registro no cambia de atleta. Sin «security definer» a propósito: el consentimiento se
-- consulta con consentimiento_salud_de_atleta (008), que a quien no es el propio atleta ni el coach le dice
-- que no, así que un atleta ajeno, uno inexistente y el propio sin consentimiento dan el mismo error.
create or replace function public.registro_nutricion_preparar()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.atleta_id is distinct from old.atleta_id then
    raise exception 'Un registro de nutrición no se puede pasar a otro atleta' using errcode = '42501';
  end if;
  new.actualizado_en := now();
  if current_user in ('authenticated', 'anon') then
    if not public.consentimiento_salud_de_atleta(new.atleta_id) then
      raise exception 'Para apuntar la nutrición hace falta el consentimiento de datos de salud del atleta' using errcode = '42501';
    end if;
    if not public.es_coach() and new.fecha > (now() at time zone 'Europe/Madrid')::date + 1 then
      raise exception 'No se puede apuntar un día que aún no ha llegado' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
-- «aa» para que vaya antes que el de la baja (los BEFORE van por orden alfabético)
drop trigger if exists registros_nutricion_aa_preparar on public.registros_nutricion;
create trigger registros_nutricion_aa_preparar before insert or update on public.registros_nutricion
  for each row execute function public.registro_nutricion_preparar();
drop trigger if exists registros_nutricion_exigir_alta on public.registros_nutricion;
create trigger registros_nutricion_exigir_alta before insert or update on public.registros_nutricion
  for each row execute function public.exigir_alta();

alter table public.registros_nutricion enable row level security;
drop policy if exists coach_todo on public.registros_nutricion;
create policy coach_todo on public.registros_nutricion for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.registros_nutricion;
create policy atleta_ver on public.registros_nutricion for select to authenticated
  using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_crear on public.registros_nutricion;
create policy atleta_crear on public.registros_nutricion for insert to authenticated
  with check (atleta_id = public.mi_atleta_id() and public.tiene_consentimiento_salud());
drop policy if exists atleta_editar on public.registros_nutricion;
create policy atleta_editar on public.registros_nutricion for update to authenticated
  using (atleta_id = public.mi_atleta_id())
  with check (atleta_id = public.mi_atleta_id() and public.tiene_consentimiento_salud());
drop policy if exists atleta_borrar on public.registros_nutricion;
create policy atleta_borrar on public.registros_nutricion for delete to authenticated
  using (atleta_id = public.mi_atleta_id());

-- ---------------------------------------------------------------------
-- Permisos (como al final de 003 a 008)
-- ---------------------------------------------------------------------
revoke all on public.planes_nutricion, public.registros_nutricion from anon;
grant select, insert, update, delete on public.planes_nutricion, public.registros_nutricion to authenticated;
-- Supabase da por defecto a las cuentas de la app también TRUNCATE (que no mira los permisos por fila),
-- REFERENCES y TRIGGER en cada tabla nueva. La app no los usa: fuera, en todas y en las que vengan.
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Apuntada: desde aquí, la base no deja repetir por error las migraciones anteriores a esta
insert into public.fbe_migraciones (numero) values (9)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
