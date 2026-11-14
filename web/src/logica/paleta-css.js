// El texto de web/src/color.css, desde la paleta (lo escribe scripts/paleta.mjs; las pruebas lo comparan con el archivo).
import { ESCALAS, NOCHE, BLANCO, NEGRO, TEMAS, ACENTOS, SERIES, SECUENCIAL, DIVERGENTE, CELEBRACION, DALTONISMO, ALTO_CONTRASTE, PORTADA } from './paleta.js';

const ref = (v) => {
  if (typeof v === 'string') return v;
  const [k, p] = v;
  return k === 'noche' ? `var(--noche-${p})` : `var(--${k}-${p})`;
};
const bloque = (sel, decl) => `${sel} {\n${decl.map((d) => `  ${d}`).join('\n')}\n}\n`;
const tema = (t) => Object.entries(TEMAS[t]).map(([k, v]) => `--${k}: ${ref(v)};`);
const acentoDecl = (v) => [`--morado: ${v.morado};`, `--morado-hover: ${v.hover};`, `--morado-suave: ${v.suave};`, `--sobre-morado: ${v.sobre};`, `--foco: ${v.morado};`, `--hero-2: ${v.hero2};`];
const oscuroSel = (extra = '') => [`@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"])${extra}`, `:root[data-theme="dark"]${extra}`];
const dosOscuros = (extra, decl) => {
  const [m, d] = oscuroSel(extra);
  return `${m} {\n${decl.map((x) => `    ${x}`).join('\n')}\n  }\n}\n${bloque(d, decl)}`;
};

export function cssPaleta() {
  const prim = [
    ...Object.entries(ESCALAS).flatMap(([k, esc]) => Object.entries(esc).map(([p, hex]) => `--${k}-${p}: ${hex};`)),
    ...Object.entries(NOCHE).map(([i, hex]) => `--noche-${i}: ${hex};`),
    `--blanco: ${BLANCO};`, `--negro: ${NEGRO};`,
  ];
  // (2) los tokens con significado nuevos, que apuntan a los de siempre; (8) los degradados de marca; (12) las
  // celebraciones; (14) las gráficas (las sombras, en diseno.css y color-capa.css)
  const comunes = [
    '--superficie-1: var(--tiza); --superficie-2: var(--hoja); --superficie-3: var(--hoja-2); --superficie-4: var(--hoja-3);',
    '--texto: var(--tinta); --texto-2: var(--tinta-2); --texto-3: var(--tinta-3); --borde-suave: var(--linea);',
    '--accion: var(--morado); --accion-hover: var(--morado-hover); --accion-suave: var(--morado-suave); --sobre-accion: var(--sobre-morado);',
    '--accion-pulsado: color-mix(in oklch, var(--morado) 82%, var(--tinta));',
    `--tinta-noche: ${PORTADA};`,
    '--grad-noche: linear-gradient(160deg, var(--hero) 0%, var(--hero) 35%, var(--hero-2) 100%);',
    '--grad-amanecer: linear-gradient(135deg, var(--morado) 0%, var(--rosa-400) 55%, var(--oro-300) 100%);',
    `--grad-record: linear-gradient(135deg, ${CELEBRACION.record.join(', ')});`,
    `--grad-fuego: linear-gradient(160deg, ${CELEBRACION.fuego.join(', ')});`,
    ...CELEBRACION.confeti.map((c, i) => `--confeti-${i + 1}: ${c};`),
    ...SECUENCIAL.map((c, i) => `--seq-${i + 1}: ${c};`),
    ...DIVERGENTE.map((c, i) => `--div-${i + 1}: ${c};`),
  ];
  const serie = (t) => SERIES[t].map((c, i) => `--serie-${i + 1}: ${i === 0 ? 'var(--morado)' : c};`);
  const dalt = (t) => Object.entries(DALTONISMO[t]).map(([k, v]) => `--${k}: ${v};`);
  const alto = (t) => Object.entries(ALTO_CONTRASTE[t]).map(([k, v]) => `--${k}: ${v};`);
  const enOklch = (t) => t.replace(/linear-gradient\((\d+deg)/, 'linear-gradient(in oklch $1');

  return `/* ==========================================================================================================
   COLOR de FBE Equipo. Archivo GENERADO por scripts/paleta.mjs desde web/src/logica/paleta.js: no se edita a mano
   (npm run paleta; las pruebas comprueban que está al día). Se carga antes que estilos.css.
   Tres capas: primitivas (--marca-600) → con significado (--texto, --accion, --ok-borde…) → las de siempre
   (--tiza, --hoja, --tinta, --morado…), que ahora apuntan a las primitivas.
   ========================================================================================================== */

/* Primitivas: diez escalas de 50 a 950 (diseñadas en OKLCH) y la noche (las superficies del tema oscuro) */
${bloque(':root', prim)}
/* Tema claro (y lo común a los dos temas) */
${bloque(':root', [...tema('claro'), ...acentoDecl(ACENTOS[0].claro), ...comunes, ...serie('claro')])}
/* Tema oscuro */
${dosOscuros('', [...tema('oscuro'), ...acentoDecl(ACENTOS[0].oscuro), ...serie('oscuro')])}
/* (8) Los degradados, interpolados en OKLCH donde se puede (no se ensucian en el medio) */
@supports (background: linear-gradient(in oklch, red, blue)) {
  :root {
${['--grad-noche: linear-gradient(160deg, var(--hero) 0%, var(--hero) 35%, var(--hero-2) 100%);', '--grad-amanecer: linear-gradient(135deg, var(--morado) 0%, var(--rosa-400) 55%, var(--oro-300) 100%);', `--grad-record: linear-gradient(135deg, ${CELEBRACION.record.join(', ')});`, `--grad-fuego: linear-gradient(160deg, ${CELEBRACION.fuego.join(', ')});`].map((x) => `    ${enOklch(x)}`).join('\n')}
  }
}

/* (18) Ayuda para daltonismo: lo hecho, en azul; lo que falta o va mal, en naranja */
${bloque(':root[data-daltonismo]', dalt('claro'))}${dosOscuros('[data-daltonismo]', dalt('oscuro'))}
/* (17) Alto contraste: textos y líneas al máximo (AAA) */
${bloque(':root[data-contraste="alto"]', alto('claro'))}${dosOscuros('[data-contraste="alto"]', alto('oscuro'))}`;
}
