-- =====================================================================
-- FBE Equipo, migración 027 (v0.43): la comunidad del equipo (fase 1)
-- Una pestaña «Equipo», voluntaria, para que los atletas se animen entre ellos. Equipo cerrado: todos los que
-- entran se ven entre sí, y el coach.
--   · comunidad_ajustes: una sola fila, si está abierta o no. La lee cualquier cuenta; la cambia solo el coach.
--   · comunidad_miembros: quién ha entrado (con el texto que aceptó, comunidad_version(), y la hora de la base),
--     su nombre en el equipo (único, sin hacerse pasar por el coach, un cambio al día) y si sale en el ranking.
--     Salir no borra nada: lo suyo deja de verse (y vuelve si entra otra vez). Si cambia el texto de la entrada,
--     hay que volver a aceptarlo. El coach puede sacar a alguien (y no dejarle volver hasta que lo readmita).
--     Nunca son miembros los atletas de baja ni la ficha de atleta del coach.
--   · comunidad_posts (el muro: avisos del coach, publicaciones con una foto opcional y entrenos compartidos),
--     comunidad_comentarios, comunidad_reacciones (una por persona y publicación: fuerza, fuego o aplauso) y
--     comunidad_reportes («Avisar al coach», con una copia de lo avisado: sobrevive aunque su autor lo borre).
--   · comunidad_retos: los del coach (sesiones hechas entre dos fechas).
--   · Funciones que solo devuelven nombres, fotos de perfil y recuentos: comunidad_personas(),
--     comunidad_retos_progreso() y comunidad_ranking() (constancia de la semana, nunca kilos ni peso).
--   · comunidad_compartir_sesion(): la tarjeta de un entreno (y sus récords) la hace la base con lo registrado
--     en esa sesión (del atleta, terminada, una vez); de la app solo llegan el comentario y si enseña los kilos.
--   · comunidad_mis_datos(): todo lo suyo (también lo oculto y tras salir), para «Descargar mis datos».
--   · Fotos en Storage, en un bucket propio y privado, «comunidad» (JPEG de 600 KB como mucho):
--     <atleta_id>/….jpg (o coach/….jpg). Las ven los miembros y el coach mientras la publicación exista, no esté
--     oculta y su autor siga dentro. No se pueden cambiar ni borrar mientras la publicación (o un aviso abierto
--     al coach) las use.
--   · Límites diarios (publicaciones, comentarios, avisos) contados en un registro que no se borra con lo publicado.
--   · Notificaciones de tipo «comunidad» (a #equipo): reacciones y comentarios en lo tuyo (una por publicación y
--     hora) y los avisos del coach a todos. El coach recibe los «Avisar al coach» (a #revisar). Las pendientes
--     de quien deja de estar dentro (sale, le sacan, baja, comunidad cerrada) se retiran.
-- Nada de esto lee peso, medidas, nutrición, check-ins, molestias, vídeos ni mensajes con el coach.
-- Se ejecuta en el SQL Editor después de la 026 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 27 then
    raise exception 'Esta base ya tiene la migración %: repetir la 027 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 27;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 26) then
    raise exception 'Antes de la 027 hace falta la 026: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------
create table if not exists public.comunidad_ajustes (
  id             boolean primary key default true check (id),   -- una sola fila
  activa         boolean not null default false,
  actualizado_en timestamptz not null default now()
);
insert into public.comunidad_ajustes (id) values (true) on conflict (id) do nothing;

create table if not exists public.comunidad_miembros (
  atleta_id           uuid primary key references public.atletas(id) on delete cascade,
  perfil_id           uuid not null references public.perfiles(id) on delete cascade,
  nombre              text not null,                     -- el que ven los demás («Ana L.»)
  version             text not null,                     -- el texto que aceptó al entrar (comunidad_version())
  aceptado_en         timestamptz not null default now(),
  salido_en           timestamptz,                       -- si ha salido (o le han sacado): lo suyo deja de verse
  sin_ranking         boolean not null default false,    -- «No salir en el ranking» (ni en los retos de los demás)
  bloqueado           boolean not null default false,    -- el coach le ha sacado y no puede volver a entrar
  nombre_cambiado_en  timestamptz,                       -- un cambio de nombre al día (entrar no cuenta)
  creado_en           timestamptz not null default now()
);
create unique index if not exists comunidad_miembros_perfil_idx on public.comunidad_miembros (perfil_id);
-- El nombre, único entre los que están dentro (sin distinguir mayúsculas)
create unique index if not exists comunidad_miembros_nombre_idx on public.comunidad_miembros (lower(nombre)) where salido_en is null;
alter table public.comunidad_miembros drop constraint if exists comunidad_miembros_validos;
alter table public.comunidad_miembros add constraint comunidad_miembros_validos check (
  char_length(nombre) between 2 and 40 and public.texto_visible(nombre) and nombre !~ '[[:cntrl:]]' and nombre = btrim(nombre)
  and char_length(version) between 1 and 40
  and (not bloqueado or salido_en is not null)
);

create table if not exists public.comunidad_posts (
  id          uuid primary key default gen_random_uuid(),
  autor_id    uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  atleta_id   uuid references public.atletas(id) on delete cascade,     -- la ficha del autor (null: el coach)
  tipo        text not null default 'post',                              -- aviso (del coach) · post · entreno
  texto       text,
  foto_ruta   text unique,                                               -- en el bucket «comunidad»
  sesion_id   uuid unique references public.sesiones(id) on delete set null,  -- la del entreno (una vez cada una)
  resumen     jsonb,                                                     -- la tarjeta del entreno (la hace la base)
  fijada      boolean not null default false,
  oculta      boolean not null default false,
  creado_en   timestamptz not null default now()
);
create index if not exists comunidad_posts_orden_idx on public.comunidad_posts (fijada desc, creado_en desc);
create index if not exists comunidad_posts_autor_idx on public.comunidad_posts (autor_id);
create index if not exists comunidad_posts_atleta_idx on public.comunidad_posts (atleta_id);
alter table public.comunidad_posts drop constraint if exists comunidad_posts_validos;
alter table public.comunidad_posts add constraint comunidad_posts_validos check (
  tipo in ('aviso', 'post', 'entreno')
  and (texto is null or (char_length(texto) between 1 and 2000 and public.texto_visible(texto)))
  and (tipo <> 'aviso' or texto is not null)
  and (tipo <> 'post' or texto is not null or foto_ruta is not null)
  and (tipo = 'entreno') = (resumen is not null)
  and (tipo = 'entreno' or sesion_id is null)
  and (tipo <> 'entreno' or foto_ruta is null)
  and (not fijada or tipo = 'aviso')
  and (foto_ruta is null or foto_ruta ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|coach)/[A-Za-z0-9]{8,40}\.jpg$')
  and (resumen is null or (jsonb_typeof(resumen) = 'object' and pg_column_size(resumen) <= 16000))
);

create table if not exists public.comunidad_comentarios (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.comunidad_posts(id) on delete cascade,
  autor_id   uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  atleta_id  uuid references public.atletas(id) on delete cascade,
  texto      text not null,
  oculto     boolean not null default false,
  creado_en  timestamptz not null default now()
);
create index if not exists comunidad_comentarios_post_idx on public.comunidad_comentarios (post_id, creado_en);
create index if not exists comunidad_comentarios_autor_idx on public.comunidad_comentarios (autor_id);
create index if not exists comunidad_comentarios_atleta_idx on public.comunidad_comentarios (atleta_id);
alter table public.comunidad_comentarios drop constraint if exists comunidad_comentarios_validos;
alter table public.comunidad_comentarios add constraint comunidad_comentarios_validos check (
  char_length(texto) between 1 and 1000 and public.texto_visible(texto)
);

create table if not exists public.comunidad_reacciones (
  post_id    uuid not null references public.comunidad_posts(id) on delete cascade,
  autor_id   uuid not null references public.perfiles(id) on delete cascade,
  atleta_id  uuid references public.atletas(id) on delete cascade,
  tipo       text not null,
  creado_en  timestamptz not null default now(),
  primary key (post_id, autor_id)
);
create index if not exists comunidad_reacciones_autor_idx on public.comunidad_reacciones (autor_id);
create index if not exists comunidad_reacciones_atleta_idx on public.comunidad_reacciones (atleta_id);
alter table public.comunidad_reacciones drop constraint if exists comunidad_reacciones_validas;
alter table public.comunidad_reacciones add constraint comunidad_reacciones_validas check (tipo in ('fuerza', 'fuego', 'aplauso'));

-- Un aviso al coach guarda una copia de lo avisado: si su autor lo borra, el coach lo sigue viendo
create table if not exists public.comunidad_reportes (
  id                   uuid primary key default gen_random_uuid(),
  post_id              uuid references public.comunidad_posts(id) on delete set null,
  comentario_id        uuid references public.comunidad_comentarios(id) on delete set null,
  autor_id             uuid not null references public.perfiles(id) on delete cascade,   -- quien avisa
  motivo               text,
  creado_en            timestamptz not null default now(),
  resuelto_en          timestamptz,
  -- La copia (de cuando se avisó)
  de_comentario        boolean not null default false,
  copia_tipo           text,
  copia_texto          text,
  copia_foto           text,                                                  -- ruta en el bucket «comunidad»
  copia_autor_id       uuid references public.perfiles(id) on delete set null,
  copia_autor_nombre   text,
  copia_atleta_id      uuid references public.atletas(id) on delete set null,
  copia_creado_en      timestamptz
);
create index if not exists comunidad_reportes_abiertos_idx on public.comunidad_reportes (creado_en desc) where resuelto_en is null;
create index if not exists comunidad_reportes_autor_idx on public.comunidad_reportes (autor_id);
create index if not exists comunidad_reportes_comentario_idx on public.comunidad_reportes (comentario_id);
create index if not exists comunidad_reportes_post_idx on public.comunidad_reportes (post_id);
create index if not exists comunidad_reportes_foto_idx on public.comunidad_reportes (copia_foto) where resuelto_en is null;
create index if not exists comunidad_reportes_copia_autor_idx on public.comunidad_reportes (copia_autor_id);
create index if not exists comunidad_reportes_copia_atleta_idx on public.comunidad_reportes (copia_atleta_id);
alter table public.comunidad_reportes drop constraint if exists comunidad_reportes_validos;
alter table public.comunidad_reportes add constraint comunidad_reportes_validos check (
  (motivo is null or (char_length(motivo) between 1 and 300 and public.texto_visible(motivo)))
  and (copia_tipo is null or copia_tipo in ('aviso', 'post', 'entreno', 'comentario'))
  and (copia_texto is null or char_length(copia_texto) <= 2000)
  and (copia_autor_nombre is null or char_length(copia_autor_nombre) <= 80)
);

create table if not exists public.comunidad_retos (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  descripcion  text,
  desde        date not null,
  hasta        date not null,
  objetivo     smallint not null,   -- sesiones hechas entre desde y hasta (las dos incluidas)
  creado_en    timestamptz not null default now()
);
alter table public.comunidad_retos drop constraint if exists comunidad_retos_validos;
alter table public.comunidad_retos add constraint comunidad_retos_validos check (
  char_length(titulo) between 1 and 80 and public.texto_visible(titulo)
  and (descripcion is null or (char_length(descripcion) between 1 and 500 and public.texto_visible(descripcion)))
  and desde >= date '2020-01-01' and hasta < date '2100-01-01' and hasta >= desde and hasta - desde <= 366
  and objetivo between 1 and 100
);

-- Lo que cada uno ha publicado, comentado o avisado, para los límites diarios. No se borra al borrar lo
-- publicado (borrar y volver a publicar no da más cupo). Solo lo tocan las funciones de la base.
create table if not exists public.comunidad_cupos (
  id         bigint generated always as identity primary key,
  perfil_id  uuid not null references public.perfiles(id) on delete cascade,
  tipo       text not null check (tipo in ('post', 'comentario', 'reporte')),
  creado_en  timestamptz not null default now()
);
create index if not exists comunidad_cupos_idx on public.comunidad_cupos (perfil_id, tipo, creado_en);

-- ---------------------------------------------------------------------
-- 2. Quién está dentro (para los permisos). Security definer: leen sin pasar por los permisos de fila.
-- ---------------------------------------------------------------------
-- Cambia esta versión (y VERSION_COMUNIDAD en web/src/datos/api.js) cuando cambie el texto de la entrada.
create or replace function public.comunidad_version() returns text
language sql immutable set search_path = '' as $$ select 'comunidad-2026-11'::text $$;

create or replace function public.comunidad_activa() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select a.activa from public.comunidad_ajustes a where a.id), false)
$$;

