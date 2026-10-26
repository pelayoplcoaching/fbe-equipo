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
