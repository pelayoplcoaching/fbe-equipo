// «Programar según FBE»: serie top + back-off y peaking en los básicos. Solo las cuentas; quien decide con ellas
// es la progresión serie a serie (modelos.js).
//
// Cómo programa Pelayo los básicos (copia del 5/11/2026: 167 básicos hechos de 28 atletas): no usa el «top + back-off»
// de la app, sino serie a serie; en uno de cada tres la primera serie es la más pesada y las demás bajan un 5–10 % con
// más repeticiones. La top progresa como cualquier serie; las back-off las dejó igual en dos de cada tres y solo las
// movió cuando iban fáciles (RPE 7). Sus decisiones de ese día:
//   · Back-off: igual, salvo que vayan a RPE 7 o menos (entonces suben kilos). También en peaking.
//   · Peaking: solo en las semanas con ese foco. La top baja una repetición respecto a lo que hizo y lleva los kilos
//     que mantienen el esfuerzo, calculados desde su 1RM estimado y redondeados al salto. Baja hasta 1 repetición; al
//     llegar, solo se ajustan los kilos. Si la top salió muy dura (RPE por encima de 9), se repite tal cual.
// Añadido al construirlo: el esfuerzo que se mantiene no baja de RPE 8, y la subida de una semana a otra tiene tope (10 %).
import { saltoDe } from './lectura.js';

const dos = (x) => Math.round(x * 100) / 100;
// Epley con las repeticiones en reserva, como el resto de la app (una repetición sin reserva es el propio 1RM)
const unoRM = (kg, reps, reserva) => { const t = reps + reserva; return t <= 1 ? kg : kg * (1 + t / 30); };
const kgPara = (rm, reps, reserva) => { const t = reps + reserva; return t <= 1 ? rm : rm / (1 + t / 30); };

// ¿Qué series son la top? kgs: los kilos de cada serie, en orden (null o 0 si no lleva).
//   { tops: [índices a la carga más alta], forma: 'top_primero' | 'plana' | 'otra' } o null si ninguna lleva kilos
export function estructuraTop(kgs) {
  const con = (kgs || []).map((k, i) => [Number(k) || 0, i]).filter(([k]) => k > 0);
  if (!con.length) return null;
  const max = Math.max(...con.map(([k]) => k));
  const tops = con.filter(([k]) => k === max).map(([, i]) => i);
  if (tops.length === con.length) return { tops, forma: 'plana' };
  return { tops, forma: tops.length === 1 && tops[0] === con[0][1] ? 'top_primero' : 'otra' };
}

// La top de una semana de peaking, a partir de las series top que hizo (todas a la misma carga).
//   tops: [{ kg, reps, rpe (null si no lo apuntó), pautadas (repeticiones pautadas en esa serie, o null), objetivo (RPE pautado, o null) }]
// Devuelve { accion: 'dura' } o { accion: 'baja' | 'suelo', reps, kg, delta, rpe (el esfuerzo al que apunta), limitada }
export function topPeaking(tops, { nombre = '', reglas }) {
  const P = reglas.topSet.peaking, S = reglas.porSerie;
  const hechas = (tops || []).filter((t) => t && Number(t.kg) > 0 && Number(t.reps) > 0);
  if (!hechas.length) return null;
  if (hechas.some((t) => t.rpe != null && Number(t.rpe) > P.duraRpe)) return { accion: 'dura' };
  const kg = Math.max(...hechas.map((t) => Number(t.kg)));
  // Si no apuntó el esfuerzo, se supone el pautado; si tampoco hay, RPE 8
  const reservaDe = (t) => 10 - Number(t.rpe ?? t.objetivo ?? 8);
  // Se parte de la top más exigente (la de menor 1RM estimado): es la que marca hasta dónde llega
  const ref = hechas.map((t) => ({ ...t, rm: unoRM(Number(t.kg), Number(t.reps), reservaDe(t)) })).sort((a, b) => a.rm - b.rm)[0];
  const repsRef = Math.min(...hechas.map((t) => Math.min(Number(t.reps), t.pautadas != null ? Number(t.pautadas) : Number(t.reps))));
  const reps = repsRef <= P.suelo ? repsRef : Math.max(P.suelo, repsRef - P.reps);
  const enSuelo = reps === repsRef;
  // El esfuerzo que se mantiene: el que hizo, pero nunca por debajo de rpeMin (si la top fue fácil, la semana
  // siguiente no puede seguir siéndolo: sin ese suelo, con cargas ligeras el redondeo se come la subida semana tras
  // semana). O el pautado, si las reglas lo piden y lo hay.
  const rpe = P.rpe === 'pauta' && ref.objetivo != null ? Number(ref.objetivo) : Math.max(P.rpeMin, 10 - reservaDe(ref));
  const paso = saltoDe(nombre, kg, reglas);
  let nuevo = P.kilos === 'salto' ? (enSuelo ? kg : kg + paso) : Math.round(kgPara(ref.rm, reps, 10 - rpe) / paso) * paso;
  // En peaking la top nunca baja de kilos; y en el suelo, si fue fácil, sube un salto aunque la cuenta no lo dé
  nuevo = Math.max(kg, nuevo);
  if (enSuelo && nuevo === kg && ref.rpe != null && Number(ref.rpe) <= S.topeFacilRpe) nuevo = kg + paso;
  // Tope de subida de una semana a otra (como mínimo, un salto)
  const tope = Math.max(kg + paso, Math.floor((kg * (1 + P.maxPct / 100)) / paso) * paso);
  const limitada = nuevo > tope + 0.001;
  if (limitada) nuevo = tope;
  return { accion: enSuelo ? 'suelo' : 'baja', reps, kg: dos(nuevo), delta: dos(nuevo - kg), rpe, limitada };
}
