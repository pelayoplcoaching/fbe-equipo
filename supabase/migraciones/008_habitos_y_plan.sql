-- =====================================================================
-- FBE Atletas, migración 008 (v0.10)
-- 1. Hábitos diarios: el coach le pone a cada atleta unos pocos hábitos (pasos, proteína, agua, sueño
--    o uno de sí/no) con su objetivo, y el atleta los apunta cada día. Con consentimiento de salud.
-- 2. Serie top + back-off: en una pauta, la primera serie es la top y el resto van un % por debajo de
--    lo que el atleta hizo de verdad en ella (la app calcula la carga).
-- 3. Pose de las fotos de progreso (frente, perfil, espalda), para comparar siempre la misma.
-- 4. Plan de la semana: el atleta elige qué día hará cada sesión (sin que la sesión vuelva a
--    «por revisar» por eso). Si el coach mueve la semana, el plan se mueve con ella.
-- 5. Series: mismo error para una pauta ajena que para una que no existe.
-- Y desde esta versión, cada migración (002 a 008) se apunta en fbe_migraciones al terminar y se niega
-- a repetirse si la base ya tiene una posterior (repetir la 002 sobre la 008 deshacía cambios en silencio).
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 007. Se puede repetir sin
-- romper nada: las restricciones tienen nombre y se vuelven a crear con la versión vigente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guardia: si la base ya tiene una migración posterior, esta no se repite (desharía lo que
-- cambiaron las siguientes). Al terminar, queda apuntada en fbe_migraciones.
-- ---------------------------------------------------------------------
create table if not exists public.fbe_migraciones (
  numero      smallint primary key,
  aplicada_en timestamptz not null default now()
);
alter table public.fbe_migraciones enable row level security;
revoke all on public.fbe_migraciones from public, anon, authenticated;
do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 8 then
    raise exception 'Esta base ya tiene la migración %: repetir la 008 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 8;» y, después de ella, todas las siguientes en orden.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Hábitos
-- ---------------------------------------------------------------------
create table if not exists public.habitos (
  id           uuid primary key default gen_random_uuid(),
  atleta_id    uuid not null references public.atletas(id) on delete cascade,
  nombre       text not null,
  tipo         text not null default 'numero',
  objetivo     numeric(8,2),
  unidad       text,
  sentido      text not null default 'al_menos',  -- al_menos: llegar al objetivo · como_mucho: no pasarse
  dias_semana  smallint not null default 7,       -- cuántos días a la semana se pide
  icono        text not null default 'libre',
  orden        smallint not null default 0,
  activo       boolean not null default true,     -- se archiva en lugar de borrarlo, para no perder lo apuntado
  creado_en    timestamptz not null default now()
);
create index if not exists habitos_atleta_idx on public.habitos (atleta_id);

-- El nombre (y la unidad) tienen que llevar algo visible: no valen solo espacios ni caracteres invisibles
alter table public.habitos drop constraint if exists habitos_valido;
alter table public.habitos add constraint habitos_valido check (
  char_length(nombre) between 1 and 60 and nombre ~ E'[^[:space:]\u00a0\u00ad\u115f\u1160\u180e\u200b-\u200f\u2060-\u2064\u2800\u3164\ufeff\uffa0]'
  and tipo in ('numero', 'si_no')
  and sentido in ('al_menos', 'como_mucho')
  and dias_semana between 1 and 7
  and icono in ('pasos', 'proteina', 'agua', 'sueno', 'movilidad', 'verdura', 'libre')
  and orden between 0 and 99
  and (unidad is null or (char_length(unidad) between 1 and 12 and unidad ~ E'[^[:space:]\u00a0\u00ad\u115f\u1160\u180e\u200b-\u200f\u2060-\u2064\u2800\u3164\ufeff\uffa0]'))
  and case tipo
        when 'numero' then objetivo is not null and objetivo > 0 and objetivo < 1000000
        else objetivo is null and unidad is null and sentido = 'al_menos'
      end
);

