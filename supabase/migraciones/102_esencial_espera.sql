-- =====================================================================
-- FBE Equipo, migración 102: FBE Esencial, la espera (de la reserva al lunes en que empieza)
--
-- Por qué (tanda 7, «La espera», encargo de Pelayo del 25/11/2026): quien reserva el 15/12 entra semanas antes de su
-- lunes. Para acompañarle hasta entonces:
--   * esencial_companeros(): cuántos de FBE Esencial empiezan el mismo lunes que él (solo el número, nunca quiénes; con
--     menos de tres, nada). Para «Empezáis 32 el lunes 11 de enero».
--   * esencial_alta_estado(): la de la 097 con tres datos más para «Listos para el lunes» del panel del coach: si ya
--     tiene sus días puestos (las sesiones de su primera semana con día), si ya ha mirado su gimnasio (una nota de tipo
--     'gimnasio' o una alternativa para siempre) y su primera semana.
--   * esencial_notas admite un tipo más, 'partida': los kilos con los que empieza quien ya entrena (ejercicio a ejercicio;
--     nada de salud). Lo usa la app solo si Pelayo lo enciende.
--   Para quien lleva seguimiento no cambia nada.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 101 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 102 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 102 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 102;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 101) then  -- (2) la anterior
    raise exception 'Falta la migración 101 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Un tipo más de nota: 'partida' (los kilos con los que empieza; nada de salud)
-- ---------------------------------------------------------------------
alter table public.esencial_notas drop constraint if exists esencial_notas_validas;
alter table public.esencial_notas add constraint esencial_notas_validas check (
  tipo in ('pregunta_directo', 'como_vamos', 'viaje', 'gimnasio', 'objetivo', 'suave', 'partida')
  and (texto is null or (char_length(texto) between 1 and 600 and public.texto_visible(texto)))
  and jsonb_typeof(datos) = 'object' and pg_column_size(datos) < 2000
  and (desde is null or hasta is null or (hasta >= desde and hasta - desde <= 120))
  and (respuesta is null or char_length(respuesta) between 1 and 3000)
  and (pregunta_publica is null or char_length(pregunta_publica) between 1 and 300)
  and (not publica or (respuesta is not null and pregunta_publica is not null))
);
comment on column public.esencial_notas.tipo is '''pregunta_directo'' | ''como_vamos'' | ''viaje'' | ''gimnasio'' | ''objetivo'' | ''suave'' | ''partida''';

-- ---------------------------------------------------------------------
-- 2. Cuántos empiezan el mismo lunes (solo el número)
-- ---------------------------------------------------------------------
create or replace function public.esencial_companeros() returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  v_id uuid := public.mi_atleta_id();
  v_inicio date;
  v_n integer;
begin
  if v_id is null then return null; end if;
  select a.esencial_inicio into v_inicio from public.atletas a
    where a.id = v_id and a.modalidad = 'por_su_cuenta' and a.estado <> 'baja';
  if v_inicio is null then return null; end if;
  select count(*) into v_n from public.atletas a
    where a.modalidad = 'por_su_cuenta' and a.estado <> 'baja' and a.esencial_inicio = v_inicio;
  return case when v_n >= 3 then v_n else null end;
end $$;
comment on function public.esencial_companeros() is 'FBE Esencial: cuántos empiezan el mismo lunes que quien pregunta (solo el número; con menos de tres, null).';

-- ---------------------------------------------------------------------
-- 3. El alta de cada uno, con sus días, su gimnasio y su primera semana (la de la 097 con tres datos más)
-- ---------------------------------------------------------------------
create or replace function public.esencial_alta_estado()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'atleta_id', a.id,
      'inicio', a.esencial_inicio,
      'invitado_en', i.creada_en,
      'caduca_en', i.caduca_en,
      'activado_en', u.usada_en,
      'push', a.perfil_id is not null and exists (select 1 from public.suscripciones_push s where s.usuario_id = a.perfil_id),
      'email', a.perfil_id is not null and coalesce((select p.email from public.preferencias_notificaciones p where p.usuario_id = a.perfil_id), false),
      'cuestionario_en', c.completado_en,
      'resultado', c.resultado,
      'visto_bueno_pedido_en', a.visto_bueno_pedido_en,
      'visto_bueno_en', a.visto_bueno_en,
      'plan_inicio', pi.inicio,
      'primera_sesion', (select min(s.fecha_realizada) from public.sesiones s
                         join public.semanas w on w.id = s.semana_id
                         join public.bloques b on b.id = w.bloque_id
                         where b.atleta_id = a.id and not b.es_plantilla and s.completada),
      -- (102) sus días: las sesiones de su primera semana, todas con su día (null sin plan)
      'dias', (select case when count(*) = 0 then null else bool_and(s.dia_previsto is not null) end
               from public.sesiones s
               join public.semanas w on w.id = s.semana_id
               join public.bloques b on b.id = w.bloque_id
               where b.atleta_id = a.id and not b.es_plantilla and w.programacion = 'programada' and w.fecha_inicio = pi.inicio),
      -- (102) su gimnasio: lo ha mirado (una nota) o ha dejado alguna alternativa para siempre
      'gimnasio', exists (select 1 from public.esencial_notas n where n.atleta_id = a.id and n.tipo = 'gimnasio')
                  or coalesce(a.esencial_alternativas, '{}'::jsonb) <> '{}'::jsonb,
      'primera_semana', pi.inicio
    ) order by a.nombre)
    from public.atletas a
    left join lateral (select x.creada_en, x.caduca_en from public.invitaciones x where x.atleta_id = a.id order by x.creada_en desc limit 1) i on true
    left join lateral (select x.usada_en from public.invitaciones x where x.atleta_id = a.id and x.usada_en is not null order by x.usada_en limit 1) u on true
    left join lateral (select min(b.fecha_inicio) as inicio from public.bloques b where b.atleta_id = a.id and not b.es_plantilla) pi on true
    left join public.cuestionarios c on c.atleta_id = a.id
    where a.modalidad = 'por_su_cuenta'
  ), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- 4. Permisos (como al final de 003 a 101)
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
revoke all on all functions in schema fbe_privado from public, anon, authenticated;
-- (revisión de la 072) la comprobación de las columnas de música la usa una restricción: el servidor (service_role) también tiene que poder llamarla
grant execute on function fbe_privado.musica_url_valida(text) to service_role;

insert into public.fbe_migraciones (numero) values (102)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
