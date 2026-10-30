// «¿Cómo llegas hoy?»: tres preguntas antes de la sesión (1 = mal, 2 = normal, 3 = bien) y un consejo.
// Es una ayuda para autorregular el día, no un diagnóstico: el esfuerzo pautado (RPE/RIR) ya ajusta la carga
// a cómo estás. En un día flojo o malo pregunta si subir carga hoy o ir con los pesos de la última vez (v0.32:
// lo decide el atleta; antes se frenaba siempre) y lo deja anotado para el coach.

export const PREGUNTAS = [
  { id: 'sueno', texto: '¿Cómo has dormido?', opciones: [[1, 'Mal'], [2, 'Normal'], [3, 'Bien']] },
  { id: 'energia', texto: '¿Cómo tienes la energía?', opciones: [[1, 'Baja'], [2, 'Normal'], [3, 'Alta']] },
  { id: 'molestias', texto: '¿Agujetas o molestias?', opciones: [[1, 'Bastantes'], [2, 'Algunas'], [3, 'Ninguna']] },
];
const NOMBRE = Object.fromEntries(PREGUNTAS.map((p) => [p.id, Object.fromEntries(p.opciones)]));

export const completa = (p) => !!p && PREGUNTAS.every((q) => [1, 2, 3].includes(p[q.id]));

// nivel: 'bien' | 'flojo' | 'malo'. frenar: preguntar si subir carga ese día (sin respuesta, no se sube).
export function consejoPreparacion(p) {
  if (!completa(p)) return null;
  const total = p.sueno + p.energia + p.molestias;
  if (p.molestias === 1 || total <= 4) {
    return {
      nivel: 'malo', frenar: true, titulo: 'Día difícil',
      texto: 'Haz la sesión sin pasar del esfuerzo pautado y, si hace falta, quita una serie en los accesorios. Si una molestia cambia cómo te mueves o va a más, para ese ejercicio y cuéntaselo a tu coach.',
    };
  }
  if (total <= 6 || Object.values(p).includes(1)) {
    return {
      nivel: 'flojo', frenar: true, titulo: 'Día flojo',
      texto: 'Que el esfuerzo pautado (RPE) mande: si las series pesan más de lo normal, quédate en la parte baja del rango.',
    };
  }
  return { nivel: 'bien', frenar: false, titulo: 'Buen día', texto: 'Sigue la pauta tal cual. Si todo sale fácil, la app te propondrá subir carga donde toque.' };
}

// Para el coach: «Sueño: mal. Energía: normal. Molestias: ninguna»
export function textoPreparacion(p) {
  if (!completa(p)) return null;
  return `Sueño: ${NOMBRE.sueno[p.sueno].toLowerCase()}. Energía: ${NOMBRE.energia[p.energia].toLowerCase()}. Agujetas o molestias: ${NOMBRE.molestias[p.molestias].toLowerCase()}`;
}

// Lo que decide el atleta en un día flojo o malo: 'subir' (la carga que toque, como cualquier día) o 'igual' (los pesos
// de la última vez). Sin elegir, los de la última vez. Devuelve si la app propone subir carga.
export const subeCarga = (consejo, eleccion) => !consejo?.frenar || eleccion === 'subir';
