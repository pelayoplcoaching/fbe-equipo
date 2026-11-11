// Productos envasados (escáner de la nutrición): buscar por código de barras o por nombre en Open Food Facts.
// Va directo del móvil a Open Food Facts (sin pasar por la base): solo se manda el código o el texto buscado. En la
// demo no se sale a la red: unos productos de ejemplo (códigos 20…, los de uso interno, que no son de nadie).
import { urlProducto, urlBusqueda, leerRespuestaProducto, leerRespuestaBusqueda, codigoValido } from '../logica/alimentos.js';

const ESPERA_MS = 9000;

export const PRODUCTOS_DEMO = [
  { code: '2000000000015', product_name: 'Yogur natural (demo)', brands: 'FBE', quantity: '4 x 125 g', serving_size: '125 g', serving_quantity: 125, nutriments: { 'energy-kcal_100g': 62, proteins_100g: 4.8, carbohydrates_100g: 7.1, fat_100g: 1.5 } },
  { code: '2000000000022', product_name: 'Pechuga de pavo en lonchas (demo)', brands: 'FBE', quantity: '200 g', serving_size: '50 g', serving_quantity: 50, nutriments: { 'energy-kcal_100g': 98, proteins_100g: 21, carbohydrates_100g: 1.2, fat_100g: 1.1 } },
  { code: '2000000000039', product_name: 'Copos de avena (demo)', brands: 'FBE', quantity: '500 g', serving_size: '40 g', serving_quantity: 40, nutriments: { 'energy-kcal_100g': 372, proteins_100g: 13.5, carbohydrates_100g: 58.7, fat_100g: 7, fiber_100g: 10 } },
  { code: '2000000000046', product_name: 'Bebida de avena (demo)', brands: 'FBE', quantity: '1 l', product_quantity_unit: 'ml', serving_size: '250 ml', serving_quantity: 250, nutriments: { 'energy-kcal_100g': 46, proteins_100g: 1, carbohydrates_100g: 6.8, fat_100g: 1.5, fiber_100g: 0.8 } },
];

async function pedir(url) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), ESPERA_MS) : null;
  try {
    const r = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl?.signal, headers: { Accept: 'application/json' } });
    if (r.status === 404) return null;
    if (r.status === 429) throw new Error('Open Food Facts va saturado: espera un minuto y vuelve a probar.');
    if (!r.ok) throw new Error('Open Food Facts no responde ahora. Prueba en un rato.');
    return await r.json();
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('Open Food Facts tarda demasiado. Revisa la conexión y prueba otra vez.');
    if (e instanceof TypeError) throw new Error('Sin conexión: para buscar un producto hace falta internet.');
    throw e;
  } finally { if (t) clearTimeout(t); }
}

// El producto de un código ({ codigo, nombre, marca, por100… }), o null si no está o no trae macros
export async function productoPorCodigo(backend, codigo) {
  if (!codigoValido(codigo)) throw new Error('Ese código no es de un producto (revisa los números).');
  if (backend?.modo === 'demo') {
    const p = PRODUCTOS_DEMO.find((x) => x.code === codigo);
    return p ? leerRespuestaProducto({ status: 1, product: p }) : null;
  }
  const json = await pedir(urlProducto(codigo));
  return json ? leerRespuestaProducto(json) : null;
}

// Los productos que casan con un texto (los que traen macros, los más escaneados primero)
export async function buscarProductos(backend, texto) {
  const q = String(texto ?? '').trim();
  if (q.length < 2) return [];
  if (backend?.modo === 'demo') {
    const s = q.toLowerCase();
    return leerRespuestaBusqueda({ products: PRODUCTOS_DEMO.filter((x) => x.product_name.toLowerCase().includes(s)) });
  }
  const json = await pedir(urlBusqueda(q));
  return json ? leerRespuestaBusqueda(json) : [];
}
