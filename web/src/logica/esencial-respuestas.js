// FBE Esencial (acompañamiento, tanda 4): el centro de respuestas de quien va por su cuenta. Datos y lógica pura.
// Las respuestas salen de lo que la app ya hace y de los textos de Pelayo ya aprobados (las lecciones, la guía de la
// primera sesión y las siete preguntas frecuentes de antes). Nada de salud nuevo: lo que toca salud y aún no ha visto
// Pelayo va en PENDIENTES y no sale (APAGADO) hasta que dé su visto bueno.
//   { id, cat, q, r, enlace?: [texto, ruta de la web], ir?: accion de «¿Qué necesitas?» que lo resuelve }
export const CATEGORIAS = [
  // (v0.248, tanda 7) lo de antes de su lunes (con «¿Cuándo se me cobra?» y «¿Puedo darme de baja?», que van en su suscripción)
  ['antes', 'Antes de empezar', 'calendario'],
  ['empezar', 'Empezar', 'diana'],
  ['sesion', 'La sesión', 'hoy'],
  ['semana', 'La semana', 'calendario'],
  ['progresar', 'Progresar', 'progreso'],
  ['salud', 'Dolor y salud', 'alerta'],
  ['vida', 'La vida real', 'reloj'],
  ['app', 'La app', 'ajustes'],
  ['suscripcion', 'Tu suscripción', 'documento'],
];

