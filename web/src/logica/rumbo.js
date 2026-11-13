// (personalización 2, tanda 2) Que sepa a qué viene y que le recuerde: su meta con fecha (y la cuenta atrás), por qué
// la sesión de hoy es para él (según su objetivo), el lenguaje de su nivel, su historia en una línea y lo de su
// aniversario. Lógica pura.
import { diasEntre } from './fechas.js';
import { segunTono } from './trato.js';
import { pesoNum, etiquetaPeso } from './unidades.js';

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const n1 = (v) => String(Math.round(Number(v) * 10) / 10).replace('.', ',');

// ---------- Su meta con fecha ----------
export const UNIDADES_META = [['kg', 'kg'], ['km', 'km'], ['min', 'min'], ['reps', 'repeticiones'], ['cm', 'cm'], ['%', '%']];
export function metaDe(personal) {
  const nombre = String(personal?.meta_nombre || '').trim();
  if (!nombre) return null;
  return { nombre, fecha: DIA.test(personal?.meta_fecha || '') ? personal.meta_fecha : null, cifra: Number(personal?.meta_cifra) > 0 ? Number(personal.meta_cifra) : null, unidad: personal?.meta_unidad || null };
}
// La cuenta atrás: { nombre, dias, texto, cerca (a una semana o menos), pasada } (sin fecha: { texto: 'Tu meta: …' })
export function cuentaMeta(personal, hoy) {
  const m = metaDe(personal);
  if (!m) return null;
  const cifra = m.cifra ? ` (${n1(m.cifra)} ${m.unidad === 'reps' ? 'repeticiones' : m.unidad})` : '';
  if (!m.fecha || !DIA.test(hoy || '')) return { ...m, dias: null, texto: `Tu meta: ${m.nombre}${cifra}`, cerca: false, pasada: false };
  const dias = diasEntre(hoy, m.fecha);
  if (dias < 0) return { ...m, dias, texto: `Tu meta era ${m.nombre}: ¿pones la siguiente?`, cerca: false, pasada: true };
  if (dias === 0) return { ...m, dias, texto: `¡Hoy es el día: ${m.nombre}!`, cerca: true, pasada: false };
  const cuanto = dias === 1 ? 'Falta 1 día' : dias < 14 ? `Faltan ${dias} días` : dias < 84 ? `Faltan ${Math.round(dias / 7)} semanas` : `Faltan ${Math.round(dias / 30.4)} meses`;
  return { ...m, dias, texto: `${cuanto} para ${m.nombre}${cifra}`, cerca: dias <= 7, pasada: false };
}

// ---------- Por qué esta sesión es para ti ----------
// objetivos: los del cuestionario (en su orden); tipo: 'fuerza' | 'cardio' | 'movilidad' | …; conCardio: si la sesión
// lleva cardio al final; meta: su meta (para el remate)
export function porQueSesion({ objetivos = [], tipo = 'fuerza', conCardio = false, meta = null } = {}, t = null) {
  const o = (objetivos || [])[0];
  let base = null;
  if (tipo === 'cardio') base = o === 'perder_grasa' ? 'Para tu objetivo de perder grasa: un ritmo que puedas mantener suma más que ir a tope.' : 'Para tu corazón y tu recuperación: a un ritmo que te deje hablar.';
  else if (tipo === 'movilidad') base = 'Para que el resto de la semana te salga mejor: moverte bien hoy es entrenar.';
  else if (o === 'fuerza') base = 'Para tu fuerza: lo importante hoy son las primeras series, las pesadas. Descansa lo que pidan.';
  else if (o === 'musculo') base = 'Para ganar músculo: en cada serie de trabajo, llega cerca del final (te quedan 1 o 2).';
  else if (o === 'perder_grasa') base = conCardio ? 'Para perder grasa: mantener la fuerza protege tu músculo; y el cardio del final, que no se te escape.' : 'Para perder grasa: mantener la fuerza aquí es lo que protege tu músculo.';
  else if (o === 'salud') base = 'Para tu salud: lo que cuenta es hacerla. Mejor completa y cómoda que perfecta.';
  else if (o === 'rendimiento') base = 'Para rendir en tu deporte: calidad en cada repetición, sin acabar reventado.';
  if (!base) return null;
  const remate = meta?.nombre ? ` Un paso más hacia ${meta.nombre}.` : '';
  const seco = base.replace(/^Para [^:]+: /, '');
  return segunTono(t, { cercano: base + remate, directo: seco.charAt(0).toLocaleUpperCase('es') + seco.slice(1) + remate, tope: `${base}${remate} \u00a1A por ello!` });
}

