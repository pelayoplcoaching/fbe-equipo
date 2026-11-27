// (v0.204) Piezas de Progreso de la segunda tanda de belleza de progreso y seguimiento: la gráfica a pantalla completa,
// comparar ejercicios, la flecha de una cifra, los días de una semana en miniatura, la escalera de un récord y los
// trofeos que destellan una vez. La ficha del coach usa las mismas.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { num } from '../../logica/calculos.js';
import { fmtCorta } from '../../logica/fechas.js';
import { trazoSuave, escalaGrafica } from '../../logica/visual.js';
import { diasDeSemana, textoDiasSemana, flechaCifra, trofeosNuevos, trofeosVistos, podioRecords } from '../../logica/progreso-visual-2.js';
import { pesoTxt } from '../../logica/unidades.js';
import { Imagen, hayImagen } from '../Imagen.jsx';
import { Hoja, Icono, CajaGrafica, useAncho, useRaspado } from '../comunes.jsx';
import { sinMovimiento, conTransicion } from '../transiciones.js';

// ---------------------------------------------------------------- a pantalla completa
// El botón de las cuatro esquinas junto al título de una gráfica; abre la gráfica a toda la pantalla (y en horizontal si
// se gira el móvil), con su rango y el dedo. children(alto): la gráfica (y su selector de rango) al alto que toca.
const altoGrande = () => (typeof window === 'undefined' ? 320 : Math.round(Math.max(220, Math.min(520, window.innerHeight * 0.58))));
export function Ampliable({ titulo, children }) {
  const [abierta, setAbierta] = useState(false);
  // (tacto 214) la gráfica de la tarjeta crece hasta la pantalla completa, y vuelve a su tarjeta al cerrar
  const origen = useRef(null);
  const abrir = (ev) => {
    origen.current = ev.currentTarget.closest('section, .panel, .tarjeta')?.querySelector('.grafica-caja') || null;
    conTransicion(() => setAbierta(true), 'morph', [{ nombre: 'vt-viaje', desde: origen.current, hasta: '.grafica-grande .grafica-caja' }]);
  };
  const cerrar = () => {
    const o = origen.current;
    if (o?.isConnected) o.setAttribute('data-vuelve', '');
    conTransicion(() => setAbierta(false), 'morph', [{ nombre: 'vt-viaje', desde: document.querySelector('.grafica-grande .grafica-caja'), hasta: '[data-vuelve]' }]);
    setTimeout(() => o?.removeAttribute?.('data-vuelve'), 900);
  };
  return (
    <>
      <button type="button" class="btn btn-icono plano btn-ampliar" aria-label={`Ver «${titulo}» a pantalla completa`} onClick={abrir}><Icono n="ampliar" /></button>
      {abierta && <PantallaGrafica titulo={titulo} alCerrar={cerrar}>{children}</PantallaGrafica>}
    </>
  );
}
function PantallaGrafica({ titulo, alCerrar, children }) {
  const [alto, setAlto] = useState(altoGrande);
  useEffect(() => {
    const al = () => setAlto(altoGrande());
    window.addEventListener('resize', al);
    window.addEventListener('orientationchange', al);
    return () => { window.removeEventListener('resize', al); window.removeEventListener('orientationchange', al); };
  }, []);
  return (
    <Hoja titulo={titulo} alCerrar={alCerrar} clase="hoja-completa hoja-grafica">
      <div class="pila grafica-grande">
        {children(alto)}
        <p class="mini terciario">Arrastra el dedo por la gráfica para leer cada punto. Gira el móvil para verla más ancha.</p>
      </div>
    </Hoja>
  );
}

