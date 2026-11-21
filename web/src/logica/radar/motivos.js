// Radar de contacto: de qué hablarle a cada atleta. Lógica pura.
//
// Con lo que el panel ya sabe de cada uno (su resumen: sesiones de la semana, avisos, última serie) y sus sesiones recientes
// (para «¿Cómo llegas hoy?» y la última sesión), saca los motivos por los que tiene sentido escribirle, de más a menos
// importante. Cada motivo: { id, clave, grupo, nivel, etiqueta, datos, desde, urgente, pendiente, pideHoy }
//   grupo: 'salud' (molestias y días malos) | 'pendiente' (lo que tiene abierto contigo) | 'flojo' (lo que va flojo) |
//          'bien' (lo que va bien) | 'momento' (fechas y momentos) | 'saludo'
//   nivel: 'alerta' | 'aviso' | 'ok' | 'info' | 'morado' (el color del chip, como en la revisión semanal)
//   desde: el día (ISO) en que pasó, si se sabe; urgente: pide escribirle aunque vayas al día con él (salud)
//   pendiente: es algo abierto que aún no habéis hablado (sale en «Pendiente de hablar»)
//   pideHoy: el porqué para escribirle hoy aunque vayas al día (su cumpleaños, una carrera, tu recordatorio…)
//   clave: única en su fila (los pendientes tuyos son varios del mismo tipo)
// (v0.201) Con `extra` (datos/radar.js): lo que te escribió y lo que le preguntaste, su check-in, vídeos sin corregir,
// objetivos propuestos, tus pendientes y tu recordatorio de la lista, su cumpleaños, sus carreras, la vuelta de una
// pausa, su objetivo (al abrir su fila) y si se está enfriando.
import { diasEntre, sumarDias, desdeISO } from '../fechas.js';
import { consejoPreparacion } from '../preparacion.js';

export const GRUPOS_MOTIVO = ['salud', 'pendiente', 'flojo', 'bien', 'momento', 'saludo'];
export const NOMBRE_GRUPO = { salud: 'Molestias y días malos', pendiente: 'Pendiente de hablar', flojo: 'Lo que va flojo', bien: 'Lo que va bien', momento: 'Fechas y momentos', saludo: 'Solo saludar' };

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

// (v0.202) El plan de contacto de los nuevos: [motivo, día desde el alta, etiqueta]
// (el día del alta es su primer día: 0)
export const PLAN_NUEVOS = [['nuevo_dia1', 0, 'Su primer día en FBE'], ['nuevo_dia3', 2, 'Su tercer día en FBE'], ['nuevo_semana1', 7, 'Su primera semana en FBE'], ['nuevo_mes1', 28, 'Su primer mes en FBE']];
export const ORDEN_MOTIVOS = ['molestia_fuerte', 'dia_malo', 'responder', 'molestia', 'cumple', 'carrera_antes', 'carrera_despues', 'enfriando',
  'recordatorio', 'pendiente_mio', 'pregunta_sin_respuesta', 'nota_checkin', 'video', 'objetivo_propuesto', 'receta', 'vuelta_pausa',
  'nuevo_dia1', 'nuevo_dia3', 'nuevo_semana1', 'nuevo_mes1', 'primera_semana', 'llamada',
  'parado', 'dia_flojo', 'objetivo_cumplido', 'record', 'cerca_objetivo', 'semana_completa', 'racha', 'aniversario', 'fin_bloque', 'bloque_nuevo',
  'descarga', 'semana_corta', 'mes', 'pendientes', 'cumplimiento', 'esfuerzo', 'carga', 'habitos', 'comidas', 'peso', 'sin_bloque', 'sin_checkin', 'fiestas', 'viaje',
  'pausa_mitad', 'pausa_vuelta', 'invitado', 'antiguo', 'saludo'];
const ORDEN = ORDEN_MOTIVOS;

