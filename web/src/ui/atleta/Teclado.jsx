// v0.63: el teclado de la app para apuntar una serie (como el de Strong, Hevy o la calculadora del móvil). Al tocar los
// kilos, las repeticiones o el RPE de una serie sale este teclado en lugar del del sistema: teclas grandes para una mano,
// coma decimal y borrar; en los kilos, −/+ con el salto de ese ejercicio (con discos, dos veces el disco más pequeño de ese
// gimnasio) y los discos por lado; en las repeticiones, −/+ 1; en el RPE, del 6 al 10 de medio en medio. «Siguiente» pasa de
// kilos a repeticiones, al RPE (si tu coach lo pide) y marca la serie (y arranca el descanso, como ✓).
// Cómo: los campos siguen siendo campos de texto de verdad, con inputmode="none" (el iPhone desde iOS 12.2 y Chrome de
// Android no sacan su teclado; el lector de pantalla los sigue leyendo con su nombre y su valor, y un teclado físico escribe
// en ellos). Las teclas no se llevan el foco (preventDefault al bajar el dedo): el campo sigue enfocado y el cursor, en su
// sitio. Cada cambio se anuncia con educación («Kilos: 42,5»). El teclado se pone dentro de la zona segura y la fila que se
// edita se sube para que nunca quede debajo. Se puede volver al teclado del móvil desde el propio teclado o en Perfil →
// Este móvil (un ajuste de este móvil).
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Capa, Icono } from '../comunes.jsx';
import { Placas } from '../Herramientas.jsx';
import { leerAjustes, guardarAjustes, EVENTO_AJUSTES } from '../ajustes.js';
import { vibrar } from '../hapticos.js';
import { sonarFBE } from '../sonido.js';
import { notaRpe } from '../../logica/sonido.js';
import { num } from '../../logica/calculos.js';
import { RPE_TECLADO, DISCOS_MINIMOS, pulsarTecla, sumarPaso, anuncioValor, discosCon } from '../../logica/teclado.js';
import { enLibras, nombrePeso, barraVista, etiquetaPeso } from '../../logica/unidades.js';

// ¿Teclado de la app? (el ajuste de este móvil; cambia al momento en todas las filas)
export function useTecladoApp() {
  const [v, setV] = useState(() => leerAjustes().tecladoApp !== false);
  useEffect(() => {
    const leer = () => setV(leerAjustes().tecladoApp !== false);
    window.addEventListener(EVENTO_AJUSTES, leer);
    return () => window.removeEventListener(EVENTO_AJUSTES, leer);
  }, []);
  return v;
}
export function usarTecladoMovil() { guardarAjustes({ ...leerAjustes(), tecladoApp: false }); }

const quieto = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Sube (o baja) lo que se está editando para que quede entre la cabecera y el teclado. En el modo enfoque, dentro de su
// cuerpo (que es lo que se desplaza); en la sesión, la página
export function llevarSobreTeclado(el, alto) {
  if (!el?.isConnected) return;
  const r = el.getBoundingClientRect();
  const caja = el.closest('.enfoque-cuerpo');
  const cab = caja ? null : document.querySelector('.sesion-vista > .cabecera');
  const arriba = caja ? caja.getBoundingClientRect().top + 8 : (cab ? cab.getBoundingClientRect().bottom : 0) + 8;
  const abajo = (window.visualViewport?.height || innerHeight) - alto - 12;
  let d = 0;
  if (r.bottom > abajo) d = r.bottom - abajo;
  if (r.top - d < arriba) d = r.top - arriba;
  if (Math.abs(d) < 2) return;
  (caja || window).scrollBy({ top: d, behavior: quieto() ? 'auto' : 'smooth' });
}

let abiertos = 0;
let ultimoCierre = 0;
const NOMBRE = { kg: 'Kilos', reps: 'Repeticiones', rpe: 'RPE' };
// (v0.112: «Libras» si el atleta las tiene puestas)
const nombreDe = (c) => (c === 'kg' ? nombrePeso(undefined, { mayuscula: true }) : NOMBRE[c]);

