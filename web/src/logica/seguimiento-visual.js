// (v0.203) Lo de la ficha del coach (Seguimiento) que se pinta en color: el nivel de cada casilla del check-in (bien,
// regular o mal, según su escala), la tendencia de cada respuesta en las últimas semanas y la zona de la carga.
// Lógica pura (sin pantalla), para poder probarla.
import { HORAS_SUENO } from './calculos.js';

// Las horas de sueño del check-in vienen por tramos: el centro de cada uno, para poder dibujarlas
const HORAS_CENTRO = { '<5': 4.5, '5-6': 5.5, '6-7': 6.5, '7-8': 7.5, '>8': 8.5 };
export const horasSueno = (t) => (t != null && HORAS_CENTRO[String(t)] != null ? HORAS_CENTRO[String(t)] : null);

const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const adherenciaMedia = (c) => media([c?.adherencia_desayuno, c?.adherencia_comida, c?.adherencia_merienda, c?.adherencia_cena].filter((v) => Number(v) > 0).map(Number));

// El nivel de una casilla: 'bien', 'regular', 'mal' o '' (sin dato). Escalas de 1 (peor) a 5 (mejor); el sueño, por
// tramos (7 horas o más, bien; 6-7, regular; menos de 6, mal); los pasos (8000 o más, bien; 5000 a 8000, regular);
// las molestias, de 0 a 3 (ninguna no se colorea; leve, regular; moderada o más, mal)
export function nivelCheckin(campo, v) {
  if (v == null || v === '') return '';
  if (campo === 'sueno') {
    const i = HORAS_SUENO.indexOf(String(v));
    return i < 0 ? '' : i >= 3 ? 'bien' : i === 2 ? 'regular' : 'mal';
  }
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  if (campo === 'pasos') return n >= 8000 ? 'bien' : n >= 5000 ? 'regular' : 'mal';
  if (campo === 'molestias') return n >= 2 ? 'mal' : n >= 1 ? 'regular' : '';
  // energía, recuperación, motivación y adherencia (media de 1 a 5)
  return n >= 3.75 ? 'bien' : n >= 2.75 ? 'regular' : 'mal';
}
export const NOMBRE_NIVEL_CHECKIN = { bien: 'bien', regular: 'regular', mal: 'mal' };

// Las tendencias de las respuestas: de las últimas n semanas (lista de check-ins de la más reciente a la más antigua, o
// en cualquier orden), cada dato en orden de semanas, con el último, el de antes y si sube o baja.
// → [{ clave, nombre, valores, ultimo, antes, cambio: 'sube' | 'baja' | 'igual' | null }]
export const DATOS_TENDENCIA = [
  ['sueno', 'Sueño', (c) => horasSueno(c.horas_sueno)],
  ['energia', 'Energía', (c) => (c.energia != null ? Number(c.energia) : null)],
  ['recuperacion', 'Recuperación', (c) => (c.recuperacion != null ? Number(c.recuperacion) : null)],
  ['motivacion', 'Motivación', (c) => (c.motivacion != null ? Number(c.motivacion) : null)],
  ['pasos', 'Pasos', (c) => (c.pasos_media != null ? Number(c.pasos_media) : null)],
];
export function tendenciasCheckin(checkins = [], n = 8) {
  const orden = [...(checkins || [])].filter((c) => c?.semana_inicio).sort((a, b) => (a.semana_inicio < b.semana_inicio ? -1 : 1)).slice(-n);
  return DATOS_TENDENCIA.map(([clave, nombre, f]) => {
    const puntos = orden.map((c) => ({ semana: c.semana_inicio, v: f(c) })).filter((p) => Number.isFinite(p.v));
    if (puntos.length < 2) return null;
    const ultimo = puntos[puntos.length - 1].v, antes = puntos[puntos.length - 2].v;
    return { clave, nombre, valores: puntos.map((p) => p.v), semanas: puntos.map((p) => p.semana), ultimo, antes, cambio: ultimo > antes ? 'sube' : ultimo < antes ? 'baja' : 'igual' };
  }).filter(Boolean);
}

// La zona normal de la carga: de la mitad a vez y media de su media (los mismos umbrales del aviso de «salto brusco»)
export const ZONA_CARGA = [0.5, 1.5];
export function zonaCarga(media) {
  if (!(media > 0)) return null;
  return { desde: media * ZONA_CARGA[0], hasta: media * ZONA_CARGA[1] };
}
export const fueraDeZona = (carga, zona) => !!zona && carga > 0 && (carga < zona.desde || carga > zona.hasta);
