// (v0.208, rendimiento) Lecturas que se cubren unas a otras.
// Al abrir Hoy, varias piezas piden lo mismo de un atleta con filtros distintos: sus pesadas, ocho veces (la última, las
// de hoy, las de los últimos 60 días, todas…); sus bloques, cinco; sus semanas y sus sesiones, siete y once. Cada una era
// una espera a la base. Ahora, para unas pocas tablas pequeñas por atleta (AMPLIAR), la primera vez se piden todas las
// filas de ese ámbito (el atleta, el bloque, las semanas) y lo demás se saca de ahí, en el móvil, con los mismos filtros.
// Solo se saca en el móvil lo que se sabe hacer igual que la base: igual, distinto, en una lista, vacío o no, y mayor o
// menor que un número o una fecha (AAAA-MM-DD) en columnas que son números o fechas; el orden, solo por números, fechas
// o identificadores. Con cualquier otra cosa, derivar() devuelve null y la consulta va a la base como siempre.
// (api.js decide cuándo se pide el ámbito entero y cuánto vale: mientras no se escriba nada y unos segundos)

// Tabla → la columna que marca su ámbito (las filas de un atleta, de unos bloques, de unas semanas)
export const AMPLIAR = Object.freeze({
  pesos: 'atleta_id', checkins: 'atleta_id', molestias: 'atleta_id', medidas: 'atleta_id', bloques: 'atleta_id',
  atletas: 'id', semanas: 'bloque_id', sesiones: 'semana_id',
  // (una fila por día, por atleta o por hábito: pocas y pequeñas)
  registros_nutricion: 'atleta_id', cuestionarios: 'atleta_id', habitos: 'atleta_id',
  sesion_ejercicios: 'sesion_id',
});
// Las que pueden ser grandes (las series de dos años son miles): nunca se piden enteras por esto; pero si alguien ya las
// ha pedido enteras (el historial), lo demás sale de ahí
export const SOLO_CUBRIR = Object.freeze({ series: 'atleta_id' });
const claveDe = (tabla) => AMPLIAR[tabla] || SOLO_CUBRIR[tabla] || null;

const CLAVES = new Set(['eq', 'neq', 'in', 'gte', 'lte', 'nulo', 'nonulo', 'order', 'limit', 'cols', 'pagina']);
const COL = /^[a-z_][a-z0-9_]*$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escalar = (v) => typeof v === 'string' || typeof v === 'number';
const columnas = (cols) => (cols == null || cols === '*' ? null : String(cols).split(',').map((c) => c.trim()));

// El ámbito de una consulta: { clave, amplio } (la consulta de todo el ámbito) o null si no se puede ampliar
export function ambitoDe(tabla, f) {
  const k = claveDe(tabla);
  if (!k || !f || typeof f !== 'object' || Array.isArray(f)) return null;
  if (Object.keys(f).some((x) => !CLAVES.has(x))) return null;
  let valores = null;
  if (f.eq && Object.prototype.hasOwnProperty.call(f.eq, k)) { if (!escalar(f.eq[k])) return null; valores = [f.eq[k]]; }
  else if (f.in && Array.isArray(f.in[k])) valores = f.in[k];
  if (!valores || !valores.length || valores.length > 150 || !valores.every(escalar)) return null;
  if (f.eq && f.in && Object.prototype.hasOwnProperty.call(f.eq, k) && Object.prototype.hasOwnProperty.call(f.in, k)) return null;
  const cols = columnas(f.cols);
  if (cols && !cols.every((c) => COL.test(c))) return null;
  for (const g of ['eq', 'neq', 'in', 'gte', 'lte']) {
    if (f[g] != null && (typeof f[g] !== 'object' || Array.isArray(f[g]))) return null;
    for (const c of Object.keys(f[g] || {})) if (!COL.test(c)) return null;
  }
  for (const g of ['nulo', 'nonulo']) if (f[g] != null && (!Array.isArray(f[g]) || !f[g].every((c) => COL.test(c)))) return null;
  if (f.order != null && (!Array.isArray(f.order) || !f.order.every((o) => Array.isArray(o) && COL.test(o[0]) && (o[1] == null || o[1] === 'asc' || o[1] === 'desc')))) return null;
  if (f.limit != null && !(Number.isInteger(f.limit) && f.limit > 0)) return null;
  const distintos = [...new Map(valores.map((v) => [String(v), v])).values()];
  const ordenados = distintos.map(String).sort();
  return {
    clave: `${tabla}|${k}|${ordenados.join(',')}`,
    tabla, valores: ordenados,
    amplio: distintos.length === 1 ? { eq: { [k]: distintos[0] } } : { in: { [k]: distintos } },
  };
}

// ¿Es la consulta de todo su ámbito? (solo el ámbito y, como mucho, un orden: trae todas las filas, enteras)
export function esCompleta(tabla, f) {
  const k = claveDe(tabla);
  if (!k || !f) return false;
  const otras = Object.keys(f).filter((x) => !['order', 'pagina'].includes(x));
  if (otras.length !== 1) return false;
  const g = otras[0];
  return (g === 'eq' || g === 'in') && Object.keys(f[g] || {}).length === 1 && Object.prototype.hasOwnProperty.call(f[g], k);
}

