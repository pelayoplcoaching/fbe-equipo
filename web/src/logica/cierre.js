// Tanda «cierre» (migración 054): lo que el coach necesita de cada entreno, sin pedirlo dos veces. Lo que se calcula sin la
// base: la duración desde las series, el esfuerzo medio, los hábitos sugeridos, el borrador de la revisión semanal, el
// mensaje para pedir lo que falta, los chips del resumen del chat, «tu semana de un vistazo» del check-in y su borrador.
import { textoPlano } from './formato.js';
import { fechaMadrid, fmtCorta, diasEntre, lunesDe, sumarDias } from './fechas.js';

const num = (v, d = 1) => (v == null || !Number.isFinite(Number(v)) ? '' : Number(v).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: d }));

// ---------------------------------------------------------------- la sesión
// La duración de la sesión según las series guardadas: de la primera a la última más 5 minutos (entre 5 y 300). null sin series
export function duracionDesdeSeries(hechas = {}) {
  const t = [];
  for (const porEj of Object.values(hechas || {})) for (const s of Object.values(porEj || {})) { const x = Date.parse(s?.registrada_en || s?.creado_en || ''); if (Number.isFinite(x)) t.push(x); }
  if (t.length < 2) return null;
  const min = Math.ceil((Math.max(...t) - Math.min(...t)) / 60000) + 5;
  return Math.max(5, Math.min(300, min));
}
// El esfuerzo medio de las series (RPE > 0), redondeado a entero; null si ninguna lo lleva
export function rpeMedioSeries(hechas = {}) {
  const v = [];
  for (const porEj of Object.values(hechas || {})) for (const s of Object.values(porEj || {})) { const r = Number(s?.rpe); if (Number.isFinite(r) && r > 0) v.push(r); }
  if (!v.length) return null;
  return Math.min(10, Math.max(5, Math.round(v.reduce((a, b) => a + b, 0) / v.length)));
}
// La frase del RPE de la sesión (5 a 10)
export const FRASES_RPE = ['Cómoda', 'Moderada', 'Exigente', 'Dura', 'Muy dura', 'Máxima'];
export const fraseRpe = (rpe) => (rpe >= 5 && rpe <= 10 ? FRASES_RPE[rpe - 5] : '');

// «La cerramos por ti el martes»: si la sesión se cerró sola (054) y hace menos de N días
export function textoCierreAuto(s, hoy = fechaMadrid(), { dias = 3 } = {}) {
  if (!s?.cerrada_sola_en) return null;
  const f = fechaMadrid(new Date(s.cerrada_sola_en));
  if (diasEntre(f, hoy) > dias) return null;
  const sinRpe = s.rpe_sesion == null;
  return { fecha: f, titulo: `Cerramos ${s.nombre || 'tu sesión'} por ti`, texto: sinRpe ? 'Tenías todas las series hechas. ¿Cómo fue? Dinos el esfuerzo y, si quieres, una nota.' : 'Tenías todas las series hechas; el esfuerzo lo estimamos con tus series. Si quieres, corrígelo o añade una nota.' };
}

