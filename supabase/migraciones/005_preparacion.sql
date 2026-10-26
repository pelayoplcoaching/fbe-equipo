-- =====================================================================
-- FBE Atletas, migración 005 (v0.6)
-- «¿Cómo llegas hoy?»: antes de empezar una sesión, el atleta dice cómo ha dormido, cómo tiene
-- la energía y si tiene agujetas o molestias (1 = mal, 2 = normal, 3 = bien). La app le aconseja
-- según eso y el coach lo ve en el registro de la sesión.
-- Son datos de salud: solo se guardan con el consentimiento explícito del atleta.
--
-- Se ejecuta en el SQL Editor después de schema.sql, 002, 003 y 004. Se puede repetir sin romper nada.
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
  if v > 5 then
    raise exception 'Esta base ya tiene la migración %: repetir la 005 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 5;» y, después de ella, todas las siguientes en orden.';
  end if;
end $$;

alter table public.sesiones add column if not exists preparacion jsonb;

-- Forma exacta: { "sueno": 1-3, "energia": 1-3, "molestias": 1-3 } y nada más
alter table public.sesiones drop constraint if exists sesiones_preparacion_valida;
alter table public.sesiones add constraint sesiones_preparacion_valida check (
  preparacion is null or coalesce(
    jsonb_typeof(preparacion) = 'object'
    and preparacion ?& array['sueno', 'energia', 'molestias']  -- las tres (sin esto, una que falta daría null y pasaría)
    and preparacion - array['sueno', 'energia', 'molestias'] = '{}'::jsonb
    and jsonb_typeof(preparacion -> 'sueno') = 'number' and (preparacion ->> 'sueno') in ('1', '2', '3')
    and jsonb_typeof(preparacion -> 'energia') = 'number' and (preparacion ->> 'energia') in ('1', '2', '3')
    and jsonb_typeof(preparacion -> 'molestias') = 'number' and (preparacion ->> 'molestias') in ('1', '2', '3'),
    false)
);

-- Solo se guarda (o se cambia) si el atleta dueño de la sesión tiene dado el consentimiento de datos de salud,
-- la escriba quien la escriba desde la app (también el coach). Vaciarla se puede siempre.
-- ¿Tiene consentimiento de salud el atleta de esta semana? Solo responde al propio atleta y al coach
-- (a cualquier otro le devuelve false: no revela nada de nadie).
create or replace function public.consentimiento_salud_de_semana(p_semana uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.semanas w
    join public.bloques b on b.id = w.bloque_id
    join public.atletas a on a.id = b.atleta_id
    join public.consentimientos c on c.perfil_id = a.perfil_id
    where w.id = p_semana and c.tipo = 'datos_salud' and c.revocado_en is null
      and (b.atleta_id = public.mi_atleta_id() or public.es_coach()));
$$;

create or replace function public.preparacion_con_consentimiento() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.preparacion is not null
     and (tg_op = 'INSERT' or new.preparacion is distinct from old.preparacion)
     and not public.consentimiento_salud_de_semana(new.semana_id) then
    raise exception 'Para guardar cómo llega a la sesión hace falta el consentimiento de datos de salud del atleta' using errcode = '42501';
  end if;
  return new;
end $$;
-- Sin «of preparacion» y en altas y cambios, para ver el valor final venga de donde venga. Los BEFORE triggers
-- se ejecutan por orden alfabético: el «zz» lo pone el último, después de cualquier otro que pudiera tocarla.
drop trigger if exists sesiones_preparacion_consentimiento on public.sesiones;
drop trigger if exists sesiones_zz_preparacion_consentimiento on public.sesiones;
create trigger sesiones_zz_preparacion_consentimiento before insert or update on public.sesiones
  for each row execute function public.preparacion_con_consentimiento();

-- ---------------------------------------------------------------------
-- Permisos (como al final de 003 y 004)
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Apuntada: desde aquí, la base no deja repetir por error las migraciones anteriores a esta
insert into public.fbe_migraciones (numero) values (5)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
