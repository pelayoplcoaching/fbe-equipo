// (v0.209, estilos a dieta) Los estilos que solo usa la app del coach, aparte: el móvil de un atleta no los descarga ni
// los procesa al abrir (unos 180 KB de los 1100 del CSS). Se decide sobre lo construido:
//   · una clase es «del coach» si sale en el código que solo carga el coach (sus trozos de JavaScript) y en ningún otro
//     sitio (ni en el resto del código, ni en index.html, ni como principio de una clase que se arma con «algo-${…}»);
//   · una regla va al CSS del coach si todos sus selectores llevan alguna clase del coach (o «.app.coach»), fuera de
//     :not(), :is(), :where() y :has() (dentro de ellas, la clase no hace falta que esté).
// Lo demás (las variables, @font-face, @keyframes, las reglas mixtas…) se queda donde estaba. El CSS del coach se carga
// detrás del común (ui/App.jsx, antes de pintar su app), así que sus reglas siguen yendo después de las generales.

import { posix } from 'node:path';

// Las palabras que pueden ser clases en un texto (código o HTML), y los principios de las clases armadas a trozos
export function palabrasDe(texto) {
  return new Set(String(texto).match(/[A-Za-z0-9_-]+/g) || []);
}
export function prefijosDe(texto) {
  const t = String(texto);
  return new Set([
    ...[...t.matchAll(/([a-zA-Z][a-zA-Z0-9_-]*-)\$\{/g)].map((m) => m[1]),
    ...[...t.matchAll(/["'`]([a-zA-Z][a-zA-Z0-9_-]*-)["'`]\s*\+/g)].map((m) => m[1]),
  ]);
}

// Partir por comas de primer nivel (fuera de paréntesis, corchetes y comillas)
export function partir(s, sep = ',') {
  const out = [];
  let prof = 0, q = null, ini = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '(' || c === '[') prof++;
    else if (c === ')' || c === ']') prof--;
    else if (c === sep && prof === 0) { out.push(s.slice(ini, i)); ini = i + 1; }
  }
  out.push(s.slice(ini));
  return out.map((x) => x.trim()).filter(Boolean);
}

// Las clases de un selector que tienen que estar (sin lo de dentro de :not(), :is(), :where(), :has() ni los atributos)
export function clasesNecesarias(sel) {
  let s = '', prof = 0, q = null;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '(' || c === '[') { prof++; continue; }
    if (c === ')' || c === ']') { prof--; continue; }
    if (prof === 0) s += c;
  }
  return [...s.matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)].map((m) => m[1]);
}

// Leer el CSS (ya minificado o no) en un árbol: reglas, bloques @ con reglas dentro y el resto tal cual
export function leer(css) {
  let i = 0;
  const n = css.length;
  function bloque(hasta) {
    const nodos = [];
    let ini = i, q = null, prof = 0;
    while (i < n) {
      const c = css[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; i++; continue; }
      if (c === '"' || c === "'") { q = c; i++; continue; }
      if (c === '/' && css[i + 1] === '*') { const f = css.indexOf('*/', i + 2); i = f < 0 ? n : f + 2; continue; }
      if (c === '(') prof++;
      else if (c === ')') prof--;
      else if (c === ';' && prof === 0) { const t = css.slice(ini, i + 1).trim(); if (t) nodos.push({ tipo: 'texto', texto: t }); i++; ini = i; continue; }
      else if (c === '{' && prof === 0) {
        const pre = css.slice(ini, i).trim();
        i++;
        if (/^@(media|supports|container|layer|document)\b/i.test(pre)) {
          const hijos = bloque('}');
          nodos.push({ tipo: 'grupo', pre, hijos });
        } else {
          // una regla o un @ con declaraciones (@font-face, @keyframes con sus pasos, @property…): hasta su llave de cierre
          const cuerpoIni = i;
          let p = 1, q2 = null;
          while (i < n && p > 0) {
            const d = css[i];
            if (q2) { if (d === '\\') i++; else if (d === q2) q2 = null; i++; continue; }
            if (d === '"' || d === "'") q2 = d;
            else if (d === '{') p++;
            else if (d === '}') p--;
            i++;
          }
          const cuerpo = css.slice(cuerpoIni, i - 1);
          nodos.push(pre.startsWith('@') ? { tipo: 'texto', texto: `${pre}{${cuerpo}}` } : { tipo: 'regla', sel: pre, cuerpo });
        }
        ini = i;
        continue;
      } else if (c === '}' && prof === 0 && hasta === '}') { i++; return nodos; }
      i++;
    }
    const t = css.slice(ini).trim();
    if (t) nodos.push({ tipo: 'texto', texto: t });
    return nodos;
  }
  return bloque(null);
}