// ---------------------------------------------------------------- hábitos sugeridos
// Los que la app propone según el cuestionario (lo que puso el atleta). Cada uno, lo que necesita habito_sugerido_activar
export const HABITOS_SUGERIDOS = [
  { clave: 'pasos', nombre: 'Pasos al día', tipo: 'numero', objetivo: 8000, unidad: 'pasos', sentido: 'al_menos', dias: 7, icono: 'pasos', porque: 'Mueve el gasto diario sin cansar' },
  { clave: 'proteina', nombre: 'Proteína en cada comida', tipo: 'si_no', objetivo: null, unidad: null, sentido: 'al_menos', dias: 7, icono: 'proteina', porque: 'Lo que más ayuda a ganar o conservar músculo' },
  { clave: 'sueno', nombre: 'Dormir 7 horas', tipo: 'numero', objetivo: 7, unidad: 'h', sentido: 'al_menos', dias: 7, icono: 'sueno', porque: 'Donde se recupera lo que entrenas' },
  { clave: 'movilidad', nombre: 'Movilidad 10 minutos', tipo: 'si_no', objetivo: null, unidad: null, sentido: 'al_menos', dias: 4, icono: 'movilidad', porque: 'Para las zonas que te molestan' },
  { clave: 'agua', nombre: 'Agua: 2 litros', tipo: 'numero', objetivo: 2, unidad: 'l', sentido: 'al_menos', dias: 7, icono: 'agua', porque: 'Lo que más se olvida los días de oficina' },
  { clave: 'verdura', nombre: 'Verdura en dos comidas', tipo: 'si_no', objetivo: null, unidad: null, sentido: 'al_menos', dias: 6, icono: 'verdura', porque: 'Saciedad y fibra sin contar nada' },
];
// Según el cuestionario: objetivos (perder grasa, ganar músculo, salud…), molestias y lo que ya tiene. Hasta 3, sin repetir
// los que ya tiene (por nombre o icono). Sin cuestionario, los tres básicos.
export function habitosSugeridos(cuestionario = null, existentes = []) {
  const tiene = new Set((existentes || []).filter((h) => h.activo !== false).flatMap((h) => [String(h.nombre || '').toLowerCase(), h.icono]));
  const obj = [].concat(cuestionario?.objetivos || []).map((x) => String(x).toLowerCase());
  const molestias = [].concat(cuestionario?.lesiones || []).filter((l) => l?.zona && l.limita !== 'No me limita');
  const orden = ['proteina', 'pasos', 'sueno'];
  if (obj.some((o) => /grasa|perder|definir|bajar/.test(o))) orden.unshift('pasos', 'verdura');
  if (obj.some((o) => /m[u\u00fa]sculo|masa|fuerza|ganar/.test(o))) orden.unshift('proteina', 'sueno');
  if (molestias.length) orden.unshift('movilidad');
  if (Number(cuestionario?.sueno_horas) > 0 && Number(cuestionario.sueno_horas) < 7) orden.unshift('sueno');
  const vistos = new Set();
  const out = [];
  for (const k of orden) {
    if (vistos.has(k)) continue; vistos.add(k);
    const h = HABITOS_SUGERIDOS.find((x) => x.clave === k);
    if (!h || tiene.has(h.nombre.toLowerCase()) || tiene.has(h.icono)) continue;
    out.push(h);
    if (out.length === 3) break;
  }
  return out;
}

