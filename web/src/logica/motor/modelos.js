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
import { num, tieneDetalle, limpiarDetalle, agregadosDetalle, esTopBackoff, enReserva } from '../calculos.js';
import { modoCarga } from '../nivel.js';
import { saltoDe, objetivoReserva, SIN_DATOS } from './lectura.js';
import { esBasico } from './reglas.js';
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

// La misma pauta, con la carga puesta en lo que movió (si la pauta lleva kilos)
function mantenerEn(l, pauta) {
  if (tieneDetalle(pauta)) return campos(pauta);
  const kg = cargaBase(l, pauta);
  return { ...campos(pauta), carga_sugerida_kg: pauta.carga_sugerida_kg != null && kg > 0 ? dos(kg) : pauta.carga_sugerida_kg ?? null };
}

// Sube (saltos > 0) o baja (saltos < 0) la carga. null si no hay kilos que mover.
function moverKg(l, pauta, { nombre, reglas }, saltos, pct = null) {
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
      const base = saltos > 0 && fila?.estado === 'cumplida' && hecho > Number(o.kg) ? hecho : Number(o.kg);
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
function sinDatos(l, pauta) {
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
    return { tipo: 'mantener', propuesta: campos(pauta), orientativa: null, alternativas: [], avisos: [],
      motivo: `${raras.length > 1 ? `Las series ${raras.join(', ')} parecen erratas` : `La serie ${raras[0]} parece una errata`} y con las demás no basta para decidir: se mantiene` };
  }
  return { tipo: 'mantener', propuesta: campos(pauta), motivo, orientativa: null, alternativas: [], avisos: [] };
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
    alternativas: [alt('mantener', 'Mantener', mantenerEn(l, pauta))], avisos: [] };
}

// Lo que comparten la doble y la triple cuando no toca subir
function sinSubir(l, pauta, ctx) {
  const { reglas, previa = null } = ctx;
  const subir = () => { const m = moverKg(l, pauta, ctx, 1); return m ? [alt('subir', 'Subir un salto', m.propuesta)] : []; };
  const bajar = () => { const m = moverKg(l, pauta, ctx, -1); return m ? [alt('bajar', 'Bajar un salto', m.propuesta)] : []; };
  if (l.diagnostico === 'en_rango') {
    if (l.detalle) return { tipo: 'mantener', propuesta: campos(pauta), orientativa: null, motivo: `Cumplió ${l.alTope} de ${l.n} series pautadas: repite`, alternativas: subir(), avisos: [] };
    return { tipo: 'reps', propuesta: mantenerEn(l, pauta), orientativa: null, motivo: `Dentro del rango (${l.trabajo.map((s) => s.reps).join(', ')} de ${rango(l)}): misma carga y a sumar repeticiones`,
      alternativas: subir(), avisos: [] };
  }
  if (l.diagnostico === 'pasado') {
    return { tipo: 'mantener', propuesta: mantenerEn(l, pauta), orientativa: null, motivo: 'Se pasó del esfuerzo pautado: repite la carga', alternativas: bajar(), avisos: [] };
  }
  if (l.diagnostico === 'por_debajo') {
    const minimo = l.detalle ? 'lo pautado' : `${l.repsMin}`;
    if (l.banderas.malDia) return { tipo: 'mantener', propuesta: mantenerEn(l, pauta), orientativa: null, motivo: `No llegó a ${minimo}, pero era un mal día: no cuenta`, alternativas: bajar(), avisos: [] };
    const segunda = previa?.diagnostico === 'por_debajo' && !previa.banderas?.malDia;
    if (segunda && reglas.doble.porDebajo !== 'mantener') {
      const m = reglas.doble.porDebajo === 'bajar_pct' ? moverKg(l, pauta, ctx, -1, reglas.doble.bajarPct) : moverKg(l, pauta, ctx, -1);
      if (m) {
        return { tipo: 'bajar', propuesta: m.propuesta, orientativa: m.orientativa, motivo: `Dos semanas sin llegar a ${minimo}: ${m.orientativa != null ? `le toca bajar (orientativo: ${kilos(m.orientativa)})` : `baja ${kilos(Math.abs(m.delta))}`}`,
          alternativas: [alt('mantener', 'Mantener', mantenerEn(l, pauta))], avisos: [] };
      }
    }
    return { tipo: 'mantener', propuesta: mantenerEn(l, pauta), orientativa: null, motivo: `No llegó a ${minimo} en alguna serie: repite la carga`, alternativas: bajar(), avisos: [] };
  }
  return sinDatos(l, pauta);
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
    return { tipo: 'series', propuesta: { ...mantenerEn(l, pauta), series: series + 1 }, orientativa: null,
      motivo: `${motivoTope(l)}: una serie más (${series + 1} de ${max})`,
      alternativas: [...(m ? [alt('subir', 'Subir un salto', m.propuesta)] : []), alt('mantener', 'Mantener', mantenerEn(l, pauta))], avisos: [] };
  }
  const m = moverKg(l, pauta, ctx, 1);
  if (!m) return tope(l, pauta);
  return { tipo: 'subir', propuesta: { ...m.propuesta, series: Math.max(1, Math.min(min, series)) }, orientativa: m.orientativa,
    motivo: `${motivoTope(l)} con ${series} series: ${textoSubida(m)} y vuelve a ${Math.max(1, Math.min(min, series))} series`,
    alternativas: [alt('mantener', 'Mantener', mantenerEn(l, pauta))], avisos: [] };
}

