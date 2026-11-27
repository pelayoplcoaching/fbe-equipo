// (belleza 161) El final de la sesión como una historia de tres tarjetas, antes del resumen: lo que has hecho, tus récords
// de hoy (si los hay) y tus músculos de hoy. Como «Tu semana» (TuSemana.jsx): las barras de arriba, tocar a los lados para
// pasar, la ✕ para ir al resumen y, con la última, «Ver el resumen». Sale detrás de la escena de la luna y solo cuando
// esta sale (sin «reducir movimiento»): quien no la ve va derecho al resumen, que trae lo mismo. Cada tarjeta, con su
// ilustración abajo (historia-hecho, historia-records e historia-musculos, de datos/imagenes-trozos.json) si ha llegado.
// (belleza 301-304) Contada: en la primera tarjeta, tus series aparecen una a una en el orden en que las hiciste, cada una
// con su nota (la melodía de tu sesión; sin sonido, en silencio); los récords caen como medallas, cada uno con su «clinc»
// y su toque; los músculos se pintan en el orden en que los trabajaste; y cada tarjeta se comparte tal cual (el botón de
// arriba). (325) En la de récords, el botón de tu canción de récord, si la elegiste (el navegador no deja que suene sola).
import { useEffect, useRef, useState } from 'preact/hooks';
import { Capa, Icono } from '../comunes.jsx';
import { useHistoriaTacto } from '../historia-tacto.js';
import { MapaMuscular } from '../MapaMuscular.jsx';
import { Imagen, hayImagen } from '../Imagen.jsx';
import { num, NOMBRE_GRUPO } from '../../logica/calculos.js';
import { cifrasHistoriaSesion, melodiaSesion, ordenMusculos } from '../../logica/sesion-final.js';
import { nota, puedeSonar } from '../../logica/sonido.js';
import { tenirBarra } from '../barra-color.js';
import { sonarFBE } from '../sonido.js';
import { leerAjustes } from '../ajustes.js';
import { vibrar } from '../hapticos.js';
import { HojaCompartir } from '../Compartir.jsx';
import { PonTuCancion } from './Musica.jsx';

const NOCHE = '#1E1548';
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
// En un navegador automático (las pruebas), solo si la prueba la pide (fbe-probar-historia): así no tapa el resumen que
// miran las demás pruebas, como la onda de belleza.js o la escena de la bienvenida
export const hayHistoriaSesion = () => !(typeof navigator !== 'undefined' && navigator.webdriver && !leer('fbe-probar-historia'));
const FONDO = { hecho: 'historia-hecho', records: 'historia-records', musculos: 'historia-musculos' };

export function HistoriaSesion(props) { return <Capa><Pantallas {...props} /></Capa>; }

