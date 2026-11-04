// v0.59: una marca por repetición en la barra de tiempo del vídeo («Rep 1…n») y cuál es «la peor». De dónde salen, en este
// orden: el análisis (v0.58: el de esta sesión o el guardado), el tempo que marcó el coach (v0.57) o las marcas a mano
// («Marcar rep», que el coach guarda en la corrección: video_revisiones.reps_manual, migración 037).
import { textoMomento } from './momentos.js';

export const MAX_REPS_MANUAL = 30;
const r2 = (x) => Math.round(x * 100) / 100;
const num = (x) => typeof x === 'number' && Number.isFinite(x);
const decimales = (x) => { const s = String(x); if (/e/i.test(s)) return 99; const p = s.split('.')[1]; return p ? p.length : 0; };

// Como reps_manual_validas() en la base: { t: [1..30 × segundo] }, en orden, de 0 a 3600 (y dentro del vídeo, si se sabe)
export function repsManualValidas(j, dur = null) {
  if (!j || typeof j !== 'object' || Array.isArray(j) || !Object.keys(j).every((k) => k === 't')) return false;
  if (!Array.isArray(j.t) || j.t.length < 1 || j.t.length > MAX_REPS_MANUAL) return false;
  const tope = Number.isFinite(dur) && dur >= 0 ? dur + 1 : 3600;
  let prev = -1;
  for (const x of j.t) {
    if (!num(x) || x < 0 || x > 3600 || x > tope || decimales(x) > 4 || x <= prev) return false;
    prev = x;
  }
  return true;
}
// Añadir una marca (en orden; a menos de 0,2 s de otra, no; como mucho 30)
export function anadirRepManual(lista = [], t) {
  if (!num(t) || t < 0) return [...(lista || [])];
  const xs = [...(lista || [])];
  if (xs.some((x) => Math.abs(x - t) < 0.2) || xs.length >= MAX_REPS_MANUAL) return xs;
  return [...xs, r2(t)].sort((a, b) => a - b);
}
export const quitarRepManual = (lista = [], t) => (lista || []).filter((x) => Math.abs(x - t) >= 0.05);

// Las repeticiones con su momento: [{ n, t, fin, vm?, perdida? }] y de dónde salen
export function marcasRepeticiones({ sesion = null, analisis = null, tempo = null, manual = null, duracion = null } = {}) {
  const dur = Number.isFinite(duracion) && duracion > 0 ? duracion : 3600;
  const dentro = (xs) => xs.filter((r) => num(r.t) && r.t >= 0 && r.t <= dur + 0.5);
  const conN = (xs) => xs.map((r, i) => ({ ...r, n: i + 1 }));
  const deVel = (reps) => dentro((reps || []).filter((r) => Array.isArray(r?.t) && r.t.length === 3).map((r) => ({ t: r.t[0], fin: r.t[2], abajo: r.t[1], vm: num(r.vm) ? r.vm : null })));
  if (sesion?.length) return { fuente: 'sesion', reps: conN(deVel(sesion)) };
  if (analisis?.reps?.length) return { fuente: 'analisis', reps: conN(deVel(analisis.reps)) };
  if (analisis?.pose?.reps?.length) return { fuente: 'analisis', reps: conN(dentro(analisis.pose.reps.filter((r) => Array.isArray(r?.t)).map((r) => ({ t: r.t[0], fin: r.t[1] })))) };
  if (tempo?.reps?.length) return { fuente: 'tempo', reps: conN(dentro(tempo.reps.filter((r) => Array.isArray(r) && r.length === 3).map(([a, , c]) => ({ t: a, fin: c })))) };
  const m = Array.isArray(manual) ? manual : manual?.t;
  if (m?.length) return { fuente: 'manual', reps: conN(dentro([...m].filter(num).sort((a, b) => a - b).map((t, i, xs) => ({ t, fin: xs[i + 1] ?? null })))) };
  return { fuente: null, reps: [] };
}
export const NOMBRE_FUENTE_REPS = { sesion: 'del análisis', analisis: 'del análisis guardado', tempo: 'del tempo', manual: 'marcadas a mano' };

// «La peor»: con la velocidad, la más lenta (la que más pierde de la mejor); si no, con los puntos del cuerpo, la menos
// profunda (la rodilla que menos se dobla) o, sin rodilla, la del tronco más inclinado. Con dos repeticiones como mínimo.
// Devuelve { t, motivo } (el momento en que empieza, para buscarla entre las marcas) o null.
export function peorRepeticion({ reps = [], pose = null } = {}) {
  const conVel = (reps || []).filter((r) => num(r.vm));
  if (conVel.length >= 2) {
    const mejor = Math.max(...conVel.map((r) => r.vm));
    const peor = conVel.reduce((a, b) => (b.vm < a.vm ? b : a));
    if (peor.vm < mejor) {
      const perdida = mejor > 0 ? Math.round(((mejor - peor.vm) / mejor) * 100) : null;
      return { t: peor.t, motivo: 'velocidad', texto: `la más lenta (${String(peor.vm.toFixed(2)).replace('.', ',')} m/s${perdida ? `, −${perdida} % de la mejor` : ''})` };
    }
  }
  const pr = (pose?.reps || []).filter((r) => Array.isArray(r?.t));
  if (pr.length >= 2) {
    const conRodilla = pr.filter((r) => num(r.rodilla));
    if (conRodilla.length >= 2) {
      const p = conRodilla.reduce((a, b) => (b.rodilla > a.rodilla ? b : a));
      if (conRodilla.some((r) => r.rodilla < p.rodilla)) return { t: p.t[0], motivo: 'profundidad', texto: `la menos profunda (rodilla a ${Math.round(p.rodilla)}°)` };
    }
    const conTronco = pr.filter((r) => num(r.tronco));
    if (conTronco.length >= 2) {
      const p = conTronco.reduce((a, b) => (b.tronco > a.tronco ? b : a));
      if (conTronco.some((r) => r.tronco < p.tronco)) return { t: p.t[0], motivo: 'tronco', texto: `la del tronco más inclinado (${Math.round(p.tronco)}°)` };
    }
  }
  return null;
}
// La marca de esa repetición (la que contiene su momento o, si no, la más cercana)
export function indicePeor(marcas = [], peor = null) {
  if (!peor || !marcas.length) return -1;
  const i = marcas.findIndex((m) => peor.t >= m.t - 0.15 && (m.fin == null || peor.t <= m.fin + 0.15));
  if (i >= 0) return i;
  let mejor = 0;
  for (let k = 1; k < marcas.length; k++) if (Math.abs(marcas[k].t - peor.t) < Math.abs(marcas[mejor].t - peor.t)) mejor = k;
  return mejor;
}
// La siguiente (o la anterior) desde t: con los botones y con [ y ]
export function repVecina(marcas = [], t, sentido = 1) {
  if (sentido > 0) return marcas.find((m) => m.t > t + 0.05) || null;
  for (let i = marcas.length - 1; i >= 0; i--) if (marcas[i].t < t - 0.05) return marcas[i];
  return null;
}
// La repetición en la que está el vídeo (o -1)
export const repActual = (marcas = [], t) => {
  for (let i = marcas.length - 1; i >= 0; i--) if (t >= marcas[i].t - 0.05) return i;
  return -1;
};
export const etiquetaRep = (m, peor = false) => `Repetición ${m.n}${peor ? ' (la peor)' : ''}, en ${textoMomento(m.t, true)}`;
