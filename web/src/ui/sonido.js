// La familia sonora de FBE, tocada (sonido, tanda 1): un solo contexto de audio para toda la app (la sesión, el chat, el
// juego) y un solo timbre: una campana suave (seno con un poco de octava en triángulo). Con «Modo gimnasio con ruido»,
// más brillo (un armónico más) y un poco más fuerte, para que se oiga por encima de la música de la sala.
// Qué suena y cuándo puede sonar, en logica/sonido.js. Si el navegador no deja (sin WebAudio o sin un toque antes), no
// suena y no pasa nada.
import { leerAjustes } from './ajustes.js';
import { SONIDOS, puedeSonar, volumenDe } from '../logica/sonido.js';

let ctx = null;
// El contexto de audio de la app (lo crea el primer toque: en iPhone, una web solo suena después de uno)
export function contexto() {
  try {
    const C = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!C) return null;
    // (en el iPhone, «ambient»: se mezcla con la música del atleta en vez de cortarla; si ya es otra, la deja)
    try { if (navigator.audioSession && navigator.audioSession.type === 'auto') navigator.audioSession.type = 'ambient'; } catch { /* solo Safari */ }
    ctx ||= new C();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}
export const contextoListo = () => ctx;

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
    const gimnasio = a.sonidoBrillante === true;
    const base = (s.soplo ? 0.09 : 0.2) * volumenDe(a, s.apartado) * (gimnasio ? 1.5 : 1);
    if (base <= 0) return false;
    if (s.soplo) { soplo(c, c.destination, s.soplo, Math.max(1, Math.min(8, datos.dura || 4)), base); return true; }
    const t0 = c.currentTime + 0.01;
    for (const [f, d, dura, v] of s.notas(datos)) campana(c, c.destination, f, t0 + d, dura, base * v, gimnasio);
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
