// FBE Esencial (alta, 31): sus días de entreno. Qué días de la semana entrena (1 lunes … 7 domingo), mejor que no vayan
// seguidos, y en qué fecha cae cada sesión de sus semanas (es lo que usa el aviso «Hoy toca»). Lógica pura.
import { sumarDias, lunesDe } from './fechas.js';

export const DIAS_SEMANA = [[1, 'L', 'lunes'], [2, 'M', 'martes'], [3, 'X', 'miércoles'], [4, 'J', 'jueves'], [5, 'V', 'viernes'], [6, 'S', 'sábado'], [7, 'D', 'domingo']];

// «lunes y jueves»
export function nombreDias(dias = []) {
  const ns = [...new Set(dias)].sort((a, b) => a - b).map((d) => DIAS_SEMANA[d - 1]?.[2]).filter(Boolean);
  return ns.length > 1 ? `${ns.slice(0, -1).join(', ')} y ${ns.at(-1)}` : ns[0] || '';
}

// ¿Van seguidos? (también el domingo y el lunes, de una semana a la siguiente)
export function seguidos(dias = []) {
  const d = [...new Set(dias)].sort((a, b) => a - b);
  return d.some((x, i) => i > 0 && x - d[i - 1] === 1) || (d.length > 1 && d.includes(7) && d.includes(1));
}

// Una propuesta que no va seguida, según cuántas sesiones tenga por semana
export const PROPUESTA_DIAS = { 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6] };

// El día de la semana de una fecha (1 lunes … 7 domingo)
export const diaDeSemana = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay() || 7;

// Los días que ya tiene puestos en una semana (sus sesiones con día), si los tiene todos
export function diasDeSemana(sesiones = []) {
  const ss = sesiones.filter((s) => s.dia_previsto);
  if (!ss.length || ss.length !== sesiones.length) return null;
  return [...new Set(ss.map((s) => diaDeSemana(String(s.dia_previsto).slice(0, 10))))].sort((a, b) => a - b);
}

// Qué sesiones poner en qué día: [{ id, dia }]. De las semanas publicadas desde esta (las pasadas no se tocan), sin las
// hechas ni los días que ya han pasado, y solo en las semanas con tantas sesiones como días elegidos (la sesión 1, el
// primer día; la 2, el segundo…). soloSinDia: sin tocar las que ya tienen día (para las semanas que prepara la app).
export function planDias({ semanas = [], sesiones = {}, dias = [], hoy, soloSinDia = false }) {
  const d = [...new Set(dias)].sort((a, b) => a - b);
  if (!d.length || !hoy) return [];
  const lunes = lunesDe(hoy);
  const cambios = [];
  for (const w of semanas) {
    if (!w.fecha_inicio || w.fecha_inicio < lunes || (w.programacion && w.programacion !== 'programada')) continue;
    const ss = [...(sesiones[w.id] || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    if (ss.length !== d.length) continue;
    ss.forEach((s, k) => {
      const dia = sumarDias(w.fecha_inicio, d[k] - 1);
      if (s.completada || dia < hoy || (soloSinDia && s.dia_previsto) || String(s.dia_previsto || '').slice(0, 10) === dia) return;
      cambios.push({ id: s.id, dia });
    });
  }
  return cambios;
}

// Lo elegido, en este móvil (para las semanas que prepare la app después)
export const claveDias = (atletaId) => `fbe-esencial-dias:${atletaId}`;
export function leerDias(atletaId) {
  try { const v = JSON.parse(localStorage.getItem(claveDias(atletaId)) || 'null'); return Array.isArray(v?.dias) && v.dias.length ? v.dias : null; } catch { return null; }
}
export function guardarDias(atletaId, dias) {
  try { localStorage.setItem(claveDias(atletaId), JSON.stringify({ dias: [...new Set(dias)].sort((a, b) => a - b) })); } catch { /* sin almacenamiento */ }
}
