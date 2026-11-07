-- =====================================================================
-- FBE Equipo, migración 049: cómo va la app en cada dispositivo
--
-- Por qué: todo lo que se ha medido de la velocidad de la app se ha medido en un ordenador. No se sabe cuánto
-- tarda en abrir, en enseñar Hoy o en guardar una serie en el móvil de cada atleta, con su cobertura.
--
-- Qué hace: la app apunta sola, mientras se usa, sus tiempos (abrir, enseñar cada pantalla, cada consulta a la
-- base, guardar) y manda un resumen: una fila por dispositivo y día, con cuántas veces tardó menos de 50 ms, de
-- 100, de 200… Solo tiempos, el tipo de dispositivo (iPhone, Android u ordenador; si está instalada; la red que
-- dice tener) y la versión. Nada de lo que la persona hace ni escribe, ni el modelo del móvil.
--   * rendimiento_apuntar(): cada uno apunta lo suyo. La fila del día se sustituye entera (mandarla dos veces no
--     cuenta doble). Como mucho 8 dispositivos por persona, solo hoy y los dos días anteriores, y lo de hace más
--     de 60 días se borra solo. Nunca falla hacia la app.
--   * rendimiento_resumen(días): solo el coach. Devuelve las filas SIN decir de quién son: cada dispositivo sale
--     con un código que no se puede deshacer.
--   * rendimiento_borrar(): solo el coach; borra todas las medidas.
-- Nadie lee ni escribe la tabla directamente. Sin esta migración, la app no apunta nada y todo lo demás sigue igual.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 048 (o con instalar.sql en una
-- base nueva). Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 49 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 049 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 49;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 48) then  -- (2) la migración previa
    raise exception 'Antes de la 049 hace falta la 048: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

create table if not exists public.rendimiento_app (
  id             uuid primary key default gen_random_uuid(),
  perfil_id      uuid not null references public.perfiles(id) on delete cascade,
  dispositivo    uuid not null,              -- al azar, lo inventa cada dispositivo; solo para sustituir su propia fila
  dia            date not null,
  rol            text not null default 'atleta',
  version        text,                       -- versión de la app
  entorno        jsonb not null default '{}'::jsonb,   -- { so, instalada, red, memoria, nucleos }
  datos          jsonb not null default '{}'::jsonb,   -- { medida: { n, h: [veces por tramo], max } }
  actualizado_en timestamptz not null default now(),
  unique (perfil_id, dispositivo, dia)
);
create index if not exists rendimiento_app_dia_idx on public.rendimiento_app (dia desc);

alter table public.rendimiento_app drop constraint if exists rendimiento_app_validos;
alter table public.rendimiento_app add constraint rendimiento_app_validos check (
  rol in ('atleta', 'coach')
  and (version is null or char_length(version) <= 40)
  and jsonb_typeof(entorno) = 'object' and jsonb_typeof(datos) = 'object'
  and octet_length(entorno::text) <= 400 and octet_length(datos::text) <= 12000
);

