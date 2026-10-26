-- =====================================================================
-- FBE Atletas, migración 011 (v0.13): cuestionario inicial y check-in a medida
-- 1. Cuestionario inicial: objetivo, experiencia y tiempo, dónde entrena y con qué, y la salud (cribado previo
--    al ejercicio según el algoritmo de la ACSM de 2015: si ya hace ejercicio, si tiene una enfermedad
--    cardiovascular, metabólica o renal conocida y si tiene síntomas; Riebe y cols., Med Sci Sports Exerc
--    2015;47:2473-9, doi:10.1249/MSS.0000000000000664), lesiones y alergias. La recomendación la calcula la
--    base. La parte de salud necesita el consentimiento del atleta, la escriba quien la escriba.
-- 2. Check-in a medida: qué apartados se le preguntan a cada atleta y preguntas propias del coach (para uno o
--    para todos), con sus respuestas en cada check-in, comprobadas por la base.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 010 (o con instalar.sql en una
-- base nueva). Se puede repetir sin romper nada.
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
  if v > 11 then
    raise exception 'Esta base ya tiene la migración %: repetir la 011 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 11;» y, después de ella, todas las siguientes en orden.';
  end if;
  -- Y antes, la anterior: la 011 usa las notificaciones de la 010
  if not exists (select 1 from public.fbe_migraciones where numero = 10) then
    raise exception 'Antes de la 011 hace falta la 010: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Cuestionario inicial (uno por atleta; se actualiza cuando el coach lo pide)
-- ---------------------------------------------------------------------
create table if not exists public.cuestionarios (
  id                  uuid primary key default gen_random_uuid(),
  atleta_id           uuid not null unique references public.atletas(id) on delete cascade,
  -- Lo que quiere y cómo puede entrenar (no son datos de salud)
  objetivo            text,          -- fuerza · musculo · perder_grasa · salud · rendimiento · otro
  objetivo_detalle    text,
  experiencia         text,          -- años entrenando fuerza: ninguna · menos_1 · 1_3 · 3_5 · mas_5
  dias_semana         smallint,
  minutos_sesion      smallint,
  lugar               text,          -- gimnasio · gimnasio_basico · casa · aire_libre
  material            text[] not null default '{}',
  otros_deportes      text,
  -- Salud (con su consentimiento)
  activo              boolean,       -- ¿hace ejercicio estructurado (3 días a la semana, 30 min, moderado) desde hace 3 meses?
  enfermedad          boolean,       -- ¿enfermedad cardiovascular, metabólica (diabetes) o renal diagnosticada?
  enfermedad_detalle  text,
  sintomas            text[],        -- los de la ACSM que hacen pensar en una de esas enfermedades ('{}' = ninguno)
  otras               text[],        -- embarazo, posparto, cirugía reciente, medicación, limitación médica
  medicacion_detalle  text,
  lesiones            jsonb,         -- [{ zona, limita (0 no, 1 algo, 2 mucho), nota }]
  alergias            text,          -- alergias o intolerancias alimentarias
  resultado           text,          -- lo calcula la base: sin_valoracion · valorar_antes_vigoroso · valorar_antes · parar_y_valorar
  completado_en       timestamptz,
  pedido_en           timestamptz,   -- el coach pide que lo rellene o lo actualice
  revisado_en         timestamptz,   -- el coach ha revisado la parte de salud
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now()
);

