-- =====================================================================
-- FBE Equipo, migración 033 (v0.55): el chat, aún más como WhatsApp
--   · Envío al momento sin duplicados (comentarios.cliente_id): cada mensaje lleva un id que pone el móvil; uno
--     repetido (un reintento sin cobertura) no entra dos veces: único por conversación y autor.
--   · Entregado (comentarios.entregado_en, ✓✓ gris): lo apunta la base cuando la app de quien lo recibe lo descarga
--     (marcar_entregados(), solo lo dirigido a quien llama). Sin «Mostrar cuándo estoy en línea», no se apunta al
--     descargar (diría cuándo abre la app): solo al leerlo (y, como «leído», con el día). Leerlo lo da por entregado.
--   · Documentos PDF en el chat: archivos.tipo 'documento' (application/pdf, hasta 20 MB, ruta generada y su nombre
--     aparte, saneado; número de páginas si se sabe), con las mismas reglas que las fotos del chat (el atleta no los borra
--     de Storage ni de archivos si llevan mensajes; eliminar para todos, en 48 horas). Como mucho 10 al día (el atleta).
--   · Fijar un mensaje (conversacion_fijado): uno por conversación, solo el coach, con caducidad opcional (24 h, 7 o
--     30 días). Lo ven el coach y ese atleta. Tiene que ser de esa conversación, ya salido y sin eliminar; si se elimina,
--     se desfija solo.
--   · Reenviar (comentarios.reenviado, solo con chat_reenviar()): el coach reenvía lo suyo (texto, foto, vídeo o PDF) a
--     uno o varios atletas. Las fotos, vídeos y PDF se copian antes en la carpeta de cada uno con su fila en archivos
--     (así solo ve su copia). Nadie más reenvía; nadie pone «Reenviado» a mano. La base apunta quién subió cada archivo
--     (archivos.subido_por, que no se cambia): el coach no pone en un mensaje suyo, ni reenvía, lo que subió un atleta.
--   · Listas de difusión (listas_difusion, listas_difusion_miembros): solo el coach. chat_difundir() manda un mensaje a
--     cada miembro, en su chat privado, de una vez (todos o ninguno), sin repetir y saltándose a los de baja.
--   · Silenciar una conversación (chat_silencios): cada uno la suya, 8 horas, 1 semana o siempre. Sus notificaciones
--     no se crean (y las pendientes se quitan); los números sin leer siguen contando.
--   · Las notificaciones de un mensaje del atleta llevan al coach a esa conversación (#mensajes/<atleta>).
--   · Cupos: reenviar (300 mensajes por hora), difundir (30 por hora) y silenciar (30 por hora, el atleta).
--   · «Info del contacto»: el atleta ve el nombre corto de su coach (nombre_coach(), el mismo de sus notificaciones).
-- Se ejecuta en el SQL Editor después de la 032 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 33 then
    raise exception 'Esta base ya tiene la migración %: repetir la 033 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 33;» y, después de ella, todas las siguientes en orden, todo en la misma consulta del SQL Editor (una sola transacción).';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 32) then
    raise exception 'Antes de la 033 hace falta la 032: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Columnas nuevas
-- ---------------------------------------------------------------------
alter table public.comentarios add column if not exists cliente_id uuid;
alter table public.comentarios add column if not exists reenviado boolean not null default false;
alter table public.comentarios add column if not exists entregado_en timestamptz;
-- Único por conversación y autor (un atleta no puede «gastar» el id de un mensaje del coach, ni al revés)
alter table public.comentarios drop constraint if exists comentarios_cliente_unico;
alter table public.comentarios add constraint comentarios_cliente_unico unique (atleta_id, autor, cliente_id);
create index if not exists comentarios_por_entregar_idx on public.comentarios (atleta_id, autor) where entregado_en is null;
-- Lo que ya se había leído antes de la 033 cuenta como entregado (cuando se leyó; nunca antes de escribirse)
update public.comentarios set entregado_en = greatest(leido_en, creado_en) where leido_en is not null and entregado_en is null;

alter table public.archivos add column if not exists nombre text;
alter table public.archivos add column if not exists paginas smallint;
-- Quién lo subió (lo pone la base al registrarlo; no se cambia): el coach no adjunta ni reenvía lo que subió un atleta
alter table public.archivos add column if not exists subido_por text;
alter table public.archivos drop constraint if exists archivos_subido_por_valido;
alter table public.archivos add constraint archivos_subido_por_valido check (subido_por is null or subido_por in ('coach', 'atleta'));
-- Los del chat de antes de la 033: de quien escribió su mensaje
update public.archivos a set subido_por = case
    when exists (select 1 from public.comentarios c where c.archivo_id = a.id and c.autor = 'atleta') then 'atleta'
    when exists (select 1 from public.comentarios c where c.archivo_id = a.id and c.autor = 'coach') then 'coach' end
where a.subido_por is null and a.tipo in ('adjunto', 'documento');
alter table public.archivos drop constraint if exists archivos_tipo_check;
alter table public.archivos add constraint archivos_tipo_check
  check (tipo in ('video_tecnica', 'foto_progreso', 'adjunto', 'documento')) not valid;
