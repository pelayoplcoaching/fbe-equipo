-- =====================================================================
-- FBE Equipo, migración 047: fotos de perfil ligeras
--
-- Por qué: la foto de perfil (384 px, unos 60 KB en texto) va dentro de la fila del perfil y viajaba entera en cada
-- lista: la de atletas del coach, Revisar, las conversaciones, el muro del equipo. Con 29 fotos, 1,6 MB cada vez.
--
-- Qué hace: una columna más, `foto_grande`. Desde ahora `foto` guarda una miniatura (128 px, unos 6 KB), que es lo
-- que ya piden todas las listas y todas las funciones (no hay que tocarlas), y `foto_grande` guarda la de siempre,
-- que solo se pide al ampliarla, con la función foto_grande_de(): la ve quien ya veía la foto de esa persona (uno
-- mismo, el coach, la del coach cualquier atleta, y entre quienes están dentro de la comunidad).
--
-- Las fotos que ya hay no se tocan aquí (la base no sabe reducir imágenes): las aligera la app del coach la primera
-- vez que se abre tras esta migración (y la de cada persona con la suya), pasando la actual a `foto_grande` y
-- dejando la miniatura en `foto`. Sin esta migración, la app sigue funcionando como hasta ahora.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 046 (o con instalar.sql en una
-- base nueva). Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 47 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 047 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 47;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 46) then  -- (2) la migración previa
    raise exception 'Antes de la 047 hace falta la 046: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. La foto grande, aparte (mismas condiciones que la foto: base64 de JPEG o WebP y un tamaño máximo)
-- ---------------------------------------------------------------------
alter table public.perfiles add column if not exists foto_grande text;
alter table public.perfiles drop constraint if exists perfiles_foto_grande_valida;
alter table public.perfiles add constraint perfiles_foto_grande_valida check (
  foto_grande is null or (
    char_length(foto_grande) <= 80000
    and foto_grande ~ '^data:image/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$'
  )
) not valid;
comment on column public.perfiles.foto is
  'Foto de perfil para listas: desde la 047, una miniatura (128 px). La de ampliar está en foto_grande.';
comment on column public.perfiles.foto_grande is
  'Foto de perfil para verla en grande (384 px). Sin valor en un perfil con foto: aún no se ha aligerado (foto lleva la grande).';

-- ---------------------------------------------------------------------
-- 2. La foto grande de una persona, para quien ya puede ver su foto (sin p_perfil: la del coach)
-- ---------------------------------------------------------------------
create or replace function public.foto_grande_de(p_perfil uuid default null) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(p.foto_grande, p.foto)
  from public.perfiles p
  where auth.uid() is not null
    and p.foto is not null
    and p.id = coalesce(p_perfil, (select c.id from public.perfiles c where c.rol = 'coach' order by c.creado_en limit 1))
    and (
      p.id = auth.uid()
      or public.es_coach()
      or p.rol = 'coach'
      or (public.comunidad_soy_miembro() and exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = p.id))
    )
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- 3. (revisión) La foto grande, siempre al día con la foto: si se quita la foto, o se cambia sin mandar la grande
--    (una app sin actualizar), la grande se va con ella; así nunca se amplía una foto que la persona ya quitó o cambió
-- ---------------------------------------------------------------------
create or replace function public.perfil_foto_grande_al_dia() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.foto is null then
    new.foto_grande := null;
  elsif new.foto is distinct from old.foto and new.foto_grande is not distinct from old.foto_grande then
    new.foto_grande := null;
  end if;
  return new;
end $$;
drop trigger if exists perfiles_foto_grande_al_dia on public.perfiles;
create trigger perfiles_foto_grande_al_dia before update of foto, foto_grande on public.perfiles
  for each row execute function public.perfil_foto_grande_al_dia();

-- ---------------------------------------------------------------------
-- 4. (revisión) Aligerar una foto solo si sigue siendo la que leyó la app (y no se había aligerado ya): si la persona
--    la quitó o la cambió mientras tanto, no se toca. Con los permisos de quien llama (RLS de perfiles)
-- ---------------------------------------------------------------------
create or replace function public.aligerar_foto(p_perfil uuid, p_mini text, p_grande text) returns boolean
language sql security invoker set search_path = '' as $$
  with u as (update public.perfiles p set foto = p_mini, foto_grande = p_grande
             where p.id = p_perfil and p.foto_grande is null and p.foto = p_grande returning 1)
  select exists (select 1 from u);
$$;

-- Permisos (como al final de 003 a 045)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (47)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
