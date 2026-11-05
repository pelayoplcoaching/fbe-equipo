// «Programar según FBE», paso 1: leer lo que hizo el atleta.
// Cada ejercicio de la semana se resume en un diagnóstico; los modelos deciden con él, no con los números sueltos.
//
//   superado      llegó al tope del rango según el criterio de subida, sin pasarse de esfuerzo
//   sobrado       superado y, además, 2 puntos o más por debajo del RPE objetivo
//   en_rango      dentro del rango sin llegar al tope
//   por_debajo    alguna serie de trabajo bajo el mínimo del rango
//   pasado        alguna serie más de 1 punto por encima del RPE objetivo
//   a_medias      hizo menos series de las pautadas
//   cambiado      lo sustituyó por otro ejercicio
//   sin_registrar no hay series
//   dato_raro     todo lo que hay parece una errata
//   sin_rango     la pauta no tiene repeticiones con las que comparar
//
// Además, banderas que no cambian el diagnóstico pero sí la confianza: sin esfuerzo apuntado, trabajó con otra
// carga que la pautada, series descartadas por raras y mal día.
import { enReserva, e1rm, incrementoCarga, esTopBackoff, tieneDetalle, num } from '../calculos.js';
import { REGLAS_FBE } from './reglas.js';

export const DIAGNOSTICOS = ['superado', 'sobrado', 'en_rango', 'por_debajo', 'pasado', 'a_medias', 'cambiado', 'sin_registrar', 'dato_raro', 'sin_rango'];
// Con estos no hay nada fiable con lo que decidir: se mantiene la pauta y se marca
export const SIN_DATOS = ['a_medias', 'cambiado', 'sin_registrar', 'dato_raro', 'sin_rango'];

const kgDe = (s) => (s?.kg != null && Number(s.kg) > 0 ? Number(s.kg) : 0);
const repsDe = (s) => Number(s?.reps) || 0;
const rpeDe = (s) => { const r = enReserva(s || {}); return r == null ? null : 10 - r; };

// El salto de carga que vale para estas reglas
export function saltoDe(nombre, kg, reglas = REGLAS_FBE) {
  const s = reglas.salto || {};
  if (s.tipo === 'kg' && Number(s.valor) > 0) return Number(s.valor);
  if (s.tipo === 'pct' && Number(s.valor) > 0 && Number(kg) > 0) return Math.max(0.5, Math.round((Number(kg) * Number(s.valor)) / 100 * 2) / 2);
  return incrementoCarga(nombre, kg);
}

// Repeticiones en reserva que pide la pauta (o la serie pautada): RIR si lo hay; si no, 10 − RPE; si no, null
export function objetivoReserva(p) {
  if (p?.rir_objetivo != null && p.rir_objetivo !== '') return Number(p.rir_objetivo);
  const rpe = p?.rpe_objetivo ?? p?.rpe;
  return rpe != null && rpe !== '' ? 10 - Number(rpe) : null;
}

// Lo hecho en una línea, para el coach: «80 kg × 12, 12, 11 @8–9»; con cargas distintas, «80×12 · 80×12 · 75×10»
export function textoHecho(series) {
  if (!series?.length) return null;
  const kgs = [...new Set(series.map(kgDe))];
  const rpes = series.map(rpeDe).filter((x) => x != null);
  const esfuerzo = !rpes.length ? '' : Math.min(...rpes) === Math.max(...rpes) ? ` @${num(rpes[0])}` : ` @${num(Math.min(...rpes))}–${num(Math.max(...rpes))}`;
  if (kgs.length === 1) return `${kgs[0] > 0 ? `${num(kgs[0], 2)} kg × ` : ''}${series.map(repsDe).join(', ')}${kgs[0] > 0 ? '' : ' rep'}${esfuerzo}`;
  return `${series.map((s) => (kgDe(s) > 0 ? `${num(kgDe(s), 2)}×${repsDe(s)}` : `${repsDe(s)} rep`)).join(' · ')}${esfuerzo}`;
}

