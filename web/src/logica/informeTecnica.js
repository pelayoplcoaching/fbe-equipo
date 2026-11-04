// v0.61 (17): el «Informe del mes» de técnica de un atleta, calculado en el móvil con lo que ya hay (sus vídeos de técnica
// con su corrección y su serie, sus recordatorios activos y el perfil carga–velocidad): vídeos enviados y revisados, en
// cuántos días se revisan (la mediana, en días: el atleta nunca ve una hora de su coach), la nota de cada ejercicio a lo
// largo del mes, los puntos «a corregir» que más salen, los recordatorios activos, el mejor vídeo del mes (el destacado o
// el de mejor nota) y, si hay perfil, cómo ha cambiado el 1RM estimado por la velocidad. Sin tabla nueva: no se guarda
// nada, se calcula al abrirlo. El coach se lo manda con un mensaje en el chat («Tu informe de técnica de octubre de 2026»),
// que la app enseña como una tarjeta con «Ver el informe» (y avisa una vez, sin el texto, como cualquier mensaje).
import { aISO, diasEntre } from './fechas.js';
import { MESES_LARGOS, nombreMes } from './mes.js';
import { perfilCargaVelocidad, umbralDe } from './cargaVelocidad.js';

export const RE_MES = /^(20\d{2})-(0[1-9]|1[0-2])$/;
export const mesValido = (m) => typeof m === 'string' && RE_MES.test(m);
export const textoMes = (m) => (mesValido(m) ? `${nombreMes(m)} de ${m.slice(0, 4)}` : '');
export const mesDe = (fecha) => String(fecha || '').slice(0, 7);
export function finDeMes(m) {
  const [y, mm] = m.split('-').map(Number);
  return aISO(new Date(y, mm, 0));
}
export function mesAnterior(m) {
  const [y, mm] = m.split('-').map(Number);
  return mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, '0')}`;
}
// El día (local) de un instante ISO, o null
const diaDe = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? aISO(new Date(t)) : null; };
const esVideo = (v) => !!v && (!v.tipo || v.tipo === 'video_tecnica');

// Los meses con vídeos de técnica, del más reciente al más antiguo
export function mesesConVideos(videos = []) {
  return [...new Set((videos || []).filter(esVideo).map((v) => mesDe(v.fecha)).filter(mesValido))].sort().reverse();
}
const mediana = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const normal = (t) => String(t || '').replace(/\s+/g, ' ').trim();

// Revisado: el coach lo dio por revisado o lo corrigió. El día en que pasó (el primero de los dos), o null
export function diaRevisado(v) {
  const dias = [diaDe(v?.revisado_en), v?.revision?.corregido_el || null].filter((x) => x && /^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
  return dias[0] || null;
}
// Días de llegada a revisión (0 = el mismo día), o null
export function diasHastaRevision(v) {
  const llega = diaDe(v?.creado_en) || v?.fecha || null;
  const rev = diaRevisado(v);
  if (!llega || !rev) return null;
  return Math.max(0, diasEntre(llega, rev));
}

// El informe. videos: los del diario (con ejercicio, revision, serie). recordatorios: los activos (recordatorios_activos).
// umbrales: los del coach por ejercicio ({ id: m/s }). Devuelve null si el mes no es válido.
export function informeMes(videos = [], { mes, recordatorios = [], umbrales = {} } = {}) {
  if (!mesValido(mes)) return null;
  const todos = (videos || []).filter(esVideo);
  const delMes = todos.filter((v) => mesDe(v.fecha) === mes).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.creado_en || '').localeCompare(String(b.creado_en || '')));
  const revisados = delMes.filter((v) => diaRevisado(v));
  const dias = revisados.map(diasHastaRevision).filter((x) => x != null);

  // La nota por ejercicio, en orden
  const porEj = new Map();
  for (const v of delMes) {
    const id = v.ejercicio?.id || 'sin';
    if (!porEj.has(id)) porEj.set(id, { id, nombre: v.ejercicio?.nombre || 'Sin ejercicio', videos: 0, notas: [] });
    const g = porEj.get(id);
    g.videos++;
    const p = v.revision?.puntuacion;
    if (Number.isInteger(p) && p >= 1 && p <= 5) g.notas.push({ fecha: v.fecha, nota: p, id: v.id });
  }
  const ejercicios = [...porEj.values()].map((g) => ({
    ...g,
    primera: g.notas[0]?.nota ?? null,
    ultima: g.notas.length ? g.notas[g.notas.length - 1].nota : null,
    media: g.notas.length ? Math.round((g.notas.reduce((t, x) => t + x.nota, 0) / g.notas.length) * 10) / 10 : null,
    cambio: g.notas.length >= 2 ? g.notas[g.notas.length - 1].nota - g.notas[0].nota : null,
  })).sort((a, b) => b.videos - a.videos || a.nombre.localeCompare(b.nombre));

  // Los puntos «a corregir» que más salen (con el mismo texto, sin mayúsculas ni espacios de más)
  const mal = new Map();
  for (const v of delMes) {
    for (const p of v.revision?.checklist?.puntos || []) {
      if (p?.e !== 'mal' || !normal(p.t)) continue;
      const k = normal(p.t).toLowerCase();
      if (!mal.has(k)) mal.set(k, { texto: normal(p.t), n: 0, ejercicios: new Set() });
      const x = mal.get(k); x.n++; if (v.ejercicio?.nombre) x.ejercicios.add(v.ejercicio.nombre);
    }
  }
  const aCorregir = [...mal.values()].sort((a, b) => b.n - a.n || a.texto.localeCompare(b.texto)).slice(0, 3).map((x) => ({ texto: x.texto, n: x.n, ejercicios: [...x.ejercicios] }));

  // El mejor vídeo: el destacado (el más reciente) o, si no hay, el de mejor nota (y el más reciente si empatan)
  const destacados = delMes.filter((v) => v.destacado);
  const conNota = delMes.filter((v) => Number.isInteger(v.revision?.puntuacion));
  let mejor = null;
  if (destacados.length) mejor = { video: destacados[destacados.length - 1], porque: 'destacado' };
  else if (conNota.length) mejor = { video: [...conNota].sort((a, b) => b.revision.puntuacion - a.revision.puntuacion || String(b.fecha).localeCompare(String(a.fecha)))[0], porque: 'nota' };

  // El 1RM estimado por la velocidad: al final del mes y al final del anterior (con todos los vídeos hasta ese día)
  const fin = finDeMes(mes), finAntes = finDeMes(mesAnterior(mes));
  const e1rm = [];
  const ejIds = new Map();
  for (const v of todos) if (v.ejercicio?.id && mesDe(v.fecha) <= mes) ejIds.set(v.ejercicio.id, v.ejercicio);
  for (const ej of ejIds.values()) {
    const vs = todos.filter((v) => v.ejercicio?.id === ej.id);
    const u = umbralDe(ej, umbrales);
    const ahora = perfilCargaVelocidad(vs, { umbral: u.v, umbralGenerico: u.generico, hasta: fin });
    if (ahora.estado !== 'ok') continue;
    const antes = perfilCargaVelocidad(vs, { umbral: u.v, umbralGenerico: u.generico, hasta: finAntes });
    e1rm.push({ id: ej.id, nombre: ej.nombre || 'Ejercicio', ahora: ahora.e1rm, antes: antes.estado === 'ok' ? antes.e1rm : null,
      cambio: antes.estado === 'ok' ? Math.round((ahora.e1rm - antes.e1rm) * 2) / 2 : null, cargas: ahora.cargas, r2: ahora.r2, avisos: ahora.avisos });
  }

  return {
    mes, titulo: `Informe de técnica · ${textoMes(mes)}`,
    enviados: delMes.length, revisados: revisados.length,
    medianaDias: dias.length ? mediana(dias) : null,
    ejercicios, aCorregir,
    recordatorios: (recordatorios || []).length,
    mejor: mejor ? { id: mejor.video.id, fecha: mejor.video.fecha, ejercicio: mejor.video.ejercicio?.nombre || 'Vídeo', nota: mejor.video.revision?.puntuacion ?? null, porque: mejor.porque } : null,
    e1rm,
    vacio: delMes.length === 0,
  };
}

// «el mismo día», «1 día», «2,5 días»
export function textoDias(d) {
  if (d == null) return '—';
  if (d === 0) return 'el mismo día';
  const t = String(Math.round(d * 10) / 10).replace('.', ',');
  return `${t} ${d === 1 ? 'día' : 'días'}`;
}
export const textoCambioNota = (c) => (c == null ? '' : c > 0 ? `+${c}` : c < 0 ? `−${-c}` : '=');

// ---------- La tarjeta del chat ----------
// El mensaje que manda el coach (y que la app enseña como tarjeta): «Tu informe de técnica de octubre de 2026»
export const textoTarjetaInforme = (mes) => (mesValido(mes) ? `Tu informe de técnica de ${textoMes(mes)}` : null);
const RE_TARJETA = new RegExp(`^Tu informe de técnica de (${MESES_LARGOS.join('|')}) de (20\\d{2})$`);
// El mes de una tarjeta (solo en un mensaje del coach del chat, sin sesión, check-in ni vídeo), o null
export function leerTarjetaInforme(c) {
  if (!c || c.autor !== 'coach' || c.eliminado_en || c.sesion_id || c.checkin_id || c.archivo_id) return null;
  const m = RE_TARJETA.exec(String(c.texto || '').trim());
  if (!m) return null;
  return `${m[2]}-${String(MESES_LARGOS.indexOf(m[1]) + 1).padStart(2, '0')}`;
}
