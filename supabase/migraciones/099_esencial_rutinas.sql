-- =====================================================================
-- FBE Equipo, migración 099: FBE Esencial, el catálogo de rutinas de quien va por su cuenta
--
-- Por qué (las 60 mejoras «sin coach», tanda 3, encargo de Pelayo del 25/11/2026):
--   * Además de la rutina que le toca con su cuestionario, quien va por su cuenta ve dos o tres rutinas recomendadas de la
--     biblioteca de plantillas (el algoritmo va en la app: logica/esencial-catalogo.js) y puede elegir otra del catálogo.
--   * bloques.esencial_catalogo: qué plantillas están en el catálogo (de entrada, las 63 de la biblioteca de Pelayo; él
--     puede sacar o meter cada una desde Plantillas).
--   * atletas.esencial_plantilla (y esencial_plantilla_en): la rutina que ha elegido. cuestionarios.gustos: sus respuestas a
--     «Tus gustos» (si entrena ahora, cómo se maneja, qué prioriza, otro deporte, 60 años o más). Nada de salud.
--   * esencial_catalogo(): las rutinas del catálogo con sus días y sus ejercicios (para la ficha de cada una). Solo quien
--     va por su cuenta o el coach.
--   * esencial_elegir_rutina(p_nombre, p_atleta): apunta la que elige (o ninguna). Se aplica al asignarle el plan o, si ya
--     tiene uno, desde la semana siguiente que le prepare la app; nunca a mitad de «Primeras 4 semanas».
--   * esencial_asignar_plan: la de la 097 con la criba (quien nunca ha entrenado, o lleva menos de un año y está parado o
--     no se maneja con los movimientos, empieza por «Primeras 4 semanas»; los demás, con la rutina elegida o la de su
--     cuestionario) y, en las plantillas de la biblioteca (que no llevan esfuerzo), «te sobran 2-3» de partida.
--   * esencial_semana_siguiente: la de la 096 con el cambio a la rutina elegida (con sus kilos en los ejercicios que repite).
--   Para quien lleva seguimiento no cambia nada.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 098 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 99 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 099 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 99;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 98) then  -- (2) la anterior
    raise exception 'Falta la migración 098 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Las columnas
-- ---------------------------------------------------------------------
alter table public.bloques add column if not exists esencial_catalogo boolean not null default false;
alter table public.atletas add column if not exists esencial_plantilla text;
alter table public.atletas add column if not exists esencial_plantilla_en timestamptz;
alter table public.cuestionarios add column if not exists gustos jsonb;
alter table public.cuestionarios drop constraint if exists cuestionarios_gustos_check;
alter table public.cuestionarios add constraint cuestionarios_gustos_check
  check (gustos is null or (jsonb_typeof(gustos) = 'object' and pg_column_size(gustos) < 1000));
alter table public.atletas drop constraint if exists atletas_esencial_plantilla_check;
alter table public.atletas add constraint atletas_esencial_plantilla_check check (esencial_plantilla is null or char_length(esencial_plantilla) between 1 and 120);

