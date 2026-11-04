// v0.60 (1 y 2): «Grabar la revisión». El coach revisa el vídeo en su reproductor (reproducir, pausar, ir a otro momento, la
// cámara lenta, el zoom y los dibujos que va haciendo) y lo cuenta con su voz; la app lo graba todo en un vídeo (en el propio
// móvil u ordenador, con el compositor) y, tras verlo, lo manda al hilo de ese vídeo como su respuesta. Si quiere, con su cara
// (la cámara de delante) en una burbuja en una esquina, que se arrastra a otra antes de empezar.
// El micro y la cámara se piden al empezar (no antes), se dice qué se graba, y se sueltan al parar, al cancelar o al cerrar.
// Si este navegador no puede grabar un lienzo con sonido, el botón ni sale (la voz sobre el vídeo de siempre sigue ahí).
// También, «Responder con vídeo» (2): la cámara de delante y el micro, hasta un minuto, en el hilo de un vídeo (el coach o el
// atleta), como un mensaje de vídeo.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, Icono, Hoja, usePreferencia } from '../comunes.jsx';
import { reproductorDe } from '../Video.jsx';
import { VerArchivo } from '../Archivos.jsx';
import { revocarLuego, crearGrabacion, puedeComponer, pintarFotograma, pintarDibujo, pintarBurbuja, pintarPildora, pintarMarcaAgua, pintarTextos, soltarFlujo, formatoComposicion } from './compositor.js';
import { useCorrecciones } from './correcciones.js';
import { medidasSalida, burbuja, esquinaMasCercana, esquinaValida, NOMBRE_ESQUINA, ESQUINAS, MAX_SEG_REVISION, MAX_SEG_CARA, elegirFormato, lineaDeCapas, capasEn } from '../../logica/composicion.js';
import { textoContador } from '../../logica/notasVoz.js';

const hayMedios = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
export const puedeGrabarRevision = () => hayMedios() && puedeComponer({ audio: true });
const esCompatible = (t) => { try { return !!globalThis.MediaRecorder?.isTypeSupported?.(t); } catch { return false; } };
export const puedeResponderConVideo = () => hayMedios() && typeof globalThis.MediaRecorder === 'function' && !!elegirFormato(esCompatible, { audio: true });
const textoError = (e, cosa = 'el micro') => {
  const n = e?.name || '';
  if (n === 'NotAllowedError' || n === 'SecurityError') return `No has dado permiso para usar ${cosa}. Puedes darlo en los ajustes del navegador.`;
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return `No se encuentra ${cosa} en este dispositivo.`;
  if (n === 'NotReadableError') return `${cosa[0].toUpperCase()}${cosa.slice(1)} lo está usando otra app: ciérrala y vuelve a probar.`;
  return e?.message || `No se puede abrir ${cosa}.`;
};

