-- =====================================================================
-- FBE Equipo, migración 066: Que la app le hable a cada uno (personalización, segunda ronda)
--
-- Por qué: la 050 guardó lo que cada atleta elige para su app (apodo, porqué, música, cumpleaños…). Esta añade lo que
-- hace falta para que la app le hable a él:
--
--   * personal_atleta.genero: cómo le hablamos ('f' en femenino, 'm' en masculino, 'n' sin marcar). Solo para la
--     gramática; lo elige él (nunca se deduce del nombre) y lo ve su coach.
--   * personal_atleta.tono: 'cercano' (el de siempre), 'directo' o 'tope'.
--   * personal_atleta.meta_*: su meta con fecha (un nombre, un día y, si quiere, una cifra con su unidad), para la
--     cuenta atrás y para que el bloque y el informe hablen de ella.
--   * personal_ajustes_guardar(): guarda solo eso (lo de la 050 sigue con personal_guardar, sin tocar esto).
--   * Los mensajes automáticos del coach ganan dos momentos: 'aniversario' (al mes, 3, 6 y 12 meses) y 'meta' (su meta,
--     a una semana).
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 065 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 66 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 066 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 66;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 65) then  -- (2) la anterior
    raise exception 'Falta la migración 065 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Cómo le hablamos y su meta
-- ---------------------------------------------------------------------
alter table public.personal_atleta add column if not exists genero text;
alter table public.personal_atleta add column if not exists tono text;
alter table public.personal_atleta add column if not exists meta_nombre text;
alter table public.personal_atleta add column if not exists meta_fecha date;
alter table public.personal_atleta add column if not exists meta_cifra numeric;
alter table public.personal_atleta add column if not exists meta_unidad text;
alter table public.personal_atleta drop constraint if exists personal_atleta_trato_valido;
alter table public.personal_atleta add constraint personal_atleta_trato_valido check (
  (genero is null or genero in ('f', 'm', 'n'))
  and (tono is null or tono in ('cercano', 'directo', 'tope'))
  and (meta_nombre is null or char_length(meta_nombre) between 1 and 60)
  and (meta_fecha is null or meta_nombre is not null)
  and (meta_cifra is null or (meta_nombre is not null and meta_cifra > 0 and meta_cifra <= 100000 and meta_unidad in ('kg', 'km', 'min', 'reps', 'cm', '%')))
  and (meta_unidad is null or meta_cifra is not null)
);

create or replace function fbe_privado.personal_json(p public.personal_atleta) returns jsonb
language sql stable set search_path = '' as $$
  select case when p.atleta_id is null then null else jsonb_build_object(
    'apodo', p.apodo, 'porque', p.porque, 'favoritos', to_jsonb(p.favoritos), 'musica_url', p.musica_url,
    'cancion_url', p.cancion_url, 'musica_aperturas', p.musica_aperturas,
    'cumple_mes', p.cumple_mes, 'cumple_dia', p.cumple_dia,
    'genero', p.genero, 'tono', p.tono, 'meta_nombre', p.meta_nombre, 'meta_fecha', p.meta_fecha, 'meta_cifra', p.meta_cifra, 'meta_unidad', p.meta_unidad,
    'actualizado_en', p.actualizado_en) end;
$$;

