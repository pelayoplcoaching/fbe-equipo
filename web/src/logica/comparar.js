// Comparar dos check-ins (v0.48, como la «Response Comparison» de Everfit): lado a lado, el peso y las medidas de
// esas semanas con su diferencia, cada respuesta y las fotos de progreso de esos días.
import { sumarDias } from './fechas.js';
import { ESCALAS, NOMBRE_ZONA, MEDIDAS, num, signo } from './calculos.js';
import { respuestasDe } from './preguntas.js';

const enSemana = (f, lunes) => !!f && f >= lunes && f <= sumarDias(lunes, 6);
// Lo de una semana o, si no lo hay, lo más cercano en los 3 días de alrededor (el peso del lunes siguiente cuenta)
function deLaSemana(lista, lunes, campoFecha = 'fecha') {
  const dentro = lista.filter((x) => enSemana(x[campoFecha], lunes)).sort((a, b) => (a[campoFecha] < b[campoFecha] ? 1 : -1));
  if (dentro.length) return dentro[0];
  const cerca = lista.filter((x) => x[campoFecha] >= sumarDias(lunes, -3) && x[campoFecha] <= sumarDias(lunes, 9)).sort((a, b) => (a[campoFecha] < b[campoFecha] ? 1 : -1));
  return cerca[0] || null;
}
const media = (c) => { const v = [c.adherencia_desayuno, c.adherencia_comida, c.adherencia_merienda, c.adherencia_cena].filter(Boolean); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

// d: { pesos, medidas, molestias, preguntas: {id: pregunta}, fotos (foto_progreso) }. a y b: dos check-ins (en cualquier orden)
export function compararCheckins(a, b, d = {}) {
  const [antes, despues] = [a, b].sort((x, y) => (x.semana_inicio < y.semana_inicio ? -1 : 1));
  const lado = (c) => {
    const peso = deLaSemana(d.pesos || [], c.semana_inicio);
    const medidas = deLaSemana(d.medidas || [], c.semana_inicio);
    const molestias = (d.molestias || []).filter((m) => m.semana_inicio === c.semana_inicio && m.intensidad > 0);
    const fotos = (d.fotos || []).filter((f) => f.fecha >= sumarDias(c.semana_inicio, -3) && f.fecha <= sumarDias(c.semana_inicio, 9))
      .sort((x, y) => (x.pose || '').localeCompare(y.pose || '') || (x.fecha < y.fecha ? 1 : -1));
    return { checkin: c, peso, medidas, molestias, fotos };
  };
  const A = lado(antes), B = lado(despues);
  const filas = [];
  const fila = (clave, nombre, va, vb, { unidad = '', dec = 1, delta = true, menosMejor = false } = {}) => {
    if (va == null && vb == null) return;
    const dif = delta && va != null && vb != null && Number.isFinite(Number(va)) && Number.isFinite(Number(vb)) ? Math.round((Number(vb) - Number(va)) * 100) / 100 : null;
    filas.push({ clave, nombre, a: va, b: vb, dif, unidad, dec, texto: (v) => (v == null ? '—' : typeof v === 'number' ? `${num(v, dec)}${unidad ? ` ${unidad}` : ''}` : String(v)), difTexto: dif == null ? null : dif === 0 ? '=' : `${signo(dif, dec)}${unidad ? ` ${unidad}` : ''}`, menosMejor });
  };
  fila('peso', 'Peso', A.peso ? Number(A.peso.kg) : null, B.peso ? Number(B.peso.kg) : null, { unidad: 'kg', menosMejor: null });
  for (const [k, n] of MEDIDAS) fila(k, n, A.medidas?.[k] != null ? Number(A.medidas[k]) : null, B.medidas?.[k] != null ? Number(B.medidas[k]) : null, { unidad: 'cm', menosMejor: null });
  const ca = antes, cb = despues;
  fila('sueno', 'Sueño', ca.horas_sueno ? `${ca.horas_sueno.replace('-', '–')} h` : null, cb.horas_sueno ? `${cb.horas_sueno.replace('-', '–')} h` : null, { delta: false });
  fila('energia', 'Energía (1–5)', ca.energia ?? null, cb.energia ?? null, { dec: 0 });
  fila('recuperacion', 'Recuperación (1–5)', ca.recuperacion ?? null, cb.recuperacion ?? null, { dec: 0 });
  fila('motivacion', 'Motivación', ca.motivacion ? ESCALAS.motivacion[ca.motivacion - 1] : null, cb.motivacion ? ESCALAS.motivacion[cb.motivacion - 1] : null, { delta: false });
  const ma = media(ca), mb = media(cb);
  fila('adherencia', 'Adherencia a la alimentación', ma ? ESCALAS.adherencia[Math.round(ma) - 1] : null, mb ? ESCALAS.adherencia[Math.round(mb) - 1] : null, { delta: false });
  fila('pasos', 'Pasos (media)', ca.pasos_media ?? null, cb.pasos_media ?? null, { dec: 0 });
  fila('fc', 'FC en reposo', ca.fc_reposo ?? null, cb.fc_reposo ?? null, { unidad: 'ppm', dec: 0 });
  const mol = (x) => (x.molestias.length ? x.molestias.map((m) => `${NOMBRE_ZONA[m.zona] || m.zona} ${m.intensidad}`).join(', ') : null);
  fila('molestias', 'Molestias', mol(A), mol(B), { delta: false });
  // Las preguntas del coach, en el orden de las del check-in más reciente
  const ra = respuestasDe(ca, d.preguntas || {}), rb = respuestasDe(cb, d.preguntas || {});
  const ids = [...new Set([...rb.map((r) => r.pregunta.id), ...ra.map((r) => r.pregunta.id)])];
  for (const id of ids) {
    const x = ra.find((r) => r.pregunta.id === id), y = rb.find((r) => r.pregunta.id === id);
    const p = (x || y).pregunta;
    const nums = p.tipo === 'escala' || p.tipo === 'numero';
    fila(`p-${id}`, p.texto, nums ? (x ? Number(x.valor) : null) : x?.texto ?? null, nums ? (y ? Number(y.valor) : null) : y?.texto ?? null, { unidad: p.tipo === 'numero' ? p.unidad || '' : '', dec: 1, delta: nums });
  }
  fila('notas', 'Su nota', ca.notas || null, cb.notas || null, { delta: false });
  return { antes: A, despues: B, filas };
}
