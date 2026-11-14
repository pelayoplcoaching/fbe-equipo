-- =====================================================================
-- FBE Equipo, migración 072: música 3 (claude/musica-mejoras-3.md)
--
-- Por qué: veinte mejoras de la música, siempre como consejo (la programación del coach no cambia). Lo que guarda:
--   · personal_atleta: sus listas con etiqueta (musica_listas: hasta 12 { url, etiqueta }) y dos «himnos» más (la última
--     serie y la vuelta tras un parón; el del récord ya era cancion_url). Los ve el atleta y su coach.
--   · musica_sesion: la última música que abrió desde la app en cada sesión («Lo batiste con…»). Atleta y coach.
--   · musica_aperturas_lista: cuántas veces abrió cada lista desde la app, por mes («Lo que más te acompaña»; y, para el
--     coach, solo de sus propias listas y en total del equipo: «Qué música funciona»).
--   · musica_coach admite más claves: fase:calentamiento, fase:vuelta_calma, test (la lista de los días de test) y
--     podcast (el pódcast o el canal de FBE para el cardio largo). musica_copiar: la música de una sesión o un bloque
--     viaja con la plantilla al copiar.
--   · musica_biblioteca: las listas del coach con sus etiquetas (energía, bpm aproximado, minutos, género). Solo el coach.
--   · Comunidad: la canción que cada uno comparte en «Lo que suena en el equipo» (opcional, en comunidad_miembros), el
--     reto musical del mes (musica_retos: el tema lo pone el coach; cada uno propone una canción y vota otra) y la lista
--     de cada pareja de compañeros de racha (comunidad_companeros.lista_url). Al salir de la comunidad, su canción, su
--     propuesta y su voto se borran.
-- Nadie toca las tablas: todo va por funciones.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 071 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 72 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 072 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 72;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 71) then  -- (2) la anterior
    raise exception 'Falta la migración 071 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- Un enlace de música válido (los mismos servicios que 050)
