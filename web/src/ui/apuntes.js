// «Apuntes» (formación en los descansos): lo que el atleta ha visto, en este móvil, en `fbe-apuntes-<atletaId>`
// (logica/apuntes.js). Si el navegador no deja guardar, se recuerda mientras la app está abierta.
import { limpiarVistos, apuntarVisto, pendienteDeSubir, conServidor, ID_APUNTE } from '../logica/apuntes.js';

const enMemoria = new Map();
const soloMemoria = new Set();   // (v0.148) los que no se han podido guardar en el navegador: ahí manda la memoria
const clave = (atletaId) => `fbe-apuntes-${atletaId}`;

// Lo guardado en el navegador manda (otra pestaña puede haberlo cambiado); la memoria, solo si el navegador no deja
export function leerApuntes(atletaId) {
  if (soloMemoria.has(atletaId) && enMemoria.has(atletaId)) return limpiarVistos(enMemoria.get(atletaId));
  try { const t = localStorage.getItem(clave(atletaId)); return limpiarVistos(t ? JSON.parse(t) : enMemoria.get(atletaId) ?? null); } catch { /* sin almacenamiento o ilegible */ }
  return limpiarVistos(enMemoria.get(atletaId) ?? null);
}

// (tanda 4, migración 061) la base admite las claves de cualquier familia (glosario, dudas…); con la 060 sola, las que
// no admite las rechaza ('rechazado') y salen de la cola sin atascarla
const SUBIBLE = ID_APUNTE;
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
// (apuntes, tanda A) nota: 'otra' | 'bien' | 'facil' al recordarlo antes de leerlo (el repaso espaciado)
const repasoDe = (e, id) => { const v = e?.vistos?.[id]; return v && Number.isInteger(v.c) && v.p ? { caja: v.c, proxima: v.p } : null; };
export function guardarVisto(atletaId, id, hoy, sabia = null, api = null, nota = null) {
  let e = apuntarVisto(leerApuntes(atletaId), id, hoy, sabia, nota);
  // (a la base, los que su función admite: con la 061, cualquier familia; con la 060 sola, las que rechace salen de la cola)
  if (api?.apuntarApunte && SUBIBLE.test(id)) {
    e = pendienteDeSubir(e, id, sabia);
    const valor = e.porSubir?.[id];
    // (se sube lo que queda en cola: si antes contestó y esta vez no, se sube lo que contestó)
    if (valor !== undefined) api.apuntarApunte(id, valor, repasoDe(e, id)).then((r) => { if (r) quitarDeLaCola(atletaId, id, valor); }).catch(() => {});
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
      const r = await api.apuntarApunte?.(id, sabia, repasoDe(leerApuntes(atletaId), id));
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

// (tanda 2) Guarda lo que ha cambiado sin ver nada (un apunte guardado para luego, el reto de la siguiente serie)
export const guardarEstado = (atletaId, e) => guardar(atletaId, limpiarVistos(e));

// (apuntes, tanda A) Sin conexión: lo último que se cargó de cada fuente (las guías, recortadas a lo que usan los apuntes;
// las novedades; y las fichas y correcciones de los últimos 30 ejercicios) en `fbe-fuentes-apuntes-<atletaId>`
const claveFuentes = (atletaId) => `fbe-fuentes-apuntes-${atletaId}`;
const MAX_POR_EJERCICIO = 30;
const comoObjeto = (c) => { if (c && typeof c === 'object') return c; try { return JSON.parse(c) || {}; } catch { return {}; } };
export function guiasCompactas(guias) {
  return (Array.isArray(guias) ? guias : []).filter((g) => g?.clave).map((g) => {
    const c = comoObjeto(g.contenido);
    return { id: g.id, clave: g.clave, titulo: g.titulo, publicada: g.publicada, contenido: g.clave === 'mitos' ? c : { ideas: Array.isArray(c.ideas) ? c.ideas : [] } };
  });
}
function leerFuentes(atletaId) { try { return JSON.parse(localStorage.getItem(claveFuentes(atletaId)) || '{}') || {}; } catch { return {}; } }
export function recordarFuente(atletaId, nombre, datos) {
  if (!atletaId || datos == null) return;
  const t = leerFuentes(atletaId);
  t[nombre] = { t: Date.now(), d: nombre === 'guias' ? guiasCompactas(datos) : datos };
  const deEjercicio = Object.keys(t).filter((k) => k.includes(':')).sort((a, b) => t[b].t - t[a].t);
  for (const k of deEjercicio.slice(MAX_POR_EJERCICIO)) delete t[k];
  try { localStorage.setItem(claveFuentes(atletaId), JSON.stringify(t)); } catch { /* lleno o sin almacenamiento: sin respaldo */ }
}
export const fuenteRecordada = (atletaId, nombre) => leerFuentes(atletaId)[nombre]?.d ?? null;
// Carga y, si sale bien, lo recuerda; si falla (sin red), lo recordado (y avisa con `alUsarGuardado`); sin nada, el error
export async function conRespaldo(atletaId, nombre, cargar, alUsarGuardado = null) {
  try { const d = await cargar(); recordarFuente(atletaId, nombre, d); return d; }
  catch (e) { const d = fuenteRecordada(atletaId, nombre); if (d != null) { alUsarGuardado?.(); return d; } throw e; }
}
