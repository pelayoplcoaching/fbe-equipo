// Los vídeos de técnica (v0.57, migración 035): lo que no depende de la pantalla, la cámara ni la base.
// Encuadre según el ejercicio, el nivel del móvil, la serie del vídeo, las marcas de la barra de tiempo, el tempo de cada
// repetición, los puntos clave (con unos sugeridos), la nota de técnica, el estado («Enviado → Visto → Corregido»), el
// enlace de un aviso al momento corregido, superponer dos vídeos, el zoom, «Mi técnica» y la limpieza de lo antiguo.
import { patronEjercicio } from './diseno.js';
import { textoVisible } from './texto.js';
import { partirMomentos, textoMomento } from './momentos.js';
import { dibujoValido } from './dibujo.js';
import { normal as sinTildes } from './busqueda.js';

// ---------- Cámara guiada: el encuadre de cada ejercicio ----------
// De lado para lo que va adelante y atrás (sentadilla, peso muerto, hip thrust, remos); a 45° para los press (se ven la
// barra, los codos y la espalda a la vez); de frente para lo que se tuerce hacia los lados (zancadas, búlgaras,
// dominadas y jalones). Si no se sabe, de lado (lo más útil para casi todo).
export const VISTAS = {
  lado: { titulo: 'De lado', texto: 'De lado, con el móvil a la altura de la cadera y a unos 3 m: que se vean la barra (o el peso), los pies y la cabeza en todo momento.' },
  '45': { titulo: 'A 45°', texto: 'En diagonal (a 45°), con el móvil a la altura del pecho y a unos 2–3 m: que se vean la barra, los codos y la espalda.' },
  frente: { titulo: 'De frente', texto: 'De frente, con el móvil a la altura de la cadera y a unos 3 m: que se vean las rodillas, la cadera y los hombros de lado a lado.' },
};
const VISTA_PATRON = { sentadilla: 'lado', bisagra: 'lado', tiron_h: 'lado', empuje_h: '45', empuje_v: '45', unilateral: 'frente', tiron_v: 'frente', brazo: 'lado', pierna: 'lado', core: 'lado', cardio: 'lado', otro: 'lado' };
export function encuadreDe(nombre = '', grupos = [], tipo = []) {
  const patron = patronEjercicio(nombre, grupos, tipo);
  const vista = VISTA_PATRON[patron] || 'lado';
  return { patron, vista, ...VISTAS[vista] };
}

// El nivel del móvil con DeviceOrientation (beta, gamma en grados) y el giro de la pantalla (0, 90, 180, 270):
// inclinación = cuánto está girado sobre sí mismo (lo que tuerce el horizonte del vídeo); cabeceo = cuánto mira hacia
// arriba o hacia abajo respecto a la vertical. estado: 'recto' (≤ 3°), 'casi' (≤ 8°) o 'torcido'.
const RAD = Math.PI / 180;
const normal180 = (g) => { let x = ((g + 180) % 360 + 360) % 360 - 180; if (x === -180) x = 180; return x; };
export function nivelDe({ beta, gamma } = {}, anguloPantalla = 0) {
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return null;
  const b = beta * RAD, g = gamma * RAD;
  const gx = Math.cos(b) * Math.sin(g), gy = Math.sin(b), gz = Math.cos(b) * Math.cos(g);
  const inclinacion = Math.round(normal180(Math.atan2(gx, gy) / RAD - (Number(anguloPantalla) || 0)) * 10) / 10;
  const cabeceo = Math.round((Math.asin(Math.max(-1, Math.min(1, gz))) / RAD) * 10) / 10;
  const a = Math.abs(inclinacion);
  return { inclinacion, cabeceo, estado: a <= 3 ? 'recto' : a <= 8 ? 'casi' : 'torcido', vertical: Math.abs(cabeceo) <= 15 };
}
export const textoNivel = (n) => (!n ? 'Sin nivel en este móvil' : n.estado === 'recto' ? (n.vertical ? 'Recto' : 'Recto, pero ponlo más vertical')
  : `Torcido ${Math.round(Math.abs(n.inclinacion))}°: ${n.inclinacion > 0 ? 'gíralo un poco a la izquierda' : 'gíralo un poco a la derecha'}`);

