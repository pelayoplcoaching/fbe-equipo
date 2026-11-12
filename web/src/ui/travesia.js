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
const manadas = new Map();   // atletaId → { t, datos }
// (lo de la base se trae como mucho cada 5 minutos, salvo que se acabe de subir algo: volver a Hoy no pide nada)
const traido = new Map();   // atletaId → { t, semanas }
const CADA = 5 * 60000;
export async function sincronizarTravesia(api, atletaId, { traer = false } = {}) {
  if (!api || !atletaId) return { travesia: leerTravesia(atletaId), semanas: null };
  if (!subiendo.has(atletaId)) {
    subiendo.add(atletaId);
    try {
      for (let i = 0; i < 4; i++) {
        const envio = porSubir(leerTravesia(atletaId));
        if (!envio || !(await api.sumarTravesia?.(envio))) break;
        guardar(atletaId, trasSubir(leerTravesia(atletaId), envio));
        traido.delete(atletaId);
        manadas.delete(atletaId);   // (tanda 3) y la clasificación, que ya cuenta lo subido
      }
    } catch { /* se reintenta otra vez */ } finally { subiendo.delete(atletaId); }
  }
  let semanas = null;
  const antes = traido.get(atletaId);
  if (traer && antes && Date.now() - antes.t < CADA) semanas = antes.semanas;
  else if (traer) {
    try { semanas = await api.travesiaDe?.(atletaId); if (Array.isArray(semanas)) traido.set(atletaId, { t: Date.now(), semanas }); if (Array.isArray(semanas)) { const antes = leerTravesia(atletaId), junto = conBase(antes, semanas); if (JSON.stringify(junto) !== JSON.stringify(antes)) guardar(atletaId, junto); } } catch { semanas = null; }
  }
  return { travesia: leerTravesia(atletaId), semanas: Array.isArray(semanas) ? semanas : null };
}

// (tanda 3, migración 061) La manada: la clasificación de la semana y lo del equipo en el mes. Se pide como mucho cada
// 5 minutos (o al subir algo); fuera de la comunidad, sin red o sin la 061, null.
export async function manadaDe(api, atletaId, { fresca = false } = {}) {
  if (!api?.travesiaManada || !atletaId) return null;
  const antes = manadas.get(atletaId);
  if (!fresca && antes && Date.now() - antes.t < CADA) return antes.datos;
  let datos = null;
  try { datos = await api.travesiaManada(); } catch { datos = null; }
  if (datos && !Array.isArray(datos.filas)) datos = null;
  manadas.set(atletaId, { t: Date.now(), datos });
  return datos;
}
// La que ya se tiene (sin pedir nada): para pintar a quien corre hoy nada más abrir el juego
export const manadaGuardada = (atletaId) => manadas.get(atletaId)?.datos || null;

// El duelo de la semana: a quién ha retado (se guarda en el móvil, con su lunes: la semana siguiente ya no vale)
const claveDuelo = (atletaId) => `fbe-travesia-duelo-${atletaId}`;
const duelos = new Map();
export function leerDuelo(atletaId, lunes) {
  let d = duelos.get(atletaId) || null;
  if (!d) { try { d = JSON.parse(localStorage.getItem(claveDuelo(atletaId)) || 'null'); } catch { d = null; } }
  return d && d.semana === lunes && typeof d.rival === 'string' && d.rival.length <= 60 ? d.rival : '';
}
export function guardarDuelo(atletaId, rival, lunes) {
  const d = rival ? { rival: String(rival).slice(0, 60), semana: lunes } : null;
  duelos.set(atletaId, d);
  try { if (d) localStorage.setItem(claveDuelo(atletaId), JSON.stringify(d)); else localStorage.removeItem(claveDuelo(atletaId)); } catch { /* queda en memoria */ }
  return d?.rival || '';
}
