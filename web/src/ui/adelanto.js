// (belleza 363, v0.288) Mientras se ve la portada, la app adelanta trabajo: el fondo de la bienvenida de esta hora se pide
// ya (en cuanto llega la lista de ilustraciones, a la vez que se resuelve la cuenta), para que al irse la portada no falte.
// La imagen se guarda en el móvil la primera vez (sw.js), así que después esto no gasta red. No se pide con el ahorro de
// datos puesto, ni si este móvil lo usa el coach (su app no la lleva). La app del coach ya se adelantaba (ui/App.jsx).
import { fuenteImagen, imagenBienvenida } from '../logica/imagenes.js';
import { hoyISO } from '../logica/fechas.js';

const CON_IMAGENES = typeof __IMAGENES__ === 'undefined' || __IMAGENES__;

export function adelantarBienvenida(ahora = new Date()) {
  try {
    if (!CON_IMAGENES || typeof Image === 'undefined' || navigator.connection?.saveData) return null;
    if (localStorage.getItem('fbe-ultimo-rol') === 'coach') return null;
    const f = fuenteImagen(imagenBienvenida(ahora.getHours(), hoyISO(ahora)));
    if (!f) return null;
    const img = new Image();
    img.decoding = 'async';
    img.sizes = '100vw';
    if (f.srcset) img.srcset = f.srcset;
    img.src = f.src;
    return img;
  } catch { return null; }
}
