// FBE Esencial: lo que la api hace solo para quien va por su cuenta (o para su panel del coach) y pesa: fuera del arranque,
// se carga al usarlo (api.js lo llama con import()). api: la api entera; b: el backend.
import { fechaMadrid, sumarDias } from '../logica/fechas.js';

const porId = (filas) => Object.fromEntries(filas.map((f) => [f.id, f]));
const unicos = (xs) => [...new Set(xs.filter((x) => x != null))];
const falta = (re, mas = '') => (e) => re.test(`${e?.message || ''}`) && new RegExp(`schema cache|does not exist|no existe|could not find|PGRST20[0-9]|42883${mas}`, 'i').test(`${e?.message || ''} ${e?.code || ''}`);
const falta092 = falta(/esencial_semana_siguiente/);
const falta096 = falta(/esencial_cambiar_dias|esencial_dias/, '|42703');

// (FBE Esencial, tanda 3, migración 092) La semana siguiente de quien va por su cuenta, sola: si toca (la última está
// hecha, ya es su lunes siguiente o, 098, ha elegido pasar), el motor la prepara aquí, en su móvil, y la base la guarda (y
// lo comprueba todo). Con una posible errata antes de su lunes, no se prepara: devuelve las preguntas para la tarjeta.
// → null (nada que hacer) | { semana } | { preguntas, base, inicio } | { falta092: true }
export async function prepararSemana(api, b, atletaId, { hoy = fechaMadrid() } = {}) {
  const { siguientePaso } = await import('../logica/esencial-semana.js');
  const [prog, atleta] = await Promise.all([api.programa(atletaId), b.select('atletas', { eq: { id: atletaId } }).then((x) => x[0] || null)]);
  // (096) con los días que ha pedido (3 o 2): desde el lunes siguiente, la otra plantilla de novato
  const paso = siguientePaso({ bloque: prog.bloque, semanas: prog.semanas, sesiones: prog.sesiones, hoy, dias: atleta?.esencial_dias ?? null, rutina: atleta?.esencial_plantilla ?? null });
  if (!paso) return null;
  if (paso.tipo === 'cambio') {
    // (los kilos de ahora, los pone la base: la de cada ejercicio en la semana hecha; el día de alternativas, sin kilos)
    try {
      const semana = await b.rpc('esencial_semana_siguiente', { p: { base: paso.base.id, inicio: paso.inicio, cambio: true, plantilla: paso.plantilla, sesiones: [] }, p_atleta: atletaId });
      return { semana, tipo: 'cambio', inicio: paso.inicio, plantilla: paso.plantilla };
    } catch (e) { if (falta096(e)) return { falta096: true }; throw e; }
  }
  const [{ propuestaEsencial }, d, esta, previa] = await Promise.all([
    import('../logica/esencial-motor.js'),
    api.bloqueCompleto(prog.bloque.id),
    api.checkin(atletaId, paso.base.fecha_inicio).catch(() => null),
    api.checkin(atletaId, sumarDias(paso.base.fecha_inicio, -7)).catch(() => null),
  ]);
  // (094) con sus alternativas para siempre (por si van por tiempo)
  const ids = unicos([...Object.values(d.pautas || {}).flat().map((x) => x.ejercicio_id), ...Object.values(atleta?.esencial_alternativas || {})]);
  const ejercicios = porId(await api.ejerciciosPorIds(ids));
  const r = propuestaEsencial({ d, base: paso.base, tipo: paso.tipo, ejercicios, atleta, hoy,
    checkins: [previa?.checkin, esta?.checkin].filter(Boolean), molestias: (esta?.molestias || []).map((m) => ({ ...m, semana_inicio: paso.base.fecha_inicio })) });
  // (098) si ya ha elegido pasar a la siguiente, no se espera a la duda de una posible errata (como al llegar el lunes)
  if (r.preguntas.length && hoy < paso.inicio && !paso.adelantada) return { preguntas: r.preguntas, base: paso.base, inicio: paso.inicio };
  try {
    // (con su id: así también la puede preparar el coach desde su ficha; la base comprueba que el atleta es quien llama)
    const semana = await b.rpc('esencial_semana_siguiente', { p: { base: paso.base.id, inicio: paso.inicio, novato: paso.tipo === 'novato', ...(paso.plantilla && paso.plantilla !== 'Novato 2 días · FBE Esencial' ? { plantilla: paso.plantilla } : {}), nota: r.nota, descarga: r.descarga, sesiones: r.sesiones }, p_atleta: atletaId });
    return { semana, tipo: paso.tipo, inicio: paso.inicio };
  } catch (e) { if (falta092(e)) return { falta092: true }; throw e; }
}

