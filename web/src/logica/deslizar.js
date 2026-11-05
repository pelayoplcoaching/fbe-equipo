// v0.63: deslizar una serie a la derecha la marca como hecha (como tocar ✓) y mantenerla pulsada abre el teclado en
// los kilos. Aquí, las cuentas del gesto (probadas en test/logica.test.mjs); los eventos, en ui/atleta/FilaSerie.

// Hasta moverse estos píxeles no se sabe si es un deslizamiento o el dedo que baja la página: luego se fija el eje y
// el otro ya no cuenta (si es vertical, la página se desplaza como siempre y la fila no se mueve)
export const BLOQUEO_PX = 10;
// Para marcarla hay que pasar del 35 % del ancho de la fila (entre 72 y 140 px); volviendo atrás antes de soltar, se cancela
export const UMBRAL_FRACCION = 0.35;
export const UMBRAL_MIN_PX = 72;
export const UMBRAL_MAX_PX = 140;
// Pulsación larga: medio segundo sin moverse más de 8 px
export const LARGA_MS = 500;
export const LARGA_TOLERANCIA_PX = 8;

// 'x', 'y' o null (aún no se sabe). En horizontal tiene que ganar con claridad (un poco en diagonal es la página)
export function ejeGesto(dx, dy, bloqueo = BLOQUEO_PX) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax < bloqueo && ay < bloqueo) return null;
  return ax > ay * 1.2 ? 'x' : 'y';
}

export function umbralDeslizar(ancho) {
  const a = Number(ancho) > 0 ? Number(ancho) : 320;
  return Math.round(Math.min(UMBRAL_MAX_PX, Math.max(UMBRAL_MIN_PX, a * UMBRAL_FRACCION)));
}

// Dónde se pinta la fila y si ya ha pasado el umbral. Hacia la izquierda no se mueve (no hay nada que enseñar); más
// allá del umbral sigue al dedo con resistencia y nunca se sale de la fila
export function estadoDeslizar(dx, ancho) {
  const u = umbralDeslizar(ancho);
  const a = Number(ancho) > 0 ? Number(ancho) : 320;
  const d = Math.max(0, Number(dx) || 0);
  const x = d <= u ? d : Math.min(a * 0.8, u + (d - u) * 0.4);
  return { x: Math.round(x), progreso: Math.min(1, d / u), pasado: d >= u, umbral: u };
}

// Al cruzar el umbral (en uno u otro sentido): para el toque de vibración. 'entra', 'sale' o null
export function cruceUmbral(pasadoAntes, pasadoAhora) {
  if (!pasadoAntes && pasadoAhora) return 'entra';
  if (pasadoAntes && !pasadoAhora) return 'sale';
  return null;
}

// ¿Sigue siendo una pulsación larga? (sin moverse más de la tolerancia)
export const sigueLarga = (dx, dy) => Math.hypot(dx, dy) <= LARGA_TOLERANCIA_PX;
