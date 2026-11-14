// v0.52: el carné de atleta, como una tarjeta de Apple Wallet: «FBE Coaching», tu nombre, tu nivel, tu bloque y desde
// cuándo entrenas con tu coach, con el lobo. Un brillo holográfico y una inclinación leve que siguen al dedo (y al
// móvil, solo donde el navegador no pide permiso: en Android; en iPhone haría falta pedirlo y no se pide). Quieta con
// «reducir movimiento». Se comparte o se guarda como imagen con la hoja de siempre. Nada de peso, salud ni nutrición.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, Icono } from '../comunes.jsx';
import { HojaCompartir, FUENTE, dibujarLobo } from '../Compartir.jsx';
import { LOBO_CAJA, LOBO_D } from '../lobo-trazo.js';
import { datosCarnet, datosImagenCarnet, inclinacion, inclinacionMovil } from '../../logica/carnet.js';
import { sinMovimiento } from '../transiciones.js';
import { Imagen } from '../Imagen.jsx';
import { hoyISO } from '../../logica/fechas.js';

const sinPermisoOrientacion = () => typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
  && typeof window.DeviceOrientationEvent.requestPermission !== 'function' && !!window.matchMedia?.('(pointer: coarse)').matches;

export function Carnet({ bloque }) {
  const { atleta } = useApp();
  const d = datosCarnet({ atleta, bloque });
  // (la imagen para compartir no lleva el bloque: su nombre lo pone el coach y podría decir algo de salud)
  const imagen = datosImagenCarnet(d);
  const ref = useRef(null);
  const [compartir, setCompartir] = useState(false);
  // La inclinación: se escribe en variables CSS en el siguiente cuadro (sin volver a pintar el componente)
  useEffect(() => {
    const el = ref.current;
    if (!el || sinMovimiento()) return undefined;
    let raf = 0, pendiente = null, base = null, visible = false;
    const aplicar = () => {
      raf = 0;
      if (!pendiente) return;
      el.style.setProperty('--rx', `${pendiente.rx}deg`);
      el.style.setProperty('--ry', `${pendiente.ry}deg`);
      el.style.setProperty('--bx', `${(pendiente.bx - 50) * 0.6}%`);
      el.style.setProperty('--by', `${(pendiente.by - 50) * 0.6}%`);
    };
    const pedir = (v) => { pendiente = v; if (!raf) raf = requestAnimationFrame(aplicar); };
    const mover = (e) => {
      const r = el.getBoundingClientRect();
      el.classList.add('inclinando');
      pedir(inclinacion({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }));
    };
    const soltar = () => { el.classList.remove('inclinando'); pedir({ rx: 0, ry: 0, bx: 50, by: 50 }); };
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerleave', soltar);
    el.addEventListener('pointercancel', soltar);
    el.addEventListener('pointerup', soltar);
    // El móvil (solo donde no hay que pedir permiso) y solo mientras el carné se ve
    const orientar = (e) => {
      if (!visible || e.beta == null || e.gamma == null || el.classList.contains('inclinando')) return;
      base ||= { beta: e.beta, gamma: e.gamma };
      pedir(inclinacionMovil(e.beta, e.gamma, base));
    };
    let io = null;
    if (sinPermisoOrientacion() && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([x]) => { visible = x.isIntersecting; if (!visible) base = null; });
      io.observe(el);
      window.addEventListener('deviceorientation', orientar);
    }
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', mover);
      el.removeEventListener('pointerleave', soltar);
      el.removeEventListener('pointercancel', soltar);
      el.removeEventListener('pointerup', soltar);
      window.removeEventListener('deviceorientation', orientar);
      io?.disconnect();
    };
  }, []);
  return (
    <section class="seccion carnet-seccion" aria-labelledby="carnet-t">
      <h2 id="carnet-t">Tu carné</h2>
      <div class="carnet-escena">
        <figure class="carnet" ref={ref} aria-labelledby="carnet-nombre" aria-describedby="carnet-datos">
          {/* (diseño, tanda 21) la marca nueva: la noche de la portada con sus resplandores, el lobo en blanco y vectorial
              y, en grande y muy tenue, el lobo al fondo (como en las tarjetas para compartir) */}
          <div class="carnet-fondo" aria-hidden="true">
            {/* (imágenes) el metal cepillado morado, debajo de los anillos y el lobo */}
            <Imagen id="carne-fondo" clase="carnet-foto" tamanos="340px" prioridad />
            <svg class="carnet-lineas" viewBox="0 0 340 214" preserveAspectRatio="xMidYMid slice" focusable="false">
              {[0, 1, 2, 3].map((i) => <circle key={i} cx="300" cy="-10" r={70 + i * 40} />)}
            </svg>
            <svg class="carnet-lobo-fondo" viewBox={LOBO_CAJA} focusable="false"><path d={LOBO_D} fill-rule="evenodd" /></svg>
            <div class="carnet-brillo" />
          </div>
          <div class="carnet-cab">
            <svg class="carnet-lobo" viewBox={LOBO_CAJA} width="36" height="36" aria-hidden="true" focusable="false"><path d={LOBO_D} fill-rule="evenodd" /></svg>
            <span class="carnet-marca">FBE Coaching</span>
            <span class="carnet-numero num">{d.numero}</span>
          </div>
          <figcaption class="carnet-cuerpo">
            <span class="carnet-etq">Atleta</span>
            <span class="carnet-nombre" id="carnet-nombre">{d.nombre}</span>
            <dl class="carnet-datos" id="carnet-datos">
              {d.nivel && <div><dt>Nivel</dt><dd>{d.nivel}</dd></div>}
              {d.bloque && <div class="ancho"><dt>Bloque</dt><dd>{d.bloque.replace(/^Bloque (\d+): /, '$1 · ')}</dd></div>}
              {d.desde && <div><dt>Desde</dt><dd>{d.desde}</dd></div>}
            </dl>
          </figcaption>
        </figure>
      </div>
      <button type="button" class="btn btn-peq carnet-compartir" onClick={() => setCompartir(true)}><Icono n="compartir" /> Compartir o guardar el carné</button>
      {compartir && (
        <HojaCompartir titulo="Tu carné" datos={{ ...imagen, fecha: hoyISO() }} dibujar={() => dibujarCarnet(imagen)} nombreArchivo="carne-fbe-coaching.png"
          alt={`Carné de atleta de FBE Coaching: ${imagen.nombre}${imagen.nivel ? `, nivel ${imagen.nivel.toLowerCase()}` : ''}${imagen.desde ? `, desde ${imagen.desde}` : ''}`}
          nota="Solo lleva tu nombre, tu nivel y desde cuándo entrenas con tu coach: ni el bloque, ni peso, salud o nutrición."
          alCerrar={() => setCompartir(false)} />
      )}
    </section>
  );
}

