// Radar de contacto: de qué hablarle a cada atleta. Lógica pura.
//
// Con lo que el panel ya sabe de cada uno (su resumen: sesiones de la semana, avisos, última serie) y sus sesiones recientes
// (para «¿Cómo llegas hoy?» y la última sesión), saca los motivos por los que tiene sentido escribirle, de más a menos
// importante. Cada motivo: { id, grupo, nivel, etiqueta, datos, desde, urgente }
//   grupo: 'salud' (molestias y días malos) | 'flojo' (lo que va flojo) | 'bien' (lo que va bien) | 'saludo'
//   nivel: 'alerta' | 'aviso' | 'ok' | 'info' (el color del chip, como en la revisión semanal)
//   desde: el día (ISO) en que pasó, si se sabe; urgente: pide escribirle aunque vayas al día con él
import { diasEntre, sumarDias, desdeISO } from '../fechas.js';
import { consejoPreparacion } from '../preparacion.js';

export const GRUPOS_MOTIVO = ['salud', 'flojo', 'bien', 'saludo'];
export const NOMBRE_GRUPO = { salud: 'Molestias y días malos', flojo: 'Lo que va flojo', bien: 'Lo que va bien', saludo: 'Solo saludar' };

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
// «hoy», «ayer», «el lunes» (hasta 6 días atrás), «el día 3»
export function cuandoFue(fecha, hoy) {
  const n = diasEntre(fecha, hoy);
  if (n <= 0) return 'hoy';
  if (n === 1) return 'ayer';
  if (n <= 6) return `el ${DIAS_SEMANA[desdeISO(fecha).getDay()]}`;
  return `el día ${desdeISO(fecha).getDate()}`;
}

const alerta = (r, tipo) => (r?.alertas || []).find((a) => a.tipo === tipo) || null;

