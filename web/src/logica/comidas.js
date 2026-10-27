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
  const nombre = i.nombre.charAt(0).toLowerCase() + i.nombre.slice(1);
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

// La lista de la compra de unos días: los ingredientes de las recetas del menú, multiplicados por el factor del
// atleta y las raciones apuntadas (y divididos por las raciones de la receta), sumados si coinciden nombre y
// unidad. Lo escrito a mano va aparte («sin receta»). Devuelve { items: [{ nombre, cantidad, unidad, recetas }], libres }
export function listaCompra(entradas = [], recetas = [], asignaciones = []) {
  const R = Object.fromEntries(recetas.map((r) => [r.id, r]));
  const factor = {};
  for (const a of asignaciones) factor[a.receta_id] = factor[a.receta_id] ?? Number(a.factor || 1);
  const items = new Map();
  const libres = [];
  for (const e of entradas) {
    const r = e.receta_id ? R[e.receta_id] : null;
    if (!r) { if (!libres.includes(e.texto)) libres.push(e.texto); continue; }
    const escala = (factor[r.id] ?? 1) * Number(e.raciones || 1) / Number(r.raciones || 1);
    for (const i of r.ingredientes || []) {
      const clave = `${normal(i.nombre)}|${i.cantidad == null ? '' : i.unidad || ''}`;
      const x = items.get(clave) || { nombre: i.nombre, unidad: i.cantidad == null ? null : i.unidad || null, cantidad: i.cantidad == null ? null : 0, recetas: [] };
      if (i.cantidad != null) x.cantidad += Number(i.cantidad) * escala;
      if (!x.recetas.includes(r.nombre)) x.recetas.push(r.nombre);
      items.set(clave, x);
    }
  }
  // Lo que se compra por piezas (media cebolla, un cuarto de pimiento) se redondea hacia arriba a piezas enteras
  const porPiezas = (u) => !u || /^(ud|diente|lata|pieza|filete|rebanada|loncha|hoja)$/.test(u);
  const lista = [...items.values()].map((x) => ({ ...x, cantidad: x.cantidad == null ? null : porPiezas(x.unidad) ? Math.max(1, Math.ceil(x.cantidad - 0.01)) : escalarCantidad(x.cantidad, x.unidad, 1) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return { items: lista, libres };
}
// La lista en texto, para copiarla o compartirla
export function textoListaCompra({ items, libres }, titulo = 'Lista de la compra') {
  const lineas = [titulo, ''];
  for (const i of items) lineas.push(`☐ ${i.cantidad == null ? i.nombre : textoIngrediente({ nombre: i.nombre, cantidad: i.cantidad, unidad: i.unidad })}`);
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
