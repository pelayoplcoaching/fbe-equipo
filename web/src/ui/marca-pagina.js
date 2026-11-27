// (v0.209, rendimiento) Marcas en <html> de lo que hay en pantalla («hay-enfoque», «hay-velo»…), puestas por el propio
// componente al montarse. Antes eran reglas como «body:has(.enfoque) .toast»: con ellas, el navegador tiene que mirar la
// página entera cada vez que algo cambia por si aparece o se va una de esas piezas, y en los Android lentos se nota. Con
// una clase que pone la app, solo recalcula cuando de verdad cambia.
// (cuenta cuántas hay de cada una: dos hojas abiertas a la vez quitan la marca al cerrarse la última)
import { useCallback, useLayoutEffect, useRef } from 'preact/hooks';

const cuenta = new Map();

export function marcarPagina(clase, si) {
  if (typeof document === 'undefined') return;
  const n = Math.max(0, (cuenta.get(clase) || 0) + (si ? 1 : -1));
  cuenta.set(clase, n);
  document.documentElement.classList.toggle(clase, n > 0);
  if (TAPAN.includes(clase)) repintarPausas();
}

// La marca mientras el componente esté montado (y «activa», si se le pasa)
export function useMarcaPagina(clase, activa = true) {
  useLayoutEffect(() => {
    if (!activa) return undefined;
    marcarPagina(clase, true);
    return () => marcarPagina(clase, false);
  }, [clase, activa]);
}

// (v0.209, rendimiento) Las animaciones que no paran (el cielo de Hoy, la llama de la racha…), en pausa mientras no se
// ven: al bajar por Hoy, el cielo de arriba seguía titilando y obligaba a repintar en cada fotograma. Un solo vigilante
// para todas; fuera de la pantalla llevan data-pausa (y el CSS las para: belleza.css, «Pausa fuera de la pantalla»).
let vigia = null;
// (belleza 330) Nada gasta cuando no se ve: con una hoja, una historia o cualquier ventana encima («hay-velo», «hay-tapa»:
// la pone la capa que lleva un diálogo), también se paran, y siguen donde iban al quitarse
const TAPAN = ['hay-velo', 'hay-tapa'];
const vigiladas = new Set();
const fuera = new WeakSet();   // las que el vigilante ha visto fuera de la pantalla
// (lo que va dentro de una capa, como la llama de la pantalla de la racha, es lo que se ve: ese no)
const tapada = (el) => !el?.closest?.('.capa') && TAPAN.some((c) => (cuenta.get(c) || 0) > 0);
function repintarPausas() {
  for (const el of vigiladas) el.toggleAttribute('data-pausa', tapada(el) || fuera.has(el));
  // (y la nieve o las estrellas de la temporada, que van detrás de toda la app)
  const t = TAPAN.some((c) => (cuenta.get(c) || 0) > 0);
  for (const el of document.querySelectorAll('body > .temporada-capa')) el.toggleAttribute('data-pausa', t);
}
function vigilante() {
  if (vigia !== null) return vigia;
  vigia = typeof IntersectionObserver === 'undefined' ? false : new IntersectionObserver((es) => {
    for (const e of es) {
      if (e.isIntersecting) fuera.delete(e.target); else fuera.add(e.target);
      e.target.toggleAttribute('data-pausa', !e.isIntersecting || tapada(e.target));
    }
  }, { rootMargin: '64px' });
  return vigia;
}

// El ref que se le pone al elemento animado (svg o contenedor)
export function usePausaFuera() {
  const actual = useRef(null);
  useLayoutEffect(() => () => { const el = actual.current; if (el && vigia) { vigia.unobserve(el); vigiladas.delete(el); el.removeAttribute('data-pausa'); } }, []);
  return useCallback((el) => {
    const v = vigilante();
    if (!v) return;
    if (actual.current && actual.current !== el) { v.unobserve(actual.current); vigiladas.delete(actual.current); actual.current.removeAttribute('data-pausa'); }
    actual.current = el;
    if (el) { v.observe(el); vigiladas.add(el); if (tapada(el)) el.setAttribute('data-pausa', ''); }
  }, []);
}
