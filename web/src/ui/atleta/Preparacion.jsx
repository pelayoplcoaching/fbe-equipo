import { useState } from 'preact/hooks';
import { Icono, Segmentos } from '../comunes.jsx';
import { PREGUNTAS, completa, consejoPreparacion, textoPreparacion } from '../../logica/preparacion.js';

// «¿Cómo llegas hoy?» antes de la primera serie: tres toques; al contestar la tercera se guarda sola.
const CORTO = { sueno: 'Sueño', energia: 'Energía', molestias: 'Molestias' };

// (belleza de la sesión) De una en una: se ve solo la pregunta que toca y, al contestarla, entra la siguiente; las ya
// contestadas quedan arriba en una línea y se pueden tocar para cambiarlas. Así ocupa un tercio y el primer ejercicio
// queda a la vista. Al corregir lo de antes (llega ya completo), las tres a la vez, como siempre.
export function Preparacion({ inicial = null, alGuardar, alSaltar }) {
  const [p, setP] = useState(inicial || {});
  const [guardando, setGuardando] = useState(false);
  const enteras = completa(inicial);
  const [cual, setCual] = useState(null);   // la que se está cambiando (si no, la primera sin contestar)
  const fijar = async (id, v) => {
    const n = { ...p, [id]: v };
    setP(n);
    setCual(null);
    if (completa(n) && !guardando) {
      setGuardando(true);
      // (quien guarda dice si algo falla; aquí no se deja ninguna promesa rechazada sin atender)
      try { await alGuardar(n); } catch { /* lo avisa quien guarda */ } finally { setGuardando(false); }
    }
  };
  const contestada = (q) => [1, 2, 3].includes(p[q.id]);
  const toca = enteras ? null : PREGUNTAS.find((q) => q.id === cual) || PREGUNTAS.find((q) => !contestada(q)) || PREGUNTAS[PREGUNTAS.length - 1];
  const hechas = enteras ? [] : PREGUNTAS.filter((q) => contestada(q) && q !== toca);
  return (
    <section class={`panel panel-pad preparacion${enteras ? '' : ' por-pasos'}`} aria-labelledby="prep-titulo">
      <div class="separa">
        <div class="pila-xs">
          <strong id="prep-titulo">¿Cómo llegas hoy?</strong>
          <span class="mini secundario">Tres toques. Tu coach lo verá con la sesión.</span>
        </div>
        {alSaltar && <button class="btn-texto" onClick={alSaltar}>Ahora no</button>}
      </div>
      {hechas.length > 0 && (
        <div class="prep-hechas">
          {hechas.map((q) => (
            <button type="button" key={q.id} class="chip prep-hecha" onClick={() => setCual(q.id)} aria-label={`${q.texto} ${q.opciones.find(([v]) => v === p[q.id])?.[1]}. Cambiar`}>
              <Icono n="hecho" /><span class="prep-de">{CORTO[q.id]}</span>{q.opciones.find(([v]) => v === p[q.id])?.[1]}
            </button>
          ))}
        </div>
      )}
      {(enteras ? PREGUNTAS : [toca]).map((q) => (
        <div class="prep-fila" key={q.id}>
          <span class="peq">{q.texto}{!enteras && <span class="mini terciario prep-paso"> · {PREGUNTAS.indexOf(q) + 1} de {PREGUNTAS.length}</span>}</span>
          <Segmentos opciones={q.opciones} valor={p[q.id] ?? null} etiqueta={q.texto} alCambiar={(v) => fijar(q.id, v ?? p[q.id])} />
        </div>
      ))}
    </section>
  );
}

// El consejo del día, arriba de la sesión
// En un día flojo o malo, el atleta elige si hoy sube la carga o va con los pesos de la última vez (v0.32)
export function ConsejoDia({ consejo, alCambiar, alQuitar, eleccion = null, alElegir }) {
  return (
    <div class={`consejo-dia ${consejo.nivel}`} role="status">
      <Icono n={consejo.nivel === 'bien' ? 'hecho' : 'alerta'} />
      <div class="pila-xs">
        <strong>{consejo.titulo}</strong>
        <span class="peq">{consejo.texto}</span>
        {consejo.frenar && alElegir && (
          <div class="pila-xs consejo-eleccion">
            <span class="peq"><b>¿Con qué pesos vas hoy?</b></span>
            <Segmentos etiqueta="Con qué pesos vas hoy" valor={eleccion === 'subir' ? 'subir' : 'igual'} alCambiar={alElegir}
              opciones={[['igual', 'Los de la semana pasada'], ['subir', 'Subir como toque']]} />
            <span class="mini secundario">{eleccion === 'subir' ? 'La app te propone la carga que toca, como cualquier día.' : 'La app te propone los pesos de la última vez, sin subir.'}</span>
          </div>
        )}
        <span class="fila" style="gap:16px">
          {alCambiar && <button class="btn-texto" onClick={alCambiar}>Cambiar cómo llego</button>}
          {alQuitar && <button class="btn-texto" onClick={alQuitar}>Borrarlo</button>}
        </span>
      </div>
    </div>
  );
}

// Para el coach: cómo llegó el atleta a la sesión
export function ChipLlegada({ preparacion, soloAvisos = false }) {
  const c = consejoPreparacion(preparacion);
  if (!c || (soloAvisos && c.nivel === 'bien')) return null;
  return (
    <span class="llegada"><span class={`chip ${c.nivel}`}>Llegó: {c.nivel === 'bien' ? 'bien' : c.nivel === 'flojo' ? 'día flojo' : 'día difícil'}</span>
      <span class="mini secundario">{textoPreparacion(preparacion)}</span></span>
  );
}
