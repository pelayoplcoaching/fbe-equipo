import { useEffect, useRef, useState } from 'preact/hooks';
import { Reproductor, reproductorDe } from './Video.jsx';
import { useApp, Icono, Hoja, Cargando } from './comunes.jsx';
import { fmtCorta } from '../logica/fechas.js';
import { LIMITE_ARCHIVO_MB } from '../datos/api.js';
import { sePuedeRecortar, recortarVideo, prepararVideo, megasEstimados } from './recorte.js';

// Botón que abre la cámara o la galería y envía el vídeo (o la foto) a la carpeta privada del atleta.
// Vídeos (v0.30): antes de enviarlo se elige dónde empieza y acaba la serie, y el móvil lo recorta y lo aligera
// (720p, sin sonido) si el navegador sabe hacerlo; si no, se envía como está.
const MB = 1048576;
const ALIGERAR_DESDE_MB = 12; // por debajo, si no se recorta, se envía tal cual
const LIMITE_ELEGIR_MB = 2048; // un vídeo largo se puede elegir si luego se va a recortar en el móvil

export function SubirArchivo({ atletaId, tipo = 'video_tecnica', sesionEjercicioId = null, ejercicioId = null, titulo, etiqueta, clase = 'btn-texto', alSubir }) {
  const { api, aviso } = useApp();
  const input = useRef(null);
  const [archivo, setArchivo] = useState(null);
  const [vista, setVista] = useState(null);
  const [nota, setNota] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [preparando, setPreparando] = useState(null); // progreso 0…1 mientras se recorta
  const [fallo, setFallo] = useState(null); // el recorte ha fallado: se ofrece enviarlo entero
  const [corte, setCorte] = useState(null); // { dur, inicio, fin }
  const contenedor = useRef(null);
  const cancelar = useRef(null);
  const esVideo = tipo === 'video_tecnica';
  const recortable = esVideo && sePuedeRecortar();

  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista); }, [vista]);
  useEffect(() => () => cancelar.current?.(), []); // si se va de la pantalla a medias, se para el recorte
  const [sinVista, setSinVista] = useState(false); // el navegador no sabe leer este vídeo: no se puede recortar

  function elegido(e) {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    const tope = recortable ? LIMITE_ELEGIR_MB : LIMITE_ARCHIVO_MB;
    if (f.size > tope * MB) { aviso(`Pesa más de ${tope} MB. Graba solo la serie (unos 30 segundos).`, 'error'); return; }
    setArchivo(f); setCorte(null); setFallo(null); setSinVista(false);
    try { setVista(URL.createObjectURL(f)); } catch { setVista(null); }
  }
  const recortado = !!corte && (corte.inicio > 0.25 || corte.fin < corte.dur - 0.25);
  const aligerar = recortable && !!corte && (recortado || archivo?.size > ALIGERAR_DESDE_MB * MB);
  // Muy grande y sin poder recortarlo (aún no ha cargado, o este navegador no lo sabe leer): no se puede enviar
  const grandeSinRecorte = !!archivo && esVideo && !corte && archivo.size > LIMITE_ARCHIVO_MB * MB;

  async function subir(f, duracion) {
    // La miniatura y la duración del vídeo se sacan en el móvil antes de subirlo (si no se puede, se sube igual)
    const cap = esVideo ? await capturarPoster(f).catch(() => null) : null;
    const a = await api.subirArchivo(atletaId, f, { tipo, sesion_ejercicio_id: sesionEjercicioId, ejercicio_id: ejercicioId, nota_atleta: nota.trim() || null, poster: cap?.poster || null, duracion_seg: duracion ?? cap?.duracion ?? null });
    aviso(esVideo ? 'Vídeo enviado a tu coach' : 'Foto guardada');
    setArchivo(null); setNota(''); setCorte(null); setFallo(null);
    alSubir?.(a);
  }
  async function enviar({ entero = false } = {}) {
    if (subiendo) return;
    // En el mismo toque (antes de esperar nada): el vídeo que se va a recortar se arranca con el gesto (iPhone)
    const preparado = aligerar && !entero ? prepararVideo(archivo) : null;
    setSubiendo(true);
    let f = archivo, duracion = null;
    try {
      if (preparado) {
        setPreparando(0); setFallo(null);
        const control = { aborted: false };
        cancelar.current = () => { control.aborted = true; };
        let bloqueo = null;
        try { bloqueo = await navigator.wakeLock?.request('screen'); } catch { /* la pantalla puede apagarse: se avisa */ }
        await new Promise((r) => requestAnimationFrame(() => r())); // que esté pintado el hueco donde se ve el vídeo
        try {
          const nuevo = await recortarVideo(archivo, { inicio: corte.inicio, fin: corte.fin, alProgreso: setPreparando, senal: control, contenedor: contenedor.current, preparado });
          // Si no se ha recortado y aligerado no gana nada, va el original (mejor calidad)
          if (recortado || nuevo.size < archivo.size * 0.9) { f = nuevo; duracion = corte.fin - corte.inicio; }
        } catch (err) {
          if (control.aborted) { setPreparando(null); return; }
          setFallo(err.message || 'No se ha podido recortar');
          setPreparando(null);
          return;
        } finally { bloqueo?.release?.().catch?.(() => {}); cancelar.current = null; }
        setPreparando(null);
      }
      if (f.size > LIMITE_ARCHIVO_MB * MB) throw new Error(`Pesa más de ${LIMITE_ARCHIVO_MB} MB. Recórtalo para enviar solo la serie.`);
      await subir(f, duracion);
    } catch (err) { aviso(err.message, 'error'); } finally { setSubiendo(false); setPreparando(null); }
  }
  const mb = (n) => (n < 104858 ? 'menos de 0,1' : (n / MB).toLocaleString('es-ES', { maximumFractionDigits: n < 10 * MB ? 1 : 0 }));
  const cerrar = () => { if (preparando != null) { cancelar.current?.(); return; } if (!subiendo) { setArchivo(null); setFallo(null); } };
  return (
    <>
      <button type="button" class={clase} onClick={() => input.current?.click()}><Icono n={esVideo ? 'camara' : 'imagen'} /> {etiqueta || (esVideo ? 'Vídeo para tu coach' : 'Añadir foto')}</button>
      <input ref={input} type="file" accept={esVideo ? 'video/*' : 'image/*'} hidden onChange={elegido} aria-label={esVideo ? 'Elegir vídeo' : 'Elegir foto'} />
      {archivo && (
        <Hoja titulo={titulo || (esVideo ? 'Vídeo de técnica' : 'Foto de progreso')} alCerrar={cerrar}>
          {preparando != null ? (
            <div class="recorte-preparando" role="status">
              <div ref={contenedor} class="recorte-vista" />
              <div class="recorte-progreso" aria-hidden="true"><span style={{ width: `${Math.round(preparando * 100)}%` }} /></div>
              <p class="peq"><b>Preparando el vídeo… {Math.round(preparando * 100)} %</b></p>
              <p class="mini terciario">Se queda solo con la serie y lo aligera para que suba rápido. No salgas de la app mientras tanto.</p>
              <button type="button" class="btn btn-texto" onClick={() => cancelar.current?.()}>Cancelar</button>
            </div>
          ) : (
            <>
              {vista && (esVideo
                ? <VistaRecorte src={vista} recortable={recortable} corte={corte} setCorte={setCorte} alFallar={() => setSinVista(true)} />
                : <img class="medio" src={vista} alt="Vista previa de la foto" />)}
              <p class="mini terciario">
                {aligerar && corte
                  ? <>Se enviarán {duracionTexto(corte.fin - corte.inicio)} de vídeo, unos {mb(megasEstimados(corte.fin - corte.inicio) * MB)} MB (el original pesa {mb(archivo.size)} MB). </>
                  : <>{archivo.name || 'Archivo'}, {mb(archivo.size)} MB. </>}
                Se guarda en tu carpeta privada: solo lo veis tú y tu coach.
              </p>
              {fallo && (
                <div class="error" role="alert">
                  {fallo}
                  {archivo.size <= LIMITE_ARCHIVO_MB * MB && <div class="aviso-variante-botones"><button type="button" class="btn btn-peq" onClick={() => enviar({ entero: true })}>Enviarlo entero, sin recortar</button></div>}
                </div>
              )}
              <div class="campo">
                <label for="arch-nota">{esVideo ? '¿Qué quieres que mire?' : 'Nota (opcional)'}</label>
                <textarea id="arch-nota" class="area" style="min-height:64px" value={nota} onInput={(e) => setNota(e.currentTarget.value)}
                  placeholder={esVideo ? 'Por ejemplo: la profundidad, o si se me van las rodillas' : 'Frente, perfil, espalda…'} />
              </div>
              {grandeSinRecorte && sinVista && <div class="error" role="alert">Este vídeo no se puede recortar en este móvil y pesa más de {LIMITE_ARCHIVO_MB} MB. Grábalo de nuevo, solo la serie.</div>}
              <button class="btn btn-primario btn-grande" disabled={subiendo || grandeSinRecorte} onClick={() => enviar()}>{subiendo ? 'Subiendo…' : grandeSinRecorte && !sinVista ? 'Cargando el vídeo…' : esVideo ? (recortado ? 'Recortar y enviar' : 'Enviar a tu coach') : 'Guardar foto'}</button>
            </>
          )}
        </Hoja>
      )}
    </>
  );
}