// (098, el panel del coach) Las semanas de quienes van por su cuenta con algo elegido al cerrarlas desde ese lunes:
// [{ atleta_id, nombre, numero, bloque, cierre, lunes, repetida }]
export async function cierres(b, desde) {
  try {
    const atletas = (await b.select('atletas', { eq: { modalidad: 'por_su_cuenta' }, cols: 'id,nombre' }));
    if (!atletas.length) return [];
    const bloques = await b.select('bloques', { in: { atleta_id: atletas.map((a) => a.id) }, eq: { es_plantilla: false }, cols: 'id,atleta_id,nombre' });
    if (!bloques.length) return [];
    const semanas = (await b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, cols: 'id,bloque_id,numero,fecha_inicio,esencial_cierre,esencial_cierre_lunes,esencial_repetida' }))
      .filter((w) => w.esencial_cierre && String(w.esencial_cierre_lunes || '').slice(0, 10) >= desde);
    const bl = porId(bloques), at = porId(atletas);
    return semanas.map((w) => ({ atleta_id: bl[w.bloque_id]?.atleta_id, nombre: at[bl[w.bloque_id]?.atleta_id]?.nombre || '', numero: w.numero, bloque: bl[w.bloque_id]?.nombre || '',
      cierre: w.esencial_cierre, lunes: String(w.esencial_cierre_lunes).slice(0, 10), repetida: Number(w.esencial_repetida) || 0 }))
      .sort((x, y) => y.lunes.localeCompare(x.lunes) || x.nombre.localeCompare(y.nombre));
  } catch (e) { if (/esencial_cierre/.test(`${e?.message || ''}`)) return []; throw e; }
}

// (099) El catálogo de rutinas (las plantillas que Pelayo tiene en él), con sus días y sus ejercicios: [] sin la 099
const falta099 = falta(/esencial_catalogo|esencial_elegir_rutina/);
export async function catalogo(b) {
  try { return (await b.rpc('esencial_catalogo', {})) || []; } catch (e) { if (falta099(e)) return []; throw e; }
}
// Elegir rutina (null: ninguna). → { rutina } | { falta099: true }
export async function elegirRutina(b, nombre, atletaId = null) {
  try { return await b.rpc('esencial_elegir_rutina', { p_nombre: nombre, ...(atletaId ? { p_atleta: atletaId } : {}) }); } catch (e) { if (falta099(e)) return { falta099: true }; throw e; }
}

// (099) Su rutina, para «Tu rutina»: la que ha elegido (puede ser para después), cuándo, la última que llevó que no era de
// temporada (para volver a ella) y cuántos ejercicios lleva tres semanas sin subir (con historia: true y tres semanas o
// más en su bloque). → { con099, elegida, elegidaEn, anterior, estancados }
export async function rutina(api, b, atletaId, { bloqueId = null, historia = false } = {}) {
  const [at, bloques] = await Promise.all([
    b.select('atletas', { eq: { id: atletaId } }).then((x) => x[0] || null),
    b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, cols: 'id,nombre,numero,estado' }).catch(() => []),
  ]);
  const { DE_TEMPORADA, rutinaDe } = await import('../logica/esencial-catalogo.js');
  const deTemporada = (n) => DE_TEMPORADA.includes(rutinaDe(n)?.familia);
  const anterior = [...bloques].sort((x, y) => (y.numero || 0) - (x.numero || 0)).find((x) => x.id !== bloqueId && x.estado !== 'cancelado' && rutinaDe(x.nombre) && !deTemporada(x.nombre) && x.nombre !== 'Primeras 4 semanas')?.nombre || null;
  let estancados = 0;
  if (historia && bloqueId) {
    try {
      const [{ estancadosDe }, d] = await Promise.all([import('../logica/esencial-motor.js'), api.bloqueCompleto(bloqueId)]);
      const base = [...(d.semanas || [])].filter((w) => w.bloque_id === bloqueId && w.programacion === 'programada').sort((x, y) => y.numero - x.numero)[0];
      estancados = estancadosDe(d, base);
    } catch { estancados = 0; }
  }
  return { con099: !!at && 'esencial_plantilla' in at, elegida: at?.esencial_plantilla ?? null, elegidaEn: at?.esencial_plantilla_en ?? null, anterior, estancados };
}

