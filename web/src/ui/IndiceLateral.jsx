// (tacto 242, v0.273) Índice lateral en las listas largas (Recetas, Aprende, «Tus entrenamientos»): una tira fina en el
// borde derecho, con las primeras letras de cada capítulo. Arrastrar el pulgar por ella salta de capítulo, con un toque
// en cada uno y su nombre entero en un globo. Solo con el dedo y de adorno para el lector de pantalla (los capítulos
// son títulos: se salta entre ellos como siempre). Sale si hay tres capítulos o más y la lista pasa de dos pantallas.
import { useEffect, useRef, useState } from 'preact/hooks';
import { vibrar } from './hapticos.js';
import { conIndice, indiceEn, cortoDe } from '../logica/indice-lateral.js';

// items: [{ id: el del título al que salta, texto: su nombre }]
export function IndiceLateral({ items }) {
  const raiz = useRef(null);
  const st = useRef({ id: null, k: null }).current;
  const [activo, setActivo] = useState(null);
  const [sale, setSale] = useState(false);
  useEffect(() => {
    const mirar = () => setSale(conIndice(items.length, document.documentElement.scrollHeight, window.innerHeight) && window.matchMedia?.('(pointer: coarse)').matches !== false);
    mirar();
    const t = setTimeout(mirar, 900);
    return () => clearTimeout(t);
  }, [items.map((x) => x.id).join('|')]);
  if (!sale) return null;
  const ir = (y) => {
    const r = raiz.current?.getBoundingClientRect();
    if (!r) return;
    const k = indiceEn(y - r.top, r.height, items.length);
    if (k === st.k) return;
    st.k = k;
    setActivo(k);
    vibrar('toque');
    document.getElementById(items[k].id)?.scrollIntoView({ block: 'start', behavior: 'instant' });
  };
  const baja = (e) => { if (e.button > 0) return; st.id = e.pointerId; st.k = null; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ } ir(e.clientY); };
  const mueve = (e) => { if (e.pointerId === st.id) ir(e.clientY); };
  const sube = (e) => { if (e.pointerId !== st.id) return; st.id = null; st.k = null; setActivo(null); };
  return (
    <div class="ind-raiz" ref={raiz} aria-hidden="true" data-sin-deslizar="" data-coge={activo != null ? '' : undefined}
      onPointerDown={baja} onPointerMove={mueve} onPointerUp={sube} onPointerCancel={sube}>
      {items.map((it, k) => <span key={it.id} class={`ind-letra${k === activo ? ' ind-activa' : ''}`}>{cortoDe(it.texto)}</span>)}
      {activo != null && <span class="ind-globo" style={{ top: `${((activo + 0.5) / items.length) * 100}%` }}>{items[activo].texto}</span>}
    </div>
  );
}
