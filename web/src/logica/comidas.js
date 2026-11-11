// Comidas (v0.26, migración 022): el recetario del coach, las recetas de cada atleta por toma, sus comidas del
// día y su menú de la semana con la lista de la compra. Funciones puras, probadas en test/logica.test.mjs.
// Espejo de lo que comprueba la base: aquí se valida antes de enviar y se dice en palabras qué falta.
import { num, leerNumero } from './calculos.js';
import { textoVisible } from './texto.js';
import { sumarDias, lunesDe } from './fechas.js';

// Las tomas del día, en su orden
export const TOMAS = [
  ['desayuno', 'Desayuno'], ['media_manana', 'Media mañana'], ['comida', 'Comida'],
  ['merienda', 'Merienda'], ['cena', 'Cena'], ['recena', 'Antes de dormir'],
];
export const NOMBRE_TOMA = Object.fromEntries(TOMAS);
export const CLAVES_TOMA = TOMAS.map(([t]) => t);
export const TOMAS_DEFECTO = ['desayuno', 'comida', 'merienda', 'cena'];
// La comida que toca por la hora (0-23) de entre las del día: desayuno hasta las 11, media mañana hasta la 1, comida
// hasta las 4, merienda hasta las 8, cena hasta las 11 y, después, antes de dormir. Si esa no está entre las suyas, ninguna.
const FRANJAS_TOMA = [['desayuno', 5, 11], ['media_manana', 11, 13], ['comida', 13, 16], ['merienda', 16, 20], ['cena', 20, 23]];
export function tomaDeLaHora(hora, tomas = []) {
  const h = Number(hora);
  if (!Number.isInteger(h) || h < 0 || h > 23) return null;
  const t = (FRANJAS_TOMA.find(([, a, b]) => h >= a && h < b) || ['recena'])[0];
  return tomas.includes(t) ? t : null;
}
export const ordenarTomas = (xs = []) => CLAVES_TOMA.filter((t) => xs.includes(t));
// Las comidas que hace el atleta (lo que eligió, o las cuatro de siempre)
export const tomasDe = (fila) => (fila?.tomas?.length ? ordenarTomas(fila.tomas) : TOMAS_DEFECTO);

// Etiquetas que el coach suele usar (puede escribir otras)
export const ETIQUETAS_SUGERIDAS = ['Rápida', 'Para llevar', 'Batch cooking', 'Alta en proteína', 'Vegetariana', 'Vegana', 'Sin gluten', 'Sin lactosa', 'Dulce', 'Salada'];

export const LIMITES_RECETA = { kcal: 5000, proteina_g: 500, carbos_g: 800, grasa_g: 400 };
const MACROS = ['kcal', 'proteina_g', 'carbos_g', 'grasa_g'];
const r1 = (x) => Math.round(x * 10) / 10;
const normal = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------ ingredientes
// Unidades que se reconocen al escribir «60 g de avena» o «Avena 60 g» (lo demás va en el nombre)
const UNIDADES = [
  ['g', ['g', 'gr', 'grs', 'gramo', 'gramos']], ['kg', ['kg', 'kilo', 'kilos']], ['ml', ['ml', 'mililitro', 'mililitros']],
  ['l', ['l', 'litro', 'litros']], ['cl', ['cl']], ['ud', ['ud', 'uds', 'u', 'unidad', 'unidades']],
  ['cda', ['cda', 'cdas', 'cucharada', 'cucharadas']], ['cdta', ['cdta', 'cdtas', 'cucharadita', 'cucharaditas']],
  ['taza', ['taza', 'tazas']], ['vaso', ['vaso', 'vasos']], ['pizca', ['pizca', 'pizcas']], ['rebanada', ['rebanada', 'rebanadas']],
  ['loncha', ['loncha', 'lonchas']], ['lata', ['lata', 'latas']], ['puñado', ['puñado', 'puñados']], ['cazo', ['cazo', 'cazos', 'scoop', 'scoops']],
  ['diente', ['diente', 'dientes']], ['filete', ['filete', 'filetes']], ['pieza', ['pieza', 'piezas']],
];
const UNIDAD = new Map(UNIDADES.flatMap(([u, xs]) => xs.map((x) => [normal(x), u])));
const NUM = '(\\d+(?:[.,]\\d+)?|\\d+\\/\\d+|½|¼|¾)';
const fraccion = (t) => ({ '½': 0.5, '¼': 0.25, '¾': 0.75 }[t] ?? (t.includes('/') ? Number(t.split('/')[0]) / Number(t.split('/')[1]) : leerNumero(t)));