-- Los que están dentro de verdad: sin haber salido, con el texto vigente aceptado, sin estar de baja, con la
-- ficha aún vinculada a su cuenta y sin ser el coach (su ficha del modo atleta nunca es miembro). Interno.
create or replace view fbe_privado.comunidad_dentro as
  select m.atleta_id, m.perfil_id, m.nombre, m.sin_ranking
  from public.comunidad_miembros m
  join public.atletas a on a.id = m.atleta_id and a.perfil_id = m.perfil_id
  join public.perfiles p on p.id = m.perfil_id
  where m.salido_en is null and not m.bloqueado and m.version = public.comunidad_version()
    and a.estado <> 'baja' and p.rol <> 'coach';
revoke all on fbe_privado.comunidad_dentro from public, anon, authenticated;

-- ¿La cuenta que llama está dentro? (y la comunidad, abierta)
create or replace function public.comunidad_soy_miembro() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.comunidad_activa()
    and exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = auth.uid())
$$;

-- ¿Se ve lo que ha escrito esta persona? El coach, siempre; un atleta, mientras siga dentro. Solo responde a
-- quien puede ver la comunidad (a cualquier otro, false: no sirve para averiguar quién está dentro).
create or replace function public.comunidad_autor_visible(p_perfil uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (public.es_coach() or public.comunidad_soy_miembro()) and (
    exists (select 1 from public.perfiles p where p.id = p_perfil and p.rol = 'coach')
    or exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = p_perfil))
$$;

create or replace function public.comunidad_post_visible(p_post uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.comunidad_posts x where x.id = p_post
                 and (public.es_coach() or (not x.oculta and public.comunidad_soy_miembro() and public.comunidad_autor_visible(x.autor_id))))
$$;

