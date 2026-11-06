// Pulido 2: no perder el sitio. Cada pestaña recuerda por dónde iba la pantalla y, al volver a ella (desde otra
// pestaña, o al cerrar una sesión o la ficha de un atleta), se queda donde estaba, como en las apps del móvil.
// Lo que se abre (una sesión, una ficha) empieza siempre arriba y no se recuerda.
//
// Cómo: mientras una pantalla está a la vista, cada scroll apunta su posición. Al cambiar de pantalla (usePosicion,
// en un efecto de layout: con la pantalla nueva ya pintada y antes de que el navegador avise de ningún scroll), se
// deja de apuntar y se pone la posición guardada. Si la pantalla nueva aún está cargando y no da para tanto, se
// espera a que dé (como mucho TOPE ms); si en la espera se toca, se rueda o se teclea, manda la persona y se deja.

import { useLayoutEffect } from 'preact/hooks';

const TOPE = 4000;     // lo que se espera a que la pantalla cargue
const ASIENTO = 300;   // lo que se vigila después de ponerla en su sitio (lo que dura la transición de pantalla)
const guardadas = new Map();
let actual = null;      // la pantalla a la vista (null: no se recuerda)
let pendiente = null;   // { y, fin, raf, puesta }: una posición esperando a que la pantalla dé para tanto (o asentándose)
let escuchando = false;

const hayVentana = () => typeof window !== 'undefined' && typeof document !== 'undefined';
const maximo = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

function soltar() {
  if (!pendiente) return;
  if (pendiente.raf) cancelAnimationFrame(pendiente.raf);
  pendiente = null;
}
function intentar() {
  const p = pendiente;
  if (!p) return;
  p.raf = 0;
  const ahora = performance.now();
  if (maximo() >= p.y - 1) {
    if (Math.abs(window.scrollY - p.y) > 1) window.scrollTo(0, p.y);
    // Ya está en su sitio. Un momento más de guardia, mientras dura la transición (no se ve): si algo que llega
    // por encima (un aviso, una tarjeta) empuja la pantalla, se vuelve a poner. Pasado ese momento, o si la persona
    // la mueve, se suelta: lo que llegue después lo absorbe el navegador sin que lo que se mira se mueva
    if (!p.puesta) { p.puesta = true; p.fin = ahora + ASIENTO; }
  }
  if (ahora > p.fin) { pendiente = null; return; }
  p.raf = requestAnimationFrame(intentar);
}
function escuchar() {
  if (escuchando || !hayVentana()) return;
  escuchando = true;
  window.addEventListener('scroll', () => { if (actual && !pendiente) guardadas.set(actual, window.scrollY); }, { passive: true });
  // Si la persona mueve la pantalla mientras se espera, se deja donde ella la ponga
  for (const ev of ['touchstart', 'wheel', 'keydown', 'mousedown']) window.addEventListener(ev, soltar, { passive: true, capture: true });
}

// Para las pruebas y para quien quiera mirar (no se usa para pintar)
export const posicionGuardada = (clave) => guardadas.get(clave) || 0;
export function olvidarPosiciones() { soltar(); guardadas.clear(); actual = null; }

// Se cambia a la pantalla `clave` (null: una que no se recuerda y empieza arriba)
export function irAPosicion(clave) {
  if (!hayVentana()) return;
  escuchar();
  soltar();
  actual = clave || null;
  const y = actual ? guardadas.get(actual) || 0 : 0;
  if (y <= 0) { window.scrollTo(0, 0); return; }
  pendiente = { y, fin: performance.now() + TOPE, raf: 0 };
  intentar();   // si ya da (lo que se pinta con lo que había en memoria), entra en la misma transición
}

// Volver arriba al tocar la pestaña en la que ya se está (como en iOS)
export function subirArriba() {
  if (!hayVentana()) return;
  soltar();
  const quieto = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: quieto ? 'auto' : 'smooth' });
}

// clave: la pantalla a la vista; recordar: si su posición se guarda (si no, empieza arriba cada vez que se entra).
// Cambia la clave → se pone la posición de la nueva
export function usePosicion(clave, recordar = true) {
  // Al entrar en la app (otra cuenta, o el coach que entra y sale del modo atleta), se empieza de cero
  useLayoutEffect(() => { olvidarPosiciones(); }, []);
  useLayoutEffect(() => { irAPosicion(recordar ? clave : null); }, [clave]);
}
