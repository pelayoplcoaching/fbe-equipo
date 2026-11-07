// (diseño, tanda 21) Deslizar a los lados para cambiar de pestaña, como ya se hacía con las semanas (Semana.jsx, v0.50):
// solo un gesto claramente horizontal, sin capturar el puntero hasta que lo es (los toques siguen siendo toques), y
// nunca desde lo que ya tiene su propio gesto de lado (gráficas, tiras de chips y fotos, campos). Con «reducir
// movimiento», se cambia sin moverse.
// (diseño, tanda 22) El panel sigue al dedo de verdad: va 1:1 mientras hay una pestaña hacia ese lado (y si no, con
// resistencia, como una goma), en el borde asoma el nombre de la siguiente, y se puede lanzar: un golpe rápido basta
// aunque el recorrido sea corto. Al soltar, el panel no vuelve hacia atrás antes de cambiar: la pestaña nueva entra
// desde el lado por el que se ha pedido. Las semanas (Semana.jsx) usan el mismo gesto.
import { useRef, useLayoutEffect } from 'preact/hooks';
import { sinMovimiento } from './transiciones.js';
import { vibrar } from './hapticos.js';

export const SIN_DESLIZAR = '.grafica-caja, .selector-chips, .semanas-tabs, .filtros-muro, .tira-fotos, .tm-lista, .pestanas, .chat-busqueda-tipos, .dias-deslizar, .galeria-pista, .reloj-descanso, .entrada-menu, .paso, .segmentos, input, textarea, select, video, [data-sin-deslizar], .velo, [aria-modal="true"]';

const UMBRAL = 56;          // px de recorrido que bastan
const LANZA = 0.45;         // px/ms: un golpe así de rápido basta…
const LANZA_MIN = 22;       // …con este recorrido mínimo

// El nombre de lo que viene, en el borde por el que entraría (decorativo: lo que se elige lo dice la barra)
function asomo() {
  let el = null;
  return {
    poner(texto, d, y, f) {
      if (!texto || typeof document === 'undefined') { this.quitar(); return; }
      if (!el) { el = document.createElement('div'); el.className = 'asoma'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); }
      el.textContent = texto;
      el.dataset.lado = d > 0 ? 'der' : 'izq';
      el.style.top = `${Math.round(y)}px`;
      el.style.setProperty('--f', String(Math.max(0, Math.min(1, f))));
      el.classList.toggle('listo', f >= 1);
    },
    quitar() { el?.remove(); el = null; },
  };
}

// alPasar(d): d = 1 (a la siguiente, el dedo va a la izquierda) o −1. hay(d): si hay algo hacia ese lado (sin él, todo
// vale como antes). nombre(d): lo que asoma en el borde.
export function useDeslizar(alPasar, { ignorar = SIN_DESLIZAR, hay = null, nombre = null } = {}) {
  const g = useRef(null);
  const asoma = useRef(null);
  asoma.current ||= asomo();
  const soltar = (el, sinVuelta = false) => {
    asoma.current.quitar();
    if (sinVuelta) {
      // (cambia de pestaña: el panel no vuelve hacia atrás; lo nuevo entra por su lado)
      el.style.transform = '';
      requestAnimationFrame(() => el.classList.remove('arrastrando'));
    } else { el.style.transform = ''; el.classList.remove('arrastrando'); }
    setTimeout(() => el.parentElement?.classList.remove('recorta-x'), 260);
  };
  return {
    onPointerDown: (e) => { if (e.button > 0 || (ignorar && e.target.closest?.(ignorar))) return; g.current = { x: e.clientX, y: e.clientY, id: e.pointerId, activo: false, pasos: [], listo: false }; },
    onPointerMove: (e) => {
      const s = g.current;
      if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (!s.activo && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        s.activo = true;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
        e.currentTarget.classList.add('arrastrando');
        e.currentTarget.parentElement?.classList.add('recorta-x');
      }
      if (!s.activo) return;
      s.pasos.push([e.clientX, e.timeStamp || performance.now()]);
      if (s.pasos.length > 5) s.pasos.shift();
      const d = dx < 0 ? 1 : -1;
      const puede = hay ? hay(d) : true;
      if (!sinMovimiento()) {
        const x = puede ? dx : Math.sign(dx) * Math.min(48, Math.abs(dx) * 0.28);
        e.currentTarget.style.transform = `translateX(${Math.round(x)}px)`;
      }
      if (puede && nombre) {
        const f = Math.abs(dx) / UMBRAL;
        asoma.current.poner(nombre(d), d, s.y, f);
        // (un toque al cruzar el umbral: soltar ahora cambia)
        if (f >= 1 && !s.listo) { s.listo = true; vibrar('elegir'); } else if (f < 1) s.listo = false;
      } else asoma.current.quitar();
    },
    onPointerUp: (e) => {
      const s = g.current;
      g.current = null;
      if (!s?.activo) { soltar(e.currentTarget); return; }
      const dx = e.clientX - s.x, d = dx < 0 ? 1 : -1;
      const [a, b] = [s.pasos[0], s.pasos[s.pasos.length - 1]];
      const v = a && b && b[1] > a[1] ? (b[0] - a[0]) / (b[1] - a[1]) : 0;
      const lanzado = Math.abs(v) >= LANZA && Math.abs(dx) >= LANZA_MIN && Math.sign(v) === Math.sign(dx);
      const pasa = (Math.abs(dx) > UMBRAL || lanzado) && (hay ? hay(d) : true);
      soltar(e.currentTarget, pasa);
      if (pasa) alPasar(d);
    },
    onPointerCancel: (e) => { g.current = null; soltar(e.currentTarget); },
  };
}