// ¿Parece una errata? Kilos muy lejos de lo pautado y de la última vez (las dos cosas, si hay las dos), o
// repeticiones a más del doble del tope.
function esRara(s, { pautado, ultima, repsMax, nombre, reglas }) {
  const f = reglas.frenos;
  if (repsMax > 0 && repsDe(s) > repsMax * f.datoRaroReps) return true;
  const kg = kgDe(s);
  const refs = [pautado, ultima].filter((x) => x != null && Number(x) > 0).map(Number);
  if (!refs.length || !(kg > 0)) return false;
  return refs.every((ref) => Math.abs(kg - ref) > Math.max((ref * f.datoRaroPct) / 100, f.datoRaroSaltos * saltoDe(nombre, ref, reglas)));
}

function vacia(diagnostico, extra = {}) {
  return { diagnostico, detalle: false, top: false, n: 0, hechas: [], trabajo: [], kgTrabajo: 0, alTope: 0, enRango: 0, repsMin: null, repsMax: null,
    objetivo: null, reservas: [], e1rm: null, texto: null, banderas: { sinEsfuerzo: false, otraCarga: 0, raras: [], malDia: false }, ...extra };
}

// ¿Cumple el criterio de subida? trabajo: series a la carga de trabajo, en orden; n: las pautadas
export function cumpleCriterio(criterio, { trabajo, n, repsMin, repsMax }) {
  const alTope = trabajo.filter((s) => repsDe(s) >= repsMax).length;
  const enRango = trabajo.filter((s) => repsDe(s) >= repsMin).length;
  if (criterio === 'primera') return trabajo.length > 0 && repsDe(trabajo[0]) >= repsMax;
  if (criterio === 'suma') return trabajo.length >= n && trabajo.slice(0, n).reduce((t, s) => t + repsDe(s), 0) >= n * repsMax - (n > 1 ? n : 0) && enRango >= n;
  if (criterio === 'todas_menos_una') return n <= 1 ? alTope >= 1 : alTope >= n - 1 && enRango >= n;
  return alTope >= n; // 'todas'
}

// Lee un ejercicio de la semana.
//   pauta: lo pautado (sesion_ejercicios) · series: lo hecho (series) · nombre: el del ejercicio (para su salto)
//   malDia: «¿cómo llegas hoy?» de esa sesión salió en el nivel más bajo · ultimaVez: kilos de trabajo de la vez anterior
export function leerEjercicio({ pauta, series = [], nombre = '', reglas = REGLAS_FBE, malDia = false, ultimaVez = null } = {}) {
  if (!pauta) return vacia('sin_registrar');
  if (tieneDetalle(pauta)) return leerDetalle({ pauta, series, nombre, reglas, malDia, ultimaVez });
  const top = esTopBackoff(pauta);
  const n = top ? 1 : Math.max(1, Number(pauta.series) || 1);
  const repsMax = pauta.reps_max ?? pauta.reps_min ?? null;
  const repsMin = pauta.reps_min ?? pauta.reps_max ?? null;
  const objetivo = objetivoReserva(pauta);
  const comun = { top, n, repsMin, repsMax, objetivo };
  const todas = [...(series || [])].sort((a, b) => Number(a.numero) - Number(b.numero));
  const propias = todas.filter((s) => !s.sustituto_id && repsDe(s) > 0);
  if (!propias.length) return vacia(todas.some((s) => s.sustituto_id) ? 'cambiado' : 'sin_registrar', comun);

  const pautado = pauta.carga_sugerida_kg != null ? Number(pauta.carga_sugerida_kg) : null;
  const raras = propias.filter((s) => esRara(s, { pautado, ultima: ultimaVez, repsMax, nombre, reglas }));
  const hechas = propias.filter((s) => !raras.includes(s));
  const banderas = { sinEsfuerzo: false, otraCarga: 0, raras: raras.map((s) => Number(s.numero)), malDia: !!malDia };
  if (!hechas.length) return vacia('dato_raro', { ...comun, banderas, texto: textoHecho(propias) });

  // Con top + back-off solo cuenta la top; si no, las series a la carga más alta son las de trabajo
  const candidatas = top ? hechas.filter((s) => Number(s.numero) === 1).slice(0, 1) : hechas;
  const kgTrabajo = candidatas.length ? Math.max(...candidatas.map(kgDe)) : 0;
  const trabajo = candidatas.filter((s) => kgDe(s) === kgTrabajo);
  const reservas = trabajo.map((s) => enReserva(s)).filter((x) => x != null);
  const mejor = Math.max(0, ...hechas.map((s) => e1rm(s) || 0)) || null;
  if (pautado != null && pautado > 0 && kgTrabajo > 0) {
    const dif = kgTrabajo - pautado;
    if (Math.abs(dif) >= saltoDe(nombre, pautado, reglas) - 0.001) banderas.otraCarga = Math.round(dif * 100) / 100;
  }
  banderas.sinEsfuerzo = objetivo != null && !reservas.length;
  const base = { ...comun, detalle: false, hechas, trabajo, kgTrabajo, reservas, e1rm: mejor, texto: textoHecho(hechas), banderas };
  if (repsMax == null) return { ...vacia('sin_rango'), ...base, diagnostico: 'sin_rango' };
  const alTope = trabajo.filter((s) => repsDe(s) >= repsMax).length;
  const enRango = trabajo.filter((s) => repsDe(s) >= repsMin).length;
  const con = (diagnostico) => ({ ...base, diagnostico, alTope, enRango });
  if ((top ? candidatas.length : hechas.length) < n) return con('a_medias');
  if (trabajo.some((s) => repsDe(s) < repsMin)) return con('por_debajo');
  const f = reglas.frenos;
  if (objetivo != null && reservas.some((r) => r < objetivo - f.pasadoDeEsfuerzo)) return con('pasado');
  const sinPasarse = objetivo == null || !reservas.length || reservas.every((r) => r >= objetivo - reglas.doble.margen);
  if (sinPasarse && cumpleCriterio(reglas.doble.criterio, { trabajo, n, repsMin, repsMax })) {
    const sobrado = objetivo != null && reservas.length === trabajo.length && reservas.every((r) => r >= objetivo + f.sobrado);
    return con(sobrado ? 'sobrado' : 'superado');
  }
  return con('en_rango');
}