-- Fotos (bucket «comunidad»): las de una publicación que quien llama puede ver; para subirla, que la
-- publicación sea suya, de hace menos de 15 minutos y esté a la vista; para borrarla, que sea de su carpeta y
-- que ya no la use ninguna publicación ni ningún aviso abierto al coach.
create or replace function public.comunidad_foto_visible(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_ruta is not null and exists (select 1 from public.comunidad_posts x where x.foto_ruta = p_ruta and public.comunidad_post_visible(x.id))
$$;
create or replace function public.comunidad_foto_registrada(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_ruta is not null and auth.uid() is not null and exists (
    select 1 from public.comunidad_posts x where x.foto_ruta = p_ruta and x.autor_id = auth.uid() and not x.oculta
      and x.creado_en > now() - interval '15 minutes'
      and (public.es_coach() or public.comunidad_soy_miembro()))
$$;
create or replace function public.comunidad_foto_borrable(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_ruta is not null and public.mi_atleta_id() is not null
    and split_part(p_ruta, '/', 1) = public.mi_atleta_id()::text
    and not exists (select 1 from public.comunidad_posts x where x.foto_ruta = p_ruta)
    and not exists (select 1 from public.comunidad_reportes r where r.copia_foto = p_ruta and r.resuelto_en is null)
$$;

-- Un nombre que se puede usar en el equipo (null) o por qué no. Interno.
create or replace function fbe_privado.comunidad_problema_nombre(p_nombre text, p_atleta uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v text := btrim(regexp_replace(coalesce(p_nombre, ''), '[[:space:][:cntrl:]]+', ' ', 'g'));
  n text;
begin
  if char_length(v) not between 2 and 40 or not public.texto_visible(v) then return 'Tu nombre en el equipo, de 2 a 40 letras'; end if;
  n := translate(lower(v), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc');
  if n ~ '(^|[^a-z0-9])(coach|entrenador|entrenadora|fbe)([^a-z0-9]|$)' then
    return 'Ese nombre se confunde con el del coach: elige otro';
  end if;
  if exists (select 1 from public.perfiles p where p.rol = 'coach' and nullif(btrim(p.nombre), '') is not null
             and split_part(n, ' ', 1) = split_part(translate(lower(btrim(p.nombre)), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc'), ' ', 1)) then
    return 'Ese nombre se confunde con el del coach: elige otro';
  end if;
  if exists (select 1 from public.comunidad_miembros m where m.salido_en is null and m.atleta_id is distinct from p_atleta and lower(m.nombre) = lower(v)) then
    return 'Ya hay alguien en el equipo con ese nombre: elige otro';
  end if;
  return null;
end $$;

-- Cupo diario (cuenta en comunidad_cupos, que no se borra con lo publicado). El coach no tiene. Interno.
create or replace function fbe_privado.comunidad_gastar_cupo(p_tipo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_max integer := case p_tipo when 'post' then 20 when 'comentario' then 100 else 20 end;
begin
  if auth.uid() is null or public.es_coach() then return; end if;
  delete from public.comunidad_cupos c where c.perfil_id = auth.uid() and c.creado_en < now() - interval '2 days';
  if (select count(*) from public.comunidad_cupos c where c.perfil_id = auth.uid() and c.tipo = p_tipo and c.creado_en > now() - interval '1 day') >= v_max then
    raise exception '%', case p_tipo when 'post' then 'Has publicado 20 veces en las últimas 24 horas: espera un poco'
                                     when 'comentario' then 'Has escrito 100 comentarios en las últimas 24 horas: espera un poco'
                                     else 'Has avisado 20 veces en las últimas 24 horas: escribe a tu coach' end using errcode = '54000';
  end if;
  insert into public.comunidad_cupos (perfil_id, tipo) values (auth.uid(), p_tipo);
end $$;

-- ---------------------------------------------------------------------
-- 3. Lo que pone la base (autor, ficha, fecha) y lo que no se puede cambiar
-- ---------------------------------------------------------------------
create or replace function public.comunidad_ajustes_tocar() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.id := true;
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists comunidad_ajustes_tocar on public.comunidad_ajustes;
create trigger comunidad_ajustes_tocar before insert or update on public.comunidad_ajustes
  for each row execute function public.comunidad_ajustes_tocar();

-- Publicar desde la app (las funciones de la base, como compartir un entreno, ya lo dejan bien). Cambiar algo
-- de una publicación solo se puede con las funciones del coach (fijar, ocultar): la app no tiene UPDATE.
create or replace function public.comunidad_post_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  new.autor_id := auth.uid();
  new.creado_en := now();
  new.oculta := false;
  new.sesion_id := null;
  new.resumen := null;
  if public.es_coach() then
    new.atleta_id := null;
    if new.tipo is distinct from 'aviso' then
      raise exception 'Como coach, en el muro publicas avisos' using errcode = '42501';
    end if;
    if new.foto_ruta is not null and new.foto_ruta not like 'coach/%' then
      raise exception 'La foto no va en su sitio' using errcode = '42501';
    end if;
  else
    new.atleta_id := public.mi_atleta_id();
    new.fijada := false;
    if new.tipo is distinct from 'post' then
      raise exception 'Los avisos son del coach, y los entrenos se comparten desde el resumen de la sesión' using errcode = '42501';
    end if;
    if new.foto_ruta is not null and (new.atleta_id is null or new.foto_ruta not like new.atleta_id::text || '/%') then
      raise exception 'La foto no va en su sitio' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists comunidad_posts_aa_preparar on public.comunidad_posts;
create trigger comunidad_posts_aa_preparar before insert on public.comunidad_posts
  for each row execute function public.comunidad_post_preparar();
drop trigger if exists comunidad_posts_exigir_alta on public.comunidad_posts;
create trigger comunidad_posts_exigir_alta before insert on public.comunidad_posts
  for each row execute function public.exigir_alta();

create or replace function public.comunidad_comentario_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  new.autor_id := auth.uid();
  new.creado_en := now();
  new.oculto := false;
  new.atleta_id := case when public.es_coach() then null else public.mi_atleta_id() end;
  return new;
end $$;
drop trigger if exists comunidad_comentarios_aa_preparar on public.comunidad_comentarios;
create trigger comunidad_comentarios_aa_preparar before insert on public.comunidad_comentarios
  for each row execute function public.comunidad_comentario_preparar();
drop trigger if exists comunidad_comentarios_exigir_alta on public.comunidad_comentarios;
create trigger comunidad_comentarios_exigir_alta before insert on public.comunidad_comentarios
  for each row execute function public.exigir_alta();

-- El cupo diario, al publicar (también un entreno compartido) y al comentar, desde la app
create or replace function fbe_privado.comunidad_cupo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(nullif(current_setting('role', true), ''), 'none') in ('authenticated', 'anon') then
    perform fbe_privado.comunidad_gastar_cupo(tg_argv[0]);
  end if;
  return new;
end $$;
drop trigger if exists comunidad_posts_ab_cupo on public.comunidad_posts;
create trigger comunidad_posts_ab_cupo before insert on public.comunidad_posts
  for each row execute function fbe_privado.comunidad_cupo('post');
drop trigger if exists comunidad_comentarios_ab_cupo on public.comunidad_comentarios;
create trigger comunidad_comentarios_ab_cupo before insert on public.comunidad_comentarios
  for each row execute function fbe_privado.comunidad_cupo('comentario');

create or replace function public.comunidad_reto_tocar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.creado_en := now(); else new.creado_en := old.creado_en; end if;
  return new;
end $$;
drop trigger if exists comunidad_retos_tocar on public.comunidad_retos;
create trigger comunidad_retos_tocar before insert or update on public.comunidad_retos
  for each row execute function public.comunidad_reto_tocar();

create or replace function public.comunidad_reporte_tocar() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Desde la app (el coach) solo se da por resuelto (o se vuelve a abrir), con la hora de la base. Que lo
  -- avisado se borre (post_id o comentario_id a null) lo hace la base.
  if current_user in ('authenticated', 'anon') and
     (new.id, new.post_id, new.comentario_id, new.autor_id, new.motivo, new.creado_en, new.de_comentario, new.copia_tipo, new.copia_texto,
      new.copia_foto, new.copia_autor_id, new.copia_autor_nombre, new.copia_atleta_id, new.copia_creado_en)
     is distinct from (old.id, old.post_id, old.comentario_id, old.autor_id, old.motivo, old.creado_en, old.de_comentario, old.copia_tipo, old.copia_texto,
      old.copia_foto, old.copia_autor_id, old.copia_autor_nombre, old.copia_atleta_id, old.copia_creado_en) then
    raise exception 'De un aviso solo se cambia si está resuelto' using errcode = '42501';
  end if;
  if new.resuelto_en is not null and old.resuelto_en is null then new.resuelto_en := now(); end if;
  if new.resuelto_en is not null and old.resuelto_en is not null then new.resuelto_en := old.resuelto_en; end if;
  return new;
end $$;
drop trigger if exists comunidad_reportes_tocar on public.comunidad_reportes;
create trigger comunidad_reportes_tocar before update on public.comunidad_reportes
  for each row execute function public.comunidad_reporte_tocar();

-- ---------------------------------------------------------------------
-- 4. Quién ve y escribe qué (lo de los demás, solo dentro; el coach, todo)
-- ---------------------------------------------------------------------
alter table public.comunidad_ajustes enable row level security;
alter table public.comunidad_miembros enable row level security;
alter table public.comunidad_posts enable row level security;
alter table public.comunidad_comentarios enable row level security;
alter table public.comunidad_reacciones enable row level security;
alter table public.comunidad_reportes enable row level security;
alter table public.comunidad_retos enable row level security;
alter table public.comunidad_cupos enable row level security;

-- Si está abierta lo puede saber cualquier cuenta (para enseñar o no la pestaña); cambiarlo, solo el coach
drop policy if exists todos_ver on public.comunidad_ajustes;
create policy todos_ver on public.comunidad_ajustes for select to authenticated using (auth.uid() is not null);
drop policy if exists coach_cambiar on public.comunidad_ajustes;
create policy coach_cambiar on public.comunidad_ajustes for update to authenticated
  using (public.es_coach()) with check (public.es_coach());

-- La fila de cada uno: la suya (y el coach, todas). Los nombres de los demás, con comunidad_personas().
-- Entrar, salir, cambiar el nombre y sacar a alguien, con sus funciones (no se escribe directamente).
drop policy if exists coach_ver on public.comunidad_miembros;
create policy coach_ver on public.comunidad_miembros for select to authenticated using (public.es_coach());
drop policy if exists atleta_ver on public.comunidad_miembros;
create policy atleta_ver on public.comunidad_miembros for select to authenticated using (perfil_id = auth.uid());

-- Publicaciones: se ven dentro; cada uno publica lo suyo y lo borra; fijar y ocultar, con comunidad_moderar()
drop policy if exists coach_todo on public.comunidad_posts;
create policy coach_todo on public.comunidad_posts for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists miembro_ver on public.comunidad_posts;
create policy miembro_ver on public.comunidad_posts for select to authenticated
  using (not oculta and public.comunidad_soy_miembro() and public.comunidad_autor_visible(autor_id));
drop policy if exists miembro_publicar on public.comunidad_posts;
create policy miembro_publicar on public.comunidad_posts for insert to authenticated
  with check (autor_id = auth.uid() and tipo = 'post' and not fijada and not oculta and sesion_id is null and resumen is null
              and atleta_id = public.mi_atleta_id() and public.comunidad_soy_miembro());
drop policy if exists autor_borrar on public.comunidad_posts;
create policy autor_borrar on public.comunidad_posts for delete to authenticated using (autor_id = auth.uid());

drop policy if exists coach_todo on public.comunidad_comentarios;
create policy coach_todo on public.comunidad_comentarios for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists miembro_ver on public.comunidad_comentarios;
create policy miembro_ver on public.comunidad_comentarios for select to authenticated
  using (not oculto and public.comunidad_soy_miembro() and public.comunidad_autor_visible(autor_id) and public.comunidad_post_visible(post_id));
drop policy if exists miembro_comentar on public.comunidad_comentarios;
create policy miembro_comentar on public.comunidad_comentarios for insert to authenticated
  with check (autor_id = auth.uid() and not oculto and atleta_id = public.mi_atleta_id()
              and public.comunidad_soy_miembro() and public.comunidad_post_visible(post_id));
drop policy if exists autor_borrar on public.comunidad_comentarios;
create policy autor_borrar on public.comunidad_comentarios for delete to authenticated using (autor_id = auth.uid());

-- Reacciones: se ven dentro; se ponen y se quitan con comunidad_reaccionar()
drop policy if exists coach_ver on public.comunidad_reacciones;
create policy coach_ver on public.comunidad_reacciones for select to authenticated using (public.es_coach());
drop policy if exists miembro_ver on public.comunidad_reacciones;
create policy miembro_ver on public.comunidad_reacciones for select to authenticated
  using (public.comunidad_soy_miembro() and public.comunidad_autor_visible(autor_id) and public.comunidad_post_visible(post_id));

-- Los avisos al coach, solo el coach (se mandan con comunidad_avisar_coach())
drop policy if exists coach_todo on public.comunidad_reportes;
create policy coach_todo on public.comunidad_reportes for all to authenticated
  using (public.es_coach()) with check (public.es_coach());

drop policy if exists coach_todo on public.comunidad_retos;
create policy coach_todo on public.comunidad_retos for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists miembro_ver on public.comunidad_retos;
create policy miembro_ver on public.comunidad_retos for select to authenticated using (public.comunidad_soy_miembro());

-- (comunidad_cupos: sin políticas ni permisos; solo la tocan las funciones de la base)

-- Desde la 019, cada tabla nueva lleva sus permisos a mano. Sin UPDATE en publicaciones ni comentarios: lo
-- único que cambia en ellos (fijar, ocultar) va por las funciones del coach.
revoke all on public.comunidad_ajustes, public.comunidad_miembros, public.comunidad_posts, public.comunidad_comentarios,
  public.comunidad_reacciones, public.comunidad_reportes, public.comunidad_retos, public.comunidad_cupos from public, anon, authenticated;
grant select, update on public.comunidad_ajustes to authenticated;
grant select on public.comunidad_miembros, public.comunidad_reacciones to authenticated;
grant select, insert, delete on public.comunidad_posts, public.comunidad_comentarios to authenticated;
grant select, insert, update, delete on public.comunidad_retos to authenticated;
grant select, update on public.comunidad_reportes to authenticated;

-- Storage: un bucket propio y privado para las fotos del muro, solo JPEG de 600 KB como mucho (la app las
-- reduce a 500 KB). Se ven si se ve su publicación (el atleta, además, las de su carpeta; el coach, todas); se
-- suben si la publicación ya está registrada; se borran solo si ya nadie las usa (el coach, siempre). Sin
-- UPDATE: una foto no se cambia por otra.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comunidad', 'comunidad', false, 614400, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists fbe_comunidad_ver on storage.objects;
create policy fbe_comunidad_ver on storage.objects for select to authenticated
  using (bucket_id = 'comunidad' and (public.es_coach() or split_part(name, '/', 1) = public.mi_atleta_id()::text or public.comunidad_foto_visible(name)));
drop policy if exists fbe_comunidad_subir on storage.objects;
create policy fbe_comunidad_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'comunidad' and public.comunidad_foto_registrada(name));
drop policy if exists fbe_comunidad_borrar on storage.objects;
create policy fbe_comunidad_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'comunidad' and (public.es_coach() or public.comunidad_foto_borrable(name)));

-- ---------------------------------------------------------------------
-- 5. Lo que usa la app
-- ---------------------------------------------------------------------
-- Entrar (o volver, o aceptar el texto nuevo): con el texto vigente, el nombre que elige y la hora de la base
create or replace function public.comunidad_unirme(p_nombre text, p_version text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  a public.atletas;
  v_nombre text := btrim(regexp_replace(coalesce(p_nombre, ''), '[[:space:][:cntrl:]]+', ' ', 'g'));
  v_problema text;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión' using errcode = '42501'; end if;
  if exists (select 1 from public.perfiles p where p.id = v_uid and p.rol = 'coach') then
    raise exception 'El coach está en la comunidad como coach, no como miembro' using errcode = '42501';
  end if;
  select * into a from public.atletas x where x.perfil_id = v_uid;
  if not found then raise exception 'Solo los atletas del equipo pueden entrar' using errcode = '42501'; end if;
  if a.estado = 'baja' then
    raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada' using errcode = '42501';
  end if;
  if not public.comunidad_activa() then raise exception 'La comunidad no está abierta' using errcode = '42501'; end if;
  if exists (select 1 from public.comunidad_miembros m where m.atleta_id = a.id and m.bloqueado) then
    raise exception 'Tu coach te ha sacado de la comunidad: habla con él si quieres volver' using errcode = '42501';
  end if;
  if p_version is distinct from public.comunidad_version() then
    raise exception 'El texto que aceptas no es el vigente: recarga la app y vuelve a intentarlo' using errcode = '22023';
  end if;
  v_problema := fbe_privado.comunidad_problema_nombre(v_nombre, a.id);
  if v_problema is not null then raise exception '%', v_problema using errcode = '22023'; end if;
  insert into public.comunidad_miembros as m (atleta_id, perfil_id, nombre, version, aceptado_en, salido_en, nombre_cambiado_en)
  values (a.id, v_uid, v_nombre, p_version, now(), null, null)
  on conflict (atleta_id) do update
    set perfil_id = excluded.perfil_id, nombre = excluded.nombre, version = excluded.version,
        aceptado_en = now(), salido_en = null, nombre_cambiado_en = null;
end $$;

-- Salir: lo suyo deja de verse (y vuelve si entra otra vez). Con p_borrar, además se borra lo que ha publicado,
-- comentado y reaccionado; devuelve las fotos que ya se pueden quitar de Storage (las de un aviso abierto al
-- coach se quedan hasta que lo resuelva).
create or replace function public.comunidad_salir(p_borrar boolean default false) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_fotos text[] := '{}';
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión' using errcode = '42501'; end if;
  update public.comunidad_miembros set salido_en = now() where perfil_id = v_uid and salido_en is null;
  if coalesce(p_borrar, false) and not exists (select 1 from public.perfiles p where p.id = v_uid and p.rol = 'coach') then
    select coalesce(array_agg(x.foto_ruta) filter (where x.foto_ruta is not null), '{}') into v_fotos
    from public.comunidad_posts x where x.autor_id = v_uid
      and not exists (select 1 from public.comunidad_reportes r where r.copia_foto = x.foto_ruta and r.resuelto_en is null);
    delete from public.comunidad_reacciones where autor_id = v_uid;
    delete from public.comunidad_comentarios where autor_id = v_uid;
    delete from public.comunidad_posts where autor_id = v_uid;
  end if;
  return v_fotos;
end $$;

-- Ajustes de la comunidad: el nombre (un cambio al día) y «No salir en el ranking»
create or replace function public.comunidad_ajustar(p_nombre text default null, p_sin_ranking boolean default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.comunidad_miembros;
  v_nombre text := btrim(regexp_replace(coalesce(p_nombre, ''), '[[:space:][:cntrl:]]+', ' ', 'g'));
  v_problema text;
begin
  if not public.comunidad_soy_miembro() then raise exception 'No estás en la comunidad' using errcode = '42501'; end if;
  select * into m from public.comunidad_miembros x where x.perfil_id = auth.uid();
  if p_nombre is not null and v_nombre is distinct from m.nombre then
    if m.nombre_cambiado_en > now() - interval '1 day' then
      raise exception 'Ya has cambiado tu nombre hoy: podrás volver a hacerlo mañana' using errcode = '22023';
    end if;
    v_problema := fbe_privado.comunidad_problema_nombre(v_nombre, m.atleta_id);
    if v_problema is not null then raise exception '%', v_problema using errcode = '22023'; end if;
    update public.comunidad_miembros set nombre = v_nombre, nombre_cambiado_en = now() where atleta_id = m.atleta_id;
  end if;
  if p_sin_ranking is not null then
    update public.comunidad_miembros set sin_ranking = p_sin_ranking where atleta_id = m.atleta_id;
  end if;
end $$;

-- El coach saca a alguien de la comunidad (p_bloquear = true: sale y no puede volver a entrar) o le vuelve a
-- admitir (p_bloquear = false: puede volver a entrar él, aceptando otra vez lo que se comparte)
create or replace function public.comunidad_expulsar(p_atleta uuid, p_bloquear boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Solo el coach puede sacar a alguien de la comunidad' using errcode = '42501'; end if;
  if coalesce(p_bloquear, true) then
    update public.comunidad_miembros set salido_en = coalesce(salido_en, now()), bloqueado = true where atleta_id = p_atleta;
  else
    update public.comunidad_miembros set bloqueado = false where atleta_id = p_atleta;
  end if;
  if not found then raise exception 'Ese atleta no ha entrado en la comunidad' using errcode = '22023'; end if;
end $$;

-- Quién se ve en la comunidad: el coach y los que están dentro. Solo nombre y foto de perfil.
create or replace function public.comunidad_personas()
returns table (perfil_id uuid, nombre text, foto text, coach boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce(nullif(btrim(p.nombre), ''), 'Coach'), p.foto, true
  from public.perfiles p
  where p.rol = 'coach' and (public.es_coach() or public.comunidad_soy_miembro())
  union all
  select d.perfil_id, d.nombre, p.foto, false
  from fbe_privado.comunidad_dentro d
  join public.perfiles p on p.id = d.perfil_id
  where public.es_coach() or public.comunidad_soy_miembro()
$$;

-- El coach fija o quita de arriba (sus avisos) y oculta o vuelve a mostrar publicaciones y comentarios
create or replace function public.comunidad_moderar(p_post uuid, p_fijada boolean default null, p_oculta boolean default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Fijar u ocultar es cosa del coach' using errcode = '42501'; end if;
  update public.comunidad_posts set fijada = coalesce(p_fijada, fijada), oculta = coalesce(p_oculta, oculta) where id = p_post;
  if not found then raise exception 'Esa publicación ya no está' using errcode = '22023'; end if;
end $$;
create or replace function public.comunidad_moderar_comentario(p_comentario uuid, p_oculto boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Ocultar es cosa del coach' using errcode = '42501'; end if;
  update public.comunidad_comentarios set oculto = coalesce(p_oculto, oculto) where id = p_comentario;
  if not found then raise exception 'Ese comentario ya no está' using errcode = '22023'; end if;
end $$;

-- Compartir un entreno: la tarjeta sale de lo registrado en esa sesión (suya, publicada y terminada; una vez).
-- De la app solo llegan el comentario y si enseña los kilos. Sin kilos: nombre, fecha, minutos, series,
-- ejercicios y en cuáles hubo récord. Con ellos, además la mejor serie de cada ejercicio (kg × reps) y el 1RM
-- estimado de los récords. Récord (lo decide la base): el mejor 1RM estimado de hoy en ese ejercicio supera al
-- mejor de antes de la sesión (en uno sin carga, más repeticiones que nunca).
create or replace function public.comunidad_compartir_sesion(p_sesion uuid, p_texto text default null, p_kilos boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_atleta uuid;
  s public.sesiones;
  v_kilos boolean := coalesce(p_kilos, false);
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
  v_inicio timestamptz;
  v_ejercicios jsonb;
  v_series integer;
  v_id uuid;
begin
  if v_uid is null or not public.comunidad_soy_miembro() then
    raise exception 'Para compartir en el equipo tienes que estar en la comunidad' using errcode = '42501';
  end if;
  v_atleta := public.mi_atleta_id();
  select x.* into s from public.sesiones x
  join public.semanas w on w.id = x.semana_id
  join public.bloques b on b.id = w.bloque_id
  where x.id = p_sesion and b.atleta_id = v_atleta and not b.es_plantilla and w.programacion = 'programada';
  if not found then raise exception 'Esa sesión no es tuya' using errcode = '42501'; end if;
  if not s.completada then raise exception 'Solo se comparte una sesión terminada' using errcode = '22023'; end if;
  if exists (select 1 from public.comunidad_posts x where x.sesion_id = p_sesion) then
    raise exception 'Esta sesión ya está compartida en el equipo' using errcode = '23505';
  end if;

  select min(r.registrada_en), count(*) filter (where coalesce(r.reps, 0) > 0) into v_inicio, v_series
  from public.series r join public.sesion_ejercicios se on se.id = r.sesion_ejercicio_id
  where se.sesion_id = p_sesion and r.atleta_id = v_atleta;

  with todas as (
    select coalesce(r.sustituto_id, se.ejercicio_id) as ejercicio_id, se.sesion_id, se.orden, r.kg, r.reps, r.registrada_en,
           case when r.kg > 0 and r.reps between 1 and 12 then
             round(r.kg * case when r.reps + coalesce(greatest(0, r.rir), greatest(0, 10 - r.rpe), 0) <= 1 then 1
                               else 1 + (r.reps + coalesce(greatest(0, r.rir), greatest(0, 10 - r.rpe), 0)) / 30.0 end, 1)
           end as e1rm
    from public.series r join public.sesion_ejercicios se on se.id = r.sesion_ejercicio_id
    where r.atleta_id = v_atleta and coalesce(r.reps, 0) > 0
  ), sr as (
    select * from todas t where t.sesion_id = p_sesion
  ), antes as (
    select t.ejercicio_id, max(t.e1rm) as e1rm, max(t.reps) filter (where coalesce(t.kg, 0) = 0) as reps_sin_carga
    from todas t where t.sesion_id <> p_sesion and t.registrada_en < coalesce(v_inicio, now())
    group by t.ejercicio_id
  ), mejor as (
    select distinct on (sr.ejercicio_id) sr.ejercicio_id, sr.kg, sr.reps, sr.e1rm,
           min(sr.orden) over (partition by sr.ejercicio_id) as orden,
           max(sr.reps) filter (where coalesce(sr.kg, 0) = 0) over (partition by sr.ejercicio_id) as reps_sin_carga,
           bool_or(coalesce(sr.kg, 0) > 0) over (partition by sr.ejercicio_id) as con_carga
    from sr
    order by sr.ejercicio_id, sr.e1rm desc nulls last, sr.kg desc nulls last, sr.reps desc
  ), lista as (
    select m.*, e.nombre,
           coalesce((m.e1rm is not null and a.e1rm is not null and m.e1rm > a.e1rm)
                    or (not m.con_carga and a.reps_sin_carga is not null and m.reps_sin_carga > a.reps_sin_carga), false) as record
    from mejor m join public.ejercicios e on e.id = m.ejercicio_id
    left join antes a on a.ejercicio_id = m.ejercicio_id
  )
  select coalesce(jsonb_agg(
           jsonb_strip_nulls(jsonb_build_object(
             'nombre', left(l.nombre, 80), 'record', l.record,
             'kg', case when v_kilos and l.kg > 0 then l.kg end,
             'reps', case when v_kilos then l.reps end,
             'e1rm', case when v_kilos and l.record then l.e1rm end))
           order by l.orden, l.nombre), '[]'::jsonb)
  into v_ejercicios
  from (select * from lista order by orden, nombre limit 30) l;

  insert into public.comunidad_posts (autor_id, atleta_id, tipo, texto, sesion_id, resumen)
  values (v_uid, v_atleta, 'entreno', v_texto, p_sesion, jsonb_strip_nulls(jsonb_build_object(
    'nombre', left(s.nombre, 80), 'tipo', s.tipo, 'fecha', coalesce(s.fecha_realizada, (now() at time zone 'Europe/Madrid')::date),
    'minutos', s.duracion_min, 'series', coalesce(v_series, 0), 'con_kilos', v_kilos, 'ejercicios', v_ejercicios)))
  returning id into v_id;
  return v_id;
end $$;

-- Reaccionar: una por persona y publicación. La misma otra vez la quita; otra distinta la cambia. Devuelve la
-- que queda (o null).
create or replace function public.comunidad_reaccionar(p_post uuid, p_tipo text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_antes text;
begin
  if v_uid is null or not (public.es_coach() or public.comunidad_soy_miembro()) then
    raise exception 'Para reaccionar tienes que estar en la comunidad' using errcode = '42501';
  end if;
  if not public.comunidad_post_visible(p_post) then raise exception 'Esa publicación ya no está' using errcode = '42501'; end if;
  if p_tipo is not null and p_tipo not in ('fuerza', 'fuego', 'aplauso') then
    raise exception 'Esa reacción no existe' using errcode = '22023';
  end if;
  select r.tipo into v_antes from public.comunidad_reacciones r where r.post_id = p_post and r.autor_id = v_uid;
  if p_tipo is null or v_antes = p_tipo then
    delete from public.comunidad_reacciones where post_id = p_post and autor_id = v_uid;
    return null;
  end if;
  insert into public.comunidad_reacciones (post_id, autor_id, atleta_id, tipo)
  values (p_post, v_uid, case when public.es_coach() then null else public.mi_atleta_id() end, p_tipo)
  on conflict (post_id, autor_id) do update set tipo = excluded.tipo, creado_en = now();
  return p_tipo;
end $$;

-- «Avisar al coach» de una publicación o de un comentario (que quien avisa puede ver), con un motivo opcional.
-- Guarda una copia de lo avisado (texto, foto, autor y fecha): si su autor lo borra, el coach lo sigue viendo.
-- Una vez por persona y cosa mientras siga abierto; como mucho 20 al día.
create or replace function public.comunidad_avisar_coach(p_post uuid default null, p_comentario uuid default null, p_motivo text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  x public.comunidad_posts;
  c public.comunidad_comentarios;
  v_id uuid;
begin
  if v_uid is null or not public.comunidad_soy_miembro() then
    raise exception 'Para avisar al coach tienes que estar en la comunidad' using errcode = '42501';
  end if;
  if p_comentario is not null then
    select * into c from public.comunidad_comentarios k
    where k.id = p_comentario and not k.oculto and public.comunidad_autor_visible(k.autor_id) and public.comunidad_post_visible(k.post_id);
    if not found then raise exception 'Ese comentario ya no está' using errcode = '42501'; end if;
    select * into x from public.comunidad_posts k where k.id = c.post_id;
  else
    select * into x from public.comunidad_posts k where k.id = p_post and public.comunidad_post_visible(k.id);
    if not found then raise exception 'Esa publicación ya no está' using errcode = '42501'; end if;
  end if;
  if v_motivo is not null and char_length(v_motivo) > 300 then raise exception 'El motivo, hasta 300 letras' using errcode = '22023'; end if;
  select r.id into v_id from public.comunidad_reportes r
  where r.autor_id = v_uid and r.post_id = x.id and r.comentario_id is not distinct from p_comentario and r.resuelto_en is null;
  if v_id is not null then return v_id; end if;
  perform fbe_privado.comunidad_gastar_cupo('reporte');
  insert into public.comunidad_reportes (post_id, comentario_id, autor_id, motivo, de_comentario, copia_tipo, copia_texto, copia_foto,
                                         copia_autor_id, copia_autor_nombre, copia_atleta_id, copia_creado_en)
  values (x.id, p_comentario, v_uid, v_motivo, p_comentario is not null,
          case when p_comentario is not null then 'comentario' else x.tipo end,
          left(case when p_comentario is not null then c.texto when x.tipo = 'entreno' then concat_ws(': ', 'Entreno compartido', x.resumen ->> 'nombre', x.texto) else x.texto end, 2000),
          case when p_comentario is null then x.foto_ruta end,
          case when p_comentario is not null then c.autor_id else x.autor_id end,
          left(fbe_privado.comunidad_nombre(case when p_comentario is not null then c.autor_id else x.autor_id end), 80),
          case when p_comentario is not null then c.atleta_id else x.atleta_id end,
          case when p_comentario is not null then c.creado_en else x.creado_en end)
  returning id into v_id;
  perform fbe_privado.notificar_seguro(p.id, 'comunidad', 'Aviso en la comunidad',
            case when p_comentario is null then 'Alguien te avisa de una publicación. Míralo en Revisar.' else 'Alguien te avisa de un comentario. Míralo en Revisar.' end,
            '#revisar', 'comunidad_reporte:' || v_id)
  from public.perfiles p where p.rol = 'coach';
  return v_id;
end $$;

-- Progreso de los retos: sesiones terminadas entre sus fechas, por miembro (solo recuentos). Quien no sale en
-- el ranking tampoco sale aquí para los demás, pero sí ve el suyo (yo = true).
create or replace function public.comunidad_retos_progreso()
returns table (reto_id uuid, perfil_id uuid, nombre text, hechas integer, objetivo integer, yo boolean)
language sql stable security definer set search_path = '' as $$
  select r.id, d.perfil_id, d.nombre,
    (select count(*)::integer from public.sesiones s
       join public.semanas w on w.id = s.semana_id
       join public.bloques b on b.id = w.bloque_id
     where b.atleta_id = d.atleta_id and not b.es_plantilla and s.completada
       and s.fecha_realizada between r.desde and r.hasta),
    r.objetivo::integer, d.perfil_id = auth.uid()
  from public.comunidad_retos r
  cross join fbe_privado.comunidad_dentro d
  where (public.es_coach() or public.comunidad_soy_miembro())
    and (not d.sin_ranking or d.perfil_id = auth.uid())
$$;

-- Ranking semanal de constancia: de las sesiones de esta semana (las de semanas publicadas), cuántas lleva
-- hechas cada uno. Solo recuentos. Sin quien no quiere salir (salvo él mismo, yo = true, para ver lo suyo).
create or replace function public.comunidad_ranking()
returns table (perfil_id uuid, nombre text, hechas integer, previstas integer, yo boolean)
language sql stable security definer set search_path = '' as $$
  with lunes as (
    select ((now() at time zone 'Europe/Madrid')::date - (extract(isodow from (now() at time zone 'Europe/Madrid'))::integer - 1)) as d
  ), dentro as (
    select d.atleta_id, d.perfil_id, d.nombre
    from fbe_privado.comunidad_dentro d
    where (public.es_coach() or public.comunidad_soy_miembro())
      and (not d.sin_ranking or d.perfil_id = auth.uid())
  ), semana as (
    -- Una semana por atleta: si dos bloques publican la misma, la del más reciente
    select distinct on (d.atleta_id) d.atleta_id, w.id as semana_id
    from dentro d
    join public.bloques b on b.atleta_id = d.atleta_id and not b.es_plantilla and b.estado <> 'cancelado'
    join public.semanas w on w.bloque_id = b.id and w.programacion = 'programada' and w.fecha_inicio = (select l.d from lunes l)
    order by d.atleta_id, b.fecha_inicio desc nulls last, b.numero desc nulls last
  )
  select d.perfil_id, d.nombre,
    (select count(*)::integer from public.sesiones s where s.semana_id = x.semana_id and s.completada),
    (select count(*)::integer from public.sesiones s where s.semana_id = x.semana_id),
    d.perfil_id = auth.uid()
  from dentro d join semana x on x.atleta_id = d.atleta_id
  where exists (select 1 from public.sesiones s where s.semana_id = x.semana_id)
$$;

-- Todo lo suyo en la comunidad, también lo oculto y aunque haya salido o esté de baja (derecho de acceso:
-- «Descargar mis datos»). De sus avisos al coach, solo lo que escribió él (no la copia de lo avisado).
create or replace function public.comunidad_mis_datos() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'miembro', (select to_jsonb(m) - 'perfil_id' from public.comunidad_miembros m where m.perfil_id = auth.uid()),
    'publicaciones', coalesce((select jsonb_agg(to_jsonb(x) order by x.creado_en) from public.comunidad_posts x where x.autor_id = auth.uid()), '[]'::jsonb),
    'comentarios', coalesce((select jsonb_agg(to_jsonb(c) order by c.creado_en) from public.comunidad_comentarios c where c.autor_id = auth.uid()), '[]'::jsonb),
    'reacciones', coalesce((select jsonb_agg(to_jsonb(r) order by r.creado_en) from public.comunidad_reacciones r where r.autor_id = auth.uid()), '[]'::jsonb),
    'avisos_al_coach', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'post_id', r.post_id, 'comentario_id', r.comentario_id, 'motivo', r.motivo,
                                   'creado_en', r.creado_en, 'resuelto_en', r.resuelto_en) order by r.creado_en)
                                 from public.comunidad_reportes r where r.autor_id = auth.uid()), '[]'::jsonb)
  ) end
$$;

-- ---------------------------------------------------------------------
-- 6. Notificaciones «comunidad». Sin el texto (se ven con el móvil bloqueado): solo quién y dónde.
-- ---------------------------------------------------------------------
alter table public.notificaciones drop constraint if exists notificaciones_validas;
alter table public.notificaciones add constraint notificaciones_validas check (
  tipo in ('respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario',
           'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido', 'prueba', 'descanso', 'comunidad')
  and char_length(titulo) between 1 and 80
  and (cuerpo is null or char_length(cuerpo) <= 160)
  and url in ('#hoy', '#semana', '#checkin', '#progreso', '#perfil', '#atletas', '#revisar', '#cuenta', '#mensajes', '#equipo')
  and char_length(clave) between 1 and 100
  and estado in ('pendiente', 'enviando', 'enviada', 'caducada', 'fallida')
  and (canal is null or canal in ('push', 'email'))
  and intentos between 0 and 100
  and (error is null or char_length(error) <= 200)
) not valid;

alter table public.preferencias_notificaciones drop constraint if exists preferencias_notificaciones_validas;
alter table public.preferencias_notificaciones add constraint preferencias_notificaciones_validas check (
  desactivados <@ array['respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario',
                        'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido', 'descanso', 'comunidad']::text[]
  and hora_manana between time '05:00' and time '12:00' and extract(second from hora_manana) = 0
  and hora_tarde between time '12:00' and time '23:30' and extract(second from hora_tarde) = 0
  and dia_checkin between 1 and 7
  and (silencio_desde is null) = (silencio_hasta is null)
  and (silencio_desde is null or (silencio_desde <> silencio_hasta
       and extract(second from silencio_desde) = 0 and extract(second from silencio_hasta) = 0))
);

-- El nombre con el que sale quien reacciona o comenta: el suyo en el equipo (o el del coach)
create or replace function fbe_privado.comunidad_nombre(p_perfil uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select m.nombre from public.comunidad_miembros m where m.perfil_id = p_perfil),
    (select fbe_privado.nombre_corto(p.nombre) from public.perfiles p where p.id = p_perfil and p.rol = 'coach'),
    'Alguien del equipo')
$$;

-- Al autor de la publicación, si no es él quien reacciona o comenta y sigue dentro. Una por publicación y hora
-- (lo demás de esa hora no vuelve a sonar).
create or replace function fbe_privado.comunidad_al_responder() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  v_autor uuid;
  v_quien text;
begin
  select x.autor_id into v_autor from public.comunidad_posts x where x.id = new.post_id and not x.oculta;
  if v_autor is null or v_autor = new.autor_id or not public.comunidad_activa() then return null; end if;
  if not exists (select 1 from public.perfiles p where p.id = v_autor and p.rol = 'coach')
     and not exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = v_autor) then
    return null;
  end if;
  v_quien := fbe_privado.comunidad_nombre(new.autor_id);
  perform fbe_privado.notificar_seguro(v_autor, 'comunidad',
    case when tg_table_name = 'comunidad_comentarios' then v_quien || ' ha comentado tu publicación'
         else v_quien || ' ha reaccionado a tu publicación' end,
    'Míralo en Equipo.', '#equipo',
    'comunidad:' || new.post_id || ':' || to_char(now() at time zone 'Europe/Madrid', 'YYYYMMDDHH24'));
  return null;
exception when others then
  raise warning 'FBE: notificación de la comunidad no creada: %', sqlerrm;
  return null;
end $$;
drop trigger if exists comunidad_comentarios_zz_notificar on public.comunidad_comentarios;
create trigger comunidad_comentarios_zz_notificar after insert on public.comunidad_comentarios
  for each row execute function fbe_privado.comunidad_al_responder();
drop trigger if exists comunidad_reacciones_zz_notificar on public.comunidad_reacciones;
create trigger comunidad_reacciones_zz_notificar after insert or update of tipo on public.comunidad_reacciones
  for each row execute function fbe_privado.comunidad_al_responder();

-- Aviso del coach en el muro → a todos los que están dentro
create or replace function fbe_privado.comunidad_al_avisar() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
begin
  if new.tipo <> 'aviso' or new.oculta or not public.comunidad_activa() then return null; end if;
  perform fbe_privado.notificar_seguro(d.perfil_id, 'comunidad',
            coalesce(fbe_privado.nombre_corto((select p.nombre from public.perfiles p where p.id = new.autor_id)), 'Tu coach') || ' ha publicado un aviso en el equipo',
            'Tócalo para leerlo en Equipo.', '#equipo', 'comunidad_aviso:' || new.id)
  from fbe_privado.comunidad_dentro d
  where d.perfil_id <> new.autor_id;
  return null;
exception when others then
  raise warning 'FBE: notificación del aviso % no creada: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists comunidad_posts_zz_notificar on public.comunidad_posts;
create trigger comunidad_posts_zz_notificar after insert on public.comunidad_posts
  for each row execute function fbe_privado.comunidad_al_avisar();

-- Una publicación borrada u oculta antes de que salgan sus notificaciones ya no avisa
create or replace function fbe_privado.comunidad_al_retirar() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
begin
  if tg_op = 'UPDATE' and not (new.oculta and not old.oculta) then return null; end if;
  delete from public.notificaciones n
  where n.estado = 'pendiente' and (n.clave like 'comunidad:' || old.id || ':%' or n.clave = 'comunidad_aviso:' || old.id);
  return null;
exception when others then
  raise warning 'FBE: notificaciones de la publicación % no retiradas: %', old.id, sqlerrm;
  return null;
end $$;
drop trigger if exists comunidad_posts_zz_retirar on public.comunidad_posts;
create trigger comunidad_posts_zz_retirar after delete or update of oculta on public.comunidad_posts
  for each row execute function fbe_privado.comunidad_al_retirar();

-- Quien deja de estar dentro (sale, le sacan, está de baja, deja de tener el texto vigente o se cierra la
-- comunidad) no recibe las notificaciones del equipo que tuviera pendientes (las de Revisar del coach, sí)
create or replace function fbe_privado.comunidad_retirar_pendientes(p_perfil uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.notificaciones n
  where n.tipo = 'comunidad' and n.url = '#equipo' and n.estado = 'pendiente' and (p_perfil is null or n.usuario_id = p_perfil);
$$;
create or replace function fbe_privado.comunidad_al_dejar() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
begin
  if tg_table_name = 'comunidad_miembros' then
    if (new.salido_en is not null and old.salido_en is null) or (new.bloqueado and not old.bloqueado) or new.version is distinct from public.comunidad_version() then
      perform fbe_privado.comunidad_retirar_pendientes(new.perfil_id);
    end if;
  elsif tg_table_name = 'atletas' then
    if old.perfil_id is not null and ((new.estado = 'baja' and old.estado <> 'baja') or new.perfil_id is distinct from old.perfil_id) then
      perform fbe_privado.comunidad_retirar_pendientes(old.perfil_id);
    end if;
  elsif tg_table_name = 'comunidad_ajustes' then
    if old.activa and not new.activa then perform fbe_privado.comunidad_retirar_pendientes(null); end if;
  end if;
  return null;
exception when others then
  raise warning 'FBE: notificaciones del equipo no retiradas: %', sqlerrm;
  return null;
end $$;
drop trigger if exists comunidad_miembros_zz_dejar on public.comunidad_miembros;
create trigger comunidad_miembros_zz_dejar after update on public.comunidad_miembros
  for each row execute function fbe_privado.comunidad_al_dejar();
drop trigger if exists atletas_zz_comunidad on public.atletas;
create trigger atletas_zz_comunidad after update of estado, perfil_id on public.atletas
  for each row execute function fbe_privado.comunidad_al_dejar();
drop trigger if exists comunidad_ajustes_zz_dejar on public.comunidad_ajustes;
create trigger comunidad_ajustes_zz_dejar after update of activa on public.comunidad_ajustes
  for each row execute function fbe_privado.comunidad_al_dejar();

-- Permisos (como al final de 003 a 026)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (27)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
