// (diseño, tanda 23) La barra del sistema (theme-color, en la app instalada) toma el color de lo que llena la pantalla
// mientras está: el de la fase en los intervalos, la noche con una foto en grande. Devuelve con qué volver: el color
// del tema de siempre (ajustes.js lo calcula otra vez). La de la portada de arranque (#tc-portada) no se toca.
import { aplicarTema } from './ajustes.js';

export function tenirBarra(color) {
  if (typeof document === 'undefined' || !color) return () => {};
  for (const m of document.querySelectorAll('meta[name="theme-color"]:not(#tc-portada)')) {
    m.dataset.original ||= m.getAttribute('content');
    m.setAttribute('content', color);
  }
  return () => { try { aplicarTema(); } catch { /* */ } };
}
