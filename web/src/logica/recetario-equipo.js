// El recetario del equipo (migración 055): las recetas que el coach deja a la vista de todos sus atletas. Lógica pura:
// ordenarlas por capítulos, buscar, filtrar y preparar lo que se enseña de cada una. Sin red ni pantalla.
import { textoIngrediente, ordenarTomas } from './comidas.js';

const normal = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const libroDe = (r) => (r?.libro && typeof r.libro === 'object' && !Array.isArray(r.libro) ? r.libro : {});

// Sin capítulo (una receta suelta que el coach deja para todos), el de su primera comida del día
const CAPITULO_DE_TOMA = { desayuno: 'Desayunos', media_manana: 'Entre horas', comida: 'Comidas', merienda: 'Entre horas', cena: 'Cenas', recena: 'Entre horas' };
export const SIN_CAPITULO = 'Otras recetas';
export function capituloDe(r) {
  const c = String(libroDe(r).capitulo || '').trim();
  if (c) return c;
  const t = ordenarTomas(r?.tomas || [])[0];
  return CAPITULO_DE_TOMA[t] || SIN_CAPITULO;
}
export const bloqueDe = (r) => String(libroDe(r).bloque || '').trim();

// El orden del recetario: por su código («03.01») si lo tiene; lo demás, detrás y por nombre
const claveOrden = (r) => { const c = String(libroDe(r).codigo || ''); return /^\d/.test(c) ? `0${c}` : `1${normal(capituloDe(r))}`; };
export function ordenarRecetas(recetas = []) {
  return [...recetas].sort((a, b) => claveOrden(a).localeCompare(claveOrden(b)) || normal(a.nombre).localeCompare(normal(b.nombre)));
}

// [{ capitulo, n, bloques: [{ bloque, recetas }] }] en el orden del recetario
export function porCapitulos(recetas = []) {
  const caps = [];
  for (const r of ordenarRecetas(recetas)) {
    const c = capituloDe(r), b = bloqueDe(r);
    let cap = caps.find((x) => x.capitulo === c);
    if (!cap) { cap = { capitulo: c, n: 0, bloques: [] }; caps.push(cap); }
    let blo = cap.bloques.find((x) => x.bloque === b);
    if (!blo) { blo = { bloque: b, recetas: [] }; cap.bloques.push(blo); }
    blo.recetas.push(r);
    cap.n += 1;
  }
  return caps;
}
export const capitulos = (recetas = []) => porCapitulos(recetas).map((c) => ({ capitulo: c.capitulo, n: c.n }));

// Buscar: todas las palabras, sin tildes, en el nombre, el capítulo, el bloque, las etiquetas o los ingredientes
export function buscarRecetas(recetas = [], texto = '') {
  const palabras = normal(texto).split(' ').filter(Boolean);
  if (!palabras.length) return recetas;
  return recetas.filter((r) => {
    const donde = normal([r.nombre, capituloDe(r), bloqueDe(r), ...(r.etiquetas || []), ...(r.ingredientes || []).map((i) => i.nombre)].join(' '));
    return palabras.every((p) => donde.includes(p));
  });
}

// Filtros de un toque. favoritas: Set (o lista) de ids
export const FILTROS = [['todas', 'Todas'], ['favoritas', 'Favoritas'], ['rapidas', '15 min o menos'], ['varios_dias', 'Para varios días']];
export const esRapida = (r) => r?.minutos != null && Number(r.minutos) <= 15;
export const esParaVariosDias = (r) => /^s[i\u00ed]/i.test(String(libroDe(r).batch || ''));
export function filtrarRecetas(recetas = [], { filtro = 'todas', capitulo = null, texto = '', favoritas = null } = {}) {
  const favs = favoritas instanceof Set ? favoritas : new Set(favoritas || []);
  let xs = buscarRecetas(recetas, texto);
  if (capitulo) xs = xs.filter((r) => capituloDe(r) === capitulo);
  if (filtro === 'favoritas') xs = xs.filter((r) => favs.has(r.id));
  else if (filtro === 'rapidas') xs = xs.filter(esRapida);
  else if (filtro === 'varios_dias') xs = xs.filter(esParaVariosDias);
  return xs;
}

