-- =====================================================================
-- FBE Equipo, migración 032 (v0.54): el chat, como WhatsApp
--   · Responder citando (comentarios.responde_a): solo a un mensaje de la misma conversación (mismo atleta y mismo
--     hilo: el chat, una sesión, un check-in o un vídeo del diario), que quien responde ya ve (ni uno programado que
--     aún no ha salido ni uno eliminado). La cita no se copia: la app la saca al leer del mensaje citado.
--   · Editar lo propio (comentarios.editado_en): solo quien lo escribió, solo el texto, solo un mensaje sin foto ni
--     vídeo y en los 15 minutos siguientes a enviarlo. Los programados del coach, como en la 030 (mientras no salen).
--   · Eliminar para todos (comentarios.eliminado_en), con comentario_eliminar(): lo propio, en 48 horas; la base
--     borra el texto (queda «Se eliminó este mensaje»), la cita, el dibujo, su foto o vídeo del chat, sus reacciones,
--     los destacados y su notificación pendiente. Un programado que no ha salido se cancela (se borra), como antes.
--     El atleta ya no borra filas de comentarios directamente: solo así (el coach conserva su coach_todo).
--   · Reacciones (comentario_reacciones): una por persona y mensaje, de seis emojis, solo de las dos partes de la
--     conversación y en mensajes que ya han salido y no se han eliminado.
--   · Destacados (comentario_destacados): privados, cada uno los suyos, en mensajes que ve.
--   · Estado de las conversaciones del coach (conversacion_estado): fijadas (3 como mucho), archivadas y «no leída».
--     Solo el coach. Un mensaje nuevo del atleta la saca de archivadas.
--   · Última conexión (presencia): cada uno la suya, con presencia_marcar() (una vez por minuto como mucho) y su
--     «Mostrar cuándo estoy en línea» (visible). La ve solo la otra parte (el coach la de sus atletas; un atleta, solo
--     la del coach) y solo si los dos la enseñan.
--   · «Escribiendo…» y «en línea» por Supabase Realtime en un canal privado por conversación (chat:<atleta_id>): las
--     políticas de realtime.messages (Realtime Authorization) solo dejan entrar, enviar y recibir al coach y a ese
--     atleta; la presencia, además, solo a quien enseña la suya. Si el proyecto no tiene el esquema realtime, no se
--     crean (la app se queda sin «escribiendo…» ni «en línea» y todo lo demás funciona).
--   · Buscar en los mensajes (chat_buscar): solo el coach, con sus permisos de fila.
--   · Cupos por hora (chat_cupos): reacciones, destacados, ediciones, eliminaciones y cambios de «en línea».
--   · Tras la revisión de seguridad: Storage solo deja ver (y borrar) a un atleta lo que tiene su fila en archivos (lo
--     que se quita de la tabla deja de verse aunque su archivo siga en Storage); lo que hay que borrar de Storage va a
--     una cola (fbe_privado.storage_por_borrar) que la app del coach vacía; el atleta no borra de Storage ningún adjunto
--     del chat, ni de archivos uno que lleva mensajes (va por comentario_eliminar y sus 48 horas) y, si el coach borra uno, sus mensajes quedan como
--     eliminados (no desaparecen); «leído» lo fecha la base y no se deshace; los de baja no editan, ni reaccionan, ni
--     destacan; sin «Mostrar cuándo estoy en línea» tampoco hay «escribiendo…» ni la hora exacta de lo leído.
-- Se ejecuta en el SQL Editor después de la 031 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 32 then
    raise exception 'Esta base ya tiene la migración %: repetir la 032 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 32;» y, después de ella, todas las siguientes en orden, todo en la misma consulta del SQL Editor (una sola transacción).';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 31) then
    raise exception 'Antes de la 032 hace falta la 031: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Columnas nuevas de los mensajes
-- ---------------------------------------------------------------------
alter table public.comentarios add column if not exists responde_a uuid references public.comentarios(id) on delete set null;
alter table public.comentarios add column if not exists editado_en timestamptz;
alter table public.comentarios add column if not exists eliminado_en timestamptz;
create index if not exists comentarios_responde_idx on public.comentarios (responde_a) where responde_a is not null;
alter table public.comentarios drop constraint if exists comentarios_respuesta_valida;
alter table public.comentarios add constraint comentarios_respuesta_valida check (responde_a is null or responde_a <> id);

-- ---------------------------------------------------------------------
-- 2. Cupos por hora (como comunidad_cupos: cuenta lo hecho aunque se deshaga). El coach no tiene. Interno.
-- ---------------------------------------------------------------------
create table if not exists public.chat_cupos (
  id         bigint generated always as identity primary key,
  perfil_id  uuid not null references public.perfiles(id) on delete cascade,
  tipo       text not null check (tipo in ('reaccion', 'destacar', 'edicion', 'eliminar', 'presencia')),
  creado_en  timestamptz not null default now()
);
create index if not exists chat_cupos_idx on public.chat_cupos (perfil_id, tipo, creado_en);

