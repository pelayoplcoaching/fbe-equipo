import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, Siluetas, Vacio, Cargando } from './comunes.jsx';
import { Hilo } from './Hilo.jsx';
import { VerArchivo, CompararVideos, SubirArchivo } from './Archivos.jsx';
import { CompararFotos } from './CompararFotos.jsx';
import { NuevaFoto, POSES } from './atleta/CamaraGuiada.jsx';
import { mmssCorto } from './Chat.jsx';
import { fmtCorta, fmtConDia } from '../logica/fechas.js';

const NOMBRE_POSE = Object.fromEntries(POSES);
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// El diario de entrenamiento (v0.18): todos los vídeos y fotos de un atleta, por meses, en cuadrícula con
// miniatura. Sustituye a lo que antes iba a Instagram: se queda aquí, privado, con la corrección del coach en
// cada uno. El atleta sube desde aquí (sin pasar por una sesión), destaca los que quiere volver a ver y compara.
// esCoach: la misma pantalla en la ficha, con «Marcar revisado».
export function Diario({ atletaId, nombreAtleta = 'Atleta', esCoach = false, salud = true, alCambiar }) {
  const { api, aviso } = useApp();
  const datos = useCarga(() => api.diario(atletaId), [atletaId]);
  const [filtro, setFiltro] = useState('todo'); // todo | videos | fotos | destacados | <ejercicioId>
  const [abierto, setAbierto] = useState(null);
  const [subir, setSubir] = useState(false);
  const [nuevaFoto, setNuevaFoto] = useState(false);
  const [comparar, setComparar] = useState(null); // 'videos' | 'fotos'
  const lista = datos.datos || [];
  const recargar = () => { datos.recargar(true); alCambiar?.(); };
  const videos = lista.filter((a) => a.tipo === 'video_tecnica');
  const fotos = lista.filter((a) => a.tipo === 'foto_progreso');
  const ejercicios = [...new Map(lista.filter((a) => a.ejercicio).map((a) => [a.ejercicio.id, a.ejercicio])).values()].sort((x, y) => x.nombre.localeCompare(y.nombre));
  const visibles = lista.filter((a) => filtro === 'todo' || (filtro === 'videos' && a.tipo === 'video_tecnica') || (filtro === 'fotos' && a.tipo === 'foto_progreso')
    || (filtro === 'destacados' && a.destacado) || a.ejercicio?.id === filtro);
  // Por meses, del más reciente al más antiguo
  const meses = [];
  for (const a of visibles) {
    const clave = a.fecha.slice(0, 7);
    const m = meses[meses.length - 1];
    if (m && m.clave === clave) m.items.push(a); else meses.push({ clave, titulo: `${MESES[Number(a.fecha.slice(5, 7)) - 1]} de ${a.fecha.slice(0, 4)}`, items: [a] });
  }
  const nombreDe = (v) => v.ejercicio?.nombre || (v.tipo === 'foto_progreso' ? 'Foto' : 'Vídeo');

  return (
    <section class="seccion diario" aria-label="Diario de entrenamiento">
      <div class="seccion-cab">
        <h2>{esCoach ? 'Su diario' : 'Tu diario'}</h2>
        <span class="peq terciario num">{videos.length} {videos.length === 1 ? 'vídeo' : 'vídeos'}{fotos.length ? `, ${fotos.length} ${fotos.length === 1 ? 'foto' : 'fotos'}` : ''}</span>
      </div>
      <div class="diario-acciones">
        {!esCoach && <button class="btn btn-primario btn-peq" onClick={() => setSubir(true)}><Icono n="video" /> Subir vídeo</button>}
        {!esCoach && salud && <button class="btn btn-peq" onClick={() => setNuevaFoto(true)}><Icono n="camara" /> Foto de progreso</button>}
        {videos.length >= 2 && <button class="btn btn-peq" onClick={() => setComparar('videos')}><Icono n="duplicar" /> Comparar dos</button>}
        {fotos.length >= 2 && (esCoach || salud) && <button class="btn btn-peq" onClick={() => setComparar('fotos')}><Icono n="imagen" /> Antes y después</button>}
      </div>
      {lista.length > 0 && (
        <div class="selector-chips" role="group" aria-label="Filtrar el diario">
          {[['todo', 'Todo'], ['videos', 'Vídeos'], ['fotos', 'Fotos'], ['destacados', 'Destacados']].map(([v, t]) => (
            (v !== 'fotos' || fotos.length > 0) && (v !== 'destacados' || lista.some((a) => a.destacado)) && (v !== 'videos' || videos.length > 0) &&
            <button key={v} aria-pressed={filtro === v ? 'true' : 'false'} onClick={() => setFiltro(v)}>{t}</button>
          ))}
          {ejercicios.map((e) => <button key={e.id} aria-pressed={filtro === e.id ? 'true' : 'false'} onClick={() => setFiltro(e.id)}>{e.nombre}</button>)}
        </div>
      )}
      {datos.cargando && !datos.datos ? <Siluetas forma="galeria" n={6} texto="Cargando el diario" /> : !lista.length ? (
        <div class="panel"><Vacio icono="video" titulo={esCoach ? 'Su diario está vacío' : 'Tu diario está vacío'}>
          {esCoach ? 'Cuando suba un vídeo (desde una sesión, el chat o su diario) o una foto de progreso, aparecerá aquí.'
            : 'Graba una serie y súbela: se queda aquí, privada, y tu coach te la corrige encima. También puedes mandarla desde una sesión o desde el chat.'}
        </Vacio></div>
      ) : !visibles.length ? <p class="peq secundario">Nada con ese filtro.</p> : meses.map((m) => (
        <div class="diario-mes" key={m.clave}>
          <h3 class="mes-etq">{m.titulo}</h3>
          <div class="diario-rejilla">
            {m.items.map((a) => <Miniatura key={a.id} a={a} nombre={nombreDe(a)} alAbrir={() => setAbierto(a)} />)}
          </div>
        </div>
      ))}
      {!esCoach && !!lista.length && <p class="mini terciario">Solo lo veis tú y tu coach. Para que el diario no pese, graba solo la serie (unos 30 segundos).</p>}

      {subir && (
        <Hoja titulo="Subir un vídeo" alCerrar={() => setSubir(false)}>
          <SubirVideoDiario atletaId={atletaId} alSubir={() => { setSubir(false); recargar(); }} />
        </Hoja>
      )}
      {nuevaFoto && <NuevaFoto fotos={fotos} alCerrar={() => setNuevaFoto(false)} alSubir={() => { setNuevaFoto(false); recargar(); }} />}
      {comparar === 'videos' && <CompararVideos videos={videos} nombreDe={nombreDe} alCerrar={() => setComparar(null)} />}
      {comparar === 'fotos' && <CompararFotos fotos={fotos} alCerrar={() => setComparar(null)} />}
      {abierto && (
        <DetalleArchivo a={lista.find((x) => x.id === abierto.id) || abierto} atletaId={atletaId} nombreAtleta={nombreAtleta} esCoach={esCoach} nombre={nombreDe(abierto)}
          alCerrar={() => setAbierto(null)} alCambiar={recargar}
          alBorrar={async () => { try { await api.borrarArchivo(abierto); aviso(abierto.tipo === 'foto_progreso' ? 'Foto borrada' : 'Vídeo borrado'); setAbierto(null); recargar(); } catch (e) { aviso(e.message, 'error'); } }} />
      )}
    </section>
  );
}

