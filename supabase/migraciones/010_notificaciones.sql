-- =====================================================================
-- FBE Atletas, migración 010 (v0.12): notificaciones al móvil
-- 1. Suscripciones (Web Push): cada móvil u ordenador en el que alguien activa las notificaciones.
-- 2. Preferencias de cada cuenta: qué tipos quiere, a qué hora los recordatorios, «no molestar» y email.
-- 3. Notificaciones: la cola de lo que hay que enviar. La llenan los disparadores de esta migración (el
--    coach responde, publica una semana o un aviso; el atleta escribe, manda el check-in, sube un vídeo o
--    termina una sesión) y los recordatorios (sesión de hoy, check-in, hábitos y nutrición). La vacía la
--    función «enviar-notificaciones» de Supabase (supabase/functions/), que se llama cada minuto.
--
-- Las notificaciones no llevan datos de salud ni el texto de los mensajes: solo quién y dónde
-- («Pelayo te ha respondido · En Pierna A»), porque se ven con el móvil bloqueado.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 009 (o con instalar.sql en una
-- base nueva). Se puede repetir sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guardia: si la base ya tiene una migración posterior, esta no se repite (desharía lo que
-- cambiaron las siguientes). Al terminar, queda apuntada en fbe_migraciones.
-- ---------------------------------------------------------------------
create table if not exists public.fbe_migraciones (
  numero      smallint primary key,
  aplicada_en timestamptz not null default now()
);
alter table public.fbe_migraciones enable row level security;
revoke all on public.fbe_migraciones from public, anon, authenticated;
do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 10 then
    raise exception 'Esta base ya tiene la migración %: repetir la 010 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 10;» y, después de ella, todas las siguientes en orden.';
  end if;
  -- Y antes, la anterior: la 010 usa texto_visible (009)
  if not exists (select 1 from public.fbe_migraciones where numero = 9) then
    raise exception 'Antes de la 010 hace falta la 009: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 0. Un esquema aparte para lo interno: lo que no debe poder llamar nadie desde la app (crear
--    notificaciones a otros, los disparadores). Supabase solo expone «public», y aquí las cuentas de la
--    app no tienen ni USAGE, así que aunque una migración futura vuelva a dar EXECUTE en «public» a todo,
--    esto sigue cerrado.
-- ---------------------------------------------------------------------
create schema if not exists fbe_privado;
revoke all on schema fbe_privado from public, anon, authenticated;
-- Y sus funciones, sin EXECUTE para nadie de entrada (por si algún día se diera USAGE en el esquema)
alter default privileges in schema fbe_privado revoke execute on functions from public;

-- ---------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------
create table if not exists public.suscripciones_push (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.perfiles(id) on delete cascade,
  endpoint      text not null unique,   -- la dirección del servicio de push de ese navegador (secreta)
  p256dh        text not null,          -- clave pública del navegador (cifrado de extremo a extremo)
  auth          text not null,          -- secreto de autenticación del navegador
  dispositivo   text,                   -- «Android · Chrome», para reconocerlo en la lista
  creada_en     timestamptz not null default now(),
  usada_en      timestamptz,
  fallos        smallint not null default 0,
  ultimo_error  text,
  vapid         text                    -- la clave pública VAPID con la que se activó (si se cambian, ya no vale)
);
alter table public.suscripciones_push add column if not exists vapid text;
create index if not exists suscripciones_push_usuario_idx on public.suscripciones_push (usuario_id);

-- Solo los servicios de push de los navegadores (Chrome/Android, Firefox, Safari/iPhone, Edge): la función de
-- envío hace POST a esta dirección, así que no puede ser cualquier sitio. Claves con su forma exacta
-- (base64url sin relleno: 65 bytes de punto P-256 sin comprimir y 16 de secreto).
alter table public.suscripciones_push drop constraint if exists suscripciones_push_valida;
alter table public.suscripciones_push add constraint suscripciones_push_valida check (
  char_length(endpoint) <= 1024
  and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/[!-~]+$'
  and p256dh ~ '^B[A-Za-z0-9_-]{86}$'
  and auth ~ '^[A-Za-z0-9_-]{22}$'
  and (dispositivo is null or (char_length(dispositivo) <= 60 and public.texto_visible(dispositivo)))
  and fallos between 0 and 1000
  and (ultimo_error is null or char_length(ultimo_error) <= 200)
  and (vapid is null or vapid ~ '^B[A-Za-z0-9_-]{86}$')
);

