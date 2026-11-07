// v0.60 (9): dos ángulos de la misma serie (038: archivos.angulo_de). El atleta añade otro ángulo al enviar un vídeo o después,
// desde el vídeo (uno que ya envió, o grabando o eligiendo otro). «Dos ángulos» los enseña a la vez (uno al lado del otro, o
// uno encima del otro en un móvil estrecho) con un mando común (reproducir, pausar, ir a un momento, la velocidad, de
// fotograma en fotograma) y el desfase del segundo (de −2 a +2 s, en pasos de 0,05 s o de un fotograma). El coach guarda el
// desfase con la corrección (el atleta lo ve; el suyo, si lo cambia, solo en su móvil). Se dibuja en cualquiera de los dos.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, usePreferencia } from '../comunes.jsx';
import { reproductorDe } from '../Video.jsx';
import { VerArchivo, SubirArchivo } from '../Archivos.jsx';
import { AVISO_038 } from '../../datos/api.js';
import { fmtCorta } from '../../logica/fechas.js';
import { textoMomento } from '../../logica/momentos.js';
import { limitarDesfase, tiempoPareja, textoDesfase, PASO_DESFASE, PASO_FOTOGRAMA, DESFASE_MAX } from '../../logica/angulos.js';

export function AngulosVideo({ video, esCoach = false, revision = null, alCambiar }) {
  const { api, aviso, atleta } = useApp();
  const con038 = useCarga(() => api.video038().catch(() => null), []);
  const pareja = useCarga(() => (con038.datos === false ? Promise.resolve(null) : api.parejaAngulo(video).catch(() => null)), [video.id, con038.datos]);
  const [ver, setVer] = useState(false);
  const [anadir, setAnadir] = useState(false);
  const propio = !esCoach && atleta?.id === video.atleta_id && atleta?.estado !== 'baja';
  if (con038.cargando && con038.datos == null) return null;
  if (con038.datos === false) return (propio || esCoach) ? <p class="mini terciario">Dos ángulos de la misma serie: {AVISO_038}.</p> : null;
  const p = pareja.datos;
  const quitar = async () => {
    try { await api.desenlazarAngulo(video); aviso('Ya no van como dos ángulos'); await pareja.recargar(true); alCambiar?.(); } catch (e) { aviso(e.message, 'error'); }
  };
  return (
    <div class="fila-envolver angulos-video">
      {p ? (
        <>
          <button type="button" class="btn btn-peq" onClick={() => setVer(true)} aria-haspopup="dialog"><Icono n="duplicar" /> Dos ángulos</button>
          {(propio || esCoach) && <button type="button" class="btn btn-peq plano" onClick={quitar}>Quitar el otro ángulo</button>}
        </>
      ) : propio ? <button type="button" class="btn btn-peq" onClick={() => setAnadir(true)} aria-haspopup="dialog"><Icono n="mas" /> Añadir otro ángulo</button> : null}
      {ver && p && <DosAngulos a={video} b={p} revision={revision} esCoach={esCoach} alCerrar={() => setVer(false)} />}
      {anadir && <AnadirAngulo video={video} alCerrar={() => setAnadir(false)} alHecho={async () => { setAnadir(false); await pareja.recargar(true); alCambiar?.(); }} />}
    </div>
  );
}

