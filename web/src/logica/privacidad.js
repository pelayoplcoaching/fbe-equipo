// El aviso de privacidad (v0.56): cuando la política cambia, se avisa UNA vez (no cada vez que se abre la app). La versión
// vista se guarda por cuenta en la base (migración 034; antes, en este móvil).
// (v0.59) Una versión es «AAAA-MM» o, para añadir algo dentro del mismo mes, «AAAA-MM.n» (de 1 a 9; la 037 lo admite en la
// base). Se comparan por partes (año-mes y luego la revisión), nunca como texto: 2026-12 < 2026-12.1 < 2026-12.2 < … < 2026-12.9 < 2026-12.10 < 2027-01 (v0.71: de una o dos cifras).
// (v0.71, 043) La revisión, de una o dos cifras (de 1 a 99): 2026-12.9 < 2026-12.10
const RE_VERSION = /^(20\d{2})-(0[1-9]|1[0-2])(?:\.([1-9]\d?))?$/;
export const formatoVersion = (v) => typeof v === 'string' && RE_VERSION.test(v);
// La versión sin su revisión («2026-12.1» → «2026-12»): la que entiende una base sin la 037
export const versionSinRevision = (v) => (formatoVersion(v) ? v.slice(0, 7) : null);
// -1, 0 o 1 (solo con dos versiones válidas; si no, null)
export function compararVersiones(a, b) {
  const x = formatoVersion(a) && a.match(RE_VERSION), y = formatoVersion(b) && b.match(RE_VERSION);
  if (!x || !y) return null;
  const clave = (m) => [Number(m[1]) * 12 + Number(m[2]), Number(m[3] || 0)];
  const [ma, ra] = clave(x), [mb, rb] = clave(y);
  return ma !== mb ? Math.sign(ma - mb) : Math.sign(ra - rb);
}
// La más reciente de las dos (las no válidas no cuentan)
export const versionMayor = (a, b) => {
  const vs = [a, b].filter(formatoVersion);
  if (vs.length < 2) return vs[0] || null;
  return compararVersiones(vs[0], vs[1]) >= 0 ? vs[0] : vs[1];
};
// Hay que enseñarlo si no ha visto ninguna o ha visto una anterior a la actual
export const debeAvisarPrivacidad = (vista, actual) => formatoVersion(actual) && (!formatoVersion(vista) || compararVersiones(vista, actual) < 0);
// (v0.252, peso al abrir) La lista de lo que cambia en cada versión (NOVEDADES_PRIVACIDAD y novedadesDesde) está en su propio
// módulo, logica/privacidad-novedades.js: solo la carga el aviso de privacidad cuando sale (AvisoPrivacidad.jsx).
// Antes de la 034 (o si la base no responde): por cuenta, en este móvil
export const clavePrivacidadLocal = (uid) => `fbe-privacidad-vista-${uid}`;
// En la ficha del coach: si ese atleta ha visto las novedades de la política vigente
export function textoPrivacidadVista(fila, actual) {
  const v = formatoVersion(fila?.version) ? fila.version : null;
  if (!v) return `Sin constancia de que haya visto las novedades de la política de privacidad (${actual}): le saldrán al abrir la app.`;
  if (compararVersiones(v, actual) >= 0) return `Ha visto la política de privacidad vigente (${actual}).`;
  return `Vio la política de ${v}; la vigente es la ${actual}: le saldrán las novedades al abrir la app.`;
}
