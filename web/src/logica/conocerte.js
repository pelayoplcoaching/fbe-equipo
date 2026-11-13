// (personalización 2, tanda 3) Que la app le conozca: «la última vez…» contado como persona, sus momentos buenos, sus
// costumbres (el descanso que de verdad hace, siempre preguntando), cómo está hoy y su molestia por zona (con el texto
// del coach). Lógica pura.
import { diasEntre } from './fechas.js';
import { segunTono } from './trato.js';
import { FRANJAS, franjaDe, horaMadrid } from './perfil.js';
import { patronEjercicio } from './diseno.js';

// «Dormiste 5 horas, Ana» (sin nombre, tal cual)
const yNombre = (t, texto) => (t?.nombre ? `${texto}, ${t.nombre}` : texto);
const n1 = (v) => String(Math.round(Number(v) * 10) / 10).replace('.', ',');
const ORDINAL = ['', 'primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta', 'séptima', 'octava', 'novena', 'décima'];
const DIAS_PLURAL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];

// ---------- 11. «La última vez…» contado como persona ----------
// ultimas: { fecha, series: [{ numero, kg, reps, rpe }], pauta: { reps_min, reps_max } } (api.ultimasPorEjercicio).
// Solo lo que pasó (sin inventar): una serie que costó mucho, una que se quedó corta, todas arriba del rango o todo
// cómodo. Si no hubo nada que contar, null.
export function fraseUltimaVez(ultimas, t = null, { hoy = null } = {}) {
  const ss = (ultimas?.series || []).filter((s) => Number(s.reps) > 0).sort((a, b) => Number(a.numero) - Number(b.numero));
  if (!ss.length) return null;
  const min = Number(ultimas?.pauta?.reps_min) || null, max = Number(ultimas?.pauta?.reps_max) || min;
  const cuando = hoy && ultimas?.fecha ? (() => { const d = diasEntre(ultimas.fecha, hoy); return d === 1 ? 'Ayer' : d > 1 && d < 7 ? `Hace ${d} días` : 'La última vez'; })() : 'La última vez';
  const cual = (s, i) => (ORDINAL[i + 1] ? `la ${ORDINAL[i + 1]} serie` : `la serie ${s.numero}`);
  const dura = ss.findIndex((s) => Number(s.rpe) >= 9.5);
  if (dura >= 0) {
    return segunTono(t, {
      cercano: `${cuando} ${cual(ss[dura], dura)} te costó (RPE ${n1(ss[dura].rpe)}): hoy empieza con calma y escucha al cuerpo.`,
      directo: `${cuando}: RPE ${n1(ss[dura].rpe)} en ${cual(ss[dura], dura)}. Hoy, empieza con calma.`,
      tope: `${cuando} ${cual(ss[dura], dura)} fue una guerra (RPE ${n1(ss[dura].rpe)}): hoy, cabeza fría al principio y a por todas al final.`,
    });
  }
  const corta = min ? ss.findIndex((s) => Number(s.reps) < min) : -1;
  if (corta >= 0) {
    return segunTono(t, {
      cercano: `${cuando} ${cual(ss[corta], corta)} se quedó en ${ss[corta].reps} (pedía ${min}${max && max !== min ? `–${max}` : ''}): hoy, a por el rango.`,
      directo: `${cuando}: ${ss[corta].reps} repeticiones en ${cual(ss[corta], corta)}, por debajo de ${min}. Hoy, al rango.`,
      tope: `${cuando} ${cual(ss[corta], corta)} se te quedó en ${ss[corta].reps}: hoy esas repeticiones son tuyas.`,
    });
  }
  if (max && ss.length >= 2 && ss.every((s) => Number(s.reps) >= max)) {
    return yNombre(t, segunTono(t, {
      cercano: `${cuando} hiciste todas las series al tope del rango (${max} o más): hoy puede ser el día de subir un poco`,
      directo: `${cuando}: todas las series a ${max} o más. Hoy, prueba a subir`,
      tope: `${cuando} reventaste el rango en todas las series: hoy toca subir`,
    })) + '.';
  }
  const conRpe = ss.filter((s) => Number(s.rpe) > 0);
  if (conRpe.length >= 2 && conRpe.every((s) => Number(s.rpe) <= 7)) {
    return segunTono(t, {
      cercano: `${cuando} fue cómodo (RPE ${n1(Math.max(...conRpe.map((s) => Number(s.rpe))))} como mucho): hoy hay margen.`,
      directo: `${cuando}: RPE ${n1(Math.max(...conRpe.map((s) => Number(s.rpe))))} como mucho. Hay margen.`,
      tope: `${cuando} te sobró gasolina: hoy, a gastarla.`,
    });
  }
  return null;
}

