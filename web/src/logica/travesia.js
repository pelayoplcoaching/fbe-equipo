// «La travesía»: el juego del descanso. Un lobo corre de noche por la montaña y salta lo que encuentra; cada descanso
// es una etapa que dura lo que el descanso, y los metros se suman en la sesión. Aquí va el juego entero sin pantalla
// (lo pinta ui/atleta/Travesia.jsx): el terreno sale de una semilla, así que la misma semilla y los mismos toques dan
// siempre la misma etapa, y los tests pueden jugarla.
//
// Las medidas van en metros y segundos. El lobo no muere: si tropieza, pierde el ritmo (vuelve a la velocidad de salida)
// y sigue. Así la etapa siempre dura el descanso entero y lo que cambia es lo lejos que llega.

import { lunesDe, sumarDias } from './fechas.js';

export const GRAVEDAD = 46;      // m/s²
export const V_SALTO = 13.6;     // sube 2 m y está 0,59 s en el aire
export const V_DOBLE = 11.5;     // el segundo salto, en el aire
export const V_BASE = 6.5;       // m/s al empezar y tras un tropiezo
export const V_MAX = 10;         // m/s con el ritmo cogido
export const POR_RACHA = 0.2;    // m/s que gana por cada obstáculo saltado seguido
export const LOBO = { medio: 0.55, alto: 0.8 };   // su caja de choque (más pequeña que el dibujo: perdona)
export const TROPIEZO = 0.55;    // s que tarda en rehacerse
export const INMUNE = 1.3;       // s tras tropezar en los que no vuelve a tropezar

// Lo que hay que saltar: ancho y alto en metros; `plano`, la parte de arriba que es llana (una roca es chata; un pico,
// puntiagudo). El monte pide el doble salto y no sale hasta que la etapa lleva un rato.
export const OBSTACULOS = {
  // (top, tanda 2) el ciervo de la estampida: como una roca alta, en fila de tres
  ciervo: { w: 1, h: 0.95, plano: 0.4 },
  roca: { w: 0.9, h: 0.7, plano: 0.5 },
  pico: { w: 1.4, h: 1.3, plano: 0.1 },
  monte: { w: 2.4, h: 2.3, plano: 0.12, desde: 150 },
  // (tanda 1) el río: un tramo especial cada kilómetro de travesía; ancho y a ras de suelo, pide un buen salto (o el doble)
  rio: { w: 3, h: 0.12, plano: 0.95 },
  // (tanda 1) la rama: cuelga a media altura; no se salta, se pasa agachado. Solo sale si la etapa lleva «movimientos»
  rama: { w: 1, h: 0.75, plano: 1, desde: 300 },
};
export const AGACHADO = 0.7;        // s que dura agacharse
export const ALTO_AGACHADO = 0.45;  // lo que mide agachado (de pie, LOBO.alto)
export const V_CALMA = 2.2;         // m/s en el modo calma (va al paso)
export const CADA_RIO = 1000;       // m de travesía entre dos ríos
// (top, tanda 1) Lo que hace que el salto se sienta justo: un toque que llega un poco antes de poder saltar (aún en el
// aire tras el doble, o tropezando) se guarda y salta en cuanto puede; y se puede saltar un instante después de dejar
// el suelo sin haber saltado (al bajar de una cornisa, tanda 2)
export const GUARDA_TOQUE = 0.13;   // s que se guarda un toque
export const COYOTE = 0.1;          // s tras dejar el suelo en los que aún vale el primer salto
// «Por los pelos»: pasar un obstáculo con menos de ROCE m de hueco da un impulso y un instante a cámara lenta
export const ROCE = 0.22, IMPULSO_ROCE = 0.7, LENTO_ROCE = 0.32, FACTOR_LENTO = 0.45;
// El combo: cada COMBO_CADA saltados seguidos sin tropezar en la etapa, las estrellas valen una más (hasta ×COMBO_MAX)
export const COMBO_CADA = 8, COMBO_MAX = 4;
// (top, tanda 2) Lo que da variedad a cada carrera (solo con `variedad`: la pantalla la pide; sin ella, el juego de siempre)
//   · cuestas: lomas y hondonadas; cuesta arriba frena y cuesta abajo lanza
//   · cornisas: troncos caídos a media altura por los que correr; arriba, más estrellas
//   · potenciadores: uno por etapa como mucho (imán, luna llena, aullido)
//   · momentos: cada MOMENTO_CADA m de travesía, uno de tres (estampida, tormenta, puente colgante)
export const CUESTA = { desde: 220, prob: 0.11, largo: [16, 24], alto: [1.1, 2], hondo: [0.8, 1.3], empuje: 7 };
export const CORNISA = { desde: 320, prob: 0.09, ancho: [5, 8], alto: 1.55, grosor: 0.35 };
export const POTENCIADORES = { iman: { dura: 6, radio: 5 }, luna: { dura: 4, factor: 0.62 }, aullido: { alcance: 30 } };
export const MOMENTO_CADA = 1500, MOMENTOS = ['estampida', 'tormenta', 'puente', 'ventisca'];
// (remate, tanda 6) la ventisca: una pared de nieve que persigue al lobo; empieza a VENTISCA.ventaja m y cada tropiezo la
// acerca; si le alcanza, se lleva unas estrellas (nunca la etapa). Dura VENTISCA.largo m
export const VENTISCA = { largo: 170, ventaja: 9, porTropiezo: 3.2, recupera: 0.5, pierde: 3 };
// (remate, tanda 6) los secretos: una cornisa altísima (solo con el salto largo más el doble) con una estrella dorada, cada
// SECRETO.cada m de travesía
export const SECRETO = { cada: 700, alto: 3.9, ancho: 3.2 };
export const comboDe = (serie) => Math.min(COMBO_MAX, 1 + Math.floor(Math.max(0, serie) / COMBO_CADA));

