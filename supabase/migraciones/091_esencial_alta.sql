-- =====================================================================
-- FBE Equipo, migración 091: FBE Esencial, el alta de quien va por su cuenta
--
-- Por qué: FBE Esencial (piloto desde el lunes 11/1/2027) es FBE Equipo sin seguimiento personal: el atleta rellena el
-- cuestionario, la app le asigna su plan y cada semana se la prepara el motor con los frenos de la v0.231. Esta
-- migración es lo que hace falta para el alta (la preparación de cada semana llega con la siguiente):
--   * atletas: `modalidad` («seguimiento», como hasta ahora, o «por_su_cuenta»), `esencial_inicio` (el lunes en que
--     empieza su tanda) y el visto bueno médico cuando el cribado no sale limpio (`visto_bueno_pedido_en`, lo marca el
--     atleta; `visto_bueno_en`, lo confirma el coach). Sin consentimiento de salud, el visto bueno no se guarda.
--   * series: `confirmada` (el atleta confirma una serie que parecía una errata; la usan los frenos).
--   * ejercicios: `por_tiempo` (la plancha va en segundos) y los nombres de la guía del vídeo (decisión de Pelayo del
--     24/11): «Prensa de piernas», «Press de pecho en máquina», «Jalón al pecho» y «Remo en máquina» (el curl se queda
--     «Curl de bíceps con mancuernas»), y «Sentadilla a un banco», nueva. Cada uno, con la alternativa de la guía.
--   * semanas: `marcas` (la semana en que se apuntan las marcas: la 4 de «Primeras 4 semanas»).
--   * La plantilla «Primeras 4 semanas», igual que la guía (si no hay ya una con ese nombre).
--   * esencial_asignar_plan(): la plantilla según su cuestionario («Primeras 4 semanas» si nunca ha entrenado; si no,
--     la de sus días, su lugar y su material), copiada a su nombre desde su lunes de inicio y publicada. La llama su
--     app al terminar el cuestionario (o el coach). Con un cribado que no sale limpio, solo con el visto bueno.
--   * esencial_pedir_visto_bueno(): el atleta dice que ya tiene el visto bueno médico (o la Puesta a punto).
--   Para quien lleva seguimiento no cambia nada (modalidad «seguimiento» de serie; los nombres nuevos no cambian
--   ninguna propuesta: comprobado con la copia del 18/11).
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 090 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 91 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 091 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 91;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 90) then  -- (2) la anterior
    raise exception 'Falta la migración 090 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Quién va por su cuenta, desde cuándo y su visto bueno médico
-- ---------------------------------------------------------------------
alter table public.atletas add column if not exists modalidad text not null default 'seguimiento';
alter table public.atletas add column if not exists esencial_inicio date;
alter table public.atletas add column if not exists visto_bueno_pedido_en timestamptz;
alter table public.atletas add column if not exists visto_bueno_en timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'atletas_modalidad_check') then
    alter table public.atletas add constraint atletas_modalidad_check check (modalidad in ('seguimiento', 'por_su_cuenta'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'atletas_esencial_inicio_check') then
    alter table public.atletas add constraint atletas_esencial_inicio_check check (esencial_inicio is null or extract(isodow from esencial_inicio) = 1);
  end if;
end $$;

-- El visto bueno médico es un dato de salud: sin su consentimiento de salud, no se guarda (como la ficha de la 089)
create or replace function public.atleta_visto_bueno_salud() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.visto_bueno_pedido_en is not null or new.visto_bueno_en is not null)
     and not public.consentimiento_salud_de_atleta(new.id) then
    new.visto_bueno_pedido_en := null;
    new.visto_bueno_en := null;
  end if;
  return new;
end $$;
drop trigger if exists atleta_visto_bueno_salud on public.atletas;
create trigger atleta_visto_bueno_salud before insert or update of visto_bueno_pedido_en, visto_bueno_en on public.atletas
  for each row execute function public.atleta_visto_bueno_salud();

-- ---------------------------------------------------------------------
-- 2. La serie que el atleta confirma (los frenos de «por su cuenta»)
-- ---------------------------------------------------------------------
alter table public.series add column if not exists confirmada boolean not null default false;

-- ---------------------------------------------------------------------
-- 3. Ejercicios: por tiempo y los nombres de la guía
-- ---------------------------------------------------------------------
alter table public.ejercicios add column if not exists por_tiempo boolean not null default false;
update public.ejercicios set por_tiempo = true where nombre in ('Plancha abdominal', 'Plancha lateral') and not por_tiempo;

