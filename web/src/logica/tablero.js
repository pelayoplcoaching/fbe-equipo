// Cálculos de las piezas visuales de la v0.51 (sin pantalla, para poder probarlos): los tres diales de Hoy
// (constancia, carga y cómo llegas), los anillos de la semana de Progreso y cuándo celebrar uno, el metal de cada
// medalla, la barra por ejercicios de la sesión, la franja «Hoy en tu equipo» del coach y quién ha compartido un
// entreno hoy en la comunidad.
import { lunesDe, sumarDias, diasEntre, fechaMadrid } from './fechas.js';
import { completa, consejoPreparacion, PREGUNTAS } from './preparacion.js';
import { gruposSuperserie } from './calculos.js';
import { seriesPautadasHechas } from './visual.js';

const lim = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

// ---------- Hoy: los diales ----------
// Constancia: sesiones hechas de las publicadas esta semana. v0.53: con objetivo de días por semana (microciclos), la
// semana natural de semanasObjetivo() ({ hechas, objetivo }; null si no hay nada que hacer en ella).
export function dialConstancia(sesiones = [], semanaNatural = undefined) {
  const natural = semanaNatural !== undefined;
  const total = natural ? semanaNatural?.objetivo || 0 : (sesiones || []).length;
  const hechas = natural ? semanaNatural?.hechas || 0 : (sesiones || []).filter((s) => s.completada).length;
  return {
    id: 'constancia', valor: total ? lim(hechas / total) : 0, hechas, total, cifra: `${hechas}/${total}`,
    estado: !total ? 'sin' : hechas >= total ? 'completa' : hechas ? 'en_curso' : 'sin_empezar',
    etiqueta: !total ? 'Sin sesiones' : hechas >= total ? 'Semana completa' : `${total - hechas === 1 ? 'Te queda 1' : `Te quedan ${total - hechas}`}`,
  };
}

// Carga: la de esta semana (RPE de la sesión × minutos, como cargaSemanal) hasta hoy, frente a lo que solía llevar a
// estas alturas de la semana en las `semanas` anteriores (la media de lo acumulado hasta el mismo día de la semana).
// Así un lunes no sale «por debajo» solo porque la semana acaba de empezar. Hacen falta al menos dos semanas con
// carga. La banda «En tu media» va de 0,8 a 1,3 veces lo habitual (la zona de Gabbett, 2016, para el cociente agudo:
// crónico). Es descriptivo: para mirarlo, no un diagnóstico.
export const BANDA_CARGA = [0.8, 1.3];
const cargaDe = (s) => (s?.completada && s.fecha_realizada && Number(s.rpe_sesion) > 0 && Number(s.duracion_min) > 0 ? Number(s.rpe_sesion) * Number(s.duracion_min) : 0);
export function dialCarga(sesiones = [], hoy, semanas = 4) {
  const lunes = lunesDe(hoy);
  const dia = lim(diasEntre(lunes, hoy), 0, 6);
  const suma = (desde, hasta) => (sesiones || []).filter((s) => s.fecha_realizada >= desde && s.fecha_realizada <= hasta).reduce((t, s) => t + cargaDe(s), 0);
  const actual = Math.round(suma(lunes, hoy));
  const previas = Array.from({ length: semanas }, (_, i) => {
    const l = sumarDias(lunes, -7 * (i + 1));
    return { lunes: l, semana: suma(l, sumarDias(l, 6)), hastaHoy: suma(l, sumarDias(l, dia)) };
  }).filter((w) => w.semana > 0);
  const base = { id: 'carga', actual, semanas: previas.length };
  if (previas.length < 2) return { ...base, estado: 'sin_media', valor: 0, ratio: null, esperado: null, etiqueta: 'Sin media aún' };
  const esperado = Math.round(previas.reduce((t, w) => t + w.hastaHoy, 0) / previas.length);
  const mediaSemana = Math.round(previas.reduce((t, w) => t + w.semana, 0) / previas.length);
  // Sin nada a estas alturas de otras semanas: si hoy tampoco hay, va como siempre; si hay, por encima
  const ratio = esperado > 0 ? Math.round((actual / esperado) * 100) / 100 : actual > 0 ? 2 : 1;
  const estado = ratio < BANDA_CARGA[0] ? 'debajo' : ratio > BANDA_CARGA[1] ? 'encima' : 'media';
  return {
    ...base, estado, ratio, esperado, mediaSemana,
    // La aguja: lo habitual en el centro; el doble (o más), al final
    valor: lim(ratio / 2),
    etiqueta: estado === 'debajo' ? 'Por debajo' : estado === 'encima' ? 'Por encima' : 'En tu media',
  };
}

