// Temporizador de intervalos (como Seconds o SmartWOD): EMOM, AMRAP, Tabata o trabajo y descanso,
// a pantalla completa, con el color de cada fase, pitidos en los tres últimos segundos y la pantalla encendida.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono, Segmentos, Paso, usePreferencia, useAtraparFoco } from '../comunes.jsx';
import { fases, duracionTotal, enCurso, normalizar, textoIntervalos, MODOS_INTERVALOS, POR_DEFECTO } from '../../logica/intervalos.js';
import { prepararAudio, tono, vibrarCorto } from './sesion-comun.jsx';
import { mmss } from '../../logica/calculos.js';

const NOMBRE_FASE = { preparar: 'Prepárate', trabajo: 'Trabajo', descanso: 'Descanso' };

export function Intervalos({ inicial = null, alCerrar, alTerminar = null }) {
  const [guardada, setGuardada] = usePreferencia('fbe-intervalos', null);
  const [config, setConfig] = useState(() => normalizar(inicial || guardada || POR_DEFECTO.intervalos));
  const [corriendo, setCorriendo] = useState(false);
  const raiz = useRef(null);
  useAtraparFoco(raiz);
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;

  // Escape cierra (si no está en marcha: en marcha, un toque sin querer no debe pararlo); la página de detrás
  // no se mueve; al cerrar, el foco vuelve a donde estaba
  const enMarchaRef = useRef(false);
  enMarchaRef.current = corriendo;
  useEffect(() => {
    const previo = document.activeElement;
    const cuerpo = document.body;
    cuerpo.dataset.hojas = String(Number(cuerpo.dataset.hojas || 0) + 1); cuerpo.style.overflow = 'hidden';
    const tecla = (e) => { if (e.key === 'Escape' && !enMarchaRef.current) { e.preventDefault(); cerrar.current(); } };
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('keydown', tecla);
      const quedan = Math.max(0, Number(cuerpo.dataset.hojas || 1) - 1);
      if (quedan) cuerpo.dataset.hojas = String(quedan); else { delete cuerpo.dataset.hojas; cuerpo.style.overflow = ''; }
      previo?.focus?.();
    };
  }, []);

  const cambiar = (c) => setConfig(normalizar({ ...config, ...c }));
  const modo = config.modo;
  return (
    <div ref={raiz} class={`intervalos ${corriendo ? 'en-marcha' : ''}`} role="dialog" aria-modal="true" aria-label="Temporizador de intervalos">
      {corriendo ? (
        <EnMarcha config={config} alParar={() => setCorriendo(false)} alCerrar={() => cerrar.current()} alTerminar={alTerminar} />
      ) : (
        <div class="intervalos-config">
          <div class="intervalos-cab">
            <button class="btn btn-icono plano" aria-label="Cerrar el temporizador" onClick={() => cerrar.current()} autoFocus><Icono n="cerrar" /></button>
            <h2>Temporizador de intervalos</h2>
          </div>
          {inicial && <p class="peq secundario">Configurado con lo que pone tu coach: <strong>{textoIntervalos(inicial)}</strong>.</p>}
          <Segmentos etiqueta="Tipo" valor={modo} opciones={MODOS_INTERVALOS} alCambiar={(v) => v && setConfig(normalizar({ ...POR_DEFECTO[v], preparar: config.preparar }))} />
          <div class="intervalos-campos">
            {(modo === 'intervalos' || modo === 'tabata') && (
              <>
                <div class="campo"><label for="int-rondas">Rondas</label><Paso id="int-rondas" valor={config.rondas} paso={1} min={1} max={50} dec={0} etiqueta="rondas" alCambiar={(v) => cambiar({ rondas: v ?? 1 })} /></div>
                <div class="campo"><label for="int-trabajo">Trabajo (segundos)</label><Paso id="int-trabajo" valor={config.trabajo} paso={5} min={5} max={3600} dec={0} etiqueta="segundos de trabajo" alCambiar={(v) => cambiar({ trabajo: v ?? 30 })} /><span class="ayuda num">{mmss(config.trabajo)}</span></div>
                <div class="campo"><label for="int-descanso">Descanso (segundos)</label><Paso id="int-descanso" valor={config.descanso} paso={5} min={0} max={3600} dec={0} etiqueta="segundos de descanso" alCambiar={(v) => cambiar({ descanso: v ?? 0 })} /><span class="ayuda num">{mmss(config.descanso)}</span></div>
              </>
            )}
            {modo === 'emom' && (
              <>
                <div class="campo"><label for="int-min">Minutos en total</label><Paso id="int-min" valor={config.minutos} paso={1} min={1} max={90} dec={0} etiqueta="minutos" alCambiar={(v) => cambiar({ minutos: v ?? 10 })} /></div>
                <div class="campo"><span class="etq">Cada</span><Segmentos etiqueta="Cada cuánto" valor={config.cada} opciones={[[60, '1 min'], [90, '1:30'], [120, '2 min'], [180, '3 min']]} alCambiar={(v) => v && cambiar({ cada: v })} /></div>
              </>
            )}
            {modo === 'amrap' && (
              <div class="campo"><label for="int-amrap">Minutos</label><Paso id="int-amrap" valor={config.minutos} paso={1} min={1} max={90} dec={0} etiqueta="minutos" alCambiar={(v) => cambiar({ minutos: v ?? 10 })} /><span class="ayuda">Tantas rondas como puedas: ve sumándolas con el botón grande.</span></div>
            )}
            <div class="campo"><span class="etq">Cuenta atrás antes de empezar</span><Segmentos etiqueta="Preparación" valor={config.preparar} opciones={[[0, 'No'], [5, '5 s'], [10, '10 s'], [20, '20 s']]} alCambiar={(v) => cambiar({ preparar: v ?? 0 })} /></div>
          </div>
          <p class="intervalos-total"><span class="secundario">{textoIntervalos(config)}</span><strong class="num">{mmss(duracionTotal(config))} en total</strong></p>
          <button class="btn btn-primario btn-grande" onClick={() => { prepararAudio(); setGuardada(config); setCorriendo(true); }}><Icono n="play" /> Empezar</button>
        </div>
      )}
    </div>
  );
}

