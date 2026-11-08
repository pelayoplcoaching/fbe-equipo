-- =====================================================================
-- FBE Equipo, migración 050: personalización
--
-- Por qué: la app ya sabe mucho de cada atleta, pero le habla a todos igual. Con esto, cada atleta puede decir cómo
-- quiere que le llamemos, su porqué (una frase suya que la app le recuerda al volver tras unos días sin entrenar),
-- sus tres ejercicios, el enlace a su música y su cumpleaños (día y mes, sin el año); y el coach deja escritos unos
-- mensajes que salen solos en los momentos importantes (un récord, un bloque terminado, un hito de la racha, la
-- vuelta tras un parón y el cumpleaños). Y la música: su canción de récord, cuántas veces abre su música desde una
-- sesión (para «Tu mes» y «Tu año») y las listas que enlaza el coach (por tipo de sesión, de descarga, del equipo, al
-- ritmo de cada cardio, o para una sesión o un bloque concretos). Sin iniciar sesión con Spotify: solo enlaces.
--
-- Qué hace:
--   * personal_atleta: una fila por atleta. Todo opcional.
--   * personal_mio(): el atleta lee lo suyo. personal_guardar(datos): lo guarda (sustituye la fila; si está de baja,
--     no). Con las mismas comprobaciones que la app (logica/personal.js).
--   * personal_atletas(): solo el coach; lo de cada atleta (para su ficha y para avisarle de los cumpleaños).
--   * mensajes_coach: un texto por momento, con {nombre}, {ejercicio} y {semanas}. mensajes_coach(): los leen el
--     coach y sus atletas. mensaje_coach_guardar(momento, texto): solo el coach; con el texto vacío, lo quita.
--   * musica_coach: un enlace por clave (familia:empuje…, descarga, equipo, ritmo:carrera…, sesion:<id>, bloque:<id>).
--     musica_coach_lista() y musica_coach_guardar(clave, url): solo el coach. musica_para(sesion, bloque): lo general
--     y, de una sesión o un bloque, solo si son suyos (o el coach). personal_musica_abierta(): suma una al mes en curso.
-- Nadie lee ni escribe las tablas directamente. Al borrar la ficha de un atleta, lo suyo se va con ella.
-- Sin esta migración, la app no enseña nada de esto y todo lo demás sigue igual.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 049 (o con instalar.sql en una
-- base nueva). Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 50 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 050 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 50;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 49) then  -- (2) la migración previa
    raise exception 'Antes de la 050 hace falta la 049: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Lo de cada atleta
-- ---------------------------------------------------------------------
create table if not exists public.personal_atleta (
  atleta_id      uuid primary key references public.atletas(id) on delete cascade,
  apodo          text,
  porque         text,
  favoritos      uuid[] not null default '{}',
  musica_url     text,
  cancion_url    text,
  musica_aperturas jsonb not null default '{}'::jsonb,
  cumple_mes     smallint,
  cumple_dia     smallint,
  actualizado_en timestamptz not null default now()
);
alter table public.personal_atleta add column if not exists cancion_url text;
alter table public.personal_atleta add column if not exists musica_aperturas jsonb not null default '{}'::jsonb;
alter table public.personal_atleta drop constraint if exists personal_atleta_valido;
alter table public.personal_atleta add constraint personal_atleta_valido check (
  (apodo is null or char_length(apodo) between 1 and 30)
  and (porque is null or char_length(porque) between 1 and 140)
  and cardinality(favoritos) <= 3
  and (musica_url is null or (char_length(musica_url) <= 300 and musica_url ~* '^https://(open\.spotify\.com|spotify\.link|music\.apple\.com|music\.youtube\.com|(www\.|m\.)?youtube\.com|youtu\.be|music\.amazon\.(es|com)|(www\.)?deezer\.com|link\.deezer\.com|(www\.)?tidal\.com|listen\.tidal\.com)/[^[:space:]<>"'']*$'))
  and (cancion_url is null or (char_length(cancion_url) <= 300 and cancion_url ~* '^https://(open\.spotify\.com|spotify\.link|music\.apple\.com|music\.youtube\.com|(www\.|m\.)?youtube\.com|youtu\.be|music\.amazon\.(es|com)|(www\.)?deezer\.com|link\.deezer\.com|(www\.)?tidal\.com|listen\.tidal\.com)/[^[:space:]<>"'']*$'
       and (cancion_url !~* '^https://open\.spotify\.com/' or cancion_url ~* '/track/')))
  and jsonb_typeof(musica_aperturas) = 'object'
  and ((cumple_mes is null and cumple_dia is null)
       or (cumple_mes between 1 and 12 and cumple_dia between 1 and
           (case when cumple_mes = 2 then 29 when cumple_mes in (4, 6, 9, 11) then 30 else 31 end)))
);
comment on table public.personal_atleta is 'Lo que cada atleta elige para su app: apodo, porqué, tres ejercicios, su música y su cumpleaños (día y mes). Solo por sus funciones.';

