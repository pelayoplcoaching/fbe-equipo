// Las fotos antes de enviarlas (v0.56): se reducen y se vuelven a codificar en el móvil (así pesan menos y, de paso, se
// quedan sin los datos EXIF, como la ubicación GPS o el modelo del móvil). Con «HD», más grandes. Lo que no depende del
// navegador: medidas, calidad y qué se puede comprimir. El editor (recortar, girar, dibujar, texto) también usa esto.
export const LADO_NORMAL = 1600;
export const LADO_HD = 2560;
export const CALIDAD_NORMAL = 0.8;
export const CALIDAD_HD = 0.9;

// Las medidas reducidas (el lado largo, como mucho max; nunca se agranda)
export function medidaReducida(ancho, alto, max = LADO_NORMAL) {
  const w = Math.max(1, Math.round(Number(ancho) || 0)), h = Math.max(1, Math.round(Number(alto) || 0));
  const k = Math.min(1, max / Math.max(w, h));
  return { ancho: Math.max(1, Math.round(w * k)), alto: Math.max(1, Math.round(h * k)) };
}
export const opcionesFoto = (hd = false) => ({ lado: hd ? LADO_HD : LADO_NORMAL, calidad: hd ? CALIDAD_HD : CALIDAD_NORMAL });
// ¿Se vuelve a codificar? Las fotos normales sí (JPEG, PNG, WebP, HEIC si el navegador sabe abrirla); un GIF (se movería
// distinto) no
export const comprimible = (tipo) => /^image\/(jpeg|jpg|png|webp|heic|heif|avif)$/i.test(String(tipo || ''));
// El nombre de la foto ya codificada (.jpg)
export const nombreJpg = (nombre) => `${String(nombre || 'foto').replace(/\.[A-Za-z0-9]{1,5}$/, '').slice(0, 80) || 'foto'}.jpg`;
// (revisión) Siempre la nueva, aunque pese más: así nunca sale con los datos de la foto original (EXIF de una JPEG o
// una HEIC, el eXIf o el texto de una PNG, el XMP de una WebP). Solo si pasara del límite de un archivo, la original.
export const quedarseConNueva = ({ bytesNueva, limite = 200 * 1048576 }) => bytesNueva > 0 && bytesNueva <= limite;
export const esJpeg = (tipo) => /^image\/(jpeg|jpg|pjpeg)$/i.test(String(tipo || ''));

// Una JPEG sin sus datos (si el lienzo no ha podido con ella): fuera los bloques APP1 (EXIF y XMP, donde va el GPS),
// APP13 (IPTC), APP3-APP12, APP15 y los comentarios; se quedan JFIF (APP0), el perfil de color (APP2) y Adobe (APP14),
// y la imagen tal cual. Devuelve los bytes limpios o null si no es una JPEG que se entienda.
const QUITAR_JPEG = new Set([0xE1, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xEB, 0xEC, 0xED, 0xEF, 0xFE]);
export function quitarMetadatosJpeg(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (b.length < 4 || b[0] !== 0xFF || b[1] !== 0xD8) return null;
  const trozos = [b.subarray(0, 2)];
  let i = 2;
  while (i + 1 < b.length) {
    if (b[i] !== 0xFF) return null;
    const m = b[i + 1];
    if (m === 0xFF) { i++; continue; }
    if (m === 0xD9) { trozos.push(b.subarray(i, i + 2)); break; }
    if (m === 0xDA) { trozos.push(b.subarray(i)); i = b.length; break; }
    if ((m >= 0xD0 && m <= 0xD7) || m === 0x01) { trozos.push(b.subarray(i, i + 2)); i += 2; continue; }
    if (i + 3 >= b.length) return null;
    const largo = (b[i + 2] << 8) | b[i + 3];
    if (largo < 2 || i + 2 + largo > b.length) return null;
    if (!QUITAR_JPEG.has(m)) trozos.push(b.subarray(i, i + 2 + largo));
    i += 2 + largo;
  }
  if (!trozos.some((t) => t[0] === 0xFF && t[1] === 0xDA)) return null;
  const out = new Uint8Array(trozos.reduce((n, t) => n + t.length, 0));
  let k = 0;
  for (const t of trozos) { out.set(t, k); k += t.length; }
  return out;
}
// ¿Lleva datos que quitar? (EXIF/XMP/IPTC o comentarios)
export function jpegConMetadatos(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let i = 2;
  while (i + 3 < b.length && b[i] === 0xFF) {
    const m = b[i + 1];
    if (m === 0xDA || m === 0xD9) return false;
    if (QUITAR_JPEG.has(m)) return true;
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  return false;
}

// El editor: girar (de 90 en 90), recortar (en proporciones de la foto: { x, y, w, h } de 0 a 1) y lo dibujado
export const girar = (grados, paso = 90) => (((Math.round(Number(grados) || 0) + paso) % 360) + 360) % 360;
// Las medidas de la foto girada
export const medidasGiradas = (ancho, alto, grados) => (grados % 180 === 0 ? { ancho, alto } : { ancho: alto, alto: ancho });
// Un recorte que tiene sentido: dentro de la foto y de al menos el 5 % de cada lado
export function recorteValido(r) {
  if (!r) return { x: 0, y: 0, w: 1, h: 1 };
  const lim = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
  const x = lim(r.x, 0, 0.95), y = lim(r.y, 0, 0.95);
  const w = lim(r.w, 0.05, 1 - x), h = lim(r.h, 0.05, 1 - y);
  return { x, y, w, h };
}
// Mover un borde del recorte con el teclado (o el deslizador): lado 'izq' | 'der' | 'arr' | 'aba', paso en proporción
export function moverBorde(r, lado, paso) {
  const c = recorteValido(r);
  if (lado === 'izq') { const x = Math.max(0, Math.min(c.x + c.w - 0.05, c.x + paso)); return recorteValido({ ...c, x, w: c.w - (x - c.x) }); }
  if (lado === 'der') return recorteValido({ ...c, w: c.w + paso });
  if (lado === 'arr') { const y = Math.max(0, Math.min(c.y + c.h - 0.05, c.y + paso)); return recorteValido({ ...c, y, h: c.h - (y - c.y) }); }
  if (lado === 'aba') return recorteValido({ ...c, h: c.h + paso });
  return c;
}
export const COLORES_EDITOR = [['#FFFFFF', 'blanco'], ['#0E0D15', 'negro'], ['#D45E00', 'rojo'], ['#EC940D', 'amarillo'], ['#06A059', 'verde'], ['#3E63DD', 'azul']];
