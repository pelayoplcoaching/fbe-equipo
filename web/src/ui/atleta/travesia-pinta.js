// «La travesía»: cómo se pinta el juego en su lienzo (el juego en sí, en logica/travesia.js). Todo a mano, con formas
// planas en la paleta de la casa: sin imágenes que descargar. Va con el trozo del juego, que solo se pide al abrirlo.
import { azar, perfil } from '../../logica/travesia.js';
import { fugaz, estirar, parpadea, colaAlViento, impetu, sacudida, entrada, hayAurora, alturaAstro } from '../../logica/travesia-efectos.js';

const NOCHE = '#0B0726', MORADO_NOCHE = '#1E1548', VIOLETA = '#5438D8', LAVANDA = '#A08CFF', TIZA = '#F1F0F6', ORO = '#F2C230';

// Tres cordilleras al fondo, de lejos a cerca: cada una, una fila de picos que se repite cada `periodo` px
function cordillera(semilla, { periodo, alto, ancho, n }) {
  const r = azar(semilla);
  return Array.from({ length: n }, (_, i) => ({
    x: (i + 0.15 + r() * 0.7) * (periodo / n),
    h: alto * (0.55 + r() * 0.45),
    w: ancho * (0.75 + r() * 0.6),
  })).sort((a, b) => a.h - b.h);   // (los altos, delante)
}

export function nuevoPaisaje(semilla = 1) {
  const r = azar(semilla * 31 + 7);
  return {
    // (tanda 5) las estrellas, de tres colores (c: 0 tiza, 1 lavanda, 2 cálida) y las más grandes con destello en cruz
    estrellas: Array.from({ length: 96 }, (_, i) => ({ x: r(), y: r() * 0.62, t: i < 8 ? 2.2 + r() * 0.8 : 0.5 + r() * 1.4, f: r() * 6.28, v: 0.6 + r() * 1.6, c: i % 7 === 3 ? 2 : i % 4 === 1 ? 1 : 0, cruz: i < 8 })),
    // la Vía Láctea: un reguero de puntitos en diagonal
    lactea: Array.from({ length: 120 }, () => { const a = r(); return { x: a, y: 0.06 + a * 0.36 + (r() - r()) * 0.09, t: 0.6 + r() * 0.9, a: 0.12 + r() * 0.22 }; }),
    // las nubes: dos capas (la de lejos, más lenta y más tenue), cada nube con sus lóbulos
    nubes: Array.from({ length: 7 }, (_, i) => ({ x: r() * 1.5, y: 0.1 + r() * 0.36, w: 70 + r() * 90, lejos: i % 2 === 0, lobulos: Array.from({ length: 4 }, (__, k) => ({ dx: (k - 1.5) * 0.3 + (r() - 0.5) * 0.1, dy: (r() - 0.5) * 0.12, rx: 0.3 + r() * 0.16, ry: 0.11 + r() * 0.07 })) })),
    // el suelo: matas en la línea, flores, brillos de la nieve, piedras del fondo y lo que pasa por delante
    matas: Array.from({ length: 30 }, () => ({ x: r() * 900, h: 5 + r() * 8, f: r() * 6.28, n: 2 + Math.floor(r() * 3) })),
    flores: Array.from({ length: 9 }, () => ({ x: r() * 900, h: 7 + r() * 6, c: Math.floor(r() * 3), f: r() * 6.28 })),
    brillos: Array.from({ length: 22 }, () => ({ x: r() * 900, y: 8 + r() * 70, f: r() * 6.28, v: 1 + r() * 2 })),
    piedras: Array.from({ length: 8 }, () => ({ x: r() * 800, s: 7 + r() * 12, a: 0.6 + r() * 0.7 })),
    delante: Array.from({ length: 7 }, (_, i) => ({ x: r() * 1300, s: 0.7 + r() * 0.8, roca: i % 3 === 2, f: r() * 6.28 })),
    pinos2: Array.from({ length: 12 }, () => ({ x: r() * 800, h: 0.05 + r() * 0.05 })),
    luciernagas: Array.from({ length: 14 }, () => ({ x: r(), y: 0.2 + r() * 0.7, f: r() * 6.28, v: 0.5 + r() })),
    pajaros: Array.from({ length: 4 }, () => ({ x: r(), y: 0.16 + r() * 0.2, f: r() * 6.28, s: 5 + r() * 4 })),
    capas: [
      { v: 0.035, luz: '#3A2E8E', sombra: '#2E2475', nieve: 0.5, picos: cordillera(semilla + 11, { periodo: 1100, alto: 0.4, ancho: 0.66, n: 6 }), periodo: 1100 },
      { v: 0.09, luz: '#30257A', sombra: '#251C63', nieve: 0.28, picos: cordillera(semilla + 23, { periodo: 900, alto: 0.27, ancho: 0.52, n: 6 }), periodo: 900 },
      { v: 0.2, luz: '#261C66', sombra: '#1C144F', nieve: 0, picos: cordillera(semilla + 37, { periodo: 700, alto: 0.13, ancho: 0.42, n: 7 }), periodo: 700 },
    ],
    hierbas: Array.from({ length: 26 }, () => ({ x: r() * 900, y: 6 + r() * 60, w: 6 + r() * 16 })),
    // (tanda 1) lo que cae del cielo (lluvia o nieve) y los pinos del bosque
    gotas: Array.from({ length: 46 }, () => ({ x: r(), y: r(), v: 0.6 + r() * 0.8, f: r() * 6.28 })),
    pinos: Array.from({ length: 9 }, () => ({ x: r() * 800, h: 0.09 + r() * 0.08 })),
    chispas: [],   // lo que salta al coger una estrella o al caer: { x, y, vx, vy, t, oro }
    // (tanda 5) el polvo, el vaho, las estrellas que vuelan al marcador, los trozos del escudo, los aros del doble salto y las huellas
    polvo: [], vaho: [], volando: [], trozos: [], aros: [], huellas: [],
    t0: null, tCae: null, tTropiezo: null, tFin: null, tPolvo: 0, tVaho: 0, pisada: 0, rayo: -99,
    zancada: 0,
  };
}

const tri = (c, x1, y1, x2, y2, x3, y3, color) => { c.fillStyle = color; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.closePath(); c.fill(); };

function estrella4(c, x, y, r, giro = 0) {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = giro + (i * Math.PI) / 4, q = i % 2 ? r * 0.38 : r;
    c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
  }
  c.closePath();
}

// El lobo, de perfil y hacia la derecha, en metros (x a la derecha, y hacia arriba; 0,0 en el suelo bajo su centro)
function pata(c, x, y, a, doblez, largo, color, grosor) {
  const x1 = x + Math.sin(a) * largo, y1 = y - Math.cos(a) * largo;
  const a2 = a + doblez;
  const x2 = x1 + Math.sin(a2) * largo, y2 = y1 - Math.cos(a2) * largo;
  c.strokeStyle = color; c.lineCap = 'round'; c.lineJoin = 'round';
  c.lineWidth = grosor; c.beginPath(); c.moveTo(x, y); c.lineTo(x1, y1); c.stroke();
  c.lineWidth = grosor * 0.72; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}

