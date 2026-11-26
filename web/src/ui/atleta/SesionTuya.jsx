// (personalización 3, tanda 5) Que la sesión de hoy sea suya, siempre como consejo (la pauta del coach no cambia):
// «¿Cuánto tiempo tienes hoy?», su calentamiento, lo que hacía hace un año y recordar sus alternativas.
import { useState } from 'preact/hooks';
import { useApp, Icono } from '../comunes.jsx';
import { TIEMPOS, siVasJusto, textoVasJusto, calentamiento, haceUnAno } from '../../logica/sesion-tuya.js';
import { sesionCorta, textoCorta } from '../../logica/sesion-corta.js';
import { textoSerie } from '../../logica/calculos.js';
import { hoyISO } from '../../logica/fechas.js';
import { leerPreferencia, guardarPreferencia } from '../preferencias.js';
import { esPorSuCuenta, sinTuCoach } from '../../logica/esencial.js';
import { Imagen } from '../Imagen.jsx';

// (v0.259, D10, P: 'sesion_corta') corta: la sesión corta ya puesta ({ orden, superserie }) y alCorta(x | null) para
// ponerla o quitarla (solo quien va por su cuenta, con la clave encendida: si no, como siempre, solo un consejo)
export function TiempoHoy({ ejercicios, corta = null, alCorta = null }) {
  const { atleta } = useApp();
  const [min, setMin] = useState(null);
  const r = min ? siVasJusto(ejercicios, min) : null;
  const c = alCorta && !corta && min ? sesionCorta(ejercicios, min) : null;
  return (
    <section class="panel panel-pad tiempo-hoy" aria-labelledby="tiempo-hoy-t">
      <h2 id="tiempo-hoy-t" class="tiempo-hoy-t"><Imagen id="tiempo-hoy" clase="ico-ilu" tamanos="44px" alternativa={<Icono n="reloj" />} /> ¿Cuánto tiempo tienes hoy?</h2>
      <div class="segmentos" role="group" aria-label="Tiempo que tienes hoy">
        {TIEMPOS.map((m) => <button key={m} type="button" aria-pressed={min === m ? 'true' : 'false'} onClick={() => setMin(min === m ? null : m)}>{m} min</button>)}
      </div>
      {r && (
        <div class="pila-xs tiempo-hoy-r" aria-live="polite">
          <p class="peq">{sinTuCoach(textoVasJusto(r, min), atleta)}</p>
          {r.quitar.length > 0 && <ul class="tiempo-hoy-lista">{r.quitar.map((x) => <li key={`${x.id}-${x.que}`}><strong>{x.nombre}</strong>: {x.que}</li>)}</ul>}
          <p class="mini secundario">Es un consejo: tu sesión no cambia. Lo obligatorio, siempre.</p>
        </div>
      )}
      {alCorta && (c || corta) && (
        <div class="pila-xs tiempo-hoy-r" aria-live="polite">
          {corta ? <p class="peq"><strong>Hoy, tu sesión corta:</strong> los multiarticulares primero y el resto en superserie.</p> : <p class="peq">{textoCorta(c, min)}</p>}
          <span class="fila-envolver">
            {corta ? <button type="button" class="btn-texto" onClick={() => alCorta(null)}>Volver a la de tu plan</button>
              : <button type="button" class="btn btn-primario" onClick={() => alCorta({ orden: c.orden, superserie: c.superserie })}>Hacerlo así</button>}
          </span>
        </div>
      )}
    </section>
  );
}

export function Calentamiento({ ejercicios, zonas = [] }) {
  const { atleta } = useApp();
  const pasos = calentamiento(ejercicios, zonas);
  if (!pasos.length) return null;
  return (
    <details class="panel panel-pad calentamiento">
      <summary><Icono n="movilidad" /> Tu calentamiento (unos 5 min)<Icono n="abajo" class="plegable-flecha" /></summary>
      <Imagen id="calentamiento" clase="franja-ilu franja-hoja" tamanos="(min-width: 640px) 560px, 92vw" />
      <ol class="calentamiento-lista">{pasos.map((p) => <li key={p}>{p}</li>)}</ol>
      <p class="mini secundario">{esPorSuCuenta(atleta) ? 'Un consejo para llegar listo.' : 'Un consejo para llegar listo; si tu coach te ha puesto el suyo, manda el suyo.'}</p>
    </details>
  );
}

export function HaceUnAno({ ultimas }) {
  const h = haceUnAno(ultimas, hoyISO(), (s) => textoSerie({ ...s, rpe: null }));
  return h ? <p class="hace-un-ano"><Imagen id="hace-un-ano" clase="ico-ilu" tamanos="44px" alternativa={<Icono n="historial" />} /><span>{h.texto}</span></p> : null;
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
