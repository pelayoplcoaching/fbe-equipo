// v0.52: las gráficas de Progreso, como las de Revolut o Robinhood: un selector de rango (1M · 3M · 6M · Todo) y, al
// cambiarlo, la línea se transforma en la nueva (los dos trazos, remuestreados al mismo número de puntos, se mezclan)
// y la cifra de arriba rueda como un cuentakilómetros. Lo puro, aquí.
import { lunesDe, sumarDias } from './fechas.js';

export const RANGOS_GRAFICA = [['1m', '1M', 31, '1 mes'], ['3m', '3M', 92, '3 meses'], ['6m', '6M', 183, '6 meses'], ['todo', 'Todo', null, 'todo']];

// Los puntos del rango (hoy incluido). semanal: los puntos van por lunes (una semana empezada cuenta entera)
export function filtrarRango(puntos = [], rango, hoy, { clave = 'x', semanal = false } = {}) {
  const dias = RANGOS_GRAFICA.find(([k]) => k === rango)?.[2];
  if (!dias) return [...(puntos || [])];
  let desde = sumarDias(hoy, -dias);
  if (semanal) desde = lunesDe(desde);
  return (puntos || []).filter((p) => p[clave] >= desde && p[clave] <= (semanal ? lunesDe(hoy) : hoy));
}

// El primer rango con al menos 2 puntos, empezando por el preferido (para no abrir una gráfica vacía)
export function rangoConDatos(puntos, preferido, hoy, opciones) {
  const orden = RANGOS_GRAFICA.map(([k]) => k);
  for (const k of orden.slice(Math.max(0, orden.indexOf(preferido)))) if (filtrarRango(puntos, k, hoy, opciones).length >= 2) return k;
  return 'todo';
}

// Una polilínea [[x, y]] (x creciente) a n puntos repartidos por igual en x (interpolando)
export function remuestrear(pts = [], n = 48) {
  if (!pts.length) return [];
  if (pts.length === 1) return Array.from({ length: n }, () => [pts[0][0], pts[0][1]]);
  const x0 = pts[0][0], x1 = pts[pts.length - 1][0];
  const out = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / (n - 1);
    while (j < pts.length - 2 && pts[j + 1][0] < x) j++;
    const [ax, ay] = pts[j], [bx, by] = pts[j + 1];
    const t = bx === ax ? 0 : Math.max(0, Math.min(1, (x - ax) / (bx - ax)));
    out.push([x, ay + (by - ay) * t]);
  }
  return out;
}

// La mezcla de dos polilíneas del mismo número de puntos (t de 0 a 1)
export function mezclarPuntos(a, b, t) {
  const n = Math.min(a.length, b.length);
  const k = Math.max(0, Math.min(1, t));
  return Array.from({ length: n }, (_, i) => [a[i][0] + (b[i][0] - a[i][0]) * k, a[i][1] + (b[i][1] - a[i][1]) * k]);
}

export const trazo = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
// El área bajo la línea, hasta la base
export const area = (pts, base) => (pts.length ? `${trazo(pts)} L${pts[pts.length - 1][0].toFixed(1)} ${base} L${pts[0][0].toFixed(1)} ${base}Z` : '');

// Sale rápido y frena al final (como un muelle sin rebote)
export const salidaSuave = (t) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;

// El cuentakilómetros: cada carácter de la cifra, alineados por la derecha (las unidades con las unidades), para que
// al cambiar de cifra solo rueden las columnas que cambian. Las que no son dígito («,», «+», «−», « ») no ruedan.
export function columnasCifra(texto) {
  const s = String(texto ?? '');
  return [...s].map((c, i) => ({ clave: s.length - i, digito: /\d/.test(c) ? Number(c) : null, c }));
}

// El punto elegido de una gráfica (al arrastrar o con el teclado) solo vale si existe en los datos de ahora: al pasar
// a un rango con menos puntos, uno elegido al final ya no está
export const seleccionValida = (sel, n) => (Number.isInteger(sel) && sel >= 0 && sel < n ? sel : null);
