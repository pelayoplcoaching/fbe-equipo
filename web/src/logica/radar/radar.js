// Radar de contacto: a quién escribir hoy. Lógica pura.
//
// Une el contacto personal de cada atleta (contactos.js) con sus motivos (motivos.js) y los reparte:
//   'hoy'       toca escribirle: va por debajo del objetivo y no le has escrito ni hoy ni ayer; o hay algo urgente
//               (una molestia fuerte o un día difícil sin hablar) o te escribió y lo último de la conversación es suyo
//   'pronto'    va por debajo del objetivo, pero le acabas de escribir: le toca otra vez dentro de uno o dos días
//   'al_dia'    cumple el objetivo
//   'pospuesto' lo has dejado para otro día
// Son reglas a la vista, no una puntuación: el porqué de cada uno sale escrito.
import { contactoDe, haceDias } from './contactos.js';
import { motivosDe, cuandoFue } from './motivos.js';
import { sumarDias } from '../fechas.js';

export const AJUSTES_RADAR = {
  objetivo: 2,      // días de contacto personal en los últimos 7
  separacion: 2,    // días que se dejan pasar antes de proponer escribirle otra vez (2 = ni hoy ni ayer)
};
export const GRUPOS_RADAR = ['hoy', 'pronto', 'al_dia', 'pospuesto'];
export const NOMBRE_GRUPO_RADAR = { hoy: 'Hoy', pronto: 'En unos días', al_dia: 'Al día', pospuesto: 'Pospuestos' };

const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || 'tu atleta';

// Una fila del radar para un atleta activo
export function filaRadar({ resumen: r, contacto, sesiones = [], records = [], checkinEl = null, hoy, pospuestoHasta = null, ajustes = AJUSTES_RADAR }) {
  const c = contacto || contactoDe(null, r.atleta_id);
  const motivos = motivosDe({ resumen: r, sesiones, records, ultimoContacto: c.ultimo, checkinEl, hoy });
  const { objetivo, separacion } = { ...AJUSTES_RADAR, ...ajustes };
  const faltan = Math.max(0, objetivo - c.en7);
  const urgente = motivos.find((m) => m.urgente) || null;
  let grupo, porque;
  if (pospuestoHasta && pospuestoHasta > hoy) {
    grupo = 'pospuesto';
    porque = `Lo dejaste para ${cuandoVuelve(pospuestoHasta, hoy)}`;
  } else if (c.teEscribio) {
    grupo = 'hoy';
    porque = `Te escribió ${cuandoFue(c.teEscribio.dia, hoy)} y lo último de la conversación es suyo`;
  } else if (urgente) {
    grupo = 'hoy';
    porque = urgente.id === 'dia_malo' ? 'Llegó en un día difícil y aún no habéis hablado' : 'Molestia fuerte en el check-in y aún no habéis hablado';
  } else if (faltan > 0 && (c.diasSin == null || c.diasSin >= separacion)) {
    grupo = 'hoy';
    porque = c.ultimo == null ? 'Ningún mensaje personal tuyo en las últimas 4 semanas' : `Tu último mensaje personal fue ${haceDias(c.diasSin)}`;
  } else if (faltan > 0) {
    grupo = 'pronto';
    const vuelve = sumarDias(c.ultimo, separacion);
    porque = `Le escribiste ${haceDias(c.diasSin)}: le toca otra vez ${cuandoVuelve(vuelve, hoy)}`;
  } else {
    grupo = 'al_dia';
    porque = `${c.en7 === 1 ? '1 día' : `${c.en7} días`} de contacto en los últimos 7`;
  }
  return {
    atleta_id: r.atleta_id, nombre: r.nombre, primerNombre: primerNombre(r.nombre), foto: r.foto || null, servicio: r.servicio,
    contacto: c, objetivo, faltan, grupo, porque, urgente: !!urgente, teEscribio: c.teEscribio || null, motivos, motivo: motivos[0] || null,
    pospuestoHasta: grupo === 'pospuesto' ? pospuestoHasta : null,
  };
}

// «mañana», «pasado mañana», «el jueves»
function cuandoVuelve(fecha, hoy) {
  if (fecha <= hoy) return 'hoy';
  if (fecha === sumarDias(hoy, 1)) return 'mañana';
  if (fecha === sumarDias(hoy, 2)) return 'pasado mañana';
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const [y, m, d] = fecha.split('-').map(Number);
  return `el ${DIAS[new Date(y, m - 1, d).getDay()]}`;
}

// El orden dentro de «Hoy»: lo urgente de salud, quien te escribió, quien lleva más sin saber de ti (nunca, primero),
// a quien le faltan más contactos y, a igualdad, por nombre. En el resto, quien menos contacto lleva primero.
export function ordenRadar(filas) {
  const sin = (f) => (f.contacto.diasSin == null ? Infinity : f.contacto.diasSin);
  return [...(filas || [])].sort((a, b) => (GRUPOS_RADAR.indexOf(a.grupo) - GRUPOS_RADAR.indexOf(b.grupo))
    || (Number(b.urgente) - Number(a.urgente))
    || (Number(!!b.teEscribio) - Number(!!a.teEscribio))
    || (sin(b) - sin(a) || 0)
    || (b.faltan - a.faltan)
    || String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
}

// El radar entero. resumenes: las filas del panel (api.resumenes); contactos: contactosPorAtleta(…);
// sesiones y records: { [atleta_id]: [...] }; checkins: { [atleta_id]: día en que envió el último }; pospuestos:
// { [atleta_id]: hasta }. Solo salen los atletas activos.
export function radar({ resumenes = [], contactos = {}, sesiones = {}, records = {}, checkins = {}, pospuestos = {}, hoy, ajustes = AJUSTES_RADAR }) {
  const filas = ordenRadar(resumenes.filter((r) => r && r.estado === 'activo').map((r) => filaRadar({
    resumen: r, contacto: contactoDe(contactos, r.atleta_id), sesiones: sesiones[r.atleta_id] || [], records: records[r.atleta_id] || [],
    checkinEl: checkins[r.atleta_id] || null, hoy, pospuestoHasta: pospuestos[r.atleta_id] || null, ajustes,
  })));
  const cuenta = Object.fromEntries(GRUPOS_RADAR.map((g) => [g, filas.filter((f) => f.grupo === g).length]));
  const objetivo = { ...AJUSTES_RADAR, ...ajustes }.objetivo;
  return {
    filas, cuenta, objetivo,
    resumen: {
      atletas: filas.length,
      cumplen: filas.filter((f) => f.faltan === 0).length,
      sinContacto: filas.filter((f) => f.contacto.en7 === 0).length,
      // días de contacto por atleta en cada una de las 4 últimas ventanas de 7 días (de la más antigua a la actual)
      mediaSemanas: filas.length ? filas[0].contacto.semanas.map((_, i) => Math.round((filas.reduce((t, f) => t + (f.contacto.semanas[i] || 0), 0) / filas.length) * 10) / 10) : [],
    },
  };
}

// «12 de 35 con 2 días de contacto esta semana»
export function textoResumenRadar(x) {
  const { atletas, cumplen, sinContacto } = x.resumen;
  if (!atletas) return 'Aún no tienes atletas activos';
  const base = `${cumplen} de ${atletas} con ${x.objetivo === 1 ? '1 día' : `${x.objetivo} días`} de contacto en los últimos 7`;
  return sinContacto ? `${base}; ${sinContacto === 1 ? '1 sin ningún mensaje tuyo' : `${sinContacto} sin ningún mensaje tuyo`}` : base;
}
