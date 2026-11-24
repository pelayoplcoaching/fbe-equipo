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
const SUBIDA = { empieza: 0.05, intermedio: 0.075, avanzado: 0.1 };
// Lo que bajan los km en cada semana del afinado (la última, la de la carrera), respecto al pico
const BAJADA_AFINADO = { 1: [0.5], 2: [0.3, 0.5], 3: [0.2, 0.35, 0.5] };
const LARGA_MAX = { '5k': 14, '10k': 18, media: 22, maraton: 32 };
const NOMBRE_TRAMO = { '5k': '5 km', '10k': '10 km', media: 'media maratón', maraton: 'maratón' };

const r1 = (x) => Math.round(x * 10) / 10;
const r0 = (x) => Math.round(x);
// Los km de una sesión: con decimales hasta 10 km y enteros a partir de ahí, nunca menos de 3
const kmSesion = (x) => Math.max(3, x < 10 ? Math.round(x * 2) / 2 : r0(x));

// El pico de km de la semana según la distancia y el nivel (y lo que ya hace)
export function picoKm(km, nivel = 'intermedio', kmAhora = 0) {
  const [lo, hi] = PICO[tramoDistancia(km)];
  const pico = nivel === 'empieza' ? lo : nivel === 'avanzado' ? hi : r0((lo + hi) / 2);
  return Math.max(pico, r0(Number(kmAhora) || 0));
}