// ---------------------------------------------------------------- 1. Grabar la revisión
export function GrabarRevision({ video, nombreAtleta = 'Atleta', alCerrar, alEnviado }) {
  const { api, aviso } = useApp();
  const [fase, setFase] = useState('preparar'); // preparar | pidiendo | grabando | revisar | enviando
  const [conCara, setConCara] = usePreferencia('fbe-revision-cara', false);
  const [esquinaG, setEsquina] = usePreferencia('fbe-revision-esquina', 'abajo-der');
  const esquina = esquinaValida(esquinaG) ? esquinaG : 'abajo-der';
  const [seg, setSeg] = useState(0);
  const [error, setError] = useState(null);
  const [hecho, setHecho] = useState(null); // { blob, seg, url, tipo }
  const [subida, setSubida] = useState(null);
  const r = useRef({});
  const camara = useRef(null);
  const primer = (nombreAtleta || 'Atleta').split(' ')[0];
  // Las marcas del vídeo (sus comentarios con momento y los puntos clave), como en «Exportar»: al pasar por ellas, su texto
  const corr = useCorrecciones(video.id);
  const lineaRef = useRef([]);
  lineaRef.current = lineaDeCapas({ comentarios: corr.comentarios || [], revision: corr.revision || null, duracion: video.duracion_seg });

  const soltar = () => {
    const x = r.current;
    cancelAnimationFrame(x.raf); clearInterval(x.tic);
    soltarFlujo(x.micro); soltarFlujo(x.cara);
    x.micro = null; x.cara = null;
    if (camara.current) camara.current.srcObject = null;
  };
  // Al cerrar (o salir), todo fuera: la grabación, el micro, la cámara y la vista previa
  useEffect(() => () => { r.current.g?.cancelar(); soltar(); }, []);
  useEffect(() => () => { if (hecho?.url) revocarLuego(hecho.url); }, [hecho?.url]);

  async function empezar() {
    setError(null); setFase('pidiendo');
    const x = r.current = { ...r.current, cancelada: false };
    try {
      x.micro = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) { soltar(); setFase('preparar'); setError(textoError(e, 'el micro')); return; }
    if (conCara) {
      try {
        x.cara = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
        if (camara.current) { camara.current.srcObject = x.cara; await camara.current.play().catch(() => {}); }
      } catch (e) { soltar(); setFase('preparar'); setError(`${textoError(e, 'la cámara de delante')} Prueba sin tu cara en la burbuja.`); return; }
    }
    const rep = reproductorDe(video.id);
    const v = rep?.elemento?.();
    if (!v?.videoWidth) { soltar(); setFase('preparar'); setError('El vídeo aún no está listo: espera un momento y vuelve a probar.'); return; }
    const { w, h } = medidasSalida(v.videoWidth, v.videoHeight);
    let g;
    try { g = crearGrabacion({ w, h, pistas: x.micro.getAudioTracks(), maxSeg: MAX_SEG_REVISION, alTope: () => parar() }); }
    catch (e) { soltar(); setFase('preparar'); setError(e.message); return; }
    x.g = g;
    const k = Math.max(1, Math.min(w, h) / 400);
    const pintar = () => {
      const est = rep.estado?.() || {};
      const rr = pintarFotograma(g.ctx, v, w, h, { zoom: est.zoom, caja: est.caja, rect: est.rect });
      pintarDibujo(g.ctx, est.formas, rr, est.proporcion || rr.w / rr.h);
      g.ctx.setTransform(1, 0, 0, 1, 0, 0);
      pintarTextos(g.ctx, capasEn(lineaRef.current, v.currentTime).textos, w, h);
      if (est.vel && est.vel < 1) pintarPildora(g.ctx, est.vel === 0.25 ? '0,25×' : '0,5×', 14 * k, 14 * k, { k });
      if (x.cara && camara.current) pintarBurbuja(g.ctx, camara.current, esquina, w, h);
      pintarMarcaAgua(g.ctx, w, h);
      x.raf = requestAnimationFrame(pintar);
    };
    pintar();
    g.empezar();
    setSeg(0); setFase('grabando');
    x.tic = setInterval(() => setSeg(g.seg()), 250);
  }
  async function parar() {
    const x = r.current;
    if (!x.g || x.parando) return;
    x.parando = true;
    try {
      const res = await x.g.parar();
      setHecho({ ...res, url: URL.createObjectURL(res.blob) });
      setFase('revisar');
      reproductorDe(video.id)?.pausar?.();
    } catch (e) { if (!e?.cancelado) setError(e.message); setFase('preparar'); }
    finally { x.g = null; x.parando = false; soltar(); }
  }
  const cancelar = () => { r.current.g?.cancelar(); r.current.g = null; soltar(); setFase('preparar'); setSeg(0); };
  const repetir = () => { setHecho(null); setFase('preparar'); setSeg(0); };
  async function enviar() {
    if (!hecho) return;
    setFase('enviando'); setSubida(0);
    try {
      await api.responderConVideo(video, hecho.blob, { autor: 'coach', seg: hecho.seg, texto: 'Revisión grabada', alProgreso: setSubida });
      aviso(`Revisión enviada a ${primer}: la verá en el hilo de su vídeo`);
      try { window.dispatchEvent(new CustomEvent('fbe-hilo', { detail: video.id })); } catch { /* */ }
      alEnviado?.();
      alCerrar?.();
    } catch (e) { aviso(e.message, 'error'); setFase('revisar'); } finally { setSubida(null); }
  }
  const cerrar = () => { if (fase === 'enviando') return; cancelar(); alCerrar?.(); };
  const grabando = fase === 'grabando';
  return (
    <Hoja titulo="Grabar la revisión" alCerrar={cerrar} ancho={760}>
      {fase === 'revisar' || fase === 'enviando' ? (
        <div class="pila-s">
          <video class="medio" src={hecho?.url} controls playsInline aria-label="La revisión que acabas de grabar" data-bytes={hecho?.blob?.size || 0} data-tipo={hecho?.tipo || ''} />
          <p class="mini terciario">{textoContador(hecho?.seg || 0)} · {Math.max(0.1, Math.round((hecho?.blob?.size || 0) / 104857.6) / 10).toLocaleString('es-ES')} MB. {primer} la verá en el hilo de su vídeo (le llega un aviso, sin el contenido).</p>
          {fase === 'enviando' && <div class="recorte-progreso" aria-hidden="true"><span style={{ width: `${Math.round((subida || 0) * 100)}%` }} /></div>}
          <div class="fila-envolver">
            <button type="button" class="btn btn-primario" disabled={fase === 'enviando'} onClick={enviar}><Icono n="enviar" /> {fase === 'enviando' ? `Enviando… ${Math.round((subida || 0) * 100)} %` : 'Enviar'}</button>
            <button type="button" class="btn" disabled={fase === 'enviando'} onClick={repetir}><Icono n="reiniciar" /> Repetir</button>
          </div>
        </div>
      ) : (
        <div class="pila-s">
          <div class={`grabar-revision ${grabando ? 'grabando' : ''}`}>
            <VerArchivo archivo={video} cors etiqueta="El vídeo que revisas" />
            {conCara && <BurbujaArrastrable esquina={esquina} setEsquina={setEsquina} bloqueada={grabando} camara={camara} viva={!!r.current.cara} />}
          </div>
          {grabando ? (
            <div class="fila-envolver grabar-revision-mando" role="group" aria-label="Grabando la revisión">
              <span class="chat-grabando-punto" aria-hidden="true" />
              <span class="num" role="timer" aria-label={`Grabando: ${textoContador(seg)}`}>{textoContador(seg)} / {textoContador(MAX_SEG_REVISION)}</span>
              <button type="button" class="btn btn-peq" onClick={() => reproductorDe(video.id)?.dibujar?.(() => {})}><Icono n="regla" /> Dibujar</button>
              <button type="button" class="btn btn-peq btn-primario" onClick={parar}><Icono n="parar" /> Parar</button>
              <button type="button" class="btn btn-peq plano" onClick={cancelar}>Cancelar</button>
            </div>
          ) : (
            <>
              <p class="peq secundario">Se graba lo que ves en este reproductor (reproducir, pausar, la cámara lenta, el zoom y lo que dibujes) y <b>tu voz con el micro</b>{conCara ? <>, y <b>tu cara con la cámara de delante</b> en la burbuja</> : null}. Hasta 3 minutos. El permiso se pide al empezar y se suelta al parar. Después lo ves y decides si se lo mandas a {primer}.</p>
              <label class="campo-linea">
                <input type="checkbox" role="switch" class="interruptor" checked={!!conCara} disabled={fase === 'pidiendo'} onChange={(e) => setConCara(e.currentTarget.checked)} />
                <span class="peq">Tu cara en una burbuja (cámara de delante)</span>
              </label>
              {conCara && (
                <div class="segmentos grabar-revision-esquinas" role="group" aria-label="Esquina de la burbuja">
                  {ESQUINAS.map((e) => <button key={e} type="button" aria-pressed={esquina === e ? 'true' : 'false'} aria-label={`Burbuja ${NOMBRE_ESQUINA[e]}`} onClick={() => setEsquina(e)}><span aria-hidden="true">{{ 'arriba-izq': '↖', 'arriba-der': '↗', 'abajo-izq': '↙', 'abajo-der': '↘' }[e]}</span></button>)}
                </div>
              )}
              {error && <p class="error" role="alert">{error}</p>}
              <button type="button" class="btn btn-primario" disabled={fase === 'pidiendo'} onClick={empezar}><Icono n="micro" /> {fase === 'pidiendo' ? 'Abriendo el micro…' : 'Empezar a grabar'}</button>
            </>
          )}
          <video ref={camara} class="grabar-revision-camara" muted playsInline aria-hidden="true" />
        </div>
      )}
    </Hoja>
  );
}