// «3 min», «1 h 30 min» o lo que diga el recetario («3 h (incl. reposo)»)
export function textoTiempo(r) {
  const t = String(libroDe(r).tiempo || '').trim();
  if (t) return t;
  const m = r?.minutos == null ? null : Number(r.minutos);
  if (m == null || !Number.isFinite(m)) return '';
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 60)} h`;
}

// Si se puede cocinar para varios días: «Para varios días», «Para varios días (8 porciones)», «Se adelanta en parte»; si no, nada
export function textoBatch(r) {
  const b = String(libroDe(r).batch || '').trim();
  const detalle = (b.match(/\(([^)]+)\)/) || [])[1];
  if (esParaVariosDias(r)) return `Para varios d\u00edas${detalle ? ` (${detalle})` : ''}`;
  if (/^parcial/i.test(b)) return `Se adelanta en parte${detalle ? ` (${detalle})` : ''}`;
  return '';
}

// Las líneas de ingredientes para «raciones» raciones. Cocinando justo lo que dice la receta, cada una lleva además su
// medida casera («200 g de yogur griego (1 envase)»); con otras cantidades no, porque ya no valdría.
export function lineasIngredientes(r, raciones = null) {
  const base = Number(r?.raciones || 1);
  const n = raciones == null ? base : Number(raciones);
  const escala = n / base;
  // (si alguien cambió los ingredientes después, las medidas ya no casan una a una y no se enseñan)
  const medidas = Array.isArray(libroDe(r).medidas) && libroDe(r).medidas.length === (r?.ingredientes || []).length ? libroDe(r).medidas : [];
  return (r?.ingredientes || []).map((i, k) => {
    const texto = textoIngrediente(i, escala);
    const medida = escala === 1 && typeof medidas[k] === 'string' && medidas[k].trim() ? medidas[k].trim() : null;
    return { texto, medida };
  });
}

// Los pasos de la preparación (uno por línea; si venían numerados, sin el número)
export const pasosDe = (r) => String(r?.preparacion || '').split('\n').map((l) => l.replace(/^\s*\d+[.)]\s+/, '').trim()).filter(Boolean);

// Para apuntarla en el menú: como una receta de su recetario, sin factor. La comida del día, la primera de la receta
// que el atleta haga; si ninguna encaja (una salsa), la primera de las suyas.
export function comoAsignacion(r, tomasAtleta = []) {
  const suyas = ordenarTomas(tomasAtleta || []);
  const toma = ordenarTomas(r?.tomas || []).find((t) => suyas.includes(t)) || suyas[0] || ordenarTomas(r?.tomas || [])[0] || 'comida';
  return { id: null, receta_id: r.id, receta: r, toma, factor: 1, favorita: false, variante: null, nota: null };
}

// Lo que se dice arriba: «75 recetas en 6 capítulos»
export function resumenRecetario(recetas = []) {
  const n = recetas.length, c = capitulos(recetas).length;
  if (!n) return '';
  return `${n === 1 ? '1 receta' : `${n} recetas`}${c > 1 ? ` en ${c} capítulos` : ''}`;
}

// La fila que se guarda en «libro» desde un formulario: solo las claves conocidas, con texto. Devuelve null si no queda nada.
const CLAVES_LIBRO = ['capitulo', 'bloque', 'codigo', 'descripcion', 'nota', 'encaje', 'dificultad', 'batch', 'objetivo', 'rendimiento', 'porcion', 'tiempo'];
const LARGAS = ['descripcion', 'nota', 'encaje'];
export function limpiarLibro(libro) {
  const l = libroDe({ libro });
  const out = {};
  for (const k of CLAVES_LIBRO) {
    const v = String(l[k] ?? '').trim().slice(0, LARGAS.includes(k) ? 1200 : 80);
    if (v) out[k] = v;
  }
  if (Array.isArray(l.medidas) && l.medidas.some((m) => typeof m === 'string' && m.trim())) {
    out.medidas = l.medidas.slice(0, 40).map((m) => (typeof m === 'string' && m.trim() ? m.trim().slice(0, 60) : null));
  }
  return Object.keys(out).length ? out : null;
}