// ---------- 3. Lineal ----------
// Mismas repeticiones. Completadas: un salto más. Un fallo: repetir. Dos seguidos: −10 % y vuelta a subir.
// ¿Completó todas las series pautadas a la carga de trabajo?
export const completoLineal = (l) => !SIN_DATOS.includes(l.diagnostico) && l.diagnostico !== 'por_debajo' && (l.detalle ? l.alTope >= l.n : l.enRango >= l.n);
// ¿Cuenta como fallo? (un mal día o pasarse de esfuerzo completándolas no cuentan)
export const falloLineal = (l) => !SIN_DATOS.includes(l.diagnostico) && !l.banderas?.malDia && !completoLineal(l);
// ctx.fallosPrevios: semanas seguidas con fallo justo antes de esta · ctx.bajadasPrevias: bajadas ya hechas en el bloque
export function lineal(l, pauta, ctx) {
  if (SIN_DATOS.includes(l.diagnostico)) return sinDatos(l, pauta);
  const { reglas, fallosPrevios = 0, bajadasPrevias = 0 } = ctx;
  const cuantas = l.top ? 'la serie top' : l.n === 1 ? 'la serie' : `las ${l.n} series`;
  if (completoLineal(l)) {
    if (l.diagnostico === 'pasado') return { tipo: 'mantener', propuesta: mantenerEn(l, pauta), orientativa: null, motivo: `Completó ${cuantas} pasándose de esfuerzo: repite la carga`, alternativas: [], avisos: [] };
    return subida(l, pauta, ctx, 1, `Completó ${cuantas}`);
  }
  if (l.banderas.malDia) return { tipo: 'mantener', propuesta: mantenerEn(l, pauta), orientativa: null, motivo: 'No las completó, pero era un mal día: no cuenta', alternativas: [], avisos: [] };
  const fallos = fallosPrevios + 1;
  if (fallos >= reglas.lineal.fallosAntesDeBajar) {
    const m = moverKg(l, pauta, ctx, -1, reglas.lineal.bajadaPct);
    if (m) {
      const avisos = bajadasPrevias + 1 >= reglas.lineal.bajadasParaSalir ? [`Ya van ${bajadasPrevias + 1} bajadas: quizá toca pasar a doble progresión`] : [];
      return { tipo: 'bajar', propuesta: m.propuesta, orientativa: m.orientativa, motivo: `${fallos} semanas sin completarlas: ${m.orientativa != null ? `le toca bajar (orientativo: ${kilos(m.orientativa)})` : `baja ${kilos(Math.abs(m.delta))}`} y vuelve a subir`,
        alternativas: [alt('mantener', 'Mantener', mantenerEn(l, pauta))], avisos };
    }
  }
  return { tipo: 'mantener', propuesta: mantenerEn(l, pauta), orientativa: null, motivo: 'No completó las series: repite la carga', alternativas: [], avisos: [] };
}

