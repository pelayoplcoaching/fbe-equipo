// Las sub-pestañas de Progreso (Resumen, Fuerza, Cuerpo, Logros) y cómo pedir una desde fuera: «Ver la gráfica» del
// peso en Hoy abre Cuerpo y «Ver mis logros», Logros. Se pide antes de ir a la pestaña (irA('progreso')); si Progreso
// ya está a la vista, le llega por el evento.
export const SUBS_PROGRESO = [['resumen', 'Resumen'], ['fuerza', 'Fuerza'], ['cuerpo', 'Cuerpo'], ['logros', 'Logros']];
export const EVENTO_SUB_PROGRESO = 'fbe-sub-progreso';
const valida = (s) => SUBS_PROGRESO.some(([k]) => k === s);

let pedida = null;
export function pedirSubProgreso(sub) {
  if (!valida(sub)) return;
  pedida = sub;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO_SUB_PROGRESO, { detail: sub }));
}
// La que se pidió (una vez): Progreso la toma al abrirse
export function tomarSubProgreso() {
  const s = pedida;
  pedida = null;
  return valida(s) ? s : null;
}
