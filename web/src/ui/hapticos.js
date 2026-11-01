// Vibración al tocar (v0.49): un toque corto al marcar una serie, al batir un récord y al enviar el check-in. Con su
// propio interruptor en los ajustes del móvil (de serie, encendido) y solo donde el navegador sabe vibrar (en iPhone,
// Safari no deja: no pasa nada). No depende de «reducir movimiento»: es otra cosa.
import { leerAjustes } from './ajustes.js';

export const PATRONES = { serie: 14, record: [18, 50, 18, 50, 70], checkin: [16, 70, 32] };
export const puedeVibrar = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function vibrar(que) {
  if (!puedeVibrar() || leerAjustes().hapticos === false) return false;
  try { return navigator.vibrate(PATRONES[que] ?? que); } catch { return false; }
}