export const CUENTAS_ATRAS = [3, 5, 10];
export const PARAR_SOLA = [0, 15, 30, 45, 60];
export const MAX_GRABACION_SEG = 120;
// El formato de la grabación: MP4 si el navegador sabe (se avanza fotograma a fotograma en cualquier móvil); si no, WebM
const FORMATOS_VIDEO = [['video/mp4;codecs=avc1', 'video/mp4', 'mp4'], ['video/mp4', 'video/mp4', 'mp4'], ['video/webm;codecs=vp9', 'video/webm', 'webm'], ['video/webm;codecs=vp8', 'video/webm', 'webm'], ['video/webm', 'video/webm', 'webm']];
export function formatoVideo(esCompatible) {
  if (typeof esCompatible !== 'function') return null;
  for (const [grabar, tipo, ext] of FORMATOS_VIDEO) { try { if (esCompatible(grabar)) return { grabar, tipo, ext }; } catch { /* */ } }
  return null;
}
export function errorCamara(e) {
  const n = e?.name || '';
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return 'No has dado permiso para usar la cámara. Puedes darlo en los ajustes del navegador o elegir un vídeo de la galería.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'DevicesNotFoundError') return 'No se encuentra ninguna cámara en este dispositivo. Elige un vídeo de la galería.';
  if (n === 'NotReadableError' || n === 'TrackStartError') return 'La cámara la está usando otra app: ciérrala y vuelve a probar.';
  if (n === 'NoSoportado') return 'Este navegador no puede grabar vídeo. Elige un vídeo de la galería.';
  return 'No se puede abrir la cámara en este dispositivo. Elige un vídeo de la galería.';
}

// ---------- La serie del vídeo ----------
const coma = (x, dec = 2) => String(Math.round(Number(x) * 10 ** dec) / 10 ** dec).replace('.', ',');
// «60 kg × 8 @8» (sin carga: «8 reps @8»; sin esfuerzo, sin @)
export function textoSerieVideo(s) {
  if (!s || !(Number(s.reps) >= 0) || s.reps == null) return null;
  const kg = Number(s.kg) > 0 ? `${coma(s.kg)} kg × ${s.reps}` : `${s.reps} reps`;
  return `${kg}${s.rpe != null && Number(s.rpe) > 0 ? ` @${coma(s.rpe, 1)}` : ''}`;
}
export const serieValida = (n) => n == null || (Number.isInteger(n) && n >= 1 && n <= 30);

