// Para el coach: cómo llegó el atleta a la sesión, en una línea. Las tres preguntas («Sueño: mal. Energía: normal…») o,
// en FBE Esencial (v0.258, migración 110), la de un toque («Regular · 5,5 h de sueño · hizo lo que le propuso la app»).
// (Antes en logica/preparacion.js; aquí solo lo carga el panel del coach, no la app del atleta al abrirse.)
import { PREGUNTAS, completa, esUnToque } from './preparacion.js';

const NOMBRE = Object.fromEntries(PREGUNTAS.map((p) => [p.id, Object.fromEntries(p.opciones)]));
const CARA = { bien: 'Bien', regular: 'Regular', mal: 'Mal' };
export function textoPreparacion(p) {
  if (esUnToque(p)) {
    return [CARA[p.cara], p.horas > 0 && `${String(p.horas).replace('.', ',')} h de sueño${p.cara === 'bien' && p.horas < 6 ? ' (cuenta como regular)' : ''}`,
      p.agujetas && 'agujetas fuertes en lo de hoy', p.asi === true && 'hizo lo que le propuso la app', p.asi === false && 'eligió entrenar normal'].filter(Boolean).join(' · ');
  }
  if (!completa(p)) return null;
  return `Sueño: ${NOMBRE.sueno[p.sueno].toLowerCase()}. Energía: ${NOMBRE.energia[p.energia].toLowerCase()}. Agujetas o molestias: ${NOMBRE.molestias[p.molestias].toLowerCase()}`;
}
