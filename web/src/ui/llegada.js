// (diseño, tanda 16) La carga que se funde. Cuando lo que se estaba cargando llega (se quita un esqueleto de <Siluetas> o
// el hueco de una <Reserva> que aún no tenía nada), lo que ocupa su sitio no aparece de golpe: se funde, y si son
// varias piezas, una detrás de otra. Aquí solo se marca lo recién llegado (la clase «llega» y su orden, --orden); el
// fundido es de diseno.css (bloque 30) y solo cambia la opacidad: no mueve nada de sitio. Con «reducir movimiento»,
// nada. No toca ni <Siluetas> ni <Reserva>: mira el DOM.
import { sinMovimiento } from './transiciones.js';

const MAX_ORDEN = 5;
// (una <Reserva> no tiene caja —display: contents—: lo que se funde son sus hijos)
const sinEnvolturas = (els) => els.flatMap((el) => (el instanceof HTMLElement && el.classList.contains('reserva') ? sinEnvolturas([...el.children]) : [el]));
const marcar = (piezas) => {
  let i = 0;
  for (const el of sinEnvolturas(piezas)) {
    if (!(el instanceof HTMLElement) || el.classList.contains('siluetas') || el.classList.contains('reserva-hueco')) continue;
    el.style.setProperty('--orden', String(Math.min(i++, MAX_ORDEN)));
    el.classList.add('llega');
  }
};
// Si llega una sola caja sin fondo propio que apila varias piezas (una pila de tarjetas), el escalón va por dentro
const piezasDe = (nodos) => {
  const els = nodos.filter((n) => n instanceof HTMLElement);
  if (els.length === 1 && els[0].children.length > 1 && !els[0].matches('.panel, .tarjeta, table, ul, ol, dl, p, form, button, a')) return [...els[0].children];
  return els;
};

export function instalarLlegada() {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
  new MutationObserver((cambios) => {
    if (sinMovimiento()) return;
    const llegados = new Map();   // contenedor → nodos que han entrado en esta tanda
    const conEsqueleto = new Set();
    for (const c of cambios) {
      if (c.type === 'attributes') {
        // el hueco de una Reserva deja de ser una silueta entera: lo demás de la Reserva es lo que ha llegado
        if (c.oldValue === 'entero' && !c.target.dataset.hueco && c.target.parentElement) marcar(piezasDe([...c.target.parentElement.children].filter((e) => e !== c.target)));
        continue;
      }
      for (const n of c.removedNodes) if (n instanceof HTMLElement && n.classList.contains('siluetas')) conEsqueleto.add(c.target);
      if (c.addedNodes.length) llegados.set(c.target, [...(llegados.get(c.target) || []), ...c.addedNodes]);
    }
    for (const caja of conEsqueleto) marcar(piezasDe((llegados.get(caja) || []).filter((n) => n.isConnected)));
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-hueco'], attributeOldValue: true });
}
