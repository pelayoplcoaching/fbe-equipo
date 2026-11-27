// (tacto 201-203, v0.271) La regla: una tira graduada que se desliza con el dedo para poner los kilos, las repeticiones o
// tu peso. Aquí, lo que no depende de la pantalla (probado en test/tacto.test.mjs). Las marcas van de salto en salto
// desde 0 (0 · 2,5 · 5 · 7,5…): un valor que no cae en una marca (41 kg con saltos de 2,5) se enseña en la más cercana y
// no cambia hasta que se mueve la regla.
import { tieneDetalle } from './calculos.js';

const r2 = (x) => Math.round(x * 100) / 100;
const EPS = 1e-9;
// Lo ancho de cada salto en pantalla (px; el mismo número que --esp-12 en los estilos) y cuántos se pintan a cada lado
export const REGLA_ANCHO = 12;
export const REGLA_MEDIA = 120;

// Cada cuántos saltos va una marca grande con su número: la primera que cae en cifra redonda (cada 10 kg con saltos de
// 2,5; cada 5 con saltos de 1; cada 20 con saltos de 5 o de 4…)
export function reglaMayor(paso) {
  const p = Number(paso);
  if (!(p > 0)) return 5;
  for (const m of [5, 4, 10, 8, 2]) {
    const v = r2(p * m);
    const mant = r2(v / 10 ** Math.floor(Math.log10(v) + EPS));
    if (mant === 1 || mant === 2 || mant === 5) return m;
  }
  return 5;
}

// Los topes, en saltos
export function reglaTopes(paso, { min = 0, max = Infinity } = {}) {
  const p = Number(paso) > 0 ? Number(paso) : 1;
  return { lo: Math.ceil(min / p - EPS), hi: Number.isFinite(max) ? Math.floor(max / p + EPS) : Infinity };
}

// El salto (cuántos desde 0) más cercano a un valor, dentro de los topes. Sin valor, el más bajo
export function reglaIndice(valor, paso, lim = {}) {
  const p = Number(paso) > 0 ? Number(paso) : 1;
  const { lo, hi } = reglaTopes(p, lim);
  const v = valor === null || valor === '' || valor === undefined ? NaN : Number(valor);
  const i = Number.isFinite(v) ? Math.round(v / p + EPS) : lo;
  return Math.min(hi, Math.max(lo, i));
}
export const reglaValor = (i, paso) => r2(i * (Number(paso) > 0 ? Number(paso) : 1));

// Lo que se pinta: «media» saltos a cada lado de «i», sin salir de los topes. { a, b, lo, hi }
export function reglaVentana(i, paso, { min = 0, max = Infinity, media = REGLA_MEDIA } = {}) {
  const { lo, hi } = reglaTopes(paso, { min, max });
  const c = Math.min(hi, Math.max(lo, Math.round(i)));
  return { a: Math.max(lo, c - media), b: Math.min(hi, c + media), lo, hi };
}
// ¿Toca volver a centrar lo pintado? (se ha parado cerca de un borde que no es el tope, o fuera)
export function reglaAlBorde(i, v, margen = 24) {
  if (i < v.a || i > v.b) return true;
  return (i - v.a < margen && v.a > v.lo) || (v.b - i < margen && v.b < v.hi);
}

// (202) La zona de la pauta en la regla de las repeticiones: [de, a]; con la pauta serie a serie, lo de esa serie
export function zonaReps(se, propuesta = null) {
  if (tieneDetalle(se)) {
    const r = Number(propuesta?.reps);
    return Number.isFinite(r) && r > 0 ? [r, r] : null;
  }
  const a = Number(se?.reps_min ?? se?.reps_max), b = Number(se?.reps_max ?? se?.reps_min);
  return Number.isFinite(a) && Number.isFinite(b) && a > 0 && b >= a ? [a, b] : null;
}
