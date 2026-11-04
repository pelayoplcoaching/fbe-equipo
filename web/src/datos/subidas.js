// v0.61 (20): los vídeos que se están subiendo, para la píldora que lo enseña fuera de la hoja de enviar (en cualquier
// pantalla) y, al acabar, un aviso del propio móvil si la app está en segundo plano. Solo en memoria (si la página se cierra,
// lo que quedaba se sigue por donde iba con la cola de pendientes, que está en IndexedDB).
// (revisión L3) Puede haber más de uno a la vez (uno que sigue en segundo plano y el siguiente, o la cola de pendientes):
// uno por id, y la píldora se va solo cuando han acabado todos.
// El aviso al acabar, solo si este móvil ya tiene el permiso de notificaciones y las notificaciones de la app activadas en
// él (las mismas que dan permiso a las de tu coach), sin ningún texto tuyo: solo «Vídeo enviado».
import { avisosActivosAqui } from './push.js';

const activas = new Map(); // id → { id, progreso }
const oyentes = new Set();
let foto = null;
const avisar = () => { foto = resumirSubidas([...activas.values()]); for (const f of oyentes) f(foto); };

// { n, progreso } de las que están en marcha (el progreso, la media), o null si no hay ninguna (sin pantalla: se prueba)
export function resumirSubidas(lista = []) {
  if (!lista.length) return null;
  return { n: lista.length, progreso: lista.reduce((t, x) => t + (Number(x.progreso) || 0), 0) / lista.length };
}
export function subidaEmpieza(id) { activas.set(id, { id, progreso: 0 }); avisar(); }
export function subidaProgreso(id, x) {
  const p = Math.max(0, Math.min(1, Number(x) || 0));
  const antes = activas.get(id);
  if (antes && Math.abs(p - antes.progreso) < 0.01) return;
  activas.set(id, { id, progreso: p });
  avisar();
}
export function subidaAcaba(id, { ok = false } = {}) {
  if (activas.delete(id)) avisar();
  if (ok) avisoLocal().catch(() => {});
}
export const subidaActual = () => foto;
export function alCambiarSubida(f) { oyentes.add(f); return () => oyentes.delete(f); }

// Con la app en segundo plano (pantalla bloqueada o en otra app), un aviso del móvil al terminar. Si la app está a la vista,
// ya sale su aviso de siempre. En el iPhone, con la app suspendida no corre nada, así que tampoco este aviso.
export async function avisoLocal({ forzar = false } = {}) {
  if (typeof document === 'undefined' || typeof Notification === 'undefined') return false;
  if (!forzar && document.visibilityState === 'visible') return false;
  if (Notification.permission !== 'granted' || !avisosActivosAqui()) return false;
  const reg = await navigator.serviceWorker?.getRegistration?.();
  if (!reg?.showNotification) return false;
  // (revisión L2) sin nada más: lo que dice la política
  await reg.showNotification('Vídeo enviado', { tag: 'fbe-subida', icon: 'icono-192.png', badge: 'insignia-96.png', lang: 'es', data: { url: new URL('./#hoy', reg.scope).href } });
  return true;
}