-- El nombre que se enseña (la ruta la genera la app): una línea, sin barras, sin «..», sin caracteres de control ni
-- invisibles (los de dirección del texto tampoco: no se disfraza «fdp.exe» de PDF), sin <>:"|?* (como lo deja la app)
alter table public.archivos drop constraint if exists archivos_nombre_valido;
alter table public.archivos add constraint archivos_nombre_valido
  check (nombre is null or (char_length(nombre) between 1 and 120
                            and nombre !~ '[/\\[:cntrl:]\u0080-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff<>:"|?*]'
                            and position('..' in nombre) = 0 and nombre !~ '^[.[:space:]]' and public.texto_visible(nombre)));
alter table public.archivos drop constraint if exists archivos_paginas_validas;
alter table public.archivos add constraint archivos_paginas_validas check (paginas is null or paginas between 1 and 5000);
-- Un documento: un PDF de hasta 20 MB, con su nombre y una ruta .pdf
alter table public.archivos drop constraint if exists archivos_documento_valido;
alter table public.archivos add constraint archivos_documento_valido
  check (tipo <> 'documento' or (coalesce(mime = 'application/pdf', false) and coalesce(bytes between 1 and 20971520, false) and ruta ~ '\.pdf$'
                                  and coalesce(nombre ~* '\.pdf$', false) and poster_ruta is null));

-- Storage acepta también PDF (lo demás, como estaba)
update storage.buckets set allowed_mime_types = allowed_mime_types || array['application/pdf']
where id = 'archivos' and allowed_mime_types is not null and not ('application/pdf' = any(allowed_mime_types));

-- ---------------------------------------------------------------------
-- 2. Cupos (032) con los tipos nuevos; el coach, solo en reenviar y difundir
-- ---------------------------------------------------------------------
alter table public.chat_cupos drop constraint if exists chat_cupos_tipo_check;
alter table public.chat_cupos add constraint chat_cupos_tipo_check
  check (tipo in ('reaccion', 'destacar', 'edicion', 'eliminar', 'presencia', 'silenciar', 'reenviar', 'difusion'));

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
                                     when 'silenciar' then 'Has silenciado y activado el chat muchas veces en la última hora: espera un poco'
                                     else 'Has cambiado muchas veces «Mostrar cuándo estoy en línea»: espera un poco' end using errcode = '54000';
  end if;
  insert into public.chat_cupos (perfil_id, tipo) values (auth.uid(), p_tipo);
end $$;

-- Los del coach: reenviar (300 mensajes por hora) y difundir (30 envíos por hora). p_n: cuántos gasta de una vez.
create or replace function fbe_privado.chat_cupo_coach(p_tipo text, p_n integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_max integer := case p_tipo when 'reenviar' then 300 when 'difusion' then 30 else 0 end;
begin
  if auth.uid() is null or p_tipo not in ('reenviar', 'difusion') or coalesce(p_n, 0) < 1 then
    raise exception 'Cupo no válido' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('fbe-chat-cupo:' || auth.uid()::text || ':' || p_tipo));
  delete from public.chat_cupos c where c.perfil_id = auth.uid() and c.creado_en < now() - interval '2 hours';
  if (select count(*) from public.chat_cupos c where c.perfil_id = auth.uid() and c.tipo = p_tipo and c.creado_en > now() - interval '1 hour') + p_n > v_max then
    raise exception '%', case p_tipo when 'reenviar' then 'Has reenviado muchos mensajes en la última hora: espera un poco'
                                     else 'Has enviado muchas difusiones en la última hora: espera un poco' end using errcode = '54000';
  end if;
  insert into public.chat_cupos (perfil_id, tipo) select auth.uid(), p_tipo from generate_series(1, p_n);
end $$;

