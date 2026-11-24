// «Programar según FBE», paso 2: los modelos. Cada uno convierte el diagnóstico de un ejercicio en la pauta de la
// semana siguiente, con su motivo y hasta dos alternativas de un toque. Fase 0: progresión serie a serie (el modelo
// de partida), doble progresión, triple progresión, lineal y solo repeticiones, más «mantener» y «a mano».
//
// Lo que devuelve un modelo:
//   tipo         'subir' | 'reps' | 'series' | 'mantener' | 'bajar' | 'tope' | 'peaking' (menos repeticiones, mismos kilos) | 'sin_tocar'
//   propuesta    los campos de la pauta nueva (ver CAMPOS)
//   motivo       una frase para el coach
//   orientativa  kilos a los que apunta cuando la pauta no lleva carga (el atleta la elige)
//   alternativas [{ id, etiqueta, propuesta }]
//   avisos       ['…'] cosas que el coach debería mirar
import { num, tieneDetalle, limpiarDetalle, agregadosDetalle, esTopBackoff, enReserva, cargaBackoff } from '../calculos.js';
import { modoCarga } from '../nivel.js';
import { saltoDe, objetivoReserva, SIN_DATOS } from './lectura.js';
import { esBasico, movimientoDe, REGLAS_FBE } from './reglas.js';
import { estructuraTop, topPeaking } from './topset.js';

export const CAMPOS = ['series', 'reps_min', 'reps_max', 'rir_objetivo', 'rpe_objetivo', 'carga_sugerida_kg', 'backoff_pct', 'series_detalle'];
// Los campos de una pauta que el motor puede tocar, copiados (el detalle, serie a serie)
export const campos = (p) => Object.fromEntries(CAMPOS.map((c) => [c, c === 'series_detalle' && Array.isArray(p[c]) ? p[c].map((x) => ({ ...x })) : p[c] ?? null]));

const dos = (x) => Math.round(x * 100) / 100;
const kilos = (x) => `${num(x, 2)} kg`;
const alt = (id, etiqueta, propuesta) => ({ id, etiqueta, propuesta });
const conDetalle = (pauta, d) => { const limpio = limpiarDetalle(d); return limpio ? { ...campos(pauta), series_detalle: limpio, ...agregadosDetalle(limpio) } : campos(pauta); };
const llevaKilos = (pauta) => (tieneDetalle(pauta) ? pauta.series_detalle.some((x) => x.kg != null) : pauta.carga_sugerida_kg != null);
const rango = (l) => (l.repsMin != null && l.repsMin !== l.repsMax ? `${l.repsMin}–${l.repsMax}` : `${l.repsMax}`);
const enCuantas = (l) => (l.top ? 'la serie top' : l.n === 1 ? 'la serie' : l.alTope >= l.n ? `las ${l.n} series` : `${l.alTope} de ${l.n} series`);

// La carga de la que se parte: la que movió de verdad; si no hay, la pautada
const cargaBase = (l, pauta) => (l.kgTrabajo > 0 ? l.kgTrabajo : pauta.carga_sugerida_kg != null ? Number(pauta.carga_sugerida_kg) : 0);

// ---------- «Por su cuenta»: los frenos aprobados por Pelayo el 24/11/2026 ----------
// Solo actúan con ctx.porSuCuenta (atletas sin seguimiento); con seguimiento todo sigue igual.
//   1. Si movió menos kilos de los pautados, la propuesta parte de lo que hizo.
//   2. Si lo apuntado parece una errata, se pregunta al atleta antes de proponer (en proponer.js).
//   3. Nunca por debajo del mínimo del rango, tampoco en la serie pesada: si con el salto no llega, una repetición más.
//   4. Dos semanas por debajo del rango sin avanzar: baja la carga un salto y vuelve al mínimo.
// Freno 1: la pauta con los kilos de cada serie bajados a los que movió, si movió menos. Sin el modo, la pauta tal cual.
export function desdeLoHecho(l, pauta, ctx = {}) {
  if (!ctx?.porSuCuenta) return campos(pauta);
  if (tieneDetalle(pauta)) {
    const hechas = Object.fromEntries((l?.hechas || []).map((s) => [Number(s.numero), s]));
    let baja = false;
    const d = pauta.series_detalle.map((o, i) => {
      const kg = Number(hechas[i + 1]?.kg) > 0 ? Number(hechas[i + 1].kg) : 0;
      if (o.kg != null && kg > 0 && kg < Number(o.kg) - 0.001) { baja = true; return { ...o, kg: dos(kg) }; }
      return { ...o };
    });
    return baja ? conDetalle(pauta, d) : campos(pauta);
  }
  const kg = l?.kgTrabajo || 0;
  return pauta.carga_sugerida_kg != null && kg > 0 && kg < Number(pauta.carga_sugerida_kg) - 0.001 ? { ...campos(pauta), carga_sugerida_kg: dos(kg) } : campos(pauta);
}

// Red de seguridad del modo (en proponer.js, para cualquier modelo y tipo de semana): ninguna serie más de un salto por
// encima de lo que movió en ella. Si la fila no sube, la serie que se pasaba se queda en lo que movió. Devuelve la
// propuesta corregida (serie a serie si hace falta, con las repeticiones que hizo en esas series) o null si ya cumple.
export function unSaltoComoMucho(propuesta, l, { nombre = '', reglas, sube = false } = {}) {
  if (!propuesta) return null;
  const hechas = Object.fromEntries((l?.hechas || []).map((s) => [Number(s.numero), s]));
  const detalle = tieneDetalle(propuesta);
  const kgP = propuesta.carga_sugerida_kg != null ? Number(propuesta.carga_sugerida_kg) : null;
  const n = detalle ? propuesta.series_detalle.length : Math.max(1, Number(propuesta.series) || 1);
  let toca = false;
  const d = Array.from({ length: n }, (_, i) => {
    const o = detalle ? { ...propuesta.series_detalle[i] } : { reps: propuesta.reps_max ?? propuesta.reps_min ?? null,
      kg: kgP == null ? null : i > 0 && esTopBackoff(propuesta) ? cargaBackoff(kgP, propuesta.backoff_pct, nombre) ?? kgP : kgP,
      ...(propuesta.rpe_objetivo != null ? { rpe: Number(propuesta.rpe_objetivo) } : {}) };
    const h = hechas[i + 1], hkg = Number(h?.kg) > 0 ? Number(h.kg) : 0;
    if (o.kg == null || !(hkg > 0)) return o;
    const paso = saltoDe(nombre, hkg, reglas);
    if (Number(o.kg) <= hkg + paso + 0.001) return o;
    toca = true;
    return { ...o, kg: dos(hkg + (sube ? paso : 0)), ...(detalle ? {} : { reps: Number(h.reps) || o.reps }) };
  });
  return toca ? conDetalle({ ...propuesta, backoff_pct: null }, d) : null;
}

// La misma pauta, con la carga puesta en lo que movió (si la pauta lleva kilos)
function mantenerEn(l, pauta, ctx = {}) {
  if (tieneDetalle(pauta)) return desdeLoHecho(l, pauta, ctx);
  const kg = cargaBase(l, pauta);
  return { ...campos(pauta), carga_sugerida_kg: pauta.carga_sugerida_kg != null && kg > 0 ? dos(kg) : pauta.carga_sugerida_kg ?? null };
}

