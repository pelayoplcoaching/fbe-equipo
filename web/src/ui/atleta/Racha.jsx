// v0.52: la racha, como en Duolingo. Al tocar la racha (semanas completas seguidas), una pantalla con una llama que
// titila (solo transform; quieta con «reducir movimiento»), la cifra en grande y condensada, las últimas 12 semanas
// (completas, sin completar, sin nada programado y la de ahora) y la próxima meta con su barra. Y al llegar a 4, 8, 12,
// 26 y 52 semanas, un momento a pantalla completa con confeti, una vez por hito en este móvil.
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { Capa, Icono, useAtraparFoco, usePreferencia } from '../comunes.jsx';
import { calendarioRacha, proximoHito, hitoPorCelebrar, marcarHitos, NOMBRE_ESTADO_SEMANA, textoSemanas } from '../../logica/racha.js';
import { fmtCorta, hoyISO } from '../../logica/fechas.js';
import { lanzarConfeti } from '../confeti.js';
import { Imagen } from '../Imagen.jsx';
import { MensajeCoach } from './Personal.jsx';
import { imagenCelebracion } from '../../logica/imagenes.js';
import { HojaCompartir } from '../Compartir.jsx';
import { datosRacha } from '../../logica/compartir.js';

// La llama: tres capas que titilan a destiempo (transform desde la base). Sus colores son el fuego, no el tema.
export function Llama({ clase = '' }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg class={`llama ${clase}`} viewBox="0 0 120 150" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`llama-g1-${id}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF5A1F" /><stop offset="1" stop-color="#FF9F43" /></linearGradient>
        <linearGradient id={`llama-g2-${id}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF8A1F" /><stop offset="1" stop-color="#FFC94D" /></linearGradient>
        <radialGradient id={`llama-g3-${id}`} cx="0.5" cy="0.75" r="0.6"><stop offset="0" stop-color="#FFF6D6" /><stop offset="1" stop-color="#FFD66B" /></radialGradient>
      </defs>
      <ellipse class="llama-brasa" cx="60" cy="140" rx="34" ry="6" />
      <path class="llama-capa llama-exterior" fill={`url(#llama-g1-${id})`} d="M60 6c6 22 34 38 34 76 0 30-16 54-34 54S26 112 26 84c0-18 9-30 18-40 1 14 7 24 15 26-4-26 2-44 1-64z" />
      <path class="llama-capa llama-media" fill={`url(#llama-g2-${id})`} d="M61 46c4 15 22 28 22 52 0 21-11 34-23 34s-22-12-22-31c0-12 6-21 12-27 1 10 5 16 10 17-2-18 2-31 1-45z" />
      <path class="llama-capa llama-interior" fill={`url(#llama-g3-${id})`} d="M60 82c3 10 13 18 13 32 0 12-6 19-13 19s-13-7-13-18c0-8 4-13 8-17 1 6 3 9 6 10-1-11 0-18-1-26z" />
    </svg>
  );
}

function usePantalla(alCerrar) {
  const ref = useRef(null);
  useAtraparFoco(ref);
  useEffect(() => {
    const previo = document.activeElement;
    ref.current?.focus();
    // Escape cierra solo la ventana de encima (como las hojas): una hoja abierta encima se cierra antes
    const tecla = (e) => {
      if (e.key !== 'Escape') return;
      const modales = document.querySelectorAll('[aria-modal="true"]');
      if (modales.length && modales[modales.length - 1] !== ref.current) return;
      alCerrar();
    };
    document.addEventListener('keydown', tecla);
    const cuerpo = document.body;
    cuerpo.dataset.hojas = String(Number(cuerpo.dataset.hojas || 0) + 1);
    cuerpo.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      const quedan = Math.max(0, Number(cuerpo.dataset.hojas || 1) - 1);
      if (quedan) cuerpo.dataset.hojas = String(quedan); else { delete cuerpo.dataset.hojas; cuerpo.style.overflow = ''; }
      previo?.focus?.();
    };
  }, []);
  return ref;
}