// (099, el coach) Una plantilla entra o sale del catálogo de FBE Esencial
export async function plantillaEnCatalogo(b, id, valor) {
  return (await b.update('bloques', { esencial_catalogo: !!valor }, { eq: { id } }))[0] || null;
}

// (099, el panel del coach) La rutina de cada uno de los que van por su cuenta: la que lleva (su bloque en marcha), desde
// cuándo, la que ha elegido para después y si está entre las que la app le recomienda con su cuestionario.
// → [{ atleta_id, nombre, rutina, titulo, inicio, semanas, despues, recomendada: true | false | null, cambios }]
export async function rutinas(b, { hoy = fechaMadrid() } = {}) {
  try {
    const atletas = await b.select('atletas', { eq: { modalidad: 'por_su_cuenta' } });
    const suyos = atletas.filter((a) => a.estado === 'activo' && 'esencial_plantilla' in a);
    if (!suyos.length) return [];
    const ids = suyos.map((a) => a.id);
    const [bloques, cuestionarios, { rutinaDe, recomendar }] = await Promise.all([
      b.select('bloques', { in: { atleta_id: ids }, eq: { es_plantilla: false }, cols: 'id,atleta_id,nombre,numero,estado,fecha_inicio' }),
      b.select('cuestionarios', { in: { atleta_id: ids } }).catch(() => []),
      import('../logica/esencial-catalogo.js'),
    ]);
    const semanas = bloques.length ? await b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, cols: 'id,bloque_id,fecha_inicio,programacion' }) : [];
    const out = [];
    for (const a of suyos) {
      const mios = bloques.filter((x) => x.atleta_id === a.id && x.estado !== 'cancelado').sort((x, y) => (y.numero || 0) - (x.numero || 0));
      const actual = mios.find((x) => ['activo', 'ajustado', 'planificado'].includes(x.estado)) || null;
      if (!actual) continue;
      const r = rutinaDe(actual.nombre);
      const c = cuestionarios.find((x) => x.atleta_id === a.id) || null;
      const hechas = semanas.filter((w) => w.bloque_id === actual.id && w.programacion === 'programada' && w.fecha_inicio && String(w.fecha_inicio).slice(0, 10) <= hoy).length;
      // (las de FBE Esencial, «Primeras 4 semanas» y las de novato, son su camino de serie: no se miran)
      const deSerie = !r || ['primeras', 'novato'].includes(r.familia);
      const recomendada = deSerie || !c ? null : recomendar({ cuestionario: c, gustos: c.gustos || {} }).some((x) => x.rutina.nombre === actual.nombre);
      const despues = a.esencial_plantilla && a.esencial_plantilla !== actual.nombre ? a.esencial_plantilla : null;
      out.push({ atleta_id: a.id, nombre: a.nombre, rutina: actual.nombre, titulo: r?.titulo || actual.nombre, inicio: String(actual.fecha_inicio || '').slice(0, 10) || null,
        semanas: hechas, despues, despuesTitulo: despues ? rutinaDe(despues)?.titulo || despues : null, recomendada,
        cambios: Math.max(0, mios.filter((x) => rutinaDe(x.nombre) && x.nombre !== 'Primeras 4 semanas').length - 1) });
    }
    return out.sort((x, y) => (x.recomendada === false ? 0 : 1) - (y.recomendada === false ? 0 : 1) || x.nombre.localeCompare(y.nombre));
  } catch (e) { if (/esencial_plantilla|esencial_catalogo/.test(`${e?.message || ''}`)) return []; throw e; }
}

