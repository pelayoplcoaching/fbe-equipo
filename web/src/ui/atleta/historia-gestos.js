// (tacto 226-228, v0.271) Los gestos de las historias. Mantener pulsado: se para (la barra también) y se quitan las barras
// y la ✕ para ver la tarjeta limpia; al soltar sigue, con su tiempo entero. Deslizar hacia abajo: la historia baja con el
// dedo y encoge un poco; al soltar, se cierra o vuelve. Deslizar de lado: la tarjeta sigue al dedo y pasa a la siguiente
// o a la anterior (hacia delante en la última, cierra, como al tocar). Tocar los lados sigue valiendo. Con «reducir
// movimiento» todo sigue al dedo igual, pero al soltar va a su sitio de golpe.
import { vibrar } from '../hapticos.js';
import { sinMovimiento } from '../transiciones.js';
import { PAUSA_MS, decidirGesto, cierraAlBajar, destinoLado, gomaLado } from '../../logica/historia-gesto.js';

const CURVA = 'cubic-bezier(.2, .9, .3, 1.1)';

// el: la historia; leer(): { i, n, ir, alCerrar, parada, setPausa } de ahora. Devuelve cómo quitarlo
export function instalarHistoria(el, leer) {
  if (!el) return () => {};
  const tocar = el.style.touchAction;
  el.style.touchAction = 'none';
  let g = null, sinClic = -1e9;
  const pantalla = () => el.querySelector('.historia-pantalla');
  const adornos = (v) => { for (const a of el.querySelectorAll('.historia-barras, .historia-cerrar')) a.style.visibility = v; };
  const pausar = (si) => {
    leer().setPausa(si);
    const b = el.querySelector('.historia-barras .corre i');
    if (!b) return;
    if (si) { b.style.animationPlayState = 'paused'; return; }
    // (al seguir, la tarjeta vuelve a tener su tiempo entero: la barra empieza de nuevo, a la vez que la cuenta)
    b.style.animationPlayState = ''; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  };
  const volver = (nodo, desde) => {
    if (!nodo || sinMovimiento() || !nodo.animate) return;
    try { nodo.animate([{ transform: desde }, { transform: 'none' }], { duration: 260, easing: CURVA }); } catch { /* de golpe */ }
  };
  const esControl = (t) => !!t?.closest?.('button:not(.historia-zona), a, input, select, textarea, [role="slider"]');
  const baja = (e) => {
    if (e.button > 0 || g || esControl(e.target) || leer().parada) return;
    g = { id: e.pointerId, x: e.clientX, y: e.clientY, modo: null, ux: e.clientX, uy: e.clientY, ut: e.timeStamp, vx: 0, vy: 0 };
    g.tp = setTimeout(() => { if (!g || g.modo) return; g.modo = 'pausa'; pausar(true); adornos('hidden'); vibrar('toque'); }, PAUSA_MS);
  };
  const mueve = (e) => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    const dt = Math.max(1, e.timeStamp - g.ut);
    g.vx = (e.clientX - g.ux) / dt; g.vy = (e.clientY - g.uy) / dt; g.ux = e.clientX; g.uy = e.clientY; g.ut = e.timeStamp;
    if (g.modo !== 'baja' && g.modo !== 'lado') {
      const m = decidirGesto(dx, dy);
      if (!m) return;
      clearTimeout(g.tp);
      if (g.modo !== 'pausa') pausar(true);
      adornos('');
      g.modo = m;
      try { el.setPointerCapture(e.pointerId); } catch { /* sin captura: sigue mientras no salga */ }
    }
    if (g.modo === 'baja') {
      const y = Math.max(0, dy);
      el.style.transform = `translateY(${y}px) scale(${(1 - Math.min(0.1, y / 3000)).toFixed(4)})`;
      el.style.borderRadius = `${Math.min(28, y / 5).toFixed(1)}px`;
    } else {
      const pa = pantalla();
      if (pa) pa.style.transform = `translateX(${gomaLado(dx, leer()).toFixed(1)}px)`;
    }
  };
  const sube = (e) => {
    if (!g || e.pointerId !== g.id) return;
    clearTimeout(g.tp);
    const { modo, vx, vy } = g;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    g = null;
    adornos('');
    if (!modo) return;   // un toque de siempre: lo lleva el clic de su zona
    sinClic = e.timeStamp;
    const o = leer();
    const cancelado = e.type === 'pointercancel';
    if (modo === 'pausa') { pausar(false); return; }
    if (modo === 'baja') {
      const desde = el.style.transform || 'none';
      if (!cancelado && cierraAlBajar(dy, vy)) {
        vibrar('elegir');
        if (sinMovimiento() || !el.animate) { o.alCerrar(); return; }
        try {
          const a = el.animate([{ transform: desde }, { transform: 'translateY(100%) scale(.9)' }], { duration: 200, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' });
          a.onfinish = () => o.alCerrar();
        } catch { o.alCerrar(); }
        return;
      }
      el.style.transform = ''; el.style.borderRadius = '';
      volver(el, desde); pausar(false);
      return;
    }
    const pa = pantalla();
    const desde = pa?.style.transform || 'none';
    if (pa) pa.style.transform = '';
    const d = cancelado ? 0 : destinoLado(dx, vx, o);
    pausar(false);
    if (d === 'cerrar') { o.alCerrar(); return; }
    if (!d) { volver(pa, desde); return; }
    vibrar('elegir');
    o.ir(d);
    // (la que llega entra desde su lado)
    requestAnimationFrame(() => {
      const n = pantalla();
      if (!n || n === pa || sinMovimiento() || !n.animate) return;
      try { n.animate([{ transform: `translateX(${d * 72}px)` }, { transform: 'none' }], { duration: 300, easing: CURVA }); } catch { /* */ }
    });
  };
  // (el clic que llega detrás de un gesto no pasa de tarjeta)
  const clic = (e) => { if (e.timeStamp - sinClic < 120) { e.stopPropagation(); e.preventDefault(); } };
  el.addEventListener('pointerdown', baja); el.addEventListener('pointermove', mueve); el.addEventListener('pointerup', sube); el.addEventListener('pointercancel', sube);
  el.addEventListener('click', clic, true);
  return () => {
    clearTimeout(g?.tp); g = null;
    el.style.touchAction = tocar;
    el.removeEventListener('pointerdown', baja); el.removeEventListener('pointermove', mueve); el.removeEventListener('pointerup', sube); el.removeEventListener('pointercancel', sube);
    el.removeEventListener('click', clic, true);
  };
}
