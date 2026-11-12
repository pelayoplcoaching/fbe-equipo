// «Apuntes» (formación en los descansos): lo que el atleta ha visto, en este móvil, en `fbe-apuntes-<atletaId>`
// (logica/apuntes.js). Si el navegador no deja guardar, se recuerda mientras la app está abierta.
import { limpiarVistos, apuntarVisto, pendienteDeSubir, conServidor } from '../logica/apuntes.js';

const enMemoria = new Map();
const clave = (atletaId) => `fbe-apuntes-${atletaId}`;

export function leerApuntes(atletaId) {
  if (enMemoria.has(atletaId)) return limpiarVistos(enMemoria.get(atletaId));
  let guardado = null;
  try { const t = localStorage.getItem(clave(atletaId)); if (t) guardado = JSON.parse(t); } catch { /* sin almacenamiento o ilegible */ }
  return limpiarVistos(guardado);
}

const SUBIBLE = /^[peimn]:[A-Za-z0-9:_-]{1,78}$/;
const guardar = (atletaId, e) => { enMemoria.set(atletaId, e); try { localStorage.setItem(clave(atletaId), JSON.stringify(e)); } catch { /* queda en memoria */ } return e; };

// Apunta uno como visto (sabia: true o false si le dio la vuelta y contestó) y devuelve lo que queda guardado. Con `api`
// (060) lo sube también a la base; si no se puede (sin red), queda pendiente y se reintenta al sincronizar.
export function guardarVisto(atletaId, id, hoy, sabia = null, api = null) {
  let e = apuntarVisto(leerApuntes(atletaId), id, hoy, sabia);
  // (a la base, los que su función admite: claves, errores, ideas, mitos y novedades; los demás, solo en el móvil)
  if (api?.apuntarApunte && SUBIBLE.test(id)) {
    e = pendienteDeSubir(e, id, sabia);
    api.apuntarApunte(id, sabia).then((ok) => { if (ok) guardar(atletaId, pendienteDeSubir(leerApuntes(atletaId), id, null, true)); }).catch(() => {});
  }
  return guardar(atletaId, e);
}

const traido = new Map();   // atletaId → cuándo se trajo lo de la base
const CADA = 5 * 60000;
// (060) Reintenta lo pendiente y junta lo del móvil con lo que hay en la base (otro móvil). Nunca falla.
export async function sincronizarApuntes(api, atletaId) {
  if (!api || !atletaId) return leerApuntes(atletaId);
  try {
    for (const [id, sabia] of Object.entries(leerApuntes(atletaId).porSubir || {}).slice(0, 40)) {
      if (!(await api.apuntarApunte?.(id, sabia))) break;
      guardar(atletaId, pendienteDeSubir(leerApuntes(atletaId), id, null, true));
    }
    // (lo de la base se trae como mucho cada 5 minutos: volver a Hoy no pide nada)
    if (Date.now() - (traido.get(atletaId) || 0) < CADA) return leerApuntes(atletaId);
    const filas = await api.apuntesVistos?.(atletaId);
    traido.set(atletaId, Date.now());
    if (Array.isArray(filas) && filas.length) { const antes = leerApuntes(atletaId), junto = conServidor(antes, filas); if (JSON.stringify(junto) !== JSON.stringify(antes)) guardar(atletaId, junto); }
  } catch { /* otra vez será */ }
  return leerApuntes(atletaId);
}

// (tanda 2) Guarda lo que ha cambiado sin ver nada (un apunte guardado para luego, el reto de la siguiente serie)
export const guardarEstado = (atletaId, e) => guardar(atletaId, limpiarVistos(e));
