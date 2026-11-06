// v0.65: abrir la app sin cobertura. Lo puro: qué vale de la copia de tu semana guardada en el móvil (datos/copia.js), qué
// se poda, y lo que espera en la cola (las series y las sesiones marcadas sin conexión) puesto encima de lo que trae la copia
// (o la base, si aún no le ha llegado): así, al volver a abrir la app sin señal, lo apuntado sigue ahí.

export const CADUCA_COPIA_DIAS = 14;
// De las sesiones (y sus marcas) se guardan las últimas abiertas o preparadas: la semana de sobra
export const MAX_SESIONES_COPIA = 8;
const DIA = 86400000;

// Las claves de la copia (por cuenta: la cuenta va aparte)
export const CLAVES_COPIA = {
  perfil: () => 'perfil',
  atleta: () => 'atleta',
  consentimientos: () => 'consentimientos',
  programa: (atletaId) => `programa:${atletaId}`,
  sesion: (sesionId) => `sesion:${sesionId}`,
  marcas: (sesionId) => `marcas:${sesionId}`,
  recordatorios: (atletaId) => `recordatorios:${atletaId}`,
};

// Una entrada guardada vale si es de esa cuenta, tiene su hora (no del futuro) y no ha caducado
export function copiaVale(x, uid, ahora = Date.now()) {
  return !!x && typeof x === 'object' && !!uid && x.uid === uid && Number.isFinite(x.t) && x.t <= ahora + 60000
    && ahora - x.t < CADUCA_COPIA_DIAS * DIA && 'datos' in x;
}

// Las claves que sobran: lo caducado o mal formado y, por cuenta, las sesiones (y sus marcas) más allá de las últimas
// MAX_SESIONES_COPIA. entradas: [[clave, valor]]
export function clavesAPodar(entradas = [], ahora = Date.now()) {
  const fuera = [];
  const porCuenta = new Map();
  for (const [k, x] of entradas) {
    if (!x || !copiaVale(x, x.uid, ahora)) { fuera.push(k); continue; }
    if (!/^(sesion|marcas):/.test(String(x.clave || ''))) continue;
    const id = String(x.clave).split(':')[1];
    const m = porCuenta.get(x.uid) || new Map();
    m.set(id, Math.max(m.get(id) || 0, x.t));
    porCuenta.set(x.uid, m);
  }
  const quedan = new Map();
  for (const [uid, m] of porCuenta) quedan.set(uid, new Set([...m].sort((a, b) => b[1] - a[1]).slice(0, MAX_SESIONES_COPIA).map(([id]) => id)));
  for (const [k, x] of entradas) {
    if (fuera.includes(k) || !/^(sesion|marcas):/.test(String(x?.clave || ''))) continue;
    if (!quedan.get(x.uid)?.has(String(x.clave).split(':')[1])) fuera.push(k);
  }
  return fuera;
}

// Las operaciones de la cola (datos/cola.js: { tipo: 'serie' | 'borrarSerie' | 'sesion', datos }) encima de una sesión
// (lo que da api.sesion): cada serie guardada en el móvil sustituye a la de ese número (o se añade) y cada borrado la quita,
// en orden; lo marcado de la sesión (terminada, el día…) se le aplica. Sin nada de esta sesión en la cola, la misma.
export function sesionConCola(det, ops = []) {
  if (!det?.ejercicios || !ops?.length) return det;
  const ids = new Set(det.ejercicios.map((e) => e.id));
  const series = ops.filter((o) => (o?.tipo === 'serie' || o?.tipo === 'borrarSerie') && ids.has(o.datos?.sesion_ejercicio_id) && Number.isFinite(o.datos?.numero));
  const ses = ops.filter((o) => o?.tipo === 'sesion' && det.sesion && o.datos?.id === det.sesion.id && o.datos.cambios);
  if (!series.length && !ses.length) return det;
  const ejercicios = det.ejercicios.map((e) => {
    const mias = series.filter((o) => o.datos.sesion_ejercicio_id === e.id);
    if (!mias.length) return e;
    let hechas = [...(e.hechas || [])];
    for (const o of mias) {
      const n = o.datos.numero;
      const previa = hechas.find((s) => s.numero === n);
      hechas = hechas.filter((s) => s.numero !== n);
      if (o.tipo === 'serie') hechas.push({ ...(previa || {}), ...o.datos, id: previa?.id || `local-${e.id}-${n}` });
    }
    return { ...e, hechas: hechas.sort((a, b) => a.numero - b.numero) };
  });
  const sesion = ses.reduce((s, o) => ({ ...s, ...o.datos.cambios }), det.sesion);
  return { ...det, sesion, ejercicios };
}

