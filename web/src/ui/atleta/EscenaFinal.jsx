// (diseño, tanda 43) La escena del final de la sesión: al guardar y terminar, se hace de noche, sale la luna y el lobo
// de la marca se dibuja trazo a trazo delante de ella y aúlla (tres ondas). Con récord, la luna es dorada y caen chispas
// de oro; con la semana completa, llega la manada: un lobo por sesión hecha. Dura unos tres segundos y se salta tocando
// (o con Escape, Intro o espacio). Después se levanta como un telón y detrás está el resumen de siempre.
// Es solo un adorno (aria-hidden): quien usa lector de pantalla o «reducir movimiento» va derecho al resumen.
// Los estilos, en diseno.css (bloque 335). Nada de texto entra por opacidad: sube desde detrás de su línea.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Capa } from '../comunes.jsx';
import { LOBO_CAJA, LOBO_D } from '../lobo-trazo.js';
import { sinMovimiento } from '../transiciones.js';
import { tenirBarra } from '../barra-color.js';
import { vibrar } from '../hapticos.js';

// ¿Se puede enseñar la escena? (no con «reducir movimiento», ni con la pestaña en segundo plano)
export const hayEscenaFinal = () => typeof document !== 'undefined' && !sinMovimiento() && document.visibilityState !== 'hidden';

const NOCHE = '#1E1548';
// Las estrellas (x, y, radio), siempre las mismas: alrededor de la luna, lejos del texto
const ESTRELLAS = [[34, 58, 1.6], [78, 22, 1.1], [352, 44, 1.7], [318, 96, 1], [22, 168, 1.2], [368, 182, 1.3], [58, 262, 1], [338, 284, 1.5], [120, 12, 1], [262, 18, 1.3], [8, 322, 1.1], [382, 346, 1], [44, 372, 1.4], [300, 368, 1.1]];
// Las chispas de oro del récord: dónde caen (x), cuánto tardan en salir (s), su tamaño y cuánto se van de lado
const CHISPAS = [[40, 0, 1, -14], [92, .35, .7, 10], [150, .12, .85, -8], [205, .5, .6, 12], [252, .2, 1, -10], [304, .42, .75, 16], [350, .05, .9, -12], [120, .7, .6, 8], [276, .8, .7, -6], [64, .9, .8, 12], [330, 1, .6, -10], [182, .95, .9, 6]];
const CHISPA_D = 'M0-7C.9-2.6 2.6-.9 7 0 2.6.9.9 2.6 0 7-.9 2.6-2.6.9-7 0-2.6-.9-.9-2.6 0-7z';
const ANCHO_LOBO = 954 / 1092;

function Lobo({ x, y, alto, clase }) {
  return (
    <svg class={clase} x={x - (alto * ANCHO_LOBO) / 2} y={y} width={alto * ANCHO_LOBO} height={alto} viewBox={LOBO_CAJA} overflow="visible">
      <path class="escena-lobo-trazo" d={LOBO_D} pathLength="1" fill="none" />
      <path class="escena-lobo-lleno" d={LOBO_D} fill-rule="evenodd" />
    </svg>
  );
}

// records: cuántos récords ha hecho hoy; semana: { hechas } si con esta sesión completa la semana (o null)
export function EscenaFinal({ nombre = '', records = 0, semana = null, alSalir, alAcabar }) {
  const [fuera, setFuera] = useState(false);
  const hecho = useRef(false);
  const fin = useRef({ alSalir, alAcabar });
  fin.current = { alSalir, alAcabar };
  const manada = semana ? Math.max(2, Math.min(7, semana.hechas || 0)) : 0;
  const salir = () => {
    if (hecho.current) return;
    hecho.current = true;
    setFuera(true);
    fin.current.alSalir?.();
    setTimeout(() => fin.current.alAcabar?.(), 520);
  };
  useEffect(() => {
    const volver = tenirBarra(NOCHE);
    const aullido = setTimeout(() => vibrar(records ? 'record' : 'anillo'), 1500);
    const t = setTimeout(salir, records || semana ? 3500 : 2800);
    const tecla = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); salir(); } };
    document.addEventListener('keydown', tecla, true);
    return () => { clearTimeout(t); clearTimeout(aullido); document.removeEventListener('keydown', tecla, true); volver(); };
  }, []);
  // La manada, en fila bajo la luna, centrada
  const paso = 50, x0 = 195 - ((manada - 1) * paso) / 2;
  return (
    <Capa>
      <div class={`escena-final${records ? ' con-record' : ''}${semana ? ' con-semana' : ''}${fuera ? ' fuera' : ''}`} aria-hidden="true" onClick={salir}>
        <svg class="escena-cielo" viewBox="0 0 390 420" aria-hidden="true" focusable="false">
          <defs>
            <radialGradient id="escena-luna" cx="38%" cy="32%" r="78%">
              <stop offset="0" stop-color={records ? '#FEEDC9' : '#FFFFFF'} />
              <stop offset=".6" stop-color={records ? '#EBC166' : '#EEECFF'} />
              <stop offset="1" stop-color={records ? '#D3A329' : '#C4BFFF'} />
            </radialGradient>
            <radialGradient id="escena-halo">
              <stop offset=".55" stop-color={records ? '#EBC166' : '#A49CFF'} stop-opacity=".42" />
              <stop offset="1" stop-color={records ? '#EBC166' : '#A49CFF'} stop-opacity="0" />
            </radialGradient>
          </defs>
          <g class="escena-estrellas">
            {ESTRELLAS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} style={{ '--i': i }} />)}
          </g>
          <g class="escena-sube">
            <circle class="escena-halo" cx="195" cy="186" r="188" fill="url(#escena-halo)" />
            {[0, 1, 2].map((i) => <circle key={i} class="escena-onda" cx="195" cy="186" r="128" style={{ '--i': i }} />)}
            <g class="escena-luna">
              <circle cx="195" cy="186" r="128" fill="url(#escena-luna)" />
              <Lobo x={195} y={93} alto={186} clase="escena-lobo" />
            </g>
          </g>
          {manada > 0 && (
            <g class="escena-manada">
              {Array.from({ length: manada }, (_, i) => <g key={i} style={{ '--i': i }}><Lobo x={x0 + i * paso} y={350} alto={46} clase="escena-cachorro" /></g>)}
            </g>
          )}
          {records > 0 && (
            <g class="escena-chispas">
              {CHISPAS.map(([x, espera, t, lado], i) => <g key={i} transform={`translate(${x} 0)`}><path d={CHISPA_D} style={{ '--espera': `${espera}s`, '--t': t, '--lado': `${lado}px` }} /></g>)}
            </g>
          )}
        </svg>
        <div class="escena-texto">
          <p class="escena-linea escena-titulo"><span>Sesión terminada</span></p>
          {nombre && <p class="escena-linea escena-sub"><span>{nombre}</span></p>}
          {(records > 0 || semana) && (
            <p class="escena-linea escena-chips">
              <span>
                {records > 0 && <b class="escena-chip oro">{records === 1 ? '1 récord' : `${records} récords`}</b>}
                {semana && <b class="escena-chip">Semana completa</b>}
              </span>
            </p>
          )}
        </div>
        <p class="escena-linea escena-saltar"><span>Toca para seguir</span></p>
      </div>
    </Capa>
  );
}
