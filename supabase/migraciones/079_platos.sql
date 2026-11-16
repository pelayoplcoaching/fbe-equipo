-- =====================================================================
-- FBE Equipo, migración 079: La foto del plato y comer fuera
--
-- Por qué: apuntar cada comida es lo más pesado de llevar la nutrición. Con una foto del plato el atleta lo deja hecho
-- en dos toques y su coach ve lo que come de verdad. Y cuando come fuera (un restaurante, un viaje, casa de alguien),
-- lo marca, le sale una pauta corta y esa comida cuenta como hecha: no rompe su día ni su racha.
--
--   * menu_comidas gana dos columnas: fuera (esa comida la hizo fuera de casa) y con_foto (tiene foto guardada). La
--     segunda la lleva la base: la app no la puede cambiar a mano.
--   * menu_fotos: la foto de una comida del menú (una por comida) y su miniatura, las dos ya reducidas en el móvil y sin
--     los datos de la cámara. Es dato de salud, como el menú: hace falta el consentimiento del atleta. La sube solo el
--     atleta (plato_foto_guardar) y al subirla la comida queda marcada como hecha. La ven él y su coach. La quitan él o
--     su coach (plato_foto_quitar).
--   * Se guardan 30 días: pasado ese tiempo dejan de verse y se borran solas (al abrir la app cualquiera con sesión, al
--     subir una foto nueva y, si la base tiene pg_cron, cada noche). La comida sigue en el menú como hecha; solo se va
--     la foto. Al retirar el consentimiento de datos de salud, se borran todas las suyas.
--   * Se borran con la comida y con el atleta. Van en la descarga de datos del atleta mientras existan. No van en la
--     copia completa del coach: son temporales.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 078 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 79 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 079 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 79;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 78) then  -- (2) la anterior
    raise exception 'Falta la migración 078 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. El menú: comer fuera y si tiene foto
-- ---------------------------------------------------------------------
alter table public.menu_comidas add column if not exists fuera boolean not null default false;
alter table public.menu_comidas add column if not exists con_foto boolean not null default false;
-- Comer fuera no es una receta
alter table public.menu_comidas drop constraint if exists menu_comidas_fuera;
alter table public.menu_comidas add constraint menu_comidas_fuera check (not fuera or receta_id is null);

-- con_foto lo lleva la base (plato_foto_guardar, plato_foto_quitar y la limpieza): desde la app no se cambia
create or replace function public.menu_comida_con_foto() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then new.con_foto := false; else new.con_foto := old.con_foto; end if;
  end if;
  -- Una comida con foto no cambia de día (la foto es de ese día)
  if tg_op = 'UPDATE' and old.con_foto and new.fecha is distinct from old.fecha then
    raise exception 'Una comida con foto no se cambia de día' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists menu_comidas_ab_con_foto on public.menu_comidas;
create trigger menu_comidas_ab_con_foto before insert or update on public.menu_comidas
  for each row execute function public.menu_comida_con_foto();

-- ---------------------------------------------------------------------
-- 2. Las fotos
-- ---------------------------------------------------------------------
create table if not exists public.menu_fotos (
  entrada_id uuid primary key references public.menu_comidas(id) on delete cascade,
  atleta_id  uuid not null references public.atletas(id) on delete cascade,
  fecha      date not null,                       -- el día de esa comida (para pedir las de una semana)
  foto       text not null,                       -- JPEG reducida en el móvil (lado largo 1024 px), como data URL
  mini       text not null,                       -- su miniatura (160 px), para las listas
  creado_en  timestamptz not null default now()
);
create index if not exists menu_fotos_atleta_idx on public.menu_fotos (atleta_id, fecha);
create index if not exists menu_fotos_creado_idx on public.menu_fotos (creado_en);
alter table public.menu_fotos drop constraint if exists menu_fotos_validas;
alter table public.menu_fotos add constraint menu_fotos_validas check (
  fecha >= date '2020-01-01' and fecha < date '2100-01-01'
  and char_length(foto) between 200 and 400000 and foto ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$'
  and char_length(mini) between 200 and 24000 and mini ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$'
);

