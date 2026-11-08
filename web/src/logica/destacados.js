// v0.52: «Destacados» arriba de Progreso, como los de Apple Salud: de dos a cuatro tarjetas que dicen en una frase algo
// que ha cambiado de verdad, con una gráfica pequeña. Solo con datos de entrenamiento (nada de peso, salud ni
// nutrición). Cada una exige unos datos mínimos y un cambio que se note: si no, no sale (mejor ninguna que una que
// confunda). Los umbrales están en UMBRALES y en el README.
import { lunesDe, sumarDias, diasEntre } from './fechas.js';
import { num } from './calculos.js';
import { difVista, etiquetaPeso } from './unidades.js';

export const UMBRALES = {
  tonelajeSube: 0.10,        // +10 % o más que la media de las 4 semanas anteriores a estas alturas de la semana
  tonelajeTope: 3,           // más del triple no es una tendencia, es un dato raro (una semana suelta): no sale
  tonelajeSemanas: 3,        // de esas 4 semanas, al menos 3 con tonelaje a estas alturas
  fuerzaSemanas: 6,          // la ventana del 1RM estimado
  fuerzaPuntos: 3,           // al menos 3 semanas con dato en la ventana
  fuerzaSpan: 3,             // que abarquen al menos 3 semanas
  fuerzaKg: 2.5,             // y suba al menos 2,5 kg
  fuerzaPct: 0.02,           // y al menos un 2 %
  racha: 3,                  // 3 semanas completas seguidas o más
  bloqueSemanas: 4,          // un bloque con al menos 4 semanas ya contadas
  bloqueVentana: 3,          // la constancia de las 3 últimas semanas
  bloqueMinimo: 0.9,         // al menos el 90 % de lo programado
  records: 2,                // récords en al menos 2 ejercicios en 14 días
  recordsDias: 14,
};

const tonelajeDe = (s) => (Number(s.reps) > 0 ? (Number(s.kg) || 0) * Number(s.reps) : 0);

// Kilos movidos (carga × repeticiones) de cada día
export function tonelajePorDia(series = []) {
  const m = {};
  for (const s of series || []) { const t = tonelajeDe(s); if (s.fecha && t > 0) m[s.fecha] = (m[s.fecha] || 0) + t; }
  return m;
}
// Por semana (lunes), para la gráfica de Progreso: las semanas con algo, en orden
export function tonelajePorSemana(dias = {}) {
  const m = new Map();
  for (const [f, t] of Object.entries(dias || {})) { const l = lunesDe(f); m.set(l, (m.get(l) || 0) + t); }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([semana, valor]) => ({ semana, valor: Math.round(valor) }));
}
// Lo acumulado de lunes hasta el mismo día de la semana que hoy, en la semana del lunes dado
function hastaHoy(dias, lunes, nDias) {
  let t = 0;
  for (let i = 0; i < nDias; i++) t += dias[sumarDias(lunes, i)] || 0;
  return t;
}

