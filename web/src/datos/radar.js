// Radar de contacto: lo que hay que leer de la base. Aparte de la API para no tocarla: usa el resumen del panel
// (api.resumenes) y tres consultas pequeñas propias. No escribe nada.
import { fechaMadrid, sumarDias } from '../logica/fechas.js';
import { DIAS_HISTORIA } from '../logica/radar/contactos.js';

const COLS = 'id,atleta_id,autor,creado_en,eliminado_en';
// De más a menos columnas: una base sin las migraciones del chat más nuevas responde igual, con menos detalle
const INTENTOS = [`${COLS},enviar_en,cliente_id,resumen_sesion`, `${COLS},enviar_en,cliente_id`, `${COLS},enviar_en`, COLS];

// Solo lo que hace falta para contar (ni el texto ni a qué van unidos), también con un backend que no recorta columnas
const loJusto = (c) => ({ id: c.id, atleta_id: c.atleta_id, autor: c.autor, creado_en: c.creado_en, eliminado_en: c.eliminado_en || null,
  enviar_en: c.enviar_en || null, cliente_id: c.cliente_id || null, resumen_sesion: !!c.resumen_sesion });

async function comentariosRecientes(backend, desde) {
  let error = null;
  for (const cols of INTENTOS) {
    try { return (await backend.select('comentarios', { gte: { creado_en: `${desde}T00:00:00` }, order: [['creado_en', 'desc']], limit: 20000, cols })).map(loJusto); } catch (e) { error = e; }
  }
  throw error;
}

// Las sesiones hechas en los últimos días de cada atleta: { [atleta_id]: [{ id, nombre, fecha, preparacion }] }
async function sesionesRecientes(backend, atletaIds, desde) {
  if (!atletaIds.length) return {};
  const bloques = await backend.select('bloques', { in: { atleta_id: atletaIds }, eq: { es_plantilla: false }, cols: 'id,atleta_id' });
  if (!bloques.length) return {};
  const semanas = await backend.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, cols: 'id,bloque_id' });
  if (!semanas.length) return {};
  const sesiones = await backend.select('sesiones', { in: { semana_id: semanas.map((x) => x.id) }, eq: { completada: true }, gte: { fecha_realizada: desde }, cols: 'id,semana_id,nombre,fecha_realizada,preparacion' })
    .catch(() => backend.select('sesiones', { in: { semana_id: semanas.map((x) => x.id) }, eq: { completada: true }, gte: { fecha_realizada: desde }, cols: 'id,semana_id,nombre,fecha_realizada' }));
  const atletaDe = Object.fromEntries(bloques.map((x) => [x.id, x.atleta_id]));
  const bloqueDe = Object.fromEntries(semanas.map((x) => [x.id, x.bloque_id]));
  const out = {};
  for (const s of sesiones) {
    const a = atletaDe[bloqueDe[s.semana_id]];
    if (a) (out[a] ||= []).push({ id: s.id, nombre: s.nombre, fecha: s.fecha_realizada, preparacion: s.preparacion || null });
  }
  return out;
}

// El día (de Madrid) en que cada atleta envió su último check-in: { [atleta_id]: 'YYYY-MM-DD' }. Solo la fecha: nada de
// lo que contestó.
async function ultimosCheckins(backend, atletaIds, desde) {
  if (!atletaIds.length) return {};
  const filas = await backend.select('checkins', { in: { atleta_id: atletaIds }, gte: { semana_inicio: desde }, order: [['semana_inicio', 'desc']], cols: 'atleta_id,semana_inicio,creado_en' });
  const out = {};
  for (const c of filas) if (!out[c.atleta_id] && c.creado_en) out[c.atleta_id] = fechaMadrid(new Date(c.creado_en));
  return out;
}

// Todo lo que el radar necesita, de una vez: { hoy, resumenes, comentarios, sesiones, checkins }
export async function datosRadar({ api, backend }, { hoy = fechaMadrid() } = {}) {
  const resumenes = await api.resumenes(hoy);
  const activos = resumenes.filter((r) => r.estado === 'activo').map((r) => r.atleta_id);
  const [comentarios, sesiones, checkins] = await Promise.all([
    comentariosRecientes(backend, sumarDias(hoy, -DIAS_HISTORIA)),
    sesionesRecientes(backend, activos, sumarDias(hoy, -7)).catch(() => ({})),
    ultimosCheckins(backend, activos, sumarDias(hoy, -21)).catch(() => ({})),
  ]);
  return { hoy, resumenes, comentarios, sesiones, checkins };
}

// Los récords de los últimos días de un atleta (al abrir su fila): [{ ejercicio, texto, fecha }]
export async function recordsRecientes({ api }, atletaId, { hoy = fechaMadrid(), dias = 7 } = {}) {
  const eventos = await api.actividad(atletaId, dias, hoy);
  return eventos.filter((e) => e.tipo === 'record').map((e) => ({ ejercicio: String(e.titulo || '').replace(/^R\u00e9cord en /, ''), texto: e.detalle || '', fecha: e.fecha }));
}
