-- =====================================================================
-- FBE Equipo, migración 090: el atleta apunta el resultado de su carrera
--
-- Por qué: la mejora 17 de carrera («después de la carrera», con la revisión del experto): el atleta apunta su tiempo
-- desde la app, y la app lo compara con el objetivo y con lo previsto (y propone su ritmo umbral nuevo y la
-- recuperación). Hasta ahora solo podía hacerlo el coach: el atleta ve sus carreras pero no las cambia.
--
--   * carrera_resultado_poner(p_evento, p_seg, p_nota): el resultado (y una nota) de una carrera suya que ya ha sido (de
--     hoy hacia atrás, hasta 60 días). Solo eso: el atleta no cambia nada más de la carrera. El coach, de cualquiera.
--   * No crea tablas ni datos nuevos (el resultado ya estaba en carrera_eventos): no cambia la política.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 089 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 90 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 090 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 90;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 89) then  -- (2) la anterior
    raise exception 'Falta la migración 089 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. El resultado de una carrera
-- ---------------------------------------------------------------------
-- Devuelve la carrera, ya con su resultado. p_seg null quita el resultado (y su nota).
create or replace function public.carrera_resultado_poner(p_evento uuid, p_seg integer, p_nota text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_ev public.carrera_eventos;
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  select * into v_ev from public.carrera_eventos where id = p_evento;
  if not found then raise exception 'Esa carrera no existe' using errcode = 'P0002'; end if;
  if not public.es_coach() then
    if public.mi_atleta_id() is distinct from v_ev.atleta_id then
      raise exception 'Solo puedes apuntar el resultado de tus carreras' using errcode = '42501';
    end if;
    if v_ev.fecha > v_hoy then raise exception 'Esa carrera aún no ha llegado' using errcode = '22023'; end if;
    if v_ev.fecha < v_hoy - 60 then raise exception 'El resultado se apunta en los 60 días siguientes a la carrera' using errcode = '22023'; end if;
  end if;
  if p_seg is not null and (p_seg < 60 or p_seg > 172800) then raise exception 'El tiempo, entre 1 minuto y 48 horas' using errcode = '22023'; end if;
  if v_nota is not null and length(v_nota) > 500 then raise exception 'La nota, como mucho 500 letras' using errcode = '22023'; end if;
  update public.carrera_eventos set resultado_seg = p_seg, resultado_nota = case when p_seg is null then null else v_nota end
  where id = p_evento
  returning * into v_ev;
  return to_jsonb(v_ev);
end $$;

-- ---------------------------------------------------------------------
-- 2. Permisos (como al final de 003 a 089)
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
revoke all on all functions in schema fbe_privado from public, anon, authenticated;
-- (revisión de la 072) la comprobación de las columnas de música la usa una restricción: el servidor (service_role) también tiene que poder llamarla
grant execute on function fbe_privado.musica_url_valida(text) to service_role;

insert into public.fbe_migraciones (numero) values (90)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
