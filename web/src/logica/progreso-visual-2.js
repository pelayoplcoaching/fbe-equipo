// (v0.204) Lo que se calcula para la segunda tanda de belleza de progreso y seguimiento (sin pantalla, para poder
// probarlo): el periodo anterior detrás de una gráfica, comparar ejercicios en %, tus cifras frente a las 4 semanas de
// antes, los días de la semana, los récords y check-ins del mapa de constancia, la escalera de un récord, los músculos
// con récord, la próxima medalla, los trofeos nuevos, el peso y las medidas de una foto, el bloque frente al anterior,
// el esfuerzo de cada serie y la actividad del coach por semanas.
import { num, tendenciaPeso, MEDIDAS } from './calculos.js';
import { RANGOS_GRAFICA, filtrarRango } from './rangos.js';
import { sumarDias, lunesDe, diasEntre } from './fechas.js';
import { pesoTxt } from './unidades.js';

// ---------- el periodo anterior, en fantasma detrás de la línea
// Los puntos del periodo de antes del rango (del mismo largo), movidos hacia delante para caer debajo de los de ahora.
// semanal: los puntos van por lunes (se mueven semanas enteras). Sin rango (Todo) o con menos de dos puntos, nada.
export function periodoAnterior(puntos = [], rango, hoy, { clave = 'x', semanal = false } = {}) {
  const dias = RANGOS_GRAFICA.find(([k]) => k === rango)?.[2];
  if (!dias) return [];
  const salto = semanal ? Math.round(dias / 7) * 7 : dias;
  const finAntes = sumarDias(hoy, -salto);
  const antes = filtrarRango(puntos, rango, finAntes, { clave, semanal });
  if (antes.length < 2) return [];
  return antes.map((p) => ({ ...p, [clave]: sumarDias(p[clave], salto) }));
}

// ---------- comparar ejercicios
// El 1RM estimado de cada uno, en % desde su primera semana del rango: [{ id, nombre, puntos: [{ x, y }], cambio }]
export function compararEjercicios(ejercicios = [], ids = [], rango, hoy) {
  return ids.map((id) => (ejercicios || []).find((e) => e.id === id)).filter(Boolean).map((e) => {
    const pts = filtrarRango(e.puntos || [], rango, hoy, { clave: 'semana', semanal: true }).filter((p) => Number(p.valor) > 0);
    if (pts.length < 2) return null;
    const base = Number(pts[0].valor);
    const puntos = pts.map((p) => ({ x: p.semana, y: Math.round(((Number(p.valor) / base) - 1) * 1000) / 10 }));
    return { id: e.id, nombre: e.nombre, puntos, cambio: puntos[puntos.length - 1].y };
  }).filter(Boolean);
}

// ---------- tus cifras, frente a las 4 semanas de antes
// semanas: los resúmenes semanales (de la más reciente a la más antigua, solo las que tienen algo). Las 4 últimas
// semanas acabadas y las 4 de antes: series, récords y días entrenados de cada tramo (null el de antes si no hay nada)
export function cifrasFrente(semanas = [], hoy) {
  const lunesHoy = lunesDe(hoy);
  const corte = sumarDias(lunesHoy, -28), inicio = sumarDias(lunesHoy, -56);
  const tramo = (lista) => ({
    series: lista.reduce((t, r) => t + (r.series || 0), 0),
    records: lista.reduce((t, r) => t + (r.records?.length || 0), 0),
    dias: lista.reduce((t, r) => t + (r.dias?.length || 0), 0),
    semanas: lista.length,
  });
  const ult = (semanas || []).filter((r) => r.lunes >= corte && r.lunes < lunesHoy);
  const antes = (semanas || []).filter((r) => r.lunes >= inicio && r.lunes < corte);
  return { ahora: tramo(ult), antes: antes.length ? tramo(antes) : null, ult };
}
// (belleza 178) Las 8 semanas acabadas, de la más antigua a la última, para la minigráfica de detrás de cada cifra (por el
// icono de su cifra): semanas completas (1 o 0), días entrenados, series y récords de cada semana
export function serieCifras(semanas = [], hoy) {
  const lunesHoy = lunesDe(hoy), desde = sumarDias(lunesHoy, -56);
  const ult = (semanas || []).filter((r) => r.lunes >= desde && r.lunes < lunesHoy).sort((a, b) => (a.lunes < b.lunes ? -1 : a.lunes > b.lunes ? 1 : 0));
  return {
    llama: ult.map((r) => (r.sesiones?.total > 0 && r.sesiones.hechas >= r.sesiones.total ? 1 : 0)),
    calendario: ult.map((r) => r.dias?.length || 0),
    hoy: ult.map((r) => r.series || 0),
    trofeo: ult.map((r) => r.records?.length || 0),
  };
}
// La flecha de una cifra: { dir: 'sube' | 'baja' | 'igual', texto: '+12' }
export function flechaCifra(v, antes) {
  if (antes == null || !Number.isFinite(v)) return null;
  const d = v - antes;
  return { dir: d > 0 ? 'sube' : d < 0 ? 'baja' : 'igual', d, texto: d > 0 ? `+${num(d, 0)}` : d < 0 ? `−${num(-d, 0)}` : '=' };
}

