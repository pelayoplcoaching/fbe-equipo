-- =====================================================================
-- FBE Equipo, migración 054: lo que el coach necesita de cada entreno, sin pedirlo dos veces (tanda «cierre»)
--
-- Por qué: de las sesiones terminadas en la app, la mitad se queda sin esfuerzo (RPE) ni duración, y las herramientas
-- estructuradas del coach (check-in, revisión semanal, tareas, hábitos) no compiten con el chat. Esta migración pone la parte
-- de base de esa tanda; lo demás va en la app.
--
-- Qué hace:
--   * sesiones.cerrada_sola_en: la sesión que el atleta dejó con todas las series hechas y 3 horas sin tocar se cierra sola
--     (fbe_privado.sesiones_cerrar_solas, desde crear_recordatorios): duración de la primera a la última serie, esfuerzo
--     estimado con la media de sus series (solo si no lo puso) y aviso «La hemos cerrado por ti». Se puede corregir después.
--   * El coach recibe por la mañana un aviso con los vídeos de técnica que llevan 3 días o más sin revisar.
--   * atleta_resumen_semana(atleta, lunes): lo de la semana de un atleta en una consulta (sesiones hechas y previstas, esfuerzo
--     medio, series y toneladas, peso y su cambio, check-in, vídeos sin revisar, sesiones sin cerrar): para la cabecera del
--     chat del coach y para «tu semana de un vistazo» en el check-in. El coach, de cualquiera; el atleta, la suya.
--   * sesiones_abiertas(atleta): las sesiones con series y sin terminar de los últimos 14 días (el coach, de todos).
--   * bloques.objetivo_logrado: al acabar el bloque, el coach marca si el objetivo se consiguió (lo ve el atleta en el informe).
--   * habitos.origen ('coach' | 'sugerido') y habito_sugerido_activar(...): el atleta activa con un toque un hábito sugerido
--     por la app según su cuestionario (hasta 5 activos); el coach ve cuáles eligió él.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 053 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada. (La del reloj, cuando entre, pasa a ser la 055.)
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 54 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 054 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 54;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 53) then  -- (2) la anterior
    raise exception 'Falta la migración 053 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Columnas nuevas
-- ---------------------------------------------------------------------
alter table public.sesiones add column if not exists cerrada_sola_en timestamptz;
alter table public.bloques add column if not exists objetivo_logrado boolean;
alter table public.habitos add column if not exists origen text not null default 'coach';
alter table public.habitos drop constraint if exists habitos_origen_valido;
alter table public.habitos add constraint habitos_origen_valido check (origen in ('coach', 'sugerido'));