// Las filas pedidas por su identificador (eq o in en «id», y nada más que lo acote por ámbito): [ids] o null
export function idsDe(tabla, f) {
  if (!claveDe(tabla) || claveDe(tabla) === 'id' || !f || Object.keys(f).some((x) => !CLAVES.has(x))) return null;
  const ids = f.eq && escalar(f.eq.id) ? [f.eq.id] : Array.isArray(f.in?.id) && f.in.id.length && f.in.id.length <= 150 && f.in.id.every(escalar) ? f.in.id : null;
  return ids ? [...new Set(ids.map(String))] : null;
}

// ¿Cubre el ámbito «grande» (ya pedido) al de esta consulta? Misma tabla y todos sus valores dentro (las sesiones de las
// semanas de este bloque están dentro de las de todos sus bloques)
export function cubre(grande, chico) {
  if (!grande || !chico || grande.tabla !== chico.tabla) return false;
  if (grande.clave === chico.clave) return true;
  const g = new Set(grande.valores);
  return chico.valores.every((v) => g.has(v));
}

const ordenable = (v) => v == null || typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && (/^\d{4}-\d{2}-\d{2}/.test(v) || UUID.test(v)));
// Una fecha con hora (como la da la base: «2026-11-20T10:15:00.123+00:00»): se compara como instante
const MOMENTO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
// (con su zona: sin ella, el navegador la leería como hora de aquí y la base como UTC)
const instante = (v) => (typeof v === 'string' && MOMENTO.test(v) && /([zZ]|[+-]\d{2}:?\d{2})$/.test(v) ? Date.parse(v) : NaN);
const comparar = (a, b) => {
  // (como la base con nullsFirst false: los vacíos, al final, suban o bajen)
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'boolean' || typeof b === 'boolean') return Number(a) - Number(b);
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const ta = instante(a), tb = instante(b);
  if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
};

// Las filas de una consulta, sacadas de las de todo su ámbito; null si no se puede asegurar que salgan igual que de la base
export function derivar(filas, f = {}) {
  if (!Array.isArray(filas)) return null;
  const cols = columnas(f.cols);
  // Una columna que no existe: la base daría error (por ejemplo, sin una migración); aquí, se le deja a ella
  const usadas = new Set([...(cols || []), ...['eq', 'neq', 'in', 'gte', 'lte'].flatMap((g) => Object.keys(f[g] || {})), ...(f.nulo || []), ...(f.nonulo || []), ...(f.order || []).map((o) => o[0])]);
  if (filas.length && [...usadas].some((c) => !Object.prototype.hasOwnProperty.call(filas[0], c))) return null;
  let r = filas;
  for (const [c, v] of Object.entries(f.eq || {})) {
    if (v === null) r = r.filter((x) => x[c] == null);
    else if (escalar(v) || typeof v === 'boolean') r = r.filter((x) => x[c] != null && typeof x[c] !== 'object' && String(x[c]) === String(v));
    else return null;
  }
  for (const [c, v] of Object.entries(f.neq || {})) {
    if (!(escalar(v) || typeof v === 'boolean')) return null;
    r = r.filter((x) => x[c] != null && typeof x[c] !== 'object' && String(x[c]) !== String(v));
  }
  for (const [c, vs] of Object.entries(f.in || {})) {
    if (!Array.isArray(vs) || !vs.every((v) => escalar(v) || typeof v === 'boolean')) return null;
    const s = new Set(vs.map(String));
    r = r.filter((x) => x[c] != null && typeof x[c] !== 'object' && s.has(String(x[c])));
  }
  for (const c of f.nulo || []) r = r.filter((x) => x[c] == null);
  for (const c of f.nonulo || []) r = r.filter((x) => x[c] != null);
  for (const [g, cumple] of [['gte', (a, b) => a >= b], ['lte', (a, b) => a <= b]]) {
    for (const [c, v] of Object.entries(f[g] || {})) {
      if (typeof v === 'number') {
        if (filas.some((x) => x[c] != null && typeof x[c] !== 'number')) return null;
      } else if (typeof v === 'string' && FECHA.test(v) && filas.every((x) => x[c] == null || (typeof x[c] === 'string' && FECHA.test(x[c])))) {
        // (columna de fecha con una fecha: como texto, AAAA-MM-DD ordena igual)
      } else if (typeof v === 'string' && Number.isFinite(Date.parse(v)) && ((MOMENTO.test(v) && /([zZ]|[+-]\d{2}:?\d{2})$/.test(v)) || FECHA.test(v)) && filas.every((x) => x[c] == null || Number.isFinite(instante(x[c])))) {
        // (columna de fecha y hora: como instantes; una fecha sola es su medianoche en UTC, igual que en la base)
        const t = Date.parse(v);
        r = r.filter((x) => x[c] != null && cumple(instante(x[c]), t));
        continue;
      } else return null;
      r = r.filter((x) => x[c] != null && cumple(x[c], v));
    }
  }
  if (f.order?.length) {
    for (const [c] of f.order) if (!filas.every((x) => ordenable(x[c]))) return null;
    // (estable: a igualdad, como venían, que es por su clave, como pagina la base)
    r = r.map((x, i) => [x, i]).sort(([a, i], [b, j]) => {
      for (const [c, dir] of f.order) { const d = comparar(a[c], b[c]); if (d) return dir === 'desc' ? (a[c] == null || b[c] == null ? d : -d) : d; }
      return i - j;
    }).map(([x]) => x);
  }
  if (f.limit) r = r.slice(0, f.limit);
  return r.map((x) => (cols ? Object.fromEntries(cols.map((c) => [c, x[c] === undefined ? null : x[c]])) : { ...x }));
}