// ---------------------------------------------------------------- (v0.210) el orden de la cascada
// Mover una regla a un archivo que se carga después cambia quién gana un empate: si otra regla que en el original iba
// DESPUÉS (y se queda en el común, o va a otro archivo) fija la misma propiedad con la misma especificidad y sobre lo mismo
// (el elemento, o su mismo ::before/::after…), antes ganaba esa otra y ahora ganaría la movida. Esas reglas se quedan
// donde estaban. Se mira sin saber qué elementos llevan qué clases (cualquiera puede llevar cualquiera): se queda alguna
// regla de más, nunca de menos.

// Especificidad de un selector simple (sin comas), como un número: ids × 10⁶ + clases × 10³ + elementos
export function especificidad(sel) {
  const s = String(sel);
  const n = s.length;
  let a = 0, b = 0, c = 0, i = 0;
  const esLetra = (ch) => ch != null && (/[A-Za-z0-9_-]/.test(ch) || ch.charCodeAt(0) > 127 || ch === '\\');
  const ident = () => { const ini = i; while (i < n && esLetra(s[i])) { if (s[i] === '\\') i++; i++; } return s.slice(ini, i); };
  const parentesis = () => {
    let p = 0, q = null;
    const ini = i;
    for (; i < n; i++) {
      const ch = s[i];
      if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") q = ch;
      else if (ch === '(') p++;
      else if (ch === ')') { p--; if (p === 0) { i++; break; } }
    }
    return s.slice(ini + 1, i - 1);
  };
  const sumar = (x) => { a += Math.floor(x / 1e6); b += Math.floor(x / 1e3) % 1e3; c += x % 1e3; };
  const mayor = (lista) => Math.max(0, ...partir(lista).map(especificidad));
  while (i < n) {
    const ch = s[i];
    if (ch === '#') { i++; ident(); a++; } else if (ch === '.') { i++; ident(); b++; } else if (ch === '[') {
      let q = null;
      for (; i < n; i++) { const d = s[i]; if (q) { if (d === '\\') i++; else if (d === q) q = null; continue; } if (d === '"' || d === "'") q = d; else if (d === ']') { i++; break; } }
      b++;
    } else if (ch === ':') {
      if (s[i + 1] === ':') { i += 2; ident(); c++; if (s[i] === '(') parentesis(); continue; }
      i++;
      const nombre = ident().toLowerCase();
      if (['before', 'after', 'first-line', 'first-letter'].includes(nombre)) { c++; continue; }
      if (s[i] === '(') {
        const args = parentesis();
        if (nombre === 'where') continue;
        if (['is', 'not', 'has', 'matches', '-webkit-any', '-moz-any'].includes(nombre)) { sumar(mayor(args)); continue; }
        b++;
        const of = /\sof\s/i.exec(args);
        if (/^nth-(last-)?child$/.test(nombre) && of) sumar(mayor(args.slice(of.index + of[0].length)));
        continue;
      }
      b++;
    } else if (esLetra(ch)) { ident(); c++; } else i++;
  }
  return a * 1e6 + b * 1e3 + c;
}

// El pseudo-elemento del sujeto (lo que va tras el último combinador): '' si es el propio elemento
export function pseudoElemento(sel) {
  const s = String(sel);
  let prof = 0, q = null, ultimo = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") q = ch;
    else if (ch === '(' || ch === '[') prof++;
    else if (ch === ')' || ch === ']') prof--;
    else if (prof === 0 && /[\s>+~]/.test(ch)) ultimo = i + 1;
  }
  const sujeto = s.slice(ultimo).replace(/\([^)]*\)/g, '');
  // (con «::» cualquiera; con un solo «:», solo los cuatro de siempre: «:-webkit-autofill» es del propio elemento)
  const m = /::(-?[a-z][a-z-]*)|:(before|after|first-line|first-letter)(?![a-z-])/i.exec(sujeto);
  return m ? (m[1] || m[2]).toLowerCase() : '';
}

