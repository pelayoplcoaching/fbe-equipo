// (imágenes, bloque S) Las cabeceras ilustradas del lado del coach: una franja oscura con el texto a la izquierda y la
// ilustración a la derecha (la pieza común .cab-ilu). Sin la imagen (demo de un solo archivo, ahorro de datos), nada.
import { Imagen, hayImagen } from '../Imagen.jsx';

export function CabCoach({ id, titulo, children = null, clase = '' }) {
  if (!hayImagen(id)) return null;
  return (
    <div class={`cab-ilu cab-coach ${clase}`}>
      <div class="cab-ilu-texto pila-xs">
        {titulo && <strong class="cab-coach-t">{titulo}</strong>}
        {children}
      </div>
      <Imagen key={id} id={id} clase="cab-ilu-img" tamanos="(min-width: 720px) 400px, 70vw" />
    </div>
  );
}