// ---------------------------------------------------------------- la revisión semanal: el borrador del mensaje
// f: la fila de la revisión (nombre, sesiones {completadas,total}, checkin, molestia, videos, mensajes, notaAnterior);
// r: el resumen de la semana (atleta_resumen_semana), si lo hay. Un mensaje corto, en el tono del coach, para retocar.
export function borradorRevision(f, r = null) {
  const nombre = String(f?.nombre || '').split(' ')[0] || 'Hola';
  const { completadas = 0, total = 0 } = f?.sesiones || {};
  const lineas = [`Hola, ${nombre}. Repaso de tu semana:`];
  if (total > 0 && completadas >= total) lineas.push(`✅ Las ${total} sesiones hechas. Muy bien.`);
  else if (completadas > 0) lineas.push(`${completadas} de ${total || '?'} sesiones hechas${total > completadas ? `: ${total - completadas === 1 ? 'una se queda' : `${total - completadas} se quedan`} para la que viene` : ''}.`);
  else if (total > 0) lineas.push('Esta semana no hemos podido entrenar. ¿Qué ha pasado? Lo ajustamos.');
  const rpe = r?.sesiones?.rpe_sesion ?? r?.sesiones?.rpe_series;
  if (rpe != null) lineas.push(rpe >= 8.5 ? `Esfuerzo medio ${num(rpe)}: alto. Vigila la recuperación esta semana.` : rpe <= 6 ? `Esfuerzo medio ${num(rpe)}: hay margen para apretar un poco.` : `Esfuerzo medio ${num(rpe)}: en su sitio.`);
  if (r?.sesiones?.toneladas) lineas.push(`${num(r.sesiones.series, 0)} series y ${num(r.sesiones.toneladas)} toneladas movidas.`);
  if (r?.peso?.kg != null) lineas.push(`Peso: ${num(r.peso.kg)} kg${r.peso.cambio_4s != null ? ` (${r.peso.cambio_4s > 0 ? '+' : ''}${num(r.peso.cambio_4s)} kg en 4 semanas)` : ''}.`);
  if (f?.molestia >= 3) lineas.push('Veo molestias fuertes en el check-in: cuéntame cómo va y adaptamos lo que haga falta.');
  else if (f?.molestia >= 2) lineas.push('Apuntaste alguna molestia: ojo con ella, y me dices.');
  if (!f?.checkin) lineas.push('Me falta tu check-in de la semana: son dos minutos y me ayuda a ajustarte el plan.');
  if (f?.videos > 0) lineas.push(f.videos === 1 ? 'Tengo tu vídeo de técnica: te lo comento en cuanto lo revise.' : `Tengo tus ${f.videos} vídeos de técnica: te los comento en cuanto los revise.`);
  if (f?.notaAnterior) lineas.push(`De la semana pasada: ${f.notaAnterior}`);
  lineas.push('Semana nueva, a por ella. 💪');
  return lineas.join('\n');
}

// ---------------------------------------------------------------- «pedírselo»: el mensaje hecho según el aviso del panel
export function mensajeParaAlerta(alerta, nombre = '') {
  const n = String(nombre || '').split(' ')[0];
  const hola = n ? `Hola, ${n}. ` : 'Hola. ';
  switch (alerta?.tipo) {
    case 'sin_checkin': return `${hola}Me falta tu check-in de la semana pasada: son dos minutos (en Check-in) y me ayuda a ajustarte el plan. ¿Me lo mandas hoy?`;
    case 'sin_entrenar': return `${hola}Veo que llevas unos días sin entrenar. ¿Todo bien? Si hace falta ajustamos la semana: dime qué días puedes y lo cuadramos.`;
    case 'sesion_abierta': return `${hola}Tienes una sesión empezada sin terminar en la app. Si ya la acabaste, entra y dale a «Terminar» (así me llega el esfuerzo y la duración).`;
    case 'sin_peso': return `${hola}Hace días que no apuntas el peso. Una mañana de estas, en ayunas, y lo apuntas en Progreso: me sirve para ver la tendencia.`;
    case 'molestia': return `${hola}Apuntaste molestias en el check-in. ¿Cómo va? Cuéntame dónde y cuándo duele y adaptamos lo que haga falta.`;
    case 'cumplimiento': return `${hola}Estas semanas se nos están quedando series sin hacer. ¿Vamos justos de tiempo o de energía? Dime y ajusto el volumen.`;
    case 'esfuerzo': return `${hola}Veo que te pasas del esfuerzo que te pido en bastantes series. Guárdate algo: el RPE que te pongo es a propósito.`;
    case 'habitos': return `${hola}Los hábitos se nos están quedando a medias. ¿Cuál se te hace más difícil? Lo cambiamos por algo que sí puedas.`;
    case 'programar': return null;
    default: return `${hola}¿Cómo va todo? Cuéntame.`;
  }
}

