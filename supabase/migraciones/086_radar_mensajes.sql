-- =====================================================================
-- FBE Equipo, migración 086: «A quién escribir» con tus respuestas por situación y tu manera de escribir
--
-- Por qué: en «A quién escribir» el coach tiene ahora una biblioteca de mensajes por situación (una molestia, un
-- récord, su cumpleaños…) en cuatro tonos. Sus propias respuestas guardadas (las de «/» en el chat) salen ahí según el
-- tema, y un borrador que le guste lo guarda como suyo con su situación. Además, «tu manera de escribir» (empezar con su
-- nombre, tu cierre habitual, un emoji, más corto) se aplica a todos los borradores, igual en el móvil y en el ordenador.
--
--   * respuestas_guardadas.situacion: el tema de cada respuesta (opcional; de 1 a 40 caracteres, sin saltos de línea).
--     La tabla sigue siendo solo del coach: no cambia quién la ve.
--   * radar_ajustes: una fila por coach con su manera de escribir (un objeto de hasta 16 KB). Solo su dueño, y solo si
--     es coach, la lee y la escribe.
--   * Son ajustes del coach, sin datos de los atletas: no cambia la política.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 085 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 86 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 086 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 86;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 85) then  -- (2) la anterior
    raise exception 'Falta la migración 085 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. El tema de cada respuesta guardada
-- ---------------------------------------------------------------------
alter table public.respuestas_guardadas add column if not exists situacion text;
alter table public.respuestas_guardadas drop constraint if exists respuestas_guardadas_situacion;
alter table public.respuestas_guardadas add constraint respuestas_guardadas_situacion
  check (situacion is null or (char_length(situacion) between 1 and 40 and situacion !~ '[[:cntrl:]]'));
comment on column public.respuestas_guardadas.situacion is 'A quién escribir (086): el tema de la respuesta (molestia, record, cumple…); opcional.';

-- ---------------------------------------------------------------------
-- 2. Tu manera de escribir en «A quién escribir»
-- ---------------------------------------------------------------------
create table if not exists public.radar_ajustes (
  usuario_id      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  datos           jsonb not null default '{}'::jsonb,
  actualizado_en  timestamptz not null default now()
);
alter table public.radar_ajustes drop constraint if exists radar_ajustes_datos;
alter table public.radar_ajustes add constraint radar_ajustes_datos check (jsonb_typeof(datos) = 'object' and octet_length(datos::text) <= 16384);
comment on table public.radar_ajustes is 'A quién escribir (086): la manera de escribir de cada coach en los borradores. Solo su dueño.';

create or replace function public.radar_ajustes_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists radar_ajustes_preparar on public.radar_ajustes;
create trigger radar_ajustes_preparar before insert or update on public.radar_ajustes
  for each row execute function public.radar_ajustes_preparar();

alter table public.radar_ajustes enable row level security;
drop policy if exists coach_lo_suyo on public.radar_ajustes;
create policy coach_lo_suyo on public.radar_ajustes for all to authenticated
  using (public.es_coach() and usuario_id = (select auth.uid())) with check (public.es_coach() and usuario_id = (select auth.uid()));
revoke all on public.radar_ajustes from public, anon, authenticated;
grant select, insert, update, delete on public.radar_ajustes to authenticated;

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 085)
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

insert into public.fbe_migraciones (numero) values (86)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
