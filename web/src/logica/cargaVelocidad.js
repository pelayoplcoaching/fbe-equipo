// v0.61 (16): el perfil carga–velocidad y el 1RM estimado por la velocidad (experimental). De cada vídeo de técnica con el
// análisis de la barra guardado (036: la velocidad media de la subida de cada repetición, «vm») y su serie (035: los kilos
// de esa serie), un punto: la carga y la velocidad media de su mejor repetición. Con los puntos de un atleta en un
// ejercicio, la recta de regresión (velocidad = a + b · carga), su R² y, con la velocidad mínima de ese ejercicio (la
// velocidad de la última repetición posible: el «umbral»), el 1RM estimado: la carga a la que la recta llega a ese umbral.
// Nunca con menos de 3 cargas distintas; con pocas cargas, un R² bajo, un rango de cargas estrecho o mucho que extrapolar,
// con su aviso. Todo comprobable sin navegador.
//
// Las velocidades mínimas de serie (por ejercicio, editables por el coach con la 039), de la literatura sobre el perfil
// carga–velocidad con la velocidad media propulsiva o concéntrica: press de banca ~0,17 m/s (González-Badillo y
// Sánchez-Medina, Int J Sports Med 2010), sentadilla completa ~0,30 m/s (Sánchez-Medina et al., 2017), peso muerto
// ~0,15 m/s (Morán-Navarro et al., 2021), press militar ~0,19 m/s, dominadas ~0,23 m/s (Sánchez-Moreno et al., 2017) y
// remo tumbado ~0,50 m/s (Sánchez-Medina et al., 2014). Son medias de grupo: la de cada persona varía, por eso se pueden
// cambiar. El resto de ejercicios, 0,30 m/s de serie (y se dice que es genérica).
import { e1rm as e1rmReps } from './calculos.js';

export const UMBRAL_MIN = 0.05, UMBRAL_MAX = 1;
export const UMBRAL_GENERICO = 0.3;
export const MIN_CARGAS = 3;          // nunca un 1RM con menos cargas distintas
export const CARGAS_FIABLES = 4;      // con 3, se avisa
export const R2_BAJO = 0.8;           // por debajo, se avisa
export const RANGO_ESTRECHO = 0.2;    // (máx − mín) / máx por debajo de un 20 %: se avisa
export const EXTRAPOLA_MUCHO = 1.6;   // el 1RM más de un 60 % por encima de la mayor carga medida: se avisa
export const EXTRAPOLA_MAX = 2.5;     // más de 2,5 veces la mayor carga: no se da (no tiene sentido)
export const MIN_ATIPICOS = 5;        // con 5 puntos o más, se quitan los muy alejados de la recta (como mucho uno de cada 5)

// [patrón del nombre, velocidad mínima, de dónde sale] (el primero que encaja; «peso muerto rumano» no es el peso muerto)
const POR_EJERCICIO = [
  [/press\s+(de\s+)?banca|bench/i, 0.17, 'press de banca'],
  [/peso\s+muerto(?!\s+(rumano|piernas))|deadlift/i, 0.15, 'peso muerto'],
  [/sentadilla|squat/i, 0.3, 'sentadilla'],
  [/press\s+(militar|de\s+hombros?)|overhead/i, 0.19, 'press militar'],
  [/dominada|pull[\s-]?up|chin[\s-]?up/i, 0.23, 'dominadas'],
  [/remo\s+(tumbado|en\s+banco|prono)|bench\s+pull/i, 0.5, 'remo tumbado'],
];
export function umbralPorDefecto(nombre = '') {
  const n = String(nombre || '');
  for (const [re, v, de] of POR_EJERCICIO) if (re.test(n)) return { v, de, generico: false };
  return { v: UMBRAL_GENERICO, de: null, generico: true };
}
// Como umbral_velocidad_valido() de la 039: de 0,05 a 1 m/s, con 3 decimales como mucho
export const umbralValido = (v) => typeof v === 'number' && Number.isFinite(v) && v >= UMBRAL_MIN && v <= UMBRAL_MAX && Math.abs(Math.round(v * 1000) - v * 1000) < 1e-6;
// El que vale para un ejercicio: el del coach (si es válido) o el de serie
export function umbralDe(ejercicio = null, propios = {}) {
  const id = ejercicio?.id || null;
  const p = id != null ? Number(propios?.[id]) : NaN;
  if (id != null && umbralValido(p)) return { v: p, propio: true, generico: false, de: null };
  return { ...umbralPorDefecto(ejercicio?.nombre || ''), propio: false };
}
// Lo que escribe el coach («0,3», «0.25»): un número válido o null
export function leerUmbral(texto) {
  const t = String(texto ?? '').trim().replace(',', '.');
  if (!/^\d{0,1}(\.\d{1,3})?$/.test(t) || t === '' || t === '.') return null;
  const v = Number(t);
  return umbralValido(v) ? v : null;
}

