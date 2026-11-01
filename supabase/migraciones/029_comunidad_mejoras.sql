-- =====================================================================
-- FBE Equipo, migración 029 (v0.47): diez mejoras de la comunidad del equipo
-- Lo que se comparte crece un poco (racha, perfil del equipo, votos, ánimos y menciones): cambia el texto de la
-- entrada (comunidad_version() = 'comunidad-2026-11-b') y cada uno tiene que volver a aceptarlo una vez.
--   · Resumen de la semana del equipo, comunidad_resumen_semana(): solo recuentos (sesiones hechas esta semana,
--     cuántos llevan la semana completa, récords compartidos y retos en marcha), sin los de «No salir en el ranking».
--   · Rachas, comunidad_rachas(): semanas seguidas con todas las sesiones publicadas hechas. Las semanas sin nada
--     publicado no suman ni rompen (se saltan); la semana en curso suma si ya está completa y, si no, no rompe.
--   · Perfil en el equipo, comunidad_perfil(): nombre, foto, desde cuándo, racha, retos conseguidos y entrenos
--     compartidos (sin racha ni retos de quien no sale en el ranking, salvo para él mismo y el coach).
--   · Retos de equipo (comunidad_retos.modo): el objetivo es el total del equipo (de 1 a 5000 sesiones); no cuentan
--     las sesiones de quien no sale en el ranking. comunidad_retos_totales() da el total de cada reto (el progreso de
--     cada uno sigue en comunidad_retos_progreso(), sin cambios).
--   · Logros: comunidad_compartir_logro() comprueba en la base que el reto está conseguido y publica una tarjeta
--     «logro» que hace la base (una vez por reto y persona). Un reto que acabó antes de que entrara no cuenta.
--   · Menciones (comunidad_posts.menciones y comunidad_comentarios.menciones): la base deja solo a quien está
--     dentro (o al coach), nunca al autor, como mucho 5, y les avisa («X te ha mencionado», sin el texto).
--   · Encuestas del coach (comunidad_posts.encuesta, tipo «encuesta»; no cambian tras publicarse) y sus votos
--     (comunidad_votos, con comunidad_votar(): solo quien está dentro, una opción válida y antes del cierre).
--   · Ánimos (comunidad_animos, con comunidad_animar()): uno por persona y semana, nunca a uno mismo, como mucho 40
--     al día (comunidad_cupos), con su notificación («X te ha mandado ánimo 🙌»).
--   · Votos y ánimos, como las reacciones: al salir dejan de verse (y se borran si lo pide) y van en
--     comunidad_mis_datos() («Descargar mis datos»).
-- Tras la revisión de seguridad de la v0.47:
--   · Lo que cuenta en la comunidad (retos, logros, resumen, rachas y ranking) son solo sesiones terminadas de
--     semanas publicadas de bloques no cancelados, con fecha de hasta hoy (Madrid) y como mucho 2 por día; y el
--     atleta ya no puede fechar una sesión después de mañana (proteger_sesion).
--   · Menciones: una notificación por autor y destinatario y hora, 20 al día por autor (comunidad_cupos), solo si
--     la publicación se ve; se retiran al borrar u ocultar el comentario o la publicación.
--   · Las rachas solo salen desde 1 y el perfil devuelve lo mismo sin racha que sin ranking (no se puede deducir).
--   · Los logros cuentan desde la última vez que entró (comunidad_miembros.entrado_en); votar tiene cupo (30 al día);
--     el coach no anima con la comunidad cerrada; salir y borrar se lleva también los ánimos recibidos.
-- Nada de esto lee peso, medidas, nutrición, check-ins, molestias, vídeos ni mensajes con el coach.
-- Se ejecuta en el SQL Editor después de la 028 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 29 then
    raise exception 'Esta base ya tiene la migración %: repetir la 029 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 29;» y, después de ella, todas las siguientes en orden, todo en la misma consulta del SQL Editor (una sola transacción).';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 28) then
    raise exception 'Antes de la 029 hace falta la 028: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Lo que se acepta al entrar (cambia: hay que volver a aceptarlo)
-- ---------------------------------------------------------------------
-- Cambia esta versión (y VERSION_COMUNIDAD en web/src/datos/api.js) cuando cambie el texto de la entrada.
create or replace function public.comunidad_version() returns text
language sql immutable set search_path = '' as $$ select 'comunidad-2026-11-b'::text $$;

-- ---------------------------------------------------------------------
-- 2. Tablas y columnas
-- ---------------------------------------------------------------------
-- Retos de equipo: el objetivo es el total de sesiones de todo el equipo
alter table public.comunidad_retos add column if not exists modo text not null default 'individual';
alter table public.comunidad_retos drop constraint if exists comunidad_retos_validos;
alter table public.comunidad_retos add constraint comunidad_retos_validos check (
  char_length(titulo) between 1 and 80 and public.texto_visible(titulo)
  and (descripcion is null or (char_length(descripcion) between 1 and 500 and public.texto_visible(descripcion)))
  and desde >= date '2020-01-01' and hasta < date '2100-01-01' and hasta >= desde and hasta - desde <= 366
  and modo in ('individual', 'equipo')
  and objetivo between 1 and case when modo = 'equipo' then 5000 else 100 end
);

