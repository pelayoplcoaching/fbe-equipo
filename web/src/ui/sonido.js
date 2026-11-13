// La familia sonora de FBE, tocada (sonido, tanda 1): un solo contexto de audio para toda la app (la sesión, el chat, el
// juego) y un solo timbre: una campana suave (seno con un poco de octava en triángulo). Con «Modo gimnasio con ruido»,
// más brillo (un armónico más) y un poco más fuerte, para que se oiga por encima de la música de la sala.
// Qué suena y cuándo puede sonar, en logica/sonido.js. Si el navegador no deja (sin WebAudio o sin un toque antes), no
// suena y no pasa nada.
import { leerAjustes } from './ajustes.js';
import { SONIDOS, puedeSonar, volumenDe, turno, prioridadDe, duracionDe } from '../logica/sonido.js';

let ctx = null;
// El contexto de audio de la app (lo crea el primer toque: en iPhone, una web solo suena después de uno)
export function contexto() {
  try {
    const C = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!C) return null;
    // (en el iPhone, «ambient»: se mezcla con la música del atleta en vez de cortarla; si ya es otra, la deja)
    try { if (navigator.audioSession && navigator.audioSession.type === 'auto') navigator.audioSession.type = 'ambient'; } catch { /* solo Safari */ }
    if (!ctx) { ctx = new C(); montarMezcla(ctx); }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}
export const contextoListo = () => ctx;

// ---------- (sonido 2, tanda 4) La mezcla ----------
// Todo lo de la app pasa por un limitador (que nada suene de golpe demasiado fuerte) antes de salir. Lo de fondo (la música
// del juego, el paisaje sonoro del descanso) va por su propio canal, que se aparta (baja un momento) cuando habla el coach o
// la voz del móvil.
let maestro = null, fondo = null;
function montarMezcla(c) {
  try {
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -12; lim.knee.value = 6; lim.ratio.value = 8; lim.attack.value = 0.003; lim.release.value = 0.25;
    lim.connect(c.destination);
    maestro = lim;
    fondo = c.createGain(); fondo.gain.value = 1; fondo.connect(lim);
  } catch { maestro = null; fondo = null; }
}
// La salida de los sonidos de la app (con su limitador) y la de lo de fondo
export const salida = (c = ctx) => (c && c === ctx && maestro) || c?.destination || null;
export const salidaFondo = (c = ctx) => (c && c === ctx && fondo) || salida(c);
// Lo de fondo se aparta durante `segundos` (baja al 25 % y vuelve despacio)
export function apartarFondo(segundos = 2.5) {
  if (!ctx || !fondo) return;
  try {
    const t = ctx.currentTime, g = fondo.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.25, t + 0.15);
    g.setValueAtTime(0.25, t + segundos);
    g.linearRampToValueAtTime(1, t + segundos + 0.8);
  } catch { /* */ }
}
// Lo que está sonando ahora (para que no suenen dos a la vez): { hasta, prioridad }
let sonando = null;
export function ocupar(c, clave, dura) {
  const p = prioridadDe(clave), hasta = c.currentTime + dura;
  if (!sonando || hasta > sonando.hasta || p >= sonando.prioridad) sonando = { hasta, prioridad: p };
}

export let sonados = 0;   // para las pruebas: cuántas veces se ha pedido algo que podía sonar
const avisar = (clave) => { try { globalThis.dispatchEvent?.(new CustomEvent('fbe-sonido', { detail: { tipo: clave } })); } catch { /* */ } };

