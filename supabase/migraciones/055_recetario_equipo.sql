-- =====================================================================
-- FBE Equipo, migración 055: el recetario del equipo (recetas para todos los atletas)
--
-- Por qué: hasta ahora una receta solo la veía el atleta al que se la asignabas (recetas_atleta), y a quien no le
-- llevas la nutrición no veía ninguna. El recetario del equipo son recetas tuyas que ve todo el mundo: quien solo
-- entrena las consulta, y quien lleva la nutrición contigo puede además apuntarlas en su menú de la semana.
--
-- Qué hace:
--   * recetas.para_todos: la receta la ven todos tus atletas (aunque no esté en su recetario). Solo la marcas tú.
--   * recetas.libro: lo que trae una receta de un recetario escrito (capítulo, bloque, código, la entrada, la nota,
--     dificultad, si se puede cocinar para varios días, las medidas caseras de cada ingrediente…). Es opcional y solo
--     son textos: { "capitulo": "Desayunos", "bloque": "Rápidos", "codigo": "03.01", "descripcion": "…", "nota": "…",
--     "encaje": "…", "dificultad": "Fácil", "batch": "No", "objetivo": "Todos", "rendimiento": "…", "porcion": "…",
--     "tiempo": "3 h (incl. reposo)", "medidas": ["1 envase", null, …] }.
--   * recetas_favoritas: las recetas del equipo que cada atleta se guarda (las de su recetario ya tienen su favorita
--     en recetas_atleta). Las pone y las quita él; tú las ves.
--   * El menú de la semana (menu_comidas) admite, además de las recetas de su recetario, las del equipo.
--
-- Las recetas no van en esta migración: son contenido tuyo y se cargan aparte, con su propio SQL.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 054 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 55 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 055 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 55;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 54) then  -- (2) la anterior
    raise exception 'Falta la migración 054 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Recetas para todo el equipo y lo que traen de un recetario escrito
-- ---------------------------------------------------------------------
alter table public.recetas add column if not exists para_todos boolean not null default false;
alter table public.recetas add column if not exists libro jsonb;

-- Solo textos cortos con claves conocidas; «medidas», una lista (como mucho, una por ingrediente) de textos o nulos
create or replace function public.receta_libro_valido(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object'
    and not exists (
      select 1 from jsonb_each(j) e
      where e.key not in ('capitulo', 'bloque', 'codigo', 'descripcion', 'nota', 'encaje', 'dificultad', 'batch', 'objetivo', 'rendimiento', 'porcion', 'tiempo', 'medidas')
         or (e.key <> 'medidas' and (jsonb_typeof(e.value) <> 'string'
              or char_length(e.value #>> '{}') not between 1 and (case when e.key in ('descripcion', 'nota', 'encaje') then 1200 else 80 end)
              or not public.texto_visible(e.value #>> '{}')))
         or (e.key = 'medidas' and (jsonb_typeof(e.value) <> 'array' or jsonb_array_length(e.value) > 40
              or exists (select 1 from jsonb_array_elements(e.value) m
                         where jsonb_typeof(m) not in ('string', 'null')
                            or (jsonb_typeof(m) = 'string' and (char_length(m #>> '{}') not between 1 and 60 or not public.texto_visible(m #>> '{}'))))))
    )
$$;
alter table public.recetas drop constraint if exists recetas_libro_valido;
alter table public.recetas add constraint recetas_libro_valido check (libro is null or public.receta_libro_valido(libro));
create index if not exists recetas_para_todos_idx on public.recetas (id) where para_todos;

-- El atleta ve las de su recetario y las del equipo
drop policy if exists atleta_ver on public.recetas;
create policy atleta_ver on public.recetas for select to authenticated
  using (
    exists (select 1 from public.recetas_atleta ra where ra.receta_id = recetas.id and ra.atleta_id = public.mi_atleta_id())
    or (para_todos and public.mi_atleta_id() is not null)
  );

-- ---------------------------------------------------------------------
-- 2. El menú admite las recetas del equipo (lo demás, como en la 022)
-- ---------------------------------------------------------------------
create or replace function public.menu_comida_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.atleta_id is distinct from old.atleta_id then
    raise exception 'Una comida del menú no se puede pasar a otro atleta' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then new.creado_en := old.creado_en; end if;
  if current_user in ('authenticated', 'anon') then
    if not public.consentimiento_salud_de_atleta(new.atleta_id) then
      raise exception 'Para organizar el menú hace falta el consentimiento de datos de salud del atleta' using errcode = '42501';
    end if;
    if new.receta_id is not null and not public.es_coach()
       and (tg_op = 'INSERT' or new.receta_id is distinct from old.receta_id)
       and not exists (select 1 from public.recetas_atleta ra where ra.atleta_id = new.atleta_id and ra.receta_id = new.receta_id)
       and not exists (select 1 from public.recetas r where r.id = new.receta_id and r.para_todos) then
      raise exception 'Esa receta no está en tu recetario' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. Las recetas del equipo que cada atleta se guarda
-- ---------------------------------------------------------------------
create table if not exists public.recetas_favoritas (
  atleta_id uuid not null references public.atletas (id) on delete cascade,
  receta_id uuid not null references public.recetas (id) on delete cascade,
  creada_en timestamptz not null default now(),
  primary key (atleta_id, receta_id)
);
create index if not exists recetas_favoritas_receta_idx on public.recetas_favoritas (receta_id);

drop trigger if exists recetas_favoritas_exigir_alta on public.recetas_favoritas;
create trigger recetas_favoritas_exigir_alta before insert on public.recetas_favoritas
  for each row execute function public.exigir_alta();

alter table public.recetas_favoritas enable row level security;
drop policy if exists coach_ver on public.recetas_favoritas;
create policy coach_ver on public.recetas_favoritas for select to authenticated
  using (public.es_coach());
drop policy if exists atleta_ver on public.recetas_favoritas;
create policy atleta_ver on public.recetas_favoritas for select to authenticated
  using (atleta_id = public.mi_atleta_id());
-- Solo las suyas y solo recetas del equipo
drop policy if exists atleta_crear on public.recetas_favoritas;
create policy atleta_crear on public.recetas_favoritas for insert to authenticated
  with check (atleta_id = public.mi_atleta_id()
    and exists (select 1 from public.recetas r where r.id = receta_id and r.para_todos));
drop policy if exists atleta_borrar on public.recetas_favoritas;
create policy atleta_borrar on public.recetas_favoritas for delete to authenticated
  using (atleta_id = public.mi_atleta_id());

-- Desde la 019, cada tabla nueva lleva sus permisos a mano (no se cambia: se pone o se quita)
revoke all on public.recetas_favoritas from public, anon, authenticated;
grant select, insert, delete on public.recetas_favoritas to authenticated;
grant execute on function public.receta_libro_valido(jsonb) to authenticated, service_role;

insert into public.fbe_migraciones (numero) values (55)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
