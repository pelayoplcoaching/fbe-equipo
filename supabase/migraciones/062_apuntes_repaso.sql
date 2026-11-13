-- =====================================================================
-- FBE Equipo, migración 062: Apuntes que se quedan (repaso espaciado, preguntas del coach y aviso de repaso)
--
-- Por qué: las mejoras de Apuntes para llevarlos al nivel de las mejores plataformas de formación (claude/apuntes-mejoras-4.md).
-- Esta añade lo que necesita la base:
--
--   * apuntes_vistos.caja y apuntes_vistos.proxima: el repaso espaciado. Cada apunte va subiendo de caja (0 a 5) cuando se
--     sabe y vuelve a la 0 cuando no; la caja dice cuándo toca volver a verlo (a los 1, 3, 7, 16 o 35 días). Lo calcula
--     la app; la base lo guarda para que no se pierda al cambiar de móvil y para poder avisar.
--   * apuntar_apunte(p_apunte, p_sabia, p_caja, p_proxima): la misma de la 061 con la caja y la próxima vez.
--   * novedades de tipo 'pregunta': el coach escribe sus propias preguntas (tres o cuatro opciones, cuál es la buena, una
--     explicación y, si quiere, el porqué de cada opción mala). Sus atletas las ven en los descansos y en los exámenes.
--   * crear_recordatorios_apuntes(): una vez al día, en un día sin sesión, a quien tiene tres o más apuntes por repasar,
--     un aviso («Tienes 4 apuntes por repasar»). Tipo de aviso nuevo, 'repaso', que se puede apagar en Ajustes → Avisos.
--     La llama la función «enviar-notificaciones» justo después de crear_recordatorios() (hay que volver a desplegarla).
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 061 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 62 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 062 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 62;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 61) then  -- (2) la anterior
    raise exception 'Falta la migración 061 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. El repaso espaciado: la caja y la próxima vez de cada apunte
-- ---------------------------------------------------------------------
alter table public.apuntes_vistos add column if not exists caja smallint not null default 0;
alter table public.apuntes_vistos add column if not exists proxima date;
alter table public.apuntes_vistos drop constraint if exists apuntes_vistos_caja_valida;
alter table public.apuntes_vistos add constraint apuntes_vistos_caja_valida check (caja between 0 and 5 and (proxima is null or proxima between ultimo and ultimo + 400));
create index if not exists apuntes_vistos_proxima_idx on public.apuntes_vistos (atleta_id, proxima) where proxima is not null;

-- (la de la 061 tenía dos parámetros: se quita para que no haya dos funciones con el mismo nombre)
drop function if exists public.apuntar_apunte(text, boolean);
create or replace function public.apuntar_apunte(p_apunte text, p_sabia boolean default null, p_caja smallint default null, p_proxima date default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_atleta uuid := public.mi_atleta_id();
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
  if v_atleta is null then return; end if;
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then return; end if;
  if p_apunte is null or p_apunte !~ '^[a-z]:[A-Za-z0-9:_-]{1,78}$' then
    raise exception 'Ese no es un apunte' using errcode = '22023';
  end if;
  if p_caja is not null and (p_caja < 0 or p_caja > 5) then raise exception 'Esa caja no existe' using errcode = '22023'; end if;
  if p_proxima is not null and (p_proxima < v_hoy or p_proxima > v_hoy + 60) then raise exception 'Esa fecha de repaso no vale' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('apuntes_vistos:' || v_atleta::text));  -- (dos a la vez no se saltan el tope; como en la 060)
  if (select count(*) from public.apuntes_vistos where atleta_id = v_atleta) >= 3000
     and not exists (select 1 from public.apuntes_vistos where atleta_id = v_atleta and apunte = p_apunte) then return; end if;
  insert into public.apuntes_vistos as x (atleta_id, apunte, ultimo, sabia, caja, proxima)
    values (v_atleta, p_apunte, v_hoy, p_sabia, coalesce(p_caja, 0), p_proxima)
  on conflict (atleta_id, apunte) do update set
    veces = least(x.veces + case when x.ultimo < excluded.ultimo then 1 else 0 end, 100000),
    ultimo = greatest(x.ultimo, excluded.ultimo),
    sabia = coalesce(excluded.sabia, x.sabia),
    caja = case when p_caja is null then x.caja else excluded.caja end,
    proxima = case when p_proxima is null then x.proxima else excluded.proxima end;
end $$;

