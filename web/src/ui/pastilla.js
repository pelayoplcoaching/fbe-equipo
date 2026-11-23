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

// (v0.212, rendimiento) Medir (offsetLeft, offsetWidth…) obliga al navegador a colocar la página en ese momento. Antes se
// medía en cuanto cambiaba el DOM (en el MutationObserver) y cada grupo medía y escribía por su cuenta: al abrir la ficha
// de un atleta, eso recolocaba la ficha entera antes de tiempo (unos 120 ms con el móvil lento). Ahora se mide en el
// fotograma siguiente (antes de pintarlo: no se ve ningún salto) y en dos pasadas: primero se mide todo y luego se escribe.
function medir(g) {
  if (!g.isConnected) { grupos.delete(g); mirador?.unobserve(g); return null; }
  if (g.matches(RAYA)) {
    const b = g.querySelector(':scope > [role="tab"][aria-selected="true"]');
    return { g, raya: true, b: b && b.offsetWidth ? { x: b.offsetLeft, w: b.offsetWidth } : null };
  }
  const elegidas = g.querySelectorAll(':scope > button[aria-pressed="true"]');
  const b = elegidas.length === 1 ? elegidas[0] : null;
  return { g, raya: false, b: b && b.offsetWidth ? { x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight } : null };
}
function aplicar({ g, raya, b }) {
  const marca = raya ? 'raya' : 'pastilla';
  if (!b) { if (g.dataset[marca] != null) { delete g.dataset[marca]; delete g.dataset.lista; } return; }
  if (raya) {
    g.style.setProperty('--raya-x', `${b.x}px`);
    g.style.setProperty('--raya-w', `${b.w}px`);
  } else {
    g.style.setProperty('--seg-x', `${b.x}px`);
    g.style.setProperty('--seg-y', `${b.y}px`);
    g.style.setProperty('--seg-w', `${b.w}px`);
    g.style.setProperty('--seg-h', `${b.h}px`);
  }
  if (g.dataset[marca] == null) {
    g.dataset[marca] = '';
    // (la primera vez se coloca sin deslizarse; a partir del siguiente fotograma, ya con movimiento)
    requestAnimationFrame(() => requestAnimationFrame(() => { if (g.dataset[marca] != null) g.dataset.lista = ''; }));
  }
}
function colocar(gs) {
  const medidas = [];
  for (const g of gs) { const m = medir(g); if (m) medidas.push(m); }
  for (const m of medidas) aplicar(m);
}
const pendientes = new Set();
let pedido = 0;
function apuntar(g) {
  if (!grupos.has(g)) { grupos.add(g); mirador?.observe(g); }
  pendientes.add(g);
  if (pedido) return;
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f) => setTimeout(f, 16);
  pedido = raf(() => { pedido = 0; const gs = [...pendientes]; pendientes.clear(); colocar(gs); });
}

export function instalarPastilla() {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
  if (typeof ResizeObserver !== 'undefined') mirador = new ResizeObserver((es) => colocar(es.map((e) => e.target)));
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
    // (v0.207) Los grupos que han salido de la página, fuera de la lista y del medidor: si no, cada visita a una pantalla
    // con segmentos (Progreso, con sus gráficas) dejaba su árbol entero vivo en memoria (unos 700 KB por visita; lo vio
    // la prueba de uso largo). El medidor no avisa de lo que se quita.
    if (cambios.some((c) => c.removedNodes?.length)) for (const g of grupos) if (!g.isConnected) { grupos.delete(g); mirador?.unobserve(g); }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-selected'] });
  for (const g of document.querySelectorAll(TODO)) apuntar(g);
}
