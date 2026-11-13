// (personalización 3, tanda 5) Que la sesión de hoy sea suya, siempre como consejo (la pauta del coach no cambia):
// «¿Cuánto tiempo tienes hoy?», su calentamiento, lo que hacía hace un año y recordar sus alternativas.
import { useState } from 'preact/hooks';
import { useApp, Icono } from '../comunes.jsx';
import { TIEMPOS, siVasJusto, textoVasJusto, calentamiento, haceUnAno } from '../../logica/sesion-tuya.js';
import { textoSerie } from '../../logica/calculos.js';
import { hoyISO } from '../../logica/fechas.js';
import { leerPreferencia, guardarPreferencia } from '../preferencias.js';

export function TiempoHoy({ ejercicios }) {
  const [min, setMin] = useState(null);
  const r = min ? siVasJusto(ejercicios, min) : null;
  return (
    <section class="panel panel-pad tiempo-hoy" aria-labelledby="tiempo-hoy-t">
      <h3 id="tiempo-hoy-t" class="tiempo-hoy-t"><Icono n="reloj" /> ¿Cuánto tiempo tienes hoy?</h3>
      <div class="segmentos" role="group" aria-label="Tiempo que tienes hoy">
        {TIEMPOS.map((m) => <button key={m} type="button" aria-pressed={min === m ? 'true' : 'false'} onClick={() => setMin(min === m ? null : m)}>{m} min</button>)}
      </div>
      {r && (
        <div class="pila-xs tiempo-hoy-r" aria-live="polite">
          <p class="peq">{textoVasJusto(r, min)}</p>
          {r.quitar.length > 0 && <ul class="tiempo-hoy-lista">{r.quitar.map((x) => <li key={`${x.id}-${x.que}`}><strong>{x.nombre}</strong>: {x.que}</li>)}</ul>}
          <p class="mini secundario">Es un consejo: tu sesión no cambia. Lo obligatorio, siempre.</p>
        </div>
      )}
    </section>
  );
}

export function Calentamiento({ ejercicios, zonas = [] }) {
  const pasos = calentamiento(ejercicios, zonas);
  if (!pasos.length) return null;
  return (
    <details class="panel panel-pad calentamiento">
      <summary><Icono n="movilidad" /> Tu calentamiento (unos 5 min)<Icono n="abajo" class="plegable-flecha" /></summary>
      <ol class="calentamiento-lista">{pasos.map((p) => <li key={p}>{p}</li>)}</ol>
      <p class="mini secundario">Un consejo para llegar listo; si tu coach te ha puesto el suyo, manda el suyo.</p>
    </details>
  );
}

export function HaceUnAno({ ultimas }) {
  const h = haceUnAno(ultimas, hoyISO(), (s) => textoSerie({ ...s, rpe: null }));
  return h ? <p class="hace-un-ano"><Icono n="historial" /><span>{h.texto}</span></p> : null;
}

// Sus alternativas: lo que eligió la última vez en lugar del pautado
const claveAlt = (atletaId, ejId) => `fbe-alternativa-elegida:${atletaId}:${ejId}`;
export const leerAlternativa = (atletaId, ejId) => leerPreferencia(claveAlt(atletaId, ejId), null);
export function apuntarAlternativa(atletaId, ejId, altId) {
  if (!atletaId || !ejId) return;
  guardarPreferencia(claveAlt(atletaId, ejId), altId && altId !== ejId ? altId : null);
}
export function useAlternativaElegida(ejId) {
  const { atleta } = useApp();
  return atleta?.id ? leerAlternativa(atleta.id, ejId) : null;
}