do $$
declare r record;
begin
  for r in select * from (values ('Prensa (miscelánea)', 'Prensa de piernas'), ('Press plano en máquina', 'Press de pecho en máquina'),
                                 ('Jalón al pecho en máquina', 'Jalón al pecho'), ('Remo en máquina (miscelánea)', 'Remo en máquina')) as t(antes, despues) loop
    if not exists (select 1 from public.ejercicios where nombre = r.despues) then
      update public.ejercicios set nombre = r.despues where nombre = r.antes;
    end if;
  end loop;
  -- (la alternativa de la prensa, solo en una biblioteca que tenga la prensa: una base vacía no se toca)
  if exists (select 1 from public.ejercicios where nombre = 'Prensa de piernas') and not exists (select 1 from public.ejercicios where nombre = 'Sentadilla a un banco') then
    insert into public.ejercicios (nombre, grupos_musculares, tipo, instrucciones)
    values ('Sentadilla a un banco', array['cuadriceps', 'gluteo'], array['multiarticular'],
            'Siéntate en un banco y levántate sin impulso: los pies a la anchura de las caderas, el pecho alto y las rodillas en la línea de los pies. Toca el banco con suavidad, sin dejarte caer.');
  end if;
  -- Cada ejercicio de la guía, con su alternativa la primera (si no la tiene ya)
  for r in select * from (values ('Prensa de piernas', 'Sentadilla a un banco'), ('Peso muerto rumano con mancuernas', 'Puente de glúteo'),
                                 ('Press de pecho en máquina', 'Flexiones'), ('Jalón al pecho', 'Remo en máquina'),
                                 ('Plancha abdominal', 'Curl de bíceps con mancuernas')) as t(ej, alt) loop
    update public.ejercicios e set alternativas = array_prepend(a.id, e.alternativas)
    from (select id from public.ejercicios where nombre = r.alt order by creado_en limit 1) a
    where e.nombre = r.ej and not (a.id = any (e.alternativas));
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. La semana de las marcas y la plantilla «Primeras 4 semanas» (la guía del vídeo del 3/1/2027)
-- ---------------------------------------------------------------------
alter table public.semanas add column if not exists marcas boolean not null default false;

do $$
declare
  v_pl uuid;
  v_sem uuid;
  v_ses uuid;
  w record;
  s record;
  e record;
