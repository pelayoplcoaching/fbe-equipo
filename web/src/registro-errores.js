// Registro de errores (v0.21): lo que falla en el móvil de alguien se apunta solo en la base (registrar_error),
// para verlo en Cuenta → Errores de la app sin esperar a que nadie lo cuente. Solo el mensaje técnico, la
// pantalla y la versión: nada de lo que se estaba escribiendo ni datos de salud.
// Sin conexión no se apunta nada (no es un fallo de la app), y como mucho 15 distintos por sesión.
let destino = null;
let version = '';
const vistos = new Set();
const MAX = 15;

const deRed = (e, m) => !!e?.sinConexion || e?.name === 'AbortError' || (typeof navigator !== 'undefined' && navigator.onLine === false)
  || /Failed to fetch|NetworkError|Load failed|network error|ERR_NETWORK|The Internet connection appears to be offline/i.test(m);
const ruido = (m) => /ResizeObserver loop|Script error\.?$|^cancel(l)?ed$/i.test(m);

export function reportarError(e, contexto = '') {
  try {
    if (!destino) return;
    const mensaje = String(e?.message || e?.reason?.message || e || '').slice(0, 500);
    if (!mensaje || deRed(e, mensaje) || ruido(mensaje)) return;
    const clave = `${contexto}|${mensaje}`;
    if (vistos.has(clave) || vistos.size >= MAX) return;
    vistos.add(clave);
    const pantalla = [contexto, typeof location !== 'undefined' ? location.hash : ''].filter(Boolean).join(' ').slice(0, 60);
    const detalle = String(e?.stack || '').split('\n').slice(0, 12).join('\n').slice(0, 2000) || null;
    const navegador = typeof navigator !== 'undefined' ? String(navigator.userAgent || '').slice(0, 300) : null;
    destino({ mensaje, pantalla: pantalla || null, detalle, version, navegador });
  } catch { /* el registro nunca rompe nada */ }
}

// Se conecta una vez al arrancar, con la función que lo guarda en la base
export function instalarRegistro(enviar, v = '') {
  destino = (d) => Promise.resolve().then(() => enviar(d)).catch(() => {});
  version = v;
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (ev) => reportarError(ev.error || ev.message, 'error'));
  window.addEventListener('unhandledrejection', (ev) => reportarError(ev.reason, 'promesa'));
}
