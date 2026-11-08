-- =====================================================================
-- FBE Equipo, migración 052: modo reloj (el entreno desde el Apple Watch, con la app Atajos)
--
-- Por qué: una app web no puede tener app en el Apple Watch (Apple solo deja instalar apps nativas). Pero la app Atajos
-- funciona en el reloj y se puede poner en la esfera. El coach prepara una vez el atajo «FBE Reloj»; cada atleta lo
-- instala con su clave personal y, desde la muñeca, ve la serie que toca («Sentadilla · serie 2 de 4 · 80 kg × 8 ·
-- RIR 2»), la marca como hecha (o cambia los kilos y las repeticiones), salta un ejercicio o termina la sesión. Cada
-- serie se guarda en la base como si la marcara en el móvil, y el atajo arranca el temporizador del descanso.
--
-- Qué hace:
--   * reloj: una fila por atleta con la huella (sha-256) de su clave (nunca la clave), la unidad (kg o lb), la sesión
--     que eligió en el reloj (si eligió una) y los ejercicios que saltó en ella. reloj_mio(), reloj_crear(unidad) (la
--     clave, una vez), reloj_unidad(unidad) y reloj_quitar(): el atleta.
--   * Solo para la función «reloj» (clave de servicio): reloj_estado(clave, sesión) (la sesión que toca con su pauta,
--     lo hecho y su última vez en cada ejercicio), reloj_serie(…) (guarda una serie), reloj_saltar(…), reloj_elegir(…)
--     y reloj_terminar(…) (la marca como hecha con su esfuerzo y su duración).
--   * El atajo del coach: atajos_coach admite también 'reloj' (atajo_guardar, igual que en la 051 con esa clave más).
-- Nadie lee ni escribe la tabla directamente. Al borrar la ficha de un atleta, lo suyo se va con ella. De baja, el
-- reloj no deja apuntar nada. Sin esta migración, la app no enseña el modo reloj y todo lo demás sigue igual.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 051 (o con instalar.sql en una base
-- nueva). Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 52 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 052 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 52;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 51) then  -- (2) la migración previa
    raise exception 'Antes de la 052 hace falta la 051: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. La clave de cada atleta y lo que recuerda el reloj
-- ---------------------------------------------------------------------
create table if not exists public.reloj (
  atleta_id       uuid primary key references public.atletas(id) on delete cascade,
  huella          text not null,
  unidad          text not null default 'kg',
  desde           timestamptz not null default now(),
  ultimo          timestamptz,                  -- la última vez que se usó desde el reloj
  sesion_id       uuid references public.sesiones(id) on delete set null,   -- la que eligió en el reloj
  saltados        uuid[] not null default '{}', -- pautas (sesion_ejercicios) que saltó en esa sesión
  actualizado_en  timestamptz not null default now()
);
alter table public.reloj drop constraint if exists reloj_valido;
alter table public.reloj add constraint reloj_valido check (
  huella ~ '^[0-9a-f]{64}$' and unidad in ('kg', 'lb') and cardinality(saltados) <= 100
);
create unique index if not exists reloj_huella_idx on public.reloj (huella);
comment on table public.reloj is 'Modo reloj (Apple Watch con Atajos): la huella de la clave de cada atleta, su unidad y lo que recuerda el reloj. Solo por sus funciones.';

