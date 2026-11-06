// Radar de contacto: lo que se apunta a mano y se queda en el propio dispositivo (sin base de datos). Lógica pura.
//   · «Ya hablamos»: un contacto de hoy que no pasó por la app (una llamada, en persona, otro canal)
//   · «Mañana»: no proponerlo hasta ese día
// almacen: algo con getItem/setItem (localStorage); si falla (bloqueado o lleno), no pasa nada: solo no se recuerda.
import { sumarDias } from '../fechas.js';
import { DIAS_HISTORIA } from './contactos.js';

export const PREFIJO_RADAR = 'fbe-radar-';
const clave = (usuarioId) => `${PREFIJO_RADAR}${usuarioId}`;
const esDia = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

// { fuera: { [atleta_id]: [dias] }, pospuestos: { [atleta_id]: hasta } }, ya sin lo caducado
export function limpiarLocal(x, hoy) {
  const desde = sumarDias(hoy, -(DIAS_HISTORIA - 1));
  const fuera = {}, pospuestos = {};
  for (const [id, dias] of Object.entries(x?.fuera || {})) {
    const v = [...new Set((Array.isArray(dias) ? dias : []).filter((d) => esDia(d) && d >= desde && d <= hoy))].sort();
    if (v.length) fuera[id] = v;
  }
  for (const [id, hasta] of Object.entries(x?.pospuestos || {})) if (esDia(hasta) && hasta > hoy) pospuestos[id] = hasta;
  return { fuera, pospuestos };
}

export function leerLocal(almacen, usuarioId, hoy) {
  try { return limpiarLocal(JSON.parse(almacen.getItem(clave(usuarioId)) || 'null'), hoy); } catch { return { fuera: {}, pospuestos: {} }; }
}
function guardar(almacen, usuarioId, estado) {
  try { almacen.setItem(clave(usuarioId), JSON.stringify(estado)); return true; } catch { return false; }
}

// Apuntar (o quitar) que hoy habéis hablado fuera de la app. Devuelve el estado nuevo.
export function marcarHablado(almacen, usuarioId, atletaId, hoy, si = true) {
  const e = leerLocal(almacen, usuarioId, hoy);
  const dias = new Set(e.fuera[atletaId] || []);
  if (si) dias.add(hoy); else dias.delete(hoy);
  if (dias.size) e.fuera[atletaId] = [...dias].sort(); else delete e.fuera[atletaId];
  if (si) delete e.pospuestos[atletaId];
  guardar(almacen, usuarioId, e);
  return e;
}

// Dejarlo para dentro de n días (1 = mañana) o, con n = 0, volver a proponerlo ya. Devuelve el estado nuevo.
export function posponer(almacen, usuarioId, atletaId, hoy, n = 1) {
  const e = leerLocal(almacen, usuarioId, hoy);
  if (n > 0) e.pospuestos[atletaId] = sumarDias(hoy, Math.min(7, Math.trunc(n))); else delete e.pospuestos[atletaId];
  guardar(almacen, usuarioId, e);
  return e;
}
