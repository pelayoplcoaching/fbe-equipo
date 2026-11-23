// (v0.209, estilos a dieta) Los estilos que solo usa la app del coach, aparte: el móvil de un atleta no los descarga ni
// los procesa al abrir (unos 180 KB de los 1100 del CSS). Se decide sobre lo construido:
//   · una clase es «del coach» si sale en el código que solo carga el coach (sus trozos de JavaScript) y en ningún otro
//     sitio (ni en el resto del código, ni en index.html, ni como principio de una clase que se arma con «algo-${…}»);
//   · una regla va al CSS del coach si todos sus selectores llevan alguna clase del coach (o «.app.coach»), fuera de
//     :not(), :is(), :where() y :has() (dentro de ellas, la clase no hace falta que esté).
// Lo demás (las variables, @font-face, @keyframes, las reglas mixtas…) se queda donde estaba. El CSS del coach se carga
// detrás del común (ui/App.jsx, antes de pintar su app), así que sus reglas siguen yendo después de las generales.

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
function partir(s, sep = ',') {
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
function leer(css) {
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
  const m = /::?(before|after|first-line|first-letter|placeholder|marker|selection|backdrop|file-selector-button|cue|part|slotted|-webkit-[a-z-]+|-moz-[a-z-]+)\b/i.exec(sujeto);
  return m ? m[1].toLowerCase() : '';
}

// Las propiedades de un cuerpo, por familia (margin y margin-top son la misma; width e inline-size también), con las
// !important aparte (no empatan con las normales)
function familia(prop) {
  let p = prop.trim().toLowerCase();
  if (p.startsWith('--')) return p;
  p = p.replace(/^-(webkit|moz|ms|o)-/, '');
  if (p === 'all') return '*';
  if (/^(min-|max-)?(width|inline-size)$/.test(p)) return 'width';
  if (/^(min-|max-)?(height|block-size)$/.test(p)) return 'height';
  if (/^(top|right|bottom|left|inset)(-|$)/.test(p)) return 'inset';
  if (/^(row-gap|column-gap|gap|grid-(row-|column-)?gap)$/.test(p)) return 'gap';
  if (/^(place|align|justify)-/.test(p)) return 'align';
  if (p === 'line-height' || p.startsWith('font')) return 'font';
  if (/^column(s|-count|-width)$/.test(p)) return 'column';
  if (p === 'word-wrap') return 'overflow';
  return p.split('-')[0];
}
export function familias(cuerpo) {
  const out = new Set();
  for (const d of partir(String(cuerpo), ';')) {
    const k = d.indexOf(':');
    if (k <= 0) continue;
    out.add(`${familia(d.slice(0, k))}${/!\s*important\s*$/i.test(d) ? '!' : ''}`);
  }
  return out;
}

// reglas: las del CSS en su orden original, cada una con .sel, .cuerpo y .dest (adónde iría: null = se queda en el común).
// Deja en el común (dest = null) las que, movidas, podrían ganar un empate que antes perdían. Devuelve cuántas se quedan.
export function respetarCascada(reglas) {
  const info = reglas.map((x) => {
    const sels = partir(x.sel);
    return { claves: new Set(sels.map((s) => `${especificidad(s)}|${pseudoElemento(s)}`)), fams: familias(x.cuerpo) };
  });
  // Por familia, las reglas que la tocan (en orden)
  const porFamilia = new Map();
  info.forEach((f, i) => { for (const k of f.fams) { if (!porFamilia.has(k)) porFamilia.set(k, []); porFamilia.get(k).push(i); } });
  const todas = [...porFamilia.keys()];
  const chocan = (i, j) => { for (const k of info[i].claves) if (info[j].claves.has(k)) return true; return false; };
  let quedan = 0;
  for (let vuelta = 0; vuelta < 20; vuelta++) {
    let cambio = false;
    for (let i = reglas.length - 1; i >= 0; i--) {
      const d = reglas[i].dest;
      if (d == null) continue;
      const fams = info[i].fams.has('*') || [...info[i].fams].some((k) => k.startsWith('*')) ? todas : [...info[i].fams, '*', '*!'];
      let malo = false;
      for (const k of fams) {
        const lista = porFamilia.get(k);
        if (!lista) continue;
        // las de después de i (búsqueda binaria del primer índice mayor que i)
        let lo = 0, hi = lista.length;
        while (lo < hi) { const m = (lo + hi) >> 1; if (lista[m] <= i) lo = m + 1; else hi = m; }
        for (let t = lo; t < lista.length; t++) {
          const j = lista[t];
          if (reglas[j].dest !== d && chocan(i, j)) { malo = true; break; }
        }
        if (malo) break;
      }
      if (malo) { reglas[i].dest = null; quedan++; cambio = true; }
    }
    if (!cambio) break;
  }
  return quedan;
}
function planas(nodos, out = []) {
  for (const x of nodos) { if (x.tipo === 'regla') out.push(x); else if (x.tipo === 'grupo') planas(x.hijos, out); }
  return out;
}

const escribir = (nodos) => nodos.map((x) => (x.tipo === 'regla' ? `${x.sel}{${x.cuerpo}}` : x.tipo === 'grupo' ? `${x.pre}{${escribir(x.hijos)}}` : x.texto)).join('');

// css: el CSS construido. palabrasCoach / palabrasOtros: las palabras del código del coach y del resto; prefijosOtros: los
// principios de clases armadas a trozos en el resto. Devuelve { comun, coach, reglas: cuántas reglas pasan al del coach }
export function separarCssCoach(css, { palabrasCoach, palabrasOtros, prefijosOtros = new Set() }) {
  const prefijos = [...prefijosOtros];
  const delCoach = (c) => palabrasCoach.has(c) && !palabrasOtros.has(c) && !prefijos.some((p) => c.startsWith(p));
  const selectorCoach = (s) => /(^|[\s>+~])\.app\.coach(?![A-Za-z0-9_-])/.test(s) || clasesNecesarias(s).some(delCoach);
  let reglas = 0;
  const arbol = leer(css);
  const todas = planas(arbol);
  for (const x of todas) { const sels = partir(x.sel); x.dest = sels.length && sels.every(selectorCoach) ? 'coach' : null; }
  // (v0.210) sin cambiar quién gana un empate (respetarCascada)
  const quedan = respetarCascada(todas);
  function repartir(nodos) {
    const comun = [], coach = [];
    for (const x of nodos) {
      if (x.tipo === 'regla') {
        if (x.dest === 'coach') { coach.push(x); reglas++; } else comun.push(x);
      } else if (x.tipo === 'grupo') {
        const r = repartir(x.hijos);
        if (r.comun.length) comun.push({ ...x, hijos: r.comun });
        if (r.coach.length) coach.push({ ...x, hijos: r.coach });
      } else comun.push(x);
    }
    return { comun, coach };
  }
  const r = repartir(arbol);
  return { comun: escribir(r.comun), coach: escribir(r.coach), reglas, quedan };
}

// Con lo construido: los textos de los trozos del coach y del resto (más index.html y la portada) → { comun, coach, reglas }
export function cssDelCoach(css, { jsCoach, jsOtros }) {
  return separarCssCoach(css, { palabrasCoach: palabrasDe(jsCoach), palabrasOtros: palabrasDe(jsOtros), prefijosOtros: prefijosDe(jsOtros) });
}

// (v0.211, estilos a dieta 2) Lo mismo para cada trozo perezoso del atleta (La travesía, Apuntes, la sesión, el perfil…):
// una regla va al CSS de un trozo si todos sus selectores llevan alguna clase que solo sale en ese trozo (en ningún otro
// archivo de código, ni en index.html). textos: Map(ruta → código de cada trozo, de todos: los de arranque, los del coach y
// los perezosos); candidatos: las rutas de los trozos perezosos que pueden llevar CSS propio; extra: lo que no es un trozo
// (index.html, la portada). Devuelve { comun, porTrozo: Map(ruta → css), reglas }.
export function separarCssPorTrozos(css, { textos, candidatos, extra = '' }) {
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
  const quedan = respetarCascada(todas);
  function repartir(nodos) {
    const comun = [], porTrozo = new Map();
    const a = (f, x) => { if (!porTrozo.has(f)) porTrozo.set(f, []); porTrozo.get(f).push(x); };
    for (const x of nodos) {
      if (x.tipo === 'regla') {
        const d = x.dest;
        if (d) { a(d, x); reglas++; } else comun.push(x);
      } else if (x.tipo === 'grupo') {
        const r = repartir(x.hijos);
        if (r.comun.length) comun.push({ ...x, hijos: r.comun });
        for (const [f, hijos] of r.porTrozo) a(f, { ...x, hijos });
      } else comun.push(x);
    }
    return { comun, porTrozo };
  }
  const r = repartir(arbol);
  return { comun: escribir(r.comun), porTrozo: new Map([...r.porTrozo].map(([f, ns]) => [f, escribir(ns)])), reglas, quedan };
}
