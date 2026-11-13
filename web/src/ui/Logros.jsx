import { useEffect, useRef, useState } from 'preact/hooks';
import { pedirSubProgreso } from './atleta/sub-progreso.js';
import { useApp, useCarga, Icono, Hoja, usePreferencia } from './comunes.jsx';
import { num } from '../logica/calculos.js';
import { logrosNuevos, nivelesVistos } from '../logica/logros.js';
import { metalDe } from '../logica/tablero.js';
import { imagenMedalla, archivoPara } from '../logica/imagenes.js';
import { hayImagen } from './Imagen.jsx';
import { celebrar } from './atleta/sesion-comun.jsx';
import { useBienvenidaAbierta } from './Bienvenida.jsx';

// v0.51: medallas de metal. Los cuatro niveles de siempre (los mismos umbrales) son bronce, plata, oro y diamante: la
// cara con un degradado radial (la luz arriba a la izquierda), el canto con su degradado y su dibujo (liso, perlado,
// estriado o doble, para distinguirlos sin el color), la cifra del hito grabada y, al conseguirla, un brillo que la
// cruza (quieto con «reducir movimiento»). Sin nivel, una medalla fantasma. El aro exterior marca lo que falta.
const abreviar = (n) => (n >= 1000 ? `${num(n / 1000, n % 1000 ? 1 : 0)}k` : String(n));
const METAL = {
  bronce: { luz: '#F6CFA6', medio: '#C9864F', sombra: '#8A4F25', cantoLuz: '#F0B98A', cantoSombra: '#6E3B17', tinta: '#3A1F0B', relieve: 'rgba(255, 236, 214, .65)' },
  plata: { luz: '#FBFCFE', medio: '#C7CCD6', sombra: '#8C93A1', cantoLuz: '#FFFFFF', cantoSombra: '#6B7280', tinta: '#2B303B', relieve: 'rgba(255, 255, 255, .8)' },
  oro: { luz: '#FFF4C4', medio: '#E9B949', sombra: '#A8781A', cantoLuz: '#FFF1B8', cantoSombra: '#8A6212', tinta: '#3F2A04', relieve: 'rgba(255, 248, 214, .75)' },
  platino: { luz: '#F7FCFF', medio: '#C6D8E4', sombra: '#8AA5B8', cantoLuz: '#F4FBFF', cantoSombra: '#4E6577', tinta: '#1E2C38', relieve: 'rgba(255, 255, 255, .8)' },
};
let contador = 0;
// (imágenes) con `logro`, la medalla conseguida es la ilustración de ese logro en su metal (bronce, plata, oro, diamante),
// recortada a su disco; encima siguen el aro de lo que falta y el brillo que la cruza. Si no hay imagen o no carga, la
// medalla dibujada de siempre. Sin nivel, la fantasma con su cifra, como siempre.
export function MedallaMetal({ nivel = 0, cifra = null, progreso = null, tam = 76, clase = '', logro = null }) {
  const id = useRef(null);
  if (!id.current) id.current = `mm${++contador}`;
  const k = id.current;
  const m = metalDe(nivel);
  const c = m ? METAL[m.id] : null;
  const idImg = m ? imagenMedalla(logro, nivel) : null;
  const [falla, setFalla] = useState(null);
  const img = idImg && falla !== idImg && hayImagen(idImg) ? archivoPara(idImg, tam) : null;
  const R = 46, C = 2 * Math.PI * R;
  const texto = cifra != null ? abreviar(cifra) : null;
  const tamCifra = texto && texto.length > 3 ? 20 : 25;
  // (diseño, tanda 18) al pasar el dedo (o el ratón) por una medalla conseguida, se inclina un poco hacia él y el reflejo
  // lo sigue: dónde está el dedo va en --mm-x y --mm-y (de -1 a 1) y la clase «tocada»; el resto, en diseno.css
  const seguir = m ? (e) => {
    const el = e.currentTarget, r = el.getBoundingClientRect();
    if (!r.width) return;
    el.style.setProperty('--mm-x', (Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1))).toFixed(2));
    el.style.setProperty('--mm-y', (Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1))).toFixed(2));
    el.classList.add('tocada');
  } : undefined;
  const soltar = m ? (e) => e.currentTarget.classList.remove('tocada') : undefined;
  return (
    <svg class={`medalla-metal ${m ? `metal-${m.id}` : 'fantasma'} ${clase}`} viewBox="0 0 100 100" width={tam} height={tam} aria-hidden="true"
      onPointerDown={seguir} onPointerMove={seguir} onPointerUp={soltar} onPointerLeave={soltar} onPointerCancel={soltar}>
      {progreso != null && (
        <>
          <circle class="mm-aro" cx="50" cy="50" r={R} />
          <circle class="mm-avance" cx="50" cy="50" r={R} stroke-dasharray={`${C * progreso} ${C}`} transform="rotate(-90 50 50)" />
        </>
      )}
      {m && img ? (
        <>
          <defs>
            <linearGradient id={`${k}b`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#fff" stop-opacity="0" /><stop offset=".5" stop-color="#fff" stop-opacity=".6" /><stop offset="1" stop-color="#fff" stop-opacity="0" />
            </linearGradient>
            <clipPath id={`${k}r`}><circle cx="50" cy="50" r="40" /></clipPath>
          </defs>
          {/* el disco ocupa el 94 % de la imagen: así su borde cae en r = 39,5, como el de la dibujada */}
          <image class="mm-img" href={img} x="8.1" y="8.1" width="83.8" height="83.8" clip-path={`url(#${k}r)`} preserveAspectRatio="xMidYMid slice" onError={() => setFalla(idImg)} />
          <g clip-path={`url(#${k}r)`}>
            <g transform="rotate(22 50 50)"><rect class="mm-barrido" x="10" y="-20" width="26" height="140" fill={`url(#${k}b)`} /></g>
          </g>
        </>
      ) : !m ? (
        <>
          <circle class="mm-cara" cx="50" cy="50" r="37" />
          {texto && <text class="mm-cifra" x="50" y="50" dy="0.35em" text-anchor="middle" font-size={tamCifra}>{texto}</text>}
        </>
      ) : (
        <>
          <defs>
            <linearGradient id={`${k}c`} x1="0" y1="0" x2="0.35" y2="1">
              <stop offset="0" stop-color={c.cantoLuz} /><stop offset=".5" stop-color={c.medio} /><stop offset="1" stop-color={c.cantoSombra} />
            </linearGradient>
            <radialGradient id={`${k}f`} cx=".36" cy=".3" r=".85">
              <stop offset="0" stop-color={c.luz} /><stop offset=".55" stop-color={c.medio} /><stop offset="1" stop-color={c.sombra} />
            </radialGradient>
            <linearGradient id={`${k}b`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#fff" stop-opacity="0" /><stop offset=".5" stop-color="#fff" stop-opacity=".75" /><stop offset="1" stop-color="#fff" stop-opacity="0" />
            </linearGradient>
            <clipPath id={`${k}r`}><circle cx="50" cy="50" r="39.5" /></clipPath>
          </defs>
          <circle cx="50" cy="50" r="39.5" fill={`url(#${k}c)`} stroke={c.cantoSombra} stroke-width="1.2" />
          {m.canto === 'perlado' && <circle cx="50" cy="50" r="36.4" fill="none" stroke={c.relieve} stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0 4.75" />}
          {m.canto === 'estriado' && <circle cx="50" cy="50" r="36.6" fill="none" stroke={c.cantoSombra} stroke-opacity=".55" stroke-width="4.6" stroke-dasharray="1.1 1.9" />}
          {m.canto === 'doble' && (
            <>
              <circle cx="50" cy="50" r="37.6" fill="none" stroke={c.cantoSombra} stroke-opacity=".6" stroke-width="1" />
              <circle cx="50" cy="50" r="35.4" fill="none" stroke={c.cantoSombra} stroke-opacity=".6" stroke-width="1" />
              <circle cx="50" cy="50" r="36.5" fill="none" stroke={c.relieve} stroke-width="1.2" stroke-dasharray="0.9 2.1" />
            </>
          )}
          <circle cx="50" cy="50" r="33.4" fill={`url(#${k}f)`} stroke={c.cantoSombra} stroke-opacity=".45" stroke-width="1" />
          <circle cx="50" cy="50" r="28" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width=".8" />
          <circle cx="50" cy="50" r="22.5" fill="none" stroke="#fff" stroke-opacity=".1" stroke-width=".8" />
          <path d="M24 38a28 28 0 0 1 20-17" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.6" stroke-linecap="round" />
          {m.canto === 'doble' && <path d="M50 18.6l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill={c.cantoSombra} fill-opacity=".7" />}
          {texto && (
            <g class="mm-cifra" text-anchor="middle" font-size={tamCifra}>
              <text x="50" y="51.2" dy="0.35em" fill={c.relieve}>{texto}</text>
              <text x="50" y="50" dy="0.35em" fill={c.tinta}>{texto}</text>
            </g>
          )}
          <g clip-path={`url(#${k}r)`}>
            <g transform="rotate(22 50 50)"><rect class="mm-barrido" x="10" y="-20" width="26" height="140" fill={`url(#${k}b)`} /></g>
          </g>
        </>
      )}
    </svg>
  );
}
// Lo que dice cada medalla: «Bronce», «Plata»… (sin nivel, «Sin medalla»)
const nombreMetal = (nivel) => metalDe(nivel)?.nombre || 'Sin medalla';
const medallaDe = (nivel) => (metalDe(nivel) ? `medalla de ${metalDe(nivel).nombre.toLowerCase()}` : 'sin medalla');

// Cuadrícula de logros (en Progreso)
export function Logros({ salud }) {
  const { api, atleta } = useApp();
  const res = useCarga(() => api.logros(atleta.id, { salud }).catch(() => null), [atleta.id, salud], { recuerdo: `logros:${atleta.id}:${salud ? 1 : 0}` });
  const [abierto, setAbierto] = useState(null);
  const lista = res.datos?.lista;
  if (!lista) return null;
  const medallas = lista.reduce((t, l) => t + l.nivel, 0), total = lista.length * 4;
  return (
    <section class="seccion" aria-labelledby="logros-titulo">
      <div class="seccion-cab"><h2 id="logros-titulo">Logros</h2><span class="peq secundario num">{medallas} de {total} medallas</span></div>
      <div class="panel panel-pad">
        <ul class="logros">
          {lista.map((l) => (
            <li key={l.id}>
              <button class="logro" onClick={() => setAbierto(l)}
                aria-label={`${l.titulo}: ${l.nivel ? `${medallaDe(l.nivel)}, ${l.conseguido}` : 'aún sin medalla'}${l.siguiente ? `. Siguiente: ${l.siguiente.texto}` : '. Todas las medallas'}`}>
                <MedallaMetal nivel={l.nivel} logro={l.id} cifra={l.nivel ? l.niveles[l.nivel - 1].umbral : l.niveles[0].umbral} progreso={l.siguiente ? l.progreso : null} />
                <span class="logro-metal" aria-hidden="true">{nombreMetal(l.nivel)}</span>
                <span class="logro-titulo">{l.titulo}</span>
                <span class="mini terciario num">{l.siguiente ? `${abreviar(l.valor)} de ${abreviar(l.siguiente.umbral)}` : 'Completo'}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {abierto && <HojaLogro logro={abierto} alCerrar={() => setAbierto(null)} />}
    </section>
  );
}

function HojaLogro({ logro: l, alCerrar }) {
  return (
    <Hoja titulo={l.titulo} alCerrar={alCerrar}>
      <p class="secundario">{l.nivel ? `Tienes la ${medallaDe(l.nivel)}: ${l.conseguido}.` : 'Aún no tienes ninguna medalla de este logro.'}
        {l.siguiente ? ` Para la siguiente te ${l.siguiente.falta === 1 ? 'falta' : 'faltan'} ${num(l.siguiente.falta, 0)}.` : ' Ya las tienes todas.'}</p>
      <ol class="logro-niveles">
        {l.niveles.map((n) => (
          <li key={n.n} class={n.conseguido ? 'conseguido' : ''}>
            <MedallaMetal nivel={n.conseguido ? n.n : 0} logro={l.id} cifra={n.umbral} tam={64} />
            <span class="pila-xs"><strong>{nombreMetal(n.n)}</strong><span class="peq secundario">{n.texto}</span></span>
            <span class="sr">{n.conseguido ? 'Conseguido' : 'Pendiente'}</span>
            {n.conseguido && <Icono n="hecho" />}
          </li>
        ))}
      </ol>
    </Hoja>
  );
}

// Celebración en Hoy cuando hay discos nuevos desde la última vez que se vieron (en este móvil).
export function AvisoLogros({ salud, irA, pausado = false }) {
  const { api, atleta } = useApp();
  const res = useCarga(() => api.logros(atleta.id, { salud }).catch(() => null), [atleta.id, salud], { recuerdo: `logros:${atleta.id}:${salud ? 1 : 0}` });
  const [vistos, setVistos] = usePreferencia(`fbe-logros-${atleta.id}`, null);
  const [cerrado, setCerrado] = useState(false);
  const lista = res.datos?.lista;
  const nuevos = lista ? logrosNuevos(lista, vistos || {}) : [];
  // (v0.72) y no encima de la bienvenida del día: espera a que se cierre
  const bienvenida = useBienvenidaAbierta();
  const ver = !pausado && !bienvenida && !cerrado && nuevos.length > 0;
  // (sonido, tanda 2) cada nivel de logro (verde, amarillo, azul y rojo) con su sonido
  useEffect(() => { if (ver) celebrar('logro', { nivel: Math.max(...nuevos.map((l) => l.nivel)) - 1 }); }, [ver]);
  if (!ver) return null;
  const terminar = (ir) => { setVistos(nivelesVistos(lista)); setCerrado(true); if (ir) { pedirSubProgreso('logros'); irA('progreso'); } };
  const principal = [...nuevos].sort((a, b) => b.nivel - a.nivel)[0];
  const nivelP = principal.nivel;
  const umbralP = lista.find((l) => l.id === principal.id).niveles[nivelP - 1].umbral;
  return (
    <Hoja titulo={nuevos.length === 1 ? 'Nueva medalla' : `${nuevos.length} medallas nuevas`} alCerrar={() => terminar(false)}>
      <div class="medalla-revela" data-metal={metalDe(nivelP)?.id}>
        <MedallaMetal nivel={nivelP} logro={principal.id} cifra={umbralP} tam={176} clase="entra brilla" />
        <span class="t-sobre">Medalla de {nombreMetal(nivelP).toLowerCase()}</span>
        <h3>{principal.titulo}</h3>
        <p class="secundario">{principal.texto}</p>
        {nuevos.length > 1 && (
          <ul class="logro-nuevos-resto">
            {nuevos.filter((x) => x !== principal).map((x) => (
              <li key={x.id}><MedallaMetal nivel={x.nivel} logro={x.id} tam={30} /><span><strong>{x.titulo}</strong>: {medallaDe(x.nivel)}, {x.texto}</span></li>
            ))}
          </ul>
        )}
      </div>
      <div class="fila" style="gap:8px;justify-content:flex-end">
        <button class="btn" onClick={() => terminar(false)}>Seguir</button>
        <button class="btn btn-primario" onClick={() => terminar(true)}>Ver mis logros</button>
      </div>
    </Hoja>
  );
}