// resumen: la fila del panel (api.resumenes); sesiones: sus sesiones hechas de los últimos días [{ nombre, fecha, preparacion }];
// records: sus récords recientes [{ ejercicio, texto, fecha }] (se cargan aparte, al abrir su fila); ultimoContacto: el último
// día con contacto personal (para saber si lo urgente ya está hablado); checkinEl: el día en que envió su último check-in
export function motivosDe({ resumen: r, sesiones = [], records = [], ultimoContacto = null, checkinEl = null, hoy, extra = {} }) {
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
    out.push({ id: fuerte ? 'molestia_fuerte' : 'molestia', grupo: 'salud', nivel: mol.nivel, etiqueta: mol.texto, datos: { zonas }, desde, urgente: fuerte && !yaHablado(desde), pendiente: !yaHablado(desde) });
  }
  // Llegó flojo o mal a una sesión de los últimos 3 días («¿Cómo llegas hoy?»)
  const mala = recientes.filter((s) => diasEntre(s.fecha, hoy) <= 3).map((s) => ({ s, c: consejoPreparacion(s.preparacion) })).find((x) => x.c && x.c.nivel !== 'bien');
  if (mala) {
    const malo = mala.c.nivel === 'malo';
    out.push({ id: malo ? 'dia_malo' : 'dia_flojo', grupo: 'salud', nivel: malo ? 'aviso' : 'info',
      etiqueta: `${malo ? 'Día difícil' : 'Día flojo'} ${cuandoFue(mala.s.fecha, hoy)} (${mala.s.nombre})`,
      datos: { sesion: mala.s.nombre, fecha: mala.s.fecha, que: queApunto(mala.s.preparacion) }, desde: mala.s.fecha, urgente: malo && !yaHablado(mala.s.fecha), pendiente: !yaHablado(mala.s.fecha) });
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

  // ---------- (v0.201) Lo que tiene abierto contigo ----------
  const ex = extra || {};
  const corto = (t, n = 70) => { const x = String(t || '').replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1).trimEnd()}…` : x; };
  if (ex.teEscribio) {
    const texto = ex.mensajeAtleta?.texto ? String(ex.mensajeAtleta.texto) : null;
    out.push({ id: 'responder', grupo: 'pendiente', nivel: 'morado', etiqueta: `Te escribió ${cuandoFue(ex.teEscribio.dia, hoy)}`,
      datos: { texto, dia: ex.teEscribio.dia, pregunta: !!texto && texto.includes('?'), mensajeId: ex.mensajeAtleta?.id || null }, desde: ex.teEscribio.dia, pendiente: true });
  }
  // Le preguntaste algo hace 3 días o más (y hasta 14) y lo último de la conversación sigue siendo tuyo
  const pc = ex.preguntaCoach;
  if (pc?.texto && String(pc.texto).includes('?') && pc.dia) {
    const n = diasEntre(pc.dia, hoy);
    if (n >= 3 && n <= 14) out.push({ id: 'pregunta_sin_respuesta', grupo: 'pendiente', nivel: 'info', etiqueta: `Sin respuesta a lo que le preguntaste ${cuandoFue(pc.dia, hoy)}`,
      datos: { texto: String(pc.texto), dia: pc.dia }, desde: pc.dia, pendiente: true });
  }
  // Tu recordatorio de la lista de Atletas (si ya ha llegado su día)
  if (ex.recordatorio?.fecha && ex.recordatorio.fecha <= hoy) {
    out.push({ id: 'recordatorio', grupo: 'pendiente', nivel: 'morado', etiqueta: `Tu recordatorio: ${corto(ex.recordatorio.texto, 60)}`,
      datos: { texto: ex.recordatorio.texto || '' }, desde: ex.recordatorio.fecha, pendiente: true,
      pideHoy: yaHablado(ex.recordatorio.fecha) ? null : `Tu recordatorio: «${corto(ex.recordatorio.texto, 60)}»` });
  }
  // Tus temas pendientes (los de «Recuérdamelo», cuando llega su día)
  for (const p of (ex.pendientes || []).filter((x) => x && !x.hecho && x.desde <= hoy)) {
    out.push({ id: 'pendiente_mio', clave: `pend-${p.id}`, grupo: 'pendiente', nivel: 'morado', etiqueta: corto(p.texto, 60),
      datos: { texto: p.texto, notaId: p.id }, desde: p.desde, pendiente: true,
      pideHoy: yaHablado(p.desde) ? null : `Te apuntaste hablarle de «${corto(p.texto, 60)}»` });
  }
  // Una nota en su último check-in que aún no has revisado ni le has contestado
  const ck = ex.checkin;
  const nota = String(ck?.notas || '').trim();
  const ckDia = checkinEl || (ck?.semana_inicio ? sumarDias(ck.semana_inicio, 4) : null);
  if (nota && !ck.revisado_en && !yaHablado(ckDia)) {
    out.push({ id: 'nota_checkin', grupo: 'pendiente', nivel: 'info', etiqueta: 'Nota en su check-in', datos: { nota }, desde: ckDia, pendiente: true });
  }
  if (ex.videos?.n > 0) {
    out.push({ id: 'video', grupo: 'pendiente', nivel: 'info', etiqueta: ex.videos.n === 1 ? '1 vídeo sin corregir' : `${ex.videos.n} vídeos sin corregir`,
      datos: { n: ex.videos.n }, desde: ex.videos.desde || null, pendiente: true });
  }
  if (ex.propuestas > 0) {
    out.push({ id: 'objetivo_propuesto', grupo: 'pendiente', nivel: 'info', etiqueta: ex.propuestas === 1 ? 'Te propuso un objetivo' : `Te propuso ${ex.propuestas} objetivos`,
      datos: { n: ex.propuestas }, desde: null, pendiente: true });
  }
  const receta = alerta(r, 'receta');
  if (receta) out.push({ id: 'receta', grupo: 'pendiente', nivel: 'aviso', etiqueta: receta.texto, datos: {}, desde: null, pendiente: true });

  // ---------- (v0.201) Lo que va flojo, de lo que ya avisa el panel ----------
  if (ex.enfriando?.razones?.length) {
    out.push({ id: 'enfriando', grupo: 'flojo', nivel: 'aviso', etiqueta: 'Se está enfriando', datos: { razones: ex.enfriando.razones.map((x) => x.texto) }, desde: null });
  }
  for (const [tipo, id] of [['esfuerzo', 'esfuerzo'], ['carga', 'carga'], ['habitos', 'habitos'], ['nutricion_registro', 'comidas'], ['nutricion_ritmo', 'peso'], ['sin_bloque', 'sin_bloque']]) {
    const a = alerta(r, tipo);
    if (a && !out.some((m) => m.id === id)) out.push({ id, grupo: 'flojo', nivel: a.nivel === 'aviso' ? 'aviso' : 'info', etiqueta: a.texto, datos: { texto: a.texto }, desde: null });
  }

  // ---------- (v0.201) Fechas y momentos ----------
  const ayer = sumarDias(hoy, -1);
  const mmdd = (iso) => iso.slice(5);
  if (ex.cumple?.mes && ex.cumple?.dia) {
    const c = `${String(ex.cumple.mes).padStart(2, '0')}-${String(ex.cumple.dia).padStart(2, '0')}`;
    if (c === mmdd(hoy)) out.push({ id: 'cumple', grupo: 'momento', nivel: 'ok', etiqueta: 'Hoy es su cumpleaños', datos: { cuando: 'hoy' }, desde: hoy, pideHoy: yaHablado(hoy) ? null : 'Hoy es su cumpleaños' });
    else if (c === mmdd(ayer) && !yaHablado(ayer)) out.push({ id: 'cumple', grupo: 'momento', nivel: 'ok', etiqueta: 'Ayer fue su cumpleaños', datos: { cuando: 'ayer' }, desde: ayer, pideHoy: 'Ayer fue su cumpleaños y aún no le has escrito' });
  }
  for (const e of (ex.carreras || []).filter((x) => x?.fecha && x.decision !== 'no')) {
    const n = diasEntre(hoy, e.fecha);
    if (n >= 0 && n <= 7 && !out.some((m) => m.id === 'carrera_antes')) {
      out.push({ id: 'carrera_antes', grupo: 'momento', nivel: 'morado', etiqueta: `${e.nombre}: ${n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`}`,
        datos: { nombre: e.nombre, fecha: e.fecha, dias: n }, desde: null, pideHoy: n <= 1 && !yaHablado(sumarDias(e.fecha, -1)) ? `Tiene «${e.nombre}» ${n === 0 ? 'hoy' : 'mañana'}` : null });
    } else if (n < 0 && n >= -3 && !out.some((m) => m.id === 'carrera_despues')) {
      out.push({ id: 'carrera_despues', grupo: 'momento', nivel: 'morado', etiqueta: `Corrió ${e.nombre} ${cuandoFue(e.fecha, hoy)}`,
        datos: { nombre: e.nombre, fecha: e.fecha }, desde: e.fecha, pendiente: !yaHablado(e.fecha), pideHoy: yaHablado(e.fecha) ? null : `Corrió «${e.nombre}» ${cuandoFue(e.fecha, hoy)} y aún no habéis hablado` });
    }
  }
  if (ex.pausaFin && ex.pausaFin <= hoy && diasEntre(ex.pausaFin, hoy) <= 7) {
    out.push({ id: 'vuelta_pausa', grupo: 'momento', nivel: 'morado', etiqueta: 'Vuelve de una pausa', datos: { desde: ex.pausaFin }, desde: ex.pausaFin,
      pideHoy: yaHablado(ex.pausaFin) ? null : 'Vuelve de una pausa y aún no habéis hablado' });
  }
  if (r.fecha_alta && r.fecha_alta <= hoy) {
    const n = diasEntre(r.fecha_alta, hoy);
    // (v0.202) El plan de sus primeras semanas: día 1, día 3, primera semana y primer mes (cada uno, ese día y hasta dos
    // más si aún no le has escrito desde entonces)
    const plan = PLAN_NUEVOS.find(([, d]) => n >= d && n <= d + 2 && !yaHablado(sumarDias(r.fecha_alta, d)));
    if (plan) {
      const [id, d, etiqueta] = plan;
      out.push({ id, grupo: 'momento', nivel: 'morado', etiqueta, datos: { dias: n }, desde: sumarDias(r.fecha_alta, d), pideHoy: `${etiqueta}: toca escribirle` });
    } else if (n <= 7) out.push({ id: 'primera_semana', grupo: 'momento', nivel: 'morado', etiqueta: n === 0 ? 'Empieza hoy en FBE' : 'Su primera semana en FBE', datos: { dias: n }, desde: r.fecha_alta });
    else if (n <= 31) { /* entre medias del plan, nada */ } else {
      const anos = Number(hoy.slice(0, 4)) - Number(r.fecha_alta.slice(0, 4));
      const este = `${hoy.slice(0, 4)}${r.fecha_alta.slice(4)}`;
      const d = diasEntre(este, hoy);
      if (anos >= 1 && d >= 0 && d <= 3) out.push({ id: 'aniversario', grupo: 'momento', nivel: 'ok', etiqueta: anos === 1 ? '1 año con FBE' : `${anos} años con FBE`, datos: { anos }, desde: este,
        pideHoy: d === 0 && !yaHablado(hoy) ? (anos === 1 ? 'Hoy hace 1 año que empezó en FBE' : `Hoy hace ${anos} años que empezó en FBE`) : null });
    }
  }
  if (entrena && r.semana?.total > 1) {
    const bloque = r.bloque?.nombre || null;
    if (r.semana.numero >= r.semana.total) out.push({ id: 'fin_bloque', grupo: 'momento', nivel: 'info', etiqueta: 'Última semana del bloque', datos: { bloque, total: r.semana.total, ...(ex.bloqueCifras || {}) }, desde: null });
    else if (r.semana.numero === 1) out.push({ id: 'bloque_nuevo', grupo: 'momento', nivel: 'info', etiqueta: 'Empieza bloque nuevo', datos: { bloque, total: r.semana.total }, desde: null });
  }
  if (entrena && r.semana?.foco === 'descarga') out.push({ id: 'descarga', grupo: 'momento', nivel: 'info', etiqueta: 'Semana de descarga', datos: {}, desde: null });
  // (v0.202) El domingo, a quien se ha quedado corto, el cierre de su semana
  if (entrena && desdeISO(hoy).getDay() === 0 && (r.sesiones?.total || 0) > 0 && (r.sesiones.completadas || 0) < r.sesiones.total) {
    out.push({ id: 'semana_corta', grupo: 'momento', nivel: 'info', etiqueta: `Cierra la semana con ${r.sesiones.completadas} de ${r.sesiones.total}`, datos: { hechas: r.sesiones.completadas, total: r.sesiones.total }, desde: null });
  }
  // Su mes en números: los dos últimos días del mes y los dos primeros del siguiente
  const dm = Number(hoy.slice(8, 10)), finMes = new Date(Date.UTC(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)), 0)).getUTCDate();
  if (entrena && (dm >= finMes - 1 || dm <= 2)) out.push({ id: 'mes', grupo: 'momento', nivel: 'info', etiqueta: dm <= 2 ? 'Su mes pasado en números' : 'Su mes en números', datos: { ...(ex.mesCifras || {}) }, desde: null });
  const o = ex.objetivo;
  if (o?.conseguido) out.push({ id: 'objetivo_cumplido', grupo: 'bien', nivel: 'ok', etiqueta: `Objetivo conseguido: ${corto(o.titulo, 50)}`, datos: { objetivo: o.titulo }, desde: null });
  else if (o?.cerca) out.push({ id: 'cerca_objetivo', grupo: 'bien', nivel: 'ok', etiqueta: `Cerca de su objetivo (${o.pct} %)`, datos: { objetivo: o.titulo, pct: o.pct }, desde: null });
  if (o?.peso && (o.peso.alejandose || o.peso.parado) && !out.some((m) => m.id === 'peso')) {
    out.push({ id: 'peso', grupo: 'flojo', nivel: 'info', etiqueta: o.peso.alejandose ? 'El peso se aleja de su objetivo' : 'El peso no se mueve', datos: { objetivo: o.titulo }, desde: null });
  }
  if ((mmdd(hoy) >= '12-20') || (mmdd(hoy) <= '01-06')) out.push({ id: 'fiestas', grupo: 'momento', nivel: 'info', etiqueta: 'Navidad', datos: {}, desde: null });
  // (v0.202) Proponerle una llamada: si se enfría, si lleva 10 días o más sin entrenar o con una molestia fuerte
  const parado10 = out.find((m) => m.id === 'parado' && (m.datos.dias ?? 0) >= 10);
  if (ex.enfriando || parado10 || out.some((m) => m.id === 'molestia_fuerte')) {
    out.push({ id: 'llamada', grupo: 'flojo', nivel: 'info', etiqueta: 'Proponerle una llamada', datos: { enlace: ex.enlace || '' }, desde: null });
  }

  // Siempre queda saludar: con su última sesión, si la hay
  const ultima = recientes.find((s) => diasEntre(s.fecha, hoy) <= 7) || null;
  out.push({ id: 'saludo', grupo: 'saludo', nivel: 'info', etiqueta: 'Solo saludar',
    datos: { sesion: ultima?.nombre || null, fecha: ultima?.fecha || null, sesionId: ultima?.id || null, nutricion: !entrena }, desde: null, urgente: false });

  return out.map((m) => ({ clave: m.id, pendiente: false, pideHoy: null, urgente: false, ...m }))
    .sort((a, b) => ORDEN.indexOf(a.id) - ORDEN.indexOf(b.id) || String(a.desde || '').localeCompare(String(b.desde || '')));
}

