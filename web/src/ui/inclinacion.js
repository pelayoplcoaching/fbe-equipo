// (vista 284 y 285) El móvil inclinado: el brillo del oro (medallas, podio y vitrina) y los dos planos de la tarjeta de
// Hoy lo siguen. Como el carné: en Android no hay que pedir nada; en iPhone, vale el permiso que se da en «Tu carné»
// (mientras la app siga abierta). Nunca con «reducir movimiento» ni en el ordenador. Sin él, todo sigue como siempre (las
// medallas, al dedo).
// Un solo oyente para toda la app y solo mientras haya a la vista algo que lo use: a cada elemento le escribe lo que
// necesita (aplicar(el, x, y), x e y de −1 a 1) una vez por imagen, y se le pone data-incl mientras se mueve con el móvil.
import { sinMovimiento } from './transiciones.js';

const CLAVE = 'fbe-inclinacion';
const enMovil = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
// Android: el evento llega sin pedir permiso
export const sinPermisoInclinacion = () => enMovil() && 'DeviceOrientationEvent' in window && typeof window.DeviceOrientationEvent.requestPermission !== 'function';
export function inclinacionConcedida() {
  try { return sessionStorage.getItem(CLAVE) === '1'; } catch { return false; }
}
// Lo llama el carné cuando la persona da el permiso en iPhone
export function marcarInclinacion() {
  try { sessionStorage.setItem(CLAVE, '1'); } catch { /* sin almacenamiento: solo el carné */ }
  revisar();
}
export const puedeInclinar = () => !sinMovimiento() && (sinPermisoInclinacion() || (enMovil() && inclinacionConcedida()));

// x e y (de −1 a 1) respecto a cómo se tenía el móvil al empezar a mirar (25 grados a cada lado llegan al tope)
export function deInclinacion(beta, gamma, base) {
  const lim = (v) => Math.max(-1, Math.min(1, v));
  return { x: lim(((Number(gamma) || 0) - base.gamma) / 25), y: lim(((Number(beta) || 0) - base.beta) / 25) };
}

const vistos = new Map();   // elemento → { aplicar, visible }
let io = null, oyendo = false, base = null, raf = 0, pendiente = null;
function pintar() {
  raf = 0;
  if (!pendiente) return;
  for (const [el, x] of vistos) if (x.visible) { el.dataset.incl = ''; x.aplicar(el, pendiente.x, pendiente.y); }
}
function alInclinar(e) {
  if (e.beta == null || e.gamma == null) return;
  base ||= { beta: e.beta, gamma: e.gamma };
  pendiente = deInclinacion(e.beta, e.gamma, base);
  if (!raf) raf = requestAnimationFrame(pintar);
}
function revisar() {
  const hay = [...vistos.values()].some((x) => x.visible);
  const oir = hay && puedeInclinar();
  if (oir && !oyendo) { oyendo = true; base = null; window.addEventListener('deviceorientation', alInclinar); }
  else if (!oir && oyendo) { oyendo = false; window.removeEventListener('deviceorientation', alInclinar); cancelAnimationFrame(raf); raf = 0; }
}
// Que un elemento siga al móvil mientras se vea. Devuelve con qué dejarlo
export function seguirInclinacion(el, aplicar) {
  if (!el || typeof IntersectionObserver === 'undefined' || !puedeInclinar()) return () => {};
  io ||= new IntersectionObserver((xs) => {
    for (const x of xs) { const v = vistos.get(x.target); if (v) { v.visible = x.isIntersecting; if (!v.visible) delete x.target.dataset.incl; } }
    revisar();
  });
  vistos.set(el, { aplicar, visible: false });
  io.observe(el);
  return () => {
    vistos.delete(el);
    io?.unobserve(el);
    delete el.dataset.incl;
    revisar();
  };
}
