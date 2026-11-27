// (tacto 206, v0.272) Lo delicado se confirma manteniendo pulsado: el botón se va llenando y, al segundo, hace lo suyo sin
// preguntar. Un toque corto (y el teclado, y el lector de pantalla) abre la pregunta de siempre: nadie se queda sin poder.
import { useEffect, useRef, useState } from 'preact/hooks';
import { vibrar } from './hapticos.js';

export const MANTENER_MS = 1000;

// alConfirmar(): tras mantenerlo pulsado un segundo; alPreguntar(): con un toque, con el teclado o con el lector de pantalla
export function BotonMantener({ clase = '', alConfirmar, alPreguntar, deshabilitado = false, children }) {
  const [llena, setLlena] = useState(false);
  const t = useRef(null), hecho = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);
  const baja = (e) => {
    if (e.button > 0 || deshabilitado) return;
    clearTimeout(t.current);
    setLlena(true);
    t.current = setTimeout(() => { hecho.current = Date.now(); setLlena(false); vibrar('hecho'); alConfirmar(); }, MANTENER_MS);
  };
  const sube = () => { clearTimeout(t.current); setLlena(false); };
  // (el clic que llega al soltar tras confirmar no vuelve a preguntar)
  const clic = () => { if (Date.now() - hecho.current > 800) alPreguntar(); };
  return (
    <button type="button" class={`mnt-boton ${clase}`} data-llena={llena ? '' : undefined} disabled={deshabilitado} title="Mantenlo pulsado un segundo para hacerlo sin preguntar"
      onPointerDown={baja} onPointerUp={sube} onPointerLeave={sube} onPointerCancel={sube} onClick={clic} onContextMenu={(e) => e.preventDefault()}>
      <span class="mnt-fondo" aria-hidden="true" />{children}
    </button>
  );
}
