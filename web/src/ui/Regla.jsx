// (tacto 201-203, v0.271) La regla: una tira graduada que se desliza con el dedo (con la inercia del propio móvil), se
// para en cada salto y da un toque al pasar por él. Va sobre el teclado de la app (kilos y repeticiones) y en «Tu peso».
// Cómo: una caja que se desplaza de lado, con una marca por salto a la que se imanta (scroll-snap); la aguja se queda en
// el centro. Solo cambia el valor mientras la mueve la persona (el dedo, el ratón, la rueda): si el valor cambia desde
// fuera (las teclas, −/+), la regla va a su sitio sin tocar nada. Para el lector de pantalla y el teclado es un
// deslizador (flechas, de salto en salto; AvPág y RePág, de marca grande en marca grande).
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { vibrar, PATRONES } from './hapticos.js';
import { sonarFBE } from './sonido.js';
import { num } from '../logica/calculos.js';
import { REGLA_ANCHO, reglaMayor, reglaIndice, reglaValor, reglaVentana, reglaAlBorde } from '../logica/regla.js';

const quieto = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// valor: el de ahora (null: aún nada; la regla se pone en «base»); paso: el salto; min, max: los topes; dec: decimales al
// escribirlo; mayor: cada cuántos saltos va un número (si no, el que caiga en cifra redonda); zona: [de, a], en verde;
// etiqueta: su nombre para el lector de pantalla; unidad: «kg», «reps»…; alCambiar(v): en cada salto; alSoltar(v): al parar;
// variante: 'peso' (en «Tu peso»: más alta y sin la cifra flotante, que ya está en el campo de encima)
export function Regla({ valor = null, base = null, paso = 1, min = 0, max = 1500, dec = 2, mayor = null, zona = null, etiqueta, unidad = '', alCambiar, alSoltar = null, variante = '' }) {
  const caja = useRef(null);
  const st = useRef({ activo: false, i: null, t: 0, fin: null, dedo: false, raton: null, destino: null }).current;
  // El salto, fijo mientras se arrastra (con mancuernas cambia al pasar de 10 kg: la regla no puede saltar bajo el dedo)
  const [p, setP] = useState(paso);
  const lim = { min, max };
  const m = mayor || reglaMayor(p);
  const iValor = reglaIndice(valor ?? base, p, lim);
  const [centro, setCentro] = useState(iValor);
  const [activo, setActivo] = useState(false);
  const v = reglaVentana(centro, p, lim);
  const ahora = valor ?? reglaValor(iValor, p);
  // Lo último pintado, para lo que llega entre dos pintados (el desplazamiento)
  const vivo = useRef(null);
  vivo.current = { v, p, m, alCambiar, alSoltar };

  // La regla, en su sitio: al abrir, al teclear otro valor o al cambiar el salto. Nunca mientras la mueve la persona
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el || st.activo) return;
    if (paso !== p) { setP(paso); return; }
    if (reglaAlBorde(iValor, v) && centro !== iValor) { setCentro(iValor); return; }
    const left = (iValor - v.a) * REGLA_ANCHO;
    if (st.i === iValor && st.destino === left) return;
    const suave = st.i != null && st.destino != null && !quieto() && Math.abs(iValor - st.i) <= 12 && Math.abs(left - el.scrollLeft) <= 13 * REGLA_ANCHO;
    st.i = iValor; st.destino = left;
    if (suave) el.scrollTo({ left, behavior: 'smooth' }); else el.scrollLeft = left;
  });

  const soltar = () => {
    if (st.dedo || st.raton) { st.fin = setTimeout(soltar, 160); return; }
    if (!st.activo) return;
    st.activo = false; st.destino = null;
    setActivo(false);
    const a = vivo.current;
    a.alSoltar?.(reglaValor(st.i, a.p));
  };
  const activar = () => { if (!st.activo) { st.activo = true; setActivo(true); } clearTimeout(st.fin); st.fin = setTimeout(soltar, 400); };
  const alDesplazar = () => {
    const el = caja.current;
    if (!el || !st.activo) return;
    const a = vivo.current;
    clearTimeout(st.fin); st.fin = setTimeout(soltar, 160);
    const i = Math.min(a.v.b, Math.max(a.v.a, a.v.a + Math.round(el.scrollLeft / REGLA_ANCHO)));
    if (i === st.i) return;
    st.i = i;
    // (un toque por salto, y un poco más en cada marca grande; lanzada deprisa, no más de uno cada 26 ms)
    const t = performance.now();
    if (t - st.t > 26) { st.t = t; vibrar(i % a.m === 0 ? PATRONES.serie : PATRONES.toque); sonarFBE('tecla'); }
    a.alCambiar?.(reglaValor(i, a.p));
  };
  // El dedo (los toques siguen llegando mientras el móvil desplaza; los punteros, no) y la rueda, sin frenar el desplazamiento
  useEffect(() => {
    const el = caja.current;
    if (!el) return undefined;
    const baja = () => { st.dedo = true; activar(); };
    const sube = (e) => { if (e.touches?.length) return; st.dedo = false; clearTimeout(st.fin); st.fin = setTimeout(soltar, 160); };
    const o = { passive: true };
    el.addEventListener('touchstart', baja, o); el.addEventListener('touchend', sube, o); el.addEventListener('touchcancel', sube, o); el.addEventListener('wheel', activar, o);
    return () => { clearTimeout(st.fin); el.removeEventListener('touchstart', baja, o); el.removeEventListener('touchend', sube, o); el.removeEventListener('touchcancel', sube, o); el.removeEventListener('wheel', activar, o); };
  }, []);
  // Con el ratón, se arrastra
  const ratonBaja = (e) => {
    if (e.pointerType !== 'mouse' || e.button) return;
    const el = caja.current;
    st.raton = { x: e.clientX, s: el.scrollLeft };
    try { el.setPointerCapture(e.pointerId); } catch { /* sin captura, se arrastra igual mientras no salga */ }
    activar();
  };
  const ratonMueve = (e) => { if (st.raton) { clearTimeout(st.fin); caja.current.scrollLeft = st.raton.s - (e.clientX - st.raton.x); } };
  const ratonSube = () => { if (!st.raton) return; st.raton = null; clearTimeout(st.fin); st.fin = setTimeout(soltar, 160); };
  const tecla = (e) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'PageUp' ? m : e.key === 'PageDown' ? -m : 0;
    if (!d) return;
    e.preventDefault();
    const i = Math.min(v.hi, Math.max(v.lo, iValor + d));
    if (i === iValor) return;
    vibrar('toque');
    const x = reglaValor(i, p);
    alCambiar?.(x); alSoltar?.(x);
  };

  const marcas = [];
  for (let i = v.a; i <= v.b; i++) {
    const x = reglaValor(i, p);
    const g = i % m === 0;
    const z = zona && x >= zona[0] && x <= zona[1];
    marcas.push(<i key={i} class={`rg-t${g ? ' rg-g' : m % 2 === 0 && i % m === m / 2 ? ' rg-h' : ''}${z ? ` rg-z${x === zona[0] ? ' rg-z1' : ''}${x === zona[1] ? ' rg-z2' : ''}` : ''}`}>{g && <b class="rg-n">{num(x, dec)}</b>}</i>);
  }
  const enZona = zona && ahora >= zona[0] && ahora <= zona[1];
  return (
    <div class={`rg-raiz${variante === 'peso' ? ' rg-peso' : ''}`} data-activo={activo ? '' : undefined} data-zona={enZona ? '' : undefined} data-sin-deslizar="">
      <span class="rg-burbuja" aria-hidden="true"><span class="num">{num(ahora, dec)}</span>{unidad && <small class="rg-u">{unidad}</small>}</span>
      <div ref={caja} class="rg-caja" role="slider" tabIndex={0} aria-label={etiqueta} aria-orientation="horizontal"
        aria-valuemin={min} aria-valuemax={max} aria-valuenow={ahora} aria-valuetext={`${num(ahora, dec)}${unidad ? ` ${unidad}` : ''}`}
        onScroll={alDesplazar} onPointerDown={ratonBaja} onPointerMove={ratonMueve} onPointerUp={ratonSube} onPointerCancel={ratonSube} onKeyDown={tecla}>
        <div class="rg-pista">{marcas}</div>
      </div>
      <span class="rg-aguja" aria-hidden="true" />
    </div>
  );
}
