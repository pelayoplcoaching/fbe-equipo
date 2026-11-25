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
--     tiene uno, desde la semana siguiente que le prepare la app; nunca a mitad de «Primeras 4 semanas». Lo que la app ya
--     le había preparado y aún no ha empezado (su plan antes de su lunes, o la semana que viene) se quita para rehacerlo
--     con ella: así empieza el lunes, no una semana después. Nunca con algo hecho o apuntado, ni en pausa o repetida.
--   * esencial_asignar_plan: la de la 097 con la criba (quien nunca ha entrenado, o lleva menos de un año y está parado o
--     no se maneja con los movimientos, empieza por «Primeras 4 semanas»; los demás, con la rutina elegida o la de su
--     cuestionario) y, en las plantillas de la biblioteca (que no llevan esfuerzo), «te sobran 2-3» de partida.
--   * esencial_semana_siguiente: la de la 096 con el cambio a la rutina elegida (con sus kilos en los ejercicios que repite).
--   * crear_recordatorios: la de la 098 con tres bloques más, para que nadie se quede sin plan por no elegir: «Te falta
--     elegir tu rutina» (desde el día siguiente al cuestionario, una vez), «Mañana empiezas: elige tu rutina» (la víspera
--     de su lunes, de 21:00 a 22:00) y, desde las 22:00, la app le deja el plan preparado (con la rutina de su
--     cuestionario) y se lo dice. Lo de asignar el plan va por dentro (fbe_privado.esencial_asignar), para que lo use.
--     Y el cierre del domingo de la 098 pasa de las 23:30 a las 22:00 (Pelayo, 25/11: así el aviso llega antes del «no
--     molestar» de serie, que empieza a las 22:30).
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
-- [{ nombre, dias, sesiones: [{ orden, nombre, ejercicios: [{ nombre, series, reps_min, reps_max, por_tiempo, descanso_seg, superserie }] }] }]
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
                'por_tiempo', coalesce(e.por_tiempo, false), 'descanso_seg', x.descanso_seg, 'superserie', x.superserie) order by x.orden)
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
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_b public.bloques;
  v_prev uuid;
  v_fut uuid[];
  v_n int;
  v_plan jsonb;
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
  -- Lo que la app ya le había preparado y aún no ha empezado se quita para rehacerlo con la rutina elegida. De su plan en
  -- marcha (el último), las semanas que empiezan después de hoy sin nada hecho ni apuntado y sin pausa ni repetición.
  -- No «Primeras 4 semanas»: a esa se llega por la criba y no se cambia hasta acabarla.
  select b.* into v_b from public.bloques b
  where b.atleta_id = v_id and not b.es_plantilla and b.estado in ('activo', 'ajustado', 'planificado')
  order by b.numero desc limit 1;
  if found and v_b.nombre <> 'Primeras 4 semanas' and v_b.nombre <> p_nombre then
    select coalesce(array_agg(w.id), '{}') into v_fut from public.semanas w
    where w.bloque_id = v_b.id and w.fecha_inicio > v_hoy and w.esencial_cierre is null
      and not exists (select 1 from public.sesiones s where s.semana_id = w.id and (s.completada or s.fecha_realizada is not null))
      and not exists (select 1 from public.series r join public.sesion_ejercicios x on x.id = r.sesion_ejercicio_id
                      join public.sesiones s on s.id = x.sesion_id where s.semana_id = w.id);
    select count(*) into v_n from public.semanas w where w.bloque_id = v_b.id;
    if v_n > 0 and cardinality(v_fut) = v_n then
      -- Su plan entero está por empezar. Si es el primero, se rehace aquí con la elegida; si viene de otro (acabó
      -- «Primeras 4 semanas» o cambió de rutina y la semana anterior es la de antes), vuelve a ese y la app lo prepara.
      select b.id into v_prev from public.bloques b
      where b.atleta_id = v_id and not b.es_plantilla and b.id <> v_b.id and b.estado = 'finalizado'
        and exists (select 1 from public.semanas w where w.bloque_id = b.id and w.fecha_inicio = v_b.fecha_inicio - 7)
      order by b.numero desc limit 1;
      if v_prev is not null or (select count(*) from public.bloques b where b.atleta_id = v_id and not b.es_plantilla) = 1 then
        delete from public.notificaciones n where n.estado = 'pendiente'
          and n.clave in (select 'semana:' || w.id from public.semanas w where w.bloque_id = v_b.id);
        delete from public.bloques where id = v_b.id;
        if v_prev is null then
          v_plan := public.esencial_asignar_plan(v_id);
          return jsonb_build_object('rutina', p_nombre, 'rehecho', true, 'bloque', v_plan -> 'bloque');
        end if;
        update public.bloques set estado = 'activo' where id = v_prev;
        return jsonb_build_object('rutina', p_nombre, 'rehecho', true, 'preparar', true);
      end if;
    elsif cardinality(v_fut) > 0 then
      -- La semana que viene, ya preparada con la rutina de ahora
      delete from public.notificaciones n where n.estado = 'pendiente' and n.clave in (select 'semana:' || x from unnest(v_fut) x);
      delete from public.semanas where id = any(v_fut);
      update public.bloques set fecha_fin = (select max(w.fecha_inicio) + 6 from public.semanas w where w.bloque_id = v_b.id) where id = v_b.id;
      return jsonb_build_object('rutina', p_nombre, 'rehecho', true, 'preparar', true);
    end if;
  end if;
  return jsonb_build_object('rutina', p_nombre);