alter table public.menu_fotos enable row level security;
-- Solo se leen (30 días); se escriben con las funciones de abajo
drop policy if exists coach_ver on public.menu_fotos;
create policy coach_ver on public.menu_fotos for select to authenticated
  using (public.es_coach() and creado_en > now() - interval '30 days');
drop policy if exists atleta_ver on public.menu_fotos;
create policy atleta_ver on public.menu_fotos for select to authenticated
  using (atleta_id = public.mi_atleta_id() and creado_en > now() - interval '30 days');
revoke all on public.menu_fotos from public, anon, authenticated;
grant select on public.menu_fotos to authenticated;

create schema if not exists fbe_privado;

-- La limpieza: las fotos de más de 30 días se borran y su comida deja de decir que tiene foto
create or replace function fbe_privado.platos_purgar() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  with fuera as (
    delete from public.menu_fotos where creado_en <= now() - interval '30 days' returning entrada_id
  ), marcadas as (
    update public.menu_comidas m set con_foto = false from fuera f where m.id = f.entrada_id returning 1
  )
  select count(*) into n from fuera;
  return n;
end $$;

-- La misma limpieza, para que la app la pida al abrirse (una vez por sesión): así no depende de pg_cron. Solo borra lo caducado.
create or replace function public.platos_limpiar() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sin sesión' using errcode = '42501'; end if;
  perform fbe_privado.platos_purgar();
end $$;

