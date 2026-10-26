import { useEffect, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, usePreferencia } from './comunes.jsx';
import { num } from '../logica/calculos.js';
import { logrosNuevos, nivelesVistos, NIVELES_LOGRO } from '../logica/logros.js';
import { celebrar } from './atleta/sesion-comun.jsx';

// Medalla con forma de disco de competición: color del nivel, cifra del hito en la cara y buje metálico.
// Sin nivel, un disco fantasma. El aro exterior marca lo que falta para el siguiente nivel.
const NOMBRE_COLOR = Object.fromEntries(NIVELES_LOGRO.map((n) => [n.color, n.nombre]));
const abreviar = (n) => (n >= 1000 ? `${num(n / 1000, n % 1000 ? 1 : 0)}k` : String(n));

export function Medalla({ color = null, cifra = null, progreso = null, tam = 76, clase = '' }) {
  const R = 46, C = 2 * Math.PI * R;
  return (
    <svg class={`medalla ${color ? `disco-${color}` : 'fantasma'} ${clase}`} viewBox="0 0 100 100" width={tam} height={tam} aria-hidden="true">
      {progreso != null && (
        <>
          <circle class="medalla-aro" cx="50" cy="50" r={R} />
          <circle class="medalla-avance" cx="50" cy="50" r={R} stroke-dasharray={`${C * progreso} ${C}`} transform="rotate(-90 50 50)" />
        </>
      )}
      <circle class="medalla-cara" cx="50" cy="50" r="38" />
      <circle class="medalla-borde" cx="50" cy="50" r="33.5" />
      <path class="medalla-brillo" d="M22 36a31 31 0 0 1 22-20" />
      {cifra != null && <text class="medalla-cifra" x="50" y="33" text-anchor="middle">{abreviar(cifra)}</text>}
      <circle class="medalla-buje" cx="50" cy="50" r="10.5" />
      <circle class="medalla-agujero" cx="50" cy="50" r="4.2" />
    </svg>
  );
}

// Cuadrícula de logros (en Progreso)
export function Logros({ salud }) {
  const { api, atleta } = useApp();
  const res = useCarga(() => api.logros(atleta.id, { salud }).catch(() => null), [atleta.id, salud]);
  const [abierto, setAbierto] = useState(null);
  const lista = res.datos?.lista;
  if (!lista) return null;
  const discos = lista.reduce((t, l) => t + l.nivel, 0), total = lista.length * 4;
  return (
    <section class="seccion" aria-labelledby="logros-titulo">
      <div class="seccion-cab"><h3 id="logros-titulo">Logros</h3><span class="peq secundario num">{discos} de {total} discos</span></div>
      <div class="panel panel-pad">
        <ul class="logros">
          {lista.map((l) => (
            <li key={l.id}>
              <button class="logro" onClick={() => setAbierto(l)}
                aria-label={`${l.titulo}: ${l.nivel ? `${NOMBRE_COLOR[l.color]}, ${l.conseguido}` : 'aún sin disco'}${l.siguiente ? `. Siguiente: ${l.siguiente.texto}` : '. Todos los discos'}`}>
                <Medalla color={l.color} cifra={l.nivel ? l.niveles[l.nivel - 1].umbral : l.niveles[0].umbral} progreso={l.siguiente ? l.progreso : null} />
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
      <p class="secundario">{l.nivel ? `Tienes el ${NOMBRE_COLOR[l.color].toLowerCase()}: ${l.conseguido}.` : 'Aún no tienes ningún disco de este logro.'}
        {l.siguiente ? ` Para el siguiente te ${l.siguiente.falta === 1 ? 'falta' : 'faltan'} ${num(l.siguiente.falta, 0)}.` : ' Ya los tienes todos.'}</p>
      <ol class="logro-niveles">
        {l.niveles.map((n) => (
          <li key={n.n} class={n.conseguido ? 'conseguido' : ''}>
            <Medalla color={n.conseguido ? n.color : null} cifra={n.umbral} tam={64} />
            <span class="pila-xs"><strong>{NIVELES_LOGRO[n.n - 1].nombre}</strong><span class="peq secundario">{n.texto}</span></span>
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
  const res = useCarga(() => api.logros(atleta.id, { salud }).catch(() => null), [atleta.id, salud]);
  const [vistos, setVistos] = usePreferencia(`fbe-logros-${atleta.id}`, null);
  const [cerrado, setCerrado] = useState(false);
  const lista = res.datos?.lista;
  const nuevos = lista ? logrosNuevos(lista, vistos || {}) : [];
  const ver = !pausado && !cerrado && nuevos.length > 0;
  useEffect(() => { if (ver) celebrar(); }, [ver]);
  if (!ver) return null;
  const terminar = (ir) => { setVistos(nivelesVistos(lista)); setCerrado(true); if (ir) irA('progreso'); };
  const principal = [...nuevos].sort((a, b) => b.nivel - a.nivel)[0];
  return (
    <Hoja titulo={nuevos.length === 1 ? 'Nuevo disco' : `${nuevos.length} discos nuevos`} alCerrar={() => terminar(false)}>
      <div class="logro-nuevo">
        <Medalla color={principal.color} cifra={lista.find((l) => l.id === principal.id).niveles[principal.nivel - 1].umbral} tam={148} clase="entra" />
        <p class="logro-nuevo-titulo"><strong>{principal.titulo}</strong>: {NOMBRE_COLOR[principal.color].toLowerCase()}</p>
        <p class="secundario">{principal.texto}</p>
        {nuevos.length > 1 && (
          <ul class="logro-nuevos-resto">
            {nuevos.filter((x) => x !== principal).map((x) => (
              <li key={x.id}><Medalla color={x.color} tam={30} /><span><strong>{x.titulo}</strong>: {x.texto}</span></li>
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