const duracionTexto = (s) => { const t = Math.max(0, Math.round(s)); return t < 60 ? `${t} s` : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} min`; };
const reloj = (s) => { const t = Math.max(0, s); const m = Math.floor(t / 60); const r = t - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0').replace('.', ',')}`; };

// Vista previa con el recorte: dos deslizadores (dónde empieza y dónde acaba la serie); al moverlos, el vídeo va a
// ese momento. «Aquí» usa el momento en que está el vídeo. Mientras se ve, solo se reproduce el trozo elegido.
function VistaRecorte({ src, recortable, corte, setCorte, alFallar }) {
  const v = useRef(null);
  const ir = (t) => { const x = v.current; if (!x) return; x.pause(); x.currentTime = t; };
  const fijar = (campo, valor) => {
    setCorte((c) => {
      if (!c) return c;
      const n = { ...c, [campo]: valor };
      if (campo === 'inicio') n.inicio = Math.min(Math.max(0, valor), c.fin - 0.5);
      else n.fin = Math.max(Math.min(c.dur, valor), c.inicio + 0.5);
      return n;
    });
  };
  return (
    <>
      <video ref={v} class="medio medio-recorte" src={src} controls playsInline preload="metadata"
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setCorte((c) => c || { dur: d, inicio: 0, fin: d }); else alFallar?.(); }}
        onError={() => alFallar?.()}
        onTimeUpdate={(e) => { const x = e.currentTarget; if (corte && !x.paused && x.currentTime >= corte.fin) { x.pause(); x.currentTime = corte.inicio; } }}
        onPlay={(e) => { const x = e.currentTarget; if (corte && (x.currentTime < corte.inicio - 0.05 || x.currentTime >= corte.fin - 0.05)) x.currentTime = corte.inicio; }} />
      {recortable && corte && corte.dur > 1.5 && (
        <div class="recorte" role="group" aria-label="Recortar el vídeo">
          <div class="recorte-titulo"><b>Recorta lo que sobra</b><span class="mini terciario">Deja solo la serie: sube antes y ocupa menos.</span></div>
          <div class="recorte-barra" aria-hidden="true">
            <span style={{ left: `${(corte.inicio / corte.dur) * 100}%`, width: `${((corte.fin - corte.inicio) / corte.dur) * 100}%` }} />
          </div>
          {[['inicio', 'Empieza en'], ['fin', 'Acaba en']].map(([campo, texto]) => (
            <div key={campo} class="recorte-fila">
              <label for={`recorte-${campo}`}>{texto} <b class="num">{reloj(corte[campo])}</b></label>
              <input id={`recorte-${campo}`} type="range" min="0" max={corte.dur} step="0.1" value={corte[campo]}
                onInput={(e) => { const t = Number(e.currentTarget.value); fijar(campo, t); ir(campo === 'inicio' ? Math.min(t, corte.fin - 0.5) : Math.max(t, corte.inicio + 0.5)); }} />
              <button type="button" class="btn btn-peq" aria-label={campo === 'inicio' ? 'Que empiece donde está el vídeo ahora' : 'Que acabe donde está el vídeo ahora'}
                onClick={() => v.current && fijar(campo, v.current.currentTime)}>Aquí</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// Muestra un vídeo o una foto del bucket privado con un enlace firmado (caduca en una hora).
// Miniatura (JPEG de 480 px de ancho) y duración de un vídeo, sacadas en el navegador: se pinta un fotograma
// del principio en un lienzo. Si el formato no se puede leer (algunos HEVC) o tarda, se devuelve null.
export function capturarPoster(archivo, { ancho = 480, segundo = 0.5, tiempo = 7000 } = {}) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(null); return; }
    let url;
    try { url = URL.createObjectURL(archivo); } catch { resolve(null); return; }
    const v = document.createElement('video');
    let listo = false;
    const fin = (r) => { if (listo) return; listo = true; clearTimeout(t); try { URL.revokeObjectURL(url); v.removeAttribute('src'); v.load(); } catch { /* */ } resolve(r); };
    const t = setTimeout(() => fin(null), tiempo);
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.onerror = () => fin(null);
    v.onloadedmetadata = () => {
      try { v.currentTime = Math.min(segundo, Math.max(0.1, (v.duration || 1) / 10)); } catch { fin(null); }
    };
    v.onseeked = () => {
      try {
        const w = v.videoWidth || 0, h = v.videoHeight || 0;
        if (!w || !h) { fin(null); return; }
        const esc = Math.min(1, ancho / w);
        const c = document.createElement('canvas');
        c.width = Math.round(w * esc); c.height = Math.round(h * esc);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        c.toBlob((b) => fin(b ? { poster: b, duracion: Number.isFinite(v.duration) ? Math.round(v.duration) : null } : null), 'image/jpeg', 0.8);
      } catch { fin(null); }
    };
    v.src = url;
  });
}

export function VerArchivo({ archivo }) {
  const { api } = useApp();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let vivo = true;
    api.urlArchivo(archivo.ruta).then((u) => vivo && setUrl(u)).catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [archivo.ruta]);
  if (error) return <div class="nota peq">{error}</div>;
  if (!url) return <div class="medio medio-cargando"><Cargando texto="Cargando el archivo" /></div>;
  const esFoto = archivo.tipo === 'foto_progreso' || (archivo.tipo === 'adjunto' && /^image\//.test(archivo.mime || ''));
  return esFoto
    ? <img class="medio" src={url} alt={archivo.tipo === 'adjunto' ? 'Foto enviada en el chat' : `Foto de progreso del ${archivo.fecha}`} loading="lazy" />
    : <Reproductor src={url} archivoId={archivo.id} />;
}

// Dos vídeos lado a lado (el mismo ejercicio hace dos meses y hoy, o dos intentos): cada uno con su
// reproductor y un mando común para arrancar, parar y volver al principio los dos a la vez
export function CompararVideos({ videos, nombreDe, alCerrar }) {
  const [a, setA] = useState(videos[videos.length - 1]?.id || null);
  const [b, setB] = useState(videos.length > 1 ? videos[videos.length - 2].id : null);
  const va = videos.find((v) => v.id === a), vb = videos.find((v) => v.id === b);
  const ambos = (f) => [va, vb].forEach((v) => v && f(reproductorDe(v.id)));
  const opciones = videos.map((v) => <option key={v.id} value={v.id}>{nombreDe(v)}, {fmtCorta(v.fecha)}</option>);
  return (
    <Hoja titulo="Comparar dos vídeos" alCerrar={alCerrar} ancho={960}>
      <div class="comparar-videos">
        {[['a', a, setA, va], ['b', b, setB, vb]].map(([k, id, set, v]) => (
          <div class="pila-s" key={k}>
            <select class="selector" aria-label={k === 'a' ? 'Vídeo de la izquierda' : 'Vídeo de la derecha'} value={id || ''} onChange={(e) => set(e.currentTarget.value)}>{opciones}</select>
            {v ? <VerArchivo archivo={v} key={v.id} /> : <div class="medio medio-cargando peq secundario">Elige un vídeo</div>}
          </div>
        ))}
      </div>
      <div class="fila-envolver">
        <button class="btn btn-primario" onClick={() => ambos((r) => r?.reproducir?.())}><Icono n="play" /> Los dos a la vez</button>
        <button class="btn" onClick={() => ambos((r) => r?.pausar?.())}><Icono n="pausa" /> Pausar los dos</button>
        <button class="btn" onClick={() => ambos((r) => r?.ir?.(0))}><Icono n="reiniciar" /> Al principio</button>
      </div>
      <p class="mini terciario">Pon los dos a 0,25× y avanza fotograma a fotograma en cada uno para comparar la misma posición.</p>
    </Hoja>
  );
}
