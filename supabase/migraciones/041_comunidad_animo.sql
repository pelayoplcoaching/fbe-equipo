-- =====================================================================
-- FBE Equipo, migración 041 (v0.69): primera tanda de mejoras de la comunidad
--   · Bienvenida a los nuevos: comunidad_nuevos() da quién ha entrado por primera vez en los últimos 7 días (solo de quien
--     está dentro de verdad, nunca uno mismo) y si ya le has dado la bienvenida; comunidad_dar_bienvenida() la da (una vez
--     por persona, en su primera semana) con un aviso «Rubén M. te da la bienvenida 👋». Se guardan en comunidad_bienvenidas
--     (se ven como los ánimos: las que das y las que recibes).
--   · Entrenando ahora: comunidad_miembros.ver_entrenando («Que el equipo vea cuándo estoy entrenando», apagado de entrada;
--     se cambia con comunidad_entrenando_visible()) y comunidad_entrenando_ahora(): quién lo ha encendido y ha apuntado una
--     serie de una sesión sin terminar en los últimos 20 minutos. Solo nombre y foto: ni horas ni nada de la sesión. El
--     «🙌» de la app es el ánimo de siempre (comunidad_animar, 029).
--   · Responder a un comentario: comunidad_comentarios.responde_a (un nivel: responder a una respuesta cuelga del mismo
--     comentario). La base comprueba que el comentario es de esa publicación y que quien responde lo ve; avisa a su autor
--     («… ha respondido a tu comentario», una por publicación y hora, como los comentarios).
--   · 💪 a un comentario: comunidad_comentario_reacciones (una por persona y comentario), con comunidad_reaccionar_comentario().
--   · El resumen del domingo: crear_recordatorios() manda el domingo por la tarde (de 19:00 a 22:00, hora de Madrid) una
--     notificación «Esta semana en el equipo: 42 sesiones, 3 récords» con los recuentos de comunidad_resumen_semana() (029),
--     con la preferencia «Equipo» de siempre, a los que están dentro y al coach.
--   · Salir y borrar se lleva también las bienvenidas y los 💪 a comentarios; «Descargar mis datos» los lleva.
-- Lo que se acepta al entrar no cambia (comunidad-2026-11-b): «entrenando ahora» es voluntario y está apagado de entrada.
-- Se ejecuta en el SQL Editor después de la 040 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 41 then
    raise exception 'Esta base ya tiene la migración %: repetir la 041 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 41;» y, después de ella, todas las siguientes en orden, todo en la misma consulta del SQL Editor (una sola transacción).';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 40) then
    raise exception 'Antes de la 041 hace falta la 040: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Columnas y tablas
-- ---------------------------------------------------------------------
alter table public.comunidad_miembros add column if not exists ver_entrenando boolean not null default false;
-- (revisión) se apaga al salir, al ser sacado o bloqueado: al volver, empieza apagado otra vez (hay que encenderlo de nuevo)
create or replace function public.comunidad_miembro_apagar_entrenando() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.salido_en is not null and old.salido_en is null) or (new.bloqueado and not old.bloqueado) then new.ver_entrenando := false; end if;
  return new;
end $$;
drop trigger if exists comunidad_miembro_apagar_entrenando on public.comunidad_miembros;
create trigger comunidad_miembro_apagar_entrenando before update of salido_en, bloqueado on public.comunidad_miembros
  for each row execute function public.comunidad_miembro_apagar_entrenando();
update public.comunidad_miembros set ver_entrenando = false where ver_entrenando and (salido_en is not null or bloqueado);

alter table public.comunidad_comentarios add column if not exists responde_a uuid references public.comunidad_comentarios(id) on delete set null;
create index if not exists comunidad_comentarios_responde_idx on public.comunidad_comentarios (responde_a);

create table if not exists public.comunidad_comentario_reacciones (
  comentario_id  uuid not null references public.comunidad_comentarios(id) on delete cascade,
  autor_id       uuid not null references public.perfiles(id) on delete cascade,
  atleta_id      uuid references public.atletas(id) on delete cascade,   -- la ficha de quien reacciona (null: el coach)
  creado_en      timestamptz not null default now(),
  primary key (comentario_id, autor_id)
);
create index if not exists comunidad_comentario_reacciones_autor_idx on public.comunidad_comentario_reacciones (autor_id);
create index if not exists comunidad_comentario_reacciones_atleta_idx on public.comunidad_comentario_reacciones (atleta_id);