function campana(c, destino, f, t0, dura, vol, brillo) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.05, dura));
  g.connect(destino);
  const partes = [['sine', f, 1], ['triangle', f * 2, 0.22], ...(brillo ? [['square', f * 3, 0.06]] : [])];
  for (const [tipo, fr, k] of partes) {
    const o = c.createOscillator(), gk = c.createGain();
    o.type = tipo; o.frequency.value = fr; gk.gain.value = k;
    o.connect(gk).connect(g);
    o.start(t0); o.stop(t0 + dura + 0.05);
  }
}
// El soplo de la respiración: ruido rosa suave, filtrado, que sube o baja durante `dura` segundos
let ruido = null;
function soplo(c, destino, sentido, dura, vol) {
  if (!ruido) {
    ruido = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = ruido.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2) * 0.6; }
  }
  const s = c.createBufferSource(); s.buffer = ruido; s.loop = true;
  const filtro = c.createBiquadFilter(); filtro.type = 'bandpass'; filtro.Q.value = 0.8;
  const g = c.createGain(), t0 = c.currentTime + 0.01, sube = sentido === 'sube';
  filtro.frequency.setValueAtTime(sube ? 380 : 900, t0); filtro.frequency.linearRampToValueAtTime(sube ? 900 : 380, t0 + dura);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.8, dura * 0.35));
  g.gain.linearRampToValueAtTime(vol * 0.6, t0 + dura * 0.8);
  g.gain.linearRampToValueAtTime(0.0001, t0 + dura);
  s.connect(filtro).connect(g).connect(destino);
  s.start(t0); s.stop(t0 + dura + 0.05);
}

// Suena una cosa de la familia (clave de logica/sonido.js, SONIDOS) con sus datos ({ n, total }, { segundo }, { nivel }…).
// opts.forzar: suena aunque su ajuste esté apagado (al probarlo en Ajustes). Devuelve si ha podido sonar.
export function sonarFBE(clave, datos = {}, { forzar = false, ajustes = null } = {}) {
  const a = ajustes || leerAjustes();
  const s = SONIDOS[clave];
  if (!s || (!forzar && !puedeSonar(a, clave))) return false;
  sonados++;
  avisar(clave);
  const c = ctx;   // (no se crea aquí: solo tras un toque, con contexto())
  if (!c) return false;
  try {
    if (c.state === 'suspended') c.resume().catch(() => {});
    // (sonido 2) nunca dos a la vez: lo de menos, si suena algo más importante, espera o se omite (al probar, siempre suena)
    const tu = forzar ? { accion: 'ya', retraso: 0 } : turno(sonando, clave, c.currentTime);
    if (tu.accion === 'omite') return false;
    const destino = salida(c);
    const gimnasio = a.sonidoBrillante === true;
    const base = (s.soplo ? 0.09 : 0.2) * volumenDe(a, s.apartado) * (gimnasio ? 1.5 : 1);
    if (base <= 0) return false;
    if (s.soplo) { soplo(c, salidaFondo(c), s.soplo, Math.max(1, Math.min(8, datos.dura || 4)), base); return true; }
    const t0 = c.currentTime + 0.01 + tu.retraso;
    for (const [f, d, dura, v] of s.notas(datos)) campana(c, destino, f, t0 + d, dura, base * v, gimnasio);
    ocupar(c, clave, tu.retraso + duracionDe(clave, datos));
    return true;
  } catch { return false; }
}
// Una tanda seguida (para «Escuchar todos»): [clave, datos][] con una pausa entre cada una; devuelve cómo pararla
export function sonarTanda(lista, { cada = 900, alSonar = () => {} } = {}) {
  let i = 0, t = 0;
  const siguiente = () => {
    if (i >= lista.length) { alSonar(null); return; }
    const [clave, datos, nombre] = lista[i++];
    sonarFBE(clave, datos, { forzar: true });
    alSonar(nombre ?? clave);
    t = setTimeout(siguiente, cada);
  };
  contexto();
  siguiente();
  return () => { clearTimeout(t); alSonar(null); };
}

// (sonido, tanda 2) El contexto se crea con el primer toque en cualquier sitio de la app (no suena nada): así pueden
// sonar los logros, el chat o la comunidad sin haber entrado antes en una sesión
export function prepararAlTocar() {
  if (typeof window === 'undefined') return;
  const una = () => { contexto(); window.removeEventListener('pointerdown', una, true); window.removeEventListener('keydown', una, true); };
  window.addEventListener('pointerdown', una, true);
  window.addEventListener('keydown', una, true);
}

