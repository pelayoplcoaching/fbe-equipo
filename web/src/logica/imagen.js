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
// ¿Merece la pena? Si la nueva pesa más que la original (una foto ya pequeña y muy comprimida), se queda la original,
// salvo que haya que quitarle los EXIF (JPEG y HEIC los llevan): entonces, la nueva siempre
export const quedarseConNueva = ({ tipo, bytesOriginal, bytesNueva }) => /jpe?g|heic|heif/i.test(String(tipo || '')) || bytesNueva < bytesOriginal;

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
export const COLORES_EDITOR = [['#FFFFFF', 'blanco'], ['#111111', 'negro'], ['#E5484D', 'rojo'], ['#F5A524', 'amarillo'], ['#30A46C', 'verde'], ['#3E63DD', 'azul']];
