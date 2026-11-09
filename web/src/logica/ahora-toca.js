// v0.63: «Ahora toca», la tarjeta del descanso con lo que viene: el ejercicio y la serie, los kilos × repeticiones que te
// propone la app, el esfuerzo objetivo, lo que hiciste la última vez en esa serie, el recordatorio o la nota de tu coach
// y, con barra, los discos por lado. La serie que toca es la misma que resalta la sesión y dice la píldora «Sesión en
// curso» (serieQueToca, antes dentro de Sesion.jsx); los kilos, los mismos que la pantalla de bloqueo (la propuesta de
// la serie). Funciones puras, probadas en test/logica.test.mjs.
import { esTopBackoff, num, textoSerie } from './calculos.js';
import { pesoTxt, vista, barraVista } from './unidades.js';

// La serie que toca: la que dijo la última serie marcada (si sigue sin hacer y es de las pautadas) o la primera sin hacer
// de la sesión, en orden. hechas: { sesion_ejercicio_id: { numero: serie } }. null si no queda ninguna (o está terminada).
export function serieQueToca(ejercicios, hechas, proxima = null, { completada = false } = {}) {
  if (completada) return null;
  const h = hechas || {};
  const pendienteDe = (x) => Array.from({ length: x.series }, (_, i) => i + 1).find((k) => !h[x.id]?.[k]);
  if (proxima && (ejercicios || []).some((x) => x.id === proxima.id && proxima.numero <= x.series) && !h[proxima.id]?.[proxima.numero]) return { id: proxima.id, numero: proxima.numero };
  const x = (ejercicios || []).find((y) => pendienteDe(y));
  return x ? { id: x.id, numero: pendienteDe(x) } : null;
}

// El esfuerzo objetivo de esa serie: el RPE de la serie (pautada serie a serie), el RIR o el RPE de la pauta
export function objetivoEsfuerzo(se, propuesta = null) {
  if (propuesta?.rpe != null) return `RPE ${num(propuesta.rpe)}`;
  if (se?.rir_objetivo != null) return `RIR ${num(se.rir_objetivo)}`;
  if (se?.rpe_objetivo != null) return `RPE ${num(se.rpe_objetivo)}`;
  return null;
}

// Cómo se llama la serie: «Serie 3 de 4», «Serie top», «Back-off 2», «Serie 5 (de más)»
// (series añadidas: con `pautadas`, las de la pauta; `series` puede llevar sumadas las añadidas, logica/series-extra.js)
export function nombreSerie(se, numero) {
  const pautadas = se.pautadas ?? se.series;
  if (numero > pautadas) return `Serie ${numero} (de más)`;
  if (esTopBackoff(se)) return numero === 1 ? 'Serie top' : `Back-off ${numero - 1} de ${pautadas - 1}`;
  return `Serie ${numero} de ${pautadas}`;
}

// Lo que enseña la tarjeta (null si ya no queda nada). ejercicios y hechas, como en la sesión; proxima, la que dijo la
// última serie marcada; tras: el ejercicio tras el que se descansa (para saber si lo siguiente es otro ejercicio).
// propuestaDe(se, numero): { kg, reps, rpe? } (la de la sesión); nombreDe(se): el ejercicio que se está haciendo (con la
// alternativa, si se cambió); ultimasDe(se): su última vez ({ fecha, series }); recordatoriosDe(se): los «Recuerda» de tu
// coach para ese ejercicio; barraDe(se): si se carga con barra (para los discos por lado).
export function ahoraToca({ ejercicios = [], hechas = {}, proxima = null, completada = false, tras = null, etiquetas = {},
  propuestaDe = () => null, nombreDe = (se) => se?.ejercicio?.nombre || '', ultimasDe = () => null, recordatoriosDe = () => [], barraDe = () => false } = {}) {
  const sig = serieQueToca(ejercicios, hechas, proxima, { completada });
  if (!sig) return null;
  const se = ejercicios.find((x) => x.id === sig.id);
  if (!se) return null;
  let prop = null;
  try { prop = propuestaDe(se, sig.numero) || null; } catch { prop = null; }
  const kg = prop?.kg != null && Number(prop.kg) > 0 ? Number(prop.kg) : null;
  const reps = prop?.reps != null ? Number(prop.reps) : null;
  const ult = ultimasDe(se);
  const previa = (ult?.series || []).find((s) => Number(s.numero) === sig.numero);
  const recs = recordatoriosDe(se) || [];
  const nota = (recs[0]?.texto || se.notas_coach || '').trim() || null;
  const nombre = nombreDe(se);
  const etiqueta = etiquetas[se.id] || null;
  const otro = !!tras && tras !== se.id;
  const esfuerzo = objetivoEsfuerzo(se, prop);
  const serie = nombreSerie(se, sig.numero);
  const anterior = previa ? textoSerie(previa) : null;
  const carga = kg != null ? `${pesoTxt(kg, 2)}${reps != null ? ` × ${reps}` : ''}` : reps != null ? `${reps} repeticiones` : null;
  // Lo que lee el lector de pantalla (la tarjeta es un botón: «Ahora toca: …. Toca para ir a esa serie»)
  const texto = [`${otro ? 'Siguiente ejercicio, ' : ''}${etiqueta ? `${etiqueta} ` : ''}${nombre}, ${serie.charAt(0).toLowerCase()}${serie.slice(1)}`,
    carga, esfuerzo, anterior ? `La última vez, ${anterior}` : null, nota ? `${recs.length ? 'Recuerda' : 'Nota de tu coach'}: ${nota}` : null].filter(Boolean).join('. ');
  return {
    id: se.id, numero: sig.numero, nombre, etiqueta, serie, otroEjercicio: otro, kg, reps, carga, esfuerzo, anterior,
    nota, notaRecuerda: recs.length > 0 && !!recs[0]?.texto, discos: !!barraDe(se) && kg != null && vista(kg) > barraVista(), texto,
  };
}
