// La carrera (v0.133, migración 055): zonas, ritmos, partes de una sesión, el plan (macrociclo y semanas), las carreras,
// el semáforo y las revisiones. Todo puro: lo usan el coach (Ficha → Carrera, el editor) y el atleta («Tu carrera»).
import { num, leerNumero } from './calculos.js';
import { sumarDias, lunesDe, diasEntre } from './fechas.js';
import { pautaValida, parteValida, cardioHechoValido, ritmoValido, FASES_PARTE, TIPOS_SESION_CARRERA } from './cardio.js';

// ---------- tipos, fases y zonas ----------
export const TIPOS_CARRERA = [
  ['facil', 'Fácil'], ['calidad', 'Calidad'], ['larga', 'Larga'], ['carrera', 'Carrera'], ['recuperacion', 'Recuperación'],
  ['cross', 'Cross'], ['test', 'Test'], ['tecnica', 'Técnica'],
];
export const NOMBRE_TIPO = { ...Object.fromEntries(TIPOS_CARRERA), descanso: 'Descanso' };
export const FASES = [['calentar', 'Calentar'], ['bloque', 'Bloque'], ['strides', 'Strides'], ['enfriar', 'Enfriar'], ['libre', 'Libre']];
export const NOMBRE_FASE = Object.fromEntries(FASES);
export const TESTS = [['friel30', 'Test de 30 min (Friel)'], ['campo', 'Test de campo'], ['laboratorio', 'Laboratorio'], ['estimado', 'Estimado']];
export const NOMBRE_TEST = Object.fromEntries(TESTS);
export const PRIORIDADES = [['A', 'A · la importante'], ['B', 'B · de preparación'], ['C', 'C · de entreno']];
export const DECISIONES = [['va', 'Va'], ['entreno', 'Como entreno'], ['pendiente', 'Por decidir'], ['no', 'No va']];
export const NOMBRE_DECISION = Object.fromEntries(DECISIONES);
export const ESTADOS_REVISION = [['pendiente', 'Pendiente'], ['verde', 'Verde'], ['ambar', 'Ámbar'], ['rojo', 'Rojo']];
export const NOMBRE_ESTADO_REVISION = Object.fromEntries(ESTADOS_REVISION);

// Las 5 zonas de FC con sus nombres y cómo se sienten (Friel, por % de la FC umbral)
export const ZONAS = [
  { z: 1, nombre: 'Recuperación', siente: 'Muy suave: hablas sin esfuerzo' },
  { z: 2, nombre: 'Aeróbico', siente: 'Cómodo: puedes hablar con frases largas' },
  { z: 3, nombre: 'Tempo', siente: 'Controlado: frases cortas' },
  { z: 4, nombre: 'Umbral', siente: 'Duro pero sostenido: palabras sueltas' },
  { z: 5, nombre: 'Por encima del umbral', siente: 'Muy duro: no puedes hablar' },
];
// Dónde empieza cada zona (Z2 a Z5), en ppm: las que puso el coach o, si no, 85, 90, 95 y 100 % de la FC umbral
export function limitesZonas(perfil) {
  const z = perfil?.zonas;
  if (Array.isArray(z) && z.length === 4 && z.every((x, i) => Number.isInteger(x) && (i === 0 || x > z[i - 1]))) return z.map(Number);
  const l = Number(perfil?.lthr);
  if (!Number.isFinite(l) || l < 100) return null;
  return [Math.ceil(l * 0.85), Math.ceil(l * 0.9), Math.ceil(l * 0.95), Math.round(l)];
}
// [{ z, nombre, siente, min, max }]: min null en Z1, max null en Z5
export function zonasFC(perfil) {
  const lim = limitesZonas(perfil);
  if (!lim) return null;
  return ZONAS.map((x, i) => ({ ...x, min: i === 0 ? null : lim[i - 1], max: i === 4 ? null : lim[i] - 1 }));
}
export function textoRangoZona(zona) {
  if (!zona) return '';
  if (zona.min == null) return `≤${zona.max} ppm`;
  if (zona.max == null) return `≥${zona.min} ppm`;
  return `${zona.min}–${zona.max} ppm`;
}
// «Z4 (172–180 ppm)», «Z1–Z2 (≤162 ppm)»
export function textoZona(z, zh = null, zonas = null) {
  if (!z) return '';
  const hasta = zh && zh !== z ? zh : null;
  const nombre = hasta ? `Z${z}–Z${hasta}` : `Z${z}`;
  if (!zonas) return nombre;
  const a = zonas[z - 1], b = zonas[(hasta || z) - 1];
  if (!a || !b) return nombre;
  return `${nombre} (${textoRangoZona({ min: a.min, max: b.max })})`;
}
// En qué zona cae una FC
export function zonaDeFC(fc, zonas) {
  if (!zonas || !Number.isFinite(Number(fc))) return null;
  const f = Number(fc);
  return zonas.find((z) => (z.min == null || f >= z.min) && (z.max == null || f <= z.max))?.z ?? null;
}

