// «Apuntes» (formación en los descansos): lo que el atleta ha visto, en este móvil, en `fbe-apuntes-<atletaId>`
// (logica/apuntes.js). Si el navegador no deja guardar, se recuerda mientras la app está abierta.
import { limpiarVistos, apuntarVisto, pendienteDeSubir, conServidor } from '../logica/apuntes.js';

const enMemoria = new Map();
const soloMemoria = new Set();   // (v0.148) los que no se han podido guardar en el navegador: ahí manda la memoria
const clave = (atletaId) => `fbe-apuntes-${atletaId}`;

// Lo guardado en el navegador manda (otra pestaña puede haberlo cambiado); la memoria, solo si el navegador no deja
export function leerApuntes(atletaId) {
  if (soloMemoria.has(atletaId) && enMemoria.has(atletaId)) return limpiarVistos(enMemoria.get(atletaId));
  try { const t = localStorage.getItem(clave(atletaId)); return limpiarVistos(t ? JSON.parse(t) : enMemoria.get(atletaId) ?? null); } catch { /* sin almacenamiento o ilegible */ }
  return limpiarVistos(enMemoria.get(atletaId) ?? null);
}

const guardar = (atletaId, e) => {
  enMemoria.set(atletaId, e);
  try { localStorage.setItem(clave(atletaId), JSON.stringify(e)); soloMemoria.delete(atletaId); } catch { soloMemoria.add(atletaId); /* queda en memoria */ }
  return e;
};
// Ya subido (o la base no lo admite): fuera de la cola, salvo que mientras tanto haya cambiado (entonces se sube eso)
function quitarDeLaCola(atletaId, id, valor) {
  const e = leerApuntes(atletaId);
  if (e.porSubir && id in e.porSubir && e.porSubir[id] === valor) guardar(atletaId, pendienteDeSubir(e, id, null, true));
}

// Apunta uno como visto (sabia: true o false si le dio la vuelta y contestó) y devuelve lo que queda guardado. Con `api`
// (060) lo sube también a la base; si no se puede (sin red), queda pendiente y se reintenta al sincronizar.
export function guardarVisto(atletaId, id, hoy, sabia = null, api = null) {
  let e = apuntarVisto(leerApuntes(atletaId), id, hoy, sabia);
  if (api?.apuntarApunte) {
    e = pendienteDeSubir(e, id, sabia);
    const valor = e.porSubir?.[id];
    // (se sube lo que queda en cola: si antes contestó y esta vez no, se sube lo que contestó)
    if (valor !== undefined) api.apuntarApunte(id, valor).then((r) => { if (r) quitarDeLaCola(atletaId, id, valor); }).catch(() => {});
  }
  return guardar(atletaId, e);
}

const traido = new Map();   // atletaId → cuándo se trajo lo de la base
const CADA = 5 * 60000;
// (060) Reintenta lo pendiente y junta lo del móvil con lo que hay en la base (otro móvil). Nunca falla.
export async function sincronizarApuntes(api, atletaId) {
  if (!api || !atletaId) return leerApuntes(atletaId);
  try {
    // (uno que la base no admite, 'rechazado', sale de la cola y se sigue; sin red, se para y se reintenta otra vez)
    for (const [id, sabia] of Object.entries(leerApuntes(atletaId).porSubir || {}).slice(0, 40)) {
      const r = await api.apuntarApunte?.(id, sabia);
      if (!r) break;
      quitarDeLaCola(atletaId, id, sabia);
    }
    // (lo de la base se trae como mucho cada 5 minutos: volver a Hoy no pide nada)
    if (Date.now() - (traido.get(atletaId) || 0) < CADA) return leerApuntes(atletaId);
    const filas = await api.apuntesVistos?.(atletaId);
    traido.set(atletaId, Date.now());
    if (Array.isArray(filas) && filas.length) { const antes = leerApuntes(atletaId), junto = conServidor(antes, filas); if (JSON.stringify(junto) !== JSON.stringify(antes)) guardar(atletaId, junto); }
  } catch { /* otra vez será */ }
  return leerApuntes(atletaId);
}