// Otro ángulo para un vídeo: uno que ya envió (sin pareja) o uno nuevo (con la cámara o de la galería)
function AnadirAngulo({ video, alCerrar, alHecho }) {
  const { api, aviso } = useApp();
  const lista = useCarga(() => api.candidatosAngulo(video).catch(() => []), [video.id]);
  const enlazar = async (otro) => {
    try { await api.enlazarAngulo(otro, video.id); aviso('Enlazados: ya se ven como dos ángulos'); alHecho?.(); } catch (e) { aviso(e.message, 'error'); }
  };
  return (
    <Hoja titulo="Añadir otro ángulo" alCerrar={alCerrar}>
      <p class="peq secundario">El mismo momento grabado desde otro sitio (por ejemplo, de lado y de frente): tu coach los verá a la vez.</p>
      <SubirArchivo atletaId={video.atleta_id} tipo="video_tecnica" ejercicioId={video.ejercicio?.id || video.ejercicio_id || null} ejercicio={video.ejercicio || null}
        sesionEjercicioId={video.sesion_ejercicio_id || null} serieInicial={video.serie_numero || null} anguloDe={video.id}
        titulo="Otro ángulo de la misma serie" etiqueta="Grabar o elegir el otro ángulo" clase="btn btn-primario" alSubir={() => alHecho?.()} />
      {(lista.datos || []).length > 0 && (
        <>
          <span class="etq">O uno que ya enviaste</span>
          <div class="lista-elegir">
            {lista.datos.slice(0, 12).map((x) => <button key={x.id} type="button" onClick={() => enlazar(x)}>{x.ejercicio_id === video.ejercicio_id && video.ejercicio?.nombre ? video.ejercicio.nombre : 'Vídeo'}, {fmtCorta(x.fecha)}{x.serie_numero ? ` · serie ${x.serie_numero}` : ''}</button>)}
          </div>
        </>
      )}
    </Hoja>
  );
}

