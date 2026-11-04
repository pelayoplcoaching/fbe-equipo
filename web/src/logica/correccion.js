// v0.59 (migración 037): lo que no depende de la pantalla ni de la base de la tanda A de los vídeos de técnica: las frases
// de corrección (con unas sugeridas para los básicos), los recordatorios («Recuerda: …»), la valoración del atleta antes de
// enviar el vídeo, «Comparar con su mejor» y los tiempos de la cola de Revisar.
import { patronEjercicio } from './diseno.js';
import { textoVisible } from './texto.js';
import { dibujoValido, MAX_FORMAS } from './dibujo.js';
import { normal as sinTildes } from './busqueda.js';
import { ZONAS_LESION } from './cuestionario.js';

const largo = (s) => [...String(s ?? '')].length;
const espacios = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
const num = (x) => typeof x === 'number' && Number.isFinite(x);
const coma = (x, d = 1) => String(Math.round(x * 10 ** d) / 10 ** d).replace('.', ',');

// ---------- Frases de corrección ----------
export const MAX_TEXTO_FRASE = 140;
// Sugeridas para los básicos (neutras, como los puntos clave de la 035): el coach las cambia o las borra; no van en la base
// hasta que las guarda
const FRASES = {
  sentadilla: ['Rodillas hacia fuera, en la línea de los pies', 'Baja un poco más sin perder la espalda neutra', 'Sube con el pecho y la cadera a la vez', 'Coge aire y aprieta el tronco antes de bajar', 'Todo el pie apoyado: que no se levanten los talones'],
  bisagra: ['Barra pegada a las piernas todo el recorrido', 'Espalda neutra: no la redondees al bajar', 'Empuja el suelo y lleva la cadera adelante al final', 'Hombros encima de la barra al despegar', 'Baja controlando, sin soltar la tensión'],
  empuje_h: ['Escápulas juntas y abajo antes de bajar la barra', 'Codos a unos 45°, un poco más cerrados', 'Toca el pecho controlando, sin rebote', 'Pies firmes y glúteos en el banco', 'Muñecas rectas, encima de los codos'],
  empuje_v: ['Aprieta glúteos y abdomen: sin arquear la zona lumbar', 'La barra cerca de la cara al subir', 'Termina con la barra encima del medio pie', 'Antebrazos verticales en todo el recorrido'],
  tiron_h: ['Tira con los codos hacia la cadera', 'Tronco quieto, sin balanceo', 'Junta las escápulas al final', 'Estira los brazos del todo al bajar'],
  tiron_v: ['Hombros abajo antes de tirar', 'Lleva el pecho hacia la barra', 'Baja controlando hasta estirar los brazos', 'Sin balanceo ni impulso'],
  unilateral: ['Rodilla de delante en la línea del pie', 'Tronco estable, sin irte hacia un lado', 'Peso en todo el pie de delante', 'La misma profundidad en cada repetición'],
  hip_thrust: ['Barbilla recogida y mirada al frente', 'Tibias verticales arriba', 'Bloquea con glúteos, sin arquear la zona lumbar', 'Pausa breve arriba y baja controlando'],
  general: ['Recorrido completo y controlado', 'Sin impulso ni balanceo', 'Muy bien: mantén esta técnica con más carga'],
};
const HIP_THRUST = /\b(hip ?thrust|empuje de cadera|puentes? de gluteos?|puente de gluteo)\b/;
export function frasesSugeridas(nombre = '', grupos = [], tipo = []) {
  if (HIP_THRUST.test(sinTildes(String(nombre || '')))) return [...FRASES.hip_thrust];
  return [...(FRASES[patronEjercicio(nombre, grupos, tipo)] || FRASES.general)];
}
// Como frases_correccion_validas en la base: de 1 a 140 letras visibles y, si lleva dibujo, uno válido
export const fraseValida = (f) => !!f && typeof f.texto === 'string' && largo(espacios(f.texto)) >= 1 && largo(espacios(f.texto)) <= MAX_TEXTO_FRASE && textoVisible(f.texto)
  && (f.dibujo == null || dibujoValido(f.dibujo)) && (f.orden == null || (Number.isInteger(f.orden) && f.orden >= 0 && f.orden <= 999));
