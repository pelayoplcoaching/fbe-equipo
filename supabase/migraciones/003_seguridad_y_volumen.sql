-- =====================================================================
-- FBE Atletas, migración 003 (v0.3)
-- 1. Endurece permisos tras la revisión de seguridad:
--    - el coach con verificación en dos pasos no puede quedarse sin ella con solo la contraseña
--    - consentimientos que no se pueden falsear ni reactivar
--    - «Baja» corta la escritura (el atleta sigue pudiendo ver y descargar lo suyo)
--    - los comentarios del coach no desaparecen si el atleta borra un check-in o un vídeo
--    - Storage solo acepta archivos registrados (con su consentimiento, su ruta segura y su límite diario)
--    - las funciones auxiliares no revelan de quién es una sesión ajena
--    - la biblioteca solo la ven cuentas vinculadas a un atleta
-- 2. Rango de volumen semanal por músculo, ajustable por atleta.
--
-- Se ejecuta en el SQL Editor después de schema.sql y 002. Se puede repetir sin romper nada.
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
  if v > 3 then
    raise exception 'Esta base ya tiene la migración %: repetir la 003 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 3;» y, después de ella, todas las siguientes en orden.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1.1 Coach con verificación en dos pasos: si falla la comprobación, se cierra
-- ---------------------------------------------------------------------
-- exige_2fa se activa al verificar el primer dispositivo. Con él activo, el coach necesita
-- siempre el segundo paso (aal2), aunque la base no pudiera leer sus factores o alguien los
-- quitara con la contraseña robada. Solo se desactiva desde una sesión con el segundo paso.
alter table public.perfiles add column if not exists exige_2fa boolean not null default false;

create or replace function public.es_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.rol = 'coach'
      and (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
           or (not p.exige_2fa
               and not exists (select 1 from auth.mfa_factors f
                               where f.user_id = auth.uid() and f.status = 'verified'))));
$$;

create or replace function public.proteger_perfil() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if not public.es_coach() and (new.id, new.rol) is distinct from (old.id, old.rol) then
      raise exception 'No puedes cambiar tu rol' using errcode = '42501';
    end if;
    if old.exige_2fa and not new.exige_2fa and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
      raise exception 'Para desactivar la verificación en dos pasos tienes que haber entrado con ella' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 1.2 Consentimientos: los da cada persona, con la fecha real y el texto vigente;
--     revocar es definitivo (para volver a darlo se crea uno nuevo)
-- ---------------------------------------------------------------------
-- Cambia esta versión (y VERSION_CONSENTIMIENTO en web/src/datos/api.js) cuando cambie el texto.
create or replace function public.version_consentimiento() returns text
language sql immutable as $$ select '2026-10'::text $$;

create or replace function public.consentimiento_nuevo() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.perfil_id is distinct from auth.uid() then
      raise exception 'Cada persona da su propio consentimiento' using errcode = '42501';
    end if;
    if new.version is distinct from public.version_consentimiento() then
      raise exception 'El texto que aceptas no es el vigente: recarga la app y vuelve a intentarlo' using errcode = '22023';
    end if;
    new.aceptado_en := now();
    new.revocado_en := null;
  end if;
  return new;
end $$;
drop trigger if exists consentimientos_nuevo on public.consentimientos;
create trigger consentimientos_nuevo before insert on public.consentimientos
  for each row execute function public.consentimiento_nuevo();

create or replace function public.proteger_consentimiento() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if (new.perfil_id, new.tipo, new.version, new.aceptado_en)
       is distinct from (old.perfil_id, old.tipo, old.version, old.aceptado_en) then
      raise exception 'Un consentimiento solo se puede revocar, no modificar' using errcode = '42501';
    end if;
    if old.revocado_en is not null and new.revocado_en is distinct from old.revocado_en then
      raise exception 'Un consentimiento revocado no se puede reactivar: hay que darlo de nuevo' using errcode = '42501';
    end if;
    if old.revocado_en is null and new.revocado_en is not null then
      new.revocado_en := now();
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 1.3 Atleta de baja: lee y descarga lo suyo, pero no añade ni cambia nada
-- ---------------------------------------------------------------------
create or replace function public.esta_de_baja() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.atletas where perfil_id = auth.uid() and estado = 'baja');
$$;

