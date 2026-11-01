-- =====================================================================
-- FBE Equipo, migración 030 (v0.48): tareas puntuales, mensajes programados, el bloque entero y las bajas
--   · Tareas puntuales del coach (tareas): una cosa concreta para un día (foto de progreso, peso o medidas, un
--     vídeo de técnica de un ejercicio o un texto). El atleta la ve en «Tu día» desde ese día hasta que la hace;
--     solo la marca hecha (y contesta, si quiere) con tarea_completar(), nunca la crea, cambia ni borra; los de
--     baja, nada. Al ponerla le llega «Pelayo te ha puesto una tarea» (sin el texto); al hacerla, al coach.
--     Plantillas de tareas (tareas_plantillas), solo del coach, como mucho 30.
--   · Mensajes programados: comentarios.enviar_en y avisos.enviar_en. Hasta esa hora el atleta no lo ve (lo
--     impone la base: sus políticas solo dejan ver lo que ya «ha salido») y no le llega la notificación, que se
--     pone en la cola para esa hora (la función de envío, cada minuto, la manda cuando toca: no cambia). El
--     coach puede cambiar el texto o la hora, o cancelarlo, mientras no haya salido. Solo mensajes del coach en
--     el chat (ni en una sesión, ni en un check-in, ni con adjunto).
--   · El bloque entero para el atleta: bloque_semanas() da, de su bloque, el número y la fecha de cada semana y
--     si está publicada (nada más de las que no lo están: ni foco, ni nota, ni sesiones).
--   · atletas.baja_en: el día en que pasó a «baja» (lo pone la base), para el panel de negocio del coach.
--   · Tras la revisión de seguridad: las notificaciones aún pendientes (con su hora futura y su clave) no las ve el
--     atleta hasta que tocan; un aviso que ya ha salido no se puede volver a programar; una tarea de foto o vídeo
--     vuelve a pendiente si se borra su archivo antes de que el coach la revise, la de un vídeo de un ejercicio solo
--     vale con un vídeo de ese ejercicio y un mismo archivo no sirve para dos tareas.
-- Se ejecuta en el SQL Editor después de la 029 (o con instalar.sql en una base nueva). Se puede repetir.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 30 then
    raise exception 'Esta base ya tiene la migración %: repetir la 030 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 30;» y, después de ella, todas las siguientes en orden, todo en la misma consulta del SQL Editor (una sola transacción).';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 29) then
    raise exception 'Antes de la 030 hace falta la 029: ejecútala primero (o usa supabase/instalar.sql en una base nueva).';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Tareas puntuales
-- ---------------------------------------------------------------------
create table if not exists public.tareas (
  id            uuid primary key default gen_random_uuid(),
  atleta_id     uuid not null references public.atletas(id) on delete cascade,
  tipo          text not null,                     -- foto | medida | video | texto
  titulo        text not null,
  detalle       text,
  ejercicio_id  uuid references public.ejercicios(id) on delete set null,   -- el del vídeo de técnica
  fecha         date not null default ((now() at time zone 'Europe/Madrid')::date),  -- desde qué día le sale
  hecha_en      timestamptz,
  respuesta     text,                              -- lo que contesta el atleta (opcional)
  archivo_id    uuid references public.archivos(id) on delete set null,     -- la foto o el vídeo con que la hizo
  revisada_en   timestamptz,
  creada_en     timestamptz not null default now()
);
create index if not exists tareas_atleta_idx on public.tareas (atleta_id, fecha);
create index if not exists tareas_ejercicio_idx on public.tareas (ejercicio_id);
drop index if exists public.tareas_archivo_idx;
-- Un mismo archivo no sirve para dos tareas
create unique index if not exists tareas_archivo_unico on public.tareas (archivo_id) where archivo_id is not null;
alter table public.tareas drop constraint if exists tareas_validas;
alter table public.tareas add constraint tareas_validas check (
  tipo in ('foto', 'medida', 'video', 'texto')
  and char_length(titulo) between 1 and 120 and public.texto_visible(titulo)
  and (detalle is null or (char_length(detalle) between 1 and 600 and public.texto_visible(detalle)))
  and (ejercicio_id is null or tipo = 'video')
  and fecha >= date '2020-01-01' and fecha < date '2100-01-01'
  and (respuesta is null or (char_length(respuesta) between 1 and 500 and public.texto_visible(respuesta)))
  and (hecha_en is not null or (respuesta is null and archivo_id is null and revisada_en is null))
);

