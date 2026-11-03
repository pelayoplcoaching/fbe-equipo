// El chat como WhatsApp (v0.54): lo que no depende de la pantalla ni de la base. Citas, mensajes sin leer, búsqueda,
// reacciones, ventanas de edición y de eliminación, «últ. vez», borradores, respuestas rápidas y vistas previas.
import { textoPlano } from './formato.js';
import { trozosConEnlaces } from './enlaces.js';
import { partesMadrid } from './fechas.js';
import { emojiValido } from './emojis.js';

export const REACCIONES_CHAT = ['❤️', '👍', '💪', '😂', '😮', '🙏'];
export const MINUTOS_EDITAR = 15;
export const HORAS_ELIMINAR = 48;
export const MAX_FOTOS = 10;
export const TEXTO_ELIMINADO = 'Se eliminó este mensaje';

const esProgramado = (c, ahora = Date.now()) => !!c?.enviar_en && Date.parse(c.enviar_en) > ahora;
// Un mensaje cuyo texto es solo la marca de la foto o el vídeo (sin pie)
// (v0.55) también «Documento», la de un PDF sin pie
// (v0.56) y «Nota de voz»
export const esMarcador = (c) => !!(c?.archivo_id || c?.archivoId || c?.archivo) && (c.texto === 'Foto' || c.texto === 'Vídeo' || c.texto === 'Documento' || c.texto === 'Nota de voz');
// Qué lleva: 'foto' | 'video' | 'documento' (v0.55, un PDF) | 'archivo' | null (de su archivo, si se sabe; si no, de su marca)
export function medioDe(c) {
  if (!c) return null;
  if (c.medio) return c.medio;
  const mime = c.archivo?.mime || '';
  if (c.archivo && (c.archivo.tipo === 'documento' || mime === 'application/pdf')) return 'documento';
  if (c.archivo && (c.archivo.tipo === 'audio' || /^audio\//.test(mime))) return 'audio';
  if (c.archivo) return /^image\//.test(mime) || c.archivo.tipo === 'foto_progreso' ? 'foto' : /^video\//.test(mime) || c.archivo.tipo === 'video_tecnica' ? 'video' : 'archivo';
  if (c.texto === 'Foto' && (c.archivo_id || c.archivoId)) return 'foto';
  if (c.texto === 'Vídeo' && (c.archivo_id || c.archivoId)) return 'video';
  if (c.texto === 'Documento' && (c.archivo_id || c.archivoId)) return 'documento';
  if (c.texto === 'Nota de voz' && (c.archivo_id || c.archivoId)) return 'audio';
  return null;
}
const ICONO_MEDIO = { foto: '📷 Foto', video: '🎥 Vídeo', documento: '📄 Documento', archivo: '📄 Archivo', audio: '🎤 Nota de voz' };

// Lo que sale en una cita (y en la vista previa de la lista): el texto en una línea, sin marcas de formato, o
// «📷 Foto» / «🎥 Vídeo» / «📄 Archivo» (con su pie, si lo tiene); «🚫 Se eliminó este mensaje» si se eliminó
export function extractoCita(c, max = 160) {
  if (!c) return 'Mensaje no disponible';
  if (c.eliminado_en) return `🚫 ${TEXTO_ELIMINADO}`;
  const medio = medioDe(c);
  const pie = esMarcador(c) ? '' : textoPlano(c.texto || '').replace(/\s+/g, ' ').trim();
  const t = medio ? (pie ? `${ICONO_MEDIO[medio].split(' ')[0]} ${pie}` : ICONO_MEDIO[medio]) : pie;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

// El separador «N MENSAJES SIN LEER»: el primero de la otra parte sin leer (ya salido y sin eliminar) y cuántos hay
// desde ahí. null si no hay nada sin leer.
export function separadorNoLeidos(mensajes = [], yo, ahora = Date.now()) {
  const sinLeer = (c) => c.autor !== yo && !c.leido_en && !c.eliminado_en && !esProgramado(c, ahora);
  const i = mensajes.findIndex(sinLeer);
  if (i < 0) return null;
  return { id: mensajes[i].id, n: mensajes.slice(i).filter(sinLeer).length };
}
export const textoNoLeidos = (n) => (n === 1 ? '1 MENSAJE SIN LEER' : `${n} MENSAJES SIN LEER`);

// Sin tildes ni mayúsculas, letra a letra (así las posiciones del texto normalizado son las del original)
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g');
export function normalLetras(t) {
  let out = '';
  for (const ch of String(t ?? '')) {
    const b = ch.normalize('NFD').replace(DIACRITICOS, '').toLowerCase();
    // Una letra que se convierte en varias (ß → ss) o en nada se deja como está, para no mover las posiciones
    out += b.length === ch.length ? b : ch.toLowerCase().length === ch.length ? ch.toLowerCase() : ch;
  }
  return out;
}
const normalConsulta = (q) => normalLetras(String(q ?? '').trim().replace(/\s+/g, ' '));

// Buscar en el chat: los mensajes (en orden) cuyo texto contiene la consulta, sin tildes ni mayúsculas; ni los
// eliminados ni las marcas de las fotos. Hacen falta 2 letras.
export function coincidencias(mensajes = [], consulta) {
  const q = normalConsulta(consulta);
  if (q.length < 2) return [];
  return mensajes.filter((c) => !c.eliminado_en && !esMarcador(c) && normalLetras(textoPlano(c.texto || '')).includes(q)).map((c) => c.id);
}
// Un texto partido en trozos con lo que coincide marcado: [{ v, marca }]
export function resaltar(texto, consulta) {
  const t = String(texto ?? '');
  const q = normalConsulta(consulta);
  if (q.length < 2) return [{ v: t, marca: false }];
  const n = normalLetras(t);
  const out = [];
  let i = 0;
  for (let k = n.indexOf(q); k >= 0; k = n.indexOf(q, k + q.length)) {
    if (k > i) out.push({ v: t.slice(i, k), marca: false });
    out.push({ v: t.slice(k, k + q.length), marca: true });
    i = k + q.length;
  }
  if (i < t.length) out.push({ v: t.slice(i), marca: false });
  return out.length ? out : [{ v: t, marca: false }];
}

// Las reacciones de un mensaje, agrupadas: [{ emoji, n, mia }] en el orden de la lista
export function resumenReacciones(reacciones = [], miId) {
  const por = new Map();
  for (const r of reacciones) {
    // (v0.56) cualquier emoji (034); lo que no lo es, fuera
    if (!emojiValido(r.emoji)) continue;
    const x = por.get(r.emoji) || { emoji: r.emoji, n: 0, mia: false };
    x.n++;
    if (r.usuario_id === miId) x.mia = true;
    por.set(r.emoji, x);
  }
  // Las seis de siempre en su orden y, detrás, las demás en el orden en que llegaron
  return [...REACCIONES_CHAT.filter((e) => por.has(e)), ...[...por.keys()].filter((e) => !REACCIONES_CHAT.includes(e))].map((e) => por.get(e));
}
// Tocar una reacción: la misma la quita; otra la cambia. Devuelve el emoji que queda (o null)
export const siguienteReaccion = (actual, tocada) => (actual === tocada ? null : tocada);

// ¿Se puede editar? Lo propio, de texto (sin foto ni vídeo), sin eliminar y en sus 15 minutos (un programado del coach,
// mientras no sale, va por «Cambiar»)
export function puedeEditar(c, yo, ahora = Date.now()) {
  if (!c || c.autor !== yo || c.eliminado_en || c.archivo_id || c.archivoId || c.dibujo || esProgramado(c, ahora)) return false;
  return ahora - Date.parse(c.creado_en) <= MINUTOS_EDITAR * 60000;
}
// ¿Se puede eliminar para todos? Lo propio en sus 48 horas (el programado del coach que no ha salido se cancela)
export function puedeEliminar(c, yo, ahora = Date.now()) {
  if (!c || c.autor !== yo || c.eliminado_en) return false;
  if (esProgramado(c, ahora)) return true;
  return ahora - Date.parse(c.creado_en) <= HORAS_ELIMINAR * 3600000;
}
export const puedeReaccionar = (c, ahora = Date.now()) => !!c && !c.eliminado_en && !esProgramado(c, ahora);

// «hoy 18:42», «ayer 18:42», «lun 3 nov, 18:42» (y con el año si no es este)
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const hhmm = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
function diasAtras(d, ahora) {
  const a = new Date(ahora); a.setHours(0, 0, 0, 0);
  const b = new Date(d); b.setHours(0, 0, 0, 0);
  return Math.round((a - b) / 864e5);
}
export function cuandoInfo(iso, ahora = Date.now()) {
  if (!iso) return null;
  const d = new Date(iso);
  const dias = diasAtras(d, ahora);
  if (dias === 0) return `hoy ${hhmm(d)}`;
  if (dias === 1) return `ayer ${hhmm(d)}`;
  const anio = d.getFullYear() !== new Date(ahora).getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}${anio}, ${hhmm(d)}`;
}
// Solo el día: «hoy», «ayer», «lun 26 oct»
export function diaInfo(iso, ahora = Date.now()) {
  if (!iso) return null;
  const d = new Date(iso);
  const dias = diasAtras(d, ahora);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== new Date(ahora).getFullYear() ? ` ${d.getFullYear()}` : ''}`;
}
// ¿Lo leyó alguien con «Mostrar cuándo estoy en línea» apagado? (la base apunta solo el día: medianoche de Madrid)
export const leidoSoloDia = (iso) => !!iso && new Date(iso).getUTCSeconds() === 0 && new Date(iso).getUTCMilliseconds() === 0 && partesMadrid(iso).hora === '00:00';
// Las líneas de «Info» de un mensaje propio. horaLeido (v0.54, revisión): con «Mostrar cuándo estoy en línea» apagado
// tampoco se ve la hora a la que la otra parte leyó lo tuyo (como WhatsApp con las confirmaciones); y si fue ella la que
// lo tenía apagado, la base solo guarda el día. En los dos casos, «Leído: hoy» sin la hora.
export function infoMensaje(c, ahora = Date.now(), { horaLeido = true } = {}) {
  if (!c) return [];
  // (v0.56) Entregado y, en una nota de voz, escuchado. Si la otra parte tiene «en línea» apagado, la base no apunta
  // la entrega al abrir la app ni lo escuchado (y lo leído, solo el día); si lo tienes apagado tú, no ves sus horas.
  const soloDia = !!c.leido_en && leidoSoloDia(c.leido_en);
  const dia = (iso) => diaInfo(leidoSoloDia(iso) ? `${partesMadrid(iso).fecha}T12:00:00` : iso, ahora);
  const entregado = c.entregado_en || c.leido_en;
  const filas = [
    ['Enviado', cuandoInfo(c.creado_en, ahora)],
    ...(horaLeido ? [['Entregado', !entregado ? 'todavía no' : soloDia ? dia(c.leido_en) : cuandoInfo(entregado, ahora)]] : []),
    ['Leído', !c.leido_en ? 'todavía no' : soloDia ? dia(c.leido_en) : !horaLeido ? diaInfo(c.leido_en, ahora) : cuandoInfo(c.leido_en, ahora)],
  ];
  if (medioDe(c) === 'audio') filas.push(['Escuchado', !c.escuchado_en ? 'todavía no' : !horaLeido ? diaInfo(c.escuchado_en, ahora) : cuandoInfo(c.escuchado_en, ahora)]);
  if (c.editado_en) filas.push(['Editado', cuandoInfo(c.editado_en, ahora)]);
  if (c.eliminado_en) filas.push(['Eliminado', cuandoInfo(c.eliminado_en, ahora)]);
  return filas;
}
// «en línea», «escribiendo…» o «últ. vez hoy a las 18:42»
export function textoUltimaVez(iso, ahora = Date.now()) {
  if (!iso) return null;
  const d = new Date(iso);
  const dias = diasAtras(d, ahora);
  if (dias === 0) return `últ. vez hoy a las ${hhmm(d)}`;
  if (dias === 1) return `últ. vez ayer a las ${hhmm(d)}`;
  if (dias < 7) return `últ. vez el ${DIAS[d.getDay()]} a las ${hhmm(d)}`;
  return `últ. vez el ${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== new Date(ahora).getFullYear() ? ` ${d.getFullYear()}` : ''}`;
}
export function estadoConexion({ escribiendo = false, enLinea = false, ultima = null } = {}, ahora = Date.now()) {
  if (escribiendo) return 'escribiendo…';
  if (enLinea) return 'en línea';
  return textoUltimaVez(ultima, ahora);
}

// Los enlaces de los mensajes (para «Archivos, enlaces y documentos»): [{ url, youtube, mensajeId, creado_en }], los
// más recientes primero y sin repetir
export function enlacesDe(mensajes = []) {
  const vistos = new Set();
  const out = [];
  for (const c of [...mensajes].reverse()) {
    if (c.eliminado_en || esProgramado(c)) continue;
    for (const x of trozosConEnlaces(c.texto || '')) {
      if (x.tipo !== 'enlace' || vistos.has(x.valor)) continue;
      vistos.add(x.valor);
      out.push({ url: x.valor, youtube: x.youtube || null, mensajeId: c.id, autor: c.autor, creado_en: c.creado_en });
    }
  }
  return out;
}
// Las fotos y los vídeos (y los demás archivos): [{ mensajeId, archivo, tipo }]
export function mediosDe(mensajes = []) {
  const out = [];
  const vistos = new Set();
  for (const c of [...mensajes].reverse()) {
    if (c.eliminado_en || !c.archivo || vistos.has(c.archivo.id)) continue;
    vistos.add(c.archivo.id);
    out.push({ mensajeId: c.id, archivo: c.archivo, tipo: medioDe(c) });
  }
  return out;
}

// Respuestas rápidas con «/»: el texto empieza por «/» (sin saltos de línea) → lo que se busca; si no, null
export function consultaRapida(texto) {
  const m = /^\/([^\n/]{0,40})$/.exec(String(texto ?? ''));
  return m ? m[1] : null;
}
export function filtrarRapidas(lista = [], consulta = '') {
  const q = normalConsulta(consulta);
  const conTexto = (r) => normalLetras(`${r.titulo || ''} ${r.texto || ''}`);
  const filas = q ? lista.filter((r) => conTexto(r).includes(q)) : lista;
  // Primero las que lo tienen en el título
  return [...filas].sort((a, b) => (normalLetras(b.titulo || '').includes(q) ? 1 : 0) - (normalLetras(a.titulo || '').includes(q) ? 1 : 0)).slice(0, 8);
}

// Borradores: lo que se empieza a escribir y no se envía, por conversación, en el propio móvil. almacen: algo con
// getItem/setItem/removeItem/key/length (localStorage); si falla (bloqueado o lleno), no pasa nada.
export const PREFIJO_BORRADOR = 'fbe-borrador-';
const DIAS_BORRADOR = 30;
const claveBorrador = (usuarioId, atletaId) => `${PREFIJO_BORRADOR}${usuarioId}-${atletaId}`;
export function leerBorrador(almacen, usuarioId, atletaId, ahora = Date.now()) {
  try {
    const x = JSON.parse(almacen.getItem(claveBorrador(usuarioId, atletaId)) || 'null');
    if (!x || typeof x.texto !== 'string' || !x.texto.trim()) return null;
    if (!(ahora - Number(x.t) < DIAS_BORRADOR * 864e5)) { almacen.removeItem(claveBorrador(usuarioId, atletaId)); return null; }
    return { texto: x.texto.slice(0, 4000), respondeA: typeof x.respondeA === 'string' ? x.respondeA : null };
  } catch { return null; }
}
export function guardarBorrador(almacen, usuarioId, atletaId, texto, { respondeA = null, ahora = Date.now() } = {}) {
  try {
    const t = String(texto ?? '');
    if (!t.trim()) almacen.removeItem(claveBorrador(usuarioId, atletaId));
    else almacen.setItem(claveBorrador(usuarioId, atletaId), JSON.stringify({ texto: t.slice(0, 4000), respondeA, t: ahora }));
    return true;
  } catch { return false; }
}
export const borrarBorrador = (almacen, usuarioId, atletaId) => guardarBorrador(almacen, usuarioId, atletaId, '');
// Todos los de este móvil (al cerrar la sesión)
export function borrarBorradores(almacen) {
  try {
    const claves = [];
    for (let i = 0; i < almacen.length; i++) { const k = almacen.key(i); if (k && k.startsWith(PREFIJO_BORRADOR)) claves.push(k); }
    for (const k of claves) almacen.removeItem(k);
    return claves.length;
  } catch { return 0; }
}

// La vista previa de una conversación en la lista del coach: { borrador, texto, mio, visto, medio }
export function vistaPrevia(ultimo, { borrador = null, yo = 'coach' } = {}) {
  if (borrador) return { borrador: true, texto: textoPlano(borrador).replace(/\s+/g, ' ').trim() };
  if (!ultimo) return null;
  const mio = ultimo.autor === yo;
  return { borrador: false, texto: extractoCita(ultimo, 120), mio, visto: mio ? !!ultimo.leido_en : null, entregado: mio ? !!(ultimo.entregado_en || ultimo.leido_en) : null, eliminado: !!ultimo.eliminado_en };
}

// El orden de la lista del coach: las fijadas arriba (la última fijada, la primera); después, como siempre (lo que
// tiene algo sin leer o marcado «no leída» y, luego, lo más reciente)
export function ordenarConversaciones(filas = []) {
  const fecha = (x) => String(x.ultimo?.creado_en || '');
  return [...filas].sort((a, b) => {
    const fa = a.estado?.fijada_en || '', fb = b.estado?.fijada_en || '';
    if (!!fa !== !!fb) return fa ? -1 : 1;
    if (fa && fb && fa !== fb) return fb.localeCompare(fa);
    const na = a.sinLeer > 0 || !!a.estado?.no_leida, nb = b.sinLeer > 0 || !!b.estado?.no_leida;
    return (nb - na) || fecha(b).localeCompare(fecha(a)) || a.atleta.nombre.localeCompare(b.atleta.nombre);
  });
}
export function filtrarConversaciones(filas = [], filtro = 'todos', { archivadas = false } = {}) {
  return filas.filter((x) => (archivadas ? !!x.estado?.archivada_en : !x.estado?.archivada_en)
    && (filtro === 'no-leidos' ? x.sinLeer > 0 || !!x.estado?.no_leida : filtro === 'fijados' ? !!x.estado?.fijada_en : true));
}
