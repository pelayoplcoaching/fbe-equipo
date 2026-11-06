// Vibración al tocar (v0.49): un toque corto al marcar una serie, al batir un récord y al enviar el check-in. Con su
// propio interruptor en los ajustes del móvil (de serie, encendido) y solo donde el navegador sabe vibrar (en iPhone,
// Safari no deja; ver más abajo lo que se intenta). No depende de «reducir movimiento»: es otra cosa.
// Pulido 6: también al cambiar un interruptor, marcar una casilla, sumar o restar con «+» y «−», elegir en un grupo de
// opciones y cuando algo falla (se reparte desde pulido.js, sin tocar cada pantalla).
import { leerAjustes } from './ajustes.js';

// toque (v0.55): el más suave, al deslizar una burbuja hasta responder y al mantener pulsado un mensaje
// error (pulido 6): dos golpes secos, cuando algo no se ha podido hacer
export const PATRONES = { toque: 8, serie: 14, record: [18, 50, 18, 50, 70], checkin: [16, 70, 32], anillo: [22, 60, 22, 60, 48], error: [28, 60, 28] };
export const puedeVibrar = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

// (pulido 6) En iPhone, Safari no deja vibrar a las webs (no hay navigator.vibrate). Desde iOS 17.4 hay un resquicio
// no oficial: un interruptor del sistema (<input type="checkbox" switch>) da un toque háptico al cambiar, también si
// lo cambia su etiqueta por código dentro de un toque de la persona. Se usa uno suelto, que no se ve ni se lee, solo
// para eso: un único toque (no hay patrones) y solo donde el navegador conoce ese interruptor. Si Apple lo cierra,
// no pasa nada: no vibra y ya está.
const esIphone = () => {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent || '') || (/Macintosh/.test(navigator.userAgent || '') && (navigator.maxTouchPoints || 0) > 1);
};
let conInterruptor = null;
export const puedeTocarIphone = () => {
  if (conInterruptor == null) {
    try { conInterruptor = esIphone() && typeof document !== 'undefined' && 'switch' in document.createElement('input'); } catch { conInterruptor = false; }
  }
  return conInterruptor;
};
// ¿Puede dar un toque al tocar? (con vibración de verdad o con el resquicio del iPhone)
export const puedeTocar = () => puedeVibrar() || puedeTocarIphone();

function toqueIphone() {
  try {
    const etiqueta = document.createElement('label');
    etiqueta.setAttribute('aria-hidden', 'true');
    etiqueta.style.display = 'none';
    const interruptor = document.createElement('input');
    interruptor.type = 'checkbox';
    interruptor.setAttribute('switch', '');
    etiqueta.appendChild(interruptor);
    // (su clic no sale de aquí: nada de la app tiene que enterarse)
    etiqueta.addEventListener('click', (e) => e.stopPropagation());
    document.head.appendChild(etiqueta);
    etiqueta.click();
    etiqueta.remove();
    return true;
  } catch { return false; }
}

export function vibrar(que) {
  if (leerAjustes().hapticos === false) return false;
  if (puedeVibrar()) { try { return navigator.vibrate(PATRONES[que] ?? que); } catch { return false; } }
  if (puedeTocarIphone()) return toqueIphone();
  return false;
}