create table if not exists public.tareas_plantillas (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null,
  titulo        text not null,
  detalle       text,
  ejercicio_id  uuid references public.ejercicios(id) on delete set null,
  orden         smallint not null default 0,
  creada_en     timestamptz not null default now()
);
create index if not exists tareas_plantillas_ejercicio_idx on public.tareas_plantillas (ejercicio_id);
alter table public.tareas_plantillas drop constraint if exists tareas_plantillas_validas;
alter table public.tareas_plantillas add constraint tareas_plantillas_validas check (
  tipo in ('foto', 'medida', 'video', 'texto')
  and char_length(titulo) between 1 and 120 and public.texto_visible(titulo)
  and (detalle is null or (char_length(detalle) between 1 and 600 and public.texto_visible(detalle)))
  and (ejercicio_id is null or tipo = 'video')
  and orden between 0 and 999
);

-- Una tarea no cambia de atleta; la fecha de creación la pone la base
create or replace function public.tarea_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.creada_en := now();
    return new;
  end if;
  if new.atleta_id is distinct from old.atleta_id then
    raise exception 'Una tarea no se puede pasar a otro atleta: ponle una nueva' using errcode = '42501';
  end if;
  new.creada_en := old.creada_en;
  return new;
end $$;
drop trigger if exists tareas_aa_preparar on public.tareas;
create trigger tareas_aa_preparar before insert or update on public.tareas
  for each row execute function public.tarea_preparar();

-- Pocas plantillas (un puñado que se reutiliza): como mucho 30
create or replace function public.tarea_plantilla_cupo() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.tareas_plantillas) >= 30 then
    raise exception 'Ya tienes 30 plantillas de tareas: borra alguna antes de guardar otra' using errcode = '23514';
  end if;
  new.creada_en := now();
  return new;
end $$;
drop trigger if exists tareas_plantillas_cupo on public.tareas_plantillas;
create trigger tareas_plantillas_cupo before insert on public.tareas_plantillas
  for each row execute function public.tarea_plantilla_cupo();

-- El atleta marca hecha una tarea suya (o lo deshace mientras el coach no la haya revisado), con una respuesta
-- opcional. La foto o el vídeo tienen que ser suyos y del tipo de la tarea; la de peso o medidas, con algo
-- apuntado desde su día. Los de baja, no. Devuelve cuándo quedó hecha (null si se deshace).
create or replace function public.tarea_completar(p_tarea uuid, p_hecha boolean default true, p_respuesta text default null, p_archivo uuid default null)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  t public.tareas;
  v_atleta uuid := public.mi_atleta_id();
  v_resp text := nullif(btrim(coalesce(p_respuesta, '')), '');
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_cuando timestamptz;
begin
  if auth.uid() is null or v_atleta is null then
    raise exception 'Solo el atleta de la tarea puede marcarla' using errcode = '42501';
  end if;
  if public.esta_de_baja() then
    raise exception 'Tu cuenta está de baja: puedes ver y descargar tus datos, pero no añadir ni cambiar nada' using errcode = '42501';
  end if;
  select * into t from public.tareas k where k.id = p_tarea and k.atleta_id = v_atleta for update;
  if not found then raise exception 'Esa tarea ya no está' using errcode = '42501'; end if;
  if t.revisada_en is not null then
    raise exception 'Tu coach ya la ha revisado: si quieres cambiar algo, escríbele' using errcode = '42501';
  end if;
  if not coalesce(p_hecha, true) then
    update public.tareas set hecha_en = null, respuesta = null, archivo_id = null where id = t.id;
    return null;
  end if;
  if t.fecha > v_hoy then
    raise exception 'Esta tarea es para el %: podrás hacerla ese día', fbe_privado.fecha_texto(t.fecha) using errcode = '22023';
  end if;
  if v_resp is not null and (char_length(v_resp) > 500 or not public.texto_visible(v_resp)) then
    raise exception 'La respuesta, hasta 500 letras' using errcode = '22023';
  end if;
  if t.tipo in ('foto', 'video') then
    if not exists (select 1 from public.archivos a where a.id = p_archivo and a.atleta_id = v_atleta
                   and a.tipo = case t.tipo when 'foto' then 'foto_progreso' else 'video_tecnica' end) then
      raise exception 'Para esta tarea hace falta %', case t.tipo when 'foto' then 'tu foto de progreso' else 'tu vídeo de técnica' end using errcode = '22023';
    end if;
    -- La de un vídeo de un ejercicio, solo con un vídeo de ese ejercicio (el suyo o el de la pauta con que se subió)
    if t.tipo = 'video' and t.ejercicio_id is not null and not exists (
         select 1 from public.archivos a left join public.sesion_ejercicios se on se.id = a.sesion_ejercicio_id
         where a.id = p_archivo and (a.ejercicio_id = t.ejercicio_id or se.ejercicio_id = t.ejercicio_id)) then
      raise exception 'Ese vídeo es de otro ejercicio: para esta tarea hace falta uno de %',
        coalesce((select e.nombre from public.ejercicios e where e.id = t.ejercicio_id), 'su ejercicio') using errcode = '22023';
    end if;
    if exists (select 1 from public.tareas k where k.archivo_id = p_archivo and k.id <> t.id) then
      raise exception 'Esa foto o ese vídeo ya sirvió para otra tarea: haz uno nuevo' using errcode = '22023';
    end if;
  elsif p_archivo is not null then
    raise exception 'Esta tarea no lleva foto ni vídeo' using errcode = '22023';
  end if;
  if t.tipo = 'medida' and not exists (select 1 from public.pesos p where p.atleta_id = v_atleta and p.fecha >= t.fecha)
     and not exists (select 1 from public.medidas m where m.atleta_id = v_atleta and m.fecha >= t.fecha) then
    raise exception 'Apunta antes tu peso o tus medidas' using errcode = '22023';
  end if;
  v_cuando := coalesce(t.hecha_en, now());
  update public.tareas set hecha_en = v_cuando, respuesta = v_resp, archivo_id = p_archivo where id = t.id;
  return v_cuando;
