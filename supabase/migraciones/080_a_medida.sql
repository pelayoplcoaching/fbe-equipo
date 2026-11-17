-- =====================================================================
-- FBE Equipo, migración 080: «A su medida» (la individualización por atleta: frases, imagen y ritmo de peso)
--
-- Por qué: cada atleta es distinto y el coach le conoce. Además de sus reglas propias de progresión (046, que ya
-- estaban), el coach le deja escritas frases para sus momentos (el saludo de Hoy, el día de pierna, un ejercicio
-- concreto, cuando empieza la semana antes de tiempo, la semana completa, un récord, un esfuerzo por encima de lo
-- pautado, el ritmo de peso y varias), le pone hasta tres imágenes suyas (perfil y carné, empezar antes y récord) y
-- fija sus márgenes de ritmo de peso (cuánto puede bajar por semana y subir al mes antes de avisarle).
--
--   * atletas.propio (jsonb): las frases por momento, las de cada ejercicio y los márgenes de peso. La forma y la
--     limpieza están en web/src/logica/a-medida.js; la app nunca se fía de lo guardado. Solo la escribe el coach (la
--     tabla atletas no tiene política de escritura para el atleta, que solo lee su ficha), como reglas_motor (046).
--     Sin valor (null), el atleta ve lo de siempre.
--   * atletas_imagenes: sus imágenes (una por hueco), ya reducidas en el navegador del coach, como data URL. Las pone y
--     las quita solo el coach (a_medida_imagen_poner, a_medida_imagen_quitar). Las ve el coach y ese atleta; nadie más
--     (ni el equipo en la comunidad). Se borran con el atleta. Van en la descarga de datos del atleta. No van en la
--     copia completa del coach (las tiene él).
--   * No son datos de salud: no hace falta el consentimiento. El aviso de ritmo de peso se calcula en el móvil del
--     atleta con sus pesos (que sí lo son y ya tienen su consentimiento): aquí solo se guardan los márgenes.
--   * Nada de esto cambia la programación: son frases, imágenes y un aviso.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 079 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 80 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 080 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 80;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 79) then  -- (2) la anterior
    raise exception 'Falta la migración 079 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Las frases y los márgenes, en la ficha del atleta
-- ---------------------------------------------------------------------
alter table public.atletas add column if not exists propio jsonb;
alter table public.atletas drop constraint if exists atletas_propio_objeto;
-- Un objeto y de tamaño acotado (todas las frases de todos los momentos caben de sobra en 40 kB)
alter table public.atletas add constraint atletas_propio_objeto
  check (propio is null or (jsonb_typeof(propio) = 'object' and octet_length(propio::text) <= 40000));
comment on column public.atletas.propio is
  '«A su medida»: { v, frases: { momento: [..] }, ejercicios: [{ texto, frases }], peso: { baja_semana, sube_mes } }. Lo escribe el coach; null = lo de siempre.';

-- ---------------------------------------------------------------------
-- 2. Sus imágenes (una por hueco)
-- ---------------------------------------------------------------------
create table if not exists public.atletas_imagenes (
  atleta_id       uuid not null references public.atletas(id) on delete cascade,
  hueco           text not null,                      -- 'perfil' (perfil y carné), 'antes' (empieza antes) o 'record'
  imagen          text not null,                      -- JPEG o WebP reducida en el navegador del coach, como data URL
  actualizada_en  timestamptz not null default now(),
  primary key (atleta_id, hueco)
);
alter table public.atletas_imagenes drop constraint if exists atletas_imagenes_validas;
alter table public.atletas_imagenes add constraint atletas_imagenes_validas check (
  hueco in ('perfil', 'antes', 'record')
  and char_length(imagen) between 200 and 600000 and imagen ~ '^data:image/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$'
);

alter table public.atletas_imagenes enable row level security;
-- Solo se leen; se escriben con las funciones de abajo
drop policy if exists coach_ver on public.atletas_imagenes;
create policy coach_ver on public.atletas_imagenes for select to authenticated using (public.es_coach());
drop policy if exists atleta_ver on public.atletas_imagenes;
create policy atleta_ver on public.atletas_imagenes for select to authenticated using (atleta_id = public.mi_atleta_id());
revoke all on public.atletas_imagenes from public, anon, authenticated;
grant select on public.atletas_imagenes to authenticated;

-- El coach pone (o cambia) la imagen de un hueco de un atleta
create or replace function public.a_medida_imagen_poner(p_atleta uuid, p_hueco text, p_imagen text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Solo el coach pone las imágenes de un atleta' using errcode = '42501'; end if;
  if p_atleta is null or not exists (select 1 from public.atletas where id = p_atleta) then
    raise exception 'No encuentro a ese atleta' using errcode = '22023';
  end if;
  if p_hueco is null or p_hueco not in ('perfil', 'antes', 'record') then raise exception 'Ese hueco no vale' using errcode = '22023'; end if;
  if p_imagen is null or char_length(p_imagen) not between 200 and 600000
     or p_imagen !~ '^data:image/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$' then
    raise exception 'Esa imagen no vale' using errcode = '22023';
  end if;
  insert into public.atletas_imagenes (atleta_id, hueco, imagen) values (p_atleta, p_hueco, p_imagen)
    on conflict (atleta_id, hueco) do update set imagen = excluded.imagen, actualizada_en = now();
end $$;

-- Y la quita
create or replace function public.a_medida_imagen_quitar(p_atleta uuid, p_hueco text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_coach() then raise exception 'Solo el coach quita las imágenes de un atleta' using errcode = '42501'; end if;
  delete from public.atletas_imagenes where atleta_id = p_atleta and hueco = p_hueco;
end $$;

comment on table public.atletas_imagenes is '«A su medida»: las imágenes propias de un atleta (perfil y carné, empezar antes y récord). Las pone el coach; las ven él y ese atleta.';
comment on function public.a_medida_imagen_poner(uuid, text, text) is 'El coach pone o cambia la imagen propia de un atleta en uno de sus tres huecos.';
comment on function public.a_medida_imagen_quitar(uuid, text) is 'El coach quita la imagen propia de un atleta de un hueco.';

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 079)
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

insert into public.fbe_migraciones (numero) values (80)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
