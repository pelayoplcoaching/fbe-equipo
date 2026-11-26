// Motor de nutrición (v0.252, migración 105): lo que habla con la base. Perezoso: lo cargan solo las pantallas del
// cuestionario de nutrición. Sin la 105, { falta105: true } o null (y la app sigue con lo de la 093).
const falta105 = (e) => /nutricion_plan_motor|nutricion_revision|nutricion_perfiles|PGRST202|42883|42P01/.test(`${e?.message || ''} ${e?.code || ''}`);
const num = (v) => (v == null || v === '' ? null : Number(String(v).replace(',', '.')));

// ¿Está la 105? (se mira una vez por sesión)
let hay = null;
export async function hay105(b) {
  if (hay !== null) return hay;
  try { await b.select('nutricion_perfiles', { cols: 'atleta_id', limit: 1 }); hay = true; } catch (e) { hay = falta105(e) ? false : true; }
  return hay;
}
// Su perfil de nutrición (o null)
export async function perfil(b, atletaId) {
  try { return (await b.select('nutricion_perfiles', { eq: { atleta_id: atletaId } }))[0] || null; } catch (e) { if (falta105(e)) return null; throw e; }
}
// d: lo del cuestionario (logica/nutricion-motor.js: datosMotorValidos y el resto). Devuelve el plan, { automatico: false,
// motivo } o { falta105: true }
export async function planMotor(b, d, atletaId = null) {
  const p = {
    sexo: d.sexo, edad: num(d.edad), altura: num(d.altura), peso: num(d.peso), cintura: num(d.cintura), cadera: num(d.cadera),
    trabajo: d.trabajo, pasos: num(d.pasos) ?? 0, dias_entreno: num(d.diasEntreno) ?? 0, objetivo: d.objetivo, ritmo_pct: num(d.ritmo),
    experiencia: d.experiencia || null, meta_peso: num(d.metaPeso), meta_cintura: num(d.metaCintura),
    composicion_metodo: d.composicionMetodo || null, composicion_grasa: num(d.composicionGrasa), masa_magra: num(d.masaMagraDexa),
    bebidas_semana: num(d.bebidasSemana) ?? 0, forma_comer: d.formaComer || 'omnivora', tomas: num(d.tomas) ?? 4, cocina: d.cocina || null,
    come_fuera: d.comeFuera || null, pocos_hidratos: !!d.pocosHidratos, alimentos_si: d.alimentosSi || [], alimentos_no: d.alimentosNo || [],
    tca: d.tca === true, salud: d.salud || null,
  };
  try { return await b.rpc('nutricion_plan_motor', { p, ...(atletaId ? { p_atleta: atletaId } : {}) }); } catch (e) { if (falta105(e)) return { falta105: true }; throw e; }
}
// El cambio de la revisión de cada 4 semanas (lo calcula el móvil con revisionNutricion; la base pone los topes): el id
// del plan nuevo, null si aún no toca o { falta105: true }
export async function revision(b, cambio, atletaId = null) {
  const p = { kcal: cambio.kcal, proteina_g: cambio.proteina_g, carbos_g: cambio.carbos_g, grasa_g: cambio.grasa_g, alcohol_kcal: cambio.alcohol_kcal ?? 0, motivo: cambio.motivo };
  try { return await b.rpc('nutricion_revision', { p, ...(atletaId ? { p_atleta: atletaId } : {}) }); } catch (e) { if (falta105(e)) return { falta105: true }; throw e; }
}
