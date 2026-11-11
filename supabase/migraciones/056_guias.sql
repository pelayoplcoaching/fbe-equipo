-- =====================================================================
-- FBE Equipo, migración 056: las guías del coach y la ficha de técnica de cada ejercicio («Aprende»)
--
-- Por qué: el coach tiene escritas sus guías por grupo muscular (anatomía, lo que importa y lo que no, y una ficha por
-- ejercicio: cómo ejecutarlo, errores típicos, variaciones por nivel, cuándo lo prescribe y con qué repeticiones). Hasta
-- ahora eso vivía en PDF. Con esta migración vive en la app: cada ejercicio de la biblioteca puede llevar su ficha (el
-- atleta la abre desde el ejercicio, en mitad de la sesión) y las guías se leen en «Aprende».
--
-- Qué hace:
--   * guias: una guía (clave, título, subtítulo, grupo muscular, orden y su contenido en bloques: la entrada, una cita,
--     las secciones y las ideas clave). Las escribe el coach; las publicadas las ven todos sus atletas.
--   * fichas_ejercicio: las fichas de una guía, en su orden (nombre y ficha: patrón, músculos, pasos, errores, niveles,
--     cuándo sí y cuándo no, y la tabla de repeticiones, RPE y descanso por objetivo).
--   * ejercicios_fichas: qué ficha lleva cada ejercicio de la biblioteca (una como mucho; varias variantes del mismo
--     ejercicio pueden llevar la misma). Lo decide el coach.
--
-- El contenido no va en esta migración: es del coach y se carga aparte, con su propio SQL.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 055 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
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
-- 1. Las guías
-- ---------------------------------------------------------------------
create table if not exists public.guias (
  id             uuid primary key default gen_random_uuid(),
  clave          text not null unique,            -- «pectoral», «core»… (para enlazarla y para no duplicarla al cargar)
  titulo         text not null,
  subtitulo      text,
  grupo          text,                            -- el grupo muscular de la app al que corresponde, si lo hay
  orden          smallint not null default 0,
  contenido      jsonb not null default '{}',     -- { entrada, cita, secciones: [{ titulo, subtitulo, bloques, fichas }], ideas: [{ titulo, x }] }
  publicada      boolean not null default true,
  creada_en      timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);
alter table public.guias drop constraint if exists guias_validas;
alter table public.guias add constraint guias_validas check (
  clave ~ '^[a-z0-9][a-z0-9-]{0,39}$'
  and char_length(titulo) between 1 and 80 and public.texto_visible(titulo)
  and (subtitulo is null or (char_length(subtitulo) between 1 and 160 and public.texto_visible(subtitulo)))
  and (grupo is null or grupo in ('pectoral', 'espalda', 'deltoides', 'cuadriceps', 'gluteo', 'isquiotibiales', 'biceps', 'triceps', 'abdominales', 'gemelo'))
  and orden between 0 and 999
  and jsonb_typeof(contenido) = 'object' and pg_column_size(contenido) <= 200000
);

create table if not exists public.fichas_ejercicio (
  id             uuid primary key default gen_random_uuid(),
  guia_id        uuid not null references public.guias (id) on delete cascade,
  orden          smallint not null default 0,
  nombre         text not null,
  ficha          jsonb not null default '{}',     -- { cabecera, descripcion, foto, patron, principales, secundarios, pasos[], errores[], niveles{}, si, no, tabla[] }
  actualizada_en timestamptz not null default now(),
  unique (guia_id, orden)
);
alter table public.fichas_ejercicio drop constraint if exists fichas_ejercicio_validas;
alter table public.fichas_ejercicio add constraint fichas_ejercicio_validas check (
  char_length(nombre) between 1 and 120 and public.texto_visible(nombre)
  and orden between 0 and 999
  and jsonb_typeof(ficha) = 'object' and pg_column_size(ficha) <= 40000
);
create index if not exists fichas_ejercicio_guia_idx on public.fichas_ejercicio (guia_id, orden);

create table if not exists public.ejercicios_fichas (
  ejercicio_id uuid primary key references public.ejercicios (id) on delete cascade,
  ficha_id     uuid not null references public.fichas_ejercicio (id) on delete cascade,
  creado_en    timestamptz not null default now()
);
create index if not exists ejercicios_fichas_ficha_idx on public.ejercicios_fichas (ficha_id);

-- La fecha del último cambio la pone la base
create or replace function public.guia_tocar() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizada_en := now();
  if tg_op = 'UPDATE' and tg_table_name = 'guias' then new.creada_en := old.creada_en; end if;
  return new;
end $$;
drop trigger if exists guias_tocar on public.guias;
create trigger guias_tocar before insert or update on public.guias
  for each row execute function public.guia_tocar();
drop trigger if exists fichas_ejercicio_tocar on public.fichas_ejercicio;
create trigger fichas_ejercicio_tocar before insert or update on public.fichas_ejercicio
  for each row execute function public.guia_tocar();

-- ---------------------------------------------------------------------
-- 2. Quién ve y escribe qué: el coach, todo; sus atletas, lo publicado (solo leer)
-- ---------------------------------------------------------------------
alter table public.guias enable row level security;
alter table public.fichas_ejercicio enable row level security;
alter table public.ejercicios_fichas enable row level security;

drop policy if exists coach_todo on public.guias;
create policy coach_todo on public.guias for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.guias;
create policy atleta_ver on public.guias for select to authenticated
  using (publicada and public.mi_atleta_id() is not null);

drop policy if exists coach_todo on public.fichas_ejercicio;
create policy coach_todo on public.fichas_ejercicio for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
-- (la subconsulta pasa por la política de guias: solo las fichas de guías que el atleta puede ver)
drop policy if exists atleta_ver on public.fichas_ejercicio;
create policy atleta_ver on public.fichas_ejercicio for select to authenticated
  using (public.mi_atleta_id() is not null and exists (select 1 from public.guias g where g.id = guia_id));

drop policy if exists coach_todo on public.ejercicios_fichas;
create policy coach_todo on public.ejercicios_fichas for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.ejercicios_fichas;
create policy atleta_ver on public.ejercicios_fichas for select to authenticated
  using (public.mi_atleta_id() is not null and exists (select 1 from public.fichas_ejercicio f where f.id = ficha_id));

-- Desde la 019, cada tabla nueva lleva sus permisos a mano
revoke all on public.guias, public.fichas_ejercicio, public.ejercicios_fichas from public, anon, authenticated;
grant select, insert, update, delete on public.guias, public.fichas_ejercicio, public.ejercicios_fichas to authenticated;
revoke execute on function public.guia_tocar() from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (56)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