// Sube (saltos > 0) o baja (saltos < 0) la carga. null si no hay kilos que mover.
function moverKg(l, pauta, ctx, saltos, pct = null) {
  const { nombre, reglas } = ctx;
  const nuevo = (kg) => {
    const paso = saltoDe(nombre, kg, reglas);
    if (pct == null) return dos(Math.max(0, kg + saltos * paso));
    let t = Math.round((kg * (1 - pct / 100)) / paso) * paso;
    if (t >= kg) t = kg - paso;
    return dos(Math.max(0, t));
  };
  if (tieneDetalle(pauta)) {
    if (!llevaKilos(pauta)) return l.kgTrabajo > 0 ? { propuesta: campos(pauta), orientativa: nuevo(l.kgTrabajo), delta: dos(nuevo(l.kgTrabajo) - l.kgTrabajo) } : null;
    let delta = 0;
    const d = pauta.series_detalle.map((o, i) => {
      if (o.kg == null) return { ...o };
      const fila = l.porSerie?.[i];
      const hecho = fila?.h && Number(fila.h.kg) > 0 ? Number(fila.h.kg) : 0;
      // Si cumplió la serie con más kilos de los pautados, se parte de los suyos
      const base = saltos > 0 && fila?.estado === 'cumplida' && hecho > Number(o.kg) ? hecho
        // (por su cuenta, freno 1) si movió menos de lo pautado, también: para subir y para bajar
        : ctx.porSuCuenta && hecho > 0 && hecho < Number(o.kg) - 0.001 ? hecho : Number(o.kg);
      const kg = nuevo(base);
      if (kg <= 0 && saltos < 0) return { ...o };
      delta = delta || dos(kg - Number(o.kg));
      return { ...o, kg };
    });
    return { propuesta: conDetalle(pauta, d), orientativa: null, delta };
  }
  const base = cargaBase(l, pauta);
  if (!(base > 0)) return null;
  const kg = nuevo(base);
  if (saltos < 0 && kg <= 0) return null;
  return { propuesta: { ...campos(pauta), carga_sugerida_kg: pauta.carga_sugerida_kg != null ? kg : null }, orientativa: pauta.carga_sugerida_kg != null ? null : kg, delta: dos(kg - base) };
}
const textoSubida = (m) => (m.orientativa != null ? `le toca subir (orientativo: ${kilos(m.orientativa)})` : `sube ${kilos(m.delta)}`);

// Sin nada fiable con lo que decidir: la pauta se queda como está
function sinDatos(l, pauta, ctx = {}) {
  const igual = desdeLoHecho(l, pauta, ctx);
  const motivo = {
    a_medias: `Hizo ${l.hechas.length} de ${l.n} series: se mantiene`,
    cambiado: 'Lo cambió por otro ejercicio: no se toca',
    sin_registrar: 'Sin registrar: se mantiene la pauta',
    dato_raro: `Lo apuntado parece una errata${l.texto ? ` (${l.texto})` : ''}: no se usa`,
    sin_rango: 'La pauta no tiene repeticiones con las que comparar: se mantiene',
  }[l.diagnostico] || 'Se mantiene';
  // Si faltan series porque alguna se descartó por rara, se dice eso y no que hizo menos
  const raras = l.banderas?.raras || [];
  if (l.diagnostico === 'a_medias' && raras.length && l.hechas.length + raras.length >= l.n) {
    return { tipo: 'mantener', propuesta: igual, orientativa: null, alternativas: [], avisos: [],
      motivo: `${raras.length > 1 ? `Las series ${raras.join(', ')} parecen erratas` : `La serie ${raras[0]} parece una errata`} y con las demás no basta para decidir: se mantiene` };
  }
  return { tipo: 'mantener', propuesta: igual, motivo, orientativa: null, alternativas: [], avisos: [] };
}

// Al tope del rango y sin kilos que subir (peso corporal)
function tope(l, pauta) {
  const alternativas = !tieneDetalle(pauta) && pauta.reps_max != null ? [alt('ampliar', 'Ampliar el rango', { ...campos(pauta), reps_max: Number(pauta.reps_max) + 2 })] : [];
  return { tipo: 'tope', propuesta: campos(pauta), motivo: `Al tope del rango (${rango(l)}) sin carga que subir: toca lastre, una variante más difícil o más repeticiones`,
    orientativa: null, alternativas, avisos: ['Ha llegado al tope sin carga: decide cómo sigue'] };
}

function subida(l, pauta, ctx, saltos, motivoBase) {
  const m = moverKg(l, pauta, ctx, saltos);
  if (!m) return tope(l, pauta);
  return { tipo: 'subir', propuesta: m.propuesta, orientativa: m.orientativa, motivo: `${motivoBase}: ${textoSubida(m)}`,
    alternativas: [alt('mantener', 'Mantener', mantenerEn(l, pauta, ctx))], avisos: [] };
}

// Lo que comparten la doble y la triple cuando no toca subir
function sinSubir(l, pauta, ctx) {
  const { reglas, previa = null } = ctx;
  const subir = () => { const m = moverKg(l, pauta, ctx, 1); return m ? [alt('subir', 'Subir un salto', m.propuesta)] : []; };
  const bajar = () => { const m = moverKg(l, pauta, ctx, -1); return m ? [alt('bajar', 'Bajar un salto', m.propuesta)] : []; };
  if (l.diagnostico === 'en_rango') {
    if (l.detalle) return { tipo: 'mantener', propuesta: mantenerEn(l, pauta, ctx), orientativa: null, motivo: `Cumplió ${l.alTope} de ${l.n} series pautadas: repite`, alternativas: subir(), avisos: [] };
    return { tipo: 'reps', propuesta: mantenerEn(l, pauta, ctx), orientativa: null, motivo: `Dentro del rango (${l.trabajo.map((s) => s.reps).join(', ')} de ${rango(l)}): misma carga y a sumar repeticiones`,
      alternativas: subir(), avisos: [] };
  }
  if (l.diagnostico === 'pasado') {
    return { tipo: 'mantener', propuesta: mantenerEn(l, pauta, ctx), orientativa: null, motivo: 'Se pasó del esfuerzo pautado: repite la carga', alternativas: bajar(), avisos: [] };
  }
  if (l.diagnostico === 'por_debajo') {
    const minimo = l.detalle ? 'lo pautado' : `${l.repsMin}`;
    if (l.banderas.malDia) return { tipo: 'mantener', propuesta: mantenerEn(l, pauta, ctx), orientativa: null, motivo: `No llegó a ${minimo}, pero era un mal día: no cuenta`, alternativas: bajar(), avisos: [] };
    const segunda = previa?.diagnostico === 'por_debajo' && !previa.banderas?.malDia;
    if (segunda && reglas.doble.porDebajo !== 'mantener') {
      const m = reglas.doble.porDebajo === 'bajar_pct' ? moverKg(l, pauta, ctx, -1, reglas.doble.bajarPct) : moverKg(l, pauta, ctx, -1);
      if (m) {
        return { tipo: 'bajar', propuesta: m.propuesta, orientativa: m.orientativa, motivo: `Dos semanas sin llegar a ${minimo}: ${m.orientativa != null ? `le toca bajar (orientativo: ${kilos(m.orientativa)})` : `baja ${kilos(Math.abs(m.delta))}`}`,
          alternativas: [alt('mantener', 'Mantener', mantenerEn(l, pauta, ctx))], avisos: [] };
      }
    }
    return { tipo: 'mantener', propuesta: mantenerEn(l, pauta, ctx), orientativa: null, motivo: `No llegó a ${minimo} en alguna serie: repite la carga`, alternativas: bajar(), avisos: [] };
  }
  return sinDatos(l, pauta, ctx);
}

