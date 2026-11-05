// v0.64 (4): «Máquina ocupada · hacerlo luego» y cambiar el orden de lo que queda de la sesión. El orden es solo de esta
// sesión y de este móvil (se guarda con la sesión en curso, como el ejercicio cambiado o el sitio donde entrenas): nunca
// cambia lo que pautó el coach. Las superseries se mueven enteras (un bloque = un ejercicio suelto o una superserie). Como
// todo lo de la sesión sale del orden de la lista (la serie que toca, «Ahora toca», la píldora, la pantalla de bloqueo, los
// tramos de arriba, el modo enfoque), basta con reordenar la lista.
// Y el coach ve el orden de verdad (ordenReal), sacado de la hora de cada serie, que ya se guarda: sin migración.
// Funciones puras, probadas en test/logica.test.mjs.
import { gruposSuperserie } from './calculos.js';
import { pautadasHechas } from './visual.js';

// Los bloques de una lista de ejercicios, en su orden: { clave (el id del primero), ids, letra }
export function bloquesSesion(ejercicios = []) {
  return gruposSuperserie(ejercicios || []).map((g) => ({ clave: g.items[0].id, ids: g.items.map((e) => e.id), letra: g.letra || null }));
}

// Lo que se guarda: la lista de ids en el orden elegido (cada uno, una vez; nada raro)
export function ordenValido(orden) {
  return Array.isArray(orden) && orden.length > 0 && orden.length <= 200 && orden.every((x) => typeof x === 'string' && x.length > 0 && x.length <= 64)
    && new Set(orden).size === orden.length;
}

// La lista en el orden elegido. Se ordenan los bloques de lo pautado (nunca se parte una superserie) por la posición en
// `orden` de su primer ejercicio que aparezca; los que no salen (un ejercicio que el coach añadió después), detrás, en su
// orden. Sin orden (o si no cambia nada), la lista tal cual. Reordenada, cada ejercicio lleva su bloque (_bloque) para que
// dos bloques con la misma letra no se junten.
export function aplicarOrden(ejercicios = [], orden = null) {
  const lista = ejercicios || [];
  if (!ordenValido(orden) || lista.length < 2) return lista;
  const pos = new Map(orden.map((id, i) => [id, i]));
  const bl = gruposSuperserie(lista).map((g, i) => {
    const ps = g.items.map((e) => pos.get(e.id)).filter((x) => x != null);
    return { g, i, p: ps.length ? Math.min(...ps) : Infinity };
  });
  const nuevo = [...bl].sort((a, b) => (a.p - b.p) || (a.i - b.i));
  if (nuevo.every((x, i) => x.i === i)) return lista;
  return nuevo.flatMap(({ g }) => g.items.map((e) => ({ ...e, _bloque: g.items[0].id })));
}

// ¿Está hecho un bloque? (todas sus series pautadas: las añadidas no cuentan)
const bloqueHecho = (b, porId, hechas) => b.ids.every((id) => pautadasHechas(porId[id], hechas?.[id] || {}));

// Los bloques que quedan (sin acabar), en el orden de ahora
export function bloquesPendientes(ejercicios = [], hechas = {}) {
  const porId = Object.fromEntries((ejercicios || []).map((e) => [e.id, e]));
  return bloquesSesion(ejercicios).filter((b) => !bloqueHecho(b, porId, hechas));
}

// Pone los bloques que quedan en el orden de `claves` (sus claves) en los huecos que ocupaban: los ya hechos no se mueven.
// Devuelve el orden para guardar (todos los ids) o null si no cambia nada o las claves no son las que quedan.
export function reordenarPendientes(ejercicios = [], hechas = {}, claves = []) {
  const porId = Object.fromEntries((ejercicios || []).map((e) => [e.id, e]));
  const todos = bloquesSesion(ejercicios);
  const pend = todos.filter((b) => !bloqueHecho(b, porId, hechas));
  const actuales = pend.map((b) => b.clave);
  if (!Array.isArray(claves) || claves.length !== actuales.length || [...claves].sort().join() !== [...actuales].sort().join()) return null;
  if (claves.every((c, i) => c === actuales[i])) return null;
  const porClave = Object.fromEntries(pend.map((b) => [b.clave, b]));
  let k = 0;
  const final = todos.map((b) => (pend.includes(b) ? porClave[claves[k++]] : b));
  return final.flatMap((b) => b.ids);
}