// ---------- los días de una semana
// Los 7 días (de lunes a domingo) con si entrenó: [{ iso, letra, si }]
const LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const NOMBRES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export function diasDeSemana(lunes, dias = []) {
  const si = new Set(dias || []);
  return LETRAS.map((letra, i) => { const iso = sumarDias(lunes, i); return { iso, letra, nombre: NOMBRES[i], si: si.has(iso) }; });
}
export function textoDiasSemana(lunes, dias = []) {
  const si = diasDeSemana(lunes, dias).filter((d) => d.si).map((d) => d.nombre);
  if (!si.length) return 'Sin días entrenados';
  return `Entrenaste ${si.length === 1 ? si[0] : `${si.slice(0, -1).join(', ')} y ${si[si.length - 1]}`}`;
}

// ---------- el mapa de constancia, con récords y check-ins
// Los días con récord (de los eventos de récord) y los días en que envió su check-in (el día que lo envió o, como muy
// tarde, el lunes siguiente a su semana, como en la actividad del coach)
export const diasConRecord = (eventos = []) => [...new Set((eventos || []).map((e) => e.fecha).filter(Boolean))].sort();
export function diasCheckin(checkins = []) {
  return [...new Set((checkins || []).map((c) => [c.creado_en ? String(c.creado_en).slice(0, 10) : null, c.semana_inicio ? sumarDias(c.semana_inicio, 7) : null].filter(Boolean).sort()[0]).filter(Boolean))].sort();
}

// ---------- la escalera de un récord
// veces (de la más reciente a la más antigua, como las da historiaRecords): los escalones de la más antigua a la última,
// cada uno con su cifra corta y su altura (de 0,3 a 1, subiendo)
export function escaleraRecords(veces = []) {
  const orden = [...(veces || [])].reverse();
  const n = orden.length;
  return orden.map((v, i) => ({
    ...v,
    cifra: v.record?.tipo === 'e1rm' ? pesoTxt(v.record.valor, 1) : v.record?.tipo === 'kg' ? `${pesoTxt(v.record.kg, 2)} × ${v.record.reps}` : v.record?.tipo === 'reps' ? `${v.record.reps} rep` : '',
    alto: n === 1 ? 1 : Math.round((0.3 + (0.7 * i) / (n - 1)) * 100) / 100,
  }));
}

// ---------- los músculos con récord (últimos 30 días)
// recientes: los récords de la vitrina; ejercicios: los de progreso (con sus grupos). Cuenta el grupo principal.
export function musculosRecord(recientes = [], ejercicios = []) {
  const grupos = Object.fromEntries((ejercicios || []).map((e) => [e.id, e.grupos_musculares || []]));
  const out = {};
  for (const r of recientes || []) { const g = (grupos[r.ejercicio_id] || [])[0]; if (g) out[g] = (out[g] || 0) + 1; }
  return out;
}

// ---------- la próxima medalla
// La que está más cerca (más progreso hacia la siguiente, sin tenerlas todas): su id, o null
export function proximaMedalla(lista = []) {
  const cand = (lista || []).filter((l) => l.siguiente && l.progreso > 0 && l.progreso < 1);
  if (!cand.length) return null;
  return cand.reduce((a, l) => (l.progreso > a.progreso || (l.progreso === a.progreso && l.siguiente.falta < a.siguiente.falta) ? l : a)).id;
}

// ---------- los trofeos nuevos (desde la última vez que entró)
// vistos: { ejercicioId: fecha del último récord que vio } (null la primera vez: entonces ninguno, para no encender
// todos de golpe). Devuelve los ids con un récord posterior al visto.
export function trofeosNuevos(ejercicios = [], vistos = null) {
  if (!vistos) return [];
  return (ejercicios || []).filter((x) => x.ultimoRecord && (!vistos[x.id] || x.ultimoRecord > vistos[x.id])).map((x) => x.id);
}
export const trofeosVistos = (ejercicios = []) => Object.fromEntries((ejercicios || []).filter((x) => x.ultimoRecord).map((x) => [x.id, x.ultimoRecord]));