create or replace function fbe_privado.chat_gastar_cupo(p_tipo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_max integer := case p_tipo when 'reaccion' then 120 when 'destacar' then 120 when 'edicion' then 30 when 'eliminar' then 30 else 30 end;
begin
  if auth.uid() is null or public.es_coach() then return; end if;
  -- Una cuenta y un tipo a la vez (dos peticiones simultáneas no se saltan el cupo)
  perform pg_advisory_xact_lock(hashtext('fbe-chat-cupo:' || auth.uid()::text || ':' || coalesce(p_tipo, '')));
  delete from public.chat_cupos c where c.perfil_id = auth.uid() and c.creado_en < now() - interval '2 hours';
  if (select count(*) from public.chat_cupos c where c.perfil_id = auth.uid() and c.tipo = p_tipo and c.creado_en > now() - interval '1 hour') >= v_max then
    raise exception '%', case p_tipo when 'reaccion' then 'Has reaccionado muchas veces en la última hora: espera un poco'
                                     when 'destacar' then 'Has destacado muchos mensajes en la última hora: espera un poco'
                                     when 'edicion' then 'Has editado muchos mensajes en la última hora: espera un poco'
                                     when 'eliminar' then 'Has eliminado muchos mensajes en la última hora: espera un poco'
                                     else 'Has cambiado muchas veces «Mostrar cuándo estoy en línea»: espera un poco' end using errcode = '54000';
  end if;
  insert into public.chat_cupos (perfil_id, tipo) values (auth.uid(), p_tipo);
end $$;

-- Desde la app (no desde las funciones de la base, que gastan el suyo): el del tipo que diga el disparador
create or replace function fbe_privado.chat_cupo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(nullif(current_setting('role', true), ''), 'none') in ('authenticated', 'anon') then
    perform fbe_privado.chat_gastar_cupo(tg_argv[0]);
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. comentario_preparar (002, 012, 014, 030) con responder, editar y eliminar
-- ---------------------------------------------------------------------
-- Insertar: como en la 030; además, nadie inserta un mensaje ya editado o eliminado, y la cita tiene que ser de la
-- misma conversación (mismo atleta y mismo hilo) y de un mensaje que quien escribe ya ve, que ya ha salido y que no se
-- ha eliminado. (Este disparador corre con los permisos de quien escribe: la búsqueda del citado ya pasa por sus
-- permisos de fila; además se comprueba a mano.)
-- Cambiar: el coach, sus programados como en la 030 (texto y hora, mientras no salen). Cualquiera, el texto de lo suyo
-- sin foto ni vídeo y en sus 15 minutos (la base apunta editado_en). Quien lo recibe, marcarlo leído. Nada más:
-- eliminar va por comentario_eliminar().
create or replace function public.comentario_preparar() returns trigger
language plpgsql set search_path = public as $$
declare
  v_autor text;
  c public.comentarios;
begin
  if current_user in ('authenticated', 'anon') then
    v_autor := case when public.es_coach() then 'coach' else 'atleta' end;
  end if;
  if tg_op = 'INSERT' then
    if v_autor is not null then new.autor := v_autor; end if;
    if new.sesion_id is not null then new.atleta_id := public.atleta_de_sesion(new.sesion_id);
    elsif new.checkin_id is not null then new.atleta_id := public.atleta_de_checkin(new.checkin_id);
    elsif new.archivo_id is not null then new.atleta_id := public.atleta_de_archivo(new.archivo_id);
    end if;
    if new.atleta_id is null then
      raise exception 'No se puede comentar aquí';
    end if;
    new.adjunto := new.archivo_id is not null and coalesce((select a.tipo = 'adjunto' from public.archivos a where a.id = new.archivo_id), false);
    new.leido_en := null;
    new.editado_en := null;
    new.eliminado_en := null;
    if new.enviar_en is not null then
      if new.autor <> 'coach' or new.sesion_id is not null or new.checkin_id is not null or new.archivo_id is not null then
        raise exception 'Solo los mensajes del coach en el chat se pueden programar' using errcode = '22023';
      end if;
      if new.enviar_en > now() + interval '90 days' then
        raise exception 'Un mensaje se programa como mucho a 90 días vista' using errcode = '22023';
      end if;
      if new.enviar_en <= now() + interval '30 seconds' then new.enviar_en := null; end if;
    end if;
    new.creado_en := coalesce(new.enviar_en, now());
    if new.responde_a is not null then
      select * into c from public.comentarios k where k.id = new.responde_a;
      if c.id is null or c.atleta_id <> new.atleta_id
         or c.sesion_id is distinct from new.sesion_id or c.checkin_id is distinct from new.checkin_id
         or (case when c.adjunto then null else c.archivo_id end) is distinct from (case when new.adjunto then null else new.archivo_id end)
         or c.eliminado_en is not null or (c.enviar_en is not null and c.enviar_en > now()) then
        raise exception 'Solo puedes responder a un mensaje de esta conversación' using errcode = '42501';
      end if;
    end if;
    return new;
  end if;
  if v_autor is not null then
    -- (030) De un programado del coach que aún no ha salido, el texto y la hora (o mandarlo ya)
    if v_autor = 'coach' and old.autor = 'coach' and old.enviar_en is not null and old.enviar_en > now() then
      if (new.atleta_id, new.sesion_id, new.checkin_id, new.archivo_id, new.autor, new.dibujo, new.adjunto, new.responde_a, new.editado_en, new.eliminado_en)
         is distinct from (old.atleta_id, old.sesion_id, old.checkin_id, old.archivo_id, old.autor, old.dibujo, old.adjunto, old.responde_a, old.editado_en, old.eliminado_en) then
        raise exception 'De un mensaje programado solo se cambian el texto y la hora' using errcode = '42501';
      end if;
      if new.enviar_en is not null and new.enviar_en > now() + interval '90 days' then
        raise exception 'Un mensaje se programa como mucho a 90 días vista' using errcode = '22023';
      end if;
      if new.enviar_en is not null and new.enviar_en <= now() + interval '30 seconds' then new.enviar_en := null; end if;
      new.creado_en := coalesce(new.enviar_en, now());
      new.leido_en := null;
      return new;
    end if;
    -- (v0.54) Editar lo propio: solo el texto, de un mensaje sin foto ni vídeo, en sus 15 minutos
    if new.texto is distinct from old.texto then
      if old.autor <> v_autor then
        raise exception 'Solo quien escribió un mensaje puede editarlo' using errcode = '42501';
      end if;
      if v_autor = 'atleta' and public.esta_de_baja() then
        raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada' using errcode = '42501';
      end if;
      if old.eliminado_en is not null then
        raise exception 'Ese mensaje se eliminó: ya no se puede editar' using errcode = '42501';
      end if;
      if old.archivo_id is not null or old.dibujo is not null then
        raise exception 'Solo se editan los mensajes de texto' using errcode = '42501';
      end if;
      if old.creado_en < now() - interval '15 minutes' then
        raise exception 'Un mensaje se edita en los 15 minutos siguientes a enviarlo' using errcode = '42501';
      end if;
      if (new.atleta_id, new.sesion_id, new.checkin_id, new.archivo_id, new.autor, new.creado_en, new.dibujo, new.adjunto, new.enviar_en, new.responde_a, new.eliminado_en, new.leido_en)
         is distinct from
         (old.atleta_id, old.sesion_id, old.checkin_id, old.archivo_id, old.autor, old.creado_en, old.dibujo, old.adjunto, old.enviar_en, old.responde_a, old.eliminado_en, old.leido_en) then
        raise exception 'De un mensaje solo se cambia el texto' using errcode = '42501';
      end if;
      if not public.texto_visible(new.texto) then
        raise exception 'Escribe el mensaje' using errcode = '22023';
      end if;
      new.editado_en := now();
      return new;
    end if;
    if (new.atleta_id, new.sesion_id, new.checkin_id, new.archivo_id, new.autor, new.texto, new.creado_en, new.dibujo, new.adjunto, new.enviar_en, new.responde_a, new.editado_en, new.eliminado_en)
       is distinct from
       (old.atleta_id, old.sesion_id, old.checkin_id, old.archivo_id, old.autor, old.texto, old.creado_en, old.dibujo, old.adjunto, old.enviar_en, old.responde_a, old.editado_en, old.eliminado_en) then
      raise exception 'Un comentario no se puede editar' using errcode = '42501';
    end if;
    if old.autor = v_autor and new.leido_en is distinct from old.leido_en then
      raise exception 'Solo quien recibe un comentario lo marca como leído' using errcode = '42501';
    end if;
    -- «Leído» lo fecha la base (la hora de verdad, no la que mande el móvil), una vez y para siempre: no se deshace.
    -- Sin «Mostrar cuándo estoy en línea», solo el día (no la hora exacta en que lo leíste).
    if new.leido_en is distinct from old.leido_en then
      if new.leido_en is null then
        raise exception 'Un mensaje leído no vuelve a «no leído»' using errcode = '42501';
      end if;
      new.leido_en := coalesce(old.leido_en, case when public.presencia_mia_visible() then now()
                                                  else date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid' end);
    end if;
  end if;
  return new;
end $$;

-- Editar gasta cupo (las funciones de la base, como comentario_eliminar, no: su cambio lleva eliminado_en)
drop trigger if exists comentarios_ab_cupo_editar on public.comentarios;
create trigger comentarios_ab_cupo_editar before update of texto on public.comentarios
  for each row when (old.texto is distinct from new.texto and new.eliminado_en is null)
  execute function fbe_privado.chat_cupo('edicion');

-- ---------------------------------------------------------------------
-- 4. Reacciones y destacados
-- ---------------------------------------------------------------------
create table if not exists public.comentario_reacciones (
  comentario_id  uuid not null references public.comentarios(id) on delete cascade,
  usuario_id     uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  emoji          text not null,
  creado_en      timestamptz not null default now(),
  primary key (comentario_id, usuario_id)
);
create index if not exists comentario_reacciones_usuario_idx on public.comentario_reacciones (usuario_id);
alter table public.comentario_reacciones drop constraint if exists comentario_reacciones_emoji_valido;
alter table public.comentario_reacciones add constraint comentario_reacciones_emoji_valido
  check (emoji in ('❤️', '👍', '💪', '😂', '😮', '🙏'));

create table if not exists public.comentario_destacados (
  usuario_id     uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  comentario_id  uuid not null references public.comentarios(id) on delete cascade,
  creado_en      timestamptz not null default now(),
  primary key (usuario_id, comentario_id)
);
create index if not exists comentario_destacados_comentario_idx on public.comentario_destacados (comentario_id);

-- ¿Puedo reaccionar a (o destacar) este mensaje? Que lo vea quien llama (es del coach o de su conversación), que ya
-- haya salido y que no se haya eliminado. Security definer: lee sin pasar por los permisos de fila, pero solo
-- contesta sí o no sobre la conversación de quien llama.
create or replace function public.comentario_reaccionable(p_comentario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.comentarios c
    where c.id = p_comentario and c.eliminado_en is null
      and (c.enviar_en is null or c.enviar_en <= now())
      and (public.es_coach() or (public.mi_atleta_id() is not null and c.atleta_id = public.mi_atleta_id())))
$$;
-- ¿Veo este mensaje? (para leer reacciones y destacados: lo mismo que los permisos de comentarios)
create or replace function public.comentario_visible(p_comentario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.comentarios c
    where c.id = p_comentario
      and (public.es_coach() or (public.mi_atleta_id() is not null and c.atleta_id = public.mi_atleta_id()
                                 and (c.enviar_en is null or c.enviar_en <= now()))))
$$;

-- La reacción es de quien la pone (la base lo fija); cambiarla es cambiar el emoji, nada más. Gasta cupo.
create or replace function public.comentario_reaccion_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'UPDATE' and (new.comentario_id, new.usuario_id) is distinct from (old.comentario_id, old.usuario_id) then
      raise exception 'De una reacción solo se cambia el emoji' using errcode = '42501';
    end if;
    if not public.es_coach() and public.esta_de_baja() then
      raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada' using errcode = '42501';
    end if;
    new.usuario_id := auth.uid();
  end if;
  new.creado_en := now();
  return new;
end $$;
drop trigger if exists comentario_reacciones_aa_preparar on public.comentario_reacciones;
create trigger comentario_reacciones_aa_preparar before insert or update on public.comentario_reacciones
  for each row execute function public.comentario_reaccion_preparar();
drop trigger if exists comentario_reacciones_ab_cupo on public.comentario_reacciones;
create trigger comentario_reacciones_ab_cupo before insert or update on public.comentario_reacciones
  for each row execute function fbe_privado.chat_cupo('reaccion');

create or replace function public.comentario_destacado_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if not public.es_coach() and public.esta_de_baja() then
      raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada' using errcode = '42501';
    end if;
    new.usuario_id := auth.uid();
  end if;
  new.creado_en := now();
  return new;
end $$;
drop trigger if exists comentario_destacados_aa_preparar on public.comentario_destacados;
create trigger comentario_destacados_aa_preparar before insert on public.comentario_destacados
  for each row execute function public.comentario_destacado_preparar();
drop trigger if exists comentario_destacados_ab_cupo on public.comentario_destacados;
create trigger comentario_destacados_ab_cupo before insert on public.comentario_destacados
  for each row execute function fbe_privado.chat_cupo('destacar');

-- ---------------------------------------------------------------------
-- 5. Eliminar para todos
-- ---------------------------------------------------------------------
-- La cola de Storage: lo que ya no tiene su fila en archivos y hay que borrar de Storage. La base no borra en Storage
-- (Supabase no lo permite desde SQL sin dejar el archivo huérfano en su almacenamiento): lo hace la app (quien lo
-- borra, al momento; y la del coach, al abrirse y tras cada borrado, lo que quede). Mientras tanto, nadie lo ve: las
-- políticas de Storage piden su fila en archivos.
create table if not exists fbe_privado.storage_por_borrar (
  ruta       text primary key,
  bucket     text not null default 'archivos' check (bucket = 'archivos'),
  creado_en  timestamptz not null default now()
);
alter table fbe_privado.storage_por_borrar enable row level security;
revoke all on fbe_privado.storage_por_borrar from public, anon, authenticated;

-- Vaciar un mensaje (eliminar para todos): el texto, la cita, el dibujo, su adjunto (el enlace), sus reacciones, los
-- destacados y su notificación pendiente. Interno.
create or replace function fbe_privado.comentario_vaciar(p_comentario uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.comentarios k set texto = 'Se eliminó este mensaje', dibujo = null, responde_a = null, editado_en = null,
    eliminado_en = coalesce(k.eliminado_en, now()), archivo_id = case when k.adjunto then null else k.archivo_id end
  where k.id = p_comentario;
  delete from public.comentario_reacciones r where r.comentario_id = p_comentario;
  delete from public.comentario_destacados d where d.comentario_id = p_comentario;
  delete from public.notificaciones n where n.clave = 'comentario:' || p_comentario and n.estado = 'pendiente';
end $$;

-- Al borrar un archivo (lo borre quien lo borre, también en cascada): su ruta y su miniatura, a la cola de Storage. Y
-- si es un adjunto del chat (014), sus mensajes ya no desaparecen: quedan como eliminados («Se eliminó este mensaje»),
-- salvo cuando se borra el atleta entero (entonces se va todo)
create or replace function public.archivo_adjunto_borrar_mensaje() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into fbe_privado.storage_por_borrar (ruta) select r from unnest(array[old.ruta, old.poster_ruta]) r where r is not null
    on conflict (ruta) do nothing;
  if old.tipo = 'adjunto' and exists (select 1 from public.atletas a where a.id = old.atleta_id) then
    for v_id in select c.id from public.comentarios c where c.archivo_id = old.id loop
      perform fbe_privado.comentario_vaciar(v_id);
    end loop;
    update public.comentarios c set archivo_id = null where c.archivo_id = old.id;
  end if;
  return old;
end $$;
drop trigger if exists archivos_a_adjunto_mensaje on public.archivos;
create trigger archivos_a_adjunto_mensaje before delete on public.archivos
  for each row execute function public.archivo_adjunto_borrar_mensaje();
-- Y al quitarle la miniatura a un archivo (si falló al subir, 014; o si se cambió una ruta): lo que deja de estar
-- registrado ya no lo ve ni lo borra el atleta, así que también va a la cola
create or replace function public.archivo_rutas_sueltas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into fbe_privado.storage_por_borrar (ruta)
    select r from unnest(array[old.ruta, old.poster_ruta]) r
    where r is not null and r is distinct from new.ruta and r is distinct from new.poster_ruta
    on conflict (ruta) do nothing;
  return null;
end $$;
drop trigger if exists archivos_rutas_sueltas on public.archivos;
create trigger archivos_rutas_sueltas after update of ruta, poster_ruta on public.archivos
  for each row execute function public.archivo_rutas_sueltas();

-- La cola, para el coach: lo pendiente (como mucho p_limite) y lo ya borrado
create or replace function public.storage_pendiente(p_limite integer default 200) returns setof text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  return query select s.ruta from fbe_privado.storage_por_borrar s order by s.creado_en, s.ruta limit least(greatest(coalesce(p_limite, 200), 1), 1000);
end $$;
create or replace function public.storage_borrado(p_rutas text[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  delete from fbe_privado.storage_por_borrar s where s.ruta = any(coalesce(p_rutas, '{}'));
  get diagnostics n = row_count;
  return n;
end $$;

-- Lo propio, en las 48 horas siguientes a enviarlo (los de baja, no). La base borra el texto y lo demás; el archivo de
-- un adjunto del chat se borra de su tabla y la función devuelve sus rutas para que la app lo quite de Storage (la base
-- no borra en Storage). Uno programado que aún no ha salido se cancela (se borra, con su notificación). Devuelve
-- { estado: 'eliminado' | 'cancelado', rutas: [...] }.
create or replace function public.comentario_eliminar(p_comentario uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.comentarios;
  v_coach boolean := public.es_coach();
  v_atleta uuid := public.mi_atleta_id();
  v_rutas text[] := '{}';
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesión' using errcode = '42501';
  end if;
  select * into c from public.comentarios k where k.id = p_comentario for update;
  if c.id is null or not (v_coach or (v_atleta is not null and c.atleta_id = v_atleta and (c.enviar_en is null or c.enviar_en <= now()))) then
    raise exception 'Ese mensaje ya no está' using errcode = '42501';
  end if;
  if c.autor <> (case when v_coach then 'coach' else 'atleta' end) then
    raise exception 'Solo puedes eliminar tus mensajes' using errcode = '42501';
  end if;
  if c.eliminado_en is not null then
    return jsonb_build_object('estado', 'eliminado', 'rutas', '[]'::jsonb);
  end if;
  if not v_coach and public.esta_de_baja() then
    raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada' using errcode = '42501';
  end if;
  if c.enviar_en is not null and c.enviar_en > now() then
    delete from public.comentarios k where k.id = c.id;
    return jsonb_build_object('estado', 'cancelado', 'rutas', '[]'::jsonb);
  end if;
  if c.creado_en < now() - interval '48 hours' then
    raise exception 'Un mensaje se elimina para todos en las 48 horas siguientes a enviarlo' using errcode = '42501';
  end if;
  perform fbe_privado.chat_gastar_cupo('eliminar');
  if c.adjunto and c.archivo_id is not null then
    select array_remove(array[a.ruta, a.poster_ruta], null) into v_rutas from public.archivos a where a.id = c.archivo_id and a.tipo = 'adjunto';
  end if;
  perform fbe_privado.comentario_vaciar(c.id);
  -- Su foto o vídeo del chat: fuera de la tabla (deja de verse) y a la cola de Storage (lo pone el disparador de archivos).
  -- Lo que otro escribió en el hilo de esa foto se queda (sin la foto): eliminar lo propio no se lleva lo de nadie.
  if c.adjunto and c.archivo_id is not null then
    update public.comentarios k set archivo_id = null where k.archivo_id = c.archivo_id and k.id <> c.id;
    delete from public.archivos a where a.id = c.archivo_id and a.tipo = 'adjunto';
  end if;
  return jsonb_build_object('estado', 'eliminado', 'rutas', to_jsonb(coalesce(v_rutas, '{}')));
end $$;

-- El atleta ya no borra comentarios directamente (los suyos se eliminan para todos, en 48 horas, con la función de
-- arriba). Lo demás que borra un comentario (su sesión, su check-in, su vídeo o su adjunto) sigue igual.
drop policy if exists atleta_borrar on public.comentarios;

-- ---------------------------------------------------------------------
-- 6. Estado de las conversaciones (solo el coach): fijadas (3 como mucho), archivadas y «no leída»
-- ---------------------------------------------------------------------
create table if not exists public.conversacion_estado (
  atleta_id       uuid primary key references public.atletas(id) on delete cascade,
  fijada_en       timestamptz,
  archivada_en    timestamptz,
  no_leida        boolean not null default false,
  actualizado_en  timestamptz not null default now()
);

-- Las horas las pone la base (fijada o archivada desde cuándo); archivar la desfija (como WhatsApp); 3 fijadas
create or replace function public.conversacion_estado_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.atleta_id is distinct from old.atleta_id then
    raise exception 'No se puede pasar a otro atleta' using errcode = '42501';
  end if;
  new.fijada_en := case when new.fijada_en is null then null when tg_op = 'UPDATE' and old.fijada_en is not null then old.fijada_en else now() end;
  new.archivada_en := case when new.archivada_en is null then null when tg_op = 'UPDATE' and old.archivada_en is not null then old.archivada_en else now() end;
  if new.archivada_en is not null then new.fijada_en := null; end if;
  if new.fijada_en is not null and (select count(*) from public.conversacion_estado e where e.fijada_en is not null and e.atleta_id <> new.atleta_id) >= 3 then
    raise exception 'Puedes fijar 3 conversaciones como mucho' using errcode = '23514';
  end if;
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists conversacion_estado_aa_preparar on public.conversacion_estado;
create trigger conversacion_estado_aa_preparar before insert or update on public.conversacion_estado
  for each row execute function public.conversacion_estado_preparar();

-- Un mensaje nuevo del atleta saca su conversación de archivadas
create or replace function fbe_privado.al_comentar_desarchivar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.autor = 'atleta' then
    update public.conversacion_estado e set archivada_en = null where e.atleta_id = new.atleta_id and e.archivada_en is not null;
  end if;
  return null;
exception when others then
  raise warning 'FBE: la conversación de % no ha salido de archivadas: %', new.atleta_id, sqlerrm;
  return null;
end $$;
drop trigger if exists comentarios_zz_desarchivar on public.comentarios;
create trigger comentarios_zz_desarchivar after insert on public.comentarios
  for each row execute function fbe_privado.al_comentar_desarchivar();

-- ---------------------------------------------------------------------
-- 7. Última conexión y «Mostrar cuándo estoy en línea»
-- ---------------------------------------------------------------------
create table if not exists public.presencia (
  usuario_id       uuid primary key references public.perfiles(id) on delete cascade,
  ultima_conexion  timestamptz,
  visible          boolean not null default true,
  actualizado_en   timestamptz not null default now()
);
alter table public.presencia drop constraint if exists presencia_valida;
alter table public.presencia add constraint presencia_valida check (visible or ultima_conexion is null);

-- ¿Enseño la mía? (sin fila, sí: es lo de serie)
create or replace function public.presencia_mia_visible() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.visible from public.presencia p where p.usuario_id = auth.uid()), true)
$$;
-- ¿Puedo ver la de esta persona? Solo la otra parte (el coach, la de un atleta; un atleta, la del coach) y solo si
-- los dos la enseñan (como WhatsApp: si escondes la tuya, no ves la de nadie)
create or replace function public.presencia_puedo_ver(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and p_usuario <> auth.uid() and public.presencia_mia_visible()
    and ((public.es_coach() and exists (select 1 from public.atletas a where a.perfil_id = p_usuario))
         or (public.mi_atleta_id() is not null and exists (select 1 from public.perfiles p where p.id = p_usuario and p.rol = 'coach')))
$$;

-- Lo marca cada uno para sí (la hora la pone la base y como mucho una vez por minuto). p_visible: cambiar «Mostrar
-- cuándo estoy en línea» (sin enseñarla, no se guarda la última conexión). Devuelve { visible, ultima_conexion }.
create or replace function public.presencia_marcar(p_visible boolean default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.presencia;
  v_visible boolean;
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesión' using errcode = '42501';
  end if;
  select * into r from public.presencia p where p.usuario_id = auth.uid() for update;
  v_visible := coalesce(p_visible, r.visible, true);
  if r.usuario_id is not null and v_visible = r.visible
     and (not v_visible or (r.ultima_conexion is not null and r.ultima_conexion > now() - interval '55 seconds')) then
    return jsonb_build_object('visible', r.visible, 'ultima_conexion', r.ultima_conexion);
  end if;
  if r.usuario_id is not null and v_visible <> r.visible then
    perform fbe_privado.chat_gastar_cupo('presencia');
  end if;
  insert into public.presencia as p (usuario_id, visible, ultima_conexion, actualizado_en)
  values (auth.uid(), v_visible, case when v_visible then now() end, now())
  on conflict (usuario_id) do update set visible = excluded.visible, ultima_conexion = excluded.ultima_conexion, actualizado_en = excluded.actualizado_en
  returning * into r;
  return jsonb_build_object('visible', r.visible, 'ultima_conexion', r.ultima_conexion);
end $$;

-- ---------------------------------------------------------------------
-- 8. Realtime Authorization: el canal privado de cada conversación (chat:<atleta_id>)
-- ---------------------------------------------------------------------
-- Entran, envían y reciben el coach y ese atleta (los mensajes de «escribiendo…» y lo que se acaba de cambiar van por
-- broadcast), y solo si enseñan cuándo están en línea (si no, ni «en línea» ni «escribiendo…»). Sin datos de salud: la app solo manda quién
-- escribe y que algo ha cambiado. Además, el canal propio de cada cuenta (fbe-cambios:<su id>), privado, por el que la
-- app recibe los mensajes nuevos de la tabla (con sus permisos de fila, como siempre): así el proyecto puede dejar de
-- aceptar canales públicos (Realtime → Settings → «Allow public access» apagado).
create or replace function public.chat_canal_permitido(p_topic text, p_extension text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_atleta uuid;
begin
  if auth.uid() is null or p_topic is null then
    return false;
  end if;
  if p_topic = 'fbe-cambios:' || auth.uid()::text then
    return p_extension = 'broadcast';
  end if;
  if p_topic !~ '^chat:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_atleta := substr(p_topic, 6)::uuid;
  if not exists (select 1 from public.atletas a where a.id = v_atleta
                 and (public.es_coach() or (a.perfil_id is not null and a.perfil_id = auth.uid()))) then
    return false;
  end if;
  -- (tras la revisión) sin «Mostrar cuándo estoy en línea», tampoco «escribiendo…»: el canal entero
  return p_extension in ('broadcast', 'presence') and public.presencia_mia_visible();
end $$;

-- ¿Puede la app usar los canales privados? (sus políticas están puestas). Sin la 032 esta función no existe.
create or replace function public.chat_privado_disponible() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and to_regclass('realtime.messages') is not null
    and exists (select 1 from pg_catalog.pg_policies p where p.schemaname = 'realtime' and p.tablename = 'messages' and p.policyname = 'fbe_chat_recibir')
$$;

do $$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'FBE: este proyecto no tiene realtime.messages: sin «escribiendo…» ni «en línea» (lo demás funciona)';
    return;
  end if;
  execute 'drop policy if exists fbe_chat_recibir on realtime.messages';
  execute $p$create policy fbe_chat_recibir on realtime.messages for select to authenticated
    using (realtime.messages.extension in ('broadcast', 'presence')
           and public.chat_canal_permitido((select realtime.topic()), realtime.messages.extension))$p$;
  execute 'drop policy if exists fbe_chat_enviar on realtime.messages';
  execute $p$create policy fbe_chat_enviar on realtime.messages for insert to authenticated
    with check (realtime.messages.extension in ('broadcast', 'presence')
                and public.chat_canal_permitido((select realtime.topic()), realtime.messages.extension))$p$;
exception when insufficient_privilege then
  raise warning 'FBE: no se han podido crear las políticas de realtime.messages (%): la app se queda sin «escribiendo…» ni «en línea»', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- 9. Buscar en los mensajes (el coach, en todas sus conversaciones). Con los permisos de quien llama (security
--    invoker): además de la condición del coach, sus permisos de fila. Sin tildes ni mayúsculas.
-- ---------------------------------------------------------------------
create or replace function public.chat_buscar(p_texto text, p_limite integer default 40)
returns table (id uuid, atleta_id uuid, autor text, texto text, creado_en timestamptz, enviar_en timestamptz)
language sql stable security invoker set search_path = '' as $$
  with q as (
    select replace(replace(replace(translate(lower(btrim(coalesce(p_texto, ''))), 'áàâäéèêëíìîïóòôöúùûüñç', 'aaaaeeeeiiiioooouuuunc'),
             '\', '\\'), '%', '\%'), '_', '\_') as t
  )
  select c.id, c.atleta_id, c.autor, left(c.texto, 300), c.creado_en, c.enviar_en
  from public.comentarios c, q
  where public.es_coach()
    and char_length(q.t) between 2 and 100
    and c.eliminado_en is null
    and not (c.archivo_id is not null and c.texto in ('Foto', 'Vídeo'))
    and translate(lower(c.texto), 'áàâäéèêëíìîïóòôöúùûüñç', 'aaaaeeeeiiiioooouuuunc') like '%' || q.t || '%'
  order by c.creado_en desc
  limit least(greatest(coalesce(p_limite, 40), 1), 100)
$$;

-- ---------------------------------------------------------------------
-- 10. Permisos (desde la 019, cada tabla nueva lleva los suyos a mano)
-- ---------------------------------------------------------------------
alter table public.chat_cupos enable row level security;
alter table public.comentario_reacciones enable row level security;
alter table public.comentario_destacados enable row level security;
alter table public.conversacion_estado enable row level security;
alter table public.presencia enable row level security;

-- Reacciones: las leen las dos partes de la conversación (en lo que ya ven); cada uno pone, cambia y quita la suya,
-- solo en mensajes que ya han salido y no se han eliminado
drop policy if exists partes_ver on public.comentario_reacciones;
create policy partes_ver on public.comentario_reacciones for select to authenticated
  using (public.comentario_visible(comentario_id));
drop policy if exists propia_poner on public.comentario_reacciones;
create policy propia_poner on public.comentario_reacciones for insert to authenticated
  with check (usuario_id = auth.uid() and public.comentario_reaccionable(comentario_id));
drop policy if exists propia_cambiar on public.comentario_reacciones;
create policy propia_cambiar on public.comentario_reacciones for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid() and public.comentario_reaccionable(comentario_id));
drop policy if exists propia_quitar on public.comentario_reacciones;
create policy propia_quitar on public.comentario_reacciones for delete to authenticated
  using (usuario_id = auth.uid());

-- Destacados: cada uno los suyos (ni el coach ve los del atleta ni al revés)
drop policy if exists propios_ver on public.comentario_destacados;
create policy propios_ver on public.comentario_destacados for select to authenticated
  using (usuario_id = auth.uid() and public.comentario_visible(comentario_id));
drop policy if exists propios_poner on public.comentario_destacados;
create policy propios_poner on public.comentario_destacados for insert to authenticated
  with check (usuario_id = auth.uid() and public.comentario_reaccionable(comentario_id));
drop policy if exists propios_quitar on public.comentario_destacados;
create policy propios_quitar on public.comentario_destacados for delete to authenticated
  using (usuario_id = auth.uid());

-- Storage (bucket «archivos»): el atleta solo ve lo de su carpeta que tiene su fila en archivos (lo que se quita de la
-- tabla, aunque su archivo siga en Storage hasta que se vacíe la cola, ya no se ve) y solo borra lo suyo que puede
-- borrar: sus vídeos, miniaturas y fotos del diario y de progreso; nunca un adjunto del chat (puede ser una foto que le
-- manda el coach, aún sin su mensaje) ni nada sin su fila. El coach, todo (también vaciar la cola).
-- (Storage borra con RETURNING: borrar pide también poder verlo. Por eso lo que borra un atleta sin su fila, como la foto
-- de un mensaje que elimina para todos, lo borra de Storage la app del coach desde la cola.)
create or replace function public.archivo_con_mensajes(p_archivo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.comentarios c where c.archivo_id = p_archivo)
$$;
create or replace function public.archivo_borrable(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.mi_atleta_id() is not null
    and exists (select 1 from public.archivos a where (a.ruta = p_ruta or a.poster_ruta = p_ruta) and a.atleta_id = public.mi_atleta_id()
                and a.tipo <> 'adjunto')
$$;
drop policy if exists fbe_archivos_ver on storage.objects;
create policy fbe_archivos_ver on storage.objects for select to authenticated
  using (bucket_id = 'archivos'
         and (public.es_coach() or ((storage.foldername(name))[1] = public.mi_atleta_id()::text and public.archivo_registrado(name))));
drop policy if exists fbe_archivos_borrar on storage.objects;
create policy fbe_archivos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'archivos'
         and (public.es_coach() or ((storage.foldername(name))[1] = public.mi_atleta_id()::text and public.archivo_borrable(name))));
-- Archivos: el atleta no borra un adjunto del chat que lleva mensajes (eso va por comentario_eliminar, en 48 horas)
drop policy if exists atleta_borrar on public.archivos;
create policy atleta_borrar on public.archivos for delete to authenticated
  using (atleta_id = public.mi_atleta_id() and (tipo <> 'adjunto' or not public.archivo_con_mensajes(id)));

-- El estado de las conversaciones, solo el coach
drop policy if exists coach_todo on public.conversacion_estado;
create policy coach_todo on public.conversacion_estado for all to authenticated
  using (public.es_coach()) with check (public.es_coach());

-- La presencia: la propia y la de la otra parte (si los dos la enseñan). Se escribe solo con presencia_marcar().
drop policy if exists propia_ver on public.presencia;
create policy propia_ver on public.presencia for select to authenticated using (usuario_id = auth.uid());
drop policy if exists otra_parte_ver on public.presencia;
create policy otra_parte_ver on public.presencia for select to authenticated
  using (visible and public.presencia_puedo_ver(usuario_id));

revoke all on public.chat_cupos, public.comentario_reacciones, public.comentario_destacados, public.conversacion_estado, public.presencia
  from public, anon, authenticated;
grant select, insert, update, delete on public.comentario_reacciones to authenticated;
grant select, insert, delete on public.comentario_destacados to authenticated;
grant select, insert, update, delete on public.conversacion_estado to authenticated;
grant select on public.presencia to authenticated;

-- Permisos (como al final de 003 a 031)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (32)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
