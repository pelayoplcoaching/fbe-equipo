// (diseño) Las piezas secundarias del equipo («Próximos», «Compañeros de racha», los recuentos), plegadas para que el
// muro empiece por las publicaciones. Cerrada, cada una es una pastilla en una fila con las demás; abierta, ocupa todo
// el ancho, debajo de las pastillas, con su contenido tal cual era. Este móvil recuerda cómo se deja cada una
// (fbe-equipo-abierta-<id>). Lo de dentro sigue en la página aunque esté cerrada. Si no pinta nada, la pastilla no sale.
// Estilos en diseno.css, bloque 19.
//   cuenta: selector de lo que hay que contar dentro para ponerlo en la pastilla («Próximos · 2»)
//   abiertaDeEntrada: sale abierta hasta que se cierra (los recuentos del mes, que solo duran una semana)
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icono, usePreferencia } from './comunes.jsx';

export function PlegableEquipo({ id, titulo, icono, cuenta = null, abiertaDeEntrada = false, children }) {
  const [abierta, setAbierta] = usePreferencia(`fbe-equipo-abierta-${id}`, abiertaDeEntrada);
  const cuerpo = useRef(null);
  const [vacia, setVacia] = useState(true);
  const [n, setN] = useState(0);
  useLayoutEffect(() => {
    const el = cuerpo.current;
    if (!el) return undefined;
    const mirar = () => { setVacia(el.childElementCount === 0); if (cuenta) setN(el.querySelectorAll(cuenta).length); };
    mirar();
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(mirar) : null;
    mo?.observe(el, { childList: true, subtree: !!cuenta });
    return () => mo?.disconnect();
  }, [cuenta]);
  return (
    <details class="plegable-eq" data-plegable-eq={id} open={abierta} hidden={vacia} onToggle={(ev) => { const o = ev.currentTarget.open; if (o !== abierta) setAbierta(o); }}>
      <summary>
        <Icono n={icono} class="plegable-eq-ico" />
        <span class="plegable-eq-t">{titulo}</span>
        {n > 0 && <span class="plegable-eq-n num" aria-hidden="true">{n}</span>}
        <Icono n="abajo" class="plegable-eq-flecha" />
      </summary>
      <div class="plegable-eq-cuerpo" ref={cuerpo}>{children}</div>
    </details>
  );
}
