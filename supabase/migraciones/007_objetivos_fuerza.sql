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
