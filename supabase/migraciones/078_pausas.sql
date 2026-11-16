-- =====================================================================
-- FBE Equipo, migración 078: Pausar la asesoría
--
-- Por qué: vacaciones, una temporada de mucho trabajo o un parón por lo que sea. El coach pone una pausa en la ficha (con su motivo,
-- desde cuándo y, si la sabe, la fecha de vuelta) y, mientras dura, el atleta no recibe recordatorios, no sale en las
-- alertas del panel ni en «A quién escribir» y su racha no se rompe (los mensajes de su coach sí le llegan). A la vuelta, todo sigue donde estaba. No es una
-- baja: el atleta puede seguir entrando y apuntando lo que quiera. Los cobros no cambian.
--
--   * pausas: cada pausa de un atleta (desde, hasta o sin fecha de vuelta, motivo y una nota). Solo la pone, la cambia
--     y la quita el coach; el atleta ve las suyas (los días, el motivo y la nota, que es un mensaje del coach para él).
--     El motivo es una de cuatro palabras (vacaciones, trabajo, personal, otro): nada de salud; eso va en las notas
--     privadas del coach o en las molestias, con su consentimiento.
--   * El estado del atleta no cambia (sigue 'activo'): así le siguen llegando los mensajes, los avisos y las respuestas
--     de su coach. Lo único que cambia en la base es la vista de a quién se mandan los recordatorios
--     (fbe_privado.destinatarios): quien hoy está en pausa no recibe los de la sesión, el check-in, los hábitos, la
--     nutrición, los apuntes ni los suplementos. Las alertas del panel, «A quién escribir» y la racha las resuelve la app.
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

drop trigger if exists pausas_zz_aplicar on public.pausas;
drop function if exists public.pausa_aplicar();
drop function if exists fbe_privado.aplicar_pausas(uuid);

-- ---------------------------------------------------------------------
-- 2. En pausa no hay recordatorios
-- ---------------------------------------------------------------------
-- La vista de la 010, igual, sin quien hoy está en pausa (hora de España). Los avisos de lo que hace su coach (mensajes,
-- semana publicada, tareas…) no pasan por esta vista: le siguen llegando
create or replace view fbe_privado.destinatarios with (security_barrier) as
select a.id as atleta_id, a.perfil_id,
       coalesce(p.desactivados, '{sesion_hecha}'::text[]) as desactivados,
       coalesce(p.hora_manana, time '08:30') as hora_manana,
       coalesce(p.hora_tarde, time '21:00') as hora_tarde,
       coalesce(p.dia_checkin, 7) as dia_checkin,
       exists (select 1 from public.consentimientos c
               where c.perfil_id = a.perfil_id and c.tipo = 'datos_salud' and c.revocado_en is null) as salud
from public.atletas a
left join public.preferencias_notificaciones p on p.usuario_id = a.perfil_id
where a.estado = 'activo' and a.perfil_id is not null
  and (coalesce(p.email, false) or exists (select 1 from public.suscripciones_push s where s.usuario_id = a.perfil_id))
  -- (078) quien hoy tiene su asesoría en pausa no recibe recordatorios
  and not exists (select 1 from public.pausas z where z.atleta_id = a.id
                  and z.desde <= (now() at time zone 'Europe/Madrid')::date
                  and (z.hasta is null or z.hasta >= (now() at time zone 'Europe/Madrid')::date));
revoke all on fbe_privado.destinatarios from public, anon, authenticated;

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
