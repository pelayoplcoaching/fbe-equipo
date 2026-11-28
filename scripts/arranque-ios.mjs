// (belleza 351, v0.288) Las imágenes de arranque de iOS (iPhone y iPad con la app instalada). Sin ellas, entre tocar el
// icono y la portada hay un instante en blanco. iOS solo usa la que coincide exactamente con la pantalla (ancho, alto y
// densidad), así que va una por tamaño; cada una es un PNG de un solo color (la noche de la portada), hecho al construir.
import { deflateSync, crc32 } from 'node:zlib';

// [ancho, alto, densidad, también apaisada] en puntos, en vertical. iPhone 8 al 17 y iPad (mini, 9.7 a 13 pulgadas).
export const PANTALLAS_IOS = [
  [375, 667, 2, false], [414, 736, 3, false], [375, 812, 3, false], [414, 896, 2, false], [414, 896, 3, false], [390, 844, 3, false],
  [428, 926, 3, false], [393, 852, 3, false], [430, 932, 3, false], [402, 874, 3, false], [440, 956, 3, false], [420, 912, 3, false],
  [744, 1133, 2, true], [768, 1024, 2, true], [810, 1080, 2, true], [820, 1180, 2, true], [834, 1112, 2, true], [834, 1194, 2, true], [1024, 1366, 2, true],
];

// Un PNG liso: con paleta de un solo color (8 bits por punto, todos el 0), que comprimido se queda en unos pocos KB
export function pngLiso(ancho, alto, hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m || !(ancho > 0) || !(alto > 0)) throw new Error(`pngLiso: ${ancho}x${alto} ${hex}`);
  const trozo = (tipo, datos) => {
    const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
    const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
    const suma = Buffer.alloc(4); suma.writeUInt32BE(crc32(cuerpo) >>> 0);
    return Buffer.concat([largo, cuerpo, suma]);
  };
  const cab = Buffer.alloc(13);
  cab.writeUInt32BE(ancho, 0); cab.writeUInt32BE(alto, 4); cab[8] = 8; cab[9] = 3; // 8 bits, con paleta
  const puntos = deflateSync(Buffer.alloc((1 + ancho) * alto), { level: 9 });
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo('IHDR', cab), trozo('PLTE', Buffer.from([1, 2, 3].map((i) => parseInt(m[i], 16)))), trozo('IDAT', puntos), trozo('IEND', Buffer.alloc(0))]);
}
