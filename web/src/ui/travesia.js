// «La travesía» (el juego del descanso): lo que se recuerda en este móvil, en `fbe-travesia-<atletaId>`: los metros y
// las estrellas de cada sesión, el total y la mejor marca (logica/travesia.js). Si el navegador no deja guardar, se
// recuerda mientras la app está abierta, como en descansos.js.
import { limpiarTravesia, sumarEtapa } from '../logica/travesia.js';

const enMemoria = new Map();
const clave = (atletaId) => `fbe-travesia-${atletaId}`;

export function leerTravesia(atletaId) {
  if (enMemoria.has(atletaId)) return limpiarTravesia(enMemoria.get(atletaId));
  let guardado = null;
  try { const t = localStorage.getItem(clave(atletaId)); if (t) guardado = JSON.parse(t); } catch { /* sin almacenamiento o ilegible */ }
  return limpiarTravesia(guardado);
}

// Apunta una etapa (con sesión cuenta para la travesía; sin ella es práctica) y devuelve lo que queda guardado
export function apuntarEtapa(atletaId, etapa) {
  const t = sumarEtapa(leerTravesia(atletaId), etapa);
  enMemoria.set(atletaId, t);
  try { localStorage.setItem(clave(atletaId), JSON.stringify(t)); } catch { /* queda en memoria */ }
  return t;
}
