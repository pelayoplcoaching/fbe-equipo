// Belleza 151-200 (primera vuelta, v0.267): lo puro del final de la sesión. Va aparte (solo lo usa la sesión) para que no
// pese en el arranque.
import { pesoTxt } from './unidades.js';
import { hoyISO } from './fechas.js';
import { queToca, diaPrevistoValido } from './plan.js';
import { num } from './calculos.js';
import { cardioHechoValido, NOMBRE_MODALIDAD } from './cardio.js';

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

// (belleza 161) Las cifras de la primera tarjeta de la historia del final, como las del resumen: las de fuerza (series,
// toneladas y minutos) o, si fue cardio, sus minutos y sus km. [{ k, v, t }]
export function cifrasHistoriaSesion(r = {}) {
  const c = r?.cardio && cardioHechoValido(r.cardio) ? r.cardio : null;
  if (c) return [{ k: 'minutos', v: num(c.minutos, 0), t: `min de ${String(NOMBRE_MODALIDAD[c.modalidad] || 'cardio').toLowerCase()}` }, c.km ? { k: 'km', v: num(c.km, 1), t: 'km' } : null].filter(Boolean);
  return [
    { k: 'series', v: num(r?.series || 0, 0), t: r?.series === 1 ? 'serie' : 'series' },
    r?.tonelaje > 0 ? { k: 'tonelaje', v: num(Math.round(r.tonelaje / 10) / 100, 1), t: 'toneladas' } : null,
    r?.minutos ? { k: 'minutos', v: num(r.minutos, 0), t: 'minutos' } : null,
  ].filter(Boolean);
}

// ---------- Belleza 301-350 (tanda F): la sesión, contada ----------
// (301) Tu sesión en seis segundos: cada serie de la huella (huellaDeResumen), una nota, en el orden de la sesión. La
// n-ésima serie de un ejercicio sube un escalón, como al marcarla en la sesión; un récord, una octava más arriba y más
// larga. Entre ejercicio y ejercicio, un respiro. Todo cabe en unos seis segundos (con muchas series, más deprisa: como
// un arpegio, nunca menos de 0,07 s entre notas; con pocas, como mucho 0,42 s)
// nota(i): la escala de la casa (logica/sonido.js). [{ fila, k, d (s desde el principio), f, dura, rec }]
export function melodiaSesion(filas = [], nota, { total = 5.6 } = {}) {
  const lista = (filas || []).filter((f) => f?.puntos?.length);
  const n = lista.reduce((t, f) => t + f.puntos.length, 0);
  if (!n || typeof nota !== 'function') return [];
  const paso = Math.max(0.07, Math.min(0.42, total / (n + Math.max(0, lista.length - 1) * 0.6)));
  const out = [];
  let t = 0;
  lista.forEach((f, fi) => {
    if (fi) t += paso * 0.6;
    f.puntos.forEach((p, k) => {
      out.push({ fila: fi, k, d: Math.round(t * 1000) / 1000, f: nota(Math.min(7, k) + (p.rec ? 5 : 0)), dura: p.rec ? 0.34 : 0.16, rec: !!p.rec });
      t += paso;
    });
  });
  return out;
}
// (303) Los músculos, en el orden en que los trabajaste: el de musculos (calcularResumen los suma serie a serie, en el
// orden de la sesión, así que su orden es el de la primera vez que salió cada uno), solo los que tienen series
export function ordenMusculos(musculos = {}) {
  return Object.entries(musculos || {}).filter(([, v]) => Number(v) > 0).map(([g]) => g);
}
