// (tacto 204, v0.271) Las escalas se arrastran: en una fila de botones con números (el esfuerzo de la sesión, del 5 al
// 10; la nota del 1 al 10), el dedo va eligiendo el número por el que pasa, con un toque en cada uno. Tocar sigue
// valiendo, y el teclado y el lector de pantalla no cambian (siguen siendo botones).
import { vibrar } from './hapticos.js';
import { soloBotones } from './ajustes.js';

// fila: el grupo de botones. Se puede llamar las veces que haga falta (solo se instala una)
export function escalaArrastrable(fila) {
  if (!fila || fila.dataset.arrastra) return;
  fila.dataset.arrastra = '1';
  // (de lado manda el dedo; de arriba abajo la página se sigue desplazando)
  fila.style.touchAction = 'pan-y';
  let g = null, sinClic = -1e9;
  const botonEn = (x, y) => {
    const r = fila.getBoundingClientRect();
    const el = document.elementFromPoint(Math.min(r.right - 2, Math.max(r.left + 2, x)), Math.min(r.bottom - 2, Math.max(r.top + 2, y)));
    const b = el?.closest?.('button');
    return b && fila.contains(b) && !b.disabled ? b : null;
  };
  const elegir = (b) => { if (b && b.getAttribute('aria-pressed') !== 'true') { b.click(); vibrar('toque'); } };
  fila.addEventListener('pointerdown', (e) => { if (!(e.button > 0) && !soloBotones()) g = { id: e.pointerId, x: e.clientX, y: e.clientY, activo: false, ultimo: e.target.closest?.('button') || null }; });
  fila.addEventListener('pointermove', (e) => {
    if (!g || e.pointerId !== g.id) return;
    if (!g.activo) {
      const dx = Math.abs(e.clientX - g.x);
      if (dx < 8 || dx < Math.abs(e.clientY - g.y)) return;
      g.activo = true;
      try { fila.setPointerCapture(e.pointerId); } catch { /* sin captura: sigue mientras no salga */ }
      elegir(g.ultimo);
    }
    const b = botonEn(e.clientX, e.clientY);
    if (!b || b === g.ultimo) return;
    g.ultimo = b;
    elegir(b);
  });
  const fin = (e) => { if (!g || e.pointerId !== g.id) return; if (g.activo) sinClic = e.timeStamp; g = null; };
  fila.addEventListener('pointerup', fin); fila.addEventListener('pointercancel', fin);
  // (el clic de verdad que llega al soltar no deshace lo elegido: los de arriba, que son de código, sí pasan)
  fila.addEventListener('click', (e) => { if (e.isTrusted && e.timeStamp - sinClic < 120) { e.stopPropagation(); e.preventDefault(); } }, true);
}