export const limpiarTextoFrase = (t) => [...espacios(t)].slice(0, MAX_TEXTO_FRASE).join('');
// Las de un ejercicio (las suyas primero, en su orden) y después las de todos
export function frasesPara(frases = [], ejercicioId = null) {
  const orden = (a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(a.creado_en || '').localeCompare(String(b.creado_en || ''));
  return [...(frases || []).filter((f) => ejercicioId && f.ejercicio_id === ejercicioId).sort(orden), ...(frases || []).filter((f) => f.ejercicio_id == null).sort(orden)];
}
// Poner una frase en el comentario: en una línea nueva y con el momento del vídeo delante (como «Comentar este momento»);
// si ya está, no se repite
export function insertarFrase(texto = '', frase = '', { momento = null } = {}) {
  const f = espacios(frase);
  if (!f) return texto || '';
  const base = String(texto || '').trimEnd();
  if (base.includes(f)) return texto || '';
  const linea = momento ? `${momento} ${f}` : f;
  if (!base) return linea;
  // Si la última línea es solo el momento («0:04 »), la frase va detrás
  const lineas = base.split('\n');
  const ultima = lineas[lineas.length - 1].trim();
  if (momento && ultima === momento) { lineas[lineas.length - 1] = linea; return lineas.join('\n'); }
  return `${base}\n${linea}`;
}
// El dibujo de una frase, en el momento en que está el vídeo (con el mismo tramo, si lo lleva); junto al que ya hay en el
// comentario (como mucho 24 formas)
export function dibujoEnMomento(d, t, actual = null) {
  if (!dibujoValido(d) || !num(t)) return actual;
  const t0 = Math.round(Math.min(3599, Math.max(0, t)) * 100) / 100;
  const hasta = d.hasta != null ? Math.round(Math.min(3600, t0 + (d.hasta - d.t)) * 100) / 100 : null;
  const formas = [...(actual && dibujoValido(actual) && Math.abs(actual.t - t0) < 0.05 ? actual.formas : []), ...d.formas].slice(0, MAX_FORMAS);
  const out = { t: t0, formas: JSON.parse(JSON.stringify(formas)) };
  if (hasta != null && hasta > t0) out.hasta = hasta;
  return dibujoValido(out) ? out : actual;
}
// Para guardar un dibujo en una frase: desde el 0 (se pondrá en el momento en que se use)
export function dibujoParaFrase(d) {
  if (!dibujoValido(d)) return null;
  const out = { t: 0, formas: JSON.parse(JSON.stringify(d.formas)) };
  if (d.hasta != null) out.hasta = Math.round(Math.min(3600, d.hasta - d.t) * 100) / 100;
  return dibujoValido(out) ? out : { t: 0, formas: out.formas };
}

// ---------- Recordatorios de técnica ----------
export const MAX_RECORDATORIOS = 3;
export const MAX_TEXTO_RECORDATORIO = 140;
export const limpiarTextoRecordatorio = (t) => { const x = [...espacios(t)]; return x.length > MAX_TEXTO_RECORDATORIO ? `${x.slice(0, MAX_TEXTO_RECORDATORIO - 1).join('').trimEnd()}…` : x.join(''); };
export const textoRecordatorioValido = (t) => typeof t === 'string' && largo(espacios(t)) >= 1 && largo(espacios(t)) <= MAX_TEXTO_RECORDATORIO && textoVisible(t);
// Como recordatorios_tecnica_validos: el momento, solo con su vídeo y dentro de él
export const recordatorioValido = (r) => !!r && textoRecordatorioValido(r.texto) && (r.segundo == null || (r.archivo_id != null && num(Number(r.segundo)) && Number(r.segundo) >= 0 && Number(r.segundo) <= 3600));
// Lo que se propone fijar: los puntos «a corregir» (✗) del último vídeo corregido de ese ejercicio (con su momento), sin
// los que ya son recordatorios activos. videos: los del diario del atleta (con su revisión)
export function sugerenciasRecordatorio(videos = [], ejercicioId = null, activos = []) {
  if (!ejercicioId) return [];
  const ej = (v) => v?.ejercicio?.id || v?.ejercicio_id || null;
  const ultimo = [...(videos || [])].filter((v) => v.tipo === 'video_tecnica' && ej(v) === ejercicioId && v.revision?.corregido_el && v.revision?.checklist?.puntos?.some((p) => p.e === 'mal'))
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || String(b.creado_en || '').localeCompare(String(a.creado_en || '')))[0];
  if (!ultimo) return [];
  const ya = new Set((activos || []).map((r) => espacios(r.texto).toLowerCase()));
  return ultimo.revision.checklist.puntos.filter((p) => p.e === 'mal').map((p) => ({ texto: limpiarTextoRecordatorio(p.t), archivoId: ultimo.id, segundo: num(p.s) ? p.s : null }))
    .filter((s) => !ya.has(s.texto.toLowerCase()));
}
// Por ejercicio: { ejercicio_id: [recordatorios] } (como mucho 3 cada uno)
export function recordatoriosPorEjercicio(lista = []) {
  const out = {};
  for (const r of lista || []) (out[r.ejercicio_id] ||= []).push(r);
  for (const k of Object.keys(out)) out[k] = out[k].slice(0, MAX_RECORDATORIOS);
  return out;
}
// «Entendido» se recuerda en el móvil solo ese día
export const claveEntendido = (id, dia) => `fbe-recuerda-${id}-${dia}`;

