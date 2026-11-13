-- =====================================================================
-- FBE Equipo, migración 065: más frases del coach, con su voz (sonido 2, tanda 6)
--
-- Por qué: a las seis frases de la 064 se suman cuatro: el saludo al empezar la sesión («saludo»), la mitad de la sesión
-- («mitad_sesion»), «a por el récord» («a_por_record», al abrir un ejercicio en el que la app propone subir) y el último
-- ejercicio («ultimo_ejercicio»). Solo cambia qué claves admite voces_coach; nada guarda datos de los atletas.
--
-- Se ejecuta en el SQL Editor después de schema.sql y las migraciones 002 a 064 (o con instalar.sql en una base nueva).
-- Se puede repetir sin romper nada.
-- =====================================================================

do $$
declare v smallint;
begin
  select max(numero) into v from public.fbe_migraciones;
  if v > 65 then  -- (1) número de esta migración
    raise exception 'Esta base ya tiene la migración %: repetir la 065 desharía sus cambios. Ejecuta solo las que te falten.', to_char(v, 'FM000')
      using hint = 'Si de verdad hace falta repetirla: ejecuta antes «delete from public.fbe_migraciones where numero > 65;» y, después de ella, todas las siguientes en orden.';
  end if;
  if not exists (select 1 from public.fbe_migraciones where numero = 64) then  -- (2) la anterior
    raise exception 'Falta la migración 064 (esta base va por la %). Ejecuta las migraciones en orden.', to_char(coalesce(v, 0), 'FM000');
  end if;
end $$;

alter table public.voces_coach drop constraint if exists voces_coach_valida;
alter table public.voces_coach add constraint voces_coach_valida check (
  clave in ('vamos', 'ultima', 'record', 'fin_sesion', 'buen_trabajo', 'fin_descanso', 'saludo', 'mitad_sesion', 'a_por_record', 'ultimo_ejercicio')
  and ruta ~ '^voces/[a-z_]{3,20}-[0-9a-f-]{8,40}\.(webm|ogg|m4a|mp4|mp3|aac)$'
  and duracion_ms between 0 and 8000
);

insert into public.fbe_migraciones (numero) values (65)  -- (3) número de esta migración
  on conflict (numero) do update set aplicada_en = excluded.aplicada_en;
