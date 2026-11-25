// FBE Esencial (v0.244): la ilustración de cada tarjeta propia de quien va por su cuenta (logica/esencial-arte.js). Va en
// un módulo aparte para que su lista de archivos (datos/imagenes-esencial.json) y sus estilos (esencial-arte.css) viajen
// con los trozos de FBE Esencial y no con el arranque. Sin la imagen (aún no ha llegado, ahorro de datos, la demo de un
// solo archivo o no carga), no pinta nada: la tarjeta se queda como estaba.
import { useState } from 'preact/hooks';
import LISTA from '../../datos/imagenes-esencial.json';
import { anadirImagenes, fuenteImagen } from '../../logica/imagenes.js';
import { hayImagen } from '../Imagen.jsx';

anadirImagenes(LISTA);

export const hayArte = (id) => !!id && hayImagen(id);

function Foto({ id, tamanos, alFallar }) {
  const f = fuenteImagen(id);
  return (
    <img class="esa-img" src={f.src} srcset={f.srcset} sizes={tamanos} width={f.ancho} height={f.alto} alt="" aria-hidden="true"
      decoding="async" loading="lazy" draggable={false} data-imagen={id} onError={alFallar} />
  );
}

// La franja de arriba de una tarjeta o de una hoja (en una «nota-coach», que es una rejilla de icono y texto, ocupa las dos
// columnas). alta: a 16:9 (entera) en vez de a 5:2.
export function Arte({ id, alta = false, tamanos = '(min-width: 720px) 640px, 100vw' }) {
  const [falla, setFalla] = useState(null);
  if (!hayArte(id) || falla === id) return null;
  const foto = <Foto id={id} tamanos={tamanos} alFallar={() => setFalla(id)} />;
  if (alta) return <span class="esa-franja esa-franja-alta">{foto}</span>;
  return <span class="esa-franja">{foto}</span>;
}

// Dos, lado a lado (las dos se ven o ninguna)
export function ArteDuo({ ids }) {
  const [falla, setFalla] = useState(false);
  if (falla || !ids.every(hayArte)) return null;
  return (
    <span class="esa-duo">
      {ids.map((id) => <span key={id} class="esa-franja esa-franja-alta"><Foto id={id} tamanos="(min-width: 720px) 320px, 46vw" alFallar={() => setFalla(true)} /></span>)}
    </span>
  );
}
