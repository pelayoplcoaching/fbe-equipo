// Las capas de análisis de un vídeo (v0.58): lo que pinta el análisis automático encima de la imagen (la trayectoria de la
// barra, el círculo del disco, el esqueleto), compartido entre el panel del análisis y el reproductor de ese vídeo (como
// correcciones.js). capa: una función ({ rect, caja, t, dur, proporcion, video, jugando }) → lo que se pinta, o null.
import { useEffect, useState } from 'preact/hooks';

const capas = new Map(); // archivoId → función
const oyentes = new Map(); // archivoId → Set(fn)

export function ponerCapa(archivoId, capa) {
  if (!archivoId) return;
  if (capa) capas.set(archivoId, capa); else capas.delete(archivoId);
  for (const f of oyentes.get(archivoId) || []) f(capa || null);
}
export const capaDe = (archivoId) => capas.get(archivoId) || null;

// (revisión de seguridad v0.58) Lo analizado en esta sesión (por cuenta y vídeo), como mucho de los 5 últimos vídeos (el
// que se usa pasa a ser el más reciente). Se olvida al cerrar la sesión o al caducar (olvidarAnalisis), como la copia del chat.
export const MAX_SESION_ANALISIS = 5;
const sesion = new Map(); // «cuenta:archivoId» → { tramo, circulo, barra, cal, discoCm, repsEdit, pose }
export function leerSesionAnalisis(clave) {
  const x = sesion.get(clave);
  if (x) { sesion.delete(clave); sesion.set(clave, x); }
  return x || null;
}
export function guardarSesionAnalisis(clave, valor) {
  sesion.delete(clave);
  sesion.set(clave, valor);
  while (sesion.size > MAX_SESION_ANALISIS) sesion.delete(sesion.keys().next().value);
}
export const sesionesAnalisis = () => [...sesion.keys()];
// Olvida todo lo del análisis: lo de la sesión y las capas sobre los vídeos (los reproductores abiertos dejan de pintarlas)
export function olvidarAnalisis() {
  sesion.clear();
  for (const id of [...capas.keys()]) ponerCapa(id, null);
}
export function useCapa(archivoId) {
  const [c, setC] = useState(() => capaDe(archivoId));
  useEffect(() => {
    if (!archivoId) return undefined;
    setC(() => capaDe(archivoId));
    const f = (x) => setC(() => x);
    if (!oyentes.has(archivoId)) oyentes.set(archivoId, new Set());
    oyentes.get(archivoId).add(f);
    return () => { oyentes.get(archivoId)?.delete(f); };
  }, [archivoId]);
  return c;
}