-- Lesiones: como mucho 10, cada una con su zona, cuánto le limita y una nota corta
create or replace function public.lesiones_validas(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'array' and jsonb_array_length(j) <= 10 and not exists (
    select 1 from jsonb_array_elements(j) e
    where jsonb_typeof(e) <> 'object'
       or exists (select 1 from jsonb_object_keys(e) k where k not in ('zona', 'limita', 'nota'))
       or coalesce(e ->> 'zona', '') not in ('cuello', 'hombro', 'codo', 'muneca_mano', 'espalda_alta', 'zona_lumbar',
                                             'cadera', 'rodilla', 'tobillo_pie', 'otra')
       or jsonb_typeof(e -> 'limita') is distinct from 'number' or (e ->> 'limita') not in ('0', '1', '2')
       or (e ? 'nota' and jsonb_typeof(e -> 'nota') <> 'null'
           and (jsonb_typeof(e -> 'nota') <> 'string' or char_length(e ->> 'nota') > 200 or not public.texto_visible(e ->> 'nota')))
  )
$$;

alter table public.cuestionarios drop constraint if exists cuestionarios_valido;
alter table public.cuestionarios add constraint cuestionarios_valido check (
  (objetivo is null or objetivo in ('fuerza', 'musculo', 'perder_grasa', 'salud', 'rendimiento', 'otro'))
  and (objetivo_detalle is null or (char_length(objetivo_detalle) <= 600 and public.texto_visible(objetivo_detalle)))
  and (experiencia is null or experiencia in ('ninguna', 'menos_1', '1_3', '3_5', 'mas_5'))
  and (dias_semana is null or dias_semana between 1 and 7)
  and (minutos_sesion is null or minutos_sesion between 15 and 240)
  and (lugar is null or lugar in ('gimnasio', 'gimnasio_basico', 'casa', 'aire_libre'))
  and material <@ array['barra', 'rack', 'banco', 'mancuernas', 'kettlebells', 'poleas', 'maquinas', 'gomas',
                        'dominadas', 'cardio']::text[]
  and (otros_deportes is null or (char_length(otros_deportes) <= 200 and public.texto_visible(otros_deportes)))
  and (enfermedad_detalle is null or (char_length(enfermedad_detalle) <= 300 and public.texto_visible(enfermedad_detalle)))
  and (sintomas is null or sintomas <@ array['dolor_pecho', 'falta_aire', 'mareo', 'palpitaciones', 'tobillos',
                                             'claudicacion', 'soplo', 'fatiga', 'ortopnea']::text[])
  and (otras is null or otras <@ array['embarazo', 'posparto', 'cirugia', 'medicacion', 'limitacion_medica']::text[])
  and (medicacion_detalle is null or (char_length(medicacion_detalle) <= 300 and public.texto_visible(medicacion_detalle)))
  and (lesiones is null or public.lesiones_validas(lesiones))
  and (alergias is null or (char_length(alergias) <= 300 and public.texto_visible(alergias)))
  and (resultado is null or resultado in ('sin_valoracion', 'valorar_antes_vigoroso', 'valorar_antes', 'parar_y_valorar'))
);

-- La recomendación del cribado (ACSM 2015), con las tres respuestas:
--   con síntomas: si ya hace ejercicio, parar y que lo valore su médico; si no, valoración antes de empezar
--   enfermedad conocida sin síntomas: si ya hace ejercicio, valoración antes de subir a intensidad vigorosa
--     (puede seguir a intensidad moderada); si no, valoración antes de empezar
--   ni enfermedad ni síntomas: no hace falta valoración (empezar suave y progresar)
create or replace function public.resultado_cribado(p_activo boolean, p_enfermedad boolean, p_sintomas text[])
returns text language sql immutable set search_path = '' as $$
  select case
    when p_activo is null or p_enfermedad is null or p_sintomas is null then null
    when cardinality(p_sintomas) > 0 then case when p_activo then 'parar_y_valorar' else 'valorar_antes' end
    when p_enfermedad then case when p_activo then 'valorar_antes_vigoroso' else 'valorar_antes' end
    else 'sin_valoracion'
  end
$$;

-- Lo de salud, con consentimiento (lo escriba quien lo escriba desde la app, como en 008 y 009): hace falta
-- para poner un valor nuevo, no para dejarlo como estaba ni para borrarlo (también después de retirar el
-- consentimiento). La recomendación la pone la base; la revisión y la petición, solo el coach, con la hora de
-- la base; si cambia algo de salud, vuelve a estar por revisar. Sin «security definer»: el consentimiento se
-- mira con consentimiento_salud_de_atleta (008), que a quien no es el atleta ni el coach le dice que no.
-- En un upsert de PostgREST (insert … on conflict do update) este trigger corre primero como INSERT con la fila
-- propuesta: entonces «lo que había» es la fila que ya existe para ese atleta (si la hay), para que el upsert
-- y el update decidan lo mismo.
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
    or (new.alergias is not null and new.alergias is distinct from v_prev.alergias);
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
drop trigger if exists cuestionarios_aa_preparar on public.cuestionarios;
create trigger cuestionarios_aa_preparar before insert or update on public.cuestionarios
  for each row execute function public.cuestionario_preparar();
drop trigger if exists cuestionarios_exigir_alta on public.cuestionarios;
create trigger cuestionarios_exigir_alta before insert or update on public.cuestionarios
  for each row execute function public.exigir_alta();

alter table public.cuestionarios enable row level security;
drop policy if exists coach_todo on public.cuestionarios;
create policy coach_todo on public.cuestionarios for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.cuestionarios;
create policy atleta_ver on public.cuestionarios for select to authenticated using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_crear on public.cuestionarios;
create policy atleta_crear on public.cuestionarios for insert to authenticated with check (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_editar on public.cuestionarios;
create policy atleta_editar on public.cuestionarios for update to authenticated
  using (atleta_id = public.mi_atleta_id()) with check (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_borrar on public.cuestionarios;
create policy atleta_borrar on public.cuestionarios for delete to authenticated using (atleta_id = public.mi_atleta_id());

-- ---------------------------------------------------------------------
-- 2. Check-in a medida
-- ---------------------------------------------------------------------
-- Qué apartados del check-in se le preguntan (sin nada, todos)
alter table public.atletas add column if not exists checkin_apartados text[];
alter table public.atletas drop constraint if exists atletas_checkin_apartados_validos;
alter table public.atletas add constraint atletas_checkin_apartados_validos check (
  checkin_apartados is null
  or checkin_apartados <@ array['peso', 'descanso', 'molestias', 'alimentacion', 'medidas', 'reloj']::text[]
);

create table if not exists public.preguntas_checkin (
  id             uuid primary key default gen_random_uuid(),
  atleta_id      uuid references public.atletas(id) on delete cascade,   -- sin atleta: para todos
  texto          text not null,
  tipo           text not null default 'escala',                         -- escala (1 a 5) · numero · si_no · texto
  unidad         text,                                                   -- solo números: «h», «€», «cafés»
  ayuda          text,
  etiqueta_min   text,                                                   -- solo escala: qué es el 1…
  etiqueta_max   text,                                                   -- … y el 5
  orden          smallint not null default 0,
  activa         boolean not null default true,                          -- se archiva para no perder lo respondido
  creado_en      timestamptz not null default now()
);
create index if not exists preguntas_checkin_atleta_idx on public.preguntas_checkin (atleta_id);

alter table public.preguntas_checkin drop constraint if exists preguntas_checkin_valida;
alter table public.preguntas_checkin add constraint preguntas_checkin_valida check (
  char_length(texto) between 1 and 160 and public.texto_visible(texto)
  and tipo in ('escala', 'numero', 'si_no', 'texto')
  and (unidad is null or (tipo = 'numero' and char_length(unidad) <= 12 and public.texto_visible(unidad)))
  and (ayuda is null or (char_length(ayuda) <= 200 and public.texto_visible(ayuda)))
  and (etiqueta_min is null or (tipo = 'escala' and char_length(etiqueta_min) <= 30 and public.texto_visible(etiqueta_min)))
  and (etiqueta_max is null or (tipo = 'escala' and char_length(etiqueta_max) <= 30 and public.texto_visible(etiqueta_max)))
  and orden between 0 and 99
);

-- Con respuestas, una pregunta no cambia de tipo ni de atleta (las respuestas dejarían de cuadrar): se archiva
-- y se crea otra
-- Ni se borra: se archiva (salvo cuando se borra el atleta, que se lleva sus check-ins)
create or replace function public.proteger_pregunta_checkin() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.checkins c where c.respuestas ? old.id::text)
       and (old.atleta_id is null or exists (select 1 from public.atletas a where a.id = old.atleta_id)) then
      raise exception 'Esta pregunta ya tiene respuestas: archívala para no perderlas' using errcode = '23514';
    end if;
    return old;
  end if;
  if (new.tipo is distinct from old.tipo or new.atleta_id is distinct from old.atleta_id)
     and exists (select 1 from public.checkins c where c.respuestas ? old.id::text) then
    raise exception 'Esta pregunta ya tiene respuestas: para cambiarle el tipo o a quién va, archívala y crea otra' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists preguntas_checkin_proteger on public.preguntas_checkin;
create trigger preguntas_checkin_proteger before update or delete on public.preguntas_checkin
  for each row execute function public.proteger_pregunta_checkin();

alter table public.preguntas_checkin enable row level security;
drop policy if exists coach_todo on public.preguntas_checkin;
create policy coach_todo on public.preguntas_checkin for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
-- El atleta ve las suyas y las de todos (también las archivadas, para su historial); no las cambia
drop policy if exists atleta_ver on public.preguntas_checkin;
create policy atleta_ver on public.preguntas_checkin for select to authenticated
  using (atleta_id = public.mi_atleta_id() or (atleta_id is null and public.mi_atleta_id() is not null));

-- Las respuestas, en el check-in: { id de la pregunta: valor }
alter table public.checkins add column if not exists respuestas jsonb;

-- Cada respuesta, de una pregunta de ese atleta (o para todos) y con la forma de su tipo. Sin «security
-- definer»: la pregunta se lee con los permisos de quien escribe, así que una ajena da el mismo error que una
-- que no existe. Una respuesta que ya estaba y no cambia se deja aunque la pregunta ya no exista; en un upsert
-- (que llega aquí primero como INSERT) «lo que ya estaba» es el check-in de esa semana, si lo hay.
create or replace function public.checkin_respuestas_validar() returns trigger
language plpgsql set search_path = '' as $$
declare
  r record;
  p public.preguntas_checkin;
  v numeric;
  v_ok boolean;
  v_previas jsonb;
begin
  if new.respuestas is null then return new; end if;
  if jsonb_typeof(new.respuestas) <> 'object' or (select count(*) from jsonb_object_keys(new.respuestas)) > 100 then
    raise exception 'Respuestas del check-in no válidas' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    v_previas := old.respuestas;
  else
    select c.respuestas into v_previas from public.checkins c where c.atleta_id = new.atleta_id and c.semana_inicio = new.semana_inicio;
  end if;
  for r in select key, value from jsonb_each(new.respuestas) loop
    if v_previas is not null and v_previas -> r.key = r.value then continue; end if;
    p := null;
    if r.key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select * into p from public.preguntas_checkin q
      where q.id = r.key::uuid and (q.atleta_id = new.atleta_id or q.atleta_id is null);
    end if;
    if p.id is null then
      raise exception 'Una de las respuestas no es de una pregunta de tu check-in' using errcode = '23514';
    end if;
    v_ok := case p.tipo
         when 'escala' then jsonb_typeof(r.value) = 'number' and r.value::text in ('1', '2', '3', '4', '5')
         when 'si_no' then jsonb_typeof(r.value) = 'boolean'
         when 'texto' then jsonb_typeof(r.value) = 'string' and char_length(r.value #>> '{}') between 1 and 1000
                           and public.texto_visible(r.value #>> '{}')
         else jsonb_typeof(r.value) = 'number'
       end;
    if not coalesce(v_ok, false) then
      raise exception 'La respuesta a «%» no tiene la forma que toca', left(p.texto, 60) using errcode = '23514';
    end if;
    if p.tipo = 'numero' then
      v := (r.value #>> '{}')::numeric;
      if v < 0 or v >= 1000000 or v <> round(v, 2) then
        raise exception 'La respuesta a «%» está fuera de rango (de 0 a 999999, con dos decimales)', left(p.texto, 60) using errcode = '23514';
      end if;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists checkins_ab_respuestas on public.checkins;
create trigger checkins_ab_respuestas before insert or update of respuestas on public.checkins
  for each row execute function public.checkin_respuestas_validar();

-- ---------------------------------------------------------------------
-- 3. Notificaciones nuevas (de la 010): al coach, «Ana ha completado su cuestionario» (y «Revisa el
--    cuestionario de Ana» si cuenta síntomas entrenando antes de enviarlo); al atleta, «Tu coach te pide que
--    rellenes (o actualices) tu cuestionario». Sin nada de salud en el texto.
-- ---------------------------------------------------------------------
alter table public.notificaciones drop constraint if exists notificaciones_validas;
alter table public.notificaciones add constraint notificaciones_validas check (
  tipo in ('respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario',
           'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido', 'prueba')
  and char_length(titulo) between 1 and 80
  and (cuerpo is null or char_length(cuerpo) <= 160)
  and url in ('#hoy', '#semana', '#checkin', '#progreso', '#perfil', '#atletas', '#revisar', '#cuenta')
  and char_length(clave) between 1 and 100
  and estado in ('pendiente', 'enviando', 'enviada', 'caducada', 'fallida')
  and (canal is null or canal in ('push', 'email'))
  and intentos between 0 and 100
  and (error is null or char_length(error) <= 200)
) not valid; -- «not valid» como en la 010: si se repite esta migración con avisos posteriores (p. ej. «#mensajes», de la 014), no se para
alter table public.preferencias_notificaciones drop constraint if exists preferencias_notificaciones_validas;
alter table public.preferencias_notificaciones add constraint preferencias_notificaciones_validas check (
  desactivados <@ array['respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario',
                        'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido']::text[]
  and hora_manana between time '05:00' and time '12:00' and extract(second from hora_manana) = 0
  and hora_tarde between time '12:00' and time '23:30' and extract(second from hora_tarde) = 0
  and dia_checkin between 1 and 7
  and (silencio_desde is null) = (silencio_hasta is null)
  and (silencio_desde is null or (silencio_desde <> silencio_hasta
       and extract(second from silencio_desde) = 0 and extract(second from silencio_hasta) = 0))
);

-- notificar (010), con una regla general para el «no molestar»: lo retrasa todo menos los recordatorios (su
-- hora la ha elegido la persona) y la de prueba
create or replace function fbe_privado.notificar(
  p_usuario uuid, p_tipo text, p_titulo text, p_cuerpo text, p_url text, p_clave text,
  p_desde timestamptz default null, p_caduca timestamptz default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  pr public.preferencias_notificaciones;
  v_desde timestamptz := coalesce(p_desde, now());
  v_caduca timestamptz;
begin
  if p_usuario is null then return false; end if;
  select * into pr from public.preferencias_notificaciones where usuario_id = p_usuario;
  if p_tipo <> 'prueba' and p_tipo = any (coalesce(pr.desactivados, '{sesion_hecha}'::text[])) then return false; end if;
  if not coalesce(pr.email, false)
     and not exists (select 1 from public.suscripciones_push s where s.usuario_id = p_usuario) then
    return false;
  end if;
  if p_tipo not in ('sesion_hoy', 'checkin', 'habitos', 'nutricion', 'prueba') then
    if pr.usuario_id is null then
      v_desde := fbe_privado.fuera_de_silencio(v_desde, time '22:30', time '08:00');
    else
      v_desde := fbe_privado.fuera_de_silencio(v_desde, pr.silencio_desde, pr.silencio_hasta);
    end if;
  end if;
  v_caduca := coalesce(p_caduca, v_desde + interval '1 day');
  if v_caduca <= v_desde then return false; end if;
  insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, url, clave, enviar_desde, caduca_en)
  values (p_usuario, p_tipo, coalesce(fbe_privado.linea(p_titulo, 80), 'FBE Atletas'), fbe_privado.linea(p_cuerpo, 160),
          p_url, left(p_clave, 100), v_desde, v_caduca)
  on conflict (usuario_id, clave) do nothing;
  return found;
end $$;

create or replace function fbe_privado.al_cambiar_cuestionario() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  a public.atletas;
begin
  select * into a from public.atletas where id = new.atleta_id;
  if a.id is null then return null; end if;
  -- El atleta lo completa (o lo vuelve a completar) → al coach
  if new.completado_en is not null and (tg_op = 'INSERT' or new.completado_en is distinct from old.completado_en) then
    perform fbe_privado.notificar_seguro(p.id, 'cuestionario_recibido',
      coalesce(fbe_privado.nombre_corto(a.nombre), 'Un atleta') || ' ha completado su cuestionario',
      'Lo tienes en su ficha, en Datos.', '#atletas', 'cuestionario:' || new.id || ':' || (extract(epoch from new.completado_en) * 1000)::bigint)
    from public.perfiles p where p.rol = 'coach' and p.id is distinct from auth.uid();
  end if;
  -- Síntomas entrenando (la recomendación es parar) guardados en su paso, aún sin enviar → al coach, ya (sin
  -- decir qué: «Revisa el cuestionario de Ana»)
  if new.resultado = 'parar_y_valorar' and (tg_op = 'INSERT' or old.resultado is distinct from new.resultado)
     and not (new.completado_en is not null and (tg_op = 'INSERT' or new.completado_en is distinct from old.completado_en)) then
    perform fbe_privado.notificar_seguro(p.id, 'cuestionario_recibido',
      'Revisa el cuestionario de ' || coalesce(fbe_privado.nombre_corto(a.nombre), 'un atleta'),
      'Lo tienes en su ficha, en Datos.', '#atletas', 'cuestionario_salud:' || new.id || ':' || (extract(epoch from now()) * 1000)::bigint)
    from public.perfiles p where p.rol = 'coach' and p.id is distinct from auth.uid();
  end if;
  -- El coach lo pide → al atleta
  if new.pedido_en is not null and (tg_op = 'INSERT' or new.pedido_en is distinct from old.pedido_en) and a.estado = 'activo' then
    perform fbe_privado.notificar_seguro(a.perfil_id, 'cuestionario',
      case when new.completado_en is null then 'Tu coach te pide tu cuestionario inicial' else 'Tu coach te pide que actualices tu cuestionario' end,
      'Son unos minutos: está en Hoy.', '#hoy', 'cuestionario_pedido:' || new.id || ':' || (extract(epoch from new.pedido_en) * 1000)::bigint);
  end if;
  return null;
exception when others then
  raise warning 'FBE: notificación del cuestionario % no creada: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists cuestionarios_zz_notificar on public.cuestionarios;
create trigger cuestionarios_zz_notificar after insert or update on public.cuestionarios
  for each row execute function fbe_privado.al_cambiar_cuestionario();

-- ---------------------------------------------------------------------
-- Permisos (como al final de 003 a 010)
-- ---------------------------------------------------------------------
revoke all on public.cuestionarios, public.preguntas_checkin from anon;
grant select, insert, update, delete on public.cuestionarios, public.preguntas_checkin to authenticated;
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
-- Las del servidor (010), solo para la clave de servicio
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

-- Apuntada
insert into public.fbe_migraciones (numero) values (11)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
