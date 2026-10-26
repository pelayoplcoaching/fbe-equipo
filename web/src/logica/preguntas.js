// Check-in a medida: qué apartados se preguntan a cada atleta y las preguntas propias del coach (migración 011)
import { num, leerNumero } from './calculos.js';
import { textoVisible } from './texto.js';

export const APARTADOS_CHECKIN = [
  ['peso', 'Peso'], ['descanso', 'Descanso y motivación'], ['molestias', 'Molestias'],
  ['alimentacion', 'Alimentación'], ['medidas', 'Medidas (cada 4 semanas)'], ['reloj', 'Datos de reloj o app'],
];
export const TIPOS_PREGUNTA = [['escala', 'Del 1 al 5'], ['numero', 'Un número'], ['si_no', 'Sí o no'], ['texto', 'Texto']];

// Sin lista, se pregunta todo
export const pregunta = (atleta, apartado) => !atleta?.checkin_apartados || atleta.checkin_apartados.includes(apartado);

// Las preguntas de ese atleta (suyas y para todos), en su orden. Archivadas, solo si se piden.
export function preguntasDe(preguntas, atletaId, { archivadas = false } = {}) {
  return (preguntas || [])
    .filter((p) => (p.atleta_id === atletaId || p.atleta_id == null) && (archivadas || p.activa !== false))
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(a.creado_en || '').localeCompare(String(b.creado_en || '')));
}

// Como checkin_respuestas_validar() en la base
export function respuestaValida(p, v) {
  if (!p) return false;
  if (p.tipo === 'escala') return Number.isInteger(v) && v >= 1 && v <= 5;
  if (p.tipo === 'si_no') return typeof v === 'boolean';
  if (p.tipo === 'texto') return typeof v === 'string' && v.length >= 1 && v.length <= 1000 && textoVisible(v);
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e6 && Math.round(v * 100) / 100 === v;
}

// Las respuestas que se guardan: solo las contestadas y válidas
export function limpiarRespuestas(preguntas, respuestas) {
  const out = {};
  for (const p of preguntas) {
    let v = respuestas?.[p.id];
    if (typeof v === 'string' && p.tipo === 'texto') v = v.trim();
    // Lo que llega de un campo de número («7,5», «8.000»), como número (con dos decimales, como en la base)
    else if (typeof v === 'string' && (p.tipo === 'numero' || p.tipo === 'escala')) v = v.trim() === '' ? null : leerNumero(v) ?? NaN;
    if (p.tipo === 'numero' && typeof v === 'number' && Number.isFinite(v)) v = Math.round(v * 100) / 100;
    if (v === '' || v == null) continue;
    if (respuestaValida(p, v)) out[p.id] = v;
  }
  return Object.keys(out).length ? out : null;
}

// Las preguntas con algo escrito que no vale (para decírselo en vez de perderlo)
export function respuestasNoValidas(preguntas, respuestas) {
  return preguntas.filter((p) => {
    const v = respuestas?.[p.id];
    if (v == null || (typeof v === 'string' && !v.trim())) return false;
    return !limpiarRespuestas([p], { [p.id]: v });
  });
}

// «4/5» · «7,5 h» · «Sí» · el texto
export function textoRespuesta(p, v) {
  if (v == null) return '—';
  if (p.tipo === 'escala') return `${v}/5`;
  if (p.tipo === 'si_no') return v ? 'Sí' : 'No';
  if (p.tipo === 'numero') return `${num(v, 2)}${p.unidad ? ` ${p.unidad}` : ''}`;
  return String(v);
}

// Para la gráfica de una pregunta de escala o número: [{ iso, valor }] de los check-ins, del más antiguo al último
export function serieRespuestas(checkins, p) {
  return (checkins || [])
    .filter((c) => c.respuestas && typeof c.respuestas[p.id] === 'number')
    .map((c) => ({ iso: c.semana_inicio, valor: c.respuestas[p.id] }))
    .sort((a, b) => a.iso.localeCompare(b.iso));
}

// Las respuestas de un check-in, legibles y en el orden de las preguntas: [{ pregunta, valor, texto }]
// (las de preguntas que ya no existen no salen)
export function respuestasDe(checkin, preguntasPorId) {
  if (!checkin?.respuestas) return [];
  return preguntasDe(Object.keys(checkin.respuestas).map((id) => preguntasPorId[id]).filter(Boolean), checkin.atleta_id, { archivadas: true })
    .map((p) => ({ pregunta: p, valor: checkin.respuestas[p.id], texto: textoRespuesta(p, checkin.respuestas[p.id]) }));
}
