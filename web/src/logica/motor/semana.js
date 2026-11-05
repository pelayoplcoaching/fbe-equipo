// «Programar según FBE», paso 3: la semana entera. Señales de descarga y sus cuatro tipos, vuelta tras un parón
// y mantenimiento. Decisión del 5/11/2026: de partida la descarga la proponen solo las señales (sin calendario)
// y las molestias no cuentan como señal.
import { num, tieneDetalle, esTopBackoff, limpiarDetalle, agregadosDetalle } from '../calculos.js';
import { progresarPauta } from '../progresion.js';
import { consejoPreparacion } from '../preparacion.js';
import { diasEntre } from '../fechas.js';
import { campos } from './modelos.js';
import { saltoDe, SIN_DATOS } from './lectura.js';
import { REGLAS_FBE } from './reglas.js';

const dos = (x) => Math.round(x * 100) / 100;
export const NOMBRE_DESCARGA = { ligera: 'ligera', volumen: 'de volumen', intensidad: 'de intensidad', tecnica: 'de técnica' };

// «¿Cómo llegas hoy?» en el nivel más bajo
export const esMalDia = (sesion) => consejoPreparacion(sesion?.preparacion)?.nivel === 'malo';

// Días desde la última sesión hecha hasta hoy (null si no hay ninguna)
export function diasParado(fechas, hoy) {
  const ultimas = (fechas || []).filter(Boolean).sort();
  return ultimas.length && hoy ? Math.max(0, diasEntre(ultimas[ultimas.length - 1], hoy)) : null;
}

// Un recorte de kilos en %, al salto del ejercicio y siempre por debajo de lo que había
function recortarKg(kg, pct, nombre, reglas) {
  const k = Number(kg);
  if (!(k > 0) || !(pct > 0)) return kg ?? null;
  const paso = saltoDe(nombre, k, reglas);
  let t = Math.round((k * (1 - pct / 100)) / paso) * paso;
  if (t >= k) t = k - paso;
  if (t <= 0) t = Math.round(k * (1 - pct / 100) * 2) / 2;
  return dos(Math.max(0, Math.min(k, t)));
}
const minimoSeries = (p) => (esTopBackoff(p) ? 2 : 1);

// Aplica a una pauta un recorte: { kgPct, series: n a quitar | 'mitad' | factor (0–1), rpeMenos, rpeMax }
function recortar(pauta, { kgPct = 0, quitar = 0, factor = null, rpeMenos = 0, rpeMax = null }, nombre, reglas) {
  const p = campos(pauta);
  const rpe = (v) => { if (v == null) return v; let x = Number(v); if (rpeMenos) x = Math.min(x, Math.max(5, x - rpeMenos)); if (rpeMax != null) x = Math.min(x, rpeMax); return x; };
  const cuantas = (n) => Math.max(minimoSeries(pauta), factor != null ? Math.round(n * factor) : n - quitar);
  if (tieneDetalle(pauta)) {
    const d = p.series_detalle.slice(0, Math.min(p.series_detalle.length, Math.max(1, cuantas(p.series_detalle.length))))
      .map((x) => ({ ...x, ...(x.kg != null ? { kg: recortarKg(x.kg, kgPct, nombre, reglas) } : {}), ...(x.rpe != null ? { rpe: rpe(x.rpe) } : {}) }));
    const limpio = limpiarDetalle(d);
    const f = limpio ? { ...p, series_detalle: limpio, ...agregadosDetalle(limpio) } : p;
    if (f.rir_objetivo != null && rpeMenos) f.rir_objetivo = Math.min(10, Number(f.rir_objetivo) + rpeMenos);
    return f;
  }
  if (p.series != null) p.series = cuantas(Number(p.series));
  if (p.carga_sugerida_kg != null) p.carga_sugerida_kg = recortarKg(p.carga_sugerida_kg, kgPct, nombre, reglas);
  p.rpe_objetivo = rpe(p.rpe_objetivo);
  if (p.rir_objetivo != null) {
    let r = Number(p.rir_objetivo) + rpeMenos;
    if (rpeMax != null) r = Math.max(r, 10 - rpeMax);
    p.rir_objetivo = Math.min(10, r);
  }
  return p;
}

