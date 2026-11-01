// Tareas puntuales del coach (v0.48, migración 030): una cosa concreta para un día (como las «Tasks» de Everfit).
// El atleta la ve en «Tu día» desde ese día hasta que la hace; si se le pasa, sigue ahí sin agobiar («desde el
// lunes»). La marca hecha con tarea_completar() (la base comprueba que es suya, que no está de baja y que trae la
// foto, el vídeo o el peso que pide).
import { hoyISO, diasEntre, fmtConDia, fmtCorta, fechaMadrid } from './fechas.js';
import { textoVisible } from './texto.js';

// [tipo, nombre, icono, qué hace el atleta]
export const TIPOS_TAREA = [
  ['foto', 'Foto de progreso', 'camara', 'Se hace con la cámara guiada'],
  ['medida', 'Peso o medidas', 'bascula', 'Apunta su peso y, si quiere, sus medidas'],
  ['video', 'Vídeo de técnica', 'video', 'Envía un vídeo de un ejercicio'],
  ['texto', 'Texto', 'mensaje', 'La marca hecha y, si quiere, te contesta'],
];
export const NOMBRE_TIPO_TAREA = Object.fromEntries(TIPOS_TAREA.map(([t, n]) => [t, n]));
export const ICONO_TAREA = Object.fromEntries(TIPOS_TAREA.map(([t, , i]) => [t, i]));

// Para empezar, sin haber guardado ninguna: un puñado que se reutiliza
export const PLANTILLAS_SUGERIDAS = [
  { tipo: 'foto', titulo: 'Fotos de progreso de este mes', detalle: 'Frente, perfil y espalda, con la misma luz que la última vez.' },
  { tipo: 'medida', titulo: 'Peso y cintura', detalle: 'Por la mañana, en ayunas. La cintura, a la altura del ombligo.' },
  { tipo: 'video', titulo: 'Vídeo de tu serie más pesada', detalle: 'De lado, que se vea todo el cuerpo.' },
  { tipo: 'texto', titulo: '¿Qué tal la semana?', detalle: 'Cuéntame en dos líneas cómo vas: sueño, estrés y ganas.' },
];

const MAX_TITULO = 120, MAX_DETALLE = 600, MAX_RESPUESTA = 500;
export { MAX_RESPUESTA };

// Lo que guarda el coach, limpio (o un error que se entiende). Como la restricción tareas_validas.
export function limpiarTarea({ tipo, titulo, detalle = null, ejercicio_id = null, fecha }) {
  const t = String(titulo || '').trim().replace(/\s+/g, ' ');
  const d = String(detalle || '').trim();
  if (!TIPOS_TAREA.some(([x]) => x === tipo)) throw new Error('Elige qué tipo de tarea es');
  if (!t || t.length > MAX_TITULO || !textoVisible(t)) throw new Error(`Ponle un título (hasta ${MAX_TITULO} letras)`);
  if (d.length > MAX_DETALLE) throw new Error(`El detalle, hasta ${MAX_DETALLE} letras`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || '')) || fecha < '2020-01-01' || fecha >= '2100-01-01') throw new Error('Elige el día de la tarea');
  if (tipo === 'video' && !ejercicio_id) throw new Error('Elige de qué ejercicio quieres el vídeo');
  return { tipo, titulo: t, detalle: d && textoVisible(d) ? d : null, ejercicio_id: tipo === 'video' ? ejercicio_id : null, fecha };
}

// La respuesta del atleta, limpia (vacía = sin respuesta)
export function limpiarRespuesta(texto) {
  const r = String(texto || '').trim();
  if (!r || !textoVisible(r)) return null;
  if (r.length > MAX_RESPUESTA) throw new Error(`Tu respuesta, hasta ${MAX_RESPUESTA} letras`);
  return r;
}

// hecha | pendiente (hoy) | atrasada | proxima
export function estadoTarea(t, hoy = hoyISO()) {
  if (t.hecha_en) return 'hecha';
  if (t.fecha > hoy) return 'proxima';
  return t.fecha === hoy ? 'pendiente' : 'atrasada';
}

// Cuándo, sin agobiar: «Para hoy», «Desde ayer», «Desde el lunes», «Desde el 28 oct»
export function cuandoTarea(t, hoy = hoyISO()) {
  if (t.fecha > hoy) return `Para el ${fmtConDia(t.fecha)}`;
  const n = diasEntre(t.fecha, hoy);
  if (n <= 0) return 'Para hoy';
  if (n === 1) return 'Desde ayer';
  if (n < 7) return `Desde el ${fmtConDia(t.fecha).split(' ')[0]}`;
  return `Desde el ${fmtCorta(t.fecha)}`;
}

// Lo que sale en «Tu día»: las pendientes que ya tocan (las más antiguas primero) y las hechas hoy
export function tareasDelDia(tareas = [], hoy = hoyISO()) {
  const hechaHoy = (t) => !!t.hecha_en && fechaMadrid(new Date(t.hecha_en)) === hoy;
  return [...tareas].filter((t) => (!t.hecha_en && t.fecha <= hoy) || hechaHoy(t))
    .sort((a, b) => (!!a.hecha_en - !!b.hecha_en) || (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : String(a.creada_en || '').localeCompare(String(b.creada_en || ''))));
}

// Para el coach: cómo va cada una (en Seguimiento y en Revisar)
export function resumenTareas(tareas = [], hoy = hoyISO()) {
  const por = { hecha: 0, pendiente: 0, atrasada: 0, proxima: 0 };
  for (const t of tareas) por[estadoTarea(t, hoy)]++;
  return { ...por, total: tareas.length, porRevisar: tareas.filter((t) => t.hecha_en && !t.revisada_en).length };
}