// ---------- (v0.245, acompañamiento, tanda 4) El porqué de cada semana ----------
// Lo que el motor dice de una semana hecha (base), como al prepararle la siguiente: sus «hechos» (propuestaEsencial().porque)
async function proponer(api, atletaId, atleta, d, base, tipo, hoy) {
  const [{ propuestaEsencial }, esta, previa] = await Promise.all([
    import('../logica/esencial-motor.js'),
    api.checkin(atletaId, base.fecha_inicio).catch(() => null),
    api.checkin(atletaId, sumarDias(base.fecha_inicio, -7)).catch(() => null),
  ]);
  const ids = unicos([...Object.values(d.pautas || {}).flat().map((x) => x.ejercicio_id), ...Object.values(atleta?.esencial_alternativas || {})]);
  const ejercicios = porId(await api.ejerciciosPorIds(ids));
  const r = propuestaEsencial({ d, base, tipo, ejercicios, atleta, hoy,
    checkins: [previa?.checkin, esta?.checkin].filter(Boolean), molestias: (esta?.molestias || []).map((m) => ({ ...m, semana_inicio: base.fecha_inicio })) });
  return { r, ejercicios };
}
const camposDe = (x) => ({ kg: x.carga_sugerida_kg != null ? Number(x.carga_sugerida_kg) : null, min: x.reps_min ?? null, max: x.reps_max ?? null, series: x.series ?? null });
const programadas = (d, bloqueId) => (d.semanas || []).filter((w) => w.bloque_id === bloqueId && w.programacion === 'programada' && w.fecha_inicio).sort((x, y) => x.numero - y.numero);

// «Tu revisión de la semana» y el «¿Por qué?» de cada ejercicio: la semana `semanaId` (o la de hoy) de su bloque, con lo
// que el motor leyó de la anterior, ya casado con lo que tiene delante (por si corrigió algo después: entonces se cuenta
// solo lo que se ve). No guarda nada: se vuelve a calcular con lo que hay apuntado.
// → null (sin plan) | { tipo: 'primera' | 'novato' | 'siguiente', semana, numero, id, inicio, nota, hechas, total,
//     porque: [{ …hecho, pauta_id, sin_motivo? } | { nuevo: true, … }], anteriores: [{ id, numero }] }
export async function revision(api, b, atletaId, { semanaId = null, sesionId = null, hoy = fechaMadrid() } = {}) {
  const [prog, atleta] = await Promise.all([api.programa(atletaId), b.select('atletas', { eq: { id: atletaId } }).then((x) => x[0] || null)]);
  if (!prog?.bloque) return null;
  const [{ pautasDeSemana }, { hechoDe, casa }, { NOMBRE_PRIMERAS_4 }, { semanaDelPlan }, d] = await Promise.all([
    import('../logica/motor/index.js'), import('../logica/esencial-porque.js'), import('../logica/esencial.js'), import('../logica/esencial-lecciones.js'),
    api.bloqueCompleto(prog.bloque.id),
  ]);
  const propias = programadas(d, prog.bloque.id);
  if (sesionId) semanaId = (d.semanas || []).find((w) => (d.sesiones?.[w.id] || []).some((s) => s.id === sesionId))?.id || 'ninguna';
  const nueva = semanaId ? propias.find((w) => w.id === semanaId) : propias.filter((w) => String(w.fecha_inicio).slice(0, 10) <= hoy).pop() || propias[0];
  if (!nueva) return null;
  const inicio = String(nueva.fecha_inicio).slice(0, 10);
  const numero = semanaDelPlan(prog.bloques, inicio) || nueva.numero;
  const comun = { id: nueva.id, inicio, numero, nota: nueva.nota_coach || null,
    anteriores: propias.filter((w) => String(w.fecha_inicio).slice(0, 10) <= hoy).map((w) => ({ id: w.id, numero: semanaDelPlan(prog.bloques, String(w.fecha_inicio).slice(0, 10)) || w.numero })).reverse() };
  // La semana de la que sale: la anterior de su bloque o, si es la primera de un bloque de novato, su semana de marcas
  let base = propias.filter((w) => w.numero < nueva.numero).pop() || null, dBase = d, tipo = 'siguiente';
  if (!base) {
    const previo = [...(prog.bloques || [])].filter((x) => x.id !== prog.bloque.id && x.nombre === NOMBRE_PRIMERAS_4 && x.estado !== 'cancelado' && String(x.fecha_inicio || '') < inicio)
      .sort((x, y) => String(y.fecha_inicio).localeCompare(String(x.fecha_inicio)))[0];
    if (!previo || !/^Novato \d/.test(prog.bloque.nombre || '')) return { ...comun, tipo: 'primera', semana: 'normal', hechas: 0, total: 0, porque: [] };
    dBase = await api.bloqueCompleto(previo.id);
    base = programadas(dBase, previo.id).pop() || null;
    if (!base) return { ...comun, tipo: 'primera', semana: 'normal', hechas: 0, total: 0, porque: [] };
    tipo = 'novato';
  }
  // (como cuando se la preparó: con la fecha de su lunes, o la de hoy si aún no ha llegado)
  const { r, ejercicios } = await proponer(api, atletaId, atleta, dBase, base, tipo, hoy < inicio ? hoy : inicio);
  const suyas = pautasDeSemana(d, nueva);
  const faltan = suyas.pautas.map((p) => p.ejercicio_id).filter((id) => !ejercicios[id]);
  if (faltan.length) Object.assign(ejercicios, porId(await api.ejerciciosPorIds(unicos(faltan))));
  const porque = [];
  suyas.sesiones.forEach((ses, i) => {
    suyas.pautas.filter((p) => p.sesion_id === ses.id).forEach((p) => {
      const h = hechoDe(r.porque, { sesion: i, ejercicioId: p.ejercicio_id });
      const ej = ejercicios[p.ejercicio_id] || {};
      const lugar = { sesion: i, sesion_nombre: ses.nombre || '', pauta_id: p.id, nombre: ej.nombre || h?.nombre || '', por_tiempo: !!ej.por_tiempo };
      if (!h) porque.push({ ...lugar, nuevo: true, ejercicio_id: p.ejercicio_id, nuevo_id: p.ejercicio_id, hecho: [], antes: {}, despues: camposDe(p), frenos: [], semana: r.semana });
      else porque.push({ ...h, ...lugar, despues: camposDe(p), ...(casa(h, p) ? {} : { sin_motivo: true }) });
    });
  });
  const ss = dBase.sesiones?.[base.id] || [];
  return { ...comun, tipo, semana: r.semana, hechas: ss.filter((s) => s.completada).length, total: ss.length, porque };
}

