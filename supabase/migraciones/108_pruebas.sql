-- =====================================================================
-- FBE Equipo, migración 108: «Tus pruebas» de FBE Esencial (silla, equilibrio, cintura y altura, prensión y SPPB)
--
-- Por qué (decisiones de Pelayo del 26/11/2026 sobre las herramientas de la web en FBE Esencial, preguntas 5 a 9 y 24;
-- plan en el documento del proyecto «claude/esencial-tus-pruebas-plan.md»):
--   * pruebas_fisicas: cada prueba que hace el atleta, en su punto de partida y cada 12 semanas: levantarse de la silla en
--     30 segundos (veces), 10 segundos sobre una pierna (segundos; 10 = conseguido), cintura entre altura (el índice, con
--     las dos medidas), la prensión con dinamómetro (kg, el mejor de sus intentos) y, desde los 65, el SPPB (de 0 a 12, con
--     sus tres partes). Con su edad y su sexo de ese día (para los rangos de referencia). Una por prueba y día: si la
--     repite el mismo día, se queda la última. Dato de salud: solo con su consentimiento. Las ven él y su coach; las
--     puede borrar él (desde la hoja de sus pruebas, también sin consentimiento).
--   * guardar_prueba(p, p_atleta): la guarda con sus límites (los de cada prueba) y su consentimiento de salud.
--   Nada cambia en su plan: los resultados no tocan la programación (pregunta 8a).
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 107 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 108 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 108 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 108;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 107) then  -- (2) la anterior
    raise exception 'Falta la migración 107 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Sus pruebas (dato de salud: las escribe guardar_prueba, con su consentimiento)
-- ---------------------------------------------------------------------
create table if not exists public.pruebas_fisicas (
  id               uuid primary key default gen_random_uuid(),
  atleta_id        uuid not null references public.atletas(id) on delete cascade,
  fecha            date not null default ((now() at time zone 'Europe/Madrid')::date),
  prueba           text not null,           -- silla · equilibrio · cintura · prension · sppb
  valor            numeric(6,2) not null,
  detalle          jsonb,
  edad             smallint,
  sexo             text,
  creado_en        timestamptz not null default now()
);
comment on table public.pruebas_fisicas is 'FBE Esencial, «Tus pruebas»: cada prueba física del atleta (una por prueba y día). La escribe guardar_prueba().';
alter table public.pruebas_fisicas drop constraint if exists pruebas_fisicas_validas;
alter table public.pruebas_fisicas add constraint pruebas_fisicas_validas check (
  prueba in ('silla', 'equilibrio', 'cintura', 'prension', 'sppb')
  and (edad is null or edad between 18 and 110) and (sexo is null or sexo in ('hombre', 'mujer'))
  and (detalle is null or (jsonb_typeof(detalle) = 'object' and pg_column_size(detalle) <= 2000))
  and case prueba
        when 'silla' then valor between 0 and 60 and valor = trunc(valor)
        when 'equilibrio' then valor between 0 and 10
        when 'cintura' then valor between 0.15 and 1.5
        when 'prension' then valor > 0 and valor < 200
        when 'sppb' then valor between 0 and 12 and valor = trunc(valor)
      end
);
create unique index if not exists pruebas_fisicas_dia on public.pruebas_fisicas (atleta_id, prueba, fecha);
alter table public.pruebas_fisicas enable row level security;
drop policy if exists coach_todo on public.pruebas_fisicas;
create policy coach_todo on public.pruebas_fisicas for all to authenticated using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.pruebas_fisicas;
create policy atleta_ver on public.pruebas_fisicas for select to authenticated using (atleta_id = public.mi_atleta_id());
-- (como sus respuestas de salud: las puede borrar él, también sin consentimiento)
drop policy if exists atleta_borrar on public.pruebas_fisicas;
create policy atleta_borrar on public.pruebas_fisicas for delete to authenticated using (atleta_id = public.mi_atleta_id());
grant select, insert, update, delete on public.pruebas_fisicas to authenticated;