-- Lo que devuelven las funciones (sin el atleta_id para el propio atleta)
create or replace function fbe_privado.personal_json(p public.personal_atleta) returns jsonb
language sql immutable set search_path = '' as $$
  select case when p.atleta_id is null then null else jsonb_build_object(
    'apodo', p.apodo, 'porque', p.porque, 'favoritos', to_jsonb(p.favoritos), 'musica_url', p.musica_url,
    'cancion_url', p.cancion_url, 'musica_aperturas', p.musica_aperturas,
    'cumple_mes', p.cumple_mes, 'cumple_dia', p.cumple_dia, 'actualizado_en', p.actualizado_en) end;
$$;

create or replace function public.personal_mio() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_atleta uuid := public.mi_atleta_id(); v public.personal_atleta;
begin
  if v_atleta is null then return null; end if;
  select * into v from public.personal_atleta where atleta_id = v_atleta;
  if not found then return null; end if;
  return fbe_privado.personal_json(v);
end $$;
comment on function public.personal_mio() is 'Lo que el atleta ha elegido para su app (o null).';

create or replace function public.personal_guardar(p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_atleta uuid := public.mi_atleta_id();
  v_apodo text; v_porque text; v_musica text; v_cancion text; v_mes smallint; v_dia smallint; v_fav uuid[];
  v public.personal_atleta;
begin
  if v_atleta is null then raise exception 'Solo el atleta guarda lo suyo'; end if;
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then
    raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada';
  end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then raise exception 'Faltan los datos'; end if;
  -- textos: sin saltos ni espacios de más; vacíos, nada
  v_apodo := nullif(btrim(regexp_replace(coalesce(p_datos ->> 'apodo', ''), '[[:space:][:cntrl:]]+', ' ', 'g')), '');
  v_porque := nullif(btrim(regexp_replace(coalesce(p_datos ->> 'porque', ''), '[[:space:][:cntrl:]]+', ' ', 'g')), '');
  v_musica := nullif(btrim(coalesce(p_datos ->> 'musica_url', '')), '');
  v_cancion := nullif(btrim(coalesce(p_datos ->> 'cancion_url', '')), '');
  begin
    v_mes := nullif(p_datos ->> 'cumple_mes', '')::smallint;
    v_dia := nullif(p_datos ->> 'cumple_dia', '')::smallint;
  exception when others then raise exception 'Fecha de cumpleaños no válida'; end;
  if jsonb_typeof(coalesce(p_datos -> 'favoritos', '[]'::jsonb)) <> 'array' then raise exception 'Favoritos no válidos'; end if;
  if jsonb_array_length(coalesce(p_datos -> 'favoritos', '[]'::jsonb)) > 3 then raise exception 'Como mucho 3 ejercicios'; end if;
  begin
    select coalesce(array_agg(distinct x::uuid), '{}') into v_fav from jsonb_array_elements_text(coalesce(p_datos -> 'favoritos', '[]'::jsonb)) x;
  exception when others then raise exception 'Favoritos no válidos'; end;
  insert into public.personal_atleta as t (atleta_id, apodo, porque, favoritos, musica_url, cancion_url, cumple_mes, cumple_dia, actualizado_en)
    values (v_atleta, v_apodo, v_porque, v_fav, v_musica, v_cancion, v_mes, v_dia, now())
  on conflict (atleta_id) do update set apodo = excluded.apodo, porque = excluded.porque, favoritos = excluded.favoritos,
    musica_url = excluded.musica_url, cancion_url = excluded.cancion_url, cumple_mes = excluded.cumple_mes, cumple_dia = excluded.cumple_dia, actualizado_en = now()
  returning * into v;
  return fbe_privado.personal_json(v);
end $$;
comment on function public.personal_guardar(jsonb) is 'El atleta guarda lo que elige para su app (sustituye lo anterior).';

create or replace function public.personal_atletas() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  return coalesce((select jsonb_agg(fbe_privado.personal_json(p) || jsonb_build_object('atleta_id', p.atleta_id) order by p.atleta_id)
                   from public.personal_atleta p), '[]'::jsonb);
end $$;
comment on function public.personal_atletas() is 'Lo de cada atleta (apodo, porqué, favoritos, música y cumpleaños). Solo el coach.';

-- ---------------------------------------------------------------------
-- 2. Los mensajes del coach para los momentos importantes
-- ---------------------------------------------------------------------
create table if not exists public.mensajes_coach (
  momento        text primary key check (momento in ('record', 'bloque', 'racha', 'vuelta', 'cumple')),
  texto          text not null check (char_length(texto) between 1 and 400),
  actualizado_en timestamptz not null default now()
);
comment on table public.mensajes_coach is 'Lo que el coach deja escrito para cada momento (récord, bloque terminado, hito de racha, vuelta tras un parón, cumpleaños). Solo por sus funciones.';

create or replace function public.mensajes_coach() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() and public.mi_atleta_id() is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('momento', m.momento, 'texto', m.texto, 'actualizado_en', m.actualizado_en) order by m.momento)
                   from public.mensajes_coach m), '[]'::jsonb);
end $$;
comment on function public.mensajes_coach() is 'Los mensajes del coach para cada momento. Los leen el coach y sus atletas.';

