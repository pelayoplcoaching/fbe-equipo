// Empaqueta la app.
//   node scripts/build.mjs          → dist/       (producción: PWA para GitHub Pages; demo en ?demo o sin config)
//   node scripts/build.mjs --demo   → dist-demo/index.html (un único archivo autocontenido con la demo, para publicar como artefacto)
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { estiloPortada, marcadoPortada, FONDO_PORTADA } from './portada.mjs';
import { opcionesApp, opcionesWorker, soloAscii, PRODUCCION, archivosDeArranque, trozosSoloCoach } from './opciones-build.mjs';
import { cssDelCoach, separarCssPorTrozos, duenosDeCodigo } from './css-coach.mjs';
import { cubos } from './css-cubos.mjs';

const raiz = new URL('..', import.meta.url).pathname;
const demo = process.argv.includes('--demo');
const salida = join(raiz, demo ? 'dist-demo' : 'dist');
const fuente = join(raiz, 'node_modules/@fontsource-variable/archivo/files/archivo-latin-standard-normal.woff2');

rmSync(salida, { recursive: true, force: true });
mkdirSync(salida, { recursive: true });

// v0.58: el análisis automático de los vídeos. El worker que sigue la barra va aparte (chunks/analisis-<hash>.js) y los
// puntos del cuerpo usan MediaPipe Pose (@mediapipe/pose, Apache-2.0): su modelo «lite», su wasm y su grafo se copian en
// modelos/pose-<versión>/ y se sirven desde la propia app (nunca de un CDN). Solo se descargan al usarlos: el service worker
// no los guarda al instalar (los guarda la primera vez que se piden). En la demo de un solo archivo no van (no caben).
const POSE_PAQUETE = join(raiz, 'node_modules/@mediapipe/pose');
const POSE_VERSION = JSON.parse(readFileSync(join(POSE_PAQUETE, 'package.json'), 'utf8')).version;
const POSE_DIR = `modelos/pose-${POSE_VERSION}/`;
const POSE_ARCHIVOS = ['pose.js', 'pose_solution_packed_assets_loader.js', 'pose_solution_packed_assets.data', 'pose_solution_simd_wasm_bin.js', 'pose_solution_simd_wasm_bin.wasm',
  'pose_solution_wasm_bin.js', 'pose_solution_wasm_bin.wasm', 'pose_web.binarypb', 'pose_landmark_lite.tflite'];
let rutaWorker = null;
if (!demo) {
  const w = await esbuild.build(opcionesWorker(raiz));
  const codigo = w.outputFiles[0].text;
  soloAscii(codigo, 'El worker del análisis');
  rutaWorker = `chunks/analisis-${createHash('sha256').update(codigo).digest('hex').slice(0, 8).toUpperCase()}.js`;
  mkdirSync(join(salida, 'chunks'), { recursive: true });
  writeFileSync(join(salida, rutaWorker), codigo);
  mkdirSync(join(salida, POSE_DIR), { recursive: true });
  for (const f of POSE_ARCHIVOS) copyFileSync(join(POSE_PAQUETE, f), join(salida, POSE_DIR, f));
  copyFileSync(join(raiz, 'web/licencias/mediapipe-LICENSE.txt'), join(salida, POSE_DIR, 'LICENSE.txt'));
  // (escáner de productos) el lector de códigos de barras usa piezas de ZXing (@zxing/library, Apache-2.0): su licencia va con la app
  mkdirSync(join(salida, 'licencias'), { recursive: true });
  copyFileSync(join(raiz, 'web/licencias/zxing-LICENSE.txt'), join(salida, 'licencias/zxing-LICENSE.txt'));
}

const comun = opcionesApp(raiz, { demo, rutaWorker, poseDir: POSE_DIR });

// (soloAscii: el JavaScript empaquetado, ASCII puro; en scripts/opciones-build.mjs)

const fontFace = (src) => `@font-face{font-family:'Archivo Variable';font-style:normal;font-display:swap;font-weight:100 900;font-stretch:62% 125%;src:url(${src}) format('woff2-variations'),url(${src}) format('woff2');}`;