alter table public.habitos enable row level security;
drop policy if exists coach_todo on public.habitos;
create policy coach_todo on public.habitos for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
-- El atleta ve los suyos (también los archivados, para su historial); no los cambia
drop policy if exists atleta_ver on public.habitos;
create policy atleta_ver on public.habitos for select to authenticated
  using (atleta_id = public.mi_atleta_id());

-- Un hábito no cambia de atleta (sus días apuntados quedarían con el anterior) ni, si ya tiene días
-- apuntados, de número a sí/no o al revés (9000 pasos pasarían a ser «hecho»). Para eso se quita y se crea otro.
create or replace function public.proteger_habito() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.atleta_id is distinct from old.atleta_id then
    raise exception 'Un hábito no se puede pasar a otro atleta: créale uno nuevo' using errcode = '42501';
  end if;
  if new.tipo is distinct from old.tipo and exists (select 1 from public.registros_habito r where r.habito_id = old.id) then
    raise exception 'Este hábito ya tiene días apuntados: para apuntarlo de otra forma, quítalo y crea otro' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists habitos_proteger on public.habitos;
create trigger habitos_proteger before update on public.habitos
  for each row execute function public.proteger_habito();

create table if not exists public.registros_habito (
  id              uuid primary key default gen_random_uuid(),
  habito_id       uuid not null references public.habitos(id) on delete cascade,
  atleta_id       uuid not null references public.atletas(id) on delete cascade,  -- lo pone el trigger
  fecha           date not null,
  valor           numeric(9,2) not null,  -- en los de sí/no: 1 hecho, 0 no · dos decimales: 0,25 l, 7,5 h
  actualizado_en  timestamptz not null default now(),
  unique (habito_id, fecha)
);
create index if not exists registros_habito_atleta_idx on public.registros_habito (atleta_id, fecha desc);
-- Dos decimales (0,25 l de agua): por si se creó con una versión anterior de esta migración, que guardaba uno
alter table public.habitos alter column objetivo type numeric(8,2);
alter table public.registros_habito alter column valor type numeric(9,2);

alter table public.registros_habito drop constraint if exists registros_habito_valor_valido;
alter table public.registros_habito add constraint registros_habito_valor_valido
  check (valor >= 0 and valor < 1000000 and fecha >= date '2020-01-01' and fecha < date '2100-01-01');

-- ¿Tiene consentimiento de salud este atleta? Solo responde al propio atleta y al coach
-- (a cualquier otro le devuelve false: no revela nada de nadie). Como consentimiento_salud_de_semana (005).
create or replace function public.consentimiento_salud_de_atleta(p_atleta uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.atletas a
    join public.consentimientos c on c.perfil_id = a.perfil_id
    where a.id = p_atleta and c.tipo = 'datos_salud' and c.revocado_en is null
      and (a.id = public.mi_atleta_id() or public.es_coach()));
$$;

-- El atleta de cada registro es siempre el del hábito; los de sí/no solo valen 0 o 1; nada en el futuro
-- (con un día de margen por las zonas horarias) y nada en un hábito archivado (salvo el coach).
-- Son datos de salud: como en 005, hace falta el consentimiento del atleta los escriba quien los escriba
-- desde la app (también el coach). Borrarlos se puede siempre.
-- Sin «security definer» a propósito: el hábito se lee con los permisos de quien escribe, así que a un atleta
-- uno ajeno le resulta igual de invisible que uno que no existe (y current_user sigue siendo el suyo).
create or replace function public.registro_habito_preparar()
returns trigger language plpgsql set search_path = '' as $$
declare
  h public.habitos;
