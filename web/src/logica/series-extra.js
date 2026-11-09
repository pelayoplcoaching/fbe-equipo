// Las series añadidas por el atleta («Añadir serie»): cuántas filas de más tiene cada ejercicio de la sesión, guardadas
// en el móvil mientras dura la sesión (antes vivían en la tarjeta: al plegarse, al recargar o al cambiar de ejercicio se
// perdían, y el descanso no las contaba: decía «siguiente ejercicio» con una serie añadida aún por hacer).
// { sesion_ejercicio_id: n } con n ≥ 1. Funciones puras salvo las de localStorage.

const CLAVE = (sesionId) => `fbe-series-extra-${sesionId}`;

// Limpia: solo ids con un entero de 1 a 20
export function limpiarExtras(x) {
  const out = {};
  if (!x || typeof x !== 'object') return out;
  for (const [k, v] of Object.entries(x)) {
    const n = Math.floor(Number(v));
    if (k && Number.isFinite(n) && n >= 1 && n <= 20) out[k] = n;
  }
  return out;
}

export function leerExtras(sesionId) {
  try { return limpiarExtras(JSON.parse(localStorage.getItem(CLAVE(sesionId)) || 'null')); } catch { return {}; }
}
export function guardarExtras(sesionId, extras) {
  const x = limpiarExtras(extras);
  try { if (Object.keys(x).length) localStorage.setItem(CLAVE(sesionId), JSON.stringify(x)); else localStorage.removeItem(CLAVE(sesionId)); } catch { /* sin almacenamiento */ }
  return x;
}
export const borrarExtras = (sesionId) => guardarExtras(sesionId, {});

// Cuántas filas tiene un ejercicio: las pautadas, las añadidas y, si hay series guardadas más allá, hasta la última
export function filasDe(e, extra = 0, hechas = {}) {
  return Math.max((e?.series || 0) + (Number(extra) || 0), ...Object.keys(hechas || {}).map(Number).filter(Number.isFinite), 0);
}

// Los ejercicios con las series añadidas sumadas a `series` (y las pautadas en `pautadas`), para lo que cuenta series
// pendientes: la serie que toca, el descanso («Después: serie 5 de press militar»), la voz y el aviso al móvil. Lo que
// nombra o programa las series (top/back-off, la progresión) sigue usando las pautadas.
export function conExtras(ejercicios = [], extras = {}) {
  const x = limpiarExtras(extras);
  return (ejercicios || []).map((e) => (x[e.id] ? { ...e, pautadas: e.series, series: (e.series || 0) + x[e.id] } : e));
}

// ¿Están hechas todas las filas (pautadas y añadidas)? Así una añadida sin hacer no pliega la tarjeta ni la da por terminada
export function filasHechas(e, extra = 0, hechas = {}) {
  const n = filasDe(e, extra, hechas);
  return n > 0 && Array.from({ length: n }, (_, i) => i + 1).every((k) => !!hechas?.[k]);
}
