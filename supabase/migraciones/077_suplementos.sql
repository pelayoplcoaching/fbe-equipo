-- =====================================================================
-- FBE Equipo, migración 077: Los suplementos de cada atleta, con su recordatorio
--
-- Por qué: la creatina y compañía solo funcionan con constancia. El coach pauta en la ficha qué toma cada atleta (de
-- una lista corta de FBE o con texto libre), el atleta puede añadir los suyos, los marca en Hoy con un toque y, si
-- quiere, le llega un aviso al móvil a la hora que él elija. Solo suplementos: no es para medicación.
--
--   * suplementos: lo que toma (nombre, dosis, momento del día), quién lo puso ('coach' o 'atleta') y, si el atleta
--     quiere aviso, su hora. Hasta 8 activos por atleta. Se archivan (activo = false) para no perder lo apuntado.
--   * suplementos_tomas: un registro por suplemento y día que lo tomó.
--   Las dos, solo por funciones (las tablas no se leen directamente): el atleta ve y marca lo suyo, añade los suyos y
--   elige su aviso; el coach ve, pauta, cambia y archiva los de cualquiera.
--   * Aviso nuevo, 'suplementos' (se puede apagar en Ajustes → Avisos): a su hora (hora de España), si aún no lo ha
--     marcado. Sale en la misma pasada que el de los apuntes por repasar (crear_recordatorios_apuntes()).
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 076 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 77 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 077 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 77;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 76) then  -- (2) la anterior
    raise exception 'Falta la migración 076 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Las tablas
