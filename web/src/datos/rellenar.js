// «Rellenar la semana»: lo que lee y lo que guarda. Aparte de la API para no tocarla: usa api.menuSemana y una sola
// inserción en menu_comidas (las mismas filas que crea la app al apuntar una receta a mano).
import { sumarDias } from '../logica/fechas.js';
import { filasDePropuesta } from '../logica/rellenar/rellenar.js';

// El menú de la semana anterior, para no repetir lo mismo (si falla, se propone igual, sin ese dato)
export async function menuAnterior({ api }, atletaId, lunes) {
  return api.menuSemana(atletaId, sumarDias(lunes, -7)).catch(() => []);
}

// Guarda la propuesta. Antes vuelve a leer la semana: un hueco que se haya llenado mientras tanto (otra pestaña, el
// coach desde la ficha) no se pisa ni se duplica. Devuelve { guardadas, saltadas }.
export async function guardarRelleno({ api, backend }, atletaId, lunes, propuestas = []) {
  if (!propuestas.length) return { guardadas: 0, saltadas: 0 };
  const ahora = await api.menuSemana(atletaId, lunes);
  const ocupados = new Set(ahora.map((e) => `${e.fecha}|${e.toma}`));
  const libres = propuestas.filter((p) => !ocupados.has(`${p.fecha}|${p.toma}`));
  if (libres.length) await backend.insert('menu_comidas', filasDePropuesta(atletaId, libres));
  return { guardadas: libres.length, saltadas: propuestas.length - libres.length };
}
