-- =====================================================================
-- FBE Equipo, migración 105: el motor de nutrición (N2): el cuestionario de nutrición y el plan con las reglas nuevas
--
-- Por qué (encargo de Pelayo del 26/11/2026: «Momento de ponernos con el motor de ajuste de nutrición»; reglas R1-R37 del
-- documento del proyecto «claude/nutricion-motor-reglas.md», de sus respuestas a las 40 preguntas):
--   * nutricion_perfiles: lo que contesta en el cuestionario de nutrición que no es de salud (su día, su objetivo, su forma
--     de comer, sus alimentos «sí» y «no»…). Una fila por atleta. La escribe nutricion_plan_motor(); la ven él y el coach.
--   * cuestionarios.nutricion_salud: lo de salud de ese cuestionario (embarazo, lactancia, enfermedad renal, insulina o
--     sulfonilureas, cirugía bariátrica y el SCOFF), en la tabla que ya tiene sus datos de salud (con su consentimiento).
--   * planes_nutricion.mantenimiento: el gasto con el que se calculó cada plan (para el suelo del 25 %).
--   * nutricion_plan_motor(p): el plan de partida con las reglas nuevas (R3-R25): Mifflin (o Cunningham con masa magra por
--     DEXA) por el factor de trabajo, pasos y entreno; su ritmo; los suelos de Pelayo (1.500 kcal en mujeres, 1.800 en
--     hombres y nunca más de un 25 % por debajo del mantenimiento); la proteína de la calculadora de la web sobre el peso
--     de referencia; la grasa entre el 20 y el 35 %; los hidratos con 130 g como poco. Sin plan automático en embarazo,
--     lactancia, IMC por debajo de 18,5, enfermedad renal, insulina o sulfonilureas y cirugía bariátrica; con antecedente
--     de TCA o SCOFF positivo, solo mantener. El mismo cálculo que logica/nutricion-motor.js (planMotor).
--   * nutricion_revision(p): el cambio de la revisión de cada 4 semanas (R28-R33), con sus topes: 28 días desde el último
--     cambio, buena adherencia (20 de 28 días cumplidos y 3 pesadas cada semana), como mucho 250 kcal, la misma proteína,
--     la grasa entre el 20 y el 35 %, nunca por debajo de los suelos y, con antecedente de TCA, sin bajar.
--   * esencial_ajuste_comida (la de la 093), igual salvo que ya no toca los planes del motor (los que tienen mantenimiento):
--     esos no cambian cada semana, se revisan cada 4 (R2). esencial_plan_comida sigue como estaba: la app usa
--     nutricion_plan_motor cuando esta migración está. Para quien lleva seguimiento no cambia nada.
--   El embarazo cuenta también si lo marcó en su cuestionario de entreno (cuestionarios.otras).
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 104 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 105 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 105 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 105;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 104) then  -- (2) la anterior
    raise exception 'Falta la migración 104 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. El perfil de nutrición (no es dato de salud)
