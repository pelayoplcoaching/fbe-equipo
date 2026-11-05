-- =====================================================================
-- FBE Equipo, migración 034 (v0.56): notas de voz, encuestas, «escuchado» y reacciones a elegir
--   · Notas de voz en el chat: archivos.tipo 'audio' (audio/webm, ogg, mp4/m4a, mpeg o aac; de 1 a 61 segundos, hasta
--     3 MB, ruta generada <atleta>/audio-…; su forma de onda, archivos.onda, de 8 a 64 barras de 0 a 100), en su propio
--     bucket de Storage («voz»: privado, 3 MB por archivo y solo esos formatos; así el tope lo pone Storage, no lo que
--     diga la app). Las mismas
--     reglas que las fotos del chat: el atleta no las borra de Storage ni de archivos si llevan mensaje; se eliminan para
--     todos en 48 horas; el coach reenvía las suyas (nunca las de un atleta). Como mucho 60 al día (el atleta), aparte de
--     los 30 archivos.
--   · «Escuchado» (comentarios.escuchado_en, el micro azul): lo apunta la base cuando quien la recibe la reproduce
--     (marcar_escuchado()). Sin «Mostrar cuándo estoy en línea», no se apunta (diría al momento cuándo la escucha).
--   · Encuestas en el chat (encuestas_chat, encuesta_votos): las crea el coach con chat_encuesta() en una conversación o a
--     una lista de difusión (cada atleta, la suya); pregunta y de 2 a 12 opciones, una o varias respuestas. El atleta de
--     esa conversación vota (y cambia el voto, o lo quita) con encuesta_votar(); el coach ve el resultado. El voto solo
--     lo ven ese atleta y el coach. Un mensaje con encuesta no se edita; si se elimina, la encuesta y su voto se van.
--   · Reacciones: cualquier emoji (con su tono de piel), no solo los seis de siempre: cada uno elige los suyos.
--   · Cupos: votar (120 por hora, el atleta) y encuestas (30 por hora, el coach).
--   · Una ruta que espera a borrarse de Storage no se vuelve a registrar (no se recupera así el acceso a lo eliminado).
--   · El aviso de privacidad (privacidad_vista): qué versión de la política ha visto cada uno (solo la suya, nunca hacia
--     atrás); la app lo enseña una vez por versión.
-- Se ejecuta en el SQL Editor después de la 033 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 34 then
    raise exception 'Esta base ya tiene la migración %: repetir la 034 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 34;» y, después de ella, todas las siguientes en orden, todo en la misma consulta del SQL Editor (una sola transacción).';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 33) then
    raise exception 'Antes de la 034 hace falta la 033: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
  -- (v0.73) Con datos de la 045 (momentos, aniversarios, las reacciones ❤️ 😂 🏆, pegatinas o fotos de la comunidad en la cola de
  -- Storage), las reglas de la 034 no caben: repetirla se quedaría a medias. Se para antes de tocar nada.
  if to_regclass('public.comunidad_posts') is not null then
    if exists (select 1 from public.comunidad_posts x where x.tipo in ('momento', 'aniversario'))
       or exists (select 1 from public.comunidad_reacciones r where r.tipo not in ('fuerza', 'fuego', 'aplauso'))
       or exists (select 1 from public.comunidad_reportes r where r.copia_tipo in ('momento', 'aniversario'))
       or exists (select 1 from public.comunidad_comentarios k where to_jsonb(k) ->> 'pegatina' is not null) then
      raise exception 'Esta base tiene momentos, aniversarios, reacciones nuevas o pegatinas de la 045: repetir la 034 los dejaría fuera de sus reglas. No la repitas sola.'
        using hint = 'Si de verdad hace falta: borra antes esas publicaciones, reacciones y pegatinas (o restaura la copia) y ejecuta la 034 y todas las siguientes en orden, en la misma consulta del SQL Editor (una sola transacción).';
    end if;
  end if;
  if to_regclass('fbe_privado.storage_por_borrar') is not null then
    if exists (select 1 from fbe_privado.storage_por_borrar s where s.bucket = 'comunidad') then
      raise exception 'Esta base tiene fotos de la comunidad esperando a borrarse de Storage (de la 045): repetir la 034 las dejaría fuera de sus reglas. No la repitas sola.'
        using hint = 'Abre antes la app como coach (vacía la cola de Storage) y después ejecuta la 034 y todas las siguientes en orden, en la misma consulta del SQL Editor.';
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Notas de voz (archivos.tipo 'audio') y «escuchado»
-- ---------------------------------------------------------------------
alter table public.comentarios add column if not exists escuchado_en timestamptz;
alter table public.archivos add column if not exists onda smallint[];

alter table public.archivos drop constraint if exists archivos_tipo_check;
alter table public.archivos add constraint archivos_tipo_check
  check (tipo in ('video_tecnica', 'foto_progreso', 'adjunto', 'documento', 'audio')) not valid;