// ---------- el peso y las medidas de una foto
// La tendencia de peso de ese día (la última pesada de como mucho 7 días antes): número o null
export function pesoEnFecha(pesos = [], fecha, maxDias = 7) {
  const tend = tendenciaPeso(pesos || []);
  const p = [...tend].reverse().find((x) => x.fecha <= fecha);
  return p && diasEntre(p.fecha, fecha) <= maxDias ? p.tendencia : null;
}
// Entre dos fotos (antes y después): el cambio de peso (tendencia) y de cada medida (la toma más cercana a cada foto,
// como mucho a 21 días): [{ k, t, antes, despues, cambio, u }]
export function cambiosEntreFotos({ pesos = [], medidas = [] } = {}, fa, fd) {
  if (!fa || !fd) return [];
  const out = [];
  const pa = pesoEnFecha(pesos, fa), pd = pesoEnFecha(pesos, fd);
  if (pa != null && pd != null) out.push({ k: 'peso', t: 'Peso', antes: pa, despues: pd, cambio: Math.round((pd - pa) * 10) / 10, u: 'kg' });
  const cerca = (k, f) => {
    const xs = (medidas || []).filter((m) => m[k] != null && Number.isFinite(Number(m[k])) && Math.abs(diasEntre(m.fecha, f)) <= 21);
    return xs.sort((a, b) => Math.abs(diasEntre(a.fecha, f)) - Math.abs(diasEntre(b.fecha, f)))[0] || null;
  };
  for (const [k, t] of MEDIDAS) {
    const a = cerca(k, fa), d = cerca(k, fd);
    if (a && d && a.fecha !== d.fecha) out.push({ k, t, antes: Number(a[k]), despues: Number(d[k]), cambio: Math.round((Number(d[k]) - Number(a[k])) * 10) / 10, u: 'cm' });
  }
  return out;
}

// ---------- el bloque frente al anterior
// Lo que se compara de un informe de bloque con el siguiente más antiguo
export function resumenAnterior(r) {
  if (!r || r.vacio) return null;
  return {
    numero: r.bloque?.numero ?? null, nombre: r.bloque?.nombre || '',
    sesiones: r.sesiones?.hechas ?? 0, pctSeries: r.cumplimiento?.series?.pct ?? null, series: r.series || 0, tonelaje: r.tonelaje || 0, records: r.records?.length || 0,
    e1rm: Object.fromEntries((r.principales || []).map((p) => [p.ejercicio_id, p.fin?.e1rm ?? null])),
  };
}

// ---------- el esfuerzo de cada serie (el registro del coach)
// Frente a lo pautado: 'suave' (más de medio punto por debajo), 'justo', 'pasado' (más de medio punto por encima) o
// 'sin' (sin RPE o sin objetivo); 'corto' si se quedó por debajo de las repeticiones
export function esfuerzoSerie(p = {}, h = {}) {
  if (p.reps_min != null && Number(h.reps) < Number(p.reps_min)) return 'corto';
  const e = h.rpe != null && h.rpe !== '' ? Number(h.rpe) : h.rir != null && h.rir !== '' ? 10 - Number(h.rir) : null;
  const obj = p.rpe_objetivo != null ? Number(p.rpe_objetivo) : p.rir_objetivo != null ? 10 - Number(p.rir_objetivo) : null;
  if (e == null || obj == null) return 'sin';
  return e > obj + 0.5 ? 'pasado' : e < obj - 0.5 ? 'suave' : 'justo';
}
// El tono del esfuerzo de una sesión (su RPE de 1 a 10)
export const tonoEsfuerzo = (rpe) => (rpe == null || !(Number(rpe) > 0) ? 'sin' : Number(rpe) >= 9 ? 'duro' : Number(rpe) >= 7 ? 'medio' : 'suave');

// ---------- la actividad del coach, por semanas
// Las cifras de cada semana (por su lunes) de la lista de actividad: sesiones, récords, check-in y última pesada
export function semanasActividad(eventos = []) {
  const out = {};
  for (const e of eventos || []) {
    if (!e.fecha) continue;
    const w = (out[lunesDe(e.fecha)] ||= { lunes: lunesDe(e.fecha), sesiones: 0, records: 0, checkin: false, kg: null, fechaKg: null });
    if (e.tipo === 'sesion') w.sesiones++;
    else if (e.tipo === 'record') w.records++;
    else if (e.tipo === 'checkin') w.checkin = true;
    else if (e.tipo === 'peso' && e.kg != null && (!w.fechaKg || e.fecha > w.fechaKg)) { w.kg = e.kg; w.fechaKg = e.fecha; }
  }
  return out;
}
export function textoSemanaActividad(w) {
  if (!w) return '';
  return [
    `${w.sesiones} ${w.sesiones === 1 ? 'sesión' : 'sesiones'}`,
    w.records ? `${w.records} ${w.records === 1 ? 'récord' : 'récords'}` : null,
    w.checkin ? 'check-in enviado' : 'sin check-in',
    w.kg != null ? `${num(w.kg)} kg` : null,
  ].filter(Boolean).join(', ');
}
// Los récords de un mismo día, juntos (una tarjeta si son dos o más): la lista de días con sus elementos ya agrupados
export function agruparRecords(items = []) {
  const out = [];
  const recs = (items || []).filter((e) => e.tipo === 'record');
  let puesto = false;
  for (const e of items || []) {
    if (e.tipo !== 'record' || recs.length < 2) { out.push(e); continue; }
    if (puesto) continue;
    puesto = true;
    out.push({ tipo: 'records', fecha: e.fecha, icono: 'trofeo', pestana: e.pestana, titulo: `${recs.length} récords`, records: recs });
  }
  return out;
}
