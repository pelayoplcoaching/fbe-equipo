// «Revisar seguidos» (v0.57): los vídeos por revisar uno detrás de otro, a pantalla completa, como en TikTok: deslizar
// hacia arriba (o «Siguiente», j, ↓) pasa al siguiente y hacia abajo (o «Anterior», k, ↑) vuelve; en orden de llegada, por
// atleta o por ejercicio. Darlo por revisado o contestar lleva solo al siguiente. Con Escape (o ✕) se cierra.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, Icono, Avatar, useAtraparFoco, Capa } from '../comunes.jsx';
import { VerArchivo } from '../Archivos.jsx';
import { Hilo } from '../Hilo.jsx';
import { PanelCorreccion } from './Correccion.jsx';
import { fmtConDia } from '../../logica/fechas.js';
import { ordenarCola, ORDENES_COLA } from '../../logica/tecnica.js';

export function RevisionSeguida(props) { return <Capa><Pantalla {...props} /></Capa>; }

function Pantalla({ videos, alCerrar, abrirAtleta }) {
  const { api, aviso } = useApp();
  const raiz = useRef(null);
  useAtraparFoco(raiz);
  const [orden, setOrden] = useState('antiguos');
  const [cola, setCola] = useState(() => ordenarCola(videos, 'antiguos'));
  const [i, setI] = useState(0);
  const [hechos, setHechos] = useState(() => new Set());
  const [sentido, setSentido] = useState('');
  const gesto = useRef(null);
  const actual = cola[i] || null;
  const cerrarRef = useRef(alCerrar);
  cerrarRef.current = alCerrar;
  const ir = (n) => {
    if (n < 0 || n > cola.length) return;
    setSentido(n > i ? 'siguiente' : 'anterior');
    setI(n);
  };
  const siguiente = () => ir(Math.min(cola.length, i + 1));
  const anterior = () => ir(Math.max(0, i - 1));
  const iRef = useRef(i); iRef.current = i;
  const nav = useRef({}); nav.current = { siguiente, anterior };

  useEffect(() => { setCola(ordenarCola(videos, orden)); setI(0); }, [orden]);
  // El teclado: j / ↓ siguiente, k / ↑ anterior (no mientras se escribe ni dentro del reproductor), Escape cierra
  useEffect(() => {
    const previo = document.activeElement;
    const tecla = (e) => {
      const modales = document.querySelectorAll('[aria-modal="true"]');
      if (modales.length && modales[modales.length - 1] !== raiz.current) return;
      if (e.key === 'Escape') { e.preventDefault(); cerrarRef.current?.(); return; }
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable="true"], .reproductor, [role="slider"]')) return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); nav.current.siguiente(); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); nav.current.anterior(); }
    };
    document.addEventListener('keydown', tecla);
    const cuerpo = document.body;
    cuerpo.dataset.hojas = String(Number(cuerpo.dataset.hojas || 0) + 1); cuerpo.style.overflow = 'hidden';
    raiz.current?.querySelector('.seguida-cerrar')?.focus();
    return () => {
      document.removeEventListener('keydown', tecla);
      const quedan = Math.max(0, Number(cuerpo.dataset.hojas || 1) - 1);
      if (quedan) cuerpo.dataset.hojas = String(quedan); else { delete cuerpo.dataset.hojas; cuerpo.style.overflow = ''; }
      if (previo?.isConnected) previo.focus?.();
    };
  }, []);
  // Al cambiar de vídeo, arriba del todo
  useEffect(() => { raiz.current?.querySelector('.seguida-cuerpo')?.scrollTo?.({ top: 0 }); }, [i]);

  const revisado = async () => {
    if (!actual) return;
    try { await api.marcarRevisado('archivo', actual.id); setHechos((h) => new Set(h).add(actual.id)); aviso('Vídeo revisado'); siguiente(); }
    catch (e) { aviso(e.message, 'error'); }
  };
  const contestado = () => { if (actual) { setHechos((h) => new Set(h).add(actual.id)); siguiente(); } };

  // Deslizar arriba o abajo (con el dedo, desde la cabecera o la nota; nunca sobre el vídeo ni dentro de un campo)
  const bajar = (e) => {
    if (e.pointerType === 'mouse' || e.target.closest('input, textarea, select, button, a, video, .reproductor, .hilo')) return;
    gesto.current = { y: e.clientY, x: e.clientX };
  };
  const soltar = (e) => {
    const g = gesto.current; gesto.current = null;
    if (!g) return;
    const dy = e.clientY - g.y, dx = e.clientX - g.x;
    if (Math.abs(dy) > 70 && Math.abs(dy) > Math.abs(dx) * 1.5) { if (dy < 0) siguiente(); else anterior(); }
  };

  const nombre = actual?.atleta?.nombre || 'Atleta';
  return (
    <div ref={raiz} class="seguida" role="dialog" aria-modal="true" aria-label="Revisar los vídeos seguidos">
      <div class="seguida-cab" onPointerDown={bajar} onPointerUp={soltar} onPointerCancel={() => { gesto.current = null; }}>
        <button type="button" class="btn btn-icono plano seguida-cerrar" aria-label="Cerrar" onClick={alCerrar}><Icono n="cerrar" /></button>
        <span class="seguida-contador num" role="status">{actual ? `${i + 1} de ${cola.length}` : `${hechos.size} de ${cola.length} revisados`}</span>
        <select class="selector seguida-orden" aria-label="Orden" value={orden} onChange={(e) => setOrden(e.currentTarget.value)}>
          {ORDENES_COLA.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      </div>
      <div class="seguida-cuerpo">
        {actual ? (
          <article key={actual.id} class={`seguida-tarjeta pila-s ${sentido ? `entra-${sentido}` : ''}`} aria-label={`${nombre}: ${actual.ejercicio?.nombre || 'vídeo de técnica'}`}
            onPointerDown={bajar} onPointerUp={soltar}>
            <div class="separa">
              <button type="button" class="btn-texto nombre-atleta" onClick={() => { alCerrar(); abrirAtleta?.(actual.atleta?.id, 'videos'); }}><Avatar nombre={nombre} foto={actual.atleta?.foto} clase="peq" />{nombre}</button>
              <span class="mini terciario">{actual.ejercicio?.nombre ? `${actual.ejercicio.nombre}, ` : ''}{fmtConDia(actual.fecha)}{hechos.has(actual.id) ? ' · revisado' : ''}</span>
            </div>
            {actual.nota_atleta && <p class="cita">«{actual.nota_atleta}»</p>}
            <VerArchivo archivo={actual} />
            <PanelCorreccion video={actual} esCoach nombreAtleta={nombre} />
            <Hilo atletaId={actual.atleta_id} archivoId={actual.id} nombreAtleta={nombre} alCambiar={contestado} placeholder="Qué corregir, qué está bien…" ejercicio={actual.ejercicio || null} />
          </article>
        ) : (
          <div class="seguida-fin pila-s" role="status">
            <strong>Ya no quedan más</strong>
            <p class="peq secundario">{hechos.size === cola.length ? `Has revisado los ${cola.length} vídeos.` : `Has revisado ${hechos.size} de ${cola.length}. Los demás siguen en Revisar.`}</p>
            <button type="button" class="btn btn-primario" onClick={alCerrar}>Volver a Revisar</button>
          </div>
        )}
      </div>
      <div class="seguida-pie">
        <button type="button" class="btn" disabled={i === 0} onClick={anterior} aria-label="Vídeo anterior"><Icono n="arriba" /><span class="texto-ancho"> Anterior</span></button>
        {actual && <button type="button" class="btn btn-primario" disabled={hechos.has(actual.id)} onClick={revisado}><Icono n="hecho" /> Revisado y siguiente</button>}
        <button type="button" class="btn" disabled={!actual} onClick={siguiente} aria-label="Vídeo siguiente"><Icono n="abajo" /><span class="texto-ancho"> Siguiente</span></button>
      </div>
      <p class="mini terciario seguida-atajos solo-ancho">Desliza hacia arriba o abajo, o <kbd>j</kbd> <kbd>k</kbd>; <kbd>Esc</kbd> para salir.</p>
    </div>
  );
}
