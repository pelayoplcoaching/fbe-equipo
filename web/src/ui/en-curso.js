// v0.52: la sesión que el atleta lleva a medias, en este móvil (para la píldora «Sesión en curso» y para que el descanso
// siga al volver a la sesión). Solo el nombre, el ejercicio y la serie que tocan y el descanso: nada de salud. Se borra
// al terminar la sesión (o si se quitan todas sus series). Sin almacenamiento, vale mientras la app está abierta.
import { enCursoValido } from '../logica/actividad.js';

const clave = (atletaId) => `fbe-en-curso-${atletaId}`;
export const EVENTO_EN_CURSO = 'fbe-en-curso';
const memoria = new Map();

export function leerEnCurso(atletaId) {
  if (!atletaId) return null;
  let x = memoria.get(atletaId) ?? null;
  try { const t = localStorage.getItem(clave(atletaId)); if (t) x = JSON.parse(t); else if (!memoria.has(atletaId)) x = null; } catch { /* sin almacenamiento: lo de memoria */ }
  return enCursoValido(x) ? x : null;
}
function avisar() { try { window.dispatchEvent(new Event(EVENTO_EN_CURSO)); } catch { /* */ } }

export function guardarEnCurso(atletaId, datos) {
  const x = { ...datos, t: Date.now() };
  if (!atletaId || !enCursoValido(x)) return;
  const previo = leerEnCurso(atletaId);
  if (previo && JSON.stringify({ ...previo, t: 0 }) === JSON.stringify({ ...x, t: 0 }) && Date.now() - previo.t < 60000) return;
  memoria.set(atletaId, x);
  try { localStorage.setItem(clave(atletaId), JSON.stringify(x)); } catch { /* */ }
  avisar();
}

// Solo el descanso, al momento (antes de que se quite el temporizador: así sabe si el aviso al móvil sigue siendo de
// alguien o hay que anularlo)
export function cambiarDescansoEnCurso(atletaId, sesionId, descanso) {
  const x = leerEnCurso(atletaId);
  if (!x || x.id !== sesionId) return;
  const d = descanso ? { fin: descanso.fin, total: descanso.total, prioridad: descanso.prioridad || null, texto: descanso.texto || null, voz: descanso.voz || null, tras: descanso.tras || null, inicio: descanso.inicio || null } : null;
  const n = { ...x, descanso: d, t: Date.now() };
  memoria.set(atletaId, n);
  try { localStorage.setItem(clave(atletaId), JSON.stringify(n)); } catch { /* */ }
  avisar();
}

export function borrarEnCurso(atletaId, sesionId = null) {
  if (!atletaId) return;
  const x = leerEnCurso(atletaId);
  if (sesionId && x && x.id !== sesionId) return;
  memoria.set(atletaId, null);
  try { localStorage.removeItem(clave(atletaId)); } catch { /* */ }
  if (x) avisar();
}

// ¿Este descanso sigue siendo de la sesión en curso? (se ha salido de la sesión con él en marcha: la píldora lo lleva)
export function descansoEnCurso(atletaId, fin) {
  const x = leerEnCurso(atletaId);
  return !!(x?.descanso && x.descanso.fin === fin);
}

// Al cerrar la sesión de la app (o cambiar de cuenta en la demo): fuera la de todos los atletas de este móvil
export function borrarTodoEnCurso() {
  memoria.clear();
  try { for (const k of Object.keys(localStorage)) if (k.startsWith('fbe-en-curso-')) localStorage.removeItem(k); } catch { /* */ }
  avisar();
}
