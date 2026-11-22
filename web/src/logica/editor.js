// (v0.184) Las cuentas del editor manual del programa, sin pantallas ni base de datos: deshacer, valores de partida de
// un ejercicio nuevo, «como la semana pasada», «lo que hizo», subir o bajar con el salto, igualar series y reordenar.
import { REGLAS_FBE, rangoDe, saltoDe } from './motor/index.js';
import { tieneDetalle } from './calculos.js';
// (v0.207) las notas por ejercicio y quién queda por programar, en editor-notas.js (la capa de datos las usa y así no
// carga el motor al abrir la app)
export { leerNotaEjercicio, escribirNotaEjercicio, notasPorEjercicio, porProgramar } from './editor-notas.js';

// Los campos de la prescripcion de un ejercicio (lo que cambian los atajos y lo que se guarda para deshacer)
export const CAMPOS_PAUTA = ['series', 'reps_min', 'reps_max', 'rir_objetivo', 'rpe_objetivo', 'carga_sugerida_kg', 'backoff_pct', 'series_detalle'];

const NOMBRE_CAMPO = {
  series: 'Series', reps_min: 'Repeticiones', reps_max: 'Repeticiones', rir_objetivo: 'RIR', rpe_objetivo: 'RPE', carga_sugerida_kg: 'Kilos',
  backoff_pct: 'Tipo de series', series_detalle: 'Serie a serie', descanso_seg: 'Descanso', prioridad: 'Prioridad', superserie: 'Superserie',
  variante: 'Variante', tempo: 'Tempo', notas_coach: 'Nota', ejercicio_id: 'Ejercicio', nombre: 'Nombre', tipo: 'Tipo', intencion: 'Intención',
  dinamica: 'Dinámica', foco: 'Foco', nota_coach: 'Nota de la semana', objetivo: 'Objetivo', fecha_inicio: 'Fecha', cardio: 'Cardio',
};

// La fila de una tabla dentro de lo cargado del bloque (o null)
export function filaDe(d, tabla, id) {
  if (!d) return null;
  if (tabla === 'bloques') return d.bloque?.id === id ? d.bloque : null;
  if (tabla === 'semanas') return (d.semanas || []).find((s) => s.id === id) || null;
  const grupos = tabla === 'sesiones' ? d.sesiones : tabla === 'sesion_ejercicios' ? d.pautas : null;
  if (!grupos) return null;
  for (const lista of Object.values(grupos)) { const f = lista.find((x) => x.id === id); if (f) return f; }
  return null;
}

// Lo que habia en esos campos antes del cambio (para deshacerlo). null si no hay nada que deshacer.
export function antesDe(d, tabla, id, campos) {
  const fila = filaDe(d, tabla, id);
  if (!fila) return null;
  const antes = {};
  let cambia = false;
  for (const c of Array.isArray(campos) ? campos : Object.keys(campos)) {
    antes[c] = fila[c] ?? null;
    if (!Array.isArray(campos) && JSON.stringify(antes[c]) !== JSON.stringify(campos[c] ?? null)) cambia = true;
  }
  return Array.isArray(campos) || cambia ? antes : null;
}

// «Kilos de Sentadilla», «Nombre de la sesion»: lo que dice el boton de deshacer
export function etiquetaCambio(tabla, cambios, nombre = '') {
  const campos = Object.keys(cambios || {});
  const que = campos.length > 2 ? 'Cambios' : NOMBRE_CAMPO[campos[0]] || 'Cambio';
  const donde = tabla === 'sesion_ejercicios' ? (nombre ? ` de ${nombre}` : '') : tabla === 'sesiones' ? ' de la sesión' : tabla === 'semanas' ? ' de la semana' : tabla === 'bloques' ? ' del bloque' : '';
  return `${que}${donde}`;
}

// La pila de deshacer: como mucho `max` pasos, el ultimo arriba
export function apilar(pila, paso, max = 30) { return [...pila, paso].slice(-max); }
// Al volver a crear un ejercicio borrado nace con otro id: los pasos que hablaban del viejo pasan al nuevo
export function cambiarId(pila, viejo, nuevo) {
  return pila.map((x) => (x.id === viejo ? { ...x, id: nuevo } : x.fila?.id === viejo ? { ...x, fila: { ...x.fila, id: nuevo } } : x));
}

