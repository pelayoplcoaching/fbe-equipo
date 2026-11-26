-- =====================================================================
-- FBE Equipo, migración 107: tu medicación y el ejercicio (la lista que confirma el atleta, para Pauta Activa)
--
-- Por qué (decisiones de Pelayo del 26/11/2026 sobre las herramientas de la web y Pauta Activa en FBE Esencial, preguntas
-- 15, 16 y 20; documento del proyecto «claude/esencial-herramientas-integracion.md»):
--   * medicacion_atleta: la lista de medicación que el atleta confirma en «Mi medicación y el ejercicio». La app la
--     reconoce en lo que escribió en «Tomo alguna medicación a diario» (sus preguntas de salud) con los nombres de Pauta
--     Activa; él quita lo que no está bien y la guarda. Una fila por atleta: cada medicamento con el id de Pauta Activa, su
--     nombre, su dosis en mg y sus tomas al día (si las escribió) y el trozo de su texto del que sale. Dato de salud: solo
--     con su consentimiento. La ven él y su coach. Sirve para abrir Pauta Activa con su lista (el enlace lleva la lista en
--     su fragmento, sin nombre) y, más adelante, para las señales de su medicación (apagadas hasta la respuesta de la AEMPS).
--   * guardar_medicacion(p_lista, p_version, p_atleta): la guarda (o la cambia) con sus límites: como mucho 30, sin
--     repetir, cada uno con su id y su nombre, la dosis entre 0 y 100.000 mg y las tomas entre 1 y 12. Una lista vacía
--     también vale («no tomo nada de esto»). El coach la puede guardar por un atleta. El atleta la puede borrar (al borrar
--     sus respuestas de salud, se borra con ellas).
--   Nada cambia en su plan: no hay reglas nuevas.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 106 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 107 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 107 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 107;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 106) then  -- (2) la anterior
    raise exception 'Falta la migración 106 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Su lista confirmada (dato de salud: la escribe guardar_medicacion, con su consentimiento)
-- ---------------------------------------------------------------------
create table if not exists public.medicacion_atleta (
  atleta_id        uuid primary key references public.atletas(id) on delete cascade,
  lista            jsonb not null default '[]'::jsonb,   -- [{ pid, nombre, dosis, tomas, texto }]
  version_base     text,                                  -- la versión de la base de Pauta Activa con la que se reconoció
  confirmado_en    timestamptz not null default now()
);
comment on table public.medicacion_atleta is 'Tu medicación y el ejercicio: la lista que confirma el atleta (reconocida con los nombres de Pauta Activa). La escribe guardar_medicacion().';
alter table public.medicacion_atleta drop constraint if exists medicacion_atleta_valida;
alter table public.medicacion_atleta add constraint medicacion_atleta_valida check (
  jsonb_typeof(lista) = 'array' and jsonb_array_length(lista) <= 30
  and (version_base is null or char_length(version_base) <= 20)
);
alter table public.medicacion_atleta enable row level security;
drop policy if exists coach_todo on public.medicacion_atleta;
create policy coach_todo on public.medicacion_atleta for all to authenticated using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.medicacion_atleta;
create policy atleta_ver on public.medicacion_atleta for select to authenticated using (atleta_id = public.mi_atleta_id());
-- (como sus respuestas de salud: la puede borrar él, también sin consentimiento, por ejemplo tras retirarlo)
drop policy if exists atleta_borrar on public.medicacion_atleta;
create policy atleta_borrar on public.medicacion_atleta for delete to authenticated using (atleta_id = public.mi_atleta_id());
grant select, insert, update, delete on public.medicacion_atleta to authenticated;

-- ---------------------------------------------------------------------
-- 2. Guardarla (la reconoce el móvil; aquí, quién puede, su consentimiento y los límites de cada medicamento)
-- ---------------------------------------------------------------------
-- p_lista: [{ pid, nombre, dosis?, tomas?, texto? }]; p_version: la de la base de Pauta Activa. Devuelve la fila guardada.
create or replace function public.guardar_medicacion(p_lista jsonb, p_version text default null, p_atleta uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := coalesce(p_atleta, public.mi_atleta_id());
  v_limpia jsonb := '[]'::jsonb;
  v_pids text[] := '{}';
  x jsonb;
  v_pid text; v_nombre text; v_texto text;
  v_dosis numeric; v_tomas numeric;
  v_fila public.medicacion_atleta;
begin
  if v_id is null then raise exception 'No hay atleta' using errcode = 'P0002'; end if;
  if not public.es_coach() and public.mi_atleta_id() is distinct from v_id then
    raise exception 'Solo puedes guardar tu propia medicación' using errcode = '42501';
  end if;
  if not exists (select 1 from public.atletas where id = v_id) then raise exception 'Ese atleta no existe' using errcode = 'P0002'; end if;
  if not public.consentimiento_salud_de_atleta(v_id) then raise exception 'Hace falta tu consentimiento de salud' using errcode = '22023'; end if;
  if p_lista is null or jsonb_typeof(p_lista) <> 'array' or jsonb_array_length(p_lista) > 30 then
    raise exception 'Esa lista no vale' using errcode = '22023';
  end if;
  for x in select value from jsonb_array_elements(p_lista) loop
    if jsonb_typeof(x) <> 'object' then raise exception 'Esa lista no vale' using errcode = '22023'; end if;
    v_pid := x ->> 'pid';
    v_nombre := nullif(btrim(regexp_replace(coalesce(x ->> 'nombre', ''), '\s+', ' ', 'g')), '');
    v_texto := nullif(btrim(regexp_replace(coalesce(x ->> 'texto', ''), '\s+', ' ', 'g')), '');
    if v_pid is null or v_pid !~ '^[a-z0-9_]{2,60}$' or v_pid = any (v_pids) then raise exception 'Esa lista no vale' using errcode = '22023'; end if;
    if v_nombre is null or char_length(v_nombre) > 80 or (v_texto is not null and char_length(v_texto) > 80) then
      raise exception 'Esa lista no vale' using errcode = '22023';
    end if;
    begin
      v_dosis := case when jsonb_typeof(x -> 'dosis') = 'number' then (x ->> 'dosis')::numeric else null end;
      v_tomas := case when jsonb_typeof(x -> 'tomas') = 'number' then (x ->> 'tomas')::numeric else null end;
    exception when others then
      raise exception 'Esa lista no vale' using errcode = '22023';
    end;
    if coalesce(jsonb_typeof(x -> 'dosis'), 'null') not in ('number', 'null') or coalesce(jsonb_typeof(x -> 'tomas'), 'null') not in ('number', 'null')
       or (v_dosis is not null and (v_dosis <= 0 or v_dosis > 100000)) or (v_tomas is not null and (v_tomas < 1 or v_tomas > 12 or v_tomas <> trunc(v_tomas))) then
      raise exception 'Esa lista no vale' using errcode = '22023';
    end if;
    v_pids := v_pids || v_pid;
    v_limpia := v_limpia || jsonb_build_array(jsonb_build_object('pid', v_pid, 'nombre', v_nombre, 'dosis', v_dosis, 'tomas', v_tomas::int, 'texto', v_texto));
  end loop;
  insert into public.medicacion_atleta (atleta_id, lista, version_base, confirmado_en)
  values (v_id, v_limpia, left(nullif(btrim(coalesce(p_version, '')), ''), 20), now())
  on conflict (atleta_id) do update set lista = excluded.lista, version_base = excluded.version_base, confirmado_en = excluded.confirmado_en
  returning * into v_fila;
  return to_jsonb(v_fila);
end $$;

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 106)
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

insert into public.fbe_migraciones (numero) values (107)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
