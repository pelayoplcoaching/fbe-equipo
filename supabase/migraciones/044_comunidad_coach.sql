-- =====================================================================
-- FBE Equipo, migración 044 (v0.72): cuarta tanda de mejoras de la comunidad, «para ti como coach»
--   · Eventos y quedadas (comunidad_eventos, comunidad_evento_asistentes): el coach crea un evento (título, día y hora,
--     sitio o enlace, descripción y plazas opcionales), lo cambia o lo cancela. Los de dentro se apuntan («Me apunto» /
--     «No voy», con comunidad_evento_responder()); los nombres de quien va se ven como los de las reacciones. Dos horas antes,
--     crear_recordatorios() avisa a quien va; al cancelarlo, también.
--   · Avisos y encuestas programados (comunidad_posts.publicar_en): hasta su hora no los ve nadie más que el coach (por los
--     permisos de fila: no hace falta ninguna tarea) y, al llegar, crear_recordatorios() manda «Pelayo ha publicado…». El coach
--     los cambia con comunidad_programado_cambiar() o los borra. Plantillas de avisos del coach (comunidad_plantillas, 30).
--   · Panel de la comunidad (comunidad_panel(), solo el coach): recuentos de las 4 últimas semanas, nada de contenido.
--   · Atleta de la semana (comunidad_destacados; comunidad_destacar()): uno a la vez, 7 días, con su aviso; el historial, para el
--     coach. Solo alguien de dentro que sale en el ranking.
--   · Moderación rápida: silenciar 24 h o 7 días (comunidad_miembros.silenciado_hasta; lee y reacciona, no publica ni comenta),
--     palabras filtradas (lo que las lleva queda retenido, comunidad_posts.retenida y comunidad_comentarios.retenido, hasta que el
--     coach lo apruebe; solo lo ve su autor, con «pendiente de revisión») y modo lento (una publicación cada X minutos), en
--     comunidad_moderacion (solo el coach). Todo lo comprueba la base. Lo retenido (y lo programado que aún no ha salido) tampoco
--     avisa de menciones ni cuenta en el resumen de la semana, el del domingo ni los entrenos del perfil; y «Avisar al coach» de
--     un comentario mira si se ve con comunidad_comentario_visible().
-- Lo que se acepta al entrar no cambia (comunidad-2026-11-b): apuntarse es voluntario y lo demás es del coach.
-- Se ejecuta en el SQL Editor después de la 043 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 44 then
    raise exception 'Esta base ya tiene la migración %: repetir la 044 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 44;» y, después de ella, todas las siguientes en orden, todo en la misma consulta del SQL Editor (una sola transacción).';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 43) then
    raise exception 'Antes de la 044 hace falta la 043: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Validadores (nunca dan un error: con algo raro, false)
-- ---------------------------------------------------------------------
-- Un evento: título (1 a 80), sitio o enlace (1 a 300), descripción (hasta 1000) y plazas (1 a 500), todo opcional menos lo primero
create or replace function public.comunidad_evento_valido(p_titulo text, p_lugar text, p_descripcion text, p_plazas integer) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  return coalesce(char_length(p_titulo) between 1 and 80 and public.texto_visible(p_titulo) and p_titulo !~ '[[:cntrl:]]'
    and char_length(p_lugar) between 1 and 300 and public.texto_visible(p_lugar) and p_lugar !~ '[[:cntrl:]]'
    and (p_descripcion is null or (char_length(p_descripcion) between 1 and 1000 and public.texto_visible(p_descripcion)))
    and (p_plazas is null or p_plazas between 1 and 500), false);
exception when others then
  return false;
end $$;

-- Las palabras filtradas (ya normalizadas: minúsculas, sin tildes, letras y cifras separadas por un espacio): hasta 100, de 2 a 40
create or replace function public.comunidad_palabras_validas(p_palabras text[]) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if p_palabras is null then return false; end if;
  if cardinality(p_palabras) = 0 then return true; end if;
  return array_ndims(p_palabras) = 1 and cardinality(p_palabras) <= 100
    and (select bool_and(w is not null and char_length(w) between 2 and 40 and w ~ '^[a-z0-9ñ]+( [a-z0-9ñ]+)*$') from unnest(p_palabras) w);
exception when others then
  return false;
end $$;

-- Un texto, para comparar con las palabras filtradas: minúsculas, sin tildes y solo letras y cifras, separadas por un espacio
create or replace function fbe_privado.comunidad_normal(p text) returns text
language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(translate(lower(coalesce(p, '')), 'áàäâéèëêíìïîóòöôúùüûç', 'aaaaeeeeiiiioooouuuuc'), '[^a-z0-9ñ]+', ' ', 'g'))
$$;

