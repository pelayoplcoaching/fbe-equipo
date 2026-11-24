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
// (v0.227) Con la revisión del experto («claude/carrera-revision-experto-respuesta.md»):
//   · R42 Tope por salida (Frandsen 2025): una salida hecha más de un 10 % por encima de la más larga de los 30 días
//     anteriores (sin carreras) → aviso; más de un 30 % → aviso y que la semana siguiente no suba.
//   · R21 La subida brusca de la semana queda como aviso suave (nivel «info»): el fuerte es el de R42.
//   · R24/R28 Un solo juego de cortes de cumplimiento: 90 % o más, verde; 70-89 %, ámbar; menos del 70 %, rojo; más del 115 %,
//     de más (aviso y no sube). Quien apunta solo minutos, por minutos. El ajuste: menos del 70 % también baja un 25 %.
//   · R25 La tirada larga, por encima del tope de sus días (65 % con 2 salidas, 60 % con 3, 55 % con 4, 45 % con 5 o más).
//   · R27 La calidad o la tirada larga, el día después de pierna pesada (o dos días después con margen 2) → moverla; el día
//     antes, solo aviso; el mismo día vale (primero la carrera y la fuerza 3 horas después o más).
//   · Las carreras (las sesiones de tipo carrera) no cuentan en los km de la semana: se planifican sin ellas (R18).
import { sumarDias, lunesDe, diasEntre, desdeISO } from './fechas.js';
import { progresarSemana, LARGA_PCT_MAX, PICO_SALIDA } from './carrera-plan.js';

const DURAS = ['calidad', 'larga', 'carrera', 'test'];
const r1 = (x) => Math.round(x * 10) / 10;
const kmPlan = (s) => (s?.km_min != null || s?.km_max != null ? (Number(s.km_min ?? s.km_max) + Number(s.km_max ?? s.km_min)) / 2 : null);
const diaDe = (iso) => ((desdeISO(iso).getDay() + 6) % 7) + 1;
// (v0.227) Los minutos previstos de una semana del plan, si todas sus sesiones (sin la carrera) los traen; si no, null
export const minutosPlan = (s) => {
  const l = (s?.sesiones || []).filter((x) => x.tipo !== 'descanso' && x.tipo !== 'carrera');
  return l.length && l.every((x) => Number(x.minutos) > 0) ? l.reduce((a, x) => a + (x.minutos_max ? (x.minutos + x.minutos_max) / 2 : x.minutos), 0) : null;
};
// (R24, R28, R30) Lo que hizo de lo previsto: por km o, si apunta solo minutos, por minutos (0 si no salió; null si no se sabe)
export function cumplimientoSemana(w, semPlan) {
  if (!semPlan) return null;
  const k = kmPlan(semPlan);
  if (!w?.salidas) return k || minutosPlan(semPlan) ? 0 : null;
  if (w.conKm > 0 && k) return w.km / k;
  const m = minutosPlan(semPlan);
  return m && w.min > 0 ? w.min / m : null;
}
export const colorCumplimiento = (p) => (p == null ? null : p >= 0.9 ? 'verde' : p >= 0.7 ? 'ambar' : 'rojo');

// Lo hecho de cada semana: las n semanas que acaban en la de `hasta` (incluida), de la más antigua a la más nueva
export function resumenSemanas(hechas = [], hasta, n = 4) {
  const ultimo = lunesDe(hasta);
  const out = Array.from({ length: n }, (_, i) => ({ lunes: sumarDias(ultimo, -7 * (n - 1 - i)), km: 0, min: 0, salidas: 0, entrenos: 0, conKm: 0, larga: 0, dolorMax: null, verde: 0, ambar: 0, rojo: 0, duras: [] }));
  const por = Object.fromEntries(out.map((x) => [x.lunes, x]));
  for (const s of hechas || []) {
    const c = s?.cardio_hecho;
    const f = String(s?.fecha_realizada || '').slice(0, 10);
    if (!f || !c || c.modalidad !== 'carrera') continue;
    const w = por[lunesDe(f)];
    if (!w) continue;
    const km = Number(c.km) || 0;
    w.salidas++;
    // (las carreras, fuera de los km y de la salida más larga: el plan va sin ellas)
    if (s?.cardio?.tipo !== 'carrera') { w.km = r1(w.km + km); w.larga = Math.max(w.larga, km); w.min += (Number(c.minutos) || 0) + (Number(c.seg) || 0) / 60; w.entrenos++; }
    if (km > 0) w.conKm++;
    if (Number.isInteger(c.dolor)) w.dolorMax = Math.max(w.dolorMax ?? 0, c.dolor);
    if (c.semaforo === 'verde' || c.semaforo === 'ambar' || c.semaforo === 'rojo') w[c.semaforo]++;
    if (DURAS.includes(s?.cardio?.tipo)) w.duras.push(f);
  }
  return out;
}

