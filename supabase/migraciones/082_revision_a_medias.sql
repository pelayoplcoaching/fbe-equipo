-- =====================================================================
-- FBE Equipo, migración 082: la revisión semanal del coach, «a medias» y con sus ajustes en la base
--
-- Por qué: al pasar la revisión, un atleta no siempre queda «revisado» o «sin revisar»: a veces se queda esperando su
-- respuesta o a falta de programarle. Y las frases frecuentes y el orden propio del coach se guardaban en cada aparato:
-- en el móvil no salían las del ordenador.
--
--   * revisiones_semanales.estado: nada (lo de siempre), 'esperando' (esperando su respuesta) o 'programar' (falta
--     programarle). Solo el coach lo ve y lo escribe, como el resto de la fila (040).
--   * revision_ajustes: una fila por coach con sus frases frecuentes (hasta 20, de 300 caracteres), su orden propio de
--     atletas (hasta 500) y el orden y la vista elegidos. Solo su dueño, y solo si es coach, la lee y la escribe.
--   * revision_ajustes_validos(...): algo mal formado da false, nunca un error.
--   * No se guarda ningún dato nuevo de los atletas: no cambia la política de privacidad.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 081 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 82 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 082 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 82;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 81) then  -- (2) la anterior
    raise exception 'Falta la migración 081 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. «A medias»: el estado de la revisión de un atleta en una semana
-- ---------------------------------------------------------------------
alter table public.revisiones_semanales add column if not exists estado text;
alter table public.revisiones_semanales drop constraint if exists revisiones_semanales_estado;
alter table public.revisiones_semanales add constraint revisiones_semanales_estado check (estado is null or estado in ('esperando', 'programar'));
comment on column public.revisiones_semanales.estado is 'A medias (082): esperando (su respuesta) o programar (falta programarle). Sin nada, lo de siempre.';

-- ---------------------------------------------------------------------
-- 2. Los ajustes de la revisión de cada coach: sus frases, su orden y cómo la ve
-- ---------------------------------------------------------------------
create table if not exists public.revision_ajustes (
  usuario_id      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  frases          jsonb not null default '[]'::jsonb,
  orden           jsonb not null default '[]'::jsonb,
  modo            text,
  vista           text,
  actualizado_en  timestamptz not null default now()
);

-- Las frases, una lista de hasta 20 textos de 1 a 300 caracteres; el orden, una lista de hasta 500 identificadores;
-- el modo y la vista, de los que hay. Nunca un error.
create or replace function public.revision_ajustes_validos(p_frases jsonb, p_orden jsonb, p_modo text, p_vista text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare x jsonb;
begin
  if p_frases is null or p_orden is null then return false; end if;
  if jsonb_typeof(p_frases) <> 'array' or jsonb_typeof(p_orden) <> 'array' then return false; end if;
  if jsonb_array_length(p_frases) > 20 or jsonb_array_length(p_orden) > 500 then return false; end if;
  for x in select * from jsonb_array_elements(p_frases) loop
    if jsonb_typeof(x) <> 'string' then return false; end if;
    if char_length(x #>> '{}') < 1 or char_length(x #>> '{}') > 300 then return false; end if;
  end loop;
  for x in select * from jsonb_array_elements(p_orden) loop
    if jsonb_typeof(x) <> 'string' then return false; end if;
    if (x #>> '{}') !~ '^[0-9a-fA-F-]{36}$' then return false; end if;
  end loop;
  if p_modo is not null and p_modo not in ('urgencia', 'nombre', 'antiguedad', 'mio') then return false; end if;
  if p_vista is not null and p_vista not in ('lista', 'tabla') then return false; end if;
  return true;
exception when others then
  return false;
end $$;
alter table public.revision_ajustes drop constraint if exists revision_ajustes_validos;
alter table public.revision_ajustes add constraint revision_ajustes_validos check (public.revision_ajustes_validos(frases, orden, modo, vista));

-- La hora del último cambio la pone la base
create or replace function public.revision_ajustes_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists revision_ajustes_preparar on public.revision_ajustes;
create trigger revision_ajustes_preparar before insert or update on public.revision_ajustes
  for each row execute function public.revision_ajustes_preparar();

alter table public.revision_ajustes enable row level security;
drop policy if exists coach_lo_suyo on public.revision_ajustes;
create policy coach_lo_suyo on public.revision_ajustes for all to authenticated
  using (public.es_coach() and usuario_id = (select auth.uid())) with check (public.es_coach() and usuario_id = (select auth.uid()));
revoke all on public.revision_ajustes from public, anon, authenticated;
grant select, insert, update, delete on public.revision_ajustes to authenticated;

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 081)
-- ---------------------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb), public.salud_recibir(text, jsonb), public.calendario_de(text) from public, anon, authenticated;
revoke execute on function public.sesion_video_proteger(), public.guia_tocar(), public.novedad_tocar() from public, anon, authenticated;
revoke execute on function public.crear_recordatorios_apuntes(timestamptz) from public, anon, authenticated;
revoke execute on function public.novedad_audio_fuera() from public, anon, authenticated;
revoke execute on function public.mensaje_coach_audio_fuera() from public, anon, authenticated;
-- (073) la de la cola de las portadas es de un trigger: nadie la llama
revoke execute on function public.portada_fuera() from public, anon, authenticated;
-- (las del reloj, si están)
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('reloj_estado', 'reloj_serie', 'reloj_saltar', 'reloj_elegir', 'reloj_terminar') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
-- (079) la de un trigger: nadie la llama
revoke execute on function public.menu_comida_con_foto() from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;
-- (revisión de la 072) la comprobación de las columnas de música la usa una restricción: el servidor (service_role) también tiene que poder llamarla
grant execute on function fbe_privado.musica_url_valida(text) to service_role;

insert into public.fbe_migraciones (numero) values (82)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
