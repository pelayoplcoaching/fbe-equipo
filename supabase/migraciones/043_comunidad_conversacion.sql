-- =====================================================================
-- FBE Equipo, migración 043 (v0.71): tercera tanda de mejoras de la comunidad, «conversación útil»
--   · Temas en el muro (comunidad_posts.tema): técnica, logros, charla, avisos (solo el coach) o «Pregunta para el coach»
--     (solo los atletas). La base pone el de entrada (charla; los avisos y las encuestas del coach, avisos; los logros, logros)
--     y los entrenos compartidos no llevan. Las publicaciones de antes quedan con el suyo.
--   · Preguntas al coach en abierto: al publicar una pregunta, al coach le llega un aviso. El coach contesta en los comentarios
--     y puede guardar la pregunta y su respuesta como pregunta frecuente (comunidad_preguntas; comunidad_guardar_pregunta()):
--     una copia del texto (que puede retocar), sin el nombre de quien preguntó, que ven todos los de dentro. Si se borra la
--     pregunta (también al salir y pedir que se borre lo suyo), se va con ella.
--   · Varias fotos por publicación (comunidad_posts.fotos, de 2 a 4, la primera es foto_ruta): las mismas reglas de Storage
--     que la foto de siempre (se ven si se ve la publicación, se suben solo ya registradas, no se borran mientras se usen).
--   · Guardar publicaciones (comunidad_guardados, una fila por persona y publicación, que solo ve su dueño; comunidad_guardar())
--     y buscar en el muro (comunidad_buscar(): por el texto y por el nombre de quien lo publica, solo en lo que se ve).
--   · La mejor respuesta (comunidad_posts.mejor_comentario; comunidad_mejor_respuesta()): quien publicó o el coach elige un
--     comentario de otra persona; a su autor le llega un aviso (preferencia «Equipo»). En una pregunta, la del coach es la
--     «Respuesta del coach».
--   · Una foto, en una sola publicación (ni la de otra, aunque esté oculta, ni la de un aviso abierto al coach); el aviso al
--     coach guarda también las fotos 2 a 4 (comunidad_reportes.copia_fotos) hasta que se resuelve.
--   · El aviso de privacidad admite revisiones de dos cifras («2026-12.10»: tras la 2026-12.9, la de esta versión), con la
--     misma regla de la 037 (el mes, como mucho el que viene; nunca hacia atrás, comparando por partes).
-- Lo que se acepta al entrar no cambia (comunidad-2026-11-b): todo sale de lo que ya se publica y se comenta; lo guardado
-- solo lo ve su dueño, y la pregunta frecuente va sin nombre.
-- Se ejecuta en el SQL Editor después de la 042 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 43 then
    raise exception 'Esta base ya tiene la migración %: repetir la 043 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 43;» y, después de ella, todas las siguientes en orden, todo en la misma consulta del SQL Editor (una sola transacción).';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 42) then
    raise exception 'Antes de la 043 hace falta la 042: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Validadores (nunca dan un error: con algo raro, false)
-- ---------------------------------------------------------------------
-- Los temas del muro (como TEMAS en web/src/logica/comunidad.js)
create or replace function public.comunidad_tema_valido(p_tema text) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  return coalesce(p_tema in ('tecnica', 'logros', 'charla', 'avisos', 'pregunta'), false);
exception when others then
  return false;
end $$;

-- Las fotos de una publicación con varias: de 2 a 4, sin repetir, con la ruta de siempre, y la primera es foto_ruta
create or replace function public.comunidad_fotos_validas(p_fotos text[], p_primera text) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if p_fotos is null then return true; end if;
  if p_primera is null or array_ndims(p_fotos) <> 1 or cardinality(p_fotos) not between 2 and 4 or p_fotos[1] is distinct from p_primera then return false; end if;
  return (select count(distinct f) = cardinality(p_fotos)
            and bool_and(f ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|coach)/[A-Za-z0-9]{8,40}\.jpg$')
          from unnest(p_fotos) f);