create table if not exists public.comunidad_bienvenidas (
  de              uuid not null references public.perfiles(id) on delete cascade,
  para            uuid not null references public.perfiles(id) on delete cascade,
  atleta_id       uuid references public.atletas(id) on delete cascade,   -- la ficha de quien la da (null: el coach)
  para_atleta_id  uuid references public.atletas(id) on delete cascade,   -- la de quien la recibe
  creado_en       timestamptz not null default now(),
  primary key (de, para)
);
create index if not exists comunidad_bienvenidas_para_idx on public.comunidad_bienvenidas (para);
create index if not exists comunidad_bienvenidas_atleta_idx on public.comunidad_bienvenidas (atleta_id);
create index if not exists comunidad_bienvenidas_para_atleta_idx on public.comunidad_bienvenidas (para_atleta_id);
alter table public.comunidad_bienvenidas drop constraint if exists comunidad_bienvenidas_validas;
alter table public.comunidad_bienvenidas add constraint comunidad_bienvenidas_validas check (de <> para);

-- ---------------------------------------------------------------------
-- 2. Quién ve qué (lo de los demás, solo dentro; el coach, todo)
-- ---------------------------------------------------------------------
-- ¿Se ve este comentario? (el coach, siempre; dentro, si no está oculto, su autor sigue dentro y su publicación se ve)
create or replace function public.comunidad_comentario_visible(p_comentario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.comunidad_comentarios k where k.id = p_comentario
                 and (public.es_coach() or (not k.oculto and public.comunidad_soy_miembro()
                      and public.comunidad_autor_visible(k.autor_id) and public.comunidad_post_visible(k.post_id))))
$$;

