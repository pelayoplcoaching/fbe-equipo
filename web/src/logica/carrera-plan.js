// v0.221: carrera, tanda 2 de las 20 mejoras: el asistente de plan (1), las descargas y el afinado ya puestos (2),
// «Rehacer desde aquí» con la vuelta a correr tras una molestia (3) y copiar una semana con progresión (5). Todo puro.
// Las reglas son las de «claude/carrera-reglas-propuesta.md», aprobadas por Pelayo el 24/11/2026 («visto bueno a todo»):
//   · Semanas mínimas para prepararla con calma: 5 km, 6; 10 km, 8; media, 10; maratón, 14 (con menos, avisa y comprime).
//   · Fases en proporción: base ~40 %, construcción ~30 %, específico ~20 % y el afinado al final (1 semana en 5 y 10 km,
//     2 en la media, 3 en maratón), bajando los km de forma progresiva hasta un 41-60 % menos sin quitar días ni intensidad.
//   · Los km suben desde lo que hace ahora un 5-10 % por semana (5 % si empieza, 7,5 % intermedio, 10 % avanzado) y nunca
//     más de un 30 % sobre la media de las dos semanas anteriores; una de cada cuatro, más suave (un 25 % menos).
//   · Pico orientativo: 5 km, 25-40; 10 km, 30-50; media, 40-60; maratón, 50-80 (lo bajo si empieza, lo alto si es
//     avanzado; si ya hace más, se queda en lo que hace).
//   · Sesiones según los días: 2, un rodaje y la calidad o la tirada larga, alternando; 3, rodaje, calidad y tirada larga;
//     4, dos rodajes, calidad y tirada larga; 5-6, más rodajes (y una segunda de calidad si es avanzado).
//   · Tirada larga: como mucho un 30 % de los km de la semana (en maratón, hasta unos 32 km).
//   · Calidad según la fase: base, rectas y cuestas cortas; construcción, umbral (Z4); específico, series en Z5 (5 y 10 km)
//     o ritmo de carrera (media y maratón); afinado, poca y a ritmo de carrera.
//   · Vuelta a correr: andar 30 min → 1 y 1 × 10 → 2 y 1 × 8 → 5 y 1 × 5 → 20-30 min seguidos; cada paso, 2 o 3 sesiones
//     con dolor de 3/10 como mucho y sin empeorar a la mañana siguiente.
// (v0.226) Con la revisión del experto («claude/carrera-revision-experto-respuesta.md»; Pelayo: «me fío de tu criterio»):
//   · R42 Tope por salida (Frandsen 2025): ninguna salida más de un 10 % por encima de la más larga de los 30 días
//     anteriores (sin contar carreras); solo una por semana, la tirada larga, puede batir esa marca.
//   · R16 La tirada larga es la salida más larga de la semana: como mucho el 65 % de los km con 2 días, el 60 % con 3, el
//     55 % con 4 y el 45 % con 5 o 6; como mucho 14, 18, 22 o 32 km y 1 h 30, 1 h 45, 2 h 15 o 3 h (5 km, 10 km, media,
//     maratón).
//   · R13 El pico, el menor entre la tabla y 12 km por día de carrera (5 y 10 km), 15 (media) o 20 (maratón); con pierna
//     pesada 3 días o más, o «más de 60 años o vuelve de una lesión», el valor bajo (salvo que ya corra más).
//   · R11 Empieza en lo que corre, sin saltar a un mínimo; si corre menos de 2 km por cada día que puede correr (o empieza
//     de cero), primero «Empezar a correr»: correr y andar.
//   · R9/R43 Las semanas que hacen falta: subir la salida más larga un 10 % por semana (con las descargas) hasta la que pide
//     la carrera (5 y 10 km, su distancia; media, 16 km o 2 h; maratón, 28 km o 3 h), más el afinado (y 2 más con «más de 60
//     o lesión»). En maratón, además, 30 km por semana o más de media en las 8 semanas antes del afinado. Si no llega, aviso
//     rojo con tres salidas.
//   · R12 Una semana de descarga cada 4 (cada 3 con «más de 60 o lesión»). R15 Con 2 días, aviso en maratón y media; sin
//     segunda calidad con «más de 60 o lesión». R17 Si empieza o con «más de 60 o lesión», las 4 primeras semanas, rectas
//     (las cuestas, después).
//   · R18 El afinado, sin contar la carrera: maratón, un 20, un 40 y un 60 % menos; media, un 30 y un 50 %; 5 y 10 km, un 50 %.
import { sumarDias, lunesDe, diasEntre, desdeISO } from './fechas.js';
import { BIBLIOTECA_FBE } from './carrera-biblioteca.js';
import { semanaPlanValida, fasesValidas } from './carrera.js';

export const NIVELES_PLAN = [['empieza', 'Empieza'], ['intermedio', 'Intermedio'], ['avanzado', 'Avanzado']];
export const DISTANCIAS_PLAN = [[5, '5 km'], [10, '10 km'], [21.0975, 'Media maratón'], [42.195, 'Maratón']];
export const MAX_SEMANAS_PLAN = 24;