// El carné como imagen (1200 × 756, la proporción de una tarjeta), en el lienzo del móvil. d: solo lo de la imagen
// (datosImagenCarnet: sin el bloque)
export async function dibujarCarnet(d) {
  try { await Promise.all([document.fonts.load(`800 80px ${FUENTE}`), document.fonts.load(`600 34px ${FUENTE}`)]); } catch { /* la del sistema */ }
  const W = 1200, H = 756, R = 56;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const letra = (peso, tam, ancho = 'normal') => { x.font = `${peso} ${tam}px ${FUENTE}`; try { x.fontStretch = ancho; } catch { /* */ } };
  x.beginPath(); x.roundRect ? x.roundRect(0, 0, W, H, R) : x.rect(0, 0, W, H); x.clip();
  // (diseño, tanda 21) la noche de la portada con sus dos resplandores (como las tarjetas para compartir)
  let g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#241665'); g.addColorStop(1, '#140B3A');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (const [cx, cy, r, a] of [[W * 0.9, H * 0.05, 620, 0.5], [W * 0.05, H * 1.05, 560, 0.4]]) {
    g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(104, 78, 236, ${a})`); g.addColorStop(1, 'rgba(104, 78, 236, 0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
  x.strokeStyle = 'rgba(231, 227, 255, .12)'; x.lineWidth = 3;
  for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(W - 140, -30, 250 + i * 140, 0, Math.PI * 2); x.stroke(); }
  // el lobo en grande y muy tenue, abajo a la derecha
  dibujarLobo(x, W - 430, H - 470, 560, '#FFFFFF', 0.06);
  // El brillo holográfico, una banda en diagonal
  const h = x.createLinearGradient(W * 0.2, 0, W * 0.8, H);
  for (const [o, c] of [[0, 'rgba(255,255,255,0)'], [0.42, 'rgba(120,220,255,.16)'], [0.5, 'rgba(255,170,240,.22)'], [0.58, 'rgba(255,230,140,.16)'], [1, 'rgba(255,255,255,0)']]) h.addColorStop(o, c);
  x.fillStyle = h; x.fillRect(0, 0, W, H);
  const wLobo = dibujarLobo(x, 72, 60, 92);
  x.fillStyle = '#F7F5FF'; letra(800, 46, 'expanded'); x.fillText('FBE Coaching', 72 + wLobo + 24, 126);
  x.fillStyle = '#FADA99'; letra(650, 30, 'condensed'); x.textAlign = 'right'; x.fillText(d.numero, W - 72, 122); x.textAlign = 'left';
  x.fillStyle = '#DDD9FF'; letra(700, 26); x.fillText('ATLETA', 72, 392);
  x.fillStyle = '#FFFFFF'; letra(820, 84, 'expanded');
  let nombre = d.nombre;
  while (x.measureText(nombre).width > W - 144 && nombre.length > 3) nombre = `${nombre.slice(0, -2)}…`;
  x.fillText(nombre, 72, 478);
  const campos = [['NIVEL', d.nivel], ['DESDE', d.desde]].filter(([, v]) => v);
  let cx = 72;
  for (const [k, v] of campos) {
    x.fillStyle = '#DDD9FF'; letra(700, 24); x.fillText(k, cx, 610);
    x.fillStyle = '#F7F5FF'; letra(650, 34);
    let t = v; const max = 420;
    while (x.measureText(t).width > max && t.length > 3) t = `${t.slice(0, -2)}…`;
    x.fillText(t, cx, 656);
    cx += Math.min(max, x.measureText(t).width) + 64;
  }
  return new Promise((ok, mal) => cv.toBlob((b) => (b ? ok(b) : mal(new Error('No se ha podido crear la imagen.'))), 'image/png'));
}
