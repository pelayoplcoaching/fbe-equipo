// Biblioteca para la demo: solo nombres y grupos musculares (se puede publicar).
// Al empaquetar la demo privada (npm run demo), se sustituye por la real de FBE con vídeos y técnica
// si existe biblioteca-fbe.json en tu ordenador (no se sube al repositorio).
import BIBLIOTECA from './biblioteca-generica.json' with { type: 'json' };
// (biblioteca 2) La ampliación: 160 ejercicios más, con sus grupos, tipo, rango de repeticiones y alternativas (por
// nombre). Su técnica no va aquí: el coach la pone en su base con el SQL de la biblioteca.
import AMPLIACION from './biblioteca-ampliacion.json' with { type: 'json' };
const ya = new Set(BIBLIOTECA.map((e) => e.nombre));
export const BIBLIOTECA_BASE = [...BIBLIOTECA, ...AMPLIACION.filter((e) => !ya.has(e.nombre))];