// ---------------------------------------------------------------- el resumen de la semana en el chat (coach)
// r: atleta_resumen_semana → chips cortos: [{ k, texto, nivel? }]
export function chipsResumenChat(r, hoy = fechaMadrid()) {
  if (!r) return [];
  const out = [];
  const s = r.sesiones || {};
  const previstas = Number(s.previstas) || 0, hechas = Number(s.hechas) || 0;
  out.push({ k: 'sesiones', texto: previstas ? `${hechas}/${previstas} ses.` : `${hechas} ses.`, nivel: previstas && hechas >= previstas ? 'ok' : hechas === 0 && previstas ? 'aviso' : '' });
  const rpe = s.rpe_sesion ?? s.rpe_series;
  if (rpe != null) out.push({ k: 'rpe', texto: `RPE ${num(rpe)}`, nivel: rpe >= 9 ? 'aviso' : '' });
  if (r.peso?.kg != null) out.push({ k: 'peso', texto: `${num(r.peso.kg)} kg${r.peso.cambio_4s != null ? ` (${r.peso.cambio_4s > 0 ? '+' : ''}${num(r.peso.cambio_4s)})` : ''}`, nivel: diasEntre(r.peso.fecha, hoy) > 10 ? 'aviso' : '' });
  else out.push({ k: 'peso', texto: 'Sin peso', nivel: 'aviso' });
  out.push(r.checkin ? { k: 'checkin', texto: `Check-in ${r.checkin.semana >= lunesDe(hoy) ? '✓' : fmtCorta(r.checkin.semana)}`, nivel: r.checkin.semana >= sumarDias(lunesDe(hoy), -7) ? 'ok' : 'aviso' } : { k: 'checkin', texto: 'Sin check-in', nivel: 'aviso' });
  if (Number(r.videos_sin_revisar)) out.push({ k: 'videos', texto: `${r.videos_sin_revisar} ${Number(r.videos_sin_revisar) === 1 ? 'vídeo' : 'vídeos'} sin revisar`, nivel: 'aviso' });
  if (Number(r.sesiones_abiertas)) out.push({ k: 'abiertas', texto: `${r.sesiones_abiertas} sin cerrar`, nivel: 'aviso' });
  return out;
}

// ---------------------------------------------------------------- el check-in: «tu semana de un vistazo» y el borrador
export function lineasSemanaCheckin(r) {
  if (!r?.sesiones) return [];
  const s = r.sesiones;
  const out = [];
  const previstas = Number(s.previstas) || 0, hechas = Number(s.hechas) || 0;
  out.push(previstas ? `${hechas} de ${previstas} sesiones hechas` : hechas ? `${hechas} ${hechas === 1 ? 'sesión hecha' : 'sesiones hechas'}` : 'Sin sesiones esta semana');
  const rpe = s.rpe_sesion ?? s.rpe_series;
  if (rpe != null) out.push(`Esfuerzo medio ${num(rpe)}`);
  if (s.toneladas) out.push(`${num(s.toneladas)} toneladas en ${num(s.series, 0)} series`);
  if (r.peso?.kg != null) out.push(`Último peso: ${num(r.peso.kg)} kg (${fmtCorta(r.peso.fecha)})`);
  return out;
}
const CLAVE_BORRADOR = (atletaId, lunes) => `fbe-checkin-borrador-${atletaId}-${lunes}`;
const CAMPOS_BORRADOR = ['horas_sueno', 'energia', 'recuperacion', 'motivacion', 'adherencia_desayuno', 'adherencia_comida', 'adherencia_merienda', 'adherencia_cena',
  'calorias_media', 'pasos_media', 'saciedad', 'satisfaccion_dieta', 'fc_reposo', 'hrv', 'notas'];