// Un generador de números con semilla (mulberry32): mismo número de entrada, misma etapa
export function azar(semilla) {
  let a = (semilla >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// opciones (tanda 1):
//   racha0      con cuántos saltados seguidos sale (el entreno empuja: tras un récord, o en un descanso corto)
//   escudos     tropiezos que se le perdonan (uno por serie cumplida como estaba pautada)
//   calma       sin obstáculos y al paso: para respirar tras una serie dura
//   movimientos salen ramas, que se pasan agachado
//   km0         los metros de travesía que llevaba (para que el río caiga cada kilómetro de verdad)
//   unToque     (top, tanda 1: accesibilidad) nada pide doble salto ni agacharse: sin montes ni ramas, y el río más estrecho
//   variedad    (top, tanda 2) cuestas, cornisas, potenciadores y momentos raros
//   tutorial    (top, tanda 2) el primer kilómetro de un atleta nuevo: los primeros obstáculos enseñan un movimiento cada uno
//   fija        (top, tanda 4) la dificultad no se adapta: el mismo terreno para todos (la etapa del día)
//   estrellasPor (remate, tanda 6) cuánto vale cada estrella además del combo (2 en la etapa dorada o con luna llena)
export function nuevaEtapa(semilla = 1, { racha0 = 0, escudos = 0, calma = false, movimientos = false, km0 = 0, unToque = false, variedad = false, tutorial = false, fija = false, estrellasPor = 1 } = {}) {
  const r0 = calma ? 0 : Math.min(18, Math.max(0, Math.round(racha0) || 0));
  const e = {
    semilla, rnd: azar(semilla), t: 0,
    x: 0, y: 0, vy: 0, saltos: 0, v: calma ? V_CALMA : velocidadCon(r0),
    racha: r0, mejorRacha: 0, tropiezo: 0, inmune: 0,
    obstaculos: [], estrellas: [], hasta: 14,   // los primeros metros, despejados
    estrellasCogidas: 0, tropiezos: 0, saltados: 0, sucesos: [],
    calma: !!calma, movimientos: !!movimientos, km0: Math.max(0, Math.round(km0) || 0),
    escudos: calma ? 0 : Math.min(3, Math.max(0, Math.round(escudos) || 0)), escudosUsados: 0,
    potX: 0,
    agachado: 0, pulsado: false, rios: 0,
    // (top, tanda 1) el toque guardado, cuándo pisó suelo por última vez, los roces, la cámara lenta y el combo
    guardado: null, tSuelo: 0, roces: 0, lento: 0, serie: 0, combo: 1, comboMax: 1, unToque: !!unToque && !calma,
    // (top, tanda 2) el terreno y lo que se coge
    variedad: !!variedad && !calma, cuestas: [], cornisas: [], potenciadores: [], sobre: null, cabezazos: 0, arriba: 0,
    iman: 0, luna: 0, potCogidos: [], momentos: [], tutorial: !!tutorial && !calma ? [] : null, fija: !!fija,
    estrellasPor: Math.min(3, Math.max(1, Math.round(estrellasPor) || 1)), ventisca: null, alcanzado: 0, escapadas: 0, doradas: 0,
    // la dificultad se adapta: `ayuda` sube si tropieza mucho (más hueco, más despacio, sin montes) y `reto` si va sobrado
    ayuda: 0, reto: 0, ultimos: [],
  };
  // (top, tanda 2) el potenciador de esta etapa (o ninguno: dos de cada tres etapas lo llevan), entre los 110 y los 330 m
  if (e.variedad && e.rnd() < 0.67) e.potX = 110 + e.rnd() * 220;
  if (e.tutorial) e.tutorial = ['roca', 'pico', ...(e.unToque ? [] : ['monte'])];
  generar(e);
  return e;
}

// (top, tanda 2) La altura del terreno en x: 0 en el llano; en una cuesta, una loma (o una hondonada) suave
export function altoTerreno(e, x) {
  for (const q of e.cuestas || []) {
    if (x <= q.x0 || x >= q.x1) continue;
    const k = (x - q.x0) / (q.x1 - q.x0);
    return q.h * (1 - Math.cos(2 * Math.PI * k)) / 2;
  }
  return 0;
}
// La pendiente (lo que sube por metro)
export function pendiente(e, x) {
  for (const q of e.cuestas || []) {
    if (x <= q.x0 || x >= q.x1) continue;
    const L = q.x1 - q.x0;
    return (q.h * Math.PI / L) * Math.sin(2 * Math.PI * (x - q.x0) / L);
  }
  return 0;
}
// La cornisa sobre la que está (o puede caer) en x
const cornisaEn = (e, x) => (e.cornisas || []).find((c) => Math.abs(x - c.x) <= c.w / 2) || null;

// La altura del obstáculo en un punto (0 fuera de él): una rampa a cada lado y lo llano de arriba
export function perfil(o, x) {
  const medio = o.w / 2, dx = Math.abs(x - o.x);
  if (dx >= medio) return 0;
  const rampa = medio * (1 - o.plano);
  return o.h * Math.min(1, (medio - dx) / rampa);
}

// Añade terreno por delante. El hueco entre dos obstáculos da siempre para caer, ver el siguiente y saltar a la velocidad
// máxima; las estrellas van sobre algún obstáculo (premio por saltar) o sueltas entre dos.
function generar(e) {
  while (e.hasta < e.x + 46) {
    // (top, tanda 2) lo de la variedad, antes que el obstáculo de siempre
    if (e.variedad && generarVariedad(e)) continue;
    if (e.calma) {
      // (calma) solo estrellas bajas, que se cogen al paso
      const x = e.hasta + 5 + e.rnd() * 6;
      e.estrellas.push({ x, y: 0.7 + e.rnd() * 0.5, cogida: false });
      e.hasta = x;
      continue;
    }
    const r = e.rnd();
    // ¿toca río? El primero cuyo kilómetro (contando lo que traía) cae en lo que se va a generar
    const km = Math.floor((e.km0 + e.hasta + 12) / CADA_RIO);
    const tocaRio = km > 0 && km > Math.floor((e.km0 + Math.max(0, e.hasta - 40)) / CADA_RIO) && !e.obstaculos.some((o) => o.tipo === 'rio' && o.x > e.hasta - 60) && e.rioHecho !== km;
    let tipo = e.hasta > OBSTACULOS.monte.desde && r > 0.8 && e.ayuda < 0.6 && !e.unToque ? 'monte' : r > 0.42 ? 'pico' : 'roca';
    // (top, tanda 2) el primer kilómetro de un atleta nuevo: los primeros, en orden (saltar, otro salto, doble salto)
    const ensena = e.tutorial?.length ? e.tutorial.shift() : null;
    if (ensena) tipo = ensena;
    if (tocaRio) { tipo = 'rio'; e.rioHecho = km; }
    else if (e.movimientos && !e.unToque && e.hasta > OBSTACULOS.rama.desde && r < 0.13) tipo = 'rama';
    const def = tipo === 'rio' && e.unToque ? { ...OBSTACULOS.rio, w: 2.2 } : OBSTACULOS[tipo];
    // (la dificultad: con ayuda, hasta un 35 % más de hueco; con reto, hasta un 8 % menos)
    const hueco = (7.5 + e.rnd() * 7 + (tipo === 'monte' ? 2.5 : 0) + (tipo === 'rio' ? 4 : 0) + (ensena ? 7 : 0)) * (1 + 0.35 * e.ayuda - 0.08 * e.reto);
    const x = e.hasta + hueco + def.w / 2;
    const ob = { x, tipo, w: def.w, h: def.h, plano: def.plano, pasado: false };
    if (ensena) ob.pista = ensena === 'monte' ? 'Dos toques: doble salto' : 'Toca para saltar';
    // (la primera rama de quien acaba de estrenar las ramas, también enseña)
    else if (tipo === 'rama' && e.km0 < 1600 && !e.ramaEnsenada) { ob.pista = 'Desliza abajo: agáchate'; e.ramaEnsenada = true; }
    e.obstaculos.push(ob);
    const s = e.rnd();
    if (tipo === 'rio') for (const d of [-0.9, 0, 0.9]) e.estrellas.push({ x: x + d, y: 1.5 + (d === 0 ? 0.4 : 0), cogida: false });
    else if (tipo === 'rama') { if (s < 0.5) e.estrellas.push({ x, y: 0.3, cogida: false }); }
    else if (s < 0.38) e.estrellas.push({ x, y: def.h + 0.9 + e.rnd() * 0.5, cogida: false });
    else if (s < 0.6) e.estrellas.push({ x: x - hueco / 2 - def.w / 2, y: 1.5 + e.rnd() * 0.9, cogida: false });
    e.hasta = x + def.w / 2;
  }
  // (lo que quedó muy atrás, fuera)
  while (e.obstaculos.length && e.obstaculos[0].x < e.x - 12) e.obstaculos.shift();
  while (e.cuestas.length && e.cuestas[0].x1 < e.x - 30) e.cuestas.shift();
  while (e.cornisas.length && e.cornisas[0].x + e.cornisas[0].w / 2 < e.x - 20) e.cornisas.shift();
  while (e.potenciadores.length && e.potenciadores[0].x < e.x - 12) e.potenciadores.shift();
  while (e.estrellas.length && e.estrellas[0].x < e.x - 12) e.estrellas.shift();
}

// (top, tanda 2) Lo de la variedad: un momento raro (si toca), el potenciador (si toca), una cuesta o una cornisa. Devuelve
// si ha puesto algo (y ha movido `e.hasta`).
function generarVariedad(e) {
  if (e.tutorial?.length) return false;
  const ab = e.km0 + e.hasta;
  // Un momento cada MOMENTO_CADA m de travesía, a mitad de camino entre dos ríos (los ríos caen en los kilómetros enteros)
  const n = Math.floor((ab + 12 - MOMENTO_CADA / 2) / MOMENTO_CADA);
  if (n >= 0 && e.momentoHecho !== n && ab + 12 >= n * MOMENTO_CADA + MOMENTO_CADA / 2 && e.hasta > 60 && !e.unToque) {
    e.momentoHecho = n;
    const tipo = MOMENTOS[((n % MOMENTOS.length) + MOMENTOS.length) % MOMENTOS.length];
    const x0 = e.hasta + 12;
    e.momentos.push({ tipo, x: x0 });
    if (tipo === 'estampida') {
      // tres ciervos seguidos, al mismo paso: se saltan al ritmo
      for (let i = 0; i < 3; i++) { const x = x0 + 4 + i * 6.2; e.obstaculos.push({ x, tipo: 'ciervo', w: 1, h: 0.95, plano: 0.4, pasado: false, momento: true }); e.estrellas.push({ x, y: 2.2, cogida: false }); }
      e.hasta = x0 + 4 + 2 * 6.2 + 1;
    } else if (tipo === 'puente') {
      // un río ancho con un puente colgante a media altura: se salta al puente y del puente a la otra orilla
      const x = x0 + 6;
      e.obstaculos.push({ x, tipo: 'rio', w: 8, h: 0.12, plano: 0.95, pasado: false, momento: true });
      e.cornisas.push({ x, w: 3.2, h: 0.75, grosor: 0.2, puente: true });
      for (const d of [-0.8, 0, 0.8]) e.estrellas.push({ x: x + d, y: 1.55, cogida: false });
      e.hasta = x + 4;
    } else if (tipo === 'ventisca') {
      // la ventisca: empieza a perseguir al llegar; el terreno, el de siempre
      e.ventisca = { desde: x0, hasta: x0 + VENTISCA.largo, distancia: VENTISCA.ventaja, empezada: false };
      return false;
    } else {
      // la tormenta: solo se ve (relámpagos y lluvia) durante 150 m; el terreno, el de siempre
      e.tormenta = { desde: x0, hasta: x0 + 150 };
      return false;
    }
    return true;
  }
  // (remate, tanda 6) el secreto: una cornisa altísima con su estrella dorada, cada SECRETO.cada m de travesía
  const ns = Math.floor((ab + 8) / SECRETO.cada);
  if (ns > 0 && e.secretoHecho !== ns && ab + 8 >= ns * SECRETO.cada && !e.unToque && e.hasta > 40) {
    e.secretoHecho = ns;
    const x = e.hasta + 10 + SECRETO.ancho / 2;
    e.cornisas.push({ x, w: SECRETO.ancho, h: SECRETO.alto, grosor: 0.4, alta: true });
    e.estrellas.push({ x, y: SECRETO.alto + 0.8, cogida: false, dorada: true });
    e.hasta = x + SECRETO.ancho / 2 + 4;
    return true;
  }
  // El potenciador de la etapa, en el aire entre dos obstáculos
  if (e.potX && e.hasta >= e.potX && !e.potPuesto) {
    e.potPuesto = true;
    const tipo = ['iman', 'luna', 'aullido'][Math.floor(e.rnd() * 3)];
    e.potenciadores.push({ x: e.hasta + 4, y: 1.5, tipo, cogido: false });
    e.hasta += 7;
    return true;
  }
  const r = e.rnd();
  if (e.hasta > CUESTA.desde && r < CUESTA.prob) {
    // Una cuesta: loma (dos de cada tres) u hondonada; con sus estrellas por encima, siguiendo el terreno
    const L = CUESTA.largo[0] + e.rnd() * (CUESTA.largo[1] - CUESTA.largo[0]);
    const loma = e.rnd() < 0.67;
    const h = loma ? CUESTA.alto[0] + e.rnd() * (CUESTA.alto[1] - CUESTA.alto[0]) : -(CUESTA.hondo[0] + e.rnd() * (CUESTA.hondo[1] - CUESTA.hondo[0]));
    const x0 = e.hasta + 6;
    const q = { x0, x1: x0 + L, h };
    e.cuestas.push(q);
    for (const k of [0.3, 0.5, 0.7]) { const x = x0 + L * k; e.estrellas.push({ x, y: altoTerreno(e, x) + 1.15, cogida: false }); }
    e.hasta = q.x1 + 4;
    return true;
  }
  if (e.hasta > CORNISA.desde && r < CUESTA.prob + CORNISA.prob) {
    // Una cornisa (un tronco caído a media altura): arriba, cuatro estrellas; abajo, dos
    const w = CORNISA.ancho[0] + e.rnd() * (CORNISA.ancho[1] - CORNISA.ancho[0]);
    const x = e.hasta + 8 + w / 2;
    e.cornisas.push({ x, w, h: CORNISA.alto, grosor: CORNISA.grosor });
    for (let i = 0; i < 4; i++) e.estrellas.push({ x: x - w / 2 + 0.8 + (i * (w - 1.6)) / 3, y: CORNISA.alto + 0.75, cogida: false });
    for (const d of [-0.25, 0.25]) e.estrellas.push({ x: x + d * w, y: 0.45, cogida: false });
    e.hasta = x + w / 2 + 3;
    return true;
  }
  return false;
}

// Un toque: salta si está en el suelo; en el aire, un segundo salto (uno solo). Devuelve si ha saltado.
// (top, tanda 1) Si ahora no puede (tropezando, o en el aire con el doble gastado), el toque se guarda y salta en cuanto
// pueda, si es pronto (GUARDA_TOQUE). Y sin haber saltado, recién salido del suelo (COYOTE), aún vale el primer salto.
export function saltar(e) {
  if (e.calma) return false;
  if (e.tropiezo > 0) { e.guardado = e.t; return false; }
  e.agachado = 0;
  const pisa = e.saltos === 0 && (e.y <= sueloBajo(e) || e.t - e.tSuelo <= COYOTE);
  if (pisa) { e.vy = V_SALTO; e.saltos = 1; e.y = Math.max(e.y, sueloBajo(e)) + 0.0001; e.tSalto = e.t; e.guardado = null; e.usoDoble = false; e.sucesos.push('salto'); return true; }
  if ((e.saltos === 1 || (e.saltos === 0 && e.y > sueloBajo(e) + 0.05)) && !e.unToque) { e.vy = V_DOBLE; e.saltos = 2; e.guardado = null; e.usoDoble = true; e.sucesos.push('doble'); return true; }
  e.guardado = e.t;
  return false;
}
// La altura del suelo bajo el lobo: el terreno y, si está encima, la cornisa (tanda 2)
export function sueloBajo(e) {
  const t = altoTerreno(e, e.x);
  const c = cornisaEn(e, e.x);
  return c && e.y >= c.h - 0.02 ? Math.max(t, c.h) : t;
}

// (tanda 1) Deslizar hacia abajo: se agacha un momento (solo en el suelo), para pasar bajo una rama
export function agachar(e) {
  // (el dedo toca y baja: el salto que acaba de empezar con ese toque se deshace y se agacha)
  if (e.saltos === 1 && e.t - (e.tSalto ?? -9) < 0.16 && e.y < 0.5) { e.saltos = 0; e.y = 0; e.vy = 0; }
  if (e.tropiezo > 0 || e.calma || e.saltos > 0) return false;
  e.agachado = AGACHADO; e.sucesos.push('agacha');
  return true;
}
// (tanda 1) Mantener pulsado alarga el salto (mientras sube, pesa menos). La pantalla dice si el dedo sigue puesto.
export function pulsar(e, si) { e.pulsado = !!si; }

function velocidadCon(racha, e = null) { return Math.min(V_MAX - (e ? 2 * e.ayuda : 0) + (e ? e.reto : 0), V_BASE + racha * POR_RACHA); }

function tropezar(e, o) {
  o.chocado = true;
  // (tanda 1) con un escudo, el tropiezo se perdona: ni frena ni pierde la racha
  if (e.escudos > 0) { e.escudos -= 1; e.escudosUsados += 1; e.inmune = 0.6; e.sucesos.push('escudo'); return; }
  e.racha = 0; e.tropiezos += 1; e.tropiezo = TROPIEZO; e.inmune = INMUNE; e.agachado = 0;
  // (top, tanda 1) el combo vuelve a ×1
  if (e.combo > 1) e.sucesos.push('combo-fuera');
  e.serie = 0; e.combo = 1;
  // (remate, tanda 6) con la ventisca detrás, tropezar la acerca
  if (e.ventisca?.empezada && e.x < e.ventisca.hasta) e.ventisca.distancia -= VENTISCA.porTropiezo;
  e.sucesos.push('tropiezo');
  // la dificultad se adapta: tres tropiezos en medio minuto y afloja un punto
  e.ultimos = e.ultimos.filter((t) => t > e.t - 30); e.ultimos.push(e.t);
  if (e.ultimos.length >= 3 && !e.fija) { e.ayuda = Math.min(1, e.ayuda + 0.34); e.reto = 0; e.ultimos = []; }
}

function paso(e, dt) {
  e.t += dt;
  if (e.calma) {
    e.v = V_CALMA; e.x += e.v * dt;
  } else {
    // Tropezando frena; después va cogiendo la velocidad que le da su racha
    const meta = e.tropiezo > 0 ? V_BASE * 0.45 : velocidadCon(e.racha, e);
    e.v += (meta - e.v) * Math.min(1, dt * (e.tropiezo > 0 ? 9 : 1.6));
    // (top, tanda 2) cuesta arriba frena; cuesta abajo lanza (solo pisando el terreno)
    if (e.saltos === 0 && !e.sobre) e.v = Math.max(3.5, Math.min(V_MAX + 2.5, e.v - pendiente(e, e.x) * CUESTA.empuje * dt));
    e.x += e.v * dt;
  }
  if (e.tropiezo > 0) {
    e.tropiezo = Math.max(0, e.tropiezo - dt);
    // (top, tanda 1) el toque que llegó al final del tropiezo salta en cuanto se rehace
    if (e.tropiezo === 0 && e.guardado != null && e.t - e.guardado <= GUARDA_TOQUE) saltar(e);
  }
  if (e.inmune > 0) e.inmune = Math.max(0, e.inmune - dt);
  if (e.agachado > 0) e.agachado = Math.max(0, e.agachado - dt);
  if (e.iman > 0) e.iman = Math.max(0, e.iman - dt);
  // (remate, tanda 6) la ventisca: persigue mientras dura; si alcanza, se lleva unas estrellas y se aparta un poco
  const vt = e.ventisca;
  if (vt && e.x >= vt.desde && e.x < vt.hasta) {
    if (!vt.empezada) { vt.empezada = true; e.sucesos.push('ventisca'); }
    vt.distancia = Math.min(VENTISCA.ventaja, vt.distancia + VENTISCA.recupera * dt);
    if (vt.distancia <= 0) {
      const pierde = Math.min(VENTISCA.pierde, e.estrellasCogidas);
      e.estrellasCogidas -= pierde; e.alcanzado += 1; vt.distancia = VENTISCA.ventaja * 0.6; e.sucesos.push('alcanzado');
    }
  } else if (vt?.empezada && !vt.fuera && e.x >= vt.hasta) { vt.fuera = true; if (!e.alcanzado) e.escapadas += 1; e.sucesos.push('escapado'); }
  // (top, tanda 2) lo vertical: en el aire (saltando, o cayendo de una cornisa), pisando el terreno o sobre una cornisa
  const terreno = altoTerreno(e, e.x), corn = cornisaEn(e, e.x);
  const cayendo = e.saltos === 0 && e.sobre && !corn;   // (se acaba la cornisa: cae, sin haber saltado)
  if (cayendo) { e.sobre = null; e.cae = true; }
  if (e.saltos > 0 || e.cae) {
    const antes = e.y;
    // (mantener pulsado mientras sube: pesa menos y el salto llega más lejos)
    e.vy -= GRAVEDAD * (e.pulsado && e.vy > 0 ? 0.62 : 1) * dt;
    e.y += e.vy * dt;
    // (la cabeza contra la cornisa, desde abajo: se para y cae)
    if (corn && e.vy > 0 && antes + LOBO.alto <= corn.h - corn.grosor + 0.01 && e.y + LOBO.alto > corn.h - corn.grosor) {
      e.y = corn.h - corn.grosor - LOBO.alto; e.vy = 0; e.cabezazos += 1; e.sucesos.push('cabeza');
    }
    // (cae sobre la cornisa, desde arriba)
    const sobreCornisa = corn && e.vy <= 0 && antes >= corn.h - 0.02 && e.y <= corn.h;
    const suelo = sobreCornisa ? corn.h : terreno;
    if (e.y <= suelo) {
      e.y = suelo; e.vy = 0; e.saltos = 0; e.cae = false; e.sobre = sobreCornisa ? corn : null; e.sucesos.push('cae');
      // (top, tanda 1) el toque de justo antes de caer: salta al tocar el suelo
      if (e.guardado != null && e.t - e.guardado <= GUARDA_TOQUE) saltar(e);
    }
  } else if (e.sobre) {
    e.y = e.sobre.h; e.arriba += e.v * dt;
  } else {
    e.y = terreno;   // (pisando el terreno, sube y baja con él)
  }
  if (e.saltos === 0 && !e.cae) e.tSuelo = e.t;
  for (const o of e.obstaculos) {
    if (o.pasado) continue;
    if (o.x + o.w / 2 < e.x - LOBO.medio) {
      o.pasado = true;
      if (!o.chocado) {
        e.racha += 1; e.saltados += 1; if (e.racha > e.mejorRacha) e.mejorRacha = e.racha;
        if (o.tipo === 'rio') { e.rios += 1; e.sucesos.push('rio'); }
        // (top, tanda 3) un monte saltado sin el doble salto (manteniendo el dedo): para su logro
        if (o.tipo === 'monte' && !o.apartado && !e.usoDoble) e.montesUno = (e.montesUno || 0) + 1;
        // (top, tanda 1) el combo sube cada COMBO_CADA seguidos; y si ha pasado rozando, «¡Por los pelos!»
        e.serie += 1;
        const cb = comboDe(e.serie);
        if (cb > e.combo) { e.combo = cb; e.comboMax = Math.max(e.comboMax, cb); e.sucesos.push('combo'); }
        if (o.holgura != null && o.holgura >= 0 && o.holgura < ROCE) {
          e.roces += 1; e.lento = LENTO_ROCE; e.v += IMPULSO_ROCE; e.sucesos.push('roce');
        }
        // va sobrado: tras 25 seguidos, un punto de reto (y la ayuda se va quitando)
        if (e.racha > 0 && e.racha % 25 === 0 && !e.fija) { e.reto = Math.min(1, e.reto + 0.5); e.ayuda = Math.max(0, e.ayuda - 0.34); }
      }
      continue;
    }
    if (o.x - o.w / 2 > e.x + LOBO.medio) break;
    if (o.chocado || e.inmune > 0 || o.apartado) continue;
    // (top, tanda 1) lo justo que pasa por encima (para «por los pelos»): el hueco más pequeño entre sus patas y la silueta
    if (o.tipo !== 'rama' && o.tipo !== 'rio') {
      const hueco = Math.min(...[-LOBO.medio, 0, LOBO.medio].map((d) => e.y - perfil(o, e.x + d)));
      if (o.holgura == null || hueco < o.holgura) o.holgura = hueco;
    }
    // La rama cuelga: toca si la cabeza del lobo llega a ella (de pie llega; agachado, no; saltando, también)
    const toca = o.tipo === 'rama'
      ? e.y + (e.agachado > 0 ? ALTO_AGACHADO : LOBO.alto) > o.h
      // Lo demás: si alguno de los tres puntos de abajo del lobo queda por debajo de la silueta del obstáculo
      : [-LOBO.medio, 0, LOBO.medio].some((d) => e.y < perfil(o, e.x + d) - 0.02);
    if (toca) tropezar(e, o);
  }
  const cx = e.x, cy = e.y + (e.agachado > 0 ? ALTO_AGACHADO : LOBO.alto) / 2;
  // (top, tanda 2) los potenciadores
  for (const q of e.potenciadores) {
    if (q.cogido || Math.abs(q.x - cx) > 0.95 || Math.abs(q.y - cy) > 1.05) continue;
    q.cogido = true; e.potCogidos.push(q.tipo); e.sucesos.push(`pot-${q.tipo}`);
    if (q.tipo === 'iman') e.iman = POTENCIADORES.iman.dura;
    else if (q.tipo === 'luna') e.luna = POTENCIADORES.luna.dura;
    else {
      // el aullido aparta lo siguiente que haya que saltar (si hay algo cerca): pasa como saltado
      const o = e.obstaculos.find((x) => !x.pasado && !x.chocado && !x.apartado && x.tipo !== 'rio' && x.x > e.x && x.x < e.x + POTENCIADORES.aullido.alcance);
      if (o) o.apartado = true;
    }
  }
  for (const s of e.estrellas) {
    if (s.cogida) continue;
    // (con el imán, las de delante vienen solas)
    if (e.iman > 0 && !s.dorada && s.x > cx - 0.5 && s.x < cx + POTENCIADORES.iman.radio * 0.35) { s.cogida = true; s.vale = e.combo * e.estrellasPor; s.iman = true; e.estrellasCogidas += s.vale; e.sucesos.push('estrella'); continue; }
    if (s.x > cx + 1.2) break;
    // (top, tanda 1) con el combo, cada estrella vale más
    if (Math.abs(s.x - cx) < 0.95 && Math.abs(s.y - cy) < 0.95) {
      s.cogida = true;
      // (remate, tanda 6) la dorada del secreto vale diez y se cuenta aparte; las demás, con el combo y la etapa dorada
      if (s.dorada) { s.vale = 10; e.doradas += 1; e.estrellasCogidas += 10; e.sucesos.push('dorada'); }
      else { s.vale = e.combo * e.estrellasPor; e.estrellasCogidas += s.vale; e.sucesos.push('estrella'); }
    }
  }
}

// Avanza el juego `dt` segundos (en pasos de 1/120 como mucho, para que no atraviese nada con un cuadro lento)
// (top, tanda 1) Tras un roce, un instante a cámara lenta: el tiempo del juego va más despacio (el descanso, no)
export function avanzar(e, dt) {
  let queda = Math.min(0.25, Math.max(0, dt));
  if (e.lento > 0) { const l = Math.min(e.lento, queda); e.lento -= l; queda = queda - l + l * FACTOR_LENTO; }
  // (top, tanda 2) la luna llena: unos segundos de juego más despacio
  if (e.luna > 0) { const l = Math.min(e.luna, queda); e.luna -= l; queda = queda - l + l * POTENCIADORES.luna.factor; }
  while (queda > 0) {
    const d = Math.min(1 / 120, queda);
    paso(e, d);
    queda -= d;
  }
  generar(e);
  return e;
}

// Lo que se guarda de una etapa: metros enteros y estrellas
export const resultado = (e) => ({ metros: Math.max(0, Math.round(e.x)), estrellas: e.estrellasCogidas, racha: e.mejorRacha, tropiezos: e.tropiezos, rios: e.rios, segundos: Math.round(e.t), calma: e.calma,
  roces: e.roces || 0, combo: e.comboMax || 1,
  // (top, tanda 2) lo de la variedad: metros corridos por arriba, potenciadores cogidos y momentos raros vividos
  arriba: Math.round(e.arriba || 0), montesUno: e.montesUno || 0, doradas: e.doradas || 0, alcanzado: e.alcanzado || 0, escapadas: e.escapadas || 0, potenciadores: (e.potCogidos || []).slice(), momentos: (e.momentos || []).filter((m) => m.x < e.x).map((m) => m.tipo) });

// «870 m», «2,3 km», «12 km»
export function textoDistancia(m) {
  const n = Math.max(0, Math.round(Number(m) || 0));
  if (n < 1000) return `${n} m`;
  const km = n / 1000;
  return `${km >= 10 ? Math.round(km) : String(Math.round(km * 10) / 10).replace('.', ',')} km`;
}

// ---------- Lo que se recuerda en el móvil ----------
// { total, estrellas, mejor (la etapa más larga por minuto no: la más larga), practica (mejor marca del modo práctica),
//   sesiones: { <id>: { metros, estrellas, etapas } } }; solo las 12 últimas sesiones. Lo ilegible se descarta.
const entero = (v, max) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(0, Math.round(Number(v)))) : 0);
// (060) pend: lo jugado que aún no se ha subido a la base ({ metros, estrellas, etapas, mejor })
// (tanda 1) ritmo: su mejor ritmo en una etapa de medio minuto o más (cm/s), para el fantasma; hoy: lo de hoy, para el
// reto del día ({ dia, metros, estrellas, etapas, limpias, mejor, rios, retoHecho }); retos: cuántos lleva cumplidos
const HOY_VACIO = () => ({ dia: '', metros: 0, estrellas: 0, etapas: 0, limpias: 0, mejor: 0, rios: 0, retoHecho: false });
export const TRAVESIA_VACIA = () => ({ total: 0, estrellas: 0, mejor: 0, practica: 0, sesiones: {}, pend: { metros: 0, estrellas: 0, etapas: 0, mejor: 0 }, ritmo: 0, retos: 0, rios: 0, hoy: HOY_VACIO(), semanas: {} });

