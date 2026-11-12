-- =====================================================================
-- FBE Equipo, migración 060: los descansos (la novedad de la semana, la travesía y los apuntes)
--
-- Por qué: en los descansos entre series el atleta puede jugar a «La travesía» (un lobo que corre por la montaña) o
-- aprender algo con «Apuntes» (tarjetas sacadas de las guías y las fichas de técnica). Hasta ahora lo que recorría y lo
-- que había visto se guardaba solo en su móvil. Con esta migración:
--
--   * novedades: «la novedad de la semana», un estudio o una idea en tres líneas que escribe el coach (título, texto,
--     de dónde sale y, si quiere, un enlace). Las publicadas las ven todos sus atletas, como un apunte más.
--   * travesia_semanas: lo que ha recorrido el lobo de cada atleta en sus descansos, por semanas (metros, estrellas,
--     etapas y su mejor etapa). Solo lo apunta el propio atleta, con sumar_travesia(); lo ven él y su coach.
--   * apuntes_vistos: qué apuntes ha visto cada atleta (cuántas veces, el último día y, en los que tienen vuelta, si lo
--     sabía). Solo lo apunta el propio atleta, con apuntar_apunte(); lo ven él y su coach (para saber qué se falla más).
--
-- Nada de esto es dato de salud: son metros de un juego y qué tarjetas ha leído. Se borra con la ficha del atleta.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 059 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 60 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 060 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 60;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 59) then  -- (2) la anterior
    raise exception 'Falta la migración 059 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. La novedad de la semana
-- ---------------------------------------------------------------------
create table if not exists public.novedades (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,                     -- «Dormir poco resta fuerza al día siguiente»
  texto        text not null,                     -- tres líneas: qué se hizo, qué salió y qué hacer con ello
  fuente       text,                              -- de dónde sale («Apellido et al., Revista, 2026»)
  enlace       text,                              -- el estudio o el artículo (https)
  publicada    boolean not null default false,
  publicada_en timestamptz,                       -- cuándo se publicó (la pone la base)
  creada_en    timestamptz not null default now()
);
alter table public.novedades drop constraint if exists novedades_validas;
alter table public.novedades add constraint novedades_validas check (
  char_length(titulo) between 1 and 90 and public.texto_visible(titulo)
  and char_length(texto) between 1 and 500 and public.texto_visible(texto)
  and (fuente is null or (char_length(fuente) between 1 and 200 and public.texto_visible(fuente)))
  and (enlace is null or (char_length(enlace) <= 300 and enlace !~ '\s' and enlace ~* '^https://[a-z0-9.-]+\.[a-z]{2,}(/|$)'))
);
create index if not exists novedades_publicadas_idx on public.novedades (publicada_en desc) where publicada;

-- Al publicarla se apunta cuándo (y al despublicarla se quita): el atleta ve las últimas primero
create or replace function public.novedad_tocar() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.publicada and (tg_op = 'INSERT' or not old.publicada or new.publicada_en is null) then new.publicada_en := coalesce(new.publicada_en, now()); end if;
  if not new.publicada then new.publicada_en := null; end if;
  return new;
end $$;
drop trigger if exists novedades_tocar on public.novedades;
create trigger novedades_tocar before insert or update on public.novedades
  for each row execute function public.novedad_tocar();

-- ---------------------------------------------------------------------
-- 2. La travesía: lo que recorre el lobo de cada atleta, por semanas
-- ---------------------------------------------------------------------
create table if not exists public.travesia_semanas (
  atleta_id      uuid not null references public.atletas(id) on delete cascade,
  semana         date not null,                   -- el lunes de la semana (hora de Madrid)
  metros         integer not null default 0,
  estrellas      integer not null default 0,
  etapas         integer not null default 0,      -- descansos jugados
  mejor          integer not null default 0,      -- su etapa más larga de la semana
  actualizada_en timestamptz not null default now(),
  primary key (atleta_id, semana)
);
alter table public.travesia_semanas drop constraint if exists travesia_semanas_validas;
alter table public.travesia_semanas add constraint travesia_semanas_validas check (
  extract(isodow from semana) = 1
  and metros between 0 and 2000000 and estrellas between 0 and 200000 and etapas between 0 and 20000 and mejor between 0 and 20000
);
create index if not exists travesia_semanas_semana_idx on public.travesia_semanas (semana);

