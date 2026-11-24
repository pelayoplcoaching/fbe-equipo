// v0.222: carrera, tanda 3 de las 20 mejoras: los avisos de riesgo (9), el ajuste propuesto de la semana siguiente (10),
// los choques con la fuerza (11) y el resumen de cada corredor para el panel (12). Todo puro. Reglas de
// «claude/carrera-reglas-propuesta.md», aprobadas por Pelayo el 24/11/2026:
//   · Subida brusca: una semana con más de un 30 % de km sobre la media de las dos anteriores → que la siguiente no suba
//     más de un 10 % (Nielsen 2014).
//   · Dolor, el modelo de la web (Thomeé 1997, Silbernagel 2007): hasta 5/10 se acepta si se va a la mañana siguiente y no
//     empeora de semana a semana. Con 6/10 o más → parar y valorar; si empeora de semana a semana → bajar un 20-30 %.
//   · Semáforo antes de salir: dos ámbar o un rojo en la semana → una semana más suave (un 25 % menos).
//   · Cumplimiento: dos semanas seguidas por debajo del 70 % de los km previstos → «Rehacer desde aquí».
//   · Tirada larga de más del 35 % de la semana (con 3 salidas o más) → aviso. Dos días duros seguidos → aviso.
//   · Choques con la fuerza: calidad o tirada larga el día antes o el día después de pierna pesada → moverla.
//   · Ajuste de la semana siguiente: todo en verde y 90 % o más de los km → seguir; algún ámbar o entre el 70 y el 90 % →
//     repetir el volumen; rojo o dolor fuera del modelo → bajar un 20-30 %.
import { sumarDias, lunesDe, diasEntre, desdeISO } from './fechas.js';
import { progresarSemana } from './carrera-plan.js';

const DURAS = ['calidad', 'larga', 'carrera', 'test'];
const r1 = (x) => Math.round(x * 10) / 10;
const kmPlan = (s) => (s?.km_min != null || s?.km_max != null ? (Number(s.km_min ?? s.km_max) + Number(s.km_max ?? s.km_min)) / 2 : null);
const diaDe = (iso) => ((desdeISO(iso).getDay() + 6) % 7) + 1;

// Lo hecho de cada semana: las n semanas que acaban en la de `hasta` (incluida), de la más antigua a la más nueva
export function resumenSemanas(hechas = [], hasta, n = 4) {
  const ultimo = lunesDe(hasta);
  const out = Array.from({ length: n }, (_, i) => ({ lunes: sumarDias(ultimo, -7 * (n - 1 - i)), km: 0, salidas: 0, conKm: 0, larga: 0, dolorMax: null, verde: 0, ambar: 0, rojo: 0, duras: [] }));
  const por = Object.fromEntries(out.map((x) => [x.lunes, x]));
  for (const s of hechas || []) {
    const c = s?.cardio_hecho;
    const f = String(s?.fecha_realizada || '').slice(0, 10);
    if (!f || !c || c.modalidad !== 'carrera') continue;
    const w = por[lunesDe(f)];
    if (!w) continue;
    const km = Number(c.km) || 0;
    w.km = r1(w.km + km); w.salidas++; w.larga = Math.max(w.larga, km);
    if (km > 0) w.conKm++;
    if (Number.isInteger(c.dolor)) w.dolorMax = Math.max(w.dolorMax ?? 0, c.dolor);
    if (c.semaforo === 'verde' || c.semaforo === 'ambar' || c.semaforo === 'rojo') w[c.semaforo]++;
    if (DURAS.includes(s?.cardio?.tipo)) w.duras.push(f);
  }
  return out;
}

// Dos sesiones duras en días seguidos (fechas o días de la semana 1-7)
function seguidas(dias) {
  const d = [...new Set(dias)].sort();
  for (let i = 1; i < d.length; i++) {
    const a = d[i - 1], b = d[i];
    const dif = typeof a === 'number' ? b - a : diasEntre(a, b);
    if (dif === 1) return [a, b];
  }
  return null;
}