-- Una nota de voz: audio de los formatos que graban los navegadores, de 1 a 61 segundos (el minuto y un poco de margen),
-- hasta 3 MB, con su ruta generada (audio-…), sin nombre, miniatura ni páginas
alter table public.archivos drop constraint if exists archivos_audio_valido;
alter table public.archivos add constraint archivos_audio_valido
  check (tipo <> 'audio' or (coalesce(mime in ('audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac'), false)
                              and coalesce(bytes between 1 and 3145728, false) and coalesce(duracion_seg between 1 and 61, false)
                              and ruta ~ '/audio-[A-Za-z0-9._-]+\.(webm|ogg|m4a|mp4|mp3|aac)$'
                              and nombre is null and poster_ruta is null and paginas is null));
-- Su forma de onda (para dibujarla sin descargar el audio): de 8 a 64 barras de 0 a 100, solo en una nota de voz
alter table public.archivos drop constraint if exists archivos_onda_valida;
alter table public.archivos add constraint archivos_onda_valida
  check (onda is null or (tipo = 'audio' and cardinality(onda) between 8 and 64 and 0 <= all(onda) and 100 >= all(onda)
                          and array_position(onda, null) is null));

-- Las notas de voz, en su propio bucket privado: 3 MB por archivo y solo audio (el límite lo pone Storage)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voz', 'voz', false, 3145728, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- (en «archivos» no van: si una versión anterior de esta migración los añadió, fuera)
update storage.buckets set allowed_mime_types = array(
    select m from unnest(allowed_mime_types) m where m not in ('audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac'))
where id = 'archivos' and allowed_mime_types && array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac'];

-- ¿Es la ruta de una nota de voz? (registrada: para verla, la de su atleta o el coach)
create or replace function public.ruta_de_voz(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.archivos a where a.ruta = p_ruta and a.tipo = 'audio')
$$;
create or replace function public.voz_registrada(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.archivos a where a.ruta = p_ruta and a.tipo = 'audio'
                 and (public.es_coach() or (public.mi_atleta_id() is not null and a.atleta_id = public.mi_atleta_id())))
$$;
-- Storage («voz»): se sube lo registrado como nota de voz (el atleta, en su carpeta; el coach, con su fila ya hecha:
-- también las copias de lo que reenvía); lo ve su atleta (mientras tiene su fila) y el coach; solo lo borra el coach (la
-- app del coach vacía la cola). En «archivos», nunca una nota de voz.
drop policy if exists fbe_voz_ver on storage.objects;
create policy fbe_voz_ver on storage.objects for select to authenticated
  using (bucket_id = 'voz' and (public.es_coach() or ((storage.foldername(name))[1] = public.mi_atleta_id()::text and public.voz_registrada(name))));
drop policy if exists fbe_voz_subir on storage.objects;
create policy fbe_voz_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'voz' and public.voz_registrada(name) and (public.es_coach() or (storage.foldername(name))[1] = public.mi_atleta_id()::text));
drop policy if exists fbe_voz_borrar on storage.objects;
create policy fbe_voz_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'voz' and public.es_coach());
drop policy if exists fbe_archivos_subir on storage.objects;
create policy fbe_archivos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos' and (public.es_coach() or public.archivo_registrado(name)) and not public.ruta_de_voz(name));

