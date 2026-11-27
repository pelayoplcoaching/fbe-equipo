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
import { opcionesApp, opcionesWorker, soloAscii, PRODUCCION, archivosDeArranque, trozosSoloCoach } from '../scripts/opciones-build.mjs';
import { cssDelCoach, separarCssPorTrozos, duenosDeCodigo } from '../scripts/css-coach.mjs';
import { cubos } from '../scripts/css-cubos.mjs';
import { estiloPortada, marcadoPortada } from '../scripts/portada.mjs';
import { readFileSync } from 'node:fs';

// En KB (1024 bytes). «gz»: lo que viaja por la red (comprimido); «crudo»: lo que el móvil tiene que leer y procesar.
// (v0.207: el código al abrir bajó de 2974 KB a unos 2050 con la lista de las ilustraciones; los estilos, 1068 KB)
// (v0.208: a unos 1680 KB, 568 comprimido: las hojas de Hoy al abrirlas, lo de Revisar fuera del atleta, el texto de la
// política al leerla y lo ligero de la sesión aparte)
// (v0.209: los estilos, de 1068 a unos 920 KB, 189 a 165 comprimido: los que solo usa el coach van aparte, scripts/css-coach.mjs)
// (v0.210: unos 875 KB, 155 comprimido: los de cada pantalla que no sale al abrir van con su trozo, y ni esos ni los del coach
// cambian quién gana un empate de la cascada: las reglas que podrían hacerlo se quedan en el común o llevan copias detrás)
// (v0.232: 1790 KB crudo con FBE Esencial; lo de antes de empezar, sus pantallas y las marcas ya van en su trozo; el
// comprimido, igual)
// (v0.252: 606 KB comprimido; la lista de novedades de la política, al abrir el aviso: se baja a 607)
// (v0.258: estilos a 902 KB: la v0.257 se quedó a 19 bytes de los 900 y el reparto deja en el común una regla de la gráfica
// del perfil, .perfil-punto.atipico, en cuanto una palabra del arranque —«mal», la cara de «¿Cómo llegas hoy?»— coincide con
// una clase que podría pisarla; lo nuevo de cada pantalla sigue yendo con su trozo)
// (v0.261: belleza A para las dos apps, a propósito: estilos a 912 KB (162 comprimido) y código a 608 comprimido. Es la
// carcasa (la barra flotante, «Tu sesión», la cabecera) y Hoy, que salen al abrir: no pueden ir en un trozo. Las reglas de
// lo de cada pantalla van con su trozo y las del común llevan la clase doble para no obligar a copiar las de los trozos)
const PRESUPUESTO = {
  js: { crudo: 1790, gz: 608 },
  css: { crudo: 912, gz: 162 },
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
// (con la lista de las ilustraciones: va en su propio trozo, pero se pide y se espera al abrir)
const lista = Object.entries(r.metafile.outputs).filter(([, o]) => Object.keys(o.inputs || {}).some((m) => m.endsWith('web/src/datos/lista-imagenes.js'))).map(([f]) => f);
const js = medir([...new Set([...arranque, ...lista])]);
// (v0.209) los estilos del atleta, sin los que solo usa el coach (van aparte, como en scripts/build.mjs)
const soloCoach = trozosSoloCoach(r.metafile);
const texto = (f) => Buffer.from(porRuta.get(f)).toString('utf8');
const jsRutas = [...porRuta.keys()].filter((f) => f.endsWith('.js'));
const rutaCss = [...porRuta.keys()].find((f) => /(^|\/)app\.css$/.test(f));
// (v0.210) con el dueño de cada clase mirando todo el código, como en scripts/build.mjs (para no cambiar empates de la cascada)
const lista0 = new Set(Object.entries(r.metafile.outputs).filter(([, o]) => Object.keys(o.inputs || {}).some((m) => m.endsWith('web/src/datos/lista-imagenes.js'))).map(([f]) => f));
const perezosos = new Set(jsRutas.filter((f) => !arranque.has(f) && !lista0.has(f) && !soloCoach.has(f) && /(^|\/)chunks\//.test(f)));
const extraCss = `${readFileSync(join(raiz, 'web/index.html'), 'utf8')}\n${marcadoPortada}\n${estiloPortada()}`;
const duenoDe = duenosDeCodigo({ textos: new Map(jsRutas.map((f) => [f, texto(f)])), coach: soloCoach, candidatos: perezosos, extra: extraCss });
const partesCss = cssDelCoach(texto(rutaCss), { jsCoach: jsRutas.filter((f) => soloCoach.has(f)).map(texto).join('\n'),
  jsOtros: `${jsRutas.filter((f) => !soloCoach.has(f)).map(texto).join('\n')}\n${extraCss}`, duenoDe });
// (v0.210) y sin los de cada pantalla que no sale al abrir (van con su trozo, como en scripts/build.mjs)
const partesTrozos = separarCssPorTrozos(partesCss.comun, { textos: new Map(jsRutas.map((f) => [f, texto(f)])), candidatos: perezosos, extra: extraCss, duenoDe });
// (v0.214) con las reglas «universales» metidas en cubos, como en scripts/build.mjs (scripts/css-cubos.mjs)
const comunCss = cubos(partesTrozos.comun).css, coachCss = cubos(partesCss.coach).css;
const css = { crudo: Buffer.byteLength(comunCss), gz: gzipSync(Buffer.from(comunCss), { level: 9 }).length };
const cssCoach = { crudo: Buffer.byteLength(coachCss), gz: gzipSync(Buffer.from(coachCss), { level: 9 }).length };
check(!!app && arranque.size >= 1 && lista.length === 1 && js.crudo > 0 && css.crudo > 0, `app.js y lo que importa de entrada: ${arranque.size} archivos, y la lista de las ilustraciones aparte`);
check(kb(js.crudo) <= PRESUPUESTO.js.crudo && kb(js.gz) <= PRESUPUESTO.js.gz, `código al abrir: ${kb(js.crudo)} KB (${kb(js.gz)} KB comprimido); como mucho ${PRESUPUESTO.js.crudo} (${PRESUPUESTO.js.gz})`);
check(kb(css.crudo) <= PRESUPUESTO.css.crudo && kb(css.gz) <= PRESUPUESTO.css.gz, `estilos: ${kb(css.crudo)} KB (${kb(css.gz)} KB comprimido); como mucho ${PRESUPUESTO.css.crudo} (${PRESUPUESTO.css.gz})`);
check(partesCss.reglas > 500 && kb(cssCoach.crudo) >= 100, `los del coach, aparte: ${partesCss.reglas} reglas, ${kb(cssCoach.crudo)} KB (${kb(cssCoach.gz)} comprimido) que el móvil de un atleta no descarga`);
check(partesTrozos.reglas > 1000 && partesTrozos.porTrozo.size >= 10, `los de cada pantalla, con su trozo: ${partesTrozos.reglas} reglas en ${partesTrozos.porTrozo.size} trozos`);
// (y si ha bajado mucho, que se baje el presupuesto: así no vuelve a crecer hasta donde estaba)
const holgura = (x, tope) => kb(x) >= tope * 0.85;
check(holgura(js.gz, PRESUPUESTO.js.gz) && holgura(css.gz, PRESUPUESTO.css.gz), `el presupuesto está ajustado (si lo de ahora queda más de un 15 % por debajo, toca bajarlo)`);

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
