-- =====================================================================
-- FBE Atletas: instalación completa en una base nueva (schema.sql y las migraciones 002 a 018)
-- Generado con «npm run instalador»: no lo edites a mano (los cambios van en schema.sql o en una migración).
--
-- Cómo: en Supabase, SQL Editor → New query → pega TODO este archivo → Run. Después, en otra consulta,
-- seed_ejercicios.sql (tu biblioteca). Si ya tienes la app instalada, no uses este archivo: ejecuta solo
-- las migraciones que te falten (la base te lo impide igualmente).
-- =====================================================================

do $$
begin
  if to_regclass('public.perfiles') is not null then
    raise exception 'Esta base ya tiene la app instalada: no uses instalar.sql. Ejecuta solo las migraciones que te falten (supabase/migraciones/).';
  end if;
end $$;

-- ============================== schema.sql ==============================
-- =====================================================================
-- App de atletas FBE — esquema de base de datos para Supabase (v0.1)
-- MVP + fase 2. Fase 3 (nutrición y recursos) irá en una migración aparte.
--
-- Cómo aplicarlo:
--   1. Supabase → SQL Editor → pegar este archivo entero → Run.
--   2. Crear tu cuenta (Authentication → Users → Add user) y ascenderla a coach:
--        update public.perfiles set rol = 'coach'
--        where id = (select id from auth.users where email = 'TU_EMAIL');
--
-- Principio: cada atleta solo ve y escribe lo suyo, y eso lo impone la base
-- de datos (Row Level Security), no la interfaz. El coach lo ve todo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------

create table public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  rol        text not null default 'atleta' check (rol in ('coach', 'atleta')),
  nombre     text,
  creado_en  timestamptz not null default now()
);

create table public.atletas (
  id          uuid primary key default gen_random_uuid(),
  perfil_id   uuid unique references public.perfiles(id) on delete set null,
  nombre      text not null,
  email       text,
  estado      text not null default 'invitado'
              check (estado in ('invitado', 'activo', 'pausado', 'baja')),
  fecha_alta  date not null default current_date,
  objetivo    text,
  notion_url  text,  -- su página de Notion: archivo, y nutrición/recursos hasta la fase 3
  creado_en   timestamptz not null default now()
);

create table public.invitaciones (
  id           uuid primary key default gen_random_uuid(),
  atleta_id    uuid not null references public.atletas(id) on delete cascade,
  codigo_hash  text not null unique,  -- sha256 del código; el código en claro no se guarda
  caduca_en    timestamptz not null,
  usada_en     timestamptz,
  creada_en    timestamptz not null default now()
);

create table public.intentos_invitacion (
  id            bigint generated always as identity primary key,
  perfil_id     uuid not null references public.perfiles(id) on delete cascade,
  intentado_en  timestamptz not null default now()
);

create table public.consentimientos (
  id           uuid primary key default gen_random_uuid(),
  perfil_id    uuid not null references public.perfiles(id) on delete cascade,
  tipo         text not null check (tipo in ('privacidad', 'datos_salud')),
  version      text not null,
  aceptado_en  timestamptz not null default now(),
  revocado_en  timestamptz
);

create table public.ejercicios (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  variante           text,
  grupos_musculares  text[] not null default '{}'
    check (grupos_musculares <@ array['pectoral','espalda','deltoides','cuadriceps','gluteo',
                                      'isquiotibiales','biceps','triceps','abdominales','gemelo']),
  video_url          text,
  instrucciones      text,
  activo             boolean not null default true,
  creado_en          timestamptz not null default now()
);

create table public.bloques (
  id            uuid primary key default gen_random_uuid(),
  atleta_id     uuid references public.atletas(id) on delete cascade,
  es_plantilla  boolean not null default false,
  numero        int,
  nombre        text not null,
  foco          text check (foco in ('tecnica','volumen','intensidad','adaptacion','descarga','mixto')),
  objetivo      text,
  descripcion   text,
  fecha_inicio  date,
  fecha_fin     date,
  estado        text not null default 'planificado'
                check (estado in ('planificado','activo','ajustado','finalizado','cancelado')),
  creado_en     timestamptz not null default now(),
  -- una plantilla no tiene atleta; un bloque real siempre lo tiene
  check ((es_plantilla and atleta_id is null) or (not es_plantilla and atleta_id is not null))
);

create table public.semanas (
  id            uuid primary key default gen_random_uuid(),
  bloque_id     uuid not null references public.bloques(id) on delete cascade,
  numero        int not null check (numero >= 1),
  foco          text check (foco in ('tecnica','volumen','intensidad','adaptacion','descarga',
                                     'evaluacion','peaking')),
  fecha_inicio  date,
  nota_coach    text,
  -- el atleta solo ve las semanas 'programada'
  programacion  text not null default 'no_iniciada'
                check (programacion in ('no_iniciada','en_programacion','programada')),
  unique (bloque_id, numero)
);

create table public.sesiones (
  id               uuid primary key default gen_random_uuid(),
  semana_id        uuid not null references public.semanas(id) on delete cascade,
  orden            int not null,
  nombre           text not null,  -- "Día 2 push A"
  tipo             text not null default 'fuerza' check (tipo in ('fuerza','cardio','movilidad')),
  intencion        text check (intencion in ('rendimiento','volumen','tecnica','recuperacion_activa')),
  dinamica         text,           -- instrucciones del coach para la sesión
  -- lo que rellena el atleta:
  fecha_realizada  date,
  completada       boolean not null default false,
  nota_atleta      text,
  duracion_min     int check (duracion_min between 1 and 600),
  rpe_sesion       numeric(3,1) check (rpe_sesion between 1 and 10),
  unique (semana_id, orden)
);

create table public.sesion_ejercicios (  -- la prescripción
  id                 uuid primary key default gen_random_uuid(),
  sesion_id          uuid not null references public.sesiones(id) on delete cascade,
  ejercicio_id       uuid not null references public.ejercicios(id),
  orden              int not null,
  superserie         text,  -- misma letra = se hacen en superserie
  -- alta = obligatorio · media = muy importante · baja = accesorio
  -- muy_baja = "si tienes que dejar algo, que sea este"
  prioridad          text not null default 'media' check (prioridad in ('alta','media','baja','muy_baja')),
  series             int not null check (series between 1 and 20),
  reps_min           int check (reps_min >= 0),
  reps_max           int check (reps_max >= 0),
  rir_objetivo       numeric(3,1) check (rir_objetivo between 0 and 10),
  rpe_objetivo       numeric(3,1) check (rpe_objetivo between 1 and 10),
  carga_sugerida_kg  numeric(6,2) check (carga_sugerida_kg >= 0),
  descanso_seg       int check (descanso_seg between 0 and 900),
  tempo              text,
  notas_coach        text,
  check (reps_min is null or reps_max is null or reps_min <= reps_max)
);

create table public.series (  -- lo realizado, serie a serie
  id                   uuid primary key default gen_random_uuid(),
  sesion_ejercicio_id  uuid not null references public.sesion_ejercicios(id) on delete cascade,
  atleta_id            uuid not null references public.atletas(id) on delete cascade,  -- lo rellena un trigger
  numero               int not null check (numero >= 1),
  kg                   numeric(6,2) check (kg >= 0),
  reps                 int check (reps >= 0),
  rpe                  numeric(3,1) check (rpe between 1 and 10),
  rir                  numeric(3,1) check (rir between 0 and 10),
  nota                 text,
  registrada_en        timestamptz not null default now(),
  -- permite reenviar sin duplicar lo que se guardó sin cobertura (upsert)
  unique (sesion_ejercicio_id, numero)
);

create table public.pesos (
  id         uuid primary key default gen_random_uuid(),
  atleta_id  uuid not null references public.atletas(id) on delete cascade,
  fecha      date not null default current_date,
  kg         numeric(5,2) not null check (kg between 25 and 350),
  notas      text,
  unique (atleta_id, fecha)
);

create table public.checkins (
  id                   uuid primary key default gen_random_uuid(),
  atleta_id            uuid not null references public.atletas(id) on delete cascade,
  semana_inicio        date not null check (extract(isodow from semana_inicio) = 1),  -- lunes
  -- Todas las escalas 1–5 van de peor (1) a mejor (5), con las frases de Notion como ayuda.
  horas_sueno          text check (horas_sueno in ('<5','5-6','6-7','7-8','>8')),
  energia              smallint check (energia between 1 and 5),       -- pregunta "Cansancio": 5 = completamente descansado
  recuperacion         smallint check (recuperacion between 1 and 5),  -- 5 = al 100 %, sin fatiga ni dolor
  motivacion           smallint check (motivacion between 1 and 5),    -- 5 = muy motivado
  fc_reposo            smallint check (fc_reposo between 25 and 150),
  hrv                  numeric(5,1) check (hrv between 0 and 300),
  -- adherencia: 1 <25 % · 2 25–50 % · 3 50–75 % · 4 >75 % · 5 100 %
  adherencia_desayuno  smallint check (adherencia_desayuno between 1 and 5),
  adherencia_comida    smallint check (adherencia_comida between 1 and 5),
  adherencia_merienda  smallint check (adherencia_merienda between 1 and 5),
  adherencia_cena      smallint check (adherencia_cena between 1 and 5),
  calorias_media       int check (calorias_media between 500 and 8000),
  pasos_media          int check (pasos_media between 0 and 100000),
  saciedad             smallint check (saciedad between 1 and 4),            -- 4 = muy saciado
  satisfaccion_dieta   smallint check (satisfaccion_dieta between 1 and 5),  -- 5 = muy satisfecho
  notas                text,
  creado_en            timestamptz not null default now(),
  unique (atleta_id, semana_inicio)
);

create table public.molestias (
  id             uuid primary key default gen_random_uuid(),
  atleta_id      uuid not null references public.atletas(id) on delete cascade,
  semana_inicio  date not null check (extract(isodow from semana_inicio) = 1),
  zona           text not null check (zona in ('hombros','pectoral','triceps','espalda_alta','zona_lumbar',
                                               'femoral_gluteo','cuadriceps','aductor','otra')),
  intensidad     smallint not null check (intensidad between 0 and 3),  -- 0 no dolor · 1 leve · 2 moderado · 3 grave
  notas          text,
  unique (atleta_id, semana_inicio, zona)
);

create table public.notas_coach (  -- privadas: el atleta nunca las ve
  id         uuid primary key default gen_random_uuid(),
  atleta_id  uuid not null references public.atletas(id) on delete cascade,
  texto      text not null,
  creado_en  timestamptz not null default now()
);

-- Fase 2 -------------------------------------------------------------

create table public.medidas (
  id              uuid primary key default gen_random_uuid(),
  atleta_id       uuid not null references public.atletas(id) on delete cascade,
  fecha           date not null default current_date,
  cintura_cm      numeric(5,1), cadera_cm  numeric(5,1), pecho_cm numeric(5,1),
  brazo_cm        numeric(5,1), muslo_cm   numeric(5,1), pantorrilla_cm numeric(5,1),
  notas           text,
  unique (atleta_id, fecha)
);

create table public.marcas (
  id            uuid primary key default gen_random_uuid(),
  atleta_id     uuid not null references public.atletas(id) on delete cascade,
  ejercicio_id  uuid not null references public.ejercicios(id),
  fecha         date not null default current_date,
  kg            numeric(6,2) check (kg >= 0),
  reps          int not null default 1 check (reps >= 1),
  tipo          text not null default 'test' check (tipo in ('test','competicion')),
  notas         text
);

create table public.objetivos (
  id            uuid primary key default gen_random_uuid(),
  atleta_id     uuid not null references public.atletas(id) on delete cascade,
  titulo        text not null,
  descripcion   text,
  fecha_limite  date,
  progreso_pct  smallint not null default 0 check (progreso_pct between 0 and 100),
  estado        text not null default 'no_iniciado'
                check (estado in ('no_iniciado','en_curso','completado','descartado'))
);

create table public.archivos (  -- vídeos de técnica y fotos de progreso (Supabase Storage, bucket privado)
  id                   uuid primary key default gen_random_uuid(),
  atleta_id            uuid not null references public.atletas(id) on delete cascade,
  tipo                 text not null check (tipo in ('video_tecnica','foto_progreso')),
  ruta                 text not null,  -- ruta en el bucket: <atleta_id>/<archivo>
  sesion_ejercicio_id  uuid references public.sesion_ejercicios(id) on delete set null,
  fecha                date not null default current_date,
  comentario_coach     text,
  creado_en            timestamptz not null default now()
);

-- Índices para las consultas habituales
create index on public.bloques (atleta_id);
create index on public.semanas (bloque_id);
create index on public.sesiones (semana_id);
create index on public.sesion_ejercicios (sesion_id);
create index on public.series (atleta_id);
create index on public.pesos (atleta_id, fecha desc);
create index on public.checkins (atleta_id, semana_inicio desc);
create index on public.molestias (atleta_id, semana_inicio desc);
create index on public.intentos_invitacion (perfil_id, intentado_en);

-- ---------------------------------------------------------------------
-- 2. Funciones auxiliares (security definer: leen sin pasar por RLS
--    para no crear bucles entre políticas)
-- ---------------------------------------------------------------------

create or replace function public.es_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'coach');
$$;

create or replace function public.mi_atleta_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.atletas where perfil_id = auth.uid();
$$;

create or replace function public.tiene_consentimiento_salud() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.consentimientos
                 where perfil_id = auth.uid() and tipo = 'datos_salud' and revocado_en is null);
$$;

-- ¿Esta semana es del atleta que llama y ya está programada?
create or replace function public.semana_visible(p_semana uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.semanas s join public.bloques b on b.id = s.bloque_id
                 where s.id = p_semana and b.atleta_id = public.mi_atleta_id()
                   and s.programacion = 'programada');
$$;

create or replace function public.sesion_visible(p_sesion uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sesiones where id = p_sesion and public.semana_visible(semana_id));
$$;

create or replace function public.sesion_ejercicio_visible(p_se uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sesion_ejercicios where id = p_se and public.sesion_visible(sesion_id));
$$;

-- ---------------------------------------------------------------------
-- 3. Triggers
-- ---------------------------------------------------------------------

-- Cada usuario nuevo de Supabase Auth recibe un perfil de atleta.
create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil();

-- La serie siempre queda a nombre del atleta dueño de la sesión, diga lo que diga el cliente.
create or replace function public.serie_fijar_atleta() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select b.atleta_id into new.atleta_id
  from public.sesion_ejercicios se
  join public.sesiones s on s.id = se.sesion_id
  join public.semanas w on w.id = s.semana_id
  join public.bloques b on b.id = w.bloque_id
  where se.id = new.sesion_ejercicio_id;
  if new.atleta_id is null then
    raise exception 'No se pueden registrar series en una plantilla';
  end if;
  return new;
end $$;

create trigger series_fijar_atleta before insert or update of sesion_ejercicio_id on public.series
  for each row execute function public.serie_fijar_atleta();

-- El atleta solo puede cambiar los campos que le tocan. Solo aplica a usuarios de la app
-- (rol authenticated); el SQL Editor de Supabase (postgres) queda libre para administrar.
create or replace function public.proteger_sesion() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() and
     (new.semana_id, new.orden, new.nombre, new.tipo, new.intencion, new.dinamica)
     is distinct from
     (old.semana_id, old.orden, old.nombre, old.tipo, old.intencion, old.dinamica) then
    raise exception 'Solo el coach puede cambiar la prescripción de la sesión' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger sesiones_proteger before update on public.sesiones
  for each row execute function public.proteger_sesion();

create or replace function public.proteger_perfil() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() and (new.id, new.rol) is distinct from (old.id, old.rol) then
    raise exception 'No puedes cambiar tu rol' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger perfiles_proteger before update on public.perfiles
  for each row execute function public.proteger_perfil();

create or replace function public.proteger_consentimiento() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and (new.perfil_id, new.tipo, new.version, new.aceptado_en)
     is distinct from (old.perfil_id, old.tipo, old.version, old.aceptado_en) then
    raise exception 'Un consentimiento solo se puede revocar, no modificar' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger consentimientos_proteger before update on public.consentimientos
  for each row execute function public.proteger_consentimiento();

-- ---------------------------------------------------------------------
-- 4. Invitaciones
-- ---------------------------------------------------------------------

-- Normaliza lo que teclee el atleta: "fbe-ab3cd ef7gh" → "FBEAB3CDEF7GH"
create or replace function public.canon_codigo(p text) returns text
language sql immutable as $$
  select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Solo el coach. Devuelve el código en claro UNA vez (FBE-XXXXX-XXXXX); invalida los anteriores.
create or replace function public.crear_invitacion(p_atleta uuid, p_dias int default 14)
returns text language plpgsql security definer set search_path = public as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- sin 0/O ni 1/I
  b        bytea := uuid_send(gen_random_uuid());
  pos      int[] := array[0,1,2,3,4,5,9,10,11,12];  -- se saltan los bytes de versión del UUID
  crudo    text := '';
  codigo   text;
  i        int;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach puede crear invitaciones' using errcode = '42501';
  end if;
  if not exists (select 1 from public.atletas where id = p_atleta and perfil_id is null) then
    raise exception 'El atleta no existe o ya tiene cuenta';
  end if;
  foreach i in array pos loop
    crudo := crudo || substr(alfabeto, get_byte(b, i) % 32 + 1, 1);
  end loop;
  codigo := 'FBE-' || substr(crudo, 1, 5) || '-' || substr(crudo, 6, 5);
  update public.invitaciones set caduca_en = now()
    where atleta_id = p_atleta and usada_en is null and caduca_en > now();
  insert into public.invitaciones (atleta_id, codigo_hash, caduca_en)
    values (p_atleta, encode(sha256(convert_to(public.canon_codigo(codigo), 'UTF8')), 'hex'),
            now() + make_interval(days => p_dias));
  return codigo;
end $$;

-- El atleta, ya con sesión iniciada, canjea su código. Devuelve su atleta_id o null si no vale.
-- Máximo 5 intentos fallidos por hora y cuenta.
create or replace function public.canjear_invitacion(p_codigo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_inv    public.invitaciones;
  v_atleta uuid;
begin
  if v_uid is null then
    raise exception 'Necesitas iniciar sesión' using errcode = '42501';
  end if;
  if public.es_coach() or exists (select 1 from public.atletas where perfil_id = v_uid) then
    raise exception 'Esta cuenta ya está vinculada';
  end if;
  if (select count(*) from public.intentos_invitacion
      where perfil_id = v_uid and intentado_en > now() - interval '1 hour') >= 5 then
    raise exception 'Demasiados intentos. Prueba dentro de una hora.';
  end if;

  select * into v_inv from public.invitaciones
   where codigo_hash = encode(sha256(convert_to(public.canon_codigo(p_codigo), 'UTF8')), 'hex')
     and usada_en is null and caduca_en > now()
   for update;
  if not found then
    insert into public.intentos_invitacion (perfil_id) values (v_uid);
    return null;
  end if;

  update public.atletas set perfil_id = v_uid, estado = 'activo'
   where id = v_inv.atleta_id and perfil_id is null
   returning id into v_atleta;
  if v_atleta is null then
    insert into public.intentos_invitacion (perfil_id) values (v_uid);
    return null;
  end if;
  update public.invitaciones set usada_en = now() where id = v_inv.id;
  return v_atleta;
end $$;

-- ---------------------------------------------------------------------
-- 5. Herramientas del coach: plantillas y duplicar semanas
-- ---------------------------------------------------------------------

-- Copia una semana (sesiones + prescripción) con progresión opcional.
-- La copia queda 'en_programacion': el atleta no la ve hasta que la marques como programada.
create or replace function public.duplicar_semana(
  p_semana uuid, p_kg_extra numeric default 0, p_reps_extra int default 0, p_rir_delta numeric default 0)
returns uuid language plpgsql set search_path = public as $$
declare
  v_old   public.semanas;
  v_nueva uuid;
  s       record;
  v_ses   uuid;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  select * into v_old from public.semanas where id = p_semana;
  if not found then raise exception 'Semana no encontrada'; end if;

  insert into public.semanas (bloque_id, numero, foco, fecha_inicio, programacion)
  values (v_old.bloque_id,
          (select max(numero) + 1 from public.semanas where bloque_id = v_old.bloque_id),
          v_old.foco, v_old.fecha_inicio + 7, 'en_programacion')
  returning id into v_nueva;

  for s in select * from public.sesiones where semana_id = p_semana order by orden loop
    insert into public.sesiones (semana_id, orden, nombre, tipo, intencion, dinamica)
    values (v_nueva, s.orden, s.nombre, s.tipo, s.intencion, s.dinamica)
    returning id into v_ses;

    insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, superserie, prioridad, series,
      reps_min, reps_max, rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach)
    select v_ses, ejercicio_id, orden, superserie, prioridad, series,
           reps_min + p_reps_extra, reps_max + p_reps_extra,
           greatest(rir_objetivo + p_rir_delta, 0), rpe_objetivo,
           case when carga_sugerida_kg is null then null else carga_sugerida_kg + p_kg_extra end,
           descanso_seg, tempo, notas_coach
    from public.sesion_ejercicios where sesion_id = s.id;
  end loop;
  return v_nueva;
end $$;

-- Crea el bloque de un atleta copiando una plantilla (semanas, sesiones y prescripción).
create or replace function public.crear_bloque_desde_plantilla(
  p_plantilla uuid, p_atleta uuid, p_fecha_inicio date, p_numero int default null)
returns uuid language plpgsql set search_path = public as $$
declare
  v_pl     public.bloques;
  v_bloque uuid;
  w        record;
  s        record;
  v_sem    uuid;
  v_ses    uuid;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  select * into v_pl from public.bloques where id = p_plantilla and es_plantilla;
  if not found then raise exception 'Plantilla no encontrada'; end if;

  insert into public.bloques (atleta_id, numero, nombre, foco, objetivo, descripcion, fecha_inicio, estado)
  values (p_atleta,
          coalesce(p_numero, (select coalesce(max(numero), 0) + 1 from public.bloques where atleta_id = p_atleta)),
          v_pl.nombre, v_pl.foco, v_pl.objetivo, v_pl.descripcion, p_fecha_inicio, 'planificado')
  returning id into v_bloque;

  for w in select * from public.semanas where bloque_id = p_plantilla order by numero loop
    insert into public.semanas (bloque_id, numero, foco, fecha_inicio, nota_coach, programacion)
    values (v_bloque, w.numero, w.foco, p_fecha_inicio + (w.numero - 1) * 7, w.nota_coach, 'en_programacion')
    returning id into v_sem;
    for s in select * from public.sesiones where semana_id = w.id order by orden loop
      insert into public.sesiones (semana_id, orden, nombre, tipo, intencion, dinamica)
      values (v_sem, s.orden, s.nombre, s.tipo, s.intencion, s.dinamica)
      returning id into v_ses;
      insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, superserie, prioridad, series,
        reps_min, reps_max, rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach)
      select v_ses, ejercicio_id, orden, superserie, prioridad, series, reps_min, reps_max,
             rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach
      from public.sesion_ejercicios where sesion_id = s.id;
    end loop;
  end loop;
  return v_bloque;
end $$;

-- ---------------------------------------------------------------------
-- 6. Vistas (security_invoker: respetan los permisos de quien consulta)
-- ---------------------------------------------------------------------

-- La tarjeta de resumen que hoy se escribe a mano en cada página de Notion.
create view public.v_resumen_atletas with (security_invoker = true) as
select a.id as atleta_id, a.nombre, a.estado,
       b.numero  as bloque_numero, b.nombre as bloque_nombre, b.foco as bloque_foco,
       w.numero  as semana_numero, w.foco as semana_foco,
       ses.completadas, ses.total as sesiones_total,
       p.kg      as peso_kg, p.fecha as peso_fecha, p.kg - p_ant.kg as peso_cambio_kg,
       c.semana_inicio as checkin_semana, c.horas_sueno, c.energia, c.motivacion,
       m.max_molestia
from public.atletas a
left join lateral (select * from public.bloques
                   where atleta_id = a.id and estado in ('activo','ajustado')
                   order by fecha_inicio desc nulls last limit 1) b on true
left join lateral (select * from public.semanas
                   where bloque_id = b.id and programacion = 'programada' and fecha_inicio <= current_date
                   order by fecha_inicio desc limit 1) w on true
left join lateral (select count(*) filter (where completada) as completadas, count(*) as total
                   from public.sesiones where semana_id = w.id) ses on true
left join lateral (select kg, fecha from public.pesos where atleta_id = a.id
                   order by fecha desc limit 1) p on true
left join lateral (select kg from public.pesos where atleta_id = a.id and fecha < p.fecha
                   order by fecha desc limit 1) p_ant on true
left join lateral (select * from public.checkins where atleta_id = a.id
                   order by semana_inicio desc limit 1) c on true
left join lateral (select max(intensidad) as max_molestia from public.molestias
                   where atleta_id = a.id and semana_inicio = c.semana_inicio) m on true;

-- Mejor 1RM estimado por ejercicio y semana (Epley ajustado por RIR; RIR = 10 − RPE si solo hay RPE).
create view public.v_e1rm_semanal with (security_invoker = true) as
select r.atleta_id, se.ejercicio_id,
       date_trunc('week', coalesce(s.fecha_realizada, r.registrada_en::date))::date as semana,
       max(round(r.kg * (1 + (r.reps + coalesce(r.rir, 10 - r.rpe, 0)) / 30.0), 1)) as e1rm_kg