-- ---------------------------------------------------------------------
create table if not exists public.nutricion_perfiles (
  atleta_id           uuid primary key references public.atletas(id) on delete cascade,
  sexo                text not null,
  anio_nacimiento     smallint not null,
  altura              numeric(5,1) not null,
  trabajo             text not null,           -- sentado · de_pie · fisico
  pasos               integer not null,        -- 0 · 5000 · 7500 · 10000 (los tramos de la pregunta)
  dias_entreno        smallint not null,
  objetivo            text not null,           -- perder · mantener · ganar
  ritmo_pct           numeric(4,2),            -- al perder, el que eligió (−0,25, −0,5, −0,75 o −1)
  experiencia         text,                    -- novato · intermedio · avanzado (al ganar)
  meta_peso           numeric(5,1),
  meta_cintura        numeric(5,1),
  composicion_metodo  text,                    -- dexa · bioimpedancia · pliegues
  composicion_grasa   numeric(4,1),            -- % de grasa medido
  masa_magra          numeric(5,1),            -- kg, por DEXA (la usa Cunningham)
  bebidas_semana      smallint not null default 0,
  forma_comer         text not null default 'omnivora',
  tomas               smallint not null default 4,
  cocina              text,
  come_fuera          text,
  pocos_hidratos      boolean not null default false,
  alimentos_si        text[] not null default '{}',
  alimentos_no        text[] not null default '{}',
  actualizado_en      timestamptz not null default now()
);
comment on table public.nutricion_perfiles is 'Motor de nutrición: lo que contesta en el cuestionario de nutrición que no es de salud. Lo escribe nutricion_plan_motor().';
alter table public.nutricion_perfiles drop constraint if exists nutricion_perfiles_validos;
alter table public.nutricion_perfiles add constraint nutricion_perfiles_validos check (
  sexo in ('hombre', 'mujer') and anio_nacimiento between 1900 and 2100 and altura between 130 and 220
  and trabajo in ('sentado', 'de_pie', 'fisico') and pasos in (0, 5000, 7500, 10000) and dias_entreno between 0 and 7
  and objetivo in ('perder', 'mantener', 'ganar') and (ritmo_pct is null or ritmo_pct in (-0.25, -0.5, -0.75, -1))
  and (experiencia is null or experiencia in ('novato', 'intermedio', 'avanzado'))
  and (meta_peso is null or meta_peso between 35 and 250) and (meta_cintura is null or meta_cintura between 45 and 200)
  and (composicion_metodo is null or composicion_metodo in ('dexa', 'bioimpedancia', 'pliegues'))
  and (composicion_grasa is null or composicion_grasa between 3 and 70) and (masa_magra is null or masa_magra between 20 and 200)
  and bebidas_semana between 0 and 70 and forma_comer in ('omnivora', 'vegetariana', 'vegana', 'sin_cerdo', 'sin_pescado')
  and tomas between 3 and 5 and (cocina is null or cocina in ('poco', 'algo', 'mucho'))
  and (come_fuera is null or come_fuera in ('no', 'algunos', 'casi_todos'))
  and cardinality(alimentos_si) <= 15 and cardinality(alimentos_no) <= 10
  and coalesce(array_to_string(alimentos_si, ''), '') ~ '^[a-z0-9_]*$' and coalesce(array_to_string(alimentos_no, ''), '') ~ '^[a-z0-9_]*$'
);
drop trigger if exists nutricion_perfil_hora on public.nutricion_perfiles;
create or replace function public.nutricion_perfil_hora() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end $$;
create trigger nutricion_perfil_hora before insert or update on public.nutricion_perfiles for each row execute function public.nutricion_perfil_hora();
alter table public.nutricion_perfiles enable row level security;
drop policy if exists coach_todo on public.nutricion_perfiles;
create policy coach_todo on public.nutricion_perfiles for all to authenticated using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.nutricion_perfiles;
create policy atleta_ver on public.nutricion_perfiles for select to authenticated using (atleta_id = public.mi_atleta_id());
grant select, insert, update, delete on public.nutricion_perfiles to authenticated;