-- ¿Se puede responder a este comentario en esta publicación? (es de la misma, quien responde lo ve). El validador de las
-- respuestas: nunca da un error, solo false.
create or replace function public.comunidad_respuesta_valida(p_post uuid, p_responde_a uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_responde_a is null then return true; end if;
  if p_post is null then return false; end if;
  return exists (select 1 from public.comunidad_comentarios k where k.id = p_responde_a and k.post_id = p_post)
     and public.comunidad_comentario_visible(p_responde_a);
exception when others then
  return false;
end $$;

alter table public.comunidad_comentario_reacciones enable row level security;
alter table public.comunidad_bienvenidas enable row level security;

drop policy if exists coach_ver on public.comunidad_comentario_reacciones;
create policy coach_ver on public.comunidad_comentario_reacciones for select to authenticated using (public.es_coach());
drop policy if exists miembro_ver on public.comunidad_comentario_reacciones;
create policy miembro_ver on public.comunidad_comentario_reacciones for select to authenticated
  using (public.comunidad_soy_miembro() and public.comunidad_autor_visible(autor_id) and public.comunidad_comentario_visible(comentario_id));

-- Las bienvenidas, como los ánimos: cada uno ve las que da y las que recibe (de quien sigue dentro)
drop policy if exists coach_ver on public.comunidad_bienvenidas;
create policy coach_ver on public.comunidad_bienvenidas for select to authenticated using (public.es_coach());
drop policy if exists miembro_ver on public.comunidad_bienvenidas;
create policy miembro_ver on public.comunidad_bienvenidas for select to authenticated
  using (public.comunidad_soy_miembro() and (
    (para = auth.uid() and public.comunidad_autor_visible(de)) or (de = auth.uid() and public.comunidad_autor_visible(para))));

-- Desde la 019, cada tabla nueva lleva sus permisos a mano: solo lectura (se escriben con sus funciones)
revoke all on public.comunidad_comentario_reacciones, public.comunidad_bienvenidas from public, anon, authenticated;
grant select on public.comunidad_comentario_reacciones, public.comunidad_bienvenidas to authenticated;

-- ---------------------------------------------------------------------
-- 3. Responder a un comentario: un nivel, de la misma publicación y que se vea
-- ---------------------------------------------------------------------
create or replace function fbe_privado.comunidad_comentario_responder() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_padre uuid;
begin
  if new.responde_a is null then return new; end if;
  -- Responder a una respuesta cuelga del mismo comentario (un solo nivel)
  select k.responde_a into v_padre from public.comunidad_comentarios k where k.id = new.responde_a;
  if v_padre is not null then new.responde_a := v_padre; end if;
  if not public.comunidad_respuesta_valida(new.post_id, new.responde_a) then
    raise exception 'Ese comentario ya no está' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists comunidad_comentarios_ad_responder on public.comunidad_comentarios;
create trigger comunidad_comentarios_ad_responder before insert on public.comunidad_comentarios
  for each row execute function fbe_privado.comunidad_comentario_responder();

-- Al autor del comentario al que se responde, como los comentarios (027): si no es él quien responde, sigue dentro (o es el
-- coach), la publicación y su comentario se ven, y no es el autor de la publicación (a ese ya le llega «ha comentado tu
-- publicación»). Una por publicación y hora.
create or replace function fbe_privado.comunidad_al_responder_comentario() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  v_autor uuid;
  v_autor_post uuid;
begin
  if new.responde_a is null or new.oculto or not public.comunidad_activa() then return null; end if;
  select k.autor_id into v_autor from public.comunidad_comentarios k where k.id = new.responde_a and not k.oculto;
  select x.autor_id into v_autor_post from public.comunidad_posts x where x.id = new.post_id and not x.oculta;
  if v_autor is null or v_autor_post is null or v_autor = new.autor_id or v_autor = v_autor_post then return null; end if;
  if not exists (select 1 from public.perfiles p where p.id = v_autor and p.rol = 'coach')
     and not exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = v_autor) then
    return null;
  end if;
  perform fbe_privado.notificar_seguro(v_autor, 'comunidad', fbe_privado.comunidad_nombre(new.autor_id) || ' ha respondido a tu comentario',
    'Míralo en Equipo.', '#equipo', 'comunidad:' || new.post_id || ':r' || to_char(now() at time zone 'Europe/Madrid', 'YYYYMMDDHH24'));
  return null;
exception when others then
  raise warning 'FBE: notificación de una respuesta no creada: %', sqlerrm;
  return null;
end $$;
drop trigger if exists comunidad_comentarios_zz_responder on public.comunidad_comentarios;
create trigger comunidad_comentarios_zz_responder after insert on public.comunidad_comentarios
  for each row execute function fbe_privado.comunidad_al_responder_comentario();

