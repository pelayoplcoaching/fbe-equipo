// v0.60 (13): «Difuminar la cara» en la hoja de enviar un vídeo. Apagado de serie (se puede dejar encendido en «Este móvil»).
// La cara se busca en este móvil con el modelo de los puntos del cuerpo que ya lleva la app (sin descargar otro: el mismo
// del análisis), se sigue de un fotograma a otro (los que no salen se rellenan con los de al lado) y se tapa al grabar el
// vídeo otra vez con el compositor. Antes de enviarlo, la vista previa. Si no se encuentra la cara en ningún fotograma, se
// dice y no se envía un vídeo «difuminado» que no lo está. Con el difuminado, el original no sale del móvil: lo que se sube
// (y lo que espera en el móvil si no hay cobertura) es el difuminado. Topes: 2 minutos, unos 600 fotogramas mirados, y
// cancelar en cualquier momento.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, Icono } from '../comunes.jsx';
import { revocarLuego, buscarCaras, grabarDifuminado, puedeComponer } from './compositor.js';
import { crearDetector, poseDisponible } from './analisis/pose.js';
import { cajaCabeza, interpolarCajas, tiemposCara, textoDeteccion } from '../../logica/cara.js';
import { MAX_SEG_DIFUMINAR, MAX_MUESTRAS_CARA } from '../../logica/composicion.js';

export const puedeDifuminar = (demo = false) => puedeComponer() && poseDisponible(demo);

// activo / setActivo: el interruptor; corte: { inicio, fin, dur } (el recorte elegido); alListo({ archivo, dur } | null)
export function DifuminarCara({ archivo, corte, activo, setActivo, alListo }) {
  const { modo } = useApp();
  const demo = modo === 'demo';
  const [fase, setFase] = useState('nada'); // nada | buscando | grabando | listo | sin-cara | error
  const [progreso, setProgreso] = useState(0);
  const [mensaje, setMensaje] = useState('');
  const [vista, setVista] = useState(null); // { url, archivo, dur, deteccion }
  const senal = useRef(null);
  const contenedor = useRef(null);
  const det = useRef(null);
  const soltarTodo = () => { if (senal.current) senal.current.aborted = true; senal.current = null; try { det.current?.cerrar(); } catch { /* */ } det.current = null; };
  useEffect(() => () => soltarTodo(), []);
  useEffect(() => () => { if (vista?.url) revocarLuego(vista.url); }, [vista?.url]);
  // Otro vídeo, otro recorte o apagarlo: lo hecho ya no vale
  useEffect(() => { soltarTodo(); setVista(null); setFase('nada'); alListo(null); }, [archivo, activo, corte?.inicio, corte?.fin]);
  if (!archivo || !puedeDifuminar(demo)) return null;
  const desde = corte?.inicio || 0, hasta = corte?.fin ?? corte?.dur ?? null;
  const largo = hasta != null && hasta - desde > MAX_SEG_DIFUMINAR + 0.5;
  async function preparar() {
    soltarTodo();
    const s = senal.current = { aborted: false };
    setVista(null); setMensaje(''); setProgreso(0); setFase('buscando'); alListo(null);
    const url = URL.createObjectURL(archivo);
    try {
      det.current = await crearDetector({ demo });
      if (s.aborted) return;
      const { muestras } = await buscarCaras(url, { desde, hasta, detector: det.current, tiempos: (d) => tiemposCara(d, { max: MAX_MUESTRAS_CARA }), cajaDe: cajaCabeza,
        alProgreso: (x) => setProgreso(x * 0.5), senal: s });
      try { det.current?.cerrar(); } catch { /* */ } det.current = null;
      if (s.aborted) return;
      const deteccion = interpolarCajas(muestras);
      if (deteccion.estado === 'nada') { setFase('sin-cara'); setMensaje(textoDeteccion(deteccion)); return; }
      setFase('grabando');
      const r = await grabarDifuminado(url, { desde, hasta, cajas: deteccion.cajas, contenedor: contenedor.current, alProgreso: (x) => setProgreso(0.5 + x * 0.5), senal: s });
      if (s.aborted) return;
      const f = new File([r.blob], `difuminado.${r.ext}`, { type: r.tipo });
      setVista({ url: URL.createObjectURL(r.blob), archivo: f, dur: r.seg, deteccion });
      setMensaje(textoDeteccion(deteccion));
      setFase('listo');
      alListo({ archivo: f, dur: r.seg });
    } catch (e) {
      if (e?.cancelado || s.aborted) { setFase('nada'); return; }
      setFase('error'); setMensaje(e.message || 'No se ha podido difuminar');
    } finally { URL.revokeObjectURL(url); if (senal.current === s) senal.current = null; try { det.current?.cerrar(); } catch { /* */ } det.current = null; }
  }
  const cancelar = () => { soltarTodo(); setFase('nada'); };
  const trabajando = fase === 'buscando' || fase === 'grabando';
  return (
    <div class="campo difuminar">
      <label class="campo-linea">
        <input type="checkbox" role="switch" class="interruptor" checked={activo} disabled={trabajando} onChange={(e) => setActivo(e.currentTarget.checked)} />
        <span class="peq"><b>Difuminar la cara</b></span>
      </label>
      <span class="ayuda">Se hace en tu móvil: la cara queda tapada y se envía solo el vídeo difuminado (sin sonido); el original no sale del móvil.</span>
      {activo && (
        <div class="pila-s difuminar-cuerpo">
          <div ref={contenedor} class={`exportar-vista ${fase === 'grabando' ? '' : 'oculto'}`} />
          {trabajando ? (
            <div role="status" class="pila-s">
              <div class="recorte-progreso" aria-hidden="true"><span style={{ width: `${Math.round(progreso * 100)}%` }} /></div>
              <p class="peq"><b>{fase === 'buscando' ? 'Buscando tu cara' : 'Difuminando'}… {Math.round(progreso * 100)} %</b></p>
              <button type="button" class="btn btn-texto" onClick={cancelar}>Cancelar</button>
            </div>
          ) : fase === 'listo' && vista ? (
            <>
              <video class="medio difuminado-vista" src={vista.url} controls playsInline aria-label="Vista previa del vídeo con la cara difuminada" data-bytes={vista.archivo.size} data-tipo={vista.archivo.type} />
              <p class="mini secundario" role="status">{mensaje}</p>
              <button type="button" class="btn btn-peq plano" onClick={preparar}><Icono n="reiniciar" /> Hacerlo otra vez</button>
            </>
          ) : (
            <>
              {(fase === 'sin-cara' || fase === 'error') && <p class="error" role="alert">{mensaje}</p>}
              {largo ? <p class="mini error" role="alert">Para difuminarlo, recórtalo a 2 minutos como mucho.</p>
                : <button type="button" class="btn btn-peq" onClick={preparar}><Icono n="cara" /> {fase === 'sin-cara' || fase === 'error' ? 'Probar otra vez' : 'Preparar la vista previa'}</button>}
              <span class="ayuda">La primera vez descarga el modelo de los puntos del cuerpo (unos 12 MB). Tarda más o menos lo que dura el vídeo, dos veces.</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
