// v0.52.2: el descanso que el atleta elige para cada ejercicio (cuando su coach no le ha puesto uno), en este móvil:
// un mapa ejercicio_id → segundos (0 = sin descanso automático) en `fbe-descansos-<atletaId>`. Vale para ese
// ejercicio en todas sus sesiones. Si el navegador no deja guardar (bloqueado o lleno), se recuerda mientras la app
// está abierta, como en preferencias.js. Lo que se lee se sanea (logica/calculos.js, limpiarDescansos).
import { limpiarDescansos, descansoValido } from '../logica/calculos.js';

const enMemoria = new Map(); // atletaId → mapa
const clave = (atletaId) => `fbe-descansos-${atletaId}`;

export function leerDescansos(atletaId) {
  if (enMemoria.has(atletaId)) return { ...enMemoria.get(atletaId) };
  let guardado = {};
  try { const t = localStorage.getItem(clave(atletaId)); if (t) guardado = JSON.parse(t); } catch { /* sin almacenamiento o ilegible */ }
  return limpiarDescansos(guardado);
}

// seg: uno de la lista, o null para volver al de por defecto. Devuelve el mapa nuevo.
export function guardarDescanso(atletaId, ejercicioId, seg) {
  const m = leerDescansos(atletaId);
  if (descansoValido(seg)) m[ejercicioId] = seg; else delete m[ejercicioId];
  enMemoria.set(atletaId, m);
  try { localStorage.setItem(clave(atletaId), JSON.stringify(m)); } catch { /* queda en memoria */ }
  return { ...m };
}
