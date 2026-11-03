// Los sonidos del chat (v0.56): dos tonos propios, suaves y cortos, hechos al momento con WebAudio (sin archivos de
// audio, ni de WhatsApp ni de nadie). «enviado»: dos notas que suben; «recibido»: dos que bajan, un poco más presentes.
// Solo con el chat abierto y a la vista, con «Sonidos del chat» activado y la conversación sin silenciar (lo decide
// debeSonar, en logica/chat.js). Si el navegador no deja (sin WebAudio o sin un toque antes), no suena y no pasa nada.
import { ajuste } from './ajustes.js';

let ctx = null;
const contexto = () => {
  try {
    const C = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!C) return null;
    ctx ||= new C();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
};
const TONOS = {
  enviado: [[880, 0, 0.07], [1318.5, 0.06, 0.09]],
  recibido: [[1046.5, 0, 0.09], [784, 0.08, 0.14]],
};
export let sonados = 0; // para las pruebas: cuántas veces ha sonado algo
export function sonar(tipo) {
  if (ajuste('sonidosChat') === false || !TONOS[tipo]) return false;
  sonados++;
  try { globalThis.dispatchEvent?.(new CustomEvent('fbe-sonido', { detail: { tipo } })); } catch { /* */ }
  const c = contexto();
  if (!c) return false;
  try {
    const t0 = c.currentTime + 0.01;
    const vol = Math.max(0, Math.min(1, Number(ajuste('volumen') ?? 1))) * (tipo === 'recibido' ? 0.16 : 0.11);
    for (const [f, d, dur] of TONOS[tipo]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + d);
      g.gain.linearRampToValueAtTime(vol, t0 + d + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + dur);
      o.connect(g).connect(c.destination);
      o.start(t0 + d);
      o.stop(t0 + d + dur + 0.02);
    }
    return true;
  } catch { return false; }
}
