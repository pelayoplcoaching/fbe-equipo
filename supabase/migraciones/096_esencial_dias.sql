-- =====================================================================
-- FBE Equipo, migración 096: FBE Esencial, tres días (o volver a dos) y el tope de peso de la plancha
--
-- Por qué (decisiones de Pelayo del 25/11/2026):
--   * «Crea la plantilla de novato de 3 días»: «Novato 3 días · FBE Esencial» (igual que NOVATO_3 en
--     logica/esencial-plantilla.js): los días 1 y 3, los cinco ejercicios de siempre; el día 2, sus alternativas de la guía.
--   * Cambiar de días sin escribir a nadie: `atletas.esencial_dias` (2 o 3) y esencial_cambiar_dias(p_dias, p_atleta):
--     quien va por su cuenta, con una plantilla de novato (desde la semana 5), pide tres días o volver a dos; la semana
--     siguiente que le prepare la app es de esa plantilla, en un bloque nuevo, con los kilos que llevaba en cada ejercicio (lo
--     que no hacía, sin kilos; en la plancha, sus segundos).
--   * La plancha, como mucho 20 kg: esencial_semana_siguiente (la de la 094) no deja más.
--   (La regla del estancamiento, a las 3 semanas un 10 % menos, la aplica la app: la base ya dejaba bajar kilos.)
--   No cambia la política. Para quien lleva seguimiento no cambia nada.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 095 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 96 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 096 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 96;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 95) then  -- (2) la anterior
    raise exception 'Falta la migración 095 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Los días que pide
-- ---------------------------------------------------------------------
alter table public.atletas add column if not exists esencial_dias smallint;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'atletas_esencial_dias_check') then
    alter table public.atletas add constraint atletas_esencial_dias_check check (esencial_dias is null or esencial_dias in (2, 3));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. La plantilla «Novato 3 días · FBE Esencial» (igual que NOVATO_3 en logica/esencial-plantilla.js)
-- ---------------------------------------------------------------------
do $$
declare
  v_pl uuid;
  v_sem uuid;
  v_ses uuid;
  s record;
  e record;
