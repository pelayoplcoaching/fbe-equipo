// (v0.184) Las cuentas del editor manual del programa, sin pantallas ni base de datos: deshacer, valores de partida de
// un ejercicio nuevo, «como la semana pasada», «lo que hizo», subir o bajar con el salto, igualar series y reordenar.
import { REGLAS_FBE, rangoDe, saltoDe } from './motor/index.js';
import { tieneDetalle } from './calculos.js';

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
