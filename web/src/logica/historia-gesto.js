// (tacto 226-228, v0.271) Las historias, con las manos: mantener pulsado las para, deslizar hacia abajo las cierra y
// deslizar de lado pasa de tarjeta. Aquí, cuándo un movimiento del dedo es cada cosa (probado en test/tacto.test.mjs).

// Cuánto hay que mantener el dedo quieto para que sea una pausa (menos es un toque: pasa de tarjeta, como siempre)
export const PAUSA_MS = 240;

// Qué es el arrastre: 'baja' (hacia abajo: cerrar), 'lado' (pasar de tarjeta) o null (aún no se sabe, o va hacia arriba)
export function decidirGesto(dx, dy) {
  if (Math.hypot(dx, dy) < 10) return null;
  if (dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.2) return 'baja';
  if (Math.abs(dx) > Math.abs(dy) * 1.2) return 'lado';
  return null;
}

// Al soltar hacia abajo: se cierra si ha bajado bastante o si iba deprisa (vy en px/ms)
export const cierraAlBajar = (dy, vy = 0) => dy > 120 || (dy > 40 && vy > 0.6);

// Al soltar de lado: 1 (la siguiente), -1 (la anterior), 'cerrar' (hacia delante en la última, como al tocar) o 0 (se
// queda: poco recorrido, o hacia atrás en la primera)
export function destinoLado(dx, vx = 0, { i = 0, n = 1 } = {}) {
  const pasa = Math.abs(dx) > 56 || (Math.abs(dx) > 20 && Math.abs(vx) > 0.5);
  if (!pasa) return 0;
  if (dx < 0) return i >= n - 1 ? 'cerrar' : 1;
  return i <= 0 ? 0 : -1;
}

// Lo que cede la tarjeta al tirar hacia atrás en la primera (no hay adónde ir: goma)
export const gomaLado = (dx, { i = 0 } = {}) => (dx > 0 && i <= 0 ? Math.round(dx * 28) / 100 : dx);
