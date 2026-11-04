// «Mi técnica» (v0.57), en Progreso: los vídeos de técnica del atleta por ejercicio, en una línea de tiempo (con los
// destacados y su estado), la gráfica de su nota de técnica en ese ejercicio y comparar dos cualesquiera.
// Y el vídeo de un aviso («Pelayo ha corregido tu vídeo»: #videos/<id>@<segundos>), abierto en ese momento.
// v0.58: y, si tu coach ha guardado el análisis de la barra, cómo evoluciona la velocidad (estimada) en ese ejercicio.
// v0.61: el perfil carga–velocidad con el 1RM estimado (16) y el informe de cada mes (17). También en la ficha del atleta,
// para el coach (esCoach: cambia la velocidad mínima de cada ejercicio y le manda el informe).
import { useEffect, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Grafica, Hoja, Cargando } from '../comunes.jsx';
import { CompararVideos } from '../Archivos.jsx';
import { DetalleArchivo } from '../Diario.jsx';
import { fmtCorta, fmtConDia } from '../../logica/fechas.js';
import { NOMBRE_PUNTUACION } from '../../logica/tecnica.js';
import { serieVelocidad, textoVel } from '../../logica/analisis.js';
import { PerfilVelocidad } from './PerfilVelocidad.jsx';
import { InformesMes } from './InformeMes.jsx';

export function MiTecnica({ atletaId, nombreAtleta, esCoach = false }) {
  const { api, aviso } = useApp();
  const datos = useCarga(() => api.miTecnica(atletaId).catch(() => []), [atletaId]);
  const [ej, setEj] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [elegidos, setElegidos] = useState([]);
  const [comparar, setComparar] = useState(false);
  useEffect(() => { const al = () => datos.recargar(true); window.addEventListener('fbe-video-repetido', al); return () => window.removeEventListener('fbe-video-repetido', al); }, []);
  const grupos = datos.datos || [];
  if (datos.cargando && !datos.datos) return null;
  if (!grupos.length) return null;
  const g = grupos.find((x) => x.id === ej) || grupos[0];
  const todos = grupos.flatMap((x) => x.videos);
  const elegir = (id) => setElegidos((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id].slice(-2)));
  const recargar = () => datos.recargar(true);
  const vistos = elegidos.map((id) => todos.find((v) => v.id === id)).filter(Boolean);
  return (
    <section class="seccion mi-tecnica" aria-labelledby="mi-tecnica-t">
      <div class="seccion-cab">
        <h2 id="mi-tecnica-t">{esCoach ? 'Su técnica' : 'Mi técnica'}</h2>
        <span class="peq terciario num">{todos.length} {todos.length === 1 ? 'vídeo' : 'vídeos'}</span>
      </div>
      {grupos.length > 1 && (
        <div class="selector-chips" role="group" aria-label="Ejercicio">
          {grupos.map((x) => <button key={x.id} aria-pressed={x.id === g.id ? 'true' : 'false'} onClick={() => { setEj(x.id); setElegidos([]); }}>{x.nombre} ({x.videos.length})</button>)}
        </div>
      )}
      <div class="panel panel-pad pila-s">
        <div class="separa"><strong>{g.nombre}</strong>{g.ultima != null && <span class="chip morado num">Última nota: {g.ultima}/5</span>}</div>
        {g.puntos.length > 1
          ? <Grafica puntos={g.puntos} dec={0} rangoMin={4} clave={`tecnica-${g.id}`} etiqueta={`${esCoach ? 'Su' : 'Tu'} nota de técnica en ${g.nombre}`} />
          : <p class="peq secundario">{g.puntos.length === 1
            ? (esCoach ? `Le has puesto ${g.puntos[0].y}/5 (${NOMBRE_PUNTUACION[g.puntos[0].y].toLowerCase()}) a su técnica. Con el siguiente vídeo corregido verás cómo evoluciona.`
              : `Tu coach le ha puesto ${g.puntos[0].y}/5 (${NOMBRE_PUNTUACION[g.puntos[0].y].toLowerCase()}) a tu técnica. Con el siguiente vídeo corregido verás cómo evoluciona.`)
            : esCoach ? 'Cuando pongas nota a la técnica de sus vídeos, verás aquí cómo evoluciona.' : 'Cuando tu coach ponga nota a la técnica de tus vídeos, verás aquí cómo evoluciona.'}</p>}
        <VelocidadEjercicio g={g} esCoach={esCoach} />
        {/* (revisión L4) con su clave: al cambiar de ejercicio, sin los datos del anterior mientras carga */}
        <PerfilVelocidad key={g.id} g={g} atletaId={atletaId} esCoach={esCoach} />
        <ol class="tecnica-linea">
          {g.videos.map((v) => (
            <li key={v.id} class={`tecnica-item ${v.destacado ? 'destacado' : ''}`}>
              <button type="button" class="tecnica-ver" onClick={() => setAbierto(v)}
                aria-label={`${g.nombre}, ${fmtConDia(v.fecha)}: ${v.estado?.texto || 'Enviado'}${v.revision?.puntuacion != null ? `, nota ${v.revision.puntuacion} de 5` : ''}${v.destacado ? ', destacado' : ''}`}>
                <span class="tecnica-fecha num">{fmtCorta(v.fecha)}</span>
                <span class="mini secundario">{v.estado?.texto || 'Enviado'}{v.serie?.texto ? ` · ${v.serie.texto}` : ''}{v.repite_de ? ' · repetición' : ''}</span>
                {v.revision?.puntuacion != null && <span class="chip num tecnica-nota" aria-hidden="true">{v.revision.puntuacion}/5</span>}
                {v.destacado && <span class="tecnica-estrella" aria-hidden="true"><Icono n="libre" /></span>}
              </button>
              <button type="button" class="btn btn-peq tecnica-elegir" aria-pressed={elegidos.includes(v.id) ? 'true' : 'false'} onClick={() => elegir(v.id)}
                aria-label={`Elegir para comparar: ${fmtCorta(v.fecha)}`}><Icono n="duplicar" /></button>
            </li>
          ))}
        </ol>
        {todos.length >= 2 && (
          <div class="fila-envolver">
            <button type="button" class="btn btn-peq btn-primario" disabled={vistos.length !== 2} onClick={() => setComparar(true)}><Icono n="duplicar" /> Comparar los dos</button>
            <span class="mini terciario" role="status">{vistos.length === 2 ? `${fmtCorta(vistos[0].fecha)} y ${fmtCorta(vistos[1].fecha)}` : 'Elige dos con su botón de comparar para verlos lado a lado o superpuestos.'}</span>
          </div>
        )}
      </div>
      <InformesMes videos={todos} atletaId={atletaId} nombreAtleta={nombreAtleta} esCoach={esCoach} />
      {comparar && vistos.length === 2 && <CompararVideos videos={vistos} nombreDe={(v) => v.ejercicio?.nombre || 'Vídeo'} inicialA={vistos[1].id} inicialB={vistos[0].id} alCerrar={() => setComparar(false)} />}
      {abierto && (
        <DetalleArchivo a={todos.find((x) => x.id === abierto.id) || abierto} lista={todos} atletaId={atletaId} nombreAtleta={nombreAtleta} nombre={abierto.ejercicio?.nombre || 'Vídeo'}
          alCerrar={() => setAbierto(null)} alCambiar={recargar}
          alBorrar={async () => { try { await api.borrarArchivo(abierto); aviso('Vídeo borrado'); setAbierto(null); recargar(); } catch (e) { aviso(e.message, 'error'); } }} />
      )}
    </section>
  );
}

