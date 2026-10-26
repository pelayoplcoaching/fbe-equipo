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
