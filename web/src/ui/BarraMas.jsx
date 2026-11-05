// La pestaña «Más» de la barra de abajo en el móvil y la hoja con las secciones que no caben en la barra.
// El reparto (qué va en la barra y qué en «Más») está en logica/pestanas.js.
import { useEffect, useState } from 'preact/hooks';
import { Icono, Insignia, Hoja, FilaIos } from './comunes.jsx';

// Pantalla estrecha (móvil): por debajo de 700 px, igual que el resto de la app
export function useEstrecha(px = 699) {
  const consulta = `(max-width: ${px}px)`;
  const [estrecha, setEstrecha] = useState(() => (typeof matchMedia === 'function' ? matchMedia(consulta).matches : true));
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined;
    const m = matchMedia(consulta);
    const al = () => setEstrecha(m.matches);
    al();
    if (m.addEventListener) m.addEventListener('change', al); else m.addListener(al);
    return () => { if (m.removeEventListener) m.removeEventListener('change', al); else m.removeListener(al); };
  }, [consulta]);
  return estrecha;
}

// El quinto hueco de la barra. activa: la sección que se ve es una de las de dentro. n: lo nuevo que hay dentro (número);
// punto: hay algo pendiente dentro que no se cuenta (el check-in).
export function BotonMas({ activa = false, abierta = false, n = 0, punto = false, etiqueta, alAbrir }) {
  return (
    <button class="tab tab-mas" aria-current={activa ? 'page' : undefined} aria-haspopup="dialog" aria-expanded={abierta ? 'true' : 'false'} onClick={alAbrir}>
      <span class={`tab-ico ${punto && !n ? 'punto' : ''}`}><Icono n="opciones" class="ico-opciones" /><Insignia n={n} etiqueta={etiqueta} /></span>
      Más{punto && !n ? <span class="sr"> (tienes algo pendiente)</span> : null}
    </button>
  );
}

// pestanas: las que van en «Más»; detalles: { id: una línea que dice qué hay }; valores: { id: lo que va a la derecha }
export function HojaMas({ pestanas, actual, detalles = {}, valores = {}, alElegir, alCerrar }) {
  return (
    <Hoja titulo="Más" alCerrar={alCerrar} clase="hoja-mas">
      <div class="panel grupo-ios-hoja">
        <ul class="lista">
          {pestanas.map(([id, texto, icono]) => (
            <FilaIos key={id} icono={icono} titulo={texto} detalle={detalles[id]} valor={valores[id] ?? null} alTocar={() => alElegir(id)} clase={`mas-fila ${id === actual ? 'mas-actual' : ''}`} />
          ))}
        </ul>
      </div>
    </Hoja>
  );
}