begin
  if exists (select 1 from public.bloques where es_plantilla and nombre = 'Primeras 4 semanas') then return; end if;
  if exists (select 1 from (values ('Prensa de piernas'), ('Peso muerto rumano con mancuernas'), ('Press de pecho en máquina'), ('Jalón al pecho'), ('Plancha abdominal')) as t(n)
             where not exists (select 1 from public.ejercicios where nombre = t.n)) then
    raise notice 'Falta algún ejercicio de la guía en la biblioteca: la plantilla «Primeras 4 semanas» no se crea (Claude la prepara a mano).';
    return;
  end if;
  insert into public.bloques (atleta_id, es_plantilla, nombre, foco, objetivo, descripcion, estado)
  values (null, true, 'Primeras 4 semanas', 'adaptacion', 'Aprender los cinco ejercicios y llegar a febrero',
          'La guía del vídeo: dos días por semana que no vayan seguidos y la misma sesión las cuatro semanas. En la cuarta, tus marcas: el punto de partida para todo lo que venga.', 'planificado')
  returning id into v_pl;
  for w in select * from (values
    (1, 'Una serie de cada ejercicio, de diez a doce repeticiones. Aprender el gesto y salir con ganas de volver. Media hora y a casa. El primer día empieza con poco peso: haz doce repeticiones y pregúntate cuántas más habrías podido hacer; buscas el peso con el que te sobren cuatro o cinco.', false),
    (2, 'Dos series de cada ejercicio. Entre una serie y otra, descansa lo que necesites para repetirla bien: uno o dos minutos.', false),
    (3, 'Dos series, con un poco más de peso. Tu primera subida de carga.', false),
    (4, 'Tres series en los dos primeros ejercicios y dos en el resto. Apuntas tus marcas: el peso y las repeticiones de cada ejercicio. Tres cuartos de hora.', true)
  ) as t(numero, nota, marcas) loop
    insert into public.semanas (bloque_id, numero, foco, nota_coach, marcas) values (v_pl, w.numero, 'adaptacion', w.nota, w.marcas) returning id into v_sem;
    for s in select * from (values (1, 'Día 1'), (2, 'Día 2')) as t(orden, nombre) loop
      insert into public.sesiones (semana_id, orden, nombre, tipo) values (v_sem, s.orden, s.nombre, 'fuerza') returning id into v_ses;
      for e in select * from (values
    (1, 1, 'Día 1', 1, 'Prensa de piernas', 'alta', 1, 10, 12, 4.5, null, 'Si no hay prensa: sentadilla a un banco, con las mismas series y repeticiones.'),
    (1, 1, 'Día 1', 2, 'Peso muerto rumano con mancuernas', 'alta', 1, 10, 12, 4.5, null, 'O, en su lugar, puente de glúteo, con las mismas series y repeticiones.'),
    (1, 1, 'Día 1', 3, 'Press de pecho en máquina', 'media', 1, 10, 12, 4.5, null, 'O flexiones, con más o menos inclinación según tu nivel.'),
    (1, 1, 'Día 1', 4, 'Jalón al pecho', 'media', 1, 10, 12, 4.5, null, 'O, en su lugar, remo en máquina, con las mismas series y repeticiones.'),
    (1, 1, 'Día 1', 5, 'Plancha abdominal', 'media', 1, 20, 30, null, null, 'O curl de bíceps: las mismas series, de 10 a 12 repeticiones.'),
    (1, 2, 'Día 2', 1, 'Prensa de piernas', 'alta', 1, 10, 12, 4.5, null, 'Si no hay prensa: sentadilla a un banco, con las mismas series y repeticiones.'),
    (1, 2, 'Día 2', 2, 'Peso muerto rumano con mancuernas', 'alta', 1, 10, 12, 4.5, null, 'O, en su lugar, puente de glúteo, con las mismas series y repeticiones.'),
    (1, 2, 'Día 2', 3, 'Press de pecho en máquina', 'media', 1, 10, 12, 4.5, null, 'O flexiones, con más o menos inclinación según tu nivel.'),
    (1, 2, 'Día 2', 4, 'Jalón al pecho', 'media', 1, 10, 12, 4.5, null, 'O, en su lugar, remo en máquina, con las mismas series y repeticiones.'),
    (1, 2, 'Día 2', 5, 'Plancha abdominal', 'media', 1, 20, 30, null, null, 'O curl de bíceps: las mismas series, de 10 a 12 repeticiones.'),
    (2, 1, 'Día 1', 1, 'Prensa de piernas', 'alta', 2, 10, 12, 3, 90, 'Si no hay prensa: sentadilla a un banco, con las mismas series y repeticiones.'),
    (2, 1, 'Día 1', 2, 'Peso muerto rumano con mancuernas', 'alta', 2, 10, 12, 3, 90, 'O, en su lugar, puente de glúteo, con las mismas series y repeticiones.'),
    (2, 1, 'Día 1', 3, 'Press de pecho en máquina', 'media', 2, 10, 12, 3, 90, 'O flexiones, con más o menos inclinación según tu nivel.'),
    (2, 1, 'Día 1', 4, 'Jalón al pecho', 'media', 2, 10, 12, 3, 90, 'O, en su lugar, remo en máquina, con las mismas series y repeticiones.'),
    (2, 1, 'Día 1', 5, 'Plancha abdominal', 'media', 2, 25, 35, null, 90, 'O curl de bíceps: las mismas series, de 10 a 12 repeticiones.'),
    (2, 2, 'Día 2', 1, 'Prensa de piernas', 'alta', 2, 10, 12, 3, 90, 'Si no hay prensa: sentadilla a un banco, con las mismas series y repeticiones.'),
    (2, 2, 'Día 2', 2, 'Peso muerto rumano con mancuernas', 'alta', 2, 10, 12, 3, 90, 'O, en su lugar, puente de glúteo, con las mismas series y repeticiones.'),
    (2, 2, 'Día 2', 3, 'Press de pecho en máquina', 'media', 2, 10, 12, 3, 90, 'O flexiones, con más o menos inclinación según tu nivel.'),
    (2, 2, 'Día 2', 4, 'Jalón al pecho', 'media', 2, 10, 12, 3, 90, 'O, en su lugar, remo en máquina, con las mismas series y repeticiones.'),
    (2, 2, 'Día 2', 5, 'Plancha abdominal', 'media', 2, 25, 35, null, 90, 'O curl de bíceps: las mismas series, de 10 a 12 repeticiones.'),
    (3, 1, 'Día 1', 1, 'Prensa de piernas', 'alta', 2, 10, 12, 2, 90, 'Si no hay prensa: sentadilla a un banco, con las mismas series y repeticiones.'),
    (3, 1, 'Día 1', 2, 'Peso muerto rumano con mancuernas', 'alta', 2, 10, 12, 2, 90, 'O, en su lugar, puente de glúteo, con las mismas series y repeticiones.'),
    (3, 1, 'Día 1', 3, 'Press de pecho en máquina', 'media', 2, 10, 12, 2, 90, 'O flexiones, con más o menos inclinación según tu nivel.'),
    (3, 1, 'Día 1', 4, 'Jalón al pecho', 'media', 2, 10, 12, 2, 90, 'O, en su lugar, remo en máquina, con las mismas series y repeticiones.'),
    (3, 1, 'Día 1', 5, 'Plancha abdominal', 'media', 2, 30, 40, null, 90, 'O curl de bíceps: las mismas series, de 10 a 12 repeticiones.'),
    (3, 2, 'Día 2', 1, 'Prensa de piernas', 'alta', 2, 10, 12, 2, 90, 'Si no hay prensa: sentadilla a un banco, con las mismas series y repeticiones.'),
    (3, 2, 'Día 2', 2, 'Peso muerto rumano con mancuernas', 'alta', 2, 10, 12, 2, 90, 'O, en su lugar, puente de glúteo, con las mismas series y repeticiones.'),
    (3, 2, 'Día 2', 3, 'Press de pecho en máquina', 'media', 2, 10, 12, 2, 90, 'O flexiones, con más o menos inclinación según tu nivel.'),
    (3, 2, 'Día 2', 4, 'Jalón al pecho', 'media', 2, 10, 12, 2, 90, 'O, en su lugar, remo en máquina, con las mismas series y repeticiones.'),
    (3, 2, 'Día 2', 5, 'Plancha abdominal', 'media', 2, 30, 40, null, 90, 'O curl de bíceps: las mismas series, de 10 a 12 repeticiones.'),
    (4, 1, 'Día 1', 1, 'Prensa de piernas', 'alta', 3, 10, 12, 2, 90, 'Si no hay prensa: sentadilla a un banco, con las mismas series y repeticiones.'),
    (4, 1, 'Día 1', 2, 'Peso muerto rumano con mancuernas', 'alta', 3, 10, 12, 2, 90, 'O, en su lugar, puente de glúteo, con las mismas series y repeticiones.'),
    (4, 1, 'Día 1', 3, 'Press de pecho en máquina', 'media', 2, 10, 12, 2, 90, 'O flexiones, con más o menos inclinación según tu nivel.'),
    (4, 1, 'Día 1', 4, 'Jalón al pecho', 'media', 2, 10, 12, 2, 90, 'O, en su lugar, remo en máquina, con las mismas series y repeticiones.'),
    (4, 1, 'Día 1', 5, 'Plancha abdominal', 'media', 2, 35, 45, null, 90, 'O curl de bíceps: las mismas series, de 10 a 12 repeticiones.'),
    (4, 2, 'Día 2', 1, 'Prensa de piernas', 'alta', 3, 10, 12, 2, 90, 'Si no hay prensa: sentadilla a un banco, con las mismas series y repeticiones.'),
    (4, 2, 'Día 2', 2, 'Peso muerto rumano con mancuernas', 'alta', 3, 10, 12, 2, 90, 'O, en su lugar, puente de glúteo, con las mismas series y repeticiones.'),
    (4, 2, 'Día 2', 3, 'Press de pecho en máquina', 'media', 2, 10, 12, 2, 90, 'O flexiones, con más o menos inclinación según tu nivel.'),
    (4, 2, 'Día 2', 4, 'Jalón al pecho', 'media', 2, 10, 12, 2, 90, 'O, en su lugar, remo en máquina, con las mismas series y repeticiones.'),
    (4, 2, 'Día 2', 5, 'Plancha abdominal', 'media', 2, 35, 45, null, 90, 'O curl de bíceps: las mismas series, de 10 a 12 repeticiones.')
      ) as t(semana, sesion, nombre_sesion, orden, ejercicio, prioridad, series, reps_min, reps_max, rir, descanso, nota)
      where t.semana = w.numero and t.sesion = s.orden loop
        insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, prioridad, series, reps_min, reps_max, rir_objetivo, descanso_seg, notas_coach)
        values (v_ses, (select id from public.ejercicios where nombre = e.ejercicio order by creado_en limit 1), e.orden, e.prioridad, e.series, e.reps_min, e.reps_max, e.rir, e.descanso, e.nota);
      end loop;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. La plantilla según su cuestionario (igual que plantillaEsencial() en logica/esencial.js)