export const RESPUESTAS = [
  // ---- (v0.248) Antes de empezar (de lo que ya dicen la guía, la bienvenida y las preguntas de siempre)
  { id: 'nunca', cat: 'antes', q: 'Nunca he entrenado',
    r: 'Para eso es «Primeras 4 semanas», las de la guía: dos días y cinco ejercicios. La primera semana es una serie de cada uno, de diez a doce repeticiones: aprender el gesto y salir con ganas de volver. Media hora y a casa.' },
  { id: 'primer-no', cat: 'antes', q: 'El día que empiezo no puedo',
    r: 'No pasa nada: en «Tus días» eliges los que te vengan bien esa semana (mejor que no vayan seguidos) y la sesión pasa a ese día. Las sesiones se abren el lunes en que empieza tu tanda.' },
  { id: 'antes-ya', cat: 'antes', q: '¿Puedo empezar antes?',
    r: 'Las sesiones se abren el lunes en que empieza tu tanda, el mismo día para todos. Hasta entonces, mira tus ejercicios y sus vídeos, prepara tu gimnasio y elige tus días: llegarás con todo hecho.' },
  { id: 'llevar', cat: 'antes', q: '¿Qué llevo el primer día?',
    r: 'Ropa cómoda, agua y el móvil con la app: ahí tienes tu sesión y ahí apuntas cada serie. Funciona aunque el gimnasio no tenga cobertura.' },
  // ---- Empezar
  { id: 'plan', cat: 'empezar', q: '¿Cómo se elige mi plan?',
    r: 'Con tu cuestionario. Si nunca has entrenado, o llevas menos de un año y ahora estás parado, empiezas por «Primeras 4 semanas», las de la guía: dos días, cinco ejercicios y una semana final de marcas. Si ya entrenas, la app te recomienda dos o tres rutinas según tus días, tu material y lo que te apetece, y eliges tú.' },
  { id: 'dias', cat: 'empezar', q: '¿Cuántos días a la semana?',
    r: 'Si empiezas de cero, dos: las cuatro semanas de la guía y, desde la quinta, una plantilla de dos días (desde Hoy puedes pasar a tres). Si ya entrenas, los que pusiste en el cuestionario.' },
  { id: 'material', cat: 'empezar', q: '¿Qué material necesito?',
    r: 'Tu rutina se elige con el material que pusiste en el cuestionario. Las cuatro semanas de la guía son de gimnasio, y cada ejercicio trae su alternativa.' },
  { id: 'pelayo', cat: 'empezar', q: '¿Hablo con Pelayo?',
    // (v0.251) sin el directo de dudas, que está oculto; con él encendido, su texto de antes (CON_DIRECTO)
    r: 'No hay chat ni revisión de tu semana: eso lo llevan los programas con seguimiento. Para las dudas tienes estas respuestas, con buscador, y la comunidad de la app.', enlace: ['Programas con seguimiento', 'programas.html'] },
  { id: 'primer-dia', cat: 'empezar', q: '¿Qué hago el primer día?',
    r: 'Pide a alguien de sala que te ajuste las máquinas: son cinco minutos y te ahorran un mes de dudas. Empieza con poco peso, apunta cada serie y no vayas al límite. El objetivo de enero es llegar a febrero.' },
  { id: 'que-peso', cat: 'empezar', q: '¿Qué peso pongo?',
    r: 'El primer día no lo sabe nadie. Empieza con poco, haz doce repeticiones y pregúntate cuántas más habrías podido hacer: si habrías hecho diez más, sube; si ninguna, baja. Buscas el peso con el que te sobren las que te marca la app en ese ejercicio.' },
  { id: 'videos', cat: 'empezar', q: '¿Dónde veo cómo se hace cada ejercicio?',
    r: 'En cada ejercicio, «Cómo se hace» abre su ficha, con el vídeo y las instrucciones. Antes de tu primer día los tienes todos juntos en Hoy, en «Tu semana 1, ejercicio a ejercicio».' },
  // ---- La sesión
  { id: 'sobran', cat: 'sesion', q: '¿Qué es «te sobran»?',
    r: 'Las repeticiones que podrías haber hecho de más al acabar la serie. «Te sobran 2» es parar cuando aún habrías podido hacer dos más. No se va al límite: así se progresa semana a semana sin quemarse.' },
  { id: 'apuntar', cat: 'sesion', q: '¿Qué tengo que apuntar?',
    r: 'De cada serie, los kilos, las repeticiones y cuántas te sobraban. Si haces justo lo que te propone la app, basta con tocar ✓. Apunta lo que haces de verdad, aunque salga peor: es lo que usa la app para tu semana siguiente.' },
  { id: 'no-llego', cat: 'sesion', q: 'No llego a las repeticiones',
    r: 'Apunta las que hagas, sin maquillarlas. Si en alguna serie no llegas al mínimo, la app repite el peso la semana siguiente y, si vuelve a pasar, lo baja un poco. Hoy, si no te sobró ninguna, baja un poco el peso en la serie siguiente.' },
  { id: 'me-sobran', cat: 'sesion', q: 'Me sobran muchas',
    r: 'Apúntalo tal cual: es lo que le dice a la app que toca subir. Si te sobraban muchísimas (ocho o más), sube un poco el peso en la serie siguiente.' },
  { id: 'descanso', cat: 'sesion', q: '¿Cuánto descanso entre series?',
    r: 'Lo que necesites para repetir la serie bien: uno o dos minutos. El reloj de descanso arranca solo al marcar la serie.' },
  { id: 'maquina', cat: 'sesion', tambien: ['antes'], q: 'La máquina está ocupada',
    r: 'Abre el ejercicio y toca «Cambiar»: verás sus alternativas. Lo que apuntes queda a nombre de la alternativa, así tus marcas no se mezclan.' },
  { id: 'tecnica', cat: 'sesion', q: 'No sé si lo hago bien',
    r: 'Mira el vídeo en «Cómo se hace» y quédate con un peso que controles en todo el recorrido. Si puedes, pide a alguien de sala que te mire una serie.' },
  { id: 'poco-tiempo', cat: 'sesion', q: 'Hoy tengo poco tiempo',
    r: 'Al abrir la sesión, «¿Cuánto tiempo tienes hoy?» la deja en lo importante. Mejor una sesión corta que ninguna.' },
  { id: 'cobertura', cat: 'sesion', q: 'No tengo cobertura en el gimnasio',
    r: 'Sigue apuntando como siempre. Las series se guardan en el móvil y se envían solas cuando vuelve la conexión.' },
  // ---- La semana
  { id: 'falle', cat: 'semana', q: 'He fallado una sesión',
    r: 'No la recuperes doblando al día siguiente: sigue donde tocaba. Si esta semana aún quedan días libres, en Hoy puedes pasarla a otro día.' },
  { id: 'hoy-no', cat: 'semana', q: 'Hoy no puedo entrenar',
    r: 'En Hoy, «Hoy no puedo» pasa la sesión a otro día de esta semana, mejor sin otra sesión el día de antes ni el de después.' },
  { id: 'domingo', cat: 'semana', q: '¿Qué pasa el domingo si no he acabado la semana?',
    r: 'Por la noche, la app te pregunta si pasas a la semana siguiente o repites esta. Si no eliges, pasa sola a la siguiente y te avisa. Lo que no has hecho no se recupera doblando.' },
  { id: 'repetir', cat: 'semana', q: '¿Puedo repetir una semana?',
    r: 'Sí. El domingo, si te queda alguna sesión, puedes repetirla: tu plan se corre una semana, lo hecho se queda hecho y haces lo que te falta. Como mucho, dos veces la misma semana.' },
  { id: 'pausa', cat: 'semana', q: 'Esta semana no puedo entrenar',
    r: 'En Hoy, «Esta semana no puedo» pone la semana en pausa: tu plan se corre una semana y, mientras, no te llegan avisos de entreno. Si cambias de idea, «Volver ya».', ir: 'pausa' },
  { id: 'mis-dias', cat: 'semana', q: 'Quiero cambiar mis días',
    r: 'En «¿Qué necesitas?», «Cambiar mis días»: eliges los días y la app coloca cada sesión en el suyo. Mejor que no vayan seguidos.', ir: 'dias' },
  { id: 'adelantar', cat: 'semana', q: '¿Puedo adelantar una sesión?',
    r: 'Con tu semana hecha, puedes adelantar la primera sesión de la siguiente. Nunca dos el mismo día.' },
  { id: 'revision', cat: 'semana', q: '¿Dónde veo por qué me ha cambiado algo?',
    r: 'En «Tu revisión de la semana» (en Hoy, cada semana nueva) y en el «¿Por qué?» de cada ejercicio dentro de la sesión: lo que hiciste, lo que cambia y el motivo.', ir: 'revision' },
  // ---- Progresar
  { id: 'como-sube', cat: 'progresar', q: '¿Cómo decide la app si subo de peso?',
    r: 'Con lo que apuntas: si cumples en todas las series, te pide un poco más, una repetición o un poco de peso. Si alguna serie no llega, repite. Y si un dato parece mal apuntado, te pregunta antes de decidir. Por eso hay que apuntar: sin registro, la progresión es una opinión.' },
  { id: 'estancado', cat: 'progresar', q: 'Llevo semanas con el mismo peso',
    r: 'Pasa, y no es un fracaso. Si un ejercicio lleva tres semanas igual, la app le baja un 10 % para que vuelvas a sumar repeticiones y a subir. Si te pasa en dos o más ejercicios a la vez, te propone cambiar de rutina.' },
  { id: 'descarga', cat: 'progresar', q: '¿Qué es una semana de descarga?',
    r: 'Una semana con menos carga o menos series, para recuperar. No es para apretar: quédate lejos del fallo en todo. Después retomas donde lo dejaste.' },
  { id: 'marcas', cat: 'progresar', q: '¿Qué son mis marcas?',
    r: 'El peso y las repeticiones de tu mejor serie en cada ejercicio al acabar tus cuatro primeras semanas: el punto de partida de todo lo que venga. Con ellas, la app prepara tu semana 5.' },
  { id: 'tercer-dia', cat: 'progresar', q: '¿Paso a tres días?',
    r: 'Antes de pedirlo, mira tu registro: si las series acaban con cuatro o cinco repeticiones de margen, no te faltan días, te falta apretar. Si lo tienes claro, en Hoy puedes pasar a tres días desde la semana siguiente.' },
  { id: 'cambiar-rutina', cat: 'progresar', q: '¿Puedo cambiar de rutina?',
    r: 'Sí, en «Tu rutina» (en Semana y en Perfil): el cambio entra con la semana siguiente. Lo recomendable es mantener cada rutina al menos 12 semanas, que es lo que tarda en dar resultado, salvo que te estanques.', ir: 'rutina' },
  { id: 'peso', cat: 'progresar', q: 'Mi peso sube y baja cada día',
    r: 'Es normal: el peso de un día cambia con el agua, la sal y la hora. Pésate por la mañana, en ayunas, y apúntalo. Con unos días verás tu tendencia, que es lo que importa: la tienes en Hoy, en «Tu peso», y en tu revisión de la semana.' },
  { id: 'espejo', cat: 'progresar', q: '¿Cuándo voy a notar algo?',
    r: 'A las tres semanas te vas a ver distinto en el espejo. Disfrútalo, pero buena parte es hinchazón: no juzgues el plan por el espejo del primer mes, ni para bien ni para mal. Lo que no engaña es tu registro: los kilos y las repeticiones que subes.' },
  // ---- Dolor y salud (solo lo ya aprobado)
  { id: 'agujetas', cat: 'salud', q: 'Tengo agujetas',
    r: 'Son normales las dos primeras semanas: luego bajan, y no dicen si entrenaste bien o mal. La molestia del músculo que ha trabajado aparece al día siguiente, se nota en los dos lados y mejora cuando te mueves.' },
  { id: 'dolor', cat: 'salud', q: '¿Y si me duele algo?',
    r: 'La app no valora el dolor. El que preocupa aparece durante el ejercicio, es punzante, se queda en una articulación o va a más de una sesión a otra. Si con el esfuerzo notas dolor u opresión en el pecho, falta de aire que no cuadra con lo que estás haciendo, mareos o palpitaciones, para y habla con tu médico.', enlace: ['El semáforo del dolor', 'semaforo-dolor.html'] },
  { id: 'enfermedad', cat: 'salud', q: '¿Y si tengo una enfermedad o tomo medicación?',
    r: 'Antes de empezar contestas unas preguntas de salud. Si sale que conviene consultar, no empiezas sin el visto bueno de tu médico o una Puesta a punto con Pelayo. Si tu salud cambia después, actualiza tu cuestionario en Perfil.', enlace: ['Puesta a punto', 'puesta-a-punto.html'] },
  { id: 'molestia-checkin', cat: 'salud', q: 'Tengo una molestia, ¿qué hace la app?',
    r: 'Apúntala en tu check-in de la semana, con la zona: al enviarlo, la app te dice qué hacer mientras tanto y, si es moderada o grave, a Pelayo le sale como aviso. En la sesión, «Cambiar» te da una alternativa para el ejercicio que moleste. No sustituye a que te lo miren: si una molestia cambia cómo te mueves o va a más, para ese ejercicio y, si no mejora, consúltalo con tu médico.' },
  // ---- La vida real
  { id: 'viaje', cat: 'vida', q: 'Me voy de viaje',
    r: 'Para una semana suelta, «Esta semana no puedo» pone la semana en pausa. Si vas a tener un gimnasio de hotel o nada de material, en «Tu rutina» tienes una de viaje para unas semanas; a la vuelta, vuelves a la tuya.', ir: 'rutina' },
  { id: 'paron', cat: 'vida', q: 'Llevo días sin entrenar',
    r: 'No hay nada que recuperar: abre la app y haz la sesión que toca. Si llevas tiempo parado, la app prepara la vuelta con algo menos de carga para retomar con buenas sensaciones.' },
  { id: 'otro-deporte', cat: 'vida', q: 'También hago otro deporte',
    r: 'Cuéntalo en «Tus gustos» al elegir rutina: hay una de dos días pensada como complemento. Y deja un día entre la fuerza de pierna y tu partido o tu tirada larga, si puedes.' },
  { id: 'casa', cat: 'vida', q: 'Algunos días entreno en casa',
    r: 'En Perfil, «Dónde entrenas» guarda tus sitios con su material. Con «¿Dónde entrenas hoy?», la app cambia lo que no puedas hacer por sus alternativas.' },
  // ---- La app
  { id: 'avisos', cat: 'app', q: '¿Qué avisos me llegan?',
    r: 'El día que toca entrenar, el del check-in, la pregunta del domingo y cuando tu semana nueva está lista. Qué te llega y a qué hora lo eliges en Perfil, en «Notificaciones». Sin avisos activados, no te llega ninguno.' },
  { id: 'instalar', cat: 'app', q: '¿Cómo la instalo en el móvil?',
    r: 'En iPhone, con Safari: Compartir y «Añadir a pantalla de inicio». En Android, con Chrome: «Instalar aplicación». Se abre como una app y te pueden llegar los avisos.' },
  { id: 'check-in', cat: 'app', q: '¿Para qué sirve el check-in?',
    r: 'Es un minuto a la semana: cómo has dormido, tu energía y si algo te molesta. Nadie te lo contesta uno a uno: lo usa la app al preparar tu semana (con la energía o la recuperación bajas, no te añade series) y, si marcas una molestia, te dice qué hacer mientras tanto.' },
  { id: 'errata', cat: 'app', q: 'Me he equivocado al apuntar',
    r: 'Abre la sesión desde Semana y corrige la serie. Si la app ve un dato raro, te pregunta antes de prepararte la semana.' },
  { id: 'datos', cat: 'app', q: '¿Quién ve mis datos?',
    r: 'Además de ti, Pelayo, que es el responsable de la app: no revisa tu día a día ni te contesta uno a uno, pero ve tu ficha. En Perfil tienes «Privacidad de un vistazo», con lo que ve y lo que no, y la descarga de todos tus datos.' },
  // ---- Tu suscripción
  { id: 'cobro', cat: 'suscripcion', tambien: ['antes'], q: '¿Cuándo se me cobra?',
    r: 'Al reservar dejaste tu tarjeta, sin cobrar nada. La primera cuota se cobra el día en que empieza tu tanda y, desde ahí, cada mes o cada año, según lo que elegiste, con el mismo precio de fundador.' },
  { id: 'baja', cat: 'suscripcion', tambien: ['antes'], q: '¿Puedo darme de baja?',
    r: 'Sí, cuando quieras, desde tu suscripción, con el correo con el que reservaste. Sigues dentro hasta el final del periodo pagado.', portal: true },
  { id: 'problema', cat: 'suscripcion', q: 'Algo falla en la app o en el cobro',
    r: 'Escribe al correo de contacto y Pelayo te contesta por correo.', correo: true },
  { id: 'seguimiento', cat: 'suscripcion', q: 'Quiero que Pelayo me lleve',
    r: 'Eso son los programas con seguimiento: un plan hecho para ti, revisión de cada semana y mensajes. Puedes pedir plaza en la web.', enlace: ['Programas con seguimiento', 'programas.html'] },
];

