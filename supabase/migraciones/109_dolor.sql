-- =====================================================================
-- FBE Equipo, migración 109: el motor de molestias de FBE Esencial, la base (la escala de 0 a 10 y las zonas del
-- cuestionario de lesiones)
--
-- Por qué (reglas de Pelayo del 26/11/2026, formulario 2, bloque A; «claude/motores-siguientes-reglas.md» y
-- «claude/motores-plan.md»):
--   * molestias (la de siempre, la del check-in): admite también el valor de 0 a 10 (M1, el semáforo del dolor de la web)
--     y las zonas del cuestionario de lesiones (M2: cuello, hombro, codo, muñeca y mano, cadera, rodilla, tobillo y pie;
--     espalda alta, zona lumbar y otra ya estaban). La intensidad de siempre (0 a 3) sigue y, con valor, va con él: 0 → 0,
--     1-2 → 1, 3-5 → 2 y 6-10 → 3 (así el panel, la ficha, los avisos urgentes y el motor de progresión la siguen leyendo).
--     Los atletas con seguimiento siguen como estaban (sus zonas, de 0 a 3, sin valor).
--   * dolor_registros: lo que apunta fuera del check-in: en «Me duele algo» y, con una molestia abierta, antes y después
--     de una sesión que carga esa zona, durante, a la mañana siguiente y el seguimiento de los 3 y los 7 días (M3, M12).
--     Zona, valor de 0 a 10, momento, fecha y, si la hay, la sesión. Dato de salud: solo con su consentimiento (lo escribe
--     apuntar_dolor). Lo ven él y su coach; lo borra él (también sin consentimiento). Uno por zona, día, momento y sesión: si
--     lo vuelve a apuntar, se queda el último.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 108 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 109 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 109 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 109;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 108) then  -- (2) la anterior
    raise exception 'Falta la migración 108 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. La tabla de siempre: el valor de 0 a 10 y las zonas del cuestionario de lesiones
-- ---------------------------------------------------------------------
alter table public.molestias add column if not exists valor smallint;
comment on column public.molestias.valor is 'FBE Esencial (109): de 0 a 10 (el semáforo del dolor). Con valor, la intensidad de siempre va con él: 0, 1-2 leve, 3-5 moderada, 6-10 grave.';
alter table public.molestias drop constraint if exists molestias_valor_valido;
alter table public.molestias add constraint molestias_valor_valido check (
  valor is null or (valor between 0 and 10 and intensidad = case when valor = 0 then 0 when valor <= 2 then 1 when valor <= 5 then 2 else 3 end)
);
alter table public.molestias drop constraint if exists molestias_zona_check;
alter table public.molestias add constraint molestias_zona_check check (zona in (
  'hombros', 'pectoral', 'triceps', 'espalda_alta', 'zona_lumbar', 'femoral_gluteo', 'cuadriceps', 'aductor', 'otra',
  'cuello', 'hombro', 'codo', 'muneca_mano', 'cadera', 'rodilla', 'tobillo_pie'
));

-- ---------------------------------------------------------------------
-- 2. Lo que apunta fuera del check-in (dato de salud: lo escribe apuntar_dolor, con su consentimiento)
-- ---------------------------------------------------------------------
create table if not exists public.dolor_registros (
  id          uuid primary key default gen_random_uuid(),
  atleta_id   uuid not null references public.atletas(id) on delete cascade,
  fecha       date not null default ((now() at time zone 'Europe/Madrid')::date),
  zona        text not null,
  valor       smallint not null,
  momento     text not null,           -- ahora · antes · durante · despues · manana · seguimiento
  sesion_id   uuid references public.sesiones(id) on delete set null,
  creado_en   timestamptz not null default now()
);
comment on table public.dolor_registros is 'FBE Esencial, motor de molestias (109): cada molestia que apunta fuera del check-in (zona, de 0 a 10, momento). La escribe apuntar_dolor().';
alter table public.dolor_registros drop constraint if exists dolor_registros_validos;
alter table public.dolor_registros add constraint dolor_registros_validos check (
  zona in ('cuello', 'hombro', 'codo', 'muneca_mano', 'espalda_alta', 'zona_lumbar', 'cadera', 'rodilla', 'tobillo_pie', 'otra')
  and valor between 0 and 10
  and momento in ('ahora', 'antes', 'durante', 'despues', 'manana', 'seguimiento')
);
create index if not exists dolor_registros_atleta on public.dolor_registros (atleta_id, fecha desc);
alter table public.dolor_registros enable row level security;
drop policy if exists coach_todo on public.dolor_registros;
create policy coach_todo on public.dolor_registros for all to authenticated using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.dolor_registros;
create policy atleta_ver on public.dolor_registros for select to authenticated using (atleta_id = public.mi_atleta_id());
-- (como sus pruebas: lo puede borrar él, también sin consentimiento)
drop policy if exists atleta_borrar on public.dolor_registros;
create policy atleta_borrar on public.dolor_registros for delete to authenticated using (atleta_id = public.mi_atleta_id());
grant select, insert, update, delete on public.dolor_registros to authenticated;

