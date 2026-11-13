// (apuntes bellos) Lo que hace bonitos los «Apuntes», en números y en palabras: el color y el sello de cada tipo, qué
// palabra del título se subraya, dónde están las palabras del glosario dentro del texto, los siete días de la semana,
// cuándo un deslizamiento pasa de tarjeta… Solo funciones puras (las pinta ui/atleta/Apuntes.jsx). Nada de esto cambia
// qué apuntes salen ni cuándo.
import { lunesDe, sumarDias } from './fechas.js';
import { limpiarVistos, medallaApuntes } from './apuntes.js';

// ---------- Cada tipo, con su tono y su sello ----------
// tono: uno de los siete colores de los apuntes (los define apuntes.css, claro y oscuro); sello: el dibujo de su redondel
export const ARTE = {
  clave: { tono: 'verde', sello: 'diana' },
  error: { tono: 'ambar', sello: 'aviso' },
  mito: { tono: 'rosa', sello: 'mito' },
  idea: { tono: 'morado', sello: 'bombilla' },
  glosario: { tono: 'azul', sello: 'libro' },
  test: { tono: 'teal', sello: 'casilla' },
  duda: { tono: 'azul', sello: 'pregunta' },
  coach: { tono: 'morado', sello: 'silbato' },
  novedad: { tono: 'verde', sello: 'chispa' },
  numeros: { tono: 'oro', sello: 'barras' },
  correccion: { tono: 'morado', sello: 'lapiz' },
  musculo: { tono: 'rosa', sello: 'pulso' },
  clip: { tono: 'azul', sello: 'play' },
  reto: { tono: 'oro', sello: 'bandera' },
};
// Un número fijo entre 0 y 1 para cada (n, sal): el mismo siempre (para el confeti)
export const dado = (n, sal = 0) => { const x = Math.sin(n * 127.1 + sal * 311.7 + 13.37) * 43758.5453; return x - Math.floor(x); };
export const TONOS = ['verde', 'ambar', 'rosa', 'morado', 'azul', 'teal', 'oro'];
export const arteDe = (tipo) => ARTE[tipo] || ARTE.idea;

// ---------- El rotulador ----------
// Qué palabra del título se subraya: la más larga de cinco letras o más que no sea de relleno (la primera si empatan).
// Devuelve { antes, palabra, despues } (juntas dan el título tal cual) o null. Los títulos entre comillas («Cenar
// engorda») y las preguntas no se subrayan: ahí la frase entera es lo que importa.
const RELLENO = new Set(['sobre', 'todo', 'entre', 'hasta', 'desde', 'porque', 'cuando', 'donde', 'mientras', 'antes', 'despues', 'después',
  'siempre', 'nunca', 'tambien', 'también', 'puedes', 'puede', 'tienes', 'tiene', 'hacer', 'hazlo', 'cuanto', 'cuánto', 'mejor', 'menos', 'ahora', 'última', 'ultima']);
export function palabraClave(titulo) {
  const t = String(titulo || '');
  if (!t || '\u00ab"\u00bf'.includes(t.trim()[0]) || /\?\s*$/.test(t)) return null;
  let mejor = null;
  for (const m of t.matchAll(new RegExp('[A-Za-z\\u00c0-\\u00ff]+', 'g'))) {
    const p = m[0];
    if (p.length < 5 || RELLENO.has(p.toLocaleLowerCase('es'))) continue;
    if (!mejor || p.length > mejor[0].length) mejor = [p, m.index];
  }
  if (!mejor) return null;
  return { antes: t.slice(0, mejor[1]), palabra: mejor[0], despues: t.slice(mejor[1] + mejor[0].length) };
}

