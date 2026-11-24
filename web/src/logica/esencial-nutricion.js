// FBE Esencial, tanda 4 (nivel con nutrición): el plan de comida de partida y su ajuste de cada semana, solos, con los
// límites de la app. Lógica pura sobre lo que ya usa el coach (logica/nutricion.js: planInicial, ajusteNutricion).
// Decisiones de Pelayo (24/11): perder, −0,5 % del peso por semana; mantener; ganar, +0,25 %; en kcal y macros. Con
// antecedente de trastorno de la conducta alimentaria (TCA): mantener, sin bajadas solas (y que lo hable con su médico).
// La base hace lo mismo (migración 093: esencial_plan_comida calcula el plan de partida como planInicial, y
// esencial_ajuste_comida solo guarda el ajuste si cabe en los topes).
import { planInicial, ajusteNutricion, NIVELES_ACTIVIDAD, fmtKcal, textoRitmo } from './nutricion.js';

// % del peso por semana: bajar medio punto, mantener o subir un cuarto
export const RITMO_ESENCIAL = { perder: -0.5, mantener: 0, ganar: 0.25 };
export const OBJETIVOS_COMIDA = [['perder', 'Perder grasa'], ['mantener', 'Mantener mi peso'], ['ganar', 'Ganar músculo']];
export { NIVELES_ACTIVIDAD };
// Los textos del motivo, iguales que los de la base (093)
export const MOTIVO_PARTIDA = 'Plan de partida, con tus datos.';
export const MOTIVO_PARTIDA_TCA = 'Plan de partida para mantener tu peso (con tu antecedente, sin déficit).';

const r = (v) => (v == null || v === '' ? null : Number(String(v).replace(',', '.')));

// ¿Los datos dan para un plan? (las mismas comprobaciones que la base: edad 18-90, altura 130-220 cm, peso 35-250 kg).
// Devuelve el texto de lo que falta, o null.
export function datosComidaValidos({ sexo, edad, altura, peso, actividad, objetivo, tca } = {}) {
  if (!['hombre', 'mujer'].includes(sexo)) return 'Elige tu sexo (lo usa la fórmula del gasto).';
  if (!(r(edad) >= 18 && r(edad) <= 90)) return 'Escribe tu edad (de 18 a 90 años).';
  if (!(r(altura) >= 130 && r(altura) <= 220)) return 'Escribe tu altura en centímetros (de 130 a 220).';
  if (!(r(peso) >= 35 && r(peso) <= 250)) return 'Escribe tu peso en kilos (de 35 a 250).';
  if (!NIVELES_ACTIVIDAD.some(([f]) => f === Number(actividad))) return 'Elige cuánto te mueves.';
  if (!Object.prototype.hasOwnProperty.call(RITMO_ESENCIAL, objetivo)) return 'Elige tu objetivo.';
  if (typeof tca !== 'boolean') return 'Contesta la pregunta de salud.';
  return null;
}

// El plan de partida: Mifflin × actividad, con el ritmo de su objetivo (con TCA, mantener), en kcal y macros
export function planComidaEsencial({ sexo, edad, altura, peso, actividad, objetivo, tca = false }) {
  if (datosComidaValidos({ sexo, edad, altura, peso, actividad, objetivo, tca: !!tca })) return null;
  const fase = tca ? 'mantener' : objetivo;
  const p = planInicial({ sexo, edad: r(edad), altura: r(altura), peso: r(peso), actividad: Number(actividad), fase, ritmo: RITMO_ESENCIAL[fase], modo: 'macros' });
  if (!p) return null;
  return {
    modo: 'macros', fase, ritmo_pct: RITMO_ESENCIAL[fase], kcal: p.kcal, proteina_g: p.proteina_g, carbos_g: p.carbos_g, grasa_g: p.grasa_g,
    motivo: tca ? MOTIVO_PARTIDA_TCA : MOTIVO_PARTIDA, mantenimiento: p.mantenimiento, basal: p.basal,
  };
}

// El ajuste de la semana (lo mismo que propone la app al coach, ±300 kcal y nunca por debajo de 1.200), con su motivo
// para el atleta: null si no toca (su último plan es de hace menos de 7 días, el gasto aún no es fiable o va bien).
// Con TCA no baja nunca solo. plan: su plan vigente; gasto: gastoAdaptativo; hoy: 'AAAA-MM-DD'.
export function ajusteComidaEsencial({ plan, gasto, pesoKg, diasEntreno = 2, tca = false, hoy }) {
  if (!plan || plan.modo !== 'macros' || plan.kcal_descanso != null) return null;
  if (hoy && plan.desde && Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${plan.desde}T12:00:00Z`) < 7 * 864e5) return null;
  const a = ajusteNutricion({ plan, gasto, pesoKg, diasEntreno });
  if (!a?.nuevo || !['bajar', 'subir'].includes(a.tipo)) return null;
  if (tca && a.delta < 0) return null;
  const limite = a.limite === 'cambio' ? ' (como mucho 300 de una vez)' : a.limite === 'minimo' ? ' (hasta el mínimo de 1200)' : '';
  const motivo = `Ajuste de la semana: gastas unas ${fmtKcal(gasto.kcal)} kcal al día y, para ${textoRitmo(plan.ritmo_pct)}, te tocan unas ${fmtKcal(a.objetivo)}: ${a.delta > 0 ? 'subes' : 'bajas'} ${fmtKcal(Math.abs(a.delta))} kcal${limite}.`;
  const { kcal, proteina_g, carbos_g, grasa_g } = a.nuevo;
  return { kcal, proteina_g, carbos_g, grasa_g, motivo, delta: a.delta };
}
