-- =====================================================================
-- FBE Equipo, migración 037 (v0.59): los vídeos de técnica, tanda A
--   · Recordatorios de técnica (recordatorios_tecnica): el coach fija, de una corrección, un «Recuerda: …» (hasta 140
--     letras) para un atleta y un ejercicio, con el vídeo y el momento corregidos si quiere; como mucho 3 activos por
--     atleta y ejercicio. Solo el coach los escribe (y los quita o los cambia). El atleta lee los suyos activos con
--     recordatorios_activos(), sin ninguna hora (como video_correcciones, 035). Nunca los escribe.
--   · Frases de corrección (frases_correccion): las del coach, para un ejercicio o para todos (sin ejercicio), de hasta
--     140 letras y, si quiere, con un dibujo ya hecho (con la forma de dibujo_valido, 035). Solo el coach.
--   · Vídeos modelo (videos_modelo): la demostración del coach de cada ejercicio (como mucho 6 por ejercicio), en el bucket
--     «archivos», en modelos/<ejercicio>/modelo-….(mp4|mov|webm) y su miniatura (….jpg). Solo el coach los escribe. Los
--     atletas vinculados (no los de baja) los ven: la lista, con videos_modelo_de() (sin horas), y el vídeo, con una
--     política de Storage solo para esas rutas (fbe_modelos_ver: nunca otra cosa de modelos/ ni de nadie). Borrar uno
--     pone sus archivos en la cola de Storage (032), como cualquier archivo.
--   · La valoración del atleta antes de enviar un vídeo (video_autoevaluacion, una por vídeo): el esfuerzo (RPE de 6 a 10,
--     de medio en medio), «¿Qué notas tú?» (hasta 280 letras) y si nota alguna molestia (sí o no) y dónde. Es suya: la
--     escribe y la cambia él (de sus vídeos de técnica) mientras su coach no lo haya revisado ni corregido; el coach la
--     lee. Lo de la molestia es un dato de salud: como «¿cómo llegas hoy?» (005), sin su consentimiento de datos de salud
--     no se guarda. Con el cupo por hora del chat (032): 30 cambios por hora.
--   · Las marcas de repetición a mano del coach (video_revisiones.reps_manual, con reps_manual_validas(): de 1 a 30
--     momentos en orden y dentro del vídeo). Solo para el coach (no cuenta como corregir ni avisa).
--   · Pasar un vídeo a otro atleta (035): ahora también su hilo. Lo que escribió el atleta de antes se borra (son sus
--     palabras); lo del coach va con el vídeo (como su corrección), sin «leído» ni las reacciones y destacados del de
--     antes; sus avisos pendientes se retiran. Su valoración se borra; sus recordatorios van con él (activos solo si caben).
-- Se ejecuta en el SQL Editor después de la 036 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 37 then
    raise exception 'Esta base ya tiene la migración %: repetir la 037 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 37;» y, después de ella, todas las siguientes en orden, todo en la misma consulta del SQL Editor (una sola transacción).';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 36) then
    raise exception 'Antes de la 037 hace falta la 036: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Recordatorios de técnica (el coach los escribe; el atleta lee los suyos activos)
