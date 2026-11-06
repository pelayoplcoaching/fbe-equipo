// v0.68: la bienvenida personalizada al abrir la app (una vez al día). Lo puro: qué dice y cuándo sale.
import { diasEntre } from './fechas.js';

// El nombre de pila (lo primero del nombre), sin espacios de más
export const nombreDePila = (nombre) => String(nombre || '').trim().split(/\s+/)[0] || '';

// ¿Sale hoy? Una vez al día (la primera vez que se abre la app ese día, por la fecha de Madrid), nunca con una sesión a medias
// (entonces se va directo a ella) y nunca si no se sabe la fecha
export function tocaBienvenida({ vista = null, hoy, sesionEnCurso = false }) {
  if (!hoy || sesionEnCurso) return false;
  return vista !== hoy;
}

// Qué dice. Para el atleta: { saludo, nombre, mensaje, detalle? }, según cómo va:
//   · si aún no ha entrenado nunca: que su primera sesión le espera (la bienvenida de su primer día es la de siempre);
//   · si viene de un récord (de ayer o anteayer): el récord;
//   · 7 días o más sin entrenar (o más de 11 semanas: haceMucho): «¿Retomamos hoy?»; de 4 a 6: un empujón suave;
//   · si hoy toca sesión: cuál (y la racha si la hay);
//   · si hoy es descanso o ya la ha hecho: eso;
//   · si no, lo de siempre.
// Para el coach: «Valar morghulis, coach supremo» (lo pidió Pelayo).
export function mensajeBienvenida({ rol = 'atleta', nombre = '', primeraVez = false, ultimoDia = null, hoy, toca = null, estado = null, racha = 0, record = null, haceMucho = false } = {}) {
  const pila = nombreDePila(nombre);
  if (rol === 'coach') return { saludo: 'Valar morghulis,', nombre: 'coach supremo', mensaje: 'Tus atletas te esperan.' };
  if (primeraVez) return { saludo: 'Hola,', nombre: pila, mensaje: toca ? `Tu primera sesión te espera: ${toca}.` : 'Aquí verás cada día lo que te toca. Empezamos cuando quieras.' };
  const saludo = 'Hola de nuevo,';
  const dias = ultimoDia && hoy ? diasEntre(ultimoDia, hoy) : null;
  const conRacha = racha >= 2 ? `Llevas ${racha} semanas completas seguidas.` : null;
  if (record?.ejercicio && record.fecha && hoy && diasEntre(record.fecha, hoy) >= 0 && diasEntre(record.fecha, hoy) <= 2) {
    return { saludo, nombre: pila, mensaje: `Vienes de un récord en ${record.ejercicio}. ¡A por más!`, detalle: toca ? `Hoy toca ${toca}.` : null };
  }
  if (haceMucho && dias == null) return { saludo, nombre: pila, mensaje: 'Hace tiempo de tu último entreno. ¿Retomamos hoy?', detalle: toca ? `Te espera ${toca}.` : null };
  if (dias != null && dias >= 7) return { saludo, nombre: pila, mensaje: `Llevas ${dias} días sin entrenar. ¿Retomamos hoy?`, detalle: toca ? `Te espera ${toca}.` : null };
  if (dias != null && dias >= 4) return { saludo, nombre: pila, mensaje: `Hace ${dias} días de tu último entreno: hoy es buen día para volver.`, detalle: toca ? `Te espera ${toca}.` : null };
  if (estado === 'hecha') return { saludo, nombre: pila, mensaje: 'La sesión de hoy ya está hecha. ¡Buen trabajo!', detalle: conRacha };
  if (estado === 'descanso') return { saludo, nombre: pila, mensaje: 'Hoy toca descanso: recupera bien.', detalle: conRacha };
  if (estado === 'semana') return { saludo, nombre: pila, mensaje: 'Semana completa. ¡Enhorabuena!', detalle: conRacha };
  // (diseño, tanda 14) quien solo lleva nutrición: no hay sesión que anunciar
  if (estado === 'nutricion') return { saludo, nombre: pila, mensaje: 'Este es tu día de hoy.' };
  if (toca) return { saludo, nombre: pila, mensaje: `Hoy toca ${toca}.`, detalle: conRacha };
  return { saludo, nombre: pila, mensaje: conRacha || '¿Qué toca hoy?' };
}