-- ¿Lleva alguna de las palabras filtradas? (palabras enteras: «tonto» no salta con «tontería»)
create or replace function fbe_privado.comunidad_texto_filtrado(p_texto text, p_palabras text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(cardinality(p_palabras), 0) > 0 and p_texto is not null
    and ' ' || fbe_privado.comunidad_normal(p_texto) || ' ' like any (array(select '% ' || w || ' %' from unnest(p_palabras) w where coalesce(w, '') <> ''))
$$;

-- ---------------------------------------------------------------------
-- 2. Columnas y tablas
-- ---------------------------------------------------------------------
-- Eventos y quedadas (los crea el coach; cancelado_en: cancelado, se queda para el historial)
create table if not exists public.comunidad_eventos (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  empieza_en      timestamptz not null,
  lugar           text not null,
  descripcion     text,
  plazas          smallint,
  cancelado_en    timestamptz,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create index if not exists comunidad_eventos_empieza_idx on public.comunidad_eventos (empieza_en);
alter table public.comunidad_eventos drop constraint if exists comunidad_eventos_validos;
alter table public.comunidad_eventos add constraint comunidad_eventos_validos check (public.comunidad_evento_valido(titulo, lugar, descripcion, plazas));

-- Quién va (va = true) o no va (va = false): una fila por persona y evento
create table if not exists public.comunidad_evento_asistentes (
  evento_id  uuid not null references public.comunidad_eventos(id) on delete cascade,
  perfil_id  uuid not null references public.perfiles(id) on delete cascade,
  atleta_id  uuid references public.atletas(id) on delete cascade,
  va         boolean not null,
  creado_en  timestamptz not null default now(),
  primary key (evento_id, perfil_id)
);
create index if not exists comunidad_evento_asistentes_perfil_idx on public.comunidad_evento_asistentes (perfil_id);
create index if not exists comunidad_evento_asistentes_atleta_idx on public.comunidad_evento_asistentes (atleta_id);

-- Avisos y encuestas programados: hasta publicar_en solo los ve el coach. Lo retenido por las palabras filtradas, solo su autor
alter table public.comunidad_posts add column if not exists publicar_en timestamptz;
alter table public.comunidad_posts add column if not exists retenida boolean not null default false;
alter table public.comunidad_comentarios add column if not exists retenido boolean not null default false;
create index if not exists comunidad_posts_publicar_idx on public.comunidad_posts (publicar_en) where publicar_en is not null;
create index if not exists comunidad_posts_retenida_idx on public.comunidad_posts (creado_en) where retenida;
create index if not exists comunidad_comentarios_retenido_idx on public.comunidad_comentarios (creado_en) where retenido;
alter table public.comunidad_posts drop constraint if exists comunidad_posts_044_validos;
alter table public.comunidad_posts add constraint comunidad_posts_044_validos check (
  (publicar_en is null or tipo in ('aviso', 'encuesta')) and not (retenida and tipo in ('aviso', 'encuesta'))
);

-- Las plantillas de avisos del coach (hasta 30)
create table if not exists public.comunidad_plantillas (
  id         uuid primary key default gen_random_uuid(),
  texto      text not null,
  creado_en  timestamptz not null default now()
);
alter table public.comunidad_plantillas drop constraint if exists comunidad_plantillas_validas;
alter table public.comunidad_plantillas add constraint comunidad_plantillas_validas check (char_length(texto) between 1 and 2000 and public.texto_visible(texto));

-- El atleta de la semana: uno a la vez (de desde a hasta, 7 días); las de antes quedan para el coach
create table if not exists public.comunidad_destacados (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null references public.perfiles(id) on delete cascade,
  atleta_id  uuid references public.atletas(id) on delete cascade,
  motivo     text not null,
  desde      timestamptz not null default now(),
  hasta      timestamptz not null default now() + interval '7 days',
  creado_en  timestamptz not null default now()
);
create index if not exists comunidad_destacados_hasta_idx on public.comunidad_destacados (hasta desc);
create index if not exists comunidad_destacados_perfil_idx on public.comunidad_destacados (perfil_id);
create index if not exists comunidad_destacados_atleta_idx on public.comunidad_destacados (atleta_id);
alter table public.comunidad_destacados drop constraint if exists comunidad_destacados_validos;
alter table public.comunidad_destacados add constraint comunidad_destacados_validos check (
  char_length(motivo) between 1 and 140 and public.texto_visible(motivo) and motivo !~ '[[:cntrl:]]' and hasta >= desde
);

-- Silenciar (hasta esa hora no publica ni comenta; lee y reacciona)
alter table public.comunidad_miembros add column if not exists silenciado_hasta timestamptz;

-- Las palabras filtradas y el modo lento (minutos entre dos publicaciones de un atleta; 0, apagado). Una fila, solo el coach
create table if not exists public.comunidad_moderacion (
  id              boolean primary key default true check (id),
  palabras        text[] not null default '{}',
  lento_min       smallint not null default 0,
  actualizado_en  timestamptz not null default now()
);
insert into public.comunidad_moderacion (id) values (true) on conflict (id) do nothing;
alter table public.comunidad_moderacion drop constraint if exists comunidad_moderacion_valida;
alter table public.comunidad_moderacion add constraint comunidad_moderacion_valida check (public.comunidad_palabras_validas(palabras) and lento_min between 0 and 1440);

-- ---------------------------------------------------------------------
-- 3. Quién ve qué (lo de los demás, solo dentro; el coach, todo; lo programado y lo retenido, no)
-- ---------------------------------------------------------------------
-- Una publicación se ve (027) si, además, ya ha llegado su hora y no está retenida (la retenida, su autor sí)
create or replace function public.comunidad_post_visible(p_post uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.comunidad_posts x where x.id = p_post
                 and (public.es_coach() or (not x.oculta and (not x.retenida or x.autor_id = auth.uid()) and (x.publicar_en is null or x.publicar_en <= now())
                                            and public.comunidad_soy_miembro() and public.comunidad_autor_visible(x.autor_id))))
$$;
-- Un comentario (041), igual: el retenido, solo su autor
create or replace function public.comunidad_comentario_visible(p_comentario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.comunidad_comentarios k where k.id = p_comentario
                 and (public.es_coach() or (not k.oculto and (not k.retenido or k.autor_id = auth.uid()) and public.comunidad_soy_miembro()
                      and public.comunidad_autor_visible(k.autor_id) and public.comunidad_post_visible(k.post_id))))
$$;
drop policy if exists miembro_ver on public.comunidad_posts;
create policy miembro_ver on public.comunidad_posts for select to authenticated
  using (not oculta and (not retenida or autor_id = auth.uid()) and (publicar_en is null or publicar_en <= now())
         and public.comunidad_soy_miembro() and public.comunidad_autor_visible(autor_id));
drop policy if exists miembro_ver on public.comunidad_comentarios;
create policy miembro_ver on public.comunidad_comentarios for select to authenticated
  using (not oculto and (not retenido or autor_id = auth.uid()) and public.comunidad_soy_miembro() and public.comunidad_autor_visible(autor_id)
         and public.comunidad_post_visible(post_id));

-- El atleta de la semana: el coach, todos (el historial); dentro, el de ahora, si sigue dentro y sale en el ranking
create or replace function public.comunidad_destacado_visible(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.comunidad_destacados k join fbe_privado.comunidad_dentro d on d.perfil_id = k.perfil_id
                 where k.id = p_id and public.comunidad_soy_miembro() and not d.sin_ranking and now() >= k.desde and now() < k.hasta)
$$;

alter table public.comunidad_eventos enable row level security;
alter table public.comunidad_evento_asistentes enable row level security;
alter table public.comunidad_plantillas enable row level security;
alter table public.comunidad_destacados enable row level security;
alter table public.comunidad_moderacion enable row level security;

drop policy if exists coach_todo on public.comunidad_eventos;
create policy coach_todo on public.comunidad_eventos for all to authenticated using (public.es_coach()) with check (public.es_coach());
drop policy if exists miembro_ver on public.comunidad_eventos;
create policy miembro_ver on public.comunidad_eventos for select to authenticated using (public.comunidad_soy_miembro());

-- Quién va: como las reacciones (los de dentro ven a los de dentro; el coach, a todos). Se apunta con su función
drop policy if exists coach_ver on public.comunidad_evento_asistentes;
create policy coach_ver on public.comunidad_evento_asistentes for select to authenticated using (public.es_coach());
drop policy if exists miembro_ver on public.comunidad_evento_asistentes;
create policy miembro_ver on public.comunidad_evento_asistentes for select to authenticated
  using (public.comunidad_soy_miembro() and public.comunidad_autor_visible(perfil_id));

drop policy if exists coach_todo on public.comunidad_plantillas;
create policy coach_todo on public.comunidad_plantillas for all to authenticated using (public.es_coach()) with check (public.es_coach());

drop policy if exists coach_ver on public.comunidad_destacados;
create policy coach_ver on public.comunidad_destacados for select to authenticated using (public.es_coach());
drop policy if exists miembro_ver on public.comunidad_destacados;
create policy miembro_ver on public.comunidad_destacados for select to authenticated using (public.comunidad_destacado_visible(id));

drop policy if exists coach_ver on public.comunidad_moderacion;
create policy coach_ver on public.comunidad_moderacion for select to authenticated using (public.es_coach());

-- Desde la 019, cada tabla nueva lleva sus permisos a mano. Los eventos y las plantillas, el coach (por sus permisos de fila);
-- quién va, el atleta de la semana y la moderación, solo lectura (se escriben con sus funciones)
revoke all on public.comunidad_eventos, public.comunidad_evento_asistentes, public.comunidad_plantillas, public.comunidad_destacados,
  public.comunidad_moderacion from public, anon, authenticated;
grant select, insert, update, delete on public.comunidad_eventos to authenticated;
grant select on public.comunidad_evento_asistentes to authenticated;
grant select, insert, delete on public.comunidad_plantillas to authenticated;
grant select on public.comunidad_destacados to authenticated;
grant select on public.comunidad_moderacion to authenticated;

-- ---------------------------------------------------------------------
-- 4. Eventos: lo que pone la base, el aviso al cancelar y apuntarse
-- ---------------------------------------------------------------------
-- Las fechas las pone la base; un evento nuevo (o que cambia de hora), más adelante y como mucho a un año; uno cancelado no
-- se descancela
create or replace function public.comunidad_evento_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.creado_en := now();
    new.cancelado_en := null;
  else
    new.creado_en := old.creado_en;
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
drop trigger if exists comunidad_eventos_aa_preparar on public.comunidad_eventos;
create trigger comunidad_eventos_aa_preparar before insert or update on public.comunidad_eventos
  for each row execute function public.comunidad_evento_preparar();

-- Al cancelarlo, a quien iba le llega «Se cancela: …» (sin más); al cancelarlo, borrarlo o cambiarle la hora, el recordatorio
-- pendiente se retira (crear_recordatorios() pone el de la hora nueva)
create or replace function fbe_privado.comunidad_evento_cambiado() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
begin
  if tg_op = 'DELETE' or new.cancelado_en is distinct from old.cancelado_en or new.empieza_en is distinct from old.empieza_en then
    delete from public.notificaciones n where n.estado = 'pendiente' and n.clave like 'comunidad_evento:' || old.id || ':%';
  end if;
  if tg_op = 'UPDATE' and new.cancelado_en is not null and old.cancelado_en is null and new.empieza_en > now() and public.comunidad_activa() then
    perform fbe_privado.notificar_seguro(a.perfil_id, 'comunidad', 'Se cancela: ' || new.titulo, 'Tu coach ha cancelado el evento. Míralo en Equipo.',
              '#equipo', 'comunidad_evento_cancelado:' || new.id, null, new.empieza_en)
    from public.comunidad_evento_asistentes a join fbe_privado.comunidad_dentro d on d.perfil_id = a.perfil_id
    where a.evento_id = new.id and a.va;
  end if;
  return null;
exception when others then
  raise warning 'FBE: avisos del evento % no puestos al día: %', old.id, sqlerrm;
  return null;
end $$;
drop trigger if exists comunidad_eventos_zz_cambiado on public.comunidad_eventos;
create trigger comunidad_eventos_zz_cambiado after update or delete on public.comunidad_eventos
  for each row execute function fbe_privado.comunidad_evento_cambiado();

-- «Me apunto» (p_va = true), «No voy» (false) o quitar la respuesta (null). Solo quien está dentro, en un evento que no está
-- cancelado ni ha empezado, y con plazas (cuentan los de dentro que van). Devuelve cómo queda.
create or replace function public.comunidad_evento_responder(p_evento uuid, p_va boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  e public.comunidad_eventos;
begin
  if v_uid is null or not public.comunidad_soy_miembro() then
    raise exception 'Para apuntarte tienes que estar en la comunidad' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('comunidad_evento:' || coalesce(p_evento::text, ''), 0));
  select * into e from public.comunidad_eventos x where x.id = p_evento;
  if not found then raise exception 'Ese evento ya no está' using errcode = '22023'; end if;
  if e.cancelado_en is not null then raise exception 'Ese evento está cancelado' using errcode = '22023'; end if;
  if e.empieza_en <= now() then raise exception 'Ese evento ya ha empezado' using errcode = '22023'; end if;
  if p_va is null then
    delete from public.comunidad_evento_asistentes where evento_id = e.id and perfil_id = v_uid;
  else
    if p_va and e.plazas is not null and (select count(*) from public.comunidad_evento_asistentes a join fbe_privado.comunidad_dentro d on d.perfil_id = a.perfil_id
                                          where a.evento_id = e.id and a.va and a.perfil_id <> v_uid) >= e.plazas then
      raise exception 'No quedan plazas' using errcode = '22023';
    end if;
    insert into public.comunidad_evento_asistentes (evento_id, perfil_id, atleta_id, va) values (e.id, v_uid, public.mi_atleta_id(), p_va)
    on conflict (evento_id, perfil_id) do update set va = excluded.va, creado_en = now();
  end if;
  if p_va is distinct from true then
    delete from public.notificaciones n where n.usuario_id = v_uid and n.estado = 'pendiente' and n.clave like 'comunidad_evento:' || e.id || ':%';
  end if;
  return p_va;
end $$;

-- ---------------------------------------------------------------------
-- 5. Avisos programados y plantillas
-- ---------------------------------------------------------------------
-- Al publicar (después de comunidad_post_preparar, 029, y del tema, 043): lo programado es un aviso o una encuesta del coach,
-- de dentro de 30 s a 90 días; sale en el muro con la fecha de su hora (creado_en) y sin menciones (avisarían antes de tiempo).
-- La encuesta, con el cierre después de publicarla.
create or replace function public.comunidad_post_programar() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_cierre timestamptz;
begin
  if new.publicar_en is not null and new.publicar_en <= now() + interval '30 seconds' then new.publicar_en := null; end if;
  if new.publicar_en is null then return new; end if;
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    raise exception 'Solo el coach programa publicaciones' using errcode = '42501';
  end if;
  if new.tipo not in ('aviso', 'encuesta') then raise exception 'Se programan los avisos y las encuestas' using errcode = '22023'; end if;
  if new.publicar_en > now() + interval '90 days' then raise exception 'Como mucho a 90 días vista' using errcode = '22023'; end if;
  if new.tipo = 'encuesta' then
    begin
      v_cierre := nullif(new.encuesta ->> 'cierre', '')::timestamptz;
    exception when others then
      v_cierre := null;
    end;
    if v_cierre is not null and v_cierre <= new.publicar_en + interval '5 minutes' then
      raise exception 'El cierre de la encuesta, después de publicarla' using errcode = '22023';
    end if;
  end if;
  new.creado_en := new.publicar_en;
  new.menciones := '{}';
  return new;
end $$;
drop trigger if exists comunidad_posts_af_programar on public.comunidad_posts;
create trigger comunidad_posts_af_programar before insert on public.comunidad_posts
  for each row execute function public.comunidad_post_programar();

-- El aviso o la encuesta del coach (029) → a los de dentro, al publicarse; lo programado avisa al llegar su hora (crear_recordatorios)
create or replace function fbe_privado.comunidad_al_avisar() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
begin
  if new.tipo not in ('aviso', 'encuesta') or new.oculta or not public.comunidad_activa() then return null; end if;
  if new.publicar_en is not null and new.publicar_en > now() then return null; end if;
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

-- El coach cambia lo programado (el texto y la hora; sin hora o ya pasada, se publica ya) mientras no ha salido. Devuelve la hora
-- a la que sale.
create or replace function public.comunidad_programado_cambiar(p_post uuid, p_texto text default null, p_publicar_en timestamptz default null)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  x public.comunidad_posts;
  v_texto text;
  v_cuando timestamptz := p_publicar_en;
  v_cierre timestamptz;
begin
  if not public.es_coach() then raise exception 'Lo programado lo cambia el coach' using errcode = '42501'; end if;
  select * into x from public.comunidad_posts k where k.id = p_post for update;
  if not found then raise exception 'Esa publicación ya no está' using errcode = '22023'; end if;
  if x.publicar_en is null or x.publicar_en <= now() then raise exception 'Ya se ha publicado: no se puede cambiar' using errcode = '22023'; end if;
  v_texto := coalesce(nullif(btrim(coalesce(p_texto, '')), ''), x.texto);
  if v_cuando is null or v_cuando <= now() + interval '30 seconds' then v_cuando := now(); end if;
  if v_cuando > now() + interval '90 days' then raise exception 'Como mucho a 90 días vista' using errcode = '22023'; end if;
  if x.tipo = 'encuesta' then
    begin
      v_cierre := nullif(x.encuesta ->> 'cierre', '')::timestamptz;
    exception when others then
      v_cierre := null;
    end;
    if v_cierre is not null and v_cierre <= v_cuando + interval '5 minutes' then
      raise exception 'El cierre de la encuesta, después de publicarla' using errcode = '22023';
    end if;
  end if;
  update public.comunidad_posts set texto = v_texto, publicar_en = v_cuando, creado_en = v_cuando where id = x.id;
  return v_cuando;
end $$;

-- Como mucho 30 plantillas (una a la vez)
create or replace function public.comunidad_plantilla_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('comunidad_plantillas', 0));
  if (select count(*) from public.comunidad_plantillas) >= 30 then
    raise exception 'Como mucho 30 plantillas: borra alguna antes' using errcode = '54000';
  end if;
  new.texto := btrim(new.texto);
  new.creado_en := now();
  return new;
end $$;
drop trigger if exists comunidad_plantillas_aa_preparar on public.comunidad_plantillas;
create trigger comunidad_plantillas_aa_preparar before insert on public.comunidad_plantillas
  for each row execute function public.comunidad_plantilla_preparar();

-- ---------------------------------------------------------------------
-- 6. Moderación rápida (todo en la base)
-- ---------------------------------------------------------------------
-- Antes de publicar o comentar (un atleta; el coach nunca): silenciado, no; con el modo lento, una publicación (las suyas, no
-- los entrenos ni los logros) cada X minutos; con una palabra filtrada, se guarda retenida. Va después de lo de la 027 a la 043.
create or replace function fbe_privado.comunidad_moderar_entrada(p_autor uuid, p_publicacion boolean, p_texto text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_hasta timestamptz;
  m public.comunidad_moderacion;
  v_ultima timestamptz;
begin
  if p_autor is null or exists (select 1 from public.perfiles p where p.id = p_autor and p.rol = 'coach') then return false; end if;
  select k.silenciado_hasta into v_hasta from public.comunidad_miembros k where k.perfil_id = p_autor;
  if v_hasta > now() then
    raise exception 'Tu coach ha pausado tus publicaciones y comentarios hasta el % a las %. Mientras, puedes leer y reaccionar.',
      to_char(v_hasta at time zone 'Europe/Madrid', 'FMDD/FMMM'), to_char(v_hasta at time zone 'Europe/Madrid', 'HH24:MI') using errcode = '42501';
  end if;
  select * into m from public.comunidad_moderacion where id;
  if p_publicacion and coalesce(m.lento_min, 0) > 0 then
    perform pg_advisory_xact_lock(hashtextextended('comunidad_lento:' || p_autor, 0));
    select max(x.creado_en) into v_ultima from public.comunidad_posts x where x.autor_id = p_autor and x.tipo = 'post';
    if v_ultima > now() - make_interval(mins => m.lento_min) then
      raise exception 'Modo lento: una publicación cada % minutos. Podrás volver a publicar a las %.', m.lento_min,
        to_char((v_ultima + make_interval(mins => m.lento_min)) at time zone 'Europe/Madrid', 'HH24:MI') using errcode = '54000';
    end if;
  end if;
  return fbe_privado.comunidad_texto_filtrado(p_texto, m.palabras);
end $$;
create or replace function fbe_privado.comunidad_post_moderar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.retenida := new.tipo not in ('aviso', 'encuesta') and fbe_privado.comunidad_moderar_entrada(new.autor_id, new.tipo = 'post', new.texto);
  return new;
end $$;
drop trigger if exists comunidad_posts_ag_moderar on public.comunidad_posts;
create trigger comunidad_posts_ag_moderar before insert on public.comunidad_posts
  for each row execute function fbe_privado.comunidad_post_moderar();
create or replace function fbe_privado.comunidad_comentario_moderar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.retenido := fbe_privado.comunidad_moderar_entrada(new.autor_id, false, new.texto);
  return new;
end $$;
drop trigger if exists comunidad_comentarios_ag_moderar on public.comunidad_comentarios;
create trigger comunidad_comentarios_ag_moderar before insert on public.comunidad_comentarios
  for each row execute function fbe_privado.comunidad_comentario_moderar();

-- Lo retenido no avisa a nadie: se retiran los avisos que acaba de crear (los de esta misma transacción: la pregunta al coach,
-- el comentario a quien publicó, la respuesta y las menciones). Al aprobarlo no se mandan.
create or replace function fbe_privado.comunidad_al_retener() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  v_post uuid := case when tg_table_name = 'comunidad_posts' then new.id else (to_jsonb(new) ->> 'post_id')::uuid end;
begin
  if not coalesce((to_jsonb(new) ->> case when tg_table_name = 'comunidad_posts' then 'retenida' else 'retenido' end)::boolean, false) then return null; end if;
  delete from public.notificaciones n
  where n.estado = 'pendiente' and n.creado_en = now()
    and (n.clave like 'comunidad:' || v_post || ':%' or n.clave like 'comunidad_mencion:' || replace(new.id::text, '-', '') || ':%');
  return null;
exception when others then
  raise warning 'FBE: avisos de lo retenido % no retirados: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists comunidad_posts_zzz_retener on public.comunidad_posts;
create trigger comunidad_posts_zzz_retener after insert on public.comunidad_posts
  for each row execute function fbe_privado.comunidad_al_retener();
drop trigger if exists comunidad_comentarios_zzz_retener on public.comunidad_comentarios;
create trigger comunidad_comentarios_zzz_retener after insert on public.comunidad_comentarios
  for each row execute function fbe_privado.comunidad_al_retener();

-- El coach silencia a alguien de dentro p_horas (24 o 168; 0 o null: quita el silencio). Devuelve hasta cuándo.
create or replace function public.comunidad_silenciar(p_perfil uuid, p_horas integer) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_hasta timestamptz := case when coalesce(p_horas, 0) <= 0 then null else now() + make_interval(hours => least(p_horas, 24 * 30)) end;
begin
  if not public.es_coach() then raise exception 'Silenciar es cosa del coach' using errcode = '42501'; end if;
  update public.comunidad_miembros set silenciado_hasta = v_hasta where perfil_id = p_perfil;
  if not found then raise exception 'Esa persona no ha entrado en la comunidad' using errcode = '22023'; end if;
  return v_hasta;
end $$;

-- El coach guarda las palabras filtradas (se normalizan: minúsculas, sin tildes; sin repetir; las de una letra, fuera) y el modo
-- lento (minutos)
create or replace function public.comunidad_moderacion_guardar(p_palabras text[], p_lento integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v text[];
begin
  if not public.es_coach() then raise exception 'La moderación es cosa del coach' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct w order by w), '{}') into v
  from (select fbe_privado.comunidad_normal(x) w from unnest(coalesce(p_palabras, '{}'::text[])) x) s where char_length(w) >= 2;
  if not public.comunidad_palabras_validas(v) then
    raise exception 'Hasta 100 palabras, de 2 a 40 letras cada una' using errcode = '22023';
  end if;
  if coalesce(p_lento, 0) not between 0 and 1440 then raise exception 'El modo lento, de 0 a 1440 minutos' using errcode = '22023'; end if;
  update public.comunidad_moderacion set palabras = v, lento_min = coalesce(p_lento, 0), actualizado_en = now() where id;
end $$;

-- El coach aprueba lo retenido (una publicación o un comentario): pasa a verse (sin avisos). Para rechazarlo, lo borra.
create or replace function public.comunidad_aprobar(p_post uuid default null, p_comentario uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Aprobar es cosa del coach' using errcode = '42501'; end if;
  if p_comentario is not null then
    update public.comunidad_comentarios set retenido = false where id = p_comentario;
  else
    update public.comunidad_posts set retenida = false where id = p_post;
  end if;
  if not found then raise exception 'Ya no está' using errcode = '22023'; end if;
end $$;

-- ---------------------------------------------------------------------
-- 7. El atleta de la semana
-- ---------------------------------------------------------------------
-- El coach elige a alguien de dentro (que sale en el ranking) con una línea (hasta 140): el de antes termina, y al elegido le
-- llega un aviso (sin la línea). Devuelve el nuevo.
create or replace function public.comunidad_destacar(p_perfil uuid, p_motivo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_motivo text := btrim(regexp_replace(coalesce(p_motivo, ''), '[[:space:][:cntrl:]]+', ' ', 'g'));
  d record;
  v_id uuid;
begin
  if not public.es_coach() then raise exception 'El atleta de la semana lo elige el coach' using errcode = '42501'; end if;
  if char_length(v_motivo) not between 1 and 140 or not public.texto_visible(v_motivo) then
    raise exception 'Escribe por qué, en una línea (hasta 140 letras)' using errcode = '22023';
  end if;
  select k.perfil_id, k.atleta_id, k.sin_ranking into d from fbe_privado.comunidad_dentro k where k.perfil_id = p_perfil;
  if not found then raise exception 'Esa persona no está en la comunidad' using errcode = '22023'; end if;
  if d.sin_ranking then raise exception 'Ha elegido no salir en el ranking: elige a otra persona' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('comunidad_destacados', 0));
  update public.comunidad_destacados set hasta = greatest(desde, now()) where hasta > now();
  insert into public.comunidad_destacados (perfil_id, atleta_id, motivo) values (d.perfil_id, d.atleta_id, v_motivo) returning id into v_id;
  if public.comunidad_activa() then
    perform fbe_privado.notificar_seguro(d.perfil_id, 'comunidad', '¡Eres el atleta de la semana! 🏅', 'Tu coach te ha elegido. Míralo en Equipo.',
              '#equipo', 'comunidad_destacado:' || v_id);
  end if;
  return v_id;
end $$;
-- El coach lo quita antes de tiempo
create or replace function public.comunidad_destacado_quitar() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'El atleta de la semana lo elige el coach' using errcode = '42501'; end if;
  update public.comunidad_destacados set hasta = greatest(desde, now()) where hasta > now();
end $$;

-- ---------------------------------------------------------------------
-- 8. El panel de la comunidad (solo el coach): recuentos, nada de contenido
-- ---------------------------------------------------------------------
-- Las 4 últimas semanas (de lunes a domingo, Madrid; la de ahora, la última): quién ha estado activo (publicar, comentar o
-- reaccionar), cuántas publicaciones, reacciones y comentarios de los atletas; los de dentro; quién no ha entrado nunca; quién ha
-- entrado y lleva 30 días sin publicar, comentar ni reaccionar; los avisos sin resolver, lo retenido y los más activos (28 días).
create or replace function public.comunidad_panel() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_lunes date := fbe_privado.comunidad_lunes();
begin
  if not public.es_coach() then raise exception 'El panel de la comunidad es del coach' using errcode = '42501'; end if;
  return (
    with act as materialized (
      select x.autor_id as perfil_id, x.creado_en, 'p' as k from public.comunidad_posts x
      where x.creado_en >= now() - interval '35 days' and x.creado_en <= now() and x.atleta_id is not null
      union all
      select c.autor_id, c.creado_en, 'c' from public.comunidad_comentarios c where c.creado_en >= now() - interval '35 days' and c.atleta_id is not null
      union all
      select r.autor_id, r.creado_en, 'r' from public.comunidad_reacciones r where r.creado_en >= now() - interval '35 days' and r.atleta_id is not null
    ), sem as (
      select (v_lunes - 7 * g)::date as lunes from generate_series(0, 3) g
    )
    select jsonb_build_object(
      'semanas', (select jsonb_agg(jsonb_build_object('lunes', s.lunes,
                    'activos', (select count(distinct a.perfil_id) from act a where (a.creado_en at time zone 'Europe/Madrid')::date between s.lunes and s.lunes + 6),
                    'publicaciones', (select count(*) from act a where a.k = 'p' and (a.creado_en at time zone 'Europe/Madrid')::date between s.lunes and s.lunes + 6),
                    'reacciones', (select count(*) from act a where a.k = 'r' and (a.creado_en at time zone 'Europe/Madrid')::date between s.lunes and s.lunes + 6),
                    'comentarios', (select count(*) from act a where a.k = 'c' and (a.creado_en at time zone 'Europe/Madrid')::date between s.lunes and s.lunes + 6))
                  order by s.lunes) from sem s),
      'miembros', (select count(*) from fbe_privado.comunidad_dentro),
      'nunca', coalesce((select jsonb_agg(jsonb_build_object('atleta_id', a.id, 'nombre', a.nombre) order by a.nombre)
                         from public.atletas a join public.perfiles p on p.id = a.perfil_id
                         where a.estado <> 'baja' and p.rol <> 'coach' and not exists (select 1 from public.comunidad_miembros m where m.atleta_id = a.id)), '[]'::jsonb),
      'inactivos', coalesce((select jsonb_agg(jsonb_build_object('perfil_id', d.perfil_id, 'nombre', d.nombre, 'sin_ranking', d.sin_ranking,
                                 'ultima', (select max(z.creado_en) from (select x.creado_en from public.comunidad_posts x where x.autor_id = d.perfil_id
                                            union all select c.creado_en from public.comunidad_comentarios c where c.autor_id = d.perfil_id
                                            union all select r.creado_en from public.comunidad_reacciones r where r.autor_id = d.perfil_id) z)) order by d.nombre)
                             from fbe_privado.comunidad_dentro d
                             where not exists (select 1 from public.comunidad_posts x where x.autor_id = d.perfil_id and x.creado_en > now() - interval '30 days')
                               and not exists (select 1 from public.comunidad_comentarios c where c.autor_id = d.perfil_id and c.creado_en > now() - interval '30 days')
                               and not exists (select 1 from public.comunidad_reacciones r where r.autor_id = d.perfil_id and r.creado_en > now() - interval '30 days')), '[]'::jsonb),
      'reportes', (select count(*) from public.comunidad_reportes r where r.resuelto_en is null),
      'retenidos', (select count(*) from public.comunidad_posts x where x.retenida) + (select count(*) from public.comunidad_comentarios c where c.retenido),
      'activos', coalesce((select jsonb_agg(jsonb_build_object('perfil_id', t.perfil_id, 'nombre', t.nombre, 'sin_ranking', t.sin_ranking, 'publicaciones', t.p, 'comentarios', t.c, 'reacciones', t.r, 'total', t.p + t.c + t.r)
                                            order by t.p + t.c + t.r desc, t.nombre)
                           from (select d.perfil_id, d.nombre, d.sin_ranking,
                                        count(*) filter (where a.k = 'p') p, count(*) filter (where a.k = 'c') c, count(*) filter (where a.k = 'r') r
                                 from fbe_privado.comunidad_dentro d join act a on a.perfil_id = d.perfil_id
                                 where a.creado_en > now() - interval '28 days'
                                 group by d.perfil_id, d.nombre, d.sin_ranking
                                 order by count(*) desc, d.nombre limit 5) t), '[]'::jsonb)
    )
  );
end $$;

-- ---------------------------------------------------------------------
-- 8b. (revisión) Lo retenido y lo programado tampoco cuentan ni avisan en lo de antes
-- ---------------------------------------------------------------------
-- Las menciones (029): no en un comentario retenido ni en lo que cuelga de una publicación retenida o programada que aún no ha
-- salido (avisarían de algo que no se ve, o antes de tiempo)
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
    if coalesce((to_jsonb(new) ->> 'retenido')::boolean, false) then return null; end if;
  else
    v_post := new.id;
  end if;
  v_objeto := replace(new.id::text, '-', '');
  select x.autor_id into v_autor_post from public.comunidad_posts x where x.id = v_post and not x.oculta
    and not x.retenida and (x.publicar_en is null or x.publicar_en <= now());
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

-- El resumen de la semana (029) y el del domingo (041): los récords de un entreno retenido no cuentan
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
     where p.tipo = 'entreno' and not p.oculta and not p.retenida and p.autor_id in (select c.perfil_id from cuentan c)
       and (p.creado_en at time zone 'Europe/Madrid')::date between (select l.d from lunes l) and (select l.d from lunes l) + 6
       and coalesce((e.v ->> 'record')::boolean, false)),
    (select count(*)::integer from public.comunidad_retos r where (now() at time zone 'Europe/Madrid')::date between r.desde and r.hasta)
  where public.es_coach() or public.comunidad_soy_miembro()
$$;

create or replace function fbe_privado.comunidad_resumen_de_la_semana()
returns table (sesiones integer, semana_completa integer, miembros integer, records integer, retos integer)
language sql stable security definer set search_path = '' as $$
  with lunes as (
    select fbe_privado.comunidad_lunes() as d
  ), cuentan as (
    select d.atleta_id, d.perfil_id from fbe_privado.comunidad_dentro d where not d.sin_ranking
  )
  select
    (select count(*)::integer from fbe_privado.comunidad_sesiones_validas(array(select c.atleta_id from cuentan c)) v
     where v.fecha between (select l.d from lunes l) and (select l.d from lunes l) + 6),
    (select count(*)::integer from fbe_privado.comunidad_semanas_de(array(select c.atleta_id from cuentan c)) x
     where x.lunes = (select l.d from lunes l) and x.hechas >= x.previstas),
    (select count(*)::integer from cuentan),
    (select count(*)::integer from public.comunidad_posts p
       cross join lateral jsonb_array_elements(case when jsonb_typeof(p.resumen -> 'ejercicios') = 'array' then p.resumen -> 'ejercicios' else '[]'::jsonb end) as e(v)
     where p.tipo = 'entreno' and not p.oculta and not p.retenida and p.autor_id in (select c.perfil_id from cuentan c)
       and (p.creado_en at time zone 'Europe/Madrid')::date between (select l.d from lunes l) and (select l.d from lunes l) + 6
       and coalesce((e.v ->> 'record')::boolean, false)),
    (select count(*)::integer from public.comunidad_retos r where (now() at time zone 'Europe/Madrid')::date between r.desde and r.hasta)
$$;

-- El perfil del equipo (029): los entrenos retenidos no cuentan para los demás
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
    (select count(*)::integer from public.comunidad_posts x where x.autor_id = p_perfil and x.tipo = 'entreno' and (public.es_coach() or (not x.oculta and not x.retenida))),
    p_perfil = auth.uid();
end $$;

-- «Avisar al coach» (043): de un comentario que se ve (con comunidad_comentario_visible: el retenido de otro, no)
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
    where k.id = p_comentario and not k.oculto and public.comunidad_comentario_visible(k.id);
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
  insert into public.comunidad_reportes (post_id, comentario_id, autor_id, motivo, de_comentario, copia_tipo, copia_texto, copia_foto, copia_fotos,
                                         copia_autor_id, copia_autor_nombre, copia_atleta_id, copia_creado_en)
  values (x.id, p_comentario, v_uid, v_motivo, p_comentario is not null,
          case when p_comentario is not null then 'comentario' else x.tipo end,
          left(case when p_comentario is not null then c.texto
                    when x.tipo = 'entreno' then concat_ws(': ', 'Entreno compartido', x.resumen ->> 'nombre', x.texto)
                    when x.tipo = 'logro' then concat_ws(': ', 'Logro', x.resumen ->> 'titulo', x.texto)
                    else x.texto end, 2000),
          case when p_comentario is null then x.foto_ruta end,
          case when p_comentario is null then x.fotos end,
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

-- ---------------------------------------------------------------------
-- 9. Salir y descargar mis datos (043), con lo nuevo
-- ---------------------------------------------------------------------
-- Salir (043): con p_borrar, también sus respuestas a los eventos
create or replace function public.comunidad_salir(p_borrar boolean default false) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_fotos text[] := '{}';
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión' using errcode = '42501'; end if;
  update public.comunidad_miembros set salido_en = now() where perfil_id = v_uid and salido_en is null;
  delete from public.comunidad_companeros where de = v_uid or para = v_uid;
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
    delete from public.comunidad_comentarios where autor_id = v_uid;
    delete from public.comunidad_posts where autor_id = v_uid;
  end if;
  return v_fotos;
end $$;

-- Todo lo suyo (043), también sus respuestas a los eventos y las veces que ha sido atleta de la semana
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
                                        then jsonb_build_object('para', a.para, 'para_nombre', fbe_privado.comunidad_nombre(a.para), 'semana', a.semana, 'creado_en', a.creado_en)
                                        else jsonb_build_object('para_nombre', 'Alguien del equipo', 'semana', a.semana, 'creado_en', a.creado_en) end
                                   order by a.creado_en)
                                 from public.comunidad_animos a where a.de = auth.uid()), '[]'::jsonb),
    'animos_recibidos', coalesce((select jsonb_agg(jsonb_build_object('semana', a.semana, 'creado_en', a.creado_en) order by a.creado_en)
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
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('evento', e.titulo, 'empieza_en', e.empieza_en, 'va', a.va, 'creado_en', a.creado_en) order by a.creado_en)
                         from public.comunidad_evento_asistentes a join public.comunidad_eventos e on e.id = a.evento_id where a.perfil_id = auth.uid()), '[]'::jsonb),
    'atleta_de_la_semana', coalesce((select jsonb_agg(jsonb_build_object('motivo', k.motivo, 'desde', k.desde, 'hasta', k.hasta) order by k.desde)
                                     from public.comunidad_destacados k where k.perfil_id = auth.uid()), '[]'::jsonb),
    'avisos_al_coach', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'post_id', r.post_id, 'comentario_id', r.comentario_id, 'motivo', r.motivo,
                                   'creado_en', r.creado_en, 'resuelto_en', r.resuelto_en) order by r.creado_en)
                                 from public.comunidad_reportes r where r.autor_id = auth.uid()), '[]'::jsonb)
  ) end
