-- =====================================================================
-- FBE Equipo, migración 035 (v0.57): los vídeos de técnica, mucho mejores
--   · El vídeo, con su serie: archivos.serie_numero (de 1 a 30, solo en un vídeo de técnica y con su ejercicio de la
--     sesión, que tiene que ser de ese mismo atleta). Así el coach y el atleta ven «60 kg × 8 @8» encima del vídeo.
--   · «Grabar de nuevo con la corrección»: archivos.repite_de, el vídeo que se repite (del mismo atleta, de técnica y
--     nunca él mismo). Si el original se borra, se queda suelto.
--   · Dibujos (012) con más herramientas: flecha, círculo, lápiz y texto (hasta 40 letras), cinco colores y visibles
--     durante un tramo (de «t» a «hasta»); como mucho 24 formas. Los de antes siguen valiendo tal cual.
--   · La corrección del vídeo (video_revisiones, una por vídeo, solo la escribe el coach; el atleta lee la suya): nota
--     de técnica de 1 a 5, la lista de puntos clave (✓/✗/–, cada uno con su momento si se quiere), el tempo de cada
--     repetición (bajada, abajo y fin de la subida, en orden y dentro del vídeo), la voz del coach sobre el vídeo (una
--     nota de voz de las de la 034, de ese atleta, subida por el coach y que no está en el chat, con el momento en que
--     empieza) y «Visto» (el día, nunca la hora: lo pone video_visto(), solo el coach, una vez). El atleta no lee la
--     tabla (lleva horas, que son solo para el coach): lee la suya con video_correcciones(), con días. Al corregirlo por
--     primera vez, al atleta le llega un aviso (sin texto) que lleva a ese momento del vídeo (#videos/<id>@<segundos>);
--     la respuesta del coach en el hilo de un vídeo, también. Si el coach pasa el vídeo a otro atleta, su corrección va
--     con él (sin la voz).
--   · Las listas de puntos clave de cada ejercicio (tecnica_plantillas): solo el coach.
--   · El fotograma de un vídeo que el coach manda al chat (archivos.derivado_de): solo para ese atleta; no se reenvía ni
--     se difunde.
--   · Un vídeo con un dibujo en su hilo ya se puede borrar (el dibujo se quita antes: sin su vídeo no valía).
--   · Limpieza: videos_limpieza() enseña y videos_limpiar() borra los vídeos de técnica de más de N meses (desde que
--     llegaron) ya revisados o corregidos que no están destacados, ni tienen conversación o corrección de los últimos N
--     días (al menos 7), ni son de una tarea por revisar (sus archivos van a la cola de Storage, como siempre). Solo el
--     coach. El día de un archivo del atleta, como mucho mañana.
-- Se ejecuta en el SQL Editor después de la 034 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 35 then
    raise exception 'Esta base ya tiene la migración %: repetir la 035 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 35;» y, después de ella, todas las siguientes en orden, todo en la misma consulta del SQL Editor (una sola transacción).';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 34) then
    raise exception 'Antes de la 035 hace falta la 034: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. El vídeo con su serie y la repetición de un vídeo corregido
-- ---------------------------------------------------------------------
alter table public.archivos add column if not exists serie_numero smallint;
alter table public.archivos add column if not exists repite_de uuid references public.archivos(id) on delete set null;
create index if not exists archivos_repite_idx on public.archivos (repite_de) where repite_de is not null;

alter table public.archivos drop constraint if exists archivos_serie_valida;
alter table public.archivos add constraint archivos_serie_valida
  check (serie_numero is null or (tipo = 'video_tecnica' and serie_numero between 1 and 30)) not valid;
alter table public.archivos drop constraint if exists archivos_repite_valida;
alter table public.archivos add constraint archivos_repite_valida
  check (repite_de is null or (tipo = 'video_tecnica' and repite_de <> id)) not valid;

-- El fotograma de un vídeo que el coach manda al chat de su atleta (con su dibujo): archivos.derivado_de, el vídeo del que
-- sale. Lo pone la app del coach al enviarlo y la base lo comprueba (una foto del chat del coach, de un vídeo de técnica de
-- ese mismo atleta); después no lo cambia ni lo quita nadie, y algo que lo lleva no se reenvía ni se difunde (es del
-- atleta). Sin clave ajena a propósito: si el vídeo se borra, el fotograma sigue siendo de ese atleta.
alter table public.archivos add column if not exists derivado_de uuid;
alter table public.archivos drop constraint if exists archivos_derivado_valido;
alter table public.archivos add constraint archivos_derivado_valido
  check (derivado_de is null or (tipo = 'adjunto' and mime like 'image/%' and derivado_de <> id)) not valid;

