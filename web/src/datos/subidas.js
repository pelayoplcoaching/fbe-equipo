// v0.61 (20): el vídeo que se está subiendo, para la píldora que lo enseña fuera de la hoja de enviar (en cualquier
// pantalla) y, al acabar, un aviso del propio móvil si la app está en segundo plano. Solo en memoria (si la página se cierra,
// lo que quedaba se sigue por donde iba con la cola de pendientes, que está en IndexedDB).
// El aviso al acabar, solo si este móvil ya tiene el permiso de notificaciones y las notificaciones de la app activadas en
// él (las mismas que dan permiso a las de tu coach), sin ningún texto tuyo: «Vídeo enviado».
import { avisosActivosAqui } from './push.js';

let actual = null; // { id, progreso, estado: 'subiendo' | 'esperando', motivo, nombre }
const oyentes = new Set();
const avisar = () => { for (const f of oyentes) f(actual); };

export function subidaEmpieza(id, { nombre = 'Vídeo' } = {}) { actual = { id, progreso: 0, estado: 'subiendo', motivo: null, nombre }; avisar(); }
export function subidaProgreso(id, x) {
  if (!actual || actual.id !== id) { actual = { id, progreso: 0, estado: 'subiendo', motivo: null, nombre: 'Vídeo' }; }
  const p = Math.max(0, Math.min(1, Number(x) || 0));
  if (Math.abs(p - actual.progreso) < 0.01 && actual.estado === 'subiendo') return;
  actual = { ...actual, progreso: p, estado: 'subiendo' };
  avisar();
}
export function subidaAcaba(id, { ok = false } = {}) {
  if (actual && actual.id === id) { actual = null; avisar(); }
  if (ok) avisoLocal().catch(() => {});
}
export const subidaActual = () => actual;
export function alCambiarSubida(f) { oyentes.add(f); return () => oyentes.delete(f); }

// Con la app en segundo plano (pantalla bloqueada o en otra app), un aviso del móvil al terminar. Si la app está a la vista,
// ya sale su aviso de siempre. En el iPhone, con la app suspendida no corre nada, así que tampoco este aviso.
export async function avisoLocal({ forzar = false } = {}) {
  if (typeof document === 'undefined' || typeof Notification === 'undefined') return false;
  if (!forzar && document.visibilityState === 'visible') return false;
  if (Notification.permission !== 'granted' || !avisosActivosAqui()) return false;
  const reg = await navigator.serviceWorker?.getRegistration?.();
  if (!reg?.showNotification) return false;
  await reg.showNotification('Vídeo enviado', { body: 'Ya le ha llegado a tu coach.', tag: 'fbe-subida', icon: 'icono-192.png', badge: 'insignia-96.png', lang: 'es', data: { url: new URL('./#hoy', reg.scope).href } });
  return true;
}
