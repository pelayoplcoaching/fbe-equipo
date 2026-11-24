-- =====================================================================
-- FBE Equipo, migración 089: la carrera, con su ficha de salud y la mañana siguiente
--
-- Por qué: la revisión de las reglas de carrera que hizo un entrenador experto (doc del proyecto
-- «claude/carrera-revision-experto-respuesta.md»; Pelayo: «me fío de tu criterio, modifica lo que consideres»):
--   R44 La ficha de salud para correr, tres casillas que marca el coach:
--       (a) enfermedad cardiovascular, metabólica o renal conocida, o síntomas de alarma, y la fecha del visto bueno
--           médico: sin él, nada de test de 30 minutos, de Z5 ni de carreras (Riebe 2015, ACSM);
--       (b) un fármaco que cambia el pulso (betabloqueantes, verapamilo, diltiazem, ivabradina, digoxina, amiodarona) y la
--           fecha del último cambio de dosis: sus zonas, por esfuerzo y el test del habla, no por el pulso;
--       (c) más de 60 años o vuelve de una lesión: el plan, más prudente (más semanas, descarga cada 3, sin segunda calidad
--           y 48 horas después de la pierna pesada antes de la calidad).
--   R45 La mañana siguiente: tras una salida con dolor de 3/10 o más, o tras calidad, tirada larga o carrera, el atleta
--       contesta por la mañana: su dolor de 0 a 10, si está mejor, igual o peor que antes de salir, dónde y, si es en la
--       pierna, si le duele en un punto del hueso y al saltar a la pata coja (Silbernagel 2007, Warden 2021).
-- Son datos de salud: sin el consentimiento de salud del atleta, la base no los guarda, los escriba quien los escriba
-- (como la FC y el dolor de lo que corre, 056).
--
--   * carrera_atleta: salud_riesgo, salud_visto_bueno, farmaco_pulso, farmaco_cambio y prudente. Las escribe el coach
--     (como el resto de la ficha de carrera) y el atleta las ve.
--   * carrera_mananas (nueva): una fila por atleta y mañana. La escribe el propio atleta y la ve su coach; va en su
--     descarga de datos y se borra con su ficha.
--   * Cambia la política: versión 2026-12.39 («La carrera, con tu salud»).
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 088 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 89 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 089 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 89;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 88) then  -- (2) la anterior
    raise exception 'Falta la migración 088 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. La ficha de salud para correr (R44), en lo de carrera de cada atleta
-- ---------------------------------------------------------------------
alter table public.carrera_atleta add column if not exists salud_riesgo boolean;       -- (a) enfermedad o síntomas
alter table public.carrera_atleta add column if not exists salud_visto_bueno date;     -- (a) el visto bueno médico
alter table public.carrera_atleta add column if not exists farmaco_pulso boolean;      -- (b) un fármaco que cambia el pulso
alter table public.carrera_atleta add column if not exists farmaco_cambio date;        -- (b) el último cambio de dosis
alter table public.carrera_atleta add column if not exists prudente boolean;           -- (c) más de 60 o vuelve de una lesión

alter table public.carrera_atleta drop constraint if exists carrera_atleta_salud_fechas;
alter table public.carrera_atleta add constraint carrera_atleta_salud_fechas check (
  (salud_visto_bueno is null or salud_visto_bueno between date '2000-01-01' and date '2100-01-01')
  and (farmaco_cambio is null or farmaco_cambio between date '2000-01-01' and date '2100-01-01'));

-- Son datos de salud: sin el consentimiento del atleta, no se guardan (se quitan), los escriba quien los escriba
create or replace function public.carrera_atleta_salud() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.salud_riesgo is not null or new.salud_visto_bueno is not null or new.farmaco_pulso is not null
          or new.farmaco_cambio is not null or new.prudente is not null)
     and not public.consentimiento_salud_de_atleta(new.atleta_id) then
    new.salud_riesgo := null;
    new.salud_visto_bueno := null;
    new.farmaco_pulso := null;
    new.farmaco_cambio := null;
    new.prudente := null;
  end if;
  return new;
