// Dibujos sobre un fotograma del vídeo (migración 012; más herramientas en la 035): coordenadas de 0 a 1 respecto a la
// imagen del vídeo, para que el dibujo caiga en el mismo sitio en cualquier pantalla.
// v0.57 (035): flecha, círculo (centro y borde), lápiz (de 2 a 80 puntos) y texto (hasta 40 letras), cinco colores y,
// si se quiere, visible durante un tramo (de «t» a «hasta») en vez de en un solo fotograma. Como mucho 24 formas. Los
// dibujos de antes (líneas y ángulos, sin color ni tramo) siguen valiendo tal cual.
import { textoVisible } from './texto.js';

export const MAX_FORMAS = 24;
export const MAX_PUNTOS_LAPIZ = 80;
export const MAX_TEXTO_DIBUJO = 40;
export const TIPOS_FORMA = ['linea', 'angulo', 'flecha', 'circulo', 'lapiz', 'texto'];
// Los colores (por nombre: el tono lo pone la app, con contraste sobre cualquier vídeo gracias a su borde oscuro)
// (el amarillo es el de siempre: un dibujo sin color, como los de antes, es amarillo)
export const COLORES_DIBUJO = [['amarillo', 'Amarillo', '#F2C230'], ['blanco', 'Blanco', '#FFFFFF'], ['cian', 'Cian', '#5CE1E6'], ['rojo', 'Rojo', '#FF6B6B'], ['morado', 'Morado', '#C4AEFF']];
export const COLOR_DIBUJO = 'amarillo';
export const HEX_COLOR = Object.fromEntries(COLORES_DIBUJO.map(([k, , h]) => [k, h]));
const NOMBRES = { linea: 'línea', angulo: 'ángulo', flecha: 'flecha', circulo: 'círculo', lapiz: 'trazo', texto: 'texto' };
const PUNTOS = { linea: [2, 2], flecha: [2, 2], circulo: [2, 2], angulo: [3, 3], texto: [1, 1], lapiz: [2, MAX_PUNTOS_LAPIZ] };

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

// Como dibujo_valido() en la base (035)
const numero = (x) => typeof x === 'number' && Number.isFinite(x);
const punto = (p) => Array.isArray(p) && p.length === 2 && p.every((c) => numero(c) && c >= 0 && c <= 1);
const objeto = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
export function formaValida(f) {
  if (!objeto(f) || !Object.keys(f).every((k) => ['tipo', 'p', 'c', 'x'].includes(k))) return false;
  if (!TIPOS_FORMA.includes(f.tipo)) return false;
  if ('c' in f && !(typeof f.c === 'string' && HEX_COLOR[f.c])) return false;
  if ((f.tipo === 'texto') !== ('x' in f)) return false;
  if ('x' in f && !(typeof f.x === 'string' && [...f.x].length >= 1 && [...f.x].length <= MAX_TEXTO_DIBUJO && textoVisible(f.x))) return false;
  const [min, max] = PUNTOS[f.tipo];
  return Array.isArray(f.p) && f.p.length >= min && f.p.length <= max && f.p.every(punto);
}
export function dibujoValido(d) {
  if (!objeto(d)) return false;
  if (!Object.keys(d).every((k) => k === 't' || k === 'formas' || k === 'hasta')) return false;
  if (!numero(d.t) || !(d.t >= 0 && d.t < 3600)) return false;
  if ('hasta' in d && !(numero(d.hasta) && d.hasta > d.t && d.hasta <= 3600)) return false;
  if (!Array.isArray(d.formas) || d.formas.length < 1 || d.formas.length > MAX_FORMAS) return false;
  return d.formas.every(formaValida);
}