-- Tipos de notificación. Del atleta: respuesta (el coach le responde), semana (publicada), aviso (del coach),
-- sesion_hoy, checkin, habitos y nutricion (recordatorios). Del coach: mensaje (le escribe un atleta),
-- checkin_recibido, video_recibido y sesion_hecha. Y «prueba» (la que se envía uno mismo).
create table if not exists public.preferencias_notificaciones (
  usuario_id      uuid primary key default auth.uid() references public.perfiles(id) on delete cascade,
  desactivados    text[] not null default '{sesion_hecha}',  -- tipos que no quiere (de entrada, las sesiones hechas)
  hora_manana     time not null default '08:30',             -- «hoy toca…»
  hora_tarde      time not null default '21:00',             -- hábitos, nutrición y check-in
  dia_checkin     smallint not null default 7,               -- día del recordatorio del check-in (1 lunes … 7 domingo)
  silencio_desde  time default '22:30',                      -- «no molestar» (sin las dos, nunca)
  silencio_hasta  time default '08:00',
  email           boolean not null default false,            -- por email si no tiene ningún móvil que funcione
  actualizado_en  timestamptz not null default now()
);

-- («not valid»: si alguna vez hay que repetir esta migración, las filas que ya existen no se vuelven a mirar;
-- las migraciones siguientes amplían la lista de tipos y las suyas sí valen)
alter table public.preferencias_notificaciones drop constraint if exists preferencias_notificaciones_validas;
alter table public.preferencias_notificaciones add constraint preferencias_notificaciones_validas check (
  desactivados <@ array['respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion',
                        'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha']::text[]
  and hora_manana between time '05:00' and time '12:00' and extract(second from hora_manana) = 0
  and hora_tarde between time '12:00' and time '23:30' and extract(second from hora_tarde) = 0
  and dia_checkin between 1 and 7
  and (silencio_desde is null) = (silencio_hasta is null)
  and (silencio_desde is null or (silencio_desde <> silencio_hasta
       and extract(second from silencio_desde) = 0 and extract(second from silencio_hasta) = 0))
) not valid;

create table if not exists public.notificaciones (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.perfiles(id) on delete cascade,
  tipo          text not null,
  titulo        text not null,
  cuerpo        text,
  url           text not null default '#hoy',     -- a qué pestaña lleva al tocarla
  clave         text not null,                    -- evita duplicados: una por usuario y clave
  creado_en     timestamptz not null default now(),
  enviar_desde  timestamptz not null default now(),
  caduca_en     timestamptz not null,             -- si no ha salido para entonces, ya no se envía
  estado        text not null default 'pendiente',
  canal         text,
  intentos      smallint not null default 0,
  tomada_en     timestamptz,
  enviada_en    timestamptz,
  error         text,
  unique (usuario_id, clave)
);
create index if not exists notificaciones_cola_idx on public.notificaciones (enviar_desde)
  where estado in ('pendiente', 'enviando');
create index if not exists notificaciones_usuario_idx on public.notificaciones (usuario_id, creado_en desc);
create index if not exists notificaciones_clave_idx on public.notificaciones (clave);

alter table public.notificaciones drop constraint if exists notificaciones_validas;
alter table public.notificaciones add constraint notificaciones_validas check (
  tipo in ('respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion',
           'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'prueba')
  and char_length(titulo) between 1 and 80
  and (cuerpo is null or char_length(cuerpo) <= 160)
  and url in ('#hoy', '#semana', '#checkin', '#progreso', '#perfil', '#atletas', '#revisar', '#cuenta')
  and char_length(clave) between 1 and 100
  and estado in ('pendiente', 'enviando', 'enviada', 'caducada', 'fallida')
  and (canal is null or canal in ('push', 'email'))
  and intentos between 0 and 100
  and (error is null or char_length(error) <= 200)
) not valid;

-- ---------------------------------------------------------------------
-- 2. Piezas internas (fbe_privado)
-- ---------------------------------------------------------------------

-- Lo que solo puede hacer el servidor (la función de envío con su clave de servicio) o tú desde el SQL Editor
create or replace function fbe_privado.solo_servidor() returns void
language plpgsql set search_path = '' as $$
begin
  if coalesce(nullif(current_setting('role', true), ''), 'none') not in ('none', 'service_role', 'postgres') then
    raise exception 'Solo el servidor puede hacer esto' using errcode = '42501';
  end if;
end $$;

-- «Pelayo» de «Pelayo Pérez»; null si no hay nombre
create or replace function fbe_privado.nombre_corto(p text) returns text
language sql immutable set search_path = '' as $$
  select left(nullif(split_part(btrim(regexp_replace(coalesce(p, ''), '[[:space:][:cntrl:]]+', ' ', 'g')), ' ', 1), ''), 30)
$$;

-- Una línea limpia (sin saltos ni caracteres de control), para títulos y cuerpos
create or replace function fbe_privado.linea(p text, p_max integer) returns text
language sql immutable set search_path = '' as $$
  select nullif(left(btrim(regexp_replace(coalesce(p, ''), '[[:space:][:cntrl:]]+', ' ', 'g')), p_max), '')
$$;

-- «20 de octubre»
create or replace function fbe_privado.fecha_texto(d date) returns text
language sql immutable set search_path = '' as $$
  select extract(day from d)::int || ' de ' || (array['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'])[extract(month from d)::int]
$$;

-- Si el momento cae en el «no molestar» (hora de España), el final de ese silencio; si no, el mismo momento.
-- El silencio puede cruzar la medianoche (22:30 → 08:00).
create or replace function fbe_privado.fuera_de_silencio(p_momento timestamptz, p_desde time, p_hasta time)
returns timestamptz language plpgsql stable set search_path = '' as $$
declare
  l timestamp := p_momento at time zone 'Europe/Madrid';
  t time := l::time;
  d date := l::date;
begin
  if p_desde is null or p_hasta is null or p_desde = p_hasta then return p_momento; end if;
  if p_desde > p_hasta then
    if t >= p_desde then return ((d + 1) + p_hasta) at time zone 'Europe/Madrid'; end if;
    if t < p_hasta then return (d + p_hasta) at time zone 'Europe/Madrid'; end if;
  elsif t >= p_desde and t < p_hasta then
    return (d + p_hasta) at time zone 'Europe/Madrid';
  end if;
  return p_momento;
end $$;

-- Pone una notificación en la cola, si esa cuenta la quiere y tiene por dónde recibirla (algún móvil
-- activado o el email). Las de cosas que pasan respetan su «no molestar» (salen al acabar); los
-- recordatorios, no: su hora la ha elegido ella. Devuelve si la ha creado (una por usuario y clave).
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
  if p_tipo in ('respuesta', 'semana', 'aviso', 'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha') then
    if pr.usuario_id is null then
      v_desde := fbe_privado.fuera_de_silencio(v_desde, time '22:30', time '08:00');
    else
      v_desde := fbe_privado.fuera_de_silencio(v_desde, pr.silencio_desde, pr.silencio_hasta);
    end if;
  end if;
  -- Si para cuando puede salir ya ha caducado (un aviso que acaba hoy, de noche), no sale
  v_caduca := coalesce(p_caduca, v_desde + interval '1 day');
  if v_caduca <= v_desde then return false; end if;
  insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, url, clave, enviar_desde, caduca_en)
  values (p_usuario, p_tipo, coalesce(fbe_privado.linea(p_titulo, 80), 'FBE Atletas'), fbe_privado.linea(p_cuerpo, 160),
          p_url, left(p_clave, 100), v_desde, v_caduca)
  on conflict (usuario_id, clave) do nothing;
  return found;
