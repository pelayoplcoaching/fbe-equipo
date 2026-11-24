-- =====================================================================
-- FBE Equipo, migración 092: FBE Esencial, la semana siguiente de quien va por su cuenta, sola
--
-- Por qué: en FBE Esencial nadie programa a mano. Las cuatro primeras semanas son las de la guía («Primeras 4 semanas»,
-- de la 091); desde la quinta, cada semana la prepara el motor en el móvil del atleta (las reglas de Pelayo, por su
-- cuenta, con los cuatro frenos de la v0.231) y la guarda esta función, que vuelve a comprobarlo todo:
--   * La plantilla «Novato 2 días · FBE Esencial» (desde la semana 5: los mismos cinco ejercicios, dos días iguales),
--     si no hay ya una con ese nombre y están los ejercicios de la guía.
--   * esencial_semana_siguiente(p, p_atleta): la semana del lunes siguiente, publicada, con las sesiones y los
--     ejercicios de su molde (la semana que acaba de hacer o, tras «Primeras 4 semanas», la plantilla de novato en un
--     bloque nuevo) y, de lo que manda la app, solo lo que cambia el motor (series, repeticiones, esfuerzo, kilos y el
--     detalle por serie), dentro de unos topes. El resto (ejercicio, orden, prioridad, descanso, notas) sale del molde.
--     La plancha va en segundos (hasta 60) y, pasados los 50, con peso: 5 kg más como mucho sobre lo que ha hecho.
--     Solo el propio atleta (o el coach), solo si va por su cuenta, solo una por semana: si ya está, devuelve esa.
--   Para quien lleva seguimiento no cambia nada.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 091 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 92 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 092 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 92;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 91) then  -- (2) la anterior
    raise exception 'Falta la migración 091 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. La plantilla «Novato 2 días · FBE Esencial» (igual que NOVATO_2 en logica/esencial-plantilla.js)
-- ---------------------------------------------------------------------
do $$
declare
  v_pl uuid;
  v_sem uuid;
  v_ses uuid;
  s record;
  e record;
