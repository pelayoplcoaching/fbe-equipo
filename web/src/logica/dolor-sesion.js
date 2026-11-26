// FBE Esencial (v0.257): el motor de molestias en la sesión y en la semana, con la tabla de zonas de cada ejercicio
// (zonas-ejercicio.js, M8). Reglas de Pelayo (26/11/2026, «claude/motores-siguientes-reglas.md»):
//   M3 · con una molestia abierta, pregunta antes de cada sesión que carga esa zona y a la mañana siguiente;
//   M4 · durante: hasta 3 y sin ir a más, sigue; con 4 justo, misma carga y esa sesión no sube; si pasa de 4 o va
//        subiendo, baja la carga o cambia de ejercicio;
//   M5 · a la mañana siguiente, si está peor que antes de entrenar: la próxima sesión que carga esa zona, una serie menos
//        y un 10 % menos de carga en esos ejercicios;
//   M6 · si empeora de una semana a la siguiente, esa zona no progresa; si mejora dos semanas seguidas, vuelve a progresar;
//   M7 · en ámbar, los ejercicios de esa zona no suben de carga ni de series; en rojo, pasan a la alternativa sin dolor del
//        mismo grupo y con menos carga.
// Solo para quien va por su cuenta (en FBE Esencial lo aplica la app; con seguimiento, nada: G1). Cálculo puro.
// Lo de cada semana (M6 y el ámbar de M7) lo aplica esencial-motor.js al preparar la semana; lo de cada sesión (M3, M4,
// M5 y el rojo de M7), la sesión (EsencialDolorSesion.jsx), con la pauta de la semana sin tocar.
import { semaforo, lecturas, NOMBRE_ZONA_DOLOR } from './dolor.js';
import { cargaDe, ordenarAlternativas } from './zonas-ejercicio.js';

// Las decisiones del formulario de las zonas (https://claude.ai/artifact/Cmx3MdzE86nPtGFqXhKToi), confirmadas por Pelayo el
// 26/11/2026 (las 59 preguntas con la ★, sin comentarios): desde qué carga (1, algo; 2, mucho) no sube en ámbar, pasa a su alternativa en rojo y cuenta como
// «sesión que carga esa zona» (la pregunta de antes y el ajuste de la mañana siguiente); y desde cuántos puntos va a más
// durante la sesión o está peor a la mañana siguiente (2: el cambio mínimo que se nota, Farrar 2001).
export const USO = { ambarDesde: 1, rojoCambiaDesde: 2, preguntaDesde: 2, subida: 2, peor: 2 };
export const AJUSTE_MANANA = { series: 1, pct: 10 };