// La distancia, por tramos: 5k (hasta 7 km), 10k (hasta 15), media (hasta 30) y maratón
export const tramoDistancia = (km) => (km <= 7 ? '5k' : km <= 15 ? '10k' : km <= 30 ? 'media' : 'maraton');
export const SEMANAS_MIN = { '5k': 6, '10k': 8, media: 10, maraton: 14 };
export const SEMANAS_AFINADO = { '5k': 1, '10k': 1, media: 2, maraton: 3 };
const PICO = { '5k': [25, 40], '10k': [30, 50], media: [40, 60], maraton: [50, 80] };
// (R13) el pico, como mucho tantos km por día de carrera a la semana
const PICO_DIA = { '5k': 12, '10k': 12, media: 15, maraton: 20 };
const SUBIDA = { empieza: 0.05, intermedio: 0.075, avanzado: 0.1 };
// Lo que bajan los km de entreno en cada semana del afinado (la última, la de la carrera, sin contar la carrera), respecto
// al pico (R18)
const BAJADA_AFINADO = { 1: [0.5], 2: [0.3, 0.5], 3: [0.2, 0.4, 0.6] };
const LARGA_MAX = { '5k': 14, '10k': 18, media: 22, maraton: 32 };
// (R16) la tirada larga: lo que se le da de la semana según los días (la del maratón, desde la construcción, hasta el tope),
// el tope y el tope en tiempo (minutos)
const LARGA_PCT = { 2: 0.55, 3: 0.42, 4: 0.36, 5: 0.32, 6: 0.28 };
export const LARGA_PCT_MAX = { 2: 0.65, 3: 0.6, 4: 0.55, 5: 0.45, 6: 0.45 };
export const LARGA_MIN_MAX = { '5k': 90, '10k': 105, media: 135, maraton: 180 };
// (R42) ninguna salida más de un 10 % por encima de la más larga de los 30 días anteriores
export const PICO_SALIDA = 1.1;
// (R43) la salida más larga que pide la carrera antes del afinado: km o, si antes llega, minutos
const LLEGADA = { '5k': [5, null], '10k': [10, null], media: [16, 120], maraton: [28, 180] };
// Su ritmo suave (s/km) si no se sabe por su ritmo umbral: para pasar los topes en tiempo a km
const RITMO_SUAVE = { empieza: 420, intermedio: 390, avanzado: 345 };
const NOMBRE_TRAMO = { '5k': '5 km', '10k': '10 km', media: 'media maratón', maraton: 'maratón' };

const r1 = (x) => Math.round(x * 10) / 10;
const r0 = (x) => Math.round(x);
// Los km de una sesión: con decimales hasta 10 km y enteros a partir de ahí, nunca menos de 3
const kmSesion = (x) => Math.max(3, x < 10 ? Math.round(x * 2) / 2 : r0(x));
const diasDe = (x) => Math.max(2, Math.min(6, Number(x) || 3));
// Su ritmo suave (s/km): el que se diga (de su ritmo umbral) o el de su nivel
export const ritmoSuaveDe = (ritmo, nivel) => (Number(ritmo) >= 180 && Number(ritmo) <= 900 ? Number(ritmo) : RITMO_SUAVE[nivel] || RITMO_SUAVE.intermedio);

// El pico de km de la semana según la distancia y el nivel (y lo que ya hace). (R13) Con los días, como mucho tantos km por
// día; con pierna pesada 3 días o más o con «más de 60 años o vuelve de una lesión» (prudente), el valor bajo de la tabla.
export function picoKm(km, nivel = 'intermedio', kmAhora = 0, { dias = null, prudente = false, pierna = false } = {}) {
  const t = tramoDistancia(km);
  const [lo, hi] = PICO[t];
  let pico = nivel === 'empieza' || prudente || pierna ? lo : nivel === 'avanzado' ? hi : r0((lo + hi) / 2);
  if (dias) pico = Math.min(pico, PICO_DIA[t] * diasDe(dias));
  return Math.max(pico, r0(Number(kmAhora) || 0));
}

// Lo que ha corrido de verdad: la media de km de las 4 semanas anteriores a esta (las que no corrió, con 0) y su salida más
// larga. hechas: sesiones completadas de carrera (con cardio_hecho). null si no hay nada apuntado.
// (v0.226, R19 y R42) La salida más larga, sin contar las carreras (una carrera no es la marca de la que subir).
export function kmRecientes(hechas = [], hoy) {
  const lunes = lunesDe(hoy);
  const desde = sumarDias(lunes, -28);
  let total = 0, larga = 0, n = 0;
  for (const s of hechas || []) {
    const f = String(s?.fecha_realizada || '').slice(0, 10);
    const km = Number(s?.cardio_hecho?.km) || 0;
    if (!f || f < desde || f >= lunes || s?.cardio_hecho?.modalidad !== 'carrera') continue;
    total += km; n++;
    if (s?.cardio?.tipo !== 'carrera') larga = Math.max(larga, km);
  }
  return n ? { media: r1(total / 4), larga: r1(larga), salidas: n } : null;
}

// Las fases para un número de semanas: [{ nombre, semanas, nota, clave }] (base, construcción, específico, afinado)
export function fasesPara(total, km) {
  const t = tramoDistancia(km);
  const af = Math.min(SEMANAS_AFINADO[t], total);
  const resto = total - af;
  let base = resto >= 3 ? Math.round((resto * 4) / 9) : 0;
  let cons = resto >= 2 ? Math.round((resto * 3) / 9) : 0;
  let esp = resto - base - cons;
  if (resto >= 3) { base = Math.max(1, base); cons = Math.max(1, cons); esp = resto - base - cons; if (esp < 1) { esp = 1; if (base > cons) base--; else cons--; } }
  else if (resto === 2) { cons = 1; esp = 1; }
  else if (resto === 1) { esp = 1; }
  const especifico = t === '5k' || t === '10k' ? 'Series en Z5 para ganar velocidad' : t === 'media' ? 'Ritmo de media maratón' : 'Ritmo de maratón y tiradas largas';
  return [
    base && { nombre: 'Base', semanas: base, nota: 'Kilómetros suaves, rectas y cuestas cortas' },
    cons && { nombre: 'Construcción', semanas: cons, nota: 'Más kilómetros y entra el umbral (Z4)' },
    esp && { nombre: 'Específico', semanas: esp, nota: especifico },
    af && { nombre: 'Afinado', semanas: af, nota: 'Menos kilómetros, misma intensidad: llegar fresco' },
  ].filter(Boolean);
}

