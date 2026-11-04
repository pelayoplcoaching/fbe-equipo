-- =====================================================================
-- FBE Equipo, migración 036 (v0.58): el análisis automático de un vídeo de técnica (experimental)
--   · video_revisiones.analisis (jsonb, opcional): lo que el coach guarda en la corrección de un vídeo tras analizarlo en
--     su móvil u ordenador (el vídeo no sale a ningún otro sitio para eso): la trayectoria de la barra (como mucho 900
--     puntos [t, x, y], con x e y de 0 a 1 y t dentro del vídeo), la calibración con el disco (su tamaño real, de 10 a
--     60 cm, y su diámetro en píxeles), las repeticiones (como mucho 30, cada una con sus momentos y su velocidad media y
--     pico de 0 a 3 m/s, la duración de la subida y el recorrido de 0 a 150 cm) y, de los puntos del cuerpo, solo el
--     resumen por repetición (ángulos de 0 a 180°: nunca los puntos de cada fotograma). Como mucho 64 kB.
--   · analisis_valido(): la forma exacta; algo mal formado da false, nunca un error.
--   · Lo escribe solo el coach (con su política de siempre, la de la 035). El atleta lo lee, del suyo, con
--     video_correcciones(), que lo devuelve (y sigue sin devolver ninguna hora).
--   · Guardarlo cuenta como corregir (el primer «Corregido» avisa al atleta, como la nota o el tempo).
-- Se ejecuta en el SQL Editor después de la 035 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 36 then
    raise exception 'Esta base ya tiene la migración %: repetir la 036 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 36;» y, después de ella, todas las siguientes en orden, todo en la misma consulta del SQL Editor (una sola transacción).';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 35) then
    raise exception 'Antes de la 036 hace falta la 035: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. La columna y su forma
-- ---------------------------------------------------------------------
alter table public.video_revisiones add column if not exists analisis jsonb;