// Una línea de texto → { nombre, cantidad?, unidad? } (o null si está vacía)
export function leerIngrediente(linea) {
  let t = String(linea || '').replace(/^\s*[-\u2022*\u00b7\u2013]\s*/, '').trim();
  if (!t) return null;
  // «1 cda (10 ml) de salsa de soja»: el paréntesis tras la unidad pasa al final del nombre
  const par = t.match(new RegExp(`^(${NUM}\\s*([a-zA-ZñÑáéíóú]+)\\.?)\\s*(\\([^)]*\\))\\s+(.+)$`, 'i'));
  if (par && UNIDAD.get(normal(par[3]))) t = `${par[1]} ${par[5]} ${par[4]}`;
  let m = t.match(new RegExp(`^${NUM}\\s*([a-zA-ZñÑáéíóú]+\\.?)?\\s+(?:de\\s+)?(.+)$`, 'i'));
  if (m) {
    const cantidad = fraccion(m[1]);
    const u = m[2] ? UNIDAD.get(normal(m[2].replace(/\.$/, ''))) : null;
    // Sin unidad («3 tortillas de trigo»), el nombre es todo lo que va tras el número, con su «de»
    const tras = t.match(new RegExp(`^${NUM}\\s*(.+)$`, 'i'))?.[2] || '';
    const nombre = (u || !m[2] ? m[3] : tras).replace(/^de\s+/i, '').trim();
    if (cantidad > 0 && nombre) return limpiarIngrediente({ nombre: mayuscula(nombre), cantidad, unidad: u || (m[2] ? null : 'ud') });
  }
  // «Avena 60 g» o «Avena (60 g)»
  m = t.match(new RegExp(`^(.+?)[\\s:(]+${NUM}\\s*([a-zA-ZñÑ]+\\.?)?\\)?$`, 'i'));
  if (m) {
    const cantidad = fraccion(m[2]);
    const u = m[3] ? UNIDAD.get(normal(m[3].replace(/\.$/, ''))) : null;
    if (cantidad > 0 && (u || !m[3])) return limpiarIngrediente({ nombre: mayuscula(m[1].trim()), cantidad, unidad: u || 'ud' });
  }
  return limpiarIngrediente({ nombre: mayuscula(t) });
}
const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function limpiarIngrediente({ nombre, cantidad = null, unidad = null }) {
  const n = String(nombre || '').trim().slice(0, 80);
  if (!n || !textoVisible(n)) return null;
  const x = { nombre: n };
  if (cantidad != null && Number(cantidad) > 0 && Number(cantidad) <= 100000) x.cantidad = Math.round(Number(cantidad) * 100) / 100;
  if (unidad && x.cantidad != null) x.unidad = String(unidad).slice(0, 16);
  return x;
}

// Varias líneas (lo que se pega de Notion) → lista de ingredientes
export const leerIngredientes = (texto) => String(texto || '').split(/\r?\n|;/).map(leerIngrediente).filter(Boolean).slice(0, 40);

// Cantidad multiplicada y redondeada como se mide en casa: gramos y mililitros de 5 en 5 (de 1 en 1 por debajo
// de 50), unidades y cucharadas de media en media
export function escalarCantidad(cantidad, unidad, escala = 1) {
  if (cantidad == null) return null;
  const v = Number(cantidad) * Number(escala || 1);
  if (['g', 'ml'].includes(unidad)) return v >= 50 ? Math.round(v / 5) * 5 : Math.max(1, Math.round(v));
  if (['kg', 'l'].includes(unidad)) return Math.round(v * 100) / 100;
  if (['cl'].includes(unidad)) return Math.max(1, Math.round(v));
  return v < 0.5 ? Math.max(0.25, Math.round(v * 4) / 4) : Math.round(v * 2) / 2;
}
const UNIDAD_TEXTO = { ud: '', cda: 'cda.', cdta: 'cdta.' };
// «90 g de copos de avena», «2 huevos», «Sal al gusto»
export function textoIngrediente(i, escala = 1) {
  if (i.cantidad == null) return i.nombre;
  const c = escalarCantidad(i.cantidad, i.unidad, escala);
  const plural = c > 1 && /^(taza|vaso|pizca|rebanada|loncha|lata|pu\u00f1ado|cazo|diente|filete|pieza)$/.test(i.unidad || '') ? 's' : '';
  const u = i.unidad && UNIDAD_TEXTO[i.unidad] !== '' ? ` ${UNIDAD_TEXTO[i.unidad] || i.unidad + plural}` : '';
  // (las siglas se quedan como están: «1 cda. de AOVE», no «aOVE»)
  const nombre = /^[A-Z\u00d1]{2}/.test(i.nombre) ? i.nombre : i.nombre.charAt(0).toLowerCase() + i.nombre.slice(1);
  return u ? `${num(c, 2)}${u} de ${nombre}` : `${num(c, 2)} ${nombre}`;
}
// Para volver a editar: una línea por ingrediente
export const ingredientesATexto = (xs = []) => xs.map((i) => (i.cantidad == null ? i.nombre : `${num(i.cantidad, 2)}${i.unidad && i.unidad !== 'ud' ? ` ${i.unidad}` : ''} ${i.nombre}`)).join('\n');