const esNum = (x) => typeof x === 'number' && Number.isFinite(x);
const r = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

// ---------- Los puntos ----------
// La velocidad media de la mejor repetición de un análisis (null si no hay ninguna)
export function mejorVelocidad(analisis) {
  const vs = (analisis?.reps || []).map((x) => x?.vm).filter((v) => esNum(v) && v > 0 && v <= 3);
  return vs.length ? Math.max(...vs) : null;
}
// De los vídeos (del diario: con revision.analisis y serie.kg), un punto por vídeo: { kg, v, fecha, id }. Sin carga (o a
// 0 kg) o sin velocidad, no cuenta. hasta: solo los de ese día o antes (para comparar meses).
export function puntosPerfil(videos = [], { hasta = null } = {}) {
  const out = [];
  for (const x of videos || []) {
    if (!x || (x.tipo && x.tipo !== 'video_tecnica')) continue;
    if (hasta && String(x.fecha || '') > hasta) continue;
    const kg = Number(x.serie?.kg);
    const v = mejorVelocidad(x.revision?.analisis);
    if (!(kg > 0) || !Number.isFinite(kg) || kg > 2000 || v == null) continue;
    out.push({ kg, v, fecha: x.fecha || null, id: x.id || null });
  }
  return out.sort((a, b) => a.kg - b.kg || String(a.fecha || '').localeCompare(String(b.fecha || '')));
}
export const cargasDistintas = (puntos = []) => new Set((puntos || []).map((p) => Math.round(Number(p.kg) * 100) / 100)).size;