// (R9/R43) Las semanas que hacen falta para llegar a la carrera con la salida larga que pide (LLEGADA): subiendo la más larga
// un 10 % por semana desde la de ahora, sin subir en las de descarga (una de cada 4, o de cada 3 con prudente), más el
// afinado (y 2 más con prudente); nunca menos de SEMANAS_MIN. empezar: las semanas de «Empezar a correr» que van delante.
// → { necesarias, llegada (km), desde (km) }
export function semanasNecesarias({ km, largaAhora = 0, kmAhora = 0, dias = 3, nivel = 'intermedio', prudente = false, ritmoSuave = null, empezar = 0 } = {}) {
  const t = tramoDistancia(km);
  const ritmo = ritmoSuaveDe(ritmoSuave, nivel);
  const [kmLl, minLl] = LLEGADA[t];
  const llegada = r1(minLl ? Math.min(kmLl, (minLl * 60) / ritmo) : kmLl);
  const desde = Math.max(3, Number(largaAhora) > 0 ? Number(largaAhora) : Number(kmAhora) > 0 ? (Number(kmAhora) / diasDe(dias)) * 1.3 : 3);
  const cada = prudente ? 3 : 4;
  let l = desde, n = 0;
  while (l < llegada - 0.05 && n < 60) { n++; if (n % cada !== 0) l *= PICO_SALIDA; }
  const extra = prudente ? 2 : 0;
  return { necesarias: Math.max(SEMANAS_MIN[t] + extra, (Number(empezar) || 0) + n + SEMANAS_AFINADO[t] + extra), llegada, desde: r1(desde) };
}

// La sesión de calidad de cada fase (de la biblioteca FBE), rotando semana a semana
const ROTA = {
  base: ['rodaje-rectas', 'cuestas-cortas'],
  construccion: ['umbral-3x8', 'cruceros', 'tempo-20', 'umbral-2x15'],
  '5k': ['series-400', 'series-800', 'series-4x4', 'piramide'],
  '10k': ['series-800', 'series-1000', 'cruceros', 'series-4x4'],
  media: ['ritmo-media', 'cruceros', 'umbral-2x15'],
  maraton: ['ritmo-maraton', 'tempo-20', 'umbral-2x15'],
};
const deBiblioteca = (id) => BIBLIOTECA_FBE.find((x) => x.id === `fbe-${id}`) || null;
// Una sesión de la biblioteca, más corta si la semana tiene pocos km: los minutos y el calentamiento, el enfriamiento y los
// bloques continuos, en proporción (las series con repeticiones se quedan; nunca menos de 20 min ni de 5 min de calentar)
export function escalarSesion(s, f) {
  if (!s || !(f > 0) || f >= 1) return s;
  const n = JSON.parse(JSON.stringify(s));
  if (n.minutos) n.minutos = Math.max(20, Math.round(n.minutos * f));
  if (n.minutos_max) n.minutos_max = Math.max(n.minutos + 1, Math.round(n.minutos_max * f));
  if (Array.isArray(n.partes)) n.partes = n.partes.map((p) => (p.seg && !p.reps && ['calentar', 'enfriar', 'bloque'].includes(p.fase)
    ? { ...p, seg: Math.max(p.fase === 'bloque' ? 120 : 300, Math.round((p.seg * f) / 60) * 60) } : p));
  return n;
}
function sesionDeBiblioteca(id, extra = {}) {
  const r = deBiblioteca(id);
  if (!r) return null;
  const { modalidad, ...pauta } = JSON.parse(JSON.stringify(r.pauta));
  return { ...pauta, titulo: r.nombre.slice(0, 60), ...extra };
}
// La de afinado: poca y a ritmo de carrera (5 km en Z5, 10 km en Z4-Z5, media en Z4, maratón en Z3)
function calidadAfinado(t) {
  const z = { '5k': [5, 5], '10k': [4, 5], media: [4, 4], maraton: [3, 3] }[t];
  const seg = { '5k': 120, '10k': 240, media: 480, maraton: 600 }[t];
  const bloque = { fase: 'bloque', reps: 3, seg, zona: z[0], ...(z[1] > z[0] ? { zona_hasta: z[1] } : {}), rec_seg: 120, rec: 'trote suave', nota: 'A ritmo de carrera, sin pasarte' };
  return { tipo: 'calidad', titulo: 'Ritmo de carrera, corto', zona: z[0], ...(z[1] > z[0] ? { zona_hasta: z[1] } : {}),
    partes: [{ fase: 'calentar', seg: 900, zona: 1, zona_hasta: 2 }, bloque, { fase: 'enfriar', seg: 600, zona: 1 }] };
}

// El reparto de una semana según los días: tipo de cada sesión y su día (lunes 1 … domingo 7). (R15) La segunda sesión de
// calidad (5 o 6 días), solo si es avanzado y no con prudente.
export function huecosSemana(dias, nivel, n, prudente = false) {
  const d = diasDe(dias);
  if (d === 2) return n % 2 ? [{ tipo: 'facil', dia: 3 }, { tipo: 'calidad', dia: 6 }] : [{ tipo: 'facil', dia: 3 }, { tipo: 'larga', dia: 6 }];
  if (d === 3) return [{ tipo: 'calidad', dia: 2 }, { tipo: 'facil', dia: 4 }, { tipo: 'larga', dia: 7 }];
  if (d === 4) return [{ tipo: 'calidad', dia: 2 }, { tipo: 'facil', dia: 4 }, { tipo: 'facil', dia: 5 }, { tipo: 'larga', dia: 7 }];
  const segunda = nivel === 'avanzado' && !prudente ? 'calidad' : 'facil';
  if (d === 5) return [{ tipo: 'facil', dia: 1 }, { tipo: 'calidad', dia: 2 }, { tipo: segunda, dia: 4 }, { tipo: 'facil', dia: 5 }, { tipo: 'larga', dia: 7 }];
  return [{ tipo: 'facil', dia: 1 }, { tipo: 'calidad', dia: 2 }, { tipo: 'facil', dia: 3 }, { tipo: segunda, dia: 4 }, { tipo: 'facil', dia: 5 }, { tipo: 'larga', dia: 7 }];
}