// (P) Lo que toca salud y no ha visto Pelayo: escrito, pero APAGADO hasta su visto bueno
export const PENDIENTES = [
  { id: 'resfriado', cat: 'salud', q: 'Estoy resfriado, ¿entreno?',
    r: 'Si es de cuello para arriba (mocos, algo de garganta) y te encuentras con fuerzas, puedes hacer la sesión más suave. Con fiebre, malestar general o tos de pecho, descansa: pon la semana en pausa y vuelve cuando lleves un par de días bien.' },
  { id: 'mareo', cat: 'salud', q: 'Me mareo al entrenar',
    r: 'Para, siéntate y espera a que se pase. Si se repite, si viene con dolor en el pecho, palpitaciones o falta de aire, o si pierdes el conocimiento, no sigas entrenando hasta que te vea un médico.' },
  { id: 'dormir', cat: 'salud', q: 'He dormido fatal, ¿entreno?',
    r: 'Puedes: haz la sesión sin apretar más de lo que toca y quédate en la parte baja del rango. Una mala noche no estropea nada; varias seguidas, sí conviene apuntarlas en el check-in.' },
  { id: 'regla', cat: 'salud', q: '¿Entreno con la regla?',
    r: 'Si te encuentras bien, sí, con normalidad. Si ese día el cuerpo no acompaña, haz la sesión más suave o pásala a otro día: no pierdes nada.' },
];

