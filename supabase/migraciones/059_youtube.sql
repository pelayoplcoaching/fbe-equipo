-- =====================================================================
-- FBE Equipo, migración 059: YouTube dentro de la app
--
-- Por qué: los vídeos del coach (la técnica de cada ejercicio, sus vídeos de YouTube, sus directos) se ven ya dentro de
-- la app, con su reproductor. Esta migración añade lo poco que necesita guardarse en la base:
--
--   * recursos.destacado: el «vídeo de la semana», que sale en Hoy (uno como mucho, para todos).
--   * recursos.directo_en: un directo de YouTube con su día y hora (sale en Hoy desde el día antes hasta 3 h después).
--   * youtube_canal: el canal de YouTube del coach (una fila), para enseñar sus últimos vídeos en «Aprende».
--   * sesiones.video_url y video_titulo: «sigue este vídeo» en una sesión (un calentamiento, movilidad, un cardio).
--   * videos_vistos: qué vídeos de YouTube ha visto cada atleta dentro de la app (cuántas veces, cuánto y si hasta el
--     final), para que el coach sepa si ha visto lo que le mandó y qué vídeos funcionan. Solo lo apunta el propio
--     atleta, con apuntar_video_visto(); lo ven él y su coach; se borra con su ficha.
--
-- El tramo de un vídeo («del 0:42 al 0:58») no necesita nada: va dentro del propio enlace (t= y end=).
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 057 (o con instalar.sql en una base nueva);
-- con o sin la 058 (el reloj). Se puede repetir sin romper nada. (Si la 058 se quiere poner después: «delete from
-- public.fbe_migraciones where numero = 59;», la 058 y otra vez esta.)
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 59 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 059 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 59;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 57) then  -- (2) la anterior (la 058, el reloj, no hace falta)
    raise exception 'Falta la migración 057 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- Un enlace de YouTube (o de youtu.be) razonable: https, sin espacios, como mucho 300 caracteres
create or replace function public.es_enlace_youtube(u text) returns boolean
language sql immutable set search_path = public as $$
  select u is not null and char_length(u) <= 300 and u !~ '\s'
    and u ~* '^https://((www|m)\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)/'
$$;

-- ---------------------------------------------------------------------
-- 1. Recursos: el vídeo de la semana y los directos
-- ---------------------------------------------------------------------
alter table public.recursos add column if not exists destacado boolean not null default false;
alter table public.recursos add column if not exists directo_en timestamptz;
alter table public.recursos drop constraint if exists recursos_youtube_validos;
alter table public.recursos add constraint recursos_youtube_validos check (
  (not destacado or (atleta_id is null and public.es_enlace_youtube(url)))
  and (directo_en is null or (public.es_enlace_youtube(url) and directo_en between '2024-01-01' and '2100-01-01'))
);
-- Uno como mucho a la vez
create unique index if not exists recursos_un_destacado on public.recursos ((true)) where destacado;

-- ---------------------------------------------------------------------
-- 2. El canal de YouTube del coach (una fila)
-- ---------------------------------------------------------------------
create table if not exists public.youtube_canal (
  id             boolean primary key default true check (id),
  canal          text not null,                    -- el id del canal (UC…) o su @nombre
  titulo         text,                             -- cómo se llama (si el coach lo pone; la función usa el del canal)
  activo         boolean not null default true,    -- si sus vídeos salen en «Aprende»
  actualizado_en timestamptz not null default now()
);
alter table public.youtube_canal drop constraint if exists youtube_canal_valido;
alter table public.youtube_canal add constraint youtube_canal_valido check (
  (canal ~ '^UC[A-Za-z0-9_-]{22}$' or canal ~ '^@[A-Za-z0-9._-]{3,30}$')
  and (titulo is null or (char_length(titulo) between 1 and 100 and public.texto_visible(titulo)))
);

-- ---------------------------------------------------------------------
-- 3. «Sigue este vídeo» en una sesión
-- ---------------------------------------------------------------------
alter table public.sesiones add column if not exists video_url text;
alter table public.sesiones add column if not exists video_titulo text;
alter table public.sesiones drop constraint if exists sesiones_video_valido;
alter table public.sesiones add constraint sesiones_video_valido check (
  (video_url is null or public.es_enlace_youtube(video_url))
  and (video_titulo is null or (video_url is not null and char_length(video_titulo) between 1 and 80 and public.texto_visible(video_titulo)))
);
-- Solo el coach lo pone o lo quita (el atleta puede marcar su sesión, pero no cambiar su vídeo)
create or replace function public.sesion_video_proteger() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach()
     and (new.video_url, new.video_titulo) is distinct from (old.video_url, old.video_titulo) then
    raise exception 'Solo el coach puede cambiar el vídeo de la sesión' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists sesiones_video_proteger on public.sesiones;
create trigger sesiones_video_proteger before update of video_url, video_titulo on public.sesiones
  for each row execute function public.sesion_video_proteger();

