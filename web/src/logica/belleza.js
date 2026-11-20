// (v0.200, belleza) Lo puro de la tanda de belleza: cuándo sale la escena de la versión 200, el aro de la semana alrededor
// de la foto y el resumen del día en la cabecera de Atletas.
import { compararApp } from './novedades-app.js';

// ---------- La escena de la versión 200 ----------
// Una sola vez en este móvil, a quien ya usaba la app (venía de una versión anterior a la 0.200) y solo mientras la app
// esté en la 0.200 a la 0.209: más tarde, contar «la 200» ya no tendría gracia. En las pruebas, solo si se pide.
export const CLAVE_ESCENA_200 = 'fbe-escena-200';
export function tocaEscena200({ vista = null, vistaVersion = null, actual, automatico = false } = {}) {
  if (automatico || vista) return false;
  if (compararApp(actual, '0.200') < 0 || compararApp(actual, '0.209') > 0) return false;
  const v = compararApp(vistaVersion, '0.200');
  return v != null && v < 0;
}

// ---------- El aro de la semana alrededor de la foto ----------
// Lo hecho de lo previsto, entre 0 y 1 (sin nada previsto, sin aro). El aro tiene un hueco entre sesión y sesión cuando
// son pocas (hasta 7): como los anillos de la semana.
export function aroSemana(hechas, total) {
  const t = Math.max(0, Math.floor(Number(total) || 0)), h = Math.max(0, Math.floor(Number(hechas) || 0));
  if (!t) return null;
  const parte = Math.min(1, h / t);
  return { hechas: Math.min(h, t), total: t, parte, completa: h >= t, tramos: t <= 7 ? t : 0, texto: `${Math.min(h, t)} de ${t} sesiones esta semana` };
}

// ---------- La cabecera de Atletas: el saludo y el resumen del día ----------
export function saludoCoach(hora) {
  const h = Number(hora);
  if (!Number.isFinite(h)) return 'Hola';
  if (h >= 6 && h < 14) return 'Buenos días';
  if (h >= 14 && h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}
// filas: las de la lista (resumenAtleta); hoy: { [atleta_id]: { hecha, nombre } } (hoyTocaEquipo: los que tienen sesión hoy);
// sinLeer: { [id]: n }. Devuelve las cifras del día y una frase corta (sin datos de salud: solo cuántos)
export function resumenDiaCoach({ filas = [], hoy = {}, sinLeer = {}, atencion: atencionDada = null } = {}) {
  const activos = (filas || []).filter((r) => r && r.estado === 'activo');
  const ids = new Set(activos.map((r) => r.atleta_id));
  const entrenan = Object.entries(hoy || {}).filter(([id, v]) => ids.has(id) && v).length;
  const hechas = Object.entries(hoy || {}).filter(([id, v]) => ids.has(id) && v?.hecha).length;
  const escritos = Object.entries(sinLeer || {}).filter(([id, n]) => ids.has(id) && Number(n) > 0).length;
  // (los que piden atención: los de los avisos de la lista, con tus umbrales, si llegan; si no, los que tienen avisos)
  const atencion = Number.isFinite(atencionDada) ? atencionDada : activos.filter((r) => (r.alertas || []).some((a) => a?.nivel === 'alerta' || a?.nivel === 'aviso')).length;
  const trozos = [];
  if (entrenan) trozos.push(`${entrenan} ${entrenan === 1 ? 'entrena' : 'entrenan'} hoy${hechas ? ` (${hechas} ya ${hechas === 1 ? 'ha terminado' : 'han terminado'})` : ''}`);
  if (escritos) trozos.push(`${escritos} ${escritos === 1 ? 'te ha escrito' : 'te han escrito'}`);
  if (atencion) trozos.push(`${atencion} ${atencion === 1 ? 'pide' : 'piden'} atención`);
  return { entrenan, hechas, escritos, atencion, activos: activos.length, frase: trozos.length ? `${trozos.join(', ')}.` : activos.length ? 'Día tranquilo: nadie te necesita ahora mismo.' : '' };
}

// ---------- El tablero de Atletas: el color de cada columna ----------
// Uno de los colores de las etiquetas (COLORES_ETIQUETA), según lo que significa la columna: por estado, los activos en
// verde y los de baja en gris; por la semana que viene, publicada en verde, en borrador en ámbar y sin preparar en rojo;
// por etiqueta, el color de la etiqueta; y lo demás, por turno. «Sin…» (sin nivel, sin fase, sin etiqueta), gris.
const TONO_ESTADO = { activo: 'verde', pausado: 'ambar', invitado: 'azul', baja: 'gris' };
const TONO_PROXIMA = { publicada: 'verde', borrador: 'ambar', sin: 'rojo', sin_bloque: 'rojo', na: 'gris' };
const TURNO = ['morado', 'azul', 'verde', 'ambar', 'rojo'];
export function tonoColumna(por, clave, i = 0, colorDeEtiqueta = null) {
  const k = String(clave ?? '');
  if (por === 'estado') return TONO_ESTADO[k] || 'gris';
  if (por === 'proxima') return TONO_PROXIMA[k] || 'gris';
  if (!k || k === 'sin' || k === 'na') return 'gris';
  if (por === 'etiqueta' && typeof colorDeEtiqueta === 'function') return colorDeEtiqueta(k) || 'gris';
  return TURNO[Math.abs(Math.trunc(Number(i) || 0)) % TURNO.length];
}