end $$;
drop trigger if exists carrera_atleta_salud on public.carrera_atleta;
create trigger carrera_atleta_salud before insert or update on public.carrera_atleta
  for each row execute function public.carrera_atleta_salud();

-- ---------------------------------------------------------------------
-- 2. La mañana siguiente (R45)
-- ---------------------------------------------------------------------
create table if not exists public.carrera_mananas (
  id          uuid primary key default gen_random_uuid(),
  atleta_id   uuid not null references public.atletas(id) on delete cascade,
  fecha       date not null,                                             -- la mañana
  sesion_id   uuid references public.sesiones(id) on delete set null,    -- la salida del día de antes
  dolor       smallint not null check (dolor between 0 and 10),
  como        text not null check (como in ('mejor', 'igual', 'peor')),  -- frente a antes de salir
  donde       text check (length(donde) between 1 and 40),
  hueso       boolean,                                                   -- en un punto del hueso
  salto       boolean,                                                   -- duele al saltar a la pata coja
  creado_en   timestamptz not null default now(),
  unique (atleta_id, fecha)
);
create index if not exists carrera_mananas_atleta on public.carrera_mananas (atleta_id, fecha desc);

-- Nada en el futuro (con un día de margen por las zonas horarias), ni de hace más de una semana; la salida, suya
create or replace function public.carrera_manana_comprobar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.fecha > (now() at time zone 'Europe/Madrid')::date + 1 or new.fecha < (now() at time zone 'Europe/Madrid')::date - 7 then
      raise exception 'La mañana siguiente se apunta esa semana' using errcode = '22023';
    end if;
    if new.sesion_id is not null and public.atleta_de_sesion(new.sesion_id) is distinct from new.atleta_id then
      raise exception 'Esa sesión no es suya' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists carrera_mananas_comprobar on public.carrera_mananas;
create trigger carrera_mananas_comprobar before insert or update on public.carrera_mananas
  for each row execute function public.carrera_manana_comprobar();

-- Quién: el coach la ve (y la puede borrar); el atleta, la suya, y solo con su consentimiento de salud
alter table public.carrera_mananas enable row level security;
revoke all on public.carrera_mananas from public, anon, authenticated;
grant select, insert, update, delete on public.carrera_mananas to authenticated;
drop policy if exists coach_ver on public.carrera_mananas;
create policy coach_ver on public.carrera_mananas for select to authenticated using (public.es_coach());
drop policy if exists coach_borrar on public.carrera_mananas;
create policy coach_borrar on public.carrera_mananas for delete to authenticated using (public.es_coach());
drop policy if exists atleta_ver on public.carrera_mananas;
create policy atleta_ver on public.carrera_mananas for select to authenticated using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_poner on public.carrera_mananas;
create policy atleta_poner on public.carrera_mananas for insert to authenticated
  with check (atleta_id = public.mi_atleta_id() and public.tiene_consentimiento_salud());
drop policy if exists atleta_cambiar on public.carrera_mananas;
create policy atleta_cambiar on public.carrera_mananas for update to authenticated
  using (atleta_id = public.mi_atleta_id()) with check (atleta_id = public.mi_atleta_id() and public.tiene_consentimiento_salud());
drop policy if exists atleta_borrar on public.carrera_mananas;
create policy atleta_borrar on public.carrera_mananas for delete to authenticated using (atleta_id = public.mi_atleta_id());

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 088)
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
-- (089) las de dos triggers: nadie las llama
revoke execute on function public.carrera_atleta_salud(), public.carrera_manana_comprobar() from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;
-- (revisión de la 072) la comprobación de las columnas de música la usa una restricción: el servidor (service_role) también tiene que poder llamarla
grant execute on function fbe_privado.musica_url_valida(text) to service_role;

insert into public.fbe_migraciones (numero) values (89)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
