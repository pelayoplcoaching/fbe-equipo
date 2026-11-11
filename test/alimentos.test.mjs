// Escáner de productos (Open Food Facts): el código, lo que devuelve la base, lo que suman los gramos, los recientes,
// lo que se muestra y el lector de códigos de barras con un código dibujado.
import { codigoValido, limpiarCodigo, urlProducto, urlBusqueda, productoDeOFF, leerRespuestaProducto, leerRespuestaBusqueda, macrosDeCantidad,
  cantidadInicial, sumarAlDia, totalSumado, textoSumado, textoPor100, conReciente, recientesValidos, MAX_RECIENTES } from '../web/src/logica/alimentos.js';
import { productoPorCodigo, buscarProductos, PRODUCTOS_DEMO } from '../web/src/datos/productos.js';
import * as esbuild from 'esbuild';
import { readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('El código de barras');
check(codigoValido('8410188012092'), 'un EAN-13 de verdad vale');
check(codigoValido('5449000000996'), 'otro EAN-13 vale');
check(codigoValido('96385074'), 'un EAN-8 vale');
check(codigoValido('036000291452'), 'un UPC-A (12) vale');
check(!codigoValido('8410188012093'), 'con el dígito de control mal, no');
check(!codigoValido('12345') && !codigoValido('abcdefghijklm') && !codigoValido(null), 'corto, con letras o vacío, no');
check(limpiarCodigo(' 8410 188-012092 ') === '8410188012092', 'fuera espacios y guiones');
check(PRODUCTOS_DEMO.every((p) => codigoValido(p.code)), 'los códigos de la demo son válidos');
check(urlProducto('8410188012092').startsWith('https://world.openfoodfacts.org/api/v2/product/8410188012092.json?fields='), 'la dirección del producto');
check(urlBusqueda('yogur & miel').includes('search_terms=yogur%20%26%20miel') && urlBusqueda('x').includes('json=1'), 'la búsqueda va codificada y en JSON');

console.log('Lo que devuelve Open Food Facts');
const yogur = productoDeOFF({ code: '8410188012092', product_name: '  Yogur   griego ', product_name_es: 'Yogur griego natural', brands: 'Marca A, Marca B', quantity: '4 x 125 g', serving_quantity: '125', serving_size: '125 g',
  nutriments: { 'energy-kcal_100g': 97.4, proteins_100g: 3.6, carbohydrates_100g: 4, fat_100g: 7.6, fiber_100g: 0 }, image_front_small_url: 'https://images.openfoodfacts.org/images/products/841/018/801/2092/front_es.3.200.jpg' });
check(yogur.nombre === 'Yogur griego natural' && yogur.marca === 'Marca A', 'el nombre en español y la primera marca');
check(igual(yogur.por100, { kcal: 97, proteina_g: 3.6, carbos_g: 4, grasa_g: 7.6, fibra_g: 0 }), 'los valores por 100 g, redondeados');
check(yogur.racion_g === 125 && yogur.unidad === 'g' && yogur.imagen?.startsWith('https://images.openfoodfacts.org/'), 'la ración, la unidad y la foto');
const kj = productoDeOFF({ code: '1', product_name: 'Galletas', nutriments: { energy_100g: 2092, proteins_100g: 6 } });
check(kj.por100.kcal === 500, 'solo en kJ: se pasa a kcal (2092 kJ = 500 kcal)');
const racion = productoDeOFF({ product_name: 'Barrita', serving_quantity: 40, nutriments: { 'energy-kcal_serving': 160, proteins_serving: 8 } });
check(racion.por100.kcal === 400 && racion.por100.proteina_g === 20, 'solo por ración: se pasa a 100 g');
const leche = productoDeOFF({ product_name: 'Leche', quantity: '1 l', nutriments: { 'energy-kcal_100g': 46, proteins_100g: 3.1 } });
check(leche.unidad === 'ml', 'los líquidos van en ml');
check(productoDeOFF({ product_name: 'Agua', nutriments: {} }) === null, 'sin kcal ni proteína, no sirve');
check(productoDeOFF({ product_name: 'Raro', nutriments: { 'energy-kcal_100g': 5000, proteins_100g: 150 } }) === null, 'valores imposibles, fuera');
check(productoDeOFF({ product_name: 'X', nutriments: { 'energy-kcal_100g': 50 }, image_front_small_url: 'javascript:alert(1)' }).imagen === null, 'una foto que no es de Open Food Facts, fuera');
check(productoDeOFF({ nutriments: { 'energy-kcal_100g': 50 } }).nombre === 'Producto sin nombre', 'sin nombre, uno genérico');
check(productoDeOFF({ product_name: 'x'.repeat(500), nutriments: { proteins_100g: 10 } }).nombre.length === 120, 'el nombre, con un tope');
check(leerRespuestaProducto({ status: 0 }) === null && leerRespuestaProducto(null) === null, 'no está: null');
check(leerRespuestaProducto({ status: 1, product: { product_name: 'Pan', nutriments: { 'energy-kcal_100g': 250 } } })?.nombre === 'Pan', 'está: el producto');
const lista = leerRespuestaBusqueda({ products: [{ code: '1', product_name: 'A', nutriments: { 'energy-kcal_100g': 1 } }, { code: '1', product_name: 'A bis', nutriments: { 'energy-kcal_100g': 1 } }, { code: '2', product_name: 'Sin datos', nutriments: {} }] });
check(lista.length === 1 && lista[0].nombre === 'A', 'la búsqueda: sin repetidos y sin los que no traen datos');
check(igual(leerRespuestaBusqueda({}), []), 'una búsqueda rara, vacía');

console.log('Lo que suman los gramos');
check(igual(macrosDeCantidad(yogur, 125), { kcal: 121, proteina_g: 4.5, carbos_g: 5, grasa_g: 9.5, fibra_g: 0 }), '125 g de yogur');
check(macrosDeCantidad(yogur, 0) === null && macrosDeCantidad(yogur, 5000) === null && macrosDeCantidad(yogur, 'x') === null, 'cantidades imposibles, nada');
check(macrosDeCantidad(kj, 30).carbos_g === null, 'lo que no trae, sigue vacío');
check(cantidadInicial(yogur) === 125 && cantidadInicial(kj) === 100, 'propone la ración o, si no, 100');
const dia = { kcal: null, proteina_g: 20, carbos_g: null, grasa_g: null, fibra_g: null, nota: 'x' };
const tras = sumarAlDia(dia, macrosDeCantidad(yogur, 125), ['kcal', 'proteina_g']);
check(tras.kcal === 121 && tras.proteina_g === 25 && tras.carbos_g === null && tras.nota === 'x', 'suma solo a los campos que se ven, en enteros');
check(sumarAlDia(tras, macrosDeCantidad(yogur, 125), ['kcal', 'proteina_g'], -1).kcal === 0, 'quitar resta (y nunca baja de 0)');
check(igual(totalSumado([{ m: { kcal: 121, proteina_g: 4.5 } }, { m: { kcal: 40, proteina_g: null } }]), { kcal: 161, proteina_g: 4.5 }), 'el total de lo sumado');
check(textoSumado({ kcal: 121, proteina_g: 4.5 }, 125) === '125 g · 121 kcal · 4,5 g prot.', 'la línea de lo sumado');
check(textoPor100(yogur) === 'Por 100 g: 97 kcal · P 3,6 · H 4 · G 7,6', 'la línea por 100 g');
check(textoPor100(leche).startsWith('Por 100 ml'), 'en ml, por 100 ml');

console.log('Los recientes');
let rec = [];
for (let i = 0; i < 15; i++) rec = conReciente(rec, { ...yogur, codigo: String(i), nombre: `P${i}` }, 100 + i);
check(rec.length === MAX_RECIENTES && rec[0].nombre === 'P14' && rec[0].ultima_g === 114, 'el más nuevo primero, con su cantidad, y como mucho 12');
rec = conReciente(rec, { ...yogur, codigo: '5', nombre: 'P5' }, 50);
check(rec[0].codigo === '5' && rec.filter((x) => x.codigo === '5').length === 1, 'sin repetir: el que vuelve sube arriba');
check(igual(recientesValidos('basura'), []) && recientesValidos([{ nombre: 1 }, null, { nombre: 'Ok', por100: { kcal: 1 }, imagen: 'https://x' }]).length === 1, 'lo leído del móvil, revisado');
check(recientesValidos([{ nombre: 'Ok', por100: { kcal: 1 }, imagen: 'https://images.openfoodfacts.org/a.jpg' }])[0].imagen === null, 'sin fotos (se ven sin red)');

console.log('La demo, sin red');
const demo = { modo: 'demo' };
check((await productoPorCodigo(demo, '2000000000039'))?.nombre === 'Copos de avena (demo)', 'por código');
check((await productoPorCodigo(demo, '2000000000053')) === null, 'un código que no está: null');
let malo = false; try { await productoPorCodigo(demo, '123'); } catch { malo = true; }
check(malo, 'un código mal: avisa');
check((await buscarProductos(demo, 'avena')).length === 2 && igual(await buscarProductos(demo, 'a'), []), 'por nombre (y con una letra, nada)');

console.log('El lector de códigos de barras (con un código dibujado)');
const dir = mkdtempSync(join(tmpdir(), 'lector-'));
const salida = join(dir, 'lector.mjs');
await esbuild.build({ entryPoints: [new URL('../web/src/logica/lector-codigos.js', import.meta.url).pathname], bundle: true, platform: 'node', format: 'esm', outfile: salida, logLevel: 'error' });
const { leerGris, grisDeRGBA } = await import(pathToFileURL(salida).href);
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = L.map((p) => p.split('').reverse().map((c) => (c === '0' ? '1' : '0')).join(''));
const R = L.map((p) => p.split('').map((c) => (c === '0' ? '1' : '0')).join(''));
const PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
function dibujar(codigo, ruido = 30) {
  const d = codigo.split('').map(Number);
  let b = '101';
  for (let i = 1; i < 7; i++) b += (PAR[d[0]][i - 1] === 'L' ? L : G)[d[i]];
  b += '01010';
  for (let i = 7; i < 13; i++) b += R[d[i]];
  b += '101';
  const mod = 3, margen = 15 * mod, w = b.length * mod + 2 * margen, h = 50;
  const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = x - margen, negro = i >= 0 && i < b.length * mod && b[Math.floor(i / mod)] === '1';
    const v = Math.max(0, Math.min(255, (negro ? 25 : 235) + Math.round((azar() - 0.5) * ruido)));
    const j = (y * w + x) * 4; rgba[j] = rgba[j + 1] = rgba[j + 2] = v;
  }
  return { gris: grisDeRGBA(rgba, w, h), w, h };
}
for (const c of ['8410188012092', '5449000000996', '2000000000039']) {
  const { gris, w, h } = dibujar(c);
  check(leerGris(gris, w, h) === c, `lee ${c}`);
}
check(leerGris(new Uint8ClampedArray(200 * 50).fill(200), 200, 50) === null, 'sin código: null (sin romperse)');

console.log('Lo que lleva la app');
const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
check(/connect-src[^;]*https:\/\/world\.openfoodfacts\.org/.test(html) && /img-src[^;]*https:\/\/images\.openfoodfacts\.org/.test(html), 'la política de seguridad deja hablar con Open Food Facts');
const nut = readFileSync(new URL('../web/src/ui/atleta/Nutricion.jsx', import.meta.url), 'utf8');
check(nut.includes('<SumarProducto') && nut.includes('Sumar un producto (código de barras)'), '«Apuntar la nutrición» tiene el botón');
const prod = readFileSync(new URL('../web/src/ui/atleta/Productos.jsx', import.meta.url), 'utf8');
check(prod.includes("await import('../../logica/lector-codigos.js')"), 'el lector se carga aparte, solo al abrir la cámara');
check(prod.includes('Open Food Facts') && prod.includes('t.stop()'), 'cita a Open Food Facts y apaga la cámara al salir');
check(readFileSync(new URL('../web/licencias/zxing-LICENSE.txt', import.meta.url), 'utf8').includes('Apache License'), 'la licencia de ZXing va con la app');

console.log(`\n${ok} comprobaciones bien, ${fallos} mal`);
if (fallos) process.exit(1);