-- ---------------------------------------------------------------------
-- Nunca ha entrenado: «Primeras 4 semanas». Si ha entrenado: en el gimnasio, la full body o el torso-pierna de sus días,
-- variante A (barra y básicos) con 3 años o más y barra entre su material, si no B (máquinas y mancuernas); en casa o al
-- aire libre, la de casa según sus días y su material.
create or replace function fbe_privado.esencial_plantilla(p_experiencia text, p_dias int, p_lugar text, p_material text[])
returns text language sql immutable set search_path = '' as $$
  select case
    when coalesce(p_experiencia, 'ninguna') = 'ninguna' then 'Primeras 4 semanas'
    when coalesce(p_lugar, 'gimnasio') in ('gimnasio', 'gimnasio_basico') then
      case when coalesce(p_dias, 2) <= 2 then '2 días · Full body'
           when p_dias = 3 then '3 días · Full body'
           when p_dias = 4 then '4 días · Torso-pierna'
           else '5 días · PPL + torso-pierna' end
      || case when p_experiencia in ('3_5', 'mas_5') and 'barra' = any (coalesce(p_material, array[]::text[])) then ' · A · Barra y básicos' else ' · B · Máquinas y mancuernas' end
    when coalesce(p_dias, 2) <= 2 then '2 días · Full body en casa, sin material'
    when p_dias = 3 then case when 'mancuernas' = any (coalesce(p_material, array[]::text[])) and 'banco' = any (coalesce(p_material, array[]::text[])) then '3 días · Full body con mancuernas y banco'
                              when 'gomas' = any (coalesce(p_material, array[]::text[])) then '3 días · Full body con gomas'
                              else '3 días · Full body en casa, sin material' end
    else case when 'mancuernas' = any (coalesce(p_material, array[]::text[])) and 'banco' = any (coalesce(p_material, array[]::text[])) then '4 días · Torso-pierna con mancuernas y banco'
              else '4 días · Torso-pierna con gomas y peso corporal' end
  end
