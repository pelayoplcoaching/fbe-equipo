// v0.53: el objetivo de días de entreno por semana (atletas.dias_semana, migración 031). Para quien lleva microciclos
// que no caben en una semana natural (4 sesiones por «semana» del programa, repartidas a 3 días por semana), la
// constancia, la racha, los anillos y el resto de lo semanal se cuentan por semanas de lunes a domingo con ese objetivo.
// Sin objetivo (null, «Automático»), todo sale exactamente como antes: cada semana del programa, con sus sesiones.
import { lunesDe, sumarDias, hoyISO } from './fechas.js';

export const DIAS_SEMANA = [1, 2, 3, 4, 5, 6, 7];
// 1 a 7, o null (automático) para cualquier otra cosa
export function diasSemanaValido(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : null;
}
export const textoDiasSemana = (n) => (n === 1 ? '1 día por semana' : `${n} días por semana`);

// Cada semana que cuenta, de la más antigua a la más reciente: [{ lunes, objetivo, hechas, completa }].
//  · semanas: las semanas del programa que cuentan (publicadas, de bloques no cancelados): [{ id, fecha_inicio, bloque_id }]
//  · sesiones: todas las de esas semanas, hechas o no: [{ id, semana_id, completada, fecha_realizada }] (fechas de Madrid)
// Sin objetivo: cada semana del programa por su lunes (objetivo = sus sesiones; hechas = las terminadas, se hicieran el
// día que fuera), también las futuras; las que no tienen sesiones no salen. Es lo de siempre.
// Con objetivo (diasSemana de 1 a 7), por semanas naturales, de la primera con algo que hacer hasta la de hoy:
//  · hechas: las sesiones distintas terminadas esa semana (por su fecha_realizada; sin ella, el día que empezó su semana)
//  · objetivo: diasSemana, o menos si esa semana no había tantas por hacer (al final de un bloque, o si aún no estaba
//    publicada la siguiente). «Por hacer» son las de semanas ya empezadas (su fecha_inicio, como mucho el domingo) que
//    seguían pendientes al empezar la semana, más las que hizo en ella; las pendientes de un bloque dejan de contar
//    cuando empieza el siguiente. Una semana sin nada por hacer no sale (no suma ni rompe), como las de descanso
//    entre bloques; las de antes de su primer bloque, tampoco.
//  · completa: hechas >= objetivo
export function semanasObjetivo({ diasSemana = null, sesiones = [], semanas = [], hoy = hoyISO() } = {}) {
  const dias = diasSemanaValido(diasSemana);
  const sem = new Map((semanas || []).filter((w) => w?.id).map((w) => [w.id, w]));
  // Una sesión una vez (por si llega repetida)
  const vistas = new Set();
  const lista = (sesiones || []).filter((s) => s && sem.has(s.semana_id) && !vistas.has(s.id) && vistas.add(s.id));
  if (!dias) {
    const por = new Map();
    for (const s of lista) {
      const w = sem.get(s.semana_id);
      if (!w.fecha_inicio) continue;
      const k = lunesDe(w.fecha_inicio);
      const x = por.get(k) || { lunes: k, objetivo: 0, hechas: 0 };
      x.objetivo++;
      if (s.completada) x.hechas++;
      por.set(k, x);
    }
    return [...por.values()].sort((a, b) => (a.lunes < b.lunes ? -1 : 1)).map((x) => ({ ...x, completa: x.hechas >= x.objetivo }));
  }
  const actual = lunesDe(hoy);
  // Cuándo empieza cada bloque (su primera semana) y, para las pendientes de uno, cuándo empieza el siguiente
  const inicioBloque = new Map();
  for (const w of sem.values()) {
    if (!w.fecha_inicio) continue;
    const k = w.bloque_id ?? '';
    const l = lunesDe(w.fecha_inicio);
    if (!inicioBloque.has(k) || l < inicioBloque.get(k)) inicioBloque.set(k, l);
  }
  const inicios = [...new Set(inicioBloque.values())].sort();
  const siguienteDe = (k) => { const i = inicioBloque.get(k); return i == null ? null : inicios.find((x) => x > i) || null; };
  const datos = lista.map((s) => {
    const w = sem.get(s.semana_id);
    const hecha = s.completada ? (s.fecha_realizada ? String(s.fecha_realizada).slice(0, 10) : w.fecha_inicio || null) : null;
    return { id: s.id, completada: !!s.completada, hecha, empieza: w.fecha_inicio || null, hasta: siguienteDe(w.bloque_id ?? '') };
  });
  const primeras = [...datos.filter((x) => x.hecha).map((x) => lunesDe(x.hecha)), ...datos.filter((x) => x.empieza).map((x) => lunesDe(x.empieza))];
  if (!primeras.length) return [];
  const desde = primeras.sort()[0];
  const out = [];
  for (let l = desde; l <= actual; l = sumarDias(l, 7)) {
    const fin = sumarDias(l, 6);
    let hechas = 0, porHacer = 0;
    for (const x of datos) {
      const estaSemana = !!x.hecha && x.hecha >= l && x.hecha <= fin;
      if (estaSemana) hechas++;
      // Por hacer: la hizo esta semana, o su semana ya había empezado y seguía pendiente al empezar esta (y su bloque
      // no ha dado paso al siguiente; si la hizo, contaba hasta que la hizo)
      const pendienteAlEmpezar = !!x.empieza && x.empieza <= fin && (!x.completada || (x.hecha && x.hecha >= l)) && (x.completada || !x.hasta || l < x.hasta);
      if (estaSemana || pendienteAlEmpezar) porHacer++;
    }
    const objetivo = Math.min(dias, porHacer);
    if (!objetivo) continue;
    out.push({ lunes: l, objetivo, hechas, completa: hechas >= objetivo });
  }
  return out;
}

