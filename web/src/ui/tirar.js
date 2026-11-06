// Pulido 9: tirar para recargar. En las pantallas de consulta (las que su <main> marca con data-tirar: Hoy, Semana,
// Progreso, la lista de atletas, Revisar, las conversaciones…), con la pantalla arriba del todo, tirar hacia abajo
// pone al día lo que se está viendo, sin recargar la app: cada carga montada (useCarga) se repite en silencio.
// No actúa con una ventana abierta, dentro de un chat o de una sesión, ni al tirar de algo que se arrastra o se
// desliza de lado. La rueda sigue al dedo; pasado el umbral, un toque háptico, y al soltar, gira hasta que llega todo.

import { vibrar } from './hapticos.js';

const UMBRAL = 72;      // lo que hay que tirar (ya con la resistencia) para que recargue al soltar
const TOPE = 110;       // hasta dónde baja la rueda
const MINIMO = 550;     // lo que gira como poco (que se vea que ha hecho algo)
const MAXIMO = 8000;    // y como mucho, si la red no contesta
export const EVENTO_RECARGAR = 'fbe-recargar';

// Lo que no es tirar de la pantalla: campos, cosas que se arrastran, tiras que se deslizan de lado, vídeos…
const NO = 'input, textarea, select, video, canvas, [draggable="true"], [data-sin-tirar], .reproductor, .chat-pagina, .tira-chips, .galeria-pista, .semanas-tabs';

// Pide a todas las cargas montadas que se repitan en silencio; se resuelve cuando han acabado todas
export function recargarTodo() {
  const esperas = [];
  try { window.dispatchEvent(new CustomEvent(EVENTO_RECARGAR, { detail: { esperas } })); } catch { /* */ }
  return Promise.allSettled(esperas);
}

let instalado = false;
export function instalarTirar(d = typeof document !== 'undefined' ? document : null) {
  if (!d || instalado) return;
  instalado = true;
  let g = null;         // el gesto en marcha: { y0, x0, tira, pasado }
  let ocupado = false;  // recargando
  let rueda = null;
  const ponerRueda = () => {
    if (!rueda) {
      rueda = d.createElement('div');
      rueda.className = 'tirar';
      rueda.setAttribute('aria-hidden', 'true');
      rueda.innerHTML = '<span class="tirar-rueda"></span>';
      d.body.appendChild(rueda);
    }
    return rueda;
  };
  const mover = (px, soltando = false) => {
    const r = ponerRueda();
    r.classList.toggle('soltando', soltando);
    r.style.setProperty('--tirar', `${Math.round(px)}px`);
    r.style.setProperty('--giro', `${Math.round(px * 3)}deg`);
    r.classList.toggle('lista', px >= UMBRAL);
  };
  const puede = (objetivo) => !ocupado && window.scrollY <= 0 && !d.body.dataset.hojas && !d.querySelector('[aria-modal="true"]')
    && !!objetivo?.closest?.('main[data-tirar]') && !objetivo.closest(NO);

  d.addEventListener('touchstart', (e) => {
    g = null;
    if (e.touches.length !== 1 || !puede(e.target)) return;
    g = { y0: e.touches[0].clientY, x0: e.touches[0].clientX, tira: false, pasado: false };
  }, { passive: true });
  d.addEventListener('touchmove', (e) => {
    if (!g) return;
    const dy = e.touches[0].clientY - g.y0, dx = e.touches[0].clientX - g.x0;
    if (!g.tira) {
      // Se decide con los primeros píxeles: hacia abajo y más vertical que horizontal (si no, es otra cosa)
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
      if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) { g = null; return; }
      g.tira = true;
    }
    if (window.scrollY > 0) { g = null; mover(0, true); return; }
    const px = Math.min(TOPE, Math.max(0, dy) * 0.5);   // con resistencia: la rueda baja la mitad que el dedo
    if (px >= UMBRAL && !g.pasado) { g.pasado = true; vibrar('toque'); }
    if (px < UMBRAL) g.pasado = false;
    g.px = px;
    mover(px);
  }, { passive: true });
  const soltar = async () => {
    const x = g;
    g = null;
    if (!x?.tira) return;
    if ((x.px || 0) < UMBRAL) { mover(0, true); return; }
    ocupado = true;
    const r = ponerRueda();
    mover(UMBRAL * 0.8, true);
    r.classList.add('girando');
    const t0 = Date.now();
    await Promise.race([recargarTodo(), new Promise((res) => setTimeout(res, MAXIMO))]);
    const falta = MINIMO - (Date.now() - t0);
    if (falta > 0) await new Promise((res) => setTimeout(res, falta));
    r.classList.remove('girando');
    mover(0, true);
    ocupado = false;
  };
  d.addEventListener('touchend', soltar, { passive: true });
  d.addEventListener('touchcancel', () => { if (g?.tira) mover(0, true); g = null; }, { passive: true });
}