begin
  select * into h from public.habitos where id = new.habito_id;
  -- A quien no es el coach, un hábito que no existe y uno de otro atleta le dan el mismo error (no revela nada)
  if not found or (current_user in ('authenticated', 'anon') and not public.es_coach()
                   and h.atleta_id is distinct from public.mi_atleta_id()) then
    raise exception 'No puedes apuntar en ese hábito' using errcode = '42501';
  end if;
  new.atleta_id := h.atleta_id;
  new.actualizado_en := now();
  if h.tipo = 'si_no' and new.valor not in (0, 1) then
    raise exception 'Un hábito de sí o no se apunta con 1 (hecho) o 0 (no)' using errcode = '23514';
  end if;
  if current_user in ('authenticated', 'anon') and not public.consentimiento_salud_de_atleta(h.atleta_id) then
    raise exception 'Para apuntar hábitos hace falta el consentimiento de datos de salud del atleta' using errcode = '42501';
  end if;
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    if not h.activo then
      raise exception 'Ese hábito ya no está activo' using errcode = '42501';
    end if;
    if new.fecha > (now() at time zone 'Europe/Madrid')::date + 1 then
      raise exception 'No se puede apuntar un día que aún no ha llegado' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
-- «aa» para que vaya antes que el de la baja y el resto (los BEFORE van por orden alfabético)
drop trigger if exists registros_habito_aa_preparar on public.registros_habito;
create trigger registros_habito_aa_preparar before insert or update on public.registros_habito
  for each row execute function public.registro_habito_preparar();
drop trigger if exists registros_habito_exigir_alta on public.registros_habito;
create trigger registros_habito_exigir_alta before insert or update on public.registros_habito
  for each row execute function public.exigir_alta();

alter table public.registros_habito enable row level security;
drop policy if exists coach_todo on public.registros_habito;
create policy coach_todo on public.registros_habito for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
-- Como el resto de datos de salud: los suyos, y para escribir, con consentimiento vigente
drop policy if exists atleta_ver on public.registros_habito;
create policy atleta_ver on public.registros_habito for select to authenticated
  using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_crear on public.registros_habito;
create policy atleta_crear on public.registros_habito for insert to authenticated
  with check (atleta_id = public.mi_atleta_id() and public.tiene_consentimiento_salud());
drop policy if exists atleta_editar on public.registros_habito;
create policy atleta_editar on public.registros_habito for update to authenticated
  using (atleta_id = public.mi_atleta_id())
  with check (atleta_id = public.mi_atleta_id() and public.tiene_consentimiento_salud());
drop policy if exists atleta_borrar on public.registros_habito;
create policy atleta_borrar on public.registros_habito for delete to authenticated
  using (atleta_id = public.mi_atleta_id());

-- ---------------------------------------------------------------------
-- 2. Serie top + back-off
-- ---------------------------------------------------------------------
alter table public.sesion_ejercicios add column if not exists backoff_pct numeric(4,1);
alter table public.sesion_ejercicios drop constraint if exists sesion_ejercicios_backoff_valido;
alter table public.sesion_ejercicios add constraint sesion_ejercicios_backoff_valido
  check (backoff_pct is null or (backoff_pct >= 1 and backoff_pct <= 50 and series >= 2));

-- Las funciones de copia (por si se usan desde el SQL Editor) copian también el back-off
create or replace function public.duplicar_semana(
  p_semana uuid, p_kg_extra numeric default 0, p_reps_extra int default 0, p_rir_delta numeric default 0)
returns uuid language plpgsql set search_path = public as $$
declare
  v_old   public.semanas;
  v_nueva uuid;
  s       record;
  v_ses   uuid;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  select * into v_old from public.semanas where id = p_semana;
  if not found then raise exception 'Semana no encontrada'; end if;

  insert into public.semanas (bloque_id, numero, foco, fecha_inicio, programacion)
  values (v_old.bloque_id,
          (select max(numero) + 1 from public.semanas where bloque_id = v_old.bloque_id),
          v_old.foco, v_old.fecha_inicio + 7, 'en_programacion')
  returning id into v_nueva;

  for s in select * from public.sesiones where semana_id = p_semana order by orden loop
    insert into public.sesiones (semana_id, orden, nombre, tipo, intencion, dinamica)
    values (v_nueva, s.orden, s.nombre, s.tipo, s.intencion, s.dinamica)
    returning id into v_ses;

    insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, superserie, prioridad, series,
      reps_min, reps_max, rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante,
      backoff_pct)
    select v_ses, ejercicio_id, orden, superserie, prioridad, series,
           reps_min + p_reps_extra, reps_max + p_reps_extra,
           greatest(rir_objetivo + p_rir_delta, 0), rpe_objetivo,
           case when carga_sugerida_kg is null then null else carga_sugerida_kg + p_kg_extra end,
           descanso_seg, tempo, notas_coach, variante, backoff_pct
    from public.sesion_ejercicios where sesion_id = s.id;
  end loop;
  return v_nueva;
