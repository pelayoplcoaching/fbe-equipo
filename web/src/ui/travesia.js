// «La travesía» (el juego del descanso): lo que se recuerda en este móvil, en `fbe-travesia-<atletaId>`: los metros y
// las estrellas de cada sesión, el total y la mejor marca (logica/travesia.js). Si el navegador no deja guardar, se
// recuerda mientras la app está abierta, como en descansos.js.
import { limpiarTravesia, sumarEtapa, prepararEnvio, trasSubir, conBase } from '../logica/travesia.js';
import { limpiarMeta, sumarMeta } from '../logica/travesia-meta.js';
import { ETAPA_DIA } from '../logica/travesia.js';

const enMemoria = new Map();
const soloMemoria = new Set();   // (v0.148) los que no se han podido guardar en el navegador: ahí manda la memoria
const clave = (atletaId) => `fbe-travesia-${atletaId}`;

// Lo guardado en el navegador manda (otra pestaña puede haberlo cambiado); la memoria, solo si el navegador no deja
export function leerTravesia(atletaId) {
  if (soloMemoria.has(atletaId) && enMemoria.has(atletaId)) return limpiarTravesia(enMemoria.get(atletaId));
  try { const t = localStorage.getItem(clave(atletaId)); return limpiarTravesia(t ? JSON.parse(t) : enMemoria.get(atletaId) ?? null); } catch { /* sin almacenamiento o ilegible */ }
  return limpiarTravesia(enMemoria.get(atletaId) ?? null);
}