const motivoTope = (l) => (l.detalle ? `Cumplió ${enCuantas(l)} pautadas` : `Llegó a ${l.repsMax} en ${enCuantas(l)}`)
  + (l.reservas.length && l.objetivo != null ? ' sin pasarse de esfuerzo' : '') + (l.diagnostico === 'sobrado' ? ' y va sobrado' : '');

// ---------- 1. Doble progresión ----------
// Superado: un salto más (dos si va sobrado y las reglas lo permiten). En rango: misma carga y a sumar repeticiones.
// Por debajo dos semanas seguidas: baja. Pasado de esfuerzo: repite.
export function doble(l, pauta, ctx) {
  if (l.diagnostico === 'superado' || l.diagnostico === 'sobrado') {
    const saltos = l.diagnostico === 'sobrado' && ctx.reglas.doble.sobrado === 2 ? 2 : 1;
    return subida(l, pauta, ctx, saltos, motivoTope(l));
  }
  return sinSubir(l, pauta, ctx);
}

// ---------- 2. Triple progresión ----------
// Primero repeticiones hasta el tope; después una serie más, hasta el máximo; solo entonces kilos, y vuelta al
// mínimo de series. ctx.seriesMin y ctx.seriesMax: los límites de series de ese ejercicio.
export function triple(l, pauta, ctx) {
  if (tieneDetalle(pauta) || esTopBackoff(pauta)) {
    const r = doble(l, pauta, ctx);
    return { ...r, avisos: [...r.avisos, 'La triple progresión no vale para pautas serie a serie ni con top + back-off: se usa la doble'] };
  }
  if (l.diagnostico !== 'superado' && l.diagnostico !== 'sobrado') return sinSubir(l, pauta, ctx);
  const series = Number(pauta.series) || 1;
  const min = ctx.seriesMin ?? series, max = ctx.seriesMax ?? series + ctx.reglas.triple.seriesExtra;
  if (series < max) {
    const m = moverKg(l, pauta, ctx, 1);
    return { tipo: 'series', propuesta: { ...mantenerEn(l, pauta, ctx), series: series + 1 }, orientativa: null,
      motivo: `${motivoTope(l)}: una serie más (${series + 1} de ${max})`,
      alternativas: [...(m ? [alt('subir', 'Subir un salto', m.propuesta)] : []), alt('mantener', 'Mantener', mantenerEn(l, pauta, ctx))], avisos: [] };
  }
  const m = moverKg(l, pauta, ctx, 1);
  if (!m) return tope(l, pauta);
  return { tipo: 'subir', propuesta: { ...m.propuesta, series: Math.max(1, Math.min(min, series)) }, orientativa: m.orientativa,
    motivo: `${motivoTope(l)} con ${series} series: ${textoSubida(m)} y vuelve a ${Math.max(1, Math.min(min, series))} series`,
    alternativas: [alt('mantener', 'Mantener', mantenerEn(l, pauta, ctx))], avisos: [] };
}

// ---------- 3. Lineal ----------
// Mismas repeticiones. Completadas: un salto más. Un fallo: repetir. Dos seguidos: −10 % y vuelta a subir.
// ¿Completó todas las series pautadas a la carga de trabajo?
export const completoLineal = (l) => !SIN_DATOS.includes(l.diagnostico) && l.diagnostico !== 'por_debajo' && (l.detalle ? l.alTope >= l.n : l.enRango >= l.n);
// ¿Cuenta como fallo? (un mal día o pasarse de esfuerzo completándolas no cuentan)
export const falloLineal = (l) => !SIN_DATOS.includes(l.diagnostico) && !l.banderas?.malDia && !completoLineal(l);
// ctx.fallosPrevios: semanas seguidas con fallo justo antes de esta · ctx.bajadasPrevias: bajadas ya hechas en el bloque
export function lineal(l, pauta, ctx) {
  if (SIN_DATOS.includes(l.diagnostico)) return sinDatos(l, pauta, ctx);
  const { reglas, fallosPrevios = 0, bajadasPrevias = 0 } = ctx;
  const cuantas = l.top ? 'la serie top' : l.n === 1 ? 'la serie' : `las ${l.n} series`;
  if (completoLineal(l)) {
    if (l.diagnostico === 'pasado') return { tipo: 'mantener', propuesta: mantenerEn(l, pauta, ctx), orientativa: null, motivo: `Completó ${cuantas} pasándose de esfuerzo: repite la carga`, alternativas: [], avisos: [] };
    return subida(l, pauta, ctx, 1, `Completó ${cuantas}`);
  }
  if (l.banderas.malDia) return { tipo: 'mantener', propuesta: mantenerEn(l, pauta, ctx), orientativa: null, motivo: 'No las completó, pero era un mal día: no cuenta', alternativas: [], avisos: [] };
  const fallos = fallosPrevios + 1;
  if (fallos >= reglas.lineal.fallosAntesDeBajar) {
    const m = moverKg(l, pauta, ctx, -1, reglas.lineal.bajadaPct);
    if (m) {
      const avisos = bajadasPrevias + 1 >= reglas.lineal.bajadasParaSalir ? [`Ya van ${bajadasPrevias + 1} bajadas: quizá toca pasar a doble progresión`] : [];
      return { tipo: 'bajar', propuesta: m.propuesta, orientativa: m.orientativa, motivo: `${fallos} semanas sin completarlas: ${m.orientativa != null ? `le toca bajar (orientativo: ${kilos(m.orientativa)})` : `baja ${kilos(Math.abs(m.delta))}`} y vuelve a subir`,
        alternativas: [alt('mantener', 'Mantener', mantenerEn(l, pauta, ctx))], avisos };
    }
  }
  return { tipo: 'mantener', propuesta: mantenerEn(l, pauta, ctx), orientativa: null, motivo: 'No completó las series: repite la carga', alternativas: [], avisos: [] };
}

