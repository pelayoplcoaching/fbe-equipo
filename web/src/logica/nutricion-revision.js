// La revisión de cada 4 semanas en la app (v0.253, N4, migración 106). Lo que necesita revisionNutricion (nutricion-motor.js,
// reglas R26-R34 del documento «claude/nutricion-motor-reglas.md») sacado de lo que ya carga la app, la fuerza como señal
// (R32), las bajadas seguidas (R33), quién no tiene revisión (R36) y los textos de cada revisión guardada
// (nutricion_revisiones). Lógica pura: la cargan solo las pantallas de la revisión (ui/atleta/NutricionRevision.jsx).
// Probado en test/nutricion-revision.test.mjs.
import { sumarDias, lunesDe, diasEntre, fmtConDia } from './fechas.js';
import { e1rmPorSemana, signo } from './calculos.js';
import { fmtKcal } from './nutricion.js';
import { revisionNutricion, proximaRevision, pesoDeReferencia, gastoReal, scoffPositivo, ADHERENCIA } from './nutricion-motor.js';

const n = (v) => (v == null || v === '' ? null : Number(String(v).replace(',', '.')));
// La más reciente primero (a igual fecha, la última creada)
export const ordenRevisiones = (revs = []) => [...(revs || [])].sort((a, b) => (a.fecha !== b.fecha ? (a.fecha < b.fecha ? 1 : -1) : String(a.creado_en || '') < String(b.creado_en || '') ? 1 : -1));
export const ultimaRevision = (revs = []) => { const u = ordenRevisiones(revs)[0]; return u ? { fecha: u.fecha, tipo: u.tipo } : null; };
// El día de la siguiente (como la base: proximaRevision con la última)
export const cuandoToca = (plan, revs = []) => proximaRevision(plan, ultimaRevision(revs));

// R36: con antecedente de TCA o el SCOFF positivo, su plan es para mantener y no se le pide que se pese: no hay revisión
// (sin pesadas saldría siempre «simplificar»)
export const sinRevision = ({ tca = false, cuestionario = null } = {}) => tca === true || cuestionario?.tca === true || scoffPositivo(cuestionario?.nutricion_salud?.scoff || {});

// R32 (lo de cómo, criterio): ¿caen sus marcas 3 semanas seguidas? De las 4 últimas semanas enteras (de lunes a domingo, la
// última la de antes de esta), el mejor 1RM estimado de cada ejercicio en cada una (e1rmPorSemana, como en Progreso); con al
// menos 2 ejercicios hechos las 4 semanas, la media de lo que cambia cada uno de una semana a la siguiente: si las tres veces
// baja más de un 0,5 % (lo que el motor de entreno ya separa del ruido de redondeo), caen. series: api.historial
export function fuerzaCae(series = [], hoy) {
  const lunes = lunesDe(hoy);
  const semanas = [28, 21, 14, 7].map((d) => sumarDias(lunes, -d));
  const porEj = new Map();
  for (const s of series || []) {
    if (!s?.ejercicio_id || !s.fecha || s.fecha < semanas[0] || s.fecha >= lunes) continue;
    if (!porEj.has(s.ejercicio_id)) porEj.set(s.ejercicio_id, []);
    porEj.get(s.ejercicio_id).push(s);
  }
  const filas = [];
  for (const ss of porEj.values()) {
    const m = new Map(e1rmPorSemana(ss).map((x) => [x.semana, x.valor]));
    const v = semanas.map((w) => m.get(w));
    if (v.every((x) => x > 0)) filas.push(v);
  }
  if (filas.length < 2) return false;
  for (let i = 1; i < 4; i++) if (!(filas.reduce((a, v) => a + v[i] / v[i - 1], 0) / filas.length < 0.995)) return false;
  return true;
}

// R33: cuántas bajadas seguidas lleva, de la última revisión hacia atrás: «bien», «recomposición» y «sube» cortan la cuenta;
// las que no cambian nada porque no pueden («suelo», «profesional», «simplificar», «faltan datos»), no. Solo desde su plan
// de partida (el último que no salió de una revisión: rehacer el cuestionario empieza de cero)
export function bajadasSeguidas(revisiones = [], planes = [], hoy = null) {
  const deRevision = new Set((revisiones || []).map((r) => r.plan_id).filter(Boolean));
  const partida = (planes || []).filter((p) => p?.desde && (!hoy || p.desde <= hoy) && !deRevision.has(p.id)).map((p) => p.desde).sort().pop() || '';
  let k = 0;
  for (const r of ordenRevisiones(revisiones)) {
    if (r.fecha < partida) break;
    if (r.tipo === 'baja') k++;
    else if (r.tipo === 'bien' || r.tipo === 'recomposicion' || r.tipo === 'sube') break;
  }
  return k;
}

