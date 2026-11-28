// Portada de arranque (v0.29): el lobo sobre morado que pinta index.html antes de que llegue el JavaScript.
// Se quita cuando ya hay algo que enseñar: la pantalla de acceso, o la primera pantalla de la cuenta con sus datos
// (sin siluetas de carga a la vista). Un tope evita que se quede puesta si una carga se alarga.
// (belleza, tanda G; v0.288) La barra de carga avanza por tramos de verdad (avanzarPortada). El lobo siempre termina su
// gesto: si la app llega a mitad del dibujo, el trazo se acelera para acabar en 300 ms como mucho en vez de cortarse; y si
// todo estaba listo antes de 150 ms, la portada se quita sin más. La barra del sistema pasa de la noche al color de la app
// en unos pasos, no de golpe.
const MINIMO_MS = 450; // (solo con «reducir movimiento», que no tiene gesto que acabar) si todo llega antes, la portada no parpadea
const INSTANTE_MS = 150; // todo listo antes de esto: sin portada (ni salida)
const REMATE_MS = 300; // lo que como mucho se espera a que el lobo acabe de dibujarse
const TOPE_MS = 3000; // con la sesión resuelta, como mucho esto esperando los datos de la primera pantalla

let quitada = false;
let esperando = false;
let rematando = null;

const ahora = () => (typeof performance !== 'undefined' ? performance.now() : MINIMO_MS);
const quieto = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// (belleza 364) Por dónde va la carga, de 0 a 1 (nunca hacia atrás): el código ha llegado, la cuenta está resuelta, entra
export function avanzarPortada(v) {
  try {
    const el = typeof document !== 'undefined' && document.getElementById('portada');
    if (!el) return;
    const n = Math.max(Number(el.style.getPropertyValue('--carga')) || 0, Math.min(1, Number(v) || 0));
    el.style.setProperty('--carga', String(n));
    el.dataset.carga = '';
  } catch { /* la barra es un adorno: nunca rompe nada */ }
}

// (v0.209) La portada fuera y, con ella, su marca en <html> (el fondo de la raíz, morado mientras está; antes con
// «html:has(#portada)», que obligaba a mirar la página entera en cada cambio)
function sinPortada(el) {
  el?.remove();
  document.documentElement.classList.remove('hay-portada');
}

// (belleza 366) El lobo acaba su gesto: lo que le falte al trazo y al relleno, en REMATE_MS como mucho (si falta más, van
// más deprisa). Sin animaciones en marcha (ya acabó, o «reducir movimiento»), nada que esperar.
export function rematarLobo(el, tope = REMATE_MS) {
  try {
    const anims = (el.getAnimations?.({ subtree: true }) || []).filter((a) => /^portada-(traza|rellena|lobo)$/.test(a.animationName || '') && (a.playState === 'running' || a.pending));
    let falta = 0;
    for (const a of anims) {
      const t = a.effect?.getComputedTiming?.();
      falta = Math.max(falta, (Number(t?.endTime) || 0) - (Number(a.currentTime) || 0));
    }
    if (!(falta > 0)) return Promise.resolve(0);
    if (falta > tope) for (const a of anims) { try { a.updatePlaybackRate(falta / tope); } catch { /* sigue a su paso */ } }
    const espera = Math.min(falta, tope);
    // (al cumplirse el plazo, el gesto se da por acabado: el reloj y la animación pueden no coincidir por un fotograma)
    return new Promise((listo) => { setTimeout(() => { for (const a of anims) { try { if (a.playState !== 'finished') a.finish(); } catch { /* ya no está */ } } listo(espera); }, espera); });
  } catch { return Promise.resolve(0); }
}

