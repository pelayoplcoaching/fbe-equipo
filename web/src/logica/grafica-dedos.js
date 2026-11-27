// (tacto 233-235, v0.272) Las gráficas, con los dedos. El titular sigue al dedo (la cifra grande de arriba pasa a ser
// la del punto que se toca), dos dedos marcan un tramo y dicen cuánto ha cambiado, y pellizcar cambia el rango. Aqu\u00ed,
// las cuentas (probadas en test/tacto.test.mjs); lo que se ve, en ui/grafica-dedos.js.
import { num } from './calculos.js';
import { diasEntre } from './fechas.js';

// Cuánto tienen que separarse (o juntarse) los dos dedos para cambiar de rango, y cada cuánto como mucho (ms)
export const PELLIZCO = 1.3;
export const PELLIZCO_MS = 380;

const aNumero = (t) => { const v = Number(String(t).replace(/\./g, '').replace(',', '.').replace('\u2212', '-')); return Number.isFinite(v) ? v : null; };

// Lo que dice un punto («23 nov: 76 kg, récord» o «23 nov: 81,2 kg (tendencia 81,5)»), en partes para el titular:
// { fecha, cifra, valor, unidad, pie }. Con tendencia, la cifra es la tendencia (como el titular del peso)
export function partesPunto(texto) {
  const t = String(texto || '');
  const i = t.indexOf(': ');
  if (i < 1) return null;
  const fecha = t.slice(0, i), resto = t.slice(i + 2);
  const m = /^([+\-\u2212]?\d[\d.,]*)\s*([^\s,(]*)/.exec(resto);
  if (!m) return null;
  const tend = /\(tendencia ([+\-\u2212]?\d[\d.,]*)\)/.exec(resto);
  const extra = resto.slice(m[0].length).replace(/\(tendencia [^)]*\)/, '').replace(/^[\s,]+/, '').trim();
  if (tend) return { fecha, cifra: tend[1], valor: aNumero(tend[1]), unidad: m[2], pie: `${m[2]} de tendencia \u00b7 ${fecha}` };
  return { fecha, cifra: m[1], valor: aNumero(m[1]), unidad: m[2], pie: [m[2], fecha, extra].filter(Boolean).join(' \u00b7 ') };
}

// El punto más cercano a una x (en las unidades de xs)
export function puntoEn(xs, x) {
  let mejor = 0, d = Infinity;
  for (let i = 0; i < xs.length; i++) { const k = Math.abs(xs[i] - x); if (k < d) { d = k; mejor = i; } }
  return mejor;
}

// Cuánto ha cambiado entre dos puntos: «+7,5 kg en 5 semanas» (sin fechas, «del 19 oct al 23 nov»). a y b: partesPunto
export function cambioTramo(a, b, fechaA = null, fechaB = null) {
  if (!a || !b || a.valor == null || b.valor == null) return '';
  const d = Math.round((b.valor - a.valor) * 100) / 100;
  const dec = Math.abs(d) % 1 ? (Math.abs(d * 10) % 1 ? 2 : 1) : 0;
  const cifra = `${d > 0 ? '+' : d < 0 ? '\u2212' : '\u00b1'}${num(Math.abs(d), dec)}${b.unidad ? ` ${b.unidad}` : ''}`;
  const dias = fechaA && fechaB ? Math.abs(diasEntre(fechaA, fechaB)) : null;
  if (dias == null || Number.isNaN(dias)) return `${cifra} del ${a.fecha} al ${b.fecha}`;
  const semanas = Math.round(dias / 7);
  return `${cifra} en ${dias < 14 ? `${dias} ${dias === 1 ? 'd\u00eda' : 'd\u00edas'}` : `${semanas} semanas`}`;
}

// Al pellizcar: el rango al que se pasa. rangos: los que hay, del más corto al más largo; actual: su \u00edndice;
// razon: la separación de ahora entre la de antes. Abrir los dedos acerca (un rango más corto); juntarlos aleja
export function rangoAlPellizcar(n, actual, razon) {
  if (!(n > 1) || actual < 0) return null;
  const sig = razon >= PELLIZCO ? actual - 1 : razon <= 1 / PELLIZCO ? actual + 1 : actual;
  return sig !== actual && sig >= 0 && sig < n ? sig : null;
}