-- ---------------------------------------------------------------------
-- 4. Lo que ve cada atleta
-- ---------------------------------------------------------------------
create table if not exists public.videos_vistos (
  atleta_id   uuid not null references public.atletas(id) on delete cascade,
  video       text not null,                      -- el id del vídeo de YouTube (11 caracteres)
  titulo      text,                               -- cómo se llamaba donde lo vio («Técnica: sentadilla»)
  veces       integer not null default 1,         -- cuántas veces (otra vez = pasada media hora desde la última)
  segundos    integer not null default 0,         -- lo visto en total
  completo    boolean not null default false,     -- si alguna vez lo vio hasta el final (o casi)
  primera_vez timestamptz not null default now(),
  ultima_vez  timestamptz not null default now(),
  primary key (atleta_id, video)
);
alter table public.videos_vistos drop constraint if exists videos_vistos_validos;
alter table public.videos_vistos add constraint videos_vistos_validos check (
  video ~ '^[A-Za-z0-9_-]{11}$'
  and (titulo is null or (char_length(titulo) between 1 and 120 and public.texto_visible(titulo)))
  and veces between 1 and 100000 and segundos between 0 and 100000000
);
create index if not exists videos_vistos_video_idx on public.videos_vistos (video);

-- El atleta apunta lo que ha visto (no escribe la tabla directamente: así no toca lo de otro; lo visto lo dice su app)
create or replace function public.apuntar_video_visto(p_video text, p_titulo text default null, p_segundos integer default 0, p_completo boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_atleta uuid := public.mi_atleta_id();
  v_titulo text := nullif(left(regexp_replace(coalesce(p_titulo, ''), '\s+', ' ', 'g'), 120), '');
  v_seg integer := least(greatest(coalesce(p_segundos, 0), 0), 21600);
begin
  if v_atleta is null then return; end if;  -- el coach (o una cuenta sin ficha): no se apunta nada
  -- (al integrarla) de baja, como en la 050, 051 y 054: puede ver y descargar lo suyo, pero no se apunta nada nuevo
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then return; end if;
  if p_video is null or p_video !~ '^[A-Za-z0-9_-]{11}$' then
    raise exception 'Ese no es un vídeo de YouTube' using errcode = '22023';
  end if;
  -- (al integrarla) como mucho 5000 vídeos distintos por atleta (lo ya apuntado se sigue sumando)
  if (select count(*) from public.videos_vistos where atleta_id = v_atleta) >= 5000
     and not exists (select 1 from public.videos_vistos where atleta_id = v_atleta and video = p_video) then return; end if;
  if v_titulo is not null and not public.texto_visible(v_titulo) then v_titulo := null; end if;
  insert into public.videos_vistos as x (atleta_id, video, titulo, segundos, completo)
    values (v_atleta, p_video, v_titulo, v_seg, coalesce(p_completo, false))
  on conflict (atleta_id, video) do update set
    titulo = coalesce(excluded.titulo, x.titulo),
    veces = least(x.veces + case when x.ultima_vez < now() - interval '30 minutes' then 1 else 0 end, 100000),
    segundos = least(x.segundos + excluded.segundos, 100000000),
    completo = x.completo or excluded.completo,
    ultima_vez = now();
end $$;

-- ---------------------------------------------------------------------
-- 5. Quién ve qué
-- ---------------------------------------------------------------------
alter table public.youtube_canal enable row level security;
alter table public.videos_vistos enable row level security;

drop policy if exists coach_todo on public.youtube_canal;
create policy coach_todo on public.youtube_canal for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.youtube_canal;
create policy atleta_ver on public.youtube_canal for select to authenticated
  using (activo and public.mi_atleta_id() is not null);

drop policy if exists coach_ver on public.videos_vistos;
create policy coach_ver on public.videos_vistos for select to authenticated using (public.es_coach());
drop policy if exists coach_borrar on public.videos_vistos;
create policy coach_borrar on public.videos_vistos for delete to authenticated using (public.es_coach());
drop policy if exists atleta_ver on public.videos_vistos;
create policy atleta_ver on public.videos_vistos for select to authenticated using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_borrar on public.videos_vistos;
create policy atleta_borrar on public.videos_vistos for delete to authenticated using (atleta_id = public.mi_atleta_id());

-- Desde la 019, cada tabla nueva lleva sus permisos a mano
revoke all on public.youtube_canal, public.videos_vistos from public, anon, authenticated;
grant select, insert, update, delete on public.youtube_canal to authenticated;
grant select, delete on public.videos_vistos to authenticated;

-- ---------------------------------------------------------------------
-- 6. Permisos (como al final de 003 a 058)
-- ---------------------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb), public.salud_recibir(text, jsonb), public.calendario_de(text) from public, anon, authenticated;
revoke execute on function public.sesion_video_proteger(), public.guia_tocar() from public, anon, authenticated;  -- (al integrarla: la de la 057 también)
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

insert into public.fbe_migraciones (numero) values (59)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
