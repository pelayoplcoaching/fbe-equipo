import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono } from './comunes.jsx';
import { textoMomento, partirMomentos } from '../logica/momentos.js';
import { grados, rectImagen, limpiarDibujo, describirDibujo, MAX_FORMAS } from '../logica/dibujo.js';
export { textoMomento };

// Reproductor para revisar técnica: cámara lenta (0,25×, 0,5×, 1×), fotograma a fotograma, bucle y
// «marcar el momento» para comentarlo. Los comentarios con un minuto («0:04 …») saltan a ese punto.
// Cada reproductor se registra por el id del archivo para que la conversación de al lado lo encuentre.
// Desde la v0.14, líneas y ángulos sobre un fotograma: se dibujan en pausa y van con el comentario; al
// abrir un comentario con dibujo, el vídeo salta a ese momento y lo enseña encima.

const reproductores = new Map(); // archivoId → { ahora(), ir(t), mostrar(dibujo), dibujar(alTerminar) }
export const reproductorDe = (archivoId) => reproductores.get(archivoId) || null;

const FOTOGRAMA = 1 / 30;
const VELOCIDADES = [[0.25, '0,25×'], [0.5, '0,5×'], [1, '1×']];

export function Reproductor({ src, archivoId = null }) {
  const v = useRef(null);
  const marco = useRef(null);
  const [listo, setListo] = useState(false);
  const [jugando, setJugando] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [vel, setVel] = useState(1);
  const [bucle, setBucle] = useState(true);
  // Dibujo: el que se enseña (de un comentario) o el que se está haciendo
  const [caja, setCaja] = useState({ w: 0, h: 0, vw: 0, vh: 0 });
  const [visto, setVisto] = useState(null);          // dibujo de un comentario, con su momento
  const [edicion, setEdicion] = useState(null);      // { formas, herramienta, enCurso, alTerminar }
  const edicionRef = useRef(null);
  edicionRef.current = edicion;

  useEffect(() => {
    if (!archivoId) return undefined;
    const api = {
      ahora: () => v.current?.currentTime || 0,
      ir: (seg) => {
        const el = v.current; if (!el) return;
        el.pause(); el.currentTime = Math.min(Math.max(0, seg), el.duration || seg);
        el.scrollIntoView?.({ block: 'nearest' });
      },
      reproducir: () => { const el = v.current; if (el && !edicionRef.current) el.play().catch(() => {}); },
      pausar: () => v.current?.pause(),
      proporcion: () => { const el = v.current; return el?.videoWidth && el?.videoHeight ? el.videoWidth / el.videoHeight : 1; },
      // Si había un dibujo a medias, quien lo pidió se entera de que se ha descartado
      mostrar: (dibujo) => { edicionRef.current?.alTerminar?.(null); setEdicion(null); setVisto(dibujo); api.ir(dibujo.t); },
      dibujar: (alTerminar) => { edicionRef.current?.alTerminar?.(null); v.current?.pause(); setVisto(null); setEdicion({ formas: [], herramienta: 'linea', enCurso: null, alTerminar }); v.current?.scrollIntoView?.({ block: 'nearest' }); },
    };
    reproductores.set(archivoId, api);
    return () => { if (reproductores.get(archivoId) === api) reproductores.delete(archivoId); };
  }, [archivoId]);

  // El tamaño del vídeo en pantalla (para que el dibujo caiga sobre la imagen, no sobre las bandas negras)
  useEffect(() => {
    const el = v.current; if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const medir = () => setCaja({ w: el.clientWidth, h: el.clientHeight, vw: el.videoWidth, vh: el.videoHeight });
    const ro = new ResizeObserver(medir); ro.observe(el); medir();
    return () => ro.disconnect();
  }, [listo]);

  const el = () => v.current;
  const alternar = () => { const x = el(); if (!x || edicion) return; if (x.paused) x.play().catch(() => {}); else x.pause(); };
  const paso = (n) => { const x = el(); if (!x) return; x.pause(); x.currentTime = Math.min(Math.max(0, x.currentTime + n * FOTOGRAMA), x.duration || 0); };
  const fijarVel = (r) => { setVel(r); if (el()) el().playbackRate = r; };
  const tecla = (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'range' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); alternar(); }
    else if (e.key === ',' || e.key === 'ArrowLeft') { e.preventDefault(); paso(-1); }
    else if (e.key === '.' || e.key === 'ArrowRight') { e.preventDefault(); paso(1); }
  };
  // Un dibujo enseñado se quita al reproducir o al irse lejos de su momento
  const alTiempo = (tt) => { setT(tt); if (visto && Math.abs(tt - visto.t) > 0.35) setVisto(null); };

  const rect = rectImagen(caja.w, caja.h, caja.vw, caja.vh);
  const proporcion = rect.h ? rect.w / rect.h : 1;
  const formas = edicion ? [...edicion.formas, ...(edicion.enCurso ? [edicion.enCurso] : [])] : visto?.formas || [];

  // Dibujar: una línea se arrastra; un ángulo son tres toques (vértice y los dos extremos)
  const aNorm = (e) => {
    const b = marco.current.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - b.left - rect.x) / rect.w)), Math.min(1, Math.max(0, (e.clientY - b.top - rect.y) / rect.h))];
  };
  const alBajar = (e) => {
    const ed = edicionRef.current; if (!ed || !rect.w) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
    const p = aNorm(e);
    if (ed.herramienta === 'linea') setEdicion({ ...ed, enCurso: { tipo: 'linea', p: [p, p], nuevo: true } });
    else {
      const actual = ed.enCurso && ed.enCurso.tipo === 'angulo' ? ed.enCurso : null;
      if (!actual) setEdicion({ ...ed, enCurso: { tipo: 'angulo', p: [p] } });
      else if (actual.p.length === 1) setEdicion({ ...ed, enCurso: { tipo: 'angulo', p: [actual.p[0], p] } });
      else setEdicion({ ...ed, formas: ed.formas.length < MAX_FORMAS ? [...ed.formas, { tipo: 'angulo', p: [actual.p[0], actual.p[1], p] }] : ed.formas, enCurso: null });
    }
  };
  const alMover = (e) => {
    const ed = edicionRef.current; if (!ed?.enCurso?.nuevo) return;
    setEdicion({ ...ed, enCurso: { ...ed.enCurso, p: [ed.enCurso.p[0], aNorm(e)] } });
  };
  const alSoltar = (e) => {
    const ed = edicionRef.current; if (!ed?.enCurso?.nuevo) return;
    const [a, b] = [ed.enCurso.p[0], aNorm(e)];
    const larga = Math.hypot((a[0] - b[0]) * proporcion, a[1] - b[1]) > 0.03;
    setEdicion({ ...ed, formas: larga && ed.formas.length < MAX_FORMAS ? [...ed.formas, { tipo: 'linea', p: [a, b] }] : ed.formas, enCurso: null });
  };
  // Un gesto cancelado (la palma, el sistema) no deja línea
  const alCancelar = () => { const ed = edicionRef.current; if (ed?.enCurso) setEdicion({ ...ed, enCurso: null }); };
  const terminar = () => {
    const d = limpiarDibujo(el()?.currentTime || 0, edicion.formas);
    edicion.alTerminar?.(d);
    setEdicion(null);
    if (d) setVisto(d);
  };

  return (
    <div class={`reproductor ${edicion ? 'dibujando' : ''}`} onKeyDown={tecla}>
      <div class="rep-marco" ref={marco}>
        <video class="medio" ref={v} src={src} playsInline preload="metadata" loop={bucle}
          onLoadedMetadata={(e) => { setDur(e.currentTarget.duration || 0); setListo(true); e.currentTarget.playbackRate = vel; }}
          onTimeUpdate={(e) => alTiempo(e.currentTarget.currentTime)} onSeeked={(e) => alTiempo(e.currentTarget.currentTime)}
          onPlay={() => { setJugando(true); setVisto(null); }} onPause={() => setJugando(false)} onClick={alternar} />
        {(formas.length > 0 || edicion) && rect.w > 0 && (
          <svg class="rep-lienzo" viewBox={`0 0 ${caja.w} ${caja.h}`} role="img" aria-label={formas.length ? `Dibujo: ${describirDibujo({ formas }, proporcion)}` : 'Lienzo para dibujar sobre el vídeo'}
            onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alCancelar}>
            {formas.map((f, i) => <Forma key={i} f={f} rect={rect} proporcion={proporcion} />)}
          </svg>
        )}
      </div>
      {edicion ? (
        <div class="rep-dibujo" role="group" aria-label="Dibujar sobre el vídeo">
          <div class="segmentos" role="group" aria-label="Herramienta">
            <button type="button" aria-pressed={edicion.herramienta === 'linea' ? 'true' : 'false'} onClick={() => setEdicion({ ...edicion, herramienta: 'linea', enCurso: null })}>Línea</button>
            <button type="button" aria-pressed={edicion.herramienta === 'angulo' ? 'true' : 'false'} onClick={() => setEdicion({ ...edicion, herramienta: 'angulo', enCurso: null })}>Ángulo</button>
          </div>
          <button type="button" class="btn btn-icono" aria-label="Deshacer la última forma" disabled={!edicion.formas.length && !edicion.enCurso} onClick={() => setEdicion({ ...edicion, formas: edicion.enCurso ? edicion.formas : edicion.formas.slice(0, -1), enCurso: null })}><Icono n="reiniciar" /></button>
          <button type="button" class="btn" onClick={() => { edicion.alTerminar?.(null); setEdicion(null); }}>Cancelar</button>
          <button type="button" class="btn btn-primario" disabled={!edicion.formas.length} onClick={terminar}><Icono n="hecho" /> Hecho</button>
          <span class="mini secundario rep-pista">{edicion.formas.length >= MAX_FORMAS ? `Ya hay ${MAX_FORMAS} formas: deshaz alguna para añadir otra. ` : ''}{edicion.herramienta === 'linea' ? 'Arrastra para trazar una línea.' : edicion.enCurso ? (edicion.enCurso.p.length === 1 ? 'Ahora, un extremo.' : 'Y el otro extremo.') : 'Toca el vértice del ángulo.'}{' '}Mueve el vídeo con los botones de fotograma.</span>
        </div>
      ) : (
        <div class="rep-barra">
          <button class="btn btn-icono plano" onClick={alternar} aria-label={jugando ? 'Pausar' : 'Reproducir'} disabled={!listo}><Icono n={jugando ? 'pausa' : 'play'} /></button>
          <input type="range" class="rep-tiempo" min="0" max={dur || 0} step="0.01" value={t} aria-label="Momento del vídeo" aria-valuetext={textoMomento(t, true)}
            onInput={(e) => { const x = el(); if (x) { x.pause(); x.currentTime = Number(e.currentTarget.value); } }} disabled={!listo} />
          <span class="num mini rep-reloj">{textoMomento(t, vel < 1)}<span class="terciario"> / {textoMomento(dur)}</span></span>
        </div>
      )}
      <div class="rep-controles">
        <div class="segmentos rep-vel" role="group" aria-label="Velocidad">
          {VELOCIDADES.map(([r, txt]) => <button key={r} type="button" aria-pressed={vel === r ? 'true' : 'false'} onClick={() => fijarVel(r)} disabled={!!edicion}>{txt}</button>)}
        </div>
        <button class="btn btn-icono" onClick={() => paso(-1)} aria-label="Fotograma anterior" disabled={!listo}><Icono n="atras" /></button>
        <button class="btn btn-icono" onClick={() => paso(1)} aria-label="Fotograma siguiente" disabled={!listo}><Icono n="derecha" /></button>
        <button class="btn btn-icono" aria-pressed={bucle ? 'true' : 'false'} onClick={() => setBucle(!bucle)} aria-label="Repetir en bucle" disabled={!!edicion}><Icono n="reiniciar" /></button>
        {visto && !edicion && <button class="btn btn-peq" onClick={() => setVisto(null)}><Icono n="cerrar" /> Quitar el dibujo</button>}
      </div>
    </div>
  );
}

