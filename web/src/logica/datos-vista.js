// (vista 260-268, v0.275) Datos que se entienden solos: las cuentas de lo que se ve en Progreso, en la sesión y en
// «Tus entrenamientos». Sin pantalla: todo lo que dibuja ui/atleta/datos-vista.jsx sale de aquí.
import { e1rm } from './calculos.js';
import { sumarDias } from './fechas.js';

// ---------- (260 y 268) los ejercicios que sumaron las series de un músculo en una semana ----------
// series: el historial ([{ fecha, reps, ejercicio_id, ejercicio, grupos }]); lunes: el de esa semana; g: el músculo.
// Como en «Series por músculo»: el principal de cada ejercicio cuenta 1 por serie y los secundarios, media.
// Devuelve [{ id, nombre, series, cuenta, principal }], de lo que más sumó a lo que menos
export function ejerciciosDeGrupo(series, lunes, g) {
  if (!g || !lunes) return [];
  const fin = sumarDias(lunes, 6);
  const por = new Map();
  for (const s of series || []) {
    if (!s?.fecha || s.fecha < lunes || s.fecha > fin || !(Number(s.reps) > 0)) continue;
    const i = (s.grupos || []).indexOf(g);
    if (i < 0) continue;
    const k = s.ejercicio_id || s.ejercicio || '?';
    const x = por.get(k) || { id: s.ejercicio_id || null, nombre: s.ejercicio || 'Ejercicio', series: 0, cuenta: 0, principal: i === 0 };
    x.series += 1;
    x.cuenta += i === 0 ? 1 : 0.5;
    por.set(k, x);
  }
  return [...por.values()].sort((a, b) => b.cuenta - a.cuenta || b.series - a.series || a.nombre.localeCompare(b.nombre, 'es'));
}

// ---------- (263) la huella de una sesión: una fila de puntos por ejercicio, uno por serie ----------
// El color, por su esfuerzo (RPE): suave hasta 6, medio de 7 a 8,5 y fuerte desde 9; sin esfuerzo apuntado, gris.
export function tonoEsfuerzo(rpe) {
  const r = Number(rpe);
  if (rpe == null || rpe === '' || !Number.isFinite(r) || r <= 0) return 'sin';
  return r >= 9 ? 'fuerte' : r >= 7 ? 'medio' : 'suave';
}
export const MAX_FILAS_HUELLA = 10, MAX_PUNTOS_HUELLA = 8;
// Lo que guarda la lista de entrenamientos (datos/api.js, entrenamientos): por ejercicio, una cifra por serie: su
// esfuerzo redondeado (0, sin él) y 100 más si fue récord. Se lee así
export function leerHuella(codigos) {
  if (!Array.isArray(codigos)) return [];
  return codigos.filter(Array.isArray).slice(0, MAX_FILAS_HUELLA).map((fila) => ({
    puntos: fila.slice(0, MAX_PUNTOS_HUELLA).map((c) => { const n = Number(c) || 0; return { t: tonoEsfuerzo(n % 100), rec: n >= 100 }; }),
    mas: Math.max(0, fila.length - MAX_PUNTOS_HUELLA),
  })).filter((f) => f.puntos.length);
}
// La del resumen de la sesión: [{ nombre, series: [{ rpe, record }] }] → lo mismo, con su nombre
export function huellaDeResumen(ejercicios) {
  return (ejercicios || []).filter((e) => e?.series?.length).slice(0, MAX_FILAS_HUELLA).map((e) => ({
    nombre: e.nombre,
    puntos: e.series.slice(0, MAX_PUNTOS_HUELLA).map((s) => ({ t: tonoEsfuerzo(s.rpe), rec: !!s.record })),
    mas: Math.max(0, e.series.length - MAX_PUNTOS_HUELLA),
  }));
}
// Lo que dice al lector de pantalla
export function textoHuella(filas) {
  const n = filas.reduce((t, f) => t + f.puntos.length + f.mas, 0);
  const rec = filas.reduce((t, f) => t + f.puntos.filter((p) => p.rec).length, 0);
  const fuertes = filas.reduce((t, f) => t + f.puntos.filter((p) => p.t === 'fuerte').length, 0);
  return `${filas.length} ${filas.length === 1 ? 'ejercicio' : 'ejercicios'}, ${n} ${n === 1 ? 'serie' : 'series'}${fuertes ? `, ${fuertes} muy exigente${fuertes === 1 ? '' : 's'}` : ''}${rec ? `, ${rec} ${rec === 1 ? 'récord' : 'récords'}` : ''}`;
}