end $$;

create or replace function public.crear_bloque_desde_plantilla(
  p_plantilla uuid, p_atleta uuid, p_fecha_inicio date, p_numero int default null)
returns uuid language plpgsql set search_path = public as $$
declare
  v_pl     public.bloques;
  v_bloque uuid;
  w        record;
  s        record;
  v_sem    uuid;
  v_ses    uuid;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  select * into v_pl from public.bloques where id = p_plantilla and es_plantilla;
  if not found then raise exception 'Plantilla no encontrada'; end if;

  insert into public.bloques (atleta_id, numero, nombre, foco, objetivo, descripcion, fecha_inicio, estado)
  values (p_atleta,
          coalesce(p_numero, (select coalesce(max(numero), 0) + 1 from public.bloques where atleta_id = p_atleta)),
          v_pl.nombre, v_pl.foco, v_pl.objetivo, v_pl.descripcion, p_fecha_inicio, 'planificado')
  returning id into v_bloque;

  for w in select * from public.semanas where bloque_id = p_plantilla order by numero loop
    insert into public.semanas (bloque_id, numero, foco, fecha_inicio, nota_coach, programacion)
    values (v_bloque, w.numero, w.foco, p_fecha_inicio + (w.numero - 1) * 7, w.nota_coach, 'en_programacion')
    returning id into v_sem;
    for s in select * from public.sesiones where semana_id = w.id order by orden loop
      insert into public.sesiones (semana_id, orden, nombre, tipo, intencion, dinamica)
      values (v_sem, s.orden, s.nombre, s.tipo, s.intencion, s.dinamica)
      returning id into v_ses;
      insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, superserie, prioridad, series,
        reps_min, reps_max, rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante,
        backoff_pct)
      select v_ses, ejercicio_id, orden, superserie, prioridad, series, reps_min, reps_max,
             rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante, backoff_pct
      from public.sesion_ejercicios where sesion_id = s.id;
    end loop;
  end loop;
  return v_bloque;
end $$;

-- ---------------------------------------------------------------------
-- 3. Pose de las fotos de progreso
-- ---------------------------------------------------------------------
alter table public.archivos add column if not exists pose text;
alter table public.archivos drop constraint if exists archivos_pose_valida;
alter table public.archivos add constraint archivos_pose_valida
  check (pose is null or (tipo = 'foto_progreso' and pose in ('frente', 'perfil', 'espalda')));

-- ---------------------------------------------------------------------
-- 4. Plan de la semana
-- ---------------------------------------------------------------------
alter table public.sesiones add column if not exists dia_previsto date;

-- El día previsto tiene que caer en la semana de la sesión (de su lunes a su domingo). Si la sesión
-- cambia de semana (solo lo puede hacer el coach), el día previsto se quita, salvo que venga uno nuevo.
-- Sin «security definer» a propósito: la semana se lee con los permisos de quien escribe, así que a un
-- atleta una semana ajena (o aún sin publicar) le da el mismo error que una que no existe.
create or replace function public.sesion_dia_previsto_valido()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_inicio date;
begin
  if tg_op = 'UPDATE' and new.semana_id is distinct from old.semana_id
     and new.dia_previsto is not distinct from old.dia_previsto then
    new.dia_previsto := null;
  end if;
  if new.dia_previsto is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.dia_previsto is not distinct from old.dia_previsto
     and new.semana_id is not distinct from old.semana_id then
    return new;
  end if;
  select fecha_inicio into v_inicio from public.semanas where id = new.semana_id;
  if v_inicio is null or new.dia_previsto < v_inicio or new.dia_previsto > v_inicio + 6 then
    raise exception 'El día previsto tiene que estar dentro de la semana de la sesión' using errcode = '23514';
  end if;
  return new;