// ---------- La recta ----------
// Mínimos cuadrados: v = a + b · kg. null si hay menos de 2 puntos o todas las cargas son iguales (no hay pendiente).
// R² = 1 − SSres / SStot (0 si todas las velocidades son iguales).
export function regresionLineal(puntos = []) {
  const ps = (puntos || []).filter((p) => esNum(p?.kg) && esNum(p?.v));
  const n = ps.length;
  if (n < 2) return null;
  const mx = ps.reduce((t, p) => t + p.kg, 0) / n, my = ps.reduce((t, p) => t + p.v, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of ps) { sxx += (p.kg - mx) ** 2; sxy += (p.kg - mx) * (p.v - my); syy += (p.v - my) ** 2; }
  if (!(sxx > 1e-12)) return null;
  const b = sxy / sxx, a = my - b * mx;
  const ssRes = ps.reduce((t, p) => t + (p.v - (a + b * p.kg)) ** 2, 0);
  const r2 = syy > 1e-12 ? Math.max(0, Math.min(1, 1 - ssRes / syy)) : 0;
  return { a, b, r2, n };
}
const mediana = (xs) => { const s = [...xs].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
// Los puntos muy alejados de la recta (a más de 3 desviaciones robustas, con la mediana de las desviaciones absolutas),
// fuera: solo con 5 puntos o más, como mucho uno de cada 5 y sin bajar de 3 cargas distintas. { puntos, atipicos }
export function quitarAtipicos(puntos = []) {
  const ps = [...(puntos || [])];
  if (ps.length < MIN_ATIPICOS) return { puntos: ps, atipicos: [] };
  const rg = regresionLineal(ps);
  if (!rg) return { puntos: ps, atipicos: [] };
  const res = ps.map((p) => p.v - (rg.a + rg.b * p.kg));
  const med = mediana(res);
  const mad = mediana(res.map((x) => Math.abs(x - med))) * 1.4826;
  if (!(mad > 1e-9)) return { puntos: ps, atipicos: [] };
  const candidatos = ps.map((p, i) => ({ p, z: Math.abs(res[i] - med) / mad })).filter((x) => x.z > 3).sort((x, y) => y.z - x.z);
  const tope = Math.floor(ps.length / 5);
  const fuera = [];
  for (const c of candidatos) {
    if (fuera.length >= tope) break;
    const quedan = ps.filter((p) => p !== c.p && !fuera.includes(p));
    if (cargasDistintas(quedan) < MIN_CARGAS) continue;
    fuera.push(c.p);
  }
  return { puntos: ps.filter((p) => !fuera.includes(p)), atipicos: fuera };
}

// ---------- El perfil ----------
// estado: 'sin-datos' | 'pocos' (menos de 3 cargas distintas: sin 1RM) | 'sin-pendiente' (la velocidad no baja al subir la
// carga: sin 1RM) | 'incoherente' (con ese umbral saldría menos de lo ya levantado: sin 1RM) | 'lejos' (más de 2,5 veces la
// mayor carga: sin 1RM) | 'ok'. avisos: ['pocas-cargas', 'r2-bajo', 'rango-estrecho', 'extrapola', 'atipicos', 'umbral-generico']
export function perfilCargaVelocidad(videos = [], { umbral = UMBRAL_GENERICO, umbralGenerico = false, hasta = null } = {}) {
  const todos = puntosPerfil(videos, { hasta });
  const base = { puntos: todos, atipicos: [], n: todos.length, cargas: cargasDistintas(todos), umbral, recta: null, r2: null, e1rm: null, avisos: [] };
  if (!todos.length) return { ...base, estado: 'sin-datos' };
  if (base.cargas < MIN_CARGAS) return { ...base, estado: 'pocos', recta: regresionLineal(todos) };
  const { puntos, atipicos } = quitarAtipicos(todos);
  const rg = regresionLineal(puntos);
  const cargas = cargasDistintas(puntos);
  const out = { ...base, puntos, atipicos, n: puntos.length, cargas, recta: rg ? { a: r(rg.a, 4), b: r(rg.b, 6) } : null, r2: rg ? r(rg.r2, 3) : null };
  if (atipicos.length) out.avisos.push('atipicos');
  if (umbralGenerico) out.avisos.push('umbral-generico');
  if (!rg || !(rg.b < 0)) return { ...out, estado: 'sin-pendiente' };
  if (cargas < CARGAS_FIABLES) out.avisos.push('pocas-cargas');
  if (rg.r2 < R2_BAJO) out.avisos.push('r2-bajo');
  const kgs = puntos.map((p) => p.kg), max = Math.max(...kgs), min = Math.min(...kgs);
  if ((max - min) / max < RANGO_ESTRECHO) out.avisos.push('rango-estrecho');
  const e = (umbral - rg.a) / rg.b;
  if (!Number.isFinite(e) || e < max) return { ...out, estado: 'incoherente' };
  if (e > max * EXTRAPOLA_MAX) return { ...out, estado: 'lejos' };
  if (e > max * EXTRAPOLA_MUCHO) out.avisos.push('extrapola');
  return { ...out, estado: 'ok', e1rm: Math.round(e * 2) / 2 };
}
// La velocidad que da la recta a una carga (para pintarla)
export const velocidadEn = (recta, kg) => (recta && esNum(recta.a) && esNum(recta.b) ? recta.a + recta.b * kg : null);

// ---------- Comparar con el 1RM por repeticiones y RPE ----------
// El mejor e1RM (Epley con las repeticiones en reserva, como en Progreso) de las series de ese ejercicio en las 8 semanas
// antes del día dado (incluido). series: [{ kg, reps, rpe, rir, fecha }]
export function e1rmPorRepeticiones(series = [], { hasta = null, dias = 56 } = {}) {
  let mejor = null;
  const desde = hasta ? restarDias(hasta, dias) : null;
  for (const s of series || []) {
    if (hasta && (String(s.fecha || '') > hasta || String(s.fecha || '') < desde)) continue;
    const v = e1rmReps(s);
    if (v != null && (mejor == null || v > mejor.valor)) mejor = { valor: v, fecha: s.fecha || null };
  }
  return mejor;
}
function restarDias(iso, n) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d - n));
  return f.toISOString().slice(0, 10);
}
// Cuánto difieren (en %, el de la velocidad respecto al de repeticiones)
export const diferenciaPct = (vel, reps) => (esNum(vel) && esNum(reps) && reps > 0 ? Math.round(((vel - reps) / reps) * 100) : null);

