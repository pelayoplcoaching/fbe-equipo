// v0.62: «Avisar aunque bloquees el móvil» (Ajustes de este móvil → Sonido y vibración, apagado de entrada). Al empezar el
// descanso, en el mismo toque que marca la serie, un <audio> empieza una pista hecha para ese descanso (logica/pista.js):
// silencio, la cuenta atrás y el aviso justo al final. La reproduce el sistema aunque la pantalla se bloquee y el iPhone
// congele la página: no hace falta que se ejecute nada al acabar. Con +15 / −15 o «Saltar» (en la app o en la pantalla de
// bloqueo) se rehace o se para; al acabar, saltar o cerrar la sesión, se suelta todo.
//   · iPhone: la sesión de audio pasa a «playback» mientras dura el descanso (la única con la que una web suena con el móvil
//     bloqueado) y vuelve a «ambient» al acabar. A cambio, iOS pausa la música de otras apps durante el descanso (no deja a una
//     web mezclarse con ella en segundo plano): por eso es opcional y lo dice el ajuste.
//   · Android: un <audio> de más de 5 s se queda el foco de audio: también pausa la música. Es la parte secundaria.
//   · La pantalla de bloqueo (Media Session): «Descanso · 1:23», «FBE Equipo», lo que toca después y la barra de progreso;
//     play/pausa pausa el descanso, ⏩ / ⏪ suman o quitan 15 s y ⏭ lo salta.
// Si la pista suena, se anula el aviso al móvil (ya ha avisado); si el sistema la corta (una llamada, otra app con música), el
// aviso al móvil sigue programado y la página, si está viva, suena como siempre.
import { leerAjustes } from './ajustes.js';
import { cambiarDescansoEnCurso } from './en-curso.js';
import {
  planPista, trozosPista, avisoSonando, avisoTrasCambio, enPausa, restanteMs, ajustarDescanso, pausarDescanso, reanudarDescanso,
  tituloMedia, albumMedia, posicionMedia, esUltima, plataformaPista, conFrases, FORMATO_PISTA,
} from '../logica/pista.js';

export const EVENTO_PISTA = 'fbe-descanso-pista';

export function plataformaPistaAqui() {
  try {
    const n = navigator;
    return plataformaPista({
      ua: n.userAgent || '', plataforma: n.platform || '', toques: n.maxTouchPoints || 0,
      audioSession: !!n.audioSession, mediaSession: 'mediaSession' in n,
      audio: typeof Audio === 'function' && typeof Blob === 'function' && typeof URL?.createObjectURL === 'function',
    });
  } catch { return null; }
}
export const pistaDisponible = () => !!plataformaPistaAqui();
export const pistaEncendida = () => { const a = leerAjustes(); return !!a.vozBloqueo && a.sonido !== false && pistaDisponible(); };

// Los sonidos (unos 50 KB) solo se cargan si el ajuste está encendido, al abrir la sesión
let sonidos = null, cargando = null;
const b64 = (s) => { const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; };
export function prepararPista() {
  if (sonidos) return Promise.resolve(sonidos);
  if (cargando || !pistaEncendida()) return cargando;
  cargando = import('../datos/pista-descanso.js').then((m) => {
    const dec = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, b64(v)]));
    sonidos = { clips: dec(m.CLIPS), voces: dec(m.VOCES) };
    return sonidos;
  }).catch(() => { cargando = null; return null; });
  return cargando;
}
const largos = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, v.length / FORMATO_PISTA.bytes]));
export const frasesDelCoach = () => !!sonidos && conFrases(largos(sonidos.voces));

let el = null;        // el <audio> (uno para siempre: en iPhone, una vez arrancado con un toque, puede volver a sonar sin otro)
let actual = null;    // { d, ctx, plan, url, sonado, nuestra, interrumpida, prueba, corregido }
let ultimo = null;    // el último que acabó: { fin, sonado, final }
let reloj = null, programar = null;