from public.series r
join public.sesion_ejercicios se on se.id = r.sesion_ejercicio_id
join public.sesiones s on s.id = se.sesion_id
where r.kg > 0 and r.reps between 1 and 12
group by 1, 2, 3;

-- Series hechas por grupo muscular y semana (volumen semanal). El primer grupo del ejercicio es el
-- principal y cuenta 1; los secundarios cuentan 0,5 (series indirectas).
create view public.v_series_por_grupo with (security_invoker = true) as
select r.atleta_id, g.grupo,
       date_trunc('week', coalesce(s.fecha_realizada, r.registrada_en::date))::date as semana,
       sum(case when g.orden = 1 then 1 else 0.5 end) as series
from public.series r
join public.sesion_ejercicios se on se.id = r.sesion_ejercicio_id
join public.sesiones s on s.id = se.sesion_id
join public.ejercicios e on e.id = se.ejercicio_id
cross join lateral unnest(e.grupos_musculares) with ordinality as g(grupo, orden)
where r.reps > 0
group by 1, 2, 3;

-- ---------------------------------------------------------------------
-- 7. Permisos: RLS en todas las tablas
-- ---------------------------------------------------------------------

alter table public.perfiles            enable row level security;
alter table public.atletas             enable row level security;
alter table public.invitaciones        enable row level security;
alter table public.intentos_invitacion enable row level security;
alter table public.consentimientos     enable row level security;
alter table public.ejercicios          enable row level security;
alter table public.bloques             enable row level security;
alter table public.semanas             enable row level security;
alter table public.sesiones            enable row level security;
alter table public.sesion_ejercicios   enable row level security;
alter table public.series              enable row level security;
alter table public.pesos               enable row level security;
alter table public.checkins            enable row level security;
alter table public.molestias           enable row level security;
alter table public.notas_coach         enable row level security;
alter table public.medidas             enable row level security;
alter table public.marcas              enable row level security;
alter table public.objetivos           enable row level security;
alter table public.archivos            enable row level security;

