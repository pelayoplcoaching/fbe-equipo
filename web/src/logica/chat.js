// El chat, aún más como WhatsApp (v0.55): lo que no depende de la pantalla ni de la base. Mensajes solo de emojis,
// los largos con «Leer más», la píldora del día, los ✓ de cada mensaje, la bandeja de salida (lo que se envía al
// momento o al volver la cobertura), reenviar y difundir, los PDF (nombre, firma y páginas), silenciar, fijar y copiar
// varios mensajes.
import { textoPlano } from './formato.js';
import { medioDe } from './mensajes.js';
import { trozosConEnlaces } from './enlaces.js';

// ------------------------------------------------------------------ mensajes solo de emojis
// Un emoji «entero» (lo que se ve como uno): una bandera (dos letras regionales o una con etiquetas), un número en su
// tecla (1️⃣) o un pictograma con su tono de piel, su variante y lo que vaya unido con ZWJ (👩‍💻)
const UN_EMOJI = new RegExp('(?:\\p{Regional_Indicator}{2}|[#*0-9]\\uFE0F?\\u20E3|\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier}|[\\u{E0020}-\\u{E007F}])*(?:\\u200D\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier})*)*)', 'gu');
// Cuántos emojis lleva un texto que no lleva nada más (espacios aparte); 0 si lleva algo más o ninguno
export function cuantosEmojis(texto) {
  const t = String(texto ?? '').replace(/\s+/g, '');
  if (!t || t.length > 80) return 0;
  const trozos = t.match(UN_EMOJI) || [];
  return trozos.join('') === t ? trozos.length : 0;
}
// Se pintan en grande y sin burbuja los de 1 a 3 emojis (como WhatsApp)
export const soloEmojis = (texto) => { const n = cuantosEmojis(texto); return n >= 1 && n <= 3 ? n : 0; };

// ------------------------------------------------------------------ mensajes largos
export const LARGO_MAX = 700;
// Un mensaje largo se corta (en un espacio, sin partir una palabra ni un enlace) con «Leer más». { texto, cortado }
export function recortarLargo(texto, max = LARGO_MAX) {
  const t = String(texto ?? '');
  if ([...t].length <= max + 80) return { texto: t, cortado: false };
  const cps = [...t];
  let corte = cps.slice(0, max).join('');
  const hueco = Math.max(corte.lastIndexOf(' '), corte.lastIndexOf('\n'));
  if (hueco > max * 0.6) corte = corte.slice(0, hueco);
  return { texto: `${corte.trimEnd()}…`, cortado: true };
}

// ------------------------------------------------------------------ la píldora del día
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const medianoche = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
// «Hoy», «Ayer», «martes» (en la última semana), «12 de octubre» (este año) o «12 de octubre de 2025»
export function etiquetaDia(iso, ahora = Date.now()) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dias = Math.round((medianoche(ahora) - medianoche(d)) / 864e5);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias > 1 && dias < 7) return DIAS_LARGOS[d.getDay()];
  const anio = d.getFullYear() !== new Date(ahora).getFullYear() ? ` de ${d.getFullYear()}` : '';
  return `${d.getDate()} de ${MESES_LARGOS[d.getMonth()]}${anio}`;
}

// ------------------------------------------------------------------ los ✓ de cada mensaje
// 'pendiente' (⏱: en la bandeja de salida), 'fallo' (!), 'enviado' (✓: en la base), 'entregado' (✓✓ gris: la app de la
// otra parte lo ha descargado) o 'leido' (✓✓ azul). null si no es mío (o es un programado).
export function estadoEnvio(c, yo) {
  if (!c || c.autor !== yo || c.programado || c.eliminado_en) return null;
  if (c.fallo) return 'fallo';
  if (c.pendiente) return 'pendiente';
  if (c.leido_en) return 'leido';
  if (c.entregado_en) return 'entregado';
  return 'enviado';
}
export const TEXTO_ESTADO = { pendiente: 'enviando', fallo: 'no enviado', enviado: 'enviado', entregado: 'entregado', leido: 'leído' };