// Los km de una sesión de calidad de la biblioteca, más o menos (a 6 min/km), o los que le tocaban
const kmCalidad = (s, cal) => (s?.km ? Number(s.km) : s?.minutos ? Math.min(cal, s.minutos / 6) : cal);

// Las sesiones de una semana normal y sus km: { sesiones, km (lo que suman), max (la salida más larga) }.
//   · La tirada larga (R16): lo que le toca de la semana (LARGA_PCT; la del maratón, desde la construcción, hasta el tope),
//     como mucho LARGA_PCT_MAX, LARGA_MAX y el tope en tiempo (topeKm), y (R42) como mucho un 10 % más que la salida más
//     larga de los 30 días anteriores (ref).
//   · Las demás, como mucho la marca (ref) y nunca más que la tirada larga.
//   · La calidad, la de la fase (R17: con soloRectas, las rectas de la base).
function sesionesSemana({ kmSemana, dias, nivel, fase, t, n, iFase, ref = 0, topeKm = Infinity, prudente = false, soloRectas = false, suave = false }) {
  const huecos = huecosSemana(dias, nivel, n, prudente);
  const d = huecos.length;
  const conLarga = huecos.some((h) => h.tipo === 'larga');
  const nCal = huecos.filter((h) => h.tipo === 'calidad').length;
  const nFacil = huecos.filter((h) => h.tipo === 'facil').length;
  const marca = ref > 0 ? ref : Infinity;
  const pct = t === 'maraton' && !suave && (fase === 'construccion' || fase === 'especifico') ? LARGA_PCT_MAX[d] : LARGA_PCT[d];
  // (la que ya hace, si cabe en sus topes: no se le baja de lo que ya corre en su salida larga; en la de descarga, más
  // corta de verdad: lo suyo de la semana y como mucho tres cuartos de la marca)
  const deseada = suave ? Math.min(kmSemana * pct, marca * 0.75) : Math.max(kmSemana * pct, Math.min(ref, kmSemana * LARGA_PCT_MAX[d]));
  const larga = conLarga ? Math.min(LARGA_MAX[t], deseada, kmSemana * LARGA_PCT_MAX[d], marca * PICO_SALIDA, topeKm) : 0;
  const cal = Math.min(Math.max(5, kmSemana * (d === 2 ? 0.45 : 0.18)), marca);
  const rota = fase === 'base' ? (soloRectas ? ['rodaje-rectas'] : ROTA.base) : fase === 'construccion' ? ROTA.construccion : fase === 'especifico' ? ROTA[t] : null;
  const calidades = [];
  let k = 0;
  for (let i = 0; i < nCal; i++) {
    const id = rota ? rota[(iFase + k++) % rota.length] : null;
    let s = fase === 'afinado' ? calidadAfinado(t) : id ? sesionDeBiblioteca(id) : null;
    // a unos 6 min/km: si la de la biblioteca pasa mucho de lo que le toca a la calidad esta semana, más corta
    const kmEst = s?.minutos ? s.minutos / 6 : null;
    if (s && kmEst && kmEst > cal * 1.3) s = escalarSesion(s, Math.max(0.5, cal / kmEst));
    calidades.push(s);
  }
  const kmCal = calidades.reduce((a, s) => a + kmCalidad(s, cal), 0);
  let facil = nFacil ? (kmSemana - larga - kmCal) / nFacil : 0;
  facil = Math.min(facil, marca, conLarga ? larga : Infinity);
  let q = 0;
  const sesiones = huecos.map((h) => {
    if (h.tipo === 'larga') {
      const final = t === 'maraton' && fase === 'especifico' && iFase % 2 === 0;
      return { tipo: 'larga', titulo: 'Tirada larga', dia: h.dia, km: kmSesion(larga), zona: 2,
        ...(final ? { nota: 'Los últimos 20-30 minutos, a ritmo de maratón' } : {}) };
    }
    if (h.tipo === 'calidad') {
      const s = calidades[q++];
      return s ? { ...s, dia: h.dia } : { tipo: 'facil', titulo: 'Rodaje suave', dia: h.dia, km: kmSesion(cal), zona: 2 };
    }
    return { tipo: 'facil', titulo: 'Rodaje suave', dia: h.dia, km: kmSesion(facil), zona: 2 };
  });
  // (la de calidad cuenta por lo que dura, aunque sea de tipo «fácil», como las rectas de la base)
  const kms = sesiones.map((s, i) => (huecos[i].tipo === 'calidad' ? kmCalidad(s, cal) : Number(s.km) || 0));
  return { sesiones, km: r1(kms.reduce((a, x) => a + x, 0)), max: Math.max(0, ...kms) };
}

