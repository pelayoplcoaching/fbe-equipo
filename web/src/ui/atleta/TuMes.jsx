import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Anillo, usePreferencia, Cargando, Capa } from '../comunes.jsx';
import { HojaCompartir } from '../Compartir.jsx';
import { conNutricion, conEntrenamiento } from '../../logica/nivel.js';
import { nombreMes, mesConAnio, mesAnterior, calendarioMes, datosCompartirMes } from '../../logica/mes.js';
import { num } from '../../logica/calculos.js';

const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const toneladas = (kg) => num(Math.round(kg / 100) / 10, 1);
const horas = (min) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : `${min} min`);

// En Hoy, desde el día 1: el mes que acaba de terminar, hasta que lo abre o lo quita (una vez, en este móvil: abrirlo ya
// cuenta como visto, aunque algo cierre la historia antes de acabar)
export function TarjetaMes({ salud }) {
  const { api, atleta } = useApp();
  const mes = mesAnterior();
  const [visto, setVisto] = usePreferencia('fbe-tu-mes-visto', null);
  const [abierta, setAbierta] = useState(false);
  const r = useCarga(() => (visto === mes ? Promise.resolve(null) : api.resumenMes(atleta.id, mes, { salud, nutricion: conNutricion(atleta), entrenamiento: conEntrenamiento(atleta) }).catch(() => null)), [atleta.id, mes, salud]);
  const res = r.datos;
  if (!res || res.vacio || (visto === mes && !abierta)) return null;
  const linea = res.conEntreno ? `${res.sesiones.hechas} ${res.sesiones.hechas === 1 ? 'sesión' : 'sesiones'}, ${res.dias} ${res.dias === 1 ? 'día' : 'días'} entrenando${res.records.length ? `, ${res.records.length} ${res.records.length === 1 ? 'récord' : 'récords'}` : ''}`
    : res.nutricion?.dias ? `${res.nutricion.dias} días de nutrición apuntados` : 'Tus hábitos del mes';
  return (
    <>
      <section class="tarjeta-semana tarjeta-mes" aria-label={`Tu ${nombreMes(mes)}`}>
        <button class="tarjeta-semana-abrir" onClick={() => { setAbierta(true); setVisto(mes); }}>
          <span class="tarjeta-semana-disco" aria-hidden="true" />
          <span class="pila-xs">
            <span class="mini">Tu {nombreMes(mes)}</span>
            <strong>{linea}</strong>
            <span class="mini">Toca para verlo</span>
          </span>
          <Icono n="play" />
        </button>
        <button class="btn btn-icono plano tarjeta-semana-quitar" onClick={() => setVisto(mes)} aria-label={`Ocultar el resumen de ${nombreMes(mes)}`}><Icono n="cerrar" /></button>
      </section>
      {abierta && <HistoriaMes resumen={res} salud={salud} alCerrar={() => { setAbierta(false); setVisto(mes); }} />}
    </>
  );
}

// El calendario del mes: un punto por día entrenado
export function CalendarioMes({ mes, dias, peq = false }) {
  const semanas = calendarioMes(mes, dias);
  return (
    <div class={`calendario-mes ${peq ? 'peq' : ''}`} role="img" aria-label={`${dias.length} ${dias.length === 1 ? 'día entrenado' : 'días entrenados'} en ${nombreMes(mes)}`}>
      {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <span key={d} class="cal-cab" aria-hidden="true">{d}</span>)}
      {semanas.flat().map((d) => <span key={d.iso} class={`cal-dia ${d.fuera ? 'fuera' : ''} ${d.entrenado ? 'si' : ''}`} aria-hidden="true">{d.fuera ? '' : d.dia}</span>)}
    </div>
  );
}