// ------------------------------------------------------------------ la bandeja de salida
// Un mensaje de texto que sale del móvil: con su id (el mismo al reintentar: la base no lo repite) y su hora. Los de
// cada cuenta van en orden.
const uuid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); }));
export function nuevoPendiente({ perfil, atletaId, autor, texto, respondeA = null, ahora = Date.now(), id = uuid() }) {
  return { cliente_id: id, perfil, atletaId, autor, texto: String(texto ?? '').trim().slice(0, 4000), respondeA: respondeA || null,
    creado_en: new Date(ahora).toISOString(), estado: 'pendiente', error: null, intentos: 0 };
}
// En orden de creación (y, a la misma hora, en el de llegada); sin repetir un id
export function ordenarSalida(lista = []) {
  const vistos = new Set();
  return lista.map((x, i) => [x, i]).filter(([x]) => x && x.cliente_id && !vistos.has(x.cliente_id) && vistos.add(x.cliente_id))
    .sort(([a, i], [b, j]) => String(a.creado_en).localeCompare(String(b.creado_en)) || i - j).map(([x]) => x);
}
// El siguiente que toca enviar de esta cuenta (los fallidos esperan a que se reintenten a mano)
export const siguienteSalida = (lista = [], perfil) => ordenarSalida(lista).find((x) => x.perfil === perfil && x.estado === 'pendiente') || null;
// Al abrir la app: en orden, sin repetir, y lo que quedó «enviando» (la app se cerró a medias) otra vez pendiente
export const retomarSalida = (lista = []) => ordenarSalida(lista).map((x) => (x.estado === 'enviando' ? { ...x, estado: 'pendiente' } : x));
// Los que ya están en la base (por su id) salen de la bandeja
export function quitarYaEnviados(lista = [], mensajes = []) {
  const ids = new Set(mensajes.map((c) => c.cliente_id).filter(Boolean));
  return lista.filter((x) => !ids.has(x.cliente_id));
}
// La conversación con lo que aún está saliendo al final (como burbujas con ⏱ o «!»), sin repetir lo que ya llegó
// (antes de los programados del coach que aún no han salido, que van al final con su hora de salida)
export function conPendientes(mensajes = [], lista = [], { perfil, atletaId, ahora = Date.now() }) {
  const ids = new Set(mensajes.map((c) => c.cliente_id).filter(Boolean));
  const mios = ordenarSalida(lista).filter((x) => x.perfil === perfil && x.atletaId === atletaId && !ids.has(x.cliente_id));
  const futuro = (c) => c.programado || (!!c.enviar_en && Date.parse(c.enviar_en) > ahora);
  const corte = mensajes.findIndex(futuro);
  const pasados = corte < 0 ? mensajes : mensajes.slice(0, corte), futuros = corte < 0 ? [] : mensajes.slice(corte);
  return [...pasados, ...mios.map((x) => ({
    id: `pendiente-${x.cliente_id}`, cliente_id: x.cliente_id, atleta_id: x.atletaId, autor: x.autor, texto: x.texto, responde_a: x.respondeA,
    creado_en: x.creado_en, leido_en: null, entregado_en: null, sesion_id: null, checkin_id: null, archivo_id: null, archivo: null,
    // (uno que acaba de salir, 'enviado', espera aquí con su ✓ a que llegue la conversación de la base)
    reacciones: [], pendiente: x.estado === 'pendiente' || x.estado === 'enviando', fallo: x.estado === 'fallo', error: x.error || null,
  })), ...futuros];
}

// ------------------------------------------------------------------ reenviar y difundir
// ¿Se puede reenviar? Lo del coach (lo de un atleta no: datos de salud de otra persona), del chat, ya salido, sin
// eliminar y sin dibujo. (Lo impone también la base.)
export function reenviable(c, yo, ahora = Date.now()) {
  return yo === 'coach' && !!c && c.autor === 'coach' && !c.eliminado_en && !c.pendiente && !c.fallo && !c.dibujo
    && !(c.enviar_en && Date.parse(c.enviar_en) > ahora) && !c.sesion_id && !c.checkin_id && (!c.archivo_id || !!c.adjunto)
    && !String(c.id || '').startsWith('pendiente-');
}
// A quién va: los elegidos que existen y no están de baja (como mucho 50); cuántos se saltan
export function planReenvio(ids = [], atletas = []) {
  const A = new Map(atletas.map((a) => [a.id, a]));
  const unicos = [...new Set(ids)].filter((id) => A.has(id));
  const destinos = unicos.filter((id) => A.get(id).estado !== 'baja');
  return { destinos: destinos.slice(0, 50), saltados: unicos.length - destinos.length, demasiados: destinos.length > 50 };
}
// Una difusión: a cada miembro que no está de baja; los de baja se saltan (y se dice cuántos)
export function planDifusion(miembros = [], atletas = []) {
  const A = new Map(atletas.map((a) => [a.id, a]));
  const ids = [...new Set(miembros.map((m) => (typeof m === 'string' ? m : m.atleta_id)))].filter((id) => A.has(id));
  const destinos = ids.filter((id) => A.get(id).estado !== 'baja');
  return { destinos, saltados: ids.length - destinos.length };
}
export const textoSaltados = (n) => (!n ? '' : n === 1 ? '1 de baja: no le llega' : `${n} de baja: no les llega`);