// La semana de la carrera: rodajes cortos y suaves (el último, con rectas, dos días antes como pronto) y la carrera. (R18)
// kmSemana son los km de entreno, sin contar la carrera; (R42) ninguno pasa de la marca de los 30 días anteriores.
function semanaCarrera({ kmSemana, dias, evento, km, diaCarrera, ref = 0 }) {
  const d = diasDe(dias);
  const antes = Math.max(1, d - 1);
  const resto = Math.max(3, Math.min(kmSemana / antes, ref > 0 ? ref : Infinity));
  const huecos = [1, 2, 3, 4, 5].filter((x) => x <= diaCarrera - 2).slice(-antes);
  const ses = huecos.map((dia, i) => (i === huecos.length - 1
    ? { tipo: 'facil', titulo: 'Rodaje con rectas', dia, km: kmSesion(Math.min(resto, 6)), zona: 2, partes: [{ fase: 'bloque', seg: 1200, zona: 2 }, { fase: 'strides', reps: 4, seg: 20, rec_seg: 60, rec: 'andando', nota: 'Rápidas y sueltas: para llegar con chispa' }] }
    : { tipo: 'facil', titulo: 'Rodaje suave', dia, km: kmSesion(resto), zona: 2 }));
  ses.push({ tipo: 'carrera', titulo: String(evento?.nombre || 'La carrera').slice(0, 60), dia: diaCarrera, km: Math.round(Number(km) * 100) / 100, nota: 'A tu ritmo, no al de los demás' });
  return ses;
}

const CLAVE = {
  base: 'Suave y constante: sumar kilómetros sin cansarte.',
  construccion: 'Más kilómetros y la primera calidad de verdad: que salga controlada.',
  especifico: 'La semana se parece cada vez más a la carrera: ritmo y paciencia.',
  suave: 'Semana más suave: el cuerpo asimila lo entrenado y llegas con ganas a las siguientes.',
  afinado: 'Menos kilómetros y la misma chispa: llegas fresco a la carrera.',
  carrera: 'Semana de la carrera: poco y suave, y el día de la carrera, a tu ritmo.',
};
const FASE_CLAVE = { Base: 'base', 'Construcción': 'construccion', 'Específico': 'especifico', Afinado: 'afinado' };

// (R11) Empezar a correr: correr y andar, de menos a más, para quien corre muy poco o empieza de cero (los pasos de la
// vuelta a correr, sin el de andar y sin hablar de dolor)
export const PASOS_EMPEZAR = [
  { titulo: 'Correr 1 y andar 1, × 10', tipo: 'facil', minutos: 20, partes: [{ fase: 'bloque', reps: 10, seg: 60, zona: 1, zona_hasta: 2, rec_seg: 60, rec: 'andando' }], nota: 'Suave, a ritmo de poder hablar.' },
  { titulo: 'Correr 2 y andar 1, × 8', tipo: 'facil', minutos: 24, partes: [{ fase: 'bloque', reps: 8, seg: 120, zona: 1, zona_hasta: 2, rec_seg: 60, rec: 'andando' }], nota: 'Suave, a ritmo de poder hablar.' },
  { titulo: 'Correr 5 y andar 1, × 5', tipo: 'facil', minutos: 30, partes: [{ fase: 'bloque', reps: 5, seg: 300, zona: 2, rec_seg: 60, rec: 'andando' }], nota: 'Suave, a ritmo de poder hablar.' },
  { titulo: '20-30 min seguidos', tipo: 'facil', minutos: 20, minutos_max: 30, zona: 2, nota: 'Suave y seguido: a partir de aquí, el plan.' },
];
function semanasEmpezar({ dias, desde }) {
  const d = diasDe(dias);
  const porPaso = d >= 4 ? 3 : 2;
  const lista = PASOS_EMPEZAR.flatMap((p) => Array.from({ length: porPaso }, () => JSON.parse(JSON.stringify(p))));
  const dias7 = huecosSemana(d, 'intermedio', 1).map((h) => h.dia);
  const semanas = [];
  for (let i = 0; i < lista.length; i += d) {
    semanas.push({ lunes: sumarDias(lunesDe(desde), 7 * semanas.length), etiqueta: 'Empezar a correr', km_min: null, km_max: null,
      clave: 'De correr y andar a correr seguido, poco a poco y a ritmo de poder hablar.', sesiones: lista.slice(i, i + d).map((s, j) => ({ ...s, dia: dias7[j] })), fase: 'Empezar a correr' });
  }
  return semanas;
}

