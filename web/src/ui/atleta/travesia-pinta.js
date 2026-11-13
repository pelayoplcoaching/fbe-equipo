// «La travesía»: cómo se pinta el juego en su lienzo (el juego en sí, en logica/travesia.js). Todo a mano, con formas
// planas en la paleta de la casa: sin imágenes que descargar. Va con el trozo del juego, que solo se pide al abrirlo.
import { azar, perfil, TROPIEZO } from '../../logica/travesia.js';

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
    estrellas: Array.from({ length: 70 }, () => ({ x: r(), y: r() * 0.62, t: 0.5 + r() * 1.4, f: r() * 6.28, v: 0.6 + r() * 1.6 })),
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
    zancada: 0,
    // (belleza) lo que da vida al cuadro: las matas del suelo, lo que pasa por delante, las luciérnagas, las rayas del
    // ritmo y el ciervo de lejos; y lo que va y viene (huellas, vaho, estrellas que vuelan al contador, aves, la fugaz)
    matas: Array.from({ length: 26 }, () => ({ x: r() * 900, tipo: r() < 0.62 ? 'hierba' : r() < 0.6 ? 'flor' : 'piedra', h: 5 + r() * 9, f: r() * 6.28, k: Math.floor(r() * 3) })),
    primer: Array.from({ length: 5 }, () => ({ x: r() * 1400, h: 0.22 + r() * 0.2, n: 4 + Math.floor(r() * 3), a: 30 + r() * 22 })),
    luciernagas: Array.from({ length: 9 }, () => ({ x: r(), y: r(), f: r() * 6.28, v: 0.7 + r() })),
    rayas: Array.from({ length: 7 }, () => ({ y: r(), x: r(), l: 30 + r() * 60 })),
    ciervo: 120 + r() * 420,
    huellas: [], vahos: [], vuelos: [], aves: null, proxAves: 70 + r() * 80, fugaz: null, proxFugaz: 3 + r() * 6,
    reloj: 0, tPrev: 0, vahoT: 0, pisada: 0, muelle: 0, tiembla: 0, camY: 0, camX: 0, cola: 0, aurora: 0, aullido: 0, llego: false,
    rnd: r, brumas: null,
  };
}

// (belleza) mezcla de dos colores `#RRGGBB` (f de 0 a 1); con f en 0 o en 1 devuelve el mismo color, tal cual
const RGB = new Map();
const rgb = (hex) => { let v = RGB.get(hex); if (!v) { const n = parseInt(hex.slice(1), 16); v = [n >> 16, (n >> 8) & 255, n & 255]; RGB.set(hex, v); } return v; };
const mezcla = (a, b, f) => {
  if (f <= 0) return a;
  if (f >= 1) return b;
  const p = rgb(a), q = rgb(b);
  return `rgb(${Math.round(p[0] + (q[0] - p[0]) * f)}, ${Math.round(p[1] + (q[1] - p[1]) * f)}, ${Math.round(p[2] + (q[2] - p[2]) * f)})`;
};
const entre = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

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
// (belleza) vida: lo que le da vida al suyo ({ cola: lo que se le retrasa la cola, oreja: de 0 a 1 hacia atrás, ojo:
// cerrado, pelo: de 0 a 1 al viento, borde: la luz de la luna en el lomo, giro: la voltereta al tropezar, aulla: de 0 a 1 })
function lobo(c, e, fase, tinta = null, vida = null) {
  const aire = e.saltos > 0;
  const cae = e.tropiezo > 0;
  const aulla = vida?.aulla || 0;
  // En carrera, las patas de delante y las de atrás van a contratiempo; en el aire, estiradas; al tropezar, recogidas
  const A = cae ? 0.25 : 0.62;
  const atras = aire ? -0.95 : Math.sin(fase) * A * (1 - aulla);
  const delante = aire ? 0.95 : Math.sin(fase + 2.6) * A * (1 - aulla) - aulla * 0.12;
  const bote = aire || cae || aulla ? 0 : Math.abs(Math.sin(fase)) * 0.05;
  const inclina = cae ? (vida?.giro != null ? -vida.giro : -0.42) : aire ? Math.max(-0.35, Math.min(0.4, e.vy * 0.028)) : aulla * 0.3;
  const bajo = e.agachado > 0 && !aire;   // (tanda 1) agachado: el cuerpo pegado al suelo
  const sombra = tinta?.sombra || '#B4A8EA', claro = tinta?.claro || TIZA;
  c.save();
  if (bajo) { c.translate(0, -0.02); c.scale(1.08, 0.58); }
  // (al tropezar gira sobre su centro; al aullar se alza sobre las patas de atrás)
  const ejeX = aulla ? -0.5 : 0, ejeY = cae && vida?.giro != null ? 0.75 : 0.52;
  c.translate(ejeX, ejeY + bote);
  c.rotate(inclina);
  c.translate(-ejeX, -ejeY);
  // (las de detrás, más oscuras)
  pata(c, -0.5, 0.54, atras + 0.5, aire ? 0.5 : -0.35, 0.29, sombra, 0.18);
  pata(c, 0.34, 0.54, delante - 0.45, aire ? -0.3 : 0.3, 0.29, sombra, 0.16);
  // La cola, que sube en el salto
  const cola = (aire ? 0.22 : Math.sin(fase * 0.5) * 0.05) + (vida?.cola || 0) + aulla * 0.12;
  c.fillStyle = claro; c.beginPath();
  c.moveTo(-0.6, 0.92); c.quadraticCurveTo(-1.06, 1.12 + cola, -1.5, 0.74 + cola * 1.6);
  c.quadraticCurveTo(-1.1, 0.5 + cola * 0.6, -0.62, 0.58); c.closePath(); c.fill();
  c.fillStyle = sombra; c.beginPath();
  c.moveTo(-1.5, 0.74 + cola * 1.6); c.quadraticCurveTo(-1.28, 0.9 + cola * 1.3, -1.12, 0.9 + cola); c.quadraticCurveTo(-1.2, 0.72 + cola, -1.5, 0.74 + cola * 1.6); c.fill();
  // La oreja de detrás
  const oreja = vida?.oreja || 0;   // (con el ritmo y en el aire, las orejas se le van hacia atrás)
  tri(c, 0.5, 1.18, 0.55 - oreja * 0.14, 1.46 - oreja * 0.05, 0.7, 1.22, sombra);
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
  // La cabeza: oreja, frente, hocico y mandíbula
  c.fillStyle = claro; c.beginPath();
  c.moveTo(0.44, 1.0); c.lineTo(0.62, 1.24); c.lineTo(0.7 - oreja * 0.16, 1.52 - oreja * 0.06); c.lineTo(0.84, 1.26); c.lineTo(0.96, 1.2);
  c.lineTo(1.3, 1.02); c.lineTo(1.38, 0.95); c.lineTo(1.28, 0.87); c.lineTo(0.94, 0.84); c.lineTo(0.72, 0.7); c.closePath(); c.fill();
  tri(c, 0.94, 0.84, 1.28, 0.87, 1.02, 0.94, sombra);
  c.fillStyle = MORADO_NOCHE; c.beginPath(); c.arc(1.345, 0.955, 0.04, 0, 6.3); c.fill();
  // (el ojo: parpadea de vez en cuando; al aullar, cerrado)
  if (vida?.ojo || aulla > 0.5) { c.strokeStyle = MORADO_NOCHE; c.lineWidth = 0.022; c.lineCap = 'round'; c.beginPath(); c.moveTo(0.955, 1.09); c.lineTo(1.025, 1.07); c.stroke(); }
  else { c.beginPath(); c.ellipse(0.99, 1.08, 0.036, 0.028, -0.3, 0, 6.3); c.fill(); }
  // (el pelo al viento, con el ritmo cogido: tres mechones en el lomo)
  if (vida?.pelo > 0.05) {
    const q = vida.pelo * 0.16, onda = Math.sin(fase * 1.7) * 0.02;
    for (const [mx, my] of [[-0.46, 0.99], [-0.08, 0.985], [0.3, 1.0]]) tri(c, mx, my - 0.03, mx + 0.16, my - 0.02, mx - q, my + q * 0.55 + onda, claro);
  }
  // (la luz de la luna, en el lomo y la nuca)
  if (vida?.borde) {
    c.strokeStyle = 'rgba(255, 255, 255, .6)'; c.lineWidth = 0.032; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-0.6, 0.955); c.bezierCurveTo(-0.3, 0.985, -0.1, 0.975, 0.18, 0.975); c.bezierCurveTo(0.42, 0.995, 0.5, 1.05, 0.61, 1.19); c.stroke();
  }
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