-- ---------------------------------------------------------------------
create table if not exists public.recordatorios_tecnica (
  id              uuid primary key default gen_random_uuid(),
  atleta_id       uuid not null references public.atletas(id) on delete cascade,
  ejercicio_id    uuid not null references public.ejercicios(id) on delete cascade,
  texto           text not null,
  archivo_id      uuid references public.archivos(id) on delete set null,
  segundo         numeric(7,2),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create index if not exists recordatorios_tecnica_atleta_idx on public.recordatorios_tecnica (atleta_id, ejercicio_id);
create index if not exists recordatorios_tecnica_archivo_idx on public.recordatorios_tecnica (archivo_id) where archivo_id is not null;
alter table public.recordatorios_tecnica drop constraint if exists recordatorios_tecnica_validos;
alter table public.recordatorios_tecnica add constraint recordatorios_tecnica_validos
  check (char_length(texto) between 1 and 140 and coalesce(public.texto_visible(texto), false)
         and (segundo is null or (archivo_id is not null and segundo >= 0 and segundo <= 3600)));

-- El texto, sin espacios de más; el vídeo, uno de técnica de ese atleta (si su vídeo se borra, se queda sin él y sin su
-- momento); como mucho 3 activos por atleta y ejercicio; no cambia de atleta ni de ejercicio desde la app (al pasar el
-- vídeo a otro atleta, lo mueve la base). Las fechas, de la base.
-- (Con los permisos de quien escribe: así current_user dice si viene de la app; solo lee lo que ya ve)
create or replace function public.recordatorio_preparar() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_app boolean := current_user in ('authenticated', 'anon');
  a public.archivos;
begin
  if tg_op = 'UPDATE' and v_app and (new.atleta_id is distinct from old.atleta_id or new.ejercicio_id is distinct from old.ejercicio_id) then
    raise exception 'Un recordatorio no cambia de atleta ni de ejercicio: fija otro' using errcode = '42501';
  end if;
  new.texto := btrim(regexp_replace(coalesce(new.texto, ''), '[[:space:]]+', ' ', 'g'));
  if new.archivo_id is null then
    -- (su vídeo se ha borrado: se queda sin él y sin su momento; un momento sin vídeo, si no, lo rechaza la restricción)
    if tg_op = 'UPDATE' and old.archivo_id is not null then new.segundo := null; end if;
  elsif tg_op = 'INSERT' or new.archivo_id is distinct from old.archivo_id or new.atleta_id is distinct from old.atleta_id then
    select * into a from public.archivos x where x.id = new.archivo_id;
    if a.id is null or a.tipo <> 'video_tecnica' or a.atleta_id <> new.atleta_id then
      raise exception 'El vídeo del recordatorio tiene que ser un vídeo de técnica de este atleta' using errcode = '42501';
    end if;
  end if;
  if new.activo and (tg_op = 'INSERT' or not old.activo or new.atleta_id is distinct from old.atleta_id or new.ejercicio_id is distinct from old.ejercicio_id) then
    -- (un atleta y un ejercicio a la vez: dos a la vez no se saltan el tope)
    perform pg_advisory_xact_lock(hashtext('fbe-recordatorio:' || new.atleta_id::text || ':' || new.ejercicio_id::text));
    if (select count(*) from public.recordatorios_tecnica r where r.atleta_id = new.atleta_id and r.ejercicio_id = new.ejercicio_id and r.activo and r.id <> new.id) >= 3 then
      raise exception 'Como mucho 3 recordatorios activos por ejercicio: quita alguno antes' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'INSERT' then new.creado_en := now(); else new.creado_en := old.creado_en; end if;
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists recordatorios_tecnica_aa_preparar on public.recordatorios_tecnica;
create trigger recordatorios_tecnica_aa_preparar before insert or update on public.recordatorios_tecnica
  for each row execute function public.recordatorio_preparar();

-- Los activos de un atleta, como los lee la app: el atleta, solo los suyos; el coach, los de cualquiera. Sin ninguna hora
-- (de cuándo cambió, solo el día en Madrid). El vídeo, solo si sigue siendo de ese atleta.
create or replace function public.recordatorios_activos(p_atleta uuid)
returns table (id uuid, ejercicio_id uuid, texto text, archivo_id uuid, segundo numeric, actualizado_el date)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_coach boolean := public.es_coach();
  v_atleta uuid := public.mi_atleta_id();
begin
  if auth.uid() is null or not (v_coach or v_atleta is not null) then
    raise exception 'Necesitas iniciar sesión' using errcode = '42501';
  end if;
  return query
    select r.id, r.ejercicio_id, r.texto,
           case when exists (select 1 from public.archivos a where a.id = r.archivo_id and a.atleta_id = r.atleta_id and a.tipo = 'video_tecnica') then r.archivo_id end,
           case when exists (select 1 from public.archivos a where a.id = r.archivo_id and a.atleta_id = r.atleta_id and a.tipo = 'video_tecnica') then r.segundo::numeric end,
           (r.actualizado_en at time zone 'Europe/Madrid')::date
    from public.recordatorios_tecnica r
    where r.activo and r.atleta_id = p_atleta and (v_coach or r.atleta_id = v_atleta)
    order by r.ejercicio_id, r.creado_en, r.id;
end $$;

-- ---------------------------------------------------------------------
-- 2. Frases de corrección (solo el coach)
-- ---------------------------------------------------------------------
create table if not exists public.frases_correccion (
  id            uuid primary key default gen_random_uuid(),
  ejercicio_id  uuid references public.ejercicios(id) on delete cascade,
  texto         text not null,
  dibujo        jsonb,
  orden         smallint not null default 0,
  creado_en     timestamptz not null default now()
);
create index if not exists frases_correccion_ejercicio_idx on public.frases_correccion (ejercicio_id, orden);
alter table public.frases_correccion drop constraint if exists frases_correccion_validas;
alter table public.frases_correccion add constraint frases_correccion_validas
  check (char_length(texto) between 1 and 140 and coalesce(public.texto_visible(texto), false)
         and orden between 0 and 999 and (dibujo is null or public.dibujo_valido(dibujo)));
-- El texto, sin espacios de más; como mucho 300 en total (y 40 por ejercicio)
create or replace function public.frase_preparar() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.texto := btrim(regexp_replace(coalesce(new.texto, ''), '[[:space:]]+', ' ', 'g'));
  if tg_op = 'INSERT' then
    new.creado_en := now();
    perform pg_advisory_xact_lock(hashtext('fbe-frases'));
    if (select count(*) from public.frases_correccion) >= 300 then
      raise exception 'Como mucho 300 frases: borra alguna antes' using errcode = '23514';
    end if;
    if (select count(*) from public.frases_correccion f where f.ejercicio_id is not distinct from new.ejercicio_id) >= 40 then
      raise exception 'Como mucho 40 frases por ejercicio: borra alguna antes' using errcode = '23514';
    end if;
  else
    new.creado_en := old.creado_en;
  end if;
  return new;
end $$;
drop trigger if exists frases_correccion_aa_preparar on public.frases_correccion;
create trigger frases_correccion_aa_preparar before insert or update on public.frases_correccion
  for each row execute function public.frase_preparar();

-- ---------------------------------------------------------------------
-- 3. Vídeos modelo del coach (los escribe él; los atletas vinculados, los ven)
-- ---------------------------------------------------------------------
create table if not exists public.videos_modelo (
  id            uuid primary key default gen_random_uuid(),
  ejercicio_id  uuid not null references public.ejercicios(id) on delete cascade,
  ruta          text not null,
  poster_ruta   text,
  duracion_seg  smallint,
  mime          text,
  bytes         bigint,
  angulo        text,
  orden         smallint not null default 0,
  creado_en     timestamptz not null default now()
);
create unique index if not exists videos_modelo_ruta_unica on public.videos_modelo (ruta);
create unique index if not exists videos_modelo_poster_unico on public.videos_modelo (poster_ruta) where poster_ruta is not null;
create index if not exists videos_modelo_ejercicio_idx on public.videos_modelo (ejercicio_id, orden);
alter table public.videos_modelo drop constraint if exists videos_modelo_validos;
alter table public.videos_modelo add constraint videos_modelo_validos
  check (ruta ~ ('^modelos/' || ejercicio_id::text || '/modelo-[A-Za-z0-9_-]{6,40}\.(mp4|mov|webm)$')
         and (poster_ruta is null or poster_ruta = ruta || '.jpg')
         and (duracion_seg is null or duracion_seg between 0 and 600)
         and (mime is null or mime in ('video/mp4', 'video/quicktime', 'video/webm'))
         and (bytes is null or bytes between 1 and 209715200)
         and (angulo is null or (char_length(angulo) between 1 and 40 and coalesce(public.texto_visible(angulo), false)))
         and orden between 0 and 99);
-- Como mucho 6 por ejercicio; una ruta que espera a borrarse de Storage no se vuelve a registrar (034); de uno ya subido
-- solo cambian el ángulo, el orden, la duración y quitar la miniatura (si no llegó a subirse)
create or replace function public.video_modelo_preparar() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.angulo := nullif(btrim(regexp_replace(coalesce(new.angulo, ''), '[[:space:]]+', ' ', 'g')), '');
  if tg_op = 'INSERT' then
    if public.ruta_por_borrar(new.ruta) or public.ruta_por_borrar(new.poster_ruta) then
      raise exception 'Esa ruta ya se usó para un archivo eliminado: no se puede volver a registrar' using errcode = '42501';
    end if;
    perform pg_advisory_xact_lock(hashtext('fbe-modelos:' || new.ejercicio_id::text));
    if (select count(*) from public.videos_modelo m where m.ejercicio_id = new.ejercicio_id) >= 6 then
      raise exception 'Como mucho 6 vídeos modelo por ejercicio: borra alguno antes' using errcode = '23514';
    end if;
    new.creado_en := now();
  else
    if (new.id, new.ejercicio_id, new.ruta, new.mime, new.bytes, new.creado_en) is distinct from (old.id, old.ejercicio_id, old.ruta, old.mime, old.bytes, old.creado_en)
       or (new.poster_ruta is not null and new.poster_ruta is distinct from old.poster_ruta) then
      raise exception 'De un vídeo modelo solo se cambian el ángulo, el orden y la duración' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists videos_modelo_aa_preparar on public.videos_modelo;
create trigger videos_modelo_aa_preparar before insert or update on public.videos_modelo
  for each row execute function public.video_modelo_preparar();
-- Al borrarlo (también si se borra su ejercicio), su vídeo y su miniatura, a la cola de Storage (la vacía la app del coach)
create or replace function fbe_privado.video_modelo_borrado() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into fbe_privado.storage_por_borrar (ruta, bucket) select r, 'archivos' from unnest(array[old.ruta, old.poster_ruta]) r where r is not null
    on conflict (ruta) do nothing;
  return old;
end $$;
drop trigger if exists videos_modelo_zz_cola on public.videos_modelo;
create trigger videos_modelo_zz_cola after delete on public.videos_modelo
  for each row execute function fbe_privado.video_modelo_borrado();

-- ¿Es esta ruta (o su miniatura) un vídeo modelo y quien llama un atleta vinculado (no de baja)? Para la política de
-- Storage: solo dice sí o no de esa ruta
create or replace function public.video_modelo_visible(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_ruta is not null and public.mi_atleta_id() is not null and not public.esta_de_baja()
    and exists (select 1 from public.videos_modelo m where m.ruta = p_ruta or m.poster_ruta = p_ruta)
$$;
drop policy if exists fbe_modelos_ver on storage.objects;
create policy fbe_modelos_ver on storage.objects for select to authenticated
  using (bucket_id = 'archivos' and (storage.foldername(name))[1] = 'modelos' and public.video_modelo_visible(name));

-- Los vídeos modelo de unos ejercicios, como los lee la app (el coach y los atletas vinculados que no están de baja), sin
-- ninguna hora. Como mucho 200 ejercicios por vez.
create or replace function public.videos_modelo_de(p_ejercicios uuid[])
returns table (id uuid, ejercicio_id uuid, ruta text, poster_ruta text, duracion_seg smallint, angulo text, orden smallint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_coach boolean := public.es_coach();
begin
  if auth.uid() is null or not (v_coach or public.mi_atleta_id() is not null) then
    raise exception 'Necesitas iniciar sesión' using errcode = '42501';
  end if;
  if p_ejercicios is null or cardinality(p_ejercicios) > 200 then
    raise exception 'De 0 a 200 ejercicios de una vez' using errcode = '22023';
  end if;
  if not v_coach and public.esta_de_baja() then return; end if;
  return query
    select m.id, m.ejercicio_id, m.ruta, m.poster_ruta, m.duracion_seg, m.angulo, m.orden
    from public.videos_modelo m
    where m.ejercicio_id = any(p_ejercicios)
    order by m.ejercicio_id, m.orden, m.creado_en, m.id;
end $$;

-- ---------------------------------------------------------------------
-- 4. La valoración del atleta antes de enviar un vídeo (suya; el coach la lee)
-- ---------------------------------------------------------------------
create table if not exists public.video_autoevaluacion (
  archivo_id      uuid primary key references public.archivos(id) on delete cascade,
  atleta_id       uuid not null references public.atletas(id) on delete cascade,
  rpe             numeric(3,1),
  nota            text,
  molestia        boolean,
  zona            text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create index if not exists video_autoevaluacion_atleta_idx on public.video_autoevaluacion (atleta_id);
alter table public.video_autoevaluacion drop constraint if exists video_autoevaluacion_valida;
alter table public.video_autoevaluacion add constraint video_autoevaluacion_valida
  check ((rpe is null or (rpe between 6 and 10 and rpe * 2 = trunc(rpe * 2)))
         and (nota is null or (char_length(nota) between 1 and 280 and coalesce(public.texto_visible(nota), false)))
         and (zona is null or (molestia is true and zona in ('cuello', 'hombro', 'codo', 'muneca_mano', 'espalda_alta', 'zona_lumbar', 'cadera', 'rodilla', 'tobillo_pie', 'otra')))
         and (rpe is not null or nota is not null or molestia is not null));

-- De un vídeo de técnica (su atleta lo pone la base). Desde la app, solo el propio atleta (no de baja), de un vídeo suyo
-- y mientras su coach no lo haya revisado ni corregido; lo de la molestia, con su consentimiento de datos de salud (como
-- 005); con su cupo por hora. Las fechas, de la base. (Lee la corrección, que el atleta no ve: con los permisos de su
-- dueño; quién escribe lo dice el rol de la sesión)
create or replace function public.video_autoevaluacion_preparar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_app boolean := coalesce(nullif(current_setting('role', true), ''), 'none') in ('authenticated', 'anon');
  a public.archivos;
begin
  if tg_op = 'UPDATE' and new.archivo_id is distinct from old.archivo_id then
    raise exception 'Una valoración no cambia de vídeo' using errcode = '42501';
  end if;
  select * into a from public.archivos x where x.id = new.archivo_id;
  if a.id is null or a.tipo <> 'video_tecnica' then
    raise exception 'Solo se valora un vídeo de técnica' using errcode = '22023';
  end if;
  new.atleta_id := a.atleta_id;
  new.nota := nullif(btrim(coalesce(new.nota, '')), '');
  if new.molestia is not true then new.zona := null; end if;
  if v_app then
    if auth.uid() is null or public.es_coach() then
      raise exception 'La valoración es del atleta: tú la lees' using errcode = '42501';
    end if;
    if a.atleta_id is distinct from public.mi_atleta_id() then
      raise exception 'Solo valoras tus vídeos' using errcode = '42501';
    end if;
    if public.esta_de_baja() then
      raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada' using errcode = '42501';
    end if;
    if a.revisado_en is not null or exists (select 1 from public.video_revisiones r where r.archivo_id = a.id and r.corregido_en is not null) then
      raise exception 'Tu coach ya ha revisado este vídeo: tu valoración ya no se cambia' using errcode = '42501';
    end if;
    if (new.molestia is not null or new.zona is not null)
       and (tg_op = 'INSERT' or (new.molestia, new.zona) is distinct from (old.molestia, old.zona))
       and not public.consentimiento_salud_de_atleta(a.atleta_id) then
      raise exception 'Para contar si notas alguna molestia hace falta tu consentimiento de datos de salud' using errcode = '42501';
    end if;
    perform fbe_privado.chat_gastar_cupo('autoevaluacion');
  end if;
  if tg_op = 'INSERT' then new.creado_en := now(); else new.creado_en := old.creado_en; end if;
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists video_autoevaluacion_aa_preparar on public.video_autoevaluacion;
create trigger video_autoevaluacion_aa_preparar before insert or update on public.video_autoevaluacion
  for each row execute function public.video_autoevaluacion_preparar();

-- (034) Los cupos por hora, con el de la valoración (30 cambios por hora, el atleta)
alter table public.chat_cupos drop constraint if exists chat_cupos_tipo_check;
alter table public.chat_cupos add constraint chat_cupos_tipo_check
  check (tipo in ('reaccion', 'destacar', 'edicion', 'eliminar', 'presencia', 'silenciar', 'reenviar', 'difusion', 'voto', 'encuesta', 'autoevaluacion'));
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
                                     when 'autoevaluacion' then 'Has cambiado muchas veces tu valoración en la última hora: espera un poco'
                                     else 'Has cambiado muchas veces «Mostrar cuándo estoy en línea»: espera un poco' end using errcode = '54000';
  end if;
  insert into public.chat_cupos (perfil_id, tipo) values (auth.uid(), p_tipo);
end $$;

-- ---------------------------------------------------------------------
-- 5. Las marcas de repetición a mano del coach (en la corrección; solo para él)
-- ---------------------------------------------------------------------
alter table public.video_revisiones add column if not exists reps_manual jsonb;
-- { "t": [1..30 × segundo] }, cada uno después del anterior, de 0 a 3600 y con 4 decimales como mucho (analisis_num,
-- 036). Algo mal formado da false, nunca un error.
create or replace function public.reps_manual_validas(j jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  x jsonb; v_prev numeric := -1; v numeric; n integer;
begin
  if j is null then return false; end if;
  if jsonb_typeof(j) <> 'object' then return false; end if;
  if exists (select 1 from jsonb_object_keys(j) k where k <> 't') then return false; end if;
  if coalesce(jsonb_typeof(j -> 't'), '') <> 'array' then return false; end if;
  n := jsonb_array_length(j -> 't');
  if n < 1 or n > 30 then return false; end if;
  for x in select e from jsonb_array_elements(j -> 't') e loop
    if not public.analisis_num(x, 0, 3600) then return false; end if;
    v := (x #>> '{}')::numeric;
    if v <= v_prev then return false; end if;
    v_prev := v;
  end loop;
  return true;
exception when others then
  return false;
end $$;
alter table public.video_revisiones drop constraint if exists video_revisiones_reps_validas;
alter table public.video_revisiones add constraint video_revisiones_reps_validas
  check (reps_manual is null or public.reps_manual_validas(reps_manual));
-- Dentro del vídeo (después de video_revision_preparar, que no cambia: «aa» va antes que «ab»)
create or replace function public.video_revision_reps() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_dur numeric; v_max numeric;
begin
  if new.reps_manual is null or not public.reps_manual_validas(new.reps_manual) then return new; end if;
  if tg_op = 'UPDATE' and new.reps_manual is not distinct from old.reps_manual then return new; end if;
  select coalesce(a.duracion_seg, 3599) + 1 into v_dur from public.archivos a where a.id = new.archivo_id;
  select max((x #>> '{}')::numeric) into v_max from jsonb_array_elements(new.reps_manual -> 't') x;
  if v_max > coalesce(v_dur, 3600) then raise exception 'Las marcas de repetición se salen del vídeo' using errcode = '22023'; end if;
  return new;
end $$;
drop trigger if exists video_revisiones_ab_reps on public.video_revisiones;
create trigger video_revisiones_ab_reps before insert or update on public.video_revisiones
  for each row execute function public.video_revision_reps();

-- ---------------------------------------------------------------------
-- 6. Pasar un vídeo a otro atleta (035), también su hilo, su valoración y sus recordatorios
-- ---------------------------------------------------------------------
-- Su corrección va con él (sin la voz: era una nota de voz del primero), las repeticiones del primero se quedan sueltas y
-- sus avisos aún sin salir se retiran (035). (037) Del hilo del vídeo (no los adjuntos del chat): lo que escribió el
-- atleta de antes se borra (son sus palabras: no pueden pasar a ser de otro); lo del coach va con el vídeo, como su
-- corrección (sin «leído», «entregado» ni «escuchado», y sin las reacciones y los destacados del de antes); sus avisos
-- pendientes se retiran. La valoración del de antes se borra (es suya y lleva datos de salud). Los recordatorios que
-- enlazan ese vídeo van con él (activos solo si caben: 3 por ejercicio).
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
  -- El hilo
  select a.perfil_id into v_perfil from public.atletas a where a.id = old.atleta_id;
  select coalesce(array_agg(c.id), '{}'::uuid[]) into v_ids from public.comentarios c where c.archivo_id = new.id and not coalesce(c.adjunto, false);
  if cardinality(v_ids) > 0 then
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
-- 7. Permisos (desde la 019, cada tabla nueva lleva los suyos a mano)
-- ---------------------------------------------------------------------
alter table public.recordatorios_tecnica enable row level security;
alter table public.frases_correccion enable row level security;
alter table public.videos_modelo enable row level security;
alter table public.video_autoevaluacion enable row level security;
-- Recordatorios, frases y vídeos modelo: el coach, todo. El atleta, nada de las tablas: sus recordatorios activos, con
-- recordatorios_activos(); los vídeos modelo, con videos_modelo_de() y su política de Storage
drop policy if exists coach_todo on public.recordatorios_tecnica;
create policy coach_todo on public.recordatorios_tecnica for all to authenticated using (public.es_coach()) with check (public.es_coach());
drop policy if exists coach_todo on public.frases_correccion;
create policy coach_todo on public.frases_correccion for all to authenticated using (public.es_coach()) with check (public.es_coach());
drop policy if exists coach_todo on public.videos_modelo;
create policy coach_todo on public.videos_modelo for all to authenticated using (public.es_coach()) with check (public.es_coach());
-- La valoración: el coach la lee; el atleta, la suya (la escribe, la cambia y la quita; lo demás lo mira su trigger)
drop policy if exists coach_ver on public.video_autoevaluacion;
create policy coach_ver on public.video_autoevaluacion for select to authenticated using (public.es_coach());
drop policy if exists atleta_ver on public.video_autoevaluacion;
create policy atleta_ver on public.video_autoevaluacion for select to authenticated using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_crear on public.video_autoevaluacion;
create policy atleta_crear on public.video_autoevaluacion for insert to authenticated with check (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_editar on public.video_autoevaluacion;
create policy atleta_editar on public.video_autoevaluacion for update to authenticated using (atleta_id = public.mi_atleta_id()) with check (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_borrar on public.video_autoevaluacion;
create policy atleta_borrar on public.video_autoevaluacion for delete to authenticated using (atleta_id = public.mi_atleta_id());

revoke all on public.recordatorios_tecnica, public.frases_correccion, public.videos_modelo, public.video_autoevaluacion from public, anon, authenticated;
grant select, insert, update, delete on public.recordatorios_tecnica, public.frases_correccion, public.videos_modelo, public.video_autoevaluacion to authenticated;
-- (la corrección, como en la 035 y la 036: sin nada para anon)
revoke all on public.video_revisiones from public, anon, authenticated;
grant select, insert, update, delete on public.video_revisiones to authenticated;

-- Permisos (como al final de 003 a 036)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (37)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