-- La cola de Storage (032) sabe de los dos buckets
alter table fbe_privado.storage_por_borrar drop constraint if exists storage_por_borrar_bucket_check;
alter table fbe_privado.storage_por_borrar add constraint storage_por_borrar_bucket_check check (bucket in ('archivos', 'voz'));
create or replace function public.storage_pendiente_cubos(p_limite integer default 200) returns table (ruta text, bucket text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  return query select s.ruta, s.bucket from fbe_privado.storage_por_borrar s order by s.creado_en, s.ruta limit least(greatest(coalesce(p_limite, 200), 1), 1000);
end $$;
-- ¿Espera esta ruta a borrarse de Storage? (archivo_proteger: no se vuelve a registrar)
create or replace function public.ruta_por_borrar(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_ruta is not null and exists (select 1 from fbe_privado.storage_por_borrar s where s.ruta = p_ruta)
$$;

-- ---------------------------------------------------------------------
-- 2. Cupos con los tipos nuevos (votar, el atleta; encuestas, el coach)
-- ---------------------------------------------------------------------
alter table public.chat_cupos drop constraint if exists chat_cupos_tipo_check;
alter table public.chat_cupos add constraint chat_cupos_tipo_check
  check (tipo in ('reaccion', 'destacar', 'edicion', 'eliminar', 'presencia', 'silenciar', 'reenviar', 'difusion', 'voto', 'encuesta'));

create or replace function fbe_privado.chat_gastar_cupo(p_tipo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_max integer := case p_tipo when 'reaccion' then 120 when 'destacar' then 120 when 'voto' then 120 when 'edicion' then 30 when 'eliminar' then 30 else 30 end;
begin
  if auth.uid() is null or public.es_coach() then return; end if;
  -- Una cuenta y un tipo a la vez (dos peticiones simultáneas no se saltan el cupo)
  perform pg_advisory_xact_lock(hashtext('fbe-chat-cupo:' || auth.uid()::text || ':' || coalesce(p_tipo, '')));
  delete from public.chat_cupos c where c.perfil_id = auth.uid() and c.creado_en < now() - interval '2 hours';
  if (select count(*) from public.chat_cupos c where c.perfil_id = auth.uid() and c.tipo = p_tipo and c.creado_en > now() - interval '1 hour') >= v_max then
    raise exception '%', case p_tipo when 'reaccion' then 'Has reaccionado muchas veces en la última hora: espera un poco'
                                     when 'destacar' then 'Has destacado muchos mensajes en la última hora: espera un poco'
                                     when 'voto' then 'Has votado muchas veces en la última hora: espera un poco'
                                     when 'edicion' then 'Has editado muchos mensajes en la última hora: espera un poco'
                                     when 'eliminar' then 'Has eliminado muchos mensajes en la última hora: espera un poco'
                                     when 'silenciar' then 'Has silenciado y activado el chat muchas veces en la última hora: espera un poco'
                                     else 'Has cambiado muchas veces «Mostrar cuándo estoy en línea»: espera un poco' end using errcode = '54000';
  end if;
  insert into public.chat_cupos (perfil_id, tipo) values (auth.uid(), p_tipo);
end $$;

-- Los del coach: reenviar (300 mensajes por hora), difundir (30 envíos por hora) y encuestas (30 por hora)
create or replace function fbe_privado.chat_cupo_coach(p_tipo text, p_n integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_max integer := case p_tipo when 'reenviar' then 300 when 'difusion' then 30 when 'encuesta' then 30 else 0 end;
begin
  if auth.uid() is null or p_tipo not in ('reenviar', 'difusion', 'encuesta') or coalesce(p_n, 0) < 1 then
    raise exception 'Cupo no válido' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('fbe-chat-cupo:' || auth.uid()::text || ':' || p_tipo));
  delete from public.chat_cupos c where c.perfil_id = auth.uid() and c.creado_en < now() - interval '2 hours';
  if (select count(*) from public.chat_cupos c where c.perfil_id = auth.uid() and c.tipo = p_tipo and c.creado_en > now() - interval '1 hour') + p_n > v_max then
    raise exception '%', case p_tipo when 'reenviar' then 'Has reenviado muchos mensajes en la última hora: espera un poco'
                                     when 'encuesta' then 'Has creado muchas encuestas en la última hora: espera un poco'
                                     else 'Has enviado muchas difusiones en la última hora: espera un poco' end using errcode = '54000';
  end if;
  insert into public.chat_cupos (perfil_id, tipo) select auth.uid(), p_tipo from generate_series(1, p_n);
end $$;

-- ---------------------------------------------------------------------
-- 3. Encuestas en el chat (las tablas: comentario_preparar las necesita)
-- ---------------------------------------------------------------------
create table if not exists public.encuestas_chat (
  id             uuid primary key default gen_random_uuid(),
  comentario_id  uuid not null unique references public.comentarios(id) on delete cascade,
  atleta_id      uuid not null references public.atletas(id) on delete cascade,
  pregunta       text not null,
  opciones       jsonb not null,
  multiple       boolean not null default false,
  creada_en      timestamptz not null default now()
);
create index if not exists encuestas_chat_atleta_idx on public.encuestas_chat (atleta_id);
alter table public.encuestas_chat drop constraint if exists encuestas_chat_validas;
alter table public.encuestas_chat add constraint encuestas_chat_validas
  check (char_length(pregunta) between 1 and 300 and public.texto_visible(pregunta)
         and jsonb_typeof(opciones) = 'array' and jsonb_array_length(opciones) between 2 and 12);

create table if not exists public.encuesta_votos (
  encuesta_id  uuid primary key references public.encuestas_chat(id) on delete cascade,
  atleta_id    uuid not null references public.atletas(id) on delete cascade,
  opciones     smallint[] not null,
  votado_en    timestamptz not null default now()
);
create index if not exists encuesta_votos_atleta_idx on public.encuesta_votos (atleta_id);
alter table public.encuesta_votos drop constraint if exists encuesta_votos_validos;
alter table public.encuesta_votos add constraint encuesta_votos_validos
  check (cardinality(opciones) between 1 and 12 and 0 <= all(opciones) and 11 >= all(opciones) and array_position(opciones, null) is null);

-- Las opciones: de 2 a 12 textos de 1 a 100 letras, visibles y sin repetir (sin contar mayúsculas ni espacios de más)
create or replace function public.encuesta_preparar() returns trigger
language plpgsql set search_path = '' as $$
declare v_n integer;
begin
  if jsonb_typeof(new.opciones) <> 'array' then
    raise exception 'Una encuesta lleva de 2 a 12 opciones' using errcode = '22023';
  end if;
  select count(*) into v_n from jsonb_array_elements(new.opciones) o
  where jsonb_typeof(o) = 'string' and char_length(btrim(o #>> '{}')) between 1 and 100 and public.texto_visible(o #>> '{}');
  if v_n <> jsonb_array_length(new.opciones) or v_n < 2 or v_n > 12 then
    raise exception 'Una encuesta lleva de 2 a 12 opciones, de hasta 100 letras' using errcode = '22023';
  end if;
  if (select count(distinct lower(btrim(o #>> '{}'))) from jsonb_array_elements(new.opciones) o) <> v_n then
    raise exception 'Las opciones de una encuesta no se repiten' using errcode = '22023';
  end if;
  new.opciones := (select jsonb_agg(btrim(o #>> '{}') order by i) from jsonb_array_elements(new.opciones) with ordinality x(o, i));
  new.pregunta := btrim(new.pregunta);
  if tg_op = 'UPDATE' and (new.comentario_id, new.atleta_id, new.pregunta, new.opciones, new.multiple, new.creada_en)
                          is distinct from (old.comentario_id, old.atleta_id, old.pregunta, old.opciones, old.multiple, old.creada_en) then
    raise exception 'Una encuesta no se cambia' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then new.creada_en := now(); end if;
  return new;
end $$;
drop trigger if exists encuestas_chat_aa_preparar on public.encuestas_chat;
create trigger encuestas_chat_aa_preparar before insert or update on public.encuestas_chat
  for each row execute function public.encuesta_preparar();

-- ---------------------------------------------------------------------
-- 4. comentario_preparar (… 033) con «escuchado», las notas de voz como adjunto y las encuestas sin editar
-- ---------------------------------------------------------------------
-- Como en la 033; además: una nota de voz también es un adjunto del chat (de quien la subió); «escuchado» lo pone la base
-- (marcar_escuchado()) y no se cambia a mano; un mensaje con encuesta no se edita.
create or replace function public.comentario_preparar() returns trigger
language plpgsql set search_path = '' as $$
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
    new.adjunto := new.archivo_id is not null and coalesce((select a.tipo in ('adjunto', 'documento', 'audio') from public.archivos a where a.id = new.archivo_id), false);
    -- Una foto, un vídeo o un documento del chat va en un mensaje de quien lo subió (el coach no pone en un mensaje
    -- suyo, ni reenvía después, lo que subió un atleta; ni al revés)
    if v_autor is not null and new.adjunto
       and (select a.subido_por from public.archivos a where a.id = new.archivo_id) is distinct from v_autor then
      raise exception 'Ese archivo no lo has subido tú' using errcode = '42501';
    end if;
    new.reenviado := coalesce(new.reenviado, false);
    new.leido_en := null;
    new.entregado_en := null;
    new.escuchado_en := null;
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
          new.cliente_id, new.reenviado, new.entregado_en, new.escuchado_en)
         is distinct from (old.atleta_id, old.sesion_id, old.checkin_id, old.archivo_id, old.autor, old.dibujo, old.adjunto, old.responde_a, old.editado_en, old.eliminado_en,
          old.cliente_id, old.reenviado, old.entregado_en, old.escuchado_en) then
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
      if old.archivo_id is not null or old.dibujo is not null
         or exists (select 1 from public.encuestas_chat e where e.comentario_id = old.id) then
        raise exception 'Solo se editan los mensajes de texto' using errcode = '42501';
      end if;
      if old.creado_en < now() - interval '15 minutes' then
        raise exception 'Un mensaje se edita en los 15 minutos siguientes a enviarlo' using errcode = '42501';
      end if;
      if (new.atleta_id, new.sesion_id, new.checkin_id, new.archivo_id, new.autor, new.creado_en, new.dibujo, new.adjunto, new.enviar_en, new.responde_a, new.eliminado_en, new.leido_en,
          new.cliente_id, new.reenviado, new.entregado_en, new.escuchado_en)
         is distinct from
         (old.atleta_id, old.sesion_id, old.checkin_id, old.archivo_id, old.autor, old.creado_en, old.dibujo, old.adjunto, old.enviar_en, old.responde_a, old.eliminado_en, old.leido_en,
          old.cliente_id, old.reenviado, old.entregado_en, old.escuchado_en) then
        raise exception 'De un mensaje solo se cambia el texto' using errcode = '42501';
      end if;
      if not public.texto_visible(new.texto) then
        raise exception 'Escribe el mensaje' using errcode = '22023';
      end if;
      new.editado_en := now();
      return new;
    end if;
    if (new.atleta_id, new.sesion_id, new.checkin_id, new.archivo_id, new.autor, new.texto, new.creado_en, new.dibujo, new.adjunto, new.enviar_en, new.responde_a, new.editado_en, new.eliminado_en,
        new.cliente_id, new.reenviado, new.entregado_en, new.escuchado_en)
       is distinct from
       (old.atleta_id, old.sesion_id, old.checkin_id, old.archivo_id, old.autor, old.texto, old.creado_en, old.dibujo, old.adjunto, old.enviar_en, old.responde_a, old.editado_en, old.eliminado_en,
        old.cliente_id, old.reenviado, old.entregado_en, old.escuchado_en) then
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
-- 5. Las notas de voz, con las reglas de las fotos del chat
-- ---------------------------------------------------------------------
-- Al registrar un archivo (… 033): además, como mucho 60 notas de voz al día (el atleta), aparte de los 30 archivos
create or replace function public.archivo_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.subido_por := case when public.es_coach() then 'coach' else 'atleta' end;
    -- (034) Una ruta que espera a borrarse de Storage (de algo eliminado) no se vuelve a registrar: con su fila, se
    -- volvería a ver hasta que se vacíe la cola
    if public.ruta_por_borrar(new.ruta) or public.ruta_por_borrar(new.poster_ruta) then
      raise exception 'Esa ruta ya se usó para un archivo eliminado: no se puede volver a registrar' using errcode = '42501';
    end if;
  end if;
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    new.revisado_en := null;
    new.comentario_coach := null;
    new.creado_en := now();
    if new.tipo <> 'audio' and (select count(*) from public.archivos a
        where a.atleta_id = new.atleta_id and a.tipo <> 'audio' and a.creado_en > now() - interval '1 day') >= 30 then
      raise exception 'Has subido 30 archivos en las últimas 24 horas: espera un poco o pide a tu coach que borre alguno' using errcode = '54000';
    end if;
    if new.tipo = 'documento' and (select count(*) from public.archivos a
        where a.atleta_id = new.atleta_id and a.tipo = 'documento' and a.creado_en > now() - interval '1 day') >= 10 then
      raise exception 'Has enviado 10 documentos en las últimas 24 horas: espera un poco' using errcode = '54000';
    end if;
    -- (034) las notas de voz, aparte: 60 al día (no cuentan en los 30 archivos)
    if new.tipo = 'audio' and (select count(*) from public.archivos a
        where a.atleta_id = new.atleta_id and a.tipo = 'audio' and a.creado_en > now() - interval '1 day') >= 60 then
      raise exception 'Has enviado 60 notas de voz en las últimas 24 horas: espera un poco' using errcode = '54000';
    end if;
  end if;
  return new;
end $$;

-- (014, 033) De un archivo, el atleta solo cambia el pie, el ejercicio y si está destacado (ni la onda de una nota de voz).
-- Quién lo subió no lo cambia nadie.
create or replace function public.archivo_proteger_cambios() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and new.subido_por is distinct from old.subido_por then
    raise exception 'No se cambia quién subió un archivo' using errcode = '42501';
  end if;
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    if (new.id, new.atleta_id, new.tipo, new.ruta, new.sesion_ejercicio_id, new.fecha, new.comentario_coach,
        new.creado_en, new.mime, new.bytes, new.revisado_en, new.duracion_seg, new.pose, new.nombre, new.paginas, new.onda)
       is distinct from
       (old.id, old.atleta_id, old.tipo, old.ruta, old.sesion_ejercicio_id, old.fecha, old.comentario_coach,
        old.creado_en, old.mime, old.bytes, old.revisado_en, old.duracion_seg, old.pose, old.nombre, old.paginas, old.onda)
       or (new.poster_ruta is not null and new.poster_ruta is distinct from old.poster_ruta) then
      raise exception 'De un archivo solo puedes cambiar el pie, el ejercicio y si está destacado' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- (032, 033) Lo que el atleta puede borrar de Storage: sus vídeos y fotos del diario y de progreso; nada del chat
create or replace function public.archivo_borrable(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.mi_atleta_id() is not null
    and exists (select 1 from public.archivos a where (a.ruta = p_ruta or a.poster_ruta = p_ruta) and a.atleta_id = public.mi_atleta_id()
                and a.tipo not in ('adjunto', 'documento', 'audio'))
$$;
drop policy if exists atleta_borrar on public.archivos;
create policy atleta_borrar on public.archivos for delete to authenticated
  using (atleta_id = public.mi_atleta_id() and (tipo not in ('adjunto', 'documento', 'audio') or not public.archivo_con_mensajes(id)));

-- (032, 033) Al borrar un archivo: a la cola de Storage; si es del chat, sus mensajes quedan como eliminados
create or replace function public.archivo_adjunto_borrar_mensaje() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into fbe_privado.storage_por_borrar (ruta, bucket) select r, case when old.tipo = 'audio' then 'voz' else 'archivos' end
    from unnest(array[old.ruta, old.poster_ruta]) r where r is not null
    on conflict (ruta) do nothing;
  if old.tipo in ('adjunto', 'documento', 'audio') and exists (select 1 from public.atletas a where a.id = old.atleta_id) then
    for v_id in select c.id from public.comentarios c where c.archivo_id = old.id loop
      perform fbe_privado.comentario_vaciar(v_id);
    end loop;
    update public.comentarios c set archivo_id = null where c.archivo_id = old.id;
  end if;
  return old;
end $$;

-- (032, 033) Eliminar para todos: las notas de voz, como las fotos del chat
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
    select array_remove(array[a.ruta, a.poster_ruta], null) into v_rutas from public.archivos a where a.id = c.archivo_id and a.tipo in ('adjunto', 'documento', 'audio');
  end if;
  perform fbe_privado.comentario_vaciar(c.id);
  if c.adjunto and c.archivo_id is not null then
    update public.comentarios k set archivo_id = null where k.archivo_id = c.archivo_id and k.id <> c.id;
    delete from public.archivos a where a.id = c.archivo_id and a.tipo in ('adjunto', 'documento', 'audio');
  end if;
  return jsonb_build_object('estado', 'eliminado', 'rutas', to_jsonb(coalesce(v_rutas, '{}')));
end $$;

-- (032, 033) Buscar: sin las marcas de las notas de voz («Nota de voz») tampoco
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
    and not (c.archivo_id is not null and c.texto in ('Foto', 'Vídeo', 'Documento', 'Nota de voz'))
    and translate(lower(c.texto), 'áàâäéèêëíìîïóòôöúùûüñç', 'aaaaeeeeiiiioooouuuunc') like '%' || q.t || '%'
  order by c.creado_en desc
  limit least(greatest(coalesce(p_limite, 40), 1), 100)
$$;

-- (033) ¿Vale este archivo como la copia para p_atleta? También una nota de voz (del coach)
create or replace function fbe_privado.chat_copia_valida(p_archivo uuid, p_atleta uuid, p_tipo text, p_mime text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.archivos a
                 where a.id = p_archivo and a.atleta_id = p_atleta and a.tipo in ('adjunto', 'documento', 'audio') and a.subido_por = 'coach'
                   and a.tipo = coalesce(p_tipo, a.tipo) and a.mime is not distinct from coalesce(p_mime, a.mime)
                   and a.creado_en > now() - interval '1 hour'
                   and not exists (select 1 from public.comentarios c where c.archivo_id = a.id))
$$;

-- (033) Difundir: la marca de una nota de voz sin pie es «Nota de voz»
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
      v_texto := case when v_tipo = 'documento' then 'Documento' when v_tipo = 'audio' then 'Nota de voz' when v_mime like 'image/%' then 'Foto' else 'Vídeo' end;
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

-- (033) Reenviar: tampoco una encuesta
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
  -- (034) Una encuesta no se reenvía (llegaría como texto suelto): se manda otra
  if exists (select 1 from public.encuestas_chat e where e.comentario_id = c.id) then
    raise exception 'Una encuesta no se reenvía: crea otra (o mándala a una lista de difusión)' using errcode = '42501';
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

-- ---------------------------------------------------------------------
-- 6. «Escuchado»: quien recibe una nota de voz la reproduce
-- ---------------------------------------------------------------------
-- Solo quien la recibe (el coach, las de los atletas; un atleta, las del coach en su conversación), de una nota de voz
-- ya salida y sin eliminar. La hora, la de la base, una vez. También la da por leída y entregada. Sin «Mostrar cuándo
-- estoy en línea», nada (por Realtime diría al momento cuándo la escucha). Devuelve escuchado_en (o null).
create or replace function public.marcar_escuchado(p_comentario uuid) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  c public.comentarios;
  v_coach boolean := public.es_coach();
  v_atleta uuid := public.mi_atleta_id();
begin
  if auth.uid() is null or not (v_coach or v_atleta is not null) then
    raise exception 'Necesitas iniciar sesión' using errcode = '42501';
  end if;
  select * into c from public.comentarios k where k.id = p_comentario;
  if c.id is null or c.eliminado_en is not null or c.archivo_id is null
     or not exists (select 1 from public.archivos a where a.id = c.archivo_id and a.tipo = 'audio')
     or not ((v_coach and c.autor = 'atleta') or (not v_coach and c.atleta_id = v_atleta and c.autor = 'coach' and (c.enviar_en is null or c.enviar_en <= now()))) then
    raise exception 'Esa nota de voz no es para ti' using errcode = '42501';
  end if;
  if c.escuchado_en is not null or not public.presencia_mia_visible() then return c.escuchado_en; end if;
  update public.comentarios k set escuchado_en = now(), leido_en = coalesce(k.leido_en, now()), entregado_en = coalesce(k.entregado_en, now())
  where k.id = c.id
  returning k.escuchado_en into c.escuchado_en;
  return c.escuchado_en;
end $$;

-- ---------------------------------------------------------------------
-- 7. Encuestas: crear (el coach) y votar (el atleta)
-- ---------------------------------------------------------------------
-- Una encuesta en el chat de un atleta (p_atleta) o en el de cada miembro de una lista de difusión (p_lista), todas o
-- ninguna, sin repetir con el mismo p_cliente y saltándose a los de baja. El mensaje lleva la pregunta (su notificación,
-- como siempre, sin texto). Devuelve { enviados, saltados, ids }.
create or replace function public.chat_encuesta(p_atleta uuid, p_lista uuid, p_pregunta text, p_opciones jsonb,
                                                p_multiple boolean default false, p_cliente uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m record;
  v_id uuid;
  v_ids jsonb := '[]'::jsonb;
  v_saltados integer := 0;
  v_pregunta text := btrim(coalesce(p_pregunta, ''));
begin
  if auth.uid() is null or not public.es_coach() then
    raise exception 'Solo el coach crea encuestas' using errcode = '42501';
  end if;
  if (p_atleta is null) = (p_lista is null) then
    raise exception 'Una encuesta va a un atleta o a una lista' using errcode = '22023';
  end if;
  if char_length(v_pregunta) not between 1 and 300 or not public.texto_visible(v_pregunta) then
    raise exception 'Escribe la pregunta (hasta 300 letras)' using errcode = '22023';
  end if;
  if p_lista is not null and not exists (select 1 from public.listas_difusion l where l.id = p_lista) then
    raise exception 'Esa lista ya no está' using errcode = '42501';
  end if;
  perform fbe_privado.chat_cupo_coach('encuesta', 1);
  for m in select x.id, x.estado from public.atletas x
           where (p_atleta is not null and x.id = p_atleta)
              or (p_lista is not null and x.id in (select lm.atleta_id from public.listas_difusion_miembros lm where lm.lista_id = p_lista))
           order by x.nombre, x.id loop
    if m.estado = 'baja' then
      if p_atleta is not null then raise exception 'Está de baja: no se le puede enviar' using errcode = '42501'; end if;
      v_saltados := v_saltados + 1; continue;
    end if;
    v_id := null;
    insert into public.comentarios (atleta_id, autor, texto, cliente_id)
    values (m.id, 'coach', v_pregunta, p_cliente)
    on conflict on constraint comentarios_cliente_unico do nothing
    returning id into v_id;
    if v_id is not null then
      insert into public.encuestas_chat (comentario_id, atleta_id, pregunta, opciones, multiple)
      values (v_id, m.id, v_pregunta, p_opciones, coalesce(p_multiple, false));
      v_ids := v_ids || to_jsonb(v_id);
    end if;
  end loop;
  if p_atleta is not null and not exists (select 1 from public.atletas x where x.id = p_atleta) then
    raise exception 'Ese atleta no está' using errcode = '42501';
  end if;
  return jsonb_build_object('enviados', jsonb_array_length(v_ids), 'saltados', v_saltados, 'ids', v_ids);
end $$;

-- El atleta de esa conversación vota (o cambia su voto; con ninguna opción, lo quita). Una opción si es de una respuesta;
-- una o varias (sin repetir) si es de varias. Del mensaje ya salido y sin eliminar. Gasta cupo. Devuelve el voto.
create or replace function public.encuesta_votar(p_encuesta uuid, p_opciones integer[]) returns smallint[]
language plpgsql security definer set search_path = '' as $$
declare
  e public.encuestas_chat;
  c public.comentarios;
  v_atleta uuid := public.mi_atleta_id();
  v_n integer;
  v_voto smallint[];
begin
  if auth.uid() is null or v_atleta is null or public.es_coach() then
    raise exception 'Solo el atleta de la conversación vota' using errcode = '42501';
  end if;
  select * into e from public.encuestas_chat x where x.id = p_encuesta;
  if e.id is not null then select * into c from public.comentarios k where k.id = e.comentario_id; end if;
  if e.id is null or e.atleta_id <> v_atleta or c.id is null or c.eliminado_en is not null or (c.enviar_en is not null and c.enviar_en > now()) then
    raise exception 'Esa encuesta no está' using errcode = '42501';
  end if;
  if public.esta_de_baja() then
    raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada' using errcode = '42501';
  end if;
  v_n := jsonb_array_length(e.opciones);
  -- (primero, que sean opciones de la encuesta: un número enorme no llega a guardarse)
  if exists (select 1 from unnest(coalesce(p_opciones, '{}')) x where x is null or x < 0 or x >= v_n)
     or (select count(distinct x) from unnest(coalesce(p_opciones, '{}')) x) <> cardinality(coalesce(p_opciones, '{}')) then
    raise exception 'Esa opción no está en la encuesta' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct x::smallint order by x::smallint), '{}') into v_voto from unnest(coalesce(p_opciones, '{}')) x;
  if not e.multiple and cardinality(v_voto) > 1 then
    raise exception 'En esta encuesta se elige una opción' using errcode = '22023';
  end if;
  perform fbe_privado.chat_gastar_cupo('voto');
  if cardinality(v_voto) = 0 then
    delete from public.encuesta_votos v where v.encuesta_id = e.id;
    return null;
  end if;
  insert into public.encuesta_votos (encuesta_id, atleta_id, opciones, votado_en) values (e.id, v_atleta, v_voto, now())
  on conflict (encuesta_id) do update set opciones = excluded.opciones, votado_en = excluded.votado_en;
  return v_voto;
end $$;

-- Si el mensaje de una encuesta se elimina (para todos), la encuesta y su voto se van
create or replace function fbe_privado.al_eliminar_encuesta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.eliminado_en is not null and old.eliminado_en is null then
    delete from public.encuestas_chat e where e.comentario_id = new.id;
  end if;
  return null;
end $$;
drop trigger if exists comentarios_zz_encuesta on public.comentarios;
create trigger comentarios_zz_encuesta after update of eliminado_en on public.comentarios
  for each row execute function fbe_privado.al_eliminar_encuesta();

-- ---------------------------------------------------------------------
-- 8. Reacciones: cualquier emoji (con su tono de piel), cada uno elige los suyos
-- ---------------------------------------------------------------------
-- Un emoji (o una secuencia: tono de piel, banderas, ZWJ, teclas «1️⃣» y las banderas de etiquetas, como la de Escocia, solo con
-- su forma: 🏴 + etiquetas + la de cierre), de 1 a 16 caracteres (ni letras, ni espacios, ni invisibles sueltos)
alter table public.comentario_reacciones drop constraint if exists comentario_reacciones_emoji_valido;
alter table public.comentario_reacciones add constraint comentario_reacciones_emoji_valido
  check (char_length(emoji) between 1 and 16
         and emoji ~ '^(?:[©®‼⁉™ℹ↔-↙↩↪⌚⌛⌨⏏⏩-⏳⏸-⏺Ⓜ▪▫▶◀◻-◾☀-➿⤴⤵⬅-⬇⬛⬜⭐⭕〰〽㊗㊙\U0001F000-\U0001FAFF‍️]|[0-9#*]️?⃣|\U0001F3F4[\U000E0020-\U000E007E]+\U000E007F)+$'
         and emoji ~ '[^‍️]');

-- ---------------------------------------------------------------------
-- 8b. El aviso de privacidad: qué versión ha visto cada uno (para enseñarlo una sola vez)
-- ---------------------------------------------------------------------
create table if not exists public.privacidad_vista (
  usuario_id  uuid primary key default auth.uid() references public.perfiles(id) on delete cascade,
  version     text not null,
  vista_en    timestamptz not null default now()
);
alter table public.privacidad_vista drop constraint if exists privacidad_vista_version_valida;
alter table public.privacidad_vista add constraint privacidad_vista_version_valida check (version ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$');
-- A su nombre; una versión de la política que ya exista (no una de más de un mes vista) y nunca hacia atrás; la hora,
-- la de la base
create or replace function public.privacidad_vista_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.usuario_id := auth.uid();
    if new.usuario_id is null then raise exception 'Necesitas iniciar sesión' using errcode = '42501'; end if;
    if tg_op = 'UPDATE' and new.usuario_id is distinct from old.usuario_id then raise exception 'Solo la tuya' using errcode = '42501'; end if;
    if new.version > to_char((now() at time zone 'Europe/Madrid') + interval '1 month', 'YYYY-MM') then
      raise exception 'Esa versión de la política aún no existe' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.version < old.version then new.version := old.version; end if;
  new.vista_en := now();
  return new;
end $$;
drop trigger if exists privacidad_vista_aa_preparar on public.privacidad_vista;
create trigger privacidad_vista_aa_preparar before insert or update on public.privacidad_vista
  for each row execute function public.privacidad_vista_preparar();

-- ---------------------------------------------------------------------
-- 9. Permisos (desde la 019, cada tabla nueva lleva los suyos a mano)
-- ---------------------------------------------------------------------
alter table public.encuestas_chat enable row level security;
alter table public.encuesta_votos enable row level security;
alter table public.privacidad_vista enable row level security;
-- El aviso de privacidad: cada uno, la suya (la lee y la pone); el coach las lee
drop policy if exists ver on public.privacidad_vista;
create policy ver on public.privacidad_vista for select to authenticated using (usuario_id = auth.uid() or public.es_coach());
drop policy if exists propia_poner on public.privacidad_vista;
create policy propia_poner on public.privacidad_vista for insert to authenticated with check (usuario_id = auth.uid());
drop policy if exists propia_cambiar on public.privacidad_vista;
create policy propia_cambiar on public.privacidad_vista for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Las encuestas: el coach, todas; el atleta, las de su conversación (de mensajes ya salidos). Se crean con chat_encuesta()
drop policy if exists coach_ver on public.encuestas_chat;
create policy coach_ver on public.encuestas_chat for select to authenticated using (public.es_coach());
drop policy if exists atleta_ver on public.encuestas_chat;
create policy atleta_ver on public.encuestas_chat for select to authenticated
  using (public.mi_atleta_id() is not null and atleta_id = public.mi_atleta_id()
         and exists (select 1 from public.comentarios c where c.id = comentario_id and (c.enviar_en is null or c.enviar_en <= now())));
-- Los votos: el coach los ve; el atleta, el suyo. Se votan con encuesta_votar()
drop policy if exists coach_ver on public.encuesta_votos;
create policy coach_ver on public.encuesta_votos for select to authenticated using (public.es_coach());
drop policy if exists atleta_ver on public.encuesta_votos;
create policy atleta_ver on public.encuesta_votos for select to authenticated
  using (public.mi_atleta_id() is not null and atleta_id = public.mi_atleta_id());

revoke all on public.encuestas_chat, public.encuesta_votos from public, anon, authenticated;
grant select on public.encuestas_chat, public.encuesta_votos to authenticated;
revoke all on public.privacidad_vista from public, anon, authenticated;
grant select, insert, update on public.privacidad_vista to authenticated;

-- Permisos (como al final de 003 a 033)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (34)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
