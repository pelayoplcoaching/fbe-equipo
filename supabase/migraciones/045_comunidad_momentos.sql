-- =====================================================================
-- FBE Equipo, migración 045 (v0.73): quinta y última tanda de mejoras de la comunidad, «momentos y celebración»
--   · Aniversarios en FBE: el día que alguien cumple 1 mes, 6 meses, 1 año (y cada año más) desde su alta (atletas.fecha_alta),
--     crear_recordatorios() pone en el muro, una vez, «Ana L. cumple 1 año en FBE 🎉» (una publicación de tipo «aniversario» a su
--     nombre, con sus reacciones y comentarios de siempre; quien no sale en el ranking, no), y al coach le llega un aviso el día
--     antes. La tarjeta de Hoy la hace la app con su propia ficha (no hace falta la base).
--   · «<Mes> en el equipo» (comunidad_mes_equipo()): los recuentos del mes pasado del equipo (sesiones, semanas completas, récords
--     compartidos, retos conseguidos, la reacción más usada y la racha más larga, sin nombres) y los de quien mira (sus sesiones,
--     récords, racha y ánimos dados y recibidos). Solo recuentos.
--   · Hitos del equipo (comunidad_hitos()): 100, 500, 1.000, 2.500 y 5.000 sesiones desde que se abrió la comunidad, 50 y 100
--     récords compartidos y 10 retos conseguidos.
--   · Reacciones nuevas (❤️ 😂 🏆, una por persona como siempre) y pegatinas de FBE en los comentarios (comunidad_comentarios.pegatina:
--     la base pone el texto de la pegatina).
--   · Momentos del día (comunidad_posts.tipo = 'momento'): una foto con una línea opcional (hasta 140), que se ve 24 horas (lo hacen
--     los permisos de fila) y que crear_recordatorios() borra después (su foto, a la cola de Storage que vacía la app del coach).
--     Sin comentarios; reacciones, moderación (silenciar, palabras filtradas) y «Avisar al coach», como lo demás.
--   · Lo nuevo no cuenta nada oculto, retenido ni programado que aún no ha salido, ni de quien ya no está dentro; y respeta «No
--     salir en el ranking» (ni en los recuentos del equipo ni en los hitos).
-- Lo que se acepta al entrar no cambia (comunidad-2026-11-b): todo sale de lo que ya se comparte (y los momentos se publican a mano).
-- Se ejecuta en el SQL Editor después de la 044 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 45 then
    raise exception 'Esta base ya tiene la migración %: repetir la 045 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 45;» y, después de ella, todas las siguientes en orden, todo en la misma consulta del SQL Editor (una sola transacción).';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 44) then
    raise exception 'Antes de la 045 hace falta la 044: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Validadores (nunca dan un error: con algo raro, false o null)
-- ---------------------------------------------------------------------
-- Las reacciones (como REACCIONES_TODAS en web/src/logica/celebracion.js)
create or replace function public.comunidad_reaccion_valida(p_tipo text) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  return coalesce(p_tipo in ('fuerza', 'fuego', 'aplauso', 'corazon', 'risa', 'trofeo'), false);
exception when others then
  return false;
end $$;

-- Las pegatinas de FBE (como PEGATINAS) y su texto
create or replace function public.comunidad_pegatina_texto(p_pegatina text) returns text
language plpgsql immutable set search_path = '' as $$
begin
  return case p_pegatina when 'pr' then 'PR' when 'a_tope' then 'A tope' when 'semana_completa' then 'Semana completa'
    when 'constancia' then 'Constancia' when 'vamos' then 'Vamos' when 'dia_pierna' then 'Día de pierna' end;
exception when others then
  return null;
end $$;
create or replace function public.comunidad_pegatina_valida(p_pegatina text) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  return public.comunidad_pegatina_texto(p_pegatina) is not null;
exception when others then
  return false;
end $$;

-- Los meses que se cumplen hoy desde el alta, si es un aniversario que se celebra (1, 6, 12, 24…; null si no). Como
-- mesesCumplidos: el día que no existe en ese mes es el último (31 de enero + 1 mes = 28 o 29 de febrero)
create or replace function public.comunidad_meses_aniversario(p_alta date, p_hoy date) returns integer
language plpgsql immutable set search_path = '' as $$
declare
  m integer;
