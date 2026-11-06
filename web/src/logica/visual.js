// Cálculos de las piezas visuales de la v0.49 (sin pantalla, para poder probarlos): el resumen de un ejercicio
// terminado, la comparación con la última vez que se hizo la sesión, la escala y los récords de las gráficas, el
// calendario de constancia, el estado de cada atleta en el panel y sus minigráficas.
import { num } from './calculos.js';
import { lunesDe, sumarDias, desdeISO } from './fechas.js';
import { normal as sinTildes } from './busqueda.js';

const normal = (t) => sinTildes(t).trim();

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const n0 = (x) => (x == null || x === '' ? null : Number(x));

// ---------- sesión ----------
// Series pautadas hechas (de la 1 a la última de la pauta): las de «Añadir serie» no cuentan para completar
export const seriesPautadasHechas = (e, h = {}) => Array.from({ length: Math.max(0, e?.series || 0) }, (_, i) => i + 1).filter((k) => !!h?.[k]).length;
export const pautadasHechas = (e, h = {}) => (e?.series || 0) > 0 && seriesPautadasHechas(e, h) === e.series;

// Una línea con lo hecho en un ejercicio: «3 × 6 @ 42,5 kg», «6-6-5 @ 40 kg», «3 series, hasta 45 kg», «3 × 12».
export function resumenSeries(series = []) {
  const ss = series.filter((s) => n0(s.reps) != null || n0(s.kg) != null);
  if (!ss.length) return '';
  const kgs = ss.map((s) => n0(s.kg)).filter((k) => k != null && k > 0);
  const reps = ss.map((s) => n0(s.reps) ?? 0);
  const mismasReps = reps.every((r) => r === reps[0]);
  const conKg = kgs.length === ss.length;
  const mismoKg = conKg && kgs.every((k) => k === kgs[0]);
  if (!kgs.length) return mismasReps ? `${ss.length} × ${reps[0]}` : `${reps.join('-')} reps`;
  if (mismoKg) return mismasReps ? `${ss.length} × ${reps[0]} @ ${num(kgs[0], 2)} kg` : `${reps.join('-')} @ ${num(kgs[0], 2)} kg`;
  return `${ss.length} series, hasta ${num(Math.max(...kgs), 2)} kg`;
}

// La última vez que se hizo esta sesión (la de nombre igual más reciente, sin contar esta) y qué ha cambiado.
// actual: { id, nombre, fecha, tonelaje, series, minutos }; entrenamientos: los de api.sesionesHechas() (o api.entrenamientos()).
export function compararConAnterior(actual, entrenamientos = []) {
  if (!actual?.nombre) return null;
  const fecha = actual.fecha || '9999-12-31';
  const previas = entrenamientos
    .filter((x) => x.id !== actual.id && normal(x.nombre) === normal(actual.nombre) && (x.fecha || '') <= fecha && (x.series || 0) > 0)
    .sort((a, b) => ((a.fecha || '') < (b.fecha || '') ? 1 : (a.fecha || '') > (b.fecha || '') ? -1 : 0));
  const a = previas[0];
  if (!a) return null;
  const minutos = actual.minutos != null && a.duracion_min != null ? Math.round(actual.minutos - a.duracion_min) : null;
  return {
    fecha: a.fecha || null,
    tonelaje: Math.round((actual.tonelaje || 0) - (a.tonelaje || 0)),
    series: (actual.series || 0) - (a.series || 0),
    minutos,
  };
}
// «+120 kg de tonelaje que la última vez», «80 kg menos de tonelaje que la última vez», «El mismo tonelaje…»
export function textoComparacion(c) {
  if (!c) return null;
  const t = c.tonelaje;
  if (Math.abs(t) < 1) return 'El mismo tonelaje que la última vez';
  return t > 0 ? `+${num(t, 0)} kg de tonelaje que la última vez` : `${num(-t, 0)} kg menos de tonelaje que la última vez`;
}

