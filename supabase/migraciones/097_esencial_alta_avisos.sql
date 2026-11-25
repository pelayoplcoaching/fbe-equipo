-- =====================================================================
-- FBE Equipo, migración 097: FBE Esencial, el alta y la primera semana
--
-- Por qué (las 60 mejoras del alta, aprobadas por Pelayo el 25/11/2026):
--   * invitacion_estado(p_codigo): quien acaba de crear su cuenta y su código no vale sabe por qué (no existe, ha caducado,
--     ya se usó o hay uno más nuevo) en lugar de un «no es válido» a ciegas. Solo con la sesión iniciada (nunca sin ella) y
--     con el mismo límite que canjear_invitacion: 5 intentos fallidos por hora y cuenta (cada consulta que no vale cuenta).
--   * esencial_alta_estado(): solo el coach. De cada uno de FBE Esencial: cuándo se le invitó y hasta cuándo vale su código,
--     cuándo activó su cuenta, si tiene los avisos activados (en algún móvil o por correo: sí o no, nada más), su
--     cuestionario, el visto bueno, su plan y su primera sesión. Es lo que enseña el panel «FBE Esencial».
--   * esencial_asignar_plan: si envía el cuestionario cuando su lunes ya ha llegado (o pasó), su plan empieza este lunes si
--     aún es de lunes a miércoles y, si no, el lunes siguiente (antes, siempre este lunes: un domingo, su semana 1 ya estaba
--     perdida).
--   * crear_recordatorios: la de la 095 con cuatro avisos más, solo para quien va por su cuenta y solo con su primer plan:
--     «Mañana empiezas» (la víspera, a su hora de la tarde), «Hoy empiezas» (ese lunes, a su hora de la mañana, si no le
--     llega ya «Hoy toca»), «¿Empezamos?» (el jueves de su semana 1 sin ninguna sesión hecha) y, al coach, por la mañana,
--     los vistos buenos que llevan 3 días o más sin confirmar.
--   No crea tablas ni cambia la política. Para quien lleva seguimiento no cambia nada.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 096 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 97 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 097 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 97;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 96) then  -- (2) la anterior
    raise exception 'Falta la migración 096 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Por qué no vale un código (quien ya tiene la sesión iniciada y aún no está vinculado)
-- ---------------------------------------------------------------------
-- Devuelve { estado, esencial }: estado = valido · no_existe · caducado · usado · reemplazado (hay uno más nuevo) ·
-- demasiados (5 intentos fallidos en la última hora) · vinculada (esta cuenta ya tiene su ficha); esencial: si el código es
-- de alguien de FBE Esencial (para decirle a quién pedir otro). Cada consulta que no vale cuenta como un intento fallido.
create or replace function public.invitacion_estado(p_codigo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invitaciones;
  v_estado text;
  v_esencial boolean := false;
begin
  if v_uid is null then
    raise exception 'Necesitas iniciar sesión' using errcode = '42501';
  end if;
  if public.es_coach() or exists (select 1 from public.atletas where perfil_id = v_uid) then
    return jsonb_build_object('estado', 'vinculada', 'esencial', false);
  end if;
  if (select count(*) from public.intentos_invitacion
      where perfil_id = v_uid and intentado_en > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('estado', 'demasiados', 'esencial', false);
  end if;
  select * into v_inv from public.invitaciones
   where codigo_hash = encode(sha256(convert_to(public.canon_codigo(p_codigo), 'UTF8')), 'hex');
  if not found then
    v_estado := 'no_existe';
  else
    select coalesce(a.modalidad = 'por_su_cuenta', false) into v_esencial from public.atletas a where a.id = v_inv.atleta_id;
    if v_inv.usada_en is not null or exists (select 1 from public.atletas a where a.id = v_inv.atleta_id and a.perfil_id is not null) then
      v_estado := 'usado';
    elsif v_inv.caduca_en > now() then
      v_estado := 'valido';
    elsif exists (select 1 from public.invitaciones i where i.atleta_id = v_inv.atleta_id and i.creada_en > v_inv.creada_en) then
      v_estado := 'reemplazado';
    else
      v_estado := 'caducado';
    end if;
  end if;
  if v_estado <> 'valido' then
    insert into public.intentos_invitacion (perfil_id) values (v_uid);
  end if;
  return jsonb_build_object('estado', v_estado, 'esencial', coalesce(v_esencial, false));
end $$;

-- ---------------------------------------------------------------------
-- 2. El alta de cada uno de FBE Esencial, para el panel del coach
-- ---------------------------------------------------------------------
-- Una fila por cada atleta que va por su cuenta (también los de baja: el panel decide qué enseña). push/email: si tiene
-- los avisos en algún móvil o por correo (sí o no: ni cuántos ni cuáles).
create or replace function public.esencial_alta_estado()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'atleta_id', a.id,
      'inicio', a.esencial_inicio,
      'invitado_en', i.creada_en,
      'caduca_en', i.caduca_en,
      'activado_en', u.usada_en,
      'push', a.perfil_id is not null and exists (select 1 from public.suscripciones_push s where s.usuario_id = a.perfil_id),
      'email', a.perfil_id is not null and coalesce((select p.email from public.preferencias_notificaciones p where p.usuario_id = a.perfil_id), false),
      'cuestionario_en', c.completado_en,
      'resultado', c.resultado,
      'visto_bueno_pedido_en', a.visto_bueno_pedido_en,
      'visto_bueno_en', a.visto_bueno_en,
      'plan_inicio', (select min(b.fecha_inicio) from public.bloques b where b.atleta_id = a.id and not b.es_plantilla),
      'primera_sesion', (select min(s.fecha_realizada) from public.sesiones s
                         join public.semanas w on w.id = s.semana_id
                         join public.bloques b on b.id = w.bloque_id
                         where b.atleta_id = a.id and not b.es_plantilla and s.completada)
    ) order by a.nombre)
    from public.atletas a
    left join lateral (select x.creada_en, x.caduca_en from public.invitaciones x where x.atleta_id = a.id order by x.creada_en desc limit 1) i on true
    left join lateral (select x.usada_en from public.invitaciones x where x.atleta_id = a.id and x.usada_en is not null order by x.usada_en limit 1) u on true
    left join public.cuestionarios c on c.atleta_id = a.id
    where a.modalidad = 'por_su_cuenta'
  ), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- 3. Si llega tarde: esencial_asignar_plan, la de la 091 con otro lunes
-- ---------------------------------------------------------------------
-- Devuelve el bloque (el que ya tuviera de FBE Esencial, si lo tiene: se puede llamar más de una vez).
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
  v_nombre := fbe_privado.esencial_plantilla(v_c.experiencia, v_c.dias_semana, v_c.lugar, v_c.material);
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
  return jsonb_build_object('bloque', v_bloque, 'nuevo', true, 'plantilla', (select nombre from public.bloques where id = v_pl), 'inicio', v_inicio);
end $$;


-- ---------------------------------------------------------------------
-- 4. Los avisos de empezar: crear_recordatorios, la de la 095 con cuatro bloques más al final
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


  return v_n;
end $$;

-- ---------------------------------------------------------------------
-- 5. Permisos (como al final de 003 a 096)
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

insert into public.fbe_migraciones (numero) values (97)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