// ---------- La valoración del atleta (antes de enviar el vídeo) ----------
export const RPES_AUTO = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
export const MAX_NOTA_AUTO = 280;
export const ZONAS_MOLESTIA = ZONAS_LESION;
export const NOMBRE_ZONA_MOLESTIA = Object.fromEntries(ZONAS_LESION);
export const rpeAutoValido = (x) => x == null || (num(x) && x >= 6 && x <= 10 && Math.round(x * 2) === x * 2);
// Como video_autoevaluacion_valida: algo que contar, cada cosa en su rango; la zona, solo con molestia
export function autoevaluacionValida(f) {
  if (!f || typeof f !== 'object') return false;
  const nota = f.nota == null ? null : String(f.nota);
  return rpeAutoValido(f.rpe == null ? null : Number(f.rpe))
    && (nota == null || (largo(nota) >= 1 && largo(nota) <= MAX_NOTA_AUTO && textoVisible(nota)))
    && (f.molestia == null || typeof f.molestia === 'boolean')
    && (f.zona == null || (f.molestia === true && Object.prototype.hasOwnProperty.call(NOMBRE_ZONA_MOLESTIA, f.zona)))
    && (f.rpe != null || nota != null || f.molestia != null);
}
// Lo que se guarda (o null si no hay nada que contar). Sin consentimiento de datos de salud, nada de la molestia.
export function limpiarAutoevaluacion({ rpe = null, nota = null, molestia = null, zona = null } = {}, { salud = false } = {}) {
  const n = espacios(nota);
  const out = {
    rpe: rpeAutoValido(rpe == null || rpe === '' ? null : Number(rpe)) && rpe != null && rpe !== '' ? Number(rpe) : null,
    nota: n && textoVisible(n) ? [...n].slice(0, MAX_NOTA_AUTO).join('') : null,
    molestia: salud && typeof molestia === 'boolean' ? molestia : null,
    zona: null,
  };
  if (out.molestia === true && zona && NOMBRE_ZONA_MOLESTIA[zona]) out.zona = zona;
  return out.rpe != null || out.nota != null || out.molestia != null ? out : null;
}
// Para el coach, arriba de la revisión: «Ana nota: …», su esfuerzo y si nota alguna molestia
export function textoAutoevaluacion(a, nombre = 'Tu atleta') {
  if (!a) return null;
  const primero = String(nombre || 'Tu atleta').split(' ')[0];
  return {
    titulo: `${primero} nota:`,
    nota: a.nota || null,
    rpe: num(Number(a.rpe)) && a.rpe != null ? `RPE ${coma(Number(a.rpe))}` : null,
    molestia: a.molestia === true ? `Molestia${a.zona && NOMBRE_ZONA_MOLESTIA[a.zona] ? `: ${NOMBRE_ZONA_MOLESTIA[a.zona].toLowerCase()}` : ''}` : a.molestia === false ? 'Sin molestias' : null,
  };
}
// Su esfuerzo frente a tu nota de técnica (para leerlos juntos)
export function compararAutoevaluacion(a, puntuacion = null) {
  const rpe = a && a.rpe != null && num(Number(a.rpe)) ? Number(a.rpe) : null;
  if (rpe == null && puntuacion == null) return null;
  const partes = [];
  if (rpe != null) partes.push(`su esfuerzo, RPE ${coma(rpe)}`);
  if (puntuacion != null) partes.push(`tu nota de técnica, ${puntuacion}/5`);
  let lectura = null;
  if (rpe != null && puntuacion != null) {
    if (rpe >= 9 && puntuacion <= 2) lectura = 'Muy exigente y la técnica se resiente: quizá toque bajar la carga.';
    else if (rpe <= 7.5 && puntuacion >= 4) lectura = 'Le costó poco y la técnica es buena: hay margen.';
    else if (rpe >= 9 && puntuacion >= 4) lectura = 'Muy exigente, pero la técnica aguanta.';
  }
  return { texto: partes.join(' · '), lectura };
}