create or replace function fbe_privado.musica_url_valida(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p is not null and char_length(p) <= 300
    and p ~* '^https://(open\.spotify\.com|spotify\.link|music\.apple\.com|music\.youtube\.com|(www\.|m\.)?youtube\.com|youtu\.be|music\.amazon\.(es|com)|(www\.)?deezer\.com|link\.deezer\.com|(www\.)?tidal\.com|listen\.tidal\.com)/[^[:space:]<>"'']*$';
$$;
-- El mes de Madrid de hoy («AAAA-MM»)
create or replace function fbe_privado.musica_mes() returns text
language sql stable set search_path = '' as $$ select to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM'); $$;

-- ---------------------------------------------------------------------
-- 1. Lo del atleta: sus listas con etiqueta y sus himnos
-- ---------------------------------------------------------------------
alter table public.personal_atleta add column if not exists musica_listas jsonb not null default '[]'::jsonb;
alter table public.personal_atleta add column if not exists himno_ultima_url text;
alter table public.personal_atleta add column if not exists himno_vuelta_url text;
alter table public.personal_atleta drop constraint if exists personal_atleta_musica3;
alter table public.personal_atleta add constraint personal_atleta_musica3 check (
  jsonb_typeof(musica_listas) = 'array' and jsonb_array_length(musica_listas) <= 12
  and (himno_ultima_url is null or fbe_privado.musica_url_valida(himno_ultima_url))
  and (himno_vuelta_url is null or fbe_privado.musica_url_valida(himno_vuelta_url))
);

create or replace function fbe_privado.personal_json(p public.personal_atleta) returns jsonb
language sql stable set search_path = '' as $$
  select case when p.atleta_id is null then null else jsonb_build_object(
    'apodo', p.apodo, 'porque', p.porque, 'favoritos', to_jsonb(p.favoritos), 'musica_url', p.musica_url,
    'cancion_url', p.cancion_url, 'musica_aperturas', p.musica_aperturas,
    'cumple_mes', p.cumple_mes, 'cumple_dia', p.cumple_dia,
    'genero', p.genero, 'tono', p.tono, 'meta_nombre', p.meta_nombre, 'meta_fecha', p.meta_fecha, 'meta_cifra', p.meta_cifra, 'meta_unidad', p.meta_unidad,
    'manual_feedback', p.manual_feedback, 'manual_motiva', to_jsonb(p.manual_motiva), 'manual_evitar', p.manual_evitar,
    'musica_listas', p.musica_listas, 'himno_ultima_url', p.himno_ultima_url, 'himno_vuelta_url', p.himno_vuelta_url,
    'actualizado_en', p.actualizado_en) end;
$$;

-- Guarda solo lo de la música 3 (sus listas con etiqueta y sus himnos); lo demás de su fila no se toca
create or replace function public.personal_musica_guardar(p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_atleta uuid := public.mi_atleta_id();
  v public.personal_atleta;
  v_listas jsonb; v_ultima text; v_vuelta text;
begin
  if v_atleta is null then raise exception 'Solo el atleta guarda lo suyo' using errcode = '42501'; end if;
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then
    raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada';
  end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then raise exception 'Faltan los datos'; end if;
  if exists (select 1 from jsonb_each(p_datos) e where e.key in ('himno_ultima_url', 'himno_vuelta_url') and jsonb_typeof(e.value) not in ('string', 'null'))
     or (p_datos ? 'musica_listas' and jsonb_typeof(p_datos -> 'musica_listas') <> 'array') then
    raise exception 'Esos datos no valen' using errcode = '22023';
  end if;
  select * into v from public.personal_atleta where atleta_id = v_atleta;
  v_listas := case when p_datos ? 'musica_listas' then p_datos -> 'musica_listas' else coalesce(v.musica_listas, '[]'::jsonb) end;
  if jsonb_array_length(v_listas) > 12 then raise exception 'Como mucho 12 listas' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_array_elements(v_listas) x
             where jsonb_typeof(x) <> 'object' or not fbe_privado.musica_url_valida(x ->> 'url')
                or coalesce(x ->> 'etiqueta', '') not in ('empuje', 'tiron', 'pierna', 'core', 'fullbody', 'cardio', 'movilidad', 'energia', 'tranquila', 'calentamiento', 'vuelta_calma')
                or (select count(*) from jsonb_object_keys(x)) > 2) then
    raise exception 'Cada lista, con su enlace de música y una etiqueta de la lista' using errcode = '22023';
  end if;
  v_ultima := case when p_datos ? 'himno_ultima_url' then nullif(btrim(p_datos ->> 'himno_ultima_url'), '') else v.himno_ultima_url end;
  v_vuelta := case when p_datos ? 'himno_vuelta_url' then nullif(btrim(p_datos ->> 'himno_vuelta_url'), '') else v.himno_vuelta_url end;
  if (v_ultima is not null and not fbe_privado.musica_url_valida(v_ultima)) or (v_vuelta is not null and not fbe_privado.musica_url_valida(v_vuelta)) then
    raise exception 'Tiene que ser un enlace de Spotify, Apple Music, YouTube Music, Amazon Music, Deezer o Tidal' using errcode = '22023';
  end if;
  insert into public.personal_atleta as t (atleta_id, musica_listas, himno_ultima_url, himno_vuelta_url, actualizado_en)
    values (v_atleta, v_listas, v_ultima, v_vuelta, now())
  on conflict (atleta_id) do update set musica_listas = excluded.musica_listas, himno_ultima_url = excluded.himno_ultima_url,
    himno_vuelta_url = excluded.himno_vuelta_url, actualizado_en = now()
  returning * into v;
  return fbe_privado.personal_json(v);
end $$;
comment on function public.personal_musica_guardar(jsonb) is 'El atleta guarda sus listas con etiqueta y sus himnos (última serie y vuelta tras un parón). Lo ve su coach.';

-- ---------------------------------------------------------------------
-- 2. La música de cada sesión («Lo batiste con…») y lo que más abre
-- ---------------------------------------------------------------------
create table if not exists public.musica_sesion (
  sesion_id   uuid primary key references public.sesiones(id) on delete cascade,
  atleta_id   uuid not null references public.atletas(id) on delete cascade,
  url         text not null,
  abierta_en  timestamptz not null default now()
);
create index if not exists musica_sesion_atleta_idx on public.musica_sesion (atleta_id, abierta_en);
alter table public.musica_sesion drop constraint if exists musica_sesion_valida;
alter table public.musica_sesion add constraint musica_sesion_valida check (fbe_privado.musica_url_valida(url));
comment on table public.musica_sesion is 'La última música que el atleta abrió desde la app en cada sesión. Solo por sus funciones.';

create table if not exists public.musica_aperturas_lista (
  atleta_id  uuid not null references public.atletas(id) on delete cascade,
  mes        text not null,
  url        text not null,
  n          integer not null default 0,
  primary key (atleta_id, mes, url)
);
alter table public.musica_aperturas_lista drop constraint if exists musica_aperturas_lista_valida;
alter table public.musica_aperturas_lista add constraint musica_aperturas_lista_valida check (
  mes ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' and fbe_privado.musica_url_valida(url) and n between 0 and 500
);
comment on table public.musica_aperturas_lista is 'Cuántas veces abrió cada lista desde la app, por mes (de Madrid). Solo por sus funciones.';

-- El atleta abre una música desde la app (en una sesión, si se sabe): se apunta a la sesión y se cuenta en su mes
create or replace function public.musica_abierta_lista(p_url text, p_sesion uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_atleta uuid := public.mi_atleta_id(); v_url text := btrim(coalesce(p_url, '')); v_mes text := fbe_privado.musica_mes();
begin
  if v_atleta is null or not fbe_privado.musica_url_valida(v_url) then return; end if;
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then return; end if;
  if p_sesion is not null and public.atleta_de_sesion(p_sesion) = v_atleta then
    insert into public.musica_sesion (sesion_id, atleta_id, url, abierta_en) values (p_sesion, v_atleta, v_url, now())
      on conflict (sesion_id) do update set url = excluded.url, abierta_en = now();
  end if;
  -- (como mucho 60 listas distintas al mes: la que pasa de ahí no se cuenta)
  if exists (select 1 from public.musica_aperturas_lista where atleta_id = v_atleta and mes = v_mes and url = v_url)
     or (select count(*) from public.musica_aperturas_lista where atleta_id = v_atleta and mes = v_mes) < 60 then
    insert into public.musica_aperturas_lista (atleta_id, mes, url, n) values (v_atleta, v_mes, v_url, 1)
      on conflict (atleta_id, mes, url) do update set n = least(500, public.musica_aperturas_lista.n + 1);
  end if;
end $$;
comment on function public.musica_abierta_lista(text, uuid) is 'El atleta abre una música desde la app: se apunta a esa sesión (si es suya) y se cuenta en su mes.';

-- La música de unas sesiones ({ sesion_id: url }): las suyas (el atleta) o cualquiera (el coach)
create or replace function public.musica_de_sesiones(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(m.sesion_id, m.url), '{}'::jsonb)
  from public.musica_sesion m
  where m.sesion_id = any(coalesce(p_ids, '{}')) and cardinality(coalesce(p_ids, '{}')) <= 400
    and (public.es_coach() or m.atleta_id = public.mi_atleta_id());
$$;
comment on function public.musica_de_sesiones(uuid[]) is 'La última música que abrió en cada una de esas sesiones (las suyas; el coach, cualquiera).';

-- Lo que más abre (del mes p_desde al p_hasta, «AAAA-MM»): [{ url, n }], las p_limite primeras (5; para su descarga, todas)
create or replace function public.musica_mas_abierta(p_desde text, p_hasta text, p_atleta uuid default null, p_limite integer default 5) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_atleta uuid := coalesce(p_atleta, public.mi_atleta_id());
begin
  if v_atleta is null or (p_atleta is not null and not public.es_coach() and p_atleta is distinct from public.mi_atleta_id()) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('url', x.url, 'n', x.n) order by x.n desc, x.url)
    from (select a.url, sum(a.n)::integer as n from public.musica_aperturas_lista a
          where a.atleta_id = v_atleta and a.mes collate "C" >= p_desde collate "C" and a.mes collate "C" <= p_hasta collate "C"
          group by a.url order by sum(a.n) desc, a.url limit least(greatest(coalesce(p_limite, 5), 1), 2000)) x), '[]'::jsonb);
