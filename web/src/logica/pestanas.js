// La barra de abajo en el móvil: como mucho cinco huecos. Si las pestañas no caben, se quedan las cuatro de cada día y
// el resto va detrás de «Más» (una hoja con la lista). En pantallas anchas caben todas y no hay «Más».
// tabs: [[id, texto, icono], ...] en su orden; preferidas: ids por orden de preferencia para quedarse en la barra.
export const MAX_BARRA = 5;

export function repartirPestanas(tabs, preferidas = [], { estrecha = true, max = MAX_BARRA } = {}) {
  const lista = Array.isArray(tabs) ? tabs : [];
  if (!estrecha || lista.length <= max) return { barra: lista, mas: [] };
  const ids = lista.map(([t]) => t);
  const hueco = max - 1;   // el quinto es «Más»
  const elegidas = [];
  for (const t of preferidas) { if (elegidas.length < hueco && ids.includes(t) && !elegidas.includes(t)) elegidas.push(t); }
  // Si faltan preferidas (a quien solo se le lleva la nutrición no tiene Semana), se completa con las siguientes en su orden
  for (const t of ids) { if (elegidas.length < hueco && !elegidas.includes(t)) elegidas.push(t); }
  return { barra: lista.filter(([t]) => elegidas.includes(t)), mas: lista.filter(([t]) => !elegidas.includes(t)) };
}

// Las de cada día. Atleta: lo que toca hoy, la semana, cómo va y su coach. Coach: sus atletas, lo que espera respuesta,
// la revisión de la semana y los mensajes.
export const PREFERIDAS_ATLETA = ['hoy', 'semana', 'progreso', 'mensajes'];
export const PREFERIDAS_COACH = ['atletas', 'revisar', 'revision', 'mensajes'];
