// (diseño, tanda 20) Lo que responden las manos, repartido desde aquí sin tocar cada pantalla (como pulido.js hace con
// los controles de cada día). Cuatro cosas:
//   · Un toque «elegir» al cambiar de sección en la barra de abajo, de pestaña, de semana o de filtro del muro, y al
//     desplegar una fila (solo cuando cambia algo: tocar la pestaña en la que ya se está no vibra). Los interruptores,
//     casillas, «+» y «−», segmentos y chips ya tienen el suyo en pulido.js: aquí no se repiten.
//   · El botón que ha estado guardando (data-guardando, de pulido.js) enseña un «hecho» (data-hecho) un momento al
//     terminar, sin cambiar de tamaño: el dibujo es de diseno.css (bloque 57).
//   · Un campo que pasa a inválido (aria-invalid) tiembla una vez (data-tiembla, bloque 58) y da el toque «aviso».
//   · Los deslizadores (input[type="range"]) llevan en --v cuánto están llenos, para pintar la pista (bloque 60).
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
    d.removeEventListener('input', alDeslizar, { capture: true });
    mirador?.disconnect();
    for (const t of sinHecho.values()) clearTimeout(t);
  };
}
