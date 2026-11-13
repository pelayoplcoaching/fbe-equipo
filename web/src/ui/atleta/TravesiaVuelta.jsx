// «La travesía» (remate, tanda 7): «La vuelta a casa». En el resumen de la sesión, si ha jugado en los descansos, su lobo
// vuelve a la guarida bajo el cielo de esa hora, con lo que ha corrido hoy. Se puede compartir como imagen (sin nombres)
import { useEffect, useRef, useState } from 'preact/hooks';
import { pintarVuelta } from './travesia-pinta.js';
import { textoDistancia, ambiente } from '../../logica/travesia.js';
import { loboElegido } from '../../logica/travesia-ruta.js';
import { leerTravesia } from '../travesia.js';
import { leerAjustes } from '../ajustes.js';
import { compartirArchivo, conFranja } from './travesia-compartir.js';

const DURA = 2.6;   // segundos que tarda en llegar
const quieto = () => typeof matchMedia !== 'function' || !matchMedia('(prefers-reduced-motion: no-preference)').matches;

export function VueltaACasa({ atletaId, metros, estrellas = 0 }) {
  const ref = useRef(null);
  const [estado, setEstado] = useState(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return undefined;
    const guardado = leerTravesia(atletaId);
    const amb = ambiente({ total: guardado.total || 0 });
    const skin = loboElegido(guardado, leerAjustes().loboJuego);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 320, h = Math.round(w * 0.42);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cuadro = (k, t) => pintarVuelta(c, { w, h, k, t, fase: amb.fase, paisaje: amb.paisaje, skin });
    if (quieto()) { cuadro(1, 0); return undefined; }
    let raf = 0, t0 = 0, visto = false;
    const paso = (ms) => {
      t0 ||= ms; const t = (ms - t0) / 1000;
      cuadro(Math.min(1, t / DURA), t);
      if (t < DURA) raf = requestAnimationFrame(paso);
    };
    cuadro(0, 0);
    // empieza a andar cuando se ve (el resumen es largo)
    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !visto) { visto = true; raf = requestAnimationFrame(paso); io.disconnect(); }
    }, { threshold: 0.5 }) : null;
    if (io) io.observe(cv); else raf = requestAnimationFrame(paso);
    return () => { cancelAnimationFrame(raf); io?.disconnect(); };
  }, [atletaId]);
  const compartir = async () => {
    try {
      const como = await compartirArchivo(await conFranja(ref.current, `De vuelta a casa · ${textoDistancia(metros)}`), 'la-vuelta-a-casa.png');
      setEstado(como === 'guardada' ? 'Imagen guardada' : null);
    } catch (e) { if (e?.name !== 'AbortError') setEstado('No se ha podido preparar la imagen'); }
  };
  return (
    <figure class="tv-vuelta">
      <canvas ref={ref} class="tv-vuelta-lienzo" role="img" aria-label={`Tu lobo vuelve a casa tras recorrer ${textoDistancia(metros)} en los descansos`} />
      <figcaption class="tv-vuelta-pie">
        <span>De vuelta a casa: <strong class="num">{textoDistancia(metros)}</strong>{estrellas > 0 ? ` y ${estrellas} ${estrellas === 1 ? 'estrella' : 'estrellas'}` : ''} en los descansos.</span>
        <button type="button" class="btn btn-peq" onClick={compartir}>Compartir</button>
      </figcaption>
      {estado && <p class="secundario" role="status">{estado}</p>}
    </figure>
  );
}
