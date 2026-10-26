import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono } from '../comunes.jsx';

// ---------- Bienvenida: cuatro pantallas la primera vez que entra un atleta nuevo ----------
const DIBUJOS = {
  programa: (
    <svg viewBox="0 0 200 150" aria-hidden="true">
      <rect x="62" y="6" width="76" height="138" rx="14" class="b-marco" />
      <rect x="70" y="22" width="60" height="8" rx="4" class="b-tinta" />
      {[['b-rojo', 44], ['b-azul', 70], ['b-amarillo', 96], ['b-verde', 122]].map(([c, y]) => (
        <g key={y}>
          <rect x="70" y={y - 9} width="60" height="20" rx="6" class="b-hoja" />
          <circle cx="79" cy={y + 1} r="4.5" class={c} />
          <rect x="88" y={y - 3} width="34" height="5" rx="2.5" class="b-linea" />
          <rect x="88" y={y + 4} width="22" height="4" rx="2" class="b-linea-suave" />
        </g>
      ))}
    </svg>
  ),
  serie: (
    <svg viewBox="0 0 200 150" aria-hidden="true">
      <rect x="18" y="48" width="58" height="54" rx="12" class="b-hoja" />
      <text x="47" y="84" text-anchor="middle" class="b-cifra">62,5</text>
      <rect x="84" y="48" width="44" height="54" rx="12" class="b-hoja" />
      <text x="106" y="84" text-anchor="middle" class="b-cifra">8</text>
      <rect x="138" y="48" width="44" height="54" rx="12" class="b-ok" />
      <path d="M149 76l8 8 15-17" class="b-check" />
      <text x="47" y="40" text-anchor="middle" class="b-etq">kg</text>
      <text x="106" y="40" text-anchor="middle" class="b-etq">reps</text>
    </svg>
  ),
  coach: (
    <svg viewBox="0 0 200 150" aria-hidden="true">
      <path d="M22 26h104a10 10 0 0 1 10 10v28a10 10 0 0 1-10 10H50l-16 14v-14H22a10 10 0 0 1-10-10V36a10 10 0 0 1 10-10z" class="b-hoja" />
      <rect x="26" y="40" width="80" height="6" rx="3" class="b-linea" />
      <rect x="26" y="52" width="58" height="6" rx="3" class="b-linea-suave" />
      <path d="M178 70H76a10 10 0 0 0-10 10v28a10 10 0 0 0 10 10h76l16 14v-14h10a10 10 0 0 0 10-10V80a10 10 0 0 0-10-10z" class="b-morado" />
      <rect x="80" y="84" width="84" height="6" rx="3" class="b-sobre" />
      <rect x="80" y="96" width="56" height="6" rx="3" class="b-sobre" opacity=".7" />
    </svg>
  ),
  instalar: (
    <svg viewBox="0 0 200 150" aria-hidden="true">
      <rect x="62" y="6" width="76" height="138" rx="14" class="b-marco" />
      {[0, 1, 2].flatMap((f) => [0, 1, 2].map((c) => (
        f === 1 && c === 1
          ? <g key={`${f}${c}`}><rect x="89" y="58" width="22" height="22" rx="6" class="b-morado" /><circle cx="100" cy="69" r="4.5" class="b-sobre" /></g>
          : <rect key={`${f}${c}`} x={71 + c * 18 + (c ? c * 0 : 0)} y={30 + f * 28} width="16" height="16" rx="5" class="b-linea-suave" />
      )))}
      <path d="M100 112v18M92 122l8 8 8-8" class="b-flecha" />
    </svg>
  ),
};