// ---------- 4. Solo repeticiones ----------
// La carga no cambia. Con repeticiones fijas, una más al completarlas; con rango, a sumar hasta el tope y, al
// llegar, aviso para pasar a una variante más difícil, lastre o tempo.
export function soloReps(l, pauta, ctx) {
  if (SIN_DATOS.includes(l.diagnostico)) return sinDatos(l, pauta);
  const cada = ctx.reglas.soloReps.sube === 'una_cada_serie';
  const superado = l.diagnostico === 'superado' || l.diagnostico === 'sobrado';
  const igual = (motivo) => ({ tipo: 'mantener', propuesta: campos(pauta), orientativa: null, motivo, alternativas: [], avisos: [] });
  if (l.diagnostico === 'pasado') return igual('Se pasó del esfuerzo pautado: repite');
  if (tieneDetalle(pauta)) {
    if (!superado) return igual(`Cumplió ${l.alTope} de ${l.n} series pautadas: repite`);
    const d = pauta.series_detalle.map((x) => ({ ...x }));
    const conReps = d.filter((x) => x.reps != null);
    if (!conReps.length) return igual('La pauta no tiene repeticiones: se mantiene');
    if (cada) conReps.forEach((x) => { x.reps += 1; });
    else { const menor = Math.min(...conReps.map((x) => x.reps)); conReps.find((x) => x.reps === menor).reps += 1; }
    return { tipo: 'reps', propuesta: conDetalle(pauta, d), orientativa: null, motivo: `${motivoTope(l)}: ${cada ? 'una repetición más en cada serie' : 'una repetición más'}`,
      alternativas: [alt('mantener', 'Mantener', campos(pauta))], avisos: [] };
  }
  const fijas = l.repsMin === l.repsMax;
  if (superado && !fijas) return tope(l, pauta);
  if (superado) {
    const r = Number(l.repsMax);
    const series = Number(pauta.series) || 1;
    const propuesta = cada || esTopBackoff(pauta) || series === 1
      ? { ...campos(pauta), reps_min: r + 1, reps_max: r + 1 }
      : conDetalle({ ...pauta, backoff_pct: null }, Array.from({ length: series }, (_, i) => ({ reps: i === 0 ? r + 1 : r, kg: pauta.carga_sugerida_kg, rpe: pauta.rpe_objetivo })));
    const total = propuesta.series_detalle ? `${propuesta.series_detalle.map((x) => x.reps).join(', ')}` : `${r + 1} en cada serie`;
    return { tipo: 'reps', propuesta, orientativa: null, motivo: `Completó ${l.n === 1 ? 'la serie' : `las ${l.n} series`} de ${r}: ahora ${total}`,
      alternativas: [alt('mantener', 'Mantener', campos(pauta))], avisos: [] };
  }
  if (fijas) return igual(`No completó las series de ${l.repsMax}: repite`);
  // Con rango: el objetivo de la semana es una repetición más en la serie más atrasada
  const hechas = l.trabajo.map((s) => Number(s.reps));
  const objetivo = [...hechas];
  const menor = Math.min(...objetivo);
  const i = objetivo.indexOf(menor);
  if (cada) objetivo.forEach((x, k) => { objetivo[k] = Math.min(Number(l.repsMax), x + 1); });
  else objetivo[i] = Math.min(Number(l.repsMax), menor + 1);
  return { tipo: 'reps', propuesta: campos(pauta), orientativa: null, motivo: `Hizo ${hechas.join(', ')} de ${rango(l)}: objetivo ${objetivo.join(', ')}`, alternativas: [], avisos: [] };
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
  const basico = esBasico(ejercicio);
  const pico = !!ctx.peaking && basico && T.peaking.cuando === 'foco';
  if (esTopBackoff(pauta)) {
    if (pico) return picoTopBackoff(l, pauta, ctx);
    const r = doble(l, pauta, ctx);
    return ctx.topSet ? r : { ...r, avisos: [...r.avisos, 'Con top + back-off se usa la doble progresión sobre la serie top'] };
  }
  if (['sin_registrar', 'cambiado', 'dato_raro'].includes(l.diagnostico)) return sinDatos(l, pauta);
  const [suelo, tope] = rangoDe({ pauta, ejercicio, reglas });
  const laEligeEl = R.sinKilos !== 'como_los_demas' && !!nivel && modoCarga(nivel, pauta.prioridad) === 'rpe';
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
    return { kg, reps: Number(h.reps), rpe: reserva == null ? null : 10 - reserva, mueveKg: o.kg != null && kg > 0 && !laEligeEl };
  });
  // Top y back-off: la top es la serie (o series) a la carga más alta; se mira lo que movió y, si falta, lo pautado
  const est = pico || ctx.topSet ? estructuraTop(objetivos.map((o, i) => (datos[i]?.kg > 0 ? datos[i].kg : o.kg ?? null))) : null;
  const rol = objetivos.map((_, i) => (!est ? 'normal' : pico ? (est.tops.includes(i) ? 'top' : 'backoff') : est.forma === 'top_primero' && i !== est.tops[0] ? 'backoff' : 'normal'));
  const objetivoPauta = objetivoReserva(pauta);
  const pk = pico && est ? topPeaking(est.tops.filter((i) => datos[i]).map((i) => ({ kg: datos[i].kg, reps: datos[i].reps, rpe: datos[i].rpe,
    pautadas: detalle && objetivos[i].reps != null ? Number(objetivos[i].reps) : null,
    objetivo: objetivos[i].rpe != null ? Number(objetivos[i].rpe) : objetivoPauta != null ? 10 - objetivoPauta : null })), { nombre, reglas }) : null;
  // Varias series al tope la misma semana: suben todas las que fueron fáciles; de las demás, solo la primera
  const alTope = datos.map((x, i) => (x && x.mueveKg && x.reps >= tope && rol[i] !== 'backoff' ? i : -1)).filter((i) => i >= 0);
  const sube = (i) => R.variasAlTope === 'todas' || i === alTope[0] || (R.variasAlTope === 'faciles' && datos[i].rpe != null && datos[i].rpe <= R.topeFacilRpe);
  const acciones = [];
  let salto = 0;
  const d = objetivos.map((o, i) => {
    const x = datos[i];
    if (!x) { acciones.push('falta'); return { ...o }; }
    const { kg, reps, rpe, mueveKg } = x;
    // Los kilos de la serie: los que movió (si la pauta lleva kilos); subirlos solo se puede donde los pauta el coach
    const kgBase = o.kg != null && kg > 0 ? kg : o.kg;
    const con = (cambio) => { const f = { ...o, ...cambio }; if (f.kg == null) delete f.kg; return f; };
    const subir = () => { const paso = saltoDe(nombre, kg, reglas); salto = salto || paso; return dos(kg + paso); };
    // Igual: lo que hizo si cumplió lo pautado; si no, lo pautado
    const cumplio = (o.reps == null || reps >= Number(o.reps)) && (o.kg == null || kg >= Number(o.kg) - 0.001);
    const igual = () => (cumplio ? con({ kg: kgBase, reps }) : { ...o });
    if (rol[i] === 'top' && pk) {
      if (pk.accion === 'dura') { acciones.push('pk_dura'); return igual(); }
      if (!mueveKg) { acciones.push('pk_elige'); return con({ kg: kgBase, reps: pk.reps }); }
      acciones.push(pk.accion === 'suelo' ? (pk.delta > 0 ? 'pk_suelo_sube' : 'pk_suelo') : pk.delta > 0 ? 'pk' : 'pk_mismo');
      return pk.accion === 'suelo' && !(pk.delta > 0) ? igual() : con({ kg: pk.kg, reps: pk.reps });
    }
    if (rol[i] === 'backoff' && T.backoff !== 'solas') {
      if (T.backoff === 'faciles' && mueveKg && rpe != null && rpe <= T.backoffFacilRpe) { acciones.push('bo_sube'); return con({ kg: subir(), reps }); }
      acciones.push('bo_igual'); return igual();
    }
    if (reps >= tope) {
      if (mueveKg && sube(i)) { acciones.push('tope_kg'); return con({ kg: subir(), reps: suelo }); }
      if (mueveKg) { acciones.push('espera'); return con({ kg: kgBase, reps }); }
      acciones.push('tope'); return con({ kg: kgBase, reps: Math.max(tope, Number(o.reps ?? tope)) });
    }
    if (mueveKg && sobradoVale && rpe != null && rpe <= R.sobradoRpe) { acciones.push('sobrada'); return con({ kg: subir(), reps }); }
    if (reps < suelo) { acciones.push('bajo'); return con({ kg: kgBase, reps: Math.max(reps, Number(o.reps ?? reps)) }); }
    if (rpe == null || rpe <= R.rpeSube) { acciones.push('rep'); return con({ kg: kgBase, reps: Math.min(tope, reps + 1) }); }
    acciones.push('igual'); return igual();
  });
  const TEXTO = {
    tope_kg: `al tope (${tope}), sube ${kilos(salto)} y vuelve a ${suelo}`, sobrada: `sobrada (RPE ${num(R.sobradoRpe)} o menos), sube ${kilos(salto)} con las mismas repeticiones`,
    rep: 'una repetición más', igual: `igual (RPE por encima de ${num(R.rpeSube)})`, espera: `al tope (${tope}) pero justa, espera a que suba la primera`,
    tope: `al tope (${tope}): le toca subir de carga, que elige ${laEligeEl ? 'el atleta' : 'tú'}`, bajo: `por debajo del rango (${suelo}–${tope}), igual`, falta: 'sin hacer, igual',
    bo_sube: `back-off fácil (RPE ${num(T.backoffFacilRpe)} o menos), sube ${kilos(salto)}`, bo_igual: 'back-off, igual',
    ...(pk && pk.accion !== 'dura' ? (() => {
      const menos = `${T.peaking.reps === 1 ? 'una repetición menos' : `${T.peaking.reps} repeticiones menos`} por peaking (${pk.reps})`;
      const ya = `peaking, ya en ${pk.reps} ${pk.reps === 1 ? 'repetición' : 'repeticiones'}`;
      return { pk: `${menos} y ${kilos(pk.kg)} (+${kilos(pk.delta)}) para mantener el esfuerzo`, pk_mismo: `${menos} con los mismos kilos`,
        pk_elige: `${menos}; la carga la elige el atleta`, pk_suelo_sube: `${ya}: sube ${kilos(pk.delta)}`, pk_suelo: `${ya} y exigente: igual` };
    })() : {}),
    pk_dura: `peaking, pero salió muy dura (RPE por encima de ${num(T.peaking.duraRpe)}): repite tal cual`,
  };
  const grupos = [];
  acciones.forEach((a, i) => { const g = grupos.find((x) => x.a === a); if (g) g.ns.push(i + 1); else grupos.push({ a, ns: [i + 1] }); });
  const frase = (g) => `${grupos.length === 1 && g.ns.length > 1 ? `las ${g.ns.length} series` : listaSeries(g.ns)}: ${TEXTO[g.a]}`;
  const texto = grupos.map(frase).join(' · ');
  const motivo = texto.charAt(0).toUpperCase() + texto.slice(1);
  const tipo = acciones.some((a) => ['tope_kg', 'sobrada', 'bo_sube', 'pk', 'pk_suelo_sube'].includes(a)) ? 'subir'
    : acciones.some((a) => a === 'pk_mismo' || a === 'pk_elige') ? 'peaking' : acciones.includes('rep') ? 'reps' : 'mantener';
  // Si nada cambia respecto a lo pautado, la pauta se queda en su formato (no se pasa a serie a serie porque sí)
  const pautado = detalle ? pauta.series_detalle : objetivos.map(() => dePauta);
  // Tampoco si la pauta no era serie a serie y ninguna serie progresa: se deja como la escribió el coach
  const nadaProgresa = !detalle && acciones.every((a) => ['igual', 'falta', 'bajo', 'espera', 'tope', 'bo_igual', 'pk_dura', 'pk_suelo'].includes(a));
  const sinCambios = nadaProgresa || JSON.stringify(limpiarDetalle(d)) === JSON.stringify(limpiarDetalle(pautado));
  const enPico = !!pk && acciones.some((a) => a.startsWith('pk'));
  return { tipo: sinCambios && tipo !== 'mantener' ? 'mantener' : tipo, propuesta: sinCambios ? campos(pauta) : conDetalle({ ...pauta, backoff_pct: null }, d), motivo,
    orientativa: acciones.includes('pk_elige') && pk.delta > 0 ? pk.kg : null, ...(enPico ? { fase: 'peaking' } : {}),
    alternativas: [...(sinCambios ? [] : [alt('mantener', 'Mantener', campos(pauta))]), ...(enPico ? [alt('sin_peaking', 'Sin peaking', porSerie(l, pauta, { ...ctx, peaking: false }).propuesta)] : [])],
    avisos: pk?.limitada ? [`La subida calculada pasaba del ${num(T.peaking.maxPct)} %: se ha limitado`] : acciones.includes('tope') ? [`Ha llegado al tope en ${acciones.filter((a) => a === 'tope').length === acciones.length ? 'todas las series' : `la${acciones.filter((a) => a === 'tope').length > 1 ? 's' : ''} ${listaSeries(acciones.map((a, k) => (a === 'tope' ? k + 1 : null)).filter(Boolean))}`}: le toca subir de carga`] : [] };
}