export function DosAngulos({ a, b, revision = null, esCoach = false, alCerrar }) {
  const { api, aviso } = useApp();
  const guardado = revision?.dos_angulos?.con === b.id ? Number(revision.dos_angulos.desfase) || 0 : null;
  const [local, setLocal] = usePreferencia(`fbe-desfase-${a.id}-${b.id}`, null);
  const [desfase, setDesfaseE] = useState(limitarDesfase(esCoach ? guardado ?? 0 : local ?? guardado ?? 0));
  const [jugando, setJugando] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [vel, setVel] = useState(1);
  const [ocupado, setOcupado] = useState(false);
  const raf = useRef(0);
  const dRef = useRef(desfase);
  dRef.current = desfase;
  const elA = () => reproductorDe(a.id)?.elemento?.(), elB = () => reproductorDe(b.id)?.elemento?.();
  const alinear = (forzar = false) => {
    const x = elA(), y = elB();
    if (!x || !y) return;
    const objetivo = tiempoPareja(x.currentTime, dRef.current, y.duration || null);
    if (forzar || Math.abs(y.currentTime - objetivo) > (x.paused ? 0.01 : 0.12)) { try { y.currentTime = objetivo; } catch { /* */ } }
    if (y.playbackRate !== x.playbackRate) y.playbackRate = x.playbackRate;
  };
  // Mientras se reproducen, el segundo sigue al primero (y el mando común, el tiempo del primero)
  useEffect(() => {
    const bucle = () => {
      const x = elA();
      if (x) { setT(x.currentTime); if (x.duration && Number.isFinite(x.duration)) setDur(x.duration); if (!x.paused) alinear(); else if (jugando) setJugando(false); }
      raf.current = requestAnimationFrame(bucle);
    };
    raf.current = requestAnimationFrame(bucle);
    return () => cancelAnimationFrame(raf.current);
  }, [jugando]);
  useEffect(() => { alinear(true); }, [desfase]);
  const setDesfase = (d) => { const x = limitarDesfase(d); setDesfaseE(x); if (!esCoach) setLocal(x); };
  const reproducir = () => { const x = elA(), y = elB(); if (!x || !y) return; x.playbackRate = vel; y.playbackRate = vel; alinear(true); x.play().catch(() => {}); y.play().catch(() => {}); setJugando(true); };
  const pausar = () => { elA()?.pause(); elB()?.pause(); setJugando(false); setTimeout(() => alinear(true), 0); };
  const ir = (seg) => { const x = elA(); if (!x) return; pausar(); x.currentTime = Math.max(0, Math.min(x.duration || seg, seg)); setT(x.currentTime); alinear(true); };
  const paso = (n) => ir((elA()?.currentTime || 0) + n * PASO_FOTOGRAMA);
  const fijarVel = (r) => { setVel(r); const x = elA(), y = elB(); if (x) x.playbackRate = r; if (y) y.playbackRate = r; };
  const guardar = async () => {
    setOcupado(true);
    try { await api.guardarDesfase(a, b.id, desfase); aviso('Desfase guardado con la corrección'); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  const dibujar = (id) => { pausar(); reproductorDe(id)?.dibujar?.(() => {}); };
  return (
    <Hoja titulo="Dos ángulos" alCerrar={() => { pausar(); alCerrar(); }} ancho={980}>
      <div class="dos-angulos-panes">
        {[[a, 'Ángulo 1'], [b, 'Ángulo 2']].map(([v, nombre]) => (
          <div key={v.id} class="pila-s dos-angulos-pane">
            <div class="separa"><span class="etq">{nombre}{v.fecha ? <span class="terciario"> · {fmtCorta(v.fecha)}</span> : null}</span>
              <button type="button" class="btn-texto mini" onClick={() => dibujar(v.id)}><Icono n="regla" /> Dibujar en este</button></div>
            <VerArchivo archivo={v} compacto etiqueta={nombre} />
          </div>
        ))}
      </div>
      <div class="dos-angulos-mando pila-s" role="group" aria-label="Los dos a la vez">
        <div class="fila-envolver">
          <button type="button" class="btn btn-primario" onClick={jugando ? pausar : reproducir}><Icono n={jugando ? 'pausa' : 'play'} /> {jugando ? 'Pausar los dos' : 'Reproducir los dos'}</button>
          <button type="button" class="btn btn-icono" onClick={() => paso(-1)} aria-label="Los dos, un fotograma atrás"><Icono n="atras" /></button>
          <button type="button" class="btn btn-icono" onClick={() => paso(1)} aria-label="Los dos, un fotograma adelante"><Icono n="derecha" /></button>
          <button type="button" class="btn" onClick={() => ir(0)}><Icono n="reiniciar" /> Al principio</button>
          <div class="segmentos" role="group" aria-label="Velocidad de los dos">
            {[[0.25, '0,25×'], [0.5, '0,5×'], [1, '1×']].map(([r, txt]) => <button key={r} type="button" aria-pressed={vel === r ? 'true' : 'false'} onClick={() => fijarVel(r)}>{txt}</button>)}
          </div>
        </div>
        <input type="range" class="dos-angulos-tiempo" min="0" max={dur || 0} step="0.01" value={t} style={{ '--v': `${dur > 0 ? Math.min(100, (t / dur) * 100) : 0}%` }} aria-label="Momento de los dos vídeos" aria-valuetext={textoMomento(t, true)} onInput={(e) => ir(Number(e.currentTarget.value))} />
        <div class="campo">
          <label for={`desfase-${a.id}`} class="etq">Desfase del ángulo 2: <b class="num">{textoDesfase(desfase)}</b></label>
          <div class="fila-envolver dos-angulos-desfase">
            <button type="button" class="btn btn-peq" onClick={() => setDesfase(desfase - PASO_FOTOGRAMA)} aria-label="Desfase: un fotograma menos">−1 fot.</button>
            <button type="button" class="btn btn-peq" onClick={() => setDesfase(desfase - PASO_DESFASE)} aria-label="Desfase: 0,05 segundos menos">−0,05</button>
            <input id={`desfase-${a.id}`} type="range" min={-DESFASE_MAX} max={DESFASE_MAX} step={PASO_DESFASE} value={desfase} aria-valuetext={textoDesfase(desfase)} onInput={(e) => setDesfase(Number(e.currentTarget.value))} />
            <button type="button" class="btn btn-peq" onClick={() => setDesfase(desfase + PASO_DESFASE)} aria-label="Desfase: 0,05 segundos más">+0,05</button>
            <button type="button" class="btn btn-peq" onClick={() => setDesfase(desfase + PASO_FOTOGRAMA)} aria-label="Desfase: un fotograma más">+1 fot.</button>
            {desfase !== 0 && <button type="button" class="btn btn-peq plano" onClick={() => setDesfase(0)}>Sin desfase</button>}
          </div>
          <span class="ayuda">Si uno empezó a grabar antes, muévelo hasta que la barra esté en el mismo sitio en los dos.{esCoach ? '' : ' Lo que ajustes tú se queda en tu móvil.'}</span>
        </div>
        {esCoach && <button type="button" class="btn" disabled={ocupado || desfase === guardado} onClick={guardar}><Icono n="hecho" /> {guardado == null ? 'Guardar el desfase con la corrección' : 'Guardar el nuevo desfase'}</button>}
      </div>
    </Hoja>
  );
}
