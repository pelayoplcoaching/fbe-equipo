// Preparar las semanas siguientes de un golpe (v0.23): cada semana nueva sale de la anterior con su progresión.
// Lo que se pauta con kg sube kilos (y su RPE o RIR se queda igual); lo que se pauta sin kilos sube el esfuerzo;
// y la última puede ser de descarga. Las opciones:
//   kg:  'salto' (un salto por semana según el ejercicio: 2,5 kg en barra, 2 kg en mancuernas, 2,5 o 5 kg en
//        máquinas y poleas) | 'igual' | un número (kg a sumar cada semana, puede ser negativo)
//   rpe: lo que sube el RPE objetivo cada semana (0, 0,5 o 1), sin pasar de 10
//   rir: lo que cambia el RIR objetivo (−1 = más duro), sin bajar de 0
//   reps: lo que cambian las repeticiones (mínimo y máximo)
// Descarga (la última semana, si se pide), sobre lo que tenía la semana anterior: un 10 % menos de kilos
// (redondeado al salto del ejercicio), una serie menos (mínimo 1; 2 con top + back-off), RPE objetivo 1 punto
// menos (mínimo 5) y RIR 1 más; las repeticiones, igual.
import { incrementoCarga, tieneDetalle, limpiarDetalle, agregadosDetalle } from './calculos.js';

export const PROGRESION_DEFECTO = { kg: 'salto', rpe: 0.5, rir: 0, reps: 0 };

const redondear = (x, paso) => Math.round(x / paso) * paso;
const dos = (x) => Math.round(x * 100) / 100;

// Una pauta de la semana siguiente. nombre: el del ejercicio (para el salto de carga)
export function progresarPauta(p, opciones = PROGRESION_DEFECTO, { nombre = '', descarga = false } = {}) {
  // Serie a serie: cada serie progresa como una pauta de una serie, y el resumen sale del detalle nuevo.
  // En descarga, una serie menos (la última).
  if (tieneDetalle(p)) {
    let d = p.series_detalle.map((x) => {
      const una = progresarPauta({ series: 1, reps_min: x.reps ?? null, reps_max: x.reps ?? null, carga_sugerida_kg: x.kg ?? null, rpe_objetivo: x.rpe ?? null, rir_objetivo: null, backoff_pct: null },
        opciones, { nombre, descarga });
      return { reps: una.reps_max, kg: una.carga_sugerida_kg, rpe: una.rpe_objetivo };
    });
    if (descarga && d.length > 1) d = d.slice(0, -1);
    const limpio = limpiarDetalle(d);
    const f = { ...p, series_detalle: limpio, ...agregadosDetalle(limpio) };
    if (descarga && f.rir_objetivo != null) f.rir_objetivo = Math.min(10, Number(f.rir_objetivo) + 1);
    if (!descarga && f.rir_objetivo != null && opciones?.rir) f.rir_objetivo = Math.max(0, Math.min(10, Number(f.rir_objetivo) + Number(opciones.rir)));
    return f;
  }
  const o = { ...PROGRESION_DEFECTO, ...opciones };
  const f = { ...p };
  const kg = f.carga_sugerida_kg != null ? Number(f.carga_sugerida_kg) : null;
  if (descarga) {
    if (kg != null && kg > 0) {
      // Un 10 % menos al salto del ejercicio; con cargas ligeras (un salto sería más del 20 %), al medio kilo
      const paso = incrementoCarga(nombre, kg);
      let t = redondear(kg * 0.9, paso);
      if (t >= kg) t = kg - paso;
      if (t <= 0 || t < kg * 0.8) t = Math.round(kg * 0.9 * 2) / 2;
      f.carga_sugerida_kg = dos(Math.max(0, Math.min(kg, t)));
    }
    if (f.series != null) f.series = Math.max(f.backoff_pct != null ? 2 : 1, Number(f.series) - 1);
    if (f.rpe_objetivo != null) f.rpe_objetivo = Math.min(Number(f.rpe_objetivo), Math.max(5, Number(f.rpe_objetivo) - 1));
    if (f.rir_objetivo != null) f.rir_objetivo = Math.min(10, Number(f.rir_objetivo) + 1);
    return f;
  }
  let subeKg = false;
  if (kg != null) {
    const suma = o.kg === 'salto' ? (kg > 0 ? incrementoCarga(nombre, kg) : 0) : o.kg === 'igual' ? 0 : Number(o.kg) || 0;
    f.carga_sugerida_kg = dos(Math.max(0, kg + suma));
    subeKg = f.carga_sugerida_kg !== kg;
  }
  // Lo que progresa con kilos no sube además el esfuerzo (60 kg @7 → 62,5 kg @7, no @7,5)
  if (subeKg) return repsDe(f, o);
  if (f.rpe_objetivo != null && o.rpe) f.rpe_objetivo = Math.min(10, Math.max(1, Number(f.rpe_objetivo) + Number(o.rpe)));
  if (f.rir_objetivo != null && o.rir) f.rir_objetivo = Math.max(0, Math.min(10, Number(f.rir_objetivo) + Number(o.rir)));
  return repsDe(f, o);
}

function repsDe(f, o) {
  if (o.reps) {
    if (f.reps_min != null) f.reps_min = Math.max(0, f.reps_min + Number(o.reps));
    if (f.reps_max != null) f.reps_max = Math.max(0, f.reps_max + Number(o.reps));
  }
  return f;
}

// Compatibilidad: «Duplicar con progresión» de antes ({ kg: número, reps, rir }) son kilos fijos
export function opcionesDe(progresion = {}) {
  if (progresion.kg === undefined && progresion.rpe === undefined) return { kg: 'igual', rpe: 0, rir: progresion.rir || 0, reps: progresion.reps || 0 };
  return { kg: progresion.kg ?? 'igual', rpe: progresion.rpe ?? 0, rir: progresion.rir ?? 0, reps: progresion.reps ?? 0 };
}
