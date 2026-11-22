// (v0.207) Errores de la app: los que no son fallos, aparte, para que se vean los de verdad.
// - Los avisos de las notificaciones que se arreglan solos: al abrir la app, si el navegador o la base no tenían la
//   suscripción, se rehace sola. Se apuntan para saber cuántas veces pasa, no porque algo haya fallado.
// - «Can't find variable: EmptyRanges»: lo dice el reproductor de vídeo del iPhone, no la app (y ya no se apunta).
export const AVISO_PUSH = /^push: al abrir\b/;
export const DEL_IPHONE = /\bEmptyRanges\b/;

export const esAviso = (e) => !!e && (AVISO_PUSH.test(String(e.mensaje || '')) || DEL_IPHONE.test(String(e.mensaje || '')));

export function separarErrores(errores = []) {
  const reales = [], avisos = [];
  for (const e of errores || []) (esAviso(e) ? avisos : reales).push(e);
  return { reales, avisos };
}