// Las propiedades de verdad que fija cada declaración (sus «longhands»): «margin» fija las cuatro de margen, «margin-inline»
// la izquierda y la derecha (la app va de izquierda a derecha), «inline-size» es «width», «font» fija el tamaño y el interlineado…
// Dos reglas solo empatan en lo que fijan las dos. Las !important van aparte (no empatan con las normales).
const LADOS = ['top', 'right', 'bottom', 'left'];
const FISICO = { 'inline-start': 'left', 'inline-end': 'right', 'block-start': 'top', 'block-end': 'bottom' };
const TAMANOS = { 'inline-size': 'width', 'block-size': 'height', 'min-inline-size': 'min-width', 'max-inline-size': 'max-width', 'min-block-size': 'min-height', 'max-block-size': 'max-height' };
const ATAJOS = {
  inset: LADOS, 'inset-inline': ['left', 'right'], 'inset-block': ['top', 'bottom'],
  'border-width': LADOS.map((l) => `border-${l}-width`), 'border-style': LADOS.map((l) => `border-${l}-style`), 'border-color': LADOS.map((l) => `border-${l}-color`),
  'border-radius': ['top-left', 'top-right', 'bottom-right', 'bottom-left'].map((e) => `border-${e}-radius`),
  'border-start-start-radius': ['border-top-left-radius'], 'border-start-end-radius': ['border-top-right-radius'], 'border-end-end-radius': ['border-bottom-right-radius'], 'border-end-start-radius': ['border-bottom-left-radius'],
  outline: ['outline-width', 'outline-style', 'outline-color'],
  background: ['background-color', 'background-image', 'background-position', 'background-size', 'background-repeat', 'background-attachment', 'background-origin', 'background-clip'],
  font: ['font-style', 'font-variant-caps', 'font-weight', 'font-stretch', 'font-size', 'line-height', 'font-family'],
  'font-variant': ['font-variant-ligatures', 'font-variant-caps', 'font-variant-numeric', 'font-variant-east-asian', 'font-variant-alternates', 'font-variant-position'],
  flex: ['flex-grow', 'flex-shrink', 'flex-basis'], 'flex-flow': ['flex-direction', 'flex-wrap'],
  gap: ['row-gap', 'column-gap'], 'grid-gap': ['row-gap', 'column-gap'], 'grid-row-gap': ['row-gap'], 'grid-column-gap': ['column-gap'],
  'place-items': ['align-items', 'justify-items'], 'place-content': ['align-content', 'justify-content'], 'place-self': ['align-self', 'justify-self'],
  'grid-template': ['grid-template-rows', 'grid-template-columns', 'grid-template-areas'],
  grid: ['grid-template-rows', 'grid-template-columns', 'grid-template-areas', 'grid-auto-rows', 'grid-auto-columns', 'grid-auto-flow'],
  'grid-area': ['grid-row-start', 'grid-column-start', 'grid-row-end', 'grid-column-end'], 'grid-row': ['grid-row-start', 'grid-row-end'], 'grid-column': ['grid-column-start', 'grid-column-end'],
  overflow: ['overflow-x', 'overflow-y'], 'overflow-inline': ['overflow-x'], 'overflow-block': ['overflow-y'], 'word-wrap': ['overflow-wrap'],
  'overscroll-behavior': ['overscroll-behavior-x', 'overscroll-behavior-y'],
  transition: ['transition-property', 'transition-duration', 'transition-timing-function', 'transition-delay', 'transition-behavior'],
  animation: ['animation-name', 'animation-duration', 'animation-timing-function', 'animation-delay', 'animation-iteration-count', 'animation-direction', 'animation-fill-mode', 'animation-play-state', 'animation-timeline'],
  'text-decoration': ['text-decoration-line', 'text-decoration-style', 'text-decoration-color', 'text-decoration-thickness'],
  'list-style': ['list-style-type', 'list-style-position', 'list-style-image'], columns: ['column-width', 'column-count'],
  mask: ['mask-image', 'mask-mode', 'mask-position', 'mask-size', 'mask-repeat', 'mask-origin', 'mask-clip', 'mask-composite'],
  'contain-intrinsic-size': ['contain-intrinsic-width', 'contain-intrinsic-height'], container: ['container-name', 'container-type'],
  'text-emphasis': ['text-emphasis-style', 'text-emphasis-color'],
};
export function longhands(prop) {
  let p = prop.trim().toLowerCase();
  if (p.startsWith('--')) return [p];
  p = p.replace(/^-(webkit|moz|ms|o)-/, '');
  if (p === 'all') return ['*'];
  if (TAMANOS[p]) return [TAMANOS[p]];
  if (ATAJOS[p]) return ATAJOS[p];
  for (const b of ['margin', 'padding', 'scroll-margin', 'scroll-padding']) {
    if (p === b) return LADOS.map((l) => `${b}-${l}`);
    if (p === `${b}-inline`) return [`${b}-left`, `${b}-right`];
    if (p === `${b}-block`) return [`${b}-top`, `${b}-bottom`];
    if (p.startsWith(`${b}-`) && FISICO[p.slice(b.length + 1)]) return [`${b}-${FISICO[p.slice(b.length + 1)]}`];
  }
  if (p.startsWith('inset-') && FISICO[p.slice(6)]) return [FISICO[p.slice(6)]];
  if (p === 'border') return [...LADOS.flatMap((l) => ['width', 'style', 'color'].map((x) => `border-${l}-${x}`)), 'border-image'];
  let m = /^border-(top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end)(?:-(width|style|color))?$/.exec(p);
  if (m) {
    const ls = m[1] === 'inline' ? ['left', 'right'] : m[1] === 'block' ? ['top', 'bottom'] : [FISICO[m[1]] || m[1]];
    return ls.flatMap((l) => (m[2] ? [m[2]] : ['width', 'style', 'color']).map((x) => `border-${l}-${x}`));
  }
  return [p];
}
export function familias(cuerpo) {
  const out = new Set();
  for (const d of declaraciones(cuerpo)) for (const k of d.claves) out.add(k);
  return out;
}

