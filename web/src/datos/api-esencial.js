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
