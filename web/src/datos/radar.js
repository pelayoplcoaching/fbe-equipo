// Radar de contacto: lo que hay que leer de la base. Aparte de la API para no tocarla: usa el resumen del panel
// (api.resumenes) y consultas pequeñas propias. Lo único que escribe son tus temas pendientes (con tus notas privadas).
// (v0.201) También lo que hace falta para entender cómo está cada uno y de qué hablarle: el texto de lo último que te
// escribió y de lo último que le preguntaste, su check-in, sus datos personales, carreras, pausas, su última conexión,
// tus recordatorios y pendientes, objetivos propuestos y vídeos sin corregir. Todo lo que falte (una migración que no
// está) se queda vacío, sin romper nada.
import { fechaMadrid, sumarDias, diasEntre } from '../logica/fechas.js';
import { DIAS_HISTORIA, ultimosMensajes, programadosPorAtleta, mensajesDelAtleta } from '../logica/radar/contactos.js';
import { pendientesPorAtleta, escribirPendiente, leerPendiente } from '../logica/radar/pendientes.js';
import { enfriandoDe } from '../logica/radar/senales.js';
import { normalFrase } from '../logica/radar/borrador.js';

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

// El día (de Madrid) en que cada atleta envió su último check-in ({ [atleta_id]: 'YYYY-MM-DD' }) y (v0.201) ese check-in
// entero, para el resumen de «Cómo está» y su nota: { dias, filas }
const COLS_CK = 'atleta_id,semana_inicio,creado_en';
const COLS_CK_TODO = `${COLS_CK},horas_sueno,energia,recuperacion,motivacion,adherencia_desayuno,adherencia_comida,adherencia_merienda,adherencia_cena,satisfaccion_dieta,notas,revisado_en`;
async function ultimosCheckins(backend, atletaIds, desde) {
  if (!atletaIds.length) return { dias: {}, filas: {} };
  const q = (cols) => backend.select('checkins', { in: { atleta_id: atletaIds }, gte: { semana_inicio: desde }, order: [['semana_inicio', 'desc']], cols });
  const filas = await q(COLS_CK_TODO).catch(() => q(COLS_CK));
  const dias = {}, ultimas = {};
  for (const c of filas) if (!ultimas[c.atleta_id] && c.creado_en) { ultimas[c.atleta_id] = c; dias[c.atleta_id] = fechaMadrid(new Date(c.creado_en)); }
  return { dias, filas: ultimas };
}

