// (tacto 207-209, v0.271) El descanso, de lejos y de reojo: el modo cartel (la cuenta atrás a toda pantalla y, al acabar,
// «Te toca» con sus kilos), la luz del borde (los últimos 10 segundos) y la pastilla que cambia de forma. Aquí, lo que no
// depende de la pantalla (probado en test/tacto.test.mjs).
import { mmss } from './calculos.js';

// (208) Cuánto dura la luz del borde y a partir de qué descanso sale (en uno de 15 s no avisaría de nada)
export const LUZ_SEG = 10;
export const LUZ_MIN_TOTAL = 20;
// De 0 (empieza) a 1 (encendida del todo); null si no toca (en pausa, antes de los últimos 10 s, en descansos cortos)
export function luzBorde({ quedan, total, pausado = false } = {}) {
  if (pausado || !(quedan > 0) || quedan > LUZ_SEG || !(Number(total) >= LUZ_MIN_TOTAL)) return null;
  return Math.round(((LUZ_SEG - quedan) / LUZ_SEG) * 1000) / 1000;
}

// «Serie 2 de 4» -> «Serie 2» (en la pastilla no cabe más)
export const serieCorta = (s) => String(s || '').replace(/ de \d+$/, '');

// (209) La pastilla, en cada momento: recién marcada la serie, «Hecha»; después, lo que queda; al acabar, lo que toca
// (toca: lo de logica/ahora-toca.js) o «¡Vamos!» si ya no queda nada. desdeInicioMs: lo que lleva el descanso
export const HECHA_MS = 1400;
export function formaPastilla({ quedan, pausado = false, desdeInicioMs = Infinity, toca = null } = {}) {
  if (quedan > 0) {
    if (!pausado && desdeInicioMs >= 0 && desdeInicioMs < HECHA_MS) return { estado: 'hecha', valor: 'Hecha' };
    return { estado: 'cuenta', valor: mmss(quedan) };
  }
  if (!toca) return { estado: 'vamos', valor: '¡Vamos!' };
  if (toca.otroEjercicio) return { estado: 'otro', valor: toca.nombre || '¡Vamos!' };
  return { estado: 'toca', valor: [serieCorta(toca.serie), toca.carga].filter(Boolean).join(' · ') || '¡Vamos!' };
}

// (207) Lo que enseña el cartel. Mientras corre: la cuenta, cuánto queda del total (0..1) y lo que viene después; al
// acabar: «Te toca» (o «Siguiente ejercicio»), el ejercicio, su carga en grande y su serie con el esfuerzo
export function cartelDe({ quedan, total, pausado = false, texto = '', toca = null } = {}) {
  if (quedan > 0) {
    return {
      fase: 'cuenta', etiqueta: pausado ? 'Descanso en pausa' : 'Descanso', cifra: mmss(quedan), frac: total > 0 ? Math.min(1, Math.max(0, quedan / total)) : 0,
      despues: toca ? [toca.nombre, serieCorta(toca.serie), toca.carga].filter(Boolean).join(' · ') : texto || '',
    };
  }
  if (!toca) return { fase: 'fin', etiqueta: 'Descanso terminado', cifra: '¡Vamos!', frac: 0, despues: texto || '' };
  return {
    fase: 'toca', etiqueta: toca.otroEjercicio ? 'Siguiente ejercicio' : 'Te toca', nombre: toca.nombre || '', frac: 0,
    cifra: toca.carga || serieCorta(toca.serie), pie: [toca.carga ? toca.serie : null, toca.esfuerzo].filter(Boolean).join(' · '),
  };
}

// ¿El móvil está tumbado? Apaisado de verdad (lo dice la pantalla, no la ventana: con el teclado del móvil abierto la
// ventana también queda más ancha que alta) y bajo: un móvil, no una tableta
export function esTumbado({ tipo = '', ancho = 0, alto = 0, tactil = false } = {}) {
  return tactil && String(tipo).startsWith('landscape') && ancho > alto && alto > 0 && alto <= 520;
}
