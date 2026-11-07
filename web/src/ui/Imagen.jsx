// Una ilustración de la app (logica/imagenes.js). Es decorativa: sin texto alternativo y oculta a los lectores de
// pantalla. No se pinta (y queda `alternativa`, lo que había antes: el dibujo de líneas o nada) si esta construcción no
// lleva imágenes (la demo de un solo archivo), si el móvil tiene el ahorro de datos puesto o si la imagen no carga
// (sin conexión y sin haberla visto antes). Se guarda en el móvil la primera vez que se ve (sw.js: fbe-imagenes) y
// entra fundiéndose de borrosa a nítida (ui/llegada.js). El hueco lo pone quien la usa (la imagen lo llena).
import { useState } from 'preact/hooks';
import { fuenteImagen } from '../logica/imagenes.js';

const CON_IMAGENES = typeof __IMAGENES__ === 'undefined' || __IMAGENES__;
const ahorroDatos = () => typeof navigator !== 'undefined' && !!navigator.connection?.saveData;

export function Imagen({ id, clase = '', tamanos = '100vw', prioridad = false, alternativa = null }) {
  const [falla, setFalla] = useState(null);
  const f = CON_IMAGENES && falla !== id && !ahorroDatos() ? fuenteImagen(id) : null;
  if (!f) return alternativa;
  return (
    <img class={clase} src={f.src} srcset={f.srcset} sizes={tamanos} width={f.ancho} height={f.alto} alt="" aria-hidden="true"
      decoding="async" loading={prioridad ? 'eager' : 'lazy'} fetchpriority={prioridad ? 'high' : undefined} draggable={false}
      data-imagen={id} onError={() => setFalla(id)} />
  );
}
