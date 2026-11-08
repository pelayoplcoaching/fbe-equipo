-- =====================================================================
-- FBE Equipo, migración 051: integraciones (Salud del iPhone, calendario que se actualiza solo y WhatsApp)
--
-- Por qué: la app es una web, y Apple solo deja entrar en Salud a las apps de la App Store. El puente es la app
-- Atajos del iPhone: un atajo que el coach prepara una vez y cada atleta instala con un toque lee de Salud sus
-- pasos, su sueño, su frecuencia cardiaca en reposo, su variabilidad (HRV) y su peso, y los manda a la función
-- «integraciones» con su enlace personal. Con eso el check-in viene relleno, el hábito de pasos se apunta solo y el
-- coach ve cómo duerme sin preguntarle. Otro atajo hace lo contrario: apunta en Salud el entreno que acaba de hacer.
-- Y el calendario: una dirección personal a la que su calendario (el del iPhone o Google) se suscribe; cuando el
-- plan cambia, el calendario cambia solo.
--
-- Qué hace:
--   * integraciones: una fila por atleta con la huella (sha-256) de sus dos enlaces personales (nunca el enlace) y
--     las opciones del calendario. integraciones_mias(): el atleta ve qué tiene conectado y los atajos del coach.
--     integracion_crear(tipo, opciones): crea un enlace nuevo (el anterior deja de valer) y lo devuelve UNA vez.
--     calendario_opciones(opciones): cambia la hora, la duración y el aviso sin cambiar el enlace.
--     integracion_quitar(tipo, borrar): lo desconecta (y, si quiere, borra lo que llegó de Salud).
--   * salud_diaria: un día por fila (pasos, minutos de sueño, FC en reposo, HRV, peso). salud_diaria_de(atleta,
--     desde, hasta): la lee el propio atleta o el coach.
--   * salud_recibir(enlace, días) y calendario_de(enlace): SOLO la función «integraciones» (clave de servicio).
--     salud_recibir guarda los días, apunta los pasos en su hábito de pasos (si lo tiene), las horas de sueño en
--     el de sueño (si no las apuntó él) y el peso en sus pesos (si ese día no hay otro). Hace falta su
--     consentimiento de datos de salud y que no esté de baja.
--   * atajos_coach: los dos enlaces de iCloud de los atajos del coach. atajo_guardar(clave, url): solo el coach.
--   * contacto_atleta: el teléfono de cada atleta para escribirle por WhatsApp. Solo lo ve y lo cambia el coach
--     (contactos(), contacto_guardar(atleta, teléfono)).
-- Nadie lee ni escribe las tablas directamente. Al borrar la ficha de un atleta, lo suyo se va con ella.
-- Sin esta migración, la app no enseña nada de esto y todo lo demás sigue igual.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 050 (o con instalar.sql en una
-- base nueva). Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 51 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 051 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 51;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 50) then  -- (2) la migración previa
    raise exception 'Antes de la 051 hace falta la 050: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Los enlaces personales de cada atleta
-- ---------------------------------------------------------------------
create table if not exists public.integraciones (
  atleta_id          uuid primary key references public.atletas(id) on delete cascade,
  salud_huella       text,
  salud_desde        timestamptz,
  salud_ultimo       timestamptz,       -- la última vez que llegó algo de Salud
  calendario_huella  text,
  calendario_desde   timestamptz,
  calendario_ultimo  timestamptz,       -- la última vez que su calendario pidió los entrenos
  cal_hora           text not null default '18:00',
  cal_minutos        smallint not null default 75,
  cal_aviso          smallint not null default 30,
  actualizado_en     timestamptz not null default now()
);
alter table public.integraciones drop constraint if exists integraciones_valida;
alter table public.integraciones add constraint integraciones_valida check (
  (salud_huella is null or salud_huella ~ '^[0-9a-f]{64}$')
  and (calendario_huella is null or calendario_huella ~ '^[0-9a-f]{64}$')
  and cal_hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  and cal_minutos between 15 and 240
  and cal_aviso between 0 and 1440
);
create unique index if not exists integraciones_salud_idx on public.integraciones (salud_huella) where salud_huella is not null;
create unique index if not exists integraciones_calendario_idx on public.integraciones (calendario_huella) where calendario_huella is not null;
comment on table public.integraciones is 'Los enlaces personales de cada atleta (solo su huella sha-256) para Salud del iPhone y su calendario. Solo por sus funciones.';

