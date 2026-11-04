// La cámara guiada para los vídeos de técnica (v0.57), como la de las fotos de progreso: el encuadre que pide ese
// ejercicio (de lado, a 45° o de frente) con una silueta de guía, un nivel con el giroscopio (si el móvil lo tiene; en
// iPhone se pide permiso con un toque), cuenta atrás de 3, 5 o 10 s con pitidos, y «parar sola» a los N segundos para
// grabarse sin manos. Lo grabado pasa al recorte y al aligerado de siempre. La cámara se suelta al parar, al cancelar, si
// falla y al cerrar. Desde un vídeo corregido («Grabar de nuevo con la corrección»), los puntos que marcó el coach a la vista.
// v0.60 (11): «Cámara lenta» si la cámara da 60 fotogramas por segundo o más (getCapabilities): pide 240, 120 o 60 (lo más
// alto que dé) con una resolución que llegue a ese ritmo; el ritmo real (getSettings) va con el vídeo (038: fps_captura) y
// el reproductor lo abre a 0,25× o 0,5×. Si no lo da (el iPhone, con Safari, solo da 30 o 60 a una web), se dice y se
// propone la cámara lenta del propio móvil y elegir el vídeo de la galería.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono, Segmentos, usePreferencia, useAtraparFoco, Capa } from '../comunes.jsx';
import { prepararAudio, tono, vibrarCorto } from '../atleta/sesion-comun.jsx';
import { encuadreDe, nivelDe, textoNivel, CUENTAS_ATRAS, PARAR_SOLA, MAX_GRABACION_SEG, formatoVideo, errorCamara } from '../../logica/tecnica.js';
import { mmss } from '../../logica/notasVoz.js';
import { elegirCamaraLenta, textoSinLenta } from '../../logica/angulos.js';
const esIosNav = () => typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export const puedeGrabarVideo = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof globalThis.MediaRecorder === 'function'
  && !!formatoVideo((t) => globalThis.MediaRecorder.isTypeSupported?.(t));

export function CamaraVideo(props) { return <Capa><CamaraVideoPantalla {...props} /></Capa>; }

