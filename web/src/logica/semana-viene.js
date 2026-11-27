// (belleza 185) La semana que viene, ya publicada, de un vistazo: lo que cambia frente a la de ahora (el foco, cuántas
// sesiones y las que son nuevas). Lo usa Semana (en su trozo). Función pura, probada en test/belleza-ambas.test.mjs.
import { NOMBRE_FOCO } from './calculos.js';

const cuantas = (d) => (d === 1 ? 'una' : d === 2 ? 'dos' : String(d));
const nombres = (xs) => (xs.length <= 2 ? xs.join(' y ') : `${xs.slice(0, 2).join(', ')} y ${cuantas(xs.length - 2)} más`);

// actual y siguiente: las semanas ({ foco }); sesActual y sesSiguiente: sus sesiones ({ nombre }). Devuelve frases cortas.
export function cambiosQueViene({ actual = null, sesActual = [], siguiente = null, sesSiguiente = [] } = {}) {
  if (!siguiente) return [];
  const out = [];
  if (siguiente.foco && siguiente.foco !== actual?.foco && NOMBRE_FOCO[siguiente.foco]) out.push(`Foco: ${NOMBRE_FOCO[siguiente.foco].toLowerCase()}`);
  const n = sesSiguiente.length;
  if (!n) return [...out, 'Aún sin sesiones'];
  const d = n - sesActual.length;
  const clave = (s) => String(s?.nombre || '').trim().toLowerCase();
  const ya = new Set(sesActual.map(clave));
  const nuevas = [...new Set(sesSiguiente.filter((s) => clave(s) && !ya.has(clave(s))).map((s) => String(s.nombre).trim()))];
  if (!d && !nuevas.length) return [...out, n === 1 ? 'La misma sesión' : `Las mismas ${n} sesiones`];
  out.push(`${n} ${n === 1 ? 'sesión' : 'sesiones'}${d ? ` (${cuantas(Math.abs(d))} ${d > 0 ? 'más' : 'menos'})` : ''}`);
  if (nuevas.length) out.push(`${nuevas.length === 1 ? 'Nueva' : 'Nuevas'}: ${nombres(nuevas)}`);
  return out;
}