end $$;

-- Si se borra la foto o el vídeo con que se hizo una tarea que el coach aún no ha revisado, la tarea vuelve a
-- pendiente (sin respuesta: la puede volver a hacer); si ya estaba revisada, se queda hecha (sin el archivo)
create or replace function fbe_privado.al_borrar_archivo_tarea() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.tareas set hecha_en = null, respuesta = null, archivo_id = null
  where archivo_id = old.id and revisada_en is null;
  return old;
end $$;
drop trigger if exists archivos_aa_tareas on public.archivos;
create trigger archivos_aa_tareas before delete on public.archivos
  for each row execute function fbe_privado.al_borrar_archivo_tarea();

-- ---------------------------------------------------------------------
-- 2. Mensajes programados (chat y avisos)
-- ---------------------------------------------------------------------
alter table public.comentarios add column if not exists enviar_en timestamptz;
alter table public.avisos add column if not exists enviar_en timestamptz;
create index if not exists comentarios_enviar_idx on public.comentarios (enviar_en) where enviar_en is not null;

-- comentario_preparar (002, 012, 014) con los programados: solo del coach, en el chat (sin sesión, check-in ni
-- archivo) y como mucho a 90 días; uno para «ya mismo» sale ya. Su hora es la de salida (así el hilo queda en
-- orden). Mientras no ha salido, el coach puede cambiar el texto o la hora (o mandarlo ya); después, como
-- cualquier comentario, ya no se edita.
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
    new.adjunto := new.archivo_id is not null and coalesce((select a.tipo = 'adjunto' from public.archivos a where a.id = new.archivo_id), false);
    new.leido_en := null;
    if new.enviar_en is not null then
      if new.autor <> 'coach' or new.sesion_id is not null or new.checkin_id is not null or new.archivo_id is not null then
        raise exception 'Solo los mensajes del coach en el chat se pueden programar' using errcode = '22023';
      end if;
      if new.enviar_en > now() + interval '90 days' then
        raise exception 'Un mensaje se programa como mucho a 90 días vista' using errcode = '22023';
      end if;
      if new.enviar_en <= now() + interval '30 seconds' then new.enviar_en := null; end if;
    end if;
    new.creado_en := coalesce(new.enviar_en, now());
    return new;
  end if;
  if v_autor is not null then
    if v_autor = 'coach' and old.autor = 'coach' and old.enviar_en is not null and old.enviar_en > now() then
      if (new.atleta_id, new.sesion_id, new.checkin_id, new.archivo_id, new.autor, new.dibujo, new.adjunto)
         is distinct from (old.atleta_id, old.sesion_id, old.checkin_id, old.archivo_id, old.autor, old.dibujo, old.adjunto) then
        raise exception 'De un mensaje programado solo se cambian el texto y la hora' using errcode = '42501';
      end if;
      if new.enviar_en is not null and new.enviar_en > now() + interval '90 days' then
        raise exception 'Un mensaje se programa como mucho a 90 días vista' using errcode = '22023';
      end if;
      if new.enviar_en is not null and new.enviar_en <= now() + interval '30 seconds' then new.enviar_en := null; end if;
      new.creado_en := coalesce(new.enviar_en, now());
      new.leido_en := null;
      return new;
    end if;
    if (new.atleta_id, new.sesion_id, new.checkin_id, new.archivo_id, new.autor, new.texto, new.creado_en, new.dibujo, new.adjunto, new.enviar_en)
       is distinct from
       (old.atleta_id, old.sesion_id, old.checkin_id, old.archivo_id, old.autor, old.texto, old.creado_en, old.dibujo, old.adjunto, old.enviar_en) then
      raise exception 'Un comentario no se puede editar' using errcode = '42501';
    end if;
    if old.autor = v_autor and new.leido_en is distinct from old.leido_en then
      raise exception 'Solo quien recibe un comentario lo marca como leído' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- El atleta solo ve (y marca leído) lo que ya ha salido