function CamaraVideoPantalla({ ejercicio = null, titulo = 'Vídeo de técnica', puntos = [], alCerrar, alGrabar }) {
  const video = useRef(null);
  const raiz = useRef(null);
  useAtraparFoco(raiz);
  const enc = encuadreDe(ejercicio?.nombre || '', ejercicio?.grupos_musculares || [], ejercicio?.tipo || []);
  const [trasera, setTrasera] = useState(true);
  const [abrir, setAbrir] = useState(0); // al cambiar, se vuelve a abrir la cámara («Repetir»)
  const [error, setError] = useState(null);
  const [lista, setLista] = useState(false);
  const [espera, setEspera] = usePreferencia('fbe-camara-video-espera', 5);
  const [pararSola, setPararSola] = usePreferencia('fbe-camara-video-parar', 0);
  const [estado, setEstado] = useState('camara'); // camara | contando | grabando | revisar
  const [cuenta, setCuenta] = useState(null);
  const [seg, setSeg] = useState(0);
  const [grabado, setGrabado] = useState(null); // { archivo, url }
  const [nivel, setNivel] = useState(null);
  const [pideNivel, setPideNivel] = useState(false);
  const [sinNivel, setSinNivel] = useState(false);
  const [verPuntos, setVerPuntos] = useState(puntos.length > 0);
  // (v0.60) La cámara lenta: lo que da la cámara (null: aún no se sabe; false: no llega a 60), si está puesta y el ritmo real
  const [capLenta, setCapLenta] = useState(null);
  const [lenta, setLenta] = useState(false);
  const [fpsReal, setFpsReal] = useState(null);
  const [verPorQue, setVerPorQue] = useState(false);
  const r = useRef({});

  const soltarCamara = () => { try { r.current.flujo?.getTracks().forEach((t) => t.stop()); } catch { /* */ } r.current.flujo = null; if (video.current) video.current.srcObject = null; };
  const pararTemporizadores = () => { clearInterval(r.current.cuenta); clearInterval(r.current.tic); r.current.cuenta = null; r.current.tic = null; };

  // La cámara: se abre al entrar, al girarla y al repetir; se suelta al grabar, al cerrar y si falla
  useEffect(() => {
    if (estado === 'revisar') return undefined;
    let vivo = true;
    setLista(false); setError(null);
    if (!navigator.mediaDevices?.getUserMedia) { setError(errorCamara({ name: 'NoSoportado' })); return undefined; }
    const pedido = lenta && capLenta
      ? { facingMode: trasera ? 'environment' : 'user', width: { ideal: capLenta.width }, height: { ideal: capLenta.height }, frameRate: { ideal: capLenta.fps, min: 50 } }
      : { facingMode: trasera ? 'environment' : 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
    navigator.mediaDevices.getUserMedia({ video: pedido, audio: false })
      .then((s) => {
        if (!vivo) { s.getTracks().forEach((t) => t.stop()); return; }
        r.current.flujo = s;
        const pista = s.getVideoTracks?.()[0];
        // Lo que puede dar esta cámara (una vez, con la normal) y el ritmo con que de verdad graba
        if (!lenta) { let cap = null; try { cap = pista?.getCapabilities?.() || null; } catch { cap = null; } setCapLenta(elegirCamaraLenta(cap) || false); }
        let ajustes = null; try { ajustes = pista?.getSettings?.() || null; } catch { ajustes = null; }
        r.current.fps = Math.round(Number(ajustes?.frameRate) || 30);
        setFpsReal(r.current.fps);
        if (video.current) { video.current.srcObject = s; video.current.play?.().catch(() => {}); }
      })
      .catch((e) => {
        if (!vivo) return;
        soltarCamara();
        // (si la cámara lenta no arranca, la normal)
        if (lenta) { setLenta(false); setError(null); return; }
        setError(errorCamara(e));
      });
    return () => { vivo = false; soltarCamara(); };
  }, [trasera, abrir, lenta]);

  // El nivel (DeviceOrientation): en iPhone hace falta pedir permiso con un toque; si no hay sensor, no sale
  const escucharNivel = () => {
    let ultimo = 0;
    const al = (e) => {
      const angulo = Number(screen.orientation?.angle ?? window.orientation ?? 0) || 0;
      const n = nivelDe({ beta: e.beta, gamma: e.gamma }, angulo);
      // (sin sensor, el navegador manda uno vacío: no borra lo que haya)
      if (!n) return;
      const ahora = performance.now();
      if (ahora - ultimo < 100) return;
      ultimo = ahora;
      setNivel(n);
      setPideNivel(false); // ya llegan datos: no hace falta pedir nada

    };
    window.addEventListener('deviceorientation', al);
    r.current.quitarNivel = () => window.removeEventListener('deviceorientation', al);
  };
  useEffect(() => {
    const D = globalThis.DeviceOrientationEvent;
    if (typeof D !== 'function') { setSinNivel(true); return undefined; }
    // Se escucha siempre; donde hay que pedir permiso (iPhone), el botón sale hasta que llegan datos
    escucharNivel();
    if (typeof D.requestPermission === 'function') setPideNivel(true);
    return () => r.current.quitarNivel?.();
  }, []);
  const activarNivel = async () => {
    try { const x = await globalThis.DeviceOrientationEvent.requestPermission(); setPideNivel(false); if (x !== 'granted') setSinNivel(true); }
    catch { setPideNivel(false); setSinNivel(true); }
  };

  // Escape cierra (también a medias: no se guarda nada); la página de detrás no se mueve; la pantalla no se apaga
  useEffect(() => {
    const previo = document.activeElement;
    const tecla = (e) => {
      if (e.key !== 'Escape') return;
      const modales = document.querySelectorAll('[aria-modal="true"]');
      if (modales.length && modales[modales.length - 1] !== raiz.current) return;
      e.preventDefault(); cerrar();
    };
    document.addEventListener('keydown', tecla);
    const cuerpo = document.body;
    cuerpo.dataset.hojas = String(Number(cuerpo.dataset.hojas || 0) + 1); cuerpo.style.overflow = 'hidden';
    let candado = null;
    navigator.wakeLock?.request('screen').then((c) => { candado = c; }).catch(() => {});
    raiz.current?.querySelector('.camara-cerrar')?.focus();
    return () => {
      document.removeEventListener('keydown', tecla);
      const quedan = Math.max(0, Number(cuerpo.dataset.hojas || 1) - 1);
      if (quedan) cuerpo.dataset.hojas = String(quedan); else { delete cuerpo.dataset.hojas; cuerpo.style.overflow = ''; }
      try { candado?.release(); } catch { /* */ }
      pararTemporizadores();
      r.current.cancelada = true;
      try { if (r.current.rec?.state === 'recording') r.current.rec.stop(); } catch { /* */ }
      soltarCamara();
      r.current.quitarNivel?.();
      if (previo?.isConnected) previo.focus?.();
    };
  }, []);
  useEffect(() => () => { if (grabado?.url) URL.revokeObjectURL(grabado.url); }, [grabado?.url]);

  const empezarGrabacion = () => {
    const flujo = r.current.flujo;
    const f = formatoVideo((t) => globalThis.MediaRecorder?.isTypeSupported?.(t));
    if (!flujo || !f) { setEstado('camara'); setError(errorCamara({ name: 'NoSoportado' })); return; }
    let rec;
    try { rec = new globalThis.MediaRecorder(flujo, { mimeType: f.grabar, videoBitsPerSecond: (r.current.fps || 30) >= 50 ? 8_000_000 : 5_000_000 }); } catch (e) { soltarCamara(); setEstado('camara'); setError(errorCamara(e)); return; }
    const trozos = [];
    r.current.rec = rec; r.current.cancelada = false;
    rec.ondataavailable = (ev) => { if (ev.data?.size) trozos.push(ev.data); };
    rec.onstop = () => {
      pararTemporizadores();
      soltarCamara();
      if (r.current.cancelada || !trozos.length) { if (!r.current.cancelada) { setEstado('camara'); setAbrir((n) => n + 1); } return; }
      const blob = new Blob(trozos, { type: f.tipo });
      const archivo = new File([blob], `grabacion-${Date.now()}.${f.ext}`, { type: f.tipo });
      setGrabado({ archivo, url: URL.createObjectURL(blob), fps: r.current.fps || null });
      setEstado('revisar');
    };
    try { rec.start(500); } catch (e) { soltarCamara(); setEstado('camara'); setError(errorCamara(e)); return; }
    const inicio = performance.now();
    setSeg(0); setEstado('grabando'); tono(1320, 0.12, 0.25); vibrarCorto(40);
    r.current.tic = setInterval(() => {
      const s = (performance.now() - inicio) / 1000;
      setSeg(s);
      const tope = pararSola > 0 ? pararSola : MAX_GRABACION_SEG;
      if (s >= tope) parar();
    }, 200);
  };
  const disparar = () => {
    if (estado === 'grabando') { parar(); return; }
    if (estado === 'contando') { pararTemporizadores(); setCuenta(null); setEstado('camara'); return; }
    prepararAudio();
    let n = espera;
    setEstado('contando'); setCuenta(n); tono(880, 0.08);
    r.current.cuenta = setInterval(() => {
      n -= 1;
      if (n <= 0) { clearInterval(r.current.cuenta); r.current.cuenta = null; setCuenta(null); empezarGrabacion(); return; }
      setCuenta(n);
      tono(n <= 3 ? 1100 : 880, n <= 3 ? 0.12 : 0.06, n <= 3 ? 0.25 : 0.15);
    }, 1000);
  };
  function parar() {
    clearInterval(r.current.tic); r.current.tic = null;
    tono(660, 0.1, 0.2);
    try { if (r.current.rec?.state === 'recording') r.current.rec.stop(); else soltarCamara(); } catch { soltarCamara(); }
  }
  function cerrar() {
    r.current.cancelada = true;
    pararTemporizadores();
    try { if (r.current.rec?.state === 'recording') r.current.rec.stop(); } catch { /* */ }
    soltarCamara();
    alCerrar?.();
  }
  const repetir = () => { setGrabado(null); setEstado('camara'); setAbrir((n) => n + 1); };

  const torcido = nivel && nivel.estado === 'torcido';
  const contando = estado === 'contando', grabando = estado === 'grabando';
  return (
    <div ref={raiz} class="camara camara-video" role="dialog" aria-modal="true" aria-label={titulo}>
      <div class="camara-cab">
        <button class="btn btn-icono plano camara-cerrar" aria-label="Cerrar la cámara" onClick={cerrar}><Icono n="cerrar" /></button>
        <strong class="camara-titulo">{titulo}</strong>
        {estado === 'camara' ? <button class="btn btn-icono plano" aria-label={trasera ? 'Usar la cámara de delante' : 'Usar la cámara de atrás'} onClick={() => setTrasera(!trasera)}><Icono n="girar" /></button> : <span style="width:44px" />}
      </div>
      <div class={`camara-marco camara-marco-video ${!trasera ? 'espejo' : ''}`}>
        <video ref={video} playsInline muted autoPlay onLoadedMetadata={() => setLista(true)} aria-hidden="true" class={estado === 'revisar' ? 'oculto' : ''} />
        {estado !== 'revisar' && (
          <>
            <Silueta vista={enc.vista} />
            {nivel && (
              <span class={`camara-nivel ${nivel.estado}`} aria-hidden="true"><i style={{ transform: `rotate(${Math.max(-30, Math.min(30, -nivel.inclinacion))}deg)` }} /></span>
            )}
            {cuenta != null && <span class="camara-cuenta num" role="timer" aria-live="assertive">{cuenta}</span>}
            {grabando && <span class="camara-rec num" role="timer" aria-label={`Grabando: ${mmss(seg)}`}><span class="camara-rec-punto" aria-hidden="true" />{mmss(seg)}{pararSola > 0 ? ` / ${mmss(pararSola)}` : ''}</span>}
            {error && <div class="camara-error" role="alert"><p>{error}</p><button class="btn" onClick={cerrar}>Elegir de la galería</button></div>}
            {!lista && !error && <span class="camara-espera">Abriendo la cámara…</span>}
          </>
        )}
        {estado === 'revisar' && grabado && <video class="camara-revisar" src={grabado.url} controls playsInline aria-label="El vídeo que acabas de grabar" />}
        {verPuntos && puntos.length > 0 && estado !== 'revisar' && (
          <div class="camara-puntos">
            <strong class="mini">Lo que te ha corregido tu coach</strong>
            <ul>{puntos.slice(0, 6).map((p) => <li key={p} class="mini">{p}</li>)}</ul>
          </div>
        )}
      </div>
      <div class="camara-pie">
        {estado === 'revisar' ? (
          <div class="fila-envolver camara-decidir">
            <button class="btn btn-grande" onClick={repetir}><Icono n="reiniciar" /> Repetir</button>
            <button class="btn btn-primario btn-grande" onClick={() => { const g = grabado; setGrabado(null); alGrabar?.(g.archivo, { fps: g.fps }); }}><Icono n="hecho" /> Usar este vídeo</button>
          </div>
        ) : (
          <>
            <p class="mini camara-pista" role="status"><b>{enc.titulo}.</b> {enc.texto}{' '}
              {nivel ? <span class={`camara-nivel-texto ${nivel.estado}`}>{textoNivel(nivel)}.</span> : null}
              {torcido ? ' Endereza el móvil para que la barra no salga inclinada.' : ''}</p>
            {(pideNivel || puntos.length > 0 || capLenta != null) && (
              <div class="fila-envolver camara-extras">
                {pideNivel && <button class="btn btn-peq" onClick={activarNivel}><Icono n="regla" /> Activar el nivel</button>}
                {puntos.length > 0 && <button class="btn btn-peq" aria-pressed={verPuntos ? 'true' : 'false'} onClick={() => setVerPuntos(!verPuntos)}><Icono n="hecho" /> La corrección</button>}
                {capLenta ? (
                  <button class="btn btn-peq camara-lenta" aria-pressed={lenta ? 'true' : 'false'} disabled={grabando || contando} onClick={() => setLenta(!lenta)}>
                    <Icono n="reloj" /> Cámara lenta ({lenta && fpsReal ? fpsReal : capLenta.fps} fps)
                  </button>
                ) : capLenta === false ? (
                  <button class="btn-texto mini camara-sin-lenta" aria-expanded={verPorQue ? 'true' : 'false'} onClick={() => setVerPorQue(!verPorQue)}>¿Y la cámara lenta?</button>
                ) : null}
              </div>
            )}
            {capLenta === false && verPorQue && <p class="mini camara-pista" role="note">{textoSinLenta({ ios: esIosNav() })}</p>}
            {lenta && fpsReal != null && fpsReal < 50 && <p class="mini camara-pista" role="status">La cámara no ha dado más de {fpsReal} fps: se grabará a velocidad normal.</p>}
            {sinNivel && <span class="sr">Este móvil no tiene nivel: colócalo recto a ojo.</span>}
            <div class="camara-controles camara-controles-video">
              <Segmentos etiqueta="Cuenta atrás" clase="camara-espera-seg" valor={espera} alCambiar={(x) => x && setEspera(x)} opciones={CUENTAS_ATRAS.map((s) => [s, `${s} s`])} />
              <button class={`camara-disparo ${contando || grabando ? 'contando' : ''} ${grabando ? 'grabando' : ''}`} disabled={!lista || !!error} onClick={disparar}
                aria-label={grabando ? 'Parar la grabación' : contando ? 'Cancelar la cuenta atrás' : `Grabar en ${espera} segundos`}>
                <span />
              </button>
              <label class="camara-parar">
                <span class="mini">Parar sola</span>
                <select class="selector" value={pararSola} disabled={grabando || contando} onChange={(e) => setPararSola(Number(e.currentTarget.value))} aria-label="Parar sola a los">
                  {PARAR_SOLA.map((s) => <option key={s} value={s}>{s ? `a los ${s} s` : 'No'}</option>)}
                </select>
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// La silueta de guía: dónde va la persona (y cómo se ve) según el encuadre. Solo trazo, decorativa.
function Silueta({ vista }) {
  return (
    <svg class={`camara-silueta silueta-${vista === '45' ? 'diagonal' : vista}`} viewBox="0 0 100 133" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <rect x="22" y="10" width="56" height="116" rx="6" class="silueta-zona" />
      {vista === 'frente' && (
        <g class="silueta-cuerpo"><circle cx="50" cy="26" r="7" /><path d="M50 33v34M35 42l15 4 15-4M42 67l-6 34M58 67l6 34M36 101l-2 15M64 101l2 15" /></g>
      )}
      {vista === 'lado' && (
        <g class="silueta-cuerpo"><circle cx="52" cy="26" r="7" /><path d="M30 38h44M51 33l-3 34M48 67l8 22-6 27M50 116h10M48 50l6 -10" /></g>
      )}
      {vista === '45' && (
        <g class="silueta-cuerpo"><path d="M24 92l40 -14 14 6-40 14z" /><circle cx="46" cy="78" r="6" /><path d="M40 62h30M50 62v14M60 62v14" /></g>
      )}
      <path d="M50 4v4M50 125v4" class="silueta-centro" />
    </svg>
  );
}
