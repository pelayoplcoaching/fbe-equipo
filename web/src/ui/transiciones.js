// Transiciones entre pantallas (v0.49) con la View Transitions API: al cambiar de pestaña, al abrir y cerrar una
// sesión o la ficha de un atleta. Donde el navegador no la tiene, con «reducir movimiento» o con la app en segundo
// plano, el cambio se hace sin más. Las animaciones están en estilos.css (::view-transition-*), cortas y con ease-out.

import { reportarError } from '../registro-errores.js';

export const sinMovimiento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let enCurso = null;
// tipo: 'adelante' | 'atras' (pestañas, según su orden), 'abrir' | 'cerrar' (una sesión o una ficha)
export function conTransicion(cambio, tipo = 'adelante') {
  const d = typeof document !== 'undefined' ? document : null;
  if (!d?.startViewTransition || sinMovimiento() || d.visibilityState === 'hidden') { cambio(); return; }
  // Una a la vez: la anterior salta a su final (su cambio ya está hecho)
  try { enCurso?.skipTransition(); } catch { /* */ }
  const raiz = d.documentElement;
  raiz.dataset.vt = tipo;
  let t;
  try {
    // Preact pinta en una microtarea tras el cambio de estado: una tarea después ya está la pantalla nueva
    // Un error dentro del cambio se apunta (Cuenta → Errores de la app) pero no se enseña: la pantalla sigue
    t = d.startViewTransition(() => {
      try { cambio(); } catch (e) { reportarError(e, 'transicion'); }
      return new Promise((r) => setTimeout(r, 0));
    });
  } catch { delete raiz.dataset.vt; cambio(); return; }
  enCurso = t;
  // Por si el navegador la deja colgada (la capa de la transición taparía los toques), como mucho un segundo
  const tope = setTimeout(() => { try { t.skipTransition(); } catch { /* */ } }, 1000);
  // Si se aborta (p. ej., el móvil gira y cambia el tamaño), el cambio ya está hecho: no es un error
  t.ready?.catch(() => {});
  t.updateCallbackDone?.catch(() => {});
  t.finished.catch(() => {}).then(() => {
    clearTimeout(tope);
    if (enCurso === t) { enCurso = null; if (raiz.dataset.vt === tipo) delete raiz.dataset.vt; }
  });
}