end $$;

-- La misma, sin que un fallo con una persona impida avisar a las demás (para los envíos a varias)
create or replace function fbe_privado.notificar_seguro(
  p_usuario uuid, p_tipo text, p_titulo text, p_cuerpo text, p_url text, p_clave text,
  p_desde timestamptz default null, p_caduca timestamptz default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  return fbe_privado.notificar(p_usuario, p_tipo, p_titulo, p_cuerpo, p_url, p_clave, p_desde, p_caduca);
exception when others then
  raise warning 'FBE: notificación % para % no creada: %', p_clave, p_usuario, sqlerrm;
  return false;
end $$;

-- ---------------------------------------------------------------------
-- 3. Disparadores: cada uno, «after» y a prueba de fallos (si algo de la notificación saliera mal, lo que
--    se estaba guardando se guarda igual: la notificación es lo de menos).
-- ---------------------------------------------------------------------

-- Comentarios: del coach → al atleta («Pelayo te ha respondido»); del atleta → al coach («Ana te ha escrito»)
create or replace function fbe_privado.al_comentar() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  a public.atletas;
  v_donde text;
begin
  select * into a from public.atletas where id = new.atleta_id;
  if a.id is null then return null; end if;
  v_donde := case
    when new.sesion_id is not null then (select 'En ' || s.nombre from public.sesiones s where s.id = new.sesion_id)
    when new.checkin_id is not null then case when new.autor = 'coach' then 'En tu check-in' else 'En su check-in' end
    when new.archivo_id is not null then case when new.autor = 'coach' then 'En tu vídeo' else 'En su vídeo' end
    else 'Mensaje nuevo' end;
  if new.autor = 'coach' then
    if a.estado = 'activo' then
      perform fbe_privado.notificar(a.perfil_id, 'respuesta',
        coalesce(fbe_privado.nombre_corto((select p.nombre from public.perfiles p where p.id = auth.uid())), 'Tu coach') || ' te ha respondido',
        v_donde, '#hoy', 'comentario:' || new.id);
    end if;
  else
    -- Al coach, una por atleta cada 10 minutos (si escribe cinco mensajes seguidos, una sola)
    perform fbe_privado.notificar_seguro(p.id, 'mensaje',
      coalesce(fbe_privado.nombre_corto(a.nombre), 'Un atleta') || ' te ha escrito', v_donde, '#revisar',
      'mensaje:' || a.id || ':' || floor(extract(epoch from now()) / 600)::bigint)
    from public.perfiles p where p.rol = 'coach' and p.id is distinct from auth.uid();
  end if;
  return null;
exception when others then
  raise warning 'FBE: notificación del comentario % no creada: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists comentarios_zz_notificar on public.comentarios;
create trigger comentarios_zz_notificar after insert on public.comentarios
  for each row execute function fbe_privado.al_comentar();

-- Semana publicada → al atleta
create or replace function fbe_privado.al_publicar_semana() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  v record;
begin
  -- Si se retira antes de que salga la notificación, ya no sale
  if new.programacion is distinct from 'programada' then
    if tg_op = 'UPDATE' and old.programacion = 'programada' then
      delete from public.notificaciones n where n.clave = 'semana:' || new.id and n.estado = 'pendiente';
    end if;
    return null;
  end if;
  if tg_op = 'UPDATE' and old.programacion = 'programada' then return null; end if;
  select a.perfil_id, a.estado, b.nombre as bloque, b.estado as estado_bloque into v
  from public.bloques b join public.atletas a on a.id = b.atleta_id
  where b.id = new.bloque_id and not b.es_plantilla;
  if not found or v.estado <> 'activo' or v.estado_bloque in ('cancelado', 'finalizado') then return null; end if;
  perform fbe_privado.notificar(v.perfil_id, 'semana',
    case when new.fecha_inicio > (now() at time zone 'Europe/Madrid')::date then 'Ya tienes tu próxima semana'
         else 'Tu semana ya está lista' end,
    'Semana ' || new.numero || ' de ' || v.bloque, '#semana', 'semana:' || new.id);
  return null;
exception when others then
  raise warning 'FBE: notificación de la semana % no creada: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists semanas_zz_notificar on public.semanas;
create trigger semanas_zz_notificar after insert or update of programacion on public.semanas
  for each row execute function fbe_privado.al_publicar_semana();

-- Aviso del coach → a quien va dirigido (o a todos los atletas activos). Sin su texto: puede ser personal y se
-- vería con el móvil bloqueado. Si empieza otro día, sale ese día a las 9:00; si caduca antes de salir, ya no
-- sale. Si lo cambias antes de que salga (a quién va, las fechas), la notificación se rehace.
create or replace function fbe_privado.al_crear_aviso() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_desde timestamptz;
  v_caduca timestamptz;
  v_titulo text;
begin
  if tg_op = 'UPDATE' then
    delete from public.notificaciones n where n.clave = 'aviso:' || new.id and n.estado = 'pendiente';
  end if;
  if new.hasta is not null and new.hasta < v_hoy then return null; end if;
  v_desde := case when new.desde > v_hoy then (new.desde + time '09:00') at time zone 'Europe/Madrid' else now() end;
  v_caduca := case when new.hasta is not null then (new.hasta + 1)::timestamp at time zone 'Europe/Madrid'
                   else v_desde + interval '1 day' end;
  v_titulo := coalesce('Aviso de ' || fbe_privado.nombre_corto((select p.nombre from public.perfiles p where p.id = auth.uid())), 'Aviso nuevo');
  perform fbe_privado.notificar_seguro(a.perfil_id, 'aviso', v_titulo, 'Tócalo para leerlo en la app.', '#hoy', 'aviso:' || new.id, v_desde, v_caduca)
  from public.atletas a
  where a.estado = 'activo' and a.perfil_id is not null and (new.atleta_id is null or a.id = new.atleta_id);
  return null;
exception when others then
  raise warning 'FBE: notificación del aviso % no creada: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists avisos_zz_notificar on public.avisos;
create trigger avisos_zz_notificar after insert or update of texto, atleta_id, desde, hasta on public.avisos
  for each row execute function fbe_privado.al_crear_aviso();

-- Check-in nuevo → al coach
create or replace function fbe_privado.al_enviar_checkin() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  v_nombre text;
begin
  select coalesce(fbe_privado.nombre_corto(a.nombre), 'Un atleta') into v_nombre from public.atletas a where a.id = new.atleta_id;
  -- Una por atleta y semana (borrar y volver a enviar el mismo check-in no avisa otra vez)
  perform fbe_privado.notificar_seguro(p.id, 'checkin_recibido', v_nombre || ' ha enviado su check-in',
    'Semana del ' || fbe_privado.fecha_texto(new.semana_inicio), '#revisar', 'checkin:' || new.atleta_id || ':' || new.semana_inicio)
  from public.perfiles p where p.rol = 'coach' and p.id is distinct from auth.uid();
  return null;
exception when others then
  raise warning 'FBE: notificación del check-in % no creada: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists checkins_zz_notificar on public.checkins;
create trigger checkins_zz_notificar after insert on public.checkins
  for each row execute function fbe_privado.al_enviar_checkin();

-- Vídeo de técnica nuevo → al coach, cinco minutos después (lo que tarda en subirse; si la subida falla, la app
-- borra el registro y la notificación ya no sale)
create or replace function fbe_privado.al_subir_video() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  v_nombre text;
  v_ejercicio text;
begin
  if new.tipo <> 'video_tecnica' then return null; end if;
  select coalesce(fbe_privado.nombre_corto(a.nombre), 'Un atleta') into v_nombre from public.atletas a where a.id = new.atleta_id;
  select e.nombre into v_ejercicio from public.sesion_ejercicios se join public.ejercicios e on e.id = se.ejercicio_id
  where se.id = new.sesion_ejercicio_id;
  perform fbe_privado.notificar_seguro(p.id, 'video_recibido', v_nombre || ' ha subido un vídeo',
    coalesce(v_ejercicio, 'Vídeo de técnica'), '#revisar', 'archivo:' || new.id, now() + interval '5 minutes')
  from public.perfiles p where p.rol = 'coach' and p.id is distinct from auth.uid();
  return null;
exception when others then
  raise warning 'FBE: notificación del vídeo % no creada: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists archivos_zz_notificar on public.archivos;
create trigger archivos_zz_notificar after insert on public.archivos
  for each row execute function fbe_privado.al_subir_video();

-- Sesión terminada → al coach (desactivadas de entrada en sus preferencias)
create or replace function fbe_privado.al_terminar_sesion() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  v_nombre text;
begin
  if not new.completada and old.completada then
    delete from public.notificaciones n where n.clave = 'sesion:' || new.id and n.estado = 'pendiente';
    return null;
  end if;
  if not new.completada or old.completada then return null; end if;
  select coalesce(fbe_privado.nombre_corto(a.nombre), 'Un atleta') into v_nombre
  from public.semanas w join public.bloques b on b.id = w.bloque_id join public.atletas a on a.id = b.atleta_id
  where w.id = new.semana_id;
  if v_nombre is null then return null; end if;
  perform fbe_privado.notificar_seguro(p.id, 'sesion_hecha', v_nombre || ' ha terminado ' || new.nombre,
    'Ya puedes revisarla.', '#revisar', 'sesion:' || new.id)
  from public.perfiles p where p.rol = 'coach' and p.id is distinct from auth.uid();
  return null;
exception when others then
  raise warning 'FBE: notificación de la sesión % no creada: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists sesiones_zz_notificar on public.sesiones;
create trigger sesiones_zz_notificar after update of completada on public.sesiones
  for each row execute function fbe_privado.al_terminar_sesion();

-- Si se borra lo que la originó antes de que salga, la notificación ya no sale
create or replace function fbe_privado.al_borrar_origen() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
begin
  delete from public.notificaciones n where n.clave = tg_argv[0] || old.id and n.estado = 'pendiente';
  return null;
exception when others then
  raise warning 'FBE: notificaciones de % no retiradas: %', old.id, sqlerrm;
  return null;
end $$;
drop trigger if exists comentarios_zz_retirar on public.comentarios;
create trigger comentarios_zz_retirar after delete on public.comentarios
  for each row execute function fbe_privado.al_borrar_origen('comentario:');
drop trigger if exists avisos_zz_retirar on public.avisos;
create trigger avisos_zz_retirar after delete on public.avisos
  for each row execute function fbe_privado.al_borrar_origen('aviso:');
-- (el del check-in va por atleta y semana: un check-in borrado antes de que salga, ya no avisa)
create or replace function fbe_privado.al_borrar_checkin() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
begin
  delete from public.notificaciones n where n.clave = 'checkin:' || old.atleta_id || ':' || old.semana_inicio and n.estado = 'pendiente';
  return null;
exception when others then
  raise warning 'FBE: notificaciones del check-in % no retiradas: %', old.id, sqlerrm;
  return null;
end $$;
drop trigger if exists checkins_zz_retirar on public.checkins;
create trigger checkins_zz_retirar after delete on public.checkins
  for each row execute function fbe_privado.al_borrar_checkin();
drop trigger if exists semanas_zz_retirar on public.semanas;
create trigger semanas_zz_retirar after delete on public.semanas
  for each row execute function fbe_privado.al_borrar_origen('semana:');
drop trigger if exists sesiones_zz_retirar on public.sesiones;
create trigger sesiones_zz_retirar after delete on public.sesiones
  for each row execute function fbe_privado.al_borrar_origen('sesion:');
drop trigger if exists archivos_zz_retirar on public.archivos;
create trigger archivos_zz_retirar after delete on public.archivos
  for each row execute function fbe_privado.al_borrar_origen('archivo:');

-- Las preferencias: fecha del cambio
create or replace function fbe_privado.al_cambiar_preferencias() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists preferencias_notificaciones_fecha on public.preferencias_notificaciones;
create trigger preferencias_notificaciones_fecha before insert or update on public.preferencias_notificaciones
  for each row execute function fbe_privado.al_cambiar_preferencias();

-- ---------------------------------------------------------------------
-- 4. Recordatorios. Los crea el servidor cada vez que la función de envío se ejecuta (cada minuto); cada
--    uno sale una vez al día, en las dos horas siguientes a la hora elegida, y caduca a las cuatro.
--    Solo a atletas activos, con cuenta y con por dónde recibirlos; los de hábitos, nutrición y check-in,
--    además, con el consentimiento de datos de salud (sin él no los apuntan en la app).
-- ---------------------------------------------------------------------
create or replace view fbe_privado.destinatarios with (security_barrier) as
select a.id as atleta_id, a.perfil_id,
       coalesce(p.desactivados, '{sesion_hecha}'::text[]) as desactivados,
       coalesce(p.hora_manana, time '08:30') as hora_manana,
       coalesce(p.hora_tarde, time '21:00') as hora_tarde,
       coalesce(p.dia_checkin, 7) as dia_checkin,
       exists (select 1 from public.consentimientos c
               where c.perfil_id = a.perfil_id and c.tipo = 'datos_salud' and c.revocado_en is null) as salud
from public.atletas a
left join public.preferencias_notificaciones p on p.usuario_id = a.perfil_id
where a.estado = 'activo' and a.perfil_id is not null
  and (coalesce(p.email, false) or exists (select 1 from public.suscripciones_push s where s.usuario_id = a.perfil_id));
revoke all on fbe_privado.destinatarios from public, anon, authenticated;

create or replace function public.crear_recordatorios(p_ahora timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_local timestamp := p_ahora at time zone 'Europe/Madrid';
  v_hoy date := (p_ahora at time zone 'Europe/Madrid')::date;
  v_dow integer := extract(isodow from (p_ahora at time zone 'Europe/Madrid'))::integer;
  v_lunes date;
  v_n integer := 0;
  v_m integer;
begin
  perform fbe_privado.solo_servidor();
  v_lunes := v_hoy - (v_dow - 1);

  -- Hoy toca… (solo si planificó el día de la sesión en «Tu plan»). Cada consulta elige primero a quién
  -- (materialized: así la notificación solo se crea para esas filas, sin depender del orden del WHERE)
  with x as materialized (
    select d.perfil_id, d.hora_manana, count(*) as n, min(s.nombre) as nombre
    from fbe_privado.destinatarios d
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
  return v_n;
end $$;

-- ---------------------------------------------------------------------
-- 5. Lo que usa la app
-- ---------------------------------------------------------------------

-- ¿Puede esta cuenta recibir notificaciones? Las de atletas vinculados a su ficha y la del coach (una cuenta
-- recién creada sin código no: no hay nada que avisarle, y así nadie usa el servidor para enviarse cosas)
create or replace function fbe_privado.puede_recibir(p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles p where p.id = p_uid and p.rol = 'coach')
      or exists (select 1 from public.atletas a where a.perfil_id = p_uid)
$$;

-- Activar las notificaciones en este navegador. Si esa dirección era de otra cuenta (mismo móvil, otra
-- persona), pasa a esta. Como mucho 10 por cuenta (se quedan las más recientes). p_vapid: la clave pública
-- con la que se suscribió (si cambia, la función de envío la retira).
create or replace function public.registrar_suscripcion_push(p_endpoint text, p_p256dh text, p_auth text,
  p_dispositivo text default null, p_vapid text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null or not fbe_privado.puede_recibir(v_uid) then
    raise exception 'Solo las cuentas vinculadas a una ficha (o la del coach) pueden activar las notificaciones' using errcode = '42501';
  end if;
  delete from public.suscripciones_push where endpoint = p_endpoint and usuario_id <> v_uid;
  insert into public.suscripciones_push as s (usuario_id, endpoint, p256dh, auth, dispositivo, vapid)
  values (v_uid, p_endpoint, p_p256dh, p_auth, fbe_privado.linea(p_dispositivo, 60), p_vapid)
  on conflict (endpoint) do update
    set usuario_id = excluded.usuario_id, p256dh = excluded.p256dh, auth = excluded.auth,
        dispositivo = coalesce(excluded.dispositivo, s.dispositivo), vapid = excluded.vapid, fallos = 0, ultimo_error = null
  returning s.id into v_id;
  delete from public.suscripciones_push where id in (
    select s.id from public.suscripciones_push s where s.usuario_id = v_uid
    order by coalesce(s.usada_en, s.creada_en) desc, s.creada_en desc offset 10);
  return v_id;
end $$;

-- Al abrir la app: si el navegador ha renovado su suscripción, la de esta cuenta se pone al día. Solo cambia
-- una que siga siendo suya (si la quitó desde otro móvil, no la recupera): devuelve si la había.
create or replace function public.actualizar_suscripcion_push(p_anterior text, p_endpoint text, p_p256dh text, p_auth text,
  p_vapid text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return false; end if;
  if p_endpoint is distinct from p_anterior then
    delete from public.suscripciones_push where endpoint = p_endpoint and usuario_id <> v_uid;
  end if;
  update public.suscripciones_push s
  set endpoint = p_endpoint, p256dh = p_p256dh, auth = p_auth, vapid = coalesce(p_vapid, s.vapid),
      fallos = case when s.endpoint = p_endpoint and s.p256dh = p_p256dh then s.fallos else 0 end
  where s.usuario_id = v_uid and s.endpoint = p_anterior;
  return found;
end $$;

-- «Enviarme una de prueba»: como mucho una por minuto. 'ok', 'sin_canal' (ni móvil ni email) o 'espera'.
create or replace function public.probar_notificacion() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_clave text := 'prueba:' || to_char(now() at time zone 'Europe/Madrid', 'YYYYMMDDHH24MI');
begin
  if v_uid is null or not fbe_privado.puede_recibir(v_uid) then
    raise exception 'Solo las cuentas vinculadas a una ficha (o la del coach) reciben notificaciones' using errcode = '42501';
  end if;
  if not exists (select 1 from public.suscripciones_push where usuario_id = v_uid)
     and not exists (select 1 from public.preferencias_notificaciones where usuario_id = v_uid and email) then
    return 'sin_canal';
  end if;
  if exists (select 1 from public.notificaciones where usuario_id = v_uid and clave = v_clave) then return 'espera'; end if;
  perform fbe_privado.notificar(v_uid, 'prueba', 'Notificaciones activadas', 'Así te llegarán los avisos de FBE Atletas.',
    case when exists (select 1 from public.perfiles where id = v_uid and rol = 'coach') then '#cuenta' else '#perfil' end,
    v_clave, now(), now() + interval '1 hour');
  return 'ok';
end $$;

-- ---------------------------------------------------------------------
-- 6. Lo que usa la función de envío (solo con la clave de servicio)
-- ---------------------------------------------------------------------

-- Toma las que tocan (y las que se quedaron a medias hace más de 10 minutos: la función nunca dura tanto),
-- como mucho p_limite, sin que dos envíos a la vez cojan las mismas. De paso, borra las ya terminadas de hace
-- más de 30 días y marca las que no salieron a tiempo. Con email: si la cuenta lo quiere, con el email
-- confirmado, y no ha recibido otro en la última hora (contado con las propias notificaciones, que nadie puede
-- borrar desde la app).
create or replace function public.notificaciones_por_enviar(p_limite integer default 100, p_email boolean default false)
returns table (id uuid, usuario_id uuid, tipo text, titulo text, cuerpo text, url text, caduca_en timestamptz,
               intentos smallint, email text, suscripciones jsonb)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform fbe_privado.solo_servidor();
  delete from public.notificaciones n
  where n.creado_en < now() - interval '30 days' and n.estado in ('enviada', 'caducada', 'fallida');
  update public.notificaciones n set estado = 'caducada'
  where n.caduca_en < now()
    and (n.estado = 'pendiente' or (n.estado = 'enviando' and n.tomada_en < now() - interval '10 minutes'));
  return query
  with candidatas as (
    select n.id from public.notificaciones n
    left join public.preferencias_notificaciones p on p.usuario_id = n.usuario_id
    where ((n.estado = 'pendiente' and n.enviar_desde <= now())
           or (n.estado = 'enviando' and n.tomada_en < now() - interval '10 minutes'))
      and n.intentos < 5
      and (exists (select 1 from public.suscripciones_push s where s.usuario_id = n.usuario_id)
           or (p_email and coalesce(p.email, false)
               and not exists (select 1 from public.notificaciones x
                               where x.usuario_id = n.usuario_id and x.canal = 'email' and x.enviada_en > now() - interval '1 hour')))
    order by n.enviar_desde
    limit greatest(1, least(coalesce(p_limite, 100), 500))
    for update of n skip locked
  ), tomadas as (
    update public.notificaciones n set estado = 'enviando', tomada_en = now(), intentos = n.intentos + 1
    from candidatas c where n.id = c.id
    returning n.id, n.usuario_id, n.tipo, n.titulo, n.cuerpo, n.url, n.caduca_en, n.intentos
  )
  select t.id, t.usuario_id, t.tipo, t.titulo, t.cuerpo, t.url, t.caduca_en, t.intentos,
         case when p_email and coalesce(p.email, false) and u.email_confirmed_at is not null then u.email::text end,
         coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
                                                       'vapid', s.vapid, 'fallos', s.fallos)
                                    order by s.creada_en)
                   from public.suscripciones_push s where s.usuario_id = t.usuario_id), '[]'::jsonb)
  from tomadas t
  left join public.preferencias_notificaciones p on p.usuario_id = t.usuario_id
  left join auth.users u on u.id = t.usuario_id;
end $$;

-- Lo que pasó con cada una. p_resultado: { enviadas: [{id, canal}], reintentar: [{id, error, esperar}],
-- fallidas: [{id, error}], suscripciones_ok: [id], suscripciones_caducadas: [id] (ya no existen o no pueden
-- recibir nada: se borran), suscripciones_error: [{id, error}] }.
-- Los reintentos esperan 1, 4, 9, 16 minutos (o lo que pida el servicio, hasta una hora); al quinto, fallida.
create or replace function public.notificaciones_resultado(p_resultado jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform fbe_privado.solo_servidor();
  update public.notificaciones n set estado = 'enviada', canal = e ->> 'canal', enviada_en = now(), error = null
  from jsonb_array_elements(coalesce(p_resultado -> 'enviadas', '[]'::jsonb)) e
  where n.id = (e ->> 'id')::uuid and n.estado = 'enviando';
  update public.notificaciones n
  set estado = case when n.intentos >= 5 then 'fallida' else 'pendiente' end,
      enviar_desde = now() + greatest(make_interval(mins => n.intentos * n.intentos),
                                      make_interval(secs => least(coalesce((e ->> 'esperar')::integer, 0), 3600))),
      error = left(e ->> 'error', 200)
  from jsonb_array_elements(coalesce(p_resultado -> 'reintentar', '[]'::jsonb)) e
  where n.id = (e ->> 'id')::uuid and n.estado = 'enviando';
  update public.notificaciones n set estado = 'fallida', error = left(e ->> 'error', 200)
  from jsonb_array_elements(coalesce(p_resultado -> 'fallidas', '[]'::jsonb)) e
  where n.id = (e ->> 'id')::uuid and n.estado = 'enviando';
  update public.suscripciones_push s set usada_en = now(), fallos = 0, ultimo_error = null
  where s.id in (select x::uuid from jsonb_array_elements_text(coalesce(p_resultado -> 'suscripciones_ok', '[]'::jsonb)) x);
  delete from public.suscripciones_push s
  where s.id in (select x::uuid from jsonb_array_elements_text(coalesce(p_resultado -> 'suscripciones_caducadas', '[]'::jsonb)) x);
  update public.suscripciones_push s set fallos = least(s.fallos + 1, 1000), ultimo_error = left(e ->> 'error', 200)
  from jsonb_array_elements(coalesce(p_resultado -> 'suscripciones_error', '[]'::jsonb)) e
  where s.id = (e ->> 'id')::uuid;
end $$;

-- ---------------------------------------------------------------------
-- 7. Permisos por fila: cada cuenta solo ve lo suyo
-- ---------------------------------------------------------------------
alter table public.suscripciones_push enable row level security;
drop policy if exists propias_ver on public.suscripciones_push;
create policy propias_ver on public.suscripciones_push for select to authenticated using (usuario_id = auth.uid());
drop policy if exists propias_borrar on public.suscripciones_push;
create policy propias_borrar on public.suscripciones_push for delete to authenticated using (usuario_id = auth.uid());

alter table public.preferencias_notificaciones enable row level security;
drop policy if exists propias_ver on public.preferencias_notificaciones;
create policy propias_ver on public.preferencias_notificaciones for select to authenticated using (usuario_id = auth.uid());
drop policy if exists propias_crear on public.preferencias_notificaciones;
create policy propias_crear on public.preferencias_notificaciones for insert to authenticated with check (usuario_id = auth.uid());
drop policy if exists propias_editar on public.preferencias_notificaciones;
create policy propias_editar on public.preferencias_notificaciones for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
drop policy if exists propias_borrar on public.preferencias_notificaciones;
create policy propias_borrar on public.preferencias_notificaciones for delete to authenticated using (usuario_id = auth.uid());

alter table public.notificaciones enable row level security;
drop policy if exists propias_ver on public.notificaciones;
create policy propias_ver on public.notificaciones for select to authenticated using (usuario_id = auth.uid());

-- ---------------------------------------------------------------------
-- Permisos (como al final de 003 a 009)
-- ---------------------------------------------------------------------
-- Las suscripciones solo entran por registrar_suscripcion_push; las notificaciones solo las crea la base.
-- De las preferencias, la app escribe lo que elige la persona (no la fecha del último email).
revoke all on public.suscripciones_push, public.preferencias_notificaciones, public.notificaciones from public, anon, authenticated;
grant select, delete on public.suscripciones_push to authenticated;
grant select, delete on public.preferencias_notificaciones to authenticated;
grant insert (usuario_id, desactivados, hora_manana, hora_tarde, dia_checkin, silencio_desde, silencio_hasta, email)
  on public.preferencias_notificaciones to authenticated;
-- (usuario_id también, porque PostgREST lo pone en el «on conflict do update» de un upsert; los permisos por
-- fila no dejan que sea otro que el propio)
grant update (usuario_id, desactivados, hora_manana, hora_tarde, dia_checkin, silencio_desde, silencio_hasta, email)
  on public.preferencias_notificaciones to authenticated;
grant select on public.notificaciones to authenticated;
grant all on public.suscripciones_push, public.preferencias_notificaciones, public.notificaciones to service_role;
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
-- Las del servidor, solo para la clave de servicio (y además lo comprueban dentro, por si una migración
-- futura vuelve a darlas a todos)
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
grant execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) to service_role;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

-- Apuntada: desde aquí, la base no deja repetir por error las migraciones anteriores a esta
insert into public.fbe_migraciones (numero) values (10)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
