// Pulido 3: el botón «atrás» del móvil (y el del navegador, y el gesto de volver del iPhone) deshace lo último que
// se abrió en vez de sacar de la app, como en cualquier app instalada:
//   1. si hay una ventana encima (una hoja, el visor de fotos, la cámara…), la cierra;
//   2. si no, cierra la pantalla abierta (la sesión, la ficha de un atleta, una conversación);
//   3. si no, vuelve a la primera pestaña;
//   4. y si ya se está en la primera pestaña sin nada abierto, sale, como siempre.
//
// Cómo. El navegador solo avisa de «atrás» (popstate) si hay una entrada del historial que quitar, así que la app
// mantiene tantas entradas como cosas hay que deshacer:
//   · Las ventanas se cuentan solas: son las que llevan aria-modal="true" (todas las de la app), y se cierran como
//     con la tecla Escape, que todas atienden ya. Una ventana nueva no tiene que hacer nada para que «atrás» la cierre.
//   · Las pantallas se apuntan con useAtras(abierta, cerrar).
//   · Al abrirse algo se añade una entrada (dentro del mismo toque, que es cuando el navegador las respeta). Si se
//     cierra con su botón, la entrada se queda de sobra y se aprovecha para lo siguiente que se abra; cuando ya no
//     queda nada abierto, se retiran todas de una vez, y así en la primera pestaña «atrás» sale al primer toque.
//   · La dirección (#hoy, #mensajes…) no cambia de significado: al volver a una entrada se le pone la de la pantalla
//     que se está viendo, y ese cambio no cuenta como «ir a otra sección» (ponerRuta la mantiene al día).

import { useEffect, useRef } from 'preact/hooks';

const pantallas = [];    // { fn, orden, n }: lo que «atrás» cierra cuando no hay ventanas (la de encima, la última)
let sec = 0;
let nivel = 0;           // entradas del historial por encima de la de partida
let propios = 0;         // retrocesos que hace la propia app (retirar las entradas de sobra): no son de la persona
let ruta = '';           // la dirección de la pantalla que se ve
let callar = false;      // el siguiente cambio de # viene de moverse por el historial: no es una orden de ir a una sección
let limpieza = 0;
let instalado = false;

const hay = () => typeof window !== 'undefined' && typeof document !== 'undefined' && !!window.history?.pushState;
const ventanas = () => document.querySelectorAll('[aria-modal="true"]');
const fondo = () => ventanas().length + pantallas.length;
const estado = (n) => ({ ...(history.state && typeof history.state === 'object' ? history.state : {}), fbe: n });

function callarCambio() { callar = true; setTimeout(() => { callar = false; }, 80); }

// Que haya, al menos, tantas entradas como cosas que deshacer
function asegurar() {
  if (!instalado || propios) return;
  ruta = location.href;
  const f = fondo();
  try { while (nivel < f) { history.pushState({ fbe: nivel + 1 }, ''); nivel++; } } catch { /* */ }
  if (f === 0 && nivel > 0) programarLimpieza(); else if (f > 0) clearTimeout(limpieza);
}
// Sin nada abierto, las entradas de sobra se retiran (un momento después: por si se abre otra cosa enseguida)
function programarLimpieza() {
  clearTimeout(limpieza);
  limpieza = setTimeout(limpiar, 250);
}
function limpiar() {
  if (!instalado || propios || nivel <= 0 || fondo() > 0) return;
  ruta = location.href;
  propios++;
  const n = nivel;
  nivel = 0;
  try { history.go(-n); } catch { propios--; nivel = n; }
}

// Lo que hace «atrás»
function deshacer() {
  const vs = ventanas();
  if (vs.length) {
    const arriba = vs[vs.length - 1];
    const donde = arriba.contains(document.activeElement) ? document.activeElement : arriba;
    donde.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
    return true;
  }
  const p = pantallas[pantallas.length - 1];
  if (p) { try { p.fn(); } catch { /* */ } return true; }
  return false;
}

