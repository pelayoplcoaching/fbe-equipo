-- =====================================================================
-- FBE Equipo, migración 038 (v0.60): los vídeos de técnica, tanda B (primera mitad)
--   · Respuestas en vídeo en el hilo de un vídeo de técnica (comentarios.video_respuesta_id): «Grabar la revisión» del
--     coach (lo que hace en el reproductor y su voz, y si quiere su cara en una burbuja; hasta 3 minutos) y la respuesta
--     con la cámara de delante del coach o del atleta (hasta un minuto). El vídeo es un archivo del chat de siempre
--     (tipo «adjunto», mp4 o webm, de quien escribe, recién subido, con sus reglas: los 30 al día del atleta, la baja,
--     la cola de Storage); el mensaje va en el hilo del vídeo (avisa como cualquier respuesta, sin el texto). Una
--     respuesta, un vídeo; ese vídeo no va en otro mensaje ni se cambia. Al eliminar el mensaje (o borrarlo), su vídeo se
--     borra; al borrar el vídeo de técnica, también sus respuestas en vídeo. El atleta no borra uno que lleva su mensaje.
--   · Dos ángulos de la misma serie (archivos.angulo_de): un vídeo de técnica enlaza a otro del mismo atleta; un vídeo,
--     como mucho una pareja (sin cadenas). Pasar uno a otro atleta o borrarlo lo desenlaza. El desfase entre los dos (de −2
--     a +2 s) va con la corrección (video_revisiones.dos_angulos = { con, desfase }, con dos_angulos_valido()); no cuenta
--     como corregir. El atleta lo lee con video_correcciones() (que lo devuelve, sin ninguna hora, como en la 036).
--   · El ritmo de grabación (archivos.fps_captura, de 24 a 240): lo pone la app al subir un vídeo grabado en cámara lenta
--     (para abrirlo a 0,25× o 0,5×); después no se cambia.
--   · Pasar un vídeo a otro atleta (037): además, sus respuestas en vídeo se borran (son de esa conversación) y su pareja
--     de ángulos y su desfase se quitan.
-- Exportar con correcciones y difuminar la cara se hacen en el móvil: no tocan la base.
-- Se ejecuta en el SQL Editor después de la 037 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 38 then
    raise exception 'Esta base ya tiene la migración %: repetir la 038 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 38;» y, después de ella, todas las siguientes en orden, todo en la misma consulta del SQL Editor (una sola transacción).';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 37) then
    raise exception 'Antes de la 038 hace falta la 037: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Respuestas en vídeo en el hilo de un vídeo de técnica
-- ---------------------------------------------------------------------
alter table public.comentarios add column if not exists video_respuesta_id uuid references public.archivos(id) on delete set null;
create unique index if not exists comentarios_video_respuesta_unica on public.comentarios (video_respuesta_id) where video_respuesta_id is not null;

-- (032) ¿Lleva este archivo algún mensaje? Además, el de una respuesta en vídeo (038): así el atleta no borra el vídeo del
-- mensaje de su coach, y una nota de voz o un vídeo ya usados no se usan para otra cosa
create or replace function public.archivo_con_mensajes(p_archivo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.comentarios c where c.archivo_id = p_archivo or c.video_respuesta_id = p_archivo)
$$;

-- Al escribir el mensaje (después de comentario_preparar, que pone su autor y su atleta: «q» va después de «preparar»): la
-- respuesta, en el hilo de un vídeo de técnica (no en el chat, una sesión o un check-in); su vídeo, un archivo del chat
-- (mp4 o webm) de quien escribe y de ese atleta, recién subido (en la última hora), con su duración (hasta 3 min el coach
-- y 1 min el atleta, con un segundo de margen) y su tamaño (hasta 100 MB), que no está en ningún otro mensaje. Después no
-- se cambia desde la app: solo se va con su vídeo (la clave ajena lo deja en null) o lo quita la base. Y al revés: un vídeo
-- de una respuesta no va como archivo de otro mensaje. (Lee lo que el atleta no ve: con los permisos de su dueño; quién
-- escribe lo dice el rol de la sesión, como en la 037)
create or replace function public.comentario_respuesta_video() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_app boolean := coalesce(nullif(current_setting('role', true), ''), 'none') in ('authenticated', 'anon');
  v public.archivos;
  a public.archivos;