-- La serie, de un ejercicio de una sesión de ese mismo atleta; la repetición, de un vídeo de técnica suyo. Si su ejercicio
-- de la sesión se borra (queda en null), la serie se va con él. Si el coach pasa el vídeo a otro atleta, la serie y la
-- repetición que no son de ese atleta se quitan (no se pasa nada del primero). El día de un archivo del atleta, como mucho
-- mañana en Madrid (un vídeo pendiente que sale al día siguiente conserva su día; uno del futuro, no). El fotograma: arriba.
-- (Con los permisos de quien escribe, no del dueño: así current_user dice si viene de la app; solo lee lo que ya ve)
create or replace function public.archivo_enlaces() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_app boolean := current_user in ('authenticated', 'anon');
  v_mueve boolean := tg_op = 'UPDATE' and new.atleta_id is distinct from old.atleta_id;
begin
  if tg_op = 'INSERT' and v_app and not public.es_coach() and new.fecha > (now() at time zone 'Europe/Madrid')::date + 1 then
    new.fecha := (now() at time zone 'Europe/Madrid')::date + 1;
  end if;
  if new.sesion_ejercicio_id is null then new.serie_numero := null; end if;
  if new.serie_numero is not null and (tg_op = 'INSERT' or new.serie_numero is distinct from old.serie_numero
      or new.sesion_ejercicio_id is distinct from old.sesion_ejercicio_id or v_mueve) then
    if public.atleta_de_sesion((select se.sesion_id from public.sesion_ejercicios se where se.id = new.sesion_ejercicio_id)) is distinct from new.atleta_id then
      if v_mueve and new.serie_numero is not distinct from old.serie_numero and new.sesion_ejercicio_id is not distinct from old.sesion_ejercicio_id then
        new.serie_numero := null;
      else
        raise exception 'Esa serie no es de este atleta' using errcode = '42501';
      end if;
    end if;
  end if;
  if new.repite_de is not null and (tg_op = 'INSERT' or new.repite_de is distinct from old.repite_de or v_mueve) then
    if not exists (select 1 from public.archivos a where a.id = new.repite_de and a.atleta_id = new.atleta_id and a.tipo = 'video_tecnica' and a.id <> new.id) then
      if v_mueve and new.repite_de is not distinct from old.repite_de then
        new.repite_de := null;
      else
        raise exception 'Solo se repite un vídeo de técnica tuyo' using errcode = '42501';
      end if;
    end if;
  end if;
  if tg_op = 'INSERT' then
    if new.derivado_de is not null then
      if v_app and not public.es_coach() then
        raise exception 'Solo el coach manda un fotograma de un vídeo' using errcode = '42501';
      end if;
      if not exists (select 1 from public.archivos v where v.id = new.derivado_de and v.tipo = 'video_tecnica' and v.atleta_id = new.atleta_id) then
        raise exception 'El fotograma tiene que ser de un vídeo de técnica de este atleta' using errcode = '42501';
      end if;
    end if;
  elsif v_app and new.derivado_de is distinct from old.derivado_de then
    raise exception 'No se cambia de qué vídeo sale un fotograma' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists archivos_ab_enlaces on public.archivos;
create trigger archivos_ab_enlaces before insert or update of serie_numero, sesion_ejercicio_id, repite_de, atleta_id, derivado_de on public.archivos
  for each row execute function public.archivo_enlaces();

-- El coach pasa un vídeo a otro atleta: su corrección va con él (el primero ya no la ve), sin la voz del coach (era una
-- nota de voz del primero: se borra), las repeticiones del primero se quedan sueltas y su aviso aún sin salir se retira
create or replace function fbe_privado.al_mover_archivo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.atleta_id is not distinct from old.atleta_id then return null; end if;
  update public.video_revisiones r set atleta_id = new.atleta_id, voz_archivo_id = null where r.archivo_id = new.id;
  update public.archivos x set repite_de = null where x.repite_de = new.id and x.atleta_id <> new.atleta_id;
  delete from public.notificaciones n where n.clave in ('video:' || old.id, 'archivo:' || old.id) and n.estado = 'pendiente';
  return null;
end $$;
drop trigger if exists archivos_zz_mover on public.archivos;
create trigger archivos_zz_mover after update of atleta_id on public.archivos
  for each row execute function fbe_privado.al_mover_archivo();