// (v0.201) Lo de cada atleta además del contacto: { [atleta_id]: { mensajeAtleta, preguntaCoach, checkin, videos,
// propuestas, pendientes, recordatorio, cumple, carreras, pausaFin, enfriando, personal, panel } }
async function extraRadar({ api, backend }, { hoy, resumenes, activos, comentarios, checkinFilas }) {
  const ahora = Date.now();
  const ultimos = ultimosMensajes(comentarios, { ahora });
  const idsTexto = [];
  for (const id of activos) {
    const u = ultimos[id];
    if (!u) continue;
    if (u.atleta && (!u.coach || u.atleta.t > u.coach.t)) idsTexto.push(u.atleta.id);
    else if (u.coach && (!u.atleta || u.coach.t > u.atleta.t)) idsTexto.push(u.coach.id);
  }
  const vacio = (x) => () => x;
  const [textos, personal, carreras, pausas, perfiles, panel, notas, propuestas, archivos] = await Promise.all([
    idsTexto.length ? backend.select('comentarios', { in: { id: idsTexto }, cols: 'id,texto' }).catch(vacio([])) : [],
    api.personalAtletas ? api.personalAtletas().catch(vacio([])) : [],
    backend.select('carrera_eventos', { in: { atleta_id: activos }, gte: { fecha: sumarDias(hoy, -3) }, lte: { fecha: sumarDias(hoy, 7) }, cols: 'atleta_id,nombre,fecha,decision', order: [['fecha', 'asc']] }).catch(vacio([])),
    backend.select('pausas', { in: { atleta_id: activos }, cols: 'atleta_id,desde,hasta' }).catch(vacio([])),
    backend.select('atletas', { in: { id: activos }, cols: 'id,perfil_id' }).catch(vacio([])),
    api.panelAtletas ? api.panelAtletas().catch(vacio(undefined)) : undefined,
    backend.select('notas_coach', { in: { atleta_id: activos }, cols: 'id,atleta_id,texto,creado_en' }).catch(vacio([])),
    api.propuestasPendientes ? api.propuestasPendientes().catch(vacio([])) : [],
    backend.select('archivos', { nulo: ['revisado_en'], gte: { creado_en: `${sumarDias(hoy, -28)}T00:00:00` }, in: { atleta_id: activos }, cols: 'atleta_id,tipo,creado_en' }).catch(vacio([])),
  ]);
  const perfilDe = Object.fromEntries((perfiles || []).filter((p) => p.perfil_id).map((p) => [p.id, p.perfil_id]));
  const usuarios = Object.values(perfilDe);
  const presencia = usuarios.length ? await backend.select('presencia', { in: { usuario_id: usuarios }, cols: 'usuario_id,ultima_conexion,visible' }).catch(vacio([])) : [];
  const conexionDe = Object.fromEntries((presencia || []).filter((p) => p.visible !== false && p.ultima_conexion).map((p) => [p.usuario_id, p.ultima_conexion]));
  const texto = Object.fromEntries((textos || []).map((c) => [c.id, c.texto || '']));
  const pend = pendientesPorAtleta(notas || []);
  const nProp = {};
  for (const p of propuestas || []) if (p?.atleta_id) nProp[p.atleta_id] = (nProp[p.atleta_id] || 0) + 1;
  const vids = {};
  for (const a of archivos || []) {
    if (!a?.atleta_id || ['adjunto', 'documento', 'audio'].includes(a.tipo)) continue;
    const v = (vids[a.atleta_id] ||= { n: 0, desde: null });
    v.n++;
    const dia = fechaMadrid(new Date(a.creado_en));
    if (!v.desde || dia < v.desde) v.desde = dia;
  }
  const personalDe = Object.fromEntries((personal || []).filter((p) => p?.atleta_id).map((p) => [p.atleta_id, p]));
  const mensajes = mensajesDelAtleta(comentarios, { hoy, ahora });
  const R = Object.fromEntries(resumenes.map((r) => [r.atleta_id, r]));
  const out = {};
  for (const id of activos) {
    const u = ultimos[id] || {};
    const atletaUltimo = u.atleta && (!u.coach || u.atleta.t > u.coach.t);
    const coachUltimo = u.coach && (!u.atleta || u.coach.t > u.atleta.t);
    const p = personalDe[id] || null;
    // La última pausa que ya ha terminado (vuelve al día siguiente de su «hasta»), si fue en la última semana
    const fin = (pausas || []).filter((x) => x.atleta_id === id && x.hasta && x.hasta < hoy).map((x) => sumarDias(x.hasta, 1)).sort().pop() || null;
    out[id] = {
      mensajeAtleta: atletaUltimo ? { id: u.atleta.id, dia: u.atleta.dia, texto: texto[u.atleta.id] ?? null } : null,
      preguntaCoach: coachUltimo && texto[u.coach.id] ? { id: u.coach.id, dia: u.coach.dia, texto: texto[u.coach.id] } : null,
      checkin: checkinFilas[id] || null,
      videos: vids[id] || null,
      propuestas: nProp[id] || 0,
      pendientes: pend[id] || [],
      recordatorio: panel?.ajustes?.recordatorios?.[id] || null,
      cumple: p?.cumple_mes && p?.cumple_dia ? { mes: p.cumple_mes, dia: p.cumple_dia } : null,
      carreras: (carreras || []).filter((e) => e.atleta_id === id),
      pausaFin: fin && diasEntre(fin, hoy) <= 7 ? fin : null,
      enfriando: R[id] ? enfriandoDe({ resumen: R[id], mensajes: mensajes[id] || null, conexion: conexionDe[perfilDe[id]] || null, hoy }) : null,
      conexion: conexionDe[perfilDe[id]] || null,
      personal: p ? { apodo: p.apodo || null, porque: p.porque || null, favoritos: Array.isArray(p.favoritos) ? p.favoritos : [] } : null,
      panel: panel?.atletas?.[id] || null,
    };
  }
  return out;
}

