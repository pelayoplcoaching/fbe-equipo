// Variantes de material (v0.30). En la biblioteca hay un ejercicio por material (press militar con mancuernas, en
// máquina, con barra…): los kilos de uno no valen para otro, y cada uno tiene su vídeo. En Notion el material a
// veces iba en la «variante» («Press militar sentado con mancuernas», variante «En máquina»): aquí se detecta cuando
// la variante nombra un material distinto del que dice el ejercicio y se proponen los ejercicios que cuadran.
import { normal } from './busqueda.js';

// Material: clave → texto y cómo se reconoce (en texto ya sin tildes ni mayúsculas)
export const MATERIALES = [
  ['maquina', 'máquina', /\bmaquinas?\b|\btechnogym\b|\bpec-?deck\b|\bcontractora\b/],
  ['mancuernas', 'mancuernas', /\bmancuernas?\b/],
  ['barra', 'barra', /\bbarras?\b/],
  ['multipower', 'multipower', /\bmultipower\b|\bmp\b|\bsmith\b/],
  ['polea', 'polea', /\bpoleas?\b|\bcables?\b/],
  ['goma', 'goma elástica', /\bgomas?\b|\bbandas? elasticas?\b|\bband\b|\bbanda\b/],
  ['kettlebell', 'pesa rusa', /\bpesas? rusas?\b|\bkettlebells?\b/],
];
const TEXTO = Object.fromEntries(MATERIALES.map(([k, t]) => [k, t]));
// Ejercicios que llevan el material en el nombre sin decirlo
const IMPLICITOS = [[/^press banca\b/, 'barra'], [/^peso muerto (convencional|sumo)\b/, 'barra']];

export function materialesDe(texto) {
  const n = normal(texto);
  const out = new Set(MATERIALES.filter(([, , re]) => re.test(n)).map(([k]) => k));
  return out;
}
function materialesEjercicio(nombre) {
  const out = materialesDe(nombre);
  const n = normal(nombre);
  for (const [re, k] of IMPLICITOS) if (!out.size && re.test(n)) out.add(k);
  return out;
}

// ¿La variante deja a elegir («O con barra», «Apoyado en banco, o en máquina»)? Si antes de la «o» no se nombra otro
// material, lo primero es el propio ejercicio y lo de después, una opción: no contradice
function esOpcion(variante) {
  const n = normal(variante);
  const m = /(^|[^a-z0-9])(o|u)\s/.exec(n);
  return !!m && materialesDe(n.slice(0, m.index)).size === 0;
}
// El material que nombra la variante, para un ejercicio: sin lo negado («sin máquina»); la barra de una polea (barra
// en V, barra recta) o de un multipower no es la barra libre; una goma solo cambia el ejercicio si sustituye a una polea
// (con barra o mancuernas es resistencia añadida)
function materialesVariante(variante, enNombre) {
  const n = normal(variante).replace(new RegExp(`\\bsin (${MATERIALES.map(([, , re]) => re.source).join('|')})`, 'g'), ' ');
  const out = materialesDe(n);
  if (enNombre.has('polea') || enNombre.has('multipower')) out.delete('barra');
  if (!enNombre.has('polea')) out.delete('goma');
  return out;
}

// Palabras que dan nombre al movimiento (sin material ni palabras de enlace), para buscar los «hermanos»
const VACIAS = new Set(['con', 'en', 'de', 'desde', 'a', 'al', 'la', 'el', 'las', 'los', 'una', 'un', 'y', 'o', 'u', 'por', 'sobre', 'para']);
const QUITA_MATERIAL = new RegExp(MATERIALES.map(([, , re]) => re.source).join('|'), 'g');
export function palabrasMovimiento(nombre) {
  return normal(nombre).replace(QUITA_MATERIAL, ' ').split(/[^a-z0-9]+/).filter((w) => w && !VACIAS.has(w));
}

// Lo que sobra de la variante si se cambia al ejercicio del material que nombra: nada si solo decía el material
// («En máquina», «Máquina», «Con mancuernas»), o el resto tal cual si decía algo más («Máquina Technogym de discos»)
export function varianteSinMaterial(variante) {
  if (variante == null) return null;
  const n = normal(variante).replace(QUITA_MATERIAL, ' ').split(/[^a-z0-9]+/).filter((w) => w && !VACIAS.has(w));
  return n.length ? variante : null;
}

