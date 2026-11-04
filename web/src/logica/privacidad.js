// El aviso de privacidad (v0.56): cuando la política cambia, se avisa UNA vez (no cada vez que se abre la app). La versión
// vista se guarda por cuenta en la base (migración 034; antes, en este móvil).
export const formatoVersion = (v) => typeof v === 'string' && /^20\d{2}-(0[1-9]|1[0-2])$/.test(v);
// La más reciente de las dos (las no válidas no cuentan)
export const versionMayor = (a, b) => [a, b].filter(formatoVersion).sort().pop() || null;
// Hay que enseñarlo si no ha visto ninguna o ha visto una anterior a la actual
export const debeAvisarPrivacidad = (vista, actual) => formatoVersion(actual) && (!formatoVersion(vista) || vista < actual);
// Lo que cambia en cada versión (corto: el texto entero está en la política): [icono, título, texto, versión]. La 2026-11
// (v0.56: el chat) y la 2026-12 (v0.57, v0.58 y v0.59: los vídeos de técnica, su análisis automático, cómo lo has notado,
// los recordatorios y los vídeos modelo)
export const NOVEDADES_PRIVACIDAD = [
  ['video', 'Vídeos de técnica', 'La corrección de tu coach puede llevar una nota de técnica (de 1 a 5), los puntos clave, el tempo y su voz sobre el vídeo. De «Visto» y «Corregido» ves solo el día. El análisis automático (experimental: la trayectoria de la barra, la velocidad estimada y los ángulos de cada repetición) se calcula en el móvil u ordenador, y si tu coach lo guarda, solo se guarda el resumen de cada repetición: los puntos de tu cuerpo nunca se guardan. Al enviar un vídeo puedes contar cómo lo has notado (una molestia, solo con tu consentimiento de salud), y tu coach puede fijarte recordatorios en tu sesión y enseñarte sus vídeos modelo.', '2026-12'],
  ['micro', 'Notas de voz', 'El micro solo se usa mientras grabas una nota de voz (el navegador te pide permiso y se suelta en cuanto paras). Solo las escucha tu coach.', '2026-11'],
  ['mensaje', 'Copia del chat en el móvil', 'Para que el chat abra al momento, el móvil guarda una copia de los textos de los últimos mensajes (nunca fotos, vídeos ni audios). Se borra al cerrar la sesión.', '2026-11'],
  ['imagen', 'Fotos sin ubicación', 'Las fotos se limpian antes de salir (sin GPS ni datos del móvil). Si una no se puede limpiar, te avisamos antes de enviarla. Los vídeos salen tal cual.', '2026-11'],
  ['encuesta', 'Encuestas del chat', 'Si tu coach te manda una encuesta, tu voto solo lo ve él.', '2026-11'],
];
// Las novedades que no ha visto: las de después de la versión que vio (todas, si no vio ninguna), hasta la actual
export const novedadesDesde = (vista, actual) => NOVEDADES_PRIVACIDAD.filter(([, , , v]) => v <= actual && (!formatoVersion(vista) || v > vista));
// Antes de la 034 (o si la base no responde): por cuenta, en este móvil
export const clavePrivacidadLocal = (uid) => `fbe-privacidad-vista-${uid}`;
// En la ficha del coach: si ese atleta ha visto las novedades de la política vigente
export function textoPrivacidadVista(fila, actual) {
  const v = formatoVersion(fila?.version) ? fila.version : null;
  if (!v) return `Sin constancia de que haya visto las novedades de la política de privacidad (${actual}): le saldrán al abrir la app.`;
  if (v >= actual) return `Ha visto la política de privacidad vigente (${actual}).`;
  return `Vio la política de ${v}; la vigente es la ${actual}: le saldrán las novedades al abrir la app.`;
}