// ---------- Las marcas de la barra de tiempo ----------
// Cada corrección con su momento: los minutos de un comentario («0:02»), un dibujo, la voz del coach y los puntos
// clave con su momento. Ordenadas, dentro del vídeo y sin repetir (la misma cosa a menos de 0,15 s, una).
export const NOMBRE_MARCA = { comentario: 'Comentario', dibujo: 'Dibujo', voz: 'Voz del coach', punto: 'Punto clave', tempo: 'Tempo' };
export function marcadores({ comentarios = [], revision = null, duracion = null } = {}) {
  const out = [];
  const dur = Number.isFinite(duracion) && duracion > 0 ? duracion : 3600;
  for (const c of comentarios || []) {
    if (!c || c.eliminado_en) continue;
    if (dibujoValido(c.dibujo)) out.push({ t: c.dibujo.t, tipo: 'dibujo', id: c.id, hasta: c.dibujo.hasta ?? null });
    for (const p of partirMomentos(String(c.texto || ''))) if (p.momento) out.push({ t: p.t, tipo: 'comentario', id: c.id });
  }
  if (revision?.voz_archivo_id && Number.isFinite(Number(revision.voz_inicio))) out.push({ t: Number(revision.voz_inicio), tipo: 'voz', id: 'voz' });
  for (const [i, p] of (revision?.checklist?.puntos || []).entries()) if (Number.isFinite(p?.s)) out.push({ t: p.s, tipo: 'punto', id: `punto-${i}`, texto: p.t });
  const dentro = out.filter((m) => m.t >= 0 && m.t <= dur + 0.5).map((m) => ({ ...m, t: Math.min(m.t, dur) })).sort((a, b) => a.t - b.t || a.tipo.localeCompare(b.tipo));
  const unicos = [];
  for (const m of dentro) if (!unicos.some((u) => u.tipo === m.tipo && Math.abs(u.t - m.t) < 0.15)) unicos.push(m);
  return unicos.map((m) => ({ ...m, etiqueta: `${NOMBRE_MARCA[m.tipo]} en ${textoMomento(m.t, true)}${m.texto ? `: ${m.texto}` : ''}` }));
}
// El siguiente (o el anterior) desde t: para saltar de corrección en corrección con el teclado
export function marcaVecina(marcas, t, sentido = 1) {
  const xs = (marcas || []).map((m) => m.t);
  if (sentido > 0) return marcas.find((m) => m.t > t + 0.05) || null;
  for (let i = xs.length - 1; i >= 0; i--) if (xs[i] < t - 0.05) return marcas[i];
  return null;
}

// ---------- El tempo de cada repetición ----------
// Se marcan, en orden, tres momentos por repetición: empieza la bajada (excéntrica), abajo y acaba la subida (concéntrica).
export const FASES_TEMPO = ['Empieza la bajada', 'Abajo', 'Arriba (fin de la subida)'];
export const MAX_REPS_TEMPO = 30;
const r2 = (x) => Math.round(x * 100) / 100;
// Las marcas sueltas en repeticiones de tres (la última, si está a medias, aparte)
export function repsDeMarcas(marcas = []) {
  const xs = (marcas || []).filter((x) => Number.isFinite(x)).map(r2);
  const reps = [];
  for (let i = 0; i + 2 < xs.length; i += 3) reps.push([xs[i], xs[i + 1], xs[i + 2]]);
  return { reps: reps.slice(0, MAX_REPS_TEMPO), aMedias: xs.slice(reps.length * 3) };
}
// ¿Se puede marcar este momento? (después del anterior y dentro del vídeo)
export const marcaTempoValida = (marcas, t, dur = null) => Number.isFinite(t) && t >= 0 && (!(dur > 0) || t <= dur + 1) && (!marcas.length || r2(t) > marcas[marcas.length - 1] - (marcas.length % 3 === 0 ? 0.0001 : 0)) && marcas.length < MAX_REPS_TEMPO * 3;
// Como tempo_valido() en la base (y la duración, como el trigger)
export function tempoValido(t, dur = null) {
  if (!t || typeof t !== 'object' || Array.isArray(t) || !Object.keys(t).every((k) => k === 'reps')) return false;
  if (!Array.isArray(t.reps) || t.reps.length < 1 || t.reps.length > MAX_REPS_TEMPO) return false;
  let prev = -1;
  const tope = Number.isFinite(dur) && dur >= 0 ? dur + 1 : 3600;
  for (const r of t.reps) {
    if (!Array.isArray(r) || r.length !== 3) return false;
    for (const x of r) { if (typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > 3600 || x > tope || x <= prev) return false; prev = x; }
    prev -= 0.0001;
  }
  return true;
}
// La tabla: segundos de bajada y de subida de cada repetición, y la media
export function tablaTempo(t) {
  const reps = (t?.reps || []).map(([a, b, c], i) => ({ n: i + 1, bajada: r2(b - a), subida: r2(c - b), total: r2(c - a) }));
  if (!reps.length) return { reps, media: null };
  const m = (k) => r2(reps.reduce((s, x) => s + x[k], 0) / reps.length);
  return { reps, media: { bajada: m('bajada'), subida: m('subida'), total: m('total') } };
}
export const textoSegundos = (s) => `${String(r2(s).toFixed(1)).replace('.', ',')} s`;