const d10 = (x) => String(x || '').slice(0, 10);
const esFecha = (x) => /^\d{4}-\d{2}-\d{2}$/.test(d10(x));
const dia = (iso) => Date.parse(`${d10(iso)}T12:00:00Z`) / 864e5;
const entre = (a, b) => Math.round(dia(b) - dia(a));
const sumarIso = (iso, n) => new Date(Date.parse(`${d10(iso)}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
export const tuZona = (zona) => `tu ${(NOMBRE_ZONA_DOLOR[zona] || zona).toLowerCase()}`;
const ej = (ejercicios, p) => ejercicios?.[p?.ejercicio_id] || (p?.nombre ? { nombre: p.nombre } : null);
const unir = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

// Las zonas abiertas (ámbar o rojo, de estadoZonas) que se pueden asignar a ejercicios
export const abiertas = (estado = []) => (Array.isArray(estado) ? estado : []).filter((z) => z?.abierta && z.zona !== 'otra' && semaforo(z.valor));

// (M3) Las zonas abiertas que carga una sesión (desde esa carga) y con qué ejercicios: [{ ...zona, pautas, nombres }]
export function zonasDeLaSesion({ pautas = [], ejercicios = {}, estado = [], desde = USO.preguntaDesde } = {}) {
  const out = [];
  for (const z of abiertas(estado)) {
    const suyas = pautas.filter((p) => cargaDe(z.zona, ej(ejercicios, p)) >= desde);
    if (suyas.length) out.push({ ...z, pautas: suyas.map((p) => p.id), nombres: [...new Set(suyas.map((p) => ej(ejercicios, p)?.nombre).filter(Boolean))] });
  }
  return out;
}

// (M4) Lo que toca durante la sesión con lo que acaba de apuntar (inicio: cómo estaba al empezar, si lo apuntó)
export function reglaDurante({ valor, inicio = null, zona = null } = {}) {
  const v = Number(valor);
  if (valor == null || valor === '' || !semaforo(v)) return null;
  const tu = zona ? tuZona(zona) : 'la molestia';
  const sube = inicio != null && inicio !== '' && semaforo(Number(inicio)) && v - Number(inicio) >= USO.subida;
  if (v > 4) return { nivel: 'baja', titulo: 'Baja la carga o cámbialo', texto: `Pasa de 4: baja la carga o cambia de ejercicio (toca «Más» y «Cambiar»). Si aun así ${tu} va a más, deja ese ejercicio por hoy.` };
  if (sube) return { nivel: 'baja', titulo: 'Va a más: baja la carga o cámbialo', texto: `Desde que empezaste ha subido ${v - Number(inicio)} puntos: baja la carga o cambia de ejercicio (toca «Más» y «Cambiar»).` };
  if (v === 4) return { nivel: 'igual', titulo: 'Sigue, sin subir', texto: 'Con 4 justo, sigue con la misma carga: hoy no subas en estos ejercicios.' };
  return { nivel: 'sigue', titulo: 'Puedes seguir', texto: 'Hasta 3 y sin ir a más: sigue con lo que tienes en tu plan.' };
}

// Cómo estaba esa zona antes de una sesión: lo que apuntó antes de empezarla o, si no, su última lectura de antes de ese día
export function antesDeSesion({ registros = [], checkins = [], zona, sesionId = null, fecha, hoy }) {
  const suya = (Array.isArray(registros) ? registros : []).filter((r) => r?.zona === zona && r.momento === 'antes' && sesionId && r.sesion_id === sesionId);
  if (suya.length) return Number(suya[suya.length - 1].valor);
  const xs = lecturas({ registros, checkins, hoy: hoy || fecha }).filter((x) => x.zona === zona && x.fecha < d10(fecha) && x.momento !== 'manana');
  return xs.length ? xs[xs.length - 1].valor : null;
}

// (M5) ¿Peor a la mañana siguiente que antes de entrenar? (2 puntos o más)
export const peorQueAntes = ({ antes, manana }) => antes != null && manana != null && semaforo(Number(antes)) && semaforo(Number(manana)) && Number(manana) - Number(antes) >= USO.peor;

// (M3 y M5) Qué preguntar esta mañana: las zonas abiertas que cargó la sesión que hizo ayer, sin su lectura de hoy.
// sesion: { id, fecha (el día que la hizo), pautas } → [{ zona, nombre, antes, sesionId }]
export function preguntaManana({ sesion = null, ejercicios = {}, estado = [], registros = [], checkins = [], hoy } = {}) {
  if (!sesion?.id || !esFecha(sesion.fecha) || !esFecha(hoy) || entre(sesion.fecha, hoy) !== 1) return [];
  const hechas = new Set((registros || []).filter((r) => r?.momento === 'manana' && d10(r.fecha) === hoy).map((r) => r.zona));
  return zonasDeLaSesion({ pautas: sesion.pautas || [], ejercicios, estado })
    .filter((z) => !hechas.has(z.zona))
    .map((z) => ({ zona: z.zona, nombre: z.nombre, sesionId: sesion.id, antes: antesDeSesion({ registros, checkins, zona: z.zona, sesionId: sesion.id, fecha: sesion.fecha, hoy }) }));
}

// (M5) El ajuste de la sesión de hoy: por cada zona que estuvo peor la mañana siguiente a la última sesión que la cargó,
// si hoy es la siguiente que la carga. hechas: [{ id, fecha, pautas }] las sesiones que ya ha hecho (las de este bloque);
// sesion: la de hoy ({ id, pautas }) → [{ zona, nombre, pautas: [ids], nombres, series: 1, pct: 10, manana, antes }]
export function ajusteManana({ registros = [], checkins = [], hechas = [], sesion = null, ejercicios = {}, hoy } = {}) {
  if (!sesion?.pautas?.length || !esFecha(hoy)) return [];
  const out = [];
  const porZona = {};
  for (const r of Array.isArray(registros) ? registros : []) if (r?.momento === 'manana' && r.sesion_id && semaforo(r.valor)) (porZona[r.zona] ||= []).push(r);
  for (const [zona, rs] of Object.entries(porZona)) {
    if (zona === 'otra') continue;
    const r = [...rs].sort((a, b) => d10(a.fecha).localeCompare(d10(b.fecha)) || String(a.creado_en || '').localeCompare(String(b.creado_en || ''))).pop();
    const previa = (hechas || []).find((s) => s.id === r.sesion_id);
    if (!previa) continue;
    const antes = antesDeSesion({ registros, checkins, zona, sesionId: previa.id, fecha: previa.fecha, hoy });
    if (!peorQueAntes({ antes, manana: r.valor })) continue;
    // ¿ya ha hecho otra sesión que carga esa zona después de esa mañana? Entonces el ajuste ya pasó
    const carga = (s) => (s.pautas || []).some((p) => cargaDe(zona, ej(ejercicios, p)) >= USO.preguntaDesde);
    if ((hechas || []).some((s) => s.id !== previa.id && s.id !== sesion.id && esFecha(s.fecha) && d10(s.fecha) >= d10(r.fecha) && carga(s))) continue;
    // y no más de dos semanas después
    if (entre(r.fecha, hoy) > 14 || entre(r.fecha, hoy) < 0) continue;
    const suyas = sesion.pautas.filter((p) => cargaDe(zona, ej(ejercicios, p)) >= USO.preguntaDesde);
    if (!suyas.length) continue;
    out.push({ zona, nombre: NOMBRE_ZONA_DOLOR[zona] || zona, pautas: suyas.map((p) => p.id), nombres: [...new Set(suyas.map((p) => ej(ejercicios, p)?.nombre).filter(Boolean))],
      series: AJUSTE_MANANA.series, pct: AJUSTE_MANANA.pct, manana: Number(r.valor), antes });
  }
  return out;
}

// (M5, al preparar la semana siguiente) Las zonas cuyo ajuste de la mañana siguiente cayó en una sesión de esa semana: lo
// que bajó entonces (una serie menos y un 10 %) vuelve a lo de antes, porque era un ajuste de un día y no un fallo.
// sesiones: las que hizo esa semana ([{ id, fecha, pautas }]) → Set de zonas
export function zonasAjustadas({ registros = [], checkins = [], sesiones = [], ejercicios = {}, hoy } = {}) {
  const out = new Set();
  const lista = (Array.isArray(sesiones) ? sesiones : []).filter((s) => s?.id && esFecha(s.fecha)).sort((x, y) => d10(x.fecha).localeCompare(d10(y.fecha)));
  for (const r of Array.isArray(registros) ? registros : []) {
    if (r?.momento !== 'manana' || !r.sesion_id || r.zona === 'otra' || !semaforo(r.valor) || !esFecha(r.fecha)) continue;
    const s = lista.find((x) => x.id === r.sesion_id);
    const antes = antesDeSesion({ registros, checkins, zona: r.zona, sesionId: r.sesion_id, fecha: s?.fecha || sumarIso(r.fecha, -1), hoy });
    if (!peorQueAntes({ antes, manana: r.valor })) continue;
    const siguiente = lista.find((x) => x.id !== r.sesion_id && d10(x.fecha) >= d10(r.fecha) && (x.pautas || []).some((p) => cargaDe(r.zona, ej(ejercicios, p)) >= USO.preguntaDesde));
    if (siguiente) out.add(r.zona);
  }
  return out;
}

// Un 10 % menos, al salto del ejercicio (2,5 kg de partida) y siempre por debajo de lo que había
export function recorteKg(kg, pct = AJUSTE_MANANA.pct, paso = 2.5) {
  const k = Number(kg);
  if (!(k > 0) || !(pct > 0)) return kg ?? null;
  let t = Math.round((k * (1 - pct / 100)) / paso) * paso;
  if (t >= k) t = k - paso;
  if (t <= 0) t = Math.round(k * (1 - pct / 100) * 2) / 2;
  return Math.round(Math.max(0, Math.min(k, t)) * 100) / 100;
}
// La pauta con el ajuste de la mañana siguiente: una serie menos (nunca menos de una) y un 10 % menos de carga
export function conAjuste(p, { series = AJUSTE_MANANA.series, pct = AJUSTE_MANANA.pct, paso = 2.5 } = {}) {
  if (!p) return p;
  const n = Math.max(1, (Number(p.series) || 1) - series);
  const det = Array.isArray(p.series_detalle) && p.series_detalle.length
    ? p.series_detalle.slice(0, Math.max(1, p.series_detalle.length - series)).map((s) => ({ ...s, ...(Number(s.kg) > 0 ? { kg: recorteKg(s.kg, pct, paso) } : {}) }))
    : p.series_detalle ?? null;
  return { ...p, series: n, carga_sugerida_kg: Number(p.carga_sugerida_kg) > 0 ? recorteKg(p.carga_sugerida_kg, pct, paso) : p.carga_sugerida_kg ?? null, series_detalle: det };
}

// (M7, rojo) La alternativa de un ejercicio que menos carga esa zona (de las que ya tiene en la biblioteca, que se midan
// igual) y siempre menos que él: { ejercicio, carga } o null si ninguna la carga menos
export function alternativaMenos({ zona, ejercicio, ejercicios = {} }) {
  if (!ejercicio) return null;
  const propia = cargaDe(zona, ejercicio);
  const alts = (ejercicio.alternativas || []).map((id) => ejercicios[id]).filter((a) => a && !!a.por_tiempo === !!ejercicio.por_tiempo);
  const mejor = ordenarAlternativas(zona, alts)[0];
  if (!mejor) return null;
  const c = cargaDe(zona, mejor);
  return c < propia ? { ejercicio: mejor, carga: c } : null;
}
// (M7) Lo que toca hoy en la sesión con una zona en rojo: los ejercicios que la cargan mucho, a su alternativa (o, si
// ninguna la carga menos, sin subir) → [{ pauta_id, zona, alternativa: ejercicio | null }]
export function rojoEnSesion({ pautas = [], ejercicios = {}, estado = [] } = {}) {
  const out = [];
  for (const z of abiertas(estado).filter((x) => x.semaforo === 'rojo')) {
    for (const p of pautas) {
      const e = ej(ejercicios, p);
      if (cargaDe(z.zona, e) < USO.rojoCambiaDesde || out.some((x) => x.pauta_id === p.id)) continue;
      out.push({ pauta_id: p.id, zona: z.zona, nombre: e?.nombre || '', alternativa: alternativaMenos({ zona: z.zona, ejercicio: e, ejercicios })?.ejercicio || null });
    }
  }
  return out;
}

// (M6) Lo más alto de cada una de las últimas semanas (de hoy hacia atrás, 7 días cada una)
function maximos(xs, hoy, n = 3) {
  return Array.from({ length: n }, (_, k) => {
    const v = xs.filter((x) => entre(x.fecha, hoy) >= 7 * k && entre(x.fecha, hoy) < 7 * (k + 1)).map((x) => x.valor);
    return v.length ? Math.max(...v) : null;
  });
}
// (M6 y M7, ámbar) Qué ejercicios de la semana nueva no suben de carga ni de series, por una zona: abierta (ámbar o rojo)
// o que va a peor de una semana a otra, salvo que haya mejorado dos semanas seguidas.
// ids: los ejercicios de la semana → { ejercicio_id: { zona, motivo: 'ambar' | 'rojo' | 'peor' } }
export function frenosSemana({ estado = [], registros = [], checkins = [], ejercicios = {}, ids = [], hoy } = {}) {
  const out = {};
  if (!esFecha(hoy)) return out;
  const xs = lecturas({ registros, checkins, hoy }).filter((x) => x.fecha <= hoy);
  for (const z of Array.isArray(estado) ? estado : []) {
    if (!z || z.zona === 'otra') continue;
    const [m0, m1, m2] = maximos(xs.filter((x) => x.zona === z.zona), hoy);
    const mejora2 = m0 != null && m1 != null && m2 != null && m0 < m1 && m1 < m2;
    const peor = m0 != null && m1 != null && m0 > m1;
    const motivo = z.abierta && !mejora2 ? (z.semaforo === 'rojo' ? 'rojo' : 'ambar') : peor ? 'peor' : null;
    if (!motivo) continue;
    for (const id of ids) {
      if (out[id] || cargaDe(z.zona, ejercicios[id]) < USO.ambarDesde) continue;
      out[id] = { zona: z.zona, motivo };
    }
  }
  return out;
}
// La frase de la nota de la semana: «Con tu rodilla en ámbar, esta semana no suben: sentadilla y prensa.»
export function notaFrenos(frenos = {}, ejercicios = {}) {
  const porZona = {};
  for (const [id, f] of Object.entries(frenos)) (porZona[f.zona] ||= { motivo: f.motivo, nombres: [] }).nombres.push(ejercicios[id]?.nombre || '');
  return Object.entries(porZona).map(([zona, x]) => {
    const como = x.motivo === 'peor' ? `${tuZona(zona)} va a peor que la semana pasada` : `${tuZona(zona)} está en ${x.motivo === 'rojo' ? 'rojo' : 'ámbar'}`;
    const ns = [...new Set(x.nombres.filter(Boolean))];
    return `Como ${como}, esta semana no suben ni de carga ni de series los ejercicios que la cargan${ns.length ? ` (${unir(ns.map((n) => n.toLowerCase()))})` : ''}.`;
  }).join(' ');
}
export const textoVuelta = (zona) => `Vuelve a lo de antes: la mañana después de una sesión, ${tuZona(zona)} amaneció peor y la siguiente fue con una serie menos y un 10 % menos. Era un ajuste de un día, no un fallo.`;
export const textoFreno = (f) => (f ? `No sube: ${f.motivo === 'peor' ? `${tuZona(f.zona)} va a peor que la semana pasada` : `${tuZona(f.zona)} está en ${f.motivo === 'rojo' ? 'rojo' : 'ámbar'}`}. Cuando mejore, vuelve a subir.` : null);
