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

const escribir = (nodos) => nodos.map((x) => (x.tipo === 'regla' ? `${x.sel}{${x.cuerpo}}` : x.tipo === 'grupo' ? `${x.pre}{${escribir(x.hijos)}}` : x.texto)).join('');

// css: el CSS construido. palabrasCoach / palabrasOtros: las palabras del código del coach y del resto; prefijosOtros: los
// principios de clases armadas a trozos en el resto. Devuelve { comun, coach, reglas: cuántas reglas pasan al del coach }
export function separarCssCoach(css, { palabrasCoach, palabrasOtros, prefijosOtros = new Set() }) {
  const prefijos = [...prefijosOtros];
  const delCoach = (c) => palabrasCoach.has(c) && !palabrasOtros.has(c) && !prefijos.some((p) => c.startsWith(p));
  const selectorCoach = (s) => /(^|[\s>+~])\.app\.coach(?![A-Za-z0-9_-])/.test(s) || clasesNecesarias(s).some(delCoach);
  let reglas = 0;
  function repartir(nodos) {
    const comun = [], coach = [];
    for (const x of nodos) {
      if (x.tipo === 'regla') {
        const sels = partir(x.sel);
        if (sels.length && sels.every(selectorCoach)) { coach.push(x); reglas++; } else comun.push(x);
      } else if (x.tipo === 'grupo') {
        const r = repartir(x.hijos);
        if (r.comun.length) comun.push({ ...x, hijos: r.comun });
        if (r.coach.length) coach.push({ ...x, hijos: r.coach });
      } else comun.push(x);
    }
    return { comun, coach };
  }
  const r = repartir(leer(css));
  return { comun: escribir(r.comun), coach: escribir(r.coach), reglas };
}

// Con lo construido: los textos de los trozos del coach y del resto (más index.html y la portada) → { comun, coach, reglas }
export function cssDelCoach(css, { jsCoach, jsOtros }) {
  return separarCssCoach(css, { palabrasCoach: palabrasDe(jsCoach), palabrasOtros: palabrasDe(jsOtros), prefijosOtros: prefijosDe(jsOtros) });
}