// «Tu sesión, en claro»: lo que el motor lee de cada ejercicio de esa sesión (los hechos de su semana, solo los suyos).
// → null | { guia: true si es de «Primeras 4 semanas» (la app aún no mueve nada), filas: [hecho] }
export async function sesionEnClaro(api, b, atletaId, sesionId, { hoy = fechaMadrid() } = {}) {
  const [prog, atleta] = await Promise.all([api.programa(atletaId), b.select('atletas', { eq: { id: atletaId } }).then((x) => x[0] || null)]);
  if (!prog?.bloque) return null;
  const [{ pautasDeSemana }, { NOMBRE_PRIMERAS_4 }, d] = await Promise.all([import('../logica/motor/index.js'), import('../logica/esencial.js'), api.bloqueCompleto(prog.bloque.id)]);
  const base = (d.semanas || []).find((w) => (d.sesiones?.[w.id] || []).some((s) => s.id === sesionId));
  if (!base) return null;
  const i = pautasDeSemana(d, base).sesiones.findIndex((s) => s.id === sesionId);
  if (i < 0) return null;
  const { r } = await proponer(api, atletaId, atleta, d, base, 'siguiente', hoy);
  return { guia: prog.bloque.nombre === NOMBRE_PRIMERAS_4, filas: (r.porque || []).filter((h) => h.sesion === i) };
}