// Valores de partida de un ejercicio nuevo: el rango de la tabla FBE (tipo y prioridad), tres series y el descanso
// segun el tipo. Lo demas, como siempre (prioridad media, RIR 2).
export function tipoDe(ejercicio) {
  const t = Array.isArray(ejercicio?.tipo) ? ejercicio.tipo : [];
  return t.includes('basico') ? 'basico' : t[0] === 'aislamiento' ? 'aislamiento' : 'multiarticular';
}
export const DESCANSO_TIPO = { basico: 180, multiarticular: 120, aislamiento: 90 };
export function basePauta(ejercicio, reglas = REGLAS_FBE) {
  const prioridad = 'media';
  const r = rangoDe({ pauta: { prioridad }, ejercicio, reglas });
  const rango = Array.isArray(r) && r.length === 2 ? r : [8, 10];
  return { prioridad, series: 3, reps_min: rango[0], reps_max: rango[1], descanso_seg: DESCANSO_TIPO[tipoDe(ejercicio)] };
}

// «Como la semana pasada»: la prescripcion de la pauta anterior, tal cual
export function comoLaAnterior(previa) {
  const c = Object.fromEntries(CAMPOS_PAUTA.map((k) => [k, previa?.[k] ?? null]));
  if (!tieneDetalle(previa)) c.series_detalle = null;
  return c;
}

// «Lo que hizo»: una fila por serie hecha (repeticiones, kilos y RPE), en su orden. null si no hizo ninguna.
export function detalleDeHechas(hechas = []) {
  const filas = [...hechas].sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0))
    .map((x) => ({ reps: x.reps != null ? Number(x.reps) : null, kg: x.kg != null ? Number(x.kg) : null, rpe: x.rpe != null ? Number(x.rpe) : x.rir != null ? 10 - Number(x.rir) : null }))
    .filter((x) => x.reps != null || x.kg != null);
  return filas.length ? filas.slice(0, 20) : null;
}

// Subir o bajar un numero un paso: de vacio se parte de 0 al subir; nunca baja de 0. Devuelve el numero o null.
export function pasoDe(valor, paso, dir, { min = 0, max = 9999 } = {}) {
  const t = String(valor ?? '').replace(',', '.').trim();
  const v = t === '' ? null : Number(t);
  if (v != null && Number.isNaN(v)) return null;
  if (v == null) return dir > 0 ? Math.min(max, paso) : null;
  const n = Math.round((v + dir * paso) * 100) / 100;
  return Math.max(min, Math.min(max, n));
}
// El salto de kilos de un ejercicio con las reglas del atleta (2,5 de partida; las mancuernas, las de su gimnasio)
export function saltoKg(nombre, kg, reglas = REGLAS_FBE) { return saltoDe(nombre || '', Number(kg) || 0, reglas || REGLAS_FBE); }

// «Copiar la serie 1 a las demas»
export function igualarSeries(detalle = []) {
  if (!detalle.length) return detalle;
  const { reps = null, kg = null, rpe = null } = detalle[0];
  return detalle.map(() => ({ reps, kg, rpe }));
}

// Mover el elemento `de` a la posicion `a` (indices de la lista)
export function reordenar(lista, de, a) {
  if (de === a || de < 0 || de >= lista.length) return lista;
  const copia = [...lista];
  const [x] = copia.splice(de, 1);
  copia.splice(Math.max(0, Math.min(copia.length, a)), 0, x);
  return copia;
}

// «6 ejercicios · 18 series» (o «Cardio», o «Vacia»): la linea de una sesion plegada
export function resumenSesion(sesion, pautas = []) {
  const n = pautas.length;
  const series = pautas.reduce((t, p) => t + (Number(p.series) || 0), 0);
  const partes = [];
  if (n) partes.push(`${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}`, `${series} ${series === 1 ? 'serie' : 'series'}`);
  if (sesion?.tipo === 'cardio' || sesion?.cardio) partes.push('cardio');
  return partes.length ? partes.join(' · ') : 'vacía';
}

// =====================================================================================================================
// (v0.185) Segunda tanda: revisar antes de publicar, que cambia de una semana a otra, llevar un cambio a las semanas
// siguientes, el orden del buscador y las notas frecuentes.
// =====================================================================================================================

