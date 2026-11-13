// Entrenador por voz (v0.48): lo dice el móvil con su voz (Web Speech API, speechSynthesis), en español de España si
// la tiene. Desactivado de entrada (Perfil → En este móvil). No toca la sesión de audio de la app (que va en
// «ambient» para no cortar la música): el móvil baja un momento la música mientras habla y la deja seguir. Donde no
// hay voz (o falla), no pasa nada: la sesión sigue igual, con sus pitidos.
import { leerAjustes } from './ajustes.js';
import { apartarFondo } from './sonido.js';
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
    const a = leerAjustes();
    // (sonido 2, tanda 6) la voz que haya elegido (si el móvil la tiene) y su velocidad
    const v = vozElegida(a.vozNombre) || vozEs();
    if (v) u.voice = v;
    u.lang = v?.lang || 'es-ES';
    u.rate = 1.02 * (Number(a.vozVelocidad) || 1);
    u.volume = Math.min(1, Math.max(0.1, Number(a.volumen) || 1));
    s.speak(u);
    // (sonido 2, tanda 4) mientras habla, lo de fondo (la música del juego, el paisaje sonoro) se aparta
    apartarFondo(Math.min(8, 0.6 + String(texto).length * 0.065 / u.rate));
    return true;
  } catch { return false; }
}
export function callar() { try { if (hayVoz()) window.speechSynthesis.cancel(); } catch { /* */ } }

// (sonido 2, tanda 6) Las voces en español que tiene el móvil, para elegir una: [{ nombre, idioma, local }]
export function vocesEspanol() {
  if (!hayVoz()) return [];
  try { return (window.speechSynthesis.getVoices() || []).filter((v) => /^es(-|_|$)/i.test(v.lang || '')).map((v) => ({ nombre: v.name, idioma: v.lang, local: !!v.localService })); }
  catch { return []; }
}
function vozElegida(nombre) {
  if (!nombre || !hayVoz()) return null;
  try { return (window.speechSynthesis.getVoices() || []).find((v) => v.name === nombre) || null; } catch { return null; }
}
