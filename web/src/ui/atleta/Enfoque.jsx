import { useEffect, useRef, useState } from 'preact/hooks';
import { Icono, Disco, useApp } from '../comunes.jsx';
import { Placas } from '../Herramientas.jsx';
import { pauta, num, mmss, textoSerie, incrementoCarga, trasSerie, duracionEstimada, NOMBRE_PRIORIDAD, textoObjetivo } from '../../logica/calculos.js';
import { fmtCorta } from '../../logica/fechas.js';
import { aNumero, problemaSerie, prepararEjercicio, NotaFijada, Temporizador, useAhora, prepararAudio } from './sesion-comun.jsx';
import { Metronomo } from './Metronomo.jsx';
import { pesoAnterior } from '../../logica/nivel.js';
import { tempoDe } from '../../logica/tempo.js';

const RPE_ENFOQUE = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

// Modo enfoque: un ejercicio a pantalla completa, con cifras grandes y botones de +/−,
// pensado para usarlo entre series con el móvil en la mano (o en el banco).
export function Enfoque({
  ejercicios, hechas, records, etiquetas, actualDe, ultimasDe, foco, progresionAuto, notas, guardarNota,
  guardar, quitar, descanso, setDescanso, seId, setSeId, inicio, alSalir, alTerminar,
}) {
  const { aviso } = useApp();
  const e = ejercicios.find((x) => x.id === seId) || ejercicios[0];
  const idx = ejercicios.indexOf(e);
  const actual = actualDe(e);
  const cambiado = actual.id !== e.ejercicio.id;
  const ultimas = ultimasDe(e);
  const info = prepararEjercicio(e, cambiado ? actual : null, ultimas, foco, progresionAuto && !cambiado);
  const h = hechas[e.id] || {};
  const filas = Math.max(e.series, ...Object.keys(h).map(Number), 0);
  const pendiente = Array.from({ length: filas }, (_, i) => i + 1).find((k) => !h[k]);
  const [sel, setSel] = useState(null);           // serie elegida para corregir (o una de más)
  const numero = sel ?? pendiente ?? null;          // null = ejercicio completo
  const previa = numero ? h[numero] : null;
  const prop = numero ? (previa ? { kg: previa.kg, reps: previa.reps } : info.propuesta(numero, h)) : null;
  const fmtKg = (v) => (v == null ? '' : num(v, 2));
  const [kg, setKg] = useState('');
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState('');
  const [editandoNota, setEditandoNota] = useState(false);
  const [metro, setMetro] = useState(false);
  const tempo = tempoDe(e);
  const titulo = useRef(null);

  // Al cambiar de ejercicio o de serie, los campos vuelven a lo propuesto
  useEffect(() => {
    if (!numero) return;
    setKg(fmtKg(prop?.kg)); setReps(prop?.reps == null ? '' : String(prop.reps)); setRpe(previa?.rpe ?? '');
  }, [e.id, numero, previa?.id, previa?.registrada_en]);
  useEffect(() => { setSel(null); setEditandoNota(false); setMetro(false); titulo.current?.focus(); }, [e.id]);
  useEffect(() => {
    const tecla = (ev) => {
      if (metro || document.querySelector('.velo')) return; // con una hoja abierta (el metrónomo), las teclas son suyas
      if (ev.key === 'Escape') alSalir();
      if (/input|textarea|select/i.test(ev.target?.tagName || '')) return;
      if (ev.key === 'ArrowRight') ir(1);
      if (ev.key === 'ArrowLeft') ir(-1);
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });

  const ir = (d) => { const n = ejercicios[idx + d]; if (n) setSeId(n.id); };
  // Deslizar a los lados cambia de ejercicio
  const toque = useRef(null);
  const alTocar = (ev) => { const t = ev.touches[0]; toque.current = { x: t.clientX, y: t.clientY }; };
  const alSoltar = (ev) => {
    const ini = toque.current; toque.current = null;
    if (!ini || /input|textarea|select|button/i.test(ev.target?.tagName || '')) return;
    const t = ev.changedTouches[0], dx = t.clientX - ini.x, dy = t.clientY - ini.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) ir(dx < 0 ? 1 : -1);
  };

  const paso = incrementoCarga(info.ej.nombre, aNumero(kg) ?? prop?.kg ?? 0);
  const sumarKg = (d) => setKg(fmtKg(Math.max(0, Math.round(((aNumero(kg) ?? prop?.kg ?? 0) + d) * 100) / 100)));
  const sumarReps = (d) => setReps(String(Math.max(0, (aNumero(reps) ?? prop?.reps ?? 0) + d)));

  async function hecha() {
    const v = { kg: aNumero(kg) ?? prop?.kg ?? null, reps: aNumero(reps) ?? prop?.reps ?? null, rpe: rpe === '' ? '' : Number(rpe) };
    if (v.reps == null) return;
    const problema = problemaSerie(v);
    if (problema) { aviso(problema, 'error'); return; }
    const nueva = !previa;
    const cuenta = Object.fromEntries(ejercicios.map((x) => [x.id, Object.keys(hechas[x.id] || {}).length]));
    setSel(null);
    guardar(e, numero, v);
    if (!nueva) return;
    // Lo que toca después (en una superserie, el siguiente de la ronda)
    cuenta[e.id] += 1;
    const r = trasSerie(ejercicios, cuenta, e.id);
    if (r.siguiente && r.siguiente.id !== e.id) setSeId(r.siguiente.id);
  }

  // Lo que falta: series pendientes por ejercicio y minutos aproximados
  const pendientes = Object.fromEntries(ejercicios.map((x) => [x.id, Math.max(0, x.series - Object.keys(hechas[x.id] || {}).length)]));
  const quedanSeries = Object.values(pendientes).reduce((t, n) => t + n, 0);
  const minutos = duracionEstimada(ejercicios, pendientes);
  const siguienteEj = ejercicios.slice(idx + 1).find((x) => pendientes[x.id] > 0) || ejercicios.slice(0, idx).find((x) => pendientes[x.id] > 0);
  const pa = pauta(e);
  const etq = etiquetas[e.id];
  const record = numero && previa ? records[`${e.id}-${numero}`] : null;

  return (
    <div class="enfoque" role="dialog" aria-modal="true" aria-label="Modo enfoque">
      <header class="enfoque-cab">
        <button class="btn btn-icono plano" onClick={alSalir} aria-label="Salir del modo enfoque"><Icono n="cerrar" /></button>
        <div class="enfoque-donde">
          <span>Ejercicio {idx + 1} de {ejercicios.length}</span>
          <span class="terciario">{quedanSeries ? `${quedanSeries} ${quedanSeries === 1 ? 'serie' : 'series'}, unos ${Math.max(5, minutos)} min` : 'Todo hecho'}</span>
        </div>
        <Reloj inicio={inicio} />
      </header>
      <div class="enfoque-puntos" role="tablist" aria-label="Ejercicios">
        {ejercicios.map((x, i) => {
          const hechasX = Object.keys(hechas[x.id] || {}).length;
          return (
            <button key={x.id} role="tab" aria-selected={x.id === e.id ? 'true' : 'false'} aria-label={`${actualDe(x).nombre}: ${hechasX} de ${x.series}`}
              class={`punto ${hechasX >= x.series ? 'hecho' : hechasX ? 'empezado' : ''} ${x.id === e.id ? 'actual' : ''}`} onClick={() => setSeId(x.id)}>
              <span />
            </button>
          );
        })}
      </div>

      <div class="enfoque-cuerpo" onTouchStart={alTocar} onTouchEnd={alSoltar}>
        {descanso && <Temporizador {...descanso} alCambiar={setDescanso} clase="en-enfoque" />}

        <div class="enfoque-titulo">
          <div class="fila" style="gap:8px">
            <Disco prioridad={e.prioridad} titulo={NOMBRE_PRIORIDAD[e.prioridad]} />
            {etq && <span class="ss-etq">{etq}</span>}
            <span class="peq secundario">{pa.series}{pa.esfuerzo ? `, ${pa.esfuerzo}` : ''}{pa.carga && !cambiado ? `, ${pa.carga}` : ''}</span>
          </div>
          <h2 tabIndex={-1} ref={titulo}>{info.ej.nombre}</h2>
          {cambiado && <span class="cambiado">En lugar de {e.ejercicio.nombre}</span>}
          {e.variante && <span class="variante">{e.variante}</span>}
          {tempo && <button class="btn btn-peq chip-tempo" onClick={() => { prepararAudio(); setMetro(true); }} aria-label={`Metrónomo de tempo ${tempo.texto}`}><Icono n="altavoz" /> Tempo {tempo.texto}</button>}
        </div>

        <NotaFijada nota={notas[actual.id]} alGuardar={(t) => guardarNota(actual.id, t)} editando={editandoNota} alEditar={setEditandoNota} />
        {e.notas_coach && <p class="peq"><strong>Nota de tu coach: </strong>{e.notas_coach}</p>}

        <div class="enfoque-series" role="group" aria-label="Series">
          {Array.from({ length: filas }, (_, i) => i + 1).map((k) => (
            <button key={k} class={`chip-serie ${h[k] ? 'hecha' : ''} ${k === numero ? 'actual' : ''}`} onClick={() => setSel(k)}
              aria-label={h[k] ? `Serie ${k}: ${textoSerie(h[k])}. Tocar para corregirla` : `Serie ${k}, pendiente`} aria-pressed={k === numero ? 'true' : 'false'}>
              {h[k] ? <><Icono n="hecho" />{textoSerie({ ...h[k], rpe: null })}</> : info.top && k === 1 ? 'Top' : info.top && k <= e.series ? `Back-off ${k - 1}` : `Serie ${k}`}
            </button>
          ))}
          <button class="chip-serie mas" onClick={() => setSel(filas + 1)} aria-label="Añadir una serie más"><Icono n="mas" /></button>
        </div>

        {!numero ? (
          <div class="panel panel-pad pila-s enfoque-completo">
            <strong>{info.ej.nombre}: hecho</strong>
            {siguienteEj ? <button class="btn btn-primario btn-grande" onClick={() => setSeId(siguienteEj.id)}>Siguiente: {actualDe(siguienteEj).nombre}</button>
              : <button class="btn btn-primario btn-grande" onClick={alTerminar}><Icono n="hecho" /> Terminar sesión</button>}
          </div>
        ) : (
          <>
            <div class="enfoque-serie-n">{previa ? `Corrigiendo la serie ${numero}` : numero > e.series ? `Serie ${numero} (de más)`
              : info.top && numero === 1 ? 'Serie top: las back-off saldrán de lo que hagas aquí'
              : info.top ? `Back-off ${numero - 1} de ${e.series - 1}: ${num(e.backoff_pct)} % menos que tu top` : `Serie ${numero} de ${e.series}`}
              {!previa && prop?.objetivo && textoObjetivo(prop.objetivo) && <span class="enfoque-objetivo">: {textoObjetivo(prop.objetivo)}</span>}</div>
            <div class="paso-grande">
              <span class="etq">Kilos</span>
              <button type="button" onClick={() => sumarKg(-paso)} aria-label={`Quitar ${num(paso, 2)} kilos`}><Icono n="menos" /></button>
              <input inputMode="decimal" aria-label="Kilos" value={kg} placeholder={fmtKg(prop?.kg) || '0'} onInput={(ev) => setKg(ev.currentTarget.value)} onFocus={(ev) => ev.currentTarget.select()} />
              <button type="button" onClick={() => sumarKg(paso)} aria-label={`Añadir ${num(paso, 2)} kilos`}><Icono n="mas" /></button>
            </div>
            {info.prescripcion.carga_sugerida_kg == null && pesoAnterior(ultimas, numero) != null && (
              <div class="enfoque-anterior">La última vez, en esta serie: <b class="num">{num(pesoAnterior(ultimas, numero), 2)} kg</b></div>
            )}
            {info.barra && (aNumero(kg) ?? prop?.kg) > 20 && <div class="enfoque-discos"><Placas kg={aNumero(kg) ?? prop?.kg} /></div>}
            <div class="paso-grande">
              <span class="etq">Repeticiones</span>
              <button type="button" onClick={() => sumarReps(-1)} aria-label="Una repetición menos"><Icono n="menos" /></button>
              <input inputMode="numeric" aria-label="Repeticiones" value={reps} placeholder={prop?.reps == null ? '0' : String(prop.reps)} onInput={(ev) => setReps(ev.currentTarget.value)} onFocus={(ev) => ev.currentTarget.select()} />
              <button type="button" onClick={() => sumarReps(1)} aria-label="Una repetición más"><Icono n="mas" /></button>
            </div>
            <div class="rpe-fila" role="group" aria-label="RPE de la serie">
              <span class="etq">RPE</span>
              {RPE_ENFOQUE.map((x) => (
                <button key={x} type="button" aria-pressed={Number(rpe) === x ? 'true' : 'false'} onClick={() => setRpe(Number(rpe) === x ? '' : x)}>{num(x)}</button>
              ))}
            </div>
            <button class="btn btn-primario btn-hecha" onClick={hecha} aria-label={previa ? `Guardar los cambios de la serie ${numero}` : `Marcar la serie ${numero} como hecha`}>
              <Icono n="hecho" /> {previa ? 'Guardar cambios' : 'Hecha'}
            </button>
            {previa && (
              <div class="fila-envolver" style="justify-content:center">
                <button class="btn-texto" onClick={() => setSel(null)}>Volver a la serie que toca</button>
                <button class="btn-texto peligro" onClick={() => { quitar(e, numero); setSel(null); }}>Quitar la serie {numero}</button>
              </div>
            )}
            {record && <div class="record-serie"><Icono n="trofeo" /><span><strong>Récord</strong>: {record.texto}</span></div>}
          </>
        )}

        {info.sugerencia && !Object.keys(h).length && <p class={`sugerencia ${info.sugerencia.tipo}`}><Icono n={info.sugerencia.tipo === 'subir' ? 'arriba' : 'reiniciar'} />{info.sugerencia.texto}</p>}
        {ultimas && (
          <p class="ultima-vez">
            La última vez ({fmtCorta(ultimas.fecha)}): {ultimas.series.map((s, i) => <span key={i}>{i ? ', ' : ''}<span class="num">{textoSerie({ ...s, rpe: null })}</span>{s.rpe ? ` @${num(s.rpe)}` : ''}</span>)}
          </p>
        )}
        {!notas[actual.id] && !editandoNota && <button class="btn-texto" style="justify-self:start" onClick={() => setEditandoNota(true)}><Icono n="chincheta" /> Añadir una nota a este ejercicio</button>}
      </div>

      {metro && tempo && <Metronomo tempo={tempo} nombre={info.ej.nombre} reps={e.reps_max ?? e.reps_min ?? 8} alCerrar={() => setMetro(false)} />}
      <footer class="enfoque-pie">
        <button class="btn btn-icono" onClick={() => ir(-1)} disabled={idx === 0} aria-label="Ejercicio anterior"><Icono n="atras" /></button>
        <div class="enfoque-despues">
          {siguienteEj ? <><span class="terciario mini">Después</span><span>{etiquetas[siguienteEj.id] ? `${etiquetas[siguienteEj.id]} ` : ''}{actualDe(siguienteEj).nombre}</span></> : <span class="terciario">Último ejercicio</span>}
        </div>
        <button class="btn btn-icono" onClick={() => ir(1)} disabled={idx === ejercicios.length - 1} aria-label="Ejercicio siguiente"><Icono n="derecha" /></button>
      </footer>
    </div>
  );
}

function Reloj({ inicio }) {
  const ahora = useAhora(1000);
  return <span class="num enfoque-reloj" role="timer" aria-label="Tiempo de sesión">{inicio ? mmss((ahora - inicio) / 1000) : '0:00'}</span>;
}
