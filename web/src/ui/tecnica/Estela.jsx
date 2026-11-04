// v0.61 (8): «Estela del movimiento» en el reproductor: la trayectoria de la barra (la del análisis guardado en la
// corrección, 036, o la de esta sesión) o, si hay puntos del cuerpo de esta sesión, de una articulación (la cadera, la
// rodilla…), en los últimos fotogramas y apagándose, como en las repeticiones de la tele. Se enciende en el reproductor y
// vale para todos los reproductores abiertos (también los dos de «Dos ángulos») y para lo que graba el compositor («Grabar
// la revisión» y «Exportar con correcciones»). Con «reducir movimiento», la trayectoria entera y quieta. Lo que se elige
// (encendida, qué sigue y lo larga que es) se guarda solo en este dispositivo. La geometría, en logica/estela.js.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { leerPreferencia, guardarPreferencia } from '../preferencias.js';
import { segmentosEstela, cabezaEstela, trayectoriaEstela, fuentesEstela, segundosEstela, largoValido, LARGO_ESTELA, ARTICULACIONES_ESTELA } from '../../logica/estela.js';

export const COLOR_ESTELA = '#3EE0FF';
const CLAVE = 'fbe-estela';
const DEFECTO = { activa: false, fuente: 'barra', largo: LARGO_ESTELA };
const fuentesValidas = ARTICULACIONES_ESTELA.map(([k]) => k);
const sanear = (x) => ({
  activa: x?.activa === true,
  fuente: fuentesValidas.includes(x?.fuente) ? x.fuente : 'barra',
  largo: largoValido(Number(x?.largo)) ? Number(x.largo) : LARGO_ESTELA,
});
// Las preferencias, compartidas entre todos los reproductores abiertos (encender en uno la enciende en los dos ángulos)
let prefs = null;
const oyentes = new Set();
export function prefsEstela() { if (!prefs) prefs = sanear(leerPreferencia(CLAVE, DEFECTO)); return prefs; }
export function fijarPrefsEstela(cambio) {
  prefs = sanear({ ...prefsEstela(), ...cambio });
  guardarPreferencia(CLAVE, prefs);
  for (const f of oyentes) f(prefs);
}
export function usePrefsEstela() {
  const [p, setP] = useState(prefsEstela);
  useEffect(() => { const f = (x) => setP(x); oyentes.add(f); return () => oyentes.delete(f); }, []);
  return [p, fijarPrefsEstela];
}
export const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Lo que hay para la estela de un vídeo (de lo que comparten la corrección y el análisis: correcciones.js)
export function datosEstela(corr) {
  const barra = corr?.barraSesion?.length > 1 ? corr.barraSesion : corr?.revision?.analisis?.barra?.p || null;
  const pose = corr?.poseFotosSesion?.fotos?.length ? corr.poseFotosSesion : null;
  return { barra, pose };
}
export function useEstela(corr) {
  const [p, fijar] = usePrefsEstela();
  const { barra, pose } = datosEstela(corr);
  const fuentes = useMemo(() => fuentesEstela({ barra, pose }), [barra, pose]);
  const tray = useMemo(() => trayectoriaEstela({ fuente: p.fuente, barra, pose }), [p.fuente, barra, pose]);
  return { prefs: p, fijar, fuentes, disponible: fuentes.length > 0, activa: p.activa && tray.puntos.length > 1, trayectoria: tray.puntos, fuente: tray.fuente, ventana: segundosEstela(p.largo) };
}
// Para el compositor: lo que hace falta para pintarla en cada momento (o null si está apagada)
export const estelaParaCompositor = (e) => (e?.activa ? { puntos: e.trayectoria, ventana: e.ventana, estatica: sinMovimiento() } : null);

// El momento del vídeo, al ritmo de la imagen mientras se reproduce (timeupdate va a saltos de un cuarto de segundo)
function useAhora(video, t, quieta) {
  const [x, setX] = useState(t);
  useEffect(() => { setX(t); }, [t]);
  useEffect(() => {
    if (!video || quieta) return undefined;
    let id = 0;
    const f = () => { setX(video.currentTime); if (!video.paused && !video.ended) id = requestAnimationFrame(f); };
    const al = () => { cancelAnimationFrame(id); id = requestAnimationFrame(f); };
    video.addEventListener('play', al); video.addEventListener('seeked', al);
    if (!video.paused) al();
    return () => { cancelAnimationFrame(id); video.removeEventListener('play', al); video.removeEventListener('seeked', al); };
  }, [video, quieta]);
  return x;
}

// La capa sobre el vídeo (en el rectángulo de la imagen, como las del análisis)
export function CapaEstela({ estela, rect, caja, t, video }) {
  const quieta = sinMovimiento();
  const ahora = useAhora(video, t, quieta);
  if (!estela?.activa || !rect?.w) return null;
  const X = (x) => rect.x + x * rect.w, Y = (y) => rect.y + y * rect.h;
  const segs = segmentosEstela(estela.trayectoria, ahora, { ventana: estela.ventana, estatica: quieta });
  const cab = cabezaEstela(estela.trayectoria, ahora);
  return (
    <svg class={`capa-estela ${quieta ? 'quieta' : ''}`} viewBox={`0 0 ${caja.w} ${caja.h}`} width="100%" height="100%" aria-hidden="true" data-segmentos={segs.length}>
      <g class="estela-fondo">{segs.map((s, i) => <line key={`f${i}`} x1={X(s.a[0])} y1={Y(s.a[1])} x2={X(s.b[0])} y2={Y(s.b[1])} style={{ opacity: s.alfa }} />)}</g>
      <g class="estela-trazo">{segs.map((s, i) => <line key={i} x1={X(s.a[0])} y1={Y(s.a[1])} x2={X(s.b[0])} y2={Y(s.b[1])} style={{ opacity: s.alfa }} />)}</g>
      {cab && <circle class="estela-cabeza" cx={X(cab[0])} cy={Y(cab[1])} r="5" />}
    </svg>
  );
}

// Los mandos, en la barra del reproductor: encender y apagar y, si hay más de una cosa que seguir, cuál; y lo larga
export function MandosEstela({ estela, desactivado = false }) {
  if (!estela?.disponible) return null;
  const { prefs: p, fijar, fuentes } = estela;
  return (
    <span class="rep-estela" role="group" aria-label="Estela del movimiento">
      <button type="button" class="btn btn-peq" aria-pressed={p.activa ? 'true' : 'false'} disabled={desactivado} onClick={() => fijar({ activa: !p.activa })}>
        <span class="rep-estela-ico" aria-hidden="true" /> Estela
      </button>
      {p.activa && fuentes.length > 1 && (
        <select class="selector selector-peq" aria-label="Qué sigue la estela" value={estela.fuente || 'barra'} onChange={(e) => fijar({ fuente: e.currentTarget.value })}>
          {fuentes.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
      )}
      {p.activa && !sinMovimiento() && (
        <select class="selector selector-peq" aria-label="Lo larga que es la estela" value={String(p.largo)} onChange={(e) => fijar({ largo: Number(e.currentTarget.value) })}>
          <option value="15">Corta</option><option value="45">Media</option><option value="90">Larga</option>
        </select>
      )}
    </span>
  );
}