end $$;
comment on function public.musica_mas_abierta(text, text, uuid, integer) is 'Las listas que más abrió desde la app en esos meses (el atleta; el coach, de cualquiera).';

-- ---------------------------------------------------------------------
-- 3. La música del coach: más claves, su biblioteca, qué funciona y copiarla con la plantilla
-- ---------------------------------------------------------------------
alter table public.musica_coach drop constraint if exists musica_coach_valida;
alter table public.musica_coach add constraint musica_coach_valida check (
  clave ~ '^(familia:(empuje|tiron|pierna|core|fullbody|cardio|movilidad)|descarga|equipo|ritmo:(carrera|andar|bici|eliptica|remo|nadar|cuerda)|fase:(calentamiento|vuelta_calma)|test|podcast|sesion:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|bloque:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'
  and fbe_privado.musica_url_valida(url)  -- (como en la 050: solo enlaces de música)
);
create or replace function public.musica_coach_guardar(p_clave text, p_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  if p_clave is null or p_clave !~ '^(familia:(empuje|tiron|pierna|core|fullbody|cardio|movilidad)|descarga|equipo|ritmo:(carrera|andar|bici|eliptica|remo|nadar|cuerda)|fase:(calentamiento|vuelta_calma)|test|podcast|sesion:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|bloque:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$' then
    raise exception 'Clave no válida';
  end if;
  if v is null then delete from public.musica_coach where clave = p_clave; return; end if;
  insert into public.musica_coach (clave, url, actualizado_en) values (p_clave, v, now())
    on conflict (clave) do update set url = excluded.url, actualizado_en = now();
end $$;
comment on function public.musica_coach_guardar(text, text) is 'El coach enlaza (o, vacío, quita) una lista.';

-- La música de una sesión y de un bloque viaja al copiarlos: p_pares = [[sesión de origen, sesión nueva], …]
create or replace function public.musica_copiar(p_pares jsonb default '[]'::jsonb, p_bloque_de uuid default null, p_bloque_a uuid default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer := 0; v_url text; par jsonb;
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  if p_bloque_de is not null and p_bloque_a is not null then
    select url into v_url from public.musica_coach where clave = 'bloque:' || p_bloque_de;
    if v_url is not null then
      insert into public.musica_coach (clave, url, actualizado_en) values ('bloque:' || p_bloque_a, v_url, now())
        on conflict (clave) do update set url = excluded.url, actualizado_en = now();
      n := n + 1;
    end if;
  end if;
  if jsonb_typeof(p_pares) = 'array' and jsonb_array_length(p_pares) <= 200 then
    for par in select * from jsonb_array_elements(p_pares) loop
      continue when jsonb_typeof(par) <> 'array' or jsonb_array_length(par) <> 2
        or (par ->> 0) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or (par ->> 1) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
      select url into v_url from public.musica_coach where clave = 'sesion:' || (par ->> 0);
      continue when v_url is null;
      insert into public.musica_coach (clave, url, actualizado_en) values ('sesion:' || (par ->> 1), v_url, now())
        on conflict (clave) do update set url = excluded.url, actualizado_en = now();
      n := n + 1;
    end loop;
  end if;
  return n;
end $$;
comment on function public.musica_copiar(jsonb, uuid, uuid) is 'Al copiar un bloque o una semana (también desde una plantilla), su música va con ellos. Solo el coach.';

create table if not exists public.musica_biblioteca (
  id              uuid primary key default gen_random_uuid(),
  url             text not null,
  etiquetas       text[] not null default '{}',
  energia         smallint,
  bpm             smallint,
  minutos         smallint,
  genero          text,
  nota            text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create unique index if not exists musica_biblioteca_url_idx on public.musica_biblioteca (url);
alter table public.musica_biblioteca drop constraint if exists musica_biblioteca_valida;
alter table public.musica_biblioteca add constraint musica_biblioteca_valida check (
  fbe_privado.musica_url_valida(url) and cardinality(etiquetas) <= 8 and array_position(etiquetas, null) is null
  and (energia is null or energia between 1 and 3) and (bpm is null or bpm between 40 and 220) and (minutos is null or minutos between 1 and 900)
  and (genero is null or char_length(genero) between 1 and 40) and (nota is null or char_length(nota) between 1 and 140)
);
comment on table public.musica_biblioteca is 'Las listas del coach con sus etiquetas (energía 1–3, bpm aproximado, minutos, género, nota). Solo el coach, por sus funciones.';

create or replace function public.musica_biblioteca() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  return coalesce((select jsonb_agg(to_jsonb(b) order by b.actualizado_en desc) from public.musica_biblioteca b), '[]'::jsonb);
end $$;
comment on function public.musica_biblioteca() is 'La biblioteca de música del coach. Solo el coach.';

create or replace function public.musica_biblioteca_guardar(p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_url text; v_etiq text[]; v_genero text; v_nota text;
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then raise exception 'Faltan los datos'; end if;
  v_url := btrim(coalesce(p_datos ->> 'url', ''));
  if not fbe_privado.musica_url_valida(v_url) then raise exception 'Tiene que ser un enlace de Spotify, Apple Music, YouTube Music, Amazon Music, Deezer o Tidal' using errcode = '22023'; end if;
  if p_datos ? 'etiquetas' and jsonb_typeof(p_datos -> 'etiquetas') <> 'array' then raise exception 'Etiquetas no válidas' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct left(lower(fbe_privado.texto_limpio(x)), 24)) filter (where nullif(btrim(x), '') is not null), '{}')
    into v_etiq from jsonb_array_elements_text(coalesce(p_datos -> 'etiquetas', '[]'::jsonb)) x;
  if cardinality(v_etiq) > 8 then raise exception 'Como mucho 8 etiquetas' using errcode = '22023'; end if;
  v_genero := nullif(left(fbe_privado.texto_limpio(coalesce(p_datos ->> 'genero', '')), 40), '');
  v_nota := nullif(left(fbe_privado.texto_limpio(coalesce(p_datos ->> 'nota', '')), 140), '');
  v_id := case when coalesce(p_datos ->> 'id', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (p_datos ->> 'id')::uuid end;
  if v_id is not null and exists (select 1 from public.musica_biblioteca where id = v_id) then
    update public.musica_biblioteca set url = v_url, etiquetas = v_etiq,
      energia = nullif(p_datos ->> 'energia', '')::smallint, bpm = nullif(p_datos ->> 'bpm', '')::smallint, minutos = nullif(p_datos ->> 'minutos', '')::smallint,
      genero = v_genero, nota = v_nota, actualizado_en = now() where id = v_id;
  else
    insert into public.musica_biblioteca (url, etiquetas, energia, bpm, minutos, genero, nota)
      values (v_url, v_etiq, nullif(p_datos ->> 'energia', '')::smallint, nullif(p_datos ->> 'bpm', '')::smallint, nullif(p_datos ->> 'minutos', '')::smallint, v_genero, v_nota)
      on conflict (url) do update set etiquetas = excluded.etiquetas, energia = excluded.energia, bpm = excluded.bpm, minutos = excluded.minutos,
        genero = excluded.genero, nota = excluded.nota, actualizado_en = now()
      returning id into v_id;
  end if;
  return v_id;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Energía, bpm y minutos tienen que ser números' using errcode = '22023';
  when check_violation then
    raise exception 'Energía de 1 a 3, bpm de 40 a 220 y minutos de 1 a 900' using errcode = '22023';
end $$;
comment on function public.musica_biblioteca_guardar(jsonb) is 'El coach guarda una lista en su biblioteca (con sus etiquetas). Solo el coach.';

create or replace function public.musica_biblioteca_borrar(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  delete from public.musica_biblioteca where id = p_id;
end $$;

-- Qué música funciona (solo sus listas: las de musica_coach y su biblioteca): [{ url, n, atletas }] desde p_desde
-- («AAAA-MM») y, del equipo, cuántas sesiones hechas tuvieron música abierta desde la app
create or replace function public.musica_coach_uso(p_desde text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_desde date;
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  if coalesce(p_desde, '') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'Mes no válido' using errcode = '22023'; end if;
  v_desde := (p_desde || '-01')::date;
  return jsonb_build_object(
    'listas', coalesce((select jsonb_agg(jsonb_build_object('url', x.url, 'n', x.n, 'atletas', x.atletas) order by x.n desc, x.url)
      from (select a.url, sum(a.n)::integer as n, count(distinct a.atleta_id)::integer as atletas
            from public.musica_aperturas_lista a
            where a.mes collate "C" >= p_desde collate "C"
              and (a.url in (select m.url from public.musica_coach m) or a.url in (select b.url from public.musica_biblioteca b))
            group by a.url order by sum(a.n) desc, a.url limit 20) x), '[]'::jsonb),
    'sesiones', (select count(*) from public.sesiones s where s.completada and s.fecha_realizada >= v_desde),
    'con_musica', (select count(*) from public.sesiones s join public.musica_sesion m on m.sesion_id = s.id where s.completada and s.fecha_realizada >= v_desde));
end $$;
comment on function public.musica_coach_uso(text) is 'Qué listas del coach se abren más (y cuántos atletas) y cuántas sesiones del equipo tuvieron música. Solo el coach.';

-- ---------------------------------------------------------------------
-- 4. Con el equipo: «Lo que suena», el reto musical del mes y la lista de los compañeros de racha
-- ---------------------------------------------------------------------
alter table public.comunidad_miembros add column if not exists cancion_url text;
alter table public.comunidad_miembros add column if not exists cancion_en timestamptz;
alter table public.comunidad_miembros add column if not exists reto_cancion_url text;
alter table public.comunidad_miembros add column if not exists reto_mes text;
alter table public.comunidad_miembros add column if not exists reto_voto uuid;
alter table public.comunidad_miembros add column if not exists reto_voto_mes text;
alter table public.comunidad_miembros drop constraint if exists comunidad_miembros_musica3;
alter table public.comunidad_miembros add constraint comunidad_miembros_musica3 check (
  (cancion_url is null or fbe_privado.musica_url_valida(cancion_url)) and ((cancion_url is null) = (cancion_en is null))
  and (reto_cancion_url is null or fbe_privado.musica_url_valida(reto_cancion_url)) and ((reto_cancion_url is null) = (reto_mes is null))
  and (reto_mes is null or reto_mes ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$')
  and ((reto_voto is null) = (reto_voto_mes is null)) and (reto_voto_mes is null or reto_voto_mes ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$')
);
-- Al salir (o si le sacan), su canción, su propuesta y su voto se borran
create or replace function fbe_privado.comunidad_musica_al_salir() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.salido_en is not null and old.salido_en is null then
    new.cancion_url := null; new.cancion_en := null; new.reto_cancion_url := null; new.reto_mes := null; new.reto_voto := null; new.reto_voto_mes := null;
  end if;
  return new;
end $$;
drop trigger if exists comunidad_musica_al_salir on public.comunidad_miembros;
create trigger comunidad_musica_al_salir before update of salido_en on public.comunidad_miembros
  for each row execute function fbe_privado.comunidad_musica_al_salir();

-- ¿Puede publicar? (dentro, sin bloquear y sin silenciar)
create or replace function fbe_privado.comunidad_puede_musica(p_perfil uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.comunidad_miembros m where m.perfil_id = p_perfil and m.salido_en is null and not m.bloqueado
                 and (m.silenciado_hasta is null or m.silenciado_hasta <= now()));
$$;
create or replace function fbe_privado.comunidad_ve_musica(p_perfil uuid) returns boolean
language sql stable set search_path = '' as $$
  select public.es_coach() or exists (select 1 from public.comunidad_miembros m where m.perfil_id = p_perfil and m.salido_en is null and not m.bloqueado);
$$;

-- Su canción en «Lo que suena en el equipo» (vacío: la quita)
create or replace function public.comunidad_cancion_guardar(p_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión' using errcode = '42501'; end if;
  if v is not null and not fbe_privado.comunidad_puede_musica(v_uid) then raise exception 'Ahora no puedes compartir en el equipo' using errcode = '42501'; end if;
  if v is not null and not fbe_privado.musica_url_valida(v) then raise exception 'Tiene que ser un enlace de Spotify, Apple Music, YouTube Music, Amazon Music, Deezer o Tidal' using errcode = '22023'; end if;
  update public.comunidad_miembros set cancion_url = v, cancion_en = case when v is null then null else now() end
    where perfil_id = v_uid and salido_en is null;
end $$;
comment on function public.comunidad_cancion_guardar(text) is 'Su canción en «Lo que suena en el equipo» (o, vacío, la quita). Solo estando dentro.';

-- Lo que suena: [{ perfil_id, nombre, url, en, yo }] de los que están dentro, lo último primero (60 como mucho)
create or replace function public.comunidad_canciones() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not fbe_privado.comunidad_ve_musica(v_uid) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('perfil_id', x.perfil_id, 'nombre', x.nombre, 'url', x.cancion_url, 'en', x.cancion_en, 'yo', x.perfil_id = v_uid) order by x.cancion_en desc)
    from (select m.* from public.comunidad_miembros m where m.salido_en is null and not m.bloqueado and m.cancion_url is not null
          order by m.cancion_en desc limit 60) x), '[]'::jsonb);
end $$;
comment on function public.comunidad_canciones() is 'La canción que ha compartido cada uno de los que están dentro de la comunidad.';

create table if not exists public.musica_retos (
  mes        text primary key,
  tema       text not null,
  creado_en  timestamptz not null default now()
);
alter table public.musica_retos drop constraint if exists musica_retos_validos;
alter table public.musica_retos add constraint musica_retos_validos check (mes ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' and char_length(tema) between 3 and 80);
comment on table public.musica_retos is 'El tema del reto musical de cada mes (lo pone el coach). Solo por sus funciones.';

create or replace function public.musica_reto_guardar(p_mes text, p_tema text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := nullif(fbe_privado.texto_limpio(coalesce(p_tema, '')), '');
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  if coalesce(p_mes, '') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'Mes no válido' using errcode = '22023'; end if;
  if v is null then delete from public.musica_retos where mes = p_mes; return; end if;
  if char_length(v) not between 3 and 80 then raise exception 'El tema, de 3 a 80 caracteres' using errcode = '22023'; end if;
  insert into public.musica_retos (mes, tema) values (p_mes, v) on conflict (mes) do update set tema = excluded.tema;
end $$;
comment on function public.musica_reto_guardar(text, text) is 'El coach pone (o, vacío, quita) el tema del reto musical de un mes.';

-- El reto de este mes: { mes, tema, canciones: [{ perfil_id, nombre, url, votos, yo }], mi_voto } (o null sin reto)
create or replace function public.comunidad_reto_musical() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_mes text := fbe_privado.musica_mes(); v_tema text;
begin
  if v_uid is null or not fbe_privado.comunidad_ve_musica(v_uid) then return null; end if;
  select tema into v_tema from public.musica_retos where mes = v_mes;
  if v_tema is null then return null; end if;
  return jsonb_build_object('mes', v_mes, 'tema', v_tema,
    'mi_voto', (select m.reto_voto from public.comunidad_miembros m where m.perfil_id = v_uid and m.reto_voto_mes = v_mes),
    'canciones', coalesce((select jsonb_agg(jsonb_build_object('perfil_id', x.perfil_id, 'nombre', x.nombre, 'url', x.reto_cancion_url, 'votos', x.votos, 'yo', x.perfil_id = v_uid)
                                            order by x.votos desc, x.nombre)
      from (select m.perfil_id, m.nombre, m.reto_cancion_url,
                   (select count(*) from public.comunidad_miembros o where o.reto_voto = m.perfil_id and o.reto_voto_mes = v_mes and o.salido_en is null)::integer as votos
            from public.comunidad_miembros m where m.salido_en is null and not m.bloqueado and m.reto_mes = v_mes) x), '[]'::jsonb));
end $$;
comment on function public.comunidad_reto_musical() is 'El reto musical de este mes con las canciones propuestas y sus votos.';

create or replace function public.comunidad_reto_cancion(p_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v text := nullif(btrim(coalesce(p_url, '')), ''); v_mes text := fbe_privado.musica_mes();
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión' using errcode = '42501'; end if;
  if v is not null and not fbe_privado.comunidad_puede_musica(v_uid) then raise exception 'Ahora no puedes compartir en el equipo' using errcode = '42501'; end if;
  if v is not null and not exists (select 1 from public.musica_retos where mes = v_mes) then raise exception 'Este mes no hay reto musical'; end if;
  if v is not null and not fbe_privado.musica_url_valida(v) then raise exception 'Tiene que ser un enlace de Spotify, Apple Music, YouTube Music, Amazon Music, Deezer o Tidal' using errcode = '22023'; end if;
  update public.comunidad_miembros set reto_cancion_url = v, reto_mes = case when v is null then null else v_mes end
    where perfil_id = v_uid and salido_en is null;
  -- (si quita la suya, los votos que tenía se van)
  if v is null then update public.comunidad_miembros set reto_voto = null, reto_voto_mes = null where reto_voto = v_uid and reto_voto_mes = v_mes; end if;
end $$;
comment on function public.comunidad_reto_cancion(text) is 'Su canción para el reto musical de este mes (o, vacío, la quita).';

create or replace function public.comunidad_reto_votar(p_perfil uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_mes text := fbe_privado.musica_mes();
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión' using errcode = '42501'; end if;
  if not fbe_privado.comunidad_ve_musica(v_uid) or not exists (select 1 from public.comunidad_miembros where perfil_id = v_uid and salido_en is null) then
    raise exception 'Solo estando dentro de la comunidad' using errcode = '42501';
  end if;
  if p_perfil is null then
    update public.comunidad_miembros set reto_voto = null, reto_voto_mes = null where perfil_id = v_uid; return;
  end if;
  if p_perfil = v_uid then raise exception 'A la tuya no te puedes votar'; end if;
  if not exists (select 1 from public.comunidad_miembros where perfil_id = p_perfil and salido_en is null and not bloqueado and reto_mes = v_mes) then
    raise exception 'Esa canción ya no está en el reto';
  end if;
  update public.comunidad_miembros set reto_voto = p_perfil, reto_voto_mes = v_mes where perfil_id = v_uid and salido_en is null;
end $$;
comment on function public.comunidad_reto_votar(uuid) is 'Su voto en el reto musical de este mes (uno; null lo quita).';

alter table public.comunidad_companeros add column if not exists lista_url text;
alter table public.comunidad_companeros drop constraint if exists comunidad_companeros_lista;
alter table public.comunidad_companeros add constraint comunidad_companeros_lista check (lista_url is null or fbe_privado.musica_url_valida(lista_url));

-- Las listas de sus parejas de racha (aceptadas): [{ id, otro, url }]
create or replace function public.comunidad_listas_companeros() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'otro', coalesce(m.nombre, 'Tu compañero'), 'url', c.lista_url) order by c.aceptado_en), '[]'::jsonb)
  from public.comunidad_companeros c
  left join public.comunidad_miembros m on m.perfil_id = case when c.de = auth.uid() then c.para else c.de end and m.salido_en is null
  where auth.uid() in (c.de, c.para) and c.estado = 'aceptada';
$$;
comment on function public.comunidad_listas_companeros() is 'La lista compartida de cada pareja de compañeros de racha (solo los dos la ven).';

create or replace function public.comunidad_companero_lista(p_id uuid, p_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión' using errcode = '42501'; end if;
  if v is not null and not fbe_privado.musica_url_valida(v) then raise exception 'Tiene que ser un enlace de Spotify, Apple Music, YouTube Music, Amazon Music, Deezer o Tidal' using errcode = '22023'; end if;
  update public.comunidad_companeros set lista_url = v where id = p_id and auth.uid() in (de, para) and estado = 'aceptada';
  if not found then raise exception 'Esa pareja no es tuya'; end if;
end $$;
comment on function public.comunidad_companero_lista(uuid, text) is 'Uno de los dos compañeros de racha pone (o quita) la lista que comparten.';

-- ---------------------------------------------------------------------
-- 5. La copia completa del coach, con las tablas nuevas (como en la 069)
-- ---------------------------------------------------------------------
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
    'musica_retos', coalesce((select jsonb_agg(to_jsonb(t)) from public.musica_retos t), '[]'::jsonb));
end $$;
comment on function public.copia_privada() is 'Para la copia completa del coach: las tablas de la 050 y la 051 (sin las huellas de los enlaces), la agenda (069) y la música 3 (072). Solo el coach.';

-- Nadie toca las tablas directamente
alter table public.musica_sesion enable row level security;
alter table public.musica_aperturas_lista enable row level security;
alter table public.musica_biblioteca enable row level security;
alter table public.musica_retos enable row level security;
revoke all on public.musica_sesion, public.musica_aperturas_lista, public.musica_biblioteca, public.musica_retos from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Permisos (como al final de 003 a 070)
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

insert into public.fbe_migraciones (numero) values (72)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