// ---------- 4. Solo repeticiones ----------
// La carga no cambia. Con repeticiones fijas, una más al completarlas; con rango, a sumar hasta el tope y, al
// llegar, aviso para pasar a una variante más difícil, lastre o tempo.
export function soloReps(l, pauta, ctx) {
  if (SIN_DATOS.includes(l.diagnostico)) return sinDatos(l, pauta, ctx);
  const cada = ctx.reglas.soloReps.sube === 'una_cada_serie';
  const superado = l.diagnostico === 'superado' || l.diagnostico === 'sobrado';
  // (por su cuenta, freno 1) la carga no cambia, pero se parte de la que movió si fue menos que la pautada
  const base = desdeLoHecho(l, pauta, ctx);
  const igual = (motivo) => ({ tipo: 'mantener', propuesta: base, orientativa: null, motivo, alternativas: [], avisos: [] });
  if (l.diagnostico === 'pasado') return igual('Se pasó del esfuerzo pautado: repite');
  if (tieneDetalle(pauta)) {
    if (!superado) return igual(`Cumplió ${l.alTope} de ${l.n} series pautadas: repite`);
    const d = (base.series_detalle || pauta.series_detalle).map((x) => ({ ...x }));
    const conReps = d.filter((x) => x.reps != null);
    if (!conReps.length) return igual('La pauta no tiene repeticiones: se mantiene');
    if (cada) conReps.forEach((x) => { x.reps += 1; });
    else { const menor = Math.min(...conReps.map((x) => x.reps)); conReps.find((x) => x.reps === menor).reps += 1; }
    return { tipo: 'reps', propuesta: conDetalle(pauta, d), orientativa: null, motivo: `${motivoTope(l)}: ${cada ? 'una repetición más en cada serie' : 'una repetición más'}`,
      alternativas: [alt('mantener', 'Mantener', base)], avisos: [] };
  }
  const fijas = l.repsMin === l.repsMax;
  if (superado && !fijas) return tope(l, pauta);
  if (superado) {
    const r = Number(l.repsMax);
    const series = Number(pauta.series) || 1;
    const propuesta = cada || esTopBackoff(pauta) || series === 1
      ? { ...base, reps_min: r + 1, reps_max: r + 1 }
      : conDetalle({ ...pauta, backoff_pct: null }, Array.from({ length: series }, (_, i) => ({ reps: i === 0 ? r + 1 : r, kg: base.carga_sugerida_kg, rpe: pauta.rpe_objetivo })));
    const total = propuesta.series_detalle ? `${propuesta.series_detalle.map((x) => x.reps).join(', ')}` : `${r + 1} en cada serie`;
    return { tipo: 'reps', propuesta, orientativa: null, motivo: `Completó ${l.n === 1 ? 'la serie' : `las ${l.n} series`} de ${r}: ahora ${total}`,
      alternativas: [alt('mantener', 'Mantener', base)], avisos: [] };
  }
  if (fijas) return igual(`No completó las series de ${l.repsMax}: repite`);
  // Con rango: el objetivo de la semana es una repetición más en la serie más atrasada
  const hechas = l.trabajo.map((s) => Number(s.reps));
  const objetivo = [...hechas];
  const menor = Math.min(...objetivo);
  const i = objetivo.indexOf(menor);
  if (cada) objetivo.forEach((x, k) => { objetivo[k] = Math.min(Number(l.repsMax), x + 1); });
  else objetivo[i] = Math.min(Number(l.repsMax), menor + 1);
  return { tipo: 'reps', propuesta: base, orientativa: null, motivo: `Hizo ${hechas.join(', ')} de ${rango(l)}: objetivo ${objetivo.join(', ')}`, alternativas: [], avisos: [] };
}