// Los avisos de un corredor, mirando la última semana terminada (y la que va, para el semáforo) y el plan de la que viene.
// → [{ id, nivel: 'rojo' | 'ambar', titulo, texto, propuesta: { tipo: 'parar' | 'bajar' | 'tope' | 'rehacer' | 'mover', pct, lunes, km } }]
export function avisosCarrera({ semanas = [], hechas = [], hoy }) {
  if (!hoy) return [];
  const esta = lunesDe(hoy);
  const pasada = sumarDias(esta, -7);
  const [w3, w2, w1, w0] = resumenSemanas(hechas, esta, 4); // w0, la que va; w1, la pasada
  const plan = Object.fromEntries((semanas || []).map((s) => [s.lunes, s]));
  const fecha = (l) => l.slice(8, 10).replace(/^0/, '') + '/' + l.slice(5, 7).replace(/^0/, '');
  const avisos = [];
  // Subida brusca (la pasada frente a las dos anteriores)
  const media = (w2.km + w3.km) / 2;
  if (media >= 5 && w1.km > media * 1.3) {
    avisos.push({ id: 'subida', nivel: 'ambar', titulo: 'Subida brusca de kilómetros',
      texto: `La semana del ${fecha(pasada)} corrió ${r1(w1.km)} km, un ${Math.round((w1.km / media - 1) * 100)} % más que la media de las dos anteriores (${r1(media)} km).`,
      propuesta: { tipo: 'tope', pct: 10, lunes: esta, km: r1(w1.km * 1.1), texto: `Que esta semana no pase de ${Math.round(w1.km * 1.1)} km (un 10 % más)` } });
  }
  // Dolor: fuera del modelo
  const dolorW = [w1, w0].filter((w) => w.dolorMax != null);
  const peor = dolorW.length ? Math.max(...dolorW.map((w) => w.dolorMax)) : null;
  if (peor != null && peor >= 6) {
    avisos.push({ id: 'dolor-alto', nivel: 'rojo', titulo: `Dolor de ${peor}/10`,
      texto: 'Con 6/10 o más (o si cambia su forma de correr), mejor parar y valorarlo antes de seguir.', propuesta: { tipo: 'parar', texto: 'Parar y valorar' } });
  } else if (w1.dolorMax != null && w2.dolorMax != null && w1.dolorMax > w2.dolorMax && w2.dolorMax > 0 && w1.dolorMax >= 3) {
    avisos.push({ id: 'dolor-sube', nivel: 'ambar', titulo: 'El dolor va a más',
      texto: `De ${w2.dolorMax}/10 a ${w1.dolorMax}/10 de una semana a otra: el dolor que se acepta es el que no empeora.`,
      propuesta: { tipo: 'bajar', pct: 25, lunes: esta, texto: 'Bajar un 25 % esta semana' } });
  }
  // Semáforo antes de salir (la pasada o la que va)
  const sem = [w0, w1].find((w) => w.rojo >= 1 || w.ambar >= 2);
  if (sem) {
    const cual = sem === w0 ? 'Esta semana' : `La semana del ${fecha(pasada)}`;
    avisos.push({ id: 'semaforo', nivel: 'ambar', titulo: 'Semáforo antes de salir',
      texto: `${cual}: ${[sem.rojo ? `${sem.rojo} en rojo` : '', sem.ambar ? `${sem.ambar} en ámbar` : ''].filter(Boolean).join(' y ')}.`,
      propuesta: { tipo: 'bajar', pct: 25, lunes: sem === w0 ? sumarDias(esta, 7) : esta, texto: `Una semana más suave (un 25 % menos) ${sem === w0 ? 'la que viene' : 'esta'}` } });
  }
  // Cumplimiento: dos semanas seguidas por debajo del 70 %
  // (sin juzgar por km una semana con salidas pero sin km apuntados: quien apunta solo minutos)
  const pct = (w) => { const k = kmPlan(plan[w.lunes]); return k && (w.conKm > 0 || w.salidas === 0) ? w.km / k : null; };
  const p1 = pct(w1), p2 = pct(w2);
  if (p1 != null && p2 != null && p1 < 0.7 && p2 < 0.7) {
    avisos.push({ id: 'cumplimiento', nivel: 'ambar', titulo: 'Por debajo de lo previsto',
      texto: `Dos semanas seguidas por debajo del 70 % de los km previstos (${Math.round(p2 * 100)} % y ${Math.round(p1 * 100)} %).`,
      propuesta: { tipo: 'rehacer', texto: 'Rehacer el plan desde esta semana' } });
  }
  // Tirada larga de más del 35 %
  if (w1.salidas >= 3 && w1.km >= 10 && w1.larga > w1.km * 0.35) {
    avisos.push({ id: 'larga', nivel: 'ambar', titulo: 'Tirada larga muy larga para su semana',
      texto: `${r1(w1.larga)} km de ${r1(w1.km)} en la semana del ${fecha(pasada)}: más del 35 %.`, propuesta: null });
  }
  // Dos días duros seguidos: lo hecho la pasada o lo previsto para esta
  const hechasSeguidas = seguidas(w1.duras);
  const previstas = seguidas((plan[esta]?.sesiones || []).filter((x) => DURAS.includes(x.tipo) && x.dia).map((x) => x.dia));
  if (hechasSeguidas || previstas) {
    avisos.push({ id: 'seguidas', nivel: 'ambar', titulo: 'Dos días duros seguidos',
      texto: previstas ? 'En el plan de esta semana hay dos sesiones duras (calidad, tirada larga o carrera) en días seguidos.' : 'La semana pasada hizo dos sesiones duras en días seguidos.',
      propuesta: previstas ? { tipo: 'mover', lunes: esta, texto: 'Separarlas un día' } : null });
  }
  return avisos;
}

