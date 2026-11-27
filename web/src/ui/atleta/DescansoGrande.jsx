// (tacto 207-209, v0.271) El descanso, de lejos y de reojo. El modo cartel: con el móvil tumbado (o con su botón), la
// cuenta atrás a toda pantalla, para leerla a dos metros; al acabar, «Te toca» con sus kilos en grande. La luz del
// borde: en los últimos 10 segundos el contorno de la pantalla se va encendiendo (se ve de reojo con el móvil en el
// banco). Y la forma de la pastilla, que cambia de ancho sin desaparecer y volver.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icono, Capa } from '../comunes.jsx';
import { sinMovimiento } from '../transiciones.js';
import { cartelDe, luzBorde, esTumbado, LUZ_SEG } from '../../logica/descanso-vista.js';

// ¿El móvil está tumbado ahora? (cambia al girarlo)
const leerTumbado = () => {
  if (typeof window === 'undefined' || typeof matchMedia === 'undefined') return false;
  return esTumbado({ tipo: window.screen?.orientation?.type || '', ancho: window.innerWidth, alto: window.innerHeight, tactil: matchMedia('(pointer: coarse)').matches });
};
export function useTumbado() {
  const [v, setV] = useState(leerTumbado);
  useEffect(() => {
    const leer = () => setV(leerTumbado());
    const o = window.screen?.orientation;
    try { o?.addEventListener?.('change', leer); } catch { /* sin ese aviso, el del tamaño */ }
    window.addEventListener('resize', leer);
    return () => { try { o?.removeEventListener?.('change', leer); } catch { /* */ } window.removeEventListener('resize', leer); };
  }, []);
  return v;
}

// (209) Al cambiar lo que dice (clave), la pastilla va de su ancho de antes al nuevo y lo de dentro sube a su sitio
export function useForma(ref, clave) {
  const ancho = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) { ancho.current = null; return; }
    const w = el.getBoundingClientRect().width;
    const antes = ancho.current;
    ancho.current = w;
    if (antes == null || Math.abs(antes - w) < 2 || sinMovimiento() || !el.animate) return;
    try {
      el.animate([{ width: `${antes}px` }, { width: `${w}px` }], { duration: 340, easing: 'cubic-bezier(.2, .9, .3, 1.1)' });
      el.querySelector('.num')?.animate([{ transform: 'translateY(9px)' }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2, .9, .3, 1)' });
    } catch { /* sin animaciones: cambia de golpe */ }
  }, [clave]);
}

// (208) La luz del borde. Una sola animación de 10 s que arranca por donde va la cuenta (nada que recalcular en cada
// cuarto de segundo); si el final cambia (±15 s), empieza otra. Al acabar el descanso se apaga en un momento.
export function LuzBorde({ quedan, total, pausado, fin }) {
  const vista = useRef(false);
  const luz = luzBorde({ quedan, total, pausado });
  if (luz != null) vista.current = true;
  if (quedan > 0 && luz == null) vista.current = false;
  const final = !(quedan > 0) && vista.current;
  if (luz == null && !final) return null;
  const poner = (el) => { if (el && !el.dataset.lb) { el.dataset.lb = '1'; el.style.animationDelay = `${-(luz * LUZ_SEG).toFixed(2)}s`; } };
  return <Capa><span key={final ? 'fin' : fin} ref={final ? undefined : poner} class={`lb-borde${final ? ' lb-fin' : ''}`} aria-hidden="true" /></Capa>;
}

// (207) El cartel. ajustar(s): ±15 s; saltar(); alCerrar()
export function Cartel({ quedan, total, pausado, texto, toca, ajustar, saltar, alCerrar }) {
  const raiz = useRef(null);
  const c = cartelDe({ quedan, total, pausado, texto, toca });
  // El foco entra en él y vuelve a donde estaba al salir; Escape lo cierra (y no cierra lo de debajo). (En cuanto se
  // monta, no tras pintar: como las hojas, para que el foco y Escape valgan desde el primer instante)
  useLayoutEffect(() => {
    const antes = document.activeElement;
    raiz.current?.querySelector('.ct-cerrar')?.focus({ preventScroll: true });
    const tecla = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); alCerrar(); return; }
      if (e.key !== 'Tab') return;
      const bs = [...(raiz.current?.querySelectorAll('button') || [])];
      if (!bs.length) return;
      const i = bs.indexOf(document.activeElement);
      e.preventDefault();
      bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus();
    };
    document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('keydown', tecla, true); try { if (antes?.isConnected) antes.focus({ preventScroll: true }); } catch { /* */ } };
  }, []);
  return (
    <div ref={raiz} class={`ct-raiz ct-${c.fase}`} role="dialog" aria-modal="true" aria-label="El descanso, en grande" data-sin-deslizar="">
      <div class="ct-cab">
        <span class="ct-etq">{c.etiqueta}</span>
        <button type="button" class="ct-cerrar" aria-label="Salir del modo cartel" onClick={alCerrar}><Icono n="cerrar" /></button>
      </div>
      {c.fase === 'toca' ? (
        <div class="ct-centro">
          <strong class="ct-nombre">{c.nombre}</strong>
          <span class="ct-cifra ct-carga num">{c.cifra}</span>
          {c.pie && <span class="ct-pie">{c.pie}</span>}
        </div>
      ) : (
        <div class="ct-centro">
          <span class="ct-cifra num" role="timer" aria-live="off" aria-label={quedan > 0 ? `Descanso${pausado ? ' en pausa' : ''}: quedan ${Math.ceil(quedan)} segundos` : 'Descanso terminado'}>{c.cifra}</span>
          {c.despues && <span class="ct-pie">{quedan > 0 ? 'Después: ' : 'Ahora: '}{c.despues}</span>}
        </div>
      )}
      <div class="ct-barra" aria-hidden="true"><span style={{ transform: `scaleX(${c.frac})` }} /></div>
      {quedan > 0 && (
        <div class="ct-acc">
          <button type="button" onClick={() => ajustar(-15)} aria-label="Quitar 15 segundos">−15 s</button>
          <button type="button" onClick={() => ajustar(15)} aria-label="Añadir 15 segundos">+15 s</button>
          <button type="button" class="ct-saltar" onClick={saltar}>Saltar</button>
        </div>
      )}
    </div>
  );
}
