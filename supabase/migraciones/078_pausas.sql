-- =====================================================================
-- FBE Equipo, migración 078: Pausar la asesoría
--
-- Por qué: vacaciones, una temporada de mucho trabajo o un parón por lo que sea. El coach pone una pausa en la ficha (con su motivo,
-- desde cuándo y, si la sabe, la fecha de vuelta) y, mientras dura, el atleta no recibe recordatorios, no sale en las
-- alertas del panel ni en «A quién escribir» y su racha no se rompe. A la vuelta, todo sigue donde estaba. No es una
-- baja: el atleta puede seguir entrando y apuntando lo que quiera. Los cobros no cambian.
--
--   * pausas: cada pausa de un atleta (desde, hasta o sin fecha de vuelta, motivo y una nota). Solo la pone, la cambia
--     y la quita el coach; el atleta ve las suyas (los días, el motivo y la nota, que es un mensaje del coach para él).
--     El motivo es una de cuatro palabras (vacaciones, trabajo, personal, otro): nada de salud; eso va en las notas
--     privadas del coach o en las molestias, con su consentimiento.
--   * atletas.estado pasa solo a 'pausado' el día que empieza una pausa y vuelve a 'activo' al día siguiente de su fecha
--     de vuelta (al guardar la pausa y, después, cada día, en la pasada de los recordatorios). Quien ya estaba en
--     'pausado' sin ninguna pausa apuntada se queda como está, hasta que el coach lo cambie.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 077 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 78 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 078 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 78;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 77) then  -- (2) la anterior
    raise exception 'Falta la migración 077 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Las pausas
-- ---------------------------------------------------------------------
create table if not exists public.pausas (
  id uuid primary key default gen_random_uuid(),
  atleta_id uuid not null references public.atletas(id) on delete cascade,
  desde date not null,
  hasta date,
  motivo text not null default 'otro',
  nota text,
  creado_en timestamptz not null default now()
);
alter table public.pausas drop constraint if exists pausas_validas;
alter table public.pausas add constraint pausas_validas check (
  motivo in ('vacaciones', 'trabajo', 'personal', 'otro')
  and (hasta is null or hasta >= desde)
  and desde between date '2020-01-01' and date '2100-01-01'
  and (hasta is null or hasta <= date '2100-01-01')
  and (nota is null or (char_length(nota) between 1 and 200 and public.texto_visible(nota)))
);
create index if not exists pausas_atleta on public.pausas (atleta_id, desde);
alter table public.pausas enable row level security;
revoke all on public.pausas from public, anon;
grant select, insert, update, delete on public.pausas to authenticated;
drop policy if exists coach_todo on public.pausas;
create policy coach_todo on public.pausas for all to authenticated
  using (public.es_coach()) with check (public.es_coach());
-- El atleta ve las suyas; no las cambia
drop policy if exists atleta_ver on public.pausas;
create policy atleta_ver on public.pausas for select to authenticated
  using (atleta_id = public.mi_atleta_id());

