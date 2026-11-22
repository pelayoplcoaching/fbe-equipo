// (v0.207) Que la app compila, y que lo que se descarga al abrirla no crece sin darnos cuenta.
//   node test/compila.test.mjs
// 1. npm test también compila la app, con las mismas opciones que la construcción (scripts/opciones-build.mjs), sin
//    escribir nada. En la v0.177 un import repetido rompía la compilación y no se vio hasta la prueba completa.
// 2. Presupuesto de peso: lo que se descarga y se procesa al abrir la app (app.js con todo lo que importa de entrada, y
//    los estilos) no puede pasar de PRESUPUESTO. Si una mejora de verdad lo necesita, se sube aquí a propósito (y se
//    dice en el README); si una versión lo baja, se baja también, para que no vuelva a crecer.
import * as esbuild from 'esbuild';
import { gzipSync } from 'node:zlib';
import { join, relative } from 'node:path';
import { opcionesApp, opcionesWorker, soloAscii, PRODUCCION, archivosDeArranque } from '../scripts/opciones-build.mjs';

// En KB (1024 bytes). «gz»: lo que viaja por la red (comprimido); «crudo»: lo que el móvil tiene que leer y procesar.
const PRESUPUESTO = {
  js: { crudo: 3150, gz: 1030 },
  css: { crudo: 1130, gz: 200 },
};

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const raiz = new URL('..', import.meta.url).pathname;
const kb = (n) => Math.round(n / 1024);

console.log('La app compila');
// (los avisos que de verdad son fallos: un import de algo que no existe da undefined, sin error)
const GRAVES = new Set(['import-is-undefined', 'duplicate-object-key', 'duplicate-case', 'equals-nan', 'assign-to-constant', 'assign-to-import', 'call-import-namespace', 'direct-eval']);
const graves = (r) => r.warnings.filter((w) => GRAVES.has(w.id)).map((w) => `${w.id}: ${w.text} (${w.location?.file}:${w.location?.line})`);
let w = null, r = null;
try {
  w = await esbuild.build({ ...opcionesWorker(raiz), logLevel: 'silent' });
  r = await esbuild.build({ ...opcionesApp(raiz, { rutaWorker: 'chunks/analisis-PRUEBA.js', poseDir: 'modelos/pose-prueba/' }), ...PRODUCCION, outdir: join(raiz, 'dist-prueba'), write: false, logLevel: 'silent' });
} catch (e) {
  check(false, `la app compila: ${(e.errors || []).slice(0, 3).map((x) => `${x.text} (${x.location?.file}:${x.location?.line})`).join(' | ') || e.message}`);
  console.log(`\n${ok} correctas, ${fallos} fallidas`);
  process.exit(1);
}
check(!!w && !!r, `la app y el worker del análisis compilan (${r.outputFiles.length} archivos)`);
const g = [...graves(w), ...graves(r)];
check(g.length === 0, `sin avisos que sean fallos (un import de algo que no existe, una clave repetida…)${g.length ? `: ${g.slice(0, 3).join(' | ')}` : ''}`);
let ascii = null;
try { soloAscii(w.outputFiles[0].text, 'El worker'); for (const f of r.outputFiles) if (/\.(js|css)$/.test(f.path)) soloAscii(f.text, relative(raiz, f.path)); } catch (e) { ascii = e.message; }
check(!ascii, `todo lo empaquetado es ASCII (un carácter con tilde dentro de una expresión regular rompe la app)${ascii ? `: ${ascii.slice(0, 200)}` : ''}`);

console.log('\nLo que se descarga al abrir la app');
const { app, arranque } = archivosDeArranque(r.metafile);
const porRuta = new Map(r.outputFiles.map((f) => [relative(process.cwd(), f.path), f.contents]));
const medir = (rutas) => rutas.reduce((t, f) => { const b = porRuta.get(f); return b ? { crudo: t.crudo + b.length, gz: t.gz + gzipSync(b, { level: 9 }).length } : t; }, { crudo: 0, gz: 0 });
const js = medir([...arranque]);
const css = medir([...porRuta.keys()].filter((f) => /(^|\/)app\.css$/.test(f)));
check(!!app && arranque.size >= 1 && js.crudo > 0 && css.crudo > 0, `app.js y lo que importa de entrada: ${arranque.size} archivos`);
check(kb(js.crudo) <= PRESUPUESTO.js.crudo && kb(js.gz) <= PRESUPUESTO.js.gz, `código al abrir: ${kb(js.crudo)} KB (${kb(js.gz)} KB comprimido); como mucho ${PRESUPUESTO.js.crudo} (${PRESUPUESTO.js.gz})`);
check(kb(css.crudo) <= PRESUPUESTO.css.crudo && kb(css.gz) <= PRESUPUESTO.css.gz, `estilos: ${kb(css.crudo)} KB (${kb(css.gz)} KB comprimido); como mucho ${PRESUPUESTO.css.crudo} (${PRESUPUESTO.css.gz})`);
// (y si ha bajado mucho, que se baje el presupuesto: así no vuelve a crecer hasta donde estaba)
const holgura = (x, tope) => kb(x) >= tope * 0.85;
check(holgura(js.gz, PRESUPUESTO.js.gz) && holgura(css.gz, PRESUPUESTO.css.gz), `el presupuesto está ajustado (si lo de ahora queda más de un 15 % por debajo, toca bajarlo)`);

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