// ---------- (264) tu línea en la tarjeta del ejercicio: tus últimas seis veces ----------
// series: las de ese ejercicio ([{ fecha, kg, reps, rpe }]); antesDe: la fecha de hoy (lo de hoy no cuenta). Por día, su
// mejor 1RM estimado. Solo con cargas (sin kilos no hay 1RM): con menos de tres días, nada
export function lineaUltimas(series, { antesDe = null, n = 6 } = {}) {
  const porDia = new Map();
  for (const s of series || []) {
    if (!s?.fecha || (antesDe && s.fecha >= antesDe)) continue;
    const v = e1rm(s);
    if (v == null || !(v > 0)) continue;
    if (!porDia.has(s.fecha) || porDia.get(s.fecha) < v) porDia.set(s.fecha, v);
  }
  const puntos = [...porDia.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).slice(-n).map(([fecha, valor]) => ({ fecha, valor: Math.round(valor * 10) / 10 }));
  return puntos.length >= 3 ? puntos : [];
}
// Cómo va, de la primera de esas veces a la última: 'sube' (más de un 1 %), 'baja' (menos de un −1 %) o 'igual'
export function tendenciaLinea(puntos) {
  if (!puntos?.length || puntos.length < 2) return null;
  const a = puntos[0].valor, b = puntos[puntos.length - 1].valor;
  const d = a > 0 ? (b - a) / a : 0;
  return { dif: Math.round((b - a) * 10) / 10, sentido: d > 0.01 ? 'sube' : d < -0.01 ? 'baja' : 'igual' };
}

// ---------- (265) superar a la última: lo de hoy frente a lo de la última vez de esos mismos ejercicios ----------
// hoy y antes: [{ ejercicio, kg, reps }] (antes: las series de la última vez de cada ejercicio de hoy). Con kilos, por
// toneladas; sin kilos (peso corporal), por repeticiones. Solo se compara con ejercicios que tienen última vez
export function superaUltima(hoy, antes) {
  const con = new Set((antes || []).map((s) => s.ejercicio));
  const deHoy = (hoy || []).filter((s) => con.has(s.ejercicio));
  const ton = (l) => l.reduce((t, s) => t + (Number(s.kg) || 0) * (Number(s.reps) || 0), 0);
  const reps = (l) => l.reduce((t, s) => t + (Number(s.reps) || 0), 0);
  const tA = ton(antes || []);
  if (tA > 0) { const tH = ton(deHoy); return { por: 'ton', hoy: tH, antes: tA, supera: tH > tA }; }
  const rA = reps(antes || []);
  if (rA > 0) { const rH = reps(deHoy); return { por: 'reps', hoy: rH, antes: rA, supera: rH > rA }; }
  return { por: null, hoy: 0, antes: 0, supera: false };
}

// ---------- (267) dos semanas, lado a lado ----------
// a y b: resúmenes semanales (los de «Tus semanas»: sesiones, series, tonelaje y récords). Devuelve las filas de la
// comparación, de la más antigua (izquierda) a la más reciente (derecha), con lo que cambia
export function compararSemanas(a, b) {
  if (!a || !b) return null;
  const [x, y] = a.lunes <= b.lunes ? [a, b] : [b, a];
  const fila = (id, nombre, va, vb, dec = 0) => ({ id, nombre, a: va, b: vb, dif: Math.round((vb - va) * 10 ** dec) / 10 ** dec, dec });
  return {
    antes: x, despues: y,
    filas: [
      fila('sesiones', 'Sesiones', x.sesiones?.hechas || 0, y.sesiones?.hechas || 0),
      fila('series', 'Series', x.series || 0, y.series || 0),
      fila('toneladas', 'Toneladas', Math.round((x.tonelaje || 0) / 100) / 10, Math.round((y.tonelaje || 0) / 100) / 10, 1),
      fila('records', 'Récords', x.records?.length || 0, y.records?.length || 0),
    ],
  };
}
// Elegir semanas para comparar: tocar una la añade; tocar una elegida la quita; con dos, la tercera sustituye a la
// primera que se eligió
export function elegirSemana(elegidas, lunes) {
  const l = Array.isArray(elegidas) ? elegidas : [];
  if (l.includes(lunes)) return l.filter((x) => x !== lunes);
  return [...l, lunes].slice(-2);
}
