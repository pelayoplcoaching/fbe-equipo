// (diseño, tanda 17) La pastilla de los segmentos que se desliza. En un grupo .segmentos con una sola opción elegida, la
// pastilla blanca deja de ser el fondo de cada botón y pasa a ser una sola pieza (el ::before del grupo) que se desliza
// de la opción de antes a la nueva, como el control segmentado de iOS. Aquí solo se mide dónde está la opción elegida y
// se deja en variables del grupo (--seg-x, --seg-y, --seg-w, --seg-h) y en data-pastilla; el dibujo y el movimiento son
// de diseno.css (bloque 39). No toca los componentes: mira el DOM. Sin opción elegida, con varias (los grupos de elegir
// varias) o en los de colores propios (.dolor), el grupo se queda como estaba.
const VALE = '.segmentos:not(.dolor)';
// (tanda 26) Y la raya de las pestañas subrayadas (.pestanas, no las de píldora): una sola raya (el ::after del grupo,
// diseno.css bloque 106) que viaja de la pestaña de antes a la nueva. Se mide igual: --raya-x, --raya-w y data-raya.
const RAYA = '.pestanas:not(.pestanas-sub)';
const TODO = `${VALE}, ${RAYA}`;
const grupos = new Set();
let mirador = null;

function colocarRaya(g) {
  const b = g.querySelector(':scope > [role="tab"][aria-selected="true"]');
  if (!b || !b.offsetWidth) { if (g.dataset.raya != null) { delete g.dataset.raya; delete g.dataset.lista; } return; }
  g.style.setProperty('--raya-x', `${b.offsetLeft}px`);
  g.style.setProperty('--raya-w', `${b.offsetWidth}px`);
  if (g.dataset.raya == null) {
    g.dataset.raya = '';
    requestAnimationFrame(() => requestAnimationFrame(() => { if (g.dataset.raya != null) g.dataset.lista = ''; }));
  }
}
function colocar(g) {
  if (!g.isConnected) { grupos.delete(g); mirador?.unobserve(g); return; }
  if (g.matches(RAYA)) { colocarRaya(g); return; }
  const elegidas = g.querySelectorAll(':scope > button[aria-pressed="true"]');
  const b = elegidas.length === 1 ? elegidas[0] : null;
  if (!b || !b.offsetWidth) { if (g.dataset.pastilla != null) { delete g.dataset.pastilla; delete g.dataset.lista; } return; }
  g.style.setProperty('--seg-x', `${b.offsetLeft}px`);
  g.style.setProperty('--seg-y', `${b.offsetTop}px`);
  g.style.setProperty('--seg-w', `${b.offsetWidth}px`);
  g.style.setProperty('--seg-h', `${b.offsetHeight}px`);
  if (g.dataset.pastilla == null) {
    g.dataset.pastilla = '';
    // (la primera vez se coloca sin deslizarse; a partir del siguiente fotograma, ya con movimiento)
    requestAnimationFrame(() => requestAnimationFrame(() => { if (g.dataset.pastilla != null) g.dataset.lista = ''; }));
  }
}
function apuntar(g) {
  if (!grupos.has(g)) { grupos.add(g); mirador?.observe(g); }
  colocar(g);
}

export function instalarPastilla() {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
  if (typeof ResizeObserver !== 'undefined') mirador = new ResizeObserver((es) => { for (const e of es) colocar(e.target); });
  new MutationObserver((cambios) => {
    const tocados = new Set();
    // (un nodo cuyo padre también ha entrado en esta tanda no se recorre aparte: su padre ya lo cubre)
    const entrados = new Set();
    for (const c of cambios) if (c.type === 'childList') for (const n of c.addedNodes) if (n instanceof HTMLElement) entrados.add(n);
    for (const c of cambios) {
      if (c.type === 'attributes') { const g = c.target.closest?.(TODO); if (g) tocados.add(g); continue; }
      const g0 = c.target.closest?.(TODO);
      if (g0) tocados.add(g0);
      for (const n of c.addedNodes) {
        if (!(n instanceof HTMLElement) || entrados.has(n.parentNode)) continue;
        if (n.matches(TODO)) tocados.add(n);
        for (const g of n.querySelectorAll(TODO)) tocados.add(g);
      }
    }
    for (const g of tocados) apuntar(g);
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-selected'] });
  for (const g of document.querySelectorAll(TODO)) apuntar(g);
}
