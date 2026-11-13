// (personalización 3, tanda 6) Que la app sepa de su vida, siempre como consejo (la programación del coach no se toca):
// su agenda (y preguntarle después qué tal), las semanas difíciles, sus guardias y el check-in que sigue la conversación.
// Lógica pura.
import { diasEntre, sumarDias, lunesDe } from './fechas.js';
import { segunTono } from './trato.js';
const CON_ARTICULO = { hombros: 'los hombros', pectoral: 'el pectoral', triceps: 'el tríceps', espalda_alta: 'la espalda alta', zona_lumbar: 'la zona lumbar', femoral_gluteo: 'el femoral y el glúteo', cuadriceps: 'el cuádriceps', aductor: 'el aductor', otra: 'otra zona' };

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const diaSemana = (f) => DIAS[(new Date(`${f}T12:00:00Z`).getUTCDay() + 6) % 7];

// ---------- 5. Su agenda ----------
// Lo de hoy («Hoy: el examen. ¡Mucho ánimo!») y lo que toca preguntar (un evento de la última semana sin contestar)
export function eventoDeHoy(agenda = [], hoy, t = null) {
  const e = (agenda || []).find((x) => x.tipo === 'evento' && x.fecha === hoy);
  if (!e) return null;
  return { ...e, texto: segunTono(t, { cercano: `Hoy: ${e.titulo}. ¡Mucho ánimo${t?.nombre ? `, ${t.nombre}` : ''}!`, directo: `Hoy: ${e.titulo}. Suerte.`, tope: `¡Hoy es el día: ${e.titulo}! ¡A por ello${t?.nombre ? `, ${t.nombre}` : ''}!` }) };
}
export function preguntaPendiente(agenda = [], hoy) {
  const e = (agenda || []).filter((x) => x.tipo === 'evento' && !x.respuesta && x.fecha < hoy && diasEntre(x.fecha, hoy) <= 7)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  return e ? { ...e, pregunta: `¿Qué tal ${/^(el|la|los|las|mi|tu) /i.test(e.titulo) ? e.titulo.charAt(0).toLocaleLowerCase('es') + e.titulo.slice(1) : `«${e.titulo}»`}?` } : null;
}
export const proximos = (agenda = [], hoy, dias = 30) => (agenda || []).filter((x) => x.tipo === 'evento' && x.fecha >= hoy && diasEntre(hoy, x.fecha) <= dias);
export const RESPUESTAS = [['bien', 'Bien'], ['regular', 'Regular'], ['mal', 'Mal']];

// ---------- 6. Semanas difíciles ----------
// sesiones: las de la semana ({ id, nombre, completada, ejercicios: [{ prioridad, nombre }] }). Lo obligatorio de lo que
// le queda, como consejo («con esto, la semana vale»)
export const semanaDificil = (agenda = [], hoy) => (agenda || []).find((x) => x.tipo === 'dificil' && x.fecha === lunesDe(hoy)) || null;
export function minimoDeSemana(sesiones = []) {
  return (sesiones || []).filter((s) => !s.completada).map((s) => ({
    id: s.id, nombre: s.nombre, obligatorios: (s.ejercicios || []).filter((e) => e.prioridad === 'alta').map((e) => e.nombre),
  })).filter((s) => s.obligatorios.length);
}
export function mensajeSemanaDificil(motivo = '') {
  const m = String(motivo || '').trim();
  return `Esta semana va a ser difícil${m ? ` (${m})` : ''}. Intentaré hacer al menos lo obligatorio de cada sesión.`;
}

// ---------- 7. Sus guardias ----------
// Las sesiones previstas el día de una guardia o el de después (saliente): consejo de moverlas si le viene mejor
export function choquesGuardia(agenda = [], sesiones = [], hoy) {
  const guardias = new Set((agenda || []).filter((x) => x.tipo === 'guardia').map((x) => x.fecha));
  if (!guardias.size) return [];
  return (sesiones || []).filter((s) => !s.completada && s.dia_previsto && s.dia_previsto >= hoy).flatMap((s) => {
    const d = s.dia_previsto;
    if (guardias.has(d)) return [{ id: s.id, nombre: s.nombre, dia: d, que: 'guardia', texto: `El ${diaSemana(d)} tienes guardia y te toca ${s.nombre}: si te viene mejor, cámbiala de día.` }];
    if (guardias.has(sumarDias(d, -1))) return [{ id: s.id, nombre: s.nombre, dia: d, que: 'saliente', texto: `El ${diaSemana(d)} sales de guardia y te toca ${s.nombre}: si llegas sin dormir, mejor otro día (o solo lo obligatorio).` }];
    return [];
  });
}
export const guardiasProximas = (agenda = [], hoy, dias = 45) => (agenda || []).filter((x) => x.tipo === 'guardia' && x.fecha >= hoy && diasEntre(hoy, x.fecha) <= dias).map((x) => x.fecha).sort();

// ---------- 8. El check-in que sigue la conversación ----------
// anterior: el check-in de la semana pasada; molestias: las suyas de la semana pasada ([{ zona, intensidad }]).
// Una línea para cada pregunta de hoy, con lo que contestó (solo si fue para preguntarle).
export function seguimientoCheckin(id, anterior = null, molestias = []) {
  const a = anterior || {};
  if (id === 'sueno' && ['<5', '5-6'].includes(a.horas_sueno)) return `La semana pasada dormías ${a.horas_sueno === '<5' ? 'menos de 5' : '5–6'} horas: ¿ha ido mejor?`;
  if (id === 'energia' && Number(a.energia) > 0 && Number(a.energia) <= 2) return 'La semana pasada ibas muy cansado de energía: ¿cómo vas esta?';
  if (id === 'recuperacion' && Number(a.recuperacion) > 0 && Number(a.recuperacion) <= 2) return 'La semana pasada te costaba recuperarte: ¿mejor?';
  if (id === 'motivacion' && Number(a.motivacion) > 0 && Number(a.motivacion) <= 2) return 'La semana pasada andabas con poca motivación: ¿cómo estás esta?';
  if (id === 'molestias') {
    const z = (molestias || []).filter((m) => Number(m.intensidad) >= 1 && CON_ARTICULO[m.zona]).sort((x, y) => y.intensidad - x.intensidad).map((m) => CON_ARTICULO[m.zona]);
    if (z.length) return `La semana pasada notabas molestias en ${z.length === 1 ? z[0] : `${z.slice(0, -1).join(', ')} y ${z.at(-1)}`}: ¿cómo siguen?`;
  }
  return null;
}
