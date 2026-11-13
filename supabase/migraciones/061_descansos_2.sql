-- =====================================================================
-- FBE Equipo, migración 061: los descansos, segunda parte (la manada en la travesía y los apuntes del coach)
--
-- Por qué: con la 060 cada atleta guarda lo que recorre su lobo y los apuntes que ve. Esta añade lo que hace falta para
-- las mejoras de los descansos:
--
--   * travesia_manada(): la clasificación semanal de la travesía entre quienes están en la comunidad (con el nombre que
--     usan allí; quien marcó «No salir en el ranking» no sale), quién ha corrido hoy y lo que suma el equipo en el mes.
--     No guarda nada nuevo: lee travesia_semanas con las reglas de la comunidad.
--   * novedades.tipo y novedades.ejercicio_id: además de «la novedad de la semana», el coach puede escribir apuntes
--     sueltos (tipo 'apunte'), ligados o no a un ejercicio de la biblioteca.
--   * apuntes_vistos admite las claves de los apuntes nuevos (preguntas, dudas, glosario, apuntes del coach, cursos y
--     exámenes): cualquier letra minúscula delante de los dos puntos.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 060 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 61 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 061 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 61;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 60) then  -- (2) la anterior
    raise exception 'Falta la migración 060 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. La manada en la travesía
-- ---------------------------------------------------------------------
-- Para quien está en la comunidad (o el coach): la semana, sus filas (nombre de la comunidad, metros, estrellas, si soy
-- yo y si ha corrido hoy) y lo del equipo en el mes. Quien no quiere salir en el ranking solo se ve a sí mismo; lo suyo
-- sí suma en el total del equipo, que no dice de quién es cada metro.
create or replace function public.travesia_manada() returns jsonb
language sql stable security definer set search_path = '' as $$
  with hoy as (select (now() at time zone 'Europe/Madrid')::date as d),
  lunes as (select d - (extract(isodow from d)::integer - 1) as l, date_trunc('month', d)::date as mes from hoy),
  semana as (
    select d.perfil_id, d.nombre, d.sin_ranking, t.metros, t.estrellas, t.mejor,
           (t.actualizada_en at time zone 'Europe/Madrid')::date = (select d from hoy) as corre_hoy
    from public.travesia_semanas t join fbe_privado.comunidad_dentro d on d.atleta_id = t.atleta_id
    where t.semana = (select l from lunes) and t.metros > 0
  ),
  -- (revisión) cada semana cuenta en el mes de su jueves (no en dos meses); y lo de quien no sale en el ranking solo suma
  -- si son al menos tres (con uno o dos, restando lo que se ve se sabría lo suyo)
  mes as (
    select coalesce(sum(t.metros) filter (where not d.sin_ranking), 0) as m_vis, coalesce(sum(t.metros) filter (where d.sin_ranking), 0) as m_oc,
           count(distinct t.atleta_id) filter (where not d.sin_ranking) as n_vis, count(distinct t.atleta_id) filter (where d.sin_ranking) as n_oc
    from public.travesia_semanas t join fbe_privado.comunidad_dentro d on d.atleta_id = t.atleta_id
    where date_trunc('month', t.semana + 3)::date = (select mes from lunes)
  )
  select case when auth.uid() is null or not (public.es_coach() or public.comunidad_soy_miembro()) then null else jsonb_build_object(
    'semana', (select l from lunes),
    'filas', coalesce((select jsonb_agg(jsonb_build_object('nombre', s.nombre, 'metros', s.metros, 'estrellas', s.estrellas, 'mejor', s.mejor, 'yo', s.perfil_id = auth.uid(), 'hoy', s.corre_hoy)
                        order by s.metros desc, s.nombre)
                       from semana s where not s.sin_ranking or s.perfil_id = auth.uid()), '[]'::jsonb),
    'equipo', jsonb_build_object('mes', (select mes from lunes), 'metros', (select m_vis + case when n_oc >= 3 then m_oc else 0 end from mes),
                                'miembros', (select n_vis + case when n_oc >= 3 then n_oc else 0 end from mes))
  ) end
$$;

-- ---------------------------------------------------------------------
-- 2. Los apuntes sueltos del coach (en la misma tabla que la novedad de la semana)
-- ---------------------------------------------------------------------
alter table public.novedades add column if not exists tipo text not null default 'novedad';
alter table public.novedades add column if not exists ejercicio_id uuid references public.ejercicios(id) on delete set null;
alter table public.novedades drop constraint if exists novedades_tipo_valido;
alter table public.novedades add constraint novedades_tipo_valido check (tipo in ('novedad', 'apunte') and (ejercicio_id is null or tipo = 'apunte'));
create index if not exists novedades_ejercicio_idx on public.novedades (ejercicio_id) where ejercicio_id is not null;

-- ---------------------------------------------------------------------
-- 3. Los apuntes vistos: las claves de los apuntes nuevos
-- ---------------------------------------------------------------------
alter table public.apuntes_vistos drop constraint if exists apuntes_vistos_validos;
alter table public.apuntes_vistos add constraint apuntes_vistos_validos check (
  apunte ~ '^[a-z]:[A-Za-z0-9:_-]{1,78}$' and veces between 1 and 100000
);
create or replace function public.apuntar_apunte(p_apunte text, p_sabia boolean default null)
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
  perform pg_advisory_xact_lock(hashtext('apuntes_vistos:' || v_atleta::text));  -- (dos a la vez no se saltan el tope; como en la 060)
  if (select count(*) from public.apuntes_vistos where atleta_id = v_atleta) >= 3000
     and not exists (select 1 from public.apuntes_vistos where atleta_id = v_atleta and apunte = p_apunte) then return; end if;
  insert into public.apuntes_vistos as x (atleta_id, apunte, ultimo, sabia)
    values (v_atleta, p_apunte, v_hoy, p_sabia)
  on conflict (atleta_id, apunte) do update set
    veces = least(x.veces + case when x.ultimo < excluded.ultimo then 1 else 0 end, 100000),
    ultimo = greatest(x.ultimo, excluded.ultimo),
    sabia = coalesce(excluded.sabia, x.sabia);
end $$;

-- «Lo que más se falla» (para el coach): cuántos atletas no sabían cada apunte, solo la cuenta (nunca quién) y solo si son
-- al menos dos
create or replace function public.apuntes_fallados(p_limite integer default 300)
returns table (apunte text, atletas integer)
language sql stable security definer set search_path = '' as $$
  select v.apunte, count(distinct v.atleta_id)::integer
  from public.apuntes_vistos v
  where public.es_coach() and v.sabia = false
  group by v.apunte having count(distinct v.atleta_id) >= 2
  order by 2 desc, 1
  limit least(greatest(coalesce(p_limite, 300), 1), 1000)
$$;

-- ---------------------------------------------------------------------
-- 4. Permisos (como al final de 003 a 060)
-- ---------------------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb), public.salud_recibir(text, jsonb), public.calendario_de(text) from public, anon, authenticated;
revoke execute on function public.sesion_video_proteger(), public.guia_tocar(), public.novedad_tocar() from public, anon, authenticated;
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

insert into public.fbe_migraciones (numero) values (61)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