// campo: 'kg' | 'reps' | 'rpe'; texto: lo escrito en kilos o repeticiones; rpe: el RPE elegido ('' sin él); base: lo que
// te propone la app (el gris), para −/+ con el campo vacío; paso: el salto de los kilos; serie: «Serie 2», «Top»…;
// anterior: lo de la última vez en esa serie; objetivo: «RPE 8» si lo pide tu coach; final: 'hecha' (Siguiente marca la
// serie), 'listo' (una serie ya hecha: Siguiente cierra; nunca la desmarca), 'guardar' (el modo enfoque, corrigiendo una
// serie: la guarda) o null (hay otro campo después);
// ancla: () => la fila (para subirla sobre el teclado); dentro(el): si el foco o el toque están en los campos de la fila;
// barra: se carga con barra (discos por lado); discoMinimo, alDisco(d), lugar: el disco más pequeño de ese gimnasio;
// alCalculadora(kg): abre la calculadora (discos por lado y 1RM). enCapa: en su capa de <body> (en la sesión) o dentro
// de quien lo pinta (el modo enfoque, que es un diálogo modal: fuera de él, el lector de pantalla no lo vería).
export function Teclado(props) {
  return props.enCapa ? <Capa><TecladoDentro {...props} /></Capa> : <TecladoDentro {...props} />;
}

