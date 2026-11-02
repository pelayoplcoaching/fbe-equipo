// v0.51: las sesiones cuyo «¿Cómo llegas hoy?» se contestó hoy (hora de Madrid) en este móvil. La base no guarda la
// hora de la respuesta: esto, las series de hoy y la fecha de la sesión hecha son lo que dice que es de hoy
// (logica/tablero.js, prepDeHoy). Si el almacenamiento falla, la sesión vuelve a preguntar.
import { fechaMadrid } from '../../logica/fechas.js';

const CLAVE = 'fbe-prep-hoy';
export function prepMarcadas(hoy = fechaMadrid()) {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    return g && g.fecha === hoy && Array.isArray(g.ids) ? g.ids.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}
export function marcarPrepHoy(sesionId, hoy = fechaMadrid()) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ fecha: hoy, ids: [...new Set([...prepMarcadas(hoy), sesionId])].slice(-10) }));
  } catch { /* sin almacenamiento */ }
}
export function desmarcarPrepHoy(sesionId, hoy = fechaMadrid()) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ fecha: hoy, ids: prepMarcadas(hoy).filter((x) => x !== sesionId) }));
  } catch { /* sin almacenamiento */ }
}
