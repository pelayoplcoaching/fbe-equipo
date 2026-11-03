// Las fotos antes de enviarlas (v0.56): se reducen (lado largo 1600 px; con «HD», 2560) y se vuelven a codificar en JPEG
// en el propio móvil. Al pasar por el lienzo se quedan sin los datos EXIF (ubicación GPS, modelo del móvil, la hora). Si
// el navegador no sabe abrirla (una HEIC en Chrome), se envía la original, como siempre.
import { medidaReducida, opcionesFoto, comprimible, nombreJpg, quedarseConNueva } from '../logica/imagen.js';

export async function abrirImagen(archivo) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(archivo, { imageOrientation: 'from-image' }); } catch { /* lo intenta con <img> */ }
  }
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
export const lienzoABlob = (lienzo, tipo = 'image/jpeg', calidad = 0.8) => new Promise((ok, mal) => {
  try { lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('No se ha podido preparar la foto'))), tipo, calidad); } catch (e) { mal(e); }
});
// Devuelve { archivo, comprimida, ancho, alto }: la foto lista para enviar (o la original, si no se ha podido)
export async function prepararFoto(archivo, { hd = false } = {}) {
  if (!archivo || !comprimible(archivo.type)) return { archivo, comprimida: false };
  try {
    const img = await abrirImagen(archivo);
    const w0 = img.width || img.naturalWidth, h0 = img.height || img.naturalHeight;
    if (!w0 || !h0) return { archivo, comprimida: false };
    const { lado, calidad } = opcionesFoto(hd);
    const { ancho, alto } = medidaReducida(w0, h0, lado);
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho; lienzo.height = alto;
    const c2 = lienzo.getContext('2d');
    c2.fillStyle = '#FFFFFF';
    c2.fillRect(0, 0, ancho, alto);
    c2.drawImage(img, 0, 0, ancho, alto);
    img.close?.();
    const blob = await lienzoABlob(lienzo, 'image/jpeg', calidad);
    if (!quedarseConNueva({ tipo: archivo.type, bytesOriginal: archivo.size, bytesNueva: blob.size })) return { archivo, comprimida: false };
    return { archivo: new File([blob], nombreJpg(archivo.name), { type: 'image/jpeg' }), comprimida: true, ancho, alto };
  } catch { return { archivo, comprimida: false }; }
}
