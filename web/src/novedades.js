// «Novedades»: lo que sale UNA vez al abrir la app tras actualizarla (una hoja con estas frases y «Vale»). Para editar a mano.
// · La clave es la versión sin el último número (la de package.json: 0.65.0 → '0.65'); los arreglos (0.63.1) no tienen hoja.
// · atleta: hasta tres frases cortas y claras para los atletas. coach: las del coach, solo si hay algo para él (si no, no le
//   sale nada).
// · Si alguien se ha saltado versiones, ve las de todas juntas, de la más nueva a la más antigua (como mucho 5 frases).
// · No sale nunca la primera vez que se abre la app en un móvil ni a una cuenta nueva, ni en mitad de una sesión (espera a
//   la próxima vez que se abre Hoy).
export const NOVEDADES = {
  '0.125': {
    atleta: [
      'El descanso entre series tiene vida: una luz recorre el aro y los tres últimos segundos laten.',
      'Al acabar el descanso, el aro se cierra con un destello y el lobo te llama.',
      'Y al abrir la app, estrellas y la luna detrás del lobo; mientras algo carga, una luna que se llena.',
    ],
  },
  '0.124': {
    atleta: [
      'Al terminar la sesión, una escena nueva: se hace de noche, sale la luna y el lobo de FBE se dibuja y aúlla.',
      'Si has hecho un récord, la luna es dorada y caen chispas de oro; si con esa sesión completas la semana, llega la manada.',
      'Un lobo por cada sesión de la semana. Dura tres segundos y se salta tocando.',
    ],
  },
  '0.123': {
    atleta: [
      'Salud del iPhone, más bonita: Conexiones con su corazón, los datos que manda Salud en colores y los pasos para conectarlo unidos.',
      'Lo que ha llegado de Salud, más fácil de leer, y «Apuntar en Salud» al terminar, con su corazón.',
      'Tu música de hoy con su portada y un vinilo, el reproductor con sombra y «Empezar con esta música» con un ecualizador que baila.',
    ],
    coach: [
      'Atajos del iPhone en Cuenta, con su icono y un ✓ verde cuando el enlace está puesto.',
    ],
  },
  '0.122': {
    atleta: [
      'El Equipo, más bonito: cada pastilla con su color, los duelos como un marcador y la hora de quien entrena hoy a la vista.',
      'Retos con la barra que brilla y se vuelve oro al llegar; tu fila resaltada en el ranking y en cada reto.',
      'El muro con el color de cada publicación, encuestas con la ganadora en oro y la respuesta del coach como un bocadillo.',
    ],
  },
  '0.121': {
    coach: [
      'En la ficha, la nutrición con color: el de su fase y el de cada macro, ajuste y gasto más claros y las versiones en línea del tiempo.',
      '«Desde su iPhone» en baldosas que dicen si cada cambio es a mejor o a peor, y comparar dos check-ins se lee de un vistazo.',
    ],
  },
  '0.120': {
    atleta: [
      'Más ilustraciones: el foco de tu semana en Semana y tu cardio con su dibujo según lo que hagas, también al compartirlo.',
      'Cada hito de tu racha con su propio fuego y tu aniversario en FBE con su franja; y la entrada a la app, con fondo nuevo.',
    ],
    coach: [
      'Tus pantallas con cabecera ilustrada: Atletas, Revisar, Revisión semanal, A quién escribir, Programar según FBE y Negocio.',
    ],
  },
  '0.119': {
    atleta: [
      'Al terminar, el esfuerzo en un toque y la duración ya puesta; y si se te olvida cerrar la sesión, la cerramos por ti.',
      'Dicta la nota de la sesión con la voz. El check-in se guarda mientras lo rellenas y puedes copiar el de la semana pasada.',
      'El objetivo de tu bloque, a la vista en Hoy, y hábitos sugeridos según tu cuestionario que activas de un toque.',
    ],
    coach: [
      'En el chat, las cifras del atleta de un vistazo, y «Guardar como…» un mensaje en nota, tarea o recordatorio técnico.',
      'La revisión semanal y «Necesitan atención» te dejan el mensaje escrito; alertas de sesiones sin cerrar y de días sin pesarse.',
      'Vídeos que esperan 3 días o más, arriba en Revisar y en un aviso por la mañana. Necesita la migración 054 (comprobación 31).',
      'En tu modo atleta, Conexiones en Progreso → Cuerpo; y en Atajos del iPhone, «Ir a mis conexiones» para crear tu clave y probar.',
    ],
  },
  '0.118': {
    atleta: [
      'Tus vídeos de técnica, renovados: el vídeo en modo cine, con la rueda y la tira de fotogramas más claras.',
      'La nota de tu coach en su color, de rojo a verde, y cada punto clave con su ✓ o su ✗.',
      'Mi técnica, como una línea del tiempo, y el informe del mes con sus cifras en color.',
    ],
    coach: [
      'Corregir un vídeo es más claro: la nota y los puntos clave con color, cada herramienta en su recuadro y avance en la revisión seguida.',
      'Lo que nota el atleta de su vídeo sale como una cita, con su RPE en color.',
    ],
  },
  '0.117': {
    atleta: [
      'El Equipo, más social: duelos 1 a 1, «Hoy entreno a las…», el compañero de la semana elegido entre todos y encuestas vuestras.',
      'Felicita cumpleaños, anima con palabras, propón quedadas, acompaña a quien entra, cita publicaciones y mira tu huella en el perfil.',
      'Y el Equipo, rematado: entrar es más claro, la foto del momento se elige mejor y quién ha votado o reaccionado se lee de un vistazo.',
    ],
    coach: [
      'El Equipo, más social: duelos, «Hoy entreno a las…», compañero de la semana, encuestas y quedadas de los atletas, álbum y más.',
      'En el Equipo, el Panel con cifras en color y medallas para los más activos, Moderar con su escudo y encuestas con opciones numeradas.',
      'Necesita la migración 053 (comprobación 30 del README). Sin ella, la app sigue como antes.',
    ],
  },
  '0.116': {
    atleta: [
      'Tu perfil suma «Datos» (tu año, costumbres, lo que más entrenas), tus próximos hitos, el color de tu portada y tu tarjeta del año.',
      'Tus cifras frente a la semana pasada, compartir cada récord de tu vitrina y la actividad por meses.',
      'Compartir, aún más: paletas, póster, antes y ahora, carrusel, versión animada, tu frase y la lista de lo que has compartido.',
    ],
    coach: [
      'El perfil de tus atletas suma «Datos» (su año, costumbres, grupos y ejercicios), próximos hitos y su tarjeta para compartir.',
      'Compartir, aún más: paletas, póster, antes y ahora, carrusel y versión animada.',
    ],
  },
  '0.115': {
    atleta: [
      'Compartir, a lo grande: formato historia, plantilla clara, pegatinas, tu @ y el texto listo para Instagram, WhatsApp o Facebook.',
      'Tarjetas nuevas para tus récords, tu racha y tu semana completa, y publícalas en el equipo con un toque.',
      'Más vida en el Equipo: retos de rojos contra azules, el ranking en discos, insignias como medallas y quien entrenó hoy, con aro verde.',
    ],
    coach: [
      'Tus atletas comparten más fácil: historia, plantilla clara, pegatinas, texto listo y tarjetas de récord, racha y semana completa.',
      'En Equipo, «Compartir la semana del equipo»: una tarjeta solo con recuentos para tu Instagram. Pon tu @ en web/config.js (instagram).',
      'Más vida en el Equipo: retos de rojos contra azules, el ranking en discos, insignias como medallas y quien entrenó hoy, con aro verde.',
    ],
  },
  '0.114': {
    atleta: [
      'Tu perfil estrena portada, el aro de tu racha y tu porqué, con tus cifras, 12 semanas, vitrina, medallas, hitos y últimos entrenos.',
      'Si estás en el equipo, en tu perfil verás quién te ha animado y «Ver cómo te ven tus compañeros».',
      'El Equipo, con más vida: momentos con aro, cada publicación con su color, récords en dorado, encuestas en color y el podio.',
    ],
    coach: [
      'El perfil de cada atleta (y el del equipo) se ve más bonito: portada, aro de la racha, cifras, vitrina, hitos y galería de fotos.',
      'El Equipo, con más vida: momentos con aro, cada publicación con su color, récords en dorado, encuestas en color y el podio.',
    ],
  },
  '0.113': {
    coach: [
      'La actividad de cada atleta, como una línea del tiempo con el color de cada cosa; el registro, con el color del esfuerzo.',
      'Las sesiones por revisar, resaltadas; los objetivos con su barra, las notas privadas como pósits y los cobros con su estado.',
      'En Cuenta, mensajes y música con iconos; cargas sugeridas y «Programar según FBE», más claros; grupos musculares con color.',
    ],
  },
  '0.112': {
    atleta: [
      '¿Tus discos van en libras? En tu perfil, «Este móvil» → «Unidad de las cargas»: apuntas y ves las cargas en libras.',
      'Lo que te propone la app sale redondeado a lo que se carga en libras, y los −/+ del teclado suben de 5 en 5.',
    ],
    coach: [
      'Tus atletas pueden ver sus cargas en libras (un ajuste de su móvil). Se guarda en kilos: tú lo ves todo igual, en kilos.',
    ],
  },
  '0.111': {
    coach: [
      'La barra lateral con iconos de colores, «Hoy en tu equipo» en tres tarjetas y, en Revisar, cada tarjeta con el color de lo que es.',
      'En la ficha, el halo del estado, chips con color y pestañas con icono; la Revisión semanal, con su casilla verde y su sello.',
      'Las semanas del editor dicen si están publicadas o en borrador; el buscador (Ctrl K), como Spotlight; la biblioteca, con color por grupo.',
    ],
  },
  '0.110': {
    atleta: [
      'Nuevo en tu perfil, «Conexiones»: trae de Salud del iPhone tus pasos, sueño, pulso, HRV y peso, y tu check-in vendrá relleno.',
      'Tus entrenos, en tu calendario (iPhone o Google): se actualiza solo cuando cambia el plan.',
      'Al terminar una sesión en el iPhone, «Apuntar en Salud» la guarda también en Salud.',
    ],
    coach: [
      'En la ficha, «Desde su iPhone» (sueño, pulso, HRV y pasos) y su WhatsApp; en Cuenta, los atajos del iPhone para tus atletas.',
      'Necesita la migración 051 y desplegar la función «integraciones» (sin «Verify JWT»). La guía, en el proyecto.',
    ],
  },
  '0.109': {
    atleta: [
      'La cuenta de series rueda al marcar, el consejo del día tiene su color y el modo enfoque celebra cada ejercicio hecho.',
      'Al terminar, una barrita te sitúa en la escala del esfuerzo; los récords de hoy y tu mejor marca de cada ejercicio, en dorado.',
      'En Hoy, el progreso de cada ejercicio en su aro; en la semana, las sesiones hechas con sello verde y la nota de tu coach con su lobo.',
    ],
  },
  '0.108': {
    atleta: [
      'Entrenar fluye: el foco pasa de serie a serie con suavidad, la insignia gira a verde al marcarla y el aro se cierra con un salto.',
      'El descanso llega con muelle, el teclado es de vidrio, la superserie lleva su hilo y el modo enfoque estrena cara.',
      'Tu nota va como un pósit, el historial en hojas de calendario, los récords en una vitrina de oro y la calculadora con tu 1RM grande.',
    ],
    coach: [
      'El historial de cada ejercicio, con hojas de calendario.',
    ],
  },
  '0.107': {
    atleta: [
      'En la portada, «Tu música de hoy»: la lista de tu coach para esa sesión o la tuya, con su portada, y «Empezar con esta música».',
      'Pon tu canción de récord en «Lo tuyo»: sale cuando bates uno; y en cardio, un metrónomo para llevar tu cadencia.',
      '«Tu mes» y «Tu año» cuentan las sesiones con música; y en Equipo está la lista colaborativa del equipo.',
    ],
    coach: [
      'En Cuenta › Música, tus listas por tipo de sesión, de descarga, del equipo y al ritmo de cada cardio.',
      'En el editor, música para una sesión o un bloque. Necesita la 050 nueva: ejecútala aunque ya ejecutaras la anterior.',
    ],
  },
  '0.106': {
    atleta: [
      'El ejercicio en curso brilla y su progreso se llena en un aro; la pauta va en chips y la serie top y las back-off llevan insignia.',
      'La sugerencia de carga es una tarjeta de color, el descanso tiene luz y, al terminar, el esfuerzo se elige en una escala de color.',
      'En la semana, la sesión que toca destaca y cada entreno lleva el color de su esfuerzo; los récords, en dorado también en tus marcas.',
    ],
  },
  '0.105': {
    atleta: [
      'Tu coach te habla con su lobo en Hoy y en la sesión, la fecha va en una pastilla y la cabecera brilla al bajar.',
      'En «¿Cómo llegas hoy?» cada respuesta tiene su color; los botones + y − son redondos y las casillas, como en Recordatorios.',
      'El ejercicio terminado se enmarca en verde, las barras de progreso brillan y los músculos más trabajados resaltan en el mapa.',
    ],
  },
  '0.104': {
    atleta: [
      'Nuevo en tu perfil, «Lo tuyo»: cómo quieres que te llamemos, tu porqué, tus tres ejercicios, tu música y tu cumpleaños.',
      'Progreso abre con la cifra de tu objetivo, la portada te dice qué récord tienes al alcance y el plan coloca tus días de siempre.',
      'Tu coach puede dejarte mensajes para tus récords, tu racha o tu cumpleaños; y en diciembre llega «Tu año en FBE».',
    ],
    coach: [
      'En Cuenta, tus mensajes automáticos (récord, bloque, racha, vuelta y cumpleaños); en Atletas, quién cumple años hoy.',
      'En la ficha, pestaña Objetivos, «Lo suyo»: el apodo, el porqué, el cumpleaños y la música de cada atleta. Necesita la migración 050.',
    ],
  },
  '0.103': {
    atleta: [
      'Tus medallas son ilustraciones propias, cada una en su metal; el cuarto nivel pasa a llamarse Diamante.',
      'Tu mes, el check-in, las celebraciones y la bienvenida del día llevan su ilustración.',
      'También el metrónomo, los intervalos, «¿Dónde entrenas hoy?», la entrada al equipo y tu carné.',
    ],
  },
  '0.102': {
    atleta: [
      'Los récords brillan en dorado, tus entrenamientos parecen hojas de calendario y cada comida del menú lleva su dibujo.',
      'Hoy estrena detalles: el aviso de tu coach como un mensaje, la llama de tu racha encendida y una celebración al terminar el día.',
      'En Progreso, las semanas y los meses tienen portada y los hábitos se ponen en verde; en la sesión, el cronómetro brilla.',
    ],
  },
  '0.101': {
    atleta: [
      'Cada hábito tiene su ilustración al abrirlo y tu recetario, una para cada comida.',
      'La ficha de cada ejercicio lleva la estatua de su músculo principal.',
      'Las tarjetas para compartir llevan ilustración: montañas al terminar un bloque, rayos dorados si hubo récord, llamas en tu mes.',
    ],
    coach: [
      'La ficha de cada ejercicio lleva la estatua de su músculo principal y la biblioteca, al filtrar por grupo, la suya.',
      'El recetario, con una ilustración para cada comida.',
    ],
  },
  '0.100': {
    atleta: [
      'En Hoy cada cosa tiene su color y lo que haces se marca con un ✓; los resúmenes de la semana y del mes tienen portada.',
      'Tu perfil estrena cabecera, las respuestas de tu coach se leen como un mensaje y la entrada al Equipo tiene su dibujo.',
      'En la sesión, las casillas son más ligeras y «Terminar sesión» se ilumina cuando lo tienes todo.',
    ],
    coach: [
      'En el ordenador, barras de desplazamiento más finas.',
    ],
  },
  '0.99': {
    atleta: [
      'Cada sesión tiene su ilustración en la portada y al terminar: empuje, tirón, pierna, full body…',
    ],
  },
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