// La burbuja sobre el vídeo (en su esquina): se arrastra (o se elige con los botones) antes de grabar; mientras se graba, quieta
function BurbujaArrastrable({ esquina, setEsquina, bloqueada, camara, viva }) {
  const caja = useRef(null);
  const g = useRef(null);
  const [arrastre, setArrastre] = useState(null);
  const lado = String(esquina);
  const estilo = arrastre ? { left: `${arrastre.x * 100}%`, top: `${arrastre.y * 100}%`, transform: 'translate(-50%, -50%)' } : {};
  const pos = (e) => { const b = caja.current?.parentElement?.getBoundingClientRect(); if (!b) return null; return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) }; };
  // (la vista de la cámara, en la burbuja, solo mientras está abierta)
  const vista = useRef(null);
  useEffect(() => { const c = camara.current; if (vista.current && c?.srcObject) { vista.current.srcObject = c.srcObject; vista.current.play?.().catch(() => {}); } }, [viva]);
  return (
    <div ref={caja} class={`burbuja-cara burbuja-${lado} ${arrastre ? 'arrastrando' : ''}`} style={estilo} aria-hidden="true"
      onPointerDown={(e) => { if (bloqueada) return; g.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ } setArrastre(pos(e)); }}
      onPointerMove={(e) => { if (g.current) setArrastre(pos(e)); }}
      onPointerUp={(e) => { if (!g.current) return; g.current = false; const p = pos(e); setArrastre(null); if (p) setEsquina(esquinaMasCercana(p.x, p.y)); }}
      onPointerCancel={() => { g.current = false; setArrastre(null); }}>
      {viva ? <video ref={vista} muted playsInline /> : <Icono n="cara" />}
    </div>
  );
}

