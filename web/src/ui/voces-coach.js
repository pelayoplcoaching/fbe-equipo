// Las frases del coach, con su voz (sonido, tanda 3; migración 064). El coach las graba en la app (ui/coach/VocesCoach.jsx);
// en la sesión del atleta se traen una vez (al entrar en la sesión), se decodifican y suenan en su momento por el mismo
// contexto de audio que el resto (ui/sonido.js), con el volumen del entreno. Si no hay frases, no hay red o falta la 064,
// suena lo de siempre (la voz del móvil o nada). Nada sale del móvil: solo se descargan los audios del coach.
import { contexto } from './sonido.js';
import { leerAjustes } from './ajustes.js';
import { volumenDe } from '../logica/sonido.js';

// Las frases que se pueden grabar, en orden, con lo que conviene decir y cuándo suenan
export const FRASES_VOZ = [
  ['vamos', '¡Vamos!', 'Al acabar el descanso'],
  ['ultima', 'Última serie', 'Al acabar el descanso, antes de la última serie de la sesión'],
  ['fin_descanso', 'Se acabó el descanso', 'Al acabar el descanso, si no toca otra'],
  ['record', '¡Récord!', 'Al batir un récord'],
  ['buen_trabajo', 'Buen trabajo', 'Al terminar la sesión'],
  ['fin_sesion', 'Sesión terminada', 'Al terminar la sesión, si no hay «Buen trabajo»'],
];
export const MAX_VOZ_MS = 6000;

let buffers = null, pidiendo = null;
export const vocesListas = () => !!buffers && Object.keys(buffers).length > 0;
// Se traen y se decodifican las frases (una vez por apertura de la app; con forzar, de nuevo)
export function prepararVocesCoach(api, { forzar = false } = {}) {
  if (!api?.vocesCoach || leerAjustes().vozCoach === false) return Promise.resolve(null);
  if (pidiendo && !forzar) return pidiendo;
  pidiendo = (async () => {
    const filas = await api.vocesCoach().catch(() => []);
    const c = contexto();
    const out = {};
    for (const f of filas || []) {
      try {
        const url = await api.urlVozCoach(f.ruta);
        const datos = await (await fetch(url)).arrayBuffer();
        if (c) out[f.clave] = await new Promise((ok, mal) => { const r = c.decodeAudioData(datos, ok, mal); r?.then?.(ok, mal); });
      } catch { /* esa frase no: suena lo de siempre */ }
    }
    buffers = out;
    return out;
  })().catch(() => { pidiendo = null; return null; });
  return pidiendo;
}
// Suena una frase (la primera de las claves que haya grabada). Devuelve si ha sonado
export function sonarVozCoach(...claves) {
  const a = leerAjustes();
  if (!buffers || a.vozCoach === false || a.sonido === false) return false;
  const k = claves.find((x) => buffers[x]);
  const c = contexto();
  if (!k || !c) return false;
  try {
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = buffers[k]; g.gain.value = Math.max(0.05, volumenDe(a, 'entreno'));
    s.connect(g).connect(c.destination);
    s.start();
    try { globalThis.dispatchEvent?.(new CustomEvent('fbe-sonido', { detail: { tipo: `voz:${k}` } })); } catch { /* */ }
    return true;
  } catch { return false; }
}
// (para las pruebas y al cambiar las frases el coach)
export function olvidarVocesCoach() { buffers = null; pidiendo = null; }