-- ---------------------------------------------------------------------
-- 4. Lo que usa la app
-- ---------------------------------------------------------------------
-- 💪 a un comentario (que se ve): uno por persona; otra vez lo quita. Devuelve si queda puesto.
create or replace function public.comunidad_reaccionar_comentario(p_comentario uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not (public.es_coach() or public.comunidad_soy_miembro()) then
    raise exception 'Para reaccionar tienes que estar en la comunidad' using errcode = '42501';
  end if;
  if not public.comunidad_comentario_visible(p_comentario) then raise exception 'Ese comentario ya no está' using errcode = '42501'; end if;
  if exists (select 1 from public.comunidad_comentario_reacciones r where r.comentario_id = p_comentario and r.autor_id = v_uid) then
    delete from public.comunidad_comentario_reacciones where comentario_id = p_comentario and autor_id = v_uid;
    return false;
  end if;
  insert into public.comunidad_comentario_reacciones (comentario_id, autor_id, atleta_id)
  values (p_comentario, v_uid, case when public.es_coach() then null else public.mi_atleta_id() end)
  on conflict (comentario_id, autor_id) do nothing;
  return true;
end $$;

-- Los nuevos: quien está dentro de verdad y entró por primera vez en los últimos 7 días (nunca uno mismo), con si ya le has
-- dado la bienvenida. Solo para quien ve la comunidad.
create or replace function public.comunidad_nuevos()
returns table (perfil_id uuid, nombre text, foto text, desde timestamptz, bienvenida boolean)
language sql stable security definer set search_path = '' as $$
  select d.perfil_id, d.nombre, p.foto, m.creado_en,
    exists (select 1 from public.comunidad_bienvenidas b where b.de = auth.uid() and b.para = d.perfil_id)
  from fbe_privado.comunidad_dentro d
  join public.comunidad_miembros m on m.atleta_id = d.atleta_id
  join public.perfiles p on p.id = d.perfil_id
  where auth.uid() is not null and (public.es_coach() or public.comunidad_soy_miembro())
    and d.perfil_id <> auth.uid() and m.creado_en > now() - interval '7 days'
  order by m.creado_en desc
  limit 20
$$;

-- Dar la bienvenida a alguien que acaba de entrar (en su primera semana; una vez por persona; nunca a uno mismo; también el
-- coach). Gasta del cupo de los ánimos (40 al día). Le llega un aviso sin más texto.
create or replace function public.comunidad_dar_bienvenida(p_perfil uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_para_atleta uuid;
  v_desde timestamptz;
begin
  if v_uid is null or not public.comunidad_activa() or not (public.es_coach() or public.comunidad_soy_miembro()) then
    raise exception 'Para dar la bienvenida tienes que estar en la comunidad (y abierta)' using errcode = '42501';
  end if;
  if p_perfil is null or p_perfil = v_uid then raise exception 'A ti no te puedes dar la bienvenida' using errcode = '22023'; end if;
  select d.atleta_id, m.creado_en into v_para_atleta, v_desde
  from fbe_privado.comunidad_dentro d join public.comunidad_miembros m on m.atleta_id = d.atleta_id where d.perfil_id = p_perfil;
  if v_para_atleta is null then raise exception 'Esa persona ya no está en el equipo' using errcode = '42501'; end if;
  if v_desde <= now() - interval '7 days' then raise exception 'La bienvenida se da en su primera semana en el equipo' using errcode = '22023'; end if;
  if exists (select 1 from public.comunidad_bienvenidas b where b.de = v_uid and b.para = p_perfil) then
    raise exception 'Ya le has dado la bienvenida' using errcode = '23505';
  end if;
  perform fbe_privado.comunidad_gastar_cupo('animo');
  insert into public.comunidad_bienvenidas (de, para, atleta_id, para_atleta_id)
  values (v_uid, p_perfil, case when public.es_coach() then null else public.mi_atleta_id() end, v_para_atleta);
  perform fbe_privado.notificar_seguro(p_perfil, 'comunidad', fbe_privado.comunidad_nombre(v_uid) || ' te da la bienvenida 👋',
    'Míralo en Equipo.', '#equipo', 'comunidad_bienvenida:' || v_uid);
end $$;

-- «Que el equipo vea cuándo estoy entrenando» (apagado de entrada). Devuelve cómo queda.
create or replace function public.comunidad_entrenando_visible(p_visible boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.comunidad_soy_miembro() then raise exception 'No estás en la comunidad' using errcode = '42501'; end if;
  update public.comunidad_miembros set ver_entrenando = coalesce(p_visible, false) where perfil_id = auth.uid();
  return coalesce(p_visible, false);
end $$;

-- Quién está entrenando ahora: los de dentro que lo han encendido y han apuntado una serie de una sesión sin terminar en los
-- últimos 20 minutos (nunca uno mismo). Solo nombre y foto: ni la hora, ni la sesión, ni lo apuntado.
create or replace function public.comunidad_entrenando_ahora()
returns table (perfil_id uuid, nombre text, foto text)
language sql stable security definer set search_path = '' as $$
  select d.perfil_id, d.nombre, p.foto
  from fbe_privado.comunidad_dentro d
  join public.comunidad_miembros m on m.atleta_id = d.atleta_id and m.ver_entrenando
  join public.perfiles p on p.id = d.perfil_id
  where auth.uid() is not null and (public.es_coach() or public.comunidad_soy_miembro()) and d.perfil_id <> auth.uid()
    and exists (select 1 from public.series r
                join public.sesion_ejercicios se on se.id = r.sesion_ejercicio_id
                join public.sesiones s on s.id = se.sesion_id and not s.completada
                where r.atleta_id = d.atleta_id and r.registrada_en > now() - interval '20 minutes' and r.registrada_en <= now() + interval '1 minute')
  order by d.nombre
  limit 30
$$;

-- Salir (029): con p_borrar, también sus 💪 a comentarios y las bienvenidas, las dadas y las recibidas
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
    delete from public.comunidad_comentario_reacciones where autor_id = v_uid;
    delete from public.comunidad_votos where autor_id = v_uid;
    delete from public.comunidad_animos where de = v_uid or para = v_uid;
    delete from public.comunidad_bienvenidas where de = v_uid or para = v_uid;
    delete from public.comunidad_comentarios where autor_id = v_uid;
    delete from public.comunidad_posts where autor_id = v_uid;
  end if;
  return v_fotos;
end $$;

-- Todo lo suyo (029), también sus 💪 a comentarios y las bienvenidas (las dadas, a quién si sigue dentro; las recibidas,
-- solo cuándo)
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
    'avisos_al_coach', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'post_id', r.post_id, 'comentario_id', r.comentario_id, 'motivo', r.motivo,
                                   'creado_en', r.creado_en, 'resuelto_en', r.resuelto_en) order by r.creado_en)
                                 from public.comunidad_reportes r where r.autor_id = auth.uid()), '[]'::jsonb)
  ) end
