-- =====================================================================
-- FBE Equipo, migración 017 (v0.21): registro de errores de la app
-- Cuando algo falla en el móvil de un atleta (o en el tuyo), la app lo apunta aquí sola: qué pantalla, qué
-- error y en qué versión, para poder arreglarlo sin esperar a que alguien lo cuente. Sin datos de salud ni lo
-- que se estaba escribiendo: solo el mensaje técnico del error.
-- - Se apuntan con registrar_error(): cada persona, a su nombre; solo el coach los lee y los borra.
-- - Como mucho 30 por persona y hora (si algo falla en bucle, no llena la base), y se borran solos a los 60 días.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 016 (o con instalar.sql en una
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
  if v > 17 then
    raise exception 'Esta base ya tiene la migración %: repetir la 017 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 17;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 16) then
    raise exception 'Antes de la 017 hace falta la 016: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

create table if not exists public.errores_app (
  id          uuid primary key default gen_random_uuid(),
  perfil_id   uuid references public.perfiles(id) on delete cascade default auth.uid(),
  creado_en   timestamptz not null default now(),
  version     text,          -- versión de la app (p. ej. «0.21 · 3f2a9c»)
  pantalla    text,          -- dónde estaba: «#hoy», «sesión»…
  mensaje     text not null, -- el mensaje del error
  detalle     text,          -- dónde saltó (la pila), recortado
  navegador   text           -- móvil y navegador, para reproducirlo
);
create index if not exists errores_app_creado_idx on public.errores_app (creado_en desc);
create index if not exists errores_app_perfil_idx on public.errores_app (perfil_id, creado_en desc);

alter table public.errores_app drop constraint if exists errores_app_validos;
alter table public.errores_app add constraint errores_app_validos check (
  char_length(mensaje) between 1 and 500
  and (version is null or char_length(version) <= 40)
  and (pantalla is null or char_length(pantalla) <= 60)
  and (detalle is null or char_length(detalle) <= 2000)
  and (navegador is null or char_length(navegador) <= 300)
);

-- Se apunta con esta función (nadie escribe la tabla directamente): la base pone quién y cuándo, recorta lo
-- largo, aplica el límite por hora y, de paso, borra lo de hace más de 60 días. Nunca falla hacia la app.
drop trigger if exists errores_app_preparar on public.errores_app;
drop function if exists public.error_app_preparar();
create or replace function public.registrar_error(p_mensaje text, p_pantalla text default null, p_detalle text default null,
                                                  p_version text default null, p_navegador text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  if (select count(*) from public.errores_app e where e.perfil_id = auth.uid() and e.creado_en > now() - interval '1 hour') >= 30 then
    return;  -- algo falla en bucle: no se apunta más (sin error, para no provocar otro)
  end if;
  delete from public.errores_app where creado_en < now() - interval '60 days';
  insert into public.errores_app (perfil_id, mensaje, pantalla, detalle, version, navegador)
  values (auth.uid(), left(coalesce(nullif(btrim(p_mensaje), ''), '(sin mensaje)'), 500), nullif(left(btrim(p_pantalla), 60), ''),
          nullif(left(p_detalle, 2000), ''), nullif(left(btrim(p_version), 40), ''), nullif(left(btrim(p_navegador), 300), ''));
exception when others then
  return;
end $$;

-- Solo el coach los lee y los borra
alter table public.errores_app enable row level security;
drop policy if exists apuntar_propio on public.errores_app;
drop policy if exists coach_ver on public.errores_app;
create policy coach_ver on public.errores_app for select to authenticated using (public.es_coach());
drop policy if exists coach_borrar on public.errores_app;
create policy coach_borrar on public.errores_app for delete to authenticated using (public.es_coach());
revoke all on public.errores_app from public, anon, authenticated;
grant select, delete on public.errores_app to authenticated;

-- Permisos (como al final de 003 a 016)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (17)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
