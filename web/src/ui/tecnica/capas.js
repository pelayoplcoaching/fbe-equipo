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
