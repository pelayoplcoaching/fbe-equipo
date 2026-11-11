-- =====================================================================
-- FBE Equipo, migración 056: la carrera, para quien quiere que le lleves también la parte de correr
--
-- Por qué: hay atletas que preparan una carrera (una media maratón, un trail) a la vez que entrenan fuerza, y su plan de
-- carrera vivía en un PDF aparte. Con esto va en la app, en la misma semana que la fuerza: sus zonas, sus carreras, el
-- macrociclo, cada semana con sus kilómetros, sesiones de carrera estructuradas (calentar, bloque, enfriar, con zona y
-- ritmo), el semáforo antes de entrenar y las revisiones cada dos semanas.
--
-- Qué hace:
--   * atletas.carrera: el coach la enciende al crear la ficha o cuando quiera (Datos). Sin ella, nada de esto se ve.
--   * carrera_atleta (una fila por atleta): el test (fecha y tipo), la FC umbral (LTHR), la FC máxima y en reposo, las
--     zonas si el coach las pone a mano (si no, salen de la LTHR), el ritmo umbral, el plan (nombre, lunes de inicio,
--     fases del macrociclo, sesiones por semana) y una nota (cómo se integra con la fuerza).
--   * carrera_eventos: sus carreras (A, B o C), con fecha, distancia, objetivo, si va o no (y por qué) y el resultado.
--   * carrera_semanas: cada semana del plan (por su lunes): etiqueta, kilómetros, semana A o B de fuerza, la clave y las
--     sesiones previstas (las que el coach pasa luego a la semana de entreno con un toque).
--   * carrera_revisiones: las revisiones del plan (fecha, qué se mira, el criterio verde, la decisión y cómo salió).
--   * carrera_recetas: la biblioteca de sesiones de calidad del coach (solo la ve el coach), con unas de partida.
--   * La pauta de cardio de una sesión (sesiones.cardio) admite ahora el tipo de sesión, rangos (35–45 min, 8–10 km),
--     la zona, el ritmo, las partes (calentar, bloque con repeticiones y recuperación, strides, enfriar) y si es opcional.
--   * Lo que apunta el atleta (sesiones.cardio_hecho) admite los segundos, el desnivel y, solo con su consentimiento de
--     datos de salud, cómo llegó (el semáforo: verde, ámbar o rojo), la FC media y máxima y el dolor (0 a 10): sin él, la
--     base los quita al guardar, los escriba quien los escriba (también el coach), como la preparación de la 005.
--   Todo lo de carrera lo escribe el coach; el atleta ve lo suyo (no la biblioteca de recetas). Va en «Descargar mis
--   datos» y se borra con la ficha.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 055 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada. (La del reloj, cuando entre, pasa a ser la 057.)
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 56 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 056 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 56;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 55) then  -- (2) la anterior
    raise exception 'Falta la migración 055 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. El interruptor en la ficha
-- ---------------------------------------------------------------------
alter table public.atletas add column if not exists carrera boolean not null default false;

