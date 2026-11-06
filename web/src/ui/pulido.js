// Pulido: pequeños comportamientos de toda la app para que responda mejor al dedo. Se instalan una vez al arrancar
// (main.jsx). Los estilos van en pulido.css.

import { instalarAtras } from './atras.js';
import { vibrar } from './hapticos.js';
import { instalarTirar } from './tirar.js';

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
  // Tirar para recargar en las pantallas de consulta (tirar.js)
  instalarTirar(d);
  // (pulido 8) Al entrar en un campo de números que ya tiene algo, se selecciona: lo que se teclea lo sustituye (como
  // en la sesión y en los «+» y «−», que ya lo hacían). Un segundo toque coloca el cursor donde se quiera.
  d.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!el || el.tagName !== 'INPUT' || el.readOnly || el.disabled || !el.value) return;
    const modo = el.getAttribute('inputmode');
    if (!(el.type === 'number' || modo === 'decimal' || modo === 'numeric') || el.getAttribute('autocomplete') === 'one-time-code') return;
    // (tras el toque: en el iPhone, el propio toque deja el cursor donde cayó y desharía la selección)
    setTimeout(() => { if (d.activeElement === el) { try { el.select(); } catch { /* */ } } }, 0);
  });
  // Un toque háptico al tocar los controles de cada día (hapticos.js; con su ajuste)
  d.addEventListener('click', (e) => {
    const el = e.target?.closest?.(CON_TOQUE);
    if (el && !el.disabled && el.getAttribute('aria-disabled') !== 'true') vibrar('toque');
  }, { passive: true, capture: true });
}
