// Líneas y ángulos sobre un fotograma del vídeo (migración 012): coordenadas de 0 a 1 respecto a la imagen
// del vídeo, para que el dibujo caiga en el mismo sitio en cualquier pantalla.

export const MAX_FORMAS = 12;

// Grados del ángulo en el vértice v entre los extremos a y b (0–180), con las proporciones reales de la imagen
export function grados([v, a, b], proporcion = 1) {
  if (!v || !a || !b) return null;
  const ux = (a[0] - v[0]) * proporcion, uy = a[1] - v[1];
  const wx = (b[0] - v[0]) * proporcion, wy = b[1] - v[1];
  const nu = Math.hypot(ux, uy), nw = Math.hypot(wx, wy);
  if (!nu || !nw) return null;
  const cos = Math.min(1, Math.max(-1, (ux * wx + uy * wy) / (nu * nw)));
  return Math.round((Math.acos(cos) * 180) / Math.PI);
}

// Como dibujo_valido() en la base
const punto = (p) => Array.isArray(p) && p.length === 2 && p.every((c) => typeof c === 'number' && Number.isFinite(c) && c >= 0 && c <= 1);
export function dibujoValido(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
  if (!Object.keys(d).every((k) => k === 't' || k === 'formas')) return false;
  if (typeof d.t !== 'number' || !(d.t >= 0 && d.t < 3600)) return false;
  if (!Array.isArray(d.formas) || d.formas.length < 1 || d.formas.length > MAX_FORMAS) return false;
  return d.formas.every((f) => f && typeof f === 'object' && Object.keys(f).every((k) => k === 'tipo' || k === 'p')
    && ['linea', 'angulo'].includes(f.tipo) && Array.isArray(f.p) && f.p.length === (f.tipo === 'linea' ? 2 : 3) && f.p.every(punto));
}

// Lo que se guarda: el momento en décimas y las coordenadas con 3 decimales (de 0 a 1)
export function limpiarDibujo(t, formas) {
  const r = (x) => Math.min(1, Math.max(0, Math.round(x * 1000) / 1000));
  const out = { t: Math.round(Math.max(0, t) * 10) / 10, formas: (formas || []).slice(0, MAX_FORMAS).map((f) => ({ tipo: f.tipo, p: f.p.map(([x, y]) => [r(x), r(y)]) })) };
  return dibujoValido(out) ? out : null;
}

// El rectángulo que ocupa la imagen dentro del elemento <video> (object-fit: contain): deja bandas si no
// coinciden las proporciones
export function rectImagen(anchoCaja, altoCaja, anchoVideo, altoVideo) {
  if (!anchoCaja || !altoCaja || !anchoVideo || !altoVideo) return { x: 0, y: 0, w: anchoCaja || 0, h: altoCaja || 0 };
  const escala = Math.min(anchoCaja / anchoVideo, altoCaja / altoVideo);
  const w = anchoVideo * escala, h = altoVideo * escala;
  return { x: (anchoCaja - w) / 2, y: (altoCaja - h) / 2, w, h };
}

// Texto para quien no ve el dibujo: «2 líneas y un ángulo de 95°»
export function describirDibujo(d, proporcion = 1) {
  if (!d?.formas?.length) return '';
  const lineas = d.formas.filter((f) => f.tipo === 'linea').length;
  const angulos = d.formas.filter((f) => f.tipo === 'angulo').map((f) => grados(f.p, proporcion)).filter((g) => g != null);
  const partes = [];
  if (lineas) partes.push(lineas === 1 ? 'una línea' : `${lineas} líneas`);
  if (angulos.length) partes.push(angulos.length === 1 ? `un ángulo de ${angulos[0]}°` : `${angulos.length} ángulos (${angulos.map((g) => `${g}°`).join(', ')})`);
  return partes.join(' y ');
}
