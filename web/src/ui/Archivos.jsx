import { useEffect, useRef, useState } from 'preact/hooks';
import { Reproductor, reproductorDe } from './Video.jsx';
import { useApp, Icono, Hoja, Cargando } from './comunes.jsx';
import { fmtCorta } from '../logica/fechas.js';
import { LIMITE_ARCHIVO_MB } from '../datos/api.js';

// Botón que abre la cámara o la galería y envía el vídeo (o la foto) a la carpeta privada del atleta.
export function SubirArchivo({ atletaId, tipo = 'video_tecnica', sesionEjercicioId = null, ejercicioId = null, titulo, etiqueta, clase = 'btn-texto', alSubir }) {
  const { api, aviso } = useApp();
  const input = useRef(null);
  const [archivo, setArchivo] = useState(null);
  const [vista, setVista] = useState(null);
  const [nota, setNota] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const esVideo = tipo === 'video_tecnica';

  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista); }, [vista]);

  function elegido(e) {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    if (f.size > LIMITE_ARCHIVO_MB * 1024 * 1024) { aviso(`Pesa más de ${LIMITE_ARCHIVO_MB} MB. Graba solo la serie (unos 30 segundos).`, 'error'); return; }
    setArchivo(f);
    try { setVista(URL.createObjectURL(f)); } catch { setVista(null); }
  }
  async function enviar() {
    setSubiendo(true);
    try {
      // La miniatura y la duración del vídeo se sacan en el móvil antes de subirlo (si no se puede, se sube igual)
      const cap = esVideo ? await capturarPoster(archivo).catch(() => null) : null;
      const a = await api.subirArchivo(atletaId, archivo, { tipo, sesion_ejercicio_id: sesionEjercicioId, ejercicio_id: ejercicioId, nota_atleta: nota.trim() || null, poster: cap?.poster || null, duracion_seg: cap?.duracion ?? null });
      aviso(esVideo ? 'Vídeo enviado a tu coach' : 'Foto guardada');
      setArchivo(null); setNota('');
      alSubir?.(a);
    } catch (err) { aviso(err.message, 'error'); } finally { setSubiendo(false); }
  }
  const mb = !archivo ? '' : archivo.size < 104858 ? 'menos de 0,1' : (archivo.size / 1048576).toLocaleString('es-ES', { maximumFractionDigits: 1 });
  return (
    <>
      <button type="button" class={clase} onClick={() => input.current?.click()}><Icono n={esVideo ? 'camara' : 'imagen'} /> {etiqueta || (esVideo ? 'Vídeo para tu coach' : 'Añadir foto')}</button>
      <input ref={input} type="file" accept={esVideo ? 'video/*' : 'image/*'} hidden onChange={elegido} aria-label={esVideo ? 'Elegir vídeo' : 'Elegir foto'} />
      {archivo && (
        <Hoja titulo={titulo || (esVideo ? 'Vídeo de técnica' : 'Foto de progreso')} alCerrar={() => !subiendo && setArchivo(null)}>
          {vista && (esVideo
            ? <video class="medio" src={vista} controls playsInline preload="metadata" />
            : <img class="medio" src={vista} alt="Vista previa de la foto" />)}
          <p class="mini terciario">{archivo.name || 'Archivo'}, {mb} MB. Se guarda en tu carpeta privada: solo lo veis tú y tu coach.</p>
          <div class="campo">
            <label for="arch-nota">{esVideo ? '¿Qué quieres que mire?' : 'Nota (opcional)'}</label>
            <textarea id="arch-nota" class="area" style="min-height:64px" value={nota} onInput={(e) => setNota(e.currentTarget.value)}
              placeholder={esVideo ? 'Por ejemplo: la profundidad, o si se me van las rodillas' : 'Frente, perfil, espalda…'} />
          </div>
          <button class="btn btn-primario btn-grande" disabled={subiendo} onClick={enviar}>{subiendo ? 'Subiendo…' : esVideo ? 'Enviar a tu coach' : 'Guardar foto'}</button>
        </Hoja>
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