export function limpiarTravesia(g) {
  const t = TRAVESIA_VACIA();
  if (!g || typeof g !== 'object') return t;
  t.total = entero(g.total, 1e8); t.estrellas = entero(g.estrellas, 1e7); t.mejor = entero(g.mejor, 1e5); t.practica = entero(g.practica, 1e5);
  t.ritmo = entero(g.ritmo, 1500); t.retos = entero(g.retos, 1e5); t.rios = entero(g.rios, 1e6);
  const h = g.hoy && typeof g.hoy === 'object' ? g.hoy : {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(h.dia || '')) t.hoy = { dia: h.dia, metros: entero(h.metros, 1e6), estrellas: entero(h.estrellas, 1e5), etapas: entero(h.etapas, 1e3), limpias: entero(h.limpias, 1e3), mejor: entero(h.mejor, 1e5), rios: entero(h.rios, 1e3), retoHecho: h.retoHecho === true };
  // (tanda 3) semanas: los metros de cada semana (por su lunes), las diez últimas: de ahí sale su manada
  const sem = g.semanas && typeof g.semanas === 'object' ? Object.entries(g.semanas).filter(([k]) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort().slice(-10) : [];
  for (const [k, v] of sem) if (entero(v, 2e6) > 0) t.semanas[k] = entero(v, 2e6);
  const p = g.pend && typeof g.pend === 'object' ? g.pend : {};
  t.pend = { metros: entero(p.metros, 1e7), estrellas: entero(p.estrellas, 1e6), etapas: entero(p.etapas, 1e4), mejor: entero(p.mejor, 1e5) };
  // (v0.148) el envío preparado y aún sin confirmar (con su identificador: si se repite, la base no lo suma dos veces)
  const e = g.envio && typeof g.envio === 'object' ? g.envio : null;
  if (e && ID_ENVIO.test(String(e.id)) && entero(e.metros, 60000) > 0) t.envio = { id: e.id, metros: entero(e.metros, 60000), estrellas: entero(e.estrellas, 24000), etapas: Math.max(1, entero(e.etapas, 60)), mejor: entero(e.mejor, 5000) };
  const ses = g.sesiones && typeof g.sesiones === 'object' ? Object.entries(g.sesiones) : [];
  for (const [id, s] of ses.slice(-12)) {
    if (!s || typeof s !== 'object' || id.length > 60) continue;
    t.sesiones[id] = { metros: entero(s.metros, 1e6), estrellas: entero(s.estrellas, 1e5), etapas: entero(s.etapas, 1e3) };
  }
  return t;
}

// Suma una etapa. Con sesión, cuenta para la travesía (total, sesión, mejor etapa); sin ella es práctica: solo su marca.
// (tanda 1) con `dia` (AAAA-MM-DD) lleva también la cuenta de hoy para el reto del día; con `segundos`, el ritmo
export function sumarEtapa(guardado, { sesion = null, metros = 0, estrellas = 0, segundos = 0, tropiezos = null, rios = 0, calma = false, dia = null } = {}) {
  const t = limpiarTravesia(guardado);
  const m = entero(metros, 1e5), s = entero(estrellas, 1e4);
  if (!calma && segundos >= 30 && m > 0) t.ritmo = Math.max(t.ritmo, Math.min(1500, Math.round((m / segundos) * 100)));
  if (!sesion) { t.practica = Math.max(t.practica, m); return t; }
  t.rios += entero(rios, 100);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dia || '')) {
    const h = t.hoy.dia === dia ? t.hoy : { ...HOY_VACIO(), dia };
    t.hoy = { ...h, metros: h.metros + m, estrellas: h.estrellas + s, etapas: h.etapas + 1, limpias: h.limpias + (tropiezos === 0 && !calma && segundos >= 20 ? 1 : 0), mejor: Math.max(h.mejor, calma ? 0 : m), rios: h.rios + entero(rios, 100) };
    const r = progresoReto(retoDelDia(dia), t.hoy);
    if (r.hecho && !t.hoy.retoHecho) { t.hoy.retoHecho = true; t.retos += 1; }
  }
  t.total += m; t.estrellas += s; t.mejor = Math.max(t.mejor, m);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dia || '') && m > 0) {
    const l = lunesDe(dia);
    t.semanas[l] = (t.semanas[l] || 0) + m;
    for (const k of Object.keys(t.semanas).sort().slice(0, -10)) delete t.semanas[k];
  }
  t.pend = { metros: t.pend.metros + m, estrellas: t.pend.estrellas + s, etapas: t.pend.etapas + 1, mejor: Math.max(t.pend.mejor, m) };
  const de = t.sesiones[sesion] || { metros: 0, estrellas: 0, etapas: 0 };
  delete t.sesiones[sesion];   // (al final: la más reciente)
  t.sesiones[sesion] = { metros: de.metros + m, estrellas: de.estrellas + s, etapas: de.etapas + 1 };
  const ids = Object.keys(t.sesiones);
  for (const id of ids.slice(0, Math.max(0, ids.length - 12))) delete t.sesiones[id];
  return t;
}

