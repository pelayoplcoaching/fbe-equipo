-- =====================================================================
-- App de atletas FBE — migración 002 (v0.2)
-- Se ejecuta DESPUÉS de schema.sql, en el SQL Editor de Supabase (pegar → Run).
-- Se puede repetir: no duplica nada ni borra datos.
--
-- Añade:
--   · Biblioteca ampliada: errores comunes, alternativas equivalentes, tipo y rango recomendado.
--   · Variante en la pauta («pausa 2 s», «agarre cerrado») y cambio de ejercicio por una alternativa.
--   · Revisión del coach: sesiones y check-ins quedan «pendientes» hasta que los revisas o comentas.
--   · Comentarios entre coach y atleta en sesiones, check-ins y vídeos.
--   · Recursos y preguntas frecuentes.
--   · Vídeos de técnica y fotos de progreso en Storage (bucket privado «archivos»).
--   · Marcas: el atleta puede borrar las suyas.
--   · Verificación en dos pasos para el coach: si la activas, tus permisos de coach solo valen
--     con la sesión verificada (aal2). Ver README, «Verificación en dos pasos».
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guardia: si la base ya tiene una migración posterior, esta no se repite (desharía lo que
-- cambiaron las siguientes). Al terminar, queda apuntada en fbe_migraciones.
-- ---------------------------------------------------------------------
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
  if v > 2 then
    raise exception 'Esta base ya tiene la migración %: repetir la 002 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 2;» y, después de ella, todas las siguientes en orden.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Columnas nuevas
-- ---------------------------------------------------------------------

alter table public.ejercicios
  add column if not exists errores      text,
  add column if not exists alternativas uuid[] not null default '{}',  -- ejercicios equivalentes (ids)
  add column if not exists tipo         text[] not null default '{}',  -- basico · multiarticular · aislamiento
  add column if not exists rango_reps   text;                         -- «Fuerza 1–5, hipertrofia 6–12»

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ejercicios_tipo_check') then
    alter table public.ejercicios add constraint ejercicios_tipo_check
      check (tipo <@ array['basico','multiarticular','aislamiento']);
  end if;
end $$;

alter table public.sesion_ejercicios add column if not exists variante text;

-- La serie se hizo con otro ejercicio (una alternativa) en lugar del pautado
alter table public.series add column if not exists sustituto_id uuid references public.ejercicios(id) on delete set null;

-- Sugerir subir carga cuando el atleta llega al tope del rango (doble progresión)
alter table public.atletas add column if not exists progresion_auto boolean not null default true;

-- Revisión del coach. Lo anterior a esta migración se da por revisado.
do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'sesiones' and column_name = 'revisada_en') then
    alter table public.sesiones add column revisada_en timestamptz;
    update public.sesiones set revisada_en = now() where completada;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'checkins' and column_name = 'revisado_en') then
    alter table public.checkins add column revisado_en timestamptz;
    update public.checkins set revisado_en = now();
  end if;
end $$;

alter table public.archivos
  add column if not exists ejercicio_id uuid references public.ejercicios(id) on delete set null,
  add column if not exists nota_atleta  text,
  add column if not exists mime         text,
  add column if not exists bytes        bigint,
  add column if not exists revisado_en  timestamptz;

-- ---------------------------------------------------------------------
-- 2. Tablas nuevas
-- ---------------------------------------------------------------------

-- Conversación coach–atleta pegada a una sesión, un check-in o un vídeo (o general si no hay ninguno).
create table if not exists public.comentarios (
  id          uuid primary key default gen_random_uuid(),
  atleta_id   uuid not null references public.atletas(id) on delete cascade,
  sesion_id   uuid references public.sesiones(id) on delete cascade,
  checkin_id  uuid references public.checkins(id) on delete cascade,
  archivo_id  uuid references public.archivos(id) on delete cascade,
  autor       text not null check (autor in ('coach', 'atleta')),  -- lo fija un trigger
  texto       text not null check (length(texto) between 1 and 4000),
  creado_en   timestamptz not null default now(),
  leido_en    timestamptz,  -- lo marca quien lo recibe
  check (num_nonnulls(sesion_id, checkin_id, archivo_id) <= 1)
);

-- Guías, enlaces y preguntas frecuentes. Sin atleta = para todos.
create table if not exists public.recursos (
  id           uuid primary key default gen_random_uuid(),
  atleta_id    uuid references public.atletas(id) on delete cascade,
  categoria    text not null default 'general'
               check (categoria in ('entrenamiento','tecnica','alimentacion','descanso','faq','general')),
  titulo       text not null,
  descripcion  text,  -- en una pregunta frecuente, la respuesta
  url          text,
  orden        int not null default 0,
  creado_en    timestamptz not null default now()
);

