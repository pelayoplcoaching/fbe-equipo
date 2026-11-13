// (apuntes, tanda D) Con los demás y en otros formatos: la liga de la semana y los duelos de cinco preguntas (con las
// reglas de la comunidad: solo dentro, con el nombre de allí, y quien no quiere salir no sale), las historias a pantalla
// completa y las audio-píldoras del coach. La lógica, en logica/apuntes-camino.js.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono, Capa, useApp, useCarga } from '../comunes.jsx';
import { estadoDuelo } from '../../logica/apuntes-camino.js';
import { sinMovimiento } from '../transiciones.js';
import { vibrar } from '../hapticos.js';

// --- La liga de la semana y tus duelos (dentro de «Tu progreso») ---
export function LigaYDuelos({ alJugar }) {
  const { api, aviso } = useApp();
  const [n, setN] = useState(0);
  const liga = useCarga(() => (api.ligaApuntes ? api.ligaApuntes() : Promise.resolve(null)), [n]);
  const duelos = useCarga(() => (api.duelosApuntes ? api.duelosApuntes() : Promise.resolve([])), [n]);
  const [retando, setRetando] = useState(false);
  const l = liga.datos;
  if (liga.cargando && !l) return null;
  if (!l) return null;   // fuera de la comunidad (o sin la 065): nada
  const filas = l.filas || [];
  const yo = filas.findIndex((f) => f.yo);
  const top = filas.slice(0, 8);
  const retar = async (persona) => {
    try {
      const semilla = 1 + Math.floor(Math.random() * 1999999999);
      const id = await api.retarDueloApuntes(persona.id, semilla);
      vibrar('hecho'); aviso?.(`Retado: ${persona.nombre} tiene una semana para contestar`);
      setRetando(false); setN(n + 1);
      alJugar({ id, semilla, rival: persona.nombre });
    } catch (e) { aviso?.(e.message, 'error'); }
  };
  return (
    <>
      <section class="prog-liga" aria-labelledby="prog-liga-t">
        <h3 id="prog-liga-t">Liga de la semana</h3>
        {filas.length ? (
          <ol class="liga-filas">
            {top.map((f, i) => <li key={`${f.nombre}-${i}`} class={f.yo ? 'yo' : ''}><span class="num liga-puesto">{i + 1}</span><span class="liga-nombre">{f.yo ? `${f.nombre} (tú)` : f.nombre}</span><b class="num">{f.puntos}</b></li>)}
            {yo >= top.length && <li class="yo"><span class="num liga-puesto">{yo + 1}</span><span class="liga-nombre">{filas[yo].nombre} (tú)</span><b class="num">{filas[yo].puntos}</b></li>}
          </ol>
        ) : <p class="peq secundario">Aún nadie ha sumado puntos esta semana: el primer apunte te pone arriba.</p>}
        <p class="mini secundario">Entre quienes estáis en la comunidad, con el nombre de allí. Quien marcó «No salir en el ranking» no sale. El equipo suma <span class="num">{l.equipo?.puntos || 0}</span> puntos esta semana.</p>
      </section>
      <section class="prog-duelos" aria-labelledby="prog-duelos-t">
        <h3 id="prog-duelos-t">Duelos</h3>
        {(duelos.datos || []).map((d) => {
          const e = estadoDuelo(d);
          return (
            <div class={`duelo-fila duelo-${e.estado}`} key={d.id}>
              <span>{e.texto}</span>
              {e.estado === 'jugar' && <button type="button" class="btn btn-peq btn-primario" onClick={() => alJugar({ id: d.id, semilla: d.semilla, rival: d.rival_nombre })}>Jugar</button>}
            </div>
          );
        })}
        {(l.gente || []).length > 0 && (retando ? (
          <div class="duelo-gente" role="group" aria-label="¿A quién retas?">
            {l.gente.slice(0, 30).map((p) => <button type="button" key={p.id} class="chip" onClick={() => retar(p)}>{p.nombre}</button>)}
            <button type="button" class="btn-texto" onClick={() => setRetando(false)}>Mejor otro día</button>
          </div>
        ) : <button type="button" class="btn" onClick={() => setRetando(true)}><Icono n="rayo" />Retar a alguien</button>)}
        <p class="mini secundario">Cinco preguntas del glosario, las mismas para los dos, cada uno cuando pueda (una semana). Los aciertos del otro, al contestar los tuyos.</p>
      </section>
    </>
  );
}