begin
  if exists (select 1 from public.bloques where es_plantilla and nombre = 'Novato 2 días · FBE Esencial') then return; end if;
  if exists (select 1 from (values ('Prensa de piernas'), ('Peso muerto rumano con mancuernas'), ('Press de pecho en máquina'), ('Jalón al pecho'), ('Plancha abdominal')) as t(n)
             where not exists (select 1 from public.ejercicios where nombre = t.n)) then
    raise notice 'Falta algún ejercicio de la guía en la biblioteca: la plantilla «Novato 2 días · FBE Esencial» no se crea (Claude la prepara a mano).';
    return;
  end if;
  insert into public.bloques (atleta_id, es_plantilla, nombre, foco, objetivo, descripcion, estado)
  values (null, true, 'Novato 2 días · FBE Esencial', 'adaptacion', 'Ganar fuerza con los cinco ejercicios',
          'Desde la semana 5: los mismos cinco ejercicios, dos días por semana que no vayan seguidos. Cada semana, la app te prepara la siguiente a partir de lo que apuntas, con las reglas de progresión de Pelayo.', 'planificado')
  returning id into v_pl;
  insert into public.semanas (bloque_id, numero, foco, nota_coach)
  values (v_pl, 1, 'adaptacion', 'Tu plan desde ahora: los mismos cinco ejercicios, tres series en los cuatro primeros. Empiezas con los kilos de tus marcas; cada semana, la app te prepara la siguiente con lo que apuntas.')
  returning id into v_sem;
  for s in select * from (values (1, 'Día 1'), (2, 'Día 2')) as t(orden, nombre) loop
    insert into public.sesiones (semana_id, orden, nombre, tipo) values (v_sem, s.orden, s.nombre, 'fuerza') returning id into v_ses;
    for e in select * from (values
      (1, 'Prensa de piernas', 'alta', 3, 10, 12, 2::numeric, 90, 'Si no hay prensa: sentadilla a un banco, con las mismas series y repeticiones.'),
      (2, 'Peso muerto rumano con mancuernas', 'alta', 3, 10, 12, 2, 90, 'O, en su lugar, puente de glúteo, con las mismas series y repeticiones.'),
      (3, 'Press de pecho en máquina', 'media', 3, 10, 12, 2, 90, 'O flexiones, con más o menos inclinación según tu nivel.'),
      (4, 'Jalón al pecho', 'media', 3, 10, 12, 2, 90, 'O, en su lugar, remo en máquina, con las mismas series y repeticiones.'),
      (5, 'Plancha abdominal', 'media', 2, 40, 50, null, 90, 'O curl de bíceps: las mismas series, de 10 a 12 repeticiones.')
    ) as t(orden, ejercicio, prioridad, series, reps_min, reps_max, rir, descanso, nota) loop
      insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, prioridad, series, reps_min, reps_max, rir_objetivo, descanso_seg, notas_coach)
      values (v_ses, (select id from public.ejercicios where nombre = e.ejercicio order by creado_en limit 1), e.orden, e.prioridad, e.series, e.reps_min, e.reps_max, e.rir, e.descanso, e.nota);
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. La semana siguiente
-- ---------------------------------------------------------------------
-- p: { base: id de la semana hecha, inicio: lunes de la nueva, novato: true tras «Primeras 4 semanas», nota, descarga,
--      sesiones: [{ orden, pautas: [{ ejercicio_id, orden, series, reps_min, reps_max, rir_objetivo, rpe_objetivo,
--      carga_sugerida_kg, backoff_pct, series_detalle }] }] }
-- Devuelve el id de la semana nueva (o el de la que ya había para ese lunes).
create or replace function public.esencial_semana_siguiente(p jsonb, p_atleta uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_coach boolean := public.es_coach();
  v_id uuid := coalesce(p_atleta, public.mi_atleta_id());
  v_at public.atletas;
  v_base public.semanas;
  v_bloque public.bloques;
  v_nuevo uuid;
  v_molde uuid;
  v_inicio date;
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_novato boolean := coalesce((p ->> 'novato')::boolean, false);
  v_sem uuid;
  v_numero int;
  v_nota text := nullif(left(btrim(coalesce(p ->> 'nota', '')), 600), '');
  v_foco text;
  s record;
  q record;
  v_ses uuid;
  v_js jsonb;
  v_jp jsonb;
  v_series int; v_rmin int; v_rmax int; v_rir numeric; v_rpe numeric; v_kg numeric; v_bo numeric; v_det jsonb;
  v_tiempo boolean;
  v_tope numeric;
begin
  if v_id is null then raise exception 'No hay atleta' using errcode = 'P0002'; end if;
  if not v_coach and public.mi_atleta_id() is distinct from v_id then
    raise exception 'Solo puedes preparar tu propia semana' using errcode = '42501';
  end if;
  select * into v_at from public.atletas where id = v_id;
  if not found then raise exception 'Ese atleta no existe' using errcode = 'P0002'; end if;
  if v_at.modalidad <> 'por_su_cuenta' then raise exception 'Solo para quien va por su cuenta (FBE Esencial)' using errcode = '22023'; end if;
  if v_at.estado <> 'activo' then raise exception 'Su cuenta no está activa' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('fbe-esencial-semana:' || v_id::text));

  -- La semana hecha: suya, publicada
  select w.* into v_base from public.semanas w join public.bloques b on b.id = w.bloque_id
  where w.id = (p ->> 'base')::uuid and b.atleta_id = v_id and not b.es_plantilla and w.programacion = 'programada';
  if not found then raise exception 'Esa semana no es tuya' using errcode = '42501'; end if;
  select * into v_bloque from public.bloques where id = v_base.bloque_id;
  -- Su lunes: un lunes después de la semana hecha y como mucho el que viene
  v_inicio := (p ->> 'inicio')::date;
  if v_inicio is null or v_inicio <> fbe_privado.lunes_de(v_inicio) or v_inicio <= v_base.fecha_inicio or v_inicio > fbe_privado.lunes_de(v_hoy) + 7 then
    raise exception 'Ese lunes no vale para la semana siguiente' using errcode = '22023';
  end if;
  -- Una por semana: si ya tiene una para ese lunes, esa
  select w.id into v_sem from public.semanas w join public.bloques b on b.id = w.bloque_id
  where b.atleta_id = v_id and not b.es_plantilla and w.fecha_inicio = v_inicio and w.programacion = 'programada' limit 1;
  if v_sem is not null then return v_sem; end if;

  -- El molde: tras «Primeras 4 semanas» (su semana de marcas), la plantilla de novato en un bloque nuevo; si no, la semana hecha
  if v_novato then
    if v_bloque.nombre <> 'Primeras 4 semanas' or not coalesce(v_base.marcas, false) then
      raise exception 'El bloque de novato va después de la semana de marcas' using errcode = '22023';
    end if;
    select w.id into v_molde from public.semanas w join public.bloques b on b.id = w.bloque_id
    where b.es_plantilla and b.nombre = 'Novato 2 días · FBE Esencial' order by b.creado_en, w.numero limit 1;
    if v_molde is null then raise exception 'No está la plantilla «Novato 2 días · FBE Esencial»' using errcode = 'P0002'; end if;
    update public.bloques set estado = 'finalizado' where id = v_bloque.id and estado in ('activo', 'ajustado');
    insert into public.bloques (atleta_id, numero, nombre, foco, objetivo, descripcion, fecha_inicio, fecha_fin, estado)
    select v_id, (select coalesce(max(numero), 0) + 1 from public.bloques where atleta_id = v_id), b.nombre, b.foco, b.objetivo, b.descripcion, v_inicio, v_inicio + 6, 'activo'
    from public.bloques b where b.id = (select bloque_id from public.semanas where id = v_molde)
    returning id into v_nuevo;
    v_numero := 1;
  else
    v_molde := v_base.id;
    v_nuevo := v_bloque.id;
    select coalesce(max(numero), 0) + 1 into v_numero from public.semanas where bloque_id = v_nuevo;
    update public.bloques set fecha_fin = greatest(coalesce(fecha_fin, v_inicio + 6), v_inicio + 6) where id = v_nuevo;
  end if;
  -- (la nota: la que manda la app con lo que cambia; en la semana 5, si no manda ninguna, la de la plantilla)
  if v_nota is null and v_novato then select nota_coach into v_nota from public.semanas where id = v_molde; end if;
  v_foco := case when coalesce((p ->> 'descarga')::boolean, false) then 'descarga'
                 else (select coalesce(nullif(foco, 'descarga'), (select foco from public.bloques where id = v_nuevo)) from public.semanas where id = v_molde) end;
  insert into public.semanas (bloque_id, numero, foco, fecha_inicio, nota_coach, programacion)
  values (v_nuevo, v_numero, v_foco, v_inicio, v_nota, 'programada') returning id into v_sem;

  -- Las sesiones y ejercicios del molde; de lo que manda la app, solo lo del motor (si cuadra con el molde y con los topes)
  for s in select * from public.sesiones where semana_id = v_molde order by orden loop
    insert into public.sesiones (semana_id, orden, nombre, tipo, intencion, dinamica, cardio)
    values (v_sem, s.orden, s.nombre, s.tipo, s.intencion, s.dinamica, s.cardio) returning id into v_ses;
    select value into v_js from jsonb_array_elements(coalesce(p -> 'sesiones', '[]'::jsonb)) where (value ->> 'orden')::int = s.orden limit 1;
    for q in select se.*, coalesce(e.por_tiempo, false) as tiempo from public.sesion_ejercicios se join public.ejercicios e on e.id = se.ejercicio_id
             where se.sesion_id = s.id order by se.orden loop
      v_jp := null;
      if v_js is not null then
        select value into v_jp from jsonb_array_elements(coalesce(v_js -> 'pautas', '[]'::jsonb))
        where (value ->> 'orden')::int = q.orden and (value ->> 'ejercicio_id')::uuid = q.ejercicio_id limit 1;
      end if;
      v_series := q.series; v_rmin := q.reps_min; v_rmax := q.reps_max; v_rir := q.rir_objetivo; v_rpe := q.rpe_objetivo;
      v_kg := q.carga_sugerida_kg; v_bo := q.backoff_pct; v_det := q.series_detalle;
      if v_jp is not null then
        v_tiempo := q.tiempo;
        -- Lo más que se puede proponer en kilos: lo más que ha movido en ese ejercicio en sus dos últimas semanas, +10 % y un
        -- salto; en la plancha (por tiempo, hasta 60 s), 5 kg más como mucho (el primer peso o un salto de 2,5)
        select max(sr.kg) into v_tope from public.series sr join public.sesion_ejercicios x on x.id = sr.sesion_ejercicio_id
          join public.sesiones ss on ss.id = x.sesion_id join public.semanas ww on ww.id = ss.semana_id join public.bloques bb on bb.id = ww.bloque_id
          where bb.atleta_id = v_id and ww.fecha_inicio >= v_base.fecha_inicio - 7 and coalesce(sr.sustituto_id, x.ejercicio_id) = q.ejercicio_id;
        -- (la semana 5: la plantilla manda en series, repeticiones y esfuerzo; de la app, solo los kilos de partida)
        if not v_novato then
          v_series := coalesce((v_jp ->> 'series')::int, v_series);
          v_rmin := (v_jp ->> 'reps_min')::int;
          v_rmax := (v_jp ->> 'reps_max')::int;
          v_rir := (v_jp ->> 'rir_objetivo')::numeric;
          v_rpe := (v_jp ->> 'rpe_objetivo')::numeric;
          v_bo := (v_jp ->> 'backoff_pct')::numeric;
          v_det := case when jsonb_typeof(v_jp -> 'series_detalle') = 'array' and jsonb_array_length(v_jp -> 'series_detalle') between 1 and 6 then v_jp -> 'series_detalle' else null end;
        end if;
        v_kg := (v_jp ->> 'carga_sugerida_kg')::numeric;
        if v_series not between 1 and 6
           or (v_rmin is not null and v_rmin not between 1 and 60)
           or (v_rmax is not null and v_rmax not between 1 and 60)
           or (v_rmin is not null and v_rmax is not null and v_rmin > v_rmax)
           or (v_rir is not null and v_rir not between 0 and 5)
           or (v_rpe is not null and v_rpe not between 5 and 10)
           or (v_bo is not null and v_bo not between 0 and 50)
           or (v_kg is not null and (v_kg < 0 or (v_tiempo and v_kg > coalesce(v_tope, 0) + 5)
                                     or (not v_tiempo and (v_tope is null or v_kg > v_tope * 1.1 + 2.5))))
           or not public.series_detalle_valido(v_det, v_series) or (v_det is not null and v_bo is not null)
           or exists (select 1 from jsonb_array_elements(coalesce(v_det, '[]'::jsonb)) d
                      where jsonb_typeof(d -> 'kg') = 'number' and (v_tope is null or (d ->> 'kg')::numeric > v_tope * 1.1 + 2.5)) then
          -- (fuera de los topes: se queda la del molde, sin parar la semana)
          v_series := q.series; v_rmin := q.reps_min; v_rmax := q.reps_max; v_rir := q.rir_objetivo; v_rpe := q.rpe_objetivo;
          v_kg := q.carga_sugerida_kg; v_bo := q.backoff_pct; v_det := q.series_detalle;
        end if;
      end if;
      insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, superserie, prioridad, series, reps_min, reps_max, rir_objetivo,
        rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante, backoff_pct, series_detalle)
      values (v_ses, q.ejercicio_id, q.orden, q.superserie, q.prioridad, v_series, v_rmin, v_rmax, v_rir,
        v_rpe, v_kg, q.descanso_seg, q.tempo, q.notas_coach, q.variante, v_bo, v_det);
    end loop;
  end loop;
  return v_sem;
end $$;

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 091)
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
-- (091) la de un trigger: nadie la llama
revoke execute on function public.atleta_visto_bueno_salud() from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;
-- (revisión de la 072) la comprobación de las columnas de música la usa una restricción: el servidor (service_role) también tiene que poder llamarla
grant execute on function fbe_privado.musica_url_valida(text) to service_role;

insert into public.fbe_migraciones (numero) values (92)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