// Serie a serie (series_detalle): no hay rango, así que cada serie se compara con su objetivo.
//   cumplida: hizo al menos las repeticiones pautadas, con al menos los kilos pautados y sin pasarse de esfuerzo
// El criterio de subida se aplica a las cumplidas; «por debajo» es quedarse a 2 repeticiones o más en alguna.
function leerDetalle({ pauta, series, nombre, reglas, malDia, ultimaVez }) {
  const d = pauta.series_detalle;
  const n = d.length;
  const f = reglas.frenos;
  const reps = d.map((x) => x.reps).filter((x) => x != null);
  const comun = { detalle: true, top: false, n, repsMin: reps.length ? Math.min(...reps) : null, repsMax: reps.length ? Math.max(...reps) : null, objetivo: objetivoReserva(pauta) };
  const todas = [...(series || [])].sort((a, b) => Number(a.numero) - Number(b.numero));
  const propias = todas.filter((s) => !s.sustituto_id && repsDe(s) > 0);
  if (!propias.length) return vacia(todas.some((s) => s.sustituto_id) ? 'cambiado' : 'sin_registrar', comun);
  const objetivoDe = (s) => d[Number(s.numero) - 1] || null;
  const raras = propias.filter((s) => { const o = objetivoDe(s); return esRara(s, { pautado: o?.kg ?? null, ultima: ultimaVez, repsMax: o?.reps ?? comun.repsMax, nombre, reglas }); });
  const hechas = propias.filter((s) => !raras.includes(s));
  const banderas = { sinEsfuerzo: false, otraCarga: 0, raras: raras.map((s) => Number(s.numero)), malDia: !!malDia };
  if (!hechas.length) return vacia('dato_raro', { ...comun, banderas, texto: textoHecho(propias) });

  const porNumero = Object.fromEntries(hechas.map((s) => [Number(s.numero), s]));
  const filas = d.map((o, i) => {
    const h = porNumero[i + 1] || null;
    if (!h) return { o, h, estado: 'falta' };
    const objetivo = o.rpe != null ? 10 - Number(o.rpe) : comun.objetivo;
    const r = enReserva(h);
    const pasada = objetivo != null && r != null && r < objetivo - f.pasadoDeEsfuerzo;
    const sinPasarse = objetivo == null || r == null || r >= objetivo - reglas.doble.margen;
    const faltan = o.reps != null ? Number(o.reps) - repsDe(h) : 0;
    const conKilos = o.kg == null || kgDe(h) >= Number(o.kg) - 0.001;
    const estado = pasada ? 'pasada' : faltan >= f.detalleCorta ? 'corta' : faltan <= 0 && conKilos && sinPasarse ? 'cumplida' : 'casi';
    return { o, h, estado, objetivo, reserva: r };
  });
  const con = (k) => filas.filter((x) => x.estado === k).length;
  const kgs = hechas.map(kgDe);
  const kgTrabajo = Math.max(...kgs);
  const reservas = hechas.map((s) => enReserva(s)).filter((x) => x != null);
  const conObjetivo = filas.filter((x) => x.h && x.objetivo != null);
  banderas.sinEsfuerzo = conObjetivo.length > 0 && conObjetivo.every((x) => x.reserva == null);
  const difs = filas.filter((x) => x.h && x.o.kg != null && kgDe(x.h) > 0).map((x) => kgDe(x.h) - Number(x.o.kg));
  const mayor = difs.sort((a, b) => Math.abs(b) - Math.abs(a))[0] || 0;
  if (Math.abs(mayor) >= saltoDe(nombre, kgTrabajo, reglas) - 0.001) banderas.otraCarga = Math.round(mayor * 100) / 100;
  const base = { ...comun, hechas, trabajo: hechas, kgTrabajo, reservas, e1rm: Math.max(0, ...hechas.map((s) => e1rm(s) || 0)) || null,
    texto: textoHecho(hechas), banderas, alTope: con('cumplida'), enRango: con('cumplida') + con('casi'), porSerie: filas };
  if (!reps.length) return { ...base, diagnostico: 'sin_rango' };
  if (con('falta') > 0) return { ...base, diagnostico: 'a_medias' };
  if (con('corta') > 0) return { ...base, diagnostico: 'por_debajo' };
  if (con('pasada') > 0) return { ...base, diagnostico: 'pasado' };
  const criterio = reglas.doble.criterio;
  const cumple = criterio === 'primera' ? filas[0].estado === 'cumplida'
    : criterio === 'todas' ? con('cumplida') >= n
      : n <= 1 ? con('cumplida') >= 1 : con('cumplida') >= n - 1; // 'todas_menos_una' y 'suma'
  if (cumple) {
    const sobrado = filas.every((x) => x.objetivo != null && x.reserva != null && x.reserva >= x.objetivo + f.sobrado);
    return { ...base, diagnostico: sobrado ? 'sobrado' : 'superado' };
  }
  return { ...base, diagnostico: 'en_rango' };
}