-- ---------------------------------------------------------------------
-- 2. Guardarla (la calcula el móvil con logica/esencial-pruebas.js; aquí, quién puede, su consentimiento y los límites)
-- ---------------------------------------------------------------------
-- p: { prueba, valor, detalle?, edad?, sexo? }. Silla: valor = veces (0-60). Equilibrio: valor = segundos (0-10) y
-- detalle.intentos (1 a 3, de 0 a 10; con 10 = conseguido, el valor es 10; si no, son 3 y el valor es el mejor).
-- Cintura: valor = cintura / altura y detalle { cintura (30-250), altura (100-250) }. Prensión: detalle.intentos (1 a 3, de
-- más de 0 a menos de 200 kg) y valor = el mejor. SPPB: detalle.partes { equilibrio, marcha, silla } (0-4 cada una) y
-- valor = su suma. Devuelve la fila guardada.
create or replace function public.guardar_prueba(p jsonb, p_atleta uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := coalesce(p_atleta, public.mi_atleta_id());
  v_prueba text := coalesce(p ->> 'prueba', '');
  v_valor numeric; v_edad numeric; v_sexo text := nullif(p ->> 'sexo', '');
  v_det jsonb := case when jsonb_typeof(p -> 'detalle') = 'object' then p -> 'detalle' else null end;
  v_int jsonb; v_n int; v_max numeric; v_ok boolean;
  v_c numeric; v_h numeric; v_e numeric; v_m numeric; v_s numeric;
  v_fila public.pruebas_fisicas;
  x jsonb;
begin
  if v_id is null then raise exception 'No hay atleta' using errcode = 'P0002'; end if;
  if not public.es_coach() and public.mi_atleta_id() is distinct from v_id then
    raise exception 'Solo puedes guardar tus propias pruebas' using errcode = '42501';
  end if;
  if not exists (select 1 from public.atletas where id = v_id) then raise exception 'Ese atleta no existe' using errcode = 'P0002'; end if;
  if not public.consentimiento_salud_de_atleta(v_id) then raise exception 'Hace falta tu consentimiento de salud' using errcode = '22023'; end if;
  if v_prueba not in ('silla', 'equilibrio', 'cintura', 'prension', 'sppb') or coalesce(jsonb_typeof(p -> 'valor'), '') <> 'number'
     or coalesce(jsonb_typeof(p -> 'edad'), 'null') not in ('number', 'null') or (v_sexo is not null and v_sexo not in ('hombre', 'mujer')) then
    raise exception 'Esa prueba no vale' using errcode = '22023';
  end if;
  v_valor := (p ->> 'valor')::numeric;
  v_edad := (p ->> 'edad')::numeric;
  if v_edad is not null and (v_edad < 18 or v_edad > 110 or v_edad <> trunc(v_edad)) then raise exception 'Esa prueba no vale' using errcode = '22023'; end if;
  -- Lo de cada prueba: que el detalle cuadre con el valor
  if v_prueba = 'silla' then
    v_det := null;
  elsif v_prueba in ('equilibrio', 'prension') then
    v_int := v_det -> 'intentos';
    if v_int is null or coalesce(jsonb_typeof(v_int), '') <> 'array' then raise exception 'Esa prueba no vale' using errcode = '22023'; end if;
    if jsonb_array_length(v_int) not between 1 and 3 then raise exception 'Esa prueba no vale' using errcode = '22023'; end if;
    v_max := null; v_ok := false; v_n := jsonb_array_length(v_int);
    for x in select value from jsonb_array_elements(v_int) loop
      if coalesce(jsonb_typeof(x), '') <> 'number' then raise exception 'Esa prueba no vale' using errcode = '22023'; end if;
      if v_prueba = 'equilibrio' and ((x #>> '{}')::numeric < 0 or (x #>> '{}')::numeric > 10) then raise exception 'Esa prueba no vale' using errcode = '22023'; end if;
      if v_prueba = 'prension' and ((x #>> '{}')::numeric <= 0 or (x #>> '{}')::numeric >= 200) then raise exception 'Esa prueba no vale' using errcode = '22023'; end if;
      v_max := greatest(coalesce(v_max, (x #>> '{}')::numeric), (x #>> '{}')::numeric);
      if (x #>> '{}')::numeric >= 10 then v_ok := true; end if;
    end loop;
    if v_prueba = 'equilibrio' and ((v_ok and v_valor <> 10) or (not v_ok and (v_n <> 3 or v_valor <> v_max))) then raise exception 'Esa prueba no vale' using errcode = '22023'; end if;
    if v_prueba = 'prension' and v_valor <> v_max then raise exception 'Esa prueba no vale' using errcode = '22023'; end if;
    v_det := jsonb_build_object('intentos', v_int);
  elsif v_prueba = 'cintura' then
    if v_det is null or coalesce(jsonb_typeof(v_det -> 'cintura'), '') <> 'number' or coalesce(jsonb_typeof(v_det -> 'altura'), '') <> 'number' then raise exception 'Esa prueba no vale' using errcode = '22023'; end if;
    v_c := (v_det ->> 'cintura')::numeric; v_h := (v_det ->> 'altura')::numeric;
    if v_c not between 30 and 250 or v_h not between 100 and 250 then raise exception 'Esa prueba no vale' using errcode = '22023'; end if;
    if abs(v_valor - v_c / v_h) > 0.01 then raise exception 'Esa prueba no vale' using errcode = '22023'; end if;
    v_valor := round(v_c / v_h, 2);
    v_det := jsonb_build_object('cintura', v_c, 'altura', v_h);
  else
    if v_det is null or coalesce(jsonb_typeof(v_det -> 'partes'), '') <> 'object' then raise exception 'Esa prueba no vale' using errcode = '22023'; end if;
    if coalesce(jsonb_typeof(v_det -> 'partes' -> 'equilibrio'), '') <> 'number' or coalesce(jsonb_typeof(v_det -> 'partes' -> 'marcha'), '') <> 'number' or coalesce(jsonb_typeof(v_det -> 'partes' -> 'silla'), '') <> 'number' then
      raise exception 'Esa prueba no vale' using errcode = '22023';
    end if;
    v_e := (v_det #>> '{partes,equilibrio}')::numeric; v_m := (v_det #>> '{partes,marcha}')::numeric; v_s := (v_det #>> '{partes,silla}')::numeric;
    if v_e not in (0, 1, 2, 3, 4) or v_m not in (0, 1, 2, 3, 4) or v_s not in (0, 1, 2, 3, 4) or v_valor <> v_e + v_m + v_s then raise exception 'Esa prueba no vale' using errcode = '22023'; end if;
    v_det := jsonb_build_object('partes', jsonb_build_object('equilibrio', v_e, 'marcha', v_m, 'silla', v_s));
  end if;
  begin
    insert into public.pruebas_fisicas (atleta_id, fecha, prueba, valor, detalle, edad, sexo)
    values (v_id, (now() at time zone 'Europe/Madrid')::date, v_prueba, v_valor, v_det, v_edad::smallint, v_sexo)
    on conflict (atleta_id, prueba, fecha) do update set valor = excluded.valor, detalle = excluded.detalle, edad = excluded.edad, sexo = excluded.sexo, creado_en = now()
    returning * into v_fila;
  exception when check_violation or numeric_value_out_of_range then
    raise exception 'Esa prueba no vale' using errcode = '22023';
  end;
  return to_jsonb(v_fila);
end $$;

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 107)
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

insert into public.fbe_migraciones (numero) values (108)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