// ---------- Puntos clave (la lista del coach) ----------
// Sugeridos para los básicos: indicaciones neutras y comprobables en un vídeo, en la línea de los manuales de la NSCA y
// del ACSM (alineación, recorrido controlado, tronco estable); el coach los cambia a su gusto.
export const MAX_PUNTOS = 15;
export const MAX_TEXTO_PUNTO = 120;
const SUGERIDOS = {
  hip_thrust: ['Barbilla recogida y mirada al frente', 'Espalda apoyada a la altura de las escápulas', 'Tibias verticales arriba', 'Arriba, la cadera alineada con rodillas y hombros', 'Bloqueo con glúteos, sin arquear la zona lumbar', 'Pausa breve arriba y bajada controlada'],
  sentadilla: ['Pie entero apoyado: talón, base del dedo gordo y del meñique', 'Rodillas en la dirección de los pies (sin irse hacia dentro)', 'Profundidad que se mantiene con la espalda neutra', 'La barra sube y baja en la vertical del medio pie', 'Cadera y pecho suben a la vez', 'Aire y tronco firme antes de cada repetición'],
  bisagra: ['Barra pegada al cuerpo, en la vertical del medio pie', 'Espalda neutra de principio a fin', 'Al despegar, hombros encima o un poco por delante de la barra', 'Cadera y hombros suben a la vez', 'Bloqueo con glúteos, sin echarse hacia atrás', 'Bajada controlada, sin soltar la barra'],
  empuje_h: ['Escápulas juntas y hacia abajo toda la serie', 'Pies firmes en el suelo y glúteos en el banco', 'Codos a unos 45° del tronco', 'La barra toca el pecho controlada, sin rebotar', 'Muñecas rectas, encima de los codos', 'Trayectoria igual en cada repetición'],
  empuje_v: ['Glúteos y abdomen firmes, sin arquear la zona lumbar', 'La barra sube cerca de la cara', 'Antebrazos verticales', 'Bloqueo completo arriba, con la barra encima del medio pie', 'Muñecas rectas'],
  tiron_h: ['Espalda neutra y tronco quieto, sin balanceo', 'Tira con los codos hacia la cadera', 'Escápulas juntas al final', 'Bajada controlada hasta estirar los brazos', 'Cuello neutro'],
  tiron_v: ['Empieza con los brazos estirados', 'Hombros abajo antes de tirar', 'Pecho hacia la barra, sin balanceo', 'Recorrido completo arriba', 'Bajada controlada'],
  unilateral: ['Rodilla de delante en la dirección del pie', 'Tronco estable, sin irse hacia un lado', 'Peso en todo el pie de delante', 'Pelvis nivelada', 'La misma profundidad en cada repetición'],
  general: ['Recorrido completo y controlado', 'Sin impulso ni balanceo', 'Postura estable de principio a fin', 'La última repetición, con la misma técnica que la primera'],
};
const HIP_THRUST = /\b(hip ?thrust|empuje de cadera|puentes? de gluteos?|puente de gluteo)\b/;
export function checklistSugerido(nombre = '', grupos = [], tipo = []) {
  if (HIP_THRUST.test(sinTildes(String(nombre || '')))) return [...SUGERIDOS.hip_thrust];
  const p = patronEjercicio(nombre, grupos, tipo);
  return [...(SUGERIDOS[p] || SUGERIDOS.general)];
}
const largo = (s) => [...String(s)].length;
// Como puntos_tecnica_validos() (la lista del coach de un ejercicio)
export const plantillaValida = (ps) => Array.isArray(ps) && ps.length >= 1 && ps.length <= MAX_PUNTOS
  && ps.every((x) => typeof x === 'string' && largo(x.trim()) >= 1 && largo(x.trim()) <= MAX_TEXTO_PUNTO && textoVisible(x));
