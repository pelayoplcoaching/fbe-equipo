// v0.52: confeti con física (como Duolingo o Cash App), sin dependencias. Las partículas salen en abanico desde arriba,
// las frena el aire, cae con la gravedad y cada papel gira y se balancea (el coseno de su giro lo estrecha, como un
// papel que da vueltas). Pocas en móviles modestos, y se acaba solo a los 2,5 s. Lo puro (crear y mover), aquí.
import { aleatorio } from './arte.js';

export const CONFETI = {
  duracion: 2500,     // ms: después se borra el lienzo
  gravedad: 1500,     // px/s²
  aire: 1.6,          // frenado del aire (1/s): v · e^(−aire·dt)
  maximo: 140,        // partículas en un móvil potente
  minimo: 50,         // en uno modesto
  escalaMaxima: 2,    // devicePixelRatio, como mucho 2 (un lienzo a 3× en un móvil barato pesa el doble sin verse mejor)
};

// Cuántas, según el móvil: menos con 4 núcleos o menos, con poca memoria o en pantallas pequeñas
export function cuantasParticulas({ nucleos = 8, memoria = 8, ancho = 390 } = {}) {
  let n = CONFETI.maximo;
  if (nucleos <= 4) n *= 0.6;
  if (memoria && memoria <= 2) n *= 0.6;
  n *= Math.max(0.6, Math.min(1.2, ancho / 390));
  return Math.round(Math.max(CONFETI.minimo, Math.min(CONFETI.maximo, n)));
}
export const escalaLienzo = (dpr = 1) => Math.max(1, Math.min(CONFETI.escalaMaxima, Number(dpr) || 1));

// n partículas: dos chorros desde arriba (a un tercio y a dos tercios del ancho), hacia arriba y hacia fuera
export function crearParticulas(n, { ancho, alto, colores, semilla = 7 }) {
  const r = aleatorio(semilla);
  return Array.from({ length: n }, (_, i) => {
    const lado = i % 2 ? 1 : -1;
    const angulo = (-90 + lado * (15 + r() * 50)) * (Math.PI / 180);
    const v = 650 + r() * 750;
    return {
      x: ancho * (0.5 + lado * (0.12 + r() * 0.08)), y: alto * (0.18 + r() * 0.06),
      vx: Math.cos(angulo) * v, vy: Math.sin(angulo) * v,
      giro: r() * Math.PI * 2, vgiro: (r() - 0.5) * 14,
      balanceo: r() * Math.PI * 2, vbalanceo: 4 + r() * 6,
      w: 6 + r() * 6, h: 9 + r() * 7,
      color: colores[i % colores.length], forma: r() < 0.3 ? 'circulo' : 'papel',
    };
  });
}

// Un paso de dt segundos (dt se limita: si el móvil se congela, que no salgan disparadas)
export function moverParticulas(ps, dt) {
  const t = Math.max(0, Math.min(0.05, dt));
  const f = Math.exp(-CONFETI.aire * t);
  for (const p of ps) {
    p.vx *= f;
    p.vy = p.vy * f + CONFETI.gravedad * t;
    p.x += p.vx * t + Math.sin(p.balanceo) * 18 * t;
    p.y += p.vy * t;
    p.giro += p.vgiro * t;
    p.balanceo += p.vbalanceo * t;
  }
  return ps;
}

// Cuánto se ve (se desvanece en los últimos 600 ms)
export const opacidadConfeti = (ms) => (ms < CONFETI.duracion - 600 ? 1 : Math.max(0, (CONFETI.duracion - ms) / 600));