// Una casilla de la cuadrícula: la miniatura (o el primer fotograma), la duración, la estrella y el estado
function Miniatura({ a, nombre, alAbrir }) {
  const { api } = useApp();
  const [url, setUrl] = useState(null);
  const [sinPoster, setSinPoster] = useState(false);
  const esFoto = a.tipo === 'foto_progreso';
  const conPoster = !!a.poster_ruta && !sinPoster;
  useEffect(() => {
    let vivo = true;
    setUrl(null);
    // Si la miniatura no carga (no llegó a subirse), el propio vídeo: el navegador enseña su primer fotograma
    api.urlArchivo(conPoster ? a.poster_ruta : a.ruta).then((u) => vivo && setUrl(u)).catch(() => { if (vivo && conPoster) setSinPoster(true); });
    return () => { vivo = false; };
  }, [a.ruta, a.poster_ruta, conPoster]);
  return (
    <button class={`diario-item ${a.destacado ? 'destacado' : ''}`} onClick={alAbrir} aria-label={`${nombre}, ${fmtConDia(a.fecha)}${a.destacado ? ', destacado' : ''}${a.respondido ? ', con respuesta del coach' : ''}`}>
      <span class="diario-medio">
        {!url ? <span class="medio-chat-hueco" /> : esFoto || conPoster ? <img src={url} alt="" loading="lazy" onError={() => conPoster && setSinPoster(true)} /> : <video src={url} muted playsInline preload="metadata" />}
        {!esFoto && <span class="medio-chat-play" aria-hidden="true"><Icono n="play" />{a.duracion_seg ? <span class="num">{mmssCorto(a.duracion_seg)}</span> : null}</span>}
        {a.destacado && <span class="diario-estrella" aria-hidden="true"><Icono n="libre" /></span>}
        {a.respondido && <span class="diario-coach" aria-hidden="true"><Icono n="mensaje" /></span>}
      </span>
      <span class="diario-pie"><span class="diario-nombre">{nombre}{esFoto && a.pose ? ` · ${NOMBRE_POSE[a.pose]}` : ''}</span><span class="mini terciario">{fmtCorta(a.fecha)}</span></span>
    </button>
  );
}