drop policy if exists atleta_ver on public.comentarios;
create policy atleta_ver on public.comentarios for select to authenticated
  using (atleta_id = public.mi_atleta_id() and (enviar_en is null or enviar_en <= now()));
drop policy if exists atleta_leer on public.comentarios;
create policy atleta_leer on public.comentarios for update to authenticated
  using (atleta_id = public.mi_atleta_id() and (enviar_en is null or enviar_en <= now()))
  with check (atleta_id = public.mi_atleta_id() and (enviar_en is null or enviar_en <= now()));

-- La notificación del comentario (014), a su hora si está programado: «Pelayo te ha escrito» sale cuando sale el
-- mensaje (y, como todas, respeta su «no molestar»)
create or replace function fbe_privado.al_comentar() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  a public.atletas;
  v_donde text;
  v_general boolean;
  v_desde timestamptz := case when new.enviar_en > now() then new.enviar_en end;
begin
  -- Un mensaje suelto o un adjunto del chat es «un mensaje»; lo demás va pegado a una sesión, un check-in o un vídeo
  v_general := (new.sesion_id is null and new.checkin_id is null and new.archivo_id is null) or coalesce(new.adjunto, false);
  select * into a from public.atletas where id = new.atleta_id;
  if a.id is null then return null; end if;
  v_donde := case
    when v_general then 'Mensaje nuevo'
    when new.sesion_id is not null then (select 'En ' || s.nombre from public.sesiones s where s.id = new.sesion_id)
    when new.checkin_id is not null then case when new.autor = 'coach' then 'En tu check-in' else 'En su check-in' end
    when new.archivo_id is not null then case when new.autor = 'coach' then 'En tu vídeo' else 'En su vídeo' end
    else 'Mensaje nuevo' end;
  if new.autor = 'coach' then
    if a.estado = 'activo' then
      perform fbe_privado.notificar(a.perfil_id, 'respuesta',
        coalesce(fbe_privado.nombre_corto((select p.nombre from public.perfiles p where p.id = auth.uid())), 'Tu coach')
          || case when v_general then ' te ha escrito' else ' te ha respondido' end,
        v_donde, case when v_general then '#mensajes' else '#hoy' end, 'comentario:' || new.id, v_desde);
    end if;
  else
    -- Al coach, una por atleta cada 10 minutos (si escribe cinco mensajes seguidos, una sola)
    perform fbe_privado.notificar_seguro(p.id, 'mensaje',
      coalesce(fbe_privado.nombre_corto(a.nombre), 'Un atleta') || ' te ha escrito', v_donde,
      case when v_general then '#mensajes' else '#revisar' end,
      'mensaje:' || a.id || ':' || floor(extract(epoch from now()) / 600)::bigint)
    from public.perfiles p where p.rol = 'coach' and p.id is distinct from auth.uid();
  end if;
  return null;
exception when others then
  raise warning 'FBE: notificación del comentario % no creada: %', new.id, sqlerrm;
  return null;
end $$;