-- El atleta suma lo jugado (una etapa, o varias si su móvil llevaba un rato sin poder subirlas). Con topes: una etapa no
-- pasa de 5 km ni una subida de 60 km, y una semana no pasa de 2000 km.
create or replace function public.sumar_travesia(p_metros integer, p_estrellas integer default 0, p_etapas integer default 1, p_mejor integer default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_atleta uuid := public.mi_atleta_id();
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_lunes date := v_hoy - (extract(isodow from v_hoy)::integer - 1);
  v_etapas integer := least(greatest(coalesce(p_etapas, 1), 1), 60);
  v_metros integer := least(greatest(coalesce(p_metros, 0), 0), 5000 * v_etapas, 60000);
  v_estrellas integer := least(greatest(coalesce(p_estrellas, 0), 0), 400 * v_etapas);
  v_mejor integer := least(greatest(coalesce(p_mejor, case when v_etapas = 1 then v_metros else 0 end), 0), 5000, v_metros);
begin
  if v_atleta is null then return; end if;  -- el coach sin ficha de atleta (o una cuenta sin ficha): no se apunta nada
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then return; end if;  -- de baja, nada nuevo (como en la 059)
  if v_metros <= 0 then return; end if;
  insert into public.travesia_semanas as t (atleta_id, semana, metros, estrellas, etapas, mejor)
    values (v_atleta, v_lunes, v_metros, v_estrellas, v_etapas, v_mejor)
  on conflict (atleta_id, semana) do update set
    metros = least(t.metros + excluded.metros, 2000000),
    estrellas = least(t.estrellas + excluded.estrellas, 200000),
    etapas = least(t.etapas + excluded.etapas, 20000),
    mejor = greatest(t.mejor, excluded.mejor),
    actualizada_en = now();
end $$;

-- ---------------------------------------------------------------------
-- 3. Los apuntes que ha visto cada atleta
-- ---------------------------------------------------------------------
create table if not exists public.apuntes_vistos (
  atleta_id   uuid not null references public.atletas(id) on delete cascade,
  apunte      text not null,                      -- p:<ficha>:<n> (clave), e:<ficha>:<n> (error), i:<guía>:<n> (idea), m:<n> (mito), n:<novedad>
  veces       integer not null default 1,         -- en cuántos días distintos lo ha visto
  ultimo      date not null default current_date, -- el último día
  sabia       boolean,                            -- en los que tienen vuelta: si lo sabía la última vez que contestó
  primera_vez timestamptz not null default now(),
  primary key (atleta_id, apunte)
);
alter table public.apuntes_vistos drop constraint if exists apuntes_vistos_validos;
alter table public.apuntes_vistos add constraint apuntes_vistos_validos check (
  apunte ~ '^[peimn]:[A-Za-z0-9:_-]{1,78}$' and veces between 1 and 100000
);
create index if not exists apuntes_vistos_apunte_idx on public.apuntes_vistos (apunte);

-- El atleta apunta lo que ha visto (y, si le dio la vuelta, si lo sabía). Otra vez = otro día. Como mucho 3000 distintos.
create or replace function public.apuntar_apunte(p_apunte text, p_sabia boolean default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_atleta uuid := public.mi_atleta_id();
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
  if v_atleta is null then return; end if;
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then return; end if;
  if p_apunte is null or p_apunte !~ '^[peimn]:[A-Za-z0-9:_-]{1,78}$' then
    raise exception 'Ese no es un apunte' using errcode = '22023';
  end if;
  if (select count(*) from public.apuntes_vistos where atleta_id = v_atleta) >= 3000
     and not exists (select 1 from public.apuntes_vistos where atleta_id = v_atleta and apunte = p_apunte) then return; end if;
  insert into public.apuntes_vistos as x (atleta_id, apunte, ultimo, sabia)
    values (v_atleta, p_apunte, v_hoy, p_sabia)
  on conflict (atleta_id, apunte) do update set
    veces = least(x.veces + case when x.ultimo < excluded.ultimo then 1 else 0 end, 100000),
    ultimo = greatest(x.ultimo, excluded.ultimo),
    sabia = coalesce(excluded.sabia, x.sabia);
end $$;

-- ---------------------------------------------------------------------
-- 4. Quién ve qué
-- ---------------------------------------------------------------------
alter table public.novedades enable row level security;
alter table public.travesia_semanas enable row level security;
alter table public.apuntes_vistos enable row level security;

drop policy if exists coach_todo on public.novedades;
create policy coach_todo on public.novedades for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.novedades;
create policy atleta_ver on public.novedades for select to authenticated
  using (publicada and public.mi_atleta_id() is not null);

drop policy if exists coach_ver on public.travesia_semanas;
create policy coach_ver on public.travesia_semanas for select to authenticated using (public.es_coach());
drop policy if exists coach_borrar on public.travesia_semanas;
create policy coach_borrar on public.travesia_semanas for delete to authenticated using (public.es_coach());
drop policy if exists atleta_ver on public.travesia_semanas;
create policy atleta_ver on public.travesia_semanas for select to authenticated using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_borrar on public.travesia_semanas;
create policy atleta_borrar on public.travesia_semanas for delete to authenticated using (atleta_id = public.mi_atleta_id());

drop policy if exists coach_ver on public.apuntes_vistos;
create policy coach_ver on public.apuntes_vistos for select to authenticated using (public.es_coach());
drop policy if exists coach_borrar on public.apuntes_vistos;
create policy coach_borrar on public.apuntes_vistos for delete to authenticated using (public.es_coach());
drop policy if exists atleta_ver on public.apuntes_vistos;
create policy atleta_ver on public.apuntes_vistos for select to authenticated using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_borrar on public.apuntes_vistos;
create policy atleta_borrar on public.apuntes_vistos for delete to authenticated using (atleta_id = public.mi_atleta_id());

-- Desde la 019, cada tabla nueva lleva sus permisos a mano
revoke all on public.novedades, public.travesia_semanas, public.apuntes_vistos from public, anon, authenticated;
grant select, insert, update, delete on public.novedades to authenticated;
grant select, delete on public.travesia_semanas, public.apuntes_vistos to authenticated;

-- ---------------------------------------------------------------------
-- 5. Permisos (como al final de 003 a 059)
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

insert into public.fbe_migraciones (numero) values (60)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
