// (belleza 161) El final de la sesión como una historia de tres tarjetas, antes del resumen: lo que has hecho, tus récords
// de hoy (si los hay) y tus músculos de hoy. Como «Tu semana» (TuSemana.jsx): las barras de arriba, tocar a los lados para
// pasar, la ✕ para ir al resumen y, con la última, «Ver el resumen». Sale detrás de la escena de la luna y solo cuando
// esta sale (sin «reducir movimiento»): quien no la ve va derecho al resumen, que trae lo mismo. Cada tarjeta, con su
// ilustración abajo (historia-hecho, historia-records e historia-musculos, de datos/imagenes-trozos.json) si ha llegado.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Capa, Icono } from '../comunes.jsx';
import { MapaMuscular } from '../MapaMuscular.jsx';
import { Imagen, hayImagen } from '../Imagen.jsx';
import { num, NOMBRE_GRUPO } from '../../logica/calculos.js';
import { cifrasHistoriaSesion } from '../../logica/sesion-final.js';
import { tenirBarra } from '../barra-color.js';

const NOCHE = '#1E1548';
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
// En un navegador automático (las pruebas), solo si la prueba la pide (fbe-probar-historia): así no tapa el resumen que
// miran las demás pruebas, como la onda de belleza.js o la escena de la bienvenida
export const hayHistoriaSesion = () => !(typeof navigator !== 'undefined' && navigator.webdriver && !leer('fbe-probar-historia'));
const FONDO = { hecho: 'historia-hecho', records: 'historia-records', musculos: 'historia-musculos' };

export function HistoriaSesion(props) { return <Capa><Pantallas {...props} /></Capa>; }

// resumen: el de la sesión que se acaba de guardar (series, tonelaje, minutos, cardio, records, musculos); nombre: el de la sesión
function Pantallas({ resumen, nombre = '', alCerrar }) {
  const r = resumen;
  const cifras = cifrasHistoriaSesion(r);
  const grupos = Object.entries(r.musculos || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const pantallas = [
    { id: 'hecho', render: () => (
      <>
        <span class="historia-etq">Lo que has hecho</span>
        <h2>{nombre || 'Sesión terminada'}</h2>
        <ul class="hs-cifras">
          {cifras.map((c) => <li key={c.k}><span class="historia-cifra num">{c.v}<small>{c.t}</small></span></li>)}
        </ul>
      </>
    ) },
    ...(r.records?.length ? [{ id: 'records', render: () => (
      <>
        <span class="historia-etq">Tus récords de hoy</span>
        <p class="historia-cifra num">{r.records.length}<small>{r.records.length === 1 ? 'récord' : 'récords'}</small></p>
        <ul class="historia-lista">
          {r.records.slice(0, 3).map((x) => <li key={x.nombre}><Icono n="trofeo" /><span><strong>{x.nombre}</strong><br />{x.r?.texto}</span></li>)}
        </ul>
        {r.records.length > 3 && <p class="historia-texto">y {r.records.length - 3} más en el resumen</p>}
      </>
    ) }] : []),
    ...(grupos.length ? [{ id: 'musculos', render: () => (
      <>
        <span class="historia-etq">Tus músculos de hoy</span>
        <h2>{NOMBRE_GRUPO[grupos[0][0]] || grupos[0][0]}<small>{num(grupos[0][1])} {grupos[0][1] === 1 ? 'serie' : 'series'}{grupos.length > 1 ? `, y ${grupos.length - 1} ${grupos.length === 2 ? 'grupo más' : 'grupos más'}` : ''}</small></h2>
        <MapaMuscular series={r.musculos} etiqueta="Series por músculo de hoy" leyenda={false} />
      </>
    ) }] : []),
  ];
  const [i, setI] = useState(0);
  const quieto = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const ultima = i === pantallas.length - 1;
  const ir = (d) => setI((x) => Math.max(0, Math.min(pantallas.length - 1, x + d)));
  const caja = useRef(null);
  // Avanza sola cada 7 s, como «Tu semana» (no con movimiento reducido ni en la última)
  useEffect(() => {
    if (quieto || ultima) return undefined;
    const t = setTimeout(() => ir(1), 7000);
    return () => clearTimeout(t);
  }, [i]);
  useEffect(() => {
    const volver = tenirBarra(NOCHE);
    caja.current?.focus();
    const tecla = (e) => { if (e.key === 'Escape') alCerrar(); if (e.key === 'ArrowRight') ir(1); if (e.key === 'ArrowLeft') ir(-1); };
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('keydown', tecla); volver(); };
  }, []);
  const p = pantallas[i];
  return (
    <div class="historia historia-sesion" role="dialog" aria-modal="true" aria-label={`Tu sesión: ${nombre || 'terminada'}`} ref={caja} tabIndex={-1} data-p={p.id}>
      {hayImagen(FONDO[p.id]) && <Imagen key={p.id} id={FONDO[p.id]} clase="historia-fondo" tamanos="100vw" prioridad />}
      <div class="historia-barras" aria-hidden="true">
        {pantallas.map((x, k) => <span key={x.id} class={k < i ? 'vista' : k === i ? `actual ${quieto ? '' : 'corre'}` : ''}><i /></span>)}
      </div>
      <button class="btn btn-icono plano historia-cerrar" onClick={alCerrar} aria-label="Ir al resumen"><Icono n="cerrar" /></button>
      <div class="historia-pantalla" key={p.id} aria-live="polite">
        {p.render()}
        {ultima && <button class="btn btn-grande historia-fin" onClick={alCerrar}>Ver el resumen</button>}
      </div>
      <button class="historia-zona anterior" onClick={() => ir(-1)} disabled={i === 0} aria-label="Tarjeta anterior" />
      <button class="historia-zona siguiente" onClick={() => (ultima ? alCerrar() : ir(1))} aria-label={ultima ? 'Ir al resumen' : 'Tarjeta siguiente'} />
    </div>
  );
}
