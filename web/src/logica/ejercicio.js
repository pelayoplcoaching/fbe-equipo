import { lunesDe, sumarDias } from './fechas.js';
import { e1rm, kgPara } from './calculos.js';

// Ficha de un ejercicio: series semanales de distintas métricas, recorte por rango y tabla de récords
// (real frente a estimado a partir del mejor 1RM estimado).

export const METRICAS = [
  { id: 'e1rm', nombre: '1RM estimado', corto: '1RM', unidad: 'kg', dec: 1 },
  { id: 'carga', nombre: 'Mejor carga', unidad: 'kg', dec: 1 },
  { id: 'volumen', nombre: 'Volumen', unidad: 'kg', dec: 0 },
  { id: 'reps', nombre: 'Repeticiones', unidad: 'reps', dec: 0 },
];
export const RANGOS = [['3m', '3 meses', 91], ['6m', '6 meses', 182], ['1a', '1 año', 365], ['todo', 'Todo', null]];

// Valor de cada semana (lunes) para la métrica: el mejor 1RM estimado, la carga más alta,
// los kilos totales (kg × reps) o las repeticiones más altas en una serie (útil sin carga)
export function serieSemanal(series, metrica) {
  const m = new Map();
  for (const s of series) {
    const reps = Number(s.reps) || 0, kg = Number(s.kg) || 0;
    if (!s.fecha || reps <= 0) continue;
    const k = lunesDe(s.fecha);
    let v = null;
    if (metrica === 'e1rm') v = e1rm(s);
    else if (metrica === 'carga') v = kg > 0 ? kg : null;
    else if (metrica === 'volumen') v = kg * reps;
    else if (metrica === 'reps') v = reps;
    if (v == null || !(v > 0)) continue;
    if (metrica === 'volumen') m.set(k, (m.get(k) || 0) + v);
    else if (!m.has(k) || v > m.get(k)) m.set(k, v);
  }
  return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([semana, valor]) => ({ semana, valor: Math.round(valor * 10) / 10 }));
}

export function recortarRango(puntos, rango, hoy) {
  const dias = RANGOS.find(([id]) => id === rango)?.[2];
  if (!dias) return puntos;
  const desde = lunesDe(sumarDias(hoy, -dias));
  return puntos.filter((p) => p.semana >= desde);
}

// Qué métricas tienen sentido: sin carga (peso corporal) solo repeticiones
export function metricasDe(series) {
  const conCarga = series.some((s) => Number(s.kg) > 0 && Number(s.reps) > 0);
  return conCarga ? METRICAS.filter((m) => m.id !== 'reps') : METRICAS.filter((m) => m.id === 'reps');
}

// Récords de 1 a 12 repeticiones: lo más pesado hecho a exactamente esas repeticiones y lo que predice
// el mejor 1RM estimado (Epley, al fallo). Una celda real por encima del estimado es una marca muy buena.
export function tablaRecords(series, mejor1rm = null) {
  const porReps = {};
  for (const s of series) {
    const r = Number(s.reps), k = Number(s.kg);
    if (!(r >= 1 && r <= 12 && k > 0)) continue;
    if (!porReps[r] || k > porReps[r].kg || (k === porReps[r].kg && s.fecha < porReps[r].fecha)) porReps[r] = { kg: k, fecha: s.fecha, rpe: s.rpe ?? null };
  }
  return Array.from({ length: 12 }, (_, i) => i + 1).map((r) => ({
    reps: r,
    real: porReps[r] || null,
    estimado: mejor1rm ? kgPara(mejor1rm, r, 0, 0.5) : null,
  })).filter((f) => f.real || f.estimado);
}
