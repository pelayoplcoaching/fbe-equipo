-- =====================================================================
-- FBE Equipo, migración 021 (v0.25): el atleta ve cómo va con sus pagos
-- Solo el resumen, calculado en la base: hasta cuándo tiene pagado, lo que queda pendiente (de periodos ya
-- empezados) y desde cuándo, y una etiqueta (al día, vence pronto, pendiente, retrasado…). Nunca el precio
-- acordado, las notas, los métodos ni la lista de cobros: las tablas siguen siendo solo del coach (020).
-- Sin cobros apuntados, no devuelve nada (y la app no enseña nada).
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 020 (o con instalar.sql en una
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
  if v > 21 then
    raise exception 'Esta base ya tiene la migración %: repetir la 021 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 21;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 20) then
    raise exception 'Antes de la 021 hace falta la 020: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- El resumen de los pagos del atleta con la sesión abierta (el coach no tiene: para él, vacío).
-- Mismas reglas que logica/cobros.js (resumenCobros), con el día de hoy en Madrid.
create or replace function public.mi_cobro()
returns table (pagado_hasta date, debe numeric, debe_desde date, estado text)
language sql stable security definer set search_path = '' as $$
  with yo as (select public.mi_atleta_id() as id),
  hoy as (select (now() at time zone 'Europe/Madrid')::date as d),
  p as (select x.* from public.pagos x, yo where x.atleta_id = yo.id),
  r as (
    select (select max(periodo_hasta) from p where estado = 'pagado') as pagado_hasta,
           (select coalesce(sum(importe), 0) from p, hoy where estado <> 'pagado' and periodo_desde <= hoy.d) as debe,
           (select min(periodo_desde) from p, hoy where estado <> 'pagado' and periodo_desde <= hoy.d) as debe_desde,
           exists (select 1 from p, hoy where estado = 'retrasado' and periodo_desde <= hoy.d) as retrasado
  )
  select r.pagado_hasta, r.debe, r.debe_desde,
    case when r.retrasado then 'retrasado'
         when r.debe > 0 then 'pendiente'
         when r.pagado_hasta is null then 'primer_cobro'
         when r.pagado_hasta < hoy.d then 'vencido'
         when r.pagado_hasta - hoy.d < 7 then 'vence_pronto'
         else 'al_dia' end
  from r, hoy
  where exists (select 1 from p);
$$;

-- Permisos (como al final de 003 a 020)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (21)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
