// «Tu año en FBE» (v0.104): el año entero en una historia, como «Tu mes». En diciembre, el año en curso; en enero, el
// que acaba de terminar. En Hoy, una tarjeta hasta que la abre o la quita (una vez por año, en este móvil); en Progreso,
// siempre que toque. Solo entrenamiento: nada de peso, medidas, nutrición, hábitos ni datos de salud.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Capa, PortadaHistoria, usePreferencia } from '../comunes.jsx';
import { HojaCompartir } from '../Compartir.jsx';
import { anioParaResumen, resumenAnio, datosCompartirAnio } from '../../logica/anio.js';
import { nombreSaludo } from '../../logica/personal.js';
import { num } from '../../logica/calculos.js';
import { hoyISO } from '../../logica/fechas.js';
import { Imagen, hayImagen } from '../Imagen.jsx';
import { imagenCelebracion } from '../../logica/imagenes.js';
import { usePersonal } from './Personal.jsx';
import { useFicha } from './Musica.jsx';
import { aperturasDe } from '../../logica/musica.js';
import { pesoTxt, pesoNum } from '../../logica/unidades.js';

const toneladas = (kg) => num(Math.round(kg / 100) / 10, 1);
const horas = (min) => (min >= 60 ? `${Math.round(min / 60)} horas` : `${min} minutos`);

function useResumenAnio(anio) {
  const { api, atleta } = useApp();
  return useCarga(() => (anio ? api.datosMes(atleta.id, { salud: false, nutricion: false, desde: `${anio}-01-01` }).then((d) => resumenAnio(d, anio, hoyISO())).catch(() => null) : Promise.resolve(null)),
    [atleta.id, anio], { recuerdo: anio ? `tu-anio:${atleta.id}:${anio}` : null });
}

// En Hoy (diciembre y enero), hasta que la abre o la quita
export function TarjetaAnio() {
  const anio = anioParaResumen(hoyISO());
  const [visto, setVisto] = usePreferencia('fbe-tu-anio-visto', null);
  const [abierta, setAbierta] = useState(false);
  const r = useResumenAnio(anio && visto !== anio ? anio : null);
  if (!anio || (visto === anio && !abierta) || !r.datos || r.datos.vacio || r.datos.sesiones < 4) return null;
  return (
    <>
      <section class="tarjeta-semana tarjeta-mes tarjeta-anio" aria-label={`Tu ${anio} en FBE`}>
        <button class="tarjeta-semana-abrir" onClick={() => { setAbierta(true); setVisto(anio); }}>
          <PortadaHistoria tono="mes" />
          <span class="pila-xs">
            <span class="mini">Tu {anio} en FBE</span>
            <strong>{r.datos.sesiones} sesiones, {toneladas(r.datos.tonelaje)} toneladas{r.datos.records ? `, ${r.datos.records} récords` : ''}</strong>
            <span class="mini">Toca para verlo</span>
          </span>
          <Icono n="play" />
        </button>
        <button class="btn btn-icono plano tarjeta-semana-quitar" onClick={() => setVisto(anio)} aria-label={`Ocultar tu ${anio}`}><Icono n="cerrar" /></button>
      </section>
      {abierta && <HistoriaAnio resumen={r.datos} alCerrar={() => setAbierta(false)} />}
    </>
  );
}

// En Progreso: «Tu año», mientras toque
export function FilaTuAnio() {
  const anio = anioParaResumen(hoyISO());
  const r = useResumenAnio(anio);
  const [abierta, setAbierta] = useState(false);
  if (!anio || !r.datos || r.datos.vacio) return null;
  return (
    <section class="seccion">
      <h2>Tu año</h2>
      <div class="panel">
        <button class="fila-semana fila-anio" onClick={() => setAbierta(true)}>
          <span class="pila-xs">
            <strong>Tu {anio} en FBE</strong>
            <span class="peq secundario">{r.datos.sesiones} sesiones, {r.datos.dias} días entrenando{r.datos.records ? `, ${r.datos.records} récords` : ''}</span>
          </span>
          <PortadaHistoria tono="mes peq" />
        </button>
      </div>
      {abierta && <HistoriaAnio resumen={r.datos} alCerrar={() => setAbierta(false)} />}
    </section>
  );
}