-- ---------------------------------------------------------------------
-- 2. Las preguntas del coach
-- ---------------------------------------------------------------------
alter table public.novedades add column if not exists opciones jsonb;
alter table public.novedades add column if not exists correcta smallint;
alter table public.novedades add column if not exists explicaciones jsonb;
alter table public.novedades drop constraint if exists novedades_tipo_valido;
alter table public.novedades add constraint novedades_tipo_valido check (
  tipo in ('novedad', 'apunte', 'pregunta') and (ejercicio_id is null or tipo in ('apunte', 'pregunta'))
  and case when tipo = 'pregunta' then coalesce(
         jsonb_typeof(opciones) = 'array' and jsonb_array_length(opciones) between 2 and 4
         and correcta between 0 and jsonb_array_length(opciones) - 1
         and (explicaciones is null or (jsonb_typeof(explicaciones) = 'array' and jsonb_array_length(explicaciones) = jsonb_array_length(opciones)))
         and char_length(opciones::text) <= 1200 and char_length(coalesce(explicaciones::text, '')) <= 1600, false)
       else opciones is null and correcta is null and explicaciones is null end
);

-- ---------------------------------------------------------------------
-- 3. El aviso de repaso
-- ---------------------------------------------------------------------
alter table public.notificaciones drop constraint if exists notificaciones_validas;
alter table public.notificaciones add constraint notificaciones_validas check (
  tipo in ('respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario',
           'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido', 'prueba', 'descanso', 'comunidad',
           'tarea', 'tarea_hecha', 'repaso')
  and char_length(titulo) between 1 and 80
  and (cuerpo is null or char_length(cuerpo) <= 160)
  and (url in ('#hoy', '#semana', '#checkin', '#progreso', '#perfil', '#atletas', '#revisar', '#cuenta', '#mensajes', '#equipo')
       or url ~ '^#mensajes/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or url ~ '^#videos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(@[0-9]{1,4}(\.[0-9])?)?$')
  and char_length(clave) between 1 and 100
  and estado in ('pendiente', 'enviando', 'enviada', 'caducada', 'fallida')
  and (canal is null or canal in ('push', 'email'))
  and intentos between 0 and 100
  and (error is null or char_length(error) <= 200)
) not valid;
alter table public.preferencias_notificaciones drop constraint if exists preferencias_notificaciones_validas;
alter table public.preferencias_notificaciones add constraint preferencias_notificaciones_validas check (
  desactivados <@ array['respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario',
                        'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido', 'descanso', 'comunidad',
                        'tarea', 'tarea_hecha', 'repaso']::text[]
  and hora_manana between time '05:00' and time '12:00' and extract(second from hora_manana) = 0
  and hora_tarde between time '12:00' and time '23:30' and extract(second from hora_tarde) = 0
  and dia_checkin between 1 and 7
  and (silencio_desde is null) = (silencio_hasta is null)
  and (silencio_desde is null or (silencio_desde <> silencio_hasta
       and extract(second from silencio_desde) = 0 and extract(second from silencio_hasta) = 0))
);

-- Una vez al día, en las dos horas antes de su hora de la tarde y solo si hoy no tiene sesión prevista: a quien tiene tres
-- o más apuntes por repasar. Solo la llama el servidor (la función de los avisos), como crear_recordatorios().
create or replace function public.crear_recordatorios_apuntes(p_ahora timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_local timestamp := p_ahora at time zone 'Europe/Madrid';
  v_hoy date := (p_ahora at time zone 'Europe/Madrid')::date;
  v_n integer := 0;
begin
  perform fbe_privado.solo_servidor();
  with x as materialized (
    select d.perfil_id, d.hora_tarde, count(v.apunte) as n
    from fbe_privado.destinatarios d
    join public.apuntes_vistos v on v.atleta_id = d.atleta_id and v.proxima is not null and v.proxima <= v_hoy
    where not ('repaso' = any (d.desactivados))
      and v_local >= v_hoy + d.hora_tarde - interval '2 hours' and v_local < v_hoy + d.hora_tarde
      and not exists (select 1 from public.bloques b
                      join public.semanas w on w.bloque_id = b.id
                      join public.sesiones s on s.semana_id = w.id and s.dia_previsto = v_hoy
                      where b.atleta_id = d.atleta_id and not b.es_plantilla and b.estado not in ('cancelado', 'finalizado'))
    group by d.perfil_id, d.hora_tarde
    having count(v.apunte) >= 3
  )
  select count(*) into v_n from x
  where fbe_privado.notificar_seguro(x.perfil_id, 'repaso',
          'Tienes ' || least(x.n, 99) || ' apuntes por repasar',
          'Un par de minutos y no se te olvidan. Están en Semana, en «Tus apuntes».',
          '#semana', 'recordatorio_repaso:' || v_hoy, p_ahora,
          (v_hoy + x.hora_tarde + interval '2 hours') at time zone 'Europe/Madrid');
  return v_n;
end $$;

-- ---------------------------------------------------------------------
-- 4. Permisos (como al final de 003 a 061)
-- ---------------------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb), public.salud_recibir(text, jsonb), public.calendario_de(text) from public, anon, authenticated;
revoke execute on function public.sesion_video_proteger(), public.guia_tocar(), public.novedad_tocar() from public, anon, authenticated;
revoke execute on function public.crear_recordatorios_apuntes(timestamptz) from public, anon, authenticated;
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

insert into public.fbe_migraciones (numero) values (62)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
