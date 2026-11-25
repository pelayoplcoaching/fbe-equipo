// FBE Esencial, antes de empezar: su lunes de inicio, el cribado sin coach, en qué punto está y qué plantilla le toca;
// y sus marcas de la semana 4.
// Aparte de esencial.js (que va en lo que se carga al abrir la app): esto solo lo usan pantallas que se cargan después
// (Hoy de quien va por su cuenta, su cuestionario y el alta del coach) y las pruebas.
import { NOMBRE_PRIMERAS_4 } from './esencial.js';
import { nivelDe, gustosCompletos, necesitaPrimeras } from './esencial-gustos.js';

// (el número con coma y sin ceros de detrás)
const num = (v, dec = 1) => {
  const n = Number(v);
  if (v == null || v === '' || !Number.isFinite(n)) return '—';
  return (Number.isInteger(n) ? String(n) : n.toFixed(dec).replace(/\.?0+$/, '')).replace('.', ',');
};

// La primera tanda empieza el lunes 11 de enero de 2027 (el vídeo del 3/1). Después, el próximo lunes.
export const TANDA_ESENCIAL = '2027-01-11';
export function inicioEsencial(hoy) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hoy || '')) return TANDA_ESENCIAL;
  if (hoy <= TANDA_ESENCIAL) return TANDA_ESENCIAL;
  const dia = new Date(`${hoy}T12:00:00Z`).getUTCDay();   // 0 domingo … 1 lunes
  if (dia === 1) return hoy;
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((8 - dia) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

// «lunes 11 de enero»
const DIAS_L = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function fechaLarga(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DIAS_L[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES_L[d.getUTCMonth()]}`;
}
export const esLunes = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') && new Date(`${iso}T12:00:00Z`).getUTCDay() === 1;

// ---------- Antes de empezar ----------
// Lo que lee al terminar el cuestionario quien va por su cuenta (los de siempre hablan de su coach): mismas frases del
// cribado de la ACSM, sin «tu coach lo verá». Cualquier resultado que no sea «sin valoración» frena el plan hasta el
// visto bueno (decisión de Pelayo, 24/11/2026).
export const MENSAJE_ESENCIAL = {
  sin_valoracion: 'No hace falta que te vea un médico antes de empezar. Si alguna vez notas dolor en el pecho, mucha falta de aire o mareo al entrenar, para y consulta con tu médico.',
  valorar_antes_vigoroso: 'Puedes seguir con el ejercicio que ya haces. Antes de empezar tu plan, conviene que lo valore tu médico.',
  valorar_antes: 'Antes de empezar, conviene que te valore tu médico.',
  parar_y_valorar: 'Con lo que nos cuentas, lo prudente es dejar el ejercicio intenso hasta que te valore tu médico. Si ahora mismo tienes dolor en el pecho o te falta mucho el aire, llama al 112.',
};

// En qué punto está quien va por su cuenta antes de entrenar (la tarjeta grande de Hoy):
//  · cuestionario: aún no lo ha enviado (empezado: true si ya guardó algo)
//  · salud: lo envió sin la parte de salud (sin ella no hay plan)
//  · rutina (099): con experiencia, le falta «Tus gustos» (gustos: false) o, si la criba no le manda a «Primeras 4
//    semanas», elegir su rutina (gustos: true). Solo con la migración 099 (con099) y sin plan todavía.
//  · visto_bueno: el cribado pide valoración médica y aún no ha dicho que la tiene
//  · revision: dice que la tiene; falta que Pelayo lo confirme
//  · preparando: todo listo y aún sin plan (la app se lo pide a la base)
//  · espera: con su plan, antes de su lunes (faltan: días)
//  · null: ya ha empezado (o no va por su cuenta)
// bloque: el de su programa (o null); cuestionario: su fila; ficha: { visto_bueno_pedido_en, visto_bueno_en } de atletas;
// rutina: la que ha elegido (atletas.esencial_plantilla).
export function estadoEsencial({ bloque = null, cuestionario = null, ficha = null, hoy, rutina = null, con099 = false }) {
  if (bloque) {
    if (bloque.fecha_inicio && bloque.fecha_inicio > hoy) {
      const faltan = Math.round((Date.parse(`${bloque.fecha_inicio}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 864e5);
      return { tipo: 'espera', inicio: bloque.fecha_inicio, faltan };
    }
    return null;
  }
  const c = cuestionario;
  if (!c?.completado_en) return { tipo: 'cuestionario', empezado: !!c };
  if (!c.resultado) return { tipo: 'salud' };
  if (con099 && nivelDe(c.experiencia) > 0) {
    if (!gustosCompletos(c.gustos, c)) return { tipo: 'rutina', gustos: false };
    if (!rutina && !necesitaPrimeras({ experiencia: c.experiencia, gustos: c.gustos })) return { tipo: 'rutina', gustos: true };
  }
  if (c.resultado !== 'sin_valoracion' && !ficha?.visto_bueno_en) {
    return ficha?.visto_bueno_pedido_en ? { tipo: 'revision', desde: ficha.visto_bueno_pedido_en } : { tipo: 'visto_bueno', resultado: c.resultado };
  }
  return { tipo: 'preparando' };
}