// ---------- Textos ----------
const coma = (x, d) => (Math.round(x * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',');
export const textoUmbral = (v) => `${coma(v, v * 100 === Math.round(v * 100) ? 2 : 3)} m/s`;
export const textoR2 = (x) => (esNum(x) ? coma(x, 2) : '—');
export const textoKg = (x) => (esNum(x) ? `${coma(x, x === Math.round(x) ? 0 : 1)} kg` : '—');
export const TEXTO_AVISO = {
  'pocas-cargas': 'Solo con 3 cargas distintas: con una cuarta será más fiable.',
  'r2-bajo': 'Los puntos no se alinean bien (R² bajo): el 1RM es poco fiable.',
  'rango-estrecho': 'Las cargas están muy juntas: hacen falta más separadas (ligera, media y pesada).',
  extrapola: 'El 1RM queda lejos de las cargas medidas: es una extrapolación grande.',
  atipicos: 'Se ha dejado fuera algún vídeo muy alejado de la recta.',
  'umbral-generico': 'Con la velocidad mínima genérica (0,30 m/s): tu coach puede ajustarla para este ejercicio.',
};
// (revisión L5) con esCoach, dicho para el coach (de su atleta), no para el atleta
export const textoAviso = (a, { esCoach = false } = {}) => (a === 'umbral-generico' && esCoach ? 'Con la velocidad mínima genérica (0,30 m/s): puedes ajustarla para este ejercicio.' : TEXTO_AVISO[a] || '');
export function textoEstado(p, { esCoach = false } = {}) {
  if (!p) return '';
  if (p.estado === 'sin-datos') return 'Aún no hay vídeos de este ejercicio con la velocidad analizada y los kilos de su serie.';
  if (p.estado === 'pocos') return `Hacen falta vídeos con al menos ${MIN_CARGAS} cargas distintas (ahora, ${p.cargas === 1 ? '1 carga' : `${p.cargas} cargas`}) para estimar el 1RM.`;
  if (p.estado === 'sin-pendiente') return 'La velocidad no baja al subir la carga: así no se puede estimar el 1RM (revisa los vídeos o graba alguno más pesado).';
  if (p.estado === 'incoherente') return `Con esa velocidad mínima saldría menos de lo que ya ${esCoach ? 'ha' : 'has'} movido: la velocidad mínima parece alta para este ejercicio.`;
  if (p.estado === 'lejos') return 'Las cargas medidas quedan muy lejos del 1RM: graba alguna serie más pesada para estimarlo.';
  return '';
}
