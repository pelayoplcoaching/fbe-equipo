// (tacto 220, v0.272) Actualizar la app sin pantallazo: al tocar «Actualizar», la pantalla se funde con la noche de la
// portada (la misma con la que abre la app, así que la recarga no da un fogonazo blanco) y, al volver, se está en la
// misma pestaña (la lleva la dirección) y a la misma altura. Llega al tocar «Actualizar» y, tras recargar, solo si hay
// algo que devolver.
import { sinMovimiento } from './transiciones.js';

const CLAVE = 'fbe-vuelta';
// La noche de la portada (scripts/portada.mjs: FONDO_PORTADA y su luz)
const NOCHE = 'radial-gradient(64% 44% at 50% 40%, rgba(96, 68, 228, .5), transparent 72%) #1E1548';

// Antes de recargar: apunta la altura y funde a la noche. Se cumple cuando ya se puede recargar
export function cubrir() {
  try { sessionStorage.setItem(CLAVE, JSON.stringify({ y: Math.round(window.scrollY), ruta: location.hash, t: Date.now() })); } catch { /* sin almacenamiento: vuelve arriba */ }
  return new Promise((ok) => {
    const d = document.createElement('div');
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = `position:fixed;inset:0;z-index:2147483000;background:${NOCHE}`;
    document.body.appendChild(d);
    if (sinMovimiento() || !d.animate) { ok(); return; }
    let hecho = false;
    const ya = () => { if (!hecho) { hecho = true; ok(); } };
    try { d.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' }).onfinish = ya; } catch { ya(); }
    setTimeout(ya, 400);
  });
}

// Tras recargar: lo apuntado (una vez; si es de hace más de medio minuto o de otra pantalla, no vale)
export function vueltaPendiente(ahora = Date.now(), ruta = typeof location !== 'undefined' ? location.hash : '') {
  let v = null;
  try { v = JSON.parse(sessionStorage.getItem(CLAVE) || 'null'); sessionStorage.removeItem(CLAVE); } catch { v = null; }
  return v && Number.isFinite(v.y) && v.y > 0 && ahora - v.t < 30000 && v.ruta === ruta ? v.y : 0;
}
// Vuelve a esa altura en cuanto la pantalla tiene ese alto (como mucho, cuatro segundos de espera)
export function volver() {
  const y = vueltaPendiente();
  if (!y) return;
  const fin = Date.now() + 4000;
  const mirar = () => {
    if (document.documentElement.scrollHeight - window.innerHeight >= y - 4 || Date.now() > fin) { window.scrollTo(0, y); return; }
    setTimeout(mirar, 120);
  };
  setTimeout(mirar, 200);
}
