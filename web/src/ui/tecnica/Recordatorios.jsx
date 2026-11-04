// v0.59 (14, migración 037): los recordatorios de técnica. El coach fija, de una corrección, un «Recuerda: …» (hasta 140
// letras, con el momento del vídeo si quiere) para ese atleta y ese ejercicio: como mucho 3 activos. El atleta lo ve en su
// sesión, en la tarjeta del ejercicio, con un enlace al momento corregido; «Entendido» lo pliega ese día (solo en su móvil).
import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, usePreferencia } from '../comunes.jsx';
import { reproductorDe, textoMomento } from '../Video.jsx';
import { enlaceVideo } from '../../logica/tecnica.js';
import { MAX_RECORDATORIOS, MAX_TEXTO_RECORDATORIO, limpiarTextoRecordatorio, claveEntendido } from '../../logica/correccion.js';
import { hoyISO, fmtCorta } from '../../logica/fechas.js';

// ---------------------------------------------------------------- el atleta, en su sesión
function UnRecuerda({ r }) {
  const [entendido, setEntendido] = usePreferencia(claveEntendido(r.id, hoyISO()), false);
  const enlace = r.archivo_id ? enlaceVideo(r.archivo_id, r.segundo != null ? Number(r.segundo) : null) : null;
  if (entendido) {
    return (
      <button type="button" class="recuerda plegado btn-texto mini" aria-expanded="false" onClick={() => setEntendido(false)}>
        <Icono n="chincheta" /> Recordatorio de tu coach
      </button>
    );
  }
  return (
    <div class="recuerda" role="note">
      <span class="recuerda-texto peq"><Icono n="chincheta" /> <b>Recuerda:</b> {r.texto}</span>
      <span class="recuerda-acciones">
        {enlace && <a class="btn btn-peq" href={enlace}><Icono n="video" /> {r.segundo != null ? `Ver el momento (${textoMomento(Number(r.segundo), true)})` : 'Ver el vídeo'}</a>}
        <button type="button" class="btn btn-peq plano" onClick={() => setEntendido(true)}>Entendido</button>
      </span>
    </div>
  );
}
export function RecuerdaEjercicio({ recordatorios = [] }) {
  if (!recordatorios.length) return null;
  return <div class="recuerdas pila-xs">{recordatorios.map((r) => <UnRecuerda key={r.id} r={r} />)}</div>;
}