// ------------------------------------------------------------ recetas
// Lo del formulario → la fila que se guarda. Devuelve { fila, error }.
export function limpiarReceta(f) {
  const nombre = String(f.nombre || '').trim();
  if (!nombre || !textoVisible(nombre)) return { error: 'Ponle un nombre a la receta.' };
  if (nombre.length > 80) return { error: 'El nombre es demasiado largo (80 letras como mucho).' };
  const tomas = ordenarTomas(f.tomas || []);
  const raciones = Math.round(Number(f.raciones) || 1);
  if (raciones < 1 || raciones > 20) return { error: 'Las raciones tienen que ir de 1 a 20.' };
  const fila = { nombre, tomas, raciones };
  for (const k of MACROS) {
    const v = f[k] === '' || f[k] == null ? null : typeof f[k] === 'number' ? f[k] : leerNumero(f[k]);
    if (f[k] !== '' && f[k] != null && v == null) return { error: 'Revisa las kcal y los macros: tienen que ser números.' };
    if (v != null && (v < 0 || v > LIMITES_RECETA[k])) return { error: `${k === 'kcal' ? 'Las kcal' : 'Los macros'} por ración se salen de lo razonable.` };
    fila[k] = v == null ? null : r1(v);
  }
  const ingredientes = Array.isArray(f.ingredientes) ? f.ingredientes.map(limpiarIngrediente).filter(Boolean) : leerIngredientes(f.ingredientes);
  if (ingredientes.length > 40) return { error: 'Como mucho 40 ingredientes.' };
  fila.ingredientes = ingredientes;
  const prep = String(f.preparacion || '').trim();
  if (prep.length > 4000) return { error: 'La preparación es demasiado larga (4000 letras como mucho).' };
  fila.preparacion = prep && textoVisible(prep) ? prep : null;
  const min = f.minutos === '' || f.minutos == null ? null : Math.round(leerNumero(String(f.minutos)) ?? -1);
  if (min != null && (min < 0 || min > 600)) return { error: 'Los minutos tienen que ir de 0 a 600.' };
  fila.minutos = min;
  const etiquetas = [...new Set((f.etiquetas || []).map((e) => String(e).trim().slice(0, 24)).filter((e) => e && textoVisible(e)))];
  if (etiquetas.length > 8) return { error: 'Como mucho 8 etiquetas.' };
  fila.etiquetas = etiquetas;
  if ('foto' in f) fila.foto = f.foto || null;
  if ('foto_mini' in f) fila.foto_mini = f.foto_mini || null;
  return { fila };
}

// Si las kcal no cuadran con los macros (4/4/9) más de un 10 % (y 30 kcal), un aviso: no impide guardar
export function avisoMacros(r) {
  if ([r.kcal, r.proteina_g, r.carbos_g, r.grasa_g].some((v) => v == null || v === '')) return null;
  const calc = 4 * Number(r.proteina_g) + 4 * Number(r.carbos_g) + 9 * Number(r.grasa_g);
  const dif = Math.abs(calc - Number(r.kcal));
  return dif > Math.max(30, Number(r.kcal) * 0.1) ? `Con esos macros salen unas ${Math.round(calc)} kcal, no ${num(r.kcal, 0)}.` : null;
}

// Kcal y macros de una ración de la receta con el factor del atleta y las raciones que apunta
export function macrosDe(receta, factor = 1, raciones = 1) {
  const k = Number(factor || 1) * Number(raciones || 1);
  const out = {};
  for (const m of MACROS) out[m] = receta?.[m] == null ? null : r1(Number(receta[m]) * k);
  return out;
}
// «520 kcal · P 32 · H 60 · G 14»
export function textoMacros(x, corto = false) {
  if (!x) return '';
  const partes = [];
  if (x.kcal != null) partes.push(`${num(x.kcal, 0)} kcal`);
  if (x.proteina_g != null) partes.push(`${corto ? 'P' : 'Prot.'} ${num(x.proteina_g, 0)}`);
  if (x.carbos_g != null) partes.push(`${corto ? 'H' : 'Hidr.'} ${num(x.carbos_g, 0)}`);
  if (x.grasa_g != null) partes.push(`${corto ? 'G' : 'Grasa'} ${num(x.grasa_g, 0)}`);
  return partes.join(' · ');
}