-- De entrada, en el catálogo: las 63 plantillas de la biblioteca (solo la primera vez: después manda lo que elija el coach)
do $$
begin
  if not exists (select 1 from public.bloques where es_plantilla and esencial_catalogo) then
    update public.bloques set esencial_catalogo = true where es_plantilla and nombre in (
    'Primeras 4 semanas',
    'Novato 2 días · FBE Esencial',
    'Novato 3 días · FBE Esencial',
    '2 días · Full body · A · Barra y básicos',
    '2 días · Full body · B · Máquinas y mancuernas',
    '2 días · Full body · C · Énfasis glúteo y pierna',
    '2 días · Full body en casa, sin material',
    '2 días · De viaje (hotel, 25–30 minutos)',
    '2 días · Mantenimiento mínimo (40 minutos)',
    '2 días · Complemento a otro deporte (pádel, fútbol)',
    '3 días · Full body · A · Barra y básicos',
    '3 días · Full body · B · Máquinas y mancuernas',
    '3 días · Full body · C · Énfasis glúteo y pierna',
    '3 días · Full body A y B + torso · A · Barra y básicos',
    '3 días · Full body A y B + torso · B · Máquinas y mancuernas',
    '3 días · Full body A y B + torso · C · Énfasis glúteo y pierna',
    '3 días · Pierna, torso y full body · A · Barra y básicos',
    '3 días · Pierna, torso y full body · B · Máquinas y mancuernas',
    '3 días · Pierna, torso y full body · C · Énfasis glúteo y pierna',
    '3 días · Fuerza en básicos',
    '3 días · Calistenia básica',
    '3 días · Fuerza para corredores',
    '3 días · Full body con gomas',
    '3 días · Full body con mancuernas y banco',
    '3 días · Full body en casa, sin material',
    '3 días · Full body en estiramiento',
    '3 días · Iniciación en casa',
    '3 días · Iniciación en gimnasio, solo máquinas',
    '3 días · Salud y mayores de 60',
    '4 días · Torso-pierna · A · Barra y básicos',
    '4 días · Torso-pierna · B · Máquinas y mancuernas',
    '4 días · Torso-pierna · C · Énfasis glúteo y pierna',
    '4 días · Pierna, empuje, tirón + full body · A · Barra y básicos',
    '4 días · Pierna, empuje, tirón + full body · B · Máquinas y mancuernas',
    '4 días · Pierna, empuje, tirón + full body · C · Énfasis glúteo y pierna',
    '4 días · Empuje, tirón, pierna + torso · A · Barra y básicos',
    '4 días · Empuje, tirón, pierna + torso · B · Máquinas y mancuernas',
    '4 días · Empuje, tirón, pierna + torso · C · Énfasis glúteo y pierna',
    '4 días · PHUL (fuerza e hipertrofia)',
    '4 días · Anterior-posterior',
    '4 días · Full body de alta frecuencia',
    '4 días · Fuerza en básicos con variantes',
    '4 días · Torso-pierna con gomas y peso corporal',
    '4 días · Torso-pierna con mancuernas y banco',
    '4 días · Especialización de espalda',
    '4 días · Especialización de pecho',
    '4 días · Especialización de hombro y brazos',
    '4 días · Especialización de pierna (cuádriceps e isquios)',
    '4 días · Especialización de glúteo',
    '5 días · PPL + torso-pierna · A · Barra y básicos',
    '5 días · PPL + torso-pierna · B · Máquinas y mancuernas',
    '5 días · PPL + torso-pierna · C · Énfasis glúteo y pierna',
    '5 días · PHAT · A · Barra y básicos',
    '5 días · PHAT · B · Máquinas y mancuernas',
    '5 días · PHAT · C · Énfasis glúteo y pierna',
    '5 días · Density · A · Barra y básicos',
    '5 días · Density · B · Máquinas y mancuernas',
    '5 días · Density · C · Énfasis glúteo y pierna',
    '5 días · Torso-pierna + full body',
    '6 días · PPL ×2 · A · Barra y básicos',
    '6 días · PPL ×2 · B · Máquinas y mancuernas',
    '6 días · PPL ×2 · C · Énfasis glúteo y pierna',
    '6 días · Arnold (pecho-espalda, hombro-brazos, pierna)');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. El catálogo, para la ficha de cada rutina
-- ---------------------------------------------------------------------
-- [{ nombre, dias, sesiones: [{ orden, nombre, ejercicios: [{ nombre, series, reps_min, reps_max, por_tiempo }] }] }]
create or replace function public.esencial_catalogo() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_id uuid := public.mi_atleta_id();
begin
  if not public.es_coach() and not exists (select 1 from public.atletas a where a.id = v_id and a.modalidad = 'por_su_cuenta') then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('nombre', b.nombre,
        'dias', (select count(*) from public.sesiones s where s.semana_id = w.id),
        'sesiones', coalesce((select jsonb_agg(jsonb_build_object('orden', s.orden, 'nombre', s.nombre,
            'ejercicios', coalesce((select jsonb_agg(jsonb_build_object('nombre', e.nombre, 'series', x.series, 'reps_min', x.reps_min, 'reps_max', x.reps_max,
                'por_tiempo', coalesce(e.por_tiempo, false)) order by x.orden)
              from public.sesion_ejercicios x join public.ejercicios e on e.id = x.ejercicio_id where x.sesion_id = s.id), '[]'::jsonb)) order by s.orden)
          from public.sesiones s where s.semana_id = w.id), '[]'::jsonb)) order by b.nombre)
    from public.bloques b
    join lateral (select w0.id from public.semanas w0 where w0.bloque_id = b.id order by w0.numero limit 1) w on true
    where b.es_plantilla and b.esencial_catalogo
      and b.id = (select b2.id from public.bloques b2 where b2.es_plantilla and b2.nombre = b.nombre order by b2.creado_en limit 1)
  ), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- 3. Elegir rutina
