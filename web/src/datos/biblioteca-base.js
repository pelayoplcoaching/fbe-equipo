// Biblioteca para la demo: solo nombres y grupos musculares (se puede publicar).
// Al empaquetar la demo privada (npm run demo), se sustituye por la real de FBE con vídeos y técnica
// si existe biblioteca-fbe.json en tu ordenador (no se sube al repositorio).
import BIBLIOTECA from './biblioteca-generica.json' with { type: 'json' };
export const BIBLIOTECA_BASE = BIBLIOTECA;