// (belleza 358) La barra del sistema, de la noche de la portada al color de la app en unos pasos (los navegadores no lo
// funden solos). El color de destino es el de la etiqueta que toque según el tema; al acabar, la de la portada se quita.
const aRgb = (hex) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || '').trim()); return m ? [1, 2, 3].map((i) => parseInt(m[i], 16)) : null; };
const aHex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;
export function mezclaColor(desde, hasta, t) {
  const a = aRgb(desde), b = aRgb(hasta);
  if (!a || !b) return hasta;
  return aHex(a.map((x, i) => x + (b[i] - x) * Math.max(0, Math.min(1, t))));
}
function fundirBarra(ms = 300) {
  const tc = document.getElementById('tc-portada');
  if (!tc) return;
  const destino = [...document.querySelectorAll('meta[name="theme-color"]')].find((m) => m !== tc && (!m.media || window.matchMedia?.(m.media).matches))?.content;
  const desde = tc.content;
  if (quieto() || !aRgb(destino) || !aRgb(desde) || typeof requestAnimationFrame !== 'function') { tc.remove(); return; }
  const t0 = ahora();
  const paso = () => {
    const t = (ahora() - t0) / ms;
    if (t >= 1 || !tc.isConnected) { tc.remove(); return; }
    tc.content = mezclaColor(desde, destino, t);
    requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

function quitarYa({ sinSalida = false } = {}) {
  if (quitada) return;
  quitada = true;
  const el = typeof document !== 'undefined' && document.getElementById('portada');
  if (!el) { document.getElementById('tc-portada')?.remove(); sinPortada(null); return; }
  // (a partir de aquí la portada está saliendo: lo que la mire, que lo sepa)
  el.dataset.sale = '';
  avanzarPortada(1);
  if (sinSalida) { document.getElementById('tc-portada')?.remove(); sinPortada(el); return; }
  fundirBarra();
  // (diseño, tanda 19) Si debajo hay ya una marca con el lobo (la bienvenida del día), el lobo de la portada viaja hasta
  // ella y la noche se levanta; si no, o sin transiciones de vista, la portada se funde como siempre.
  const lobo = el.querySelector('.portada-lobo');
  const destino = !quieto() && document.startViewTransition && lobo && document.querySelector('.bdia-marca svg, .acceso-marca svg');
  if (destino && document.visibilityState !== 'hidden') {
    try {
      lobo.style.viewTransitionName = 'vt-lobo';
      document.documentElement.dataset.vt = 'portada';
      const t = document.startViewTransition(() => { sinPortada(el); destino.style.viewTransitionName = 'vt-lobo'; });
      const fin = () => { destino.style.viewTransitionName = ''; if (document.documentElement.dataset.vt === 'portada') delete document.documentElement.dataset.vt; };
      t.finished.catch(() => {}).then(fin);
      setTimeout(() => { try { t.skipTransition(); } catch { /* */ } }, 1500);
      return;
    } catch { lobo.style.viewTransitionName = ''; delete document.documentElement.dataset.vt; }
  }
  el.classList.add('fuera');
  setTimeout(() => sinPortada(el), quieto() ? 0 : 380);
}

// Cuándo: si todo estaba listo en un instante, sin portada; con «reducir movimiento», tras su mínimo (para que no
// parpadee); si no, en cuanto el lobo acaba su gesto
function cuandoToque() {
  if (quitada) return;
  const t = ahora();
  if (t < INSTANTE_MS) { quitarYa({ sinSalida: true }); return; }
  const el = typeof document !== 'undefined' && document.getElementById('portada');
  if (!el || quieto()) { const falta = MINIMO_MS - t; if (falta > 0) setTimeout(quitarYa, falta); else quitarYa(); return; }
  rematando = rematando || rematarLobo(el);
  rematando.then(() => quitarYa());
}

// esperarDatos: la cuenta ya está resuelta y su primera pantalla está cargando datos; se espera a que acaben
export function quitarPortada({ esperarDatos = false } = {}) {
  if (quitada || typeof document === 'undefined' || !document.getElementById('portada')) { if (!quitada && typeof document !== 'undefined') sinPortada(null); quitada = true; return; }
  avanzarPortada(0.85);
  if (!esperarDatos) { cuandoToque(); return; }
  if (esperando) return;
  esperando = true;
  // Las siluetas avisan al irse; se mira en el siguiente fotograma, cuando ya está pintado lo que las sustituye
  const revisar = () => requestAnimationFrame(comprobar);
  const acabar = () => {
    clearTimeout(tope);
    window.removeEventListener('fbe-siluetas-fuera', revisar);
    cuandoToque();
  };
  const tope = setTimeout(acabar, TOPE_MS);
  function comprobar() { if (!document.querySelector('.siluetas')) acabar(); }
  window.addEventListener('fbe-siluetas-fuera', revisar);
  requestAnimationFrame(() => requestAnimationFrame(comprobar));
}
