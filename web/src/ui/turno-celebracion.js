// (v0.207) Una celebración a la vez. Al volver a Hoy tras una sesión pueden tocar dos: el hito de la racha (4, 8, 12…
// semanas) y la hoja de las medallas nuevas. Antes salían las dos, una encima de otra (y la de debajo no se podía tocar),
// y cuál quedaba encima dependía de qué dato llegaba antes. Ahora piden turno: la primera que lo pide sale y la otra
// espera a que se cierre.
import { useEffect, useRef, useState } from 'preact/hooks';

const cola = [];
const oyentes = new Set();
const avisar = () => oyentes.forEach((f) => f());

// quiere: si esta celebración tiene algo que enseñar ahora. Devuelve si le toca (true solo para la primera de la cola).
export function useTurnoCelebracion(quiere) {
  const yo = useRef(null);
  if (!yo.current) yo.current = {};
  const [, refrescar] = useState(0);
  useEffect(() => {
    const f = () => refrescar((n) => n + 1);
    oyentes.add(f);
    return () => { oyentes.delete(f); };
  }, []);
  useEffect(() => {
    if (!quiere) return undefined;
    cola.push(yo.current);
    avisar();
    return () => {
      const i = cola.indexOf(yo.current);
      if (i >= 0) cola.splice(i, 1);
      avisar();
    };
  }, [quiere]);
  return !!quiere && cola[0] === yo.current;
}