// ---------- gráficas ----------
// Escala del eje y: márgenes del 15 % y como poco rangoMin (o 2 unidades) de alto; dos líneas de guía redondeadas.
export function escalaGrafica(valores, { rangoMin = null, margen = 0.15 } = {}) {
  const ys = valores.filter((v) => Number.isFinite(v));
  if (!ys.length) return { lo: 0, hi: 1, ticks: [] };
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (rangoMin != null && hi - lo < rangoMin) { const m = (hi + lo) / 2; lo = m - rangoMin / 2; hi = m + rangoMin / 2; }
  else if (hi - lo < 1) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * margen;
  lo -= pad; hi += pad;
  const paso = hi - lo > 200 ? 50 : hi - lo > 8 ? 1 : 0.5;
  const ticks = [...new Set([lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.8].map((t) => Math.round(t / paso) * paso))];
  return { lo, hi, ticks };
}
// El índice del punto más cercano a una x (en px) dentro de una lista de x ordenadas
export function puntoMasCercano(xs, x) {
  if (!xs.length) return -1;
  let mejor = 0;
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[mejor] - x)) mejor = i;
  return mejor;
}
// Récords de una serie (1RM estimado, tonelaje…): los puntos que superan a todos los anteriores (el primero no
// cuenta: sin nada antes, no es un récord)
export function indicesRecord(valores) {
  const r = [];
  let max = -Infinity;
  valores.forEach((v, i) => { if (i > 0 && v > max) r.push(i); if (v > max) max = v; });
  return r;
}

// ---------- constancia (calendario de 16 semanas) ----------
// sesiones: las hechas, con su fecha (día de Madrid) y su nombre. Columnas de lunes a domingo, de la más antigua a la
// de hoy; nivel 0 (nada), 1 (una sesión) o 2 (dos o más); los días que aún no han llegado, -1.
export function mapaConstancia(sesiones = [], hoy, semanas = 16) {
  const porDia = {};
  for (const s of sesiones) if (s?.fecha) (porDia[s.fecha] ||= []).push(s);
  const primerLunes = sumarDias(lunesDe(hoy), -7 * (semanas - 1));
  const cols = Array.from({ length: semanas }, (_, i) => {
    const l = sumarDias(primerLunes, 7 * i);
    return {
      lunes: l,
      dias: Array.from({ length: 7 }, (_, d) => {
        const iso = sumarDias(l, d);
        const lista = iso > hoy ? [] : porDia[iso] || [];
        return { iso, n: lista.length, nivel: iso > hoy ? -1 : Math.min(2, lista.length), sesiones: lista };
      }),
    };
  });
  // Etiqueta de mes en la primera columna cuyo lunes es de ese mes (y en la primera de todas); la primera se quita si
  // la siguiente va justo detrás (no cabrían las dos)
  const meses = [];
  cols.forEach((c, i) => {
    const m = desdeISO(c.lunes).getMonth();
    if (i === 0 || m !== desdeISO(cols[i - 1].lunes).getMonth()) meses.push({ col: i, texto: MESES[m] });
  });
  if (meses.length > 1 && meses[1].col <= 2) meses.shift();
  const dias = cols.flatMap((c) => c.dias).filter((d) => d.n > 0);
  return { semanas: cols, meses, diasActivos: dias.length, total: dias.reduce((t, d) => t + d.n, 0) };
}

