// «Tus pruebas» de FBE Esencial (v0.255, migración 108): lo que habla con la base. Perezoso: lo cargan solo la hoja de las
// pruebas, su tarjeta en Hoy, «Tu trimestre» y su línea en la ficha del coach. Sin la 108, nada sale (no hay dónde guardarlas)
// y lo de aquí devuelve false, [] o { falta108: true }.
const falta108 = (e) => /pruebas_fisicas|guardar_prueba|PGRST202|PGRST205|42883|42P01/.test(`${e?.message || ''} ${e?.code || ''}`);

// ¿Está la 108? (se mira una vez por sesión, para cada base)
const hay = new WeakMap();
export async function hay108(b) {
  if (hay.has(b)) return hay.get(b);
  let si;
  try { await b.select('pruebas_fisicas', { cols: 'id', limit: 1 }); si = true; } catch (e) { si = !falta108(e); }
  hay.set(b, si);
  return si;
}
// Las suyas, de la más reciente a la más antigua ([{ id, atleta_id, fecha, prueba, valor, detalle, edad, sexo, creado_en }])
export async function pruebas(b, atletaId) {
  try {
    const xs = await b.select('pruebas_fisicas', { eq: { atleta_id: atletaId } });
    return (xs || []).map((x) => ({ ...x, valor: Number(x.valor) }))
      .sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)) || String(y.creado_en || '').localeCompare(String(x.creado_en || '')));
  } catch (e) { if (falta108(e)) return []; throw e; }
}
// Guardar una (la de logica/esencial-pruebas.js: filaPrueba), con su edad y su sexo de hoy. Devuelve la fila o { falta108: true }
export async function guardarPrueba(b, fila, { edad = null, sexo = null } = {}, atletaId = null) {
  const p = { prueba: fila.prueba, valor: fila.valor, detalle: fila.detalle ?? null, edad: edad == null || edad === '' ? null : Number(edad), sexo: sexo || null };
  try { return await b.rpc('guardar_prueba', { p, ...(atletaId ? { p_atleta: atletaId } : {}) }); } catch (e) { if (falta108(e)) return { falta108: true }; throw e; }
}
// Borrar las suyas (todas, o una con su id): la RLS solo deja las propias (y al coach)
export async function borrarPruebas(b, atletaId, id = null) {
  await b.delete('pruebas_fisicas', { eq: id ? { id, atleta_id: atletaId } : { atleta_id: atletaId } });
}
