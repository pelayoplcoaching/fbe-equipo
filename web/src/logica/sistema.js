// El sistema de diseño de FBE Equipo (color y diseño, tanda 3): las escalas de lo que no es color. Como la paleta
// (logica/paleta.js), es la única fuente: `scripts/paleta.mjs` genera con esto `web/src/sistema.css`, y las pruebas
// (test/sistema.test.mjs) comprueban que está al día y que no aparecen valores sueltos fuera de la escala.
//
// Los nombres dicen el valor (--r-10, --letra-14): son pasos de una escala, no papeles. Los papeles de siempre
// (--r, --r-s, --r-xs; --tipo-nota, --tipo-pie…; --mov-rapido, --mov-medio, --mov-lento) siguen en estilos.css y
// diseno.css, y encajan en la escala.

// ---------- radios ----------
// (8 px = --r-xs, 12 px = --r-s y 18 px = --r ya tenían nombre)
export const RADIOS = [2, 4, 6, 10, 14, 16, 24];
export const RADIOS_CON_NOMBRE = { 8: 'r-xs', 12: 'r-s', 18: 'r' };
export const PILDORA = 999;
// El paso de un radio en px: el más cercano, solo si no se nota (hasta 1 px); si no, null (se queda como está)
export function pasoRadio(px) {
  if (px === 0) return null;
  if (px >= 500) return 'r-pildora';
  const todos = [...RADIOS.map((v) => [v, `r-${v}`]), ...Object.entries(RADIOS_CON_NOMBRE).map(([v, n]) => [Number(v), n])];
  let mejor = null;
  // (a igual distancia, el mayor: una esquina un pelo más redonda no recorta nada)
  for (const [v, n] of todos) { const d = Math.abs(v - px); if (d <= 1 && (!mejor || d < mejor[1] || (d === mejor[1] && v > mejor[2]))) mejor = [n, d, v]; }
  return mejor ? mejor[0] : null;
}

// ---------- letra ----------
// Tamaños en rem (siguen el tamaño de letra del móvil y el ajuste de la app), con su valor en px a tamaño normal.
// La letra de la app va en una rejilla de medio píxel (12,5; 13,5…): son pasos de pleno derecho. Redondearlos movía
// líneas en casi todas las pantallas (medido: hasta un 4 % más altas), así que se quedan.
export const LETRAS = [10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 16.5, 17, 17.5, 18, 19, 20, 21, 22, 24];
export const nombreLetra = (v) => `letra-${String(v).replace('.', '-')}`;
// El paso de un tamaño en rem: el más cercano, solo si no se nota (menos de un cuarto de píxel)
export function pasoLetra(rem) {
  let px = rem * 16;
  // (0,8438rem es 13,5 px escrito con cuatro decimales: se toma como el medio píxel que es)
  if (Math.abs(px * 2 - Math.round(px * 2)) < 0.02) px = Math.round(px * 2) / 2;
  let mejor = null;
  for (const v of LETRAS) { const d = Math.abs(v - px); if (d <= 0.25 && (!mejor || d < mejor[1])) mejor = [v, d]; }
  return mejor ? nombreLetra(mejor[0]) : null;
}
// Los pesos: nueve (la fuente es variable; entre 620 y 600 no hay quien vea la diferencia)
export const PESOS = [400, 500, 560, 600, 650, 700, 750, 800, 900];
export function pasoPeso(p) {
  let mejor = null;
  for (const v of PESOS) { const d = Math.abs(v - p); if (d <= 20 && (!mejor || d < mejor[1])) mejor = [v, d]; }
  return mejor ? mejor[0] : null;
}

// ---------- opacidades ----------
export const OPACIDADES = [0, 0.08, 0.12, 0.15, 0.2, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1];
export function pasoOpacidad(o) {
  let mejor = null;
  for (const v of OPACIDADES) { const d = Math.abs(v - o); if (d <= 0.0201 && (!mejor || d < mejor[1])) mejor = [v, d]; }
  return mejor ? mejor[0] : null;
}
// Lo deshabilitado, siempre igual (antes, diez opacidades distintas entre 0,35 y 0,7)
export const OP_DESHABILITADO = 0.45;

// ---------- capas (z-index) ----------
// De abajo arriba. Los valores son los de siempre: solo ganan nombre (lo que va entre dos capas se escribe
// calc(var(--capa-x) + n)).
export const CAPAS = {
  fondo: 10,       // la textura de la página
  pegado: 15,      // lo que se queda pegado al borde al desplazar (la barra del chat)
  barra: 20,       // la barra de pestañas
  flotante: 30,    // lo que flota sobre el contenido (tirar para actualizar, la píldora del descanso, el teclado)
  hoja: 40,        // velos, hojas y pantallas que tapan la app
  aviso: 50,       // los avisos breves (toast)
  pantalla: 60,    // lo que se abre a pantalla completa (cámara, visor, buscador, confeti)
  inmersiva: 70,   // lo que tapa incluso eso (foto grande, apuntes, el juego)
  escena: 90,      // las escenas de inicio y de final
  historia: 400,   // las historias de los apuntes, por encima de todo lo anterior
  encima: 1000,    // lo que nunca puede quedar debajo
};
// Un z-index con nombre: la capa igual o inmediatamente inferior, más lo que falte (los pequeños, de −2 a 9, son
// apilados locales de cada componente y se quedan en número)
export function capaDe(z) {
  if (z < 10) return null;
  const orden = Object.entries(CAPAS).sort((a, b) => a[1] - b[1]);
  let base = orden[0];
  for (const c of orden) if (c[1] <= z) base = c;
  // (un poco por debajo de la capa siguiente se lee mejor como «la siguiente menos algo»)
  const sig = orden[orden.findIndex((c) => c[0] === base[0]) + 1];
  if (sig && sig[1] - z <= 2 && z !== base[1]) return `calc(var(--capa-${sig[0]}) - ${sig[1] - z})`;
  return z === base[1] ? `var(--capa-${base[0]})` : `calc(var(--capa-${base[0]}) + ${z - base[1]})`;
}

