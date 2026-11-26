// Tu medicación y el ejercicio (v0.254, migración 107): lo que habla con la base. Perezoso: lo cargan solo la hoja «Mi
// medicación y el ejercicio» y su línea en el cuestionario del coach. Sin la 107, la lista no se guarda (la hoja sigue
// reconociendo y abriendo Pauta Activa) y lo de aquí devuelve null, [] o { falta107: true }.
import { limpiarLista } from '../logica/medicacion.js';

const falta107 = (e) => /medicacion_atleta|guardar_medicacion|PGRST202|PGRST205|42883|42P01/.test(`${e?.message || ''} ${e?.code || ''}`);

// ¿Está la 107? (se mira una vez por sesión, para cada base)
const hay = new WeakMap();
export async function hay107(b) {
  if (hay.has(b)) return hay.get(b);
  let si;
  try { await b.select('medicacion_atleta', { cols: 'atleta_id', limit: 1 }); si = true; } catch (e) { si = !falta107(e); }
  hay.set(b, si);
  return si;
}
// Su lista guardada ({ atleta_id, lista, version_base, confirmado_en } o null)
export async function medicacion(b, atletaId) {
  try { return (await b.select('medicacion_atleta', { eq: { atleta_id: atletaId } }))[0] || null; } catch (e) { if (falta107(e)) return null; throw e; }
}
// Las de todos (el coach)
export async function medicaciones(b) {
  try { return await b.select('medicacion_atleta', {}); } catch (e) { if (falta107(e)) return []; throw e; }
}
// Guardarla (la de logica/medicacion.js: reconocer y limpiarLista). Devuelve la fila guardada o { falta107: true }
export async function guardarMedicacion(b, lista, version = null, atletaId = null) {
  const p = { p_lista: limpiarLista(lista), p_version: version || null, ...(atletaId ? { p_atleta: atletaId } : {}) };
  try { return await b.rpc('guardar_medicacion', p); } catch (e) { if (falta107(e)) return { falta107: true }; throw e; }
}
