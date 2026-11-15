// Pausar la asesoría (migración 078): vacaciones, una temporada de mucho trabajo, un parón… El coach pone la pausa (desde, hasta o sin
// fecha de vuelta, su motivo y una nota para el atleta); mientras dura no hay recordatorios ni alertas y la racha no se rompe.
// Lógica pura (la app, la demo y las pruebas).
import { sumarDias, lunesDe, diasEntre, fechaMadrid, fmtCorta } from './fechas.js';

// (sin motivos de salud: eso no se apunta aquí)
export const MOTIVOS_PAUSA = [['vacaciones', 'Vacaciones'], ['trabajo', 'Trabajo o estudios'], ['personal', 'Motivos personales'], ['otro', 'Otro']];
export const NOMBRE_MOTIVO = Object.fromEntries(MOTIVOS_PAUSA);
export const MAX_NOTA_PAUSA = 200;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

export const cubre = (p, dia) => !!p && p.desde <= dia && (p.hasta == null || p.hasta >= dia);
// La pausa de hoy (si hay varias, la que acaba más tarde; sin fecha de vuelta gana) y la próxima que aún no ha empezado
export function pausaVigente(pausas = [], hoy = fechaMadrid()) {
  return (pausas || []).filter((p) => cubre(p, hoy)).sort((a, b) => ((a.hasta || '9999') < (b.hasta || '9999') ? 1 : -1))[0] || null;
}
export function pausaProxima(pausas = [], hoy = fechaMadrid()) {
  return (pausas || []).filter((p) => p.desde > hoy).sort((a, b) => (a.desde < b.desde ? -1 : 1))[0] || null;
}

// Lo que se guarda: { datos } o { error } (el mismo criterio que la 078)
export function limpiarPausa(x = {}) {
  const desde = x.desde || '', hasta = x.hasta || null;
  if (!DIA.test(desde)) return { error: 'Pon desde qué día.' };
  if (hasta && (!DIA.test(hasta) || hasta < desde)) return { error: 'La vuelta no puede ser antes del primer día de pausa.' };
  if (!MOTIVOS_PAUSA.some(([k]) => k === x.motivo)) return { error: 'Elige el motivo.' };
  const nota = String(x.nota ?? '').replace(/\s+/g, ' ').trim() || null;
  if (nota && nota.length > MAX_NOTA_PAUSA) return { error: `La nota, como mucho ${MAX_NOTA_PAUSA} caracteres.` };
  return { datos: { desde, hasta, motivo: x.motivo, nota } };
}

// «hasta el 30 nov» (vuelve el día siguiente) o «sin fecha de vuelta»
export const textoHasta = (p) => (p?.hasta ? `hasta el ${fmtCorta(p.hasta)}` : 'sin fecha de vuelta');
export const diaDeVuelta = (p) => (p?.hasta ? sumarDias(p.hasta, 1) : null);
// Para el atleta, en Hoy
export function textoPausaAtleta(p) {
  if (!p) return null;
  return { titulo: 'Tu asesoría está en pausa', detalle: p.hasta ? `Vuelves el ${fmtCorta(diaDeVuelta(p))}. Mientras tanto no te mandamos recordatorios y tu racha te espera donde la dejaste.` : 'Sin fecha de vuelta por ahora. No te mandamos recordatorios y tu racha te espera donde la dejaste.' };
}
// Para el coach: «En pausa hasta el 30 nov (vacaciones)»
export const textoPausaCoach = (p) => (p ? `En pausa ${textoHasta(p)} (${NOMBRE_MOTIVO[p.motivo].toLowerCase()})` : '');
export const diasDePausa = (p, hoy = fechaMadrid()) => (p ? diasEntre(p.desde, p.hasta && p.hasta < hoy ? p.hasta : hoy) + 1 : 0);

// ¿Esa semana (por su lunes) fue de pausa? Si la pausa cubre cuatro días o más de los siete: esa semana no rompe la racha
export function semanaEnPausa(pausas = [], lunes) {
  const l = lunesDe(lunes);
  let dias = 0;
  for (let i = 0; i < 7; i++) { const d = sumarDias(l, i); if ((pausas || []).some((p) => cubre(p, d))) dias++; }
  return dias >= 4;
}
