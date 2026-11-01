// «Tu bloque» (v0.48, como la vista del programa entero de Hevy o TrainingPeaks): todas las semanas del bloque,
// hechas, la actual y las que vienen; de las que el coach aún no ha publicado, solo que están «por publicar» (sin
// nada de lo que llevan). Y, de los ejercicios principales (prioridad Obligatorio), la carga pautada y la hecha
// semana a semana.
import { hoyISO, sumarDias, lunesDe } from './fechas.js';

// Lo más pesado pautado en una pauta (series iguales, serie a serie o la top)
const kgPauta = (p) => {
  const det = Array.isArray(p.series_detalle) ? p.series_detalle.map((x) => Number(x?.kg)).filter((x) => x > 0) : [];
  if (det.length) return Math.max(...det);
  const k = Number(p.carga_sugerida_kg);
  return k > 0 ? k : null;
};

// d: { bloque, todas: [{ numero, fecha_inicio, publicada }] (bloque_semanas), semanas (las publicadas, con id),
//      sesiones: { semana_id: [sesion] }, pautas: [sesion_ejercicio], series: [serie], ejercicios: { id: { nombre } } }
export function vistaBloque(d, hoy = hoyISO()) {
  const publicadas = new Map((d.semanas || []).map((w) => [w.numero, w]));
  const lista = (d.todas?.length ? d.todas : (d.semanas || []).map((w) => ({ numero: w.numero, fecha_inicio: w.fecha_inicio, publicada: true })))
    .slice().sort((a, b) => a.numero - b.numero);
  const lunesHoy = lunesDe(hoy);
  const semanas = lista.map((x) => {
    const w = x.publicada ? publicadas.get(x.numero) || null : null;
    const sesiones = w ? (d.sesiones?.[w.id] || []).slice().sort((a, b) => (a.orden || 0) - (b.orden || 0)) : [];
    const inicio = x.fecha_inicio || w?.fecha_inicio || null;
    const fin = inicio ? sumarDias(inicio, 6) : null;
    const hechas = sesiones.filter((s) => s.completada).length;
    let estado;
    if (!w) estado = 'por_publicar';
    else if (inicio && lunesDe(inicio) === lunesHoy) estado = 'actual';
    else if (fin && fin < hoy) estado = hechas >= sesiones.length && sesiones.length ? 'hecha' : 'pasada';
    else estado = 'siguiente';
    return {
      numero: x.numero, fecha_inicio: inicio, estado, publicada: !!w, id: w?.id || null,
      foco: w?.foco || null, descarga: w?.foco === 'descarga',
      sesiones: sesiones.map((s) => ({ id: s.id, nombre: s.nombre, completada: !!s.completada, tipo: s.tipo || 'fuerza' })),
      hechas, total: sesiones.length,
    };
  });
  // Ejercicios principales: los de prioridad alta (Obligatorio) de las semanas publicadas, con lo pautado y lo
  // hecho cada semana (lo hecho con ese mismo ejercicio: si lo cambió por otro, no cuenta aquí)
  const sesionSemana = {};
  for (const w of semanas) for (const s of w.sesiones) sesionSemana[s.id] = w.numero;
  const seriesPorPauta = {};
  for (const s of d.series || []) if (!s.sustituto_id && Number(s.reps) > 0) (seriesPorPauta[s.sesion_ejercicio_id] ||= []).push(s);
  const ejercicios = new Map();
  for (const p of d.pautas || []) {
    if (p.prioridad !== 'alta' || !(p.sesion_id in sesionSemana)) continue;
    const n = sesionSemana[p.sesion_id];
    const e = ejercicios.get(p.ejercicio_id) || { id: p.ejercicio_id, nombre: d.ejercicios?.[p.ejercicio_id]?.nombre || 'Ejercicio', semanas: {} };
    const x = e.semanas[n] || { pautado: null, hecho: null };
    const kp = kgPauta(p);
    if (kp != null) x.pautado = Math.max(x.pautado ?? 0, kp);
    const hechas = (seriesPorPauta[p.id] || []).map((s) => Number(s.kg)).filter((k) => k > 0);
    if (hechas.length) x.hecho = Math.max(x.hecho ?? 0, ...hechas);
    e.semanas[n] = x;
    ejercicios.set(p.ejercicio_id, e);
  }
  const principales = [...ejercicios.values()].map((e) => ({
    ...e,
    puntos: semanas.filter((w) => w.publicada).map((w) => ({ numero: w.numero, pautado: e.semanas[w.numero]?.pautado ?? null, hecho: e.semanas[w.numero]?.hecho ?? null })),
  })).filter((e) => e.puntos.some((p) => p.pautado != null || p.hecho != null)).slice(0, 6);
  const total = semanas.reduce((t, w) => t + w.total, 0), hechasTotal = semanas.reduce((t, w) => t + w.hechas, 0);
  return { bloque: d.bloque, semanas, principales, hechas: hechasTotal, total, porPublicar: semanas.filter((w) => w.estado === 'por_publicar').length };
}