export const limpiarPlantilla = (ps) => [...new Set((ps || []).map((x) => String(x ?? '').replace(/\s+/g, ' ').trim()).filter((x) => x && textoVisible(x)).map((x) => [...x].slice(0, MAX_TEXTO_PUNTO).join('')))].slice(0, MAX_PUNTOS);
export const ESTADOS_PUNTO = [['bien', '✓', 'Bien'], ['mal', '✗', 'A corregir'], ['na', '–', 'No se ve']];
// Como checklist_valido() en la base
export function checklistValido(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c) || !Object.keys(c).every((k) => k === 'puntos')) return false;
  if (!Array.isArray(c.puntos) || c.puntos.length < 1 || c.puntos.length > MAX_PUNTOS) return false;
  return c.puntos.every((p) => p && typeof p === 'object' && !Array.isArray(p) && Object.keys(p).every((k) => ['t', 'e', 's'].includes(k))
    && typeof p.t === 'string' && largo(p.t) >= 1 && largo(p.t) <= MAX_TEXTO_PUNTO && textoVisible(p.t)
    && ['bien', 'mal', 'na'].includes(p.e) && (!('s' in p) || (typeof p.s === 'number' && Number.isFinite(p.s) && p.s >= 0 && p.s <= 3600)));
}
// Lo que se guarda: los puntos con su estado (los que no tienen, fuera); su momento, en décimas
export function limpiarChecklist(puntos) {
  const out = (puntos || []).filter((p) => p && ['bien', 'mal', 'na'].includes(p.e) && textoVisible(p.t)).slice(0, MAX_PUNTOS)
    .map((p) => ({ t: [...String(p.t).replace(/\s+/g, ' ').trim()].slice(0, MAX_TEXTO_PUNTO).join(''), e: p.e, ...(Number.isFinite(p.s) && p.s >= 0 ? { s: Math.round(Math.min(3600, p.s) * 10) / 10 } : {}) }));
  return out.length ? { puntos: out } : null;
}
export function resumenChecklist(c) {
  const ps = c?.puntos || [];
  return { bien: ps.filter((p) => p.e === 'bien').length, mal: ps.filter((p) => p.e === 'mal').length, na: ps.filter((p) => p.e === 'na').length, total: ps.length };
}

// ---------- La nota de técnica (1 a 5) ----------
export const puntuacionValida = (n) => n == null || (Number.isInteger(n) && n >= 1 && n <= 5);
export const NOMBRE_PUNTUACION = { 1: 'Hay que trabajarla', 2: 'Mejorable', 3: 'Correcta', 4: 'Buena', 5: 'Muy buena' };
// Las notas de un ejercicio a lo largo del tiempo (para la gráfica): [{ x: día, y }], una por día (la última del día)
export function seriePuntuaciones(videos = []) {
  const por = new Map();
  const orden = [...(videos || [])].filter((v) => puntuacionValida(v?.revision?.puntuacion) && v.revision?.puntuacion != null && v.fecha)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : String(a.creado_en || '').localeCompare(String(b.creado_en || ''))));
  for (const v of orden) por.set(v.fecha, v.revision.puntuacion);
  return [...por.entries()].map(([x, y]) => ({ x, y }));
}

