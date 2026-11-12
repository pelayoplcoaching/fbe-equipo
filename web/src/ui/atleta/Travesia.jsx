import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono, Capa, useApp } from '../comunes.jsx';
import { vibrar } from '../hapticos.js';
import { sinMovimiento } from '../transiciones.js';
import { nuevaEtapa, avanzar, saltar, agachar, pulsar, resultado, textoDistancia, ambiente, retoDelDia, progresoReto, hoyDe } from '../../logica/travesia.js';
import { hoyISO } from '../../logica/fechas.js';
import { leerAjustes, guardarAjustes } from '../ajustes.js';
import { tono, prepararAudio } from './sesion-comun.jsx';
import { apuntarEtapa, leerTravesia, sincronizarTravesia } from '../travesia.js';
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
// (al integrarla) lo que queda de descanso ya en el primer pintado (antes, 0:00 hasta el primer cuadro de la animación)
const cuentaInicial = (fin, pausa) => Math.max(0, Math.ceil(Number.isFinite(pausa) ? pausa / 1000 : Number.isFinite(fin) ? (fin - Date.now()) / 1000 : 0));

// (tanda 1) el tiempo que la app ya tiene guardado para esta hora (si el atleta usa «El tiempo para salir»): { codigo, esDia }
function tiempoGuardado() {
  try {
    const c = JSON.parse(localStorage.getItem('fbe-tiempo-cache') || 'null');
    const horas = c?.prev?.horas;
    if (!Array.isArray(horas) || Date.now() - (c.en || 0) > 3 * 3600000) return {};
    const ahora = new Date(Date.now() + (c.prev.offset || 0) * 1000).toISOString().slice(0, 13);
    const h = horas.find((x) => String(x.hora).slice(0, 13) === ahora);
    return h ? { codigo: h.codigo, esDia: typeof h.dia === 'boolean' ? h.dia : null } : {};
  } catch { return {}; }
}
// (tanda 1) los sonidos del juego (apagados de entrada): un toque al saltar, uno agudo en cada estrella y el aullido al acabar
const SONIDOS = { salto: [520, 0.05, 0.1], doble: [660, 0.05, 0.1], estrella: [1180, 0.06, 0.12], tropiezo: [150, 0.14, 0.16], escudo: [880, 0.1, 0.14], rio: [784, 0.12, 0.14] };
const aullar = () => { [[392, 0], [523, 260], [494, 620]].forEach(([f, ms]) => setTimeout(() => tono(f, ms ? 0.5 : 0.28, 0.16), ms)); };

