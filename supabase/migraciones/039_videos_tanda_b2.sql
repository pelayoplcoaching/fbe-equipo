-- =====================================================================
-- FBE Equipo, migración 039 (v0.61): los vídeos de técnica, tanda B (segunda mitad)
--   · La velocidad mínima de cada ejercicio para el 1RM estimado por la velocidad (umbrales_velocidad): la velocidad media
--     de la subida en la última repetición posible (por ejemplo, 0,30 m/s en la sentadilla, 0,17 m/s en el press de banca o
--     0,15 m/s en el peso muerto). Hace falta en la base porque la usan a la vez el coach (en la ficha del atleta) y el atleta
--     (en «Mi técnica» y en su informe del mes), y tienen que dar el mismo 1RM: un ajuste de un solo móvil no vale, y no hay
--     ningún ajuste del coach que lean los atletas en el que quepa (los ejercicios no llevan campos para eso). Una fila por
--     ejercicio, de 0,05 a 1 m/s con 3 decimales como mucho (umbral_velocidad_valido: algo mal formado da false, nunca un
--     error). Sin fila, la app usa el de serie de ese ejercicio. Solo el coach la escribe; los atletas vinculados la leen con
--     umbrales_velocidad_de() (sin ninguna hora). No es un dato de nadie: es un ajuste de cada ejercicio, para todos.
--   · Nada más: «Revisar la sesión» manda su resumen como un comentario de la sesión de siempre (002), la estela del
--     movimiento sale del análisis ya guardado (036) o del de esa sesión, el perfil carga–velocidad y el informe del mes se
--     calculan en el móvil con lo que ya hay, el informe se manda como un mensaje del chat de siempre y «Subir los vídeos
--     solo con wifi» se guarda en el móvil.
-- Se ejecuta en el SQL Editor después de la 038 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 39 then
    raise exception 'Esta base ya tiene la migración %: repetir la 039 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 39;» y, después de ella, todas las siguientes en orden, todo en la misma consulta del SQL Editor (una sola transacción).';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 38) then
    raise exception 'Antes de la 039 hace falta la 038: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. La velocidad mínima de cada ejercicio (solo el coach la escribe; los atletas vinculados la leen)
-- ---------------------------------------------------------------------
create table if not exists public.umbrales_velocidad (
  ejercicio_id    uuid primary key references public.ejercicios(id) on delete cascade,
  vmin            numeric not null,
  actualizado_en  timestamptz not null default now()
);

-- De 0,05 a 1 m/s y con 3 decimales como mucho (la columna es numeric sin escala a propósito: así 0,1234 no se redondea en
-- silencio, se rechaza). NaN e infinito, no. Algo mal formado da false, nunca un error.
create or replace function public.umbral_velocidad_valido(v numeric) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if v is null then return false; end if;
  if v = 'NaN'::numeric then return false; end if;
  if v < 0.05 or v > 1 then return false; end if;
  if scale(v) > 3 then return false; end if;
  return true;
exception when others then
  return false;
end $$;
alter table public.umbrales_velocidad drop constraint if exists umbrales_velocidad_validos;
alter table public.umbrales_velocidad add constraint umbrales_velocidad_validos check (public.umbral_velocidad_valido(vmin));

-- Sin ceros de más (0,300 → 0,3), la fecha de la base y como mucho 1000 (uno por ejercicio de la biblioteca, de sobra)
create or replace function public.umbral_velocidad_preparar() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.ejercicio_id is distinct from old.ejercicio_id then
    raise exception 'Una velocidad mínima no cambia de ejercicio' using errcode = '42501';
  end if;
  if public.umbral_velocidad_valido(new.vmin) then new.vmin := trim_scale(new.vmin); end if;
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext('fbe-umbrales'));
    if (select count(*) from public.umbrales_velocidad) >= 1000 then
      raise exception 'Como mucho 1000 velocidades mínimas: quita alguna antes' using errcode = '23514';
    end if;
  end if;
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists umbrales_velocidad_aa_preparar on public.umbrales_velocidad;
create trigger umbrales_velocidad_aa_preparar before insert or update on public.umbrales_velocidad
  for each row execute function public.umbral_velocidad_preparar();

-- Las de unos ejercicios, como las lee la app (el coach y los atletas vinculados, también los de baja: no es nada suyo),
-- sin ninguna hora. Como mucho 200 ejercicios por vez.
create or replace function public.umbrales_velocidad_de(p_ejercicios uuid[])
returns table (ejercicio_id uuid, vmin numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (public.es_coach() or public.mi_atleta_id() is not null) then
    raise exception 'Necesitas iniciar sesión' using errcode = '42501';
  end if;
  if p_ejercicios is null or cardinality(p_ejercicios) > 200 then
    raise exception 'De 0 a 200 ejercicios de una vez' using errcode = '22023';
  end if;
  return query
    select u.ejercicio_id, u.vmin from public.umbrales_velocidad u
    where u.ejercicio_id = any(p_ejercicios) and public.umbral_velocidad_valido(u.vmin)
    order by u.ejercicio_id;
end $$;

-- ---------------------------------------------------------------------
-- 2. Permisos (desde la 019, cada tabla nueva lleva los suyos a mano)
-- ---------------------------------------------------------------------
alter table public.umbrales_velocidad enable row level security;
-- El coach, todo. El atleta, nada de la tabla (lleva la hora del cambio): las suyas, con umbrales_velocidad_de()
drop policy if exists coach_todo on public.umbrales_velocidad;
create policy coach_todo on public.umbrales_velocidad for all to authenticated using (public.es_coach()) with check (public.es_coach());
revoke all on public.umbrales_velocidad from public, anon, authenticated;
grant select, insert, update, delete on public.umbrales_velocidad to authenticated;

-- Permisos (como al final de 003 a 038)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (39)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
