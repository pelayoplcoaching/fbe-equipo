// Entrenador por voz (v0.48): lo que se dice en voz alta durante la sesión. Solo el texto (cómo se dice lo decide el
// móvil con su voz en español); las frases son cortas para no tapar la música.
import { num } from './calculos.js';
import { vista, pesoNum, nombrePeso, unidadPeso } from './unidades.js';

// (v0.112: en libras, si el atleta las tiene puestas: «175 libras»)
const kilos = (kg) => {
  const n = Number(kg);
  if (!(n > 0)) return null;
  const v = vista(n);
  return `${pesoNum(n, 2)} ${nombrePeso(unidadPeso(), { singular: v === 1 })}`;
};

// «Serie 3 de press banca: 80 kilos por 6. Última serie.»
export function fraseSerie({ numero, series, nombre, kg = null, reps = null }) {
  if (!numero || !nombre) return '';
  const n = String(nombre).replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const k = kilos(kg);
  const r = Number(reps) > 0 ? Math.round(Number(reps)) : null;
  const carga = k && r ? `: ${k} por ${r}` : k ? `: ${k}` : r ? `: ${r} ${r === 1 ? 'repetición' : 'repeticiones'}` : '';
  const ultima = series && Number(numero) >= Number(series) ? ' Última serie.' : '';
  return `Serie ${numero} de ${n}${carga}.${ultima}`;
}

// Lo que se dice en los últimos segundos del descanso (a los 10 y la cuenta de 3), o null
export function fraseCuenta(segundos) {
  if (segundos === 10) return 'Diez segundos';
  return ({ 3: 'Tres', 2: 'Dos', 1: 'Uno' })[segundos] || null;
}

// La voz que mejor suena: la de España; si no, otra en español; si no, ninguna (el móvil usa la suya)
export function elegirVoz(voces = []) {
  const es = voces.filter((v) => /^es([-_]|$)/i.test(v.lang || ''));
  return es.find((v) => /^es[-_]ES$/i.test(v.lang) && v.localService) || es.find((v) => /^es[-_]ES$/i.test(v.lang)) || es[0] || null;
}
