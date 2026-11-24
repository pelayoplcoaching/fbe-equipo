-- =====================================================================
-- FBE Equipo, migración 088: la carrera de la semana, también desde el móvil del atleta
--
-- Por qué: a quien va por microciclos y tiene plan de carrera («la carrera va por calendario», v0.218), la app del coach le
-- pone cada semana las carreras de esa semana de su plan dentro del microciclo que esté haciendo. Hasta ahora solo lo
-- hacía al abrirla el coach, porque el atleta no puede crear sesiones: si el coach no la abría, el lunes el atleta no veía
-- su carrera. Con esta migración lo hace la base, en una función que llaman las dos apps: el móvil del atleta al abrirse
-- (para él mismo) y la app del coach (para cualquiera). Las dos hacen lo mismo y no se pisan (una cada vez por atleta).
--
--   * carrera_al_dia(p_atleta, p_refrescar): lo mismo que hacía la app del coach (api.carreraAlDia), con el día de hoy de
--     Madrid. Solo pone lo que el coach ha puesto en el plan de carrera de esta semana: no crea nada que no esté en él.
--     El atleta, solo para sí mismo y sin «refrescar» (cambiar las pendientes de esta semana por las del plan: eso lo
--     hace la app del coach al cambiar el plan).
--   * No crea tablas ni cambia quién ve qué: no cambia la política.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 087 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 88 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 088 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 88;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 87) then  -- (2) la anterior
    raise exception 'Falta la migración 087 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Dos ayudas (privadas): qué es una carrera y el lunes de un día
