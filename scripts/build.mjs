// Empaqueta la app.
//   node scripts/build.mjs          → dist/       (producción: PWA para GitHub Pages; demo en ?demo o sin config)
//   node scripts/build.mjs --demo   → dist-demo/index.html (un único archivo autocontenido con la demo, para publicar como artefacto)
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { estiloPortada, marcadoPortada, FONDO_PORTADA, IMAGEN_PORTADA } from './portada.mjs';

const raiz = new URL('..', import.meta.url).pathname;
const demo = process.argv.includes('--demo');
const salida = join(raiz, demo ? 'dist-demo' : 'dist');
const fuente = join(raiz, 'node_modules/@fontsource-variable/archivo/files/archivo-latin-standard-normal.woff2');
// El estandarte de la portada de arranque (v0.38: la imagen de Pelayo)
const imagenPortada = join(raiz, IMAGEN_PORTADA);

rmSync(salida, { recursive: true, force: true });
mkdirSync(salida, { recursive: true });

const comun = {
  entryPoints: [join(raiz, 'web/src/main.jsx')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2020', 'safari15'],
  jsx: 'automatic',
  jsxImportSource: 'preact',
  loader: { '.json': 'json' },
  define: { __DEMO__: demo ? 'true' : 'false', __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')).version) },
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
${estiloPortada(`data:image/webp;base64,${readFileSync(imagenPortada).toString('base64')}`)}
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
  copyFileSync(imagenPortada, join(salida, 'estandarte.webp'));
  const cssRuta = join(salida, 'app.css');
  writeFileSync(cssRuta, fontFace('fonts/archivo-latin.woff2') + readFileSync(cssRuta, 'utf8'));

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
  }, null, 2));

  // config.js y sw.js no pasan por esbuild: lo que no sea ASCII (tildes de los comentarios) se escribe como \\u…
  const aAscii = (t) => t.replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  writeFileSync(join(salida, 'config.js'), aAscii(readFileSync(join(raiz, 'web/config.js'), 'utf8')));

  const listar = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? listar(join(d, f)) : [join(d, f)]));
  const archivos = listar(salida).map((f) => relative(salida, f)).filter((f) => !f.endsWith('.map'));
  const version = createHash('sha256').update(archivos.filter((f) => f !== 'config.js').map((f) => readFileSync(join(salida, f))).join('')).digest('hex').slice(0, 10);
  writeFileSync(join(salida, 'index.html'), readFileSync(join(raiz, 'web/index.html'), 'utf8').replaceAll('__VERSION__', version)
    .replace('<!--PORTADA-ESTILO-->', () => estiloPortada('estandarte.webp')).replace('<!--PORTADA-->', () => marcadoPortada));
  const precache = ['./', ...archivos.filter((f) => f !== 'index.html').map((f) => (f === 'app.css' || f === 'app.js' ? `${f}?v=${version}` : f))];
  writeFileSync(join(salida, 'sw.js'), aAscii(readFileSync(join(raiz, 'web/sw.js'), 'utf8').replace('__VERSION__', version).replace('__ARCHIVOS__', JSON.stringify(precache))));
  for (const f of ['sw.js', 'config.js']) soloAscii(readFileSync(join(salida, f), 'utf8'), f);
  writeFileSync(join(salida, '.nojekyll'), '');

  const tam = (f) => (statSync(join(salida, f)).size / 1024).toFixed(0);
  console.log(`dist/ versión ${version}`);
  for (const f of archivos.sort()) console.log(`  ${f.padEnd(44)} ${tam(f).padStart(5)} KB`);
}