// ---------- Con la base (migración 060) ----------
export const ID_ENVIO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Lo que toca subir ahora: lo pendiente, en un envío que la base admite (60 km y 60 etapas como mucho), o null
export function porSubir(guardado) {
  const p = limpiarTravesia(guardado).pend;
  if (p.metros <= 0) return null;
  const etapas = Math.min(60, Math.max(1, p.etapas)), metros = Math.min(p.metros, 60000, 5000 * etapas);
  return { metros, estrellas: Math.min(p.estrellas, 400 * etapas), etapas, mejor: Math.min(p.mejor, 5000, metros) };
}
// (v0.148) Prepara el envío con su identificador y lo deja fijado (se guarda antes de mandarlo): si la respuesta no llega,
// se manda otra vez el mismo y la base no lo suma dos veces. Si ya hay uno fijado, se queda ese.
export function prepararEnvio(guardado, id) {
  const t = limpiarTravesia(guardado);
  if (t.envio || !ID_ENVIO.test(String(id))) return t;
  const e = porSubir(t);
  if (e) t.envio = { id, ...e };
  return t;
}
// Tras subir un envío: se descuenta de lo pendiente (puede haber entrado otra etapa mientras subía). Con identificador,
// solo si es el que sigue fijado (otra pestaña puede haberlo descontado ya).
export function trasSubir(guardado, envio) {
  const t = limpiarTravesia(guardado);
  if (!envio) return t;
  if (envio.id) { if (t.envio?.id !== envio.id) return t; delete t.envio; }
  const queda = Math.max(0, t.pend.metros - envio.metros);
  t.pend = queda > 0 ? { metros: queda, estrellas: Math.max(0, t.pend.estrellas - envio.estrellas), etapas: Math.max(1, t.pend.etapas - envio.etapas), mejor: t.pend.mejor }
    : { metros: 0, estrellas: 0, etapas: 0, mejor: 0 };
  return t;
}
// Junta lo del móvil con lo que hay en la base (semanas: [{ metros, estrellas, mejor }]): si en la base hay más (otro
// móvil, o este tras borrar sus datos), el total sube hasta ahí; lo que aún no se ha subido se suma encima
export function conBase(guardado, semanas = []) {
  const t = limpiarTravesia(guardado);
  const filas = Array.isArray(semanas) ? semanas : [];
  const m = filas.reduce((n, f) => n + entero(f?.metros, 2e6), 0), e = filas.reduce((n, f) => n + entero(f?.estrellas, 2e5), 0);
  t.total = Math.max(t.total, m + t.pend.metros);
  t.estrellas = Math.max(t.estrellas, e + t.pend.estrellas);
  t.mejor = Math.max(t.mejor, ...filas.map((f) => entero(f?.mejor, 2e4)));
  // (tanda 3) las semanas de la base, a las del móvil (la que más tenga)
  for (const f of filas) {
    const k = String(f?.semana || '').slice(0, 10), v = entero(f?.metros, 2e6);
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && v > 0) t.semanas[k] = Math.max(t.semanas[k] || 0, v);
  }
  for (const k of Object.keys(t.semanas).sort().slice(0, -10)) delete t.semanas[k];
  return t;
}
// (tanda 3) Cuántas semanas seguidas lleva corriendo en sus descansos, hasta esta (si esta aún no tiene nada, hasta la pasada)
export function rachaSemanas(guardado, hoy) {
  const sem = limpiarTravesia(guardado).semanas;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hoy || '')) return 0;
  let l = lunesDe(hoy), n = 0;
  if (!sem[l]) l = sumarDias(l, -7);
  while (sem[l] > 0 && n < 60) { n += 1; l = sumarDias(l, -7); }
  return n;
}
// Lo de esta semana en la base (la fila cuyo lunes es `lunes`), más lo pendiente
export function metrosDeLaSemana(guardado, semanas = [], lunes) {
  const f = (Array.isArray(semanas) ? semanas : []).find((x) => String(x?.semana).slice(0, 10) === lunes);
  return entero(f?.metros, 2e6) + limpiarTravesia(guardado).pend.metros;
}