-- ---------------------------------------------------------------------
-- Una carrera: una sesión de cardio de carrera, o sin pauta (las del plan que solo traen título y nota). Como esCarrera()
-- de la app (logica/semana-natural.js).
create or replace function fbe_privado.es_carrera(p_tipo text, p_cardio jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select p_tipo = 'cardio' and (p_cardio is null or (p_cardio ->> 'modalidad') is not distinct from 'carrera')
$$;

create or replace function fbe_privado.lunes_de(p_dia date) returns date
language sql immutable set search_path = '' as $$
  select p_dia - (extract(isodow from p_dia)::int - 1)
$$;

-- ---------------------------------------------------------------------
-- 2. La carrera de esta semana, en el microciclo que está haciendo
-- ---------------------------------------------------------------------
-- Paso a paso, como api.carreraAlDia (v0.218):
--   1. Las carreras de esta semana de su plan (carrera_semanas, por el lunes de hoy); las de descanso, ninguna.
--   2. Su bloque actual y su microciclo en curso: el primero publicado con algo pendiente que no sea una carrera (si no
--      queda, el último publicado).
--   3. Si el microciclo tiene la fecha de una semana anterior: sus carreras pendientes pasan a la semana publicada de
--      antes, sin día (si no hay, se quitan las que no tienen mensajes); a las hechas se les quita el día previsto; el
--      microciclo pasa a esta semana y los de detrás, a las siguientes (solo hacia delante). Si va por delante del
--      calendario: a la semana publicada con la fecha de esta (si no hay, el microciclo pasa a esta semana).
--   4. Lo que ya está puesto esta semana (en cualquier semana publicada de su bloque) no se repite: cada carrera del plan
--      busca su pareja por nombre y día y, si no, por nombre. Las que faltan van al microciclo, con su día si cae dentro.
-- Con p_refrescar (solo el coach, al cambiar el plan de esta semana), antes de buscar parejas se quitan las pendientes de
-- esta semana que no tengan mensajes (las hechas no se tocan).
-- Devuelve { puestas, quitadas, movida, semana } o { motivo } si no hace nada.
create or replace function public.carrera_al_dia(p_atleta uuid default null, p_refrescar boolean default false)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_coach boolean := public.es_coach();
  v_atleta uuid;
  v_dias smallint;
  v_carrera boolean;
  v_entreno boolean;
  v_estado text;
  v_lunes date := fbe_privado.lunes_de((now() at time zone 'Europe/Madrid')::date);
  v_plan jsonb;
  v_items jsonb := '[]'::jsonb;
  v_faltan jsonb := '[]'::jsonb;
  v_it jsonb;
  v_cardio jsonb;
  v_vale boolean;
  v_bloque uuid;
  v_actual public.semanas%rowtype;
  v_destino public.semanas%rowtype;
  v_previa public.semanas%rowtype;
  v_viejas uuid[];
  v_libres uuid[];
  v_par uuid;
  v_id uuid;
  v_orden int;
  v_n int;
  v_quitadas int := 0;
  v_puestas int := 0;
  v_movida boolean := false;
begin
  -- Quién: el coach, para cualquier atleta; el atleta, solo para sí mismo y sin refrescar
  if v_coach then
    if p_atleta is null then raise exception 'Falta el atleta' using errcode = '22023'; end if;
    v_atleta := p_atleta;
  else
    v_atleta := public.mi_atleta_id();
    if v_atleta is null or (p_atleta is not null and p_atleta <> v_atleta) then
      raise exception 'Solo puedes poner al día tu propia carrera' using errcode = '42501';
    end if;
    if p_refrescar then
      raise exception 'Solo el coach cambia la carrera de esta semana' using errcode = '42501';
    end if;
  end if;
  -- A quién le va: objetivo de días por semana, plan de carrera y entrenamiento (y, si llama el atleta, sin estar de baja)
  select dias_semana, carrera, entrenamiento, estado into v_dias, v_carrera, v_entreno, v_estado
  from public.atletas where id = v_atleta;
  if not found or v_dias is null or v_dias not between 1 and 7 or not coalesce(v_carrera, false)
     or v_entreno is not distinct from false or (not v_coach and v_estado = 'baja') then
    return jsonb_build_object('motivo', 'no-aplica');
  end if;
  -- Una cada vez por atleta (el móvil del atleta y la app del coach pueden llamarla a la vez)
  perform pg_advisory_xact_lock(hashtext('fbe-carrera-al-dia:' || v_atleta::text));

  -- 1. Las carreras de esta semana de su plan, como sesiones (sesionDesdePlan)
  select sesiones into v_plan from public.carrera_semanas where atleta_id = v_atleta and lunes = v_lunes;
  for v_it in select value from jsonb_array_elements(case when jsonb_typeof(v_plan) = 'array' then v_plan else '[]'::jsonb end) loop
    continue when v_it ->> 'tipo' = 'descanso' or not public.carrera_sesion_plan_valida(v_it);
    v_cardio := jsonb_build_object('modalidad', 'carrera') || (v_it - 'titulo' - 'dia');
    v_vale := public.cardio_pauta_valida(v_cardio, true);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'nombre', left(coalesce(v_it ->> 'titulo', 'Carrera ' || case v_it ->> 'tipo' when 'facil' then 'fácil'
        when 'recuperacion' then 'recuperación' when 'tecnica' then 'técnica' else v_it ->> 'tipo' end), 60),
      'cardio', case when v_vale then v_cardio end,
      'dinamica', case when v_vale then null else v_it ->> 'nota' end,
      'fecha', case when jsonb_typeof(v_it -> 'dia') = 'number' then v_lunes + ((v_it ->> 'dia')::int - 1) end));
  end loop;

  -- 2. Su bloque actual (el activo o ajustado; si no, el planificado más reciente; si no, el más reciente)
  select id into v_bloque from public.bloques
  where atleta_id = v_atleta and not es_plantilla and estado in ('activo', 'ajustado')
  order by fecha_inicio desc nulls last, coalesce(numero, 0) desc limit 1;
  if v_bloque is null then
    select id into v_bloque from public.bloques
    where atleta_id = v_atleta and not es_plantilla and estado = 'planificado'
    order by fecha_inicio desc nulls last, coalesce(numero, 0) desc limit 1;
  end if;
  if v_bloque is null then
    select id into v_bloque from public.bloques
    where atleta_id = v_atleta and not es_plantilla
    order by fecha_inicio desc nulls first, numero desc nulls first limit 1;
  end if;
  if v_bloque is null then return jsonb_build_object('motivo', 'sin-bloque'); end if;
  if not exists (select 1 from public.semanas where bloque_id = v_bloque and programacion = 'programada') then
    return jsonb_build_object('motivo', 'sin-publicar');
  end if;
  -- Su microciclo en curso: el primero publicado con algo pendiente que no sea una carrera; si no queda, el último publicado
  select w.* into v_actual from public.semanas w
  where w.bloque_id = v_bloque and w.programacion = 'programada'
    and exists (select 1 from public.sesiones s where s.semana_id = w.id and not s.completada and not fbe_privado.es_carrera(s.tipo, s.cardio))
  order by w.numero limit 1;
  if not found then
    select w.* into v_actual from public.semanas w
    where w.bloque_id = v_bloque and w.programacion = 'programada'
    order by w.numero desc limit 1;
  end if;
  v_destino := v_actual;

  -- Sin carreras en su plan esta semana, nada se mueve (al refrescar, solo se quitan las pendientes de esta semana)
  if jsonb_array_length(v_items) = 0 then
    if not p_refrescar then return jsonb_build_object('motivo', 'sin-carreras'); end if;
    delete from public.sesiones s using public.semanas w
    where w.id = s.semana_id and w.bloque_id = v_bloque and w.programacion = 'programada'
      and fbe_privado.es_carrera(s.tipo, s.cardio) and not s.completada
      and fbe_privado.lunes_de(coalesce(s.dia_previsto, w.fecha_inicio)) = v_lunes
      and not exists (select 1 from public.comentarios c where c.sesion_id = s.id);
    get diagnostics v_quitadas = row_count;
    return jsonb_build_object('puestas', 0, 'quitadas', v_quitadas, 'movida', false, 'semana', null);
  end if;

  -- 3. El microciclo, a esta semana
  if v_actual.fecha_inicio is null or fbe_privado.lunes_de(v_actual.fecha_inicio) < v_lunes then
    -- Sus carreras pendientes (de una semana pasada): a la semana publicada de antes, sin día (desde Semana se pueden
    -- apuntar aún y sus mensajes siguen ahí); sin ninguna antes, se quitan las que no tienen mensajes
    select array_agg(s.id order by s.orden) into v_viejas from public.sesiones s
    where s.semana_id = v_actual.id and fbe_privado.es_carrera(s.tipo, s.cardio) and not s.completada;
    if v_viejas is not null then
      select w.* into v_previa from public.semanas w
      where w.bloque_id = v_bloque and w.programacion = 'programada' and w.numero < v_actual.numero
      order by w.numero desc limit 1;
      if found then
        select coalesce(max(orden), 0) into v_orden from public.sesiones where semana_id = v_previa.id;
        foreach v_id in array v_viejas loop
          v_orden := v_orden + 1;
          update public.sesiones set semana_id = v_previa.id, orden = v_orden, dia_previsto = null where id = v_id;
        end loop;
      else
        delete from public.sesiones s
        where s.id = any (v_viejas) and not exists (select 1 from public.comentarios c where c.sesion_id = s.id);
      end if;
      v_quitadas := cardinality(v_viejas);
    end if;
    -- Las hechas pierden el día previsto (no se mueven con la semana: cuentan por el día que las hizo)
    update public.sesiones s set dia_previsto = null
    where s.semana_id = v_actual.id and fbe_privado.es_carrera(s.tipo, s.cardio) and s.completada and s.dia_previsto is not null;
    update public.semanas set fecha_inicio = v_lunes where id = v_actual.id;
    v_actual.fecha_inicio := v_lunes;
    v_movida := true;
    -- Las de detrás, a las semanas siguientes (solo hacia delante: nunca a una fecha anterior a la que tienen)
    update public.semanas w set fecha_inicio = v_lunes + 7 * (w.numero - v_actual.numero)
    where w.bloque_id = v_bloque and w.numero > v_actual.numero
      and (w.fecha_inicio is null or w.fecha_inicio < v_lunes + 7 * (w.numero - v_actual.numero));
    v_destino := v_actual;
  elsif fbe_privado.lunes_de(v_actual.fecha_inicio) > v_lunes then
    -- Va por delante del calendario: a la publicada con la fecha de esta; si no hay, el microciclo pasa a esta semana
    select w.* into v_destino from public.semanas w
    where w.bloque_id = v_bloque and w.programacion = 'programada' and fbe_privado.lunes_de(w.fecha_inicio) = v_lunes
    order by w.numero limit 1;
    if not found then
      update public.semanas set fecha_inicio = v_lunes where id = v_actual.id;
      v_actual.fecha_inicio := v_lunes;
      v_movida := true;
      v_destino := v_actual;
    end if;
  end if;

  -- 4. Lo que ya está puesto esta semana (las pendientes, por su día o el de su semana; las hechas, por el día que las hizo)
  if p_refrescar then
    -- (las que tienen mensajes se quedan: borrar la sesión se llevaría sus mensajes del chat)
    delete from public.sesiones s using public.semanas w
    where w.id = s.semana_id and w.bloque_id = v_bloque and w.programacion = 'programada'
      and fbe_privado.es_carrera(s.tipo, s.cardio) and not s.completada
      and fbe_privado.lunes_de(coalesce(s.dia_previsto, w.fecha_inicio)) = v_lunes
      and not exists (select 1 from public.comentarios c where c.sesion_id = s.id);
    get diagnostics v_n = row_count;
    v_quitadas := v_quitadas + v_n;
  end if;
  select coalesce(array_agg(x.id order by x.sin_dia, x.dia, x.numero, x.orden), '{}') into v_libres from (
    select s.id, s.dia_previsto is null as sin_dia, s.dia_previsto as dia, w.numero, s.orden
    from public.sesiones s join public.semanas w on w.id = s.semana_id
    where w.bloque_id = v_bloque and w.programacion = 'programada' and fbe_privado.es_carrera(s.tipo, s.cardio)
      and fbe_privado.lunes_de(case when s.completada and s.fecha_realizada is not null then s.fecha_realizada
                                    else coalesce(s.dia_previsto, w.fecha_inicio) end) = v_lunes
  ) x;
  -- Cada carrera del plan, con su pareja ya puesta (mismo nombre y día; si no, mismo nombre), una vez cada una
  for v_it in select value from jsonb_array_elements(v_items) loop
    v_par := null;
    select u.id into v_par from unnest(v_libres) with ordinality as u(id, n) join public.sesiones s on s.id = u.id
    where s.nombre = v_it ->> 'nombre'
      and (v_it ->> 'fecha' is null or coalesce(s.dia_previsto, s.fecha_realizada) = (v_it ->> 'fecha')::date)
    order by u.n limit 1;
    if v_par is null then
      select u.id into v_par from unnest(v_libres) with ordinality as u(id, n) join public.sesiones s on s.id = u.id
      where s.nombre = v_it ->> 'nombre'
      order by u.n limit 1;
    end if;
    if v_par is null then
      v_faltan := v_faltan || jsonb_build_array(v_it);
    else
      v_libres := array_remove(v_libres, v_par);
    end if;
  end loop;
  if jsonb_array_length(v_faltan) = 0 then
    return jsonb_build_object('puestas', 0, 'quitadas', v_quitadas, 'movida', v_movida, 'semana', v_destino.numero);
  end if;
  -- Las que faltan, al microciclo (con su día, si cae dentro de su semana)
  select coalesce(max(orden), 0) into v_orden from public.sesiones where semana_id = v_destino.id;
  for v_it in select value from jsonb_array_elements(v_faltan) loop
    v_orden := v_orden + 1;
    insert into public.sesiones (semana_id, orden, nombre, tipo, cardio, dinamica, dia_previsto)
    values (v_destino.id, v_orden, v_it ->> 'nombre', 'cardio', nullif(v_it -> 'cardio', 'null'::jsonb), v_it ->> 'dinamica',
      case when v_it ->> 'fecha' is not null and v_destino.fecha_inicio is not null
             and (v_it ->> 'fecha')::date between v_destino.fecha_inicio and v_destino.fecha_inicio + 6
           then (v_it ->> 'fecha')::date end);
    v_puestas := v_puestas + 1;
  end loop;
  return jsonb_build_object('puestas', v_puestas, 'quitadas', v_quitadas, 'movida', v_movida, 'semana', v_destino.numero);
end $$;
comment on function public.carrera_al_dia(uuid, boolean) is 'La carrera de esta semana de su plan, en el microciclo que está haciendo (088). El coach, para cualquier atleta; el atleta, para sí mismo.';

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 087)
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

insert into public.fbe_migraciones (numero) values (88)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
