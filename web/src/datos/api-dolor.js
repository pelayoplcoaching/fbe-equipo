// El motor de molestias de FBE Esencial (v0.256, migración 109): lo que habla con la base. Perezoso: lo cargan «Me duele
// algo», el check-in de quien va por su cuenta y lo que pregunta por una molestia abierta. Sin la 109, nada se guarda (la
// hoja dice qué hacer igual) y lo de aquí devuelve false, [] o { falta109: true }.
const falta109 = (e) => /dolor_registros|apuntar_dolor|molestias_valor|column .*valor|PGRST202|PGRST204|PGRST205|42883|42P01|42703/.test(`${e?.message || ''} ${e?.code || ''}`);

// ¿Está la 109? (se mira una vez por sesión, para cada base)
const hay = new WeakMap();
export async function hay109(b) {
  if (hay.has(b)) return hay.get(b);
  let si;
  try { await b.select('dolor_registros', { cols: 'id', limit: 1 }); si = true; } catch (e) { si = !falta109(e); }
  hay.set(b, si);
  return si;
}
// Lo que ha apuntado fuera del check-in (desde una fecha, si se pide), de lo más antiguo a lo más reciente
export async function registros(b, atletaId, desde = null) {
  try {
    const xs = await b.select('dolor_registros', { eq: { atleta_id: atletaId }, ...(desde ? { gte: { fecha: desde } } : {}) });
    return (xs || []).map((x) => ({ ...x, valor: Number(x.valor) }))
      .sort((x, y) => String(x.fecha).localeCompare(String(y.fecha)) || String(x.creado_en || '').localeCompare(String(y.creado_en || '')));
  } catch (e) { if (falta109(e)) return []; throw e; }
}
// Las molestias de sus check-ins (desde un lunes, si se pide): las de 0 a 10 llevan valor
export async function molestiasCheckin(b, atletaId, desde = null) {
  try { return await b.select('molestias', { eq: { atleta_id: atletaId }, ...(desde ? { gte: { semana_inicio: desde } } : {}) }); } catch (e) { if (falta109(e)) return []; throw e; }
}
// Apuntar una: { zona, valor, momento, sesion_id? } → la fila o { falta109: true }
export async function apuntarDolor(b, { zona, valor, momento = 'ahora', sesion_id = null }, atletaId = null) {
  const p = { zona, valor: Number(valor), momento, ...(sesion_id ? { sesion_id } : {}) };
  try { return await b.rpc('apuntar_dolor', { p, ...(atletaId ? { p_atleta: atletaId } : {}) }); } catch (e) { if (falta109(e)) return { falta109: true }; throw e; }
}
// Borrar lo que ha apuntado fuera del check-in (todo, o una con su id)
export async function borrarDolor(b, atletaId, id = null) {
  await b.delete('dolor_registros', { eq: id ? { id, atleta_id: atletaId } : { atleta_id: atletaId } });
}
