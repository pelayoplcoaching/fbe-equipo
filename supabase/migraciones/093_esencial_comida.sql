-- =====================================================================
-- FBE Equipo, migración 093: FBE Esencial, la comida de quien va por su cuenta (nivel con nutrición)
--
-- Por qué: en el nivel «Entrenamiento y nutrición» de FBE Esencial nadie hace el plan a mano. El atleta contesta unas
-- preguntas (sexo, edad, altura, peso, cuánto se mueve, su objetivo y si tiene o ha tenido un trastorno de la conducta
-- alimentaria) y la base calcula su plan de partida igual que la calculadora del coach (planInicial() de
-- logica/nutricion.js: Mifflin-St Jeor × actividad con el ritmo de su objetivo; proteína, grasa e hidratos). Cada semana,
-- la app propone el ajuste con su gasto estimado (el mismo que ve el coach) y la base lo guarda solo si cabe en los topes.
-- Decisiones de Pelayo (24/11): perder, −0,5 % del peso por semana; mantener; ganar, +0,25 %; en kcal y macros; con
-- antecedente de trastorno de la conducta alimentaria, mantener y sin bajadas solas.
--   * cuestionarios.tca: el antecedente de trastorno de la conducta alimentaria (dato de salud: con su consentimiento).
--   * esencial_plan_comida(p, p_atleta): el plan de partida (o rehacerlo, si cambia de objetivo o se equivocó), con su
--     peso de hoy si aún no lo había apuntado.
--   * esencial_ajuste_comida(p, p_atleta): el ajuste de la semana: una vez por semana (su último plan, de hace 7 días o
--     más), ±300 kcal como mucho, nunca por debajo de 1.200, la misma proteína, el mismo objetivo y, con antecedente de
--     trastorno de la conducta alimentaria, sin bajar.
--   Para quien lleva seguimiento no cambia nada (su plan lo sigue haciendo el coach).
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 092 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 93 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 093 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 93;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 92) then  -- (2) la anterior
    raise exception 'Falta la migración 092 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. El antecedente de trastorno de la conducta alimentaria, en su cuestionario (dato de salud)
-- ---------------------------------------------------------------------
alter table public.cuestionarios add column if not exists tca boolean;

-- La misma función de siempre (la última, de la 011 y siguientes), con `tca` entre los datos de salud que piden el
-- consentimiento. No cuenta para el cribado ni deja el cuestionario por revisar.
create or replace function public.cuestionario_preparar() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_coach boolean := public.es_coach();
  v_app boolean := current_user in ('authenticated', 'anon');
  v_prev public.cuestionarios;
  v_pide_consentimiento boolean;
  v_cambia_salud boolean;
begin
  if tg_op = 'UPDATE' and new.atleta_id is distinct from old.atleta_id then
    raise exception 'Un cuestionario no se puede pasar a otro atleta' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    v_prev := old;
  else
    select * into v_prev from public.cuestionarios c where c.atleta_id = new.atleta_id;
  end if;
  -- Un valor de salud nuevo (distinto del que había y no vacío) pide el consentimiento
  v_pide_consentimiento :=
       (new.activo is not null and new.activo is distinct from v_prev.activo)
    or (new.enfermedad is not null and new.enfermedad is distinct from v_prev.enfermedad)
    or (new.enfermedad_detalle is not null and new.enfermedad_detalle is distinct from v_prev.enfermedad_detalle)
    or (new.sintomas is not null and new.sintomas is distinct from v_prev.sintomas)
    or (new.otras is not null and new.otras is distinct from v_prev.otras)
    or (new.medicacion_detalle is not null and new.medicacion_detalle is distinct from v_prev.medicacion_detalle)
    or (new.lesiones is not null and new.lesiones is distinct from v_prev.lesiones)
    or (new.alergias is not null and new.alergias is distinct from v_prev.alergias)
    or (new.tca is not null and new.tca is distinct from v_prev.tca);  -- (093)
  if v_app and v_pide_consentimiento and not public.consentimiento_salud_de_atleta(new.atleta_id) then
    raise exception 'Para responder lo de salud hace falta el consentimiento de datos de salud del atleta' using errcode = '42501';
  end if;
  v_cambia_salud := tg_op = 'UPDATE'
    and (new.activo, new.enfermedad, new.enfermedad_detalle, new.sintomas, new.otras, new.medicacion_detalle, new.lesiones, new.alergias)
        is distinct from (old.activo, old.enfermedad, old.enfermedad_detalle, old.sintomas, old.otras, old.medicacion_detalle,
                          old.lesiones, old.alergias);
  new.resultado := public.resultado_cribado(new.activo, new.enfermedad, new.sintomas);
  if v_app and not v_coach then
    new.revisado_en := case when tg_op = 'UPDATE' then old.revisado_en end;
    new.pedido_en := case when tg_op = 'UPDATE' then old.pedido_en end;
  end if;
  -- La petición y la revisión del coach, con la hora de la base (no la de su móvil), como la de completado
  if v_app and v_coach then
    if new.pedido_en is not null and (tg_op = 'INSERT' or new.pedido_en is distinct from old.pedido_en) then new.pedido_en := now(); end if;
    if new.revisado_en is not null and (tg_op = 'INSERT' or new.revisado_en is distinct from old.revisado_en) then new.revisado_en := now(); end if;
  end if;
  if v_cambia_salud then new.revisado_en := null; end if;
  -- Completado: la fecha la pone la base
  if new.completado_en is not null and (tg_op = 'INSERT' or new.completado_en is distinct from old.completado_en) then
    new.completado_en := now();
  end if;
  if v_app and v_coach and tg_op = 'UPDATE' and new.completado_en is distinct from old.completado_en then
    new.completado_en := old.completado_en;  -- lo completa el atleta, no el coach
  end if;
  new.actualizado_en := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. El plan de partida, como planInicial() de logica/nutricion.js