create or replace function public.mensaje_coach_guardar(p_momento text, p_texto text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  if p_momento is null or p_momento not in ('record', 'bloque', 'racha', 'vuelta', 'cumple') then raise exception 'Momento no válido'; end if;
  if v is null then delete from public.mensajes_coach where momento = p_momento; return; end if;
  if char_length(v) > 400 then raise exception 'Como mucho 400 caracteres'; end if;
  insert into public.mensajes_coach (momento, texto, actualizado_en) values (p_momento, v, now())
    on conflict (momento) do update set texto = excluded.texto, actualizado_en = now();
end $$;
comment on function public.mensaje_coach_guardar(text, text) is 'El coach guarda (o, con el texto vacío, quita) el mensaje de un momento.';

-- Cuántas veces abre su música desde una sesión: una más en el mes en curso (de Madrid). Como mucho 500 al mes.
create or replace function public.personal_musica_abierta() returns void
language plpgsql security definer set search_path = '' as $$
declare v_atleta uuid := public.mi_atleta_id(); v_mes text := to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM');
begin
  if v_atleta is null then return; end if;
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then return; end if;
  insert into public.personal_atleta (atleta_id, musica_aperturas) values (v_atleta, jsonb_build_object(v_mes, 1))
  on conflict (atleta_id) do update set musica_aperturas = public.personal_atleta.musica_aperturas
    || jsonb_build_object(v_mes, least(500, coalesce((public.personal_atleta.musica_aperturas ->> v_mes)::int, 0) + 1));
end $$;
comment on function public.personal_musica_abierta() is 'El atleta abre su música desde una sesión: suma una al mes en curso.';

-- ---------------------------------------------------------------------
-- 3. La música que enlaza el coach
-- ---------------------------------------------------------------------
create table if not exists public.musica_coach (
  clave          text primary key,
  url            text not null,
  actualizado_en timestamptz not null default now()
);
alter table public.musica_coach drop constraint if exists musica_coach_valida;
alter table public.musica_coach add constraint musica_coach_valida check (
  clave ~ '^(familia:(empuje|tiron|pierna|core|fullbody|cardio|movilidad)|descarga|equipo|ritmo:(carrera|andar|bici|eliptica|remo|nadar|cuerda)|sesion:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|bloque:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'
  and char_length(url) <= 300 and url ~* '^https://(open\.spotify\.com|spotify\.link|music\.apple\.com|music\.youtube\.com|(www\.|m\.)?youtube\.com|youtu\.be|music\.amazon\.(es|com)|(www\.)?deezer\.com|link\.deezer\.com|(www\.)?tidal\.com|listen\.tidal\.com)/[^[:space:]<>"'']*$'
);
comment on table public.musica_coach is 'Las listas que enlaza el coach (por tipo de sesión, descarga, equipo, ritmo de cada cardio, una sesión o un bloque). Solo por sus funciones.';

create or replace function public.musica_coach_lista() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  return coalesce((select jsonb_object_agg(m.clave, m.url) from public.musica_coach m), '{}'::jsonb);
end $$;
comment on function public.musica_coach_lista() is 'Todo lo que ha enlazado el coach ({ clave: url }). Solo el coach.';

create or replace function public.musica_coach_guardar(p_clave text, p_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  if v is null then delete from public.musica_coach where clave = p_clave; return; end if;
  insert into public.musica_coach (clave, url, actualizado_en) values (p_clave, v, now())
    on conflict (clave) do update set url = excluded.url, actualizado_en = now();
end $$;
comment on function public.musica_coach_guardar(text, text) is 'El coach enlaza (o, vacío, quita) una lista.';

-- Lo general (familias, descarga, equipo, ritmos) y lo de esa sesión y ese bloque, si son del que pregunta (o el coach)
create or replace function public.musica_para(p_sesion uuid default null, p_bloque uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_coach boolean := public.es_coach(); v_atleta uuid := public.mi_atleta_id(); v_ses boolean := false; v_blo boolean := false;
begin
  if not v_coach and v_atleta is null then return '{}'::jsonb; end if;
  if p_sesion is not null then v_ses := v_coach or public.atleta_de_sesion(p_sesion) = v_atleta; end if;
  if p_bloque is not null then v_blo := v_coach or exists (select 1 from public.bloques b where b.id = p_bloque and b.atleta_id = v_atleta); end if;
  return coalesce((select jsonb_object_agg(m.clave, m.url) from public.musica_coach m
    where m.clave !~ '^(sesion|bloque):'
       or (v_ses and m.clave = 'sesion:' || p_sesion::text)
       or (v_blo and m.clave = 'bloque:' || p_bloque::text)), '{}'::jsonb);
end $$;
comment on function public.musica_para(uuid, uuid) is 'La música del coach para una sesión: lo general y lo de esa sesión y ese bloque (si son suyos).';

-- Nadie toca las tablas directamente
alter table public.personal_atleta enable row level security;
alter table public.mensajes_coach enable row level security;
alter table public.musica_coach enable row level security;
revoke all on public.personal_atleta, public.mensajes_coach, public.musica_coach from public, anon, authenticated;

-- Permisos (como al final de 003 a 049)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (50)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
