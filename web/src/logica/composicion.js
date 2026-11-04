// v0.60: lo que no depende de la pantalla del «compositor» de vídeo (ui/tecnica/compositor.js), que pinta un vídeo y lo
// que va encima (dibujos, marcas, textos, la burbuja de la cámara de delante, la cara tapada) en un lienzo y lo graba en
// el propio móvil. Aquí: el formato de la grabación, el tamaño de salida, los topes, qué se ve encima en cada momento
// (exportar con correcciones) y las esquinas de la burbuja. Todo comprobable sin navegador.
import { dibujoValido } from './dibujo.js';
import { partirMomentos } from './momentos.js';
import { NOMBRE_PUNTUACION } from './tecnica.js';

// ---------- Topes ----------
export const MAX_SEG_REVISION = 180;   // «Grabar la revisión» y «Exportar con correcciones»: 3 minutos como mucho
export const MAX_SEG_CARA = 60;        // la respuesta con la cámara de delante: un minuto (como una nota de voz)
export const MAX_SEG_DIFUMINAR = 120;  // difuminar la cara: los vídeos de técnica son de una serie (2 min de sobra)
export const MAX_MUESTRAS_CARA = 600;  // fotogramas que se miran para encontrar la cara (memoria y tiempo acotados)
export const LADO_CORTO_MAX = 720, LADO_LARGO_MAX = 1280; // 720p como mucho
export const FPS_COMPOSICION = 30;
export const BITS_COMPOSICION = 2_500_000;
// Lo que la base admite de una respuesta en vídeo (038): mp4 o webm, de 1 s al tope (con un segundo de margen)
export const MAX_SEG_RESPUESTA = { coach: MAX_SEG_REVISION + 1, atleta: MAX_SEG_CARA + 1 };
export const MAX_BYTES_RESPUESTA = 104857600; // 100 MB (3 min a 2,5 Mb/s son ~56 MB)

// ---------- El formato ----------
// MP4 si el navegador sabe (Safari y Chrome reciente: se avanza fotograma a fotograma en cualquier móvil); si no, WebM
// (VP9 o VP8). Con sonido (la voz del coach, el micro), con su códec de audio; el de Safari («video/mp4» a secas) pone AAC.
const CON_AUDIO = [
  ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4', 'mp4'], ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'mp4'], ['video/mp4', 'video/mp4', 'mp4'],
  ['video/webm;codecs=vp9,opus', 'video/webm', 'webm'], ['video/webm;codecs=vp8,opus', 'video/webm', 'webm'], ['video/webm', 'video/webm', 'webm'],
];
const SIN_AUDIO = [
  ['video/mp4;codecs=avc1.42E01F', 'video/mp4', 'mp4'], ['video/mp4;codecs=avc1', 'video/mp4', 'mp4'], ['video/mp4', 'video/mp4', 'mp4'],
  ['video/webm;codecs=vp9', 'video/webm', 'webm'], ['video/webm;codecs=vp8', 'video/webm', 'webm'], ['video/webm', 'video/webm', 'webm'],
];
// esCompatible: MediaRecorder.isTypeSupported (o una de prueba). null si no sabe ninguno (el botón no sale)
export function elegirFormato(esCompatible, { audio = false } = {}) {
  if (typeof esCompatible !== 'function') return null;
  for (const [grabar, tipo, ext] of audio ? CON_AUDIO : SIN_AUDIO) {
    try { if (esCompatible(grabar)) return { grabar, tipo, ext }; } catch { /* */ }
  }
  return null;
}
// El tipo sin sus códecs («video/webm;codecs=vp9» → «video/webm»): lo que se guarda y lo que admite la base
export const tipoBase = (t) => String(t || '').split(';')[0].trim().toLowerCase();
export const tipoRespuestaValido = (t) => ['video/mp4', 'video/webm'].includes(tipoBase(t));

// ---------- El tamaño de salida ----------
// El lado corto a 720 como mucho y el largo a 1280, en múltiplos de 16 (algunos codificadores de Android fallan con otras
// medidas). Nunca más grande que el original.
export function medidasSalida(w, h) {
  const W = Number(w) > 0 ? Number(w) : 720, H = Number(h) > 0 ? Number(h) : 1280;
  const k = Math.min(1, LADO_CORTO_MAX / Math.min(W, H), LADO_LARGO_MAX / Math.max(W, H));
  const m16 = (x) => Math.max(16, Math.round((x * k) / 16) * 16);
  return { w: m16(W), h: m16(H) };
}
// El rectángulo de la imagen dentro del lienzo (encajada, con bandas si no coincide la proporción)
export function encajar(W, H, vw, vh) {
  if (!W || !H || !vw || !vh) return { x: 0, y: 0, w: W || 0, h: H || 0 };
  const k = Math.min(W / vw, H / vh);
  return { x: (W - vw * k) / 2, y: (H - vh * k) / 2, w: vw * k, h: vh * k };
}
// ¿Cabe una grabación de seg segundos? (el tope de cada cosa)
export const dentroDelTope = (seg, tope = MAX_SEG_REVISION) => Number.isFinite(Number(seg)) && Number(seg) > 0 && Number(seg) <= tope + 0.5;
// La duración que se guarda (entera, de 1 al tope + 1)
export const duracionRespuesta = (seg, quien = 'coach') => Math.max(1, Math.min(MAX_SEG_RESPUESTA[quien === 'atleta' ? 'atleta' : 'coach'], Math.round(Number(seg) || 0)));

