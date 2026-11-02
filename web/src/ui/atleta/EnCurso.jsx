// v0.52: «Sesión en curso», como una Live Activity o la Dynamic Island. Mientras una sesión tiene series hechas y no se
// ha terminado, y el atleta está en otra pestaña, una píldora de vidrio arriba (bajo la zona segura) dice qué sesión
// es, el ejercicio que toca y, si hay un descanso en marcha, lo que queda con un anillo pequeño. Al tocarla (o al
// mantenerla pulsada), se abre una tarjeta con lo siguiente y «Volver a la sesión». Los cambios se anuncian con
// educación (al empezar y al acabar el descanso), nunca cada segundo. La cabecera deja su hueco (no tapa sus botones).
// Si el descanso acaba aquí, suena como en la sesión (y se anula el aviso al móvil: ya ha sonado).
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, Icono } from '../comunes.jsx';
import { leerEnCurso, borrarEnCurso, EVENTO_EN_CURSO } from '../en-curso.js';
import { estadoActividad, anuncioActividad, etiquetaActividad } from '../../logica/actividad.js';
import { pitar } from './sesion-comun.jsx';
import { leerAjustes } from '../ajustes.js';
import { hablar } from '../voz.js';

export function useEnCurso(atletaId) {
  const [x, setX] = useState(() => leerEnCurso(atletaId));
  useEffect(() => {
    const leer = () => setX(leerEnCurso(atletaId));
    leer();
    const otra = (e) => { if (!e.key || e.key.startsWith('fbe-en-curso')) leer(); };
    window.addEventListener(EVENTO_EN_CURSO, leer);
    window.addEventListener('storage', otra);
    return () => { window.removeEventListener(EVENTO_EN_CURSO, leer); window.removeEventListener('storage', otra); };
  }, [atletaId]);
  return x;
}

export function ActividadSesion({ datos, alVolver }) {
  const { api } = useApp();
  // El reloj solo corre con un descanso en marcha (cada medio segundo); si no, la píldora no cambia sola
  const [ahora, setAhora] = useState(Date.now());
  const conDescanso = !!datos?.descanso && datos.descanso.fin > Date.now() - 6500;
  useEffect(() => {
    if (!conDescanso) return undefined;
    const i = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(i);
  }, [conDescanso, datos?.descanso?.fin]);
  const e = estadoActividad(datos, ahora);
  const [abierta, setAbierta] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  const previo = useRef(null);
  const raiz = useRef(null);
  const largo = useRef(null);
  const yaAbierta = useRef(false);
  // Lo que se anuncia: solo al cambiar de estado (empieza o acaba el descanso)
  useEffect(() => {
    const a = anuncioActividad(previo.current, e);
    if (a && previo.current) setAnuncio(a);
    // Si el descanso acaba con la píldora delante (no si ya había acabado al llegar), suena como en la sesión
    if (e?.descanso?.terminado && previo.current?.descanso && !previo.current.descanso.terminado && Date.now() - datos.descanso.fin < 4000) {
      pitar();
      if (leerAjustes().voz) setTimeout(() => hablar(datos.descanso.voz || '¡Vamos!'), leerAjustes().sonido ? 900 : 0);
      if (document.visibilityState === 'visible' && typeof Notification !== 'undefined' && Notification.permission === 'granted') api?.cancelarDescanso?.();
    }
    previo.current = e;
  });
  // Abierta: Escape o tocar fuera la cierran
  useEffect(() => {
    if (!abierta) return undefined;
    const tecla = (ev) => { if (ev.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) { setAbierta(false); raiz.current?.querySelector('.encurso-pildora')?.focus(); } };
    const fuera = (ev) => { if (!raiz.current?.contains(ev.target)) setAbierta(false); };
    document.addEventListener('keydown', tecla);
    document.addEventListener('pointerdown', fuera);
    return () => { document.removeEventListener('keydown', tecla); document.removeEventListener('pointerdown', fuera); };
  }, [abierta]);
  useEffect(() => () => clearTimeout(largo.current), []);
  if (!e) return null;
  const d = e.descanso;
  const r = 9, c = 2 * Math.PI * r;
  // Mantener pulsada (como en iOS) también la abre; un toque corto la abre o la cierra
  const alBajar = () => { yaAbierta.current = false; clearTimeout(largo.current); largo.current = setTimeout(() => { yaAbierta.current = true; setAbierta(true); }, 450); };
  const alSoltar = () => clearTimeout(largo.current);
  return (
    <div class={`encurso ${abierta ? 'abierta' : ''}`} ref={raiz}>
      <button type="button" class="encurso-pildora" aria-expanded={abierta ? 'true' : 'false'} aria-controls="encurso-tarjeta" aria-label={etiquetaActividad(e)}
        onPointerDown={alBajar} onPointerUp={alSoltar} onPointerCancel={alSoltar} onPointerLeave={alSoltar} onContextMenu={(ev) => ev.preventDefault()}
        onClick={() => { if (yaAbierta.current) { yaAbierta.current = false; return; } setAbierta(!abierta); }}>
        {d ? (
          <svg class="encurso-anillo" viewBox="0 0 24 24" aria-hidden="true">
            <circle class="carril" cx="12" cy="12" r={r} />
            <circle class="arco" cx="12" cy="12" r={r} stroke-dasharray={c} stroke-dashoffset={c * (1 - d.frac)} transform="rotate(-90 12 12)" />
          </svg>
        ) : <span class="encurso-punto" aria-hidden="true" />}
        <span class="encurso-texto" aria-hidden="true">
          <span class="encurso-nombre">{e.nombre}</span>
          {e.ejercicio && <span class="encurso-ej">{e.ejercicio}</span>}
        </span>
        {d && <span class={`encurso-cuenta num ${d.terminado ? 'fin' : ''}`} aria-hidden="true">{d.cuenta}</span>}
      </button>
      {abierta && (
        <div class="encurso-tarjeta" id="encurso-tarjeta" role="group" aria-label="Sesión en curso">
          <p class="t-sobre">Sesión en curso</p>
          <p class="encurso-tarjeta-nombre">{e.nombre}</p>
          <dl class="encurso-datos">
            {e.ejercicio && <div><dt>Ahora</dt><dd>{e.ejercicio}</dd></div>}
            {e.siguiente && <div><dt>Lo siguiente</dt><dd class="num">{e.siguiente}</dd></div>}
            {d && <div><dt>Descanso</dt><dd class="num">{d.terminado ? 'Terminado' : `Quedan ${d.cuenta}`}</dd></div>}
            <div><dt>Series</dt><dd class="num">{e.hechas}{e.total ? ` de ${e.total}` : ''}</dd></div>
          </dl>
          <div class="encurso-acciones">
            <button type="button" class="btn btn-primario" onClick={() => { setAbierta(false); alVolver(e.id); }}><Icono n="play" /> Volver a la sesión</button>
          </div>
        </div>
      )}
      <p class="sr" aria-live="polite">{anuncio}</p>
    </div>
  );
}

// Si la sesión ya está terminada (desde otro móvil, o la terminó el coach por él), la píldora se va
export function comprobarEnCurso(atletaId, programa) {
  const x = leerEnCurso(atletaId);
  if (!x || !programa) return;
  for (const lista of Object.values(programa.sesiones || {})) {
    const s = (lista || []).find((y) => y.id === x.id);
    if (s) { if (s.completada) borrarEnCurso(atletaId, x.id); return; }
  }
}