-- ---------------------------------------------------------------------
-- p_nombre: una del catálogo (menos «Primeras 4 semanas», a la que se llega al empezar) o null (ninguna: sigue con la suya).
create or replace function public.esencial_elegir_rutina(p_nombre text, p_atleta uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := coalesce(p_atleta, public.mi_atleta_id());
  v_at public.atletas;
begin
  if v_id is null then raise exception 'No hay atleta' using errcode = 'P0002'; end if;
  if not public.es_coach() and public.mi_atleta_id() is distinct from v_id then
    raise exception 'Solo puedes elegir tu propia rutina' using errcode = '42501';
  end if;
  select * into v_at from public.atletas where id = v_id;
  if not found then raise exception 'Ese atleta no existe' using errcode = 'P0002'; end if;
  if v_at.modalidad <> 'por_su_cuenta' then raise exception 'Solo para quien va por su cuenta (FBE Esencial)' using errcode = '22023'; end if;
  if v_at.estado <> 'activo' then raise exception 'Su cuenta no está activa' using errcode = '22023'; end if;
  if p_nombre is null or btrim(p_nombre) = '' then
    update public.atletas set esencial_plantilla = null, esencial_plantilla_en = null where id = v_id;
    return jsonb_build_object('rutina', null);
  end if;
  if p_nombre = 'Primeras 4 semanas' or not exists (select 1 from public.bloques b where b.es_plantilla and b.esencial_catalogo and b.nombre = p_nombre) then
    raise exception 'Esa rutina no está en el catálogo' using errcode = '22023';
  end if;
  update public.atletas set esencial_plantilla = p_nombre, esencial_plantilla_en = now(),
    esencial_dias = case p_nombre when 'Novato 3 días · FBE Esencial' then 3 when 'Novato 2 días · FBE Esencial' then 2 else esencial_dias end
  where id = v_id;
  return jsonb_build_object('rutina', p_nombre);
end $$;

-- ---------------------------------------------------------------------
-- 4. Asignar el plan: la de la 097, con la criba, la rutina elegida y el esfuerzo de partida
-- ---------------------------------------------------------------------
create or replace function public.esencial_asignar_plan(p_atleta uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := coalesce(p_atleta, public.mi_atleta_id());
  v_at public.atletas;
  v_c public.cuestionarios;
  v_nombre text;
  v_pl uuid;
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_lunes date;
  v_inicio date;
  v_bloque uuid;
begin
  if v_id is null then raise exception 'No hay atleta' using errcode = 'P0002'; end if;
  if not public.es_coach() and public.mi_atleta_id() is distinct from v_id then
    raise exception 'Solo puedes pedir tu propio plan' using errcode = '42501';
  end if;
  select * into v_at from public.atletas where id = v_id;
  if not found then raise exception 'Ese atleta no existe' using errcode = 'P0002'; end if;
  if v_at.modalidad <> 'por_su_cuenta' then raise exception 'Solo para quien va por su cuenta (FBE Esencial)' using errcode = '22023'; end if;
  -- Ya tiene su plan
  select id into v_bloque from public.bloques where atleta_id = v_id and not es_plantilla and estado in ('activo', 'ajustado', 'planificado') order by fecha_inicio desc nulls last limit 1;
  if v_bloque is not null then
    return jsonb_build_object('bloque', v_bloque, 'nuevo', false);
  end if;
  select * into v_c from public.cuestionarios where atleta_id = v_id;
  if not found or v_c.completado_en is null or v_c.resultado is null then
    raise exception 'Antes, el cuestionario (con la parte de salud)' using errcode = '22023';
  end if;
  if v_c.resultado <> 'sin_valoracion' and v_at.visto_bueno_en is null then
    raise exception 'Antes de empezar, el visto bueno médico' using errcode = '22023';
  end if;
  -- (099) La criba: quien nunca ha entrenado, o lleva menos de un año y está parado o no se maneja con los movimientos:
  -- «Primeras 4 semanas». Los demás: la rutina que hayan elegido de su catálogo; sin elegir, la de su cuestionario.
  if coalesce(v_c.experiencia, 'ninguna') = 'ninguna'
     or (v_c.experiencia = 'menos_1' and ((v_c.gustos ->> 'ahora') = 'parado' or (v_c.gustos ->> 'tecnica') = 'no')) then
    v_nombre := 'Primeras 4 semanas';
  else
    v_nombre := coalesce(
      (select b.nombre from public.bloques b where b.es_plantilla and b.esencial_catalogo and b.nombre = v_at.esencial_plantilla
         and b.nombre <> 'Primeras 4 semanas' limit 1),
      fbe_privado.esencial_plantilla(v_c.experiencia, v_c.dias_semana, v_c.lugar, v_c.material));
  end if;
  select id into v_pl from public.bloques where es_plantilla and nombre = v_nombre order by creado_en limit 1;
  if v_pl is null then
    select id into v_pl from public.bloques where es_plantilla and nombre = 'Primeras 4 semanas' order by creado_en limit 1;
  end if;
  if v_pl is null then raise exception 'No está la plantilla «Primeras 4 semanas»' using errcode = 'P0002'; end if;
  -- Su lunes: el de su tanda si aún no ha llegado; si ya llegó (esta semana) o pasó, este lunes (de lunes a miércoles) o el
  -- siguiente; sin tanda, el próximo lunes
  v_lunes := fbe_privado.lunes_de(v_hoy);
  v_inicio := case when v_at.esencial_inicio is null then case when v_hoy = v_lunes then v_hoy else v_lunes + 7 end
                   when v_at.esencial_inicio > v_lunes then v_at.esencial_inicio
                   -- (097) su lunes ya ha llegado (esta semana) o pasó: este lunes hasta el miércoles; desde el jueves, el
                   -- siguiente (sin una semana 1 perdida)
                   when v_hoy - v_lunes <= 2 then v_lunes
                   else v_lunes + 7 end;
  v_bloque := fbe_privado.esencial_copiar_plantilla(v_pl, v_id, v_inicio);
  -- (099) las plantillas de la biblioteca no llevan esfuerzo: de partida, «te sobran 2-3» (menos en lo que va por tiempo)
  update public.sesion_ejercicios x set rir_objetivo = 2.5
  from public.sesiones s, public.semanas w, public.ejercicios e
  where s.id = x.sesion_id and w.id = s.semana_id and w.bloque_id = v_bloque and e.id = x.ejercicio_id
    and x.rir_objetivo is null and x.rpe_objetivo is null and not coalesce(e.por_tiempo, false);
  return jsonb_build_object('bloque', v_bloque, 'nuevo', true, 'plantilla', (select nombre from public.bloques where id = v_pl), 'inicio', v_inicio);
end $$;

-- ---------------------------------------------------------------------
-- 5. La semana siguiente: la de la 096, con el cambio a la rutina elegida
-- ---------------------------------------------------------------------
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
    elsif v_at.esencial_plantilla is not null and v_at.esencial_plantilla <> v_bloque.nombre
          and exists (select 1 from public.bloques b where b.es_plantilla and b.esencial_catalogo and b.nombre = v_at.esencial_plantilla) then
      -- (099) la rutina que ha elegido de su catálogo: desde cualquier plan, pero no a mitad de «Primeras 4 semanas»
      if v_bloque.nombre = 'Primeras 4 semanas' and not coalesce(v_base.marcas, false) then
        raise exception 'Hasta acabar tus cuatro primeras semanas no se cambia de rutina' using errcode = '22023';
      end if;
      v_destino := v_at.esencial_plantilla;
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
        -- (099) las plantillas de la biblioteca no llevan esfuerzo: de partida, «te sobran 2-3»
        if v_rir is null and v_rpe is null and not v_tiempo then v_rir := 2.5; end if;
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
-- 6. Permisos (como al final de 003 a 098)
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

insert into public.fbe_migraciones (numero) values (99)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
