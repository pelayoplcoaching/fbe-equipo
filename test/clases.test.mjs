// (v0.207) Nombres de estilos que chocan. Todos los archivos de estilos van juntos en app.css, así que una clase que ya
// tiene estilos en otro archivo los hereda (y se los cambia a la otra pantalla). En noviembre pasó con .record,
// .historia, .revision-fila, .etq y .nota-privada, y cada vez se rompió otra pantalla.
// Muchas clases se pulen a propósito en varios archivos (diseno.css, pulido.css, belleza.css… retocan lo de
// estilos.css): esas están apuntadas en test/clases-compartidas.txt. La prueba falla cuando una clase aparece en un
// archivo nuevo y ya tenía estilos en otro:
//   - si es otra cosa, usa un nombre con el prefijo de su pantalla (.rv-record, .pv-historia…);
//   - si de verdad es la misma (un retoque a propósito), apúntala: ACTUALIZAR=1 node test/clases.test.mjs
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const raiz = new URL('..', import.meta.url).pathname;
const src = join(raiz, 'web/src');
const listar = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? listar(join(d, f)) : [join(d, f)]));

// Las clases de los selectores de cada archivo (sin comentarios ni declaraciones: «0.5em» o «url(x.png)» no son clases)
export function clasesDe(css) {
  let t = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"[^"\n]*"|'[^'\n]*'/g, '""');
  // (una sola pasada: quita las declaraciones, que no llevan llaves dentro; los selectores de dentro de un @media se quedan)
  t = t.replace(/\{[^{}]*\}/g, ';');
  return new Set([...t.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
}

const archivos = listar(src).filter((f) => f.endsWith('.css')).sort();
const de = new Map();
for (const f of archivos) for (const k of clasesDe(readFileSync(f, 'utf8'))) { if (!de.has(k)) de.set(k, new Set()); de.get(k).add(relative(src, f)); }
const enVarios = [...de].filter(([, s]) => s.size > 1).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

const LISTA = new URL('./clases-compartidas.txt', import.meta.url);
const linea = ([k, s]) => `${k}: ${[...s].sort().join(' ')}`;
if (process.env.ACTUALIZAR) {
  writeFileSync(LISTA, `# Clases con estilos en varios archivos a propósito (test/clases.test.mjs). Una por línea: «clase: archivos».\n${enVarios.map(linea).join('\n')}\n`);
  console.log(`Apuntadas ${enVarios.length} clases compartidas en test/clases-compartidas.txt`);
  process.exit(0);
}
const apuntadas = new Map(readFileSync(LISTA, 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => { const [k, fs] = l.split(':'); return [k.trim(), new Set(fs.trim().split(/\s+/))]; }));

console.log('Nombres de estilos que chocan');
check(archivos.length >= 20 && de.size > 1000, `${archivos.length} archivos de estilos, ${de.size} clases (${enVarios.length} en varios archivos, apuntadas)`);
const nuevas = [];
for (const [k, s] of enVarios) {
  const antes = apuntadas.get(k) || new Set();
  const nuevos = [...s].filter((f) => !antes.has(f)), viejos = [...s].filter((f) => antes.has(f));
  if (nuevos.length) nuevas.push(viejos.length ? `.${k} en ${nuevos.join(', ')} (ya tenía estilos en ${viejos.join(', ')})` : `.${k} en ${nuevos.join(' y ')}`);
}
check(nuevas.length === 0, `ninguna clase nueva que ya tuviera estilos en otro archivo${nuevas.length ? `: ${nuevas.slice(0, 6).join('; ')}${nuevas.length > 6 ? ` y ${nuevas.length - 6} más` : ''}. Si es otra cosa, ponle el prefijo de su pantalla; si es un retoque a propósito, ACTUALIZAR=1 node test/clases.test.mjs` : ''}`);
// La propia regla: lo de dentro de las llaves, los comentarios y los textos no cuentan como clases
const prueba = clasesDe('/* .comentario */ .a, .b > .c:hover { width: 0.5em; background: url(x.png); } @media (min-width: 40em) { .d .e { margin: 0 } } [data-x=".f"] .g {}');
check([...prueba].sort().join() === 'a,b,c,d,e,g', `solo cuentan las clases de los selectores (${[...prueba].sort().join(' ')})`);

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