function TecladoDentro({ campo, texto = '', rpe = '', base = null, paso = 2.5, serie = '', anterior = null, objetivo = null, final = null,
  alTexto, alRpe, alSiguiente, alCerrar, ancla, dentro, barra = false, discoMinimo = 1.25, alDisco: alDiscoKg = null, lugar = 'gimnasio', alCalculadora = null, alMovil = null, clave = '' }) {
  // (v0.112) en libras, los discos son los de libras (el más pequeño, 2,5 lb): sin elegir el disco más pequeño
  const alDisco = enLibras() ? null : alDiscoKg;
  const raiz = useRef(null);
  const [nuevo, setNuevo] = useState(true);
  const [anuncio, setAnuncio] = useState('');
  const [eligeDisco, setEligeDisco] = useState(false);
  const [entrada] = useState(() => Date.now() - ultimoCierre > 250);
  // Al abrir otro campo (o la misma fila otra vez), lo que se teclee sustituye a lo que hay
  useEffect(() => { setNuevo(true); setEligeDisco(false); }, [clave, campo]);
  // Su alto, para la página (deja sitio debajo para poder subir las últimas filas) y para el aviso de abajo
  useLayoutEffect(() => {
    abiertos += 1;
    const r = document.documentElement;
    r.setAttribute('data-teclado', '');
    return () => {
      abiertos -= 1;
      ultimoCierre = Date.now();
      // (otra fila lo abre al momento: que no salte la página)
      setTimeout(() => { if (!abiertos) { r.removeAttribute('data-teclado'); r.style.removeProperty('--alto-teclado'); } }, 60);
    };
  }, []);
  useLayoutEffect(() => {
    const alto = raiz.current ? Math.ceil(raiz.current.getBoundingClientRect().height) : 300;
    document.documentElement.style.setProperty('--alto-teclado', `${alto}px`);
    llevarSobreTeclado(ancla?.(), alto);
  }, [clave, campo, eligeDisco]);
  // Tocar fuera (sin arrastrar: desplazar la página no lo cierra) o Escape lo cierran
  useEffect(() => {
    let ini = null;
    const baja = (e) => { ini = { x: e.clientX, y: e.clientY, t: e.target }; };
    const sube = (e) => {
      const i = ini; ini = null;
      if (!i || Math.hypot(e.clientX - i.x, e.clientY - i.y) > 10) return;
      if (raiz.current?.contains(i.t) || dentro?.(i.t)) return;
      alCerrar();
    };
    // (Escape es del teclado: el modo enfoque, que también lo escucha, no se cierra)
    const tecla = (e) => { if (e.key === 'Escape' && !document.querySelector('.velo')) { e.preventDefault(); e.stopImmediatePropagation(); alCerrar(); } };
    document.addEventListener('pointerdown', baja, true);
    document.addEventListener('pointerup', sube, true);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', baja, true); document.removeEventListener('pointerup', sube, true); document.removeEventListener('keydown', tecla); };
  });
  const decir = (c, t) => setAnuncio(anuncioValor(c, t));
  // (sonido 2, tanda 5) y, con «Clic del teclado», un clic casi imperceptible
  const tocar = () => { vibrar('toque'); sonarFBE('tecla'); };
  const pulsar = (k) => {
    const t = pulsarTecla(texto, k, { campo, nuevo });
    tocar();
    setNuevo(false);
    if (t !== texto) { alTexto(t); decir(campo, t); }
  };
  const sumar = (d) => {
    const t = sumarPaso(texto, base, d, campo);
    tocar();
    setNuevo(true);
    if (t !== texto) { alTexto(t); decir(campo, t); }
  };
  // (sonido 2, tanda 5) el RPE suena: más agudo cuanto más duro
  const elegirRpe = (v) => { vibrar('toque'); const n = Number(rpe) === v ? '' : v; alRpe(n); decir('rpe', n); if (n !== '') sonarFBE('rpe', { f: notaRpe(n) }); };
  // Las teclas no se llevan el foco: el campo sigue enfocado (en el iPhone, sin esto el campo se suelta)
  const sinFoco = (e) => e.preventDefault();
  const delta = campo === 'kg' ? paso : 1;
  const kgAhora = campo === 'kg' ? (texto !== '' ? Number(String(texto).replace(',', '.')) : Number(base)) : null;
  const sig = final === 'hecha' ? 'Hecha' : final === 'listo' ? 'Listo' : final === 'guardar' ? 'Guardar' : 'Siguiente';
  const etiquetaSig = final === 'hecha' ? `Hecha: marcar la ${serie.toLowerCase()} y empezar el descanso` : final === 'listo' ? 'Listo: cerrar el teclado'
    : final === 'guardar' ? `Guardar los cambios de la ${serie.toLowerCase()}` : `Siguiente: ${NOMBRE[campo === 'kg' ? 'reps' : 'rpe'].toLowerCase()}`;
  // (una función, no un componente: un componente nuevo en cada pintado rehace los botones entre bajar y subir el dedo)
  const T = ({ k, children, etiqueta, clase = '' }) => (
    <button key={`t-${k}`} type="button" tabIndex={-1} class={`tecla ${clase}`} aria-label={etiqueta} onClick={() => pulsar(k)}>{children}</button>
  );
  const nombreLugar = lugar === 'casa' ? 'en casa' : lugar === 'viaje' ? 'de viaje' : 'en el gimnasio';
  return (
    <div ref={raiz} class={`teclado-serie ${entrada ? 'entra' : ''}`} role="group" aria-label={`Teclado de ${nombreDe(campo).toLowerCase()}, ${serie.toLowerCase()}`}
      onPointerDown={sinFoco} onMouseDown={sinFoco} data-campo={campo}>
      <div class="teclado-cab">
        <span class="teclado-titulo"><strong>{nombreDe(campo)}</strong><span class="terciario"> · {serie}</span>
          {campo === 'rpe' && objetivo && <span class="teclado-meta"> · objetivo {objetivo.replace(/^RPE /, '')}</span>}
          {campo !== 'rpe' && anterior && <span class="teclado-meta"> · ant. <span class="num">{anterior}</span></span>}</span>
        {alMovil && <button type="button" tabIndex={-1} class="teclado-icono" aria-label="Usar el teclado del móvil" title="Usar el teclado del móvil" onClick={alMovil}><Icono n="teclado" /></button>}
        <button type="button" tabIndex={-1} class="teclado-icono" aria-label="Ocultar el teclado" onClick={alCerrar}><Icono n="abajo" /></button>
      </div>
      {campo === 'kg' && (barra || alDisco) && (
        <div class="teclado-discos">
          {barra && Number.isFinite(kgAhora) && kgAhora > barraVista() ? <Placas kg={kgAhora} discos={discosCon(discoMinimo)} /> : <span class="terciario mini">{barra ? `Barra de ${barraVista()} ${etiquetaPeso()}` : ''}</span>}
          <span class="teclado-discos-acc">
            {alDisco && <button type="button" tabIndex={-1} class="teclado-chip" aria-expanded={eligeDisco ? 'true' : 'false'} onClick={() => setEligeDisco(!eligeDisco)}
              aria-label={`Tu disco más pequeño ${nombreLugar}: ${num(discoMinimo, 2)} kg. Cambiar`}>Discos de {num(discoMinimo, 2)}</button>}
            {alCalculadora && <button type="button" tabIndex={-1} class="teclado-chip" onClick={() => alCalculadora(Number.isFinite(kgAhora) ? kgAhora : null)} aria-label="Abrir la calculadora de discos"><Icono n="calculadora" /> Discos</button>}
          </span>
        </div>
      )}
      {campo === 'kg' && eligeDisco && alDisco ? (
        <div class="teclado-elige-disco" role="group" aria-label={`Tu disco más pequeño ${nombreLugar}`}>
          <span class="peq secundario">El disco más pequeño que tienes {nombreLugar} (los −/+ suben uno por lado):</span>
          <div class="teclado-rpe">
            {DISCOS_MINIMOS.map((d) => (
              <button key={d} type="button" tabIndex={-1} class="tecla" aria-pressed={d === discoMinimo ? 'true' : 'false'} onClick={() => { tocar(); alDisco(d); setEligeDisco(false); }}>{num(d, 2)} kg</button>
            ))}
          </div>
        </div>
      ) : campo === 'rpe' ? (
        <div class="teclado-rpe" role="group" aria-label="RPE de la serie">
          {RPE_TECLADO.map((v) => (
            <button key={v} type="button" tabIndex={-1} class="tecla" aria-pressed={Number(rpe) === v && rpe !== '' ? 'true' : 'false'} onClick={() => elegirRpe(v)}>{num(v)}</button>
          ))}
          <button type="button" tabIndex={-1} class="tecla tecla-sin" aria-pressed={rpe === '' ? 'true' : 'false'} onClick={() => { tocar(); alRpe(''); decir('rpe', ''); }}>Sin RPE</button>
        </div>
      ) : (
        <div class="teclado-teclas">
          {T({ k: '1', children: '1' })}{T({ k: '2', children: '2' })}{T({ k: '3', children: '3' })}
          <button type="button" tabIndex={-1} class="tecla tecla-paso" onClick={() => sumar(-delta)} aria-label={campo === 'kg' ? `Quitar ${num(delta, 2)} ${nombrePeso()}` : 'Una repetición menos'}>−{num(delta, 2)}</button>
          {T({ k: '4', children: '4' })}{T({ k: '5', children: '5' })}{T({ k: '6', children: '6' })}
          <button type="button" tabIndex={-1} class="tecla tecla-paso" onClick={() => sumar(delta)} aria-label={campo === 'kg' ? `Añadir ${num(delta, 2)} ${nombrePeso()}` : 'Una repetición más'}>+{num(delta, 2)}</button>
          {T({ k: '7', children: '7' })}{T({ k: '8', children: '8' })}{T({ k: '9', children: '9' })}
          {T({ k: 'borrar', etiqueta: 'Borrar', clase: 'tecla-borrar', children: <Icono n="retroceso" /> })}
          {campo === 'kg' ? T({ k: ',', etiqueta: 'Coma decimal', children: ',' }) : <span aria-hidden="true" />}
          {T({ k: '0', children: '0' })}
          <button type="button" tabIndex={-1} class={`tecla tecla-siguiente ${final === 'hecha' || final === 'guardar' ? 'es-hecha' : ''}`} aria-label={etiquetaSig} onClick={() => { tocar(); alSiguiente(); }}>
            {(final === 'hecha' || final === 'guardar') && <Icono n="hecho" />}{sig}{!final && <Icono n="derecha" />}
          </button>
        </div>
      )}
      {campo === 'rpe' && (
        <button type="button" tabIndex={-1} class={`tecla tecla-siguiente ancha ${final === 'hecha' || final === 'guardar' ? 'es-hecha' : ''}`} aria-label={etiquetaSig} onClick={() => { tocar(); alSiguiente(); }}>
          {(final === 'hecha' || final === 'guardar') && <Icono n="hecho" />}{sig}{!final && <Icono n="derecha" />}
        </button>
      )}
      <p class="sr" aria-live="polite">{anuncio}</p>
    </div>
  );
}