// El vídeo de un aviso, en su momento (lo abre la app al tocar «Pelayo ha corregido tu vídeo»)
export function VideoEnlazado({ id, t, alCerrar }) {
  const { api, atleta, aviso } = useApp();
  const datos = useCarga(() => api.diario(atleta.id).catch(() => []), [atleta.id, id]);
  const lista = datos.datos || [];
  const v = lista.find((x) => x.id === id) || null;
  if (datos.cargando && !datos.datos) return <Hoja titulo="Tu vídeo" alCerrar={alCerrar}><Cargando texto="Cargando el vídeo" /></Hoja>;
  if (!v) return <Hoja titulo="Tu vídeo" alCerrar={alCerrar}><p class="peq secundario">Ese vídeo ya no está en tu diario.</p></Hoja>;
  return (
    <DetalleArchivo a={v} lista={lista} atletaId={atleta.id} nombreAtleta={atleta.nombre} nombre={v.ejercicio?.nombre || 'Vídeo'} irA={t}
      alCerrar={alCerrar} alCambiar={() => datos.recargar(true)}
      alBorrar={async () => { try { await api.borrarArchivo(v); aviso('Vídeo borrado'); alCerrar(); } catch (e) { aviso(e.message, 'error'); } }} />
  );
}

// La velocidad media de la mejor repetición de cada vídeo de ese ejercicio (del análisis que guardó tu coach)
function VelocidadEjercicio({ g, esCoach = false }) {
  const vel = serieVelocidad(g.videos);
  if (!vel.length) return null;
  return (
    <div class="pila-xs mi-tecnica-velocidad">
      <div class="separa"><span class="etq">Velocidad de la barra (estimada)</span><span class="chip aviso experimental">Experimental</span></div>
      {vel.length > 1
        ? <Grafica puntos={vel} unidad="m/s" dec={2} rangoMin={0.2} clave={`vel-${g.id}`} etiqueta={`Velocidad media de ${esCoach ? 'su' : 'tu'} mejor repetición en ${g.nombre}, estimada`} />
        : <p class="peq secundario">{esCoach ? 'Su' : 'Tu'} mejor repetición: {textoVel(vel[0].y)} de velocidad media en la subida. Con el siguiente vídeo analizado verás cómo evoluciona.</p>}
      <span class="mini terciario">Es una estimación a partir del vídeo (con un error de en torno al ±10–15 %): compárala entre vídeos grabados igual.</span>
    </div>
  );
}
