-- =====================================================================
-- FBE Equipo, migración 076: Los objetivos que propone el atleta
--
-- Por qué: hasta ahora los objetivos los ponía solo el coach en la ficha. Con esta migración el atleta contesta un
-- cuestionario de objetivos (ahora y al empezar cada bloque) y lo que escribe le llega al coach como propuesta: el coach
-- la acepta (ajustando la cifra o la fecha si quiere) o la descarta. Solo lo aceptado sale como objetivo.
--
--   * objetivos: su tipo ('fuerza', 'peso', 'carrera' o 'libre'; null en los de antes), el peso al que quiere llegar y
--     el de partida, la distancia y el tiempo de una carrera, y si lo propuso el atleta. Los permisos no cambian: el
--     coach los gestiona y el atleta solo los lee.
--   * objetivos_propuestos: lo que propone el atleta (hasta 5 pendientes). Todo por funciones (la tabla no se lee
--     directamente): el atleta propone, ve las suyas y retira las pendientes; el coach ve las de todos y las resuelve.
--   * objetivos_rondas: cuándo contestó el cuestionario por última vez (también si dijo que sigue con los mismos).
--
-- El peso al que quiere llegar es un dato de salud: solo se propone con el consentimiento de datos de salud.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 075 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 76 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 076 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 76;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 75) then  -- (2) la anterior
    raise exception 'Falta la migración 075 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Los objetivos, con su tipo
-- ---------------------------------------------------------------------
alter table public.objetivos add column if not exists tipo text;
alter table public.objetivos add column if not exists peso_objetivo numeric(5,2);
alter table public.objetivos add column if not exists peso_inicio numeric(5,2);
alter table public.objetivos add column if not exists distancia_km numeric(6,2);
alter table public.objetivos add column if not exists tiempo_seg integer;
alter table public.objetivos add column if not exists propuesto_por_atleta boolean not null default false;
alter table public.objetivos drop constraint if exists objetivos_tipo_valido;
alter table public.objetivos add constraint objetivos_tipo_valido check (
  (tipo is null or tipo in ('fuerza', 'peso', 'carrera', 'libre'))
  and (peso_objetivo is null or peso_objetivo between 30 and 300)
  and (peso_inicio is null or peso_inicio between 30 and 300)
  and (distancia_km is null or distancia_km between 0.1 and 500)
  and (tiempo_seg is null or tiempo_seg between 30 and 360000)
  and (tipo is distinct from 'peso' or peso_objetivo is not null)
  and (tipo is distinct from 'carrera' or (distancia_km is not null and tiempo_seg is not null))
);

-- ---------------------------------------------------------------------
-- 2. Lo que propone el atleta
-- ---------------------------------------------------------------------
create table if not exists public.objetivos_propuestos (
  id uuid primary key default gen_random_uuid(),
  atleta_id uuid not null references public.atletas(id) on delete cascade,
  tipo text not null,
  ejercicio_id uuid references public.ejercicios(id) on delete set null,
  kg numeric(6,2),
  reps smallint,
  peso_kg numeric(5,2),
  distancia_km numeric(6,2),
  tiempo_seg integer,
  titulo text,
  motivo text,
  fecha date,
  estado text not null default 'pendiente',
  nota_coach text,
  objetivo_id uuid references public.objetivos(id) on delete set null,
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz
);
alter table public.objetivos_propuestos drop constraint if exists objetivos_propuestos_validos;
alter table public.objetivos_propuestos add constraint objetivos_propuestos_validos check (
  tipo in ('fuerza', 'peso', 'carrera', 'libre')
  and estado in ('pendiente', 'aceptada', 'descartada')
  and (kg is null or kg between 0.5 and 1000)
  and (reps is null or reps between 1 and 12)
  and (peso_kg is null or peso_kg between 30 and 300)
  and (distancia_km is null or distancia_km between 0.1 and 500)
  and (tiempo_seg is null or tiempo_seg between 30 and 360000)
  and (titulo is null or char_length(titulo) between 1 and 80)
  and (motivo is null or char_length(motivo) between 1 and 200)
  and (nota_coach is null or char_length(nota_coach) between 1 and 200)
  and (tipo <> 'peso' or peso_kg is not null)
  and (tipo <> 'carrera' or (distancia_km is not null and tiempo_seg is not null))
  and (tipo <> 'libre' or titulo is not null)
);
create index if not exists objetivos_propuestos_atleta on public.objetivos_propuestos (atleta_id, estado);
alter table public.objetivos_propuestos enable row level security;
revoke all on public.objetivos_propuestos from public, anon, authenticated;

