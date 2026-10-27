-- =====================================================================
-- FBE Equipo, migración 023 (v0.27): días sin una comida («hoy sin merienda»)
-- Como los planes A (con merienda) y B (sin merienda) de Notion: algunos días el atleta se salta una comida
-- y las demás son algo más grandes.
-- 1. comidas_atleta.opcional: la comida que algunos días no hace (una de sus comidas; la elige el coach).
-- 2. recetas_atleta.variante: para qué días es cada receta de su recetario: 'con' (días con esa comida),
--    'sin' (días sin ella) o nada (todos). Solo la cambia el coach. La misma receta puede estar dos veces en
--    una comida, una para cada tipo de día (con su factor).
-- 3. menu_dias: los días de su menú en que no hace esa comida (una fila = ese día, sin ella). Lo marca él (o
--    tú) en su semana; como el menú, es un dato de salud y pide su consentimiento.
-- Se ejecuta en el SQL Editor después de la 022 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 23 then
    raise exception 'Esta base ya tiene la migración %: repetir la 023 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 23;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 22) then
    raise exception 'Antes de la 023 hace falta la 022: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. La comida opcional
-- ---------------------------------------------------------------------
alter table public.comidas_atleta add column if not exists opcional text;
alter table public.comidas_atleta drop constraint if exists comidas_atleta_opcional_valida;
alter table public.comidas_atleta add constraint comidas_atleta_opcional_valida check (
  opcional is null or (public.toma_valida(opcional) and opcional = any (tomas) and cardinality(tomas) >= 2)
);
-- El atleta elige sus comidas, pero cuál es la opcional lo decide el coach (si el atleta quita esa comida
-- de las suyas, deja de ser opcional)
create or replace function public.comidas_atleta_tocar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.atleta_id is distinct from old.atleta_id then
    raise exception 'No se puede pasar a otro atleta' using errcode = '42501';
  end if;
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    if tg_op = 'INSERT' then
      new.opcional := null;
    else
      new.opcional := old.opcional;
    end if;
  end if;
  if new.opcional is not null and not (new.opcional = any (new.tomas) and cardinality(new.tomas) >= 2) then
    new.opcional := null;
  end if;
  new.actualizado_en := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. Para qué días es cada receta
-- ---------------------------------------------------------------------
alter table public.recetas_atleta add column if not exists variante text;
alter table public.recetas_atleta drop constraint if exists recetas_atleta_variante_valida;
alter table public.recetas_atleta add constraint recetas_atleta_variante_valida check (variante is null or variante in ('con', 'sin'));
-- La misma receta puede ir dos veces en la misma comida si es para días distintos (p. ej. ×1 los días con
-- merienda y ×1,15 los días sin ella); para el mismo tipo de día, una sola vez
alter table public.recetas_atleta drop constraint if exists recetas_atleta_atleta_id_receta_id_toma_key;
create unique index if not exists recetas_atleta_unica on public.recetas_atleta (atleta_id, receta_id, toma, coalesce(variante, ''));

create or replace function public.receta_atleta_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    if (new.id, new.atleta_id, new.receta_id, new.toma, new.factor, new.orden, new.nota, new.variante, new.creada_en)
       is distinct from (old.id, old.atleta_id, old.receta_id, old.toma, old.factor, old.orden, old.nota, old.variante, old.creada_en) then
      raise exception 'Solo el coach puede cambiar tu recetario: pídele el cambio' using errcode = '42501';
    end if;
    if new.cambio_pedido_en is null then
      new.cambio_nota := null;
    elsif old.cambio_pedido_en is null or new.cambio_nota is distinct from old.cambio_nota then
      new.cambio_pedido_en := now();
    else
      new.cambio_pedido_en := old.cambio_pedido_en;
    end if;
  elsif new.cambio_pedido_en is null then
    new.cambio_nota := null;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. Los días sin esa comida
-- ---------------------------------------------------------------------
create table if not exists public.menu_dias (
  atleta_id  uuid not null references public.atletas(id) on delete cascade,
  fecha      date not null,
  creado_en  timestamptz not null default now(),
  primary key (atleta_id, fecha)
);
alter table public.menu_dias drop constraint if exists menu_dias_validos;
alter table public.menu_dias add constraint menu_dias_validos check (fecha >= date '2020-01-01' and fecha < date '2100-01-01');

create or replace function public.menu_dia_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.atleta_id is distinct from old.atleta_id then
    raise exception 'No se puede pasar a otro atleta' using errcode = '42501';
  end if;
  if current_user in ('authenticated', 'anon') and not public.consentimiento_salud_de_atleta(new.atleta_id) then
    raise exception 'Para organizar el menú hace falta el consentimiento de datos de salud del atleta' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists menu_dias_aa_preparar on public.menu_dias;
create trigger menu_dias_aa_preparar before insert or update on public.menu_dias
  for each row execute function public.menu_dia_preparar();
drop trigger if exists menu_dias_exigir_alta on public.menu_dias;
create trigger menu_dias_exigir_alta before insert or update on public.menu_dias
  for each row execute function public.exigir_alta();

alter table public.menu_dias enable row level security;
drop policy if exists coach_todo on public.menu_dias;
create policy coach_todo on public.menu_dias for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.menu_dias;
create policy atleta_ver on public.menu_dias for select to authenticated
  using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_crear on public.menu_dias;
create policy atleta_crear on public.menu_dias for insert to authenticated
  with check (atleta_id = public.mi_atleta_id() and public.tiene_consentimiento_salud());
drop policy if exists atleta_borrar on public.menu_dias;
create policy atleta_borrar on public.menu_dias for delete to authenticated
  using (atleta_id = public.mi_atleta_id());

-- Desde la 019, cada tabla nueva lleva sus permisos a mano
revoke all on public.menu_dias from public, anon, authenticated;
grant select, insert, delete on public.menu_dias to authenticated;

-- Permisos (como al final de 003 a 022)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (23)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
