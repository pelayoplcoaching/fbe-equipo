// Las guías y las fichas de técnica (migración 056): lo que lee y lo que guarda. Aparte de la API para no tocarla.
// Sin la 056 en la base no hay guías: todo devuelve vacío y la app sigue como antes.
const sin056 = (e) => /guias|fichas_ejercicio|ejercicios_fichas/.test(e?.message || '') && /schema cache|does not exist|no existe|could not find|PGRST205|42P01/i.test(`${e?.message || ''} ${e?.code || ''}`);
const vacioSiFalta = (porDefecto) => (e) => { if (sin056(e)) return porDefecto; throw e; };

// Las guías, sin su contenido (para la lista), con cuántas fichas tiene cada una: [{ id, clave, titulo, subtitulo, grupo, orden, publicada, fichas }]
export async function listaGuias({ backend }) {
  const guias = await backend.select('guias', { cols: 'id,clave,titulo,subtitulo,grupo,orden,publicada', order: [['orden', 'asc']] }).catch(vacioSiFalta(null));
  if (!guias) return [];
  const fichas = guias.length ? await backend.select('fichas_ejercicio', { cols: 'id,guia_id' }).catch(() => []) : [];
  return guias.map((g) => ({ ...g, fichas: fichas.filter((f) => f.guia_id === g.id).length }));
}

// ¿Hay alguna guía? (una consulta mínima, para saber si enseñar «Aprende»)
export async function hayGuias({ backend }) {
  return (await backend.select('guias', { cols: 'id', limit: 1 }).catch(vacioSiFalta([]))).length > 0;
}

// Una guía entera, con sus fichas: { guia, fichas } (o null si no está)
export async function guiaEntera({ backend }, clave) {
  const guia = (await backend.select('guias', { eq: { clave } }).catch(vacioSiFalta([])))[0];
  if (!guia) return null;
  const fichas = await backend.select('fichas_ejercicio', { eq: { guia_id: guia.id }, order: [['orden', 'asc']] }).catch(() => []);
  return { guia, fichas };
}

// La ficha de un ejercicio de la biblioteca, si la lleva: { ficha, guia: { clave, titulo } } (o null)
export async function fichaDeEjercicio({ backend }, ejercicioId) {
  if (!ejercicioId) return null;
  const enlace = (await backend.select('ejercicios_fichas', { eq: { ejercicio_id: ejercicioId }, cols: 'ejercicio_id,ficha_id' }).catch(vacioSiFalta([])))[0];
  if (!enlace) return null;
  const ficha = (await backend.select('fichas_ejercicio', { eq: { id: enlace.ficha_id } }).catch(() => []))[0];
  if (!ficha) return null;
  const guia = (await backend.select('guias', { eq: { id: ficha.guia_id }, cols: 'id,clave,titulo' }).catch(() => []))[0] || null;
  return { ficha, guia };
}

// Todas las fichas, ligeras, con el título de su guía (para buscar y para enlazar): [{ id, guia_id, guia_titulo, guia_clave, orden, nombre }]
export async function todasLasFichas({ backend }, { conFicha = false } = {}) {
  const guias = await backend.select('guias', { cols: 'id,clave,titulo,orden', order: [['orden', 'asc']] }).catch(vacioSiFalta(null));
  if (!guias?.length) return [];
  const fichas = await backend.select('fichas_ejercicio', { cols: conFicha ? 'id,guia_id,orden,nombre,ficha' : 'id,guia_id,orden,nombre', order: [['orden', 'asc']] }).catch(() => []);
  const G = Object.fromEntries(guias.map((g) => [g.id, g]));
  return fichas.filter((f) => G[f.guia_id]).map((f) => ({ ...f, guia_titulo: G[f.guia_id].titulo, guia_clave: G[f.guia_id].clave, guia_orden: G[f.guia_id].orden }))
    .sort((a, b) => a.guia_orden - b.guia_orden || a.orden - b.orden);
}

// (coach) Qué ficha lleva cada ejercicio: { [ejercicio_id]: ficha_id } (null: la base aún no tiene la 056)
export async function enlacesFichas({ backend }) {
  const xs = await backend.select('ejercicios_fichas', { cols: 'ejercicio_id,ficha_id' }).catch(vacioSiFalta(null));
  return xs ? Object.fromEntries(xs.map((x) => [x.ejercicio_id, x.ficha_id])) : null;
}

// (coach) Poner, cambiar o quitar (fichaId = null) la ficha de un ejercicio
export async function enlazarFicha({ backend }, ejercicioId, fichaId) {
  try {
    await backend.delete('ejercicios_fichas', { eq: { ejercicio_id: ejercicioId } });
    if (fichaId) await backend.insert('ejercicios_fichas', [{ ejercicio_id: ejercicioId, ficha_id: fichaId }]);
  } catch (e) {
    if (sin056(e)) throw new Error('Para las fichas de técnica falta ejecutar la migración 056 en Supabase (supabase/migraciones/056_guias.sql).');
    throw e;
  }
}

// (coach) Publicar o esconder una guía
export async function publicarGuia({ backend }, guiaId, publicada) {
  return (await backend.update('guias', { publicada: !!publicada }, { eq: { id: guiaId } }))[0];
}