function ponerSesionAudio(tipo) {
  if (plataformaPistaAqui() !== 'ios') return;
  try { navigator.audioSession.type = tipo; } catch { /* */ }
}
function crear() {
  const a = document.createElement('audio');
  a.id = 'fbe-pista';
  a.preload = 'auto';
  a.hidden = true;
  a.setAttribute('playsinline', '');
  a.setAttribute('aria-hidden', 'true');
  a.addEventListener('timeupdate', () => {
    if (!actual || actual.sonado || a.paused || !avisoSonando(a.currentTime, actual.plan)) return;
    actual.sonado = true;
    if (!actual.prueba) actual.ctx?.avisos?.cancelar?.();
    try { window.dispatchEvent(new CustomEvent('fbe-pista-sono', { detail: actual.d.fin })); } catch { /* */ }
  });
  a.addEventListener('playing', () => {
    if (!actual) return;
    // (si el sistema la había cortado, el descanso ya es de la página, que avisa ella: si iOS la vuelve a poner, se para, para
    // no avisar dos veces)
    if (actual.interrumpida) { actual.nuestra = true; try { a.pause(); } catch { /* */ } return; }
    // (si arrancó tarde, se adelanta para que el aviso caiga justo al final del descanso, como el disco)
    const objetivo = actual.plan.cueMs / 1000 - (actual.d.fin - Date.now()) / 1000;
    if (!actual.corregido && objetivo - a.currentTime > 0.25 && objetivo < actual.plan.cueMs / 1000 - 1) {
      actual.corregido = true;
      try { a.currentTime = objetivo; } catch { /* */ }
    }
  });
  a.addEventListener('pause', () => {
    if (!actual) return;
    if (actual.nuestra) { actual.nuestra = false; return; }
    // La ha parado el sistema (una llamada, Siri, otra app que suena): ya no avisa ella; el aviso al móvil sigue.
    // (no si ya vuelve a sonar: al cambiar de pista, la anterior avisa de su pausa cuando la nueva ya ha arrancado)
    if (a.paused && !a.ended) interrumpir();
  });
  a.addEventListener('error', () => { if (actual && a.getAttribute('src')) interrumpir(); });
  a.addEventListener('ended', () => liberar());
  document.body.appendChild(a);
  return a;
}

// Cortada por el sistema: el descanso pasa a la página (y al aviso al móvil). Se suelta lo del sistema (vuelve «ambient», fuera
// la pantalla de bloqueo y el reloj) para que el pitido de la página no vuelva a parar la música; se queda `actual` para saber
// de qué descanso era (pistaManda y pistaFinal) hasta que se cambie o se acabe.
function interrumpir() {
  if (!actual || actual.interrumpida) return;
  actual.interrumpida = true;
  soltarSistema();
}
function soltarSistema() {
  clearInterval(reloj); reloj = null;
  document.removeEventListener('visibilitychange', alVerse);
  limpiarMedia();
  ponerSesionAudio('ambient');
}

// ---------- la pantalla de bloqueo ----------
const ms = () => (typeof navigator !== 'undefined' && navigator.mediaSession) || null;
function tituloAhora() {
  if (!actual) return '';
  const d = actual.d;
  return tituloMedia({ restanteS: restanteMs(d) / 1000, pausa: enPausa(d), prueba: actual.prueba, oculta: document.visibilityState === 'hidden' });
}
function ponerPosicion() {
  const m = ms();
  if (!m || !actual || typeof m.setPositionState !== 'function') return;
  try { m.setPositionState(posicionMedia({ total: actual.d.total, restanteS: restanteMs(actual.d) / 1000 })); } catch { /* */ }
}
function ponerMedia() {
  const m = ms();
  if (!m || !actual) return;
  try {
    if (typeof MediaMetadata === 'function') {
      const base = document.baseURI;
      m.metadata = new MediaMetadata({
        title: tituloAhora(), artist: 'FBE Equipo', album: actual.prueba ? 'Bloquea el móvil: suena al acabar' : albumMedia(actual.d.aviso || actual.d.texto),
        artwork: [{ src: new URL('icono-192.png', base).href, sizes: '192x192', type: 'image/png' }, { src: new URL('icono-512.png', base).href, sizes: '512x512', type: 'image/png' }],
      });
    }
    m.playbackState = enPausa(actual.d) ? 'paused' : 'playing';
  } catch { /* */ }
  ponerPosicion();
  const acciones = { play: () => remoto('reanudar'), pause: () => remoto('pausar'), seekforward: () => remoto(15), seekbackward: () => remoto(-15), nexttrack: () => remoto('saltar'), stop: () => remoto('saltar') };
  for (const [k, f] of Object.entries(acciones)) { try { m.setActionHandler(k, f); } catch { /* esa acción no la hay aquí */ } }
}
// El título, como mucho una vez por segundo y solo si cambia
function tic() {
  const m = ms();
  if (!m?.metadata || !actual) return;
  const t = tituloAhora();
  if (m.metadata.title !== t) try { m.metadata.title = t; } catch { /* */ }
}
function limpiarMedia() {
  const m = ms();
  if (!m) return;
  try { m.metadata = null; m.playbackState = 'none'; } catch { /* */ }
  try { m.setPositionState?.(); } catch { /* */ }
  for (const k of ['play', 'pause', 'seekforward', 'seekbackward', 'nexttrack', 'stop']) { try { m.setActionHandler(k, null); } catch { /* */ } }
}
const alVerse = () => { tic(); ponerPosicion(); };