-- Si el coach cambia la hora de uno programado (o lo manda ya), su notificación se rehace para la hora nueva
create or replace function fbe_privado.al_reprogramar_comentario() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  a public.atletas;
begin
  if new.enviar_en is not distinct from old.enviar_en or new.autor <> 'coach' then return null; end if;
  delete from public.notificaciones n where n.clave = 'comentario:' || new.id and n.estado = 'pendiente';
  select * into a from public.atletas where id = new.atleta_id;
  if a.id is null or a.estado <> 'activo' then return null; end if;
  perform fbe_privado.notificar(a.perfil_id, 'respuesta',
    coalesce(fbe_privado.nombre_corto((select p.nombre from public.perfiles p where p.id = auth.uid())), 'Tu coach') || ' te ha escrito',
    'Mensaje nuevo', '#mensajes', 'comentario:' || new.id, case when new.enviar_en > now() then new.enviar_en end);
  return null;
exception when others then
  raise warning 'FBE: notificación del comentario % no rehecha: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists comentarios_zz_reprogramar on public.comentarios;
create trigger comentarios_zz_reprogramar after update of enviar_en on public.comentarios
  for each row execute function fbe_privado.al_reprogramar_comentario();

-- Avisos programados: con hora de salida, el aviso empieza ese día (en Madrid) y se ve desde esa hora; uno para
-- «ya mismo» sale ya; como mucho a 90 días
create or replace function public.aviso_preparar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.enviar_en is not null and (tg_op = 'INSERT' or new.enviar_en is distinct from old.enviar_en) then
    if new.enviar_en > now() + interval '90 days' then
      raise exception 'Un aviso se programa como mucho a 90 días vista' using errcode = '22023';
    end if;
    if new.enviar_en <= now() + interval '30 seconds' then new.enviar_en := null; end if;
  end if;
  -- Uno que ya ha salido (con su hora pasada, o sin hora y desde un día que ya ha llegado) no se vuelve a esconder
  if tg_op = 'UPDATE' and new.enviar_en is not null and new.enviar_en is distinct from old.enviar_en
     and ((old.enviar_en is not null and old.enviar_en <= now())
          or (old.enviar_en is null and old.desde <= (now() at time zone 'Europe/Madrid')::date)) then
    raise exception 'Este aviso ya ha salido: no se puede volver a programar (publica uno nuevo)' using errcode = '42501';
  end if;
  if new.enviar_en is not null then new.desde := (new.enviar_en at time zone 'Europe/Madrid')::date; end if;
  return new;
end $$;
drop trigger if exists avisos_aa_preparar on public.avisos;
create trigger avisos_aa_preparar before insert or update on public.avisos
  for each row execute function public.aviso_preparar();

drop policy if exists atleta_ver on public.avisos;
create policy atleta_ver on public.avisos for select to authenticated
  using (
    public.mi_atleta_id() is not null
    and (atleta_id is null or atleta_id = public.mi_atleta_id())
    -- «hoy» en hora de España (Supabase trabaja en UTC; la app usa la fecha del móvil)
    and desde <= (now() at time zone 'Europe/Madrid')::date
    and (hasta is null or hasta >= (now() at time zone 'Europe/Madrid')::date)
    and (enviar_en is null or enviar_en <= now())
  );

-- La notificación del aviso (010), a su hora si está programado
create or replace function fbe_privado.al_crear_aviso() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_desde timestamptz;
  v_caduca timestamptz;
  v_titulo text;
begin
  if tg_op = 'UPDATE' then
    delete from public.notificaciones n where n.clave = 'aviso:' || new.id and n.estado = 'pendiente';
  end if;
  if new.hasta is not null and new.hasta < v_hoy then return null; end if;
  v_desde := case when new.enviar_en > now() then new.enviar_en
                  when new.desde > v_hoy then (new.desde + time '09:00') at time zone 'Europe/Madrid' else now() end;
  v_caduca := case when new.hasta is not null then (new.hasta + 1)::timestamp at time zone 'Europe/Madrid'
                   else v_desde + interval '1 day' end;
  v_titulo := coalesce('Aviso de ' || fbe_privado.nombre_corto((select p.nombre from public.perfiles p where p.id = auth.uid())), 'Aviso nuevo');
  perform fbe_privado.notificar_seguro(a.perfil_id, 'aviso', v_titulo, 'Tócalo para leerlo en la app.', '#hoy', 'aviso:' || new.id, v_desde, v_caduca)
  from public.atletas a
  where a.estado = 'activo' and a.perfil_id is not null and (new.atleta_id is null or a.id = new.atleta_id);
  return null;