// Revisa una pauta: { ejercicio: {id, nombre, alternativas}, variante }, con la biblioteca para proponer.
// Devuelve null si cuadra, o { tipo: 'contradice', variante: ['maquina'], ejercicio: ['mancuernas'], texto, propuestas: [ej…] }
export function revisarVariante(ejercicio, variante, biblioteca = []) {
  if (!ejercicio || !variante || !String(variante).trim()) return null;
  const enNombre = materialesEjercicio(ejercicio.nombre || '');
  const enVariante = materialesVariante(variante, enNombre);
  if (!enNombre.size || !enVariante.size || esOpcion(variante)) return null;
  if ([...enVariante].some((k) => enNombre.has(k))) return null; // «Mancuernas/Máquina» con mancuernas: es a elegir
  const porId = new Map(biblioteca.map((e) => [e.id, e]));
  const porNombre = new Map(biblioteca.map((e) => [e.nombre, e]));
  const propias = palabrasMovimiento(ejercicio.nombre);
  const parecido = (e) => palabrasMovimiento(e.nombre).filter((w) => propias.includes(w)).length;
  // Primero las alternativas que ya tiene en la biblioteca (por id o por nombre), después los de nombre parecido
  const alternativas = (ejercicio.alternativas || []).map((a) => porId.get(a) || porNombre.get(a)).filter(Boolean);
  const candidatos = [...new Map([...alternativas, ...biblioteca].map((e) => [e.id, e])).values()]
    .filter((e) => e.id !== ejercicio.id && [...materialesEjercicio(e.nombre)].some((k) => enVariante.has(k)));
  const puntua = (e) => (alternativas.includes(e) ? 100 : 0) + parecido(e) * 10 - palabrasMovimiento(e.nombre).length;
  // Si alguna de sus alternativas es del material que dice la variante, solo esas; si no, las de nombre parecido
  const deAlternativas = candidatos.filter((e) => alternativas.includes(e));
  // De nombre parecido: el mismo movimiento (dos palabras en común, o la única si el nombre solo tiene una y el otro
  // también): «remo» a secas no basta para proponer «Remo en T en máquina»
  const mismo = (e) => parecido(e) >= 2 || (propias.length === 1 && palabrasMovimiento(e.nombre).length === 1 && parecido(e) === 1);
  let parecidos = candidatos.filter((e) => mismo(e) && palabrasMovimiento(e.nombre)[0] === propias[0]);
  const mejor = Math.max(0, ...parecidos.map(parecido));
  parecidos = parecidos.filter((e) => parecido(e) === mejor); // solo los que más se parecen (press militar, no press plano)
  const propuestas = (deAlternativas.length ? deAlternativas : parecidos)
    .sort((a, b) => puntua(b) - puntua(a) || a.nombre.localeCompare(b.nombre, 'es')).slice(0, 3);
  const lista = (s) => [...s].map((k) => TEXTO[k]).join(' o ');
  return {
    tipo: 'contradice',
    variante: [...enVariante], ejercicio: [...enNombre],
    texto: `La variante dice ${lista(enVariante)}, pero el ejercicio es con ${lista(enNombre)}.`,
    propuestas,
  };
}

// Los ejercicios equivalentes de otro material para el desplegable del editor: sus alternativas de la biblioteca
// y quien las tenga a él como alternativa (la relación no siempre está apuntada en los dos sentidos)
export function equivalentes(ejercicio, biblioteca = []) {
  if (!ejercicio) return [];
  const porId = new Map(biblioteca.map((e) => [e.id, e]));
  const porNombre = new Map(biblioteca.map((e) => [e.nombre, e]));
  const suyas = (ejercicio.alternativas || []).map((a) => porId.get(a) || porNombre.get(a)).filter(Boolean);
  const inversas = biblioteca.filter((e) => (e.alternativas || []).includes(ejercicio.id) || (e.alternativas || []).includes(ejercicio.nombre));
  return [...new Map([...suyas, ...inversas].map((e) => [e.id, e])).values()]
    .filter((e) => e.id !== ejercicio.id)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
