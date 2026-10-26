// Plan de la semana: qué día piensa hacer el atleta cada sesión, qué toca hoy y el archivo de calendario.
import { sumarDias, hoyISO, desdeISO, diasEntre } from './fechas.js';

const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const LETRAS_DIA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

// Un día previsto solo vale si cae en la semana de la sesión (si el coach la movió, se ignora)
export function diaPrevistoValido(sesion, semana) {
  const d = sesion?.dia_previsto;
  if (!d || !semana?.fecha_inicio) return null;
  return d >= semana.fecha_inicio && d <= sumarDias(semana.fecha_inicio, 6) ? d : null;
}

// «hoy», «mañana», «el jueves», «el lunes 3»
export function cuandoDia(iso, hoy = hoyISO()) {
  const n = diasEntre(hoy, iso);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  const d = desdeISO(iso);
  return n > 0 && n < 7 ? `el ${DIAS_LARGOS[d.getDay()]}` : `el ${DIAS_LARGOS[d.getDay()]} ${d.getDate()}`;
}

// Qué toca hoy según el plan. sesiones: las de la semana en curso (ordenadas).
//  · hoy: la sesión prevista para hoy que aún no está hecha (la primera, si hay varias)
//  · descanso: true si hay plan, hoy no hay nada previsto y queda algo por hacer otro día
//  · proxima: la siguiente prevista después de hoy (para «Hoy descansas; mañana, Pierna A»)
//  · siguiente: la que se propone hacer (la de hoy; si no, la primera pendiente, como sin plan)
export function queToca(sesiones, semana, hoy = hoyISO()) {
  const pendientes = sesiones.filter((s) => !s.completada);
  const conDia = pendientes.map((s) => ({ s, d: diaPrevistoValido(s, semana) }));
  const deHoy = conDia.find((x) => x.d === hoy)?.s || null;
  const futuras = conDia.filter((x) => x.d && x.d > hoy).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.s.orden - b.s.orden));
  const hayPlan = conDia.some((x) => x.d);
  const atrasadas = conDia.filter((x) => x.d && x.d < hoy).map((x) => x.s);
  return {
    hoy: deHoy,
    descanso: hayPlan && !deHoy && !atrasadas.length && futuras.length > 0,
    proxima: futuras[0] ? { sesion: futuras[0].s, dia: futuras[0].d } : null,
    atrasadas,
    siguiente: deHoy || atrasadas[0] || (hayPlan && futuras[0] ? futuras[0].s : null) || pendientes[0] || null,
  };
}

// Reparto propuesto para los días que faltan: las sesiones sin día, en días libres, dejando uno de descanso
// entre medias si cabe (para el botón «Repartir por mí»)
export function repartir(sesiones, semana, hoy = hoyISO()) {
  if (!semana?.fecha_inicio) return {};
  const fin = sumarDias(semana.fecha_inicio, 6);
  const desde = hoy > semana.fecha_inicio ? hoy : semana.fecha_inicio;
  const libres = [];
  for (let d = desde; d <= fin; d = sumarDias(d, 1)) libres.push(d);
  const ocupados = new Set(sesiones.map((s) => diaPrevistoValido(s, semana)).filter(Boolean));
  const sinDia = sesiones.filter((s) => !s.completada && !diaPrevistoValido(s, semana));
  const disponibles = libres.filter((d) => !ocupados.has(d));
  if (!sinDia.length || !disponibles.length) return {};
  // Con sitio de sobra, uno sí y otro no; si no cabe, días seguidos
  const paso = disponibles.length >= sinDia.length * 2 - 1 ? 2 : 1;
  const out = {};
  let i = 0;
  for (const s of sinDia) {
    if (i >= disponibles.length) break;
    out[s.id] = disponibles[i];
    i += paso;
    if (i >= disponibles.length && paso === 2) i = 1;
  }
  return out;
}

// Archivo de calendario (.ics) con las sesiones previstas, a una hora, con aviso antes.
// Hora «flotante» (sin zona): el móvil la pone en su hora local, que es lo que se quiere.
const escapar = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/\r\n?|\n/g, '\\n').replace(/([,;])/g, '\\$1');
const compacta = (iso) => iso.replace(/-/g, '');
// Las líneas de más de 75 octetos se parten (RFC 5545), carácter a carácter (por puntos de código: un emoji
// o una tilde nunca se quedan partidos entre dos líneas)
function plegar(linea) {
  const enc = new TextEncoder();
  const out = [];
  let actual = '', octetos = 0;
  for (const c of linea) {
    const b = enc.encode(c).length;
    if (octetos + b > 75) { out.push(actual); actual = ' ' + c; octetos = 1 + b; } else { actual += c; octetos += b; }
  }
  out.push(actual);
  return out.join('\r\n');
}
export function calendarioICS(eventos, { hora = '18:00', minutos = 60, avisoMin = 30, url = '' } = {}) {
  const [hh, mm] = String(hora).split(':').map((x) => Number(x) || 0);
  const ini = hh * 60 + mm, fin = ini + minutos;
  const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}${String(m % 60).padStart(2, '0')}00`;
  const sello = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FBE Coaching//FBE Equipo//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of eventos) {
    const diaFin = fin >= 24 * 60 ? sumarDias(e.dia, 1) : e.dia;
    lineas.push('BEGIN:VEVENT',
      `UID:fbe-${e.id}@fbe-atletas`,
      `DTSTAMP:${sello}`,
      `DTSTART:${compacta(e.dia)}T${hhmm(ini)}`,
      `DTEND:${compacta(diaFin)}T${hhmm(fin % (24 * 60))}`,
      `SUMMARY:${escapar(`Entreno: ${e.nombre}`)}`,
      `DESCRIPTION:${escapar(e.descripcion || 'Sesión de FBE Equipo.')}`,
      ...(url ? [`URL:${escapar(url)}`] : []),
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapar(`Hoy entrenas: ${e.nombre}`)}`, `TRIGGER:-PT${Math.max(0, avisoMin)}M`, 'END:VALARM',
      'END:VEVENT');
  }
  lineas.push('END:VCALENDAR');
  return lineas.map(plegar).join('\r\n') + '\r\n';
}