// ---------- La burbuja de la cámara de delante ----------
export const ESQUINAS = ['arriba-izq', 'arriba-der', 'abajo-izq', 'abajo-der'];
export const NOMBRE_ESQUINA = { 'arriba-izq': 'arriba a la izquierda', 'arriba-der': 'arriba a la derecha', 'abajo-izq': 'abajo a la izquierda', 'abajo-der': 'abajo a la derecha' };
// Su diámetro (un 28 % del lado corto) y dónde va su centro en un lienzo de W × H
export function burbuja(esquina, W, H) {
  const d = Math.round(Math.min(W, H) * 0.28), m = Math.round(Math.min(W, H) * 0.04);
  const izq = String(esquina).endsWith('izq'), arriba = String(esquina).startsWith('arriba');
  return { d, cx: izq ? m + d / 2 : W - m - d / 2, cy: arriba ? m + d / 2 : H - m - d / 2 };
}
// Al soltarla tras arrastrarla: la esquina más cercana a ese punto (de 0 a 1 en cada eje)
export const esquinaMasCercana = (x, y) => `${y < 0.5 ? 'arriba' : 'abajo'}-${x < 0.5 ? 'izq' : 'der'}`;
export const esquinaValida = (e) => ESQUINAS.includes(e);

// ---------- Exportar con correcciones: qué se ve encima en cada momento ----------
export const SEG_DIBUJO = 2.5;   // un dibujo de un solo fotograma se ve 2,5 s desde su momento
export const SEG_TEXTO = 3;      // un comentario con su momento, o un punto clave, 3 s
const recortar = (s, n) => { const x = String(s || '').replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1)}…` : x; };
// La línea de tiempo: [{ tipo: 'dibujo' | 'comentario' | 'punto', desde, hasta, … }], ordenada. Del hilo, lo del coach
// (no lo eliminado); de la corrección, los puntos clave con su momento. dur: la del vídeo (lo de después no entra).
export function lineaDeCapas({ comentarios = [], revision = null, duracion = null } = {}) {
  const dur = Number.isFinite(Number(duracion)) && Number(duracion) > 0 ? Number(duracion) : MAX_SEG_REVISION;
  const out = [];
  for (const c of comentarios || []) {
    if (!c || c.eliminado_en || c.autor !== 'coach') continue;
    if (dibujoValido(c.dibujo)) {
      const desde = c.dibujo.t, hasta = c.dibujo.hasta != null ? c.dibujo.hasta : desde + SEG_DIBUJO;
      out.push({ tipo: 'dibujo', desde, hasta, formas: c.dibujo.formas, id: c.id });
    }
    const partes = partirMomentos(String(c.texto || ''));
    const texto = recortar(partes.filter((p) => !p.momento).map((p) => p.texto).join(' '), 70);
    const m = partes.find((p) => p.momento);
    if (m && texto) out.push({ tipo: 'comentario', desde: m.t, hasta: m.t + SEG_TEXTO, texto, id: c.id });
  }
  for (const [i, p] of (revision?.checklist?.puntos || []).entries()) {
    if (!Number.isFinite(p?.s) || !p.t) continue;
    out.push({ tipo: 'punto', desde: p.s, hasta: p.s + SEG_TEXTO, texto: `${p.e === 'bien' ? '✓' : p.e === 'mal' ? '✗' : '–'} ${recortar(p.t, 60)}`, estado: p.e, id: `punto-${i}` });
  }
  return out.filter((x) => x.desde >= 0 && x.desde <= dur + 0.05).map((x) => ({ ...x, hasta: Math.min(x.hasta, dur + 0.05) }))
    .sort((a, b) => a.desde - b.desde || a.tipo.localeCompare(b.tipo));
}
// Lo que se ve en t: los dibujos de su tramo y, de los textos, como mucho los 3 más recientes (no tapan la imagen)
export function capasEn(linea, t) {
  const ahora = (linea || []).filter((x) => t >= x.desde - 0.02 && t <= x.hasta);
  const textos = ahora.filter((x) => x.tipo !== 'dibujo').sort((a, b) => b.desde - a.desde).slice(0, 3).reverse();
  return { dibujos: ahora.filter((x) => x.tipo === 'dibujo'), textos };
}
// La nota de la esquina («Técnica 4/5 · Buena») y la marca de agua
export const textoNota = (p) => (Number.isInteger(p) && p >= 1 && p <= 5 ? `Técnica ${p}/5 · ${NOMBRE_PUNTUACION[p]}` : null);
export const MARCA_AGUA = 'FBE';
// El nombre del archivo exportado (sin nada del atleta: el ejercicio y el día)
export function nombreExportado({ ejercicio = '', fecha = '', ext = 'mp4' } = {}) {
  const base = String(ejercicio || 'video').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'video';
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(fecha || '') ? `-${fecha}` : '';
  return `${base}${dia}-corregido.${ext === 'webm' ? 'webm' : 'mp4'}`;
}
// El progreso de algo que dura lo que el vídeo (0…1)
export const progresoDe = (t, desde, hasta) => (hasta > desde ? Math.min(1, Math.max(0, (t - desde) / (hasta - desde))) : 0);
