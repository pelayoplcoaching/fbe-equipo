// Genera la biblioteca de ejercicios a partir de la exportación de Notion (data/ejercicios_notion.json):
//   - web/src/datos/biblioteca-fbe.json       completa, para la demo privada (no se sube al repositorio)
//   - web/src/datos/biblioteca-generica.json  solo nombres, grupos y tipo, para la web pública
//   - supabase/seed_ejercicios.sql            se pega en Supabase después de schema.sql y las migraciones
// Uso: node scripts/biblioteca.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const origen = JSON.parse(readFileSync(new URL('../data/ejercicios_notion.json', import.meta.url), 'utf8'));
const GRUPOS = new Set(['pectoral', 'espalda', 'deltoides', 'cuadriceps', 'gluteo', 'isquiotibiales', 'biceps', 'triceps', 'abdominales', 'gemelo']);
const TIPOS = new Set(['basico', 'multiarticular', 'aislamiento']);

const limpia = (s) => (s == null ? null : String(s).replace(/\s+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim() || null);

const ejercicios = origen.map((e) => {
  const opciones = limpia(e.variante);
  const instrucciones = [opciones ? `Opciones: ${opciones}` : null, limpia(e.instrucciones)].filter(Boolean).join('\n\n') || null;
  return {
    nombre: limpia(e.nombre),
    grupos_musculares: (e.grupos_musculares || []).filter((g) => GRUPOS.has(g)),
    tipo: (e.tipo || []).filter((t) => TIPOS.has(t)),
    rango_reps: limpia(e.rango_reps),
    video_url: limpia(e.video_url),
    instrucciones,
    errores: limpia(e.errores),
    alternativas: e.alternativas || [],  // nombres de otros ejercicios de la biblioteca
  };
});
const nombres = new Set(ejercicios.map((e) => e.nombre));
for (const e of ejercicios) e.alternativas = e.alternativas.filter((a) => nombres.has(a) && a !== e.nombre);

writeFileSync(new URL('../web/src/datos/biblioteca-fbe.json', import.meta.url), JSON.stringify(ejercicios));
writeFileSync(new URL('../web/src/datos/biblioteca-generica.json', import.meta.url),
  JSON.stringify(ejercicios.map(({ nombre, grupos_musculares, tipo }) => ({ nombre, grupos_musculares, tipo }))));

const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const arr = (a, tipo = 'text') => `array[${a.map(q).join(',')}]::${tipo}[]`;
const fecha = new Date().toISOString().slice(0, 10);
const filas = ejercicios.map((e) => `  (${q(e.nombre)}, ${arr(e.grupos_musculares)}, ${arr(e.tipo)}, ${q(e.rango_reps)}, ${q(e.video_url)}, ${q(e.instrucciones)}, ${q(e.errores)})`);
const conAlternativas = ejercicios.filter((e) => e.alternativas.length);
const filasAlt = conAlternativas.map((e) => `  (${q(e.nombre)}, ${arr(e.alternativas)})`);

const sql = `-- Biblioteca de ejercicios de FBE (${ejercicios.length} ejercicios), exportada de Notion el ${fecha}.
-- Se aplica después de schema.sql y de las migraciones (necesita la 002).
-- Se puede repetir: no duplica ejercicios ni pisa lo que hayas cambiado desde la app.

-- 1. Ejercicios que aún no existen
insert into public.ejercicios (nombre, grupos_musculares, tipo, rango_reps, video_url, instrucciones, errores)
select v.nombre, v.grupos, v.tipo, v.rango, v.video, v.instr, v.errores
from (values
${filas.join(',\n')}
) as v(nombre, grupos, tipo, rango, video, instr, errores)
where not exists (select 1 from public.ejercicios e where e.nombre = v.nombre);

-- 2. Campos nuevos en los que ya estaban (solo si están vacíos)
update public.ejercicios e
set tipo = case when e.tipo = '{}' then v.tipo else e.tipo end,
    rango_reps = coalesce(e.rango_reps, v.rango),
    errores = coalesce(e.errores, v.errores)
from (values
${filas.join(',\n')}
) as v(nombre, grupos, tipo, rango, video, instr, errores)
where e.nombre = v.nombre;

-- 3. Alternativas equivalentes (por nombre), solo donde aún no hay ninguna
update public.ejercicios e
set alternativas = coalesce((
      select array_agg(x.id order by a.k)
      from unnest(v.alts) with ordinality as a(nombre, k)
      join public.ejercicios x on x.nombre = a.nombre
    ), '{}')
from (values
${filasAlt.join(',\n')}
) as v(nombre, alts)
where e.nombre = v.nombre and e.alternativas = '{}';
`;
writeFileSync(new URL('../supabase/seed_ejercicios.sql', import.meta.url), sql);
console.log(`${ejercicios.length} ejercicios (${conAlternativas.length} con alternativas) → biblioteca-fbe.json, biblioteca-generica.json y seed_ejercicios.sql`);
