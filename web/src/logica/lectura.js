// (vista 271, v0.276) Las cuentas de la barra de lectura (ui/lectura.jsx).

// Los minutos de un texto: unas 200 palabras por minuto, como poco uno
export const PALABRAS_MINUTO = 200;
export function minutosLectura(texto) {
  const n = String(texto || '').trim().split(/\s+/).filter(Boolean).length;
  return n ? Math.max(1, Math.round(n / PALABRAS_MINUTO)) : 0;
}

// Lo leído, de 0 a 1: arriba = dónde empieza el texto respecto a lo que se ve (negativo si ya ha subido); alto = lo que
// mide el texto; ventana = lo que se ve. Se da por leído cuando su final llega al último cuarto de lo que se ve
// maxRecorrido: lo que de verdad se puede bajar desde que el texto llega arriba (si debajo no hay bastante página, el
// final del texto nunca llegaría a ese último cuarto: entonces, leído al llegar abajo del todo)
export function avanceLectura({ arriba, alto, ventana, maxRecorrido = Infinity }) {
  if (!(alto > 0) || !(ventana > 0)) return 0;
  const recorrido = Math.min(Math.max(1, alto - ventana * 0.75), maxRecorrido);
  if (!(recorrido > 0)) return 1;
  return Math.min(1, Math.max(0, -arriba / recorrido));
}
// Lo que dice: «Te quedan 3 min», «Te queda 1 min» o «Leído»
export const textoQuedan = (min, largo = false) => (min <= 0 ? 'Leído' : `Te ${min === 1 ? 'queda' : 'quedan'} ${min} ${largo ? (min === 1 ? 'minuto' : 'minutos') : 'min'}`);