-- ---------------------------------------------------------------------
-- 3. comentario_preparar (002, 012, 014, 030, 032) con cliente_id, reenviado, entregado_en y los documentos
-- ---------------------------------------------------------------------
-- Como en la 032; además: un documento del chat también es un adjunto; «Reenviado» solo lo pone chat_reenviar() (desde
-- la app, siempre falso); «entregado» lo fecha la base (marcar_entregados(), o al leerlo); el id del móvil (cliente_id),
-- «reenviado» y «entregado» no se cambian después.
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
    if v_autor is not null then
      new.autor := v_autor;
      new.reenviado := false;
    end if;
    if new.sesion_id is not null then new.atleta_id := public.atleta_de_sesion(new.sesion_id);
    elsif new.checkin_id is not null then new.atleta_id := public.atleta_de_checkin(new.checkin_id);
    elsif new.archivo_id is not null then new.atleta_id := public.atleta_de_archivo(new.archivo_id);
    end if;
    if new.atleta_id is null then
      raise exception 'No se puede comentar aquí';
    end if;
    new.adjunto := new.archivo_id is not null and coalesce((select a.tipo in ('adjunto', 'documento') from public.archivos a where a.id = new.archivo_id), false);
    -- Una foto, un vídeo o un documento del chat va en un mensaje de quien lo subió (el coach no pone en un mensaje
    -- suyo, ni reenvía después, lo que subió un atleta; ni al revés)
    if v_autor is not null and new.adjunto
       and (select a.subido_por from public.archivos a where a.id = new.archivo_id) is distinct from v_autor then
      raise exception 'Ese archivo no lo has subido tú' using errcode = '42501';
    end if;
    new.reenviado := coalesce(new.reenviado, false);
    new.leido_en := null;
    new.entregado_en := null;
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
      if (new.atleta_id, new.sesion_id, new.checkin_id, new.archivo_id, new.autor, new.dibujo, new.adjunto, new.responde_a, new.editado_en, new.eliminado_en,
          new.cliente_id, new.reenviado, new.entregado_en)
         is distinct from (old.atleta_id, old.sesion_id, old.checkin_id, old.archivo_id, old.autor, old.dibujo, old.adjunto, old.responde_a, old.editado_en, old.eliminado_en,
          old.cliente_id, old.reenviado, old.entregado_en) then
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
    -- (032) Editar lo propio: solo el texto, de un mensaje sin foto, vídeo ni documento, en sus 15 minutos
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
      if (new.atleta_id, new.sesion_id, new.checkin_id, new.archivo_id, new.autor, new.creado_en, new.dibujo, new.adjunto, new.enviar_en, new.responde_a, new.eliminado_en, new.leido_en,
          new.cliente_id, new.reenviado, new.entregado_en)
         is distinct from
         (old.atleta_id, old.sesion_id, old.checkin_id, old.archivo_id, old.autor, old.creado_en, old.dibujo, old.adjunto, old.enviar_en, old.responde_a, old.eliminado_en, old.leido_en,
          old.cliente_id, old.reenviado, old.entregado_en) then
        raise exception 'De un mensaje solo se cambia el texto' using errcode = '42501';
      end if;
      if not public.texto_visible(new.texto) then
        raise exception 'Escribe el mensaje' using errcode = '22023';
      end if;
      new.editado_en := now();
      return new;
    end if;
    if (new.atleta_id, new.sesion_id, new.checkin_id, new.archivo_id, new.autor, new.texto, new.creado_en, new.dibujo, new.adjunto, new.enviar_en, new.responde_a, new.editado_en, new.eliminado_en,
        new.cliente_id, new.reenviado, new.entregado_en)
       is distinct from
       (old.atleta_id, old.sesion_id, old.checkin_id, old.archivo_id, old.autor, old.texto, old.creado_en, old.dibujo, old.adjunto, old.enviar_en, old.responde_a, old.editado_en, old.eliminado_en,
        old.cliente_id, old.reenviado, old.entregado_en) then
      raise exception 'Un comentario no se puede editar' using errcode = '42501';
    end if;
    if old.autor = v_autor and new.leido_en is distinct from old.leido_en then
      raise exception 'Solo quien recibe un comentario lo marca como leído' using errcode = '42501';
    end if;
    -- (032) «Leído» lo fecha la base, una vez y para siempre; sin «Mostrar cuándo estoy en línea», solo el día.
    -- (033) Leído es también entregado.
    if new.leido_en is distinct from old.leido_en then
      if new.leido_en is null then
        raise exception 'Un mensaje leído no vuelve a «no leído»' using errcode = '42501';
      end if;
      new.leido_en := coalesce(old.leido_en, case when public.presencia_mia_visible() then now()
                                                  else date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid' end);
      new.entregado_en := coalesce(old.entregado_en, greatest(new.leido_en, old.creado_en));
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 4. Entregado: lo que va dirigido a quien llama y su app ya ha descargado
-- ---------------------------------------------------------------------
-- El coach: lo escrito por los atletas; un atleta: lo que le escribe el coach en su conversación (ya salido). Devuelve
-- cuántos ha marcado. La hora, la de la base. Sin «Mostrar cuándo estoy en línea», nada: el ✓✓ gris diría (también por
-- Realtime, al momento) cuándo abre la app; esos mensajes cuentan como entregados al leerlos.
create or replace function public.marcar_entregados() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_coach boolean := public.es_coach();
  v_atleta uuid := public.mi_atleta_id();
  n integer;
begin
  if auth.uid() is null or not (v_coach or v_atleta is not null) or not public.presencia_mia_visible() then return 0; end if;
  update public.comentarios k set entregado_en = now()
  where k.entregado_en is null and k.eliminado_en is null
    and ((v_coach and k.autor = 'atleta')
         or (not v_coach and k.autor = 'coach' and k.atleta_id = v_atleta and (k.enviar_en is null or k.enviar_en <= now())));
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- 5. Documentos: las reglas de las fotos del chat (032), también para ellos
-- ---------------------------------------------------------------------
-- Al registrar un archivo (003): además, como mucho 10 documentos al día (el atleta)
create or replace function public.archivo_proteger() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.subido_por := case when public.es_coach() then 'coach' else 'atleta' end;
  end if;
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    new.revisado_en := null;
    new.comentario_coach := null;
    new.creado_en := now();
    if (select count(*) from public.archivos
        where atleta_id = new.atleta_id and creado_en > now() - interval '1 day') >= 30 then
      raise exception 'Has subido 30 archivos en las últimas 24 horas: espera un poco o pide a tu coach que borre alguno' using errcode = '54000';
    end if;
    if new.tipo = 'documento' and (select count(*) from public.archivos
        where atleta_id = new.atleta_id and tipo = 'documento' and creado_en > now() - interval '1 day') >= 10 then
      raise exception 'Has enviado 10 documentos en las últimas 24 horas: espera un poco' using errcode = '54000';
    end if;
  end if;
  return new;
end $$;

-- (014) De un archivo, el atleta solo cambia el pie, el ejercicio y si está destacado (ni el nombre de un documento).
-- Quién lo subió no lo cambia nadie (tampoco el coach).
create or replace function public.archivo_proteger_cambios() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and new.subido_por is distinct from old.subido_por then
    raise exception 'No se cambia quién subió un archivo' using errcode = '42501';
  end if;
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    if (new.id, new.atleta_id, new.tipo, new.ruta, new.sesion_ejercicio_id, new.fecha, new.comentario_coach,
        new.creado_en, new.mime, new.bytes, new.revisado_en, new.duracion_seg, new.pose, new.nombre, new.paginas)
       is distinct from
       (old.id, old.atleta_id, old.tipo, old.ruta, old.sesion_ejercicio_id, old.fecha, old.comentario_coach,
        old.creado_en, old.mime, old.bytes, old.revisado_en, old.duracion_seg, old.pose, old.nombre, old.paginas)
       or (new.poster_ruta is not null and new.poster_ruta is distinct from old.poster_ruta) then
      raise exception 'De un archivo solo puedes cambiar el pie, el ejercicio y si está destacado' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- (032) Lo que el atleta puede borrar de Storage: sus vídeos y fotos del diario y de progreso; ni un adjunto ni un
-- documento del chat
create or replace function public.archivo_borrable(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.mi_atleta_id() is not null
    and exists (select 1 from public.archivos a where (a.ruta = p_ruta or a.poster_ruta = p_ruta) and a.atleta_id = public.mi_atleta_id()
                and a.tipo not in ('adjunto', 'documento'))
$$;
drop policy if exists atleta_borrar on public.archivos;
create policy atleta_borrar on public.archivos for delete to authenticated
  using (atleta_id = public.mi_atleta_id() and (tipo not in ('adjunto', 'documento') or not public.archivo_con_mensajes(id)));

-- (032) Al borrar un archivo: a la cola de Storage; si es del chat (foto, vídeo o documento), sus mensajes quedan
-- como eliminados
create or replace function public.archivo_adjunto_borrar_mensaje() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into fbe_privado.storage_por_borrar (ruta) select r from unnest(array[old.ruta, old.poster_ruta]) r where r is not null
    on conflict (ruta) do nothing;
  if old.tipo in ('adjunto', 'documento') and exists (select 1 from public.atletas a where a.id = old.atleta_id) then
    for v_id in select c.id from public.comentarios c where c.archivo_id = old.id loop
      perform fbe_privado.comentario_vaciar(v_id);
    end loop;
    update public.comentarios c set archivo_id = null where c.archivo_id = old.id;
  end if;
  return old;
end $$;

-- (032) Eliminar para todos: igual, con los documentos como las fotos del chat
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
    select array_remove(array[a.ruta, a.poster_ruta], null) into v_rutas from public.archivos a where a.id = c.archivo_id and a.tipo in ('adjunto', 'documento');
  end if;
  perform fbe_privado.comentario_vaciar(c.id);
  if c.adjunto and c.archivo_id is not null then
    update public.comentarios k set archivo_id = null where k.archivo_id = c.archivo_id and k.id <> c.id;
    delete from public.archivos a where a.id = c.archivo_id and a.tipo in ('adjunto', 'documento');
  end if;
  return jsonb_build_object('estado', 'eliminado', 'rutas', to_jsonb(coalesce(v_rutas, '{}')));
end $$;

-- (032) Buscar: sin las marcas de los documentos («Documento») tampoco
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
    and not (c.archivo_id is not null and c.texto in ('Foto', 'Vídeo', 'Documento'))
    and translate(lower(c.texto), 'áàâäéèêëíìîïóòôöúùûüñç', 'aaaaeeeeiiiioooouuuunc') like '%' || q.t || '%'
  order by c.creado_en desc
  limit least(greatest(coalesce(p_limite, 40), 1), 100)
$$;

-- ---------------------------------------------------------------------
-- 6. Fijar un mensaje en la conversación (solo el coach; uno por conversación)
-- ---------------------------------------------------------------------
create table if not exists public.conversacion_fijado (
  atleta_id      uuid primary key references public.atletas(id) on delete cascade,
  comentario_id  uuid not null references public.comentarios(id) on delete cascade,
  hasta          timestamptz,
  fijado_en      timestamptz not null default now()
);
create index if not exists conversacion_fijado_comentario_idx on public.conversacion_fijado (comentario_id);

-- Que sea de esa conversación, ya salido y sin eliminar; la hora la pone la base; caduca en 1 hora a 31 días (o nunca)
create or replace function public.conversacion_fijado_preparar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.comentarios;
begin
  if tg_op = 'UPDATE' and new.atleta_id is distinct from old.atleta_id then
    raise exception 'No se puede pasar a otro atleta' using errcode = '42501';
  end if;
  select * into c from public.comentarios k where k.id = new.comentario_id;
  if c.id is null or c.atleta_id <> new.atleta_id or c.eliminado_en is not null or (c.enviar_en is not null and c.enviar_en > now()) then
    raise exception 'Solo se fija un mensaje de esta conversación que ya ha salido' using errcode = '42501';
  end if;
  if new.hasta is not null and coalesce(nullif(current_setting('role', true), ''), 'none') in ('authenticated', 'anon')
     and (new.hasta < now() + interval '55 minutes' or new.hasta > now() + interval '31 days') then
    raise exception 'Un mensaje se fija de 1 hora a 30 días (o sin límite)' using errcode = '22023';
  end if;
  new.fijado_en := now();
  return new;
end $$;
drop trigger if exists conversacion_fijado_aa_preparar on public.conversacion_fijado;
create trigger conversacion_fijado_aa_preparar before insert or update on public.conversacion_fijado
  for each row execute function public.conversacion_fijado_preparar();

-- Si se elimina (para todos), se desfija solo
create or replace function fbe_privado.al_eliminar_desfijar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.conversacion_fijado f where f.comentario_id = new.id;
  return null;
end $$;
drop trigger if exists comentarios_zz_desfijar on public.comentarios;
create trigger comentarios_zz_desfijar after update of eliminado_en on public.comentarios
  for each row when (new.eliminado_en is not null and old.eliminado_en is null)
  execute function fbe_privado.al_eliminar_desfijar();

-- ---------------------------------------------------------------------
-- 7. Silenciar una conversación (cada uno la suya)
-- ---------------------------------------------------------------------
create table if not exists public.chat_silencios (
  usuario_id  uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  atleta_id   uuid not null references public.atletas(id) on delete cascade,
  hasta       timestamptz,   -- null: siempre
  creado_en   timestamptz not null default now(),
  primary key (usuario_id, atleta_id)
);
create index if not exists chat_silencios_atleta_idx on public.chat_silencios (atleta_id);

-- A su nombre; de su conversación (el coach, la de cualquier atleta; un atleta, la suya); hasta 8 días (o siempre).
-- Al silenciar, las notificaciones pendientes de esa conversación que saldrían mientras dura se quitan.
-- Cuenta una vez en el cupo: un «insert … on conflict do update» pasa por aquí dos veces (antes de insertar y, al
-- chocar, antes de actualizar); lo apunta la primera (en la transacción) y la segunda no vuelve a gastar.
create or replace function public.chat_silencio_preparar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(nullif(current_setting('role', true), ''), 'none') in ('authenticated', 'anon') then
    if tg_op = 'UPDATE' and (new.usuario_id, new.atleta_id) is distinct from (old.usuario_id, old.atleta_id) then
      raise exception 'De un silencio solo se cambia hasta cuándo' using errcode = '42501';
    end if;
    new.usuario_id := auth.uid();
    if new.usuario_id is null or not (public.es_coach() or (public.mi_atleta_id() is not null and new.atleta_id = public.mi_atleta_id())) then
      raise exception 'Solo puedes silenciar tus conversaciones' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and current_setting('fbe.silencio_cobrado', true) = new.atleta_id::text then
      perform set_config('fbe.silencio_cobrado', '', true);
    else
      perform fbe_privado.chat_gastar_cupo('silenciar');
      perform set_config('fbe.silencio_cobrado', case when tg_op = 'INSERT' then new.atleta_id::text else '' end, true);
    end if;
  end if;
  if new.hasta is not null and coalesce(nullif(current_setting('role', true), ''), 'none') in ('authenticated', 'anon')
     and (new.hasta <= now() or new.hasta > now() + interval '8 days') then
    raise exception 'Se silencia 8 horas, 1 semana o siempre' using errcode = '22023';
  end if;
  new.creado_en := now();
  return new;
end $$;
drop trigger if exists chat_silencios_aa_preparar on public.chat_silencios;
create trigger chat_silencios_aa_preparar before insert or update on public.chat_silencios
  for each row execute function public.chat_silencio_preparar();

create or replace function fbe_privado.al_silenciar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notificaciones n
  where n.usuario_id = new.usuario_id and n.estado = 'pendiente' and n.tipo in ('respuesta', 'mensaje')
    and (n.url = '#mensajes' or n.url like '#mensajes/%')
    and (new.hasta is null or n.enviar_desde < new.hasta)
    and (n.clave like 'mensaje:' || new.atleta_id::text || ':%'
         or (n.clave like 'comentario:%' and exists (select 1 from public.comentarios c where c.id::text = substr(n.clave, 12) and c.atleta_id = new.atleta_id)));
  return null;
end $$;
drop trigger if exists chat_silencios_zz_quitar on public.chat_silencios;
create trigger chat_silencios_zz_quitar after insert or update on public.chat_silencios
  for each row execute function fbe_privado.al_silenciar();

-- Las notificaciones de los mensajes del chat: la del coach lleva a esa conversación (#mensajes/<atleta>), y la de una
-- conversación silenciada (mientras sale) no se crea. Solo las del chat (las que llevan a #mensajes): un comentario
-- en una sesión, un check-in o un vídeo sigue avisando. Sin texto del mensaje, como siempre.
-- (Al quitar el silencio no se rehacen las de los programados del coach que se quitaron al silenciar: esos mensajes
-- salen igual, sin aviso.)
create or replace function fbe_privado.notificacion_chat() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_atleta uuid;
begin
  if new.tipo not in ('respuesta', 'mensaje') or not (new.url = '#mensajes' or new.url like '#mensajes/%') then return new; end if;
  if new.clave ~ '^comentario:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select c.atleta_id into v_atleta from public.comentarios c where c.id = substr(new.clave, 12)::uuid;
  elsif new.clave ~ '^mensaje:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:' then
    v_atleta := substr(new.clave, 9, 36)::uuid;
  end if;
  if v_atleta is null then return new; end if;
  if new.tipo = 'mensaje' and new.url = '#mensajes' then new.url := '#mensajes/' || v_atleta::text; end if;
  if exists (select 1 from public.chat_silencios s where s.usuario_id = new.usuario_id and s.atleta_id = v_atleta
             and (s.hasta is null or s.hasta > new.enviar_desde)) then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists notificaciones_aa_chat on public.notificaciones;
create trigger notificaciones_aa_chat before insert on public.notificaciones
  for each row execute function fbe_privado.notificacion_chat();

alter table public.notificaciones drop constraint if exists notificaciones_validas;
alter table public.notificaciones add constraint notificaciones_validas check (
  tipo in ('respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario',
           'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido', 'prueba', 'descanso', 'comunidad',
           'tarea', 'tarea_hecha')
  and char_length(titulo) between 1 and 80
  and (cuerpo is null or char_length(cuerpo) <= 160)
  and (url in ('#hoy', '#semana', '#checkin', '#progreso', '#perfil', '#atletas', '#revisar', '#cuenta', '#mensajes', '#equipo')
       or url ~ '^#mensajes/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  and char_length(clave) between 1 and 100
  and estado in ('pendiente', 'enviando', 'enviada', 'caducada', 'fallida')
  and (canal is null or canal in ('push', 'email'))
  and intentos between 0 and 100
  and (error is null or char_length(error) <= 200)
) not valid;

-- ---------------------------------------------------------------------
-- 8. Listas de difusión (solo el coach)
-- ---------------------------------------------------------------------
create table if not exists public.listas_difusion (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  creada_en  timestamptz not null default now()
);
alter table public.listas_difusion drop constraint if exists listas_difusion_nombre_valido;
alter table public.listas_difusion add constraint listas_difusion_nombre_valido
  check (char_length(nombre) between 1 and 40 and public.texto_visible(nombre) and nombre !~ '[[:cntrl:]]');
create unique index if not exists listas_difusion_nombre_unico on public.listas_difusion (lower(btrim(nombre)));
create table if not exists public.listas_difusion_miembros (
  lista_id   uuid not null references public.listas_difusion(id) on delete cascade,
  atleta_id  uuid not null references public.atletas(id) on delete cascade,
  primary key (lista_id, atleta_id)
);
create index if not exists listas_difusion_miembros_atleta_idx on public.listas_difusion_miembros (atleta_id);

-- 30 listas como mucho, de 256 atletas cada una (como WhatsApp)
create or replace function public.lista_difusion_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'listas_difusion' then
    if tg_op = 'INSERT' then
      if (select count(*) from public.listas_difusion) >= 30 then
        raise exception 'Como mucho 30 listas de difusión' using errcode = '23514';
      end if;
      new.creada_en := now();
    else
      new.creada_en := old.creada_en;
    end if;
    new.nombre := btrim(new.nombre);
  elsif (select count(*) from public.listas_difusion_miembros m where m.lista_id = new.lista_id) >= 256 then
    raise exception 'Una lista de difusión, como mucho 256 atletas' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists listas_difusion_aa_preparar on public.listas_difusion;
create trigger listas_difusion_aa_preparar before insert or update on public.listas_difusion
  for each row execute function public.lista_difusion_preparar();
drop trigger if exists listas_difusion_miembros_aa_preparar on public.listas_difusion_miembros;
create trigger listas_difusion_miembros_aa_preparar before insert on public.listas_difusion_miembros
  for each row execute function public.lista_difusion_preparar();

-- ---------------------------------------------------------------------
-- 9. Reenviar y difundir (solo el coach, en una transacción)
-- ---------------------------------------------------------------------
-- ¿Vale este archivo como la copia para p_atleta? Una foto, un vídeo o un documento del chat de ese atleta, recién
-- registrado (la app lo copia en Storage justo antes), del mismo tipo y formato, y que aún no lleva ningún mensaje.
create or replace function fbe_privado.chat_copia_valida(p_archivo uuid, p_atleta uuid, p_tipo text, p_mime text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.archivos a
                 where a.id = p_archivo and a.atleta_id = p_atleta and a.tipo in ('adjunto', 'documento') and a.subido_por = 'coach'
                   and a.tipo = coalesce(p_tipo, a.tipo) and a.mime is not distinct from coalesce(p_mime, a.mime)
                   and a.creado_en > now() - interval '1 hour'
                   and not exists (select 1 from public.comentarios c where c.archivo_id = a.id))
$$;

-- Reenvía un mensaje del coach (ya salido, sin eliminar, del chat) a cada atleta de p_destinos:
-- [{ "atleta": uuid, "archivo": uuid | null, "cliente": uuid | null }] (de 1 a 50, sin repetir). Con foto, vídeo o
-- documento, cada uno con su copia (archivo); si no, sin archivo. Los de baja, no. Sin repetir con el mismo cliente.
-- Devuelve [{ atleta_id, id }] de los creados.
create or replace function public.chat_reenviar(p_comentario uuid, p_destinos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.comentarios;
  a public.archivos;
  d jsonb;
  v_atleta uuid;
  v_archivo uuid;
  v_id uuid;
  v_n integer;
  v_out jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.es_coach() then
    raise exception 'Solo el coach puede reenviar mensajes' using errcode = '42501';
  end if;
  select * into c from public.comentarios k where k.id = p_comentario;
  if c.id is null or c.autor <> 'coach' or c.eliminado_en is not null or (c.enviar_en is not null and c.enviar_en > now())
     or c.sesion_id is not null or c.checkin_id is not null or (c.archivo_id is not null and not c.adjunto) or c.dibujo is not null then
    raise exception 'Solo se reenvían tus mensajes del chat que ya han salido' using errcode = '42501';
  end if;
  if c.archivo_id is not null then
    select * into a from public.archivos x where x.id = c.archivo_id;
    -- Solo lo que subió el coach: nunca la foto o el PDF de un atleta (con su salud) al chat de otro
    if a.id is null or a.subido_por is distinct from 'coach'
       or exists (select 1 from public.comentarios k where k.archivo_id = a.id and k.autor = 'atleta') then
      raise exception 'Solo se reenvían las fotos, vídeos y documentos que has enviado tú' using errcode = '42501';
    end if;
  end if;
  if jsonb_typeof(p_destinos) <> 'array' then
    raise exception 'Elige a quién reenviarlo' using errcode = '22023';
  end if;
  v_n := jsonb_array_length(p_destinos);
  if v_n < 1 or v_n > 50 then
    raise exception 'Se reenvía a entre 1 y 50 atletas' using errcode = '22023';
  end if;
  if (select count(distinct x ->> 'atleta') from jsonb_array_elements(p_destinos) x) <> v_n then
    raise exception 'Un atleta, una vez' using errcode = '22023';
  end if;
  perform fbe_privado.chat_cupo_coach('reenviar', v_n);
  for d in select * from jsonb_array_elements(p_destinos) loop
    v_atleta := nullif(d ->> 'atleta', '')::uuid;
    v_archivo := nullif(d ->> 'archivo', '')::uuid;
    if not exists (select 1 from public.atletas x where x.id = v_atleta and x.estado <> 'baja') then
      raise exception 'Uno de los atletas no está (o está de baja)' using errcode = '42501';
    end if;
    if a.id is not null then
      if v_archivo is null or not fbe_privado.chat_copia_valida(v_archivo, v_atleta, a.tipo, a.mime) then
        raise exception 'Falta la copia del archivo para uno de los atletas' using errcode = '42501';
      end if;
    elsif v_archivo is not null then
      raise exception 'Este mensaje no lleva archivo' using errcode = '22023';
    end if;
    v_id := null;
    insert into public.comentarios (atleta_id, autor, texto, archivo_id, reenviado, cliente_id)
    values (v_atleta, 'coach', c.texto, v_archivo, true, nullif(d ->> 'cliente', '')::uuid)
    on conflict on constraint comentarios_cliente_unico do nothing
    returning id into v_id;
    if v_id is not null then v_out := v_out || jsonb_build_array(jsonb_build_object('atleta_id', v_atleta, 'id', v_id)); end if;
  end loop;
  return v_out;
end $$;

-- Un mensaje a cada miembro de una lista, en su chat (todos o ninguno). p_texto (con archivo, el pie); p_enviar_en:
-- programado (solo texto); p_destinos: [{ "atleta": uuid, "archivo": uuid }] (las copias, con archivo); p_cliente:
-- el id del envío (el mismo para todos: no se repite al reintentar). Los de baja se saltan. Devuelve
-- { enviados, saltados, ids }.
create or replace function public.chat_difundir(p_lista uuid, p_texto text, p_enviar_en timestamptz default null,
                                                p_destinos jsonb default null, p_cliente uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m record;
  v_archivo uuid;
  v_texto text := btrim(coalesce(p_texto, ''));
  v_con_archivo boolean := p_destinos is not null and jsonb_typeof(p_destinos) = 'array' and jsonb_array_length(p_destinos) > 0;
  v_mime text;
  v_tipo text;
  v_id uuid;
  v_ids jsonb := '[]'::jsonb;
  v_saltados integer := 0;
begin
  if auth.uid() is null or not public.es_coach() then
    raise exception 'Solo el coach envía difusiones' using errcode = '42501';
  end if;
  if not exists (select 1 from public.listas_difusion l where l.id = p_lista) then
    raise exception 'Esa lista ya no está' using errcode = '42501';
  end if;
  if char_length(v_texto) > 4000 then
    raise exception 'Un mensaje, hasta 4000 letras' using errcode = '22023';
  end if;
  if not v_con_archivo and not public.texto_visible(v_texto) then
    raise exception 'Escribe el mensaje' using errcode = '22023';
  end if;
  if v_con_archivo and p_enviar_en is not null then
    raise exception 'Los mensajes con foto, vídeo o documento no se pueden programar' using errcode = '22023';
  end if;
  if v_con_archivo then
    select a.mime, a.tipo into v_mime, v_tipo from public.archivos a where a.id = nullif(p_destinos -> 0 ->> 'archivo', '')::uuid;
    if v_mime is null then
      raise exception 'Falta el archivo' using errcode = '22023';
    end if;
    if not public.texto_visible(v_texto) then
      v_texto := case when v_tipo = 'documento' then 'Documento' when v_mime like 'image/%' then 'Foto' else 'Vídeo' end;
    end if;
  end if;
  perform fbe_privado.chat_cupo_coach('difusion', 1);
  for m in select x.id, x.estado from public.listas_difusion_miembros lm join public.atletas x on x.id = lm.atleta_id
           where lm.lista_id = p_lista order by x.nombre, x.id loop
    if m.estado = 'baja' then v_saltados := v_saltados + 1; continue; end if;
    v_archivo := null;
    if v_con_archivo then
      select nullif(d ->> 'archivo', '')::uuid into v_archivo from jsonb_array_elements(p_destinos) d where d ->> 'atleta' = m.id::text limit 1;
      if v_archivo is null or not fbe_privado.chat_copia_valida(v_archivo, m.id, v_tipo, v_mime) then
        raise exception 'Falta la copia del archivo para uno de los atletas de la lista' using errcode = '42501';
      end if;
    end if;
    v_id := null;
    insert into public.comentarios (atleta_id, autor, texto, archivo_id, enviar_en, cliente_id)
    values (m.id, 'coach', v_texto, v_archivo, p_enviar_en, p_cliente)
    on conflict on constraint comentarios_cliente_unico do nothing
    returning id into v_id;
    if v_id is not null then v_ids := v_ids || to_jsonb(v_id); end if;
  end loop;
  return jsonb_build_object('enviados', jsonb_array_length(v_ids), 'saltados', v_saltados, 'ids', v_ids);
end $$;

-- «Info del contacto» del atleta: el nombre de su coach (el corto, el mismo que ya sale en sus notificaciones). Solo
-- para una cuenta vinculada a un atleta (o el coach).
create or replace function public.nombre_coach() returns text
language sql stable security definer set search_path = '' as $$
  select fbe_privado.nombre_corto(p.nombre) from public.perfiles p
  where p.rol = 'coach' and auth.uid() is not null and (public.es_coach() or public.mi_atleta_id() is not null)
  order by p.creado_en
  limit 1
$$;

-- ---------------------------------------------------------------------
-- 10. Permisos (desde la 019, cada tabla nueva lleva los suyos a mano)
-- ---------------------------------------------------------------------
alter table public.conversacion_fijado enable row level security;
alter table public.chat_silencios enable row level security;
alter table public.listas_difusion enable row level security;
alter table public.listas_difusion_miembros enable row level security;

-- Lo fijado: el coach lo pone y lo quita; lo ven el coach y ese atleta (mientras no caduca)
drop policy if exists coach_todo on public.conversacion_fijado;
create policy coach_todo on public.conversacion_fijado for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.conversacion_fijado;
create policy atleta_ver on public.conversacion_fijado for select to authenticated
  using (public.mi_atleta_id() is not null and atleta_id = public.mi_atleta_id() and (hasta is null or hasta > now()));

-- Los silencios: cada uno los suyos (nadie ve los de otro, ni el coach los del atleta)
drop policy if exists propios_todo on public.chat_silencios;
create policy propios_todo on public.chat_silencios for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid() and (public.es_coach() or (public.mi_atleta_id() is not null and atleta_id = public.mi_atleta_id())));

-- Las listas de difusión: solo el coach (los atletas no las ven, ni quién está en ellas)
drop policy if exists coach_todo on public.listas_difusion;
create policy coach_todo on public.listas_difusion for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists coach_todo on public.listas_difusion_miembros;
create policy coach_todo on public.listas_difusion_miembros for all to authenticated
  using (public.es_coach()) with check (public.es_coach());

revoke all on public.conversacion_fijado, public.chat_silencios, public.listas_difusion, public.listas_difusion_miembros
  from public, anon, authenticated;
grant select, insert, update, delete on public.conversacion_fijado to authenticated;
grant select, insert, update, delete on public.chat_silencios to authenticated;
grant select, insert, update, delete on public.listas_difusion to authenticated;
grant select, insert, delete on public.listas_difusion_miembros to authenticated;

-- Permisos (como al final de 003 a 032)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (33)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
