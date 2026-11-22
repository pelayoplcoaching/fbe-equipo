// (v0.207) Un trozo de la app que no llega: lo normal es que la app se haya actualizado mientras estaba abierta (los
// trozos llevan su huella en el nombre, y el de la versión anterior ya no está en el servidor). El navegador además
// recuerda el fallo, así que «Reintentar» sin recargar no sirve. Con conexión, la app se recarga sola (como mucho una vez
// cada 10 minutos) y entra con la versión nueva, en la misma pantalla. Sin conexión no: el service worker guarda los
// trozos de la versión anterior unos días, y si aun así falta, «Reintentar» recarga.
export const esFaltaDeTrozo = (e) => /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload|Loading chunk \S+ failed/i.test(String(e?.message || e || ''));
const RECARGA = 'fbe-recarga-trozo', CADA_RECARGA_MS = 10 * 60 * 1000;
export function recargarPorTrozo(e, {
  almacen = (() => { try { return globalThis.sessionStorage; } catch { return null; } })(),
  enLinea = typeof navigator === 'undefined' || navigator.onLine !== false,
  ahora = Date.now(),
  recargar = () => location.reload(),
} = {}) {
  if (!esFaltaDeTrozo(e) || !enLinea || !almacen) return false;
  try {
    if (ahora - (Number(almacen.getItem(RECARGA)) || 0) < CADA_RECARGA_MS) return false;
    almacen.setItem(RECARGA, String(ahora));
  } catch { return false; }
  recargar();
  return true;
}
// «Reintentar» tras un fallo: si es un trozo que falta, recargar (repetir la misma petición fallaría igual)
export const reintentarCarga = (error, otraVez) => { if (esFaltaDeTrozo(error)) location.reload(); else otraVez(); };