-- ---------------------------------------------------------------------
-- 2. Comprobaciones de forma (las mismas que hace la app en logica/cardio.js)
-- ---------------------------------------------------------------------
-- Un número entero entre lo y hi (o que no esté)
create or replace function public.json_entero_entre(v jsonb, lo numeric, hi numeric) returns boolean
language sql immutable set search_path = '' as $$
  select v is null or (jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric = floor((v #>> '{}')::numeric) and (v #>> '{}')::numeric between lo and hi)
$$;
-- Un número (con decimales) mayor que lo y hasta hi (o que no esté)
create or replace function public.json_numero_entre(v jsonb, lo numeric, hi numeric) returns boolean
language sql immutable set search_path = '' as $$
  select v is null or (jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric > lo and (v #>> '{}')::numeric <= hi)
$$;
-- Un texto de 1 a n caracteres (o que no esté)
create or replace function public.json_texto_hasta(v jsonb, n integer) returns boolean
language sql immutable set search_path = '' as $$
  select v is null or (jsonb_typeof(v) = 'string' and length(v #>> '{}') between 1 and n)
$$;
-- Un ritmo: uno o dos valores en segundos por km (de 2:00 a 15:00 min/km)
create or replace function public.carrera_ritmo_valido(v jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select v is null or (jsonb_typeof(v) = 'array' and jsonb_array_length(v) between 1 and 2
    and not exists (select 1 from jsonb_array_elements(v) e where not public.json_entero_entre(e, 120, 900)))
$$;

-- Una parte de una sesión de carrera: { "fase": "bloque", "reps": 2, "seg": 360, "zona": 4, "ritmo": [310, 320],
-- "rec_seg": 120, "rec": "trote suave" }. fase obligatoria; duración (seg) o distancia (m) por repetición, o una nota.
create or replace function public.carrera_parte_valida(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
    and not exists (select 1 from jsonb_object_keys(p) k where k not in ('fase', 'reps', 'seg', 'm', 'zona', 'zona_hasta', 'ritmo', 'rec_seg', 'rec', 'nota'))
    and coalesce(p ->> 'fase', '') in ('calentar', 'bloque', 'strides', 'enfriar', 'libre')
    and (p ? 'seg' or p ? 'm' or p ? 'nota')
    and public.json_entero_entre(p -> 'reps', 1, 50)
    and public.json_entero_entre(p -> 'seg', 5, 21600)
    and public.json_entero_entre(p -> 'm', 10, 100000)
    and public.json_entero_entre(p -> 'zona', 1, 5)
    and public.json_entero_entre(p -> 'zona_hasta', 1, 5)
    and (not (p ? 'zona_hasta') or (p ? 'zona' and (p ->> 'zona_hasta')::int >= (p ->> 'zona')::int))
    and public.carrera_ritmo_valido(p -> 'ritmo')
    and public.json_entero_entre(p -> 'rec_seg', 0, 1800)
    and public.json_texto_hasta(p -> 'rec', 40)
    and public.json_texto_hasta(p -> 'nota', 200)
$$;

-- La pauta de cardio (013, ampliada): modalidad y minutos o km (o partes); lo de carrera, opcional.
--   { "modalidad": "carrera", "tipo": "calidad", "minutos": 50, "minutos_max": 60, "zona": 4, "partes": [...], "opcional": false }
-- exige_volumen = false para una sesión prevista en el plan (carrera_semanas), que puede ir solo con su título.
create or replace function public.cardio_pauta_valida(j jsonb, exige_volumen boolean) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object'
    and length(j::text) <= 6000
    and not exists (select 1 from jsonb_object_keys(j) k where k not in ('modalidad', 'minutos', 'km', 'esfuerzo', 'nota',
                    'tipo', 'minutos_max', 'km_max', 'zona', 'zona_hasta', 'ritmo', 'partes', 'opcional'))
    and coalesce(j ->> 'modalidad', '') in ('carrera', 'andar', 'bici', 'eliptica', 'remo', 'nadar', 'cuerda', 'otro')
    and (not exige_volumen or j ? 'minutos' or j ? 'km' or j ? 'partes')
    and public.json_entero_entre(j -> 'minutos', 1, 600)
    and public.json_numero_entre(j -> 'km', 0, 200)
    and (not (j ? 'esfuerzo') or (jsonb_typeof(j -> 'esfuerzo') = 'number' and (j ->> 'esfuerzo')::numeric between 1 and 10))
    and public.json_texto_hasta(j -> 'nota', 300)
    and (not (j ? 'tipo') or coalesce(j ->> 'tipo', '') in ('facil', 'calidad', 'larga', 'carrera', 'recuperacion', 'cross', 'test', 'tecnica'))
    and public.json_entero_entre(j -> 'minutos_max', 1, 600)
    and (not (j ? 'minutos_max') or (j ? 'minutos' and (j ->> 'minutos_max')::numeric > (j ->> 'minutos')::numeric))
    and public.json_numero_entre(j -> 'km_max', 0, 200)
    and (not (j ? 'km_max') or (j ? 'km' and (j ->> 'km_max')::numeric > (j ->> 'km')::numeric))
    and public.json_entero_entre(j -> 'zona', 1, 5)
    and public.json_entero_entre(j -> 'zona_hasta', 1, 5)
    and (not (j ? 'zona_hasta') or (j ? 'zona' and (j ->> 'zona_hasta')::int >= (j ->> 'zona')::int))
    and public.carrera_ritmo_valido(j -> 'ritmo')
    and (not (j ? 'partes') or (jsonb_typeof(j -> 'partes') = 'array' and jsonb_array_length(j -> 'partes') between 1 and 12
         and not exists (select 1 from jsonb_array_elements(j -> 'partes') p where not public.carrera_parte_valida(p))))
    and (not (j ? 'opcional') or jsonb_typeof(j -> 'opcional') = 'boolean')
$$;

create or replace function public.cardio_valido(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select public.cardio_pauta_valida(j, true)
$$;

-- Lo hecho (013, ampliado): { "modalidad": "carrera", "minutos": 58, "seg": 12, "km": 10.2, "desnivel": 80,
-- "semaforo": "verde", "fc_media": 158, "fc_max": 176, "dolor": 0 }. Modalidad y minutos obligatorios.
create or replace function public.cardio_hecho_valido(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object'
    and not exists (select 1 from jsonb_object_keys(j) k where k not in ('modalidad', 'minutos', 'km', 'seg', 'desnivel', 'semaforo', 'fc_media', 'fc_max', 'dolor'))
    and coalesce(j ->> 'modalidad', '') in ('carrera', 'andar', 'bici', 'eliptica', 'remo', 'nadar', 'cuerda', 'otro')
    and coalesce(jsonb_typeof(j -> 'minutos'), '') = 'number' and public.json_entero_entre(j -> 'minutos', 1, 600)
    and public.json_numero_entre(j -> 'km', 0, 200)
    and public.json_entero_entre(j -> 'seg', 0, 59)
    and public.json_entero_entre(j -> 'desnivel', 0, 10000)
    and (not (j ? 'semaforo') or coalesce(j ->> 'semaforo', '') in ('verde', 'ambar', 'rojo'))
    and public.json_entero_entre(j -> 'fc_media', 40, 230)
    and public.json_entero_entre(j -> 'fc_max', 40, 240)
    and (not (j ? 'fc_media' and j ? 'fc_max') or (j ->> 'fc_max')::int >= (j ->> 'fc_media')::int)
    and public.json_entero_entre(j -> 'dolor', 0, 10)
$$;

-- Una sesión prevista en el plan: { "tipo": "calidad", "titulo": "Umbral 2 × 6 min", "dia": 3, ...lo de la pauta }.
-- Las de descanso, solo con su título, día y nota.
create or replace function public.carrera_sesion_plan_valida(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object'
    and coalesce(j ->> 'tipo', '') in ('facil', 'calidad', 'larga', 'carrera', 'recuperacion', 'cross', 'test', 'tecnica', 'descanso')
    and public.json_texto_hasta(j -> 'titulo', 60)
    and public.json_entero_entre(j -> 'dia', 1, 7)
    and case when j ->> 'tipo' = 'descanso'
      then not exists (select 1 from jsonb_object_keys(j) k where k not in ('tipo', 'titulo', 'dia', 'nota')) and public.json_texto_hasta(j -> 'nota', 300)
      else public.cardio_pauta_valida((j - 'titulo' - 'dia') || jsonb_build_object('modalidad', coalesce(j ->> 'modalidad', 'carrera')), false)
           and (j ? 'titulo' or j ? 'minutos' or j ? 'km' or j ? 'partes')
    end
$$;

-- Las fases del macrociclo: [{ "nombre": "Base", "semanas": 5, "nota": "..." }], de 1 a 12, y 60 semanas como mucho
create or replace function public.carrera_fases_validas(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'array' and jsonb_array_length(j) between 1 and 12
    and not exists (select 1 from jsonb_array_elements(j) f where jsonb_typeof(f) <> 'object'
      or exists (select 1 from jsonb_object_keys(f) k where k not in ('nombre', 'semanas', 'nota'))
      or not (f ? 'nombre' and f ? 'semanas') or not public.json_texto_hasta(f -> 'nombre', 30)
      or not public.json_entero_entre(f -> 'semanas', 1, 30) or not public.json_texto_hasta(f -> 'nota', 200))
    and (select sum((f ->> 'semanas')::int) from jsonb_array_elements(j) f) <= 60
$$;

alter table public.sesiones drop constraint if exists sesiones_cardio_valido;
alter table public.sesiones add constraint sesiones_cardio_valido check (cardio is null or public.cardio_valido(cardio) is true);
alter table public.sesiones drop constraint if exists sesiones_cardio_hecho_valido;
alter table public.sesiones add constraint sesiones_cardio_hecho_valido check (cardio_hecho is null or public.cardio_hecho_valido(cardio_hecho) is true);

-- La FC, el dolor y cómo llegó (el semáforo) son datos de salud: sin el consentimiento del atleta de esa semana, la base
-- no los guarda (los quita), los escriba quien los escriba, también el coach (como la preparación, 005)
create or replace function public.sesion_carrera_salud() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.cardio_hecho is not null and jsonb_typeof(new.cardio_hecho) = 'object'
     and current_user in ('authenticated', 'anon')
     and new.cardio_hecho ?| array['fc_media', 'fc_max', 'dolor', 'semaforo'] and not public.consentimiento_salud_de_semana(new.semana_id) then
    new.cardio_hecho := new.cardio_hecho - 'fc_media' - 'fc_max' - 'dolor' - 'semaforo';
  end if;
  return new;
end $$;
drop trigger if exists sesiones_carrera_salud on public.sesiones;
create trigger sesiones_carrera_salud before insert or update of cardio_hecho on public.sesiones
  for each row execute function public.sesion_carrera_salud();

-- ---------------------------------------------------------------------
-- 3. Lo de carrera de cada atleta
-- ---------------------------------------------------------------------
create table if not exists public.carrera_atleta (
  atleta_id      uuid primary key references public.atletas(id) on delete cascade,
  lthr           smallint check (lthr between 100 and 230),          -- FC umbral (lactato), ppm
  fc_max         smallint check (fc_max between 100 and 240),
  fc_reposo      smallint check (fc_reposo between 30 and 120),
  test_fecha     date,
  test_tipo      text check (test_tipo in ('friel30', 'campo', 'laboratorio', 'estimado')),
  zonas          smallint[] check (zonas is null or (cardinality(zonas) = 4 and zonas[1] < zonas[2] and zonas[2] < zonas[3] and zonas[3] < zonas[4]
                                                     and zonas[1] >= 60 and zonas[4] <= 240)),  -- dónde empiezan Z2, Z3, Z4 y Z5
  umbral         smallint[] check (umbral is null or (cardinality(umbral) between 1 and 2 and 120 <= all (umbral) and 900 >= all (umbral))),  -- s/km
  plan_nombre    text check (length(plan_nombre) between 1 and 80),
  plan_inicio    date check (plan_inicio is null or extract(isodow from plan_inicio) = 1),
  fases          jsonb check (fases is null or public.carrera_fases_validas(fases)),
  ventanas       smallint check (ventanas between 1 and 7),           -- sesiones de carrera por semana
  nota           text check (length(nota) between 1 and 2000),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.carrera_eventos (
  id              uuid primary key default gen_random_uuid(),
  atleta_id       uuid not null references public.atletas(id) on delete cascade,
  nombre          text not null check (length(nombre) between 1 and 80),
  fecha           date not null,
  distancia_km    numeric(6,2) check (distancia_km > 0 and distancia_km <= 400),
  desnivel_m      integer check (desnivel_m between 0 and 20000),
  prioridad       text not null default 'B' check (prioridad in ('A', 'B', 'C')),
  decision        text not null default 'va' check (decision in ('va', 'entreno', 'no', 'pendiente')),
  objetivo_seg    integer check (objetivo_seg between 60 and 172800),   -- tiempo objetivo
  objetivo_ritmo  smallint check (objetivo_ritmo between 120 and 900),  -- s/km
  nota            text check (length(nota) between 1 and 500),
  resultado_seg   integer check (resultado_seg between 60 and 172800),
  resultado_nota  text check (length(resultado_nota) between 1 and 500),
  creado_en       timestamptz not null default now()
);
create index if not exists carrera_eventos_atleta on public.carrera_eventos (atleta_id, fecha);

create table if not exists public.carrera_semanas (
  atleta_id  uuid not null references public.atletas(id) on delete cascade,
  lunes      date not null check (extract(isodow from lunes) = 1),
  etiqueta   text check (length(etiqueta) between 1 and 24),
  km_min     numeric(5,1) check (km_min >= 0 and km_min <= 400),
  km_max     numeric(5,1) check (km_max > 0 and km_max <= 400),
  ab         text check (ab in ('A', 'B')),
  clave      text check (length(clave) between 1 and 300),
  nota       text check (length(nota) between 1 and 500),
  sesiones   jsonb not null default '[]'::jsonb,
  actualizado_en timestamptz not null default now(),
  primary key (atleta_id, lunes),
  check (km_min is null or km_max is null or km_max >= km_min),
  check (jsonb_typeof(sesiones) = 'array' and jsonb_array_length(sesiones) <= 7 and length(sesiones::text) <= 20000)
);
create or replace function public.carrera_sesiones_plan_validas(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select not exists (select 1 from jsonb_array_elements(j) s where not public.carrera_sesion_plan_valida(s))
$$;
alter table public.carrera_semanas drop constraint if exists carrera_semanas_sesiones_validas;
alter table public.carrera_semanas add constraint carrera_semanas_sesiones_validas check (public.carrera_sesiones_plan_validas(sesiones));

create table if not exists public.carrera_revisiones (
  id         uuid primary key default gen_random_uuid(),
  atleta_id  uuid not null references public.atletas(id) on delete cascade,
  fecha      date not null,
  titulo     text not null check (length(titulo) between 1 and 80),
  criterio   text check (length(criterio) between 1 and 300),
  decision   text check (length(decision) between 1 and 500),
  estado     text not null default 'pendiente' check (estado in ('pendiente', 'verde', 'ambar', 'rojo')),
  creado_en  timestamptz not null default now()
);
create index if not exists carrera_revisiones_atleta on public.carrera_revisiones (atleta_id, fecha);

create table if not exists public.carrera_recetas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique check (length(nombre) between 1 and 80),
  pauta      jsonb not null check (public.cardio_pauta_valida(pauta, true) and pauta ? 'partes'),
  orden      integer not null default 0,
  creado_en  timestamptz not null default now()
);

-- Lo que cambia el coach se fecha solo
create or replace function public.carrera_fechar() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists carrera_atleta_fechar on public.carrera_atleta;
create trigger carrera_atleta_fechar before update on public.carrera_atleta for each row execute function public.carrera_fechar();
drop trigger if exists carrera_semanas_fechar on public.carrera_semanas;
create trigger carrera_semanas_fechar before update on public.carrera_semanas for each row execute function public.carrera_fechar();

-- ---------------------------------------------------------------------
-- 4. Quién ve y quién cambia: el coach, todo; el atleta, ve lo suyo (no la biblioteca de recetas)
-- ---------------------------------------------------------------------
alter table public.carrera_atleta enable row level security;
alter table public.carrera_eventos enable row level security;
alter table public.carrera_semanas enable row level security;
alter table public.carrera_revisiones enable row level security;
alter table public.carrera_recetas enable row level security;
do $$
declare t text;
begin
  foreach t in array array['carrera_atleta', 'carrera_eventos', 'carrera_semanas', 'carrera_revisiones', 'carrera_recetas'] loop
    execute format('drop policy if exists coach_todo on public.%I', t);
    execute format('create policy coach_todo on public.%I for all to authenticated using (public.es_coach()) with check (public.es_coach())', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
  foreach t in array array['carrera_atleta', 'carrera_eventos', 'carrera_semanas', 'carrera_revisiones'] loop
    execute format('drop policy if exists atleta_ver on public.%I', t);
    execute format('create policy atleta_ver on public.%I for select to authenticated using (atleta_id = public.mi_atleta_id())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. Unas sesiones de calidad de partida en la biblioteca del coach (si ya hay una con ese nombre, no se toca)
-- ---------------------------------------------------------------------
insert into public.carrera_recetas (nombre, orden, pauta) values
  ('Rodaje fácil con strides', 1, '{"modalidad":"carrera","tipo":"facil","minutos":40,"zona":2,"partes":[{"fase":"bloque","seg":2100,"zona":2,"nota":"Cómodo: puedes hablar con frases largas"},{"fase":"strides","reps":6,"seg":20,"rec_seg":60,"rec":"andando","nota":"Rápidos y sueltos, sin apretar"}]}'),
  ('Cuestas cortas 6 × 15 s', 2, '{"modalidad":"carrera","tipo":"calidad","minutos":40,"partes":[{"fase":"calentar","seg":900,"zona":1,"zona_hasta":2},{"fase":"bloque","reps":6,"seg":15,"zona":5,"rec_seg":90,"rec":"bajando andando","nota":"Cuesta del 6 al 8 %: fuerte y con buena técnica"},{"fase":"enfriar","seg":600,"zona":1}]}'),
  ('Umbral 2 × 6 min', 3, '{"modalidad":"carrera","tipo":"calidad","minutos":45,"zona":4,"partes":[{"fase":"calentar","seg":900,"zona":1,"zona_hasta":2},{"fase":"strides","reps":4,"seg":20,"rec_seg":60,"rec":"andando"},{"fase":"bloque","reps":2,"seg":360,"zona":4,"rec_seg":120,"rec":"trote suave"},{"fase":"enfriar","seg":600,"zona":1}]}'),
  ('Umbral 3 × 6 min', 4, '{"modalidad":"carrera","tipo":"calidad","minutos":50,"zona":4,"partes":[{"fase":"calentar","seg":900,"zona":1,"zona_hasta":2},{"fase":"bloque","reps":3,"seg":360,"zona":4,"rec_seg":120,"rec":"trote suave"},{"fase":"enfriar","seg":600,"zona":1}]}'),
  ('Umbral 2 × 12 min', 5, '{"modalidad":"carrera","tipo":"calidad","minutos":55,"zona":4,"partes":[{"fase":"calentar","seg":900,"zona":1,"zona_hasta":2},{"fase":"bloque","reps":2,"seg":720,"zona":4,"rec_seg":180,"rec":"trote suave"},{"fase":"enfriar","seg":600,"zona":1}]}'),
  ('Fartlek 6 × 2 min', 6, '{"modalidad":"carrera","tipo":"calidad","minutos":45,"zona":3,"zona_hasta":4,"partes":[{"fase":"calentar","seg":900,"zona":1,"zona_hasta":2},{"fase":"bloque","reps":6,"seg":120,"zona":3,"zona_hasta":4,"rec_seg":120,"rec":"trote en Z1"},{"fase":"enfriar","seg":600,"zona":1}]}'),
  ('Tirada larga con final a ritmo', 7, '{"modalidad":"carrera","tipo":"larga","minutos":75,"minutos_max":90,"zona":2,"partes":[{"fase":"bloque","seg":3900,"zona":2,"nota":"Suave y constante"},{"fase":"bloque","seg":600,"zona":3,"nota":"Los últimos 10 min, a ritmo de carrera"}]}'),
  ('2 × 2 km a ritmo objetivo', 8, '{"modalidad":"carrera","tipo":"calidad","minutos":45,"zona":3,"partes":[{"fase":"calentar","seg":900,"zona":1,"zona_hasta":2},{"fase":"bloque","reps":2,"m":2000,"zona":3,"rec_seg":180,"rec":"trote suave","nota":"A tu ritmo de carrera objetivo"},{"fase":"enfriar","seg":600,"zona":1}]}'),
  ('2 × 3 km a ritmo objetivo', 9, '{"modalidad":"carrera","tipo":"calidad","minutos":55,"zona":3,"partes":[{"fase":"calentar","seg":900,"zona":1,"zona_hasta":2},{"fase":"bloque","reps":2,"m":3000,"zona":3,"rec_seg":180,"rec":"trote suave","nota":"A tu ritmo de carrera objetivo"},{"fase":"enfriar","seg":600,"zona":1}]}'),
  ('Test de umbral de 30 min', 10, '{"modalidad":"carrera","tipo":"test","minutos":55,"partes":[{"fase":"calentar","seg":900,"zona":1,"zona_hasta":2},{"fase":"bloque","seg":1800,"nota":"Solo, en llano y lo más fuerte que puedas mantener 30 min. Pulsa vuelta a los 10 min: la FC media de los últimos 20 es tu umbral"},{"fase":"enfriar","seg":600,"zona":1}]}')
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------
-- 6. Permisos (como al final de 003 a 055)
-- ---------------------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb), public.salud_recibir(text, jsonb), public.calendario_de(text) from public, anon, authenticated;
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

insert into public.fbe_migraciones (numero) values (56)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