-- (014, 033, 034) De un archivo, el atleta solo cambia el pie, el ejercicio y si está destacado (ni la onda de una nota de
-- voz, ni su serie, ni el vídeo que repite: eso va al subirlo). Quién lo subió no lo cambia nadie.
create or replace function public.archivo_proteger_cambios() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and new.subido_por is distinct from old.subido_por then
    raise exception 'No se cambia quién subió un archivo' using errcode = '42501';
  end if;
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    if (new.id, new.atleta_id, new.tipo, new.ruta, new.sesion_ejercicio_id, new.fecha, new.comentario_coach,
        new.creado_en, new.mime, new.bytes, new.revisado_en, new.duracion_seg, new.pose, new.nombre, new.paginas, new.onda, new.serie_numero)
       is distinct from
       (old.id, old.atleta_id, old.tipo, old.ruta, old.sesion_ejercicio_id, old.fecha, old.comentario_coach,
        old.creado_en, old.mime, old.bytes, old.revisado_en, old.duracion_seg, old.pose, old.nombre, old.paginas, old.onda, old.serie_numero)
       or (new.poster_ruta is not null and new.poster_ruta is distinct from old.poster_ruta)
       or (new.repite_de is not null and new.repite_de is distinct from old.repite_de) then
      raise exception 'De un archivo solo puedes cambiar el pie, el ejercicio y si está destacado' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. Dibujos (012) con más herramientas, colores y un tramo
-- ---------------------------------------------------------------------
-- { "t": s, "hasta"?: s (más que t, hasta 3600), "formas": [1..24] }; cada forma { "tipo", "p": puntos [x,y] de 0 a 1,
-- "c"?: color, "x"?: texto (solo en «texto», de 1 a 40 letras visibles) }: línea, flecha y círculo (centro y borde),
-- 2 puntos; ángulo, 3 (vértice y extremos); lápiz, de 2 a 80; texto, 1.
-- (Con una clave que falte, jsonb_typeof da null: por eso los coalesce, para que el resultado sea false y no null. Nada
-- depende del orden en que se evalúan los «and»: cada conversión a número, cada lista de claves y cada longitud va dentro
-- de un case que antes mira el tipo, así que algo mal formado da false y nunca un error)
create or replace function public.dibujo_valido(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(j) = 'object'
    and not exists (select 1 from jsonb_object_keys(case when jsonb_typeof(j) = 'object' then j else '{}'::jsonb end) k where k not in ('t', 'hasta', 'formas'))
    and coalesce((case when jsonb_typeof(j -> 't') = 'number' then (j ->> 't')::numeric end) >= 0
                 and (case when jsonb_typeof(j -> 't') = 'number' then (j ->> 't')::numeric end) < 3600, false)
    and (case when not (j ? 'hasta') then true
              when jsonb_typeof(j -> 'hasta') = 'number' and jsonb_typeof(j -> 't') = 'number'
                then (j ->> 'hasta')::numeric > (j ->> 't')::numeric and (j ->> 'hasta')::numeric <= 3600
              else false end)
    and coalesce(jsonb_typeof(j -> 'formas'), '') = 'array'
    and (case when jsonb_typeof(j -> 'formas') = 'array' then jsonb_array_length(j -> 'formas') else 0 end) between 1 and 24
    and not exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(j -> 'formas') = 'array' then j -> 'formas' else '[]'::jsonb end) f
      where jsonb_typeof(f) <> 'object'
         or exists (select 1 from jsonb_object_keys(case when jsonb_typeof(f) = 'object' then f else '{}'::jsonb end) k where k not in ('tipo', 'p', 'c', 'x'))
         or coalesce(f ->> 'tipo', '') not in ('linea', 'angulo', 'flecha', 'circulo', 'lapiz', 'texto')
         or coalesce(jsonb_typeof(f -> 'tipo'), '') <> 'string'
         or (f ? 'c' and (coalesce(jsonb_typeof(f -> 'c'), '') <> 'string' or coalesce(f ->> 'c', '') not in ('morado', 'amarillo', 'cian', 'rojo', 'blanco')))
         or ((coalesce(f ->> 'tipo', '') = 'texto') <> (f ? 'x'))
         or (f ? 'x' and (case when jsonb_typeof(f -> 'x') = 'string'
                               then char_length(f ->> 'x') not between 1 and 40 or not coalesce(public.texto_visible(f ->> 'x'), false)
                               else true end))
         or coalesce(jsonb_typeof(f -> 'p'), '') <> 'array'
         or (case when jsonb_typeof(f -> 'p') = 'array' then jsonb_array_length(f -> 'p') else -1 end)
            not between (case f ->> 'tipo' when 'angulo' then 3 when 'texto' then 1 else 2 end)
                    and (case f ->> 'tipo' when 'angulo' then 3 when 'texto' then 1 when 'lapiz' then 80 else 2 end)
         or exists (
           select 1 from jsonb_array_elements(case when jsonb_typeof(f -> 'p') = 'array' then f -> 'p' else '[]'::jsonb end) pt
           where jsonb_typeof(pt) <> 'array' or (case when jsonb_typeof(pt) = 'array' then jsonb_array_length(pt) else 0 end) <> 2
              or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(pt) = 'array' then pt else '[]'::jsonb end) c
                         where jsonb_typeof(c) <> 'number' or (case when jsonb_typeof(c) = 'number' then (c #>> '{}')::numeric end) not between 0 and 1)
         )
    ), false)