create or replace function fbe_privado.huella(p_enlace text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(coalesce(p_enlace, ''), 'UTF8')), 'hex');
$$;

-- ---------------------------------------------------------------------
-- 2. Lo que llega de Salud, un día por fila
-- ---------------------------------------------------------------------
create table if not exists public.salud_diaria (
  atleta_id       uuid not null references public.atletas(id) on delete cascade,
  fecha           date not null,
  pasos           int,
  sueno_min       smallint,
  fc_reposo       smallint,
  hrv             numeric(5,1),
  peso_kg         numeric(5,2),
  actualizado_en  timestamptz not null default now(),
  primary key (atleta_id, fecha)
);
alter table public.salud_diaria drop constraint if exists salud_diaria_valida;
alter table public.salud_diaria add constraint salud_diaria_valida check (
  fecha >= date '2020-01-01' and fecha < date '2100-01-01'
  and (pasos is null or pasos between 0 and 100000)
  and (sueno_min is null or sueno_min between 0 and 1080)
  and (fc_reposo is null or fc_reposo between 25 and 150)
  and (hrv is null or hrv between 0 and 300)
  and (peso_kg is null or peso_kg between 25 and 350)
);
comment on table public.salud_diaria is 'Lo que manda el atajo de Salud del iPhone de cada atleta, un día por fila. Datos de salud: solo por sus funciones.';

-- ---------------------------------------------------------------------
-- 3. Los atajos del coach y el teléfono de cada atleta
-- ---------------------------------------------------------------------
create table if not exists public.atajos_coach (
  clave          text primary key,
  url            text not null,
  actualizado_en timestamptz not null default now()
);
alter table public.atajos_coach drop constraint if exists atajos_coach_valido;
alter table public.atajos_coach add constraint atajos_coach_valido check (
  clave in ('salud', 'entreno') and url ~ '^https://www\.icloud\.com/shortcuts/[0-9A-Za-z]{16,64}$'
);
comment on table public.atajos_coach is 'Los enlaces de iCloud de los atajos del coach (de Salud a la app y de la app a Salud).';

create table if not exists public.contacto_atleta (
  atleta_id      uuid primary key references public.atletas(id) on delete cascade,
  telefono       text not null,
  actualizado_en timestamptz not null default now()
);
alter table public.contacto_atleta drop constraint if exists contacto_atleta_valido;
alter table public.contacto_atleta add constraint contacto_atleta_valido check (telefono ~ '^\+?[0-9]{6,15}$');
comment on table public.contacto_atleta is 'El teléfono de cada atleta, para escribirle por WhatsApp. Solo el coach.';

-- ---------------------------------------------------------------------
-- 4. Lo que usa el atleta
-- ---------------------------------------------------------------------
create or replace function public.integraciones_mias() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_atleta uuid := public.mi_atleta_id(); i public.integraciones;
begin
  if v_atleta is null then return null; end if;
  select * into i from public.integraciones where atleta_id = v_atleta;
  return jsonb_build_object(
    'salud', jsonb_build_object('activa', i.salud_huella is not null, 'desde', i.salud_desde, 'ultimo', i.salud_ultimo),
    'calendario', jsonb_build_object('activo', i.calendario_huella is not null, 'desde', i.calendario_desde, 'ultimo', i.calendario_ultimo,
      'hora', coalesce(i.cal_hora, '18:00'), 'minutos', coalesce(i.cal_minutos, 75), 'aviso', coalesce(i.cal_aviso, 30)),
    'atajos', coalesce((select jsonb_object_agg(a.clave, a.url) from public.atajos_coach a), '{}'::jsonb));
end $$;
comment on function public.integraciones_mias() is 'Qué tiene conectado el atleta (Salud y calendario, sin los enlaces) y los atajos de su coach.';