// El plan entero. datos: { evento (o km y fecha), dias, kmAhora, largaAhora, nivel, hoy, inicio?, prudente («más de 60 años o
// vuelve de una lesión»), pierna (pierna pesada 3 días o más por semana), ritmoSuave (s/km, de su ritmo umbral) }
// → { inicio, total, fases, semanas: [{ lunes, etiqueta, km_min, km_max, clave, sesiones }], avisos, viable, tramo }
// viable: { ok, necesarias, llegada, texto, opciones } (R43: si llega a la carrera con lo que pide)
export function proponerPlan(datos = {}) {
  const km = Number(datos.km ?? datos.evento?.distancia_km);
  const fecha = datos.fecha ?? datos.evento?.fecha;
  const hoy = datos.hoy;
  if (!(km > 0) || !fecha || !hoy) return { error: 'Elige la carrera (distancia y fecha).' };
  if (fecha <= hoy) return { error: 'La carrera tiene que ser más adelante.' };
  const t = tramoDistancia(km);
  const nivel = NIVELES_PLAN.some(([k]) => k === datos.nivel) ? datos.nivel : 'intermedio';
  const dias = diasDe(datos.dias);
  const prudente = !!datos.prudente;
  const pierna = !!datos.pierna;
  const kmAhora = Math.max(0, Number(datos.kmAhora) || 0);
  const ritmo = ritmoSuaveDe(datos.ritmoSuave, nivel);
  const lunesCarrera = lunesDe(fecha);
  // Empieza el lunes que se diga, o este lunes si es lunes o martes, o el que viene
  const hoyD = desdeISO(hoy).getDay();
  let inicio = datos.inicio ? lunesDe(datos.inicio) : [1, 2].includes(hoyD) ? lunesDe(hoy) : sumarDias(lunesDe(hoy), 7);
  if (inicio > lunesCarrera) inicio = lunesCarrera;
  let total = Math.floor(diasEntre(inicio, lunesCarrera) / 7) + 1;
  const avisos = [];
  if (total > MAX_SEMANAS_PLAN) {
    inicio = sumarDias(lunesCarrera, -7 * (MAX_SEMANAS_PLAN - 1));
    total = MAX_SEMANAS_PLAN;
    avisos.push(`La carrera está lejos: el plan empieza el lunes ${inicio}, ${MAX_SEMANAS_PLAN} semanas antes; hasta entonces, que siga con lo que hace.`);
  }
  // (R11) Si corre muy poco (o empieza de cero), primero «Empezar a correr»; el resto del plan, detrás
  const empezarAndando = !datos.sinEmpezar && (kmAhora > 0 ? kmAhora < dias * 2 : nivel === 'empieza');
  const empezar = empezarAndando ? semanasEmpezar({ dias, desde: inicio }) : [];
  if (empezar.length && empezar.length < total - 1) {
    const resto = proponerPlan({ ...datos, inicio: sumarDias(inicio, 7 * empezar.length), kmAhora: dias * 3, largaAhora: 4, sinEmpezar: true });
    if (!resto.error) {
      const nec = semanasNecesarias({ km, largaAhora: 0, kmAhora: 0, dias, nivel, prudente, ritmoSuave: datos.ritmoSuave, empezar: empezar.length });
      const viable = viabilidad({ t, total, nec, semanas: resto.semanas, km, dias });
      const fases = [{ nombre: 'Empezar a correr', semanas: empezar.length, nota: 'Correr y andar, de menos a más' }, ...resto.fases];
      const av = [...avisos, `Corre menos de 2 km por cada día que puede correr: el plan empieza con ${empezar.length} semanas de «Empezar a correr» (correr y andar).`,
        ...resto.avisos.filter((a) => !/har\u00edan falta|Para llegar/.test(a))];
      return { ...resto, inicio, total: empezar.length + resto.semanas.length, fases, semanas: [...empezar, ...resto.semanas], avisos: av, viable };
    }
  }
  const extra = prudente ? 2 : 0;
  if (total < SEMANAS_MIN[t] + extra) avisos.push(`Quedan ${total} ${total === 1 ? 'semana' : 'semanas'} y para una ${NOMBRE_TRAMO[t]} con calma harían falta ${SEMANAS_MIN[t] + extra}: el plan se comprime (menos base) y conviene un objetivo prudente.`);
  if (!kmAhora) avisos.push(`Sin km apuntados las últimas semanas: el plan empieza en ${dias * 3} km por semana. Si viene de no correr, márcalo como «Empieza».`);
  // (R15) Con 2 días
  // (el maratón con 2 días, en la viabilidad: no se propone)
  if (dias === 2 && t === 'media') avisos.push('Con 2 días por semana, la media sale justa: mejor 3 si puede.');
  const fases = fasesPara(total, km);
  const diaCarrera = ((desdeISO(fecha).getDay() + 6) % 7) + 1;
  const af = Math.min(SEMANAS_AFINADO[t], total);
  const construir = total - af;
  const pico = picoKm(km, nivel, kmAhora, { dias, prudente, pierna });
  const sube = SUBIDA[nivel] ?? SUBIDA.intermedio;
  const cada = prudente ? 3 : 4;
  const kms0 = Math.max(3, Math.min(kmAhora || dias * 3, pico));
  const larga0 = Number(datos.largaAhora) > 0 ? Number(datos.largaAhora) : Math.max(3, (kms0 / dias) * 1.3);
  const topeKm = (LARGA_MIN_MAX[t] * 60) / ritmo;
  // Semana a semana: los km que tocan (desde lo que salió de verdad en las anteriores) y sus sesiones
  const hechas = []; // [{ km, max, suave }]
  const refDe = (i) => Math.max(0, ...hechas.slice(Math.max(0, i - 4), i).map((x) => x.max), i < 4 ? larga0 : 0);
  const semanas = [];
  let n = 0;
  for (const f of fases) {
    const clave = FASE_CLAVE[f.nombre];
    for (let i = 0; i < f.semanas; i++) {
      const lunes = sumarDias(inicio, n * 7);
      const ref = refDe(n);
      let sesiones, kmS, suave = false, afinado = false;
      if (n < construir) {
        const nn = n + 1;
        const normales = hechas.filter((x) => !x.suave);
        const ultima = normales.length ? normales[normales.length - 1].km : kms0;
        let objetivo;
        if (nn % cada === 0 && nn < construir) { objetivo = ultima * 0.75; suave = true; }
        else if (!hechas.length) objetivo = kms0;
        else {
          const previas = hechas.slice(-2).map((x) => x.km);
          objetivo = Math.min(pico, ultima * (1 + sube), (previas.reduce((a, x) => a + x, 0) / previas.length) * 1.3);
        }
        const r = sesionesSemana({ kmSemana: objetivo, dias, nivel, fase: clave, t, n: nn, iFase: i, ref, topeKm, prudente, suave, soloRectas: (nivel === 'empieza' || prudente) && nn <= 4 });
        sesiones = r.sesiones; kmS = r.km;
        hechas.push({ km: r.km, max: r.max, suave });
      } else {
        // El afinado (R18): un % menos que el pico, sin contar la carrera
        afinado = true;
        const pk = Math.max(kms0, ...hechas.filter((x) => !x.suave).map((x) => x.km));
        const b = (BAJADA_AFINADO[af] || [0.5])[n - construir] ?? 0.5;
        const objetivo = pk * (1 - b);
        if (n === total - 1) {
          // (los km de la semana de la carrera, sin la carrera)
          sesiones = semanaCarrera({ kmSemana: objetivo, dias, evento: datos.evento, km, diaCarrera, ref });
          kmS = r1(sesiones.filter((s) => s.tipo !== 'carrera').reduce((a, s) => a + (Number(s.km) || 0), 0));
          hechas.push({ km: kmS, max: Math.max(0, ...sesiones.filter((s) => s.tipo !== 'carrera').map((s) => Number(s.km) || 0)), suave: true });
        } else {
          const r = sesionesSemana({ kmSemana: objetivo, dias, nivel, fase: 'afinado', t, n: n + 1, iFase: i, ref, topeKm, prudente });
          sesiones = r.sesiones; kmS = r.km;
          hechas.push({ km: r.km, max: r.max, suave: true });
        }
      }
      const esCarrera = n === total - 1;
      const etiqueta = esCarrera ? 'Carrera' : afinado ? 'Afinado' : suave ? 'Descarga' : null;
      const c = esCarrera ? CLAVE.carrera : afinado ? CLAVE.afinado : suave ? CLAVE.suave : CLAVE[clave];
      semanas.push({ lunes, etiqueta, km_min: Math.max(1, r0(kmS * 0.95)), km_max: Math.max(2, r0(kmS * 1.05)), clave: c, sesiones, fase: f.nombre });
      n++;
    }
  }
  const nec = semanasNecesarias({ km, largaAhora: datos.largaAhora, kmAhora, dias, nivel, prudente, ritmoSuave: datos.ritmoSuave });
  const viable = viabilidad({ t, total, nec, semanas, km, dias });
  return { inicio, total, fases, semanas, avisos, viable, tramo: t, nivel, dias, km, fecha, prudente, pierna };
}