// ---------------------------------------------------------------- 2. Responder con vídeo (la cámara de delante)
export function ResponderConVideo({ video, autor, nombre = 'tu coach', alCerrar, alEnviado }) {
  const { api, aviso } = useApp();
  const [fase, setFase] = useState('preparar'); // preparar | pidiendo | lista | grabando | revisar | enviando
  const [seg, setSeg] = useState(0);
  const [error, setError] = useState(null);
  const [hecho, setHecho] = useState(null);
  const [subida, setSubida] = useState(null);
  const vista = useRef(null);
  const r = useRef({});
  const soltar = () => { const x = r.current; clearInterval(x.tic); soltarFlujo(x.flujo); x.flujo = null; if (vista.current) vista.current.srcObject = null; };
  useEffect(() => () => { r.current.cancelada = true; try { if (r.current.rec?.state !== 'inactive') r.current.rec?.stop(); } catch { /* */ } soltar(); }, []);
  useEffect(() => () => { if (hecho?.url) revocarLuego(hecho.url); }, [hecho?.url]);
  async function abrir() {
    setError(null); setFase('pidiendo');
    try {
      const f = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: { echoCancellation: true, noiseSuppression: true } });
      r.current.flujo = f;
      if (vista.current) { vista.current.srcObject = f; await vista.current.play().catch(() => {}); }
      setFase('lista');
    } catch (e) { soltar(); setFase('preparar'); setError(textoError(e, 'la cámara y el micro')); }
  }
  function grabar() {
    const x = r.current;
    const formato = elegirFormato(esCompatible, { audio: true });
    if (!x.flujo || !formato) { setError('Este navegador no puede grabar vídeo.'); return; }
    let rec;
    try { rec = new MediaRecorder(x.flujo, { mimeType: formato.grabar, videoBitsPerSecond: 1_500_000, audioBitsPerSecond: 64000 }); } catch (e) { setError(textoError(e)); return; }
    const trozos = [];
    x.rec = rec; x.cancelada = false;
    rec.ondataavailable = (ev) => { if (ev.data?.size) trozos.push(ev.data); };
    rec.onstop = () => {
      const s = Math.min(MAX_SEG_CARA, (performance.now() - x.inicio) / 1000);
      soltar();
      if (x.cancelada || !trozos.length) { setFase('preparar'); return; }
      const blob = new Blob(trozos, { type: formato.tipo });
      setHecho({ blob, seg: s, tipo: formato.tipo, url: URL.createObjectURL(blob) });
      setFase('revisar');
    };
    rec.start(500);
    x.inicio = performance.now();
    setSeg(0); setFase('grabando');
    x.tic = setInterval(() => { const s = (performance.now() - x.inicio) / 1000; setSeg(s); if (s >= MAX_SEG_CARA) parar(); }, 200);
  }
  function parar() { const x = r.current; clearInterval(x.tic); try { if (x.rec?.state === 'recording') x.rec.stop(); else soltar(); } catch { soltar(); } }
  const cancelar = () => { r.current.cancelada = true; parar(); soltar(); setFase('preparar'); };
  async function enviar() {
    if (!hecho) return;
    setFase('enviando'); setSubida(0);
    try {
      await api.responderConVideo(video, hecho.blob, { autor, seg: hecho.seg, alProgreso: setSubida });
      aviso(autor === 'coach' ? 'Vídeo enviado en su hilo' : 'Vídeo enviado a tu coach');
      alEnviado?.(); alCerrar?.();
    } catch (e) { aviso(e.message, 'error'); setFase('revisar'); } finally { setSubida(null); }
  }
  const cerrar = () => { if (fase === 'enviando') return; cancelar(); alCerrar?.(); };
  return (
    <Hoja titulo="Responder con vídeo" alCerrar={cerrar}>
      {fase === 'revisar' || fase === 'enviando' ? (
        <div class="pila-s">
          <video class="medio respuesta-cara-previa" src={hecho?.url} controls playsInline aria-label="El vídeo que acabas de grabar" data-bytes={hecho?.blob?.size || 0} data-tipo={hecho?.tipo || ''} />
          {fase === 'enviando' && <div class="recorte-progreso" aria-hidden="true"><span style={{ width: `${Math.round((subida || 0) * 100)}%` }} /></div>}
          <div class="fila-envolver">
            <button type="button" class="btn btn-primario" disabled={fase === 'enviando'} onClick={enviar}><Icono n="enviar" /> {fase === 'enviando' ? 'Enviando…' : 'Enviar'}</button>
            <button type="button" class="btn" disabled={fase === 'enviando'} onClick={() => { setHecho(null); setFase('preparar'); }}><Icono n="reiniciar" /> Repetir</button>
          </div>
        </div>
      ) : (
        <div class="pila-s">
          <div class="respuesta-cara-marco"><video ref={vista} class="espejo" muted playsInline aria-hidden="true" />
            {fase === 'grabando' && <span class="camara-rec num" role="timer" aria-label={`Grabando: ${textoContador(seg)}`}><span class="camara-rec-punto" aria-hidden="true" />{textoContador(seg)} / 1:00</span>}
            {fase !== 'lista' && fase !== 'grabando' && <span class="respuesta-cara-hueco"><Icono n="cara" /></span>}
          </div>
          <p class="peq secundario">Un vídeo corto para {nombre} en el hilo de este vídeo, como un mensaje: se graban <b>la cámara de delante y el micro</b>, hasta un minuto. El permiso se pide al abrir la cámara y se suelta al parar.</p>
          {error && <p class="error" role="alert">{error}</p>}
          <div class="fila-envolver">
            {fase === 'grabando' ? (
              <>
                <button type="button" class="btn btn-primario" onClick={parar}><Icono n="parar" /> Parar</button>
                <button type="button" class="btn plano" onClick={cancelar}>Cancelar</button>
              </>
            ) : fase === 'lista' ? (
              <button type="button" class="btn btn-primario" onClick={grabar}><Icono n="camara" /> Grabar</button>
            ) : (
              <button type="button" class="btn btn-primario" disabled={fase === 'pidiendo'} onClick={abrir}><Icono n="camara" /> {fase === 'pidiendo' ? 'Abriendo la cámara…' : 'Abrir la cámara de delante'}</button>
            )}
          </div>
        </div>
      )}
    </Hoja>
  );
}