-- ---------------------------------------------------------------------
-- 2. Las sesiones que se quedaron sin cerrar
-- ---------------------------------------------------------------------
-- Candidatas: no terminadas, con ejercicios, todas las series pautadas con su serie guardada, la última hace 3 horas o más
-- (y menos de 7 días: lo más viejo se deja como está, por si fue a propósito). Duración: de la primera a la última serie más
-- 5 minutos (entre 10 y 240). Esfuerzo: la media de las series con RPE, redondeada, solo si el atleta no lo había puesto.
-- Fecha: el día (de Madrid) de la última serie. Avisa al atleta (tipo «sesion_hoy», que es el de sus sesiones) y devuelve cuántas.
create or replace function fbe_privado.sesiones_cerrar_solas(p_ahora timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_n integer := 0;
  r record;
begin
  for r in
    with con_series as (
      select s.id, s.nombre, w.bloque_id,
             min(x.registrada_en) as primera, max(x.registrada_en) as ultima,
             round(avg(x.rpe) filter (where x.rpe is not null and x.rpe > 0)) as rpe_medio
      from public.sesiones s
      join public.semanas w on w.id = s.semana_id
      join public.sesion_ejercicios se on se.sesion_id = s.id
      join public.series x on x.sesion_ejercicio_id = se.id
      where not s.completada
      group by s.id, s.nombre, w.bloque_id
      having max(x.registrada_en) <= p_ahora - interval '3 hours' and max(x.registrada_en) > p_ahora - interval '7 days'
    )
    select c.*, b.atleta_id, p.id as perfil_id
    from con_series c
    join public.bloques b on b.id = c.bloque_id
    join public.atletas a on a.id = b.atleta_id and a.estado <> 'baja'
    left join public.perfiles p on p.id = a.perfil_id
    where not exists (
      -- alguna pautada sin todas sus series
      select 1 from public.sesion_ejercicios se2
      where se2.sesion_id = c.id
        and (select count(*) from public.series x2 where x2.sesion_ejercicio_id = se2.id) < se2.series)
  loop
    update public.sesiones s
    set completada = true,
        fecha_realizada = coalesce(s.fecha_realizada, (r.ultima at time zone 'Europe/Madrid')::date),
        duracion_min = coalesce(s.duracion_min, greatest(10, least(240, ceil(extract(epoch from (r.ultima - r.primera)) / 60)::integer + 5))),
        rpe_sesion = coalesce(s.rpe_sesion, r.rpe_medio::smallint),
        cerrada_sola_en = p_ahora
    where s.id = r.id and not s.completada;
    if found then
      v_n := v_n + 1;
      if r.perfil_id is not null then
        perform fbe_privado.notificar_seguro(r.perfil_id, 'sesion_hoy', 'Hemos cerrado ' || coalesce(r.nombre, 'tu sesión') || ' por ti',
          'Tenías todas las series hechas. Si quieres, añade cómo fue (esfuerzo y nota) en Hoy.', '#hoy',
          'sesion_cerrada:' || r.id, p_ahora, p_ahora + interval '2 days');
      end if;
    end if;
  end loop;
  return v_n;
end $$;

-- Las sesiones con series guardadas y sin terminar (últimos 14 días): el coach, de todos (o de uno); el atleta, las suyas
create or replace function public.sesiones_abiertas(p_atleta uuid default null)
returns table (sesion_id uuid, atleta_id uuid, nombre text, ultima_serie timestamptz, series_hechas integer, series_pautadas integer, semana_inicio date)
language sql stable security definer set search_path = '' as $$
  select s.id, b.atleta_id, s.nombre, max(x.registrada_en), count(x.id)::integer,
         (select coalesce(sum(se2.series), 0) from public.sesion_ejercicios se2 where se2.sesion_id = s.id)::integer, w.fecha_inicio
  from public.sesiones s
  join public.semanas w on w.id = s.semana_id
  join public.bloques b on b.id = w.bloque_id
  join public.sesion_ejercicios se on se.sesion_id = s.id
  join public.series x on x.sesion_ejercicio_id = se.id
  where auth.uid() is not null and not s.completada
    and (p_atleta is null or b.atleta_id = p_atleta)
    and (public.es_coach() or b.atleta_id = public.mi_atleta_id())
  group by s.id, b.atleta_id, s.nombre, w.fecha_inicio
  having max(x.registrada_en) > now() - interval '14 days'
  order by max(x.registrada_en) desc
$$;

-- ---------------------------------------------------------------------
-- 3. La semana de un atleta, de un vistazo
-- ---------------------------------------------------------------------
create or replace function public.atleta_resumen_semana(p_atleta uuid, p_lunes date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_lunes date := coalesce(p_lunes, (now() at time zone 'Europe/Madrid')::date - (extract(isodow from (now() at time zone 'Europe/Madrid'))::integer - 1));
  v_domingo date;
  v_sesiones jsonb;
  v_peso jsonb;
  v_checkin jsonb;
  v_videos integer;
  v_abiertas integer;
  v_sin_leer integer;
begin
  if auth.uid() is null or not (public.es_coach() or p_atleta = public.mi_atleta_id()) then return null; end if;
  v_domingo := v_lunes + 6;
  -- Las sesiones de esa semana (de lunes a domingo, por la fecha en que se hicieron) y las previstas en la semana publicada
  with hechas as (
    select s.id, s.rpe_sesion, s.duracion_min, s.fecha_realizada
    from public.sesiones s join public.semanas w on w.id = s.semana_id join public.bloques b on b.id = w.bloque_id
    where b.atleta_id = p_atleta and s.completada and s.fecha_realizada between v_lunes and v_domingo
  ), previstas as (
    select count(*) as n
    from public.sesiones s join public.semanas w on w.id = s.semana_id join public.bloques b on b.id = w.bloque_id
    where b.atleta_id = p_atleta and w.fecha_inicio = v_lunes and w.programacion = 'programada'
  ), series_sem as (
    select count(*) as series, coalesce(sum(x.kg * x.reps), 0) as kg, avg(x.rpe) filter (where x.rpe > 0) as rpe
    from public.series x join public.sesion_ejercicios se on se.id = x.sesion_ejercicio_id join hechas h on h.id = se.sesion_id
    where x.atleta_id = p_atleta
  )
  select jsonb_build_object(
    'hechas', (select count(*) from hechas), 'previstas', (select n from previstas),
    'rpe_sesion', (select round(avg(rpe_sesion)::numeric, 1) from hechas where rpe_sesion is not null),
    'rpe_series', (select round(rpe::numeric, 1) from series_sem),
    'minutos', (select coalesce(sum(duracion_min), 0) from hechas),
    'series', (select series from series_sem), 'toneladas', (select round(kg / 1000, 1) from series_sem),
    'ultima', (select max(fecha_realizada) from hechas))
  into v_sesiones;
  -- El peso: el último y el de hace 4 semanas (o el más cercano antes)
  select jsonb_build_object('kg', p.kg, 'fecha', p.fecha,
           'cambio_4s', (select round(p.kg - q.kg, 1) from public.pesos q where q.atleta_id = p_atleta and q.fecha <= p.fecha - 28 order by q.fecha desc limit 1))
  into v_peso from public.pesos p where p.atleta_id = p_atleta order by p.fecha desc limit 1;
  select jsonb_build_object('semana', c.semana_inicio, 'creado_en', c.creado_en, 'energia', c.energia, 'motivacion', c.motivacion, 'horas_sueno', c.horas_sueno)
  into v_checkin from public.checkins c where c.atleta_id = p_atleta and c.semana_inicio in (v_lunes, v_lunes - 7) order by c.semana_inicio desc limit 1;
  select count(*) into v_videos from public.archivos a where a.atleta_id = p_atleta and a.tipo = 'video_tecnica' and a.revisado_en is null;
  select count(*) into v_abiertas from public.sesiones_abiertas(p_atleta);
  select count(*) into v_sin_leer from public.comentarios m where m.atleta_id = p_atleta and m.autor = 'atleta' and m.leido_en is null and m.eliminado_en is null;
  return jsonb_build_object('lunes', v_lunes, 'sesiones', v_sesiones, 'peso', v_peso, 'checkin', v_checkin, 'videos_sin_revisar', v_videos,
                            'sesiones_abiertas', v_abiertas, 'sin_leer', case when public.es_coach() then v_sin_leer else null end);
end $$;

-- ---------------------------------------------------------------------
-- 4. Un hábito sugerido, activado por el atleta (hasta 5 activos; el nombre, de la lista de la app)
-- ---------------------------------------------------------------------
create or replace function public.habito_sugerido_activar(p_nombre text, p_tipo text, p_objetivo numeric default null, p_unidad text default null,
                                                           p_sentido text default 'al_menos', p_dias integer default 7, p_icono text default 'libre') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_atleta uuid := public.mi_atleta_id();
  v_id uuid;
begin
  if v_atleta is null then raise exception 'Solo un atleta activa sus hábitos' using errcode = '42501'; end if;
  if nullif(btrim(coalesce(p_nombre, '')), '') is null or char_length(p_nombre) > 60 then raise exception 'El hábito necesita un nombre (hasta 60 letras)' using errcode = '22023'; end if;
  if p_tipo not in ('numero', 'si_no') then raise exception 'Tipo de hábito no válido' using errcode = '22023'; end if;
  if p_sentido not in ('al_menos', 'como_mucho') then raise exception 'Sentido no válido' using errcode = '22023'; end if;
  if p_dias not between 1 and 7 then raise exception 'Los días a la semana, de 1 a 7' using errcode = '22023'; end if;
  if (select count(*) from public.habitos h where h.atleta_id = v_atleta and h.activo) >= 5 then raise exception 'Como mucho cinco hábitos activos' using errcode = '54000'; end if;
  if exists (select 1 from public.habitos h where h.atleta_id = v_atleta and h.activo and lower(h.nombre) = lower(btrim(p_nombre))) then
    raise exception 'Ya tienes ese hábito' using errcode = '23505';
  end if;
  insert into public.habitos (atleta_id, nombre, tipo, objetivo, unidad, sentido, dias_semana, icono, orden, activo, origen)
  values (v_atleta, btrim(p_nombre), p_tipo, p_objetivo, nullif(btrim(coalesce(p_unidad, '')), ''), p_sentido, p_dias, coalesce(nullif(p_icono, ''), 'libre'),
          (select coalesce(max(orden), 0) + 1 from public.habitos h where h.atleta_id = v_atleta), true, 'sugerido')
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 5. crear_recordatorios (045), con lo nuevo al final
-- ---------------------------------------------------------------------
-- (045 + 054) Lo de siempre y, al final, cerrar las sesiones que se quedaron abiertas y avisar al coach de los vídeos sin revisar
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

  return v_n;
end $$;

-- ---------------------------------------------------------------------
-- 6. Permisos (como al final de 003 a 053)
-- ---------------------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb), public.salud_recibir(text, jsonb), public.calendario_de(text) from public, anon, authenticated;
-- (las del reloj, si están)
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('reloj_estado', 'reloj_serie', 'reloj_saltar', 'reloj_elegir', 'reloj_terminar') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (54)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