// El sujeto de un selector (lo que va tras el último combinador): su etiqueta (button, svg…; '' si no lleva) y sus clases
export function sujetoDe(sel) {
  const s = String(sel);
  let prof = 0, q = null, ultimo = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") q = ch;
    else if (ch === '(' || ch === '[') prof++;
    else if (ch === ')' || ch === ']') prof--;
    else if (prof === 0 && /[\s>+~]/.test(ch)) ultimo = i + 1;
  }
  const suj = s.slice(ultimo);
  const m = /^([a-zA-Z][a-zA-Z0-9-]*)/.exec(suj);
  // (y el selector sin su pseudo-elemento: «.a .b::before» → base «.a .b», sufijo «::before»)
  const pe = /::-?[a-z][a-z-]*(\([^)]*\))?|:(before|after|first-line|first-letter)(?![a-z-])/i.exec(suj);
  const corte = pe ? ultimo + pe.index : s.length;
  return { etiqueta: m ? m[1].toLowerCase() : '', clases: clasesNecesarias(suj), base: s.slice(0, corte).trim(), sufijo: s.slice(corte) };
}

// Las declaraciones de un cuerpo, cada una con lo que fija (sus longhands, con «!» si es !important)
function declaraciones(cuerpo) {
  return partir(String(cuerpo), ';').map((d) => {
    const k = d.indexOf(':');
    if (k <= 0) return null;
    const imp = /!\s*important\s*$/i.test(d) ? '!' : '';
    return { texto: d, claves: longhands(d.slice(0, k)).map((x) => `${x}${imp}`) };
  }).filter(Boolean);
}