// Todo lo que el radar necesita, de una vez: { hoy, resumenes, comentarios, sesiones, checkins, extra, programados }
export async function datosRadar({ api, backend }, { hoy = fechaMadrid() } = {}) {
  const resumenes = await api.resumenes(hoy);
  const activos = resumenes.filter((r) => r.estado === 'activo').map((r) => r.atleta_id);
  const [comentarios, sesiones, cks] = await Promise.all([
    comentariosRecientes(backend, sumarDias(hoy, -DIAS_HISTORIA)),
    sesionesRecientes(backend, activos, sumarDias(hoy, -7)).catch(() => ({})),
    ultimosCheckins(backend, activos, sumarDias(hoy, -21)).catch(() => ({ dias: {}, filas: {} })),
  ]);
  const extra = await extraRadar({ api, backend }, { hoy, resumenes, activos, comentarios, checkinFilas: cks.filas }).catch(() => ({}));
  return { hoy, resumenes, comentarios, sesiones, checkins: cks.dias, extra, programados: programadosPorAtleta(comentarios) };
}

// (v0.201) Al abrir la fila de un atleta: sus objetivos (para «Cómo está» y si está cerca o lo ha conseguido) y lo que
// le has escrito en las últimas 4 semanas (para no repetirle una frase). → { objetivos, enviados: [texto normalizado] }
export async function abrirRadar({ api, backend }, atletaId, { hoy = fechaMadrid() } = {}) {
  const [objetivos, mios] = await Promise.all([
    api.objetivos ? api.objetivos(atletaId, hoy).catch(() => []) : [],
    backend.select('comentarios', { eq: { atleta_id: atletaId, autor: 'coach' }, gte: { creado_en: `${sumarDias(hoy, -DIAS_HISTORIA)}T00:00:00` }, order: [['creado_en', 'desc']], limit: 80, cols: 'id,texto,eliminado_en' }).catch(() => []),
  ]);
  return { objetivos: objetivos || [], enviados: (mios || []).filter((c) => !c.eliminado_en && c.texto).map((c) => normalFrase(c.texto)) };
}

// (v0.201) Tus temas pendientes: apuntar uno (desde hoy o desde otro día, para «Recuérdamelo») y darlo por hablado
export async function apuntarPendiente({ api }, atletaId, texto, { desde }) {
  const t = escribirPendiente(texto, { desde });
  if (!t) throw new Error('Escribe de qué tienes que hablarle');
  return api.crearNota(atletaId, t);
}
export async function pendienteHecho({ api }, nota, { hoy = fechaMadrid() } = {}) {
  const p = leerPendiente(nota.texto) || nota;
  const t = escribirPendiente(p.texto, { desde: p.desde, hecho: hoy });
  if (!t) return null;
  return api.actualizar('notas_coach', nota.id, { texto: t });
}

// Los récords de los últimos días de un atleta (al abrir su fila): [{ ejercicio, texto, fecha }]
export async function recordsRecientes({ api }, atletaId, { hoy = fechaMadrid(), dias = 7 } = {}) {
  const eventos = await api.actividad(atletaId, dias, hoy);
  return eventos.filter((e) => e.tipo === 'record').map((e) => ({ ejercicio: String(e.titulo || '').replace(/^R\u00e9cord en /, ''), texto: e.detalle || '', fecha: e.fecha }));
}
