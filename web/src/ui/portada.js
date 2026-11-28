// Portada de arranque (v0.29): el lobo sobre morado que pinta index.html antes de que llegue el JavaScript.
// Se quita cuando ya hay algo que enseñar: la pantalla de acceso, o la primera pantalla de la cuenta con sus datos
// (sin siluetas de carga a la vista). Un tope evita que se quede puesta si una carga se alarga.
// (belleza, tanda G; v0.288) La barra de carga avanza por tramos de verdad (avanzarPortada). El lobo siempre termina su
// gesto: si la app llega a mitad del dibujo, el trazo se acelera para acabar en 300 ms como mucho en vez de cortarse; y si
// todo estaba listo antes de 150 ms, la portada se quita sin más. La barra del sistema pasa de la noche al color de la app
// en unos pasos, no de golpe.
// (v0.289) La salida: la portada se abre desde la luna (no se funde) y el lobo viaja siempre al que haya debajo.
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

// (belleza 383, v0.289) El viaje del lobo, siempre: el de la portada vuela hasta el lobo que haya debajo (la marca de la
// bienvenida, la de la cabecera de Hoy o la de la pantalla de entrar) y aterriza en él. Con una copia suelta que se mueve
// con transform (sin transiciones de vista: vale en cualquier navegador y no captura la pantalla). Sin destino a la vista,
// el lobo se va con la portada.
const VUELO_MS = 420;
const DESTINOS = '.bdia-marca svg, .marca img';
function destinoDelLobo() {
  for (const d of document.querySelectorAll(DESTINOS)) {
    const r = d.getBoundingClientRect();
    if (r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth && !d.closest('[inert], [aria-hidden="true"]:not(svg):not(img)')) return d;
  }
  return null;
}
export function volarLobo(lobo, destino, ms = VUELO_MS) {
  try {
    const a = lobo.getBoundingClientRect(), b = destino.getBoundingClientRect();
    if (!(a.width > 0) || !(b.width > 0) || typeof lobo.animate !== 'function') return null;
    const copia = lobo.cloneNode(true);
    copia.removeAttribute('class');
    copia.querySelectorAll('.portada-lobo-trazo, .portada-ojo').forEach((x) => x.remove());
    copia.querySelectorAll('[class]').forEach((x) => x.removeAttribute('class'));
    Object.assign(copia.style, { position: 'fixed', left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, margin: '0', zIndex: '2147483001', fill: '#fff', pointerEvents: 'none', transformOrigin: '0 0', willChange: 'transform' });
    copia.setAttribute('aria-hidden', 'true');
    document.body.appendChild(copia);
    lobo.style.visibility = 'hidden';
    const antes = destino.style.visibility;
    destino.style.visibility = 'hidden';
    // (cabe entero en su destino, centrado: la caja del lobo no es cuadrada)
    const k = Math.min(b.width / a.width, b.height / a.height);
    const x = b.left + (b.width - a.width * k) / 2 - a.left, y = b.top + (b.height - a.height * k) / 2 - a.top;
    const anim = copia.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${x}px, ${y}px) scale(${k})`, opacity: 1, offset: 0.82 }, { transform: `translate(${x}px, ${y}px) scale(${k})`, opacity: 0 }], { duration: ms, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' });
    let hecho = false;
    const fin = () => { if (hecho) return; hecho = true; destino.style.visibility = antes; copia.remove(); };
    // (el destino vuelve cuando la copia ya está encima, para que el relevo no se note)
    setTimeout(() => { destino.style.visibility = antes; }, ms * 0.8);
    anim.finished.then(fin, fin);
    setTimeout(fin, ms + 200);
    return anim;
  } catch { return null; }
}

// (belleza 382) La portada no se funde: se abre. Un círculo crece desde la luna hasta llenar la pantalla y deja ver la app
// (300 ms). Hace falta poder animar una medida propia (@property); si no, o en un móvil lento, el fundido de siempre.
const ABRE_MS = 300;
const puedeAbrirse = () => typeof CSS !== 'undefined' && typeof CSS.registerProperty === 'function' && !document.documentElement.hasAttribute('data-ligero');
function abrir(el) {
  const luna = el.querySelector('.portada-luna') || el.querySelector('.portada-lobo');
  const r = luna?.getBoundingClientRect();
  const cx = r && r.width ? r.left + r.width / 2 : window.innerWidth / 2, cy = r && r.width ? r.top + r.height / 2 : window.innerHeight * 0.4;
  const lejos = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy));
  el.style.setProperty('--ox', `${Math.round(cx)}px`);
  el.style.setProperty('--oy', `${Math.round(cy)}px`);
  el.style.setProperty('--portada-rmax', `${Math.ceil(lejos) + 4}px`);
  el.classList.add('abre');
}

function quitarYa({ sinSalida = false } = {}) {
  if (quitada) return;
  quitada = true;
  const el = typeof document !== 'undefined' && document.getElementById('portada');
  if (!el) { document.getElementById('tc-portada')?.remove(); sinPortada(null); return; }
  // (a partir de aquí la portada está saliendo: lo que la mire, que lo sepa)
  el.dataset.sale = '';
  avanzarPortada(1);
  if (sinSalida || quieto() || document.visibilityState === 'hidden') { document.getElementById('tc-portada')?.remove(); sinPortada(el); return; }
  fundirBarra();
  const lobo = el.querySelector('.portada-lobo');
  const destino = lobo && destinoDelLobo();
  if (destino) volarLobo(lobo, destino);
  // (sobre la bienvenida del día no hace falta abrir nada: es la misma noche; la portada se funde y el lobo viaja a su marca)
  if (puedeAbrirse() && !document.querySelector('.bdia')) {
    abrir(el);
    setTimeout(() => sinPortada(el), ABRE_MS + 20);
    return;
  }
  el.classList.add('fuera');
  setTimeout(() => sinPortada(el), 380);
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
  // (belleza 386) y a que lo de arriba ya no se mueva: el fondo de la bienvenida, si la hay, ya cargado (o fallado); se
  // vuelve a mirar cuando llega
  function comprobar() {
    if (document.querySelector('.siluetas')) return;
    const fondo = document.querySelector('img.bdia-fondo');
    if (fondo && !fondo.complete) { if (!fondo.dataset.portada) { fondo.dataset.portada = '1'; fondo.addEventListener('load', revisar, { once: true }); fondo.addEventListener('error', revisar, { once: true }); } return; }
    acabar();
  }
  window.addEventListener('fbe-siluetas-fuera', revisar);
  requestAnimationFrame(() => requestAnimationFrame(comprobar));
}