export const APAGADO = new Set(['salud_nueva', 'lecciones_momento', 'checkin_responde', 'notas_lunes', 'dia_a_dia',
  // (v0.247, tanda 6) salud: estoy enfermo, el seguimiento de una molestia, repasar la salud cada seis meses y la señal de
  // alarma; reglas nuevas de progresión: con una molestia en la zona no sube, la semana suave, dos sesiones duras
  // seguidas y la variante de un ejercicio atascado
  'enfermo', 'molestia_sigue', 'salud_al_dia', 'alarma', 'molestia_frena', 'suave', 'dos_duras', 'variante',
  // (v0.248, tanda 7) sus kilos de partida en la semana 1 (cambia de dónde sale su primer peso) y la hoja para su médico (salud)
  'kilos_partida', 'medico',
  // (v0.250, tanda 9: la comida) quince respuestas de comida, «Hoy como fuera», «Tengo mucha hambre», «Me he pasado» y
  // «Tengo una celebración» (con su regla: esos pesos no cuentan), la comida de viaje (no ajusta y pasa a mantener), los
  // avisos del peso (baja deprisa o parado), lo que contesta el check-in al hambre y a la energía, y cuatro lecciones
  'respuestas_comida', 'comida_fuera', 'hambre', 'me_he_pasado', 'celebracion', 'comida_viaje', 'aviso_peso', 'checkin_comida', 'lecciones_comida',
  // (v0.252, motor de nutrición) las preguntas de salud nuevas del cuestionario de nutrición: las exclusiones y el SCOFF
  'salud_comida',
  // (v0.257, motor de molestias) la tabla de zonas de cada ejercicio (M8, hasta que Pelayo dé el visto bueno) y lo que hace
  // con ella: preguntar antes de la sesión, durante, después y a la mañana siguiente, el ajuste de la mañana siguiente, lo
  // que no sube con una zona en ámbar o que va a peor, la alternativa en rojo y el seguimiento a los 3 y 7 días
  'molestias_zona']);
