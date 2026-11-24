// v0.224: el modo guiado de series (mejora 13 de carrera). A pantalla completa, tramo a tramo (calentar, cada serie con su
// recuperación, las rectas, enfriar): lo que toca y lo que queda, la voz que lo dice al empezar cada tramo (si el móvil
// tiene voz; se puede quitar), tres pitidos al final de cada tramo, una vibración al cambiar y la pantalla encendida. Los
// tramos por distancia (6 × 800 m) no se cronometran: se pasan con «Hecho». El tiempo va por el reloj, no por pasos: si
// el móvil se duerme un momento, al volver está donde tiene que estar.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icono, useAtraparFoco, Capa } from '../comunes.jsx';
import { tramosGuiados, resumenGuiado, mmssGuiado } from '../../logica/carrera-guiada.js';
import { prepararAudio, tono, vibrarCorto, vibrarAviso, usePantallaEncendida } from './sesion-audio.js';
import { hablar, hayVoz, prepararVoz } from '../voz.js';

const CLAVE_VOZ = 'fbe-guia-voz';
const leerVoz = () => { try { return localStorage.getItem(CLAVE_VOZ) !== '0'; } catch { return true; } };

export function GuiaCarrera(props) { return <Capa><Pantalla {...props} /></Capa>; }

function Pantalla({ pauta, titulo = 'Tu sesión', alCerrar }) {
  const raiz = useRef(null);
  useAtraparFoco(raiz);
  usePantallaEncendida();
  const tramos = useMemo(() => tramosGuiados(pauta), [pauta]);
  const total = useMemo(() => resumenGuiado(tramos), [tramos]);
  const [i, setI] = useState(-1); // -1: antes de empezar; tramos.length: acabado
  const [pausa, setPausa] = useState(false);
  const [voz, setVoz] = useState(() => leerVoz() && hayVoz());
  const [, setTic] = useState(0);
  const reloj = useRef({ desde: 0, pausadoEn: 0, pitados: new Set() });
  const actual = i >= 0 && i < tramos.length ? tramos[i] : null;
  const siguiente = i + 1 < tramos.length ? tramos[i + 1] : null;
  const vozRef = useRef(voz); vozRef.current = voz;

  const decir = (t) => { if (vozRef.current && t) hablar(t, { forzar: true }); };
  const ir = (n) => {
    const k = Math.max(0, Math.min(tramos.length, n));
    reloj.current = { desde: Date.now(), pausadoEn: 0, pitados: new Set() };
    setPausa(false);
    setI(k);
    if (k >= tramos.length) { decir('Sesión hecha. Muy bien.'); vibrarAviso(); return; }
    const t = tramos[k];
    decir(`${t.voz}${tramos[k + 1] ? '' : ' Es el último tramo.'}`);
    vibrarCorto(60);
  };
  const empezar = () => { prepararAudio(); prepararVoz(); ir(0); };
  const alternarPausa = () => {
    if (!actual) return;
    if (pausa) { reloj.current.desde += Date.now() - reloj.current.pausadoEn; reloj.current.pausadoEn = 0; setPausa(false); }
    else { reloj.current.pausadoEn = Date.now(); setPausa(true); }
  };
  // El tiempo: lo que lleva el tramo, por el reloj (y con la pausa descontada)
  const lleva = actual ? Math.floor(((pausa ? reloj.current.pausadoEn : Date.now()) - reloj.current.desde) / 1000) : 0;
  const queda = actual?.seg ? Math.max(0, actual.seg - lleva) : null;
  useEffect(() => {
    if (!actual || pausa) return undefined;
    const t = setInterval(() => setTic((x) => x + 1), 250);
    return () => clearInterval(t);
  }, [i, pausa, actual]);
  // Tres pitidos al final de cada tramo cronometrado y, al llegar a cero, al siguiente
  useEffect(() => {
    if (!actual?.seg || pausa) return;
    if (queda <= 3 && queda >= 1 && !reloj.current.pitados.has(queda)) { reloj.current.pitados.add(queda); tono(queda === 1 ? 990 : 880, 0.09, 0.2); }
    if (queda === 0) ir(i + 1);
  });
  // El teclado: espacio, pausa; flechas, tramo anterior o siguiente; Escape, salir
  useEffect(() => {
    const tecla = (e) => {
      const modales = document.querySelectorAll('[aria-modal="true"]');
      if (modales.length && modales[modales.length - 1] !== raiz.current) return;
      if (e.key === 'Escape') { e.preventDefault(); alCerrar(); }
      else if (e.key === ' ' && actual) { e.preventDefault(); alternarPausa(); }
      else if (e.key === 'ArrowRight' && i >= 0) { e.preventDefault(); ir(i + 1); }
      else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); ir(i - 1); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });
  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch { /* sin voz */ } }, []);
  const cambiarVoz = () => { const n = !voz; setVoz(n); try { localStorage.setItem(CLAVE_VOZ, n ? '1' : '0'); } catch { /* sin almacenamiento */ } if (n) { prepararVoz(); hablar('Voz encendida.', { forzar: true }); } };
  const hechos = Math.max(0, Math.min(i, tramos.length));
  const progreso = tramos.length ? (hechos + (actual?.seg ? Math.min(1, lleva / actual.seg) : 0)) / tramos.length : 0;

  return (
    <div ref={raiz} class="gser" role="dialog" aria-modal="true" aria-label={`Guiado: ${titulo}`} data-k={actual?.k || (i < 0 ? 'antes' : 'fin')}>
      <div class="gser-cab">
        <button type="button" class="btn btn-icono plano" aria-label="Salir del guiado" onClick={alCerrar}><Icono n="cerrar" /></button>
        <span class="gser-titulo peq">{titulo}</span>
        {hayVoz() && <button type="button" class="btn btn-peq plano gser-voz" aria-pressed={voz ? 'true' : 'false'} onClick={cambiarVoz}><Icono n={voz ? 'altavoz' : 'silencio'} /> Voz</button>}
      </div>
      <div class="gser-barra" role="progressbar" aria-label="Lo que llevas de la sesión" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progreso * 100)}><span style={{ '--p': progreso }} /></div>
      <div class="gser-cuerpo">
        {i < 0 ? (
          <div class="gser-centro pila-s">
            <p class="gser-que intervalos-fase">{tramos.length} tramos</p>
            <p class="peq secundario">{total.seg ? `Unos ${Math.round(total.seg / 60)} minutos cronometrados` : ''}{total.aMano ? `${total.seg ? '; ' : ''}${total.aMano === 1 ? 'un tramo' : `${total.aMano} tramos`} por distancia, que pasas con «Hecho»` : ''}.</p>
            <ol class="gser-lista mini">{tramos.map((t, k) => <li key={k} data-k={t.k}><strong>{t.titulo}</strong> {t.detalle}</li>)}</ol>
            <button type="button" class="btn btn-primario gser-empezar" onClick={empezar}><Icono n="play" /> Empezar</button>
          </div>
        ) : actual ? (
          <div class="gser-centro pila-s" aria-live="polite">
            <p class="gser-n mini">Tramo {i + 1} de {tramos.length}</p>
            <h2 class="gser-que intervalos-fase">{actual.titulo}</h2>
            <p class="gser-detalle">{actual.detalle}</p>
            {actual.seg ? <p class="gser-reloj intervalos-cuenta num" role="timer" aria-label={`Quedan ${mmssGuiado(queda)}`}>{mmssGuiado(queda)}</p>
              : <p class="gser-reloj gser-amano">A tu ritmo</p>}
            {actual.nota && <p class="peq secundario">{actual.nota}</p>}
            {siguiente && <p class="mini terciario gser-sig">Después: <strong>{siguiente.titulo}</strong> {siguiente.detalle}</p>}
          </div>
        ) : (
          <div class="gser-centro pila-s" role="status">
            <h2 class="gser-que intervalos-fase">Hecho</h2>
            <p class="peq secundario">Has terminado los {tramos.length} tramos. Apunta cómo ha ido al acabar la sesión.</p>
            <button type="button" class="btn btn-primario" onClick={alCerrar}>Volver a la sesión</button>
          </div>
        )}
      </div>
      {actual && (
        <div class="gser-pie">
          <button type="button" class="btn" disabled={i === 0} onClick={() => ir(i - 1)} aria-label="Tramo anterior"><Icono n="atras" /></button>
          {actual.seg
            ? <button type="button" class="btn btn-primario gser-pausa" onClick={alternarPausa}><Icono n={pausa ? 'play' : 'pausa'} /> {pausa ? 'Seguir' : 'Pausa'}</button>
            : <button type="button" class="btn btn-primario gser-pausa" onClick={() => ir(i + 1)}><Icono n="hecho" /> Hecho</button>}
          <button type="button" class="btn" onClick={() => ir(i + 1)} aria-label="Saltar al siguiente tramo"><Icono n="derecha" /></button>
        </div>
      )}
    </div>
  );
}
