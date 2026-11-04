// v0.59 (6, migración 037): los vídeos modelo del coach de cada ejercicio (su demostración: como mucho 6, cada uno con su
// ángulo). Los sube o los graba él; sus atletas los ven («Ver el vídeo modelo» en la sesión y en la ficha del ejercicio) y
// se comparan con sus vídeos, lado a lado o superpuestos. Borrar uno pone sus archivos en la cola de Storage.
import { useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, Cargando } from '../comunes.jsx';
import { Reproductor } from '../Video.jsx';
import { capturarPoster } from '../Archivos.jsx';
import { CamaraVideo, puedeGrabarVideo } from './CamaraVideo.jsx';

export const ANGULOS_MODELO = ['De lado', 'De frente', 'A 45°', 'Desde atrás'];
const nombreModelo = (m) => `Vídeo modelo${m.angulo ? ` (${m.angulo})` : ''}`;

// Un vídeo modelo en su reproductor (con su enlace firmado)
export function VerModelo({ modelo }) {
  const { api } = useApp();
  const u = useCarga(() => api.urlModelo(modelo), [modelo.ruta]);
  if (u.error) return <div class="nota peq">{u.error.message || 'No se puede cargar el vídeo modelo'}</div>;
  if (!u.datos) return <div class="medio medio-cargando"><Cargando texto="Cargando el vídeo modelo" /></div>;
  return <Reproductor src={u.datos} archivoId={`modelo:${modelo.id}`} serie={modelo.angulo || null} />;
}

// «Ver el vídeo modelo»: el botón y su hoja (si hay varios, se elige el ángulo)
export function BotonModelo({ ejercicio, modelos = [], clase = 'btn btn-peq' }) {
  const [abierto, setAbierto] = useState(false);
  const [i, setI] = useState(0);
  if (!modelos.length) return null;
  const m = modelos[Math.min(i, modelos.length - 1)];
  return (
    <>
      <button type="button" class={clase} onClick={() => setAbierto(true)} aria-haspopup="dialog"><Icono n="video" /> Ver el vídeo modelo</button>
      {abierto && (
        <Hoja titulo={`Modelo: ${ejercicio?.nombre || 'ejercicio'}`} alCerrar={() => setAbierto(false)} ancho={720}>
          {modelos.length > 1 && (
            <div class="segmentos" role="group" aria-label="Ángulo">
              {modelos.map((x, k) => <button key={x.id} type="button" aria-pressed={k === i ? 'true' : 'false'} onClick={() => setI(k)}>{x.angulo || `Vídeo ${k + 1}`}</button>)}
            </div>
          )}
          <VerModelo key={m.id} modelo={m} />
          <p class="mini terciario">La demostración de tu coach. Ponla a 0,25× y avanza fotograma a fotograma para fijarte en cada fase.</p>
        </Hoja>
      )}
    </>
  );
}

// Los vídeos modelo de un ejercicio (el coach): subir o grabar uno, su ángulo, borrarlo
export function GestionModelos({ ejercicio }) {
  const { api, aviso } = useApp();
  const con037 = useCarga(() => api.video037().catch(() => false), []);
  const lista = useCarga(() => (con037.datos ? api.videosModelo([ejercicio.id]) : Promise.resolve([])), [ejercicio.id, con037.datos]);
  const input = useRef(null);
  const [angulo, setAngulo] = useState(ANGULOS_MODELO[0]);
  const [subida, setSubida] = useState(null);
  const [camara, setCamara] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  if (con037.cargando) return null;
  if (con037.datos === false) return <p class="peq secundario">Los vídeos modelo: disponible tras la migración 037.</p>;
  const modelos = lista.datos || [];
  const lleno = modelos.length >= 6;
  async function subir(f) {
    if (!f || ocupado) return;
    setOcupado(true); setSubida(0);
    try {
      const cap = await capturarPoster(f).catch(() => null);
      await api.subirVideoModelo(ejercicio, f, { angulo, poster: cap?.poster || null, duracion_seg: cap?.duracion ?? null, alProgreso: setSubida });
      aviso('Vídeo modelo guardado: tus atletas ya lo ven');
      await lista.recargar(true);
    } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); setSubida(null); }
  }
  const borrar = async (m) => {
    setOcupado(true);
    try { await api.borrarVideoModelo(m); aviso('Vídeo modelo borrado'); setConfirmar(null); await lista.recargar(true); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  const cambiarAngulo = async (m, a) => { try { await api.editarVideoModelo(m.id, { angulo: a || null }); await lista.recargar(true); } catch (e) { aviso(e.message, 'error'); } };
  return (
    <div class="pila-s gestion-modelos">
      {lista.cargando && !lista.datos ? <Cargando /> : !modelos.length
        ? <p class="peq secundario">Aún no hay vídeo modelo de {ejercicio.nombre}. Sube o graba tu demostración: tus atletas la verán en su sesión y podrán compararse con ella.</p>
        : modelos.map((m) => (
          <div key={m.id} class="modelo-fila pila-xs">
            <VerModelo modelo={m} />
            <div class="fila-envolver">
              <select class="selector" aria-label={`Ángulo de ${nombreModelo(m).toLowerCase()}`} value={m.angulo || ''} onChange={(e) => cambiarAngulo(m, e.currentTarget.value)}>
                <option value="">Sin ángulo</option>
                {[...new Set([...ANGULOS_MODELO, ...(m.angulo ? [m.angulo] : [])])].map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              {confirmar === m.id
                ? <><span class="peq">¿Borrarlo?</span><button type="button" class="btn btn-peq btn-peligro" disabled={ocupado} onClick={() => borrar(m)}>Sí, borrar</button><button type="button" class="btn btn-peq" onClick={() => setConfirmar(null)}>No</button></>
                : <button type="button" class="btn btn-peq plano btn-peligro" onClick={() => setConfirmar(m.id)}><Icono n="basura" /> Borrar</button>}
            </div>
          </div>
        ))}
      {!lleno ? (
        <div class="campo">
          <span class="etq">Añadir un vídeo modelo</span>
          <div class="fila-envolver">
            <select class="selector" aria-label="Ángulo del vídeo nuevo" value={angulo} onChange={(e) => setAngulo(e.currentTarget.value)}>
              {ANGULOS_MODELO.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => input.current?.click()}><Icono n="imagen" /> Subir un vídeo</button>
            {puedeGrabarVideo() && <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => setCamara(true)}><Icono n="camara" /> Grabarlo</button>}
            <input ref={input} type="file" accept="video/*" hidden aria-label="Elegir el vídeo modelo" onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; subir(f); }} />
          </div>
          {subida != null && <div class="recorte-progreso subida-progreso" role="progressbar" aria-label="Subiendo el vídeo modelo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(subida * 100)}><span style={{ width: `${Math.round(subida * 100)}%` }} /></div>}
          <span class="ayuda">Como mucho 6 por ejercicio. Graba solo una o dos repeticiones, con el encuadre que pides a tus atletas.</span>
        </div>
      ) : <p class="mini terciario">Ya hay 6 vídeos modelo: borra uno para añadir otro.</p>}
      {camara && <CamaraVideo ejercicio={ejercicio} titulo={`Modelo: ${ejercicio.nombre}`} alCerrar={() => setCamara(false)} alGrabar={(f) => { setCamara(false); subir(f); }} />}
    </div>
  );
}
