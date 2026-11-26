-- =====================================================================
-- FBE Equipo, migración 106: el motor de nutrición (N4): la revisión de cada 4 semanas, con su historial
--
-- Por qué (reglas R26-R34 del documento del proyecto «claude/nutricion-motor-reglas.md», de las respuestas de Pelayo a las
-- 40 preguntas, 26/11/2026):
--   * nutricion_revisiones: cada revisión de cada 4 semanas, haya cambio o no: qué salió (bien, recomposición, baja, sube,
--     suelo, profesional, simplificar o faltan datos), las kcal de antes y de después, los días que siguió el plan, su ritmo
--     real y el previsto, lo que cambió su cintura y el porqué. La escribe nutricion_revision(); la ven él y el coach.
--   * nutricion_revision(p), la de la 105 con el historial: cada 28 días desde el último cambio o la última revisión (14
--     tras «simplificar» o «faltan datos», R29), con o sin cambio de plan. Los cambios (baja y sube), con los topes de
--     siempre (adherencia, 250 kcal, la misma proteína, la grasa entre el 20 y el 35 %, los suelos y, con antecedente de TCA
--     o el SCOFF positivo, sin bajar). Devuelve el id de la revisión, o null si aún no toca.
--   * esencial_comida_panel (la de la 104): en «La comida» de tu panel, los ajustes cuentan también los cambios de la revisión
--     de cada 4 semanas, y quien tiene el SCOFF positivo no sale en «sin pesarse» (como quien tiene antecedente de TCA).
--   * crear_recordatorios (la de la 104): «¿Te pesas esta semana?» tampoco a quien tiene el SCOFF positivo (R36: sin
--     pedirle que se pese), y «Tu lunes de FBE Esencial» ya no cuenta las preguntas para el directo salvo con «El directo de
--     dudas» encendido (v0.251).
--   Para quien lleva seguimiento no cambia nada.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 105 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 106 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 106 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 106;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 105) then  -- (2) la anterior
    raise exception 'Falta la migración 105 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. El historial de las revisiones (dato de salud: su ritmo y su cintura; lo escribe nutricion_revision, con su consentimiento)
-- ---------------------------------------------------------------------
create table if not exists public.nutricion_revisiones (
  id               uuid primary key default gen_random_uuid(),
  atleta_id        uuid not null references public.atletas(id) on delete cascade,
  fecha            date not null default ((now() at time zone 'Europe/Madrid')::date),
  tipo             text not null,           -- bien · recomposicion · baja · sube · suelo · profesional · simplificar · datos
  kcal_antes       integer,
  kcal_despues     integer,
  dias_cumplidos   smallint,                -- de los últimos 28, en «Sí» o «Casi»
  ritmo_real       numeric(5,2),            -- % de su peso a la semana (la pendiente de sus pesadas)
  ritmo_previsto   numeric(5,2),
  cintura_cambio   numeric(4,1),            -- cm frente a hace 4 semanas
  porque           text,
  plan_id          uuid references public.planes_nutricion(id) on delete set null,
  creado_en        timestamptz not null default now()
);
comment on table public.nutricion_revisiones is 'Motor de nutrición: cada revisión de cada 4 semanas (con o sin cambio de plan). La escribe nutricion_revision().';
alter table public.nutricion_revisiones drop constraint if exists nutricion_revisiones_validas;
alter table public.nutricion_revisiones add constraint nutricion_revisiones_validas check (
  tipo in ('bien', 'recomposicion', 'baja', 'sube', 'suelo', 'profesional', 'simplificar', 'datos')
  and (kcal_antes is null or kcal_antes between 800 and 8000) and (kcal_despues is null or kcal_despues between 800 and 8000)
  and (dias_cumplidos is null or dias_cumplidos between 0 and 28)
  and (ritmo_real is null or ritmo_real between -20 and 20) and (ritmo_previsto is null or ritmo_previsto between -5 and 5)
  and (cintura_cambio is null or cintura_cambio between -60 and 60)
  and (porque is null or char_length(porque) <= 400)
);
create index if not exists nutricion_revisiones_atleta on public.nutricion_revisiones (atleta_id, fecha desc);
alter table public.nutricion_revisiones enable row level security;
drop policy if exists coach_todo on public.nutricion_revisiones;
create policy coach_todo on public.nutricion_revisiones for all to authenticated using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.nutricion_revisiones;
create policy atleta_ver on public.nutricion_revisiones for select to authenticated using (atleta_id = public.mi_atleta_id());
grant select, insert, update, delete on public.nutricion_revisiones to authenticated;