const guardar = (atletaId, t) => {
  enMemoria.set(atletaId, t);
  try { localStorage.setItem(clave(atletaId), JSON.stringify(t)); soloMemoria.delete(atletaId); } catch { soloMemoria.add(atletaId); /* queda en memoria */ }
  return t;
};
// Un identificador para cada envío (uuid)
export function nuevoIdEnvio() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch { /* sigue */ }
  const b = new Uint8Array(16);
  try { crypto.getRandomValues(b); } catch { for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Apunta una etapa (con sesión cuenta para la travesía; sin ella es práctica) y devuelve lo que queda guardado
export function apuntarEtapa(atletaId, etapa) {
  return guardar(atletaId, sumarEtapa(leerTravesia(atletaId), etapa));
}

// (060) Sube a la base lo jugado que aún no se ha subido (si no se puede, se queda pendiente y se reintenta la próxima
// vez). Con `traer`, además lee lo que hay en la base y lo junta con lo del móvil. Devuelve lo que queda guardado y, si
// se han traído, las semanas de la base. Nunca falla: sin red o sin la 060, todo sigue en el móvil. Cada envío lleva su
// identificador y se guarda antes de mandarlo: si la respuesta se pierde, se repite el mismo y la base no lo suma dos veces.
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
        let t = leerTravesia(atletaId);
        if (!t.envio) { t = prepararEnvio(t, nuevoIdEnvio()); if (!t.envio) break; guardar(atletaId, t); }
        const envio = t.envio;
        if (!(await api.sumarTravesia?.(envio))) break;
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
    try {
      semanas = await api.travesiaDe?.(atletaId);
      if (Array.isArray(semanas)) traido.set(atletaId, { t: Date.now(), semanas });
      // (con un envío sin confirmar no se junta: quizá ya está en la base y se contaría dos veces)
      const antes = leerTravesia(atletaId);
      if (Array.isArray(semanas) && !antes.envio) { const junto = conBase(antes, semanas); if (JSON.stringify(junto) !== JSON.stringify(antes)) guardar(atletaId, junto); }
    } catch { semanas = null; }
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

// ---------- (top, tanda 3) Misiones, rango y logros, en `fbe-juego-meta-<atletaId>` ----------
const memMeta = new Map();
const claveMeta = (atletaId) => `fbe-juego-meta-${atletaId}`;
export function leerMeta(atletaId) {
  try { const t = localStorage.getItem(claveMeta(atletaId)); if (t) return limpiarMeta(JSON.parse(t)); } catch { /* sin almacenamiento o ilegible */ }
  return limpiarMeta(memMeta.get(atletaId) ?? null);
}
export function guardarMeta(atletaId, m) {
  const v = limpiarMeta(m);
  memMeta.set(atletaId, v);
  try { localStorage.setItem(claveMeta(atletaId), JSON.stringify(v)); } catch { /* queda en memoria */ }
  return v;
}
// Suma una etapa de una sesión a las misiones y los logros; devuelve lo que trae (cumplidas, rango nuevo, adorno, logros)
export function apuntarMeta(atletaId, resultado, total, ctx) {
  const r = sumarMeta(leerMeta(atletaId), resultado, total, ctx);
  guardarMeta(atletaId, r.meta);
  return r;
}

// (top, tanda 4) Sube el rango, las misiones y los logros a la base (062) y se queda con lo que diga ella (lo del móvil
// junto con lo de otros móviles). Sin red o sin la 062, se queda lo del móvil. Devuelve lo que queda guardado.
export async function sincronizarMeta(api, atletaId) {
  const local = leerMeta(atletaId);
  const base = await api?.guardarPerfilTravesia?.(local).catch?.(() => null);
  if (!base) return local;
  // (si mientras subía se ha sumado otra etapa en este móvil, manda la que vaya más avanzada)
  const ahora = leerMeta(atletaId), b = limpiarMeta(base);
  return guardarMeta(atletaId, ahora.rango > b.rango || (ahora.rango === b.rango && ahora.hechas > b.hechas) ? ahora : { ...b, logros: { ...ahora.logros, ...b.logros } });
}

// ---------- (top, tanda 4) La etapa del día, en el móvil: los intentos de hoy y el mejor ----------
const claveDia = (atletaId) => `fbe-juego-dia-${atletaId}`;
export function leerDia(atletaId, dia) {
  try { const d = JSON.parse(localStorage.getItem(claveDia(atletaId)) || 'null'); if (d?.dia === dia) return { dia, intentos: Math.min(ETAPA_DIA.intentos, Math.max(0, d.intentos | 0)), mejor: Math.max(0, d.mejor | 0) }; } catch { /* */ }
  return { dia, intentos: 0, mejor: 0 };
}
// El intento cuenta al empezar (cerrar a medias no da otro); al acabar, se queda con el mejor
export function empezarDia(atletaId, dia) {
  const d = leerDia(atletaId, dia);
  const n = { ...d, intentos: Math.min(ETAPA_DIA.intentos, d.intentos + 1) };
  try { localStorage.setItem(claveDia(atletaId), JSON.stringify(n)); } catch { /* */ }
  return n;
}
export function cerrarDia(atletaId, dia, metros) {
  const d = leerDia(atletaId, dia);
  const n = { ...d, mejor: Math.max(d.mejor, Math.round(metros) || 0) };
  try { localStorage.setItem(claveDia(atletaId), JSON.stringify(n)); } catch { /* */ }
  return n;
}

// ---------- (top, tanda 4) Los aullidos: a quién he aullado hoy y cuáles me han llegado ya vistos ----------
const claveAull = (atletaId) => `fbe-juego-aullidos-${atletaId}`;
const leerAull = (atletaId) => { try { return JSON.parse(localStorage.getItem(claveAull(atletaId)) || 'null') || {}; } catch { return {}; } };
const guardarAull = (atletaId, v) => { try { localStorage.setItem(claveAull(atletaId), JSON.stringify(v)); } catch { /* */ } };
export function aulladosHoy(atletaId, dia) { const a = leerAull(atletaId); return a.dia === dia && Array.isArray(a.a) ? a.a : []; }
export function apuntarAullado(atletaId, dia, perfil) { const a = leerAull(atletaId); const l = a.dia === dia && Array.isArray(a.a) ? a.a : []; guardarAull(atletaId, { ...a, dia, a: [...new Set([...l, perfil])] }); }
// De los que me han llegado ([{ nombre, dia }]), los que aún no he visto; y quedan como vistos
export function aullidosNuevos(atletaId, recibidos) {
  const a = leerAull(atletaId), vistos = new Set(Array.isArray(a.vistos) ? a.vistos : []);
  const nuevos = (recibidos || []).filter((x) => !vistos.has(`${x.nombre}|${x.dia}`));
  if (nuevos.length) guardarAull(atletaId, { ...a, vistos: [...vistos, ...nuevos.map((x) => `${x.nombre}|${x.dia}`)].slice(-80) });
  return nuevos;
}