// Los cuatro tipos de descarga. kgBase: los kilos con los que trabajó (si la pauta lleva carga, se parte de ellos).
//   ligera      una serie menos, −10 % de kilos y RPE −1 (la que ya hace «Preparar las siguientes»)
//   volumen     la mitad de las series, mismos kilos, RPE −1
//   intensidad  mismas series, −15 % de kilos, RPE −2
//   tecnica     una serie menos, −20 % de kilos, RPE máximo 6
export function aplicarDescarga(pauta, { tipo = 'ligera', nombre = '', kgBase = 0, reglas = REGLAS_FBE } = {}) {
  const base = !tieneDetalle(pauta) && pauta.carga_sugerida_kg != null && kgBase > 0 ? { ...pauta, carga_sugerida_kg: dos(kgBase) } : pauta;
  const d = reglas.descarga;
  if (tipo === 'volumen') return recortar(base, { factor: 0.5, rpeMenos: 1 }, nombre, reglas);
  if (tipo === 'intensidad') return recortar(base, { kgPct: d.intensidadPct, rpeMenos: 2 }, nombre, reglas);
  if (tipo === 'tecnica') return recortar(base, { kgPct: d.tecnicaPct, quitar: 1, rpeMax: 6 }, nombre, reglas);
  return campos(progresarPauta(campos(base), undefined, { nombre, descarga: true }));
}
export function motivoDescarga(tipo, reglas = REGLAS_FBE) {
  const d = reglas.descarga;
  return {
    ligera: 'Descarga ligera: una serie menos, −10 % de kilos y RPE −1',
    volumen: 'Descarga de volumen: la mitad de las series, mismos kilos y RPE −1',
    intensidad: `Descarga de intensidad: mismas series, −${num(d.intensidadPct)} % de kilos y RPE −2`,
    tecnica: `Descarga de técnica: una serie menos, −${num(d.tecnicaPct)} % de kilos y RPE máximo 6`,
  }[tipo] || 'Descarga';
}

// Las cinco señales que proponen una descarga. Una la propone; dos la marcan como recomendada.
//   filas: [{ prioridad, tendencia, lectura }] · checkins: [{ semana_inicio, energia, recuperacion }]
//   carga: { ratio } (última semana frente a la media de 4) · sesiones: las de la semana, con su preparación
export function senalesDescarga({ filas = [], checkins = [], carga = null, sesiones = [], reglas = REGLAS_FBE } = {}) {
  const senales = [];
  const baja = filas.filter((f) => f.prioridad === 'alta' && f.tendencia === 'bajando').length;
  if (baja >= 2) senales.push({ id: 'rendimiento', texto: `${baja} ejercicios obligatorios van a la baja` });
  const dosUltimos = [...checkins].filter((c) => c?.semana_inicio).sort((a, b) => (a.semana_inicio < b.semana_inicio ? 1 : -1)).slice(0, 2);
  const bajo = (c) => (c.energia != null && c.energia <= reglas.frenos.checkinBajo) || (c.recuperacion != null && c.recuperacion <= reglas.frenos.checkinBajo);
  if (dosUltimos.length === 2 && diasEntre(dosUltimos[1].semana_inicio, dosUltimos[0].semana_inicio) === 7 && dosUltimos.every(bajo)) {
    senales.push({ id: 'checkin', texto: 'Energía o recuperación bajas en dos check-in seguidos' });
  }
  if (carga?.ratio >= 1.5) senales.push({ id: 'carga', texto: `Carga de la semana ${num(carga.ratio, 2)} veces su media de cuatro semanas` });
  const conEsfuerzo = filas.filter((f) => f.lectura && f.lectura.objetivo != null && f.lectura.reservas.length && !SIN_DATOS.includes(f.lectura.diagnostico));
  const pasados = conEsfuerzo.filter((f) => f.lectura.diagnostico === 'pasado').length;
  if (conEsfuerzo.length >= 2 && pasados / conEsfuerzo.length >= 0.5) senales.push({ id: 'esfuerzo', texto: `Se pasó del esfuerzo pautado en ${pasados} de ${conEsfuerzo.length} ejercicios` });
  const conPreparacion = sesiones.filter((s) => s.completada && consejoPreparacion(s.preparacion));
  const malas = conPreparacion.filter(esMalDia).length;
  if (conPreparacion.length >= 2 && malas / conPreparacion.length >= 0.5) senales.push({ id: 'preparacion', texto: `Llegó mal a ${malas} de ${conPreparacion.length} sesiones` });
  return senales;
}

// ---------- vuelta tras un parón ----------
// El tramo que toca por los días parado (el más alto cuyo «desde» se cumple), o null
export function tramoVuelta(dias, reglas = REGLAS_FBE) {
  if (dias == null) return null;
  return [...(reglas.vuelta || [])].sort((a, b) => b.desde - a.desde).find((t) => dias >= t.desde) || null;
}
export const aplicarVuelta = (pauta, tramo, { nombre = '', reglas = REGLAS_FBE } = {}) => recortar(pauta, { kgPct: tramo.kgPct, quitar: tramo.series, rpeMax: tramo.rpeMax ?? null }, nombre, reglas);
export function motivoVuelta(dias, tramo) {
  const partes = [tramo.kgPct ? `−${num(tramo.kgPct)} % de kilos` : null, tramo.series ? (tramo.series === 1 ? 'una serie menos' : `${tramo.series} series menos`) : null, tramo.rpeMax != null ? `RPE máximo ${num(tramo.rpeMax)}` : null].filter(Boolean);
  return `Vuelta tras ${dias} días sin entrenar: ${partes.join(', ')}`;
}

// ---------- mantenimiento ----------
// Mismas cargas con una parte de las series (de partida, la mitad)
export const aplicarMantenimiento = (pauta, { reglas = REGLAS_FBE } = {}) => recortar(pauta, { factor: reglas.mantenimiento.series }, '', reglas);
