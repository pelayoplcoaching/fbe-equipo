// Color de acento y negro puro (v0.49). El acento es el color de la acción (botones, enlaces, foco, lo elegido):
// seis a elegir, cada uno con sus valores para el tema claro y el oscuro, comprobados para que el texto y los
// botones pasen el contraste AA (4,5:1) sobre todas las superficies de la app, también sobre el negro puro.
// Es un ajuste del móvil (como el tema): no va a la base.

// (color) Las superficies, los textos, los acentos y el contraste salen de la paleta (logica/paleta.js), la única
// fuente del color: ocho acentos (con Océano y Lima, de la tanda de color), cada uno con sus valores para el claro y el oscuro.
import { SUPERFICIES, ACENTOS, luminancia, contraste, neutrosDe, superficiesDe, textosDe, acentoAlto } from './paleta.js';
export { SUPERFICIES, ACENTOS, luminancia, contraste };
// El texto claro de la tarjeta del día (--sobre-hero), que va sobre el brillo del acento (--hero-2)
export const SOBRE_HERO = '#F3F1FB';
export const ACENTO_DEFECTO = 'morado';
export const acentoDe = (id) => ACENTOS.find((a) => a.id === id) || ACENTOS[0];

// Todas las parejas que tienen que pasar AA con un acento en un tema (claro, oscuro u oled; el oled usa los valores
// del oscuro): el acento como texto sobre cada superficie y sobre su fondo suave, el texto de los botones sobre el
// acento y sobre su hover, y el texto de la tarjeta del día sobre su brillo.
export function parejasAcento(acento, tema) {
  const v = tema === 'claro' ? acento.claro : acento.oscuro;
  const sup = superficiesDe(acento, tema);   // (color 2) con los neutros de ese acento
  return [
    ...Object.entries(sup).map(([k, fondo]) => ({ que: `acento sobre ${k}`, texto: v.morado, fondo })),
    { que: 'acento sobre su fondo suave', texto: v.morado, fondo: v.suave },
    { que: 'texto del botón', texto: v.sobre, fondo: v.morado },
    { que: 'texto del botón (hover)', texto: v.sobre, fondo: v.hover },
    { que: 'tarjeta del día', texto: SOBRE_HERO, fondo: v.hero2 },
    { que: 'tarjeta del día (su noche)', texto: SOBRE_HERO, fondo: v.hero },
    { que: 'tarjeta del día (texto 2)', texto: '#BDB8DA', fondo: v.hero },
  ].map((p) => ({ ...p, ratio: contraste(p.texto, p.fondo) }));
}
export function acentoValido(acento, minimo = 4.5) {
  return ['claro', 'oscuro', 'oled'].every((t) => parejasAcento(acento, t).every((p) => p.ratio >= minimo));
}

// ---------- calendario de constancia (contraste de lo que no es texto, 3:1) ----------
// El día con una sesión es el acento mezclado con la hoja (color-mix en sRGB); tiene que distinguirse del día vacío
// (--hoja-2) al menos 3:1 en claro, oscuro y negro puro, con cualquier acento. Los porcentajes son los de
// --celda-una en estilos.css (las pruebas comprueban que coinciden).
export const CELDA_UNA = { claro: 75, oscuro: 65 };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16));
export function mezclar(a, b, pct) {
  const p = pct / 100;
  return `#${rgb(a).map((x, i) => Math.round(x * p + rgb(b)[i] * (1 - p)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
export function contrasteCeldas(acento, tema) {
  const v = tema === 'claro' ? acento.claro : acento.oscuro;
  const sup = superficiesDe(acento, tema);
  const una = mezclar(v.morado, sup.hoja, tema === 'claro' ? CELDA_UNA.claro : CELDA_UNA.oscuro);
  return { una, vacia: sup['hoja-2'], ratio: contraste(una, sup['hoja-2']) };
}

// ---------- vidrio (v0.51): la barra de abajo, las cabeceras pegadas y las hojas, translúcidas ----------
// Cuánto tapa el vidrio (el % de la superficie en color-mix, en estilos.css: las pruebas comprueban que coinciden).
// Se elige para el peor caso: lo que pase por detrás es negro puro en el tema claro y blanco puro en el oscuro (una
// foto, la tarjeta del día, el botón claro del descanso). Sobre el vidrio solo va texto de tinta, tinta-2 y acento
// (nunca tinta-3); en las hojas, que llevan de todo, también tinta-3, y por eso tapan más.
export const VIDRIO = {
  barra: { claro: 85, oscuro: 88, oled: 85 },     // la barra de abajo (sobre --hoja)
  cabecera: { claro: 90, oscuro: 85, oled: 80 },  // las cabeceras pegadas (sobre --tiza, el fondo de la página)
  hoja: { claro: 92, oscuro: 92, oled: 92 },      // las hojas (sobre --hoja; llevan también tinta-3)
};
export function parejasVidrio(acento, tema, tipo = 'barra') {
  const v = tema === 'claro' ? acento.claro : acento.oscuro;
  const textos = textosDe(acento, tema);
  const peor = tema === 'claro' ? '#000000' : '#FFFFFF';
  const fondo = mezclar(superficiesDe(acento, tema)[tipo === 'cabecera' ? 'tiza' : 'hoja'], peor, VIDRIO[tipo][tema]);
  const lista = [['tinta', textos.tinta], ['tinta-2', textos['tinta-2']], ...(tipo === 'hoja' ? [['tinta-3', textos['tinta-3']]] : []), ['acento', v.morado]];
  return lista.map(([que, texto]) => ({ que: `${que} sobre el vidrio (${tipo})`, texto, fondo, ratio: contraste(texto, fondo) }));
}

// ---------- CSS ----------
// (color 2) y la noche de la tarjeta del día (--hero), del tono del acento: con otro acento ya no arranca en violeta
const variables = (v) => `--morado:${v.morado};--morado-hover:${v.hover};--morado-suave:${v.suave};--sobre-morado:${v.sobre};--foco:${v.morado};--hero-2:${v.hero2};--hero:${v.hero};`;
// (color 2) los neutros del acento: los grises y la noche, con su tono (las primitivas de color.css, pisadas)
const neutros = (n) => (n ? `${Object.entries(n.neutro).map(([p, h]) => `--neutro-${p}:${h};`).join('')}${Object.entries(n.noche).map(([i, h]) => `--noche-${i}:${h};`).join('')}` : '');
// El CSS de un acento, con los mismos selectores que color.css para el tema oscuro (así manda el del sistema cuando el
// tema es «Sistema»). El morado no necesita nada: es el de serie. Con alto contraste (color 2), el acento a 7:1 (también
// el morado), y gana a las reglas del tema por ir con el atributo.
export function cssAcento(id, { alto = false } = {}) {
  const a = acentoDe(id);
  if (a.id === ACENTO_DEFECTO && !alto) return '';
  const v = alto ? acentoAlto(a) : a;
  const c = alto ? '[data-contraste="alto"]' : '';
  return `:root${c}{${neutros(neutrosDe(a))}${variables(v.claro)}}`
    + `@media (prefers-color-scheme: dark){:root${c}:not([data-theme="light"]){${variables(v.oscuro)}}}`
    + `:root${c}[data-theme="dark"]{${variables(v.oscuro)}}`;
}
