-- =====================================================================
-- FBE Equipo, migración 028 (v0.44): las normas del equipo
-- Antes de entrar en la comunidad, cada atleta lee las normas de buen comportamiento y las marca como leídas.
--   · comunidad_miembros.normas_version y normas_leidas_en (la hora la pone la base): qué normas leyó y cuándo.
--   · public.comunidad_normas_version(): las vigentes (como VERSION_NORMAS en web/src/datos/normas-comunidad.js).
--   · comunidad_unirme(nombre, versión del texto, versión de las normas): sin las normas vigentes no se entra.
--   · «Estar dentro» exige también las normas vigentes: si cambian, cada uno tiene que volver a leerlas y,
--     mientras, lo suyo no se ve (igual que si cambia el texto de lo que se comparte).
-- Los que ya estaban dentro tienen que leerlas una vez al abrir Equipo (se les retiran las notificaciones del
-- equipo que tuvieran pendientes hasta entonces).
-- Se ejecuta en el SQL Editor después de la 027 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 28 then
    raise exception 'Esta base ya tiene la migración %: repetir la 028 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 28;» y, después de ella, todas las siguientes en orden, todo en la misma consulta del SQL Editor (una sola transacción).';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 27) then
    raise exception 'Antes de la 028 hace falta la 027: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

alter table public.comunidad_miembros add column if not exists normas_version text;
alter table public.comunidad_miembros add column if not exists normas_leidas_en timestamptz;
alter table public.comunidad_miembros drop constraint if exists comunidad_miembros_normas_validas;
alter table public.comunidad_miembros add constraint comunidad_miembros_normas_validas check (
  (normas_version is null) = (normas_leidas_en is null) and (normas_version is null or char_length(normas_version) between 1 and 40)
);

-- Cambia esta versión (y VERSION_NORMAS en web/src/datos/normas-comunidad.js) cuando cambien las normas
create or replace function public.comunidad_normas_version() returns text
language sql immutable set search_path = '' as $$ select 'normas-2026-11'::text $$;

-- Los que están dentro de verdad (027) y, además, con las normas vigentes leídas
create or replace view fbe_privado.comunidad_dentro as
  select m.atleta_id, m.perfil_id, m.nombre, m.sin_ranking
  from public.comunidad_miembros m
  join public.atletas a on a.id = m.atleta_id and a.perfil_id = m.perfil_id
  join public.perfiles p on p.id = m.perfil_id
  where m.salido_en is null and not m.bloqueado and m.version = public.comunidad_version()
    and m.normas_version = public.comunidad_normas_version()
    and a.estado <> 'baja' and p.rol <> 'coach';
revoke all on fbe_privado.comunidad_dentro from public, anon, authenticated;

-- Entrar (o volver, o aceptar el texto o las normas nuevas): con el texto y las normas vigentes, el nombre que
-- elige y la hora de la base
create or replace function public.comunidad_unirme(p_nombre text, p_version text, p_normas text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  a public.atletas;
  v_nombre text := btrim(regexp_replace(coalesce(p_nombre, ''), '[[:space:][:cntrl:]]+', ' ', 'g'));
  v_problema text;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión' using errcode = '42501'; end if;
  if exists (select 1 from public.perfiles p where p.id = v_uid and p.rol = 'coach') then
    raise exception 'El coach está en la comunidad como coach, no como miembro' using errcode = '42501';
  end if;
  select * into a from public.atletas x where x.perfil_id = v_uid;
  if not found then raise exception 'Solo los atletas del equipo pueden entrar' using errcode = '42501'; end if;
  if a.estado = 'baja' then
    raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada' using errcode = '42501';
  end if;
  if not public.comunidad_activa() then raise exception 'La comunidad no está abierta' using errcode = '42501'; end if;
  if exists (select 1 from public.comunidad_miembros m where m.atleta_id = a.id and m.bloqueado) then
    raise exception 'Tu coach te ha sacado de la comunidad: habla con él si quieres volver' using errcode = '42501';
  end if;
  if p_version is distinct from public.comunidad_version() then
    raise exception 'El texto que aceptas no es el vigente: recarga la app y vuelve a intentarlo' using errcode = '22023';
  end if;
  if p_normas is distinct from public.comunidad_normas_version() then
    raise exception 'Antes de entrar, lee las normas del equipo vigentes: recarga la app y vuelve a intentarlo' using errcode = '22023';
  end if;
  v_problema := fbe_privado.comunidad_problema_nombre(v_nombre, a.id);
  if v_problema is not null then raise exception '%', v_problema using errcode = '22023'; end if;
  insert into public.comunidad_miembros as m (atleta_id, perfil_id, nombre, version, aceptado_en, salido_en, nombre_cambiado_en, normas_version, normas_leidas_en)
  values (a.id, v_uid, v_nombre, p_version, now(), null, null, p_normas, now())
  on conflict (atleta_id) do update
    set perfil_id = excluded.perfil_id, nombre = excluded.nombre, version = excluded.version,
        aceptado_en = now(), salido_en = null, nombre_cambiado_en = null,
        normas_version = excluded.normas_version, normas_leidas_en = now();
end $$;

-- La de antes (sin las normas) ya no deja entrar: una app sin actualizar lo dice en vez de saltárselas
create or replace function public.comunidad_unirme(p_nombre text, p_version text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Para entrar hay que leer antes las normas del equipo: actualiza la app y vuelve a intentarlo' using errcode = '22023';
end $$;

-- Los que estaban dentro aún no han leído las normas: las notificaciones del equipo que tuvieran pendientes no salen
delete from public.notificaciones n
where n.tipo = 'comunidad' and n.url = '#equipo' and n.estado = 'pendiente'
  and not exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = n.usuario_id);

-- Permisos (como al final de 003 a 027)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (28)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