$$;

-- La copia de una plantilla a nombre de un atleta (como crear_bloque_desde_plantilla, que es solo del coach, con la
-- semana de marcas), con las semanas publicadas
create or replace function fbe_privado.esencial_copiar_plantilla(p_plantilla uuid, p_atleta uuid, p_inicio date)
returns uuid language plpgsql set search_path = '' as $$
declare
  v_pl public.bloques;
  v_bloque uuid;
  v_n int;
  w record;
  s record;
  v_sem uuid;
  v_ses uuid;
begin
  select * into v_pl from public.bloques where id = p_plantilla and es_plantilla;
  if not found then raise exception 'Plantilla no encontrada'; end if;
  select count(*) into v_n from public.semanas where bloque_id = p_plantilla;
  insert into public.bloques (atleta_id, numero, nombre, foco, objetivo, descripcion, fecha_inicio, fecha_fin, estado)
  values (p_atleta, (select coalesce(max(numero), 0) + 1 from public.bloques where atleta_id = p_atleta),
          v_pl.nombre, v_pl.foco, v_pl.objetivo, v_pl.descripcion, p_inicio, p_inicio + greatest(v_n, 1) * 7 - 1,
          case when exists (select 1 from public.bloques where atleta_id = p_atleta and not es_plantilla and estado in ('activo', 'ajustado')) then 'planificado' else 'activo' end)
  returning id into v_bloque;
  for w in select * from public.semanas where bloque_id = p_plantilla order by numero loop
    insert into public.semanas (bloque_id, numero, foco, fecha_inicio, nota_coach, programacion, marcas)
    values (v_bloque, w.numero, w.foco, p_inicio + (w.numero - 1) * 7, w.nota_coach, 'programada', w.marcas)
    returning id into v_sem;
    for s in select * from public.sesiones where semana_id = w.id order by orden loop
      insert into public.sesiones (semana_id, orden, nombre, tipo, intencion, dinamica, cardio)
      values (v_sem, s.orden, s.nombre, s.tipo, s.intencion, s.dinamica, s.cardio)
      returning id into v_ses;
      insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, superserie, prioridad, series, reps_min, reps_max, rir_objetivo,
        rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante, backoff_pct, series_detalle)
      select v_ses, ejercicio_id, orden, superserie, prioridad, series, reps_min, reps_max, rir_objetivo, rpe_objetivo, carga_sugerida_kg,
             descanso_seg, tempo, notas_coach, variante, backoff_pct, series_detalle
      from public.sesion_ejercicios where sesion_id = s.id;
    end loop;
  end loop;
  return v_bloque;