$$;

-- Al borrar un vídeo, sus comentarios se quedan (sin el vídeo: 003), pero un dibujo sin su vídeo no vale (012): se quita
-- antes. (Hasta ahora, un vídeo con un dibujo del coach no se podía borrar.)
create or replace function fbe_privado.al_borrar_video_dibujos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.comentarios c set dibujo = null where c.archivo_id = old.id and c.dibujo is not null;
  return old;
end $$;
drop trigger if exists archivos_ab_dibujos on public.archivos;
create trigger archivos_ab_dibujos before delete on public.archivos
  for each row execute function fbe_privado.al_borrar_video_dibujos();

-- ---------------------------------------------------------------------
-- 3. La corrección de cada vídeo (solo el coach la escribe; el atleta lee la suya)
-- ---------------------------------------------------------------------
create table if not exists public.video_revisiones (
  archivo_id      uuid primary key references public.archivos(id) on delete cascade,
  atleta_id       uuid not null references public.atletas(id) on delete cascade,
  puntuacion      smallint,
  checklist       jsonb,
  tempo           jsonb,
  voz_archivo_id  uuid references public.archivos(id) on delete set null,
  voz_inicio      numeric(7,2),
  visto_el        date,
  corregido_en    timestamptz,
  actualizado_en  timestamptz not null default now()
);
create index if not exists video_revisiones_atleta_idx on public.video_revisiones (atleta_id);
create unique index if not exists video_revisiones_voz_unica on public.video_revisiones (voz_archivo_id) where voz_archivo_id is not null;

-- Los puntos clave revisados: { "puntos": [1..15 × { "t": texto (1-120), "e": "bien" | "mal" | "na", "s"?: segundo }] }
create or replace function public.checklist_valido(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(j) = 'object'
    and not exists (select 1 from jsonb_object_keys(case when jsonb_typeof(j) = 'object' then j else '{}'::jsonb end) k where k <> 'puntos')
    and coalesce(jsonb_typeof(j -> 'puntos'), '') = 'array'
    and (case when jsonb_typeof(j -> 'puntos') = 'array' then jsonb_array_length(j -> 'puntos') else 0 end) between 1 and 15
    and not exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(j -> 'puntos') = 'array' then j -> 'puntos' else '[]'::jsonb end) p
      where jsonb_typeof(p) <> 'object'
         or exists (select 1 from jsonb_object_keys(case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end) k where k not in ('t', 'e', 's'))
         or coalesce(jsonb_typeof(p -> 't'), '') <> 'string' or char_length(coalesce(p ->> 't', '')) not between 1 and 120
         or not coalesce(public.texto_visible(p ->> 't'), false)
         or coalesce(jsonb_typeof(p -> 'e'), '') <> 'string' or coalesce(p ->> 'e', '') not in ('bien', 'mal', 'na')
         or (p ? 's' and coalesce((case when jsonb_typeof(p -> 's') = 'number' then (p ->> 's')::numeric end) not between 0 and 3600, true))
    ), false)
