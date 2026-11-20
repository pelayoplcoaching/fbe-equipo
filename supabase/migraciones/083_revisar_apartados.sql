-- =====================================================================
-- FBE Equipo, migración 083: lo que el coach aparta o fija en «Revisar», igual en el móvil y en el ordenador
--
-- Por qué: en «Revisar», «Mañana» (apartar una tarjeta hasta otro día) y «Fijar arriba» se guardaban en cada aparato:
-- lo apartado en el ordenador volvía a salir en el móvil.
--
--   * revisar_apartados: una fila por coach y tarjeta (clave: la de la tarjeta en «Revisar», como «s-<id>»), con el día
--     en que vuelve a salir (de hoy a 60 días) o fijada arriba. Solo su dueño, y solo si es coach, la lee y la escribe.
--   * Como mucho 500 filas por coach (lo pasado lo borra la app al entrar).
--   * No se guarda ningún dato nuevo de los atletas: no cambia la política de privacidad.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 082 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 83 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 083 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 83;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 82) then  -- (2) la anterior
    raise exception 'Falta la migración 082 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Lo apartado (hasta un día) y lo fijado arriba
-- ---------------------------------------------------------------------
create table if not exists public.revisar_apartados (
  usuario_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clave       text not null,
  hasta       date,
  fijada      boolean not null default false,
  creado_en   timestamptz not null default now(),
  primary key (usuario_id, clave)
);
alter table public.revisar_apartados drop constraint if exists revisar_apartados_clave;
alter table public.revisar_apartados add constraint revisar_apartados_clave check (clave ~ '^[a-z]{1,2}-[A-Za-z0-9-]{1,80}$');
alter table public.revisar_apartados drop constraint if exists revisar_apartados_algo;
alter table public.revisar_apartados add constraint revisar_apartados_algo check (hasta is not null or fijada);
comment on table public.revisar_apartados is 'Revisar (083): lo que cada coach aparta hasta un día o fija arriba. Solo su dueño.';

-- El día, de hoy (en Madrid) a 60 días; como mucho 500 filas por coach. La hora la pone la base.
create or replace function public.revisar_apartados_preparar() returns trigger
language plpgsql set search_path = '' as $$
declare hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
  if new.hasta is not null and (new.hasta < hoy or new.hasta > hoy + 60) then
    raise exception 'El día en que vuelve a salir tiene que ser de hoy a 60 días' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    new.creado_en := now();
    if (select count(*) from public.revisar_apartados where usuario_id = new.usuario_id) >= 500 then
      raise exception 'Tienes demasiadas tarjetas apartadas o fijadas (500)' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists revisar_apartados_preparar on public.revisar_apartados;
create trigger revisar_apartados_preparar before insert or update on public.revisar_apartados
  for each row execute function public.revisar_apartados_preparar();

alter table public.revisar_apartados enable row level security;
drop policy if exists coach_lo_suyo on public.revisar_apartados;
create policy coach_lo_suyo on public.revisar_apartados for all to authenticated
  using (public.es_coach() and usuario_id = (select auth.uid())) with check (public.es_coach() and usuario_id = (select auth.uid()));
revoke all on public.revisar_apartados from public, anon, authenticated;
grant select, insert, update, delete on public.revisar_apartados to authenticated;

-- ---------------------------------------------------------------------
-- 2. Permisos (como al final de 003 a 082)
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

insert into public.fbe_migraciones (numero) values (83)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