// La plantilla según su cuestionario (igual que fbe_privado.esencial_plantilla() de la migración 091, que es la que manda):
// nunca ha entrenado, «Primeras 4 semanas»; si ha entrenado, en el gimnasio la full body o el torso-pierna de sus días,
// variante A (barra y básicos) con 3 años o más y barra entre su material, si no B (máquinas y mancuernas); en casa o al
// aire libre, la de casa según sus días y su material.
export function plantillaEsencial({ experiencia = null, dias_semana: dias = null, lugar = null, material = null } = {}) {
  const m = Array.isArray(material) ? material : [];
  if ((experiencia || 'ninguna') === 'ninguna') return NOMBRE_PRIMERAS_4;
  const d = dias ?? 2;
  if (['gimnasio', 'gimnasio_basico'].includes(lugar || 'gimnasio')) {
    const base = d <= 2 ? '2 días · Full body' : d === 3 ? '3 días · Full body' : d === 4 ? '4 días · Torso-pierna' : '5 días · PPL + torso-pierna';
    return `${base}${['3_5', 'mas_5'].includes(experiencia) && m.includes('barra') ? ' · A · Barra y básicos' : ' · B · Máquinas y mancuernas'}`;
  }
  const mb = m.includes('mancuernas') && m.includes('banco');
  if (d <= 2) return '2 días · Full body en casa, sin material';
  if (d === 3) return mb ? '3 días · Full body con mancuernas y banco' : m.includes('gomas') ? '3 días · Full body con gomas' : '3 días · Full body en casa, sin material';
  return mb ? '4 días · Torso-pierna con mancuernas y banco' : '4 días · Torso-pierna con gomas y peso corporal';
}

// ---------- Sus marcas (la semana 4) ----------
// De lo apuntado en una semana: la mejor serie de cada ejercicio (el que hizo, también si cambió a la alternativa).
// Con kilos, la de más kilos (a igualdad, más repeticiones); sin kilos o por tiempo, la de más repeticiones o segundos.
// pautas: [{ id, ejercicio_id, orden }]; series: [{ sesion_ejercicio_id, numero, kg, reps, sustituto_id }];
// ejercicios: { id: { id, nombre, por_tiempo } }. Devuelve [{ ejercicio_id, nombre, kg, reps, porTiempo, texto }] en
// el orden de la sesión.
export function marcasDeSemana({ pautas = [], series = [], ejercicios = {} }) {
  const orden = new Map();
  for (const p of [...pautas].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))) if (!orden.has(p.id)) orden.set(p.id, p);
  const mejor = new Map();
  for (const s of series) {
    const p = orden.get(s.sesion_ejercicio_id);
    const reps = Number(s.reps);
    if (!p || !(reps > 0)) continue;
    const id = s.sustituto_id || p.ejercicio_id;
    const ej = ejercicios[id] || { id, nombre: '' };
    const kg = Number(s.kg) > 0 ? Number(s.kg) : null;
    const actual = mejor.get(id);
    const gana = !actual || (kg != null && (actual.kg == null || kg > actual.kg || (kg === actual.kg && reps > actual.reps)))
      || (kg == null && actual.kg == null && reps > actual.reps);
    if (gana) mejor.set(id, { ejercicio_id: id, nombre: ej.nombre, kg, reps, porTiempo: !!ej.por_tiempo, orden: p.orden ?? 0 });
  }
  return [...mejor.values()].sort((a, b) => a.orden - b.orden)
    // (con espacios que no parten: «16 kg × 12» no se corta en dos líneas)
    .map(({ orden: _o, ...m }) => ({ ...m, texto: m.porTiempo ? `${m.reps} s` : m.kg != null ? `${num(m.kg, 2)} kg × ${m.reps}` : `${m.reps} repeticiones` }));
}
