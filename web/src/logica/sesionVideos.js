// v0.61 (5): «Revisar la sesión». Los vídeos de técnica de una misma sesión (por su ejercicio de la sesión,
// archivos.sesion_ejercicio_id → sesion_ejercicios.sesion_id) se agrupan en la bandeja del coach en una sola tarjeta
// («Sesión del martes · 4 vídeos») y se revisan uno detrás de otro, en el orden de los ejercicios de la sesión (y, dentro
// de cada uno, por su serie). Al final, un solo «Resumen de la sesión» para el atleta, en el hilo de esa sesión (lo ve en
// el chat con la sesión de contexto, en Hoy y en la propia sesión; avisa una vez, sin el texto). Sin pantalla.
import { desdeISO, diasEntre, hoyISO, fmtCorta } from './fechas.js';
import { textoVisible } from './texto.js';
import { NOMBRE_PUNTUACION } from './tecnica.js';

export const MIN_VIDEOS_SESION = 2;     // con uno solo, su tarjeta de siempre
export const MAX_RESUMEN = 4000;        // como cualquier comentario (002)
export const PREFIJO_RESUMEN = 'Resumen de la sesión';
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// La sesión de un vídeo (del mapa de sus ejercicios de la sesión: { id: { sesion_id, orden } }), o null
export const sesionDeVideo = (v, pautas = {}) => (v?.tipo === 'video_tecnica' && v.sesion_ejercicio_id ? pautas[v.sesion_ejercicio_id]?.sesion_id || null : null);

// El orden dentro de la sesión: el del ejercicio en la sesión, luego su serie y luego cuándo llegó
export function ordenEnSesion(videos = [], pautas = {}) {
  const o = (v) => Number(pautas[v.sesion_ejercicio_id]?.orden ?? 999);
  return [...(videos || [])].sort((a, b) => o(a) - o(b) || (Number(a.serie_numero) || 99) - (Number(b.serie_numero) || 99)
    || String(a.creado_en || '').localeCompare(String(b.creado_en || '')) || String(a.id || '').localeCompare(String(b.id || '')));
}

// Los vídeos de la bandeja, agrupados: { grupos: [{ sesionId, atletaId, videos (en su orden) }], sueltos: [vídeos] }. Solo
// se agrupan los de técnica de una misma sesión y del mismo atleta, y solo si son 2 o más. El grupo va donde iría su
// primer vídeo en la lista (la bandeja ya viene ordenada).
export function agruparPorSesion(videos = [], pautas = {}) {
  const por = new Map();
  for (const v of videos || []) {
    const s = sesionDeVideo(v, pautas);
    if (!s) continue;
    const k = `${v.atleta_id || ''}:${s}`;
    if (!por.has(k)) por.set(k, { sesionId: s, atletaId: v.atleta_id || null, videos: [] });
    por.get(k).videos.push(v);
  }
  const grupos = [...por.values()].filter((g) => g.videos.length >= MIN_VIDEOS_SESION).map((g) => ({ ...g, videos: ordenEnSesion(g.videos, pautas) }));
  const enGrupo = new Set(grupos.flatMap((g) => g.videos.map((v) => v.id)));
  return { grupos, sueltos: (videos || []).filter((v) => !enGrupo.has(v.id)) };
}

// «Sesión del martes» (en la última semana), «Sesión de ayer», «Sesión de hoy» o «Sesión del 3 nov»; con su número de vídeos
export function tituloSesion(fecha, n = null, hoy = hoyISO()) {
  let base = 'Sesión';
  if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const d = diasEntre(fecha, hoy);
    if (d === 0) base = 'Sesión de hoy';
    else if (d === 1) base = 'Sesión de ayer';
    else if (d > 1 && d < 7) base = `Sesión del ${DIAS_LARGOS[desdeISO(fecha).getDay()]}`;
    else base = `Sesión del ${fmtCorta(fecha)}`;
  }
  return n == null ? base : `${base} · ${n === 1 ? '1 vídeo' : `${n} vídeos`}`;
}

// Las series de un ejercicio de la sesión, para verlas al lado del vídeo: «60 × 8 @8», la del vídeo marcada
export function textoSeriesPauta(series = [], serieVideo = null) {
  return [...(series || [])].sort((a, b) => a.numero - b.numero).map((s) => {
    const kg = s.kg != null && s.kg !== '' ? `${String(Number(s.kg)).replace('.', ',')} kg` : null;
    const reps = s.reps != null ? `${s.reps}` : null;
    const esf = s.rpe != null ? ` @${String(Number(s.rpe)).replace('.', ',')}` : s.rir != null ? ` RIR ${String(Number(s.rir)).replace('.', ',')}` : '';
    return { numero: s.numero, texto: `${kg && reps ? `${kg} × ${reps}` : kg || (reps ? `${reps} reps` : '—')}${esf}`, delVideo: serieVideo != null && Number(s.numero) === Number(serieVideo) };
  });
}

// El borrador del resumen: una línea por vídeo con su ejercicio y lo que ya ha corregido el coach (la nota y lo que hay
// que corregir), para que lo complete. nombre: el del atleta (solo el primero)
export function borradorResumen(videos = [], { nombre = '' } = {}) {
  const primero = String(nombre || '').trim().split(/\s+/)[0] || '';
  const lineas = [`${PREFIJO_RESUMEN}${primero ? `, ${primero}` : ''}:`];
  for (const v of videos || []) {
    const ej = v.ejercicio?.nombre || 'Vídeo';
    const r = v.revision || null;
    const partes = [];
    if (Number.isInteger(r?.puntuacion) && NOMBRE_PUNTUACION[r.puntuacion]) partes.push(`${r.puntuacion}/5 (${NOMBRE_PUNTUACION[r.puntuacion].toLowerCase()})`);
    const mal = (r?.checklist?.puntos || []).filter((p) => p?.e === 'mal').map((p) => String(p.t || '').trim()).filter(Boolean);
    if (mal.length) partes.push(`a corregir: ${mal.slice(0, 2).join('; ').toLowerCase()}`);
    lineas.push(`· ${ej}${v.serie?.numero ? ` (serie ${v.serie.numero})` : ''}${partes.length ? `: ${partes.join(', ')}` : ''}`);
  }
  lineas.push('');
  return lineas.join('\n');
}
// El texto que se manda: sin espacios de sobra, con algo visible, de 1 a 4000 letras
export function limpiarResumen(texto = '') {
  const t = String(texto ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!t || !textoVisible(t)) return null;
  return [...t].length > MAX_RESUMEN ? null : t;
}
// ¿Es un resumen de la sesión? (el del coach en el hilo de esa sesión: así no se manda dos veces)
export const esResumenSesion = (c) => !!c && c.autor === 'coach' && !!c.sesion_id && !c.eliminado_en && String(c.texto || '').startsWith(PREFIJO_RESUMEN);
// Cuántos de la sesión están ya corregidos o revisados (en esta revisión o antes)
export function progresoSesion(videos = [], hechos = new Set()) {
  const n = (videos || []).filter((v) => hechos.has(v.id) || v.revisado_en || v.revision?.corregido_el).length;
  return { hechos: n, total: (videos || []).length };
}
