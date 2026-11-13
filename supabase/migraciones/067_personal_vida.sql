-- =====================================================================
-- FBE Equipo, migración 067: Que la app sepa de su vida (personalización, tercera ronda)
--
-- Por qué: para que la app tenga en cuenta lo que le pasa al atleta (siempre como consejo: la programación del coach no
-- se toca):
--
--   * agenda_vida: lo que le pasa, con fecha. Tipos: 'evento' (un examen, una boda, una mudanza: después la app le
--     pregunta qué tal), 'dificil' (una semana difícil, por su lunes), 'guardia' (sus guardias o turnos), 'hito' (un hito
--     suyo para su álbum) y 'reto' (el reto del mes que le pone el coach). La escriben él o su coach; la lee él y su
--     coach. Todo por funciones (la tabla no se lee directamente).
--   * personal_atleta.manual_*: su «manual de instrucciones» (cómo le gusta que le entrenen): el feedback ('directo' o
--     'suave'), lo que le motiva y lo que no quiere oír. Lo escribe él y lo ve su coach.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 066 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada. (Si otra rama ha usado ya el número 067, renumerar esta.)
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 67 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 067 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 67;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 66) then  -- (2) la anterior
    raise exception 'Falta la migración 066 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Su agenda de vida
-- ---------------------------------------------------------------------
create table if not exists public.agenda_vida (
  id uuid primary key default gen_random_uuid(),
  atleta_id uuid not null references public.atletas(id) on delete cascade,
  tipo text not null,
  fecha date not null,
  titulo text,
  nota text,
  respuesta text,
  respuesta_nota text,
  respondida_en timestamptz,
  autor text not null,
  creado_en timestamptz not null default now()
);
alter table public.agenda_vida drop constraint if exists agenda_vida_valida;
alter table public.agenda_vida add constraint agenda_vida_valida check (
  tipo in ('evento', 'dificil', 'guardia', 'hito', 'reto')
  and autor in ('atleta', 'coach')
  and (titulo is null or char_length(titulo) between 1 and 80)
  and (nota is null or char_length(nota) <= 300)
  and (respuesta is null or respuesta in ('bien', 'regular', 'mal'))
  and (respuesta_nota is null or char_length(respuesta_nota) <= 300)
  and (tipo in ('dificil', 'guardia') or titulo is not null)
);
create index if not exists agenda_vida_atleta_fecha on public.agenda_vida (atleta_id, fecha);
alter table public.agenda_vida enable row level security;
revoke all on public.agenda_vida from public, anon, authenticated;

-- Quién la mira: el atleta, la suya; el coach, la de cualquiera (p_atleta)
create or replace function fbe_privado.agenda_atleta(p_atleta uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.es_coach() then
    if p_atleta is null or not exists (select 1 from public.atletas where id = p_atleta) then raise exception 'Ese atleta no existe' using errcode = '22023'; end if;
    return p_atleta;
  end if;
  if public.mi_atleta_id() is null then raise exception 'Solo el atleta o su coach' using errcode = '42501'; end if;
  return public.mi_atleta_id();
end $$;

create or replace function fbe_privado.agenda_json(a public.agenda_vida) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', a.id, 'tipo', a.tipo, 'fecha', a.fecha, 'titulo', a.titulo, 'nota', a.nota, 'respuesta', a.respuesta,
    'respuesta_nota', a.respuesta_nota, 'respondida_en', a.respondida_en, 'autor', a.autor, 'creado_en', a.creado_en);
$$;