// Cómo llegas: lo que contestó hoy en «¿Cómo llegas hoy?» (sueño, energía y molestias, de 1 a 3 cada una).
// La regla, la misma en el dial y en la sesión (prepDeHoy): la base no guarda cuándo se contestó (la sesión no tiene
// una columna con la hora y la forma de «preparacion» es fija), así que lo guardado solo vale como de hoy si la sesión
// se terminó hoy, si tiene alguna serie de hoy (se contesta antes de la primera) o si se contestó hoy en este móvil.
// Si no, la sesión vuelve a preguntar (y lo de otro día no se le enseña al coach como de hoy).
// marcadas: los id de las sesiones contestadas hoy en este móvil; seriesHoy: los id de las que tienen series de hoy.
export function prepDeHoy(sesion, hoy, { marcadas = [], seriesHoy = [] } = {}) {
  if (!sesion || !completa(sesion.preparacion)) return false;
  if (sesion.completada) return sesion.fecha_realizada === hoy;
  return (seriesHoy || []).includes(sesion.id) || (marcadas || []).includes(sesion.id);
}
export function preparacionDeHoy(sesiones = [], hoy, conocidas = {}) {
  const conRespuesta = (sesiones || []).filter((s) => prepDeHoy(s, hoy, conocidas));
  // La de una sesión en curso manda sobre la de una ya hecha (es la última que ha contestado)
  return (conRespuesta.find((s) => !s.completada) || conRespuesta[conRespuesta.length - 1])?.preparacion || null;
}
// A qué sesión se le puede contestar hoy desde Hoy: la prevista para hoy (o una que ya tiene series de hoy), sin hacer
// y nunca de baja. Sin ninguna, el dial no ofrece contestar (se contesta al empezar la sesión, el día que se haga).
export function sesionParaContestar({ previstaHoy = null, siguiente = null, seriesHoy = [], baja = false } = {}) {
  if (baja) return null;
  if (previstaHoy && !previstaHoy.completada) return previstaHoy;
  if (siguiente && !siguiente.completada && (seriesHoy || []).includes(siguiente.id)) return siguiente;
  return null;
}
// ¿Alguna serie de hoy? (hora de Madrid, como la base)
export const conSeriesDeHoy = (hechas = [], hoyMadrid = fechaMadrid()) => (hechas || []).some((s) => s?.registrada_en && fechaMadrid(new Date(s.registrada_en)) === hoyMadrid);
export function dialComoLlegas(prep) {
  if (!completa(prep)) return { id: 'llegas', estado: 'sin_respuesta', valor: 0, etiqueta: 'Sin contestar', respuestas: [] };
  const c = consejoPreparacion(prep);
  const total = prep.sueno + prep.energia + prep.molestias;
  return {
    id: 'llegas', estado: c.nivel, valor: lim((total - 3) / 6), etiqueta: c.titulo, total,
    respuestas: PREGUNTAS.map((q) => ({ id: q.id, pregunta: q.texto, valor: prep[q.id], texto: Object.fromEntries(q.opciones)[prep[q.id]] })),
  };
}

