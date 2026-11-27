// (tacto 236, v0.272) La medalla se coge: en su hoja gira con el dedo, con inercia, y se queda de frente o de espaldas.
// Aquí, las cuentas (probadas en test/tacto.test.mjs). Los ángulos, en grados; la velocidad, en grados por milisegundo.

// Lo que gira por cada píxel que se mueve el dedo (el ancho de la medalla, unos 150 px, es algo más de media vuelta)
export const GRADOS_PX = 1.25;
// Cuánto sigue girando sola al soltarla, como mucho (vuelta y media)
const TOPE_INERCIA = 540;

// La cara que se ve con ese ángulo: 'frente' o 'dorso'
export const caraDe = (angulo) => (Math.abs(Math.round(Number(angulo) / 180)) % 2 === 0 ? 'frente' : 'dorso');

// Dónde se para: lo que lleva, más lo que le queda por la velocidad con que se suelta, en la cara más cercana
export function giroDestino(angulo, velocidad = 0) {
  const a = Number(angulo) || 0;
  const v = Number.isFinite(Number(velocidad)) ? Number(velocidad) : 0;
  const resto = Math.max(-TOPE_INERCIA, Math.min(TOPE_INERCIA, v * 280));
  return Math.round((a + resto) / 180) * 180 || 0;
}

// Lo que tarda en llegar (ms): más cuanto más le queda, entre un tercio de segundo y uno y pico
export const duracionGiro = (desde, hasta) => Math.round(Math.max(320, Math.min(1100, 260 + Math.abs(hasta - desde) * 1.6)));

// El brillo que la cruza al girar: { x: de -60 a 60 (dónde cae la luz), o: de 0 a 1 (cuánta) }. De frente o de espaldas, nada
export function luzGiro(angulo) {
  const r = (Number(angulo) || 0) * Math.PI / 180;
  const s = Math.sin(r);
  return { x: Math.round(s * 60), o: Math.round(Math.abs(s) * 100) / 100 };
}

// La velocidad con que se suelta, suavizada con la anterior (el último tramo del dedo suele ser irregular)
export const velocidadGiro = (antes, dGrados, dMs) => (dMs > 0 ? antes * 0.4 + (dGrados / dMs) * 0.6 : antes);