$$;

-- ---------------------------------------------------------------------
-- 10. Los recordatorios: lo de la 042 (con cada bloque a prueba de fallos), más el recordatorio de los eventos (dos horas antes,
--     a quien va) y el aviso de lo programado al llegar su hora («Pelayo ha publicado un aviso en el equipo»), cada uno en su
--     propio bloque
-- ---------------------------------------------------------------------
create or replace function public.crear_recordatorios(p_ahora timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_local timestamp := p_ahora at time zone 'Europe/Madrid';
  v_hoy date := (p_ahora at time zone 'Europe/Madrid')::date;
  v_dow integer := extract(isodow from (p_ahora at time zone 'Europe/Madrid'))::integer;
  v_lunes date;
  v_n integer := 0;
  v_m integer;
  v_titulo text;
  v_cuerpo text;
begin
  perform fbe_privado.solo_servidor();
  v_lunes := v_hoy - (v_dow - 1);

  -- Hoy toca… (solo si planificó el día de la sesión en «Tu plan»). Cada consulta elige primero a quién
  -- (materialized: así la notificación solo se crea para esas filas, sin depender del orden del WHERE)
  with x as materialized (
    select d.perfil_id, d.hora_manana, count(*) as n, min(s.nombre) as nombre
    from fbe_privado.destinatarios d
    join public.atletas a on a.id = d.atleta_id and a.entrenamiento
    join public.bloques b on b.atleta_id = d.atleta_id and not b.es_plantilla and b.estado not in ('cancelado', 'finalizado')
    join public.semanas w on w.bloque_id = b.id and w.programacion = 'programada'
    join public.sesiones s on s.semana_id = w.id and s.dia_previsto = v_hoy and not s.completada
    where not ('sesion_hoy' = any (d.desactivados))
      and v_local >= v_hoy + d.hora_manana and v_local < v_hoy + d.hora_manana + interval '2 hours'
    group by d.perfil_id, d.hora_manana
  )
  select count(*) into v_m from x
  where fbe_privado.notificar_seguro(x.perfil_id, 'sesion_hoy',
          case when x.n = 1 then 'Hoy toca ' || x.nombre else 'Hoy tienes ' || x.n || ' sesiones' end,
          case when x.n = 1 then 'La tienes en Hoy.' else 'Las tienes en Hoy.' end,
          '#hoy', 'recordatorio_sesion:' || v_hoy, p_ahora,
          (v_hoy + x.hora_manana + interval '4 hours') at time zone 'Europe/Madrid');
  v_n := v_n + v_m;

  -- El check-in de la semana (el lunes, el de la semana que acaba de terminar, como en la app)
  with d as materialized (
    select d.perfil_id, d.hora_tarde from fbe_privado.destinatarios d
    where d.salud and not ('checkin' = any (d.desactivados)) and d.dia_checkin = v_dow
      and v_local >= v_hoy + d.hora_tarde and v_local < v_hoy + d.hora_tarde + interval '2 hours'
      and not exists (select 1 from public.checkins c
                      where c.atleta_id = d.atleta_id and c.semana_inicio = case when v_dow = 1 then v_lunes - 7 else v_lunes end)
  )
  select count(*) into v_m from d
  where fbe_privado.notificar_seguro(d.perfil_id, 'checkin', '¿Haces el check-in?',
          case when v_dow = 1 then 'El de la semana pasada aún está pendiente.' else 'El de esta semana aún está pendiente.' end,
          '#checkin', 'recordatorio_checkin:' || v_hoy, p_ahora,
          (v_hoy + d.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
  v_n := v_n + v_m;

  -- Por la tarde, una sola: los hábitos que hoy le hacen falta (los diarios sin apuntar y los de x días a la
  -- semana que ya no llegan si se salta hoy) y la nutrición sin apuntar (si tiene plan)
  with x as materialized (
    select * from (
    select d.perfil_id, d.hora_tarde,
      case when 'habitos' = any (d.desactivados) then 0 else (
        select count(*) from public.habitos h
        where h.atleta_id = d.atleta_id and h.activo
          and not exists (select 1 from public.registros_habito r where r.habito_id = h.id and r.fecha = v_hoy)
          and h.dias_semana - (
            select count(*) from public.registros_habito r
            where r.habito_id = h.id and r.fecha >= v_lunes and r.fecha < v_hoy
              and case when h.tipo = 'si_no' then r.valor >= 1
                       when h.sentido = 'al_menos' then r.valor >= h.objetivo
                       else r.valor <= h.objetivo end
          ) >= 8 - v_dow
      ) end as habitos,
      not ('nutricion' = any (d.desactivados))
        and exists (select 1 from public.planes_nutricion pn where pn.atleta_id = d.atleta_id and pn.desde <= v_hoy)
        and exists (select 1 from public.atletas a where a.id = d.atleta_id and a.nutricion)
        and not exists (select 1 from public.registros_nutricion rn where rn.atleta_id = d.atleta_id and rn.fecha = v_hoy) as nutricion
    from fbe_privado.destinatarios d
    where d.salud and v_local >= v_hoy + d.hora_tarde and v_local < v_hoy + d.hora_tarde + interval '2 hours'
    ) y
    where y.habitos > 0 or y.nutricion
  )
  select count(*) into v_m from x
  where fbe_privado.notificar_seguro(x.perfil_id, case when x.habitos > 0 then 'habitos' else 'nutricion' end,
          case when x.habitos > 0 and x.nutricion then
                 case when x.habitos = 1 then 'Te queda un hábito y la nutrición de hoy' else 'Te quedan ' || x.habitos || ' hábitos y la nutrición de hoy' end
               when x.habitos = 1 then 'Te queda un hábito de hoy'
               when x.habitos > 1 then 'Te quedan ' || x.habitos || ' hábitos de hoy'
               else '¿Apuntas lo que has comido hoy?' end,
          case when x.habitos > 0 then 'Apúntalo en Hoy antes de que acabe el día.' else 'Aún no has apuntado la nutrición de hoy.' end,
          '#hoy', 'recordatorio_tarde:' || v_hoy, p_ahora,
          (v_hoy + x.hora_tarde + interval '4 hours') at time zone 'Europe/Madrid');
  v_n := v_n + v_m;

  -- (v0.69, 041) El domingo por la tarde, el resumen de la semana del equipo (una vez: la clave lleva el día)
  -- (revisión) en su propio bloque: si algo falla aquí, no se pierden los demás recordatorios de esa pasada
  begin
  if v_dow = 7 and v_local >= v_hoy + time '19:00' and v_local < v_hoy + time '22:00' and public.comunidad_activa() then
    select t.titulo, t.cuerpo into v_titulo, v_cuerpo
    from fbe_privado.comunidad_resumen_de_la_semana() r
    cross join lateral public.comunidad_texto_resumen(r.sesiones, r.records, r.semana_completa) t;
    if v_titulo is not null then
      with x as materialized (
        select d.perfil_id from fbe_privado.comunidad_dentro d
        union
        select p.id from public.perfiles p where p.rol = 'coach'
      )
      select count(*) into v_m from x
      where fbe_privado.notificar_seguro(x.perfil_id, 'comunidad', v_titulo, v_cuerpo, '#equipo', 'comunidad_resumen:' || v_hoy, p_ahora,
              (v_hoy + time '23:00') at time zone 'Europe/Madrid');
      v_n := v_n + v_m;
    end if;
  end if;
  exception when others then
    raise warning 'FBE: resumen del domingo no creado: %', sqlerrm;
  end;

  -- (v0.70, 042) El sábado por la tarde, a quien aún no ha completado su semana y su compañero de racha sí (también en su
  -- propio bloque: si falla, los demás recordatorios se crean igual)
  begin
  if v_dow = 6 and v_local >= v_hoy + time '19:00' and v_local < v_hoy + time '22:00' and public.comunidad_activa() then
    with sem as materialized (
      select x.atleta_id, x.hechas >= x.previstas as completa
      from fbe_privado.comunidad_semanas_de(array(select d.atleta_id from fbe_privado.comunidad_dentro d
                                                  where exists (select 1 from public.comunidad_companeros c where c.estado = 'aceptada' and d.perfil_id in (c.de, c.para)))) x
      where x.lunes = v_lunes
    ), x as materialized (
      select c.id, a.perfil_id as falta, b.perfil_id as hecho
      from public.comunidad_companeros c
      join fbe_privado.comunidad_dentro a on a.perfil_id in (c.de, c.para)
      join fbe_privado.comunidad_dentro b on b.perfil_id in (c.de, c.para) and b.perfil_id <> a.perfil_id
      join sem sa on sa.atleta_id = a.atleta_id and not sa.completa
      join sem sb on sb.atleta_id = b.atleta_id and sb.completa
      where c.estado = 'aceptada'
        -- (a uno solo de los dos por pareja y semana)
        and not exists (select 1 from public.notificaciones n where n.clave = 'comunidad_pareja:' || c.id || ':' || v_lunes)
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.falta, 'comunidad', fbe_privado.comunidad_nombre(x.hecho) || ' ya ha completado su semana: ¿cerráis la racha?',
            'Míralo en Equipo.', '#equipo', 'comunidad_pareja:' || x.id || ':' || v_lunes, p_ahora,
            (v_hoy + 1 + time '22:00') at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  end if;
  exception when others then
    raise warning 'FBE: aviso del sábado a las parejas no creado: %', sqlerrm;
  end;
  -- (v0.72, 044) Dos horas antes de un evento, a quien va (y sigue dentro): «A las 19:00: Quedada en el Retiro». Una vez por
  -- persona, evento y hora (si cambia la hora, otro); caduca al empezar. En su propio bloque, como los dos de antes
  begin
  if public.comunidad_activa() then
    with x as materialized (
      select a.perfil_id, e.id, e.titulo, e.empieza_en
      from public.comunidad_eventos e
      join public.comunidad_evento_asistentes a on a.evento_id = e.id and a.va
      join fbe_privado.comunidad_dentro d on d.perfil_id = a.perfil_id
      where e.cancelado_en is null and e.empieza_en > p_ahora and e.empieza_en <= p_ahora + interval '2 hours'
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.perfil_id, 'comunidad', 'A las ' || to_char(x.empieza_en at time zone 'Europe/Madrid', 'FMHH24:MI') || ': ' || x.titulo,
            'Te has apuntado. Míralo en Equipo.', '#equipo', 'comunidad_evento:' || x.id || ':' || floor(extract(epoch from x.empieza_en))::bigint, p_ahora, x.empieza_en);
    v_n := v_n + v_m;
  end if;
  exception when others then
    raise warning 'FBE: recordatorio de los eventos no creado: %', sqlerrm;
  end;

  -- (v0.72, 044) Un aviso o una encuesta programados, al llegar su hora (en el último día): a los de dentro, como al publicarlo
  -- (029), con la misma clave (si se oculta o se borra antes de salir, se retira). En su propio bloque
  begin
  if public.comunidad_activa() then
    with x as materialized (
      select k.id, k.tipo, d.perfil_id,
             coalesce(fbe_privado.nombre_corto((select p.nombre from public.perfiles p where p.id = k.autor_id)), 'Tu coach') as quien
      from public.comunidad_posts k
      join fbe_privado.comunidad_dentro d on d.perfil_id <> k.autor_id
      join public.comunidad_miembros m on m.atleta_id = d.atleta_id
      where k.publicar_en is not null
        -- (solo a quien ya estaba dentro cuando salió: a quien entra después no le llega un aviso de ayer)
        and coalesce(m.entrado_en, m.creado_en) <= k.publicar_en and k.publicar_en <= p_ahora and k.publicar_en > p_ahora - interval '1 day'
        and k.tipo in ('aviso', 'encuesta') and not k.oculta
        and not exists (select 1 from public.notificaciones n where n.usuario_id = d.perfil_id and n.clave = 'comunidad_aviso:' || k.id)
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.perfil_id, 'comunidad',
            x.quien || case when x.tipo = 'encuesta' then ' ha publicado una encuesta en el equipo' else ' ha publicado un aviso en el equipo' end,
            case when x.tipo = 'encuesta' then 'Tócalo para votar en Equipo.' else 'Tócalo para leerlo en Equipo.' end,
            '#equipo', 'comunidad_aviso:' || x.id, p_ahora);
    v_n := v_n + v_m;
  end if;
  exception when others then
    raise warning 'FBE: aviso de lo programado no creado: %', sqlerrm;
  end;

  return v_n;
end $$;

-- Permisos (como al final de 003 a 043)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (44)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