// ------------------------------------------------------------ recetario del atleta
// recetas_atleta + recetas → por toma, en orden (favoritas primero), con la receta dentro
export function recetarioPorToma(asignaciones = [], recetas = []) {
  const R = Object.fromEntries(recetas.map((r) => [r.id, r]));
  const out = {};
  for (const a of asignaciones) {
    const receta = R[a.receta_id];
    if (!receta) continue;
    (out[a.toma] ||= []).push({ ...a, receta });
  }
  for (const t of Object.keys(out)) {
    out[t].sort((x, y) => Number(y.favorita) - Number(x.favorita) || x.orden - y.orden || x.receta.nombre.localeCompare(y.receta.nombre, 'es'));
  }
  return out;
}

// ------------------------------------------------------------ menú de la semana
export const diasDeSemana = (lunes) => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));

// La fila del menú para una receta del recetario (con sus macros ya calculados) o para un texto libre
export function entradaMenu({ fecha, toma, asignacion = null, texto = null, raciones = 1, macros = null, orden = 0 }) {
  const rac = Math.min(10, Math.max(0.25, Math.round(Number(raciones || 1) * 4) / 4));
  if (asignacion) {
    return { fecha, toma, receta_id: asignacion.receta.id, texto: asignacion.receta.nombre, raciones: rac, ...macrosDe(asignacion.receta, asignacion.factor, rac), hecho: false, orden };
  }
  const t = String(texto || '').trim().slice(0, 120);
  if (!t || !textoVisible(t)) return null;
  const m = {};
  for (const k of MACROS) m[k] = macros?.[k] == null || macros[k] === '' ? null : r1(Number(macros[k]));
  return { fecha, toma, receta_id: null, texto: t, raciones: rac, ...m, hecho: false, orden };
}
// Al cambiar las raciones de algo del menú, sus macros cambian en proporción
export function cambiarRaciones(entrada, raciones) {
  const rac = Math.min(10, Math.max(0.25, Math.round(Number(raciones) * 4) / 4));
  const k = rac / Number(entrada.raciones || 1);
  const out = { raciones: rac };
  for (const m of MACROS) out[m] = entrada[m] == null ? null : r1(Number(entrada[m]) * k);
  return out;
}

// Totales de un día (lo que hay en el menú; «hechos», solo lo comido). conDatos: cuántas cosas traen kcal
export function totalesDia(entradas = [], soloHecho = false) {
  const xs = soloHecho ? entradas.filter((e) => e.hecho) : entradas;
  const t = { kcal: 0, proteina_g: 0, carbos_g: 0, grasa_g: 0, conDatos: 0, total: xs.length };
  for (const e of xs) {
    if (e.kcal != null) t.conDatos++;
    for (const m of MACROS) t[m] += Number(e[m]) || 0;
  }
  for (const m of MACROS) t[m] = r1(t[m]);
  return t;
}

// El menú de una semana, por día y toma: { [fecha]: { [toma]: [entradas] } }
export function menuPorDia(entradas = [], lunes) {
  const out = Object.fromEntries(diasDeSemana(lunes).map((d) => [d, {}]));
  for (const e of [...entradas].sort((a, b) => a.orden - b.orden || String(a.creado_en || '').localeCompare(String(b.creado_en || '')))) {
    if (!out[e.fecha]) continue;
    (out[e.fecha][e.toma] ||= []).push(e);
  }
  return out;
}

// Copiar una semana a otra: las mismas comidas, 7 días después (o los que haya entre los dos lunes), sin «hecho»
export function copiarMenu(entradas = [], lunesOrigen, lunesDestino) {
  const dias = Math.round((Date.parse(lunesDestino) - Date.parse(lunesOrigen)) / 864e5);
  return entradas.filter((e) => e.fecha >= lunesOrigen && e.fecha <= sumarDias(lunesOrigen, 6)).map((e) => ({
    fecha: sumarDias(e.fecha, dias), toma: e.toma, receta_id: e.receta_id ?? null, texto: e.texto, raciones: Number(e.raciones),
    kcal: e.kcal ?? null, proteina_g: e.proteina_g ?? null, carbos_g: e.carbos_g ?? null, grasa_g: e.grasa_g ?? null, hecho: false, orden: e.orden || 0,
  }));
}

