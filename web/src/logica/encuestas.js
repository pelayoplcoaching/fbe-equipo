// Las encuestas del chat (v0.56, migración 034): el coach pregunta, con de 2 a 12 opciones (una o varias respuestas), y
// el atleta de esa conversación vota (y puede cambiar el voto). Lo que no depende de la pantalla ni de la base.
import { textoVisible } from './texto.js';

export const MIN_OPCIONES = 2;
export const MAX_OPCIONES = 12;
export const MAX_PREGUNTA = 300;
export const MAX_OPCION = 100;

// Las opciones como las guarda la base: de 2 a 12 textos de 1 a 100 letras, visibles y sin repetir (sin contar
// mayúsculas ni espacios de más). Las vacías del formulario no cuentan. { ok, opciones } o { ok: false, error }
export function opcionesEncuesta(xs) {
  if (!Array.isArray(xs)) return { ok: false, error: 'Una encuesta lleva de 2 a 12 opciones' };
  const opciones = xs.map((x) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim() : '')).filter((x) => x);
  if (opciones.length !== xs.filter((x) => typeof x === 'string' && x.trim()).length || xs.some((x) => typeof x !== 'string')) return { ok: false, error: 'Una encuesta lleva de 2 a 12 opciones, de hasta 100 letras' };
  if (opciones.length < MIN_OPCIONES || opciones.length > MAX_OPCIONES) return { ok: false, error: 'Una encuesta lleva de 2 a 12 opciones' };
  if (opciones.some((o) => [...o].length > MAX_OPCION || !textoVisible(o))) return { ok: false, error: 'Una encuesta lleva de 2 a 12 opciones, de hasta 100 letras' };
  if (new Set(opciones.map((o) => o.toLowerCase())).size !== opciones.length) return { ok: false, error: 'Las opciones de una encuesta no se repiten' };
  return { ok: true, opciones };
}
// La encuesta lista para enviar (lo que escribe el coach): { ok, pregunta, opciones, multiple } o { ok: false, error }
export function limpiarEncuesta({ pregunta = '', opciones = [], multiple = false } = {}) {
  const p = String(pregunta || '').replace(/\s+/g, ' ').trim();
  if (!p || [...p].length > MAX_PREGUNTA || !textoVisible(p)) return { ok: false, error: 'Escribe la pregunta (hasta 300 letras)' };
  const o = opcionesEncuesta((opciones || []).filter((x) => String(x ?? '').trim()));
  if (!o.ok) return o;
  return { ok: true, pregunta: p, opciones: o.opciones, multiple: !!multiple };
}
// Tocar una opción: en una de una respuesta, esa (o ninguna, si ya estaba); en una de varias, la añade o la quita
export function alternarVoto(voto = [], i, multiple = false) {
  const v = Array.isArray(voto) ? voto : [];
  if (!multiple) return v.length === 1 && v[0] === i ? [] : [i];
  return (v.includes(i) ? v.filter((x) => x !== i) : [...v, i]).sort((a, b) => a - b);
}
// Lo que ve cada uno de cada opción: { texto, elegida, votos } (en una conversación vota una persona: 0 o 1) y el total
export function resultadoEncuesta(encuesta, voto = null) {
  const v = Array.isArray(voto) ? voto : [];
  const filas = (encuesta?.opciones || []).map((texto, i) => ({ i, texto, elegida: v.includes(i), votos: v.includes(i) ? 1 : 0 }));
  return { filas, votado: v.length > 0, total: v.length ? 1 : 0 };
}
export const textoTipoEncuesta = (multiple) => (multiple ? 'Puedes elegir varias' : 'Elige una');
