import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono, Anillo } from '../comunes.jsx';
import { MapaMuscular } from '../MapaMuscular.jsx';
import { num, signo, textoSerie, NOMBRE_GRUPO } from '../../logica/calculos.js';
import { desdeISO } from '../../logica/fechas.js';
import { ajuste } from '../ajustes.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function rangoLargo(lunes, domingo) {
  const a = desdeISO(lunes), b = desdeISO(domingo);
  return a.getMonth() === b.getMonth()
    ? `del ${a.getDate()} al ${b.getDate()} de ${MESES[b.getMonth()]}`
    : `del ${a.getDate()} de ${MESES[a.getMonth()]} al ${b.getDate()} de ${MESES[b.getMonth()]}`;
}
const horas = (min) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : `${min} min`);
const toneladas = (kg) => num(Math.round(kg / 100) / 10, 1);

// Tarjeta en Hoy: la semana pasada en una línea, para abrir la historia
export function TarjetaSemana({ resumen, alAbrir, alQuitar }) {
  const r = resumen;
  return (
    <section class="tarjeta-semana" aria-label="Tu semana pasada">
      <button class="tarjeta-semana-abrir" onClick={alAbrir}>
        <span class="tarjeta-semana-disco" aria-hidden="true" />
        <span class="pila-xs">
          <span class="mini">Tu semana {rangoLargo(r.lunes, r.domingo)}</span>
          <strong>{r.sesiones.hechas} de {r.sesiones.total} sesiones, {toneladas(r.tonelaje)} t{r.records.length ? `, ${r.records.length} ${r.records.length === 1 ? 'récord' : 'récords'}` : ''}</strong>
          <span class="mini">Toca para verla</span>
        </span>
        <Icono n="play" />
      </button>
      <button class="btn btn-icono plano tarjeta-semana-quitar" onClick={alQuitar} aria-label="Ocultar el resumen de la semana"><Icono n="cerrar" /></button>
    </section>
  );
}

