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
export function nuevaEtapa(semilla = 1, { racha0 = 0, escudos = 0, calma = false, movimientos = false, km0 = 0 } = {}) {
  const r0 = calma ? 0 : Math.min(18, Math.max(0, Math.round(racha0) || 0));
  const e = {
    semilla, rnd: azar(semilla), t: 0,
    x: 0, y: 0, vy: 0, saltos: 0, v: calma ? V_CALMA : velocidadCon(r0),
    racha: r0, mejorRacha: 0, tropiezo: 0, inmune: 0,
    obstaculos: [], estrellas: [], hasta: 14,   // los primeros metros, despejados
    estrellasCogidas: 0, tropiezos: 0, saltados: 0, sucesos: [],
    calma: !!calma, movimientos: !!movimientos, km0: Math.max(0, Math.round(km0) || 0),
    escudos: calma ? 0 : Math.min(3, Math.max(0, Math.round(escudos) || 0)), escudosUsados: 0,
    agachado: 0, pulsado: false, rios: 0,
    // la dificultad se adapta: `ayuda` sube si tropieza mucho (más hueco, más despacio, sin montes) y `reto` si va sobrado
    ayuda: 0, reto: 0, ultimos: [],
  };
  generar(e);
  return e;
}

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
    let tipo = e.hasta > OBSTACULOS.monte.desde && r > 0.8 && e.ayuda < 0.6 ? 'monte' : r > 0.42 ? 'pico' : 'roca';
    if (tocaRio) { tipo = 'rio'; e.rioHecho = km; }
    else if (e.movimientos && e.hasta > OBSTACULOS.rama.desde && r < 0.13) tipo = 'rama';
    const def = OBSTACULOS[tipo];
    // (la dificultad: con ayuda, hasta un 35 % más de hueco; con reto, hasta un 8 % menos)
    const hueco = (7.5 + e.rnd() * 7 + (tipo === 'monte' ? 2.5 : 0) + (tipo === 'rio' ? 4 : 0)) * (1 + 0.35 * e.ayuda - 0.08 * e.reto);
    const x = e.hasta + hueco + def.w / 2;
    e.obstaculos.push({ x, tipo, w: def.w, h: def.h, plano: def.plano, pasado: false });
    const s = e.rnd();
    if (tipo === 'rio') for (const d of [-0.9, 0, 0.9]) e.estrellas.push({ x: x + d, y: 1.5 + (d === 0 ? 0.4 : 0), cogida: false });
    else if (tipo === 'rama') { if (s < 0.5) e.estrellas.push({ x, y: 0.3, cogida: false }); }
    else if (s < 0.38) e.estrellas.push({ x, y: def.h + 0.9 + e.rnd() * 0.5, cogida: false });
    else if (s < 0.6) e.estrellas.push({ x: x - hueco / 2 - def.w / 2, y: 1.5 + e.rnd() * 0.9, cogida: false });
    e.hasta = x + def.w / 2;
  }
  // (lo que quedó muy atrás, fuera)
  while (e.obstaculos.length && e.obstaculos[0].x < e.x - 12) e.obstaculos.shift();
  while (e.estrellas.length && e.estrellas[0].x < e.x - 12) e.estrellas.shift();
}

// Un toque: salta si está en el suelo; en el aire, un segundo salto (uno solo). Devuelve si ha saltado.
export function saltar(e) {
  if (e.tropiezo > 0 || e.calma) return false;
  e.agachado = 0;
  if (e.y <= 0 && e.saltos === 0) { e.vy = V_SALTO; e.saltos = 1; e.y = 0.0001; e.tSalto = e.t; e.sucesos.push('salto'); return true; }
  if (e.saltos === 1) { e.vy = V_DOBLE; e.saltos = 2; e.sucesos.push('doble'); return true; }
  return false;
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
  e.sucesos.push('tropiezo');
  // la dificultad se adapta: tres tropiezos en medio minuto y afloja un punto
  e.ultimos = e.ultimos.filter((t) => t > e.t - 30); e.ultimos.push(e.t);
  if (e.ultimos.length >= 3) { e.ayuda = Math.min(1, e.ayuda + 0.34); e.reto = 0; e.ultimos = []; }
}

