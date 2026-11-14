// v0.52: confeti en un lienzo (como Duolingo o Cash App), sin dependencias: al batir un récord, al terminar un bloque y en
// los hitos de la racha. La física está en logica/confeti.js. Un solo lienzo a la vez, encima de todo y sin recibir
// toques; se borra solo a los 2,5 s (y si la app pasa a segundo plano). Nunca con «reducir movimiento». La vibración,
// si la hay, la decide el ajuste «Vibración al tocar» (hapticos.js).
import { CONFETI, cuantasParticulas, escalaLienzo, crearParticulas, moverParticulas, opacidadConfeti } from '../logica/confeti.js';
import { sinMovimiento } from './transiciones.js';
import { vibrar } from './hapticos.js';

let activo = null;

// Los colores: el acento del tema y la paleta de las celebraciones (--confeti-1…6 de color.css; son papel de colores, no texto)
function colores() {
  const cs = getComputedStyle(document.documentElement);
  const acento = cs.getPropertyValue('--morado').trim() || '#593EDE';
  const pal = [2, 3, 4, 5, 6].map((i) => cs.getPropertyValue(`--confeti-${i}`).trim()).filter(Boolean);
  return [acento, ...(pal.length ? pal : ['#D3A329', '#FF74B0', '#37C2BB', '#73ACFF', '#FC8642']), acento];
}

export function lanzarConfeti({ vibracion = 'record' } = {}) {
  if (typeof document === 'undefined' || sinMovimiento() || document.visibilityState === 'hidden') return false;
  if (vibracion) vibrar(vibracion);
  activo?.parar();
  const ancho = window.innerWidth, alto = window.innerHeight;
  const dpr = escalaLienzo(window.devicePixelRatio);
  const lienzo = document.createElement('canvas');
  lienzo.className = 'confeti-lienzo';
  lienzo.setAttribute('aria-hidden', 'true');
  lienzo.width = Math.round(ancho * dpr); lienzo.height = Math.round(alto * dpr);
  const x = lienzo.getContext('2d');
  if (!x) return false;
  document.body.appendChild(lienzo);
  x.scale(dpr, dpr);
  const n = cuantasParticulas({ nucleos: navigator.hardwareConcurrency || 8, memoria: navigator.deviceMemory || 8, ancho });
  const ps = crearParticulas(n, { ancho, alto, colores: colores(), semilla: (Date.now() & 0xffff) || 7 });
  const t0 = performance.now();
  let previo = t0, raf = 0;
  const parar = () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', alOcultar);
    lienzo.remove();
    if (activo?.lienzo === lienzo) activo = null;
  };
  const alOcultar = () => { if (document.visibilityState === 'hidden') parar(); };
  document.addEventListener('visibilitychange', alOcultar);
  const cuadro = (ahora) => {
    const ms = ahora - t0;
    if (ms >= CONFETI.duracion) { parar(); return; }
    moverParticulas(ps, (ahora - previo) / 1000);
    previo = ahora;
    x.clearRect(0, 0, ancho, alto);
    x.globalAlpha = opacidadConfeti(ms);
    for (const p of ps) {
      if (p.y > alto + 20) continue;
      x.save();
      x.translate(p.x, p.y);
      x.rotate(p.giro);
      x.scale(1, Math.max(0.15, Math.abs(Math.cos(p.balanceo))));
      x.fillStyle = p.color;
      if (p.forma === 'circulo') { x.beginPath(); x.arc(0, 0, p.w / 2, 0, Math.PI * 2); x.fill(); } else x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      x.restore();
    }
    raf = requestAnimationFrame(cuadro);
  };
  raf = requestAnimationFrame(cuadro);
  activo = { lienzo, parar };
  return true;
}

export const pararConfeti = () => activo?.parar();
