// FBE Esencial (v0.259, el día a día: D10 de «claude/motores-siguientes-reglas.md», Iversen 2021; P: 'sesion_corta'):
// «¿Cuánto tiempo tienes hoy?» con 20-30 minutos: los multiarticulares primero, con sus series de siempre, y el resto por
// parejas en superserie (sin repetir zona: pierna con tren superior, o empuje con tirón). Con «Hacerlo así», en la sesión de
// hoy (lo pautado no cambia). Lógica pura.
import { patronEjercicio } from './diseno.js';
import { duracionEstimada } from './calculos.js';

export const CORTA_HASTA = 30;
const LETRAS = 'ABCDEFGH';
const tipos = (e) => { const t = e?.ejercicio?.tipo ?? e?.tipo ?? []; return Array.isArray(t) ? t : t ? [t] : []; };
const nombre = (e) => e?.ejercicio?.nombre || e?.nombre || 'Ejercicio';
const esMulti = (e) => e.prioridad === 'alta' || tipos(e).includes('basico') || tipos(e).includes('multiarticular');
// la zona que trabaja, para no juntar dos de la misma en una superserie
function zonaDe(e) {
  const p = patronEjercicio(nombre(e), e?.ejercicio?.grupos_musculares || e?.grupos_musculares || [], tipos(e));
  if (['sentadilla', 'unilateral', 'pierna', 'bisagra'].includes(p)) return 'pierna';
  if (['empuje_h', 'empuje_v'].includes(p)) return 'empuje';
  if (['tiron_h', 'tiron_v'].includes(p)) return 'tiron';
  return p;
}

// La sesión de hoy así colocada: los de `orden` en ese orden y, los de `superserie`, juntos con su letra (lo de siempre,
// sin superserie)
export function aplicarCorta(ejercicios = [], corta = null) {
  if (!corta?.orden?.length || !Array.isArray(ejercicios)) return ejercicios;
  const pos = new Map(corta.orden.map((id, i) => [id, i]));
  return [...ejercicios].sort((a, b) => (pos.get(a.id) ?? 999) - (pos.get(b.id) ?? 999))
    .map((e) => ({ ...e, superserie: corta.superserie?.[e.id] || null, _bloque: null }));
}

// → null (con más de 30 minutos, o con menos de 3 ejercicios, o si no hay nada que juntar) o
//   { orden: [ids], superserie: { id: letra }, primero: [nombres], pares: [[nombre, nombre]], minutos, antes }
export function sesionCorta(ejercicios = [], minutos = null) {
  const xs = (ejercicios || []).filter((e) => e && Number(e.series) > 0);
  if (!minutos || minutos > CORTA_HASTA || xs.length < 3) return null;
  const multi = xs.filter(esMulti);
  const libres = xs.filter((e) => !esMulti(e));
  const grupos = [];
  while (libres.length) {
    const a = libres.shift();
    const j = libres.findIndex((b) => zonaDe(b) !== zonaDe(a));
    grupos.push(j >= 0 ? [a, libres.splice(j, 1)[0]] : [a]);
  }
  const pares = grupos.filter((g) => g.length === 2);
  if (!pares.length) return null;
  const superserie = {};
  pares.forEach((g, i) => { for (const e of g) superserie[e.id] = LETRAS[i] || 'Z'; });
  const corta = { orden: [...multi, ...grupos.flat()].map((e) => e.id), superserie };
  return { ...corta, primero: multi.map(nombre), pares: pares.map((g) => g.map(nombre)), minutos: duracionEstimada(aplicarCorta(xs, corta)), antes: duracionEstimada(xs) };
}

export function textoCorta(c, minutos) {
  if (!c) return null;
  const pares = c.pares.map(([a, b]) => `${a.toLowerCase()} con ${b.toLowerCase()}`).join('; ');
  return `Con ${minutos} minutos: ${c.primero.length ? `primero ${c.primero.map((n) => n.toLowerCase()).join(', ')}, con sus series de siempre; después, ` : ''}en superserie (uno detrás de otro y descansas al acabar los dos): ${pares}. Te quedaría en unos ${c.minutos} minutos (antes, unos ${c.antes}).`;
}