// (v0.227, R5) Los km medios por semana de las n semanas terminadas antes de la de hoy (sin carreras); null sin salidas
export function kmMedio(hechas = [], hoy, n = 8) {
  if (!hoy) return null;
  const ws = resumenSemanas(hechas, sumarDias(lunesDe(hoy), -7), n);
  return ws.some((w) => w.salidas) ? r1(ws.reduce((a, w) => a + w.km, 0) / n) : null;
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
// → [{ id, nivel: 'rojo' | 'ambar' | 'info', titulo, texto, propuesta: { tipo: 'parar' | 'bajar' | 'tope' | 'rehacer' | 'mover', pct, lunes, km } }]
export function avisosCarrera({ semanas = [], hechas = [], hoy }) {
  if (!hoy) return [];
  const esta = lunesDe(hoy);
  const pasada = sumarDias(esta, -7);
  const [w3, w2, w1, w0] = resumenSemanas(hechas, esta, 4); // w0, la que va; w1, la pasada
  const plan = Object.fromEntries((semanas || []).map((s) => [s.lunes, s]));
  const fecha = (l) => l.slice(8, 10).replace(/^0/, '') + '/' + l.slice(5, 7).replace(/^0/, '');
  const avisos = [];
  // (R42) Una salida más de un 10 % por encima de la más larga de los 30 días anteriores (sin contar carreras), la pasada o esta
  const salidas = (hechas || []).map((x) => ({ f: String(x?.fecha_realizada || '').slice(0, 10), km: Number(x?.cardio_hecho?.km) || 0, vale: x?.cardio_hecho?.modalidad === 'carrera' && x?.cardio?.tipo !== 'carrera' }))
    .filter((x) => x.vale && x.f && x.km > 0);
  let pico = null;
  for (const r of salidas) {
    if (r.f < pasada || r.f > sumarDias(esta, 6)) continue;
    const ref = Math.max(0, ...salidas.filter((y) => y.f < r.f && y.f >= sumarDias(r.f, -30)).map((y) => y.km));
    if (ref >= 3 && r.km > ref * PICO_SALIDA + 0.05 && (!pico || r.km / ref > pico.km / pico.ref)) pico = { ...r, ref };
  }
  if (pico) {
    const fuerte = pico.km > pico.ref * 1.3;
    const lunesPico = lunesDe(pico.f);
    const wPico = lunesPico === esta ? w0 : w1;
    avisos.push({ id: 'salida', nivel: 'ambar', titulo: 'Una salida mucho más larga de lo habitual',
      texto: `El ${fecha(pico.f)} corrió ${r1(pico.km)} km, un ${Math.round((pico.km / pico.ref - 1) * 100)} % más que su salida más larga del mes anterior (${r1(pico.ref)} km). Pasar de un 10 % se asocia a más lesiones por sobrecarga.`,
      propuesta: fuerte ? { tipo: 'tope', pct: 0, lunes: sumarDias(lunesPico, 7), km: r1(wPico.km), texto: `Que la semana siguiente no suba (${Math.round(wPico.km)} km como mucho)` } : null });
  }
  // (R21) Subida brusca (la pasada frente a las dos anteriores): aviso suave
  const media = (w2.km + w3.km) / 2;
  if (media >= 5 && w1.km > media * 1.3) {
    avisos.push({ id: 'subida', nivel: 'info', titulo: 'Subida brusca de kilómetros',
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
  // (R24) Cumplimiento: dos semanas seguidas en rojo (por debajo del 70 %), por km o, si apunta solo minutos, por minutos
  const p1 = cumplimientoSemana(w1, plan[w1.lunes]), p2 = cumplimientoSemana(w2, plan[w2.lunes]);
  if (p1 != null && p2 != null && p1 < 0.7 && p2 < 0.7) {
    avisos.push({ id: 'cumplimiento', nivel: 'ambar', titulo: 'Por debajo de lo previsto',
      texto: `Dos semanas seguidas por debajo del 70 % de lo previsto (${Math.round(p2 * 100)} % y ${Math.round(p1 * 100)} %).`,
      propuesta: { tipo: 'rehacer', texto: 'Rehacer el plan desde esta semana' } });
  } else if (p1 != null && p1 > 1.15) {
    avisos.push({ id: 'exceso', nivel: 'ambar', titulo: 'Más de lo previsto',
      texto: `La semana del ${fecha(pasada)} hizo el ${Math.round(p1 * 100)} % de lo previsto: hacer de más también es un riesgo. Mejor no subir esta semana.`, propuesta: null });
  }
  // (R25) La tirada larga, por encima del tope de sus días
  const nSal = Math.min(6, Math.max(2, w1.entrenos));
  if (w1.entrenos >= 2 && w1.km >= 10 && w1.larga > w1.km * LARGA_PCT_MAX[nSal] + 0.05) {
    avisos.push({ id: 'larga', nivel: 'ambar', titulo: 'Tirada larga muy larga para su semana',
      texto: `${r1(w1.larga)} km de ${r1(w1.km)} en la semana del ${fecha(pasada)}: más del ${Math.round(LARGA_PCT_MAX[nSal] * 100)} % con ${w1.entrenos} salidas.`, propuesta: null });
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
  if (!siguiente || (!previsto && !minutosPlan(plan[evaluada]))) return null;
  // (R28) Lo que hizo de lo previsto, por km o (si apunta solo minutos) por minutos; null si no se sabe: deciden el semáforo y el dolor
  const pct = cumplimientoSemana(w, plan[evaluada]);
  const fuera = (w.dolorMax ?? 0) >= 6 || (w.dolorMax != null && w2.dolorMax != null && w.dolorMax > w2.dolorMax && w2.dolorMax > 0 && w.dolorMax >= 3);
  const deLo = (p) => `Hizo el ${Math.round(p * 100)} % de lo previsto`;
  let decision, motivo;
  if (w.rojo || fuera) { decision = 'bajar'; motivo = w.rojo ? 'Algún semáforo en rojo' : 'Dolor fuera de lo que se acepta'; }
  else if (pct != null && pct < 0.7) { decision = 'bajar'; motivo = w.salidas ? deLo(pct) : 'No apuntó ninguna carrera'; }
  else if (pct != null && pct > 1.15) { decision = 'repetir'; motivo = `${deLo(pct)}: más de lo previsto, mejor no subir`; }
  else if (w.ambar) { decision = 'repetir'; motivo = 'Algún semáforo en ámbar'; }
  else if (pct == null) { decision = 'seguir'; motivo = 'Todo en verde (sin datos para comparar con lo previsto)'; }
  else if (pct < 0.9) { decision = 'repetir'; motivo = deLo(pct); }
  else { decision = 'seguir'; motivo = `Todo en verde y el ${Math.round(pct * 100)} % de lo previsto`; }
  let nueva = null;
  // Repetir: la semana siguiente, con el volumen de la evaluada (en km o, si el plan va en minutos, en minutos)
  const kSig = kmPlan(siguiente), mSig = minutosPlan(siguiente), mEv = minutosPlan(plan[evaluada]);
  const igualA = kSig && previsto ? previsto / kSig : !kSig && !previsto && mSig && mEv ? mEv / mSig : null;
  if (decision === 'bajar') nueva = progresarSemana(siguiente, -25);
  else if (decision === 'repetir' && igualA != null && igualA < 1) nueva = progresarSemana(siguiente, Math.round((igualA - 1) * 100));
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

// (R27) Choques con la fuerza: la calidad o la tirada larga el día después de pierna pesada (con margen 2, también dos días
// después: «más de 60», nuevo en la fuerza o con agujetas) → moverla a un día libre; el día antes, solo aviso; el mismo día
// vale, con la carrera primero y la fuerza 3 horas después o más (aviso para recordarlo).
// fuerza: [{ dia (1-7), pierna: true/false, nombre }]; carreras: [{ dia, tipo, titulo }]
// → [{ carrera, fuerza, tipo: 'despues' | 'antes' | 'mismo', propuesta (día libre, solo en «despues») }]
export function choquesFuerza({ fuerza = [], carreras = [], margen = 1 }) {
  const pierna = fuerza.filter((f) => f.pierna && f.dia).map((f) => f.dia);
  const ocupados = new Set([...fuerza.map((f) => f.dia), ...carreras.map((c) => c.dia)].filter(Boolean));
  const malo = (d) => pierna.some((p) => (d - p >= 1 && d - p <= margen) || p - d === 1);
  const out = [];
  for (const c of carreras) {
    if (!c.dia || !['calidad', 'larga'].includes(c.tipo)) continue;
    const despues = fuerza.find((x) => x.pierna && x.dia && c.dia - x.dia >= 1 && c.dia - x.dia <= margen);
    if (despues) {
      // Un día libre que no sea de los de después de pierna (ni el de antes) ni esté pegado a otra sesión dura
      const duras = carreras.filter((x) => x !== c && DURAS.includes(x.tipo) && x.dia).map((x) => x.dia);
      const libre = [1, 2, 3, 4, 5, 6, 7].find((d) => d !== c.dia && !ocupados.has(d) && !malo(d) && !duras.some((x) => Math.abs(x - d) <= 1)) || null;
      out.push({ carrera: c, fuerza: despues, tipo: 'despues', propuesta: libre });
      continue;
    }
    const antes = fuerza.find((x) => x.pierna && x.dia && x.dia - c.dia === 1);
    if (antes) { out.push({ carrera: c, fuerza: antes, tipo: 'antes', propuesta: null }); continue; }
    const mismo = fuerza.find((x) => x.pierna && x.dia === c.dia);
    if (mismo) out.push({ carrera: c, fuerza: mismo, tipo: 'mismo', propuesta: null });
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
    avisos, nivel: avisos.some((a) => a.nivel === 'rojo') ? 'rojo' : avisos.some((a) => a.nivel === 'ambar') ? 'ambar' : 'verde',
  };
}
export { diaDe as diaDeFecha };