-- ---------------------------------------------------------------------
-- 2. El estado del atleta sigue a sus pausas
-- ---------------------------------------------------------------------
-- De un atleta (o de todos, con null): en pausa si hoy cae dentro de alguna de sus pausas; de vuelta si tiene pausas
-- apuntadas y hoy no cae en ninguna. Ni los invitados ni los de baja cambian
create or replace function fbe_privado.aplicar_pausas(p_atleta uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
  update public.atletas a set estado = 'pausado'
    where a.estado = 'activo' and (p_atleta is null or a.id = p_atleta)
      and exists (select 1 from public.pausas p where p.atleta_id = a.id and p.desde <= v_hoy and (p.hasta is null or p.hasta >= v_hoy));
  update public.atletas a set estado = 'activo'
    where a.estado = 'pausado' and (p_atleta is null or a.id = p_atleta)
      and exists (select 1 from public.pausas p where p.atleta_id = a.id)
      and not exists (select 1 from public.pausas p where p.atleta_id = a.id and p.desde <= v_hoy and (p.hasta is null or p.hasta >= v_hoy));
end $$;

create or replace function public.pausa_aplicar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    -- al quitar su última pausa, si estaba en pausa por ella, vuelve
    if not exists (select 1 from public.pausas p where p.atleta_id = old.atleta_id) then
      update public.atletas set estado = 'activo' where id = old.atleta_id and estado = 'pausado';
    else
      perform fbe_privado.aplicar_pausas(old.atleta_id);
    end if;
    return old;
  end if;
  perform fbe_privado.aplicar_pausas(new.atleta_id);
  if tg_op = 'UPDATE' and old.atleta_id is distinct from new.atleta_id then perform fbe_privado.aplicar_pausas(old.atleta_id); end if;
  return new;
end $$;
drop trigger if exists pausas_zz_aplicar on public.pausas;
create trigger pausas_zz_aplicar after insert or update or delete on public.pausas
  for each row execute function public.pausa_aplicar();

create or replace function public.crear_recordatorios_apuntes(p_ahora timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_local timestamp := p_ahora at time zone 'Europe/Madrid';
  v_hoy date := (p_ahora at time zone 'Europe/Madrid')::date;
  v_n integer := 0;
begin
  perform fbe_privado.solo_servidor();
  with x as materialized (
    select d.perfil_id, d.hora_tarde, count(v.apunte) as n
    from fbe_privado.destinatarios d
    join public.apuntes_vistos v on v.atleta_id = d.atleta_id and v.proxima is not null and v.proxima <= v_hoy
    where not ('repaso' = any (d.desactivados))
      and v_local >= v_hoy + d.hora_tarde - interval '2 hours' and v_local < v_hoy + d.hora_tarde
      and not exists (select 1 from public.bloques b
                      join public.semanas w on w.bloque_id = b.id
                      join public.sesiones s on s.semana_id = w.id and s.dia_previsto = v_hoy
                      where b.atleta_id = d.atleta_id and not b.es_plantilla and b.estado not in ('cancelado', 'finalizado'))
    group by d.perfil_id, d.hora_tarde
    having count(v.apunte) >= 3
  )
  select count(*) into v_n from x
  where fbe_privado.notificar_seguro(x.perfil_id, 'repaso',
          'Tienes ' || least(x.n, 99) || ' apuntes por repasar',
          'Un par de minutos y no se te olvidan. Están en Semana, en «Tus apuntes».',
          '#semana', 'recordatorio_repaso:' || v_hoy, p_ahora,
          (v_hoy + x.hora_tarde + interval '2 hours') at time zone 'Europe/Madrid');
  -- (077) y, en la misma pasada, los avisos de los suplementos (así no hace falta volver a desplegar la función del servidor).
  -- (revisión) Si esa parte fallara, los de los apuntes salen igual
  begin
    v_n := v_n + fbe_privado.recordatorios_suplementos(p_ahora);
  exception when others then
    raise warning 'FBE: avisos de suplementos no creados: %', sqlerrm;
  end;
  -- (078) y, de paso, las pausas que empiezan o acaban hoy (si fallara, lo demás sale igual)
  begin
    perform fbe_privado.aplicar_pausas(null);
  exception when others then
    raise warning 'FBE: pausas no aplicadas: %', sqlerrm;
  end;
  return v_n;
end $$;

-- La copia completa del coach, también con las pausas
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
    'portadas', coalesce((select jsonb_agg(to_jsonb(t)) from public.portadas t), '[]'::jsonb),
    'objetivos_propuestos', coalesce((select jsonb_agg(to_jsonb(t)) from public.objetivos_propuestos t), '[]'::jsonb),
    'objetivos_rondas', coalesce((select jsonb_agg(to_jsonb(t)) from public.objetivos_rondas t), '[]'::jsonb),
    'suplementos', coalesce((select jsonb_agg(to_jsonb(t)) from public.suplementos t), '[]'::jsonb),
    'suplementos_tomas', coalesce((select jsonb_agg(to_jsonb(t)) from public.suplementos_tomas t), '[]'::jsonb),
    'pausas', coalesce((select jsonb_agg(to_jsonb(t)) from public.pausas t), '[]'::jsonb));
end $$;
comment on function public.copia_privada() is 'Para la copia completa del coach: las tablas de la 050 y la 051 (sin las huellas de los enlaces), la agenda (069), la música 3 (072), las portadas (073), las propuestas de objetivo (076), los suplementos (077) y las pausas (078). Solo el coach.';

-- ---------------------------------------------------------------------
-- 3. Permisos (como al final de 003 a 077)
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
-- (078) la que sigue a las pausas es de un trigger: nadie la llama
revoke execute on function public.pausa_aplicar() from public, anon, authenticated;
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

insert into public.fbe_migraciones (numero) values (78)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