// Peaking con el «top + back-off» de la app (la top es la serie 1; las back-off salen solas de su %)
function picoTopBackoff(l, pauta, ctx) {
  const { reglas, nombre = '' } = ctx;
  const P = reglas.topSet.peaking;
  const top = l.trabajo[0];
  if (!top) return sinDatos(l, pauta);
  const reserva = enReserva(top), objetivo = objetivoReserva(pauta);
  const pk = topPeaking([{ kg: Number(top.kg), reps: Number(top.reps), rpe: reserva == null ? null : 10 - reserva,
    pautadas: pauta.reps_max ?? pauta.reps_min ?? null, objetivo: objetivo == null ? null : 10 - objetivo }], { nombre, reglas });
  if (!pk) return sinDatos(l, pauta);
  const sinPico = alt('sin_peaking', 'Sin peaking', doble(l, pauta, ctx).propuesta);
  if (pk.accion === 'dura') {
    return { tipo: 'mantener', propuesta: mantenerEn(l, pauta), orientativa: null, fase: 'peaking', alternativas: [sinPico], avisos: [],
      motivo: `Peaking, pero la top salió muy dura (RPE por encima de ${num(P.duraRpe)}): repite tal cual` };
  }
  const max = Number(pauta.reps_max ?? pauta.reps_min ?? top.reps), min = Number(pauta.reps_min ?? max);
  const llevaKg = pauta.carga_sugerida_kg != null;
  const propuesta = { ...campos(pauta), reps_max: pk.reps, reps_min: min < max ? Math.max(Math.min(P.suelo, pk.reps), Math.min(pk.reps, min - (max - pk.reps))) : pk.reps,
    carga_sugerida_kg: llevaKg ? pk.kg : null };
  const menos = pk.accion === 'suelo' ? `ya en ${pk.reps} ${pk.reps === 1 ? 'repetición' : 'repeticiones'}` : `${P.reps === 1 ? 'una repetición menos' : `${P.reps} repeticiones menos`} en la top (${pk.reps})`;
  const carga = !llevaKg ? `la carga la elige el atleta${pk.delta > 0 ? ` (orientativo: ${kilos(pk.kg)})` : ''}` : pk.delta > 0 ? `${kilos(pk.kg)} (+${kilos(pk.delta)}) para mantener el esfuerzo` : 'los mismos kilos';
  return { tipo: llevaKg && pk.delta > 0 ? 'subir' : pk.accion === 'suelo' ? 'mantener' : 'peaking', propuesta, orientativa: !llevaKg && pk.delta > 0 ? pk.kg : null, fase: 'peaking',
    motivo: `Peaking: ${menos}, ${carga}`, alternativas: [alt('mantener', 'Mantener', mantenerEn(l, pauta)), sinPico],
    avisos: pk.limitada ? [`La subida calculada pasaba del ${num(P.maxPct)} %: se ha limitado`] : [] };
}

// ---------- Top set + back-off ----------
// La progresión serie a serie con la top y las back-off diferenciadas (para pedirlo en un ejercicio que no sea básico)
export const topSet = (l, pauta, ctx) => porSerie(l, pauta, { ...ctx, topSet: true });

// ---------- Sin regla ----------
export const mantener = (l, pauta) => ({ tipo: 'mantener', propuesta: campos(pauta), orientativa: null, motivo: 'Modelo «mantener»: se copia la semana', alternativas: [], avisos: [] });
export const aMano = (l, pauta) => ({ tipo: 'sin_tocar', propuesta: campos(pauta), orientativa: null, motivo: 'A mano: la app no toca este ejercicio', alternativas: [], avisos: [] });

export const MODELO = { por_serie: porSerie, top_set: topSet, doble, triple, lineal, solo_reps: soloReps, mantener, a_mano: aMano };