// ---------- 0. Progresión serie a serie (el modelo de partida) ----------
// Es como programa Pelayo (prueba en sombra del 5/11/2026): cada serie progresa por su cuenta a partir de lo que
// se hizo en ella.
//   1. Llega al tope del rango → sube kilos y vuelve al suelo del rango. Si varias llegan la misma semana, suben
//      las que fueron fáciles (RPE ≤ 8); de las demás, solo la primera.
//   2. Va sobrada (RPE ≤ 7, de partida solo en básicos) → sube kilos con las mismas repeticiones.
//   3. RPE ≤ 9 (o sin RPE apuntado) → una repetición más.
//   4. Por encima → igual.
// Donde, por el nivel del atleta, la carga la elige él, solo se mueven las repeticiones (nunca los kilos).
// Rango de partida: básicos 6–10, multiarticulares 8–12, aislamiento 10–15. Una serie por debajo del suelo (básicos
// en intensificación o peaking) no se empuja hacia el rango: solo sube kilos si va sobrada.
// ctx: { nombre, reglas, ejercicio, nivel }
export function rangoDe({ pauta, ejercicio = null, reglas }) {
  const r = reglas.porSerie;
  if (Array.isArray(r.rango) && r.rango.length === 2) return r.rango;
  if (r.regla === 'rpe') {
    // (v0.182) manda la tabla (tipo x prioridad), no el rango escrito en la pauta. Antes: los rangos que el coach haya
    // puesto a ese atleta para el tipo y los ejercicios con rango propio para todos
    const t = Array.isArray(ejercicio?.tipo) ? ejercicio.tipo : [];
    const tipo = t.includes('basico') ? 'basico' : t[0] === 'aislamiento' ? 'aislamiento' : 'multiarticular';
    const suyo = r.rangos?.[tipo], dePartida = REGLAS_FBE.porSerie.rangos[tipo];
    if (Array.isArray(suyo) && (suyo[0] !== dePartida[0] || suyo[1] !== dePartida[1])) return suyo;
    const nombre = String(ejercicio?.nombre || '').toLowerCase();
    for (const [clave, rango] of Object.entries(r.rangosEjercicio || {})) if (nombre.includes(clave)) return rango;
    const prio = pauta?.prioridad === 'muy_baja' ? 'baja' : ['alta', 'media', 'baja'].includes(pauta?.prioridad) ? pauta.prioridad : 'media';
    return r.rangosPrioridad?.[tipo]?.[prio] || r.rangos[tipo];
  }
  if (r.rangoDeLaPauta && !tieneDetalle(pauta) && pauta.reps_min != null && pauta.reps_max != null && Number(pauta.reps_min) < Number(pauta.reps_max)) return [Number(pauta.reps_min), Number(pauta.reps_max)];
  const tipo = Array.isArray(ejercicio?.tipo) ? ejercicio.tipo : [];
  return r.rangos[tipo.includes('basico') ? 'basico' : tipo[0] === 'aislamiento' ? 'aislamiento' : 'multiarticular'];
}
const listaSeries = (ns) => (ns.length === 1 ? `serie ${ns[0]}` : `series ${ns.slice(0, -1).join(', ')} y ${ns[ns.length - 1]}`);
// Con ctx.topSet (un básico con la top primero) las back-off no progresan solas: igual, salvo que vayan fáciles.
// Con ctx.peaking (la semana que se programa lleva ese foco) la top de los básicos baja una repetición y lleva los
// kilos que mantienen el esfuerzo (topset.js).
export function porSerie(l, pauta, ctx) {
  const { reglas, nombre = '', ejercicio = null, nivel = null } = ctx;
  const R = reglas.porSerie, T = reglas.topSet;
  const psc = !!ctx.porSuCuenta;   // «por su cuenta»: con los frenos del 24/11/2026
  const basico = esBasico(ejercicio);
  const semanaPico = !!ctx.peaking && T.peaking.cuando === 'foco';
  const pico = semanaPico && basico && (!T.peaking.soloObligatorio || pauta.prioridad === 'alta');
  // (v0.183) en una semana de peaking, lo que no es la serie pesada de un basico Obligatorio se queda igual
  const restoIgual = semanaPico && T.peaking.resto === 'igual';
  if (restoIgual && !pico) return { tipo: 'mantener', propuesta: desdeLoHecho(l, pauta, ctx), orientativa: null, motivo: 'Semana de peaking: este ejercicio se queda igual', alternativas: [], avisos: [] };
  if (esTopBackoff(pauta)) {
    if (pico) return picoTopBackoff(l, pauta, ctx);
    const r = doble(l, pauta, ctx);
    return ctx.topSet ? r : { ...r, avisos: [...r.avisos, 'Con top + back-off se usa la doble progresión sobre la serie top'] };
  }
  if (['sin_registrar', 'cambiado', 'dato_raro'].includes(l.diagnostico)) return sinDatos(l, pauta, ctx);
  const [suelo, tope] = rangoDe({ pauta, ejercicio, reglas });
  // (v0.182) con la regla por RPE se programa todo a todos: kilos, repeticiones y RPE, sea cual sea el nivel
  const porRpe = R.regla === 'rpe';
  const laEligeEl = !porRpe && R.sinKilos !== 'como_los_demas' && !!nivel && modoCarga(nivel, pauta.prioridad) === 'rpe';
  if (laEligeEl && R.sinKilos === 'no_tocar') return { tipo: 'mantener', propuesta: campos(pauta), orientativa: null, motivo: 'La carga la elige el atleta: no se toca', alternativas: [], avisos: [] };
  const sobradoVale = R.sobradoEn === 'todos' || (R.sobradoEn === 'basicos' && basico);
  const detalle = tieneDetalle(pauta);
  const hechas = Object.fromEntries(l.hechas.map((s) => [Number(s.numero), s]));
  // Lo pautado en cada serie. Si la pauta no es serie a serie no hay objetivo por serie: se parte de lo que hizo
  // en cada una (sus kilos y sus repeticiones), que es lo que deja ver una pirámide.
  const dePauta = { ...((pauta.reps_max ?? pauta.reps_min) != null ? { reps: Number(pauta.reps_max ?? pauta.reps_min) } : {}),
    ...(pauta.carga_sugerida_kg != null ? { kg: Number(pauta.carga_sugerida_kg) } : {}), ...(pauta.rpe_objetivo != null ? { rpe: Number(pauta.rpe_objetivo) } : {}) };
  const objetivos = detalle ? pauta.series_detalle : Array.from({ length: Math.max(1, Number(pauta.series) || 1) }, (_, i) => {
    const h = hechas[i + 1];
    return h ? { ...dePauta, reps: Number(h.reps), ...(dePauta.kg != null && Number(h.kg) > 0 ? { kg: Number(h.kg) } : {}) } : { ...dePauta };
  });
  const datos = objetivos.map((o, i) => {
    const h = hechas[i + 1];
    if (!h) return null;
    const kg = Number(h.kg) > 0 ? Number(h.kg) : 0, reserva = enReserva(h);
    return { kg, reps: Number(h.reps), rpe: reserva == null ? null : 10 - reserva, mueveKg: porRpe ? kg > 0 : o.kg != null && kg > 0 && !laEligeEl };
  });
  // Top y back-off: la top es la serie (o series) a la carga más alta; se mira lo que movió y, si falta, lo pautado
  const est = pico || ctx.topSet ? estructuraTop(objetivos.map((o, i) => (datos[i]?.kg > 0 ? datos[i].kg : o.kg ?? null))) : null;
  // La serie top fuera del peaking (la primera, la más pesada): puede llevar su rango y su RPE propios (topSet.rango, topSet.rpeSube)
  const esTop = (i) => !!est && !pico && est.forma === 'top_primero' && i === est.tops[0];
  const rangoEn = (i) => (esTop(i) && Array.isArray(T.rango) ? T.rango : [suelo, tope]);
  const rpeSubeEn = (i) => (esTop(i) && T.rpeSube != null ? T.rpeSube : R.rpeSube);
  // (con la regla por RPE no hay back-off aparte: cada serie por su cuenta; solo se distingue la top en peaking)
  const rol = objetivos.map((_, i) => (!est ? 'normal' : pico ? (est.tops.includes(i) ? 'top' : 'backoff') : !porRpe && est.forma === 'top_primero' && i !== est.tops[0] ? 'backoff' : 'normal'));
  // (v0.182) la serie pesada de un Obligatorio: la primera, si es la de mas kilos y las demas llevan menos
  const estKg = porRpe && pauta.prioridad === 'alta' ? estructuraTop(datos.map((x) => x?.kg || null)) : null;
  const pesada = (i) => !!estKg && estKg.forma === 'top_primero' && i === estKg.tops[0];
  const movimiento = movimientoDe(ejercicio);
  let duras = 0;        // series a RPE alto que ya han progresado: pasadas `cuantasDuras`, las demas a ese RPE esperan
  // Lo pautado en repeticiones para cada serie (a RPE 10 solo se baja si no llego a ello)
  const pautadasEn = (i) => (detalle ? pauta.series_detalle[i]?.reps : pauta.reps_min ?? pauta.reps_max) ?? null;
  let ligeras = 0;
  const objetivoPauta = objetivoReserva(pauta);
  const pk = pico && est ? topPeaking(est.tops.filter((i) => datos[i]).map((i) => ({ kg: datos[i].kg, reps: datos[i].reps, rpe: datos[i].rpe,
    pautadas: detalle && objetivos[i].reps != null ? Number(objetivos[i].reps) : null,
    objetivo: objetivos[i].rpe != null ? Number(objetivos[i].rpe) : objetivoPauta != null ? 10 - objetivoPauta : null })), { nombre, reglas }) : null;
  // Varias series al tope la misma semana: suben todas las que fueron fáciles; de las demás, solo la primera
  const alTope = datos.map((x, i) => (x && x.mueveKg && x.reps >= rangoEn(i)[1] && rol[i] !== 'backoff' ? i : -1)).filter((i) => i >= 0);
  const sube = (i) => R.variasAlTope === 'todas' || i === alTope[0] || (R.variasAlTope === 'faciles' && datos[i].rpe != null && datos[i].rpe <= R.topeFacilRpe);
  const acciones = [];
  let salto = 0, bajada = 0;
  const usados = new Set(), sinCargaQueBajar = [];   // (por su cuenta) frenos que han actuado y series sin kilos atascadas
  const serie = (o, i) => {
    const x = datos[i];
    if (!x) { acciones.push('falta'); return { ...o }; }
    const { kg, reps, rpe, mueveKg } = x;
    const [suelo, tope] = rangoEn(i);   // (el de la serie: la top puede llevar el suyo)
    // Los kilos de la serie: los que movió (si la pauta lleva kilos); subirlos solo se puede donde los pauta el coach
    const kgBase = (o.kg != null || porRpe) && kg > 0 ? kg : o.kg;
    const con = (cambio) => { const f = { ...o, ...cambio }; if (f.kg == null) delete f.kg; return f; };
    const subir = () => { const paso = saltoDe(nombre, kg, reglas); salto = salto || paso; return dos(kg + paso); };
    // Igual: lo que hizo si cumplió lo pautado; si no, lo pautado
    const cumplio = (o.reps == null || reps >= Number(o.reps)) && (o.kg == null || kg >= Number(o.kg) - 0.001);
    // (por su cuenta, freno 1) si movió menos kilos de los pautados, «igual» es lo que hizo, no lo pautado
    const menosKg = psc && o.kg != null && kg > 0 && kg < Number(o.kg) - 0.001;
    const igual = () => (cumplio ? con({ kg: kgBase, reps }) : menosKg ? (usados.add('desde_lo_hecho'), con({ kg, reps })) : { ...o });
    if (rol[i] === 'top' && pk) {
      if (pk.accion === 'dura') { acciones.push('pk_dura'); return igual(); }
      if (!mueveKg) { acciones.push('pk_elige'); return con({ kg: kgBase, reps: pk.reps }); }
      acciones.push(pk.accion === 'suelo' ? (pk.delta > 0 ? 'pk_suelo_sube' : 'pk_suelo') : pk.delta > 0 ? 'pk' : 'pk_mismo');
      return pk.accion === 'suelo' && !(pk.delta > 0) ? igual() : con({ kg: pk.kg, reps: pk.reps });
    }
    if (rol[i] === 'backoff' && (T.backoff !== 'solas' || restoIgual)) {
      if (!restoIgual && T.backoff === 'faciles' && mueveKg && rpe != null && rpe <= T.backoffFacilRpe) { acciones.push('bo_sube'); return con({ kg: subir(), reps }); }
      acciones.push('bo_igual'); return igual();
    }
    if (porRpe && rol[i] === 'normal') {
      // ---- (v0.182) la regla por RPE y zona del rango ----
      if (rpe == null) { acciones.push('sin_rpe'); return igual(); }
      // A RPE 10: igual; una repeticion menos solo si ademas no llego a las pautadas (decision del 18/11/2026)
      if (rpe >= 10) {
        const pt = pautadasEn(i);
        if (pt != null && reps < Number(pt)) {
          // (por su cuenta, freno 3) tampoco a RPE 10 se baja del mínimo del rango (ni se baja más si ya está por debajo)
          if (psc && reps - 1 < suelo) { usados.add('minimo_rango'); acciones.push('suelo10'); return con({ kg: kgBase, reps }); }
          acciones.push('menos'); return con({ kg: kgBase, reps: Math.max(1, reps - 1) });
        }
        acciones.push('igual10'); return con({ kg: kgBase, reps });
      }
      if (rpe > 9) { acciones.push('igual'); return igual(); }
      const zona = reps >= tope ? 'tope' : reps >= suelo + (tope - suelo) / 2 ? 'alta' : 'baja';
      let subeKg = false;
      if (mueveKg) {
        if (rpe <= 6.5) subeKg = true;
        else if (rpe <= 7.5) subeKg = movimiento === 'pierna' ? true : movimiento === 'empuje' ? zona === 'tope' : zona !== 'baja';
        // (la serie pesada de un Obligatorio sube de kilos antes que de repeticiones, este donde este del rango)
        else if (rpe <= 8.5) subeKg = zona === 'tope' || pesada(i);
        else subeKg = zona === 'tope';
      }
      const dura = rpe >= R.soloPrimeraDesde;
      const paso = mueveKg ? saltoDe(nombre, kg, reglas) : 0;
      // Carga baja: el salto pesa mucho; se sigue con repeticiones (hasta sobreTope por encima) salvo que se pida subir
      const ligera = subeKg && (paso / kg) * 100 > R.cargaBajaPct && reps < tope + R.sobreTope && !ctx.subirLigera;
      if (ligera) ligeras++;
      if (subeKg && !ligera) {
        if (dura && duras >= R.cuantasDuras) { acciones.push('espera'); return con({ kg: kgBase, reps }); }
        if (dura) duras++;
        const kg2 = dos(kg + paso);
        // Las repeticiones con los kilos nuevos: las que dejan el esfuerzo en rpeObjetivo (Epley con las de reserva);
        // a RPE 9 en el tope, al minimo del rango; nunca mas de las que hizo; el novato, una menos
        let r2 = suelo;
        if (rpe < 9) {
          const rm = kg * (1 + (reps + (10 - rpe)) / 30);
          r2 = Math.round(30 * (rm / kg2 - 1) - (10 - R.rpeObjetivo)) - (nivel === 'novato' ? 1 : 0);
        }
        // (por su cuenta, freno 3) la serie pesada de un básico tampoco baja del mínimo del rango: si con el salto no llegaría,
        // una repetición más (en el tope, sube y vuelve al mínimo, como siempre). Las demás series ya no bajan del mínimo.
        if (psc && pesada(i) && basico && r2 < suelo && reps >= suelo && reps < tope) { usados.add('minimo_rango'); acciones.push('no_llega'); return con({ kg: kgBase, reps: reps + 1 }); }
        subir();
        // (la serie pesada de un basico puede quedar por debajo del rango, como la programa Pelayo: 97,5 x 7 a RPE 8 → 100 x 6;
        // por su cuenta, no: nunca por debajo del mínimo)
        if (psc && pesada(i) && basico && r2 < Math.min(suelo, reps)) usados.add('minimo_rango');
        r2 = Math.max(pesada(i) && basico && !psc ? Math.min(3, reps) : Math.min(suelo, reps), Math.min(reps, r2));
        acciones.push(r2 < reps ? 'rpe_kg_baja' : 'rpe_kg'); return con({ kg: kg2, reps: r2 });
      }
      // No sube de kilos: una repeticion mas (sin pasar del tope, salvo carga baja)
      const techo = ligera ? tope + R.sobreTope : tope;
      if (reps >= techo) { acciones.push(mueveKg ? 'igual' : 'tope'); return con({ kg: kgBase, reps: Math.max(reps, Number(o.reps ?? reps)) }); }
      if (dura && duras >= R.cuantasDuras) { acciones.push('espera_rep'); return con({ kg: kgBase, reps }); }
      if (dura) duras++;
      acciones.push(ligera ? 'ligera_rep' : 'rep'); return con({ kg: kgBase, reps: reps + 1 });
    }
    if (reps >= tope) {
      if (mueveKg && sube(i)) { acciones.push('tope_kg'); return con({ kg: subir(), reps: R.bajaAlSubir ? Math.max(suelo, Math.min(reps, tope) - R.bajaAlSubir) : suelo }); }
      if (mueveKg) { acciones.push('espera'); return con({ kg: kgBase, reps }); }
      acciones.push('tope'); return con({ kg: kgBase, reps: Math.max(tope, Number(o.reps ?? tope)) });
    }
    if (mueveKg && sobradoVale && rpe != null && rpe <= R.sobradoRpe) { acciones.push('sobrada'); return con({ kg: subir(), reps }); }
    // Por debajo del suelo con kilos (básicos en intensificación o peaking) no se empujan las repeticiones; sin kilos
    // (dominadas, peso corporal) sí: ahí sumar repeticiones es la única forma de progresar
    if (reps < suelo && (kg > 0 || o.kg != null)) { acciones.push('bajo'); return con({ kg: kgBase, reps: Math.max(reps, Number(o.reps ?? reps)) }); }
    if (rpe == null || rpe <= rpeSubeEn(i)) { acciones.push('rep'); return con({ kg: kgBase, reps: Math.min(tope, reps + 1) }); }
    acciones.push('igual'); return igual();
  };
  // (por su cuenta, freno 4) dos semanas seguidas por debajo del rango sin avanzar (ni más repeticiones ni menos kilos):
  // baja un salto y vuelve al mínimo. Si lo pautado ya iba por debajo del rango a propósito, su mínimo es lo pautado.
  const antes = Object.fromEntries((ctx.previa?.hechas || []).map((s) => [Number(s.numero), s]));
  const frenoRango = (res, o, i) => {
    const x = datos[i];
    if (!psc || !x || (rol[i] === 'top' && pk)) return res;
    const pt = pautadasEn(i), [suelo] = rangoEn(i);
    const minimo = pt != null && Number(pt) < suelo ? Number(pt) : suelo;
    const previa = antes[i + 1];
    if (!(x.reps < minimo) || !previa || !(Number(previa.reps) < minimo)) return res;
    if (Number(res.reps) > x.reps || (res.kg != null && Number(res.kg) < x.kg - 0.001)) return res;
    // Sin kilos que bajar (peso corporal, o la carga la elige él): no se puede bajar un salto; se avisa
    if (!x.mueveKg || !(x.kg > 0)) { sinCargaQueBajar.push(i + 1); return res; }
    const paso = saltoDe(nombre, x.kg, reglas), kg2 = dos(x.kg - paso);
    if (!(kg2 > 0)) { sinCargaQueBajar.push(i + 1); return res; }
    bajada = bajada || paso;
    usados.add('baja_rango');
    acciones[i] = 'baja_rango';
    return { ...o, kg: kg2, reps: minimo };
  };
  const d = objetivos.map((o, i) => frenoRango(serie(o, i), o, i));
  // Los textos, con el rango y el RPE de la primera serie de cada grupo (la top no se agrupa con las demás)
  const textoDe = (a, i) => { const [suelo, tope] = rangoEn(i); const TEXTO = {
    tope_kg: `al tope (${tope}), sube ${kilos(salto)} y ${R.bajaAlSubir && d[i].reps > suelo ? `baja a ${d[i].reps}` : `vuelve a ${suelo}`}`, sobrada: `sobrada (RPE ${num(R.sobradoRpe)} o menos), sube ${kilos(salto)} con las mismas repeticiones`,
    rep: 'una repetición más', igual: `igual (RPE por encima de ${num(rpeSubeEn(i))})`, espera: `al tope (${tope}) pero justa, espera a que suba la primera`,
    tope: `al tope (${tope}): le toca subir de carga, que elige ${laEligeEl ? 'el atleta' : 'tú'}`, bajo: `por debajo del rango (${suelo}–${tope}), igual`, falta: 'sin hacer, igual',
    sin_rpe: 'sin RPE apuntado, igual', menos: 'a RPE 10 y sin llegar a lo pautado, una repetición menos', igual10: 'a RPE 10, igual', espera_rep: `a RPE ${num(R.soloPrimeraDesde)} o más, espera a las ${R.cuantasDuras === 1 ? 'primera' : 'primeras'}`,
    rpe_kg: `sube ${kilos(salto)} con las mismas repeticiones`, rpe_kg_baja: `sube ${kilos(salto)} y baja a ${d[i].reps}`,
    no_llega: `con el salto no llegaría a ${suelo}: una repetición más antes de subir`, suelo10: `a RPE 10, pero ya en el mínimo del rango (${suelo}): igual`,
    baja_rango: `dos semanas por debajo del rango (${suelo}–${tope}): baja ${kilos(bajada)} y vuelve a ${d[i].reps}`,
    ligera_rep: `carga baja (el salto pesa más del ${num(R.cargaBajaPct)} %): una repetición más antes de subir`,
    bo_sube: `back-off fácil (RPE ${num(T.backoffFacilRpe)} o menos), sube ${kilos(salto)}`, bo_igual: 'back-off, igual',
    ...(pk && pk.accion !== 'dura' ? (() => {
      const menos = `${T.peaking.reps === 1 ? 'una repetición menos' : `${T.peaking.reps} repeticiones menos`} por peaking (${pk.reps})`;
      const ya = `peaking, ya en ${pk.reps} ${pk.reps === 1 ? 'repetición' : 'repeticiones'}`;
      return { pk: `${menos} y ${kilos(pk.kg)} (+${kilos(pk.delta)}) para mantener el esfuerzo`, pk_mismo: `${menos} con los mismos kilos`,
        pk_elige: `${menos}; la carga la elige el atleta`, pk_suelo_sube: `${ya}: sube ${kilos(pk.delta)}`, pk_suelo: `${ya} y exigente: igual` };
    })() : {}),
    pk_dura: `peaking, pero salió muy dura (RPE por encima de ${num(T.peaking.duraRpe)}): repite tal cual`,
  }; return TEXTO[a]; };
  const propia = (i) => esTop(i) && (Array.isArray(T.rango) || T.rpeSube != null);
  const grupos = [];
  const clave = (a, i) => (a === 'rpe_kg_baja' ? `${a}:${d[i].reps}` : a);
  acciones.forEach((a, i) => { const g = grupos.find((x) => clave(x.a, x.ns[0] - 1) === clave(a, i) && x.propia === propia(i)); if (g) g.ns.push(i + 1); else grupos.push({ a, propia: propia(i), ns: [i + 1] }); });
  const frase = (g) => `${grupos.length === 1 && g.ns.length > 1 ? `las ${g.ns.length} series` : listaSeries(g.ns)}: ${textoDe(g.a, g.ns[0] - 1)}`;
  const texto = grupos.map(frase).join(' · ');
  const motivo = texto.charAt(0).toUpperCase() + texto.slice(1);
  const tipo = acciones.some((a) => ['tope_kg', 'sobrada', 'bo_sube', 'pk', 'pk_suelo_sube', 'rpe_kg', 'rpe_kg_baja'].includes(a)) ? 'subir'
    : acciones.includes('baja_rango') ? 'bajar'
    : acciones.some((a) => a === 'pk_mismo' || a === 'pk_elige') ? 'peaking' : acciones.some((a) => a === 'rep' || a === 'ligera_rep' || a === 'no_llega') ? 'reps' : acciones.includes('menos') ? 'menos' : 'mantener';
  // Si nada cambia respecto a lo pautado, la pauta se queda en su formato (no se pasa a serie a serie porque sí)
  const pautado = detalle ? pauta.series_detalle : objetivos.map(() => dePauta);
  // Tampoco si la pauta no era serie a serie y ninguna serie progresa: se deja como la escribió el coach
  // (v0.182: con la regla por RPE, si la pauta no llevaba kilos y él los movió, se escriben aunque nada progrese)
  const ponKilos = porRpe && !detalle && pauta.carga_sugerida_kg == null && d.some((x) => x.kg != null);
  // (por su cuenta, freno 1) ni se vuelve a la pauta escrita si alguna serie movió menos kilos de los pautados
  const menosKilos = psc && !detalle && pauta.carga_sugerida_kg != null && datos.some((x) => x && x.kg > 0 && x.kg < Number(pauta.carga_sugerida_kg) - 0.001);
  if (menosKilos) usados.add('desde_lo_hecho');
  const nadaProgresa = !detalle && !ponKilos && !menosKilos && acciones.every((a) => ['igual', 'falta', 'bajo', 'espera', 'espera_rep', 'sin_rpe', 'igual10', 'suelo10', 'tope', 'bo_igual', 'pk_dura', 'pk_suelo'].includes(a));
  const sinCambios = nadaProgresa || JSON.stringify(limpiarDetalle(d)) === JSON.stringify(limpiarDetalle(pautado));
  const enPico = !!pk && acciones.some((a) => a.startsWith('pk'));
  return { tipo: sinCambios && tipo !== 'mantener' ? 'mantener' : tipo, propuesta: sinCambios ? campos(pauta) : conDetalle({ ...pauta, backoff_pct: null }, d), motivo,
    orientativa: acciones.includes('pk_elige') && pk.delta > 0 ? pk.kg : null, ...(enPico ? { fase: 'peaking' } : {}),
    alternativas: [...(ligeras && !ctx.subirLigera ? [alt('subir_carga', 'Subir carga', porSerie(l, pauta, { ...ctx, subirLigera: true }).propuesta)] : []),
      ...(sinCambios ? [] : [alt('mantener', 'Mantener', desdeLoHecho(l, pauta, ctx))]), ...(enPico ? [alt('sin_peaking', 'Sin peaking', porSerie(l, pauta, { ...ctx, peaking: false }).propuesta)] : [])],
    avisos: [...(pk?.limitada ? [`La subida calculada pasaba del ${num(T.peaking.maxPct)} %: se ha limitado`] : acciones.includes('tope') ? [`Ha llegado al tope en ${acciones.filter((a) => a === 'tope').length === acciones.length ? 'todas las series' : `la${acciones.filter((a) => a === 'tope').length > 1 ? 's' : ''} ${listaSeries(acciones.map((a, k) => (a === 'tope' ? k + 1 : null)).filter(Boolean))}`}: le toca subir de carga`] : []),
      ...(sinCargaQueBajar.length ? [`Dos semanas por debajo del rango en la ${listaSeries(sinCargaQueBajar)} y sin carga que bajar: toca una variante más fácil`] : [])],
    ...(usados.size ? { frenos: [...usados].map((id) => ({ id, texto: FRENO_POR_SU_CUENTA[id] })) } : {}) };
}
// Lo que se enseña al coach de cada freno de «por su cuenta» que ha actuado en la fila
export const FRENO_POR_SU_CUENTA = {
  desde_lo_hecho: 'Movió menos kilos de los pautados: se parte de lo que hizo',
  minimo_rango: 'Nunca por debajo del mínimo del rango',
  baja_rango: 'Dos semanas por debajo del rango: baja un salto',
  un_salto: 'Más de un salto sobre lo que hizo: se limita',
};