begin
  if new.archivo_id is not null and (tg_op = 'INSERT' or new.archivo_id is distinct from old.archivo_id)
     and exists (select 1 from public.comentarios c where c.video_respuesta_id = new.archivo_id and c.id <> new.id) then
    raise exception 'Ese vídeo es una respuesta en el hilo de un vídeo: no va en otro mensaje' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.video_respuesta_id is not distinct from old.video_respuesta_id then return new; end if;
    if v_app and (new.video_respuesta_id is not null or exists (select 1 from public.archivos x where x.id = old.video_respuesta_id)) then
      raise exception 'La respuesta en vídeo de un mensaje no se cambia' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.video_respuesta_id is null then return new; end if;
  select * into v from public.archivos x where x.id = new.archivo_id;
  if v.id is null or v.tipo <> 'video_tecnica' or coalesce(new.adjunto, false) or new.sesion_id is not null or new.checkin_id is not null then
    raise exception 'Una respuesta en vídeo va en el hilo de un vídeo de técnica' using errcode = '22023';
  end if;
  select * into a from public.archivos x where x.id = new.video_respuesta_id;
  if a.id is null or a.tipo <> 'adjunto' or a.atleta_id is distinct from new.atleta_id or a.subido_por is distinct from new.autor
     or coalesce(a.mime, '') not in ('video/mp4', 'video/webm')
     or coalesce(a.duracion_seg, 0) < 1 or a.duracion_seg > (case when new.autor = 'coach' then 181 else 61 end)
     or coalesce(a.bytes, 0) not between 1 and 104857600
     or a.creado_en < now() - interval '1 hour'
     or public.archivo_con_mensajes(a.id) then
    raise exception 'La respuesta tiene que ser un vídeo tuyo recién grabado para este hilo (de hasta % min)', case when new.autor = 'coach' then 3 else 1 end
      using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists comentarios_q_respuesta_video on public.comentarios;
create trigger comentarios_q_respuesta_video before insert or update of archivo_id, video_respuesta_id on public.comentarios
  for each row execute function public.comentario_respuesta_video();

-- Al eliminar el mensaje para todos (o borrarlo), su vídeo se va con él: fuera de la tabla y a la cola de Storage (lo pone
-- el disparador de archivos, 034)
create or replace function fbe_privado.comentario_sin_respuesta_video() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.video_respuesta_id is not null then delete from public.archivos a where a.id = old.video_respuesta_id and a.tipo = 'adjunto'; end if;
    return old;
  end if;
  if new.eliminado_en is not null and old.eliminado_en is null and old.video_respuesta_id is not null then
    delete from public.archivos a where a.id = old.video_respuesta_id and a.tipo = 'adjunto';
  end if;
  return null;
end $$;
drop trigger if exists comentarios_zz_respuesta_video on public.comentarios;
create trigger comentarios_zz_respuesta_video after update of eliminado_en or delete on public.comentarios
  for each row execute function fbe_privado.comentario_sin_respuesta_video();

-- ---------------------------------------------------------------------
-- 2. Dos ángulos de la misma serie y el ritmo de grabación (cámara lenta)
-- ---------------------------------------------------------------------
alter table public.archivos add column if not exists angulo_de uuid references public.archivos(id) on delete set null;
alter table public.archivos add column if not exists fps_captura smallint;
create unique index if not exists archivos_angulo_unico on public.archivos (angulo_de) where angulo_de is not null;
alter table public.archivos drop constraint if exists archivos_angulo_valido;
alter table public.archivos add constraint archivos_angulo_valido
  check (angulo_de is null or (tipo = 'video_tecnica' and angulo_de <> id)) not valid;
alter table public.archivos drop constraint if exists archivos_fps_valido;
alter table public.archivos add constraint archivos_fps_valido
  check (fps_captura is null or (tipo = 'video_tecnica' and fps_captura between 24 and 240)) not valid;

-- El otro ángulo: otro vídeo de técnica del mismo atleta, que no tiene ya su pareja (ni enlaza a otro, ni lo enlaza otro);
-- y este, tampoco (sin cadenas: un vídeo, como mucho dos ángulos). Lo enlaza el atleta (de los suyos, si no está de
-- baja) o el coach. Al pasar el vídeo a otro atleta, se desenlaza. El ritmo de grabación, al subirlo; después no cambia.
-- (Con los permisos de quien escribe: así current_user dice si viene de la app; solo lee lo que ya ve: la pareja es suya)
create or replace function public.archivo_angulo_fps() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_app boolean := current_user in ('authenticated', 'anon');
  p public.archivos;
