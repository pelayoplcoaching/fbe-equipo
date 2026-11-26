// (v0.256) El motor de molestias de FBE Esencial, la base. Reglas de Pelayo del 26/11/2026 (formulario 2, bloque A;
// «claude/motores-siguientes-reglas.md»): la escala de 0 a 10 con el semáforo del dolor de la web, 0-2 verde, 3-5 ámbar y
// 6 o más rojo (M1); las diez zonas del cuestionario de lesiones (M2); las señales para parar y consultar ya (M9); cuándo
// ver a un profesional (M10); y su margen: el modelo del semáforo (Thomeé 1997; Silbernagel 2007) admite hasta 5 sobre 10,
// aquí vamos hasta 3 (P3). El estado de cada zona sale de lo que apunta (en «Me duele algo», en su check-in y, más
// adelante, antes y después de la sesión y a la mañana siguiente): no se guarda aparte. Lógica pura.
import { ZONAS_LESION } from './cuestionario.js';

export const ZONAS_DOLOR = ZONAS_LESION;
export const NOMBRE_ZONA_DOLOR = Object.fromEntries(ZONAS_DOLOR);
export const ZONA_DOLOR_IDS = ZONAS_DOLOR.map(([z]) => z);
// Dónde lo apunta: su check-in, «Me duele algo» (ahora) y, con una molestia abierta, antes y después de una sesión que
// carga esa zona, durante, a la mañana siguiente y el seguimiento de los 3 y los 7 días
export const MOMENTOS_DOLOR = ['checkin', 'ahora', 'antes', 'durante', 'despues', 'manana', 'seguimiento'];
export const MARGEN = 3;   // (Pelayo, P3) hasta 3 sobre 10
export const ESCALA = Array.from({ length: 11 }, (_, i) => i);

const num = (v) => (v == null || v === '' ? NaN : Number(v));
// el semáforo de un valor de 0 a 10: 'verde' | 'ambar' | 'rojo' (null si no es un valor)
export function semaforo(v) {
  const n = num(v);
  if (!Number.isFinite(n) || n < 0 || n > 10) return null;
  return n <= 2 ? 'verde' : n <= 5 ? 'ambar' : 'rojo';
}
// A la escala de siempre de la tabla de molestias (0 sin dolor · 1 leve · 2 moderada · 3 grave): para lo que ya la lee (el
// panel de Pelayo, su ficha y el motor de progresión)
export function intensidadDe(v) {
  const n = num(v);
  if (!Number.isFinite(n) || n < 0 || n > 10) return null;
  return n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : 3;
}
export const NOMBRE_SEMAFORO = { verde: 'Verde', ambar: 'Ámbar', rojo: 'Rojo' };

// La regla para seguir (la del semáforo de la web, con el margen de Pelayo)
export const REGLA = 'La regla para seguir: durante y después del ejercicio, hasta 3 sobre 10 y sin ir a más (el semáforo del dolor admite hasta 5: aquí vamos con margen); a la mañana siguiente, como antes de entrenar; y que no vaya a más de una semana a otra.';
// Qué hacer con su plan, según el color (M4 y M7)
export const QUE_HACER = {
  verde: { titulo: 'Verde: puedes seguir con tu plan', pasos: [REGLA] },
  ambar: {
    titulo: 'Ámbar: sigue, con margen',
    pasos: [
      'Los ejercicios que cargan esa zona no deben subir de carga ni de series hasta que mejore.',
      'Durante el ejercicio: hasta 3 sobre 10 y sin ir a más, sigue; con 4, mantén la carga; si pasa de 4 o va subiendo, baja la carga o cambia de ejercicio.',
      'A la mañana siguiente tienes que estar como antes de entrenar. Si estás peor, la próxima sesión que cargue esa zona, una serie menos y un 10 % menos de peso en esos ejercicios.',
    ],
  },
  rojo: {
    titulo: 'Rojo: cambia lo que carga esa zona',
    pasos: [
      'Cambia los ejercicios que cargan esa zona por una alternativa sin dolor del mismo grupo, con menos carga: en la sesión, toca «Más» en ese ejercicio y «Cambiar».',
      'Entrena el resto con normalidad: no hace falta parar del todo.',
      'Si en dos semanas no mejora, que te la vea un fisioterapeuta o tu médico.',
    ],
  },
};
// (M9) Las señales para parar y consultar ya, sin esperar (Finucane 2020; Riebe 2015, ACSM)
export const SENALES = [
  ['noche', 'Dolor por la noche que no cede'],
  ['fiebre', 'Fiebre'],
  ['fuerza', 'Pérdida de fuerza o de sensibilidad'],
  ['hormigueo', 'Hormigueo que baja por un brazo o una pierna'],
  ['golpe', 'Dolor tras un golpe o una caída'],
  ['hinchazon', 'Mucha hinchazón'],
  ['pecho', 'Dolor en el pecho, falta de aire o mareo con el esfuerzo'],
];
export const PARA_YA = {
  titulo: 'Para y consulta ya, sin esperar',
  texto: 'Con alguna de estas señales, deja de entrenar esa zona y que te vea un médico antes de seguir.',
  pecho: 'Si es dolor en el pecho, falta de aire o mareo con el esfuerzo, deja la sesión; si es intenso o no cede en reposo, llama al 112.',
};