// Historia a pantalla completa (como «Tu semana»): toques, deslizar o las flechas; avanza sola salvo con movimiento
// reducido. conCompartir: el atleta puede hacer la imagen (el coach lo ve sin ese botón).
// v0.50: en su capa (en <body>), como las hojas
export function HistoriaMes(props) { return <Capa><HistoriaMesPantalla {...props} /></Capa>; }
function HistoriaMesPantalla({ resumen: r, salud, alCerrar, conCompartir = true, nombre = null }) {
  const mes = r.mes;
  const tu = nombre ? `El ${nombreMes(mes)} de ${nombre}` : `Tu ${nombreMes(mes)}`;
  const pantallas = [
    { id: 'portada', render: () => (
      <>
        <span class="historia-etq">{tu}</span>
        {r.conEntreno ? (
          <>
            <div class="historia-anillo"><Anillo hechas={Math.min(r.sesiones.hechas, r.sesiones.previstas || r.sesiones.hechas)} total={r.sesiones.previstas || r.sesiones.hechas || 1} tam={150} /></div>
            <h2>{r.sesiones.hechas} {r.sesiones.hechas === 1 ? 'sesión' : 'sesiones'}<small>{r.sesiones.previstas ? `de ${r.sesiones.previstas} previstas` : 'hechas'}</small></h2>
            <p class="historia-texto">{r.dias} {r.dias === 1 ? 'día' : 'días'} entrenando{r.minutos ? `, ${horas(r.minutos)} en total` : ''}.</p>
          </>
        ) : <h2>{capital(mesConAnio(mes))}</h2>}
      </>
    ) },
    ...(r.conEntreno ? [
      { id: 'volumen', render: () => (
        <>
          <span class="historia-etq">Has movido</span>
          <p class="historia-cifra num">{toneladas(r.tonelaje)}<small>toneladas</small></p>
          <p class="historia-texto">en {r.series} series</p>
        </>
      ) },
      { id: 'records', render: () => (r.records.length ? (
        <>
          <span class="historia-etq">Récords</span>
          <p class="historia-cifra num">{r.records.length}<small>{r.records.length === 1 ? 'récord' : 'récords'}</small></p>
          <ul class="historia-lista">{r.records.slice(0, 4).map((x, i) => <li key={i}><Icono n="trofeo" /><span><strong>{x.ejercicio}</strong><br />{x.texto}</span></li>)}</ul>
          {r.records.length > 4 && <p class="historia-texto">y {r.records.length - 4} más en tu vitrina</p>}
        </>
      ) : (
        <>
          <span class="historia-etq">Récords</span>
          <h2>Mes de constancia</h2>
          <p class="historia-texto">Este mes no ha habido récords. Llegan de sumar meses como este.</p>
        </>
      )) },
      { id: 'racha', render: () => (
        <>
          <span class="historia-etq">Tu mejor racha</span>
          <p class="historia-cifra num">{r.mejorRacha}<small>{r.mejorRacha === 1 ? 'semana completa' : 'semanas completas seguidas'}</small></p>
          <p class="historia-texto">{r.semanasCompletas ? `${r.semanasCompletas} ${r.semanasCompletas === 1 ? 'semana' : 'semanas'} con todo lo previsto hecho.` : 'Termina todas las sesiones de una semana para empezar una racha.'}</p>
        </>
      ) },
      { id: 'calendario', render: () => (
        <>
          <span class="historia-etq">Tu constancia</span>
          <h2>{r.dias} {r.dias === 1 ? 'día' : 'días'}<small>entrenando en {nombreMes(mes)}</small></h2>
          <CalendarioMes mes={mes} dias={r.diasEntrenados} />
        </>
      ) },
    ] : []),
    ...(r.cardio?.sesiones ? [{ id: 'cardio', render: () => (
      <>
        <span class="historia-etq">Cardio</span>
        <p class="historia-cifra num">{r.cardio.minutos}<small>minutos</small></p>
        <p class="historia-texto">{r.cardio.km ? `${num(r.cardio.km, 1)} km en ` : 'En '}{r.cardio.sesiones} {r.cardio.sesiones === 1 ? 'sesión' : 'sesiones'}</p>
      </>
    ) }] : []),
    ...(salud && r.habitos ? [{ id: 'habitos', render: () => (
      <>
        <span class="historia-etq">Tus hábitos</span>
        <p class="historia-cifra num">{r.habitos.media}<small>% de lo que te tocaba</small></p>
        <ul class="historia-lista">{r.habitos.lista.slice(0, 4).map((h) => <li key={h.nombre}><Icono n={h.icono === 'libre' ? 'hecho' : h.icono} /><span><strong>{h.nombre}</strong><br />{h.pct} %</span></li>)}</ul>
      </>
    ) }] : []),
    ...(salud && r.nutricion?.dias ? [{ id: 'nutricion', render: () => (
      <>
        <span class="historia-etq">Tu nutrición</span>
        <p class="historia-cifra num">{r.nutricion.dias}<small>{r.nutricion.dias === 1 ? 'día apuntado' : 'días apuntados'}</small></p>
        <p class="historia-texto">{r.nutricion.bien ? `${r.nutricion.bien} ${r.nutricion.bien === 1 ? 'fue' : 'fueron'} bien frente a tu plan${r.nutricion.cerca ? ` y ${r.nutricion.cerca} cerca` : ''}.` : 'Apuntar ya es la mitad del trabajo.'}</p>
      </>
    ) }] : []),
  ];
  const [i, setI] = useState(0);
  const [compartir, setCompartir] = useState(false);
  const quieto = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const ultima = i === pantallas.length - 1;
  const ir = (d) => setI((x) => Math.max(0, Math.min(pantallas.length - 1, x + d)));
  const caja = useRef(null);
  const toque = useRef(null);
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
  // Deslizar a los lados
  const alBajar = (e) => { toque.current = { x: e.clientX, y: e.clientY }; };
  const alSoltar = (e) => {
    const t = toque.current; toque.current = null;
    if (!t) return;
    const dx = e.clientX - t.x, dy = e.clientY - t.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { e.preventDefault?.(); ir(dx < 0 ? 1 : -1); toque.current = 'deslizado'; }
  };
  const datosImagen = () => {
    const c = datosCompartirMes(r);
    return {
      nombre: `Mi ${nombreMes(mes)}`, subtitulo: String(mes).slice(0, 4), fecha: r.hasta, etiquetaFecha: capital(mesConAnio(mes)),
      cifras: [[String(c.sesiones), c.sesiones === 1 ? 'sesión' : 'sesiones'], [String(c.dias), c.dias === 1 ? 'día entrenando' : 'días entrenando'], [num(c.toneladas, 1), 'toneladas']],
      series: c.series, tonelaje: c.toneladas * 1000, minutos: null,
      records: [],
      mejores: [{ nombre: 'Series', serie: String(c.series) }, ...(c.records ? [{ nombre: 'Récords', serie: String(c.records) }] : []),
        ...(c.racha ? [{ nombre: 'Mejor racha', serie: `${c.racha} ${c.racha === 1 ? 'semana' : 'semanas'}` }] : []),
        ...(c.cardio ? [{ nombre: 'Cardio', serie: `${c.cardio.minutos} min${c.cardio.km ? ` · ${num(c.cardio.km, 1)} km` : ''}` }] : [])],
      tituloMejores: 'El mes en cifras', calendario: c.calendario,
    };
  };
  return (
    <div class="historia historia-mes" role="dialog" aria-modal="true" aria-label={tu} ref={caja} tabIndex={-1} onPointerDown={alBajar} onPointerUp={alSoltar}>
      <div class="historia-barras" aria-hidden="true">
        {pantallas.map((p, k) => <span key={p.id} class={k < i ? 'vista' : k === i ? `actual ${quieto ? '' : 'corre'}` : ''}><i /></span>)}
      </div>
      <p class="sr" aria-live="polite">Pantalla {i + 1} de {pantallas.length}</p>
      <button class="btn btn-icono plano historia-cerrar" onClick={alCerrar} aria-label="Cerrar el resumen del mes"><Icono n="cerrar" /></button>
      <div class="historia-pantalla" key={pantallas[i].id} aria-live="polite">
        {pantallas[i].render()}
        {ultima && (
          <div class="historia-fin-botones">
            {conCompartir && r.conEntreno && <button class="btn btn-grande historia-fin" onClick={() => setCompartir(true)}><Icono n="compartir" /> Compartir</button>}
            <button class={`btn btn-grande ${conCompartir && r.conEntreno ? 'historia-fin-2' : 'historia-fin'}`} onClick={alCerrar}>{conCompartir ? 'A por el siguiente' : 'Cerrar'}</button>
          </div>
        )}
      </div>
      <button class="historia-zona anterior" onClick={() => { if (toque.current === 'deslizado') { toque.current = null; return; } ir(-1); }} disabled={i === 0} aria-label="Pantalla anterior" />
      <button class="historia-zona siguiente" onClick={() => { if (toque.current === 'deslizado') { toque.current = null; return; } if (ultima) alCerrar(); else ir(1); }} aria-label={ultima ? 'Cerrar el resumen' : 'Pantalla siguiente'} />
      {compartir && <HojaCompartir datos={datosImagen()} titulo={`Compartir tu ${nombreMes(mes)}`} alCerrar={() => setCompartir(false)}
        alt={`Tu ${nombreMes(mes)}: ${r.sesiones.hechas} sesiones, ${r.dias} días entrenando, ${toneladas(r.tonelaje)} toneladas`}
        nota="Solo lleva tus sesiones, los días entrenados, las series, el tonelaje, los récords, tu racha, el cardio y tu calendario: nada de peso, medidas, nutrición, hábitos ni datos de salud." />}
    </div>
  );
}