// El vídeo de una respuesta, en el hilo (con su enlace firmado). Un WebM de MediaRecorder no trae su duración: se busca.
export function VideoRespuesta({ archivo, deQuien = 'respuesta' }) {
  const { api } = useApp();
  const [url, setUrl] = useState(null);
  const [mal, setMal] = useState(false);
  useEffect(() => {
    let vivo = true;
    if (archivo?.ruta) api.urlArchivo(archivo.ruta).then((u) => vivo && setUrl(u)).catch(() => vivo && setMal(true));
    return () => { vivo = false; };
  }, [archivo?.ruta]);
  if (!archivo || mal) return <p class="mini terciario"><Icono n="video" /> Vídeo no disponible</p>;
  if (!url) return <span class="medio-chat-hueco respuesta-video-hueco" />;
  return (
    <video class="respuesta-video" src={url} controls playsInline preload="metadata" aria-label={`Vídeo: ${deQuien}${archivo.duracion_seg ? `, ${textoContador(archivo.duracion_seg)}` : ''}`}
      onLoadedMetadata={(e) => { const v = e.currentTarget; if (!Number.isFinite(v.duration)) { v.currentTime = 1e7; v.addEventListener('timeupdate', () => { v.currentTime = 0; }, { once: true }); } }} />
  );
}
export { formatoComposicion, burbuja };
