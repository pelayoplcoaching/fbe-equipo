// (v0.214, estilos más baratos de calcular) Cada vez que el navegador calcula los estilos de un elemento prueba solo las
// reglas que «pueden» ser suyas: las que acaban en una de sus clases, su id, su etiqueta o uno de sus atributos. Las que no
// acaban en nada de eso (las «universales») se prueban en TODOS los elementos, y un :is()/:where() con varias opciones
// cuenta como «nada de eso». Peor aún delante de un combinador: «:is(.a, .b) ::selection» no deja descartar deprisa y, en cada
// elemento, se miran uno a uno todos sus antepasados. Medido en Chromium (2026-11): 287 reglas así se llevaban más de la
// mitad del tiempo de recalcular estilos (cambiar de semana en el editor del coach, 4×: 638 → 285 ms sin ellas).
//
// Aquí, sobre lo construido, sin cambiar a qué se aplica nada ni con qué fuerza:
//   · «X:is(.a, .b)Y» → «X:is(.a)Y, X:is(.b)Y» si la parte del :is()/:where() no tiene otra clase, id, etiqueta ni atributo
//     (si ya la tiene, el navegador ya la descarta deprisa). Con :where() no cambia la especificidad (no suma); con :is(),
//     que pesa lo que su opción más pesada, las más ligeras se «rellenan» repitiendo su última clase («.num.num» pesa dos
//     clases y es lo mismo que «.num»); si no se puede, se queda como estaba. Cada opción sigue dentro de su :is() o :where()
//     de una sola opción, que perdona lo que el navegador no entienda igual que antes. Una opción con combinadores
//     («.x .a») va como «:is(.a):is(.x *)»: dentro de un :is()/:where(), «.x .a» no va a ningún cubo y, peor, se miran todos
//     los antepasados; así va al cubo de .a. Si una regla saldría con más de MAX selectores, esa parte se queda como estaba.
//   · «::view-transition-…(x)» → «:where(html)::view-transition-…(x)»: solo se piden en la raíz y, sin nada delante, se
//     probaban en todos los elementos.
// Lo demás (reglas con «*», con «> *», …) ya se descarta deprisa por sus antepasados.
import { leer, partir, especificidad } from './css-coach.mjs';

const MAX = 16;

// Los trozos de un selector complejo: [{ comb: '' | ' ' | '>' | '+' | '~', comp }]
export function trozos(sel) {
  const s = String(sel).trim();
  const out = [];
  let prof = 0, q = null, ini = 0, comb = '';
  const cerrar = (fin) => { const c = s.slice(ini, fin).trim(); if (c) out.push({ comb, comp: c }); };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '\\') { i++; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '(' || c === '[') { prof++; continue; }
    if (c === ')' || c === ']') { prof--; continue; }
    if (prof) continue;
    if (/\s/.test(c) || c === '>' || c === '+' || c === '~') {
      cerrar(i);
      let j = i, k = ' ';
      while (j < s.length && (/\s/.test(s[j]) || s[j] === '>' || s[j] === '+' || s[j] === '~')) { if (s[j] !== ' ' && !/\s/.test(s[j])) k = s[j]; j++; }
      comb = k; ini = j; i = j - 1;
    }
  }
  cerrar(s.length);
  return out;
}
const escribirTrozos = (ts) => ts.map((t, i) => (i === 0 ? t.comp : t.comb === ' ' ? ` ${t.comp}` : `${t.comb}${t.comp}`)).join('');