// Para un grupo de pestañas (Pestanas de comunes.jsx) con su panel: devuelve el gesto del panel, el `cambiar` que
// hay que darle a la barra (apunta hacia dónde se va) y la ref del panel, que entra desde ese lado al cambiar.
export function usePestanasDeslizables(opciones, valor, alCambiar) {
  const dir = useRef(0);
  const panel = useRef(null);
  const idx = (id) => opciones.findIndex(([x]) => x === id);
  const cambiar = (id) => {
    const a = idx(valor), b = idx(id);
    dir.current = a < 0 || b < 0 || a === b ? 0 : b > a ? 1 : -1;
    alCambiar(id);
  };
  const vecino = (d) => opciones[idx(valor) + d] || null;
  const gesto = useDeslizar((d) => { const o = vecino(d); if (o) cambiar(o[0]); }, {
    hay: (d) => !!vecino(d),
    nombre: (d) => { const t = vecino(d)?.[1]; return typeof t === 'string' ? t : null; },
  });
  useLayoutEffect(() => {
    const d = dir.current;
    dir.current = 0;
    const el = panel.current;
    if (!d || !el || sinMovimiento() || typeof el.animate !== 'function') return;
    // (mientras entra, quien lo contiene recorta de lado: lo que asoma por el borde no ensancha la página)
    const padre = el.parentElement;
    padre?.classList.add('recorta-x');
    try {
      const a = el.animate([{ transform: `translateX(${d * 64}px)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.16, 1, .3, 1)' });
      const fin = () => padre?.classList.remove('recorta-x');
      a.finished.then(fin, fin);
    } catch { padre?.classList.remove('recorta-x'); }
  }, [valor]);
  return { gesto, cambiar, panel };
}

// (diseño, tanda 22) Deslizar una fila a la derecha la marca como hecha (o deshecha), como una serie: el mismo gesto en
// toda la app. La fila sigue al dedo (con resistencia pasado el umbral), debajo asoma el verde con la marca, al cruzar
// el umbral hay un toque y, al soltar pasado él, se llama a alHecho. Solo un gesto claramente horizontal (de arriba
// abajo se desplaza la página) y el clic de después no cuenta. Uso: <div {...deslizarHecho(() => marcar(e))}>.
const UMBRAL_HECHO = 64;
let filaEnCurso = null;
export function deslizarHecho(alHecho) {
  const soltar = (el) => { el.classList.remove('deslizando'); el.style.removeProperty('--dx'); el.style.removeProperty('--f'); el.removeAttribute('data-listo'); };
  return {
    onPointerDown: (e) => { if (e.button > 0) return; filaEnCurso = { id: e.pointerId, x: e.clientX, y: e.clientY, activo: false, listo: false }; },
    onPointerMove: (e) => {
      const g = filaEnCurso;
      if (!g || g.id !== e.pointerId) return;
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (!g.activo) {
        if (dx < 12 || dx < Math.abs(dy) * 1.4) { if (Math.abs(dy) > 12) filaEnCurso = null; return; }
        g.activo = true;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
        e.currentTarget.classList.add('deslizando');
      }
      const x = Math.max(0, dx <= UMBRAL_HECHO ? dx : UMBRAL_HECHO + (dx - UMBRAL_HECHO) * 0.3);
      e.currentTarget.style.setProperty('--dx', `${Math.round(sinMovimiento() ? 0 : x)}px`);
      e.currentTarget.style.setProperty('--f', String(Math.min(1, x / UMBRAL_HECHO)));
      const listo = dx >= UMBRAL_HECHO;
      if (listo !== g.listo) { g.listo = listo; e.currentTarget.toggleAttribute('data-listo', listo); if (listo) vibrar('elegir'); }
    },
    onPointerUp: (e) => {
      const g = filaEnCurso;
      filaEnCurso = null;
      if (!g?.activo) return;
      soltar(e.currentTarget);
      if (g.listo) { vibrar('hecho'); alHecho(); }
    },
    onPointerCancel: (e) => { filaEnCurso = null; soltar(e.currentTarget); },
  };
}