exception when others then
  raise warning 'FBE: notificación del aviso % no creada: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists avisos_zz_notificar on public.avisos;
create trigger avisos_zz_notificar after insert or update of texto, atleta_id, desde, hasta, enviar_en on public.avisos
  for each row execute function fbe_privado.al_crear_aviso();

-- ---------------------------------------------------------------------
-- 3. Notificaciones de las tareas: «Pelayo te ha puesto una tarea» (sin el texto) y, al hacerla, al coach
-- ---------------------------------------------------------------------
alter table public.notificaciones drop constraint if exists notificaciones_validas;
alter table public.notificaciones add constraint notificaciones_validas check (
  tipo in ('respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario',
           'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido', 'prueba', 'descanso', 'comunidad',
           'tarea', 'tarea_hecha')
  and char_length(titulo) between 1 and 80
  and (cuerpo is null or char_length(cuerpo) <= 160)
  and url in ('#hoy', '#semana', '#checkin', '#progreso', '#perfil', '#atletas', '#revisar', '#cuenta', '#mensajes', '#equipo')
  and char_length(clave) between 1 and 100
  and estado in ('pendiente', 'enviando', 'enviada', 'caducada', 'fallida')
  and (canal is null or canal in ('push', 'email'))
  and intentos between 0 and 100
  and (error is null or char_length(error) <= 200)
) not valid;

alter table public.preferencias_notificaciones drop constraint if exists preferencias_notificaciones_validas;
alter table public.preferencias_notificaciones add constraint preferencias_notificaciones_validas check (
  desactivados <@ array['respuesta', 'semana', 'aviso', 'sesion_hoy', 'checkin', 'habitos', 'nutricion', 'cuestionario',
                        'mensaje', 'checkin_recibido', 'video_recibido', 'sesion_hecha', 'cuestionario_recibido', 'descanso', 'comunidad',
                        'tarea', 'tarea_hecha']::text[]
  and hora_manana between time '05:00' and time '12:00' and extract(second from hora_manana) = 0
  and hora_tarde between time '12:00' and time '23:30' and extract(second from hora_tarde) = 0
  and dia_checkin between 1 and 7
  and (silencio_desde is null) = (silencio_hasta is null)
  and (silencio_desde is null or (silencio_desde <> silencio_hasta
       and extract(second from silencio_desde) = 0 and extract(second from silencio_hasta) = 0))
);

create or replace function fbe_privado.al_cambiar_tarea() returns trigger
language plpgsql security definer set search_path = '' set lock_timeout = '1s' as $$
declare
  a public.atletas;
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
  select * into a from public.atletas where id = new.atleta_id;
  if a.id is null then return null; end if;
  if tg_op = 'INSERT' then
    if a.estado <> 'activo' or a.perfil_id is null or new.hecha_en is not null then return null; end if;
    perform fbe_privado.notificar(a.perfil_id, 'tarea',
      coalesce(fbe_privado.nombre_corto((select p.nombre from public.perfiles p where p.id = auth.uid())), 'Tu coach') || ' te ha puesto una tarea',
      case when new.fecha <= v_hoy then 'Para hoy: la tienes en Tu día.' else 'Para el ' || fbe_privado.fecha_texto(new.fecha) || '.' end,
      '#hoy', 'tarea:' || new.id);
    return null;
  end if;
  -- Hecha → al coach (una por tarea); deshecha antes de que salga, ya no sale
  if new.hecha_en is not null and old.hecha_en is null then
    perform fbe_privado.notificar_seguro(p.id, 'tarea_hecha',
      coalesce(fbe_privado.nombre_corto(a.nombre), 'Un atleta') || ' ha hecho su tarea', 'La tienes en Revisar.', '#revisar', 'tarea_hecha:' || new.id)
    from public.perfiles p where p.rol = 'coach' and p.id is distinct from auth.uid();
  elsif new.hecha_en is null and old.hecha_en is not null then
    delete from public.notificaciones n where n.clave = 'tarea_hecha:' || new.id and n.estado = 'pendiente';
  end if;
  return null;
exception when others then
  raise warning 'FBE: notificación de la tarea % no creada: %', new.id, sqlerrm;
  return null;
