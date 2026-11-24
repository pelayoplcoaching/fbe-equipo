-- =====================================================================
-- FBE Equipo, migración 094: FBE Esencial, lo del piloto (la alternativa de su gimnasio, avisos por grupo y el aviso a
-- los 7 días sin entrenar)
--
-- Por qué: lo que más pesa en que sigan quienes van por su cuenta, sin que Pelayo tenga que hacer nada:
--   * La alternativa para siempre: si en su gimnasio no hay prensa, lo dice una vez y su plan pasa a la alternativa de la
--     guía (las sesiones que aún no ha hecho y las semanas que le prepare la app). `atletas.esencial_alternativas`
--     ({ ejercicio: alternativa }) y esencial_alternativa(p_ejercicio, p_alternativa, p_excepto, p_atleta): solo entre
--     las alternativas que tiene ese ejercicio en la biblioteca y que se midan igual (la plancha, que va por tiempo, solo se
--     cambia en cada sesión); con p_alternativa vacía, vuelve al de la guía. Al cambiar, sin kilos sugeridos (son de otro
--     ejercicio).
--   * esencial_semana_siguiente: la de la 092, aplicando esas alternativas a su molde (sin los kilos del otro ejercicio).
--   * avisos.grupo: un aviso para todos los de FBE Esencial o para todos los que llevan seguimiento (los generales, sin
--     grupo, siguen siendo para todos).
--   * crear_recordatorios: la de la 054 con un bloque más al final: a quien va por su cuenta, con su plan empezado hace
--     una semana o más, a los 7 días sin entrenar, un aviso amable a su hora de la tarde (uno por semana como mucho, con
--     la preferencia de los recordatorios de entreno).
--   Para quien lleva seguimiento no cambia nada.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 093 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 94 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 094 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 94;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 93) then  -- (2) la anterior
    raise exception 'Falta la migración 093 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. La alternativa para siempre
-- ---------------------------------------------------------------------
alter table public.atletas add column if not exists esencial_alternativas jsonb not null default '{}'::jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'atletas_esencial_alternativas_check') then
    alter table public.atletas add constraint atletas_esencial_alternativas_check check (jsonb_typeof(esencial_alternativas) = 'object');
  end if;
end $$;

-- p_ejercicio: el de la guía (o el que tenga pautado); p_alternativa: una de sus alternativas de la biblioteca (vacía,
-- vuelve al de la guía); p_excepto: la sesión que tiene abierta (esa la cambia la app, para no tocarla por debajo).
-- Devuelve cuántos ejercicios de sus sesiones sin hacer ha cambiado.
create or replace function public.esencial_alternativa(p_ejercicio uuid, p_alternativa uuid default null, p_excepto uuid default null, p_atleta uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := coalesce(p_atleta, public.mi_atleta_id());
  v_at public.atletas;
  v_guia uuid := p_ejercicio;
  v_desde uuid;
  v_hasta uuid;
  v_n integer := 0;
begin
  if v_id is null then raise exception 'No hay atleta' using errcode = 'P0002'; end if;
  if not public.es_coach() and public.mi_atleta_id() is distinct from v_id then
    raise exception 'Solo puedes cambiar tu propio plan' using errcode = '42501';
  end if;
  select * into v_at from public.atletas where id = v_id;
  if not found then raise exception 'Ese atleta no existe' using errcode = 'P0002'; end if;
  if v_at.modalidad <> 'por_su_cuenta' then raise exception 'Solo para quien va por su cuenta (FBE Esencial)' using errcode = '22023'; end if;
  if v_at.estado <> 'activo' then raise exception 'Su cuenta no está activa' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('fbe-esencial-semana:' || v_id::text));
  -- (si lo que tiene pautado ya es la alternativa de otro, el de la guía es ese otro)
  select key::uuid into v_guia from jsonb_each_text(v_at.esencial_alternativas) where value::uuid = p_ejercicio limit 1;
  v_guia := coalesce(v_guia, p_ejercicio);
  v_desde := coalesce((v_at.esencial_alternativas ->> v_guia::text)::uuid, v_guia);
  if p_alternativa is null or p_alternativa = v_guia then
    v_hasta := v_guia;
    update public.atletas set esencial_alternativas = esencial_alternativas - v_guia::text where id = v_id;
  else
    if not exists (select 1 from public.ejercicios where id = v_guia and p_alternativa = any (alternativas)) then
      raise exception 'Esa no es una alternativa de ese ejercicio' using errcode = '22023';
    end if;
    if (select coalesce(por_tiempo, false) from public.ejercicios where id = v_guia) is distinct from (select coalesce(por_tiempo, false) from public.ejercicios where id = p_alternativa) then
      raise exception 'Para siempre, solo entre ejercicios que se miden igual (la plancha se cambia en cada sesión)' using errcode = '22023';
    end if;
    v_hasta := p_alternativa;
    update public.atletas set esencial_alternativas = esencial_alternativas || jsonb_build_object(v_guia::text, p_alternativa) where id = v_id;
  end if;
  if v_desde <> v_hasta then
    -- Las sesiones que aún no ha hecho, sin series de ese ejercicio, en sus bloques en curso
    update public.sesion_ejercicios se
    set ejercicio_id = v_hasta, carga_sugerida_kg = null, series_detalle = null
    from public.sesiones s join public.semanas w on w.id = s.semana_id join public.bloques b on b.id = w.bloque_id
    where se.sesion_id = s.id and b.atleta_id = v_id and not b.es_plantilla and b.estado in ('activo', 'ajustado', 'planificado')
      and not s.completada and s.id is distinct from p_excepto and se.ejercicio_id = v_desde
      and not exists (select 1 from public.series sr where sr.sesion_ejercicio_id = se.id);
    get diagnostics v_n = row_count;
  end if;
  return v_n;
end $$;

-- ---------------------------------------------------------------------
-- 2. La semana siguiente, con sus alternativas (la de la 092, aplicando `esencial_alternativas` a su molde)
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
  b_kg numeric; b_det jsonb;
  v_ej uuid;
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
           or (v_kg is not null and (v_kg < 0 or (v_tiempo and v_kg > coalesce(v_tope, 0) + 5)
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
-- 3. Avisos para un grupo
-- ---------------------------------------------------------------------
alter table public.avisos add column if not exists grupo text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'avisos_grupo_check') then
    alter table public.avisos add constraint avisos_grupo_check check (grupo is null or (grupo in ('seguimiento', 'esencial') and atleta_id is null));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. A los 7 días sin entrenar: crear_recordatorios, la de la 054 con un bloque más al final
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

  return v_n;
end $$;

-- ---------------------------------------------------------------------
-- 5. Permisos (como al final de 003 a 093)
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

insert into public.fbe_migraciones (numero) values (94)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