// Las series de esta sesión que esperan en la cola: { `${sesion_ejercicio_id}-${numero}`: true } (la marca «guardada en el móvil»)
export function enColaDe(det, ops = []) {
  const ids = new Set((det?.ejercicios || []).map((e) => e.id));
  const out = {};
  for (const o of ops || []) {
    const d = o?.datos;
    if (!d || !ids.has(d.sesion_ejercicio_id)) continue;
    const k = `${d.sesion_ejercicio_id}-${d.numero}`;
    if (o.tipo === 'serie') out[k] = true;
    else if (o.tipo === 'borrarSerie') delete out[k];
  }
  return out;
}

// Lo marcado de una sesión sin conexión (terminada, el día previsto…), encima del programa
export function programaConCola(p, ops = []) {
  const ses = (ops || []).filter((o) => o?.tipo === 'sesion' && o.datos?.id && o.datos.cambios);
  if (!p?.sesiones || !ses.length) return p;
  const sesiones = {};
  for (const [w, l] of Object.entries(p.sesiones)) {
    sesiones[w] = (l || []).map((s) => ses.filter((o) => o.datos.id === s.id).reduce((x, o) => ({ ...x, ...o.datos.cambios }), s));
  }
  return { ...p, sesiones };
}

// (pulido 3.9) Lo apuntado en Hoy sin conexión (cola: { tipo: 'comida' | 'habito' | 'peso', atletaId, datos }), encima de lo
// que da la base, en su orden. Sin nada de ese atleta en la cola, lo mismo que llegó.
// Una comida marcada (o desmarcada): datos { id, hecho }
export function menuConCola(menu, ops = [], atletaId = null) {
  const mias = (ops || []).filter((o) => o?.tipo === 'comida' && o.atletaId === atletaId && o.datos?.id);
  if (!Array.isArray(menu) || !mias.length) return menu;
  return menu.map((e) => mias.filter((o) => o.datos.id === e.id).reduce((x, o) => ({ ...x, hecho: !!o.datos.hecho }), e));
}
// Un hábito apuntado (valor null: borrado): datos { habito_id, fecha, valor }. Solo lo que cae entre desde y hasta
export function registrosHabitoConCola(filas, ops = [], atletaId = null, { desde = null, hasta = null } = {}) {
  const mias = (ops || []).filter((o) => o?.tipo === 'habito' && o.atletaId === atletaId && o.datos?.habito_id && o.datos.fecha
    && (!desde || o.datos.fecha >= desde) && (!hasta || o.datos.fecha <= hasta));
  if (!Array.isArray(filas) || !mias.length) return filas;
  let out = [...filas];
  for (const o of mias) {
    const { habito_id: h, fecha, valor } = o.datos;
    const previa = out.find((x) => x.habito_id === h && x.fecha === fecha);
    out = out.filter((x) => x !== previa);
    if (valor != null) out.push({ ...(previa || { id: `local-${h}-${fecha}`, atleta_id: atletaId, habito_id: h, fecha }), valor });
  }
  return out.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}
// El peso de un día: datos { fecha, kg }
export function pesosConCola(filas, ops = [], atletaId = null, { desde = null } = {}) {
  const mias = (ops || []).filter((o) => o?.tipo === 'peso' && o.atletaId === atletaId && o.datos?.fecha && Number.isFinite(Number(o.datos.kg)) && (!desde || o.datos.fecha >= desde));
  if (!Array.isArray(filas) || !mias.length) return filas;
  let out = [...filas];
  for (const o of mias) {
    const previa = out.find((x) => x.fecha === o.datos.fecha);
    out = out.filter((x) => x !== previa);
    out.push({ ...(previa || { id: `local-peso-${o.datos.fecha}`, atleta_id: atletaId, fecha: o.datos.fecha }), kg: Number(o.datos.kg) });
  }
  return out.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

// Las sesiones que se dejan preparadas en el móvil tras una visita con conexión: las que quedan por hacer de la semana
// actual, en su orden (hoy y lo que viene), como mucho n
export function sesionesAPreparar(p, n = 3) {
  const semana = p?.actual;
  if (!semana) return [];
  return (p.sesiones?.[semana.id] || []).filter((s) => s && !s.completada).slice(0, n).map((s) => s.id);
}
