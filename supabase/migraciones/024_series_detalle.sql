-- =====================================================================
-- FBE Equipo, migración 024 (v0.28): la pauta serie a serie
-- Hasta ahora cada ejercicio se pautaba con unas series iguales (3 × 8–12 a 25 kg, RPE 8). Con
-- sesion_ejercicios.series_detalle, el coach puede dar a cada serie sus reps, sus kilos y su RPE
-- ([{"reps":8,"kg":25,"rpe":7}, {"reps":10,"kg":22.5,"rpe":8}, …]), como en Notion. Las columnas de siempre
-- (series, reps mín–máx, kilos, RPE) siguen ahí, con el resumen que calcula la app, para todo lo demás
-- (volumen, progreso, avisos). Sin detalle (null), todo sigue como antes.
-- Forma: una lista de 1 a 20 series, tantas como «series»; en cada una, solo reps (entero 0–1000), kg
-- (0–9999,99) y rpe (1–10), cada uno opcional. No va con top + back-off (es otra forma de pautar).
-- También la copian duplicar_semana (sin cambios de reps ni kilos) y crear_bloque_desde_plantilla.
-- Se ejecuta en el SQL Editor después de la 023 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 24 then
    raise exception 'Esta base ya tiene la migración %: repetir la 024 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 24;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 23) then
    raise exception 'Antes de la 024 hace falta la 023: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

alter table public.sesion_ejercicios add column if not exists series_detalle jsonb;

create or replace function public.series_detalle_valido(p jsonb, p_series int) returns boolean
language sql immutable set search_path = '' as $$
  select p is null or (
    jsonb_typeof(p) = 'array'
    and jsonb_array_length(p) between 1 and 20
    and jsonb_array_length(p) = p_series
    and not exists (
      select 1 from jsonb_array_elements(p) e
      where jsonb_typeof(e) <> 'object'
         or exists (select 1 from jsonb_object_keys(e) k where k not in ('reps', 'kg', 'rpe'))
         or (e ? 'reps' and jsonb_typeof(e->'reps') <> 'null' and (jsonb_typeof(e->'reps') <> 'number'
             or (e->>'reps')::numeric <> trunc((e->>'reps')::numeric) or (e->>'reps')::numeric not between 0 and 1000))
         or (e ? 'kg' and jsonb_typeof(e->'kg') <> 'null' and (jsonb_typeof(e->'kg') <> 'number'
             or (e->>'kg')::numeric not between 0 and 9999.99))
         or (e ? 'rpe' and jsonb_typeof(e->'rpe') <> 'null' and (jsonb_typeof(e->'rpe') <> 'number'
             or (e->>'rpe')::numeric not between 1 and 10))
    )
  );
$$;

alter table public.sesion_ejercicios drop constraint if exists sesion_ejercicios_detalle_valido;
alter table public.sesion_ejercicios add constraint sesion_ejercicios_detalle_valido check (
  public.series_detalle_valido(series_detalle, series) and (series_detalle is null or backoff_pct is null)
);

-- Las copias de la base también la llevan (la app copia por su cuenta, pero estas siguen disponibles)
create or replace function public.duplicar_semana(p_semana uuid, p_kg_extra numeric default 0,
  p_reps_extra int default 0, p_rir_delta numeric default 0)
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

    -- Con reps o kilos que cambian, el detalle serie a serie dejaría de cuadrar: se copia solo si no cambian
    insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, superserie, prioridad, series,
      reps_min, reps_max, rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante,
      backoff_pct, series_detalle)
    select v_ses, ejercicio_id, orden, superserie, prioridad, series,
           reps_min + p_reps_extra, reps_max + p_reps_extra,
           greatest(rir_objetivo + p_rir_delta, 0), rpe_objetivo,
           case when carga_sugerida_kg is null then null else carga_sugerida_kg + p_kg_extra end,
           descanso_seg, tempo, notas_coach, variante, backoff_pct,
           case when coalesce(p_kg_extra, 0) = 0 and coalesce(p_reps_extra, 0) = 0 then series_detalle end
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
        backoff_pct, series_detalle)
      select v_ses, ejercicio_id, orden, superserie, prioridad, series, reps_min, reps_max,
             rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante, backoff_pct, series_detalle
      from public.sesion_ejercicios where sesion_id = s.id;
    end loop;
  end loop;
  return v_bloque;
end $$;

-- Permisos (como al final de 003 a 023)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (24)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
