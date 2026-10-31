-- =====================================================================
-- FBE Equipo, migración 026 (v0.40): el peso, a diario o una vez a la semana
-- Hasta ahora «Tu día» le pedía a cada atleta su peso todos los días (y salía pendiente hasta apuntarlo). Con
-- atletas.peso_frecuencia el coach elige, para cada uno:
--   · 'diario' (de entrada, como hasta ahora): en «Tu día», «Tu peso» cada mañana.
--   · 'semanal': no sale en «Tu día»; se lo pide el check-in de la semana (su apartado Peso), y puede apuntarlo
--     cuando quiera en la tarjeta «Tu peso» de Hoy.
-- Lo cambia el coach en la ficha del atleta → Seguimiento → Su check-in. Se ejecuta en el SQL Editor después de
-- la 025 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 26 then
    raise exception 'Esta base ya tiene la migración %: repetir la 026 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 26;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 25) then
    raise exception 'Antes de la 026 hace falta la 025: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

alter table public.atletas add column if not exists peso_frecuencia text not null default 'diario';
alter table public.atletas drop constraint if exists atletas_peso_frecuencia_valida;
alter table public.atletas add constraint atletas_peso_frecuencia_valida check (peso_frecuencia in ('diario', 'semanal'));

-- Permisos (como al final de 003 a 025)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (26)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
