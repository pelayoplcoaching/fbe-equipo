// FBE Esencial (v0.260, la constancia): lo que se guarda (migración 111, en esencial_notas, nada de salud): su plan B de
// antes de empezar ('plan_b': su hora y qué hace si un día no puede) y el plan mínimo cuando lo acepta ('plan_minimo': de
// qué lunes a qué domingo). Sin la 111, la app no ofrece guardar nada de esto.
import { fechaMadrid } from '../logica/fechas.js';
import { fechasPlanMinimo, planBValido } from '../logica/constancia.js';

const hay = new Map();
export const falta111 = (e) => {
  const m = `${e?.message || ''} ${e?.details || ''} ${e?.hint || ''} ${e?.code || ''}`;
  return /constancia_111/.test(m) && /schema cache|does not exist|no existe|PGRST202|42883|function|funci\u00f3n/i.test(m);
};
export async function hay111(b) {
  if (hay.has(b)) return hay.get(b);
  try {
    const si = (await b.rpc('constancia_111', {})) === true;
    hay.set(b, si);
    return si;
  } catch (e) {
    if (falta111(e)) hay.set(b, false);
    return false;
  }
}
const sinTabla = (e) => /esencial_notas|42P01|schema cache/i.test(`${e?.message || ''} ${e?.code || ''}`);

// Lo suyo que usa la constancia: { planB, planMinimo: [filas], viaje: [filas], comoVamos: [filas] } (sin la 100, null)
export async function notasConstancia(b, atletaId) {
  try {
    const filas = await b.select('esencial_notas', { eq: { atleta_id: atletaId }, in: { tipo: ['plan_b', 'plan_minimo', 'viaje', 'como_vamos'] }, order: [['creada_en', 'desc']] });
    const de = (t) => filas.filter((f) => f.tipo === t);
    const b0 = de('plan_b')[0] || null;
    return { planB: b0 && planBValido(b0.datos) ? { ...b0.datos, id: b0.id } : null, planMinimo: de('plan_minimo'), viaje: de('viaje'), comoVamos: de('como_vamos') };
  } catch (e) { if (sinTabla(e)) return null; throw e; }
}
// Su plan B (uno: el nuevo sustituye al anterior)
export async function guardarPlanB(b, atletaId, { hora, b: plan }) {
  if (!planBValido({ hora, b: plan })) throw new Error('Elige tu hora y qué haces si un día no puedes.');
  if (!(await hay111(b))) return { falta111: true };
  const antes = await b.select('esencial_notas', { eq: { atleta_id: atletaId, tipo: 'plan_b' }, cols: 'id' });
  const nueva = (await b.insert('esencial_notas', [{ atleta_id: atletaId, tipo: 'plan_b', datos: { hora, b: plan } }]))[0] || null;
  for (const x of antes) await b.delete('esencial_notas', { eq: { id: x.id } });
  return nueva;
}
// El plan mínimo: del lunes de esta semana al domingo de la siguiente
export async function empezarPlanMinimo(b, atletaId, { hoy = fechaMadrid() } = {}) {
  if (!(await hay111(b))) return { falta111: true };
  const { desde, hasta } = fechasPlanMinimo(hoy);
  return (await b.insert('esencial_notas', [{ atleta_id: atletaId, tipo: 'plan_minimo', datos: { semanas: 2 }, desde, hasta }]))[0] || null;
}
// Lo deja antes de tiempo: se quita y, si ya había empezado, se vuelve a apuntar hasta ayer (para que quede en su historia;
// quien va por su cuenta no puede cambiar una nota, solo quitarla y crearla)
export async function dejarPlanMinimo(b, atletaId, fila, { hoy = fechaMadrid() } = {}) {
  if (!fila?.id) return false;
  const ayer = new Date(Date.parse(`${hoy}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);
  await b.delete('esencial_notas', { eq: { id: fila.id } });
  if (String(fila.desde || '') <= ayer) await b.insert('esencial_notas', [{ atleta_id: atletaId, tipo: 'plan_minimo', datos: { ...(fila.datos || {}), dejado: hoy }, desde: fila.desde, hasta: ayer }]);
  return true;
}