-- ---------------------------------------------------------------------
-- (con números de coma flotante y el redondeo de JavaScript, Math.round, para que salga exactamente igual que en la app)
create or replace function fbe_privado.js_round(x double precision) returns double precision
language sql immutable set search_path = '' as $$ select floor(x + 0.5) $$;

-- p_fase: perder, mantener o ganar (con antecedente de TCA, siempre mantener). Devuelve basal, mantenimiento, ritmo_pct,
-- kcal, proteina_g, carbos_g y grasa_g.
create or replace function fbe_privado.esencial_plan_calcular(p_sexo text, p_edad double precision, p_altura double precision,
  p_peso double precision, p_actividad double precision, p_fase text)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  v_ritmo double precision := case p_fase when 'perder' then -0.5 when 'ganar' then 0.25 else 0 end;
  v_basal double precision;
  v_ref double precision;
  v_mant double precision;
  v_kcal double precision;
  v_prot double precision;
  v_grasa double precision;
  v_carb double precision;
begin
  v_basal := fbe_privado.js_round(10 * p_peso + 6.25::double precision * p_altura - 5 * p_edad + case when p_sexo = 'mujer' then -161 else 5 end);
  -- (con mucho peso, la proteína y la grasa se cuentan sobre el peso de un IMC de 25)
  v_ref := least(p_peso, fbe_privado.js_round(25 * ((p_altura / 100) * (p_altura / 100)) * 10) / 10);
  v_mant := fbe_privado.js_round(v_basal * p_actividad);
  v_kcal := greatest(1200, fbe_privado.js_round((v_mant + (v_ritmo / 100) * p_peso * 7700 / 7) / 50) * 50);
  v_prot := fbe_privado.js_round(((case when p_fase = 'perder' then 2.0 else 1.8 end)::double precision * v_ref) / 5) * 5;
  v_grasa := fbe_privado.js_round((0.8::double precision * v_ref) / 5) * 5;
  if (v_kcal - 4 * v_prot - 9 * v_grasa) / 4 < 50 then
    v_grasa := greatest(ceil(0.5::double precision * v_ref), floor((v_kcal - 4 * v_prot - 200) / 9));
  end if;
  if (v_kcal - 4 * v_prot - 9 * v_grasa) / 4 < 50 then
    v_prot := greatest(fbe_privado.js_round((1.6::double precision * v_ref) / 5) * 5, floor((v_kcal - 9 * v_grasa - 200) / 4));
  end if;
  v_carb := greatest(50, fbe_privado.js_round(((v_kcal - 4 * v_prot - 9 * v_grasa) / 4) / 5) * 5);
  v_kcal := fbe_privado.js_round(4 * v_prot + 4 * v_carb + 9 * v_grasa);
  if v_kcal < 1200 then
    v_carb := v_carb + fbe_privado.js_round(((1200 - v_kcal) / 4) / 5) * 5 + 5;
    v_kcal := fbe_privado.js_round(4 * v_prot + 4 * v_carb + 9 * v_grasa);
  end if;
  return jsonb_build_object('basal', v_basal, 'mantenimiento', v_mant, 'ritmo_pct', v_ritmo, 'kcal', v_kcal,
                            'proteina_g', v_prot, 'carbos_g', v_carb, 'grasa_g', v_grasa);