-- Una encuesta: de 2 a 4 opciones distintas (de 1 a 80 letras) y un cierre opcional (la hora la normaliza la base)
create or replace function public.comunidad_encuesta_valida(p jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  o jsonb;
  vistas text[] := '{}';
begin
  if p is null or jsonb_typeof(p) <> 'object' or (p - 'opciones' - 'cierre') <> '{}'::jsonb then return false; end if;
  if jsonb_typeof(p -> 'opciones') is distinct from 'array' or jsonb_array_length(p -> 'opciones') not between 2 and 4 then return false; end if;
  if p ? 'cierre' and jsonb_typeof(p -> 'cierre') not in ('null', 'string') then return false; end if;
  for o in select t.v from jsonb_array_elements(p -> 'opciones') as t(v) loop
    if jsonb_typeof(o) <> 'string' or char_length(o #>> '{}') not between 1 and 80 or not public.texto_visible(o #>> '{}')
       or lower(btrim(o #>> '{}')) = any (vistas) then
      return false;
    end if;
    vistas := vistas || lower(btrim(o #>> '{}'));
  end loop;
  return true;
end $$;

alter table public.comunidad_posts add column if not exists menciones uuid[] not null default '{}';
alter table public.comunidad_posts add column if not exists encuesta jsonb;
alter table public.comunidad_posts add column if not exists reto_id uuid references public.comunidad_retos(id) on delete set null;
create index if not exists comunidad_posts_reto_idx on public.comunidad_posts (reto_id);
create index if not exists comunidad_posts_tipo_idx on public.comunidad_posts (tipo, creado_en desc);
-- Un logro, una vez por reto y persona
create unique index if not exists comunidad_posts_logro_idx on public.comunidad_posts (autor_id, reto_id) where tipo = 'logro';
alter table public.comunidad_posts drop constraint if exists comunidad_posts_validos;
alter table public.comunidad_posts add constraint comunidad_posts_validos check (
  tipo in ('aviso', 'post', 'entreno', 'logro', 'encuesta')
  and (texto is null or (char_length(texto) between 1 and 2000 and public.texto_visible(texto)))
  and (tipo not in ('aviso', 'encuesta') or texto is not null)
  and (tipo <> 'encuesta' or char_length(texto) <= 300)
  and (tipo <> 'post' or texto is not null or foto_ruta is not null)
  and (tipo in ('entreno', 'logro')) = (resumen is not null)
  and (tipo = 'entreno' or sesion_id is null)
  and (tipo = 'logro' or reto_id is null)
  and (tipo in ('post', 'aviso') or foto_ruta is null)
  and (tipo = 'encuesta') = (encuesta is not null)
  and (encuesta is null or public.comunidad_encuesta_valida(encuesta))
  and (not fijada or tipo in ('aviso', 'encuesta'))
  and cardinality(menciones) <= 5
  and (foto_ruta is null or foto_ruta ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|coach)/[A-Za-z0-9]{8,40}\.jpg$')
  and (resumen is null or (jsonb_typeof(resumen) = 'object' and pg_column_size(resumen) <= 16000))
);

alter table public.comunidad_comentarios add column if not exists menciones uuid[] not null default '{}';
alter table public.comunidad_comentarios drop constraint if exists comunidad_comentarios_validos;
alter table public.comunidad_comentarios add constraint comunidad_comentarios_validos check (
  char_length(texto) between 1 and 1000 and public.texto_visible(texto) and cardinality(menciones) <= 5
);

-- Un aviso al coach también puede ser de un logro o de una encuesta
alter table public.comunidad_reportes drop constraint if exists comunidad_reportes_validos;
alter table public.comunidad_reportes add constraint comunidad_reportes_validos check (
  (motivo is null or (char_length(motivo) between 1 and 300 and public.texto_visible(motivo)))
  and (copia_tipo is null or copia_tipo in ('aviso', 'post', 'entreno', 'logro', 'encuesta', 'comentario'))
  and (copia_texto is null or char_length(copia_texto) <= 2000)
  and (copia_autor_nombre is null or char_length(copia_autor_nombre) <= 80)
);

-- Los votos de las encuestas: uno por persona (se puede cambiar hasta el cierre)
create table if not exists public.comunidad_votos (
  post_id    uuid not null references public.comunidad_posts(id) on delete cascade,
  autor_id   uuid not null references public.perfiles(id) on delete cascade,
  atleta_id  uuid references public.atletas(id) on delete cascade,
  opcion     smallint not null,                  -- la posición de la opción (0 a 3)
  creado_en  timestamptz not null default now(),
  primary key (post_id, autor_id)
);
create index if not exists comunidad_votos_autor_idx on public.comunidad_votos (autor_id);
create index if not exists comunidad_votos_atleta_idx on public.comunidad_votos (atleta_id);
alter table public.comunidad_votos drop constraint if exists comunidad_votos_validos;
alter table public.comunidad_votos add constraint comunidad_votos_validos check (opcion between 0 and 3);

-- Los ánimos: uno de cada persona a cada otra por semana (la del lunes, en Madrid)
create table if not exists public.comunidad_animos (
  de              uuid not null references public.perfiles(id) on delete cascade,
  para            uuid not null references public.perfiles(id) on delete cascade,
  atleta_id       uuid references public.atletas(id) on delete cascade,   -- la ficha de quien anima (null: el coach)
  para_atleta_id  uuid references public.atletas(id) on delete cascade,   -- la de quien lo recibe
  semana          date not null,
  creado_en       timestamptz not null default now(),
  primary key (de, para, semana)
);
create index if not exists comunidad_animos_para_idx on public.comunidad_animos (para, semana);
create index if not exists comunidad_animos_atleta_idx on public.comunidad_animos (atleta_id);
create index if not exists comunidad_animos_para_atleta_idx on public.comunidad_animos (para_atleta_id);
alter table public.comunidad_animos drop constraint if exists comunidad_animos_validos;
alter table public.comunidad_animos add constraint comunidad_animos_validos check (de <> para and extract(isodow from semana) = 1);

-- Los ánimos, los votos y las notificaciones de las menciones también tienen su cupo diario
alter table public.comunidad_cupos drop constraint if exists comunidad_cupos_tipo_check;
alter table public.comunidad_cupos add constraint comunidad_cupos_tipo_check check (tipo in ('post', 'comentario', 'reporte', 'animo', 'voto', 'mencion'));

-- La última vez que entró (o volvió) en la comunidad: los logros cuentan desde ahí (creado_en es la primera). Los
-- que ya estaban, desde su última aceptación (lo más prudente: no se sabe si salieron y volvieron).
alter table public.comunidad_miembros add column if not exists entrado_en timestamptz;
update public.comunidad_miembros set entrado_en = aceptado_en where entrado_en is null;
alter table public.comunidad_miembros alter column entrado_en set default now();
alter table public.comunidad_miembros alter column entrado_en set not null;

-- ---------------------------------------------------------------------
-- 3. Lo que calcula la base (internas: solo las usan las funciones de abajo)
-- ---------------------------------------------------------------------
-- El lunes de esta semana, en Madrid
create or replace function fbe_privado.comunidad_lunes() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Madrid')::date - (extract(isodow from (now() at time zone 'Europe/Madrid'))::integer - 1)
$$;

-- Hoy, en Madrid
create or replace function fbe_privado.comunidad_hoy() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Madrid')::date
$$;

-- Las sesiones que cuentan en la comunidad (retos, logros, resumen, rachas y ranking): terminadas, de semanas
-- publicadas de bloques no cancelados, con su fecha de hasta hoy y como mucho 2 por día (si un día tiene más, las
-- dos primeras de la semana más antigua). Así no se infla nada marcando de golpe lo que no se ha hecho.
create or replace function fbe_privado.comunidad_sesiones_validas(p_atletas uuid[])
returns table (atleta_id uuid, sesion_id uuid, semana_id uuid, fecha date)
language sql stable security definer set search_path = '' as $$
  select x.atleta_id, x.sesion_id, x.semana_id, x.fecha
  from (
    select b.atleta_id, s.id as sesion_id, s.semana_id, s.fecha_realizada as fecha,
           row_number() over (partition by b.atleta_id, s.fecha_realizada order by w.fecha_inicio, s.orden, s.id) as n
    from public.sesiones s
    join public.semanas w on w.id = s.semana_id
    join public.bloques b on b.id = w.bloque_id
    where b.atleta_id = any (p_atletas) and not b.es_plantilla and b.estado <> 'cancelado' and w.programacion = 'programada'
      and s.completada and s.fecha_realizada is not null and s.fecha_realizada <= fbe_privado.comunidad_hoy()
  ) x
  where x.n <= 2
$$;

-- Las semanas publicadas de cada atleta hasta esta (una por lunes: si dos bloques publican la misma, la del más
-- reciente, como en el ranking), con cuántas sesiones tiene y cuántas de ellas cuentan como hechas. Sin sesiones,
-- no sale.
create or replace function fbe_privado.comunidad_semanas_de(p_atletas uuid[])
returns table (atleta_id uuid, lunes date, previstas integer, hechas integer)
language sql stable security definer set search_path = '' as $$
  with validas as (
    select v.semana_id from fbe_privado.comunidad_sesiones_validas(p_atletas) v
  ), semana as (
    select distinct on (b.atleta_id, l.lunes) b.atleta_id, l.lunes, w.id as semana_id
    from public.bloques b
    join public.semanas w on w.bloque_id = b.id and w.programacion = 'programada' and w.fecha_inicio is not null
    cross join lateral (select w.fecha_inicio - (extract(isodow from w.fecha_inicio)::integer - 1) as lunes) l
    where b.atleta_id = any (p_atletas) and not b.es_plantilla and b.estado <> 'cancelado'
      and l.lunes <= fbe_privado.comunidad_lunes()
    order by b.atleta_id, l.lunes, b.fecha_inicio desc nulls last, b.numero desc nulls last
  )
  select s.atleta_id, s.lunes, count(x.id)::integer, (select count(*)::integer from validas v where v.semana_id = s.semana_id)
  from semana s join public.sesiones x on x.semana_id = s.semana_id
  group by s.atleta_id, s.lunes, s.semana_id
$$;

-- La racha de cada uno: semanas seguidas con todo lo publicado hecho. Las semanas sin sesiones publicadas se
-- saltan (ni suman ni rompen); la de esta semana suma si ya está completa y, si no, tampoco rompe.
create or replace function fbe_privado.comunidad_rachas_de(p_atletas uuid[])
returns table (atleta_id uuid, racha integer, semana_completa boolean)
language sql stable security definer set search_path = '' as $$
  with s as (
    select * from fbe_privado.comunidad_semanas_de(p_atletas)
  ), cuentan as (
    select s.atleta_id, s.hechas >= s.previstas as completa,
           row_number() over (partition by s.atleta_id order by s.lunes desc) as n
    from s where s.lunes < fbe_privado.comunidad_lunes() or s.hechas >= s.previstas
  )
  select a.id,
    coalesce((select min(c.n) - 1 from cuentan c where c.atleta_id = a.id and not c.completa),
             (select count(*) from cuentan c where c.atleta_id = a.id))::integer,
    exists (select 1 from s where s.atleta_id = a.id and s.lunes = fbe_privado.comunidad_lunes() and s.hechas >= s.previstas)
  from unnest(p_atletas) as a(id)
$$;

-- Sesiones que cuentan de un atleta entre dos fechas (las dos incluidas)
create or replace function fbe_privado.comunidad_hechas(p_atleta uuid, p_desde date, p_hasta date) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from fbe_privado.comunidad_sesiones_validas(array[p_atleta]) v where v.fecha between p_desde and p_hasta
$$;

-- El total de un reto de equipo: las sesiones de los que están dentro, sin quien no sale en el ranking
create or replace function fbe_privado.comunidad_total_reto(p_reto uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(fbe_privado.comunidad_hechas(d.atleta_id, r.desde, r.hasta)), 0)::integer
  from public.comunidad_retos r cross join fbe_privado.comunidad_dentro d
  where r.id = p_reto and not d.sin_ranking
$$;

-- ¿Ha conseguido este reto? Individual: su objetivo; de equipo: el total del equipo. No cuenta un reto que ya
-- había acabado la última vez que entró (o volvió) en la comunidad.
create or replace function fbe_privado.comunidad_reto_conseguido(p_reto uuid, p_atleta uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.comunidad_retos r
    join public.comunidad_miembros m on m.atleta_id = p_atleta
    where r.id = p_reto and r.hasta >= (m.entrado_en at time zone 'Europe/Madrid')::date
      and case when r.modo = 'equipo' then fbe_privado.comunidad_total_reto(r.id)
               else fbe_privado.comunidad_hechas(p_atleta, r.desde, r.hasta) end >= r.objetivo)
$$;

-- Cupo diario (cuenta en comunidad_cupos, que no se borra con lo publicado). El coach no tiene. Interno.
create or replace function fbe_privado.comunidad_gastar_cupo(p_tipo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_max integer := case p_tipo when 'post' then 20 when 'comentario' then 100 when 'animo' then 40 when 'voto' then 30 else 20 end;
begin
  if auth.uid() is null or public.es_coach() then return; end if;
  delete from public.comunidad_cupos c where c.perfil_id = auth.uid() and c.creado_en < now() - interval '2 days';
  if (select count(*) from public.comunidad_cupos c where c.perfil_id = auth.uid() and c.tipo = p_tipo and c.creado_en > now() - interval '1 day') >= v_max then
    raise exception '%', case p_tipo when 'post' then 'Has publicado 20 veces en las últimas 24 horas: espera un poco'
                                     when 'comentario' then 'Has escrito 100 comentarios en las últimas 24 horas: espera un poco'
                                     when 'animo' then 'Has mandado 40 ánimos en las últimas 24 horas: mañana, más'
                                     when 'voto' then 'Has votado 30 veces en las últimas 24 horas: mañana, más'
                                     else 'Has avisado 20 veces en las últimas 24 horas: escribe a tu coach' end using errcode = '54000';
  end if;
  insert into public.comunidad_cupos (perfil_id, tipo) values (auth.uid(), p_tipo);
end $$;

-- ---------------------------------------------------------------------
-- 4. Lo que pone la base al publicar y comentar
-- ---------------------------------------------------------------------
-- Publicar desde la app: el coach, avisos y encuestas (la encuesta, con sus opciones limpias y el cierre en el
-- futuro); un atleta, publicaciones. Los entrenos y los logros los publican las funciones de la base.
create or replace function public.comunidad_post_preparar() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_cierre timestamptz;
  v_opciones jsonb;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  new.autor_id := auth.uid();
  new.creado_en := now();
  new.oculta := false;
  new.sesion_id := null;
  new.resumen := null;
  new.reto_id := null;
  new.menciones := coalesce(new.menciones, '{}');
  if public.es_coach() then
    new.atleta_id := null;
    if new.tipo is distinct from 'aviso' and new.tipo is distinct from 'encuesta' then
      raise exception 'Como coach, en el muro publicas avisos y encuestas' using errcode = '42501';
    end if;
    if new.foto_ruta is not null and (new.tipo <> 'aviso' or new.foto_ruta not like 'coach/%') then
      raise exception 'La foto no va en su sitio' using errcode = '42501';
    end if;
    if new.tipo = 'encuesta' then
      if new.encuesta is null or jsonb_typeof(new.encuesta) <> 'object' or jsonb_typeof(new.encuesta -> 'opciones') is distinct from 'array' then
        raise exception 'Una encuesta lleva de 2 a 4 opciones' using errcode = '22023';
      end if;
      begin
        v_cierre := nullif(btrim(coalesce(new.encuesta ->> 'cierre', '')), '')::timestamptz;
      exception when others then
        raise exception 'El cierre de la encuesta no es una fecha válida' using errcode = '22023';
      end;
      if v_cierre is not null and v_cierre <= now() + interval '5 minutes' then
        raise exception 'El cierre de la encuesta, más adelante (o sin cierre)' using errcode = '22023';
      end if;
      select jsonb_agg(to_jsonb(btrim(e.o #>> '{}')) order by e.n) into v_opciones
      from jsonb_array_elements(new.encuesta -> 'opciones') with ordinality as e(o, n);
      new.encuesta := jsonb_build_object('opciones', coalesce(v_opciones, '[]'::jsonb), 'cierre', to_jsonb(v_cierre));
    else
      new.encuesta := null;
    end if;
  else
    new.atleta_id := public.mi_atleta_id();
    new.fijada := false;
    new.encuesta := null;
    if new.tipo is distinct from 'post' then
      raise exception 'Los avisos y las encuestas son del coach, y los entrenos y los logros se comparten desde su sitio' using errcode = '42501';
    end if;
    if new.foto_ruta is not null and (new.atleta_id is null or new.foto_ruta not like new.atleta_id::text || '/%') then
      raise exception 'La foto no va en su sitio' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- Las menciones: solo quien está dentro (o el coach), nunca el autor, sin repetir y como mucho 5 (en su orden).
-- También en lo que publican las funciones de la base.
create or replace function fbe_privado.comunidad_menciones_limpiar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.menciones := coalesce((
    select array_agg(m.x order by m.o)
    from (select u.x, min(u.o) as o
          from unnest(coalesce(new.menciones, '{}'::uuid[])) with ordinality as u(x, o)
          where u.x is not null and u.x is distinct from new.autor_id
            and (exists (select 1 from public.perfiles p where p.id = u.x and p.rol = 'coach')
                 or exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = u.x))
          group by u.x order by min(u.o) limit 5) m), '{}'::uuid[]);
  return new;
end $$;
drop trigger if exists comunidad_posts_ac_menciones on public.comunidad_posts;
create trigger comunidad_posts_ac_menciones before insert on public.comunidad_posts
  for each row execute function fbe_privado.comunidad_menciones_limpiar();
drop trigger if exists comunidad_comentarios_ac_menciones on public.comunidad_comentarios;
create trigger comunidad_comentarios_ac_menciones before insert on public.comunidad_comentarios
  for each row execute function fbe_privado.comunidad_menciones_limpiar();

-- ---------------------------------------------------------------------
-- 4 bis. Lo que cuenta: fechas de las sesiones, entradas y el ranking y el progreso de la 027
-- ---------------------------------------------------------------------
-- El atleta solo cambia lo suyo de una sesión (013) y, desde la 029, no la fecha después de mañana (Madrid): una
-- sesión hecha «en 2099» no cuenta en nada, pero así ni se intenta. Las fechas pasadas siguen valiendo (una sesión
-- de otra semana que se hace más tarde, o más pronto). El coach y el SQL Editor, sin límite.
create or replace function public.proteger_sesion() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    if (new.id, new.semana_id, new.orden, new.nombre, new.tipo, new.intencion, new.dinamica, new.cardio)
       is distinct from
       (old.id, old.semana_id, old.orden, old.nombre, old.tipo, old.intencion, old.dinamica, old.cardio) then
      raise exception 'Solo el coach puede cambiar la prescripción de la sesión' using errcode = '42501';
    end if;
    if new.fecha_realizada is distinct from old.fecha_realizada
       and new.fecha_realizada > (now() at time zone 'Europe/Madrid')::date + 1 then
      raise exception 'La fecha de la sesión no puede ser posterior a hoy: elige el día en que la hiciste' using errcode = '22023';
    end if;
    if (to_jsonb(new) - 'dia_previsto' - 'revisada_en') is distinct from (to_jsonb(old) - 'dia_previsto' - 'revisada_en') then
      new.revisada_en := null;
    else
      new.revisada_en := old.revisada_en;
    end if;
  end if;
  return new;
end $$;

-- Entrar (028) apunta además cuándo entró (o volvió, tras salir o ser readmitido) en entrado_en; aceptar el texto o
-- las normas nuevas estando dentro no lo cambia
create or replace function public.comunidad_unirme(p_nombre text, p_version text, p_normas text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  a public.atletas;
  v_nombre text := btrim(regexp_replace(coalesce(p_nombre, ''), '[[:space:][:cntrl:]]+', ' ', 'g'));
  v_problema text;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión' using errcode = '42501'; end if;
  if exists (select 1 from public.perfiles p where p.id = v_uid and p.rol = 'coach') then
    raise exception 'El coach está en la comunidad como coach, no como miembro' using errcode = '42501';
  end if;
  select * into a from public.atletas x where x.perfil_id = v_uid;
  if not found then raise exception 'Solo los atletas del equipo pueden entrar' using errcode = '42501'; end if;
  if a.estado = 'baja' then
    raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada' using errcode = '42501';
  end if;
  if not public.comunidad_activa() then raise exception 'La comunidad no está abierta' using errcode = '42501'; end if;
  if exists (select 1 from public.comunidad_miembros m where m.atleta_id = a.id and m.bloqueado) then
    raise exception 'Tu coach te ha sacado de la comunidad: habla con él si quieres volver' using errcode = '42501';
  end if;
  if p_version is distinct from public.comunidad_version() then
    raise exception 'El texto que aceptas no es el vigente: recarga la app y vuelve a intentarlo' using errcode = '22023';
  end if;
  if p_normas is distinct from public.comunidad_normas_version() then
    raise exception 'Antes de entrar, lee las normas del equipo vigentes: recarga la app y vuelve a intentarlo' using errcode = '22023';
  end if;
  v_problema := fbe_privado.comunidad_problema_nombre(v_nombre, a.id);
  if v_problema is not null then raise exception '%', v_problema using errcode = '22023'; end if;
  insert into public.comunidad_miembros as m (atleta_id, perfil_id, nombre, version, aceptado_en, salido_en, nombre_cambiado_en, normas_version, normas_leidas_en, entrado_en)
  values (a.id, v_uid, v_nombre, p_version, now(), null, null, p_normas, now(), now())
  on conflict (atleta_id) do update
    set perfil_id = excluded.perfil_id, nombre = excluded.nombre, version = excluded.version,
        aceptado_en = now(), salido_en = null, nombre_cambiado_en = null,
        normas_version = excluded.normas_version, normas_leidas_en = now(),
        entrado_en = case when m.salido_en is not null then now() else m.entrado_en end;
end $$;

-- El progreso de los retos (027), con las sesiones que cuentan (misma forma que en la 027)
create or replace function public.comunidad_retos_progreso()
returns table (reto_id uuid, perfil_id uuid, nombre text, hechas integer, objetivo integer, yo boolean)
language sql stable security definer set search_path = '' as $$
  select r.id, d.perfil_id, d.nombre, fbe_privado.comunidad_hechas(d.atleta_id, r.desde, r.hasta), r.objetivo::integer, d.perfil_id = auth.uid()
  from public.comunidad_retos r
  cross join fbe_privado.comunidad_dentro d
  where (public.es_coach() or public.comunidad_soy_miembro())
    and (not d.sin_ranking or d.perfil_id = auth.uid())
$$;

-- El ranking de la semana (027), con las sesiones que cuentan (misma forma que en la 027)
create or replace function public.comunidad_ranking()
returns table (perfil_id uuid, nombre text, hechas integer, previstas integer, yo boolean)
language sql stable security definer set search_path = '' as $$
  with dentro as (
    select d.atleta_id, d.perfil_id, d.nombre
    from fbe_privado.comunidad_dentro d
    where (public.es_coach() or public.comunidad_soy_miembro())
      and (not d.sin_ranking or d.perfil_id = auth.uid())
  ), semana as (
    -- Una semana por atleta: si dos bloques publican la misma, la del más reciente
    select distinct on (d.atleta_id) d.atleta_id, w.id as semana_id
    from dentro d
    join public.bloques b on b.atleta_id = d.atleta_id and not b.es_plantilla and b.estado <> 'cancelado'
    join public.semanas w on w.bloque_id = b.id and w.programacion = 'programada' and w.fecha_inicio = fbe_privado.comunidad_lunes()
    order by d.atleta_id, b.fecha_inicio desc nulls last, b.numero desc nulls last
  ), validas as (
    select v.semana_id from fbe_privado.comunidad_sesiones_validas(array(select d.atleta_id from dentro d)) v
  )
  select d.perfil_id, d.nombre,
    (select count(*)::integer from validas v where v.semana_id = x.semana_id),
    (select count(*)::integer from public.sesiones s where s.semana_id = x.semana_id),
    d.perfil_id = auth.uid()
  from dentro d join semana x on x.atleta_id = d.atleta_id
  where exists (select 1 from public.sesiones s where s.semana_id = x.semana_id)
$$;

-- ---------------------------------------------------------------------
-- 5. Quién ve qué en las tablas nuevas (lo de los demás, solo dentro; el coach, todo)
-- ---------------------------------------------------------------------
alter table public.comunidad_votos enable row level security;
alter table public.comunidad_animos enable row level security;

-- Votos: se ven dentro (para los resultados y «quién ha votado»), como las reacciones; se votan con comunidad_votar()
drop policy if exists coach_ver on public.comunidad_votos;
create policy coach_ver on public.comunidad_votos for select to authenticated using (public.es_coach());
drop policy if exists miembro_ver on public.comunidad_votos;
create policy miembro_ver on public.comunidad_votos for select to authenticated
  using (public.comunidad_soy_miembro() and public.comunidad_autor_visible(autor_id) and public.comunidad_post_visible(post_id));

-- Ánimos: cada uno ve los que ha mandado y los que ha recibido (de quien sigue dentro); se mandan con
-- comunidad_animar()
drop policy if exists coach_ver on public.comunidad_animos;
create policy coach_ver on public.comunidad_animos for select to authenticated using (public.es_coach());
drop policy if exists miembro_ver on public.comunidad_animos;
create policy miembro_ver on public.comunidad_animos for select to authenticated
  using (public.comunidad_soy_miembro() and (
    (para = auth.uid() and public.comunidad_autor_visible(de)) or (de = auth.uid() and public.comunidad_autor_visible(para))));

-- Desde la 019, cada tabla nueva lleva sus permisos a mano: solo lectura (se escriben con sus funciones)
revoke all on public.comunidad_votos, public.comunidad_animos from public, anon, authenticated;
grant select on public.comunidad_votos, public.comunidad_animos to authenticated;

-- ---------------------------------------------------------------------
-- 6. Lo que usa la app
-- ---------------------------------------------------------------------
-- Resumen de la semana del equipo (lunes a domingo, en Madrid): solo recuentos, sin quien no sale en el ranking.
-- Récords: los ejercicios con récord de los entrenos compartidos esta semana.
create or replace function public.comunidad_resumen_semana()
returns table (sesiones integer, semana_completa integer, miembros integer, records integer, retos integer)
language sql stable security definer set search_path = '' as $$
  with lunes as (
    select fbe_privado.comunidad_lunes() as d
  ), cuentan as (
    select d.atleta_id, d.perfil_id from fbe_privado.comunidad_dentro d
    where not d.sin_ranking and (public.es_coach() or public.comunidad_soy_miembro())
  )
  select
    (select count(*)::integer from fbe_privado.comunidad_sesiones_validas(array(select c.atleta_id from cuentan c)) v
     where v.fecha between (select l.d from lunes l) and (select l.d from lunes l) + 6),
    (select count(*)::integer from fbe_privado.comunidad_semanas_de(array(select c.atleta_id from cuentan c)) x
     where x.lunes = (select l.d from lunes l) and x.hechas >= x.previstas),
    (select count(*)::integer from cuentan),
    (select count(*)::integer from public.comunidad_posts p
       cross join lateral jsonb_array_elements(case when jsonb_typeof(p.resumen -> 'ejercicios') = 'array' then p.resumen -> 'ejercicios' else '[]'::jsonb end) as e(v)
     where p.tipo = 'entreno' and not p.oculta and p.autor_id in (select c.perfil_id from cuentan c)
       and (p.creado_en at time zone 'Europe/Madrid')::date between (select l.d from lunes l) and (select l.d from lunes l) + 6
       and coalesce((e.v ->> 'record')::boolean, false)),
    (select count(*)::integer from public.comunidad_retos r where (now() at time zone 'Europe/Madrid')::date between r.desde and r.hasta)
  where public.es_coach() or public.comunidad_soy_miembro()
$$;

-- Rachas de semanas completas, solo las de 1 o más (así, que alguien no salga no dice si no tiene racha o si no
-- sale en el ranking). Quien no sale en el ranking solo se ve a sí mismo (el coach ve a todos).
create or replace function public.comunidad_rachas()
returns table (perfil_id uuid, nombre text, racha integer, semana_completa boolean, yo boolean)
language sql stable security definer set search_path = '' as $$
  with dentro as (
    select d.atleta_id, d.perfil_id, d.nombre from fbe_privado.comunidad_dentro d
    where (public.es_coach() or public.comunidad_soy_miembro())
      and (public.es_coach() or not d.sin_ranking or d.perfil_id = auth.uid())
  )
  select d.perfil_id, d.nombre, r.racha, r.semana_completa, d.perfil_id = auth.uid()
  from dentro d
  join fbe_privado.comunidad_rachas_de(array(select x.atleta_id from dentro x)) r on r.atleta_id = d.atleta_id
  where r.racha >= 1
$$;

-- El perfil de alguien del equipo: nombre, foto, desde cuándo está, racha, retos conseguidos (cuántos y cuáles) y
-- entrenos compartidos. Solo de quien se ve (el coach o alguien de dentro) y para quien ve la comunidad. De quien
-- no sale en el ranking, sin racha ni retos (salvo para él mismo y el coach); y, para que eso no se pueda deducir,
-- sin racha ni retos conseguidos sale igual: null (nunca 0 ni una lista vacía).
create or replace function public.comunidad_perfil(p_perfil uuid)
returns table (perfil_id uuid, nombre text, foto text, coach boolean, desde timestamptz, racha integer, retos integer,
               retos_titulos text[], entrenos integer, yo boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_atleta uuid;
  v_nombre text;
  v_sin boolean;
  v_desde timestamptz;
  v_ver boolean;
begin
  if auth.uid() is null or not (public.es_coach() or public.comunidad_soy_miembro()) then return; end if;
  if exists (select 1 from public.perfiles p where p.id = p_perfil and p.rol = 'coach') then
    return query select p.id, coalesce(nullif(btrim(p.nombre), ''), 'Coach'), p.foto, true, null::timestamptz, null::integer, null::integer,
                        null::text[], 0, p.id = auth.uid()
                 from public.perfiles p where p.id = p_perfil;
    return;
  end if;
  select x.atleta_id, x.nombre, x.sin_ranking, m.creado_en into v_atleta, v_nombre, v_sin, v_desde
  from fbe_privado.comunidad_dentro x join public.comunidad_miembros m on m.atleta_id = x.atleta_id
  where x.perfil_id = p_perfil;
  if v_atleta is null then return; end if;
  v_ver := public.es_coach() or not v_sin or p_perfil = auth.uid();
  return query select p_perfil, v_nombre, (select p.foto from public.perfiles p where p.id = p_perfil), false, v_desde,
    case when v_ver then (select nullif(r.racha, 0) from fbe_privado.comunidad_rachas_de(array[v_atleta]) r) end,
    case when v_ver then (select nullif(count(*)::integer, 0) from public.comunidad_retos r where fbe_privado.comunidad_reto_conseguido(r.id, v_atleta)) end,
    case when v_ver then (select array_agg(t.titulo order by t.hasta desc, t.titulo)
                          from (select r.titulo, r.hasta from public.comunidad_retos r where fbe_privado.comunidad_reto_conseguido(r.id, v_atleta)
                                order by r.hasta desc, r.titulo limit 20) t) end,
    (select count(*)::integer from public.comunidad_posts x where x.autor_id = p_perfil and x.tipo = 'entreno' and (public.es_coach() or not x.oculta)),
    p_perfil = auth.uid();
end $$;

-- Los retos de equipo (y cualquier reto): su modo y el total del equipo, las sesiones terminadas entre sus fechas de
-- los que están dentro, sin quien no sale en el ranking (solo recuentos). El progreso de cada uno sigue en
-- comunidad_retos_progreso() (027), que no cambia.
create or replace function public.comunidad_retos_totales()
returns table (reto_id uuid, modo text, total integer)
language sql stable security definer set search_path = '' as $$
  select r.id, r.modo, fbe_privado.comunidad_total_reto(r.id)
  from public.comunidad_retos r
  where public.es_coach() or public.comunidad_soy_miembro()
$$;

-- Compartir un logro: la base comprueba que el reto está conseguido y hace la tarjeta (título, modo, objetivo,
-- sesiones —las suyas o, en uno de equipo, las de todos— y fechas). Una vez por reto y persona.
create or replace function public.comunidad_compartir_logro(p_reto uuid, p_texto text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_atleta uuid;
  r public.comunidad_retos;
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
  v_hechas integer;
  v_id uuid;
begin
  if v_uid is null or not public.comunidad_soy_miembro() then
    raise exception 'Para compartir en el equipo tienes que estar en la comunidad' using errcode = '42501';
  end if;
  v_atleta := public.mi_atleta_id();
  select * into r from public.comunidad_retos x where x.id = p_reto;
  if not found then raise exception 'Ese reto ya no está' using errcode = '22023'; end if;
  if not fbe_privado.comunidad_reto_conseguido(r.id, v_atleta) then
    raise exception 'Ese reto aún no está conseguido' using errcode = '22023';
  end if;
  if exists (select 1 from public.comunidad_posts x where x.autor_id = v_uid and x.reto_id = r.id and x.tipo = 'logro') then
    raise exception 'Este logro ya está compartido en el equipo' using errcode = '23505';
  end if;
  v_hechas := case when r.modo = 'equipo' then fbe_privado.comunidad_total_reto(r.id) else fbe_privado.comunidad_hechas(v_atleta, r.desde, r.hasta) end;
  insert into public.comunidad_posts (autor_id, atleta_id, tipo, texto, reto_id, resumen)
  values (v_uid, v_atleta, 'logro', v_texto, r.id, jsonb_build_object(
    'titulo', r.titulo, 'modo', r.modo, 'objetivo', r.objetivo, 'hechas', v_hechas, 'desde', r.desde, 'hasta', r.hasta))
  returning id into v_id;
  return v_id;
end $$;

-- Votar en una encuesta (que se ve): solo quien está dentro, una de sus opciones y antes del cierre. Votar otra
-- vez cambia el voto (30 veces al día como mucho). Devuelve la opción.
create or replace function public.comunidad_votar(p_post uuid, p_opcion integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  x public.comunidad_posts;
  v_cierre timestamptz;
begin
  if auth.uid() is null or not public.comunidad_soy_miembro() then
    raise exception 'Para votar tienes que estar en la comunidad' using errcode = '42501';
  end if;
  select * into x from public.comunidad_posts k where k.id = p_post and k.tipo = 'encuesta' and public.comunidad_post_visible(k.id);
  if not found then raise exception 'Esa encuesta ya no está' using errcode = '42501'; end if;
  if p_opcion is null or p_opcion < 0 or p_opcion >= jsonb_array_length(x.encuesta -> 'opciones') then
    raise exception 'Esa opción no existe' using errcode = '22023';
  end if;
  v_cierre := (x.encuesta ->> 'cierre')::timestamptz;
  if v_cierre is not null and now() >= v_cierre then raise exception 'La encuesta ya está cerrada' using errcode = '22023'; end if;
  -- Votar lo mismo otra vez no cambia nada (ni gasta cupo); votar o cambiar el voto, como mucho 30 veces al día
  if exists (select 1 from public.comunidad_votos v where v.post_id = p_post and v.autor_id = auth.uid() and v.opcion = p_opcion) then
    return p_opcion;
  end if;
  perform fbe_privado.comunidad_gastar_cupo('voto');
  insert into public.comunidad_votos (post_id, autor_id, atleta_id, opcion)
  values (p_post, auth.uid(), public.mi_atleta_id(), p_opcion)
  on conflict (post_id, autor_id) do update set opcion = excluded.opcion, creado_en = now();
  return p_opcion;
end $$;

-- Mandar ánimo a alguien de dentro (no a uno mismo; uno por persona y semana; como mucho 40 al día). También el
-- coach, con la comunidad abierta. Le llega una notificación sin más texto. Devuelve la semana (su lunes).
create or replace function public.comunidad_animar(p_perfil uuid) returns date
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_semana date := fbe_privado.comunidad_lunes();
  v_para_atleta uuid;
begin
  if v_uid is null or not public.comunidad_activa() or not (public.es_coach() or public.comunidad_soy_miembro()) then
    raise exception 'Para animar tienes que estar en la comunidad (y abierta)' using errcode = '42501';
  end if;
  if p_perfil is null or p_perfil = v_uid then raise exception 'A ti no te puedes mandar ánimo (¡pero vas bien!)' using errcode = '22023'; end if;
  select d.atleta_id into v_para_atleta from fbe_privado.comunidad_dentro d where d.perfil_id = p_perfil;
  if v_para_atleta is null then raise exception 'Esa persona ya no está en el equipo' using errcode = '42501'; end if;
  if exists (select 1 from public.comunidad_animos a where a.de = v_uid and a.para = p_perfil and a.semana = v_semana) then
    raise exception 'Ya le has mandado ánimo esta semana' using errcode = '23505';
  end if;
  perform fbe_privado.comunidad_gastar_cupo('animo');
  insert into public.comunidad_animos (de, para, atleta_id, para_atleta_id, semana)
  values (v_uid, p_perfil, case when public.es_coach() then null else public.mi_atleta_id() end, v_para_atleta, v_semana);
  perform fbe_privado.notificar_seguro(p_perfil, 'comunidad', fbe_privado.comunidad_nombre(v_uid) || ' te ha mandado ánimo 🙌',
    'Míralo en Equipo.', '#equipo', 'comunidad_animo:' || v_uid || ':' || v_semana);
  return v_semana;
end $$;

-- «Avisar al coach» (027), también de un logro o de una encuesta (con su copia)
create or replace function public.comunidad_avisar_coach(p_post uuid default null, p_comentario uuid default null, p_motivo text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  x public.comunidad_posts;
  c public.comunidad_comentarios;
  v_id uuid;
begin
  if v_uid is null or not public.comunidad_soy_miembro() then
    raise exception 'Para avisar al coach tienes que estar en la comunidad' using errcode = '42501';
  end if;
  if p_comentario is not null then
    select * into c from public.comunidad_comentarios k
    where k.id = p_comentario and not k.oculto and public.comunidad_autor_visible(k.autor_id) and public.comunidad_post_visible(k.post_id);
    if not found then raise exception 'Ese comentario ya no está' using errcode = '42501'; end if;
    select * into x from public.comunidad_posts k where k.id = c.post_id;
  else
    select * into x from public.comunidad_posts k where k.id = p_post and public.comunidad_post_visible(k.id);
    if not found then raise exception 'Esa publicación ya no está' using errcode = '42501'; end if;
  end if;
  if v_motivo is not null and char_length(v_motivo) > 300 then raise exception 'El motivo, hasta 300 letras' using errcode = '22023'; end if;
  select r.id into v_id from public.comunidad_reportes r
  where r.autor_id = v_uid and r.post_id = x.id and r.comentario_id is not distinct from p_comentario and r.resuelto_en is null;
  if v_id is not null then return v_id; end if;
  perform fbe_privado.comunidad_gastar_cupo('reporte');
  insert into public.comunidad_reportes (post_id, comentario_id, autor_id, motivo, de_comentario, copia_tipo, copia_texto, copia_foto,
                                         copia_autor_id, copia_autor_nombre, copia_atleta_id, copia_creado_en)
  values (x.id, p_comentario, v_uid, v_motivo, p_comentario is not null,
          case when p_comentario is not null then 'comentario' else x.tipo end,
          left(case when p_comentario is not null then c.texto
                    when x.tipo = 'entreno' then concat_ws(': ', 'Entreno compartido', x.resumen ->> 'nombre', x.texto)
                    when x.tipo = 'logro' then concat_ws(': ', 'Logro', x.resumen ->> 'titulo', x.texto)
                    else x.texto end, 2000),
          case when p_comentario is null then x.foto_ruta end,
          case when p_comentario is not null then c.autor_id else x.autor_id end,
          left(fbe_privado.comunidad_nombre(case when p_comentario is not null then c.autor_id else x.autor_id end), 80),
          case when p_comentario is not null then c.atleta_id else x.atleta_id end,
          case when p_comentario is not null then c.creado_en else x.creado_en end)
  returning id into v_id;
  perform fbe_privado.notificar_seguro(p.id, 'comunidad', 'Aviso en la comunidad',
            case when p_comentario is null then 'Alguien te avisa de una publicación. Míralo en Revisar.' else 'Alguien te avisa de un comentario. Míralo en Revisar.' end,
            '#revisar', 'comunidad_reporte:' || v_id)
  from public.perfiles p where p.rol = 'coach';
  return v_id;
end $$;

-- Salir (027): con p_borrar, también se borran sus votos y sus ánimos, los mandados y los recibidos (como sus
-- reacciones). Sin borrar, dejan de verse (como todo lo suyo) y vuelven si entra otra vez.
create or replace function public.comunidad_salir(p_borrar boolean default false) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_fotos text[] := '{}';
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión' using errcode = '42501'; end if;
  update public.comunidad_miembros set salido_en = now() where perfil_id = v_uid and salido_en is null;
  if coalesce(p_borrar, false) and not exists (select 1 from public.perfiles p where p.id = v_uid and p.rol = 'coach') then
    select coalesce(array_agg(x.foto_ruta) filter (where x.foto_ruta is not null), '{}') into v_fotos
    from public.comunidad_posts x where x.autor_id = v_uid
      and not exists (select 1 from public.comunidad_reportes r where r.copia_foto = x.foto_ruta and r.resuelto_en is null);
    delete from public.comunidad_reacciones where autor_id = v_uid;
    delete from public.comunidad_votos where autor_id = v_uid;
    delete from public.comunidad_animos where de = v_uid or para = v_uid;
    delete from public.comunidad_comentarios where autor_id = v_uid;
    delete from public.comunidad_posts where autor_id = v_uid;
  end if;
  return v_fotos;
end $$;

-- Todo lo suyo en la comunidad (027), también sus votos y sus ánimos (los mandados, a quién si sigue dentro —si no,
-- «Alguien del equipo»—; los recibidos, solo cuándo), para «Descargar mis datos». De sus menciones, cuántas (no a
-- quién: son identificadores de otras personas; su texto ya dice a quién nombró).
create or replace function public.comunidad_mis_datos() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'miembro', (select to_jsonb(m) - 'perfil_id' from public.comunidad_miembros m where m.perfil_id = auth.uid()),
    'publicaciones', coalesce((select jsonb_agg((to_jsonb(x) - 'menciones') || jsonb_build_object('menciones', cardinality(x.menciones)) order by x.creado_en)
                               from public.comunidad_posts x where x.autor_id = auth.uid()), '[]'::jsonb),
    'comentarios', coalesce((select jsonb_agg((to_jsonb(c) - 'menciones') || jsonb_build_object('menciones', cardinality(c.menciones)) order by c.creado_en)
                             from public.comunidad_comentarios c where c.autor_id = auth.uid()), '[]'::jsonb),
    'reacciones', coalesce((select jsonb_agg(to_jsonb(r) order by r.creado_en) from public.comunidad_reacciones r where r.autor_id = auth.uid()), '[]'::jsonb),
    'votos', coalesce((select jsonb_agg(to_jsonb(v) order by v.creado_en) from public.comunidad_votos v where v.autor_id = auth.uid()), '[]'::jsonb),
    'animos_mandados', coalesce((select jsonb_agg(
                                   case when exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = a.para)
                                        then jsonb_build_object('para', a.para, 'para_nombre', fbe_privado.comunidad_nombre(a.para), 'semana', a.semana, 'creado_en', a.creado_en)
                                        else jsonb_build_object('para_nombre', 'Alguien del equipo', 'semana', a.semana, 'creado_en', a.creado_en) end
                                   order by a.creado_en)
                                 from public.comunidad_animos a where a.de = auth.uid()), '[]'::jsonb),
    'animos_recibidos', coalesce((select jsonb_agg(jsonb_build_object('semana', a.semana, 'creado_en', a.creado_en) order by a.creado_en)
                                  from public.comunidad_animos a where a.para = auth.uid()), '[]'::jsonb),
    'avisos_al_coach', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'post_id', r.post_id, 'comentario_id', r.comentario_id, 'motivo', r.motivo,
                                   'creado_en', r.creado_en, 'resuelto_en', r.resuelto_en) order by r.creado_en)
                                 from public.comunidad_reportes r where r.autor_id = auth.uid()), '[]'::jsonb)
  ) end
$$;

-- ---------------------------------------------------------------------
-- 7. Notificaciones «comunidad» (como en la 027: sin el texto, con sus preferencias y su «no molestar»)
-- ---------------------------------------------------------------------
-- A quien mencionan (si sigue dentro, o es el coach), solo si la publicación se ve (no está oculta y su autor es el
-- coach o sigue dentro). Una por autor y destinatario y hora, sea cual sea la publicación; y cada autor, como mucho
-- 20 al día (comunidad_cupos; el coach no tiene): las de más siguen en el texto, pero no avisan. La clave lleva lo
-- que la causa (la publicación o el comentario, sin guiones para que quepa) para retirarla si se borra o se oculta:
-- comunidad_mencion:<publicación o comentario>:<autor>:<hora>.
create or replace function fbe_privado.comunidad_al_mencionar() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  v_post uuid;
  v_autor_post uuid;
  v_objeto text;
  v_autor text := replace(new.autor_id::text, '-', '');
  v_hora text := to_char(now() at time zone 'Europe/Madrid', 'YYYYMMDDHH24');
  v_coach boolean;
  v_quien text;
  v_para uuid;
begin
  if cardinality(new.menciones) = 0 or not public.comunidad_activa() then return null; end if;
  if tg_table_name = 'comunidad_comentarios' then
    v_post := (to_jsonb(new) ->> 'post_id')::uuid;
    if coalesce((to_jsonb(new) ->> 'oculto')::boolean, false) then return null; end if;
  else
    v_post := new.id;
  end if;
  v_objeto := replace(new.id::text, '-', '');
  select x.autor_id into v_autor_post from public.comunidad_posts x where x.id = v_post and not x.oculta;
  if v_autor_post is null then return null; end if;
  if not exists (select 1 from public.perfiles p where p.id = v_autor_post and p.rol = 'coach')
     and not exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = v_autor_post) then
    return null;
  end if;
  v_coach := exists (select 1 from public.perfiles p where p.id = new.autor_id and p.rol = 'coach');
  v_quien := fbe_privado.comunidad_nombre(new.autor_id);
  foreach v_para in array new.menciones loop
    continue when v_para = new.autor_id;
    continue when not (exists (select 1 from public.perfiles p where p.id = v_para and p.rol = 'coach')
                       or exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = v_para));
    perform pg_advisory_xact_lock(hashtextextended('comunidad_mencion:' || new.autor_id || ':' || v_para, 0));
    continue when exists (select 1 from public.notificaciones n
                          where n.usuario_id = v_para and n.clave like 'comunidad_mencion:%:' || v_autor || ':' || v_hora);
    if not v_coach and (select count(*) from public.comunidad_cupos c
                        where c.perfil_id = new.autor_id and c.tipo = 'mencion' and c.creado_en > now() - interval '1 day') >= 20 then
      exit;
    end if;
    if fbe_privado.notificar_seguro(v_para, 'comunidad', v_quien || ' te ha mencionado', 'Míralo en Equipo.', '#equipo',
         'comunidad_mencion:' || v_objeto || ':' || v_autor || ':' || v_hora) and not v_coach then
      insert into public.comunidad_cupos (perfil_id, tipo) values (new.autor_id, 'mencion');
    end if;
  end loop;
  return null;
exception when others then
  raise warning 'FBE: notificación de una mención no creada: %', sqlerrm;
  return null;
end $$;
drop trigger if exists comunidad_posts_zz_mencionar on public.comunidad_posts;
create trigger comunidad_posts_zz_mencionar after insert on public.comunidad_posts
  for each row execute function fbe_privado.comunidad_al_mencionar();
drop trigger if exists comunidad_comentarios_zz_mencionar on public.comunidad_comentarios;
create trigger comunidad_comentarios_zz_mencionar after insert on public.comunidad_comentarios
  for each row execute function fbe_privado.comunidad_al_mencionar();

-- Un comentario borrado u oculto antes de que salgan sus menciones ya no avisa
create or replace function fbe_privado.comunidad_comentario_retirar() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
begin
  if tg_op = 'UPDATE' and not (new.oculto and not old.oculto) then return null; end if;
  delete from public.notificaciones n
  where n.estado = 'pendiente' and n.clave like 'comunidad_mencion:' || replace(old.id::text, '-', '') || ':%';
  return null;
exception when others then
  raise warning 'FBE: menciones del comentario % no retiradas: %', old.id, sqlerrm;
  return null;
end $$;
drop trigger if exists comunidad_comentarios_zz_retirar on public.comunidad_comentarios;
create trigger comunidad_comentarios_zz_retirar after delete or update of oculto on public.comunidad_comentarios
  for each row execute function fbe_privado.comunidad_comentario_retirar();

-- Aviso o encuesta del coach en el muro → a todos los que están dentro (027)
create or replace function fbe_privado.comunidad_al_avisar() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
begin
  if new.tipo not in ('aviso', 'encuesta') or new.oculta or not public.comunidad_activa() then return null; end if;
  perform fbe_privado.notificar_seguro(d.perfil_id, 'comunidad',
            coalesce(fbe_privado.nombre_corto((select p.nombre from public.perfiles p where p.id = new.autor_id)), 'Tu coach')
              || case when new.tipo = 'encuesta' then ' ha publicado una encuesta en el equipo' else ' ha publicado un aviso en el equipo' end,
            case when new.tipo = 'encuesta' then 'Tócalo para votar en Equipo.' else 'Tócalo para leerlo en Equipo.' end,
            '#equipo', 'comunidad_aviso:' || new.id)
  from fbe_privado.comunidad_dentro d
  where d.perfil_id <> new.autor_id;
  return null;
exception when others then
  raise warning 'FBE: notificación del aviso % no creada: %', new.id, sqlerrm;
  return null;
end $$;

-- Una publicación borrada u oculta antes de que salgan sus notificaciones (también las de sus menciones y las de
-- los comentarios que tiene) ya no avisa
create or replace function fbe_privado.comunidad_al_retirar() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
begin
  if tg_op = 'UPDATE' and not (new.oculta and not old.oculta) then return null; end if;
  delete from public.notificaciones n
  where n.estado = 'pendiente' and (n.clave like 'comunidad:' || old.id || ':%' or n.clave = 'comunidad_aviso:' || old.id
                                    or n.clave like 'comunidad_mencion:' || replace(old.id::text, '-', '') || ':%'
                                    or (n.clave like 'comunidad_mencion:%' and exists (
                                          select 1 from public.comunidad_comentarios c
                                          where c.post_id = old.id and n.clave like 'comunidad_mencion:' || replace(c.id::text, '-', '') || ':%')));
  return null;
exception when others then
  raise warning 'FBE: notificaciones de la publicación % no retiradas: %', old.id, sqlerrm;
  return null;
end $$;

-- Quien deja de estar dentro no recibe las del equipo que tuviera pendientes (027), y a los demás ya no les llegan
-- sus menciones ni sus ánimos pendientes
create or replace function fbe_privado.comunidad_retirar_suyas(p_perfil uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.notificaciones n
  where n.tipo = 'comunidad' and n.url = '#equipo' and n.estado = 'pendiente'
    and (n.clave like 'comunidad_animo:' || p_perfil || ':%' or n.clave like 'comunidad_mencion:%:' || replace(p_perfil::text, '-', '') || ':%');
$$;
create or replace function fbe_privado.comunidad_al_dejar() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
begin
  if tg_table_name = 'comunidad_miembros' then
    if (new.salido_en is not null and old.salido_en is null) or (new.bloqueado and not old.bloqueado) or new.version is distinct from public.comunidad_version() then
      perform fbe_privado.comunidad_retirar_pendientes(new.perfil_id);
      perform fbe_privado.comunidad_retirar_suyas(new.perfil_id);
    end if;
  elsif tg_table_name = 'atletas' then
    if old.perfil_id is not null and ((new.estado = 'baja' and old.estado <> 'baja') or new.perfil_id is distinct from old.perfil_id) then
      perform fbe_privado.comunidad_retirar_pendientes(old.perfil_id);
      perform fbe_privado.comunidad_retirar_suyas(old.perfil_id);
    end if;
  elsif tg_table_name = 'comunidad_ajustes' then
    if old.activa and not new.activa then perform fbe_privado.comunidad_retirar_pendientes(null); end if;
  end if;
  return null;
exception when others then
  raise warning 'FBE: notificaciones del equipo no retiradas: %', sqlerrm;
  return null;
end $$;

-- Con el texto nuevo, nadie está dentro hasta volver a aceptarlo: las notificaciones del equipo que tuvieran
-- pendientes no salen (como en la 028)
delete from public.notificaciones n
where n.tipo = 'comunidad' and n.url = '#equipo' and n.estado = 'pendiente'
  and not exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = n.usuario_id)
  and not exists (select 1 from public.perfiles p where p.id = n.usuario_id and p.rol = 'coach');

-- Permisos (como al final de 003 a 028)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (29)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
