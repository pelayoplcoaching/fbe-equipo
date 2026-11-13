-- =====================================================================
-- FBE Equipo, migración 066: Que la app le conozca (personalización, segunda ronda, tandas 3 y 4)
--
-- Por qué: los mensajes del coach (050, 065) ganan momentos nuevos, sin tablas nuevas:
--
--   * 'molestia_<zona>' (cuello, hombro, codo, muneca_mano, espalda_alta, zona_lumbar, cadera, rodilla, tobillo_pie):
--     el aviso que el coach escribe (o aprueba) para cada zona. Al atleta que dijo en el cuestionario que le molesta esa
--     zona le sale en los ejercicios que la cargan («Tu hombro: rango cómodo y sin dolor»), y solo si ha dado el
--     consentimiento de datos de salud (eso lo mira la app: aquí solo se guarda el texto del coach, que no es de nadie).
--   * 'primera_vez' (la primera vez que hace un ejercicio) y 'viaje' (la vuelta de un viaje), para los mensajes
--     automáticos.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 065 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada. (Si otra rama ha usado ya el número 066, renumerar esta.)
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
-- 1. Los momentos nuevos de los mensajes del coach
-- ---------------------------------------------------------------------
alter table public.mensajes_coach drop constraint if exists mensajes_coach_momento_check;
alter table public.mensajes_coach add constraint mensajes_coach_momento_check check (momento in ('record', 'bloque', 'racha', 'vuelta', 'cumple', 'aniversario', 'meta', 'primera_vez', 'viaje',
    'molestia_cuello', 'molestia_hombro', 'molestia_codo', 'molestia_muneca_mano', 'molestia_espalda_alta', 'molestia_zona_lumbar',
    'molestia_cadera', 'molestia_rodilla', 'molestia_tobillo_pie'));
create or replace function public.mensaje_coach_guardar(p_momento text, p_texto text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  if p_momento is null or p_momento not in ('record', 'bloque', 'racha', 'vuelta', 'cumple', 'aniversario', 'meta', 'primera_vez', 'viaje',
    'molestia_cuello', 'molestia_hombro', 'molestia_codo', 'molestia_muneca_mano', 'molestia_espalda_alta', 'molestia_zona_lumbar',
    'molestia_cadera', 'molestia_rodilla', 'molestia_tobillo_pie') then raise exception 'Momento no válido'; end if;
  if v is null then delete from public.mensajes_coach where momento = p_momento; return; end if;
  if char_length(v) > 400 then raise exception 'Como mucho 400 caracteres'; end if;
  insert into public.mensajes_coach (momento, texto, actualizado_en) values (p_momento, v, now())
    on conflict (momento) do update set texto = excluded.texto, actualizado_en = now();
end $$;
comment on function public.mensaje_coach_guardar(text, text) is 'El coach guarda (o quita, con texto vacío) su mensaje de un momento: los automáticos y los avisos por zona (066).';

-- ---------------------------------------------------------------------
-- 2. Permisos (como al final de 003 a 065)
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