-- El atajo del coach para el reloj, junto a los de la 051
alter table public.atajos_coach drop constraint if exists atajos_coach_valido;
alter table public.atajos_coach add constraint atajos_coach_valido check (
  clave in ('salud', 'entreno', 'reloj') and url ~ '^https://www\.icloud\.com/shortcuts/[0-9A-Za-z]{16,64}$'
);
create or replace function public.atajo_guardar(p_clave text, p_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_url text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  if p_clave not in ('salud', 'entreno', 'reloj') then raise exception 'Atajo no válido'; end if;
  if v_url is null then delete from public.atajos_coach where clave = p_clave; return; end if;
  insert into public.atajos_coach (clave, url) values (p_clave, v_url)
  on conflict (clave) do update set url = excluded.url, actualizado_en = now();
end $$;
comment on function public.atajo_guardar(text, text) is 'El coach guarda (o, vacío, quita) el enlace de iCloud de uno de sus atajos (salud, entreno o reloj).';

-- ---------------------------------------------------------------------
-- 2. Lo que usa el atleta
-- ---------------------------------------------------------------------
create or replace function public.reloj_mio() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_atleta uuid := public.mi_atleta_id(); r public.reloj;
begin
  if v_atleta is null then return null; end if;
  select * into r from public.reloj where atleta_id = v_atleta;
  return jsonb_build_object('activo', r.atleta_id is not null, 'desde', r.desde, 'ultimo', r.ultimo, 'unidad', coalesce(r.unidad, 'kg'),
    'atajo', (select a.url from public.atajos_coach a where a.clave = 'reloj'));
end $$;
comment on function public.reloj_mio() is 'El modo reloj del atleta (sin la clave): si lo tiene, desde cuándo, la última vez, su unidad y el atajo de su coach.';

create or replace function public.reloj_crear(p_unidad text default 'kg') returns text
language plpgsql security definer set search_path = '' as $$
declare v_atleta uuid := public.mi_atleta_id(); v_clave text;
begin
  if v_atleta is null then raise exception 'Solo el atleta conecta lo suyo'; end if;
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then
    raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada';
  end if;
  if coalesce(p_unidad, 'kg') not in ('kg', 'lb') then raise exception 'Unidad no válida'; end if;
  v_clave := encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex');
  insert into public.reloj (atleta_id, huella, unidad) values (v_atleta, fbe_privado.huella(v_clave), coalesce(p_unidad, 'kg'))
  on conflict (atleta_id) do update set huella = excluded.huella, unidad = excluded.unidad, desde = now(), ultimo = null,
    sesion_id = null, saltados = '{}', actualizado_en = now();
  return v_clave;
end $$;
comment on function public.reloj_crear(text) is 'Crea la clave del modo reloj (la anterior deja de valer) y la devuelve una sola vez.';

create or replace function public.reloj_unidad(p_unidad text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_atleta uuid := public.mi_atleta_id();
begin
  if v_atleta is null then raise exception 'Solo el atleta cambia lo suyo'; end if;
  if p_unidad not in ('kg', 'lb') then raise exception 'Unidad no válida'; end if;
  update public.reloj set unidad = p_unidad, actualizado_en = now() where atleta_id = v_atleta;
end $$;
comment on function public.reloj_unidad(text) is 'Kilos o libras en el reloj.';

create or replace function public.reloj_quitar() returns void
language plpgsql security definer set search_path = '' as $$
declare v_atleta uuid := public.mi_atleta_id();
begin
  if v_atleta is null then raise exception 'Solo el atleta desconecta lo suyo'; end if;
  delete from public.reloj where atleta_id = v_atleta;
end $$;
comment on function public.reloj_quitar() is 'Quita el modo reloj (la clave deja de valer). Las series que apuntó desde el reloj son suyas y se quedan.';

-- ---------------------------------------------------------------------
-- 3. Solo para la función «reloj» (con la clave de servicio)
-- ---------------------------------------------------------------------
-- El atleta de una clave (si vale y no está de baja). Apunta la última vez.
create or replace function fbe_privado.reloj_de(p_clave text, out r public.reloj, out baja boolean)
language plpgsql security definer set search_path = '' as $$
begin
  baja := false;
  if coalesce(p_clave, '') !~ '^[0-9a-f]{64}$' then return; end if;
  select * into r from public.reloj where huella = fbe_privado.huella(p_clave);
  if r.atleta_id is null then return; end if;
  baja := exists (select 1 from public.atletas where id = r.atleta_id and estado = 'baja');
  -- no más de una escritura por minuto solo para apuntar la última vez
  if r.ultimo is null or r.ultimo < now() - interval '1 minute' then
    update public.reloj set ultimo = now() where atleta_id = r.atleta_id;
  end if;
end $$;

-- ¿Es suya esta sesión y se puede entrenar? (de una semana publicada de un bloque suyo, no plantilla ni cancelado)
create or replace function fbe_privado.reloj_sesion_valida(p_atleta uuid, p_sesion uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sesiones s join public.semanas w on w.id = s.semana_id join public.bloques b on b.id = w.bloque_id
                 where s.id = p_sesion and b.atleta_id = p_atleta and not b.es_plantilla and b.estado <> 'cancelado' and w.programacion = 'programada');
$$;

-- La sesión que toca: la elegida (p_sesion o la que recuerda el reloj) si sigue sin hacer; si no, la que tiene series
-- de hoy sin terminar; si no, la de hoy (día previsto); si no, la primera sin hacer de la semana en curso.
create or replace function fbe_privado.reloj_sesion_que_toca(p_atleta uuid, p_elegida uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_hoy date := (now() at time zone 'Europe/Madrid')::date; v uuid;
begin
  if p_elegida is not null and fbe_privado.reloj_sesion_valida(p_atleta, p_elegida)
     and not (select completada from public.sesiones where id = p_elegida) then return p_elegida; end if;
  -- con series de hoy y sin terminar
  select s.id into v from public.series x join public.sesion_ejercicios se on se.id = x.sesion_ejercicio_id join public.sesiones s on s.id = se.sesion_id
    where x.atleta_id = p_atleta and (x.registrada_en at time zone 'Europe/Madrid')::date = v_hoy and not s.completada
      and fbe_privado.reloj_sesion_valida(p_atleta, s.id)
    order by x.registrada_en desc limit 1;
  if v is not null then return v; end if;
  -- las de las semanas publicadas en curso (la más reciente que ya ha empezado)
  select s.id into v from public.sesiones s join public.semanas w on w.id = s.semana_id join public.bloques b on b.id = w.bloque_id
    where b.atleta_id = p_atleta and not b.es_plantilla and b.estado <> 'cancelado' and w.programacion = 'programada' and not s.completada
      and w.fecha_inicio is not null and w.fecha_inicio <= v_hoy
    order by w.fecha_inicio desc, (s.dia_previsto = v_hoy) desc nulls last, s.dia_previsto nulls last, s.orden limit 1;
  return v;
end $$;

create or replace function public.reloj_estado(p_clave text, p_sesion uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  x record; r public.reloj; v_sesion uuid; s public.sesiones; v_salud boolean; v_foco text; v_semana uuid;
begin
  select * into x from fbe_privado.reloj_de(p_clave);
  r := x.r;
  if r.atleta_id is null then return jsonb_build_object('ok', false, 'error', 'clave'); end if;
  if x.baja then return jsonb_build_object('ok', false, 'error', 'baja'); end if;
  v_sesion := fbe_privado.reloj_sesion_que_toca(r.atleta_id, coalesce(p_sesion, r.sesion_id));
  -- Al cambiar de sesión, se olvida lo saltado en la anterior
  if v_sesion is distinct from r.sesion_id and cardinality(r.saltados) > 0 then
    update public.reloj set saltados = '{}', sesion_id = null where atleta_id = r.atleta_id;
    r.saltados := '{}';
  end if;
  if v_sesion is null then
    return jsonb_build_object('ok', true, 'unidad', r.unidad, 'sesion', null, 'otras', '[]'::jsonb);
  end if;
  select * into s from public.sesiones where id = v_sesion;
  v_semana := s.semana_id;
  select foco into v_foco from public.semanas where id = v_semana;
  v_salud := public.consentimiento_salud_de_atleta(r.atleta_id);
  return jsonb_build_object(
    'ok', true, 'unidad', r.unidad, 'saltados', to_jsonb(r.saltados),
    'progresion_auto', coalesce((select a.progresion_auto from public.atletas a where a.id = r.atleta_id), true),
    'foco', v_foco,
    -- «¿Cómo llegas hoy?» es un dato de salud: sin su consentimiento, no se usa
    'preparacion', case when v_salud then s.preparacion else null end,
    'sesion', jsonb_build_object('id', s.id, 'nombre', s.nombre, 'tipo', s.tipo, 'completada', s.completada, 'dia_previsto', s.dia_previsto),
    'ejercicios', coalesce((select jsonb_agg(jsonb_build_object(
        'id', se.id, 'ejercicio_id', se.ejercicio_id, 'orden', se.orden, 'superserie', se.superserie, 'series', se.series,
        'reps_min', se.reps_min, 'reps_max', se.reps_max, 'rir_objetivo', se.rir_objetivo, 'rpe_objetivo', se.rpe_objetivo,
        'carga_sugerida_kg', se.carga_sugerida_kg, 'descanso_seg', se.descanso_seg, 'backoff_pct', se.backoff_pct,
        'series_detalle', se.series_detalle, 'notas_coach', se.notas_coach,
        'ejercicio', jsonb_build_object('id', e.id, 'nombre', e.nombre, 'tipo', to_jsonb(e.tipo))) order by se.orden)
      from public.sesion_ejercicios se join public.ejercicios e on e.id = se.ejercicio_id where se.sesion_id = s.id), '[]'::jsonb),
    'hechas', coalesce((select jsonb_agg(jsonb_build_object('sesion_ejercicio_id', h.sesion_ejercicio_id, 'numero', h.numero, 'kg', h.kg,
        'reps', h.reps, 'rpe', h.rpe, 'rir', h.rir, 'sustituto_id', h.sustituto_id, 'registrada_en', h.registrada_en) order by h.registrada_en)
      from public.series h join public.sesion_ejercicios se on se.id = h.sesion_ejercicio_id where se.sesion_id = s.id), '[]'::jsonb),
    -- Su última vez en cada ejercicio (en otra sesión): las series de aquella sesión y lo que tenía pautado
    'ultimas', coalesce((select jsonb_object_agg(u.ejercicio_id, u.datos) from (
        select pe.ejercicio_id, (
          select jsonb_build_object('sesion_id', ult.sesion_id,
            'series', (select jsonb_agg(jsonb_build_object('numero', z.numero, 'kg', z.kg, 'reps', z.reps, 'rpe', z.rpe, 'rir', z.rir) order by z.numero)
                       from public.series z join public.sesion_ejercicios zp on zp.id = z.sesion_ejercicio_id
                       where zp.sesion_id = ult.sesion_id and coalesce(z.sustituto_id, zp.ejercicio_id) = pe.ejercicio_id and z.atleta_id = r.atleta_id),
            'pauta', case when ult.sustituto_id is null then jsonb_build_object('carga_sugerida_kg', ult.carga_sugerida_kg, 'reps_min', ult.reps_min, 'reps_max', ult.reps_max) end)
          from (select yp.sesion_id, y.sustituto_id, yp.carga_sugerida_kg, yp.reps_min, yp.reps_max
                from public.series y join public.sesion_ejercicios yp on yp.id = y.sesion_ejercicio_id
                where y.atleta_id = r.atleta_id and yp.sesion_id <> s.id and coalesce(y.sustituto_id, yp.ejercicio_id) = pe.ejercicio_id
                order by y.registrada_en desc limit 1) ult) as datos
        from (select distinct se.ejercicio_id from public.sesion_ejercicios se where se.sesion_id = s.id) pe) u where u.datos is not null), '{}'::jsonb),
    -- Las otras sesiones sin hacer de esa semana (para elegir otra desde el reloj)
    'otras', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'nombre', o.nombre, 'tipo', o.tipo) order by o.orden)
      from public.sesiones o where o.semana_id = v_semana and not o.completada and o.id <> s.id), '[]'::jsonb));
