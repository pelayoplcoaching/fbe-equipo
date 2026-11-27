// (tacto 213 y 236, v0.272) La medalla, en la mano. En la hoja de un logro, su medalla en grande: llega volando desde su
// hueco de la rejilla y se puede coger. Gira con el dedo, con la inercia con que se suelte, y se queda de frente o de
// espaldas; detrás lleva grabado cómo se ganó. Un toque (o Intro, o Espacio) le da la vuelta. Con «reducir movimiento»
// no sigue al dedo: el toque cambia de cara sin girar. Va aparte: solo se carga al abrir una medalla. La medalla dibujada
// (Metal), sus colores (c) y su nombre llegan de Logros.jsx: importarlos aquí partiría en más trozos lo que se descarga
// al abrir la app.
import { useEffect, useRef, useState } from 'preact/hooks';
import { vibrar } from './hapticos.js';
import { sinMovimiento } from './transiciones.js';
import { GRADOS_PX, caraDe, giroDestino, duracionGiro, luzGiro, velocidadGiro } from '../logica/medalla-giro.js';

const suave = (t) => 1 - (1 - t) ** 3;

// La luz que cruza la cara al girar (en las dos caras; la mueve el propio giro)
function Luz({ k }) {
  return (
    <svg class="mdl-luz" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={k} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#fff" stop-opacity="0" /><stop offset=".5" stop-color="#fff" stop-opacity=".55" /><stop offset="1" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
        <clipPath id={`${k}c`}><circle cx="50" cy="50" r="40" /></clipPath>
      </defs>
      <g clip-path={`url(#${k}c)`}><rect class="mdl-haz" x="30" y="-10" width="40" height="120" fill={`url(#${k})`} transform="rotate(18 50 50)" /></g>
    </svg>
  );
}

