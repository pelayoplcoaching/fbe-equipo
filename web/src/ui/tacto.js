// (diseño, tanda 20) Lo que responden las manos, repartido desde aquí sin tocar cada pantalla (como pulido.js hace con
// los controles de cada día). Cuatro cosas:
//   · Un toque «elegir» al cambiar de sección en la barra de abajo, de pestaña, de semana o de filtro del muro, y al
//     desplegar una fila (solo cuando cambia algo: tocar la pestaña en la que ya se está no vibra). Los interruptores,
//     casillas, «+» y «−», segmentos y chips ya tienen el suyo en pulido.js: aquí no se repiten.
//   · El botón que ha estado guardando (data-guardando, de pulido.js) enseña un «hecho» (data-hecho) un momento al
//     terminar, sin cambiar de tamaño: el dibujo es de diseno.css (bloque 57).
//   · Un campo que pasa a inválido (aria-invalid) tiembla una vez (data-tiembla, bloque 58) y da el toque «aviso».
//   · Los deslizadores (input[type="range"]) llevan en --v cuánto están llenos, para pintar la pista (bloque 60).
// (tanda 22) Y cuatro más, también sin tocar las pantallas:
//   · Los interruptores se pueden arrastrar: la bola sigue al dedo y, al soltar, se queda del lado en que esté.
//   · La pastilla de los segmentos se arrastra de una opción a otra (como en iOS) y, al soltar, elige esa.
//   · Un toque suave cada vez que una tira con paradas (fotos, menú de la semana, galería) se detiene en un elemento.
//   · Tocar un botón que aún no se puede usar hace un leve «no» de lado (data-no, bloque 72) con su toque.
// En los dos arrastres, el clic que el navegador manda al soltar no cuenta: lo que vale es dónde se ha soltado.
import { vibrar } from './hapticos.js';

const ELEGIR = '.tabs .tab:not([aria-current="page"]), .pestanas [role="tab"]:not([aria-selected="true"]), .semanas-tabs button:not([aria-pressed="true"]):not([aria-current]), .filtros-muro button:not([aria-pressed="true"]), details > summary, .tab-mas';

function valorDeslizador(r) {
  const min = Number(r.min) || 0, max = r.max === '' ? 100 : Number(r.max), v = Number(r.value);
  if (!(max > min) || Number.isNaN(v)) return;
  r.style.setProperty('--v', `${Math.round(((v - min) / (max - min)) * 1000) / 10}%`);
}