// (diseño, tanda 15) El trazo de una gráfica, en curva suave en vez de quebrado: una curva cúbica que pasa por todos los
// puntos y no se sale entre ellos (interpolación monótona de Fritsch y Carlson: entre dos valores no inventa ni un pico
// ni un valle que los datos no tengan). pts: [[x, y]] en píxeles, con x creciente. Con uno o dos puntos, rectas.
export function trazoSuave(pts = []) {
  const p = (pts || []).filter((q) => Number.isFinite(q?.[0]) && Number.isFinite(q?.[1]));
  const f = (v) => v.toFixed(1);
  if (!p.length) return '';
  if (p.length < 3) return p.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join(' ');
  const n = p.length, dx = [], m = [], t = new Array(n);
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; m[i] = dx[i] > 0 ? (p[i + 1][1] - p[i][1]) / dx[i] : 0; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], c = a * a + b * b;
    if (c > 9) { const k = 3 / Math.sqrt(c); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${f(p[i][0] + h)} ${f(p[i][1] + t[i] * h)} ${f(p[i + 1][0] - h)} ${f(p[i + 1][1] - t[i + 1] * h)} ${f(p[i + 1][0])} ${f(p[i + 1][1])}`;
  }
  return d;
}

// ---------- panel del coach ----------
// El color de la franja de cada atleta, con los mismos avisos del panel: gris sin activar o de baja; rojo si se está
// quedando atrás (días sin entrenar, poco cumplimiento) o hay algo grave; ámbar si necesita atención; verde si va bien.
export const NOMBRE_ESTADO = { verde: 'Va bien', ambar: 'Necesita atención', rojo: 'Se está quedando atrás', gris: 'Sin activar' };
export function estadoAtleta(r) {
  if (!r || r.estado === 'invitado' || r.estado === 'baja') return 'gris';
  const alertas = r.alertas || [];
  if (alertas.some((a) => a.nivel === 'alerta' || a.tipo === 'sin_entrenar' || a.tipo === 'cumplimiento')) return 'rojo';
  if (alertas.some((a) => a.nivel !== 'info')) return 'ambar';
  return 'verde';
}
// El peso de cada una de las últimas n semanas (la media de sus pesadas); las semanas sin pesar no salen
export function chispaPeso(pesos = [], hoy, semanas = 8) {
  const desde = sumarDias(lunesDe(hoy), -7 * (semanas - 1));
  const grupos = {};
  for (const p of pesos) if (p.fecha >= desde && p.fecha <= hoy && Number(p.kg) > 0) (grupos[lunesDe(p.fecha)] ||= []).push(Number(p.kg));
  return Object.keys(grupos).sort().map((l) => ({ x: l, y: Math.round((grupos[l].reduce((t, v) => t + v, 0) / grupos[l].length) * 10) / 10 }));
}
// Sesiones hechas de las programadas en cada una de las últimas n semanas (con la de hoy), de la más antigua a la actual.
// semanas: [{ id, fecha_inicio }]; sesiones: [{ semana_id, completada }]
export function chispaSesiones(semanas = [], sesiones = [], hoy, n = 6) {
  const lunesHoy = lunesDe(hoy);
  const porSemana = {};
  for (const s of sesiones) (porSemana[s.semana_id] ||= []).push(s);
  return Array.from({ length: n }, (_, i) => {
    const l = sumarDias(lunesHoy, -7 * (n - 1 - i));
    const ws = semanas.filter((w) => lunesDe(w.fecha_inicio) === l);
    const ss = ws.flatMap((w) => porSemana[w.id] || []);
    return { lunes: l, hechas: ss.filter((x) => x.completada).length, total: ss.length };
  });
}
// La línea de una minigráfica (de izquierda a derecha, en un rectángulo de W × H con un margen)
export function trazoChispa(valores, W = 64, H = 20, m = 2) {
  if (!valores.length) return '';
  const lo = Math.min(...valores), hi = Math.max(...valores);
  const r = hi - lo || 1;
  const X = (i) => (valores.length === 1 ? W / 2 : m + (i * (W - 2 * m)) / (valores.length - 1));
  const Y = (v) => (hi === lo ? H / 2 : m + (1 - (v - lo) / r) * (H - 2 * m));
  return valores.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
}

// ---------- chat ----------
// Mensajes seguidos de la misma persona, el mismo día y con menos de 5 minutos entre uno y otro, van juntos: solo el
// último del grupo lleva el pico de la burbuja y la hora. Los programados y los que llevan etiqueta (de una sesión,
// un check-in o un vídeo) cortan el grupo. dia(iso) da el día de cada mensaje (por defecto, los 10 primeros caracteres).
export function gruposChat(mensajes = [], { minutos = 5, dia = (iso) => String(iso).slice(0, 10) } = {}) {
  const corta = (a, b) => !a || !b || a.autor !== b.autor || !!a.programado || !!b.programado || !!b.contexto
    || dia(a.creado_en) !== dia(b.creado_en) || Math.abs(Date.parse(b.creado_en) - Date.parse(a.creado_en)) > minutos * 60000;
  return mensajes.map((c, i) => ({ id: c.id, primero: corta(mensajes[i - 1], c), ultimo: corta(c, mensajes[i + 1]) }));
}