end $$;

-- Lo común de las dos funciones: quién puede (el atleta, o el coach), que vaya por su cuenta, con nutrición y con su
-- consentimiento de salud
create or replace function fbe_privado.esencial_comida_quien(p_atleta uuid)
returns uuid language plpgsql stable set search_path = '' as $$
declare
  v_id uuid := coalesce(p_atleta, public.mi_atleta_id());
  v_at public.atletas;
begin
  if v_id is null then raise exception 'No hay atleta' using errcode = 'P0002'; end if;
  if not public.es_coach() and public.mi_atleta_id() is distinct from v_id then
    raise exception 'Solo puedes tocar tu propio plan' using errcode = '42501';
  end if;
  select * into v_at from public.atletas where id = v_id;
  if not found then raise exception 'Ese atleta no existe' using errcode = 'P0002'; end if;
  if v_at.modalidad <> 'por_su_cuenta' then raise exception 'Solo para quien va por su cuenta (FBE Esencial)' using errcode = '22023'; end if;
  if v_at.estado <> 'activo' then raise exception 'Su cuenta no está activa' using errcode = '22023'; end if;
  if not coalesce(v_at.nutricion, false) then raise exception 'Su plan no lleva nutrición' using errcode = '22023'; end if;
  if not public.consentimiento_salud_de_atleta(v_id) then raise exception 'Hace falta tu consentimiento de salud' using errcode = '22023'; end if;
  return v_id;
end $$;

