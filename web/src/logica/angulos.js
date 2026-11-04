// v0.60 (9 y 11): dos ángulos de la misma serie y la cámara lenta. Lo que no depende de la pantalla.

// ---------- 9. Dos ángulos ----------
// El desfase del segundo ángulo respecto al primero: de −2 a +2 s, en pasos de 0,05 s o de un fotograma (1/30 s). Se guarda
// en la corrección (038: video_revisiones.dos_angulos = { con: <el otro vídeo>, desfase }), con 3 decimales como mucho.
export const DESFASE_MAX = 2;
export const PASO_DESFASE = 0.05;
export const PASO_FOTOGRAMA = 1 / 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const limitarDesfase = (d) => {
  const x = Number(d);
  if (!Number.isFinite(x)) return 0;
  return Math.round(Math.min(DESFASE_MAX, Math.max(-DESFASE_MAX, x)) * 1000) / 1000;
};
// El momento del otro ángulo cuando el primero va por t (el otro va «desfase» segundos por delante); dentro de su vídeo
export function tiempoPareja(t, desfase = 0, durOtro = null) {
  const x = (Number(t) || 0) + limitarDesfase(desfase);
  const max = Number.isFinite(Number(durOtro)) && Number(durOtro) > 0 ? Number(durOtro) : Infinity;
  return Math.max(0, Math.min(max, x));
}
// Como dos_angulos_valido() de la 038: { con: uuid, desfase: número de −2 a 2 con 3 decimales como mucho }, nada más
export function dosAngulosValido(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return false;
  const k = Object.keys(j);
  if (k.length !== 2 || !k.includes('con') || !k.includes('desfase')) return false;
  if (typeof j.con !== 'string' || !UUID.test(j.con)) return false;
  if (typeof j.desfase !== 'number' || !Number.isFinite(j.desfase) || Math.abs(j.desfase) > DESFASE_MAX) return false;
  return Math.abs(Math.round(j.desfase * 1000) - j.desfase * 1000) < 1e-6;
}
// El texto del desfase («+0,25 s», «−1 fotograma»…)
export function textoDesfase(d) {
  const x = limitarDesfase(d);
  if (Math.abs(x) < 0.0005) return 'sin desfase';
  const f = Math.round(x * 30);
  const fot = Math.abs(x * 30 - f) < 0.02 && Math.abs(f) <= 9 ? ` (${f > 0 ? '+' : '−'}${Math.abs(f)} fotograma${Math.abs(f) === 1 ? '' : 's'})` : '';
  return `${x > 0 ? '+' : '−'}${Math.abs(x).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} s${fot}`;
}
// La pareja de un vídeo en una lista (el que lo enlaza o al que enlaza: como mucho uno, lo asegura la base)
export function parejaDe(video, lista = []) {
  if (!video) return null;
  if (video.angulo_de) return lista.find((x) => x.id === video.angulo_de) || null;
  return lista.find((x) => x.angulo_de === video.id) || null;
}
// ¿Se le puede añadir otro ángulo? (de técnica, sin pareja todavía)
export const admiteOtroAngulo = (video, lista = []) => !!video && video.tipo === 'video_tecnica' && !parejaDe(video, lista);
// Una al lado de la otra si caben (cada una de al menos 300 px); si no, una encima de la otra
export const disposicionAngulos = (ancho) => (Number(ancho) >= 620 ? 'lado' : 'pila');

// ---------- 11. Cámara lenta ----------
// Con lo que dice la cámara (track.getCapabilities()): 240, 120 o 60 fotogramas por segundo, lo más alto que dé, y la
// resolución más alta que se pide con ese ritmo (720p, o menos si la cámara no llega). null si no pasa de 60 (o no lo dice).
export const FPS_LENTA = [240, 120, 60];
export function elegirCamaraLenta(cap) {
  const max = Number(cap?.frameRate?.max);
  if (!Number.isFinite(max) || max < 59.5) return null;
  const fps = FPS_LENTA.find((f) => max >= f - 0.5) || 60;
  const wMax = Number(cap?.width?.max) || 1280, hMax = Number(cap?.height?.max) || 720;
  // (a más fotogramas, menos resolución: los móviles graban 240 fps a 720p o menos)
  const largo = Math.min(Math.max(wMax, hMax), fps >= 240 ? 1280 : 1920), corto = Math.min(Math.min(wMax, hMax), fps >= 240 ? 720 : 1080);
  return { fps, width: wMax >= hMax ? largo : corto, height: wMax >= hMax ? corto : largo };
}
// Lo que se guarda (038: archivos.fps_captura, de 24 a 240): el ritmo real que dio la cámara (track.getSettings())
export const fpsValido = (f) => Number.isInteger(f) && f >= 24 && f <= 240;
export const fpsGuardado = (f) => { const x = Math.round(Number(f)); return fpsValido(x) ? x : null; };
// La velocidad con que se abre un vídeo grabado en lento: a 100 fps o más, 0,25×; a 50 o más, 0,5×; si no, 1×
export const velocidadInicial = (fps) => (Number(fps) >= 100 ? 0.25 : Number(fps) >= 50 ? 0.5 : 1);
export const esLenta = (fps) => Number(fps) >= 50;
// La explicación cuando no se puede (iPhone: Safari solo da 30 o 60 fps a una web)
export function textoSinLenta({ ios = false } = {}) {
  return ios
    ? 'En el iPhone, el navegador solo deja grabar a 30 o 60 fotogramas por segundo. Para cámara lenta de verdad, grábalo con la cámara del iPhone en «Cámara lenta» y elígelo de la galería.'
    : 'La cámara de este móvil no da más de 30 fotogramas por segundo a una web. Si tu cámara tiene «Cámara lenta», grábalo con ella y elígelo de la galería.';
}