// Una línea o un ángulo (con sus grados) en píxeles de la imagen
function Forma({ f, rect, proporcion }) {
  const X = (p) => rect.x + p[0] * rect.w, Y = (p) => rect.y + p[1] * rect.h;
  const puntos = f.p.map((p) => [X(p), Y(p)]);
  if (f.tipo === 'linea') {
    const [a, b] = puntos;
    return <g class="forma"><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} /><circle cx={a[0]} cy={a[1]} r="4" /><circle cx={b[0]} cy={b[1]} r="4" /></g>;
  }
  const [v, a, b] = puntos;
  const g = f.p.length === 3 ? grados(f.p, proporcion) : null;
  // El arco del ángulo, pequeño, en el vértice
  let arco = null;
  if (a && b) {
    const r = Math.min(28, Math.hypot(a[0] - v[0], a[1] - v[1]) * 0.5, Math.hypot(b[0] - v[0], b[1] - v[1]) * 0.5);
    const a1 = Math.atan2(a[1] - v[1], a[0] - v[0]), a2 = Math.atan2(b[1] - v[1], b[0] - v[0]);
    let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    const p1 = [v[0] + r * Math.cos(a1), v[1] + r * Math.sin(a1)], p2 = [v[0] + r * Math.cos(a2), v[1] + r * Math.sin(a2)];
    arco = <path class="arco" d={`M${p1[0]} ${p1[1]} A${r} ${r} 0 0 ${d > 0 ? 1 : 0} ${p2[0]} ${p2[1]}`} />;
  }
  return (
    <g class="forma">
      {a && <line x1={v[0]} y1={v[1]} x2={a[0]} y2={a[1]} />}
      {b && <line x1={v[0]} y1={v[1]} x2={b[0]} y2={b[1]} />}
      {arco}
      {puntos.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === 0 ? 5 : 4} />)}
      {g != null && <text x={v[0] + 10} y={v[1] - 10} class="num">{g}°</text>}
    </g>
  );
}

// Texto de un comentario con sus minutos como botones que llevan al momento del vídeo
export function TextoConMomentos({ texto, archivoId }) {
  const partes = partirMomentos(texto);
  if (!archivoId || !partes.some((p) => p.momento)) return texto;
  return partes.map((p, i) => (p.momento
    ? <button key={i} type="button" class="marca-tiempo num" onClick={() => reproductorDe(archivoId)?.ir(p.t)} aria-label={`Ir al ${p.momento} del vídeo`}>{p.momento}</button>
    : p.texto));
}

// El botón de un comentario con dibujo: «Ver el dibujo (0:04)»
export function BotonDibujo({ dibujo, archivoId }) {
  if (!dibujo || !archivoId) return null;
  return (
    <button type="button" class="btn btn-peq boton-dibujo" onClick={() => reproductorDe(archivoId)?.mostrar(dibujo)}>
      <Icono n="regla" /> Ver el dibujo <span class="num">({textoMomento(dibujo.t, true)})</span>
    </button>
  );
}