export function Bienvenida({ nombre, alTerminar }) {
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const pantallas = [
    { dibujo: 'programa', titulo: `Hola, ${nombre}`, texto: 'Aquí tienes tu programa: cada sesión con sus ejercicios, series y cargas. El disco de color marca la prioridad de cada ejercicio.' },
    { dibujo: 'serie', titulo: 'Apunta cada serie', texto: 'Kilos, repeticiones y cuánto te ha costado. Si haces justo lo que te propone la app, basta con tocar ✓. Funciona aunque el gimnasio no tenga cobertura.' },
    { dibujo: 'coach', titulo: 'Habla con tu coach', texto: 'Cada sesión y cada check-in tienen su conversación. Cuéntale cambios, dudas o molestias, o mándale un vídeo para que te corrija la técnica.' },
    { dibujo: 'instalar', titulo: 'Tenla a mano', texto: ios ? 'En Safari, toca Compartir y luego «Añadir a pantalla de inicio». Se abrirá como una app.' : 'En Chrome, toca el menú ⋮ y luego «Instalar aplicación». Se abrirá como una app.' },
  ];
  const [i, setI] = useState(0);
  const ultima = i === pantallas.length - 1;
  const caja = useRef(null);
  useEffect(() => { caja.current?.focus(); }, []);
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') alTerminar(); if (e.key === 'ArrowRight') setI((x) => Math.min(x + 1, pantallas.length - 1)); if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1)); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);
  const p = pantallas[i];
  const prompt = typeof window !== 'undefined' ? window.__fbeInstalar : null;
  return (
    <div class="bienvenida" role="dialog" aria-modal="true" aria-label="Bienvenida a FBE Equipo" tabIndex={-1} ref={caja}>
      <button class="btn-texto bienvenida-saltar" onClick={alTerminar}>Saltar</button>
      <div class="bienvenida-cuerpo" key={i}>
        <div class="bienvenida-dibujo">{DIBUJOS[p.dibujo]}</div>
        <h2>{p.titulo}</h2>
        <p>{p.texto}</p>
      </div>
      <div class="bienvenida-pie">
        <div class="bienvenida-puntos" role="img" aria-label={`Pantalla ${i + 1} de ${pantallas.length}`}>
          {pantallas.map((_, k) => <span key={k} class={k === i ? 'actual' : ''} />)}
        </div>
        {ultima && prompt && !ios && (
          <button class="btn btn-grande" onClick={async () => { try { await prompt.prompt(); } catch { /* */ } window.__fbeInstalar = null; }}><Icono n="movil" /> Instalar</button>
        )}
        <button class="btn btn-primario btn-grande" onClick={() => (ultima ? alTerminar() : setI(i + 1))}>{ultima ? 'Empezar' : 'Siguiente'}</button>
      </div>
    </div>
  );
}

// ---------- Primeros pasos: una lista corta en Hoy hasta que el atleta la completa (o la oculta) ----------
export function PrimerosPasos({ pasos, alOcultar }) {
  const hechos = pasos.filter((x) => x.hecho).length;
  const [abierto, setAbierto] = useState(null);
  return (
    <section class="panel primeros-pasos" aria-label="Primeros pasos">
      <div class="panel-pad pila-s">
        <div class="separa">
          <strong>Primeros pasos</strong>
          <span class="fila" style="gap:4px"><span class="peq secundario num">{hechos} de {pasos.length}</span>
            <button class="btn btn-icono plano" onClick={alOcultar} aria-label="Ocultar los primeros pasos"><Icono n="cerrar" /></button></span>
        </div>
        <div class="progreso-barra" role="img" aria-label={`${hechos} de ${pasos.length} hechos`}><span style={{ width: `${(hechos / pasos.length) * 100}%` }} /></div>
      </div>
      <ul class="lista">
        {pasos.map((x) => (
          <li key={x.id} class={`paso-inicio ${x.hecho ? 'hecho' : ''}`}>
            <span class="paso-marca" aria-hidden="true">{x.hecho && <Icono n="hecho" />}</span>
            <span class="pila-xs">
              <span class={x.hecho ? 'tachado' : ''}>{x.texto}<span class="sr">{x.hecho ? ', hecho' : ', pendiente'}</span></span>
              {abierto === x.id && x.ayuda && <span class="peq secundario">{x.ayuda}</span>}
            </span>
            {!x.hecho && (x.accion
              ? <button class="btn btn-peq" onClick={() => (x.ayuda && abierto !== x.id ? setAbierto(x.id) : x.accion())}>{x.ayuda && abierto !== x.id ? 'Cómo' : x.etiqueta}</button>
              : <span />)}
          </li>
        ))}
      </ul>
    </section>
  );
}