const numero = (v) => (v == null || v === '' ? null : Number(v));
const fmt = (v) => String(Math.round(Number(v) * 100) / 100).replace('.', ',');
const rangoTxt = (p) => (p.reps_min != null && p.reps_max != null && Number(p.reps_min) !== Number(p.reps_max) ? `${p.reps_min}–${p.reps_max}` : `${p.reps_max ?? p.reps_min ?? '–'}`);
// Los kilos «de trabajo» de una pauta: los de su casilla o, serie a serie, los mas altos
export function kilosDe(p) {
  if (tieneDetalle(p)) { const ks = p.series_detalle.map((x) => numero(x.kg)).filter((k) => k != null && k > 0); return ks.length ? Math.max(...ks) : null; }
  const k = numero(p?.carga_sugerida_kg);
  return k != null && k > 0 ? k : null;
}

// Lo que parece un despiste antes de publicar. No impide nada: se ensena y el coach decide.
//   sesiones: las de la semana; pautas: { sesionId: [pauta] }; previas: { pautaId: { pauta } } (su pareja de la semana
//   anterior); nombres: { ejercicioId: nombre }; foco: el de la semana; saltoPct: a partir de que cambio de kilos avisa
export const SALTO_AVISO_PCT = 20;
export function revisarSemana({ sesiones = [], pautas = {}, previas = {}, nombres = {}, foco = null, saltoPct = SALTO_AVISO_PCT,
  evitados = {}, grupos = {}, anteriores = [], nombresGrupo = {} } = {}) {
  const avisos = [];
  const di = (sesion, texto, pautaId = null) => avisos.push({ sesion: sesion?.nombre || '', texto, pautaId });
  if (!sesiones.length) { avisos.push({ sesion: '', texto: 'La semana no tiene ninguna sesión.', pautaId: null }); return avisos; }
  for (const s of sesiones) {
    const lista = pautas[s.id] || [];
    const conCardio = s.tipo === 'cardio' || !!s.cardio;
    if (!lista.length && !conCardio && !String(s.dinamica || '').trim() && !s.video_url) di(s, 'Está vacía: sin ejercicios, cardio ni indicaciones.');
    // (v0.186) el mismo ejercicio dos veces en la sesion (un duplicado que se quedo)
    const veces = {};
    for (const p of lista) if (p.ejercicio_id) veces[p.ejercicio_id] = (veces[p.ejercicio_id] || 0) + 1;
    for (const [id, k] of Object.entries(veces)) if (k > 1) di(s, `${nombres[id] || 'Un ejercicio'} está ${k} veces.`);
    for (const p of lista) {
      const n = nombres[p.ejercicio_id] || 'Un ejercicio';
      if (!p.ejercicio_id) di(s, 'Hay una fila sin ejercicio elegido.', p.id);
      // (v0.186) lo que el atleta prefiere evitar, y los kilos que la semana pasada tenia y esta no
      if (evitados[p.ejercicio_id]) di(s, `${n}: lo tiene entre lo que prefiere evitar.`, p.id);
      if (previas[p.id]?.pauta && kilosDe(previas[p.id].pauta) != null && kilosDe(p) == null && !tieneDetalle(p)) di(s, `${n}: la semana pasada llevaba kilos (${fmt(kilosDe(previas[p.id].pauta))} kg) y esta no.`, p.id);
      if (!(Number(p.series) > 0)) di(s, `${n}: sin series.`, p.id);
      const a = numero(p.reps_min), b = numero(p.reps_max);
      if (a != null && b != null && a > b) di(s, `${n}: el rango está al revés (de ${a} a ${b}).`, p.id);
      const reps = tieneDetalle(p) ? p.series_detalle.map((x) => numero(x.reps)) : [a, b];
      if (reps.some((r) => r != null && r > 30)) di(s, `${n}: ${Math.max(...reps.filter((r) => r != null))} repeticiones. ¿Son kilos?`, p.id);
      const rpes = tieneDetalle(p) ? p.series_detalle.map((x) => numero(x.rpe)) : [numero(p.rpe_objetivo)];
      if (rpes.some((r) => r != null && (r > 10 || r < 4))) di(s, `${n}: RPE ${fmt(rpes.find((r) => r != null && (r > 10 || r < 4)))}. ¿Es lo que querías?`, p.id);
      const kg = kilosDe(p), antes = previas[p.id]?.pauta ? kilosDe(previas[p.id].pauta) : null;
      if (kg != null && antes != null && antes > 0) {
        const pct = ((kg - antes) / antes) * 100;
        if (pct > saltoPct) di(s, `${n}: de ${fmt(antes)} a ${fmt(kg)} kg (+${Math.round(pct)} %).`, p.id);
        else if (pct < -saltoPct && foco !== 'descarga') di(s, `${n}: de ${fmt(antes)} a ${fmt(kg)} kg (−${Math.round(-pct)} %).`, p.id);
      }
    }
  }
  // (v0.186) un musculo que la semana pasada tenia series y esta se queda sin ninguna
  if (anteriores.length && foco !== 'descarga') {
    const cuenta = (ps) => { const c = {}; for (const p of ps) for (const g of grupos[p.ejercicio_id] || []) c[g] = (c[g] || 0) + (Number(p.series) || 0); return c; };
    const antes = cuenta(anteriores), ahora = cuenta(sesiones.flatMap((x) => pautas[x.id] || []));
    for (const [g, k] of Object.entries(antes)) if (k > 0 && !(ahora[g] > 0)) avisos.push({ sesion: '', texto: `Esta semana no hay ninguna serie de ${(nombresGrupo[g] || g).toLowerCase()} (la pasada, ${k}).`, pautaId: null });
  }
  return avisos;
}

