// Un interruptor en una fila (ajustes, notificaciones, ordenar Hoy…). (v0.207) En su propio archivo: así quien lo usa no
// arrastra la hoja de ajustes entera (y las notas de voz) al abrir la app.
import { IcoIos } from './comunes.jsx';

// icono (v0.50): con él, la fila lleva su cuadrito a la izquierda, como el resto de la lista agrupada
export function Interruptor({ id, texto, ayuda, valor, alCambiar, desactivado = false, icono = null, tono = '' }) {
  return (
    <li class={`panel-pad interruptor-fila${icono ? ' fila-ios con-ico' : ''}`}>
      {icono && <IcoIos n={icono} tono={tono} />}
      <label for={id} class="pila-xs"><span>{texto}</span>{ayuda && <span class="peq terciario">{ayuda}</span>}</label>
      <input id={id} type="checkbox" role="switch" class="interruptor" checked={valor} disabled={desactivado} onChange={(e) => alCambiar(e.currentTarget.checked)} />
    </li>
  );
}