// reglas: las del CSS en su orden original, cada una con .sel, .cuerpo y .dest (adónde iría: null = se queda en el común).
// Deja en el común (dest = null) las que, movidas, podrían ganar un empate que antes perdían. Devuelve cuántas se quedan.
// Dos selectores solo empatan sobre lo mismo si un elemento puede cumplir los dos: no si sus sujetos son de etiquetas
// distintas (button y svg), ni si cada sujeto lleva una clase que solo sale en el código de un sitio distinto (duenoDe: el
// trozo o «coach»; un elemento recibe sus clases de un solo sitio del código, y una clase que solo está en el código de La
// travesía no acaba en el mismo elemento que otra que solo está en el del coach).
//
// copiar (v0.210): en vez de dejar la regla en el común, se mueve igual y las reglas de después con las que puede empatar se
// copian en su archivo, en su sitio, limitadas a lo que ella cumple (con :where(), que no suma especificidad) y solo con
// las propiedades de esas familias: así, en sus elementos, todo gana y pierde como en el original. Cada copia queda en
// reglas[j].copias (Map destino → [{ sel, cuerpo }]). Si una regla tendría más de maxCopias, se queda en el común.
//
// Y (duenoDe.puedeIr, del build) una clase que solo sale en el código de un sitio solo comparte elemento con clases de ese
// código o del que importa (sus componentes, que reciben la clase por sus propiedades): si el otro sujeto lleva una clase que
// no sale en nada de eso, no pueden ser el mismo elemento.
export function respetarCascada(reglas, { duenoDe = () => null, copiar = false, maxCopias = 12 } = {}) {
  const puedeIr = typeof duenoDe.puedeIr === 'function' ? duenoDe.puedeIr : null;
  const junto = typeof duenoDe.junto === 'function' ? duenoDe.junto : null;
  const info = reglas.map((x) => {
    const sels = partir(x.sel).map((s) => {
      const suj = sujetoDe(s);
      return { k: `${especificidad(s)}|${pseudoElemento(s)}`, etiqueta: suj.etiqueta, clases: suj.clases, duenos: [...new Set(suj.clases.map(duenoDe).filter(Boolean))], base: suj.base, sufijo: suj.sufijo };
    });
    return { sels, fams: familias(x.cuerpo) };
  });
  // Por familia, las reglas que la tocan (en orden)
  const porFamilia = new Map();
  info.forEach((f, i) => { for (const k of f.fams) { if (!porFamilia.has(k)) porFamilia.set(k, []); porFamilia.get(k).push(i); } });
  const todas = [...porFamilia.keys()];
  const juntos = (a, b) => {
    if (a.k !== b.k) return false;
    if (a.etiqueta && b.etiqueta && a.etiqueta !== b.etiqueta) return false;
    for (const x of a.duenos) for (const y of b.duenos) if (x !== y) return false;
    if (puedeIr) {
      for (const o of a.duenos) for (const c of b.clases) if (!puedeIr(o, c)) return false;
      for (const o of b.duenos) for (const c of a.clases) if (!puedeIr(o, c)) return false;
    }
    // (las clases precisas: si una de un sujeto nunca comparte elemento con una precisa del otro, o con su etiqueta, no)
    if (junto) {
      const separa = (x, y) => {
        for (const e of x.clases) {
          const j = junto(e);
          if (!j) continue;
          for (const k of y.clases) if (k !== e && !j.clases.has(k) && junto(k)) return true;
          if (y.etiqueta && !j.etiquetas.has(y.etiqueta)) return true;
        }
        return false;
      };
      if (separa(a, b) || separa(b, a)) return false;
    }
    return true;
  };
  const chocan = (i, j) => { for (const a of info[i].sels) for (const b of info[j].sels) if (juntos(a, b)) return true; return false; };
  let quedan = 0;
  const choques = new Map();   // i → Map(j → Set(familias))
  for (let vuelta = 0; vuelta < 20; vuelta++) {
    let cambio = false;
    for (let i = reglas.length - 1; i >= 0; i--) {
      const d = reglas[i].dest;
      if (d == null) continue;
      const fams = info[i].fams.has('*') || [...info[i].fams].some((k) => k.startsWith('*')) ? todas : [...info[i].fams, '*', '*!'];
      const con = new Map();
      let demasiadas = false;
      for (const k of fams) {
        const lista = porFamilia.get(k);
        if (!lista) continue;
        // las de después de i (búsqueda binaria del primer índice mayor que i)
        let lo = 0, hi = lista.length;
        while (lo < hi) { const m = (lo + hi) >> 1; if (lista[m] <= i) lo = m + 1; else hi = m; }
        for (let t = lo; t < lista.length; t++) {
          const j = lista[t];
          if (reglas[j].dest === d || !chocan(i, j)) continue;
          if (!copiar) { demasiadas = true; break; }
          if (!con.has(j)) con.set(j, new Set());
          con.get(j).add(k);
          if (con.size > maxCopias) { demasiadas = true; break; }
        }
        if (demasiadas) break;
      }
      if (demasiadas) { reglas[i].dest = null; quedan++; cambio = true; choques.delete(i); } else if (con.size) choques.set(i, con); else choques.delete(i);
    }
    if (!cambio) break;
  }
  if (!copiar) return quedan;
  // Las copias: por cada regla de después (j) y cada destino, los selectores de las movidas que empatan con cada uno de los
  // suyos (los contextos de :where()) y las familias que hay que copiar
  const porJ = new Map();
  for (const [i, con] of choques) {
    const d = reglas[i].dest;
    if (d == null) continue;
    for (const [j, fs] of con) {
      if (!porJ.has(j)) porJ.set(j, new Map());
      const m = porJ.get(j);
      if (!m.has(d)) m.set(d, { ctx: info[j].sels.map(() => new Set()), fams: new Set() });
      const e = m.get(d);
      for (const f of fs) e.fams.add(f);
      info[j].sels.forEach((b, bi) => { for (const a of info[i].sels) if (juntos(a, b) && a.base) e.ctx[bi].add(a.base); });
    }
  }
  for (const [j, m] of porJ) {
    const decl = declaraciones(reglas[j].cuerpo);
    for (const [d, e] of m) {
      const cuerpo = decl.filter((x) => e.fams.has('*') || x.claves.some((c) => e.fams.has(c) || (c.endsWith('!') && e.fams.has('*!')))).map((x) => x.texto).join(';');
      if (!cuerpo) continue;
      const copias = [];
      info[j].sels.forEach((b, bi) => { if (e.ctx[bi].size && b.base) copias.push({ sel: `${b.base}:where(${[...e.ctx[bi]].join(',')})${b.sufijo}`, cuerpo }); });
      if (!copias.length) continue;
      if (!reglas[j].copias) reglas[j].copias = new Map();
      reglas[j].copias.set(d, copias);
    }
  }
  return quedan;
}
export function planas(nodos, out = []) {
  for (const x of nodos) { if (x.tipo === 'regla') out.push(x); else if (x.tipo === 'grupo') planas(x.hijos, out); }
  return out;
}

