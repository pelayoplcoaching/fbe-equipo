-- =====================================================================
-- FBE Equipo, migración 074: la biblioteca de ejercicios, ampliada (claude/biblioteca-ampliacion.md)
--
-- Por qué: la biblioteca pasa de unos 150 ejercicios a unos 300 (los nuevos los inserta el coach con su SQL de la
-- biblioteca, que no va en el repositorio porque lleva su técnica). Para que quepan hacen falta tres grupos
-- musculares más: antebrazo, aductores y lumbares. Lo que hace esta migración:
--   · ejercicios.grupos_musculares admite también 'antebrazo', 'aductores' y 'lumbares'.
--   · Los 8 ejercicios de la biblioteca de siempre que no tenían grupo (muñeca y aductores) reciben el suyo, solo si
--     siguen sin ninguno (no se pisa lo que el coach haya puesto).
-- No guarda datos nuevos de nadie: son ejercicios de la biblioteca del coach, que ven él y sus atletas como siempre.
-- En la app, estos tres grupos no tienen mínimo de series semanales (trabajan de forma indirecta): solo cuentan.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 073 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 74 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 074 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 74;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 73) then  -- (2) la anterior
    raise exception 'Falta la migración 073 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Tres grupos musculares más
-- ---------------------------------------------------------------------
-- La restricción de schema.sql no tiene nombre propio: se quita la que haya sobre esa columna, se llame como se llame
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.ejercicios'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%isquiotibiales%' loop
    execute format('alter table public.ejercicios drop constraint %I', c);
  end loop;
end $$;
alter table public.ejercicios add constraint ejercicios_grupos_musculares_check
  check (grupos_musculares <@ array['pectoral','espalda','deltoides','cuadriceps','gluteo','isquiotibiales','biceps','triceps',
                                    'abdominales','gemelo','antebrazo','aductores','lumbares']);

-- ---------------------------------------------------------------------
-- 2. Los de siempre que no tenían grupo, con el suyo (solo si siguen sin ninguno)
-- ---------------------------------------------------------------------
update public.ejercicios set grupos_musculares = array['antebrazo']
 where grupos_musculares = '{}' and nombre in (
   'Extensiones de muñeca en banco con barra/mancuernas', 'Curl de muñeca en banco con barra/mancuernas',
   'Extensiones de muñeca desde polea baja sentado', 'Curl de muñeca desde polea baja sentado/de pie', 'Kettlebell wrist turns');
update public.ejercicios set grupos_musculares = array['aductores']
 where grupos_musculares = '{}' and nombre in ('Aductor en máquina sentado', 'Aducción en polea de pie', 'Aducciones Copenhague');

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 073; esta migración no crea funciones ni tablas)
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

insert into public.fbe_migraciones (numero) values (74)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