// amb (tanda 1): { fase, luna: { ilum, creciente }, clima, paisaje } (logica/travesia.js, ambiente); fantasma: los metros
// que llevaría a estas alturas su mejor ritmo (o null)
// (tanda 3) skin: los colores de su lobo; seguidores: cuántos lobos de su manada le siguen (0 a 4); corren: cuántos
// compañeros han corrido hoy (sus siluetas, a lo lejos); cielo: las constelaciones que lleva ({ puntos, lineas, cogidas, completa })
// (belleza) contador: dónde está el contador de estrellas (las cogidas vuelan hasta él); reloj y quedan: dónde está la
// cuenta del descanso y los segundos que le quedan (en los diez últimos, un marco que se vacía); final: la etapa ha acabado
// (el lobo aúlla a la luna)
export function pintar(c, e, p, { w, h, t, dt = 0, quieto = false, amb = null, fantasma = null, skin = null, seguidores = 0, corren = 0, cielo: constel = null, contador = null, reloj = null, quedan = null, final = false }) {
  const fase = amb?.fase || 'noche', paisaje = amb?.paisaje || 0, clima = amb?.clima || null;
  const deDia = fase === 'dia';
  // (belleza) el paisaje cambia cada 5 km: en los últimos 80 m antes del cambio, uno se va fundiendo con el siguiente
  const cruce = (e.km0 || 0) % 5000 + e.x;
  const fundido = entre((cruce - 4920) / 80);
  const peso = (n) => (paisaje === n ? 1 - fundido : (paisaje + 1) % 4 === n ? fundido : 0);
  const bosque = peso(1), nieve = peso(2), nevado = nieve > 0.5;
  const u = Math.max(22, Math.min(38, w / 13));          // px por metro
  const suelo = Math.round(h * 0.66);
  // (belleza) el tiempo de verdad entre dos cuadros (dt va a 0 con el juego parado) y la cámara: con el ritmo cogido se
  // adelanta (el lobo queda un poco más atrás y se ve más camino) y sube un poco con el salto
  const real = quieto || !p.tPrev ? 0 : Math.min(0.1, Math.max(0, t - p.tPrev));
  p.tPrev = t; p.reloj += dt;
  if (!quieto) {
    p.camX += (entre((e.v - 6.5) / 3.5) - p.camX) * Math.min(1, dt * 1.5);
    p.camY += (e.y * u * 0.12 - p.camY) * Math.min(1, dt * 9);
    p.muelle *= Math.exp(-dt * 11);
    p.tiembla = Math.max(0, p.tiembla - dt);
  }
  const x0 = w * (0.2 - 0.035 * p.camX);                 // dónde va el lobo
  const sx = (x) => x0 + (x - e.x) * u;
  const sy = (y) => suelo - y * u;
  const [c0, c1, c2] = CIELOS[fase] || CIELOS.noche;
  const tiembla = p.tiembla > 0 ? p.tiembla / 0.28 : 0;
  c.save();
  c.translate(tiembla ? Math.sin(t * 71) * 3 * tiembla : 0, p.camY + (tiembla ? Math.cos(t * 83) * 2.5 * tiembla : 0));

  // El cielo y la luna
  const cielo = c.createLinearGradient(0, 0, 0, suelo);
  cielo.addColorStop(0, c0); cielo.addColorStop(0.6, c1); cielo.addColorStop(1, c2);
  c.fillStyle = cielo; c.fillRect(-6, -30, w + 12, suelo + 30);
  const veEstrellas = fase === 'noche' ? 1 : deDia ? 0 : 0.35;
  for (const s of p.estrellas) {
    if (!veEstrellas) break;
    const brillo = (quieto ? 0.7 : 0.45 + 0.4 * Math.sin(t * s.v + s.f)) * veEstrellas;
    c.globalAlpha = brillo; c.fillStyle = TIZA;
    c.fillRect(((s.x * w - e.x * 0.6) % w + w) % w, s.y * suelo, s.t, s.t);
  }
  c.globalAlpha = 1;
  // (belleza) la aurora: en la nieve, de noche; y desde que cruza un río (el de cada kilómetro) hasta el final de la etapa
  if (!quieto) p.aurora += (((nevado && fase === 'noche') || (e.rios > 0 && veEstrellas > 0) ? 1 : 0) - p.aurora) * Math.min(1, dt * 0.8);
  if (p.aurora > 0.02) {
    const velo = c.createLinearGradient(0, suelo * 0.08, 0, suelo * 0.5);
    velo.addColorStop(0, 'rgba(110, 240, 190, 0)'); velo.addColorStop(0.3, 'rgba(110, 240, 190, .5)'); velo.addColorStop(1, 'rgba(160, 140, 255, 0)');
    c.fillStyle = velo;
    for (let b = 0; b < 3; b++) {
      c.globalAlpha = p.aurora * (0.32 - b * 0.07) * (veEstrellas || 0.5);
      c.beginPath();
      for (let i = 0; i <= 10; i++) { const ax = (i / 10) * w; c.lineTo(ax, suelo * (0.1 + b * 0.05) + Math.sin(ax * 0.011 + t * 0.35 + b * 2.1) * 16); }
      for (let i = 10; i >= 0; i--) { const ax = (i / 10) * w; c.lineTo(ax, suelo * (0.36 + b * 0.05) + Math.sin(ax * 0.008 - t * 0.25 + b) * 22); }
      c.closePath(); c.fill();
    }
    c.globalAlpha = 1;
  }
  // (belleza) de vez en cuando, una estrella fugaz
  if (veEstrellas && !quieto) {
    if (!p.fugaz && p.reloj > p.proxFugaz) p.fugaz = { x: w * (0.1 + p.rnd() * 0.45), y: suelo * (0.06 + p.rnd() * 0.2), t: 0 };
    if (p.fugaz) {
      const fz = p.fugaz; fz.t += dt;
      const k = fz.t / 0.7, fx = fz.x + fz.t * 280, fy = fz.y + fz.t * 96;
      c.strokeStyle = TIZA; c.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        c.globalAlpha = veEstrellas * Math.sin(Math.min(1, k) * Math.PI) * (0.8 - i * 0.2); c.lineWidth = 2 - i * 0.4;
        c.beginPath(); c.moveTo(fx - i * 11, fy - i * 3.8); c.lineTo(fx - (i + 1) * 11, fy - (i + 1) * 3.8); c.stroke();
      }
      c.globalAlpha = 1;
      if (k >= 1) { p.fugaz = null; p.proxFugaz = p.reloj + 8 + p.rnd() * 10; }
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
  const lx = w * 0.74, ly = Math.max(110, h * 0.23), lr = Math.max(30, Math.min(56, w * 0.11));
  const halo = c.createRadialGradient(lx, ly, lr * 0.6, lx, ly, lr * 3.4);
  halo.addColorStop(0, 'rgba(160, 140, 255, .38)'); halo.addColorStop(1, 'rgba(160, 140, 255, 0)');
  c.fillStyle = halo; c.fillRect(lx - lr * 3.5, ly - lr * 3.5, lr * 7, lr * 7);
  if (deDia) {
    // (de día, el sol)
    c.fillStyle = ORO; c.beginPath(); c.arc(lx, ly, lr * 0.9, 0, 6.3); c.fill();
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

  // Las cordilleras: cada pico, con su cara a la luna más clara y, las lejanas, su nieve
  for (const capa of p.capas) {
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
      }
    }
    // (belleza) la bruma: al pie de cada cordillera, el color del horizonte; cuanto más lejos, más velada
    const nB = p.capas.indexOf(capa);
    // (se pinta una vez en una tira de 1 px y luego se estira: un degradado grande en cada cuadro sale caro)
    if (!p.brumas || p.brumas.fase !== fase) {
      const tira = typeof document !== 'undefined' ? document.createElement('canvas') : null;
      if (tira) {
        tira.width = 1; tira.height = 64;
        const k = tira.getContext('2d'), [r1, g1, b1] = rgb(c2), g = k.createLinearGradient(0, 0, 0, 64);
        g.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, 0)`); g.addColorStop(1, `rgb(${r1}, ${g1}, ${b1})`);
        k.fillStyle = g; k.fillRect(0, 0, 1, 64);
      }
      p.brumas = { fase, tira };
    }
    if (p.brumas.tira) {
      const alto = suelo * [0.3, 0.22, 0.14][nB];
      c.globalAlpha = [0.62, 0.42, 0.26][nB];
      c.drawImage(p.brumas.tira, -6, suelo - alto, w + 12, alto);
    }
    c.globalAlpha = 1;
  }
  // (belleza) un ciervo, a lo lejos, quieto en la loma (levanta la cabeza cuando el lobo pasa)
  {
    const cx = (((p.ciervo - e.x * u * 0.2) % 1900) + 1900) % 1900 - 60;
    if (cx < w + 40) {
      const k = u * 0.27, alza = cx < w * 0.55 ? 1 : 0.55;
      c.save(); c.globalAlpha = 0.7; c.translate(cx, suelo); c.scale(k, -k); c.fillStyle = '#1C144F'; c.strokeStyle = '#1C144F'; c.lineCap = 'round';
      c.beginPath(); c.ellipse(0, 0.95, 0.62, 0.3, 0, 0, 6.3); c.fill();
      c.lineWidth = 0.1; for (const lx of [-0.45, -0.3, 0.3, 0.45]) { c.beginPath(); c.moveTo(lx, 0.9); c.lineTo(lx * 1.05, 0); c.stroke(); }
      c.lineWidth = 0.2; c.beginPath(); c.moveTo(-0.5, 1.05); c.lineTo(-0.8, 1.2 + 0.5 * alza); c.stroke();
      c.beginPath(); c.ellipse(-0.92, 1.24 + 0.5 * alza, 0.2, 0.11, 0.3, 0, 6.3); c.fill();
      c.lineWidth = 0.05;
      for (const d of [-1, 1]) { c.beginPath(); c.moveTo(-0.82, 1.32 + 0.5 * alza); c.lineTo(-0.82 + d * 0.16, 1.72 + 0.5 * alza); c.lineTo(-0.82 + d * 0.34, 1.86 + 0.5 * alza); c.moveTo(-0.82 + d * 0.16, 1.72 + 0.5 * alza); c.lineTo(-0.82 + d * 0.1, 1.96 + 0.5 * alza); c.stroke(); }
      c.restore();
    }
  }

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
  // (tanda 1) el bosque: una fila de pinos delante de las cordilleras
  if (bosque > 0) {
    const corre = (e.x * u * 0.32) % 800;
    c.globalAlpha = bosque;
    for (const pi of p.pinos) for (let k = 0; k * 800 - corre + pi.x < w + 40; k++) {
      const px = k * 800 - corre + pi.x, ph = pi.h * suelo;
      if (px < -40) continue;
      for (let n = 0; n < 3; n++) {
        const medio = ph * (0.34 - n * 0.07), base = suelo - ph * n * 0.26, punta = suelo - ph * (0.5 + n * 0.25);
        tri(c, px - medio, base, px, punta, px + medio, base, n % 2 ? '#1F4B4A' : '#173B40');
        // (belleza) la luz de la luna, por el lado que le da
        if (!deDia) tri(c, px, punta, px + medio, base, px + medio * 0.55, base, '#2C6A66');
      }
    }
    c.globalAlpha = 1;
  }
  // (la luz de la hora, por encima del paisaje)
  if (fase !== 'noche') { c.fillStyle = deDia ? 'rgba(150, 175, 255, .2)' : 'rgba(255, 150, 110, .1)'; c.fillRect(-6, -30, w + 12, suelo + 30); }

  // El suelo
  const tierra = c.createLinearGradient(0, suelo, 0, h);
  tierra.addColorStop(0, mezcla(mezcla('#1A1247', '#14263A', bosque), '#CFCAF2', nieve)); tierra.addColorStop(1, mezcla('#0E0930', '#8F86CF', nieve));
  c.fillStyle = tierra; c.fillRect(-6, suelo, w + 12, h - suelo + 30);
  c.fillStyle = mezcla(LAVANDA, '#FFFFFF', nieve); c.globalAlpha = 0.85; c.fillRect(-6, suelo, w + 12, 2.5); c.globalAlpha = 1;
  c.fillStyle = 'rgba(160, 140, 255, .16)';
  const corre = (e.x * u) % 900;
  for (const g of p.hierbas) for (let k = 0; k * 900 - corre + g.x < w; k++) { const gx = k * 900 - corre + g.x; if (gx + g.w > 0) c.fillRect(gx, suelo + g.y, g.w, 2); }
  // (belleza) el suelo, con vida: hierba que se mece, flores y piedras (en la nieve, montones de nieve), al borde del camino
  {
    const VERDE = mezcla(mezcla('#6B5BD0', '#2FA36B', bosque), '#F1F0F6', nieve), FLORES = ['#F2C230', '#FF9BC2', '#A08CFF'];
    for (const m of p.matas) for (let k = 0; k * 900 - corre + m.x < w + 12; k++) {
      const mx = k * 900 - corre + m.x;
      if (mx < -12) continue;
      const mece = quieto ? 0 : Math.sin(t * 1.7 + m.f) * 2.2;
      if (m.tipo === 'piedra' || nevado) {
        c.fillStyle = nevado ? '#FFFFFF' : '#4A3F8C'; c.globalAlpha = nevado ? 0.8 : 0.9;
        c.beginPath(); c.ellipse(mx, suelo + 1, m.h * (nevado ? 1.1 : 0.55), m.h * 0.42, 0, Math.PI, 0); c.fill(); c.globalAlpha = 1;
        continue;
      }
      c.strokeStyle = VERDE; c.lineWidth = 1.6; c.lineCap = 'round'; c.globalAlpha = 0.85;
      for (const d of [-3, 0, 3]) { c.beginPath(); c.moveTo(mx + d, suelo + 1); c.quadraticCurveTo(mx + d * 1.3, suelo - m.h * 0.55, mx + d * 1.8 + mece, suelo - m.h * (d ? 0.8 : 1)); c.stroke(); }
      if (m.tipo === 'flor') { c.fillStyle = FLORES[m.k]; c.beginPath(); c.arc(mx + mece, suelo - m.h - 1, 2.3, 0, 6.3); c.fill(); }
      c.globalAlpha = 1;
    }
  }
  // (belleza) las huellas que va dejando: se quedan atrás y se borran (en la nieve, más marcadas)
  {
    const paso = Math.floor(p.zancada / Math.PI);
    if (paso !== p.pisada) { p.pisada = paso; if (e.saltos === 0 && !quieto) { p.huellas.push(e.x - 0.42); if (p.huellas.length > 16) p.huellas.shift(); } }
    c.fillStyle = mezcla('#8C78FF', '#5F55A8', nieve);
    for (const hx of p.huellas) {
      const lejos = (e.x - hx) / 11;
      if (lejos >= 1) continue;
      c.globalAlpha = (1 - lejos) * (0.3 + 0.45 * nieve);
      c.beginPath(); c.ellipse(sx(hx), suelo + 7, 3.4, 1.7, 0, 0, 6.3); c.fill();
    }
    c.globalAlpha = 1;
  }

  // Lo que hay que saltar
  for (const o of e.obstaculos) {
    const izq = sx(o.x - o.w / 2), der = sx(o.x + o.w / 2);
    if (der < -4 || izq > w + 4) continue;
    if (o.tipo === 'rio') {
      // (el río: agua bajo el nivel del suelo, con dos destellos)
      const agua = c.createLinearGradient(0, suelo, 0, suelo + 46);
      agua.addColorStop(0, '#6E86E0'); agua.addColorStop(1, '#2B2C8F');
      c.fillStyle = agua; c.fillRect(izq, suelo - 1, der - izq, 48);
      c.fillStyle = 'rgba(241, 240, 246, .55)';
      const ola = quieto ? 0 : Math.sin(t * 2.4) * 5;
      c.fillRect(izq + (der - izq) * 0.18 + ola, suelo + 9, (der - izq) * 0.26, 2.5); c.fillRect(izq + (der - izq) * 0.52 - ola, suelo + 22, (der - izq) * 0.3, 2.5);
      // (belleza) el agua refleja la luna (una columna de luz que tiembla) y al lobo cuando pasa por encima
      if (!deDia) {
        const mx = (izq + der) / 2 + (der - izq) * 0.22;
        c.fillStyle = 'rgba(241, 240, 246, .5)';
        for (let i = 0; i < 4; i++) { const an = (der - izq) * (0.16 - i * 0.03); c.fillRect(mx - an / 2 + (quieto ? 0 : Math.sin(t * 3 + i * 1.3) * 3), suelo + 5 + i * 8, an, 2.2); }
      }
      if (Math.abs(e.x - o.x) < o.w / 2 + 1.2) {
        c.save(); c.beginPath(); c.rect(izq, suelo, der - izq, 46); c.clip();
        c.globalAlpha = 0.2; c.translate(x0, suelo + 3 + e.y * u * 0.45); c.scale(u, u * 0.7);
        lobo(c, e, p.zancada, skin);
        c.restore();
      }
      continue;
    }
    if (o.tipo === 'rama') {
      // (la rama: cuelga de un tronco que sube hasta fuera de la pantalla)
      const yr = sy(o.h), g = u * 0.34;
      c.fillStyle = '#3A2A5C'; c.fillRect(der - u * 0.2, 0, u * 0.3, yr - g + 2);
      c.fillStyle = '#5B4590'; c.beginPath(); c.roundRect(izq - u * 0.25, yr - g, der - izq + u * 0.45, g, g / 2); c.fill();
      c.fillStyle = paisaje === 1 ? '#2FA36B' : LAVANDA;
      for (const d of [0.15, 0.5, 0.82]) { c.beginPath(); c.ellipse(izq + (der - izq) * d, yr - g * 1.15, u * 0.28, u * 0.16, -0.4, 0, 6.3); c.fill(); }
      // (belleza) un búho en la rama: parpadea
      {
        const bx = izq + (der - izq) * 0.42, by = yr - g - u * 0.3, guino = !quieto && (t * 0.37 + o.x) % 3.1 < 0.14;
        c.fillStyle = '#2A1F4A'; c.beginPath(); c.ellipse(bx, by, u * 0.2, u * 0.3, 0, 0, 6.3); c.fill();
        tri(c, bx - u * 0.19, by - u * 0.2, bx - u * 0.13, by - u * 0.4, bx - u * 0.04, by - u * 0.24, '#2A1F4A');
        tri(c, bx + u * 0.19, by - u * 0.2, bx + u * 0.13, by - u * 0.4, bx + u * 0.04, by - u * 0.24, '#2A1F4A');
        c.fillStyle = ORO;
        for (const d of [-1, 1]) { if (guino) c.fillRect(bx + d * u * 0.08 - u * 0.045, by - u * 0.1, u * 0.09, 1.2); else { c.beginPath(); c.arc(bx + d * u * 0.08, by - u * 0.1, u * 0.048, 0, 6.3); c.fill(); } }
      }
      continue;
    }
    const cx = sx(o.x), arriba = sy(o.h), llano = ((o.w / 2) * o.plano) * u;
    const roca = o.tipo === 'roca';
    // (belleza) su sombra en el suelo
    c.fillStyle = 'rgba(6, 4, 24, .32)'; c.beginPath(); c.ellipse(cx + (der - izq) * 0.12, suelo + 3, (der - izq) * 0.62, 3.6, 0, 0, 6.3); c.fill();
    c.fillStyle = roca ? '#6F64AE' : VIOLETA;
    c.beginPath(); c.moveTo(izq, suelo); c.lineTo(cx - llano, arriba); c.lineTo(cx + llano * 0.2, arriba); c.lineTo(cx + llano * 0.5, suelo); c.closePath(); c.fill();
    c.fillStyle = roca ? '#A69CDB' : '#8C78FF';
    c.beginPath(); c.moveTo(cx + llano * 0.2, arriba); c.lineTo(cx + llano, arriba); c.lineTo(der, suelo); c.lineTo(cx + llano * 0.5, suelo); c.closePath(); c.fill();
    if (roca && (bosque > 0.5 || nevado)) {
      // (belleza) la roca, con su musgo en el bosque y su nieve en la nieve
      c.fillStyle = nevado ? TIZA : '#2FA36B';
      c.beginPath(); c.moveTo(cx - llano - 2, arriba + 1); c.lineTo(cx + llano + 2, arriba + 1); c.lineTo(cx + llano + (der - cx - llano) * 0.4, arriba + (suelo - arriba) * 0.36); c.lineTo(cx + llano * 0.3, arriba + 5); c.lineTo(cx - llano * 0.6, arriba + 7); c.lineTo(cx - llano - (cx - llano - izq) * 0.4, arriba + (suelo - arriba) * 0.36); c.closePath(); c.fill();
    }
    if (roca) {
      // (y una grieta)
      c.strokeStyle = 'rgba(30, 21, 72, .45)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx - llano * 0.3, arriba + 3); c.lineTo(cx - llano * 0.05, arriba + (suelo - arriba) * 0.45); c.lineTo(cx - llano * 0.4, suelo - 3); c.stroke();
    }
    if (o.tipo === 'monte' && !o.pasado) {
      // (belleza) el monte pide doble salto: un brillo suave en su silueta lo avisa
      c.strokeStyle = LAVANDA; c.lineWidth = 2.5; c.lineJoin = 'round'; c.globalAlpha = quieto ? 0.55 : 0.4 + 0.3 * Math.sin(t * 3.4);
      c.beginPath(); c.moveTo(izq, suelo); c.lineTo(cx - llano, arriba); c.lineTo(cx + llano, arriba); c.lineTo(der, suelo); c.stroke();
      c.globalAlpha = 1;
    }
    if (!roca) {
      // (la nieve de la cima: hasta donde la silueta baja un 30 %)
      const baja = o.h * 0.3, yN = sy(o.h - baja), anchoN = llano + ((o.w / 2) * (1 - o.plano) * u * 0.3);
      c.fillStyle = TIZA;
      c.beginPath(); c.moveTo(cx - llano, arriba); c.lineTo(cx + llano, arriba); c.lineTo(cx + anchoN, yN); c.lineTo(cx + anchoN * 0.35, yN - 4); c.lineTo(cx, yN + 3); c.lineTo(cx - anchoN * 0.4, yN - 4); c.lineTo(cx - anchoN, yN); c.closePath(); c.fill();
    }
  }

  // Las estrellas que se cogen
  for (const s of e.estrellas) {
    if (s.cogida) continue;
    const x = sx(s.x); if (x < -20 || x > w + 20) continue;
    const y = sy(s.y) + (quieto ? 0 : Math.sin(t * 3 + s.x) * 3);
    const luz = c.createRadialGradient(x, y, 1, x, y, 18);
    luz.addColorStop(0, 'rgba(242, 194, 48, .5)'); luz.addColorStop(1, 'rgba(242, 194, 48, 0)');
    c.fillStyle = luz; c.fillRect(x - 18, y - 18, 36, 36);
    c.fillStyle = ORO; estrella4(c, x, y, quieto ? 9 : 9 + Math.sin(t * 5 + s.x * 2) * 1.3, quieto ? 0 : t * 0.8); c.fill();
  }

  // Sucesos del juego desde el último cuadro: chispas al coger una estrella, polvo al caer o tropezar
  for (const s of e.sucesos) {
    if (quieto) break;
    const n = s === 'estrella' || s === 'escudo' ? 7 : s === 'cae' ? 4 : s === 'tropiezo' ? 8 : s === 'rio' ? 10 : 0;
    for (let i = 0; i < n; i++) {
      const a = s === 'estrella' || s === 'escudo' || s === 'rio' ? (i / n) * 6.28 : Math.PI + (i / n - 0.5) * 1.6;
      p.chispas.push({ x: x0 + (s === 'estrella' ? 10 : -8), y: s === 'estrella' ? sy(e.y + 0.8) : suelo - 2, vx: Math.cos(a) * (60 + i * 12), vy: Math.sin(a) * (60 + i * 9) - (s === 'estrella' ? 0 : 30), t: 0.5, oro: s === 'estrella' || s === 'escudo' || s === 'rio' });
    }
    // (belleza) el lobo se estira al despegar y se aplasta al caer; al tropezar, la pantalla tiembla un instante; la
    // estrella cogida vuela a su contador; y el río salpica
    if (s === 'salto' || s === 'doble') p.muelle = 0.2;
    else if (s === 'cae') { p.muelle = -0.24; p.huellas.push(e.x - 0.5, e.x + 0.35); p.huellas = p.huellas.slice(-16); }
    else if (s === 'tropiezo') p.tiembla = 0.28;
    else if (s === 'estrella') p.vuelos.push({ x: x0 + 10, y: sy(e.y + 0.8) + p.camY, t: 0 });
    else if (s === 'rio') for (let i = 0; i < 9; i++) p.chispas.push({ x: x0 - u * (0.6 + i * 0.12), y: suelo + 2, vx: -30 + i * 14, vy: -(110 + (i % 3) * 45), t: 0.6, color: '#9FB4FF' });
  }
  e.sucesos.length = 0;
  p.chispas = p.chispas.filter((q) => (q.t -= dt) > 0);
  for (const q of p.chispas) {
    q.x += q.vx * dt - e.v * u * dt * 0.6; q.y += q.vy * dt; q.vy += 220 * dt;
    c.globalAlpha = Math.min(1, q.t * 2.4); c.fillStyle = q.color || (q.oro ? ORO : LAVANDA);
    c.beginPath(); c.arc(q.x, Math.min(q.y, suelo - 1), q.oro ? 2.4 : 3, 0, 6.3); c.fill();
  }
  c.globalAlpha = 1;

  // (belleza) unos pájaros posados al borde del camino: levantan el vuelo cuando el lobo llega
  if (!quieto) {
    if (!p.aves && e.x + (w - x0) / u > p.proxAves) p.aves = { x: p.proxAves, t: -1 };
    if (p.aves) {
      const av = p.aves, ax = sx(av.x);
      if (av.t < 0 && ax < x0 + u * 6.5) av.t = 0;
      if (av.t >= 0) av.t += dt;
      c.strokeStyle = deDia ? '#1E1548' : '#0B0726'; c.fillStyle = c.strokeStyle; c.lineWidth = 1.8; c.lineCap = 'round'; c.lineJoin = 'round';
      let fuera = true;
      for (let i = 0; i < 3; i++) {
        if (av.t < 0) { c.beginPath(); c.ellipse(ax + i * 13, suelo + 11 + (i % 2) * 5, 3.6, 2.4, 0, 0, 6.3); c.fill(); fuera = ax > -60; continue; }
        const bx = ax + i * 13 + av.t * (95 + i * 22), by = suelo + 8 - av.t * (120 + i * 30) + av.t * av.t * 18, ala = Math.sin(av.t * 19 + i * 2) * 5;
        if (by > -12 && bx < w + 20) { fuera = false; c.beginPath(); c.moveTo(bx - 6, by - ala); c.lineTo(bx, by); c.lineTo(bx + 6, by - ala); c.stroke(); }
      }
      if (fuera || ax < -80) { p.aves = null; p.proxAves = e.x + (w - x0) / u + 60 + p.rnd() * 140; }
    }
  }
  // (belleza) de noche y al caer la tarde, luciérnagas cerca del suelo (en la nieve, no)
  if ((fase === 'noche' || fase === 'ocaso') && nieve < 0.5 && !quieto) {
    c.fillStyle = '#E8F59A';
    for (const l of p.luciernagas) {
      const lz = Math.sin(t * 1.3 * l.v + l.f);
      if (lz <= 0) continue;
      const lx = (((l.x * (w + 60) - e.x * u * 0.55) % (w + 60)) + (w + 60)) % (w + 60) - 30, ly = suelo - 12 - l.y * suelo * 0.2 + Math.sin(t * l.v + l.f) * 7;
      c.globalAlpha = lz * 0.13 * (1 - nieve * 2); c.beginPath(); c.arc(lx, ly, 5, 0, 6.3); c.fill();
      c.globalAlpha = lz * 0.85 * (1 - nieve * 2); c.beginPath(); c.arc(lx, ly, 1.6, 0, 6.3); c.fill();
    }
    c.globalAlpha = 1;
  }

  // (tanda 1) lo que cae: lluvia en rayas, nieve en copos, niebla en bandas
  if (clima && !quieto) {
    if (clima === 'niebla') {
      c.fillStyle = 'rgba(241, 240, 246, .1)';
      for (let i = 0; i < 3; i++) c.fillRect(0, suelo * (0.5 + i * 0.14) + Math.sin(t * 0.4 + i) * 6, w, 16);
    } else {
      const nieve = clima === 'nieve';
      c.strokeStyle = 'rgba(200, 210, 255, .55)'; c.fillStyle = 'rgba(255, 255, 255, .85)'; c.lineWidth = 1.2;
      for (const g of p.gotas) {
        const gy = ((g.y + t * g.v * (nieve ? 0.09 : 0.75)) % 1) * suelo;
        const gx = (((g.x * w - e.x * (nieve ? 3 : 8) + (nieve ? Math.sin(t + g.f) * 10 : -gy * 0.25)) % w) + w) % w;
        if (nieve) { c.beginPath(); c.arc(gx, gy, 1.2 + g.v, 0, 6.3); c.fill(); } else { c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 3, gy + 11); c.stroke(); }
      }
    }
  }
  // (tanda 1) su fantasma: el lobo de su mejor ritmo, traslúcido, por delante o por detrás
  if (fantasma != null) {
    const fx = sx(fantasma);
    if (fx > -u * 2 && fx < w + u * 2) {
      c.save(); c.globalAlpha = 0.28; c.translate(fx, suelo); c.scale(u, -u);
      lobo(c, { saltos: 0, tropiezo: 0, vy: 0, agachado: 0 }, p.zancada + 1.3);
      c.restore();
    }
  }

  // (belleza) con el ritmo cogido, el aire se ve: rayas que pasan
  const ritmo = e.calma ? 0 : entre((e.v - 8.2) / 1.6);
  if (ritmo > 0 && !quieto) {
    c.strokeStyle = TIZA; c.lineWidth = 1.5; c.lineCap = 'round';
    for (const ry of p.rayas) {
      const rx = w + ry.l - ((t * 620 * (0.7 + ry.x) + ry.x * w * 3) % (w + ry.l * 2));
      c.globalAlpha = 0.16 * ritmo; c.beginPath(); c.moveTo(rx, suelo * (0.3 + ry.y * 0.62)); c.lineTo(rx + ry.l, suelo * (0.3 + ry.y * 0.62)); c.stroke();
    }
    c.globalAlpha = 1;
  }

  // El lobo y su sombra
  p.zancada += dt * e.v * (e.calma ? 3.2 : 1.9);
  // (belleza) lo que le da vida: la cola se le retrasa en el salto, las orejas y el pelo se le van atrás con el ritmo,
  // parpadea, y al acabar la etapa aúlla a la luna
  if (!quieto) p.cola += (entre(-e.vy * 0.012, -0.16, 0.16) - p.cola) * Math.min(1, dt * 7);
  if (final) p.aullido = Math.min(1, p.aullido + real * 2.2);
  const vida = quieto ? { borde: !deDia, aulla: final ? 1 : 0 } : {
    cola: p.cola, oreja: Math.max(ritmo * 0.8, e.saltos > 0 ? 0.6 : 0), ojo: (t * 0.9) % 4.2 < 0.13, pelo: ritmo, borde: !deDia,
    giro: e.tropiezo > 0 ? (1 - e.tropiezo / TROPIEZO) * Math.PI * 2 : null, aulla: p.aullido,
  };
  // (tanda 3) su manada: detrás de él y un poco más al fondo, un lobo más pequeño por cada semana seguida (corren con él, sin saltar)
  const TONOS = [['#D9D3F7', '#9C8FE0'], ['#C6BEEF', '#8E81D6'], ['#B3A9E6', '#8073CC'], ['#A095DD', '#7266C2']];
  for (let i = Math.min(4, seguidores); i >= 1; i--) {
    const fx = x0 - u * (0.8 * i + 0.3), k = 0.64 - i * 0.04, fy = suelo - u * 0.09 * i;
    c.fillStyle = 'rgba(6, 4, 24, .3)'; c.beginPath(); c.ellipse(fx - 1, fy + 3, u * 0.7 * k, 2.6, 0, 0, 6.3); c.fill();
    c.save(); c.translate(fx, fy); c.scale(u * k, -u * k);
    lobo(c, { saltos: 0, tropiezo: 0, vy: 0, agachado: 0 }, p.zancada + i * 1.9, { claro: TONOS[i - 1][0], sombra: TONOS[i - 1][1] });
    c.restore();
  }
  c.fillStyle = 'rgba(6, 4, 24, .45)';
  const encoge = 1 / (1 + e.y * 0.5);
  c.beginPath(); c.ellipse(x0 - 2, suelo + 4, u * 0.95 * encoge, 4.5 * encoge, 0, 0, 6.3); c.fill();
  c.save();
  // (belleza) la voltereta del tropiezo lo levanta un palmo; y se estira o se aplasta sobre sus patas
  const brinco = !quieto && e.tropiezo > 0 ? Math.sin((1 - e.tropiezo / TROPIEZO) * Math.PI) * 0.55 : 0;
  c.translate(x0, sy(e.y + brinco)); c.scale(u * (1 - p.muelle * 0.55), -u * (1 + p.muelle));
  if (e.inmune > 0 && e.tropiezo === 0 && !quieto) c.globalAlpha = 0.55 + 0.45 * Math.sin(t * 24);
  lobo(c, final ? { saltos: 0, tropiezo: 0, vy: 0, agachado: 0 } : e, p.zancada, skin, vida);
  c.restore();
  // (belleza) el vaho, de noche o con frío: una nubecilla cada poco, que se queda atrás
  if (!quieto) {
    if (!deDia || nevado || clima === 'nieve') { p.vahoT += dt; if (p.vahoT > 1.25 && e.tropiezo === 0) { p.vahoT = 0; p.vahos.push({ x: x0 + u * 1.45, y: sy(e.y + 0.93), r: 3, t: 0.9 }); } }
    p.vahos = p.vahos.filter((v) => (v.t -= dt) > 0);
    c.fillStyle = TIZA;
    for (const v of p.vahos) { v.x -= e.v * u * dt * 0.45; v.y -= 9 * dt; v.r += 11 * dt; c.globalAlpha = (v.t / 0.9) * 0.26; c.beginPath(); c.arc(v.x, v.y, v.r, 0, 6.3); c.fill(); }
    c.globalAlpha = 1;
  }
  // (belleza) el aullido: tres ondas que salen del hocico hacia la luna
  if (final && p.aullido > 0.6 && !quieto) {
    c.strokeStyle = TIZA; c.lineWidth = 2; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.9 + i / 3) % 1);
      c.globalAlpha = (1 - k) * 0.6; c.beginPath(); c.arc(x0 + u * 1.25, sy(1.45), u * (0.35 + k * 1.1), -1.25, -0.2); c.stroke();
    }
    c.globalAlpha = 1;
  }
  // (tanda 1) el escudo: un aro dorado alrededor mientras le quede alguno
  if (e.escudos > 0) {
    c.globalAlpha = quieto ? 0.7 : 0.55 + 0.25 * Math.sin(t * 4);
    c.strokeStyle = ORO; c.lineWidth = 2.5;
    c.beginPath(); c.ellipse(x0, sy(e.y + 0.75), u * 1.25, u * 1.05, 0, 0, 6.3); c.stroke();
  }
  c.globalAlpha = 1;
  // (belleza) el primer plano: hierbas grandes y oscuras que pasan deprisa por debajo del camino (nunca tapan el juego)
  {
    const banda = h - suelo, corre2 = (e.x * u * 1.7) % 1400;
    c.fillStyle = mezcla('#06041A', '#5F55A8', nieve); c.globalAlpha = 0.72;
    for (const m of p.primer) for (let k = 0; k * 1400 - corre2 + m.x < w + 60; k++) {
      const mx = k * 1400 - corre2 + m.x;
      if (mx < -60) continue;
      const alto = Math.min(banda - 16, banda * m.h), mece = quieto ? 0 : Math.sin(t * 1.3 + m.x) * 5;
      // (cada mata, un abanico de hojas anchas y curvas que salen del borde de abajo)
      for (let i = 0; i < m.n; i++) {
        const abre = (i - (m.n - 1) / 2) / m.n, bx = mx + abre * m.a * 0.5, px = mx + abre * m.a * 2.6 + mece, py = h - alto * (1 - Math.abs(abre) * 0.7);
        c.beginPath(); c.moveTo(bx - m.a * 0.2, h + 30); c.quadraticCurveTo(bx - m.a * 0.1 + abre * m.a, (h + py) / 2, px, py); c.quadraticCurveTo(bx + m.a * 0.25 + abre * m.a, (h + py) / 2, bx + m.a * 0.2, h + 30); c.closePath(); c.fill();
      }
    }
    c.globalAlpha = 1;
  }
  c.restore();

  // (belleza) las estrellas cogidas vuelan hasta su contador (que da un latido al llegar: `p.llego`)
  if (p.vuelos.length) {
    const mx = contador?.x ?? w - 58, my = contador?.y ?? 34;
    p.vuelos = p.vuelos.filter((v) => { v.t += dt / 0.42; if (v.t >= 1) { p.llego = true; return false; } return true; });
    c.fillStyle = ORO;
    for (const v of p.vuelos) {
      const k = v.t * v.t * (3 - 2 * v.t);
      const vx = v.x + (mx - v.x) * k, vy = v.y + (my - v.y) * k - Math.sin(k * Math.PI) * 40;
      c.globalAlpha = 0.95; estrella4(c, vx, vy, 8 - k * 3, t * 6); c.fill();
    }
    c.globalAlpha = 1;
  }
  // (belleza) los diez últimos segundos: alrededor de la cuenta, un marco que se vacía y late con cada segundo
  if (reloj && Number.isFinite(quedan) && quedan > 0 && quedan <= 10 && !final) {
    const late = quieto ? 0 : Math.max(0, 1 - (1 - (quedan % 1)) * 5);
    const W = reloj.w + 28, H = reloj.h + 12, R = 20, X = reloj.x - W / 2, Y = Math.max(3, reloj.y - H / 2);
    const largo = 2 * (W + H) - 8 * R + 2 * Math.PI * R;
    c.lineCap = 'round'; c.lineWidth = 3.5;
    c.strokeStyle = 'rgba(241, 240, 246, .16)'; c.beginPath(); c.roundRect(X, Y, W, H, R); c.stroke();
    c.strokeStyle = quedan <= 3 ? ORO : TIZA; c.lineWidth = 3.5 + late * 2;
    c.setLineDash([largo * (quedan / 10), largo]);
    c.beginPath(); c.roundRect(X, Y, W, H, R); c.stroke();
    c.setLineDash([]);
  }
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