// --- Historias a pantalla completa: tocar a la derecha pasa, a la izquierda vuelve; solas, cada seis segundos ---
export function Historia({ diapositivas = [], alAcabar, alCerrar, tono = 'morado' }) {
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const quieto = sinMovimiento();
  const total = diapositivas.length;
  const ir = (k) => {
    if (k >= total) { alAcabar?.(); return; }
    setI(Math.max(0, k)); vibrar('elegir');
  };
  useEffect(() => {
    if (pausa || quieto || !total) return undefined;
    const t = setTimeout(() => ir(i + 1), 6000);
    return () => clearTimeout(t);
  }, [i, pausa, quieto, total]);
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') alCerrar?.(); if (e.key === 'ArrowRight') ir(i + 1); if (e.key === 'ArrowLeft') ir(i - 1); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [i]);
  if (!total) return null;
  const d = diapositivas[i];
  return (
    <Capa>
      <div class={`ap-historia tono-${tono} clase-${d.clase}`} role="dialog" aria-modal="true" aria-label="Historia" aria-roledescription="historia">
        <div class="ap-historia-barras" aria-hidden="true">
          {diapositivas.map((_, k) => <span key={k} class={k < i ? 'vista' : k === i ? `ahora${pausa || quieto ? ' parada' : ''}` : ''}><i key={`${k}-${i}`} /></span>)}
        </div>
        <button type="button" class="btn btn-icono plano ap-historia-cerrar" aria-label="Cerrar la historia" onClick={alCerrar}><Icono n="cerrar" /></button>
        <div class="ap-historia-cuerpo" aria-live="polite">
          {d.etiqueta && <span class="ap-historia-etq">{d.etiqueta}</span>}
          {d.titulo && <h2>{d.titulo}</h2>}
          {d.texto && <p>{d.texto}</p>}
          {d.enlace && <a class="btn btn-peq" href={d.enlace} target="_blank" rel="noopener noreferrer">Ver el estudio</a>}
        </div>
        <button type="button" class="ap-historia-zona atras" aria-label="Anterior" onClick={() => ir(i - 1)} onPointerDown={() => setPausa(true)} onPointerUp={() => setPausa(false)} onPointerLeave={() => setPausa(false)} />
        <button type="button" class="ap-historia-zona alante" aria-label={i === total - 1 ? 'Terminar' : 'Siguiente'} onClick={() => ir(i + 1)} onPointerDown={() => setPausa(true)} onPointerUp={() => setPausa(false)} onPointerLeave={() => setPausa(false)} />
        <span class="ap-historia-cuenta num" aria-hidden="true">{i + 1}/{total}</span>
      </div>
    </Capa>
  );
}

// --- La audio-píldora del coach: se pide al tocar; a 1× o 1,5× ---
const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
export function AudioPildora({ audio }) {
  const { api, aviso } = useApp();
  const ref = useRef(null);
  const [url, setUrl] = useState(null);
  const [sonando, setSonando] = useState(false);
  const [rapido, setRapido] = useState(false);
  const [t, setT] = useState(0);
  useEffect(() => { if (ref.current) ref.current.playbackRate = rapido ? 1.5 : 1; }, [rapido, url]);
  const tocar = async () => {
    try {
      if (!url) { const u = await api.urlAudioApunte(audio.ruta); setUrl(u); setTimeout(() => ref.current?.play().catch(() => {}), 50); return; }
      if (ref.current.paused) await ref.current.play(); else ref.current.pause();
    } catch (e) { aviso?.(e.message || 'No se ha podido cargar el audio', 'error'); }
  };
  return (
    <div class="audio-pildora">
      <button type="button" class="btn audio-play" aria-label={sonando ? 'Pausar el audio de tu coach' : 'Escuchar el audio de tu coach'} onClick={tocar}><Icono n={sonando ? 'pausa' : 'play'} /></button>
      <span class="audio-info">
        <strong>Audio de tu coach</strong>
        <span class="audio-barra" aria-hidden="true"><i style={{ width: `${Math.min(100, (t / Math.max(1, audio.segundos)) * 100)}%` }} /></span>
        <span class="mini secundario num">{mmss(t)} / {mmss(audio.segundos)}</span>
      </span>
      <button type="button" class="chip audio-velocidad" aria-pressed={rapido ? 'true' : 'false'} onClick={() => setRapido(!rapido)}>{rapido ? '1,5×' : '1×'}</button>
      {url && <audio ref={ref} src={url} preload="auto" onPlay={() => setSonando(true)} onPause={() => setSonando(false)} onEnded={() => { setSonando(false); setT(0); }} onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} />}
    </div>
  );
}