// Lo que ha corrido de verdad: la media de km de las 4 semanas anteriores a esta (las que no corrió, con 0) y su salida más
// larga. hechas: sesiones completadas de carrera (con cardio_hecho). null si no hay nada apuntado.
export function kmRecientes(hechas = [], hoy) {
  const lunes = lunesDe(hoy);
  const desde = sumarDias(lunes, -28);
  let total = 0, larga = 0, n = 0;
  for (const s of hechas || []) {
    const f = String(s?.fecha_realizada || '').slice(0, 10);
    const km = Number(s?.cardio_hecho?.km) || 0;
    if (!f || f < desde || f >= lunes || s?.cardio_hecho?.modalidad !== 'carrera') continue;
    total += km; larga = Math.max(larga, km); n++;
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

// Los km de cada semana: subida desde lo que hace, una de cada cuatro más suave, el pico y el afinado
export function kmPorSemana({ total, km, nivel = 'intermedio', kmAhora = 0 }) {
  const t = tramoDistancia(km);
  const af = Math.min(SEMANAS_AFINADO[t], total);
  const pico = picoKm(km, nivel, kmAhora);
  const sube = SUBIDA[nivel] ?? SUBIDA.intermedio;
  const inicio = Math.max(nivel === 'empieza' ? 8 : 12, Math.min(Number(kmAhora) || 0, pico));
  const out = [];
  let actual = inicio;
  const construir = total - af;
  for (let i = 0; i < construir; i++) {
    const n = i + 1;
    // Una de cada cuatro, más suave (no la primera ni la última antes del afinado)
    if (n % 4 === 0 && n < construir) { out.push({ km: r0(actual * 0.75), suave: true }); continue; }
    if (i > 0) {
      const previas = out.slice(-2).map((x) => x.km);
      const media = previas.reduce((a, x) => a + x, 0) / previas.length;
      // la subida se calcula sobre la última semana normal (no sobre la suave)
      const ultimaNormal = [...out].reverse().find((x) => !x.suave)?.km ?? actual;
      actual = Math.min(pico, ultimaNormal * (1 + sube), media * 1.3);
    }
    out.push({ km: r0(actual), suave: false });
  }
  const ref = Math.max(...out.map((x) => x.km), inicio);
  (BAJADA_AFINADO[af] || []).forEach((b) => out.push({ km: r0(ref * (1 - b)), afinado: true }));
  return out;
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

// El reparto de una semana según los días: tipo de cada sesión y su día (lunes 1 … domingo 7)
export function huecosSemana(dias, nivel, n) {
  const d = Math.max(2, Math.min(6, Number(dias) || 3));
  if (d === 2) return n % 2 ? [{ tipo: 'facil', dia: 3 }, { tipo: 'calidad', dia: 6 }] : [{ tipo: 'facil', dia: 3 }, { tipo: 'larga', dia: 6 }];
  if (d === 3) return [{ tipo: 'calidad', dia: 2 }, { tipo: 'facil', dia: 4 }, { tipo: 'larga', dia: 7 }];
  if (d === 4) return [{ tipo: 'calidad', dia: 2 }, { tipo: 'facil', dia: 4 }, { tipo: 'facil', dia: 5 }, { tipo: 'larga', dia: 7 }];
  const segunda = nivel === 'avanzado' ? 'calidad' : 'facil';
  if (d === 5) return [{ tipo: 'facil', dia: 1 }, { tipo: 'calidad', dia: 2 }, { tipo: segunda, dia: 4 }, { tipo: 'facil', dia: 5 }, { tipo: 'larga', dia: 7 }];
  return [{ tipo: 'facil', dia: 1 }, { tipo: 'calidad', dia: 2 }, { tipo: 'facil', dia: 3 }, { tipo: segunda, dia: 4 }, { tipo: 'facil', dia: 5 }, { tipo: 'larga', dia: 7 }];
}

// Las sesiones de una semana normal: los km repartidos (la larga, un 30 % como mucho; la calidad, la que marque la fase)
function sesionesSemana({ kmSemana, dias, nivel, fase, t, n, iFase }) {
  const huecos = huecosSemana(dias, nivel, n);
  const conLarga = huecos.some((h) => h.tipo === 'larga');
  const nCal = huecos.filter((h) => h.tipo === 'calidad').length;
  const larga = conLarga ? Math.min(LARGA_MAX[t], kmSemana * (huecos.length === 2 ? 0.45 : 0.3)) : 0;
  const cal = Math.max(5, kmSemana * (huecos.length === 2 ? 0.45 : 0.18));
  const nFacil = huecos.filter((h) => h.tipo === 'facil').length;
  const facil = nFacil ? Math.max(3, (kmSemana - larga - cal * nCal) / nFacil) : 0;
  const rota = fase === 'base' ? ROTA.base : fase === 'construccion' ? ROTA.construccion : fase === 'especifico' ? ROTA[t] : null;
  let k = 0;
  return huecos.map((h) => {
    if (h.tipo === 'larga') {
      const final = t === 'maraton' && fase === 'especifico' && iFase % 2 === 0;
      return { tipo: 'larga', titulo: 'Tirada larga', dia: h.dia, km: kmSesion(larga), zona: 2,
        ...(final ? { nota: 'Los últimos 20-30 minutos, a ritmo de maratón' } : {}) };
    }
    if (h.tipo === 'calidad') {
      const id = rota ? rota[(iFase + k++) % rota.length] : null;
      const s = fase === 'afinado' ? calidadAfinado(t) : id ? sesionDeBiblioteca(id) : null;
      return s ? { ...s, dia: h.dia } : { tipo: 'facil', titulo: 'Rodaje suave', dia: h.dia, km: kmSesion(cal), zona: 2 };
    }
    return { tipo: 'facil', titulo: 'Rodaje suave', dia: h.dia, km: kmSesion(facil), zona: 2 };
  });
}

// La semana de la carrera: rodajes cortos y suaves (el último, con rectas, dos días antes como pronto) y la carrera
function semanaCarrera({ kmSemana, dias, evento, km, diaCarrera }) {
  const d = Math.max(2, Math.min(6, Number(dias) || 3));
  const antes = Math.max(1, d - 1);
  const resto = Math.max(3, (kmSemana - km) / antes);
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

// El plan entero. datos: { evento (o km y fecha), dias, kmAhora, largaAhora, nivel, hoy, inicio? }
// → { inicio, total, fases, semanas: [{ lunes, etiqueta, km_min, km_max, clave, sesiones }], avisos, tramo }
export function proponerPlan(datos = {}) {
  const km = Number(datos.km ?? datos.evento?.distancia_km);
  const fecha = datos.fecha ?? datos.evento?.fecha;
  const hoy = datos.hoy;
  if (!(km > 0) || !fecha || !hoy) return { error: 'Elige la carrera (distancia y fecha).' };
  if (fecha <= hoy) return { error: 'La carrera tiene que ser más adelante.' };
  const t = tramoDistancia(km);
  const nivel = NIVELES_PLAN.some(([k]) => k === datos.nivel) ? datos.nivel : 'intermedio';
  const dias = Math.max(2, Math.min(6, Number(datos.dias) || 3));
  const kmAhora = Math.max(0, Number(datos.kmAhora) || 0);
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
  if (total < SEMANAS_MIN[t]) avisos.push(`Quedan ${total} ${total === 1 ? 'semana' : 'semanas'} y para una ${NOMBRE_TRAMO[t]} con calma harían falta ${SEMANAS_MIN[t]}: el plan se comprime (menos base) y conviene un objetivo prudente.`);
  if (datos.largaAhora && t === 'maraton' && Number(datos.largaAhora) < 12) avisos.push('Su salida más larga reciente es corta para un maratón: las tiradas largas suben poco a poco y conviene un objetivo prudente.');
  const fases = fasesPara(total, km);
  const kms = kmPorSemana({ total, km, nivel, kmAhora });
  const diaCarrera = ((desdeISO(fecha).getDay() + 6) % 7) + 1;
  const semanas = [];
  let n = 0;
  for (const f of fases) {
    const clave = FASE_CLAVE[f.nombre];
    for (let i = 0; i < f.semanas; i++) {
      const lunes = sumarDias(inicio, n * 7);
      const k = kms[n];
      const esCarrera = n === total - 1;
      const sesiones = esCarrera ? semanaCarrera({ kmSemana: k.km, dias, evento: datos.evento, km, diaCarrera })
        : sesionesSemana({ kmSemana: k.km, dias, nivel, fase: k.afinado ? 'afinado' : clave, t, n: n + 1, iFase: i });
      const etiqueta = esCarrera ? 'Carrera' : k.afinado ? 'Afinado' : k.suave ? 'Descarga' : null;
      const c = esCarrera ? CLAVE.carrera : k.afinado ? CLAVE.afinado : k.suave ? CLAVE.suave : CLAVE[clave];
      semanas.push({ lunes, etiqueta, km_min: Math.max(1, r0(k.km * 0.95)), km_max: Math.max(2, r0(k.km * 1.05)), clave: c, sesiones, fase: f.nombre });
      n++;
    }
  }
  return { inicio, total, fases, semanas, avisos, tramo: t, nivel, dias, km, fecha };
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
      const resto = proponerPlan({ ...datos, inicio: sumarDias(desde, 7 * nv), kmAhora: Math.max(8, (Number(datos.kmAhora) || 0) / 2) });
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