-- El atleta guarda cómo le hablamos y su meta (solo eso: lo demás de su fila no se toca). Claves que no vienen, igual
create or replace function public.personal_ajustes_guardar(p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_atleta uuid := public.mi_atleta_id();
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v public.personal_atleta;
  v_genero text; v_tono text; v_nombre text; v_fecha date; v_cifra numeric; v_unidad text;
begin
  if v_atleta is null then raise exception 'Solo el atleta guarda lo suyo' using errcode = '42501'; end if;
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then
    raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada';
  end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then raise exception 'Faltan los datos'; end if;
  select * into v from public.personal_atleta where atleta_id = v_atleta;
  v_genero := case when p_datos ? 'genero' then nullif(p_datos ->> 'genero', '') else v.genero end;
  v_tono := case when p_datos ? 'tono' then nullif(p_datos ->> 'tono', '') else v.tono end;
  if v_genero is not null and v_genero not in ('f', 'm', 'n') then raise exception 'Ese trato no existe' using errcode = '22023'; end if;
  if v_tono is not null and v_tono not in ('cercano', 'directo', 'tope') then raise exception 'Ese tono no existe' using errcode = '22023'; end if;
  if p_datos ? 'meta_nombre' then
    v_nombre := nullif(btrim(regexp_replace(coalesce(p_datos ->> 'meta_nombre', ''), '[[:space:][:cntrl:]]+', ' ', 'g')), '');
    begin
      v_fecha := nullif(p_datos ->> 'meta_fecha', '')::date;
      v_cifra := nullif(p_datos ->> 'meta_cifra', '')::numeric;
    exception when others then raise exception 'Fecha o cifra de la meta no válidas' using errcode = '22023'; end;
    v_unidad := nullif(p_datos ->> 'meta_unidad', '');
    if v_nombre is null then v_fecha := null; v_cifra := null; v_unidad := null; end if;
    if char_length(v_nombre) > 60 then raise exception 'Tu meta: como mucho 60 caracteres' using errcode = '22023'; end if;
    if v_fecha is not null and (v_fecha < v_hoy or v_fecha > v_hoy + 730) then raise exception 'La fecha de tu meta tiene que estar entre hoy y dentro de dos años' using errcode = '22023'; end if;
    if v_cifra is not null and (v_cifra <= 0 or v_cifra > 100000 or v_unidad is null or v_unidad not in ('kg', 'km', 'min', 'reps', 'cm', '%')) then
      raise exception 'La cifra de tu meta necesita un número y su unidad' using errcode = '22023';
    end if;
    if v_cifra is null then v_unidad := null; end if;
  else
    v_nombre := v.meta_nombre; v_fecha := v.meta_fecha; v_cifra := v.meta_cifra; v_unidad := v.meta_unidad;
  end if;
  insert into public.personal_atleta as t (atleta_id, genero, tono, meta_nombre, meta_fecha, meta_cifra, meta_unidad, actualizado_en)
    values (v_atleta, v_genero, v_tono, v_nombre, v_fecha, v_cifra, v_unidad, now())
  on conflict (atleta_id) do update set genero = excluded.genero, tono = excluded.tono, meta_nombre = excluded.meta_nombre, meta_fecha = excluded.meta_fecha,
    meta_cifra = excluded.meta_cifra, meta_unidad = excluded.meta_unidad, actualizado_en = now()
  returning * into v;
  return fbe_privado.personal_json(v);
end $$;
comment on function public.personal_ajustes_guardar(jsonb) is 'El atleta guarda cómo le hablamos (género, tono) y su meta con fecha. Solo esas claves.';

-- ---------------------------------------------------------------------
-- 2. Dos momentos más para los mensajes automáticos del coach
-- ---------------------------------------------------------------------
alter table public.mensajes_coach drop constraint if exists mensajes_coach_momento_check;
alter table public.mensajes_coach add constraint mensajes_coach_momento_check check (momento in ('record', 'bloque', 'racha', 'vuelta', 'cumple', 'aniversario', 'meta'));
create or replace function public.mensaje_coach_guardar(p_momento text, p_texto text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  if p_momento is null or p_momento not in ('record', 'bloque', 'racha', 'vuelta', 'cumple', 'aniversario', 'meta') then raise exception 'Momento no válido'; end if;
  if v is null then delete from public.mensajes_coach where momento = p_momento; return; end if;
  if char_length(v) > 400 then raise exception 'Como mucho 400 caracteres'; end if;
  insert into public.mensajes_coach (momento, texto, actualizado_en) values (p_momento, v, now())
    on conflict (momento) do update set texto = excluded.texto, actualizado_en = now();
end $$;

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 065)
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

insert into public.fbe_migraciones (numero) values (66)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