begin
  if tg_op = 'UPDATE' and v_app and new.fps_captura is distinct from old.fps_captura then
    raise exception 'El ritmo de grabación de un vídeo no se cambia' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.atleta_id is distinct from old.atleta_id then new.angulo_de := null; end if;
  if new.angulo_de is not null and (tg_op = 'INSERT' or new.angulo_de is distinct from old.angulo_de) then
    if v_app and tg_op = 'UPDATE' and not public.es_coach() and public.esta_de_baja() then
      raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada' using errcode = '42501';
    end if;
    -- (un atleta a la vez: dos enlaces a la vez no se saltan la regla)
    perform pg_advisory_xact_lock(hashtext('fbe-angulos:' || new.atleta_id::text));
    select * into p from public.archivos x where x.id = new.angulo_de;
    if p.id is null or p.tipo <> 'video_tecnica' or new.tipo <> 'video_tecnica' or p.atleta_id <> new.atleta_id or p.id = new.id then
      raise exception 'El otro ángulo tiene que ser otro vídeo de técnica del mismo atleta' using errcode = '42501';
    end if;
    if p.angulo_de is not null or exists (select 1 from public.archivos x where x.angulo_de = p.id and x.id <> new.id)
       or (tg_op = 'UPDATE' and exists (select 1 from public.archivos x where x.angulo_de = new.id)) then
      raise exception 'Ese vídeo ya tiene su otro ángulo: como mucho dos ángulos de una serie' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists archivos_ac_angulo on public.archivos;
create trigger archivos_ac_angulo before insert or update of angulo_de, atleta_id, fps_captura on public.archivos
  for each row execute function public.archivo_angulo_fps();

-- El desfase de los dos ángulos, con la corrección: { "con": el otro vídeo, "desfase": de −2 a 2 s con 3 decimales como
-- mucho }, nada más. Algo mal formado da false, nunca un error.
alter table public.video_revisiones add column if not exists dos_angulos jsonb;
create or replace function public.dos_angulos_valido(j jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if j is null then return false; end if;
  if jsonb_typeof(j) <> 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(j)) <> 2 then return false; end if;
  if exists (select 1 from jsonb_object_keys(j) k where k not in ('con', 'desfase')) then return false; end if;
  if coalesce(jsonb_typeof(j -> 'con'), '') <> 'string' then return false; end if;
  if (j ->> 'con') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  if not public.analisis_num(j -> 'desfase', -2, 2) then return false; end if;
  if scale((j ->> 'desfase')::numeric) > 3 then return false; end if;
  return true;
exception when others then
  return false;
end $$;
alter table public.video_revisiones drop constraint if exists video_revisiones_angulos_validos;
alter table public.video_revisiones add constraint video_revisiones_angulos_validos
  check (dos_angulos is null or public.dos_angulos_valido(dos_angulos));
-- El otro vídeo, el de su pareja de ángulos (después de video_revision_preparar y de las marcas de la 037: «ac»)
create or replace function public.video_revision_angulos() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_con uuid;
begin
  if new.dos_angulos is null or not public.dos_angulos_valido(new.dos_angulos) then return new; end if;
  if tg_op = 'UPDATE' and new.dos_angulos is not distinct from old.dos_angulos then return new; end if;
  v_con := (new.dos_angulos ->> 'con')::uuid;
  if not exists (select 1 from public.archivos a where a.id = new.archivo_id
                 and (a.angulo_de = v_con or exists (select 1 from public.archivos p where p.id = v_con and p.angulo_de = a.id))) then
    raise exception 'El desfase es con el otro ángulo de este vídeo' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists video_revisiones_ac_angulos on public.video_revisiones;
create trigger video_revisiones_ac_angulos before insert or update on public.video_revisiones
  for each row execute function public.video_revision_angulos();

