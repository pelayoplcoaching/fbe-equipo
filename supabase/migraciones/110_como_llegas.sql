-- =====================================================================
-- FBE Equipo, migración 110: «¿Cómo llegas hoy?» de un toque en FBE Esencial (el motor del día a día)
--
-- Por qué (reglas de Pelayo del 26/11/2026, formulario 2, bloque B; «claude/motores-siguientes-reglas.md» y
-- «claude/dia-a-dia-plan.md»):
--   * D1: quien va por su cuenta contesta antes de cada sesión con un toque, tres caras (bien, regular o mal) y, si quiere,
--     las horas que ha dormido (D4: con menos de 6 cuenta como «regular»); y, si las tiene, agujetas fuertes en lo de hoy
--     (D5). Y se guarda si eligió lo que le propone la app («Hacerlo así») o entrenar normal (D2, D3).
--   * Va en la misma columna de siempre (sesiones.preparacion), que hasta ahora solo admitía las tres preguntas de la 005
--     (sueño, energía y molestias, de 1 a 3), que siguen igual para los atletas con seguimiento. Ahora admite también
--     { "cara": "bien" | "regular" | "mal", "horas": 2-14 (de media en media hora), "agujetas": true | false,
--       "asi": true | false } (solo la cara es obligatoria).
--   * Es dato de salud, como las tres preguntas: se guarda solo con su consentimiento (la regla de la 005 sigue igual).
--   * preparacion_un_toque(): no hace nada; la app la llama para saber que la base ya admite la forma nueva.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 109 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 110 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 110 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 110;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 109) then  -- (2) la anterior
    raise exception 'Falta la migración 109 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. La forma de «¿Cómo llegas hoy?»: las tres preguntas de siempre o la de un toque
-- ---------------------------------------------------------------------
alter table public.sesiones drop constraint if exists sesiones_preparacion_valida;
alter table public.sesiones add constraint sesiones_preparacion_valida check (
  preparacion is null or coalesce(
    jsonb_typeof(preparacion) = 'object' and (
      -- (005) las tres preguntas, de 1 a 3 cada una, y nada más
      (preparacion ?& array['sueno', 'energia', 'molestias']
        and preparacion - array['sueno', 'energia', 'molestias'] = '{}'::jsonb
        and jsonb_typeof(preparacion -> 'sueno') = 'number' and (preparacion ->> 'sueno') in ('1', '2', '3')
        and jsonb_typeof(preparacion -> 'energia') = 'number' and (preparacion ->> 'energia') in ('1', '2', '3')
        and jsonb_typeof(preparacion -> 'molestias') = 'number' and (preparacion ->> 'molestias') in ('1', '2', '3'))
      -- (110) de un toque: la cara y, si quiere, las horas, las agujetas y lo que eligió
      or (preparacion ? 'cara'
        and preparacion - array['cara', 'horas', 'agujetas', 'asi'] = '{}'::jsonb
        and jsonb_typeof(preparacion -> 'cara') = 'string' and (preparacion ->> 'cara') in ('bien', 'regular', 'mal')
        and case when not preparacion ? 'horas' or jsonb_typeof(preparacion -> 'horas') = 'null' then true
                 when jsonb_typeof(preparacion -> 'horas') = 'number'
                   then (preparacion ->> 'horas')::numeric between 2 and 14 and mod((preparacion ->> 'horas')::numeric * 2, 1) = 0
                 else false end
        and (not preparacion ? 'agujetas' or jsonb_typeof(preparacion -> 'agujetas') = 'boolean')
        and (not preparacion ? 'asi' or jsonb_typeof(preparacion -> 'asi') in ('boolean', 'null')))
    ),
    false)
);
comment on column public.sesiones.preparacion is '«¿Cómo llegas hoy?»: las tres preguntas (005: sueno, energia, molestias, de 1 a 3) o, en FBE Esencial, de un toque (110: cara bien/regular/mal, horas de sueño, agujetas y si eligió lo que propone la app). Dato de salud: con su consentimiento.';

-- ---------------------------------------------------------------------
-- 2. Para que la app sepa que la base ya la admite
-- ---------------------------------------------------------------------
create or replace function public.preparacion_un_toque() returns boolean
language sql immutable set search_path = '' as $$ select true $$;
comment on function public.preparacion_un_toque() is 'FBE Esencial (110): no hace nada; la app la llama para saber que la base admite «¿Cómo llegas hoy?» de un toque.';

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 109)
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
-- (103) las de los disparadores de los ajustes: nadie las llama
revoke execute on function public.esencial_ajuste_hora(), public.esencial_ajuste_registrar() from public, anon, authenticated;
-- (105) la del disparador del perfil de nutrición: nadie la llama
revoke execute on function public.nutricion_perfil_hora() from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;
-- (revisión de la 072) la comprobación de las columnas de música la usa una restricción: el servidor (service_role) también tiene que poder llamarla
grant execute on function fbe_privado.musica_url_valida(text) to service_role;

insert into public.fbe_migraciones (numero) values (110)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
