// v0.62: «Avisar aunque bloquees el móvil». Con la pantalla bloqueada, el iPhone congela la página (y Chrome de Android la
// frena): nada puede ejecutar código justo al acabar el descanso, así que ni suena el pitido ni habla la voz (el aviso al
// móvil del servidor sí llega). La salida: al empezar el descanso (en el mismo toque que marca la serie), un <audio> empieza
// una sola pista hecha para ese descanso: tramas MP3 en silencio hasta los 3 últimos segundos, la cuenta atrás y el aviso
// justo al final. La reproduce el sistema, sin código de la página. Aquí, lo que se puede probar sin navegador: el plan de la
// pista (qué suena y cuándo), componerla, el título de la pantalla de bloqueo y los cambios del descanso (±15, pausa).
import { mmss, num } from './calculos.js';

// El formato de todas las tramas: MPEG-1 capa III, 48 kHz, mono, 48 kbit/s CBR. A 48 kHz una trama mide siempre lo mismo
// (144 bytes, sin relleno) y dura 24 ms (1152 muestras): una pista de N tramas dura N × 24 ms exactos, y el navegador calcula
// su duración por el tamaño (sin cabecera Xing que mienta, porque no se pone).
export const FORMATO_PISTA = { tasa: 48000, kbps: 48, bytes: 144, ms: 24 };
export const MAX_PISTA_MS = 15 * 60 * 1000;   // más larga, no (una pista de 15 min son 2,7 MB): queda el aviso al móvil
export const COLA_MS = 600;                   // un poco de silencio tras el aviso (que no se corte el final)
const B = FORMATO_PISTA.bytes;

export const esTrama = (b, i) => b[i] === 0xFF && b[i + 1] === 0xFB && b[i + 2] === 0x34 && (b[i + 3] & 0xC0) === 0xC0;
const esInfo = (b, i) => { const t = String.fromCharCode(b[i + 21], b[i + 22], b[i + 23], b[i + 24]); return t === 'Xing' || t === 'Info'; };

// Las tramas del formato de un MP3 (sin la etiqueta ID3 ni la trama «Info» de LAME), seguidas. Lo que no es del formato se salta.
export function tramasDe(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let i = 0;
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) i = 10 + ((b[6] & 0x7f) << 21 | (b[7] & 0x7f) << 14 | (b[8] & 0x7f) << 7 | (b[9] & 0x7f));
  const trozos = [];
  while (i + B <= b.length) {
    if (esTrama(b, i)) { if (!esInfo(b, i)) trozos.push(b.subarray(i, i + B)); i += B; } else i++;
  }
  const out = new Uint8Array(trozos.length * B);
  trozos.forEach((t, k) => out.set(t, k * B));
  return out;
}

// Una trama en silencio: la cabecera y la información lateral a cero (sin datos: el decodificador da ceros)
export function tramaSilencio() {
  const t = new Uint8Array(B);
  t.set([0xFF, 0xFB, 0x34, 0xC0]);
  return t;
}
export const numTramas = (ms) => Math.max(0, Math.round(ms / FORMATO_PISTA.ms));

// Qué suena al final y en la cuenta atrás. Con las frases del coach (las seis) y el entrenador por voz encendido: su «tres, dos,
// uno», «Se acabó el descanso» y «Última serie» o «¡Vamos!». Si no, los pitidos (si están puestos) y el aviso elegido.
export const FRASES_COACH = ['fin', 'vamos', 'ultima', 'tres', 'dos', 'uno'];
export const conFrases = (voces) => !!voces && FRASES_COACH.every((k) => voces[k] > 0);
export function clipsFinal({ sonido = 'tres-beeps', voz = false, voces = null, ultima = false, clips = {} } = {}) {
  if (voz && conFrases(voces)) return ['fin', ultima ? 'ultima' : 'vamos'];
  return [clips[sonido] > 0 ? sonido : 'tres-beeps'];
}

// El plan: [clave | null (silencio), tramas][] con el aviso en la trama `cue`. clips y voces: clave → cuántas tramas mide.
// Si una pieza no cabe donde tocaría (la anterior aún suena), va justo detrás. null si no hay pista (sin tiempo o demasiado).
export function planPista({ restanteMs, cuentaAtras = true, sonido = 'tres-beeps', voz = false, ultima = false, clips = {}, voces = null } = {}) {
  if (!(restanteMs > 0) || restanteMs > MAX_PISTA_MS) return null;
  const fin = numTramas(restanteMs);
  const frases = voz && conFrases(voces);
  const largo = (k) => (frases && voces[k] > 0 ? voces[k] : clips[k] || 0);
  const piezas = [];
  // La cuenta atrás (como en la página: a los 3, 2 y 1 segundos), solo la que cabe en lo que queda
  if (frases || (cuentaAtras && clips.pitido > 0)) {
    for (const s of [3, 2, 1]) {
      const en = fin - numTramas(s * 1000);
      if (en >= 0) piezas.push([frases ? ({ 3: 'tres', 2: 'dos', 1: 'uno' })[s] : 'pitido', en]);
    }
  }
  const final = clipsFinal({ sonido, voz, voces, ultima, clips });
  final.forEach((k) => piezas.push([k, fin, true]));
  const partes = [];
  let cursor = 0, cue = null;
  for (const [k, en, esFinal] of piezas) {
    const n = largo(k);
    if (!n) continue;
    const inicio = Math.max(en, cursor);
    if (inicio > cursor) partes.push([null, inicio - cursor]);
    if (esFinal && cue === null) cue = inicio;
    partes.push([k, n]);
    cursor = inicio + n;
  }
  if (cue === null) return null;
  partes.push([null, numTramas(COLA_MS)]);
  const total = partes.reduce((s, [, n]) => s + n, 0);
  return { partes, cue, total, cueMs: cue * FORMATO_PISTA.ms, duracionMs: total * FORMATO_PISTA.ms, final };
}