// (R43) ¿Llega a la carrera? Con las semanas que hacen falta (semanasNecesarias) y, en maratón, 30 km por semana o más de
// media en las 8 semanas antes del afinado (Rasmussen 2013). Si no, el texto y las tres salidas.
function viabilidad({ t, total, nec, semanas, km, dias = 3 }) {
  const af = Math.min(SEMANAS_AFINADO[t], total);
  const antes = semanas.slice(0, Math.max(0, semanas.length - af)).slice(-8).map((s) => ((Number(s.km_min) || 0) + (Number(s.km_max) || 0)) / 2);
  const media = antes.length ? antes.reduce((a, x) => a + x, 0) / antes.length : 0;
  const pocosKm = t === 'maraton' && antes.length > 0 && media < 30;
  const faltan = total < nec.necesarias;
  // (R15) Un maratón con 2 días por semana no se propone: la tirada larga no se construye sin saltos grandes
  const dosDias = t === 'maraton' && dias <= 2;
  const ok = !faltan && !pocosKm && !dosDias;
  const textos = [];
  if (dosDias) textos.push('Con 2 días por semana no se construye la tirada larga del maratón sin saltos grandes.');
  if (faltan) textos.push(`Para llegar a la ${NOMBRE_TRAMO[t]} con una salida larga de ${String(nec.llegada).replace('.', ',')} km sin subir más de un 10 % por semana harían falta unas ${nec.necesarias} semanas, y quedan ${total}.`);
  if (pocosKm) textos.push(`En las 8 semanas antes del afinado, el plan da unos ${Math.round(media)} km por semana de media: para un maratón conviene llegar a 30 o más.`);
  return { ok, necesarias: nec.necesarias, llegada: nec.llegada, texto: textos.join(' '),
    opciones: ok ? [] : [dosDias ? 'Correr 3 días o más a la semana' : null, faltan || pocosKm ? 'Buscar una carrera más adelante' : null, km > 5 ? 'Elegir una distancia más corta' : null,
      faltan || pocosKm ? 'Plantear la carrera corriendo y andando' : null].filter(Boolean) };
}

// Comprueba lo que propone (lo que se va a guardar): cada semana y las fases, como las comprobaría la base
export function planValido(plan) {
  return !!plan && !plan.error && fasesValidas(plan.fases) && plan.semanas.length === plan.fases.reduce((a, f) => a + f.semanas, 0)
    && plan.semanas.every((s) => semanaPlanValida(s) && (s.etiqueta == null || s.etiqueta.length <= 24) && (s.clave == null || s.clave.length <= 300));
}

// «Rehacer desde aquí»: las semanas que faltan desde un lunes, con las mismas reglas, sin tocar las de antes. perfil:
// el de ahora (plan_inicio y fases); devuelve { plan, fases } donde fases es el macrociclo entero (lo de antes, cortado, y
// lo nuevo) para guardarlo en el perfil. conVuelta: empieza con la vuelta a correr tras una molestia.
export function rehacerDesde(perfil, datos = {}) {
  const desde = lunesDe(datos.desde || datos.hoy);
  const plan = proponerPlan({ ...datos, inicio: desde });
  if (plan.error) return { plan };
  let semanas = plan.semanas;
  let fasesNuevas = plan.fases;
  if (datos.conVuelta) {
    const v = vueltaACorrer({ dias: plan.dias, desde });
    const nv = v.length;
    if (nv < plan.total - 1) {
      // Las de la vuelta sustituyen a las primeras; el resto del plan sigue con km desde la mitad de lo que hacía
      // (R11, R19) desde lo que hará al acabar la vuelta (20-30 minutos seguidos), sin saltar a un mínimo
      const resto = proponerPlan({ ...datos, inicio: sumarDias(desde, 7 * nv), kmAhora: Math.max(plan.dias * 3, (Number(datos.kmAhora) || 0) / 2), largaAhora: 5, sinEmpezar: true });
      if (!resto.error) {
        semanas = [...v, ...resto.semanas];
        fasesNuevas = [{ nombre: 'Vuelta a correr', semanas: nv, nota: 'De andar a correr, sin dolor (3/10 como mucho)' }, ...resto.fases];
      }
    }
  }
  // Lo de antes de «desde», tal cual (cortando la fase en la que cae)
  const previas = [];
  if (perfil?.plan_inicio && fasesValidas(perfil.fases) && perfil.plan_inicio < desde) {
    let quedan = Math.floor(diasEntre(perfil.plan_inicio, desde) / 7);
    for (const f of perfil.fases) {
      if (quedan <= 0) break;
      const s = Math.min(f.semanas, quedan);
      previas.push({ ...f, semanas: s });
      quedan -= s;
    }
    if (quedan > 0) previas.push({ nombre: 'Antes', semanas: quedan });
  }
  const fases = [...previas, ...fasesNuevas];
  const inicio = previas.length ? perfil.plan_inicio : desde;
  return { plan: { ...plan, semanas, fases: fasesNuevas, total: semanas.length }, fases: fases.length <= 12 ? fases : [...previas.slice(-(12 - fasesNuevas.length)), ...fasesNuevas], inicio };
}