-- Se apunta con esta función (nadie escribe la tabla directamente). La base pone de quién es y su papel
create or replace function public.rendimiento_apuntar(p_dispositivo uuid, p_dia date, p_version text default null,
                                                      p_entorno jsonb default '{}'::jsonb, p_datos jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_yo uuid := auth.uid();
  v_rol text;
  v_entorno jsonb;
  v_datos jsonb := '{}'::jsonb;
  v_k text;
  v_v jsonb;
  v_h jsonb;
begin
  if v_yo is null or p_dispositivo is null or p_dia is null then return; end if;
  if p_dia < current_date - 2 or p_dia > current_date + 1 then return; end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' or p_datos = '{}'::jsonb or octet_length(p_datos::text) > 12000 then return; end if;
  select case when p.rol = 'coach' then 'coach' else 'atleta' end into v_rol from public.perfiles p where p.id = v_yo;
  if v_rol is null then return; end if;
  -- (revisión) solo el coach y quien es atleta suyo ahora (no una cuenta suelta ni un atleta dado de baja)
  if v_rol <> 'coach' and not exists (select 1 from public.atletas a where a.perfil_id = v_yo) then return; end if;
  -- (revisión) de lo medido, solo la forma que manda la app: como mucho 40 nombres fijos, cada uno con su histograma
  -- de 10 casillas enteras, el total y el máximo; lo demás se tira
  for v_k, v_v in select e.key, e.value from jsonb_each(p_datos) e limit 40 loop
    v_h := v_v->'h';
    if v_k ~ '^[a-z][a-z0-9:_-]{0,39}$' and jsonb_typeof(v_v) = 'object' and jsonb_typeof(v_h) = 'array' and jsonb_array_length(v_h) = 10
       and not exists (select 1 from jsonb_array_elements(v_h) x where jsonb_typeof(x) <> 'number' or (x#>>'{}')::numeric not between 0 and 10000000 or (x#>>'{}')::numeric <> trunc((x#>>'{}')::numeric)) then
      v_datos := v_datos || jsonb_build_object(v_k, jsonb_strip_nulls(jsonb_build_object(
        'h', v_h,
        'n', (select sum((x#>>'{}')::numeric) from jsonb_array_elements(v_h) x),
        'max', case when jsonb_typeof(v_v->'max') = 'number' then least(600000, greatest(0, (v_v->>'max')::numeric)) end)));
    end if;
  end loop;
  if v_datos = '{}'::jsonb then return; end if;
  -- (revisión) el cupo de dispositivos, de uno en uno por persona
  perform pg_advisory_xact_lock(hashtext('rend:' || v_yo::text));
  -- Como mucho 8 dispositivos por persona (los que ya tiene siguen apuntando)
  if not exists (select 1 from public.rendimiento_app r where r.perfil_id = v_yo and r.dispositivo = p_dispositivo)
     and (select count(distinct r.dispositivo) from public.rendimiento_app r where r.perfil_id = v_yo) >= 8 then
    return;
  end if;
  -- Del tipo de dispositivo, solo lo que se espera (lo demás se tira)
  v_entorno := jsonb_strip_nulls(jsonb_build_object(
    'so', case when p_entorno->>'so' in ('ios', 'android') then p_entorno->>'so' else 'otro' end,
    'instalada', coalesce((p_entorno->>'instalada') = 'true', false),
    'red', case when p_entorno->>'red' in ('slow-2g', '2g', '3g', '4g') then p_entorno->>'red' end,
    'memoria', case when jsonb_typeof(p_entorno->'memoria') = 'number' then least(64, greatest(0, (p_entorno->>'memoria')::numeric)) end,
    'nucleos', case when jsonb_typeof(p_entorno->'nucleos') = 'number' then least(128, greatest(0, (p_entorno->>'nucleos')::numeric)) end));
  delete from public.rendimiento_app where dia < current_date - 60;
  insert into public.rendimiento_app (perfil_id, dispositivo, dia, rol, version, entorno, datos, actualizado_en)
  values (v_yo, p_dispositivo, p_dia, v_rol, case when btrim(p_version) ~ '^[0-9A-Za-z .·_+-]{1,40}$' then btrim(p_version) end, v_entorno, v_datos, now())
  on conflict (perfil_id, dispositivo, dia) do update
    set rol = excluded.rol, version = excluded.version, entorno = excluded.entorno, datos = excluded.datos, actualizado_en = now();
exception when others then
  return;
end $$;
comment on function public.rendimiento_apuntar(uuid, date, text, jsonb, jsonb) is
  'El resumen de tiempos de un dispositivo en un día (lo apunta la app sola). Sustituye la fila de ese dispositivo y día.';

-- Solo el coach lo lee, y sin saber de quién es cada fila: el dispositivo sale con un código que la app no puede deshacer (se calcula con un identificador que solo conoce el móvil; desde el editor SQL de Supabase sí se ve la tabla entera)
create or replace function public.rendimiento_resumen(p_dias integer default 14)
returns table (dispositivo text, dia date, rol text, version text, entorno jsonb, datos jsonb)
language sql stable security definer set search_path = '' as $$
  select left(md5(r.perfil_id::text || r.dispositivo::text), 8), r.dia, r.rol, r.version, r.entorno, r.datos
  from public.rendimiento_app r
  where public.es_coach() and r.dia >= current_date - least(60, greatest(1, coalesce(p_dias, 14)))
  order by r.dia desc, 1;
$$;
comment on function public.rendimiento_resumen(integer) is
  'Las medidas de todos los dispositivos de los últimos días, sin decir de quién son. Solo el coach.';

create or replace function public.rendimiento_borrar() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Solo el coach puede borrar las medidas'; end if;
  delete from public.rendimiento_app where true;
end $$;
comment on function public.rendimiento_borrar() is 'Borra todas las medidas de rendimiento. Solo el coach.';

-- (revisión) al dar de baja a un atleta (se borra su ficha y queda su cuenta), sus medidas se van con él
create or replace function public.rendimiento_al_borrar_atleta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.perfil_id is not null then delete from public.rendimiento_app where perfil_id = old.perfil_id; end if;
  return old;
end $$;
drop trigger if exists atletas_zz_rendimiento on public.atletas;
create trigger atletas_zz_rendimiento after delete on public.atletas
  for each row execute function public.rendimiento_al_borrar_atleta();

-- Nadie toca la tabla directamente
alter table public.rendimiento_app enable row level security;
revoke all on public.rendimiento_app from public, anon, authenticated;

-- Permisos (como al final de 003 a 048)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (49)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
