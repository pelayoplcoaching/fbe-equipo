-- =====================================================================
-- FBE Equipo, migración 073: el perfil del atleta, tanda 4 (claude/perfil-atleta-mejoras.md)
--
-- Por qué: veinte mejoras del perfil, siempre como consejo (la programación del coach no cambia). Lo que guarda:
--   · personal_atleta.evitados: los ejercicios que prefiere evitar, cada uno con su motivo (no me gusta, me molesta o no
--     tengo el material). Los ve el atleta y su coach (en la ficha y con un aviso en el editor); «Cambiar ejercicio» los
--     aparta de las alternativas. Nada cambia en su programación.
--   · personal_atleta.material: lo que tiene en casa y de viaje (y sus mancuernas, hasta cuántos kilos). Antes solo en su
--     móvil; ahora también lo ve su coach. Lo ve el atleta y su coach.
--   · animo_fijados: los mensajes que fija en su «rincón de ánimo» (del coach en su chat o comentarios de compañeros en
--     sus publicaciones). Son referencias a mensajes que ya existen: si el mensaje se borra o se oculta, deja de salir.
--     Solo los ve el atleta (ni el coach).
--   · portadas: la foto de portada de su perfil, en un bucket nuevo («portadas», privado). La ve él, su coach y, si los
--     dos están en la comunidad, el equipo (como su foto de perfil). Al cambiarla, quitarla o borrarse el perfil, la
--     anterior se encola para borrarse de Storage.
-- Nadie toca las tablas: todo va por funciones.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 072 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 73 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 073 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 73;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 72) then  -- (2) la anterior
    raise exception 'Falta la migración 072 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Lo que evita y su material (en su fila de personal_atleta)
-- ---------------------------------------------------------------------
alter table public.personal_atleta add column if not exists evitados jsonb not null default '[]'::jsonb;
alter table public.personal_atleta add column if not exists material jsonb not null default '{}'::jsonb;
alter table public.personal_atleta drop constraint if exists personal_atleta_perfil4;
alter table public.personal_atleta add constraint personal_atleta_perfil4 check (
  jsonb_typeof(evitados) = 'array' and jsonb_array_length(evitados) <= 60 and jsonb_typeof(material) = 'object'
);

