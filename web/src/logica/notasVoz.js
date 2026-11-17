// Las notas de voz del chat (v0.56): lo que no depende de la pantalla ni del micro. Sin transcripción.
// (v0.179) Como mucho DOS minutos (antes, uno): con la migración 081 la base acepta hasta 121 s; sin ella, la app sigue en
// el minuto de siempre (limiteVoz). Se ve «0:42» y, cerca del final, lo que queda; al llegar al límite se para sola (y se
// queda lo grabado, para escucharlo y enviarlo).
export const LIMITE_VOZ_SEG = 120;
export const LIMITE_VOZ_SIN_081 = 60;
// El límite de esta base: lo que diga (voz_limite_seg, de la 081), entre 60 y 120; si no lo dice, el minuto
export const limiteVoz = (deLaBase) => { const n = Math.round(Number(deLaBase)); return Number.isFinite(n) && n >= LIMITE_VOZ_SIN_081 ? Math.min(LIMITE_VOZ_SEG, n) : LIMITE_VOZ_SIN_081; };
// «1 minuto», «2 minutos», «1 minuto y medio»
export const textoLimite = (limite = LIMITE_VOZ_SEG) => (limite % 60 === 0 ? `${limite / 60} minuto${limite === 60 ? '' : 's'}` : `${mmss(limite)} min`);
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
// La duración que se guarda: segundos enteros, de 1 al límite (la base acepta uno más, por si el redondeo)
export const duracionGuardada = (seg, limite = LIMITE_VOZ_SEG) => Math.max(MIN_VOZ_SEG, Math.min(limite, Math.round(Number(seg) || 0)));

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

// (v0.179) Los niveles de la onda en vivo: los últimos n (0…1), para dibujarla mientras se graba
export const ondaViva = (niveles = [], n = 28) => { const xs = (Array.isArray(niveles) ? niveles : []).slice(-n).map((x) => Math.round(Math.max(0, Math.min(1, Number(x) || 0)) * 100)); return [...Array(Math.max(0, n - xs.length)).fill(0), ...xs]; };
// (v0.179) Al acabar una nota suena la siguiente, como en WhatsApp: el mensaje que va justo después, si también es una
// nota de voz (de quien sea). mensajes: en orden; con archivo.tipo === 'audio'. Devuelve su id o null.
export function siguienteVoz(mensajes = [], id) {
  const xs = Array.isArray(mensajes) ? mensajes : [];
  const i = xs.findIndex((m) => m && String(m.id) === String(id));
  const s = i < 0 ? null : xs[i + 1];
  return s && s.archivo?.tipo === 'audio' && !s.eliminado && !s.programado ? s.id : null;
}
// (v0.179) Qué se hace cuando por fin llega el micro. Antes se grababa siempre: si había salido el aviso del sistema (la
// primera vez), el dedo ya no estaba y la grabación se quedaba colgada o se perdía. Ahora, como WhatsApp:
//   · permiso: 'granted' | 'prompt' | null (lo que decía el navegador ANTES de pedir el micro; null si no lo sabe);
//   · tardoMs: lo que ha tardado en llegar; dedoPuesto: sigue manteniendo el micro; manos: lo tocó (o usó el teclado).
// Devuelve 'grabar', 'listo' (se acaba de dar el permiso: no se graba, se dice que ya puede) o 'corta' (lo soltó enseguida).
export const PERMISO_LENTO_MS = 1500;
export function trasPermiso({ permiso = null, tardoMs = 0, dedoPuesto = true, manos = false } = {}) {
  if (permiso === 'prompt') return 'listo';
  if (permiso !== 'granted' && tardoMs >= PERMISO_LENTO_MS) return 'listo';
  return manos || dedoPuesto ? 'grabar' : 'corta';
}
// (v0.179) Cómo activar el micro, paso a paso, según el aparato (ua: navigator.userAgent; instalada: como app en la pantalla de inicio)
export function ayudaMicro(ua = '', instalada = false) {
  const u = String(ua || '');
  const ios = /iPhone|iPad|iPod/.test(u) || (/Macintosh/.test(u) && /Mobile/.test(u));
  // En el iPhone, con Chrome, Firefox o Edge (no Safari): el permiso está en los ajustes de ese navegador
  const otro = ios && /CriOS|FxiOS|EdgiOS/.test(u) ? (/CriOS/.test(u) ? 'Chrome' : /FxiOS/.test(u) ? 'Firefox' : 'Edge') : null;
  if (otro) return {
    aparato: 'iPhone o iPad',
    pasos: ['Abre Ajustes del iPhone.', `Entra en Apps y luego en ${otro}.`, 'Activa «Micrófono».', 'Vuelve al chat y mantén pulsado el micro.'],
    nota: `Si ${otro} vuelve a preguntar al grabar, elige «Permitir».`,
  };
  if (ios) return {
    aparato: 'iPhone o iPad',
    pasos: instalada
      ? ['Abre Ajustes del iPhone.', 'Entra en Apps y luego en Safari.', 'Baja hasta «Micrófono» y elige «Permitir» (o «Preguntar»).', 'Cierra la app del todo y vuelve a abrirla.']
      : ['Toca el icono de la izquierda de la barra de direcciones (aA o el del puzle).', 'Elige «Ajustes del sitio web».', 'En «Micrófono», elige «Permitir».', 'Vuelve al chat y mantén pulsado el micro.'],
    nota: 'El iPhone puede volver a preguntar cada vez que abres la app: con «Permitir» en Ajustes deja de hacerlo.',
  };
  if (/Android/.test(u)) return {
    aparato: 'Android',
    pasos: instalada
      ? ['Mantén pulsado el icono de la app y toca la «i» (Información de la app).', 'Entra en «Permisos» y luego en «Micrófono».', 'Elige «Permitir solo mientras se usa la app».', 'Vuelve al chat y mantén pulsado el micro.']
      : ['Toca el candado (o los ajustes) a la izquierda de la dirección.', 'Entra en «Permisos».', 'Activa «Micrófono».', 'Vuelve al chat y mantén pulsado el micro.'],
    nota: 'Si no aparece, mira también Ajustes del móvil → Apps → Chrome → Permisos → Micrófono.',
  };
  return {
    aparato: 'ordenador',
    pasos: ['Haz clic en el candado (o los ajustes) a la izquierda de la dirección.', 'En «Micrófono», elige «Permitir».', 'Recarga la página.', 'Comprueba en los ajustes de sonido del ordenador que hay un micro conectado.'],
    nota: null,
  };
}
export const esPermisoDenegado = (e) => ['NotAllowedError', 'SecurityError', 'PermissionDeniedError'].includes(e?.name || '');

// Los mensajes de error, claros (permiso denegado, sin micro, sin grabación en este navegador)
export function errorMicro(e) {
  const n = e?.name || '';
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return 'El micro está bloqueado para esta app. Toca «Cómo activarlo» y te lo enseñamos paso a paso.';
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return 'No se encuentra ningún micro en este dispositivo.';
  if (n === 'NotReadableError' || n === 'TrackStartError') return 'El micro lo está usando otra app: ciérrala y vuelve a probar.';
  if (n === 'AbortError') return 'El móvil ha cortado el micro. Vuelve a probar.';
  if (n === 'SinContexto') return 'Para grabar hace falta abrir la app con su dirección segura (https).';
  if (n === 'NoSoportado') return 'Este navegador no puede grabar notas de voz. Prueba con Chrome, Safari o Firefox actualizados.';
  return 'No se ha podido grabar la nota de voz.';
}