// ---------- (v0.245; migración 100) Lo que le cuenta a la app: preguntas para el directo ----------
// esencial_notas: una fila por cosa (tipo: 'pregunta_directo'…). Sin la 100: { falta100: true } o [].
const falta100 = falta(/esencial_notas|esencial_respuestas_publicas/, '|42P01');
export async function notas(b, atletaId, tipo) {
  try { return await b.select('esencial_notas', { eq: { atleta_id: atletaId, tipo }, order: [['creada_en', 'desc']] }); } catch (e) { if (falta100(e)) return null; throw e; }
}
export async function anotar(b, atletaId, tipo, { texto = null, datos = {}, desde = null, hasta = null } = {}) {
  try { return (await b.insert('esencial_notas', [{ atleta_id: atletaId, tipo, texto: texto ? String(texto).trim() : null, datos, desde, hasta }]))[0] || null; } catch (e) { if (falta100(e)) return { falta100: true }; throw e; }
}
export async function quitarNota(b, id) {
  try { await b.delete('esencial_notas', { eq: { id } }); return true; } catch (e) { if (falta100(e)) return false; throw e; }
}
// Las dudas del directo que Pelayo ha contestado y hecho públicas (sin quién preguntó): [{ id, pregunta, respuesta, respondida_en }]
export async function respuestasPublicas(b) {
  try { return (await b.rpc('esencial_respuestas_publicas', {})) || []; } catch (e) { if (falta100(e)) return []; throw e; }
}
// (el panel del coach) Las preguntas para el directo, con su nombre: las de los últimos 90 días o sin contestar
export async function preguntasDirecto(b, { hoy = fechaMadrid() } = {}) {
  try {
    const filas = await b.select('esencial_notas', { eq: { tipo: 'pregunta_directo' }, order: [['creada_en', 'desc']] });
    if (!filas.length) return [];
    const at = porId(await b.select('atletas', { in: { id: unicos(filas.map((f) => f.atleta_id)) }, cols: 'id,nombre' }));
    const desde = sumarDias(hoy, -90);
    return filas.filter((f) => !f.respondida_en || String(f.creada_en).slice(0, 10) >= desde).map((f) => ({ ...f, nombre: at[f.atleta_id]?.nombre || '' }));
  } catch (e) { if (falta100(e)) return null; throw e; }
}
export async function responderPregunta(b, id, { respuesta, pregunta_publica = null, publica = false }) {
  const r = String(respuesta || '').trim();
  return (await b.update('esencial_notas', { respuesta: r || null, respondida_en: r ? new Date().toISOString() : null, pregunta_publica: publica && r ? String(pregunta_publica || '').trim() || null : null,
    publica: !!(publica && r && String(pregunta_publica || '').trim()) }, { eq: { id } }))[0] || null;
}