-- El coach puede todo en todas las tablas.
do $$
declare t text;
begin
  foreach t in array array['perfiles','atletas','invitaciones','intentos_invitacion','consentimientos',
                           'ejercicios','bloques','semanas','sesiones','sesion_ejercicios','series',
                           'pesos','checkins','molestias','notas_coach','medidas','marcas','objetivos','archivos']
  loop
    execute format('create policy coach_todo on public.%I for all to authenticated
                    using (public.es_coach()) with check (public.es_coach())', t);
  end loop;
end $$;

-- Perfil propio
create policy atleta_ver on public.perfiles for select to authenticated using (id = auth.uid());
create policy atleta_editar on public.perfiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Ficha propia (solo lectura)
create policy atleta_ver on public.atletas for select to authenticated using (perfil_id = auth.uid());

-- Consentimientos propios: ver, dar y revocar
create policy atleta_ver on public.consentimientos for select to authenticated using (perfil_id = auth.uid());
create policy atleta_dar on public.consentimientos for insert to authenticated with check (perfil_id = auth.uid());
create policy atleta_revocar on public.consentimientos for update to authenticated
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

-- Biblioteca de ejercicios: la ve cualquier cuenta
create policy todos_ver on public.ejercicios for select to authenticated using (auth.uid() is not null);

-- Programa: solo lo suyo, y solo semanas ya programadas
create policy atleta_ver on public.bloques for select to authenticated
  using (not es_plantilla and atleta_id = public.mi_atleta_id());
create policy atleta_ver on public.semanas for select to authenticated using (public.semana_visible(id));
create policy atleta_ver on public.sesiones for select to authenticated using (public.semana_visible(semana_id));
create policy atleta_marcar on public.sesiones for update to authenticated
  using (public.semana_visible(semana_id)) with check (public.semana_visible(semana_id));
create policy atleta_ver on public.sesion_ejercicios for select to authenticated
  using (public.sesion_visible(sesion_id));

-- Series: registrar, corregir y borrar las suyas
create policy atleta_ver on public.series for select to authenticated using (atleta_id = public.mi_atleta_id());
create policy atleta_crear on public.series for insert to authenticated
  with check (atleta_id = public.mi_atleta_id() and public.sesion_ejercicio_visible(sesion_ejercicio_id));
create policy atleta_editar on public.series for update to authenticated
  using (atleta_id = public.mi_atleta_id())
  with check (atleta_id = public.mi_atleta_id() and public.sesion_ejercicio_visible(sesion_ejercicio_id));
create policy atleta_borrar on public.series for delete to authenticated using (atleta_id = public.mi_atleta_id());

-- Datos de salud: solo los suyos y solo con consentimiento vigente para escribir
do $$
declare t text;
begin
  foreach t in array array['pesos','checkins','molestias','medidas'] loop
    execute format('create policy atleta_ver on public.%I for select to authenticated
                    using (atleta_id = public.mi_atleta_id())', t);
    execute format('create policy atleta_crear on public.%I for insert to authenticated
                    with check (atleta_id = public.mi_atleta_id() and public.tiene_consentimiento_salud())', t);
    execute format('create policy atleta_editar on public.%I for update to authenticated
                    using (atleta_id = public.mi_atleta_id())
                    with check (atleta_id = public.mi_atleta_id() and public.tiene_consentimiento_salud())', t);
    execute format('create policy atleta_borrar on public.%I for delete to authenticated
                    using (atleta_id = public.mi_atleta_id())', t);
  end loop;
end $$;

-- Marcas: ver y añadir las suyas
create policy atleta_ver on public.marcas for select to authenticated using (atleta_id = public.mi_atleta_id());
create policy atleta_crear on public.marcas for insert to authenticated with check (atleta_id = public.mi_atleta_id());

-- Objetivos: solo lectura
create policy atleta_ver on public.objetivos for select to authenticated using (atleta_id = public.mi_atleta_id());

-- Archivos: ver y subir los suyos
create policy atleta_ver on public.archivos for select to authenticated using (atleta_id = public.mi_atleta_id());
create policy atleta_subir on public.archivos for insert to authenticated
  with check (atleta_id = public.mi_atleta_id() and comentario_coach is null);

-- invitaciones, intentos_invitacion y notas_coach: sin política para atletas → invisibles.

-- Sin sesión iniciada no se accede a nada.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- ============================== migraciones/002_ampliacion.sql ==============================
-- =====================================================================
-- App de atletas FBE — migración 002 (v0.2)
-- Se ejecuta DESPUÉS de schema.sql, en el SQL Editor de Supabase (pegar → Run).
-- Se puede repetir: no duplica nada ni borra datos.
--
-- Añade:
--   · Biblioteca ampliada: errores comunes, alternativas equivalentes, tipo y rango recomendado.
--   · Variante en la pauta («pausa 2 s», «agarre cerrado») y cambio de ejercicio por una alternativa.
--   · Revisión del coach: sesiones y check-ins quedan «pendientes» hasta que los revisas o comentas.
--   · Comentarios entre coach y atleta en sesiones, check-ins y vídeos.
--   · Recursos y preguntas frecuentes.
--   · Vídeos de técnica y fotos de progreso en Storage (bucket privado «archivos»).
--   · Marcas: el atleta puede borrar las suyas.
--   · Verificación en dos pasos para el coach: si la activas, tus permisos de coach solo valen
--     con la sesión verificada (aal2). Ver README, «Verificación en dos pasos».
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guardia: si la base ya tiene una migración posterior, esta no se repite (desharía lo que
-- cambiaron las siguientes). Al terminar, queda apuntada en fbe_migraciones.
-- ---------------------------------------------------------------------
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
  if v > 2 then
    raise exception 'Esta base ya tiene la migración %: repetir la 002 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 2;» y, después de ella, todas las siguientes en orden.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Columnas nuevas
-- ---------------------------------------------------------------------

alter table public.ejercicios
  add column if not exists errores      text,
  add column if not exists alternativas uuid[] not null default '{}',  -- ejercicios equivalentes (ids)
  add column if not exists tipo         text[] not null default '{}',  -- basico · multiarticular · aislamiento
  add column if not exists rango_reps   text;                         -- «Fuerza 1–5, hipertrofia 6–12»

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ejercicios_tipo_check') then
    alter table public.ejercicios add constraint ejercicios_tipo_check
      check (tipo <@ array['basico','multiarticular','aislamiento']);
  end if;
end $$;

alter table public.sesion_ejercicios add column if not exists variante text;

-- La serie se hizo con otro ejercicio (una alternativa) en lugar del pautado
alter table public.series add column if not exists sustituto_id uuid references public.ejercicios(id) on delete set null;

-- Sugerir subir carga cuando el atleta llega al tope del rango (doble progresión)
alter table public.atletas add column if not exists progresion_auto boolean not null default true;

-- Revisión del coach. Lo anterior a esta migración se da por revisado.
do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'sesiones' and column_name = 'revisada_en') then
    alter table public.sesiones add column revisada_en timestamptz;
    update public.sesiones set revisada_en = now() where completada;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'checkins' and column_name = 'revisado_en') then
    alter table public.checkins add column revisado_en timestamptz;
    update public.checkins set revisado_en = now();
  end if;
end $$;

alter table public.archivos
  add column if not exists ejercicio_id uuid references public.ejercicios(id) on delete set null,
  add column if not exists nota_atleta  text,
  add column if not exists mime         text,
  add column if not exists bytes        bigint,
  add column if not exists revisado_en  timestamptz;

-- ---------------------------------------------------------------------
-- 2. Tablas nuevas
-- ---------------------------------------------------------------------

-- Conversación coach–atleta pegada a una sesión, un check-in o un vídeo (o general si no hay ninguno).
create table if not exists public.comentarios (
  id          uuid primary key default gen_random_uuid(),
  atleta_id   uuid not null references public.atletas(id) on delete cascade,
  sesion_id   uuid references public.sesiones(id) on delete cascade,
  checkin_id  uuid references public.checkins(id) on delete cascade,
  archivo_id  uuid references public.archivos(id) on delete cascade,
  autor       text not null check (autor in ('coach', 'atleta')),  -- lo fija un trigger
  texto       text not null check (length(texto) between 1 and 4000),
  creado_en   timestamptz not null default now(),
  leido_en    timestamptz,  -- lo marca quien lo recibe
  check (num_nonnulls(sesion_id, checkin_id, archivo_id) <= 1)
);

-- Guías, enlaces y preguntas frecuentes. Sin atleta = para todos.
create table if not exists public.recursos (
  id           uuid primary key default gen_random_uuid(),
  atleta_id    uuid references public.atletas(id) on delete cascade,
  categoria    text not null default 'general'
               check (categoria in ('entrenamiento','tecnica','alimentacion','descanso','faq','general')),
  titulo       text not null,
  descripcion  text,  -- en una pregunta frecuente, la respuesta
  url          text,
  orden        int not null default 0,
  creado_en    timestamptz not null default now()
);

create index if not exists comentarios_atleta_idx on public.comentarios (atleta_id, creado_en desc);
create index if not exists comentarios_sesion_idx on public.comentarios (sesion_id);
create index if not exists comentarios_checkin_idx on public.comentarios (checkin_id);
create index if not exists comentarios_archivo_idx on public.comentarios (archivo_id);
create index if not exists archivos_atleta_idx on public.archivos (atleta_id, fecha desc);
create index if not exists marcas_atleta_idx on public.marcas (atleta_id, fecha desc);
create index if not exists medidas_atleta_idx on public.medidas (atleta_id, fecha desc);
create index if not exists objetivos_atleta_idx on public.objetivos (atleta_id);
create index if not exists recursos_atleta_idx on public.recursos (atleta_id);

-- ---------------------------------------------------------------------
-- 3. Funciones
-- ---------------------------------------------------------------------

-- Coach = rol coach y, si tiene la verificación en dos pasos activada, sesión verificada (aal2).
create or replace function public.es_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'coach')
     and (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
          or not exists (select 1 from auth.mfa_factors
                         where user_id = auth.uid() and status = 'verified'));
$$;

-- Dueño de una sesión (para comentarios)
create or replace function public.atleta_de_sesion(p_sesion uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select b.atleta_id from public.sesiones s
  join public.semanas w on w.id = s.semana_id
  join public.bloques b on b.id = w.bloque_id
  where s.id = p_sesion;
$$;
create or replace function public.atleta_de_checkin(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select atleta_id from public.checkins where id = p;
$$;
create or replace function public.atleta_de_archivo(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select atleta_id from public.archivos where id = p;
$$;

-- Lo que cambia el atleta en una sesión vuelve a quedar pendiente de revisar.
create or replace function public.proteger_sesion() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    if (new.semana_id, new.orden, new.nombre, new.tipo, new.intencion, new.dinamica)
       is distinct from
       (old.semana_id, old.orden, old.nombre, old.tipo, old.intencion, old.dinamica) then
      raise exception 'Solo el coach puede cambiar la prescripción de la sesión' using errcode = '42501';
    end if;
    new.revisada_en := null;
  end if;
  return new;
end $$;

create or replace function public.checkin_pendiente() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    new.revisado_en := null;
  end if;
  return new;
end $$;
drop trigger if exists checkins_pendiente on public.checkins;
create trigger checkins_pendiente before insert or update on public.checkins
  for each row execute function public.checkin_pendiente();

create or replace function public.archivo_proteger() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    new.revisado_en := null;
    new.comentario_coach := null;
  end if;
  return new;
end $$;
drop trigger if exists archivos_proteger on public.archivos;
create trigger archivos_proteger before insert on public.archivos
  for each row execute function public.archivo_proteger();

-- Comentarios: el autor lo decide quién escribe y el atleta es el dueño de lo comentado.
-- Desde la app no se editan: solo los marca como leídos quien los recibe.
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
    new.leido_en := null;
    new.creado_en := now();
    return new;
  end if;
  if v_autor is not null then
    if (new.atleta_id, new.sesion_id, new.checkin_id, new.archivo_id, new.autor, new.texto, new.creado_en)
       is distinct from
       (old.atleta_id, old.sesion_id, old.checkin_id, old.archivo_id, old.autor, old.texto, old.creado_en) then
      raise exception 'Un comentario no se puede editar' using errcode = '42501';
    end if;
    if old.autor = v_autor and new.leido_en is distinct from old.leido_en then
      raise exception 'Solo quien recibe un comentario lo marca como leído' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists comentarios_preparar on public.comentarios;
create trigger comentarios_preparar before insert or update on public.comentarios
  for each row execute function public.comentario_preparar();

-- Cuando el coach comenta algo, queda revisado.
create or replace function public.comentario_revisa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.autor = 'coach' then
    if new.sesion_id is not null then
      update public.sesiones set revisada_en = now() where id = new.sesion_id and revisada_en is null;
    elsif new.checkin_id is not null then
      update public.checkins set revisado_en = now() where id = new.checkin_id and revisado_en is null;
    elsif new.archivo_id is not null then
      update public.archivos set revisado_en = now() where id = new.archivo_id and revisado_en is null;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists comentarios_revisa on public.comentarios;
create trigger comentarios_revisa after insert on public.comentarios
  for each row execute function public.comentario_revisa();

-- Las herramientas del coach copian también la variante.
create or replace function public.duplicar_semana(
  p_semana uuid, p_kg_extra numeric default 0, p_reps_extra int default 0, p_rir_delta numeric default 0)
returns uuid language plpgsql set search_path = public as $$
declare
  v_old   public.semanas;
  v_nueva uuid;
  s       record;
  v_ses   uuid;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  select * into v_old from public.semanas where id = p_semana;
  if not found then raise exception 'Semana no encontrada'; end if;

  insert into public.semanas (bloque_id, numero, foco, fecha_inicio, programacion)
  values (v_old.bloque_id,
          (select max(numero) + 1 from public.semanas where bloque_id = v_old.bloque_id),
          v_old.foco, v_old.fecha_inicio + 7, 'en_programacion')
  returning id into v_nueva;

  for s in select * from public.sesiones where semana_id = p_semana order by orden loop
    insert into public.sesiones (semana_id, orden, nombre, tipo, intencion, dinamica)
    values (v_nueva, s.orden, s.nombre, s.tipo, s.intencion, s.dinamica)
    returning id into v_ses;

    insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, superserie, prioridad, series,
      reps_min, reps_max, rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante)
    select v_ses, ejercicio_id, orden, superserie, prioridad, series,
           reps_min + p_reps_extra, reps_max + p_reps_extra,
           greatest(rir_objetivo + p_rir_delta, 0), rpe_objetivo,
           case when carga_sugerida_kg is null then null else carga_sugerida_kg + p_kg_extra end,
           descanso_seg, tempo, notas_coach, variante
    from public.sesion_ejercicios where sesion_id = s.id;
  end loop;
  return v_nueva;
end $$;

create or replace function public.crear_bloque_desde_plantilla(
  p_plantilla uuid, p_atleta uuid, p_fecha_inicio date, p_numero int default null)
returns uuid language plpgsql set search_path = public as $$
declare
  v_pl     public.bloques;
  v_bloque uuid;
  w        record;
  s        record;
  v_sem    uuid;
  v_ses    uuid;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  select * into v_pl from public.bloques where id = p_plantilla and es_plantilla;
  if not found then raise exception 'Plantilla no encontrada'; end if;

  insert into public.bloques (atleta_id, numero, nombre, foco, objetivo, descripcion, fecha_inicio, estado)
  values (p_atleta,
          coalesce(p_numero, (select coalesce(max(numero), 0) + 1 from public.bloques where atleta_id = p_atleta)),
          v_pl.nombre, v_pl.foco, v_pl.objetivo, v_pl.descripcion, p_fecha_inicio, 'planificado')
  returning id into v_bloque;

  for w in select * from public.semanas where bloque_id = p_plantilla order by numero loop
    insert into public.semanas (bloque_id, numero, foco, fecha_inicio, nota_coach, programacion)
    values (v_bloque, w.numero, w.foco, p_fecha_inicio + (w.numero - 1) * 7, w.nota_coach, 'en_programacion')
    returning id into v_sem;
    for s in select * from public.sesiones where semana_id = w.id order by orden loop
      insert into public.sesiones (semana_id, orden, nombre, tipo, intencion, dinamica)
      values (v_sem, s.orden, s.nombre, s.tipo, s.intencion, s.dinamica)
      returning id into v_ses;
      insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, superserie, prioridad, series,
        reps_min, reps_max, rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante)
      select v_ses, ejercicio_id, orden, superserie, prioridad, series, reps_min, reps_max,
             rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante
      from public.sesion_ejercicios where sesion_id = s.id;
    end loop;
  end loop;
  return v_bloque;
end $$;

-- ---------------------------------------------------------------------
-- 4. Vistas: las series hechas con una alternativa cuentan para la alternativa.
--    El 1RM de una serie a 1 repetición sin reserva es la propia carga (convención de Epley).
-- ---------------------------------------------------------------------

create or replace view public.v_e1rm_semanal with (security_invoker = true) as
select r.atleta_id, coalesce(r.sustituto_id, se.ejercicio_id) as ejercicio_id,
       date_trunc('week', coalesce(s.fecha_realizada, r.registrada_en::date))::date as semana,
       max(round(case when r.reps + greatest(coalesce(r.rir, 10 - r.rpe, 0), 0) <= 1 then r.kg
                      else r.kg * (1 + (r.reps + greatest(coalesce(r.rir, 10 - r.rpe, 0), 0)) / 30.0) end, 1)) as e1rm_kg
from public.series r
join public.sesion_ejercicios se on se.id = r.sesion_ejercicio_id
join public.sesiones s on s.id = se.sesion_id
where r.kg > 0 and r.reps between 1 and 12
group by 1, 2, 3;

create or replace view public.v_series_por_grupo with (security_invoker = true) as
select r.atleta_id, g.grupo,
       date_trunc('week', coalesce(s.fecha_realizada, r.registrada_en::date))::date as semana,
       sum(case when g.orden = 1 then 1 else 0.5 end) as series
from public.series r
join public.sesion_ejercicios se on se.id = r.sesion_ejercicio_id
join public.sesiones s on s.id = se.sesion_id
join public.ejercicios e on e.id = coalesce(r.sustituto_id, se.ejercicio_id)
cross join lateral unnest(e.grupos_musculares) with ordinality as g(grupo, orden)
where r.reps > 0
group by 1, 2, 3;

-- ---------------------------------------------------------------------
-- 5. Permisos
-- ---------------------------------------------------------------------

alter table public.comentarios enable row level security;
alter table public.recursos    enable row level security;

drop policy if exists coach_todo on public.comentarios;
create policy coach_todo on public.comentarios for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.comentarios;
create policy atleta_ver on public.comentarios for select to authenticated
  using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_crear on public.comentarios;
create policy atleta_crear on public.comentarios for insert to authenticated
  with check (atleta_id = public.mi_atleta_id() and autor = 'atleta'
              and (sesion_id is null or public.sesion_visible(sesion_id)));
drop policy if exists atleta_leer on public.comentarios;
create policy atleta_leer on public.comentarios for update to authenticated
  using (atleta_id = public.mi_atleta_id()) with check (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_borrar on public.comentarios;
create policy atleta_borrar on public.comentarios for delete to authenticated
  using (atleta_id = public.mi_atleta_id() and autor = 'atleta');

drop policy if exists coach_todo on public.recursos;
create policy coach_todo on public.recursos for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.recursos;
create policy atleta_ver on public.recursos for select to authenticated
  using (public.mi_atleta_id() is not null and (atleta_id is null or atleta_id = public.mi_atleta_id()));

-- Marcas: también puede borrar las suyas (un test mal apuntado)
drop policy if exists atleta_borrar on public.marcas;
create policy atleta_borrar on public.marcas for delete to authenticated
  using (atleta_id = public.mi_atleta_id());

-- Archivos: sube y borra los suyos, dentro de su carpeta; las fotos de progreso piden consentimiento de salud
drop policy if exists atleta_subir on public.archivos;
create policy atleta_subir on public.archivos for insert to authenticated
  with check (atleta_id = public.mi_atleta_id()
              and ruta like atleta_id::text || '/%'
              and (sesion_ejercicio_id is null or public.sesion_ejercicio_visible(sesion_ejercicio_id))
              and (tipo <> 'foto_progreso' or public.tiene_consentimiento_salud()));
drop policy if exists atleta_borrar on public.archivos;
create policy atleta_borrar on public.archivos for delete to authenticated
  using (atleta_id = public.mi_atleta_id());

-- Storage: bucket privado; cada atleta solo toca su carpeta (<atleta_id>/...); el coach, todo.
-- Límite por archivo: 200 MB (sube también el límite global en Storage → Settings si hace falta).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('archivos', 'archivos', false, 209715200,
        array['video/mp4','video/quicktime','video/webm','image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists fbe_archivos_ver on storage.objects;
create policy fbe_archivos_ver on storage.objects for select to authenticated
  using (bucket_id = 'archivos'
         and (public.es_coach() or (storage.foldername(name))[1] = public.mi_atleta_id()::text));
drop policy if exists fbe_archivos_subir on storage.objects;
create policy fbe_archivos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos'
              and (public.es_coach() or (storage.foldername(name))[1] = public.mi_atleta_id()::text));
drop policy if exists fbe_archivos_borrar on storage.objects;
create policy fbe_archivos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'archivos'
         and (public.es_coach() or (storage.foldername(name))[1] = public.mi_atleta_id()::text));

-- Sin sesión no se accede a nada (también a lo nuevo).
revoke all on public.comentarios, public.recursos from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Apuntada: desde aquí, la base no deja repetir por error las migraciones anteriores a esta
insert into public.fbe_migraciones (numero) values (2)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;

-- ============================== migraciones/003_seguridad_y_volumen.sql ==============================
-- =====================================================================
-- FBE Atletas, migración 003 (v0.3)
-- 1. Endurece permisos tras la revisión de seguridad:
--    - el coach con verificación en dos pasos no puede quedarse sin ella con solo la contraseña
--    - consentimientos que no se pueden falsear ni reactivar
--    - «Baja» corta la escritura (el atleta sigue pudiendo ver y descargar lo suyo)
--    - los comentarios del coach no desaparecen si el atleta borra un check-in o un vídeo
--    - Storage solo acepta archivos registrados (con su consentimiento, su ruta segura y su límite diario)
--    - las funciones auxiliares no revelan de quién es una sesión ajena
--    - la biblioteca solo la ven cuentas vinculadas a un atleta
-- 2. Rango de volumen semanal por músculo, ajustable por atleta.
--
-- Se ejecuta en el SQL Editor después de schema.sql y 002. Se puede repetir sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guardia: si la base ya tiene una migración posterior, esta no se repite (desharía lo que
-- cambiaron las siguientes). Al terminar, queda apuntada en fbe_migraciones.
-- ---------------------------------------------------------------------
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
  if v > 3 then
    raise exception 'Esta base ya tiene la migración %: repetir la 003 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 3;» y, después de ella, todas las siguientes en orden.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1.1 Coach con verificación en dos pasos: si falla la comprobación, se cierra
-- ---------------------------------------------------------------------
-- exige_2fa se activa al verificar el primer dispositivo. Con él activo, el coach necesita
-- siempre el segundo paso (aal2), aunque la base no pudiera leer sus factores o alguien los
-- quitara con la contraseña robada. Solo se desactiva desde una sesión con el segundo paso.
alter table public.perfiles add column if not exists exige_2fa boolean not null default false;

create or replace function public.es_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.rol = 'coach'
      and (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
           or (not p.exige_2fa
               and not exists (select 1 from auth.mfa_factors f
                               where f.user_id = auth.uid() and f.status = 'verified'))));
$$;

create or replace function public.proteger_perfil() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if not public.es_coach() and (new.id, new.rol) is distinct from (old.id, old.rol) then
      raise exception 'No puedes cambiar tu rol' using errcode = '42501';
    end if;
    if old.exige_2fa and not new.exige_2fa and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
      raise exception 'Para desactivar la verificación en dos pasos tienes que haber entrado con ella' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 1.2 Consentimientos: los da cada persona, con la fecha real y el texto vigente;
--     revocar es definitivo (para volver a darlo se crea uno nuevo)
-- ---------------------------------------------------------------------
-- Cambia esta versión (y VERSION_CONSENTIMIENTO en web/src/datos/api.js) cuando cambie el texto.
create or replace function public.version_consentimiento() returns text
language sql immutable as $$ select '2026-10'::text $$;

create or replace function public.consentimiento_nuevo() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.perfil_id is distinct from auth.uid() then
      raise exception 'Cada persona da su propio consentimiento' using errcode = '42501';
    end if;
    if new.version is distinct from public.version_consentimiento() then
      raise exception 'El texto que aceptas no es el vigente: recarga la app y vuelve a intentarlo' using errcode = '22023';
    end if;
    new.aceptado_en := now();
    new.revocado_en := null;
  end if;
  return new;
end $$;
drop trigger if exists consentimientos_nuevo on public.consentimientos;
create trigger consentimientos_nuevo before insert on public.consentimientos
  for each row execute function public.consentimiento_nuevo();

create or replace function public.proteger_consentimiento() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if (new.perfil_id, new.tipo, new.version, new.aceptado_en)
       is distinct from (old.perfil_id, old.tipo, old.version, old.aceptado_en) then
      raise exception 'Un consentimiento solo se puede revocar, no modificar' using errcode = '42501';
    end if;
    if old.revocado_en is not null and new.revocado_en is distinct from old.revocado_en then
      raise exception 'Un consentimiento revocado no se puede reactivar: hay que darlo de nuevo' using errcode = '42501';
    end if;
    if old.revocado_en is null and new.revocado_en is not null then
      new.revocado_en := now();
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 1.3 Atleta de baja: lee y descarga lo suyo, pero no añade ni cambia nada
-- ---------------------------------------------------------------------
create or replace function public.esta_de_baja() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.atletas where perfil_id = auth.uid() and estado = 'baja');
$$;

create or replace function public.exigir_alta() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() and public.esta_de_baja() then
    raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  -- inserciones y cambios
  foreach t in array array['series','pesos','checkins','molestias','medidas','marcas'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_exigir_alta', t);
    execute format('create trigger %I before insert or update on public.%I
                    for each row execute function public.exigir_alta()', t || '_exigir_alta', t);
  end loop;
  -- solo cambios (el atleta no crea sesiones)
  drop trigger if exists sesiones_exigir_alta on public.sesiones;
  create trigger sesiones_exigir_alta before update on public.sesiones
    for each row execute function public.exigir_alta();
  -- solo inserciones (marcar como leído un comentario sí se puede)
  foreach t in array array['comentarios','archivos'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_exigir_alta', t);
    execute format('create trigger %I before insert on public.%I
                    for each row execute function public.exigir_alta()', t || '_exigir_alta', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 1.4 Si el atleta borra un check-in o un vídeo, la conversación se queda (sin el enlace)
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select c.conname, a.attname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.comentarios'::regclass and c.contype = 'f'
      and a.attname in ('checkin_id', 'archivo_id') and c.confdeltype <> 'n'
  loop
    execute format('alter table public.comentarios drop constraint %I', r.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'public.comentarios'::regclass and conname = 'comentarios_checkin_id_fkey') then
    alter table public.comentarios add constraint comentarios_checkin_id_fkey
      foreign key (checkin_id) references public.checkins(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.comentarios'::regclass and conname = 'comentarios_archivo_id_fkey') then
    alter table public.comentarios add constraint comentarios_archivo_id_fkey
      foreign key (archivo_id) references public.archivos(id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1.5 Funciones auxiliares: solo responden sobre lo propio (o al coach)
-- ---------------------------------------------------------------------
create or replace function public.atleta_de_sesion(p_sesion uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select b.atleta_id from public.sesiones s
  join public.semanas w on w.id = s.semana_id
  join public.bloques b on b.id = w.bloque_id
  where s.id = p_sesion and (b.atleta_id = public.mi_atleta_id() or public.es_coach());
$$;
create or replace function public.atleta_de_checkin(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select atleta_id from public.checkins
  where id = p and (atleta_id = public.mi_atleta_id() or public.es_coach());
$$;
create or replace function public.atleta_de_archivo(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select atleta_id from public.archivos
  where id = p and (atleta_id = public.mi_atleta_id() or public.es_coach());
$$;

-- La biblioteca la ven el coach (coach_todo) y las cuentas vinculadas a un atleta.
drop policy if exists todos_ver on public.ejercicios;
drop policy if exists vinculados_ver on public.ejercicios;
create policy vinculados_ver on public.ejercicios for select to authenticated
  using (public.mi_atleta_id() is not null);

-- ---------------------------------------------------------------------
-- 1.6 Archivos y Storage
-- ---------------------------------------------------------------------
-- Ruta: <atleta_id>/<nombre> con caracteres seguros, sin «..» ni subcarpetas; una fila por archivo.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.archivos'::regclass and conname = 'archivos_ruta_segura') then
    alter table public.archivos add constraint archivos_ruta_segura
      check (ruta ~ ('^' || atleta_id::text || '/[A-Za-z0-9_-][A-Za-z0-9._-]{0,150}$') and position('..' in ruta) = 0);
  end if;
end $$;
create unique index if not exists archivos_ruta_unica on public.archivos (ruta);

-- Al registrar un archivo: no puede darlo por revisado ni comentarlo como coach, y como mucho 30 al día.
create or replace function public.archivo_proteger() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    new.revisado_en := null;
    new.comentario_coach := null;
    new.creado_en := now();
    if (select count(*) from public.archivos
        where atleta_id = new.atleta_id and creado_en > now() - interval '1 day') >= 30 then
      raise exception 'Has subido 30 archivos en las últimas 24 horas: espera un poco o pide a tu coach que borre alguno' using errcode = '54000';
    end if;
  end if;
  return new;
end $$;

-- En Storage solo se puede subir un archivo que ya esté registrado en la tabla archivos a nombre
-- del atleta (así pasan el consentimiento, la ruta segura y el límite diario, y el borrado
-- completo de un atleta lo encuentra todo). La app registra primero y sube después.
create or replace function public.archivo_registrado(p_ruta text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.archivos where ruta = p_ruta and atleta_id = public.mi_atleta_id());
$$;

drop policy if exists fbe_archivos_subir on storage.objects;
create policy fbe_archivos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos' and (public.es_coach() or public.archivo_registrado(name)));

-- ---------------------------------------------------------------------
-- 2. Volumen semanal objetivo por grupo muscular
-- ---------------------------------------------------------------------
-- {"pectoral": [10, 20], "espalda": [12, 22], ...}: series semanales mínimas y máximas.
-- Sin valor, la app usa un rango orientativo general. Solo lo cambia el coach.
alter table public.atletas add column if not exists volumen_objetivo jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.atletas'::regclass and conname = 'atletas_volumen_objetivo_objeto') then
    alter table public.atletas add constraint atletas_volumen_objetivo_objeto
      check (volumen_objetivo is null or jsonb_typeof(volumen_objetivo) = 'object');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. Permisos de las funciones nuevas
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Apuntada: desde aquí, la base no deja repetir por error las migraciones anteriores a esta
insert into public.fbe_migraciones (numero) values (3)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;

-- ============================== migraciones/004_notas_y_respuestas.sql ==============================
-- =====================================================================
-- FBE Atletas, migración 004 (v0.4)
-- 1. Notas fijadas por ejercicio: lo que el atleta quiere recordar cada vez que lo hace
--    («sillín en el 4», «agarre en la marca»). Una por atleta y ejercicio.
-- 2. Respuestas guardadas del coach: textos habituales para contestar rápido.
--
-- Se ejecuta en el SQL Editor después de schema.sql, 002 y 003. Se puede repetir sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guardia: si la base ya tiene una migración posterior, esta no se repite (desharía lo que
-- cambiaron las siguientes). Al terminar, queda apuntada en fbe_migraciones.
-- ---------------------------------------------------------------------
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
  if v > 4 then
    raise exception 'Esta base ya tiene la migración %: repetir la 004 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 4;» y, después de ella, todas las siguientes en orden.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Notas fijadas por ejercicio
-- ---------------------------------------------------------------------
create table if not exists public.notas_ejercicio (
  id              uuid primary key default gen_random_uuid(),
  atleta_id       uuid not null references public.atletas(id) on delete cascade,
  ejercicio_id    uuid not null references public.ejercicios(id) on delete cascade,
  texto           text not null check (char_length(texto) between 1 and 500),
  actualizado_en  timestamptz not null default now(),
  unique (atleta_id, ejercicio_id)
);
create index if not exists notas_ejercicio_atleta_idx on public.notas_ejercicio (atleta_id);

create or replace function public.nota_ejercicio_fecha() returns trigger
language plpgsql set search_path = public as $$
begin
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists notas_ejercicio_fecha on public.notas_ejercicio;
create trigger notas_ejercicio_fecha before insert or update on public.notas_ejercicio
  for each row execute function public.nota_ejercicio_fecha();

-- De baja no se escribe (como en 003)
drop trigger if exists notas_ejercicio_exigir_alta on public.notas_ejercicio;
create trigger notas_ejercicio_exigir_alta before insert or update on public.notas_ejercicio
  for each row execute function public.exigir_alta();

alter table public.notas_ejercicio enable row level security;
drop policy if exists coach_todo on public.notas_ejercicio;
create policy coach_todo on public.notas_ejercicio for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.notas_ejercicio;
create policy atleta_ver on public.notas_ejercicio for select to authenticated
  using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_crear on public.notas_ejercicio;
create policy atleta_crear on public.notas_ejercicio for insert to authenticated
  with check (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_editar on public.notas_ejercicio;
create policy atleta_editar on public.notas_ejercicio for update to authenticated
  using (atleta_id = public.mi_atleta_id()) with check (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_borrar on public.notas_ejercicio;
create policy atleta_borrar on public.notas_ejercicio for delete to authenticated
  using (atleta_id = public.mi_atleta_id());

-- ---------------------------------------------------------------------
-- 2. Respuestas guardadas del coach ({nombre} se cambia por el nombre del atleta al usarla)
-- ---------------------------------------------------------------------
create table if not exists public.respuestas_guardadas (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null check (char_length(titulo) between 1 and 80),
  texto      text not null check (char_length(texto) between 1 and 4000),
  orden      int not null default 0,
  creado_en  timestamptz not null default now()
);

alter table public.respuestas_guardadas enable row level security;
drop policy if exists coach_todo on public.respuestas_guardadas;
create policy coach_todo on public.respuestas_guardadas for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
-- Sin política para atletas: no las ven.

-- ---------------------------------------------------------------------
-- 3. Permisos
-- ---------------------------------------------------------------------
revoke all on public.notas_ejercicio, public.respuestas_guardadas from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Apuntada: desde aquí, la base no deja repetir por error las migraciones anteriores a esta
insert into public.fbe_migraciones (numero) values (4)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;

-- ============================== migraciones/005_preparacion.sql ==============================
-- =====================================================================
-- FBE Atletas, migración 005 (v0.6)
-- «¿Cómo llegas hoy?»: antes de empezar una sesión, el atleta dice cómo ha dormido, cómo tiene
-- la energía y si tiene agujetas o molestias (1 = mal, 2 = normal, 3 = bien). La app le aconseja
-- según eso y el coach lo ve en el registro de la sesión.
-- Son datos de salud: solo se guardan con el consentimiento explícito del atleta.
--
-- Se ejecuta en el SQL Editor después de schema.sql, 002, 003 y 004. Se puede repetir sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guardia: si la base ya tiene una migración posterior, esta no se repite (desharía lo que
-- cambiaron las siguientes). Al terminar, queda apuntada en fbe_migraciones.
-- ---------------------------------------------------------------------
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
  if v > 5 then
    raise exception 'Esta base ya tiene la migración %: repetir la 005 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 5;» y, después de ella, todas las siguientes en orden.';
  end if;
end $$;

alter table public.sesiones add column if not exists preparacion jsonb;

-- Forma exacta: { "sueno": 1-3, "energia": 1-3, "molestias": 1-3 } y nada más
alter table public.sesiones drop constraint if exists sesiones_preparacion_valida;
alter table public.sesiones add constraint sesiones_preparacion_valida check (
  preparacion is null or coalesce(
    jsonb_typeof(preparacion) = 'object'
    and preparacion ?& array['sueno', 'energia', 'molestias']  -- las tres (sin esto, una que falta daría null y pasaría)
    and preparacion - array['sueno', 'energia', 'molestias'] = '{}'::jsonb
    and jsonb_typeof(preparacion -> 'sueno') = 'number' and (preparacion ->> 'sueno') in ('1', '2', '3')
    and jsonb_typeof(preparacion -> 'energia') = 'number' and (preparacion ->> 'energia') in ('1', '2', '3')
    and jsonb_typeof(preparacion -> 'molestias') = 'number' and (preparacion ->> 'molestias') in ('1', '2', '3'),
    false)
);

-- Solo se guarda (o se cambia) si el atleta dueño de la sesión tiene dado el consentimiento de datos de salud,
-- la escriba quien la escriba desde la app (también el coach). Vaciarla se puede siempre.
-- ¿Tiene consentimiento de salud el atleta de esta semana? Solo responde al propio atleta y al coach
-- (a cualquier otro le devuelve false: no revela nada de nadie).
create or replace function public.consentimiento_salud_de_semana(p_semana uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.semanas w
    join public.bloques b on b.id = w.bloque_id
    join public.atletas a on a.id = b.atleta_id
    join public.consentimientos c on c.perfil_id = a.perfil_id
    where w.id = p_semana and c.tipo = 'datos_salud' and c.revocado_en is null
      and (b.atleta_id = public.mi_atleta_id() or public.es_coach()));
$$;

create or replace function public.preparacion_con_consentimiento() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.preparacion is not null
     and (tg_op = 'INSERT' or new.preparacion is distinct from old.preparacion)
     and not public.consentimiento_salud_de_semana(new.semana_id) then
    raise exception 'Para guardar cómo llega a la sesión hace falta el consentimiento de datos de salud del atleta' using errcode = '42501';
  end if;
  return new;
end $$;
-- Sin «of preparacion» y en altas y cambios, para ver el valor final venga de donde venga. Los BEFORE triggers
-- se ejecutan por orden alfabético: el «zz» lo pone el último, después de cualquier otro que pudiera tocarla.
drop trigger if exists sesiones_preparacion_consentimiento on public.sesiones;
drop trigger if exists sesiones_zz_preparacion_consentimiento on public.sesiones;
create trigger sesiones_zz_preparacion_consentimiento before insert or update on public.sesiones
  for each row execute function public.preparacion_con_consentimiento();

-- ---------------------------------------------------------------------
-- Permisos (como al final de 003 y 004)
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Apuntada: desde aquí, la base no deja repetir por error las migraciones anteriores a esta
insert into public.fbe_migraciones (numero) values (5)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;

-- ============================== migraciones/006_avisos.sql ==============================
-- =====================================================================
-- FBE Atletas, migración 006 (v0.7)
-- Avisos del coach: un mensaje fijado en Hoy («del 3 al 9 de noviembre respondo más tarde»),
-- para todos los atletas o para uno, entre dos fechas. El atleta solo ve los suyos y los generales,
-- y solo mientras están en vigor.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 005. Se puede repetir sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guardia: si la base ya tiene una migración posterior, esta no se repite (desharía lo que
-- cambiaron las siguientes). Al terminar, queda apuntada en fbe_migraciones.
-- ---------------------------------------------------------------------
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
  if v > 6 then
    raise exception 'Esta base ya tiene la migración %: repetir la 006 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 6;» y, después de ella, todas las siguientes en orden.';
  end if;
end $$;

create table if not exists public.avisos (
  id         uuid primary key default gen_random_uuid(),
  texto      text not null,
  atleta_id  uuid references public.atletas(id) on delete cascade,  -- null = para todos
  desde      date not null default ((now() at time zone 'Europe/Madrid')::date),
  hasta      date,
  creado_en  timestamptz not null default now()
);
create index if not exists avisos_atleta_idx on public.avisos (atleta_id);

-- Reglas con nombre (se quitan y se vuelven a poner: repetir la migración aplica la versión vigente).
-- Texto de 1 a 600 caracteres con algo visible (no solo espacios, saltos de línea, espacios duros o invisibles);
-- fechas razonables y el final no antes del inicio.
alter table public.avisos drop constraint if exists avisos_texto_check;
alter table public.avisos drop constraint if exists avisos_check;
alter table public.avisos drop constraint if exists avisos_texto_valido;
alter table public.avisos add constraint avisos_texto_valido
  check (char_length(texto) between 1 and 600 and texto ~ E'[^[:space:]\u00a0\u200b\ufeff]');
alter table public.avisos drop constraint if exists avisos_fechas_validas;
alter table public.avisos add constraint avisos_fechas_validas
  check (desde < date '2100-01-01' and (hasta is null or (hasta >= desde and hasta < date '2100-01-01')));
alter table public.avisos alter column desde set default ((now() at time zone 'Europe/Madrid')::date);

alter table public.avisos enable row level security;
drop policy if exists coach_todo on public.avisos;
create policy coach_todo on public.avisos for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
-- El atleta (con la cuenta ya vinculada a su ficha) ve los generales y los suyos, solo en vigor; no escribe nada
drop policy if exists atleta_ver on public.avisos;
create policy atleta_ver on public.avisos for select to authenticated
  using (
    public.mi_atleta_id() is not null
    and (atleta_id is null or atleta_id = public.mi_atleta_id())
    -- «hoy» en hora de España (Supabase trabaja en UTC; la app usa la fecha del móvil)
    and desde <= (now() at time zone 'Europe/Madrid')::date
    and (hasta is null or hasta >= (now() at time zone 'Europe/Madrid')::date)
  );

-- ---------------------------------------------------------------------
-- Permisos (como al final de 003 a 005)
-- ---------------------------------------------------------------------
revoke all on public.avisos from anon;
grant select, insert, update, delete on public.avisos to authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Apuntada: desde aquí, la base no deja repetir por error las migraciones anteriores a esta
insert into public.fbe_migraciones (numero) values (6)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;

-- ============================== migraciones/007_objetivos_fuerza.sql ==============================
-- =====================================================================
-- FBE Atletas, migración 007 (v0.8)
-- Objetivos de fuerza que avanzan solos: un objetivo puede enlazarse a un ejercicio con una marca
-- («press banca 62,5 kg × 1»). La app calcula el progreso con el 1RM estimado del atleta desde que se
-- puso el objetivo (e1rm_inicio) y estima para cuándo llegaría a su ritmo.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 006. Se puede repetir sin romper
-- nada, y si se repite una versión corregida, se aplica la corrección (las restricciones tienen nombre y se
-- vuelven a crear).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guardia: si la base ya tiene una migración posterior, esta no se repite (desharía lo que
-- cambiaron las siguientes). Al terminar, queda apuntada en fbe_migraciones.
-- ---------------------------------------------------------------------
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
  if v > 7 then
    raise exception 'Esta base ya tiene la migración %: repetir la 007 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 7;» y, después de ella, todas las siguientes en orden.';
  end if;
end $$;

alter table public.objetivos add column if not exists ejercicio_id  uuid;
alter table public.objetivos add column if not exists kg_objetivo   numeric(6,2);
alter table public.objetivos add column if not exists reps_objetivo smallint;
alter table public.objetivos add column if not exists e1rm_inicio   numeric(6,1);
-- Desde cuándo cuenta (solo valen las series registradas desde ese momento para darlo por conseguido).
-- La app lo pone de nuevo cuando el coach enlaza el objetivo a otro ejercicio.
alter table public.objetivos add column if not exists creado_en     timestamptz not null default now();

-- Si se borra el ejercicio de la biblioteca, el objetivo se queda como manual (no se borra)
alter table public.objetivos drop constraint if exists objetivos_ejercicio_id_fkey;
alter table public.objetivos add constraint objetivos_ejercicio_id_fkey
  foreign key (ejercicio_id) references public.ejercicios(id) on delete set null;
create index if not exists objetivos_ejercicio_idx on public.objetivos (ejercicio_id);

-- Sin ejercicio no hay marca: se limpian los kilos, las repeticiones y el punto de partida
-- (también cuando el ejercicio se borra y la clave pasa a null)
create or replace function public.objetivos_limpiar_marca()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.ejercicio_id is null then
    new.kg_objetivo := null;
    new.reps_objetivo := null;
    new.e1rm_inicio := null;
  end if;
  return new;
end $$;
drop trigger if exists objetivos_zz_marca on public.objetivos;
create trigger objetivos_zz_marca before insert or update on public.objetivos
  for each row execute function public.objetivos_limpiar_marca();

-- Marca con sentido: carga y repeticiones razonables (el 1RM estimado solo vale hasta 12 repeticiones);
-- si hay ejercicio, hay marca. Las filas de una versión anterior que no cumplan se quedan como manuales.
alter table public.objetivos drop constraint if exists objetivos_marca_valida;
update public.objetivos set ejercicio_id = null
where not (
  (kg_objetivo is null or kg_objetivo between 0.5 and 1000)
  and (reps_objetivo is null or reps_objetivo between 1 and 12)
  and (e1rm_inicio is null or e1rm_inicio between 0 and 2000)
  and (ejercicio_id is null or (kg_objetivo is not null and reps_objetivo is not null))
);
alter table public.objetivos add constraint objetivos_marca_valida check (
  (kg_objetivo is null or kg_objetivo between 0.5 and 1000)
  and (reps_objetivo is null or reps_objetivo between 1 and 12)
  and (e1rm_inicio is null or e1rm_inicio between 0 and 2000)
  and (ejercicio_id is null or (kg_objetivo is not null and reps_objetivo is not null))
);

-- Los permisos de objetivos no cambian: el coach los gestiona y el atleta solo los lee.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Apuntada: desde aquí, la base no deja repetir por error las migraciones anteriores a esta
insert into public.fbe_migraciones (numero) values (7)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;

-- ============================== migraciones/008_habitos_y_plan.sql ==============================
-- =====================================================================
-- FBE Atletas, migración 008 (v0.10)
-- 1. Hábitos diarios: el coach le pone a cada atleta unos pocos hábitos (pasos, proteína, agua, sueño
--    o uno de sí/no) con su objetivo, y el atleta los apunta cada día. Con consentimiento de salud.
-- 2. Serie top + back-off: en una pauta, la primera serie es la top y el resto van un % por debajo de
--    lo que el atleta hizo de verdad en ella (la app calcula la carga).
-- 3. Pose de las fotos de progreso (frente, perfil, espalda), para comparar siempre la misma.
-- 4. Plan de la semana: el atleta elige qué día hará cada sesión (sin que la sesión vuelva a
--    «por revisar» por eso). Si el coach mueve la semana, el plan se mueve con ella.
-- 5. Series: mismo error para una pauta ajena que para una que no existe.
-- Y desde esta versión, cada migración (002 a 008) se apunta en fbe_migraciones al terminar y se niega
-- a repetirse si la base ya tiene una posterior (repetir la 002 sobre la 008 deshacía cambios en silencio).
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 007. Se puede repetir sin
-- romper nada: las restricciones tienen nombre y se vuelven a crear con la versión vigente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guardia: si la base ya tiene una migración posterior, esta no se repite (desharía lo que
-- cambiaron las siguientes). Al terminar, queda apuntada en fbe_migraciones.
-- ---------------------------------------------------------------------
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
  if v > 8 then
    raise exception 'Esta base ya tiene la migración %: repetir la 008 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 8;» y, después de ella, todas las siguientes en orden.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Hábitos
-- ---------------------------------------------------------------------
create table if not exists public.habitos (
  id           uuid primary key default gen_random_uuid(),
  atleta_id    uuid not null references public.atletas(id) on delete cascade,
  nombre       text not null,
  tipo         text not null default 'numero',
  objetivo     numeric(8,2),
  unidad       text,
  sentido      text not null default 'al_menos',  -- al_menos: llegar al objetivo · como_mucho: no pasarse
  dias_semana  smallint not null default 7,       -- cuántos días a la semana se pide
  icono        text not null default 'libre',
  orden        smallint not null default 0,
  activo       boolean not null default true,     -- se archiva en lugar de borrarlo, para no perder lo apuntado
  creado_en    timestamptz not null default now()
);
create index if not exists habitos_atleta_idx on public.habitos (atleta_id);

-- El nombre (y la unidad) tienen que llevar algo visible: no valen solo espacios ni caracteres invisibles
alter table public.habitos drop constraint if exists habitos_valido;
alter table public.habitos add constraint habitos_valido check (
  char_length(nombre) between 1 and 60 and nombre ~ E'[^[:space:]\u00a0\u00ad\u115f\u1160\u180e\u200b-\u200f\u2060-\u2064\u2800\u3164\ufeff\uffa0]'
  and tipo in ('numero', 'si_no')
  and sentido in ('al_menos', 'como_mucho')
  and dias_semana between 1 and 7
  and icono in ('pasos', 'proteina', 'agua', 'sueno', 'movilidad', 'verdura', 'libre')
  and orden between 0 and 99
  and (unidad is null or (char_length(unidad) between 1 and 12 and unidad ~ E'[^[:space:]\u00a0\u00ad\u115f\u1160\u180e\u200b-\u200f\u2060-\u2064\u2800\u3164\ufeff\uffa0]'))
  and case tipo
        when 'numero' then objetivo is not null and objetivo > 0 and objetivo < 1000000
        else objetivo is null and unidad is null and sentido = 'al_menos'
      end
);

alter table public.habitos enable row level security;
drop policy if exists coach_todo on public.habitos;
create policy coach_todo on public.habitos for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
-- El atleta ve los suyos (también los archivados, para su historial); no los cambia
drop policy if exists atleta_ver on public.habitos;
create policy atleta_ver on public.habitos for select to authenticated
  using (atleta_id = public.mi_atleta_id());

-- Un hábito no cambia de atleta (sus días apuntados quedarían con el anterior) ni, si ya tiene días
-- apuntados, de número a sí/no o al revés (9000 pasos pasarían a ser «hecho»). Para eso se quita y se crea otro.
create or replace function public.proteger_habito() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.atleta_id is distinct from old.atleta_id then
    raise exception 'Un hábito no se puede pasar a otro atleta: créale uno nuevo' using errcode = '42501';
  end if;
  if new.tipo is distinct from old.tipo and exists (select 1 from public.registros_habito r where r.habito_id = old.id) then
    raise exception 'Este hábito ya tiene días apuntados: para apuntarlo de otra forma, quítalo y crea otro' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists habitos_proteger on public.habitos;
create trigger habitos_proteger before update on public.habitos
  for each row execute function public.proteger_habito();

create table if not exists public.registros_habito (
  id              uuid primary key default gen_random_uuid(),
  habito_id       uuid not null references public.habitos(id) on delete cascade,
  atleta_id       uuid not null references public.atletas(id) on delete cascade,  -- lo pone el trigger
  fecha           date not null,
  valor           numeric(9,2) not null,  -- en los de sí/no: 1 hecho, 0 no · dos decimales: 0,25 l, 7,5 h
  actualizado_en  timestamptz not null default now(),
  unique (habito_id, fecha)
);
create index if not exists registros_habito_atleta_idx on public.registros_habito (atleta_id, fecha desc);
-- Dos decimales (0,25 l de agua): por si se creó con una versión anterior de esta migración, que guardaba uno
alter table public.habitos alter column objetivo type numeric(8,2);
alter table public.registros_habito alter column valor type numeric(9,2);

alter table public.registros_habito drop constraint if exists registros_habito_valor_valido;
alter table public.registros_habito add constraint registros_habito_valor_valido
  check (valor >= 0 and valor < 1000000 and fecha >= date '2020-01-01' and fecha < date '2100-01-01');

-- ¿Tiene consentimiento de salud este atleta? Solo responde al propio atleta y al coach
-- (a cualquier otro le devuelve false: no revela nada de nadie). Como consentimiento_salud_de_semana (005).
create or replace function public.consentimiento_salud_de_atleta(p_atleta uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.atletas a
    join public.consentimientos c on c.perfil_id = a.perfil_id
    where a.id = p_atleta and c.tipo = 'datos_salud' and c.revocado_en is null
      and (a.id = public.mi_atleta_id() or public.es_coach()));
$$;

-- El atleta de cada registro es siempre el del hábito; los de sí/no solo valen 0 o 1; nada en el futuro
-- (con un día de margen por las zonas horarias) y nada en un hábito archivado (salvo el coach).
-- Son datos de salud: como en 005, hace falta el consentimiento del atleta los escriba quien los escriba
-- desde la app (también el coach). Borrarlos se puede siempre.
-- Sin «security definer» a propósito: el hábito se lee con los permisos de quien escribe, así que a un atleta
-- uno ajeno le resulta igual de invisible que uno que no existe (y current_user sigue siendo el suyo).
create or replace function public.registro_habito_preparar()
returns trigger language plpgsql set search_path = '' as $$
declare
  h public.habitos;
begin
  select * into h from public.habitos where id = new.habito_id;
  -- A quien no es el coach, un hábito que no existe y uno de otro atleta le dan el mismo error (no revela nada)
  if not found or (current_user in ('authenticated', 'anon') and not public.es_coach()
                   and h.atleta_id is distinct from public.mi_atleta_id()) then
    raise exception 'No puedes apuntar en ese hábito' using errcode = '42501';
  end if;
  new.atleta_id := h.atleta_id;
  new.actualizado_en := now();
  if h.tipo = 'si_no' and new.valor not in (0, 1) then
    raise exception 'Un hábito de sí o no se apunta con 1 (hecho) o 0 (no)' using errcode = '23514';
  end if;
  if current_user in ('authenticated', 'anon') and not public.consentimiento_salud_de_atleta(h.atleta_id) then
    raise exception 'Para apuntar hábitos hace falta el consentimiento de datos de salud del atleta' using errcode = '42501';
  end if;
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    if not h.activo then
      raise exception 'Ese hábito ya no está activo' using errcode = '42501';
    end if;
    if new.fecha > (now() at time zone 'Europe/Madrid')::date + 1 then
      raise exception 'No se puede apuntar un día que aún no ha llegado' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
-- «aa» para que vaya antes que el de la baja y el resto (los BEFORE van por orden alfabético)
drop trigger if exists registros_habito_aa_preparar on public.registros_habito;
create trigger registros_habito_aa_preparar before insert or update on public.registros_habito
  for each row execute function public.registro_habito_preparar();
drop trigger if exists registros_habito_exigir_alta on public.registros_habito;
create trigger registros_habito_exigir_alta before insert or update on public.registros_habito
  for each row execute function public.exigir_alta();

alter table public.registros_habito enable row level security;
drop policy if exists coach_todo on public.registros_habito;
create policy coach_todo on public.registros_habito for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
-- Como el resto de datos de salud: los suyos, y para escribir, con consentimiento vigente
drop policy if exists atleta_ver on public.registros_habito;
create policy atleta_ver on public.registros_habito for select to authenticated
  using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_crear on public.registros_habito;
create policy atleta_crear on public.registros_habito for insert to authenticated
  with check (atleta_id = public.mi_atleta_id() and public.tiene_consentimiento_salud());
drop policy if exists atleta_editar on public.registros_habito;
create policy atleta_editar on public.registros_habito for update to authenticated
  using (atleta_id = public.mi_atleta_id())
  with check (atleta_id = public.mi_atleta_id() and public.tiene_consentimiento_salud());
drop policy if exists atleta_borrar on public.registros_habito;
create policy atleta_borrar on public.registros_habito for delete to authenticated
  using (atleta_id = public.mi_atleta_id());

-- ---------------------------------------------------------------------
-- 2. Serie top + back-off
-- ---------------------------------------------------------------------
alter table public.sesion_ejercicios add column if not exists backoff_pct numeric(4,1);
alter table public.sesion_ejercicios drop constraint if exists sesion_ejercicios_backoff_valido;
alter table public.sesion_ejercicios add constraint sesion_ejercicios_backoff_valido
  check (backoff_pct is null or (backoff_pct >= 1 and backoff_pct <= 50 and series >= 2));

-- Las funciones de copia (por si se usan desde el SQL Editor) copian también el back-off
create or replace function public.duplicar_semana(
  p_semana uuid, p_kg_extra numeric default 0, p_reps_extra int default 0, p_rir_delta numeric default 0)
returns uuid language plpgsql set search_path = public as $$
declare
  v_old   public.semanas;
  v_nueva uuid;
  s       record;
  v_ses   uuid;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  select * into v_old from public.semanas where id = p_semana;
  if not found then raise exception 'Semana no encontrada'; end if;

  insert into public.semanas (bloque_id, numero, foco, fecha_inicio, programacion)
  values (v_old.bloque_id,
          (select max(numero) + 1 from public.semanas where bloque_id = v_old.bloque_id),
          v_old.foco, v_old.fecha_inicio + 7, 'en_programacion')
  returning id into v_nueva;

  for s in select * from public.sesiones where semana_id = p_semana order by orden loop
    insert into public.sesiones (semana_id, orden, nombre, tipo, intencion, dinamica)
    values (v_nueva, s.orden, s.nombre, s.tipo, s.intencion, s.dinamica)
    returning id into v_ses;

    insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, superserie, prioridad, series,
      reps_min, reps_max, rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante,
      backoff_pct)
    select v_ses, ejercicio_id, orden, superserie, prioridad, series,
           reps_min + p_reps_extra, reps_max + p_reps_extra,
           greatest(rir_objetivo + p_rir_delta, 0), rpe_objetivo,
           case when carga_sugerida_kg is null then null else carga_sugerida_kg + p_kg_extra end,
           descanso_seg, tempo, notas_coach, variante, backoff_pct
    from public.sesion_ejercicios where sesion_id = s.id;
  end loop;
  return v_nueva;
end $$;

create or replace function public.crear_bloque_desde_plantilla(
  p_plantilla uuid, p_atleta uuid, p_fecha_inicio date, p_numero int default null)
returns uuid language plpgsql set search_path = public as $$
declare
  v_pl     public.bloques;
  v_bloque uuid;
  w        record;
  s        record;
  v_sem    uuid;
  v_ses    uuid;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  select * into v_pl from public.bloques where id = p_plantilla and es_plantilla;
  if not found then raise exception 'Plantilla no encontrada'; end if;

  insert into public.bloques (atleta_id, numero, nombre, foco, objetivo, descripcion, fecha_inicio, estado)
  values (p_atleta,
          coalesce(p_numero, (select coalesce(max(numero), 0) + 1 from public.bloques where atleta_id = p_atleta)),
          v_pl.nombre, v_pl.foco, v_pl.objetivo, v_pl.descripcion, p_fecha_inicio, 'planificado')
  returning id into v_bloque;

  for w in select * from public.semanas where bloque_id = p_plantilla order by numero loop
    insert into public.semanas (bloque_id, numero, foco, fecha_inicio, nota_coach, programacion)
    values (v_bloque, w.numero, w.foco, p_fecha_inicio + (w.numero - 1) * 7, w.nota_coach, 'en_programacion')
    returning id into v_sem;
    for s in select * from public.sesiones where semana_id = w.id order by orden loop
      insert into public.sesiones (semana_id, orden, nombre, tipo, intencion, dinamica)
      values (v_sem, s.orden, s.nombre, s.tipo, s.intencion, s.dinamica)
      returning id into v_ses;
      insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, superserie, prioridad, series,
        reps_min, reps_max, rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante,
        backoff_pct)
      select v_ses, ejercicio_id, orden, superserie, prioridad, series, reps_min, reps_max,
             rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante, backoff_pct
      from public.sesion_ejercicios where sesion_id = s.id;
    end loop;
  end loop;
  return v_bloque;
end $$;

-- ---------------------------------------------------------------------
-- 3. Pose de las fotos de progreso
-- ---------------------------------------------------------------------
alter table public.archivos add column if not exists pose text;
alter table public.archivos drop constraint if exists archivos_pose_valida;
alter table public.archivos add constraint archivos_pose_valida
  check (pose is null or (tipo = 'foto_progreso' and pose in ('frente', 'perfil', 'espalda')));

-- ---------------------------------------------------------------------
-- 4. Plan de la semana
-- ---------------------------------------------------------------------
alter table public.sesiones add column if not exists dia_previsto date;

-- El día previsto tiene que caer en la semana de la sesión (de su lunes a su domingo). Si la sesión
-- cambia de semana (solo lo puede hacer el coach), el día previsto se quita, salvo que venga uno nuevo.
-- Sin «security definer» a propósito: la semana se lee con los permisos de quien escribe, así que a un
-- atleta una semana ajena (o aún sin publicar) le da el mismo error que una que no existe.
create or replace function public.sesion_dia_previsto_valido()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_inicio date;
begin
  if tg_op = 'UPDATE' and new.semana_id is distinct from old.semana_id
     and new.dia_previsto is not distinct from old.dia_previsto then
    new.dia_previsto := null;
  end if;
  if new.dia_previsto is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.dia_previsto is not distinct from old.dia_previsto
     and new.semana_id is not distinct from old.semana_id then
    return new;
  end if;
  select fecha_inicio into v_inicio from public.semanas where id = new.semana_id;
  if v_inicio is null or new.dia_previsto < v_inicio or new.dia_previsto > v_inicio + 6 then
    raise exception 'El día previsto tiene que estar dentro de la semana de la sesión' using errcode = '23514';
  end if;
  return new;
end $$;
-- «q» para que vaya después de la baja y de sesiones_proteger (los BEFORE van por orden alfabético):
-- quien no puede tocar la sesión recibe ese error, no uno sobre la fecha
drop trigger if exists sesiones_dia_previsto on public.sesiones;
drop trigger if exists sesiones_q_dia_previsto on public.sesiones;
create trigger sesiones_q_dia_previsto before insert or update on public.sesiones
  for each row execute function public.sesion_dia_previsto_valido();

-- Lo que cambia el atleta en una sesión vuelve a quedar pendiente de revisar, salvo si solo cambia el día
-- previsto (planificar la semana no es algo que revisar). La prescripción sigue siendo solo del coach.
create or replace function public.proteger_sesion() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    if (new.id, new.semana_id, new.orden, new.nombre, new.tipo, new.intencion, new.dinamica)
       is distinct from
       (old.id, old.semana_id, old.orden, old.nombre, old.tipo, old.intencion, old.dinamica) then
      raise exception 'Solo el coach puede cambiar la prescripción de la sesión' using errcode = '42501';
    end if;
    if (to_jsonb(new) - 'dia_previsto' - 'revisada_en') is distinct from (to_jsonb(old) - 'dia_previsto' - 'revisada_en') then
      new.revisada_en := null;
    else
      new.revisada_en := old.revisada_en;
    end if;
  end if;
  return new;
end $$;

-- Si el coach mueve una semana de fecha, el plan del atleta se mueve con ella (mismo día de la semana)
create or replace function public.semana_mover_plan()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.fecha_inicio is distinct from old.fecha_inicio then
    if new.fecha_inicio is null or old.fecha_inicio is null then
      update public.sesiones set dia_previsto = null where semana_id = new.id and dia_previsto is not null;
    else
      update public.sesiones set dia_previsto = dia_previsto + (new.fecha_inicio - old.fecha_inicio)
      where semana_id = new.id and dia_previsto is not null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists semanas_mover_plan on public.semanas;
create trigger semanas_mover_plan after update of fecha_inicio on public.semanas
  for each row execute function public.semana_mover_plan();

-- ---------------------------------------------------------------------
-- 5. Series: a un atleta, una pauta ajena, una de plantilla y una que no existe le dan el mismo error
--    (antes, la ajena daba el de permisos y las otras el de plantilla: confirmaba que existía).
--    Es «security definer» (lee la pauta aunque el atleta no la vea), así que se distingue por quién
--    ha entrado, no por current_user.
-- ---------------------------------------------------------------------
create or replace function public.serie_fijar_atleta() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_yo uuid := public.mi_atleta_id();
begin
  select b.atleta_id into new.atleta_id
  from public.sesion_ejercicios se
  join public.sesiones s on s.id = se.sesion_id
  join public.semanas w on w.id = s.semana_id
  join public.bloques b on b.id = w.bloque_id
  where se.id = new.sesion_ejercicio_id;
  if v_yo is not null and not public.es_coach() then
    if new.atleta_id is distinct from v_yo then
      raise exception 'No puedes registrar series en esa pauta' using errcode = '42501';
    end if;
  elsif new.atleta_id is null then
    raise exception 'No se pueden registrar series en una plantilla';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Permisos (como al final de 003 a 007)
-- ---------------------------------------------------------------------
revoke all on public.habitos, public.registros_habito from anon;
grant select, insert, update, delete on public.habitos, public.registros_habito to authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Apuntada: desde aquí, la base no deja repetir por error las migraciones anteriores a esta
insert into public.fbe_migraciones (numero) values (8)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;

-- ============================== migraciones/009_nutricion.sql ==============================
-- =====================================================================
-- FBE Atletas, migración 009 (v0.11): nutrición
-- 1. Planes de nutrición: los pone el coach para cada atleta, por versiones (cada cambio vale desde una
--    fecha y los anteriores se quedan como historial). Tres modos: «macros» (kcal, proteína, hidratos y
--    grasa), «kcal_proteina» (solo kcal y proteína) y «sin_contar» (pautas y un «¿has seguido el plan?»).
--    Si se quiere, los días de descanso llevan otras kcal (y otros hidratos y grasa).
-- 2. Registro diario: el atleta apunta los totales del día (de la app con la que cuente) o si ha seguido
--    el plan. Son datos de salud: hace falta su consentimiento, lo escriba quien lo escriba desde la app.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 008. Se puede repetir sin
-- romper nada: las restricciones tienen nombre y se vuelven a crear con la versión vigente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guardia: si la base ya tiene una migración posterior, esta no se repite (desharía lo que
-- cambiaron las siguientes). Al terminar, queda apuntada en fbe_migraciones.
-- ---------------------------------------------------------------------
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
  if v > 9 then
    raise exception 'Esta base ya tiene la migración %: repetir la 009 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 9;» y, después de ella, todas las siguientes en orden.';
  end if;
  -- Y antes, la anterior: la 009 usa funciones de la 008 (sin ella, fallaría luego con errores raros)
  if not exists (select 1 from public.fbe_migraciones where numero = 8) then
    raise exception 'Antes de la 009 hace falta la 008: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 0. Texto con algo visible: no valen solo espacios (de cualquier tipo), saltos de línea, caracteres de
--    control, de formato o invisibles (de ancho cero, de dirección del texto, selectores de variante,
--    etiquetas…). Una sola regla para todos los textos que escribe la gente: avisos (006), hábitos (008)
--    y nutrición (abajo). Inmutable, para poder usarla en las restricciones.
-- ---------------------------------------------------------------------
create or replace function public.texto_visible(t text) returns boolean
language sql immutable strict set search_path = '' as $$
  select regexp_replace(t, E'[[:space:]\u0001-\u001f\u007f-\u009f\u00a0\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u1680\u2000-\u200f\u2028-\u202f\u205f-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff9-\ufffc\U0001d173-\U0001d17a\U000e0000-\U000e007f]', '', 'g') <> ''
$$;

alter table public.avisos drop constraint if exists avisos_texto_valido;
alter table public.avisos add constraint avisos_texto_valido
  check (char_length(texto) between 1 and 600 and public.texto_visible(texto));

alter table public.habitos drop constraint if exists habitos_valido;
alter table public.habitos add constraint habitos_valido check (
  char_length(nombre) between 1 and 60 and public.texto_visible(nombre)
  and tipo in ('numero', 'si_no')
  and sentido in ('al_menos', 'como_mucho')
  and dias_semana between 1 and 7
  and icono in ('pasos', 'proteina', 'agua', 'sueno', 'movilidad', 'verdura', 'libre')
  and orden between 0 and 99
  and (unidad is null or (char_length(unidad) between 1 and 12 and public.texto_visible(unidad)))
  and case tipo
        when 'numero' then objetivo is not null and objetivo > 0 and objetivo < 1000000
        else objetivo is null and unidad is null and sentido = 'al_menos'
      end
);

-- ---------------------------------------------------------------------
-- 1. Planes de nutrición
-- ---------------------------------------------------------------------
create table if not exists public.planes_nutricion (
  id                 uuid primary key default gen_random_uuid(),
  atleta_id          uuid not null references public.atletas(id) on delete cascade,
  desde              date not null,                   -- vale desde este día hasta el siguiente plan
  modo               text not null default 'macros',  -- macros · kcal_proteina · sin_contar
  fase               text not null default 'mantener',-- perder · mantener · ganar · recomposicion
  ritmo_pct          numeric(3,2),                    -- % del peso por semana (−1,50 a +1,00; negativo = bajar)
  kcal               smallint,                        -- días de entreno (o todos, si no hay de descanso)
  proteina_g         smallint,
  carbos_g           smallint,
  grasa_g            smallint,
  fibra_g            smallint,
  kcal_descanso      smallint,                        -- días de descanso, si son distintos
  carbos_descanso_g  smallint,
  grasa_descanso_g   smallint,
  pautas             text,                            -- lo que el atleta lee: comidas, raciones, cómo repartir
  motivo             text,                            -- por qué cambia («Ajuste: 3 semanas sin bajar»)
  creado_en          timestamptz not null default now(),
  unique (atleta_id, desde)
);
-- (la clave única (atleta_id, desde) ya sirve de índice)
drop index if exists public.planes_nutricion_atleta_idx;

-- Cifras razonables y coherentes con el modo: en «macros», kcal y los tres macros (y, si hay día de
-- descanso, sus kcal, hidratos y grasa juntos), con las kcal cuadrando con 4/4/9 kcal por gramo (±5 %, como
-- poco ±50); en «kcal_proteina», solo kcal y proteína (y las kcal dan para esa proteína); «sin_contar», sin
-- cifras. Bajar va con ritmo negativo, ganar con positivo y mantener con 0 (o sin ritmo). Los textos, con
-- algo visible.
alter table public.planes_nutricion drop constraint if exists planes_nutricion_valido;
alter table public.planes_nutricion add constraint planes_nutricion_valido check (
  modo in ('macros', 'kcal_proteina', 'sin_contar')
  and fase in ('perder', 'mantener', 'ganar', 'recomposicion')
  and desde >= date '2020-01-01' and desde < date '2100-01-01'
  and (ritmo_pct is null or ritmo_pct between -1.5 and 1)
  and (fase <> 'perder' or ritmo_pct is null or ritmo_pct < 0)
  and (fase <> 'ganar' or ritmo_pct is null or ritmo_pct > 0)
  and (fase <> 'mantener' or ritmo_pct is null or ritmo_pct = 0)
  and (kcal is null or kcal between 800 and 8000)
  and (kcal_descanso is null or kcal_descanso between 800 and 8000)
  and (proteina_g is null or proteina_g between 20 and 600)
  and (carbos_g is null or carbos_g between 0 and 1500)
  and (carbos_descanso_g is null or carbos_descanso_g between 0 and 1500)
  and (grasa_g is null or grasa_g between 10 and 500)
  and (grasa_descanso_g is null or grasa_descanso_g between 10 and 500)
  and (fibra_g is null or fibra_g between 5 and 150)
  and (pautas is null or (char_length(pautas) <= 4000 and public.texto_visible(pautas)))
  and (motivo is null or (char_length(motivo) <= 280 and public.texto_visible(motivo)))
  and case modo
        when 'macros' then kcal is not null and proteina_g is not null and carbos_g is not null and grasa_g is not null
             and (kcal_descanso is null) = (carbos_descanso_g is null)
             and (kcal_descanso is null) = (grasa_descanso_g is null)
             and abs(kcal - (4 * proteina_g + 4 * carbos_g + 9 * grasa_g)) <= greatest(50, kcal * 0.05)
             and (kcal_descanso is null
                  or abs(kcal_descanso - (4 * proteina_g + 4 * carbos_descanso_g + 9 * grasa_descanso_g)) <= greatest(50, kcal_descanso * 0.05))
        when 'kcal_proteina' then kcal is not null and proteina_g is not null
             and kcal >= 4 * proteina_g and (kcal_descanso is null or kcal_descanso >= 4 * proteina_g)
             and carbos_g is null and grasa_g is null and carbos_descanso_g is null and grasa_descanso_g is null
        else kcal is null and kcal_descanso is null and proteina_g is null and carbos_g is null and grasa_g is null
             and carbos_descanso_g is null and grasa_descanso_g is null and fibra_g is null
      end
);

-- Un plan no cambia de atleta (su historial se quedaría con el otro): se crea uno nuevo
create or replace function public.proteger_plan_nutricion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.atleta_id is distinct from old.atleta_id then
    raise exception 'Un plan de nutrición no se puede pasar a otro atleta: créale uno nuevo' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists planes_nutricion_proteger on public.planes_nutricion;
create trigger planes_nutricion_proteger before update on public.planes_nutricion
  for each row execute function public.proteger_plan_nutricion();

alter table public.planes_nutricion enable row level security;
drop policy if exists coach_todo on public.planes_nutricion;
create policy coach_todo on public.planes_nutricion for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
-- El atleta ve los suyos (también los anteriores y el que empieza el lunes); no los cambia
drop policy if exists atleta_ver on public.planes_nutricion;
create policy atleta_ver on public.planes_nutricion for select to authenticated
  using (atleta_id = public.mi_atleta_id());

-- ---------------------------------------------------------------------
-- 2. Registro diario
-- ---------------------------------------------------------------------
create table if not exists public.registros_nutricion (
  id              uuid primary key default gen_random_uuid(),
  atleta_id       uuid not null references public.atletas(id) on delete cascade,
  fecha           date not null,
  kcal            smallint,
  proteina_g      numeric(5,1),
  carbos_g        numeric(5,1),
  grasa_g         numeric(5,1),
  fibra_g         numeric(4,1),
  completo        boolean not null default true,  -- false: se dejó algo sin apuntar (no cuenta para el gasto)
  cumplido        smallint,                       -- sin contar: 2 sí · 1 casi · 0 no
  nota            text,
  actualizado_en  timestamptz not null default now(),
  unique (atleta_id, fecha)
);
drop index if exists public.registros_nutricion_atleta_idx;

alter table public.registros_nutricion drop constraint if exists registros_nutricion_valido;
alter table public.registros_nutricion add constraint registros_nutricion_valido check (
  fecha >= date '2020-01-01' and fecha < date '2100-01-01'
  and (kcal is null or kcal between 0 and 15000)
  and (proteina_g is null or proteina_g between 0 and 1500)
  and (carbos_g is null or carbos_g between 0 and 2500)
  and (grasa_g is null or grasa_g between 0 and 1000)
  and (fibra_g is null or fibra_g between 0 and 300)
  and (cumplido is null or cumplido in (0, 1, 2))
  and (nota is null or (char_length(nota) <= 280 and public.texto_visible(nota)))
  and (kcal is not null or proteina_g is not null or cumplido is not null)  -- un registro dice algo
);

-- Datos de salud, como los hábitos (008): con el consentimiento del atleta, lo escriba quien lo escriba desde
-- la app (también el coach), y el atleta nada en días que no han llegado (un día de margen por las zonas
-- horarias). Un registro no cambia de atleta. Sin «security definer» a propósito: el consentimiento se
-- consulta con consentimiento_salud_de_atleta (008), que a quien no es el propio atleta ni el coach le dice
-- que no, así que un atleta ajeno, uno inexistente y el propio sin consentimiento dan el mismo error.
create or replace function public.registro_nutricion_preparar()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.atleta_id is distinct from old.atleta_id then
    raise exception 'Un registro de nutrición no se puede pasar a otro atleta' using errcode = '42501';
  end if;
  new.actualizado_en := now();
  if current_user in ('authenticated', 'anon') then
    if not public.consentimiento_salud_de_atleta(new.atleta_id) then
      raise exception 'Para apuntar la nutrición hace falta el consentimiento de datos de salud del atleta' using errcode = '42501';
    end if;
    if not public.es_coach() and new.fecha > (now() at time zone 'Europe/Madrid')::date + 1 then
      raise exception 'No se puede apuntar un día que aún no ha llegado' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
-- «aa» para que vaya antes que el de la baja (los BEFORE van por orden alfabético)
drop trigger if exists registros_nutricion_aa_preparar on public.registros_nutricion;
create trigger registros_nutricion_aa_preparar before insert or update on public.registros_nutricion
  for each row execute function public.registro_nutricion_preparar();
drop trigger if exists registros_nutricion_exigir_alta on public.registros_nutricion;
create trigger registros_nutricion_exigir_alta before insert or update on public.registros_nutricion
  for each row execute function public.exigir_alta();

alter table public.registros_nutricion enable row level security;
drop policy if exists coach_todo on public.registros_nutricion;
create policy coach_todo on public.registros_nutricion for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.registros_nutricion;
create policy atleta_ver on public.registros_nutricion for select to authenticated
  using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_crear on public.registros_nutricion;
create policy atleta_crear on public.registros_nutricion for insert to authenticated
  with check (atleta_id = public.mi_atleta_id() and public.tiene_consentimiento_salud());
drop policy if exists atleta_editar on public.registros_nutricion;
create policy atleta_editar on public.registros_nutricion for update to authenticated
  using (atleta_id = public.mi_atleta_id())
  with check (atleta_id = public.mi_atleta_id() and public.tiene_consentimiento_salud());
drop policy if exists atleta_borrar on public.registros_nutricion;
create policy atleta_borrar on public.registros_nutricion for delete to authenticated
  using (atleta_id = public.mi_atleta_id());

-- ---------------------------------------------------------------------
-- Permisos (como al final de 003 a 008)
-- ---------------------------------------------------------------------
revoke all on public.planes_nutricion, public.registros_nutricion from anon;
grant select, insert, update, delete on public.planes_nutricion, public.registros_nutricion to authenticated;
-- Supabase da por defecto a las cuentas de la app también TRUNCATE (que no mira los permisos por fila),
-- REFERENCES y TRIGGER en cada tabla nueva. La app no los usa: fuera, en todas y en las que vengan.
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Apuntada: desde aquí, la base no deja repetir por error las migraciones anteriores a esta
insert into public.fbe_migraciones (numero) values (9)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;

-- ============================== migraciones/010_notificaciones.sql ==============================
-- =====================================================================
-- FBE Atletas, migración 010 (v0.12): notificaciones al móvil
-- 1. Suscripciones (Web Push): cada móvil u ordenador en el que alguien activa las notificaciones.
-- 2. Preferencias de cada cuenta: qué tipos quiere, a qué hora los recordatorios, «no molestar» y email.
-- 3. Notificaciones: la cola de lo que hay que enviar. La llenan los disparadores de esta migración (el
--    coach responde, publica una semana o un aviso; el atleta escribe, manda el check-in, sube un vídeo o
--    termina una sesión) y los recordatorios (sesión de hoy, check-in, hábitos y nutrición). La vacía la
--    función «enviar-notificaciones» de Supabase (supabase/functions/), que se llama cada minuto.
--
-- Las notificaciones no llevan datos de salud ni el texto de los mensajes: solo quién y dónde
-- («Pelayo te ha respondido · En Pierna A»), porque se ven con el móvil bloqueado.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 009 (o con instalar.sql en una
-- base nueva). Se puede repetir sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guardia: si la base ya tiene una migración posterior, esta no se repite (desharía lo que
-- cambiaron las siguientes). Al terminar, queda apuntada en fbe_migraciones.
-- ---------------------------------------------------------------------
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
  if v > 10 then
    raise exception 'Esta base ya tiene la migración %: repetir la 010 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 10;» y, después de ella, todas las siguientes en orden.';
  end if;
  -- Y antes, la anterior: la 010 usa texto_visible (009)
  if not exists (select 1 from public.fbe_migraciones where numero = 9) then
    raise exception 'Antes de la 010 hace falta la 009: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 0. Un esquema aparte para lo interno: lo que no debe poder llamar nadie desde la app (crear
--    notificaciones a otros, los disparadores). Supabase solo expone «public», y aquí las cuentas de la
--    app no tienen ni USAGE, así que aunque una migración futura vuelva a dar EXECUTE en «public» a todo,
--    esto sigue cerrado.
-- ---------------------------------------------------------------------
create schema if not exists fbe_privado;
revoke all on schema fbe_privado from public, anon, authenticated;
-- Y sus funciones, sin EXECUTE para nadie de entrada (por si algún día se diera USAGE en el esquema)
alter default privileges in schema fbe_privado revoke execute on functions from public;

-- ---------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------
create table if not exists public.suscripciones_push (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.perfiles(id) on delete cascade,
  endpoint      text not null unique,   -- la dirección del servicio de push de ese navegador (secreta)
  p256dh        text not null,          -- clave pública del navegador (cifrado de extremo a extremo)
  auth          text not null,          -- secreto de autenticación del navegador
  dispositivo   text,                   -- «Android · Chrome», para reconocerlo en la lista
  creada_en     timestamptz not null default now(),
  usada_en      timestamptz,
  fallos        smallint not null default 0,
  ultimo_error  text,
  vapid         text                    -- la clave pública VAPID con la que se activó (si se cambian, ya no vale)
);
alter table public.suscripciones_push add column if not exists vapid text;
create index if not exists suscripciones_push_usuario_idx on public.suscripciones_push (usuario_id);

-- Solo los servicios de push de los navegadores (Chrome/Android, Firefox, Safari/iPhone, Edge): la función de
-- envío hace POST a esta dirección, así que no puede ser cualquier sitio. Claves con su forma exacta
-- (base64url sin relleno: 65 bytes de punto P-256 sin comprimir y 16 de secreto).
alter table public.suscripciones_push drop constraint if exists suscripciones_push_valida;
alter table public.suscripciones_push add constraint suscripciones_push_valida check (
  char_length(endpoint) <= 1024
  and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/[!-~]+$'
  and p256dh ~ '^B[A-Za-z0-9_-]{86}$'
  and auth ~ '^[A-Za-z0-9_-]{22}$'
  and (dispositivo is null or (char_length(dispositivo) <= 60 and public.texto_visible(dispositivo)))
  and fallos between 0 and 1000
  and (ultimo_error is null or char_length(ultimo_error) <= 200)
  and (vapid is null or vapid ~ '^B[A-Za-z0-9_-]{86}$')
);

-- Tipos de notificación. Del atleta: respuesta (el coach le responde), semana (publicada), aviso (del coach),
-- sesion_hoy, checkin, habitos y nutricion (recordatorios). Del coach: mensaje (le escribe un atleta),
-- checkin_recibido, video_recibido y sesion_hecha. Y «prueba» (la que se envía uno mismo).
create table if not exists public.preferencias_notificaciones (
  usuario_id      uuid primary key default auth.uid() references public.perfiles(id) on delete cascade,
  desactivados    text[] not null default '{sesion_hecha}',  -- tipos que no quiere (de entrada, las sesiones hechas)
  hora_manana     time not null default '08:30',             -- «hoy toca…»
  hora_tarde      time not null default '21:00',             -- hábitos, nutrición y check-in
  dia_checkin     smallint not null default 7,               -- día del recordatorio del check-in (1 lunes … 7 domingo)
  silencio_desde  time default '22:30',                      -- «no molestar» (sin las dos, nunca)
  silencio_hasta  time default '08:00',
  email           boolean not null default false,            -- por email si no tiene ningún móvil que funcione
  actualizado_en  timestamptz not null default now()
);

-- («not valid»: si alguna vez hay que repetir esta migración, las filas que ya existen no se vuelven a mirar;
-- las migraciones siguientes amplían la lista de tipos y las suyas sí valen)
alter table public.preferencias_notificaciones drop constraint if exists preferencias_notificaciones_validas;
alter table public.preferencias_notificaciones add constraint preferencias_notificaciones_validas check (
  desactivados <@ array['respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion',
                        'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha']::text[]
  and hora_manana between time '05:00' and time '12:00' and extract(second from hora_manana) = 0
  and hora_tarde between time '12:00' and time '23:30' and extract(second from hora_tarde) = 0
  and dia_checkin between 1 and 7
  and (silencio_desde is null) = (silencio_hasta is null)
  and (silencio_desde is null or (silencio_desde <> silencio_hasta
       and extract(second from silencio_desde) = 0 and extract(second from silencio_hasta) = 0))
) not valid;

create table if not exists public.notificaciones (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.perfiles(id) on delete cascade,
  tipo          text not null,
  titulo        text not null,
  cuerpo        text,
  url           text not null default '#hoy',     -- a qué pestaña lleva al tocarla
  clave         text not null,                    -- evita duplicados: una por usuario y clave
  creado_en     timestamptz not null default now(),
  enviar_desde  timestamptz not null default now(),
  caduca_en     timestamptz not null,             -- si no ha salido para entonces, ya no se envía
  estado        text not null default 'pendiente',
  canal         text,
  intentos      smallint not null default 0,
  tomada_en     timestamptz,
  enviada_en    timestamptz,
  error         text,
  unique (usuario_id, clave)
);
create index if not exists notificaciones_cola_idx on public.notificaciones (enviar_desde)
  where estado in ('pendiente', 'enviando');
create index if not exists notificaciones_usuario_idx on public.notificaciones (usuario_id, creado_en desc);
create index if not exists notificaciones_clave_idx on public.notificaciones (clave);

alter table public.notificaciones drop constraint if exists notificaciones_validas;
alter table public.notificaciones add constraint notificaciones_validas check (
  tipo in ('respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion',
           'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'prueba')
  and char_length(titulo) between 1 and 80
  and (cuerpo is null or char_length(cuerpo) <= 160)
  and url in ('#hoy', '#semana', '#checkin', '#progreso', '#perfil', '#atletas', '#revisar', '#cuenta')
  and char_length(clave) between 1 and 100
  and estado in ('pendiente', 'enviando', 'enviada', 'caducada', 'fallida')
  and (canal is null or canal in ('push', 'email'))
  and intentos between 0 and 100
  and (error is null or char_length(error) <= 200)
) not valid;

-- ---------------------------------------------------------------------
-- 2. Piezas internas (fbe_privado)
-- ---------------------------------------------------------------------

-- Lo que solo puede hacer el servidor (la función de envío con su clave de servicio) o tú desde el SQL Editor
create or replace function fbe_privado.solo_servidor() returns void
language plpgsql set search_path = '' as $$
begin
  if coalesce(nullif(current_setting('role', true), ''), 'none') not in ('none', 'service_role', 'postgres') then
    raise exception 'Solo el servidor puede hacer esto' using errcode = '42501';
  end if;
end $$;

-- «Pelayo» de «Pelayo Pérez»; null si no hay nombre
create or replace function fbe_privado.nombre_corto(p text) returns text
language sql immutable set search_path = '' as $$
  select left(nullif(split_part(btrim(regexp_replace(coalesce(p, ''), '[[:space:][:cntrl:]]+', ' ', 'g')), ' ', 1), ''), 30)
$$;

-- Una línea limpia (sin saltos ni caracteres de control), para títulos y cuerpos
create or replace function fbe_privado.linea(p text, p_max integer) returns text
language sql immutable set search_path = '' as $$
  select nullif(left(btrim(regexp_replace(coalesce(p, ''), '[[:space:][:cntrl:]]+', ' ', 'g')), p_max), '')
$$;

-- «20 de octubre»
create or replace function fbe_privado.fecha_texto(d date) returns text
language sql immutable set search_path = '' as $$
  select extract(day from d)::int || ' de ' || (array['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'])[extract(month from d)::int]
$$;

-- Si el momento cae en el «no molestar» (hora de España), el final de ese silencio; si no, el mismo momento.
-- El silencio puede cruzar la medianoche (22:30 → 08:00).
create or replace function fbe_privado.fuera_de_silencio(p_momento timestamptz, p_desde time, p_hasta time)
returns timestamptz language plpgsql stable set search_path = '' as $$
declare
  l timestamp := p_momento at time zone 'Europe/Madrid';
  t time := l::time;
  d date := l::date;
begin
  if p_desde is null or p_hasta is null or p_desde = p_hasta then return p_momento; end if;
  if p_desde > p_hasta then
    if t >= p_desde then return ((d + 1) + p_hasta) at time zone 'Europe/Madrid'; end if;
    if t < p_hasta then return (d + p_hasta) at time zone 'Europe/Madrid'; end if;
  elsif t >= p_desde and t < p_hasta then
    return (d + p_hasta) at time zone 'Europe/Madrid';
  end if;
  return p_momento;
end $$;

-- Pone una notificación en la cola, si esa cuenta la quiere y tiene por dónde recibirla (algún móvil
-- activado o el email). Las de cosas que pasan respetan su «no molestar» (salen al acabar); los
-- recordatorios, no: su hora la ha elegido ella. Devuelve si la ha creado (una por usuario y clave).
create or replace function fbe_privado.notificar(
  p_usuario uuid, p_tipo text, p_titulo text, p_cuerpo text, p_url text, p_clave text,
  p_desde timestamptz default null, p_caduca timestamptz default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  pr public.preferencias_notificaciones;
  v_desde timestamptz := coalesce(p_desde, now());
  v_caduca timestamptz;
begin
  if p_usuario is null then return false; end if;
  select * into pr from public.preferencias_notificaciones where usuario_id = p_usuario;
  if p_tipo <> 'prueba' and p_tipo = any (coalesce(pr.desactivados, '{sesion_hecha}'::text[])) then return false; end if;
  if not coalesce(pr.email, false)
     and not exists (select 1 from public.suscripciones_push s where s.usuario_id = p_usuario) then
    return false;
  end if;
  if p_tipo in ('respuesta', 'semana', 'aviso', 'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha') then
    if pr.usuario_id is null then
      v_desde := fbe_privado.fuera_de_silencio(v_desde, time '22:30', time '08:00');
    else
      v_desde := fbe_privado.fuera_de_silencio(v_desde, pr.silencio_desde, pr.silencio_hasta);
    end if;
  end if;
  -- Si para cuando puede salir ya ha caducado (un aviso que acaba hoy, de noche), no sale
  v_caduca := coalesce(p_caduca, v_desde + interval '1 day');
  if v_caduca <= v_desde then return false; end if;
  insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, url, clave, enviar_desde, caduca_en)
  values (p_usuario, p_tipo, coalesce(fbe_privado.linea(p_titulo, 80), 'FBE Atletas'), fbe_privado.linea(p_cuerpo, 160),
          p_url, left(p_clave, 100), v_desde, v_caduca)
  on conflict (usuario_id, clave) do nothing;
  return found;
end $$;

-- La misma, sin que un fallo con una persona impida avisar a las demás (para los envíos a varias)
create or replace function fbe_privado.notificar_seguro(
  p_usuario uuid, p_tipo text, p_titulo text, p_cuerpo text, p_url text, p_clave text,
  p_desde timestamptz default null, p_caduca timestamptz default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  return fbe_privado.notificar(p_usuario, p_tipo, p_titulo, p_cuerpo, p_url, p_clave, p_desde, p_caduca);
exception when others then
  raise warning 'FBE: notificación % para % no creada: %', p_clave, p_usuario, sqlerrm;
  return false;
end $$;

-- ---------------------------------------------------------------------
-- 3. Disparadores: cada uno, «after» y a prueba de fallos (si algo de la notificación saliera mal, lo que
--    se estaba guardando se guarda igual: la notificación es lo de menos).
-- ---------------------------------------------------------------------

-- Comentarios: del coach → al atleta («Pelayo te ha respondido»); del atleta → al coach («Ana te ha escrito»)
create or replace function fbe_privado.al_comentar() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  a public.atletas;
  v_donde text;
begin
  select * into a from public.atletas where id = new.atleta_id;
  if a.id is null then return null; end if;
  v_donde := case
    when new.sesion_id is not null then (select 'En ' || s.nombre from public.sesiones s where s.id = new.sesion_id)
    when new.checkin_id is not null then case when new.autor = 'coach' then 'En tu check-in' else 'En su check-in' end
    when new.archivo_id is not null then case when new.autor = 'coach' then 'En tu vídeo' else 'En su vídeo' end
    else 'Mensaje nuevo' end;
  if new.autor = 'coach' then
    if a.estado = 'activo' then
      perform fbe_privado.notificar(a.perfil_id, 'respuesta',
        coalesce(fbe_privado.nombre_corto((select p.nombre from public.perfiles p where p.id = auth.uid())), 'Tu coach') || ' te ha respondido',
        v_donde, '#hoy', 'comentario:' || new.id);
    end if;
  else
    -- Al coach, una por atleta cada 10 minutos (si escribe cinco mensajes seguidos, una sola)
    perform fbe_privado.notificar_seguro(p.id, 'mensaje',
      coalesce(fbe_privado.nombre_corto(a.nombre), 'Un atleta') || ' te ha escrito', v_donde, '#revisar',
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

-- Semana publicada → al atleta
create or replace function fbe_privado.al_publicar_semana() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  v record;
begin
  -- Si se retira antes de que salga la notificación, ya no sale
  if new.programacion is distinct from 'programada' then
    if tg_op = 'UPDATE' and old.programacion = 'programada' then
      delete from public.notificaciones n where n.clave = 'semana:' || new.id and n.estado = 'pendiente';
    end if;
    return null;
  end if;
  if tg_op = 'UPDATE' and old.programacion = 'programada' then return null; end if;
  select a.perfil_id, a.estado, b.nombre as bloque, b.estado as estado_bloque into v
  from public.bloques b join public.atletas a on a.id = b.atleta_id
  where b.id = new.bloque_id and not b.es_plantilla;
  if not found or v.estado <> 'activo' or v.estado_bloque in ('cancelado', 'finalizado') then return null; end if;
  perform fbe_privado.notificar(v.perfil_id, 'semana',
    case when new.fecha_inicio > (now() at time zone 'Europe/Madrid')::date then 'Ya tienes tu próxima semana'
         else 'Tu semana ya está lista' end,
    'Semana ' || new.numero || ' de ' || v.bloque, '#semana', 'semana:' || new.id);
  return null;
exception when others then
  raise warning 'FBE: notificación de la semana % no creada: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists semanas_zz_notificar on public.semanas;
create trigger semanas_zz_notificar after insert or update of programacion on public.semanas
  for each row execute function fbe_privado.al_publicar_semana();

-- Aviso del coach → a quien va dirigido (o a todos los atletas activos). Sin su texto: puede ser personal y se
-- vería con el móvil bloqueado. Si empieza otro día, sale ese día a las 9:00; si caduca antes de salir, ya no
-- sale. Si lo cambias antes de que salga (a quién va, las fechas), la notificación se rehace.
create or replace function fbe_privado.al_crear_aviso() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_desde timestamptz;
  v_caduca timestamptz;
  v_titulo text;
begin
  if tg_op = 'UPDATE' then
    delete from public.notificaciones n where n.clave = 'aviso:' || new.id and n.estado = 'pendiente';
  end if;
  if new.hasta is not null and new.hasta < v_hoy then return null; end if;
  v_desde := case when new.desde > v_hoy then (new.desde + time '09:00') at time zone 'Europe/Madrid' else now() end;
  v_caduca := case when new.hasta is not null then (new.hasta + 1)::timestamp at time zone 'Europe/Madrid'
                   else v_desde + interval '1 day' end;
  v_titulo := coalesce('Aviso de ' || fbe_privado.nombre_corto((select p.nombre from public.perfiles p where p.id = auth.uid())), 'Aviso nuevo');
  perform fbe_privado.notificar_seguro(a.perfil_id, 'aviso', v_titulo, 'Tócalo para leerlo en la app.', '#hoy', 'aviso:' || new.id, v_desde, v_caduca)
  from public.atletas a
  where a.estado = 'activo' and a.perfil_id is not null and (new.atleta_id is null or a.id = new.atleta_id);
  return null;
exception when others then
  raise warning 'FBE: notificación del aviso % no creada: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists avisos_zz_notificar on public.avisos;
create trigger avisos_zz_notificar after insert or update of texto, atleta_id, desde, hasta on public.avisos
  for each row execute function fbe_privado.al_crear_aviso();

-- Check-in nuevo → al coach
create or replace function fbe_privado.al_enviar_checkin() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  v_nombre text;
begin
  select coalesce(fbe_privado.nombre_corto(a.nombre), 'Un atleta') into v_nombre from public.atletas a where a.id = new.atleta_id;
  -- Una por atleta y semana (borrar y volver a enviar el mismo check-in no avisa otra vez)
  perform fbe_privado.notificar_seguro(p.id, 'checkin_recibido', v_nombre || ' ha enviado su check-in',
    'Semana del ' || fbe_privado.fecha_texto(new.semana_inicio), '#revisar', 'checkin:' || new.atleta_id || ':' || new.semana_inicio)
  from public.perfiles p where p.rol = 'coach' and p.id is distinct from auth.uid();
  return null;
exception when others then
  raise warning 'FBE: notificación del check-in % no creada: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists checkins_zz_notificar on public.checkins;
create trigger checkins_zz_notificar after insert on public.checkins
  for each row execute function fbe_privado.al_enviar_checkin();

-- Vídeo de técnica nuevo → al coach, cinco minutos después (lo que tarda en subirse; si la subida falla, la app
-- borra el registro y la notificación ya no sale)
create or replace function fbe_privado.al_subir_video() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  v_nombre text;
  v_ejercicio text;
begin
  if new.tipo <> 'video_tecnica' then return null; end if;
  select coalesce(fbe_privado.nombre_corto(a.nombre), 'Un atleta') into v_nombre from public.atletas a where a.id = new.atleta_id;
  select e.nombre into v_ejercicio from public.sesion_ejercicios se join public.ejercicios e on e.id = se.ejercicio_id
  where se.id = new.sesion_ejercicio_id;
  perform fbe_privado.notificar_seguro(p.id, 'video_recibido', v_nombre || ' ha subido un vídeo',
    coalesce(v_ejercicio, 'Vídeo de técnica'), '#revisar', 'archivo:' || new.id, now() + interval '5 minutes')
  from public.perfiles p where p.rol = 'coach' and p.id is distinct from auth.uid();
  return null;
exception when others then
  raise warning 'FBE: notificación del vídeo % no creada: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists archivos_zz_notificar on public.archivos;
create trigger archivos_zz_notificar after insert on public.archivos
  for each row execute function fbe_privado.al_subir_video();

-- Sesión terminada → al coach (desactivadas de entrada en sus preferencias)
create or replace function fbe_privado.al_terminar_sesion() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  v_nombre text;
begin
  if not new.completada and old.completada then
    delete from public.notificaciones n where n.clave = 'sesion:' || new.id and n.estado = 'pendiente';
    return null;
  end if;
  if not new.completada or old.completada then return null; end if;
  select coalesce(fbe_privado.nombre_corto(a.nombre), 'Un atleta') into v_nombre
  from public.semanas w join public.bloques b on b.id = w.bloque_id join public.atletas a on a.id = b.atleta_id
  where w.id = new.semana_id;
  if v_nombre is null then return null; end if;
  perform fbe_privado.notificar_seguro(p.id, 'sesion_hecha', v_nombre || ' ha terminado ' || new.nombre,
    'Ya puedes revisarla.', '#revisar', 'sesion:' || new.id)
  from public.perfiles p where p.rol = 'coach' and p.id is distinct from auth.uid();
  return null;
exception when others then
  raise warning 'FBE: notificación de la sesión % no creada: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists sesiones_zz_notificar on public.sesiones;
create trigger sesiones_zz_notificar after update of completada on public.sesiones
  for each row execute function fbe_privado.al_terminar_sesion();

-- Si se borra lo que la originó antes de que salga, la notificación ya no sale
create or replace function fbe_privado.al_borrar_origen() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
begin
  delete from public.notificaciones n where n.clave = tg_argv[0] || old.id and n.estado = 'pendiente';
  return null;
exception when others then
  raise warning 'FBE: notificaciones de % no retiradas: %', old.id, sqlerrm;
  return null;
end $$;
drop trigger if exists comentarios_zz_retirar on public.comentarios;
create trigger comentarios_zz_retirar after delete on public.comentarios
  for each row execute function fbe_privado.al_borrar_origen('comentario:');
drop trigger if exists avisos_zz_retirar on public.avisos;
create trigger avisos_zz_retirar after delete on public.avisos
  for each row execute function fbe_privado.al_borrar_origen('aviso:');
-- (el del check-in va por atleta y semana: un check-in borrado antes de que salga, ya no avisa)
create or replace function fbe_privado.al_borrar_checkin() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
begin
  delete from public.notificaciones n where n.clave = 'checkin:' || old.atleta_id || ':' || old.semana_inicio and n.estado = 'pendiente';
  return null;
exception when others then
  raise warning 'FBE: notificaciones del check-in % no retiradas: %', old.id, sqlerrm;
  return null;
end $$;
drop trigger if exists checkins_zz_retirar on public.checkins;
create trigger checkins_zz_retirar after delete on public.checkins
  for each row execute function fbe_privado.al_borrar_checkin();
drop trigger if exists semanas_zz_retirar on public.semanas;
create trigger semanas_zz_retirar after delete on public.semanas
  for each row execute function fbe_privado.al_borrar_origen('semana:');
drop trigger if exists sesiones_zz_retirar on public.sesiones;
create trigger sesiones_zz_retirar after delete on public.sesiones
  for each row execute function fbe_privado.al_borrar_origen('sesion:');
drop trigger if exists archivos_zz_retirar on public.archivos;
create trigger archivos_zz_retirar after delete on public.archivos
  for each row execute function fbe_privado.al_borrar_origen('archivo:');

-- Las preferencias: fecha del cambio
create or replace function fbe_privado.al_cambiar_preferencias() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists preferencias_notificaciones_fecha on public.preferencias_notificaciones;
create trigger preferencias_notificaciones_fecha before insert or update on public.preferencias_notificaciones
  for each row execute function fbe_privado.al_cambiar_preferencias();

-- ---------------------------------------------------------------------
-- 4. Recordatorios. Los crea el servidor cada vez que la función de envío se ejecuta (cada minuto); cada
--    uno sale una vez al día, en las dos horas siguientes a la hora elegida, y caduca a las cuatro.
--    Solo a atletas activos, con cuenta y con por dónde recibirlos; los de hábitos, nutrición y check-in,
--    además, con el consentimiento de datos de salud (sin él no los apuntan en la app).
-- ---------------------------------------------------------------------
create or replace view fbe_privado.destinatarios with (security_barrier) as
select a.id as atleta_id, a.perfil_id,
       coalesce(p.desactivados, '{sesion_hecha}'::text[]) as desactivados,
       coalesce(p.hora_manana, time '08:30') as hora_manana,
       coalesce(p.hora_tarde, time '21:00') as hora_tarde,
       coalesce(p.dia_checkin, 7) as dia_checkin,
       exists (select 1 from public.consentimientos c
               where c.perfil_id = a.perfil_id and c.tipo = 'datos_salud' and c.revocado_en is null) as salud
from public.atletas a
left join public.preferencias_notificaciones p on p.usuario_id = a.perfil_id
where a.estado = 'activo' and a.perfil_id is not null
  and (coalesce(p.email, false) or exists (select 1 from public.suscripciones_push s where s.usuario_id = a.perfil_id));
revoke all on fbe_privado.destinatarios from public, anon, authenticated;

create or replace function public.crear_recordatorios(p_ahora timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_local timestamp := p_ahora at time zone 'Europe/Madrid';
  v_hoy date := (p_ahora at time zone 'Europe/Madrid')::date;
  v_dow integer := extract(isodow from (p_ahora at time zone 'Europe/Madrid'))::integer;
  v_lunes date;
  v_n integer := 0;
  v_m integer;
begin
  perform fbe_privado.solo_servidor();
  v_lunes := v_hoy - (v_dow - 1);

  -- Hoy toca… (solo si planificó el día de la sesión en «Tu plan»). Cada consulta elige primero a quién
  -- (materialized: así la notificación solo se crea para esas filas, sin depender del orden del WHERE)
  with x as materialized (
    select d.perfil_id, d.hora_manana, count(*) as n, min(s.nombre) as nombre
    from fbe_privado.destinatarios d
    join public.bloques b on b.atleta_id = d.atleta_id and not b.es_plantilla and b.estado not in ('cancelado', 'finalizado')
    join public.semanas w on w.bloque_id = b.id and w.programacion = 'programada'
    join public.sesiones s on s.semana_id = w.id and s.dia_previsto = v_hoy and not s.completada
    where not ('sesion_hoy' = any (d.desactivados))
      and v_local >= v_hoy + d.hora_manana and v_local < v_hoy + d.hora_manana + interval '2 hours'
    group by d.perfil_id, d.hora_manana
  )
  select count(*) into v_m from x
  where fbe_privado.notificar_seguro(x.perfil_id, 'sesion_hoy',
          case when x.n = 1 then 'Hoy toca ' || x.nombre else 'Hoy tienes ' || x.n || ' sesiones' end,
          case when x.n = 1 then 'La tienes en Hoy.' else 'Las tienes en Hoy.' end,
          '#hoy', 'recordatorio_sesion:' || v_hoy, p_ahora,
          (v_hoy + x.hora_manana + interval '4 hours') at time zone 'Europe/Madrid');
  v_n := v_n + v_m;

  -- El check-in de la semana (el lunes, el de la semana que acaba de terminar, como en la app)
  with d as materialized (
    select d.perfil_id, d.hora_tarde from fbe_privado.destinatarios d
    where d.salud and not ('checkin' = any (d.desactivados)) and d.dia_checkin = v_dow
      and v_local >= v_hoy + d.hora_tarde and v_local < v_hoy + d.hora_tarde + interval '2 hours'
      and not exists (select 1 from public.checkins c
                      where c.atleta_id = d.atleta_id and c.semana_inicio = case when v_dow = 1 then v_lunes - 7 else v_lunes end)
  )
  select count(*) into v_m from d
  where fbe_privado.notificar_seguro(d.perfil_id, 'checkin', '¿Haces el check-in?',
          case when v_dow = 1 then 'El de la semana pasada aún está pendiente.' else 'El de esta semana aún está pendiente.' end,
          '#checkin', 'recordatorio_checkin:' || v_hoy, p_ahora,
          (v_hoy + d.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
  v_n := v_n + v_m;

  -- Por la tarde, una sola: los hábitos que hoy le hacen falta (los diarios sin apuntar y los de x días a la
  -- semana que ya no llegan si se salta hoy) y la nutrición sin apuntar (si tiene plan)
  with x as materialized (
    select * from (
    select d.perfil_id, d.hora_tarde,
      case when 'habitos' = any (d.desactivados) then 0 else (
        select count(*) from public.habitos h
        where h.atleta_id = d.atleta_id and h.activo
          and not exists (select 1 from public.registros_habito r where r.habito_id = h.id and r.fecha = v_hoy)
          and h.dias_semana - (
            select count(*) from public.registros_habito r
            where r.habito_id = h.id and r.fecha >= v_lunes and r.fecha < v_hoy
              and case when h.tipo = 'si_no' then r.valor >= 1
                       when h.sentido = 'al_menos' then r.valor >= h.objetivo
                       else r.valor <= h.objetivo end
          ) >= 8 - v_dow
      ) end as habitos,
      not ('nutricion' = any (d.desactivados))
        and exists (select 1 from public.planes_nutricion pn where pn.atleta_id = d.atleta_id and pn.desde <= v_hoy)
        and not exists (select 1 from public.registros_nutricion rn where rn.atleta_id = d.atleta_id and rn.fecha = v_hoy) as nutricion
    from fbe_privado.destinatarios d
    where d.salud and v_local >= v_hoy + d.hora_tarde and v_local < v_hoy + d.hora_tarde + interval '2 hours'
    ) y
    where y.habitos > 0 or y.nutricion
  )
  select count(*) into v_m from x
  where fbe_privado.notificar_seguro(x.perfil_id, case when x.habitos > 0 then 'habitos' else 'nutricion' end,
          case when x.habitos > 0 and x.nutricion then
                 case when x.habitos = 1 then 'Te queda un hábito y la nutrición de hoy' else 'Te quedan ' || x.habitos || ' hábitos y la nutrición de hoy' end
               when x.habitos = 1 then 'Te queda un hábito de hoy'
               when x.habitos > 1 then 'Te quedan ' || x.habitos || ' hábitos de hoy'
               else '¿Apuntas lo que has comido hoy?' end,
          case when x.habitos > 0 then 'Apúntalo en Hoy antes de que acabe el día.' else 'Aún no has apuntado la nutrición de hoy.' end,
          '#hoy', 'recordatorio_tarde:' || v_hoy, p_ahora,
          (v_hoy + x.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
  v_n := v_n + v_m;
  return v_n;
end $$;

-- ---------------------------------------------------------------------
-- 5. Lo que usa la app
-- ---------------------------------------------------------------------

-- ¿Puede esta cuenta recibir notificaciones? Las de atletas vinculados a su ficha y la del coach (una cuenta
-- recién creada sin código no: no hay nada que avisarle, y así nadie usa el servidor para enviarse cosas)
create or replace function fbe_privado.puede_recibir(p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles p where p.id = p_uid and p.rol = 'coach')
      or exists (select 1 from public.atletas a where a.perfil_id = p_uid)
$$;

-- Activar las notificaciones en este navegador. Si esa dirección era de otra cuenta (mismo móvil, otra
-- persona), pasa a esta. Como mucho 10 por cuenta (se quedan las más recientes). p_vapid: la clave pública
-- con la que se suscribió (si cambia, la función de envío la retira).
create or replace function public.registrar_suscripcion_push(p_endpoint text, p_p256dh text, p_auth text,
  p_dispositivo text default null, p_vapid text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null or not fbe_privado.puede_recibir(v_uid) then
    raise exception 'Solo las cuentas vinculadas a una ficha (o la del coach) pueden activar las notificaciones' using errcode = '42501';
  end if;
  delete from public.suscripciones_push where endpoint = p_endpoint and usuario_id <> v_uid;
  insert into public.suscripciones_push as s (usuario_id, endpoint, p256dh, auth, dispositivo, vapid)
  values (v_uid, p_endpoint, p_p256dh, p_auth, fbe_privado.linea(p_dispositivo, 60), p_vapid)
  on conflict (endpoint) do update
    set usuario_id = excluded.usuario_id, p256dh = excluded.p256dh, auth = excluded.auth,
        dispositivo = coalesce(excluded.dispositivo, s.dispositivo), vapid = excluded.vapid, fallos = 0, ultimo_error = null
  returning s.id into v_id;
  delete from public.suscripciones_push where id in (
    select s.id from public.suscripciones_push s where s.usuario_id = v_uid
    order by coalesce(s.usada_en, s.creada_en) desc, s.creada_en desc offset 10);
  return v_id;
end $$;

-- Al abrir la app: si el navegador ha renovado su suscripción, la de esta cuenta se pone al día. Solo cambia
-- una que siga siendo suya (si la quitó desde otro móvil, no la recupera): devuelve si la había.
create or replace function public.actualizar_suscripcion_push(p_anterior text, p_endpoint text, p_p256dh text, p_auth text,
  p_vapid text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return false; end if;
  if p_endpoint is distinct from p_anterior then
    delete from public.suscripciones_push where endpoint = p_endpoint and usuario_id <> v_uid;
  end if;
  update public.suscripciones_push s
  set endpoint = p_endpoint, p256dh = p_p256dh, auth = p_auth, vapid = coalesce(p_vapid, s.vapid),
      fallos = case when s.endpoint = p_endpoint and s.p256dh = p_p256dh then s.fallos else 0 end
  where s.usuario_id = v_uid and s.endpoint = p_anterior;
  return found;
end $$;

-- «Enviarme una de prueba»: como mucho una por minuto. 'ok', 'sin_canal' (ni móvil ni email) o 'espera'.
create or replace function public.probar_notificacion() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_clave text := 'prueba:' || to_char(now() at time zone 'Europe/Madrid', 'YYYYMMDDHH24MI');
begin
  if v_uid is null or not fbe_privado.puede_recibir(v_uid) then
    raise exception 'Solo las cuentas vinculadas a una ficha (o la del coach) reciben notificaciones' using errcode = '42501';
  end if;
  if not exists (select 1 from public.suscripciones_push where usuario_id = v_uid)
     and not exists (select 1 from public.preferencias_notificaciones where usuario_id = v_uid and email) then
    return 'sin_canal';
  end if;
  if exists (select 1 from public.notificaciones where usuario_id = v_uid and clave = v_clave) then return 'espera'; end if;
  perform fbe_privado.notificar(v_uid, 'prueba', 'Notificaciones activadas', 'Así te llegarán los avisos de FBE Atletas.',
    case when exists (select 1 from public.perfiles where id = v_uid and rol = 'coach') then '#cuenta' else '#perfil' end,
    v_clave, now(), now() + interval '1 hour');
  return 'ok';
end $$;

-- ---------------------------------------------------------------------
-- 6. Lo que usa la función de envío (solo con la clave de servicio)
-- ---------------------------------------------------------------------

-- Toma las que tocan (y las que se quedaron a medias hace más de 10 minutos: la función nunca dura tanto),
-- como mucho p_limite, sin que dos envíos a la vez cojan las mismas. De paso, borra las ya terminadas de hace
-- más de 30 días y marca las que no salieron a tiempo. Con email: si la cuenta lo quiere, con el email
-- confirmado, y no ha recibido otro en la última hora (contado con las propias notificaciones, que nadie puede
-- borrar desde la app).
create or replace function public.notificaciones_por_enviar(p_limite integer default 100, p_email boolean default false)
returns table (id uuid, usuario_id uuid, tipo text, titulo text, cuerpo text, url text, caduca_en timestamptz,
               intentos smallint, email text, suscripciones jsonb)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform fbe_privado.solo_servidor();
  delete from public.notificaciones n
  where n.creado_en < now() - interval '30 days' and n.estado in ('enviada', 'caducada', 'fallida');
  update public.notificaciones n set estado = 'caducada'
  where n.caduca_en < now()
    and (n.estado = 'pendiente' or (n.estado = 'enviando' and n.tomada_en < now() - interval '10 minutes'));
  return query
  with candidatas as (
    select n.id from public.notificaciones n
    left join public.preferencias_notificaciones p on p.usuario_id = n.usuario_id
    where ((n.estado = 'pendiente' and n.enviar_desde <= now())
           or (n.estado = 'enviando' and n.tomada_en < now() - interval '10 minutes'))
      and n.intentos < 5
      and (exists (select 1 from public.suscripciones_push s where s.usuario_id = n.usuario_id)
           or (p_email and coalesce(p.email, false)
               and not exists (select 1 from public.notificaciones x
                               where x.usuario_id = n.usuario_id and x.canal = 'email' and x.enviada_en > now() - interval '1 hour')))
    order by n.enviar_desde
    limit greatest(1, least(coalesce(p_limite, 100), 500))
    for update of n skip locked
  ), tomadas as (
    update public.notificaciones n set estado = 'enviando', tomada_en = now(), intentos = n.intentos + 1
    from candidatas c where n.id = c.id
    returning n.id, n.usuario_id, n.tipo, n.titulo, n.cuerpo, n.url, n.caduca_en, n.intentos
  )
  select t.id, t.usuario_id, t.tipo, t.titulo, t.cuerpo, t.url, t.caduca_en, t.intentos,
         case when p_email and coalesce(p.email, false) and u.email_confirmed_at is not null then u.email::text end,
         coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
                                                       'vapid', s.vapid, 'fallos', s.fallos)
                                    order by s.creada_en)
                   from public.suscripciones_push s where s.usuario_id = t.usuario_id), '[]'::jsonb)
  from tomadas t
  left join public.preferencias_notificaciones p on p.usuario_id = t.usuario_id
  left join auth.users u on u.id = t.usuario_id;
end $$;

-- Lo que pasó con cada una. p_resultado: { enviadas: [{id, canal}], reintentar: [{id, error, esperar}],
-- fallidas: [{id, error}], suscripciones_ok: [id], suscripciones_caducadas: [id] (ya no existen o no pueden
-- recibir nada: se borran), suscripciones_error: [{id, error}] }.
-- Los reintentos esperan 1, 4, 9, 16 minutos (o lo que pida el servicio, hasta una hora); al quinto, fallida.
create or replace function public.notificaciones_resultado(p_resultado jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform fbe_privado.solo_servidor();
  update public.notificaciones n set estado = 'enviada', canal = e ->> 'canal', enviada_en = now(), error = null
  from jsonb_array_elements(coalesce(p_resultado -> 'enviadas', '[]'::jsonb)) e
  where n.id = (e ->> 'id')::uuid and n.estado = 'enviando';
  update public.notificaciones n
  set estado = case when n.intentos >= 5 then 'fallida' else 'pendiente' end,
      enviar_desde = now() + greatest(make_interval(mins => n.intentos * n.intentos),
                                      make_interval(secs => least(coalesce((e ->> 'esperar')::integer, 0), 3600))),
      error = left(e ->> 'error', 200)
  from jsonb_array_elements(coalesce(p_resultado -> 'reintentar', '[]'::jsonb)) e
  where n.id = (e ->> 'id')::uuid and n.estado = 'enviando';
  update public.notificaciones n set estado = 'fallida', error = left(e ->> 'error', 200)
  from jsonb_array_elements(coalesce(p_resultado -> 'fallidas', '[]'::jsonb)) e
  where n.id = (e ->> 'id')::uuid and n.estado = 'enviando';
  update public.suscripciones_push s set usada_en = now(), fallos = 0, ultimo_error = null
  where s.id in (select x::uuid from jsonb_array_elements_text(coalesce(p_resultado -> 'suscripciones_ok', '[]'::jsonb)) x);
  delete from public.suscripciones_push s
  where s.id in (select x::uuid from jsonb_array_elements_text(coalesce(p_resultado -> 'suscripciones_caducadas', '[]'::jsonb)) x);
  update public.suscripciones_push s set fallos = least(s.fallos + 1, 1000), ultimo_error = left(e ->> 'error', 200)
  from jsonb_array_elements(coalesce(p_resultado -> 'suscripciones_error', '[]'::jsonb)) e
  where s.id = (e ->> 'id')::uuid;
end $$;

-- ---------------------------------------------------------------------
-- 7. Permisos por fila: cada cuenta solo ve lo suyo
-- ---------------------------------------------------------------------
alter table public.suscripciones_push enable row level security;
drop policy if exists propias_ver on public.suscripciones_push;
create policy propias_ver on public.suscripciones_push for select to authenticated using (usuario_id = auth.uid());
drop policy if exists propias_borrar on public.suscripciones_push;
create policy propias_borrar on public.suscripciones_push for delete to authenticated using (usuario_id = auth.uid());

alter table public.preferencias_notificaciones enable row level security;
drop policy if exists propias_ver on public.preferencias_notificaciones;
create policy propias_ver on public.preferencias_notificaciones for select to authenticated using (usuario_id = auth.uid());
drop policy if exists propias_crear on public.preferencias_notificaciones;
create policy propias_crear on public.preferencias_notificaciones for insert to authenticated with check (usuario_id = auth.uid());
drop policy if exists propias_editar on public.preferencias_notificaciones;
create policy propias_editar on public.preferencias_notificaciones for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
drop policy if exists propias_borrar on public.preferencias_notificaciones;
create policy propias_borrar on public.preferencias_notificaciones for delete to authenticated using (usuario_id = auth.uid());

alter table public.notificaciones enable row level security;
drop policy if exists propias_ver on public.notificaciones;
create policy propias_ver on public.notificaciones for select to authenticated using (usuario_id = auth.uid());

-- ---------------------------------------------------------------------
-- Permisos (como al final de 003 a 009)
-- ---------------------------------------------------------------------
-- Las suscripciones solo entran por registrar_suscripcion_push; las notificaciones solo las crea la base.
-- De las preferencias, la app escribe lo que elige la persona (no la fecha del último email).
revoke all on public.suscripciones_push, public.preferencias_notificaciones, public.notificaciones from public, anon, authenticated;
grant select, delete on public.suscripciones_push to authenticated;
grant select, delete on public.preferencias_notificaciones to authenticated;
grant insert (usuario_id, desactivados, hora_manana, hora_tarde, dia_checkin, silencio_desde, silencio_hasta, email)
  on public.preferencias_notificaciones to authenticated;
-- (usuario_id también, porque PostgREST lo pone en el «on conflict do update» de un upsert; los permisos por
-- fila no dejan que sea otro que el propio)
grant update (usuario_id, desactivados, hora_manana, hora_tarde, dia_checkin, silencio_desde, silencio_hasta, email)
  on public.preferencias_notificaciones to authenticated;
grant select on public.notificaciones to authenticated;
grant all on public.suscripciones_push, public.preferencias_notificaciones, public.notificaciones to service_role;
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
-- Las del servidor, solo para la clave de servicio (y además lo comprueban dentro, por si una migración
-- futura vuelve a darlas a todos)
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
grant execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) to service_role;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

-- Apuntada: desde aquí, la base no deja repetir por error las migraciones anteriores a esta
insert into public.fbe_migraciones (numero) values (10)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;

-- ============================== migraciones/011_cuestionario_y_checkin.sql ==============================
-- =====================================================================
-- FBE Atletas, migración 011 (v0.13): cuestionario inicial y check-in a medida
-- 1. Cuestionario inicial: objetivo, experiencia y tiempo, dónde entrena y con qué, y la salud (cribado previo
--    al ejercicio según el algoritmo de la ACSM de 2015: si ya hace ejercicio, si tiene una enfermedad
--    cardiovascular, metabólica o renal conocida y si tiene síntomas; Riebe y cols., Med Sci Sports Exerc
--    2015;47:2473-9, doi:10.1249/MSS.0000000000000664), lesiones y alergias. La recomendación la calcula la
--    base. La parte de salud necesita el consentimiento del atleta, la escriba quien la escriba.
-- 2. Check-in a medida: qué apartados se le preguntan a cada atleta y preguntas propias del coach (para uno o
--    para todos), con sus respuestas en cada check-in, comprobadas por la base.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 010 (o con instalar.sql en una
-- base nueva). Se puede repetir sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guardia: si la base ya tiene una migración posterior, esta no se repite (desharía lo que
-- cambiaron las siguientes). Al terminar, queda apuntada en fbe_migraciones.
-- ---------------------------------------------------------------------
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
  if v > 11 then
    raise exception 'Esta base ya tiene la migración %: repetir la 011 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 11;» y, después de ella, todas las siguientes en orden.';
  end if;
  -- Y antes, la anterior: la 011 usa las notificaciones de la 010
  if not exists (select 1 from public.fbe_migraciones where numero = 10) then
    raise exception 'Antes de la 011 hace falta la 010: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Cuestionario inicial (uno por atleta; se actualiza cuando el coach lo pide)
-- ---------------------------------------------------------------------
create table if not exists public.cuestionarios (
  id                  uuid primary key default gen_random_uuid(),
  atleta_id           uuid not null unique references public.atletas(id) on delete cascade,
  -- Lo que quiere y cómo puede entrenar (no son datos de salud)
  objetivo            text,          -- fuerza · musculo · perder_grasa · salud · rendimiento · otro
  objetivo_detalle    text,
  experiencia         text,          -- años entrenando fuerza: ninguna · menos_1 · 1_3 · 3_5 · mas_5
  dias_semana         smallint,
  minutos_sesion      smallint,
  lugar               text,          -- gimnasio · gimnasio_basico · casa · aire_libre
  material            text[] not null default '{}',
  otros_deportes      text,
  -- Salud (con su consentimiento)
  activo              boolean,       -- ¿hace ejercicio estructurado (3 días a la semana, 30 min, moderado) desde hace 3 meses?
  enfermedad          boolean,       -- ¿enfermedad cardiovascular, metabólica (diabetes) o renal diagnosticada?
  enfermedad_detalle  text,
  sintomas            text[],        -- los de la ACSM que hacen pensar en una de esas enfermedades ('{}' = ninguno)
  otras               text[],        -- embarazo, posparto, cirugía reciente, medicación, limitación médica
  medicacion_detalle  text,
  lesiones            jsonb,         -- [{ zona, limita (0 no, 1 algo, 2 mucho), nota }]
  alergias            text,          -- alergias o intolerancias alimentarias
  resultado           text,          -- lo calcula la base: sin_valoracion · valorar_antes_vigoroso · valorar_antes · parar_y_valorar
  completado_en       timestamptz,
  pedido_en           timestamptz,   -- el coach pide que lo rellene o lo actualice
  revisado_en         timestamptz,   -- el coach ha revisado la parte de salud
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now()
);

-- Lesiones: como mucho 10, cada una con su zona, cuánto le limita y una nota corta
create or replace function public.lesiones_validas(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'array' and jsonb_array_length(j) <= 10 and not exists (
    select 1 from jsonb_array_elements(j) e
    where jsonb_typeof(e) <> 'object'
       or exists (select 1 from jsonb_object_keys(e) k where k not in ('zona', 'limita', 'nota'))
       or coalesce(e ->> 'zona', '') not in ('cuello', 'hombro', 'codo', 'muneca_mano', 'espalda_alta', 'zona_lumbar',
                                             'cadera', 'rodilla', 'tobillo_pie', 'otra')
       or jsonb_typeof(e -> 'limita') is distinct from 'number' or (e ->> 'limita') not in ('0', '1', '2')
       or (e ? 'nota' and jsonb_typeof(e -> 'nota') <> 'null'
           and (jsonb_typeof(e -> 'nota') <> 'string' or char_length(e ->> 'nota') > 200 or not public.texto_visible(e ->> 'nota')))
  )
$$;

alter table public.cuestionarios drop constraint if exists cuestionarios_valido;
alter table public.cuestionarios add constraint cuestionarios_valido check (
  (objetivo is null or objetivo in ('fuerza', 'musculo', 'perder_grasa', 'salud', 'rendimiento', 'otro'))
  and (objetivo_detalle is null or (char_length(objetivo_detalle) <= 600 and public.texto_visible(objetivo_detalle)))
  and (experiencia is null or experiencia in ('ninguna', 'menos_1', '1_3', '3_5', 'mas_5'))
  and (dias_semana is null or dias_semana between 1 and 7)
  and (minutos_sesion is null or minutos_sesion between 15 and 240)
  and (lugar is null or lugar in ('gimnasio', 'gimnasio_basico', 'casa', 'aire_libre'))
  and material <@ array['barra', 'rack', 'banco', 'mancuernas', 'kettlebells', 'poleas', 'maquinas', 'gomas',
                        'dominadas', 'cardio']::text[]
  and (otros_deportes is null or (char_length(otros_deportes) <= 200 and public.texto_visible(otros_deportes)))
  and (enfermedad_detalle is null or (char_length(enfermedad_detalle) <= 300 and public.texto_visible(enfermedad_detalle)))
  and (sintomas is null or sintomas <@ array['dolor_pecho', 'falta_aire', 'mareo', 'palpitaciones', 'tobillos',
                                             'claudicacion', 'soplo', 'fatiga', 'ortopnea']::text[])
  and (otras is null or otras <@ array['embarazo', 'posparto', 'cirugia', 'medicacion', 'limitacion_medica']::text[])
  and (medicacion_detalle is null or (char_length(medicacion_detalle) <= 300 and public.texto_visible(medicacion_detalle)))
  and (lesiones is null or public.lesiones_validas(lesiones))
  and (alergias is null or (char_length(alergias) <= 300 and public.texto_visible(alergias)))
  and (resultado is null or resultado in ('sin_valoracion', 'valorar_antes_vigoroso', 'valorar_antes', 'parar_y_valorar'))
);

-- La recomendación del cribado (ACSM 2015), con las tres respuestas:
--   con síntomas: si ya hace ejercicio, parar y que lo valore su médico; si no, valoración antes de empezar
--   enfermedad conocida sin síntomas: si ya hace ejercicio, valoración antes de subir a intensidad vigorosa
--     (puede seguir a intensidad moderada); si no, valoración antes de empezar
--   ni enfermedad ni síntomas: no hace falta valoración (empezar suave y progresar)
create or replace function public.resultado_cribado(p_activo boolean, p_enfermedad boolean, p_sintomas text[])
returns text language sql immutable set search_path = '' as $$
  select case
    when p_activo is null or p_enfermedad is null or p_sintomas is null then null
    when cardinality(p_sintomas) > 0 then case when p_activo then 'parar_y_valorar' else 'valorar_antes' end
    when p_enfermedad then case when p_activo then 'valorar_antes_vigoroso' else 'valorar_antes' end
    else 'sin_valoracion'
  end
$$;

-- Lo de salud, con consentimiento (lo escriba quien lo escriba desde la app, como en 008 y 009): hace falta
-- para poner un valor nuevo, no para dejarlo como estaba ni para borrarlo (también después de retirar el
-- consentimiento). La recomendación la pone la base; la revisión y la petición, solo el coach, con la hora de
-- la base; si cambia algo de salud, vuelve a estar por revisar. Sin «security definer»: el consentimiento se
-- mira con consentimiento_salud_de_atleta (008), que a quien no es el atleta ni el coach le dice que no.
-- En un upsert de PostgREST (insert … on conflict do update) este trigger corre primero como INSERT con la fila
-- propuesta: entonces «lo que había» es la fila que ya existe para ese atleta (si la hay), para que el upsert
-- y el update decidan lo mismo.
create or replace function public.cuestionario_preparar() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_coach boolean := public.es_coach();
  v_app boolean := current_user in ('authenticated', 'anon');
  v_prev public.cuestionarios;
  v_pide_consentimiento boolean;
  v_cambia_salud boolean;
begin
  if tg_op = 'UPDATE' and new.atleta_id is distinct from old.atleta_id then
    raise exception 'Un cuestionario no se puede pasar a otro atleta' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    v_prev := old;
  else
    select * into v_prev from public.cuestionarios c where c.atleta_id = new.atleta_id;
  end if;
  -- Un valor de salud nuevo (distinto del que había y no vacío) pide el consentimiento
  v_pide_consentimiento :=
       (new.activo is not null and new.activo is distinct from v_prev.activo)
    or (new.enfermedad is not null and new.enfermedad is distinct from v_prev.enfermedad)
    or (new.enfermedad_detalle is not null and new.enfermedad_detalle is distinct from v_prev.enfermedad_detalle)
    or (new.sintomas is not null and new.sintomas is distinct from v_prev.sintomas)
    or (new.otras is not null and new.otras is distinct from v_prev.otras)
    or (new.medicacion_detalle is not null and new.medicacion_detalle is distinct from v_prev.medicacion_detalle)
    or (new.lesiones is not null and new.lesiones is distinct from v_prev.lesiones)
    or (new.alergias is not null and new.alergias is distinct from v_prev.alergias);
  if v_app and v_pide_consentimiento and not public.consentimiento_salud_de_atleta(new.atleta_id) then
    raise exception 'Para responder lo de salud hace falta el consentimiento de datos de salud del atleta' using errcode = '42501';
  end if;
  v_cambia_salud := tg_op = 'UPDATE'
    and (new.activo, new.enfermedad, new.enfermedad_detalle, new.sintomas, new.otras, new.medicacion_detalle, new.lesiones, new.alergias)
        is distinct from (old.activo, old.enfermedad, old.enfermedad_detalle, old.sintomas, old.otras, old.medicacion_detalle,
                          old.lesiones, old.alergias);
  new.resultado := public.resultado_cribado(new.activo, new.enfermedad, new.sintomas);
  if v_app and not v_coach then
    new.revisado_en := case when tg_op = 'UPDATE' then old.revisado_en end;
    new.pedido_en := case when tg_op = 'UPDATE' then old.pedido_en end;
  end if;
  -- La petición y la revisión del coach, con la hora de la base (no la de su móvil), como la de completado
  if v_app and v_coach then
    if new.pedido_en is not null and (tg_op = 'INSERT' or new.pedido_en is distinct from old.pedido_en) then new.pedido_en := now(); end if;
    if new.revisado_en is not null and (tg_op = 'INSERT' or new.revisado_en is distinct from old.revisado_en) then new.revisado_en := now(); end if;
  end if;
  if v_cambia_salud then new.revisado_en := null; end if;
  -- Completado: la fecha la pone la base
  if new.completado_en is not null and (tg_op = 'INSERT' or new.completado_en is distinct from old.completado_en) then
    new.completado_en := now();
  end if;
  if v_app and v_coach and tg_op = 'UPDATE' and new.completado_en is distinct from old.completado_en then
    new.completado_en := old.completado_en;  -- lo completa el atleta, no el coach
  end if;
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists cuestionarios_aa_preparar on public.cuestionarios;
create trigger cuestionarios_aa_preparar before insert or update on public.cuestionarios
  for each row execute function public.cuestionario_preparar();
drop trigger if exists cuestionarios_exigir_alta on public.cuestionarios;
create trigger cuestionarios_exigir_alta before insert or update on public.cuestionarios
  for each row execute function public.exigir_alta();

alter table public.cuestionarios enable row level security;
drop policy if exists coach_todo on public.cuestionarios;
create policy coach_todo on public.cuestionarios for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.cuestionarios;
create policy atleta_ver on public.cuestionarios for select to authenticated using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_crear on public.cuestionarios;
create policy atleta_crear on public.cuestionarios for insert to authenticated with check (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_editar on public.cuestionarios;
create policy atleta_editar on public.cuestionarios for update to authenticated
  using (atleta_id = public.mi_atleta_id()) with check (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_borrar on public.cuestionarios;
create policy atleta_borrar on public.cuestionarios for delete to authenticated using (atleta_id = public.mi_atleta_id());

-- ---------------------------------------------------------------------
-- 2. Check-in a medida
-- ---------------------------------------------------------------------
-- Qué apartados del check-in se le preguntan (sin nada, todos)
alter table public.atletas add column if not exists checkin_apartados text[];
alter table public.atletas drop constraint if exists atletas_checkin_apartados_validos;
alter table public.atletas add constraint atletas_checkin_apartados_validos check (
  checkin_apartados is null
  or checkin_apartados <@ array['peso', 'descanso', 'molestias', 'alimentacion', 'medidas', 'reloj']::text[]
);

create table if not exists public.preguntas_checkin (
  id             uuid primary key default gen_random_uuid(),
  atleta_id      uuid references public.atletas(id) on delete cascade,   -- sin atleta: para todos
  texto          text not null,
  tipo           text not null default 'escala',                         -- escala (1 a 5) · numero · si_no · texto
  unidad         text,                                                   -- solo números: «h», «€», «cafés»
  ayuda          text,
  etiqueta_min   text,                                                   -- solo escala: qué es el 1…
  etiqueta_max   text,                                                   -- … y el 5
  orden          smallint not null default 0,
  activa         boolean not null default true,                          -- se archiva para no perder lo respondido
  creado_en      timestamptz not null default now()
);
create index if not exists preguntas_checkin_atleta_idx on public.preguntas_checkin (atleta_id);

alter table public.preguntas_checkin drop constraint if exists preguntas_checkin_valida;
alter table public.preguntas_checkin add constraint preguntas_checkin_valida check (
  char_length(texto) between 1 and 160 and public.texto_visible(texto)
  and tipo in ('escala', 'numero', 'si_no', 'texto')
  and (unidad is null or (tipo = 'numero' and char_length(unidad) <= 12 and public.texto_visible(unidad)))
  and (ayuda is null or (char_length(ayuda) <= 200 and public.texto_visible(ayuda)))
  and (etiqueta_min is null or (tipo = 'escala' and char_length(etiqueta_min) <= 30 and public.texto_visible(etiqueta_min)))
  and (etiqueta_max is null or (tipo = 'escala' and char_length(etiqueta_max) <= 30 and public.texto_visible(etiqueta_max)))
  and orden between 0 and 99
);

-- Con respuestas, una pregunta no cambia de tipo ni de atleta (las respuestas dejarían de cuadrar): se archiva
-- y se crea otra
-- Ni se borra: se archiva (salvo cuando se borra el atleta, que se lleva sus check-ins)
create or replace function public.proteger_pregunta_checkin() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.checkins c where c.respuestas ? old.id::text)
       and (old.atleta_id is null or exists (select 1 from public.atletas a where a.id = old.atleta_id)) then
      raise exception 'Esta pregunta ya tiene respuestas: archívala para no perderlas' using errcode = '23514';
    end if;
    return old;
  end if;
  if (new.tipo is distinct from old.tipo or new.atleta_id is distinct from old.atleta_id)
     and exists (select 1 from public.checkins c where c.respuestas ? old.id::text) then
    raise exception 'Esta pregunta ya tiene respuestas: para cambiarle el tipo o a quién va, archívala y crea otra' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists preguntas_checkin_proteger on public.preguntas_checkin;
create trigger preguntas_checkin_proteger before update or delete on public.preguntas_checkin
  for each row execute function public.proteger_pregunta_checkin();

alter table public.preguntas_checkin enable row level security;
drop policy if exists coach_todo on public.preguntas_checkin;
create policy coach_todo on public.preguntas_checkin for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
-- El atleta ve las suyas y las de todos (también las archivadas, para su historial); no las cambia
drop policy if exists atleta_ver on public.preguntas_checkin;
create policy atleta_ver on public.preguntas_checkin for select to authenticated
  using (atleta_id = public.mi_atleta_id() or (atleta_id is null and public.mi_atleta_id() is not null));

-- Las respuestas, en el check-in: { id de la pregunta: valor }
alter table public.checkins add column if not exists respuestas jsonb;

-- Cada respuesta, de una pregunta de ese atleta (o para todos) y con la forma de su tipo. Sin «security
-- definer»: la pregunta se lee con los permisos de quien escribe, así que una ajena da el mismo error que una
-- que no existe. Una respuesta que ya estaba y no cambia se deja aunque la pregunta ya no exista; en un upsert
-- (que llega aquí primero como INSERT) «lo que ya estaba» es el check-in de esa semana, si lo hay.
create or replace function public.checkin_respuestas_validar() returns trigger
language plpgsql set search_path = '' as $$
declare
  r record;
  p public.preguntas_checkin;
  v numeric;
  v_ok boolean;
  v_previas jsonb;
begin
  if new.respuestas is null then return new; end if;
  if jsonb_typeof(new.respuestas) <> 'object' or (select count(*) from jsonb_object_keys(new.respuestas)) > 100 then
    raise exception 'Respuestas del check-in no válidas' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    v_previas := old.respuestas;
  else
    select c.respuestas into v_previas from public.checkins c where c.atleta_id = new.atleta_id and c.semana_inicio = new.semana_inicio;
  end if;
  for r in select key, value from jsonb_each(new.respuestas) loop
    if v_previas is not null and v_previas -> r.key = r.value then continue; end if;
    p := null;
    if r.key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select * into p from public.preguntas_checkin q
      where q.id = r.key::uuid and (q.atleta_id = new.atleta_id or q.atleta_id is null);
    end if;
    if p.id is null then
      raise exception 'Una de las respuestas no es de una pregunta de tu check-in' using errcode = '23514';
    end if;
    v_ok := case p.tipo
         when 'escala' then jsonb_typeof(r.value) = 'number' and r.value::text in ('1', '2', '3', '4', '5')
         when 'si_no' then jsonb_typeof(r.value) = 'boolean'
         when 'texto' then jsonb_typeof(r.value) = 'string' and char_length(r.value #>> '{}') between 1 and 1000
                           and public.texto_visible(r.value #>> '{}')
         else jsonb_typeof(r.value) = 'number'
       end;
    if not coalesce(v_ok, false) then
      raise exception 'La respuesta a «%» no tiene la forma que toca', left(p.texto, 60) using errcode = '23514';
    end if;
    if p.tipo = 'numero' then
      v := (r.value #>> '{}')::numeric;
      if v < 0 or v >= 1000000 or v <> round(v, 2) then
        raise exception 'La respuesta a «%» está fuera de rango (de 0 a 999999, con dos decimales)', left(p.texto, 60) using errcode = '23514';
      end if;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists checkins_ab_respuestas on public.checkins;
create trigger checkins_ab_respuestas before insert or update of respuestas on public.checkins
  for each row execute function public.checkin_respuestas_validar();

-- ---------------------------------------------------------------------
-- 3. Notificaciones nuevas (de la 010): al coach, «Ana ha completado su cuestionario» (y «Revisa el
--    cuestionario de Ana» si cuenta síntomas entrenando antes de enviarlo); al atleta, «Tu coach te pide que
--    rellenes (o actualices) tu cuestionario». Sin nada de salud en el texto.
-- ---------------------------------------------------------------------
alter table public.notificaciones drop constraint if exists notificaciones_validas;
alter table public.notificaciones add constraint notificaciones_validas check (
  tipo in ('respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario',
           'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido', 'prueba')
  and char_length(titulo) between 1 and 80
  and (cuerpo is null or char_length(cuerpo) <= 160)
  and url in ('#hoy', '#semana', '#checkin', '#progreso', '#perfil', '#atletas', '#revisar', '#cuenta')
  and char_length(clave) between 1 and 100
  and estado in ('pendiente', 'enviando', 'enviada', 'caducada', 'fallida')
  and (canal is null or canal in ('push', 'email'))
  and intentos between 0 and 100
  and (error is null or char_length(error) <= 200)
) not valid; -- «not valid» como en la 010: si se repite esta migración con avisos posteriores (p. ej. «#mensajes», de la 014), no se para
alter table public.preferencias_notificaciones drop constraint if exists preferencias_notificaciones_validas;
alter table public.preferencias_notificaciones add constraint preferencias_notificaciones_validas check (
  desactivados <@ array['respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario',
                        'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido']::text[]
  and hora_manana between time '05:00' and time '12:00' and extract(second from hora_manana) = 0
  and hora_tarde between time '12:00' and time '23:30' and extract(second from hora_tarde) = 0
  and dia_checkin between 1 and 7
  and (silencio_desde is null) = (silencio_hasta is null)
  and (silencio_desde is null or (silencio_desde <> silencio_hasta
       and extract(second from silencio_desde) = 0 and extract(second from silencio_hasta) = 0))
);

-- notificar (010), con una regla general para el «no molestar»: lo retrasa todo menos los recordatorios (su
-- hora la ha elegido la persona) y la de prueba
create or replace function fbe_privado.notificar(
  p_usuario uuid, p_tipo text, p_titulo text, p_cuerpo text, p_url text, p_clave text,
  p_desde timestamptz default null, p_caduca timestamptz default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  pr public.preferencias_notificaciones;
  v_desde timestamptz := coalesce(p_desde, now());
  v_caduca timestamptz;
begin
  if p_usuario is null then return false; end if;
  select * into pr from public.preferencias_notificaciones where usuario_id = p_usuario;
  if p_tipo <> 'prueba' and p_tipo = any (coalesce(pr.desactivados, '{sesion_hecha}'::text[])) then return false; end if;
  if not coalesce(pr.email, false)
     and not exists (select 1 from public.suscripciones_push s where s.usuario_id = p_usuario) then
    return false;
  end if;
  if p_tipo not in ('sesion_hoy', 'checkin', 'habitos', 'nutricion', 'prueba') then
    if pr.usuario_id is null then
      v_desde := fbe_privado.fuera_de_silencio(v_desde, time '22:30', time '08:00');
    else
      v_desde := fbe_privado.fuera_de_silencio(v_desde, pr.silencio_desde, pr.silencio_hasta);
    end if;
  end if;
  v_caduca := coalesce(p_caduca, v_desde + interval '1 day');
  if v_caduca <= v_desde then return false; end if;
  insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, url, clave, enviar_desde, caduca_en)
  values (p_usuario, p_tipo, coalesce(fbe_privado.linea(p_titulo, 80), 'FBE Atletas'), fbe_privado.linea(p_cuerpo, 160),
          p_url, left(p_clave, 100), v_desde, v_caduca)
  on conflict (usuario_id, clave) do nothing;
  return found;
end $$;

create or replace function fbe_privado.al_cambiar_cuestionario() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  a public.atletas;
begin
  select * into a from public.atletas where id = new.atleta_id;
  if a.id is null then return null; end if;
  -- El atleta lo completa (o lo vuelve a completar) → al coach
  if new.completado_en is not null and (tg_op = 'INSERT' or new.completado_en is distinct from old.completado_en) then
    perform fbe_privado.notificar_seguro(p.id, 'cuestionario_recibido',
      coalesce(fbe_privado.nombre_corto(a.nombre), 'Un atleta') || ' ha completado su cuestionario',
      'Lo tienes en su ficha, en Datos.', '#atletas', 'cuestionario:' || new.id || ':' || (extract(epoch from new.completado_en) * 1000)::bigint)
    from public.perfiles p where p.rol = 'coach' and p.id is distinct from auth.uid();
  end if;
  -- Síntomas entrenando (la recomendación es parar) guardados en su paso, aún sin enviar → al coach, ya (sin
  -- decir qué: «Revisa el cuestionario de Ana»)
  if new.resultado = 'parar_y_valorar' and (tg_op = 'INSERT' or old.resultado is distinct from new.resultado)
     and not (new.completado_en is not null and (tg_op = 'INSERT' or new.completado_en is distinct from old.completado_en)) then
    perform fbe_privado.notificar_seguro(p.id, 'cuestionario_recibido',
      'Revisa el cuestionario de ' || coalesce(fbe_privado.nombre_corto(a.nombre), 'un atleta'),
      'Lo tienes en su ficha, en Datos.', '#atletas', 'cuestionario_salud:' || new.id || ':' || (extract(epoch from now()) * 1000)::bigint)
    from public.perfiles p where p.rol = 'coach' and p.id is distinct from auth.uid();
  end if;
  -- El coach lo pide → al atleta
  if new.pedido_en is not null and (tg_op = 'INSERT' or new.pedido_en is distinct from old.pedido_en) and a.estado = 'activo' then
    perform fbe_privado.notificar_seguro(a.perfil_id, 'cuestionario',
      case when new.completado_en is null then 'Tu coach te pide tu cuestionario inicial' else 'Tu coach te pide que actualices tu cuestionario' end,
      'Son unos minutos: está en Hoy.', '#hoy', 'cuestionario_pedido:' || new.id || ':' || (extract(epoch from new.pedido_en) * 1000)::bigint);
  end if;
  return null;
exception when others then
  raise warning 'FBE: notificación del cuestionario % no creada: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists cuestionarios_zz_notificar on public.cuestionarios;
create trigger cuestionarios_zz_notificar after insert or update on public.cuestionarios
  for each row execute function fbe_privado.al_cambiar_cuestionario();

-- ---------------------------------------------------------------------
-- Permisos (como al final de 003 a 010)
-- ---------------------------------------------------------------------
revoke all on public.cuestionarios, public.preguntas_checkin from anon;
grant select, insert, update, delete on public.cuestionarios, public.preguntas_checkin to authenticated;
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
-- Las del servidor (010), solo para la clave de servicio
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

-- Apuntada
insert into public.fbe_migraciones (numero) values (11)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;

-- ============================== migraciones/012_dibujos_video.sql ==============================
-- =====================================================================
-- FBE Atletas, migración 012 (v0.14): líneas y ángulos sobre los vídeos de técnica
-- Un comentario de un vídeo puede llevar un dibujo sobre un fotograma: el momento (segundos) y hasta 12
-- formas (líneas de dos puntos y ángulos de tres: vértice y dos extremos), con las coordenadas de 0 a 1
-- respecto a la imagen del vídeo, para que se vea igual en cualquier pantalla. Lo dibuja quien comenta
-- (el coach al corregir; el atleta, si quiere señalar algo) y, como el texto, no se edita después.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 011 (o con instalar.sql en una
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
  if v > 12 then
    raise exception 'Esta base ya tiene la migración %: repetir la 012 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 12;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 11) then
    raise exception 'Antes de la 012 hace falta la 011: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

alter table public.comentarios add column if not exists dibujo jsonb;

-- (Con una clave que falte, jsonb_typeof da null: por eso los coalesce, para que el resultado sea false y no null, que
-- un CHECK aceptaría)
-- { "t": segundos, "formas": [ { "tipo": "linea", "p": [[x,y],[x,y]] } | { "tipo": "angulo", "p": [[x,y],[x,y],[x,y]] } ] }
create or replace function public.dibujo_valido(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object'
    and not exists (select 1 from jsonb_object_keys(j) k where k not in ('t', 'formas'))
    and coalesce(jsonb_typeof(j -> 't'), '') = 'number' and (j ->> 't')::numeric >= 0 and (j ->> 't')::numeric < 3600
    and coalesce(jsonb_typeof(j -> 'formas'), '') = 'array' and jsonb_array_length(j -> 'formas') between 1 and 12
    and not exists (
      select 1 from jsonb_array_elements(j -> 'formas') f
      where jsonb_typeof(f) <> 'object'
         or exists (select 1 from jsonb_object_keys(f) k where k not in ('tipo', 'p'))
         or coalesce(f ->> 'tipo', '') not in ('linea', 'angulo')
         or coalesce(jsonb_typeof(f -> 'p'), '') <> 'array'
         or jsonb_array_length(f -> 'p') <> case f ->> 'tipo' when 'linea' then 2 else 3 end
         or exists (
           select 1 from jsonb_array_elements(f -> 'p') pt
           where jsonb_typeof(pt) <> 'array' or jsonb_array_length(pt) <> 2
              or exists (select 1 from jsonb_array_elements(pt) c
                         where jsonb_typeof(c) <> 'number' or (c #>> '{}')::numeric < 0 or (c #>> '{}')::numeric > 1)
         )
    )
$$;

alter table public.comentarios drop constraint if exists comentarios_dibujo_valido;
alter table public.comentarios add constraint comentarios_dibujo_valido check (
  dibujo is null or (archivo_id is not null and public.dibujo_valido(dibujo) is true)
);

-- comentario_preparar (002): el dibujo tampoco se edita después
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
    new.leido_en := null;
    new.creado_en := now();
    return new;
  end if;
  if v_autor is not null then
    if (new.atleta_id, new.sesion_id, new.checkin_id, new.archivo_id, new.autor, new.texto, new.creado_en, new.dibujo)
       is distinct from
       (old.atleta_id, old.sesion_id, old.checkin_id, old.archivo_id, old.autor, old.texto, old.creado_en, old.dibujo) then
      raise exception 'Un comentario no se puede editar' using errcode = '42501';
    end if;
    if old.autor = v_autor and new.leido_en is distinct from old.leido_en then
      raise exception 'Solo quien recibe un comentario lo marca como leído' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- Permisos (como al final de 003 a 011)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (12)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;

-- ============================== migraciones/013_cardio.sql ==============================
-- =====================================================================
-- FBE Equipo, migración 013 (v0.17): cardio de verdad
-- Una sesión (sobre todo las de tipo «cardio») puede llevar una pauta de cardio que escribe el coach
-- (modalidad, minutos u objetivo de kilómetros, esfuerzo objetivo y una nota) y el registro del atleta al
-- terminar (modalidad, minutos y kilómetros). La duración y el esfuerzo de la sesión siguen en duracion_min
-- y rpe_sesion, como en cualquier otra sesión.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 012 (o con instalar.sql en una
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
  if v > 13 then
    raise exception 'Esta base ya tiene la migración %: repetir la 013 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 13;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 12) then
    raise exception 'Antes de la 013 hace falta la 012: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

alter table public.sesiones add column if not exists cardio jsonb;        -- la pauta (solo el coach)
alter table public.sesiones add column if not exists cardio_hecho jsonb;  -- lo hecho (el atleta)

-- Pauta: { "modalidad": "carrera", "minutos": 30, "km": 5, "esfuerzo": 6, "nota": "…" }
-- Modalidad obligatoria; minutos o km (al menos uno); esfuerzo (RPE objetivo) y nota, opcionales.
-- (Con una clave que falte, jsonb_typeof da null: por eso los coalesce, para que el resultado sea false y no null)
create or replace function public.cardio_valido(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object'
    and not exists (select 1 from jsonb_object_keys(j) k where k not in ('modalidad', 'minutos', 'km', 'esfuerzo', 'nota'))
    and coalesce(j ->> 'modalidad', '') in ('carrera', 'andar', 'bici', 'eliptica', 'remo', 'nadar', 'cuerda', 'otro')
    and (j ? 'minutos' or j ? 'km')
    and (not (j ? 'minutos') or (jsonb_typeof(j -> 'minutos') = 'number' and (j ->> 'minutos')::numeric = floor((j ->> 'minutos')::numeric)
                                 and (j ->> 'minutos')::numeric between 1 and 600))
    and (not (j ? 'km') or (jsonb_typeof(j -> 'km') = 'number' and (j ->> 'km')::numeric > 0 and (j ->> 'km')::numeric <= 200))
    and (not (j ? 'esfuerzo') or (jsonb_typeof(j -> 'esfuerzo') = 'number' and (j ->> 'esfuerzo')::numeric between 1 and 10))
    and (not (j ? 'nota') or (jsonb_typeof(j -> 'nota') = 'string' and length(j ->> 'nota') between 1 and 300))
$$;

-- Lo hecho: { "modalidad": "carrera", "minutos": 32, "km": 5.2 }. Modalidad y minutos obligatorios; km opcional.
create or replace function public.cardio_hecho_valido(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object'
    and not exists (select 1 from jsonb_object_keys(j) k where k not in ('modalidad', 'minutos', 'km'))
    and coalesce(j ->> 'modalidad', '') in ('carrera', 'andar', 'bici', 'eliptica', 'remo', 'nadar', 'cuerda', 'otro')
    and coalesce(jsonb_typeof(j -> 'minutos'), '') = 'number' and (j ->> 'minutos')::numeric = floor((j ->> 'minutos')::numeric)
    and (j ->> 'minutos')::numeric between 1 and 600
    and (not (j ? 'km') or (jsonb_typeof(j -> 'km') = 'number' and (j ->> 'km')::numeric > 0 and (j ->> 'km')::numeric <= 200))
$$;

alter table public.sesiones drop constraint if exists sesiones_cardio_valido;
alter table public.sesiones add constraint sesiones_cardio_valido check (cardio is null or public.cardio_valido(cardio) is true);
alter table public.sesiones drop constraint if exists sesiones_cardio_hecho_valido;
alter table public.sesiones add constraint sesiones_cardio_hecho_valido check (cardio_hecho is null or public.cardio_hecho_valido(cardio_hecho) is true);

-- proteger_sesion (002, 008): la pauta de cardio también es solo del coach. Lo demás, igual que en la 008.
create or replace function public.proteger_sesion() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    if (new.id, new.semana_id, new.orden, new.nombre, new.tipo, new.intencion, new.dinamica, new.cardio)
       is distinct from
       (old.id, old.semana_id, old.orden, old.nombre, old.tipo, old.intencion, old.dinamica, old.cardio) then
      raise exception 'Solo el coach puede cambiar la prescripción de la sesión' using errcode = '42501';
    end if;
    if (to_jsonb(new) - 'dia_previsto' - 'revisada_en') is distinct from (to_jsonb(old) - 'dia_previsto' - 'revisada_en') then
      new.revisada_en := null;
    else
      new.revisada_en := old.revisada_en;
    end if;
  end if;
  return new;
end $$;

-- Las funciones de copia (por si se usan desde el SQL Editor) copian también la pauta de cardio
create or replace function public.duplicar_semana(
  p_semana uuid, p_kg_extra numeric default 0, p_reps_extra int default 0, p_rir_delta numeric default 0)
returns uuid language plpgsql set search_path = public as $$
declare
  v_old   public.semanas;
  v_nueva uuid;
  s       record;
  v_ses   uuid;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  select * into v_old from public.semanas where id = p_semana;
  if not found then raise exception 'Semana no encontrada'; end if;

  insert into public.semanas (bloque_id, numero, foco, fecha_inicio, programacion)
  values (v_old.bloque_id,
          (select max(numero) + 1 from public.semanas where bloque_id = v_old.bloque_id),
          v_old.foco, v_old.fecha_inicio + 7, 'en_programacion')
  returning id into v_nueva;

  for s in select * from public.sesiones where semana_id = p_semana order by orden loop
    insert into public.sesiones (semana_id, orden, nombre, tipo, intencion, dinamica, cardio)
    values (v_nueva, s.orden, s.nombre, s.tipo, s.intencion, s.dinamica, s.cardio)
    returning id into v_ses;

    insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, superserie, prioridad, series,
      reps_min, reps_max, rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante,
      backoff_pct)
    select v_ses, ejercicio_id, orden, superserie, prioridad, series,
           reps_min + p_reps_extra, reps_max + p_reps_extra,
           greatest(rir_objetivo + p_rir_delta, 0), rpe_objetivo,
           case when carga_sugerida_kg is null then null else carga_sugerida_kg + p_kg_extra end,
           descanso_seg, tempo, notas_coach, variante, backoff_pct
    from public.sesion_ejercicios where sesion_id = s.id;
  end loop;
  return v_nueva;
end $$;

create or replace function public.crear_bloque_desde_plantilla(
  p_plantilla uuid, p_atleta uuid, p_fecha_inicio date, p_numero int default null)
returns uuid language plpgsql set search_path = public as $$
declare
  v_pl     public.bloques;
  v_bloque uuid;
  w        record;
  s        record;
  v_sem    uuid;
  v_ses    uuid;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  select * into v_pl from public.bloques where id = p_plantilla and es_plantilla;
  if not found then raise exception 'Plantilla no encontrada'; end if;

  insert into public.bloques (atleta_id, numero, nombre, foco, objetivo, descripcion, fecha_inicio, estado)
  values (p_atleta,
          coalesce(p_numero, (select coalesce(max(numero), 0) + 1 from public.bloques where atleta_id = p_atleta)),
          v_pl.nombre, v_pl.foco, v_pl.objetivo, v_pl.descripcion, p_fecha_inicio, 'planificado')
  returning id into v_bloque;

  for w in select * from public.semanas where bloque_id = p_plantilla order by numero loop
    insert into public.semanas (bloque_id, numero, foco, fecha_inicio, nota_coach, programacion)
    values (v_bloque, w.numero, w.foco, p_fecha_inicio + (w.numero - 1) * 7, w.nota_coach, 'en_programacion')
    returning id into v_sem;
    for s in select * from public.sesiones where semana_id = w.id order by orden loop
      insert into public.sesiones (semana_id, orden, nombre, tipo, intencion, dinamica, cardio)
      values (v_sem, s.orden, s.nombre, s.tipo, s.intencion, s.dinamica, s.cardio)
      returning id into v_ses;
      insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, superserie, prioridad, series,
        reps_min, reps_max, rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante,
        backoff_pct)
      select v_ses, ejercicio_id, orden, superserie, prioridad, series, reps_min, reps_max,
             rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante, backoff_pct
      from public.sesion_ejercicios where sesion_id = s.id;
    end loop;
  end loop;
  return v_bloque;
end $$;

-- Permisos (como al final de 003 a 012)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (13)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;

-- ============================== migraciones/014_mensajes_y_diario.sql ==============================
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

-- ============================== migraciones/015_foto_perfil.sql ==============================
-- =====================================================================
-- FBE Equipo, migración 015 (v0.19): foto de perfil
-- 1. Cada persona (atleta o coach) puede poner su foto de perfil. Es una imagen pequeña (256 px, JPEG o WebP,
--    menos de 60 KB) que la propia app recorta y comprime en el móvil; se guarda en la fila de su perfil, así
--    que la protegen los mismos permisos: cada uno ve y cambia la suya y el coach ve (y puede quitar) todas.
-- 2. El atleta ve la foto de su coach (para el chat) con una función que solo devuelve eso: la foto, no el
--    resto del perfil del coach.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 014 (o con instalar.sql en una
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
  if v > 15 then
    raise exception 'Esta base ya tiene la migración %: repetir la 015 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 15;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 14) then
    raise exception 'Antes de la 015 hace falta la 014: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. La foto, en el perfil: una imagen en base64 con su tipo y un tamaño máximo
-- ---------------------------------------------------------------------
alter table public.perfiles add column if not exists foto text;
alter table public.perfiles drop constraint if exists perfiles_foto_valida;
alter table public.perfiles add constraint perfiles_foto_valida check (
  foto is null or (
    char_length(foto) <= 80000
    and foto ~ '^data:image/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$'
  )
) not valid;

-- ---------------------------------------------------------------------
-- 2. La foto del coach, para sus atletas (solo la foto)
-- ---------------------------------------------------------------------
create or replace function public.foto_coach() returns text
language sql stable security definer set search_path = '' as $$
  select p.foto from public.perfiles p
  where p.rol = 'coach' and auth.uid() is not null
  order by p.creado_en
  limit 1;
$$;

-- Permisos (como al final de 003 a 014)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (15)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;

-- ============================== migraciones/016_objetivos_multiples.sql ==============================
-- =====================================================================
-- FBE Equipo, migración 016 (v0.20): varios objetivos en el cuestionario inicial
-- El atleta puede marcar varios objetivos (ganar fuerza y perder grasa, por ejemplo). Se guardan en
-- «objetivos», en el orden en que los marca: el primero es el principal y es el que sigue en «objetivo»,
-- así lo que ya leía «objetivo» funciona igual. La base mantiene los dos de acuerdo: si alguien escribe
-- solo uno (una versión anterior de la app), el otro se ajusta solo.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 015 (o con instalar.sql en una
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
  if v > 16 then
    raise exception 'Esta base ya tiene la migración %: repetir la 016 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 16;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 15) then
    raise exception 'Antes de la 016 hace falta la 015: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

alter table public.cuestionarios add column if not exists objetivos text[];

-- Los dos campos, de acuerdo: «objetivos» manda si cambia; si solo cambia «objetivo», «objetivos» lo sigue
create or replace function public.cuestionario_objetivos() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.objetivos is not null and cardinality(new.objetivos) = 0 then new.objetivos := null; end if;
  if tg_op = 'INSERT' or new.objetivos is distinct from old.objetivos then
    if new.objetivos is not null then
      -- sin repetidos, en el orden en que los marcó
      new.objetivos := array(select o from unnest(new.objetivos) with ordinality u(o, n) group by o order by min(n));
      new.objetivo := new.objetivos[1];
    elsif tg_op = 'UPDATE' and new.objetivo is not distinct from old.objetivo then
      new.objetivo := null;
    else
      new.objetivos := case when new.objetivo is null then null else array[new.objetivo] end;
    end if;
  elsif new.objetivo is distinct from old.objetivo then
    new.objetivos := case
      when new.objetivo is null then null
      when new.objetivo = any(coalesce(old.objetivos, '{}')) then array_prepend(new.objetivo, array_remove(old.objetivos, new.objetivo))
      else array_prepend(new.objetivo, coalesce(old.objetivos[2:], '{}'))
    end;
  end if;
  return new;
end $$;
drop trigger if exists cuestionarios_a_objetivos on public.cuestionarios;
create trigger cuestionarios_a_objetivos before insert or update on public.cuestionarios
  for each row execute function public.cuestionario_objetivos();

-- Lo que ya había: su objetivo pasa a ser la lista de uno
update public.cuestionarios set objetivos = array[objetivo] where objetivo is not null and objetivos is null;

alter table public.cuestionarios drop constraint if exists cuestionarios_objetivos_validos;
alter table public.cuestionarios add constraint cuestionarios_objetivos_validos check (
  objetivos is null or (
    cardinality(objetivos) between 1 and 6
    and objetivos <@ array['fuerza', 'musculo', 'perder_grasa', 'salud', 'rendimiento', 'otro']::text[]
    and objetivo = objetivos[1]
  )
) not valid;

-- Permisos (como al final de 003 a 015)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (16)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;

-- ============================== migraciones/017_registro_errores.sql ==============================
-- =====================================================================
-- FBE Equipo, migración 017 (v0.21): registro de errores de la app
-- Cuando algo falla en el móvil de un atleta (o en el tuyo), la app lo apunta aquí sola: qué pantalla, qué
-- error y en qué versión, para poder arreglarlo sin esperar a que alguien lo cuente. Sin datos de salud ni lo
-- que se estaba escribiendo: solo el mensaje técnico del error.
-- - Se apuntan con registrar_error(): cada persona, a su nombre; solo el coach los lee y los borra.
-- - Como mucho 30 por persona y hora (si algo falla en bucle, no llena la base), y se borran solos a los 60 días.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 016 (o con instalar.sql en una
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
  if v > 17 then
    raise exception 'Esta base ya tiene la migración %: repetir la 017 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 17;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 16) then
    raise exception 'Antes de la 017 hace falta la 016: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

create table if not exists public.errores_app (
  id          uuid primary key default gen_random_uuid(),
  perfil_id   uuid references public.perfiles(id) on delete cascade default auth.uid(),
  creado_en   timestamptz not null default now(),
  version     text,          -- versión de la app (p. ej. «0.21 · 3f2a9c»)
  pantalla    text,          -- dónde estaba: «#hoy», «sesión»…
  mensaje     text not null, -- el mensaje del error
  detalle     text,          -- dónde saltó (la pila), recortado
  navegador   text           -- móvil y navegador, para reproducirlo
);
create index if not exists errores_app_creado_idx on public.errores_app (creado_en desc);
create index if not exists errores_app_perfil_idx on public.errores_app (perfil_id, creado_en desc);

alter table public.errores_app drop constraint if exists errores_app_validos;
alter table public.errores_app add constraint errores_app_validos check (
  char_length(mensaje) between 1 and 500
  and (version is null or char_length(version) <= 40)
  and (pantalla is null or char_length(pantalla) <= 60)
  and (detalle is null or char_length(detalle) <= 2000)
  and (navegador is null or char_length(navegador) <= 300)
);

-- Se apunta con esta función (nadie escribe la tabla directamente): la base pone quién y cuándo, recorta lo
-- largo, aplica el límite por hora y, de paso, borra lo de hace más de 60 días. Nunca falla hacia la app.
drop trigger if exists errores_app_preparar on public.errores_app;
drop function if exists public.error_app_preparar();
create or replace function public.registrar_error(p_mensaje text, p_pantalla text default null, p_detalle text default null,
                                                  p_version text default null, p_navegador text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  if (select count(*) from public.errores_app e where e.perfil_id = auth.uid() and e.creado_en > now() - interval '1 hour') >= 30 then
    return;  -- algo falla en bucle: no se apunta más (sin error, para no provocar otro)
  end if;
  delete from public.errores_app where creado_en < now() - interval '60 days';
  insert into public.errores_app (perfil_id, mensaje, pantalla, detalle, version, navegador)
  values (auth.uid(), left(coalesce(nullif(btrim(p_mensaje), ''), '(sin mensaje)'), 500), nullif(left(btrim(p_pantalla), 60), ''),
          nullif(left(p_detalle, 2000), ''), nullif(left(btrim(p_version), 40), ''), nullif(left(btrim(p_navegador), 300), ''));
exception when others then
  return;
end $$;

-- Solo el coach los lee y los borra
alter table public.errores_app enable row level security;
drop policy if exists apuntar_propio on public.errores_app;
drop policy if exists coach_ver on public.errores_app;
create policy coach_ver on public.errores_app for select to authenticated using (public.es_coach());
drop policy if exists coach_borrar on public.errores_app;
create policy coach_borrar on public.errores_app for delete to authenticated using (public.es_coach());
revoke all on public.errores_app from public, anon, authenticated;
grant select, delete on public.errores_app to authenticated;

-- Permisos (como al final de 003 a 016)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (17)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;

-- ============================== migraciones/018_servicio_y_nivel.sql ==============================
-- =====================================================================
-- FBE Equipo, migración 018 (v0.22): servicio y nivel de cada atleta
-- 1. Servicio: a unos atletas les llevas solo el entrenamiento y a otros también la nutrición. Con
--    «nutricion» en false, el atleta no ve nada de nutrición en la app y no recibe recordatorios de apuntarla.
--    No se borra nada: si vuelves a activarla, todo sigue ahí.
-- 2. Nivel (novato, intermedio, avanzado): decide cómo pautas en el editor (kg o RPE objetivo según la
--    prioridad de cada ejercicio). Sin nivel, el editor enseña todas las columnas, como hasta ahora.
--    El atleta no ve su nivel.
-- Solo el coach cambia estos datos (el atleta solo puede leer su ficha).
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 017 (o con instalar.sql en una
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
  if v > 18 then
    raise exception 'Esta base ya tiene la migración %: repetir la 018 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 18;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 17) then
    raise exception 'Antes de la 018 hace falta la 017: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Servicio y nivel, en la ficha del atleta
-- ---------------------------------------------------------------------
alter table public.atletas add column if not exists nutricion boolean not null default true;
alter table public.atletas add column if not exists nivel text;
alter table public.atletas drop constraint if exists atletas_nivel_valido;
alter table public.atletas add constraint atletas_nivel_valido
  check (nivel is null or nivel in ('novato', 'intermedio', 'avanzado'));

-- ---------------------------------------------------------------------
-- 2. Recordatorios: la nutrición solo a quien se la llevas (lo demás, igual que en la 010)
-- ---------------------------------------------------------------------
create or replace function public.crear_recordatorios(p_ahora timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_local timestamp := p_ahora at time zone 'Europe/Madrid';
  v_hoy date := (p_ahora at time zone 'Europe/Madrid')::date;
  v_dow integer := extract(isodow from (p_ahora at time zone 'Europe/Madrid'))::integer;
  v_lunes date;
  v_n integer := 0;
  v_m integer;
begin
  perform fbe_privado.solo_servidor();
  v_lunes := v_hoy - (v_dow - 1);

  -- Hoy toca… (solo si planificó el día de la sesión en «Tu plan»). Cada consulta elige primero a quién
  -- (materialized: así la notificación solo se crea para esas filas, sin depender del orden del WHERE)
  with x as materialized (
    select d.perfil_id, d.hora_manana, count(*) as n, min(s.nombre) as nombre
    from fbe_privado.destinatarios d
    join public.bloques b on b.atleta_id = d.atleta_id and not b.es_plantilla and b.estado not in ('cancelado', 'finalizado')
    join public.semanas w on w.bloque_id = b.id and w.programacion = 'programada'
    join public.sesiones s on s.semana_id = w.id and s.dia_previsto = v_hoy and not s.completada
    where not ('sesion_hoy' = any (d.desactivados))
      and v_local >= v_hoy + d.hora_manana and v_local < v_hoy + d.hora_manana + interval '2 hours'
    group by d.perfil_id, d.hora_manana
  )
  select count(*) into v_m from x
  where fbe_privado.notificar_seguro(x.perfil_id, 'sesion_hoy',
          case when x.n = 1 then 'Hoy toca ' || x.nombre else 'Hoy tienes ' || x.n || ' sesiones' end,
          case when x.n = 1 then 'La tienes en Hoy.' else 'Las tienes en Hoy.' end,
          '#hoy', 'recordatorio_sesion:' || v_hoy, p_ahora,
          (v_hoy + x.hora_manana + interval '4 hours') at time zone 'Europe/Madrid');
  v_n := v_n + v_m;

  -- El check-in de la semana (el lunes, el de la semana que acaba de terminar, como en la app)
  with d as materialized (
    select d.perfil_id, d.hora_tarde from fbe_privado.destinatarios d
    where d.salud and not ('checkin' = any (d.desactivados)) and d.dia_checkin = v_dow
      and v_local >= v_hoy + d.hora_tarde and v_local < v_hoy + d.hora_tarde + interval '2 hours'
      and not exists (select 1 from public.checkins c
                      where c.atleta_id = d.atleta_id and c.semana_inicio = case when v_dow = 1 then v_lunes - 7 else v_lunes end)
  )
  select count(*) into v_m from d
  where fbe_privado.notificar_seguro(d.perfil_id, 'checkin', '¿Haces el check-in?',
          case when v_dow = 1 then 'El de la semana pasada aún está pendiente.' else 'El de esta semana aún está pendiente.' end,
          '#checkin', 'recordatorio_checkin:' || v_hoy, p_ahora,
          (v_hoy + d.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
  v_n := v_n + v_m;

  -- Por la tarde, una sola: los hábitos que hoy le hacen falta (los diarios sin apuntar y los de x días a la
  -- semana que ya no llegan si se salta hoy) y la nutrición sin apuntar (si tiene plan)
  with x as materialized (
    select * from (
    select d.perfil_id, d.hora_tarde,
      case when 'habitos' = any (d.desactivados) then 0 else (
        select count(*) from public.habitos h
        where h.atleta_id = d.atleta_id and h.activo
          and not exists (select 1 from public.registros_habito r where r.habito_id = h.id and r.fecha = v_hoy)
          and h.dias_semana - (
            select count(*) from public.registros_habito r
            where r.habito_id = h.id and r.fecha >= v_lunes and r.fecha < v_hoy
              and case when h.tipo = 'si_no' then r.valor >= 1
                       when h.sentido = 'al_menos' then r.valor >= h.objetivo
                       else r.valor <= h.objetivo end
          ) >= 8 - v_dow
      ) end as habitos,
      not ('nutricion' = any (d.desactivados))
        and exists (select 1 from public.planes_nutricion pn where pn.atleta_id = d.atleta_id and pn.desde <= v_hoy)
        and exists (select 1 from public.atletas a where a.id = d.atleta_id and a.nutricion)
        and not exists (select 1 from public.registros_nutricion rn where rn.atleta_id = d.atleta_id and rn.fecha = v_hoy) as nutricion
    from fbe_privado.destinatarios d
    where d.salud and v_local >= v_hoy + d.hora_tarde and v_local < v_hoy + d.hora_tarde + interval '2 hours'
    ) y
    where y.habitos > 0 or y.nutricion
  )
  select count(*) into v_m from x
  where fbe_privado.notificar_seguro(x.perfil_id, case when x.habitos > 0 then 'habitos' else 'nutricion' end,
          case when x.habitos > 0 and x.nutricion then
                 case when x.habitos = 1 then 'Te queda un hábito y la nutrición de hoy' else 'Te quedan ' || x.habitos || ' hábitos y la nutrición de hoy' end
               when x.habitos = 1 then 'Te queda un hábito de hoy'
               when x.habitos > 1 then 'Te quedan ' || x.habitos || ' hábitos de hoy'
               else '¿Apuntas lo que has comido hoy?' end,
          case when x.habitos > 0 then 'Apúntalo en Hoy antes de que acabe el día.' else 'Aún no has apuntado la nutrición de hoy.' end,
          '#hoy', 'recordatorio_tarde:' || v_hoy, p_ahora,
          (v_hoy + x.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
  v_n := v_n + v_m;
  return v_n;
end $$;

-- Permisos (como al final de 003 a 017)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (18)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