exception when others then
  return false;
end $$;

-- ---------------------------------------------------------------------
-- 2. Columnas y tablas
-- ---------------------------------------------------------------------
alter table public.comunidad_posts add column if not exists tema text;
alter table public.comunidad_posts add column if not exists fotos text[];
alter table public.comunidad_posts add column if not exists mejor_comentario uuid references public.comunidad_comentarios(id) on delete set null;
create index if not exists comunidad_posts_tema_idx on public.comunidad_posts (tema, creado_en desc);
create index if not exists comunidad_posts_fotos_idx on public.comunidad_posts using gin (fotos);
create index if not exists comunidad_posts_mejor_idx on public.comunidad_posts (mejor_comentario);
-- (las de antes, con su tema: los avisos y las encuestas, avisos; los logros, logros; lo demás, charla)
update public.comunidad_posts set tema = case tipo when 'aviso' then 'avisos' when 'encuesta' then 'avisos' when 'logro' then 'logros' else 'charla' end
where tema is null and tipo <> 'entreno';
-- (una regla propia: las de la 027 y la 029 no la tocan si alguna vez se repiten)
alter table public.comunidad_posts drop constraint if exists comunidad_posts_043_validos;
alter table public.comunidad_posts add constraint comunidad_posts_043_validos check (
  (tema is null or public.comunidad_tema_valido(tema))
  and (tema is distinct from 'pregunta' or tipo = 'post')
  and (tema is distinct from 'avisos' or tipo in ('aviso', 'encuesta'))
  and (fotos is null or tipo in ('post', 'aviso'))
  and public.comunidad_fotos_validas(fotos, foto_ruta)
);

-- El aviso al coach guarda también todas las fotos de una publicación con varias (la primera sigue en copia_foto)
alter table public.comunidad_reportes add column if not exists copia_fotos text[];
create index if not exists comunidad_reportes_fotos_idx on public.comunidad_reportes using gin (copia_fotos);
alter table public.comunidad_reportes drop constraint if exists comunidad_reportes_043_validos;
alter table public.comunidad_reportes add constraint comunidad_reportes_043_validos check (
  copia_fotos is null or (array_ndims(copia_fotos) = 1 and cardinality(copia_fotos) between 2 and 4)
);

-- Lo guardado: una fila por persona y publicación; solo la ve su dueño
create table if not exists public.comunidad_guardados (
  perfil_id  uuid not null references public.perfiles(id) on delete cascade,
  post_id    uuid not null references public.comunidad_posts(id) on delete cascade,
  creado_en  timestamptz not null default now(),
  primary key (perfil_id, post_id)
);
create index if not exists comunidad_guardados_post_idx on public.comunidad_guardados (post_id);

