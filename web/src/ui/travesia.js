// «La travesía» (el juego del descanso): lo que se recuerda en este móvil, en `fbe-travesia-<atletaId>`: los metros y
// las estrellas de cada sesión, el total y la mejor marca (logica/travesia.js). Si el navegador no deja guardar, se
// recuerda mientras la app está abierta, como en descansos.js.
import { limpiarTravesia, sumarEtapa, porSubir, trasSubir, conBase } from '../logica/travesia.js';

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

const guardar = (atletaId, t) => { enMemoria.set(atletaId, t); try { localStorage.setItem(clave(atletaId), JSON.stringify(t)); } catch { /* queda en memoria */ } return t; };

// (060) Sube a la base lo jugado que aún no se ha subido (si no se puede, se queda pendiente y se reintenta la próxima
// vez). Con `traer`, además lee lo que hay en la base y lo junta con lo del móvil. Devuelve lo que queda guardado y, si
// se han traído, las semanas de la base. Nunca falla: sin red o sin la 060, todo sigue en el móvil.
const subiendo = new Set();
export async function sincronizarTravesia(api, atletaId, { traer = false } = {}) {
  if (!api || !atletaId) return { travesia: leerTravesia(atletaId), semanas: null };
  if (!subiendo.has(atletaId)) {
    subiendo.add(atletaId);
    try {
      for (let i = 0; i < 4; i++) {
        const envio = porSubir(leerTravesia(atletaId));
        if (!envio || !(await api.sumarTravesia?.(envio))) break;
        guardar(atletaId, trasSubir(leerTravesia(atletaId), envio));
      }
    } catch { /* se reintenta otra vez */ } finally { subiendo.delete(atletaId); }
  }
  let semanas = null;
  if (traer) {
    try { semanas = await api.travesiaDe?.(atletaId); if (Array.isArray(semanas)) { const antes = leerTravesia(atletaId), junto = conBase(antes, semanas); if (JSON.stringify(junto) !== JSON.stringify(antes)) guardar(atletaId, junto); } } catch { semanas = null; }
  }
  return { travesia: leerTravesia(atletaId), semanas: Array.isArray(semanas) ? semanas : null };
}