export function PantallaRacha(props) { return <Capa><PantallaRachaDentro {...props} /></Capa>; }
// diasSemana (v0.53): su objetivo de días por semana, si lo tiene (sus semanas son de lunes a domingo con ese objetivo)
function PantallaRachaDentro({ racha = 0, semanas = [], alCerrar, hoy = hoyISO(), diasSemana = null }) {
  const ref = usePantalla(alCerrar);
  const cal = calendarioRacha(semanas, hoy, 12);
  const meta = proximoHito(racha);
  // (compartir) la racha como tarjeta (con 2 semanas o más)
  const [compartir, setCompartir] = useState(false);
  return (
    <div class="racha-pantalla" role="dialog" aria-modal="true" aria-labelledby="racha-titulo" ref={ref} tabIndex={-1}>
      <button class="btn btn-icono plano racha-cerrar" onClick={alCerrar} aria-label="Cerrar la racha"><Icono n="cerrar" /></button>
      <div class="racha-cuerpo">
        {/* (diseño, tanda 18) la llama crece con la racha: --nivel de 0 a 4 (1, 2, 4, 8 y 12 semanas o más) */}
        <div class={`racha-fuego ${racha ? '' : 'apagada'}`} style={{ '--nivel': racha >= 12 ? 4 : racha >= 8 ? 3 : racha >= 4 ? 2 : racha >= 2 ? 1 : 0 }}><Llama /></div>
        <p class="racha-cifra marcador" aria-hidden="true">{racha}</p>
        <h2 id="racha-titulo">{racha ? `${racha === 1 ? 'semana completa' : 'semanas completas'} seguidas` : 'Aún sin racha'}<span class="sr">: {textoSemanas(racha)}</span></h2>
        <p class="racha-sub">{diasSemana
          ? (racha ? `Semanas de lunes a domingo con tus ${diasSemana === 1 ? 'sesión' : `${diasSemana} sesiones`} hechas. La de esta semana suma en cuanto llegas, y las semanas sin nada que hacer no la rompen.` : `Llega a ${diasSemana === 1 ? '1 sesión' : `${diasSemana} sesiones`} de lunes a domingo y empieza tu racha. Las semanas sin nada que hacer no la rompen.`)
          : racha ? 'Semanas con todas sus sesiones hechas. La de esta semana suma en cuanto la completas, y las semanas sin nada programado no la rompen.' : 'Haz todas las sesiones de una semana y empieza tu racha. Las semanas sin nada programado no la rompen.'}</p>
        <section class="racha-bloque" aria-labelledby="racha-cal-t">
          <h3 id="racha-cal-t">Las últimas 12 semanas</h3>
          <ol class="racha-calendario">
            {cal.map((w, i) => (
              <li key={w.lunes} class={`racha-semana ${w.estado}`} style={{ '--i': i }}>
                <span class="racha-marca" aria-hidden="true">{w.estado === 'completa' ? <Icono n="llama" /> : w.estado === 'incompleta' ? <Icono n="cerrar" /> : w.estado === 'en_curso' ? <span class="num">{w.hechas}/{w.total}</span> : '–'}</span>
                <span class="racha-fecha" aria-hidden="true">{fmtCorta(w.lunes)}</span>
                <span class="sr">Semana del {fmtCorta(w.lunes)}: {NOMBRE_ESTADO_SEMANA[w.estado]}{w.total ? `, ${w.hechas} de ${w.total} sesiones` : ''}</span>
              </li>
            ))}
          </ol>
          <p class="racha-leyenda" aria-hidden="true"><span><i class="completa" />Completa</span><span><i class="incompleta" />Sin completar</span><span><i class="sin_plan" />Sin programar</span></p>
        </section>
        <section class="racha-bloque racha-meta" aria-labelledby="racha-meta-t">
          <h3 id="racha-meta-t">Próxima meta: {textoSemanas(meta.hito)}</h3>
          <div class="racha-barra" role="progressbar" aria-label={`Hacia ${textoSemanas(meta.hito)}`} aria-valuemin={meta.anterior} aria-valuemax={meta.hito} aria-valuenow={Math.max(meta.anterior, racha)}>
            <span style={{ transform: `scaleX(${meta.frac})` }} />
          </div>
          <p class="racha-sub num">{meta.faltan === 1 ? 'Te falta 1 semana completa.' : `Te faltan ${meta.faltan} semanas completas.`}</p>
        </section>
        {racha >= 2 && <button class="btn btn-grande racha-compartir" onClick={() => setCompartir(true)}><Icono n="compartir" /> Compartir la racha</button>}
        <button class="btn btn-grande racha-seguir" onClick={alCerrar}>Seguir</button>
      </div>
      {compartir && <HojaCompartir logro tipo="racha" titulo="Compartir tu racha" datos={datosRacha(racha, { hoy })} equipo={{ tema: 'logros' }} alCerrar={() => setCompartir(false)} />}
    </div>
  );
}