// ---------------------------------------------------------------- el coach, en la corrección
// Los activos de ese atleta y ejercicio (cambiarlos o quitarlos), los ✗ del último vídeo corregido para fijarlos de un
// toque y uno a mano (con el momento en que está el vídeo, si se quiere)
export function RecordatoriosCoach({ video, ejercicio, nombreAtleta = 'Atleta', puntosMal = [], alCambiar }) {
  const { api, aviso } = useApp();
  const ej = ejercicio || null;
  const con037 = useCarga(() => api.video037().catch(() => false), []);
  const lista = useCarga(() => (ej?.id && con037.datos ? api.recordatoriosCoach(video.atleta_id, ej.id) : Promise.resolve([])), [video.atleta_id, ej?.id, con037.datos]);
  const [texto, setTexto] = useState('');
  const [conMomento, setConMomento] = useState(true);
  const [editando, setEditando] = useState(null); // { id, texto }
  const [ocupado, setOcupado] = useState(false);
  const primer = String(nombreAtleta || 'Atleta').split(' ')[0];
  if (!ej?.id || con037.cargando) return null;
  if (con037.datos === false) return <p class="mini terciario">Los recordatorios en su sesión: disponible tras la migración 037.</p>;
  const activos = (lista.datos || []).filter((r) => r.activo);
  const inactivos = (lista.datos || []).filter((r) => !r.activo).slice(0, 3);
  const lleno = activos.length >= MAX_RECORDATORIOS;
  const ya = new Set(activos.map((r) => r.texto.toLowerCase()));
  const sugeridos = puntosMal.filter((p) => !ya.has(limpiarTextoRecordatorio(p.t).toLowerCase()));
  const hacer = async (fn, ok) => {
    if (ocupado) return;
    setOcupado(true);
    try { await fn(); if (ok) aviso(ok); await lista.recargar(true); alCambiar?.(); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  const fijar = (t, segundo) => hacer(() => api.fijarRecordatorio({ atletaId: video.atleta_id, ejercicioId: ej.id, texto: t, archivoId: video.id, segundo }), `Fijado: ${primer} lo verá en su sesión`);
  const ahora = () => Math.round((reproductorDe(video.id)?.ahora() || 0) * 10) / 10;
  return (
    <section class="campo recordatorios-coach" aria-label="Recordatorios en su sesión">
      <span class="etq">Recordatorios en su sesión ({activos.length} de {MAX_RECORDATORIOS})</span>
      {activos.length > 0 && (
        <ul class="lista-recordatorios">
          {activos.map((r) => (
            <li key={r.id} class="recordatorio-fila">
              {editando?.id === r.id ? (
                <span class="fila-envolver">
                  <input class="entrada" aria-label="Texto del recordatorio" maxLength={MAX_TEXTO_RECORDATORIO} value={editando.texto} onInput={(e) => setEditando({ ...editando, texto: e.currentTarget.value })} />
                  <button type="button" class="btn btn-peq btn-primario" disabled={ocupado || !editando.texto.trim()} onClick={() => hacer(async () => { await api.editarRecordatorio(r.id, { texto: editando.texto }); setEditando(null); }, 'Recordatorio cambiado')}>Guardar</button>
                  <button type="button" class="btn btn-peq plano" onClick={() => setEditando(null)}>Cancelar</button>
                </span>
              ) : (
                <>
                  <span class="peq"><Icono n="chincheta" /> {r.texto}{r.segundo != null ? <span class="terciario num"> ({textoMomento(Number(r.segundo), true)})</span> : null}</span>
                  <span class="fila-envolver">
                    <button type="button" class="btn-texto mini" onClick={() => setEditando({ id: r.id, texto: r.texto })} aria-label={`Cambiar «${r.texto}»`}><Icono n="editar" /> Cambiar</button>
                    <button type="button" class="btn-texto mini" disabled={ocupado} onClick={() => hacer(() => api.editarRecordatorio(r.id, { activo: false }), 'Recordatorio quitado de su sesión')} aria-label={`Quitar «${r.texto}»`}><Icono n="cerrar" /> Quitar</button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {!lleno && sugeridos.length > 0 && (
        <div class="fila-envolver recordatorio-sugeridos" role="group" aria-label="Fijar lo marcado a corregir">
          {sugeridos.slice(0, 4).map((p, i) => (
            <button key={i} type="button" class="btn btn-peq" disabled={ocupado} onClick={() => fijar(p.t, Number.isFinite(p.s) ? p.s : null)} aria-label={`Fijar como recordatorio: ${p.t}`}>
              <Icono n="chincheta" /> {limpiarTextoRecordatorio(p.t).length > 48 ? `${limpiarTextoRecordatorio(p.t).slice(0, 46)}…` : limpiarTextoRecordatorio(p.t)}
            </button>
          ))}
        </div>
      )}
      {!lleno ? (
        <div class="pila-xs">
          <div class="fila recordatorio-nuevo" style="gap:8px">
            <input class="entrada" aria-label="Nuevo recordatorio" placeholder="Recuerda: rodillas hacia fuera al bajar" maxLength={MAX_TEXTO_RECORDATORIO} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} />
            <button type="button" class="btn btn-peq btn-primario" disabled={ocupado || !texto.trim()} onClick={() => fijar(texto, conMomento ? ahora() : null).then(() => setTexto(''))}>Fijar como recordatorio</button>
          </div>
          <label class="casilla mini"><input type="checkbox" checked={conMomento} onChange={(e) => setConMomento(e.currentTarget.checked)} /><span>Con el momento en que está el vídeo (enlace a ese punto)</span></label>
        </div>
      ) : <span class="ayuda">Ya tiene {MAX_RECORDATORIOS} activos en {ej.nombre}: quita uno para fijar otro.</span>}
      {inactivos.length > 0 && !lleno && (
        <span class="ayuda">Quitados: {inactivos.map((r) => (
          <button key={r.id} type="button" class="btn-texto mini" disabled={ocupado} onClick={() => hacer(() => api.editarRecordatorio(r.id, { activo: true }), 'Recordatorio otra vez en su sesión')} aria-label={`Volver a poner «${r.texto}»`}>{r.texto.length > 30 ? `${r.texto.slice(0, 28)}…` : r.texto}</button>
        ))}</span>
      )}
      <span class="ayuda">{primer} los ve en la tarjeta de {ej.nombre} de su sesión, con un enlace a este momento.</span>
    </section>
  );
}

// En su ficha (vídeos): los activos de ese atleta, por ejercicio
export function RecordatoriosAtleta({ atletaId, ejercicios = {} }) {
  const { api, aviso } = useApp();
  const lista = useCarga(() => api.recordatoriosCoach(atletaId), [atletaId]);
  const activos = (lista.datos || []).filter((r) => r.activo);
  if (!activos.length) return null;
  const quitar = async (r) => { try { await api.editarRecordatorio(r.id, { activo: false }); aviso('Recordatorio quitado de su sesión'); await lista.recargar(true); } catch (e) { aviso(e.message, 'error'); } };
  return (
    <section class="panel panel-pad pila-s recordatorios-ficha" aria-label="Recordatorios de técnica activos">
      <h3 class="peq">Recordatorios de técnica activos</h3>
      <ul class="lista-recordatorios">
        {activos.map((r) => (
          <li key={r.id} class="recordatorio-fila">
            <span class="peq"><b>{ejercicios[r.ejercicio_id]?.nombre || 'Ejercicio'}:</b> {r.texto} <span class="terciario mini">desde el {fmtCorta(String(r.creado_en || '').slice(0, 10))}</span></span>
            <button type="button" class="btn-texto mini" onClick={() => quitar(r)} aria-label={`Quitar «${r.texto}»`}><Icono n="cerrar" /> Quitar</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