// (tanda 3) tinta: los dos colores del lobo elegido ({ claro, sombra }); sin ella, el de tiza
// (tanda 5) vida: { cola (-1 a 1), orejas (-1 a 1: hacia atrás), cabeza (giro en radianes: hacia arriba), ojos ('cerrados'),
// luz (el color del contraluz en el lomo), aulla } — solo para el lobo que juega; los demás van sin ella
function lobo(c, e, fase, tinta = null, vida = null) {
  const aire = e.saltos > 0;
  const cae = e.tropiezo > 0;
  // En carrera, las patas de delante y las de atrás van a contratiempo; en el aire, estiradas; al tropezar, recogidas
  const A = cae ? 0.25 : 0.62;
  const atras = aire ? -0.95 : Math.sin(fase) * A;
  const delante = aire ? 0.95 : Math.sin(fase + 2.6) * A;
  const bote = aire || cae ? 0 : Math.abs(Math.sin(fase)) * 0.05;
  const inclina = cae ? -0.42 : aire ? Math.max(-0.35, Math.min(0.4, e.vy * 0.028)) : 0;
  const bajo = e.agachado > 0 && !aire;   // (tanda 1) agachado: el cuerpo pegado al suelo
  const sombra = tinta?.sombra || '#B4A8EA', claro = tinta?.claro || TIZA;
  c.save();
  if (bajo) { c.translate(0, -0.02); c.scale(1.08, 0.58); }
  c.translate(0, 0.52 + bote);
  c.rotate(inclina);
  c.translate(0, -0.52);
  // (las de detrás, más oscuras)
  pata(c, -0.5, 0.54, atras + 0.5, aire ? 0.5 : -0.35, 0.29, sombra, 0.18);
  pata(c, 0.34, 0.54, delante - 0.45, aire ? -0.3 : 0.3, 0.29, sombra, 0.16);
  // La cola, que sube en el salto
  const cola = vida?.cola != null ? vida.cola * 0.24 : aire ? 0.22 : Math.sin(fase * 0.5) * 0.05;
  const giro = vida?.cabeza || 0, orejas = vida?.orejas || 0;
  const conCabeza = (pinta) => { if (!giro) { pinta(); return; } c.save(); c.translate(0.6, 1.0); c.rotate(giro); c.translate(-0.6, -1.0); pinta(); c.restore(); };
  c.fillStyle = claro; c.beginPath();
  c.moveTo(-0.6, 0.92); c.quadraticCurveTo(-1.06, 1.12 + cola, -1.5, 0.74 + cola * 1.6);
  c.quadraticCurveTo(-1.1, 0.5 + cola * 0.6, -0.62, 0.58); c.closePath(); c.fill();
  c.fillStyle = sombra; c.beginPath();
  c.moveTo(-1.5, 0.74 + cola * 1.6); c.quadraticCurveTo(-1.28, 0.9 + cola * 1.3, -1.12, 0.9 + cola); c.quadraticCurveTo(-1.2, 0.72 + cola, -1.5, 0.74 + cola * 1.6); c.fill();
  // La oreja de detrás
  conCabeza(() => tri(c, 0.5, 1.18, 0.55 - orejas * 0.07, 1.46 - Math.abs(orejas) * 0.04, 0.7, 1.22, sombra));
  // El cuerpo
  c.fillStyle = claro; c.beginPath();
  c.moveTo(-0.84, 0.66); c.bezierCurveTo(-0.88, 1.02, -0.3, 0.98, 0.18, 0.98);
  c.bezierCurveTo(0.42, 1.0, 0.5, 1.06, 0.62, 1.2);
  c.lineTo(0.94, 0.86); c.bezierCurveTo(0.76, 0.56, 0.66, 0.4, 0.42, 0.36);
  c.bezierCurveTo(0.1, 0.32, -0.3, 0.44, -0.56, 0.38); c.bezierCurveTo(-0.76, 0.4, -0.84, 0.52, -0.84, 0.66); c.closePath(); c.fill();
  // (la tripa, en sombra)
  c.fillStyle = sombra; c.globalAlpha *= 0.55; c.beginPath();
  c.moveTo(-0.82, 0.58); c.bezierCurveTo(-0.3, 0.6, 0.2, 0.52, 0.7, 0.6); c.bezierCurveTo(0.6, 0.42, 0.5, 0.38, 0.42, 0.36);
  c.bezierCurveTo(0.1, 0.32, -0.3, 0.44, -0.56, 0.38); c.bezierCurveTo(-0.76, 0.4, -0.84, 0.5, -0.82, 0.58); c.fill();
  c.globalAlpha /= 0.55;
  // (tanda 5) el contraluz: una línea de luz por el lomo, del lado de la luna
  if (vida?.luz) {
    c.strokeStyle = vida.luz; c.lineWidth = 0.035; c.lineCap = 'round'; c.globalAlpha *= 0.6; c.beginPath();
    c.moveTo(-0.8, 0.84); c.bezierCurveTo(-0.7, 1.0, -0.3, 0.975, 0.18, 0.975); c.bezierCurveTo(0.4, 0.99, 0.48, 1.04, 0.58, 1.15); c.stroke();
    c.globalAlpha /= 0.6;
  }
  // La cabeza: oreja, frente, hocico y mandíbula
  conCabeza(() => {
    c.fillStyle = claro; c.beginPath();
    c.moveTo(0.44, 1.0); c.lineTo(0.62, 1.24); c.lineTo(0.7 - orejas * 0.07, 1.52 - Math.abs(orejas) * 0.04); c.lineTo(0.84, 1.26); c.lineTo(0.96, 1.2);
    c.lineTo(1.3, 1.02); c.lineTo(1.38, 0.95); c.lineTo(1.28, 0.87); c.lineTo(0.94, 0.84); c.lineTo(0.72, 0.7); c.closePath(); c.fill();
    tri(c, 0.94, 0.84, 1.28, 0.87, 1.02, 0.94, sombra);
    c.fillStyle = MORADO_NOCHE; c.beginPath(); c.arc(1.345, 0.955, 0.04, 0, 6.3); c.fill();
    if (vida?.ojos === 'cerrados' || vida?.aulla) { c.strokeStyle = MORADO_NOCHE; c.lineWidth = 0.022; c.lineCap = 'round'; c.beginPath(); c.moveTo(0.955, 1.07); c.lineTo(1.03, 1.09); c.stroke(); }
    else { c.beginPath(); c.ellipse(0.99, 1.08, 0.036, 0.028, -0.3, 0, 6.3); c.fill(); }
  });
  // Las patas de delante
  pata(c, -0.56, 0.52, atras, aire ? 0.55 : -0.4, 0.29, claro, 0.2);
  pata(c, 0.42, 0.52, delante, aire ? -0.35 : 0.35, 0.29, claro, 0.18);
  c.restore();
}

// Pinta un cuadro. c: contexto 2D ya escalado a px de CSS; e: la etapa; p: el paisaje; { w, h, t, dt, quieto }
// (tanda 1) Los cielos, según la hora: de arriba al horizonte
const CIELOS = {
  noche: [NOCHE, MORADO_NOCHE, '#3B2A8F'],
  alba: ['#1E1548', '#6B46A8', '#F0A27A'],
  ocaso: ['#1A1245', '#5A3A9E', '#E0806B'],
  dia: ['#3348B0', '#6E86E0', '#C3CFFF'],
};

// (tanda 5) Los colores de cada paisaje (montaña, bosque, nieve, valle del amanecer): la mata, el polvo y lo de delante
const MATA = ['#7E6BE0', '#2FA36B', '#FFFFFF', '#C58BD0'];
const POLVO = ['160, 140, 255', '150, 190, 170', '255, 255, 255', '225, 170, 200'];
const DELANTE = ['#07041A', '#06121A', '#3A3378', '#120A2E'];
const FLOR = [ORO, '#C9BCFF', TIZA];
const ESTRELLA = [TIZA, '#C9BCFF', '#FFE9B0'];
// La bruma del horizonte (lo que tiñe la base de las cordilleras), según la hora
const BRUMA = { noche: '59, 42, 143', alba: '240, 162, 122', ocaso: '224, 128, 107', dia: '195, 207, 255' };
const NUBE = { noche: ['140, 120, 255', 0.13], alba: ['255, 181, 154', 0.26], ocaso: ['255, 160, 140', 0.24], dia: ['255, 255, 255', 0.5] };

const envuelve = (x, ancho) => ((x % ancho) + ancho) % ancho;

// Un pino (o un abeto nevado): tres pisos de triángulos
function pino(c, px, base, ph, oscuro, claro, nevado) {
  for (let n = 0; n < 3; n++) {
    const medio = ph * (0.34 - n * 0.07), y0 = base - ph * n * 0.26, y1 = base - ph * (0.5 + n * 0.25);
    tri(c, px - medio, y0, px, y1, px + medio, y0, n % 2 ? claro : oscuro);
    if (nevado) tri(c, px - medio * 0.5, y0 - (y0 - y1) * 0.5, px, y1, px + medio * 0.55, y0 - (y0 - y1) * 0.45, 'rgba(241, 240, 246, .85)');
  }
}