const minusculaInicial = (t) => (/^[A-Z\u00c1\u00c9\u00cd\u00d3\u00da\u00d1][a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);
const pct = (x) => `${Math.round(x * 100)} %`;

function destacadoTonelaje(dias, hoy) {
  const lunes = lunesDe(hoy), nDias = diasEntre(lunes, hoy) + 1;
  const ahora = hastaHoy(dias, lunes, nDias);
  if (ahora <= 0) return null;
  const antes = [1, 2, 3, 4].map((k) => hastaHoy(dias, sumarDias(lunes, -7 * k), nDias));
  const con = antes.filter((x) => x > 0);
  if (con.length < UMBRALES.tonelajeSemanas) return null;
  const media = con.reduce((a, b) => a + b, 0) / con.length;
  const r = ahora / media - 1;
  if (r < UMBRALES.tonelajeSube || ahora / media > UMBRALES.tonelajeTope) return null;
  return {
    id: 'tonelaje', icono: 'disco', sobre: 'Tonelaje',
    texto: `Esta semana llevas un ${pct(r)} más de tonelaje que tu media de las 4 anteriores a estas alturas.`,
    grafica: { tipo: 'barras', valores: [...antes].reverse().concat(ahora).map((x) => Math.round(x)), resaltado: 4 },
    peso: r,
  };
}

function destacadoFuerza(ejercicios, hoy) {
  const desde = sumarDias(lunesDe(hoy), -7 * (UMBRALES.fuerzaSemanas - 1));
  let mejor = null;
  for (const e of ejercicios || []) {
    const pts = (e.puntos || []).filter((p) => p.semana >= desde && Number.isFinite(p.valor) && p.valor > 0);
    if (pts.length < UMBRALES.fuerzaPuntos) continue;
    const a = pts[0], b = pts[pts.length - 1];
    const span = Math.round(diasEntre(a.semana, b.semana) / 7);
    if (span < UMBRALES.fuerzaSpan) continue;
    const kg = b.valor - a.valor;
    if (kg < UMBRALES.fuerzaKg || kg / a.valor < UMBRALES.fuerzaPct) continue;
    if (!mejor || kg / a.valor > mejor.rel) mejor = { e, pts, kg, span, rel: kg / a.valor };
  }
  if (!mejor) return null;
  const kgTxt = `${num(Math.round(difVista(mejor.kg) * 2) / 2, 1)} ${etiquetaPeso()}`;
  return {
    id: 'fuerza', icono: 'progreso', sobre: 'Fuerza',
    texto: `Tu ${minusculaInicial(mejor.e.nombre)} estimado ha subido ${kgTxt} en ${mejor.span} semanas.`,
    grafica: { tipo: 'linea', valores: mejor.pts.map((p) => p.valor) },
    ejercicioId: mejor.e.id, peso: mejor.rel * 4,
  };
}

function destacadoRacha(racha, calendario = []) {
  if (!(racha >= UMBRALES.racha)) return null;
  return {
    id: 'racha', icono: 'llama', sobre: 'Racha',
    texto: `Has entrenado ${racha} semanas seguidas completas.`,
    grafica: { tipo: 'pips', valores: calendario.slice(-8).map((w) => (w.estado === 'completa' ? 1 : w.estado === 'sin_plan' ? null : 0)) },
    peso: racha / 10,
  };
}

// bloque: [{ numero, hechas, total }] de las semanas ya contadas (pasadas, y la actual si está completa)
function destacadoBloque(bloque = []) {
  const w = (bloque || []).filter((x) => x.total > 0);
  const V = UMBRALES.bloqueVentana;
  if (w.length < UMBRALES.bloqueSemanas) return null;
  const ventanas = [];
  for (let i = 0; i + V <= w.length; i++) {
    const tramo = w.slice(i, i + V);
    ventanas.push(tramo.reduce((t, x) => t + x.hechas, 0) / tramo.reduce((t, x) => t + x.total, 0));
  }
  const ult = ventanas[ventanas.length - 1], previas = ventanas.slice(0, -1);
  if (ult < UMBRALES.bloqueMinimo || ult < Math.max(...previas) || ult <= Math.min(...previas)) return null;
  return {
    id: 'bloque', icono: 'diana', sobre: 'Constancia',
    texto: `Tu constancia está en su mejor momento del bloque: el ${pct(Math.min(1, ult))} de las sesiones en las ${V} últimas semanas.`,
    grafica: { tipo: 'barras', valores: w.map((x) => Math.round((Math.min(x.hechas, x.total) / x.total) * 100)), resaltado: w.length - 1, max: 100 },
    peso: ult - Math.min(...previas),
  };
}

// recientes: los récords de los últimos 30 días ({ ejercicio_id, fecha }), como la vitrina. Cuenta ejercicios, no series
// (batir tres veces el mismo en una sesión es un récord, no tres)
function destacadoRecords(recientes = [], nombres = {}, hoy) {
  const desde = sumarDias(hoy, -UMBRALES.recordsDias);
  const r = (recientes || []).filter((e) => e.fecha >= desde && e.fecha <= hoy);
  const ids = [...new Set(r.map((e) => e.ejercicio_id))];
  if (ids.length < UMBRALES.records) return null;
  const ejs = ids.map((id) => nombres[id]).filter(Boolean).map(minusculaInicial);
  const texto = ids.length === 2 && ejs.length === 2
    ? `Has batido récords en ${ejs[0]} y en ${ejs[1]} en las 2 últimas semanas.`
    : `Has batido récords en ${ids.length} ejercicios en las 2 últimas semanas.`;
  const lunes = lunesDe(hoy);
  const porSemana = [3, 2, 1, 0].map((k) => new Set((recientes || []).filter((e) => lunesDe(e.fecha) === sumarDias(lunes, -7 * k)).map((e) => e.ejercicio_id)).size);
  return {
    id: 'records', icono: 'trofeo', sobre: 'Récords', texto,
    grafica: { tipo: 'barras', valores: porSemana, resaltado: 3 },
    peso: ids.length / 3,
  };
}

// d: { dias (tonelaje por día), ejercicios (1RM por semana), racha, calendario, bloque, recientes, nombres }
// Devuelve de 0 a 4, los más fuertes primero (cada uno con su `peso`, que no se enseña)
export function destacados(d = {}, hoy) {
  const lista = [
    destacadoRecords(d.recientes, d.nombres, hoy),
    destacadoFuerza(d.ejercicios, hoy),
    destacadoTonelaje(d.dias || {}, hoy),
    destacadoRacha(d.racha, d.calendario),
    destacadoBloque(d.bloque),
  ].filter(Boolean);
  return lista.sort((a, b) => b.peso - a.peso).slice(0, 4);
}