// ---------- tendencia de cuatro semanas ----------
// valores: el mejor 1RM estimado de cada semana, de la más antigua a la más reciente (null = sin dato; se salta).
//   subiendo   mejora de media un 1 % o más por semana
//   estancado  tres semanas sin superar lo anterior
//   bajando    dos semanas seguidas a la baja
//   estable    lo demás · null: menos de tres semanas con dato
export function tendencia(valores, reglas = REGLAS_FBE) {
  const v = (valores || []).filter((x) => x != null && Number(x) > 0).map(Number);
  if (v.length < 3) return null;
  const t = reglas.tendencia;
  const u = v.slice(-(t.semanasEstancado + 1));
  const ultimo = v[v.length - 1], penultimo = v[v.length - 2], ante = v[v.length - 3];
  // Menos de un 0,5 % de diferencia es ruido de redondeo, no una bajada
  const baja = (a, b) => b < a * 0.995;
  if (baja(ante, penultimo) && baja(penultimo, ultimo)) return 'bajando';
  if (u.length === t.semanasEstancado + 1 && Math.max(...u.slice(1)) <= u[0]) return 'estancado';
  const ventana = v.slice(-4);
  const medio = (Math.pow(ventana[ventana.length - 1] / ventana[0], 1 / (ventana.length - 1)) - 1) * 100;
  return medio >= t.sube ? 'subiendo' : 'estable';
}
