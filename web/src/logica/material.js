// «¿Dónde entrenas hoy?» (v0.48, como los perfiles de gimnasio de Fitbod o Hevy). Gimnasio (lo de siempre), Casa o
// Viaje, cada uno con el material que tiene (se guarda en el móvil). Al elegir uno, la sesión cambia cada ejercicio
// que no se puede hacer con ese material por la primera alternativa que marcó el coach y que sí se puede; si
// ninguna vale, se queda y se avisa. Nunca se inventan alternativas. El material de cada ejercicio se deduce de su
// nombre (la biblioteca no lo guarda aparte), con reglas prudentes: si el nombre da a elegir («con barra/mancuernas»),
// vale cualquiera de ellos.
import { normal } from './busqueda.js';

export const MATERIAL_PERFIL = [
  ['barra', 'Barra y discos'], ['rack', 'Rack o jaula'], ['banco', 'Banco'], ['mancuernas', 'Mancuernas'],
  ['kettlebells', 'Kettlebells'], ['poleas', 'Poleas'], ['maquinas', 'Máquinas'], ['multipower', 'Multipower'],
  ['gomas', 'Gomas'], ['dominadas', 'Barra de dominadas o paralelas'],
];
export const NOMBRE_MATERIAL = Object.fromEntries(MATERIAL_PERFIL);
export const LUGARES_ENTRENO = [['gimnasio', 'Gimnasio'], ['casa', 'Casa'], ['viaje', 'Viaje']];
// Lo que suele haber (luego cada uno marca lo suyo): en casa, mancuernas y gomas; de viaje, el gimnasio de un hotel
export const PERFILES_DEFECTO = { casa: ['mancuernas', 'gomas', 'banco'], viaje: ['mancuernas', 'poleas', 'maquinas', 'banco'] };

// Lo que reconoce cada material en un nombre (sin tildes ni mayúsculas)
const RECONOCE = [
  ['multipower', /\bmultipower\b|\bmp\b|\bsmith\b/],
  ['maquinas', /\bmaquinas?\b|\bmaq\b|\bpec-?deck\b|\bpec-?fly\b|\bcontractora\b|\bprensa\b|\bhack\b|\bpendulum\b|\bbelt squat\b|\bleg curl\b|\bleg extensions?\b|\babducciones?\b|\baductor\b|\bbutterfly\b|\btechnogym\b/],
  ['poleas', /\bpoleas?\b|\bcables?\b|\bjalon\b|\bface pull\b|\bgironda\b|\bpallof\b|\bkatana\b|\bpull through\b|\bbayesian\b/],
  ['mancuernas', /\bmancuernas?\b|\bhex press\b/],
  ['kettlebells', /\bkettlebells?\b|\bpesas? rusas?\b|\bswings?\b/],
  ['gomas', /\bgomas?\b|\bbandas? elasticas?\b/],
  ['dominadas', /\bdominadas?\b|\bhanging\b|\bparalelas\b|\bfondos\b/],
  ['barra', /\bbarras?\b(?! v)|\btrap bar\b|\blandmine\b|\bsafety\b|\bpendlay\b|\bmeadows\b|\bremo en (punta|t)\b|\bpress banca\b|\bpeso muerto (convencional|sumo|rumano con barra)\b|\brompecraneos\b|\bsentadilla (barra|frontal)\b|\bhatfield\b|\bbuenos dias\b/],
];
// Lo que no necesita nada (el peso del cuerpo o un trozo de suelo)
const SIN_MATERIAL = /\bcrunch tumbado\b|\bv-?ups\b|\bpuente de gluteo\b|\bzancadas\b|\bab wheel\b|\bcopenhague\b|\bstep up\b|\bflexiones\b|\bplancha\b|\bburpees?\b|\bsentadilla (sin peso|al aire|libre)\b|\bpeso corporal\b/;

// El material que pide un ejercicio, por su nombre: una lista de opciones (cada una, lo que hace falta a la vez);
// [] si no hace falta nada; null si no se sabe (entonces no se toca)
export function materialNecesario(nombre) {
  const n = normal(nombre || '');
  if (!n) return null;
  const hay = RECONOCE.filter(([, re]) => re.test(n)).map(([k]) => k);
  // La barra de una polea (barra en V, recta) o de un multipower no es la barra libre
  const sinBarra = hay.includes('poleas') || hay.includes('multipower') || hay.includes('maquinas');
  const lista = hay.filter((k) => !(k === 'barra' && sinBarra && !/\/|\bo\b/.test(n)));
  if (!lista.length) {
    if (SIN_MATERIAL.test(n)) return [];
    // Hip thrust a secas: barra y banco
    if (/\bhip thrust\b/.test(n)) return [['barra', 'banco']];
    return null;
  }
  // Varios materiales y el nombre da a elegir («con barra/mancuernas», «en MP/con barra/en polea baja»): cualquiera
  if (lista.length > 1 && /\//.test(n)) return lista.map((k) => conBanco([k], n));
  // Un banco donde lo dice el nombre (o un press tumbado), y rack con la barra en las sentadillas
  return [conBanco(lista, n)];
}
function conBanco(lista, n) {
  const x = new Set(lista);
  if ((x.has('barra') || x.has('mancuernas')) && (/\bbanco\b|\bpress banca\b|\bpress (plano|inclinado|declinado)\b|\btumbado\b|\bseal row\b|\bhip thrust\b/.test(n))) x.add('banco');
  if (x.has('barra') && /\bsentadilla\b|\bsplit squat\b|\bhatfield\b|\bpress militar con barra\b/.test(n)) x.add('rack');
  return [...x];
}

// ¿Se puede hacer con este material? Sin saber qué pide, sí (se deja como está)
export function sePuedeCon(nombre, disponible) {
  const req = materialNecesario(nombre);
  if (req == null) return true;
  if (!req.length) return true;
  const d = new Set(disponible || []);
  return req.some((opcion) => opcion.every((k) => d.has(k)));
}

// Adapta una sesión al material: { cambios: { pautaId: ejercicioAlternativo }, sinAlternativa: [pautaId] }.
// ejercicios: las pautas de api.sesion (con ejercicio y alternativas, en el orden del coach). Las que ya tienen
// series hechas o un cambio elegido a mano no se tocan (lo registrado sigue con su ejercicio).
export function adaptarSesion(ejercicios = [], disponible = [], { fijos = new Set() } = {}) {
  const cambios = {}, sinAlternativa = [];
  for (const e of ejercicios) {
    if (fijos.has(e.id) || e.hechas?.length) continue;
    if (sePuedeCon(e.ejercicio?.nombre, disponible)) continue;
    const alt = (e.alternativas || []).find((a) => a && a.activo !== false && sePuedeCon(a.nombre, disponible) && materialNecesario(a.nombre) != null);
    if (alt) cambios[e.id] = alt;
    else sinAlternativa.push(e.id);
  }
  return { cambios, sinAlternativa };
}

// «3 ejercicios cambiados por tu material» (y lo que no tiene alternativa)
export function textoAdaptacion({ cambios = {}, sinAlternativa = [] }, lugar = 'casa') {
  const n = Object.keys(cambios).length, m = sinAlternativa.length;
  const donde = lugar === 'viaje' ? 'de viaje' : 'de casa';
  if (!n && !m) return `Todo se puede hacer con tu material ${donde}`;
  const a = n ? `${n} ${n === 1 ? 'ejercicio cambiado' : 'ejercicios cambiados'} por tu material` : '';
  const b = m ? `${m} sin alternativa con tu material` : '';
  return [a, b].filter(Boolean).join('; ');
}