if (demo) {
  const r = await esbuild.build({ ...comun, write: false, outdir: salida, splitting: false });
  const js = r.outputFiles.find((f) => f.path.endsWith('.js')).text;
  // (v0.214) con las reglas «universales» metidas en cubos (scripts/css-cubos.mjs)
  const cssDemo = r.outputFiles.find((f) => f.path.endsWith('.css')).text;
  const css = process.env.FBE_SIN_CUBOS ? cssDemo : cubos(cssDemo).css;
  soloAscii(js, 'La demo'); soloAscii(css, 'El CSS de la demo');
  const fuente64 = readFileSync(fuente).toString('base64');
  const html = `<title>FBE Equipo</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Demo de la app de atletas de FBE Coaching con datos de ejemplo">
<style>${fontFace(`data:font/woff2;base64,${fuente64}`)}${css}</style>
${estiloPortada()}
${marcadoPortada}
<div id="app"></div>
<script>window.FBE_CONFIG = {};</script>
<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>
`;
  soloAscii(html, 'El HTML de la demo');
  writeFileSync(join(salida, 'index.html'), html);
  console.log(`dist-demo/index.html  ${(html.length / 1024).toFixed(0)} KB`);
} else {
  const r = await esbuild.build({ ...comun, outdir: salida, ...PRODUCCION });
  for (const f of Object.keys(r.metafile.outputs)) if (/\.(js|css)$/.test(f)) soloAscii(readFileSync(f, 'utf8'), f);
  mkdirSync(join(salida, 'fonts'), { recursive: true });
  copyFileSync(fuente, join(salida, 'fonts/archivo-latin.woff2'));
  const cssRuta = join(salida, 'app.css');
  // (v0.208) ni el código que solo usa el coach (su app y lo que solo ella importa): el móvil de un atleta no lo guarda; el
  // del coach, la primera vez que entra (mensaje «guardar-coach»)
  const soloCoachRutas = new Set([...trozosSoloCoach(r.metafile)].map((f) => relative(salida, join(process.cwd(), f))));
  if (!soloCoachRutas.size) throw new Error('No se encuentra la app del coach en lo construido (CoachApp.jsx): el service worker la guardaría en todos los móviles');
  // (v0.209, estilos a dieta) y sus estilos, aparte (scripts/css-coach.mjs): los carga la app del coach antes de pintarse
  const leerSalida = (f) => readFileSync(join(salida, f), 'utf8');
  const jsDe = (coach) => Object.keys(r.metafile.outputs).filter((f) => f.endsWith('.js')).map((f) => relative(salida, join(process.cwd(), f))).filter((f) => soloCoachRutas.has(f) === coach).map(leerSalida).join('\n');
  // (v0.209 y v0.210, estilos a dieta) Los trozos de código: los de arranque, los que solo usa el coach y los perezosos (que
  // salen al tocar algo). Los estilos solo del coach van en su archivo (los carga su app antes de pintarse) y los de cada
  // pantalla perezosa (la sesión, el perfil, La travesía, Apuntes…), con su trozo: cada trozo con estilos propios lleva al
  // principio la orden de pedirlos (globalThis.__fbeCss, en ui/estilos-trozo.js) y ui/perezoso.jsx espera a tenerlos
  const todasJs = Object.keys(r.metafile.outputs).filter((f) => f.endsWith('.js')).map((f) => relative(salida, join(process.cwd(), f)));
  const { arranque: deArranque } = archivosDeArranque(r.metafile);
  const deArranqueRel = new Set([...deArranque].map((f) => relative(salida, join(process.cwd(), f))));
  // (la lista de las ilustraciones se pide al arrancar aunque vaya en su propio trozo)
  for (const [f, o] of Object.entries(r.metafile.outputs)) if (Object.keys(o.inputs || {}).some((m) => m.endsWith('web/src/datos/lista-imagenes.js'))) deArranqueRel.add(relative(salida, join(process.cwd(), f)));
  const perezosos = new Set(todasJs.filter((f) => !deArranqueRel.has(f) && !soloCoachRutas.has(f) && f.startsWith('chunks/')));
  const textosJs = new Map(todasJs.map((f) => [f, leerSalida(f)]));
  const extraCss = `${readFileSync(join(raiz, 'web/index.html'), 'utf8')}\n${marcadoPortada}\n${estiloPortada()}`;
  // (v0.210) el dueño de cada clase con todo el código a la vista, para no cambiar quién gana un empate al repartir
  const duenoDe = duenosDeCodigo({ textos: textosJs, coach: soloCoachRutas, candidatos: perezosos, extra: extraCss });
  // (para estudiar el reparto: FBE_CSS_ORIGINAL=<archivo.json> guarda el CSS sin repartir y qué trozo es cada cosa)
  const cssOriginal = readFileSync(cssRuta, 'utf8');
  if (process.env.FBE_CSS_ORIGINAL) writeFileSync(process.env.FBE_CSS_ORIGINAL, JSON.stringify({ css: cssOriginal, todas: todasJs, coach: [...soloCoachRutas], arranque: [...deArranqueRel], perezosos: [...perezosos], extra: extraCss }));
  const partesCss = cssDelCoach(cssOriginal, { jsCoach: jsDe(true), jsOtros: `${jsDe(false)}\n${extraCss}`, duenoDe });
  if (!partesCss.reglas) throw new Error('No ha salido ningún estilo solo del coach: revisa scripts/css-coach.mjs');
  // (v0.214) Cada archivo de estilos, con las reglas «universales» metidas en cubos (scripts/css-cubos.mjs): se calculan antes
  // sin cambiar a qué se aplican ni con qué fuerza. Al final, para que valga también para las copias de respetarCascada
  let cubosTocados = 0;
  // (FBE_SIN_CUBOS=1: sin partir, para comparar)
  const conCubos = (x) => { if (process.env.FBE_SIN_CUBOS) return x; const c = cubos(x); cubosTocados += c.tocados; return c.css; };
  partesCss.coach = conCubos(partesCss.coach);
  const cssCoach = `chunks/coach-${createHash('sha256').update(partesCss.coach).digest('hex').slice(0, 8)}.css`;
  writeFileSync(join(salida, cssCoach), partesCss.coach);
  // (v0.210) Los estilos de cada pantalla perezosa, con su trozo. Para no cambiar quién gana un empate al cargarlos después
  // (respetarCascada), muchas reglas se quedan en el común o llevan copias; aun así, unos 100 KB menos al abrir. Con false,
  // todo lo que no es del coach se queda en app.css.
  const ESTILOS_POR_TROZO = true;
  const partesTrozos = separarCssPorTrozos(partesCss.comun, { textos: textosJs, candidatos: ESTILOS_POR_TROZO ? perezosos : new Set(), extra: extraCss, duenoDe });
  const cssTrozos = [];
  for (const [f, css] of partesTrozos.porTrozo) {
    // (con el mismo nombre que su trozo: así el código del trozo, con su orden de pedirlos, sigue siendo el mismo mientras no
    // cambie su código; «mismo nombre, mismo contenido» vale para los trozos; los estilos se renuevan por su huella)
    const nombre = f.replace(/\.js$/, '.css');
    writeFileSync(join(salida, nombre), conCubos(css));
    writeFileSync(join(salida, f), `globalThis.__fbeCss&&globalThis.__fbeCss(${JSON.stringify(nombre)});\n${leerSalida(f)}`);
    cssTrozos.push(nombre);
  }
  writeFileSync(cssRuta, fontFace('fonts/archivo-latin.woff2') + conCubos(partesTrozos.comun));
  // (v0.210) cuántas reglas se van y cuántas se quedan en el común para no cambiar quién gana un empate (css-coach.mjs)
  console.log(`estilos: ${partesCss.reglas} reglas al CSS del coach y ${partesTrozos.reglas} a los de cada trozo (con ${partesCss.copias + partesTrozos.copias} copias para no cambiar empates); ${partesCss.quedan + partesTrozos.quedan} se quedan en el común; ${cubosTocados} selectores partidos para que vayan a su cubo`);

  // (imágenes) Las ilustraciones (web/imagenes/<bloque>/<id>-<ancho>.<huella>.webp, las de datos/imagenes.json): se copian
  // tal cual. No se precargan: el service worker guarda cada una la primera vez que se ve (caché fbe-imagenes)
  // (y las de las rutinas de FBE Esencial, datos/imagenes-rutinas.json, las de sus tarjetas, datos/imagenes-esencial.json, y
  // las que solo salen dentro de una pantalla que se carga aparte, datos/imagenes-trozos.json: cada lista va con su trozo, no
  // con el arranque)
  const listaImagenes = ['imagenes.json', 'imagenes-rutinas.json', 'imagenes-esencial.json', 'imagenes-trozos.json'].flatMap((n) => Object.values(JSON.parse(readFileSync(join(raiz, 'web/src/datos', n), 'utf8'))).flatMap((x) => Object.values(x.archivos)));
  for (const f of listaImagenes) {
    if (!/^imagenes\/[a-z0-9-]+\/[a-z0-9-]+-\d+\.[0-9a-f]{8}\.webp$/.test(f)) throw new Error(`Imagen con un nombre que no toca: ${f}`);
    mkdirSync(join(salida, f, '..'), { recursive: true });
    copyFileSync(join(raiz, 'web', f), join(salida, f));
  }

  // Iconos de la app (disco morado sobre tiza), en web/iconos/
  for (const n of ['icono.svg', 'icono-180.png', 'icono-192.png', 'icono-512.png', 'insignia-96.png']) copyFileSync(join(raiz, 'web/iconos', n), join(salida, n));

  writeFileSync(join(salida, 'manifest.webmanifest'), JSON.stringify({
    name: 'FBE Equipo', short_name: 'FBE Equipo', lang: 'es', start_url: './', scope: './', display: 'standalone',
    background_color: FONDO_PORTADA, theme_color: FONDO_PORTADA,  // (color, mejora 19) la barra, en la tinta noche de la portada (la misma del arranque)
    description: 'Tu programa de FBE Coaching y el registro de cada serie.',
    icons: [
      { src: 'icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: 'icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      { src: 'icono.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    // v0.48: accesos directos (mantener pulsado el icono) y «Compartir → FBE Equipo» un vídeo de la galería
    // (Android con Chrome; el service worker lo recibe y la app lo ofrece como vídeo de técnica). En iPhone no hay
    // ninguna de las dos cosas para una app web: no salen y no pasa nada.
    shortcuts: [
      { name: 'Empezar la sesión de hoy', short_name: 'Sesión de hoy', url: './?accion=sesion#hoy', icons: [{ src: 'icono-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Check-in', short_name: 'Check-in', url: './#checkin', icons: [{ src: 'icono-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Mensajes', short_name: 'Mensajes', url: './#mensajes', icons: [{ src: 'icono-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Revisar (coach)', short_name: 'Revisar', url: './#revisar', icons: [{ src: 'icono-192.png', sizes: '192x192', type: 'image/png' }] },
    ],
    // v0.56: fotos, vídeos y PDF (hasta 10) para el chat; un vídeo solo, también como vídeo de técnica (el atleta)
    share_target: { action: './compartir', method: 'POST', enctype: 'multipart/form-data', params: { title: 'titulo', text: 'texto', files: [{ name: 'archivos', accept: ['image/*', 'video/*', 'application/pdf', '.pdf'] }] } },
  }, null, 2));

  // config.js y sw.js no pasan por esbuild: lo que no sea ASCII (tildes de los comentarios) se escribe como \\u…
  const aAscii = (t) => t.replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  writeFileSync(join(salida, 'config.js'), aAscii(readFileSync(join(raiz, 'web/config.js'), 'utf8')));
  // (belleza 361 y 362, v0.288) lo que corre antes de pintar: los estilos sin frenar y el nombre de cada app (web/arranque.js)
  // (sin sus comentarios de línea entera: se pide antes que nada y cuanto menos pese, mejor)
  writeFileSync(join(salida, 'arranque.js'), aAscii(readFileSync(join(raiz, 'web/arranque.js'), 'utf8').replace(/^\s*\/\/.*\n/gm, '')));

  const listar = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? listar(join(d, f)) : [join(d, f)]));
  const archivos = listar(salida).map((f) => relative(salida, f)).filter((f) => !f.endsWith('.map'));
  const version = createHash('sha256').update(archivos.filter((f) => f !== 'config.js').map((f) => readFileSync(join(salida, f))).join('')).digest('hex').slice(0, 10);
  // (pulido 10) Lo que app.js importa nada más arrancar (el trozo común, desde que la app del coach va aparte) se pide a
  // la vez que él, sin esperar a leerlo: una espera menos en el primer arranque
  const { app: claveApp, arranque } = archivosDeArranque(r.metafile);
  const alArrancar = new Set([...arranque].filter((f) => f !== claveApp));
  // (v0.207) y la lista de las ilustraciones (en su propio trozo, pero se espera antes de pintar): también a la vez
  for (const [f, o] of Object.entries(r.metafile.outputs)) if (Object.keys(o.inputs || {}).some((m) => m.endsWith('web/src/datos/lista-imagenes.js'))) alArrancar.add(f);
  const precargas = [...alArrancar].map((f) => `  <link rel="modulepreload" href="${relative(salida, join(process.cwd(), f))}">\n`).join('');
  writeFileSync(join(salida, 'index.html'), readFileSync(join(raiz, 'web/index.html'), 'utf8').replaceAll('__VERSION__', version)
    .replace('  <script type="module" src="app.js', () => `${precargas}  <script type="module" src="app.js`)
    .replace('<!--PORTADA-ESTILO-->', () => estiloPortada({ fuente: fontFace('fonts/archivo-latin.woff2').replace('font-display:swap', 'font-display:block') })).replace('<!--PORTADA-->', () => marcadoPortada)
    // (v0.209) dónde están los estilos del coach (los pide ui/App.jsx al cargar su app; un atleta, nunca)
    .replace('  <link rel="preload" href="app.css', () => `  <meta name="fbe-coach-css" content="${cssCoach}">\n  <link rel="preload" href="app.css`)
    // (v0.209) la marca de la portada en <html> (el fondo de la raíz, morado mientras está): la quita ui/portada.js con ella
    .replace('<html lang="es">', '<html lang="es" class="hay-portada">'));
  // (v0.58) los modelos, no: se guardan en su propia caché la primera vez que se usan
  // (revisión de seguridad v0.58) ni los vídeos de ejemplo de la demo (solo los pide la demo, al verlos)
  const soloDemo = (f) => /^chunks\/video(-barra)?-demo-[A-Z0-9]+\.js$/.test(f);
  // (pulido 3.7) ni el código que solo usa la demo (sus datos de ejemplo y su «base» en memoria): el service worker
  // lo guarda la primera vez que se abre la demo, no en cada instalación y actualización de todo el mundo
  const deLaDemo = (f) => /^chunks\/(semilla-demo|backend-memoria|fotos-demo|poster-demo)-[A-Z0-9]+\.js$/.test(f);
  // (imágenes, bloque T) la de «Sin conexión» sí se precarga (unos pocos KB): es la pantalla que sale justo cuando no hay red
  // (v0.208) ni el código que solo usa el coach (su app y lo que solo ella importa): el móvil de un atleta no lo guarda; el
  // del coach, la primera vez que entra (mensaje «guardar-coach»)
  // (calculados arriba, junto a sus estilos)
  const soloCoach = (f) => soloCoachRutas.has(f) || f === cssCoach;
  const precache = ['./', ...archivos.filter((f) => f !== 'index.html' && !f.startsWith('modelos/') && (!f.startsWith('imagenes/') || f.startsWith('imagenes/acceso/sin-conexion-')) && !soloDemo(f) && !deLaDemo(f) && !soloCoach(f)).map((f) => (f === 'app.css' || f === 'app.js' ? `${f}?v=${version}` : f))];
  // (pulido 3.7) y la huella de cada archivo, para que al actualizar no se vuelva a descargar lo que no ha cambiado
  const coachArchivos = archivos.filter(soloCoach);
  const huellas = Object.fromEntries([...precache, ...coachArchivos].filter((u) => u !== 'config.js').map((u) => [u, createHash('sha256').update(readFileSync(join(salida, u === './' ? 'index.html' : u.split('?')[0]))).digest('hex')]));
  writeFileSync(join(salida, 'sw.js'), aAscii(readFileSync(join(raiz, 'web/sw.js'), 'utf8').replace('__VERSION__', version).replace('__ARCHIVOS__', JSON.stringify(precache))
    .replaceAll('__HUELLAS__', JSON.stringify(huellas)).replaceAll('__DEMO_ARCHIVOS__', JSON.stringify(archivos.filter(deLaDemo))).replaceAll('__COACH_ARCHIVOS__', JSON.stringify(coachArchivos))
    .replaceAll('__IMAGENES_ARCHIVOS__', JSON.stringify(listaImagenes)).replaceAll('__MODELOS__', JSON.stringify(`fbe-modelos-pose-${POSE_VERSION}`)).replaceAll('__MODELO_DIR__', JSON.stringify(POSE_DIR)).replaceAll('__MODELO_ARCHIVOS__', JSON.stringify(POSE_ARCHIVOS))));
  for (const f of ['sw.js', 'config.js', 'arranque.js']) soloAscii(readFileSync(join(salida, f), 'utf8'), f);
  writeFileSync(join(salida, '.nojekyll'), '');

  const tam = (f) => (statSync(join(salida, f)).size / 1024).toFixed(0);
  console.log(`dist/ versión ${version}`);
  for (const f of archivos.sort()) console.log(`  ${f.padEnd(44)} ${tam(f).padStart(5)} KB`);
  const modelos = archivos.filter((f) => f.startsWith('modelos/')).reduce((t, f) => t + statSync(join(salida, f)).size, 0);
  console.log(`  (modelos/, que no se precarga: ${(modelos / 1048576).toFixed(1)} MB)`);
  const imagenes = archivos.filter((f) => f.startsWith('imagenes/')).reduce((t, f) => t + statSync(join(salida, f)).size, 0);
  console.log(`  (imagenes/, que no se precarga: ${(imagenes / 1048576).toFixed(1)} MB)`);
}