-- Lee y comprueba las opciones del calendario (lo que falta, como estaba)
create or replace function fbe_privado.opciones_calendario(p jsonb, i public.integraciones) returns public.integraciones
language plpgsql immutable set search_path = '' as $$
declare r public.integraciones := i; v_min int; v_aviso int;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return r; end if;
  if p ? 'hora' then
    if coalesce(p ->> 'hora', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Hora no válida (HH:MM)'; end if;
    r.cal_hora := p ->> 'hora';
  end if;
  begin
    v_min := nullif(p ->> 'minutos', '')::int;
    v_aviso := nullif(p ->> 'aviso', '')::int;
  exception when others then raise exception 'Duración o aviso no válidos'; end;
  if v_min is not null then
    if v_min not between 15 and 240 then raise exception 'La duración va de 15 a 240 minutos'; end if;
    r.cal_minutos := v_min;
  end if;
  if v_aviso is not null then
    if v_aviso not between 0 and 1440 then raise exception 'El aviso va de 0 a 1440 minutos'; end if;
    r.cal_aviso := v_aviso;
  end if;
  return r;
end $$;

create or replace function public.integracion_crear(p_tipo text, p_opciones jsonb default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_atleta uuid := public.mi_atleta_id();
  v_enlace text;
  i public.integraciones;
begin
  if v_atleta is null then raise exception 'Solo el atleta conecta lo suyo'; end if;
  if p_tipo not in ('salud', 'calendario') then raise exception 'Tipo no válido'; end if;
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then
    raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada';
  end if;
  if p_tipo = 'salud' and not public.consentimiento_salud_de_atleta(v_atleta) then
    raise exception 'Para traer datos de Salud hace falta tu consentimiento de datos de salud';
  end if;
  -- 64 caracteres al azar (dos uuid aleatorios y el reloj, pasados por sha-256): imposible de adivinar
  v_enlace := encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex');
  insert into public.integraciones (atleta_id) values (v_atleta) on conflict (atleta_id) do nothing;
  select * into i from public.integraciones where atleta_id = v_atleta for update;
  if p_tipo = 'salud' then
    update public.integraciones set salud_huella = fbe_privado.huella(v_enlace), salud_desde = coalesce(salud_desde, now()), actualizado_en = now()
      where atleta_id = v_atleta;
  else
    i := fbe_privado.opciones_calendario(p_opciones, i);
    update public.integraciones set calendario_huella = fbe_privado.huella(v_enlace), calendario_desde = coalesce(calendario_desde, now()),
      cal_hora = i.cal_hora, cal_minutos = i.cal_minutos, cal_aviso = i.cal_aviso, actualizado_en = now()
      where atleta_id = v_atleta;
  end if;
  return v_enlace;
end $$;
comment on function public.integracion_crear(text, jsonb) is 'Crea el enlace personal de Salud o del calendario (el anterior deja de valer) y lo devuelve una sola vez.';

create or replace function public.calendario_opciones(p_opciones jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_atleta uuid := public.mi_atleta_id(); i public.integraciones;
begin
  if v_atleta is null then raise exception 'Solo el atleta cambia lo suyo'; end if;
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then
    raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada';
  end if;
  insert into public.integraciones (atleta_id) values (v_atleta) on conflict (atleta_id) do nothing;
  select * into i from public.integraciones where atleta_id = v_atleta for update;
  i := fbe_privado.opciones_calendario(p_opciones, i);
  update public.integraciones set cal_hora = i.cal_hora, cal_minutos = i.cal_minutos, cal_aviso = i.cal_aviso, actualizado_en = now()
    where atleta_id = v_atleta;
  return jsonb_build_object('hora', i.cal_hora, 'minutos', i.cal_minutos, 'aviso', i.cal_aviso);
end $$;
comment on function public.calendario_opciones(jsonb) is 'La hora, la duración y el aviso de los entrenos en su calendario (el enlace no cambia).';

create or replace function public.integracion_quitar(p_tipo text, p_borrar boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare v_atleta uuid := public.mi_atleta_id();
begin
  if v_atleta is null then raise exception 'Solo el atleta desconecta lo suyo'; end if;
  if p_tipo = 'salud' then
    update public.integraciones set salud_huella = null, salud_desde = null, salud_ultimo = null, actualizado_en = now() where atleta_id = v_atleta;
    -- Borrar lo que llegó se puede siempre (también de baja)
    if p_borrar then delete from public.salud_diaria where atleta_id = v_atleta; end if;
  elsif p_tipo = 'calendario' then
    update public.integraciones set calendario_huella = null, calendario_desde = null, calendario_ultimo = null, actualizado_en = now() where atleta_id = v_atleta;
  else
    raise exception 'Tipo no válido';
  end if;
end $$;
comment on function public.integracion_quitar(text, boolean) is 'Desconecta Salud o el calendario (el enlace deja de valer); con p_borrar, borra también lo que llegó de Salud.';

-- Lo que llegó de Salud: el propio atleta o el coach. Con la conexión, para la ficha.
create or replace function public.salud_diaria_de(p_atleta uuid, p_desde date default null, p_hasta date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_desde date := coalesce(p_desde, (now() at time zone 'Europe/Madrid')::date - 13);
        v_hasta date := coalesce(p_hasta, (now() at time zone 'Europe/Madrid')::date + 1);
        i public.integraciones;
begin
  if p_atleta is null or not (public.es_coach() or p_atleta = public.mi_atleta_id()) then
    return jsonb_build_object('conectada', false, 'ultimo', null, 'dias', '[]'::jsonb);
  end if;
  if v_hasta - v_desde > 400 then v_desde := v_hasta - 400; end if;
  select * into i from public.integraciones where atleta_id = p_atleta;
  return jsonb_build_object('conectada', coalesce(i.salud_huella is not null, false), 'ultimo', i.salud_ultimo,
    'dias', coalesce((select jsonb_agg(jsonb_build_object('fecha', s.fecha, 'pasos', s.pasos, 'sueno_min', s.sueno_min, 'fc_reposo', s.fc_reposo,
                       'hrv', s.hrv, 'peso_kg', s.peso_kg) order by s.fecha desc)
                     from public.salud_diaria s where s.atleta_id = p_atleta and s.fecha between v_desde and v_hasta), '[]'::jsonb));
end $$;
comment on function public.salud_diaria_de(uuid, date, date) is 'Lo que llegó de Salud de un atleta (él mismo o el coach), del más reciente al más antiguo.';

-- ---------------------------------------------------------------------
-- 5. Solo para la función «integraciones» (con la clave de servicio)
-- ---------------------------------------------------------------------
-- p_dias: [{ fecha: 'AAAA-MM-DD', pasos, sueno_min, fc_reposo, hrv, peso_kg }] (ya limpios en la función; aquí se
-- vuelve a comprobar: lo que se sale de rango se ignora, campo a campo). Como mucho 31 días, de los 60 últimos.
create or replace function public.salud_recibir(p_enlace text, p_dias jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_atleta uuid;
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  d jsonb; v_fecha date; v_pasos int; v_sueno int; v_fc int; v_hrv numeric; v_peso numeric;
  n_dias int := 0; n_habitos int := 0; n_pesos int := 0; n int;
  v_hab_pasos uuid; v_hab_sueno uuid;
begin
  if coalesce(p_enlace, '') !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok', false, 'error', 'enlace'); end if;
  select atleta_id into v_atleta from public.integraciones where salud_huella = fbe_privado.huella(p_enlace);
  if v_atleta is null then return jsonb_build_object('ok', false, 'error', 'enlace'); end if;
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then return jsonb_build_object('ok', false, 'error', 'baja'); end if;
  if not exists (select 1 from public.atletas a join public.consentimientos c on c.perfil_id = a.perfil_id
                 where a.id = v_atleta and c.tipo = 'datos_salud' and c.revocado_en is null) then
    return jsonb_build_object('ok', false, 'error', 'consentimiento');
  end if;
  if p_dias is null or jsonb_typeof(p_dias) <> 'array' or jsonb_array_length(p_dias) = 0 then return jsonb_build_object('ok', false, 'error', 'datos'); end if;
  if jsonb_array_length(p_dias) > 31 then return jsonb_build_object('ok', false, 'error', 'demasiados'); end if;

  -- Sus hábitos de pasos y de sueño (los activos, de número)
  select h.id into v_hab_pasos from public.habitos h
    where h.atleta_id = v_atleta and h.activo and h.tipo = 'numero' and (lower(coalesce(h.unidad, '')) = 'pasos' or h.icono = 'pasos')
    order by h.orden, h.creado_en limit 1;
  select h.id into v_hab_sueno from public.habitos h
    where h.atleta_id = v_atleta and h.activo and h.tipo = 'numero' and h.icono = 'sueno' and lower(coalesce(h.unidad, '')) in ('h', 'horas', 'hora')
    order by h.orden, h.creado_en limit 1;

  for d in select * from jsonb_array_elements(p_dias) loop
    continue when jsonb_typeof(d) <> 'object';
    begin v_fecha := (d ->> 'fecha')::date; exception when others then v_fecha := null; end;
    continue when v_fecha is null or v_fecha < v_hoy - 60 or v_fecha > v_hoy + 1;
    begin v_pasos := round((d ->> 'pasos')::numeric); exception when others then v_pasos := null; end;
    begin v_sueno := round((d ->> 'sueno_min')::numeric); exception when others then v_sueno := null; end;
    begin v_fc := round((d ->> 'fc_reposo')::numeric); exception when others then v_fc := null; end;
    begin v_hrv := round((d ->> 'hrv')::numeric, 1); exception when others then v_hrv := null; end;
    begin v_peso := round((d ->> 'peso_kg')::numeric, 2); exception when others then v_peso := null; end;
    if v_pasos not between 0 and 100000 then v_pasos := null; end if;
    if v_sueno not between 1 and 1080 then v_sueno := null; end if;
    if v_fc not between 25 and 150 then v_fc := null; end if;
    if v_hrv not between 1 and 300 then v_hrv := null; end if;
    if v_peso not between 25 and 350 then v_peso := null; end if;
    continue when v_pasos is null and v_sueno is null and v_fc is null and v_hrv is null and v_peso is null;

    insert into public.salud_diaria as s (atleta_id, fecha, pasos, sueno_min, fc_reposo, hrv, peso_kg)
      values (v_atleta, v_fecha, v_pasos, v_sueno, v_fc, v_hrv, v_peso)
    on conflict (atleta_id, fecha) do update set
      -- los pasos de un día solo suben (un envío a media tarde y otro por la noche); lo demás, lo último que llega
      pasos = greatest(s.pasos, excluded.pasos), sueno_min = coalesce(excluded.sueno_min, s.sueno_min),
      fc_reposo = coalesce(excluded.fc_reposo, s.fc_reposo), hrv = coalesce(excluded.hrv, s.hrv),
      peso_kg = coalesce(excluded.peso_kg, s.peso_kg), actualizado_en = now();
    n_dias := n_dias + 1;

    -- Los pasos, en su hábito de pasos (sin bajar lo que ya apuntó)
    if v_pasos is not null and v_hab_pasos is not null and v_fecha <= v_hoy then
      insert into public.registros_habito as r (habito_id, atleta_id, fecha, valor) values (v_hab_pasos, v_atleta, v_fecha, v_pasos)
      on conflict (habito_id, fecha) do update set valor = greatest(r.valor, excluded.valor) where r.valor < excluded.valor;
      get diagnostics n = row_count; n_habitos := n_habitos + n;
    end if;
    -- Las horas de sueño, en su hábito de sueño si ese día no las apuntó él
    if v_sueno is not null and v_hab_sueno is not null and v_fecha <= v_hoy then
      insert into public.registros_habito (habito_id, atleta_id, fecha, valor) values (v_hab_sueno, v_atleta, v_fecha, round(v_sueno / 60.0, 1))
      on conflict (habito_id, fecha) do nothing;
      get diagnostics n = row_count; n_habitos := n_habitos + n;
    end if;
    -- El peso, en sus pesos si ese día no hay otro
    if v_peso is not null and v_fecha <= v_hoy then
      insert into public.pesos (atleta_id, fecha, kg, notas) values (v_atleta, v_fecha, v_peso, 'Desde Salud')
      on conflict (atleta_id, fecha) do nothing;
      get diagnostics n = row_count; n_pesos := n_pesos + n;
    end if;
  end loop;

  update public.integraciones set salud_ultimo = now() where atleta_id = v_atleta;
  return jsonb_build_object('ok', true, 'dias', n_dias, 'habitos', n_habitos, 'pesos', n_pesos);
end $$;
comment on function public.salud_recibir(text, jsonb) is 'Solo la función «integraciones»: guarda lo que manda el atajo de Salud de un atleta (con su enlace).';

-- Los entrenos con día previsto, de dos semanas atrás a ocho adelante, para su calendario
create or replace function public.calendario_de(p_enlace text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_atleta uuid; i public.integraciones;
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
  if coalesce(p_enlace, '') !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into i from public.integraciones where calendario_huella = fbe_privado.huella(p_enlace);
  if not found then return null; end if;
  v_atleta := i.atleta_id;
  update public.integraciones set calendario_ultimo = now() where atleta_id = v_atleta;
  return jsonb_build_object('hora', i.cal_hora, 'minutos', i.cal_minutos, 'aviso', i.cal_aviso,
    'eventos', case when exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then '[]'::jsonb else
      coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'dia', s.dia_previsto, 'nombre', s.nombre, 'tipo', s.tipo,
                  'descripcion', coalesce(s.dinamica, ''), 'hecha', s.completada) order by s.dia_previsto, s.orden)
                from public.sesiones s
                join public.semanas w on w.id = s.semana_id
                join public.bloques b on b.id = w.bloque_id
                where b.atleta_id = v_atleta and not b.es_plantilla and b.estado <> 'cancelado' and w.programacion = 'programada'
                  and s.dia_previsto is not null and w.fecha_inicio is not null
                  and s.dia_previsto between w.fecha_inicio and w.fecha_inicio + 6
                  and s.dia_previsto between v_hoy - 14 and v_hoy + 56), '[]'::jsonb) end);
end $$;
comment on function public.calendario_de(text) is 'Solo la función «integraciones»: los entrenos con día de un atleta (con su enlace), para su calendario.';

-- ---------------------------------------------------------------------
-- 6. Lo que usa el coach
-- ---------------------------------------------------------------------
create or replace function public.atajos_lista() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  return coalesce((select jsonb_object_agg(a.clave, a.url) from public.atajos_coach a), '{}'::jsonb);
end $$;
comment on function public.atajos_lista() is 'Los enlaces de los atajos del coach. Solo el coach (el atleta los ve en integraciones_mias).';

create or replace function public.atajo_guardar(p_clave text, p_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_url text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  if p_clave not in ('salud', 'entreno') then raise exception 'Atajo no válido'; end if;
  if v_url is null then delete from public.atajos_coach where clave = p_clave; return; end if;
  insert into public.atajos_coach (clave, url) values (p_clave, v_url)
  on conflict (clave) do update set url = excluded.url, actualizado_en = now();
end $$;
comment on function public.atajo_guardar(text, text) is 'El coach guarda (o, vacío, quita) el enlace de iCloud de uno de sus atajos.';

create or replace function public.contactos() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  return coalesce((select jsonb_object_agg(c.atleta_id, c.telefono) from public.contacto_atleta c), '{}'::jsonb);
end $$;
comment on function public.contactos() is 'El teléfono de cada atleta ({ atleta_id: teléfono }). Solo el coach.';

create or replace function public.contacto_guardar(p_atleta uuid, p_telefono text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_tel text := regexp_replace(coalesce(p_telefono, ''), '[[:space:]().-]', '', 'g');
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  if not exists (select 1 from public.atletas where id = p_atleta) then raise exception 'Ese atleta no existe'; end if;
  if v_tel = '' then delete from public.contacto_atleta where atleta_id = p_atleta; return; end if;
  if v_tel ~ '^00' then v_tel := '+' || substr(v_tel, 3); end if;
  if v_tel !~ '^\+?[0-9]{6,15}$' then raise exception 'Teléfono no válido'; end if;
  insert into public.contacto_atleta (atleta_id, telefono) values (p_atleta, v_tel)
  on conflict (atleta_id) do update set telefono = excluded.telefono, actualizado_en = now();
end $$;
comment on function public.contacto_guardar(uuid, text) is 'El coach guarda (o, vacío, quita) el teléfono de un atleta.';

-- Nadie toca las tablas directamente
alter table public.integraciones enable row level security;
alter table public.salud_diaria enable row level security;
alter table public.atajos_coach enable row level security;
alter table public.contacto_atleta enable row level security;
revoke all on public.integraciones, public.salud_diaria, public.atajos_coach, public.contacto_atleta from public, anon, authenticated;

-- Permisos (como al final de 003 a 050). salud_recibir y calendario_de, solo la clave de servicio.
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb), public.salud_recibir(text, jsonb), public.calendario_de(text) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (51)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