-- ¿Vale este material? { casa: [..], viaje: [..], mancuernas_kg: n | null }, con las claves de logica/material.js
create or replace function fbe_privado.material_valido(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select p is not null and jsonb_typeof(p) = 'object'
    and not exists (select 1 from jsonb_object_keys(p) k where k not in ('casa', 'viaje', 'mancuernas_kg'))
    and coalesce((select bool_and(jsonb_typeof(p -> l) = 'array' and jsonb_array_length(p -> l) <= 10
                    and not exists (select 1 from jsonb_array_elements(p -> l) x
                                    where jsonb_typeof(x) <> 'string' or x #>> '{}' not in ('barra', 'rack', 'banco', 'mancuernas', 'kettlebells', 'poleas', 'maquinas', 'multipower', 'gomas', 'dominadas')))
                  from unnest(array['casa', 'viaje']) l where p ? l), true)
    and (not p ? 'mancuernas_kg' or jsonb_typeof(p -> 'mancuernas_kg') = 'null'
         or (jsonb_typeof(p -> 'mancuernas_kg') = 'number' and (p ->> 'mancuernas_kg')::numeric between 1 and 100));
$$;

create or replace function fbe_privado.personal_json(p public.personal_atleta) returns jsonb
language sql stable set search_path = '' as $$
  select case when p.atleta_id is null then null else jsonb_build_object(
    'apodo', p.apodo, 'porque', p.porque, 'favoritos', to_jsonb(p.favoritos), 'musica_url', p.musica_url,
    'cancion_url', p.cancion_url, 'musica_aperturas', p.musica_aperturas,
    'cumple_mes', p.cumple_mes, 'cumple_dia', p.cumple_dia,
    'genero', p.genero, 'tono', p.tono, 'meta_nombre', p.meta_nombre, 'meta_fecha', p.meta_fecha, 'meta_cifra', p.meta_cifra, 'meta_unidad', p.meta_unidad,
    'manual_feedback', p.manual_feedback, 'manual_motiva', to_jsonb(p.manual_motiva), 'manual_evitar', p.manual_evitar,
    'musica_listas', p.musica_listas, 'himno_ultima_url', p.himno_ultima_url, 'himno_vuelta_url', p.himno_vuelta_url,
    'evitados', p.evitados, 'material', p.material,
    'actualizado_en', p.actualizado_en) end;
$$;

-- Guarda solo lo del perfil 4 (lo que evita y su material); lo demás de su fila no se toca
create or replace function public.personal_perfil4_guardar(p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_atleta uuid := public.mi_atleta_id();
  v public.personal_atleta;
  v_evitados jsonb; v_material jsonb;
begin
  if v_atleta is null then raise exception 'Solo el atleta guarda lo suyo' using errcode = '42501'; end if;
  if exists (select 1 from public.atletas where id = v_atleta and estado = 'baja') then
    raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada';
  end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_datos) k where k not in ('evitados', 'material')) then
    raise exception 'Faltan los datos' using errcode = '22023';
  end if;
  select * into v from public.personal_atleta where atleta_id = v_atleta;
  v_evitados := case when p_datos ? 'evitados' then p_datos -> 'evitados' else coalesce(v.evitados, '[]'::jsonb) end;
  v_material := case when p_datos ? 'material' then p_datos -> 'material' else coalesce(v.material, '{}'::jsonb) end;
  if jsonb_typeof(v_evitados) <> 'array' or jsonb_array_length(v_evitados) > 60 then
    raise exception 'Como mucho 60 ejercicios que evitar' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_evitados) x
             where jsonb_typeof(x) <> 'object' or (select count(*) from jsonb_object_keys(x)) <> 2
                or coalesce(x ->> 'motivo', '') not in ('gusto', 'molestia', 'material')
                or coalesce(x ->> 'ejercicio_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'Cada ejercicio, con su motivo (no me gusta, me molesta o no tengo el material)' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_evitados) x
             where not exists (select 1 from public.ejercicios e where e.id = (x ->> 'ejercicio_id')::uuid))
     or (select count(distinct x ->> 'ejercicio_id') from jsonb_array_elements(v_evitados) x) <> jsonb_array_length(v_evitados) then
    raise exception 'Algún ejercicio no está en la biblioteca (o está repetido)' using errcode = '22023';
  end if;
  if not fbe_privado.material_valido(v_material) then
    raise exception 'Ese material no vale' using errcode = '22023';
  end if;
  insert into public.personal_atleta as t (atleta_id, evitados, material, actualizado_en)
    values (v_atleta, v_evitados, v_material, now())
  on conflict (atleta_id) do update set evitados = excluded.evitados, material = excluded.material, actualizado_en = now()
  returning * into v;
  return fbe_privado.personal_json(v);
end $$;
comment on function public.personal_perfil4_guardar(jsonb) is 'El atleta guarda los ejercicios que prefiere evitar (con su motivo) y su material de casa y de viaje. Lo ve su coach.';

-- ---------------------------------------------------------------------
-- 2. El rincón de ánimo: mensajes fijados (solo los ve el atleta)
-- ---------------------------------------------------------------------
create table if not exists public.animo_fijados (
  id                       uuid primary key default gen_random_uuid(),
  atleta_id                uuid not null references public.atletas(id) on delete cascade,
  comentario_id            uuid references public.comentarios(id) on delete cascade,
  comunidad_comentario_id  uuid references public.comunidad_comentarios(id) on delete cascade,
  fijado_en                timestamptz not null default now(),
  check (num_nonnulls(comentario_id, comunidad_comentario_id) = 1)
);
create unique index if not exists animo_fijados_chat_uno on public.animo_fijados (atleta_id, comentario_id) where comentario_id is not null;
create unique index if not exists animo_fijados_comunidad_uno on public.animo_fijados (atleta_id, comunidad_comentario_id) where comunidad_comentario_id is not null;
create index if not exists animo_fijados_atleta_idx on public.animo_fijados (atleta_id, fijado_en);

-- Fijar (o soltar) un mensaje: del coach en su chat ('chat') o de un compañero en una publicación suya ('comunidad')
create or replace function public.animo_fijar(p_tipo text, p_id uuid, p_fijar boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_atleta uuid := public.mi_atleta_id();
begin
  if v_atleta is null then raise exception 'Solo el atleta fija mensajes' using errcode = '42501'; end if;
  if p_tipo not in ('chat', 'comunidad') or p_id is null then raise exception 'Ese mensaje no vale' using errcode = '22023'; end if;
  if not coalesce(p_fijar, false) then
    delete from public.animo_fijados f where f.atleta_id = v_atleta
      and ((p_tipo = 'chat' and f.comentario_id = p_id) or (p_tipo = 'comunidad' and f.comunidad_comentario_id = p_id));
    return false;
  end if;
  if public.esta_de_baja() then raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada'; end if;
  if p_tipo = 'chat' and not exists (select 1 from public.comentarios c where c.id = p_id and c.atleta_id = v_atleta and c.autor = 'coach' and c.eliminado_en is null) then
    raise exception 'Solo se fijan mensajes de tu coach en tu chat' using errcode = '22023';
  end if;
  if p_tipo = 'comunidad' and not exists (
       select 1 from public.comunidad_comentarios c join public.comunidad_posts p on p.id = c.post_id
       where c.id = p_id and p.autor_id = auth.uid() and c.autor_id <> auth.uid() and not c.oculto) then
    raise exception 'Solo se fijan comentarios de compañeros en tus publicaciones' using errcode = '22023';
  end if;
  if (select count(*) from public.animo_fijados where atleta_id = v_atleta) >= 20 then
    raise exception 'Como mucho 20 mensajes en tu rincón de ánimo' using errcode = '22023';
  end if;
  if p_tipo = 'chat' then
    insert into public.animo_fijados (atleta_id, comentario_id) values (v_atleta, p_id) on conflict do nothing;
  else
    insert into public.animo_fijados (atleta_id, comunidad_comentario_id) values (v_atleta, p_id) on conflict do nothing;
  end if;
  return true;
end $$;
comment on function public.animo_fijar(text, uuid, boolean) is 'El atleta fija (o suelta) en su rincón de ánimo un mensaje de su coach o un comentario de un compañero en una publicación suya. Solo lo ve él.';

-- Su rincón: los que siguen existiendo (sin los borrados ni los ocultos), del último fijado al primero
create or replace function public.animo_mios() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_atleta uuid := public.mi_atleta_id();
begin
  if v_atleta is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(x order by x ->> 'fijado_en' desc) from (
    select jsonb_build_object('id', f.id, 'tipo', 'chat', 'ref_id', c.id, 'texto', c.texto, 'autor', 'Tu coach', 'creado_en', c.creado_en, 'fijado_en', f.fijado_en) x
      from public.animo_fijados f join public.comentarios c on c.id = f.comentario_id
     where f.atleta_id = v_atleta and c.atleta_id = v_atleta and c.eliminado_en is null
    union all
    select jsonb_build_object('id', f.id, 'tipo', 'comunidad', 'ref_id', c.id, 'texto', c.texto,
             'autor', coalesce((select m.nombre from public.comunidad_miembros m where m.perfil_id = c.autor_id), case when pf.rol = 'coach' then 'Tu coach' else 'Un compañero' end),
             'creado_en', c.creado_en, 'fijado_en', f.fijado_en)
      from public.animo_fijados f join public.comunidad_comentarios c on c.id = f.comunidad_comentario_id
      join public.comunidad_posts p on p.id = c.post_id left join public.perfiles pf on pf.id = c.autor_id
     where f.atleta_id = v_atleta and p.autor_id = auth.uid() and not c.oculto
  ) s), '[]'::jsonb);