// ------------------------------------------------------------ lista de la compra (v0.53.1)
// Para sumar lo mismo aunque esté escrito de otra forma («1 cda (10 ml) de AOVE» y «1 cdta (5 ml) de AOVE»; «2 huevos
// M (100 g)» y «2 huevos M cocidos (100 g)»), cada ingrediente se pasa a lo que se compra: una clave y una cantidad en
// gramos, mililitros o piezas. Solo para la lista de la compra: las recetas se guardan y se ven como se escribieron.
//  - Clave: el nombre sin paréntesis, sin acentos, en minúsculas y en singular, sin «al gusto» ni lo que no cambia
//    lo que compras (cocido, fresco, entero, limpio, troceado, en dados, en tiras, en rodajas, a la plancha…) y sin la
//    talla del huevo. Lo que sí lo cambia se queda: picado, integral, basmati, desnatado, light, en lonchas, claras…
//  - Cantidad: g y kg, en gramos; ml, cl y l, en mililitros. Las cucharadas, en mililitros: lo que diga la receta
//    («1 cda (10 ml)»: 10 ml) y, si no lo dice, 15 ml la cucharada y 5 ml la cucharadita. Lo que se compra por piezas
//    (huevos, latas, dientes, filetes…) se cuenta en piezas, con su peso como pista si la receta lo dice («2 huevos M
//    (100 g)»: 2 huevos, unos 100 g).
const PESO = { g: 1, kg: 1000 };
const VOLUMEN = { ml: 1, cl: 10, l: 1000 };
const CUCHARA = { cda: 15, cdta: 5 };
const MEDIDAS = new Set(['taza', 'vaso', 'pizca', 'puñado', 'cazo']);
const PIEZAS = new Set(['ud', 'diente', 'lata', 'pieza', 'filete', 'rebanada', 'loncha', 'hoja']);
const EQUIVALENCIA = new RegExp(`\\(\\s*${NUM}\\s*(g|gr|grs|gramos?|kg|ml|cl|l)\\.?\\s*\\)`, 'i');
const EN_ML = { ml: 1, cl: 10, l: 1000 };
// «1 patata pequeña», «½ scoop», «4-5 unidades», «10 ml»: lo de una receta, que al sumar ya no vale («5% grasa» sí)
const ES_CANTIDAD = new RegExp(`^(?:${NUM}|\\d+\\s*-\\s*\\d+)(?![\\d.,]*\\s*%)`);
const FRASES_FUERA = ['al gusto', 'a la plancha', 'al horno', 'al vapor', 'en dados', 'en daditos', 'en tiras', 'en trozos', 'en rodajas', 'en cubos', 'para servir', 'para acompanar'];
const PALABRA_FUERA = /^(cocid|hervid|trocead|cortad|fresc|enter|limpi|escurrid|lavad)(o|a|os|as)$/;
const VACIAS = new Set(['de', 'del', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas']);
const TALLA_HUEVO = new Set(['s', 'm', 'l', 'xl']);

// Una palabra en singular, para comparar (no para enseñarla): huevos → huevo, nueces → nuez, cereales → cereal
function singular(w) {
  if (w.length <= 3 || /\d/.test(w)) return w;
  if (w.endsWith('ces')) return `${w.slice(0, -3)}z`;
  let s = w.endsWith('s') ? w.slice(0, -1) : w;
  if (s.length > 3 && /[lnr]e$/.test(s)) s = s.slice(0, -1);
  if (s.endsWith('ce')) s = `${s.slice(0, -2)}z`;
  return s;
}

// El nombre → la clave con la que se agrupa en la lista
export function claveCompra(nombre) {
  let t = ` ${normal(String(nombre || '').replace(/\([^)]*\)/g, ' ')).replace(/(\d)\s+%/g, '$1%').replace(/[^a-z0-9%]+/g, ' ')} `;
  for (const f of FRASES_FUERA) t = t.split(` ${f} `).join(' ');
  const out = [];
  for (const w of t.trim().split(' ')) {
    if (!w || VACIAS.has(w) || PALABRA_FUERA.test(w)) continue;
    if (TALLA_HUEVO.has(w) && out[out.length - 1] === 'huevo') continue;
    out.push(singular(w));
  }
  return out.join(' ');
}

// El nombre para enseñarlo en la lista: sin la equivalencia ni lo que era la cantidad de una receta
// («Huevos M (100 g)» → «Huevos M»; «Patata (peso en crudo, 1 patata pequeña)» → «Patata (peso en crudo)»)
export function nombreCompra(nombre) {
  return String(nombre || '').replace(/\s*\(([^)]*)\)/g, (_, dentro) => {
    const quedan = dentro.split(',').map((x) => x.trim()).filter((x) => x && !ES_CANTIDAD.test(x));
    return quedan.length ? ` (${quedan.join(', ')})` : '';
  }).replace(/\s+/g, ' ').trim();
}

// Un ingrediente de una receta (multiplicado por su escala) → lo que se compra: [{ clave, nombre, g?, ml?, piezas?, sin? }].
// piezas: { unidad, n, aprox?: { g } | { ml } }. sin: no lleva cantidad («Sal y pimienta al gusto»).
// «4 claras de huevo (132 g) + 1 huevo entero (50 g)» son dos cosas, si las dos se entienden.
export function paraComprar(i, escala = 1) {
  if (!i?.nombre) return [];
  const trozos = String(i.nombre).split(/\s+\+\s+/);
  if (trozos.length > 1 && i.cantidad != null) {
    const resto = trozos.slice(1).map(leerIngrediente);
    if (resto.every((x) => x?.cantidad != null)) return [{ ...i, nombre: trozos[0] }, ...resto].flatMap((x) => unaCompra(x, escala));
  }
  return unaCompra(i, escala);
}
function unaCompra(i, escala) {
  const nombre = String(i.nombre).trim();
  const clave = claveCompra(nombre) || normal(nombre);
  const x = { clave, nombre: nombreCompra(nombre) || nombre };
  if (i.cantidad == null || !(Number(i.cantidad) > 0)) {
    // «Guarnición:» o «Para la salsa:» son títulos de la receta, no algo que comprar
    if (/:\s*$/.test(nombre)) return [];
    return [{ ...x, sin: true }];
  }
  const c = Number(i.cantidad) * Number(escala || 1);
  const u = i.unidad || 'ud';
  const eq = nombre.match(EQUIVALENCIA);
  const equiv = eq ? (EN_ML[eq[2].toLowerCase()] ? { ml: fraccion(eq[1]) * EN_ML[eq[2].toLowerCase()] * escala } : { g: fraccion(eq[1]) * (eq[2].toLowerCase() === 'kg' ? 1000 : 1) * escala }) : null;
  if (PESO[u]) return [{ ...x, g: c * PESO[u] }];
  if (VOLUMEN[u]) return [{ ...x, ml: c * VOLUMEN[u] }];
  if (CUCHARA[u] || MEDIDAS.has(u)) {
    if (equiv) return [{ ...x, ...equiv }];
    if (CUCHARA[u]) return [{ ...x, ml: c * CUCHARA[u] }];
  }
  return [{ ...x, piezas: { unidad: u, n: c, ...(equiv ? { aprox: equiv } : {}) } }];
}

// Las secciones del súper, por palabras de la clave: manda la que sale antes en el nombre («caldo de pollo», a la
// despensa; «zumo de limón», a la fruta) y, si empiezan igual, la más larga («mantequilla de cacahuete»)
export const SECCIONES_COMPRA = ['Proteínas', 'Verduras y fruta', 'Hidratos', 'Lácteos', 'Despensa', 'Otros'];
const PALABRAS_SECCION = [
  ['Proteínas', 'pollo pavo ternera cerdo lomo solomillo pechuga contramuslo carne hamburguesa jamón huevo clara salmón atún merluza bacalao lubina dorada sepia calamar gamba langostino mejillón sardina caballa tofu tempeh seitán proteína'],
  ['Verduras y fruta', 'tomate pimiento cebolla cebolleta calabacín zanahoria lechuga espinaca ajo puerro pepino apio champiñón seta calabaza col canónigo cogollo brócoli coliflor berenjena judía aguacate plátano manzana pera kiwi fresa arándano frambuesa fruto limón lima naranja mandarina uva melón sandía piña mango patata boniato ensalada rúcula cilantro perejil albahaca jengibre verdura'],
  ['Hidratos', 'arroz pasta espagueti macarrón pan avena copo quinoa cous ñoqui noodle tortilla cereal muesli müsli cracker tostada picatoste lenteja garbanzo alubia legumbre harina'],
  ['Lácteos', 'leche yogur skyr queso requesón kéfir nata mantequilla cuajada'],
  ['Despensa', 'aceite aove sal pimienta pimentón comino curry orégano tomillo laurel canela eneldo cúrcuma garam azafrán colorante guindilla especia salsa soja teriyaki vinagre mostaza caldo miel cacao chocolate crema nuez almendra anacardo avellana pistacho cacahuete semilla chía pipa sésamo maíz vino edulcorante gelatina levadura|mantequilla de cacahuete|nuez moscada|leche de coco'],
].flatMap(([s, txt]) => txt.split('|').flatMap((t, k) => (k ? [t] : t.split(' '))).map((p) => [claveCompra(p), s]));
export function seccionCompra(clave) {
  const k = ` ${clave} `;
  let mejor = null;
  for (const [p, s] of PALABRAS_SECCION) {
    const at = k.indexOf(` ${p} `);
    if (at >= 0 && (!mejor || at < mejor.at || (at === mejor.at && p.length > mejor.p.length))) mejor = { at, p, s };
  }
  return mejor ? mejor.s : 'Otros';
}

const sumaVacia = () => ({ g: 0, ml: 0, piezas: {}, sin: false });
function sumar(s, x) {
  if (x.sin) s.sin = true;
  if (x.g) s.g += x.g;
  if (x.ml) s.ml += x.ml;
  if (x.piezas) {
    const p = (s.piezas[x.piezas.unidad] ||= { n: 0, g: 0, ml: 0, todas: true });
    p.n += x.piezas.n;
    if (x.piezas.aprox) { p.g += x.piezas.aprox.g || 0; p.ml += x.piezas.aprox.ml || 0; } else p.todas = false;
  }
}
// «350 g», «1,25 kg», «70 ml», «1,5 l»
const textoMedida = (v, u) => { const r = escalarCantidad(v, u, 1); return r >= 1000 ? `${num(r / 1000, 2)} ${u === 'g' ? 'kg' : 'l'}` : `${num(r, 0)} ${u}`; };
const pluralUnidad = (u) => (/[aeiou]$/.test(u) ? `${u}s` : `${u}es`);
// Lo sumado en palabras: el peso, luego el volumen y luego las piezas, unidos con «+» («300 g + 2 filetes»).
// Las piezas, con su peso como pista si todas lo traían («7 (≈ 350 g)»). En el total, lo que va por piezas se
// redondea hacia arriba (media cebolla es una cebolla); lo de cada receta, de media en media.
function textoSuma(s, total = true) {
  const partes = [];
  if (s.g > 0) partes.push(textoMedida(s.g, 'g'));
  if (s.ml > 0) partes.push(textoMedida(s.ml, 'ml'));
  for (const [u, p] of Object.entries(s.piezas)) {
    const n = total && PIEZAS.has(u) ? Math.max(1, Math.ceil(p.n - 0.01)) : escalarCantidad(p.n, u, 1);
    const pista = p.todas && (p.g > 0) !== (p.ml > 0) ? ` (≈ ${p.g > 0 ? textoMedida(p.g, 'g') : textoMedida(p.ml, 'ml')})` : '';
    partes.push(`${num(n, 2)}${u === 'ud' ? '' : ` ${n > 1 ? pluralUnidad(u) : u}`}${pista}`);
  }
  return partes.join(' + ');
}
const masVeces = (m) => { let mejor = null; for (const [n, k] of m) if (!mejor || k > mejor[1]) mejor = [n, k]; return mejor?.[0]; };

// La lista de la compra de unos días: los ingredientes de las recetas del menú, multiplicados por el factor del
// atleta y las raciones apuntadas (y divididos por las raciones de la receta), sumados por lo que se compra
// (claveCompra) aunque estén escritos de otra forma. Lo escrito a mano va aparte («sin receta»).
// Devuelve { items: [{ clave, nombre, texto, cantidad, unidad, seccion, recetas, detalle, suma }], libres }:
//  - nombre: como más veces está escrito; texto: el total («7 (≈ 350 g)», «300 g + 2 filetes»; '' si no lleva cantidad);
//  - cantidad y unidad: el total si va en una sola unidad (g, ml o la de sus piezas), si no, null;
//  - detalle: lo de cada receta [{ receta, texto }]; suma: lo sumado sin redondear.
// Nada se pierde: lo que no se entiende va con su nombre, y lo que no lleva cantidad sale una vez.
// El factor con el que se apuntó algo del menú, sacado de sus kcal (las del equipo ajustadas al atleta no tienen
// asignación): kcal apuntadas / (kcal por ración × raciones), de 0,05 en 0,05. null si no se puede saber.
export function factorDeEntrada(e, r) {
  const k = Number(r?.kcal), ek = Number(e?.kcal), rac = Number(e?.raciones || 1);
  if (!(k > 0) || !(ek > 0) || !(rac > 0)) return null;
  const f = Math.round((ek / (k * rac)) * 20) / 20;
  return f >= 0.3 && f <= 4 ? f : null;
}
export function listaCompra(entradas = [], recetas = [], asignaciones = []) {
  const R = Object.fromEntries(recetas.map((r) => [r.id, r]));
  const factor = {};
  for (const a of asignaciones) factor[a.receta_id] = factor[a.receta_id] ?? Number(a.factor || 1);
  const grupos = new Map();
  const libres = [];
  for (const e of entradas) {
    const r = e.receta_id ? R[e.receta_id] : null;
    if (!r) { if (!libres.includes(e.texto)) libres.push(e.texto); continue; }
    const escala = (factor[r.id] ?? factorDeEntrada(e, r) ?? 1) * Number(e.raciones || 1) / Number(r.raciones || 1);
    for (const x of (r.ingredientes || []).flatMap((i) => paraComprar(i, escala))) {
      const g = grupos.get(x.clave) || { clave: x.clave, con: new Map(), sinC: new Map(), suma: sumaVacia(), porReceta: new Map() };
      const nombres = x.sin ? g.sinC : g.con;
      nombres.set(x.nombre, (nombres.get(x.nombre) || 0) + 1);
      sumar(g.suma, x);
      if (!g.porReceta.has(r.nombre)) g.porReceta.set(r.nombre, sumaVacia());
      sumar(g.porReceta.get(r.nombre), x);
      grupos.set(x.clave, g);
    }
  }
  const items = [...grupos.values()].map((g) => {
    const nombre = masVeces(g.con) || masVeces(g.sinC);
    const s = g.suma;
    const tipos = (s.g > 0) + (s.ml > 0) + Object.keys(s.piezas).length;
    const [u1, p1] = Object.entries(s.piezas)[0] || [];
    const unidad = tipos !== 1 ? null : s.g > 0 ? 'g' : s.ml > 0 ? 'ml' : u1;
    const cantidad = !unidad ? null : unidad === 'g' ? escalarCantidad(s.g, 'g', 1) : unidad === 'ml' ? escalarCantidad(s.ml, 'ml', 1)
      : PIEZAS.has(unidad) ? Math.max(1, Math.ceil(p1.n - 0.01)) : escalarCantidad(p1.n, unidad, 1);
    return {
      clave: g.clave, nombre, texto: textoSuma(s), cantidad, unidad, seccion: seccionCompra(g.clave),
      recetas: [...g.porReceta.keys()], detalle: [...g.porReceta].map(([receta, x]) => ({ receta, texto: textoSuma(x, false) })), suma: s,
    };
  }).sort((a, b) => SECCIONES_COMPRA.indexOf(a.seccion) - SECCIONES_COMPRA.indexOf(b.seccion) || a.nombre.localeCompare(b.nombre, 'es'));
  return { items, libres };
}
// La lista por secciones del súper, en su orden y sin las vacías: [{ seccion, items }]
export const porSecciones = (items = []) => SECCIONES_COMPRA.map((seccion) => ({ seccion, items: items.filter((i) => i.seccion === seccion) })).filter((x) => x.items.length);
// Una línea: «Huevos M: 7 (≈ 350 g)», «Sal y pimienta al gusto»
export const lineaCompra = (i) => (i.texto ? `${i.nombre}: ${i.texto}` : i.nombre);
// La lista en texto, para copiarla o compartirla (por secciones)
export function textoListaCompra({ items, libres }, titulo = 'Lista de la compra') {
  const lineas = [titulo];
  for (const { seccion, items: xs } of porSecciones(items)) { lineas.push('', `${seccion}:`); for (const i of xs) lineas.push(`☐ ${lineaCompra(i)}`); }
  if (libres.length) { lineas.push('', 'Sin receta:'); for (const t of libres) lineas.push(`☐ ${t}`); }
  return lineas.join('\n');
}

// El lunes de la semana que se ve en el menú (la actual, o la siguiente desde el sábado si la actual está vacía,
// lo decide la pantalla); aquí solo el de un día
export const lunesMenu = (iso) => lunesDe(iso);

// ------------------------------------------------------------ días sin una comida (v0.27)
// Algunos atletas se saltan una comida algunos días (los planes A y B de Notion: con y sin merienda) y las
// demás son algo más grandes. Cada receta de su recetario puede ser para los días con esa comida ('con'), para
// los días sin ella ('sin') o para todos (nada).
export const valeParaDia = (a, sin) => !a?.variante || a.variante === (sin ? 'sin' : 'con');
// «Días sin merienda»
export const textoVariante = (variante, opcional) => (variante && opcional ? `Días ${variante === 'sin' ? 'sin' : 'con'} ${NOMBRE_TOMA[opcional].toLowerCase()}` : null);
// Las comidas de un día: sin la opcional si ese día no la hace (salvo que ya tenga algo apuntado en ella)
export const tomasDelDia = (tomas, opcional, sin, conAlgo = []) => (sin && opcional ? tomas.filter((t) => t !== opcional || conAlgo.includes(t)) : tomas);
// Las recetas de una comida que valen un día: las de ese tipo de día y las de todos; si una receta está en las
// dos (para todos y, más grande, para los días sin merienda), solo la de ese día
export function paraElDia(asignaciones = [], sin) {
  const xs = asignaciones.filter((a) => valeParaDia(a, sin));
  const especificas = new Set(xs.filter((a) => a.variante).map((a) => `${a.receta_id}|${a.toma}`));
  return xs.filter((a) => a.variante || !especificas.has(`${a.receta_id}|${a.toma}`));
}
