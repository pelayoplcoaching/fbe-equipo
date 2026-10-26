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