// ---------- lo que piden los botones de la pantalla de bloqueo ----------
function remoto(accion) {
  if (!actual) return;
  if (actual.prueba) { if (accion === 'saltar' || accion === 'pausar') liberar(); return; }
  const d = actual.d, ahora = Date.now();
  const n = accion === 'saltar' ? null : accion === 'pausar' ? pausarDescanso(d, ahora) : accion === 'reanudar' ? reanudarDescanso(d, ahora) : ajustarDescanso(d, accion, ahora);
  if (n === d) return;
  aplicar(n);
}
// Si la sesión está abierta, ella lo aplica (su temporizador, la píldora y el aviso al móvil); si no (la lleva la píldora), aquí
// El aviso al móvil se decide después de rehacer la pista (si no arranca o no cabe, el aviso sigue siendo la red de seguridad)
function aplicar(n) {
  const ctx = actual?.ctx || {};
  let atendido = false;
  try { atendido = !window.dispatchEvent(new CustomEvent(EVENTO_PISTA, { detail: n, cancelable: true })); } catch { /* */ }
  if (atendido) return;
  if (ctx.atletaId && ctx.sesionId) cambiarDescansoEnCurso(ctx.atletaId, ctx.sesionId, n);
  clearTimeout(programar);
  sincronizarPista(n, ctx);
  const r = avisoTrasCambio(n, Date.now(), { visible: document.visibilityState === 'visible' });
  if (r.cancelar) ctx.avisos?.cancelar?.();
  else programar = setTimeout(() => ctx.avisos?.programar?.(r.programar, n.aviso || n.texto), 700);
}

// ---------- empezar, rehacer, pausar y parar ----------
function empezar(d, ctx, prueba = false) {
  const a = leerAjustes();
  const s = sonidos;
  const plan = planPista({
    restanteMs: d.fin - Date.now(), cuentaAtras: a.cuentaAtras !== false, sonido: a.sonidoDescanso, voz: !!a.voz, ultima: esUltima(d.voz),
    clips: largos(s.clips), voces: largos(s.voces),
  });
  if (!plan) { liberar(); return false; }
  const url = URL.createObjectURL(new Blob(trozosPista(plan, { ...s.clips, ...s.voces }), { type: 'audio/mpeg' }));
  el ||= crear();
  const previa = actual?.url;
  actual = { d, ctx, plan, url, sonado: false, nuestra: false, interrumpida: false, prueba, corregido: false };
  ponerSesionAudio('playback');
  try { el.volume = Math.min(1, Math.max(0.1, Number(a.volumen) || 1)); } catch { /* en iPhone no se puede */ }
  // (la dirección nueva justo antes de play(): en iOS 26.0–26.1, una app de inicio que vuelve a abrirse no suena sin esto)
  el.src = url;
  Object.assign(el.dataset, { fin: String(d.fin), cue: String(plan.cueMs), duracion: String(plan.duracionMs), final: plan.final.join(',') });
  const yo = actual;
  try {
    const pr = el.play();
    pr?.catch?.(() => { if (actual === yo) { yo.interrumpida = true; liberar(); } });
  } catch { yo.interrumpida = true; }
  if (previa) URL.revokeObjectURL(previa);
  ponerMedia();
  clearInterval(reloj);
  reloj = setInterval(tic, 1000);
  document.addEventListener('visibilitychange', alVerse);
  return true;
}