// Lo que necesita revisionNutricion. r: api.resumenNutricion (su plan, sus planes y sus registros y pesos de 12 semanas);
// perfil: el de nutrición (sexo, altura, pocos hidratos, bebidas); medidas: api.medidas (la cintura); revisiones: las suyas
// (106); series: api.historial (la fuerza). El suelo del 25 %, con el mantenimiento de su plan o, si sale más alto, su gasto
// real (R10 y R15; nunca más bajo que el de la base, que pone el mismo tope)
export function datosParaRevision({ r, perfil = null, medidas = [], revisiones = [], series = [], hoy }) {
  const plan = r?.plan;
  if (!plan || plan.mantenimiento == null) return null;
  const objetivo = plan.fase === 'perder' || plan.fase === 'ganar' ? plan.fase : 'mantener';
  const cinturas = (medidas || []).filter((m) => n(m.cintura_cm) > 0 && m.fecha <= hoy).map((m) => ({ fecha: m.fecha, cm: n(m.cintura_cm) })).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const pesos = (r.pesos || []).filter((p) => n(p.kg) > 0);
  const pesoHoy = n(r.pesoKg) || n(pesos[pesos.length - 1]?.kg);
  const ref = pesoDeReferencia({ peso: pesoHoy, altura: perfil?.altura, cintura: cinturas[cinturas.length - 1]?.cm ?? null });
  const g = gastoReal({ registros: r.registros || [], pesos, plan }, hoy);
  return {
    plan: { kcal: n(plan.kcal), proteina_g: n(plan.proteina_g), desde: plan.desde, objetivo, ritmo_pct: n(plan.ritmo_pct) ?? 0, mantenimiento: n(plan.mantenimiento) },
    sexo: perfil?.sexo || null, pesoRef: ref?.kg ?? pesoHoy, mant: Math.max(n(plan.mantenimiento) || 0, n(g.kcal) || 0) || null,
    registros: r.registros || [], pesos, cinturas, fuerzaCae: objetivo === 'perder' ? fuerzaCae(series, hoy) : false,
    bajadasSeguidas: bajadasSeguidas(revisiones, r.planes || [], hoy), pocosHidratos: !!perfil?.pocos_hidratos, bebidasSemana: n(perfil?.bebidas_semana) || 0,
    ultima: ultimaRevision(revisiones), hoy,
  };
}
// La revisión de hoy (o null si aún no toca o no la hay): lo que manda la app a la base
export function revisionDeHoy(entrada) {
  if (!entrada) return null;
  const res = revisionNutricion(entrada);
  if (!res || res.tipo === 'esperar') return null;
  if ((res.tipo === 'baja' || res.tipo === 'sube') && !res.nuevo) return null;
  return res;
}

// Pesadas de esta semana (de lunes a hoy, una por día) y si toca medirse la cintura (cada 2 semanas)
export const pesadasSemana = (pesos = [], hoy) => new Set((pesos || []).filter((p) => p.fecha >= lunesDe(hoy) && p.fecha <= hoy && n(p.kg) > 0).map((p) => p.fecha)).size;
export function tocaCintura(medidas = [], hoy) {
  const ult = (medidas || []).filter((m) => n(m.cintura_cm) > 0 && m.fecha <= hoy).map((m) => m.fecha).sort().pop();
  return !ult || diasEntre(ult, hoy) >= 14;
}

// ---------- Los textos de una revisión guardada (nutricion_revisiones) ----------
export const TITULO_REVISION = {
  bien: 'Seguimos igual', recomposicion: 'Seguimos igual', suelo: 'Ya estás en tu mínimo', profesional: 'Mejor que lo mire un profesional',
  simplificar: 'No tocamos tus kcal', datos: 'Faltan pesadas',
};
const pct = (x) => `${signo(Math.round(x * 100) / 100, 2)} %`;
// → { titulo, tono: 'ok' | 'cambio' | 'aviso', cifras: [texto], siguiente: 'el lun 21 dic' }
export function textoRevision(rev, plan = null) {
  if (!rev) return null;
  const cambio = rev.tipo === 'baja' || rev.tipo === 'sube';
  const titulo = cambio ? `Tu plan ${rev.tipo === 'baja' ? 'baja' : 'sube'} a ${fmtKcal(rev.kcal_despues)} kcal` : TITULO_REVISION[rev.tipo] || 'Tu revisión';
  const tono = cambio ? 'cambio' : rev.tipo === 'bien' || rev.tipo === 'recomposicion' ? 'ok' : 'aviso';
  const cifras = [];
  if (rev.dias_cumplidos != null) cifras.push(`${rev.dias_cumplidos} de ${ADHERENCIA.ventana} días con tu plan`);
  if (rev.ritmo_real != null) {
    const prev = n(rev.ritmo_previsto);
    const quieto = Math.abs(n(rev.ritmo_real)) < 0.005;
    cifras.push(`Tu peso: ${quieto ? 'sin cambios' : `${pct(n(rev.ritmo_real))} a la semana`}${prev == null ? '' : prev === 0 ? ' (buscábamos mantenerlo)' : ` (buscábamos ${pct(prev)}${quieto ? ' a la semana' : ''})`}`);
  }
  if (rev.cintura_cambio != null) cifras.push(`Tu cintura: ${n(rev.cintura_cambio) === 0 ? 'igual' : `${signo(n(rev.cintura_cambio), 1)} cm`} en 4 semanas`);
  if (cambio) cifras.push(`Antes, ${fmtKcal(rev.kcal_antes)} kcal; la proteína no cambia`);
  const prox = plan ? proximaRevision(plan, { fecha: rev.fecha, tipo: rev.tipo }) : null;
  return { titulo, tono, cifras, siguiente: prox ? fmtConDia(prox) : null };
}
// Para «Tus revisiones» (en «Tu plan»): una línea por revisión
export function lineaRevision(rev) {
  const t = textoRevision(rev);
  return t ? `${fmtConDia(rev.fecha)}: ${t.titulo}${rev.dias_cumplidos != null ? ` (${rev.dias_cumplidos} de ${ADHERENCIA.ventana} días)` : ''}` : '';
}
// ¿Se enseña su tarjeta en Hoy? La última, si es de los últimos 7 días y no la ha cerrado
export function revisionReciente(revs = [], hoy, vista = () => false) {
  const u = ordenRevisiones(revs)[0];
  return u && diasEntre(u.fecha, hoy) <= 7 && !vista(u.id) ? u : null;
}
