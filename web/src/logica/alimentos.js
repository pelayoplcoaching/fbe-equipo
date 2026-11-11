// Productos envasados (escáner): el código de barras de un producto → sus macros en Open Food Facts → lo que suman los
// gramos que se ha comido. Lo usa «Apuntar la nutrición» para quien no cuenta con otra app: suma al total del día, no se
// guarda producto a producto. Funciones puras, probadas en test/alimentos.test.mjs.
//
// Open Food Facts (openfoodfacts.org) es una base abierta y colaborativa (ODbL): gratis, sin cuenta y con muchos
// productos de supermercado españoles. Pide citarla («Datos de Open Food Facts»). Lo que se le manda es solo el código o
// el texto buscado, nada de la persona.

export const OFF_BASE = 'https://world.openfoodfacts.org';
const CAMPOS = 'code,product_name,product_name_es,generic_name_es,brands,quantity,serving_size,serving_quantity,product_quantity_unit,nutriments,image_front_small_url';

// ---------------------------------------------------------------- el código
// EAN-13, EAN-8, UPC-A (12) y GTIN-14: solo cifras y con su dígito de control bien
export function codigoValido(c) {
  const s = String(c ?? '');
  if (!/^(\d{8}|\d{12,14})$/.test(s)) return false;
  const d = s.split('').map(Number);
  const control = d.pop();
  // de derecha a izquierda, pesos 3, 1, 3, 1…
  const suma = d.reverse().reduce((t, x, i) => t + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (suma % 10)) % 10 === control;
}
// Lo que se teclea o se pega: fuera espacios y guiones
export const limpiarCodigo = (t) => String(t ?? '').replace(/[\s-]/g, '').slice(0, 20);

export const urlProducto = (codigo) => `${OFF_BASE}/api/v2/product/${encodeURIComponent(codigo)}.json?fields=${CAMPOS}`;
// La búsqueda por nombre (lenta y con límite: 10 por minuto; por eso se busca al pulsar, no letra a letra)
export const urlBusqueda = (texto, n = 15) =>
  `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(String(texto).trim().slice(0, 80))}&search_simple=1&action=process&json=1&lc=es&sort_by=unique_scans_n&page_size=${n}&fields=${CAMPOS}`;

// ---------------------------------------------------------------- el producto
const r1 = (x) => Math.round(x * 10) / 10;
const n = (v) => {
  if (v == null || v === '') return null;
  const x = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(x) ? x : null;
};
const enRango = (x, max) => (x != null && x >= 0 && x <= max ? x : null);
const texto = (t, largo = 120) => (typeof t === 'string' ? t.replace(/\s+/g, ' ').trim().slice(0, largo) : '');
const KJ_POR_KCAL = 4.184;

// De lo que devuelve Open Food Facts (el «product») a lo que usa la app; null si no trae al menos las kcal o la proteína.
// Los valores van por 100 g (o 100 ml). Si solo vienen por ración, se pasan a 100 con el peso de la ración.
export function productoDeOFF(p) {
  if (!p || typeof p !== 'object') return null;
  const nu = p.nutriments && typeof p.nutriments === 'object' ? p.nutriments : {};
  const racion = enRango(n(p.serving_quantity), 5000);
  const de = (clave) => {
    const cien = n(nu[`${clave}_100g`]);
    if (cien != null) return cien;
    const porRacion = n(nu[`${clave}_serving`]);
    return porRacion != null && racion ? (porRacion * 100) / racion : null;
  };
  let kcal = de('energy-kcal');
  if (kcal == null) {
    const kj = de('energy-kj') ?? (nu.energy_unit === 'kcal' ? null : de('energy'));
    if (kj != null) kcal = kj / KJ_POR_KCAL;
  }
  const por100 = {
    kcal: enRango(kcal != null ? Math.round(kcal) : null, 950),
    proteina_g: enRango(de('proteins') != null ? r1(de('proteins')) : null, 100),
    carbos_g: enRango(de('carbohydrates') != null ? r1(de('carbohydrates')) : null, 100),
    grasa_g: enRango(de('fat') != null ? r1(de('fat')) : null, 100),
    fibra_g: enRango(de('fiber') != null ? r1(de('fiber')) : null, 100),
  };
  if (por100.kcal == null && por100.proteina_g == null) return null;
  const nombre = texto(p.product_name_es) || texto(p.product_name) || texto(p.generic_name_es);
  const unidad = /^(ml|cl|l)$/i.test(String(p.product_quantity_unit || '').trim()) || /\d\s*(ml|cl|l)\b/i.test(String(p.quantity || '')) ? 'ml' : 'g';
  const imagen = /^https:\/\/images\.openfoodfacts\.org\/[\w./-]+\.(jpg|png|webp)$/i.test(String(p.image_front_small_url || '')) ? p.image_front_small_url : null;
  return {
    codigo: limpiarCodigo(p.code),
    nombre: nombre || 'Producto sin nombre',
    marca: texto(String(p.brands || '').split(',')[0], 60),
    cantidad: texto(p.quantity, 30),
    racion_g: racion ? r1(racion) : null,
    racion: texto(p.serving_size, 40),
    unidad,
    por100,
    imagen,
  };
}