// (v0.201) Las situaciones de la biblioteca, para elegir cualquiera aunque no se haya detectado («Más situaciones»)
export const SITUACIONES = [
  ['salud', [['molestia', 'Una molestia'], ['dia_malo', 'Un día difícil']]],
  ['pendiente', [['responder', 'Contestarle'], ['pregunta_sin_respuesta', 'Volver a preguntarle'], ['nota_checkin', 'Su nota del check-in'], ['video', 'Un vídeo suyo'], ['objetivo_propuesto', 'Su objetivo propuesto'], ['receta', 'Una receta que pide cambiar']]],
  ['flojo', [['enfriando', 'Se está enfriando'], ['llamada', 'Proponerle una llamada'], ['parado', 'Lleva días sin entrenar'], ['pendientes', 'Le quedan sesiones'], ['cumplimiento', 'No le da para todo'], ['esfuerzo', 'Se pasa del RPE'], ['carga', 'Mucha carga'], ['habitos', 'Los hábitos'], ['comidas', 'Apuntar las comidas'], ['peso', 'El peso'], ['sin_checkin', 'Falta el check-in'], ['sin_bloque', 'Su bloque nuevo']]],
  ['bien', [['record', 'Un récord'], ['semana_completa', 'Semana completa'], ['racha', 'Una racha'], ['cerca_objetivo', 'Cerca del objetivo'], ['objetivo_cumplido', 'Objetivo conseguido']]],
  ['momento', [['cumple', 'Su cumpleaños'], ['aniversario', 'Su aniversario en FBE'], ['nuevo_dia1', 'Su primer día'], ['nuevo_dia3', 'Su tercer día'], ['primera_semana', 'Su primera semana'], ['nuevo_mes1', 'Su primer mes'], ['vuelta_pausa', 'La vuelta de una pausa'], ['fin_bloque', 'Fin de bloque'], ['bloque_nuevo', 'Bloque nuevo'], ['descarga', 'Semana de descarga'], ['semana_corta', 'Cierre de semana corta'], ['mes', 'Su mes en números'], ['carrera_antes', 'Antes de una carrera'], ['carrera_despues', 'Después de una carrera'], ['viaje', 'De viaje'], ['fiestas', 'Navidad']]],
  ['saludo', [['saludo', 'Solo saludar']]],
];
export const NOMBRE_SITUACION = Object.fromEntries(SITUACIONES.flatMap(([, xs]) => xs));
const GRUPO_SITUACION = Object.fromEntries(SITUACIONES.flatMap(([g, xs]) => xs.map(([id]) => [id, g])));