begin
  if exists (select 1 from public.bloques where es_plantilla and nombre = 'Novato 3 días · FBE Esencial') then return; end if;
  if exists (select 1 from (values ('Prensa de piernas'), ('Peso muerto rumano con mancuernas'), ('Press de pecho en máquina'), ('Jalón al pecho'), ('Plancha abdominal'),
                                   ('Sentadilla a un banco'), ('Puente de glúteo'), ('Flexiones'), ('Remo en máquina'), ('Curl de bíceps con mancuernas')) as t(n)
             where not exists (select 1 from public.ejercicios where nombre = t.n)) then
    raise notice 'Falta algún ejercicio de la guía en la biblioteca: la plantilla «Novato 3 días · FBE Esencial» no se crea (Claude la prepara a mano).';
    return;
  end if;
  insert into public.bloques (atleta_id, es_plantilla, nombre, foco, objetivo, descripcion, estado)
  values (null, true, 'Novato 3 días · FBE Esencial', 'adaptacion', 'Ganar fuerza con tres días por semana',
          'Desde la semana 5, si quieres un tercer día: tres días por semana que no vayan seguidos. Los días 1 y 3, los cinco ejercicios de siempre; el día 2, sus alternativas. Cada semana, la app te prepara la siguiente a partir de lo que apuntas, con las reglas de progresión de Pelayo.', 'planificado')
  returning id into v_pl;
  insert into public.semanas (bloque_id, numero, foco, nota_coach)
  values (v_pl, 1, 'adaptacion', 'Tu plan pasa a tres días: los días 1 y 3, la sesión de siempre, con los kilos que llevabas; el día 2, sus alternativas: busca el peso con el que te sobren 2. Que no vayan seguidos.')
  returning id into v_sem;
  for s in select * from (values (1, 'Día 1'), (2, 'Día 2'), (3, 'Día 3')) as t(orden, nombre) loop
    insert into public.sesiones (semana_id, orden, nombre, tipo) values (v_sem, s.orden, s.nombre, 'fuerza') returning id into v_ses;
    for e in select * from (values
      (1, 1, 'Prensa de piernas', 'alta', 3, 10, 12, 2::numeric, 90, 'Si no hay prensa: sentadilla a un banco, con las mismas series y repeticiones.'),
      (1, 2, 'Peso muerto rumano con mancuernas', 'alta', 3, 10, 12, 2, 90, 'O, en su lugar, puente de glúteo, con las mismas series y repeticiones.'),
      (1, 3, 'Press de pecho en máquina', 'media', 3, 10, 12, 2, 90, 'O flexiones, con más o menos inclinación según tu nivel.'),
      (1, 4, 'Jalón al pecho', 'media', 3, 10, 12, 2, 90, 'O, en su lugar, remo en máquina, con las mismas series y repeticiones.'),
      (1, 5, 'Plancha abdominal', 'media', 2, 40, 50, null, 90, 'O curl de bíceps: las mismas series, de 10 a 12 repeticiones.'),
      (2, 1, 'Sentadilla a un banco', 'alta', 3, 10, 12, 2, 90, 'El día 2, en lugar de la prensa.'),
      (2, 2, 'Puente de glúteo', 'alta', 3, 10, 12, 2, 90, 'El día 2, en lugar del peso muerto rumano.'),
      (2, 3, 'Flexiones', 'media', 3, 10, 12, 2, 90, 'El día 2, en lugar del press. Con más o menos inclinación según tu nivel.'),
      (2, 4, 'Remo en máquina', 'media', 3, 10, 12, 2, 90, 'El día 2, en lugar del jalón.'),
      (2, 5, 'Curl de bíceps con mancuernas', 'media', 2, 10, 12, 2, 90, 'El día 2, en lugar de la plancha.')
    ) as t(dia, orden, ejercicio, prioridad, series, reps_min, reps_max, rir, descanso, nota)
    where t.dia = case when s.orden = 2 then 2 else 1 end loop
      insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, prioridad, series, reps_min, reps_max, rir_objetivo, descanso_seg, notas_coach)
      values (v_ses, (select id from public.ejercicios where nombre = e.ejercicio order by creado_en limit 1), e.orden, e.prioridad, e.series, e.reps_min, e.reps_max, e.rir, e.descanso, e.nota);
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Pedir tres días (o volver a dos): desde la semana siguiente que le prepare la app
-- ---------------------------------------------------------------------
create or replace function public.esencial_cambiar_dias(p_dias integer, p_atleta uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := coalesce(p_atleta, public.mi_atleta_id());
  v_at public.atletas;
  v_bloque text;
begin
  if v_id is null then raise exception 'No hay atleta' using errcode = 'P0002'; end if;
  if not public.es_coach() and public.mi_atleta_id() is distinct from v_id then
    raise exception 'Solo puedes cambiar tus propios días' using errcode = '42501';
  end if;
  select * into v_at from public.atletas where id = v_id;
  if not found then raise exception 'Ese atleta no existe' using errcode = 'P0002'; end if;
  if v_at.modalidad <> 'por_su_cuenta' then raise exception 'Solo para quien va por su cuenta (FBE Esencial)' using errcode = '22023'; end if;
  if v_at.estado <> 'activo' then raise exception 'Su cuenta no está activa' using errcode = '22023'; end if;
  if p_dias is null or p_dias not in (2, 3) then raise exception 'Son 2 o 3 días' using errcode = '22023'; end if;
  select nombre into v_bloque from public.bloques
  where atleta_id = v_id and not es_plantilla and estado in ('activo', 'ajustado') order by fecha_inicio desc nulls last, numero desc limit 1;
  if v_bloque is null or v_bloque not in ('Novato 2 días · FBE Esencial', 'Novato 3 días · FBE Esencial') then
    raise exception 'Puedes cambiar de días desde la semana 5' using errcode = '22023';
  end if;
  update public.atletas set esencial_dias = p_dias where id = v_id;
  return p_dias;
end $$;

-- ---------------------------------------------------------------------
-- 4. La semana siguiente: la de la 094, con el cambio de días y la plancha hasta 20 kg
-- ---------------------------------------------------------------------
-- p: { base, inicio, novato, cambio (096: la plantilla de novato de los días que ha pedido), plantilla (096: el nombre, para
--      comprobarlo), nota, descarga, sesiones }. Devuelve el id de la semana nueva (o el de la que ya había para ese lunes).
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
  v_cambio boolean := coalesce((p ->> 'cambio')::boolean, false) and not coalesce((p ->> 'novato')::boolean, false);
  v_destino text;
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
  b_kg numeric; b_det jsonb;
  v_ej uuid;
  v_tiempo boolean;
  v_tope numeric;
  c_kg numeric; c_rmin int; c_rmax int; c_hay boolean;
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

  -- El molde: tras «Primeras 4 semanas» (su semana de marcas), la plantilla de novato de sus días en un bloque nuevo; (096) si
  -- ha pedido otros días, la otra plantilla de novato en un bloque nuevo; si no, la semana hecha
  if v_novato or v_cambio then
    if v_novato then
      if v_bloque.nombre <> 'Primeras 4 semanas' or not coalesce(v_base.marcas, false) then
        raise exception 'El bloque de novato va después de la semana de marcas' using errcode = '22023';
      end if;
      v_destino := case when v_at.esencial_dias = 3 then 'Novato 3 días · FBE Esencial' else 'Novato 2 días · FBE Esencial' end;
    else
      if v_bloque.nombre not in ('Novato 2 días · FBE Esencial', 'Novato 3 días · FBE Esencial') then
        raise exception 'Solo se cambia de días desde una plantilla de novato' using errcode = '22023';
      end if;
      v_destino := case v_at.esencial_dias when 3 then 'Novato 3 días · FBE Esencial' when 2 then 'Novato 2 días · FBE Esencial' end;
      if v_destino is null or v_destino = v_bloque.nombre then raise exception 'Ya entrenas esos días' using errcode = '22023'; end if;
    end if;
    if p ? 'plantilla' and (p ->> 'plantilla') is distinct from v_destino then
      raise exception 'Esa plantilla no es la de tus días' using errcode = '22023';
    end if;
    select w.id into v_molde from public.semanas w join public.bloques b on b.id = w.bloque_id
    where b.es_plantilla and b.nombre = v_destino order by b.creado_en, w.numero limit 1;
    if v_molde is null then raise exception 'No está la plantilla «%»', v_destino using errcode = 'P0002'; end if;
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
  if v_nota is null and (v_novato or v_cambio) then select nota_coach into v_nota from public.semanas where id = v_molde; end if;
  v_foco := case when coalesce((p ->> 'descarga')::boolean, false) then 'descarga'
                 else (select coalesce(nullif(foco, 'descarga'), (select foco from public.bloques where id = v_nuevo)) from public.semanas where id = v_molde) end;
  insert into public.semanas (bloque_id, numero, foco, fecha_inicio, nota_coach, programacion)
  values (v_nuevo, v_numero, v_foco, v_inicio, v_nota, 'programada') returning id into v_sem;

  -- Las sesiones y ejercicios del molde (con su alternativa, si la ha elegido para siempre); de lo que manda la app, solo
  -- lo del motor (si cuadra con el molde y con los topes)
  for s in select * from public.sesiones where semana_id = v_molde order by orden loop
    insert into public.sesiones (semana_id, orden, nombre, tipo, intencion, dinamica, cardio)
    values (v_sem, s.orden, s.nombre, s.tipo, s.intencion, s.dinamica, s.cardio) returning id into v_ses;
    select value into v_js from jsonb_array_elements(coalesce(p -> 'sesiones', '[]'::jsonb)) where (value ->> 'orden')::int = s.orden limit 1;
    for q in select se.*, coalesce(e.por_tiempo, false) as tiempo from public.sesion_ejercicios se join public.ejercicios e on e.id = se.ejercicio_id
             where se.sesion_id = s.id order by se.orden loop
      -- (094) su alternativa para siempre (solo entre ejercicios que se miden igual), sin los kilos del otro ejercicio
      v_ej := coalesce((v_at.esencial_alternativas ->> q.ejercicio_id::text)::uuid, q.ejercicio_id);
      if v_ej <> q.ejercicio_id and not exists (select 1 from public.ejercicios where id = v_ej and coalesce(por_tiempo, false) = q.tiempo) then v_ej := q.ejercicio_id; end if;
      v_tiempo := q.tiempo;
      b_kg := q.carga_sugerida_kg; b_det := q.series_detalle;
      if v_ej <> q.ejercicio_id then b_kg := null; b_det := null; end if;
      v_jp := null;
      if v_js is not null then
        select value into v_jp from jsonb_array_elements(coalesce(v_js -> 'pautas', '[]'::jsonb))
        where (value ->> 'orden')::int = q.orden and (value ->> 'ejercicio_id')::uuid = v_ej limit 1;
      end if;
      v_series := q.series; v_rmin := q.reps_min; v_rmax := q.reps_max; v_rir := q.rir_objetivo; v_rpe := q.rpe_objetivo;
      v_kg := b_kg; v_bo := q.backoff_pct; v_det := b_det;
      -- (096) al cambiar de días: los kilos que llevaba en ese ejercicio en la semana hecha (y, en la plancha, sus segundos,
      -- con 20 kg como mucho); lo que no hacía (el día de alternativas), sin kilos. De la app, nada.
      if v_cambio then
        select x.carga_sugerida_kg, x.reps_min, x.reps_max, true into c_kg, c_rmin, c_rmax, c_hay
        from public.sesion_ejercicios x join public.sesiones ss on ss.id = x.sesion_id
        where ss.semana_id = v_base.id and x.ejercicio_id = v_ej order by x.carga_sugerida_kg desc nulls last limit 1;
        if coalesce(c_hay, false) then
          v_kg := c_kg; v_det := null;
          if v_tiempo and c_rmin is not null and c_rmax is not null and c_rmin <= c_rmax and c_rmax <= 60 then v_rmin := c_rmin; v_rmax := c_rmax; end if;
        else
          v_kg := null; v_det := null;
        end if;
        if v_tiempo and v_kg > 20 then v_kg := 20; end if;
        c_kg := null; c_rmin := null; c_rmax := null; c_hay := null;
        v_jp := null;
      end if;
      if v_jp is not null then
        -- Lo más que se puede proponer en kilos: lo más que ha movido en ese ejercicio en sus dos últimas semanas, +10 % y un
        -- salto; en la plancha (por tiempo, hasta 60 s), 5 kg más como mucho (el primer peso o un salto de 2,5)
        select max(sr.kg) into v_tope from public.series sr join public.sesion_ejercicios x on x.id = sr.sesion_ejercicio_id
          join public.sesiones ss on ss.id = x.sesion_id join public.semanas ww on ww.id = ss.semana_id join public.bloques bb on bb.id = ww.bloque_id
          where bb.atleta_id = v_id and ww.fecha_inicio >= v_base.fecha_inicio - 7 and coalesce(sr.sustituto_id, x.ejercicio_id) = v_ej;
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
           or (v_kg is not null and (v_kg < 0 or (v_tiempo and (v_kg > coalesce(v_tope, 0) + 5 or v_kg > 20))
                                     or (not v_tiempo and (v_tope is null or v_kg > v_tope * 1.1 + 2.5))))
           or not public.series_detalle_valido(v_det, v_series) or (v_det is not null and v_bo is not null)
           or exists (select 1 from jsonb_array_elements(coalesce(v_det, '[]'::jsonb)) d
                      where jsonb_typeof(d -> 'kg') = 'number' and (v_tope is null or (d ->> 'kg')::numeric > v_tope * 1.1 + 2.5)) then
          -- (fuera de los topes: se queda la del molde, sin parar la semana)
          v_series := q.series; v_rmin := q.reps_min; v_rmax := q.reps_max; v_rir := q.rir_objetivo; v_rpe := q.rpe_objetivo;
          v_kg := b_kg; v_bo := q.backoff_pct; v_det := b_det;
        end if;
      end if;
      insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, superserie, prioridad, series, reps_min, reps_max, rir_objetivo,
        rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante, backoff_pct, series_detalle)
      values (v_ses, v_ej, q.orden, q.superserie, q.prioridad, v_series, v_rmin, v_rmax, v_rir,
        v_rpe, v_kg, q.descanso_seg, q.tempo, q.notas_coach, q.variante, v_bo, v_det);
    end loop;
  end loop;
  return v_sem;
end $$;

-- ---------------------------------------------------------------------
-- 5. Permisos (como al final de 003 a 095)
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

insert into public.fbe_migraciones (numero) values (96)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