$$;

-- Quien deja de estar dentro (029): a los demás ya no les llegan sus menciones, sus ánimos ni sus bienvenidas pendientes
create or replace function fbe_privado.comunidad_retirar_suyas(p_perfil uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.notificaciones n
  where n.tipo = 'comunidad' and n.url = '#equipo' and n.estado = 'pendiente'
    and (n.clave like 'comunidad_animo:' || p_perfil || ':%' or n.clave like 'comunidad_mencion:%:' || replace(p_perfil::text, '-', '') || ':%'
         or n.clave = 'comunidad_bienvenida:' || p_perfil);
$$;

-- ---------------------------------------------------------------------
-- 5. El resumen del domingo
-- ---------------------------------------------------------------------
-- Los recuentos de la semana del equipo, como comunidad_resumen_semana() (029) pero para el servidor (sin mirar quién
-- llama). Interna.
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
     where p.tipo = 'entreno' and not p.oculta and p.autor_id in (select c.perfil_id from cuentan c)
       and (p.creado_en at time zone 'Europe/Madrid')::date between (select l.d from lunes l) and (select l.d from lunes l) + 6
       and coalesce((e.v ->> 'record')::boolean, false)),
    (select count(*)::integer from public.comunidad_retos r where (now() at time zone 'Europe/Madrid')::date between r.desde and r.hasta)
$$;

-- El texto: «Esta semana en el equipo: 42 sesiones, 3 récords» y «5 con la semana completa. Míralo en Equipo.» (como
-- textoResumenDomingo en web/src/logica/comunidad.js). Nunca un error: con algo raro, null.
create or replace function public.comunidad_texto_resumen(p_sesiones integer, p_records integer, p_completa integer)
returns table (titulo text, cuerpo text)
language plpgsql immutable set search_path = '' as $$
begin
  if p_sesiones is null or p_sesiones < 1 then return; end if;
  return query select
    'Esta semana en el equipo: ' || p_sesiones || case when p_sesiones = 1 then ' sesión' else ' sesiones' end
      || case when coalesce(p_records, 0) > 0 then ', ' || p_records || case when p_records = 1 then ' récord' else ' récords' end else '' end,
    case when coalesce(p_completa, 0) > 0 then p_completa || ' con la semana completa. ' else '' end || 'Míralo en Equipo.';
exception when others then
  return;
end $$;

-- Los recordatorios (022) y, el domingo de 19:00 a 22:00 (Madrid), el resumen de la semana del equipo: una vez, a los que
-- están dentro y al coach (con la comunidad abierta y alguna sesión hecha), con la preferencia «Equipo»; caduca a las 23:00.
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
  return v_n;
end $$;

-- Permisos (como al final de 003 a 040)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (41)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
