// «A su medida» (080): la imagen propia de un atleta antes de guardarla. Se reduce en el navegador del coach (la
// apaisada, a 1280 px de lado largo; las cuadradas, recortadas al centro a 960 px) y sale como JPEG dentro de lo que
// admite la base. Al pasar por el lienzo se queda sin los datos del archivo.
import { abrirImagen } from './fotos.js';
import { MAX_IMAGEN, HUECOS } from '../logica/a-medida.js';

const CALIDADES = [0.86, 0.8, 0.72, 0.64, 0.55];
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
const aJpeg = (lienzo) => {
  for (const q of CALIDADES) {
    const d = lienzo.toDataURL('image/jpeg', q);
    if (d.startsWith('data:image/jpeg;base64,') && d.length <= MAX_IMAGEN) return d;
  }
  return null;
};

// Devuelve la data URL o lanza un error que se puede enseñar
export async function prepararImagenPropia(archivo, hueco) {
  if (!archivo || !/^image\//.test(archivo.type || '')) throw new Error('Eso no es una imagen.');
  const cuadrada = (HUECOS.find(([k]) => k === hueco) || [])[2] === 'cuadrada';
  let img;
  try { img = await abrirImagen(archivo); } catch { throw new Error('No se ha podido abrir la imagen. Prueba con otra.'); }
  const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
  if (!w || !h) throw new Error('No se ha podido abrir la imagen. Prueba con otra.');
  try {
    for (const lado of cuadrada ? [960, 800, 640] : [1280, 1024, 800]) {
      let d;
      if (cuadrada) { const c = Math.min(w, h), t = Math.min(lado, c); d = aJpeg(lienzoDe(img, (w - c) / 2, (h - c) / 2, c, c, t, t)); }
      else { const k = Math.min(1, lado / Math.max(w, h)); d = aJpeg(lienzoDe(img, 0, 0, w, h, Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)))); }
      if (d) return d;
    }
    throw new Error('No se ha podido preparar la imagen. Prueba con otra.');
  } finally { img.close?.(); }
}
