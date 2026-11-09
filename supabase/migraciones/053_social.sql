-- =====================================================================
-- FBE Equipo, migración 053: la parte social del equipo, tanda «social» (15 mejoras)
--
-- Por qué: la comunidad ya tiene muro, retos, ranking, parejas de racha, ánimos, bienvenidas, momentos y los eventos
-- del coach. Lo que faltaba es que los atletas se busquen entre ellos: coincidir en el gimnasio, retarse, acompañar a
-- quien entra, felicitarse, elegir a quien más anima… y que todo eso cuente en su perfil del equipo.
--
-- Qué hace (todo voluntario y siempre dentro de la comunidad):
--   * Cumpleaños en el equipo: el atleta lo enciende (comunidad_miembros.cumple_equipo) y el día de su cumpleaños (el que
--     puso en Perfil → Lo tuyo, 050) los del equipo lo ven (comunidad_cumples()) y le felicitan con un ánimo.
--   * Ánimo con unas palabras: comunidad_animar(perfil, texto) admite hasta 80 letras (opcional), que van en el aviso.
--   * Encuestas de los atletas: una al día, como las del coach (2 a 4 opciones, cierre opcional). Las vota todo el equipo.
--   * Quedadas propuestas por atletas: comunidad_eventos.creado_por (null = del coach). Hasta 3 abiertas por persona, con
--     hasta 30 plazas; quien la propone va; solo él (o el coach) la cambia o la cancela.
--   * Duelos 1 a 1 (comunidad_duelos): retar a un compañero a la semana (sesiones hechas de lunes a domingo). Hay que
--     aceptar; lo ven los dos y el coach; al acabar la semana, quién ha hecho más.
--   * «Hoy entreno a las…» (comunidad_intenciones): una fila por persona (hoy o mañana, con hora y nota opcionales) que
--     ven los del equipo para coincidir. Caduca sola.
--   * Apadrinar a quien entra (comunidad_padrinos): un veterano (8 semanas dentro) acompaña 30 días a alguien que lleva
--     menos de 14 en el equipo. El nuevo ve quién le acompaña; el padrino, a quién.
--   * Compañero de la semana elegido por el equipo (comunidad_votos_semana): un voto por semana (se puede cambiar) a quien
--     más ha animado o ayudado. El lunes sale el de la semana anterior si tiene al menos 2 votos. Los votos no se ven.
--   * Tu huella en el equipo (comunidad_huella): ánimos dados y recibidos, bienvenidas, comentarios, reacciones, quedadas,
--     ahijados, veces elegido y semanas seguidas animando.
--   * Insignias sociales: Animador (25 ánimos), Anfitrión (3 bienvenidas), Padrino (1) y Puntual (3 quedadas).
--   * Citar una publicación (comunidad_posts.cita_post_id): compartir en el muro la de un compañero con tu comentario.
--   * Quién necesita un ánimo (comunidad_sin_entrenar): solo quien lo enciende (ver_ausencia) sale cuando lleva 5 días o
--     más sin entrenar, para que le manden ánimo.
-- Lo mejor de la semana, el álbum y «misma sesión» no necesitan la base: salen de lo que ya hay.
-- Al salir borrando lo suyo, también se va lo de aquí; comunidad_mis_datos() lo incluye. Sin esta migración, la app no
-- enseña nada de esto y todo lo demás sigue igual.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 052 (o con instalar.sql en una
-- base nueva). Necesita la 051 (la 052, del reloj, puede ir antes o después). Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 53 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 053 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 53;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 51) then  -- (2) la migración previa que hace falta (la 052, del reloj, es aparte)
    raise exception 'Falta la migración 051 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Lo que cada uno enciende: el cumpleaños y «que me manden ánimo si paro»
-- ---------------------------------------------------------------------
alter table public.comunidad_miembros add column if not exists cumple_equipo boolean not null default false;
alter table public.comunidad_miembros add column if not exists ver_ausencia boolean not null default false;