// El ajuste de la semana siguiente con lo que hizo en una (por defecto, la pasada): 'seguir', 'repetir' o 'bajar'
// → { decision, motivo, lunes (la semana que se ajusta), nueva (la semana ajustada, si cambia algo) }
export function ajusteSiguiente({ semanas = [], hechas = [], hoy, lunes = null }) {
  const evaluada = lunesDe(lunes || sumarDias(lunesDe(hoy), -7));
  const siguienteL = sumarDias(evaluada, 7);
  const plan = Object.fromEntries((semanas || []).map((s) => [s.lunes, s]));
  const [w2, w] = resumenSemanas(hechas, evaluada, 2);
  const previsto = kmPlan(plan[evaluada]);
  const siguiente = plan[siguienteL] || null;
  if (!previsto || !siguiente) return null;
  // Sin km apuntados (solo minutos), no se mira el porcentaje: deciden los semáforos y el dolor
  const pct = w.salidas > 0 && w.conKm === 0 ? null : w.km / previsto;
  const fuera = (w.dolorMax ?? 0) >= 6 || (w.dolorMax != null && w2.dolorMax != null && w.dolorMax > w2.dolorMax && w2.dolorMax > 0 && w.dolorMax >= 3);
  let decision, motivo;
  if (w.rojo || fuera) { decision = 'bajar'; motivo = w.rojo ? 'Algún semáforo en rojo' : 'Dolor fuera de lo que se acepta'; }
  else if (w.ambar) { decision = 'repetir'; motivo = 'Algún semáforo en ámbar'; }
  else if (pct == null) { decision = 'seguir'; motivo = 'Todo en verde (sin km apuntados, solo minutos)'; }
  else if (pct < 0.9) { decision = 'repetir'; motivo = w.salidas ? `Hizo el ${Math.round(pct * 100)} % de los km previstos` : 'No apuntó ninguna carrera'; }
  else { decision = 'seguir'; motivo = `Todo en verde y el ${Math.round(pct * 100)} % de los km`; }
  let nueva = null;
  const kSig = kmPlan(siguiente);
  if (decision === 'bajar') nueva = progresarSemana(siguiente, -25);
  else if (decision === 'repetir' && kSig && kSig > previsto) nueva = progresarSemana(siguiente, Math.round((previsto / kSig - 1) * 100));
  return { decision, motivo, evaluada, lunes: siguienteL, pct: pct == null ? null : Math.round(pct * 100), nueva: nueva ? { ...nueva, lunes: siguienteL } : null };
}

