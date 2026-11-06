// Las secciones de la ficha del atleta (Programa, Mensajes, Actividad…): hasta once. La tira de pestañas de siempre se
// sigue deslizando con el dedo; cuando no caben todas, al final hay un botón fijo («Índice de secciones»: el nombre no
// lleva «todas» porque una prueba pulsa el primer botón que diga «todas») que abre una hoja con todas a la vez,
// y la elegida se queda siempre a la vista en la tira. Estilos en diseno.css, bloque 12.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Pestanas, Hoja, Icono } from '../comunes.jsx';
import { sinMovimiento } from '../transiciones.js';

const ICONO = { programa: 'semana', mensajes: 'mensaje', actividad: 'historial', registro: 'hoy', seguimiento: 'progreso', nutricion: 'nutricion', videos: 'video', objetivos: 'diana', notas: 'editar', cobros: 'calculadora', datos: 'perfil' };

export function SeccionesFicha({ opciones, valor, alCambiar, etiqueta = 'Secciones de la ficha' }) {
  const caja = useRef(null);
  const [desborda, setDesborda] = useState(false);
  const [todas, setTodas] = useState(false);

  // ¿Caben todas en el ancho de la ficha? (se mide contra la caja, no contra la tira: así no cambia al salir el botón)
  useEffect(() => {
    const el = caja.current;
    const tira = el?.querySelector('.pestanas');
    if (!tira) return undefined;
    const medir = () => setDesborda(tira.scrollWidth > el.clientWidth + 1);
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [opciones.length]);

  // La elegida, centrada en la tira (se mueve solo la tira: la página no salta aunque la tira no esté a la vista)
  useEffect(() => {
    const tira = caja.current?.querySelector('.pestanas');
    const b = tira?.querySelector('[aria-selected="true"]');
    if (!tira || !b || typeof tira.scrollTo !== 'function') return;
    const izq = Math.max(0, b.offsetLeft - (tira.clientWidth - b.offsetWidth) / 2);
    tira.scrollTo({ left: izq, behavior: sinMovimiento() ? 'auto' : 'smooth' });
  }, [valor, desborda]);

  return (
    <div class="ficha-secciones" ref={caja}>
      <Pestanas opciones={opciones} valor={valor} alCambiar={alCambiar} etiqueta={etiqueta} clase="pestanas-atleta" />
      {desborda && (
        <button type="button" class="ficha-todas" aria-haspopup="dialog" aria-expanded={todas ? 'true' : 'false'} onClick={() => setTodas(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z" />
          </svg>
          <span class="sr">Índice de secciones</span>
        </button>
      )}
      {todas && (
        <Hoja titulo="Secciones" alCerrar={() => setTodas(false)} clase="hoja-secciones">
          <ul class="rejilla-secciones">
            {opciones.map(([id, texto]) => (
              <li key={id}>
                <button type="button" class={id === valor ? 'actual' : undefined} aria-current={id === valor ? 'true' : undefined} onClick={() => { setTodas(false); alCambiar(id); }}>
                  <span class="ios-ico"><Icono n={ICONO[id] || 'derecha'} /></span>
                  <span>{texto}</span>
                </button>
              </li>
            ))}
          </ul>
        </Hoja>
      )}
    </div>
  );
}
