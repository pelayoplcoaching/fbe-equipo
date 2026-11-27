// (v0.208, rendimiento) Lo ligero de la sesión: el sonido y la vibración del descanso, celebrar un récord, mantener la
// pantalla encendida, el reloj y leer números. Antes vivía en sesion-comun.jsx, que trae el temporizador, las placas, la
// ficha del ejercicio y los vídeos: el aviso de la sesión en curso, las medallas de Hoy o la música, que lo usan al abrir
// la app, arrastraban todo eso. sesion-comun.jsx lo sigue exportando.
import { modoCelebrar } from '../../logica/trato.js';
import { useEffect, useState } from 'preact/hooks';
import { leerAjustes } from '../ajustes.js';
import { prepararVoz } from '../voz.js';
import { alPintar, vibrarAlPintar } from '../hapticos.js';
import { contexto, sonarFBE, salida, ocupar } from '../sonido.js';
import { volumenDe } from '../../logica/sonido.js';
import { lanzarConfeti } from '../confeti.js';
import { prepararPista, pistaActiva } from '../pista-descanso.js';

export const RPES = ['', 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
export const COLOR_DISCO = { alta: 'var(--disco-rojo)', media: 'var(--disco-azul)', baja: 'var(--disco-amarillo)', muy_baja: 'var(--disco-verde)' };

// ---------- sonido y vibración al acabar el descanso (el audio se activa con el primer toque) ----------
// Los sonidos son los de FBE Timer (v0.27.1, a petición de los atletas: el pitido de antes se oía muy bajo).
// Van por Web Audio, como el pitido: en iPhone un <audio> solo suena si arranca en el mismo toque, y el aviso
// llega solo al acabar el descanso (o unos milisegundos después de tocar «Probar»). Así también funciona el
// volumen en iPhone. La sesión de audio va en «ambient» (v0.27.5): se mezcla con la música del atleta en vez de
// cortarla (con «playback», en v0.27.2–0.27.4, iPhone paraba Spotify al entrar a entrenar); a cambio, con el
// móvil en silencio no suena. «Pitido suave» es el de antes.
// (sonido, tanda 1) y «FBE»: el motivo de la familia sonora de la app, dos veces
export const SONIDOS_DESCANSO = [['fbe', 'FBE (el motivo)'], ['tres-beeps', 'Tres beeps'], ['estadio', 'Beep estadio'], ['boxeo', 'Campana de boxeo'], ['silbato', 'Silbato'], ['motivador', 'Tono motivador'], ['suave', 'Pitido suave']];
let audio = null;
const buffers = {}; // sonido → Promise<AudioBuffer>
// (pulido 2.10) Los sonidos (casi 100 kB) ya no van en lo que se carga al arrancar: se traen al entrar en una sesión
// (prepararAudio, en el primer toque), con tiempo de sobra antes del primer descanso, y el service worker los guarda
// con lo demás. Si no llegaran (sin conexión y sin guardar), suena el pitido suave, como con cualquier fallo.
let SONIDOS = null, trayendo = null;
const traerSonidos = () => {
  trayendo ||= import('../../datos/sonidos-descanso.js').then((m) => { SONIDOS = m.SONIDOS; return SONIDOS; }).catch((e) => { trayendo = null; throw e; });
  return trayendo;
};
const CON_ARCHIVO = new Set(['tres-beeps', 'estadio', 'boxeo', 'silbato', 'motivador']);   // («suave» es el pitido de siempre, sin archivo)
function cargar(k) {
  if (!audio || !CON_ARCHIVO.has(k)) return null;
  if (!buffers[k]) {
    buffers[k] = traerSonidos().then((S) => {
      if (!S?.[k]) throw new Error('sin sonido');
      const b64 = S[k].slice(S[k].indexOf(',') + 1);
      const bin = atob(b64), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      // (decodeAudioData con callbacks: Safari antiguo no devuelve promesa)
      return new Promise((ok, mal) => { const r = audio.decodeAudioData(bytes.buffer, ok, mal); r?.then?.(ok, mal); });
    });
    buffers[k].catch(() => { delete buffers[k]; });
  }
  return buffers[k];
}
// (top, tanda 3) el contexto de audio ya preparado (o null): para la música del juego, que suena por el mismo
export const contextoAudio = () => audio;
export function prepararAudio() {
  // (v0.62: no mientras suena la pista de «Avisar aunque bloquees el móvil», que va en «playback»: la cortaría)
  try { if (navigator.audioSession && !pistaActiva()) navigator.audioSession.type = 'ambient'; } catch { /* solo Safari */ }
  // (sonido, tanda 1) el mismo contexto para toda la app (la sesión, el chat, el juego): el de ui/sonido.js
  try { audio ||= contexto(); if (audio?.state === 'suspended') audio.resume(); } catch { audio = null; }
  cargar(leerAjustes().sonidoDescanso);
  // v0.48: el entrenador por voz se «despierta» en el mismo toque (iPhone)
  prepararVoz();
  // v0.62: los sonidos de la pista del descanso (solo con el ajuste encendido)
  prepararPista();
}
function pitidoSuave(volumen = 1) {
  if (!audio) return;
  [0, 0.28].forEach((t) => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880; o.type = 'sine';
    g.gain.setValueAtTime(0.0001, audio.currentTime + t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.01, 0.5 * volumen), audio.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + 0.22);
    o.connect(g).connect(salida(audio));
    o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.25);
  });
}
let sonando = null;
// sonido: el que hay que tocar (al elegirlo o «Probar»); sin él, el de los ajustes
export function pitar(sonido = null) {
  const a = leerAjustes();
  if (a.vibracion) try { navigator.vibrate?.([200, 100, 200, 100, 400]); } catch { /* */ }
  if (!a.sonido || !audio) return;
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  // (sonido, tanda 1) el aviso propio de FBE, de la familia sonora
  if ((sonido || a.sonidoDescanso) === 'fbe') { sonarFBE('fin-descanso', {}, { forzar: true }); return; }
  const volumen = Math.min(1, Math.max(0.1, Number(a.volumen) || 1)) * Math.max(0.05, volumenDe({ volumen: 1, volumenes: a.volumenes }, 'entreno'));
  const carga = cargar(sonido || a.sonidoDescanso);
  if (!carga) { pitidoSuave(volumen); return; }
  carga.then((buffer) => {
    try { sonando?.stop(); } catch { /* ya había acabado */ }
    const fuente = audio.createBufferSource(), g = audio.createGain();
    fuente.buffer = buffer; g.gain.value = volumen;
    fuente.connect(g).connect(salida(audio));
    ocupar(audio, 'fin-descanso', buffer.duration || 1);
    fuente.start();
    sonando = fuente;
  }).catch(() => pitidoSuave(volumen));
}

