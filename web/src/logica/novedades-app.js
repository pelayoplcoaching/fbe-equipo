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