// ---------- «Comparar con su mejor» ----------
// La velocidad media más alta guardada en el análisis de un vídeo (o null)
export function velocidadMaxima(analisis) {
  const vs = (analisis?.reps || []).map((r) => r?.vm).filter(num);
  return vs.length ? Math.max(...vs) : null;
}
// Su mejor vídeo de ese ejercicio entre los corregidos (sin el que se revisa): la mejor nota; si empatan (o no hay), la
// mayor velocidad guardada; y si no, el más reciente. Del mismo atleta y del mismo ejercicio.
export function mejorVideo(videos = [], actual = null) {
  if (!actual) return null;
  const ej = (v) => v?.ejercicio?.id || v?.ejercicio_id || null;
  const ejA = ej(actual);
  if (!ejA) return null;
  const cands = (videos || []).filter((v) => v && v.id !== actual.id && v.tipo === 'video_tecnica' && ej(v) === ejA
    && (!actual.atleta_id || !v.atleta_id || v.atleta_id === actual.atleta_id) && v.revision?.corregido_el);
  if (!cands.length) return null;
  const nota = (v) => (v.revision?.puntuacion != null ? v.revision.puntuacion : -1);
  const vel = (v) => velocidadMaxima(v.revision?.analisis) ?? -1;
  return [...cands].sort((a, b) => nota(b) - nota(a) || vel(b) - vel(a) || String(b.fecha || '').localeCompare(String(a.fecha || '')) || String(b.creado_en || '').localeCompare(String(a.creado_en || '')))[0];
}
export function porQueMejor(v) {
  if (!v?.revision) return '';
  const p = [];
  if (v.revision.puntuacion != null) p.push(`nota ${v.revision.puntuacion}/5`);
  const vm = velocidadMaxima(v.revision.analisis);
  if (vm != null) p.push(`${coma(vm, 2)} m/s`);
  return p.join(' · ');
}

