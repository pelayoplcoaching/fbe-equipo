// Entrenador por voz (v0.48): lo dice el móvil con su voz (Web Speech API, speechSynthesis), en español de España si
// la tiene. Desactivado de entrada (Perfil → En este móvil). No toca la sesión de audio de la app (que va en
// «ambient» para no cortar la música): el móvil baja un momento la música mientras habla y la deja seguir. Donde no
// hay voz (o falla), no pasa nada: la sesión sigue igual, con sus pitidos.
import { leerAjustes } from './ajustes.js';
import { elegirVoz } from '../logica/voz.js';

export const hayVoz = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
let voz;
function vozEs() {
  if (voz !== undefined) return voz;
  try { voz = elegirVoz(window.speechSynthesis.getVoices() || []); } catch { voz = null; }
  if (!voz) voz = undefined; // (en Chrome llegan tarde: se vuelve a mirar la próxima vez)
  return voz || null;
}
// En iPhone la voz solo arranca si la primera vez es en un toque: se «despierta» con un texto vacío
let despierta = false;
export function prepararVoz() {
  if (despierta || !hayVoz() || !leerAjustes().voz) return;
  despierta = true;
  try { const u = new SpeechSynthesisUtterance(''); u.volume = 0; window.speechSynthesis.speak(u); } catch { /* sin voz */ }
}
// Dice un texto (corta lo que estuviera diciendo). forzar: aunque el ajuste esté apagado (para «Probar la voz»)
export function hablar(texto, { forzar = false } = {}) {
  if (!texto || !hayVoz() || (!forzar && !leerAjustes().voz)) return false;
  try {
    const s = window.speechSynthesis;
    s.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    const v = vozEs();
    if (v) u.voice = v;
    u.lang = v?.lang || 'es-ES';
    u.rate = 1.02;
    u.volume = Math.min(1, Math.max(0.1, Number(leerAjustes().volumen) || 1));
    s.speak(u);
    return true;
  } catch { return false; }
}
export function callar() { try { if (hayVoz()) window.speechSynthesis.cancel(); } catch { /* */ } }
