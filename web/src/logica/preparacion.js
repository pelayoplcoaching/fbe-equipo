// «¿Cómo llegas hoy?»: tres preguntas antes de la sesión (1 = mal, 2 = normal, 3 = bien) y un consejo.
// Es una ayuda para autorregular el día, no un diagnóstico: el esfuerzo pautado (RPE/RIR) ya ajusta la carga
// a cómo estás; esto solo frena la subida de carga en un día malo y lo deja anotado para el coach.

export const PREGUNTAS = [
  { id: 'sueno', texto: '¿Cómo has dormido?', opciones: [[1, 'Mal'], [2, 'Normal'], [3, 'Bien']] },
  { id: 'energia', texto: '¿Cómo tienes la energía?', opciones: [[1, 'Baja'], [2, 'Normal'], [3, 'Alta']] },
  { id: 'molestias', texto: '¿Agujetas o molestias?', opciones: [[1, 'Bastantes'], [2, 'Algunas'], [3, 'Ninguna']] },
];
const NOMBRE = Object.fromEntries(PREGUNTAS.map((p) => [p.id, Object.fromEntries(p.opciones)]));

export const completa = (p) => !!p && PREGUNTAS.every((q) => [1, 2, 3].includes(p[q.id]));

// nivel: 'bien' | 'flojo' | 'malo'. frenar: no proponer subir carga ese día.
export function consejoPreparacion(p) {
  if (!completa(p)) return null;
  const total = p.sueno + p.energia + p.molestias;
  if (p.molestias === 1 || total <= 4) {
    return {
      nivel: 'malo', frenar: true, titulo: 'Día difícil',
      texto: 'Haz la sesión en la parte baja del rango de repeticiones, sin pasar del esfuerzo pautado, y si hace falta quita una serie en los accesorios. Hoy no subas carga. Si una molestia cambia cómo te mueves o va a más, para ese ejercicio y cuéntaselo a tu coach.',
    };
  }
  if (total <= 6 || Object.values(p).includes(1)) {
    return {
      nivel: 'flojo', frenar: true, titulo: 'Día flojo',
      texto: 'Quédate en la parte baja del rango y no pases del esfuerzo pautado. Hoy la app no te propondrá subir carga.',
    };
  }
  return { nivel: 'bien', frenar: false, titulo: 'Buen día', texto: 'Sigue la pauta tal cual. Si todo sale fácil, la app te propondrá subir carga donde toque.' };
}

// Para el coach: «Sueño: mal. Energía: normal. Molestias: ninguna»
export function textoPreparacion(p) {
  if (!completa(p)) return null;
  return `Sueño: ${NOMBRE.sueno[p.sueno].toLowerCase()}. Energía: ${NOMBRE.energia[p.energia].toLowerCase()}. Agujetas o molestias: ${NOMBRE.molestias[p.molestias].toLowerCase()}`;
}