// (v0.210) El dueño de cada clase con todo el código a la vista: «coach» si solo sale en el código del coach, la ruta del
// trozo perezoso si solo sale en él, o null (sale en varios sitios, en el arranque, en index.html o en ninguno)
export function duenosDeCodigo({ textos, coach = new Set(), candidatos = new Set(), extra = '' }) {
  const rutas = [...textos.keys()];
  const palabras = new Map(rutas.map((f) => [f, palabrasDe(textos.get(f))]));
  const prefijos = new Map(rutas.map((f) => [f, [...prefijosDe(textos.get(f))]]));
  const palabrasExtra = palabrasDe(extra), prefijosExtra = [...prefijosDe(extra)];
  const memo = new Map();
  const dueno = (c) => {
    if (memo.has(c)) return memo.get(c);
    let r = null;
    if (!(palabrasExtra.has(c) || prefijosExtra.some((p) => c.startsWith(p)))) {
      const donde = rutas.filter((f) => palabras.get(f).has(c) || prefijos.get(f).some((p) => c.startsWith(p)));
      if (donde.length && donde.every((f) => coach.has(f))) r = 'coach';
      else if (donde.length === 1 && candidatos.has(donde[0])) r = donde[0];
    }
    memo.set(c, r);
    return r;
  };
  // Lo que importa cada trozo (también lo que carga después, con import()), y lo que se alcanza desde él
  const importa = new Map(rutas.map((f) => {
    const dir = f.includes('/') ? f.slice(0, f.lastIndexOf('/') + 1) : '';
    return [f, new Set([...textos.get(f).matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+?\.js)["']/g)].map((m) => posix.normalize(dir + m[1])))];
  }));
  const alcances = new Map();
  const alcance = (o) => {
    if (alcances.has(o)) return alcances.get(o);
    const visto = new Set(), cola = o === 'coach' ? [...coach] : [o];
    while (cola.length) { const f = cola.pop(); if (visto.has(f) || !textos.has(f)) continue; visto.add(f); for (const g of importa.get(f) || []) cola.push(g); }
    const a = { palabras: new Set(), prefijos: [...prefijosExtra] };
    for (const f of visto) { for (const w of palabras.get(f)) a.palabras.add(w); a.prefijos.push(...prefijos.get(f)); }
    for (const w of palabrasExtra) a.palabras.add(w);
    alcances.set(o, a);
    return a;
  };
  // ¿Puede una clase acabar en un elemento que lleva otra cuyo dueño es o? Si sale en su código o en lo que alcanza (o en
  // index.html): sí; si no, no
  dueno.puedeIr = (o, c) => { const a = alcance(o); return a.palabras.has(c) || a.prefijos.some((p) => c.startsWith(p)); };
  // (v0.210) Las clases «precisas»: las que solo salen en el atributo class de elementos (h("div",{class:"…"}), o con partes
  // que solo eligen entre textos: `a ${x?"b":""}`), sin propiedades sueltas (...p) en el mismo elemento ni otra forma de
  // ponerlas (classList, className, HTML en un texto, una propiedad de un componente, un nombre armado a trozos): de cada una
  // se sabe con qué clases y etiquetas comparte elemento. junto(c) → { clases, etiquetas } o null si no es precisa.
  const tramos = new Map(rutas.map((f) => [f, tramosDeClass(textos.get(f))]));
  const todosPrefijos = [...new Set([...rutas.flatMap((f) => prefijos.get(f)), ...prefijosExtra])];
  const juntos = new Map();
  dueno.junto = (c) => {
    if (juntos.has(c)) return juntos.get(c);
    let r = { clases: new Set(), etiquetas: new Set() }, vistas = 0;
    if (todosPrefijos.some((p) => c.startsWith(p)) || palabrasExtra.has(c)) r = null;
    const re = new RegExp(`(?<![A-Za-z0-9_-])${c.replace(/[-]/g, '\\-')}(?![A-Za-z0-9_-])`, 'g');
    fuera: for (const f of rutas) {
      if (!r) break;
      if (!palabras.get(f).has(c)) continue;
      const t = textos.get(f), ts = tramos.get(f);
      for (const m of t.matchAll(re)) {
        if (t[m.index - 1] === '.') continue;   // un selector («.x», querySelector): no pone la clase
        const tr = ts.find((x) => m.index >= x.ini && m.index < x.fin);
        if (!tr || !tr.preciso) { r = null; break fuera; }
        vistas++;
        for (const k of tr.clases) r.clases.add(k);
        r.etiquetas.add(tr.etiqueta);
      }
    }
    if (r && !vistas) r = null;
    juntos.set(c, r);
    return r;
  };
  return dueno;
}

// Los atributos class de los elementos en el código construido: e("div",{…,class:VALOR,…}). Cada uno con su tramo
// (ini, fin del VALOR), su etiqueta, sus clases y si es preciso: el valor es un texto, una plantilla cuyas partes solo
// eligen entre textos (x?"a":"b", x&&"a") o una de esas elecciones, y el elemento no lleva propiedades sueltas (...p).
function finLiteral(t, i) {
  const q = t[i];
  for (let k = i + 1; k < t.length; k++) {
    const ch = t[k];
    if (ch === '\\') { k++; continue; }
    if (q === '`' && ch === '$' && t[k + 1] === '{') { k = finExpr(t, k + 2, '}'); continue; }
    if (ch === q) return k + 1;
  }
  return t.length;
}
// Hasta el cierre (el carácter de cierre, sin consumirlo) o hasta una coma de primer nivel; con textos y paréntesis anidados
function finExpr(t, i, cierre) {
  let prof = 0;
  for (let k = i; k < t.length; k++) {
    const ch = t[k];
    if (ch === '"' || ch === "'" || ch === '`') { k = finLiteral(t, k) - 1; continue; }
    if (ch === '(' || ch === '[' || ch === '{') prof++;
    else if (ch === ')' || ch === ']' || ch === '}') { if (prof === 0) return ch === cierre ? k : -1; prof--; } else if (ch === ',' && prof === 0 && cierre === ',') return k;
  }
  return -1;
}
const TEXTO = /^(?:"[^"\\]*"|'[^'\\]*')$/;
const ELIGE = /^[^"'`]*?(?:\?\s*(?:"[^"\\]*"|'[^'\\]*')\s*:\s*(?:"[^"\\]*"|'[^'\\]*')|&&\s*(?:"[^"\\]*"|'[^'\\]*'))$/;
export function tramosDeClass(t) {
  const out = [];
  for (const m of t.matchAll(/\(\s*"([a-z][a-z0-9-]*)"\s*,\s*\{/g)) {
    const etiqueta = m[1];
    let k = m.index + m[0].length, preciso = true, valor = null;
    // las propiedades del objeto, de una en una
    for (let vueltas = 0; vueltas < 200 && k > 0 && k < t.length; vueltas++) {
      while (t[k] === ' ' || t[k] === '\n') k++;
      if (t[k] === '}') break;
      if (t.startsWith('...', k)) preciso = false;
      const fin = finExpr(t, k, ',');
      const finObj = finExpr(t, k, '}');
      const hasta = fin >= 0 && (finObj < 0 || fin < finObj) ? fin : finObj;
      if (hasta < 0) { preciso = false; break; }
      const prop = t.slice(k, hasta);
      if (/^class\s*:/.test(prop)) valor = { ini: k + prop.indexOf(':') + 1, fin: hasta };
      if (t[hasta] === '}') break;
      k = hasta + 1;
    }
    if (!valor) continue;
    const v = t.slice(valor.ini, valor.fin).trim();
    const clases = new Set();
    const textos = [];
    let ok = preciso;
    if (TEXTO.test(v)) textos.push(v.slice(1, -1));
    else if (v.startsWith('`') && v.endsWith('`')) {
      const cuerpo = v.slice(1, -1);
      let fijo = '', i = 0;
      while (i < cuerpo.length) {
        if (cuerpo[i] === '\\') { ok = false; break; }
        if (cuerpo[i] === '$' && cuerpo[i + 1] === '{') {
          const f = finExpr(cuerpo, i + 2, '}');
          if (f < 0) { ok = false; break; }
          const expr = cuerpo.slice(i + 2, f).trim();
          if (!ELIGE.test(expr)) { ok = false; break; }
          for (const x of expr.matchAll(/"([^"\\]*)"|'([^'\\]*)'/g)) textos.push(x[1] ?? x[2]);
          fijo += ' ';
          i = f + 1;
        } else { fijo += cuerpo[i]; i++; }
      }
      textos.push(fijo);
    } else if (ELIGE.test(v)) { for (const x of v.matchAll(/"([^"\\]*)"|'([^'\\]*)'/g)) textos.push(x[1] ?? x[2]); } else ok = false;
    for (const x of textos) for (const w of x.split(/\s+/)) if (w) clases.add(w);
    out.push({ ini: valor.ini, fin: valor.fin, etiqueta, clases, preciso: ok });
  }
  return out;
}

const escribir = (nodos) => nodos.map((x) => (x.tipo === 'regla' ? `${x.sel}{${x.cuerpo}}` : x.tipo === 'grupo' ? `${x.pre}{${escribir(x.hijos)}}` : x.texto)).join('');

// css: el CSS construido. palabrasCoach / palabrasOtros: las palabras del código del coach y del resto; prefijosOtros: los
// principios de clases armadas a trozos en el resto. Devuelve { comun, coach, reglas: cuántas reglas pasan al del coach }
export function separarCssCoach(css, { palabrasCoach, palabrasOtros, prefijosOtros = new Set(), duenoDe = null }) {
  const prefijos = [...prefijosOtros];
  const delCoach = (c) => palabrasCoach.has(c) && !palabrasOtros.has(c) && !prefijos.some((p) => c.startsWith(p));
  const selectorCoach = (s) => /(^|[\s>+~])\.app\.coach(?![A-Za-z0-9_-])/.test(s) || clasesNecesarias(s).some(delCoach);
  let reglas = 0;
  const arbol = leer(css);
  const todas = planas(arbol);
  for (const x of todas) { const sels = partir(x.sel); x.dest = sels.length && sels.every(selectorCoach) ? 'coach' : null; }
  // (v0.210) sin cambiar quién gana un empate (respetarCascada)
  const quedan = respetarCascada(todas, { duenoDe: duenoDe || ((c) => (delCoach(c) ? 'coach' : null)), copiar: true });
  let copias = 0;
  function repartir(nodos) {
    const comun = [], coach = [];
    for (const x of nodos) {
      if (x.tipo === 'regla') {
        if (x.dest === 'coach') { coach.push(x); reglas++; } else comun.push(x);
        for (const c of x.copias?.get('coach') || []) { coach.push({ tipo: 'regla', sel: c.sel, cuerpo: c.cuerpo }); copias++; }
      } else if (x.tipo === 'grupo') {
        const r = repartir(x.hijos);
        if (r.comun.length) comun.push({ ...x, hijos: r.comun });
        if (r.coach.length) coach.push({ ...x, hijos: r.coach });
      } else comun.push(x);
    }
    return { comun, coach };
  }
  const r = repartir(arbol);
  return { comun: escribir(r.comun), coach: escribir(r.coach), reglas, quedan, copias };
}

// Con lo construido: los textos de los trozos del coach y del resto (más index.html y la portada) → { comun, coach, reglas }
export function cssDelCoach(css, { jsCoach, jsOtros, duenoDe = null }) {
  return separarCssCoach(css, { palabrasCoach: palabrasDe(jsCoach), palabrasOtros: palabrasDe(jsOtros), prefijosOtros: prefijosDe(jsOtros), duenoDe });
}

// (v0.211, estilos a dieta 2) Lo mismo para cada trozo perezoso del atleta (La travesía, Apuntes, la sesión, el perfil…):
// una regla va al CSS de un trozo si todos sus selectores llevan alguna clase que solo sale en ese trozo (en ningún otro
// archivo de código, ni en index.html). textos: Map(ruta → código de cada trozo, de todos: los de arranque, los del coach y
// los perezosos); candidatos: las rutas de los trozos perezosos que pueden llevar CSS propio; extra: lo que no es un trozo
// (index.html, la portada). Devuelve { comun, porTrozo: Map(ruta → css), reglas }.
export function separarCssPorTrozos(css, { textos, candidatos, extra = '', duenoDe = null }) {
  const rutas = [...textos.keys()];
  const palabras = new Map(rutas.map((f) => [f, palabrasDe(textos.get(f))]));
  const prefijos = new Map(rutas.map((f) => [f, [...prefijosDe(textos.get(f))]]));
  const palabrasExtra = palabrasDe(extra), prefijosExtra = [...prefijosDe(extra)];
  const memo = new Map();
  // El único trozo donde sale una clase (o null si sale en varios, en ninguno o fuera de los trozos)
  const dueno = (c) => {
    if (memo.has(c)) return memo.get(c);
    let d = palabrasExtra.has(c) || prefijosExtra.some((p) => c.startsWith(p)) ? undefined : null;
    if (d !== undefined) {
      for (const f of rutas) {
        if (palabras.get(f).has(c) || prefijos.get(f).some((p) => c.startsWith(p))) { if (d) { d = null; break; } d = f; }
      }
    }
    const r = d && candidatos.has(d) ? d : null;
    memo.set(c, r);
    return r;
  };
  const destinoDe = (sel) => {
    let destino = null;
    for (const s of partir(sel)) {
      if (/(^|[\s>+~])\.app\.coach(?![A-Za-z0-9_-])/.test(s)) return null;
      const ds = [...new Set(clasesNecesarias(s).map(dueno).filter(Boolean))];
      if (!ds.length) return null;
      if (destino) { if (!ds.includes(destino)) return null; } else if (ds.length === 1) destino = ds[0]; else return null;
    }
    return destino;
  };
  let reglas = 0;
  const arbol = leer(css);
  const todas = planas(arbol);
  for (const x of todas) x.dest = destinoDe(x.sel);
  // (v0.210) sin cambiar quién gana un empate (respetarCascada)
  const quedan = respetarCascada(todas, { duenoDe: duenoDe || dueno, copiar: true });
  let copias = 0;
  function repartir(nodos) {
    const comun = [], porTrozo = new Map();
    const a = (f, x) => { if (!porTrozo.has(f)) porTrozo.set(f, []); porTrozo.get(f).push(x); };
    for (const x of nodos) {
      if (x.tipo === 'regla') {
        const d = x.dest;
        if (d) { a(d, x); reglas++; } else comun.push(x);
        for (const [f, cs] of x.copias || []) for (const c of cs) { a(f, { tipo: 'regla', sel: c.sel, cuerpo: c.cuerpo }); copias++; }
      } else if (x.tipo === 'grupo') {
        const r = repartir(x.hijos);
        if (r.comun.length) comun.push({ ...x, hijos: r.comun });
        for (const [f, hijos] of r.porTrozo) a(f, { ...x, hijos });
      } else comun.push(x);
    }
    return { comun, porTrozo };
  }
  const r = repartir(arbol);
  return { comun: escribir(r.comun), porTrozo: new Map([...r.porTrozo].map(([f, ns]) => [f, escribir(ns)])), reglas, quedan, copias };
}
