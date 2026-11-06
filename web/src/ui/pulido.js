// Pulido: pequeños comportamientos de toda la app para que responda mejor al dedo. Se instalan una vez al arrancar
// (main.jsx). Los estilos van en pulido.css.

import { instalarAtras } from './atras.js';
import { vibrar } from './hapticos.js';

// Lo que da un toque háptico al tocarlo (además de lo que ya lo daba: las series, el teclado de la app, los récords):
// interruptores, casillas, «+» y «−», grupos de opciones y «Revisado»
const CON_TOQUE = 'input.interruptor, [role="switch"], .casilla-redonda, .paso > button, .segmentos button, .si-casi-no button, .si-no button, .selector-chips button, .revisar-hecho';

let instalado = false;

export function instalarPulido(d = typeof document !== 'undefined' ? document : null) {
  if (!d || instalado) return;
  instalado = true;
  // En iPhone, lo pulsable solo enseña su estado «pulsado» (:active) si la página escucha los toques: con este oyente
  // vacío basta. Pasivo: no frena el scroll.
  d.addEventListener('touchstart', () => {}, { passive: true });
  // El botón «atrás» cierra lo último que se abrió en vez de sacar de la app (atras.js)
  instalarAtras();
  // Un toque háptico al tocar los controles de cada día (hapticos.js; con su ajuste)
  d.addEventListener('click', (e) => {
    const el = e.target?.closest?.(CON_TOQUE);
    if (el && !el.disabled && el.getAttribute('aria-disabled') !== 'true') vibrar('toque');
  }, { passive: true, capture: true });
}