// ---------- Los tiempos de la cola de Revisar (solo el coach) ----------
export const OBJETIVOS_REVISION = [24, 48];
export const OBJETIVO_REVISION = 24;
export const horasEsperando = (creado, ahora = Date.now()) => { const t = Date.parse(creado || ''); return Number.isFinite(t) ? Math.max(0, (ahora - t) / 3600000) : null; };
// «hace 26 h» (hasta 3 días, en horas; después, en días)
export function textoEspera(h) {
  if (!num(h)) return '';
  if (h < 1) return 'hace menos de 1 h';
  if (h < 72) return `hace ${Math.floor(h)} h`;
  return `hace ${Math.floor(h / 24)} días`;
}
// Con el objetivo del coach (24 o 48 h): a tiempo (hasta la mitad), cerca (hasta el objetivo) o pasado
export function nivelEspera(h, objetivo = OBJETIVO_REVISION) {
  if (!num(h)) return null;
  const o = OBJETIVOS_REVISION.includes(objetivo) ? objetivo : OBJETIVO_REVISION;
  return h <= o / 2 ? 'ok' : h <= o ? 'aviso' : 'alerta';
}
export const NOMBRE_NIVEL_ESPERA = { ok: 'a tiempo', aviso: 'cerca del objetivo', alerta: 'pasado el objetivo' };
// De más tiempo esperando a menos (lo que no es un vídeo, detrás y como estaba)
export function ordenarPorEspera(items = [], clave = (x) => x?.a?.creado_en) {
  const conT = (x) => Date.parse(clave(x) || '') || null;
  return [...(items || [])].map((x, i) => ({ x, i, t: conT(x) })).sort((p, q) => (p.t == null) - (q.t == null) || (p.t != null && q.t != null ? p.t - q.t : 0) || p.i - q.i).map((y) => y.x);
}
// Los grupos de Revisar (por atleta): primero el que tiene el vídeo que más lleva esperando, y dentro, sus vídeos por espera
export function ordenarGruposPorEspera(grupos = [], clave = (x) => x?.a?.creado_en) {
  const masViejo = (g) => Math.min(...g.items.map((x) => Date.parse(clave(x) || '') || Infinity));
  return [...(grupos || [])].map((g, i) => ({ g: { ...g, items: ordenarPorEspera(g.items, clave) }, i, t: masViejo(g) }))
    .sort((p, q) => (p.t === Infinity) - (q.t === Infinity) || (p.t !== Infinity && q.t !== Infinity ? p.t - q.t : 0) || p.i - q.i).map((x) => x.g);
}
const mediana = (xs) => { if (!xs.length) return null; const o = [...xs].sort((a, b) => a - b); const m = Math.floor(o.length / 2); return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; };
const p90 = (xs) => { if (!xs.length) return null; const o = [...xs].sort((a, b) => a - b); return o[Math.max(0, Math.ceil(0.9 * o.length) - 1)]; };
// El lunes de esta semana a las 0:00 (en la hora del móvil)
export function inicioSemana(ahora = Date.now()) {
  const d = new Date(ahora);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
// videos: [{ creado_en, revisado_en, corregido_en }] (los de técnica). Revisado = lo primero entre «Revisado» (o una
// respuesta) y la corrección. Los de los últimos 30 días: la mediana y el p90 (en horas); los de esta semana; y el que
// más tiempo lleva esperando.
export function estadisticasRevision(videos = [], { ahora = Date.now(), desdeSemana = inicioSemana(ahora) } = {}) {
  const hechos = [], pendientes = [];
  let semana = 0;
  for (const v of videos || []) {
    const c = Date.parse(v?.creado_en || '');
    if (!Number.isFinite(c)) continue;
    const momentos = [v.revisado_en, v.corregido_en].map((x) => Date.parse(x || '')).filter(Number.isFinite);
    if (!momentos.length) { pendientes.push((ahora - c) / 3600000); continue; }
    const r = Math.min(...momentos);
    if (r >= desdeSemana && r <= ahora) semana++;
    if (r >= ahora - 30 * 864e5 && r <= ahora) hechos.push(Math.max(0, (r - c) / 3600000));
  }
  const red = (x) => (x == null ? null : Math.round(x * 10) / 10);
  return { n30: hechos.length, mediana: red(mediana(hechos)), p90: red(p90(hechos)), semana, pendientes: pendientes.length, masAntiguo: pendientes.length ? red(Math.max(...pendientes)) : null };
}
// «26 h», «3,5 días»
export function textoHoras(h) {
  if (!num(h)) return '—';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 72) return `${coma(h, h < 10 ? 1 : 0)} h`;
  return `${coma(h / 24, 1)} días`;
}
