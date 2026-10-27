-- =====================================================================
-- FBE Equipo, migración 019 (v0.23): tablas nuevas cerradas por defecto
-- El proyecto se creó con «Automatically expose new tables» activado: cada tabla nueva del esquema public
-- nacía con select, insert, update y delete para anon (sin sesión) y authenticated. Hoy no es un agujero
-- (todas las tablas tienen permisos por fila y anon no tiene nada), pero una tabla futura nacería abierta si
-- alguna vez se olvida su permiso. Desde esta migración:
-- 1. Las tablas, secuencias y funciones nuevas nacen sin permisos para anon ni authenticated (las del
--    servidor, service_role, siguen igual). Cada migración da los suyos a mano, tabla a tabla.
-- 2. Las vistas solo se leen (nadie escribe en ellas desde la app).
-- No cambia nada de lo que ya funciona: los permisos de las tablas que ya existen se quedan como están.
-- (Lo explica Supabase en https://supabase.com/changelog/45329)
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 018 (o con instalar.sql en una
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
  if v > 19 then
    raise exception 'Esta base ya tiene la migración %: repetir la 019 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 19;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 18) then
    raise exception 'Antes de la 019 hace falta la 018: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Lo que se cree a partir de ahora (lo crea el rol postgres, el del SQL Editor), sin permisos de entrada
-- ---------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
-- (Postgres deja ejecutar cualquier función nueva a todo el mundo, PUBLIC; eso solo se quita sin «in schema».
-- Las migraciones ya dan permiso a mano a las cuentas de la app al final de cada una.)
alter default privileges for role postgres revoke execute on functions from public;

-- ---------------------------------------------------------------------
-- 2. Las vistas, solo lectura (respetan los permisos por fila de sus tablas: security_invoker)
-- ---------------------------------------------------------------------
do $$
declare v record;
begin
  for v in select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'v' loop
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from public, anon, authenticated', v.relname);
  end loop;
end $$;

-- Permisos (como al final de 003 a 018)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (19)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
