// «Apuntes» (formación en los descansos): lo que el atleta ha visto, en este móvil, en `fbe-apuntes-<atletaId>`
// (logica/apuntes.js). Si el navegador no deja guardar, se recuerda mientras la app está abierta.
import { limpiarVistos, apuntarVisto } from '../logica/apuntes.js';

const enMemoria = new Map();
const clave = (atletaId) => `fbe-apuntes-${atletaId}`;

export function leerApuntes(atletaId) {
  if (enMemoria.has(atletaId)) return limpiarVistos(enMemoria.get(atletaId));
  let guardado = null;
  try { const t = localStorage.getItem(clave(atletaId)); if (t) guardado = JSON.parse(t); } catch { /* sin almacenamiento o ilegible */ }
  return limpiarVistos(guardado);
}

// Apunta uno como visto (sabia: true o false si le dio la vuelta y contestó) y devuelve lo que queda guardado
export function guardarVisto(atletaId, id, hoy, sabia = null) {
  const e = apuntarVisto(leerApuntes(atletaId), id, hoy, sabia);
  enMemoria.set(atletaId, e);
  try { localStorage.setItem(clave(atletaId), JSON.stringify(e)); } catch { /* queda en memoria */ }
  return e;
}