-- p: { zona, valor, momento, sesion_id? }. Uno por zona, día, momento y sesión: si ya estaba, se cambia su valor.
-- Devuelve la fila guardada.
create or replace function public.apuntar_dolor(p jsonb, p_atleta uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := coalesce(p_atleta, public.mi_atleta_id());
  v_zona text := coalesce(p ->> 'zona', '');
  v_momento text := coalesce(p ->> 'momento', '');
  v_valor numeric;
  v_sesion uuid;
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_fila public.dolor_registros;
begin
  if v_id is null then raise exception 'No hay atleta' using errcode = 'P0002'; end if;
  if not public.es_coach() and public.mi_atleta_id() is distinct from v_id then
    raise exception 'Solo puedes apuntar tus propias molestias' using errcode = '42501';
  end if;
  if not exists (select 1 from public.atletas where id = v_id) then raise exception 'Ese atleta no existe' using errcode = 'P0002'; end if;
  if not public.consentimiento_salud_de_atleta(v_id) then raise exception 'Hace falta tu consentimiento de salud' using errcode = '22023'; end if;
  if v_zona not in ('cuello', 'hombro', 'codo', 'muneca_mano', 'espalda_alta', 'zona_lumbar', 'cadera', 'rodilla', 'tobillo_pie', 'otra')
     or v_momento not in ('ahora', 'antes', 'durante', 'despues', 'manana', 'seguimiento')
     or coalesce(jsonb_typeof(p -> 'valor'), '') <> 'number' or coalesce(jsonb_typeof(p -> 'sesion_id'), 'null') not in ('string', 'null') then
    raise exception 'Esa molestia no vale' using errcode = '22023';
  end if;
  v_valor := (p ->> 'valor')::numeric;
  if v_valor < 0 or v_valor > 10 or v_valor <> trunc(v_valor) then raise exception 'Esa molestia no vale' using errcode = '22023'; end if;
  if p ->> 'sesion_id' is not null then
    if (p ->> 'sesion_id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Esa molestia no vale' using errcode = '22023'; end if;
    v_sesion := (p ->> 'sesion_id')::uuid;
    -- la sesión, de uno de sus bloques
    if not exists (select 1 from public.sesiones s join public.semanas w on w.id = s.semana_id join public.bloques b on b.id = w.bloque_id where s.id = v_sesion and b.atleta_id = v_id) then
      raise exception 'Esa sesión no es tuya' using errcode = '42501';
    end if;
  end if;
  update public.dolor_registros set valor = v_valor::smallint, creado_en = now()
    where atleta_id = v_id and zona = v_zona and fecha = v_hoy and momento = v_momento and sesion_id is not distinct from v_sesion
    returning * into v_fila;
  if v_fila.id is null then
    insert into public.dolor_registros (atleta_id, fecha, zona, valor, momento, sesion_id)
    values (v_id, v_hoy, v_zona, v_valor::smallint, v_momento, v_sesion)
    returning * into v_fila;
  end if;
  return to_jsonb(v_fila);
end $$;

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 108)
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
-- (079) la de un trigger: nadie la llama
revoke execute on function public.menu_comida_con_foto() from public, anon, authenticated;
-- (089) las de dos triggers: nadie las llama
revoke execute on function public.carrera_atleta_salud(), public.carrera_manana_comprobar() from public, anon, authenticated;
-- (091) la de un trigger: nadie la llama
revoke execute on function public.atleta_visto_bueno_salud() from public, anon, authenticated;
-- (100) la de un trigger: nadie la llama
revoke execute on function public.esencial_nota_tope() from public, anon, authenticated;
-- (103) las de los disparadores de los ajustes: nadie las llama
revoke execute on function public.esencial_ajuste_hora(), public.esencial_ajuste_registrar() from public, anon, authenticated;
-- (105) la del disparador del perfil de nutrición: nadie la llama
revoke execute on function public.nutricion_perfil_hora() from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;
-- (revisión de la 072) la comprobación de las columnas de música la usa una restricción: el servidor (service_role) también tiene que poder llamarla
grant execute on function fbe_privado.musica_url_valida(text) to service_role;

insert into public.fbe_migraciones (numero) values (109)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
