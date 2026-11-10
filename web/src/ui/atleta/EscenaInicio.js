// (diseño, tanda 45) La escena de empezar la sesión, la pareja de la del final (EscenaFinal.jsx): al pulsar «Empezar»,
// la noche se abre desde el botón, el lobo de la marca aparece con los ojos encendidos y «A por ello» sube; un segundo
// después se levanta como un telón. No tapa nada que se pueda tocar (pointer-events: none): la sesión ya está debajo
// y se puede empezar a apuntar. Es un adorno (aria-hidden) y no sale con «reducir movimiento».
// Los estilos, en diseno.css (bloque 338).
import { LOBO_CAJA, LOBO_D } from '../lobo-trazo.js';
import { sinMovimiento } from '../transiciones.js';
import { vibrar } from '../hapticos.js';

let activa = null;
// desde: el botón que se ha pulsado (la noche se abre desde su centro)
export function lanzarEscenaInicio(desde = null) {
  if (typeof document === 'undefined' || sinMovimiento() || document.visibilityState === 'hidden') return false;
  activa?.remove();
  const r = desde?.getBoundingClientRect?.();
  const el = document.createElement('div');
  el.className = 'escena-inicio';
  el.setAttribute('aria-hidden', 'true');
  el.style.setProperty('--ox', `${Math.round(r ? r.left + r.width / 2 : window.innerWidth / 2)}px`);
  el.style.setProperty('--oy', `${Math.round(r ? r.top + r.height / 2 : window.innerHeight * 0.8)}px`);
  el.innerHTML = `<svg class="escena-inicio-lobo" viewBox="${LOBO_CAJA}" focusable="false"><path fill-rule="evenodd" d="${LOBO_D}"/>`
    + '<ellipse class="escena-inicio-ojo" cx="486" cy="560" rx="54" ry="26" transform="rotate(18 486 560)"/><ellipse class="escena-inicio-ojo" cx="768" cy="560" rx="54" ry="26" transform="rotate(-18 768 560)"/></svg>'
    + '<p class="escena-inicio-texto"><span>A por ello</span></p>';
  document.body.appendChild(el);
  activa = el;
  vibrar('hecho');
  setTimeout(() => el.classList.add('fuera'), 1000);
  setTimeout(() => { el.remove(); if (activa === el) activa = null; }, 1480);
  return true;
}