// ---------- (tanda 1) El reto del día ----------
// Uno distinto cada día, el mismo para todos. Se mira con lo jugado hoy en los descansos.
export const RETOS = [
  { id: 'lejos', texto: 'Llega a 600 m en un solo descanso', campo: 'mejor', meta: 600 },
  { id: 'estrellas', texto: 'Coge 12 estrellas hoy', campo: 'estrellas', meta: 12 },
  { id: 'limpias', texto: 'Haz 2 etapas sin tropezar', campo: 'limpias', meta: 2 },
  { id: 'suma', texto: 'Recorre 1,5 km entre todos tus descansos', campo: 'metros', meta: 1500 },
  { id: 'etapas', texto: 'Juega en 4 descansos', campo: 'etapas', meta: 4 },
];
export function retoDelDia(dia) {
  const n = /^\d{4}-\d{2}-\d{2}$/.test(dia || '') ? Math.floor(Date.parse(`${dia}T00:00:00Z`) / 86400000) : 0;
  return RETOS[((n % RETOS.length) + RETOS.length) % RETOS.length];
}
export function progresoReto(reto, hoy) {
  const valor = Math.min(reto.meta, entero(hoy?.[reto.campo], 1e7));
  return { valor, meta: reto.meta, hecho: valor >= reto.meta };
}
// Lo de hoy (si lo guardado es de otro día, vacío)
export const hoyDe = (guardado, dia) => { const t = limpiarTravesia(guardado); return t.hoy.dia === dia ? t.hoy : { ...HOY_VACIO(), dia }; };