// ---------- (v0.246, acompañamiento, tanda 5) Que no entrenen solos ----------
// «Tu trimestre»: de su bloque, cada ejercicio de su última semana con lo que tenía en la primera (los kilos pautados o, si
// no había, los que movió) y lo que tiene ahora; y cuántas sesiones lleva hechas en total.
// → null | { semanas, sesiones, filas: [{ nombre, por_tiempo, antes: { kg, max }, ahora: { kg, max } }] }
export async function trimestre(api, b, atletaId, { hoy = fechaMadrid() } = {}) {
  const prog = await api.programa(atletaId);
  if (!prog?.bloque) return null;
  const [{ pautasDeSemana }, { semanaDelPlan }, d] = await Promise.all([import('../logica/motor/index.js'), import('../logica/esencial-lecciones.js'), api.bloqueCompleto(prog.bloque.id)]);
  const propias = programadas(d, prog.bloque.id).filter((w) => String(w.fecha_inicio).slice(0, 10) <= hoy);
  if (propias.length < 2) return null;
  const primera = pautasDeSemana(d, propias[0]), ultima = pautasDeSemana(d, propias[propias.length - 1]);
  const ejercicios = porId(await api.ejerciciosPorIds(unicos(ultima.pautas.map((p) => p.ejercicio_id))));
  const movido = (p) => Math.max(0, ...((d.series?.[p.id] || []).map((x) => Number(x.kg) || 0))) || null;
  const filas = [];
  for (const p of ultima.pautas) {
    if (filas.some((f) => f.id === p.ejercicio_id)) continue;
    const a = primera.pautas.find((x) => x.ejercicio_id === p.ejercicio_id) || null;
    const ej = ejercicios[p.ejercicio_id] || {};
    filas.push({ id: p.ejercicio_id, nombre: ej.nombre || '', por_tiempo: !!ej.por_tiempo,
      antes: a ? { kg: a.carga_sugerida_kg != null ? Number(a.carga_sugerida_kg) : movido(a), max: a.reps_max ?? null } : null,
      ahora: { kg: p.carga_sugerida_kg != null ? Number(p.carga_sugerida_kg) : movido(p), max: p.reps_max ?? null } });
  }
  const ultimoLunes = String(propias[propias.length - 1].fecha_inicio).slice(0, 10);
  return { semanas: semanaDelPlan(prog.bloques, ultimoLunes) || propias[propias.length - 1].numero, sesiones: (await hechas(b, atletaId)).length, filas };
}
// Sus sesiones hechas, de todos sus bloques: [{ id, fecha, rpe }], de la más antigua a la última
export async function hechas(b, atletaId) {
  const bloques = await b.select('bloques', { eq: { atleta_id: atletaId, es_plantilla: false }, cols: 'id' });
  const semanas = bloques.length ? await b.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) }, cols: 'id' }) : [];
  if (!semanas.length) return [];
  const ss = await b.select('sesiones', { in: { semana_id: semanas.map((x) => x.id) }, eq: { completada: true }, cols: 'id,fecha_realizada,rpe_sesion' });
  return ss.filter((x) => x.fecha_realizada).map((x) => ({ id: x.id, fecha: String(x.fecha_realizada).slice(0, 10), rpe: x.rpe_sesion ?? null })).sort((x, y) => x.fecha.localeCompare(y.fecha));
}
// (el panel del coach) Quiénes llevan dos semanas seguidas con menos de la mitad de sus sesiones: { atleta_id: true }; y el
// correo de cada uno (para escribirle): { atleta_id: correo }
export async function paraEscribir(b, ids = [], { hoy = fechaMadrid() } = {}) {
  if (!ids.length) return { flojos: {}, correos: {} };
  const [atletas, bloques] = await Promise.all([
    b.select('atletas', { in: { id: ids }, cols: 'id,email' }),
    b.select('bloques', { in: { atleta_id: ids }, eq: { es_plantilla: false }, cols: 'id,atleta_id,estado' }),
  ]);
  const activos = bloques.filter((x) => ['activo', 'ajustado'].includes(x.estado));
  const semanas = activos.length ? await b.select('semanas', { in: { bloque_id: activos.map((x) => x.id) }, cols: 'id,bloque_id,fecha_inicio,programacion,esencial_cierre' }).catch(() => []) : [];
  const lunes = (iso) => { const d = new Date(`${iso}T12:00:00Z`); return sumarDias(iso, -((d.getUTCDay() + 6) % 7)); };
  const pasadas = semanas.filter((w) => w.programacion === 'programada' && w.fecha_inicio && String(w.fecha_inicio).slice(0, 10) < lunes(hoy) && w.esencial_cierre !== 'pausa');
  const ss = pasadas.length ? await b.select('sesiones', { in: { semana_id: pasadas.map((w) => w.id) }, cols: 'id,semana_id,completada' }) : [];
  const flojos = {};
  for (const bl of activos) {
    const suyas = pasadas.filter((w) => w.bloque_id === bl.id).sort((x, y) => String(y.fecha_inicio).localeCompare(String(x.fecha_inicio))).slice(0, 2);
    if (suyas.length < 2) continue;
    const floja = (w) => { const xs = ss.filter((s) => s.semana_id === w.id); return xs.length >= 2 && xs.filter((s) => s.completada).length * 2 < xs.length; };
    if (suyas.every(floja)) flojos[bl.atleta_id] = true;
  }
  return { flojos, correos: Object.fromEntries(atletas.map((a) => [a.id, a.email || null])) };
}
// El reto de la semana: las cifras de FBE Esencial (sin la 100, o con menos de cinco, null)
export async function equipoSemana(b) {
  try { return (await b.rpc('esencial_equipo_semana', {})) || null; } catch (e) { if (falta(/esencial_equipo_semana/)(e)) return null; throw e; }
}
// (el panel del coach) Las notas de «¿Cómo vamos?», con su nombre
export async function comoVamos(b) {
  try {
    const filas = await b.select('esencial_notas', { eq: { tipo: 'como_vamos' }, order: [['creada_en', 'desc']] });
    if (!filas.length) return [];
    const at = porId(await b.select('atletas', { in: { id: unicos(filas.map((f) => f.atleta_id)) }, cols: 'id,nombre' }));
    return filas.map((f) => ({ ...f, nombre: at[f.atleta_id]?.nombre || '' }));
  } catch (e) { if (falta100(e)) return null; throw e; }
}