-- ---------------------------------------------------------------------
-- 2. La salud del cuestionario de nutrición (con su consentimiento, en cuestionarios)
-- ---------------------------------------------------------------------
alter table public.cuestionarios add column if not exists nutricion_salud jsonb;
-- (en public, como lesiones_validas: la usa una restricción de cuestionarios, que el atleta escribe)
create or replace function public.nutricion_salud_valida(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select j is null or (jsonb_typeof(j) = 'object'
    and not exists (select 1 from jsonb_object_keys(j) k where k not in ('embarazo', 'lactancia', 'renal', 'insulina', 'bariatrica', 'scoff'))
    and not exists (select 1 from jsonb_each(j) e where e.key <> 'scoff' and jsonb_typeof(e.value) <> 'boolean')
    and (j -> 'scoff' is null or (jsonb_typeof(j -> 'scoff') = 'object'
      and not exists (select 1 from jsonb_each(j -> 'scoff') s where s.key not in ('vomito', 'control', 'perdida', 'gordura', 'domina') or jsonb_typeof(s.value) <> 'boolean'))));
$$;
alter table public.cuestionarios drop constraint if exists cuestionarios_nutricion_salud_valida;
alter table public.cuestionarios add constraint cuestionarios_nutricion_salud_valida check (public.nutricion_salud_valida(nutricion_salud));

-- ---------------------------------------------------------------------
-- 3. El mantenimiento de cada plan (para el suelo del 25 % de las revisiones)
-- ---------------------------------------------------------------------
alter table public.planes_nutricion add column if not exists mantenimiento integer;
alter table public.planes_nutricion drop constraint if exists planes_nutricion_mantenimiento_valido;
alter table public.planes_nutricion add constraint planes_nutricion_mantenimiento_valido check (mantenimiento is null or mantenimiento between 800 and 6000);

-- ---------------------------------------------------------------------
-- 4. El cálculo (el mismo que planMotor de logica/nutricion-motor.js; js_round redondea como Math.round)
-- ---------------------------------------------------------------------
create or replace function fbe_privado.nutricion_plan_calcular(p jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  v_sexo text := p ->> 'sexo';
  v_edad double precision := (p ->> 'edad')::double precision;
  v_altura double precision := (p ->> 'altura')::double precision;
  v_peso double precision := (p ->> 'peso')::double precision;
  v_cintura double precision := (p ->> 'cintura')::double precision;
  v_mm double precision := (p ->> 'masa_magra')::double precision;
  v_pasos double precision := coalesce((p ->> 'pasos')::double precision, 0);
  v_dias double precision := coalesce((p ->> 'dias_entreno')::double precision, 0);
  v_obj text := p ->> 'objetivo';
  v_ritmo_pedido double precision := (p ->> 'ritmo_pct')::double precision;
  v_exp text := coalesce(p ->> 'experiencia', 'intermedio');
  v_pocos boolean := coalesce((p ->> 'pocos_hidratos')::boolean, false);
  v_bebidas double precision := coalesce((p ->> 'bebidas_semana')::double precision, 0);
  v_tomas integer := coalesce((p ->> 'tomas')::integer, 4);
  v_solo_mantener boolean := coalesce((p ->> 'solo_mantener')::boolean, false);
  v_reposo double precision; v_formula text; v_factor double precision; v_mant double precision;
  v_imc double precision; v_a25 double precision; v_ca double precision; v_ref double precision;
  v_ritmo double precision; v_kcal_ritmo double precision; v_kcal double precision; v_limite text;
  v_suelo double precision; v_piso double precision; v_tope double precision;
  v_lo double precision; v_hi double precision; v_gkg double precision; v_prot double precision; v_prot_min double precision;
  v_alc double precision; v_gmin double precision; v_gmax double precision; v_grasa double precision; v_carb double precision; v_g2 double precision; v_p2 double precision;
begin
  if v_solo_mantener then v_obj := 'mantener'; end if;
  -- R8: el gasto en reposo
  if v_mm is not null and v_mm > 20 and v_mm < v_peso then
    v_reposo := fbe_privado.js_round(500 + 22 * v_mm); v_formula := 'cunningham';
  else
    v_reposo := fbe_privado.js_round(10 * v_peso + 6.25::double precision * v_altura - 5 * v_edad + case when v_sexo = 'mujer' then -161 else 5 end); v_formula := 'mifflin';
  end if;
  -- R9: el factor (trabajo + pasos + entreno, como mucho 2)
  v_factor := least(2, fbe_privado.js_round((case p ->> 'trabajo' when 'sentado' then 1.4::double precision when 'de_pie' then 1.55::double precision else 1.7::double precision end
    + case when v_pasos >= 10000 then 0.15::double precision when v_pasos >= 7500 then 0.1::double precision when v_pasos >= 5000 then 0.05::double precision else 0 end
    + case when v_dias >= 5 then 0.15::double precision when v_dias >= 3 then 0.1::double precision when v_dias >= 1 then 0.05::double precision else 0 end) * 100) / 100);
  v_mant := fbe_privado.js_round(v_reposo * v_factor / 10) * 10;
  -- R20: el peso de referencia
  v_imc := fbe_privado.js_round(v_peso / ((v_altura / 100) * (v_altura / 100)) * 10) / 10;
  v_a25 := fbe_privado.js_round(25 * ((v_altura / 100) * (v_altura / 100)) * 10) / 10;
  v_ca := case when v_cintura > 0 then fbe_privado.js_round(v_cintura / v_altura * 100) / 100 end;
  v_ref := case when v_imc >= 30 or (v_imc > 25 and v_ca is not null and v_ca >= 0.5) then least(v_peso, v_a25) else v_peso end;
  -- R11 a R13: el ritmo
  v_ritmo := case v_obj when 'mantener' then 0
    when 'ganar' then case v_exp when 'novato' then 0.5 when 'avanzado' then 0.1 else 0.25 end
    else case when v_ritmo_pedido = -1 and v_imc > 30 then -1 when v_ritmo_pedido in (-0.25, -0.5, -0.75) then v_ritmo_pedido else -0.5 end end;
  -- R14 a R16: las kcal y los suelos (los de Pelayo: 1.500 en mujeres, 1.800 en hombres, y nunca más de un 25 % por debajo)
  v_kcal_ritmo := fbe_privado.js_round(v_mant + (v_ritmo / 100) * v_peso * 7700 / 7);
  if v_obj = 'mantener' or v_ritmo = 0 then
    v_kcal := fbe_privado.js_round(v_mant / 10) * 10;
  elsif v_obj = 'ganar' then
    v_tope := floor(v_mant * 1.2::double precision / 10) * 10;
    if v_kcal_ritmo > v_tope then v_kcal := v_tope; v_limite := 'superavit'; else v_kcal := fbe_privado.js_round(v_kcal_ritmo / 50) * 50; end if;
  else
    v_suelo := case when v_sexo = 'mujer' then 1500 else 1800 end;
    v_piso := greatest(v_suelo, ceil(0.75::double precision * v_mant / 10) * 10);
    if v_piso >= v_mant then
      v_kcal := fbe_privado.js_round(v_mant / 10) * 10; v_limite := 'mantenimiento';
    else
      v_kcal := fbe_privado.js_round(v_kcal_ritmo / 50) * 50;
      if v_kcal < v_piso then v_kcal := v_piso; v_limite := case when v_piso = v_suelo then 'suelo' else 'deficit' end; end if;
      v_kcal := least(v_kcal, fbe_privado.js_round(v_mant / 10) * 10);
    end if;
  end if;
  -- R18 y R19: la proteína (con 40 años o más, la mitad alta) y su centro
  v_lo := case v_obj when 'perder' then 1.8 when 'ganar' then 1.6 else 1.4 end;
  v_hi := case v_obj when 'perder' then 2.4 when 'ganar' then 2.2 else 1.6 end;
  if v_edad >= 40 then v_lo := (v_lo + v_hi) / 2; end if;
  v_gkg := fbe_privado.js_round(((v_lo + v_hi) / 2) * 100) / 100;
  v_prot := fbe_privado.js_round(v_gkg * v_ref / 5) * 5;
  v_prot_min := fbe_privado.js_round(v_lo * v_ref / 5) * 5;
  -- R22, R23 y R25: grasa, hidratos y alcohol
  v_alc := fbe_privado.js_round(v_bebidas * 100 / 7);
  v_gmin := ceil(0.2::double precision * v_kcal / 9 / 5) * 5;
  v_gmax := floor(0.35::double precision * v_kcal / 9 / 5) * 5;
  v_grasa := least(v_gmax, greatest(v_gmin, fbe_privado.js_round(0.8::double precision * v_ref / 5) * 5));
  if not v_pocos and (v_kcal - v_alc - 4 * v_prot - 9 * v_grasa) / 4 < 130 then
    v_g2 := greatest(v_gmin, floor((v_kcal - v_alc - 4 * v_prot - 520) / 9 / 5) * 5);
    if v_g2 < v_grasa then v_grasa := v_g2; end if;
    if (v_kcal - v_alc - 4 * v_prot - 9 * v_grasa) / 4 < 130 then
      v_p2 := greatest(v_prot_min, floor((v_kcal - v_alc - 9 * v_grasa - 520) / 4 / 5) * 5);
      if v_p2 < v_prot then v_prot := v_p2; end if;
    end if;
  end if;
  v_carb := greatest(0, fbe_privado.js_round((v_kcal - v_alc - 4 * v_prot - 9 * v_grasa) / 4));
  while fbe_privado.js_round(4 * v_prot + 4 * v_carb + 9 * v_grasa) + v_alc < v_kcal loop v_carb := v_carb + 1; end loop;
  if v_tomas not in (3, 4, 5) then v_tomas := 4; end if;
  return jsonb_build_object('objetivo', v_obj, 'ritmo_pct', v_ritmo, 'reposo', v_reposo, 'formula', v_formula, 'factor', v_factor,
    'mantenimiento', v_mant, 'limite', v_limite, 'peso_referencia', v_ref,
    'kcal', fbe_privado.js_round(4 * v_prot + 4 * v_carb + 9 * v_grasa) + v_alc, 'proteina_g', v_prot, 'grasa_g', v_grasa, 'carbos_g', v_carb,
    'alcohol_kcal', v_alc, 'fibra_g', 25, 'tomas', v_tomas,
    'proteina_toma_g', greatest(fbe_privado.js_round(0.4::double precision * v_ref / 5) * 5, fbe_privado.js_round(v_prot / v_tomas / 5) * 5));
end $$;

-- ---------------------------------------------------------------------
-- 5. El plan de partida con el cuestionario de nutrición
-- ---------------------------------------------------------------------
-- p: { sexo, edad, altura, peso, cintura, cadera?, trabajo, pasos, dias_entreno, objetivo, ritmo_pct?, experiencia?,
--      meta_peso?, meta_cintura?, composicion_metodo?, composicion_grasa?, masa_magra?, bebidas_semana?, forma_comer?,
--      tomas?, cocina?, come_fuera?, pocos_hidratos?, alimentos_si?, alimentos_no?, tca (sí o no), salud? { embarazo,
--      lactancia, renal, insulina, bariatrica, scoff: { vomito, control, perdida, gordura, domina } } }
-- Devuelve el plan (con su id, objetivo y desde) o { automatico: false, motivo } sin plan. Con una exclusión basta lo
-- básico (sexo, edad, altura, peso, tca y salud): guarda su salud y su peso de hoy, sin perfil ni medidas.
create or replace function public.nutricion_plan_motor(p jsonb, p_atleta uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := fbe_privado.esencial_comida_quien(p_atleta);
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_salud jsonb := nullif(p -> 'salud', 'null'::jsonb);   -- (un null de JSON es «sin salud»)
  v_tca boolean;
  v_edad double precision; v_altura double precision; v_peso double precision; v_cintura double precision; v_cadera double precision;
  v_imc double precision;
  v_motivo text;
  v_scoff integer := 0;
  v_solo boolean;
  v_plan jsonb;
  v_plan_id uuid;
  v_si text[]; v_no text[];
begin
  begin
    v_edad := (p ->> 'edad')::double precision; v_altura := (p ->> 'altura')::double precision; v_peso := (p ->> 'peso')::double precision;
    v_cintura := (p ->> 'cintura')::double precision; v_cadera := (p ->> 'cadera')::double precision; v_tca := (p ->> 'tca')::boolean;
    v_si := coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'alimentos_si', '[]'::jsonb))), '{}');
    v_no := coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'alimentos_no', '[]'::jsonb))), '{}');
  exception when others then
    raise exception 'Revisa tus datos' using errcode = '22023';
  end;
  -- Lo básico, también para una exclusión (el cuestionario para ahí, sin pedirle lo demás): sexo, edad, altura, peso y la salud
  if coalesce(p ->> 'sexo', '') not in ('hombre', 'mujer') or v_edad is null or v_edad not between 18 and 90
     or v_altura is null or v_altura not between 130 and 220 or v_peso is null or v_peso not between 35 and 250
     or v_tca is null or not public.nutricion_salud_valida(v_salud) then
    raise exception 'Revisa tus datos: sexo, edad (18 a 90), altura (130 a 220 cm), peso (35 a 250 kg) y la pregunta de salud' using errcode = '22023';
  end if;
  -- R35: sin plan automático
  v_imc := v_peso / ((v_altura / 100) * (v_altura / 100));
  -- (el embarazo, también si lo marcó en su cuestionario de entreno: no se calcula un déficit con un dato de salud ya dicho)
  v_motivo := case when coalesce((v_salud ->> 'embarazo')::boolean, false)
      or (p ->> 'sexo' = 'mujer' and exists (select 1 from public.cuestionarios c where c.atleta_id = v_id and c.otras @> array['embarazo']::text[])) then 'embarazo'
    when coalesce((v_salud ->> 'lactancia')::boolean, false) then 'lactancia'
    when fbe_privado.js_round(v_imc * 10) / 10 < 18.5 then 'imc_bajo'
    when coalesce((v_salud ->> 'renal')::boolean, false) then 'renal'
    when coalesce((v_salud ->> 'insulina')::boolean, false) then 'insulina'
    when coalesce((v_salud ->> 'bariatrica')::boolean, false) then 'bariatrica' end;
  -- R36: con antecedente de TCA o SCOFF positivo (2 o más «sí»), solo mantener
  select count(*) into v_scoff from jsonb_each(coalesce(v_salud -> 'scoff', '{}'::jsonb)) s where s.value = 'true'::jsonb;
  v_solo := v_tca or v_scoff >= 2;
  -- Lo de salud, en su cuestionario (y el antecedente, donde ya estaba)
  update public.cuestionarios set tca = v_tca, nutricion_salud = v_salud where atleta_id = v_id;
  if not found then raise exception 'Antes, el cuestionario' using errcode = '22023'; end if;
  -- Con una exclusión, hasta aquí: su peso de hoy y, sin plan, el motivo
  if v_motivo is not null then
    insert into public.pesos (atleta_id, fecha, kg) values (v_id, v_hoy, round(v_peso::numeric, 2)) on conflict (atleta_id, fecha) do nothing;
    return jsonb_build_object('automatico', false, 'motivo', v_motivo);
  end if;
  -- El resto, para calcular el plan: su cintura, su trabajo y su objetivo
  if v_cintura is null or v_cintura not between 45 and 200 or (v_cadera is not null and v_cadera not between 50 and 200)
     or coalesce(p ->> 'trabajo', '') not in ('sentado', 'de_pie', 'fisico') or coalesce(p ->> 'objetivo', '') not in ('perder', 'mantener', 'ganar') then
    raise exception 'Revisa tus datos: cintura (45 a 200 cm), tu trabajo y tu objetivo' using errcode = '22023';
  end if;
  -- El perfil (lo que no es de salud)
  begin
    insert into public.nutricion_perfiles (atleta_id, sexo, anio_nacimiento, altura, trabajo, pasos, dias_entreno, objetivo, ritmo_pct, experiencia,
      meta_peso, meta_cintura, composicion_metodo, composicion_grasa, masa_magra, bebidas_semana, forma_comer, tomas, cocina, come_fuera,
      pocos_hidratos, alimentos_si, alimentos_no)
    values (v_id, p ->> 'sexo', extract(year from v_hoy)::int - floor(v_edad)::int, v_altura, p ->> 'trabajo',
      case when coalesce((p ->> 'pasos')::int, 0) >= 10000 then 10000 when coalesce((p ->> 'pasos')::int, 0) >= 7500 then 7500 when coalesce((p ->> 'pasos')::int, 0) >= 5000 then 5000 else 0 end,
      least(7, greatest(0, coalesce((p ->> 'dias_entreno')::int, 0))), p ->> 'objetivo', (p ->> 'ritmo_pct')::numeric, p ->> 'experiencia',
      (p ->> 'meta_peso')::numeric, (p ->> 'meta_cintura')::numeric, p ->> 'composicion_metodo', (p ->> 'composicion_grasa')::numeric,
      case when p ->> 'composicion_metodo' = 'dexa' then (p ->> 'masa_magra')::numeric end, coalesce((p ->> 'bebidas_semana')::int, 0),
      coalesce(p ->> 'forma_comer', 'omnivora'), coalesce((p ->> 'tomas')::int, 4), p ->> 'cocina', p ->> 'come_fuera',
      coalesce((p ->> 'pocos_hidratos')::boolean, false), v_si, v_no)
    on conflict (atleta_id) do update set sexo = excluded.sexo, anio_nacimiento = excluded.anio_nacimiento, altura = excluded.altura,
      trabajo = excluded.trabajo, pasos = excluded.pasos, dias_entreno = excluded.dias_entreno, objetivo = excluded.objetivo,
      ritmo_pct = excluded.ritmo_pct, experiencia = excluded.experiencia, meta_peso = excluded.meta_peso, meta_cintura = excluded.meta_cintura,
      composicion_metodo = excluded.composicion_metodo, composicion_grasa = excluded.composicion_grasa, masa_magra = excluded.masa_magra,
      bebidas_semana = excluded.bebidas_semana, forma_comer = excluded.forma_comer, tomas = excluded.tomas, cocina = excluded.cocina,
      come_fuera = excluded.come_fuera, pocos_hidratos = excluded.pocos_hidratos, alimentos_si = excluded.alimentos_si, alimentos_no = excluded.alimentos_no;
  exception when check_violation or invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Revisa tus datos' using errcode = '22023';
  end;
  -- Su peso y sus medidas de hoy (los usan el gasto real y la revisión)
  insert into public.pesos (atleta_id, fecha, kg) values (v_id, v_hoy, round(v_peso::numeric, 2)) on conflict (atleta_id, fecha) do nothing;
  insert into public.medidas (atleta_id, fecha, cintura_cm, cadera_cm) values (v_id, v_hoy, round(v_cintura::numeric, 1), round(v_cadera::numeric, 1))
    on conflict (atleta_id, fecha) do update set cintura_cm = excluded.cintura_cm, cadera_cm = coalesce(excluded.cadera_cm, public.medidas.cadera_cm);
  v_plan := fbe_privado.nutricion_plan_calcular(p || jsonb_build_object('solo_mantener', v_solo, 'masa_magra', case when p ->> 'composicion_metodo' = 'dexa' then p -> 'masa_magra' end));
  insert into public.planes_nutricion (atleta_id, desde, modo, fase, ritmo_pct, kcal, proteina_g, carbos_g, grasa_g, fibra_g, mantenimiento, motivo)
  values (v_id, v_hoy, 'macros', v_plan ->> 'objetivo', (v_plan ->> 'ritmo_pct')::numeric, (v_plan ->> 'kcal')::int, (v_plan ->> 'proteina_g')::int,
          (v_plan ->> 'carbos_g')::int, (v_plan ->> 'grasa_g')::int, 25, (v_plan ->> 'mantenimiento')::int,
          case when v_solo then 'Plan de partida para mantener tu peso (sin déficit).' else 'Plan de partida, con tu cuestionario de nutrición.' end)
  on conflict (atleta_id, desde) do update set modo = excluded.modo, fase = excluded.fase, ritmo_pct = excluded.ritmo_pct, kcal = excluded.kcal,
    proteina_g = excluded.proteina_g, carbos_g = excluded.carbos_g, grasa_g = excluded.grasa_g, fibra_g = excluded.fibra_g, kcal_descanso = null,
    carbos_descanso_g = null, grasa_descanso_g = null, mantenimiento = excluded.mantenimiento, motivo = excluded.motivo
  returning id into v_plan_id;
  return v_plan || jsonb_build_object('automatico', true, 'id', v_plan_id, 'desde', v_hoy, 'solo_mantener', v_solo);