// ---------- Enviado → Visto → Corregido ----------
// corregido: la corrección del coach (nota, puntos, tempo o voz) o una respuesta suya en el hilo del vídeo
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const diaCorto = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${Number(iso.slice(8, 10))} ${MESES_C[Number(iso.slice(5, 7)) - 1]}` : '');
export function estadoVideo({ revision = null, respondido = false } = {}) {
  if (revision?.corregido_el || respondido) return { estado: 'corregido', texto: 'Corregido' };
  if (revision?.visto_el) return { estado: 'visto', texto: `Visto el ${diaCorto(revision.visto_el)}` };
  return { estado: 'enviado', texto: 'Enviado' };
}
export const PASOS_ESTADO = [['enviado', 'Enviado'], ['visto', 'Visto'], ['corregido', 'Corregido']];

// ---------- El enlace de un aviso: #videos/<id>@<segundos> ----------
// (como notificaciones_validas y fbe_privado.enlace_video en la base: el id y, si lo hay, el momento con una décima)
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const RE_ENLACE_VIDEO = new RegExp(`^#videos/(${UUID})(?:@([0-9]{1,4}(?:\\.[0-9])?))?$`);
export function enlaceVideo(id, t = null) {
  if (!new RegExp(`^${UUID}$`).test(String(id || ''))) return null;
  return `#videos/${id}${Number.isFinite(t) && t >= 0 ? `@${(Math.round(Math.min(9999, t) * 10) / 10).toFixed(1)}` : ''}`;
}
export function leerEnlaceVideo(hash) {
  const m = RE_ENLACE_VIDEO.exec(String(hash || ''));
  return m ? { id: m[1], t: m[2] != null ? Number(m[2]) : null } : null;
}

// ---------- Superponer dos vídeos ----------
// Cada uno con su marca (el principio de la repetición): el otro va al mismo punto de su repetición
export const tiempoOtro = (tA, marcaA = 0, marcaB = 0, durB = null) => {
  const t = tA - (Number(marcaA) || 0) + (Number(marcaB) || 0);
  return Math.max(0, Number.isFinite(durB) && durB > 0 ? Math.min(t, durB) : t);
};
// La voz del coach, al ritmo del vídeo: su momento (o null si el vídeo está fuera de ella)
export const tiempoVoz = (tVideo, inicio = 0, dur = 0) => {
  const t = tVideo - (Number(inicio) || 0);
  return t >= 0 && t < (Number(dur) || 0) ? t : null;
};

// ---------- Zoom ----------
export const ZOOM_MIN = 1, ZOOM_MAX = 4;
export const limitarZoom = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number.isFinite(z) ? z : 1));
// El desplazamiento que deja la imagen tapando su caja (con zoom 1, ninguno)
export function limitarPan({ x = 0, y = 0 } = {}, z = 1, w = 0, h = 0) {
  const mx = ((limitarZoom(z) - 1) * w) / 2, my = ((limitarZoom(z) - 1) * h) / 2;
  return { x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
}

// ---------- «Mi técnica»: los vídeos por ejercicio ----------
// videos: los del diario (con ejercicio y revisión). Por ejercicio (el más reciente primero), cada uno con su gráfica
export function tecnicaPorEjercicio(videos = []) {
  const grupos = new Map();
  for (const v of videos || []) {
    if (v?.tipo && v.tipo !== 'video_tecnica') continue;
    const id = v.ejercicio?.id || 'sin';
    if (!grupos.has(id)) grupos.set(id, { id, nombre: v.ejercicio?.nombre || 'Sin ejercicio', videos: [] });
    grupos.get(id).videos.push(v);
  }
  return [...grupos.values()].map((g) => {
    const vs = [...g.videos].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : String(b.creado_en || '').localeCompare(String(a.creado_en || ''))));
    const puntos = seriePuntuaciones(vs);
    return { ...g, videos: vs, puntos, ultima: puntos.length ? puntos[puntos.length - 1].y : null, ultimoDia: vs[0]?.fecha || null };
  }).sort((a, b) => (a.id === 'sin') - (b.id === 'sin') || (a.ultimoDia < b.ultimoDia ? 1 : a.ultimoDia > b.ultimoDia ? -1 : a.nombre.localeCompare(b.nombre)));
}

