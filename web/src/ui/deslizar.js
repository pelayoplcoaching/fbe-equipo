// (diseño, tanda 21) Deslizar a los lados para cambiar de pestaña, como ya se hacía con las semanas (Semana.jsx, v0.50):
// solo un gesto claramente horizontal, sin capturar el puntero hasta que lo es (los toques siguen siendo toques), y
// nunca desde lo que ya tiene su propio gesto de lado (gráficas, tiras de chips y fotos, campos). El panel se mueve un
// poco con el dedo y, al soltar, la pestaña nueva entra desde el lado por el que se ha pedido; también al tocar la
// pestaña en la barra. Con «reducir movimiento», se cambia sin moverse.
import { useRef, useLayoutEffect } from 'preact/hooks';
import { sinMovimiento } from './transiciones.js';

export const SIN_DESLIZAR = '.grafica-caja, .selector-chips, .semanas-tabs, .filtros-muro, .tira-fotos, .tm-lista, .pestanas, .chat-busqueda-tipos, .dias-deslizar, input, textarea, select, video, [data-sin-deslizar], .velo, [aria-modal="true"]';

export function useDeslizar(alPasar, { ignorar = SIN_DESLIZAR } = {}) {
  const g = useRef(null);
  const soltar = (el) => { el.style.transform = ''; el.classList.remove('arrastrando'); };
  return {
    onPointerDown: (e) => { if (e.button > 0 || (ignorar && e.target.closest?.(ignorar))) return; g.current = { x: e.clientX, y: e.clientY, id: e.pointerId, activo: false }; },
    onPointerMove: (e) => {
      const s = g.current;
      if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (!s.activo && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        s.activo = true;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
        e.currentTarget.classList.add('arrastrando');
      }
      if (s.activo && !sinMovimiento()) e.currentTarget.style.transform = `translateX(${Math.round(dx * 0.35)}px)`;
    },
    onPointerUp: (e) => {
      const s = g.current;
      g.current = null;
      soltar(e.currentTarget);
      if (s?.activo && Math.abs(e.clientX - s.x) > 56) alPasar(e.clientX < s.x ? 1 : -1);
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
  const gesto = useDeslizar((d) => { const j = idx(valor) + d; if (j >= 0 && j < opciones.length) cambiar(opciones[j][0]); });
  useLayoutEffect(() => {
    const d = dir.current;
    dir.current = 0;
    const el = panel.current;
    if (!d || !el || sinMovimiento() || typeof el.animate !== 'function') return;
    try { el.animate([{ transform: `translateX(${d * 32}px)` }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2, .8, .2, 1)' }); } catch { /* */ }
  }, [valor]);
  return { gesto, cambiar, panel };
}
