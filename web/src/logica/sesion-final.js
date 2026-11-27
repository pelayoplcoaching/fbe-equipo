// Belleza 151-200 (primera vuelta, v0.267): lo puro del final de la sesión. Va aparte (solo lo usa la sesión) para que no
// pese en el arranque.
import { pesoTxt } from './unidades.js';
import { hoyISO } from './fechas.js';
import { queToca, diaPrevistoValido } from './plan.js';

// (belleza 162) Hoy, menos tonelaje que la última vez: lo que has hecho (lo de la última vez va al lado, entre paréntesis),
// no lo que falta. c: la de compararConAnterior (con hoy y antes)
export function textoComparacionHecho(c) { return c && Number.isFinite(c.hoy) ? `${pesoTxt(c.hoy, 0)} de tonelaje hoy` : null; }

// (belleza 164) El final de la sesión, su «después»: todo recogido y una luz cálida. Dos por familia de fuerza (una de las
// dos, siempre la misma para cada sesión, como la portada) y una por modalidad de cardio. existe(id): si la imagen está
// (si aún no, el resumen sigue con la portada). Los nombres van escritos enteros: armados a trozos («fin-» y la familia),
// el reparto de estilos tomaría «fin-» por el principio de una clase y dejaría en el arranque las reglas de .fin-comparar
const CIERRE = { empuje: ['fin-empuje', 'fin-empuje-2'], tiron: ['fin-tiron', 'fin-tiron-2'], pierna: ['fin-pierna', 'fin-pierna-2'], core: ['fin-core', 'fin-core-2'],
  fullbody: ['fin-fullbody', 'fin-fullbody-2'], cardio: ['fin-cardio'], movilidad: ['fin-movilidad'] };
const CIERRE_CARDIO = { carrera: 'fin-carrera', andar: 'fin-andar', bici: 'fin-bici', eliptica: 'fin-eliptica', remo: 'fin-remo', nadar: 'fin-nadar', cuerda: 'fin-comba' };
export function imagenCierre(familia, modalidad = null, semilla = null, existe = () => false) {
  if (familia === 'cardio' && CIERRE_CARDIO[modalidad]) return CIERRE_CARDIO[modalidad];
  const ids = CIERRE[familia];
  if (!ids) return null;
  if (ids.length < 2 || semilla == null || semilla === '') return ids[0];
  let h = 0;
  for (const c of String(semilla)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 2 && existe(ids[1]) ? ids[1] : ids[0];
}

// (belleza 166) Lo que viene tras la sesión que se acaba de cerrar: la siguiente de la semana y su día (sin contar esa, que
// en la copia del programa aún puede salir sin hacer). { nombre, dia } · { ultima: true } si ya no queda ninguna · null si
// no hay semana. excluir(s): las que no cuentan (las carreras por calendario, como en Hoy)
export function siguienteTras(programa, sesionId, { hoy = hoyISO(), excluir = null } = {}) {
  const semana = programa?.actual;
  if (!semana) return null;
  const sesiones = (programa.sesiones?.[semana.id] || []).filter((s) => s.id !== sesionId && !(excluir && excluir(s)));
  if (!sesiones.length) return null;
  const s = queToca(sesiones, semana, hoy).siguiente;
  if (!s) return { ultima: true };
  return { nombre: s.nombre, dia: diaPrevistoValido(s, semana) };
}