end $$;
comment on function public.animo_mios() is 'Los mensajes del rincón de ánimo del atleta (solo él), con su texto de ahora.';

-- ---------------------------------------------------------------------
-- 3. La foto de portada (bucket «portadas»)
-- ---------------------------------------------------------------------
create table if not exists public.portadas (
  perfil_id       uuid primary key references public.perfiles(id) on delete cascade,
  ruta            text not null unique,
  actualizada_en  timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portadas', 'portadas', false, 614400, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ¿Puede quien pregunta ver esta portada? La suya, el coach, y si los dos están en la comunidad, el equipo
create or replace function public.portada_visible(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.portadas p where p.ruta = p_ruta and (
    p.perfil_id = auth.uid() or public.es_coach()
    or (public.comunidad_activa()
        and exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = p.perfil_id)
        and exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = auth.uid()))))
$$;
drop policy if exists fbe_portadas_ver on storage.objects;
create policy fbe_portadas_ver on storage.objects for select to authenticated
  using (bucket_id = 'portadas' and (split_part(name, '/', 1) = auth.uid()::text or public.portada_visible(name)));
drop policy if exists fbe_portadas_subir on storage.objects;
create policy fbe_portadas_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'portadas' and public.mi_atleta_id() is not null and not public.esta_de_baja()
              and split_part(name, '/', 1) = auth.uid()::text and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$');
drop policy if exists fbe_portadas_borrar on storage.objects;
create policy fbe_portadas_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'portadas' and (public.es_coach() or split_part(name, '/', 1) = auth.uid()::text));

alter table fbe_privado.storage_por_borrar drop constraint if exists storage_por_borrar_bucket_check;
alter table fbe_privado.storage_por_borrar add constraint storage_por_borrar_bucket_check check (bucket in ('archivos', 'voz', 'comunidad', 'apuntes', 'coach-voz', 'portadas'));

-- La anterior (al cambiarla, quitarla o borrarse el perfil), a la cola de borrado de Storage
create or replace function public.portada_fuera() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' or new.ruta is distinct from old.ruta then
    insert into fbe_privado.storage_por_borrar (ruta, bucket) values (old.ruta, 'portadas') on conflict do nothing;
  end if;
  return null;
end $$;
drop trigger if exists portada_fuera on public.portadas;
create trigger portada_fuera after update of ruta or delete on public.portadas
  for each row execute function public.portada_fuera();

