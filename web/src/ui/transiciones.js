// Transiciones entre pantallas (v0.49) con la View Transitions API: al cambiar de pestaña, al abrir y cerrar una
// sesión o la ficha de un atleta. Donde el navegador no la tiene, con «reducir movimiento» o con la app en segundo
// plano, el cambio se hace sin más. Las animaciones están en estilos.css (::view-transition-*), cortas y con ease-out.
// v0.52: con elemento compartido (como Fotos de Apple o Airbnb): el nombre y el pictograma de un ejercicio pasan a la
// cabecera de su ficha, la foto de un atleta a la de su ficha y el título de la sesión de Hoy al de su portada. El
// nombre de transición se pone solo a esa pareja y solo durante la transición (el origen, antes de la captura; al
// cambiar, se le quita y se le pone al destino, que se espera como mucho 150 ms si aún está cargando (si no llega, la transición de siempre, sin pareja); al acabar, fuera).

import { reportarError } from '../registro-errores.js';
import { paresValidos, seVe } from '../logica/vistas.js';

export const sinMovimiento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Cuánto se espera al destino (una pantalla que aún carga sus datos): la pantalla se queda quieta mientras tanto
const ESPERA_DESTINO = 150;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const buscar = (sel) => { try { return document.querySelector(sel); } catch { return null; } };
async function buscarDestinos(pares) {
  const fin = performance.now() + ESPERA_DESTINO;
  for (;;) {
    const els = pares.map((p) => buscar(p.hasta));
    if (els.every(Boolean) || performance.now() > fin) return els;
    await esperar(16);
  }
}

let enCurso = null;
// tipo: 'adelante' | 'atras' (pestañas, según su orden), 'abrir' | 'cerrar' (una sesión o una ficha), 'morph' (solo
// el elemento compartido se mueve; lo demás funde: una hoja que se abre)
// compartidos (v0.52): [{ nombre, desde: elemento, hasta: selector }]
export function conTransicion(cambio, tipo = 'adelante', compartidos = null) {
  const d = typeof document !== 'undefined' ? document : null;
  if (!d?.startViewTransition || sinMovimiento() || d.visibilityState === 'hidden') { cambio(); return; }
  // Una a la vez: la anterior salta a su final (su cambio ya está hecho)
  try { enCurso?.skipTransition(); } catch { /* */ }
  const raiz = d.documentElement;
  // Solo las parejas válidas y con el origen a la vista (transformar algo desde fuera de la pantalla queda raro)
  const pares = paresValidos(compartidos || []).filter((p) => p.desde.isConnected && seVe(p.desde.getBoundingClientRect(), innerWidth, innerHeight));
  for (const p of pares) p.desde.style.viewTransitionName = p.nombre;
  const destinos = [];
  raiz.dataset.vt = tipo;
  let t;
  try {
    // Preact pinta en una microtarea tras el cambio de estado: una tarea después ya está la pantalla nueva
    // Un error dentro del cambio se apunta (Cuenta → Errores de la app) pero no se enseña: la pantalla sigue
    t = d.startViewTransition(async () => {
      try { cambio(); } catch (e) { reportarError(e, 'transicion'); }
      await esperar(0);
      if (!pares.length) return;
      // El origen suelta su nombre (si sigue en la página, debajo de una hoja, dos con el mismo nombre la cancelarían)
      for (const p of pares) p.desde.style.viewTransitionName = '';
      const els = await buscarDestinos(pares);
      els.forEach((el, i) => { if (el) { el.style.viewTransitionName = pares[i].nombre; destinos.push(el); } });
    });
  } catch { for (const p of pares) p.desde.style.viewTransitionName = ''; delete raiz.dataset.vt; cambio(); return; }
  enCurso = t;
  const limpiar = () => {
    for (const p of pares) if (p.desde.style) p.desde.style.viewTransitionName = '';
    for (const el of destinos) el.style.viewTransitionName = '';
  };
  // Por si el navegador la deja colgada (la capa de la transición taparía los toques), como mucho un segundo y medio
  const tope = setTimeout(() => { try { t.skipTransition(); } catch { /* */ } }, 1500);
  // Si se aborta (p. ej., el móvil gira y cambia el tamaño), el cambio ya está hecho: no es un error
  t.ready?.catch(() => {});
  t.updateCallbackDone?.catch(() => {});
  t.finished.catch(() => {}).then(() => {
    clearTimeout(tope);
    limpiar();
    if (enCurso === t) { enCurso = null; if (raiz.dataset.vt === tipo) delete raiz.dataset.vt; }
  });
}
