// v0.52: «Respira» en el descanso (como Headspace o Calm): un círculo que crece al inspirar (4 s) y encoge al soltar
// (6 s, la espiración más larga que la inspiración), contado desde que empieza el descanso, así va acompasado con la
// cuenta atrás. Lo puro, aquí; el dibujo es una animación CSS (solo transform) con el retraso que dice esto.

export const RESPIRA = { inspira: 4, suelta: 6 };
export const CICLO_RESPIRA = RESPIRA.inspira + RESPIRA.suelta;
export const ESCALA_RESPIRA = { min: 0.62, max: 1 };

// En qué punto del ciclo está, a los s segundos de empezar el descanso
export function faseRespira(s) {
  const t = ((Number(s) || 0) % CICLO_RESPIRA + CICLO_RESPIRA) % CICLO_RESPIRA;
  const { min, max } = ESCALA_RESPIRA;
  const suave = (x) => 0.5 - Math.cos(Math.PI * x) / 2;
  if (t < RESPIRA.inspira) {
    const k = t / RESPIRA.inspira;
    return { fase: 'inspira', texto: 'Inspira', avance: k, escala: min + (max - min) * suave(k), ciclo: Math.floor(s / CICLO_RESPIRA) };
  }
  const k = (t - RESPIRA.inspira) / RESPIRA.suelta;
  return { fase: 'suelta', texto: 'Suelta', avance: k, escala: max - (max - min) * suave(k), ciclo: Math.floor(s / CICLO_RESPIRA) };
}

// El retraso (negativo) de la animación CSS para que vaya por donde va el descanso
export const retrasoRespira = (s) => -(((Number(s) || 0) % CICLO_RESPIRA + CICLO_RESPIRA) % CICLO_RESPIRA);
