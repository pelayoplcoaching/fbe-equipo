// (v0.254) Los nombres de Pauta Activa para reconocer la medicación que escribe el atleta en sus preguntas de salud.
// Saca de la base de Pauta Activa (otro repositorio: pelayoplcoaching/medicacion-y-ejercicio, app/data/kb.json) solo lo
// que hace falta para reconocer y abrir Pauta Activa con su lista: cada principio activo (id, nombre, familia y sus marcas
// de la base) y las combinaciones (nombre, marcas, componentes y dosis). Nada de reglas ni de textos de salud: esos siguen
// en Pauta Activa. Escribe web/src/datos/pauta-activa-nombres.json (se carga solo al abrir «Mi medicación y el ejercicio»).
// Uso: node scripts/pauta-activa-nombres.mjs <carpeta de medicacion-y-ejercicio>
// Volver a ejecutarlo cuando cambie la base de Pauta Activa (la versión queda en el archivo y la enseña la hoja).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = process.argv[2];
if (!raiz) { console.error('Uso: node scripts/pauta-activa-nombres.mjs <carpeta de medicacion-y-ejercicio>'); process.exit(1); }
const kb = JSON.parse(readFileSync(join(raiz, 'app/data/kb.json'), 'utf8'));
// La familia, sin la lista de ejemplos entre paréntesis: «Estatinas (atorvastatina, …)» → «Estatinas»
const corta = (s) => String(s).replace(/\s*\(.*$/, '').trim();
const familias = {};
const principios = [];
const vistos = new Set();
for (const c of kb.clases) {
  familias[c.id] = corta(c.nombre);
  for (const p of c.principios || []) {
    if (vistos.has(p.id)) continue;
    vistos.add(p.id);
    principios.push([p.id, p.nombre, c.id, (p.marcas || []).filter((m) => typeof m === 'string' && m.trim())]);
  }
}
const combinaciones = (kb.combinaciones || []).map((x) => [x.nombre, (x.marcas || []).filter(Boolean),
  (x.componentes || []).map((y) => y.pid), (x.componentes || []).map((y) => (Number.isFinite(y.dosis) ? y.dosis : null))])
  .filter(([, , pids]) => pids.length && pids.every((pid) => vistos.has(pid)));
const salida = { version: kb.version, f: familias, p: principios, x: combinaciones };
const destino = join(dirname(fileURLToPath(import.meta.url)), '../web/src/datos/pauta-activa-nombres.json');
writeFileSync(destino, JSON.stringify(salida) + '\n');
console.log(`Pauta Activa ${kb.version}: ${principios.length} principios, ${Object.keys(familias).length} familias, ${combinaciones.length} combinaciones → ${destino}`);
