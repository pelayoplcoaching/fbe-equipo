-- =====================================================================
-- FBE Equipo, migración 048: listas ligeras (conversaciones, última serie, biblioteca e historial)
--
-- Por qué: dos listas del coach bajaban mucho más de lo que enseñan, y cada semana más.
--   * La de conversaciones pedía los últimos 2.000 mensajes con su texto para sacar el último de cada atleta y
--     cuántos tiene sin leer (416 KB con 583 mensajes). Pasados los 2.000, quien llevara tiempo sin escribir
--     salía sin último mensaje y sin su cuenta de no leídos.
--   * La lista de atletas hacía una consulta por atleta para saber cuándo registró su última serie (34 consultas).
--   * La biblioteca de ejercicios (unos 385 KB con sus instrucciones) se bajaba entera cada vez que se abría la
--     biblioteca, Revisar, el editor del programa o el buscador, aunque no hubiera cambiado.
--   * El historial de series de un atleta (todo lo que ha registrado) se bajaba entero en cada visita a Hoy, a
--     Semana y a Progreso: con dos semanas de uso ya eran cientos de KB por visita, y crece cada semana.
--
-- Qué hace: cuatro funciones de solo lectura, sin tablas ni columnas nuevas. Corren con los permisos de quien
-- llama (security invoker): cada uno ve exactamente lo que ya veía (el coach, todo; un atleta, lo suyo).
--   * conversaciones_resumen(): por atleta, el último mensaje que ya ha salido (texto recortado a 300 letras),
--     cuántos del atleta están sin leer y cuántos hay programados.
--   * ultimas_series(atletas): cuándo registró su última serie cada uno.
--   * biblioteca_huella(): una huella de la biblioteca de ejercicios (cuántos hay y un resumen de su contenido).
--     La app guarda la biblioteca en el dispositivo y solo la vuelve a bajar cuando la huella cambia.
--   * historial_huella(atleta, antes): lo mismo para las series de un atleta anteriores a un momento. La app guarda
--     el historial antiguo en el dispositivo y, si la huella es la de lo guardado, solo pide las series recientes.
-- Sin esta migración, la app sigue pidiéndolo como hasta ahora.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 047 (o con instalar.sql en una
-- base nueva). Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 48 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 048 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 48;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 47) then  -- (2) la migración previa
    raise exception 'Antes de la 048 hace falta la 047: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. El resumen de cada conversación (para la lista de Mensajes)
-- ---------------------------------------------------------------------
-- «Programado» = con hora de envío en el futuro (como en la app): no cuenta como último ni como no leído.
create or replace function public.conversaciones_resumen()
returns table (atleta_id uuid, sin_leer integer, programados integer, ultimo jsonb)
language sql stable security invoker set search_path = '' as $$
  select a.atleta_id,
    (select count(*)::integer from public.comentarios x
      where x.atleta_id = a.atleta_id and x.autor = 'atleta' and x.leido_en is null and x.eliminado_en is null
        and not (x.enviar_en is not null and x.enviar_en > now())),
    (select count(*)::integer from public.comentarios x
      where x.atleta_id = a.atleta_id and x.enviar_en is not null and x.enviar_en > now()),
    (select to_jsonb(u) from (
       select x.id, x.atleta_id, x.autor, left(x.texto, 300) as texto, x.creado_en, x.leido_en, x.sesion_id, x.checkin_id,
              x.archivo_id, x.enviar_en, x.adjunto, x.eliminado_en, x.editado_en, x.entregado_en
       from public.comentarios x
       where x.atleta_id = a.atleta_id and not (x.enviar_en is not null and x.enviar_en > now())
       order by x.creado_en desc, x.id desc
       limit 1) u)
  from (select distinct c.atleta_id from public.comentarios c) a;
$$;
comment on function public.conversaciones_resumen() is
  'Por atleta: el último mensaje que ya ha salido, cuántos del atleta están sin leer y cuántos hay programados. Con los permisos de quien llama.';

-- ---------------------------------------------------------------------
-- 2. La última serie registrada de cada atleta (para la lista de atletas)
-- ---------------------------------------------------------------------
create index if not exists series_atleta_registrada_idx on public.series (atleta_id, registrada_en desc);
create or replace function public.ultimas_series(p_atletas uuid[])
returns table (atleta_id uuid, registrada_en timestamptz)
language sql stable security invoker set search_path = '' as $$
  select s.atleta_id, max(s.registrada_en)
  from public.series s
  where s.atleta_id = any(p_atletas)
  group by s.atleta_id;
$$;
comment on function public.ultimas_series(uuid[]) is
  'Cuándo registró su última serie cada atleta de la lista. Con los permisos de quien llama.';

-- ---------------------------------------------------------------------
-- 3. La huella de la biblioteca de ejercicios (para no bajarla entera si no ha cambiado)
-- ---------------------------------------------------------------------
create or replace function public.biblioteca_huella() returns text
language sql stable security invoker set search_path = '' as $$
  select count(*)::text || ':' || coalesce(md5(string_agg(md5(e::text), '' order by e.id)), '')
  from public.ejercicios e;
$$;
comment on function public.biblioteca_huella() is
  'Cuántos ejercicios ve quien llama y un resumen de su contenido: cambia si se añade, se quita o se cambia alguno.';

-- ---------------------------------------------------------------------
-- 4. La huella del historial antiguo de un atleta (para pedir solo las series recientes)
-- ---------------------------------------------------------------------
-- Entra todo lo que la app enseña de cada serie: la serie entera, en qué sesión y de qué ejercicio era (por si se
-- cambia la pauta) y el día de la sesión. Si algo de eso cambia en una serie antigua, la huella cambia.
create or replace function public.historial_huella(p_atleta uuid, p_antes timestamptz) returns text
language sql stable security invoker set search_path = '' as $$
  select count(*)::text || ':' || coalesce(md5(string_agg(
    md5(s::text || '|' || coalesce(p.sesion_id::text, '') || '|' || coalesce(p.ejercicio_id::text, '') || '|' || coalesce(x.fecha_realizada::text, '')),
    '' order by s.id)), '')
  from public.series s
  left join public.sesion_ejercicios p on p.id = s.sesion_ejercicio_id
  left join public.sesiones x on x.id = p.sesion_id
  where s.atleta_id = p_atleta and s.registrada_en < p_antes;
$$;
comment on function public.historial_huella(uuid, timestamptz) is
  'Cuántas series registró el atleta antes de ese momento y un resumen de su contenido. Con los permisos de quien llama.';

-- Permisos (como al final de 003 a 047)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (48)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