end $$;

-- ---------------------------------------------------------------------
-- 6. La revisión de cada 4 semanas (la calcula el móvil con revisionNutricion; aquí, sus topes)
-- ---------------------------------------------------------------------
-- p: { kcal, proteina_g, carbos_g, grasa_g, alcohol_kcal?, motivo }. Devuelve el id del plan nuevo, o null si aún no toca
-- (su último plan es de hace menos de 28 días).
create or replace function public.nutricion_revision(p jsonb, p_atleta uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := fbe_privado.esencial_comida_quien(p_atleta);
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_ult public.planes_nutricion;
  v_sexo text;
  v_tca boolean;
  v_scoff integer;
  v_kcal int; v_prot int; v_carb int; v_grasa int; v_alc int;
  v_piso int;
  v_dias int;
  v_semanas_ok boolean;
  v_motivo text := nullif(left(btrim(coalesce(p ->> 'motivo', '')), 280), '');
  v_nuevo uuid;
begin
  perform pg_advisory_xact_lock(hashtext('fbe-esencial-comida:' || v_id::text));
  select * into v_ult from public.planes_nutricion where atleta_id = v_id and desde <= v_hoy order by desde desc limit 1;
  if not found then raise exception 'Antes, tu plan de partida' using errcode = '22023'; end if;
  if v_ult.desde > v_hoy - 28 then return null; end if;   -- (cada 4 semanas: aún no toca)
  if v_ult.modo <> 'macros' or v_ult.kcal is null or v_ult.kcal_descanso is not null then
    raise exception 'Este plan no se ajusta solo' using errcode = '22023';
  end if;
  begin
    v_kcal := (p ->> 'kcal')::int; v_prot := (p ->> 'proteina_g')::int; v_carb := (p ->> 'carbos_g')::int; v_grasa := (p ->> 'grasa_g')::int;
    v_alc := coalesce((p ->> 'alcohol_kcal')::int, 0);
  exception when others then
    raise exception 'Ese cambio no vale' using errcode = '22023';
  end;
  -- R26: buena adherencia (20 de los últimos 28 días cumplidos y 3 pesadas cada una de las 4 semanas)
  select count(distinct fecha) into v_dias from public.registros_nutricion
    where atleta_id = v_id and fecha between v_hoy - 28 and v_hoy - 1 and cumplido in (1, 2);
  select bool_and(n >= 3) into v_semanas_ok from (
    select (select count(distinct w.fecha) from public.pesos w where w.atleta_id = v_id and w.fecha between v_hoy - 28 + 7 * s and v_hoy - 22 + 7 * s) as n
    from generate_series(0, 3) s) x;
  if v_dias < 20 or not coalesce(v_semanas_ok, false) then
    raise exception 'Sin buena adherencia no se tocan las kcal' using errcode = '22023';
  end if;
  select sexo into v_sexo from public.nutricion_perfiles where atleta_id = v_id;
  select coalesce(tca, false), (select count(*) from jsonb_each(coalesce(nutricion_salud -> 'scoff', '{}'::jsonb)) s where s.value = 'true'::jsonb)
    into v_tca, v_scoff from public.cuestionarios where atleta_id = v_id;
  v_piso := greatest(case when v_sexo = 'mujer' then 1500 else 1800 end, coalesce(ceil(0.75 * v_ult.mantenimiento / 10.0)::int * 10, 0));
  -- R30-R33: como mucho 250 kcal, la misma proteína, la grasa entre el 20 y el 35 %, las kcal cuadrando con los macros (y el
  -- alcohol), nunca por debajo de los suelos al bajar y, con antecedente de TCA (o SCOFF positivo), sin bajar
  if v_kcal is null or v_prot is null or v_carb is null or v_grasa is null or v_alc < 0 or v_alc > 1000
     or abs(v_kcal - v_ult.kcal) > 255 or v_kcal = v_ult.kcal
     or v_prot is distinct from v_ult.proteina_g
     or v_carb < 0 or v_grasa * 9 < 0.2 * v_kcal - 45 or v_grasa * 9 > 0.35 * v_kcal + 45
     or abs(v_kcal - (4 * v_prot + 4 * v_carb + 9 * v_grasa + v_alc)) > 5
     or (v_kcal < v_ult.kcal and v_kcal < v_piso - 5)
     or ((coalesce(v_tca, false) or coalesce(v_scoff, 0) >= 2) and v_kcal < v_ult.kcal) then
    raise exception 'Ese cambio se sale de los topes' using errcode = '22023';
  end if;
  insert into public.planes_nutricion (atleta_id, desde, modo, fase, ritmo_pct, kcal, proteina_g, carbos_g, grasa_g, fibra_g, pautas, mantenimiento, motivo)
  values (v_id, v_hoy, 'macros', v_ult.fase, v_ult.ritmo_pct, v_kcal, v_prot, v_carb, v_grasa, v_ult.fibra_g, v_ult.pautas, v_ult.mantenimiento,
          coalesce(v_motivo, 'Revisión de las 4 semanas'))
  returning id into v_nuevo;
  return v_nuevo;
end $$;

-- ---------------------------------------------------------------------
-- 7. El ajuste de cada semana de la 093, sin los planes del motor (R2: un plan del cuestionario de nutrición no cambia cada
--    semana; se revisa cada 4, con nutricion_revision). Igual que en la 093, más esa línea.
-- ---------------------------------------------------------------------
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
  if v_ult.mantenimiento is not null then return null; end if;   -- (105) del motor: no toca nunca (se revisa cada 4 semanas)
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
-- 8. Permisos (como al final de 003 a 104)
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

insert into public.fbe_migraciones (numero) values (105)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
