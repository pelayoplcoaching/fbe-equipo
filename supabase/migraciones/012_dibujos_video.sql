-- =====================================================================
-- FBE Atletas, migración 012 (v0.14): líneas y ángulos sobre los vídeos de técnica
-- Un comentario de un vídeo puede llevar un dibujo sobre un fotograma: el momento (segundos) y hasta 12
-- formas (líneas de dos puntos y ángulos de tres: vértice y dos extremos), con las coordenadas de 0 a 1
-- respecto a la imagen del vídeo, para que se vea igual en cualquier pantalla. Lo dibuja quien comenta
-- (el coach al corregir; el atleta, si quiere señalar algo) y, como el texto, no se edita después.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 011 (o con instalar.sql en una
-- base nueva). Se puede repetir sin romper nada.
-- =====================================================================

create table if not exists public.fbe_migraciones (
  numero      smallint primary key,
  aplicada_en timestamptz not null default now()
);
alter table public.fbe_migraciones enable row level security;
revoke all on public.fbe_migraciones from public, anon, authenticated;
do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 12 then
    raise exception 'Esta base ya tiene la migración %: repetir la 012 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 12;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 11) then
    raise exception 'Antes de la 012 hace falta la 011: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

alter table public.comentarios add column if not exists dibujo jsonb;

-- (Con una clave que falte, jsonb_typeof da null: por eso los coalesce, para que el resultado sea false y no null, que
-- un CHECK aceptaría)
-- { "t": segundos, "formas": [ { "tipo": "linea", "p": [[x,y],[x,y]] } | { "tipo": "angulo", "p": [[x,y],[x,y],[x,y]] } ] }
create or replace function public.dibujo_valido(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object'
    and not exists (select 1 from jsonb_object_keys(j) k where k not in ('t', 'formas'))
    and coalesce(jsonb_typeof(j -> 't'), '') = 'number' and (j ->> 't')::numeric >= 0 and (j ->> 't')::numeric < 3600
    and coalesce(jsonb_typeof(j -> 'formas'), '') = 'array' and jsonb_array_length(j -> 'formas') between 1 and 12
    and not exists (
      select 1 from jsonb_array_elements(j -> 'formas') f
      where jsonb_typeof(f) <> 'object'
         or exists (select 1 from jsonb_object_keys(f) k where k not in ('tipo', 'p'))
         or coalesce(f ->> 'tipo', '') not in ('linea', 'angulo')
         or coalesce(jsonb_typeof(f -> 'p'), '') <> 'array'
         or jsonb_array_length(f -> 'p') <> case f ->> 'tipo' when 'linea' then 2 else 3 end
         or exists (
           select 1 from jsonb_array_elements(f -> 'p') pt
           where jsonb_typeof(pt) <> 'array' or jsonb_array_length(pt) <> 2
              or exists (select 1 from jsonb_array_elements(pt) c
                         where jsonb_typeof(c) <> 'number' or (c #>> '{}')::numeric < 0 or (c #>> '{}')::numeric > 1)
         )
    )
$$;

alter table public.comentarios drop constraint if exists comentarios_dibujo_valido;
alter table public.comentarios add constraint comentarios_dibujo_valido check (
  dibujo is null or (archivo_id is not null and public.dibujo_valido(dibujo) is true)
);

-- comentario_preparar (002): el dibujo tampoco se edita después
create or replace function public.comentario_preparar() returns trigger
language plpgsql set search_path = public as $$
declare v_autor text;
begin
  if current_user in ('authenticated', 'anon') then
    v_autor := case when public.es_coach() then 'coach' else 'atleta' end;
  end if;
  if tg_op = 'INSERT' then
    if v_autor is not null then new.autor := v_autor; end if;
    if new.sesion_id is not null then new.atleta_id := public.atleta_de_sesion(new.sesion_id);
    elsif new.checkin_id is not null then new.atleta_id := public.atleta_de_checkin(new.checkin_id);
    elsif new.archivo_id is not null then new.atleta_id := public.atleta_de_archivo(new.archivo_id);
    end if;
    if new.atleta_id is null then
      raise exception 'No se puede comentar aquí';
    end if;
    new.leido_en := null;
    new.creado_en := now();
    return new;
  end if;
  if v_autor is not null then
    if (new.atleta_id, new.sesion_id, new.checkin_id, new.archivo_id, new.autor, new.texto, new.creado_en, new.dibujo)
       is distinct from
       (old.atleta_id, old.sesion_id, old.checkin_id, old.archivo_id, old.autor, old.texto, old.creado_en, old.dibujo) then
      raise exception 'Un comentario no se puede editar' using errcode = '42501';
    end if;
    if old.autor = v_autor and new.leido_en is distinct from old.leido_en then
      raise exception 'Solo quien recibe un comentario lo marca como leído' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- Permisos (como al final de 003 a 011)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (12)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