end $$;

-- ---------------------------------------------------------------------
-- 4. Asignar el plan: la de la 097, con la criba, la rutina elegida y el esfuerzo de partida
-- ---------------------------------------------------------------------
-- Por dentro (sin mirar quién llama; p_hoy, para las pruebas y para crear_recordatorios): la usan la de fuera y el aviso
-- de la víspera, que deja el plan preparado a quien no ha elegido
create or replace function fbe_privado.esencial_asignar(p_id uuid, p_hoy date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := p_id;
  v_at public.atletas;
  v_c public.cuestionarios;
  v_nombre text;
  v_pl uuid;
  v_hoy date := coalesce(p_hoy, (now() at time zone 'Europe/Madrid')::date);
  v_lunes date;
  v_inicio date;
  v_bloque uuid;
begin
  if v_id is null then raise exception 'No hay atleta' using errcode = 'P0002'; end if;
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

-- La de fuera: cada uno, el suyo (o el coach)
create or replace function public.esencial_asignar_plan(p_atleta uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := coalesce(p_atleta, public.mi_atleta_id());
begin
  if v_id is null then raise exception 'No hay atleta' using errcode = 'P0002'; end if;
  if not public.es_coach() and public.mi_atleta_id() is distinct from v_id then
    raise exception 'Solo puedes pedir tu propio plan' using errcode = '42501';
  end if;
  return fbe_privado.esencial_asignar(v_id);
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
-- 6. Los avisos: crear_recordatorios, la de la 098 con tres bloques más al final (elegir rutina y el plan de la víspera)
-- ---------------------------------------------------------------------
create or replace function public.crear_recordatorios(p_ahora timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_local timestamp := p_ahora at time zone 'Europe/Madrid';
  v_hoy date := (p_ahora at time zone 'Europe/Madrid')::date;
  v_dow integer := extract(isodow from (p_ahora at time zone 'Europe/Madrid'))::integer;
  v_lunes date;
  v_n integer := 0;
  v_m integer;
  v_titulo text;
  v_cuerpo text;
  v_r record;
  v_plan jsonb;
begin
  perform fbe_privado.solo_servidor();
  v_lunes := v_hoy - (v_dow - 1);

  -- Hoy toca… (solo si planificó el día de la sesión en «Tu plan»). Cada consulta elige primero a quién
  -- (materialized: así la notificación solo se crea para esas filas, sin depender del orden del WHERE)
  with x as materialized (
    select d.perfil_id, d.hora_manana, count(*) as n, min(s.nombre) as nombre
    from fbe_privado.destinatarios d
    join public.atletas a on a.id = d.atleta_id and a.entrenamiento
    join public.bloques b on b.atleta_id = d.atleta_id and not b.es_plantilla and b.estado not in ('cancelado', 'finalizado')
    join public.semanas w on w.bloque_id = b.id and w.programacion = 'programada'
    join public.sesiones s on s.semana_id = w.id and s.dia_previsto = v_hoy and not s.completada
    where not ('sesion_hoy' = any (d.desactivados))
      and v_local >= v_hoy + d.hora_manana and v_local < v_hoy + d.hora_manana + interval '2 hours'
    group by d.perfil_id, d.hora_manana
  )
  select count(*) into v_m from x
  where fbe_privado.notificar_seguro(x.perfil_id, 'sesion_hoy',
          case when x.n = 1 then 'Hoy toca ' || x.nombre else 'Hoy tienes ' || x.n || ' sesiones' end,
          case when x.n = 1 then 'La tienes en Hoy.' else 'Las tienes en Hoy.' end,
          '#hoy', 'recordatorio_sesion:' || v_hoy, p_ahora,
          (v_hoy + x.hora_manana + interval '4 hours') at time zone 'Europe/Madrid');
  v_n := v_n + v_m;

  -- El check-in de la semana (el lunes, el de la semana que acaba de terminar, como en la app)
  with d as materialized (
    select d.perfil_id, d.hora_tarde from fbe_privado.destinatarios d
    where d.salud and not ('checkin' = any (d.desactivados)) and d.dia_checkin = v_dow
      and v_local >= v_hoy + d.hora_tarde and v_local < v_hoy + d.hora_tarde + interval '2 hours'
      and not exists (select 1 from public.checkins c
                      where c.atleta_id = d.atleta_id and c.semana_inicio = case when v_dow = 1 then v_lunes - 7 else v_lunes end)
  )
  select count(*) into v_m from d
  where fbe_privado.notificar_seguro(d.perfil_id, 'checkin', '¿Haces el check-in?',
          case when v_dow = 1 then 'El de la semana pasada aún está pendiente.' else 'El de esta semana aún está pendiente.' end,
          '#checkin', 'recordatorio_checkin:' || v_hoy, p_ahora,
          (v_hoy + d.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
  v_n := v_n + v_m;

  -- Por la tarde, una sola: los hábitos que hoy le hacen falta (los diarios sin apuntar y los de x días a la
  -- semana que ya no llegan si se salta hoy) y la nutrición sin apuntar (si tiene plan)
  with x as materialized (
    select * from (
    select d.perfil_id, d.hora_tarde,
      case when 'habitos' = any (d.desactivados) then 0 else (
        select count(*) from public.habitos h
        where h.atleta_id = d.atleta_id and h.activo
          and not exists (select 1 from public.registros_habito r where r.habito_id = h.id and r.fecha = v_hoy)
          and h.dias_semana - (
            select count(*) from public.registros_habito r
            where r.habito_id = h.id and r.fecha >= v_lunes and r.fecha < v_hoy
              and case when h.tipo = 'si_no' then r.valor >= 1
                       when h.sentido = 'al_menos' then r.valor >= h.objetivo
                       else r.valor <= h.objetivo end
          ) >= 8 - v_dow
      ) end as habitos,
      not ('nutricion' = any (d.desactivados))
        and exists (select 1 from public.planes_nutricion pn where pn.atleta_id = d.atleta_id and pn.desde <= v_hoy)
        and exists (select 1 from public.atletas a where a.id = d.atleta_id and a.nutricion)
        and not exists (select 1 from public.registros_nutricion rn where rn.atleta_id = d.atleta_id and rn.fecha = v_hoy) as nutricion
    from fbe_privado.destinatarios d
    where d.salud and v_local >= v_hoy + d.hora_tarde and v_local < v_hoy + d.hora_tarde + interval '2 hours'
    ) y
    where y.habitos > 0 or y.nutricion
  )
  select count(*) into v_m from x
  where fbe_privado.notificar_seguro(x.perfil_id, case when x.habitos > 0 then 'habitos' else 'nutricion' end,
          case when x.habitos > 0 and x.nutricion then
                 case when x.habitos = 1 then 'Te queda un hábito y la nutrición de hoy' else 'Te quedan ' || x.habitos || ' hábitos y la nutrición de hoy' end
               when x.habitos = 1 then 'Te queda un hábito de hoy'
               when x.habitos > 1 then 'Te quedan ' || x.habitos || ' hábitos de hoy'
               else '¿Apuntas lo que has comido hoy?' end,
          case when x.habitos > 0 then 'Apúntalo en Hoy antes de que acabe el día.' else 'Aún no has apuntado la nutrición de hoy.' end,
          '#hoy', 'recordatorio_tarde:' || v_hoy, p_ahora,
          (v_hoy + x.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
  v_n := v_n + v_m;

  -- (v0.69, 041) El domingo por la tarde, el resumen de la semana del equipo (una vez: la clave lleva el día)
  -- (revisión) en su propio bloque: si algo falla aquí, no se pierden los demás recordatorios de esa pasada
  begin
  if v_dow = 7 and v_local >= v_hoy + time '19:00' and v_local < v_hoy + time '22:00' and public.comunidad_activa() then
    select t.titulo, t.cuerpo into v_titulo, v_cuerpo
    from fbe_privado.comunidad_resumen_de_la_semana() r
    cross join lateral public.comunidad_texto_resumen(r.sesiones, r.records, r.semana_completa) t;
    if v_titulo is not null then
      with x as materialized (
        select d.perfil_id from fbe_privado.comunidad_dentro d
        union
        select p.id from public.perfiles p where p.rol = 'coach'
      )
      select count(*) into v_m from x
      where fbe_privado.notificar_seguro(x.perfil_id, 'comunidad', v_titulo, v_cuerpo, '#equipo', 'comunidad_resumen:' || v_hoy, p_ahora,
              (v_hoy + time '23:00') at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  end if;
  exception when others then
    raise warning 'FBE: resumen del domingo no creado: %', sqlerrm;
  end;

  -- (v0.70, 042) El sábado por la tarde, a quien aún no ha completado su semana y su compañero de racha sí (también en su
  -- propio bloque: si falla, los demás recordatorios se crean igual)
  begin
  if v_dow = 6 and v_local >= v_hoy + time '19:00' and v_local < v_hoy + time '22:00' and public.comunidad_activa() then
    with sem as materialized (
      select x.atleta_id, x.hechas >= x.previstas as completa
      from fbe_privado.comunidad_semanas_de(array(select d.atleta_id from fbe_privado.comunidad_dentro d
                                                  where exists (select 1 from public.comunidad_companeros c where c.estado = 'aceptada' and d.perfil_id in (c.de, c.para)))) x
      where x.lunes = v_lunes
    ), x as materialized (
      select c.id, a.perfil_id as falta, b.perfil_id as hecho
      from public.comunidad_companeros c
      join fbe_privado.comunidad_dentro a on a.perfil_id in (c.de, c.para)
      join fbe_privado.comunidad_dentro b on b.perfil_id in (c.de, c.para) and b.perfil_id <> a.perfil_id
      join sem sa on sa.atleta_id = a.atleta_id and not sa.completa
      join sem sb on sb.atleta_id = b.atleta_id and sb.completa
      where c.estado = 'aceptada'
        -- (a uno solo de los dos por pareja y semana)
        and not exists (select 1 from public.notificaciones n where n.clave = 'comunidad_pareja:' || c.id || ':' || v_lunes)
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.falta, 'comunidad', fbe_privado.comunidad_nombre(x.hecho) || ' ya ha completado su semana: ¿cerráis la racha?',
            'Míralo en Equipo.', '#equipo', 'comunidad_pareja:' || x.id || ':' || v_lunes, p_ahora,
            (v_hoy + 1 + time '22:00') at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  end if;
  exception when others then
    raise warning 'FBE: aviso del sábado a las parejas no creado: %', sqlerrm;
  end;
  -- (v0.72, 044) Dos horas antes de un evento, a quien va (y sigue dentro): «A las 19:00: Quedada en el Retiro». Una vez por
  -- persona, evento y hora (si cambia la hora, otro); caduca al empezar. En su propio bloque, como los dos de antes
  begin
  if public.comunidad_activa() then
    with x as materialized (
      select a.perfil_id, e.id, e.titulo, e.empieza_en
      from public.comunidad_eventos e
      join public.comunidad_evento_asistentes a on a.evento_id = e.id and a.va
      join fbe_privado.comunidad_dentro d on d.perfil_id = a.perfil_id
      where e.cancelado_en is null and e.empieza_en > p_ahora and e.empieza_en <= p_ahora + interval '2 hours'
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.perfil_id, 'comunidad', 'A las ' || to_char(x.empieza_en at time zone 'Europe/Madrid', 'FMHH24:MI') || ': ' || x.titulo,
            'Te has apuntado. Míralo en Equipo.', '#equipo', 'comunidad_evento:' || x.id || ':' || floor(extract(epoch from x.empieza_en))::bigint, p_ahora, x.empieza_en);
    v_n := v_n + v_m;
  end if;
  exception when others then
    raise warning 'FBE: recordatorio de los eventos no creado: %', sqlerrm;
  end;

  -- (v0.72, 044) Un aviso o una encuesta programados, al llegar su hora (en el último día): a los de dentro, como al publicarlo
  -- (029), con la misma clave (si se oculta o se borra antes de salir, se retira). En su propio bloque
  begin
  if public.comunidad_activa() then
    with x as materialized (
      select k.id, k.tipo, d.perfil_id,
             coalesce(fbe_privado.nombre_corto((select p.nombre from public.perfiles p where p.id = k.autor_id)), 'Tu coach') as quien
      from public.comunidad_posts k
      join fbe_privado.comunidad_dentro d on d.perfil_id <> k.autor_id
      join public.comunidad_miembros m on m.atleta_id = d.atleta_id
      where k.publicar_en is not null
        -- (solo a quien ya estaba dentro cuando salió: a quien entra después no le llega un aviso de ayer)
        and coalesce(m.entrado_en, m.creado_en) <= k.publicar_en and k.publicar_en <= p_ahora and k.publicar_en > p_ahora - interval '1 day'
        and k.tipo in ('aviso', 'encuesta') and not k.oculta
        and not exists (select 1 from public.notificaciones n where n.usuario_id = d.perfil_id and n.clave = 'comunidad_aviso:' || k.id)
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.perfil_id, 'comunidad',
            x.quien || case when x.tipo = 'encuesta' then ' ha publicado una encuesta en el equipo' else ' ha publicado un aviso en el equipo' end,
            case when x.tipo = 'encuesta' then 'Tócalo para votar en Equipo.' else 'Tócalo para leerlo en Equipo.' end,
            '#equipo', 'comunidad_aviso:' || x.id, p_ahora);
    v_n := v_n + v_m;
  end if;
  exception when others then
    raise warning 'FBE: aviso de lo programado no creado: %', sqlerrm;
  end;

  -- (v0.73, 045) El aniversario en FBE, en el muro, el mismo día (una vez por persona y aniversario). En su propio bloque
  begin
    perform fbe_privado.comunidad_crear_aniversarios(v_hoy);
  exception when others then
    raise warning 'FBE: aniversarios del muro no puestos: %', sqlerrm;
  end;

  -- (v0.73, 045) Al coach, el día antes (de 9:00 a 21:00, Madrid), quién cumple mañana 1 mes, 6 meses o años en FBE (de sus
  -- atletas activos, estén o no en la comunidad): «Mañana Lucía cumple 1 año en FBE 🎉». Una vez por atleta y día; lleva a su chat
  begin
  if v_local >= v_hoy + time '09:00' and v_local < v_hoy + time '21:00' then
    with x as materialized (
      select c.id as coach, a.id as atleta, coalesce(fbe_privado.nombre_corto(a.nombre), 'Alguien') as nombre, m.meses
      from public.atletas a
      join public.perfiles p on p.id = a.perfil_id and p.rol <> 'coach'
      cross join lateral (select public.comunidad_meses_aniversario(a.fecha_alta, v_hoy + 1) as meses) m
      cross join public.perfiles c
      where c.rol = 'coach' and a.estado <> 'baja' and m.meses is not null
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.coach, 'comunidad',
            'Mañana ' || x.nombre || ' cumple ' || case when x.meses = 1 then '1 mes' when x.meses < 12 then x.meses || ' meses' when x.meses = 12 then '1 año'
                                                       else (x.meses / 12) || ' años' end || ' en FBE 🎉',
            'Felicítale mañana en el chat o en Equipo.', '#mensajes/' || x.atleta, 'comunidad_aniversario:' || x.atleta || ':' || (v_hoy + 1), p_ahora,
            (v_hoy + 2) at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  end if;
  exception when others then
    raise warning 'FBE: aviso de los aniversarios al coach no creado: %', sqlerrm;
  end;

  -- (v0.73, 045) Los momentos de hace más de 24 horas se borran (y su foto va a la cola de Storage). En su propio bloque
  begin
    perform fbe_privado.comunidad_limpiar_momentos(p_ahora);
  exception when others then
    raise warning 'FBE: momentos caducados no borrados: %', sqlerrm;
  end;

  -- (054) Las sesiones que se quedaron sin cerrar (todas las series hechas, 3 horas sin tocar): se cierran solas y se avisa
  begin
    v_m := fbe_privado.sesiones_cerrar_solas(p_ahora);
    v_n := v_n + v_m;
  exception when others then
    raise warning 'FBE: sesiones sin cerrar no cerradas: %', sqlerrm;
  end;

  -- (054) Al coach, por la mañana (10 a 12), los vídeos de técnica que llevan 3 días o más sin revisar: un aviso al día
  begin
    if v_local::time between time '10:00' and time '12:00' then
      with x as materialized (
        select c.id as coach, count(*) as n, min(a.creado_en) as desde
        from public.perfiles c
        cross join public.archivos a
        join public.atletas t on t.id = a.atleta_id and t.estado <> 'baja'
        where c.rol = 'coach' and a.tipo = 'video_tecnica' and a.revisado_en is null and a.creado_en < p_ahora - interval '3 days'
          and not exists (select 1 from public.comentarios m where m.archivo_id = a.id and m.autor = 'coach' and m.eliminado_en is null)
        group by c.id
      )
      select count(*) into v_m from x
      where fbe_privado.notificar_seguro(x.coach, 'video_recibido',
              case when x.n = 1 then 'Un vídeo espera tu revisión' else x.n || ' vídeos esperan tu revisión' end,
              'El más antiguo, desde el ' || to_char(x.desde at time zone 'Europe/Madrid', 'FMDD/FMMM') || '. Los tienes en Revisar.',
              '#revisar', 'videos_pendientes:' || v_hoy, p_ahora, (v_hoy + 1) at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  exception when others then
    raise warning 'FBE: aviso de vídeos sin revisar no creado: %', sqlerrm;
  end;

  -- (094) FBE Esencial: a quien va por su cuenta, con su plan empezado hace una semana o más, a los 7 días sin entrenar,
  -- un aviso amable a su hora de la tarde. Uno por semana como mucho; con la preferencia de los recordatorios de entreno.
  begin
    with x as materialized (
      select d.perfil_id, d.hora_tarde
      from fbe_privado.destinatarios d
      join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
      where not ('sesion_hoy' = any (d.desactivados))
        and v_local >= v_hoy + d.hora_tarde and v_local < v_hoy + d.hora_tarde + interval '2 hours'
        and exists (select 1 from public.bloques b where b.atleta_id = d.atleta_id and not b.es_plantilla
                    and b.estado in ('activo', 'ajustado') and b.fecha_inicio <= v_hoy - 7)
        and coalesce((select max(s.fecha_realizada) from public.sesiones s join public.semanas w on w.id = s.semana_id
                      join public.bloques b on b.id = w.bloque_id
                      where b.atleta_id = d.atleta_id and not b.es_plantilla and s.completada), date '2000-01-01') <= v_hoy - 7
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.perfil_id, 'sesion_hoy', 'Tu semana sigue lista',
            'Llevas unos días sin entrenar: cuando puedas, retoma donde lo dejaste.',
            '#hoy', 'esencial_retomar:' || v_lunes, p_ahora,
            (v_hoy + x.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  exception when others then
    raise warning 'FBE: aviso de FBE Esencial a los 7 días sin entrenar no creado: %', sqlerrm;
  end;

  -- (095) FBE Esencial, antes de empezar: a quien ya activó su cuenta y aún no ha enviado el cuestionario, en los 5 días
  -- antes de su lunes de inicio, un aviso a su hora de la mañana. Uno por tanda; con la preferencia del cuestionario.
  begin
    with x as materialized (
      select d.perfil_id, d.hora_manana, a.esencial_inicio
      from fbe_privado.destinatarios d
      join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta'
      where not ('cuestionario' = any (d.desactivados))
        and a.esencial_inicio > v_hoy and a.esencial_inicio <= v_hoy + 5
        and v_local >= v_hoy + d.hora_manana and v_local < v_hoy + d.hora_manana + interval '2 hours'
        and not exists (select 1 from public.cuestionarios c where c.atleta_id = a.id and c.completado_en is not null)
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.perfil_id, 'cuestionario', 'Te falta tu cuestionario',
            'Empiezas el lunes: con tu cuestionario, la app te prepara el plan. Son unos minutos.',
            '#hoy', 'esencial_cuestionario:' || x.esencial_inicio, p_ahora,
            (v_hoy + x.hora_manana + interval '4 hours') at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  exception when others then
    raise warning 'FBE: aviso de FBE Esencial del cuestionario no creado: %', sqlerrm;
  end;

  -- (097) FBE Esencial, empezar: solo con su primer plan (el bloque más antiguo que tenga: el de la semana 5 o un cambio de
  -- días no es «empezar») y con la preferencia de los recordatorios de entreno. Cada uno, en su propio bloque.
  -- La víspera de su lunes, a su hora de la tarde: «Mañana empiezas»
  begin
    with x as materialized (
      select d.perfil_id, d.hora_tarde, b.fecha_inicio
      from fbe_privado.destinatarios d
      join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
      join public.bloques b on b.atleta_id = a.id and not b.es_plantilla and b.estado in ('activo', 'ajustado', 'planificado') and b.fecha_inicio = v_hoy + 1
      where not ('sesion_hoy' = any (d.desactivados))
        and v_local >= v_hoy + d.hora_tarde and v_local < v_hoy + d.hora_tarde + interval '2 hours'
        and not exists (select 1 from public.bloques b2 where b2.atleta_id = a.id and not b2.es_plantilla and b2.fecha_inicio < b.fecha_inicio)
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.perfil_id, 'sesion_hoy', 'Mañana empiezas',
            'Tu semana 1 ya está en la app: échale un vistazo y elige cuándo haces la primera sesión.',
            '#hoy', 'esencial_manana:' || x.fecha_inicio, p_ahora,
            (v_hoy + x.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  exception when others then
    raise warning 'FBE: aviso de FBE Esencial de la víspera no creado: %', sqlerrm;
  end;

  -- Ese lunes, a su hora de la mañana: «Hoy empiezas» (si hoy ya le llega «Hoy toca», no otro)
  begin
    with x as materialized (
      select d.perfil_id, d.hora_manana, b.fecha_inicio
      from fbe_privado.destinatarios d
      join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
      join public.bloques b on b.atleta_id = a.id and not b.es_plantilla and b.estado in ('activo', 'ajustado', 'planificado') and b.fecha_inicio = v_hoy
      where not ('sesion_hoy' = any (d.desactivados))
        and v_local >= v_hoy + d.hora_manana and v_local < v_hoy + d.hora_manana + interval '2 hours'
        and not exists (select 1 from public.bloques b2 where b2.atleta_id = a.id and not b2.es_plantilla and b2.fecha_inicio < b.fecha_inicio)
        and not exists (select 1 from public.notificaciones n where n.usuario_id = d.perfil_id and n.clave = 'recordatorio_sesion:' || v_hoy)
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.perfil_id, 'sesion_hoy', 'Hoy empiezas',
            'Tu semana 1 ya está en Hoy. Haz la primera sesión cuando mejor te venga esta semana.',
            '#hoy', 'esencial_hoy:' || x.fecha_inicio, p_ahora,
            (v_hoy + x.hora_manana + interval '4 hours') at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  exception when others then
    raise warning 'FBE: aviso de FBE Esencial del primer día no creado: %', sqlerrm;
  end;

  -- El jueves de su semana 1, a su hora de la tarde, si aún no ha hecho ninguna sesión: «¿Empezamos?»
  begin
    if v_dow = 4 then
      with x as materialized (
        select d.perfil_id, d.hora_tarde, b.fecha_inicio
        from fbe_privado.destinatarios d
        join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
        join public.bloques b on b.atleta_id = a.id and not b.es_plantilla and b.estado in ('activo', 'ajustado', 'planificado') and b.fecha_inicio = v_lunes
        where not ('sesion_hoy' = any (d.desactivados))
          and v_local >= v_hoy + d.hora_tarde and v_local < v_hoy + d.hora_tarde + interval '2 hours'
          and not exists (select 1 from public.bloques b2 where b2.atleta_id = a.id and not b2.es_plantilla and b2.fecha_inicio < b.fecha_inicio)
          and not exists (select 1 from public.sesiones s join public.semanas w on w.id = s.semana_id where w.bloque_id = b.id and s.completada)
      )
      select count(*) into v_m from x
      where fbe_privado.notificar_seguro(x.perfil_id, 'sesion_hoy', '¿Empezamos?',
              'Aún no has hecho ninguna sesión de tu semana 1: mañana o el fin de semana es buen momento para la primera.',
              '#hoy', 'esencial_empezamos:' || x.fecha_inicio, p_ahora,
              (v_hoy + x.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  exception when others then
    raise warning 'FBE: aviso de FBE Esencial de la semana 1 sin empezar no creado: %', sqlerrm;
  end;

  -- Al coach, por la mañana (10 a 12), los vistos buenos de FBE Esencial que llevan 3 días o más sin confirmar: uno al día
  begin
    if v_local::time between time '10:00' and time '12:00' then
      with x as materialized (
        select c.id as coach, count(*) as n, min(a.visto_bueno_pedido_en) as desde
        from public.perfiles c
        cross join public.atletas a
        where c.rol = 'coach' and a.modalidad = 'por_su_cuenta' and a.estado <> 'baja'
          and a.visto_bueno_pedido_en is not null and a.visto_bueno_en is null
          and a.visto_bueno_pedido_en < p_ahora - interval '3 days'
        group by c.id
      )
      select count(*) into v_m from x
      where fbe_privado.notificar_seguro(x.coach, 'cuestionario_recibido',
              case when x.n = 1 then 'Un visto bueno espera tu confirmación' else x.n || ' vistos buenos esperan tu confirmación' end,
              'De FBE Esencial; el más antiguo, desde el ' || to_char(x.desde at time zone 'Europe/Madrid', 'FMDD/FMMM') || '. Los tienes en Atletas.',
              '#atletas', 'esencial_visto_bueno:' || v_hoy, p_ahora, (v_hoy + 1) at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  exception when others then
    raise warning 'FBE: aviso de los vistos buenos sin confirmar no creado: %', sqlerrm;
  end;


  -- (099) El cierre es a las 22:00 (en la 098, a las 23:30): así el aviso llega antes del «no molestar» de serie, que empieza
  -- a las 22:30 (Pelayo, 25/11).
  -- (098) FBE Esencial, el cierre de la semana (Pelayo, 25/11). El domingo de 21:00 a 22:00, con sesiones sin hacer y sin
  -- haber elegido: la pregunta (pasar a la siguiente o repetir esta). Con su «no molestar», como todo lo de «semana».
  begin
    if v_dow = 7 and v_local::time >= time '21:00' and v_local::time < time '22:00' then
      with x as materialized (
        select d.perfil_id, (select count(*) from public.sesiones s where s.semana_id = w.id and not s.completada) as faltan
        from fbe_privado.destinatarios d
        join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
        join public.bloques b on b.atleta_id = a.id and not b.es_plantilla and b.estado in ('activo', 'ajustado')
        join public.semanas w on w.bloque_id = b.id and w.programacion = 'programada' and w.fecha_inicio = v_lunes
        where w.esencial_cierre_lunes is distinct from v_lunes
          and exists (select 1 from public.sesiones s where s.semana_id = w.id and not s.completada)
      )
      select count(*) into v_m from x
      where fbe_privado.notificar_seguro(x.perfil_id, 'semana', '¿Pasamos a la semana siguiente?',
              case when x.faltan = 1 then 'Te queda una sesión de esta semana.' else 'Te quedan ' || x.faltan || ' sesiones de esta semana.' end
                || ' Elige en la app si pasas a la siguiente o repites esta. Si no eliges antes de las 22:00, pasamos.',
              '#hoy', 'esencial_domingo:' || v_lunes, p_ahora, (v_hoy + time '22:00') at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  exception when others then
    raise warning 'FBE: la pregunta del domingo de FBE Esencial no creada: %', sqlerrm;
  end;

  -- El domingo desde las 22:00, quien no ha elegido: se pasa a la siguiente (queda apuntado en su semana; la prepara la app
  -- al abrirla, como cada lunes) y se le dice. Vale también para quien no tiene los avisos activados (sin el aviso).
  begin
    if v_dow = 7 and v_local::time >= time '22:00' then
      with cerradas as (
        update public.semanas w set esencial_cierre = 'auto', esencial_cierre_lunes = v_lunes
        from public.bloques b join public.atletas a on a.id = b.atleta_id
        where w.bloque_id = b.id and not b.es_plantilla and b.estado in ('activo', 'ajustado')
          and a.modalidad = 'por_su_cuenta' and a.estado = 'activo' and a.entrenamiento
          and w.programacion = 'programada' and w.fecha_inicio = v_lunes and w.esencial_cierre_lunes is distinct from v_lunes
          and exists (select 1 from public.sesiones s where s.semana_id = w.id and not s.completada)
        returning a.perfil_id
      )
      select count(*) into v_m from cerradas c
      where c.perfil_id is not null
        and fbe_privado.notificar_seguro(c.perfil_id, 'semana', 'Tu semana siguiente, programada',
              'Como no has contestado, te hemos dejado programada tu siguiente semana de entrenamiento. La tienes al abrir la app.',
              '#hoy', 'esencial_auto:' || v_lunes, p_ahora, (v_hoy + 1 + time '14:00') at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  exception when others then
    raise warning 'FBE: el cierre del domingo de FBE Esencial no hecho: %', sqlerrm;
  end;

  -- El lunes, a su hora de la mañana, si tenía semana la pasada y aún no tiene la nueva (se la prepara la app al abrirla)
  begin
    if v_dow = 1 then
      with x as materialized (
        select d.perfil_id, d.hora_manana
        from fbe_privado.destinatarios d
        join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
        where v_local >= v_hoy + d.hora_manana and v_local < v_hoy + d.hora_manana + interval '2 hours'
          and exists (select 1 from public.bloques b join public.semanas w on w.bloque_id = b.id
                      where b.atleta_id = a.id and not b.es_plantilla and b.estado in ('activo', 'ajustado')
                        and w.programacion = 'programada' and w.fecha_inicio = v_lunes - 7)
          and not exists (select 1 from public.bloques b join public.semanas w on w.bloque_id = b.id
                          where b.atleta_id = a.id and not b.es_plantilla and w.programacion = 'programada' and w.fecha_inicio >= v_lunes)
      )
      select count(*) into v_m from x
      where fbe_privado.notificar_seguro(x.perfil_id, 'semana', 'Empieza tu semana',
              'Abre la app y te prepara tu semana nueva con lo que apuntaste en la anterior.',
              '#hoy', 'esencial_lunes:' || v_lunes, p_ahora, (v_hoy + x.hora_manana + interval '6 hours') at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  exception when others then
    raise warning 'FBE: el aviso del lunes de FBE Esencial no creado: %', sqlerrm;
  end;

  -- (099) FBE Esencial, elegir rutina. Quien ya envió su cuestionario, tiene experiencia (y la criba no le manda a
  -- «Primeras 4 semanas»), nunca ha tenido plan y aún no ha elegido rutina. Con la preferencia del cuestionario.
  -- Desde el día siguiente de enviarlo, a su hora de la tarde: «Te falta elegir tu rutina» (una sola vez)
  begin
    with x as materialized (
      select d.perfil_id, d.hora_tarde, a.id as atleta_id, a.esencial_inicio, a.visto_bueno_en, c.resultado,
        (c.completado_en at time zone 'Europe/Madrid')::date as enviado
      from fbe_privado.destinatarios d
      join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
      join public.cuestionarios c on c.atleta_id = a.id and c.completado_en is not null and c.resultado is not null
      where not ('cuestionario' = any (d.desactivados))
        and a.esencial_plantilla is null and coalesce(c.experiencia, 'ninguna') <> 'ninguna'
        and not (c.experiencia = 'menos_1' and coalesce((c.gustos ->> 'ahora') = 'parado' or (c.gustos ->> 'tecnica') = 'no', false))
        and not exists (select 1 from public.bloques b where b.atleta_id = a.id and not b.es_plantilla)
    )
    select count(*) into v_m from x
    where x.enviado < v_hoy and v_local >= v_hoy + x.hora_tarde and v_local < v_hoy + x.hora_tarde + interval '2 hours'
      -- (la víspera de su lunes no: esa tarde le llega la última llamada, que ya lo dice)
      and not (v_dow = 7 and (x.esencial_inicio is null or x.esencial_inicio <= v_hoy + 1) and (x.resultado = 'sin_valoracion' or x.visto_bueno_en is not null))
      and fbe_privado.notificar_seguro(x.perfil_id, 'cuestionario', 'Te falta elegir tu rutina',
            'Es el último paso antes de empezar: unas preguntas cortas y eliges entre las rutinas que te recomienda la app.',
            '#hoy', 'esencial_rutina:' || x.atleta_id, p_ahora,
            (v_hoy + x.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  exception when others then
    raise warning 'FBE: aviso de FBE Esencial de elegir rutina no creado: %', sqlerrm;
  end;

  -- La víspera de su lunes (o si su lunes ya pasó), el domingo de 21:00 a 22:00, ya con el visto bueno si le hacía falta:
  -- la última llamada (a las 22:00 la app le deja el plan preparado)
  begin
    if v_dow = 7 and v_local::time >= time '21:00' and v_local::time < time '22:00' then
      with x as materialized (
        select d.perfil_id, d.hora_tarde, a.id as atleta_id, a.esencial_inicio, a.visto_bueno_en, c.resultado,
          (c.completado_en at time zone 'Europe/Madrid')::date as enviado
        from fbe_privado.destinatarios d
        join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
        join public.cuestionarios c on c.atleta_id = a.id and c.completado_en is not null and c.resultado is not null
        where not ('cuestionario' = any (d.desactivados))
          and a.esencial_plantilla is null and coalesce(c.experiencia, 'ninguna') <> 'ninguna'
          and not (c.experiencia = 'menos_1' and coalesce((c.gustos ->> 'ahora') = 'parado' or (c.gustos ->> 'tecnica') = 'no', false))
          and not exists (select 1 from public.bloques b where b.atleta_id = a.id and not b.es_plantilla)
      )
      select count(*) into v_m from x
      where (x.esencial_inicio is null or x.esencial_inicio <= v_hoy + 1) and (x.resultado = 'sin_valoracion' or x.visto_bueno_en is not null)
        and fbe_privado.notificar_seguro(x.perfil_id, 'cuestionario', 'Mañana empiezas: elige tu rutina',
              'Si no eliges antes de las 22:00, la app te deja preparada la de tu cuestionario.',
              '#hoy', 'esencial_elige:' || (v_hoy + 1), p_ahora, (v_hoy + time '22:00') at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  exception when others then
    raise warning 'FBE: la última llamada de FBE Esencial para elegir rutina no creada: %', sqlerrm;
  end;

  -- El domingo desde las 22:00: quien tiene su cuestionario enviado (y el visto bueno, si le hacía falta), su lunes es mañana
  -- o ya pasó y nunca ha tenido plan (no eligió rutina, o la app no llegó a pedírselo): se le deja preparado para este
  -- lunes (la criba; la rutina que eligió o, sin elegir, la de su cuestionario) y se le dice. Vale también para quien no
  -- tiene los avisos activados (sin el aviso). Cada uno, en su propio bloque: un fallo con uno no deja sin plan a los demás.
  begin
    if v_dow = 7 and v_local::time >= time '22:00' then
      for v_r in
        select a.id, a.perfil_id, a.esencial_plantilla
        from public.atletas a
        join public.cuestionarios c on c.atleta_id = a.id and c.completado_en is not null and c.resultado is not null
        where a.modalidad = 'por_su_cuenta' and a.estado = 'activo' and a.entrenamiento
          and (c.resultado = 'sin_valoracion' or a.visto_bueno_en is not null)
          and (a.esencial_inicio is null or a.esencial_inicio <= v_hoy + 1)
          -- (a quien acaba de enviarlo, hace menos de una hora, aún no: puede estar eligiendo en este momento)
          and c.completado_en <= p_ahora - interval '1 hour'
          and not exists (select 1 from public.bloques b where b.atleta_id = a.id and not b.es_plantilla)
      loop
        begin
          v_plan := fbe_privado.esencial_asignar(v_r.id, v_hoy);
          -- (el cuerpo de un aviso, como mucho 160 caracteres: con el nombre más largo de las rutinas de serie, 149)
          if coalesce((v_plan ->> 'nuevo')::boolean, false) and v_r.perfil_id is not null
             and fbe_privado.notificar_seguro(v_r.perfil_id, 'semana', 'Tu plan, preparado',
                   case when (v_plan ->> 'plantilla') = 'Primeras 4 semanas' or (v_plan ->> 'plantilla') is not distinct from v_r.esencial_plantilla
                        then 'Te hemos dejado preparado tu plan: «' || (v_plan ->> 'plantilla') || '». Empiezas este lunes.'
                        else 'Como no has elegido rutina, te hemos dejado preparada «' || (v_plan ->> 'plantilla') || '». Empiezas este lunes; puedes cambiarla.' end,
                   '#hoy', 'esencial_plan_auto:' || v_r.id, p_ahora, (v_hoy + 1 + time '14:00') at time zone 'Europe/Madrid') then
            v_n := v_n + 1;
          end if;
        exception when others then
          raise warning 'FBE: el plan de FBE Esencial de % no preparado: %', v_r.id, sqlerrm;
        end;
      end loop;
    end if;
  exception when others then
    raise warning 'FBE: los planes de la víspera de FBE Esencial no preparados: %', sqlerrm;
  end;

  return v_n;
end $$;

-- ---------------------------------------------------------------------
-- 7. Permisos (como al final de 003 a 098)
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