-- Lo de un rango de fechas (de entrada, de hace 60 días a dentro de 365)
create or replace function public.agenda_lista(p_atleta uuid default null, p_desde date default null, p_hasta date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_atleta uuid := fbe_privado.agenda_atleta(p_atleta); v_hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
  return coalesce((select jsonb_agg(fbe_privado.agenda_json(a) order by a.fecha, a.creado_en) from public.agenda_vida a
    where a.atleta_id = v_atleta and a.fecha between coalesce(p_desde, v_hoy - 60) and coalesce(p_hasta, v_hoy + 365)), '[]'::jsonb);
end $$;

-- Apuntar algo (tipo, fecha, título, nota). Hasta 300 cosas por atleta; las fechas, de hace un año a dentro de dos
create or replace function public.agenda_guardar(p_atleta uuid, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_atleta uuid := fbe_privado.agenda_atleta(p_atleta);
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_tipo text := p_datos ->> 'tipo';
  v_fecha date; v_titulo text; v_nota text; v public.agenda_vida;
begin
  if not public.es_coach() and exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then
    raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada';
  end if;
  if v_tipo is null or v_tipo not in ('evento', 'dificil', 'guardia', 'hito', 'reto') then raise exception 'Tipo no válido' using errcode = '22023'; end if;
  if v_tipo = 'reto' and not public.es_coach() then raise exception 'El reto lo pone el coach' using errcode = '42501'; end if;
  begin v_fecha := (p_datos ->> 'fecha')::date; exception when others then raise exception 'Fecha no válida' using errcode = '22023'; end;
  if v_fecha is null or v_fecha < v_hoy - 366 or v_fecha > v_hoy + 730 then raise exception 'La fecha tiene que estar entre hace un año y dentro de dos' using errcode = '22023'; end if;
  v_titulo := nullif(btrim(regexp_replace(coalesce(p_datos ->> 'titulo', ''), '[[:space:][:cntrl:]]+', ' ', 'g')), '');
  v_nota := nullif(btrim(coalesce(p_datos ->> 'nota', '')), '');
  if v_titulo is null and v_tipo not in ('dificil', 'guardia') then raise exception 'Ponle un nombre' using errcode = '22023'; end if;
  if char_length(v_titulo) > 80 then raise exception 'El nombre, como mucho 80 caracteres' using errcode = '22023'; end if;
  if char_length(v_nota) > 300 then raise exception 'La nota, como mucho 300 caracteres' using errcode = '22023'; end if;
  if (select count(*) from public.agenda_vida where atleta_id = v_atleta) >= 300 then raise exception 'Ya hay 300 cosas apuntadas: borra alguna antigua' using errcode = '22023'; end if;
  -- una sola semana difícil por lunes, y una guardia por día
  if v_tipo in ('dificil', 'guardia') and exists (select 1 from public.agenda_vida where atleta_id = v_atleta and tipo = v_tipo and fecha = v_fecha) then
    select * into v from public.agenda_vida where atleta_id = v_atleta and tipo = v_tipo and fecha = v_fecha limit 1;
    return fbe_privado.agenda_json(v);
  end if;
  insert into public.agenda_vida (atleta_id, tipo, fecha, titulo, nota, autor)
    values (v_atleta, v_tipo, v_fecha, v_titulo, v_nota, case when public.es_coach() then 'coach' else 'atleta' end)
    returning * into v;
  return fbe_privado.agenda_json(v);
end $$;

-- Borrar: el atleta, lo suyo (lo que apuntó él); el coach, lo de cualquiera
create or replace function public.agenda_borrar(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.agenda_vida;
begin
  select * into v from public.agenda_vida where id = p_id;
  if v.id is null then return; end if;
  if not public.es_coach() and (v.atleta_id is distinct from public.mi_atleta_id() or v.autor <> 'atleta') then
    raise exception 'Solo puedes borrar lo que apuntaste tú' using errcode = '42501';
  end if;
  delete from public.agenda_vida where id = p_id;
end $$;

-- El atleta contesta qué tal fue (bien, regular, mal y una nota): lo ve su coach
create or replace function public.agenda_responder(p_id uuid, p_respuesta text, p_nota text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.agenda_vida; v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  select * into v from public.agenda_vida where id = p_id;
  if v.id is null or v.atleta_id is distinct from public.mi_atleta_id() then raise exception 'Eso no es tuyo' using errcode = '42501'; end if;
  if p_respuesta is null or p_respuesta not in ('bien', 'regular', 'mal') then raise exception 'Respuesta no válida' using errcode = '22023'; end if;
  if char_length(v_nota) > 300 then raise exception 'Como mucho 300 caracteres' using errcode = '22023'; end if;
  update public.agenda_vida set respuesta = p_respuesta, respuesta_nota = v_nota, respondida_en = now() where id = p_id returning * into v;
  return fbe_privado.agenda_json(v);
end $$;

-- ---------------------------------------------------------------------
-- 2. Su manual de instrucciones
-- ---------------------------------------------------------------------
alter table public.personal_atleta add column if not exists manual_feedback text;
alter table public.personal_atleta add column if not exists manual_motiva text[];
alter table public.personal_atleta add column if not exists manual_evitar text;
alter table public.personal_atleta drop constraint if exists personal_atleta_manual_valido;
alter table public.personal_atleta add constraint personal_atleta_manual_valido check (
  (manual_feedback is null or manual_feedback in ('directo', 'suave'))
  and (manual_motiva is null or (cardinality(manual_motiva) <= 5 and manual_motiva <@ array['datos', 'retos', 'reconocimiento', 'compania', 'progreso']::text[]))
  and (manual_evitar is null or char_length(manual_evitar) between 1 and 200)
);

create or replace function fbe_privado.personal_json(p public.personal_atleta) returns jsonb
language sql stable set search_path = '' as $$
  select case when p.atleta_id is null then null else jsonb_build_object(
    'apodo', p.apodo, 'porque', p.porque, 'favoritos', to_jsonb(p.favoritos), 'musica_url', p.musica_url,
    'cancion_url', p.cancion_url, 'musica_aperturas', p.musica_aperturas,
    'cumple_mes', p.cumple_mes, 'cumple_dia', p.cumple_dia,
    'genero', p.genero, 'tono', p.tono, 'meta_nombre', p.meta_nombre, 'meta_fecha', p.meta_fecha, 'meta_cifra', p.meta_cifra, 'meta_unidad', p.meta_unidad,
    'manual_feedback', p.manual_feedback, 'manual_motiva', to_jsonb(p.manual_motiva), 'manual_evitar', p.manual_evitar,
    'actualizado_en', p.actualizado_en) end;
$$;

-- Guarda solo su manual (lo demás de su fila no se toca)
create or replace function public.personal_manual_guardar(p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_atleta uuid := public.mi_atleta_id();
  v public.personal_atleta;
  v_feedback text; v_motiva text[]; v_evitar text;
begin
  if v_atleta is null then raise exception 'Solo el atleta guarda lo suyo' using errcode = '42501'; end if;
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then
    raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada';
  end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then raise exception 'Faltan los datos'; end if;
  v_feedback := nullif(p_datos ->> 'manual_feedback', '');
  if v_feedback is not null and v_feedback not in ('directo', 'suave') then raise exception 'Feedback no válido' using errcode = '22023'; end if;
  if jsonb_typeof(p_datos -> 'manual_motiva') = 'array' then
    select array_agg(distinct x) into v_motiva from jsonb_array_elements_text(p_datos -> 'manual_motiva') x;
    if v_motiva is not null and not (v_motiva <@ array['datos', 'retos', 'reconocimiento', 'compania', 'progreso']::text[]) then raise exception 'Eso no está en la lista' using errcode = '22023'; end if;
  end if;
  v_evitar := nullif(btrim(coalesce(p_datos ->> 'manual_evitar', '')), '');
  if char_length(v_evitar) > 200 then raise exception 'Como mucho 200 caracteres' using errcode = '22023'; end if;
  insert into public.personal_atleta as t (atleta_id, manual_feedback, manual_motiva, manual_evitar, actualizado_en)
    values (v_atleta, v_feedback, v_motiva, v_evitar, now())
  on conflict (atleta_id) do update set manual_feedback = excluded.manual_feedback, manual_motiva = excluded.manual_motiva,
    manual_evitar = excluded.manual_evitar, actualizado_en = now()
  returning * into v;
  return fbe_privado.personal_json(v);
end $$;
comment on function public.personal_manual_guardar(jsonb) is 'El atleta guarda su manual de instrucciones (cómo le gusta que le entrenen). Lo ve su coach.';

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 066)
-- ---------------------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb), public.salud_recibir(text, jsonb), public.calendario_de(text) from public, anon, authenticated;
revoke execute on function public.sesion_video_proteger(), public.guia_tocar(), public.novedad_tocar() from public, anon, authenticated;
revoke execute on function public.crear_recordatorios_apuntes(timestamptz) from public, anon, authenticated;
revoke execute on function public.novedad_audio_fuera() from public, anon, authenticated;
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

insert into public.fbe_migraciones (numero) values (67)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
