-- =====================================================================
-- FBE Equipo, migración 022 (v0.26): solo nutrición, recetas y menú de la semana
-- 1. Servicio «solo nutrición»: atletas.entrenamiento en false = el atleta no ve nada de entrenamiento (como
--    atletas.nutricion en false, de la 018, no ve nada de nutrición). Siempre se le lleva una de las dos.
-- 2. recetas: tu recetario (sustituye a las bases de datos de Desayuno, Comida, Merienda y Cena de Notion):
--    nombre, foto, tomas en las que encaja, raciones, kcal y macros por ración, ingredientes, preparación,
--    minutos y etiquetas. Solo las escribe el coach; cada atleta ve solo las que le asignas.
-- 3. recetas_atleta: qué recetas tiene cada atleta en cada toma, con un factor (×1,5 = una vez y media las
--    cantidades y los macros: la misma receta sirve para atletas con kcal distintas) y una nota tuya. El atleta
--    solo puede marcarla como favorita o pedirte que se la cambies (como la casilla «Cambio» de Notion).
-- 4. comidas_atleta: cuántas comidas hace el atleta al día y cuáles (desayuno, media mañana, comida, merienda,
--    cena, antes de dormir). Las elige él (o tú).
-- 5. menu_comidas: su menú de la semana (el «Planificador semanal» de Notion): para cada día y toma, una receta
--    de su recetario o lo que escriba, con las raciones, sus kcal y macros (guardados al apuntarlo) y si ya lo
--    ha comido. Es suyo: lo organiza él y tú lo ves (y lo puedes tocar). Como el registro de la nutrición, es un
--    dato de salud: hace falta su consentimiento.
-- Se borran con el atleta. Van en la copia completa y en la descarga de datos del atleta.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 021 (o con instalar.sql en una
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
  if v > 22 then
    raise exception 'Esta base ya tiene la migración %: repetir la 022 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 22;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 21) then
    raise exception 'Antes de la 022 hace falta la 021: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Solo nutrición
-- ---------------------------------------------------------------------
alter table public.atletas add column if not exists entrenamiento boolean not null default true;
alter table public.atletas drop constraint if exists atletas_algun_servicio;
alter table public.atletas add constraint atletas_algun_servicio check (entrenamiento or nutricion);

-- Las tomas del día, en su orden
create or replace function public.toma_valida(t text) returns boolean
language sql immutable set search_path = '' as $$
  select t in ('desayuno', 'media_manana', 'comida', 'merienda', 'cena', 'recena')
$$;

-- ---------------------------------------------------------------------
-- 2. Recetas
-- ---------------------------------------------------------------------
-- Ingredientes: [{ "nombre": "Copos de avena", "cantidad": 60, "unidad": "g" }, …] (hasta 40; cantidad y
-- unidad opcionales: «sal al gusto»)
create or replace function public.ingredientes_validos(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'array' and jsonb_array_length(j) <= 40
    and not exists (
      select 1 from jsonb_array_elements(j) i
      where jsonb_typeof(i) <> 'object'
         or exists (select 1 from jsonb_object_keys(i) k where k not in ('nombre', 'cantidad', 'unidad'))
         or coalesce(jsonb_typeof(i -> 'nombre'), '') <> 'string'
         or char_length(i ->> 'nombre') not between 1 and 80 or not public.texto_visible(i ->> 'nombre')
         or (i ? 'cantidad' and jsonb_typeof(i -> 'cantidad') <> 'null'
             and (jsonb_typeof(i -> 'cantidad') <> 'number' or (i ->> 'cantidad')::numeric <= 0 or (i ->> 'cantidad')::numeric > 100000))
         or (i ? 'unidad' and jsonb_typeof(i -> 'unidad') <> 'null'
             and (jsonb_typeof(i -> 'unidad') <> 'string' or char_length(i ->> 'unidad') not between 1 and 16 or not public.texto_visible(i ->> 'unidad')))
    )
$$;

create table if not exists public.recetas (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  tomas          text[] not null default '{}',   -- en qué comidas encaja (desayuno, comida…)
  raciones       smallint not null default 1,    -- para cuántas raciones son los ingredientes
  kcal           numeric(6,1),                   -- por ración
  proteina_g     numeric(5,1),
  carbos_g       numeric(5,1),
  grasa_g        numeric(5,1),
  ingredientes   jsonb not null default '[]',
  preparacion    text,
  minutos        smallint,
  etiquetas      text[] not null default '{}',   -- «rápida», «vegetariana», «para llevar»…
  foto           text,                           -- JPEG/WebP en base64 (la app la reduce a 800 × 600)
  foto_mini      text,                           -- miniatura para las listas (240 × 180)
  creada_en      timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);
alter table public.recetas drop constraint if exists recetas_validas;
alter table public.recetas add constraint recetas_validas check (
  char_length(nombre) between 1 and 80 and public.texto_visible(nombre)
  and cardinality(tomas) <= 6 and tomas <@ array['desayuno', 'media_manana', 'comida', 'merienda', 'cena', 'recena']
  and raciones between 1 and 20
  and (kcal is null or kcal between 0 and 5000)
  and (proteina_g is null or proteina_g between 0 and 500)
  and (carbos_g is null or carbos_g between 0 and 800)
  and (grasa_g is null or grasa_g between 0 and 400)
  and public.ingredientes_validos(ingredientes)
  and (preparacion is null or (char_length(preparacion) between 1 and 4000 and public.texto_visible(preparacion)))
  and (minutos is null or minutos between 0 and 600)
  and cardinality(etiquetas) <= 8
  and (foto is null or (char_length(foto) <= 250000 and foto ~ '^data:image/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$'))
  and (foto_mini is null or (char_length(foto_mini) <= 40000 and foto_mini ~ '^data:image/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$'))
);
-- Cada etiqueta, corta y visible
create or replace function public.etiquetas_validas(xs text[]) returns boolean
language sql immutable set search_path = '' as $$
  select not exists (select 1 from unnest(xs) x where x is null or char_length(x) not between 1 and 24 or not public.texto_visible(x))
$$;
alter table public.recetas drop constraint if exists recetas_etiquetas_validas;
alter table public.recetas add constraint recetas_etiquetas_validas check (public.etiquetas_validas(etiquetas));

create or replace function public.receta_tocar() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizada_en := now();
  if tg_op = 'UPDATE' then new.creada_en := old.creada_en; end if;
  return new;
end $$;
drop trigger if exists recetas_tocar on public.recetas;
create trigger recetas_tocar before insert or update on public.recetas
  for each row execute function public.receta_tocar();

-- ---------------------------------------------------------------------
-- 3. Las recetas de cada atleta, por toma
-- ---------------------------------------------------------------------
create table if not exists public.recetas_atleta (
  id               uuid primary key default gen_random_uuid(),
  atleta_id        uuid not null references public.atletas(id) on delete cascade,
  receta_id        uuid not null references public.recetas(id) on delete cascade,
  toma             text not null,
  factor           numeric(4,2) not null default 1,   -- ×1,5: una vez y media las cantidades y los macros
  orden            smallint not null default 0,
  nota             text,                              -- tuya: «si no tienes pan, avena»
  favorita         boolean not null default false,    -- del atleta
  cambio_pedido_en timestamptz,                       -- el atleta pide que se la cambies
  cambio_nota      text,                              -- y por qué
  creada_en        timestamptz not null default now(),
  unique (atleta_id, receta_id, toma)
);
create index if not exists recetas_atleta_receta_idx on public.recetas_atleta (receta_id);
alter table public.recetas_atleta drop constraint if exists recetas_atleta_validas;
alter table public.recetas_atleta add constraint recetas_atleta_validas check (
  public.toma_valida(toma)
  and factor between 0.25 and 5
  and orden between 0 and 999
  and (nota is null or (char_length(nota) between 1 and 300 and public.texto_visible(nota)))
  and (cambio_nota is null or (cambio_pedido_en is not null and char_length(cambio_nota) between 1 and 300 and public.texto_visible(cambio_nota)))
);

-- El atleta solo cambia su favorita y su petición de cambio (la fecha la pone la base); lo demás es tuyo
create or replace function public.receta_atleta_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_coach() then
    if (new.id, new.atleta_id, new.receta_id, new.toma, new.factor, new.orden, new.nota, new.creada_en)
       is distinct from (old.id, old.atleta_id, old.receta_id, old.toma, old.factor, old.orden, old.nota, old.creada_en) then
      raise exception 'Solo el coach puede cambiar tu recetario: pídele el cambio' using errcode = '42501';
    end if;
    if new.cambio_pedido_en is null then
      new.cambio_nota := null;
    elsif old.cambio_pedido_en is null or new.cambio_nota is distinct from old.cambio_nota then
      new.cambio_pedido_en := now();
    else
      new.cambio_pedido_en := old.cambio_pedido_en;
    end if;
  elsif new.cambio_pedido_en is null then
    new.cambio_nota := null;
  end if;
  return new;
end $$;
drop trigger if exists recetas_atleta_proteger on public.recetas_atleta;
create trigger recetas_atleta_proteger before update on public.recetas_atleta
  for each row execute function public.receta_atleta_proteger();
drop trigger if exists recetas_atleta_exigir_alta on public.recetas_atleta;
create trigger recetas_atleta_exigir_alta before update on public.recetas_atleta
  for each row execute function public.exigir_alta();

-- ---------------------------------------------------------------------
-- 4. Cuántas comidas hace al día
-- ---------------------------------------------------------------------
create table if not exists public.comidas_atleta (
  atleta_id      uuid primary key references public.atletas(id) on delete cascade,
  tomas          text[] not null default array['desayuno', 'comida', 'merienda', 'cena'],
  actualizado_en timestamptz not null default now()
);
create or replace function public.tomas_validas(xs text[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(xs) between 1 and 6
    and xs <@ array['desayuno', 'media_manana', 'comida', 'merienda', 'cena', 'recena']
    and cardinality(xs) = (select count(distinct x) from unnest(xs) x)
$$;
alter table public.comidas_atleta drop constraint if exists comidas_atleta_validas;
alter table public.comidas_atleta add constraint comidas_atleta_validas check (public.tomas_validas(tomas));
create or replace function public.comidas_atleta_tocar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.atleta_id is distinct from old.atleta_id then
    raise exception 'No se puede pasar a otro atleta' using errcode = '42501';
  end if;
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists comidas_atleta_aa_tocar on public.comidas_atleta;
create trigger comidas_atleta_aa_tocar before insert or update on public.comidas_atleta
  for each row execute function public.comidas_atleta_tocar();
drop trigger if exists comidas_atleta_exigir_alta on public.comidas_atleta;
create trigger comidas_atleta_exigir_alta before insert or update on public.comidas_atleta
  for each row execute function public.exigir_alta();

-- ---------------------------------------------------------------------
-- 5. El menú de la semana
-- ---------------------------------------------------------------------
create table if not exists public.menu_comidas (
  id          uuid primary key default gen_random_uuid(),
  atleta_id   uuid not null references public.atletas(id) on delete cascade,
  fecha       date not null,
  toma        text not null,
  receta_id   uuid references public.recetas(id) on delete set null,  -- si borras la receta, queda el nombre
  texto       text not null,                                          -- el nombre de la receta o lo que escriba
  raciones    numeric(4,2) not null default 1,
  kcal        numeric(6,1),                                           -- de lo apuntado (ya con raciones y factor)
  proteina_g  numeric(5,1),
  carbos_g    numeric(5,1),
  grasa_g     numeric(5,1),
  hecho       boolean not null default false,                         -- ya se lo ha comido
  orden       smallint not null default 0,
  creado_en   timestamptz not null default now()
);
create index if not exists menu_comidas_atleta_idx on public.menu_comidas (atleta_id, fecha);
create index if not exists menu_comidas_receta_idx on public.menu_comidas (receta_id);
alter table public.menu_comidas drop constraint if exists menu_comidas_validas;
alter table public.menu_comidas add constraint menu_comidas_validas check (
  fecha >= date '2020-01-01' and fecha < date '2100-01-01'
  and public.toma_valida(toma)
  and char_length(texto) between 1 and 120 and public.texto_visible(texto)
  and raciones between 0.25 and 10
  and (kcal is null or kcal between 0 and 15000)
  and (proteina_g is null or proteina_g between 0 and 1500)
  and (carbos_g is null or carbos_g between 0 and 2500)
  and (grasa_g is null or grasa_g between 0 and 1000)
  and orden between 0 and 99
);

-- Dato de salud (como el registro de la nutrición, 009): con su consentimiento, lo escriba quien lo escriba
-- desde la app. El atleta solo apunta recetas de su recetario (o texto libre). No cambia de atleta.
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
       and not exists (select 1 from public.recetas_atleta ra where ra.atleta_id = new.atleta_id and ra.receta_id = new.receta_id) then
      raise exception 'Esa receta no está en tu recetario' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists menu_comidas_aa_preparar on public.menu_comidas;
create trigger menu_comidas_aa_preparar before insert or update on public.menu_comidas
  for each row execute function public.menu_comida_preparar();
drop trigger if exists menu_comidas_exigir_alta on public.menu_comidas;
create trigger menu_comidas_exigir_alta before insert or update on public.menu_comidas
  for each row execute function public.exigir_alta();

-- ---------------------------------------------------------------------
-- 6. Quién ve y escribe qué
-- ---------------------------------------------------------------------
alter table public.recetas enable row level security;
alter table public.recetas_atleta enable row level security;
alter table public.comidas_atleta enable row level security;
alter table public.menu_comidas enable row level security;

drop policy if exists coach_todo on public.recetas;
create policy coach_todo on public.recetas for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
-- El atleta, solo las de su recetario
drop policy if exists atleta_ver on public.recetas;
create policy atleta_ver on public.recetas for select to authenticated
  using (exists (select 1 from public.recetas_atleta ra where ra.receta_id = recetas.id and ra.atleta_id = public.mi_atleta_id()));

drop policy if exists coach_todo on public.recetas_atleta;
create policy coach_todo on public.recetas_atleta for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.recetas_atleta;
create policy atleta_ver on public.recetas_atleta for select to authenticated
  using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_editar on public.recetas_atleta;
create policy atleta_editar on public.recetas_atleta for update to authenticated
  using (atleta_id = public.mi_atleta_id()) with check (atleta_id = public.mi_atleta_id());

drop policy if exists coach_todo on public.comidas_atleta;
create policy coach_todo on public.comidas_atleta for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.comidas_atleta;
create policy atleta_ver on public.comidas_atleta for select to authenticated
  using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_crear on public.comidas_atleta;
create policy atleta_crear on public.comidas_atleta for insert to authenticated
  with check (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_editar on public.comidas_atleta;
create policy atleta_editar on public.comidas_atleta for update to authenticated
  using (atleta_id = public.mi_atleta_id()) with check (atleta_id = public.mi_atleta_id());

drop policy if exists coach_todo on public.menu_comidas;
create policy coach_todo on public.menu_comidas for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.menu_comidas;
create policy atleta_ver on public.menu_comidas for select to authenticated
  using (atleta_id = public.mi_atleta_id());
drop policy if exists atleta_crear on public.menu_comidas;
create policy atleta_crear on public.menu_comidas for insert to authenticated
  with check (atleta_id = public.mi_atleta_id() and public.tiene_consentimiento_salud());
drop policy if exists atleta_editar on public.menu_comidas;
create policy atleta_editar on public.menu_comidas for update to authenticated
  using (atleta_id = public.mi_atleta_id())
  with check (atleta_id = public.mi_atleta_id() and public.tiene_consentimiento_salud());
drop policy if exists atleta_borrar on public.menu_comidas;
create policy atleta_borrar on public.menu_comidas for delete to authenticated
  using (atleta_id = public.mi_atleta_id());

-- Desde la 019, cada tabla nueva lleva sus permisos a mano
revoke all on public.recetas, public.recetas_atleta, public.comidas_atleta, public.menu_comidas from public, anon, authenticated;
grant select, insert, update, delete on public.recetas, public.recetas_atleta, public.comidas_atleta, public.menu_comidas to authenticated;

-- Los recordatorios de «Hoy toca…», solo a quien le llevas el entrenamiento (a quien solo lleva la nutrición se le
-- guarda lo que tuviera, pero no ve sesiones ni le llegan sus avisos). Igual que en la 018, con esa condición más.
create or replace function public.crear_recordatorios(p_ahora timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_local timestamp := p_ahora at time zone 'Europe/Madrid';
  v_hoy date := (p_ahora at time zone 'Europe/Madrid')::date;
  v_dow integer := extract(isodow from (p_ahora at time zone 'Europe/Madrid'))::integer;
  v_lunes date;
  v_n integer := 0;
  v_m integer;
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
  return v_n;
end $$;

-- Permisos (como al final de 003 a 021)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (22)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