// ---------- Revisar seguidos: el orden ----------
export const ORDENES_COLA = [['antiguos', 'Más antiguos'], ['atleta', 'Por atleta'], ['ejercicio', 'Por ejercicio']];
export function ordenarCola(videos = [], orden = 'antiguos') {
  const clave = (v) => String(v.creado_en || v.fecha || '');
  const xs = [...(videos || [])].sort((a, b) => clave(a).localeCompare(clave(b)));
  if (orden === 'atleta') return xs.sort((a, b) => String(a.atleta?.nombre || '').localeCompare(String(b.atleta?.nombre || ''), 'es') || clave(a).localeCompare(clave(b)));
  if (orden === 'ejercicio') return xs.sort((a, b) => (!a.ejercicio?.nombre) - (!b.ejercicio?.nombre) || String(a.ejercicio?.nombre || '').localeCompare(String(b.ejercicio?.nombre || ''), 'es') || clave(a).localeCompare(clave(b)));
  return xs;
}

// ---------- Limpieza y aviso del almacenamiento ----------
// Como fbe_privado.videos_viejos() en la base: de técnica, de más de «meses» meses (desde que llegó y por su día: los dos),
// ya revisado o corregido (no espera en la cola del coach), sin destacar, sin un mensaje o una corrección de los últimos
// «dias» días (abrirlo, «Visto», no cuenta), sin una repetición de esos días y sin una tarea por revisar
export function restarMeses(iso, meses) {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) - meses;
  const ny = Math.floor(total / 12), nm = total % 12;
  const ultimo = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}
const DIA_MADRID = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' });
const diaMadrid = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? DIA_MADRID.format(new Date(t)) : null; };
export const DIAS_LIMPIEZA_MIN = 7;
export function videosViejos(archivos = [], { comentarios = [], revisiones = [], tareas = [], meses, dias = 30, hoy, ahora = Date.now() } = {}) {
  const corte = restarMeses(hoy, meses);
  const desde = ahora - dias * 864e5;
  const reciente = (iso) => !!iso && Date.parse(iso) > desde;
  const corregida = (a) => (revisiones || []).some((r) => r.archivo_id === a.id && r.corregido_en);
  const llego = (a) => [a.fecha, diaMadrid(a.creado_en)].filter(Boolean).sort().pop() || null;
  return (archivos || []).filter((a) => a.tipo === 'video_tecnica' && !a.destacado && !!llego(a) && llego(a) < corte
    && (!!a.revisado_en || corregida(a))
    && !(comentarios || []).some((c) => c.archivo_id === a.id && reciente(c.creado_en))
    && !(revisiones || []).some((r) => r.archivo_id === a.id && r.corregido_en && reciente(r.actualizado_en))
    && !(archivos || []).some((n) => n.repite_de === a.id && reciente(n.creado_en))
    && !(tareas || []).some((t) => t.archivo_id === a.id && !t.revisada_en));
}
export const PLANES_GB = [[1, 'Plan gratuito (1 GB)'], [100, 'Plan Pro (100 GB)']];
export function avisoAlmacenamiento(bytes = 0, planGb = 1) {
  const tope = (Number(planGb) > 0 ? Number(planGb) : 1) * 1024 ** 3;
  const pct = Math.round((Math.max(0, Number(bytes) || 0) / tope) * 1000) / 10;
  const nivel = pct >= 95 ? 'lleno' : pct >= 80 ? 'cerca' : 'ok';
  return { pct, nivel, texto: nivel === 'lleno' ? `El almacenamiento está casi lleno (${String(pct).replace('.', ',')} %): borra vídeos antiguos o cambia de plan.`
    : nivel === 'cerca' ? `Vas por el ${String(pct).replace('.', ',')} % del almacenamiento de tu plan: es buen momento para limpiar vídeos antiguos.` : null };
}
export const MESES_LIMPIEZA = [3, 6, 12, 24];
