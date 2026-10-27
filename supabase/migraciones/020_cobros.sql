-- =====================================================================
-- FBE Equipo, migración 020 (v0.24): control de cobros, privado del coach
-- Sustituye a «💵 FBE Pagos» de Notion. Solo lo ve y lo escribe el coach: el atleta no ve nada (ni por la app
-- ni preguntando a la base), y no hay notificaciones de cobros. Se rellena a mano, atleta a atleta.
-- 1. cobros_atletas: lo acordado con cada atleta (servicio, precio al mes, cada cuánto paga y desde cuándo).
--    Va aparte de «atletas» porque el atleta puede leer su propia ficha y esto no debe verlo.
-- 2. pagos: cada cobro, con su periodo, su importe guardado tal cual (si cambias el precio, lo cobrado antes no
--    cambia), estado (pendiente, retrasado o pagado), fecha y método de pago y una nota.
-- Se borran con el atleta. Van en la copia completa del coach (no en la descarga de datos de un atleta, que es
-- la que se le da a él).
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 019 (o con instalar.sql en una
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
  if v > 20 then
    raise exception 'Esta base ya tiene la migración %: repetir la 020 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 20;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 19) then
    raise exception 'Antes de la 020 hace falta la 019: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Lo acordado con cada atleta
-- ---------------------------------------------------------------------
create table if not exists public.cobros_atletas (
  atleta_id     uuid primary key references public.atletas(id) on delete cascade,
  servicio      text,                          -- «Performance», «Elite»… (o el nombre que quieras)
  precio_mes    numeric(7,2),                  -- € al mes (lo que paga de verdad, con su descuento)
  ciclo         text not null default 'mensual',
  desde         date,                          -- desde cuándo paga (los trimestres cuentan desde aquí)
  nota          text,
  actualizado_en timestamptz not null default now()
);
alter table public.cobros_atletas drop constraint if exists cobros_atletas_validos;
alter table public.cobros_atletas add constraint cobros_atletas_validos check (
  ciclo in ('mensual', 'trimestral', 'semestral', 'anual')
  and (precio_mes is null or precio_mes between 0 and 10000)
  and (servicio is null or (char_length(servicio) between 1 and 60 and public.texto_visible(servicio)))
  and (nota is null or (char_length(nota) between 1 and 500 and public.texto_visible(nota)))
);

-- ---------------------------------------------------------------------
-- 2. Cada cobro
-- ---------------------------------------------------------------------
create table if not exists public.pagos (
  id            uuid primary key default gen_random_uuid(),
  atleta_id     uuid not null references public.atletas(id) on delete cascade,
  periodo_desde date not null,
  periodo_hasta date not null,
  importe       numeric(8,2) not null,
  estado        text not null default 'pendiente',
  fecha_pago    date,
  metodo        text,
  nota          text,
  creado_en     timestamptz not null default now()
);
create index if not exists pagos_atleta_idx on public.pagos (atleta_id, periodo_desde desc);
alter table public.pagos drop constraint if exists pagos_validos;
alter table public.pagos add constraint pagos_validos check (
  periodo_hasta >= periodo_desde and periodo_hasta <= periodo_desde + 400
  and importe between 0 and 100000
  and estado in ('pendiente', 'retrasado', 'pagado')
  and (metodo is null or metodo in ('transferencia', 'efectivo', 'bizum', 'tarjeta', 'otro'))
  and (fecha_pago is null or estado = 'pagado')
  and (nota is null or (char_length(nota) between 1 and 300 and public.texto_visible(nota)))
);

-- ---------------------------------------------------------------------
-- 3. Solo el coach (con su verificación en dos pasos, como todo lo suyo)
-- ---------------------------------------------------------------------
alter table public.cobros_atletas enable row level security;
alter table public.pagos enable row level security;
drop policy if exists coach_todo on public.cobros_atletas;
create policy coach_todo on public.cobros_atletas for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists coach_todo on public.pagos;
create policy coach_todo on public.pagos for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
-- Desde la 019, cada tabla nueva lleva sus permisos a mano
revoke all on public.cobros_atletas, public.pagos from public, anon, authenticated;
grant select, insert, update, delete on public.cobros_atletas, public.pagos to authenticated;

-- Permisos (como al final de 003 a 019)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (20)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