// ---------- Las palabras del glosario, dentro del texto ----------
// Parte el texto en trozos: [{ texto }] y, donde aparece por primera vez cada término (sin mirar mayúsculas ni tildes, y
// como palabra entera), [{ texto, termino }]. Juntos dan el texto tal cual. terminos: [[termino, definicion]]
const plegar = (s) => Array.from(String(s), (c) => c.normalize('NFD')[0].toLocaleLowerCase('es')).join('');
const letra = (c) => !!c && (/[a-z0-9]/i.test(plegar(c)) || plegar(c) === '\u00f1');
export function trozosConTerminos(texto, terminos = []) {
  const t = String(texto || ''), pl = plegar(t);
  if (!t || !terminos.length || pl.length !== t.length) return [{ texto: t }];
  const marcas = [];
  for (const [termino] of terminos) {
    const q = plegar(termino);
    if (!q) continue;
    for (let i = pl.indexOf(q); i >= 0; i = pl.indexOf(q, i + 1)) {
      if (letra(t[i - 1]) || letra(t[i + q.length])) continue;
      if (marcas.some((m) => i < m.fin && i + q.length > m.ini)) continue;
      marcas.push({ ini: i, fin: i + q.length, termino });
      break;
    }
  }
  if (!marcas.length) return [{ texto: t }];
  marcas.sort((a, b) => a.ini - b.ini);
  const out = [];
  let i = 0;
  for (const m of marcas) {
    if (m.ini > i) out.push({ texto: t.slice(i, m.ini) });
    out.push({ texto: t.slice(m.ini, m.fin), termino: m.termino });
    i = m.fin;
  }
  if (i < t.length) out.push({ texto: t.slice(i) });
  return out;
}

// ---------- La semana de aprendizaje ----------
// Los siete días de esta semana (de lunes a domingo): [{ letra, fecha, hecho (aprendió algo), hoy, futuro }]
export function semanaDeAprendizaje(estado, hoy) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hoy || '')) return [];
  const dias = new Set(limpiarVistos(estado).dias || []), l = lunesDe(hoy);
  return ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((letraDia, i) => {
    const fecha = sumarDias(l, i);
    return { letra: letraDia, fecha, hecho: dias.has(fecha), hoy: fecha === hoy, futuro: fecha > hoy };
  });
}

// ---------- Las medallas ----------
// El metal de cada nivel (1 a 4) y si `despues` estrena una que `antes` no tenía: el nivel nuevo o 0
export const METALES = [null, 'bronce', 'plata', 'oro', 'lavanda'];
export const metalDe = (nivel) => METALES[Math.max(0, Math.min(4, Math.round(nivel) || 0))];
export function medallaNueva(antes, despues) {
  const a = medallaApuntes(antes).nivel, d = medallaApuntes(despues).nivel;
  return d > a ? d : 0;
}

// ---------- Deslizar la tarjeta ----------
// Al soltar: 'derecha', 'izquierda' o null (vuelve a su sitio). Hace falta haberla movido de lado al menos 80 px (o un
// 24 % del ancho, si es más) y bastante más de lado que de arriba abajo (para no confundirlo con desplazar el texto)
export function deslizar(dx, dy, ancho = 390) {
  const umbral = Math.max(80, ancho * 0.24);
  if (!Number.isFinite(dx) || Math.abs(dx) < umbral || Math.abs(dx) < Math.abs(dy || 0) * 1.6) return null;
  return dx > 0 ? 'derecha' : 'izquierda';
}
// Mientras se arrastra: cuánto gira la tarjeta (grados) y cuánto se ve la etiqueta de lo que hará al soltar (0 a 1)
export function arrastre(dx, ancho = 390) {
  const umbral = Math.max(80, ancho * 0.24), x = Number(dx) || 0;
  return { giro: Math.max(-12, Math.min(12, x / 22)), etiqueta: Math.min(1, Math.max(0, (Math.abs(x) - 18) / (umbral - 18))) };
}

// ---------- La nota del examen ----------
// Cuánto se llena el aro (0 a 1), si toca confeti (notable o más) y el tono del sello
export function aroDeNota(aciertos, total) {
  const pct = total > 0 ? Math.max(0, Math.min(1, aciertos / total)) : 0;
  return { pct, confeti: pct >= 0.7, tono: pct >= 0.9 ? 'oro' : pct >= 0.7 ? 'verde' : pct >= 0.5 ? 'morado' : 'ambar' };
}

// ---------- La cuenta del descanso, como barra ----------
// De 1 (recién empezado) a 0 (se acabó) y si está en los diez últimos segundos
export function barraDescanso(quedan, total) {
  if (!(total > 0) || !Number.isFinite(quedan)) return null;
  const q = Math.max(0, quedan);
  return { k: Math.min(1, q / total), final: q > 0 && q <= 10 };
}

// ---------- Los puntos de la tanda ----------
// Lo que pasó con cada apunte de este rato: 'sabia' (lo sabía o acertó), 'no' (no lo sabía o falló) o 'visto'. Un punto
// por cada uno, hasta doce (los últimos)
export const puntosDeTanda = (resultados = []) => resultados.filter((r) => r === 'sabia' || r === 'no' || r === 'visto').slice(-12);