const TEXTO_HITO = {
  4: 'Un mes entero sin fallar una semana. Así se empieza a notar.',
  8: 'Dos meses de constancia: esto ya es un hábito.',
  12: 'Tres meses seguidos. Lo que estás construyendo se queda.',
  26: 'Medio año sin fallar una semana. Pocos llegan hasta aquí.',
  52: 'Un año entero de semanas completas. Enhorabuena.',
};

export function HitoRacha(props) { return <Capa><HitoRachaDentro {...props} /></Capa>; }
function HitoRachaDentro({ hito, alCerrar }) {
  const ref = usePantalla(alCerrar);
  const [compartir, setCompartir] = useState(false);
  useEffect(() => { const t = setTimeout(() => lanzarConfeti({ vibracion: 'record' }), 250); return () => clearTimeout(t); }, []);
  return (
    <div class="hito-pantalla" role="dialog" aria-modal="true" aria-labelledby="hito-titulo" aria-describedby="hito-texto" ref={ref} tabIndex={-1}>
      {/* (imágenes) la hoguera, abajo, fundida con el fondo */}
      <Imagen id={imagenCelebracion('racha')} clase="hito-fondo" tamanos="100vw" prioridad />
      <div class="hito-cuerpo">
        <div class="hito-fuego"><Llama /><span class="hito-num marcador" aria-hidden="true">{hito}</span></div>
        <p class="t-sobre hito-sobre">Nuevo hito</p>
        <h2 id="hito-titulo" class="t-display">¡{hito} semanas seguidas!</h2>
        <p id="hito-texto" class="hito-texto">{TEXTO_HITO[hito] || 'Semanas completas una detrás de otra.'}</p>
        {/* (v0.104) lo que tu coach dejó escrito para los hitos de la racha */}
        <MensajeCoach momento="racha" semanas={hito} clase="mensaje-oscuro" />
        <button class="btn btn-grande hito-compartir" onClick={() => setCompartir(true)}><Icono n="compartir" /> Compartir el hito</button>
        <button class="btn btn-grande hito-seguir" onClick={alCerrar}>Seguir</button>
      </div>
      {compartir && <HojaCompartir logro tipo="racha" titulo="Compartir tu racha" datos={{ ...datosRacha(hito), etiqueta: 'Nuevo hito' }} equipo={{ tema: 'logros' }} alCerrar={() => setCompartir(false)} />}
    </div>
  );
}

// El hito que toca celebrar en este móvil (si lo hay) y cómo darlo por visto
export function useHitoRacha(atletaId, racha) {
  const [vistos, setVistos] = usePreferencia(`fbe-hitos-racha-${atletaId}`, []);
  const hito = racha == null ? null : hitoPorCelebrar(racha, vistos);
  return [hito, () => setVistos(marcarHitos(hito, vistos))];
}
