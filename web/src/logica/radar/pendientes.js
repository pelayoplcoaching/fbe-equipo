// Radar de contacto (v0.201): tus temas pendientes de hablar con cada atleta. Lógica pura.
//
// Van con tus notas privadas de la ficha (notas_coach: el atleta nunca las ve), con una marca delante, como las notas de
// cada ejercicio: «#pend:2026-11-24# Preguntarle por la boda». La fecha es desde cuándo sale (para «Recuérdamelo en 3
// días», un día que aún no ha llegado). Al hablarlo se marca hecho: «#pend:2026-11-24:hecho:2026-11-26# …» (se queda
// en su historia; las notas de la ficha no las enseñan).
const MARCA = /^#pend:(\d{4}-\d{2}-\d{2})(?::hecho:(\d{4}-\d{2}-\d{2}))?#\s?([\s\S]*)$/;
export const MAX_PENDIENTE = 200;

export function leerPendiente(texto) {
  const m = MARCA.exec(String(texto ?? ''));
  return m ? { desde: m[1], hecho: m[2] || null, texto: m[3].trim() } : null;
}
export const esPendiente = (texto) => !!leerPendiente(texto);

export function escribirPendiente(texto, { desde, hecho = null } = {}) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_PENDIENTE);
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(String(desde || ''))) return null;
  return `#pend:${desde}${hecho ? `:hecho:${hecho}` : ''}# ${t}`;
}

// De las notas privadas: { [atleta_id]: [{ id, texto, desde, hecho }] } con los que siguen abiertos (los hechos, fuera),
// del más antiguo al más nuevo. Con todos: true, también los hechos.
export function pendientesPorAtleta(notas = [], { todos = false } = {}) {
  const out = {};
  for (const n of notas || []) {
    const p = n && leerPendiente(n.texto);
    if (!p || (!todos && p.hecho) || !n.atleta_id) continue;
    (out[n.atleta_id] ||= []).push({ id: n.id, atleta_id: n.atleta_id, ...p, creado_en: n.creado_en || null });
  }
  for (const l of Object.values(out)) l.sort((a, b) => (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0));
  return out;
}

// El texto de «Recuérdamelo»: «Preguntar cómo sigue: molestia en hombros»
export function textoSeguimiento(etiqueta) {
  const e = String(etiqueta || '').trim();
  return e ? `Preguntar cómo sigue: ${e.charAt(0).toLowerCase()}${e.slice(1)}` : 'Preguntar cómo sigue';
}
