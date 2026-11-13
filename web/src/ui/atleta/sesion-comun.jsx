import { useEffect, useRef, useState } from 'preact/hooks';
import { leerAjustes, guardarAjustes } from '../ajustes.js';
import { faseRespira, retrasoRespira } from '../../logica/respira.js';
import { sinMovimiento } from '../transiciones.js';
import { Icono, useApp, DegradadoAro } from '../comunes.jsx';
import { propuestaSerie, sugerenciaProgresion, esBarra, mmss, esTopBackoff, propuestaBackoff, tieneDetalle, objetivoSerie } from '../../logica/calculos.js';
import { hablar, prepararVoz } from '../voz.js';
import { fraseCuenta } from '../../logica/voz.js';
import { vibrar } from '../hapticos.js';
import { contexto, sonarFBE } from '../sonido.js';
import { avisoDescanso, fraseQueda, volumenDe } from '../../logica/sonido.js';
import { LOBO_CAJA, LOBO_D } from '../lobo-trazo.js';
import { descansoEnCurso } from '../en-curso.js';
import { lanzarConfeti } from '../confeti.js';
import { pistaManda, pistaSono, pistaFinal, prepararPista, pistaActiva } from '../pista-descanso.js';
import { ajustarDescanso, reanudarDescanso, fraseTrasPista, avisoTrasCambio } from '../../logica/pista.js';
import { Placas } from '../Herramientas.jsx';
import { num } from '../../logica/calculos.js';
import { discosCon } from '../../logica/teclado.js';
import { Travesia } from './TravesiaTarjeta.jsx';
import { Apuntes } from './ApuntesTarjeta.jsx';
import { pesoNum, etiquetaPeso, vista, redondearCarga, enLibras } from '../../logica/unidades.js';
import { ajusteEnVivo, repsSiguiente } from '../../logica/ajuste-vivo.js';

