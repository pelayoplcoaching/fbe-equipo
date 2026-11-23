// Las opciones de esbuild con que se empaqueta la app, en un solo sitio: las usa la construcción (scripts/build.mjs) y la
// prueba que compila la app en cada `npm test` (test/compila.test.mjs, v0.207), para que las dos compilen lo mismo.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// El worker que sigue la barra en el análisis de los vídeos (va aparte, como chunks/analisis-<hash>.js)
export const opcionesWorker = (raiz) => ({
  entryPoints: [join(raiz, 'web/src/ui/tecnica/analisis/seguidor.worker.js')], bundle: true, minify: true, format: 'iife', target: ['es2020', 'safari15'],
  write: false, legalComments: 'none', logLevel: 'warning',
});

// La app. demo: la demo de un solo archivo (sin worker, sin modelos, sin ilustraciones); rutaWorker y poseDir: dónde van
// el worker del análisis y los modelos de los puntos del cuerpo
export function opcionesApp(raiz, { demo = false, rutaWorker = null, poseDir = null } = {}) {
  return {
    entryPoints: [join(raiz, 'web/src/main.jsx')],
    bundle: true,
    minify: true,
    format: 'esm',
    target: ['es2020', 'safari15'],
    jsx: 'automatic',
    jsxImportSource: 'preact',
    loader: { '.json': 'json' },
    define: { __DEMO__: demo ? 'true' : 'false', __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')).version),
      __WORKER_ANALISIS__: JSON.stringify(rutaWorker), __POSE__: JSON.stringify(demo ? null : poseDir),
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
}
// Lo que sale para producción: app.js, app.css y los trozos (chunks/<nombre>-<huella>.js)
export const PRODUCCION = { splitting: true, entryNames: 'app', chunkNames: 'chunks/[name]-[hash]' };

// El JavaScript empaquetado tiene que ser ASCII puro: así funciona aunque el navegador no sepa la codificación
// (la demo abierta como archivo, un proxy que cambie las cabeceras). esbuild escapa los textos, pero no lo que va
// dentro de una expresión regular: escríbelo con á y similares.
export function soloAscii(js, nombre) {
  const m = /[^\x00-\x7f]/.exec(js);
  if (m) throw new Error(`${nombre} lleva el carácter «${m[0]}» sin escapar: «${js.slice(Math.max(0, m.index - 40), m.index + 10)}». Escríbelo como \\u${m[0].charCodeAt(0).toString(16).padStart(4, '0')} en el código fuente.`);
}

// Lo que se descarga al abrir la app: app.js y todo lo que importa de entrada (sin lo que se pide al abrir cada pantalla)
export function archivosDeArranque(metafile) {
  const outs = metafile.outputs;
  const app = Object.keys(outs).find((f) => /(^|\/)app\.js$/.test(f));
  const arranque = new Set(app ? [app] : []);
  for (const pila = [...arranque]; pila.length;) {
    for (const im of outs[pila.pop()]?.imports || []) if (im.kind === 'import-statement' && !arranque.has(im.path)) { arranque.add(im.path); pila.push(im.path); }
  }
  return { app, arranque };
}

// (v0.208) Los trozos que solo usa la app del coach (su app y lo que solo ella importa): el móvil de un atleta no los
// guarda. Las rutas, como en metafile.outputs. (v0.209: también deciden qué estilos van aparte, scripts/css-coach.mjs)
export function trozosSoloCoach(metafile) {
  const salidas = metafile.outputs;
  const { app } = archivosDeArranque(metafile);
  const entradaCoach = Object.keys(salidas).find((f) => salidas[f].entryPoint?.endsWith('web/src/ui/coach/CoachApp.jsx'));
  if (!entradaCoach) return new Set();
  const alcance = (desde, saltar) => { const v = new Set(); const c = [desde]; while (c.length) { const x = c.pop(); if (!x || v.has(x) || x === saltar) continue; v.add(x); for (const im of salidas[x]?.imports || []) if (!im.external && salidas[im.path]) c.push(im.path); } return v; };
  const deAtleta = alcance(app, entradaCoach);
  return new Set([...alcance(entradaCoach)].filter((f) => !deAtleta.has(f) && f.endsWith('.js')));
}