begin
  if p_alta is null or p_hoy is null then return null; end if;
  m := (extract(year from p_hoy)::integer - extract(year from p_alta)::integer) * 12 + extract(month from p_hoy)::integer - extract(month from p_alta)::integer;
  if m < 1 or not (m in (1, 6) or m % 12 = 0) then return null; end if;
  if (p_alta + make_interval(months => m))::date <> p_hoy then return null; end if;
  return m;
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 2. Columnas y reglas
-- ---------------------------------------------------------------------
-- Los tipos nuevos: «momento» (una foto y una línea, 24 h) y «aniversario» (lo pone la base). La regla de la 029, con ellos
alter table public.comunidad_posts drop constraint if exists comunidad_posts_validos;
alter table public.comunidad_posts add constraint comunidad_posts_validos check (
  tipo in ('aviso', 'post', 'entreno', 'logro', 'encuesta', 'momento', 'aniversario')
  and (texto is null or (char_length(texto) between 1 and 2000 and public.texto_visible(texto)))
  and (tipo not in ('aviso', 'encuesta') or texto is not null)
  and (tipo <> 'encuesta' or char_length(texto) <= 300)
  and (tipo <> 'post' or texto is not null or foto_ruta is not null)
  and (tipo in ('entreno', 'logro', 'aniversario')) = (resumen is not null)
  and (tipo = 'entreno' or sesion_id is null)
  and (tipo = 'logro' or reto_id is null)
  and (tipo in ('post', 'aviso', 'momento') or foto_ruta is null)
  and (tipo = 'encuesta') = (encuesta is not null)
  and (encuesta is null or public.comunidad_encuesta_valida(encuesta))
  and (not fijada or tipo in ('aviso', 'encuesta'))
  and cardinality(menciones) <= 5
  and (foto_ruta is null or foto_ruta ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|coach)/[A-Za-z0-9]{8,40}\.jpg$')
  and (resumen is null or (jsonb_typeof(resumen) = 'object' and pg_column_size(resumen) <= 16000))
);
-- (una regla propia) Un momento: una foto, una línea de hasta 140, sin menciones, ni programado ni con tema; un aniversario: sin
-- texto ni foto, con sus meses
alter table public.comunidad_posts drop constraint if exists comunidad_posts_045_validos;
alter table public.comunidad_posts add constraint comunidad_posts_045_validos check (
  (tipo <> 'momento' or (foto_ruta is not null and fotos is null and (texto is null or char_length(texto) <= 140) and publicar_en is null
                         and cardinality(menciones) = 0 and tema is null))
  and (tipo <> 'aniversario' or (texto is null and foto_ruta is null and tema is null and jsonb_typeof(resumen -> 'meses') = 'number'))
);
create index if not exists comunidad_posts_momentos_idx on public.comunidad_posts (creado_en) where tipo = 'momento';

-- Un aviso al coach también puede ser de un momento o de un aniversario (la regla de la 029, con ellos)
alter table public.comunidad_reportes drop constraint if exists comunidad_reportes_validos;
alter table public.comunidad_reportes add constraint comunidad_reportes_validos check (
  (motivo is null or (char_length(motivo) between 1 and 300 and public.texto_visible(motivo)))
  and (copia_tipo is null or copia_tipo in ('aviso', 'post', 'entreno', 'logro', 'encuesta', 'comentario', 'momento', 'aniversario'))
  and (copia_texto is null or char_length(copia_texto) <= 2000)
  and (copia_autor_nombre is null or char_length(copia_autor_nombre) <= 80)
);

-- Las reacciones nuevas (una por persona y publicación, como siempre)
alter table public.comunidad_reacciones drop constraint if exists comunidad_reacciones_validas;
alter table public.comunidad_reacciones add constraint comunidad_reacciones_validas check (public.comunidad_reaccion_valida(tipo));

-- Las pegatinas: un comentario que es una pegatina lleva su clave (y, de texto, el de la pegatina)
alter table public.comunidad_comentarios add column if not exists pegatina text;
alter table public.comunidad_comentarios drop constraint if exists comunidad_comentarios_045_validos;
alter table public.comunidad_comentarios add constraint comunidad_comentarios_045_validos check (pegatina is null or public.comunidad_pegatina_valida(pegatina));

-- Los aniversarios ya puestos en el muro (uno por persona y aniversario: si lo borra, no vuelve a salir). Solo la base
create table if not exists fbe_privado.comunidad_aniversarios (
  perfil_id  uuid not null references public.perfiles(id) on delete cascade,
  meses      integer not null,
  fecha      date not null,
  creado_en  timestamptz not null default now(),
  primary key (perfil_id, meses)
);
alter table fbe_privado.comunidad_aniversarios enable row level security;
revoke all on fbe_privado.comunidad_aniversarios from public, anon, authenticated;