function EnMarcha({ config, alParar, alCerrar, alTerminar }) {
  const lista = useRef(fases(config)).current;
  const total = lista.reduce((t, f) => t + f.s, 0);
  const [ahora, setAhora] = useState(() => performance.now());
  const reloj = useRef({ inicio: performance.now(), pausado: 0, desdePausa: null, extra: 0 });
  const [pausa, setPausa] = useState(false);
  const [rondasAmrap, setRondasAmrap] = useState(0);
  const avisados = useRef(new Set());
  const anuncio = useRef(null);

  useEffect(() => {
    const i = setInterval(() => setAhora(performance.now()), 100);
    let candado = null;
    navigator.wakeLock?.request('screen').then((c) => { candado = c; }).catch(() => {});
    const volver = () => { if (document.visibilityState === 'visible') navigator.wakeLock?.request('screen').then((c) => { candado = c; }).catch(() => {}); };
    document.addEventListener('visibilitychange', volver);
    return () => { clearInterval(i); document.removeEventListener('visibilitychange', volver); try { candado?.release(); } catch { /* */ } };
  }, []);

  const r = reloj.current;
  const real = Math.max(0, ((r.desdePausa ?? ahora) - r.inicio - r.pausado) / 1000); // lo que ha pasado de verdad
  const t = real + r.extra; // en el programa (saltar adelanta)
  const e = enCurso(lista, t);
  // Lo que ha durado de verdad, desde que acabó la cuenta atrás (sin pausas ni lo saltado), para la sesión
  if (r.trabajoDesde == null && !e.fin && e.fase.tipo !== 'preparar') r.trabajoDesde = real;
  if (r.trabajoHasta == null && e.fin) r.trabajoHasta = real;
  const hecho = r.trabajoDesde == null ? 0 : (r.trabajoHasta ?? real) - r.trabajoDesde;

  // Pitidos: los tres últimos segundos de cada fase y uno largo al cambiar (agudo al trabajar, grave al descansar)
  useEffect(() => {
    if (pausa) return;
    if (e.fin) {
      if (!avisados.current.has('fin')) { avisados.current.add('fin'); [0, 220, 440].forEach((ms) => setTimeout(() => tono(1320, 0.18, 0.28), ms)); try { navigator.vibrate?.([200, 100, 200, 100, 400]); } catch { /* */ } }
      return;
    }
    const seg = Math.ceil(e.quedan);
    const clave = `${e.i}-${seg}`;
    if (seg <= 3 && seg >= 1 && !avisados.current.has(clave)) { avisados.current.add(clave); tono(880, 0.08, 0.2); }
    const inicioFase = `${e.i}-inicio`;
    if (e.transcurrido < 0.4 && !avisados.current.has(inicioFase)) {
      avisados.current.add(inicioFase);
      if (e.i > 0 || e.fase.tipo !== 'preparar') { tono(e.fase.tipo === 'trabajo' ? 1320 : 660, 0.35, 0.28); vibrarCorto(e.fase.tipo === 'trabajo' ? 200 : 80); }
      if (anuncio.current) anuncio.current.textContent = `${NOMBRE_FASE[e.fase.tipo]}${e.fase.rondas > 1 ? `, ronda ${e.fase.ronda} de ${e.fase.rondas}` : ''}`;
    }
  });

  const alternarPausa = () => {
    if (pausa) { r.pausado += performance.now() - r.desdePausa; r.desdePausa = null; setPausa(false); }
    else { r.desdePausa = performance.now(); setPausa(true); }
  };
  const saltar = () => { if (!e.fin) { r.extra += e.quedan + 0.01; setAhora(performance.now()); } };
  const siguiente = !e.fin ? lista[e.i + 1] : null;
  const fase = e.fin ? 'fin' : e.fase.tipo;
  const minutos = Math.max(1, Math.round(hecho / 60));
  const frac = e.fin ? 1 : e.fase.s ? e.transcurrido / e.fase.s : 0;
  const R = 46, C = 2 * Math.PI * R;
  return (
    <div class={`intervalos-marcha fase-${fase}`}>
      <div class="intervalos-cab">
        <button class="btn btn-icono plano" aria-label="Parar y volver a la configuración" onClick={alParar}><Icono n="cerrar" /></button>
        <span class="num">{mmss(Math.min(t, total))} / {mmss(total)}</span>
      </div>
      <p class="sr" aria-live="polite" ref={anuncio} />
      {e.fin ? (
        <div class="intervalos-fin pila">
          <Icono n="hecho" />
          <h2>¡Hecho!</h2>
          <p class="num">{textoIntervalos(config)}, {mmss(Math.round(hecho))}{config.modo === 'amrap' ? `, ${rondasAmrap} ${rondasAmrap === 1 ? 'ronda' : 'rondas'}` : ''}</p>
          {alTerminar && <button class="btn btn-grande btn-blanco" onClick={() => alTerminar({ minutos, rondas: config.modo === 'amrap' ? rondasAmrap : null })}><Icono n="hecho" /> Terminar la sesión</button>}
          <button class="btn btn-grande plano btn-sobre" onClick={alCerrar}>Cerrar</button>
        </div>
      ) : (
        <>
          <div class="intervalos-centro">
            <span class="intervalos-fase">{NOMBRE_FASE[fase]}</span>
            <div class="intervalos-reloj">
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r={R} class="pista" />
                <circle cx="50" cy="50" r={R} class="avance" stroke-dasharray={C} stroke-dashoffset={C * frac} transform="rotate(-90 50 50)" />
              </svg>
              <span class="intervalos-cuenta num" role="timer" aria-label={`Quedan ${Math.ceil(e.quedan)} segundos de ${NOMBRE_FASE[fase].toLowerCase()}`}>{mmss(Math.ceil(e.quedan))}</span>
            </div>
            {e.fase.rondas > 1 && <span class="intervalos-ronda num">Ronda {e.fase.ronda} de {e.fase.rondas}</span>}
            {siguiente && <span class="intervalos-sig">Después: {siguiente.tipo === e.fase.tipo && siguiente.rondas > 1 ? `ronda ${siguiente.ronda}` : `${NOMBRE_FASE[siguiente.tipo].toLowerCase()} ${mmss(siguiente.s)}`}</span>}
            {config.modo === 'amrap' && e.fase.tipo === 'trabajo' && (
              <button class="intervalos-amrap" onClick={() => { setRondasAmrap(rondasAmrap + 1); vibrarCorto(40); }} aria-label={`Sumar una ronda. Llevas ${rondasAmrap}`}>
                <span class="num">{rondasAmrap}</span><span>+1 ronda</span>
              </button>
            )}
          </div>
          <div class="intervalos-controles">
            <button class="btn btn-grande btn-blanco" onClick={alternarPausa} aria-label={pausa ? 'Seguir' : 'Pausar'}><Icono n={pausa ? 'play' : 'pausa'} /> {pausa ? 'Seguir' : 'Pausa'}</button>
            <button class="btn btn-grande plano btn-sobre" onClick={saltar} aria-label="Saltar a la siguiente fase"><Icono n="derecha" /> Saltar</button>
          </div>
          <div class="intervalos-barra" role="progressbar" aria-label="Avance total" aria-valuemin="0" aria-valuemax={Math.round(total)} aria-valuenow={Math.round(Math.min(t, total))}>
            <span style={{ width: `${Math.min(100, (t / total) * 100)}%` }} />
          </div>
        </>
      )}
    </div>
  );
}
