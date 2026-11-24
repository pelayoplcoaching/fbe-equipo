// FBE Esencial, tanda 4 (nivel con nutrición): el plan de comida de partida y su ajuste de cada semana, solos, con los
// límites de la app. Lógica pura sobre lo que ya usa el coach (logica/nutricion.js: planInicial, ajusteNutricion).
// Con antecedente de trastorno de la conducta alimentaria: mantener, sin ritmo y sin bajadas automáticas (y que lo hable
// con su médico). Las cifras de partida (ritmos y modo) son la propuesta del 24/11, pendientes de Pelayo.
import { planInicial, ajusteNutricion, NIVELES_ACTIVIDAD } from './nutricion.js';

// % del peso por semana: bajar medio punto, mantener o subir un cuarto
export const RITMO_ESENCIAL = { perder: -0.5, mantener: 0, ganar: 0.25 };
export const OBJETIVOS_COMIDA = [['perder', 'Perder grasa'], ['mantener', 'Mantener mi peso'], ['ganar', 'Ganar músculo']];
export { NIVELES_ACTIVIDAD };

const r = (v) => (v == null || v === '' ? null : Number(v));

// ¿Los datos dan para un plan? (las mismas comprobaciones que la base: edad 18-90, altura 130-220 cm, peso 35-250 kg)
export function datosComidaValidos({ sexo, edad, altura, peso, actividad, objetivo } = {}) {
  if (!['hombre', 'mujer'].includes(sexo)) return 'Elige tu sexo (lo usa la fórmula del gasto).';
  if (!(r(edad) >= 18 && r(edad) <= 90)) return 'Escribe tu edad (de 18 a 90 años).';
  if (!(r(altura) >= 130 && r(altura) <= 220)) return 'Escribe tu altura en centímetros (de 130 a 220).';
  if (!(r(peso) >= 35 && r(peso) <= 250)) return 'Escribe tu peso en kilos (de 35 a 250).';
  if (!NIVELES_ACTIVIDAD.some(([f]) => f === Number(actividad))) return 'Elige cuánto te mueves.';
  if (!RITMO_ESENCIAL.hasOwnProperty(objetivo)) return 'Elige tu objetivo.';
  return null;
}

// El plan de partida: Mifflin × actividad, con el ritmo de su objetivo (con TCA, mantener), en kcal y macros
export function planComidaEsencial({ sexo, edad, altura, peso, actividad, objetivo, tca = false }) {
  if (datosComidaValidos({ sexo, edad, altura, peso, actividad, objetivo })) return null;
  const fase = tca ? 'mantener' : objetivo;
  const p = planInicial({ sexo, edad: r(edad), altura: r(altura), peso: r(peso), actividad: Number(actividad), fase, ritmo: RITMO_ESENCIAL[fase], modo: 'macros' });
  if (!p) return null;
  return {
    modo: 'macros', fase, ritmo_pct: RITMO_ESENCIAL[fase], kcal: p.kcal, proteina_g: p.proteina_g, carbos_g: p.carbos_g, grasa_g: p.grasa_g,
    motivo: tca ? 'Plan de partida para mantener tu peso (con tu antecedente, sin déficit).' : 'Plan de partida, con tus datos.',
    mantenimiento: p.mantenimiento,
  };
}

// El ajuste de la semana (lo mismo que propone la app al coach, ±300 kcal y nunca por debajo de 1.200): null si no toca.
// Con TCA no baja nunca sola.
export function ajusteComidaEsencial({ plan, gasto, pesoKg, diasEntreno = 2, tca = false }) {
  const a = ajusteNutricion({ plan, gasto, pesoKg, diasEntreno });
  if (!a?.nuevo || !['bajar', 'subir'].includes(a.tipo)) return null;
  if (tca && a.delta < 0) return null;
  return { ...a.nuevo, motivo: `Ajuste de la semana: ${a.texto}` };
}
