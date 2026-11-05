-- =====================================================================
-- FBE Equipo, migración 040 (v0.67): la «Revisión semanal» del coach
--   · Una fila por atleta y semana (la del lunes): si el coach ha dado por terminada su revisión de esa semana y una nota
--     corta suya (como mucho 500 caracteres) que le sale la semana siguiente. Se queda el historial (una fila por semana);
--     cada lunes empieza una semana nueva sin nada marcado.
--   · Solo el coach la lee y la escribe (los atletas no ven ni que existe). Al borrar un atleta, se van con él.
--   · revision_semanal_valida(lunes, nota): el lunes tiene que ser lunes y la nota, de 500 caracteres como mucho; algo mal
--     formado da false, nunca un error.
--   · Nada más: lo demás de la pestaña (sesiones de la semana, check-in, vídeos sin revisar, mensajes sin leer, molestias)
--     sale de lo que ya hay.
-- Se ejecuta en el SQL Editor después de la 039 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 40 then
    raise exception 'Esta base ya tiene la migración %: repetir la 040 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 40;» y, después de ella, todas las siguientes en orden, todo en la misma consulta del SQL Editor (una sola transacción).';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 39) then
    raise exception 'Antes de la 040 hace falta la 039: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

create table if not exists public.revisiones_semanales (
  atleta_id       uuid not null references public.atletas(id) on delete cascade,
  lunes           date not null,
  hecha           boolean not null default false,
  nota            text,
  actualizado_en  timestamptz not null default now(),
  primary key (atleta_id, lunes)
);

-- El lunes, un lunes; la nota, de 500 caracteres como mucho (vacía cuenta como sin nota). Nunca un error.
create or replace function public.revision_semanal_valida(p_lunes date, p_nota text) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if p_lunes is null then return false; end if;
  if extract(isodow from p_lunes) <> 1 then return false; end if;
  if p_nota is not null and char_length(p_nota) > 500 then return false; end if;
  return true;
exception when others then
  return false;
end $$;
alter table public.revisiones_semanales drop constraint if exists revisiones_semanales_validas;
alter table public.revisiones_semanales add constraint revisiones_semanales_validas check (public.revision_semanal_valida(lunes, nota));

-- La hora del último cambio la pone la base
create or replace function public.revision_semanal_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  if new.nota is not null and btrim(new.nota) = '' then new.nota := null; end if;
  return new;
end $$;
drop trigger if exists revision_semanal_preparar on public.revisiones_semanales;
create trigger revision_semanal_preparar before insert or update on public.revisiones_semanales
  for each row execute function public.revision_semanal_preparar();

create index if not exists revisiones_semanales_lunes on public.revisiones_semanales (lunes);

alter table public.revisiones_semanales enable row level security;
drop policy if exists coach_todo on public.revisiones_semanales;
create policy coach_todo on public.revisiones_semanales for all to authenticated using (public.es_coach()) with check (public.es_coach());
revoke all on public.revisiones_semanales from public, anon, authenticated;
grant select, insert, update, delete on public.revisiones_semanales to authenticated;

-- Permisos (como al final de 003 a 039)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (40)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
