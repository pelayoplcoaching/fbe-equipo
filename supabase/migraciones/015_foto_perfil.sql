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