// ---------- 12. Sus momentos buenos ----------
// entrenos: [{ fecha, inicio, records, rpe_sesion }] (api.entrenamientos). El día y la franja en que caen más récords
// (con al menos 3 sesiones ahí, 10 en total y bastante por encima de lo suyo de siempre). null si no se ve claro.
export function mejorMomento(entrenos = [], hoy = null) {
  const con = (entrenos || []).filter((x) => x?.fecha && (!hoy || x.fecha <= hoy) && x.inicio);
  if (con.length < 10) return null;
  const celdas = {};
  let records = 0;
  for (const x of con) {
    const f = franjaDe(horaMadrid(x.inicio));
    if (!f) continue;
    const dow = (new Date(`${x.fecha}T12:00:00Z`).getUTCDay() + 6) % 7;
    const k = `${dow}:${f}`;
    const c = (celdas[k] ||= { dow, franja: f, sesiones: 0, records: 0 });
    c.sesiones += 1; c.records += Number(x.records) || 0; records += Number(x.records) || 0;
  }
  if (!records) return null;
  const media = records / con.length;
  const mejor = Object.values(celdas).filter((c) => c.sesiones >= 3).map((c) => ({ ...c, tasa: c.records / c.sesiones })).sort((a, b) => b.tasa - a.tasa || b.sesiones - a.sesiones)[0];
  if (!mejor || mejor.records < 2 || mejor.tasa < media * 1.3) return null;
  const franja = (FRANJAS.find(([k]) => k === mejor.franja)?.[1] || '').toLocaleLowerCase('es');
  const dia = DIAS_PLURAL[mejor.dow];
  return {
    ...mejor, dia, franja,
    texto: `Tus ${dia} ${franja} son tu mejor momento: ahí han caído ${mejor.records} ${mejor.records === 1 ? 'récord' : 'récords'} en ${mejor.sesiones} sesiones.`,
    propuesta: `Me he dado cuenta de que rindo mejor los ${dia} ${franja} (${mejor.records} récords en ${mejor.sesiones} sesiones). Si te encaja, ¿podemos poner ahí la sesión más dura de la semana?`,
  };
}

// ---------- 13. Sus costumbres: el descanso que de verdad hace ----------
// series: las de la última vez (con registrada_en). Entre serie y serie pasa el descanso más lo que dura la serie (se
// cuentan 30 s). Se propone solo si el coach no ha puesto descanso (lo del coach manda), si hay al menos 2 huecos
// razonables y si se aleja medio minuto o más del que tiene ahora. Redondeado a 15 s.
export function descansoReal(series = []) {
  const ts = (series || []).map((s) => Date.parse(s.registrada_en)).filter(Number.isFinite).sort((a, b) => a - b);
  const huecos = [];
  for (let i = 1; i < ts.length; i++) { const d = (ts[i] - ts[i - 1]) / 1000; if (d >= 45 && d <= 420) huecos.push(d); }
  if (huecos.length < 2) return null;
  huecos.sort((a, b) => a - b);
  const mediana = huecos.length % 2 ? huecos[(huecos.length - 1) / 2] : (huecos[huecos.length / 2 - 1] + huecos[huecos.length / 2]) / 2;
  return Math.max(30, Math.round((mediana - 30) / 15) * 15);
}
export function propuestaDescanso({ series = [], actual = null, delCoach = false, rechazada = false } = {}) {
  if (delCoach || rechazada) return null;
  const real = descansoReal(series);
  if (!real) return null;
  if (actual != null && Math.abs(real - actual) < 30) return null;
  return real;
}

// ---------- 14. Hoy, por cómo estás ----------
// sueno_min: lo que llega de Salud (anoche); prep: lo que contestó en «¿Cómo llegas hoy?» ({ sueno, energia, molestias },
// 1 a 3). Solo consejo: la pauta sigue siendo la del coach.
export function hoyPorComoEstas({ suenoMin = null, prep = null } = {}, t = null) {
  const h = Number(suenoMin) > 0 ? Number(suenoMin) / 60 : null;
  const horas = h != null ? (Math.round(h * 2) / 2) : null;
  const txtH = horas != null ? `${n1(horas)} ${horas === 1 ? 'hora' : 'horas'}` : '';
  const mal = prep && (prep.molestias === 1 || (prep.sueno + prep.energia + prep.molestias) <= 4);
  if (mal) return { nivel: 'malo', texto: yNombre(t, 'Hoy llegas tocado') + ': haz la sesión sin pasar del esfuerzo pautado y, si algo duele, para y cuéntaselo a tu coach.' };
  if (horas != null && horas < 6) return { nivel: 'regular', texto: segunTono(t, { cercano: `${yNombre(t, `Dormiste ${txtH}`)}: hoy prioriza la técnica y no busques récord.`, directo: `${txtH} de sueño: técnica primero, nada de récords hoy.`, tope: `${yNombre(t, `Dormiste ${txtH}`)}: hoy la victoria es hacerla bien, el récord otro día.` }) };
  if (prep && prep.energia === 1) return { nivel: 'regular', texto: yNombre(t, 'Hoy vas con poca energía') + ': calienta con calma y decide en la primera serie cómo apretar.' };
  if (horas != null && horas >= 7.5 && (!prep || prep.energia >= 2)) return { nivel: 'bueno', texto: segunTono(t, { cercano: `Has dormido ${txtH}: buen día para apretar si el cuerpo responde.`, directo: `${txtH} de sueño: si responde, aprieta.`, tope: `${txtH} de sueño y ganas: ¡hoy es día de apretar!` }) };
  if (prep && prep.sueno === 3 && prep.energia === 3) return { nivel: 'bueno', texto: yNombre(t, 'Llegas con todo') + ': aprovecha, sin pasarte de lo pautado.' };
  return null;
}