create table if not exists public.objetivos_rondas (
  atleta_id uuid primary key references public.atletas(id) on delete cascade,
  contestado_en timestamptz not null default now()
);
alter table public.objetivos_rondas enable row level security;
revoke all on public.objetivos_rondas from public, anon, authenticated;

create or replace function fbe_privado.propuesta_json(p public.objetivos_propuestos) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'atleta_id', p.atleta_id, 'tipo', p.tipo, 'ejercicio_id', p.ejercicio_id,
    'ejercicio', (select e.nombre from public.ejercicios e where e.id = p.ejercicio_id),
    'kg', p.kg, 'reps', p.reps, 'peso_kg', p.peso_kg, 'distancia_km', p.distancia_km, 'tiempo_seg', p.tiempo_seg,
    'titulo', p.titulo, 'motivo', p.motivo, 'fecha', p.fecha, 'estado', p.estado, 'nota_coach', p.nota_coach,
    'objetivo_id', p.objetivo_id, 'creado_en', p.creado_en, 'resuelto_en', p.resuelto_en);
$$;

-- Lo del atleta: cuándo contestó y sus propuestas (las pendientes y las resueltas en los últimos 30 días; con p_todo, todas)
create or replace function fbe_privado.propuestas_de(p_atleta uuid, p_todo boolean) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'contestado_en', (select r.contestado_en from public.objetivos_rondas r where r.atleta_id = p_atleta),
    'propuestas', coalesce((select jsonb_agg(fbe_privado.propuesta_json(p) order by p.creado_en, p.id) from public.objetivos_propuestos p
      where p.atleta_id = p_atleta and (p_todo or p.estado = 'pendiente' or p.resuelto_en > now() - interval '30 days')), '[]'::jsonb));
$$;

create or replace function public.objetivos_propuestas_mias(p_todo boolean default false) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_atleta uuid := public.mi_atleta_id();
begin
  if v_atleta is null then raise exception 'Solo el atleta ve sus propuestas' using errcode = '42501'; end if;
  return fbe_privado.propuestas_de(v_atleta, coalesce(p_todo, false));
end $$;

