import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono, Capa } from '../comunes.jsx';
import { vibrar } from '../hapticos.js';
import { sinMovimiento } from '../transiciones.js';
import { nuevaEtapa, avanzar, saltar, resultado, textoDistancia } from '../../logica/travesia.js';
import { apuntarEtapa, leerTravesia } from '../travesia.js';
import { nuevoPaisaje, pintar } from './travesia-pinta.js';

// «La travesía»: el juego del descanso, a pantalla completa. Un toque en cualquier sitio, salta; otro en el aire, doble
// salto. La etapa dura lo que queda de descanso (`fin`, el mismo final que lleva el temporizador: si se le suma o se le
// quita tiempo, o se pausa, el juego va con él) y al acabar se cierra sola: manda el descanso, no el juego.
//   · Con `sesion`, los metros se suman a la travesía de esa sesión. Sin ella (`practica`), es una carrera de un minuto
//     que no cuenta: solo guarda su mejor marca.
//   · alCerrar(motivo): 'fin' (se acabó el tiempo) o 'salir' (la cerró a mano).
const PRACTICA = 60;
const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

// (dentro de su capa, en <body>: cuando corren sus efectos el lienzo ya existe, y ningún antepasado con transform la encierra)
export function Travesia(props) { return <Capa><TravesiaDentro {...props} /></Capa>; }
function TravesiaDentro({ atletaId, sesion = null, fin = null, pausa = null, despues = '', practica = false, alCerrar }) {
  const lienzo = useRef(null);
  const caja = useRef(null);
  const etapa = useRef(null);
  const paisaje = useRef(null);
  const marca = useRef({ fin, pausa });
  marca.current = { fin, pausa };
  const [ronda, setRonda] = useState(0);            // (práctica) otra carrera
  const finPractica = useRef(0);
  const [final, setFinal] = useState(null);         // { metros, estrellas, hoy, mejor, marca } al acabar la etapa
  const [tocado, setTocado] = useState(false);      // ya ha saltado una vez: fuera la pista
  const metros = useRef(null), cuenta = useRef(null), estrellas = useRef(null);
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;
  // Cerrada a mano en mitad de un descanso: lo corrido hasta ahí cuenta (si ha llegado a algo); la práctica a medias, no
  const apuntada = useRef(false);
  const salir = () => {
    const e = etapa.current;
    if (!practica && sesion && e && !apuntada.current && e.x >= 20) { apuntada.current = true; const r = resultado(e); apuntarEtapa(atletaId, { sesion, metros: r.metros, estrellas: r.estrellas }); }
    alCerrar?.('salir');
  };

  useEffect(() => {
    const semilla = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    const e = nuevaEtapa(semilla);
    etapa.current = e; apuntada.current = false;
    paisaje.current = nuevoPaisaje(semilla % 1000);
    setFinal(null);
    if (practica) finPractica.current = Date.now() + PRACTICA * 1000;
    const c = lienzo.current, ctx = c.getContext('2d');
    const quieto = sinMovimiento();
    let w = 0, h = 0, id = 0, antes = performance.now(), acabada = false, visto = { m: -1, s: -1, e: -1 };
    const medir = () => {
      const r = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(c);
    const quedan = () => {
      const m = marca.current;
      if (practica) return (finPractica.current - Date.now()) / 1000;
      return Number.isFinite(m.pausa) ? m.pausa / 1000 : (m.fin - Date.now()) / 1000;
    };
    const acabar = () => {
      acabada = true; apuntada.current = true;
      const r = resultado(e);
      const antesG = leerTravesia(atletaId);
      const g = apuntarEtapa(atletaId, { sesion: practica ? null : sesion, metros: r.metros, estrellas: r.estrellas });
      vibrar('hecho');
      setFinal({ ...r, hoy: !practica && sesion ? g.sesiones[sesion]?.metros ?? r.metros : null, etapas: !practica && sesion ? g.sesiones[sesion]?.etapas ?? 1 : null,
        marca: practica ? r.metros > antesG.practica && antesG.practica > 0 : r.metros > antesG.mejor && antesG.mejor > 0, mejor: practica ? g.practica : g.mejor });
    };
    const cuadro = (ahora) => {
      id = requestAnimationFrame(cuadro);
      const dt = Math.min(0.1, (ahora - antes) / 1000);
      antes = ahora;
      const q = quedan();
      const parado = acabada || (!practica && Number.isFinite(marca.current.pausa)) || document.visibilityState === 'hidden';
      if (!parado && q <= 0) acabar();
      else if (!parado) avanzar(e, dt);
      pintar(ctx, e, paisaje.current, { w, h, t: ahora / 1000, dt: parado ? 0 : dt, quieto });
      // (los números de arriba, solo cuando cambian)
      const m = Math.round(e.x), s = Math.max(0, Math.ceil(q));
      if (m !== visto.m && metros.current) { visto.m = m; metros.current.textContent = textoDistancia(m); }
      if (s !== visto.s && cuenta.current) { visto.s = s; cuenta.current.textContent = mmss(s); cuenta.current.classList.toggle('ultimos', s <= 3 && s > 0); }
      if (e.estrellasCogidas !== visto.e && estrellas.current) { visto.e = e.estrellasCogidas; estrellas.current.textContent = String(e.estrellasCogidas); }
    };
    id = requestAnimationFrame(cuadro);
    return () => { cancelAnimationFrame(id); ro?.disconnect(); };
  }, [ronda]);

  // Al acabar el descanso se cierra sola al poco (da tiempo a ver la etapa); en práctica espera a que elija
  useEffect(() => {
    if (!final || practica) return undefined;
    const t = setTimeout(() => cerrar.current?.('fin'), 3200);
    return () => clearTimeout(t);
  }, [final]);

  useEffect(() => { caja.current?.focus({ preventScroll: true }); }, []);

  const toque = (ev) => {
    if (ev.target.closest?.('button')) return;
    ev.preventDefault();
    if (final || !etapa.current) return;
    if (saltar(etapa.current)) { if (!tocado) setTocado(true); vibrar('elegir'); }
  };
  const tecla = (ev) => {
    if (ev.key === 'Escape') { ev.stopPropagation(); salir(); return; }
    if (ev.target.closest?.('button')) return;
    if (ev.key === ' ' || ev.key === 'ArrowUp' || ev.key === 'Enter') { ev.preventDefault(); if (!final && etapa.current && saltar(etapa.current) && !tocado) setTocado(true); }
  };

  return (
    <div ref={caja} class="travesia" role="dialog" aria-modal="true" aria-label={practica ? 'La travesía: práctica de un minuto' : 'La travesía: el juego del descanso'} tabIndex={-1}
      onPointerDown={toque} onKeyDown={tecla}>
      <canvas ref={lienzo} class="travesia-lienzo" role="img" aria-label="Un lobo corre de noche por la montaña. Toca la pantalla o pulsa la barra espaciadora para saltar." />
      <div class="travesia-arriba">
        <span class="travesia-dato" aria-label="Distancia de esta etapa"><Icono n="pasos" /><b ref={metros} class="num">0 m</b></span>
        <span class="travesia-cuenta" role="timer" aria-live="off" aria-label={practica ? 'Tiempo de práctica' : 'Descanso'}><b ref={cuenta} class="num">{mmss(practica ? PRACTICA : 0)}</b><small>{practica ? 'práctica' : 'descanso'}</small></span>
        <span class="travesia-dato oro" aria-label="Estrellas"><Icono n="estrella" /><b ref={estrellas} class="num">0</b></span>
        <button type="button" class="travesia-cerrar" onClick={salir} aria-label="Cerrar el juego"><Icono n="cerrar" /></button>
      </div>
      {!final && !tocado && <p class="travesia-pista" aria-hidden="true">Toca para saltar · otra vez en el aire, doble salto</p>}
      {!final && despues && !practica && <p class="travesia-despues">Después: {despues}</p>}
      {final && (
        <div class="travesia-final" role="status">
          <span class="travesia-final-etq">{practica ? 'Práctica' : '¡Vamos!'}</span>
          <strong class="num">{textoDistancia(final.metros)}</strong>
          <span class="travesia-final-det">
            {final.estrellas > 0 && <span class="oro"><Icono n="estrella" />{final.estrellas}</span>}
            {final.marca && <span class="oro">Tu mejor {practica ? 'marca' : 'etapa'}</span>}
            {final.hoy != null && final.etapas > 1 && <span>Hoy llevas {textoDistancia(final.hoy)}</span>}
            {practica && !final.marca && final.mejor > final.metros && <span>Tu marca: {textoDistancia(final.mejor)}</span>}
          </span>
          {practica
            ? <div class="travesia-final-botones"><button type="button" class="btn btn-primario" onClick={() => setRonda((n) => n + 1)}>Otra</button><button type="button" class="btn" onClick={() => alCerrar?.('salir')}>Cerrar</button></div>
            : <button type="button" class="btn btn-primario" onClick={() => alCerrar?.('fin')}>A por la serie</button>}
        </div>
      )}
    </div>
  );
}