end $$;

-- ---------------------------------------------------------------------
-- 6. Asignar su plan y pedir el visto bueno
-- ---------------------------------------------------------------------
-- Devuelve el bloque (el que ya tuviera de FBE Esencial, si lo tiene: se puede llamar más de una vez).
create or replace function public.esencial_asignar_plan(p_atleta uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := coalesce(p_atleta, public.mi_atleta_id());
  v_at public.atletas;
  v_c public.cuestionarios;
  v_nombre text;
  v_pl uuid;
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_lunes date;
  v_inicio date;
  v_bloque uuid;
begin
  if v_id is null then raise exception 'No hay atleta' using errcode = 'P0002'; end if;
  if not public.es_coach() and public.mi_atleta_id() is distinct from v_id then
    raise exception 'Solo puedes pedir tu propio plan' using errcode = '42501';
  end if;
  select * into v_at from public.atletas where id = v_id;
  if not found then raise exception 'Ese atleta no existe' using errcode = 'P0002'; end if;
  if v_at.modalidad <> 'por_su_cuenta' then raise exception 'Solo para quien va por su cuenta (FBE Esencial)' using errcode = '22023'; end if;
  -- Ya tiene su plan
  select id into v_bloque from public.bloques where atleta_id = v_id and not es_plantilla and estado in ('activo', 'ajustado', 'planificado') order by fecha_inicio desc nulls last limit 1;
  if v_bloque is not null then
    return jsonb_build_object('bloque', v_bloque, 'nuevo', false);
  end if;
  select * into v_c from public.cuestionarios where atleta_id = v_id;
  if not found or v_c.completado_en is null or v_c.resultado is null then
    raise exception 'Antes, el cuestionario (con la parte de salud)' using errcode = '22023';
  end if;
  if v_c.resultado <> 'sin_valoracion' and v_at.visto_bueno_en is null then
    raise exception 'Antes de empezar, el visto bueno médico' using errcode = '22023';
  end if;
  v_nombre := fbe_privado.esencial_plantilla(v_c.experiencia, v_c.dias_semana, v_c.lugar, v_c.material);
  select id into v_pl from public.bloques where es_plantilla and nombre = v_nombre order by creado_en limit 1;
  if v_pl is null then
    select id into v_pl from public.bloques where es_plantilla and nombre = 'Primeras 4 semanas' order by creado_en limit 1;
  end if;
  if v_pl is null then raise exception 'No está la plantilla «Primeras 4 semanas»' using errcode = 'P0002'; end if;
  -- Su lunes: el de su tanda si es esta semana o después; si ya pasó, el de esta semana; sin tanda, el próximo lunes
  v_lunes := fbe_privado.lunes_de(v_hoy);
  v_inicio := case when v_at.esencial_inicio is null then case when v_hoy = v_lunes then v_hoy else v_lunes + 7 end
                   when v_at.esencial_inicio >= v_lunes then v_at.esencial_inicio
                   else v_lunes end;
  v_bloque := fbe_privado.esencial_copiar_plantilla(v_pl, v_id, v_inicio);
  return jsonb_build_object('bloque', v_bloque, 'nuevo', true, 'plantilla', (select nombre from public.bloques where id = v_pl), 'inicio', v_inicio);
end $$;

-- El atleta dice que ya tiene el visto bueno médico (o ha hecho la Puesta a punto): lo confirma el coach
create or replace function public.esencial_pedir_visto_bueno()
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_id uuid := public.mi_atleta_id(); v_t timestamptz;
begin
  if v_id is null then raise exception 'No hay atleta' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.atletas where id = v_id and modalidad = 'por_su_cuenta') then
    raise exception 'Solo para quien va por su cuenta (FBE Esencial)' using errcode = '22023';
  end if;
  if not public.consentimiento_salud_de_atleta(v_id) then
    raise exception 'Hace falta tu consentimiento de salud' using errcode = '22023';
  end if;
  update public.atletas set visto_bueno_pedido_en = now() where id = v_id returning visto_bueno_pedido_en into v_t;
  return v_t;
end $$;

-- ---------------------------------------------------------------------
-- 7. Permisos (como al final de 003 a 090)
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

insert into public.fbe_migraciones (numero) values (91)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