-- Poner (la ya subida a su carpeta) o quitar la suya
create or replace function public.portada_poner(p_ruta text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if public.mi_atleta_id() is null then raise exception 'Solo el atleta pone su portada' using errcode = '42501'; end if;
  if public.esta_de_baja() then raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada'; end if;
  if p_ruta is null or p_ruta !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$' or split_part(p_ruta, '/', 1) <> auth.uid()::text then
    raise exception 'Esa foto no vale' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'portadas' and o.name = p_ruta) then
    raise exception 'La foto no se ha subido' using errcode = '22023';
  end if;
  if exists (select 1 from fbe_privado.storage_por_borrar s where s.ruta = p_ruta) then raise exception 'Esa foto ya se quitó' using errcode = '22023'; end if;
  insert into public.portadas as t (perfil_id, ruta) values (auth.uid(), p_ruta)
  on conflict (perfil_id) do update set ruta = excluded.ruta, actualizada_en = now();
  return p_ruta;
end $$;
comment on function public.portada_poner(text) is 'El atleta pone su foto de portada (ya subida a su carpeta del bucket «portadas»). La anterior se encola para borrarse.';

create or replace function public.portada_quitar() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.portadas where perfil_id = auth.uid();
end $$;
comment on function public.portada_quitar() is 'Quita la foto de portada propia (se encola para borrarse de Storage).';

-- La portada de alguien (sin perfil: la propia), si quien pregunta puede verla; si no, null
create or replace function public.portada_de(p_perfil uuid default null) returns text
language sql stable security definer set search_path = '' as $$
  select p.ruta from public.portadas p
  where p.perfil_id = coalesce(p_perfil, auth.uid()) and public.portada_visible(p.ruta)
$$;
comment on function public.portada_de(uuid) is 'La ruta de la foto de portada de un perfil (o la propia) si quien pregunta puede verla.';

-- ---------------------------------------------------------------------
-- 4. La copia completa del coach, con las portadas (el rincón de ánimo es solo del atleta: no va)
-- ---------------------------------------------------------------------
create or replace function public.copia_privada() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Solo el coach'; end if;
  return jsonb_build_object(
    'personal_atleta', coalesce((select jsonb_agg(to_jsonb(t)) from public.personal_atleta t), '[]'::jsonb),
    'mensajes_coach', coalesce((select jsonb_agg(to_jsonb(t)) from public.mensajes_coach t), '[]'::jsonb),
    'musica_coach', coalesce((select jsonb_agg(to_jsonb(t)) from public.musica_coach t), '[]'::jsonb),
    'integraciones', coalesce((select jsonb_agg(to_jsonb(t) - 'salud_huella' - 'calendario_huella') from public.integraciones t), '[]'::jsonb),
    'salud_diaria', coalesce((select jsonb_agg(to_jsonb(t)) from public.salud_diaria t), '[]'::jsonb),
    'salud_copias', coalesce((select jsonb_agg(to_jsonb(t)) from public.salud_copias t), '[]'::jsonb),
    'atajos_coach', coalesce((select jsonb_agg(to_jsonb(t)) from public.atajos_coach t), '[]'::jsonb),
    'contacto_atleta', coalesce((select jsonb_agg(to_jsonb(t)) from public.contacto_atleta t), '[]'::jsonb),
    'agenda_vida', coalesce((select jsonb_agg(to_jsonb(t)) from public.agenda_vida t), '[]'::jsonb),
    'musica_sesion', coalesce((select jsonb_agg(to_jsonb(t)) from public.musica_sesion t), '[]'::jsonb),
    'musica_aperturas_lista', coalesce((select jsonb_agg(to_jsonb(t)) from public.musica_aperturas_lista t), '[]'::jsonb),
    'musica_biblioteca', coalesce((select jsonb_agg(to_jsonb(t)) from public.musica_biblioteca t), '[]'::jsonb),
    'musica_retos', coalesce((select jsonb_agg(to_jsonb(t)) from public.musica_retos t), '[]'::jsonb),
    'portadas', coalesce((select jsonb_agg(to_jsonb(t)) from public.portadas t), '[]'::jsonb));
end $$;
comment on function public.copia_privada() is 'Para la copia completa del coach: las tablas de la 050 y la 051 (sin las huellas de los enlaces), la agenda (069), la música 3 (072) y las portadas (073). Solo el coach.';

-- Nadie toca las tablas directamente
alter table public.animo_fijados enable row level security;
alter table public.portadas enable row level security;
revoke all on public.animo_fijados, public.portadas from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Permisos (como al final de 003 a 072)
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
revoke all on all functions in schema fbe_privado from public, anon, authenticated;
-- (revisión de la 072) la comprobación de las columnas de música la usa una restricción: el servidor (service_role) también tiene que poder llamarla
grant execute on function fbe_privado.musica_url_valida(text) to service_role;

insert into public.fbe_migraciones (numero) values (73)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
