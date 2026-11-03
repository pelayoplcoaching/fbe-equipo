// Las fotos antes de enviarlas (v0.56): se reducen (lado largo 1600 px; con «HD», 2560) y se vuelven a codificar en JPEG
// en el propio móvil. Al pasar por el lienzo se quedan sin los datos EXIF (ubicación GPS, modelo del móvil, la hora). Si
// el navegador no sabe abrirla (una HEIC en Chrome), se envía la original, como siempre.
import { medidaReducida, opcionesFoto, comprimible, nombreJpg, quedarseConNueva, esJpeg, quitarMetadatosJpeg } from '../logica/imagen.js';

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
// Devuelve { archivo, limpia, comprimida, ancho, alto }: la foto lista para enviar. limpia: sin los datos de la original
// (vuelta a guardar en el lienzo o, si no se ha podido, una JPEG con sus bloques EXIF/XMP/IPTC quitados). Si no hay
// forma de limpiarla (una HEIC que el navegador no sabe abrir, un GIF), la original con limpia: false (la app avisa).
export async function prepararFoto(archivo, { hd = false } = {}) {
  if (!archivo || !/^image\//.test(archivo.type || '')) return { archivo, limpia: true, comprimida: false };
  if (comprimible(archivo.type)) {
    try {
      const img = await abrirImagen(archivo);
      const w0 = img.width || img.naturalWidth, h0 = img.height || img.naturalHeight;
      if (w0 && h0) {
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
        if (quedarseConNueva({ bytesNueva: blob.size })) return { archivo: new File([blob], nombreJpg(archivo.name), { type: 'image/jpeg' }), limpia: true, comprimida: true, ancho, alto };
      }
    } catch { /* abajo: la JPEG se limpia a mano */ }
  }
  if (esJpeg(archivo.type)) {
    try {
      const limpia = quitarMetadatosJpeg(new Uint8Array(await archivo.arrayBuffer()));
      if (limpia) return { archivo: new File([limpia], archivo.name || 'foto.jpg', { type: 'image/jpeg' }), limpia: true, comprimida: false };
    } catch { /* */ }
  }
  return { archivo, limpia: false, comprimida: false };
}
