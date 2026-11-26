// FBE Esencial (v0.258, el día a día: D2, D3 y D5 de «claude/motores-siguientes-reglas.md»): lo que propone la app según
// cómo llega a la sesión («¿Cómo llegas hoy?» de un toque, logica/preparacion.js). Lo del día se propone con un toque
// («Hacerlo así» o «Entrenar normal», P2): nada cambia hasta que lo elige. Con seguimiento, no se usa (G1: la app no toca
// su programación; esos atletas siguen con las tres preguntas y su consejo). Lógica pura.
import { caraDe, esUnToque } from './preparacion.js';

// (D1) Las tres caras y las horas de sueño (como la migración 110: de 2 a 14, de media en media hora; D4: con menos de 6,
// «Bien» cuenta como «Regular», en caraDe de logica/preparacion.js)
export const CARAS = [['bien', 'Bien'], ['regular', 'Regular'], ['mal', 'Mal']];
export const HORAS = { min: 2, max: 14, paso: 0.5 };
export const HORAS_POCAS = 6;

// (D3) La sesión mínima: los 2 o 3 principales, con 1 o 2 series cada uno (criterio de Claude: hasta 3, con 2 series)
export const MINIMA = { ejercicios: 3, series: 2 };

const tipos = (e) => {
  const t = e?.ejercicio?.tipo ?? e?.tipo ?? [];
  return Array.isArray(t) ? t : t ? [t] : [];
};
const conSeries = (xs) => (xs || []).filter((e) => e && Number(e.series) > 0);

// Lo principal de una sesión (D3), en su orden: lo obligatorio (prioridad «alta»), los básicos y los multiarticulares;
// como mucho 3 y al menos 2 (si no hay tantos, los siguientes de la sesión). Lo prescindible, nunca.
export function principalesDe(pautas = []) {
  const xs = conSeries(pautas).filter((e) => e.prioridad !== 'muy_baja');
  const peso = (e) => (e.prioridad === 'alta' ? 0 : tipos(e).includes('basico') ? 1 : tipos(e).includes('multiarticular') ? 2 : 9);
  const fuertes = xs.map((e, i) => ({ e, i, p: peso(e) })).filter((x) => x.p < 9).sort((a, b) => a.p - b.p || a.i - b.i).slice(0, MINIMA.ejercicios);
  const ids = new Set(fuertes.map((x) => x.e.id));
  for (const e of xs) { if (ids.size >= 2) break; ids.add(e.id); }
  // en el orden de la sesión
  return xs.filter((e) => ids.has(e.id));
}

// Los accesorios (D2): los de aislamiento y lo que tiene prioridad «Accesorio» o «Prescindible»; lo obligatorio, nunca
export function accesoriosDe(pautas = []) {
  return conSeries(pautas).filter((e) => e.prioridad !== 'alta' && (['baja', 'muy_baja'].includes(e.prioridad) || tipos(e).includes('aislamiento')));
}

// La propuesta del día: null (nada que proponer) o { tipo, ids, texto, porque }
//   'minima' (llega mal): solo lo principal, con 2 series como mucho (ids: los que quedan)
//   'regular' (llega regular o ha dormido menos de 6 horas): los kilos de la última vez y una serie menos en los
//     accesorios que tienen 2 o más (ids: los que pierden una serie)
//   'agujetas' (llega bien, pero con agujetas fuertes en lo de hoy): un calentamiento más largo y no sube la carga
export function propuestaDelDia(p, pautas = []) {
  if (!esUnToque(p)) return null;
  const c = caraDe(p);
  const xs = conSeries(pautas);
  if (!xs.length) return null;
  if (c === 'mal') {
    const ps = principalesDe(xs);
    return { tipo: 'minima', ids: ps.map((e) => e.id), texto: `Hoy, solo lo principal (${ps.map((e) => nombre(e).toLowerCase()).join(', ')}), con ${MINIMA.series} series como mucho y los kilos de la última vez.`, porque: 'Una sola serie por ejercicio ya basta para mantener la fuerza: una sesión mínima mantiene el hábito sin forzar.' };
  }
  if (c === 'regular') {
    const as = accesoriosDe(xs).filter((e) => Number(e.series) >= 2);
    return { tipo: 'regular', ids: as.map((e) => e.id), texto: as.length ? `Los kilos de la última vez y una serie menos en ${as.map((e) => nombre(e).toLowerCase()).join(', ')}.` : 'Los kilos de la última vez, sin subir. Lo demás, como está.', porque: 'Ajustar el día a cómo llegas funciona al menos igual de bien que ir siempre con lo pautado, y lo principal se mantiene.' };
  }
  if (p.agujetas) return { tipo: 'agujetas', ids: [], texto: 'Un calentamiento más largo y, hoy, los kilos de la última vez.', porque: 'Con agujetas fuertes, el músculo rinde algo menos unos días: mejor no subir hoy y calentar bien.' };
  return null;
}
const nombre = (e) => e?.ejercicio?.nombre || e?.nombre || 'Ejercicio';

// La sesión con la propuesta puesta (solo si eligió «Hacerlo así»): la mínima deja lo principal con 2 series; la de un día
// regular quita una serie a esos accesorios. Las series pautadas una a una se recortan igual.
const recorta = (e, n) => {
  const s = Math.max(1, Math.min(Number(e.series) || 1, n));
  const det = Array.isArray(e.series_detalle) && e.series_detalle.length ? e.series_detalle.slice(0, s) : e.series_detalle ?? null;
  return { ...e, series: s, series_detalle: det };
};
// hechas: { pautaId: { numero: serie } } (lo que ya se ha hecho no desaparece: un ejercicio con series hechas se queda, con
// sus series como mínimo)
export function aplicarPropuesta(pautas = [], prop = null, hechas = {}) {
  if (!prop || !Array.isArray(pautas)) return pautas;
  const n = (e) => Object.keys(hechas?.[e.id] || {}).length;
  if (prop.tipo === 'minima') {
    const ids = new Set(prop.ids);
    return pautas.filter((e) => ids.has(e.id) || n(e) > 0).map((e) => recorta(e, Math.max(ids.has(e.id) ? MINIMA.series : 0, n(e))));
  }
  if (prop.tipo === 'regular' && prop.ids.length) {
    const ids = new Set(prop.ids);
    return pautas.map((e) => (ids.has(e.id) ? recorta(e, Math.max(Number(e.series) - 1, n(e))) : e));
  }
  return pautas;
}

// (D5) El calentamiento largo: el de «¿Cuánto tiempo tienes hoy?» con dos pasos más
export const PASOS_AGUJETAS = ['5 minutos de cardio suave (bici, remo o andar rápido)', 'Una serie de aproximación más en cada ejercicio, con poco peso'];
export function calentamientoLargo(pasos = []) {
  const xs = Array.isArray(pasos) ? pasos.filter((p) => !/^2 minutos de cardio suave/.test(p)) : [];
  return [PASOS_AGUJETAS[0], ...xs.filter((p) => !/aproximaci/.test(p)), PASOS_AGUJETAS[1]];
}
