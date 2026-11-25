// FBE Esencial (sin coach, tanda 3): «Tus gustos» y la criba del principio. Lo que se pregunta además del cuestionario
// para elegir rutina, y quién necesita «Primeras 4 semanas». Lógica pura y pequeña: la usa la tarjeta de antes de empezar
// (el catálogo, con sus 63 rutinas y el algoritmo que recomienda, va aparte: esencial-catalogo.js).
const NIVELES = ['ninguna', 'menos_1', '1_3', '3_5', 'mas_5'];
export const nivelDe = (experiencia) => Math.max(0, NIVELES.indexOf(experiencia || 'ninguna'));
export const enGimnasio = (c) => ['gimnasio', 'gimnasio_basico'].includes(c?.lugar || 'gimnasio');

// ---------- «Tus gustos»: lo que se pregunta además del cuestionario, para elegir rutina ----------
// si(c): la pregunta solo se hace con ese cuestionario (a quien nunca ha entrenado no se le pregunta por la barra)
export const GUSTOS = [
  { id: 'ahora', titulo: '¿Entrenas fuerza ahora mismo?', opciones: [['si', 'Sí, con regularidad'], ['poco', 'Lo dejé hace menos de tres meses'], ['parado', 'Llevo más de tres meses sin entrenar']], si: (c) => nivelDe(c?.experiencia) > 0 },
  { id: 'tecnica', titulo: '¿Te manejas con la sentadilla o la prensa, los empujes y los remos?', opciones: [['si', 'Sí, sin problema'], ['algunos', 'Con algunos'], ['no', 'No mucho']], si: (c) => nivelDe(c?.experiencia) > 0 },
  { id: 'barra', titulo: '¿Haces sentadilla, press banca y peso muerto con barra, con buena técnica?', opciones: [['si', 'Sí'], ['no', 'No, o no los hago']], si: (c) => nivelDe(c?.experiencia) > 0 && enGimnasio(c) },
  { id: 'prioridad', titulo: '¿Qué quieres priorizar?', opciones: [['equilibrado', 'Todo por igual'], ['gluteo', 'Glúteo y pierna'], ['torso', 'Torso: pecho, espalda y brazos'], ['fuerza', 'Subir mis marcas en los básicos'], ['salud', 'Salud y encontrarme bien']] },
  { id: 'otro', titulo: '¿Haces otro deporte?', opciones: [['no', 'No'], ['correr', 'Corro'], ['deporte', 'Pádel, fútbol u otro de equipo o de raqueta']] },
  { id: 'mayor', titulo: '¿Tienes 60 años o más?', opciones: [['no', 'No'], ['si', 'Sí']] },
];
export const preguntasGustos = (c = {}) => GUSTOS.filter((p) => !p.si || p.si(c));
// Solo lo que vale (cada respuesta, una de sus opciones; lo demás se quita)
export function limpiarGustos(g, c = {}) {
  const out = {};
  for (const p of preguntasGustos(c)) { const v = g?.[p.id]; if (p.opciones.some(([k]) => k === v)) out[p.id] = v; }
  return out;
}
export const gustosCompletos = (g, c = {}) => preguntasGustos(c).every((p) => g?.[p.id] != null);

// ---------- La criba: ¿necesita «Primeras 4 semanas»? ----------
// Quien nunca ha entrenado fuerza, sí. Y quien lleva menos de un año y lleva más de tres meses parado o no se maneja con
// los movimientos básicos. Los demás van directos a elegir entre sus rutinas recomendadas.
export function necesitaPrimeras({ experiencia = null, gustos = {} } = {}) {
  const n = nivelDe(experiencia);
  if (n === 0) return true;
  return n === 1 && (gustos?.ahora === 'parado' || gustos?.tecnica === 'no');
}