// Lo que se guarda: el momento en décimas y las coordenadas con 3 decimales (de 0 a 1); el lápiz, como mucho 80 puntos
// (se aligera quitando los intermedios); el tramo, si acaba después de empezar
const r3 = (x) => Math.min(1, Math.max(0, Math.round(x * 1000) / 1000));
export function aligerarTrazo(puntos, max = MAX_PUNTOS_LAPIZ) {
  const ps = (puntos || []).filter(punto);
  if (ps.length <= max) return ps;
  const out = [];
  for (let i = 0; i < max; i++) out.push(ps[Math.round((i * (ps.length - 1)) / (max - 1))]);
  return out;
}
export function limpiarDibujo(t, formas, { hasta = null } = {}) {
  const out = { t: Math.round(Math.max(0, t) * 10) / 10, formas: (formas || []).slice(0, MAX_FORMAS).map((f) => {
    const g = { tipo: f.tipo, p: (f.tipo === 'lapiz' ? aligerarTrazo(f.p) : f.p).map(([x, y]) => [r3(x), r3(y)]) };
    if (f.c && f.c !== COLOR_DIBUJO && HEX_COLOR[f.c]) g.c = f.c;
    if (f.tipo === 'texto') g.x = String(f.x || '').trim().slice(0, MAX_TEXTO_DIBUJO);
    return g;
  }) };
  if (hasta != null && Number.isFinite(hasta)) { const h = Math.round(Math.min(3600, hasta) * 10) / 10; if (h > out.t) out.hasta = h; }
  return dibujoValido(out) ? out : null;
}

// ¿Se ve en el momento t? Uno de un solo fotograma, cerca de su momento; uno con tramo, mientras dura
export function dibujoVisible(d, t, margen = 0.35) {
  if (!d || !Number.isFinite(t)) return false;
  if (d.hasta != null) return t >= d.t - 0.05 && t <= d.hasta + 0.05;
  return Math.abs(t - d.t) <= margen;
}

// El rectángulo que ocupa la imagen dentro del elemento <video> (object-fit: contain): deja bandas si no
// coinciden las proporciones
export function rectImagen(anchoCaja, altoCaja, anchoVideo, altoVideo) {
  if (!anchoCaja || !altoCaja || !anchoVideo || !altoVideo) return { x: 0, y: 0, w: anchoCaja || 0, h: altoCaja || 0 };
  const escala = Math.min(anchoCaja / anchoVideo, altoCaja / altoVideo);
  const w = anchoVideo * escala, h = altoVideo * escala;
  return { x: (anchoCaja - w) / 2, y: (altoCaja - h) / 2, w, h };
}

// Texto para quien no ve el dibujo: «2 líneas y un ángulo de 95°» (y lo nuevo: «una flecha, un texto: Rodillas»)
export function describirDibujo(d, proporcion = 1) {
  if (!d?.formas?.length) return '';
  const lineas = d.formas.filter((f) => f.tipo === 'linea').length;
  const angulos = d.formas.filter((f) => f.tipo === 'angulo').map((f) => grados(f.p, proporcion)).filter((g) => g != null);
  const partes = [];
  if (lineas) partes.push(lineas === 1 ? 'una línea' : `${lineas} líneas`);
  if (angulos.length) partes.push(angulos.length === 1 ? `un ángulo de ${angulos[0]}°` : `${angulos.length} ángulos (${angulos.map((g) => `${g}°`).join(', ')})`);
  for (const tipo of ['flecha', 'circulo', 'lapiz']) {
    const n = d.formas.filter((f) => f.tipo === tipo).length;
    if (n) partes.push(n === 1 ? `un${tipo === 'flecha' ? 'a' : ''} ${NOMBRES[tipo]}` : `${n} ${tipo === 'flecha' ? 'flechas' : tipo === 'circulo' ? 'círculos' : 'trazos'}`);
  }
  const textos = d.formas.filter((f) => f.tipo === 'texto').map((f) => `«${f.x}»`);
  if (textos.length) partes.push(textos.length === 1 ? `el texto ${textos[0]}` : `los textos ${textos.join(', ')}`);
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}