function paso(e, dt) {
  e.t += dt;
  if (e.calma) {
    e.v = V_CALMA; e.x += e.v * dt;
  } else {
    // Tropezando frena; después va cogiendo la velocidad que le da su racha
    const meta = e.tropiezo > 0 ? V_BASE * 0.45 : velocidadCon(e.racha, e);
    e.v += (meta - e.v) * Math.min(1, dt * (e.tropiezo > 0 ? 9 : 1.6));
    e.x += e.v * dt;
  }
  if (e.tropiezo > 0) e.tropiezo = Math.max(0, e.tropiezo - dt);
  if (e.inmune > 0) e.inmune = Math.max(0, e.inmune - dt);
  if (e.agachado > 0) e.agachado = Math.max(0, e.agachado - dt);
  if (e.saltos > 0) {
    // (mantener pulsado mientras sube: pesa menos y el salto llega más lejos)
    e.vy -= GRAVEDAD * (e.pulsado && e.vy > 0 ? 0.62 : 1) * dt;
    e.y += e.vy * dt;
    if (e.y <= 0) { e.y = 0; e.vy = 0; e.saltos = 0; e.sucesos.push('cae'); }
  }
  for (const o of e.obstaculos) {
    if (o.pasado) continue;
    if (o.x + o.w / 2 < e.x - LOBO.medio) {
      o.pasado = true;
      if (!o.chocado) {
        e.racha += 1; e.saltados += 1; if (e.racha > e.mejorRacha) e.mejorRacha = e.racha;
        if (o.tipo === 'rio') { e.rios += 1; e.sucesos.push('rio'); }
        // va sobrado: tras 25 seguidos, un punto de reto (y la ayuda se va quitando)
        if (e.racha > 0 && e.racha % 25 === 0) { e.reto = Math.min(1, e.reto + 0.5); e.ayuda = Math.max(0, e.ayuda - 0.34); }
      }
      continue;
    }
    if (o.x - o.w / 2 > e.x + LOBO.medio) break;
    if (o.chocado || e.inmune > 0) continue;
    // La rama cuelga: toca si la cabeza del lobo llega a ella (de pie llega; agachado, no; saltando, también)
    const toca = o.tipo === 'rama'
      ? e.y + (e.agachado > 0 ? ALTO_AGACHADO : LOBO.alto) > o.h
      // Lo demás: si alguno de los tres puntos de abajo del lobo queda por debajo de la silueta del obstáculo
      : [-LOBO.medio, 0, LOBO.medio].some((d) => e.y < perfil(o, e.x + d) - 0.02);
    if (toca) tropezar(e, o);
  }
  const cx = e.x, cy = e.y + (e.agachado > 0 ? ALTO_AGACHADO : LOBO.alto) / 2;
  for (const s of e.estrellas) {
    if (s.cogida) continue;
    if (s.x > cx + 1.2) break;
    if (Math.abs(s.x - cx) < 0.95 && Math.abs(s.y - cy) < 0.95) { s.cogida = true; e.estrellasCogidas += 1; e.sucesos.push('estrella'); }
  }
}

// Avanza el juego `dt` segundos (en pasos de 1/120 como mucho, para que no atraviese nada con un cuadro lento)
export function avanzar(e, dt) {
  let queda = Math.min(0.25, Math.max(0, dt));
  while (queda > 0) {
    const d = Math.min(1 / 120, queda);
    paso(e, d);
    queda -= d;
  }
  generar(e);
  return e;
}

// Lo que se guarda de una etapa: metros enteros y estrellas
export const resultado = (e) => ({ metros: Math.max(0, Math.round(e.x)), estrellas: e.estrellasCogidas, racha: e.mejorRacha, tropiezos: e.tropiezos, rios: e.rios, segundos: Math.round(e.t), calma: e.calma });

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
// Lo que toca subir ahora: lo pendiente, en un envío que la base admite (60 km y 60 etapas como mucho), o null
export function porSubir(guardado) {
  const p = limpiarTravesia(guardado).pend;
  if (p.metros <= 0) return null;
  const etapas = Math.min(60, Math.max(1, p.etapas)), metros = Math.min(p.metros, 60000, 5000 * etapas);
  return { metros, estrellas: Math.min(p.estrellas, 400 * etapas), etapas, mejor: Math.min(p.mejor, 5000, metros) };
}
// Tras subir un envío: se descuenta de lo pendiente (puede haber entrado otra etapa mientras subía)
export function trasSubir(guardado, envio) {
  const t = limpiarTravesia(guardado);
  if (!envio) return t;
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