// Un tono corto (para el metrónomo de tempo): respeta el ajuste de sonido. (sonido, tanda 1) apartado: el volumen de cuál
// (el juego pasa 'juego')
export function tono(frecuencia = 880, duracion = 0.08, volumen = 0.18, apartado = 'entreno') {
  const a = leerAjustes();
  if (!audio || !a.sonido) return;
  volumen *= volumenDe({ volumen: 1, volumenes: a.volumenes }, apartado);
  if (volumen <= 0.0002) return;
  try {
    const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = frecuencia; o.type = 'sine';
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volumen, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    o.connect(g).connect(salida(audio));
    o.start(t); o.stop(t + duracion + 0.02);
  } catch { /* sin audio */ }
}
// (pulido 7) Al marcar una serie, un «tic» corto y suave que sube; al terminar la sesión, cuatro notas que suben. Con
// su interruptor (Ajustes → «Sonido al marcar una serie») y por el mismo canal que el aviso del descanso («ambient»:
// se mezcla con la música, no la corta). Sin audio preparado (prepararAudio, en un toque), no suena y no pasa nada.
const avisarSonido = (tipo) => { try { globalThis.dispatchEvent?.(new CustomEvent('fbe-sonido', { detail: { tipo } })); } catch { /* */ } };
// (sonido, tanda 1) con la familia sonora: la serie n de un ejercicio de `total` sube un escalón; la última resuelve
export function sonarSerie(datos = {}) {
  return sonarFBE('serie', datos);
}
// adorno: con racha o récord, unas notas de más arriba
export function sonarFinSesion(adorno = false) {
  return sonarFBE('fin-sesion', { adorno });
}
// (sonido, tanda 1) el cambio de ejercicio: su propio sonido (al acabar el descanso, tras el aviso)
export function sonarEjercicio() { return sonarFBE('ejercicio'); }
// La vibración del aviso, sola (v0.62: cuando el sonido ya lo pone la pista del descanso)
export function vibrarAviso() { if (leerAjustes().vibracion) try { navigator.vibrate?.([200, 100, 200, 100, 400]); } catch { /* */ } }
export function vibrarCorto(ms = 30) { if (leerAjustes().vibracion) try { navigator.vibrate?.(ms); } catch { /* */ } }

// Récord: vibración más larga (la de «vibración al tocar», v0.49) y (sonido, tanda 1) su fanfarria: una para los récords
// de peso (y de 1RM estimado) y otra para los de repeticiones; los logros, la suya (datos.sonido = 'logro', con su nivel)
export function celebrar(momento = 'record', datos = {}) {
  const a = leerAjustes();
  // (personalización 2) qué celebrar y cómo: con todo, solo vibración o nada
  const modo = modoCelebrar(a, momento);
  if (modo === 'nada') return;
  // (belleza 318) el toque y la fanfarria, con el primer fotograma del confeti y de la fila (no antes)
  vibrarAlPintar('record');
  if (modo === 'vibrar') return;
  // v0.52: y confeti (nunca con «reducir movimiento»; la vibración ya va aquí arriba)
  // (v0.200) en los récords, con discos de pesas entre el papel
  lanzarConfeti({ vibracion: null, discos: momento === 'record' });
  const clave = datos.sonido || (datos.tipo === 'reps' ? 'record-reps' : 'record-peso');
  alPintar(() => sonarFBE(clave, datos));
}

// Mantiene la pantalla encendida mientras la sesión está abierta
export function usePantallaEncendida() {
  useEffect(() => {
    if (!leerAjustes().pantalla) return undefined;
    let candado = null, vivo = true;
    const pedir = async () => {
      try { if (vivo && document.visibilityState === 'visible') candado = await navigator.wakeLock?.request('screen'); } catch { /* no disponible */ }
    };
    pedir();
    document.addEventListener('visibilitychange', pedir);
    return () => { vivo = false; document.removeEventListener('visibilitychange', pedir); try { candado?.release(); } catch { /* */ } };
  }, []);
}

export function useAhora(cadaMs = 1000) {
  const [t, setT] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setT(Date.now()), cadaMs); return () => clearInterval(i); }, [cadaMs]);
  return t;
}


export { problemaSerie } from '../../logica/calculos.js';

export function aNumero(t) {
  const s = String(t ?? '').replace(',', '.').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