// ---------- (tanda 1) El cielo de verdad ----------
// La fase de la luna en un instante: { ilum: de 0 (nueva) a 1 (llena), creciente }
export function faseLuna(ms) {
  const SINODICO = 29.530588853, NUEVA = Date.UTC(2000, 0, 6, 18, 14);
  const edad = ((((ms - NUEVA) / 86400000) % SINODICO) + SINODICO) % SINODICO;
  return { ilum: (1 - Math.cos((2 * Math.PI * edad) / SINODICO)) / 2, creciente: edad < SINODICO / 2 };
}
// Qué cae, según el código del tiempo (los de la OMM que da la previsión): 'lluvia' | 'nieve' | 'niebla' | 'tormenta' | null
export function climaDe(codigo) {
  const c = Number(codigo);
  if (!Number.isFinite(c)) return null;
  if (c >= 95) return 'tormenta';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'nieve';
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'lluvia';
  if (c === 45 || c === 48) return 'niebla';
  return null;
}
// El ambiente de la etapa: la hora (de la previsión, si dice si es de día; si no, del reloj), la luna, lo que cae y el
// paisaje, que cambia cada 5 km de travesía (montaña, bosque, nieve, amanecer)
export const PAISAJES = ['montaña', 'bosque', 'nieve', 'amanecer'];
export function ambiente({ ms = Date.now(), hora = new Date(ms).getHours(), codigo = null, esDia = null, total = 0 } = {}) {
  const paisaje = Math.floor(Math.max(0, total) / 5000) % PAISAJES.length;
  let fase = hora >= 22 || hora < 6 ? 'noche' : hora < 9 ? 'alba' : hora < 18 ? 'dia' : 'ocaso';
  if (esDia === false && (fase === 'dia')) fase = 'ocaso';
  if (esDia === false && hora >= 19) fase = 'noche';
  if (PAISAJES[paisaje] === 'amanecer' && fase === 'noche') fase = 'alba';
  return { fase, luna: faseLuna(ms), clima: climaDe(codigo) || (PAISAJES[paisaje] === 'nieve' ? 'nieve' : null), paisaje };
}

// ---------- (top, tanda 4) La etapa del día ----------
// Ese día todos corren el mismo terreno: la semilla sale de la fecha (AAAA-MM-DD). Un minuto y tres intentos.
export const ETAPA_DIA = { segundos: 60, intentos: 3 };
export function semillaDelDia(dia) {
  let h = 2166136261;
  for (const ch of `travesia:${dia}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) || 1;
}
// Las marcas del camino: dónde acabaron esta semana las mejores etapas de los compañeros (los que salen en la
// clasificación) y la mejor suya de siempre. [{ metros, nombre, mia }], de cerca a lejos, como mucho seis
export function marcasDelCamino(filas, miMejor = 0) {
  const otros = (Array.isArray(filas) ? filas : []).filter((f) => !f.yo && f.mejor > 20).map((f) => ({ metros: Math.round(f.mejor), nombre: f.nombre, mia: false }));
  const todas = [...otros.sort((a, b) => b.metros - a.metros).slice(0, 5), ...(miMejor > 20 ? [{ metros: Math.round(miMejor), nombre: 'Tu mejor', mia: true }] : [])];
  return todas.sort((a, b) => a.metros - b.metros);
}