// (v0.248) una respuesta puede salir también en otro tema («¿Cuándo se me cobra?», en «Antes de empezar»)
export const enTema = (x, cat) => x.cat === cat || (x.tambien || []).includes(cat);
// (v0.249, 92) «¿Por qué te vas?»: los motivos (de una lista: así no entra nada de salud; «Otro» deja una frase)
export const MOTIVOS_BAJA = [
  ['tiempo', 'No tengo tiempo'], ['precio', 'Es caro para mí'], ['seguimiento', 'Prefiero que alguien me lleve'],
  ['app', 'No me ha convencido la app'], ['resultados', 'No he notado lo que esperaba'], ['otro', 'Otro motivo'],
];
// (v0.249, tanda 8) Lo que Pelayo enciende y escribe en su panel (esencial_ajustes, migración 103): cada clave, si está
// encendida para este atleta (para todos, o solo para él si la está probando en su cuenta), su versión de los textos y un
// número. Lo pone la app al abrir Hoy (fijarAjustes) y lo leen encendido() y textoAjuste(). Sin la 103, vacío.
let REMOTO = new Map();
export function fijarAjustes(filas = []) {
  REMOTO = new Map((Array.isArray(filas) ? filas : []).filter((f) => f && typeof f.clave === 'string').map((f) => [f.clave, f]));
}
export const ajuste = (clave) => REMOTO.get(clave) || null;
// su texto para ese campo, si lo ha escrito; si no, el de la app
export const textoAjuste = (clave, campo, porDefecto = null) => {
  const t = REMOTO.get(clave)?.texto?.[campo];
  return typeof t === 'string' && t.trim() ? t : porDefecto;
};
// previa: en la demo, con «?previa=1», se ve lo apagado (para que Pelayo lo revise en su sitio)
export const encendido = (clave, previa = false) => !!previa || !APAGADO.has(clave) || REMOTO.get(clave)?.encendido === true;
// (86) cada respuesta, con su versión si la ha corregido; y las que ha añadido él (respuesta_nueva:<id>)
const conSuTexto = (x) => ({ ...x, q: textoAjuste(`respuesta:${x.id}`, 'q', x.q), r: textoAjuste(`respuesta:${x.id}`, 'r', x.r) });
export const respuestasNuevas = () => [...REMOTO.values()].filter((f) => /^respuesta_nueva:[a-z0-9_-]+$/.test(f.clave) && f.texto?.q && f.texto?.r)
  .map((f) => ({ id: f.clave.split(':')[1], cat: CATEGORIAS.some((c) => c[0] === f.texto.cat) ? f.texto.cat : 'app', q: String(f.texto.q), r: String(f.texto.r), suya: true }));