// Qué apuntó en «¿Cómo llegas hoy?» que no iba bien: «habías dormido mal», «ibas con la energía baja»…
export function queApunto(p) {
  const partes = [];
  if (p?.sueno === 1) partes.push('habías dormido mal');
  if (p?.energia === 1) partes.push('ibas con la energía baja');
  if (p?.molestias === 1) partes.push('tenías bastantes agujetas o molestias');
  if (!partes.length) return 'no llegabas en tu mejor día';
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

// Semanas seguidas completas hasta la pasada (y la actual, si ya está completa). semanas: las de la minigráfica del panel,
// de la más antigua a la actual: [{ hechas, total }]
export function semanasSeguidas(semanas = []) {
  if (!semanas.length) return 0;
  const completa = (w) => w && w.total > 0 && w.hechas >= w.total;
  let n = completa(semanas[semanas.length - 1]) ? 1 : 0;
  for (let i = semanas.length - 2; i >= 0; i--) { if (completa(semanas[i])) n++; else break; }
  return n;
}

const ORDEN = ['molestia_fuerte', 'dia_malo', 'molestia', 'parado', 'dia_flojo', 'record', 'semana_completa', 'racha', 'pendientes', 'cumplimiento', 'sin_checkin', 'saludo'];

// resumen: la fila del panel (api.resumenes); sesiones: sus sesiones hechas de los últimos días [{ nombre, fecha, preparacion }];
// records: sus récords recientes [{ ejercicio, texto, fecha }] (se cargan aparte, al abrir su fila); ultimoContacto: el último
// día con contacto personal (para saber si lo urgente ya está hablado); checkinEl: el día en que envió su último check-in
export function motivosDe({ resumen: r, sesiones = [], records = [], ultimoContacto = null, checkinEl = null, hoy }) {
  const out = [];
  if (!r) return out;
  const entrena = r.servicio !== 'nutricion';
  const yaHablado = (desde) => !!(ultimoContacto && desde && ultimoContacto >= desde);
  const recientes = [...sesiones].filter((s) => s?.fecha && s.fecha <= hoy).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  // Molestias del último check-in (el aviso del panel ya trae las zonas)
  const mol = alerta(r, 'molestia');
  if (mol) {
    const zonas = String(mol.texto || '').split(':').slice(1).join(':').trim();
    // Se da por hablado si le has escrito desde el día en que lo envió (si no se sabe: desde el viernes de esa semana,
    // que es cuando se abre el check-in)
    const desde = checkinEl || (r.checkin?.semana ? sumarDias(r.checkin.semana, 4) : null);
    const fuerte = mol.nivel === 'alerta';
    out.push({ id: fuerte ? 'molestia_fuerte' : 'molestia', grupo: 'salud', nivel: mol.nivel, etiqueta: mol.texto, datos: { zonas }, desde, urgente: fuerte && !yaHablado(desde) });
  }
  // Llegó flojo o mal a una sesión de los últimos 3 días («¿Cómo llegas hoy?»)
  const mala = recientes.filter((s) => diasEntre(s.fecha, hoy) <= 3).map((s) => ({ s, c: consejoPreparacion(s.preparacion) })).find((x) => x.c && x.c.nivel !== 'bien');
  if (mala) {
    const malo = mala.c.nivel === 'malo';
    out.push({ id: malo ? 'dia_malo' : 'dia_flojo', grupo: 'salud', nivel: malo ? 'aviso' : 'info',
      etiqueta: `${malo ? 'Día difícil' : 'Día flojo'} ${cuandoFue(mala.s.fecha, hoy)} (${mala.s.nombre})`,
      datos: { sesion: mala.s.nombre, fecha: mala.s.fecha, que: queApunto(mala.s.preparacion) }, desde: mala.s.fecha, urgente: malo && !yaHablado(mala.s.fecha) });
  }

  if (entrena) {
    // Lleva días sin registrar (el mismo criterio que el panel)
    const parado = alerta(r, 'sin_entrenar');
    if (parado) {
      const dias = r.ultimaSerie ? diasEntre(r.ultimaSerie, hoy) : null;
      out.push({ id: 'parado', grupo: 'flojo', nivel: 'aviso', etiqueta: parado.texto, datos: { dias }, desde: r.ultimaSerie || null, urgente: false });
    }
    // De jueves a domingo, con menos de la mitad de las sesiones de la semana hechas
    const { completadas = 0, total = 0 } = r.sesiones || {};
    const diaSemana = (desdeISO(hoy).getDay() + 6) % 7;   // 0 = lunes
    if (!parado && total > 1 && diaSemana >= 3 && completadas < total / 2) {
      out.push({ id: 'pendientes', grupo: 'flojo', nivel: 'info', etiqueta: `${completadas} de ${total} sesiones esta semana`, datos: { hechas: completadas, total, faltan: total - completadas }, desde: null, urgente: false });
    }
    const cumple = alerta(r, 'cumplimiento');
    if (cumple) out.push({ id: 'cumplimiento', grupo: 'flojo', nivel: 'info', etiqueta: cumple.texto, datos: { pct: r.cumplimiento?.series?.pct ?? null }, desde: null, urgente: false });

    // Lo que va bien
    for (const rec of (records || []).filter((x) => x?.fecha && diasEntre(x.fecha, hoy) <= 7).slice(0, 1)) {
      out.push({ id: 'record', grupo: 'bien', nivel: 'ok', etiqueta: `Récord en ${rec.ejercicio}`, datos: { ejercicio: rec.ejercicio, texto: rec.texto || '', fecha: rec.fecha }, desde: rec.fecha, urgente: false });
    }
    if (total > 0 && completadas >= total) {
      out.push({ id: 'semana_completa', grupo: 'bien', nivel: 'ok', etiqueta: total === 1 ? 'Semana completa' : `Semana completa (${total} de ${total})`, datos: { total }, desde: null, urgente: false });
    }
    const racha = semanasSeguidas(r.chispas?.sesiones || []);
    if (racha >= 3) out.push({ id: 'racha', grupo: 'bien', nivel: 'ok', etiqueta: `${racha} semanas seguidas completas`, datos: { semanas: racha }, desde: null, urgente: false });
  }
  // Sin check-in la semana pasada: solo a quien ya ha enviado alguno (a quien acaba de empezar o no los hace, no se le reclama)
  const sinCheckin = r.checkin ? alerta(r, 'sin_checkin') : null;
  if (sinCheckin) out.push({ id: 'sin_checkin', grupo: 'flojo', nivel: 'info', etiqueta: sinCheckin.texto, datos: {}, desde: null, urgente: false });

  // Siempre queda saludar: con su última sesión, si la hay
  const ultima = recientes.find((s) => diasEntre(s.fecha, hoy) <= 7) || null;
  out.push({ id: 'saludo', grupo: 'saludo', nivel: 'info', etiqueta: 'Solo saludar',
    datos: { sesion: ultima?.nombre || null, fecha: ultima?.fecha || null, nutricion: !entrena }, desde: null, urgente: false });

  return out.sort((a, b) => ORDEN.indexOf(a.id) - ORDEN.indexOf(b.id));
}