end $$;
drop trigger if exists tareas_zz_notificar on public.tareas;
create trigger tareas_zz_notificar after insert or update of hecha_en on public.tareas
  for each row execute function fbe_privado.al_cambiar_tarea();
drop trigger if exists tareas_zz_retirar on public.tareas;
create trigger tareas_zz_retirar after delete on public.tareas
  for each row execute function fbe_privado.al_borrar_origen('tarea:');
drop trigger if exists tareas_zz_retirar_hecha on public.tareas;
create trigger tareas_zz_retirar_hecha after delete on public.tareas
  for each row execute function fbe_privado.al_borrar_origen('tarea_hecha:');

-- ---------------------------------------------------------------------
-- 4. El bloque entero para el atleta: de cada semana, solo su número, su fecha y si está publicada
-- ---------------------------------------------------------------------
create or replace function public.bloque_semanas(p_bloque uuid)
returns table (numero integer, fecha_inicio date, publicada boolean)
language sql stable security definer set search_path = '' as $$
  select w.numero, w.fecha_inicio, w.programacion = 'programada'
  from public.semanas w
  join public.bloques b on b.id = w.bloque_id
  where w.bloque_id = p_bloque and not b.es_plantilla
    and (public.es_coach() or (b.atleta_id is not null and b.atleta_id = public.mi_atleta_id()))
  order by w.numero
$$;

-- ---------------------------------------------------------------------
-- 5. El día de la baja (para el panel de negocio del coach): lo pone la base al pasar a «baja» y se quita al
--    volver; el coach puede corregirlo mientras siga de baja. Las bajas de antes se quedan sin fecha.
-- ---------------------------------------------------------------------
alter table public.atletas add column if not exists baja_en date;
create or replace function public.atleta_fecha_baja() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.estado <> 'baja' then new.baja_en := null;
  elsif tg_op = 'INSERT' or old.estado <> 'baja' then new.baja_en := coalesce(new.baja_en, (now() at time zone 'Europe/Madrid')::date);
  end if;
  if new.baja_en is not null and (new.baja_en < date '2020-01-01' or new.baja_en > (now() at time zone 'Europe/Madrid')::date) then
    raise exception 'El día de la baja, entre 2020 y hoy' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists atletas_aa_fecha_baja on public.atletas;
create trigger atletas_aa_fecha_baja before insert or update of estado, baja_en on public.atletas
  for each row execute function public.atleta_fecha_baja();

-- ---------------------------------------------------------------------
-- 5b. Las notificaciones que aún no tocan (la de un mensaje o un aviso programado, con su hora y su clave) no las ve
--     el atleta hasta su hora: verlas antes adelantaría lo programado. El coach ve las suyas como hasta ahora.
-- ---------------------------------------------------------------------
drop policy if exists propias_ver on public.notificaciones;
create policy propias_ver on public.notificaciones for select to authenticated
  using (usuario_id = auth.uid() and (public.es_coach() or estado <> 'pendiente' or enviar_desde <= now()));

-- ---------------------------------------------------------------------
-- 6. Permisos (desde la 019, cada tabla nueva lleva los suyos a mano). Las tareas: el coach todo; el atleta, ver
--    las suyas (marcarlas, con tarea_completar). Las plantillas, solo el coach.
-- ---------------------------------------------------------------------
alter table public.tareas enable row level security;
alter table public.tareas_plantillas enable row level security;
drop policy if exists coach_todo on public.tareas;
create policy coach_todo on public.tareas for all to authenticated using (public.es_coach()) with check (public.es_coach());
drop policy if exists atleta_ver on public.tareas;
create policy atleta_ver on public.tareas for select to authenticated using (atleta_id = public.mi_atleta_id());
drop policy if exists coach_todo on public.tareas_plantillas;
create policy coach_todo on public.tareas_plantillas for all to authenticated using (public.es_coach()) with check (public.es_coach());
revoke all on public.tareas, public.tareas_plantillas from public, anon, authenticated;
grant select, insert, update, delete on public.tareas, public.tareas_plantillas to authenticated;

-- Permisos (como al final de 003 a 029)
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.crear_recordatorios(timestamptz), public.notificaciones_por_enviar(integer, boolean),
  public.notificaciones_resultado(jsonb) from public, anon, authenticated;
revoke all on all functions in schema fbe_privado from public, anon, authenticated;

insert into public.fbe_migraciones (numero) values (30)
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