// Que cambia de la semana anterior a esta: una linea por ejercicio que cambia, mas los nuevos y los que ya no estan.
//   actuales: [pauta] de esta semana (en orden); previas: { pautaId: { pauta } }; anteriores: [pauta] de la semana
//   anterior; nombres. Devuelve [{ tipo: 'cambia'|'nuevo'|'quitado', nombre, texto }]
export function cambiosDeSemana({ actuales = [], previas = {}, anteriores = [], nombres = {} } = {}) {
  const out = [];
  const usadas = new Set();
  for (const p of actuales) {
    const nombre = nombres[p.ejercicio_id] || 'Ejercicio';
    const a = previas[p.id]?.pauta;
    if (!a) { out.push({ tipo: 'nuevo', nombre, texto: `nuevo (${p.series} × ${rangoTxt(p)})` }); continue; }
    usadas.add(a.id);
    const partes = [];
    const ka = kilosDe(a), kb = kilosDe(p);
    if (ka !== kb) partes.push(ka == null ? `${fmt(kb)} kg (antes sin kilos)` : kb == null ? `sin kilos (antes ${fmt(ka)} kg)` : `${fmt(ka)} → ${fmt(kb)} kg`);
    if (Number(a.series) !== Number(p.series)) { const dif = Number(p.series) - Number(a.series); partes.push(Math.abs(dif) === 1 ? (dif > 0 ? 'una serie más' : 'una serie menos') : `${a.series} → ${p.series} series`); }
    if (rangoTxt(a) !== rangoTxt(p)) partes.push(`${rangoTxt(a)} → ${rangoTxt(p)} reps`);
    const ra = numero(a.rpe_objetivo), rb = numero(p.rpe_objetivo);
    if (ra !== rb && !tieneDetalle(p) && !tieneDetalle(a)) partes.push(`RPE ${ra == null ? '–' : fmt(ra)} → ${rb == null ? '–' : fmt(rb)}`);
    const ia = numero(a.rir_objetivo), ib = numero(p.rir_objetivo);
    if (ia !== ib) partes.push(`RIR ${ia == null ? '–' : fmt(ia)} → ${ib == null ? '–' : fmt(ib)}`);
    if (tieneDetalle(a) !== tieneDetalle(p)) partes.push(tieneDetalle(p) ? 'ahora serie a serie' : 'ahora series iguales');
    else if (tieneDetalle(p) && !partes.length && JSON.stringify(a.series_detalle) !== JSON.stringify(p.series_detalle)) partes.push('cambian sus series');
    if ((a.prioridad || '') !== (p.prioridad || '')) partes.push('otra prioridad');
    if (partes.length) out.push({ tipo: 'cambia', nombre, texto: partes.join(' · ') });
  }
  for (const a of anteriores) if (!usadas.has(a.id)) out.push({ tipo: 'quitado', nombre: nombres[a.ejercicio_id] || 'Ejercicio', texto: 'ya no está' });
  return out;
}

