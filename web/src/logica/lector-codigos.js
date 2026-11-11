// Leer un código de barras de producto (EAN-13, EAN-8, UPC-A y UPC-E) de un fotograma de la cámara, sin red.
// Usa el lector de ZXing (@zxing/library, Apache-2.0; licencia en licencias/zxing-LICENSE.txt), importando solo sus
// piezas de códigos de producto (unos 60 KB, no la librería entera de 450). Este módulo se carga aparte, solo al abrir el
// escáner, y solo cuando el navegador no trae su propio lector (BarcodeDetector, que Safari no tiene).
import MultiFormatUPCEANReader from '@zxing/library/esm/core/oned/MultiFormatUPCEANReader.js';
import BarcodeFormat from '@zxing/library/esm/core/BarcodeFormat.js';
import DecodeHintType from '@zxing/library/esm/core/DecodeHintType.js';
import RGBLuminanceSource from '@zxing/library/esm/core/RGBLuminanceSource.js';
import BinaryBitmap from '@zxing/library/esm/core/BinaryBitmap.js';
import HybridBinarizer from '@zxing/library/esm/core/common/HybridBinarizer.js';

const PISTAS = new Map([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
  [DecodeHintType.TRY_HARDER, true],
]);
const lector = new MultiFormatUPCEANReader(PISTAS);

// gris: Uint8ClampedArray de w × h con la luminancia (0–255) de cada píxel. Devuelve el texto del código o null.
export function leerGris(gris, w, h) {
  try {
    const fuente = new RGBLuminanceSource(gris, w, h);
    return lector.decode(new BinaryBitmap(new HybridBinarizer(fuente)), PISTAS).getText();
  } catch { return null; }
  finally { try { lector.reset(); } catch { /* nada */ } }
}

// De los píxeles RGBA de un canvas a luminancia (con los pesos habituales, en enteros)
export function grisDeRGBA(rgba, w, h) {
  const g = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
  return g;
}
