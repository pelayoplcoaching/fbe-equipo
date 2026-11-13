// (tanda 5) Lo que hace bonita «La travesía», en números: cuándo cruza una estrella fugaz, cuánto se estira el lobo al
// saltar, cuánto tiembla la pantalla al tropezar, cuándo parpadea, qué cartel toca… Solo funciones puras (las pinta
// ui/atleta/travesia-pinta.js). Nada de esto cambia las reglas del juego.

const frac = (x) => x - Math.floor(x);
// Un número fijo entre 0 y 1 para cada (n, sal): el mismo siempre
export const dado = (n, sal = 0) => frac(Math.sin(n * 127.1 + sal * 311.7 + 13.37) * 43758.5453);
const entre = (v, a, b) => Math.max(a, Math.min(b, v));
// De 0 a 1, suave al salir y al llegar
export const suave = (k) => { const x = entre(k, 0, 1); return x * x * (3 - 2 * x); };

// ---------- Estrellas fugaces ----------
// Cada `CADA_FUGAZ` segundos puede cruzar una (dos de cada tres veces), durante `DURA_FUGAZ`. Devuelve null o
// { x, y (de 0 a 1 del cielo, la cabeza), dx, dy (hacia dónde va, por unidad de avance), k (0 a 1: por dónde va) }
export const CADA_FUGAZ = 11, DURA_FUGAZ = 0.9;
export function fugaz(t, semilla = 0) {
  if (!(t >= 0)) return null;
  const n = Math.floor(t / CADA_FUGAZ), dentro = t - n * CADA_FUGAZ;
  if (dado(n, semilla) > 0.66) return null;
  const empieza = 1.5 + dado(n, semilla + 1) * (CADA_FUGAZ - DURA_FUGAZ - 3);
  if (dentro < empieza || dentro > empieza + DURA_FUGAZ) return null;
  const k = (dentro - empieza) / DURA_FUGAZ;
  const x0 = 0.12 + dado(n, semilla + 2) * 0.6, y0 = 0.05 + dado(n, semilla + 3) * 0.3;
  const dx = 0.2 + dado(n, semilla + 4) * 0.12, dy = 0.08 + dado(n, semilla + 5) * 0.08;
  return { x: x0 + dx * k, y: y0 + dy * k, dx, dy, k };
}

// ---------- El lobo ----------
// Cuánto se estira (a lo largo) y se encoge (a lo alto) según sube, baja o acaba de caer: { sx, sy }, cerca de 1.
// vy: velocidad vertical (m/s); enAire; desdeCaer: segundos desde que tocó el suelo (o null)
export function estirar({ vy = 0, enAire = false, desdeCaer = null } = {}) {
  if (enAire) {
    const k = entre(Math.abs(vy) / 16, 0, 1) * 0.12;   // (a más velocidad, más largo y más fino)
    return { sx: 1 + k * 0.6, sy: 1 - k * 0.5 + (vy > 0 ? k * 0.4 : 0) };
  }
  if (desdeCaer != null && desdeCaer >= 0 && desdeCaer < 0.22) {
    const k = Math.sin((desdeCaer / 0.22) * Math.PI) * 0.14;   // (al caer se aplasta y vuelve)
    return { sx: 1 + k, sy: 1 - k };
  }
  return { sx: 1, sy: 1 };
}
// ¿Tiene los ojos cerrados? Un parpadeo de 0,12 s cada 3 a 5 s
export function parpadea(t, semilla = 0) {
  if (!(t >= 0)) return false;
  const n = Math.floor(t / 4), dentro = t - n * 4;
  const cuando = 0.4 + dado(n, semilla + 9) * 3.2;
  return dentro >= cuando && dentro < cuando + 0.12;
}
// La cola y las orejas van con retraso: cuánto se levanta la cola (de -1 a 1) según cómo se mueve
export function colaAlViento({ fase = 0, vy = 0, enAire = false, racha = 0 } = {}) {
  const base = Math.sin(fase * 0.5) * 0.25 + Math.sin(fase * 1.3 + 1) * 0.1;
  const salto = enAire ? entre(-vy / 14, -1, 1) * 0.7 : 0;      // (sube al caer, baja al subir: va detrás del cuerpo)
  return entre(base + salto + Math.min(0.3, racha * 0.015), -1, 1);
}
// La racha, de 0 a 1 (a partir de 5 se empieza a notar; con 18, a tope): para la estela y las líneas de viento
export const impetu = (racha) => suave((Math.max(0, racha) - 4) / 14);

// ---------- La pantalla ----------
// Cuánto tiembla tras un tropiezo: { dx, dy } en px, durante 0,35 s
export function sacudida(desde, fuerza = 7) {
  if (!(desde >= 0) || desde > 0.35) return { dx: 0, dy: 0 };
  const k = (1 - desde / 0.35) ** 2 * fuerza;
  return { dx: Math.sin(desde * 95) * k, dy: Math.cos(desde * 71) * k * 0.6 };
}
// La entrada: de 0 (negro, la luna abajo) a 1 (todo en su sitio), en 1,4 s
export const entrada = (desde) => suave((desde ?? 9) / 1.4);

// Las cifras que ruedan: el número que se enseña se acerca al de verdad (sin pasarse)
export function rodar(visto, real, dt) {
  if (!(dt > 0) || Math.abs(real - visto) < 1) return real;
  const paso = Math.max(1, Math.abs(real - visto) * Math.min(1, dt * 9));
  return real > visto ? Math.min(real, visto + paso) : Math.max(real, visto - paso);
}

