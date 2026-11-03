// El formato de WhatsApp en los mensajes (v0.54): *negrita*, _cursiva_, ~tachado~ y `monoespaciado` (también con
// tres comillas: ```así```). Devuelve un árbol de trozos que la pantalla pinta con sus etiquetas (nunca como HTML):
//   { t: 'texto', v } | { t: 'enlace', v, youtube } | { t: 'negrita' | 'cursiva' | 'tachado', hijos: [...] } | { t: 'mono', v }
// Las reglas, como WhatsApp: el signo de apertura va al principio o tras algo que no es letra ni número, y lo sigue algo
// que no es un espacio; el de cierre va tras algo que no es un espacio y antes del final o de algo que no es letra ni
// número; sin saltar de línea (salvo ```…```). Los enlaces cuentan como una pieza entera: un «_» dentro de una dirección
// no abre una cursiva.
import { trozosConEnlaces } from './enlaces.js';

const SIGNOS = { '*': 'negrita', '_': 'cursiva', '~': 'tachado' };
const ALFANUM = /[\p{L}\p{N}]/u;
// Cada enlace se sustituye por un carácter del área privada de Unicode mientras se lee el formato
const BASE_ENLACE = 0xE000;
const MAX_ENLACES = 6000;
// (con RegExp y un texto: el empaquetado deja el código en ASCII puro)
const AREA_PRIVADA = new RegExp('[\\uE000-\\uF8FF]');

const esEspacio = (c) => c === undefined || /\s/.test(c);

// (v0.54, revisión) Lineal: antes de leer, de derecha a izquierda, dónde está el siguiente cierre válido de cada signo
// (sin pasar de línea), la siguiente comilla, el siguiente ``` y el siguiente salto de línea; después, cada carácter se
// mira una sola vez (las partes de dentro se leen con sus posiciones en el texto entero, sin copiarlo).
function preparar(s) {
  const n = s.length;
  const cierre = { '*': new Int32Array(n + 2).fill(-1), _: new Int32Array(n + 2).fill(-1), '~': new Int32Array(n + 2).fill(-1) };
  const comilla = new Int32Array(n + 2).fill(-1), triple = new Int32Array(n + 2).fill(-1), salto = new Int32Array(n + 2).fill(-1);
  let c1 = -1, c2 = -1, c3 = -1, sc = -1, tr = -1, sl = -1;
  for (let k = n - 1; k >= 0; k--) {
    const ch = s[k];
    if (ch === '\n') { c1 = c2 = c3 = -1; sl = k; }
    else if (SIGNOS[ch] && !esEspacio(s[k - 1]) && (k === n - 1 || !ALFANUM.test(s[k + 1]))) {
      if (ch === '*') c1 = k; else if (ch === '_') c2 = k; else c3 = k;
    }
    if (ch === '`') { sc = k; if (s[k + 1] === '`' && s[k + 2] === '`') tr = k; }
    cierre['*'][k] = c1; cierre._[k] = c2; cierre['~'][k] = c3; comilla[k] = sc; triple[k] = tr; salto[k] = sl;
  }
  return { cierre, comilla, triple, salto };
}

function leer(s, enlaces, P, ini, fin) {
  const out = [];
  let texto = '';
  const soltar = () => { if (texto) { out.push(...conEnlaces(texto, enlaces)); texto = ''; } };
  let i = ini;
  while (i < fin) {
    const c = s[i];
    if (c === '`') {
      // ```bloque``` (puede tener saltos de línea; el cierre, entero dentro de esta parte)
      if (s[i + 1] === '`' && s[i + 2] === '`' && i + 3 < fin) {
        const f = P.triple[i + 3];
        if (f > i + 3 && f + 3 <= fin) { soltar(); out.push({ t: 'mono', v: sinEnlaces(s.slice(i + 3, f), enlaces) }); i = f + 3; continue; }
      }
      const f = i + 1 < fin ? P.comilla[i + 1] : -1;
      const sl = P.salto[i + 1];
      if (f > i + 1 && f < fin && (sl === -1 || sl > f)) { soltar(); out.push({ t: 'mono', v: sinEnlaces(s.slice(i + 1, f), enlaces) }); i = f + 1; continue; }
    }
    if (SIGNOS[c] && (i === 0 || !ALFANUM.test(s[i - 1])) && i + 1 < fin && !esEspacio(s[i + 1])) {
      const j = i + 2 < fin ? P.cierre[c][i + 2] : -1;
      if (j > i + 1 && j < fin) { soltar(); out.push({ t: SIGNOS[c], hijos: leer(s, enlaces, P, i + 1, j) }); i = j + 1; continue; }
    }
    texto += c;
    i++;
  }
  soltar();
  return out;
}

// Un trozo de texto con sus marcas de enlace → texto y enlaces
function conEnlaces(t, enlaces) {
  const out = [];
  let acc = '';
  for (const ch of t) {
    const k = ch.codePointAt(0) - BASE_ENLACE;
    if (k >= 0 && k < enlaces.length) { if (acc) { out.push({ t: 'texto', v: acc }); acc = ''; } out.push({ t: 'enlace', v: enlaces[k].valor, youtube: enlaces[k].youtube || null }); }
    else acc += ch;
  }
  if (acc) out.push({ t: 'texto', v: acc });
  return out;
}
const sinEnlaces = (t, enlaces) => [...t].map((ch) => { const k = ch.codePointAt(0) - BASE_ENLACE; return k >= 0 && k < enlaces.length ? enlaces[k].valor : ch; }).join('');

export function tokensFormato(texto) {
  const original = String(texto ?? '');
  // Un texto que ya trae caracteres del área privada se deja sin formato (no se confunden con los enlaces)
  if (AREA_PRIVADA.test(original)) return trozosConEnlaces(original).map((x) => (x.tipo === 'enlace' ? { t: 'enlace', v: x.valor, youtube: x.youtube || null } : { t: 'texto', v: x.valor }));
  const enlaces = [];
  let s = '';
  for (const x of trozosConEnlaces(original)) {
    if (x.tipo === 'enlace' && enlaces.length < MAX_ENLACES) { s += String.fromCodePoint(BASE_ENLACE + enlaces.length); enlaces.push(x); }
    else s += x.valor;
  }
  return leer(s, enlaces, preparar(s), 0, s.length);
}

// Los trozos de un mensaje, guardados por su id y su texto (al repintar el chat no se vuelve a leer nada)
const CACHE = new Map();
const MAX_CACHE = 2000;
export function tokensDeMensaje(id, texto) {
  if (id == null) return tokensFormato(texto);
  const t = String(texto ?? '');
  const x = CACHE.get(id);
  if (x && x.texto === t) return x.tokens;
  const tokens = tokensFormato(t);
  if (CACHE.size >= MAX_CACHE) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(id, { texto: t, tokens });
  return tokens;
}

// Hay algo con formato o con enlaces (si no, la pantalla pinta el texto tal cual)
export const conFormato = (tokens) => tokens.some((x) => x.t !== 'texto');

// El texto sin las marcas (para citas, vistas previas y la búsqueda)
export function textoPlano(texto) {
  const plano = (ts) => ts.map((x) => (x.hijos ? plano(x.hijos) : x.v)).join('');
  return plano(tokensFormato(texto));
}