// comida (v0.250): las respuestas de comida que le tocan (respuestasComida de esencial-comida.js, con o sin antecedente de
// TCA), solo para quien lleva nutrición; salen con «respuestas_comida» encendida (o en la vista previa)
// (v0.251) El directo de dudas, oculto (decisión de Pelayo, 26/11/2026: FBE Esencial no tiene directos). Todo lo suyo sigue
// en el código y vuelve si Pelayo enciende «El directo de dudas» en su panel (esencial_ajustes, clave 'directo'): la
// pregunta en «¿Qué necesitas?», estos textos de antes y las dudas que hace públicas; y, en su panel, las preguntas. No
// sale en la vista previa de lo apagado: no espera su visto bueno, está oculto a propósito.
export const conDirecto = () => REMOTO.get('directo')?.encendido === true;
const CON_DIRECTO = {
  pelayo: { r: 'No hay chat ni revisión de tu semana: eso lo llevan los programas con seguimiento. Sí hay un directo al mes para resolver dudas, al que puedes mandar tu pregunta desde aquí, y la comunidad de la app.', ir: 'directo' },
  tecnica: { r: 'Mira el vídeo en «Cómo se hace» y quédate con un peso que controles en todo el recorrido. Si puedes, pide a alguien de sala que te mire una serie. Y si la duda sigue, mándala para el directo del mes.', ir: 'directo' },
};
export const respuestas = ({ previa = false, publicas = [], comida = null } = {}) => {
  const directo = conDirecto();
  return [
    ...RESPUESTAS.map((x) => (directo && CON_DIRECTO[x.id] ? { ...x, ...CON_DIRECTO[x.id] } : x)).map(conSuTexto),
    ...respuestasNuevas(),
    ...(comida && encendido('respuestas_comida', previa) ? comida.map((x) => ({ ...conSuTexto(x), cat: 'comida', pendiente: !REMOTO.get('respuestas_comida')?.encendido })) : []),
    ...(encendido('salud_nueva', previa) ? PENDIENTES.map((x) => ({ ...conSuTexto(x), pendiente: !REMOTO.get('salud_nueva')?.encendido })) : []),
    // (18) las dudas del directo que Pelayo ha contestado y hecho públicas (solo con el directo encendido)
    ...(directo ? (publicas || []).filter((x) => x?.pregunta && x?.respuesta).map((x) => ({ id: `directo-${x.id}`, cat: 'directo', q: x.pregunta, r: x.respuesta, directo: true })) : []),
  ];
};
export const respuestaDe = (id, opciones = {}) => respuestas(opciones).find((x) => x.id === id) || null;

