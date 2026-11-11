// El recetario del equipo (migración 055): lo que lee y lo que guarda. Aparte de la API para no tocarla.
// Sin la 055 en la base no hay recetario: todo devuelve vacío y la app sigue como antes.

// Lo que hace falta para la lista y para la ficha (sin las fotos: las miniaturas se piden aparte, al abrir el recetario)
const COLS = 'id,nombre,tomas,raciones,kcal,proteina_g,carbos_g,grasa_g,ingredientes,preparacion,minutos,etiquetas,libro,para_todos,actualizada_en';
const sin055 = (e) => /para_todos|libro|recetas_favoritas/.test(e?.message || '') && /schema cache|does not exist|no existe|column|columna|could not find/i.test(e?.message || '');
const sinTabla = (e) => /recetas/.test(e?.message || '') && /schema cache|does not exist|no existe|could not find/i.test(e?.message || '');

// ¿Hay recetas para todo el equipo? (una consulta mínima, para saber si enseñar el recetario)
export async function hayRecetarioEquipo({ backend }) {
  try { return (await backend.select('recetas', { eq: { para_todos: true }, cols: 'id', limit: 1 })).length > 0; } catch (e) {
    if (sin055(e) || sinTabla(e)) return false;
    throw e;
  }
}

// Las recetas del equipo y, si es un atleta, las que se ha guardado. { recetas, favoritas: [ids] }
export async function recetarioEquipo({ backend }, atletaId = null) {
  let recetas;
  try { recetas = await backend.select('recetas', { eq: { para_todos: true }, cols: COLS }); } catch (e) {
    if (sin055(e) || sinTabla(e)) return { recetas: [], favoritas: [] };
    throw e;
  }
  const favs = atletaId ? await backend.select('recetas_favoritas', { eq: { atleta_id: atletaId }, cols: 'receta_id' }).catch(() => []) : [];
  const ids = new Set(recetas.map((r) => r.id));
  return { recetas, favoritas: favs.map((f) => f.receta_id).filter((id) => ids.has(id)) };
}

// Las miniaturas de las recetas del equipo: { id: foto_mini }. Aparte, porque pesan (unos 14 kB cada una) y solo hacen
// falta al abrir el recetario (Comidas ya pide las de su recetario una vez). Si falla, las recetas salen sin foto.
export async function fotosRecetarioEquipo({ backend }) {
  try {
    const fotos = await backend.select('recetas', { eq: { para_todos: true }, cols: 'id,foto_mini' });
    return Object.fromEntries(fotos.filter((x) => x.foto_mini).map((x) => [x.id, x.foto_mini]));
  } catch { return {}; }
}

// El atleta se guarda (o deja de guardar) una receta del equipo
export async function guardarFavoritaEquipo({ backend }, atletaId, recetaId, favorita) {
  if (!favorita) return backend.delete('recetas_favoritas', { eq: { atleta_id: atletaId, receta_id: recetaId } });
  try { return await backend.insert('recetas_favoritas', [{ atleta_id: atletaId, receta_id: recetaId }]); } catch (e) {
    if (/duplicate|23505|ya existe/i.test(`${e?.message} ${e?.code}`)) return [];
    throw e;
  }
}

// (coach) Qué recetas de su biblioteca ve todo el equipo: [ids]
export async function idsRecetasEquipo({ backend }) {
  try { return (await backend.select('recetas', { eq: { para_todos: true }, cols: 'id' })).map((r) => r.id); } catch (e) {
    if (sin055(e) || sinTabla(e)) return null;   // null: la base aún no tiene la 055
    throw e;
  }
}

// (coach) Poner o quitar una receta del recetario del equipo
export async function ponerParaTodos({ backend }, recetaId, paraTodos) {
  try { return (await backend.update('recetas', { para_todos: !!paraTodos }, { eq: { id: recetaId } }))[0]; } catch (e) {
    if (sin055(e)) throw new Error('Para el recetario del equipo falta ejecutar la migración 055 en Supabase (supabase/migraciones/055_recetario_equipo.sql).');
    throw e;
  }
}