export function instalarTacto(d = typeof document !== 'undefined' ? document : null) {
  if (!d || typeof window === 'undefined') return () => {};
  const alTocar = (e) => {
    const el = e.target?.closest?.(ELEGIR);
    if (el && !el.disabled && el.getAttribute('aria-disabled') !== 'true') vibrar('elegir');
  };
  d.addEventListener('click', alTocar, { passive: true, capture: true });
  // ---- (tanda 22) arrastres de interruptores y pastillas, y el «no» de lo desactivado
  let suprimir = 0;
  const alClic = (e) => { if (suprimir && Date.now() < suprimir) { e.preventDefault(); e.stopImmediatePropagation(); } };
  // (en la ventana: así va antes que los de la página, también el toque de pulido.js)
  const w = d.defaultView || window;
  w.addEventListener('click', alClic, true);
  const despues = (fn) => { suprimir = Date.now() + 400; setTimeout(() => { suprimir = 0; fn?.(); }, 0); };
  let g = null;
  const alBajar = (e) => {
    if (e.button > 0) return;
    const t = e.target;
    const sw = t?.closest?.('input.interruptor');
    if (sw && !sw.disabled) { g = { tipo: 'sw', el: sw, x: e.clientX, id: e.pointerId, base: sw.checked ? 20 : 0, activo: false, lado: sw.checked }; return; }
    const bt = t?.closest?.('.segmentos[data-pastilla] > button[aria-pressed="true"]');
    if (bt && !bt.disabled) {
      const grupo = bt.parentElement, botones = [...grupo.querySelectorAll(':scope > button')];
      if (botones.every((b) => b.offsetTop === bt.offsetTop)) g = { tipo: 'seg', el: bt, grupo, botones, x: e.clientX, id: e.pointerId, x0: bt.offsetLeft, activo: false, cerca: bt };
      return;
    }
    const off = t?.closest?.('button:disabled, button[aria-disabled="true"], [role="button"][aria-disabled="true"]');
    if (off && !off.hasAttribute('data-guardando') && off.getAttribute('aria-busy') !== 'true') g = { tipo: 'no', el: off, x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const alMover = (e) => {
    if (!g || g.id !== e.pointerId || g.tipo === 'no') return;
    const dx = e.clientX - g.x;
    if (!g.activo) {
      if (Math.abs(dx) < 6) return;
      g.activo = true;
      try { g.el.setPointerCapture(e.pointerId); } catch { /* */ }
      if (g.tipo === 'sw') g.el.classList.add('arrastrando-bola'); else g.grupo.classList.add('arrastrando-pastilla');
    }
    if (g.tipo === 'sw') {
      const x = Math.max(0, Math.min(20, g.base + dx));
      g.el.style.setProperty('--bola', `${x}px`);
      const lado = x > 10;
      if (lado !== g.lado) { g.lado = lado; g.el.toggleAttribute('data-casi', lado); vibrar('elegir'); }
    } else {
      const ult = g.botones[g.botones.length - 1];
      const x = Math.max(g.botones[0].offsetLeft, Math.min(ult.offsetLeft + ult.offsetWidth - g.el.offsetWidth, g.x0 + dx));
      const centro = x + g.el.offsetWidth / 2;
      let cerca = g.botones[0];
      for (const b of g.botones) if (Math.abs(b.offsetLeft + b.offsetWidth / 2 - centro) < Math.abs(cerca.offsetLeft + cerca.offsetWidth / 2 - centro)) cerca = b;
      g.grupo.style.setProperty('--seg-x', `${Math.round(x)}px`);
      if (cerca !== g.cerca) { g.cerca = cerca; vibrar('elegir'); }
    }
  };
  const alSoltar = (e) => {
    const a = g;
    g = null;
    if (!a || a.id !== e.pointerId) return;
    if (a.tipo === 'no') {
      if (Math.hypot(e.clientX - a.x, e.clientY - a.y) > 10 || !a.el.isConnected) return;
      a.el.removeAttribute('data-no'); void a.el.offsetWidth; a.el.setAttribute('data-no', '');
      a.el.addEventListener('animationend', () => a.el.removeAttribute('data-no'), { once: true });
      vibrar('no');
      return;
    }
    if (!a.activo) return;
    if (a.tipo === 'sw') {
      a.el.classList.remove('arrastrando-bola'); a.el.style.removeProperty('--bola'); a.el.removeAttribute('data-casi');
      const quiere = a.lado;
      despues(() => { if (a.el.checked !== quiere) a.el.click(); });
    } else {
      a.grupo.classList.remove('arrastrando-pastilla');
      const b = a.cerca;
      despues(() => {
        if (b !== a.el) b.click();
        else { a.grupo.style.setProperty('--seg-x', `${a.el.offsetLeft}px`); }
      });
    }
  };
  const alCancelar = () => {
    if (g?.tipo === 'sw') { g.el.classList.remove('arrastrando-bola'); g.el.style.removeProperty('--bola'); g.el.removeAttribute('data-casi'); }
    if (g?.tipo === 'seg') { g.grupo.classList.remove('arrastrando-pastilla'); g.grupo.style.setProperty('--seg-x', `${g.el.offsetLeft}px`); }
    g = null;
  };
  d.addEventListener('pointerdown', alBajar, true);
  d.addEventListener('pointermove', alMover, true);
  d.addEventListener('pointerup', alSoltar, true);
  d.addEventListener('pointercancel', alCancelar, true);
  // ---- (tanda 22) un toque al encajar en una tira con paradas (donde el navegador avisa: scrollsnapchange)
  const alEncajar = (e) => { if (e.target?.matches?.('.tira-fotos, .tm-lista, .galeria-pista')) vibrar('elegir'); };
  d.addEventListener('scrollsnapchange', alEncajar, true);
  const alDeslizar = (e) => { const r = e.target; if (r?.tagName === 'INPUT' && r.type === 'range') valorDeslizador(r); };
  d.addEventListener('input', alDeslizar, { passive: true, capture: true });
  const sinHecho = new Map();
  let mirador = null;
  if (typeof MutationObserver !== 'undefined') {
    mirador = new MutationObserver((cambios) => {
      for (const c of cambios) {
        const el = c.target;
        if (!(el instanceof HTMLElement)) continue;
        if (c.attributeName === 'data-guardando') {
          // (al dejar de guardar, un «hecho» breve; si vuelve a guardar o desaparece, se quita)
          if (el.hasAttribute('data-guardando')) { clearTimeout(sinHecho.get(el)); el.removeAttribute('data-hecho'); continue; }
          if (c.oldValue == null) continue;
          el.setAttribute('data-hecho', '');
          sinHecho.set(el, setTimeout(() => { el.removeAttribute('data-hecho'); sinHecho.delete(el); }, 1100));
        } else if (c.attributeName === 'aria-invalid') {
          if (el.getAttribute('aria-invalid') === 'true' && c.oldValue !== 'true') {
            el.removeAttribute('data-tiembla');
            void el.offsetWidth;   // (para que tiemble otra vez si vuelve a fallar)
            el.setAttribute('data-tiembla', '');
            vibrar('aviso');
            el.addEventListener('animationend', () => el.removeAttribute('data-tiembla'), { once: true });
          }
        } else if (c.type === 'childList') {
          for (const n of c.addedNodes) {
            if (!(n instanceof HTMLElement)) continue;
            if (n.matches?.('input[type="range"]')) valorDeslizador(n);
            else for (const r of n.querySelectorAll?.('input[type="range"]') || []) valorDeslizador(r);
          }
        }
      }
    });
    mirador.observe(d.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-guardando', 'aria-invalid'], attributeOldValue: true });
    for (const r of d.querySelectorAll('input[type="range"]')) valorDeslizador(r);
  }
  return () => {
    d.removeEventListener('click', alTocar, { capture: true });
    w.removeEventListener('click', alClic, true);
    d.removeEventListener('pointerdown', alBajar, true);
    d.removeEventListener('pointermove', alMover, true);
    d.removeEventListener('pointerup', alSoltar, true);
    d.removeEventListener('pointercancel', alCancelar, true);
    d.removeEventListener('scrollsnapchange', alEncajar, true);
    d.removeEventListener('input', alDeslizar, { capture: true });
    mirador?.disconnect();
    for (const t of sinHecho.values()) clearTimeout(t);
  };
}
