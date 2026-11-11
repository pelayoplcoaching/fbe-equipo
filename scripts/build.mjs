// Empaqueta la app.
//   node scripts/build.mjs          → dist/       (producción: PWA para GitHub Pages; demo en ?demo o sin config)
//   node scripts/build.mjs --demo   → dist-demo/index.html (un único archivo autocontenido con la demo, para publicar como artefacto)
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { estiloPortada, marcadoPortada, FONDO_PORTADA } from './portada.mjs';

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
  const w = await esbuild.build({ entryPoints: [join(raiz, 'web/src/ui/tecnica/analisis/seguidor.worker.js')], bundle: true, minify: true, format: 'iife', target: ['es2020', 'safari15'], write: false, legalComments: 'none', logLevel: 'warning' });
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

const comun = {
  entryPoints: [join(raiz, 'web/src/main.jsx')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2020', 'safari15'],
  jsx: 'automatic',
  jsxImportSource: 'preact',
  loader: { '.json': 'json' },
  define: { __DEMO__: demo ? 'true' : 'false', __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')).version),
    __WORKER_ANALISIS__: JSON.stringify(rutaWorker), __POSE__: JSON.stringify(demo ? null : POSE_DIR),
    // (imágenes) la demo de un solo archivo no lleva las ilustraciones (no caben): sale el dibujo de líneas de siempre
    __IMAGENES__: demo ? 'false' : 'true' },
  // La demo privada lleva tu biblioteca real (vídeos y técnica) si está en tu ordenador; la web pública, solo nombres
  plugins: demo && existsSync(join(raiz, 'web/src/datos/biblioteca-fbe.json')) ? [{
    name: 'biblioteca-real',
    setup(b) { b.onResolve({ filter: /biblioteca-generica\.json$/ }, () => ({ path: join(raiz, 'web/src/datos/biblioteca-fbe.json') })); },
  }] : [],
  legalComments: 'none',
  logLevel: 'warning',
  metafile: true,
};

// El JavaScript empaquetado tiene que ser ASCII puro: así funciona aunque el navegador no sepa la codificación
// (la demo abierta como archivo, un proxy que cambie las cabeceras). esbuild escapa los textos, pero no lo que va
// dentro de una expresión regular: escríbelo con \u00e1 y similares.
function soloAscii(js, nombre) {
  const m = /[^\x00-\x7f]/.exec(js);
  if (m) throw new Error(`${nombre} lleva el carácter «${m[0]}» sin escapar: «${js.slice(Math.max(0, m.index - 40), m.index + 10)}». Escríbelo como \\u${m[0].charCodeAt(0).toString(16).padStart(4, '0')} en el código fuente.`);
}

const fontFace = (src) => `@font-face{font-family:'Archivo Variable';font-style:normal;font-display:swap;font-weight:100 900;font-stretch:62% 125%;src:url(${src}) format('woff2-variations'),url(${src}) format('woff2');}`;

if (demo) {
  const r = await esbuild.build({ ...comun, write: false, outdir: salida, splitting: false });
  const js = r.outputFiles.find((f) => f.path.endsWith('.js')).text;
  const css = r.outputFiles.find((f) => f.path.endsWith('.css')).text;
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
  const r = await esbuild.build({ ...comun, outdir: salida, splitting: true, entryNames: 'app', chunkNames: 'chunks/[name]-[hash]' });
  for (const f of Object.keys(r.metafile.outputs)) if (/\.(js|css)$/.test(f)) soloAscii(readFileSync(f, 'utf8'), f);
  mkdirSync(join(salida, 'fonts'), { recursive: true });
  copyFileSync(fuente, join(salida, 'fonts/archivo-latin.woff2'));
  const cssRuta = join(salida, 'app.css');
  writeFileSync(cssRuta, fontFace('fonts/archivo-latin.woff2') + readFileSync(cssRuta, 'utf8'));

  // (imágenes) Las ilustraciones (web/imagenes/<bloque>/<id>-<ancho>.<huella>.webp, las de datos/imagenes.json): se copian
  // tal cual. No se precargan: el service worker guarda cada una la primera vez que se ve (caché fbe-imagenes)
  const listaImagenes = Object.values(JSON.parse(readFileSync(join(raiz, 'web/src/datos/imagenes.json'), 'utf8'))).flatMap((x) => Object.values(x.archivos));
  for (const f of listaImagenes) {
    if (!/^imagenes\/[a-z0-9-]+\/[a-z0-9-]+-\d+\.[0-9a-f]{8}\.webp$/.test(f)) throw new Error(`Imagen con un nombre que no toca: ${f}`);
    mkdirSync(join(salida, f, '..'), { recursive: true });
    copyFileSync(join(raiz, 'web', f), join(salida, f));
  }

  // Iconos de la app (disco morado sobre tiza), en web/iconos/
  for (const n of ['icono.svg', 'icono-180.png', 'icono-192.png', 'icono-512.png', 'insignia-96.png']) copyFileSync(join(raiz, 'web/iconos', n), join(salida, n));

  writeFileSync(join(salida, 'manifest.webmanifest'), JSON.stringify({
    name: 'FBE Equipo', short_name: 'FBE Equipo', lang: 'es', start_url: './', scope: './', display: 'standalone',
    background_color: FONDO_PORTADA, theme_color: '#5438D8', description: 'Tu programa de FBE Coaching y el registro de cada serie.',
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

  const listar = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? listar(join(d, f)) : [join(d, f)]));
  const archivos = listar(salida).map((f) => relative(salida, f)).filter((f) => !f.endsWith('.map'));
  const version = createHash('sha256').update(archivos.filter((f) => f !== 'config.js').map((f) => readFileSync(join(salida, f))).join('')).digest('hex').slice(0, 10);
  // (pulido 10) Lo que app.js importa nada más arrancar (el trozo común, desde que la app del coach va aparte) se pide a
  // la vez que él, sin esperar a leerlo: una espera menos en el primer arranque
  const claveApp = Object.keys(r.metafile.outputs).find((f) => /(^|\/)app\.js$/.test(f));
  const alArrancar = new Set();
  for (const pila = [claveApp]; pila.length;) {
    for (const im of r.metafile.outputs[pila.pop()]?.imports || []) if (im.kind === 'import-statement' && !alArrancar.has(im.path)) { alArrancar.add(im.path); pila.push(im.path); }
  }
  const precargas = [...alArrancar].map((f) => `  <link rel="modulepreload" href="${relative(salida, join(process.cwd(), f))}">\n`).join('');
  writeFileSync(join(salida, 'index.html'), readFileSync(join(raiz, 'web/index.html'), 'utf8').replaceAll('__VERSION__', version)
    .replace('  <script type="module" src="app.js', () => `${precargas}  <script type="module" src="app.js`)
    .replace('<!--PORTADA-ESTILO-->', () => estiloPortada()).replace('<!--PORTADA-->', () => marcadoPortada));
  // (v0.58) los modelos, no: se guardan en su propia caché la primera vez que se usan
  // (revisión de seguridad v0.58) ni los vídeos de ejemplo de la demo (solo los pide la demo, al verlos)
  const soloDemo = (f) => /^chunks\/video(-barra)?-demo-[A-Z0-9]+\.js$/.test(f);
  // (pulido 3.7) ni el código que solo usa la demo (sus datos de ejemplo y su «base» en memoria): el service worker
  // lo guarda la primera vez que se abre la demo, no en cada instalación y actualización de todo el mundo
  const deLaDemo = (f) => /^chunks\/(semilla-demo|backend-memoria|fotos-demo|poster-demo)-[A-Z0-9]+\.js$/.test(f);
  // (imágenes, bloque T) la de «Sin conexión» sí se precarga (unos pocos KB): es la pantalla que sale justo cuando no hay red
  const precache = ['./', ...archivos.filter((f) => f !== 'index.html' && !f.startsWith('modelos/') && (!f.startsWith('imagenes/') || f.startsWith('imagenes/acceso/sin-conexion-')) && !soloDemo(f) && !deLaDemo(f)).map((f) => (f === 'app.css' || f === 'app.js' ? `${f}?v=${version}` : f))];
  // (pulido 3.7) y la huella de cada archivo, para que al actualizar no se vuelva a descargar lo que no ha cambiado
  const huellas = Object.fromEntries(precache.filter((u) => u !== 'config.js').map((u) => [u, createHash('sha256').update(readFileSync(join(salida, u === './' ? 'index.html' : u.split('?')[0]))).digest('hex')]));
  writeFileSync(join(salida, 'sw.js'), aAscii(readFileSync(join(raiz, 'web/sw.js'), 'utf8').replace('__VERSION__', version).replace('__ARCHIVOS__', JSON.stringify(precache))
    .replaceAll('__HUELLAS__', JSON.stringify(huellas)).replaceAll('__DEMO_ARCHIVOS__', JSON.stringify(archivos.filter(deLaDemo)))
    .replaceAll('__IMAGENES_ARCHIVOS__', JSON.stringify(listaImagenes)).replaceAll('__MODELOS__', JSON.stringify(`fbe-modelos-pose-${POSE_VERSION}`)).replaceAll('__MODELO_DIR__', JSON.stringify(POSE_DIR)).replaceAll('__MODELO_ARCHIVOS__', JSON.stringify(POSE_ARCHIVOS))));
  for (const f of ['sw.js', 'config.js']) soloAscii(readFileSync(join(salida, f), 'utf8'), f);
  writeFileSync(join(salida, '.nojekyll'), '');

  const tam = (f) => (statSync(join(salida, f)).size / 1024).toFixed(0);
  console.log(`dist/ versión ${version}`);
  for (const f of archivos.sort()) console.log(`  ${f.padEnd(44)} ${tam(f).padStart(5)} KB`);
  const modelos = archivos.filter((f) => f.startsWith('modelos/')).reduce((t, f) => t + statSync(join(salida, f)).size, 0);
  console.log(`  (modelos/, que no se precarga: ${(modelos / 1048576).toFixed(1)} MB)`);
  const imagenes = archivos.filter((f) => f.startsWith('imagenes/')).reduce((t, f) => t + statSync(join(salida, f)).size, 0);
  console.log(`  (imagenes/, que no se precarga: ${(imagenes / 1048576).toFixed(1)} MB)`);
}