-- p: { sexo: 'hombre' | 'mujer', edad (18-90), altura (130-220 cm), peso (35-250 kg), actividad (1.4, 1.55, 1.7 o
-- 1.85), objetivo: 'perder' | 'mantener' | 'ganar', tca: true | false }. Devuelve el plan (con su id, fase y desde).
create or replace function public.esencial_plan_comida(p jsonb, p_atleta uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := fbe_privado.esencial_comida_quien(p_atleta);
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_sexo text := p ->> 'sexo';
  v_obj text := p ->> 'objetivo';
  v_edad double precision;
  v_altura double precision;
  v_peso double precision;
  v_act double precision;
  v_tca boolean;
  v_fase text;
  v_plan jsonb;
  v_plan_id uuid;
begin
  begin
    v_edad := (p ->> 'edad')::double precision;
    v_altura := (p ->> 'altura')::double precision;
    v_peso := (p ->> 'peso')::double precision;
    v_act := (p ->> 'actividad')::double precision;
    v_tca := (p ->> 'tca')::boolean;
  exception when others then
    raise exception 'Revisa tus datos' using errcode = '22023';
  end;
  if v_sexo is null or v_sexo not in ('hombre', 'mujer') or v_edad is null or v_edad not between 18 and 90
     or v_altura is null or v_altura not between 130 and 220 or v_peso is null or v_peso not between 35 and 250
     or v_act is null or v_act not in (1.4, 1.55, 1.7, 1.85) or v_obj is null or v_obj not in ('perder', 'mantener', 'ganar') or v_tca is null then
    raise exception 'Revisa tus datos: sexo, edad (18 a 90), altura (130 a 220 cm), peso (35 a 250 kg), cuánto te mueves, tu objetivo y la pregunta de salud' using errcode = '22023';
  end if;
  -- Con antecedente de trastorno de la conducta alimentaria: mantener (sin déficit)
  v_fase := case when v_tca then 'mantener' else v_obj end;
  update public.cuestionarios set tca = v_tca where atleta_id = v_id;
  if not found then raise exception 'Antes, el cuestionario' using errcode = '22023'; end if;
  v_plan := fbe_privado.esencial_plan_calcular(v_sexo, v_edad, v_altura, v_peso, v_act, v_fase);
  insert into public.planes_nutricion (atleta_id, desde, modo, fase, ritmo_pct, kcal, proteina_g, carbos_g, grasa_g, motivo)
  values (v_id, v_hoy, 'macros', v_fase, (v_plan ->> 'ritmo_pct')::numeric, (v_plan ->> 'kcal')::int, (v_plan ->> 'proteina_g')::int,
          (v_plan ->> 'carbos_g')::int, (v_plan ->> 'grasa_g')::int,
          case when v_tca then 'Plan de partida para mantener tu peso (con tu antecedente, sin déficit).' else 'Plan de partida, con tus datos.' end)
  on conflict (atleta_id, desde) do update set modo = excluded.modo, fase = excluded.fase, ritmo_pct = excluded.ritmo_pct, kcal = excluded.kcal,
    proteina_g = excluded.proteina_g, carbos_g = excluded.carbos_g, grasa_g = excluded.grasa_g, fibra_g = null, kcal_descanso = null,
    carbos_descanso_g = null, grasa_descanso_g = null, motivo = excluded.motivo
  returning id into v_plan_id;
  -- Su peso de hoy, si aún no lo había apuntado (lo usa el gasto estimado)
  insert into public.pesos (atleta_id, fecha, kg) values (v_id, v_hoy, round(v_peso::numeric, 2)) on conflict (atleta_id, fecha) do nothing;
  return v_plan || jsonb_build_object('id', v_plan_id, 'fase', v_fase, 'desde', v_hoy);
end $$;

-- p: { kcal, proteina_g, carbos_g, grasa_g, motivo } (lo que propone la app con ajusteNutricion). Devuelve el id del
-- plan nuevo, o null si aún no toca (su último plan es de hace menos de 7 días).
create or replace function public.esencial_ajuste_comida(p jsonb, p_atleta uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := fbe_privado.esencial_comida_quien(p_atleta);
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_ult public.planes_nutricion;
  v_tca boolean;
  v_kcal int; v_prot int; v_carb int; v_grasa int;
  v_motivo text := nullif(left(btrim(coalesce(p ->> 'motivo', '')), 280), '');
  v_nuevo uuid;
begin
  perform pg_advisory_xact_lock(hashtext('fbe-esencial-comida:' || v_id::text));
  select * into v_ult from public.planes_nutricion where atleta_id = v_id and desde <= v_hoy order by desde desc limit 1;
  if not found then raise exception 'Antes, tu plan de partida' using errcode = '22023'; end if;
  if v_ult.desde > v_hoy - 7 then return null; end if;   -- (una vez por semana: aún no toca)
  if v_ult.modo <> 'macros' or v_ult.kcal is null or v_ult.kcal_descanso is not null then
    raise exception 'Este plan no se ajusta solo' using errcode = '22023';
  end if;
  begin
    v_kcal := (p ->> 'kcal')::int; v_prot := (p ->> 'proteina_g')::int; v_carb := (p ->> 'carbos_g')::int; v_grasa := (p ->> 'grasa_g')::int;
  exception when others then
    raise exception 'Ese ajuste no vale' using errcode = '22023';
  end;
  select coalesce(tca, false) into v_tca from public.cuestionarios where atleta_id = v_id;
  -- Los topes: ±300 kcal (y lo que mueve redondear los hidratos), nunca por debajo de 1.200 (con ese redondeo), la misma
  -- proteína, la grasa igual o menos (para que quepan los hidratos), las kcal cuadrando con los macros y, con antecedente
  -- de trastorno de la conducta alimentaria, sin bajar
  if v_kcal is null or v_prot is null or v_carb is null or v_grasa is null
     or v_kcal < 1190 or abs(v_kcal - v_ult.kcal) > 320
     or v_prot is distinct from v_ult.proteina_g
     or v_grasa < 10 or v_grasa > v_ult.grasa_g or v_carb < 0
     or abs(v_kcal - (4 * v_prot + 4 * v_carb + 9 * v_grasa)) > 5
     or (coalesce(v_tca, false) and v_kcal < v_ult.kcal) then
    raise exception 'Ese ajuste se sale de los topes' using errcode = '22023';
  end if;
  insert into public.planes_nutricion (atleta_id, desde, modo, fase, ritmo_pct, kcal, proteina_g, carbos_g, grasa_g, fibra_g, pautas, motivo)
  values (v_id, v_hoy, 'macros', v_ult.fase, v_ult.ritmo_pct, v_kcal, v_prot, v_carb, v_grasa, v_ult.fibra_g, v_ult.pautas,
          coalesce(v_motivo, 'Ajuste de la semana'))
  returning id into v_nuevo;
  return v_nuevo;
end $$;

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 092)
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
revoke all on all functions in schema fbe_privado from public, anon, authenticated;
-- (revisión de la 072) la comprobación de las columnas de música la usa una restricción: el servidor (service_role) también tiene que poder llamarla
grant execute on function fbe_privado.musica_url_valida(text) to service_role;

insert into public.fbe_migraciones (numero) values (93)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
