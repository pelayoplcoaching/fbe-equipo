// El aviso de privacidad (v0.56): cuando la política cambia, se avisa UNA vez (no cada vez que se abre la app). La versión
// vista se guarda por cuenta en la base (migración 034; antes, en este móvil).
// (v0.59) Una versión es «AAAA-MM» o, para añadir algo dentro del mismo mes, «AAAA-MM.n» (de 1 a 9; la 037 lo admite en la
// base). Se comparan por partes (año-mes y luego la revisión), nunca como texto: 2026-12 < 2026-12.1 < 2026-12.2 < 2027-01.
const RE_VERSION = /^(20\d{2})-(0[1-9]|1[0-2])(?:\.([1-9]))?$/;
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
// de la app y tus discos, en el móvil)
export const NOVEDADES_PRIVACIDAD = [
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
