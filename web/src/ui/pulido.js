// Pulido: pequeños comportamientos de toda la app para que responda mejor al dedo. Se instalan una vez al arrancar
// (main.jsx). Los estilos van en pulido.css.

import { instalarAtras } from './atras.js';

let instalado = false;

export function instalarPulido(d = typeof document !== 'undefined' ? document : null) {
  if (!d || instalado) return;
  instalado = true;
  // En iPhone, lo pulsable solo enseña su estado «pulsado» (:active) si la página escucha los toques: con este oyente
  // vacío basta. Pasivo: no frena el scroll.
  d.addEventListener('touchstart', () => {}, { passive: true });
  // El botón «atrás» cierra lo último que se abrió en vez de sacar de la app (atras.js)
  instalarAtras();
}