create or replace function public.exigir_alta() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() and public.esta_de_baja() then
    raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  -- inserciones y cambios
  foreach t in array array['series','pesos','checkins','molestias','medidas','marcas'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_exigir_alta', t);
    execute format('create trigger %I before insert or update on public.%I
                    for each row execute function public.exigir_alta()', t || '_exigir_alta', t);
  end loop;
  -- solo cambios (el atleta no crea sesiones)
  drop trigger if exists sesiones_exigir_alta on public.sesiones;
  create trigger sesiones_exigir_alta before update on public.sesiones
    for each row execute function public.exigir_alta();
  -- solo inserciones (marcar como leído un comentario sí se puede)
  foreach t in array array['comentarios','archivos'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_exigir_alta', t);
    execute format('create trigger %I before insert on public.%I
                    for each row execute function public.exigir_alta()', t || '_exigir_alta', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 1.4 Si el atleta borra un check-in o un vídeo, la conversación se queda (sin el enlace)
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select c.conname, a.attname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.comentarios'::regclass and c.contype = 'f'
      and a.attname in ('checkin_id', 'archivo_id') and c.confdeltype <> 'n'
  loop
    execute format('alter table public.comentarios drop constraint %I', r.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'public.comentarios'::regclass and conname = 'comentarios_checkin_id_fkey') then
    alter table public.comentarios add constraint comentarios_checkin_id_fkey
      foreign key (checkin_id) references public.checkins(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.comentarios'::regclass and conname = 'comentarios_archivo_id_fkey') then
    alter table public.comentarios add constraint comentarios_archivo_id_fkey
      foreign key (archivo_id) references public.archivos(id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1.5 Funciones auxiliares: solo responden sobre lo propio (o al coach)
-- ---------------------------------------------------------------------
create or replace function public.atleta_de_sesion(p_sesion uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select b.atleta_id from public.sesiones s
  join public.semanas w on w.id = s.semana_id
  join public.bloques b on b.id = w.bloque_id
  where s.id = p_sesion and (b.atleta_id = public.mi_atleta_id() or public.es_coach());
$$;
create or replace function public.atleta_de_checkin(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select atleta_id from public.checkins
  where id = p and (atleta_id = public.mi_atleta_id() or public.es_coach());
$$;
create or replace function public.atleta_de_archivo(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select atleta_id from public.archivos
  where id = p and (atleta_id = public.mi_atleta_id() or public.es_coach());
$$;

-- La biblioteca la ven el coach (coach_todo) y las cuentas vinculadas a un atleta.
drop policy if exists todos_ver on public.ejercicios;
drop policy if exists vinculados_ver on public.ejercicios;
create policy vinculados_ver on public.ejercicios for select to authenticated
  using (public.mi_atleta_id() is not null);

-- ---------------------------------------------------------------------
-- 1.6 Archivos y Storage
-- ---------------------------------------------------------------------
-- Ruta: <atleta_id>/<nombre> con caracteres seguros, sin «..» ni subcarpetas; una fila por archivo.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.archivos'::regclass and conname = 'archivos_ruta_segura') then
    alter table public.archivos add constraint archivos_ruta_segura
      check (ruta ~ ('^' || atleta_id::text || '/[A-Za-z0-9_-][A-Za-z0-9._-]{0,150}$') and position('..' in ruta) = 0);
  end if;
end $$;
create unique index if not exists archivos_ruta_unica on public.archivos (ruta);

-- Al registrar un archivo: no puede darlo por revisado ni comentarlo como coach, y como mucho 30 al día.
create or replace function public.archivo_proteger() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    new.revisado_en := null;
    new.comentario_coach := null;
    new.creado_en := now();
    if (select count(*) from public.archivos
        where atleta_id = new.atleta_id and creado_en > now() - interval '1 day') >= 30 then
      raise exception 'Has subido 30 archivos en las últimas 24 horas: espera un poco o pide a tu coach que borre alguno' using errcode = '54000';
    end if;
  end if;
  return new;
end $$;

-- En Storage solo se puede subir un archivo que ya esté registrado en la tabla archivos a nombre
-- del atleta (así pasan el consentimiento, la ruta segura y el límite diario, y el borrado
-- completo de un atleta lo encuentra todo). La app registra primero y sube después.
create or replace function public.archivo_registrado(p_ruta text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.archivos where ruta = p_ruta and atleta_id = public.mi_atleta_id());
$$;

drop policy if exists fbe_archivos_subir on storage.objects;
create policy fbe_archivos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos' and (public.es_coach() or public.archivo_registrado(name)));

-- ---------------------------------------------------------------------
-- 2. Volumen semanal objetivo por grupo muscular
-- ---------------------------------------------------------------------
-- {"pectoral": [10, 20], "espalda": [12, 22], ...}: series semanales mínimas y máximas.
-- Sin valor, la app usa un rango orientativo general. Solo lo cambia el coach.
alter table public.atletas add column if not exists volumen_objetivo jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.atletas'::regclass and conname = 'atletas_volumen_objetivo_objeto') then
    alter table public.atletas add constraint atletas_volumen_objetivo_objeto
      check (volumen_objetivo is null or jsonb_typeof(volumen_objetivo) = 'object');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. Permisos de las funciones nuevas
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Apuntada: desde aquí, la base no deja repetir por error las migraciones anteriores a esta
insert into public.fbe_migraciones (numero) values (3)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
