// (v0.226) El vídeo de técnica en columnas (v0.220), con la parte de escribir debajo del vídeo. Petición de Pelayo: «en la
// versión de ordenador, la parte de escribir y dibujar sobre el vídeo, fijas debajo del mismo». Con sitio (las columnas de
// revision.css), el cuadro de la respuesta, el dibujo pendiente, «Guardar como frase» y las herramientas (dibujar sobre el
// vídeo, comentar el momento, respuestas guardadas…) van en la columna del vídeo, debajo de él; si la columna no cabe
// entera, se quedan pegados abajo, siempre a la vista. La conversación y las frases, a la derecha. En el móvil (las cajas
// no cuentan), todo como siempre: el vídeo, la corrección y el hilo, una cosa debajo de otra.
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useHilo } from '../Hilo.jsx';

// ¿Va en columnas? Lo dice el estilo (las columnas salen con una consulta de contenedor de revision.css): la columna del
// vídeo es una caja de verdad (en el móvil, «display: contents»). Se mira antes de pintar y cada vez que cambia el tamaño.
export function useColumnasRevdos() {
  const ref = useRef(null);
  const [cols, setCols] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const mirar = () => {
      const ver = el.querySelector(':scope > .revdos-in > .revdos-ver');
      setCols(!!ver && getComputedStyle(ver).display !== 'contents');
    };
    mirar();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(mirar);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, cols];
}

// como: la etiqueta de la caja ('article' en «Revisar seguidos»); clase y attrs, los suyos. ver: lo de la columna del vídeo;
// corregir: la corrección; antesHilo y despuesHilo: lo que va con el hilo; hilo: las props del hilo (las de Hilo).
export function RevisionEnColumnas({ como = 'div', clase = '', attrs = null, ver, corregir = null, antesHilo = null, despuesHilo = null, hilo }) {
  const h = useHilo(hilo);
  const [ref, cols] = useColumnasRevdos();
  const Caja = como;
  return (
    <Caja ref={ref} class={`revdos revdos-cols${clase ? ` ${clase}` : ''}`} {...(attrs || {})}>
      <div class="revdos-in">
        <div class="revdos-ver">
          {ver}
          {cols && <div class="hilo hilo-escribir">{h.formulario}{h.guardar}{h.extras}</div>}
        </div>
        <div class="revdos-lado">
          <div class="revdos-corregir">{corregir}</div>
          <div class="revdos-hablar">
            {antesHilo}
            <div class="hilo">{h.mensajes}{!cols && h.formulario}{h.frases}{!cols && h.guardar}{!cols && h.extras}{h.modales}</div>
            {despuesHilo}
          </div>
        </div>
      </div>
    </Caja>
  );
}