// Un motivo elegido a mano de la biblioteca: si ya está detectado, ese (con sus datos); si no, uno sin datos
export function motivoDeSituacion(id, motivos = []) {
  const ya = (motivos || []).find((m) => m.id === id || (id === 'molestia' && m.id === 'molestia_fuerte') || (id === 'dia_malo' && m.id === 'dia_flojo'));
  if (ya) return ya;
  return { id, clave: `elegido-${id}`, grupo: GRUPO_SITUACION[id] || 'saludo', nivel: 'info', etiqueta: NOMBRE_SITUACION[id] || 'Solo saludar', datos: {}, desde: null, urgente: false, pendiente: false, pideHoy: null, aMano: true };
}


// (v0.202) Los que no están activos: sin activar su cuenta, en pausa y antiguos atletas. extra: { invitacion: { creada_en },
// pausa: { desde, hasta }, bajaEn } → los motivos de su fila (sin el saludo)
export function motivosOtros({ resumen: r, extra = {}, hoy }) {
  const out = [];
  if (!r) return out;
  if (r.estado === 'invitado') {
    const dia = extra.invitacion?.creada_en ? String(extra.invitacion.creada_en).slice(0, 10) : null;
    out.push({ id: 'invitado', grupo: 'pendiente', nivel: 'info', etiqueta: dia ? `Sin activar su cuenta (invitación del ${Number(dia.slice(8, 10))}/${Number(dia.slice(5, 7))})` : 'Sin activar su cuenta', datos: { dias: dia ? diasEntre(dia, hoy) : null }, desde: dia });
  } else if (r.estado === 'pausado' && r.pausa?.desde) {
    const p = r.pausa;
    const total = p.hasta ? diasEntre(p.desde, p.hasta) : null, pasados = diasEntre(p.desde, hoy);
    if (p.hasta && diasEntre(hoy, p.hasta) <= 2) out.push({ id: 'pausa_vuelta', grupo: 'momento', nivel: 'morado', etiqueta: `Vuelve ${diasEntre(hoy, p.hasta) <= 0 ? 'mañana' : diasEntre(hoy, p.hasta) === 1 ? 'pasado mañana' : 'en tres días'} de su pausa`, datos: { hasta: p.hasta }, desde: null });
    else out.push({ id: 'pausa_mitad', grupo: 'momento', nivel: 'info', etiqueta: total ? `En pausa: lleva ${pasados} de ${total} días` : `En pausa desde hace ${pasados} días`, datos: { pasados, total }, desde: p.desde });
  } else if (r.estado === 'baja' && extra.bajaEn) {
    const n = diasEntre(extra.bajaEn, hoy);
    out.push({ id: 'antiguo', grupo: 'momento', nivel: 'info', etiqueta: `De baja desde hace ${n < 60 ? `${n} días` : `${Math.round(n / 30)} meses`}`, datos: { dias: n }, desde: extra.bajaEn });
  }
  return out.map((m) => ({ clave: m.id, pendiente: false, pideHoy: null, urgente: false, ...m }));
}
