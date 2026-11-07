// «Novedades»: lo que sale UNA vez al abrir la app tras actualizarla (una hoja con estas frases y «Vale»). Para editar a mano.
// · La clave es la versión sin el último número (la de package.json: 0.65.0 → '0.65'); los arreglos (0.63.1) no tienen hoja.
// · atleta: hasta tres frases cortas y claras para los atletas. coach: las del coach, solo si hay algo para él (si no, no le
//   sale nada).
// · Si alguien se ha saltado versiones, ve las de todas juntas, de la más nueva a la más antigua (como mucho 5 frases).
// · No sale nunca la primera vez que se abre la app en un móvil ni a una cuenta nueva, ni en mitad de una sesión (espera a
//   la próxima vez que se abre Hoy).
export const NOVEDADES = {
  '0.98': {
    atleta: [
      'Las pestañas siguen al dedo, las cifras se cambian arrastrándolas o manteniendo pulsado y los interruptores se arrastran.',
      'El descanso se alarga o acorta deslizando sobre el reloj y una comida se marca deslizándola.',
      'La tarjeta de Hoy tiene profundidad y su luz cambia con la hora, y la sesión deja arriba el ejercicio en curso.',
    ],
  },
  '0.97': {
    atleta: [
      'Puedes deslizar con el dedo entre las pestañas de Progreso, Equipo y Comidas, y las cifras ruedan al sumar y restar.',
      'Las fotos del equipo se abren en grande desde su sitio y las recetas sin foto llevan su dibujo.',
      'El tema se funde al cambiarlo y el carné estrena la marca nueva.',
    ],
    coach: [
      'El reproductor de vídeo es el de la casa.',
    ],
  },
  '0.96': {
    atleta: [
      'Pasar de un sitio a otro es más suave: el dibujo de la sesión viaja de Hoy a su portada y el lobo se dibuja al arrancar.',
      'Las filas se abren sin saltos, las tiras se funden por el borde por el que sigue habiendo cosas y la semana completa se celebra una vez.',
      'Y responde a las manos: un toque al cambiar de pestaña (en Android), botones que enseñan cuándo han terminado y campos que avisan.',
    ],
    coach: [
      'Pasar de un sitio a otro es más suave, los botones enseñan cuándo han terminado y los campos avisan si algo no vale.',
    ],
  },
  '0.95': {
    atleta: [
      'Las hojas vuelven a cerrarse al momento.',
    ],
    coach: [
      'La app mide cuánto tarda en cada móvil y lo ves en Cuenta → «Cómo va la app», sin nombres. Necesita la migración 049.',
    ],
  },
  '0.94': {
    atleta: [
      'La app tiene más vida: la barra responde al tocarla, el título se recoge al deslizar y cada día tiene su cielo en la tarjeta de Hoy.',
      'El descanso late al final y terminar una sesión se celebra.',
      'Las gráficas responden al dedo, la racha crece con la llama y los récords van en dorado.',
    ],
    coach: [
      'El panel lleva la minigráfica del peso en curva y el estado de cada atleta en su avatar.',
    ],
  },
  '0.93': {
    atleta: [
      'La app se mueve mejor: las gráficas se dibujan, las cifras suben, lo que carga aparece con suavidad y marcar una serie se nota.',
      'La tarjeta de Hoy lleva el dibujo de tu sesión y las tarjetas para compartir estrenan la marca nueva.',
    ],
  },
  '0.92': {
    atleta: [
      'La app abre al instante con lo último que viste y se pone al día sola; ya no vuelve a cargar lo que acabas de ver.',
      'El peso, los hábitos y las comidas se pueden apuntar sin cobertura.',
      'Las actualizaciones pesan mucho menos.',
    ],
    coach: [
      'Mensajes, la lista de atletas, Revisar y la biblioteca cargan mucho menos (con la migración 048).',
      'La biblioteca de recetas ya no pinta todas de golpe.',
    ],
  },
  '0.91': {
    atleta: [
      'La sesión es más clara: la propuesta de cada ejercicio y la serie que toca se ven mejor, y el descanso lleva su etiqueta.',
      'Quien solo lleva nutrición tiene su bienvenida del día.',
    ],
    coach: [
      'El editor del programa en el móvil va en tarjetas, sin deslizar de lado.',
      '«A quién escribir» y la Revisión semanal resaltan una sola acción por atleta.',
    ],
  },
  '0.90': {
    atleta: [
      'La app abre y cambia de pantalla más rápido, y gasta menos datos: las fotos de perfil van en pequeño y se amplían al tocarlas.',
    ],
    coach: [
      'Listas y fichas más rápidas. Con la migración 047, las fotos de perfil se aligeran solas la primera vez que abres la app.',
    ],
  },
  '0.89': {
    atleta: [
      'Nueva portada al abrir la app.',
      'La bienvenida del día ahora te enseña cómo vas: lo que toca, tu semana, tu racha y tus últimas 12 semanas.',
    ],
  },
  '0.88': {
    atleta: [
      'Los títulos de las pantallas tienen todos el mismo tamaño.',
    ],
  },
  '0.87': {
    atleta: [
      'El muro del equipo empieza por las publicaciones: Próximos, Compañeros de racha y los resúmenes se abren tocando su pastilla.',
      'El cuadro de publicar se despliega al tocarlo.',
    ],
  },
  '0.86': {
    coach: [
      '«A quién escribir»: cuánto contacto llevas con cada atleta, a quién toca escribir hoy y por qué, con un borrador corto.',
    ],
  },
  '0.85': {
    atleta: [
      'Todo responde al pulsar, no pierdes el sitio al volver y «atrás» cierra lo último que abriste.',
      'Tira hacia abajo para recargar. Al marcar una serie suena un tic suave (se quita en Ajustes → Sonido al marcar una serie).',
    ],
    coach: [
      'Las listas (atletas, Revisar, mensajes) salen al momento al volver a ellas, y se ponen al día solas.',
    ],
  },
  '0.84': {
    atleta: [
      'El muro del equipo va más prieto: las publicaciones quedan más arriba.',
    ],
  },
  '0.83': {
    atleta: [
      'La pantalla de entrada tiene los colores de la portada.',
    ],
  },
  '0.82': {
    atleta: [
      'Los dibujos de cada ejercicio son más grandes.',
    ],
    coach: [
      'El editor del programa es más compacto: cada ejercicio en una línea con sus opciones debajo.',
    ],
  },
  '0.81': {
    coach: [
      'Recetario: «Comprobar con el plan» (ficha) y «Comprobar recetarios» (Biblioteca) dicen si el día cuadra con su plan y qué corregir.',
    ],
  },
  '0.80': {
    atleta: [
      'Equipo: la tarjeta de bienvenida de quien entra se queda 24 horas en el muro, no una semana.',
    ],
  },
  '0.79': {
    atleta: [
      'Comidas: «Rellenar la semana» te propone el menú de lo que falta con tus recetas. Lo revisas, cambias lo que quieras y lo apuntas.',
    ],
    coach: [
      'Menú semanal (atleta y ficha): «Rellenar la semana» propone lo que falta con su recetario. Solo rellena huecos; nunca borra nada.',
      'En la ficha de un atleta, un botón al final de las pestañas las enseña todas a la vez.',
      'En el ordenador, Mensajes enseña la lista y la conversación a la vez, y la biblioteca de ejercicios va en columnas.',
    ],
  },
  '0.78': {
    atleta: [
      'Los avisos de la primera vez ocupan menos: una nota pequeña que se quita con la equis.',
    ],
    coach: [
      'La lista de atletas en el ordenador tiene una columna de avisos y todas las filas miden lo mismo.',
    ],
  },
  '0.77': {
    atleta: [
      'Progreso ahora se reparte en cuatro pestañas: Resumen, Fuerza, Cuerpo y Logros.',
      'Hoy es más corta: el detalle va en filas que se abren al tocarlas, y se quedan abiertas las que tú dejes.',
    ],
  },
  '0.76': {
    coach: [
      '«Programar según FBE»: reglas propias por atleta y por ejercicio, borrador de la nota de la semana y registro de lo aplicado. Migración 046.',
    ],
  },
  '0.75': {
    atleta: [
      'La barra de abajo ahora tiene cinco botones. Comidas, Check-in, Equipo y tu perfil están en «Más».',
      'Un aspecto más limpio: lo que eliges se ve relleno, las tarjetas más claras y las gráficas más fáciles de leer.',
      'La proteína pasa a violeta, y los hábitos avanzan en morado y se ponen verdes al cumplirse.',
    ],
    coach: [
      'En el móvil, la barra tiene cinco botones: Equipo, Plantillas, Biblioteca, Modo atleta y Cuenta están en «Más».',
    ],
  },
  '0.74': {
    coach: [
      'Editor del programa: «Programar según FBE» propone la semana siguiente con tus reglas. Revisas, marcas y aplicas; nunca publica solo.',
    ],
  },
  '0.73': {
    atleta: [
      'Tu aniversario en FBE se celebra en Hoy 🎉. Del 1 al 7 de cada mes, mira tu mes y el del equipo en Equipo y compártelo.',
      'Momentos de 24 h: sube una foto de tu día en Equipo. Y nuevas reacciones ❤️ 😂 🏆 y pegatinas de FBE en los comentarios.',
    ],
    coach: [
      'Equipo: aniversarios (te aviso el día antes), el mes del equipo, hitos, reacciones, pegatinas y momentos. Necesita la migración 045.',
      'En la ficha, Datos: «Cliente de FBE desde» (el día que contrató). Ponla bien en cada atleta: cuenta para sus aniversarios.',
    ],
  },
  '0.72': {
    atleta: [
      'Eventos y quedadas del equipo: apúntate desde «Próximos» o el muro y añádelos a tu calendario.',
      'Cada semana, tu coach puede elegir al atleta de la semana: sale arriba del muro 🏅.',
    ],
    coach: [
      'Equipo: eventos, avisos programados, plantillas, panel, atleta de la semana y moderación. Necesita la migración 044.',
    ],
  },
  '0.71': {
    atleta: [
      'En el muro: elige un tema, sube hasta 4 fotos y busca por texto o nombre.',
      '¿Una duda? Publícala como «Pregunta para el coach»: las que conteste salen en «Preguntas».',
      'Guarda lo que te sirva («Guardados») y marca la mejor respuesta en tus publicaciones.',
    ],
    coach: [
      'Equipo: temas, preguntas y «Preguntas del equipo», varias fotos, guardados, búsqueda y mejor respuesta. Necesita la migración 043.',
    ],
  },
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