// ---------- 15. Su molestia, tenida en cuenta ----------
// Las zonas que carga cada ejercicio (por su patrón de movimiento y sus grupos musculares)
const ZONAS_POR_PATRON = {
  hombro: ['empuje_v', 'empuje_h', 'tiron_v'], codo: ['brazo', 'empuje_h', 'tiron_v'], muneca_mano: ['empuje_h', 'empuje_v', 'brazo'],
  cuello: ['empuje_v'], espalda_alta: ['tiron_h', 'tiron_v'], zona_lumbar: ['bisagra', 'sentadilla', 'tiron_h'],
  cadera: ['bisagra', 'sentadilla', 'unilateral'], rodilla: ['sentadilla', 'unilateral', 'pierna'], tobillo_pie: ['unilateral', 'sentadilla'],
};
const ZONAS_POR_GRUPO = { deltoides: ['hombro'], biceps: ['codo'], triceps: ['codo'], gemelo: ['tobillo_pie'], cuadriceps: ['rodilla'], isquiotibiales: ['rodilla', 'cadera'] };
export const NOMBRE_ZONA_TU = { cuello: 'Tu cuello', hombro: 'Tu hombro', codo: 'Tu codo', muneca_mano: 'Tu muñeca', espalda_alta: 'Tu espalda alta', zona_lumbar: 'Tu zona lumbar', cadera: 'Tu cadera', rodilla: 'Tu rodilla', tobillo_pie: 'Tu tobillo' };
export const ZONAS_AVISO = Object.keys(NOMBRE_ZONA_TU);
// Lo que propone la app al coach (él lo escribe o lo aprueba: hasta entonces no sale nada)
export const EJEMPLO_ZONA = {
  cuello: 'rango cómodo, cuello neutro y sin tirones.', hombro: 'rango cómodo y sin dolor; si molesta, baja el peso o el recorrido.',
  codo: 'sin bloquear del todo y sin dolor; agarre cómodo.', muneca_mano: 'muñeca recta y agarre cómodo; si molesta, cambia el agarre.',
  espalda_alta: 'controla la bajada y no fuerces el rango.', zona_lumbar: 'espalda neutra, bracea fuerte y deja un par de repeticiones en reserva.',
  cadera: 'rango cómodo y sin pinzamientos; mejor menos profundidad que dolor.', rodilla: 'rango cómodo y sin dolor; controla la bajada.',
  tobillo_pie: 'apoyo estable y sin dolor; si molesta, reduce el impacto.',
};
export const momentoZona = (zona) => `molestia_${zona}`;
export function zonasDeEjercicio(ej) {
  const grupos = ej?.grupos_musculares || [];
  const patron = ej?.patron || patronEjercicio(ej?.nombre || '', grupos, ej?.tipo || []);
  const z = new Set();
  for (const [zona, ps] of Object.entries(ZONAS_POR_PATRON)) if (ps.includes(patron)) z.add(zona);
  for (const g of grupos) for (const zona of ZONAS_POR_GRUPO[g] || []) z.add(zona);
  return [...z];
}
// lesiones: las del cuestionario ([{ zona, limita, nota }]); textos: { zona: texto del coach }. La primera zona suya que
// carga el ejercicio y para la que el coach ha escrito algo: { zona, titulo: 'Tu hombro', texto }
export function avisoZona(ej, lesiones = [], textos = {}) {
  const suyas = (lesiones || []).map((l) => l?.zona).filter((z) => z && NOMBRE_ZONA_TU[z]);
  if (!suyas.length) return null;
  const carga = new Set(zonasDeEjercicio(ej));
  const zona = suyas.find((z) => carga.has(z) && String(textos?.[z] || '').trim());
  return zona ? { zona, titulo: NOMBRE_ZONA_TU[zona], texto: String(textos[zona]).trim() } : null;
}