// Aplicar una propuesta a la semana del plan que toca: 'bajar' (un pct % menos) o 'tope' (que no pase de km)
export function aplicarPropuesta(propuesta, semana) {
  if (!propuesta || !semana) return null;
  if (propuesta.tipo === 'bajar') return { ...progresarSemana(semana, -(propuesta.pct || 25)), lunes: semana.lunes };
  if (propuesta.tipo === 'tope') {
    const k = kmPlan(semana);
    const max = Number(semana.km_max ?? semana.km_min);
    if (!k || !(max > propuesta.km)) return null;
    return { ...progresarSemana(semana, Math.round((propuesta.km / max - 1) * 100)), lunes: semana.lunes };
  }
  return null;
}

// Choques con la fuerza: la calidad o la tirada larga el día antes o el día después de pierna pesada.
// fuerza: [{ dia (1-7), pierna: true/false, nombre }]; carreras: [{ dia, tipo, titulo }] → [{ carrera, fuerza, propuesta (dia libre) }]
export function choquesFuerza({ fuerza = [], carreras = [] }) {
  const pierna = fuerza.filter((f) => f.pierna && f.dia).map((f) => f.dia);
  const ocupados = new Set([...fuerza.map((f) => f.dia), ...carreras.map((c) => c.dia)].filter(Boolean));
  const out = [];
  for (const c of carreras) {
    if (!c.dia || !['calidad', 'larga'].includes(c.tipo)) continue;
    const f = fuerza.find((x) => x.pierna && x.dia && Math.abs(x.dia - c.dia) === 1);
    if (!f) continue;
    // Un día libre que no esté pegado a pierna ni a otra sesión dura
    const duras = carreras.filter((x) => x !== c && DURAS.includes(x.tipo) && x.dia).map((x) => x.dia);
    const libre = [1, 2, 3, 4, 5, 6, 7].find((d) => d !== c.dia && !ocupados.has(d) && !pierna.some((p) => Math.abs(p - d) <= 1) && !duras.some((x) => Math.abs(x - d) <= 1)) || null;
    out.push({ carrera: c, fuerza: f, propuesta: libre });
  }
  return out;
}
// Si una sesión de fuerza es «pierna pesada»: la mitad o más de sus series, de pierna (cuádriceps, isquios o glúteo)
const PIERNA = /cu[a\u00e1]drice|isquio|gl[u\u00fa]te|pierna|aductor/i;
export function esPiernaPesada(ejercicios = []) {
  let pierna = 0, total = 0;
  for (const e of ejercicios || []) {
    const series = Number(e?.series) || 1;
    total += series;
    if ((e?.grupos_musculares || []).some((g) => PIERNA.test(g))) pierna += series;
  }
  return total >= 3 && pierna / total >= 0.5;
}

// El resumen de un corredor para el panel del coach: los km de esta semana frente al plan, sus semáforos, la próxima
// carrera y sus avisos
export function resumenCorredor({ semanas = [], hechas = [], eventos = [], hoy }) {
  const esta = lunesDe(hoy);
  const [, w0] = resumenSemanas(hechas, esta, 2);
  const plan = (semanas || []).find((s) => s.lunes === esta) || null;
  const proxima = (eventos || []).filter((e) => e.fecha >= hoy && e.decision !== 'no').sort((a, b) => (a.fecha < b.fecha ? -1 : 1))[0] || null;
  const avisos = avisosCarrera({ semanas, hechas, hoy });
  return {
    km: w0.km, salidas: w0.salidas, plan: plan ? { km_min: plan.km_min, km_max: plan.km_max, sesiones: (plan.sesiones || []).filter((x) => x.tipo !== 'descanso').length } : null,
    semaforos: { verde: w0.verde, ambar: w0.ambar, rojo: w0.rojo }, proxima, dias: proxima ? diasEntre(hoy, proxima.fecha) : null,
    avisos, nivel: avisos.some((a) => a.nivel === 'rojo') ? 'rojo' : avisos.length ? 'ambar' : 'verde',
  };
}
export { diaDe as diaDeFecha };
