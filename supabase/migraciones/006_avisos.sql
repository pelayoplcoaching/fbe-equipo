-- =====================================================================
-- FBE Atletas, migración 006 (v0.7)
-- Avisos del coach: un mensaje fijado en Hoy («del 3 al 9 de noviembre respondo más tarde»),
-- para todos los atletas o para uno, entre dos fechas. El atleta solo ve los suyos y los generales,
-- y solo mientras están en vigor.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 005. Se puede repetir sin romper nada.
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
  if v > 6 then
    raise exception 'Esta base ya tiene la migración %: repetir la 006 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 6;» y, después de ella, todas las siguientes en orden.';
  end if;
end $$;

create table if not exists public.avisos (
  id         uuid primary key default gen_random_uuid(),
  texto      text not null,
  atleta_id  uuid references public.atletas(id) on delete cascade,  -- null = para todos
  desde      date not null default ((now() at time zone 'Europe/Madrid')::date),
  hasta      date,
  creado_en  timestamptz not null default now()
);
create index if not exists avisos_atleta_idx on public.avisos (atleta_id);

-- Reglas con nombre (se quitan y se vuelven a poner: repetir la migración aplica la versión vigente).
-- Texto de 1 a 600 caracteres con algo visible (no solo espacios, saltos de línea, espacios duros o invisibles);
-- fechas razonables y el final no antes del inicio.
alter table public.avisos drop constraint if exists avisos_texto_check;
alter table public.avisos drop constraint if exists avisos_check;
alter table public.avisos drop constraint if exists avisos_texto_valido;
alter table public.avisos add constraint avisos_texto_valido
  check (char_length(texto) between 1 and 600 and texto ~ E'[^[:space:]\u00a0\u200b\ufeff]');
alter table public.avisos drop constraint if exists avisos_fechas_validas;
alter table public.avisos add constraint avisos_fechas_validas
  check (desde < date '2100-01-01' and (hasta is null or (hasta >= desde and hasta < date '2100-01-01')));
alter table public.avisos alter column desde set default ((now() at time zone 'Europe/Madrid')::date);

alter table public.avisos enable row level security;
drop policy if exists coach_todo on public.avisos;
create policy coach_todo on public.avisos for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
-- El atleta (con la cuenta ya vinculada a su ficha) ve los generales y los suyos, solo en vigor; no escribe nada
drop policy if exists atleta_ver on public.avisos;
create policy atleta_ver on public.avisos for select to authenticated
  using (
    public.mi_atleta_id() is not null
    and (atleta_id is null or atleta_id = public.mi_atleta_id())
    -- «hoy» en hora de España (Supabase trabaja en UTC; la app usa la fecha del móvil)
    and desde <= (now() at time zone 'Europe/Madrid')::date
    and (hasta is null or hasta >= (now() at time zone 'Europe/Madrid')::date)
  );

-- ---------------------------------------------------------------------
-- Permisos (como al final de 003 a 005)
-- ---------------------------------------------------------------------
revoke all on public.avisos from anon;
grant select, insert, update, delete on public.avisos to authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Apuntada: desde aquí, la base no deja repetir por error las migraciones anteriores a esta
insert into public.fbe_migraciones (numero) values (6)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