-- El atleta sube (o cambia) la foto de una comida suya: la comida queda hecha. Sin p_entrada, la comida se apunta aquí
-- mismo (p_fecha, p_toma y, si quiere, p_texto): o se guardan las dos cosas o ninguna. Devuelve el id de la comida.
drop function if exists public.plato_foto_guardar(uuid, text, text);
create or replace function public.plato_foto_guardar(p_entrada uuid, p_foto text, p_mini text,
  p_fecha date default null, p_toma text default null, p_texto text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v public.menu_comidas; v_hoy date := (now() at time zone 'Europe/Madrid')::date; v_yo uuid := public.mi_atleta_id(); v_texto text;
begin
  if v_yo is null then raise exception 'Eso no es tuyo' using errcode = '42501'; end if;
  if public.esta_de_baja() then raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada' using errcode = '42501'; end if;
  if not public.consentimiento_salud_de_atleta(v_yo) then
    raise exception 'Para guardar la foto del plato hace falta tu consentimiento de datos de salud' using errcode = '42501';
  end if;
  if p_foto is null or p_mini is null
     or char_length(p_foto) not between 200 and 400000 or p_foto !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$'
     or char_length(p_mini) not between 200 and 24000 or p_mini !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then
    raise exception 'Esa foto no vale' using errcode = '22023';
  end if;
  if p_entrada is null then
    v_texto := nullif(btrim(coalesce(p_texto, '')), '');
    if p_fecha is null or p_toma is null then raise exception 'Falta el día o la comida' using errcode = '22023'; end if;
    -- (un día de margen por delante: quien está de viaje en otra zona horaria)
    if p_fecha < v_hoy - 7 or p_fecha > v_hoy + 1 then raise exception 'La foto, de una comida de esta semana' using errcode = '22023'; end if;
    insert into public.menu_comidas (atleta_id, fecha, toma, texto, hecho) values (v_yo, p_fecha, p_toma, left(coalesce(v_texto, 'Foto del plato'), 120), true)
      returning * into v;
  else
    -- (for update: quitar y cambiar a la vez no dejan «tiene foto» descuadrado)
    select * into v from public.menu_comidas where id = p_entrada for update;
    if v.id is null or v.atleta_id is distinct from v_yo then raise exception 'Eso no es tuyo' using errcode = '42501'; end if;
    if v.fecha < v_hoy - 7 or v.fecha > v_hoy + 1 then raise exception 'La foto, de una comida de esta semana' using errcode = '22023'; end if;
  end if;
  -- Como mucho 12 fotos por día y 150 guardadas a la vez (sin contar la que se cambia)
  if (select count(*) from public.menu_fotos f where f.atleta_id = v.atleta_id and f.fecha = v.fecha and f.entrada_id <> v.id) >= 12 then
    raise exception 'Como mucho, 12 fotos por día' using errcode = '22023';
  end if;
  if (select count(*) from public.menu_fotos f where f.atleta_id = v.atleta_id and f.entrada_id <> v.id) >= 150 then
    raise exception 'Tienes demasiadas fotos guardadas: quita alguna antes' using errcode = '22023';
  end if;
  insert into public.menu_fotos (entrada_id, atleta_id, fecha, foto, mini) values (v.id, v.atleta_id, v.fecha, p_foto, p_mini)
    on conflict (entrada_id) do update set foto = excluded.foto, mini = excluded.mini, fecha = excluded.fecha, creado_en = now();
  update public.menu_comidas set con_foto = true, hecho = true where id = v.id;
  perform fbe_privado.platos_purgar();
  return v.id;
end $$;

-- Quitar la foto (la comida se queda como esté): el atleta, las suyas (también de baja: quitar no añade nada); el coach, cualquiera
create or replace function public.plato_foto_quitar(p_entrada uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.menu_comidas;
begin
  select * into v from public.menu_comidas where id = p_entrada for update;
  if v.id is null then return; end if;
  if not public.es_coach() and (public.mi_atleta_id() is null or v.atleta_id is distinct from public.mi_atleta_id()) then
    raise exception 'Eso no es tuyo' using errcode = '42501';
  end if;
  delete from public.menu_fotos where entrada_id = v.id;
  update public.menu_comidas set con_foto = false where id = v.id;
end $$;

-- Al retirar el consentimiento de datos de salud, sus fotos se borran (el menú escrito se queda, como siempre). «before»,
-- como el de la 051. Y al quedarse la ficha sin cuenta, también.
create or replace function fbe_privado.platos_al_retirar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_atleta uuid;
begin
  if old.tipo = 'datos_salud' and old.revocado_en is null and (tg_op = 'DELETE' or new.revocado_en is not null)
     and not exists (select 1 from public.consentimientos c where c.perfil_id = old.perfil_id and c.tipo = 'datos_salud' and c.revocado_en is null and c.id <> old.id) then
    for v_atleta in select a.id from public.atletas a where a.perfil_id = old.perfil_id loop
      delete from public.menu_fotos where atleta_id = v_atleta;
      update public.menu_comidas set con_foto = false where atleta_id = v_atleta and con_foto;
    end loop;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists consentimientos_platos_al_retirar on public.consentimientos;
create trigger consentimientos_platos_al_retirar before update or delete on public.consentimientos
  for each row execute function fbe_privado.platos_al_retirar();

comment on table public.menu_fotos is 'La foto del plato de una comida del menú (dato de salud). Se guarda 30 días.';
comment on function public.plato_foto_guardar(uuid, text, text, date, text, text) is 'El atleta sube o cambia la foto de una comida suya (o la apunta con su foto): queda hecha. Con su consentimiento de salud.';
comment on function public.platos_limpiar() is 'Borra las fotos de platos de más de 30 días. La pide la app al abrirse.';
comment on function public.plato_foto_quitar(uuid) is 'Quita la foto de una comida. El atleta, las suyas; el coach, cualquiera.';

-- Cada noche, si la base tiene pg_cron (si no, la limpieza corre igual al subir cualquier foto)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      execute $q$select cron.schedule('fbe-platos', '17 3 * * *', 'select fbe_privado.platos_purgar()')$q$;
      raise notice 'FBE: limpieza de las fotos de platos programada (tarea fbe-platos, cada noche).';
    exception when others then
      raise warning 'FBE: no se ha podido programar la tarea fbe-platos (%). Las fotos las limpia igual la app al abrirse.', sqlerrm;
    end;
  else
    raise notice 'FBE: sin pg_cron: las fotos de platos de más de 30 días las limpia la app al abrirse (platos_limpiar).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 078)
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
revoke all on all functions in schema fbe_privado from public, anon, authenticated;
-- (revisión de la 072) la comprobación de las columnas de música la usa una restricción: el servidor (service_role) también tiene que poder llamarla
grant execute on function fbe_privado.musica_url_valida(text) to service_role;

insert into public.fbe_migraciones (numero) values (79)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
