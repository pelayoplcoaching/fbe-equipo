// (apuntes, tanda B) Practicar, no solo leer: ejercicios que se hacen con el dedo (emparejar contrarreloj, ordenar los
// pasos, completar el hueco, verdadero o falso rápido), dos microlecciones que se tocan (tu 1RM con dos deslizadores y
// RIR ↔ RPE), las tres explicaciones de un apunte («Más fácil», normal y «A fondo») y las tres claves de un ejercicio
// nuevo antes de su primera serie. Lógica pura: sin red ni almacenamiento.
//
// Todos los ejercicios salen de lo que ya hay (glosario, guías, fichas): son «efímeros» (no cuentan como apuntes vistos
// ni vuelven en el repaso), salen uno de cada cuatro apuntes del rato y cambian cada vez.
import { GLOSARIO, terminosDe } from './apuntes.js';
import { fichaParaLeer, sinMarcas } from './guias.js';
import { e1rm, kgPara } from './calculos.js';
import { normal } from './busqueda.js';

const lista = (x) => (Array.isArray(x) ? x : []);
const limpio = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const sinTildes = normal;   // (sin tildes y en minúsculas: logica/busqueda.js)

// Un número pseudoaleatorio fijo por semilla (para barajar igual en la prueba y cambiar de un rato a otro)
export function azar(semilla = 1) {
  let s = (Math.abs(Math.floor(Number(semilla) || 1)) % 2147483646) + 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
export function barajar(xs, semilla = 1) {
  const r = azar(semilla), a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// La primera frase (o lo que quepa hasta `n` letras, cortando en un espacio)
export function primeraFrase(s, n = 110) {
  const t = limpio(s);
  const punto = t.search(/[.:;](\s|$)/);
  let f = punto > 0 ? t.slice(0, punto) : t;
  if (f.length > n) { f = f.slice(0, n); f = `${f.slice(0, Math.max(f.lastIndexOf(' '), n - 20))}…`; }
  return f;
}

// --- Emparejar: cuatro términos del glosario con lo que significan; los que ya ha visto, primero ---
export function emparejarDe(estado = null, semilla = 1, n = 4) {
  const v = estado?.vistos || {};
  const id = (t) => `g:${sinTildes(t).replace(/[^a-z0-9]/g, '')}`;
  const orden = barajar(GLOSARIO, semilla).sort((a, b) => (v[id(b[0])] ? 1 : 0) - (v[id(a[0])] ? 1 : 0));
  const pares = orden.slice(0, n).map(([t, x]) => ({ termino: t, definicion: primeraFrase(x, 90) }));
  if (pares.length < 3) return null;
  return { id: `x:emparejar:${semilla}`, tipo: 'emparejar', efimero: true, de: 'Glosario', etiqueta: 'Empareja', titulo: 'Une cada palabra con lo que significa', texto: '', pares, segundos: 45 };
}
// Cómo le ha ido: aciertos a la primera (fallos, los toques que no casaban), y si le dio tiempo
export function notaEmparejar(pares, fallos, segundos, limite = 45) {
  const total = lista(pares).length;
  const bien = Math.max(0, total - Number(fallos || 0));
  return { total, fallos: Number(fallos || 0), aTiempo: segundos <= limite, bien: fallos === 0 && segundos <= limite, segundos: Math.round(segundos) };
}

// --- Ordenar los pasos de un ejercicio (de su ficha: de tres a cinco pasos) ---
export function ordenarDe(fila, nombre = '', semilla = 1) {
  if (!fila?.id) return null;
  const f = fichaParaLeer(fila);
  const pasos = lista(f.pasos).map((p) => primeraFrase(sinMarcas(p), 80)).filter(Boolean).slice(0, 5);
  if (pasos.length < 3 || new Set(pasos).size !== pasos.length) return null;
  let mezcla = barajar(pasos.map((_, i) => i), semilla);
  if (mezcla.every((x, i) => x === i)) mezcla = [...mezcla.slice(1), mezcla[0]];
  const de = limpio(nombre || fila.nombre);
  return { id: `x:ordenar:${fila.id}`, tipo: 'ordenar', efimero: true, de, etiqueta: 'Ordena', titulo: `Pon en orden los pasos${de ? ` de ${de}` : ''}`, texto: '', pasos, mezcla };
}
// ¿Está bien ordenado? `elegidos`: los índices (de `pasos`) en el orden en que los ha tocado
export const ordenBueno = (elegidos) => lista(elegidos).every((x, i) => x === i);

// --- Completar el hueco: una idea de las guías con una palabra tapada; tres opciones ---
const PALABRA = new RegExp('[A-Za-z\\u00c0-\\u00ff0-9-]{6,}', 'g');
const COMUNES = new Set(['porque', 'cuando', 'mientras', 'despues', 'siempre', 'tambien', 'puedes', 'tienes', 'quieres', 'hacer', 'menos', 'mismo', 'misma', 'entre', 'sobre', 'antes', 'donde', 'algunas', 'algunos', 'cuantos', 'cuantas', 'primero', 'segundo', 'despues', 'muchos', 'muchas', 'mucho', 'mucha', 'puede', 'pueden', 'tiene', 'tienen', 'otros', 'otras', 'nunca', 'aunque', 'semana']);
const candidatas = (texto) => [...limpio(texto).matchAll(PALABRA)].map((m) => m[0]).filter((p) => !COMUNES.has(sinTildes(p)) && !/^\d+$/.test(p));
export function huecoDe(apuntes, semilla = 1) {
  const ideas = barajar(lista(apuntes).filter((a) => ['idea', 'clave'].includes(a?.tipo) && limpio(a.texto).length > 30), semilla);
  const r = azar(semilla + 7);
  for (const a of ideas) {
    const frase = primeraFrase(a.texto, 150).replace(/\u2026$/, '');
    if (frase.length < 30 || frase.length > 150) continue;
    // la palabra: una del glosario si sale; si no, la más larga
    const glos = terminosDe(frase).map(([t]) => t).find((t) => new RegExp(`(^|[^A-Za-z0-9])${t.replace(/[^A-Za-z0-9]/g, '.')}([^A-Za-z0-9]|$)`).test(frase));
    const palabras = candidatas(frase);
    const palabra = glos || [...palabras].sort((x, y) => y.length - x.length)[0];
    if (!palabra) continue;
    // las otras dos, de otras ideas, con un largo parecido y que no salgan en la frase
    const otras = [...new Set(ideas.filter((b) => b !== a).flatMap((b) => candidatas(b.texto)))]
      .filter((p) => sinTildes(p) !== sinTildes(palabra) && !sinTildes(frase).includes(sinTildes(p)) && Math.abs(p.length - palabra.length) <= 4);
    const malas = glos ? barajar(GLOSARIO.map(([t]) => t).filter((t) => t !== glos), semilla).slice(0, 2) : barajar(otras, semilla).slice(0, 2);
    if (malas.length < 2) continue;
    const i = frase.indexOf(palabra);
    const tapada = `${frase.slice(0, i)}_____${frase.slice(i + palabra.length)}`;
    const opciones = barajar([palabra, ...malas], Math.floor(r() * 1e6) + 1);
    return { id: `x:hueco:${a.id}`, origen: null, tipo: 'test', hueco: true, efimero: true, de: a.de || '', guia: a.guia || null, etiqueta: 'Completa el hueco', titulo: tapada, texto: `${frase}.`, opciones, correcta: opciones.indexOf(palabra) };
  }
  return null;
}

const minuscula = (s) => (/^[A-Z\u00c1\u00c9\u00cd\u00d3\u00da\u00d1][a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
// --- Verdadero o falso rápido: cinco frases seguidas (del glosario: la definición buena o la de otro término; y los
// mitos, que son falsos) ---
export function vfDe(apuntes = [], semilla = 1, n = 5) {
  const r = azar(semilla), frases = [];
  const glos = barajar(GLOSARIO, semilla);
  const mitos = barajar(lista(apuntes).filter((a) => a?.tipo === 'mito' && a.titulo), semilla + 3).slice(0, 2);
  for (const m of mitos) frases.push({ frase: m.titulo.replace(/^\u00ab|\u00bb$/g, ''), verdadero: false, porque: 'Es un mito: está en la guía de mitos.' });
  for (let i = 0; frases.length < n && i < glos.length; i++) {
    const [t, x] = glos[i];
    if (r() < 0.5) frases.push({ frase: `${t}: ${minuscula(primeraFrase(x, 90))}`, verdadero: true, porque: `${t}: ${minuscula(primeraFrase(x, 120))}` });
    else {
      const [, otra] = glos[(i + 1 + Math.floor(r() * (glos.length - 1))) % glos.length];
      if (otra === x) continue;
      frases.push({ frase: `${t}: ${minuscula(primeraFrase(otra, 90))}`, verdadero: false, porque: `No: ${t} es ${minuscula(primeraFrase(x, 120))}` });
    }
  }
  if (frases.length < 3) return null;
  return { id: `x:vf:${semilla}`, tipo: 'vf', efimero: true, de: 'Rápido', etiqueta: 'Verdadero o falso', titulo: '¿Verdadero o falso?', texto: '', frases: barajar(frases, semilla + 1).slice(0, n), segundos: 6 };
}

// --- Microlecciones que se tocan ---
// Tu 1RM con dos deslizadores (con los números de este ejercicio si los hay) y lo que pesarías para otras repeticiones
export function calc1rmDe(ejercicio = null) {
  // (de «Tus números»: «60 kg × 8», lo último que hizo o lo que le toca)
  const m = String(ejercicio?.ultima || ejercicio?.toca || '').match(/(\d+(?:[.,]\d+)?)\s*kg\s*[\u00d7x]\s*(\d+)/i);
  const kg = Math.min(300, Number(m?.[1]?.replace(',', '.')) || 60), reps = Math.min(12, Math.max(1, Number(m?.[2]) || 8));
  return { id: 'x:calc1rm', tipo: 'calc1rm', efimero: true, de: limpio(ejercicio?.nombre), etiqueta: 'Pruébalo', titulo: 'Calcula tu 1RM sin probarlo', texto: 'Mueve el peso y las repeticiones de una serie y mira qué 1RM sale (la misma cuenta que usa la app).', kg, reps, rir: 2 };
}
export function cuentas1rm({ kg, reps, rir = 0 }) {
  const uno = e1rm({ kg, reps, rir });
  if (!uno) return null;
  return { uno, tabla: [3, 5, 8, 12].map((r) => ({ reps: r, kg: kgPara(uno, r, 2) })) };
}
// RIR ↔ RPE: cuántas te quedaban y qué RPE es, con lo que se siente
export const RIR_RPE = [
  [0, 10, 'No podías hacer ni una más.'],
  [1, 9, 'Quedaba una, justa.'],
  [2, 8, 'Te quedaban dos: la zona de casi todas tus series.'],
  [3, 7, 'Tres más: la barra aún va rápida.'],
  [4, 6, 'Cuatro o más: un calentamiento serio.'],
];
export function rirpeDe() {
  return { id: 'x:rirpe', tipo: 'rirpe', efimero: true, de: '', etiqueta: 'Pruébalo', titulo: 'RIR y RPE: lo mismo, contado al revés', texto: 'Mueve cuántas repeticiones te quedaban y mira qué RPE es.', rir: 2 };
}
export const filaRirpe = (rir) => RIR_RPE[Math.max(0, Math.min(4, Math.round(Number(rir) || 0)))];

// Qué ejercicio toca (uno cada cuatro apuntes, rotando): los que se pueden hacer con lo que hay
export function practicasDe({ apuntes = [], estado = null, ficha = null, ejercicio = null, semilla = 1 } = {}) {
  return [
    emparejarDe(estado, semilla),
    ficha ? ordenarDe(ficha, ejercicio?.nombre, semilla) : null,
    huecoDe(apuntes, semilla),
    vfDe(apuntes, semilla),
    calc1rmDe(ejercicio),
    rirpeDe(),
  ].filter(Boolean);
}
export function elegirPractica(practicas, vez = 0) {
  const p = lista(practicas);
  return p.length ? p[Math.abs(Math.floor(vez)) % p.length] : null;
}

// --- Tres explicaciones: «Más fácil» (las palabras técnicas, explicadas entre paréntesis, y solo lo primero), normal y
// «A fondo» (el texto entero de la guía o la ficha, sin recortar). Solo las que cambian algo. ---
export function masFacil(texto) {
  const t = limpio(texto);
  if (!t) return null;
  let out = t;
  for (const [p, x] of terminosDe(t)) {
    const corto = primeraFrase(x, 60).replace(/^[^:]+:\s*/, '').replace(/\u2026$/, '');
    const re = new RegExp(`(^|[^A-Za-z0-9])(${p.replace(/[^A-Za-z0-9]/g, '.')})(?=[^A-Za-z0-9]|$)`);
    out = out.replace(re, (_, a, b) => `${a}${b} (${corto.charAt(0).toLowerCase()}${corto.slice(1)})`);
  }
  // y si es largo, lo primero
  const frases = out.match(/[^.!?]+[.!?]+/g) || [out];
  const corto = frases.length > 1 ? frases[0].trim() : out;
  return corto !== t ? corto : null;
}
// «A fondo»: el texto entero si se recortó; si no, lo que dicen sus palabras técnicas (en una idea o una clave) o, en el
// glosario, dónde sale en tus guías
export function nivelesDe(a, todos = []) {
  if (!a || ['test', 'clip', 'reto', 'numeros', 'correccion'].includes(a.tipo) || a.vuelta || !a.texto) return null;
  const facil = a.tipo === 'glosario' ? (primeraFrase(a.texto, 80) !== limpio(a.texto) ? `${primeraFrase(a.texto, 80).replace(/\u2026$/, '')}.` : null) : masFacil(a.texto);
  const largo = limpio(a.textoLargo);
  let fondo = largo && largo.length > limpio(a.texto).length + 20 ? largo : null;
  if (!fondo && a.tipo === 'glosario') {
    const en = lista(todos).filter((b) => ['idea', 'clave'].includes(b?.tipo) && terminosDe(`${b.titulo || ''} ${b.texto || ''}`).some(([t]) => t === a.titulo)).slice(0, 2);
    if (en.length) fondo = `${limpio(a.texto)} En tus guías: ${en.map((b) => `«${limpio(b.titulo || primeraFrase(b.texto, 90))}»`).join(' y ')}.`;
  }
  if (!fondo && ['idea', 'clave', 'novedad', 'apunte', 'coach', 'duda'].includes(a.tipo)) {
    const ts = terminosDe(`${a.titulo || ''} ${a.texto}`);
    if (ts.length) fondo = `${limpio(a.texto)} ${ts.map(([t, x]) => `${t}: ${limpio(x)}`).join(' ')}`;
  }
  return facil || fondo ? { facil, normal: a.texto, fondo } : null;
}

// --- Antes de un ejercicio nuevo: sus tres claves (de las instrucciones del ejercicio) ---
// (de la ficha de técnica enlazada: sus pasos; si no hay, de las instrucciones del ejercicio)
export function clavesDeFicha(fila) {
  if (!fila?.id) return [];
  return lista(fichaParaLeer(fila).pasos).map((p) => primeraFrase(sinMarcas(p), 110)).filter(Boolean).slice(0, 3);
}
export function tresClaves(instrucciones) {
  const t = String(instrucciones || '');
  let trozos = t.split(/\n+/).map((x) => sinMarcas(x).replace(/^\s*(\d+[.)]|[-\u2022*])\s*/, '').trim()).filter((x) => x.length > 3);
  if (trozos.length < 2) trozos = (limpio(sinMarcas(t)).match(/[^.!?]+[.!?]*/g) || []).map((x) => x.trim()).filter((x) => x.length > 3);
  return trozos.slice(0, 3).map((x) => primeraFrase(x, 110));
}