let cuenta = 0;
export function MedallaHeroe({ logro: l, Metal, c = null, nombre }) {
  const giro = useRef(null);
  const st = useRef({ a: 0, g: null, cuadro: 0, sinClic: -1e9 }).current;
  const id = useRef(null);
  if (!id.current) id.current = `mdl${++cuenta}`;
  const [dorso, setDorso] = useState(false);

  const poner = (a) => {
    const el = giro.current;
    if (!el) return;
    const luz = luzGiro(a);
    el.style.transform = `rotateY(${a.toFixed(1)}deg)`;
    el.style.setProperty('--mdl-x', `${luz.x}px`);
    el.style.setProperty('--mdl-o', String(luz.o));
  };
  const parar = () => { cancelAnimationFrame(st.cuadro); st.cuadro = 0; };
  // Hasta «hasta» (un múltiplo de 180) desde donde esté
  const irA = (hasta, desde = st.a) => {
    parar();
    st.a = hasta;
    setDorso(caraDe(hasta) === 'dorso');
    if (sinMovimiento() || desde === hasta) { poner(hasta); return; }
    const ms = duracionGiro(desde, hasta), t0 = performance.now();
    let cara = Math.round(desde / 180);
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / ms), a = desde + (hasta - desde) * suave(p);
      poner(a);
      // (un toque cada vez que pasa de cara)
      const k = Math.round(a / 180);
      if (k !== cara) { cara = k; vibrar('toque'); }
      st.cuadro = p < 1 ? requestAnimationFrame(paso) : 0;
    };
    st.cuadro = requestAnimationFrame(paso);
  };
  useEffect(() => parar, []);

  const baja = (e) => {
    if (e.button > 0 || st.g || sinMovimiento()) return;
    st.g = { id: e.pointerId, x: e.clientX, x1: e.clientX, t1: e.timeStamp, a0: null, a: st.a, v: 0, cara: Math.round(st.a / 180) };
  };
  const mueve = (e) => {
    const g = st.g;
    if (!g || e.pointerId !== g.id) return;
    if (g.a0 == null) {
      if (Math.abs(e.clientX - g.x) < 6) return;
      // (se coge: si iba girando sola, desde donde esté)
      parar();
      const ahora = giro.current ? parseFloat((giro.current.style.transform.match(/rotateY\(([-\d.]+)deg\)/) || [])[1]) : NaN;
      g.a0 = Number.isFinite(ahora) ? ahora : st.a;
      g.x = e.clientX; g.x1 = e.clientX; g.t1 = e.timeStamp;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sin captura, gira igual mientras no salga */ }
      giro.current?.setAttribute('data-cogida', '');
    }
    g.a = g.a0 + (e.clientX - g.x) * GRADOS_PX;
    g.v = velocidadGiro(g.v, (e.clientX - g.x1) * GRADOS_PX, e.timeStamp - g.t1);
    g.x1 = e.clientX; g.t1 = e.timeStamp;
    poner(g.a);
    const k = Math.round(g.a / 180);
    if (k !== g.cara) { g.cara = k; vibrar('toque'); }
  };
  const sube = (e) => {
    const g = st.g;
    if (!g || e.pointerId !== g.id) return;
    st.g = null;
    giro.current?.removeAttribute('data-cogida');
    if (g.a0 == null) return;   // un toque: le da la vuelta el clic
    st.sinClic = e.timeStamp;
    // (parada un momento antes de soltarla, no sale lanzada)
    const v = e.timeStamp - g.t1 > 90 ? 0 : g.v;
    irA(e.type === 'pointercancel' ? Math.round(g.a0 / 180) * 180 : giroDestino(g.a, v), g.a);
  };
  const clic = (e) => {
    if (e.timeStamp - st.sinClic < 350) return;
    vibrar('elegir');
    irA(st.a + 180);
  };

  return (
    <div class="mdl-escena" data-llega="medalla" data-sin-deslizar="">
      <button type="button" class="mdl-giro" ref={giro} aria-pressed={dorso} onPointerDown={baja} onPointerMove={mueve} onPointerUp={sube} onPointerCancel={sube} onClick={clic}
        aria-label={`${l.nivel ? `Medalla de ${nombre.toLowerCase()}` : 'Medalla aún sin conseguir'} de ${l.titulo}. ${dorso ? 'Se ve por detrás' : 'Se ve de frente'}: darle la vuelta`}>
        <span class="mdl-cara mdl-frente" aria-hidden="true">
          <Metal nivel={l.nivel} logro={l.id} cifra={l.nivel ? l.niveles[l.nivel - 1].umbral : l.niveles[0].umbral} tam={148} clase="mdl-metal" />
          <Luz k={`${id.current}a`} />
        </span>
        <span class={`mdl-cara mdl-dorso${c ? '' : ' mdl-vacia'}`} aria-hidden="true" style={c ? { '--mdl-tinta': c.tinta } : null}>
          <svg class="mdl-disco" viewBox="0 0 100 100">
            {c && (
              <>
                <defs>
                  <radialGradient id={`${id.current}d`} cx="64%" cy="30%" r="80%"><stop offset="0" stop-color={c.luz} /><stop offset=".55" stop-color={c.medio} /><stop offset="1" stop-color={c.sombra} /></radialGradient>
                </defs>
                <circle cx="50" cy="50" r="40" fill={c.cantoSombra} />
                <circle cx="50" cy="50" r="38.2" fill={`url(#${id.current}d)`} />
                <circle cx="50" cy="50" r="33.4" fill="none" stroke={c.cantoSombra} stroke-opacity=".4" stroke-width=".8" />
                <circle cx="50" cy="50" r="32.2" fill="none" stroke={c.relieve} stroke-width=".8" />
              </>
            )}
            {!c && <circle class="mdl-fantasma" cx="50" cy="50" r="39" />}
          </svg>
          <span class="mdl-grabado">
            <strong class="mdl-nombre">{nombre}</strong>
            <span class="mdl-como">{l.nivel ? l.conseguido : l.niveles[0].texto}</span>
          </span>
          <Luz k={`${id.current}b`} />
        </span>
      </button>
      <span class="mdl-pista" aria-hidden="true">{dorso ? (l.nivel ? 'Así la ganaste' : 'Así se gana la primera') : 'Gírala con el dedo'}</span>
    </div>
  );
}