-- Un número de jsonb entre lo y hi y con 4 decimales como mucho (false si no es un número; nunca un error). (Revisión de
-- seguridad: sin los decimales, 1e-400 o 0,1234567… valdrían aquí y la app los vería de otra forma; con 4, la base y la
-- app, analisisValido(), dicen lo mismo de lo que manda la app.)
create or replace function public.analisis_num(x jsonb, lo numeric, hi numeric) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(x) = 'number'
    and (case when jsonb_typeof(x) = 'number' then (x #>> '{}')::numeric end) between lo and hi
    and (case when jsonb_typeof(x) = 'number' then scale((x #>> '{}')::numeric) end) <= 4, false)
$$;

-- { "v": 1, "barra"?: { "p": [2..900 × [t, x, y]] }, "cal"?: { "cm", "px", "w", "h" },
--   "reps"?: [1..30 × { "t": [ini, abajo, arriba], "dc"?, "vm"?, "vp"?, "rom"? }],
--   "pose"?: { "lado": "izq" | "der", "reps": [1..30 × { "t": [desde, hasta], "rodilla"?, "cadera"?, "tronco"?, "codo"? }] } }
-- Con la barra o la pose (o las dos); las repeticiones de la velocidad, solo con la barra. Cada número, con 4 decimales
-- como mucho (analisis_num). Los momentos, de 0 a 3600 s (la
-- duración del vídeo la mira el trigger). La trayectoria, con los momentos en orden; las repeticiones, por su «abajo».
-- (Cada conversión, después de mirar el tipo, en su propia sentencia: no depende del orden en que se evalúa un «or». Y,
-- por si acaso, cualquier error da false.)
create or replace function public.analisis_valido(j jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  b jsonb; p jsonb; c jsonb; r jsonb; ps jsonb;
  v_prev numeric; v numeric; n integer; i integer; k text;
begin
  if j is null then return false; end if;
  if jsonb_typeof(j) <> 'object' then return false; end if;
  if octet_length(j::text) > 65536 then return false; end if;
  if exists (select 1 from jsonb_object_keys(j) x where x not in ('v', 'barra', 'cal', 'reps', 'pose')) then return false; end if;
  if not public.analisis_num(j -> 'v', 1, 1) then return false; end if;
  if not (j ? 'barra' or j ? 'pose') then return false; end if;
  if j ? 'reps' and not j ? 'barra' then return false; end if;

  -- La trayectoria de la barra
  if j ? 'barra' then
    b := j -> 'barra';
    if jsonb_typeof(b) <> 'object' then return false; end if;
    if exists (select 1 from jsonb_object_keys(b) x where x <> 'p') then return false; end if;
    if coalesce(jsonb_typeof(b -> 'p'), '') <> 'array' then return false; end if;
    n := jsonb_array_length(b -> 'p');
    if n < 2 or n > 900 then return false; end if;
    v_prev := -1;
    for p in select e from jsonb_array_elements(b -> 'p') e loop
      if jsonb_typeof(p) <> 'array' then return false; end if;
      if jsonb_array_length(p) <> 3 then return false; end if;
      if not public.analisis_num(p -> 0, 0, 3600) then return false; end if;
      if not public.analisis_num(p -> 1, 0, 1) then return false; end if;
      if not public.analisis_num(p -> 2, 0, 1) then return false; end if;
      v := (p ->> 0)::numeric;
      if v <= v_prev then return false; end if;
      v_prev := v;
    end loop;
  end if;

  -- La calibración (las cuatro, siempre)
  if j ? 'cal' then
    c := j -> 'cal';
    if jsonb_typeof(c) <> 'object' then return false; end if;
    if exists (select 1 from jsonb_object_keys(c) x where x not in ('cm', 'px', 'w', 'h')) then return false; end if;
    if (select count(*) from jsonb_object_keys(c)) <> 4 then return false; end if;
    if not public.analisis_num(c -> 'cm', 10, 60) then return false; end if;
    if not public.analisis_num(c -> 'px', 0, 10000) then return false; end if;
    if (c ->> 'px')::numeric <= 0 then return false; end if;
    foreach k in array array['w', 'h'] loop
      if not public.analisis_num(c -> k, 1, 10000) then return false; end if;
      if (c ->> k)::numeric <> trunc((c ->> k)::numeric) then return false; end if;
    end loop;
  end if;

  -- Las repeticiones (de la velocidad)
  if j ? 'reps' then
    if coalesce(jsonb_typeof(j -> 'reps'), '') <> 'array' then return false; end if;
    n := jsonb_array_length(j -> 'reps');
    if n < 1 or n > 30 then return false; end if;
    v_prev := -1;
    for r in select e from jsonb_array_elements(j -> 'reps') e loop
      if jsonb_typeof(r) <> 'object' then return false; end if;
      if exists (select 1 from jsonb_object_keys(r) x where x not in ('t', 'dc', 'vm', 'vp', 'rom')) then return false; end if;
      if coalesce(jsonb_typeof(r -> 't'), '') <> 'array' then return false; end if;
      if jsonb_array_length(r -> 't') <> 3 then return false; end if;
      for i in 0..2 loop
        if not public.analisis_num(r -> 't' -> i, 0, 3600) then return false; end if;
      end loop;
      if (r -> 't' ->> 0)::numeric > (r -> 't' ->> 1)::numeric then return false; end if;
      if (r -> 't' ->> 1)::numeric > (r -> 't' ->> 2)::numeric then return false; end if;
      if (r -> 't' ->> 1)::numeric <= v_prev then return false; end if;
      v_prev := (r -> 't' ->> 1)::numeric;
      if r ? 'dc' and not public.analisis_num(r -> 'dc', 0, 60) then return false; end if;
      if r ? 'vm' and not public.analisis_num(r -> 'vm', 0, 3) then return false; end if;
      if r ? 'vp' and not public.analisis_num(r -> 'vp', 0, 3) then return false; end if;
      if r ? 'rom' and not public.analisis_num(r -> 'rom', 0, 150) then return false; end if;
    end loop;
  end if;

  -- Los puntos del cuerpo: solo el resumen por repetición
  if j ? 'pose' then
    ps := j -> 'pose';
    if jsonb_typeof(ps) <> 'object' then return false; end if;
    if exists (select 1 from jsonb_object_keys(ps) x where x not in ('lado', 'reps')) then return false; end if;
    if coalesce(jsonb_typeof(ps -> 'lado'), '') <> 'string' then return false; end if;
    if (ps ->> 'lado') not in ('izq', 'der') then return false; end if;
    if coalesce(jsonb_typeof(ps -> 'reps'), '') <> 'array' then return false; end if;
    n := jsonb_array_length(ps -> 'reps');
    if n < 1 or n > 30 then return false; end if;
    v_prev := -1;
    for r in select e from jsonb_array_elements(ps -> 'reps') e loop
      if jsonb_typeof(r) <> 'object' then return false; end if;
      if exists (select 1 from jsonb_object_keys(r) x where x not in ('t', 'rodilla', 'cadera', 'tronco', 'codo')) then return false; end if;
      if not exists (select 1 from jsonb_object_keys(r) x where x in ('rodilla', 'cadera', 'tronco', 'codo')) then return false; end if;
      if coalesce(jsonb_typeof(r -> 't'), '') <> 'array' then return false; end if;
      if jsonb_array_length(r -> 't') <> 2 then return false; end if;
      if not public.analisis_num(r -> 't' -> 0, 0, 3600) then return false; end if;
      if not public.analisis_num(r -> 't' -> 1, 0, 3600) then return false; end if;
      if (r -> 't' ->> 0)::numeric > (r -> 't' ->> 1)::numeric then return false; end if;
      if (r -> 't' ->> 0)::numeric < v_prev then return false; end if;
      v_prev := (r -> 't' ->> 0)::numeric;
      foreach k in array array['rodilla', 'cadera', 'tronco', 'codo'] loop
        if r ? k and not public.analisis_num(r -> k, 0, 180) then return false; end if;
      end loop;
    end loop;
  end if;
  return true;
exception when others then
  return false;
end $$;

alter table public.video_revisiones drop constraint if exists video_revisiones_analisis_valido;
alter table public.video_revisiones add constraint video_revisiones_analisis_valido
  check (analisis is null or public.analisis_valido(analisis));

-- ---------------------------------------------------------------------
-- 2. La corrección (035), con el análisis: dentro del vídeo, y guardarlo cuenta como corregir
-- ---------------------------------------------------------------------
create or replace function public.video_revision_preparar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  a public.archivos;
  v_dur numeric;
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_max numeric;
begin
  if tg_op = 'UPDATE' and new.archivo_id is distinct from old.archivo_id then
    raise exception 'Una corrección no cambia de vídeo' using errcode = '42501';
  end if;
  select * into a from public.archivos x where x.id = new.archivo_id;
  if a.id is null or a.tipo <> 'video_tecnica' then
    raise exception 'Solo se corrige un vídeo de técnica' using errcode = '22023';
  end if;
  new.atleta_id := a.atleta_id;
  v_dur := coalesce(a.duracion_seg, 3599) + 1;
  -- (mal formado, lo rechaza después la restricción: aquí no se lee)
  if new.tempo is not null and public.tempo_valido(new.tempo) then
    select max((x #>> '{}')::numeric) into v_max from jsonb_array_elements(new.tempo -> 'reps') r, jsonb_array_elements(r) x;
    if v_max > v_dur then raise exception 'El tempo se sale del vídeo' using errcode = '22023'; end if;
  end if;
  -- (036) el análisis, dentro del vídeo: la trayectoria, las repeticiones y las de la pose
  if new.analisis is not null and public.analisis_valido(new.analisis) then
    select max(x) into v_max from (
      select (p ->> 0)::numeric x from jsonb_array_elements(case when new.analisis ? 'barra' then new.analisis -> 'barra' -> 'p' else '[]'::jsonb end) p
      union all
      select (r -> 't' ->> 2)::numeric from jsonb_array_elements(case when new.analisis ? 'reps' then new.analisis -> 'reps' else '[]'::jsonb end) r
      union all
      select (r -> 't' ->> 1)::numeric from jsonb_array_elements(case when new.analisis ? 'pose' then new.analisis -> 'pose' -> 'reps' else '[]'::jsonb end) r
    ) s;
    if v_max > v_dur then raise exception 'El análisis se sale del vídeo' using errcode = '22023'; end if;
  end if;
  if new.voz_archivo_id is null then
    new.voz_inicio := null;
  elsif tg_op = 'INSERT' or new.voz_archivo_id is distinct from old.voz_archivo_id then
    if not exists (select 1 from public.archivos v where v.id = new.voz_archivo_id and v.tipo = 'audio'
                   and v.atleta_id = a.atleta_id and v.subido_por = 'coach') then
      raise exception 'La voz tiene que ser una nota de voz tuya para este atleta' using errcode = '42501';
    end if;
    if public.archivo_con_mensajes(new.voz_archivo_id) then
      raise exception 'Esa nota de voz ya está en el chat: graba la voz para el vídeo' using errcode = '42501';
    end if;
  end if;
  if new.voz_archivo_id is not null then
    new.voz_inicio := coalesce(new.voz_inicio, 0);
    if new.voz_inicio > v_dur then raise exception 'La voz empieza después de que acabe el vídeo' using errcode = '22023'; end if;
  end if;
  if tg_op = 'INSERT' then
    new.visto_el := case when new.visto_el is not null then v_hoy end;
    new.corregido_en := null;
  else
    new.visto_el := case when old.visto_el is not null then old.visto_el when new.visto_el is not null then v_hoy end;
    new.corregido_en := old.corregido_en;
  end if;
  if new.corregido_en is null and (new.puntuacion is not null or new.checklist is not null or new.tempo is not null or new.voz_archivo_id is not null
                                   or new.analisis is not null) then
    new.corregido_en := now();
  end if;
  if tg_op = 'UPDATE' and (new.puntuacion, new.checklist, new.tempo, new.voz_archivo_id, new.voz_inicio, new.analisis)
                          is not distinct from (old.puntuacion, old.checklist, old.tempo, old.voz_archivo_id, old.voz_inicio, old.analisis) then
    new.actualizado_en := old.actualizado_en;
  else
    new.actualizado_en := now();
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. Lo que lee el atleta: video_correcciones() (035) devuelve también el análisis
-- ---------------------------------------------------------------------
-- (Cambia lo que devuelve: hay que borrarla y crearla otra vez; sus permisos, al final, como en la 035)
drop function if exists public.video_correcciones(uuid[]);
create function public.video_correcciones(p_archivos uuid[])
returns table (archivo_id uuid, atleta_id uuid, puntuacion smallint, checklist jsonb, tempo jsonb, voz_archivo_id uuid, voz_inicio numeric,
               visto_el date, corregido_el date, analisis jsonb)
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
           (r.corregido_en at time zone 'Europe/Madrid')::date, r.analisis
    from public.video_revisiones r
    where r.archivo_id = any(p_archivos) and (v_coach or r.atleta_id = v_atleta);
end $$;

-- ---------------------------------------------------------------------
-- 4. Permisos (como al final de 003 a 035)
-- ---------------------------------------------------------------------
-- La tabla no cambia de dueño ni de políticas: el coach, todo (coach_todo, 035); el atleta, nada de la tabla
revoke all on public.video_revisiones from public, anon, authenticated;
grant select, insert, update, delete on public.video_revisiones to authenticated;

revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (36)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
