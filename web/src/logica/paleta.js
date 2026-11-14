// La paleta de FBE Equipo (color, mejoras 1–2, 4–7, 12, 14–15): la única fuente del color de la app.
//
// Se diseña en OKLCH (luminosidad, croma y tono, repartidos por percepción y no a ojo) y se escribe en hex (sRGB):
// cada color de las escalas cabe en sRGB, así que el hex es exacto. `scripts/paleta.mjs` genera con esto
// `web/src/color.css` (las primitivas, los tokens con significado de cada tema y los degradados de marca); las
// pruebas (test/color.test.mjs) comprueban que el archivo está al día, el contraste de todas las parejas texto/fondo
// y que no aparecen colores sueltos nuevos fuera de él.
//
// Tres capas: primitivas (`--marca-600`) → con significado (`--texto`, `--superficie-2`, `--accion`, `--ok-borde`…)
// → las de cada componente, que ya existían (`--morado`, `--tiza`, `--hoja`…) y siguen funcionando como alias.

// ---------- OKLCH → hex ----------
function oklabARgbLineal(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}
const dentro = (rgb) => rgb.every((x) => x >= -0.0005 && x <= 1.0005);
const gamma = (x) => { const v = Math.max(0, Math.min(1, x)); return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; };
// Un color OKLCH en hex; si no cabe en sRGB, se baja el croma (sin tocar luminosidad ni tono) hasta que quepa.
export function oklch(L, C, h) {
  const rad = (h * Math.PI) / 180;
  let c = C, rgb = oklabARgbLineal(L, c * Math.cos(rad), c * Math.sin(rad));
  if (!dentro(rgb)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (dentro(oklabARgbLineal(L, mid * Math.cos(rad), mid * Math.sin(rad)))) lo = mid; else hi = mid; }
    c = lo; rgb = oklabARgbLineal(L, c * Math.cos(rad), c * Math.sin(rad));
  }
  return `#${rgb.map((x) => Math.round(gamma(x) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
// hex → [L, C, h] (para las pruebas y para casar colores sueltos con su paso de escala)
export function aOklch(hex) {
  const n = String(hex).replace('#', '');
  const lin = [0, 2, 4].map((i) => { const c = parseInt(n.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  const [r, g, b] = lin;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}
// Distancia perceptual (ΔE en OKLab) entre dos hex
export function distancia(h1, h2) {
  const lab = (h) => { const [L, C, hh] = aOklch(h); const r = (hh * Math.PI) / 180; return [L, C * Math.cos(r), C * Math.sin(r)]; };
  const [a, b] = [lab(h1), lab(h2)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// ---------- contraste (WCAG 2.x) ----------
function canal(c) { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
export function luminancia(hex) {
  const n = String(hex).replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}
export function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}

// ---------- las escalas (1) ----------
export const PASOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
// La misma luminosidad para todas: el paso 600 pasa AA (4,5:1) sobre blanco y el 300, sobre el fondo oscuro.
const LUZ = [0.975, 0.95, 0.9, 0.83, 0.74, 0.62, 0.5, 0.43, 0.36, 0.28, 0.2];
const DEF = {
  // la marca: el morado FBE de siempre (#5438D8 ≈ oklch 0,48 0,23 282) queda en el 600
  marca: { h: [293, 292, 290, 288, 286, 284, 282, 281, 281, 282, 284], c: [0.018, 0.035, 0.07, 0.115, 0.165, 0.21, 0.228, 0.215, 0.18, 0.13, 0.085] },
  // neutros con un toque mínimo de la marca (antes, grises violetas de croma 0,04–0,05)
  neutro: { h: 288, c: [0.003, 0.005, 0.008, 0.012, 0.016, 0.02, 0.024, 0.027, 0.03, 0.032, 0.03] },
  verde: { h: 154, c: [0.03, 0.05, 0.09, 0.13, 0.155, 0.155, 0.13, 0.115, 0.095, 0.075, 0.055] },
  ambar: { h: 68, c: [0.03, 0.06, 0.1, 0.14, 0.16, 0.155, 0.13, 0.115, 0.095, 0.075, 0.055] },
  rojo: { h: 22, c: [0.02, 0.04, 0.08, 0.13, 0.18, 0.2, 0.19, 0.17, 0.14, 0.1, 0.07] },
  azul: { h: 258, c: [0.02, 0.04, 0.07, 0.11, 0.15, 0.175, 0.18, 0.16, 0.13, 0.095, 0.065] },
  oro: { h: 85, c: [0.03, 0.05, 0.09, 0.12, 0.14, 0.14, 0.12, 0.105, 0.09, 0.07, 0.05] },
  rosa: { h: 355, c: [0.02, 0.04, 0.08, 0.13, 0.18, 0.2, 0.19, 0.17, 0.14, 0.1, 0.07] },
  turquesa: { h: 190, c: [0.025, 0.045, 0.075, 0.1, 0.115, 0.11, 0.095, 0.085, 0.07, 0.055, 0.04] },
  naranja: { h: 48, c: [0.025, 0.05, 0.09, 0.13, 0.165, 0.17, 0.15, 0.13, 0.105, 0.08, 0.055] },
};
export const ESCALAS = Object.fromEntries(Object.entries(DEF).map(([k, { h, c }]) => [k, Object.fromEntries(PASOS.map((p, i) => [p, oklch(LUZ[i], c[i], Array.isArray(h) ? h[i] : h)]))]));
// La noche: las superficies del tema oscuro, cada nivel un poco más claro (la profundidad, con luz y no con sombras)
const NOCHE_L = [0.165, 0.21, 0.25, 0.29, 0.33];
export const NOCHE = Object.fromEntries(NOCHE_L.map((L, i) => [i, oklch(L, [0.017, 0.032, 0.036, 0.038, 0.04][i], 288)]));
export const BLANCO = '#FFFFFF', NEGRO = '#000000';
// La tinta noche de la portada, del icono y de la barra del sistema al abrir (la de siempre: no se toca)
export const PORTADA = '#1E1548';
const e = (k, p) => ESCALAS[k][p];

// ---------- los temas (2, 4–7): cada token con significado, en su paso ----------
// Los nombres de la izquierda son los de estilos.css (los de siempre); se escriben en color.css como var(--escala-paso).
export const TEMAS = {
  claro: {
    tiza: ['neutro', 100], hoja: BLANCO, 'hoja-2': ['neutro', 50], 'hoja-3': ['neutro', 100],
    tinta: ['neutro', 950], 'tinta-2': ['neutro', 700], 'tinta-3': ['neutro', 600], linea: ['neutro', 200],
    hero: ['marca', 950], 'sobre-hero': '#F3F1FB', 'sobre-hero-2': '#BDB8DA',
    ok: ['verde', 700], 'ok-suave': ['verde', 100], 'ok-borde': ['verde', 300], 'ok-solido': ['verde', 600],
    aviso: ['ambar', 700], 'aviso-suave': ['ambar', 100], 'aviso-borde': ['ambar', 300], 'aviso-solido': ['ambar', 600],
    alerta: ['rojo', 600], 'alerta-suave': ['rojo', 100], 'alerta-borde': ['rojo', 300], 'alerta-solido': ['rojo', 600],
    info: ['azul', 700], 'info-suave': ['azul', 100], 'info-borde': ['azul', 300], 'info-solido': ['azul', 600],
    dato: ['marca', 500], oro: ['oro', 400], 'oro-texto': ['oro', 700], 'oro-suave': ['oro', 100],
    flota: ['neutro', 950], 'sobre-flota': ['neutro', 100],
    'int-trabajo': ['verde', 700], 'int-descanso': ['azul', 700], 'int-preparar': ['ambar', 700], 'int-fin': ['marca', 700],
    'disco-rojo': ['rojo', 600], 'disco-azul': ['azul', 600], 'disco-amarillo': ['oro', 400], 'disco-verde': ['verde', 600],
    'av-1': ['marca', 600], 'av-2': ['azul', 600], 'av-3': ['turquesa', 700], 'av-4': ['rosa', 700], 'av-5': ['naranja', 700], 'av-6': ['azul', 800],
  },
  oscuro: {
    tiza: ['noche', 0], hoja: ['noche', 1], 'hoja-2': ['noche', 2], 'hoja-3': ['noche', 3],
    tinta: '#ECEBF5', 'tinta-2': '#B5B2C9', 'tinta-3': '#9E9BB4', linea: ['noche', 4],
    hero: '#211B42', 'sobre-hero': '#F3F1FB', 'sobre-hero-2': '#BDB8DA',
    ok: ['verde', 300], 'ok-suave': '#15301F', 'ok-borde': ['verde', 700], 'ok-solido': ['verde', 400],
    aviso: ['ambar', 300], 'aviso-suave': '#332410', 'aviso-borde': ['ambar', 700], 'aviso-solido': ['ambar', 400],
    alerta: ['rojo', 300], 'alerta-suave': '#3A1620', 'alerta-borde': ['rojo', 700], 'alerta-solido': ['rojo', 400],
    info: ['azul', 300], 'info-suave': '#142640', 'info-borde': ['azul', 700], 'info-solido': ['azul', 400],
    dato: ['marca', 400], oro: ['oro', 300], 'oro-texto': ['oro', 200], 'oro-suave': '#2E2510',
    flota: ['noche', 4], 'sobre-flota': '#EDEBF7',
    'int-trabajo': ['verde', 800], 'int-descanso': ['azul', 800], 'int-preparar': ['ambar', 800], 'int-fin': ['marca', 800],
    'disco-rojo': ['rojo', 400], 'disco-azul': ['azul', 400], 'disco-amarillo': ['oro', 300], 'disco-verde': ['verde', 400],
    'av-1': ['marca', 400], 'av-2': ['azul', 300], 'av-3': ['turquesa', 300], 'av-4': ['rosa', 300], 'av-5': ['naranja', 300], 'av-6': ['azul', 200],
  },
};
// El negro puro (OLED): solo cambian las superficies (en estilos.css)
export const OLED = { tiza: NEGRO, hoja: '#0C0B12', 'hoja-2': '#17151F' };

// El valor hex de un token en un tema
export function valor(tema, token) {
  const t = TEMAS[tema === 'oled' ? 'oscuro' : tema];
  if (tema === 'oled' && OLED[token]) return OLED[token];
  const v = t[token];
  if (v == null) return null;
  if (typeof v === 'string') return v;
  const [k, p] = v;
  return k === 'noche' ? NOCHE[p] : e(k, p);
}
export const SUPERFICIES = Object.fromEntries(['claro', 'oscuro', 'oled'].map((t) => [t, { tiza: valor(t, 'tiza'), hoja: valor(t, 'hoja'), 'hoja-2': valor(t, 'hoja-2') }]));
export const TEXTOS = Object.fromEntries(['claro', 'oscuro'].map((t) => [t, { tinta: valor(t, 'tinta'), 'tinta-2': valor(t, 'tinta-2'), 'tinta-3': valor(t, 'tinta-3') }]));

// ---------- los acentos (16): el color de la acción, ocho a elegir ----------
// Para cada tema: el acento, su hover, el fondo suave, el texto sobre el acento y el brillo de la tarjeta del día.
// (L: la luminosidad del acento en claro; algunos van un poco más oscuros que su 600 para pasar AA también sobre el vidrio)
const acento = (k, L = null, oscuroP = 400) => {
  const [, c, h] = aOklch(e(k, 600));
  const claro = L == null ? { morado: e(k, 600), hover: e(k, 700) } : { morado: oklch(L, c, h), hover: oklch(L - 0.07, c, h) };
  return {
  claro: { ...claro, suave: e(k, 100), sobre: BLANCO, hero2: e(k, 900) },
  oscuro: { morado: e(k, oscuroP), hover: e(k, oscuroP - 100), suave: oklch(0.27, 0.06, aOklch(e(k, 500))[2]), sobre: NOCHE[0], hero2: e(k, 800) },
  };
};
export const ACENTOS = [
  { id: 'morado', nombre: 'Morado FBE', ...acento('marca') },
  { id: 'azul', nombre: 'Azul', ...acento('azul', 0.47) },
  { id: 'pino', nombre: 'Verde pino', ...acento('turquesa', 0.45) },
  { id: 'frambuesa', nombre: 'Frambuesa', ...acento('rosa') },
  { id: 'cobre', nombre: 'Cobre', ...acento('naranja', 0.47) },
  { id: 'oceano', nombre: 'Océano', claro: { morado: oklch(0.47, 0.11, 225), hover: oklch(0.41, 0.1, 225), suave: oklch(0.95, 0.03, 225), sobre: BLANCO, hero2: oklch(0.28, 0.07, 225) }, oscuro: { morado: oklch(0.8, 0.11, 220), hover: oklch(0.86, 0.09, 220), suave: oklch(0.27, 0.05, 225), sobre: NOCHE[0], hero2: oklch(0.36, 0.08, 225) } },
  { id: 'lima', nombre: 'Lima', claro: { morado: oklch(0.47, 0.12, 128), hover: oklch(0.41, 0.11, 128), suave: oklch(0.95, 0.05, 125), sobre: BLANCO, hero2: oklch(0.28, 0.07, 130) }, oscuro: { morado: oklch(0.85, 0.17, 125), hover: oklch(0.9, 0.14, 125), suave: oklch(0.27, 0.05, 128), sobre: NOCHE[0], hero2: oklch(0.36, 0.08, 130) } },
  { id: 'grafito', nombre: 'Grafito', claro: { morado: e('neutro', 800), hover: e('neutro', 900), suave: e('neutro', 100), sobre: BLANCO, hero2: e('neutro', 900) }, oscuro: { morado: e('neutro', 200), hover: e('neutro', 100), suave: e('neutro', 900), sobre: NOCHE[0], hero2: e('neutro', 800) } },
];

// ---------- los datos (14): gráficas ----------
// Ocho colores categóricos que se distinguen también con daltonismo (orden Okabe-Ito adaptado a la marca), en orden fijo.
export const SERIES = {
  claro: [e('marca', 600), oklch(0.62, 0.15, 55), e('turquesa', 600), e('azul', 600), e('rosa', 600), oklch(0.72, 0.15, 90), e('verde', 700), e('neutro', 600)],
  oscuro: [e('marca', 400), oklch(0.78, 0.13, 55), e('turquesa', 300), e('azul', 300), e('rosa', 300), oklch(0.85, 0.13, 90), e('verde', 300), e('neutro', 300)],
};
// Secuencial (una sola tinta, de poco a mucho) y divergente (por debajo ↔ por encima del objetivo, gris en medio)
export const SECUENCIAL = [100, 300, 500, 700, 900].map((p) => e('marca', p));
export const DIVERGENTE = [e('naranja', 600), e('naranja', 300), e('neutro', 200), e('azul', 300), e('azul', 600)];

// ---------- las secciones (15): todas salen de las escalas ----------
export const MACROS = {
  claro: { proteina: e('marca', 600), carbos: e('oro', 600), grasa: e('azul', 600) },
  oscuro: { proteina: e('marca', 400), carbos: e('oro', 300), grasa: e('azul', 400) },
};
export const ZONAS = {
  claro: [['azul', 500], ['verde', 600], ['oro', 600], ['naranja', 600], ['rojo', 600]],
  claroTexto: [['azul', 700], ['verde', 700], ['oro', 700], ['naranja', 700], ['rojo', 700]],
  oscuro: [['azul', 300], ['verde', 300], ['oro', 300], ['naranja', 300], ['rojo', 300]],
  oscuroTexto: [['azul', 200], ['verde', 200], ['oro', 200], ['naranja', 200], ['rojo', 200]],
};
// Las celebraciones (12): oro de verdad, fuego y la marca
export const CELEBRACION = {
  record: [e('oro', 200), e('oro', 400), e('oro', 600)],
  fuego: [e('ambar', 300), e('naranja', 500), e('rojo', 600)],
  confeti: [e('marca', 500), e('oro', 400), e('rosa', 400), e('turquesa', 400), e('azul', 400), e('naranja', 400)],
};

// ---------- la ayuda para daltonismo (18): el verde y el rojo pasan a azul y naranja ----------
export const DALTONISMO = {
  claro: { ok: e('azul', 700), 'ok-suave': e('azul', 100), 'ok-borde': e('azul', 300), 'ok-solido': e('azul', 600), alerta: e('naranja', 700), 'alerta-suave': e('naranja', 100), 'alerta-borde': e('naranja', 300), 'alerta-solido': e('naranja', 700) },
  oscuro: { ok: e('azul', 300), 'ok-suave': '#142640', 'ok-borde': e('azul', 700), 'ok-solido': e('azul', 400), alerta: e('naranja', 300), 'alerta-suave': '#3A2010', 'alerta-borde': e('naranja', 700), 'alerta-solido': e('naranja', 400) },
};
// El alto contraste (17): textos y líneas más oscuros (claro) o más claros (oscuro), para AAA (7:1)
export const ALTO_CONTRASTE = {
  claro: { tinta: NEGRO, 'tinta-2': e('neutro', 900), 'tinta-3': e('neutro', 800), linea: e('neutro', 500) },
  oscuro: { tinta: BLANCO, 'tinta-2': e('neutro', 100), 'tinta-3': e('neutro', 200), linea: e('neutro', 400) },
};

// ---------- la tarjeta del día (9): su color, según lo que toca ----------
// fuerza (la marca), cardio (azul), movilidad y descanso (turquesa), semana de descarga (ámbar) y hecha (verde)
export function tonoDia({ hero = 'entreno', sesion = 'fuerza', foco = null } = {}) {
  if (hero === 'descanso') return 'descanso';
  if (hero === 'hecha' || hero === 'semana') return 'hecha';
  if (foco === 'descarga') return 'descarga';
  if (sesion === 'cardio') return 'cardio';
  if (sesion === 'movilidad') return 'movilidad';
  return 'fuerza';
}

// ---------- los iconos a dos tintas (13) ----------
// De un trazado de icono, los trozos que se rellenan: los que empiezan con «M» y se cierran con «z» (los que empiezan
// con «m» dependen del trozo anterior y no se pueden sacar sueltos).
export function trozosCerrados(d = '') {
  return String(d).split(/(?=[Mm])/).filter((t) => /^M/.test(t) && /[zZ]\s*$/.test(t.trim())).join(' ');
}
