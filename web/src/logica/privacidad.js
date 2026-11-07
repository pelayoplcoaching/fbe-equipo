// El aviso de privacidad (v0.56): cuando la política cambia, se avisa UNA vez (no cada vez que se abre la app). La versión
// vista se guarda por cuenta en la base (migración 034; antes, en este móvil).
// (v0.59) Una versión es «AAAA-MM» o, para añadir algo dentro del mismo mes, «AAAA-MM.n» (de 1 a 9; la 037 lo admite en la
// base). Se comparan por partes (año-mes y luego la revisión), nunca como texto: 2026-12 < 2026-12.1 < 2026-12.2 < … < 2026-12.9 < 2026-12.10 < 2027-01 (v0.71: de una o dos cifras).
// (v0.71, 043) La revisión, de una o dos cifras (de 1 a 99): 2026-12.9 < 2026-12.10
const RE_VERSION = /^(20\d{2})-(0[1-9]|1[0-2])(?:\.([1-9]\d?))?$/;
export const formatoVersion = (v) => typeof v === 'string' && RE_VERSION.test(v);
// La versión sin su revisión («2026-12.1» → «2026-12»): la que entiende una base sin la 037
export const versionSinRevision = (v) => (formatoVersion(v) ? v.slice(0, 7) : null);
// -1, 0 o 1 (solo con dos versiones válidas; si no, null)
export function compararVersiones(a, b) {
  const x = formatoVersion(a) && a.match(RE_VERSION), y = formatoVersion(b) && b.match(RE_VERSION);
  if (!x || !y) return null;
  const clave = (m) => [Number(m[1]) * 12 + Number(m[2]), Number(m[3] || 0)];
  const [ma, ra] = clave(x), [mb, rb] = clave(y);
  return ma !== mb ? Math.sign(ma - mb) : Math.sign(ra - rb);
}
// La más reciente de las dos (las no válidas no cuentan)
export const versionMayor = (a, b) => {
  const vs = [a, b].filter(formatoVersion);
  if (vs.length < 2) return vs[0] || null;
  return compararVersiones(vs[0], vs[1]) >= 0 ? vs[0] : vs[1];
};
// Hay que enseñarlo si no ha visto ninguna o ha visto una anterior a la actual
export const debeAvisarPrivacidad = (vista, actual) => formatoVersion(actual) && (!formatoVersion(vista) || compararVersiones(vista, actual) < 0);
// Lo que cambia en cada versión (corto: el texto entero está en la política): [icono, título, texto, versión]. La 2026-11
// (v0.56: el chat), la 2026-12 (v0.57 y v0.58: los vídeos de técnica y su análisis automático) y la 2026-12.1 (v0.59, con
// la 037: cómo lo has notado, los recordatorios y los vídeos modelo) y la 2026-12.2 (v0.60: las respuestas en vídeo, exportar
// y difuminar la cara en el móvil) y la 2026-12.4 (v0.62: avisar aunque bloquees el móvil) y la 2026-12.5 (v0.63: el teclado
// de la app y tus discos, en el móvil) y la 2026-12.6 (v0.64: el orden de hoy de una sesión, en el móvil) y la 2026-12.7 (v0.65:
// la copia de tu semana en el móvil, para abrir sin cobertura) y la 2026-12.8 (v0.69: «Entrenando ahora», la bienvenida, las
// respuestas y los 💪 a comentarios, el resumen del domingo y compartir los entrenos sin preguntar) y la 2026-12.9 (v0.70: los
// compañeros de racha, los retos por equipos, los minutos de cardio en los retos y las insignias) y la 2026-12.10 (v0.71: los temas,
// las preguntas al coach y las del equipo, varias fotos, lo guardado, la búsqueda y la mejor respuesta) y la 2026-12.11 (v0.72: los
// eventos, el atleta de la semana, el panel del coach y la moderación) y la 2026-12.12 (v0.73: los aniversarios, el mes en el equipo,
// los hitos, las reacciones y pegatinas y los momentos de 24 horas) y la 2026-12.13 (v0.95: cómo va la app, los fallos y los tiempos)
export const NOVEDADES_PRIVACIDAD = [
  ['reloj', 'Cómo va la app', 'Para ver si la app va lenta, cada móvil manda al día cuánto tarda en abrir, en cada pantalla y en guardar, con el tipo de móvil. Tu coach lo ve sin tu nombre y se borra a los 60 días. Si algo falla, se apunta el error técnico, nunca lo que escribes.', '2026-12.13'],
  ['equipo', 'Aniversarios, tu mes y momentos de 24 h', 'Tu aniversario en FBE sale en el muro (salvo con «No salir en el ranking»). Del 1 al 7, los recuentos del mes del equipo y, solo para ti, los tuyos. Los momentos se ven 24 horas y después se borran con su foto.', '2026-12.12'],
  ['equipo', 'Eventos, atleta de la semana y moderación', 'Si te apuntas a un evento del equipo, los de dentro ven que vas y te llega un recordatorio dos horas antes. Tu coach puede elegirte atleta de la semana (si sales en el ranking) y ve un panel con recuentos, sin contenido. Puede pausar tus publicaciones un tiempo, y lo que lleve una palabra filtrada queda pendiente de revisión: solo lo veis tú y él.', '2026-12.11'],
  ['equipo', 'Preguntas, fotos y guardados en el equipo', 'Las publicaciones llevan un tema y hasta 4 fotos. Si tu coach guarda tu «Pregunta para el coach» como pregunta frecuente, todo el equipo ve una copia sin tu nombre. Lo que guardas solo lo ves tú. Quien publica o tu coach pueden marcar tu comentario como mejor respuesta: te llega un aviso.', '2026-12.10'],
  ['equipo', 'Compañeros de racha, equipos e insignias', 'Si aceptas ser compañeros de racha, la pareja y vuestra racha las veis los dos, tu coach y el equipo (salvo si uno no sale en el ranking); tu compañero ve si has completado tu semana. En los retos por equipos sumas a tu equipo (sin ranking, no). Tus minutos de cardio solo cuentan en los retos si lo enciendes. Las insignias salen de lo que ya se comparte.', '2026-12.9'],
  ['equipo', 'Novedades del equipo', 'En la comunidad, «Que el equipo vea cuándo estoy entrenando» (apagado de entrada) enseña tu nombre y tu foto mientras entrenas, nunca la hora ni lo que haces. Puedes dar la bienvenida a quien entra, responder a un comentario y darle 💪, y el domingo te puede llegar el resumen de la semana del equipo (solo recuentos). «Compartir mis entrenos sin preguntar» se guarda solo en tu móvil.', '2026-12.8'],
  ['sinred', 'Tu semana, también sin cobertura', 'Para que Hoy y tu sesión abran al momento aunque no tengas señal, el móvil guarda una copia de tu semana (tu programa y las sesiones que te quedan, con lo que hiciste la última vez y las notas de tu coach). Solo para tu cuenta: se pone al día con conexión y se borra al cerrar la sesión. También la última versión de la app que has abierto, para enseñarte sus novedades una vez.', '2026-12.7'],
  ['ordenar', 'El orden de tu sesión', 'Si cambias el orden de los ejercicios de una sesión (con la máquina ocupada, por ejemplo), se guarda solo en tu móvil y para esa sesión: la pauta de tu coach no cambia. Tu coach ve en qué orden los hiciste por la hora de cada serie, que ya se guardaba.', '2026-12.6'],
  ['teclado', 'El teclado de la app y tus discos', 'Si apuntas las series con el teclado de la app o con el del móvil, y el disco más pequeño que tienes en cada sitio (para los −/+ de los kilos), se guarda solo en tu móvil.', '2026-12.5'],
  ['candado', 'Avisar aunque bloquees el móvil', 'Si lo enciendes (se guarda solo en ese móvil), la pantalla de bloqueo enseña tu descanso y la serie siguiente con sus kilos mientras descansas: lo ve quien mire tu móvil, sin desbloquearlo (y puede salir en el coche o el reloj, si están conectados). El aviso del fin del descanso dice también la carga que te toca.', '2026-12.4'],
  ['video', 'Resumen de la sesión, informe del mes y solo con wifi', 'Tu coach puede mandarte un resumen de toda una sesión y el informe de técnica de cada mes: te llegan al chat con un aviso sin el texto. El informe y el 1RM estimado por la velocidad se calculan en el móvil al abrirlos, sin guardarse aparte. «Subir los vídeos solo con wifi» se guarda solo en tu móvil.', '2026-12.3'],
  ['video', 'Respuestas en vídeo, exportar y difuminar la cara', 'Tu coach puede grabar su revisión (su voz y, si quiere, su cara) y los dos podéis responder en el hilo con la cámara de delante: la cámara y el micro solo se usan mientras se graba. Exportar con correcciones se hace en el móvil, sin subir nada. Con «Difuminar la cara», tu móvil tapa tu cara y solo se sube el vídeo difuminado: el original no sale de él.', '2026-12.2'],
  ['video', 'Cómo lo has notado, recordatorios y vídeos modelo', 'Al enviar un vídeo puedes contar cómo lo has notado: el esfuerzo, lo que notas y, solo con tu consentimiento de salud, una molestia. Lo ve solo tu coach. Tu coach puede fijarte recordatorios en tu sesión y enseñarte sus vídeos modelo.', '2026-12.1'],
  ['video', 'Vídeos de técnica', 'La corrección de tu coach puede llevar una nota de técnica (de 1 a 5), los puntos clave, el tempo y su voz sobre el vídeo. De «Visto» y «Corregido» ves solo el día. El análisis automático (experimental: la trayectoria de la barra, la velocidad estimada y los ángulos de cada repetición) se calcula en el móvil u ordenador, y si tu coach lo guarda, solo se guarda el resumen de cada repetición: los puntos de tu cuerpo nunca se guardan.', '2026-12'],
  ['micro', 'Notas de voz', 'El micro solo se usa mientras grabas una nota de voz (el navegador te pide permiso y se suelta en cuanto paras). Solo las escucha tu coach.', '2026-11'],
  ['mensaje', 'Copia del chat en el móvil', 'Para que el chat abra al momento, el móvil guarda una copia de los textos de los últimos mensajes (nunca fotos, vídeos ni audios). Se borra al cerrar la sesión.', '2026-11'],
  ['imagen', 'Fotos sin ubicación', 'Las fotos se limpian antes de salir (sin GPS ni datos del móvil). Si una no se puede limpiar, te avisamos antes de enviarla. Los vídeos salen tal cual.', '2026-11'],
  ['encuesta', 'Encuestas del chat', 'Si tu coach te manda una encuesta, tu voto solo lo ve él.', '2026-11'],
];
// Las novedades que no ha visto: las de después de la versión que vio (todas, si no vio ninguna), hasta la actual
export const novedadesDesde = (vista, actual) => NOVEDADES_PRIVACIDAD.filter(([, , , v]) => compararVersiones(v, actual) <= 0 && (!formatoVersion(vista) || compararVersiones(v, vista) > 0));
// Antes de la 034 (o si la base no responde): por cuenta, en este móvil
export const clavePrivacidadLocal = (uid) => `fbe-privacidad-vista-${uid}`;
// En la ficha del coach: si ese atleta ha visto las novedades de la política vigente
export function textoPrivacidadVista(fila, actual) {
  const v = formatoVersion(fila?.version) ? fila.version : null;
  if (!v) return `Sin constancia de que haya visto las novedades de la política de privacidad (${actual}): le saldrán al abrir la app.`;
  if (compararVersiones(v, actual) >= 0) return `Ha visto la política de privacidad vigente (${actual}).`;
  return `Vio la política de ${v}; la vigente es la ${actual}: le saldrán las novedades al abrir la app.`;
}
