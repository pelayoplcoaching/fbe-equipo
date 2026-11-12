// «La travesía»: el juego del descanso. Un lobo corre de noche por la montaña y salta lo que encuentra; cada descanso
// es una etapa que dura lo que el descanso, y los metros se suman en la sesión. Aquí va el juego entero sin pantalla
// (lo pinta ui/atleta/Travesia.jsx): el terreno sale de una semilla, así que la misma semilla y los mismos toques dan
// siempre la misma etapa, y los tests pueden jugarla.
//
// Las medidas van en metros y segundos. El lobo no muere: si tropieza, pierde el ritmo (vuelve a la velocidad de salida)
// y sigue. Así la etapa siempre dura el descanso entero y lo que cambia es lo lejos que llega.

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
};

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

export function nuevaEtapa(semilla = 1) {
  const e = {
    semilla, rnd: azar(semilla), t: 0,
    x: 0, y: 0, vy: 0, saltos: 0, v: V_BASE,
    racha: 0, mejorRacha: 0, tropiezo: 0, inmune: 0,
    obstaculos: [], estrellas: [], hasta: 14,   // los primeros metros, despejados
    estrellasCogidas: 0, tropiezos: 0, saltados: 0, sucesos: [],
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
    const r = e.rnd();
    const tipo = e.hasta > OBSTACULOS.monte.desde && r > 0.8 ? 'monte' : r > 0.42 ? 'pico' : 'roca';
    const def = OBSTACULOS[tipo];
    const hueco = 7.5 + e.rnd() * 7 + (tipo === 'monte' ? 2.5 : 0);
    const x = e.hasta + hueco + def.w / 2;
    e.obstaculos.push({ x, tipo, w: def.w, h: def.h, plano: def.plano, pasado: false });
    const s = e.rnd();
    if (s < 0.38) e.estrellas.push({ x, y: def.h + 0.9 + e.rnd() * 0.5, cogida: false });
    else if (s < 0.6) e.estrellas.push({ x: x - hueco / 2 - def.w / 2, y: 1.5 + e.rnd() * 0.9, cogida: false });
    e.hasta = x + def.w / 2;
  }
  // (lo que quedó muy atrás, fuera)
  while (e.obstaculos.length && e.obstaculos[0].x < e.x - 12) e.obstaculos.shift();
  while (e.estrellas.length && e.estrellas[0].x < e.x - 12) e.estrellas.shift();
}

// Un toque: salta si está en el suelo; en el aire, un segundo salto (uno solo). Devuelve si ha saltado.
export function saltar(e) {
  if (e.tropiezo > 0) return false;
  if (e.y <= 0 && e.saltos === 0) { e.vy = V_SALTO; e.saltos = 1; e.y = 0.0001; e.sucesos.push('salto'); return true; }
  if (e.saltos === 1) { e.vy = V_DOBLE; e.saltos = 2; e.sucesos.push('doble'); return true; }
  return false;
}

const velocidadCon = (racha) => Math.min(V_MAX, V_BASE + racha * POR_RACHA);

function paso(e, dt) {
  e.t += dt;
  // Tropezando frena; después va cogiendo la velocidad que le da su racha
  const meta = e.tropiezo > 0 ? V_BASE * 0.45 : velocidadCon(e.racha);
  e.v += (meta - e.v) * Math.min(1, dt * (e.tropiezo > 0 ? 9 : 1.6));
  e.x += e.v * dt;
  if (e.tropiezo > 0) e.tropiezo = Math.max(0, e.tropiezo - dt);
  if (e.inmune > 0) e.inmune = Math.max(0, e.inmune - dt);
  if (e.saltos > 0) {
    e.vy -= GRAVEDAD * dt;
    e.y += e.vy * dt;
    if (e.y <= 0) { e.y = 0; e.vy = 0; e.saltos = 0; e.sucesos.push('cae'); }
  }
  for (const o of e.obstaculos) {
    if (o.pasado) continue;
    if (o.x + o.w / 2 < e.x - LOBO.medio) {
      o.pasado = true;
      if (!o.chocado) { e.racha += 1; e.saltados += 1; if (e.racha > e.mejorRacha) e.mejorRacha = e.racha; }
      continue;
    }
    if (o.x - o.w / 2 > e.x + LOBO.medio) break;
    if (o.chocado || e.inmune > 0) continue;
    // Toca si alguno de los tres puntos de abajo del lobo queda por debajo de la silueta del obstáculo
    const toca = [-LOBO.medio, 0, LOBO.medio].some((d) => e.y < perfil(o, e.x + d) - 0.02);
    if (toca) {
      o.chocado = true;
      e.racha = 0; e.tropiezos += 1; e.tropiezo = TROPIEZO; e.inmune = INMUNE;
      e.sucesos.push('tropiezo');
    }
  }
  const cx = e.x, cy = e.y + LOBO.alto / 2;
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
export const resultado = (e) => ({ metros: Math.max(0, Math.round(e.x)), estrellas: e.estrellasCogidas, racha: e.mejorRacha });

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
export const TRAVESIA_VACIA = () => ({ total: 0, estrellas: 0, mejor: 0, practica: 0, sesiones: {}, pend: { metros: 0, estrellas: 0, etapas: 0, mejor: 0 } });

export function limpiarTravesia(g) {
  const t = TRAVESIA_VACIA();
  if (!g || typeof g !== 'object') return t;
  t.total = entero(g.total, 1e8); t.estrellas = entero(g.estrellas, 1e7); t.mejor = entero(g.mejor, 1e5); t.practica = entero(g.practica, 1e5);
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
export function sumarEtapa(guardado, { sesion = null, metros = 0, estrellas = 0 } = {}) {
  const t = limpiarTravesia(guardado);
  const m = entero(metros, 1e5), s = entero(estrellas, 1e4);
  if (!sesion) { t.practica = Math.max(t.practica, m); return t; }
  t.total += m; t.estrellas += s; t.mejor = Math.max(t.mejor, m);
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
  return t;
}
// Lo de esta semana en la base (la fila cuyo lunes es `lunes`), más lo pendiente
export function metrosDeLaSemana(guardado, semanas = [], lunes) {
  const f = (Array.isArray(semanas) ? semanas : []).find((x) => String(x?.semana).slice(0, 10) === lunes);
  return entero(f?.metros, 2e6) + limpiarTravesia(guardado).pend.metros;
}