-- El atleta contesta el cuestionario: de 0 a 5 propuestas (ninguna: sigue con los mismos). Como mucho, 5 pendientes
create or replace function public.objetivos_proponer(p_propuestas jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_atleta uuid := public.mi_atleta_id();
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  x jsonb;
  v_tipo text; v_ejercicio uuid; v_kg numeric; v_reps numeric; v_peso numeric; v_km numeric; v_seg numeric;
  v_titulo text; v_motivo text; v_fecha date; v_n integer := 0;
begin
  if v_atleta is null or public.es_coach() then raise exception 'Solo el atleta propone sus objetivos' using errcode = '42501'; end if;
  if public.esta_de_baja() then raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada'; end if;
  if p_propuestas is null or jsonb_typeof(p_propuestas) <> 'array' or jsonb_array_length(p_propuestas) > 5 then
    raise exception 'Como mucho, 5 objetivos a la vez' using errcode = '22023';
  end if;
  -- una cosa a la vez por atleta (el tope de 5 pendientes)
  perform pg_advisory_xact_lock(hashtext('fbe-objetivos:' || v_atleta::text));
  if (select count(*) from public.objetivos_propuestos where atleta_id = v_atleta and estado = 'pendiente') + jsonb_array_length(p_propuestas) > 5 then
    raise exception 'Ya tienes 5 objetivos esperando a tu coach: retira alguno o espera a que conteste' using errcode = '22023';
  end if;
  for x in select * from jsonb_array_elements(p_propuestas) loop
    -- cada clave con su tipo (o nada)
    if jsonb_typeof(x) <> 'object'
       or exists (select 1 from jsonb_each(x) e where e.key in ('tipo', 'ejercicio_id', 'titulo', 'motivo', 'fecha') and jsonb_typeof(e.value) not in ('string', 'null'))
       or exists (select 1 from jsonb_each(x) e where e.key in ('kg', 'reps', 'peso_kg', 'distancia_km', 'tiempo_seg') and jsonb_typeof(e.value) not in ('number', 'null')) then
      raise exception 'Esos datos no valen' using errcode = '22023';
    end if;
    v_tipo := x ->> 'tipo';
    if v_tipo is null or v_tipo not in ('fuerza', 'peso', 'carrera', 'libre') then raise exception 'Tipo de objetivo no válido' using errcode = '22023'; end if;
    v_ejercicio := null; v_kg := null; v_reps := null; v_peso := null; v_km := null; v_seg := null;
    v_titulo := fbe_privado.texto_limpio(x ->> 'titulo');
    v_motivo := fbe_privado.texto_limpio(x ->> 'motivo');
    if char_length(v_titulo) > 80 then raise exception 'El objetivo, como mucho 80 caracteres' using errcode = '22023'; end if;
    if char_length(v_motivo) > 200 then raise exception 'El porqué, como mucho 200 caracteres' using errcode = '22023'; end if;
    -- (revisión) la fecha, solo como AAAA-MM-DD (ni «today» ni otros formatos)
    if x ->> 'fecha' is not null and x ->> 'fecha' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Fecha no válida' using errcode = '22023'; end if;
    begin v_fecha := (x ->> 'fecha')::date; exception when others then raise exception 'Fecha no válida' using errcode = '22023'; end;
    if v_fecha is not null and (v_fecha < v_hoy or v_fecha > v_hoy + 730) then raise exception 'La fecha tiene que estar entre hoy y dentro de dos años' using errcode = '22023'; end if;
    if v_tipo = 'fuerza' then
      begin v_ejercicio := (x ->> 'ejercicio_id')::uuid; exception when others then raise exception 'Ese ejercicio no existe' using errcode = '22023'; end;
      if v_ejercicio is null or not exists (select 1 from public.ejercicios where id = v_ejercicio) then raise exception 'Elige el ejercicio' using errcode = '22023'; end if;
      v_kg := (x ->> 'kg')::numeric; v_reps := (x ->> 'reps')::numeric;
      if v_kg is null or v_kg < 0.5 or v_kg > 1000 then raise exception 'Los kilos, entre 0,5 y 1000' using errcode = '22023'; end if;
      if v_reps is null or v_reps <> trunc(v_reps) or v_reps < 1 or v_reps > 12 then raise exception 'Las repeticiones, de 1 a 12' using errcode = '22023'; end if;
      v_titulo := null;
    elsif v_tipo = 'peso' then
      if not public.consentimiento_salud_de_atleta(v_atleta) then
        raise exception 'Para proponer un peso hace falta tu consentimiento de datos de salud (Perfil)' using errcode = '42501';
      end if;
      v_peso := (x ->> 'peso_kg')::numeric;
      if v_peso is null or v_peso < 30 or v_peso > 300 then raise exception 'El peso, entre 30 y 300 kg' using errcode = '22023'; end if;
      v_titulo := null;
    elsif v_tipo = 'carrera' then
      v_km := (x ->> 'distancia_km')::numeric; v_seg := (x ->> 'tiempo_seg')::numeric;
      if v_km is null or v_km < 0.1 or v_km > 500 then raise exception 'La distancia, entre 0,1 y 500 km' using errcode = '22023'; end if;
      if v_seg is null or v_seg <> trunc(v_seg) or v_seg < 30 or v_seg > 360000 then raise exception 'El tiempo no vale' using errcode = '22023'; end if;
      v_titulo := null;
    else
      if v_titulo is null then raise exception 'Escribe tu objetivo' using errcode = '22023'; end if;
    end if;
    -- en el orden en que las escribió (todas son de la misma transacción: un microsegundo más cada una)
    insert into public.objetivos_propuestos (atleta_id, tipo, ejercicio_id, kg, reps, peso_kg, distancia_km, tiempo_seg, titulo, motivo, fecha, creado_en)
      values (v_atleta, v_tipo, v_ejercicio, round(v_kg, 2), v_reps::smallint, round(v_peso, 2), round(v_km, 2), v_seg::integer, v_titulo, v_motivo, v_fecha, now() + v_n * interval '1 microsecond');
    v_n := v_n + 1;
  end loop;
  insert into public.objetivos_rondas (atleta_id, contestado_en) values (v_atleta, now())
    on conflict (atleta_id) do update set contestado_en = excluded.contestado_en;
  return fbe_privado.propuestas_de(v_atleta, false);
end $$;

-- El atleta retira una propuesta suya que aún espera
create or replace function public.objetivo_propuesta_retirar(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.objetivos_propuestos;
begin
  -- (revisión) con cerrojo: si el coach la contesta a la vez, no se borra una ya contestada
  select * into v from public.objetivos_propuestos where id = p_id for update;
  if v.id is null then return; end if;
  if v.atleta_id is distinct from public.mi_atleta_id() then raise exception 'Eso no es tuyo' using errcode = '42501'; end if;
  if public.esta_de_baja() then raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada'; end if;
  if v.estado <> 'pendiente' then raise exception 'Tu coach ya la ha contestado' using errcode = '22023'; end if;
  delete from public.objetivos_propuestos where id = p_id and estado = 'pendiente';
end $$;

-- El coach: las que esperan (de todos o de un atleta)
create or replace function public.objetivos_propuestas_pendientes(p_atleta uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Solo el coach' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(fbe_privado.propuesta_json(p) order by p.creado_en, p.id) from public.objetivos_propuestos p
    where p.estado = 'pendiente' and (p_atleta is null or p.atleta_id = p_atleta)), '[]'::jsonb);
end $$;

-- El coach la resuelve: aceptada (con el objetivo que ha creado para ese atleta) o descartada (con una nota, si quiere)
create or replace function public.objetivo_propuesta_resolver(p_id uuid, p_aceptar boolean, p_objetivo uuid default null, p_nota text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.objetivos_propuestos; v_nota text := fbe_privado.texto_limpio(p_nota);
begin
  if not public.es_coach() then raise exception 'Solo el coach' using errcode = '42501'; end if;
  if p_aceptar is null then raise exception 'Di si la aceptas o no' using errcode = '22023'; end if;
  if char_length(v_nota) > 200 then raise exception 'La nota, como mucho 200 caracteres' using errcode = '22023'; end if;
  select * into v from public.objetivos_propuestos where id = p_id for update;
  if v.id is null then raise exception 'Esa propuesta no existe' using errcode = '22023'; end if;
  if v.estado <> 'pendiente' then raise exception 'Esa propuesta ya estaba contestada' using errcode = '22023'; end if;
  if p_aceptar and (p_objetivo is null or not exists (select 1 from public.objetivos o where o.id = p_objetivo and o.atleta_id = v.atleta_id)) then
    raise exception 'Falta el objetivo de ese atleta' using errcode = '22023';
  end if;
  -- (revisión) un objetivo de peso solo se acepta si el atleta mantiene su consentimiento de datos de salud
  if p_aceptar and v.tipo = 'peso' and not public.consentimiento_salud_de_atleta(v.atleta_id) then
    raise exception 'Ha retirado su consentimiento de datos de salud: un objetivo de peso no se puede aceptar' using errcode = '42501';
  end if;
  update public.objetivos_propuestos set estado = case when p_aceptar then 'aceptada' else 'descartada' end,
    objetivo_id = case when p_aceptar then p_objetivo else null end, nota_coach = v_nota, resuelto_en = now()
    where id = p_id returning * into v;
  return fbe_privado.propuesta_json(v);
end $$;

comment on function public.objetivos_propuestas_mias(boolean) is 'El atleta: cuándo contestó el cuestionario de objetivos y sus propuestas.';
comment on function public.objetivos_proponer(jsonb) is 'El atleta contesta el cuestionario de objetivos: de 0 a 5 propuestas para su coach (5 pendientes como mucho).';
comment on function public.objetivo_propuesta_retirar(uuid) is 'El atleta retira una propuesta suya que aún espera.';
comment on function public.objetivos_propuestas_pendientes(uuid) is 'El coach: las propuestas de objetivo que esperan (de todos o de un atleta).';
comment on function public.objetivo_propuesta_resolver(uuid, boolean, uuid, text) is 'El coach acepta (con el objetivo creado) o descarta una propuesta.';

-- La copia completa del coach, también con las propuestas
create or replace function public.copia_privada() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  return jsonb_build_object(
    'personal_atleta', coalesce((select jsonb_agg(to_jsonb(t)) from public.personal_atleta t), '[]'::jsonb),
    'mensajes_coach', coalesce((select jsonb_agg(to_jsonb(t)) from public.mensajes_coach t), '[]'::jsonb),
    'musica_coach', coalesce((select jsonb_agg(to_jsonb(t)) from public.musica_coach t), '[]'::jsonb),
    'integraciones', coalesce((select jsonb_agg(to_jsonb(t) - 'salud_huella' - 'calendario_huella') from public.integraciones t), '[]'::jsonb),
    'salud_diaria', coalesce((select jsonb_agg(to_jsonb(t)) from public.salud_diaria t), '[]'::jsonb),
    'salud_copias', coalesce((select jsonb_agg(to_jsonb(t)) from public.salud_copias t), '[]'::jsonb),
    'atajos_coach', coalesce((select jsonb_agg(to_jsonb(t)) from public.atajos_coach t), '[]'::jsonb),
    'contacto_atleta', coalesce((select jsonb_agg(to_jsonb(t)) from public.contacto_atleta t), '[]'::jsonb),
    'agenda_vida', coalesce((select jsonb_agg(to_jsonb(t)) from public.agenda_vida t), '[]'::jsonb),
    'musica_sesion', coalesce((select jsonb_agg(to_jsonb(t)) from public.musica_sesion t), '[]'::jsonb),
    'musica_aperturas_lista', coalesce((select jsonb_agg(to_jsonb(t)) from public.musica_aperturas_lista t), '[]'::jsonb),
    'musica_biblioteca', coalesce((select jsonb_agg(to_jsonb(t)) from public.musica_biblioteca t), '[]'::jsonb),
    'musica_retos', coalesce((select jsonb_agg(to_jsonb(t)) from public.musica_retos t), '[]'::jsonb),
    'portadas', coalesce((select jsonb_agg(to_jsonb(t)) from public.portadas t), '[]'::jsonb),
    'objetivos_propuestos', coalesce((select jsonb_agg(to_jsonb(t)) from public.objetivos_propuestos t), '[]'::jsonb),
    'objetivos_rondas', coalesce((select jsonb_agg(to_jsonb(t)) from public.objetivos_rondas t), '[]'::jsonb));
end $$;
comment on function public.copia_privada() is 'Para la copia completa del coach: las tablas de la 050 y la 051 (sin las huellas de los enlaces), la agenda (069), la música 3 (072), las portadas (073) y las propuestas de objetivo (076). Solo el coach.';

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 075)
-- ---------------------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb), public.salud_recibir(text, jsonb), public.calendario_de(text) from public, anon, authenticated;
revoke execute on function public.sesion_video_proteger(), public.guia_tocar(), public.novedad_tocar() from public, anon, authenticated;
revoke execute on function public.crear_recordatorios_apuntes(timestamptz) from public, anon, authenticated;
revoke execute on function public.novedad_audio_fuera() from public, anon, authenticated;
revoke execute on function public.mensaje_coach_audio_fuera() from public, anon, authenticated;
-- (073) la de la cola de las portadas es de un trigger: nadie la llama
revoke execute on function public.portada_fuera() from public, anon, authenticated;
-- (las del reloj, si están)
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('reloj_estado', 'reloj_serie', 'reloj_saltar', 'reloj_elegir', 'reloj_terminar') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;
-- (revisión de la 072) la comprobación de las columnas de música la usa una restricción: el servidor (service_role) también tiene que poder llamarla
grant execute on function fbe_privado.musica_url_valida(text) to service_role;

insert into public.fbe_migraciones (numero) values (76)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
