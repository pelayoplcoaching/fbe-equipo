// v0.60 (3): «Exportar con correcciones». El vídeo con lo que ha corregido el coach encima (sus dibujos, los comentarios
// con su momento, los puntos clave con el suyo, la nota de técnica y la marca «FBE») y su voz sobre el vídeo, si la hay,
// hecho en este móvil u ordenador con el compositor. No se sube nada: se guarda en el móvil («Compartir» → Guardar vídeo, o
// una descarga). El coach, de cualquier vídeo corregido; el atleta, de los suyos.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, Icono, Hoja } from '../comunes.jsx';
import { useCorrecciones } from './correcciones.js';
import { revocarLuego, exportarCorregido, puedeComponer, guardarEnMovil } from './compositor.js';
import { lineaDeCapas, textoNota, nombreExportado, MAX_SEG_REVISION } from '../../logica/composicion.js';

export const puedeExportar = (conVoz = false) => puedeComponer({ audio: conVoz });

export function BotonExportar({ video, revision, esCoach = false }) {
  const corr = useCorrecciones(video.id);
  const [abierto, setAbierto] = useState(false);
  const conVoz = !!revision?.voz_archivo_id;
  const hay = !!revision?.corregido_el || (corr.comentarios || []).some((c) => c.autor === 'coach' && !c.eliminado_en);
  if (!hay || !(puedeExportar(conVoz) || puedeExportar(false))) return null;
  return (
    <>
      <button type="button" class="btn btn-peq" onClick={() => setAbierto(true)} aria-haspopup="dialog"><Icono n="descargar" /> Exportar con correcciones</button>
      {abierto && <HojaExportarVideo video={video} revision={revision} comentarios={corr.comentarios || []} esCoach={esCoach} alCerrar={() => setAbierto(false)} />}
    </>
  );
}

function HojaExportarVideo({ video, revision, comentarios, esCoach, alCerrar }) {
  const { api, aviso } = useApp();
  const [fase, setFase] = useState('preparar'); // preparar | haciendo | hecho
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState(null);
  const [hecho, setHecho] = useState(null); // { blob, tipo, ext, url, recortado }
  const contenedor = useRef(null);
  const senal = useRef(null);
  useEffect(() => () => { if (senal.current) senal.current.aborted = true; }, []);
  useEffect(() => () => { if (hecho?.url) revocarLuego(hecho.url); }, [hecho?.url]);
  const linea = lineaDeCapas({ comentarios, revision, duracion: video.duracion_seg });
  const nota = textoNota(revision?.puntuacion ?? null);
  const voz = !!revision?.voz_archivo_id && !!revision?.voz?.ruta;
  async function hacer() {
    setError(null); setFase('haciendo'); setProgreso(0);
    const s = senal.current = { aborted: false };
    try {
      const src = await api.urlArchivo(video.ruta);
      const vozUrl = voz && puedeExportar(true) ? await api.urlArchivo(revision.voz.ruta, { tipo: 'audio' }).catch(() => null) : null;
      const r = await exportarCorregido({ src, linea, nota, voz: vozUrl ? { url: vozUrl, inicio: Number(revision.voz_inicio) || 0, dur: Number(revision.voz.duracion_seg) || 0 } : null,
        contenedor: contenedor.current, alProgreso: setProgreso, senal: s });
      if (s.aborted) return;
      setHecho({ ...r, url: URL.createObjectURL(r.blob) });
      setFase('hecho');
    } catch (e) {
      if (e?.cancelado || s.aborted) { setFase('preparar'); return; }
      setError(e.message || 'No se ha podido exportar'); setFase('preparar');
    } finally { if (senal.current === s) senal.current = null; }
  }
  const cancelar = () => { if (senal.current) senal.current.aborted = true; };
  const guardar = async () => {
    try {
      const nombre = nombreExportado({ ejercicio: video.ejercicio?.nombre || '', fecha: video.fecha, ext: hecho.ext });
      const como = await guardarEnMovil(hecho.blob, nombre);
      if (como === 'descargado') aviso(`Descargado: ${nombre}`);
    } catch (e) { aviso(e.message, 'error'); }
  };
  const mb = (n) => Math.max(0.1, Math.round(n / 104857.6) / 10).toLocaleString('es-ES');
  return (
    <Hoja titulo="Exportar con correcciones" alCerrar={() => { cancelar(); alCerrar(); }}>
      {fase === 'hecho' && hecho ? (
        <div class="pila-s">
          <video class="medio exportado" src={hecho.url} controls playsInline aria-label="El vídeo exportado con las correcciones" data-bytes={hecho.blob.size} data-tipo={hecho.tipo} />
          <p class="mini terciario">{hecho.tipo === 'video/mp4' ? 'MP4' : 'WebM'}, {mb(hecho.blob.size)} MB{hecho.recortado ? ` (los primeros ${MAX_SEG_REVISION / 60} minutos)` : ''}. Está solo en este {esCoach ? 'dispositivo' : 'móvil'}: no se ha subido nada.</p>
          <div class="fila-envolver">
            <button type="button" class="btn btn-primario" onClick={guardar}><Icono n="descargar" /> Guardar en el móvil</button>
            <button type="button" class="btn" onClick={() => { setHecho(null); setFase('preparar'); }}>Hacerlo otra vez</button>
          </div>
        </div>
      ) : (
        <div class="pila-s">
          <div ref={contenedor} class={`exportar-vista ${fase === 'haciendo' ? '' : 'oculto'}`} />
          {fase === 'haciendo' ? (
            <div role="status" class="pila-s">
              <div class="recorte-progreso" aria-hidden="true"><span style={{ width: `${Math.round(progreso * 100)}%` }} /></div>
              <p class="peq"><b>Preparando el vídeo… {Math.round(progreso * 100)} %</b></p>
              <p class="mini terciario">Tarda lo que dura el vídeo (se reproduce mientras se graba). No salgas de la app.</p>
              <button type="button" class="btn btn-texto" onClick={cancelar}>Cancelar</button>
            </div>
          ) : (
            <>
              <p class="peq secundario">Se hace en este {esCoach ? 'dispositivo' : 'móvil'}, sin subir nada: el vídeo con {[linea.some((x) => x.tipo === 'dibujo') && 'los dibujos', linea.some((x) => x.tipo === 'comentario') && 'los comentarios', linea.some((x) => x.tipo === 'punto') && 'los puntos clave', nota && 'la nota', voz && 'la voz del coach'].filter(Boolean).join(', ') || 'las correcciones'} encima (y una marca «FBE» pequeña). Hasta 3 minutos.</p>
              {error && <p class="error" role="alert">{error}</p>}
              <button type="button" class="btn btn-primario" onClick={hacer}><Icono n="video" /> Preparar el vídeo</button>
            </>
          )}
        </div>
      )}
    </Hoja>
  );
}