// Llevar un cambio a las semanas siguientes. En cada semana posterior, el ejercicio que le corresponde: en la sesion
// del mismo puesto, el mismo ejercicio; si no (lo acabas de sustituir aqui), el que ocupa su mismo puesto.
//   d: lo cargado del bloque; pauta: la de esta semana; semana: la suya. Devuelve [{ semana, pauta, conSeries }]
export function parejasSiguientes(d, pauta, semana) {
  const sesionAqui = filaDe(d, 'sesiones', pauta.sesion_id);
  if (!sesionAqui || !semana) return [];
  const puesto = (d.pautas[pauta.sesion_id] || []).findIndex((x) => x.id === pauta.id);
  const out = [];
  for (const w of d.semanas || []) {
    if (!(w.numero > semana.numero)) continue;
    const ses = (d.sesiones[w.id] || []).find((x) => x.orden === sesionAqui.orden) || (d.sesiones[w.id] || []).find((x) => x.nombre === sesionAqui.nombre);
    if (!ses) continue;
    const lista = d.pautas[ses.id] || [];
    const suya = lista.find((x) => x.ejercicio_id === pauta.ejercicio_id) || lista[puesto] || null;
    if (suya) out.push({ semana: w, pauta: suya, conSeries: (d.series?.[suya.id] || []).length > 0 });
  }
  return out;
}
// Que se puede llevar: cada opcion con los campos que copia
export const LLEVAR = [
  ['ejercicio', 'El ejercicio', ['ejercicio_id']],
  ['variante', 'Variante y tempo', ['variante', 'tempo']],
  ['nota', 'La nota para el atleta', ['notas_coach']],
  ['descanso', 'El descanso', ['descanso_seg']],
  ['prioridad', 'Prioridad y superserie', ['prioridad', 'superserie']],
  ['pauta', 'Series, repeticiones, esfuerzo y kilos', CAMPOS_PAUTA],
];
// Los cambios para una pareja: solo lo marcado y solo lo que de verdad cambia. Con series registradas no se le cambia
// el ejercicio (lo hecho quedaria apuntado a otro). null si no hay nada que cambiar.
export function cambiosParaPareja(pauta, pareja, marcados = []) {
  const c = {};
  for (const [clave, , campos] of LLEVAR) {
    if (!marcados.includes(clave)) continue;
    if (clave === 'ejercicio' && pareja.conSeries) continue;
    for (const k of campos) if (JSON.stringify(pauta[k] ?? null) !== JSON.stringify(pareja.pauta[k] ?? null)) c[k] = pauta[k] ?? null;
  }
  return Object.keys(c).length ? c : null;
}

// El buscador: primero los ultimos que has puesto, luego los que ya salen en este bloque (de mas a menos), luego el
// resto en su orden. Devuelve [{ ejercicio, marca: 'reciente'|'bloque'|null }]
export function ordenBuscador(lista = [], { recientes = [], usos = {} } = {}) {
  const pos = Object.fromEntries(recientes.map((id, k) => [id, k]));
  const peso = (e) => (e.id in pos ? [0, pos[e.id]] : usos[e.id] ? [1, -usos[e.id]] : [2, 0]);
  return lista.map((e, k) => ({ e, k, w: peso(e) })).sort((a, b) => a.w[0] - b.w[0] || a.w[1] - b.w[1] || a.k - b.k)
    .map(({ e, w }) => ({ ejercicio: e, marca: w[0] === 0 ? 'reciente' : w[0] === 1 ? 'bloque' : null }));
}
export function conReciente(recientes = [], id, max = 8) { return [id, ...recientes.filter((x) => x !== id)].slice(0, max); }
// Cuantas veces sale cada ejercicio en el bloque
export function usosEnBloque(d) {
  const usos = {};
  for (const lista of Object.values(d?.pautas || {})) for (const p of lista) if (p.ejercicio_id) usos[p.ejercicio_id] = (usos[p.ejercicio_id] || 0) + 1;
  return usos;
}

