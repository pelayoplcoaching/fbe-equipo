-- =====================================================================
-- FBE Equipo, migración 014 (v0.18): mensajes y diario de entrenamiento
-- 1. Adjuntos en el chat: un archivo de tipo «adjunto» (foto o vídeo enviado en un mensaje) que no cuenta como
--    vídeo de técnica (no entra en la bandeja de vídeos ni avisa como tal; avisa el propio mensaje).
-- 2. Diario: miniatura (poster) de cada vídeo generada por el móvil al subirlo, duración, «destacado», y el
--    atleta puede editar lo suyo (pie, ejercicio, destacado) pero no lo del coach (revisado, comentario).
-- 3. Mensajes al momento: la tabla de comentarios entra en la publicación de Realtime de Supabase (si existe);
--    los permisos de fila siguen mandando también ahí.
-- 4. Notificación del coach: «te ha escrito» cuando es un mensaje suelto; «te ha respondido» cuando va en una
--    sesión, un check-in o un vídeo. Las dos llevan a Mensajes.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 013 (o con instalar.sql en una
-- base nueva). Se puede repetir sin romper nada.
-- =====================================================================

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
  if v > 14 then
    raise exception 'Esta base ya tiene la migración %: repetir la 014 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 14;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 13) then
    raise exception 'Antes de la 014 hace falta la 013: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1 y 2. Archivos: adjuntos, miniatura, duración y destacado
-- ---------------------------------------------------------------------
alter table public.archivos
  add column if not exists poster_ruta  text,                           -- miniatura del vídeo (<atleta_id>/...jpg)
  add column if not exists duracion_seg int check (duracion_seg between 0 and 3600),
  add column if not exists destacado    boolean not null default false;

-- («not valid»: las filas que ya existen no se vuelven a mirar; las nuevas sí)
alter table public.archivos drop constraint if exists archivos_tipo_check;
alter table public.archivos add constraint archivos_tipo_check
  check (tipo in ('video_tecnica', 'foto_progreso', 'adjunto')) not valid;
-- La miniatura, con las mismas reglas de ruta que el archivo (su carpeta, sin «..», un nombre normal) y única
alter table public.archivos drop constraint if exists archivos_poster_en_su_carpeta;
alter table public.archivos add constraint archivos_poster_en_su_carpeta
  check (poster_ruta is null or (poster_ruta ~ ('^' || atleta_id::text || '/[A-Za-z0-9_-][A-Za-z0-9._-]{0,150}$')
                                 and position('..' in poster_ruta) = 0 and poster_ruta <> ruta)) not valid;
create unique index if not exists archivos_poster_ruta_unica on public.archivos (poster_ruta);

-- La miniatura se sube a Storage igual que el vídeo: tiene que estar registrada en la fila del archivo
create or replace function public.archivo_registrado(p_ruta text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.archivos where (ruta = p_ruta or poster_ruta = p_ruta) and atleta_id = public.mi_atleta_id());
$$;

-- El atleta puede cambiar lo suyo de un archivo (pie, ejercicio, destacado) y quitar la miniatura si no llegó a
-- subirse; lo demás, no
drop policy if exists atleta_editar on public.archivos;
create policy atleta_editar on public.archivos for update to authenticated
  using (atleta_id = public.mi_atleta_id()) with check (atleta_id = public.mi_atleta_id());

create or replace function public.archivo_proteger_cambios() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    if (new.id, new.atleta_id, new.tipo, new.ruta, new.sesion_ejercicio_id, new.fecha, new.comentario_coach,
        new.creado_en, new.mime, new.bytes, new.revisado_en, new.duracion_seg, new.pose)
       is distinct from
       (old.id, old.atleta_id, old.tipo, old.ruta, old.sesion_ejercicio_id, old.fecha, old.comentario_coach,
        old.creado_en, old.mime, old.bytes, old.revisado_en, old.duracion_seg, old.pose)
       or (new.poster_ruta is not null and new.poster_ruta is distinct from old.poster_ruta) then
      raise exception 'De un archivo solo puedes cambiar el pie, el ejercicio y si está destacado' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists archivos_proteger_cambios on public.archivos;
create trigger archivos_proteger_cambios before update on public.archivos
  for each row execute function public.archivo_proteger_cambios();

-- Un comentario que lleva un adjunto del chat se marca como tal (lo fija la base al crearlo): así las
-- notificaciones, la insignia de Mensajes y Hoy lo tratan como un mensaje, no como un comentario de un vídeo
alter table public.comentarios add column if not exists adjunto boolean not null default false;

