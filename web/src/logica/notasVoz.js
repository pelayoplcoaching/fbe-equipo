// Las notas de voz del chat (v0.56): lo que no depende de la pantalla ni del micro. Como mucho UN minuto (lo pide el
// coach): se ve «0:42 / 1:00», avisa en los últimos 10 segundos y al llegar al minuto se para sola (y se queda lo grabado,
// para escucharlo y enviarlo). Sin transcripción.
export const LIMITE_VOZ_SEG = 60;
export const AVISO_VOZ_SEG = 10;
export const MIN_VOZ_SEG = 1;
export const MAX_VOZ_BYTES = 3 * 1048576;
export const VELOCIDADES = [1, 1.5, 2];

export const mmss = (seg) => { const s = Math.max(0, Math.floor(Number(seg) || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// «0:42 / 1:00»
export const textoContador = (seg, limite = LIMITE_VOZ_SEG) => `${mmss(Math.min(seg, limite))} / ${mmss(limite)}`;
// ¿En los últimos 10 segundos? (el aviso)
export const quedaPoco = (seg, limite = LIMITE_VOZ_SEG, aviso = AVISO_VOZ_SEG) => seg >= limite - aviso && seg < limite;
export const segundosRestantes = (seg, limite = LIMITE_VOZ_SEG) => Math.max(0, Math.ceil(limite - seg));
// ¿Hay que pararla ya? (el minuto)
export const alLimite = (seg, limite = LIMITE_VOZ_SEG) => seg >= limite;
// La duración que se guarda: segundos enteros, de 1 a 60 (la base acepta hasta 61, por si el redondeo)
export const duracionGuardada = (seg) => Math.max(MIN_VOZ_SEG, Math.min(LIMITE_VOZ_SEG, Math.round(Number(seg) || 0)));

// El formato: Opus en WebM (Chrome, Firefox, Android) o, si no, MP4/AAC (Safari de iPhone). esCompatible: la función
// MediaRecorder.isTypeSupported. Devuelve { grabar, tipo, ext } (grabar: lo que se le pide a MediaRecorder; tipo: el MIME
// con que se sube, sin parámetros, como lo acepta Storage) o null si no se puede grabar.
const FORMATOS = [['audio/webm;codecs=opus', 'audio/webm', 'webm'], ['audio/webm', 'audio/webm', 'webm'], ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'm4a'],
  ['audio/mp4', 'audio/mp4', 'm4a'], ['audio/ogg;codecs=opus', 'audio/ogg', 'ogg'], ['audio/aac', 'audio/aac', 'aac']];
export function formatoGrabacion(esCompatible) {
  if (typeof esCompatible !== 'function') return null;
  for (const [grabar, tipo, ext] of FORMATOS) { try { if (esCompatible(grabar)) return { grabar, tipo, ext }; } catch { /* */ } }
  return null;
}
// El MIME sin parámetros y la extensión de un audio ya grabado (lo que diga el navegador)
export function tipoAudio(mime) {
  const t = String(mime || '').toLowerCase().split(';')[0].trim();
  const ext = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/mpeg': 'mp3', 'audio/aac': 'aac' }[t];
  if (!ext) return null;
  return { tipo: t === 'audio/x-m4a' ? 'audio/mp4' : t, ext };
}

// La forma de onda: los niveles (0…1) medidos mientras se graba, en n barras de 0 a 100 (lo que se guarda: de 8 a 64)
export function ondaDe(niveles = [], n = 40) {
  const xs = (Array.isArray(niveles) ? niveles : []).map((x) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0));
  const k = Math.max(8, Math.min(64, Math.round(n)));
  if (!xs.length) return Array(k).fill(0);
  const out = [];
  for (let i = 0; i < k; i++) {
    const a = Math.floor((i * xs.length) / k), b = Math.max(a + 1, Math.floor(((i + 1) * xs.length) / k));
    const trozo = xs.slice(a, b);
    out.push(Math.round(Math.max(...trozo) * 100));
  }
  // Que se vea aunque se haya hablado bajo: lo más alto, al 100
  const max = Math.max(...out);
  return max > 0 ? out.map((x) => Math.round((x / max) * 100)) : out;
}
export const ondaValida = (o) => Array.isArray(o) && o.length >= 8 && o.length <= 64 && o.every((x) => Number.isInteger(x) && x >= 0 && x <= 100);

// El gesto al mantener pulsado el micro (como WhatsApp): hacia la izquierda, cancela; hacia arriba, la deja grabando
// sin el dedo («bloqueada»). dx, dy: lo que se ha movido el dedo desde que se pulsó (en px).
export const UMBRAL_CANCELAR = 110;
export const UMBRAL_BLOQUEAR = 80;
export function gestoVoz(dx, dy) {
  if (dx <= -UMBRAL_CANCELAR) return 'cancelar';
  if (dy <= -UMBRAL_BLOQUEAR && Math.abs(dx) < UMBRAL_CANCELAR) return 'bloquear';
  return null;
}
// Una pulsación corta (menos de esto) es «tocar»: empieza a grabar sin tener que mantenerlo (y se para con «Parar»)
export const PULSACION_CORTA_MS = 300;

export const siguienteVelocidad = (v) => VELOCIDADES[(VELOCIDADES.indexOf(v) + 1) % VELOCIDADES.length] || 1;
export const textoVelocidad = (v) => `${String(v).replace('.', ',')}×`;

// Los mensajes de error, claros (permiso denegado, sin micro, sin grabación en este navegador)
export function errorMicro(e) {
  const n = e?.name || '';
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return 'No hay permiso para usar el micro: actívalo en los ajustes del navegador para esta app.';
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return 'No se encuentra ningún micro en este dispositivo.';
  if (n === 'NotReadableError' || n === 'TrackStartError') return 'El micro lo está usando otra app: ciérrala y vuelve a probar.';
  if (n === 'NoSoportado') return 'Este navegador no puede grabar notas de voz. Prueba con Chrome, Safari o Firefox actualizados.';
  return 'No se ha podido grabar la nota de voz.';
}