// La vuelta a correr tras una molestia: cinco pasos de 2 o 3 sesiones cada uno, en las semanas que hagan falta según sus días
export const PASOS_VUELTA = [
  { titulo: 'Andar 30 min sin dolor', tipo: 'recuperacion', minutos: 30, nota: 'Andando rápido. Si duele más de 3/10 o empeora a la mañana siguiente, un paso atrás.' },
  { titulo: 'Correr 1 y andar 1, × 10', tipo: 'facil', minutos: 20, partes: [{ fase: 'bloque', reps: 10, seg: 60, zona: 1, zona_hasta: 2, rec_seg: 60, rec: 'andando' }], nota: 'Dolor de 3/10 como mucho y sin empeorar a la mañana siguiente.' },
  { titulo: 'Correr 2 y andar 1, × 8', tipo: 'facil', minutos: 24, partes: [{ fase: 'bloque', reps: 8, seg: 120, zona: 1, zona_hasta: 2, rec_seg: 60, rec: 'andando' }], nota: 'Dolor de 3/10 como mucho y sin empeorar a la mañana siguiente.' },
  { titulo: 'Correr 5 y andar 1, × 5', tipo: 'facil', minutos: 30, partes: [{ fase: 'bloque', reps: 5, seg: 300, zona: 2, rec_seg: 60, rec: 'andando' }], nota: 'Dolor de 3/10 como mucho y sin empeorar a la mañana siguiente.' },
  { titulo: '20-30 min seguidos', tipo: 'facil', minutos: 20, minutos_max: 30, zona: 2, nota: 'Suave y seguido. Si todo va bien, a partir de aquí sigue el plan.' },
];
export function vueltaACorrer({ dias = 3, desde }) {
  const d = Math.max(2, Math.min(6, Number(dias) || 3));
  const porPaso = d >= 4 ? 3 : 2;
  const lista = PASOS_VUELTA.flatMap((p) => Array.from({ length: porPaso }, () => ({ ...JSON.parse(JSON.stringify(p)) })));
  const dias7 = huecosSemana(d, 'intermedio', 1).map((h) => h.dia);
  const semanas = [];
  for (let i = 0; i < lista.length; i += d) {
    const lunes = sumarDias(lunesDe(desde), 7 * semanas.length);
    semanas.push({ lunes, etiqueta: 'Vuelta a correr', km_min: null, km_max: null, clave: 'De menos a más y sin dolor: si molesta más de 3/10, un paso atrás.',
      sesiones: lista.slice(i, i + d).map((s, j) => ({ ...s, dia: dias7[j] })), fase: 'Vuelta a correr' });
  }
  return semanas;
}

// Copiar una semana con progresión: los km y los minutos de cada sesión (y los de la semana) un pct % más (5 o 10)
export function progresarSemana(semana, pct = 0) {
  const f = 1 + (Number(pct) || 0) / 100;
  const escala = (x, dec) => (x == null ? x : dec ? Math.round(x * f * 10) / 10 : Math.max(1, Math.round(x * f)));
  const sesiones = (semana?.sesiones || []).map((s) => {
    if (s.tipo === 'descanso' || s.tipo === 'carrera') return { ...s };
    const n = { ...s };
    if (n.km != null) n.km = Math.min(200, escala(n.km, true));
    if (n.km_max != null) n.km_max = Math.min(200, Math.max(escala(n.km_max, true), (n.km || 0) + 0.1));
    if (n.minutos != null) n.minutos = Math.min(600, escala(n.minutos));
    if (n.minutos_max != null) n.minutos_max = Math.min(600, Math.max(escala(n.minutos_max), (n.minutos || 0) + 1));
    return n;
  });
  const kmDe = (x) => { const n = x === '' || x == null ? null : Number(String(x).replace(',', '.')); return Number.isFinite(n) ? n : null; };
  const kmin = kmDe(semana?.km_min), kmax = kmDe(semana?.km_max);
  return {
    etiqueta: semana?.etiqueta || null, ab: semana?.ab || null, clave: semana?.clave || null, nota: semana?.nota || null,
    km_min: kmin != null ? escala(kmin, true) : null, km_max: kmax != null ? escala(kmax, true) : null,
    sesiones,
  };
}

// Para enseñar: «S3 · Base · 20-22 km · Calidad: Umbral 3 × 8 min · Tirada 7 km»
export function textoSemanaPlan(s) {
  const km = s.km_min != null ? `${s.km_min}${s.km_max != null && s.km_max !== s.km_min ? `-${s.km_max}` : ''} km` : '';
  const k = (n) => String(n).replace('.', ',');
  const ses = (s.sesiones || []).map((x) => (x.tipo === 'larga' ? `Tirada ${k(x.km)} km` : x.tipo === 'carrera' ? x.titulo : x.tipo === 'calidad' ? x.titulo : x.km ? `Rodaje ${k(x.km)} km` : x.titulo)).join(' · ');
  return [km, ses].filter(Boolean).join(' · ');
}