// ---------------------------------------------------------------- comparar ejercicios
// Dos o tres ejercicios en la misma gráfica, cada uno en % desde su primera semana del rango y con su color
export function GraficaComparar({ series = [], alto = 170 }) {
  const [W, ref] = useAncho();
  const H = Math.max(alto, Math.min(260, Math.round(W * 0.32))), izq = 40, der = 14, arr = 14, abj = 22;
  const fechas = [...new Set(series.flatMap((s) => s.puntos.map((p) => p.x)))].sort();
  const n = fechas.length;
  const d0 = fechas[0], dN = fechas[n - 1];
  const t0 = n ? Date.parse(`${d0}T12:00:00`) : 0, total = n > 1 ? Math.max(1, Date.parse(`${dN}T12:00:00`) - t0) : 1;
  const X = (f) => izq + (n > 1 ? ((Date.parse(`${f}T12:00:00`) - t0) / total) * (W - izq - der) : (W - izq - der) / 2);
  const { lo, hi, ticks } = escalaGrafica([0, ...series.flatMap((s) => s.puntos.map((p) => p.y))], { rangoMin: 4 });
  const Y = (v) => arr + (1 - (v - lo) / (hi - lo)) * (H - arr - abj);
  const xs = fechas.map(X);
  const raspado = useRaspado(n, xs);
  if (n < 2 || !series.length) return null;
  const pct = (v) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${num(Math.abs(v), 1)} %`;
  const valorEn = (s, f) => { const p = [...s.puntos].reverse().find((x) => x.x <= f); return p ? p.y : null; };
  const textoPunto = (i) => `${fmtCorta(fechas[i])}: ${series.map((s) => { const v = valorEn(s, fechas[i]); return `${s.nombre} ${v == null ? 'sin datos' : pct(v)}`; }).join(', ')}`;
  const resumen = `Comparación del 1RM estimado en % desde el principio del rango, del ${fmtCorta(d0)} al ${fmtCorta(dN)}: ${series.map((s) => `${s.nombre} ${pct(s.cambio)}`).join(', ')}.`;
  const sel = raspado.sel;
  return (
    <div class="pila-s comparar-ej">
      <CajaGrafica raspado={raspado} n={n} W={W} xs={xs} ys={fechas.map((f) => Y(Math.max(...series.map((s) => valorEn(s, f) ?? lo))))} etiqueta="Comparar ejercicios" textoPunto={textoPunto} resumen={resumen}>
        <svg class="grafica grafica-comparar" ref={ref} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {ticks.map((t) => (
            <g key={t}><line class={`eje ${t === 0 ? 'eje-cero' : ''}`} x1={izq} x2={W - der} y1={Y(t)} y2={Y(t)} stroke-dasharray={t === 0 ? undefined : '2 4'} /><text x={izq - 6} y={Y(t) + 4} text-anchor="end">{t > 0 ? '+' : ''}{num(t, 0)} %</text></g>
          ))}
          {series.map((s, k) => <path key={s.id} class={`linea-comparar c${k + 1}`} d={trazoSuave(s.puntos.map((p) => [X(p.x), Y(p.y)]))} />)}
          {series.map((s, k) => { const u = s.puntos[s.puntos.length - 1]; return <circle key={s.id} class={`fin-comparar c${k + 1}`} cx={X(u.x)} cy={Y(u.y)} r="4" />; })}
          {sel != null && <line class="guia" x1={xs[sel]} x2={xs[sel]} y1={arr - 6} y2={H - abj} />}
          <text x={X(d0)} y={H - 4} text-anchor="start">{fmtCorta(d0)}</text>
          <text x={X(dN)} y={H - 4} text-anchor="end">{fmtCorta(dN)}</text>
        </svg>
      </CajaGrafica>
      <ul class="leyenda-comparar" aria-hidden="true">
        {series.map((s, k) => <li key={s.id} class={`c${k + 1}`}><i />{s.nombre} <b class="num">{pct(s.cambio)}</b></li>)}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- la flecha de una cifra
// Frente a las 4 semanas de antes: «+12» en verde, «−3» en ámbar o «=»; para los lectores de pantalla, la frase entera
export function FlechaCifra({ v, antes, que = 'las 4 semanas anteriores' }) {
  const f = flechaCifra(v, antes);
  if (!f) return null;
  return (
    <span class={`cifra-flecha ${f.dir}`}>
      <span class="sr">{f.dir === 'igual' ? `, igual que ${que}` : `, ${num(Math.abs(f.d), 0)} ${f.dir === 'sube' ? 'más' : 'menos'} que ${que}`}</span>
      <span aria-hidden="true">{f.dir !== 'igual' && <Icono n={f.dir === 'sube' ? 'arriba' : 'abajo'} />}{f.texto}</span>
    </span>
  );
}

// ---------------------------------------------------------------- los días de una semana, en miniatura
export function DiasSemanaMini({ lunes, dias = [] }) {
  return (
    <span class="dias-mini">
      <span class="sr">{textoDiasSemana(lunes, dias)}</span>
      <span class="dias-mini-fila" aria-hidden="true">
        {diasDeSemana(lunes, dias).map((d) => <i key={d.iso} class={d.si ? 'si' : ''}><b>{d.letra}</b></i>)}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------- la escalera de un récord
// escalones: los de escaleraRecords (de la vez más antigua a la última), que suben de izquierda a derecha
export function EscaleraRecords({ escalones = [] }) {
  const caja = useRef(null);
  // al abrir, la última vez (la de más a la derecha) a la vista
  useLayoutEffect(() => { const el = caja.current; if (el) el.scrollLeft = el.scrollWidth; }, [escalones.length]);
  return (
    <div class="escalera-caja" ref={caja}>
      <ol class="lista-records escalera" style={{ '--n': escalones.length }}>
        {escalones.map((v, i) => (
          <li key={`${v.fecha}-${i}`} class={i === escalones.length - 1 ? 'ultima' : ''} style={{ '--alto': v.alto }}>
            <span class="sr">{v.texto.charAt(0).toUpperCase() + v.texto.slice(1)}, el {fmtCorta(v.fecha)}</span>
            <span class="escalon-cifra num" aria-hidden="true">{v.cifra}</span>
            <span class="escalon" aria-hidden="true">{i === escalones.length - 1 && <Icono n="trofeo" />}</span>
            <span class="escalon-fecha mini num" aria-hidden="true">{fmtCorta(v.fecha)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- el podio de un récord (belleza 176)
// Tus tres mejores marcas de un ejercicio en oro, plata y bronce (con las medallas de la app): en la lista, de la mejor a la
// tercera; a la vista, como un podio (la plata a la izquierda, el oro en medio y más alto, el bronce a la derecha)
const MEDALLA = { oro: 'medalla-records-oro', plata: 'medalla-records-plata', bronce: 'medalla-records-bronce' };
const PUESTO = { oro: 'La mejor', plata: 'La segunda', bronce: 'La tercera' };
export function PodioRecords({ puntos = [], unidad = 'kg' }) {
  const p = podioRecords(puntos);
  if (p.length < 2) return null;
  return (
    <ol class="amb-podio">
      {p.map((x) => (
        <li key={x.puesto} data-m={x.puesto}>
          {hayImagen(MEDALLA[x.puesto]) ? <Imagen id={MEDALLA[x.puesto]} clase="amb-podio-med" tamanos="56px" /> : <span class="amb-podio-med amb-podio-ico" aria-hidden="true"><Icono n="trofeo" /></span>}
          <span class="amb-podio-cifra num"><span class="sr">{PUESTO[x.puesto]}: </span>{unidad === 'kg' ? pesoTxt(x.valor, 1) : `${num(x.valor, 0)} rep`}</span>
          <span class="amb-podio-fecha mini num">{fmtCorta(x.fecha)}</span>
          <span class="amb-podio-caja" aria-hidden="true" />
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- los trofeos nuevos, que destellan una vez
// Los de récord desde la última vez que se vio la vitrina (en este móvil). La primera vez no destella ninguno.
// Devuelve el conjunto de ids nuevos; cada tarjeta nueva lleva la clase «por-destellar» (y data-trofeo, su id) y, al
// entrar en la pantalla, «destella» (una sola vez). Cada una queda vista al destellar (las que no llegan a verse, como
// las de «Ver los N ejercicios» sin abrir, destellan cuando se vean).
export function useTrofeosNuevos(clave, ejercicios = [], activo = true) {
  const [nuevos] = useState(() => {
    if (!activo) return new Set();
    let vistos = null;
    try { vistos = JSON.parse(localStorage.getItem(clave) || 'null'); } catch { vistos = null; }
    const ids = trofeosNuevos(ejercicios, vistos);
    if (!vistos && ejercicios.length) { try { localStorage.setItem(clave, JSON.stringify(trofeosVistos(ejercicios))); } catch { /* */ } }
    return new Set(ids);
  });
  const rejilla = useRef(null);
  useEffect(() => {
    const el = rejilla.current;
    if (!activo || !nuevos.size || !el) return undefined;
    const todos = trofeosVistos(ejercicios);
    const ver = (ids) => {
      try {
        const vistos = JSON.parse(localStorage.getItem(clave) || '{}') || {};
        for (const id of ids) if (todos[id]) vistos[id] = todos[id];
        localStorage.setItem(clave, JSON.stringify(vistos));
      } catch { /* */ }
    };
    if (typeof IntersectionObserver === 'undefined' || sinMovimiento()) { ver([...nuevos]); return undefined; }
    const io = new IntersectionObserver((es) => {
      const vistas = [];
      for (const e of es) if (e.isIntersecting) { e.target.classList.add('destella'); io.unobserve(e.target); vistas.push(e.target.dataset.trofeo); }
      if (vistas.length) ver(vistas);
    }, { threshold: 0.6 });
    const mirar = () => el.querySelectorAll('.por-destellar:not(.destella)').forEach((x) => io.observe(x));
    mirar();
    // las que aparecen después («Ver los N ejercicios»)
    const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(mirar);
    mo?.observe(el, { childList: true });
    return () => { io.disconnect(); mo?.disconnect(); };
  }, [nuevos]);
  return { nuevos, rejilla };
}
