import { compararVersiones } from './privacidad.js';

// v0.65: «Novedades» tras una actualización de la app (los textos, en web/src/novedades.js). Lo puro: comparar versiones,
// qué frases tocan y desde qué versión se mira la primera vez.

// «0.65.0» → «0.65» (los arreglos, el tercer número, no cuentan); null si no es una versión
export function versionCorta(v) {
  const m = /^(\d{1,4})\.(\d{1,4})(?:\.\d{1,6})?$/.exec(String(v ?? '').trim());
  return m ? `${Number(m[1])}.${Number(m[2])}` : null;
}
// -1, 0 o 1 por mayor y menor (como números: 0.9 < 0.10); null si alguna no vale
export function compararApp(a, b) {
  const x = versionCorta(a), y = versionCorta(b);
  if (!x || !y) return null;
  const [xa, xb] = x.split('.').map(Number), [ya, yb] = y.split('.').map(Number);
  return xa !== ya ? Math.sign(xa - ya) : Math.sign(xb - yb);
}
export const MAX_NOVEDADES = 5;
// Las frases que tocan al pasar de «vista» a «actual»: las de las versiones posteriores a la vista hasta la actual, de la más
// nueva a la más antigua, del rol que toque (al coach, solo las suyas), como mucho max. Sin versión vista (primera vez), nada.
export function novedadesQueVer(novedades, { vista, actual, rol = 'atleta', max = MAX_NOVEDADES } = {}) {
  if (!versionCorta(vista) || !versionCorta(actual) || compararApp(vista, actual) >= 0) return [];
  return Object.keys(novedades || {})
    .filter((v) => versionCorta(v) && compararApp(v, vista) > 0 && compararApp(v, actual) <= 0)
    .sort((a, b) => compararApp(b, a))
    .flatMap((v) => (Array.isArray(novedades[v]?.[rol]) ? novedades[v][rol] : []).filter((t) => typeof t === 'string' && t.trim()))
    .slice(0, max);
}

// (belleza 341) Dónde está lo nuevo: el icono y el nombre del sitio de la app del que habla cada frase. Se mira solo cómo
// empieza (hasta los primeros dos puntos o punto, y sus primeras palabras): las frases se escriben a mano empezando por el
// sitio («En Ajustes, …», «Hoy, …», «Al terminar tu sesión, …»), y así no hay que marcarlas. [icono, lugar], o null.
const DONDE = [
  [/\bAjustes\b/, 'ajustes', 'En Ajustes'],
  [/«Más»/, 'opciones', 'En «Más»'],
  [/\bRevisar\b/, 'video', 'En Revisar'],
  [/\bcompart|fondo de pantalla/i, 'compartir', 'Al compartir'],
  [/\b(la|tu) sesión\b|\bAl terminar una sesión\b|\bserie\b|\bdescanso\b/i, 'play', 'En la sesión'],
  [/\bchat\b|\bMensajes\b/i, 'mensaje', 'En Mensajes'],
  [/\bbiblioteca\b/i, 'biblioteca', 'En la biblioteca'],
  [/\bProgreso\b/, 'progreso', 'En Progreso'],
  [/\bSemana\b/, 'semana', 'En Semana'],
  [/\bComidas\b|\brecetas?\b|\bmenú\b/i, 'receta', 'En Comidas'],
  [/\bcheck-in\b/i, 'checkin', 'En el check-in'],
  [/^Hoy\b|\ben Hoy\b/, 'hoy', 'En Hoy'],
  [/\bAprende\b|\bguías?\b|\bapuntes\b/i, 'biblioteca', 'En Aprende'],
];
export function dondeNovedad(t) {
  const inicio = String(t || '').split(/[:.]/)[0].split(/\s+/).slice(0, 6).join(' ');
  const x = DONDE.find(([re]) => re.test(inicio));
  return x ? [x[1], x[2]] : null;
}

// La versión vista se guarda en el móvil, por cuenta
export const claveVersionVista = (uid) => `fbe-version-vista-${uid}`;
// Las hojas de novedades empiezan en la 0.65: quien ya usaba la app no tiene nada guardado. La política de privacidad que vio
// (también en el móvil, por cuenta) dice desde qué versión viene; con otra (o sin la 037), la 0.64.
const POR_POLITICA = { '2026-12.4': '0.62', '2026-12.5': '0.63', '2026-12.6': '0.64' };
// (v0.66) Desde la 2026-12.7 (la de la 0.65, con la que llegaron las «Novedades») la política vista ya no dice nada de versiones
// anteriores: quien la tiene y no tiene versión guardada es una cuenta nueva (la aceptó al entrar) o un móvil nuevo; para ellos,
// la actual (no sale nada). Antes, con la 2026-12.7 se miraba desde la 0.65 y a una cuenta nueva le salían las de la 0.66.
const PRIMERA_CON_NOVEDADES = '2026-12.7';
// Desde qué versión mirar: la guardada; si no hay, la que dice la política vista; sin nada (la primera vez en este móvil con
// esta cuenta, o una cuenta nueva), la actual (no sale nada)
export function versionVistaInicial({ guardada = null, politicaVista = null, actual }) {
  if (versionCorta(guardada)) return guardada;
  if (politicaVista && POR_POLITICA[politicaVista]) return POR_POLITICA[politicaVista];
  if (politicaVista && compararVersiones(politicaVista, PRIMERA_CON_NOVEDADES) < 0) return '0.64';
  return actual;
}