// Lo de primer nivel de un compuesto (sin lo de dentro de paréntesis ni corchetes)
const primerNivel = (comp) => {
  let s = '', prof = 0, q = null;
  for (let i = 0; i < comp.length; i++) {
    const c = comp[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '(') { prof++; continue; }
    if (c === ')') { prof--; continue; }
    if (c === '[') { if (!prof) s += '['; prof++; continue; }
    if (c === ']') { prof--; continue; }
    if (!prof) s += c;
  }
  return s;
};
// ¿Tiene algo que sirva de cubo o de descarte rápido: clase, id, atributo o etiqueta (no «*»)? También vale un :is() o
// :where() de una sola opción que lo tenga (Chromium lo mete en el cubo de esa opción)
export const tieneClave = (comp) => {
  const p = primerNivel(comp);
  if (/^[a-zA-Z]/.test(p) || /[.#[]/.test(p.replace(/:[a-zA-Z-]+/g, ''))) return true;
  return unaOpcion(comp).some((o) => compuesto(o) && tieneClave(o));
};
// ¿Es un selector compuesto (sin combinadores ni pseudo-elementos)?
const compuesto = (x) => trozos(x).length === 1 && !/::|:(before|after|first-line|first-letter)(?![a-zA-Z-])/i.test(primerNivel(x));
// Las opciones de los :is()/:where() de primer nivel de un compuesto que solo tienen una
function unaOpcion(comp) {
  const out = [];
  for (const m of pseudos(comp)) if (m.opciones.length === 1) out.push(m.opciones[0]);
  return out;
}

// Los :is()/:where() de primer nivel de un compuesto: [{ ini, fin, nombre, opciones }]
function pseudos(comp) {
  const out = [];
  let prof = 0, q = null;
  for (let i = 0; i < comp.length; i++) {
    const c = comp[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '(' || c === '[') { prof++; continue; }
    if (c === ')' || c === ']') { prof--; continue; }
    if (prof || c !== ':') continue;
    const m = /^:(is|where)\(/i.exec(comp.slice(i));
    if (!m) continue;
    // su paréntesis de cierre
    let p = 0, q2 = null, j = i + m[0].length - 1;
    for (; j < comp.length; j++) {
      const d = comp[j];
      if (q2) { if (d === '\\') j++; else if (d === q2) q2 = null; continue; }
      if (d === '"' || d === "'") q2 = d;
      else if (d === '(') p++;
      else if (d === ')') { p--; if (p === 0) break; }
    }
    out.push({ ini: i, fin: j + 1, nombre: m[1].toLowerCase(), opciones: partir(comp.slice(i + m[0].length, j)) });
    i = j;
  }
  return out;
}
// El primer :is()/:where() de primer nivel de un compuesto con varias opciones (o null)
export const multiple = (comp) => pseudos(comp).find((m) => m.opciones.length > 1) || null;

// Una opción de un :is()/:where() escrita para que vaya a un cubo, con la misma especificidad y a lo mismo:
//   · compuesta («.a:hover»): tal cual, sola en su :is()/:where();
//   · con combinadores («.x .a», «.x>.a»): «:is(.a):is(.x *)» (el elemento es .a y tiene un .x encima; «*» no pesa nada, así
//     que pesa lo mismo que «.x .a»): va al cubo de .a y lo de encima solo se mira en esos elementos;
//   · con «relleno» (un :is() con opciones de distinto peso): su última clase repetida («.num.num» es lo mismo que «.num» y
//     pesa como dos clases) hasta pesar lo que la más pesada. Solo si lo que le falta son clases y tiene alguna.
// null si no se puede (su última parte sin nada que sirva de cubo, o con pseudo-elemento).
function opcionEnCubo(nombre, o, relleno = 0) {
  const ts = trozos(o);
  const ultima = ts[ts.length - 1].comp;
  if (!tieneClave(ultima) || /::|:(before|after|first-line|first-letter)(?![a-zA-Z-])/i.test(primerNivel(o))) return null;
  let u = ultima;
  if (relleno) {
    const cls = [...primerNivel(ultima).matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)].map((m) => m[1]).pop();
    if (!cls) return null;
    u += `.${cls}`.repeat(relleno);
  }
  if (ts.length === 1) return `:${nombre}(${u})`;
  return `:${nombre}(${u}):${nombre}(${escribirTrozos([...ts.slice(0, -1), { comb: ts[ts.length - 1].comb, comp: '*' }])})`;
}
// Lo que le falta a una opción para pesar como la más pesada del :is(), si solo le faltan clases (o null)
function rellenoDe(o, tope) {
  const d = tope - especificidad(o);
  return d >= 0 && d % 1000 === 0 && d < 1e6 ? d / 1000 : null;
}

// Un selector complejo partido en varios (o el mismo, en una lista de uno). De derecha a izquierda: la última parte primero
// (la que decide el cubo); una parte que haría pasar de MAX selectores se deja como está
export function partirSelector(sel) {
  const ts = trozos(sel);
  let lista = [ts];
  for (let k = ts.length - 1; k >= 0; k--) {
    const comp = ts[k].comp;
    if (tieneClave(comp)) continue;
    const m = multiple(comp);
    if (!m) continue;
    let nuevasOpciones;
    if (m.nombre === 'where') nuevasOpciones = m.opciones.map((o) => opcionEnCubo('where', o));
    else {
      const tope = Math.max(...m.opciones.map(especificidad));
      nuevasOpciones = m.opciones.map((o) => { const r = rellenoDe(o, tope); return r == null ? null : opcionEnCubo('is', o, r); });
    }
    if (nuevasOpciones.some((x) => x == null)) continue;
    if (lista.length * nuevasOpciones.length > MAX) continue;
    const nuevos = nuevasOpciones.map((o) => `${comp.slice(0, m.ini)}${o}${comp.slice(m.fin)}`);
    lista = lista.flatMap((l) => nuevos.map((c) => l.map((t, i) => (i === k ? { ...t, comp: c } : t))));
  }
  if (lista.length === 1 && lista[0] === ts && !/^::view-transition/i.test(sel)) return [sel];
  const out = lista.map(escribirTrozos);
  // las transiciones de vista: solo en la raíz
  return out.map((x) => (/^::view-transition/i.test(x) ? `:where(html)${x}` : x));
}

// Todo un CSS (minificado o no): devuelve el CSS y cuántos selectores se han tocado
export function cubos(css) {
  let tocados = 0, nuevos = 0;
  const escribir = (nodos) => nodos.map((x) => {
    if (x.tipo === 'grupo') return `${x.pre}{${escribir(x.hijos)}}`;
    if (x.tipo !== 'regla') return x.texto;
    const sels = partir(x.sel);
    const salida = [];
    for (const s of sels) {
      const p = partirSelector(s);
      if (p.length !== 1 || p[0] !== s) { tocados++; nuevos += p.length; }
      salida.push(...p);
    }
    return `${salida.join(',')}{${x.cuerpo}}`;
  }).join('');
  return { css: escribir(leer(css)), tocados, nuevos };
}