// El vídeo o la foto a lo grande, con su pie, su ejercicio, destacar, la conversación y borrar
function DetalleArchivo({ a, atletaId, nombreAtleta, esCoach, nombre, alCerrar, alCambiar, alBorrar }) {
  const { api, aviso } = useApp();
  const [editar, setEditar] = useState(false);
  const [pie, setPie] = useState(a.nota_atleta || '');
  const [confirmar, setConfirmar] = useState(false);
  const esFoto = a.tipo === 'foto_progreso';
  const destacar = async () => { try { await api.editarArchivo(a.id, { destacado: !a.destacado }); alCambiar(); } catch (e) { aviso(e.message, 'error'); } };
  const guardarPie = async () => { try { await api.editarArchivo(a.id, { nota_atleta: pie.trim() || null }); setEditar(false); alCambiar(); } catch (e) { aviso(e.message, 'error'); } };
  return (
    <Hoja titulo={`${nombre}, ${fmtConDia(a.fecha)}`} alCerrar={alCerrar} ancho={720}>
      <VerArchivo archivo={a} />
      <div class="fila-envolver">
        <button class={`btn btn-peq ${a.destacado ? 'btn-primario' : ''}`} aria-pressed={a.destacado ? 'true' : 'false'} onClick={destacar}><Icono n="libre" /> {a.destacado ? 'Destacado' : 'Destacar'}</button>
        {!esCoach && <button class="btn btn-peq" onClick={() => setEditar(!editar)}><Icono n="editar" /> {a.nota_atleta ? 'Cambiar el pie' : 'Poner un pie'}</button>}
        {a.revisado_en ? <span class="chip ok"><Icono n="hecho" />{esCoach ? 'Revisado' : 'Revisado por tu coach'}</span> : !esFoto && <span class="chip">{esCoach ? 'Por revisar' : 'Pendiente de tu coach'}</span>}
        {a.duracion_seg ? <span class="chip num">{mmssCorto(a.duracion_seg)}</span> : null}
      </div>
      {editar ? (
        <div class="fila" style="gap:8px;align-items:flex-end">
          <textarea class="area" rows={2} aria-label="Pie" maxLength={500} value={pie} onInput={(e) => setPie(e.currentTarget.value)} placeholder="Qué querías enseñar, cómo te sentiste…" />
          <button class="btn btn-primario" onClick={guardarPie}>Guardar</button>
        </div>
      ) : a.nota_atleta && <p class={esCoach ? 'cita' : 'peq secundario'}>{esCoach ? `«${a.nota_atleta}»` : a.nota_atleta}</p>}
      {!esFoto || esCoach ? (
        <Hilo atletaId={atletaId} archivoId={a.id} nombreAtleta={nombreAtleta} alCambiar={alCambiar}
          placeholder={esCoach ? 'Qué corregir, qué está bien…' : undefined} vacio={esCoach ? 'Sin comentarios todavía.' : 'Tu coach te contestará aquí.'} />
      ) : null}
      <div class="fila-envolver">
        {esCoach && !a.revisado_en && !esFoto && <button class="btn" onClick={async () => { try { await api.marcarRevisado('archivo', a.id); aviso('Revisado'); alCambiar(); } catch (e) { aviso(e.message, 'error'); } }}><Icono n="hecho" /> Marcar revisado</button>}
        {!confirmar ? <button class="btn btn-peligro plano" onClick={() => setConfirmar(true)}><Icono n="basura" /> Borrar</button>
          : <><span class="peq">¿Seguro? No se puede deshacer.</span><button class="btn btn-peq btn-peligro" onClick={alBorrar}>Sí, borrar</button><button class="btn btn-peq" onClick={() => setConfirmar(false)}>No</button></>}
      </div>
    </Hoja>
  );
}