// amb (tanda 1): { fase, luna: { ilum, creciente }, clima, paisaje } (logica/travesia.js, ambiente); fantasma: los metros
// que llevaría a estas alturas su mejor ritmo (o null)
// (tanda 3) skin: los colores de su lobo; seguidores: cuántos lobos de su manada le siguen (0 a 4); corren: cuántos
// compañeros han corrido hoy (sus siluetas, a lo lejos); cielo: las constelaciones que lleva ({ puntos, lineas, cogidas, completa })
// (tanda 5) meta: dónde está el marcador de estrellas ({ x, y } en px del lienzo: allí vuelan las que coge); fin: la etapa
// ha acabado (el lobo se para y aúlla); ligero: el móvil va justo y se deja lo más caro (aurora, Vía Láctea, rayos,
// bruma, nubes de lejos, lo de delante). Todo lo de esta tanda es solo pintura: con `quieto`, nada se mueve.
export function pintar(c, e, p, { w, h, t, dt = 0, quieto = false, amb = null, fantasma = null, skin = null, seguidores = 0, corren = 0, cielo: constel = null, meta = null, fin = false, ligero = false }) {
  const fase = amb?.fase || 'noche', paisaje = amb?.paisaje || 0, clima = amb?.clima || null;
  const deDia = fase === 'dia', noche = fase === 'noche', nevado = paisaje === 2, bosque = paisaje === 1, valle = paisaje === 3;
  const u = Math.max(22, Math.min(38, w / 13));          // px por metro
  const suelo = Math.round(h * 0.66);
  const x0 = w * 0.2;                                    // dónde va el lobo
  const sx = (x) => x0 + (x - e.x) * u;
  const sy = (y) => suelo - y * u;
  if (p.t0 == null) p.t0 = t;
  const entra = quieto ? 1 : entrada(t - p.t0);          // la entrada: el cielo se enciende y la luna sube
  const enAire = e.saltos > 0;

  // Lo que ha pasado desde el último cuadro, para lo que solo se pinta (el momento de caer, de tropezar…)
  if (!quieto) for (const s of e.sucesos) {
    if (s === 'cae') p.tCae = t;
    if (s === 'tropiezo') p.tTropiezo = t;
  }
  if (fin && p.tFin == null) p.tFin = t;
  // La sacudida del tropiezo: todo el cuadro tiembla un instante
  const tiembla = quieto || p.tTropiezo == null ? { dx: 0, dy: 0 } : sacudida(t - p.tTropiezo);
  c.save();
  if (tiembla.dx || tiembla.dy) c.translate(tiembla.dx, tiembla.dy);

  // ---------- El cielo ----------
  const cielo = c.createLinearGradient(0, 0, 0, suelo);
  const [c0, c1, c2] = CIELOS[fase] || CIELOS.noche;
  cielo.addColorStop(0, c0); cielo.addColorStop(0.6, c1); cielo.addColorStop(1, c2);
  c.fillStyle = cielo; c.fillRect(-12, -12, w + 24, suelo + 12);
  const veEstrellas = (noche ? 1 : deDia ? 0 : 0.35) * (0.25 + 0.75 * entra);
  if (veEstrellas) {
    // (la Vía Láctea: una franja tenue en diagonal y su reguero de puntitos; solo de noche cerrada)
    if (noche && !ligero) {
      c.strokeStyle = 'rgba(160, 140, 255, .055)'; c.lineWidth = suelo * 0.17; c.lineCap = 'butt';
      c.beginPath(); c.moveTo(-20, suelo * 0.04); c.lineTo(w + 20, suelo * 0.44); c.stroke();
      c.fillStyle = TIZA;
      for (const s of p.lactea) { c.globalAlpha = s.a * veEstrellas; c.fillRect(envuelve(s.x * w - e.x * 0.4, w), s.y * suelo, s.t, s.t); }
    }
    for (const s of p.estrellas) {
      const brillo = (quieto ? 0.7 : 0.45 + 0.4 * Math.sin(t * s.v + s.f)) * veEstrellas;
      const ex = envuelve(s.x * w - e.x * 0.6, w), ey = s.y * suelo;
      c.globalAlpha = brillo; c.fillStyle = ESTRELLA[s.c] || TIZA;
      if (s.cruz) { estrella4(c, ex, ey, s.t * (1.6 + (quieto ? 0 : 0.5 * Math.sin(t * s.v * 1.7 + s.f))), 0); c.fill(); }
      else c.fillRect(ex, ey, s.t, s.t);
    }
    c.globalAlpha = 1;
  }
  // (la aurora: dos cortinas que ondean, una verde y otra lavanda; cada una, en tiras que suben y bajan con la onda)
  if (hayAurora(amb) && !ligero) {
    const ta = quieto ? 0 : t;
    for (let j = 0; j < 2; j++) {
      const base = suelo * (0.12 + j * 0.11), alto = suelo * (0.26 + j * 0.04);
      const tono = j === 1 ? '160, 140, 255' : '110, 240, 190';
      const luz = c.createLinearGradient(0, base, 0, base + alto);
      luz.addColorStop(0, `rgba(${tono}, 0)`); luz.addColorStop(0.16, `rgba(${tono}, ${0.3 * entra})`); luz.addColorStop(0.5, `rgba(${tono}, ${0.1 * entra})`); luz.addColorStop(1, `rgba(${tono}, 0)`);
      c.fillStyle = luz;
      for (let x = -12; x < w + 12; x += 14) {
        const dy = Math.sin(x * 0.011 + ta * 0.22 + j * 2.1) * 20 + Math.sin(x * 0.029 - ta * 0.35 + j) * 9;
        c.globalAlpha = 0.55 + 0.45 * Math.sin(x * 0.017 + ta * 0.3 + j * 1.7);
        c.save(); c.translate(0, dy); c.fillRect(x, base, 14.5, alto); c.restore();
      }
      c.globalAlpha = 1;
    }
  }
  // (tanda 3) sus constelaciones: la última completa y la que está formando, a la izquierda de la luna
  if (constel?.length && veEstrellas) {
    const lado = Math.min(w * 0.3, suelo * 0.34, 150);
    constel.slice(0, 2).forEach((k, i) => {
      const ox = w * 0.07 + i * (lado + w * 0.05), oy = Math.max(96, h * 0.15) + i * lado * 0.25;
      const px = (q) => ox + q[0] * lado, py = (q) => oy + q[1] * lado * 0.8;
      c.strokeStyle = LAVANDA; c.lineWidth = 1; c.globalAlpha = 0.5 * veEstrellas;
      for (const [a, b] of k.lineas) {
        if (!k.completa && (a >= k.cogidas || b >= k.cogidas)) continue;
        c.beginPath(); c.moveTo(px(k.puntos[a]), py(k.puntos[a])); c.lineTo(px(k.puntos[b]), py(k.puntos[b])); c.stroke();
      }
      k.puntos.forEach((q, n) => {
        const mia = k.completa || n < k.cogidas;
        c.globalAlpha = (mia ? 0.95 : 0.22) * veEstrellas; c.fillStyle = mia && k.completa ? ORO : TIZA;
        estrella4(c, px(q), py(q), mia ? 3.4 : 2, 0); c.fill();
      });
    });
    c.globalAlpha = 1;
  }
  // (una estrella fugaz de vez en cuando: la cabeza y su estela)
  if (!quieto && veEstrellas > 0.3) {
    const f = fugaz(t - p.t0, p.estrellas.length + Math.round(p.estrellas[0].f * 100));
    if (f) {
      const fx = f.x * w, fy = f.y * suelo, largo = 70 * Math.sin(f.k * Math.PI);
      const cola = c.createLinearGradient(fx, fy, fx - f.dx * 300, fy - f.dy * 300);
      cola.addColorStop(0, 'rgba(241, 240, 246, .9)'); cola.addColorStop(1, 'rgba(241, 240, 246, 0)');
      const n = Math.hypot(f.dx, f.dy);
      c.strokeStyle = cola; c.lineWidth = 2; c.lineCap = 'round'; c.globalAlpha = veEstrellas;
      c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx - (f.dx / n) * largo, fy - (f.dy / n) * largo); c.stroke();
      c.globalAlpha = 1;
    }
  }
  // La luna (o el sol): alta de noche y de día; al alba y al ocaso, el sol bajo, casi en el horizonte
  const bajo = fase === 'alba' || fase === 'ocaso';
  const lx = w * 0.74, lr = Math.max(30, Math.min(56, w * 0.11));
  const ly = (bajo ? suelo * alturaAstro(fase) : Math.max(110, h * 0.23)) + (1 - entra) * suelo * 0.22;
  const tinte = bajo ? '255, 170, 120' : deDia ? '255, 220, 130' : '160, 140, 255';
  const halo = c.createRadialGradient(lx, ly, lr * 0.6, lx, ly, lr * (bajo ? 5.2 : 3.4));
  halo.addColorStop(0, `rgba(${tinte}, ${bajo ? 0.5 : 0.38})`); halo.addColorStop(0.45, `rgba(${tinte}, ${bajo ? 0.16 : 0.1})`); halo.addColorStop(1, `rgba(${tinte}, 0)`);
  c.fillStyle = halo; c.fillRect(lx - lr * 5.4, ly - lr * 5.4, lr * 10.8, lr * 10.8);
  // (los rayos: una corona que gira despacio; de día y con el sol bajo se ven más)
  c.fillStyle = `rgba(${tinte}, ${deDia ? 0.2 : bajo ? 0.16 : 0.07})`;
  const gira = quieto ? 0.2 : t * 0.05;
  for (let i = 0; i < 12 && !ligero; i++) {
    const a = gira + (i * Math.PI) / 6, r1 = lr * 1.25, r2 = lr * (i % 2 ? 2.1 : 2.9), an = 0.07;
    c.beginPath(); c.moveTo(lx + Math.cos(a - an) * r1, ly + Math.sin(a - an) * r1); c.lineTo(lx + Math.cos(a) * r2, ly + Math.sin(a) * r2); c.lineTo(lx + Math.cos(a + an) * r1, ly + Math.sin(a + an) * r1); c.closePath(); c.fill();
  }
  if (deDia || bajo) {
    const sol = c.createRadialGradient(lx - lr * 0.2, ly - lr * 0.2, lr * 0.1, lx, ly, lr);
    sol.addColorStop(0, bajo ? '#FFE3B8' : '#FFF1B8'); sol.addColorStop(1, bajo ? '#F79A6B' : ORO);
    c.fillStyle = sol; c.beginPath(); c.arc(lx, ly, lr * 0.9, 0, 6.3); c.fill();
  } else {
    c.fillStyle = TIZA; c.beginPath(); c.arc(lx, ly, lr, 0, 6.3); c.fill();
    c.fillStyle = 'rgba(160, 140, 255, .32)';
    for (const [dx, dy, r] of [[-0.3, -0.25, 0.2], [0.32, 0.1, 0.26], [-0.1, 0.42, 0.14], [0.05, -0.5, 0.1]]) { c.beginPath(); c.arc(lx + dx * lr, ly + dy * lr, r * lr, 0, 6.3); c.fill(); }
    // (su fase de verdad: la parte en sombra, del color del cielo, entra por un lado)
    const il = amb?.luna ? Math.max(0, Math.min(1, amb.luna.ilum)) : 1;
    if (il < 0.97) {
      c.save(); c.beginPath(); c.arc(lx, ly, lr + 0.5, 0, 6.3); c.clip();
      c.fillStyle = c1; c.globalAlpha = 0.93;
      c.beginPath(); c.arc(lx + (amb.luna.creciente ? -1 : 1) * lr * 2 * il, ly, lr * 1.02, 0, 6.3); c.fill();
      c.restore();
    }
  }
  // Las nubes, en dos capas que pasan despacio, teñidas por la hora
  const [tonoNube, alfaNube] = NUBE[fase] || NUBE.noche;
  for (const n of p.nubes) {
    if (ligero && n.lejos) continue;
    const v = n.lejos ? 4 : 9, ancho = w + n.w * 2;
    const nx = envuelve(n.x * w - (quieto ? 0 : t * v) - e.x * (n.lejos ? 0.5 : 1.1), ancho) - n.w, ny = n.y * suelo;
    c.fillStyle = `rgba(${tonoNube}, ${alfaNube * (n.lejos ? 0.6 : 1) * (0.4 + 0.6 * entra)})`;
    c.beginPath();
    for (const l of n.lobulos) { c.moveTo(nx + l.dx * n.w + l.rx * n.w, ny + l.dy * n.w); c.ellipse(nx + l.dx * n.w, ny + l.dy * n.w, l.rx * n.w, l.ry * n.w, 0, 0, 6.3); }
    c.fill();
  }

  // ---------- Las cordilleras: cada pico, con su cara a la luna más clara, su cresta iluminada y, las lejanas, su nieve ----------
  const bruma = BRUMA[fase] || BRUMA.noche;
  p.capas.forEach((capa, nc) => {
    const corre = (e.x * u * capa.v) % capa.periodo;
    for (let k = -1; k * capa.periodo - corre < w; k++) {
      for (const m of capa.picos) {
        const cx = k * capa.periodo - corre + m.x, alto = m.h * suelo, medio = (m.w * suelo) / 2;
        if (cx + medio < 0 || cx - medio > w) continue;
        tri(c, cx - medio, suelo, cx, suelo - alto, cx + medio * 0.12, suelo, capa.sombra);
        tri(c, cx, suelo - alto, cx + medio, suelo, cx + medio * 0.12, suelo, capa.luz);
        if (capa.nieve) {
          c.globalAlpha = capa.nieve;
          tri(c, cx, suelo - alto, cx + medio * 0.3, suelo - alto * 0.7, cx + medio * 0.06, suelo - alto * 0.76, TIZA);
          c.globalAlpha = capa.nieve * 0.45;
          tri(c, cx, suelo - alto, cx - medio * 0.26, suelo - alto * 0.74, cx + medio * 0.06, suelo - alto * 0.76, TIZA);
          c.globalAlpha = 1;
        }
        // (la cresta: un filo de luz por el lado de la luna)
        if (nc < 2 && !deDia) {
          c.strokeStyle = `rgba(${tinte}, ${nc ? 0.22 : 0.34})`; c.lineWidth = 1.2;
          c.beginPath(); c.moveTo(cx, suelo - alto); c.lineTo(cx + medio * 0.55, suelo - alto * 0.45); c.stroke();
        }
      }
    }
    // (la bruma: cada cordillera se pierde en la del horizonte por abajo; las de lejos, más)
    if (ligero) return;
    const velo = c.createLinearGradient(0, suelo - suelo * 0.24, 0, suelo);
    velo.addColorStop(0, `rgba(${bruma}, 0)`); velo.addColorStop(1, `rgba(${bruma}, ${[0.42, 0.3, 0.16][nc]})`);
    c.fillStyle = velo; c.fillRect(-12, suelo - suelo * 0.24, w + 24, suelo * 0.24);
  });

  // (tanda 3) la manada, a lo lejos: una silueta por cada compañero que ha corrido hoy, al trote por la loma
  if (corren > 0) {
    const uu = u * 0.36, n = Math.min(5, corren);
    for (let i = 0; i < n; i++) {
      const bx = ((w * (0.5 + i * 0.13) + (quieto ? 0 : t * 5) - e.x * u * 0.05) % (w + 120) + (w + 120)) % (w + 120) - 60;
      c.save(); c.globalAlpha = deDia ? 0.5 : 0.62; c.translate(bx, suelo - 1); c.scale(uu, -uu);
      lobo(c, { saltos: 0, tropiezo: 0, vy: 0, agachado: 0 }, quieto ? i : t * 7 + i * 1.7, { claro: '#4A3FA6', sombra: '#3A3090' });
      c.restore();
    }
  }
  // Cada paisaje, con lo suyo, delante de las cordilleras
  if (bosque || nevado) {
    // (dos filas de pinos: la de lejos, más pequeña y más lenta; en la nieve, abetos nevados)
    const corre2 = (e.x * u * 0.24) % 800;
    for (const pi of p.pinos2) for (let k = 0; k * 800 - corre2 + pi.x < w + 30; k++) {
      const px = k * 800 - corre2 + pi.x;
      if (px > -30) pino(c, px, suelo, pi.h * suelo, nevado ? '#3D3489' : '#12303A', nevado ? '#4A40A0' : '#173B40', nevado);
    }
    const corre = (e.x * u * 0.32) % 800;
    for (const pi of p.pinos) for (let k = 0; k * 800 - corre + pi.x < w + 40; k++) {
      const px = k * 800 - corre + pi.x;
      if (px > -40) pino(c, px, suelo, pi.h * suelo, nevado ? '#30287A' : '#173B40', nevado ? '#3A318C' : '#1F4B4A', nevado);
    }
  } else if (valle) {
    // (el valle: lomas suaves con el filo cálido del amanecer, y unos pájaros que planean)
    const corre = e.x * u * 0.28;
    c.fillStyle = '#34266F'; c.beginPath(); c.moveTo(-12, suelo);
    for (let x = -12; x <= w + 12; x += 12) c.lineTo(x, suelo - 20 - 14 * Math.sin((x + corre) * 0.008) - 8 * Math.sin((x + corre) * 0.021));
    c.lineTo(w + 12, suelo); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255, 170, 120, .45)'; c.lineWidth = 1.5; c.beginPath();
    for (let x = -12; x <= w + 12; x += 12) c.lineTo(x, suelo - 20 - 14 * Math.sin((x + corre) * 0.008) - 8 * Math.sin((x + corre) * 0.021));
    c.stroke();
    c.strokeStyle = 'rgba(30, 21, 72, .7)'; c.lineWidth = 1.6; c.lineCap = 'round';
    for (const b of p.pajaros) {
      const bx = envuelve(b.x * w + (quieto ? 0 : t * 14) - e.x * 0.8, w + 40) - 20, by = b.y * suelo + (quieto ? 0 : Math.sin(t * 0.7 + b.f) * 6), ala = quieto ? 0.4 : 0.25 + 0.3 * Math.sin(t * 6 + b.f);
      c.beginPath(); c.moveTo(bx - b.s, by - b.s * ala); c.lineTo(bx, by); c.lineTo(bx + b.s, by - b.s * ala); c.stroke();
    }
  } else {
    // (la montaña: piedras sueltas al pie de las cordilleras)
    const corre = (e.x * u * 0.32) % 800;
    for (const q of p.piedras) for (let k = 0; k * 800 - corre + q.x < w + 30; k++) {
      const px = k * 800 - corre + q.x;
      if (px < -30) continue;
      c.fillStyle = '#231A5C'; c.beginPath(); c.moveTo(px - q.s, suelo); c.lineTo(px - q.s * 0.5, suelo - q.s * q.a * 0.7); c.lineTo(px + q.s * 0.3, suelo - q.s * q.a); c.lineTo(px + q.s, suelo); c.closePath(); c.fill();
      c.fillStyle = '#33288A'; c.beginPath(); c.moveTo(px + q.s * 0.3, suelo - q.s * q.a); c.lineTo(px + q.s, suelo); c.lineTo(px + q.s * 0.35, suelo); c.closePath(); c.fill();
    }
  }
  // (la luz de la hora, por encima del paisaje)
  if (!noche) { c.fillStyle = deDia ? 'rgba(150, 175, 255, .2)' : 'rgba(255, 150, 110, .1)'; c.fillRect(-12, -12, w + 24, suelo + 12); }

  // ---------- El suelo ----------
  const tierra = c.createLinearGradient(0, suelo, 0, h);
  tierra.addColorStop(0, nevado ? '#CFCAF2' : bosque ? '#14263A' : valle ? '#2A1B5E' : '#1A1247'); tierra.addColorStop(1, nevado ? '#8F86CF' : '#0E0930');
  c.fillStyle = tierra; c.fillRect(-12, suelo, w + 24, h - suelo + 12);
  c.fillStyle = nevado ? '#FFFFFF' : LAVANDA; c.globalAlpha = 0.85; c.fillRect(-12, suelo, w + 24, 2.5); c.globalAlpha = 1;
  c.fillStyle = 'rgba(160, 140, 255, .16)';
  const corre = (e.x * u) % 900;
  for (const g of p.hierbas) for (let k = 0; k * 900 - corre + g.x < w; k++) { const gx = k * 900 - corre + g.x; if (gx + g.w > 0) c.fillRect(gx, suelo + g.y, g.w, 2); }
  // (más cerca, matas sueltas por el suelo, más grandes y más rápidas: dan fondo)
  if (!ligero && h - suelo > 150) {
    const correM = (e.x * u * 1.22) % 900, fondo = h - suelo - 90;
    c.strokeStyle = nevado ? 'rgba(120, 110, 200, .5)' : 'rgba(160, 140, 255, .2)'; c.lineWidth = 2; c.lineCap = 'round';
    for (const g of p.matas) {
      if (g.n !== 3) continue;
      for (let k = 0; k * 900 - correM + g.x < w + 16; k++) {
        const gx = k * 900 - correM + g.x, gy = suelo + 30 + ((g.f * 37) % fondo);
        if (gx < -16) continue;
        const mece = quieto ? 0 : Math.sin(t * 1.6 + g.f) * 3 - Math.min(4, e.v * 0.3);
        c.beginPath();
        for (let n = -1; n <= 1; n++) { c.moveTo(gx + n * 5, gy); c.quadraticCurveTo(gx + n * 6 + mece * 0.4, gy - g.h * 1.1, gx + n * 9 + mece, gy - g.h * (2 - Math.abs(n) * 0.5)); }
        c.stroke();
      }
    }
  }
  // (las huellas que va dejando)
  if (!quieto) {
    const paso = Math.floor(p.zancada / Math.PI);
    if (paso !== p.pisada && !enAire && e.tropiezo === 0 && !e.calma) { p.pisada = paso; p.huellas.push(e.x - 0.55); if (p.huellas.length > 16) p.huellas.shift(); }
    c.fillStyle = nevado ? 'rgba(110, 100, 190, .5)' : 'rgba(6, 4, 24, .38)';
    p.huellas.forEach((hx, i) => { const px = sx(hx); if (px > -10) { c.beginPath(); c.ellipse(px, suelo + 7 + (i % 2) * 3, 4, 1.7, 0, 0, 6.3); c.fill(); } });
  }
  // (las matas de la línea del suelo, que se mecen, y alguna flor)
  c.lineCap = 'round';
  for (const g of p.matas) for (let k = 0; k * 900 - corre + g.x < w + 10; k++) {
    const gx = k * 900 - corre + g.x;
    if (gx < -10) continue;
    const mece = quieto ? 0 : Math.sin(t * 1.8 + g.f) * 2.2 - Math.min(3, e.v * 0.18);
    c.strokeStyle = MATA[paisaje] || MATA[0]; c.globalAlpha = nevado ? 0.75 : 0.6; c.lineWidth = 1.4; c.beginPath();
    for (let n = 0; n < g.n; n++) { const bx = gx + (n - (g.n - 1) / 2) * 3; c.moveTo(bx, suelo + 1); c.quadraticCurveTo(bx + mece * 0.4, suelo - g.h * 0.6, bx + mece + (n - 1) * 1.5, suelo - g.h * (0.75 + n * 0.12)); }
    c.stroke();
  }
  if (!nevado) for (const fl of p.flores) for (let k = 0; k * 900 - corre + fl.x < w + 10; k++) {
    const gx = k * 900 - corre + fl.x;
    if (gx < -10) continue;
    const mece = quieto ? 0 : Math.sin(t * 1.5 + fl.f) * 1.6;
    c.strokeStyle = MATA[paisaje] || MATA[0]; c.globalAlpha = 0.6; c.lineWidth = 1.2; c.beginPath(); c.moveTo(gx, suelo + 1); c.quadraticCurveTo(gx + mece * 0.4, suelo - fl.h * 0.6, gx + mece, suelo - fl.h); c.stroke();
    c.globalAlpha = 0.95; c.fillStyle = FLOR[fl.c]; c.beginPath(); c.arc(gx + mece, suelo - fl.h, 2.1, 0, 6.3); c.fill();
  }
  c.globalAlpha = 1;
  // (en la nieve, brillos que se encienden y se apagan)
  if (nevado) {
    c.fillStyle = '#FFFFFF';
    for (const b of p.brillos) for (let k = 0; k * 900 - corre + b.x < w; k++) {
      const gx = k * 900 - corre + b.x, a = quieto ? 0.5 : Math.max(0, Math.sin(t * b.v + b.f));
      if (gx < -6 || suelo + b.y > h || a < 0.15) continue;
      c.globalAlpha = a * 0.9; estrella4(c, gx, suelo + b.y, 2.6, 0); c.fill();
    }
    c.globalAlpha = 1;
  }

  // ---------- Lo que hay que saltar ----------
  for (const o of e.obstaculos) {
    const izq = sx(o.x - o.w / 2), der = sx(o.x + o.w / 2);
    if (der < -24 || izq > w + 24) continue;
    if (o.tipo === 'rio') {
      // (el río: agua bajo el nivel del suelo, con el reflejo de la luna, ondas que corren y juncos en las orillas)
      const ancho = der - izq;
      const agua = c.createLinearGradient(0, suelo, 0, suelo + 46);
      agua.addColorStop(0, nevado ? '#8FA6F0' : '#6E86E0'); agua.addColorStop(1, '#2B2C8F');
      c.fillStyle = agua; c.fillRect(izq, suelo - 1, ancho, 48);
      c.save(); c.beginPath(); c.rect(izq, suelo - 1, ancho, 48); c.clip();
      if (!deDia) {
        // (la luna, a trozos que tiemblan)
        c.fillStyle = `rgba(${bajo ? '255, 200, 160' : '241, 240, 246'}, .5)`;
        const rx = izq + ancho * 0.62;
        for (let i = 0; i < 5; i++) { const an = (14 - i * 2) * (1 + (quieto ? 0 : 0.25 * Math.sin(t * 3 + i * 1.3))); c.fillRect(rx - an / 2 + (quieto ? 0 : Math.sin(t * 2.2 + i) * 2), suelo + 5 + i * 7, an, 2.2); }
      }
      c.strokeStyle = 'rgba(241, 240, 246, .4)'; c.lineWidth = 1.4; c.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const oy = suelo + 8 + i * 10, corr = quieto ? 0 : (t * (14 + i * 5)) % 40;
        for (let x = izq - 40 + corr + i * 9; x < der; x += 40) { c.beginPath(); c.moveTo(x, oy); c.quadraticCurveTo(x + 6, oy - 2.5, x + 12, oy); c.stroke(); }
      }
      c.restore();
      c.strokeStyle = bosque ? '#2FA36B' : nevado ? '#FFFFFF' : '#9B8CF0'; c.lineWidth = 1.6; c.globalAlpha = 0.85;
      for (const [bx, lado] of [[izq, -1], [der, 1]]) for (let i = 0; i < 3; i++) {
        const jx = bx + lado * (2 + i * 4), jh = 12 + i * 4, mece = quieto ? 0 : Math.sin(t * 1.6 + i + bx * 0.01) * 2.5;
        c.beginPath(); c.moveTo(jx, suelo + 2); c.quadraticCurveTo(jx + mece * 0.5, suelo - jh * 0.6, jx + mece + lado * 2, suelo - jh); c.stroke();
      }
      c.globalAlpha = 1;
      continue;
    }
    if (o.tipo === 'rama') {
      // (la rama: cuelga de un tronco que sube hasta fuera de la pantalla; sus hojas se mecen)
      const yr = sy(o.h), g = u * 0.34;
      c.fillStyle = '#3A2A5C'; c.fillRect(der - u * 0.2, -12, u * 0.3, yr - g + 14);
      c.fillStyle = '#4A3878'; c.fillRect(der - u * 0.2, -12, u * 0.09, yr - g + 14);
      c.fillStyle = '#5B4590'; c.beginPath(); c.roundRect(izq - u * 0.25, yr - g, der - izq + u * 0.45, g, g / 2); c.fill();
      c.fillStyle = 'rgba(241, 240, 246, .16)'; c.beginPath(); c.roundRect(izq - u * 0.2, yr - g + 1, der - izq + u * 0.3, g * 0.3, g / 4); c.fill();
      [0.08, 0.3, 0.5, 0.68, 0.86].forEach((d, i) => {
        const mece = quieto ? 0 : Math.sin(t * 2 + i * 1.4 + o.x) * 0.22;
        c.fillStyle = nevado ? '#FFFFFF' : bosque ? (i % 2 ? '#3FBF80' : '#2FA36B') : i % 2 ? '#B9A8FF' : LAVANDA;
        c.beginPath(); c.ellipse(izq + (der - izq) * d, yr - g * (i % 2 ? 1.25 : 1.05), u * 0.26, u * 0.14, -0.4 + mece, 0, 6.3); c.fill();
        if (i % 2 === 0) { c.beginPath(); c.ellipse(izq + (der - izq) * d + u * 0.1, yr + g * 0.12, u * 0.16, u * 0.09, 0.5 + mece, 0, 6.3); c.fill(); }
      });
      continue;
    }
    const cx = sx(o.x), arriba = sy(o.h), llano = ((o.w / 2) * o.plano) * u;
    const roca = o.tipo === 'roca';
    // (su sombra, alargada hacia el lado contrario a la luna)
    c.fillStyle = 'rgba(6, 4, 24, .28)'; c.beginPath(); c.ellipse(cx - (der - izq) * 0.18, suelo + 4, (der - izq) * 0.62, 4, 0, 0, 6.3); c.fill();
    c.fillStyle = roca ? '#6F64AE' : VIOLETA;
    c.beginPath(); c.moveTo(izq, suelo); c.lineTo(cx - llano, arriba); c.lineTo(cx + llano * 0.2, arriba); c.lineTo(cx + llano * 0.5, suelo); c.closePath(); c.fill();
    c.fillStyle = roca ? '#A69CDB' : '#8C78FF';
    c.beginPath(); c.moveTo(cx + llano * 0.2, arriba); c.lineTo(cx + llano, arriba); c.lineTo(der, suelo); c.lineTo(cx + llano * 0.5, suelo); c.closePath(); c.fill();
    // (las vetas de la piedra y el filo de luz de arriba)
    c.strokeStyle = 'rgba(30, 21, 72, .28)'; c.lineWidth = 1.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx - llano * 0.6, arriba + (suelo - arriba) * 0.35); c.lineTo(cx - llano * 0.15, arriba + (suelo - arriba) * 0.62);
    c.moveTo(cx + llano * 0.75, arriba + (suelo - arriba) * 0.3); c.lineTo(cx + llano * 0.9 + (der - cx - llano) * 0.4, arriba + (suelo - arriba) * 0.7); c.stroke();
    c.strokeStyle = 'rgba(241, 240, 246, .5)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(cx + llano * 0.2, arriba + 0.6); c.lineTo(cx + llano, arriba + 0.6); c.stroke();
    if (roca && (bosque || nevado)) {
      // (en el bosque, musgo arriba; en la nieve, una capa blanca)
      c.fillStyle = nevado ? TIZA : '#2FA36B'; c.globalAlpha = nevado ? 0.95 : 0.8;
      c.beginPath(); c.moveTo(cx - llano, arriba); c.lineTo(cx + llano, arriba); c.lineTo(cx + llano + 3, arriba + 4); c.quadraticCurveTo(cx, arriba + 8, cx - llano - 3, arriba + 4); c.closePath(); c.fill();
      c.globalAlpha = 1;
    }
    if (!roca) {
      // (la nieve de la cima: hasta donde la silueta baja un 30 %)
      const baja = o.h * 0.3, yN = sy(o.h - baja), anchoN = llano + ((o.w / 2) * (1 - o.plano) * u * 0.3);
      c.fillStyle = TIZA;
      c.beginPath(); c.moveTo(cx - llano, arriba); c.lineTo(cx + llano, arriba); c.lineTo(cx + anchoN, yN); c.lineTo(cx + anchoN * 0.35, yN - 4); c.lineTo(cx, yN + 3); c.lineTo(cx - anchoN * 0.4, yN - 4); c.lineTo(cx - anchoN, yN); c.closePath(); c.fill();
    }
  }

  // Las estrellas que se cogen: giran, laten y llevan un destello que les da vueltas
  for (const s of e.estrellas) {
    if (s.cogida) continue;
    const x = sx(s.x); if (x < -20 || x > w + 20) continue;
    const y = sy(s.y) + (quieto ? 0 : Math.sin(t * 3 + s.x) * 3), late = quieto ? 1 : 1 + 0.12 * Math.sin(t * 5 + s.x * 2);
    const luz = c.createRadialGradient(x, y, 1, x, y, 20 * late);
    luz.addColorStop(0, 'rgba(242, 194, 48, .55)'); luz.addColorStop(1, 'rgba(242, 194, 48, 0)');
    c.fillStyle = luz; c.fillRect(x - 22, y - 22, 44, 44);
    c.fillStyle = ORO; estrella4(c, x, y, 9 * late, quieto ? 0 : t * 0.8); c.fill();
    c.fillStyle = '#FFF3C4'; estrella4(c, x, y, 3.6, quieto ? 0 : -t * 1.2); c.fill();
    if (!quieto) { const a = t * 2.6 + s.x; c.fillStyle = TIZA; c.globalAlpha = 0.85; estrella4(c, x + Math.cos(a) * 14, y + Math.sin(a) * 9, 2.2, 0); c.fill(); c.globalAlpha = 1; }
  }

  // ---------- Sucesos del juego desde el último cuadro ----------
  // Chispas al coger una estrella (que además vuela al marcador), polvo al caer o tropezar, agua al cruzar el río, los
  // trozos del escudo y el aro del doble salto
  const polvo = POLVO[paisaje] || POLVO[0];
  for (const s of e.sucesos) {
    if (quieto) break;
    const n = s === 'estrella' || s === 'escudo' ? 7 : s === 'tropiezo' ? 8 : s === 'rio' ? 12 : 0;
    for (let i = 0; i < n; i++) {
      const rio = s === 'rio';
      const a = s === 'estrella' || s === 'escudo' ? (i / n) * 6.28 : rio ? -Math.PI / 2 + (i / n - 0.5) * 1.5 : Math.PI + (i / n - 0.5) * 1.6;
      p.chispas.push({ x: x0 + (s === 'estrella' ? 10 : rio ? -u * (0.4 + (i % 4) * 0.3) : -8), y: s === 'estrella' ? sy(e.y + 0.8) : suelo - 2, vx: Math.cos(a) * (60 + i * 12), vy: Math.sin(a) * (rio ? 130 + i * 9 : 60 + i * 9) - (s === 'estrella' ? 0 : 30), t: rio ? 0.7 : 0.5, oro: s === 'estrella' || s === 'escudo', agua: rio });
    }
    if (s === 'estrella' && meta) p.volando.push({ x: x0 + 10, y: sy(e.y + 0.8), k: 0 });
    if (s === 'cae' || s === 'tropiezo') for (let i = 0; i < (s === 'cae' ? 5 : 7); i++) p.polvo.push({ x: x0 - u * 0.3 + (i - 2) * 7, y: suelo - 2, vx: (i - 2.5) * 22, vy: -14 - (i % 3) * 9, r: 3 + (i % 3) * 1.5, t: 0.45, t0: 0.45 });
    if (s === 'escudo') for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28; p.trozos.push({ x: x0 + Math.cos(a) * u * 1.2, y: sy(e.y + 0.75) + Math.sin(a) * u, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150 - 40, a, g: 5 + (i % 3) * 3, t: 0.6 }); }
    if (s === 'doble') p.aros.push({ x: x0, y: sy(e.y) + 4, t: 0.32 });
  }
  e.sucesos.length = 0;
  // (el polvo de correr: una nubecilla tras las patas de atrás cuando va lanzado)
  if (!quieto && dt > 0 && !enAire && e.tropiezo === 0 && e.v > 7) {
    p.tPolvo += dt;
    if (p.tPolvo > 0.085) { p.tPolvo = 0; p.polvo.push({ x: x0 - u * 0.75, y: suelo - 2, vx: -26 - (p.pisada % 3) * 12, vy: -12 - (p.pisada % 2) * 10, r: 2.2 + (p.pisada % 3), t: 0.34, t0: 0.34 }); }
  }
  // (el polvo va por detrás de los lobos, para no taparlos)
  p.polvo = p.polvo.filter((q) => (q.t -= dt) > 0);
  for (const q of p.polvo) {
    q.x += (q.vx - e.v * u * 0.55) * dt; q.y += q.vy * dt; q.vy += 30 * dt;
    c.fillStyle = `rgba(${polvo}, ${0.34 * (q.t / q.t0)})`;
    c.beginPath(); c.arc(q.x, Math.min(q.y, suelo - 1), q.r * (1.9 - q.t / q.t0), 0, 6.3); c.fill();
  }
  p.chispas = p.chispas.filter((q) => (q.t -= dt) > 0);
  for (const q of p.chispas) {
    q.x += q.vx * dt - e.v * u * dt * 0.6; q.y += q.vy * dt; q.vy += (q.agua ? 420 : 220) * dt;
    c.globalAlpha = Math.min(1, q.t * 2.4); c.fillStyle = q.agua ? '#C3CFFF' : q.oro ? ORO : LAVANDA;
    c.beginPath(); c.arc(q.x, Math.min(q.y, suelo - 1), q.agua ? 2.2 : q.oro ? 2.4 : 3, 0, 6.3); c.fill();
  }
  c.globalAlpha = 1;
  // (los trozos del escudo: arcos dorados que salen despedidos)
  p.trozos = p.trozos.filter((q) => (q.t -= dt) > 0);
  c.strokeStyle = ORO; c.lineWidth = 2.5; c.lineCap = 'round';
  for (const q of p.trozos) {
    q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 260 * dt; q.a += 6 * dt;
    c.globalAlpha = Math.min(1, q.t * 2.2);
    c.beginPath(); c.moveTo(q.x - Math.cos(q.a) * q.g, q.y - Math.sin(q.a) * q.g); c.lineTo(q.x + Math.cos(q.a) * q.g, q.y + Math.sin(q.a) * q.g); c.stroke();
  }
  // (el aro del doble salto, que se abre bajo las patas)
  p.aros = p.aros.filter((q) => (q.t -= dt) > 0);
  c.strokeStyle = TIZA; c.lineWidth = 2;
  for (const q of p.aros) { q.x -= e.v * u * dt * 0.7; const k = 1 - q.t / 0.32; c.globalAlpha = (1 - k) * 0.7; c.beginPath(); c.ellipse(q.x, q.y, u * (0.4 + k * 0.9), u * (0.12 + k * 0.2), 0, 0, 6.3); c.stroke(); }
  c.globalAlpha = 1;

  // (en el bosque, de noche, luciérnagas)
  if (bosque && !deDia) {
    for (const l of p.luciernagas) {
      const a = quieto ? 0.6 : Math.max(0, Math.sin(t * l.v * 1.3 + l.f));
      if (a < 0.08) continue;
      const fx = envuelve(l.x * w - e.x * u * 0.5 + (quieto ? 0 : Math.sin(t * 0.5 + l.f) * 16), w), fy = suelo * (0.55 + l.y * 0.42) + (quieto ? 0 : Math.cos(t * 0.8 + l.f) * 8);
      const luz = c.createRadialGradient(fx, fy, 0, fx, fy, 7);
      luz.addColorStop(0, `rgba(214, 255, 150, ${0.85 * a})`); luz.addColorStop(1, 'rgba(214, 255, 150, 0)');
      c.fillStyle = luz; c.fillRect(fx - 7, fy - 7, 14, 14);
    }
  }

  // ---------- (tanda 1) Lo que cae: lluvia en rayas (con sus salpicaduras), nieve en copos de dos tamaños, niebla en bandas ----------
  if (clima && !quieto) {
    if (clima === 'niebla') {
      for (let i = 0; i < 3; i++) {
        const by = suelo * (0.46 + i * 0.15) + Math.sin(t * 0.4 + i) * 6, alto = 34 + i * 10;
        const banda = c.createLinearGradient(0, by, 0, by + alto);
        banda.addColorStop(0, 'rgba(241, 240, 246, 0)'); banda.addColorStop(0.5, `rgba(241, 240, 246, ${0.1 + i * 0.03})`); banda.addColorStop(1, 'rgba(241, 240, 246, 0)');
        c.fillStyle = banda; c.fillRect(-12, by, w + 24, alto);
      }
    } else {
      const nieve = clima === 'nieve';
      c.strokeStyle = 'rgba(200, 210, 255, .55)'; c.fillStyle = 'rgba(255, 255, 255, .85)'; c.lineWidth = 1.2;
      p.gotas.forEach((g, i) => {
        const gy = ((g.y + t * g.v * (nieve ? 0.09 : 0.75)) % 1) * suelo;
        const gx = (((g.x * w - e.x * (nieve ? 3 : 8) + (nieve ? Math.sin(t + g.f) * 10 : -gy * 0.25)) % w) + w) % w;
        if (nieve) { c.globalAlpha = i % 3 ? 0.85 : 0.5; c.beginPath(); c.arc(gx, gy, (i % 3 ? 1.2 : 2.4) + g.v, 0, 6.3); c.fill(); }
        else {
          c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 3, gy + 11); c.stroke();
          // (la gota que llega al suelo salpica)
          if (gy > suelo - 26) { const k = (gy - (suelo - 26)) / 26; c.globalAlpha = 1 - k; c.beginPath(); c.moveTo(gx - 3 - k * 5, suelo - k * 4); c.lineTo(gx - 3, suelo); c.lineTo(gx - 3 + k * 5, suelo - k * 4); c.stroke(); c.globalAlpha = 1; }
        }
      });
      c.globalAlpha = 1;
      // (en la tormenta, un resplandor lejano y suave de tarde en tarde)
      if (clima === 'tormenta') {
        if (t - p.rayo > 9 && Math.sin(t * 1.7) > 0.995) p.rayo = t;
        const dr = t - p.rayo;
        if (dr >= 0 && dr < 0.5) { c.fillStyle = `rgba(200, 210, 255, ${0.14 * (1 - dr / 0.5)})`; c.fillRect(-12, -12, w + 24, suelo + 12); }
      }
    }
  }
  // (tanda 1) su fantasma: el lobo de su mejor ritmo, traslúcido, por delante o por detrás
  if (fantasma != null && !fin) {
    const fx = sx(fantasma);
    if (fx > -u * 2 && fx < w + u * 2) {
      c.save(); c.globalAlpha = 0.28; c.translate(fx, suelo); c.scale(u, -u);
      lobo(c, { saltos: 0, tropiezo: 0, vy: 0, agachado: 0 }, p.zancada + 1.3);
      c.restore();
    }
  }

  // ---------- El lobo ----------
  if (!fin) p.zancada += dt * e.v * (e.calma ? 3.2 : 1.9);
  // (la racha se ve: un resplandor detrás y líneas de viento)
  const imp = e.calma || fin ? 0 : impetu(e.racha);
  if (imp > 0) {
    const aura = c.createRadialGradient(x0 - u * 0.3, sy(e.y + 0.7), u * 0.2, x0 - u * 0.3, sy(e.y + 0.7), u * 2.1);
    aura.addColorStop(0, `rgba(160, 140, 255, ${0.3 * imp})`); aura.addColorStop(1, 'rgba(160, 140, 255, 0)');
    c.fillStyle = aura; c.fillRect(x0 - u * 2.5, sy(e.y + 0.7) - u * 2.2, u * 4.6, u * 4.4);
    if (!quieto) {
      c.strokeStyle = TIZA; c.lineWidth = 1.6; c.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const k = (t * (1.6 + i * 0.23) + i * 0.37) % 1, ly2 = sy(e.y + 0.3 + i * 0.24), lx2 = x0 - u * (1.0 + k * 2.6);
        c.globalAlpha = imp * 0.55 * (1 - k);
        c.beginPath(); c.moveTo(lx2, ly2); c.lineTo(lx2 - u * (0.5 + imp * 0.9), ly2); c.stroke();
      }
      c.globalAlpha = 1;
    }
  }
  // (tanda 3) su manada: detrás de él y un poco más al fondo, un lobo más pequeño por cada semana seguida (corren con él, sin saltar)
  const TONOS = [['#D9D3F7', '#9C8FE0'], ['#C6BEEF', '#8E81D6'], ['#B3A9E6', '#8073CC'], ['#A095DD', '#7266C2']];
  for (let i = Math.min(4, seguidores); i >= 1; i--) {
    const fx = x0 - u * (0.8 * i + 0.3), k = 0.64 - i * 0.04, fy = suelo - u * 0.09 * i;
    c.fillStyle = 'rgba(6, 4, 24, .3)'; c.beginPath(); c.ellipse(fx - 1, fy + 3, u * 0.7 * k, 2.6, 0, 0, 6.3); c.fill();
    c.save(); c.translate(fx, fy); c.scale(u * k, -u * k);
    lobo(c, { saltos: 0, tropiezo: 0, vy: 0, agachado: 0 }, p.zancada + i * 1.9, { claro: TONOS[i - 1][0], sombra: TONOS[i - 1][1] });
    c.restore();
  }
  // (su sombra: alargada hacia el lado contrario a la luna, y más pequeña cuanto más alto va)
  const aulla = fin && p.tFin != null;
  // (al acabar la etapa, si iba por el aire, baja al suelo antes de aullar)
  const yL = aulla ? (quieto ? 0 : e.y * Math.max(0, 1 - (t - p.tFin) / 0.25)) : e.y;
  c.fillStyle = 'rgba(6, 4, 24, .45)';
  const encoge = 1 / (1 + yL * 0.5);
  c.beginPath(); c.ellipse(x0 - 2 - u * 0.3 * encoge, suelo + 4, u * 1.15 * encoge, 4.5 * encoge, 0, 0, 6.3); c.fill();
  // (se estira en el salto y se aplasta al caer; la cola y las orejas van detrás del cuerpo; parpadea; y, de noche o con frío, el contraluz)
  const forma = quieto || fin ? { sx: 1, sy: 1 } : estirar({ vy: e.vy, enAire, desdeCaer: p.tCae == null ? null : t - p.tCae });
  const kAulla = aulla ? (quieto ? 1 : Math.min(1, (t - p.tFin) / 0.5)) : 0;
  const vida = {
    cola: aulla ? 0.5 : quieto ? null : colaAlViento({ fase: p.zancada, vy: e.vy, enAire, racha: e.racha }),
    orejas: aulla ? 0.8 * kAulla : quieto ? 0 : enAire ? Math.max(-1, Math.min(1, e.vy / 14)) : Math.sin(p.zancada * 2) * 0.12,
    cabeza: aulla ? 0.78 * kAulla : quieto ? 0 : enAire ? Math.max(-0.12, Math.min(0.16, e.vy * 0.01)) : Math.sin(p.zancada) * 0.025,
    ojos: !quieto && (e.tropiezo > 0 || parpadea(t - p.t0, e.semilla % 97)) ? 'cerrados' : null,
    luz: deDia ? null : bajo ? '#FFD2B0' : '#FFFFFF',
    aulla,
  };
  c.save();
  c.translate(x0, sy(yL)); c.scale(u * forma.sx, -u * forma.sy);
  if (e.inmune > 0 && e.tropiezo === 0 && !quieto && !fin) c.globalAlpha = 0.55 + 0.45 * Math.sin(t * 24);
  lobo(c, aulla ? { saltos: 0, tropiezo: 0, vy: 0, agachado: 0 } : e, aulla ? 0 : p.zancada, skin, vida);
  c.restore();
  // (el aullido: tres ondas que salen del hocico hacia la luna)
  if (aulla && !quieto) {
    const hx = x0 + u * 0.95, hy = sy(yL + 1.75);
    c.strokeStyle = TIZA; c.lineWidth = 2; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const k = ((t - p.tFin) * 0.8 - i * 0.28) % 1.4;
      if (k < 0 || k > 1) continue;
      c.globalAlpha = (1 - k) * 0.75;
      c.beginPath(); c.arc(hx, hy, 8 + k * 34, -1.35, -0.35); c.stroke();
    }
    c.globalAlpha = 1;
  }
  // (el vaho: de noche o en la nieve, una nubecilla del hocico cada segundo y pico)
  if (!quieto && (noche || nevado) && !fin) {
    p.tVaho += dt;
    if (p.tVaho > 1.5) { p.tVaho = 0; p.vaho.push({ x: x0 + u * 1.42, y: sy(e.y + 0.94), t: 0.9 }); }
  }
  p.vaho = p.vaho.filter((q) => (q.t -= dt) > 0);
  for (const q of p.vaho) {
    q.x -= e.v * u * dt * 0.35; q.y -= 9 * dt;
    const k = 1 - q.t / 0.9;
    c.fillStyle = `rgba(241, 240, 246, ${0.2 * (1 - k)})`;
    c.beginPath(); c.arc(q.x, q.y, 3 + k * 8, 0, 6.3); c.fill();
  }
  // (tras un tropiezo, tres estrellitas le dan vueltas a la cabeza)
  if (!quieto && p.tTropiezo != null && t - p.tTropiezo < 0.9 && !fin) {
    const k = (t - p.tTropiezo) / 0.9;
    c.fillStyle = ORO; c.globalAlpha = 1 - k * k;
    for (let i = 0; i < 3; i++) { const a = t * 7 + i * 2.09; estrella4(c, x0 + u * 0.85 + Math.cos(a) * u * 0.5, sy(e.y + 1.7) + Math.sin(a) * u * 0.16, 3.4, a); c.fill(); }
    c.globalAlpha = 1;
  }
  // (tanda 1) el escudo: un aro dorado alrededor mientras le quede alguno, con un destello que lo recorre
  if (e.escudos > 0 && !fin) {
    c.globalAlpha = quieto ? 0.7 : 0.55 + 0.25 * Math.sin(t * 4);
    c.strokeStyle = ORO; c.lineWidth = 2.5;
    c.beginPath(); c.ellipse(x0, sy(e.y + 0.75), u * 1.25, u * 1.05, 0, 0, 6.3); c.stroke();
    if (!quieto) { const a = t * 2.4; c.globalAlpha = 1; c.fillStyle = '#FFF3C4'; estrella4(c, x0 + Math.cos(a) * u * 1.25, sy(e.y + 0.75) + Math.sin(a) * u * 1.05, 4, a); c.fill(); }
  }
  c.globalAlpha = 1;
  // (las estrellas cogidas vuelan al marcador, en arco y con su estela)
  if (meta) {
    p.volando = p.volando.filter((q) => (q.k += dt / 0.55) < 1);
    c.fillStyle = ORO;
    for (const q of p.volando) {
      for (let j = 0; j < 3; j++) {
        const k = Math.max(0, q.k - j * 0.07), s = k * k * (3 - 2 * k);
        const bx = (1 - s) * (1 - s) * q.x + 2 * (1 - s) * s * ((q.x + meta.x) / 2) + s * s * meta.x;
        const by = (1 - s) * (1 - s) * q.y + 2 * (1 - s) * s * (Math.min(q.y, meta.y) - 50) + s * s * meta.y;
        c.globalAlpha = (1 - j * 0.33) * (1 - q.k * 0.3);
        estrella4(c, bx, by, (7 - j * 1.6) * (1 - q.k * 0.45), q.k * 9); c.fill();
      }
    }
    c.globalAlpha = 1;
  } else p.volando.length = 0;

  // ---------- Lo que pasa por delante: hierbas altas y rocas oscuras, muy cerca, que dan fondo a la escena ----------
  if (h - suelo > 150 && !ligero) {
    const correD = (e.x * u * 1.55) % 1300, baseD = h + 6;
    c.fillStyle = DELANTE[paisaje] || DELANTE[0]; c.strokeStyle = c.fillStyle; c.globalAlpha = nevado ? 0.7 : 0.88; c.lineCap = 'round';
    for (const d of p.delante) for (let k = 0; k * 1300 - correD + d.x < w + 80; k++) {
      const dx = k * 1300 - correD + d.x;
      if (dx < -80) continue;
      if (d.roca) { c.beginPath(); c.moveTo(dx - 44 * d.s, baseD); c.quadraticCurveTo(dx - 30 * d.s, baseD - 52 * d.s, dx + 4 * d.s, baseD - 46 * d.s); c.quadraticCurveTo(dx + 40 * d.s, baseD - 38 * d.s, dx + 50 * d.s, baseD); c.closePath(); c.fill(); }
      else {
        const mece = quieto ? 0 : Math.sin(t * 1.4 + d.f) * 5 - Math.min(8, e.v * 0.5);
        c.lineWidth = 4 * d.s; c.beginPath();
        for (let n = -2; n <= 2; n++) { c.moveTo(dx + n * 7 * d.s, baseD); c.quadraticCurveTo(dx + n * 9 * d.s + mece * 0.4, baseD - 34 * d.s, dx + n * 15 * d.s + mece, baseD - (58 - Math.abs(n) * 9) * d.s); }
        c.stroke();
      }
    }
    c.globalAlpha = 1;
  }
  c.restore();
  return { u, suelo, x0 };
}

// (tanda 3) Un lobo suelto, parado en mitad de la zancada, para elegirlo en «Tu travesía»
export function pintarLobo(c, { w, h, skin = null, fase = 0.9 }) {
  c.clearRect(0, 0, w, h);
  const u = Math.min(w / 3.2, h / 1.75);
  c.save(); c.translate(w * 0.53, h * 0.94); c.scale(u, -u);
  lobo(c, { saltos: 0, tropiezo: 0, vy: 0, agachado: 0 }, fase, skin);
  c.restore();
}