// La respuesta de urlProducto: { status: 1, product } si está; si no, null
export function leerRespuestaProducto(json) {
  if (!json || Number(json.status) !== 1) return null;
  return productoDeOFF(json.product);
}
// La de urlBusqueda: los que traen macros, sin repetir código
export function leerRespuestaBusqueda(json) {
  const lista = Array.isArray(json?.products) ? json.products : [];
  const vistos = new Set();
  return lista.map(productoDeOFF).filter((x) => x && (!x.codigo || !vistos.has(x.codigo)) && (vistos.add(x.codigo), true));
}

// ---------------------------------------------------------------- lo que suma
export const MAX_GRAMOS = 3000;
// Lo de una cantidad (g o ml), redondeado como se apunta: kcal enteras y macros a una cifra
export function macrosDeCantidad(prod, gramos) {
  const g = n(gramos);
  if (!prod?.por100 || g == null || g <= 0 || g > MAX_GRAMOS) return null;
  const f = g / 100;
  const de = (k, dec) => (prod.por100[k] == null ? null : dec ? r1(prod.por100[k] * f) : Math.round(prod.por100[k] * f));
  return { kcal: de('kcal', false), proteina_g: de('proteina_g', true), carbos_g: de('carbos_g', true), grasa_g: de('grasa_g', true), fibra_g: de('fibra_g', true) };
}

// Lo que propone la hoja como cantidad: la ración si la trae; si no, 100
export const cantidadInicial = (prod) => (prod?.racion_g && prod.racion_g <= MAX_GRAMOS ? prod.racion_g : 100);

// Sumar (signo 1) o quitar (−1) lo de un producto a los totales del día que se están apuntando. Solo los campos que
// se ven (campos); un campo vacío cuenta como 0. Los totales se apuntan en enteros. (Al quitar el último producto, la
// hoja vuelve a lo que había antes de sumar: así no quedan ceros ni restos de redondeo.)
export const CAMPOS_DIA = ['kcal', 'proteina_g', 'carbos_g', 'grasa_g', 'fibra_g'];
export function sumarAlDia(dia, m, campos = CAMPOS_DIA, signo = 1) {
  const fuera = { ...dia };
  for (const k of campos) {
    if (m?.[k] == null) continue;
    const antes = dia[k] == null ? 0 : Number(dia[k]);
    fuera[k] = Math.round(Math.max(0, antes + signo * m[k]));
  }
  return fuera;
}
// Lo que se suma de la lista entera (para el resumen de la hoja)
export function totalSumado(lista) {
  const t = { kcal: 0, proteina_g: 0 };
  for (const x of Array.isArray(lista) ? lista : []) { t.kcal += x.m?.kcal || 0; t.proteina_g += x.m?.proteina_g || 0; }
  return { kcal: Math.round(t.kcal), proteina_g: r1(t.proteina_g) };
}

// Una línea para la lista y para los avisos: «125 g · 80 kcal · 5 g prot.»
export function textoSumado(m, gramos, unidad = 'g') {
  const partes = [`${Math.round(gramos)} ${unidad}`];
  if (m?.kcal != null) partes.push(`${m.kcal} kcal`);
  if (m?.proteina_g != null) partes.push(`${String(m.proteina_g).replace('.', ',')} g prot.`);
  return partes.join(' · ');
}
// Las cifras por 100: «Por 100 g: 62 kcal · P 4,8 · H 7,1 · G 1,5»
export function textoPor100(prod) {
  const c = prod?.por100 || {};
  const f = (x) => String(x).replace('.', ',');
  const partes = [];
  if (c.kcal != null) partes.push(`${c.kcal} kcal`);
  if (c.proteina_g != null) partes.push(`P ${f(c.proteina_g)}`);
  if (c.carbos_g != null) partes.push(`H ${f(c.carbos_g)}`);
  if (c.grasa_g != null) partes.push(`G ${f(c.grasa_g)}`);
  return `Por 100 ${prod?.unidad || 'g'}: ${partes.join(' · ')}`;
}

// ---------------------------------------------------------------- los recientes (en el móvil)
// Los últimos productos sumados, para volver a ponerlos sin escanear (y sin cobertura): el más nuevo primero, sin
// repetir, como mucho MAX_RECIENTES, con la última cantidad que se usó
export const MAX_RECIENTES = 12;
export function conReciente(lista, prod, gramos) {
  const previos = Array.isArray(lista) ? lista.filter((x) => x && x.por100 && x.codigo !== prod.codigo && !(x.nombre === prod.nombre && !x.codigo)) : [];
  return [{ ...prod, ultima_g: n(gramos) }, ...previos].slice(0, MAX_RECIENTES);
}
// Lo que se lee del almacenamiento del móvil, revisado (puede venir de una versión vieja o tocado a mano)
export function recientesValidos(x) {
  if (!Array.isArray(x)) return [];
  return x.filter((p) => p && typeof p.nombre === 'string' && p.por100 && typeof p.por100 === 'object')
    .map((p) => ({ ...p, nombre: texto(p.nombre) || 'Producto', imagen: null }))
    .slice(0, MAX_RECIENTES);
}