-- comentario_preparar (002, 012): además, el adjunto. Lo demás, igual que en la 012.
create or replace function public.comentario_preparar() returns trigger
language plpgsql set search_path = public as $$
declare v_autor text;
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
    new.creado_en := now();
    return new;
  end if;
  if v_autor is not null then
    if (new.atleta_id, new.sesion_id, new.checkin_id, new.archivo_id, new.autor, new.texto, new.creado_en, new.dibujo, new.adjunto)
       is distinct from
       (old.atleta_id, old.sesion_id, old.checkin_id, old.archivo_id, old.autor, old.texto, old.creado_en, old.dibujo, old.adjunto) then
      raise exception 'Un comentario no se puede editar' using errcode = '42501';
    end if;
    if old.autor = v_autor and new.leido_en is distinct from old.leido_en then
      raise exception 'Solo quien recibe un comentario lo marca como leído' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- Si se borra un adjunto del chat, su mensaje se va con él (un vídeo de técnica deja sus comentarios, como antes)
create or replace function public.archivo_adjunto_borrar_mensaje() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.tipo = 'adjunto' then
    delete from public.comentarios where archivo_id = old.id;
  end if;
  return old;
end $$;
drop trigger if exists archivos_a_adjunto_mensaje on public.archivos;
create trigger archivos_a_adjunto_mensaje before delete on public.archivos
  for each row execute function public.archivo_adjunto_borrar_mensaje();

-- ---------------------------------------------------------------------
-- 3. Mensajes al momento (Realtime): solo si el proyecto tiene la publicación de Supabase
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comentarios') then
    alter publication supabase_realtime add table public.comentarios;
  end if;
exception when others then
  raise warning 'FBE: no se ha podido añadir comentarios a la publicación de Realtime: % (los mensajes llegarán al recargar o por notificación)', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- 4. Notificación del comentario: «te ha escrito» o «te ha respondido», y las dos llevan a Mensajes
-- ---------------------------------------------------------------------
-- La pestaña Mensajes es un destino nuevo de las notificaciones (lista de la 011; «not valid» como entonces)
alter table public.notificaciones drop constraint if exists notificaciones_validas;
alter table public.notificaciones add constraint notificaciones_validas check (
  tipo in ('respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario',
           'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido', 'prueba')
  and char_length(titulo) between 1 and 80
  and (cuerpo is null or char_length(cuerpo) <= 160)
  and url in ('#hoy', '#semana', '#checkin', '#progreso', '#perfil', '#atletas', '#revisar', '#cuenta', '#mensajes')
  and char_length(clave) between 1 and 100
  and estado in ('pendiente', 'enviando', 'enviada', 'caducada', 'fallida')
  and (canal is null or canal in ('push', 'email'))
  and intentos between 0 and 100
  and (error is null or char_length(error) <= 200)
) not valid;

create or replace function fbe_privado.al_comentar() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  a public.atletas;
  v_donde text;
  v_general boolean;
begin
  -- Un mensaje suelto o un adjunto del chat es «un mensaje»; lo demás va pegado a una sesión, un check-in o un vídeo
  v_general := (new.sesion_id is null and new.checkin_id is null and new.archivo_id is null) or coalesce(new.adjunto, false);
  select * into a from public.atletas where id = new.atleta_id;
  if a.id is null then return null; end if;
  v_donde := case
    when v_general then 'Mensaje nuevo'
    when new.sesion_id is not null then (select 'En ' || s.nombre from public.sesiones s where s.id = new.sesion_id)
    when new.checkin_id is not null then case when new.autor = 'coach' then 'En tu check-in' else 'En su check-in' end
    when new.archivo_id is not null then case when new.autor = 'coach' then 'En tu vídeo' else 'En su vídeo' end
    else 'Mensaje nuevo' end;
  if new.autor = 'coach' then
    if a.estado = 'activo' then
      perform fbe_privado.notificar(a.perfil_id, 'respuesta',
        coalesce(fbe_privado.nombre_corto((select p.nombre from public.perfiles p where p.id = auth.uid())), 'Tu coach')
          || case when v_general then ' te ha escrito' else ' te ha respondido' end,
        v_donde, case when v_general then '#mensajes' else '#hoy' end, 'comentario:' || new.id);
    end if;
  else
    -- Al coach, una por atleta cada 10 minutos (si escribe cinco mensajes seguidos, una sola)
    perform fbe_privado.notificar_seguro(p.id, 'mensaje',
      coalesce(fbe_privado.nombre_corto(a.nombre), 'Un atleta') || ' te ha escrito', v_donde,
      case when v_general then '#mensajes' else '#revisar' end,
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

-- Permisos (como al final de 003 a 013)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (14)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