// Las notas que mas repites (las del bloque y las ultimas que has escrito), sin repetidos, las mas usadas primero
export function notasFrecuentes(d, guardadas = [], max = 12) {
  const cuenta = new Map();
  for (const lista of Object.values(d?.pautas || {})) for (const p of lista) { const t = String(p.notas_coach || '').trim(); if (t && t.length <= 160) cuenta.set(t, (cuenta.get(t) || 0) + 1); }
  const delBloque = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  return [...new Set([...guardadas.map((t) => String(t || '').trim()).filter(Boolean), ...delBloque])].slice(0, max);
}
export function conNota(guardadas = [], texto, max = 12) { const t = String(texto || '').trim(); return t && t.length <= 160 ? [t, ...guardadas.filter((x) => x !== t)].slice(0, max) : guardadas; }

// El historial de un ejercicio para el editor: sus ultimas `n` sesiones (de la mas reciente a la mas antigua) con lo
// que hizo y su mejor serie. sesiones: las de resumenEjercicio(); pautadas: { sesionId: pauta } de este bloque.
export function historialParaEditor(sesiones = [], pautadas = {}, n = 6) {
  return sesiones.slice(0, n).map((s) => ({ fecha: s.fecha, series: s.series || [], mejor: s.mejor ?? null, top: s.top || null, record: !!s.record, pauta: (s.sesion_id && pautadas[s.sesion_id]) || null }));
}

// =====================================================================================================================
// (v0.186) Tercera tanda: como le fue cada sesion, la nota solo para el coach y el candado de un ejercicio, el 1RM
// estimado junto a los kilos, quien queda por programar y los cambios que esperan a que vuelva la conexion.
// =====================================================================================================================

// Como le fue una sesion: «hecha el 10/11 · 62 min · esfuerzo 8/10 · 18 series · 2 comentarios». null si no la hizo.
//   sesion: la fila; series: cuantas registro; comentarios: cuantos escribio el; fecha: (iso) => texto
export function comoLeFue(sesion, { series = 0, comentarios = 0, fecha = (x) => x } = {}) {
  if (!sesion?.completada) return null;
  const partes = [sesion.fecha_realizada ? `hecha el ${fecha(sesion.fecha_realizada)}` : 'hecha'];
  if (Number(sesion.duracion_min) > 0) partes.push(`${Math.round(Number(sesion.duracion_min))} min`);
  if (sesion.rpe_sesion != null) partes.push(`esfuerzo ${fmt(sesion.rpe_sesion)}/10`);
  if (series > 0) partes.push(`${series} ${series === 1 ? 'serie' : 'series'}`);
  if (comentarios > 0) partes.push(`${comentarios} ${comentarios === 1 ? 'comentario suyo' : 'comentarios suyos'}`);
  return { texto: partes.join(' · '), nota: String(sesion.nota_atleta || '').trim() || null };
}
// La sesion de la semana anterior que corresponde a esta: de la que salen mas de sus ejercicios (previas) o, si no hay
// ninguno emparejado, la del mismo nombre
export function sesionPrevia(sesion, pautas = [], previas = {}, sesionesAnt = []) {
  const votos = {};
  for (const p of pautas) { const sid = previas[p.id]?.pauta?.sesion_id; if (sid) votos[sid] = (votos[sid] || 0) + 1; }
  const mejor = Object.entries(votos).sort((a, b) => b[1] - a[1])[0];
  return (mejor && sesionesAnt.find((x) => String(x.id) === String(mejor[0]))) || sesionesAnt.find((x) => x.nombre === sesion?.nombre) || null;
}

// «70 kg es el 82 % de su mejor 1RM estimado (85 kg)». null si no hay con que comparar.
export function pctDeRm(kg, mejor) {
  const k = numero(kg), m = numero(mejor);
  if (!(k > 0) || !(m > 0)) return null;
  return { pct: Math.round((k / m) * 100), mejor: Math.round(m * 10) / 10 };
}

// Los cambios que no se pudieron guardar por la conexion: uno por fila, con lo ultimo que se escribio en cada campo
export function conPendiente(lista, tabla, id, cambios) {
  const k = lista.findIndex((x) => x.tabla === tabla && x.id === id);
  if (k < 0) return [...lista, { tabla, id, cambios: { ...cambios } }];
  return lista.map((x, i) => (i === k ? { ...x, cambios: { ...x.cambios, ...cambios } } : x));
}
export function sinPendiente(lista, tabla, id) { return lista.filter((x) => !(x.tabla === tabla && x.id === id)); }
