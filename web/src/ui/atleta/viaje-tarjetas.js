// (tacto 210 y 211, v0.272) Lo que cambia de sitio en la sesión, se ve: al dejar un ejercicio para luego (o al ordenar lo
// que queda, o al deshacerlo), cada tarjeta va de donde estaba a donde queda; y al cambiar un ejercicio por otro, su
// tarjeta gira al nuevo. Una vez y deprisa; con «reducir movimiento», de golpe.
import { sinMovimiento } from '../transiciones.js';

const SEL = '[data-se]';
// Dónde está cada tarjeta ahora (en la página, no en la pantalla: da igual lo que se desplace después)
export function fotoTarjetas() {
  const m = new Map();
  if (typeof document === 'undefined') return m;
  for (const el of document.querySelectorAll(SEL)) m.set(el.dataset.se, el.getBoundingClientRect().top + window.scrollY);
  return m;
}
// Tras pintar el orden nuevo: cada una viaja desde su sitio de antes (como mucho «tope» px: la que se va al final no
// cruza toda la página)
export function viajarTarjetas(foto, { tope = 480 } = {}) {
  if (!foto?.size || sinMovimiento()) return;
  requestAnimationFrame(() => {
    for (const el of document.querySelectorAll(SEL)) {
      const antes = foto.get(el.dataset.se);
      if (antes == null || !el.animate) continue;
      const d = antes - (el.getBoundingClientRect().top + window.scrollY);
      if (Math.abs(d) < 6) continue;
      const dy = Math.max(-tope, Math.min(tope, d));
      try { el.animate([{ transform: `translateY(${dy.toFixed(1)}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2, .9, .3, 1.05)' }); } catch { /* de golpe */ }
    }
  });
}
// (211) La tarjeta de un ejercicio gira al que se acaba de elegir
export function girarTarjeta(seId) {
  if (sinMovimiento()) return;
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-se="${seId}"]`);
    if (!el?.animate) return;
    try { el.animate([{ transform: 'perspective(1100px) rotateY(-86deg)' }, { transform: 'perspective(1100px) rotateY(0deg)' }], { duration: 400, easing: 'cubic-bezier(.2, .8, .3, 1)' }); } catch { /* de golpe */ }
  });
}