// Piezas compartidas por la sesión (lista) y el modo enfoque

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
    o.connect(g).connect(audio.destination);
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
  if (!carga) { pitidoSuave(volumen); return; }
  carga.then((buffer) => {
    try { sonando?.stop(); } catch { /* ya había acabado */ }
    const fuente = audio.createBufferSource(), g = audio.createGain();
    fuente.buffer = buffer; g.gain.value = volumen;
    fuente.connect(g).connect(audio.destination);
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
    o.connect(g).connect(audio.destination);
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
// de peso (y de 1RM estimado) y otra para los de repeticiones. Sin tipo (los logros), la de peso
export function celebrar(tipo = null, datos = {}) {
  vibrar('record');
  // v0.52: y confeti (nunca con «reducir movimiento»; la vibración ya va aquí arriba)
  lanzarConfeti({ vibracion: null });
  sonarFBE(tipo === 'reps' ? 'record-reps' : tipo === 'logro' ? 'logro' : 'record-peso', datos);
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


// ---------- temporizador de descanso: un disco que se vacía ----------
// v0.39: con la app en segundo plano (Spotify o YouTube delante, la pantalla bloqueada), el iPhone la congela y no
// puede sonar. Por eso, al empezar el descanso (y con cada +15 / −15), se programa un aviso al móvil para cuando
// acabe (migración 025); si suena aquí, con la app delante, se anula, y también al saltarlo o cerrarlo. Si la app
// vuelve tarde (el aviso ya sonó en el móvil), no suena otra vez.
// v0.62: con «Avisar aunque bloquees el móvil», el pitido del final y la cuenta atrás los pone la pista del descanso (suena
// aunque la página esté congelada): aquí solo se vibra y, si la página sigue viva, la voz del móvil dice la serie siguiente
// (sin repetir lo que ya haya dicho la pista). Si su aviso ha sonado, se anula el aviso al móvil aunque la app no esté
// delante. Desde la pantalla de bloqueo se puede pausar el descanso (pausa: los ms que quedaban): aquí sale «en pausa» y
// «Seguir».
const conAvisoAlMovil = () => typeof Notification !== 'undefined' && Notification.permission === 'granted';
// v0.63: toca (logica/ahora-toca.js): con el descanso en marcha, la tarjeta «Ahora toca» con lo que viene; al tocarla,
// alToca(id, numero) lleva a esa serie (con el teclado en los kilos)
export function Temporizador({ fin, total, prioridad, texto, voz = null, aviso = null, tras = null, inicio = null, pausa = null, pausadoEn = null, cambia = false, alCambiar, clase = '', toca = null, alToca = null, discoMinimo = undefined, sesionId = null, ejercicio = null, empuje = null }) {
  const { api, atleta } = useApp() || {};
  const ahora = useAhora(250);
  const finRef = useRef(fin);
  finRef.current = fin;
  const pausado = Number.isFinite(pausa);
  const quedan = pausado ? Math.max(0, pausa / 1000) : Math.max(0, (fin - ahora) / 1000);
  const avisado = useRef(false);
  const programado = useRef(false);
  useEffect(() => {
    // (en pausa, fuera el aviso al móvil; al seguir, con su final nuevo, se vuelve a programar)
    if (pausado) { if (conAvisoAlMovil() && programado.current) { programado.current = false; api?.cancelarDescanso?.(); } return undefined; }
    if (!api?.programarDescanso || !conAvisoAlMovil()) return undefined;
    // (acabado a mano, p. ej. −15 con 10 s desde la pantalla de bloqueo: el aviso de antes llegaría tarde. Con la app delante
    // avisa ella y se anula; si no, que avise ya. La misma regla que para la píldora: avisoTrasCambio)
    if (fin <= Date.now()) {
      if (programado.current) {
        const r = avisoTrasCambio({ fin }, Date.now(), { visible: document.visibilityState === 'visible' });
        if (r.cancelar) { programado.current = false; api.cancelarDescanso?.(); } else api.programarDescanso(r.programar, aviso || texto);
      }
      return undefined;
    }
    // (un momento después: con varios +15 seguidos, solo el último). v0.62: con la carga propuesta, si se sabe
    const t = setTimeout(() => { programado.current = true; api.programarDescanso(fin, aviso || texto); }, 700);
    return () => clearTimeout(t);
    // (v0.64: también si cambia lo que viene después, p. ej. al dejar un ejercicio para luego en mitad del descanso)
  }, [fin, pausado, aviso || texto]);
  // Al quitarse el temporizador (saltar, cerrar), fuera el aviso. v0.52: si se sale de la sesión con el descanso en
  // marcha, lo sigue llevando la píldora «Sesión en curso» (y el aviso al móvil se queda)
  useEffect(() => () => { if (programado.current && !descansoEnCurso(atleta?.id, finRef.current)) api?.cancelarDescanso?.(); }, []);
  useEffect(() => {
    if (quedan <= 0 && !avisado.current) {
      avisado.current = true;
      const tarde = Date.now() - fin > 4000; // la app estaba congelada: ya avisó el móvil
      const manda = pistaManda(fin);
      if ((document.visibilityState === 'visible' || pistaSono(fin)) && programado.current) { programado.current = false; api?.cancelarDescanso?.(); }
      if (!tarde) {
        if (manda) vibrarAviso(); else pitar();
        // (sonido, tanda 1) y si toca otro ejercicio, su aviso propio, detrás
        if (cambia && !manda) setTimeout(() => sonarFBE('ejercicio'), 1100);
        // v0.48: con el entrenador por voz, lo que toca ahora («Serie 3 de press banca: 80 kilos por 6»); v0.62: si ha avisado
        // la pista, después de su aviso y sin repetir lo que haya dicho
        if (leerAjustes().voz) {
          const frase = manda ? fraseTrasPista(voz, pistaFinal(fin)) : (voz || '¡Vamos!');
          if (frase) setTimeout(() => hablar(frase), manda ? 1800 : leerAjustes().sonido ? 900 : 0);
        }
      }
    }
    if (quedan > 0) avisado.current = false;
  }, [quedan <= 0]);
  // Como FBE Timer: un pitido corto en cada uno de los 3 últimos segundos
  const segundo = Math.ceil(quedan);
  const contado = useRef(null);
  useEffect(() => {
    const a = leerAjustes();
    // (v0.62: la cuenta la lleva la pista del descanso, si suena; en pausa, nada)
    if (pausado || pistaManda(fin)) { contado.current = segundo; return; }
    // Con el entrenador por voz, la cuenta se dice (a los 10 y en los 3 últimos); si no, los pitidos de siempre
    if (a.voz && contado.current !== segundo && fraseCuenta(segundo) && (segundo === 10 ? total > 20 : true)) {
      hablar(fraseCuenta(segundo));
      if (segundo <= 3) vibrarCorto(80);
    } else if (segundo >= 1 && segundo <= 5 && contado.current !== segundo && a.cuentaAtras && (segundo <= 3 || total >= 20)) {
      // (sonido, tanda 1) la cuenta atrás que sube: los cinco últimos segundos, cada uno más agudo (en descansos cortos, tres)
      sonarFBE('cuenta', { segundo });
      if (segundo <= 3) vibrarCorto(80);
    } else if (contado.current !== segundo && contado.current != null) {
      // (sonido, tanda 1) los avisos de dentro del descanso: a la mitad y a falta de diez segundos (si no lo dice la voz)
      const av = avisoDescanso(segundo, total);
      if (av && !(av === 'diez' && a.voz)) sonarFBE(av);
    }
    contado.current = segundo;
  }, [segundo]);
  useEffect(() => {
    if (quedan > 0) return undefined;
    const t = setTimeout(() => alCambiar(null), 6000);
    return () => clearTimeout(t);
  }, [quedan <= 0]);
  // v0.50: el temporizador va en la página, debajo del ejercicio; si se queda fuera de la vista al desplazarse,
  // una píldora flotante con lo que queda (al tocarla, vuelve a él). Con IntersectionObserver, sin escuchar el scroll.
  // En el modo enfoque, que es una pantalla aparte, no hace falta.
  const caja = useRef(null);
  const [fuera, setFuera] = useState(false);
  const conPildora = !clase.includes('en-enfoque');
  useEffect(() => {
    const el = caja.current?.querySelector('.reloj-descanso');
    if (!conPildora || !el || typeof IntersectionObserver === 'undefined') return undefined;
    // (la cabecera de la sesión va pegada arriba: lo que queda debajo de ella no se ve)
    // (en iOS el aviso puede llegar con el anillo aún medio fuera: cuenta como fuera si se ve menos de una cuarta parte)
    const io = new IntersectionObserver(([e]) => setFuera(!e.isIntersecting || e.intersectionRatio < 0.25), { rootMargin: '-64px 0px -8px 0px', threshold: [0, 0.25, 0.5] });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const volver = () => {
    const quieto = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    caja.current?.scrollIntoView({ block: 'center', behavior: quieto ? 'auto' : 'smooth' });
    setTimeout(() => caja.current?.querySelector('.saltar')?.focus({ preventScroll: true }), quieto ? 0 : 350);
  };
  // v0.52: «Respira» (se recuerda en el móvil): un círculo que crece al inspirar (4 s) y encoge al soltar (6 s), contado
  // desde que empezó el descanso; el texto «Inspira» / «Suelta» no se anuncia (la cuenta sigue mandando). Con «reducir
  // movimiento», solo el texto.
  const [respira, setRespira] = useState(() => leerAjustes().respira === true);
  // (revisión: el ciclo cuenta desde el inicio de cada descanso, que viaja con él y no cambia con ±15 s ni ±1 min; el
  // temporizador de un mismo ejercicio se reutiliza de una serie a otra, así que no vale lo del primer pintado)
  // (sin él, de un descanso de antes de esta versión, el que sale de su final y su duración)
  const inicioR = inicio || fin - total * 1000;
  const cambiarRespira = () => { const v = !respira; setRespira(v); guardarAjustes({ ...leerAjustes(), respira: v }); };
  // «La travesía»: el juego del descanso, a pantalla completa (su trozo se pide al abrirlo). Si estaba jugando cuando acabó
  // el descanso anterior, se abre solo en este; si lo cerró a mano, ya no (hasta que vuelva a darle a «Jugar»). En
  // descansos muy cortos no se abre solo: no da tiempo a nada.
  const [juego, setJuego] = useState(false);
  // «Apuntes»: algo que aprender en el descanso (del ejercicio del que se descansa y de las guías). Como el juego: si
  // estaba leyendo al acabar el descanso anterior, se abre solo en este. O el juego o los apuntes, no los dos.
  const [apunte, setApunte] = useState(false);
  useEffect(() => {
    if (pausado || (fin - Date.now()) / 1000 <= 20) return;
    const a = leerAjustes();
    if (a.juegoDescanso) setJuego(true); else if (a.apunteDescanso) setApunte(true);
  }, [inicioR]);
  const jugar = () => { setApunte(false); setJuego(true); guardarAjustes({ ...leerAjustes(), juegoDescanso: true, apunteDescanso: false }); };
  const cerrarJuego = (motivo) => { setJuego(false); if (motivo === 'salir') guardarAjustes({ ...leerAjustes(), juegoDescanso: false }); };
  const aprender = () => { setJuego(false); setApunte(true); guardarAjustes({ ...leerAjustes(), apunteDescanso: true, juegoDescanso: false }); };
  const cerrarApunte = (motivo) => { setApunte(false); if (motivo === 'salir') guardarAjustes({ ...leerAjustes(), apunteDescanso: false }); };
  const fase = respira && quedan > 0 && !pausado ? faseRespira((ahora - inicioR) / 1000) : null;
  const quietoRespira = sinMovimiento();
  // (sonido, tanda 1) con «Respira», un soplo que sube al inspirar y baja al soltar (lo que quede de esa fase)
  const faseClave = fase ? `${fase.ciclo}-${fase.fase}` : null;
  useEffect(() => {
    if (!fase || pistaManda(fin)) return;
    sonarFBE(fase.fase === 'inspira' ? 'respira-dentro' : 'respira-fuera', { dura: (1 - fase.avance) * (fase.fase === 'inspira' ? 4 : 6) });
  }, [faseClave]);
  // (sonido, tanda 1) «¿Cuánto queda?»: dos toques seguidos en el reloj lo dicen en voz alta (aunque la voz esté apagada)
  const ultimoToque = useRef(0);
  const tocarReloj = (ev) => {
    if (ev.target.closest?.('button') || !(quedan > 0)) return;
    const t = Date.now();
    if (t - ultimoToque.current < 380) { ultimoToque.current = 0; hablar(fraseQueda(quedan), { forzar: true }); vibrar('elegir'); }
    else ultimoToque.current = t;
  };
  // (el retraso de la animación se fija cuando aparece el círculo, con lo que lleva el descanso en ese momento: cambiarlo
  // después la haría saltar; y un círculo nuevo, por cada descanso)
  const ponerRetraso = (el) => { if (el && !el.dataset.retraso) { el.dataset.retraso = '1'; el.style.animationDelay = `${retrasoRespira((Date.now() - inicioR) / 1000)}s`; } };
  const R = 88, C = 2 * Math.PI * R;
  const frac = total ? Math.min(1, quedan / total) : 0;
  const este = () => ({ fin, total, prioridad, texto, voz, aviso, tras, inicio: inicioR, empuje, cambia, ...(pausado ? { pausa, pausadoEn } : {}) });
  const ajustar = (s) => {
    alCambiar(ajustarDescanso(este(), s));
    sonarFBE(s > 0 ? 'mas-15' : 'menos-15');   // (sonido, tanda 1) sube o baja
    // (diseño, tanda 49) la cuenta da un golpe hacia arriba (más tiempo) o hacia abajo (menos)
    if (!sinMovimiento()) { try { caja.current?.querySelector('.cuenta')?.animate?.([{ transform: `translateY(${s > 0 ? -9 : 9}px) scale(1.1)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.2, 1.3, .35, 1)' }); } catch { /* */ } }
  };
  // (diseño, tanda 22) Deslizar el dedo de lado sobre el reloj suma tiempo (a la derecha) o lo quita (a la izquierda):
  // 15 s cada 28 px, con un toque en cada salto. De arriba abajo la página sigue desplazándose como siempre. Lo que se
  // va ajustando se encadena aquí mismo (entre dos pintados, este() aún no lo sabe). «−15 s» y «+15 s» siguen ahí.
  const dial = useRef(null);
  const gestoDial = quedan > 0 ? {
    onPointerDown: (e) => {
      if (e.button > 0 || e.target.closest?.('button')) return;
      dial.current = { id: e.pointerId, x: e.clientX, y: e.clientY, pasos: 0, activo: false, ultimo: este() };
    },
    onPointerMove: (e) => {
      const g = dial.current;
      if (!g || g.id !== e.pointerId) return;
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (!g.activo) {
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        g.activo = true;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
        e.currentTarget.classList.add('girando');
      }
      const pasos = Math.trunc(dx / 28);
      if (pasos === g.pasos) return;
      const s = (pasos - g.pasos) * 15;
      g.pasos = pasos;
      g.ultimo = ajustarDescanso(g.ultimo, s);
      alCambiar(g.ultimo);
      vibrar('elegir');
      sonarFBE(s > 0 ? 'mas-15' : 'menos-15');
    },
    onPointerUp: (e) => { dial.current = null; e.currentTarget.classList.remove('girando'); },
    onPointerCancel: (e) => { dial.current = null; e.currentTarget.classList.remove('girando'); },
  } : {};
  const conPista = quedan > 0 && pistaManda(fin);
  const color = COLOR_DISCO[prioridad] || 'var(--morado)';
  const r2 = 9, c2 = 2 * Math.PI * r2;
  return (
    <>
    <div ref={caja} class={`temporizador ${clase} ${quedan <= 0 ? 'fin' : ''} ${quedan > 0 && segundo <= 3 && !pausado ? 'ultimos' : ''}`} role="timer" aria-live="off" aria-label="Descanso" style={{ '--c-disco': color }}>
      <div class="temporizador-cab">
        <span class="temporizador-etq">{quedan > 0 ? (pausado ? 'Descanso en pausa' : 'Descanso') : 'Descanso terminado'}</span>
        {!(quedan > 0 && toca) && <span class="que">{quedan > 0 ? `Después: ${texto}` : `Ahora: ${texto}`}</span>}
      </div>
      <div class={`reloj-descanso ${fase ? 'respirando' : ''} ${quedan > 0 ? 'con-dial' : ''}`} {...gestoDial} onClick={tocarReloj}>
        {fase && !quietoRespira && <span key={inicioR} ref={ponerRetraso} class="respira-circulo" aria-hidden="true" />}
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <DegradadoAro id="aro-descanso" gira />
          <circle class="carril" cx="100" cy="100" r={R} />
          <circle class="arco" style={{ stroke: 'url(#aro-descanso)' }} cx="100" cy="100" r={R} stroke-dasharray={C} stroke-dashoffset={C * (1 - frac)} transform="rotate(-90 100 100)" />
          {/* (diseño, tanda 44) la punta del arco, con luz, mientras corre; una onda en cada uno de los tres últimos segundos;
              y, al terminar, el aro se cierra de un trazo, salen los rayos y dos ondas (el lobo llama) */}
          {quedan > 0 && frac > 0 && frac < 1 && <g class="arco-punta" style={{ transform: `rotate(${360 * frac}deg)` }}><circle cx="100" cy={100 - R} r="5" /></g>}
          {quedan > 0 && segundo <= 3 && !pausado && <circle key={segundo} class="onda-segundo" cx="100" cy="100" r={R} />}
          {quedan <= 0 && (
            <g class="descanso-cierre">
              <circle class="cierre-arco" style={{ stroke: 'url(#aro-descanso)' }} cx="100" cy="100" r={R} pathLength="1" transform="rotate(-90 100 100)" />
              <circle class="cierre-luna" cx="100" cy="100" r={R - 8} />
              {[0, 1].map((i) => <circle key={i} class="cierre-onda" cx="100" cy="100" r={R} style={{ '--i': i }} />)}
              <g class="cierre-rayos">{Array.from({ length: 12 }, (_, i) => <line key={i} x1="100" y1="-2" x2="100" y2="-13" transform={`rotate(${i * 30} 100 100)`} />)}</g>
            </g>
          )}
        </svg>
        <div class="reloj-centro">
          {quedan <= 0 && <svg class="vamos-lobo" viewBox={LOBO_CAJA} aria-hidden="true"><path fill-rule="evenodd" d={LOBO_D} /></svg>}
          <div class="cuenta num" role="timer" aria-label={quedan > 0 ? `Descanso${pausado ? ' en pausa' : ''}: quedan ${Math.ceil(quedan)} segundos` : 'Descanso terminado'}>{quedan > 0 ? mmss(quedan) : '¡Vamos!'}</div>
          {quedan > 0 && total > 0 && !fase && <div class="de num">de {mmss(total)}</div>}
          {fase && <div class={`respira-texto ${fase.fase}`} aria-hidden="true">{fase.texto}</div>}
        </div>
      </div>
      {quedan > 0 && toca && <AhoraToca ahora={toca} alTocar={alToca} discoMinimo={discoMinimo} />}
      {conPista && <p class="pista-activa peq"><Icono n="candado" />{pausado ? 'En pausa desde la pantalla de bloqueo' : 'Te avisa aunque bloquees el móvil'}</p>}
      {quedan > 0 && !pausado && (
        <div class="descanso-extras">
          <button type="button" class="respira-boton" aria-pressed={respira ? 'true' : 'false'} onClick={cambiarRespira} title="Un círculo para acompasar la respiración mientras descansas">
            <Icono n="sueno" />Respira
          </button>
          {atleta?.id && (
            <button type="button" class="respira-boton jugar-boton" onClick={jugar} title="La travesía: un juego para el descanso. Se cierra solo cuando toca la siguiente serie">
              <Icono n="play" />Jugar
            </button>
          )}
          {atleta?.id && (
            <button type="button" class="respira-boton aprender-boton" onClick={aprender} title="Apuntes: algo que aprender mientras descansas. Se cierra solo cuando toca la siguiente serie">
              <Icono n="biblioteca" />Aprender
            </button>
          )}
        </div>
      )}
      {/* v0.42: también ±1 minuto, para alargar el descanso por un imprevisto o acortarlo si hay prisa */}
      <div class="ajustes">
        <button onClick={() => ajustar(-60)} aria-label="Quitar 1 minuto">−1 min</button>
        <button onClick={() => ajustar(-15)} aria-label="Quitar 15 segundos">−15 s</button>
        <button onClick={() => ajustar(15)} aria-label="Añadir 15 segundos">+15 s</button>
        <button onClick={() => ajustar(60)} aria-label="Añadir 1 minuto">+1 min</button>
      </div>
      {pausado && <button type="button" class="btn btn-primario seguir-descanso" onClick={() => { sonarFBE('sigue'); alCambiar(reanudarDescanso(este())); }}><Icono n="play" /> Seguir</button>}
      <button class="saltar" onClick={() => alCambiar(null)}>{quedan > 0 ? 'Saltar' : 'Cerrar'}</button>
    </div>
      {apunte && atleta?.id && <Apuntes atletaId={atleta.id} ejercicio={ejercicio} fin={fin} pausa={pausado ? pausa : null} alCerrar={cerrarApunte} />}
      {juego && atleta?.id && <Travesia atletaId={atleta.id} sesion={sesionId} fin={fin} pausa={pausado ? pausa : null} total={total} despues={texto} empuje={empuje} alCerrar={cerrarJuego} />}
      {/* (fuera de la tarjeta: con su latido al sonar, una «fixed» dentro se movería con ella) */}
      {conPildora && fuera && (
        <button type="button" class={`pildora-descanso ${quedan <= 0 ? 'fin' : ''}`} onClick={volver} aria-live="off"
          aria-label={quedan > 0 ? 'Descanso en curso, toca para volver' : 'Descanso terminado, toca para volver'}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle class="carril" cx="12" cy="12" r={r2} />
            <circle class="arco" cx="12" cy="12" r={r2} stroke-dasharray={c2} stroke-dashoffset={c2 * (1 - frac)} transform="rotate(-90 12 12)" />
          </svg>
          <span class="num">{quedan > 0 ? mmss(quedan) : '¡Vamos!'}</span>
          <Icono n="arriba" />
        </button>
      )}
    </>
  );
}

// v0.63 (8): «Ahora toca», en el descanso: lo que viene, para leerlo de lejos (cifras grandes y mucho contraste). Es un
// botón: lleva a esa serie y abre el teclado en los kilos
export function AhoraToca({ ahora, alTocar, discoMinimo = undefined }) {
  const a = ahora;
  return (
    <button type="button" class={`ahora-toca ${a.otroEjercicio ? 'otro' : ''}`} onClick={() => alTocar?.(a.id, a.numero)} aria-label={`Ahora toca: ${a.texto}. Toca para ir a esa serie`}>
      <span class="ahora-cab"><span class="ahora-etq">{a.otroEjercicio ? 'Siguiente ejercicio' : 'Ahora toca'}</span><span class="ahora-serie">{a.serie}</span></span>
      <span class="ahora-nombre">{a.etiqueta && <span class="ss-etq">{a.etiqueta}</span>}{a.nombre}</span>
      {a.kg != null ? (
        <span class="ahora-carga num">{pesoNum(a.kg, 2)}<small> {etiquetaPeso()}</small>{a.reps != null && <><span class="ahora-por"> × </span>{a.reps}</>}</span>
      ) : a.reps != null && <span class="ahora-carga num">{a.reps}<small> reps</small></span>}
      {(a.esfuerzo || a.anterior) && (
        <span class="ahora-meta">
          {a.esfuerzo && <span class="ahora-esfuerzo">{a.esfuerzo}</span>}
          {a.anterior && <span><small>ant.</small> <span class="num">{a.anterior}</span></span>}
        </span>
      )}
      {a.discos && <span class="ahora-discos"><Placas kg={vista(a.kg)} discos={discosCon(discoMinimo)} /></span>}
      {a.nota && <span class="ahora-nota"><Icono n={a.notaRecuerda ? 'chincheta' : 'mensaje'} /><span>{a.notaRecuerda ? 'Recuerda: ' : ''}{a.nota}</span></span>}
    </button>
  );
}

// Lo que hace falta para proponer cada serie de un ejercicio (con o sin alternativa)
export function prepararEjercicio(e, actual, ultimas, foco, progresionAuto) {
  const ej = actual || e.ejercicio;
  // Con una alternativa no vale la carga pautada para el original: se parte de lo que hizo con la alternativa
  // (y, pautado serie a serie, sin los kilos de cada serie: eran para el original)
  const prescripcion = actual ? { ...e, carga_sugerida_kg: null, series_detalle: e.series_detalle ? e.series_detalle.map(({ kg, ...resto }) => resto) : e.series_detalle } : e;
  // Pautado serie a serie: cada serie trae lo suyo del coach (sin sugerencia de la app, que es para series iguales)
  const detalle = tieneDetalle(prescripcion);
  const sugerencia = progresionAuto && !detalle ? sugerenciaProgresion(prescripcion, ultimas?.series, { nombre: ej.nombre, foco, pautaAnterior: ultimas?.pauta }) : null;
  const barra = esBarra(ej.nombre);
  const top = esTopBackoff(prescripcion);
  const deLaTop = propuestaSerie(prescripcion, ultimas?.series, 1, { sugerencia, pautaAnterior: ultimas?.pauta });
  // v0.112: con las libras puestas, lo que propone la app (no lo que ya hizo hoy) se redondea a lo que se carga en libras
  // (80 kg → 175 lb); en kilos, igual
  const propuesta = (k, hechas = {}) => {
    const p = propuestaKg(k, hechas);
    if (!enLibras()) return p;
    return p && p.kg != null && !(hechas[k - 1] && Number(hechas[k - 1].kg) === Number(p.kg)) ? { ...p, kg: redondearCarga(Number(p.kg)) } : p;
  };
  const propuestaKg = (k, hechas = {}) => {
    // Top + back-off: la back-off sale de lo que hizo de verdad en la top (o de lo propuesto, si aún no la ha hecho)
    const bo = top ? propuestaBackoff(prescripcion, k, hechas, deLaTop, ej.nombre) : null;
    if (bo) return bo;
    const previa = hechas[k - 1];
    const o = objetivoSerie(prescripcion, k);
    if (o) {
      // Lo de esa serie; lo que el coach no puso, como siempre (la anterior de hoy o su última vez)
      const base = previa ? { kg: previa.kg, reps: previa.reps } : propuestaSerie(prescripcion, ultimas?.series, k, { pautaAnterior: ultimas?.pauta });
      // (ajuste en vivo) sin kilos del coach en esa serie, con su RPE objetivo: según cómo fue la anterior
      const aj = previa && o.kg == null ? ajusteEnVivo({ previa, objetivo: { rpe: o.rpe ?? prescripcion.rpe_objetivo, rir: prescripcion.rir_objetivo }, reps: o.reps ?? previa.reps, nombre: ej.nombre, subir: !!progresionAuto }) : null;
      return { kg: aj ? aj.kg : o.kg ?? base.kg, reps: o.reps ?? base.reps, rpe: o.rpe ?? null, objetivo: o, ...(aj ? { ajuste: aj } : {}) };
    }
    if (previa) {
      // (ajuste en vivo) a RPE o RIR y sin carga pautada: si la anterior se fue del esfuerzo, la carga se corrige
      const reps = repsSiguiente(previa.reps, prescripcion);
      const aj = ajusteEnVivo({ previa, objetivo: { rpe: prescripcion.rpe_objetivo, rir: prescripcion.rir_objetivo }, reps, nombre: ej.nombre, kgFijado: prescripcion.carga_sugerida_kg != null, subir: !!progresionAuto });
      return aj ? { kg: aj.kg, reps: aj.reps, ajuste: aj } : { kg: previa.kg, reps: previa.reps };
    }
    return propuestaSerie(prescripcion, ultimas?.series, k, { sugerencia, pautaAnterior: ultimas?.pauta });
  };
  return {
    ej, prescripcion, sugerencia, barra, top, detalle,
    conAproximacion: barra || (ej.tipo || []).includes('basico'),
    // Para la aproximación: la serie más pesada que le toca
    kgTrabajo: detalle && prescripcion.series_detalle.some((x) => x.kg != null) ? Math.max(...prescripcion.series_detalle.map((x) => x.kg ?? 0)) : deLaTop.kg,
    propuesta,
  };
}

// Nota fijada del atleta para un ejercicio («sillín en el 4»): se ve cada vez que lo hace.
// editando / alEditar los lleva quien la usa (para abrirla desde un botón «Nota»).
export function NotaFijada({ nota, alGuardar, editando, alEditar }) {
  const [texto, setTexto] = useState(nota?.texto || '');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { if (!editando) setTexto(nota?.texto || ''); }, [nota?.texto, editando]);
  if (!editando) {
    return nota ? (
      <button type="button" class="nota-fijada" onClick={() => alEditar(true)} aria-label={`Tu nota: ${nota.texto}. Tocar para cambiarla`}>
        <Icono n="chincheta" /><span>{nota.texto}</span>
      </button>
    ) : null;
  }
  const guardar = async (t) => {
    setOcupado(true);
    try { await alGuardar(t); alEditar(false); } catch { /* el aviso lo da quien guarda */ } finally { setOcupado(false); }
  };
  return (
    <div class="nota-fijada-editar">
      <textarea class="area" rows="2" maxLength={500} value={texto} autoFocus aria-label="Tu nota para este ejercicio"
        placeholder="Ajustes de la máquina, agarre, lo que quieras recordar cada vez" onInput={(e) => setTexto(e.currentTarget.value)} />
      <div class="fila-envolver">
        <button type="button" class="btn btn-peq btn-primario" disabled={ocupado} onClick={() => guardar(texto)}>Guardar nota</button>
        <button type="button" class="btn btn-peq" onClick={() => alEditar(false)}>Cancelar</button>
        {nota && <button type="button" class="btn btn-peq btn-peligro" disabled={ocupado} onClick={() => guardar('')}>Quitar</button>}
      </div>
    </div>
  );
}