-- ---------------------------------------------------------------------
create table if not exists public.suplementos (
  id uuid primary key default gen_random_uuid(),
  atleta_id uuid not null references public.atletas(id) on delete cascade,
  clave text,
  nombre text not null,
  dosis text,
  momento text not null default 'cuando',
  aviso_hora time,
  origen text not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
alter table public.suplementos drop constraint if exists suplementos_validos;
alter table public.suplementos add constraint suplementos_validos check (
  char_length(nombre) between 1 and 40
  and (clave is null or clave ~ '^[a-z0-9-]{1,30}$')
  and (dosis is null or char_length(dosis) between 1 and 40)
  and momento in ('manana', 'antes', 'despues', 'comida', 'noche', 'cuando')
  and origen in ('coach', 'atleta')
  and (aviso_hora is null or (aviso_hora between time '05:00' and time '23:30' and extract(second from aviso_hora) = 0))
);
create index if not exists suplementos_atleta on public.suplementos (atleta_id) where activo;
alter table public.suplementos enable row level security;
revoke all on public.suplementos from public, anon, authenticated;

create table if not exists public.suplementos_tomas (
  suplemento_id uuid not null references public.suplementos(id) on delete cascade,
  atleta_id uuid not null references public.atletas(id) on delete cascade,
  fecha date not null,
  creado_en timestamptz not null default now(),
  primary key (suplemento_id, fecha)
);
create index if not exists suplementos_tomas_atleta on public.suplementos_tomas (atleta_id, fecha);
alter table public.suplementos_tomas enable row level security;
revoke all on public.suplementos_tomas from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Las funciones
-- ---------------------------------------------------------------------
-- Quién los mira: el atleta, los suyos; el coach, los de cualquiera (p_atleta)
create or replace function fbe_privado.suplementos_atleta(p_atleta uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.es_coach() then
    if p_atleta is null or not exists (select 1 from public.atletas where id = p_atleta) then raise exception 'Ese atleta no existe' using errcode = '22023'; end if;
    return p_atleta;
  end if;
  if public.mi_atleta_id() is null then raise exception 'Solo el atleta o su coach' using errcode = '42501'; end if;
  return public.mi_atleta_id();
end $$;

create or replace function fbe_privado.suplemento_json(s public.suplementos) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', s.id, 'atleta_id', s.atleta_id, 'clave', s.clave, 'nombre', s.nombre, 'dosis', s.dosis, 'momento', s.momento,
    'aviso_hora', to_char(s.aviso_hora, 'HH24:MI'), 'origen', s.origen, 'activo', s.activo, 'creado_en', s.creado_en);
$$;

-- Sus suplementos activos (con p_todos, también los archivados) y los días que los tomó desde p_desde (de entrada, 35 días)
create or replace function public.suplementos_de(p_atleta uuid default null, p_desde date default null, p_todos boolean default false) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_atleta uuid := fbe_privado.suplementos_atleta(p_atleta); v_hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
  return jsonb_build_object(
    'suplementos', coalesce((select jsonb_agg(fbe_privado.suplemento_json(s) order by s.creado_en, s.id) from public.suplementos s
      where s.atleta_id = v_atleta and (s.activo or coalesce(p_todos, false))), '[]'::jsonb),
    'tomas', coalesce((select jsonb_agg(jsonb_build_object('suplemento_id', t.suplemento_id, 'fecha', t.fecha) order by t.fecha, t.suplemento_id)
      from public.suplementos_tomas t where t.atleta_id = v_atleta and t.fecha >= coalesce(p_desde, v_hoy - 35)), '[]'::jsonb));
end $$;

-- Añadir uno (sin «id») o cambiarlo (con «id»). El coach, los de cualquiera; el atleta, solo los que puso él.
-- Hasta 8 activos por atleta. Claves de p_datos: id, clave, nombre, dosis, momento
create or replace function public.suplemento_guardar(p_atleta uuid, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_atleta uuid := fbe_privado.suplementos_atleta(p_atleta);
  v_coach boolean := public.es_coach();
  v public.suplementos; v_id uuid; v_clave text; v_nombre text; v_dosis text; v_momento text;
begin
  if not v_coach and public.esta_de_baja() then raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada'; end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object'
     or exists (select 1 from jsonb_each(p_datos) e where e.key in ('id', 'clave', 'nombre', 'dosis', 'momento') and jsonb_typeof(e.value) not in ('string', 'null')) then
    raise exception 'Esos datos no valen' using errcode = '22023';
  end if;
  v_nombre := fbe_privado.texto_limpio(p_datos ->> 'nombre');
  v_dosis := fbe_privado.texto_limpio(p_datos ->> 'dosis');
  v_clave := nullif(p_datos ->> 'clave', '');
  v_momento := coalesce(nullif(p_datos ->> 'momento', ''), 'cuando');
  if v_nombre is null then raise exception 'Ponle un nombre' using errcode = '22023'; end if;
  if char_length(v_nombre) > 40 then raise exception 'El nombre, como mucho 40 caracteres' using errcode = '22023'; end if;
  if char_length(v_dosis) > 40 then raise exception 'La dosis, como mucho 40 caracteres' using errcode = '22023'; end if;
  if v_clave is not null and v_clave !~ '^[a-z0-9-]{1,30}$' then raise exception 'Ese suplemento no está en la lista' using errcode = '22023'; end if;
  if v_momento not in ('manana', 'antes', 'despues', 'comida', 'noche', 'cuando') then raise exception 'Ese momento no vale' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('fbe-suplementos:' || v_atleta::text));
  if p_datos ->> 'id' is not null then
    begin v_id := (p_datos ->> 'id')::uuid; exception when others then raise exception 'Ese suplemento no existe' using errcode = '22023'; end;
    select * into v from public.suplementos where id = v_id and atleta_id = v_atleta for update;
    -- (revisión) uno archivado no se cambia, y el nombre nuevo tampoco puede repetir el de otro activo
    if v.id is null or not v.activo then raise exception 'Ese suplemento no existe' using errcode = '22023'; end if;
    if exists (select 1 from public.suplementos where atleta_id = v_atleta and activo and id <> v_id and lower(nombre) = lower(v_nombre)) then
      raise exception 'Ese ya está en la lista' using errcode = '22023';
    end if;
    if not v_coach and v.origen <> 'atleta' then raise exception 'Este te lo ha pautado tu coach: pídele a él que lo cambie' using errcode = '42501'; end if;
    update public.suplementos set clave = v_clave, nombre = v_nombre, dosis = v_dosis, momento = v_momento where id = v_id returning * into v;
    return fbe_privado.suplemento_json(v);
  end if;
  if (select count(*) from public.suplementos where atleta_id = v_atleta and activo) >= 8 then
    raise exception 'Como mucho, 8 suplementos a la vez: quita alguno antes' using errcode = '22023';
  end if;
  if exists (select 1 from public.suplementos where atleta_id = v_atleta and activo and lower(nombre) = lower(v_nombre)) then
    raise exception 'Ese ya está en la lista' using errcode = '22023';
  end if;
  -- (revisión) y, contando los archivados, 100 por atleta
  if (select count(*) from public.suplementos where atleta_id = v_atleta) >= 100 then
    raise exception 'Has añadido y quitado demasiados: escribe a tu coach' using errcode = '22023';
  end if;
  insert into public.suplementos (atleta_id, clave, nombre, dosis, momento, origen)
    values (v_atleta, v_clave, v_nombre, v_dosis, v_momento, case when v_coach then 'coach' else 'atleta' end) returning * into v;
  return fbe_privado.suplemento_json(v);
end $$;

-- Quitarlo: se archiva (lo apuntado se conserva). El coach, cualquiera; el atleta, solo los que puso él
create or replace function public.suplemento_quitar(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.suplementos;
begin
  select * into v from public.suplementos where id = p_id for update;
  if v.id is null then return; end if;
  if not public.es_coach() then
    if v.atleta_id is distinct from public.mi_atleta_id() then raise exception 'Eso no es tuyo' using errcode = '42501'; end if;
    if public.esta_de_baja() then raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada'; end if;
    if v.origen <> 'atleta' then raise exception 'Este te lo ha pautado tu coach: pídele a él que lo quite' using errcode = '42501'; end if;
  end if;
  update public.suplementos set activo = false, aviso_hora = null where id = p_id;
end $$;

-- El aviso al móvil lo elige el atleta (también en los que le pauta su coach): su hora («HH:MM», hora de España) o null
create or replace function public.suplemento_aviso(p_id uuid, p_hora text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.suplementos; v_hora time;
begin
  select * into v from public.suplementos where id = p_id for update;
  if v.id is null or v.atleta_id is distinct from public.mi_atleta_id() or not v.activo then raise exception 'Eso no es tuyo' using errcode = '42501'; end if;
  if public.esta_de_baja() then raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada'; end if;
  if p_hora is not null then
    if p_hora !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Esa hora no vale' using errcode = '22023'; end if;
    v_hora := p_hora::time;
    if v_hora < time '05:00' or v_hora > time '23:30' then raise exception 'La hora del aviso, entre las 5:00 y las 23:30' using errcode = '22023'; end if;
  end if;
  update public.suplementos set aviso_hora = v_hora where id = p_id returning * into v;
  return fbe_privado.suplemento_json(v);
end $$;

-- El atleta marca (o desmarca) que lo ha tomado: hoy o ayer
create or replace function public.suplemento_tomar(p_id uuid, p_fecha date default null, p_hecho boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.suplementos; v_hoy date := (now() at time zone 'Europe/Madrid')::date; v_fecha date := coalesce(p_fecha, (now() at time zone 'Europe/Madrid')::date);
begin
  select * into v from public.suplementos where id = p_id;
  if v.id is null or v.atleta_id is distinct from public.mi_atleta_id() or not v.activo then raise exception 'Eso no es tuyo' using errcode = '42501'; end if;
  if public.esta_de_baja() then raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada'; end if;
  -- (un día de margen por delante: quien está de viaje en otra zona horaria)
  if v_fecha < v_hoy - 1 or v_fecha > v_hoy + 1 then raise exception 'Solo se marca lo de hoy o lo de ayer' using errcode = '22023'; end if;
  if coalesce(p_hecho, true) then
    insert into public.suplementos_tomas (suplemento_id, atleta_id, fecha) values (v.id, v.atleta_id, v_fecha) on conflict do nothing;
  else
    delete from public.suplementos_tomas where suplemento_id = v.id and fecha = v_fecha;
  end if;
end $$;

comment on function public.suplementos_de(uuid, date, boolean) is 'Los suplementos de un atleta y los días que los tomó. El atleta, los suyos; el coach, los de cualquiera.';
comment on function public.suplemento_guardar(uuid, jsonb) is 'Añade o cambia un suplemento (hasta 8 activos). El coach, los de cualquiera; el atleta, solo los que puso él.';
comment on function public.suplemento_quitar(uuid) is 'Archiva un suplemento. El coach, cualquiera; el atleta, solo los que puso él.';
comment on function public.suplemento_aviso(uuid, text) is 'El atleta elige la hora de su aviso (o lo quita).';
comment on function public.suplemento_tomar(uuid, date, boolean) is 'El atleta marca o desmarca que lo ha tomado (hoy o ayer).';

-- ---------------------------------------------------------------------
-- 3. El aviso al móvil
-- ---------------------------------------------------------------------
alter table public.notificaciones drop constraint if exists notificaciones_validas;
alter table public.notificaciones add constraint notificaciones_validas check (
  tipo in ('respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario',
           'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido', 'prueba', 'descanso', 'comunidad',
           'tarea', 'tarea_hecha', 'repaso', 'suplementos')
  and char_length(titulo) between 1 and 80
  and (cuerpo is null or char_length(cuerpo) <= 160)
  and (url in ('#hoy', '#semana', '#checkin', '#progreso', '#perfil', '#atletas', '#revisar', '#cuenta', '#mensajes', '#equipo')
       or url ~ '^#mensajes/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or url ~ '^#videos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(@[0-9]{1,4}(\.[0-9])?)?$')
  and char_length(clave) between 1 and 100
  and estado in ('pendiente', 'enviando', 'enviada', 'caducada', 'fallida')
  and (canal is null or canal in ('push', 'email'))
  and intentos between 0 and 100
  and (error is null or char_length(error) <= 200)
) not valid;
alter table public.preferencias_notificaciones drop constraint if exists preferencias_notificaciones_validas;
alter table public.preferencias_notificaciones add constraint preferencias_notificaciones_validas check (
  desactivados <@ array['respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario',
                        'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido', 'descanso', 'comunidad',
                        'tarea', 'tarea_hecha', 'repaso', 'suplementos']::text[]
  and hora_manana between time '05:00' and time '12:00' and extract(second from hora_manana) = 0
  and hora_tarde between time '12:00' and time '23:30' and extract(second from hora_tarde) = 0
  and dia_checkin between 1 and 7
  and (silencio_desde is null) = (silencio_hasta is null)
  and (silencio_desde is null or (silencio_desde <> silencio_hasta
       and extract(second from silencio_desde) = 0 and extract(second from silencio_hasta) = 0))
);


-- (revisión) El aviso de un suplemento es un recordatorio con su hora: el «no molestar» no lo retrasa (como los de la
-- sesión, el check-in, los hábitos y la nutrición). La función, la de la 011, con el tipo nuevo en esa lista
create or replace function fbe_privado.notificar(
  p_usuario uuid, p_tipo text, p_titulo text, p_cuerpo text, p_url text, p_clave text,
  p_desde timestamptz default null, p_caduca timestamptz default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  pr public.preferencias_notificaciones;
  v_desde timestamptz := coalesce(p_desde, now());
  v_caduca timestamptz;
begin
  if p_usuario is null then return false; end if;
  select * into pr from public.preferencias_notificaciones where usuario_id = p_usuario;
  if p_tipo <> 'prueba' and p_tipo = any (coalesce(pr.desactivados, '{sesion_hecha}'::text[])) then return false; end if;
  if not coalesce(pr.email, false)
     and not exists (select 1 from public.suscripciones_push s where s.usuario_id = p_usuario) then
    return false;
  end if;
  if p_tipo not in ('sesion_hoy', 'checkin', 'habitos', 'nutricion', 'prueba', 'suplementos') then
    if pr.usuario_id is null then
      v_desde := fbe_privado.fuera_de_silencio(v_desde, time '22:30', time '08:00');
    else
      v_desde := fbe_privado.fuera_de_silencio(v_desde, pr.silencio_desde, pr.silencio_hasta);
    end if;
  end if;
  v_caduca := coalesce(p_caduca, v_desde + interval '1 day');
  if v_caduca <= v_desde then return false; end if;
  insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, url, clave, enviar_desde, caduca_en)
  values (p_usuario, p_tipo, coalesce(fbe_privado.linea(p_titulo, 80), 'FBE Atletas'), fbe_privado.linea(p_cuerpo, 160),
          p_url, left(p_clave, 100), v_desde, v_caduca)
  on conflict (usuario_id, clave) do nothing;
  return found;
end $$;

-- A la hora que eligió (hora de España) y durante la hora siguiente, si aún no lo ha marcado hoy: un aviso por atleta
-- y hora («Te toca: Creatina» o «Te tocan 2 suplementos»). Caduca a las 3 horas
create or replace function fbe_privado.recordatorios_suplementos(p_ahora timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_local timestamp := p_ahora at time zone 'Europe/Madrid';
  v_hoy date := (p_ahora at time zone 'Europe/Madrid')::date;
  v_n integer := 0;
begin
  with x as materialized (
    select d.perfil_id, s.aviso_hora, count(*) as n, min(s.nombre) as nombre
    from fbe_privado.destinatarios d
    join public.suplementos s on s.atleta_id = d.atleta_id and s.activo and s.aviso_hora is not null
    where not ('suplementos' = any (d.desactivados))
      and v_local >= v_hoy + s.aviso_hora and v_local < v_hoy + s.aviso_hora + interval '1 hour'
      and not exists (select 1 from public.suplementos_tomas t where t.suplemento_id = s.id and t.fecha = v_hoy)
    group by d.perfil_id, s.aviso_hora
  )
  select count(*) into v_n from x
  where fbe_privado.notificar_seguro(x.perfil_id, 'suplementos',
          case when x.n = 1 then 'Te toca: ' || left(x.nombre, 40) else 'Te tocan ' || x.n || ' suplementos' end,
          'Márcalo en Hoy cuando lo tomes.',
          '#hoy', 'recordatorio_suplementos:' || v_hoy || ':' || to_char(x.aviso_hora, 'HH24MI'), p_ahora,
          (v_hoy + x.aviso_hora + interval '3 hours') at time zone 'Europe/Madrid');
  return v_n;
end $$;

create or replace function public.crear_recordatorios_apuntes(p_ahora timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_local timestamp := p_ahora at time zone 'Europe/Madrid';
  v_hoy date := (p_ahora at time zone 'Europe/Madrid')::date;
  v_n integer := 0;
begin
  perform fbe_privado.solo_servidor();
  with x as materialized (
    select d.perfil_id, d.hora_tarde, count(v.apunte) as n
    from fbe_privado.destinatarios d
    join public.apuntes_vistos v on v.atleta_id = d.atleta_id and v.proxima is not null and v.proxima <= v_hoy
    where not ('repaso' = any (d.desactivados))
      and v_local >= v_hoy + d.hora_tarde - interval '2 hours' and v_local < v_hoy + d.hora_tarde
      and not exists (select 1 from public.bloques b
                      join public.semanas w on w.bloque_id = b.id
                      join public.sesiones s on s.semana_id = w.id and s.dia_previsto = v_hoy
                      where b.atleta_id = d.atleta_id and not b.es_plantilla and b.estado not in ('cancelado', 'finalizado'))
    group by d.perfil_id, d.hora_tarde
    having count(v.apunte) >= 3
  )
  select count(*) into v_n from x
  where fbe_privado.notificar_seguro(x.perfil_id, 'repaso',
          'Tienes ' || least(x.n, 99) || ' apuntes por repasar',
          'Un par de minutos y no se te olvidan. Están en Semana, en «Tus apuntes».',
          '#semana', 'recordatorio_repaso:' || v_hoy, p_ahora,
          (v_hoy + x.hora_tarde + interval '2 hours') at time zone 'Europe/Madrid');
  -- (077) y, en la misma pasada, los avisos de los suplementos (así no hace falta volver a desplegar la función del servidor).
  -- (revisión) Si esa parte fallara, los de los apuntes salen igual
  begin
    v_n := v_n + fbe_privado.recordatorios_suplementos(p_ahora);
  exception when others then
    raise warning 'FBE: avisos de suplementos no creados: %', sqlerrm;
  end;
  return v_n;
end $$;

-- La copia completa del coach, también con los suplementos
create or replace function public.copia_privada() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  return jsonb_build_object(
    'personal_atleta', coalesce((select jsonb_agg(to_jsonb(t)) from public.personal_atleta t), '[]'::jsonb),
    'mensajes_coach', coalesce((select jsonb_agg(to_jsonb(t)) from public.mensajes_coach t), '[]'::jsonb),
    'musica_coach', coalesce((select jsonb_agg(to_jsonb(t)) from public.musica_coach t), '[]'::jsonb),
    'integraciones', coalesce((select jsonb_agg(to_jsonb(t) - 'salud_huella' - 'calendario_huella') from public.integraciones t), '[]'::jsonb),
    'salud_diaria', coalesce((select jsonb_agg(to_jsonb(t)) from public.salud_diaria t), '[]'::jsonb),
    'salud_copias', coalesce((select jsonb_agg(to_jsonb(t)) from public.salud_copias t), '[]'::jsonb),
    'atajos_coach', coalesce((select jsonb_agg(to_jsonb(t)) from public.atajos_coach t), '[]'::jsonb),
    'contacto_atleta', coalesce((select jsonb_agg(to_jsonb(t)) from public.contacto_atleta t), '[]'::jsonb),
    'agenda_vida', coalesce((select jsonb_agg(to_jsonb(t)) from public.agenda_vida t), '[]'::jsonb),
    'musica_sesion', coalesce((select jsonb_agg(to_jsonb(t)) from public.musica_sesion t), '[]'::jsonb),
    'musica_aperturas_lista', coalesce((select jsonb_agg(to_jsonb(t)) from public.musica_aperturas_lista t), '[]'::jsonb),
    'musica_biblioteca', coalesce((select jsonb_agg(to_jsonb(t)) from public.musica_biblioteca t), '[]'::jsonb),
    'musica_retos', coalesce((select jsonb_agg(to_jsonb(t)) from public.musica_retos t), '[]'::jsonb),
    'portadas', coalesce((select jsonb_agg(to_jsonb(t)) from public.portadas t), '[]'::jsonb),
    'objetivos_propuestos', coalesce((select jsonb_agg(to_jsonb(t)) from public.objetivos_propuestos t), '[]'::jsonb),
    'objetivos_rondas', coalesce((select jsonb_agg(to_jsonb(t)) from public.objetivos_rondas t), '[]'::jsonb),
    'suplementos', coalesce((select jsonb_agg(to_jsonb(t)) from public.suplementos t), '[]'::jsonb),
    'suplementos_tomas', coalesce((select jsonb_agg(to_jsonb(t)) from public.suplementos_tomas t), '[]'::jsonb));
end $$;
comment on function public.copia_privada() is 'Para la copia completa del coach: las tablas de la 050 y la 051 (sin las huellas de los enlaces), la agenda (069), la música 3 (072), las portadas (073), las propuestas de objetivo (076) y los suplementos (077). Solo el coach.';

-- ---------------------------------------------------------------------
-- 4. Permisos (como al final de 003 a 076)
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
revoke all on all functions in schema fbe_privado from public, anon, authenticated;
-- (revisión de la 072) la comprobación de las columnas de música la usa una restricción: el servidor (service_role) también tiene que poder llamarla
grant execute on function fbe_privado.musica_url_valida(text) to service_role;

insert into public.fbe_migraciones (numero) values (77)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