// ---------- (sonido 2, tanda 7) El paisaje sonoro del descanso ----------
// Ruido marrón (grave y continuo), lluvia (ruido filtrado con gotas sueltas) o bosque (un rumor suave con algún pájaro),
// muy bajito, por el canal de fondo (se aparta cuando habla el coach o la voz). Empieza con un fundido y se apaga despacio.
// Devuelve cómo pararlo.
let ruidoMarron = null;
function bufferMarron(c) {
  if (ruidoMarron) return ruidoMarron;
  ruidoMarron = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
  const d = ruidoMarron.getChannelData(0); let ult = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; ult = (ult + 0.02 * w) / 1.02; d[i] = ult * 3.2; }
  return ruidoMarron;
}
export function empezarPaisaje(tipo, { volumen = null } = {}) {
  const c = ctx, a = leerAjustes();
  if (!c || !['marron', 'lluvia', 'bosque'].includes(tipo) || a.sonido === false) return () => {};
  const vol = (volumen ?? 0.12) * volumenDe(a, 'entreno');
  if (vol <= 0.001) return () => {};
  const g = c.createGain(), t0 = c.currentTime;
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 2);
  g.connect(salidaFondo(c));
  const fuente = c.createBufferSource(); fuente.buffer = bufferMarron(c); fuente.loop = true;
  const filtro = c.createBiquadFilter();
  filtro.type = tipo === 'marron' ? 'lowpass' : 'bandpass';
  filtro.frequency.value = tipo === 'marron' ? 420 : tipo === 'lluvia' ? 1800 : 700;
  filtro.Q.value = tipo === 'lluvia' ? 0.6 : 0.7;
  fuente.connect(filtro).connect(g); fuente.start();
  let vivo = true, reloj = 0;
  // (las gotas de la lluvia y los pájaros del bosque, de vez en cuando)
  const suelto = () => {
    if (!vivo) return;
    try {
      const t = c.currentTime + 0.02;
      if (tipo === 'lluvia') {
        const o = c.createOscillator(), gg = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(2200 + Math.random() * 1800, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.05);
        gg.gain.setValueAtTime(vol * 0.5, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.06); o.connect(gg).connect(salidaFondo(c)); o.start(t); o.stop(t + 0.08);
      } else if (tipo === 'bosque' && Math.random() < 0.5) {
        const base = 2400 + Math.random() * 1600;
        for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) {
          const o = c.createOscillator(), gg = c.createGain(), tk = t + k * 0.13; o.type = 'sine';
          o.frequency.setValueAtTime(base, tk); o.frequency.exponentialRampToValueAtTime(base * 1.4, tk + 0.07);
          gg.gain.setValueAtTime(0.0001, tk); gg.gain.exponentialRampToValueAtTime(vol * 0.35, tk + 0.02); gg.gain.exponentialRampToValueAtTime(0.0001, tk + 0.1);
          o.connect(gg).connect(salidaFondo(c)); o.start(tk); o.stop(tk + 0.12);
        }
      }
    } catch { /* */ }
    reloj = setTimeout(suelto, tipo === 'lluvia' ? 60 + Math.random() * 240 : 2500 + Math.random() * 4000);
  };
  if (tipo !== 'marron') suelto();
  return () => {
    if (!vivo) return;
    vivo = false; clearTimeout(reloj);
    try { const t = c.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + 1.5); fuente.stop(t + 1.6); } catch { /* */ }
  };
}

// ---------- (sonido 2, tanda 7) Escuchar una melodía (el progreso de un ejercicio) ----------
export function sonarMelodia(notas, { forzar = true } = {}) {
  const c = contexto(), a = leerAjustes();
  if (!c || !notas?.length || (!forzar && a.sonido === false)) return false;
  const base = 0.18 * volumenDe(a, 'entreno'), t0 = c.currentTime + 0.05;
  for (const n of notas) campana(c, salida(c), n.f, t0 + n.d, n.dura, base * 0.8, a.sonidoBrillante === true);
  return true;
}