// ---------- Tanda 11 de diseño: el panel de la bienvenida ----------
// Debajo del saludo, cómo va: lo que toca (o lo siguiente), tres cifras (la semana, la racha y el bloque), sus últimas
// 12 semanas y una frase de ánimo. Todo con lo que Hoy ya ha cargado (la constancia, el programa y la sesión que
// sigue): ni una consulta más. Lo puro: qué sale y qué dice.
const lista = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`);
const lunesISO = (iso) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const masDias = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Las últimas n semanas (de lunes a domingo), de la más antigua a la de hoy. semanas: [{ fecha_inicio, total, hechas }]
// (las de la constancia). Cada una: 'completa', 'parcial', 'vacia' (tenía sesiones y no hizo ninguna) o 'sin' (nada programado).
export function ultimasSemanas(semanas = [], hoy, n = 12) {
  if (!hoy) return [];
  const por = new Map();
  for (const s of semanas || []) {
    if (!s?.fecha_inicio || !(s.total > 0)) continue;
    const k = lunesISO(s.fecha_inicio);
    const x = por.get(k) || { total: 0, hechas: 0 };
    x.total += s.total; x.hechas += s.hechas || 0;
    por.set(k, x);
  }
  const actual = lunesISO(hoy);
  return Array.from({ length: n }, (_, i) => {
    const lunes = masDias(actual, -7 * (n - 1 - i));
    const x = por.get(lunes);
    return { lunes, actual: lunes === actual, estado: !x ? 'sin' : x.hechas >= x.total ? 'completa' : x.hechas > 0 ? 'parcial' : 'vacia' };
  });
}

// La racha más larga de semanas completas seguidas (la semana de hoy, a medias, no la rompe)
export function mejorRacha(semanas = [], hoy) {
  let max = 0, n = 0;
  for (const s of ultimasSemanas(semanas, hoy, 104)) {
    if (s.estado === 'completa') { n++; max = Math.max(max, n); } else if (s.estado !== 'sin' && !s.actual) n = 0;
  }
  return max;
}

// estado: 'entreno' | 'descanso' | 'hecha' | 'semana' (como la tarjeta de Hoy). sigue: la sesión de hoy o la siguiente
// ({ nombre, minutos, ejercicios, grupos }) o null. semana: { hechas, objetivo } o null. bloque: { semana, de } o null
// (de: las semanas del bloque si se saben por sus fechas; si no, null y sale solo por cuál va).
// Devuelve { sesion: { sobre, titulo, meta } | null, cifras: [{ id, etiqueta, valor, de, detalle, puntos, barra }],
// semanas: [...12] (vacío si aún no hay historia), completas, animo }.
export function panelBienvenida({ hoy, estado = null, sigue = null, semana = null, racha = 0, semanas = [], bloque = null, ultimoDia = null, primeraVez = false, haceMucho = false } = {}) {
  const dias = ultimoDia && hoy ? diasEntre(ultimoDia, hoy) : null;
  const lejos = (dias != null && dias >= 4) || (haceMucho && dias == null);
  const hoyToca = estado === 'entreno';
  const sesion = sigue?.nombre ? {
    sobre: !hoyToca ? 'Lo siguiente' : primeraVez ? 'Tu primera sesión' : lejos ? 'Te espera' : 'Hoy',
    titulo: sigue.nombre,
    meta: [sigue.minutos > 0 ? `Unos ${sigue.minutos} min` : null,
      sigue.ejercicios > 0 ? `${sigue.ejercicios} ${sigue.ejercicios === 1 ? 'ejercicio' : 'ejercicios'}` : null,
      sigue.grupos?.length ? lista(sigue.grupos.map((g, i) => (i ? g.toLowerCase() : g))) : null].filter(Boolean).join(' · ') || null,
  } : null;
  const mejor = mejorRacha(semanas, hoy);
  const cifras = [];
  const objetivo = semana?.objetivo > 0 ? semana.objetivo : 0;
  const hechas = objetivo ? Math.min(semana.hechas || 0, objetivo) : 0;
  if (objetivo) cifras.push({ id: 'semana', etiqueta: 'Semana', valor: hechas, de: objetivo, puntos: objetivo <= 7 ? objetivo : 0, barra: objetivo > 7 ? hechas / objetivo : null });
  if (racha >= 1 || mejor < 1) cifras.push({ id: 'racha', etiqueta: 'Racha', valor: racha, detalle: racha === 1 ? 'semana completa' : racha > 1 ? 'semanas completas' : 'empieza esta semana' });
  else cifras.push({ id: 'racha', etiqueta: 'Mejor racha', valor: mejor, detalle: mejor === 1 ? 'semana completa' : 'semanas completas' });
  if (bloque?.semana > 0 && bloque.de >= bloque.semana) cifras.push({ id: 'bloque', etiqueta: 'Bloque', valor: bloque.semana, de: bloque.de, barra: bloque.semana / bloque.de });
  else if (bloque?.semana > 0) cifras.push({ id: 'bloque', etiqueta: 'Bloque', valor: bloque.semana, detalle: 'semana en curso' });
  const doce = ultimasSemanas(semanas, hoy, 12);
  const conHistoria = doce.filter((s) => s.estado !== 'sin').length >= 2;
  const completas = doce.filter((s) => s.estado === 'completa').length;
  const faltan = objetivo ? objetivo - hechas : 0;
  let animo;
  if (primeraVez) animo = 'Tu historial empieza hoy: cada sesión cuenta desde aquí.';
  else if (estado === 'semana' || (objetivo && !faltan)) animo = racha >= 2 ? `Semana completa: ya van ${racha} seguidas.` : 'Semana completa. Así se construye una racha.';
  else if (lejos) animo = 'Una sesión hoy y esta semana ya cuenta.';
  else if (hoyToca && faltan === 1) animo = racha >= 1 ? `Con la de hoy completas la semana: serían ${racha + 1} seguidas.` : 'Con la de hoy completas la semana.';
  else if (estado === 'hecha' && faltan > 0) animo = `Hecha la de hoy. Te ${faltan === 1 ? 'queda una' : `quedan ${faltan}`} para completar la semana.`;
  else if (estado === 'descanso' && faltan > 0) animo = `Te ${faltan === 1 ? 'queda una sesión' : `quedan ${faltan} sesiones`} para completar la semana.`;
  else if (hoyToca && objetivo && hechas === 0) animo = 'La primera de la semana: la que lo pone todo en marcha.';
  else if (hoyToca && objetivo) animo = `Llevas ${hechas} de ${objetivo} esta semana. A por la siguiente.`;
  else if (completas >= 8) animo = `${completas} de tus últimas 12 semanas, completas. Eso es constancia.`;
  else animo = 'Cada sesión que apuntas suma.';
  return { sesion, cifras, semanas: conHistoria ? doce : [], completas, animo };
}

// El panel del coach, con lo que su app ya ha cargado: la bandeja de Revisar ({ total, sesiones, checkins, archivos… }),
// los mensajes sin leer y, si la lista de atletas ya está, cuántos han entrenado hoy y cuántos necesitan atención.
// Lo que aún no ha llegado (null) no sale.
export function panelCoach({ bandeja = null, sinLeer = null, equipo = null, atencion = null } = {}) {
  const cifras = [];
  if (bandeja) {
    const partes = [[bandeja.sesiones?.length, 'sesión', 'sesiones'], [bandeja.checkins?.length, 'check-in', 'check-ins'], [bandeja.archivos?.length, 'vídeo', 'vídeos'], [bandeja.comentarios?.length, 'mensaje', 'mensajes'], [bandeja.tareas?.length, 'tarea', 'tareas'], [bandeja.recetas?.length, 'receta', 'recetas']]
      .filter(([n]) => n > 0).slice(0, 3).map(([n, uno, varios]) => `${n} ${n === 1 ? uno : varios}`);
    cifras.push({ id: 'revisar', etiqueta: 'Por revisar', valor: bandeja.total || 0, detalle: bandeja.total ? lista(partes) || 'esperan tu respuesta' : 'todo al día' });
  }
  if (sinLeer != null) cifras.push({ id: 'mensajes', etiqueta: 'Mensajes sin leer', valor: sinLeer, detalle: sinLeer ? 'en tus conversaciones' : 'ninguno pendiente' });
  if (equipo?.activos > 0) cifras.push({ id: 'hoy', etiqueta: 'Han entrenado hoy', valor: equipo.entrenaron || 0, de: equipo.activos, barra: (equipo.entrenaron || 0) / equipo.activos });
  if (atencion != null) cifras.push({ id: 'atencion', etiqueta: 'Necesitan atención', valor: atencion, detalle: atencion ? 'mira sus avisos en Atletas' : 'nadie por ahora' });
  let animo = null;
  if (equipo?.activos > 0) {
    const semana = equipo.activos - (equipo.inactivos?.length || 0);
    animo = semana >= equipo.activos ? 'Todos tus atletas han entrenado en la última semana.' : `${semana} de tus ${equipo.activos} atletas han entrenado en la última semana.`;
  }
  return { sesion: null, cifras, semanas: [], completas: 0, animo };
}
<<<<<<< HEAD

// Quien solo lleva nutrición (tanda 14): su menú de hoy, las comidas hechas, los días en objetivo de la semana y la
// semana día a día. menu: las comidas de hoy de su menú ([{ hecho }]); objetivo: el del día ({ kcal, proteina }) o null
// (plan sin contar o sin plan); semana: la de semanaNutricion ({ dias: [{ iso, estado, futuro, hoy, reg }], enObjetivo,
// transcurridos, registrados }) o null. Lo que no hay, no sale.
export function panelNutricion({ menu = [], objetivo = null, semana = null } = {}) {
  const total = (menu || []).length;
  const hechas = (menu || []).filter((e) => e?.hecho).length;
  const kcal = objetivo?.kcal > 0 ? `${new Intl.NumberFormat('es-ES').format(Math.round(objetivo.kcal))} kcal` : null;
  const prote = objetivo?.proteina > 0 ? `${Math.round(objetivo.proteina)} g de proteína` : null;
  const sesion = total || kcal ? {
    sobre: total ? 'Tu menú de hoy' : 'Tu plan de hoy',
    titulo: total ? `${total} ${total === 1 ? 'comida' : 'comidas'}` : kcal,
    meta: total ? ([kcal, prote].filter(Boolean).join(' · ') ? `Objetivo: ${[kcal, prote].filter(Boolean).join(' · ')}` : null) : prote,
  } : null;
  const cifras = [];
  if (total) cifras.push({ id: 'comidas', etiqueta: 'Comidas', valor: hechas, de: total, puntos: total <= 7 ? total : 0, barra: total > 7 ? hechas / total : null });
  const cuenta = !!semana && (semana.dias || []).some((d) => d.obj);
  if (cuenta && semana.transcurridos > 0) cifras.push({ id: 'objetivo', etiqueta: 'En objetivo', valor: semana.enObjetivo || 0, de: semana.transcurridos, detalle: 'días esta semana' });
  const dias = cuenta ? (semana.dias || []).map((d) => ({
    lunes: d.iso, actual: !!d.hoy,
    estado: d.futuro || !d.reg ? 'sin' : d.estado === 'si' ? 'completa' : d.estado === 'casi' || d.estado === 'en_curso' ? 'parcial' : 'vacia',
  })) : [];
  const enObjetivo = cuenta ? semana.enObjetivo || 0 : 0;
  let animo;
  if (total && hechas === total) animo = 'Menú de hoy completo. Buen trabajo.';
  else if (enObjetivo >= 2) animo = `${enObjetivo} días en objetivo esta semana. Sigue así.`;
  else if (cuenta && !semana.registrados && semana.transcurridos > 1) animo = 'Apunta lo de hoy y la semana empieza a contar.';
  else animo = 'Cada comida que marcas le dice a tu coach cómo vas.';
  return { sesion, cifras, semanas: [], completas: 0, dias, enObjetivo, animo };
}
=======
>>>>>>> origin/main