// Lo mismo, como lo leen racha(), rachaMaxima(), semanasCompletas(), calendarioRacha() y «Tu mes»: [{ fecha_inicio, total, hechas }]
export const paraRacha = (lista = []) => (lista || []).map((x) => ({ fecha_inicio: x.lunes, total: x.objetivo, hechas: x.hechas }));
// La semana de hoy (o null si no hay nada que hacer en ella)
export const semanaEnCurso = (lista = [], hoy = hoyISO()) => (lista || []).find((x) => x.lunes === lunesDe(hoy)) || null;

// La semana del programa que enseña Hoy a quien va por microciclos: la primera (por su número) con algo pendiente, aunque
// por fechas ya hubiera pasado (va a su ritmo, no al del calendario); si lo tiene todo hecho, la de siempre (actual).
export function semanaDelMicrociclo(semanas = [], sesionesPorSemana = {}, actual = null) {
  const orden = [...(semanas || [])].sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
  return orden.find((w) => (sesionesPorSemana?.[w.id] || []).some((s) => !s.completada)) || actual;
}

// Las sesiones de la semana de hoy (de lunes a domingo) para la hoja de la constancia: las hechas en ella (de cualquier
// semana del programa) y, detrás, las siguientes pendientes por orden hasta llegar al objetivo.
export function sesionesDeLaSemana(semanas = [], sesionesPorSemana = {}, objetivo = 0, hoy = hoyISO()) {
  const l = lunesDe(hoy), fin = sumarDias(l, 6);
  const orden = [...(semanas || [])].sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
  const todas = orden.flatMap((w) => [...(sesionesPorSemana?.[w.id] || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)));
  const hechas = todas.filter((s) => s.completada && s.fecha_realizada >= l && s.fecha_realizada <= fin).sort((a, b) => (a.fecha_realizada < b.fecha_realizada ? -1 : 1));
  const pendientes = todas.filter((s) => !s.completada).slice(0, Math.max(0, objetivo - hechas.length));
  return [...hechas, ...pendientes];
}
