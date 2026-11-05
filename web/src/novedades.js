// «Novedades»: lo que sale UNA vez al abrir la app tras actualizarla (una hoja con estas frases y «Vale»). Para editar a mano.
// · La clave es la versión sin el último número (la de package.json: 0.65.0 → '0.65'); los arreglos (0.63.1) no tienen hoja.
// · atleta: hasta tres frases cortas y claras para los atletas. coach: las del coach, solo si hay algo para él (si no, no le
//   sale nada).
// · Si alguien se ha saltado versiones, ve las de todas juntas, de la más nueva a la más antigua (como mucho 5 frases).
// · No sale nunca la primera vez que se abre la app en un móvil ni a una cuenta nueva, ni en mitad de una sesión (espera a
//   la próxima vez que se abre Hoy).
export const NOVEDADES = {
  '0.70': {
    atleta: [
      'Compañeros de racha: invita a hasta 3 del equipo y sumad semanas completas juntos 🤝.',
      'Insignias en tu perfil del equipo, con la siguiente que te queda y cuánto te falta.',
      'Retos nuevos: por equipos, de minutos de cardio y de semanas completas.',
    ],
    coach: [
      'Retos: plantillas de un toque, por equipos (repartidos igualados), de minutos de cardio y de semanas completas. Necesita la migración 042.',
    ],
  },
  '0.69': {
    atleta: [
      'En Equipo: da la bienvenida a quien entra, responde a un comentario y dale 💪.',
      'Mira quién está entrenando ahora y mándale ánimo 🙌 (tú sales solo si lo enciendes en los ajustes del equipo).',
      'Nuevo ajuste: compartir tus entrenos sin preguntar, con «Deshacer». Y el domingo, el resumen de la semana del equipo.',
    ],
    coach: [
      'Equipo: bienvenida a los nuevos, «Entrenando ahora», respuestas y 💪 a comentarios y un resumen el domingo. Necesita la migración 041.',
    ],
  },
  '0.68': {
    atleta: [
      'Cada día, al abrir la app, un saludo con lo que te toca, tu racha o un empujón si llevas días sin entrenar.',
    ],
  },
  '0.67': {
    coach: [
      'Nueva pestaña «Revisión semanal»: tus atletas, lo que pide tu atención, una casilla de revisado y una nota para la semana siguiente.',
    ],
  },
  '0.66': {
    atleta: [
      '«Modo gimnasio» (Perfil → Este móvil): en la sesión, cifras y botones más grandes y más contraste, para leer de lejos.',
    ],
    coach: [
      '«💪 Bien hecho» con un toque en la Actividad de cada atleta: le llega en el hilo de ese entreno.',
    ],
  },
  '0.65': {
    atleta: [
      'Funciona sin cobertura: si en el gimnasio no hay señal, Hoy y tu sesión se abren igual, al momento.',
      'Lo que apuntes sin conexión se guarda en el móvil y se envía solo al volver la señal, sin repetirse.',
    ],
    coach: [
      'Tus atletas abren su sesión y apuntan aunque no tengan cobertura: te llega todo en cuanto vuelven a tener señal.',
    ],
  },
  '0.64': {
    atleta: [
      '«Máquina ocupada»: deja un ejercicio para luego o cambia el orden de lo que te queda de la sesión.',
    ],
    coach: [
      'En Registro ves «Hecho en otro orden» cuando un atleta cambia el orden de su sesión.',
    ],
  },
  '0.63': {
    atleta: [
      'Teclado propio al apuntar: teclas grandes, −/+ con el salto de cada ejercicio y «Hecha» para marcar la serie.',
      'Desliza una serie hacia la derecha para marcarla como hecha.',
      'En el descanso, «Ahora toca» te dice la serie siguiente con sus kilos.',
    ],
  },
};