export function leerBorradorCheckin(atletaId, lunes) {
  try { const x = JSON.parse(localStorage.getItem(CLAVE_BORRADOR(atletaId, lunes)) || 'null'); return x && typeof x === 'object' ? x : null; } catch { return null; }
}
// Se guarda solo lo que responde (los campos del check-in, las molestias y las respuestas al coach); vacío, se borra
export function guardarBorradorCheckin(atletaId, lunes, { f = {}, molestias = {}, resp = {}, peso = null } = {}) {
  const campos = Object.fromEntries(Object.entries(f || {}).filter(([k, v]) => CAMPOS_BORRADOR.includes(k) && v != null && v !== ''));
  const mol = Object.fromEntries(Object.entries(molestias || {}).filter(([, v]) => Number(v) > 0));
  const r = Object.fromEntries(Object.entries(resp || {}).filter(([, v]) => v != null && v !== ''));
  const hay = Object.keys(campos).length || Object.keys(mol).length || Object.keys(r).length || peso != null;
  try {
    if (hay) localStorage.setItem(CLAVE_BORRADOR(atletaId, lunes), JSON.stringify({ f: campos, molestias: mol, resp: r, peso: peso ?? null, en: new Date().toISOString() }));
    else localStorage.removeItem(CLAVE_BORRADOR(atletaId, lunes));
  } catch { /* sin almacenamiento */ }
  return !!hay;
}
export function borrarBorradorCheckin(atletaId, lunes) { try { localStorage.removeItem(CLAVE_BORRADOR(atletaId, lunes)); } catch { /* nada */ } }
// Lo de la semana pasada, para «igual que la semana pasada»: solo los campos de escala y número (no el peso ni las notas)
export function respuestasSemanaPasada(checkinAnterior) {
  if (!checkinAnterior) return null;
  const out = {};
  for (const k of CAMPOS_BORRADOR) if (k !== 'notas' && checkinAnterior[k] != null && checkinAnterior[k] !== '') out[k] = checkinAnterior[k];
  return Object.keys(out).length ? out : null;
}

// ---------------------------------------------------------------- «guardar como…» en el chat
// Los mensajes elegidos, en orden y en texto plano (sin fechas ni nombres: el coach lo quiere limpio), sin los borrados
export function textoParaGuardar(mensajes = []) {
  return [...mensajes].sort((a, b) => String(a.creado_en).localeCompare(String(b.creado_en)))
    .filter((c) => !c.eliminado_en && String(c.texto || '').trim())
    .map((c) => textoPlano(c.texto || '').trim()).join('\n').trim();
}

// ---------------------------------------------------------------- el aviso de los vídeos en la bandeja
// archivos (vídeos de técnica sin revisar) → { n, dias } de los que llevan 3 días o más; null si ninguno
export function videosQueEsperan(videos = [], hoy = fechaMadrid()) {
  const viejos = (videos || []).filter((v) => !v.revisado_en && v.creado_en && diasEntre(fechaMadrid(new Date(v.creado_en)), hoy) >= 3);
  if (!viejos.length) return null;
  const dias = Math.max(...viejos.map((v) => diasEntre(fechaMadrid(new Date(v.creado_en)), hoy)));
  return { n: viejos.length, dias, texto: `${viejos.length === 1 ? 'Un vídeo espera' : `${viejos.length} vídeos esperan`} desde hace ${dias} días` };
}

// Las alertas nuevas del panel (054): sesión abierta y peso sin apuntar
export function alertasCierre({ abiertas = [], pesos = [], salud = true }, hoy = fechaMadrid()) {
  const out = [];
  const ab = (abiertas || []).filter((x) => x.ultima_serie && diasEntre(fechaMadrid(new Date(x.ultima_serie)), hoy) >= 1);
  if (ab.length) out.push({ tipo: 'sesion_abierta', nivel: 'aviso', texto: ab.length === 1 ? `${ab[0].nombre || 'Una sesión'} empezada sin terminar` : `${ab.length} sesiones empezadas sin terminar` });
  if (salud) {
    const ultimo = (pesos || [])[0];
    if (ultimo?.fecha && diasEntre(ultimo.fecha, hoy) >= 10 && diasEntre(ultimo.fecha, hoy) <= 60) out.push({ tipo: 'sin_peso', nivel: 'info', texto: `Sin peso desde el ${fmtCorta(ultimo.fecha)}` });
  }
  return out;
}