end $$;
comment on function public.reloj_estado(text, uuid) is 'Solo la función «reloj»: la sesión que toca de un atleta (con su clave), su pauta, lo hecho y su última vez.';

-- Guarda una serie (como al marcarla en el móvil: si ya estaba, la cambia)
create or replace function public.reloj_serie(p_clave text, p_pauta uuid, p_numero int, p_kg numeric, p_reps int, p_rir numeric default null, p_sustituto uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare x record; r public.reloj; v_sesion uuid; v_series int;
begin
  select * into x from fbe_privado.reloj_de(p_clave);
  r := x.r;
  if r.atleta_id is null then return jsonb_build_object('ok', false, 'error', 'clave'); end if;
  if x.baja then return jsonb_build_object('ok', false, 'error', 'baja'); end if;
  select se.sesion_id, se.series into v_sesion, v_series from public.sesion_ejercicios se where se.id = p_pauta;
  if v_sesion is null or not fbe_privado.reloj_sesion_valida(r.atleta_id, v_sesion) then return jsonb_build_object('ok', false, 'error', 'sesion'); end if;
  if (select completada from public.sesiones where id = v_sesion) then return jsonb_build_object('ok', false, 'error', 'terminada'); end if;
  if p_numero is null or p_numero < 1 or p_numero > greatest(v_series, 1) + 10 then return jsonb_build_object('ok', false, 'error', 'datos'); end if;
  if (p_kg is not null and (p_kg < 0 or p_kg > 9999)) or (p_reps is not null and (p_reps < 0 or p_reps > 1000)) or (p_rir is not null and (p_rir < 0 or p_rir > 10))
     or (p_kg is null and p_reps is null) then
    return jsonb_build_object('ok', false, 'error', 'datos');
  end if;
  if p_sustituto is not null and not exists (select 1 from public.ejercicios where id = p_sustituto) then p_sustituto := null; end if;
  insert into public.series as z (sesion_ejercicio_id, atleta_id, numero, kg, reps, rir, sustituto_id, nota)
    values (p_pauta, r.atleta_id, p_numero, round(p_kg, 2), p_reps, p_rir, p_sustituto, null)
  on conflict (sesion_ejercicio_id, numero) do update set kg = excluded.kg, reps = excluded.reps, rir = excluded.rir,
    sustituto_id = coalesce(excluded.sustituto_id, z.sustituto_id), registrada_en = now();
  update public.reloj set sesion_id = v_sesion, actualizado_en = now() where atleta_id = r.atleta_id and sesion_id is distinct from v_sesion;
  return jsonb_build_object('ok', true, 'sesion_id', v_sesion);
end $$;
comment on function public.reloj_serie(text, uuid, int, numeric, int, numeric, uuid) is 'Solo la función «reloj»: guarda una serie del atleta (con su clave).';

create or replace function public.reloj_saltar(p_clave text, p_pauta uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare x record; r public.reloj; v_sesion uuid;
begin
  select * into x from fbe_privado.reloj_de(p_clave);
  r := x.r;
  if r.atleta_id is null then return jsonb_build_object('ok', false, 'error', 'clave'); end if;
  if x.baja then return jsonb_build_object('ok', false, 'error', 'baja'); end if;
  select se.sesion_id into v_sesion from public.sesion_ejercicios se where se.id = p_pauta;
  if v_sesion is null or not fbe_privado.reloj_sesion_valida(r.atleta_id, v_sesion) then return jsonb_build_object('ok', false, 'error', 'sesion'); end if;
  update public.reloj set
    saltados = case when sesion_id is distinct from v_sesion then array[p_pauta] when p_pauta = any(saltados) then saltados else (saltados || p_pauta)[1:100] end,
    sesion_id = v_sesion, actualizado_en = now()
  where atleta_id = r.atleta_id;
  return jsonb_build_object('ok', true);
end $$;
comment on function public.reloj_saltar(text, uuid) is 'Solo la función «reloj»: el atleta salta un ejercicio en el reloj (lo que queda de él ya no se le propone en esa sesión).';

create or replace function public.reloj_elegir(p_clave text, p_sesion uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare x record; r public.reloj;
begin
  select * into x from fbe_privado.reloj_de(p_clave);
  r := x.r;
  if r.atleta_id is null then return jsonb_build_object('ok', false, 'error', 'clave'); end if;
  if x.baja then return jsonb_build_object('ok', false, 'error', 'baja'); end if;
  if not fbe_privado.reloj_sesion_valida(r.atleta_id, p_sesion) then return jsonb_build_object('ok', false, 'error', 'sesion'); end if;
  update public.reloj set sesion_id = p_sesion, saltados = case when sesion_id is distinct from p_sesion then '{}' else saltados end, actualizado_en = now()
    where atleta_id = r.atleta_id;
  return jsonb_build_object('ok', true);
end $$;
comment on function public.reloj_elegir(text, uuid) is 'Solo la función «reloj»: el atleta elige en el reloj otra sesión de su semana.';

-- La marca como hecha: hoy, con su esfuerzo (1–10) y su duración (de la primera serie a ahora, si no se dice)
create or replace function public.reloj_terminar(p_clave text, p_sesion uuid, p_rpe numeric default null, p_minutos int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare x record; r public.reloj; v_min int; v_primera timestamptz;
begin
  select * into x from fbe_privado.reloj_de(p_clave);
  r := x.r;
  if r.atleta_id is null then return jsonb_build_object('ok', false, 'error', 'clave'); end if;
  if x.baja then return jsonb_build_object('ok', false, 'error', 'baja'); end if;
  if not fbe_privado.reloj_sesion_valida(r.atleta_id, p_sesion) then return jsonb_build_object('ok', false, 'error', 'sesion'); end if;
  if (select completada from public.sesiones where id = p_sesion) then return jsonb_build_object('ok', false, 'error', 'terminada'); end if;
  if p_rpe is not null and (p_rpe < 1 or p_rpe > 10) then return jsonb_build_object('ok', false, 'error', 'datos'); end if;
  select min(h.registrada_en) into v_primera from public.series h join public.sesion_ejercicios se on se.id = h.sesion_ejercicio_id where se.sesion_id = p_sesion;
  v_min := coalesce(p_minutos, case when v_primera is not null then ceil(extract(epoch from now() - v_primera) / 60)::int end);
  if v_min is not null and (v_min < 1 or v_min > 600) then v_min := null; end if;
  update public.sesiones set completada = true, fecha_realizada = coalesce(fecha_realizada, (now() at time zone 'Europe/Madrid')::date),
    rpe_sesion = coalesce(round(p_rpe, 1), rpe_sesion), duracion_min = coalesce(v_min, duracion_min)
  where id = p_sesion;
  update public.reloj set sesion_id = null, saltados = '{}', actualizado_en = now() where atleta_id = r.atleta_id;
  return jsonb_build_object('ok', true, 'minutos', v_min);
end $$;
comment on function public.reloj_terminar(text, uuid, numeric, int) is 'Solo la función «reloj»: el atleta termina la sesión desde el reloj.';

-- Nadie toca la tabla directamente
alter table public.reloj enable row level security;
revoke all on public.reloj from public, anon, authenticated;

-- Permisos (como al final de 003 a 051). Lo de la función «reloj», solo la clave de servicio.
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb), public.salud_recibir(text, jsonb), public.calendario_de(text),
  public.reloj_estado(text, uuid), public.reloj_serie(text, uuid, int, numeric, int, numeric, uuid), public.reloj_saltar(text, uuid),
  public.reloj_elegir(text, uuid), public.reloj_terminar(text, uuid, numeric, int) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (52)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