create or replace function public.comunidad_social_ajustes(p_cumple boolean default null, p_ausencia boolean default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.comunidad_miembros;
begin
  if auth.uid() is null or not public.comunidad_soy_miembro() then raise exception 'No estás en la comunidad' using errcode = '42501'; end if;
  update public.comunidad_miembros set cumple_equipo = coalesce(p_cumple, cumple_equipo), ver_ausencia = coalesce(p_ausencia, ver_ausencia)
  where perfil_id = auth.uid() returning * into m;
  return jsonb_build_object('cumple_equipo', m.cumple_equipo, 'ver_ausencia', m.ver_ausencia);
end $$;
comment on function public.comunidad_social_ajustes(boolean, boolean) is '053: enciende o apaga «mi cumpleaños en el equipo» y «que me manden ánimo si paro».';

-- Los cumpleaños de hoy (hora de Madrid) de quien lo tiene encendido y puso su cumpleaños (050). Solo dentro.
create or replace function public.comunidad_cumples()
returns table (perfil_id uuid, nombre text, foto text, soy_yo boolean)
language sql stable security definer set search_path = '' as $$
  select d.perfil_id, d.nombre, p.foto, d.perfil_id = auth.uid()
  from fbe_privado.comunidad_dentro d
  join public.comunidad_miembros m on m.atleta_id = d.atleta_id and m.cumple_equipo
  join public.personal_atleta pa on pa.atleta_id = d.atleta_id
    and pa.cumple_mes = extract(month from fbe_privado.comunidad_hoy())::smallint
    and pa.cumple_dia = extract(day from fbe_privado.comunidad_hoy())::smallint
  join public.perfiles p on p.id = d.perfil_id
  where auth.uid() is not null and (public.es_coach() or public.comunidad_soy_miembro())
  order by d.nombre
$$;

-- ---------------------------------------------------------------------
-- 2. El ánimo, con unas palabras
-- ---------------------------------------------------------------------
alter table public.comunidad_animos add column if not exists texto text;
alter table public.comunidad_animos drop constraint if exists comunidad_animos_texto_valido;
alter table public.comunidad_animos add constraint comunidad_animos_texto_valido check (
  texto is null or (char_length(texto) between 1 and 80 and public.texto_visible(texto) and texto !~ '[[:cntrl:]]'));

drop function if exists public.comunidad_animar(uuid);
create or replace function public.comunidad_animar(p_perfil uuid, p_texto text default null) returns date
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_semana date := fbe_privado.comunidad_lunes();
  v_para_atleta uuid;
  v_texto text := nullif(btrim(regexp_replace(coalesce(p_texto, ''), '\s+', ' ', 'g')), '');
begin
  if v_uid is null or not public.comunidad_activa() or not (public.es_coach() or public.comunidad_soy_miembro()) then
    raise exception 'Para animar tienes que estar en la comunidad (y abierta)' using errcode = '42501';
  end if;
  if p_perfil is null or p_perfil = v_uid then raise exception 'A ti no te puedes mandar ánimo (¡pero vas bien!)' using errcode = '22023'; end if;
  if v_texto is not null and char_length(v_texto) > 80 then raise exception 'Las palabras del ánimo, hasta 80 letras' using errcode = '22023'; end if;
  select d.atleta_id into v_para_atleta from fbe_privado.comunidad_dentro d where d.perfil_id = p_perfil;
  if v_para_atleta is null then raise exception 'Esa persona ya no está en el equipo' using errcode = '42501'; end if;
  if exists (select 1 from public.comunidad_animos a where a.de = v_uid and a.para = p_perfil and a.semana = v_semana) then
    raise exception 'Ya le has mandado ánimo esta semana' using errcode = '23505';
  end if;
  perform fbe_privado.comunidad_gastar_cupo('animo');
  insert into public.comunidad_animos (de, para, atleta_id, para_atleta_id, semana, texto)
  values (v_uid, p_perfil, case when public.es_coach() then null else public.mi_atleta_id() end, v_para_atleta, v_semana, v_texto);
  perform fbe_privado.notificar_seguro(p_perfil, 'comunidad', fbe_privado.comunidad_nombre(v_uid) || ' te ha mandado ánimo 🙌',
    coalesce('«' || v_texto || '»', 'Míralo en Equipo.'), '#equipo', 'comunidad_animo:' || v_uid || ':' || v_semana);
  return v_semana;
end $$;
comment on function public.comunidad_animar(uuid, text) is '029/053: mandar ánimo a alguien del equipo (una vez por semana), con unas palabras opcionales (hasta 80).';

-- ---------------------------------------------------------------------
-- 3. Encuestas de los atletas (una al día) y citar una publicación
-- ---------------------------------------------------------------------
alter table public.comunidad_posts add column if not exists cita_post_id uuid references public.comunidad_posts(id) on delete set null;
create index if not exists comunidad_posts_cita_idx on public.comunidad_posts (cita_post_id) where cita_post_id is not null;

drop policy if exists miembro_publicar on public.comunidad_posts;
create policy miembro_publicar on public.comunidad_posts for insert to authenticated
  with check (autor_id = auth.uid() and tipo in ('post', 'momento', 'encuesta') and not fijada and not oculta and sesion_id is null and resumen is null
              and atleta_id = public.mi_atleta_id() and public.comunidad_soy_miembro());

-- La encuesta, limpia (lo de la 029/045, para el coach y para los atletas)
create or replace function public.comunidad_encuesta_limpia(p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_cierre timestamptz;
  v_opciones jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' or jsonb_typeof(p -> 'opciones') is distinct from 'array' then
    raise exception 'Una encuesta lleva de 2 a 4 opciones' using errcode = '22023';
  end if;
  begin
    v_cierre := nullif(btrim(coalesce(p ->> 'cierre', '')), '')::timestamptz;
  exception when others then
    raise exception 'El cierre de la encuesta no es una fecha válida' using errcode = '22023';
  end;
  if v_cierre is not null and v_cierre <= now() + interval '5 minutes' then
    raise exception 'El cierre de la encuesta, más adelante (o sin cierre)' using errcode = '22023';
  end if;
  select jsonb_agg(to_jsonb(btrim(e.o #>> '{}')) order by e.n) into v_opciones
  from jsonb_array_elements(p -> 'opciones') with ordinality as e(o, n);
  return jsonb_build_object('opciones', coalesce(v_opciones, '[]'::jsonb), 'cierre', to_jsonb(v_cierre));
end $$;

-- Publicar desde la app (029/045), con las encuestas de los atletas (una al día) y la cita de otra publicación
create or replace function public.comunidad_post_preparar() returns trigger
language plpgsql set search_path = '' as $$
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
    new.cita_post_id := null;
    if new.tipo is distinct from 'aviso' and new.tipo is distinct from 'encuesta' and new.tipo is distinct from 'momento' then
      raise exception 'Como coach, en el muro publicas avisos, encuestas y momentos' using errcode = '42501';
    end if;
    if new.foto_ruta is not null and (new.tipo not in ('aviso', 'momento') or new.foto_ruta not like 'coach/%') then
      raise exception 'La foto no va en su sitio' using errcode = '42501';
    end if;
    if new.tipo = 'encuesta' then new.encuesta := public.comunidad_encuesta_limpia(new.encuesta); else new.encuesta := null; end if;
  else
    new.atleta_id := public.mi_atleta_id();
    new.fijada := false;
    if new.tipo is distinct from 'post' and new.tipo is distinct from 'momento' and new.tipo is distinct from 'encuesta' then
      raise exception 'Los avisos son del coach, y los entrenos y los logros se comparten desde su sitio' using errcode = '42501';
    end if;
    if new.tipo = 'encuesta' then
      -- (053) una al día por persona; sin programar ni fijar
      if (select count(*) from public.comunidad_posts x where x.autor_id = new.autor_id and x.tipo = 'encuesta' and x.creado_en > now() - interval '1 day') >= 1 then
        raise exception 'Una encuesta al día: mañana, otra' using errcode = '54000';
      end if;
      new.encuesta := public.comunidad_encuesta_limpia(new.encuesta);
      new.publicar_en := null;
      new.foto_ruta := null;
      new.fotos := null;
    else
      new.encuesta := null;
    end if;
    if new.foto_ruta is not null and (new.atleta_id is null or new.foto_ruta not like new.atleta_id::text || '/%') then
      raise exception 'La foto no va en su sitio' using errcode = '42501';
    end if;
    -- (053) citar: solo una publicación que se ve, que no sea un momento ni la propia
    if new.cita_post_id is not null then
      if new.tipo <> 'post' then raise exception 'Solo una publicación normal cita a otra' using errcode = '22023'; end if;
      if not exists (select 1 from public.comunidad_posts c where c.id = new.cita_post_id and c.tipo <> 'momento' and c.autor_id <> new.autor_id
                     and public.comunidad_post_visible(c.id)) then
        raise exception 'Esa publicación ya no está (o es tuya)' using errcode = '22023';
      end if;
      if nullif(btrim(coalesce(new.texto, '')), '') is null then raise exception 'Al citar, escribe algo' using errcode = '22023'; end if;
    end if;
  end if;
  return new;
end $$;

-- A quien citan le llega un aviso (una vez por publicación que cita)
create or replace function fbe_privado.comunidad_al_citar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_autor uuid;
begin
  if new.cita_post_id is null or new.retenida then return null; end if;
  select c.autor_id into v_autor from public.comunidad_posts c where c.id = new.cita_post_id;
  if v_autor is not null and v_autor <> new.autor_id and public.comunidad_activa() then
    perform fbe_privado.notificar_seguro(v_autor, 'comunidad', fbe_privado.comunidad_nombre(new.autor_id) || ' ha compartido tu publicación',
      coalesce(left(new.texto, 120), 'Míralo en Equipo.'), '#equipo', 'comunidad_cita:' || new.id);
  end if;
  return null;
exception when others then
  raise warning 'FBE: aviso de la cita % no creado: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists comunidad_posts_zz_citar on public.comunidad_posts;
create trigger comunidad_posts_zz_citar after insert on public.comunidad_posts
  for each row execute function fbe_privado.comunidad_al_citar();

-- ---------------------------------------------------------------------
-- 4. Quedadas propuestas por atletas
-- ---------------------------------------------------------------------
alter table public.comunidad_eventos add column if not exists creado_por uuid references public.perfiles(id) on delete cascade;
create index if not exists comunidad_eventos_creado_por_idx on public.comunidad_eventos (creado_por) where creado_por is not null;

drop policy if exists miembro_proponer on public.comunidad_eventos;
create policy miembro_proponer on public.comunidad_eventos for insert to authenticated
  with check (public.comunidad_soy_miembro() and public.comunidad_activa() and creado_por = auth.uid() and (plazas is null or plazas <= 30));
drop policy if exists miembro_suya on public.comunidad_eventos;
create policy miembro_suya on public.comunidad_eventos for update to authenticated
  using (creado_por = auth.uid() and public.comunidad_soy_miembro())
  with check (creado_por = auth.uid() and (plazas is null or plazas <= 30));

-- Al preparar (044): quien no es coach propone como él mismo, con hasta 3 quedadas abiertas
create or replace function public.comunidad_evento_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.creado_en := now();
    new.cancelado_en := null;
    if current_user in ('authenticated', 'anon') and not public.es_coach() then
      new.creado_por := auth.uid();
      if (select count(*) from public.comunidad_eventos e where e.creado_por = auth.uid() and e.cancelado_en is null and e.empieza_en > now()) >= 3 then
        raise exception 'Como mucho tres quedadas abiertas a la vez' using errcode = '54000';
      end if;
    end if;
  else
    new.creado_en := old.creado_en;
    new.creado_por := old.creado_por;
    new.cancelado_en := case when old.cancelado_en is not null then old.cancelado_en when new.cancelado_en is not null then now() end;
  end if;
  new.actualizado_en := now();
  new.titulo := btrim(new.titulo);
  new.lugar := btrim(new.lugar);
  new.descripcion := nullif(btrim(coalesce(new.descripcion, '')), '');
  if (tg_op = 'INSERT' or new.empieza_en is distinct from old.empieza_en) and new.cancelado_en is null then
    if new.empieza_en <= now() then raise exception 'El evento, más adelante (esa hora ya ha pasado)' using errcode = '22023'; end if;
    if new.empieza_en > now() + interval '1 year' then raise exception 'El evento, como mucho dentro de un año' using errcode = '22023'; end if;
  end if;
  return new;
end $$;

-- Quien propone una quedada, va
create or replace function fbe_privado.comunidad_quedada_creada() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.creado_por is not null then
    insert into public.comunidad_evento_asistentes (evento_id, perfil_id, atleta_id, va)
    select new.id, new.creado_por, d.atleta_id, true from fbe_privado.comunidad_dentro d where d.perfil_id = new.creado_por
    on conflict (evento_id, perfil_id) do nothing;
  end if;
  return null;
end $$;
drop trigger if exists comunidad_eventos_zz_quedada on public.comunidad_eventos;
create trigger comunidad_eventos_zz_quedada after insert on public.comunidad_eventos
  for each row execute function fbe_privado.comunidad_quedada_creada();

-- Al cancelarla (044), el aviso dice quién la cancela
create or replace function fbe_privado.comunidad_evento_cambiado() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
begin
  if tg_op = 'DELETE' or new.cancelado_en is distinct from old.cancelado_en or new.empieza_en is distinct from old.empieza_en then
    delete from public.notificaciones n where n.estado = 'pendiente' and n.clave like 'comunidad_evento:' || old.id || ':%';
  end if;
  if tg_op = 'UPDATE' and new.cancelado_en is not null and old.cancelado_en is null and new.empieza_en > now() and public.comunidad_activa() then
    perform fbe_privado.notificar_seguro(a.perfil_id, 'comunidad', 'Se cancela: ' || new.titulo,
              case when new.creado_por is null then 'Tu coach ha cancelado el evento. Míralo en Equipo.'
                   else fbe_privado.comunidad_nombre(new.creado_por) || ' ha cancelado la quedada. Míralo en Equipo.' end,
              '#equipo', 'comunidad_evento_cancelado:' || new.id, null, new.empieza_en)
    from public.comunidad_evento_asistentes a join fbe_privado.comunidad_dentro d on d.perfil_id = a.perfil_id
    where a.evento_id = new.id and a.va and a.perfil_id <> coalesce(new.creado_por, '00000000-0000-0000-0000-000000000000'::uuid);
  end if;
  return null;
exception when others then
  raise warning 'FBE: avisos del evento % no puestos al día: %', old.id, sqlerrm;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 5. Duelos 1 a 1
-- ---------------------------------------------------------------------
create table if not exists public.comunidad_duelos (
  id            uuid primary key default gen_random_uuid(),
  de            uuid not null references public.perfiles(id) on delete cascade,
  para          uuid not null references public.perfiles(id) on delete cascade,
  de_atleta     uuid references public.atletas(id) on delete cascade,
  para_atleta   uuid references public.atletas(id) on delete cascade,
  semana        date not null,                               -- el lunes
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'aceptado', 'rechazado')),
  creado_en     timestamptz not null default now(),
  respondido_en timestamptz,
  check (de <> para)
);
create unique index if not exists comunidad_duelos_unico_idx on public.comunidad_duelos (least(de, para), greatest(de, para), semana);
create index if not exists comunidad_duelos_para_idx on public.comunidad_duelos (para, semana);
create index if not exists comunidad_duelos_de_idx on public.comunidad_duelos (de, semana);

alter table public.comunidad_duelos enable row level security;
drop policy if exists coach_ver on public.comunidad_duelos;
create policy coach_ver on public.comunidad_duelos for select to authenticated using (public.es_coach());
drop policy if exists mios_ver on public.comunidad_duelos;
create policy mios_ver on public.comunidad_duelos for select to authenticated using (auth.uid() in (de, para) and public.comunidad_soy_miembro());

-- Retar a alguien: esta semana (si aún no es domingo) o la que viene. Los dos dentro y en el ranking; hasta 3 duelos vivos.
create or replace function public.comunidad_duelo_proponer(p_para uuid, p_proxima boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_semana date := fbe_privado.comunidad_lunes() + case when p_proxima or extract(isodow from fbe_privado.comunidad_hoy()) = 7 then 7 else 0 end;
  v_yo fbe_privado.comunidad_dentro;
  v_el fbe_privado.comunidad_dentro;
  v_id uuid;
begin
  if v_uid is null or not public.comunidad_activa() or not public.comunidad_soy_miembro() then
    raise exception 'Para retar tienes que estar en la comunidad (y abierta)' using errcode = '42501';
  end if;
  if p_para is null or p_para = v_uid then raise exception 'A ti mismo ya te retas cada semana' using errcode = '22023'; end if;
  select * into v_yo from fbe_privado.comunidad_dentro d where d.perfil_id = v_uid;
  select * into v_el from fbe_privado.comunidad_dentro d where d.perfil_id = p_para;
  if v_el.perfil_id is null then raise exception 'Esa persona ya no está en el equipo' using errcode = '42501'; end if;
  if v_yo.sin_ranking or v_el.sin_ranking then raise exception 'Los duelos cuentan sesiones: los dos tenéis que salir en el ranking' using errcode = '22023'; end if;
  if (select count(*) from public.comunidad_duelos x where v_uid in (x.de, x.para) and x.estado <> 'rechazado' and x.semana + 6 >= fbe_privado.comunidad_hoy()) >= 3 then
    raise exception 'Como mucho tres duelos a la vez' using errcode = '54000';
  end if;
  if exists (select 1 from public.comunidad_duelos x where least(x.de, x.para) = least(v_uid, p_para) and greatest(x.de, x.para) = greatest(v_uid, p_para) and x.semana = v_semana) then
    raise exception 'Ya tenéis un duelo esa semana' using errcode = '23505';
  end if;
  perform fbe_privado.comunidad_gastar_cupo('animo');
  insert into public.comunidad_duelos (de, para, de_atleta, para_atleta, semana) values (v_uid, p_para, v_yo.atleta_id, v_el.atleta_id, v_semana) returning id into v_id;
  perform fbe_privado.notificar_seguro(p_para, 'comunidad', fbe_privado.comunidad_nombre(v_uid) || ' te reta a un duelo ⚔️',
    'Quién hace más sesiones ' || case when v_semana > fbe_privado.comunidad_lunes() then 'la semana que viene' else 'esta semana' end || '. Acéptalo en Equipo.',
    '#equipo', 'comunidad_duelo:' || v_id, null, (v_semana + 7)::timestamp at time zone 'Europe/Madrid');
  return v_id;
end $$;

-- Aceptar o rechazar un duelo que me han propuesto
create or replace function public.comunidad_duelo_responder(p_id uuid, p_acepta boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  x public.comunidad_duelos;
begin
  if v_uid is null or not public.comunidad_soy_miembro() then raise exception 'No estás en la comunidad' using errcode = '42501'; end if;
  select * into x from public.comunidad_duelos d where d.id = p_id and d.para = v_uid and d.estado = 'pendiente';
  if not found then raise exception 'Ese duelo ya no está pendiente' using errcode = '22023'; end if;
  if x.semana + 6 < fbe_privado.comunidad_hoy() then raise exception 'Esa semana ya pasó' using errcode = '22023'; end if;
  update public.comunidad_duelos set estado = case when p_acepta then 'aceptado' else 'rechazado' end, respondido_en = now() where id = p_id;
  if p_acepta then
    perform fbe_privado.notificar_seguro(x.de, 'comunidad', fbe_privado.comunidad_nombre(v_uid) || ' acepta el duelo ⚔️', 'Que gane quien más entrene. Míralo en Equipo.',
      '#equipo', 'comunidad_duelo_ok:' || x.id, null, (x.semana + 7)::timestamp at time zone 'Europe/Madrid');
  end if;
  return case when p_acepta then 'aceptado' else 'rechazado' end;
end $$;

-- Retirar un duelo que propuse (si aún está pendiente)
create or replace function public.comunidad_duelo_retirar(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.comunidad_duelos d where d.id = p_id and d.de = auth.uid() and d.estado = 'pendiente';
$$;

-- Mis duelos (de esta semana, la que viene y la pasada): con el rival, las sesiones de cada uno y, si la semana acabó, el
-- resultado. El coach ve los de todos (p_todos).
create or replace function public.comunidad_duelos_mios(p_todos boolean default false)
returns table (id uuid, semana date, estado text, soy_retador boolean, rival uuid, rival_nombre text, rival_foto text, yo uuid, yo_nombre text,
               mias integer, suyas integer, acabado boolean, creado_en timestamptz)
language sql stable security definer set search_path = '' as $$
  with mios as (
    select d.*, case when d.de = auth.uid() then d.para else d.de end as r, case when d.de = auth.uid() then d.de else d.para end as y
    from public.comunidad_duelos d
    where auth.uid() is not null and ((p_todos and public.es_coach()) or (auth.uid() in (d.de, d.para) and public.comunidad_soy_miembro()))
      and d.semana between fbe_privado.comunidad_lunes() - 7 and fbe_privado.comunidad_lunes() + 7
  ), hechas as (
    select v.atleta_id, v.fecha from fbe_privado.comunidad_sesiones_validas(array(select m.de_atleta from mios m union select m.para_atleta from mios m)) v
  )
  select m.id, m.semana, m.estado, m.de = auth.uid(),
    m.r, coalesce(dr.nombre, 'Alguien del equipo'), pr.foto, m.y, coalesce(dy.nombre, 'Alguien del equipo'),
    (select count(*)::integer from hechas h where h.atleta_id = case when m.de = auth.uid() then m.de_atleta else m.para_atleta end and h.fecha between m.semana and m.semana + 6),
    (select count(*)::integer from hechas h where h.atleta_id = case when m.de = auth.uid() then m.para_atleta else m.de_atleta end and h.fecha between m.semana and m.semana + 6),
    m.semana + 6 < fbe_privado.comunidad_hoy(), m.creado_en
  from mios m
  left join fbe_privado.comunidad_dentro dr on dr.perfil_id = m.r
  left join fbe_privado.comunidad_dentro dy on dy.perfil_id = m.y
  left join public.perfiles pr on pr.id = m.r
  order by m.semana desc, m.creado_en desc
$$;

-- ---------------------------------------------------------------------
-- 6. «Hoy entreno a las…»
-- ---------------------------------------------------------------------
create table if not exists public.comunidad_intenciones (
  perfil_id  uuid primary key references public.perfiles(id) on delete cascade,
  atleta_id  uuid references public.atletas(id) on delete cascade,
  fecha      date not null,
  hora       time,
  nota       text check (nota is null or (char_length(nota) between 1 and 40 and public.texto_visible(nota) and nota !~ '[[:cntrl:]]')),
  creado_en  timestamptz not null default now()
);
alter table public.comunidad_intenciones enable row level security;
drop policy if exists coach_ver on public.comunidad_intenciones;
create policy coach_ver on public.comunidad_intenciones for select to authenticated using (public.es_coach());
drop policy if exists mia_ver on public.comunidad_intenciones;
create policy mia_ver on public.comunidad_intenciones for select to authenticated using (perfil_id = auth.uid());

-- Decir cuándo entreno (hoy o mañana; sin fecha, lo quito)
create or replace function public.comunidad_intencion(p_fecha date default null, p_hora time default null, p_nota text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_nota text := nullif(btrim(regexp_replace(coalesce(p_nota, ''), '\s+', ' ', 'g')), '');
begin
  if v_uid is null or not public.comunidad_activa() or not public.comunidad_soy_miembro() then raise exception 'No estás en la comunidad' using errcode = '42501'; end if;
  delete from public.comunidad_intenciones i where i.fecha < fbe_privado.comunidad_hoy();
  if p_fecha is null then
    delete from public.comunidad_intenciones i where i.perfil_id = v_uid;
    return null;
  end if;
  if p_fecha not between fbe_privado.comunidad_hoy() and fbe_privado.comunidad_hoy() + 1 then raise exception 'Hoy o mañana' using errcode = '22023'; end if;
  if v_nota is not null and char_length(v_nota) > 40 then raise exception 'La nota, hasta 40 letras' using errcode = '22023'; end if;
  insert into public.comunidad_intenciones (perfil_id, atleta_id, fecha, hora, nota) values (v_uid, public.mi_atleta_id(), p_fecha, p_hora, v_nota)
  on conflict (perfil_id) do update set fecha = excluded.fecha, hora = excluded.hora, nota = excluded.nota, creado_en = now();
  return jsonb_build_object('fecha', p_fecha, 'hora', p_hora, 'nota', v_nota);
end $$;

-- Quién ha dicho cuándo entrena (hoy y mañana), de los que están dentro
create or replace function public.comunidad_intenciones()
returns table (perfil_id uuid, nombre text, foto text, fecha date, hora time, nota text, soy_yo boolean)
language sql stable security definer set search_path = '' as $$
  select i.perfil_id, d.nombre, p.foto, i.fecha, i.hora, i.nota, i.perfil_id = auth.uid()
  from public.comunidad_intenciones i
  join fbe_privado.comunidad_dentro d on d.perfil_id = i.perfil_id
  join public.perfiles p on p.id = i.perfil_id
  where auth.uid() is not null and (public.es_coach() or public.comunidad_soy_miembro()) and i.fecha >= fbe_privado.comunidad_hoy()
  order by i.fecha, i.hora nulls last, d.nombre
$$;

-- ---------------------------------------------------------------------
-- 7. Apadrinar a quien entra
-- ---------------------------------------------------------------------
create table if not exists public.comunidad_padrinos (
  nuevo          uuid primary key references public.perfiles(id) on delete cascade,
  padrino        uuid not null references public.perfiles(id) on delete cascade,
  nuevo_atleta   uuid references public.atletas(id) on delete cascade,
  padrino_atleta uuid references public.atletas(id) on delete cascade,
  desde          date not null default (now() at time zone 'Europe/Madrid')::date,
  hasta          date not null,
  terminado_en   timestamptz,                          -- si uno de los dos lo dejó antes de tiempo (la fila se queda: cuenta para la insignia)
  creado_en      timestamptz not null default now(),
  check (nuevo <> padrino and hasta > desde)
);
alter table public.comunidad_padrinos add column if not exists terminado_en timestamptz;
create index if not exists comunidad_padrinos_padrino_idx on public.comunidad_padrinos (padrino);
alter table public.comunidad_padrinos enable row level security;
drop policy if exists coach_ver on public.comunidad_padrinos;
create policy coach_ver on public.comunidad_padrinos for select to authenticated using (public.es_coach());
drop policy if exists miembro_ver on public.comunidad_padrinos;
create policy miembro_ver on public.comunidad_padrinos for select to authenticated using (public.comunidad_soy_miembro());

-- Acompañar a alguien que acaba de entrar (menos de 14 días dentro), llevando yo 8 semanas o más; 30 días
create or replace function public.comunidad_apadrinar(p_nuevo uuid) returns date
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_mi_alta timestamptz;
  v_su_alta timestamptz;
  v_nuevo fbe_privado.comunidad_dentro;
  v_hasta date := fbe_privado.comunidad_hoy() + 30;
begin
  if v_uid is null or not public.comunidad_activa() or not public.comunidad_soy_miembro() then raise exception 'No estás en la comunidad' using errcode = '42501'; end if;
  if p_nuevo is null or p_nuevo = v_uid then raise exception 'A ti mismo no te puedes apadrinar' using errcode = '22023'; end if;
  select m.creado_en into v_mi_alta from public.comunidad_miembros m where m.perfil_id = v_uid;
  if v_mi_alta > now() - interval '56 days' then raise exception 'Para acompañar a alguien hay que llevar 8 semanas en el equipo' using errcode = '22023'; end if;
  select * into v_nuevo from fbe_privado.comunidad_dentro d where d.perfil_id = p_nuevo;
  if v_nuevo.perfil_id is null then raise exception 'Esa persona ya no está en el equipo' using errcode = '42501'; end if;
  select m.creado_en into v_su_alta from public.comunidad_miembros m where m.perfil_id = p_nuevo;
  if v_su_alta <= now() - interval '14 days' then raise exception 'Se acompaña a quien lleva menos de dos semanas en el equipo' using errcode = '22023'; end if;
  if exists (select 1 from public.comunidad_padrinos x where x.nuevo = p_nuevo and x.hasta >= fbe_privado.comunidad_hoy() and x.terminado_en is null) then
    raise exception 'Ya tiene quien le acompañe' using errcode = '23505';
  end if;
  if (select count(*) from public.comunidad_padrinos x where x.padrino = v_uid and x.hasta >= fbe_privado.comunidad_hoy() and x.terminado_en is null) >= 2 then
    raise exception 'Como mucho dos personas a la vez' using errcode = '54000';
  end if;
  insert into public.comunidad_padrinos (nuevo, padrino, nuevo_atleta, padrino_atleta, hasta) values (p_nuevo, v_uid, v_nuevo.atleta_id, public.mi_atleta_id(), v_hasta)
  on conflict (nuevo) do update set padrino = excluded.padrino, padrino_atleta = excluded.padrino_atleta, desde = fbe_privado.comunidad_hoy(), hasta = excluded.hasta, terminado_en = null, creado_en = now();
  perform fbe_privado.notificar_seguro(p_nuevo, 'comunidad', fbe_privado.comunidad_nombre(v_uid) || ' te acompaña tu primer mes 🤝',
    'Pregúntale lo que quieras: menciónale con @ en el muro. Míralo en Equipo.', '#equipo', 'comunidad_padrino:' || p_nuevo || ':' || v_uid);
  return v_hasta;
end $$;

-- Dejar de acompañar (el padrino) o soltarse (el nuevo)
create or replace function public.comunidad_padrino_quitar(p_nuevo uuid default null) returns void
language sql security definer set search_path = '' as $$
  update public.comunidad_padrinos x set terminado_en = now()
  where x.terminado_en is null and ((x.nuevo = coalesce(p_nuevo, auth.uid()) and x.padrino = auth.uid()) or (p_nuevo is null and x.nuevo = auth.uid()));
$$;

-- Quién acompaña a quién (vigentes), con nombres y fotos; y a quién puedo acompañar yo (nuevos sin padrino)
create or replace function public.comunidad_padrinos_lista() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null or not (public.es_coach() or public.comunidad_soy_miembro()) then null else jsonb_build_object(
    'puedo', exists (select 1 from public.comunidad_miembros m where m.perfil_id = auth.uid() and m.creado_en <= now() - interval '56 days'),
    'vigentes', coalesce((select jsonb_agg(jsonb_build_object('nuevo', x.nuevo, 'nuevo_nombre', dn.nombre, 'nuevo_foto', pn.foto,
                                                             'padrino', x.padrino, 'padrino_nombre', dp.nombre, 'padrino_foto', pp.foto,
                                                             'desde', x.desde, 'hasta', x.hasta) order by x.creado_en desc)
                          from public.comunidad_padrinos x
                          join fbe_privado.comunidad_dentro dn on dn.perfil_id = x.nuevo
                          join fbe_privado.comunidad_dentro dp on dp.perfil_id = x.padrino
                          join public.perfiles pn on pn.id = x.nuevo
                          join public.perfiles pp on pp.id = x.padrino
                          where x.hasta >= fbe_privado.comunidad_hoy() and x.terminado_en is null), '[]'::jsonb),
    'sin_padrino', coalesce((select jsonb_agg(jsonb_build_object('perfil_id', d.perfil_id, 'nombre', d.nombre, 'foto', p.foto, 'desde', m.creado_en) order by m.creado_en desc)
                             from fbe_privado.comunidad_dentro d
                             join public.comunidad_miembros m on m.atleta_id = d.atleta_id and m.creado_en > now() - interval '14 days'
                             join public.perfiles p on p.id = d.perfil_id
                             where d.perfil_id <> auth.uid()
                               and not exists (select 1 from public.comunidad_padrinos x where x.nuevo = d.perfil_id and x.hasta >= fbe_privado.comunidad_hoy() and x.terminado_en is null)), '[]'::jsonb)
  ) end
$$;

-- ---------------------------------------------------------------------
-- 8. Compañero de la semana elegido por el equipo
-- ---------------------------------------------------------------------
create table if not exists public.comunidad_votos_semana (
  semana      date not null,
  de          uuid not null references public.perfiles(id) on delete cascade,
  para        uuid not null references public.perfiles(id) on delete cascade,
  de_atleta   uuid references public.atletas(id) on delete cascade,
  para_atleta uuid references public.atletas(id) on delete cascade,
  creado_en   timestamptz not null default now(),
  primary key (semana, de),
  check (de <> para)
);
create index if not exists comunidad_votos_semana_para_idx on public.comunidad_votos_semana (para, semana);
alter table public.comunidad_votos_semana enable row level security;
drop policy if exists coach_ver on public.comunidad_votos_semana;
create policy coach_ver on public.comunidad_votos_semana for select to authenticated using (public.es_coach());
drop policy if exists mio_ver on public.comunidad_votos_semana;
create policy mio_ver on public.comunidad_votos_semana for select to authenticated using (de = auth.uid());

-- Votar (o cambiar el voto) al compañero de esta semana
create or replace function public.comunidad_votar_companero(p_para uuid) returns date
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_semana date := fbe_privado.comunidad_lunes();
  v_para_atleta uuid;
begin
  if v_uid is null or not public.comunidad_activa() or not public.comunidad_soy_miembro() then raise exception 'Para votar tienes que estar en la comunidad (y abierta)' using errcode = '42501'; end if;
  if p_para is null then
    delete from public.comunidad_votos_semana v where v.de = v_uid and v.semana = v_semana;
    return v_semana;
  end if;
  if p_para = v_uid then raise exception 'A ti no te puedes votar' using errcode = '22023'; end if;
  select d.atleta_id into v_para_atleta from fbe_privado.comunidad_dentro d where d.perfil_id = p_para;
  if v_para_atleta is null then raise exception 'Esa persona ya no está en el equipo' using errcode = '42501'; end if;
  if not exists (select 1 from public.comunidad_votos_semana v where v.de = v_uid and v.semana = v_semana and v.para = p_para) then
    perform fbe_privado.comunidad_gastar_cupo('voto');
  end if;
  insert into public.comunidad_votos_semana (semana, de, para, de_atleta, para_atleta) values (v_semana, v_uid, p_para, public.mi_atleta_id(), v_para_atleta)
  on conflict (semana, de) do update set para = excluded.para, para_atleta = excluded.para_atleta, creado_en = now();
  return v_semana;
end $$;

-- El compañero de la semana pasada (con 2 votos o más; si empatan, todos), mi voto de esta y cuántos han votado ya
create or replace function public.comunidad_companero_semana() returns jsonb
language sql stable security definer set search_path = '' as $$
  with pasada as (
    select v.para, count(*) as n from public.comunidad_votos_semana v
    join fbe_privado.comunidad_dentro d on d.perfil_id = v.para
    where v.semana = fbe_privado.comunidad_lunes() - 7 group by v.para
  ), tope as (select max(n) as n from pasada)
  select case when auth.uid() is null or not (public.es_coach() or public.comunidad_soy_miembro()) then null else jsonb_build_object(
    'semana', fbe_privado.comunidad_lunes() - 7,
    'elegidos', coalesce((select jsonb_agg(jsonb_build_object('perfil_id', p.para, 'nombre', d.nombre, 'foto', pf.foto, 'votos', p.n) order by d.nombre)
                          from pasada p join tope t on p.n = t.n join fbe_privado.comunidad_dentro d on d.perfil_id = p.para join public.perfiles pf on pf.id = p.para
                          where p.n >= 2), '[]'::jsonb),
    'mi_voto', (select v.para from public.comunidad_votos_semana v where v.de = auth.uid() and v.semana = fbe_privado.comunidad_lunes()),
    'votos', (select count(*) from public.comunidad_votos_semana v where v.semana = fbe_privado.comunidad_lunes()),
    'mis_veces', (select count(*) from (
                    select v.semana from public.comunidad_votos_semana v where v.para = auth.uid() and v.semana < fbe_privado.comunidad_lunes()
                    group by v.semana having count(*) >= 2
                      and count(*) = (select max(c) from (select count(*) as c from public.comunidad_votos_semana w where w.semana = v.semana group by w.para) z)) k)
  ) end
$$;

-- ---------------------------------------------------------------------
-- 9. Tu huella en el equipo (y las insignias sociales)
-- ---------------------------------------------------------------------
-- Las semanas seguidas (hasta esta o la pasada) con algún ánimo mandado
create or replace function fbe_privado.comunidad_semanas_animando(p_perfil uuid) returns integer
language plpgsql stable set search_path = '' as $$
declare
  v_l date := fbe_privado.comunidad_lunes();
  v_n integer := 0;
begin
  if not exists (select 1 from public.comunidad_animos a where a.de = p_perfil and a.semana = v_l) then v_l := v_l - 7; end if;
  while exists (select 1 from public.comunidad_animos a where a.de = p_perfil and a.semana = v_l) and v_n < 520 loop
    v_n := v_n + 1; v_l := v_l - 7;
  end loop;
  return v_n;
end $$;

-- Las veces que el equipo le eligió compañero de la semana (2 votos o más y el que más)
create or replace function fbe_privado.comunidad_veces_elegido(p_perfil uuid) returns integer
language sql stable set search_path = '' as $$
  select count(*)::integer from (
    select v.semana from public.comunidad_votos_semana v where v.para = p_perfil and v.semana < fbe_privado.comunidad_lunes()
    group by v.semana having count(*) >= 2
      and count(*) = (select max(c) from (select count(*) as c from public.comunidad_votos_semana w where w.semana = v.semana group by w.para) z)) k
$$;

create or replace function public.comunidad_huella(p_perfil uuid default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  with quien as (
    select coalesce(p_perfil, auth.uid()) as id
  )
  select case when auth.uid() is null or not (public.es_coach() or public.comunidad_soy_miembro())
                or not exists (select 1 from fbe_privado.comunidad_dentro d, quien q where d.perfil_id = q.id) then null
    else jsonb_build_object(
    'desde', (select m.creado_en from public.comunidad_miembros m, quien q where m.perfil_id = q.id),
    'animos_dados', (select count(*) from public.comunidad_animos a, quien q where a.de = q.id),
    'animos_recibidos', (select count(*) from public.comunidad_animos a, quien q where a.para = q.id),
    'bienvenidas', (select count(*) from public.comunidad_bienvenidas b, quien q where b.de = q.id),
    'comentarios', (select count(*) from public.comunidad_comentarios c, quien q where c.autor_id = q.id and not c.oculto),
    'reacciones', (select count(*) from public.comunidad_reacciones r, quien q where r.autor_id = q.id),
    'quedadas', (select count(*) from public.comunidad_evento_asistentes a join public.comunidad_eventos e on e.id = a.evento_id, quien q
                 where a.perfil_id = q.id and a.va and e.cancelado_en is null and e.empieza_en < now()),
    'ahijados', (select count(*) from public.comunidad_padrinos x, quien q where x.padrino = q.id),
    'elegido', (select fbe_privado.comunidad_veces_elegido(q.id) from quien q),
    'semanas_animando', (select fbe_privado.comunidad_semanas_animando(q.id) from quien q),
    'duelos_ganados', (select count(*) from public.comunidad_duelos d, quien q
                       where q.id in (d.de, d.para) and d.estado = 'aceptado' and d.semana + 6 < fbe_privado.comunidad_hoy()
                         and (select count(*) from fbe_privado.comunidad_sesiones_validas(array[case when d.de = q.id then d.de_atleta else d.para_atleta end]) v where v.fecha between d.semana and d.semana + 6)
                           > (select count(*) from fbe_privado.comunidad_sesiones_validas(array[case when d.de = q.id then d.para_atleta else d.de_atleta end]) v where v.fecha between d.semana and d.semana + 6))
  ) end
$$;

-- Las insignias (042/045), con las sociales
create or replace function fbe_privado.comunidad_insignias_de(p_atleta uuid, p_perfil uuid)
returns table (clave text, valor integer, meta integer)
language sql stable security definer set search_path = '' as $$
  select 'primera_publicacion'::text, (select count(*)::integer from public.comunidad_posts x where x.autor_id = p_perfil and not x.oculta and x.tipo <> 'aniversario'), 1
  union all
  select 'animos_10', (select count(*)::integer from public.comunidad_animos a where a.de = p_perfil), 10
  union all
  select 'reacciones_25', (select count(*)::integer from public.comunidad_reacciones r where r.autor_id = p_perfil), 25
  union all
  select 'retos_5', (select count(*)::integer from public.comunidad_retos r where fbe_privado.comunidad_reto_conseguido(r.id, p_atleta)), 5
  union all
  select 'racha_4', coalesce((select p.mejor from fbe_privado.comunidad_rachas_pareja(p_atleta, p_atleta, null) p), 0), 4
  union all
  select 'pareja_4', coalesce((
    select max(p.mejor) from public.comunidad_companeros c
    join fbe_privado.comunidad_dentro o on o.perfil_id = case when c.de = p_perfil then c.para else c.de end
    cross join lateral fbe_privado.comunidad_rachas_pareja(p_atleta, o.atleta_id, (c.aceptado_en at time zone 'Europe/Madrid')::date) p
    where c.estado = 'aceptada' and p_perfil in (c.de, c.para)), 0), 4
  union all
  select 'animador_25', (select count(*)::integer from public.comunidad_animos a where a.de = p_perfil), 25
  union all
  select 'anfitrion_3', (select count(*)::integer from public.comunidad_bienvenidas b where b.de = p_perfil), 3
  union all
  select 'padrino_1', (select count(*)::integer from public.comunidad_padrinos x where x.padrino = p_perfil), 1
  union all
  select 'puntual_3', (select count(*)::integer from public.comunidad_evento_asistentes a join public.comunidad_eventos e on e.id = a.evento_id
                       where a.perfil_id = p_perfil and a.va and e.cancelado_en is null and e.empieza_en < now()), 3
$$;

-- ---------------------------------------------------------------------
-- 10. Quién necesita un ánimo (solo quien lo enciende)
-- ---------------------------------------------------------------------
create or replace function public.comunidad_sin_entrenar()
returns table (perfil_id uuid, nombre text, foto text, dias integer)
language sql stable security definer set search_path = '' as $$
  with gente as (
    select d.atleta_id, d.perfil_id, d.nombre, m.creado_en
    from fbe_privado.comunidad_dentro d
    join public.comunidad_miembros m on m.atleta_id = d.atleta_id and m.ver_ausencia
    where d.perfil_id <> auth.uid()
  ), ultima as (
    select v.atleta_id, max(v.fecha) as fecha from fbe_privado.comunidad_sesiones_validas(array(select g.atleta_id from gente g)) v group by v.atleta_id
  )
  select g.perfil_id, g.nombre, p.foto,
    (fbe_privado.comunidad_hoy() - coalesce(u.fecha, (g.creado_en at time zone 'Europe/Madrid')::date))::integer
  from gente g
  left join ultima u on u.atleta_id = g.atleta_id
  join public.perfiles p on p.id = g.perfil_id
  join public.atletas a on a.id = g.atleta_id and a.entrenamiento
  where auth.uid() is not null and (public.es_coach() or public.comunidad_soy_miembro())
    and fbe_privado.comunidad_hoy() - coalesce(u.fecha, (g.creado_en at time zone 'Europe/Madrid')::date) >= 5
  order by 4 desc, g.nombre
  limit 10
$$;

-- ---------------------------------------------------------------------
-- 11. Salir borrando lo suyo (044) y mis datos (044), con lo de aquí
-- ---------------------------------------------------------------------
create or replace function public.comunidad_salir(p_borrar boolean default false) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_fotos text[] := '{}';
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión' using errcode = '42501'; end if;
  update public.comunidad_miembros set salido_en = now() where perfil_id = v_uid and salido_en is null;
  delete from public.comunidad_companeros where de = v_uid or para = v_uid;
  -- (053) lo que solo tiene sentido estando dentro se va siempre
  delete from public.comunidad_intenciones where perfil_id = v_uid;
  delete from public.comunidad_duelos where (de = v_uid or para = v_uid) and semana + 6 >= fbe_privado.comunidad_hoy();
  update public.comunidad_padrinos set terminado_en = coalesce(terminado_en, now()) where (nuevo = v_uid or padrino = v_uid) and hasta >= fbe_privado.comunidad_hoy();
  if coalesce(p_borrar, false) and not exists (select 1 from public.perfiles p where p.id = v_uid and p.rol = 'coach') then
    select coalesce(array_agg(distinct f.ruta) filter (where f.ruta is not null), '{}') into v_fotos
    from public.comunidad_posts x
    cross join lateral unnest(coalesce(x.fotos, array[x.foto_ruta])) as f(ruta)
    where x.autor_id = v_uid
      and not exists (select 1 from public.comunidad_reportes r where (r.copia_foto = f.ruta or r.copia_fotos @> array[f.ruta]) and r.resuelto_en is null);
    delete from public.comunidad_reacciones where autor_id = v_uid;
    delete from public.comunidad_comentario_reacciones where autor_id = v_uid;
    delete from public.comunidad_votos where autor_id = v_uid;
    delete from public.comunidad_animos where de = v_uid or para = v_uid;
    delete from public.comunidad_bienvenidas where de = v_uid or para = v_uid;
    delete from public.comunidad_guardados where perfil_id = v_uid;
    delete from public.comunidad_evento_asistentes where perfil_id = v_uid;
    delete from public.comunidad_duelos where de = v_uid or para = v_uid;
    delete from public.comunidad_padrinos where nuevo = v_uid or padrino = v_uid;
    delete from public.comunidad_votos_semana where de = v_uid or para = v_uid;
    update public.comunidad_eventos set cancelado_en = coalesce(cancelado_en, now()) where creado_por = v_uid and empieza_en > now();
    delete from public.comunidad_comentarios where autor_id = v_uid;
    delete from public.comunidad_posts where autor_id = v_uid;
  end if;
  return v_fotos;
end $$;

create or replace function public.comunidad_mis_datos() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'miembro', (select to_jsonb(m) - 'perfil_id' from public.comunidad_miembros m where m.perfil_id = auth.uid()),
    'publicaciones', coalesce((select jsonb_agg((to_jsonb(x) - 'menciones') || jsonb_build_object('menciones', cardinality(x.menciones)) order by x.creado_en)
                               from public.comunidad_posts x where x.autor_id = auth.uid()), '[]'::jsonb),
    'comentarios', coalesce((select jsonb_agg((to_jsonb(c) - 'menciones') || jsonb_build_object('menciones', cardinality(c.menciones)) order by c.creado_en)
                             from public.comunidad_comentarios c where c.autor_id = auth.uid()), '[]'::jsonb),
    'reacciones', coalesce((select jsonb_agg(to_jsonb(r) order by r.creado_en) from public.comunidad_reacciones r where r.autor_id = auth.uid()), '[]'::jsonb),
    'reacciones_comentarios', coalesce((select jsonb_agg(jsonb_build_object('comentario_id', r.comentario_id, 'creado_en', r.creado_en) order by r.creado_en)
                                        from public.comunidad_comentario_reacciones r where r.autor_id = auth.uid()), '[]'::jsonb),
    'votos', coalesce((select jsonb_agg(to_jsonb(v) order by v.creado_en) from public.comunidad_votos v where v.autor_id = auth.uid()), '[]'::jsonb),
    'animos_mandados', coalesce((select jsonb_agg(
                                   case when exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = a.para)
                                        then jsonb_build_object('para', a.para, 'para_nombre', fbe_privado.comunidad_nombre(a.para), 'semana', a.semana, 'creado_en', a.creado_en, 'texto', a.texto)
                                        else jsonb_build_object('para_nombre', 'Alguien del equipo', 'semana', a.semana, 'creado_en', a.creado_en, 'texto', a.texto) end
                                   order by a.creado_en)
                                 from public.comunidad_animos a where a.de = auth.uid()), '[]'::jsonb),
    'animos_recibidos', coalesce((select jsonb_agg(jsonb_build_object('semana', a.semana, 'creado_en', a.creado_en, 'texto', a.texto) order by a.creado_en)
                                  from public.comunidad_animos a where a.para = auth.uid()), '[]'::jsonb),
    'bienvenidas_dadas', coalesce((select jsonb_agg(
                                     case when exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = b.para)
                                          then jsonb_build_object('para', b.para, 'para_nombre', fbe_privado.comunidad_nombre(b.para), 'creado_en', b.creado_en)
                                          else jsonb_build_object('para_nombre', 'Alguien del equipo', 'creado_en', b.creado_en) end
                                     order by b.creado_en)
                                   from public.comunidad_bienvenidas b where b.de = auth.uid()), '[]'::jsonb),
    'bienvenidas_recibidas', coalesce((select jsonb_agg(jsonb_build_object('creado_en', b.creado_en) order by b.creado_en)
                                       from public.comunidad_bienvenidas b where b.para = auth.uid()), '[]'::jsonb),
    'companeros', coalesce((select jsonb_agg(jsonb_build_object(
                              'con', case when exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = case when k.de = auth.uid() then k.para else k.de end)
                                          then fbe_privado.comunidad_nombre(case when k.de = auth.uid() then k.para else k.de end) else 'Alguien del equipo' end,
                              'estado', k.estado, 'invitaste', k.de = auth.uid(), 'creado_en', k.creado_en, 'aceptado_en', k.aceptado_en) order by k.creado_en)
                            from public.comunidad_companeros k where auth.uid() in (k.de, k.para)), '[]'::jsonb),
    'guardados', coalesce((select jsonb_agg(jsonb_build_object('post_id', g.post_id, 'creado_en', g.creado_en) order by g.creado_en)
                           from public.comunidad_guardados g where g.perfil_id = auth.uid()), '[]'::jsonb),
    'preguntas_frecuentes', coalesce((select jsonb_agg(jsonb_build_object('post_id', q.post_id, 'pregunta', q.pregunta, 'respuesta', q.respuesta, 'creado_en', q.creado_en) order by q.creado_en)
                                      from public.comunidad_preguntas q join public.comunidad_posts x on x.id = q.post_id where x.autor_id = auth.uid()), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('evento', e.titulo, 'empieza_en', e.empieza_en, 'va', a.va, 'creado_en', a.creado_en, 'propuesta_mia', e.creado_por = auth.uid()) order by a.creado_en)
                         from public.comunidad_evento_asistentes a join public.comunidad_eventos e on e.id = a.evento_id where a.perfil_id = auth.uid()), '[]'::jsonb),
    'quedadas_propuestas', coalesce((select jsonb_agg(jsonb_build_object('titulo', e.titulo, 'empieza_en', e.empieza_en, 'lugar', e.lugar, 'cancelado_en', e.cancelado_en, 'creado_en', e.creado_en) order by e.creado_en)
                                     from public.comunidad_eventos e where e.creado_por = auth.uid()), '[]'::jsonb),
    'atleta_de_la_semana', coalesce((select jsonb_agg(jsonb_build_object('motivo', k.motivo, 'desde', k.desde, 'hasta', k.hasta) order by k.desde)
                                     from public.comunidad_destacados k where k.perfil_id = auth.uid()), '[]'::jsonb),
    'avisos_al_coach', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'post_id', r.post_id, 'comentario_id', r.comentario_id, 'motivo', r.motivo,
                                   'creado_en', r.creado_en, 'resuelto_en', r.resuelto_en) order by r.creado_en)
                                 from public.comunidad_reportes r where r.autor_id = auth.uid()), '[]'::jsonb),
    'duelos', coalesce((select jsonb_agg(jsonb_build_object(
                          'con', case when exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = case when k.de = auth.uid() then k.para else k.de end)
                                      then fbe_privado.comunidad_nombre(case when k.de = auth.uid() then k.para else k.de end) else 'Alguien del equipo' end,
                          'semana', k.semana, 'estado', k.estado, 'retaste', k.de = auth.uid(), 'creado_en', k.creado_en) order by k.creado_en)
                        from public.comunidad_duelos k where auth.uid() in (k.de, k.para)), '[]'::jsonb),
    'intencion', (select jsonb_build_object('fecha', i.fecha, 'hora', i.hora, 'nota', i.nota) from public.comunidad_intenciones i where i.perfil_id = auth.uid()),
    'padrinos', coalesce((select jsonb_agg(jsonb_build_object(
                            'con', case when exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = case when x.nuevo = auth.uid() then x.padrino else x.nuevo end)
                                        then fbe_privado.comunidad_nombre(case when x.nuevo = auth.uid() then x.padrino else x.nuevo end) else 'Alguien del equipo' end,
                            'soy_padrino', x.padrino = auth.uid(), 'desde', x.desde, 'hasta', x.hasta, 'terminado_en', x.terminado_en) order by x.creado_en)
                          from public.comunidad_padrinos x where auth.uid() in (x.nuevo, x.padrino)), '[]'::jsonb),
    'votos_companero', coalesce((select jsonb_agg(jsonb_build_object('semana', v.semana,
                                   'a', case when exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = v.para) then fbe_privado.comunidad_nombre(v.para) else 'Alguien del equipo' end,
                                   'creado_en', v.creado_en) order by v.semana)
                                 from public.comunidad_votos_semana v where v.de = auth.uid()), '[]'::jsonb),
    'veces_elegido', fbe_privado.comunidad_veces_elegido(auth.uid())
  ) end
$$;

-- ---------------------------------------------------------------------
-- 12. Nadie toca las tablas nuevas directamente; permisos (como al final de 003 a 052)
-- ---------------------------------------------------------------------
revoke all on public.comunidad_duelos, public.comunidad_intenciones, public.comunidad_padrinos, public.comunidad_votos_semana from public, anon;
grant select on public.comunidad_duelos, public.comunidad_intenciones, public.comunidad_padrinos, public.comunidad_votos_semana to authenticated;
revoke insert, update, delete on public.comunidad_duelos, public.comunidad_intenciones, public.comunidad_padrinos, public.comunidad_votos_semana from authenticated;

revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb), public.salud_recibir(text, jsonb), public.calendario_de(text) from public, anon, authenticated;
-- (las del reloj, 052: solo si están; así la 053 vale también en una base que aún no tenga la 052 puesta al día)
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('reloj_estado', 'reloj_serie', 'reloj_saltar', 'reloj_elegir', 'reloj_terminar') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (53)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
