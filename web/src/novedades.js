// «Novedades»: lo que sale UNA vez al abrir la app tras actualizarla (una hoja con estas frases y «Vale»). Para editar a mano.
// · La clave es la versión sin el último número (la de package.json: 0.65.0 → '0.65'); los arreglos (0.63.1) no tienen hoja.
// · atleta: hasta tres frases cortas y claras para los atletas. coach: las del coach, solo si hay algo para él (si no, no le
//   sale nada).
// · Si alguien se ha saltado versiones, ve las de todas juntas, de la más nueva a la más antigua (como mucho 5 frases).
// · No sale nunca la primera vez que se abre la app en un móvil ni a una cuenta nueva, ni en mitad de una sesión (espera a
//   la próxima vez que se abre Hoy).
export const NOVEDADES = {
  '0.247': {
    // (FBE Esencial acompañado, tanda 6 de 6: automatizaciones, la vida real; migración 101)
    atleta: [],
    coach: [
      'FBE Esencial, la vida real: «Me voy de viaje» con fechas (sin avisos esos días), «Me duele algo», cambiar un ejercicio y un objetivo.',
      'En tu panel de FBE Esencial, la semana de un vistazo: cuántos han entrenado, cuántos la tienen completa y quién está de viaje.',
    ],
  },
  '0.246': {
    // (FBE Esencial acompañado, tanda 5 de 6: que no entrenen solos; migración 100)
    atleta: [],
    coach: [
      'FBE Esencial acompaña: un saludo cada día, «¿Qué tal las agujetas?», la vuelta tras un parón, el reto de la semana y «Tu trimestre».',
      'En tu panel de FBE Esencial: «A quién escribir» con el mensaje preparado, las preguntas para el directo y «¿Cómo vamos?».',
    ],
  },
  '0.245': {
    // (FBE Esencial acompañado, tanda 4 de 6: respuestas, todo explicado; sin migración)
    atleta: [],
    coach: [
      'FBE Esencial explica cada decisión: «Tu revisión de la semana», el «¿Por qué?» de cada ejercicio y «Tu sesión, en claro» al terminar.',
      'Y contesta: un centro de respuestas con buscador, «¿Qué necesitas?» en Hoy, «Tu plan, explicado» y «Lo de hoy» antes de cada sesión.',
    ],
  },
  '0.244': {
    // (FBE Esencial: las ilustraciones de sus tarjetas; sin migración)
    atleta: [],
    coach: [
      'FBE Esencial, con ilustraciones propias: la tarjeta de antes de empezar, la bienvenida, la lección de cada semana y sus tarjetas.',
    ],
  },
  '0.243': {
    // (FBE Esencial sin coach, tanda 3 de 3: su rutina; migración 099)
    atleta: [],
    coach: [
      'FBE Esencial, su rutina: quien tiene experiencia contesta «Tus gustos» y elige entre dos o tres recomendadas de tu catálogo.',
      'Si no elige, la víspera de su lunes a las 22:00 se le deja preparada la de su cuestionario. El cierre del domingo pasa a las 22:00.',
      'En Plantillas, la estrella mete o saca cada plantilla del catálogo. En su panel, «Sus rutinas»: quién se sale de lo recomendado.',
    ],
  },
  '0.242': {
    // (FBE Esencial sin coach, tanda 2 de 3: el cierre de la semana; migración 098)
    atleta: [],
    coach: [
      'FBE Esencial, su semana sola: el domingo a las 21:00, si no la han acabado, eligen pasar a la siguiente o repetirla.',
      'Si a las 23:30 no han elegido, se les pasa a la siguiente y se les avisa. También pueden poner una semana en pausa.',
      'Con la semana hecha pueden adelantar la primera sesión de la siguiente. En su panel ves quién repite o está en pausa.',
    ],
  },
  '0.241': {
    // (FBE Esencial sin coach, tanda 1 de 3: lo que ve quien va por su cuenta, sin «tu coach»; sin migración)
    atleta: [],
    coach: [
      'FBE Esencial sin coach (tanda 1 de 3): en lo que ve quien va por su cuenta ya no sale «tu coach» en ninguna pantalla.',
      'No suben vídeos de técnica ni ven lo que depende de un coach: mensajes, correcciones, tareas, su medalla y esas guías.',
      'Su check-in les dice qué hace la app con él y, con una molestia moderada o grave, qué hacer y cuándo consultar.',
    ],
  },
  '0.240': {
    // (el alta de FBE Esencial, tandas 2 y 3 de 3: del cuestionario a su plan y su primera semana; sin migración)
    atleta: [],
    coach: [
      'FBE Esencial, el alta (tandas 2 y 3): su cuestionario, más corto y con por qué se pregunta cada cosa, sigue donde lo dejó.',
      'Antes de su lunes ven su camino, un consejo al día y su semana 1 con «Cómo se hace»; eligen sus días y cada sesión va a su día.',
      'Su primera semana, guiada: la primera sesión, «¿Qué peso pongo?», si pierden una, «Semana 1 hecha» y sus preguntas frecuentes.',
    ],
  },
  '0.239': {
    // (el alta de FBE Esencial, tanda 1 de 3: de la invitación a la cuenta activa)
    atleta: [],
    coach: [
      'La invitación lleva un enlace que abre «Activa tu cuenta» con el código puesto; los de FBE Esencial valen hasta su lunes + 7 días.',
      'En el panel de FBE Esencial: el embudo del alta, quién no ha activado su cuenta (con «Mandar otra vez») y sus avisos.',
      'Y cada uno ve por qué no vale su código, su bienvenida con su lunes y cómo activar los avisos (migración 097).',
    ],
  },
  '0.238': {
    // (FBE Esencial: lo que aprobó Pelayo el 25/11; para los atletas de ahora no cambia nada)
    atleta: [],
    coach: [
      'FBE Esencial: desde la semana 5 pueden pasar a tres días (el día 2, las alternativas) o volver a dos (migración 096).',
      'Si se estancan tres semanas, la app baja un 10 % para volver a subir; la plancha, como mucho 20 kg.',
      'Y en Hoy, «Lo de esta semana»: una lección de tus guías cada semana, de la 1 a la 8.',
    ],
  },
  '0.237': {
    // (FBE Esencial: el aviso del cuestionario y dos cifras más en el panel; para los atletas de ahora no cambia nada)
    atleta: [],
    coach: [
      'FBE Esencial: si alguien activó su cuenta y no ha enviado el cuestionario, la app se lo recuerda antes de su lunes (migración 095).',
      'En el panel de FBE Esencial ves también quién aún no ha activado su cuenta y qué parte de las series pautadas hacen.',
    ],
  },
  '0.236': {
    // (FBE Esencial: altas en grupo; para los atletas no cambia nada)
    atleta: [],
    coach: [
      'FBE Esencial: en «Añadir atleta», «¿Son varios?»: pega la lista (de Stripe o a mano) y dalos de alta de una vez.',
      'Después, el mensaje de cada uno, listo para mandarlo por correo, y la lista de sus códigos para guardarla.',
    ],
  },
  '0.235': {
    // (FBE Esencial, el piloto; para los atletas de ahora no cambia nada)
    atleta: [],
    coach: [
      'FBE Esencial, en Atletas: el piloto de un vistazo (quién entrena, sus avisos y el listón) y las encuestas de las semanas 6 y 12.',
      'Si en su gimnasio falta una máquina, la cambian para siempre; y a los 7 días sin entrenar les llega un aviso amable (migración 094).',
      'En Avisos, ahora puedes mandar uno solo a los de FBE Esencial o solo a los que llevan seguimiento.',
    ],
  },
  '0.234': {
    // (FBE Esencial, tanda 4: la comida de quien va por su cuenta; para los atletas de ahora no cambia nada)
    atleta: [],
    coach: [
      'FBE Esencial con nutrición: la app calcula su plan de comida y lo ajusta cada semana, con tus límites (necesita la migración 093).',
      'Con un trastorno de la conducta alimentaria, su plan es de mantener y nunca baja solo. Lo ves en su ficha (Datos).',
    ],
  },
  '0.233': {
    // (FBE Esencial, tanda 3: la semana 5 en adelante, sola; para los atletas de ahora no cambia nada)
    atleta: [],
    coach: [
      'FBE Esencial: desde la semana 5, la app prepara sola cada semana de quien va por su cuenta, con tus reglas (necesita la migración 092).',
      'La plancha sube 5 s por semana hasta 50; después, con peso (5 kg y luego 2,5 más), otra vez desde 35-45 s.',
    ],
  },
  '0.232': {
    // (FBE Esencial, tandas 1 y 2: para los atletas de ahora no cambia nada; lo nuevo es del coach y de quien va por su cuenta)
    atleta: [],
    coach: [
      'FBE Esencial: en «Añadir atleta», la modalidad FBE Esencial con su lunes de inicio y su mensaje de invitación (necesita la migración 091).',
      'Quien va por su cuenta no sale en Revisar ni en la revisión semanal. En su ficha (Datos): su cuestionario, su visto bueno médico y su plan.',
    ],
  },
  '0.231': {
    // (los frenos del motor para quien vaya por su cuenta: hoy no hay nadie así y con seguimiento no cambia nada; sin hoja)
    atleta: [],
    coach: [],
  },
  '0.230': {
    atleta: [
      'Después de tu carrera, apunta tu tiempo en «Tu carrera»: verás lo que hiciste frente a lo previsto, y tu coach también.',
    ],
    coach: [
      'Tus corredores apuntan el resultado de su carrera desde la app (necesita la migración 090).',
    ],
  },
  '0.229': {
    atleta: [
      'La semana de tu carrera, en «Tu carrera»: tu plan para el día, con el ritmo, tus pasos, qué comer y beber y qué hacer con calor.',
    ],
    coach: [
      'La semana de su carrera ves lo que verá el día; después, su resultado frente a lo previsto, su ritmo umbral nuevo y la recuperación.',
    ],
  },
  '0.228': {
    atleta: [
      'Tras una salida dura o con dolor, Hoy te pregunta cómo te has levantado: así tu coach ajusta la semana.',
      'Si tomas un fármaco que cambia el pulso, tus zonas van por esfuerzo y el test del habla.',
    ],
    coach: [
      '«Salud para correr» en la ficha: enfermedad o síntomas con su visto bueno, fármacos que cambian el pulso y más de 60 o lesión.',
      'La mañana siguiente de cada corredor, en sus avisos y en el ajuste: el dolor de hueso no entra en el límite de 5/10.',
      'Rehacer el plan con la vuelta según la lesión: tendón, hueso de bajo riesgo o de alto riesgo (esa la pauta su médico).',
    ],
  },
  '0.227': {
    atleta: [
      'Tu carrera: las señales para parar y ver al médico, más completas, y cómo volver a correr después de una fiebre.',
      'Tus zonas te dicen cuándo manda el esfuerzo (series cortas, cuestas, calor) y tu ritmo de 5 km para las series más rápidas.',
    ],
    coach: [
      'Carrera revisada por un experto: aviso si una salida pasa en más de un 10 % la más larga del mes, y tirada larga según sus días.',
      'El asistente del plan propone el nivel, avisa en rojo si no llega bien a la carrera y tiene casillas para mayores de 60 o lesión.',
      'En maratón, un tiempo previsto más realista (un 2-10 % por encima de Riegel), y la FC máxima sin medir, estimada por la edad.',
      'Avisos, ajuste y revisiones, con los mismos cortes (90 y 70 % de lo previsto) y sin revisiones en rojo por un mal día de pulso.',
    ],
  },
  '0.226': {
    atleta: [],
    coach: [
      'En el ordenador, al revisar un vídeo, el cuadro para escribir y «Dibujar sobre el vídeo» van debajo del vídeo, siempre a la vista.',
    ],
  },
  '0.225': {
    atleta: [],
    coach: [
      'Con la migración 088, a quien va por microciclos y corre se le coloca sola la carrera de la semana, aunque no abras la app.',
    ],
  },
  '0.224': {
    atleta: [
      'En tus sesiones de series, «Guiarme por las partes»: un cronómetro que te va diciendo cada tramo, también en voz alta.',
    ],
    coach: [],
  },
  '0.223': {
    atleta: [
      'En «Tu carrera»: tu forma aeróbica (si con el mismo pulso vas más rápido) y tus carreras al calendario del móvil.',
    ],
    coach: [
      'Carrera: las revisiones se rellenan solas con los datos de las dos semanas, y la gráfica de su forma aeróbica.',
    ],
  },
  '0.222': {
    atleta: [],
    coach: [
      'Carrera: avisos de riesgo (subida brusca, dolor, semáforos, días duros seguidos) y el ajuste de la semana, en un toque.',
      'En Atletas, tus corredores de un vistazo. Y en el editor, si una calidad cae pegada a la pierna, te propone moverla.',
    ],
  },
  '0.221': {
    atleta: [],
    coach: [
      'Carrera: el asistente de plan. Le das la carrera, sus días, lo que corre y su nivel, y te propone todas las semanas.',
      'En las semanas: «Rehacer desde esta semana» (con vuelta a correr tras una molestia) y copiar la anterior un 5 o un 10 % más.',
    ],
  },
  '0.220': {
    atleta: [],
    coach: [
      'En el ordenador, los vídeos de técnica se revisan en columnas: el vídeo con todos sus mandos, la corrección y el hilo, a la vez.',
    ],
  },
  '0.219': {
    atleta: [
      'Si tu coach te pone tu ritmo umbral, cada zona de tus carreras te dice también a qué ritmo ir, en minutos por kilómetro.',
      'En cada sesión de carrera, una línea con para qué sirve. Y en «Tu carrera», tu tiempo previsto con tu última carrera.',
    ],
    coach: [
      'Ritmo umbral desde una carrera reciente en un toque (Zonas y test), y los ritmos de cada zona. Sin FC umbral, zonas por FC de reserva.',
      'La biblioteca FBE: 26 sesiones de carrera listas en «Desde la biblioteca». Y al preparar una carrera, el tiempo objetivo previsto.',
    ],
  },
  '0.218': {
    atleta: [
      'Si entrenas por microciclos y tienes plan de carrera, te salen las carreras de esta semana, vayas como vayas con la fuerza.',
      'La tarjeta «Tu carrera» de Hoy vuelve a verse bien y debajo tienes tu próxima carrera, para abrirla de un toque.',
    ],
    coach: [
      'La carrera de quien va por microciclos va sola por calendario: cada semana se le ponen las de su plan en el microciclo que lleve.',
      'Al duplicar su semana ya no se copian las carreras, y el recuadro Carrera del editor se ve bien (el dibujo salía enorme).',
    ],
  },
  '0.217': {
    // (solo detalles: una luna de más en la entrada, «Te quedan» en tableta y casillas del coach; no merece hoja propia)
    atleta: [],
    coach: [],
  },
  '0.216': {
    atleta: [
      'En tableta y ordenador la app aprovecha mejor la pantalla: Equipo va a dos columnas y Progreso y tu perfil quedan mejor repartidos.',
      'Con la letra grande o muy grande, las filas de tu perfil ya no parten palabras: el valor va debajo del título.',
    ],
    coach: [],
  },
  '0.215': {
    atleta: [
      'En un móvil pequeño o con la letra grande, el nombre de la sesión cabe en la cabecera: el reloj va junto a los tramos.',
      'Retoques en Hoy, la sesión y el descanso: textos sin palabras sueltas, superseries alineadas y el mapa de músculos más claro en oscuro.',
    ],
    coach: [],
  },
  '0.214': {
    atleta: [
      'Al cambiar de pestaña o abrir una pantalla, el móvil trabaja menos para dibujarla.',
    ],
    coach: [
      'El editor de bloques cambia de semana con menos tirones.',
    ],
  },
  '0.213': {
    // (sin frase para el atleta: lo suyo de esta versión, Progreso al volver, ya lo dice la 0.212 y salían dos casi iguales)
    atleta: [],
    coach: [
      'La ficha de cada atleta, Revisar, la revisión semanal y el radar van más ligeros con mucho historial.',
    ],
  },
  '0.212': {
    atleta: [
      'Semana, Progreso y tu perfil salen antes al volver a ellos, aunque lleves años apuntando.',
    ],
    coach: [
      'Al abrir la app, la lista de atletas ya no da tirones mientras van llegando sus datos.',
    ],
  },
  '0.211': {
    atleta: [
      'Durante la sesión, el móvil trabaja mucho menos mientras descansas: el reloj del descanso y el punto verde ya no gastan batería sin parar.',
      'Escribir en el chat va fluido aunque la conversación tenga meses de mensajes.',
      'Hoy se abre antes aunque lleves años apuntando: ya no repasa todo tu historial cada vez que vuelves.',
    ],
    coach: [
      'La Biblioteca de ejercicios abre antes, aunque tenga cientos: solo se dibuja lo que ves.',
      'En los chats largos, escribir ya no se traba, y las tablas anchas (récords, check-ins, atletas) se pueden mover con el teclado.',
    ],
  },
  '0.210': {
    atleta: [
      'Abrir una sesión y Hoy va más rápido: la app pide a la vez lo que antes pedía una cosa detrás de otra.',
      'Si el servidor tiene un mal rato, tus series esperan en el móvil y se mandan solas luego. Un doble toque sin querer en ✓ ya no la desmarca.',
    ],
    coach: [
      'Cada pantalla trae sus estilos al abrirla: tus atletas descargan menos al entrar y todo se ve igual que antes.',
      'El aviso de cumpleaños habla en plural cuando cumplen varios.',
    ],
  },
  '0.209': {
    atleta: [
      'Si tu móvil va lento, la app se pone ligera sola: sin cristal ni adornos que se mueven. También lo puedes elegir en Ajustes.',
      'Más fluida en Android: la app ya no repasa toda la pantalla con cada cambio, y el cielo de Hoy se para mientras no lo ves.',
    ],
    coach: [
      'Cuenta te avisa si a tu base le falta una migración. La copia completa ya lleva todas tus tablas, y Recuperar un atleta, lo nuevo.',
      'Tus estilos van aparte: el móvil de tus atletas descarga y procesa unos 150 KB menos al abrir la app.',
    ],
  },
  '0.208': {
    atleta: [
      'Hoy abre antes: al entrar, la app pide a la base la mitad que antes y carga menos; lo que sale al tocar algo, se carga entonces.',
      'Si haces la etapa del día de La travesía sin cobertura, ya no se pierde: se guarda en el móvil y se manda al volver la conexión.',
    ],
    coach: [
      'Tu app pide menos a la base al abrirse. Y el móvil de tus atletas ya no guarda tu app de coach: casi 1 MB menos en cada actualización.',
    ],
  },
  '0.207': {
    atleta: [
      'La app abre más ligera: cada pantalla se carga al abrirla (y por detrás, con la app quieta), así que Hoy sale antes.',
      'Si la app se actualiza con ella abierta, se recarga sola y entra; y al despertar el móvil tras una hora, ya no da error.',
      'Si al volver a Hoy toca celebrar un hito de la racha y una medalla, salen una detrás de otra, no una encima de la otra.',
    ],
    coach: [
      'Revisar, la ficha, la Revisión semanal y la lista de atletas cargan más rápido: lo de cada atleta se pide a la vez.',
      'Errores de la app, agrupados: cuántas veces, a cuántas personas, en qué versiones y si es nuevo; lo que se arregla solo, aparte.',
    ],
  },
  '0.206': {
    coach: [
      'Registro por ejercicios o por sesiones, con la semana arriba, su minilínea y si se pasa del esfuerzo pautado.',
      'Toca una serie para comentarla; compara dos sesiones, cópialas como texto y descarga el bloque en hoja de cálculo.',
      'Actividad: «Para mirar», el calendario del mes, «Lo mío también», marcar como visto y el resumen de la semana.',
    ],
  },
  '0.205': {
    coach: [
      'Registro: elige bloque y semana; en cada ejercicio, la vez anterior, su 1RM del día, toneladas, descanso real y notas.',
      'Registro: lo saltado, su vídeo de ese día, «−2,5 / +2,5 kg» para su próxima sesión, su historial y «Bien hecho».',
      'Actividad: su día, lo que no hizo, la hora, lo nuevo, ver la sesión, contestarle y felicitarle desde ahí, y más filtros.',
    ],
  },
  '0.204': {
    atleta: [
      'Tus gráficas a pantalla completa, varios ejercicios juntos en % y, detrás, en gris, el periodo anterior para comparar.',
      'Tus cifras con flecha frente a las 4 semanas de antes, tus días en miniatura y el mapa con tus récords y check-ins.',
      'La escalera de cada récord, la próxima medalla, el trofeo nuevo que destella, tus fotos con su peso y la proteína.',
    ],
    coach: [
      'Registro con cada serie como ficha del color de su esfuerzo (la de récord, en dorado) y un aro por sesión.',
      'Actividad con los récords del día juntos y el resumen de cada semana; el informe del bloque, frente al anterior.',
      '«Ver con…»: su progreso a pantalla completa y sin tus notas, para enseñárselo en una videollamada.',
    ],
  },
  '0.203': {
    atleta: [
      'Tu progreso, más claro: cada punto en su fecha, la semana en curso en claro, tu meta y tus tests dentro de la gráfica.',
      'Tus medidas sobre una figura, tus trofeos con cuánto subiste, tus marcas en tarjetas y tus objetivos frente al plazo.',
      'Cuerpo en turquesa y Logros en oro; las semanas del bloque en aros y una gráfica de muestra mientras no hay datos.',
    ],
    coach: [
      'Seguimiento con índice arriba, los check-ins en color (en el móvil, en tarjetas) y la tendencia de cada respuesta.',
      'Hábitos en una fila (tócalo para cambiarlo o quitarlo) y la carga con su zona normal: lo que se sale, en ámbar.',
      'Su progreso igual que lo ve él: meta y tests en la gráfica, bloques de fondo, medidas sobre la figura y marcas en tarjetas.',
    ],
  },
  '0.202': {
    coach: [
      'A quién escribir, segunda tanda: tu objetivo y tu tono con cada uno, con qué tono te contesta y si ha leído tu último mensaje.',
      'Comenta su sesión o su check-in desde aquí, nota de voz con guion, una llamada, su mes y su bloque en números y su mejor hora.',
      'Ronda por tema y cierre del domingo, los que no están activos, tu contacto en 8 semanas, «Contacto» en su ficha y teclado.',
    ],
  },
  '0.201': {
    coach: [
      'A quién escribir: lo que te escribió a la vista, «Cómo está» cada uno, si se enfría, lo próximo y lo pendiente de hablar.',
      'Mensajes en cuatro tonos (también con humor), varios temas a la vez, más situaciones, tus respuestas y tu manera de escribir.',
      'Programa el mensaje, «Recuérdamelo», apunta temas pendientes (también en su ficha) y la ronda con los de Hoy. Migración 086.',
    ],
  },
  '0.200': {
    atleta: [
      'Versión 200: el cielo de Hoy sigue la hora, con la luna de verdad y el tiempo que hace. Y en Ajustes, el tema «Con el sol».',
      'Copos en Navidad, fuegos en Nochevieja y estrellas de noche en oscuro (se apagan en Ajustes). Dos colores nuevos: Abeto y Granada.',
      'El aro de tu semana en tu foto, el estreno de cada bloque, discos de pesas en el confeti del récord y dibujos en lo vacío.',
    ],
    coach: [
      'Versión 200: el cielo de la hora (también en tus saludos), copos en Navidad y el tema «Con el sol». Y dos colores: Abeto y Granada.',
      'Atletas: el aro de la semana en cada foto, el tablero con un color por columna y, en el saludo, quién entrena y quién te escribió.',
      'La ficha toma el color de la primera etiqueta del atleta, y las barras de las gráficas crecen al verse y llevan degradado.',
    ],
  },
  '0.199': {
    coach: [
      'Atletas, segunda tanda: recordatorios por atleta, tus avisos, tu orden a mano, tablero y panel al lado en el ordenador.',
      'Hoy toca, último contacto, próximo hito, semáforo de progreso, lo nuevo desde tu última visita y medias al pie de la tabla.',
      'Chat y voz sin salir de la lista; a varios: mensajes con sus datos o programados, tareas y preparar su semana en borrador.',
    ],
  },
  '0.198': {
    coach: [
      'Atletas a tu gusto: busca, ordena por cualquier columna, elige columnas, agrupa, vista compacta y guarda tus vistas.',
      'Fija arriba, pon etiquetas y una nota a cada uno; despliégalo sin abrir su ficha y repasa a todos con anterior/siguiente.',
      'Contadores que filtran, atajos en cada fila, varios a la vez y teclas. Igual en móvil y ordenador con la migración 085.',
    ],
  },
  '0.197': {
    coach: [
      'Revisar: respuesta ya redactada con sus datos, frases con huecos, contestar a varias a la vez o más tarde, y si la ha leído.',
      'La vez anterior y +2,5 kg en su próxima sesión en un toque, volumen por músculo, avisos de patrón, etiquetas y su chat al lado.',
      'Lo siguiente más importante, cuánto te queda, aviso al móvil si algo es urgente (migración 084) y deslizar a la izquierda.',
    ],
  },
  '0.196': {
    coach: [
      'Revisar: dos columnas en ordenador, uno a uno para todo, más teclas y el resumen de cada tanda. Tus frases por tipo y tu «Visto».',
      'Desde la tarjeta: emoji, tarea, pedir un vídeo, nota para su revisión semanal y fijar arriba. Gráfica de la sesión y cardio.',
      'Lo apartado y lo fijado, igual en el móvil y en el ordenador (migración 083). Tus tiempos de todo y tu racha dejándola a cero.',
    ],
  },
  '0.195': {
    coach: [
      'Revisar: busca por atleta, ordena por urgencia o agrupa por día. Cada atleta, con su semana del bloque y tu última respuesta.',
      'Sesiones serie a serie con sus récords, check-in frente al anterior y lo que le dijiste del ejercicio. Tus frases en el hilo.',
      '«Visto 💪», nota de voz, «Mañana», programar, elegir varias y todo lo de un atleta de golpe. Y lo revisado hoy, por si acaso.',
    ],
  },
  '0.194': {
    coach: [
      'Revisión semanal: el progreso de cada atleta sin ir a su ficha. Semáforo de peso, medidas, comida y descanso, y una frase.',
      'Peso medio frente a la semana anterior y su ritmo, medidas frente a la última y al inicio del bloque, adherencia y menú.',
      'Sueño, pasos, pulso y VFC frente a las semanas anteriores, gráficas, filtro «Algo en rojo» y orden por progreso.',
    ],
  },
  '0.193': {
    coach: [
      'Revisión semanal, todo desde ahí: uno a uno con pestañas de Su semana, Chat, Vídeos y Programar (teclas 1 a 4).',
      'Chat rápido al lado con notas de voz, corregir los vídeos ahí mismo y el editor del programa sin salir.',
      'Citar un dato en el chat, comentar check-in y sesiones, ajustar un ejercicio y cierre de la revisión.',
    ],
  },
  '0.192': {
    coach: [
      'Revisión semanal: mensajes sin leer y vídeos en la tarjeta, «pedírselo» desde un aviso, tono del mensaje y envío programado.',
      'Esta semana frente a la anterior, dónde se quedó corto, su bloque, carrera, tus pasos, tabla en ordenador y resumen.',
      'Con la migración 082: dejar a alguien «a medias» y tener tus frases y tu orden en todos tus aparatos.',
    ],
  },
  '0.191': {
    coach: [
      'Revisión semanal: la semana de cada atleta sin salir (sesiones, check-in, récords, lo que escribió) y modo «uno a uno».',
      'Mensaje más fino, tus frases, nota de voz, «revisado al enviar», pedir el check-in a varios, orden, filtros y teclado.',
      'Cada tarjeta dice si falta la semana que viene; tu nota sale al programarle; semanas pasadas y pausados aparte.',
    ],
  },
  '0.190': {
    atleta: [
      'Compartir: añade tu foto a la tarjeta. Sale en un recuadro arriba a la derecha, sin tapar tus cifras. En «Personalizar».',
    ],
  },
  '0.189': {
    atleta: [
      'Arreglado: al compartir como historia, un círculo oscuro tapaba media tarjeta en la vista previa. Ya se ve entera.',
    ],
  },
  '0.188': {
    atleta: [
      'Compartir: 30 fondos nuevos para tus tarjetas: sala de pesas, récords, rachas, paisajes, cardio y la manada. En «Personalizar».',
      'Y las letras de la tarjeta se leen mejor cuando caen encima del dibujo.',
      'Arreglado: al cambiar de formato o de colores, la tarjeta podía salir mezclada, con un dibujo oscuro tapándola.',
    ],
  },
  '0.187': {
    atleta: [
      'Compartir: las tarjetas cuadran con nombres largos, hay formato cuadrado y dos plantillas nuevas, «Lista» y «Récord».',
      'Elige el fondo de la tarjeta, o toca «Sorpréndeme». La hoja abre más corta y recuerda tu estilo; el resto, en «Personalizar».',
      'Publica en el equipo desde la misma hoja con unas palabras, y saca fuera tus publicaciones del muro con un toque.',
    ],
  },
  '0.186': {
    coach: [
      'Editor: cada sesión dice cómo le fue (día, minutos, esfuerzo y su nota) y abajo, quién queda por programar, con un botón para ir.',
      'Candado y nota solo para ti en un ejercicio, vista compacta de la semana, % de su mejor 1RM y «Traer de otro atleta».',
      'Sin conexión, lo escrito queda marcado y se guarda solo al volver. Antes de publicar avisa de repetidos y músculos a cero.',
    ],
  },
  '0.185': {
    coach: [
      'Antes de publicar, la app avisa de lo que parece un despiste (saltos de kilos, repeticiones raras, sesiones vacías).',
      'Editor: cambia varios ejercicios a la vez, llévalos a las semanas siguientes o a otra sesión, y mira su historial.',
      '«Rehacer», sesiones guardadas, duración de cada sesión y «Qué cambia respecto a la semana anterior».',
    ],
  },
  '0.184': {
    coach: [
      'Editor del programa: botón «Deshacer», + y − en los kilos con el salto del ejercicio y «Como la semana pasada» o «Lo que hizo».',
      'Sesiones y ejercicios se pliegan, se duplican y se reordenan arrastrando; una sesión se copia a otra semana.',
      '«Como lo verá el atleta» antes de publicar, y en el buscador puedes marcar varios ejercicios y añadirlos de una vez.',
    ],
  },
  '0.183': {
    coach: [
      'Descarga: solo cuando pones ese foco. Un tercio menos de series, −10 % de kilos y RPE 7; accesorios, la mitad.',
      'Tras la descarga se repite la última semana normal, sin subir. A los novatos: una serie menos y RPE 7.',
      'Peaking: solo la serie pesada de los básicos Obligatorio, hasta 1 repetición a RPE 9; el resto se queda igual.',
    ],
  },
  '0.182': {
    coach: [
      'Programar según FBE decide por el RPE de cada serie: con RPE bajo sube kilos antes; al subir, calcula las repeticiones.',
      'Rangos por tipo y prioridad (mandan sobre los de la pauta), kilos a todos los niveles y «Subir carga» en cargas bajas.',
      'Sin RPE apuntado la serie se queda igual; a RPE 8,5 o más solo progresan las dos primeras series.',
    ],
  },
  '0.181': {
    coach: [
      'Programar según FBE: lo pautado, lo que hizo y la propuesta, una serie por fila y con unidades (60 kg × 8 reps @8).',
      'La misma tabla sale en el editor, bajo cada ejercicio: lo pautado y lo hecho la semana anterior y lo programado ahora.',
      'La carga sube de 2,5 en 2,5 kg en todo. Las mancuernas de su gimnasio y el salto de un ejercicio se cambian en la hoja.',
    ],
  },
  '0.180': {
    atleta: [
      'En Ajustes › Mensajes puedes activar y probar el micro con un botón, y ver si está activado o bloqueado.',
      'Notas de voz: escucha lo grabado en pausa y sigue grabando; si no se oye nada, te avisa antes de enviarla.',
      'Si prefieres escuchar cada nota antes de enviarla, enciéndelo en Ajustes › Mensajes.',
    ],
    coach: [
      'Notas de voz: «grabando audio…» en el chat, mandos en la pantalla de bloqueo y reenvío solo al volver la conexión.',
    ],
  },
  '0.179': {
    atleta: [
      'Notas de voz como en WhatsApp: mantén el micro y suelta para enviar, o sube el dedo al candado para grabar sin mantener.',
      'Duran hasta 2 minutos, se pueden pausar, y al acabar una suena la siguiente.',
      'Si el micro está bloqueado, la app te enseña cómo activarlo paso a paso.',
    ],
    coach: [
      'Notas de voz como en WhatsApp: soltar para enviar, candado, pausa, onda en vivo y reproducción seguida.',
      'Los dos minutos necesitan la migración 081; sin ella, siguen en un minuto.',
    ],
  },
  '0.178': {
    atleta: [
      'El vídeo que grabas para tu coach con la cámara de la app ya se puede guardar en tu móvil: «Guardar en mi móvil».',
    ],
  },
  '0.177': {
    atleta: [
      'Las recetas sin foto enseñan ahora un plato parecido, y las guías de calentamiento y de material empiezan con sus figuras.',
      'Tus suplementos, tu material de casa y de viaje y tu objetivo llevan su dibujo.',
      'Los días especiales también: día flojo, semana difícil, guardia y pausa por vacaciones.',
    ],
  },
  '0.176': {
    atleta: [
      'Tu coach puede dejarte frases suyas para algunos momentos: el saludo en Hoy, un récord o un ejercicio concreto.',
      'Si te pone una imagen, la verás en tu perfil y en tu carné.',
      'Si tu peso baja o sube más rápido de lo que habéis acordado, Hoy te avisa.',
    ],
    coach: [
      'En la ficha, en Objetivos, «A su medida»: frases por momento y por ejercicio, tres imágenes y márgenes de ritmo de peso para cada atleta.',
      '«Programar según FBE» admite reglas propias de un atleta.',
      'Necesita la migración 080.',
    ],
  },
  '0.175': {
    atleta: [
      'Los ejercicios nuevos de la biblioteca ya tienen su figura: la ves en la ficha, en la Biblioteca y durante la sesión.',
      'Si haces cardio y vas a tu ritmo con la fuerza: el cardio de esta semana te sale en Hoy aunque te quede fuerza de la anterior.',
    ],
    coach: [
      'Atletas por microciclos: el cardio va por calendario. Ven el de la semana en curso aunque les quede fuerza de la anterior.',
    ],
  },
  '0.174': {
    atleta: [
      'Si tu coach te lleva la nutrición: hazle una foto a tu plato y la comida queda hecha. En Comidas o en «Tu menú de hoy».',
      '¿Comes fuera? Márcalo: te sale una pauta corta para elegir bien y esa comida cuenta como hecha.',
    ],
    coach: [
      'Fotos de platos: las ves en las comidas de cada atleta y, juntas, en la revisión semanal. Se guardan 30 días.',
      'Las comidas fuera de casa salen marcadas en su menú y cuentan como hechas. Migración 079.',
    ],
  },
  '0.173': {
    atleta: [
      'En Hoy, dile a tu coach qué quieres conseguir: una marca, tu peso, una carrera o lo que quieras. Te lo preguntará en cada bloque.',
      'Tus suplementos, en Hoy: márcalos con un toque y ponte un aviso al móvil a tu hora. Añade los tuyos desde Perfil.',
      'Si paras unos días (vacaciones, trabajo), tu coach pone tu asesoría en pausa: sin recordatorios, y tu racha te espera.',
    ],
    coach: [
      'Tus atletas te proponen objetivos: llegan a Revisar y los aceptas (ajustando cifra o fecha) o los descartas.',
      'Suplementos: páutalos en la ficha (Seguimiento) y mira qué días los marcan. Objetivo nuevo de «Peso corporal», con previsión.',
      'Pausa de la asesoría, en la ficha (Datos): sin recordatorios ni alertas, y la racha no se rompe. Migraciones 076, 077 y 078.',
    ],
  },
  '0.172': {
    atleta: [
      'Todas las guías de Aprende estrenan portada, y antebrazo, aductores y lumbares ya tienen su estatua.',
    ],
    coach: [
      '29 portadas de guía y tres estatuas nuevas. Tus 12 guías de texto ya tienen estantería: salen al publicarlas.',
    ],
  },
  '0.171': {
    atleta: [
      'Si entrenas antebrazo, aductores o lumbares, debajo de tu mapa muscular ya tienes el botón a su guía.',
    ],
    coach: [
      'Las guías de antebrazo, aductores y lumbares ya llevan su grupo y salen debajo del mapa muscular. Migración 075.',
    ],
  },
  '0.170': {
    atleta: [
      'Aprende crece: 16 guías nuevas en Entrenar, Comer y Salud, de la rodilla y la creatina a la analítica y el alcohol.',
    ],
    coach: [
      'Aprende: 16 guías tuyas repartidas en Entrenar (3), Comer (6) y Salud (7). Su texto va en guias-video.sql.',
    ],
  },
  '0.169': {
    atleta: [
      'En Aprende, la estantería «Comer» estrena una guía de proteína.',
    ],
    coach: [
      'Biblioteca 2 con 155 ejercicios (fuera seis que tus guías descartan); la sentadilla goblet pide mancuerna o kettlebell.',
    ],
  },
  '0.168': {
    atleta: [
      'Tu mapa muscular cuenta tres grupos más: antebrazo, aductores y lumbares.',
    ],
    coach: [
      'Biblioteca: antebrazo, aductores y lumbares (sin mínimo de series) y 155 ejercicios nuevos con su SQL. Migración 074.',
    ],
  },
  '0.167': {
    atleta: [
      'Tu perfil, más tuyo: el día 1 y hoy, tu palmarés, logros secretos, tu historia de bloques y tu trimestre.',
      'Apunta lo que prefieres evitar y tu material de casa y de viaje; guarda mensajes en tu rincón de ánimo; pon tu portada.',
      'Y un buscador en tu perfil, tus atajos, tu privacidad de un vistazo y tus datos en hoja de cálculo.',
    ],
    coach: [
      'En la ficha, lo que el atleta prefiere evitar y su material, con aviso al elegir ejercicio. Migración 073.',
    ],
  },
  '0.166': {
    atleta: [
      'Perfil, en dos: «Tú» (lo tuyo) y «Ajustes» (con su índice). En ordenador, Progreso y Perfil a dos columnas.',
      'Más pulido: las imágenes cargan con su color, cifras más claras y toca las barras de lo comido para leerlas.',
    ],
  },
  '0.165': {
    atleta: [
      'Hoy, con su escena: el descanso, la sesión hecha y la semana completa; más portadas y una bienvenida para cada estación.',
    ],
  },
  '0.164': {
    atleta: [
      'Más ilustraciones: tu música, la carrera y el viaje, el recetario, la sesión y las pantallas vacías.',
    ],
    coach: [
      'Ilustraciones también en cobros, difusión, integraciones, negocio y tus frases y música.',
    ],
  },
  '0.163': {
    atleta: [
      'Diseño más fino: en modo oscuro las hojas se ven más claras, los textos siguen a tu acento y los avatares tienen más colores.',
    ],
  },
  '0.162': {
    atleta: [
      'La travesía: botón «Agáchate» abajo a la izquierda para pasar las ramas, sin que el lobo salte antes.',
    ],
  },
  '0.161': {
    atleta: [
      'Colores nuevos, más limpios: grises neutros, modo oscuro con luz y la tarjeta del día con el color de tu sesión.',
      'Perfil → «Este móvil»: tres acentos más (Océano, Lima y Orquídea), «Alto contraste» y «Ayuda para daltonismo».',
    ],
    coach: [
      'Los mismos colores en tu panel; sin migración.',
    ],
  },
  '0.160': {
    atleta: [
      'Tu música, más tuya: listas por momento, tus himnos, la cadencia por tramos y «Lo batiste con…» en tus récords.',
      'En el equipo: la canción de cada uno, el reto musical del mes y una lista con tu pareja de racha.',
      'Y la música baja sola cuando habla tu coach, y suenan también YouTube y Apple Music.',
    ],
    coach: [
      'Cuenta → tu biblioteca de música y «Qué música funciona»; el reto musical del mes. Migración 072.',
    ],
  },
  '0.159': {
    atleta: [
      'Ilustraciones nuevas en Apuntes, tu meta y tu historia, tu sesión, tu vida y «Busco compañero».',
    ],
    coach: [
      'Ilustraciones también en «Para hablarle»; y «Le escribiste» ya no dice «Hace -1 días».',
    ],
  },
  '0.158': {
    atleta: [
      'Más sonido en tu sesión: metrónomo con las notas de la app, nota del RPE, «¿Seguimos?» y «ding» cuando toca subir.',
      'Elige la voz del móvil y su velocidad, cuenta las repeticiones en voz alta y marca la serie desde los auriculares.',
      'Sonido de fondo en el descanso, horario sin sonidos y «¿Se oye bien?» en Perfil → Sonido y vibración.',
    ],
    coach: [
      'Cuatro frases más con tu voz: saludo, mitad de la sesión, «a por el récord» y último ejercicio. Migración 071.',
    ],
  },
  '0.157': {
    atleta: [
      'Tu sesión, a tu medida: «¿Cuánto tiempo tienes hoy?», tu calentamiento y tu yo de hace un año. Siempre como consejo.',
      'La app sabe de tu vida: tu agenda, semanas difíciles y guardias, y cómo te gusta que te entrenen.',
      'Y más: tu reto del mes, «Busco compañero», tu álbum de hitos y un informe para tu médico o fisio.',
    ],
    coach: [
      '«Para hablarle»: su vida, lo que le hace volver y su alerta temprana; tu voz en los mensajes. Migraciones 069 y 070.',
    ],
  },
  '0.156': {
    atleta: [
      'La app suena a FBE: series que suben de nota, fanfarria de récord, aviso a mitad del descanso y cuenta atrás que sube.',
      'Perfil → Sonido y vibración: «Solo lo justo», «Equilibrado» o «Todo», y el volumen de cada apartado.',
      'Y si tu coach graba sus frases, suenan con su voz en tu sesión.',
    ],
    coach: [
      'Cuenta → «Tus frases, con tu voz»: graba seis frases cortas y suenan con tu voz en la sesión de tus atletas. Migración 068.',
    ],
  },
  '0.155': {
    atleta: [
      'La app te habla a ti: tu nombre, cómo quieres que te hablemos, tu meta con cuenta atrás y por qué cada sesión es para ti.',
      'Y te conoce: «Hoy, por cómo estás», tu mejor momento, tu historia, tu aniversario y «Tu ADN FBE».',
    ],
    coach: [
      'En la ficha, «Para hablarle» y «La carta del mes»; Cuenta → Avisos por zona. Migraciones 066 y 067.',
    ],
  },
  '0.154': {
    atleta: [
      'Apuntes que se quedan: repaso espaciado, piénsalo antes de leer, preguntas de tu coach y ejercicios para practicar.',
      'Y tu progreso: prueba de nivel, temas, ruta Fundamentos FBE con certificado, objetivo diario, liga y duelos.',
      'Y La travesía con más jugo: saltos y caídas con respuesta, el combo que se ve, grandes momentos y un sello de oro, plata o bronce.',
    ],
    coach: [
      'Guías → «Nueva»: preguntas y audio-píldoras; y «El equipo en apuntes». Migraciones 064 y 065.',
    ],
  },
  '0.153': {
    atleta: [
      'La travesía, rematada: corre contra el lobo de un compañero, ligas de la semana, rutas nuevas, la ventisca, la etapa dorada y fiestas.',
      'Y «La vuelta a casa» al acabar el entreno, «Tu lobo en números» y el diario del lobo.',
    ],
    coach: [
      'Equipo → Retos: el reto de La travesía para la semana. Migración 063 (después de la 062).',
    ],
  },
  '0.152': {
    atleta: [
      'La travesía, a otro nivel: combo, cuestas, cornisas, potenciadores, misiones y rango, logros, música y la etapa del día con tu equipo.',
      'Y puedes aullar a un compañero de la manada: le saldrá en su siguiente etapa.',
    ],
    coach: [
      'Migración 062 (después de la 061): rango, misiones y logros en la base, la etapa del día y los aullidos.',
    ],
  },
  '0.151': {
    atleta: [
      'La tarjeta del juego, con el cielo de la hora y tu lobo; y en el juego, un ciervo, un búho y un marco en los diez últimos segundos.',
      'Apuntes, más bonitos: tarjetas de cuaderno que se deslizan con el dedo, sellos, medallas dibujadas y la nota del examen con confeti.',
    ],
    coach: [
      'Lo nuevo de travesia-bella que no estaba en la v0.150 y Apuntes más bonitos (apuntes-bellos); sin migración.',
    ],
  },
  '0.150': {
    atleta: [
      'La travesía, más bonita: cielo con Vía Láctea y estrellas fugaces, ríos que reflejan la luna y un lobo que aúlla al acabar.',
    ],
    coach: [
      'Solo pintura del juego: ni reglas ni dificultad cambian. Sin migración nueva (siguen la 060 y la 061).',
    ],
  },
  '0.149': {
    atleta: [
      'La travesía crece: un mapa de verdad, postales, lobos y constelaciones, y la clasificación de la semana con tu equipo.',
      'Apuntes con lo tuyo: preguntas, glosario, guardados, el curso de la semana, un examen y tu racha de aprendizaje.',
    ],
    coach: [
      'Guías → «Nueva» → «Apunte suelto», mandar un apunte por Mensajes y «Lo que más se falla» (migración 061, después de la 060).',
    ],
  },
  '0.148': {
    atleta: [
      'La novedad de la semana de tu coach, y tu travesía y tus apuntes ya no se pierden al cambiar de móvil.',
    ],
    coach: [
      'Biblioteca → Guías → «La novedad de la semana»: escribe una y tus atletas la ven al abrir Apuntes (migración 060).',
    ],
  },
  '0.147': {
    atleta: [
      'En los descansos: juega a La travesía o aprende algo con Apuntes.',
    ],
  },
  '0.146': {
    atleta: [
      '«Tu día» pone arriba lo que te queda y debajo lo hecho; y al bajar por Hoy, el botón de empezar te sigue.',
      '«¿Cómo llegas hoy?», de una en una: tres toques rápidos antes de entrenar.',
      'Los iconos de la app, ahora ilustrados: los cuadraditos de Hoy, de tu día y de las secciones, con su dibujo.',
    ],
  },
  '0.145': {
    atleta: [
      'Los vídeos de tu coach, dentro de la app: solo el tramo que importa, a cámara lenta o en pequeño mientras entrenas.',
      'En Hoy, el vídeo de la semana y los directos de tu coach; si tu sesión lleva un vídeo para seguir, lo tienes arriba.',
    ],
    coach: [
      'YouTube en la app: tu canal en «Aprende», vídeo de la semana, directos, vídeo por sesión y quién ha visto qué (059).',
      'En tu modo atleta, Progreso → Fuerza → Apple Watch: crea tu clave y prueba «FBE Reloj» antes de compartirlo.',
    ],
  },
  '0.144': {
    atleta: [
      'Un equipo más vivo: el ánimo sale volando, el podio sube, las encuestas se llenan al votar y las insignias nuevas llegan girando.',
    ],
  },
  '0.143': {
    atleta: [
      'De viaje en otra zona horaria: Hoy te dice la hora de cada sitio y ajusta tus notificaciones para que no te lleguen de noche.',
      'Tu día en la app va con la hora de tu móvil (antes, algunas cosas cambiaban de día con la hora de España).',
    ],
  },
  '0.142': {
    atleta: [
      'Si corres, andas o vas en bici fuera: el tiempo para salir en Hoy, con la mejor hora del día (eliges tu zona).',
      'Avisos de calor, frío, tormenta, viento y aire en la sesión de cardio de fuera, con qué hacer en cada caso.',
    ],
    coach: [
      'Tus atletas de carrera o con cardio de fuera ven el tiempo en Hoy (Open-Meteo); su zona se queda en su móvil.',
    ],
  },
  '0.141': {
    atleta: [
      'Si entrenas con Apple Watch: la serie que toca, marcarla y el descanso, desde la muñeca (Perfil → Apple Watch).',
      'Nuevo dial de Sueño y «Tu reloj, de un vistazo»: pasos, sueño, pulso en reposo y HRV frente a tu media.',
    ],
    coach: [
      'El modo reloj: pon el enlace del atajo «FBE Reloj» en Cuenta → Atajos del iPhone (necesita la migración 058 y la función «reloj»).',
    ],
  },
  '0.140': {
    atleta: [
      'Ordena Hoy a tu gusto: sube, baja u oculta sus secciones y elige qué diales ves arriba (abajo del todo, «Ordenar Hoy»).',
      'Dos diales nuevos arriba: las kcal que te quedan hoy, si llevas la nutrición, y tus pasos, si los traes de Salud.',
    ],
  },
  '0.139': {
    atleta: [
      'Si llevas la nutrición conmigo, las recetas del recetario del equipo vienen ajustadas a las kcal de cada comida tuya.',
    ],
  },
  '0.138': {
    atleta: [
      'En «Aprende», cada guía estrena portada y cada estantería su ilustración; también el mito de la semana y el cuestionario inicial.',
    ],
  },
  '0.137': {
    atleta: [
      'Las ilustraciones de cada día cobran vida: la portada de tu sesión se acerca despacio y la bienvenida tiene la luz de la hora.',
      'Al cambiar dónde entrenas, la imagen se funde con la nueva; y al terminar, el sello cae como un tampón con un destello.',
      'Tu comida de ahora destaca en el menú, los hábitos hechos se encienden y los hitos de tu racha sueltan chispas.',
    ],
  },
  '0.136': {
    atleta: [
      'Si una serie te sale más dura o más fácil de lo pautado, la siguiente te propone otra carga y te dice por qué.',
    ],
  },
  '0.135': {
    atleta: [
      'Escanea el código de barras de lo que comes y se suma a tu día.',
      '«Aprende», por estanterías: busca dentro de las guías y te proponemos la que viene a cuento según tu semana.',
      'En Hoy, el mito de la semana: uno nuevo cada lunes, desmontado en un minuto.',
    ],
    coach: [
      '«Aprende» también para quien solo lleva la nutrición, y la guía que viene a cuento sale sola (descarga, check-in, parón, fase de la dieta).',
    ],
  },
  '0.134': {
    atleta: [
      'Al grabar un vídeo de técnica, antes de enviarlo ves los 3 errores típicos de ese ejercicio.',
      'En tu semana, «Cómo está montada tu semana»: por qué entrenas así, de la guía de tipos de rutina.',
      'En Progreso → Fuerza, debajo del mapa muscular, las guías de los músculos que has entrenado.',
    ],
    coach: [
      'Al corregir un vídeo, los errores típicos de su ficha salen como frases de un toque.',
      'En el editor, cada ejercicio con ficha enseña sus repeticiones por objetivo y avisa si una molestia del atleta lo desaconseja.',
      'Tu música también en tu modo atleta: tus listas de Cuenta › Música salen en la portada de tus sesiones.',
    ],
  },
  '0.133': {
    atleta: [
      'El recetario del equipo: las recetas de tu coach para todos, con buscador y favoritas, en Recetas (o en Comidas).',
      '«Aprende» (en Más): las guías de tu coach y, en cada ejercicio, su ficha de técnica con los errores típicos.',
      'Si tu coach te lleva la carrera: «Tu carrera» en Hoy y sesiones por partes, con sus zonas y el semáforo antes de salir.',
    ],
    coach: [
      'Recetario del equipo: en Biblioteca → Recetas, marca «Para todo el equipo» y la ven todos tus atletas.',
      'Biblioteca → Guías: léelas como tus atletas y publica o esconde cada una; al editar un ejercicio, «Ficha de técnica».',
      'Carrera: enciéndela al crear la ficha o en Datos. En su pestaña Carrera, zonas desde la FC umbral, macrociclo y semanas.',
      'Carreras A, B y C con objetivo y decisión, revisiones del plan y tu biblioteca de sesiones de calidad (10 de partida).',
      'En el editor, las sesiones de carrera por partes y, con un toque, las del plan pasan a la semana de entreno.',
    ],
  },
  '0.132': {
    atleta: [
      'La sesión responde a cada toque: las teclas rebotan, la cifra que escribes salta y el RPE que eliges se marca con un salto.',
      'Las series llegan una a una, los discos entran en la barra al cambiar los kilos y tus tres anillos de Hoy se llenan al entrar.',
      'En el descanso, «Ahora toca» llega con la siguiente serie y la cuenta se mueve al sumar o quitar 15 segundos.',
    ],
  },
  '0.131': {
    atleta: [
      'En móviles pequeños o con la letra grande, Perfil y Ajustes se leen mejor: cada explicación ocupa todo el ancho.',
    ],
  },
  '0.130': {
    atleta: [
      'Más vida en el entrenamiento: si mejoras lo de la última vez, te lo dice al momento («+2,5 kg que la última vez»).',
      'Al terminar un ejercicio, su tarjeta y su tramo de la barra lo celebran y el siguiente se enciende.',
      'En el modo enfoque, cada serie llega con su salto; y al volver a Hoy después de entrenar, tu sesión queda sellada.',
    ],
  },
  '0.129': {
    atleta: [
      'Tu música, mejor: al pegar el enlace ves la portada y el nombre, y cada tarjeta dice si es lista, álbum, canción o podcast.',
      'El reproductor sale compacto (y en negro con la app en oscuro), se quita al acabar y, durante la sesión, «Tu música» la tienes a mano.',
      'En el cardio, «Buscar música a 170 bpm en Spotify» a tu cadencia; y en Equipo, «Añadir mi canción» a la lista del equipo.',
    ],
    coach: [
      'En Música, cada lista con su portada y su nombre (también en el editor), y al pegar un enlace ves qué es antes de guardarlo.',
      'En la ficha de cada atleta, el nombre de su lista y de su canción de récord, y se abren con un toque.',
    ],
  },
  '0.128': {
    atleta: [
      'La app, con más vida: la bienvenida del día llega pieza a pieza y, al empezar la sesión, el lobo enciende los ojos: «A por ello».',
      'Cada serie que marcas da un salto y suelta chispas (doradas en la última del ejercicio).',
      'Los iconos de abajo tienen cada uno su gesto, tirar para recargar llena una luna y tu check-in vuela hasta tu coach.',
    ],
  },
  '0.127': {
    atleta: [
      'Cada ejercicio con su imagen: en miniatura en la tarjeta de la sesión y, en su ficha, grande al tocarla.',
    ],
    coach: [
      'Las 155 imágenes de la biblioteca de ejercicios: en tu biblioteca, en la ficha de cada uno y en las sesiones de tus atletas.',
    ],
  },
  '0.126': {
    atleta: [
      'Salud del iPhone cuenta bien tus pasos y tu sueño: sin sumar dos veces el reloj y el iPhone, y sin el rato en la cama despierto.',
      'El peso ya no llega de Salud: lo apuntas tú, como siempre. Y los pasos, con su punto de miles (11.851).',
    ],
    coach: [
      'En la ficha, «Desde su iPhone» con los pasos y el sueño sin duplicados, sin el peso (lo apuntan a mano) y con punto de miles.',
      'Para que funcione: vuelve a desplegar la función «integraciones» en Supabase con el integraciones-panel.ts nuevo.',
    ],
  },
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