-- La cola de Storage (032, 034) sabe también del bucket de la comunidad: las fotos de los momentos que caducan
alter table fbe_privado.storage_por_borrar drop constraint if exists storage_por_borrar_bucket_check;
alter table fbe_privado.storage_por_borrar add constraint storage_por_borrar_bucket_check check (bucket in ('archivos', 'voz', 'comunidad'));
-- (revisión) La clave, el bucket y la ruta: las de «archivos» y las de la comunidad tienen la misma forma (<atleta>/….jpg) y una no
-- debe quitar el sitio a la otra
do $$
begin
  if exists (select 1 from pg_constraint c where c.conrelid = 'fbe_privado.storage_por_borrar'::regclass and c.contype = 'p'
             and pg_get_constraintdef(c.oid) = 'PRIMARY KEY (ruta)') then
    alter table fbe_privado.storage_por_borrar drop constraint storage_por_borrar_pkey;
    alter table fbe_privado.storage_por_borrar add constraint storage_por_borrar_pkey primary key (bucket, ruta);
  end if;
end $$;
-- Lo que ya iba a la cola (032, 034, 037), con la clave nueva
create or replace function public.archivo_adjunto_borrar_mensaje() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into fbe_privado.storage_por_borrar (ruta, bucket) select r, case when old.tipo = 'audio' then 'voz' else 'archivos' end
    from unnest(array[old.ruta, old.poster_ruta]) r where r is not null
    on conflict (bucket, ruta) do nothing;
  if old.tipo in ('adjunto', 'documento', 'audio') and exists (select 1 from public.atletas a where a.id = old.atleta_id) then
    for v_id in select c.id from public.comentarios c where c.archivo_id = old.id loop
      perform fbe_privado.comentario_vaciar(v_id);
    end loop;
    update public.comentarios c set archivo_id = null where c.archivo_id = old.id;
  end if;
  return old;
end $$;
create or replace function public.archivo_rutas_sueltas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into fbe_privado.storage_por_borrar (ruta)
    select r from unnest(array[old.ruta, old.poster_ruta]) r
    where r is not null and r is distinct from new.ruta and r is distinct from new.poster_ruta
    on conflict (bucket, ruta) do nothing;
  return null;
end $$;
create or replace function fbe_privado.video_modelo_borrado() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into fbe_privado.storage_por_borrar (ruta, bucket) select r, 'archivos' from unnest(array[old.ruta, old.poster_ruta]) r where r is not null
    on conflict (bucket, ruta) do nothing;
  return old;
