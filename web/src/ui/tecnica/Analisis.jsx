// v0.58: el análisis automático de un vídeo de técnica (experimental). Esta parte es pequeña y va con la app: el panel
// (seguir la barra, la velocidad, los puntos del cuerpo) se descarga solo al abrirlo, o al ver un análisis guardado; el
// modelo de los puntos del cuerpo, aún más tarde (al usarlo).
import { useEffect, useId, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Cargando } from '../comunes.jsx';

let modulo = null;
const cargarPanel = () => (modulo ||= import('./analisis/PanelAnalisis.jsx').catch((e) => { modulo = null; throw e; }));

export function AnalisisVideo({ video, esCoach = false, revision = null, alGuardado }) {
  const { api, atleta } = useApp();
  const guardado = revision?.analisis || null;
  const [abierto, setAbierto] = useState(false);
  const [M, setM] = useState(null);
  const [error, setError] = useState(null);
  const id = useId();
  const con036 = useCarga(() => (esCoach ? api.video036().catch(() => false) : Promise.resolve(false)), [esCoach]);
  const necesita = abierto || !!guardado;
  useEffect(() => {
    if (!necesita || M) return undefined;
    let vivo = true;
    cargarPanel().then((m) => vivo && setM(() => m)).catch(() => vivo && setError('No se ha podido cargar el análisis: comprueba la conexión y prueba otra vez.'));
    return () => { vivo = false; };
  }, [necesita]);
  // El atleta: lo guardado por su coach y, en su propio vídeo, analizar la barra en su móvil (sin guardarlo)
  const propio = !esCoach && atleta && atleta.id === video.atleta_id;
  if (!esCoach && !guardado && !propio) return null;
  return (
    <section class="analisis panel-pad pila-s" aria-labelledby={id}>
      <div class="separa analisis-cab">
        <h3 id={id}>{esCoach ? 'Análisis automático' : guardado ? 'El análisis de tu coach' : 'Analizar tu barra'}</h3>
        <span class="chip aviso experimental">Experimental</span>
      </div>
      {error && <p class="nota peq" role="alert">{error}</p>}
      {guardado && !abierto && (M ? <M.VerAnalisis video={video} analisis={guardado} /> : <Cargando texto="Cargando el análisis" />)}
      {abierto && (M ? <M.default video={video} esCoach={esCoach} guardado={guardado} con036={!!con036.datos} alGuardado={alGuardado} /> : <Cargando texto="Cargando el análisis" />)}
      {!abierto ? (
        <div class="fila-envolver">
          <button type="button" class={`btn btn-peq ${guardado ? '' : 'btn-primario'}`} aria-expanded="false" onClick={() => setAbierto(true)}>
            <Icono n="diana" /> {esCoach ? (guardado ? 'Analizar otra vez' : 'Analizar el vídeo') : 'Analizar la barra en tu móvil'}
          </button>
          {!guardado && <span class="mini terciario">{esCoach ? 'La trayectoria y la velocidad de la barra y los puntos del cuerpo, calculados en este dispositivo.' : 'La trayectoria y la velocidad de la barra, calculadas en tu móvil (no se guarda).'}</span>}
        </div>
      ) : (
        <button type="button" class="btn btn-peq plano analisis-cerrar" aria-expanded="true" onClick={() => setAbierto(false)}><Icono n="cerrar" /> Cerrar el análisis</button>
      )}
    </section>
  );
}