export function HistoriaAnio(props) { return <Capa><HistoriaAnioPantalla {...props} /></Capa>; }
function HistoriaAnioPantalla({ resumen: r, alCerrar }) {
  const { atleta } = useApp();
  const personal = usePersonal();
  const nombre = nombreSaludo(personal.datos, atleta?.nombre);
  const maxMes = Math.max(1, ...r.porMes);
  // (v0.104) su música: cuántas veces la abrió desde una sesión este año y su canción de récord
  const veces = aperturasDe(personal.datos?.musica_aperturas, String(r.anio));
  const cancion = useFicha(personal.datos?.cancion_url || null);
  const pantallas = [
    { id: 'portada', render: () => (
      <>
        <span class="historia-etq">Tu {r.anio} en FBE</span>
        <h2>{nombre ? `${nombre}, ` : ''}este ha sido tu año<small>{r.primerDia ? 'Lo que has construido, sesión a sesión' : ''}</small></h2>
        <p class="historia-cifra num">{r.sesiones}<small>{r.sesiones === 1 ? 'sesión' : 'sesiones'}</small></p>
        <p class="historia-texto">{r.dias} {r.dias === 1 ? 'día' : 'días'} entrenando{r.minutos ? `, unas ${horas(r.minutos)}` : ''}.</p>
      </>
    ) },
    { id: 'volumen', render: () => (
      <>
        <span class="historia-etq">Has movido</span>
        <p class="historia-cifra num">{toneladas(r.tonelaje)}<small>toneladas</small></p>
        <p class="historia-texto">en {r.series} series</p>
      </>
    ) },
    { id: 'meses', render: () => (
      <>
        <span class="historia-etq">Mes a mes</span>
        {r.mesTop && <h2>Tu mejor mes, {r.mesTop.mes}<small>{r.mesTop.sesiones} {r.mesTop.sesiones === 1 ? 'sesión' : 'sesiones'}</small></h2>}
        <div class="anio-barras" role="img" aria-label={`Sesiones por mes: ${r.porMes.join(', ')}`}>
          {r.porMes.map((n, i) => <span key={i} class={n ? 'si' : ''} style={{ '--h': `${Math.round((n / maxMes) * 100)}%` }}><i /><b aria-hidden="true">{'EFMAMJJASOND'[i]}</b></span>)}
        </div>
      </>
    ) },
    { id: 'records', render: () => (
      <>
        <span class="historia-etq">Récords</span>
        <p class="historia-cifra num">{r.records}<small>{r.records === 1 ? 'récord' : 'récords'}</small></p>
        <p class="historia-texto">{r.ejerciciosConRecord ? `en ${r.ejerciciosConRecord} ${r.ejerciciosConRecord === 1 ? 'ejercicio' : 'ejercicios'}` : 'Los récords llegan de sumar semanas: el año que viene, más.'}</p>
      </>
    ) },
    ...(r.progreso ? [{ id: 'progreso', render: () => (
      <>
        <span class="historia-etq">Lo que más ha subido</span>
        <h2>{r.progreso.ejercicio}</h2>
        <p class="historia-cifra num">+{num(r.progreso.pct, 1)}<small>% de 1RM estimado</small></p>
        <p class="historia-texto num">De {pesoNum(r.progreso.antes, 1)} a {pesoTxt(r.progreso.ahora, 1)}.</p>
      </>
    ) }] : []),
    { id: 'racha', render: () => (
      <>
        <span class="historia-etq">Tu mejor racha</span>
        <p class="historia-cifra num">{r.mejorRacha}<small>{r.mejorRacha === 1 ? 'semana completa' : 'semanas completas seguidas'}</small></p>
        <p class="historia-texto">{r.semanasCompletas} {r.semanasCompletas === 1 ? 'semana' : 'semanas'} con todo lo previsto hecho.</p>
      </>
    ) },
    ...(veces > 0 || cancion.datos?.titulo ? [{ id: 'musica', render: () => (
      <>
        <span class="historia-etq">Tu música</span>
        {veces > 0 ? <p class="historia-cifra num">{veces}<small>{veces === 1 ? 'sesión con tu música' : 'sesiones con tu música'}</small></p> : <h2>Con banda sonora</h2>}
        {cancion.datos?.titulo && <p class="historia-texto">Y la canción de tus récords: <strong>{cancion.datos.titulo}</strong>.</p>}
      </>
    ) }] : []),
    ...(r.cardio?.sesiones ? [{ id: 'cardio', render: () => (
      <>
        <span class="historia-etq">Cardio</span>
        <p class="historia-cifra num">{r.cardio.minutos}<small>minutos</small></p>
        <p class="historia-texto">{r.cardio.km ? `${num(r.cardio.km, 1)} km en ` : 'En '}{r.cardio.sesiones} {r.cardio.sesiones === 1 ? 'sesión' : 'sesiones'}</p>
      </>
    ) }] : []),
  ];
  const [i, setI] = useState(0);
  const [compartir, setCompartir] = useState(false);
  const quieto = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const ultima = i === pantallas.length - 1;
  const ir = (d) => setI((x) => Math.max(0, Math.min(pantallas.length - 1, x + d)));
  const caja = useRef(null);
  useEffect(() => {
    if (quieto || ultima || compartir) return undefined;
    const t = setTimeout(() => ir(1), 7000);
    return () => clearTimeout(t);
  }, [i, compartir]);
  useEffect(() => {
    caja.current?.focus();
    const tecla = (e) => {
      if (document.querySelectorAll('[aria-modal="true"]').length > 1) return;
      if (e.key === 'Escape') alCerrar(); if (e.key === 'ArrowRight') ir(1); if (e.key === 'ArrowLeft') ir(-1);
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);
  const fondo = imagenCelebracion('bloque');
  return (
    <div class={`historia historia-mes historia-anio ${hayImagen(fondo) ? 'con-fondo' : ''}`} role="dialog" aria-modal="true" aria-label={`Tu ${r.anio} en FBE`} ref={caja} tabIndex={-1}>
      <Imagen id={fondo} clase="historia-fondo" tamanos="150vh" prioridad />
      <div class="historia-barras" aria-hidden="true">
        {pantallas.map((p, k) => <span key={p.id} class={k < i ? 'vista' : k === i ? `actual ${quieto ? '' : 'corre'}` : ''}><i /></span>)}
      </div>
      <p class="sr" aria-live="polite">Pantalla {i + 1} de {pantallas.length}</p>
      <button class="btn btn-icono plano historia-cerrar" onClick={alCerrar} aria-label="Cerrar tu año"><Icono n="cerrar" /></button>
      <div class="historia-pantalla" key={pantallas[i].id} aria-live="polite">
        {pantallas[i].render()}
        {ultima && (
          <div class="historia-fin-botones">
            <button class="btn btn-grande historia-fin" onClick={() => setCompartir(true)}><Icono n="compartir" /> Compartir</button>
            <button class="btn btn-grande historia-fin-2" onClick={alCerrar}>A por el siguiente</button>
          </div>
        )}
      </div>
      <button class="historia-zona anterior" onClick={() => ir(-1)} disabled={i === 0} aria-label="Pantalla anterior" />
      <button class="historia-zona siguiente" onClick={() => (ultima ? alCerrar() : ir(1))} aria-label={ultima ? 'Cerrar tu año' : 'Pantalla siguiente'} />
      {compartir && <HojaCompartir datos={datosCompartirAnio(r)} titulo={`Compartir tu ${r.anio}`} alCerrar={() => setCompartir(false)}
        alt={`Mi ${r.anio} en FBE: ${r.sesiones} sesiones, ${r.dias} días entrenando, ${toneladas(r.tonelaje)} toneladas`}
        nota="Solo lleva tus sesiones, los días entrenados, las series, el tonelaje, los récords, tu racha y el cardio: nada de peso, medidas, nutrición, hábitos ni datos de salud." />}
    </div>
  );
}