// (v0.140) Comida: lo que lleva apuntado hoy frente a las kcal de su plan para hoy (objetivoDelDia). null sin plan con kcal.
// Se pasa un 5 % y sigue «en tu objetivo»; a menos de un 10 % de llegar, también.
export function dialComida(objetivo, registro = null) {
  const meta = Number(objetivo?.kcal);
  if (!(meta > 0)) return null;
  const comido = Math.max(0, Number(registro?.kcal) || 0);
  const quedan = Math.round(meta - comido);
  const proteina = Number(objetivo?.proteina) > 0 ? Math.max(0, Math.round(Number(objetivo.proteina) - (Number(registro?.proteina_g) || 0))) : null;
  const estado = comido === 0 ? 'sin_apuntar' : quedan > meta * 0.1 ? 'queda' : quedan >= -meta * 0.05 ? 'en_objetivo' : 'pasado';
  const etiqueta = { sin_apuntar: 'Sin apuntar', queda: 'Te quedan', en_objetivo: 'En tu objetivo', pasado: 'Por encima' }[estado];
  return { id: 'comida', estado, valor: lim(comido / meta), etiqueta, objetivo: Math.round(meta), comido: Math.round(comido), quedan, proteina };
}
// (v0.140) Pasos: los de hoy (de Salud, por Conexiones) frente a su media de los 14 días anteriores (con 3 días al menos).
// No es un objetivo: el dial se llena al llegar a su media. null si hoy no ha llegado nada.
export function dialPasos(dias = [], hoy) {
  const d = (dias || []).find((x) => x?.fecha === hoy);
  const pasos = d && d.pasos != null ? Math.max(0, Math.round(Number(d.pasos))) : null;
  if (pasos == null || !Number.isFinite(pasos)) return null;
  const desde = sumarDias(hoy, -14);
  const previos = (dias || []).filter((x) => x?.fecha >= desde && x.fecha < hoy && Number(x.pasos) > 0).map((x) => Number(x.pasos));
  const media = previos.length >= 3 ? Math.round(previos.reduce((a, b) => a + b, 0) / previos.length) : null;
  const estado = media == null ? 'sin_media' : pasos >= media ? 'en_media' : 'por_debajo';
  const etiqueta = media == null ? 'Hoy' : pasos >= media ? 'Ya en tu media' : 'Hacia tu media';
  return { id: 'pasos', estado, valor: media ? lim(pasos / media) : 0, etiqueta, pasos, media, dias: previos.length };
}
// Cuántos pasos caben en el centro de un dial: 8432 → «8,4» (mil); por debajo de mil, tal cual
export function pasosCortos(n) {
  const x = Math.max(0, Math.round(Number(n) || 0));
  if (x < 1000) return { cifra: String(x), unidad: '' };
  const mil = x / 1000;
  return { cifra: (mil >= 10 ? String(Math.round(mil)) : mil.toFixed(1).replace('.', ',')), unidad: 'mil' };
}

// La forma de un dial de 270° (abierto por abajo), en un cuadrado de `tam`: el trazo de la pista y la longitud del
// arco para una fracción (stroke-dasharray), y dónde va un punto en esa fracción (la aguja de la carga)
export function arcoDial(frac, tam = 64, grosor = 7) {
  const r = (tam - grosor) / 2, c = tam / 2;
  const largo = (2 * Math.PI * r * 270) / 360;
  const ang = (a) => ((135 + a * 270) * Math.PI) / 180;
  const punto = (a) => ({ x: Math.round((c + r * Math.cos(ang(a))) * 100) / 100, y: Math.round((c + r * Math.sin(ang(a))) * 100) / 100 });
  const ini = punto(0), fin = punto(1);
  return {
    r, largo, lleno: largo * lim(frac),
    d: `M${ini.x} ${ini.y}A${r} ${r} 0 1 1 ${fin.x} ${fin.y}`,
    punto: punto(lim(frac)), puntoEn: punto,
  };
}

// ---------- Progreso: los anillos de la semana ----------
// sesiones: las de la semana publicada; habitos: los resúmenes de resumenHabito (null si no tiene); checkin: el de la
// semana (o null); conCheckin: si le toca check-in (con el consentimiento de salud).
// v0.53: semanaNatural, la de semanasObjetivo() para quien tiene objetivo de días por semana (el anillo de sesiones va
// hasta ese objetivo, de lunes a domingo)
export function anillosSemana({ sesiones = [], habitos = null, checkin = null, conCheckin = true, semanaNatural = undefined } = {}) {
  const out = [];
  const natural = semanaNatural !== undefined;
  const total = natural ? semanaNatural?.objetivo || 0 : (sesiones || []).length;
  const hechas = natural ? semanaNatural?.hechas || 0 : (sesiones || []).filter((s) => s.completada).length;
  out.push({ id: 'sesiones', nombre: 'Sesiones', valor: hechas, objetivo: total, frac: total ? lim(hechas / total) : 0, cerrado: total > 0 && hechas >= total, texto: `${hechas} de ${total}` });
  const hs = (habitos || []).filter((h) => h?.semana?.pedidos > 0);
  if (hs.length) {
    const pedidos = hs.reduce((t, h) => t + h.semana.pedidos, 0);
    const cumplidos = hs.reduce((t, h) => t + Math.min(h.semana.cumplidos, h.semana.pedidos), 0);
    out.push({ id: 'habitos', nombre: 'Hábitos', valor: cumplidos, objetivo: pedidos, frac: lim(cumplidos / pedidos), cerrado: hs.every((h) => h.semana.cumplidos >= h.semana.pedidos), texto: `${cumplidos} de ${pedidos} días` });
  }
  if (conCheckin) out.push({ id: 'checkin', nombre: 'Check-in', valor: checkin ? 1 : 0, objetivo: 1, frac: checkin ? 1 : 0, cerrado: !!checkin, texto: checkin ? 'Enviado' : 'Pendiente' });
  return out;
}
// Qué anillos celebrar ahora: los cerrados esta semana que este móvil aún no ha celebrado (una vez por anillo y
// semana). guardado: lo que se guardó en el móvil ({ lunes, cerrados }); devuelve también lo que hay que guardar.
export function anillosPorCelebrar(anillos = [], guardado = null, lunes) {
  const previos = guardado && guardado.lunes === lunes && Array.isArray(guardado.cerrados) ? guardado.cerrados.filter((x) => typeof x === 'string') : [];
  const celebrar = anillos.filter((a) => a.cerrado && !previos.includes(a.id)).map((a) => a.id);
  return { celebrar, guardar: { lunes, cerrados: [...new Set([...previos, ...celebrar])] } };
}