// Peaking con el «top + back-off» de la app (la top es la serie 1; las back-off salen solas de su %)
function picoTopBackoff(l, pauta, ctx) {
  const { reglas, nombre = '' } = ctx;
  const P = reglas.topSet.peaking;
  const top = l.trabajo[0];
  if (!top) return sinDatos(l, pauta, ctx);
  const reserva = enReserva(top), objetivo = objetivoReserva(pauta);
  const pk = topPeaking([{ kg: Number(top.kg), reps: Number(top.reps), rpe: reserva == null ? null : 10 - reserva,
    pautadas: pauta.reps_max ?? pauta.reps_min ?? null, objetivo: objetivo == null ? null : 10 - objetivo }], { nombre, reglas });
  if (!pk) return sinDatos(l, pauta, ctx);
  const sinPico = alt('sin_peaking', 'Sin peaking', doble(l, pauta, ctx).propuesta);
  if (pk.accion === 'dura') {
    return { tipo: 'mantener', propuesta: mantenerEn(l, pauta, ctx), orientativa: null, fase: 'peaking', alternativas: [sinPico], avisos: [],
      motivo: `Peaking, pero la top salió muy dura (RPE por encima de ${num(P.duraRpe)}): repite tal cual` };
  }
  const max = Number(pauta.reps_max ?? pauta.reps_min ?? top.reps), min = Number(pauta.reps_min ?? max);
  const llevaKg = pauta.carga_sugerida_kg != null;
  const propuesta = { ...campos(pauta), reps_max: pk.reps, reps_min: min < max ? Math.max(Math.min(P.suelo, pk.reps), Math.min(pk.reps, min - (max - pk.reps))) : pk.reps,
    carga_sugerida_kg: llevaKg ? pk.kg : null };
  const menos = pk.accion === 'suelo' ? `ya en ${pk.reps} ${pk.reps === 1 ? 'repetición' : 'repeticiones'}` : `${P.reps === 1 ? 'una repetición menos' : `${P.reps} repeticiones menos`} en la top (${pk.reps})`;
  const carga = !llevaKg ? `la carga la elige el atleta${pk.delta > 0 ? ` (orientativo: ${kilos(pk.kg)})` : ''}` : pk.delta > 0 ? `${kilos(pk.kg)} (+${kilos(pk.delta)}) para mantener el esfuerzo` : 'los mismos kilos';
  return { tipo: llevaKg && pk.delta > 0 ? 'subir' : pk.accion === 'suelo' ? 'mantener' : 'peaking', propuesta, orientativa: !llevaKg && pk.delta > 0 ? pk.kg : null, fase: 'peaking',
    motivo: `Peaking: ${menos}, ${carga}`, alternativas: [alt('mantener', 'Mantener', mantenerEn(l, pauta, ctx)), sinPico],
    avisos: pk.limitada ? [`La subida calculada pasaba del ${num(P.maxPct)} %: se ha limitado`] : [] };
}

// ---------- Top set + back-off ----------
// La progresión serie a serie con la top y las back-off diferenciadas (para pedirlo en un ejercicio que no sea básico)
export const topSet = (l, pauta, ctx) => porSerie(l, pauta, { ...ctx, topSet: true });

// ---------- Sin regla ----------
export const mantener = (l, pauta, ctx = {}) => ({ tipo: 'mantener', propuesta: desdeLoHecho(l, pauta, ctx), orientativa: null, motivo: 'Modelo «mantener»: se copia la semana', alternativas: [], avisos: [] });
export const aMano = (l, pauta) => ({ tipo: 'sin_tocar', propuesta: campos(pauta), orientativa: null, motivo: 'A mano: la app no toca este ejercicio', alternativas: [], avisos: [] });

export const MODELO = { por_serie: porSerie, top_set: topSet, doble, triple, lineal, solo_reps: soloReps, mantener, a_mano: aMano };