// Subir un vídeo al diario sin pasar por una sesión: con su ejercicio (opcional) y su pie
function SubirVideoDiario({ atletaId, alSubir }) {
  const { api } = useApp();
  const biblioteca = useCarga(() => api.biblioteca().catch(() => []), []);
  const [ejercicioId, setEjercicioId] = useState('');
  const [buscar, setBuscar] = useState('');
  const lista = (biblioteca.datos || []).filter((e) => !buscar.trim() || e.nombre.toLowerCase().includes(buscar.trim().toLowerCase())).slice(0, 40);
  const elegido = (biblioteca.datos || []).find((e) => e.id === ejercicioId);
  return (
    <div class="pila">
      <p class="peq secundario">Graba solo la serie (unos 30 segundos), de lado o de frente según el ejercicio, con la barra entera en el encuadre. Tu coach lo verá en su bandeja y te contesta encima del vídeo.</p>
      <div class="campo">
        <label for="dv-ej">Ejercicio (opcional)</label>
        {elegido ? <div class="fila" style="gap:8px"><span class="chip morado">{elegido.nombre}</span><button class="btn-texto mini" onClick={() => setEjercicioId('')}>Cambiar</button></div> : (
          <>
            <input id="dv-ej" class="entrada" placeholder="Busca el ejercicio…" value={buscar} onInput={(e) => setBuscar(e.currentTarget.value)} />
            {buscar.trim() && (biblioteca.cargando ? <Cargando /> : (
              <div class="lista-elegir">{lista.map((e) => <button key={e.id} onClick={() => { setEjercicioId(e.id); setBuscar(''); }}>{e.nombre}</button>)}{!lista.length && <p class="panel-pad peq terciario">Nada con ese nombre.</p>}</div>
            ))}
          </>
        )}
      </div>
      <SubirArchivo atletaId={atletaId} tipo="video_tecnica" ejercicioId={ejercicioId || null} titulo="Elegir o grabar el vídeo" etiqueta="Elegir o grabar el vídeo" clase="btn btn-primario" alSubir={alSubir} />
    </div>
  );
}

export { useRef };