// ---------- tiempos ----------
// (rápido, medio y lento ya tenían nombre: --mov-rapido, --mov-medio, --mov-lento, en diseno.css)
export const TIEMPOS = { instante: 0.09, rapido: 0.14, breve: 0.2, medio: 0.26, lento: 0.42, pausado: 0.6 };
export const TIEMPOS_NUEVOS = ['instante', 'breve', 'pausado'];
// El paso de una duración de transición: el más cercano, solo si la diferencia es de hasta 40 ms (o el 20 %)
export function pasoTiempo(s) {
  if (!(s > 0) || s > 5) return null;
  let mejor = null;
  for (const [n, v] of Object.entries(TIEMPOS)) { const d = Math.abs(v - s); if ((d <= 0.0401 || d / v <= 0.2) && (!mejor || d < mejor[1])) mejor = [n, d]; }
  return mejor ? `mov-${mejor[0]}` : null;
}

// ---------- filos ----------
export const FILOS = { fino: 1, medio: 1.5, fuerte: 2, marca: 3 };

// ---------- sombras: las capas que se repetían por toda la app, con nombre ----------
// (las alturas ya lo tenían: --sombra-tarjeta, --sombra-flotante y --sombra-hoja, en diseno.css)
export const SOMBRAS = {
  'anillo': 'inset 0 0 0 1px var(--linea)',
  'anillo-suave': 'inset 0 0 0 1px var(--borde)',
  'anillo-acento': 'inset 0 0 0 2px var(--morado)',
  'anillo-acento-fino': 'inset 0 0 0 1px var(--morado)',
  'halo': '0 0 0 2px var(--hoja)',
  'halo-ancho': '0 0 0 3px var(--hoja)',
  'raya': '0 1px 0 var(--linea)',
  'brillo': 'inset 0 1px 0 rgba(255, 255, 255, .25)',
  'sombra-accion': '0 6px 14px -8px color-mix(in srgb, var(--morado) 80%, transparent)',
};
// Lo que antes se escribía de varias maneras casi iguales y ahora es el mismo token
export const SOMBRAS_IGUALES = {
  'inset 0 1px 0 rgba(255, 255, 255, .22)': 'brillo',
  '0 8px 18px -8px color-mix(in srgb, var(--morado) 85%, transparent)': 'sombra-accion',
  '0 6px 14px -6px color-mix(in srgb, var(--morado) 80%, transparent)': 'sombra-accion',
  '0 5px 12px -5px color-mix(in srgb, var(--morado) 80%, transparent)': 'sombra-accion',
  '0 6px 14px -8px color-mix(in srgb, var(--morado) 70%, transparent)': 'sombra-accion',
};
// Los sitios que cambian --linea, --hoja o --morado para sí mismos: los tokens que dependen de ellos se vuelven a
// declarar ahí, para que tomen el valor de ese sitio (una variable se resuelve donde se declara)
// (y las hojas, que en oscuro van un nivel más claras: paleta.js, ELEVADOS)
export const AMBITOS = [':root', '.historia', ':root[data-gimnasio] .sesion-vista', ':root[data-gimnasio] .temporizador', '.hoja-dialogo'];

// ---------- las filas (color 3, 18): pasar por encima, elegida y cebra, iguales en todas las listas y tablas ----------
export const FILAS = {
  'fila-hover': 'color-mix(in srgb, var(--morado) 4%, var(--hoja))',
  'fila-elegida': 'color-mix(in srgb, var(--morado) 9%, var(--hoja))',
  'fila-cebra': 'color-mix(in srgb, var(--tinta) 3%, transparent)',
};

// ---------- el espaciado (visual, 1) ----------
// Márgenes, rellenos y huecos: dieciséis pasos con nombre (--esp-N, en px). Antes, 66 valores distintos. Los impares
// pequeños (3, 5, 7…) van al múltiplo de 4 más cercano (un píxel, no se nota); los de 1 px y los negativos se quedan como están.
export const ESPACIOS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 40, 48];
export function pasoEspacio(px) {
  if (ESPACIOS.includes(px)) return px;
  // (al múltiplo de 4 más cercano: 3 y 5 → 4, 7 y 9 → 8…; unos suben y otros bajan, y las páginas miden lo mismo)
  if (px > 1 && px < 24 && Number.isInteger(px) && px % 2 === 1) return Math.round(px / 4) * 4;
  if (px > 24) { const c = ESPACIOS.find((v) => Math.abs(v - px) <= 1); return c ?? null; }
  return null;
}