// (301) La melodía de tu sesión: una fila de puntos por ejercicio (uno por serie, con el color de su esfuerzo; el récord,
// en dorado) que van apareciendo en el orden de la sesión, cada uno con su nota, en unos seis segundos. Cada punto, un
// escalón más alto que el anterior de su fila (--k), como su nota: las series suben
function Melodia({ filas }) {
  const caja = useRef(null);
  useEffect(() => {
    const el = caja.current;
    const notas = melodiaSesion(filas, nota);
    if (!el || !notas.length || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const puntos = [...el.querySelectorAll('.hs-mel-p')];
    const anims = [];
    puntos.forEach((p, i) => {
      if (!notas[i]) return;
      try { anims.push(p.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.45)', offset: 0.55 }, { transform: 'none' }], { duration: 300, delay: 300 + notas[i].d * 1000, easing: 'cubic-bezier(.2, .9, .3, 1.2)', fill: 'backwards' })); } catch { /* de golpe */ }
    });
    const relojes = puedeSonar(leerAjustes(), 'serie') ? notas.map((x) => setTimeout(() => sonarFBE('nota', { f: x.f, v: x.rec ? 0.75 : 0.5, dura: x.dura }), 300 + x.d * 1000)) : [];
    return () => { anims.forEach((a) => a.cancel()); relojes.forEach(clearTimeout); };
  }, []);
  return (
    <div class="hs-mel" ref={caja} aria-hidden="true">
      {filas.map((f, i) => <span class="hs-mel-fila" key={i}>{f.puntos.map((p, k) => <i key={k} class="hs-mel-p" data-t={p.rec ? 'rec' : p.t} style={`--k:${Math.min(7, k)}`} />)}</span>)}
    </div>
  );
}

// (303) Los músculos, en el orden en que los trabajaste: se van pintando uno a uno (con un pulso al pintarse)
function MusculosEnOrden({ musculos }) {
  const orden = ordenMusculos(musculos);
  const quieto = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [k, setK] = useState(quieto ? orden.length : 0);
  const caja = useRef(null);
  useEffect(() => {
    if (k >= orden.length) return undefined;
    const t = setTimeout(() => setK((x) => x + 1), k ? 380 : 500);
    return () => clearTimeout(t);
  }, [k]);
  useEffect(() => {
    if (!k || quieto) return;
    caja.current?.querySelectorAll(`[data-g="${orden[k - 1]}"]`).forEach((el) => { try { el.animate([{ transform: 'scale(1.14)' }, { transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.2, .9, .3, 1.2)' }); } catch { /* */ } });
  }, [k]);
  const parcial = Object.fromEntries(orden.slice(0, k).map((g) => [g, musculos[g]]));
  return <div class="hs-musc" ref={caja}><MapaMuscular series={parcial} todas={musculos} etiqueta="Series por músculo de hoy" leyenda={false} /></div>;
}

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
        {r.huella?.length > 0 && <Melodia filas={r.huella} />}
      </>
    ), comp: !!r.tarjeta },
    ...(r.records?.length ? [{ id: 'records', render: () => (
      <>
        <span class="historia-etq">Tus récords de hoy</span>
        <p class="historia-cifra num">{r.records.length}<small>{r.records.length === 1 ? 'récord' : 'récords'}</small></p>
        <ul class="historia-lista">
          {r.records.slice(0, 3).map((x) => <li key={x.nombre}><Icono n="trofeo" class="hs-medalla" /><span><strong>{x.nombre}</strong><br />{x.r?.texto}</span></li>)}
        </ul>
        {r.records.length > 3 && <p class="historia-texto">y {r.records.length - 3} más en el resumen</p>}
        <span class="hs-cancion"><PonTuCancion /></span>
      </>
    ), comp: true }] : []),
    ...(grupos.length ? [{ id: 'musculos', render: () => (
      <>
        <span class="historia-etq">Tus músculos de hoy</span>
        <h2>{NOMBRE_GRUPO[grupos[0][0]] || grupos[0][0]}<small>{num(grupos[0][1])} {grupos[0][1] === 1 ? 'serie' : 'series'}{grupos.length > 1 ? `, y ${grupos.length - 1} ${grupos.length === 2 ? 'grupo más' : 'grupos más'}` : ''}</small></h2>
        <MusculosEnOrden musculos={r.musculos} />
      </>
    ), comp: true }] : []),
  ];
  const [i, setI] = useState(0);
  const quieto = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const ultima = i === pantallas.length - 1;
  const ir = (d) => setI((x) => Math.max(0, Math.min(pantallas.length - 1, x + d)));
  const caja = useRef(null);
  // (304) la tarjeta que se está compartiendo (mientras, la historia se para)
  const [carta, setCarta] = useState(null);
  // (tacto 226-228) mantener pulsado la para; deslizar hacia abajo la cierra (al resumen) y, de lado, pasa de tarjeta
  const pausa = useHistoriaTacto(caja, { i, n: pantallas.length, ir, alCerrar, parada: !!carta });
  // Avanza sola cada 7 s, como «Tu semana» (no con movimiento reducido, ni en la última, ni en pausa)
  useEffect(() => {
    if (quieto || ultima || pausa || carta) return undefined;
    const t = setTimeout(() => ir(1), 7000);
    return () => clearTimeout(t);
  }, [i, pausa, carta]);
  // (302) los récords caen como medallas, uno detrás de otro, cada uno con su «clinc» y su toque al llegar
  useEffect(() => {
    if (pantallas[i]?.id !== 'records' || quieto) return undefined;
    const meds = [...(caja.current?.querySelectorAll('.hs-medalla') || [])];
    const conSonido = puedeSonar(leerAjustes(), 'clinc');
    const relojes = [];
    meds.forEach((m, k) => {
      const t = 380 + k * 440;
      try { m.animate([{ transform: 'translateY(-84px) rotate(-38deg) scale(1.3)', opacity: 0 }, { transform: 'translateY(0) rotate(9deg) scale(1)', opacity: 1, offset: 0.62 }, { transform: 'translateY(-5px) rotate(-3deg)', offset: 0.82 }, { transform: 'none' }], { duration: 560, delay: t, easing: 'cubic-bezier(.3, .7, .4, 1)', fill: 'backwards' }); } catch { /* de golpe */ }
      relojes.push(setTimeout(() => { if (conSonido) sonarFBE('clinc'); vibrar('toque'); }, t + 347));
    });
    return () => relojes.forEach(clearTimeout);
  }, [i]);
  const abrirCarta = (id) => import('../../logica/historia-cartas.js').then((m) => { const c = m.cartaSesion(r, id, { nombre }); if (c) setCarta(c); }).catch(() => {});
  useEffect(() => {
    const volver = tenirBarra(NOCHE);
    caja.current?.focus();
    // (304) con la hoja de compartir abierta encima, las teclas son suyas
    const tecla = (e) => { if (document.querySelectorAll('[aria-modal="true"]').length > 1) return; if (e.key === 'Escape') alCerrar(); if (e.key === 'ArrowRight') ir(1); if (e.key === 'ArrowLeft') ir(-1); };
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
      {p.comp && <button type="button" class="btn btn-icono plano historia-cerrar historia-comp" onClick={() => abrirCarta(p.id)} aria-label="Compartir esta tarjeta"><Icono n="compartir" /></button>}
      <div class="historia-pantalla" key={p.id} aria-live="polite">
        {p.render()}
        {ultima && <button class="btn btn-grande historia-fin" onClick={alCerrar}>Ver el resumen</button>}
      </div>
      <button class="historia-zona anterior" onClick={() => ir(-1)} disabled={i === 0} aria-label="Tarjeta anterior" />
      <button class="historia-zona siguiente" onClick={() => (ultima ? alCerrar() : ir(1))} aria-label={ultima ? 'Ir al resumen' : 'Tarjeta siguiente'} />
      {carta && (carta.sesion
        ? <HojaCompartir plantillas datos={carta.datos} titulo="Compartir la sesión" alCerrar={() => setCarta(null)} />
        : <HojaCompartir logro tipo={carta.tipo} datos={carta} titulo="Compartir esta tarjeta" equipo={{ tema: 'logros' }} alCerrar={() => setCarta(null)} />)}
    </div>
  );
}