// ---------- ritmos y tiempos ----------
// 310 → «5:10»
export function fmtRitmo(seg) {
  if (!Number.isFinite(Number(seg)) || seg <= 0) return '';
  const s = Math.round(Number(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
// [320, 310] → «5:10–5:20 min/km»
export function textoRitmo(r) {
  if (!Array.isArray(r) || !r.length) return '';
  const [a, b] = [...r].map(Number).sort((x, y) => x - y);
  return `${fmtRitmo(a)}${b && b !== a ? `–${fmtRitmo(b)}` : ''} min/km`;
}
// «5:10» o «5.10» o «5'10» → 310; «5:10-5:20» → [310, 320]
export function leerRitmo(t) {
  const m = String(t ?? '').trim().match(/^(\d{1,2})\s*[:.'\u00b4]\s*(\d{1,2})$/);
  if (!m || Number(m[2]) > 59) return null;
  const s = Number(m[1]) * 60 + Number(m[2]);
  return s >= 120 && s <= 900 ? s : null;
}
export function leerRangoRitmo(t) {
  const txt = String(t ?? '').replace(/min\/km/i, '').trim();
  if (!txt) return null;
  const partes = txt.split(/\s*[\u2013-]\s*|\s+a\s+/).filter(Boolean);
  if (partes.length > 2) return undefined;
  const v = partes.map(leerRitmo);
  if (v.some((x) => x == null)) return undefined;
  return v.sort((a, b) => a - b).filter((x, i, a) => a.indexOf(x) === i);
}
// 7110 → «1:58:30»; 1710 → «28:30»
export function fmtTiempo(seg) {
  if (!Number.isFinite(Number(seg)) || seg <= 0) return '';
  const s = Math.round(Number(seg));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}
// «1:58:30», «58:30», «1h58» → segundos
export function leerTiempo(t) {
  const x = String(t ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!x) return null;
  let m = x.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  m = x.match(/^(\d{1,3}):(\d{2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = x.match(/^(\d{1,2})h(\d{1,2})?(?:m(?:in)?)?$/);
  if (m) return Number(m[1]) * 3600 + Number(m[2] || 0) * 60;
  return null;
}
// Duración legible: 20 → «20 s», 360 → «6 min», 90 → «1:30 min», 3900 → «1 h 5 min»
export function fmtDuracion(seg) {
  const s = Math.round(Number(seg) || 0);
  if (s <= 0) return '';
  if (s < 60) return `${s} s`;
  if (s >= 3600) { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return m ? `${h} h ${m} min` : `${h} h`; }
  return s % 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min` : `${s / 60} min`;
}
// 2000 → «2 km», 400 → «400 m», 1500 → «1,5 km»
export function fmtDistancia(m) {
  const v = Number(m) || 0;
  if (v <= 0) return '';
  return v >= 1000 ? `${num(v / 1000, v % 1000 ? (v % 100 ? 2 : 1) : 0)} km` : `${v} m`;
}
// Ritmo de un tiempo y una distancia (s/km)
export const ritmoDe = (seg, km) => (seg > 0 && km > 0 ? Math.round(seg / km) : null);
export const textoKm = (a, b) => (a != null && b != null && Number(b) !== Number(a) ? `${num(Number(a), a % 1 ? 1 : 0)}–${num(Number(b), b % 1 ? 1 : 0)} km` : a != null || b != null ? `${num(Number(a ?? b), (a ?? b) % 1 ? 1 : 0)} km` : '');

// ---------- las partes de una sesión ----------
// «2 × 6 min · Z4 (172–180 ppm) · 5:10–5:20 min/km · rec. 2 min trote suave»
export function textoParte(p, zonas = null) {
  if (!parteValida(p)) return '';
  const cuanto = [p.seg ? fmtDuracion(p.seg) : '', p.m ? fmtDistancia(p.m) : ''].filter(Boolean).join(' o ');
  const trozos = [];
  if (cuanto) trozos.push(p.reps && p.reps > 1 ? `${p.reps} × ${cuanto}` : cuanto);
  else if (p.reps > 1) trozos.push(`${p.reps} repeticiones`);
  if (p.zona) trozos.push(textoZona(p.zona, p.zona_hasta, zonas));
  if (p.ritmo) trozos.push(textoRitmo(p.ritmo));
  if (p.rec_seg || p.rec) trozos.push(`rec. ${[p.rec_seg ? fmtDuracion(p.rec_seg) : '', p.rec || ''].filter(Boolean).join(' ')}`);
  return trozos.join(' · ');
}
// Segundos que lleva una parte (las repeticiones con su recuperación; la distancia, al ritmo si lo hay o a 6 min/km)
export function segundosParte(p) {
  if (!parteValida(p)) return 0;
  const reps = p.reps || 1;
  const ritmo = Array.isArray(p.ritmo) && p.ritmo.length ? p.ritmo.reduce((a, b) => a + b, 0) / p.ritmo.length : 360;
  const una = p.seg || (p.m ? (p.m / 1000) * ritmo : 0);
  return Math.round(reps * una + Math.max(0, reps - 1) * (p.rec_seg || 0));
}
// Minutos aproximados de una pauta: los suyos o la suma de sus partes
export function minutosPauta(c) {
  if (!c) return null;
  if (c.minutos) return c.minutos;
  if (Array.isArray(c.partes) && c.partes.length) { const s = c.partes.reduce((a, p) => a + segundosParte(p), 0); return s ? Math.round(s / 60) : null; }
  return null;
}
// Una parte desde el editor (textos) → { parte, error }
export function limpiarParte({ fase = 'bloque', reps = '', min = '', seg = '', m = '', zona = '', zona_hasta = '', ritmo = '', rec_min = '', rec_seg = '', rec = '', nota = '' } = {}) {
  const p = { fase };
  const n = (v) => leerNumero(String(v ?? ''));
  const r = n(reps); if (r != null && r > 1) p.reps = Math.round(r);
  const dur = Math.round((n(min) || 0) * 60 + (n(seg) || 0));
  if (dur > 0) p.seg = dur;
  const metros = n(m); if (metros != null && metros > 0) p.m = Math.round(metros);
  const z = n(zona); if (z != null) p.zona = Math.round(z);
  const zh = n(zona_hasta); if (zh != null && p.zona && Math.round(zh) > p.zona) p.zona_hasta = Math.round(zh);
  const rt = leerRangoRitmo(ritmo);
  if (rt === undefined) return { parte: null, error: 'El ritmo se escribe como 5:10 o 5:10-5:20 (min/km).' };
  if (rt) p.ritmo = rt;
  const rs = Math.round((n(rec_min) || 0) * 60 + (n(rec_seg) || 0));
  if (rs > 0) p.rec_seg = rs;
  const rt2 = String(rec ?? '').trim(); if (rt2) p.rec = rt2.slice(0, 40);
  const nt = String(nota ?? '').trim(); if (nt) p.nota = nt.slice(0, 200);
  if (!p.seg && !p.m && !p.nota) return { parte: null, error: 'Pon cuánto dura (minutos o segundos), la distancia o una nota.' };
  if (p.seg && p.seg < 5) return { parte: null, error: 'Cada repetición, de 5 segundos como poco.' };
  return parteValida(p) ? { parte: p, error: null } : { parte: null, error: 'Revisa esta parte: repeticiones hasta 50, zona de 1 a 5 y recuperación hasta 30 min.' };
}
// Y al revés: de una parte a los textos del editor
export function parteAEditor(p = {}) {
  const s = p.seg || 0;
  return {
    fase: p.fase || 'bloque', reps: p.reps ? String(p.reps) : '', min: s >= 60 ? String(Math.floor(s / 60)) : '', seg: s % 60 ? String(s % 60) : '',
    m: p.m ? String(p.m) : '', zona: p.zona ? String(p.zona) : '', zona_hasta: p.zona_hasta ? String(p.zona_hasta) : '',
    ritmo: p.ritmo ? p.ritmo.map(fmtRitmo).join('-') : '', rec_min: p.rec_seg >= 60 ? String(Math.floor(p.rec_seg / 60)) : '', rec_seg: p.rec_seg % 60 ? String(p.rec_seg % 60) : '',
    rec: p.rec || '', nota: p.nota || '',
  };
}

// ---------- el semáforo antes de entrenar ----------
export const SEMAFORO = {
  verde: { titulo: 'Verde', corto: 'Bien', texto: 'Sesión completa, como está pautada.' },
  ambar: { titulo: 'Ámbar', corto: 'Regular', texto: 'Hoy, sin intensidad: todo en Z1–Z2 y entre un 20 y un 40 % menos de tiempo.' },
  rojo: { titulo: 'Rojo', corto: 'Mal', texto: 'Hoy no entrenes: descansa y cuéntaselo a tu coach.' },
};
export const PREGUNTAS_SEMAFORO = ['¿Has dormido bien?', '¿Tienes las piernas cargadas o algún dolor?', '¿Estás enfermo o con fiebre?'];
export const ALARMA = 'Si notas dolor en el pecho, falta de aire que no es normal, mareo o fiebre, para y pide atención médica.';
// La pauta de una sesión con el semáforo en ámbar: los minutos, un 20–40 % menos, y nada por encima de Z2
export function pautaAmbar(c) {
  if (!c) return null;
  const m = minutosPauta(c);
  return { minutos: m ? [Math.round(m * 0.6), Math.round(m * 0.8)] : null, zonaMax: 2, texto: m ? `${Math.round(m * 0.6)}–${Math.round(m * 0.8)} min suaves en Z1–Z2, sin series (entre un 20 y un 40 % menos de lo pautado)` : 'suave en Z1–Z2, sin series y entre un 20 y un 40 % más corto de lo pautado' };
}

// ---------- el plan: macrociclo y semanas ----------
export function fasesValidas(f) {
  return Array.isArray(f) && f.length >= 1 && f.length <= 12 && f.every((x) => x && typeof x === 'object' && !Array.isArray(x)
    && Object.keys(x).every((k) => ['nombre', 'semanas', 'nota'].includes(k)) && typeof x.nombre === 'string' && x.nombre.length >= 1 && x.nombre.length <= 30
    && Number.isInteger(x.semanas) && x.semanas >= 1 && x.semanas <= 30 && (x.nota === undefined || (typeof x.nota === 'string' && x.nota.length >= 1 && x.nota.length <= 200)))
    && f.reduce((a, x) => a + x.semanas, 0) <= 60;
}
export const semanasPlan = (perfil) => (fasesValidas(perfil?.fases) ? perfil.fases.reduce((a, x) => a + x.semanas, 0) : 0);
// La fase de cada semana: [{ nombre, semanas, nota, desde (lunes), hasta (domingo), primera, ultima (nº de semana) }]
export function macrociclo(perfil) {
  if (!perfil?.plan_inicio || !fasesValidas(perfil.fases)) return [];
  let n = 1;
  return perfil.fases.map((f) => {
    const x = { ...f, primera: n, ultima: n + f.semanas - 1, desde: sumarDias(perfil.plan_inicio, (n - 1) * 7), hasta: sumarDias(perfil.plan_inicio, (n + f.semanas - 1) * 7 - 1) };
    n += f.semanas;
    return x;
  });
}
// Qué semana del plan es un día (1…), o 0 antes de empezar, o más que el total después
export function semanaDelPlan(perfil, dia) {
  if (!perfil?.plan_inicio || !dia) return null;
  const d = diasEntre(perfil.plan_inicio, lunesDe(dia));
  return Math.floor(d / 7) + 1;
}
export function faseDe(perfil, dia) {
  const n = semanaDelPlan(perfil, dia);
  if (n == null) return null;
  return macrociclo(perfil).find((f) => n >= f.primera && n <= f.ultima) || null;
}
// Las semanas del plan, del lunes de inicio al final, con lo que el coach haya puesto de cada una
export function semanasConPlan(perfil, semanas = []) {
  const total = semanasPlan(perfil);
  if (!total || !perfil.plan_inicio) return [...semanas].sort((a, b) => (a.lunes < b.lunes ? -1 : 1)).map((s) => ({ ...s, n: null, fase: null }));
  const porLunes = Object.fromEntries(semanas.map((s) => [s.lunes, s]));
  const fases = macrociclo(perfil);
  const out = Array.from({ length: total }, (_, i) => {
    const lunes = sumarDias(perfil.plan_inicio, i * 7);
    return { lunes, sesiones: [], ...(porLunes[lunes] || {}), n: i + 1, fase: fases.find((f) => i + 1 >= f.primera && i + 1 <= f.ultima)?.nombre || null };
  });
  // Y las que estén fuera del plan (antes o después), por si el coach las puso
  const dentro = new Set(out.map((s) => s.lunes));
  for (const s of semanas) if (!dentro.has(s.lunes)) out.push({ ...s, n: null, fase: null });
  return out.sort((a, b) => (a.lunes < b.lunes ? -1 : 1));
}
export function sesionPlanValida(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return false;
  if (![...TIPOS_SESION_CARRERA, 'descanso'].includes(j.tipo)) return false;
  if (j.titulo !== undefined && !(typeof j.titulo === 'string' && j.titulo.length >= 1 && j.titulo.length <= 60)) return false;
  if (j.dia !== undefined && !(Number.isInteger(j.dia) && j.dia >= 1 && j.dia <= 7)) return false;
  if (j.tipo === 'descanso') return Object.keys(j).every((k) => ['tipo', 'titulo', 'dia', 'nota'].includes(k)) && (j.nota === undefined || (typeof j.nota === 'string' && j.nota.length >= 1 && j.nota.length <= 300));
  const { titulo, dia, ...resto } = j;
  if (!pautaValida({ ...resto, modalidad: resto.modalidad || 'carrera' }, false)) return false;
  return 'titulo' in j || 'minutos' in j || 'km' in j || 'partes' in j;
}
export const semanaPlanValida = (s) => Array.isArray(s?.sesiones) && s.sesiones.length <= 7 && s.sesiones.every(sesionPlanValida);
// Una sesión del plan → la sesión de la semana de entreno (las de descanso, ninguna)
export function sesionDesdePlan(item) {
  if (!sesionPlanValida(item) || item.tipo === 'descanso') return null;
  const { titulo, dia, ...pauta } = item;
  const cardio = { modalidad: 'carrera', ...pauta };
  if (!pautaValida(cardio, true)) delete cardio.partes;  // (por si acaso: sin volumen, no vale como sesión)
  const nombre = titulo || `Carrera ${NOMBRE_TIPO[item.tipo].toLowerCase()}`;
  return pautaValida(cardio, true) ? { nombre: nombre.slice(0, 60), tipo: 'cardio', cardio, dia: dia || null } : { nombre: nombre.slice(0, 60), tipo: 'cardio', cardio: null, dinamica: item.nota || null, dia: dia || null };
}
// La pauta de una receta, lista para una sesión
export function pautaDeReceta(r) {
  if (!r?.pauta || !pautaValida(r.pauta, true)) return null;
  return JSON.parse(JSON.stringify(r.pauta));
}

// ---------- carreras y cuenta atrás ----------
// La próxima carrera que cuenta (no las que no va): la A si hay, si no la primera
export function proximaCarrera(eventos = [], hoy) {
  const vienen = eventos.filter((e) => e.fecha >= hoy && e.decision !== 'no').sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  return vienen[0] || null;
}
export function carreraObjetivo(eventos = [], hoy) {
  return eventos.filter((e) => e.fecha >= hoy && e.prioridad === 'A' && e.decision !== 'no').sort((a, b) => (a.fecha < b.fecha ? -1 : 1))[0] || null;
}
// «Faltan 12 semanas y 3 días», «Mañana», «Hoy»
export function textoCuentaAtras(fecha, hoy) {
  const d = diasEntre(hoy, fecha);
  if (d < 0) return '';
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Mañana';
  if (d < 14) return `Faltan ${d} días`;
  const s = Math.floor(d / 7), r = d % 7;
  return `Faltan ${s} semanas${r ? ` y ${r} ${r === 1 ? 'día' : 'días'}` : ''}`;
}
// «21,1 km · objetivo 1:59:00 (5:38 min/km)»
export function textoObjetivoCarrera(e) {
  if (!e) return '';
  const r = e.objetivo_ritmo || (e.objetivo_seg && e.distancia_km ? ritmoDe(e.objetivo_seg, Number(e.distancia_km)) : null);
  const obj = e.objetivo_seg ? `objetivo ${fmtTiempo(e.objetivo_seg)}${r ? ` (${fmtRitmo(r)} min/km)` : ''}` : r ? `a ${fmtRitmo(r)} min/km` : '';
  return [e.distancia_km ? `${num(Number(e.distancia_km), Number(e.distancia_km) % 1 ? 1 : 0)} km` : '', e.desnivel_m ? `+${e.desnivel_m} m` : '', obj].filter(Boolean).join(' · ');
}
export function textoResultado(e) {
  if (!e?.resultado_seg) return '';
  const r = e.distancia_km ? ritmoDe(e.resultado_seg, Number(e.distancia_km)) : null;
  return `${fmtTiempo(e.resultado_seg)}${r ? ` (${fmtRitmo(r)} min/km)` : ''}`;
}

// ---------- kilómetros y semanas hechas ----------
// Kilómetros y minutos de carrera hechos por semana (lunes → { km, minutos, sesiones })
export function carreraHechaPorSemana(sesiones = []) {
  const out = {};
  for (const s of sesiones) {
    if (!s?.completada || !s.fecha_realizada || !cardioHechoValido(s.cardio_hecho) || s.cardio_hecho.modalidad !== 'carrera') continue;
    const l = lunesDe(s.fecha_realizada);
    const x = out[l] || (out[l] = { km: 0, minutos: 0, sesiones: 0 });
    x.km = Math.round((x.km + (s.cardio_hecho.km || 0)) * 10) / 10;
    x.minutos += s.cardio_hecho.minutos;
    x.sesiones++;
  }
  return out;
}
// Cómo va una semana respecto a sus km previstos: 'bien' (dentro), 'corta' (menos), 'larga' (más) o null
export function estadoKm(hecho, s) {
  if (!hecho || (s?.km_min == null && s?.km_max == null)) return null;
  const min = Number(s.km_min ?? s.km_max), max = Number(s.km_max ?? s.km_min);
  if (hecho.km < min * 0.9) return 'corta';
  if (hecho.km > max * 1.1) return 'larga';
  return 'bien';
}

// ---------- lo que escribe el coach: limpiar antes de guardar ----------
const entero = (v) => { const n = leerNumero(String(v ?? '')); return n == null ? null : Math.round(n); };
export function limpiarPerfil(x = {}) {
  const out = {
    lthr: entero(x.lthr), fc_max: entero(x.fc_max), fc_reposo: entero(x.fc_reposo),
    test_fecha: x.test_fecha || null, test_tipo: x.test_tipo || null,
    plan_nombre: String(x.plan_nombre ?? '').trim().slice(0, 80) || null,
    plan_inicio: x.plan_inicio ? lunesDe(x.plan_inicio) : null,
    ventanas: entero(x.ventanas), nota: String(x.nota ?? '').trim().slice(0, 2000) || null,
  };
  if (out.lthr != null && (out.lthr < 100 || out.lthr > 230)) return { perfil: null, error: 'La FC umbral, de 100 a 230 ppm.' };
  if (out.fc_max != null && (out.fc_max < 100 || out.fc_max > 240)) return { perfil: null, error: 'La FC máxima, de 100 a 240 ppm.' };
  if (out.fc_reposo != null && (out.fc_reposo < 30 || out.fc_reposo > 120)) return { perfil: null, error: 'La FC en reposo, de 30 a 120 ppm.' };
  if (out.ventanas != null && (out.ventanas < 1 || out.ventanas > 7)) return { perfil: null, error: 'Las sesiones de carrera por semana, de 1 a 7.' };
  const u = leerRangoRitmo(x.umbral);
  if (u === undefined) return { perfil: null, error: 'El ritmo umbral se escribe como 5:10 o 5:10-5:20.' };
  out.umbral = u && u.length ? u : null;
  // Zonas a mano: dónde empiezan Z2, Z3, Z4 y Z5 (cuatro números de menos a más) o nada
  const zs = [x.z2, x.z3, x.z4, x.z5].map(entero);
  if (zs.every((v) => v == null)) out.zonas = null;
  else if (zs.some((v) => v == null) || zs.some((v, i) => i && v <= zs[i - 1]) || zs[0] < 60 || zs[3] > 240) return { perfil: null, error: 'Las zonas a mano: dónde empiezan Z2, Z3, Z4 y Z5, de menos a más (o déjalas vacías para calcularlas de la FC umbral).' };
  else out.zonas = zs;
  const fases = (x.fases || []).map((f) => ({ nombre: String(f.nombre ?? '').trim().slice(0, 30), semanas: entero(f.semanas), ...(String(f.nota ?? '').trim() ? { nota: String(f.nota).trim().slice(0, 200) } : {}) }))
    .filter((f) => f.nombre || f.semanas);
  if (fases.length && !fasesValidas(fases)) return { perfil: null, error: 'Cada fase necesita nombre y de 1 a 30 semanas (60 en total como mucho).' };
  out.fases = fases.length ? fases : null;
  return { perfil: out, error: null };
}
export function limpiarEvento(x = {}) {
  const nombre = String(x.nombre ?? '').trim().slice(0, 80);
  if (!nombre) return { evento: null, error: 'Ponle nombre a la carrera.' };
  if (!x.fecha) return { evento: null, error: 'Pon la fecha de la carrera.' };
  const km = leerNumero(String(x.distancia_km ?? ''));
  const obj = leerTiempo(x.objetivo);
  const res = leerTiempo(x.resultado);
  if (String(x.objetivo ?? '').trim() && obj == null) return { evento: null, error: 'El tiempo objetivo se escribe como 1:59:00 o 58:30.' };
  if (String(x.resultado ?? '').trim() && res == null) return { evento: null, error: 'El resultado se escribe como 1:58:43 o 58:30.' };
  const ritmoObj = String(x.objetivo_ritmo ?? '').trim() ? leerRitmo(x.objetivo_ritmo) : null;
  if (String(x.objetivo_ritmo ?? '').trim() && ritmoObj == null) return { evento: null, error: 'El ritmo objetivo se escribe como 5:41.' };
  const ev = {
    nombre, fecha: x.fecha, distancia_km: km != null && km > 0 ? Math.round(km * 100) / 100 : null, desnivel_m: entero(x.desnivel_m),
    prioridad: ['A', 'B', 'C'].includes(x.prioridad) ? x.prioridad : 'B', decision: ['va', 'entreno', 'no', 'pendiente'].includes(x.decision) ? x.decision : 'va',
    objetivo_seg: obj, objetivo_ritmo: ritmoObj, nota: String(x.nota ?? '').trim().slice(0, 500) || null,
    resultado_seg: res, resultado_nota: String(x.resultado_nota ?? '').trim().slice(0, 500) || null,
  };
  if (ev.distancia_km != null && ev.distancia_km > 400) return { evento: null, error: 'La distancia, hasta 400 km.' };
  return { evento: ev, error: null };
}
export function limpiarRevision(x = {}) {
  const titulo = String(x.titulo ?? '').trim().slice(0, 80);
  if (!titulo || !x.fecha) return { revision: null, error: 'Pon la fecha y qué se revisa.' };
  return { revision: { fecha: x.fecha, titulo, criterio: String(x.criterio ?? '').trim().slice(0, 300) || null, decision: String(x.decision ?? '').trim().slice(0, 500) || null,
    estado: ['pendiente', 'verde', 'ambar', 'rojo'].includes(x.estado) ? x.estado : 'pendiente' }, error: null };
}
export function limpiarSemana(x = {}) {
  const kmin = leerNumero(String(x.km_min ?? '')), kmax = leerNumero(String(x.km_max ?? ''));
  const s = {
    lunes: lunesDe(x.lunes), etiqueta: String(x.etiqueta ?? '').trim().slice(0, 24) || null,
    km_min: kmin != null ? Math.round(kmin * 10) / 10 : null, km_max: kmax != null ? Math.round(kmax * 10) / 10 : null,
    ab: ['A', 'B'].includes(x.ab) ? x.ab : null, clave: String(x.clave ?? '').trim().slice(0, 300) || null, nota: String(x.nota ?? '').trim().slice(0, 500) || null,
    sesiones: Array.isArray(x.sesiones) ? x.sesiones : [],
  };
  if (s.km_min != null && s.km_max != null && s.km_max < s.km_min) return { semana: null, error: 'Los km: el mínimo, antes que el máximo.' };
  if (s.km_max === 0) s.km_max = null;
  if (!semanaPlanValida(s)) return { semana: null, error: 'Revisa las sesiones de la semana (7 como mucho).' };
  return { semana: s, error: null };
}

// Lo de carrera de un atleta que se enseña: la ficha tiene la carrera encendida (y se le lleva el entrenamiento)
export const conCarrera = (a) => !!a?.carrera && a?.entrenamiento !== false;
export { FASES_PARTE, TIPOS_SESION_CARRERA, ritmoValido };