// «Máquina ocupada · hacerlo luego»: el bloque de seId pasa detrás de los que quedan. null si no se puede (ya está hecho o
// es el último que queda).
export function moverAlFinal(ejercicios = [], hechas = {}, seId) {
  const pend = bloquesPendientes(ejercicios, hechas);
  const i = pend.findIndex((b) => b.ids.includes(seId));
  if (i < 0 || i === pend.length - 1) return null;
  const claves = pend.map((b) => b.clave);
  const [c] = claves.splice(i, 1);
  claves.push(c);
  return reordenarPendientes(ejercicios, hechas, claves);
}

// «Subir» / «Bajar» (la alternativa a arrastrar): el bloque de seId, un puesto entre los que quedan. null si no se puede.
export function moverBloque(ejercicios = [], hechas = {}, seId, delta) {
  const pend = bloquesPendientes(ejercicios, hechas);
  const i = pend.findIndex((b) => b.ids.includes(seId));
  const j = i + (delta < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= pend.length) return null;
  const claves = pend.map((b) => b.clave);
  [claves[i], claves[j]] = [claves[j], claves[i]];
  return reordenarPendientes(ejercicios, hechas, claves);
}

// ¿Se puede dejar para luego? (sin acabar y con otro bloque sin acabar)
export function puedeDejarLuego(ejercicios = [], hechas = {}, seId) {
  const pend = bloquesPendientes(ejercicios, hechas);
  return pend.length > 1 && pend.some((b) => b.ids.includes(seId));
}

// La serie que había dicho la última serie marcada (proxima), tras reordenar: se queda si su bloque sigue siendo el primero
// de los que quedan (p. ej. a mitad de una ronda de superserie); si no (se ha dejado para luego o se ha puesto otro delante),
// se olvida y manda el orden nuevo (la primera serie sin hacer)
export function proximaTrasReordenar(ejercicios = [], hechas = {}, proxima = null) {
  if (!proxima) return null;
  const primero = bloquesPendientes(ejercicios, hechas)[0];
  return primero && primero.ids.includes(proxima.id) ? proxima : null;
}

// ---------- el coach: el orden de verdad ----------
// pautas: los ejercicios de la sesión en el orden del coach; series: { sesion_ejercicio_id: [series con registrada_en] }.
// Cada bloque hecho (con alguna serie) va al momento en que se hizo la mayor parte de sus series (la mediana de sus horas:
// una serie suelta antes de dejarlo para luego no lo adelanta). Si los bloques hechos van en otro orden que el pautado,
// devuelve la lista de bloques en el orden de verdad ({ clave, ids, letra }); si no (o con menos de dos), null.
export function ordenReal(pautas = [], series = {}) {
  const hechos = bloquesSesion(pautas).map((b, i) => {
    const t = b.ids.flatMap((id) => (series?.[id] || []).map((s) => Date.parse(s?.registrada_en))).filter(Number.isFinite).sort((x, y) => x - y);
    if (!t.length) return null;
    const m = t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2;
    return { ...b, i, t: m };
  }).filter(Boolean);
  if (hechos.length < 2) return null;
  const real = [...hechos].sort((a, b) => (a.t - b.t) || (a.i - b.i));
  if (real.every((b, k) => b.i === hechos[k].i)) return null;
  return real.map(({ clave, ids, letra }) => ({ clave, ids, letra }));
}