// ------------------------------------------------------------------ documentos PDF
export const PDF_MAX_MB = 20;
// Caracteres de control e invisibles (con RegExp y un texto: el empaquetado deja el código en ASCII puro)
const INVISIBLES = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u202a-\\u202e\\u2066-\\u2069\\ufeff]', 'g');
// El nombre que se enseña: sin carpetas (lo de antes de la última barra), sin caracteres de control ni «..», en una
// línea, sin espacios ni puntos al principio, hasta 120 letras y acabado en .pdf. La ruta de Storage la genera la app
// (nunca sale de este nombre).
export function nombreSeguroPdf(nombre) {
  let t = String(nombre ?? '').split(/[\\/]/).pop() || '';
  t = t.replace(INVISIBLES, '').replace(/\s+/g, ' ').trim();
  while (t.includes('..')) t = t.replace(/\.\.+/g, '.');
  t = t.replace(/^[.\s]+/, '').replace(/[<>:"|?*]/g, '_');
  // (sin puntos ni espacios al final: «informe..pdf» no vale)
  let base = t.replace(/\.pdf$/i, '').replace(/[.\s]+$/, '');
  const cps = [...base];
  if (cps.length > 116) base = cps.slice(0, 116).join('').replace(/[.\s]+$/, '');
  if (!base) base = 'documento';
  return `${base}.pdf`;
}
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
// ¿Es un PDF? Su firma («%PDF-») al principio (como permite el formato, en los primeros 1024 bytes)
export function esPdf(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const fin = Math.min(b.length - PDF.length, 1024);
  for (let i = 0; i <= fin; i++) if (PDF.every((x, k) => b[i + k] === x)) return true;
  return false;
}
// Las páginas, si salen fácil (el /Count más alto de los nodos /Pages; si no, cuántos /Page hay). null si no se sabe.
export function paginasPdf(texto) {
  const t = String(texto ?? '');
  let max = 0;
  for (const m of t.matchAll(/\/Type\s*\/Pages\b[^>]{0,400}?\/Count\s+(\d{1,5})/g)) max = Math.max(max, Number(m[1]));
  for (const m of t.matchAll(/\/Count\s+(\d{1,5})[^>]{0,400}?\/Type\s*\/Pages\b/g)) max = Math.max(max, Number(m[1]));
  if (!max) max = (t.match(/\/Type\s*\/Page(?![a-zA-Z])/g) || []).length;
  return max >= 1 && max <= 5000 ? max : null;
}
export function tamanoTexto(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1048576).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB`;
}
export const textoPaginas = (n) => (n ? (n === 1 ? '1 página' : `${n} páginas`) : '');

// ------------------------------------------------------------------ silenciar
export const OPCIONES_SILENCIO = [['8h', '8 horas'], ['semana', '1 semana'], ['siempre', 'Siempre']];
// Hasta cuándo (null: siempre)
export function hastaSilencio(opcion, ahora = Date.now()) {
  if (opcion === '8h') return new Date(ahora + 8 * 3600000).toISOString();
  if (opcion === 'semana') return new Date(ahora + 7 * 864e5).toISOString();
  if (opcion === 'siempre') return null;
  throw new Error('Elige 8 horas, 1 semana o siempre');
}
// ¿Está silenciada? s: su fila ({ hasta }) o nada
export const silenciado = (s, ahora = Date.now()) => !!s && (s.hasta == null || Date.parse(s.hasta) > ahora);
const hhmm = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
export function textoSilencio(s, ahora = Date.now()) {
  if (!silenciado(s, ahora)) return null;
  if (s.hasta == null) return 'Silenciado siempre';
  const d = new Date(s.hasta);
  const dias = Math.round((medianoche(d) - medianoche(ahora)) / 864e5);
  if (dias === 0) return `Silenciado hasta las ${hhmm(d)}`;
  if (dias === 1) return `Silenciado hasta mañana a las ${hhmm(d)}`;
  return `Silenciado hasta el ${d.getDate()} de ${MESES_LARGOS[d.getMonth()]}`;
}

// ------------------------------------------------------------------ fijar
export const DURACIONES_FIJAR = [['24h', '24 horas', 24], ['7d', '7 días', 168], ['30d', '30 días', 720]];
export function hastaFijado(clave, ahora = Date.now()) {
  const d = DURACIONES_FIJAR.find(([k]) => k === clave);
  if (!d) throw new Error('Elige 24 horas, 7 días o 30 días');
  return new Date(ahora + d[2] * 3600000).toISOString();
}
export const fijadoVigente = (f, ahora = Date.now()) => !!f && !!f.comentario_id && (f.hasta == null || Date.parse(f.hasta) > ahora);

// ------------------------------------------------------------------ seleccionar varios
const dd = (n) => String(n).padStart(2, '0');
// Como WhatsApp al copiar varios: «[12/10/26, 18:42] Ana: el texto», uno por línea, en orden
export function textoCopiado(mensajes = [], nombreDe = (a) => a) {
  return [...mensajes].sort((a, b) => String(a.creado_en).localeCompare(String(b.creado_en)))
    .filter((c) => !c.eliminado_en)
    .map((c) => {
      const d = new Date(c.creado_en);
      const cuando = `${dd(d.getDate())}/${dd(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}, ${hhmm(d)}`;
      return `[${cuando}] ${nombreDe(c.autor)}: ${textoPlano(c.texto || '')}`;
    }).join('\n');
}
// Lo que se puede hacer con lo seleccionado: { copiar, destacar, eliminar: { ok, motivo }, reenviar }
export function accionesSeleccion(sel = [], yo, ahora = Date.now(), { horas = 48 } = {}) {
  const vivos = sel.filter((c) => !c.eliminado_en && !c.pendiente && !c.fallo);
  const eliminar = !sel.length ? { ok: false, motivo: 'Elige algún mensaje' }
    : sel.some((c) => c.autor !== yo) ? { ok: false, motivo: 'Solo se eliminan para todos tus mensajes' }
    : sel.some((c) => c.eliminado_en || c.pendiente || c.fallo) ? { ok: false, motivo: 'Alguno ya está eliminado o aún no ha salido' }
    : sel.some((c) => !(c.enviar_en && Date.parse(c.enviar_en) > ahora) && ahora - Date.parse(c.creado_en) > horas * 3600000) ? { ok: false, motivo: `Solo los de las últimas ${horas} horas` }
    : { ok: true, motivo: null };
  return {
    copiar: vivos.length > 0,
    destacar: vivos.length > 0 && vivos.length === sel.length && !sel.some((c) => c.programado),
    eliminar,
    reenviar: yo === 'coach' && sel.length > 0 && sel.every((c) => reenviable(c, yo, ahora)),
  };
}

// ---------------------------------------------------------------------------------------------------------- v0.56
// Buscar por tipo en el chat (como WhatsApp): fotos, vídeos, enlaces, documentos o notas de voz. Lo más reciente primero.
export const TIPOS_BUSQUEDA = [['foto', 'Fotos'], ['video', 'Vídeos'], ['enlace', 'Enlaces'], ['documento', 'Documentos'], ['audio', 'Notas de voz']];
export function porTipo(mensajes = [], tipo, ahora = Date.now()) {
  const ok = (c) => !c.eliminado_en && !(c.enviar_en && Date.parse(c.enviar_en) > ahora);
  const es = tipo === 'enlace' ? (c) => trozosConEnlaces(c.texto || '').some((x) => x.tipo === 'enlace')
    : (c) => (c.archivo || c.archivoId || c.archivo_id) && medioDe(c) === tipo;
  return mensajes.filter((c) => ok(c) && es(c)).map((c) => c.id).reverse();
}
// Ir a una fecha: el primer mensaje de ese día o, si ese día no hubo, del siguiente que tenga (null si no hay ninguno
// desde entonces). fecha: 'AAAA-MM-DD' (del día de quien mira); diaDe: la fecha local de un mensaje.
export function primeroDesde(mensajes = [], fecha, diaDe) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ''))) return null;
  return mensajes.find((c) => diaDe(c.creado_en) >= fecha && !(c.programado))?.id || null;
}
// ↑ con el cuadro vacío: editar el último mensaje propio que aún se puede editar (texto, sin eliminar, en sus 15 min)
export function ultimoEditable(mensajes = [], yo, puede) {
  for (let i = mensajes.length - 1; i >= 0; i--) {
    const c = mensajes[i];
    if (c.autor === yo && !c.pendiente && !c.fallo && puede(c)) return c;
  }
  return null;
}
// ¿Suena? Solo con el chat abierto y a la vista, con los sonidos activados, sin la conversación silenciada y por lo que
// llega o sale ahora (nunca al abrir ni al cargar lo anterior)
export function debeSonar({ activado = true, silenciada = false, visible = true, alCargar = false } = {}) {
  return !!activado && !silenciada && !!visible && !alCargar;
}
// Lo que llegó nuevo de la otra parte entre dos vistas del chat (para el sonido): ids que no estaban, de la otra parte
export function llegadosNuevos(antes = [], ahora = [], yo) {
  const vistos = new Set(antes.map((c) => c.cliente_id || c.id));
  return ahora.filter((c) => !vistos.has(c.cliente_id || c.id) && c.autor !== yo && !c.eliminado_en);
}
// El número del icono de la app: lo sin leer (como mucho 99; 0 lo quita)
export const numeroInsignia = (n) => Math.max(0, Math.min(99, Math.floor(Number(n) || 0)));