// ---------- El estado de cada zona, con lo que ha apuntado ----------
const d10 = (x) => (x ? String(x).slice(0, 10) : '');
const esFecha = (x) => /^\d{4}-\d{2}-\d{2}$/.test(String(x || ''));
const entre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
const sumar = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
export const ABIERTA_DIAS = 21;   // (criterio de Claude) una molestia en ámbar o rojo sigue abierta hasta 3 semanas sin volver a apuntarla

// Las lecturas de una zona, juntas: las de su registro ({ zona, valor, fecha, momento, creado_en }) y las de su check-in
// con valor de 0 a 10 ({ zona, valor, semana_inicio }: cuentan el domingo de esa semana, o hoy si aún no ha llegado)
export function lecturas({ registros = [], checkins = [], hoy } = {}) {
  const xs = [];
  for (const r of Array.isArray(registros) ? registros : []) {
    if (ZONA_DOLOR_IDS.includes(r?.zona) && semaforo(r.valor) && esFecha(d10(r.fecha))) xs.push({ zona: r.zona, valor: Number(r.valor), fecha: d10(r.fecha), momento: r.momento || 'ahora', t: String(r.creado_en || '') });
  }
  for (const c of Array.isArray(checkins) ? checkins : []) {
    const l = d10(c?.semana_inicio);
    if (!ZONA_DOLOR_IDS.includes(c?.zona) || !semaforo(c.valor) || !esFecha(l)) continue;
    const dom = sumar(l, 6);
    xs.push({ zona: c.zona, valor: Number(c.valor), fecha: hoy && dom > hoy ? hoy : dom, momento: 'checkin', t: '' });
  }
  return xs.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.t.localeCompare(b.t));
}
// La tendencia de una semana a otra (M6): lo más alto de los últimos 7 días frente a lo más alto de los 7 de antes
function tendencia(xs, hoy) {
  const ult = xs.filter((x) => entre(x.fecha, hoy) >= 0 && entre(x.fecha, hoy) < 7).map((x) => x.valor);
  const ant = xs.filter((x) => entre(x.fecha, hoy) >= 7 && entre(x.fecha, hoy) < 14).map((x) => x.valor);
  if (!ult.length || !ant.length) return null;
  const a = Math.max(...ult), b = Math.max(...ant);
  return a > b ? 'peor' : a < b ? 'mejor' : 'igual';
}
// → [{ zona, nombre, valor, semaforo, fecha, dias, abierta, desde, tendencia, lecturas }] (de la más reciente a la más antigua)
export function estadoZonas({ registros = [], checkins = [], hoy } = {}) {
  if (!esFecha(hoy)) return [];
  const xs = lecturas({ registros, checkins, hoy }).filter((x) => x.fecha <= hoy);
  const por = {};
  for (const x of xs) (por[x.zona] ||= []).push(x);
  const out = [];
  for (const [zona, ys] of Object.entries(por)) {
    const u = ys[ys.length - 1];
    const dias = entre(u.fecha, hoy);
    const abierta = u.valor >= MARGEN && dias <= ABIERTA_DIAS;
    // desde cuándo: el primer día de esta racha en ámbar o rojo (sin un verde entre medias)
    let desde = null;
    if (abierta) { desde = u.fecha; for (let i = ys.length - 1; i >= 0 && ys[i].valor >= MARGEN; i--) desde = ys[i].fecha; }
    out.push({ zona, nombre: NOMBRE_ZONA_DOLOR[zona] || zona, valor: u.valor, semaforo: semaforo(u.valor), fecha: u.fecha, dias, abierta, desde, tendencia: tendencia(ys, hoy), lecturas: ys.length });
  }
  return out.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.valor - a.valor);
}

// ---------- (M10) Cuándo ver a un profesional ----------
// semanas: sus check-ins de las últimas seis semanas ([{ semana_inicio, zona, valor?, intensidad }]); estado: el de
// estadoZonas; senal: si ha marcado alguna señal de M9 → null | { motivo, zona?, texto }
export function profesional({ semanas = [], estado = [], senal = false, hoy } = {}) {
  if (senal) return { motivo: 'senal', texto: `${PARA_YA.texto} ${PARA_YA.pecho}` };
  // (como ahora: «Cuando la app no basta») 3 de las últimas 6 semanas con una molestia moderada o grave; con valor, de 3 o más
  const fuertes = new Set((Array.isArray(semanas) ? semanas : []).filter((m) => (m?.valor != null ? Number(m.valor) >= 3 : Number(m?.intensidad) >= 2)).map((m) => d10(m.semana_inicio)));
  if (fuertes.size >= 3) return { motivo: 'semanas', texto: 'Llevas varias semanas apuntando una molestia. Una app no puede valorarla: que te la vea un fisioterapeuta o tu médico (o pide tu Puesta a punto).' };
  const larga = (Array.isArray(estado) ? estado : []).find((z) => z.abierta && esFecha(z.desde) && esFecha(hoy) && entre(z.desde, hoy) >= 14 && z.tendencia !== 'mejor');
  if (larga) return { motivo: 'dos_semanas', zona: larga.zona, texto: `Tu molestia en ${larga.nombre.toLowerCase()} lleva dos semanas sin mejorar: que te la vea un fisioterapeuta o tu médico (o pide tu Puesta a punto).` };
  return null;
}