// En Progreso (y en la ficha, para el coach): los meses acabados, para volver a verlos
export function TusMeses({ atletaId = null, atleta: deQuien = null, salud = true, esCoach = false }) {
  const { api, atleta: yo } = useApp();
  const a = deQuien || yo;
  const id = atletaId || a.id;
  const lista = useCarga(() => api.resumenesMensuales(id, { n: 6, salud, nutricion: conNutricion(a), entrenamiento: conEntrenamiento(a) }).catch(() => []), [id, salud]);
  const [abierto, setAbierto] = useState(null);
  if (lista.cargando && !lista.datos) return esCoach ? <section class="seccion"><h2>Sus meses</h2><div class="panel panel-pad"><Cargando /></div></section> : null;
  if (!lista.datos?.length) return null;
  return (
    <section class="seccion">
      <h2>{esCoach ? 'Sus meses' : 'Tus meses'}</h2>
      <div class="panel">
        <ul class="lista">
          {lista.datos.map((r) => (
            <li key={r.mes}>
              <button class="fila-semana" onClick={() => setAbierto(r)}>
                <span class="pila-xs">
                  <strong>{capital(mesConAnio(r.mes))}</strong>
                  <span class="peq secundario">{r.conEntreno ? `${r.sesiones.hechas} de ${r.sesiones.previstas || r.sesiones.hechas} sesiones, ${r.dias} días entrenando${r.records.length ? `, ${r.records.length} ${r.records.length === 1 ? 'récord' : 'récords'}` : ''}` : r.nutricion?.dias ? `${r.nutricion.dias} días de nutrición apuntados` : 'Hábitos del mes'}</span>
                </span>
                <Icono n="play" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      {abierto && <HistoriaMes resumen={abierto} salud={salud} conCompartir={!esCoach} nombre={esCoach ? a.nombre.split(' ')[0] : null} alCerrar={() => setAbierto(null)} />}
    </section>
  );
}