-- ---------------------------------------------------------------------
-- 2. La revisión de cada 4 semanas (la calcula el móvil con revisionNutricion; aquí, cuándo toca, sus topes y el historial)
-- ---------------------------------------------------------------------
-- p: { tipo, motivo, ritmo_real?, cintura_cambio? y, si cambia el plan (baja o sube): kcal, proteina_g, carbos_g, grasa_g,
-- alcohol_kcal? }. Devuelve el id de la revisión, o null si aún no toca.
create or replace function public.nutricion_revision(p jsonb, p_atleta uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := fbe_privado.esencial_comida_quien(p_atleta);
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_ult public.planes_nutricion;
  v_rev public.nutricion_revisiones;
  v_tipo text := coalesce(p ->> 'tipo', '');
  v_desde date;
  v_espera int;
  v_sexo text;
  v_tca boolean;
  v_scoff integer;
  v_kcal int; v_prot int; v_carb int; v_grasa int; v_alc int;
  v_ritmo numeric; v_cintura numeric;
  v_piso int;
  v_dias int;
  v_semanas_ok boolean;
  v_motivo text := nullif(left(btrim(coalesce(p ->> 'motivo', '')), 400), '');
  v_plan uuid;
  v_nuevo uuid;
begin
  perform pg_advisory_xact_lock(hashtext('fbe-esencial-comida:' || v_id::text));
  select * into v_ult from public.planes_nutricion where atleta_id = v_id and desde <= v_hoy order by desde desc limit 1;
  if not found then raise exception 'Antes, tu plan de partida' using errcode = '22023'; end if;
  if v_ult.modo <> 'macros' or v_ult.kcal is null or v_ult.kcal_descanso is not null then
    raise exception 'Este plan no se ajusta solo' using errcode = '22023';
  end if;
  if v_tipo not in ('bien', 'recomposicion', 'baja', 'sube', 'suelo', 'profesional', 'simplificar', 'datos') then
    raise exception 'Esa revisión no vale' using errcode = '22023';
  end if;
  -- Cuándo toca (R28 y R29): 28 días desde el último cambio o la última revisión; 14 si la última dijo «simplificar» o
  -- «faltan datos» (y no ha cambiado el plan después)
  select * into v_rev from public.nutricion_revisiones where atleta_id = v_id order by fecha desc, creado_en desc limit 1;
  v_desde := greatest(v_ult.desde, coalesce(v_rev.fecha, v_ult.desde));
  v_espera := case when v_rev.fecha is not null and v_rev.fecha >= v_ult.desde and v_rev.tipo in ('simplificar', 'datos') then 14 else 28 end;
  if v_desde > v_hoy - v_espera then return null; end if;
  begin
    v_ritmo := (p ->> 'ritmo_real')::numeric; v_cintura := (p ->> 'cintura_cambio')::numeric;
  exception when others then
    raise exception 'Esa revisión no vale' using errcode = '22023';
  end;
  -- Los días que ha seguido el plan (R26), contados aquí
  select count(distinct fecha) into v_dias from public.registros_nutricion
    where atleta_id = v_id and fecha between v_hoy - 28 and v_hoy - 1 and cumplido in (1, 2);
  if v_tipo in ('baja', 'sube') then
    begin
      v_kcal := (p ->> 'kcal')::int; v_prot := (p ->> 'proteina_g')::int; v_carb := (p ->> 'carbos_g')::int; v_grasa := (p ->> 'grasa_g')::int;
      v_alc := coalesce((p ->> 'alcohol_kcal')::int, 0);
    exception when others then
      raise exception 'Ese cambio no vale' using errcode = '22023';
    end;
    -- R26: buena adherencia (20 de los últimos 28 días cumplidos y 3 pesadas cada una de las 4 semanas)
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
    -- R30-R33: hacia donde dice (baja, menos; sube, más), como mucho 250 kcal, la misma proteína, la grasa entre el 20 y el
    -- 35 %, las kcal cuadrando con los macros (y el alcohol), nunca por debajo de los suelos al bajar y, con antecedente de
    -- TCA (o SCOFF positivo), sin bajar
    if v_kcal is null or v_prot is null or v_carb is null or v_grasa is null or v_alc < 0 or v_alc > 1000
       or (v_tipo = 'baja' and v_kcal >= v_ult.kcal) or (v_tipo = 'sube' and v_kcal <= v_ult.kcal)
       or abs(v_kcal - v_ult.kcal) > 255
       or v_prot is distinct from v_ult.proteina_g
       or v_carb < 0 or v_grasa * 9 < 0.2 * v_kcal - 45 or v_grasa * 9 > 0.35 * v_kcal + 45
       or abs(v_kcal - (4 * v_prot + 4 * v_carb + 9 * v_grasa + v_alc)) > 5
       or (v_kcal < v_ult.kcal and v_kcal < v_piso - 5)
       or ((coalesce(v_tca, false) or coalesce(v_scoff, 0) >= 2) and v_kcal < v_ult.kcal) then
      raise exception 'Ese cambio se sale de los topes' using errcode = '22023';
    end if;
    insert into public.planes_nutricion (atleta_id, desde, modo, fase, ritmo_pct, kcal, proteina_g, carbos_g, grasa_g, fibra_g, pautas, mantenimiento, motivo)
    values (v_id, v_hoy, 'macros', v_ult.fase, v_ult.ritmo_pct, v_kcal, v_prot, v_carb, v_grasa, v_ult.fibra_g, v_ult.pautas, v_ult.mantenimiento,
            left(coalesce(v_motivo, 'Revisión de las 4 semanas'), 280))
    returning id into v_plan;
  end if;
  begin
    insert into public.nutricion_revisiones (atleta_id, fecha, tipo, kcal_antes, kcal_despues, dias_cumplidos, ritmo_real, ritmo_previsto, cintura_cambio, porque, plan_id)
    values (v_id, v_hoy, v_tipo, v_ult.kcal, coalesce(v_kcal, v_ult.kcal), v_dias, round(v_ritmo, 2), v_ult.ritmo_pct, round(v_cintura, 1), v_motivo, v_plan)
    returning id into v_nuevo;
  exception when check_violation or numeric_value_out_of_range then
    raise exception 'Esa revisión no vale' using errcode = '22023';
  end;
  return v_nuevo;
end $$;

-- ---------------------------------------------------------------------
-- 3. La comida en tu panel (la de la 104): los ajustes cuentan también los cambios de la revisión de cada 4 semanas, y quien
--    tiene el SCOFF positivo cuenta como con antecedente (no se le pide que se pese)
-- ---------------------------------------------------------------------
create or replace function public.esencial_comida_panel()
returns table (atleta_id uuid, plan boolean, tca boolean, pesadas_14 integer, dias_7 integer, ajustes integer, ajustes_7 integer)
language sql stable security definer set search_path = '' as $$
  with hoy as (select (now() at time zone 'Europe/Madrid')::date as d)
  select a.id,
    exists (select 1 from public.planes_nutricion pn where pn.atleta_id = a.id),
    -- (106) con el SCOFF positivo, como con antecedente: no se le pide que se pese (no sale en «sin pesarse»)
    coalesce(c.tca, false) or (select count(*) from jsonb_each(coalesce(c.nutricion_salud -> 'scoff', '{}'::jsonb)) s where s.value = 'true'::jsonb) >= 2,
    (select count(distinct p.fecha)::integer from public.pesos p where p.atleta_id = a.id and p.fecha > hoy.d - 14 and p.fecha <= hoy.d),
    (select count(*)::integer from public.registros_nutricion r where r.atleta_id = a.id and r.fecha > hoy.d - 7 and r.fecha <= hoy.d
       and (r.kcal is not null or r.cumplido is not null)),
    (select count(*)::integer from public.planes_nutricion pn where pn.atleta_id = a.id and pn.motivo like 'Ajuste de la semana%')
      -- (106) y los cambios de la revisión de cada 4 semanas
      + (select count(*)::integer from public.nutricion_revisiones r where r.atleta_id = a.id and r.tipo in ('baja', 'sube')),
    (select count(*)::integer from public.planes_nutricion pn where pn.atleta_id = a.id and pn.motivo like 'Ajuste de la semana%' and pn.desde > hoy.d - 7)
      + (select count(*)::integer from public.nutricion_revisiones r where r.atleta_id = a.id and r.tipo in ('baja', 'sube') and r.fecha > hoy.d - 7)
  from public.atletas a
  cross join hoy
  left join public.cuestionarios c on c.atleta_id = a.id
  where public.es_coach() and a.modalidad = 'por_su_cuenta' and a.estado <> 'baja' and a.nutricion is not false
  order by a.id
$$;
comment on function public.esencial_comida_panel() is 'FBE Esencial: la comida de cada uno con nutrición, en recuentos (solo el coach).';

-- ---------------------------------------------------------------------
-- 4. Los avisos: crear_recordatorios, la de la 104 con «¿Te pesas?» sin el SCOFF positivo y «Tu lunes» sin el directo apagado
-- ---------------------------------------------------------------------
create or replace function public.crear_recordatorios(p_ahora timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_local timestamp := p_ahora at time zone 'Europe/Madrid';
  v_hoy date := (p_ahora at time zone 'Europe/Madrid')::date;
  v_dow integer := extract(isodow from (p_ahora at time zone 'Europe/Madrid'))::integer;
  v_lunes date;
  v_n integer := 0;
  v_m integer;
  v_titulo text;
  v_cuerpo text;
  v_r record;
  v_plan jsonb;
begin
  perform fbe_privado.solo_servidor();
  v_lunes := v_hoy - (v_dow - 1);

  -- Hoy toca… (solo si planificó el día de la sesión en «Tu plan»). Cada consulta elige primero a quién
  -- (materialized: así la notificación solo se crea para esas filas, sin depender del orden del WHERE)
  with x as materialized (
    select d.perfil_id, d.hora_manana, count(*) as n, min(s.nombre) as nombre
    from fbe_privado.destinatarios d
    join public.atletas a on a.id = d.atleta_id and a.entrenamiento
    join public.bloques b on b.atleta_id = d.atleta_id and not b.es_plantilla and b.estado not in ('cancelado', 'finalizado')
    join public.semanas w on w.bloque_id = b.id and w.programacion = 'programada'
    join public.sesiones s on s.semana_id = w.id and s.dia_previsto = v_hoy and not s.completada
    where not ('sesion_hoy' = any (d.desactivados)) and not fbe_privado.esencial_de_viaje(d.atleta_id, v_hoy) and not fbe_privado.esencial_tope(d.atleta_id, v_hoy)
      and v_local >= v_hoy + d.hora_manana and v_local < v_hoy + d.hora_manana + interval '2 hours'
    group by d.perfil_id, d.hora_manana
  )
  select count(*) into v_m from x
  where fbe_privado.notificar_seguro(x.perfil_id, 'sesion_hoy',
          case when x.n = 1 then 'Hoy toca ' || x.nombre else 'Hoy tienes ' || x.n || ' sesiones' end,
          case when x.n = 1 then 'La tienes en Hoy.' else 'Las tienes en Hoy.' end,
          '#hoy', 'recordatorio_sesion:' || v_hoy, p_ahora,
          (v_hoy + x.hora_manana + interval '4 hours') at time zone 'Europe/Madrid');
  v_n := v_n + v_m;

  -- El check-in de la semana (el lunes, el de la semana que acaba de terminar, como en la app)
  with d as materialized (
    select d.perfil_id, d.hora_tarde from fbe_privado.destinatarios d
    where d.salud and not ('checkin' = any (d.desactivados)) and d.dia_checkin = v_dow
      and v_local >= v_hoy + d.hora_tarde and v_local < v_hoy + d.hora_tarde + interval '2 hours'
      and not exists (select 1 from public.checkins c
                      where c.atleta_id = d.atleta_id and c.semana_inicio = case when v_dow = 1 then v_lunes - 7 else v_lunes end)
  )
  select count(*) into v_m from d
  where fbe_privado.notificar_seguro(d.perfil_id, 'checkin', '¿Haces el check-in?',
          case when v_dow = 1 then 'El de la semana pasada aún está pendiente.' else 'El de esta semana aún está pendiente.' end,
          '#checkin', 'recordatorio_checkin:' || v_hoy, p_ahora,
          (v_hoy + d.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
  v_n := v_n + v_m;

  -- Por la tarde, una sola: los hábitos que hoy le hacen falta (los diarios sin apuntar y los de x días a la
  -- semana que ya no llegan si se salta hoy) y la nutrición sin apuntar (si tiene plan)
  with x as materialized (
    select * from (
    select d.perfil_id, d.hora_tarde,
      case when 'habitos' = any (d.desactivados) then 0 else (
        select count(*) from public.habitos h
        where h.atleta_id = d.atleta_id and h.activo
          and not exists (select 1 from public.registros_habito r where r.habito_id = h.id and r.fecha = v_hoy)
          and h.dias_semana - (
            select count(*) from public.registros_habito r
            where r.habito_id = h.id and r.fecha >= v_lunes and r.fecha < v_hoy
              and case when h.tipo = 'si_no' then r.valor >= 1
                       when h.sentido = 'al_menos' then r.valor >= h.objetivo
                       else r.valor <= h.objetivo end
          ) >= 8 - v_dow
      ) end as habitos,
      not ('nutricion' = any (d.desactivados))
        and exists (select 1 from public.planes_nutricion pn where pn.atleta_id = d.atleta_id and pn.desde <= v_hoy)
        and exists (select 1 from public.atletas a where a.id = d.atleta_id and a.nutricion)
        and not exists (select 1 from public.registros_nutricion rn where rn.atleta_id = d.atleta_id and rn.fecha = v_hoy) as nutricion
    from fbe_privado.destinatarios d
    where d.salud and v_local >= v_hoy + d.hora_tarde and v_local < v_hoy + d.hora_tarde + interval '2 hours'
    ) y
    where y.habitos > 0 or y.nutricion
  )
  select count(*) into v_m from x
  where fbe_privado.notificar_seguro(x.perfil_id, case when x.habitos > 0 then 'habitos' else 'nutricion' end,
          case when x.habitos > 0 and x.nutricion then
                 case when x.habitos = 1 then 'Te queda un hábito y la nutrición de hoy' else 'Te quedan ' || x.habitos || ' hábitos y la nutrición de hoy' end
               when x.habitos = 1 then 'Te queda un hábito de hoy'
               when x.habitos > 1 then 'Te quedan ' || x.habitos || ' hábitos de hoy'
               else '¿Apuntas lo que has comido hoy?' end,
          case when x.habitos > 0 then 'Apúntalo en Hoy antes de que acabe el día.' else 'Aún no has apuntado la nutrición de hoy.' end,
          '#hoy', 'recordatorio_tarde:' || v_hoy, p_ahora,
          (v_hoy + x.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
  v_n := v_n + v_m;

  -- (v0.69, 041) El domingo por la tarde, el resumen de la semana del equipo (una vez: la clave lleva el día)
  -- (revisión) en su propio bloque: si algo falla aquí, no se pierden los demás recordatorios de esa pasada
  begin
  if v_dow = 7 and v_local >= v_hoy + time '19:00' and v_local < v_hoy + time '22:00' and public.comunidad_activa() then
    select t.titulo, t.cuerpo into v_titulo, v_cuerpo
    from fbe_privado.comunidad_resumen_de_la_semana() r
    cross join lateral public.comunidad_texto_resumen(r.sesiones, r.records, r.semana_completa) t;
    if v_titulo is not null then
      with x as materialized (
        select d.perfil_id from fbe_privado.comunidad_dentro d
        union
        select p.id from public.perfiles p where p.rol = 'coach'
      )
      select count(*) into v_m from x
      where fbe_privado.notificar_seguro(x.perfil_id, 'comunidad', v_titulo, v_cuerpo, '#equipo', 'comunidad_resumen:' || v_hoy, p_ahora,
              (v_hoy + time '23:00') at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  end if;
  exception when others then
    raise warning 'FBE: resumen del domingo no creado: %', sqlerrm;
  end;

  -- (v0.70, 042) El sábado por la tarde, a quien aún no ha completado su semana y su compañero de racha sí (también en su
  -- propio bloque: si falla, los demás recordatorios se crean igual)
  begin
  if v_dow = 6 and v_local >= v_hoy + time '19:00' and v_local < v_hoy + time '22:00' and public.comunidad_activa() then
    with sem as materialized (
      select x.atleta_id, x.hechas >= x.previstas as completa
      from fbe_privado.comunidad_semanas_de(array(select d.atleta_id from fbe_privado.comunidad_dentro d
                                                  where exists (select 1 from public.comunidad_companeros c where c.estado = 'aceptada' and d.perfil_id in (c.de, c.para)))) x
      where x.lunes = v_lunes
    ), x as materialized (
      select c.id, a.perfil_id as falta, b.perfil_id as hecho
      from public.comunidad_companeros c
      join fbe_privado.comunidad_dentro a on a.perfil_id in (c.de, c.para)
      join fbe_privado.comunidad_dentro b on b.perfil_id in (c.de, c.para) and b.perfil_id <> a.perfil_id
      join sem sa on sa.atleta_id = a.atleta_id and not sa.completa
      join sem sb on sb.atleta_id = b.atleta_id and sb.completa
      where c.estado = 'aceptada'
        -- (a uno solo de los dos por pareja y semana)
        and not exists (select 1 from public.notificaciones n where n.clave = 'comunidad_pareja:' || c.id || ':' || v_lunes)
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.falta, 'comunidad', fbe_privado.comunidad_nombre(x.hecho) || ' ya ha completado su semana: ¿cerráis la racha?',
            'Míralo en Equipo.', '#equipo', 'comunidad_pareja:' || x.id || ':' || v_lunes, p_ahora,
            (v_hoy + 1 + time '22:00') at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  end if;
  exception when others then
    raise warning 'FBE: aviso del sábado a las parejas no creado: %', sqlerrm;
  end;
  -- (v0.72, 044) Dos horas antes de un evento, a quien va (y sigue dentro): «A las 19:00: Quedada en el Retiro». Una vez por
  -- persona, evento y hora (si cambia la hora, otro); caduca al empezar. En su propio bloque, como los dos de antes
  begin
  if public.comunidad_activa() then
    with x as materialized (
      select a.perfil_id, e.id, e.titulo, e.empieza_en
      from public.comunidad_eventos e
      join public.comunidad_evento_asistentes a on a.evento_id = e.id and a.va
      join fbe_privado.comunidad_dentro d on d.perfil_id = a.perfil_id
      where e.cancelado_en is null and e.empieza_en > p_ahora and e.empieza_en <= p_ahora + interval '2 hours'
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.perfil_id, 'comunidad', 'A las ' || to_char(x.empieza_en at time zone 'Europe/Madrid', 'FMHH24:MI') || ': ' || x.titulo,
            'Te has apuntado. Míralo en Equipo.', '#equipo', 'comunidad_evento:' || x.id || ':' || floor(extract(epoch from x.empieza_en))::bigint, p_ahora, x.empieza_en);
    v_n := v_n + v_m;
  end if;
  exception when others then
    raise warning 'FBE: recordatorio de los eventos no creado: %', sqlerrm;
  end;

  -- (v0.72, 044) Un aviso o una encuesta programados, al llegar su hora (en el último día): a los de dentro, como al publicarlo
  -- (029), con la misma clave (si se oculta o se borra antes de salir, se retira). En su propio bloque
  begin
  if public.comunidad_activa() then
    with x as materialized (
      select k.id, k.tipo, d.perfil_id,
             coalesce(fbe_privado.nombre_corto((select p.nombre from public.perfiles p where p.id = k.autor_id)), 'Tu coach') as quien
      from public.comunidad_posts k
      join fbe_privado.comunidad_dentro d on d.perfil_id <> k.autor_id
      join public.comunidad_miembros m on m.atleta_id = d.atleta_id
      where k.publicar_en is not null
        -- (solo a quien ya estaba dentro cuando salió: a quien entra después no le llega un aviso de ayer)
        and coalesce(m.entrado_en, m.creado_en) <= k.publicar_en and k.publicar_en <= p_ahora and k.publicar_en > p_ahora - interval '1 day'
        and k.tipo in ('aviso', 'encuesta') and not k.oculta
        and not exists (select 1 from public.notificaciones n where n.usuario_id = d.perfil_id and n.clave = 'comunidad_aviso:' || k.id)
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.perfil_id, 'comunidad',
            x.quien || case when x.tipo = 'encuesta' then ' ha publicado una encuesta en el equipo' else ' ha publicado un aviso en el equipo' end,
            case when x.tipo = 'encuesta' then 'Tócalo para votar en Equipo.' else 'Tócalo para leerlo en Equipo.' end,
            '#equipo', 'comunidad_aviso:' || x.id, p_ahora);
    v_n := v_n + v_m;
  end if;
  exception when others then
    raise warning 'FBE: aviso de lo programado no creado: %', sqlerrm;
  end;

  -- (v0.73, 045) El aniversario en FBE, en el muro, el mismo día (una vez por persona y aniversario). En su propio bloque
  begin
    perform fbe_privado.comunidad_crear_aniversarios(v_hoy);
  exception when others then
    raise warning 'FBE: aniversarios del muro no puestos: %', sqlerrm;
  end;

  -- (v0.73, 045) Al coach, el día antes (de 9:00 a 21:00, Madrid), quién cumple mañana 1 mes, 6 meses o años en FBE (de sus
  -- atletas activos, estén o no en la comunidad): «Mañana Lucía cumple 1 año en FBE 🎉». Una vez por atleta y día; lleva a su chat
  begin
  if v_local >= v_hoy + time '09:00' and v_local < v_hoy + time '21:00' then
    with x as materialized (
      select c.id as coach, a.id as atleta, coalesce(fbe_privado.nombre_corto(a.nombre), 'Alguien') as nombre, m.meses
      from public.atletas a
      join public.perfiles p on p.id = a.perfil_id and p.rol <> 'coach'
      cross join lateral (select public.comunidad_meses_aniversario(a.fecha_alta, v_hoy + 1) as meses) m
      cross join public.perfiles c
      where c.rol = 'coach' and a.estado <> 'baja' and m.meses is not null
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.coach, 'comunidad',
            'Mañana ' || x.nombre || ' cumple ' || case when x.meses = 1 then '1 mes' when x.meses < 12 then x.meses || ' meses' when x.meses = 12 then '1 año'
                                                       else (x.meses / 12) || ' años' end || ' en FBE 🎉',
            'Felicítale mañana en el chat o en Equipo.', '#mensajes/' || x.atleta, 'comunidad_aniversario:' || x.atleta || ':' || (v_hoy + 1), p_ahora,
            (v_hoy + 2) at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  end if;
  exception when others then
    raise warning 'FBE: aviso de los aniversarios al coach no creado: %', sqlerrm;
  end;

  -- (v0.73, 045) Los momentos de hace más de 24 horas se borran (y su foto va a la cola de Storage). En su propio bloque
  begin
    perform fbe_privado.comunidad_limpiar_momentos(p_ahora);
  exception when others then
    raise warning 'FBE: momentos caducados no borrados: %', sqlerrm;
  end;

  -- (054) Las sesiones que se quedaron sin cerrar (todas las series hechas, 3 horas sin tocar): se cierran solas y se avisa
  begin
    v_m := fbe_privado.sesiones_cerrar_solas(p_ahora);
    v_n := v_n + v_m;
  exception when others then
    raise warning 'FBE: sesiones sin cerrar no cerradas: %', sqlerrm;
  end;

  -- (054) Al coach, por la mañana (10 a 12), los vídeos de técnica que llevan 3 días o más sin revisar: un aviso al día
  begin
    if v_local::time between time '10:00' and time '12:00' then
      with x as materialized (
        select c.id as coach, count(*) as n, min(a.creado_en) as desde
        from public.perfiles c
        cross join public.archivos a
        join public.atletas t on t.id = a.atleta_id and t.estado <> 'baja'
        where c.rol = 'coach' and a.tipo = 'video_tecnica' and a.revisado_en is null and a.creado_en < p_ahora - interval '3 days'
          and not exists (select 1 from public.comentarios m where m.archivo_id = a.id and m.autor = 'coach' and m.eliminado_en is null)
        group by c.id
      )
      select count(*) into v_m from x
      where fbe_privado.notificar_seguro(x.coach, 'video_recibido',
              case when x.n = 1 then 'Un vídeo espera tu revisión' else x.n || ' vídeos esperan tu revisión' end,
              'El más antiguo, desde el ' || to_char(x.desde at time zone 'Europe/Madrid', 'FMDD/FMMM') || '. Los tienes en Revisar.',
              '#revisar', 'videos_pendientes:' || v_hoy, p_ahora, (v_hoy + 1) at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  exception when others then
    raise warning 'FBE: aviso de vídeos sin revisar no creado: %', sqlerrm;
  end;

  -- (094) FBE Esencial: a quien va por su cuenta, con su plan empezado hace una semana o más, a los 7 días sin entrenar,
  -- un aviso amable a su hora de la tarde. Uno por semana como mucho; con la preferencia de los recordatorios de entreno.
  begin
    with x as materialized (
      select d.perfil_id, d.hora_tarde
      from fbe_privado.destinatarios d
      join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
      where not ('sesion_hoy' = any (d.desactivados)) and not fbe_privado.esencial_de_viaje(d.atleta_id, v_hoy) and not fbe_privado.esencial_tope(d.atleta_id, v_hoy)
        and v_local >= v_hoy + d.hora_tarde and v_local < v_hoy + d.hora_tarde + interval '2 hours'
        and exists (select 1 from public.bloques b where b.atleta_id = d.atleta_id and not b.es_plantilla
                    and b.estado in ('activo', 'ajustado') and b.fecha_inicio <= v_hoy - 7)
        and coalesce((select max(s.fecha_realizada) from public.sesiones s join public.semanas w on w.id = s.semana_id
                      join public.bloques b on b.id = w.bloque_id
                      where b.atleta_id = d.atleta_id and not b.es_plantilla and s.completada), date '2000-01-01') <= v_hoy - 7
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.perfil_id, 'sesion_hoy', 'Tu semana sigue lista',
            'Llevas unos días sin entrenar: cuando puedas, retoma donde lo dejaste.',
            '#hoy/retomar', 'esencial_retomar:' || v_lunes, p_ahora,
            (v_hoy + x.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  exception when others then
    raise warning 'FBE: aviso de FBE Esencial a los 7 días sin entrenar no creado: %', sqlerrm;
  end;

  -- (095) FBE Esencial, antes de empezar: a quien ya activó su cuenta y aún no ha enviado el cuestionario, en los 5 días
  -- antes de su lunes de inicio, un aviso a su hora de la mañana. Uno por tanda; con la preferencia del cuestionario.
  begin
    with x as materialized (
      select d.perfil_id, d.hora_manana, a.esencial_inicio
      from fbe_privado.destinatarios d
      join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta'
      where not ('cuestionario' = any (d.desactivados))
        and a.esencial_inicio > v_hoy and a.esencial_inicio <= v_hoy + 5
        and v_local >= v_hoy + d.hora_manana and v_local < v_hoy + d.hora_manana + interval '2 hours'
        and not exists (select 1 from public.cuestionarios c where c.atleta_id = a.id and c.completado_en is not null)
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.perfil_id, 'cuestionario', 'Te falta tu cuestionario',
            'Empiezas el lunes: con tu cuestionario, la app te prepara el plan. Son unos minutos.',
            '#hoy/cuestionario', 'esencial_cuestionario:' || x.esencial_inicio, p_ahora,
            (v_hoy + x.hora_manana + interval '4 hours') at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  exception when others then
    raise warning 'FBE: aviso de FBE Esencial del cuestionario no creado: %', sqlerrm;
  end;

  -- (097) FBE Esencial, empezar: solo con su primer plan (el bloque más antiguo que tenga: el de la semana 5 o un cambio de
  -- días no es «empezar») y con la preferencia de los recordatorios de entreno. Cada uno, en su propio bloque.
  -- La víspera de su lunes, a su hora de la tarde: «Mañana empiezas»
  begin
    with x as materialized (
      select d.perfil_id, d.hora_tarde, b.fecha_inicio
      from fbe_privado.destinatarios d
      join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
      join public.bloques b on b.atleta_id = a.id and not b.es_plantilla and b.estado in ('activo', 'ajustado', 'planificado') and b.fecha_inicio = v_hoy + 1
      where not ('sesion_hoy' = any (d.desactivados)) and not fbe_privado.esencial_de_viaje(d.atleta_id, v_hoy) and not fbe_privado.esencial_tope(d.atleta_id, v_hoy)
        and v_local >= v_hoy + d.hora_tarde and v_local < v_hoy + d.hora_tarde + interval '2 hours'
        and not exists (select 1 from public.bloques b2 where b2.atleta_id = a.id and not b2.es_plantilla and b2.fecha_inicio < b.fecha_inicio)
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.perfil_id, 'sesion_hoy', 'Mañana empiezas',
            'Tu semana 1 ya está en la app: échale un vistazo y elige cuándo haces la primera sesión.',
            '#hoy/manana', 'esencial_manana:' || x.fecha_inicio, p_ahora,
            (v_hoy + x.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  exception when others then
    raise warning 'FBE: aviso de FBE Esencial de la víspera no creado: %', sqlerrm;
  end;

  -- Ese lunes, a su hora de la mañana: «Hoy empiezas» (si hoy ya le llega «Hoy toca», no otro)
  begin
    with x as materialized (
      select d.perfil_id, d.hora_manana, b.fecha_inicio
      from fbe_privado.destinatarios d
      join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
      join public.bloques b on b.atleta_id = a.id and not b.es_plantilla and b.estado in ('activo', 'ajustado', 'planificado') and b.fecha_inicio = v_hoy
      where not ('sesion_hoy' = any (d.desactivados)) and not fbe_privado.esencial_de_viaje(d.atleta_id, v_hoy) and not fbe_privado.esencial_tope(d.atleta_id, v_hoy)
        and v_local >= v_hoy + d.hora_manana and v_local < v_hoy + d.hora_manana + interval '2 hours'
        and not exists (select 1 from public.bloques b2 where b2.atleta_id = a.id and not b2.es_plantilla and b2.fecha_inicio < b.fecha_inicio)
        and not exists (select 1 from public.notificaciones n where n.usuario_id = d.perfil_id and n.clave = 'recordatorio_sesion:' || v_hoy)
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.perfil_id, 'sesion_hoy', 'Hoy empiezas',
            'Tu semana 1 ya está en Hoy. Haz la primera sesión cuando mejor te venga esta semana.',
            '#hoy/hoy', 'esencial_hoy:' || x.fecha_inicio, p_ahora,
            (v_hoy + x.hora_manana + interval '4 hours') at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  exception when others then
    raise warning 'FBE: aviso de FBE Esencial del primer día no creado: %', sqlerrm;
  end;

  -- El jueves de su semana 1, a su hora de la tarde, si aún no ha hecho ninguna sesión: «¿Empezamos?»
  begin
    if v_dow = 4 then
      with x as materialized (
        select d.perfil_id, d.hora_tarde, b.fecha_inicio
        from fbe_privado.destinatarios d
        join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
        join public.bloques b on b.atleta_id = a.id and not b.es_plantilla and b.estado in ('activo', 'ajustado', 'planificado') and b.fecha_inicio = v_lunes
        where not ('sesion_hoy' = any (d.desactivados)) and not fbe_privado.esencial_de_viaje(d.atleta_id, v_hoy) and not fbe_privado.esencial_tope(d.atleta_id, v_hoy)
          and v_local >= v_hoy + d.hora_tarde and v_local < v_hoy + d.hora_tarde + interval '2 hours'
          and not exists (select 1 from public.bloques b2 where b2.atleta_id = a.id and not b2.es_plantilla and b2.fecha_inicio < b.fecha_inicio)
          and not exists (select 1 from public.sesiones s join public.semanas w on w.id = s.semana_id where w.bloque_id = b.id and s.completada)
      )
      select count(*) into v_m from x
      where fbe_privado.notificar_seguro(x.perfil_id, 'sesion_hoy', '¿Empezamos?',
              'Aún no has hecho ninguna sesión de tu semana 1: mañana o el fin de semana es buen momento para la primera.',
              '#hoy/empezamos', 'esencial_empezamos:' || x.fecha_inicio, p_ahora,
              (v_hoy + x.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  exception when others then
    raise warning 'FBE: aviso de FBE Esencial de la semana 1 sin empezar no creado: %', sqlerrm;
  end;

  -- Al coach, por la mañana (10 a 12), los vistos buenos de FBE Esencial que llevan 3 días o más sin confirmar: uno al día
  begin
    if v_local::time between time '10:00' and time '12:00' then
      with x as materialized (
        select c.id as coach, count(*) as n, min(a.visto_bueno_pedido_en) as desde
        from public.perfiles c
        cross join public.atletas a
        where c.rol = 'coach' and a.modalidad = 'por_su_cuenta' and a.estado <> 'baja'
          and a.visto_bueno_pedido_en is not null and a.visto_bueno_en is null
          and a.visto_bueno_pedido_en < p_ahora - interval '3 days'
        group by c.id
      )
      select count(*) into v_m from x
      where fbe_privado.notificar_seguro(x.coach, 'cuestionario_recibido',
              case when x.n = 1 then 'Un visto bueno espera tu confirmación' else x.n || ' vistos buenos esperan tu confirmación' end,
              'De FBE Esencial; el más antiguo, desde el ' || to_char(x.desde at time zone 'Europe/Madrid', 'FMDD/FMMM') || '. Los tienes en Atletas.',
              '#atletas', 'esencial_visto_bueno:' || v_hoy, p_ahora, (v_hoy + 1) at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  exception when others then
    raise warning 'FBE: aviso de los vistos buenos sin confirmar no creado: %', sqlerrm;
  end;


  -- (099) El cierre es a las 22:00 (en la 098, a las 23:30): así el aviso llega antes del «no molestar» de serie, que empieza
  -- a las 22:30 (Pelayo, 25/11).
  -- (098) FBE Esencial, el cierre de la semana (Pelayo, 25/11). El domingo de 21:00 a 22:00, con sesiones sin hacer y sin
  -- haber elegido: la pregunta (pasar a la siguiente o repetir esta). Con su «no molestar», como todo lo de «semana».
  begin
    if v_dow = 7 and v_local::time >= time '21:00' and v_local::time < time '22:00' then
      with x as materialized (
        select d.perfil_id, (select count(*) from public.sesiones s where s.semana_id = w.id and not s.completada) as faltan
        from fbe_privado.destinatarios d
        join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
        join public.bloques b on b.atleta_id = a.id and not b.es_plantilla and b.estado in ('activo', 'ajustado')
        join public.semanas w on w.bloque_id = b.id and w.programacion = 'programada' and w.fecha_inicio = v_lunes
        where w.esencial_cierre_lunes is distinct from v_lunes
          and not fbe_privado.esencial_de_viaje(a.id, v_hoy) and not fbe_privado.esencial_tope(a.id, v_hoy)
          and exists (select 1 from public.sesiones s where s.semana_id = w.id and not s.completada)
      )
      select count(*) into v_m from x
      where fbe_privado.notificar_seguro(x.perfil_id, 'semana', '¿Pasamos a la semana siguiente?',
              case when x.faltan = 1 then 'Te queda una sesión de esta semana.' else 'Te quedan ' || x.faltan || ' sesiones de esta semana.' end
                || ' Elige en la app si pasas a la siguiente o repites esta. Si no eliges antes de las 22:00, pasamos.',
              '#hoy/domingo', 'esencial_domingo:' || v_lunes, p_ahora, (v_hoy + time '22:00') at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  exception when others then
    raise warning 'FBE: la pregunta del domingo de FBE Esencial no creada: %', sqlerrm;
  end;

  -- El domingo desde las 22:00, quien no ha elegido: se pasa a la siguiente (queda apuntado en su semana; la prepara la app
  -- al abrirla, como cada lunes) y se le dice. Vale también para quien no tiene los avisos activados (sin el aviso).
  begin
    if v_dow = 7 and v_local::time >= time '22:00' then
      with cerradas as (
        update public.semanas w set esencial_cierre = 'auto', esencial_cierre_lunes = v_lunes
        from public.bloques b join public.atletas a on a.id = b.atleta_id
        where w.bloque_id = b.id and not b.es_plantilla and b.estado in ('activo', 'ajustado')
          and a.modalidad = 'por_su_cuenta' and a.estado = 'activo' and a.entrenamiento
          and w.programacion = 'programada' and w.fecha_inicio = v_lunes and w.esencial_cierre_lunes is distinct from v_lunes
          and exists (select 1 from public.sesiones s where s.semana_id = w.id and not s.completada)
        returning a.perfil_id, a.id as atleta_id
      )
      select count(*) into v_m from cerradas c
      where c.perfil_id is not null
        and not fbe_privado.esencial_de_viaje(c.atleta_id, v_hoy) and not fbe_privado.esencial_tope(c.atleta_id, v_hoy)
        and fbe_privado.notificar_seguro(c.perfil_id, 'semana', 'Tu semana siguiente, programada',
              'Como no has contestado, te hemos dejado programada tu siguiente semana de entrenamiento. La tienes al abrir la app.',
              '#hoy/auto', 'esencial_auto:' || v_lunes, p_ahora, (v_hoy + 1 + time '14:00') at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  exception when others then
    raise warning 'FBE: el cierre del domingo de FBE Esencial no hecho: %', sqlerrm;
  end;

  -- El lunes, a su hora de la mañana, si tenía semana la pasada y aún no tiene la nueva (se la prepara la app al abrirla)
  begin
    if v_dow = 1 then
      with x as materialized (
        select d.perfil_id, d.hora_manana
        from fbe_privado.destinatarios d
        join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
        where v_local >= v_hoy + d.hora_manana and v_local < v_hoy + d.hora_manana + interval '2 hours'
          and not fbe_privado.esencial_de_viaje(a.id, v_hoy) and not fbe_privado.esencial_tope(a.id, v_hoy)
          and exists (select 1 from public.bloques b join public.semanas w on w.bloque_id = b.id
                      where b.atleta_id = a.id and not b.es_plantilla and b.estado in ('activo', 'ajustado')
                        and w.programacion = 'programada' and w.fecha_inicio = v_lunes - 7)
          and not exists (select 1 from public.bloques b join public.semanas w on w.bloque_id = b.id
                          where b.atleta_id = a.id and not b.es_plantilla and w.programacion = 'programada' and w.fecha_inicio >= v_lunes)
      )
      select count(*) into v_m from x
      where fbe_privado.notificar_seguro(x.perfil_id, 'semana', 'Empieza tu semana',
              'Abre la app y te prepara tu semana nueva con lo que apuntaste en la anterior.',
              '#hoy/lunes', 'esencial_lunes:' || v_lunes, p_ahora, (v_hoy + x.hora_manana + interval '6 hours') at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  exception when others then
    raise warning 'FBE: el aviso del lunes de FBE Esencial no creado: %', sqlerrm;
  end;

  -- (099) FBE Esencial, elegir rutina. Quien ya envió su cuestionario, tiene experiencia (y la criba no le manda a
  -- «Primeras 4 semanas»), nunca ha tenido plan y aún no ha elegido rutina. Con la preferencia del cuestionario.
  -- Desde el día siguiente de enviarlo, a su hora de la tarde: «Te falta elegir tu rutina» (una sola vez)
  begin
    with x as materialized (
      select d.perfil_id, d.hora_tarde, a.id as atleta_id, a.esencial_inicio, a.visto_bueno_en, c.resultado,
        (c.completado_en at time zone 'Europe/Madrid')::date as enviado
      from fbe_privado.destinatarios d
      join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
      join public.cuestionarios c on c.atleta_id = a.id and c.completado_en is not null and c.resultado is not null
      where not ('cuestionario' = any (d.desactivados))
        and a.esencial_plantilla is null and coalesce(c.experiencia, 'ninguna') <> 'ninguna'
        and not (c.experiencia = 'menos_1' and coalesce((c.gustos ->> 'ahora') = 'parado' or (c.gustos ->> 'tecnica') = 'no', false))
        and not exists (select 1 from public.bloques b where b.atleta_id = a.id and not b.es_plantilla)
    )
    select count(*) into v_m from x
    where x.enviado < v_hoy and v_local >= v_hoy + x.hora_tarde and v_local < v_hoy + x.hora_tarde + interval '2 hours'
      -- (la víspera de su lunes no: esa tarde le llega la última llamada, que ya lo dice)
      and not (v_dow = 7 and (x.esencial_inicio is null or x.esencial_inicio <= v_hoy + 1) and (x.resultado = 'sin_valoracion' or x.visto_bueno_en is not null))
      and fbe_privado.notificar_seguro(x.perfil_id, 'cuestionario', 'Te falta elegir tu rutina',
            'Es el último paso antes de empezar: unas preguntas cortas y eliges entre las rutinas que te recomienda la app.',
            '#hoy/rutina', 'esencial_rutina:' || x.atleta_id, p_ahora,
            (v_hoy + x.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  exception when others then
    raise warning 'FBE: aviso de FBE Esencial de elegir rutina no creado: %', sqlerrm;
  end;

  -- La víspera de su lunes (o si su lunes ya pasó), el domingo de 21:00 a 22:00, ya con el visto bueno si le hacía falta:
  -- la última llamada (a las 22:00 la app le deja el plan preparado)
  begin
    if v_dow = 7 and v_local::time >= time '21:00' and v_local::time < time '22:00' then
      with x as materialized (
        select d.perfil_id, d.hora_tarde, a.id as atleta_id, a.esencial_inicio, a.visto_bueno_en, c.resultado,
          (c.completado_en at time zone 'Europe/Madrid')::date as enviado
        from fbe_privado.destinatarios d
        join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
        join public.cuestionarios c on c.atleta_id = a.id and c.completado_en is not null and c.resultado is not null
        where not ('cuestionario' = any (d.desactivados))
          and a.esencial_plantilla is null and coalesce(c.experiencia, 'ninguna') <> 'ninguna'
          and not (c.experiencia = 'menos_1' and coalesce((c.gustos ->> 'ahora') = 'parado' or (c.gustos ->> 'tecnica') = 'no', false))
          and not exists (select 1 from public.bloques b where b.atleta_id = a.id and not b.es_plantilla)
      )
      select count(*) into v_m from x
      where (x.esencial_inicio is null or x.esencial_inicio <= v_hoy + 1) and (x.resultado = 'sin_valoracion' or x.visto_bueno_en is not null)
        and fbe_privado.notificar_seguro(x.perfil_id, 'cuestionario', 'Mañana empiezas: elige tu rutina',
              'Si no eliges antes de las 22:00, la app te deja preparada la de tu cuestionario.',
              '#hoy/elige', 'esencial_elige:' || (v_hoy + 1), p_ahora, (v_hoy + time '22:00') at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  exception when others then
    raise warning 'FBE: la última llamada de FBE Esencial para elegir rutina no creada: %', sqlerrm;
  end;

  -- El domingo desde las 22:00: quien tiene su cuestionario enviado (y el visto bueno, si le hacía falta), su lunes es mañana
  -- o ya pasó y nunca ha tenido plan (no eligió rutina, o la app no llegó a pedírselo): se le deja preparado para este
  -- lunes (la criba; la rutina que eligió o, sin elegir, la de su cuestionario) y se le dice. Vale también para quien no
  -- tiene los avisos activados (sin el aviso). Cada uno, en su propio bloque: un fallo con uno no deja sin plan a los demás.
  begin
    if v_dow = 7 and v_local::time >= time '22:00' then
      for v_r in
        select a.id, a.perfil_id, a.esencial_plantilla
        from public.atletas a
        join public.cuestionarios c on c.atleta_id = a.id and c.completado_en is not null and c.resultado is not null
        where a.modalidad = 'por_su_cuenta' and a.estado = 'activo' and a.entrenamiento
          and (c.resultado = 'sin_valoracion' or a.visto_bueno_en is not null)
          and (a.esencial_inicio is null or a.esencial_inicio <= v_hoy + 1)
          -- (a quien acaba de enviarlo, hace menos de una hora, aún no: puede estar eligiendo en este momento)
          and c.completado_en <= p_ahora - interval '1 hour'
          and not exists (select 1 from public.bloques b where b.atleta_id = a.id and not b.es_plantilla)
      loop
        begin
          v_plan := fbe_privado.esencial_asignar(v_r.id, v_hoy);
          -- (el cuerpo de un aviso, como mucho 160 caracteres: con el nombre más largo de las rutinas de serie, 149)
          if coalesce((v_plan ->> 'nuevo')::boolean, false) and v_r.perfil_id is not null
             and fbe_privado.notificar_seguro(v_r.perfil_id, 'semana', 'Tu plan, preparado',
                   case when (v_plan ->> 'plantilla') = 'Primeras 4 semanas' or (v_plan ->> 'plantilla') is not distinct from v_r.esencial_plantilla
                        then 'Te hemos dejado preparado tu plan: «' || (v_plan ->> 'plantilla') || '». Empiezas este lunes.'
                        else 'Como no has elegido rutina, te hemos dejado preparada «' || (v_plan ->> 'plantilla') || '». Empiezas este lunes; puedes cambiarla.' end,
                   '#hoy/plan_auto', 'esencial_plan_auto:' || v_r.id, p_ahora, (v_hoy + 1 + time '14:00') at time zone 'Europe/Madrid') then
            v_n := v_n + 1;
          end if;
        exception when others then
          raise warning 'FBE: el plan de FBE Esencial de % no preparado: %', v_r.id, sqlerrm;
        end;
      end loop;
    end if;
  exception when others then
    raise warning 'FBE: los planes de la víspera de FBE Esencial no preparados: %', sqlerrm;
  end;

  -- (100) FBE Esencial: la mañana siguiente a su primera sesión, «¿Qué tal las agujetas?» (una vez; lleva a su tarjeta)
  begin
    with x as materialized (
      select d.perfil_id, d.atleta_id, d.hora_manana
      from fbe_privado.destinatarios d
      join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
      where not ('sesion_hoy' = any (d.desactivados)) and not fbe_privado.esencial_de_viaje(d.atleta_id, v_hoy) and not fbe_privado.esencial_tope(d.atleta_id, v_hoy)
        and v_local >= v_hoy + d.hora_manana and v_local < v_hoy + d.hora_manana + interval '2 hours'
        and (select min(s.fecha_realizada) from public.sesiones s join public.semanas w on w.id = s.semana_id
             join public.bloques b on b.id = w.bloque_id
             where b.atleta_id = d.atleta_id and not b.es_plantilla and s.completada) = v_hoy - 1
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.perfil_id, 'sesion_hoy', '¿Qué tal las agujetas?',
            'Ayer hiciste tu primera sesión. Si hoy notas agujetas, son normales: dile a la app cómo estás y te cuenta qué hacer.',
            '#hoy/agujetas', 'esencial_agujetas:' || x.atleta_id, p_ahora,
            (v_hoy + x.hora_manana + interval '6 hours') at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  exception when others then
    raise warning 'FBE: aviso de las agujetas de FBE Esencial no creado: %', sqlerrm;
  end;

  -- (100) FBE Esencial: «hoy toca», a su hora de verdad. A quien suele entrenar por la tarde (lo dice la hora de la primera
  -- serie de sus últimos días de entreno: la mediana de hasta seis, con tres o más en seis semanas), un aviso más entre hora y
  -- media y media hora antes de esa hora, si hoy tiene sesión y aún no la ha hecho. Si ya ha entrenado, calla.
  begin
    with h as materialized (
      select d.perfil_id, d.atleta_id,
             (select percentile_cont(0.5) within group (order by t.seg)
              from (select extract(epoch from (min(se.registrada_en) at time zone 'Europe/Madrid')::time) as seg
                    from public.series se
                    where se.atleta_id = d.atleta_id and se.registrada_en >= p_ahora - interval '42 days' and se.registrada_en < v_hoy::timestamp at time zone 'Europe/Madrid'
                    group by (se.registrada_en at time zone 'Europe/Madrid')::date
                    order by (se.registrada_en at time zone 'Europe/Madrid')::date desc limit 6) t
              having count(*) >= 3) as seg
      from fbe_privado.destinatarios d
      join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
      where not ('sesion_hoy' = any (d.desactivados)) and not fbe_privado.esencial_de_viaje(d.atleta_id, v_hoy) and not fbe_privado.esencial_tope(d.atleta_id, v_hoy)
    ), x as materialized (
      select h.perfil_id, h.seg, min(s.nombre) as nombre
      from h
      join public.bloques b on b.atleta_id = h.atleta_id and not b.es_plantilla and b.estado in ('activo', 'ajustado')
      join public.semanas w on w.bloque_id = b.id
      join public.sesiones s on s.semana_id = w.id and s.dia_previsto = v_hoy and not s.completada
      where h.seg >= 13 * 3600
        and v_local >= v_hoy + make_interval(secs => h.seg - 5400) and v_local < v_hoy + make_interval(secs => h.seg - 1800)
      group by h.perfil_id, h.seg
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.perfil_id, 'sesion_hoy', 'En un rato, tu sesión',
            'Hoy toca «' || x.nombre || '». Si hoy no puedes, en la app la pasas a otro día de un toque.',
            '#hoy/hora', 'esencial_hora:' || v_hoy, p_ahora,
            (v_hoy + make_interval(secs => x.seg + 3600)) at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  exception when others then
    raise warning 'FBE: aviso de FBE Esencial a su hora de entrenar no creado: %', sqlerrm;
  end;

  -- (101) FBE Esencial: la mañana siguiente a volver de un viaje (el que apuntó en «Me voy de viaje», salvo «sigo igual»),
  -- «¿Ya de vuelta?» (una vez por viaje; lleva a su tarjeta en Hoy)
  begin
    with x as materialized (
      select d.perfil_id, d.hora_manana, n.id as nota
      from fbe_privado.destinatarios d
      join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.entrenamiento
      join public.esencial_notas n on n.atleta_id = a.id and n.tipo = 'viaje' and n.hasta = v_hoy - 1
        and coalesce(n.datos ->> 'modo', 'pausa') <> 'igual'
      where not ('sesion_hoy' = any (d.desactivados))
        and v_local >= v_hoy + d.hora_manana and v_local < v_hoy + d.hora_manana + interval '2 hours'
        and not fbe_privado.esencial_de_viaje(a.id, v_hoy) and not fbe_privado.esencial_tope(a.id, v_hoy)
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.perfil_id, 'sesion_hoy', '¿Ya de vuelta?',
            'Tu plan sigue en la app, listo para cuando quieras. La primera sesión, sin prisa: no hay nada que recuperar.',
            '#hoy/viaje', 'esencial_viaje:' || x.nota, p_ahora,
            (v_hoy + x.hora_manana + interval '6 hours') at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  exception when others then
    raise warning 'FBE: aviso de la vuelta de un viaje de FBE Esencial no creado: %', sqlerrm;
  end;

  -- (104) FBE Esencial con nutrición: «¿Te pesas esta semana?», a quien lleva siete días o más sin pesarse y tiene su plan
  -- de comida desde hace una semana o más (nunca con antecedente de TCA: solo con tca = false en su cuestionario). A su
  -- hora de la mañana, como mucho uno por semana (y dentro del tope de avisos); lleva a «¿Cuándo me peso?»
  begin
    with x as materialized (
      select d.perfil_id
      from fbe_privado.destinatarios d
      join public.atletas a on a.id = d.atleta_id and a.modalidad = 'por_su_cuenta' and a.estado = 'activo' and a.nutricion is not false
      join public.cuestionarios c on c.atleta_id = a.id and c.tca is false
        -- (106) ni con el SCOFF positivo (dos «sí» o más): solo mantener y sin pedirle que se pese
        and (select count(*) from jsonb_each(coalesce(c.nutricion_salud -> 'scoff', '{}'::jsonb)) s where s.value = 'true'::jsonb) < 2
      where not ('nutricion' = any (d.desactivados))
        and v_local >= v_hoy + d.hora_manana and v_local < v_hoy + d.hora_manana + interval '2 hours'
        and exists (select 1 from public.planes_nutricion pn where pn.atleta_id = a.id and pn.desde <= v_hoy - 7)
        and not exists (select 1 from public.pesos p where p.atleta_id = a.id and p.fecha > v_hoy - 7)
        and not fbe_privado.esencial_de_viaje(a.id, v_hoy) and not fbe_privado.esencial_tope(a.id, v_hoy)
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.perfil_id, 'nutricion', '¿Te pesas esta semana?',
            'Una pesada por la mañana, en ayunas: la app la necesita para ajustar tu plan de comida.',
            '#hoy/pesarme', 'esencial_pesarse:' || v_lunes, p_ahora, (v_hoy + time '22:00') at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  exception when others then
    raise warning 'FBE: aviso de FBE Esencial para pesarse no creado: %', sqlerrm;
  end;

  -- (103) Tu lunes de FBE Esencial: si lo has encendido en tu panel («Tu resumen de los lunes»), el lunes de 8:00 a 10:00,
  -- un aviso a ti con cuántos entrenaron la semana pasada, cuántos llevan siete días sin entrenar y las preguntas nuevas
  -- para el directo (solo cifras; te llega como el resto de tus avisos: al móvil o por correo)
  begin
    if v_dow = 1 and v_local >= v_hoy + time '08:00' and v_local < v_hoy + time '10:00'
       and exists (select 1 from public.esencial_ajustes x where x.clave = 'resumen_lunes' and x.encendido) then
      with sem as (
        select b.atleta_id, bool_or(s.completada) as entreno
        from public.semanas w
        join public.bloques b on b.id = w.bloque_id and not b.es_plantilla
        join public.atletas a on a.id = b.atleta_id and a.modalidad = 'por_su_cuenta' and a.estado <> 'baja'
        join public.sesiones s on s.semana_id = w.id
        where w.programacion = 'programada' and w.fecha_inicio = v_lunes - 7
        group by b.atleta_id
      ), cifras as (
        select (select count(*) from sem) as total, (select count(*) from sem where entreno) as entrenaron,
          (select count(*) from public.atletas a
             where a.modalidad = 'por_su_cuenta' and a.estado = 'activo'
               and exists (select 1 from public.bloques b where b.atleta_id = a.id and not b.es_plantilla and b.fecha_inicio <= v_hoy - 7)
               and not exists (select 1 from public.sesiones s join public.semanas w on w.id = s.semana_id join public.bloques b on b.id = w.bloque_id
                               where b.atleta_id = a.id and s.completada and s.fecha_realizada >= v_hoy - 7)) as parados,
          (select count(*) from public.esencial_notas n where n.tipo = 'pregunta_directo' and n.respuesta is null and n.creada_en >= p_ahora - interval '7 days') as preguntas
      )
      select count(*) into v_m from public.perfiles p, cifras c
      where p.rol = 'coach' and c.total > 0
        and fbe_privado.notificar_seguro(p.id, 'aviso', 'Tu lunes de FBE Esencial',
              'La semana pasada entrenaron ' || c.entrenaron || ' de ' || c.total || '. Siete días sin entrenar: ' || c.parados
                -- (106) las preguntas para el directo, solo con «El directo de dudas» encendido
                || case when exists (select 1 from public.esencial_ajustes x where x.clave = 'directo' and x.encendido)
                     then '. Preguntas nuevas para el directo: ' || c.preguntas else '' end || '.',
              '#atletas', 'esencial_resumen:' || v_lunes, p_ahora, (v_hoy + time '22:00') at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  exception when others then
    raise warning 'FBE: tu resumen de los lunes de FBE Esencial no creado: %', sqlerrm;
  end;

  return v_n;
end $$;

-- ---------------------------------------------------------------------
-- 5. Permisos (como al final de 003 a 105)
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

insert into public.fbe_migraciones (numero) values (106)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
