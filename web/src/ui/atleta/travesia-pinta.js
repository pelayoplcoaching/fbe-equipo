// «La travesía»: cómo se pinta el juego en su lienzo (el juego en sí, en logica/travesia.js). Todo a mano, con formas
// planas en la paleta de la casa: sin imágenes que descargar. Va con el trozo del juego, que solo se pide al abrirlo.
import { azar, perfil } from '../../logica/travesia.js';

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

function lobo(c, e, fase) {
  const aire = e.saltos > 0;
  const cae = e.tropiezo > 0;
  // En carrera, las patas de delante y las de atrás van a contratiempo; en el aire, estiradas; al tropezar, recogidas
  const A = cae ? 0.25 : 0.62;
  const atras = aire ? -0.95 : Math.sin(fase) * A;
  const delante = aire ? 0.95 : Math.sin(fase + 2.6) * A;
  const bote = aire || cae ? 0 : Math.abs(Math.sin(fase)) * 0.05;
  const inclina = cae ? -0.42 : aire ? Math.max(-0.35, Math.min(0.4, e.vy * 0.028)) : 0;
  const bajo = e.agachado > 0 && !aire;   // (tanda 1) agachado: el cuerpo pegado al suelo
  const sombra = '#B4A8EA', claro = TIZA;
  c.save();
  if (bajo) { c.translate(0, -0.02); c.scale(1.08, 0.58); }
  c.translate(0, 0.52 + bote);
  c.rotate(inclina);
  c.translate(0, -0.52);
  // (las de detrás, más oscuras)
  pata(c, -0.5, 0.54, atras + 0.5, aire ? 0.5 : -0.35, 0.29, sombra, 0.18);
  pata(c, 0.34, 0.54, delante - 0.45, aire ? -0.3 : 0.3, 0.29, sombra, 0.16);
  // La cola, que sube en el salto
  const cola = aire ? 0.22 : Math.sin(fase * 0.5) * 0.05;
  c.fillStyle = claro; c.beginPath();
  c.moveTo(-0.6, 0.92); c.quadraticCurveTo(-1.06, 1.12 + cola, -1.5, 0.74 + cola * 1.6);
  c.quadraticCurveTo(-1.1, 0.5 + cola * 0.6, -0.62, 0.58); c.closePath(); c.fill();
  c.fillStyle = sombra; c.beginPath();
  c.moveTo(-1.5, 0.74 + cola * 1.6); c.quadraticCurveTo(-1.28, 0.9 + cola * 1.3, -1.12, 0.9 + cola); c.quadraticCurveTo(-1.2, 0.72 + cola, -1.5, 0.74 + cola * 1.6); c.fill();
  // La oreja de detrás
  tri(c, 0.5, 1.18, 0.55, 1.46, 0.7, 1.22, sombra);
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
  c.moveTo(0.44, 1.0); c.lineTo(0.62, 1.24); c.lineTo(0.7, 1.52); c.lineTo(0.84, 1.26); c.lineTo(0.96, 1.2);
  c.lineTo(1.3, 1.02); c.lineTo(1.38, 0.95); c.lineTo(1.28, 0.87); c.lineTo(0.94, 0.84); c.lineTo(0.72, 0.7); c.closePath(); c.fill();
  tri(c, 0.94, 0.84, 1.28, 0.87, 1.02, 0.94, sombra);
  c.fillStyle = MORADO_NOCHE; c.beginPath(); c.arc(1.345, 0.955, 0.04, 0, 6.3); c.fill();
  c.beginPath(); c.ellipse(0.99, 1.08, 0.036, 0.028, -0.3, 0, 6.3); c.fill();
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
export function pintar(c, e, p, { w, h, t, dt = 0, quieto = false, amb = null, fantasma = null }) {
  const fase = amb?.fase || 'noche', paisaje = amb?.paisaje || 0, clima = amb?.clima || null;
  const deDia = fase === 'dia', nevado = paisaje === 2;
  const u = Math.max(22, Math.min(38, w / 13));          // px por metro
  const suelo = Math.round(h * 0.66);
  const x0 = w * 0.2;                                    // dónde va el lobo
  const sx = (x) => x0 + (x - e.x) * u;
  const sy = (y) => suelo - y * u;

  // El cielo y la luna
  const cielo = c.createLinearGradient(0, 0, 0, suelo);
  const [c0, c1, c2] = CIELOS[fase] || CIELOS.noche;
  cielo.addColorStop(0, c0); cielo.addColorStop(0.6, c1); cielo.addColorStop(1, c2);
  c.fillStyle = cielo; c.fillRect(0, 0, w, suelo);
  const veEstrellas = fase === 'noche' ? 1 : deDia ? 0 : 0.35;
  for (const s of p.estrellas) {
    if (!veEstrellas) break;
    const brillo = (quieto ? 0.7 : 0.45 + 0.4 * Math.sin(t * s.v + s.f)) * veEstrellas;
    c.globalAlpha = brillo; c.fillStyle = TIZA;
    c.fillRect(((s.x * w - e.x * 0.6) % w + w) % w, s.y * suelo, s.t, s.t);
  }
  c.globalAlpha = 1;
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
  }

  // (tanda 1) el bosque: una fila de pinos delante de las cordilleras
  if (paisaje === 1) {
    const corre = (e.x * u * 0.32) % 800;
    for (const pi of p.pinos) for (let k = 0; k * 800 - corre + pi.x < w + 40; k++) {
      const px = k * 800 - corre + pi.x, ph = pi.h * suelo;
      if (px < -40) continue;
      for (let n = 0; n < 3; n++) tri(c, px - ph * (0.34 - n * 0.07), suelo - ph * n * 0.26, px, suelo - ph * (0.5 + n * 0.25), px + ph * (0.34 - n * 0.07), suelo - ph * n * 0.26, n % 2 ? '#1F4B4A' : '#173B40');
    }
  }
  // (la luz de la hora, por encima del paisaje)
  if (fase !== 'noche') { c.fillStyle = deDia ? 'rgba(150, 175, 255, .2)' : 'rgba(255, 150, 110, .1)'; c.fillRect(0, 0, w, suelo); }

  // El suelo
  const tierra = c.createLinearGradient(0, suelo, 0, h);
  tierra.addColorStop(0, nevado ? '#CFCAF2' : paisaje === 1 ? '#14263A' : '#1A1247'); tierra.addColorStop(1, nevado ? '#8F86CF' : '#0E0930');
  c.fillStyle = tierra; c.fillRect(0, suelo, w, h - suelo);
  c.fillStyle = nevado ? '#FFFFFF' : LAVANDA; c.globalAlpha = 0.85; c.fillRect(0, suelo, w, 2.5); c.globalAlpha = 1;
  c.fillStyle = 'rgba(160, 140, 255, .16)';
  const corre = (e.x * u) % 900;
  for (const g of p.hierbas) for (let k = 0; k * 900 - corre + g.x < w; k++) { const gx = k * 900 - corre + g.x; if (gx + g.w > 0) c.fillRect(gx, suelo + g.y, g.w, 2); }

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
      continue;
    }
    if (o.tipo === 'rama') {
      // (la rama: cuelga de un tronco que sube hasta fuera de la pantalla)
      const yr = sy(o.h), g = u * 0.34;
      c.fillStyle = '#3A2A5C'; c.fillRect(der - u * 0.2, 0, u * 0.3, yr - g + 2);
      c.fillStyle = '#5B4590'; c.beginPath(); c.roundRect(izq - u * 0.25, yr - g, der - izq + u * 0.45, g, g / 2); c.fill();
      c.fillStyle = paisaje === 1 ? '#2FA36B' : LAVANDA;
      for (const d of [0.15, 0.5, 0.82]) { c.beginPath(); c.ellipse(izq + (der - izq) * d, yr - g * 1.15, u * 0.28, u * 0.16, -0.4, 0, 6.3); c.fill(); }
      continue;
    }
    const cx = sx(o.x), arriba = sy(o.h), llano = ((o.w / 2) * o.plano) * u;
    const roca = o.tipo === 'roca';
    c.fillStyle = roca ? '#6F64AE' : VIOLETA;
    c.beginPath(); c.moveTo(izq, suelo); c.lineTo(cx - llano, arriba); c.lineTo(cx + llano * 0.2, arriba); c.lineTo(cx + llano * 0.5, suelo); c.closePath(); c.fill();
    c.fillStyle = roca ? '#A69CDB' : '#8C78FF';
    c.beginPath(); c.moveTo(cx + llano * 0.2, arriba); c.lineTo(cx + llano, arriba); c.lineTo(der, suelo); c.lineTo(cx + llano * 0.5, suelo); c.closePath(); c.fill();
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
    c.fillStyle = ORO; estrella4(c, x, y, 9, quieto ? 0 : t * 0.8); c.fill();
  }

  // Sucesos del juego desde el último cuadro: chispas al coger una estrella, polvo al caer o tropezar
  for (const s of e.sucesos) {
    if (quieto) break;
    const n = s === 'estrella' || s === 'escudo' ? 7 : s === 'cae' ? 4 : s === 'tropiezo' ? 8 : s === 'rio' ? 10 : 0;
    for (let i = 0; i < n; i++) {
      const a = s === 'estrella' || s === 'escudo' || s === 'rio' ? (i / n) * 6.28 : Math.PI + (i / n - 0.5) * 1.6;
      p.chispas.push({ x: x0 + (s === 'estrella' ? 10 : -8), y: s === 'estrella' ? sy(e.y + 0.8) : suelo - 2, vx: Math.cos(a) * (60 + i * 12), vy: Math.sin(a) * (60 + i * 9) - (s === 'estrella' ? 0 : 30), t: 0.5, oro: s === 'estrella' || s === 'escudo' || s === 'rio' });
    }
  }
  e.sucesos.length = 0;
  p.chispas = p.chispas.filter((q) => (q.t -= dt) > 0);
  for (const q of p.chispas) {
    q.x += q.vx * dt - e.v * u * dt * 0.6; q.y += q.vy * dt; q.vy += 220 * dt;
    c.globalAlpha = Math.min(1, q.t * 2.4); c.fillStyle = q.oro ? ORO : LAVANDA;
    c.beginPath(); c.arc(q.x, Math.min(q.y, suelo - 1), q.oro ? 2.4 : 3, 0, 6.3); c.fill();
  }
  c.globalAlpha = 1;

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

  // El lobo y su sombra
  p.zancada += dt * e.v * (e.calma ? 3.2 : 1.9);
  c.fillStyle = 'rgba(6, 4, 24, .45)';
  const encoge = 1 / (1 + e.y * 0.5);
  c.beginPath(); c.ellipse(x0 - 2, suelo + 4, u * 0.95 * encoge, 4.5 * encoge, 0, 0, 6.3); c.fill();
  c.save();
  c.translate(x0, sy(e.y)); c.scale(u, -u);
  if (e.inmune > 0 && e.tropiezo === 0 && !quieto) c.globalAlpha = 0.55 + 0.45 * Math.sin(t * 24);
  lobo(c, e, p.zancada);
  c.restore();
  // (tanda 1) el escudo: un aro dorado alrededor mientras le quede alguno
  if (e.escudos > 0) {
    c.globalAlpha = quieto ? 0.7 : 0.55 + 0.25 * Math.sin(t * 4);
    c.strokeStyle = ORO; c.lineWidth = 2.5;
    c.beginPath(); c.ellipse(x0, sy(e.y + 0.75), u * 1.25, u * 1.05, 0, 0, 6.3); c.stroke();
  }
  c.globalAlpha = 1;
  return { u, suelo, x0 };
}