// El buscador: sin tildes ni mayúsculas, todas las palabras (de tres letras o más) en la pregunta o en la respuesta
const plano = (t) => String(t || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
export function buscarRespuestas(texto, lista = RESPUESTAS) {
  const palabras = plano(texto).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  if (!palabras.length) return [];
  return lista.map((x) => {
    const q = plano(x.q), r = plano(x.r);
    const enQ = palabras.filter((w) => q.includes(w)).length, enR = palabras.filter((w) => r.includes(w)).length;
    return { x, puntos: palabras.every((w) => q.includes(w) || r.includes(w)) ? enQ * 3 + enR : 0 };
  }).filter((y) => y.puntos > 0).sort((a, b) => b.puntos - a.puntos).map((y) => y.x);
}

// ---------- (8) Las palabras, explicadas al tocarlas ----------
export const PALABRAS = {
  sobran: ['Te sobran', 'Las repeticiones que podrías haber hecho de más al acabar la serie. «Te sobran 2» es parar cuando aún habrías podido hacer dos más.'],
  serie: ['Serie', 'Un grupo de repeticiones seguidas, sin parar. «3 × 10» son tres series de diez repeticiones, con su descanso entre una y otra.'],
  rango: ['Rango', 'Entre cuántas repeticiones tiene que caer cada serie. «10 a 12» es llegar al menos a diez y, cuando salgan doce en todas, subir.'],
  descarga: ['Descarga', 'Una semana con menos carga o menos series para recuperar. No es para apretar.'],
  marcas: ['Marcas', 'El peso y las repeticiones de tu mejor serie en cada ejercicio: tu punto de partida.'],
  progresion: ['Progresión', 'Hacer un poco más que la semana pasada: una repetición más o un poco más de peso. La app la calcula con lo que apuntas.'],
  checkin: ['Check-in', 'Un minuto a la semana para decir cómo has dormido, tu energía y si algo te molesta. Lo usa la app al preparar tu semana.'],
  alternativa: ['Alternativa', 'Otro ejercicio que trabaja lo mismo, para cuando la máquina está ocupada o no la tienes.'],
};

// ---------- (5) «Dudas» en cada ejercicio de la sesión ----------
export const DUDAS_EJERCICIO = [
  ['No llego a las repeticiones', 'no-llego'],
  ['Me sobran muchas', 'me-sobran'],
  ['Me molesta', 'dolor'],
  ['No sé si lo hago bien', 'tecnica'],
  ['¿Cuánto descanso?', 'descanso'],
];

// ---------- (7) «¿Qué necesitas?» en Hoy ----------
// [id, etiqueta, icono, qué hace: 'accion:<nombre>' (lo resuelve la app) o 'respuesta:<id>']
// [id, etiqueta, icono, qué abre, (v0.247) lo que necesita: 'notas' (la migración 100), 'plan' (su plan en marcha) o la
// clave con la que está apagado]. Sin la migración 100, «Me voy de viaje» abre su respuesta de siempre (SIN_NOTAS).
export const NECESITAS = [
  ['falle', 'He faltado', 'calendario', 'respuesta:falle', 'plan'],
  ['viaje', 'Me voy de viaje', 'reloj', 'accion:viaje'],
  ['duele', 'Me duele algo', 'alerta', 'accion:molestia'],
  ['enfermo', 'Estoy enfermo', 'alerta', 'accion:enfermo', 'enfermo'],
  ['tiempo', 'Hoy tengo poco tiempo', 'reloj', 'respuesta:poco-tiempo', 'plan'],
  ['sitio', 'Entreno en otro sitio', 'ubicacion', 'accion:sitio', 'plan'],
  ['ejercicio', 'Cambiar un ejercicio', 'reiniciar', 'accion:ejercicios', 'plan'],
  ['dias', 'Cambiar mis días', 'calendario', 'accion:dias', 'plan'],
  ['rutina', 'Cambiar de rutina', 'plantillas', 'accion:rutina', 'plan'],
  ['suave', 'Necesito una semana suave', 'pausa', 'accion:suave', 'suave'],
  ['objetivo', 'Ponerme un objetivo', 'diana', 'accion:objetivo', 'notas'],
  ['plan', 'Entender mi plan', 'biblioteca', 'accion:plan', 'plan'],
  // (v0.255) sus pruebas (silla, equilibrio, cintura y altura…): solo con la 108, que es donde se guardan
  ['pruebas', 'Mis pruebas', 'progreso', 'accion:pruebas', 'pruebas'],
  // (v0.254) su medicación con los nombres de Pauta Activa (solo a quien dijo que toma medicación a diario) y las
  // herramientas de la web que no están en la app (a todos)
  ['medicacion', 'Mi medicación y el ejercicio', 'escudo', 'accion:medicacion', 'medicacion'],
  ['herramientas', 'Más herramientas', 'calculadora', 'accion:herramientas'],
  // (v0.251) la pregunta para el directo: oculta salvo que Pelayo encienda «El directo de dudas» (conDirecto)
  ['directo', 'Preguntar a Pelayo', 'mensaje', 'accion:directo', 'directo'],
];
export const SIN_NOTAS = { viaje: 'respuesta:viaje' };
// Las opciones que le salen: con100 (¿está la tabla de notas?), conPlan (¿tiene su plan en marcha?), previa (lo apagado),
// (v0.254) conMedicacion (¿dijo en sus preguntas de salud que toma medicación a diario?), (v0.255) con108 (¿está la tabla de
// sus pruebas?)
export function necesitasPara({ con100 = false, conPlan = false, previa = false, conMedicacion = false, con108 = false } = {}) {
  const sale = (pide) => !pide || (pide === 'notas' ? con100 : pide === 'plan' ? conPlan : pide === 'medicacion' ? conMedicacion : pide === 'pruebas' ? con108
    : pide === 'directo' ? con100 && conDirecto()
      : encendido(pide, previa) && conPlan && (pide !== 'suave' || con100));
  return NECESITAS.filter(([, , , , pide]) => sale(pide))
    .map(([id, t, icono, que]) => [id, t, icono, !con100 && SIN_NOTAS[id] ? SIN_NOTAS[id] : que]);
}

// ---------- (19) Cada pantalla, con su «¿Dudas?» ----------
export const DUDAS_PANTALLA = { cierre: 'domingo', perdida: 'falle', marcas: 'marcas', leccion: 'como-sube', dias: 'tercer-dia', rutina: 'cambiar-rutina', revision: 'como-sube', checkin: 'check-in', antes: 'primer-dia', sesion: 'sobran' };

// ---------- (14) Cada aviso lleva a su explicación ----------
// El final del enlace del aviso (#hoy/<clave>, migración 100) → qué se abre en Hoy
export const AVISO_ABRE = { manana: 'plan', hoy: 'plan', empezamos: 'plan', domingo: 'cierre', auto: 'revision', lunes: 'revision', rutina: 'rutina', elige: 'rutina', plan_auto: 'plan', agujetas: 'agujetas', retomar: 'vuelta',
  // (v0.247, migración 101) el aviso de la vuelta de un viaje lleva a su tarjeta
  viaje: 'viajando',
  // (v0.250, migración 104) «¿Te pesas esta semana?» abre «¿Cuándo me peso?»
  pesarme: 'pesarme' };

// ---------- (10) «Tu plan, explicado» y (11) «Tu camino» ----------
// Los hitos de su camino según la semana de su plan (n) y si empezó por «Primeras 4 semanas»
export function caminoDe({ n = null, primeras = false, rutina = null } = {}) {
  const k = Number(n) || 0;
  const pasos = primeras ? [
    [1, 2, 'Aprender el gesto', 'Poco peso, una o dos series y agujetas: son normales estas dos semanas.'],
    [3, 3, 'Tu primera subida de peso', 'Un poco más de peso, y que te sobren 2.'],
    [4, 4, 'Tus marcas', 'Tu mejor serie en cada ejercicio: el punto de partida.'],
    [5, 8, 'La app te prepara cada semana', 'Una repetición más o un poco más de peso, con lo que apuntas.'],
    [9, 12, 'Constancia', 'Las subidas se espacian: es lo normal. Lo que cuenta es seguir viniendo.'],
    [13, 999, 'Tu rutina, a examen', 'A las doce semanas, mira «Tu rutina»: seguir, cambiar o dar el paso a un programa con seguimiento.'],
  ] : [
    [1, 2, 'Coger el pulso a tu rutina', 'Las dos primeras semanas son para encontrar tus pesos: apunta bien y no vayas al límite.'],
    [3, 8, 'Subir poco a poco', 'Una repetición más o un poco más de peso cada semana, con lo que apuntas.'],
    [9, 12, 'Constancia', 'Las subidas se espacian: es lo normal. Si un ejercicio se atasca tres semanas, la app lo baja un poco para volver a subir.'],
    [13, 999, 'Tu rutina, a examen', 'A las doce semanas, mira «Tu rutina»: seguir, cambiar o dar el paso a un programa con seguimiento.'],
  ];
  return pasos.map(([de, a, titulo, texto]) => ({ de, a, titulo, texto, estado: k > a ? 'hecho' : k >= de ? 'ahora' : 'despues',
    cuando: a >= 999 ? `Desde la semana ${de}` : de === a ? `Semana ${de}` : `Semanas ${de} a ${a}` })).map((x) => ({ ...x, rutina }));
}

// «Tu plan, explicado»: los párrafos fijos (cómo progresa y qué pasa cada cuatro y cada doce semanas)
export const PLAN_EXPLICADO = [
  ['Cómo progresa', 'Cada semana, la app te prepara la siguiente con lo que has apuntado: si cumples en todas las series, un poco más; si alguna no llega, repites. Nunca más de un salto de una semana a otra.'],
  ['Cada domingo', 'Si has hecho tu semana, la siguiente queda lista. Si te falta alguna sesión, eliges: pasar a la siguiente o repetir esta.'],
  ['Cada cuatro semanas', 'En Hoy, lo que llevas; en Progreso, lo que has subido en cada ejercicio y tu constancia.'],
  ['Cada doce semanas', 'Lo recomendable es mantener la rutina al menos 12 semanas. Entonces, en «Tu rutina», decides: seguir, cambiar o dar el paso a un programa con seguimiento.'],
];

// ---------- (9, P) Lecciones que saltan cuando toca (APAGADO) ----------
export const LECCIONES_MOMENTO = {
  descarga: ['Tu primera semana de descarga', 'Esta semana haces menos a propósito. No es perder el tiempo: es cuando el cuerpo asimila lo de las anteriores. Sal de cada sesión con la sensación de que podías más.'],
  estancado: ['La primera vez que te atascas', 'Tres semanas con el mismo peso no es un fallo tuyo: es que ese peso ya te ha dado lo que podía. Bajar un poco y volver a subir es el camino más corto.'],
  repetir: ['Una semana a medias', 'No pasa nada. Se repite tal cual y no hay nada que recuperar: lo que cuenta es la siguiente sesión, no la que faltó.'],
  vuelta: ['Volver después de un parón', 'Lo que tenías no se ha perdido: vuelve rápido. Esta semana va más suave a propósito; en dos o tres estás donde lo dejaste.'],
  rutina: ['Rutina nueva', 'Las dos primeras semanas con una rutina nueva son para encontrar tus pesos, no para batir marcas. Apunta bien y deja margen.'],
};
// (v0.249) con su versión, si la ha escrito en su panel (momento:<id>) → [título, texto] o null
export const leccionMomento = (id) => (LECCIONES_MOMENTO[id] ? [textoAjuste(`momento:${id}`, 'titulo', LECCIONES_MOMENTO[id][0]), textoAjuste(`momento:${id}`, 'texto', LECCIONES_MOMENTO[id][1])] : null);
// El momento de una revisión (api.esencialRevision) → clave de LECCIONES_MOMENTO o null
export function momentoDe(rev) {
  if (!rev) return null;
  if (rev.semana === 'descarga') return 'descarga';
  if (rev.semana === 'vuelta') return 'vuelta';
  if (rev.semana === 'repetir') return 'repetir';
  if ((rev.porque || []).some((h) => h.estancado)) return 'estancado';
  if (rev.tipo === 'primera') return 'rutina';
  return null;
}

// ---------- (15, P) El check-in contesta a cada cosa (APAGADO) ----------
// f: sus respuestas ({ horas_sueno: '<5' | '5-6' | …, motivacion: 1-5 }) → [frases]. De la energía y la recuperación bajas ya
// se dice qué hace la app (logica/esencial-checkin.js): aquí, lo que no tenía respuesta.
export function checkinResponde(f = {}) {
  const out = [];
  if (['<5', '5-6'].includes(f?.horas_sueno)) out.push('Has dormido poco esta semana: en las sesiones, deja un poco más de margen en cada serie y no añadas nada por tu cuenta.');
  if (f?.motivacion != null && Number(f.motivacion) >= 1 && Number(f.motivacion) <= 2) out.push('Con poca motivación, no esperes a tener ganas: abre la sesión y haz solo lo importante. Una sesión corta cuenta igual.');
  return out;
}
