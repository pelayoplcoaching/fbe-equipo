-- =====================================================================
-- FBE Equipo, migración 075: las guías de antebrazo, aductores y lumbares, con su grupo
--
-- Por qué: desde la 074 los ejercicios admiten tres grupos musculares más (antebrazo, aductores y lumbares), pero una
-- guía solo podía llevar uno de los diez de siempre. Sin grupo, la guía no sale como botón debajo del mapa muscular
-- (ui/Guias.jsx: GuiasDeGrupos; logica/guias.js: guiaDeGrupo). Lo que hace esta migración:
--   · guias.grupo admite también 'antebrazo', 'aductores' y 'lumbares' (la restricción guias_validas de la 057, igual
--     en todo lo demás).
--   · Las guías del coach con clave 'antebrazo', 'aductores' y 'lumbares' reciben ese grupo, solo si siguen sin
--     ninguno (no se pisa lo que el coach haya puesto). En una base sin esas guías no hace nada.
-- No guarda datos nuevos de nadie: son guías del coach, que ven él y sus atletas como siempre.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 074 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 75 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 075 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 75;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 74) then  -- (2) la anterior
    raise exception 'Falta la migración 074 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Una guía puede llevar los trece grupos de la app (la 057, con antebrazo, aductores y lumbares)
-- ---------------------------------------------------------------------
alter table public.guias drop constraint if exists guias_validas;
alter table public.guias add constraint guias_validas check (
  clave ~ '^[a-z0-9][a-z0-9-]{0,39}$'
  and char_length(titulo) between 1 and 80 and public.texto_visible(titulo)
  and (subtitulo is null or (char_length(subtitulo) between 1 and 160 and public.texto_visible(subtitulo)))
  and (grupo is null or grupo in ('pectoral', 'espalda', 'deltoides', 'cuadriceps', 'gluteo', 'isquiotibiales', 'biceps', 'triceps', 'abdominales', 'gemelo',
                                  'antebrazo', 'aductores', 'lumbares'))
  and orden between 0 and 999
  and jsonb_typeof(contenido) = 'object' and pg_column_size(contenido) <= 200000
);

-- ---------------------------------------------------------------------
-- 2. Las tres guías del coach, con su grupo (por su clave, solo si siguen sin grupo)
-- ---------------------------------------------------------------------
update public.guias set grupo = clave
 where grupo is null and clave in ('antebrazo', 'aductores', 'lumbares');

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 074; esta migración no crea funciones ni tablas)
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
revoke all on all functions in schema fbe_privado from public, anon, authenticated;
-- (revisión de la 072) la comprobación de las columnas de música la usa una restricción: el servidor (service_role) también tiene que poder llamarla
grant execute on function fbe_privado.musica_url_valida(text) to service_role;

insert into public.fbe_migraciones (numero) values (75)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
