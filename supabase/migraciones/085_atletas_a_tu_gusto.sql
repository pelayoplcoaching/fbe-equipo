-- =====================================================================
-- FBE Equipo, migración 085: la lista de Atletas a tu gusto, igual en el móvil y en el ordenador
--
-- Por qué: en la pestaña Atletas el coach fija arriba a quien quiere, pone sus etiquetas («Preboda», «Media maratón»),
-- deja una línea de nota para sí mismo («Revisar rodilla») y guarda cómo quiere ver la lista (columnas, orden,
-- vistas con nombre y el color de cada etiqueta). Hasta ahora no había dónde guardarlo y cada aparato iba por su lado.
--
--   * atletas_panel: una fila por coach y atleta con lo fijado, sus etiquetas (hasta 8, de 1 a 24 caracteres) y su
--     nota (hasta 200 caracteres). Solo su dueño, y solo si es coach, la lee y la escribe. El atleta no la ve nunca.
--   * panel_ajustes: una fila por coach con cómo ve la lista (un objeto de hasta 32 KB). Solo su dueño.
--   * Como mucho 500 filas por coach en atletas_panel. Al borrar un atleta se borra la suya.
--   * La nota y las etiquetas son apuntes privados del coach, como sus notas de la ficha: no cambia la política.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 084 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 85 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 085 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 85;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 84) then  -- (2) la anterior
    raise exception 'Falta la migración 084 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Lo de cada atleta: fijado arriba, sus etiquetas y una nota
-- ---------------------------------------------------------------------
-- Hasta 8 etiquetas, cada una de 1 a 24 caracteres, sin saltos de línea ni caracteres de control, sin repetir. Nunca un error.
create or replace function public.atletas_panel_etiquetas_validas(p text[]) returns boolean
language plpgsql immutable set search_path = '' as $$
declare x text;
begin
  if p is null then return false; end if;
  if coalesce(array_length(p, 1), 0) > 8 then return false; end if;
  if coalesce(array_ndims(p), 1) > 1 then return false; end if;
  foreach x in array p loop
    if x is null or char_length(x) < 1 or char_length(x) > 24 or x ~ '[[:cntrl:]]' or x <> btrim(x) then return false; end if;
  end loop;
  if (select count(distinct lower(e)) from unnest(p) e) <> coalesce(array_length(p, 1), 0) then return false; end if;
  return true;
exception when others then
  return false;
end $$;

create table if not exists public.atletas_panel (
  usuario_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  atleta_id       uuid not null references public.atletas(id) on delete cascade,
  fijado          boolean not null default false,
  etiquetas       text[] not null default '{}',
  nota            text,
  actualizado_en  timestamptz not null default now(),
  primary key (usuario_id, atleta_id)
);
alter table public.atletas_panel drop constraint if exists atletas_panel_etiquetas;
alter table public.atletas_panel add constraint atletas_panel_etiquetas check (public.atletas_panel_etiquetas_validas(etiquetas));
alter table public.atletas_panel drop constraint if exists atletas_panel_nota;
alter table public.atletas_panel add constraint atletas_panel_nota check (nota is null or (char_length(nota) between 1 and 200 and nota !~ '[[:cntrl:]]'));
alter table public.atletas_panel drop constraint if exists atletas_panel_algo;
alter table public.atletas_panel add constraint atletas_panel_algo check (fijado or cardinality(etiquetas) > 0 or nota is not null);
create index if not exists atletas_panel_atleta_idx on public.atletas_panel (atleta_id);
comment on table public.atletas_panel is 'Atletas (085): lo que cada coach fija, etiqueta o anota de cada atleta. Solo su dueño; el atleta no lo ve.';

-- La hora la pone la base; como mucho 500 filas por coach
create or replace function public.atletas_panel_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  if tg_op = 'INSERT' and (select count(*) from public.atletas_panel where usuario_id = new.usuario_id) >= 500 then
    raise exception 'Tienes demasiados atletas fijados, etiquetados o con nota (500)' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists atletas_panel_preparar on public.atletas_panel;
create trigger atletas_panel_preparar before insert or update on public.atletas_panel
  for each row execute function public.atletas_panel_preparar();

alter table public.atletas_panel enable row level security;
drop policy if exists coach_lo_suyo on public.atletas_panel;
create policy coach_lo_suyo on public.atletas_panel for all to authenticated
  using (public.es_coach() and usuario_id = (select auth.uid())) with check (public.es_coach() and usuario_id = (select auth.uid()));
revoke all on public.atletas_panel from public, anon, authenticated;
grant select, insert, update, delete on public.atletas_panel to authenticated;

-- ---------------------------------------------------------------------
-- 2. Cómo ve el coach la lista: columnas, orden, vistas guardadas y colores de las etiquetas
-- ---------------------------------------------------------------------
create table if not exists public.panel_ajustes (
  usuario_id      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  datos           jsonb not null default '{}'::jsonb,
  actualizado_en  timestamptz not null default now()
);
alter table public.panel_ajustes drop constraint if exists panel_ajustes_datos;
alter table public.panel_ajustes add constraint panel_ajustes_datos check (jsonb_typeof(datos) = 'object' and octet_length(datos::text) <= 32768);
comment on table public.panel_ajustes is 'Atletas (085): cómo ve cada coach su lista de atletas. Solo su dueño.';

create or replace function public.panel_ajustes_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists panel_ajustes_preparar on public.panel_ajustes;
create trigger panel_ajustes_preparar before insert or update on public.panel_ajustes
  for each row execute function public.panel_ajustes_preparar();

alter table public.panel_ajustes enable row level security;
drop policy if exists coach_lo_suyo on public.panel_ajustes;
create policy coach_lo_suyo on public.panel_ajustes for all to authenticated
  using (public.es_coach() and usuario_id = (select auth.uid())) with check (public.es_coach() and usuario_id = (select auth.uid()));
revoke all on public.panel_ajustes from public, anon, authenticated;
grant select, insert, update, delete on public.panel_ajustes to authenticated;

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 084)
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

insert into public.fbe_migraciones (numero) values (85)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
