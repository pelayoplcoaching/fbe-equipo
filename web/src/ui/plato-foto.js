// La foto del plato antes de subirla (v0.174): se reduce en el propio móvil (lado largo 1024 px) y se saca su miniatura
// cuadrada (160 px). Al pasar por el lienzo se queda sin los datos de la cámara (ubicación, modelo, hora).
import { abrirImagen } from './fotos.js';
import { LADO_FOTO, LADO_MINI, MAX_FOTO, MAX_MINI } from '../logica/platos.js';

const CALIDADES = [0.8, 0.72, 0.64, 0.55, 0.45];
function lienzoDe(img, x, y, w, h, ancho, alto) {
  const l = document.createElement('canvas');
  l.width = ancho; l.height = alto;
  const c = l.getContext('2d');
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, ancho, alto);
  c.imageSmoothingQuality = 'high';
  c.drawImage(img, x, y, w, h, 0, 0, ancho, alto);
  return l;
}
const aJpeg = (lienzo, max) => {
  for (const q of CALIDADES) {
    const d = lienzo.toDataURL('image/jpeg', q);
    if (d.startsWith('data:image/jpeg;base64,') && d.length <= max) return d;
  }
  return null;
};

// Devuelve { foto, mini } (dos data URL JPEG) o lanza un error que se puede enseñar
export async function prepararPlato(archivo) {
  if (!archivo || !/^image\//.test(archivo.type || '')) throw new Error('Eso no es una foto.');
  let img;
  try { img = await abrirImagen(archivo); } catch { throw new Error('No se ha podido abrir la foto. Prueba con otra.'); }
  const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
  if (!w || !h) throw new Error('No se ha podido abrir la foto. Prueba con otra.');
  try {
    let foto = null;
    for (const lado of [LADO_FOTO, 800, 640]) {
      const k = Math.min(1, lado / Math.max(w, h));
      foto = aJpeg(lienzoDe(img, 0, 0, w, h, Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))), MAX_FOTO);
      if (foto) break;
    }
    const c = Math.min(w, h);
    const mini = aJpeg(lienzoDe(img, (w - c) / 2, (h - c) / 2, c, c, LADO_MINI, LADO_MINI), MAX_MINI);
    if (!foto || !mini) throw new Error('No se ha podido preparar la foto. Prueba con otra.');
    return { foto, mini };
  } finally { img.close?.(); }
}
