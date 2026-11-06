// El recetario al día con el plan: lo que lee y lo que guarda. Aparte de la API para no tocarla.
import { tomasDe, recetarioPorToma, ordenarTomas } from '../logica/comidas.js';
import { menuPorActualizar } from '../logica/recetario/comprobar.js';

// De cuatro en cuatro, para no lanzar decenas de peticiones a la vez
async function enTandas(lista, fn, n = 4) {
  for (let i = 0; i < lista.length; i += n) await Promise.all(lista.slice(i, i + n).map(fn));
}

// El recetario y los planes de un atleta
export async function datosRecetario({ api }, atletaId) {
  const [recetario, planes] = await Promise.all([api.recetario(atletaId), api.planesNutricion(atletaId).catch(() => [])]);
  return { recetario, planes };
}

// Lo apuntado en su menú desde hoy (sin comer) pasa a llevar los macros de su recetario de ahora. Devuelve cuántas cambian.
async function ponerMenuAlDia({ api, backend }, atletaId, hoy) {
  const [recetario, entradas] = await Promise.all([api.recetario(atletaId), backend.select('menu_comidas', { eq: { atleta_id: atletaId }, gte: { fecha: hoy } }).catch(() => [])]);
  const cambios = menuPorActualizar(entradas, recetario, hoy);
  await enTandas(cambios, (c) => backend.update('menu_comidas', c.cambios, { eq: { id: c.id } }));
  return cambios.length;
}

// Corrige las kcal de las recetas (las de sus macros). lista: [{ receta, calculadas }] (de recetasConKcalMal).
// Devuelve { recetas, menu } (cuántas recetas y cuántas comidas ya apuntadas se han puesto al día)
export async function corregirKcal({ api, backend }, atletaId, lista, { hoy }) {
  await enTandas(lista, (x) => backend.update('recetas', { kcal: x.calculadas }, { eq: { id: x.receta.id } }));
  const menu = await ponerMenuAlDia({ api, backend }, atletaId, hoy).catch(() => 0);
  return { recetas: lista.length, menu };
}

// Aplica los factores nuevos. cambios: [{ id, despues }] (de reescalar). Una actualización por cada factor distinto.
export async function aplicarFactores({ api, backend }, atletaId, cambios, { hoy }) {
  const porFactor = new Map();
  for (const c of cambios) { if (!porFactor.has(c.despues)) porFactor.set(c.despues, []); porFactor.get(c.despues).push(c.id); }
  for (const [factor, ids] of porFactor) await backend.update('recetas_atleta', { factor }, { in: { id: ids } });
  const menu = await ponerMenuAlDia({ api, backend }, atletaId, hoy).catch(() => 0);
  return { recetas: cambios.length, menu };
}

// Los recetarios de todos los atletas con nutrición, de una vez (cinco consultas): [{ atleta, recetario, planes }]
export async function recetariosDelEquipo({ api, backend }) {
  const atletas = (await api.atletas()).filter((a) => a.estado === 'activo' && a.nutricion !== false);
  if (!atletas.length) return [];
  const ids = atletas.map((a) => a.id);
  const [asignaciones, comidas, planes] = await Promise.all([
    backend.select('recetas_atleta', { in: { atleta_id: ids }, order: [['orden', 'asc']] }).catch(() => []),
    backend.select('comidas_atleta', { in: { atleta_id: ids } }).catch(() => []),
    backend.select('planes_nutricion', { in: { atleta_id: ids }, order: [['desde', 'asc']] }).catch(() => []),
  ]);
  const idsRecetas = [...new Set(asignaciones.map((a) => a.receta_id))];
  // (sin las fotos: solo lo que hace falta para las cuentas)
  const recetas = idsRecetas.length ? await backend.select('recetas', { in: { id: idsRecetas }, cols: 'id,nombre,tomas,kcal,proteina_g,carbos_g,grasa_g' }) : [];
  return atletas.map((a) => {
    const suyas = asignaciones.filter((x) => x.atleta_id === a.id);
    const fila = comidas.find((x) => x.atleta_id === a.id) || null;
    const tomas = tomasDe(fila);
    const usadas = new Set(suyas.map((x) => x.receta_id));
    const rs = recetas.filter((r) => usadas.has(r.id));
    const porToma = recetarioPorToma(suyas, rs);
    const opcional = fila?.opcional && tomas.includes(fila.opcional) && tomas.length >= 2 ? fila.opcional : null;
    return { atleta: a, recetario: { tomas, opcional, eligio: !!fila, conRecetas: ordenarTomas(Object.keys(porToma)), porToma, asignaciones: suyas, recetas: rs }, planes: planes.filter((p) => p.atleta_id === a.id) };
  });
}
