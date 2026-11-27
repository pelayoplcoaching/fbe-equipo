// (tacto 221-223, v0.272) Asomarse: mantener pulsada una sesión, un ejercicio, una receta o una medalla enseña, en una
// tarjeta flotante, lo que hay dentro sin entrar; soltar la cierra y subir el dedo la abre. Aquí, lo que dice la tarjeta
// (probado en test/tacto.test.mjs): { titulo, sub, lineas: [[izquierda, derecha]…], mas, pie }.
import { fmtConDia } from './fechas.js';
import { textoSerie, resumenEjercicio, e1rm, num } from './calculos.js';
import { resumenPautas } from './diseno.js';
import { pesoTxt } from './unidades.js';

// Cuánto hay que mantener el dedo (ms), cuánto se puede mover mientras (px) y cuánto hay que subirlo para abrir al soltar
export const ASOMA_MS = 420;
export const ASOMA_QUIETO = 10;
export const ASOMA_ABRE = 56;
// Cuántas líneas caben en la tarjeta
const TOPE = 6;

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const pautaDe = (e) => {
  const a = Number(e.reps_min) || 0, b = Number(e.reps_max) || 0;
  const reps = a && b && a !== b ? `${a}–${b}` : String(a || b || '');
  return Number(e.series) > 0 ? `${e.series} × ${reps || '—'}` : '';
};
const mejorSerie = (series) => series.reduce((m, s) => { const v = e1rm(s) ?? (Number(s.kg) || 0) * (Number(s.reps) || 0); return !m || v > m.v ? { v, s } : m; }, null)?.s || null;

// Una sesión (det: lo que da api.sesion). Pendiente: sus ejercicios con su pauta y lo que dura; hecha: lo que se hizo
// en cada uno (las series y la mejor), el día, el tiempo y el esfuerzo
export function asomaSesion(det) {
  const s = det?.sesion;
  if (!s) return null;
  const ejs = det.ejercicios || [];
  const hecha = !!s.completada;
  const lineas = ejs.slice(0, TOPE).map((e) => {
    const nombre = e.ejercicio?.nombre || 'Ejercicio';
    if (!hecha) return [nombre, pautaDe(e)];
    const h = (e.hechas || []).filter((x) => Number(x.reps) > 0);
    const top = mejorSerie(h);
    return [nombre, h.length ? `${h.length} × ${top ? textoSerie(top) : ''}`.trim() : 'Sin apuntar'];
  });
  const r = resumenPautas(ejs);
  const sub = hecha
    ? [s.fecha_realizada ? `Hecha el ${fmtConDia(s.fecha_realizada)}` : 'Hecha', s.duracion_min ? `${s.duracion_min} min` : null, s.rpe_sesion ? `esfuerzo ${num(s.rpe_sesion)}/10` : null].filter(Boolean).join(' · ')
    : [ejs.length ? plural(ejs.length, 'ejercicio', 'ejercicios') : null, r.minutos ? `unos ${r.minutos} min` : null].filter(Boolean).join(' · ');
  return { titulo: s.nombre || 'Sesión', sub, lineas, mas: Math.max(0, ejs.length - lineas.length), pie: hecha && s.nota_atleta ? `«${String(s.nota_atleta).slice(0, 120)}»` : '' };
}

// Un ejercicio (series: todas las suyas, de api.historialEjercicio): la última vez y su mejor marca
export function asomaEjercicio(nombre, series = []) {
  const h = resumenEjercicio((series || []).filter((x) => Number(x.reps) > 0));
  const ultima = h.sesiones?.[0] || null;
  if (!ultima) return { titulo: nombre, sub: 'Aún no lo has hecho', lineas: [], mas: 0, pie: '' };
  const lineas = [[`Última vez, ${fmtConDia(ultima.fecha)}`, ultima.series.slice(0, 5).map(textoSerie).join(' · ') + (ultima.series.length > 5 ? ' …' : '')]];
  const m = h.mejor;
  if (m?.serie) lineas.push([`Mejor marca, ${fmtConDia(m.fecha)}`, `${textoSerie(m.serie)}${m.valor ? ` (1RM estimado ${pesoTxt(m.valor, 1)})` : ''}`]);
  return { titulo: nombre, sub: plural(h.sesiones.length, 'vez', 'veces'), lineas, mas: 0, pie: '' };
}

// Lo que ya dice su rótulo para el lector de pantalla (una medalla): «Constancia: medalla de plata, 10 sesiones hechas.
// Siguiente: 50 sesiones hechas.» → el título, y cada frase en su línea
export function asomaRotulo(rotulo) {
  const t = String(rotulo || '').trim();
  if (!t) return null;
  const i = t.indexOf(': ');
  const titulo = i > 0 && i < 40 ? t.slice(0, i) : t;
  const frases = (i > 0 && i < 40 ? t.slice(i + 2) : '').split(/\.\s+/).map((x) => x.replace(/\.$/, '').trim()).filter(Boolean);
  const may = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  return { titulo, sub: frases[0] ? may(frases[0]) : '', lineas: [], mas: 0, pie: frases.slice(1).map(may).join('. ') };
}

// Dónde se pone la tarjeta: centrada, encima de lo que se toca si cabe y, si no, debajo. { x, y, arriba }
export function sitioAsoma(caja, alto, { ancho = 320, vw = 390, vh = 844, margen = 12 } = {}) {
  const w = Math.min(ancho, vw - margen * 2);
  const x = Math.round(Math.max(margen, Math.min(vw - w - margen, caja.left + caja.width / 2 - w / 2)));
  const cabeArriba = caja.top - alto - margen >= margen;
  const y = cabeArriba ? caja.top - alto - margen : Math.min(vh - alto - margen, caja.bottom + margen);
  return { x, y: Math.round(Math.max(margen, y)), w, arriba: cabeArriba };
}