$$;
-- El tempo: { "reps": [1..30 × [inicio de la bajada, abajo, fin de la subida]] } en segundos, cada uno después del
-- anterior (y cada repetición después de la anterior), de 0 a 3600 (la duración del vídeo la mira el trigger)
create or replace function public.tempo_valido(j jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  r jsonb; x jsonb; v_prev numeric := -1; v numeric; n integer;
begin
  if j is null then return false; end if;
  if jsonb_typeof(j) <> 'object' then return false; end if;
  if exists (select 1 from jsonb_object_keys(j) k where k <> 'reps') then return false; end if;
  if coalesce(jsonb_typeof(j -> 'reps'), '') <> 'array' then return false; end if;
  n := jsonb_array_length(j -> 'reps');
  if n < 1 or n > 30 then return false; end if;
  for r in select e from jsonb_array_elements(j -> 'reps') e loop
    -- (cada comprobación, después de la del tipo: no depende del orden de un «or»)
    if jsonb_typeof(r) <> 'array' then return false; end if;
    if jsonb_array_length(r) <> 3 then return false; end if;
    for x in select e from jsonb_array_elements(r) e loop
      if jsonb_typeof(x) <> 'number' then return false; end if;
      v := (x #>> '{}')::numeric;
      if v < 0 or v > 3600 or v <= v_prev then return false; end if;
      v_prev := v;
    end loop;
    -- (la siguiente puede empezar justo donde acaba esta)
    v_prev := v_prev - 0.0001;
  end loop;
  return true;
end $$;

alter table public.video_revisiones drop constraint if exists video_revisiones_validas;
alter table public.video_revisiones add constraint video_revisiones_validas
  check ((puntuacion is null or puntuacion between 1 and 5)
         and (checklist is null or public.checklist_valido(checklist))
         and (tempo is null or public.tempo_valido(tempo))
         and (voz_inicio is null or (voz_inicio >= 0 and voz_inicio < 3600)));

-- Del vídeo de técnica que corrige (su atleta lo pone la base); el tempo, dentro del vídeo; la voz, una nota de voz de ese
-- atleta subida por el coach, que empieza dentro del vídeo y que no está en ningún mensaje ni comentario (si no, al borrar
-- el vídeo se iría también ese mensaje); «Visto», el día de hoy en Madrid (no se cambia por otro ni se quita);
-- «Corregido», la primera vez que lleva algo (nota, puntos, tempo o voz), con la hora de la base. actualizado_en, solo
-- cuando cambia la corrección (abrir el vídeo no la cambia: ni mueve esa fecha ni protege el vídeo de la limpieza).
-- (Las fechas con hora, solo para el coach: el atleta lee su corrección con video_correcciones(), con días)
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
  if new.corregido_en is null and (new.puntuacion is not null or new.checklist is not null or new.tempo is not null or new.voz_archivo_id is not null) then
    new.corregido_en := now();
  end if;
  if tg_op = 'UPDATE' and (new.puntuacion, new.checklist, new.tempo, new.voz_archivo_id, new.voz_inicio)
                          is not distinct from (old.puntuacion, old.checklist, old.tempo, old.voz_archivo_id, old.voz_inicio) then
    new.actualizado_en := old.actualizado_en;
  else
    new.actualizado_en := now();
  end if;
  return new;
end $$;
drop trigger if exists video_revisiones_aa_preparar on public.video_revisiones;
create trigger video_revisiones_aa_preparar before insert or update on public.video_revisiones
  for each row execute function public.video_revision_preparar();

-- La voz sobre el vídeo se va con su corrección (y la que se cambia por otra): su archivo, a la cola de Storage
create or replace function fbe_privado.video_revision_voz_suelta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.voz_archivo_id is not null then delete from public.archivos a where a.id = old.voz_archivo_id and a.tipo = 'audio'; end if;
    return old;
  end if;
  if old.voz_archivo_id is not null and old.voz_archivo_id is distinct from new.voz_archivo_id then
    delete from public.archivos a where a.id = old.voz_archivo_id and a.tipo = 'audio';
  end if;
  return null;
end $$;
drop trigger if exists video_revisiones_zz_voz on public.video_revisiones;
create trigger video_revisiones_zz_voz after update of voz_archivo_id or delete on public.video_revisiones
  for each row execute function fbe_privado.video_revision_voz_suelta();

-- ¿Es la voz de la corrección de un vídeo? (el atleta no la borra: es de su coach)
create or replace function public.archivo_es_voz_video(p_archivo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.video_revisiones r where r.voz_archivo_id = p_archivo)
$$;
drop policy if exists atleta_borrar on public.archivos;
create policy atleta_borrar on public.archivos for delete to authenticated
  using (atleta_id = public.mi_atleta_id() and (tipo not in ('adjunto', 'documento', 'audio') or not public.archivo_con_mensajes(id))
         and not public.archivo_es_voz_video(id));
-- Y al revés: la voz de un vídeo no va en un mensaje ni en un comentario (al borrar el vídeo, se borra)
create or replace function fbe_privado.comentario_sin_voz_video() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.archivo_id is not null and (tg_op = 'INSERT' or new.archivo_id is distinct from old.archivo_id)
     and public.archivo_es_voz_video(new.archivo_id) then
    raise exception 'Esa nota de voz es la voz de tu coach sobre un vídeo: no va en un mensaje' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists comentarios_ab_voz_video on public.comentarios;
create trigger comentarios_ab_voz_video before insert or update of archivo_id on public.comentarios
  for each row execute function fbe_privado.comentario_sin_voz_video();

-- «Visto por tu coach»: el coach abre el vídeo (solo el día; si ya lo había visto, no se toca nada: ni el día, ni la fila)
create or replace function public.video_visto(p_archivo uuid) returns date
language plpgsql security definer set search_path = '' as $$
declare
  a public.archivos;
  v date;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  select * into a from public.archivos x where x.id = p_archivo;
  if a.id is null or a.tipo <> 'video_tecnica' then return null; end if;
  select r.visto_el into v from public.video_revisiones r where r.archivo_id = a.id;
  if v is not null then return v; end if;
  insert into public.video_revisiones as r (archivo_id, atleta_id, visto_el) values (a.id, a.atleta_id, (now() at time zone 'Europe/Madrid')::date)
  on conflict (archivo_id) do update set visto_el = excluded.visto_el where r.visto_el is null
  returning r.visto_el into v;
  if v is null then select r.visto_el into v from public.video_revisiones r where r.archivo_id = a.id; end if;
  return v;
end $$;

-- La corrección de unos vídeos, como la lee la app (el atleta, la de los suyos; el coach, cualquiera): sin ninguna hora.
-- De «Visto» y de «Corregido», solo el día (en Madrid), muestre o no el coach cuándo está en línea; actualizado_en no
-- sale. (El atleta no lee la tabla: ahí están las horas, que son solo para el coach.) Como mucho 1000 vídeos por vez.
-- (v0.58) La 036 la amplía con el análisis: si se repite la 035 en una base que ya la tiene, se borra y se crea como aquí
-- (la 036, después, la vuelve a ampliar; sus permisos, al final)
drop function if exists public.video_correcciones(uuid[]);
create or replace function public.video_correcciones(p_archivos uuid[])
returns table (archivo_id uuid, atleta_id uuid, puntuacion smallint, checklist jsonb, tempo jsonb, voz_archivo_id uuid, voz_inicio numeric,
               visto_el date, corregido_el date)
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
           (r.corregido_en at time zone 'Europe/Madrid')::date
    from public.video_revisiones r
    where r.archivo_id = any(p_archivos) and (v_coach or r.atleta_id = v_atleta);
end $$;

-- ---------------------------------------------------------------------
-- 4. Los puntos clave de cada ejercicio (las listas del coach)
-- ---------------------------------------------------------------------
create table if not exists public.tecnica_plantillas (
  ejercicio_id    uuid primary key references public.ejercicios(id) on delete cascade,
  puntos          text[] not null,
  actualizado_en  timestamptz not null default now()
);
create or replace function public.puntos_tecnica_validos(p text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(cardinality(p) between 1 and 15
    and not exists (select 1 from unnest(p) x where x is null or char_length(btrim(x)) not between 1 and 120 or not coalesce(public.texto_visible(x), false)), false)
$$;
alter table public.tecnica_plantillas drop constraint if exists tecnica_plantillas_validas;
alter table public.tecnica_plantillas add constraint tecnica_plantillas_validas check (public.puntos_tecnica_validos(puntos));
create or replace function public.tecnica_plantilla_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.puntos := array(select btrim(x) from unnest(new.puntos) with ordinality u(x, i) order by i);
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists tecnica_plantillas_aa_preparar on public.tecnica_plantillas;
create trigger tecnica_plantillas_aa_preparar before insert or update on public.tecnica_plantillas
  for each row execute function public.tecnica_plantilla_preparar();

-- ---------------------------------------------------------------------
-- 5. Avisos: la corrección lleva a ese momento del vídeo (#videos/<id>@<segundos>), sin el texto
-- ---------------------------------------------------------------------
alter table public.notificaciones drop constraint if exists notificaciones_validas;
alter table public.notificaciones add constraint notificaciones_validas check (
  tipo in ('respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario',
           'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido', 'prueba', 'descanso', 'comunidad',
           'tarea', 'tarea_hecha')
  and char_length(titulo) between 1 and 80
  and (cuerpo is null or char_length(cuerpo) <= 160)
  and (url in ('#hoy', '#semana', '#checkin', '#progreso', '#perfil', '#atletas', '#revisar', '#cuenta', '#mensajes', '#equipo')
       or url ~ '^#mensajes/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or url ~ '^#videos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(@[0-9]{1,4}(\.[0-9])?)?$')
  and char_length(clave) between 1 and 100
  and estado in ('pendiente', 'enviando', 'enviada', 'caducada', 'fallida')
  and (canal is null or canal in ('push', 'email'))
  and intentos between 0 and 100
  and (error is null or char_length(error) <= 200)
) not valid;

-- El momento de una corrección: el de su dibujo o, si no, el primero que nombra («0:04», «0:01,5»; menos de 10 minutos)
create or replace function fbe_privado.momento_de_comentario(p_texto text, p_dibujo jsonb) returns numeric
language plpgsql immutable set search_path = '' as $$
declare m text[];
begin
  if p_dibujo is not null and jsonb_typeof(p_dibujo -> 't') = 'number' then
    return least(9999, greatest(0, round((p_dibujo ->> 't')::numeric, 1)));
  end if;
  m := regexp_match(coalesce(p_texto, ''), '(?:^|[^0-9:])([0-9]):([0-5][0-9])(?:[,.]([0-9]))?(?![0-9:])');
  if m is null then return null; end if;
  return m[1]::numeric * 60 + m[2]::numeric + coalesce(m[3]::numeric / 10, 0);
end $$;
create or replace function fbe_privado.enlace_video(p_archivo uuid, p_t numeric) returns text
language sql immutable set search_path = '' as $$
  select '#videos/' || p_archivo::text || case when p_t is null then '' else '@' || trim(to_char(least(9999, greatest(0, round(p_t, 1))), 'FM9999990.0')) end
$$;

-- La respuesta del coach en el hilo de un vídeo de técnica (al_comentar la manda a #hoy): a ese momento del vídeo
create or replace function fbe_privado.notificacion_video() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c public.comentarios;
begin
  if new.tipo <> 'respuesta' or new.url <> '#hoy' or new.clave !~ '^comentario:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return new; end if;
  select * into c from public.comentarios k where k.id = substr(new.clave, 12)::uuid;
  if c.id is null or c.archivo_id is null or coalesce(c.adjunto, false) then return new; end if;
  if not exists (select 1 from public.archivos a where a.id = c.archivo_id and a.tipo = 'video_tecnica') then return new; end if;
  new.url := fbe_privado.enlace_video(c.archivo_id, fbe_privado.momento_de_comentario(c.texto, c.dibujo));
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists notificaciones_ab_video on public.notificaciones;
create trigger notificaciones_ab_video before insert on public.notificaciones
  for each row execute function fbe_privado.notificacion_video();

-- La primera vez que el coach corrige un vídeo (nota, puntos, tempo o voz), al atleta: «Pelayo ha corregido tu vídeo»
-- (una vez por vídeo; sin nada de lo que dice), al primer momento que señala
create or replace function fbe_privado.al_corregir_video() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  a public.atletas;
  v_t numeric;
begin
  if new.corregido_en is null or (tg_op = 'UPDATE' and old.corregido_en is not null) then return null; end if;
  select * into a from public.atletas where id = new.atleta_id;
  if a.id is null or a.estado <> 'activo' then return null; end if;
  select min(x) into v_t from (
    select (case when jsonb_typeof(p -> 's') = 'number' then (p ->> 's')::numeric end) x
    from jsonb_array_elements(case when jsonb_typeof(new.checklist -> 'puntos') = 'array' then new.checklist -> 'puntos' else '[]'::jsonb end) p
    union all select new.voz_inicio
    union all select case when jsonb_typeof(new.tempo -> 'reps' -> 0 -> 0) = 'number' then (new.tempo -> 'reps' -> 0 ->> 0)::numeric end
  ) s;
  perform fbe_privado.notificar(a.perfil_id, 'respuesta',
    coalesce(fbe_privado.nombre_corto((select p.nombre from public.perfiles p where p.id = auth.uid())), 'Tu coach') || ' ha corregido tu vídeo',
    'En tu vídeo', fbe_privado.enlace_video(new.archivo_id, v_t), 'video:' || new.archivo_id);
  return null;
exception when others then
  raise warning 'FBE: aviso de la corrección del vídeo % no creado: %', new.archivo_id, sqlerrm;
  return null;
end $$;
drop trigger if exists video_revisiones_zz_avisar on public.video_revisiones;
create trigger video_revisiones_zz_avisar after insert or update on public.video_revisiones
  for each row execute function fbe_privado.al_corregir_video();
-- Un vídeo borrado antes de que salga su aviso de corrección ya no avisa (como los de «archivo:», 010)
drop trigger if exists archivos_zz_retirar_video on public.archivos;
create trigger archivos_zz_retirar_video after delete on public.archivos
  for each row when (old.tipo = 'video_tecnica') execute function fbe_privado.al_borrar_origen('video:');

-- ---------------------------------------------------------------------
-- 6. Limpieza de vídeos antiguos (solo el coach)
-- ---------------------------------------------------------------------
-- Los vídeos de técnica de más de p_meses meses que no están destacados, ni tienen un mensaje o una corrección de los
-- últimos p_dias días (al menos 7), ni son de una tarea por revisar, ni los repite un vídeo de esos días, ni esperan aún
-- en la cola del coach (sin revisar y sin corregir). Los meses cuentan desde que llegó a la base (creado_en, que pone la
-- base) y desde su día (fecha): tienen que haber pasado los dos, así que un día puesto a mano no lo adelanta. Abrir un
-- vídeo («Visto») no cuenta como corrección.
create or replace function fbe_privado.videos_viejos(p_meses integer, p_dias integer) returns setof public.archivos
language sql stable security definer set search_path = '' as $$
  select a.* from public.archivos a
  where a.tipo = 'video_tecnica' and not coalesce(a.destacado, false)
    and greatest(a.fecha, (a.creado_en at time zone 'Europe/Madrid')::date)
        < ((now() at time zone 'Europe/Madrid')::date - make_interval(months => p_meses))::date
    and (a.revisado_en is not null or exists (select 1 from public.video_revisiones r where r.archivo_id = a.id and r.corregido_en is not null))
    and not exists (select 1 from public.comentarios c where c.archivo_id = a.id and c.creado_en > now() - make_interval(days => p_dias))
    and not exists (select 1 from public.video_revisiones r where r.archivo_id = a.id and r.corregido_en is not null
                    and r.actualizado_en > now() - make_interval(days => p_dias))
    and not exists (select 1 from public.archivos n where n.repite_de = a.id and n.creado_en > now() - make_interval(days => p_dias))
    and not exists (select 1 from public.tareas t where t.archivo_id = a.id and t.revisada_en is null)
$$;
create or replace function public.videos_limpieza(p_meses integer, p_dias integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  if p_meses is null or p_meses not between 1 and 60 or coalesce(p_dias, -1) not between 7 and 365 then
    raise exception 'De 1 a 60 meses y de 7 a 365 días' using errcode = '22023';
  end if;
  return (select jsonb_build_object('n', count(*), 'bytes', coalesce(sum(coalesce(v.bytes, 0)), 0),
    'lista', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'atleta_id', w.atleta_id, 'fecha', w.fecha, 'bytes', w.bytes, 'ejercicio_id', w.ejercicio_id) order by w.fecha, w.id)
                       from (select * from fbe_privado.videos_viejos(p_meses, p_dias) order by fecha, id limit 300) w), '[]'::jsonb))
    from fbe_privado.videos_viejos(p_meses, p_dias) v);
end $$;
-- Borra los de p_ids que siguen cumpliéndolo (como mucho 300 de una vez); sus archivos van a la cola de Storage (lo vacía
-- la app del coach). Devuelve { n, bytes }.
create or replace function public.videos_limpiar(p_meses integer, p_dias integer, p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_n integer; v_bytes bigint;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  if p_meses is null or p_meses not between 1 and 60 or coalesce(p_dias, -1) not between 7 and 365 then
    raise exception 'De 1 a 60 meses y de 7 a 365 días' using errcode = '22023';
  end if;
  if p_ids is null or cardinality(p_ids) not between 1 and 300 then
    raise exception 'De 1 a 300 vídeos de una vez' using errcode = '22023';
  end if;
  with borrados as (
    delete from public.archivos a where a.id in (select v.id from fbe_privado.videos_viejos(p_meses, p_dias) v where v.id = any(p_ids))
    returning a.bytes
  ) select count(*), coalesce(sum(coalesce(bytes, 0)), 0) into v_n, v_bytes from borrados;
  return jsonb_build_object('n', v_n, 'bytes', v_bytes);
end $$;

-- ---------------------------------------------------------------------
-- 7. El fotograma de un vídeo de un atleta no se reenvía ni se difunde
-- ---------------------------------------------------------------------
-- (034) ¿Vale este archivo como la copia para p_atleta? Además, nunca un fotograma de un vídeo (035)
create or replace function fbe_privado.chat_copia_valida(p_archivo uuid, p_atleta uuid, p_tipo text, p_mime text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.archivos a
                 where a.id = p_archivo and a.atleta_id = p_atleta and a.tipo in ('adjunto', 'documento', 'audio') and a.subido_por = 'coach'
                   and a.tipo = coalesce(p_tipo, a.tipo) and a.mime is not distinct from coalesce(p_mime, a.mime)
                   and a.creado_en > now() - interval '1 hour' and a.derivado_de is null
                   and not exists (select 1 from public.comentarios c where c.archivo_id = a.id))
$$;

-- (034) Reenviar: tampoco el fotograma de un vídeo de un atleta (es suyo, como su vídeo)
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
    -- (035) Ni el fotograma de un vídeo de un atleta (lo subió el coach, pero sale de su vídeo)
    if a.derivado_de is not null then
      raise exception 'Un fotograma del vídeo de un atleta es solo suyo: no se reenvía' using errcode = '42501';
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
-- 8. Permisos (desde la 019, cada tabla nueva lleva los suyos a mano)
-- ---------------------------------------------------------------------
alter table public.video_revisiones enable row level security;
alter table public.tecnica_plantillas enable row level security;
-- La corrección: el coach, todo. El atleta no lee la tabla (lleva horas): la suya, con video_correcciones() (días)
drop policy if exists coach_todo on public.video_revisiones;
create policy coach_todo on public.video_revisiones for all to authenticated using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.video_revisiones;
-- Las listas de puntos clave: solo el coach
drop policy if exists coach_todo on public.tecnica_plantillas;
create policy coach_todo on public.tecnica_plantillas for all to authenticated using (public.es_coach()) with check (public.es_coach());

revoke all on public.video_revisiones, public.tecnica_plantillas from public, anon, authenticated;
grant select, insert, update, delete on public.video_revisiones, public.tecnica_plantillas to authenticated;

-- Permisos (como al final de 003 a 034)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (35)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
