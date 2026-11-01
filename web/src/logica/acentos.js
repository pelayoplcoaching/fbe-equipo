// Color de acento y negro puro (v0.49). El acento es el color de la acción (botones, enlaces, foco, lo elegido):
// seis a elegir, cada uno con sus valores para el tema claro y el oscuro, comprobados para que el texto y los
// botones pasen el contraste AA (4,5:1) sobre todas las superficies de la app, también sobre el negro puro.
// Es un ajuste del móvil (como el tema): no va a la base.

// Superficies de la app (las de estilos.css) sobre las que va el acento como texto
export const SUPERFICIES = {
  claro: { tiza: '#F1F0F6', hoja: '#FFFFFF', 'hoja-2': '#F5F4FA' },
  oscuro: { tiza: '#0F0E17', hoja: '#19172A', 'hoja-2': '#232036' },
  oled: { tiza: '#000000', hoja: '#0C0B12', 'hoja-2': '#17151F' },
};
// El texto claro de la tarjeta del día (--sobre-hero), que va sobre el brillo del acento (--hero-2)
export const SOBRE_HERO = '#F3F1FB';

// Cada tema: morado (el acento), su hover, el fondo suave (chips, lo elegido), el texto sobre el acento y el brillo
// de la tarjeta del día. Los nombres de las variables siguen siendo «morado» (así se llamaba el único que había).
export const ACENTOS = [
  {
    id: 'morado', nombre: 'Morado FBE',
    claro: { morado: '#5438D8', hover: '#4429C2', suave: '#E9E4FD', sobre: '#FFFFFF', hero2: '#2A2154' },
    oscuro: { morado: '#A596FF', hover: '#B9ADFF', suave: '#2B2452', sobre: '#0F0E17', hero2: '#3A2E7A' },
  },
  {
    id: 'azul', nombre: 'Azul',
    claro: { morado: '#1D55C4', hover: '#1746A6', suave: '#E1EBFC', sobre: '#FFFFFF', hero2: '#1C2F5E' },
    oscuro: { morado: '#7EA6FF', hover: '#9DBBFF', suave: '#1C2B4F', sobre: '#0F0E17', hero2: '#24408A' },
  },
  {
    id: 'pino', nombre: 'Verde pino',
    claro: { morado: '#0B6B5D', hover: '#08594D', suave: '#DDF2EE', sobre: '#FFFFFF', hero2: '#10393A' },
    oscuro: { morado: '#4FCDB3', hover: '#74DCC6', suave: '#14352F', sobre: '#0F0E17', hero2: '#155A50' },
  },
  {
    id: 'frambuesa', nombre: 'Frambuesa',
    claro: { morado: '#B0215C', hover: '#951A4D', suave: '#FBE3EC', sobre: '#FFFFFF', hero2: '#4A1632' },
    oscuro: { morado: '#FF8AB6', hover: '#FFA8C9', suave: '#45192F', sobre: '#0F0E17', hero2: '#6B1E46' },
  },
  {
    id: 'cobre', nombre: 'Cobre',
    claro: { morado: '#9C4310', hover: '#82380C', suave: '#FBE8DA', sobre: '#FFFFFF', hero2: '#46240F' },
    oscuro: { morado: '#FFA46E', hover: '#FFBB91', suave: '#3E2617', sobre: '#0F0E17', hero2: '#6E3712' },
  },
  {
    id: 'grafito', nombre: 'Grafito',
    claro: { morado: '#3A3D52', hover: '#2A2C3D', suave: '#E6E6EE', sobre: '#FFFFFF', hero2: '#2B2C3A' },
    oscuro: { morado: '#C7CAE0', hover: '#DADCEC', suave: '#2C2C3C', sobre: '#0F0E17', hero2: '#3D3F52' },
  },
];
export const ACENTO_DEFECTO = 'morado';
export const acentoDe = (id) => ACENTOS.find((a) => a.id === id) || ACENTOS[0];

// ---------- contraste (WCAG 2.x) ----------
function canal(c) { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
export function luminancia(hex) {
  const h = String(hex).replace('#', '');
  const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}
export function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}

// Todas las parejas que tienen que pasar AA con un acento en un tema (claro, oscuro u oled; el oled usa los valores
// del oscuro): el acento como texto sobre cada superficie y sobre su fondo suave, el texto de los botones sobre el
// acento y sobre su hover, y el texto de la tarjeta del día sobre su brillo.
export function parejasAcento(acento, tema) {
  const v = tema === 'claro' ? acento.claro : acento.oscuro;
  const sup = SUPERFICIES[tema];
  return [
    ...Object.entries(sup).map(([k, fondo]) => ({ que: `acento sobre ${k}`, texto: v.morado, fondo })),
    { que: 'acento sobre su fondo suave', texto: v.morado, fondo: v.suave },
    { que: 'texto del botón', texto: v.sobre, fondo: v.morado },
    { que: 'texto del botón (hover)', texto: v.sobre, fondo: v.hover },
    { que: 'tarjeta del día', texto: SOBRE_HERO, fondo: v.hero2 },
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
  const sup = SUPERFICIES[tema];
  const una = mezclar(v.morado, sup.hoja, tema === 'claro' ? CELDA_UNA.claro : CELDA_UNA.oscuro);
  return { una, vacia: sup['hoja-2'], ratio: contraste(una, sup['hoja-2']) };
}

// ---------- CSS ----------
const variables = (v) => `--morado:${v.morado};--morado-hover:${v.hover};--morado-suave:${v.suave};--sobre-morado:${v.sobre};--foco:${v.morado};--hero-2:${v.hero2};`;
// El CSS de un acento, con los mismos selectores que estilos.css para el tema oscuro (así manda el del sistema
// cuando el tema es «Sistema»). El morado no necesita nada: es el de serie.
export function cssAcento(id) {
  const a = acentoDe(id);
  if (a.id === ACENTO_DEFECTO) return '';
  return `:root{${variables(a.claro)}}`
    + `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${variables(a.oscuro)}}}`
    + `:root[data-theme="dark"]{${variables(a.oscuro)}}`;
}
