// Ajuste en vivo, serie a serie (como Juggernaut AI, Alpha Progression o la app de RP): si el RPE de una serie se va
// de lo pautado, la carga que se propone para la siguiente se corrige. Hoy la app solo ajusta de una sesión a otra (y
// las back-off desde la top); esto lo hace dentro del ejercicio, con reglas a la vista. Funciones puras, probadas en
// test/ajuste-vivo.test.mjs.
//
// La regla: con lo que hizo en la serie anterior (kilos, repeticiones y RPE) se estima su 1RM de hoy con la misma
// fórmula de la app (Epley sumando las repeticiones en reserva, e1rm de calculos.js), y se busca la carga que, con esas
// repeticiones, le deja en el RPE pautado (kgPara). Es lo que hace la tabla de RPE de RTS (Tuchscherer) y lo que
// recomiendan Helms y cols. (Strength Cond J 2016;38:42-49) para autorregular con el RPE basado en repeticiones en
// reserva: cada punto de RPE es una repetición, del orden de un 2–4 % de la carga.
//
// Cuándo NO se toca nada (se repite la serie anterior, como hasta ahora):
//   · la pauta no tiene esfuerzo objetivo (RPE o RIR) o la serie anterior no tiene RPE apuntado;
//   · el coach fijó los kilos de esa serie (carga pautada o kilos serie a serie): se respeta lo suyo;
//   · la diferencia es de menos de 1 punto (el RPE apuntado tiene medio punto de ruido, y subir medio por serie es normal);
//   · el cambio no llega a un salto del ejercicio (2,5 kg en barra, 2 en mancuernas, 2,5 o 5 en máquinas);
//   · fuera de 1–12 repeticiones (la estimación deja de valer) o sin carga (peso corporal).
// Como mucho un 10 % por serie, para que un RPE mal puesto no descoloque la serie siguiente. Subir solo si la
// progresión automática está activada para el atleta y no ha dicho que hoy llega flojo; bajar, siempre.
import { e1rm, incrementoCarga } from './calculos.js';

const coma = (x) => String(Math.round(Number(x) * 100) / 100).replace('.', ',');

export const MARGEN_RPE = 1;      // diferencia mínima (puntos de RPE) para ajustar
export const TOPE_CAMBIO = 0.10;  // como mucho un 10 % por serie

const numero = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// El RPE objetivo de una pauta: el RPE, o 10 − RIR
export function rpeObjetivo({ rpe = null, rir = null } = {}) {
  const r = numero(rpe);
  if (r != null) return r;
  const i = numero(rir);
  return i != null ? Math.max(0, Math.min(10, 10 - i)) : null;
}

// previa: la serie anterior hecha ({ kg, reps, rpe }); objetivo: { rpe, rir } de la serie que toca; reps: las
// repeticiones que se proponen para ella (las de la anterior, en su rango); nombre: el del ejercicio (para el salto);
// kgFijado: si el coach puso kilos a esa serie; subir: si se puede proponer más carga.
// Devuelve null (se repite la anterior) o { kg, reps, de, rpeHecho, rpeObjetivo, sentido: 'subir' | 'bajar' }.
export function ajusteEnVivo({ previa, objetivo = {}, reps = null, nombre = '', kgFijado = false, subir = true } = {}) {
  if (kgFijado || !previa) return null;
  const kg = numero(previa.kg), hechas = numero(previa.reps), rpeHecho = numero(previa.rpe);
  const obj = rpeObjetivo(objetivo);
  if (!(kg > 0) || !(hechas >= 1 && hechas <= 12) || rpeHecho == null || rpeHecho < 5 || obj == null) return null;
  const dif = rpeHecho - obj;
  if (Math.abs(dif) < MARGEN_RPE - 1e-9) return null;
  if (dif < 0 && !subir) return null;
  const r = Math.round(numero(reps) ?? hechas);
  if (!(r >= 1 && r <= 12)) return null;
  const uno = e1rm({ kg, reps: hechas, rpe: rpeHecho });
  if (!uno) return null;
  // la carga que le deja en el RPE objetivo con esas repeticiones (sin redondear) y su tope
  const total = r + (10 - obj);
  let bruto = total <= 1 ? uno : uno / (1 + total / 30);
  bruto = Math.min(kg * (1 + TOPE_CAMBIO), Math.max(kg * (1 - TOPE_CAMBIO), bruto));
  const paso = incrementoCarga(nombre, kg);
  let nuevo = Math.round(bruto / paso) * paso;
  // el tope manda también tras redondear
  if (nuevo > kg * (1 + TOPE_CAMBIO) + 1e-9) nuevo -= paso;
  if (nuevo < kg * (1 - TOPE_CAMBIO) - 1e-9) nuevo += paso;
  nuevo = Math.round(nuevo * 100) / 100;
  if (!(nuevo > 0) || Math.abs(nuevo - kg) < 1e-9) return null;
  // nunca al revés de lo que pide el RPE
  if ((dif > 0 && nuevo > kg) || (dif < 0 && nuevo < kg)) return null;
  // (cómo lo pautó el coach, para decirlo igual: «RPE 8» o «RIR 2»)
  const pauta = numero(objetivo.rpe) != null ? `RPE ${coma(obj)}` : `RIR ${coma(numero(objetivo.rir))}`;
  return { kg: nuevo, reps: r, de: kg, rpeHecho, rpeObjetivo: obj, pauta, sentido: nuevo < kg ? 'bajar' : 'subir' };
}

// Las repeticiones que se proponen para la serie siguiente: las de la anterior, dentro del rango pautado
export function repsSiguiente(previaReps, { reps_min = null, reps_max = null } = {}) {
  const r = numero(previaReps);
  if (r == null) return numero(reps_max) ?? numero(reps_min);
  const lo = numero(reps_min), hi = numero(reps_max);
  if (hi != null && r > hi) return hi;
  if (lo != null && r < lo) return lo;
  return r;
}

// «Tu serie anterior fue RPE 9,5 (pautado RPE 8): baja a 77,5 kg» (kg con su unidad, ya formateados por quien llama si van en libras)
export function textoAjuste(a, carga = null) {
  if (!a) return '';
  const destino = carga ?? `${coma(a.kg)} kg`;
  return `Tu serie anterior fue RPE ${coma(a.rpeHecho)} (pautado ${a.pauta || `RPE ${coma(a.rpeObjetivo)}`}): ${a.sentido === 'bajar' ? 'baja' : 'sube'} a ${destino}`;
}
