// Lo que corrige el coach en un vídeo (v0.57), compartido entre el hilo, la corrección y el reproductor: los comentarios
// (sus minutos y sus dibujos) los pone el hilo; la nota, los puntos clave, el tempo y la voz, la corrección. El
// reproductor lo lee para sus marcas en la barra de tiempo, los dibujos con tramo y la voz al ritmo del vídeo.
import { useEffect, useState } from 'preact/hooks';

const datos = new Map(); // archivoId → { comentarios, revision }
const oyentes = new Map(); // archivoId → Set(fn)

export function ponerCorrecciones(archivoId, parte, valor) {
  if (!archivoId) return;
  const antes = datos.get(archivoId) || {};
  if (antes[parte] === valor) return;
  datos.set(archivoId, { ...antes, [parte]: valor });
  for (const f of oyentes.get(archivoId) || []) f(datos.get(archivoId));
}
export const correccionesDe = (archivoId) => datos.get(archivoId) || {};
export function useCorrecciones(archivoId) {
  const [d, setD] = useState(() => correccionesDe(archivoId));
  useEffect(() => {
    if (!archivoId) return undefined;
    setD(correccionesDe(archivoId));
    const f = (x) => setD(x);
    if (!oyentes.has(archivoId)) oyentes.set(archivoId, new Set());
    oyentes.get(archivoId).add(f);
    return () => { oyentes.get(archivoId)?.delete(f); };
  }, [archivoId]);
  return d;
}