// d: el descanso tal y como queda (null: se ha quitado). ctx: { atletaId, sesionId, avisos: { programar, cancelar } }.
// Hay que llamarla dentro del toque (marcar la serie, ±15, «Saltar»): en el iPhone, play() solo vale ahí la primera vez.
export function sincronizarPista(d, ctx = {}) {
  if (!d) { pararPista({ dejarAcabar: true }); return false; }
  if (!pistaEncendida() || !sonidos) { if (actual) liberar(); return false; }
  if (enPausa(d)) {
    if (!actual) return false;
    actual.d = d;
    actual.ctx = ctx;
    if (!el.paused) { actual.nuestra = true; el.pause(); }
    ponerMedia();
    return true;
  }
  if (d.fin <= Date.now()) {
    // Ya ha acabado: si es el de la pista, que suene su aviso hasta el final; si se ha acabado antes a mano (−15, −1 min), la
    // pista de antes avisaría tarde: fuera (avisa la página, que está delante)
    if (actual && actual.d.fin !== d.fin) liberar();
    return !!actual;
  }
  if (actual && !actual.prueba && actual.d.fin === d.fin && !actual.interrumpida && !el.paused) { actual.d = d; actual.ctx = ctx; return true; }
  return empezar(d, ctx);
}

// Probar en el ajuste: un descanso de 10 s para bloquear el móvil y oírlo (en el mismo toque: sin esperar a nada)
// (no con un descanso de verdad sonando: lo cambiaría por la prueba)
export function probarPista(segundos = 10) {
  if (descansoSonando()) return 'ocupado';
  if (!sonidos) { prepararPista(); return false; }
  return empezar({ fin: Date.now() + segundos * 1000, total: segundos }, {}, true);
}

// (no anula el aviso al móvil que haya pendiente de programar: eso solo al parar a propósito, en pararPista y en aplicar)
function liberar() {
  clearInterval(reloj); reloj = null;
  document.removeEventListener('visibilitychange', alVerse);
  if (actual) ultimo = { fin: actual.d.fin, sonado: actual.sonado, final: actual.plan.final, prueba: actual.prueba };
  const url = actual?.url;
  if (el) {
    if (actual && !el.paused) actual.nuestra = true;
    try { el.pause(); el.removeAttribute('src'); el.load(); } catch { /* */ }
    for (const k of ['fin', 'cue', 'duracion', 'final']) delete el.dataset[k];
  }
  if (url) URL.revokeObjectURL(url);
  if (actual) { limpiarMedia(); ponerSesionAudio('ambient'); }
  actual = null;
}

// dejarAcabar: si el descanso ya ha acabado y el aviso está sonando, que termine (se suelta solo al acabar la pista).
// sesionId: solo si la pista es de esa sesión (al terminarla o quitarle todas las series).
export function pararPista({ dejarAcabar = false, sesionId = null } = {}) {
  if (!actual) return;
  if (sesionId && actual.ctx?.sesionId !== sesionId) return;
  if (dejarAcabar && !actual.interrumpida && el && !el.paused && Date.now() >= actual.d.fin - 300) return;
  clearTimeout(programar);
  liberar();
}

// ¿Avisa la pista al final de este descanso? (entonces la página no pita ni cuenta: ya lo hace ella; sí vibra y, si está viva,
// la voz del móvil dice la serie siguiente)
export function pistaManda(fin) {
  if (actual && !actual.prueba) return actual.d.fin === fin && !actual.interrumpida && (!el.paused || enPausa(actual.d));
  return !!ultimo && !ultimo.prueba && ultimo.fin === fin && ultimo.sonado;
}
// ¿Ya ha sonado su aviso? (para anular el aviso al móvil)
export const pistaSono = (fin) => (actual && !actual.prueba && actual.d.fin === fin && actual.sonado) || (!!ultimo && !ultimo.prueba && ultimo.fin === fin && ultimo.sonado);
// Las piezas de su aviso (para no repetir con la voz del móvil lo que ha dicho la del coach) y cuánto dura
export function pistaFinal(fin) {
  const x = actual && actual.d.fin === fin ? actual.plan.final : ultimo?.fin === fin ? ultimo.final : [];
  return x || [];
}
// ¿Tiene la sesión de audio en «playback»? (entonces prepararAudio no la pasa a «ambient»)
export const pistaActiva = () => !!actual && !actual.interrumpida;
// ¿Suena la pista de un descanso de verdad? (entonces «Probar con el móvil bloqueado» espera)
export const descansoSonando = () => !!actual && !actual.prueba && !actual.interrumpida;