// Historia a pantalla completa: se pasa con toques (o flechas) y avanza sola si no se toca
export function HistoriaSemana({ resumen, salud, alCerrar }) {
  const r = resumen;
  const pantallas = [
    { id: 'portada', render: () => (
      <>
        <span class="historia-etq">Tu semana {rangoLargo(r.lunes, r.domingo)}</span>
        <div class="historia-anillo"><Anillo hechas={r.sesiones.hechas} total={r.sesiones.total || r.sesiones.hechas || 1} tam={150} /></div>
        <h2>{r.sesiones.completa ? 'Semana completa' : `${r.sesiones.hechas} de ${r.sesiones.total} sesiones`}</h2>
        {r.racha > 0 && <p class="historia-racha"><Icono n="llama" />{r.racha === 1 ? '1 semana completa' : `${r.racha} semanas completas seguidas`}</p>}
      </>
    ) },
    { id: 'volumen', render: () => (
      <>
        <span class="historia-etq">Has movido</span>
        <p class="historia-cifra num">{toneladas(r.tonelaje)}<small>toneladas</small></p>
        <p class="historia-texto">{r.series} series{r.minutos ? ` en ${horas(r.minutos)}` : ''}{r.cardio?.minutos ? `, y ${r.cardio.minutos} min de cardio${r.cardio.km ? ` (${num(r.cardio.km, 1)} km)` : ''}` : ''}</p>
        {r.cambioTonelaje != null && <span class="historia-chip num">{signo(r.cambioTonelaje, 0)} % que la semana anterior</span>}
      </>
    ) },
    { id: 'records', render: () => (
      r.records.length ? (
        <>
          <span class="historia-etq">Récords</span>
          <p class="historia-cifra num">{r.records.length}<small>{r.records.length === 1 ? 'récord' : 'récords'}</small></p>
          <ul class="historia-lista">
            {r.records.slice(0, 4).map((x, i) => <li key={i}><Icono n="trofeo" /><span><strong>{x.ejercicio}</strong><br />{x.texto}</span></li>)}
          </ul>
          {r.records.length > 4 && <p class="historia-texto">y {r.records.length - 4} más en tu vitrina</p>}
        </>
      ) : (
        <>
          <span class="historia-etq">Tu mejor serie</span>
          {r.mejor ? <><h2>{r.mejor.ejercicio}</h2><p class="historia-cifra num">{textoSerie(r.mejor.serie)}</p><p class="historia-texto">1RM estimado de {num(r.mejor.e1rm)} kg</p></> : <h2>Semana de constancia</h2>}
          <p class="historia-texto">Esta semana no ha habido récords. Los récords llegan de sumar semanas como esta.</p>
        </>
      )
    ) },
    { id: 'musculos', render: () => (
      <>
        <span class="historia-etq">Lo que más has trabajado</span>
        {r.musculoTop && <h2>{NOMBRE_GRUPO[r.musculoTop.grupo]}<small>{num(r.musculoTop.series)} series</small></h2>}
        <MapaMuscular series={r.musculos} etiqueta="Series por músculo de la semana" />
      </>
    ) },
    ...(salud && r.peso ? [{ id: 'peso', render: () => (
      <>
        <span class="historia-etq">Tu peso (tendencia)</span>
        {ajuste('pesoCifra') ? <>
          <p class="historia-cifra num">{num(r.peso.despues)}<small>kg</small></p>
          <span class="historia-chip num">{signo(r.peso.cambio, 2)} kg esta semana</span>
        </> : <p class="historia-cifra">{Math.abs(r.peso.cambio) < 0.1 ? 'Estable' : r.peso.cambio < 0 ? 'Bajando' : 'Subiendo'}</p>}
        <p class="historia-texto">La tendencia suaviza lo que sube y baja de un día a otro con el agua y la sal.</p>
      </>
    ) }] : []),
  ];
  const [i, setI] = useState(0);
  const quieto = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const ultima = i === pantallas.length - 1;
  const ir = (d) => setI((x) => Math.max(0, Math.min(pantallas.length - 1, x + d)));
  const caja = useRef(null);
  // Avanza sola cada 7 s (no con movimiento reducido ni en la última)
  useEffect(() => {
    if (quieto || ultima) return undefined;
    const t = setTimeout(() => ir(1), 7000);
    return () => clearTimeout(t);
  }, [i]);
  useEffect(() => {
    caja.current?.focus();
    const tecla = (e) => { if (e.key === 'Escape') alCerrar(); if (e.key === 'ArrowRight') ir(1); if (e.key === 'ArrowLeft') ir(-1); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);
  return (
    <div class="historia" role="dialog" aria-modal="true" aria-label={`Tu semana ${rangoLargo(r.lunes, r.domingo)}`} ref={caja} tabIndex={-1}>
      <div class="historia-barras" aria-hidden="true">
        {pantallas.map((p, k) => <span key={p.id} class={k < i ? 'vista' : k === i ? `actual ${quieto ? '' : 'corre'}` : ''}><i /></span>)}
      </div>
      <button class="btn btn-icono plano historia-cerrar" onClick={alCerrar} aria-label="Cerrar el resumen"><Icono n="cerrar" /></button>
      <div class="historia-pantalla" key={pantallas[i].id} aria-live="polite">
        {pantallas[i].render()}
        {ultima && <button class="btn btn-grande historia-fin" onClick={alCerrar}>A por la siguiente</button>}
      </div>
      <button class="historia-zona anterior" onClick={() => ir(-1)} disabled={i === 0} aria-label="Pantalla anterior" />
      <button class="historia-zona siguiente" onClick={() => (ultima ? alCerrar() : ir(1))} aria-label={ultima ? 'Cerrar el resumen' : 'Pantalla siguiente'} />
    </div>
  );
}