create index if not exists comentarios_atleta_idx on public.comentarios (atleta_id, creado_en desc);
create index if not exists comentarios_sesion_idx on public.comentarios (sesion_id);
create index if not exists comentarios_checkin_idx on public.comentarios (checkin_id);
create index if not exists comentarios_archivo_idx on public.comentarios (archivo_id);
create index if not exists archivos_atleta_idx on public.archivos (atleta_id, fecha desc);
create index if not exists marcas_atleta_idx on public.marcas (atleta_id, fecha desc);
create index if not exists medidas_atleta_idx on public.medidas (atleta_id, fecha desc);
create index if not exists objetivos_atleta_idx on public.objetivos (atleta_id);
create index if not exists recursos_atleta_idx on public.recursos (atleta_id);

-- ---------------------------------------------------------------------
-- 3. Funciones
-- ---------------------------------------------------------------------

-- Coach = rol coach y, si tiene la verificación en dos pasos activada, sesión verificada (aal2).
create or replace function public.es_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'coach')
     and (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
          or not exists (select 1 from auth.mfa_factors
                         where user_id = auth.uid() and status = 'verified'));
$$;

-- Dueño de una sesión (para comentarios)
create or replace function public.atleta_de_sesion(p_sesion uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select b.atleta_id from public.sesiones s
  join public.semanas w on w.id = s.semana_id
  join public.bloques b on b.id = w.bloque_id
  where s.id = p_sesion;
$$;
create or replace function public.atleta_de_checkin(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select atleta_id from public.checkins where id = p;
$$;
create or replace function public.atleta_de_archivo(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select atleta_id from public.archivos where id = p;
$$;

-- Lo que cambia el atleta en una sesión vuelve a quedar pendiente de revisar.
create or replace function public.proteger_sesion() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    if (new.semana_id, new.orden, new.nombre, new.tipo, new.intencion, new.dinamica)
       is distinct from
       (old.semana_id, old.orden, old.nombre, old.tipo, old.intencion, old.dinamica) then
      raise exception 'Solo el coach puede cambiar la prescripción de la sesión' using errcode = '42501';
    end if;
    new.revisada_en := null;
  end if;
  return new;
end $$;

create or replace function public.checkin_pendiente() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    new.revisado_en := null;
  end if;
  return new;
end $$;
drop trigger if exists checkins_pendiente on public.checkins;
create trigger checkins_pendiente before insert or update on public.checkins
  for each row execute function public.checkin_pendiente();

create or replace function public.archivo_proteger() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    new.revisado_en := null;
    new.comentario_coach := null;
  end if;
  return new;
end $$;
drop trigger if exists archivos_proteger on public.archivos;
create trigger archivos_proteger before insert on public.archivos
  for each row execute function public.archivo_proteger();

-- Comentarios: el autor lo decide quién escribe y el atleta es el dueño de lo comentado.
-- Desde la app no se editan: solo los marca como leídos quien los recibe.
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
    if (new.atleta_id, new.sesion_id, new.checkin_id, new.archivo_id, new.autor, new.texto, new.creado_en)
       is distinct from
       (old.atleta_id, old.sesion_id, old.checkin_id, old.archivo_id, old.autor, old.texto, old.creado_en) then
      raise exception 'Un comentario no se puede editar' using errcode = '42501';
    end if;
    if old.autor = v_autor and new.leido_en is distinct from old.leido_en then
      raise exception 'Solo quien recibe un comentario lo marca como leído' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists comentarios_preparar on public.comentarios;
create trigger comentarios_preparar before insert or update on public.comentarios
  for each row execute function public.comentario_preparar();

-- Cuando el coach comenta algo, queda revisado.
create or replace function public.comentario_revisa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.autor = 'coach' then
    if new.sesion_id is not null then
      update public.sesiones set revisada_en = now() where id = new.sesion_id and revisada_en is null;
    elsif new.checkin_id is not null then
      update public.checkins set revisado_en = now() where id = new.checkin_id and revisado_en is null;
    elsif new.archivo_id is not null then
      update public.archivos set revisado_en = now() where id = new.archivo_id and revisado_en is null;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists comentarios_revisa on public.comentarios;
create trigger comentarios_revisa after insert on public.comentarios
  for each row execute function public.comentario_revisa();

-- Las herramientas del coach copian también la variante.
create or replace function public.duplicar_semana(
  p_semana uuid, p_kg_extra numeric default 0, p_reps_extra int default 0, p_rir_delta numeric default 0)
returns uuid language plpgsql set search_path = public as $$
declare
  v_old   public.semanas;
  v_nueva uuid;
  s       record;
  v_ses   uuid;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  select * into v_old from public.semanas where id = p_semana;
  if not found then raise exception 'Semana no encontrada'; end if;

  insert into public.semanas (bloque_id, numero, foco, fecha_inicio, programacion)
  values (v_old.bloque_id,
          (select max(numero) + 1 from public.semanas where bloque_id = v_old.bloque_id),
          v_old.foco, v_old.fecha_inicio + 7, 'en_programacion')
  returning id into v_nueva;

  for s in select * from public.sesiones where semana_id = p_semana order by orden loop
    insert into public.sesiones (semana_id, orden, nombre, tipo, intencion, dinamica)
    values (v_nueva, s.orden, s.nombre, s.tipo, s.intencion, s.dinamica)
    returning id into v_ses;

    insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, superserie, prioridad, series,
      reps_min, reps_max, rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante)
    select v_ses, ejercicio_id, orden, superserie, prioridad, series,
           reps_min + p_reps_extra, reps_max + p_reps_extra,
           greatest(rir_objetivo + p_rir_delta, 0), rpe_objetivo,
           case when carga_sugerida_kg is null then null else carga_sugerida_kg + p_kg_extra end,
           descanso_seg, tempo, notas_coach, variante
    from public.sesion_ejercicios where sesion_id = s.id;
  end loop;
  return v_nueva;
end $$;

create or replace function public.crear_bloque_desde_plantilla(
  p_plantilla uuid, p_atleta uuid, p_fecha_inicio date, p_numero int default null)
returns uuid language plpgsql set search_path = public as $$
declare
  v_pl     public.bloques;
  v_bloque uuid;
  w        record;
  s        record;
  v_sem    uuid;
  v_ses    uuid;
begin
  if not public.es_coach() then
    raise exception 'Solo el coach' using errcode = '42501';
  end if;
  select * into v_pl from public.bloques where id = p_plantilla and es_plantilla;
  if not found then raise exception 'Plantilla no encontrada'; end if;

  insert into public.bloques (atleta_id, numero, nombre, foco, objetivo, descripcion, fecha_inicio, estado)
  values (p_atleta,
          coalesce(p_numero, (select coalesce(max(numero), 0) + 1 from public.bloques where atleta_id = p_atleta)),
          v_pl.nombre, v_pl.foco, v_pl.objetivo, v_pl.descripcion, p_fecha_inicio, 'planificado')
  returning id into v_bloque;

  for w in select * from public.semanas where bloque_id = p_plantilla order by numero loop
    insert into public.semanas (bloque_id, numero, foco, fecha_inicio, nota_coach, programacion)
    values (v_bloque, w.numero, w.foco, p_fecha_inicio + (w.numero - 1) * 7, w.nota_coach, 'en_programacion')
    returning id into v_sem;
    for s in select * from public.sesiones where semana_id = w.id order by orden loop
      insert into public.sesiones (semana_id, orden, nombre, tipo, intencion, dinamica)
      values (v_sem, s.orden, s.nombre, s.tipo, s.intencion, s.dinamica)
      returning id into v_ses;
      insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, superserie, prioridad, series,
        reps_min, reps_max, rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante)
      select v_ses, ejercicio_id, orden, superserie, prioridad, series, reps_min, reps_max,
             rir_objetivo, rpe_objetivo, carga_sugerida_kg, descanso_seg, tempo, notas_coach, variante
      from public.sesion_ejercicios where sesion_id = s.id;
    end loop;
  end loop;
  return v_bloque;
end $$;

-- ---------------------------------------------------------------------
-- 4. Vistas: las series hechas con una alternativa cuentan para la alternativa.
--    El 1RM de una serie a 1 repetición sin reserva es la propia carga (convención de Epley).
-- ---------------------------------------------------------------------

create or replace view public.v_e1rm_semanal with (security_invoker = true) as
select r.atleta_id, coalesce(r.sustituto_id, se.ejercicio_id) as ejercicio_id,
       date_trunc('week', coalesce(s.fecha_realizada, r.registrada_en::date))::date as semana,
       max(round(case when r.reps + greatest(coalesce(r.rir, 10 - r.rpe, 0), 0) <= 1 then r.kg
                      else r.kg * (1 + (r.reps + greatest(coalesce(r.rir, 10 - r.rpe, 0), 0)) / 30.0) end, 1)) as e1rm_kg
from public.series r
join public.sesion_ejercicios se on se.id = r.sesion_ejercicio_id
join public.sesiones s on s.id = se.sesion_id
where r.kg > 0 and r.reps between 1 and 12
group by 1, 2, 3;

create or replace view public.v_series_por_grupo with (security_invoker = true) as
select r.atleta_id, g.grupo,
       date_trunc('week', coalesce(s.fecha_realizada, r.registrada_en::date))::date as semana,
       sum(case when g.orden = 1 then 1 else 0.5 end) as series
from public.series r
join public.sesion_ejercicios se on se.id = r.sesion_ejercicio_id
join public.sesiones s on s.id = se.sesion_id
join public.ejercicios e on e.id = coalesce(r.sustituto_id, se.ejercicio_id)
cross join lateral unnest(e.grupos_musculares) with ordinality as g(grupo, orden)
where r.reps > 0
group by 1, 2, 3;

-- ---------------------------------------------------------------------
-- 5. Permisos
-- ---------------------------------------------------------------------

alter table public.comentarios enable row level security;
alter table public.recursos    enable row level security;

drop policy if exists coach_todo on public.comentarios;
create policy coach_todo on public.comentarios for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.comentarios;
create policy atleta_ver on public.comentarios for select to authenticated
  using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_crear on public.comentarios;
create policy atleta_crear on public.comentarios for insert to authenticated
  with check (atleta_id = public.mi_atleta_id() and autor = 'atleta'
              and (sesion_id is null or public.sesion_visible(sesion_id)));
drop policy if exists atleta_leer on public.comentarios;
create policy atleta_leer on public.comentarios for update to authenticated
  using (atleta_id = public.mi_atleta_id()) with check (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_borrar on public.comentarios;
create policy atleta_borrar on public.comentarios for delete to authenticated
  using (atleta_id = public.mi_atleta_id() and autor = 'atleta');

drop policy if exists coach_todo on public.recursos;
create policy coach_todo on public.recursos for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.recursos;
create policy atleta_ver on public.recursos for select to authenticated
  using (public.mi_atleta_id() is not null and (atleta_id is null or atleta_id = public.mi_atleta_id()));

-- Marcas: también puede borrar las suyas (un test mal apuntado)
drop policy if exists atleta_borrar on public.marcas;
create policy atleta_borrar on public.marcas for delete to authenticated
  using (atleta_id = public.mi_atleta_id());

-- Archivos: sube y borra los suyos, dentro de su carpeta; las fotos de progreso piden consentimiento de salud
drop policy if exists atleta_subir on public.archivos;
create policy atleta_subir on public.archivos for insert to authenticated
  with check (atleta_id = public.mi_atleta_id()
              and ruta like atleta_id::text || '/%'
              and (sesion_ejercicio_id is null or public.sesion_ejercicio_visible(sesion_ejercicio_id))
              and (tipo <> 'foto_progreso' or public.tiene_consentimiento_salud()));
drop policy if exists atleta_borrar on public.archivos;
create policy atleta_borrar on public.archivos for delete to authenticated
  using (atleta_id = public.mi_atleta_id());

-- Storage: bucket privado; cada atleta solo toca su carpeta (<atleta_id>/...); el coach, todo.
-- Límite por archivo: 200 MB (sube también el límite global en Storage → Settings si hace falta).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('archivos', 'archivos', false, 209715200,
        array['video/mp4','video/quicktime','video/webm','image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists fbe_archivos_ver on storage.objects;
create policy fbe_archivos_ver on storage.objects for select to authenticated
  using (bucket_id = 'archivos'
         and (public.es_coach() or (storage.foldername(name))[1] = public.mi_atleta_id()::text));
drop policy if exists fbe_archivos_subir on storage.objects;
create policy fbe_archivos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos'
              and (public.es_coach() or (storage.foldername(name))[1] = public.mi_atleta_id()::text));
drop policy if exists fbe_archivos_borrar on storage.objects;
create policy fbe_archivos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'archivos'
         and (public.es_coach() or (storage.foldername(name))[1] = public.mi_atleta_id()::text));

-- Sin sesión no se accede a nada (también a lo nuevo).
revoke all on public.comentarios, public.recursos from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Apuntada: desde aquí, la base no deja repetir por error las migraciones anteriores a esta
insert into public.fbe_migraciones (numero) values (2)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