// ---------- Los carteles ----------
// Lo que merece un cartel al pasar de un cuadro a otro: los hitos de distancia (cada 250 m; el kilómetro, más grande) y
// de racha (10, 20, 30…). Devuelve { texto, grande } o null
// (top, tanda 1) Con `combo` (el multiplicador de las estrellas), los carteles de racha pasan a ser los del combo: sale
// «Combo ×2» cuando sube (la racha ya no tiene cartel propio: serían dos carteles para lo mismo)
export function cartelDeHito(antes, ahora) {
  const m0 = Math.floor(Math.max(0, antes?.metros || 0) / 250), m1 = Math.floor(Math.max(0, ahora?.metros || 0) / 250);
  if (ahora?.combo != null) {
    if ((ahora.combo || 1) > (antes?.combo || 1)) return { texto: `Combo ×${ahora.combo}`, grande: ahora.combo >= 3 };
    if (m1 <= m0) return null;
  }
  if (m1 > m0) {
    const m = m1 * 250;
    return m % 1000 === 0 ? { texto: `${m / 1000} km`, grande: true } : { texto: `${m} m`, grande: false };
  }
  const r0 = Math.floor(Math.max(0, antes?.racha || 0) / 10), r1 = Math.floor(Math.max(0, ahora?.racha || 0) / 10);
  if (r1 > r0) return { texto: `Racha ×${r1 * 10}`, grande: false };
  return null;
}
// El nombre de cada paisaje, para el cartel de cuando cambia
export const NOMBRES_PAISAJE = ['La montaña', 'El bosque', 'Las cumbres nevadas', 'El valle del amanecer'];
export const nombrePaisaje = (i) => NOMBRES_PAISAJE[((Math.round(i) % NOMBRES_PAISAJE.length) + NOMBRES_PAISAJE.length) % NOMBRES_PAISAJE.length];
// Cuánto se ve un cartel a los `desde` segundos de salir (entra, se queda y se va): de 0 a 1; dura 2,2 s
export function vidaCartel(desde, dura = 2.2) {
  if (!(desde >= 0) || desde >= dura) return 0;
  return Math.min(suave(desde / 0.25), suave((dura - desde) / 0.5));
}

// ---------- El cielo ----------
// ¿Hay aurora? De noche, en las cumbres nevadas (paisaje 2), o con la luna casi nueva en cualquier otro
export const hayAurora = (amb) => !!amb && amb.fase === 'noche' && !/lluvia|niebla|tormenta/.test(amb.clima || '') && (amb.paisaje === 2 || (amb.luna?.ilum ?? 1) < 0.12);
// A qué altura (de 0 a 1 del cielo) va el sol o la luna: alto de noche y de día; bajo, casi en el horizonte, al alba y al ocaso
export const alturaAstro = (fase) => (fase === 'alba' || fase === 'ocaso' ? 0.8 : 0.35);

// ---------- Si el móvil va justo ----------
// La media móvil de lo que tarda un cuadro (ms) y, con ella, si conviene pintar «ligero» (sin lo más caro): cuando,
// pasados los primeros 90 cuadros, la media pasa de 26 ms (menos de unos 38 cuadros por segundo). Una vez aligerado, se queda.
export const mediaCuadro = (media, ms) => (media == null ? ms : media * 0.94 + Math.min(120, Math.max(0, ms)) * 0.06);
export const convieneAligerar = (media, cuadros, ya = false) => ya || (cuadros >= 90 && media > 26);

// ---------- (top, tanda 1) La calidad, a tres niveles ----------
// 2: todo · 1: ligero (sin lo más caro) · 0: mínimo (además, sin nubes, polvo, huellas, fauna ni brillos). Baja un nivel
// cuando, pasados 90 cuadros en el nivel, la media de lo que tarda un cuadro pasa de 26 ms; y sube uno (una sola vez por
// etapa, para que no vaya y venga) si lleva 300 cuadros por debajo de 15 ms. Con la pantalla oculta no cuenta.
export const CALIDAD_INICIAL = () => ({ media: null, cuadros: 0, nivel: 2, desde: 0, subidas: 0 });
export function calidad(est, ms, visible = true) {
  const e = est || CALIDAD_INICIAL();
  if (!visible) return e;
  const media = mediaCuadro(e.media, ms), cuadros = e.cuadros + 1;
  let nivel = e.nivel, desde = e.desde + 1, subidas = e.subidas;
  if (cuadros >= 90 && desde >= 90 && nivel > 0 && media > 26) { nivel -= 1; desde = 0; }
  else if (nivel < 2 && desde >= 300 && media < 15 && subidas < 1) { nivel += 1; desde = 0; subidas += 1; }
  return { media, cuadros, nivel, desde, subidas };
}

// ---------- (top, tanda 1) Los avisos de lo que viene ----------
// Lo que pide algo distinto de un salto normal (el monte, doble salto; la rama, agacharse) y aún no se ve: el más cercano
// entre el borde de la pantalla y `delante` m más allá. Devuelve { tipo, cerca (0 lejos, 1 a punto de entrar) } o null.
export function avisoDe(obstaculos, bordeDerecho, delante = 9) {
  for (const o of obstaculos || []) {
    if (o.pasado || (o.tipo !== 'monte' && o.tipo !== 'rama')) continue;
    const izq = o.x - o.w / 2;
    if (izq <= bordeDerecho) continue;
    if (izq > bordeDerecho + delante) return null;
    return { tipo: o.tipo, cerca: Math.max(0, Math.min(1, 1 - (izq - bordeDerecho) / delante)) };
  }
  return null;
}
