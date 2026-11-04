// v0.59: lo que se calcula de los fotogramas de un vídeo en el propio móvil, sin la pantalla: dónde empieza y acaba el
// movimiento (para proponer el recorte antes de enviarlo) y qué momentos enseña la tira de miniaturas bajo el reproductor.
// Los fotogramas llegan ya reducidos (como mucho 160 px) y en gris: un Uint8Array (o un array) de la misma longitud cada uno.

// ---------- Recorte automático ----------
export const FPS_RECORTE = 5;          // fotogramas por segundo que se miran
export const LADO_RECORTE = 160;       // como mucho, en píxeles (el lado largo)
export const MARGEN_RECORTE = 1;       // segundos de más a cada lado del movimiento
export const MAX_MUESTRAS_RECORTE = 300;
export const MIN_SEG_RECORTE = 4;      // en un vídeo más corto no se propone nada
export const AHORRO_MIN_RECORTE = 1;   // y solo si quita al menos un segundo en total

// Los momentos que se miran: a 5 por segundo; en un vídeo largo, menos (como mucho 300), siempre del principio al final
export function tiemposMuestreo(dur, { fps = FPS_RECORTE, max = MAX_MUESTRAS_RECORTE } = {}) {
  if (!(Number.isFinite(dur) && dur > 0)) return { tiempos: [], fps: 0 };
  const f = Math.min(fps, max / dur);
  const n = Math.max(2, Math.floor(dur * f) + 1);
  const paso = dur / (n - 1);
  const tiempos = Array.from({ length: n }, (_, i) => Math.round(Math.min(dur, i * paso) * 1000) / 1000);
  return { tiempos, fps: (n - 1) / dur };
}
// El tamaño al que se reduce un fotograma (el lado largo, a 160 px como mucho)
export function tamMuestra(vw, vh, lado = LADO_RECORTE) {
  if (!(vw > 0 && vh > 0)) return { w: 0, h: 0 };
  const k = Math.min(1, lado / Math.max(vw, vh));
  return { w: Math.max(1, Math.round(vw * k)), h: Math.max(1, Math.round(vh * k)) };
}
// Cuánto cambia la imagen de cada fotograma al siguiente (la media de la diferencia, de 0 a 255)
export function diferencias(frames) {
  const out = [];
  for (let i = 0; i + 1 < (frames || []).length; i++) {
    const a = frames[i], b = frames[i + 1];
    const n = Math.min(a?.length || 0, b?.length || 0);
    if (!n) { out.push(0); continue; }
    let s = 0;
    for (let k = 0; k < n; k++) s += Math.abs(a[k] - b[k]);
    out.push(s / n);
  }
  return out;
}
const percentil = (xs, p) => {
  if (!xs.length) return 0;
  const o = [...xs].sort((a, b) => a - b);
  const i = Math.min(o.length - 1, Math.max(0, Math.round((o.length - 1) * p)));
  return o[i];
};
// Dónde empieza y acaba el movimiento: { inicio, fin, desde, hasta } (el movimiento y el recorte propuesto, con el margen)
// o null si no se ve un movimiento claro. tiempos: el momento de cada fotograma. Los ruidos sueltos (menos de 0,6 s) no
// cuentan y las pausas cortas dentro de la serie (menos de 1,5 s) no la parten.
export function detectarMovimiento(frames, { tiempos = null, fps = FPS_RECORTE, dur = null, margen = MARGEN_RECORTE, minSeg = 0.6, hueco = 1.5 } = {}) {
  const d = diferencias(frames);
  if (d.length < 3) return null;
  const T = (i) => (tiempos && Number.isFinite(tiempos[i]) ? tiempos[i] : i / fps);
  const total = Number.isFinite(dur) && dur > 0 ? dur : T(frames.length - 1);
  const ruido = percentil(d, 0.2), pico = percentil(d, 0.95);
  // Sin un cambio claro sobre el ruido (el vídeo quieto, o moviéndose todo el rato igual), no se propone nada
  if (pico - ruido < 1.5) return null;
  const umbral = ruido + Math.max(1, (pico - ruido) * 0.25);
  // Los tramos con movimiento (cada diferencia va del fotograma i al i + 1)
  let tramos = [];
  let ini = null;
  for (let i = 0; i < d.length; i++) {
    if (d[i] > umbral) { if (ini == null) ini = i; }
    else if (ini != null) { tramos.push([T(ini), T(i)]); ini = null; }
  }
  if (ini != null) tramos.push([T(ini), T(d.length)]);
  // Se unen los que están cerca y se quitan los sueltos
  const unidos = [];
  for (const t of tramos) { const u = unidos[unidos.length - 1]; if (u && t[0] - u[1] <= hueco) u[1] = t[1]; else unidos.push([...t]); }
  tramos = unidos.filter(([a, b]) => b - a >= minSeg);
  if (!tramos.length) return null;
  const inicio = tramos[0][0], fin = tramos[tramos.length - 1][1];
  const r = (x) => Math.round(x * 10) / 10;
  return { inicio: r(inicio), fin: r(fin), desde: r(Math.max(0, inicio - margen)), hasta: r(Math.min(total, fin + margen)) };
}
// ¿Vale la pena proponerlo? (un vídeo de al menos 4 s y que quite al menos 1 s)
export function recorteUtil(det, dur) {
  if (!det || !(dur >= MIN_SEG_RECORTE)) return false;
  return det.desde + (dur - det.hasta) >= AHORRO_MIN_RECORTE && det.hasta - det.desde >= 0.5;
}

// ---------- La tira de miniaturas ----------
export const MIN_SEG_TIRA = 2.5;
export const ALTO_TIRA = 80;
// Cuántas (de 12 a 20, unas dos por segundo) y en qué momentos (el centro de cada trozo)
export function momentosTira(dur, { min = 12, max = 20 } = {}) {
  if (!(Number.isFinite(dur) && dur > 0)) return [];
  const n = Math.max(min, Math.min(max, Math.round(dur * 2)));
  return Array.from({ length: n }, (_, i) => Math.round(((i + 0.5) * dur / n) * 1000) / 1000);
}
// Ni en un vídeo muy corto ni en un móvil con poca memoria (navigator.deviceMemory, en GB, si lo dice)
export const tiraDisponible = ({ dur, memoria = null } = {}) => Number.isFinite(dur) && dur >= MIN_SEG_TIRA && !(Number.isFinite(memoria) && memoria > 0 && memoria < 2);
// Tocar o arrastrar en la tira: el momento que corresponde a esa posición (de 0 a 1)
export const momentoEnTira = (x, dur) => Math.max(0, Math.min(Number(dur) || 0, (Number(x) || 0) * (Number(dur) || 0)));
// Con el teclado: la miniatura en la que está t y la anterior o la siguiente
export function indiceTira(momentos, t) {
  if (!momentos?.length) return -1;
  let mejor = 0;
  for (let i = 1; i < momentos.length; i++) if (Math.abs(momentos[i] - t) < Math.abs(momentos[mejor] - t)) mejor = i;
  return mejor;
}