end $$;
-- «q» para que vaya después de la baja y de sesiones_proteger (los BEFORE van por orden alfabético):
-- quien no puede tocar la sesión recibe ese error, no uno sobre la fecha
drop trigger if exists sesiones_dia_previsto on public.sesiones;
drop trigger if exists sesiones_q_dia_previsto on public.sesiones;
create trigger sesiones_q_dia_previsto before insert or update on public.sesiones
  for each row execute function public.sesion_dia_previsto_valido();

-- Lo que cambia el atleta en una sesión vuelve a quedar pendiente de revisar, salvo si solo cambia el día
-- previsto (planificar la semana no es algo que revisar). La prescripción sigue siendo solo del coach.
create or replace function public.proteger_sesion() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    if (new.id, new.semana_id, new.orden, new.nombre, new.tipo, new.intencion, new.dinamica)
       is distinct from
       (old.id, old.semana_id, old.orden, old.nombre, old.tipo, old.intencion, old.dinamica) then
      raise exception 'Solo el coach puede cambiar la prescripción de la sesión' using errcode = '42501';
    end if;
    if (to_jsonb(new) - 'dia_previsto' - 'revisada_en') is distinct from (to_jsonb(old) - 'dia_previsto' - 'revisada_en') then
      new.revisada_en := null;
    else
      new.revisada_en := old.revisada_en;
    end if;
  end if;
  return new;
end $$;

-- Si el coach mueve una semana de fecha, el plan del atleta se mueve con ella (mismo día de la semana)
create or replace function public.semana_mover_plan()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.fecha_inicio is distinct from old.fecha_inicio then
    if new.fecha_inicio is null or old.fecha_inicio is null then
      update public.sesiones set dia_previsto = null where semana_id = new.id and dia_previsto is not null;
    else
      update public.sesiones set dia_previsto = dia_previsto + (new.fecha_inicio - old.fecha_inicio)
      where semana_id = new.id and dia_previsto is not null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists semanas_mover_plan on public.semanas;
create trigger semanas_mover_plan after update of fecha_inicio on public.semanas
  for each row execute function public.semana_mover_plan();

-- ---------------------------------------------------------------------
-- 5. Series: a un atleta, una pauta ajena, una de plantilla y una que no existe le dan el mismo error
--    (antes, la ajena daba el de permisos y las otras el de plantilla: confirmaba que existía).
--    Es «security definer» (lee la pauta aunque el atleta no la vea), así que se distingue por quién
--    ha entrado, no por current_user.
-- ---------------------------------------------------------------------
create or replace function public.serie_fijar_atleta() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_yo uuid := public.mi_atleta_id();
begin
  select b.atleta_id into new.atleta_id
  from public.sesion_ejercicios se
  join public.sesiones s on s.id = se.sesion_id
  join public.semanas w on w.id = s.semana_id
  join public.bloques b on b.id = w.bloque_id
  where se.id = new.sesion_ejercicio_id;
  if v_yo is not null and not public.es_coach() then
    if new.atleta_id is distinct from v_yo then
      raise exception 'No puedes registrar series en esa pauta' using errcode = '42501';
    end if;
  elsif new.atleta_id is null then
    raise exception 'No se pueden registrar series en una plantilla';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Permisos (como al final de 003 a 007)
-- ---------------------------------------------------------------------
revoke all on public.habitos, public.registros_habito from anon;
grant select, insert, update, delete on public.habitos, public.registros_habito to authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Apuntada: desde aquí, la base no deja repetir por error las migraciones anteriores a esta
insert into public.fbe_migraciones (numero) values (8)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