// ---------- Logros: el metal de cada nivel ----------
// Los cuatro niveles de siempre (los umbrales no cambian), como medallas: bronce, plata, oro y diamante (antes platino; el id
// sigue siendo «platino», que es el de los estilos). Cada metal
// tiene además su canto (liso, perlado, estriado y doble), para distinguirlos sin el color.
export const METALES = [
  { n: 1, id: 'bronce', nombre: 'Bronce', canto: 'liso' },
  { n: 2, id: 'plata', nombre: 'Plata', canto: 'perlado' },
  { n: 3, id: 'oro', nombre: 'Oro', canto: 'estriado' },
  { n: 4, id: 'platino', nombre: 'Diamante', canto: 'doble' },
];
export const metalDe = (nivel) => METALES[Number(nivel) - 1] || null;

// ---------- Sesión: la barra por ejercicios ----------
// Un tramo por ejercicio (o por superserie): sus series pautadas hechas de las pautadas. actualId: el ejercicio de la
// serie que toca (su tramo va resaltado).
export function tramosSesion(ejercicios = [], hechas = {}, actualId = null) {
  return gruposSuperserie(ejercicios || []).map((g) => {
    const series = g.items.reduce((t, e) => t + Math.max(0, Number(e.series) || 0), 0);
    const hechasN = g.items.reduce((t, e) => t + seriesPautadasHechas(e, hechas[e.id] || {}), 0);
    return {
      id: g.items[0].id, ids: g.items.map((e) => e.id), letra: g.letra || null,
      series, hechas: hechasN, frac: series ? lim(hechasN / series) : 0,
      actual: !!actualId && g.items.some((e) => e.id === actualId), completo: series > 0 && hechasN >= series,
    };
  });
}

// ---------- Coach: «Hoy en tu equipo» ----------
// Con los resúmenes que ya carga el panel: de los activos que entrenan (no los de solo nutrición), cuántos han
// entrenado hoy (una serie o una sesión terminada hoy) y quién lleva 7 días o más sin actividad (o, sin nada
// registrado, los que ya tienen el aviso de no haber empezado).
export const ultimaActividad = (r) => [r?.ultimaSerie, r?.ultimaSesion].filter(Boolean).sort().at(-1) || null;
export function equipoHoy(resumenes = [], hoy) {
  const activos = (resumenes || []).filter((r) => r.estado === 'activo' && r.servicio !== 'nutricion');
  const hoyIds = activos.filter((r) => ultimaActividad(r) === hoy).map((r) => r.atleta_id);
  const inactivos = activos.filter((r) => {
    const u = ultimaActividad(r);
    return u ? diasEntre(u, hoy) >= 7 : (r.alertas || []).some((a) => a.tipo === 'sin_entrenar');
  }).map((r) => r.atleta_id);
  return { activos: activos.length, entrenaron: hoyIds.length, entrenaronIds: hoyIds, inactivos };
}

// ---------- Comunidad: quién ha compartido un entreno hoy ----------
// Solo con lo que ya se ve en el muro (los entrenos compartidos, con su hora): nada nuevo de nadie.
export function compartieronHoy(posts = [], hoy) {
  return new Set((posts || []).filter((p) => p && p.tipo === 'entreno' && !p.oculta && p.creado_en && fechaMadrid(new Date(p.creado_en)) === hoy).map((p) => p.autor_id));
}