// ---------- El lenguaje de su nivel ----------
// experiencia: la del cuestionario ('ninguna', 'menos_1', '1_3', '3_5', 'mas_5'); meses: los que lleva en la app
export function nivelLenguaje({ experiencia = null, meses = 0, nivel = null } = {}) {
  if (nivel === 'principiante' || ((experiencia === 'ninguna' || experiencia === 'menos_1') && meses < 6) || (!experiencia && meses < 1)) return 'principiante';
  if (experiencia === '3_5' || experiencia === 'mas_5' || nivel === 'avanzado') return 'avanzado';
  return 'medio';
}
// «RIR 2» → «RIR 2 (que te queden 2)»; «RPE 8» → «RPE 8 (te quedan unas 2)»; solo para quien empieza
export function explicarEsfuerzo(texto, nivel) {
  const s = String(texto || '');
  if (nivel !== 'principiante' || !s) return s;
  return s
    .replace(/\bRIR\s*(\d)(?:\s*[-\u2013]\s*(\d))?/g, (m, a, b) => `${m} (que te queden ${b ? `${a} o ${b}` : a})`)
    .replace(/\bRPE\s*(\d+(?:[.,]5)?)/g, (m, r) => { const q = Math.max(0, 10 - Number(String(r).replace(',', '.'))); return `${m} (${q === 0 ? 'sin dejarte ninguna' : `te quedan unas ${String(q).replace('.', ',')}`})`; });
}

// ---------- Su historia en una línea ----------
// progreso: lo de api.progreso ({ ejercicios: [{ nombre, puntos: [{ semana, valor }] }] }); el ejercicio que más ha
// subido del primer punto a su mejor (en % y al menos 2,5 kg)
export function historiaEnUnaLinea({ fechaAlta = null, sesiones = 0, progreso = null, coach = '', hoy } = {}) {
  if (!DIA.test(String(fechaAlta || '').slice(0, 10)) || !DIA.test(hoy || '')) return null;
  const dias = diasEntre(String(fechaAlta).slice(0, 10), hoy);
  if (dias < 14) return null;
  const meses = Math.floor(dias / 30.44);
  const tiempo = meses < 1 ? `${Math.floor(dias / 7)} semanas` : meses < 12 ? (meses === 1 ? '1 mes' : `${meses} meses`) : (Math.floor(meses / 12) === 1 ? '1 año' : `${Math.floor(meses / 12)} años`);
  const conQuien = coach ? ` con ${coach}` : '';
  const ses = sesiones > 0 ? ` y ${sesiones === 1 ? '1 sesión' : `${sesiones} sesiones`}` : '';
  let mejor = null;
  for (const e of progreso?.ejercicios || []) {
    const ps = (e.puntos || []).filter((p) => Number(p.valor) > 0);
    if (ps.length < 2) continue;
    const primero = ps[0].valor, top = Math.max(...ps.map((p) => p.valor));
    const sube = top - primero, pct = sube / primero;
    if (sube >= 2.5 && (!mejor || pct > mejor.pct)) mejor = { nombre: e.nombre, primero, top, pct };
  }
  const subida = mejor ? ` Empezaste con un 1RM estimado de ${pesoNum(mejor.primero, 1)} ${etiquetaPeso()} en ${mejor.nombre.charAt(0).toLocaleLowerCase('es')}${mejor.nombre.slice(1)}; hoy, ${pesoNum(mejor.top, 1)} ${etiquetaPeso()}.` : '';
  return { texto: `Llevas ${tiempo}${conQuien}${ses}.${subida}`, tiempo, meses, mejor };
}

// ---------- El aniversario ----------
// Lo que ha hecho desde que empezó: { sesiones, texto }
export function resumenDesdeAlta({ entrenos = [], fechaAlta = null } = {}) {
  const desde = String(fechaAlta || '').slice(0, 10);
  const n = (entrenos || []).filter((x) => x?.fecha && (!desde || x.fecha >= desde)).length;
  return n > 0 ? { sesiones: n, texto: `En este tiempo, ${n === 1 ? '1 sesión' : `${n} sesiones`}. Cada una cuenta.` } : null;
}