end $$;
-- ¿Espera esta ruta a borrarse de Storage? (archivo_proteger, 034: no se vuelve a registrar) Las de los archivos y las notas de voz
create or replace function public.ruta_por_borrar(p_ruta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_ruta is not null and exists (select 1 from fbe_privado.storage_por_borrar s where s.ruta = p_ruta and s.bucket in ('archivos', 'voz'))
$$;
-- El coach quita de la cola lo que ya ha borrado de un bucket (storage_borrado, 032, quita la ruta de todos)
create or replace function public.storage_borrado_cubo(p_bucket text, p_rutas text[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  delete from fbe_privado.storage_por_borrar s where s.bucket = p_bucket and s.ruta = any(coalesce(p_rutas, '{}'));
  get diagnostics n = row_count;
  return n;
end $$;

-- (revisión) Una foto, en una sola publicación (043): tampoco la de un momento caducado que espera a borrarse de Storage
create or replace function fbe_privado.comunidad_fotos_unicas() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v text;
begin
  for v in select distinct f from unnest(array_append(coalesce(new.fotos, '{}'::text[]), new.foto_ruta)) as u(f) where f is not null order by 1 loop
    perform pg_advisory_xact_lock(hashtext('comunidad_foto:' || v));
    if exists (select 1 from public.comunidad_posts x where x.id <> new.id and (x.foto_ruta = v or x.fotos @> array[v]))
       or exists (select 1 from public.comunidad_reportes r where r.resuelto_en is null and (r.copia_foto = v or r.copia_fotos @> array[v]))
       or exists (select 1 from fbe_privado.storage_por_borrar s where s.bucket = 'comunidad' and s.ruta = v) then
      raise exception 'Esa foto ya está en otra publicación' using errcode = '23505';
    end if;
  end loop;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. Quién ve qué: un momento, solo sus 24 horas (el coach, siempre); un aniversario, los demás solo mientras su autor sale en el
--    ranking (si después elige no salir, deja de verse; él y el coach, sí); publicar un momento, como una publicación
-- ---------------------------------------------------------------------
-- ¿Ha elegido esta persona «No salir en el ranking»? (para los permisos de fila del aniversario: la fila del miembro solo la ven él y
-- el coach). Solo responde a quien ve la comunidad
create or replace function public.comunidad_fuera_del_ranking(p_perfil uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (public.es_coach() or public.comunidad_soy_miembro())
    and exists (select 1 from public.comunidad_miembros m where m.perfil_id = p_perfil and m.sin_ranking)
$$;
create or replace function public.comunidad_post_visible(p_post uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.comunidad_posts x where x.id = p_post
                 and (public.es_coach() or (not x.oculta and (not x.retenida or x.autor_id = auth.uid()) and (x.publicar_en is null or x.publicar_en <= now())
                                            and (x.tipo <> 'momento' or x.creado_en > now() - interval '24 hours')
                                            and (x.tipo <> 'aniversario' or x.autor_id = auth.uid() or not public.comunidad_fuera_del_ranking(x.autor_id))
                                            and public.comunidad_soy_miembro() and public.comunidad_autor_visible(x.autor_id))))
$$;
drop policy if exists miembro_ver on public.comunidad_posts;
create policy miembro_ver on public.comunidad_posts for select to authenticated
  using (not oculta and (not retenida or autor_id = auth.uid()) and (publicar_en is null or publicar_en <= now())
         and (tipo <> 'momento' or creado_en > now() - interval '24 hours')
         and (tipo <> 'aniversario' or autor_id = auth.uid() or not public.comunidad_fuera_del_ranking(autor_id))
         and public.comunidad_soy_miembro() and public.comunidad_autor_visible(autor_id));
drop policy if exists miembro_publicar on public.comunidad_posts;
create policy miembro_publicar on public.comunidad_posts for insert to authenticated
  with check (autor_id = auth.uid() and tipo in ('post', 'momento') and not fijada and not oculta and sesion_id is null and resumen is null
              and atleta_id = public.mi_atleta_id() and public.comunidad_soy_miembro());

-- ---------------------------------------------------------------------
-- 4. Al publicar y al comentar
-- ---------------------------------------------------------------------
-- Publicar desde la app (029), con los momentos: el coach, avisos, encuestas y momentos; un atleta, publicaciones y momentos
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
    if new.tipo is distinct from 'aviso' and new.tipo is distinct from 'encuesta' and new.tipo is distinct from 'momento' then
      raise exception 'Como coach, en el muro publicas avisos, encuestas y momentos' using errcode = '42501';
    end if;
    if new.foto_ruta is not null and (new.tipo not in ('aviso', 'momento') or new.foto_ruta not like 'coach/%') then
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
    if new.tipo is distinct from 'post' and new.tipo is distinct from 'momento' then
      raise exception 'Los avisos y las encuestas son del coach, y los entrenos y los logros se comparten desde su sitio' using errcode = '42501';
    end if;
    if new.foto_ruta is not null and (new.atleta_id is null or new.foto_ruta not like new.atleta_id::text || '/%') then
      raise exception 'La foto no va en su sitio' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- Un momento (después del tema de la 043 y de la moderación de la 044): sin tema, sin varias fotos, sin menciones y con una sola
-- línea de hasta 140; un aniversario, solo lo pone la base (sin tema)
create or replace function public.comunidad_post_momento() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.tipo = 'aniversario' then
    if current_user in ('authenticated', 'anon') then raise exception 'Los aniversarios los pone la base' using errcode = '42501'; end if;
    new.tema := null;
    return new;
  end if;
  if new.tipo is distinct from 'momento' then return new; end if;
  new.tema := null;
  new.fotos := null;
  new.menciones := '{}';
  new.mejor_comentario := null;
  new.texto := nullif(btrim(regexp_replace(coalesce(new.texto, ''), '[[:space:][:cntrl:]]+', ' ', 'g')), '');
  if char_length(new.texto) > 140 then raise exception 'La línea de un momento, hasta 140 letras' using errcode = '22023'; end if;
  if new.foto_ruta is null then raise exception 'Un momento lleva una foto' using errcode = '22023'; end if;
  return new;
end $$;
drop trigger if exists comunidad_posts_ah_momento on public.comunidad_posts;
create trigger comunidad_posts_ah_momento before insert on public.comunidad_posts
  for each row execute function public.comunidad_post_momento();

-- La moderación de la 044, con el modo lento también en los momentos (una publicación o un momento cada X minutos)…
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
    select max(x.creado_en) into v_ultima from public.comunidad_posts x where x.autor_id = p_autor and x.tipo in ('post', 'momento');
    if v_ultima > now() - make_interval(mins => m.lento_min) then
      raise exception 'Modo lento: una publicación cada % minutos. Podrás volver a publicar a las %.', m.lento_min,
        to_char((v_ultima + make_interval(mins => m.lento_min)) at time zone 'Europe/Madrid', 'HH24:MI') using errcode = '54000';
    end if;
  end if;
  return fbe_privado.comunidad_texto_filtrado(p_texto, m.palabras);
end $$;
-- … y sin el aniversario (lo pone la base a nombre de quien lo cumple: ni se retiene ni se para si está silenciado)
create or replace function fbe_privado.comunidad_post_moderar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.retenida := new.tipo not in ('aviso', 'encuesta', 'aniversario') and fbe_privado.comunidad_moderar_entrada(new.autor_id, new.tipo in ('post', 'momento'), new.texto);
  return new;
end $$;

-- Al comentar: un momento no lleva comentarios; una pegatina lleva su texto (lo pone la base) y ninguna mención
create or replace function fbe_privado.comunidad_comentario_045() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.comunidad_posts x where x.id = new.post_id and x.tipo = 'momento') then
    raise exception 'Los momentos no llevan comentarios: reacciona' using errcode = '42501';
  end if;
  if new.pegatina is not null then
    if not public.comunidad_pegatina_valida(new.pegatina) then raise exception 'Esa pegatina no existe' using errcode = '22023'; end if;
    new.texto := public.comunidad_pegatina_texto(new.pegatina);
    new.menciones := '{}';
  end if;
  return new;
end $$;
drop trigger if exists comunidad_comentarios_ae_pegatina on public.comunidad_comentarios;
create trigger comunidad_comentarios_ae_pegatina before insert on public.comunidad_comentarios
  for each row execute function fbe_privado.comunidad_comentario_045();

-- Reaccionar (027), con las reacciones nuevas: una por persona y publicación; la misma otra vez la quita, otra la cambia
create or replace function public.comunidad_reaccionar(p_post uuid, p_tipo text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_antes text;
begin
  if v_uid is null or not (public.es_coach() or public.comunidad_soy_miembro()) then
    raise exception 'Para reaccionar tienes que estar en la comunidad' using errcode = '42501';
  end if;
  if not public.comunidad_post_visible(p_post) then raise exception 'Esa publicación ya no está' using errcode = '42501'; end if;
  if p_tipo is not null and not public.comunidad_reaccion_valida(p_tipo) then
    raise exception 'Esa reacción no existe' using errcode = '22023';
  end if;
  select r.tipo into v_antes from public.comunidad_reacciones r where r.post_id = p_post and r.autor_id = v_uid;
  if p_tipo is null or v_antes = p_tipo then
    delete from public.comunidad_reacciones where post_id = p_post and autor_id = v_uid;
    return null;
  end if;
  insert into public.comunidad_reacciones (post_id, autor_id, atleta_id, tipo)
  values (p_post, v_uid, case when public.es_coach() then null else public.mi_atleta_id() end, p_tipo)
  on conflict (post_id, autor_id) do update set tipo = excluded.tipo, creado_en = now();
  return p_tipo;
end $$;

-- ---------------------------------------------------------------------
-- 5. Recuentos: «<Mes> en el equipo» y los hitos
-- ---------------------------------------------------------------------
-- Los récords compartidos de unas personas entre dos fechas (Madrid): los de sus entrenos que se ven (ni ocultos ni retenidos)
create or replace function fbe_privado.comunidad_records_entre(p_perfiles uuid[], p_desde date, p_hasta date) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.comunidad_posts p
    cross join lateral jsonb_array_elements(case when jsonb_typeof(p.resumen -> 'ejercicios') = 'array' then p.resumen -> 'ejercicios' else '[]'::jsonb end) as e(v)
  where p.tipo = 'entreno' and not p.oculta and not p.retenida and (p.publicar_en is null or p.publicar_en <= now()) and p.autor_id = any (p_perfiles)
    and (p.creado_en at time zone 'Europe/Madrid')::date between p_desde and p_hasta
    and coalesce((e.v ->> 'record')::boolean, false)
$$;

-- El mes (p_mes: cualquier día suyo; sin él, el mes pasado): lo del equipo (sin quien no sale en el ranking ni quien ya no está
-- dentro; la reacción más usada, en lo que se ve y de quien sigue dentro, sale en el ranking o es el coach; la racha más larga,
-- solo el número) y lo de
-- quien mira (el coach, solo lo del equipo). Solo recuentos. null para quien no ve la comunidad o un mes que aún no ha empezado.
create or replace function public.comunidad_mes_equipo(p_mes date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_hoy date := fbe_privado.comunidad_hoy();
  -- (un día del mes: el que se pide o, sin él, el último del mes pasado)
  v_dia date := coalesce(p_mes, fbe_privado.comunidad_hoy() - extract(day from fbe_privado.comunidad_hoy())::integer);
  v_desde date := make_date(extract(year from v_dia)::integer, extract(month from v_dia)::integer, 1);
  v_hasta date := (make_date(extract(year from v_dia)::integer, extract(month from v_dia)::integer, 1) + interval '1 month')::date - 1;
  v_atletas uuid[];
  v_perfiles uuid[];
  v_yo uuid := auth.uid();
  v_atleta uuid;
begin
  if v_yo is null or not (public.es_coach() or public.comunidad_soy_miembro()) or v_desde > v_hoy then return null; end if;
  select coalesce(array_agg(d.atleta_id), '{}'), coalesce(array_agg(d.perfil_id), '{}') into v_atletas, v_perfiles
  from fbe_privado.comunidad_dentro d where not d.sin_ranking;
  if not public.es_coach() then
    select d.atleta_id into v_atleta from fbe_privado.comunidad_dentro d where d.perfil_id = v_yo;
  end if;
  return jsonb_build_object(
    'mes', to_char(v_desde, 'YYYY-MM'),
    'equipo', jsonb_build_object(
      'sesiones', (select count(*)::integer from fbe_privado.comunidad_sesiones_validas(v_atletas) v where v.fecha between v_desde and v_hasta),
      'semanas_completas', (select count(*)::integer from fbe_privado.comunidad_semanas_de(v_atletas) x where x.lunes between v_desde and v_hasta and x.hechas >= x.previstas),
      'records', fbe_privado.comunidad_records_entre(v_perfiles, v_desde, v_hasta),
      'retos', (select count(*)::integer from public.comunidad_retos r where r.hasta between v_desde and v_hasta
                and exists (select 1 from unnest(v_atletas) a(id) where fbe_privado.comunidad_reto_conseguido(r.id, a.id))),
      'reaccion', (select r.tipo from public.comunidad_reacciones r join public.comunidad_posts x on x.id = r.post_id
                   where (r.creado_en at time zone 'Europe/Madrid')::date between v_desde and v_hasta
                     and not x.oculta and not x.retenida and (x.publicar_en is null or x.publicar_en <= now())
                     and (exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = r.autor_id and not d.sin_ranking) or exists (select 1 from public.perfiles p where p.id = r.autor_id and p.rol = 'coach'))
                     and (exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = x.autor_id and not d.sin_ranking) or exists (select 1 from public.perfiles p where p.id = x.autor_id and p.rol = 'coach'))
                   group by r.tipo order by count(*) desc, array_position(array['fuerza', 'fuego', 'aplauso', 'corazon', 'risa', 'trofeo'], r.tipo) limit 1),
      'racha', (select coalesce(max(r.racha), 0)::integer from fbe_privado.comunidad_rachas_de(v_atletas) r),
      'miembros', cardinality(v_atletas)),
    'yo', case when v_atleta is not null then jsonb_build_object(
      'sesiones', fbe_privado.comunidad_hechas(v_atleta, v_desde, v_hasta),
      'records', fbe_privado.comunidad_records_entre(array[v_yo], v_desde, v_hasta),
      'racha', coalesce((select r.racha from fbe_privado.comunidad_rachas_de(array[v_atleta]) r), 0),
      'animos_dados', (select count(*)::integer from public.comunidad_animos a where a.de = v_yo and (a.creado_en at time zone 'Europe/Madrid')::date between v_desde and v_hasta
                       and (exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = a.para) or exists (select 1 from public.perfiles p where p.id = a.para and p.rol = 'coach'))),
      'animos_recibidos', (select count(*)::integer from public.comunidad_animos a where a.para = v_yo and (a.creado_en at time zone 'Europe/Madrid')::date between v_desde and v_hasta
                           and (exists (select 1 from fbe_privado.comunidad_dentro d where d.perfil_id = a.de) or exists (select 1 from public.perfiles p where p.id = a.de and p.rol = 'coach')))) end
  );
end $$;

-- Lo que llevan los hitos: desde que se abrió la comunidad (el primero que entró), las sesiones y los récords compartidos de los
-- de dentro que salen en el ranking, y los retos que alguno de ellos ha conseguido
create or replace function fbe_privado.comunidad_hitos_valores() returns table (sesiones integer, records integer, retos integer)
language sql stable security definer set search_path = '' as $$
  with c as (
    select coalesce(array_agg(d.atleta_id), '{}') as atletas, coalesce(array_agg(d.perfil_id), '{}') as perfiles
    from fbe_privado.comunidad_dentro d where not d.sin_ranking
  ), desde as (
    select coalesce(min((m.creado_en at time zone 'Europe/Madrid')::date), fbe_privado.comunidad_hoy()) as d from public.comunidad_miembros m
  )
  select (select count(*)::integer from fbe_privado.comunidad_sesiones_validas((select c.atletas from c)) v where v.fecha >= (select x.d from desde x)),
         fbe_privado.comunidad_records_entre((select c.perfiles from c), (select x.d from desde x), fbe_privado.comunidad_hoy()),
         (select count(*)::integer from public.comunidad_retos r where r.hasta >= (select x.d from desde x)
            and exists (select 1 from unnest((select c.atletas from c)) a(id) where fbe_privado.comunidad_reto_conseguido(r.id, a.id)))
$$;
-- Los hitos del equipo (como HITOS en web/src/logica/celebracion.js), para quien ve la comunidad
create or replace function public.comunidad_hitos()
returns table (clave text, medida text, meta integer, valor integer)
language sql stable security definer set search_path = '' as $$
  select h.clave, h.medida, h.meta, case h.medida when 'sesiones' then v.sesiones when 'records' then v.records else v.retos end
  from (values ('sesiones_100', 'sesiones', 100, 1), ('sesiones_500', 'sesiones', 500, 2), ('sesiones_1000', 'sesiones', 1000, 3), ('sesiones_2500', 'sesiones', 2500, 4),
               ('sesiones_5000', 'sesiones', 5000, 5), ('records_50', 'records', 50, 6), ('records_100', 'records', 100, 7), ('retos_10', 'retos', 10, 8)) as h(clave, medida, meta, orden)
  cross join fbe_privado.comunidad_hitos_valores() v
  where auth.uid() is not null and (public.es_coach() or public.comunidad_soy_miembro())
  order by h.orden
$$;

-- (revisión) El aniversario lo pone la base: no cuenta como publicación de nadie en la insignia ni en el panel del coach (044)
-- Las insignias de alguien (042): la «primera publicación» no cuenta el aniversario (lo pone la base)
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
$$;

-- El panel (044), sin los aniversarios
create or replace function public.comunidad_panel() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_lunes date := fbe_privado.comunidad_lunes();
begin
  if not public.es_coach() then raise exception 'El panel de la comunidad es del coach' using errcode = '42501'; end if;
  return (
    with act as materialized (
      select x.autor_id as perfil_id, x.creado_en, 'p' as k from public.comunidad_posts x
      where x.creado_en >= now() - interval '35 days' and x.creado_en <= now() and x.atleta_id is not null and x.tipo <> 'aniversario'
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
                                 'ultima', (select max(z.creado_en) from (select x.creado_en from public.comunidad_posts x where x.autor_id = d.perfil_id and x.tipo <> 'aniversario'
                                            union all select c.creado_en from public.comunidad_comentarios c where c.autor_id = d.perfil_id
                                            union all select r.creado_en from public.comunidad_reacciones r where r.autor_id = d.perfil_id) z)) order by d.nombre)
                             from fbe_privado.comunidad_dentro d
                             where not exists (select 1 from public.comunidad_posts x where x.autor_id = d.perfil_id and x.creado_en > now() - interval '30 days' and x.tipo <> 'aniversario')
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
-- 6. Lo que hace crear_recordatorios(): los aniversarios del día y borrar los momentos caducados
-- ---------------------------------------------------------------------
-- El muro, el día de su aniversario: una vez por persona y aniversario, de quien está dentro y sale en el ranking (la comunidad,
-- abierta). Devuelve cuántos ha puesto
create or replace function fbe_privado.comunidad_crear_aniversarios(p_hoy date) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if not public.comunidad_activa() then return 0; end if;
  with nuevos as (
    insert into fbe_privado.comunidad_aniversarios (perfil_id, meses, fecha)
    select d.perfil_id, public.comunidad_meses_aniversario(a.fecha_alta, p_hoy), p_hoy
    from fbe_privado.comunidad_dentro d join public.atletas a on a.id = d.atleta_id
    where not d.sin_ranking and public.comunidad_meses_aniversario(a.fecha_alta, p_hoy) is not null
    on conflict (perfil_id, meses) do nothing
    returning perfil_id, meses
  )
  insert into public.comunidad_posts (autor_id, atleta_id, tipo, resumen)
  select x.perfil_id, d.atleta_id, 'aniversario', jsonb_build_object('meses', x.meses, 'fecha', p_hoy)
  from nuevos x join fbe_privado.comunidad_dentro d on d.perfil_id = x.perfil_id;
  get diagnostics n = row_count;
  return n;
end $$;

-- Los momentos de hace más de 24 horas se borran; su foto, a la cola de Storage (salvo la que guarda un aviso abierto al coach:
-- esa se borra al resolverlo, como siempre). Devuelve cuántos ha borrado
create or replace function fbe_privado.comunidad_limpiar_momentos(p_ahora timestamptz) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  insert into fbe_privado.storage_por_borrar (ruta, bucket)
  select x.foto_ruta, 'comunidad' from public.comunidad_posts x
  where x.tipo = 'momento' and x.creado_en <= p_ahora - interval '24 hours' and x.foto_ruta is not null
    and not exists (select 1 from public.comunidad_reportes r where r.resuelto_en is null and (r.copia_foto = x.foto_ruta or r.copia_fotos @> array[x.foto_ruta]))
  on conflict (bucket, ruta) do nothing;
  delete from public.comunidad_posts x where x.tipo = 'momento' and x.creado_en <= p_ahora - interval '24 hours';
  get diagnostics n = row_count;
  return n;
end $$;

-- La cola de Storage (034), para el coach: también las fotos de la comunidad
create or replace function public.storage_pendiente_cubos(p_limite integer default 200) returns table (ruta text, bucket text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  return query select s.ruta, s.bucket from fbe_privado.storage_por_borrar s order by s.creado_en, s.ruta limit least(greatest(coalesce(p_limite, 200), 1), 1000);
end $$;

-- ---------------------------------------------------------------------
-- 7. Los recordatorios: lo de la 044 (con cada bloque a prueba de fallos), más los aniversarios (la tarjeta del muro el mismo día;
--    el aviso al coach el día antes) y borrar los momentos caducados, cada uno en su propio bloque
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

  -- (v0.73, 045) El aniversario en FBE, en el muro, el mismo día (una vez por persona y aniversario). En su propio bloque
  begin
    perform fbe_privado.comunidad_crear_aniversarios(v_hoy);
  exception when others then
    raise warning 'FBE: aniversarios del muro no puestos: %', sqlerrm;
  end;

  -- (v0.73, 045) Al coach, el día antes (de 9:00 a 21:00, Madrid), quién cumple mañana 1 mes, 6 meses o años en FBE (de sus
  -- atletas activos, estén o no en la comunidad): «Mañana Lucía cumple 1 año en FBE 🎉». Una vez por atleta y día; lleva a su chat
  begin
  if v_local >= v_hoy + time '09:00' and v_local < v_hoy + time '21:00' then
    with x as materialized (
      select c.id as coach, a.id as atleta, coalesce(fbe_privado.nombre_corto(a.nombre), 'Alguien') as nombre, m.meses
      from public.atletas a
      join public.perfiles p on p.id = a.perfil_id and p.rol <> 'coach'
      cross join lateral (select public.comunidad_meses_aniversario(a.fecha_alta, v_hoy + 1) as meses) m
      cross join public.perfiles c
      where c.rol = 'coach' and a.estado <> 'baja' and m.meses is not null
    )
    select count(*) into v_m from x
    where fbe_privado.notificar_seguro(x.coach, 'comunidad',
            'Mañana ' || x.nombre || ' cumple ' || case when x.meses = 1 then '1 mes' when x.meses < 12 then x.meses || ' meses' when x.meses = 12 then '1 año'
                                                       else (x.meses / 12) || ' años' end || ' en FBE 🎉',
            'Felicítale mañana en el chat o en Equipo.', '#mensajes/' || x.atleta, 'comunidad_aniversario:' || x.atleta || ':' || (v_hoy + 1), p_ahora,
            (v_hoy + 2) at time zone 'Europe/Madrid');
    v_n := v_n + v_m;
  end if;
  exception when others then
    raise warning 'FBE: aviso de los aniversarios al coach no creado: %', sqlerrm;
  end;

  -- (v0.73, 045) Los momentos de hace más de 24 horas se borran (y su foto va a la cola de Storage). En su propio bloque
  begin
    perform fbe_privado.comunidad_limpiar_momentos(p_ahora);
  exception when others then
    raise warning 'FBE: momentos caducados no borrados: %', sqlerrm;
  end;

  return v_n;
end $$;

-- Permisos (como al final de 003 a 044)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (45)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
