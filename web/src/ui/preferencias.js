// Preferencias de este móvil (comodidades: pistas vistas, hitos celebrados, el lugar de entreno…), en localStorage. v0.52
// (revisión): si el navegador no deja guardar (bloqueado o lleno), se recuerda mientras la app está abierta, como en
// Comunidad: así un hito de la racha o una pista no vuelven a salir al cambiar de pestaña.
const enMemoria = new Map();

export function leerPreferencia(clave, inicial) {
  try { const x = localStorage.getItem(clave); if (x != null) return JSON.parse(x); } catch { /* sin almacenamiento o ilegible */ }
  return enMemoria.has(clave) ? enMemoria.get(clave) : inicial;
}
export function guardarPreferencia(clave, valor) {
  enMemoria.set(clave, valor);
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* queda en memoria */ }
}