-- (036) Lo que lee el atleta: video_correcciones() devuelve también el desfase de los dos ángulos (sin ninguna hora)
drop function if exists public.video_correcciones(uuid[]);
create function public.video_correcciones(p_archivos uuid[])
returns table (archivo_id uuid, atleta_id uuid, puntuacion smallint, checklist jsonb, tempo jsonb, voz_archivo_id uuid, voz_inicio numeric,
               visto_el date, corregido_el date, analisis jsonb, dos_angulos jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_coach boolean := public.es_coach();
  v_atleta uuid := public.mi_atleta_id();
begin
  if auth.uid() is null or not (v_coach or v_atleta is not null) then
    raise exception 'Necesitas iniciar sesión' using errcode = '42501';
  end if;
  if p_archivos is null or cardinality(p_archivos) > 1000 then
    raise exception 'De 0 a 1000 vídeos de una vez' using errcode = '22023';
  end if;
  return query
    select r.archivo_id, r.atleta_id, r.puntuacion, r.checklist, r.tempo, r.voz_archivo_id, r.voz_inicio::numeric, r.visto_el,
           (r.corregido_en at time zone 'Europe/Madrid')::date, r.analisis, r.dos_angulos
    from public.video_revisiones r
    where r.archivo_id = any(p_archivos) and (v_coach or r.atleta_id = v_atleta);
end $$;

-- ---------------------------------------------------------------------
-- 3. Borrar un vídeo de técnica: sus respuestas en vídeo y el desfase que lo nombra
-- ---------------------------------------------------------------------
create or replace function fbe_privado.al_borrar_video_respuestas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.tipo <> 'video_tecnica' then return old; end if;
  delete from public.archivos a where a.tipo = 'adjunto'
    and a.id in (select c.video_respuesta_id from public.comentarios c where c.archivo_id = old.id and c.video_respuesta_id is not null);
  update public.video_revisiones r set dos_angulos = null where r.dos_angulos ->> 'con' = old.id::text;
  return old;
end $$;
drop trigger if exists archivos_ac_respuestas on public.archivos;
create trigger archivos_ac_respuestas before delete on public.archivos
  for each row execute function fbe_privado.al_borrar_video_respuestas();

-- ---------------------------------------------------------------------
-- 4. Pasar un vídeo a otro atleta (035, 037): además, sus respuestas en vídeo y sus dos ángulos
-- ---------------------------------------------------------------------
-- Como en la 037; además (038): las respuestas en vídeo de su hilo se borran (las del atleta de antes son suyas; las del
-- coach se grabaron para esa conversación y su archivo va en la carpeta del de antes: su mensaje se queda, sin el vídeo),
-- su pareja de ángulos se quita (los dos lados) y, con ella, el desfase guardado.
create or replace function fbe_privado.al_mover_archivo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_perfil uuid;
  v_ids uuid[];
  r record;
begin
  if new.atleta_id is not distinct from old.atleta_id then return null; end if;
  update public.video_revisiones x set atleta_id = new.atleta_id, voz_archivo_id = null where x.archivo_id = new.id;
  update public.archivos x set repite_de = null where x.repite_de = new.id and x.atleta_id <> new.atleta_id;
  delete from public.notificaciones n where n.clave in ('video:' || old.id, 'archivo:' || old.id) and n.estado = 'pendiente';
  -- (038) Los dos ángulos
  update public.archivos x set angulo_de = null where x.angulo_de = new.id;
  update public.video_revisiones x set dos_angulos = null where x.archivo_id = new.id or x.dos_angulos ->> 'con' = new.id::text;
  -- El hilo
  select a.perfil_id into v_perfil from public.atletas a where a.id = old.atleta_id;
  select coalesce(array_agg(c.id), '{}'::uuid[]) into v_ids from public.comentarios c where c.archivo_id = new.id and not coalesce(c.adjunto, false);
  if cardinality(v_ids) > 0 then
    -- (038) sus respuestas en vídeo, fuera (y a la cola de Storage)
    delete from public.archivos a where a.tipo = 'adjunto'
      and a.id in (select c.video_respuesta_id from public.comentarios c where c.id = any(v_ids) and c.video_respuesta_id is not null);
    delete from public.notificaciones n where n.estado = 'pendiente' and n.clave in (select 'comentario:' || x::text from unnest(v_ids) x);
    delete from public.comentarios c where c.id = any(v_ids) and c.autor <> 'coach';
    if v_perfil is not null then
      delete from public.comentario_reacciones x where x.comentario_id = any(v_ids) and x.usuario_id = v_perfil;
      delete from public.comentario_destacados x where x.comentario_id = any(v_ids) and x.usuario_id = v_perfil;
    end if;
    delete from public.conversacion_fijado x where x.comentario_id = any(v_ids);
    update public.comentarios c set atleta_id = new.atleta_id, leido_en = null, entregado_en = null, escuchado_en = null
      where c.id = any(v_ids) and c.autor = 'coach';
  end if;
  -- La valoración del atleta de antes
  delete from public.video_autoevaluacion x where x.archivo_id = new.id;
  -- Los recordatorios que enlazan este vídeo
  for r in select x.id, x.ejercicio_id, x.activo from public.recordatorios_tecnica x where x.archivo_id = new.id and x.atleta_id = old.atleta_id
           order by x.activo desc, x.actualizado_en desc, x.id loop
    update public.recordatorios_tecnica x set atleta_id = new.atleta_id,
      activo = r.activo and (select count(*) from public.recordatorios_tecnica y where y.atleta_id = new.atleta_id and y.ejercicio_id = r.ejercicio_id and y.activo) < 3
    where x.id = r.id;
  end loop;
  return null;
end $$;
drop trigger if exists archivos_zz_mover on public.archivos;
create trigger archivos_zz_mover after update of atleta_id on public.archivos
  for each row execute function fbe_privado.al_mover_archivo();

-- ---------------------------------------------------------------------
-- 5. Permisos (como al final de 003 a 037)
-- ---------------------------------------------------------------------
-- Las tablas no cambian de dueño ni de políticas; la corrección, como en la 035-037: sin nada para anon
revoke all on public.video_revisiones from public, anon, authenticated;
grant select, insert, update, delete on public.video_revisiones to authenticated;

revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (38)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