-- Las preguntas frecuentes del equipo: una copia de la pregunta y de la respuesta del coach (sin el nombre de quien preguntó)
create table if not exists public.comunidad_preguntas (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references public.comunidad_posts(id) on delete cascade,
  comentario_id   uuid references public.comunidad_comentarios(id) on delete set null,
  pregunta        text not null,
  respuesta       text not null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create unique index if not exists comunidad_preguntas_post_idx on public.comunidad_preguntas (post_id);
create index if not exists comunidad_preguntas_comentario_idx on public.comunidad_preguntas (comentario_id);
alter table public.comunidad_preguntas drop constraint if exists comunidad_preguntas_validas;
alter table public.comunidad_preguntas add constraint comunidad_preguntas_validas check (
  char_length(pregunta) between 1 and 2000 and public.texto_visible(pregunta)
  and char_length(respuesta) between 1 and 2000 and public.texto_visible(respuesta)
);

-- ---------------------------------------------------------------------
-- 3. Quién ve qué (lo de los demás, solo dentro; el coach, todo; lo guardado, solo su dueño)
-- ---------------------------------------------------------------------
alter table public.comunidad_guardados enable row level security;
alter table public.comunidad_preguntas enable row level security;

drop policy if exists dueno_ver on public.comunidad_guardados;
create policy dueno_ver on public.comunidad_guardados for select to authenticated using (perfil_id = auth.uid());

drop policy if exists coach_todo on public.comunidad_preguntas;
create policy coach_todo on public.comunidad_preguntas for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists miembro_ver on public.comunidad_preguntas;
create policy miembro_ver on public.comunidad_preguntas for select to authenticated using (public.comunidad_soy_miembro());

-- Desde la 019, cada tabla nueva lleva sus permisos a mano. Lo guardado, solo lectura (se escribe con comunidad_guardar());
-- las preguntas frecuentes, el coach las quita (se guardan con comunidad_guardar_pregunta())
revoke all on public.comunidad_guardados, public.comunidad_preguntas from public, anon, authenticated;
grant select on public.comunidad_guardados to authenticated;
grant select, delete on public.comunidad_preguntas to authenticated;

-- ---------------------------------------------------------------------
-- 4. Al publicar: el tema y las fotos (después de comunidad_post_preparar, de la 029)
-- ---------------------------------------------------------------------
-- El tema que toca (uno que no vale, el de entrada); los avisos son del coach y las preguntas, de los atletas. Las fotos, todas
-- en la misma carpeta que la primera (que la 029 ya comprueba). La mejor respuesta se elige después, con su función.
create or replace function public.comunidad_post_tema() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.mejor_comentario := null;
  if new.tipo = 'entreno' then
    new.tema := null;
    new.fotos := null;
  elsif new.tipo = 'logro' then
    new.tema := 'logros';
  elsif new.tipo = 'encuesta' then
    new.tema := 'avisos';
  elsif new.tipo = 'aviso' then
    new.tema := case when new.tema in ('tecnica', 'logros', 'charla', 'avisos') then new.tema else 'avisos' end;
  else
    if new.tema = 'avisos' then raise exception 'Los avisos son del coach: elige otro tema' using errcode = '42501'; end if;
    new.tema := case when new.tema in ('tecnica', 'logros', 'charla', 'pregunta') then new.tema else 'charla' end;
  end if;
  if new.fotos is not null and exists (select 1 from unnest(new.fotos) f where f is null or split_part(f, '/', 1) is distinct from split_part(coalesce(new.foto_ruta, ''), '/', 1)) then
    raise exception 'La foto no va en su sitio' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists comunidad_posts_ad_tema on public.comunidad_posts;
create trigger comunidad_posts_ad_tema before insert on public.comunidad_posts
  for each row execute function public.comunidad_post_tema();

-- (revisión) Una foto va en una sola publicación: ni la de otra (como foto_ruta o en sus fotos, aunque esté oculta: si no,
-- volvería a verse) ni la que guarda un aviso abierto al coach. De una en una por ruta (pg_advisory_xact_lock).
create or replace function fbe_privado.comunidad_fotos_unicas() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v text;
begin
  for v in select distinct f from unnest(array_append(coalesce(new.fotos, '{}'::text[]), new.foto_ruta)) as u(f) where f is not null order by 1 loop
    perform pg_advisory_xact_lock(hashtext('comunidad_foto:' || v));
    if exists (select 1 from public.comunidad_posts x where x.id <> new.id and (x.foto_ruta = v or x.fotos @> array[v]))
       or exists (select 1 from public.comunidad_reportes r where r.resuelto_en is null and (r.copia_foto = v or r.copia_fotos @> array[v])) then
      raise exception 'Esa foto ya está en otra publicación' using errcode = '23505';
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists comunidad_posts_ae_fotos_unicas on public.comunidad_posts;
create trigger comunidad_posts_ae_fotos_unicas before insert or update of foto_ruta, fotos on public.comunidad_posts
  for each row execute function fbe_privado.comunidad_fotos_unicas();

-- Una pregunta para el coach → aviso al coach (sin el texto). La clave lleva la publicación: si se borra o se oculta antes de
-- que salga, se retira con las demás (comunidad_al_retirar, 029).
create or replace function fbe_privado.comunidad_al_preguntar() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
begin
  if new.tema is distinct from 'pregunta' or new.oculta or not public.comunidad_activa() then return null; end if;
  perform fbe_privado.notificar_seguro(p.id, 'comunidad', fbe_privado.comunidad_nombre(new.autor_id) || ' te ha hecho una pregunta en el equipo',
            'Contéstala en Equipo.', '#equipo', 'comunidad:' || new.id || ':pregunta')
  from public.perfiles p where p.rol = 'coach' and p.id <> new.autor_id;
  return null;
exception when others then
  raise warning 'FBE: notificación de la pregunta % no creada: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists comunidad_posts_zz_preguntar on public.comunidad_posts;
create trigger comunidad_posts_zz_preguntar after insert on public.comunidad_posts
  for each row execute function fbe_privado.comunidad_al_preguntar();

-- Un comentario borrado u oculto ya no avisa de que es la mejor respuesta (si el aviso aún no ha salido)
create or replace function fbe_privado.comunidad_mejor_retirar() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
begin
  if tg_op = 'UPDATE' and not (new.oculto and not old.oculto) then return null; end if;
  delete from public.notificaciones n where n.estado = 'pendiente' and n.clave like 'comunidad_mejor:' || old.id || ':%';
  return null;
exception when others then
  raise warning 'FBE: aviso de mejor respuesta de % no retirado: %', old.id, sqlerrm;
  return null;
end $$;
drop trigger if exists comunidad_comentarios_zz_retirar_mejor on public.comunidad_comentarios;
create trigger comunidad_comentarios_zz_retirar_mejor after delete or update of oculto on public.comunidad_comentarios
  for each row execute function fbe_privado.comunidad_mejor_retirar();

-- (revisión) Una publicación que se oculta o se borra ya no avisa de su mejor respuesta (si el aviso aún no ha salido)
create or replace function fbe_privado.comunidad_post_mejor_retirar() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
begin
  if tg_op = 'UPDATE' and not (new.oculta and not old.oculta) then return null; end if;
  if old.mejor_comentario is not null then
    delete from public.notificaciones n where n.estado = 'pendiente' and n.clave like 'comunidad_mejor:' || old.mejor_comentario || ':%';
  end if;
  return null;
exception when others then
  raise warning 'FBE: aviso de mejor respuesta de la publicación % no retirado: %', old.id, sqlerrm;
  return null;
end $$;
drop trigger if exists comunidad_posts_zz_retirar_mejor on public.comunidad_posts;
create trigger comunidad_posts_zz_retirar_mejor after delete or update of oculta on public.comunidad_posts
  for each row execute function fbe_privado.comunidad_post_mejor_retirar();

-- ---------------------------------------------------------------------
-- 5. Varias fotos: las reglas de Storage de la 027, también con las de comunidad_posts.fotos
-- ---------------------------------------------------------------------
create or replace function public.comunidad_foto_visible(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_ruta is not null and exists (select 1 from public.comunidad_posts x where (x.foto_ruta = p_ruta or x.fotos @> array[p_ruta]) and public.comunidad_post_visible(x.id))
$$;
create or replace function public.comunidad_foto_registrada(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_ruta is not null and auth.uid() is not null and exists (
    select 1 from public.comunidad_posts x where (x.foto_ruta = p_ruta or x.fotos @> array[p_ruta]) and x.autor_id = auth.uid() and not x.oculta
      and x.creado_en > now() - interval '15 minutes'
      and (public.es_coach() or public.comunidad_soy_miembro()))
$$;
create or replace function public.comunidad_foto_borrable(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_ruta is not null and public.mi_atleta_id() is not null
    and split_part(p_ruta, '/', 1) = public.mi_atleta_id()::text
    and not exists (select 1 from public.comunidad_posts x where x.foto_ruta = p_ruta or x.fotos @> array[p_ruta])
    and not exists (select 1 from public.comunidad_reportes r where (r.copia_foto = p_ruta or r.copia_fotos @> array[p_ruta]) and r.resuelto_en is null)
$$;

-- «Avisar al coach» (029), guardando también todas las fotos de una publicación con varias (copia_fotos)
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
-- 6. Lo que usa la app
-- ---------------------------------------------------------------------
-- Guardar (o dejar de guardar) una publicación que se ve. Devuelve cómo queda.
create or replace function public.comunidad_guardar(p_post uuid, p_guardar boolean default true) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not (public.es_coach() or public.comunidad_soy_miembro()) then
    raise exception 'Para guardar publicaciones tienes que estar en la comunidad' using errcode = '42501';
  end if;
  if not coalesce(p_guardar, true) then
    delete from public.comunidad_guardados where perfil_id = v_uid and post_id = p_post;
    return false;
  end if;
  if not public.comunidad_post_visible(p_post) then raise exception 'Esa publicación ya no está' using errcode = '42501'; end if;
  insert into public.comunidad_guardados (perfil_id, post_id) values (v_uid, p_post) on conflict (perfil_id, post_id) do nothing;
  return true;
end $$;

-- Buscar en el muro: por el texto (también el título de un entreno o de un logro) y por el nombre de quien lo publica, sin
-- distinguir mayúsculas ni tildes, solo en lo que quien busca puede ver; de lo más nuevo a lo más antiguo, de p_limite en
-- p_limite (p_antes: el creado_en del último que ya se ve). De 2 a 100 letras (si no, nada).
create or replace function public.comunidad_buscar(p_texto text, p_limite integer default 20, p_antes timestamptz default null)
returns table (id uuid, creado_en timestamptz)
language sql stable security definer set search_path = '' as $$
  with t as (
    select '%' || replace(replace(replace(translate(lower(btrim(coalesce(p_texto, ''))), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc'),
             '\', '\\'), '%', '\%'), '_', '\_') || '%' as patron,
           char_length(btrim(coalesce(p_texto, ''))) between 2 and 100 as vale
  )
  select x.id, x.creado_en
  from public.comunidad_posts x cross join t
  where t.vale and auth.uid() is not null and (public.es_coach() or public.comunidad_soy_miembro())
    and (p_antes is null or x.creado_en < p_antes)
    and public.comunidad_post_visible(x.id)
    and translate(lower(concat_ws(' ', x.texto, x.resumen ->> 'nombre', x.resumen ->> 'titulo', fbe_privado.comunidad_nombre(x.autor_id))),
                  'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc') like t.patron
  order by x.creado_en desc
  limit least(greatest(coalesce(p_limite, 20), 1), 101)
$$;

-- La mejor respuesta de una publicación (p_comentario null: la quita). La eligen quien la ha publicado (si sigue dentro) o el
-- coach; un comentario de esa publicación que se ve y de otra persona. A su autor le llega un aviso (una vez por comentario y
-- quien lo elige), sin el texto. Devuelve la que queda.
create or replace function public.comunidad_mejor_respuesta(p_post uuid, p_comentario uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  x public.comunidad_posts;
  k public.comunidad_comentarios;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión' using errcode = '42501'; end if;
  select * into x from public.comunidad_posts p where p.id = p_post and public.comunidad_post_visible(p.id);
  if not found then raise exception 'Esa publicación ya no está' using errcode = '42501'; end if;
  if not (public.es_coach() or (x.autor_id = v_uid and public.comunidad_soy_miembro())) then
    raise exception 'La mejor respuesta la elige quien ha publicado (o el coach)' using errcode = '42501';
  end if;
  if p_comentario is not null then
    select * into k from public.comunidad_comentarios c
    where c.id = p_comentario and c.post_id = p_post and not c.oculto and public.comunidad_comentario_visible(c.id);
    if not found then raise exception 'Ese comentario ya no está' using errcode = '42501'; end if;
    if k.autor_id = x.autor_id then raise exception 'La mejor respuesta tiene que ser de otra persona' using errcode = '22023'; end if;
  end if;
  if x.mejor_comentario is not null and x.mejor_comentario is distinct from p_comentario then
    delete from public.notificaciones n where n.estado = 'pendiente' and n.clave like 'comunidad_mejor:' || x.mejor_comentario || ':%';
  end if;
  update public.comunidad_posts set mejor_comentario = p_comentario where id = p_post;
  if p_comentario is not null and k.autor_id <> v_uid
     and (exists (select 1 from public.perfiles p where p.id = k.autor_id and p.rol = 'coach')
          or exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = k.autor_id)) then
    perform fbe_privado.notificar_seguro(k.autor_id, 'comunidad', fbe_privado.comunidad_nombre(v_uid) || ' ha elegido tu comentario como mejor respuesta',
      'Míralo en Equipo.', '#equipo', 'comunidad_mejor:' || k.id || ':' || v_uid);
  end if;
  return p_comentario;
end $$;

-- El coach guarda una pregunta para el coach como pregunta frecuente, con su respuesta (un comentario suyo en ella, que pasa a
-- ser la «Respuesta del coach»). Se guarda una copia del texto (la puede retocar: p_pregunta y p_respuesta), sin el nombre de
-- quien preguntó. Otra vez sobre la misma pregunta, la pone al día. Devuelve la pregunta frecuente.
create or replace function public.comunidad_guardar_pregunta(p_post uuid, p_comentario uuid, p_pregunta text default null, p_respuesta text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  x public.comunidad_posts;
  k public.comunidad_comentarios;
  v_pregunta text;
  v_respuesta text;
  v_id uuid;
begin
  if not public.es_coach() then raise exception 'Las preguntas frecuentes las guarda el coach' using errcode = '42501'; end if;
  select * into x from public.comunidad_posts p where p.id = p_post;
  if not found then raise exception 'Esa publicación ya no está' using errcode = '22023'; end if;
  if x.tema is distinct from 'pregunta' then raise exception 'Solo las preguntas para el coach se guardan como preguntas frecuentes' using errcode = '22023'; end if;
  select * into k from public.comunidad_comentarios c
  where c.id = p_comentario and c.post_id = p_post and exists (select 1 from public.perfiles p where p.id = c.autor_id and p.rol = 'coach');
  if not found then raise exception 'La respuesta tiene que ser un comentario tuyo en esa pregunta' using errcode = '22023'; end if;
  v_pregunta := coalesce(nullif(btrim(coalesce(p_pregunta, '')), ''), x.texto);
  v_respuesta := coalesce(nullif(btrim(coalesce(p_respuesta, '')), ''), k.texto);
  if v_pregunta is null or char_length(v_pregunta) > 2000 or not public.texto_visible(v_pregunta) then
    raise exception 'Escribe la pregunta (hasta 2000 letras)' using errcode = '22023';
  end if;
  if char_length(v_respuesta) > 2000 or not public.texto_visible(v_respuesta) then
    raise exception 'Escribe la respuesta (hasta 2000 letras)' using errcode = '22023';
  end if;
  insert into public.comunidad_preguntas as q (post_id, comentario_id, pregunta, respuesta)
  values (x.id, k.id, v_pregunta, v_respuesta)
  on conflict (post_id) do update set comentario_id = excluded.comentario_id, pregunta = excluded.pregunta, respuesta = excluded.respuesta, actualizado_en = now()
  returning q.id into v_id;
  if x.mejor_comentario is not null and x.mejor_comentario is distinct from k.id then
    delete from public.notificaciones n where n.estado = 'pendiente' and n.clave like 'comunidad_mejor:' || x.mejor_comentario || ':%';
  end if;
  update public.comunidad_posts set mejor_comentario = k.id where id = x.id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 7. Salir, descargar mis datos y lo que se retira
-- ---------------------------------------------------------------------
-- Salir (042): con p_borrar, también sus fotos de varias y lo que ha guardado (sus preguntas frecuentes se van con sus
-- publicaciones)
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
    delete from public.comunidad_comentarios where autor_id = v_uid;
    delete from public.comunidad_posts where autor_id = v_uid;
  end if;
  return v_fotos;
end $$;

-- Todo lo suyo (042), también lo que ha guardado y las preguntas frecuentes que salen de sus preguntas
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
    'avisos_al_coach', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'post_id', r.post_id, 'comentario_id', r.comentario_id, 'motivo', r.motivo,
                                   'creado_en', r.creado_en, 'resuelto_en', r.resuelto_en) order by r.creado_en)
                                 from public.comunidad_reportes r where r.autor_id = auth.uid()), '[]'::jsonb)
  ) end
$$;

-- Quien deja de estar dentro (042): a los demás tampoco les llega que ha elegido su comentario como mejor respuesta
create or replace function fbe_privado.comunidad_retirar_suyas(p_perfil uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.notificaciones n
  where n.tipo = 'comunidad' and n.url = '#equipo' and n.estado = 'pendiente'
    and (n.clave like 'comunidad_animo:' || p_perfil || ':%' or n.clave like 'comunidad_mencion:%:' || replace(p_perfil::text, '-', '') || ':%'
         or n.clave = 'comunidad_bienvenida:' || p_perfil or n.clave like 'comunidad_companero:' || p_perfil || ':%'
         or n.clave like 'comunidad_mejor:%:' || p_perfil
         or exists (select 1 from public.comunidad_companeros c where p_perfil in (c.de, c.para)
                    and (n.clave like 'comunidad_pareja:' || c.id || ':%' or n.clave = 'comunidad_companero_si:' || c.id)));
$$;

-- ---------------------------------------------------------------------
-- 8. El aviso de privacidad (037) con revisiones de una o dos cifras: «AAAA-MM», «AAAA-MM.n» o «AAAA-MM.nn» (de 1 a 99, sin
--    ceros delante). El mes, como mucho el que viene, y nunca hacia atrás (comparando por partes), como en la 037.
-- ---------------------------------------------------------------------
alter table public.privacidad_vista drop constraint if exists privacidad_vista_version_valida;
alter table public.privacidad_vista add constraint privacidad_vista_version_valida check (version ~ '^20[0-9]{2}-(0[1-9]|1[0-2])(\.[1-9][0-9]?)?$');
create or replace function public.privacidad_vista_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- (lo mal formado, antes de compararlo: así nunca se cambia por la de antes ni da un error de conversión)
  if new.version is null or new.version !~ '^20[0-9]{2}-(0[1-9]|1[0-2])(\.[1-9][0-9]?)?$' then
    raise exception 'Esa versión de la política no tiene su formato' using errcode = '23514';
  end if;
  if current_user in ('authenticated', 'anon') then
    new.usuario_id := auth.uid();
    if new.usuario_id is null then raise exception 'Necesitas iniciar sesión' using errcode = '42501'; end if;
    if tg_op = 'UPDATE' and new.usuario_id is distinct from old.usuario_id then raise exception 'Solo la tuya' using errcode = '42501'; end if;
    if left(new.version, 7) collate "C" > to_char((now() at time zone 'Europe/Madrid') + interval '1 month', 'YYYY-MM') collate "C" then
      raise exception 'Esa versión de la política aún no existe' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'UPDATE' and (left(new.version, 7) collate "C" < left(old.version, 7) collate "C"
      or (left(new.version, 7) = left(old.version, 7) and coalesce(nullif(substr(new.version, 9), '')::int, 0) < coalesce(nullif(substr(old.version, 9), '')::int, 0))) then
    -- (la de antes ya tiene su formato: la restricción no deja guardar otra cosa)
    new.version := old.version;
  end if;
  new.vista_en := now();
  return new;
end $$;

-- Permisos (como al final de 003 a 042)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (43)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
