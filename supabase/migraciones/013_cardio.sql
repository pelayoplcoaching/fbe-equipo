-- =====================================================================
-- FBE Equipo, migración 013 (v0.17): cardio de verdad
-- Una sesión (sobre todo las de tipo «cardio») puede llevar una pauta de cardio que escribe el coach
-- (modalidad, minutos u objetivo de kilómetros, esfuerzo objetivo y una nota) y el registro del atleta al
-- terminar (modalidad, minutos y kilómetros). La duración y el esfuerzo de la sesión siguen en duracion_min
-- y rpe_sesion, como en cualquier otra sesión.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 012 (o con instalar.sql en una
-- base nueva). Se puede repetir sin romper nada.
-- =====================================================================

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
  if v > 13 then
    raise exception 'Esta base ya tiene la migración %: repetir la 013 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 13;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 12) then
    raise exception 'Antes de la 013 hace falta la 012: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

alter table public.sesiones add column if not exists cardio jsonb;        -- la pauta (solo el coach)
alter table public.sesiones add column if not exists cardio_hecho jsonb;  -- lo hecho (el atleta)

-- Pauta: { "modalidad": "carrera", "minutos": 30, "km": 5, "esfuerzo": 6, "nota": "…" }
-- Modalidad obligatoria; minutos o km (al menos uno); esfuerzo (RPE objetivo) y nota, opcionales.
-- (Con una clave que falte, jsonb_typeof da null: por eso los coalesce, para que el resultado sea false y no null)
create or replace function public.cardio_valido(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object'
    and not exists (select 1 from jsonb_object_keys(j) k where k not in ('modalidad', 'minutos', 'km', 'esfuerzo', 'nota'))
    and coalesce(j ->> 'modalidad', '') in ('carrera', 'andar', 'bici', 'eliptica', 'remo', 'nadar', 'cuerda', 'otro')
    and (j ? 'minutos' or j ? 'km')
    and (not (j ? 'minutos') or (jsonb_typeof(j -> 'minutos') = 'number' and (j ->> 'minutos')::numeric = floor((j ->> 'minutos')::numeric)
                                 and (j ->> 'minutos')::numeric between 1 and 600))
    and (not (j ? 'km') or (jsonb_typeof(j -> 'km') = 'number' and (j ->> 'km')::numeric > 0 and (j ->> 'km')::numeric <= 200))
    and (not (j ? 'esfuerzo') or (jsonb_typeof(j -> 'esfuerzo') = 'number' and (j ->> 'esfuerzo')::numeric between 1 and 10))
    and (not (j ? 'nota') or (jsonb_typeof(j -> 'nota') = 'string' and length(j ->> 'nota') between 1 and 300))
$$;

-- Lo hecho: { "modalidad": "carrera", "minutos": 32, "km": 5.2 }. Modalidad y minutos obligatorios; km opcional.
create or replace function public.cardio_hecho_valido(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object'
    and not exists (select 1 from jsonb_object_keys(j) k where k not in ('modalidad', 'minutos', 'km'))
    and coalesce(j ->> 'modalidad', '') in ('carrera', 'andar', 'bici', 'eliptica', 'remo', 'nadar', 'cuerda', 'otro')
    and coalesce(jsonb_typeof(j -> 'minutos'), '') = 'number' and (j ->> 'minutos')::numeric = floor((j ->> 'minutos')::numeric)
    and (j ->> 'minutos')::numeric between 1 and 600
    and (not (j ? 'km') or (jsonb_typeof(j -> 'km') = 'number' and (j ->> 'km')::numeric > 0 and (j ->> 'km')::numeric <= 200))
$$;

alter table public.sesiones drop constraint if exists sesiones_cardio_valido;
alter table public.sesiones add constraint sesiones_cardio_valido check (cardio is null or public.cardio_valido(cardio) is true);
alter table public.sesiones drop constraint if exists sesiones_cardio_hecho_valido;
alter table public.sesiones add constraint sesiones_cardio_hecho_valido check (cardio_hecho is null or public.cardio_hecho_valido(cardio_hecho) is true);

-- proteger_sesion (002, 008): la pauta de cardio también es solo del coach. Lo demás, igual que en la 008.
create or replace function public.proteger_sesion() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    if (new.id, new.semana_id, new.orden, new.nombre, new.tipo, new.intencion, new.dinamica, new.cardio)
       is distinct from
       (old.id, old.semana_id, old.orden, old.nombre, old.tipo, old.intencion, old.dinamica, old.cardio) then
      raise exception 'Solo el coach puede cambiar la prescripción de la sesión' using errcode = '42501';
    end if;
    if (to_jsonb(new) - 'dia_previsto' - 'revisada_en') is distinct from (to_jsonb(old) - 'dia_previsto' - 'revisada_en') then
      new.revisada_en := null;
    else
      new.revisada_en := old.revisada_en;
    end if;
  end if;
  return new;
end $$;

-- Las funciones de copia (por si se usan desde el SQL Editor) copian también la pauta de cardio
create or replace function public.duplicar_semana(
  p_semana uuid, p_kg_extra numeric default 0, p_reps_extra int default 0, p_rir_delta numeric default 0)
returns uuid language plpgsql set search_path = public as $$
declare
  v_old   public.semanas;
  v_nueva uuid;
  s       record;
  v_ses   uuid;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  select * into v_old from public.semanas where id = p_semana;
  if not found then raise exception 'Semana no encontrada'; end if;

  insert into public.semanas (bloque_id, numero, foco, fecha_inicio, programacion)
  values (v_old.bloque_id,
          (select max(numero) + 1 from public.semanas where bloque_id = v_old.bloque_id),
          v_old.foco, v_old.fecha_inicio + 7, 'en_programacion')
  returning id into v_nueva;

  for s in select * from public.sesiones where semana_id = p_semana order by orden loop
    insert into public.sesiones (semana_id, orden, nombre, tipo, intencion, dinamica, cardio)
    values (v_nueva, s.orden, s.nombre, s.tipo, s.intencion, s.dinamica, s.cardio)
    returning id into v_ses;

    insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, superserie, prioridad, series,
      reps_min, reps_max, rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante,
      backoff_pct)
    select v_ses, ejercicio_id, orden, superserie, prioridad, series,
           reps_min + p_reps_extra, reps_max + p_reps_extra,
           greatest(rir_objetivo + p_rir_delta, 0), rpe_objetivo,
           case when carga_sugerida_kg is null then null else carga_sugerida_kg + p_kg_extra end,
           descanso_seg, tempo, notas_coach, variante, backoff_pct
    from public.sesion_ejercicios where sesion_id = s.id;
  end loop;
  return v_nueva;
end $$;

create or replace function public.crear_bloque_desde_plantilla(
  p_plantilla uuid, p_atleta uuid, p_fecha_inicio date, p_numero int default null)
returns uuid language plpgsql set search_path = public as $$
declare
  v_pl     public.bloques;
  v_bloque uuid;
  w        record;
  s        record;
  v_sem    uuid;
  v_ses    uuid;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  select * into v_pl from public.bloques where id = p_plantilla and es_plantilla;
  if not found then raise exception 'Plantilla no encontrada'; end if;

  insert into public.bloques (atleta_id, numero, nombre, foco, objetivo, descripcion, fecha_inicio, estado)
  values (p_atleta,
          coalesce(p_numero, (select coalesce(max(numero), 0) + 1 from public.bloques where atleta_id = p_atleta)),
          v_pl.nombre, v_pl.foco, v_pl.objetivo, v_pl.descripcion, p_fecha_inicio, 'planificado')
  returning id into v_bloque;

  for w in select * from public.semanas where bloque_id = p_plantilla order by numero loop
    insert into public.semanas (bloque_id, numero, foco, fecha_inicio, nota_coach, programacion)
    values (v_bloque, w.numero, w.foco, p_fecha_inicio + (w.numero - 1) * 7, w.nota_coach, 'en_programacion')
    returning id into v_sem;
    for s in select * from public.sesiones where semana_id = w.id order by orden loop
      insert into public.sesiones (semana_id, orden, nombre, tipo, intencion, dinamica, cardio)
      values (v_sem, s.orden, s.nombre, s.tipo, s.intencion, s.dinamica, s.cardio)
      returning id into v_ses;
      insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, superserie, prioridad, series,
        reps_min, reps_max, rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante,
        backoff_pct)
      select v_ses, ejercicio_id, orden, superserie, prioridad, series, reps_min, reps_max,
             rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante, backoff_pct
      from public.sesion_ejercicios where sesion_id = s.id;
    end loop;
  end loop;
  return v_bloque;
end $$;

-- Permisos (como al final de 003 a 012)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (13)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