// Los bytes de la pista: datos es clave → Uint8Array de tramas (las de CLIPS/VOCES ya decodificadas del base64)
export function componerPista(plan, datos) {
  const out = new Uint8Array(plan.total * B);
  const silencio = tramaSilencio();
  let t = 0;
  for (const [k, n] of plan.partes) {
    if (k === null) { for (let i = 0; i < n; i++) out.set(silencio, (t + i) * B); } else out.set(datos[k].subarray(0, n * B), t * B);
    t += n;
  }
  return out;
}

// ¿Ya ha empezado a sonar el aviso? (para anular el aviso al móvil: ya ha avisado la pista)
export const avisoSonando = (segundos, plan) => !!plan && Number.isFinite(segundos) && segundos * 1000 >= plan.cueMs - 50;

// ---------- el descanso: lo que queda, ±15 s y la pausa (la misma cuenta que el temporizador) ----------
// Un descanso es { fin, total, ... } y, en pausa (desde la pantalla de bloqueo), además pausa: los ms que quedaban
export const enPausa = (d) => !!d && Number.isFinite(d.pausa);
export const restanteMs = (d, ahora = Date.now()) => (!d ? 0 : enPausa(d) ? Math.max(0, d.pausa) : Math.max(0, d.fin - ahora));
export function ajustarDescanso(d, s, ahora = Date.now()) {
  if (enPausa(d)) {
    const p = d.pausa + s * 1000;
    if (p <= 0) return { ...d, pausa: null, fin: ahora };
    return { ...d, pausa: p, total: Math.max(d.total, p / 1000) };
  }
  const base = Math.max(ahora, d.fin);
  return { ...d, fin: base + s * 1000, total: Math.max(d.total, (base - ahora) / 1000 + s) };
}
export function pausarDescanso(d, ahora = Date.now()) {
  if (!d || enPausa(d) || d.fin <= ahora) return d;
  return { ...d, pausa: d.fin - ahora };
}
export function reanudarDescanso(d, ahora = Date.now()) {
  if (!enPausa(d)) return d;
  const { pausa, ...resto } = d;
  return { ...resto, fin: ahora + pausa };
}

// ---------- la pantalla de bloqueo (Media Session) ----------
export function tituloMedia({ restanteS, pausa = false, prueba = false, oculta = false } = {}) {
  const base = prueba ? 'Prueba del aviso' : pausa ? 'Descanso en pausa' : 'Descanso';
  if (!(restanteS > 0)) return prueba ? 'Prueba del aviso' : '¡Vamos!';
  // (con la página oculta, sin la cifra: el móvil puede congelarla y se quedaría parada; ya la da la barra de progreso)
  return oculta && !pausa ? base : `${base} · ${mmss(restanteS)}`;
}
export const albumMedia = (texto) => (texto ? `Después: ${texto}` : '');
export function posicionMedia({ total, restanteS, pausa = false }) {
  const r = Math.max(0, Number(restanteS) || 0);
  const duration = Math.max(1, Number(total) || 0, r);
  return { duration, position: Math.min(duration, Math.max(0, duration - r)), playbackRate: pausa ? 0 : 1 };
}

// ---------- lo que se dice y lo que lleva el aviso al móvil ----------
export const esUltima = (voz) => /\u00daltima serie\.\s*$/.test(String(voz || ''));
// Lo que dice la voz del móvil cuando la página sigue viva al acabar un descanso que ya ha avisado la pista: la frase de la
// serie siguiente, sin repetir lo que acaba de decir la pista con la voz del coach (final: las piezas del aviso, del plan).
// '' si no queda nada que decir. Así nunca se dice dos veces lo mismo.
export function fraseTrasPista(voz, final = []) {
  let v = String(voz || '').trim() || '¡Vamos!';
  if (final.includes('ultima')) v = v.replace(/\s*\u00daltima serie\.\s*$/, '').trim();
  if (final.includes('vamos') && v === '¡Vamos!') v = '';
  return v;
}
// El texto del aviso al móvil: lo que toca y, si se sabe, la carga propuesta («serie 3 de press banca · 80 kg × 6»)
export function textoAviso({ texto, kg = null, reps = null } = {}) {
  const t = String(texto || '').trim();
  if (!t) return '';
  const k = Number(kg) > 0 ? `${num(Number(kg), 2)} kg` : null;
  const r = Number(reps) > 0 ? Math.round(Number(reps)) : null;
  const carga = k && r ? ` · ${k} × ${r}` : k ? ` · ${k}` : r ? ` · ${r} reps` : '';
  return `${t}${carga}`.slice(0, 150);
}

// ---------- dónde puede funcionar ----------
// iPhone/iPad: con navigator.audioSession (Safari 16.4+), para poder pasar a «playback» durante el descanso y volver a
// «ambient» después; Android: con Media Session (Chrome, Firefox). En el ordenador no sale: no hay pantalla que bloquear.
export function plataformaPista({ ua = '', plataforma = '', toques = 0, audioSession = false, mediaSession = false, audio = true } = {}) {
  if (!audio) return null;
  const ios = /iP(hone|ad|od)/.test(ua) || (plataforma === 'MacIntel' && toques > 1);
  if (ios) return audioSession ? 'ios' : null;
  if (/Android/i.test(ua)) return mediaSession ? 'android' : null;
  return null;
}