function TravesiaDentro({ atletaId, sesion = null, fin = null, pausa = null, total = null, despues = '', practica = false, empuje = null, alCerrar }) {
  const { api } = useApp() || {};
  const lienzo = useRef(null);
  const caja = useRef(null);
  const etapa = useRef(null);
  const paisaje = useRef(null);
  const marca = useRef({ fin, pausa });
  marca.current = { fin, pausa };
  const [ronda, setRonda] = useState(0);            // (práctica) otra carrera; (calma) al cambiar de modo
  const finPractica = useRef(0);
  const [final, setFinal] = useState(null);         // { metros, estrellas, hoy, mejor, marca, reto } al acabar la etapa
  const [tocado, setTocado] = useState(false);      // ya ha saltado una vez: fuera la pista
  const metros = useRef(null), cuenta = useRef(null), estrellas = useRef(null), retoTxt = useRef(null);
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;
  // (tanda 1) el modo calma (sin obstáculos, al paso) y el sonido, que se recuerdan en el móvil
  const [calma, setCalma] = useState(() => leerAjustes().calmaJuego === true);
  const [sonido, setSonido] = useState(() => leerAjustes().sonidoJuego === true);
  const suena = useRef(sonido);
  suena.current = sonido;
  const [escudos, setEscudos] = useState(0);
  const guardado0 = useRef(null);
  if (!guardado0.current) guardado0.current = leerTravesia(atletaId);
  const conMovimientos = guardado0.current.total >= 1000;   // las ramas, cuando ya lleva un kilómetro (primero se aprende a saltar)
  const reto = !practica && sesion ? retoDelDia(hoyISO()) : null;
  // Cerrada a mano en mitad de un descanso: lo corrido hasta ahí cuenta (si ha llegado a algo); la práctica a medias, no
  const apuntada = useRef(false);
  const apuntar = (e) => {
    const r = resultado(e);
    const g = apuntarEtapa(atletaId, { sesion: practica ? null : sesion, metros: r.metros, estrellas: r.estrellas, segundos: r.segundos, tropiezos: r.tropiezos, rios: r.rios, calma: r.calma, dia: hoyISO() });
    if (!practica && sesion) sincronizarTravesia(api, atletaId);   // (060) a la base; si no se puede, se queda pendiente
    return { r, g };
  };
  const salir = () => {
    const e = etapa.current;
    if (!practica && sesion && e && !apuntada.current && e.x >= 20) { apuntada.current = true; apuntar(e); }
    alCerrar?.('salir');
  };

  useEffect(() => {
    const semilla = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    const antesG = leerTravesia(atletaId);
    const quedanIni = practica ? PRACTICA : cuentaInicial(marca.current.fin, marca.current.pausa);
    // (tanda 1) el entreno empuja: tras un récord sale con el ritmo cogido; con la serie cumplida, un escudo. En un descanso
    // corto (45 s o menos) sale ya lanzado: no da tiempo a coger ritmo
    const e = nuevaEtapa(semilla, {
      calma, movimientos: conMovimientos && !practica, km0: practica ? 0 : antesG.total,
      racha0: practica ? 0 : empuje?.ritmo ? 10 : quedanIni <= 45 ? 6 : 0,
      escudos: practica ? 0 : empuje?.escudo ? 1 : 0,
    });
    etapa.current = e; apuntada.current = false;
    setEscudos(e.escudos);
    paisaje.current = nuevoPaisaje(semilla % 1000);
    setFinal(null);
    if (practica) finPractica.current = Date.now() + PRACTICA * 1000;
    const amb = ambiente({ ...tiempoGuardado(), total: antesG.total });
    const ritmo = !calma && antesG.ritmo > 0 ? antesG.ritmo / 100 : 0;   // su fantasma
    const hoy0 = hoyDe(antesG, hoyISO());
    const c = lienzo.current, ctx = c.getContext('2d');
    const quieto = sinMovimiento();
    let w = 0, h = 0, id = 0, antes = performance.now(), acabada = false, visto = { m: -1, s: -1, e: -1, r: '', esc: e.escudos };
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
      const { r, g } = apuntar(e);
      vibrar('hecho');
      if (suena.current) aullar();
      setFinal({ ...r, hoy: !practica && sesion ? g.sesiones[sesion]?.metros ?? r.metros : null, etapas: !practica && sesion ? g.sesiones[sesion]?.etapas ?? 1 : null,
        marca: practica ? r.metros > antesG.practica && antesG.practica > 0 : !r.calma && r.metros > antesG.mejor && antesG.mejor > 0, mejor: practica ? g.practica : g.mejor,
        reto: !practica && sesion && g.hoy.retoHecho && !hoy0.retoHecho });
    };
    const cuadro = (ahora) => {
      id = requestAnimationFrame(cuadro);
      const dt = Math.min(0.1, (ahora - antes) / 1000);
      antes = ahora;
      const q = quedan();
      const parado = acabada || (!practica && Number.isFinite(marca.current.pausa)) || document.visibilityState === 'hidden';
      if (!parado && q <= 0) acabar();
      else if (!parado) avanzar(e, dt);
      if (suena.current) for (const s of e.sucesos) if (SONIDOS[s]) tono(...SONIDOS[s]);
      pintar(ctx, e, paisaje.current, { w, h, t: ahora / 1000, dt: parado ? 0 : dt, quieto, amb, fantasma: ritmo ? ritmo * e.t : null });
      // (los números de arriba, solo cuando cambian)
      const m = Math.round(e.x), s = Math.max(0, Math.ceil(q));
      if (m !== visto.m && metros.current) { visto.m = m; metros.current.textContent = textoDistancia(m); }
      if (s !== visto.s && cuenta.current) { visto.s = s; cuenta.current.textContent = mmss(s); cuenta.current.classList.toggle('ultimos', s <= 3 && s > 0); }
      if (e.estrellasCogidas !== visto.e && estrellas.current) { visto.e = e.estrellasCogidas; estrellas.current.textContent = String(e.estrellasCogidas); }
      if (e.escudos !== visto.esc) { visto.esc = e.escudos; setEscudos(e.escudos); }
      if (reto && retoTxt.current) {
        // (el reto, con lo de hoy más lo de esta etapa)
        const ahoraH = { ...hoy0, metros: hoy0.metros + m, estrellas: hoy0.estrellas + e.estrellasCogidas, etapas: hoy0.etapas + 1, mejor: Math.max(hoy0.mejor, e.calma ? 0 : m) };
        const pr = hoy0.retoHecho ? { valor: reto.meta, meta: reto.meta, hecho: true } : progresoReto(reto, ahoraH);
        const txt = pr.hecho ? `Reto de hoy, cumplido: ${reto.texto.toLowerCase()}` : `Reto de hoy: ${reto.texto.toLowerCase()} (${pr.valor}/${pr.meta})`;
        if (txt !== visto.r) { visto.r = txt; retoTxt.current.textContent = txt; retoTxt.current.classList.toggle('hecho', pr.hecho); }
      }
    };
    id = requestAnimationFrame(cuadro);
    return () => { cancelAnimationFrame(id); ro?.disconnect(); };
  }, [ronda, calma]);

  // Al acabar el descanso se cierra sola al poco (da tiempo a ver la etapa); en práctica espera a que elija
  useEffect(() => {
    if (!final || practica) return undefined;
    const t = setTimeout(() => cerrar.current?.('fin'), 3200);
    return () => clearTimeout(t);
  }, [final]);

  useEffect(() => { caja.current?.focus({ preventScroll: true }); }, []);

  // Un toque salta (mantenerlo alarga el salto); deslizar hacia abajo, agacharse
  const dedo = useRef(null);
  const toque = (ev) => {
    if (ev.target.closest?.('button')) return;
    ev.preventDefault();
    if (final || !etapa.current) return;
    dedo.current = { id: ev.pointerId, y: ev.clientY, bajo: false };
    pulsar(etapa.current, true);
    if (suena.current) prepararAudio();
    if (saltar(etapa.current)) { if (!tocado) setTocado(true); vibrar('elegir'); }
  };
  const mueve = (ev) => {
    const d = dedo.current;
    if (!d || d.id !== ev.pointerId || d.bajo || !etapa.current || ev.clientY - d.y < 26) return;
    d.bajo = true;
    pulsar(etapa.current, false);
    if (agachar(etapa.current)) vibrar('elegir');
  };
  const suelta = () => { dedo.current = null; if (etapa.current) pulsar(etapa.current, false); };
  const tecla = (ev) => {
    if (ev.key === 'Escape') { ev.stopPropagation(); salir(); return; }
    if (ev.target.closest?.('button')) return;
    if (ev.key === 'ArrowDown') { ev.preventDefault(); if (!final && etapa.current) agachar(etapa.current); return; }
    if (ev.key === ' ' || ev.key === 'ArrowUp' || ev.key === 'Enter') { ev.preventDefault(); if (!final && etapa.current && saltar(etapa.current) && !tocado) setTocado(true); }
  };
  const cambiarCalma = () => {
    const e = etapa.current;
    // (lo corrido hasta aquí cuenta, como al cerrar a mano; y la etapa vuelve a empezar en el otro modo)
    if (!practica && sesion && e && !apuntada.current && e.x >= 20) { apuntada.current = true; apuntar(e); }
    const v = !calma; setCalma(v); guardarAjustes({ ...leerAjustes(), calmaJuego: v });
  };
  const cambiarSonido = () => { const v = !sonido; setSonido(v); guardarAjustes({ ...leerAjustes(), sonidoJuego: v }); if (v) { prepararAudio(); tono(...SONIDOS.estrella); } };

  return (
    <div ref={caja} class={`travesia${calma ? ' en-calma' : ''}`} role="dialog" aria-modal="true" aria-label={practica ? 'La travesía: práctica de un minuto' : 'La travesía: el juego del descanso'} tabIndex={-1}
      onPointerDown={toque} onPointerMove={mueve} onPointerUp={suelta} onPointerCancel={suelta} onKeyDown={tecla}>
      <canvas ref={lienzo} class="travesia-lienzo" role="img" aria-label="Un lobo corre por la montaña. Toca la pantalla o pulsa la barra espaciadora para saltar; desliza hacia abajo o pulsa la flecha abajo para agacharte." />
      <div class="travesia-arriba">
        <span class="travesia-dato" aria-label="Distancia de esta etapa"><Icono n="pasos" /><b ref={metros} class="num">0 m</b></span>
        <span class="travesia-cuenta" role="timer" aria-live="off" aria-label={practica ? 'Tiempo de práctica' : 'Descanso'}><b ref={cuenta} class="num">{mmss(practica ? PRACTICA : cuentaInicial(fin, pausa))}</b><small>{practica ? 'práctica' : 'descanso'}</small></span>
        <span class="travesia-dato oro" aria-label="Estrellas"><Icono n="estrella" /><b ref={estrellas} class="num">0</b></span>
        <button type="button" class="travesia-cerrar" onClick={salir} aria-label="Cerrar el juego"><Icono n="cerrar" /></button>
      </div>
      {!final && (
        <div class="travesia-modos">
          <button type="button" class="travesia-modo" aria-pressed={calma ? 'true' : 'false'} onClick={cambiarCalma} title="Sin obstáculos y al paso, para respirar tras una serie dura"><Icono n="sueno" />Calma</button>
          <button type="button" class="travesia-modo" aria-pressed={sonido ? 'true' : 'false'} onClick={cambiarSonido} aria-label={sonido ? 'Quitar el sonido del juego' : 'Poner el sonido del juego'}><Icono n={sonido ? 'altavoz' : 'silencio'} /></button>
          {escudos > 0 && <span class="travesia-escudo" role="status" aria-label={`${escudos === 1 ? 'Un escudo' : `${escudos} escudos`}: te perdona un tropiezo`}><Icono n="escudo" />{escudos}</span>}
        </div>
      )}
      {!final && !tocado && !calma && <p class="travesia-pista" aria-hidden="true">Toca para saltar · otra vez en el aire, doble salto{conMovimientos && !practica ? ' · desliza abajo para agacharte' : ''}</p>}
      {!final && calma && <p class="travesia-pista calma" aria-hidden="true">Respira: el lobo va al paso</p>}
      {!final && reto && <p ref={retoTxt} class="travesia-reto" role="status" />}
      {!final && despues && !practica && <p class="travesia-despues">Después: {despues}</p>}
      {final && (
        <div class="travesia-final" role="status">
          <span class="travesia-final-etq">{practica ? 'Práctica' : '¡Vamos!'}</span>
          <strong class="num">{textoDistancia(final.metros)}</strong>
          <span class="travesia-final-det">
            {final.estrellas > 0 && <span class="oro"><Icono n="estrella" />{final.estrellas}</span>}
            {final.rios > 0 && <span>{final.rios === 1 ? 'Un río cruzado' : `${final.rios} ríos cruzados`}</span>}
            {final.marca && <span class="oro">Tu mejor {practica ? 'marca' : 'etapa'}</span>}
            {final.reto && <span class="oro">Reto del día, cumplido</span>}
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