function alPop(e) {
  // La entrada a la que se llega puede llevar la dirección de otra pantalla: se le pone la de la que se ve
  const ponerRutaAqui = () => {
    if (ruta && location.href !== ruta) { callarCambio(); try { history.replaceState(history.state, '', ruta); } catch { /* */ } }
  };
  if (propios) {
    propios--;
    ponerRutaAqui();
    try { history.replaceState(estado(0), ''); } catch { /* */ }
    asegurar();   // (por si se abrió algo mientras se retiraban)
    return;
  }
  // Sin la marca de la app no es un retroceso: es una dirección nueva (location.hash = …, que también avisa por
  // aquí). La apunta alCambiarRuta
  if (!Number.isFinite(e.state?.fbe)) return;
  const j = e.state.fbe;
  const adelante = j > nivel;
  nivel = j;
  ponerRutaAqui();
  if (adelante) { if (fondo() === 0) programarLimpieza(); return; }   // «adelante» del navegador: nada que rehacer
  // Nada que cerrar y entradas de sobra (se pulsó «atrás» antes de retirarlas): se retiran ya
  if (!deshacer() && nivel > 0) limpiar();
}

function alCambiarRuta(e) {
  if (callar) { callar = false; e.stopImmediatePropagation(); return; }
  // Una dirección nueva de verdad (se tocó una notificación con la app abierta): es una entrada más
  if (!Number.isFinite(history.state?.fbe)) { nivel++; try { history.replaceState(estado(nivel), ''); } catch { /* */ } }
  ruta = location.href;
}

export function instalarAtras() {
  if (instalado || !hay()) return;
  instalado = true;
  // (pulido 3.10) La posición de cada pantalla la lleva la app (posiciones.js). Sin esto, al retirar las entradas de
  // sobra del historial (un cuarto de segundo después de cerrar una ventana), el navegador devolvía la pantalla a
  // donde estaba cuando se abrió la ventana: si entre tanto se había movido, daba un salto
  try { history.scrollRestoration = 'manual'; } catch { /* */ }
  // (también al recargar la página se parte de cero: las entradas de antes son de la página anterior y no avisan)
  nivel = 0;
  try { history.replaceState(estado(0), ''); } catch { /* */ }
  ruta = location.href;
  window.addEventListener('popstate', alPop);
  window.addEventListener('hashchange', alCambiarRuta);   // (antes que los de la app: se instala al arrancar)
  // Las ventanas que aparecen y desaparecen (solo se mira lo que entra y sale de la página)
  const esVentana = (n) => n.nodeType === 1 && (n.matches('[aria-modal="true"]') || !!n.querySelector('[aria-modal="true"]'));
  new MutationObserver((cambios) => {
    for (const c of cambios) {
      for (const n of c.addedNodes) if (esVentana(n)) { asegurar(); return; }
      for (const n of c.removedNodes) if (esVentana(n)) { asegurar(); return; }
    }
  }).observe(document.body, { childList: true, subtree: true });
  // Con cada toque, de paso, se repone lo que falte (p. ej., tras cerrar con «atrás» una ventana que no se dejó)
  window.addEventListener('pointerdown', asegurar, { passive: true, capture: true });
}

// La dirección de la pantalla (#hoy, #mensajes…), sin perder la cuenta de las entradas
export function ponerRuta(hash) {
  if (!hay()) return;
  try { history.replaceState(history.state, '', hash); } catch { /* */ }
  if (!propios) ruta = location.href;
}

// Mientras `abierta`, «atrás» llama a `cerrar` (si no hay una ventana encima). orden: 0 la pestaña, 1 una pantalla
// (la sesión, la ficha), 2 lo que se abre dentro de una pantalla (una conversación): a igual orden, la última
export function useAtras(abierta, cerrar, orden = 1) {
  const ref = useRef(cerrar);
  ref.current = cerrar;
  useEffect(() => {
    if (!abierta) return undefined;
    const p = { fn: () => ref.current?.(), orden, n: ++sec };
    pantallas.push(p);
    pantallas.sort((a, b) => a.orden - b.orden || a.n - b.n);
    asegurar();
    return () => { const i = pantallas.indexOf(p); if (i >= 0) pantallas.splice(i, 1); asegurar(); };
  }, [!!abierta, orden]);
}

// Para las pruebas
export const estadoAtras = () => ({ nivel, fondo: hay() ? fondo() : 0, pantallas: pantallas.length });
