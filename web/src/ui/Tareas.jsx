import { useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, Paso, Segmentos, Cargando, Vacio, useUnaVez, cuando } from './comunes.jsx';
import { NuevaFoto } from './atleta/CamaraGuiada.jsx';
import { SubirArchivo, VerArchivo } from './Archivos.jsx';
import { TIPOS_TAREA, NOMBRE_TIPO_TAREA, ICONO_TAREA, PLANTILLAS_SUGERIDAS, cuandoTarea, estadoTarea, resumenTareas, MAX_RESPUESTA } from '../logica/tareas.js';
import { hoyISO, sumarDias, fmtConDia } from '../logica/fechas.js';

// ---------------------------------------------------------------- atleta
// Una tarea del coach: qué es, para cuándo y hacerla (con la cámara guiada, apuntando el peso, enviando el vídeo o
// marcándola hecha con una respuesta)
export function HojaTarea({ tarea, alCerrar, alCambiar, salud = true, darConsentimiento = null }) {
  const { api, atleta, aviso } = useApp();
  const t = tarea;
  const [respuesta, setRespuesta] = useState(t.respuesta || '');
  const [fotos, setFotos] = useState(null);
  const [kg, setKg] = useState(null);
  const [cintura, setCintura] = useState(null);
  const [ocupado, una] = useUnaVez();
  const baja = atleta.estado === 'baja';
  const hecha = !!t.hecha_en;
  const ejercicio = useCarga(() => (t.ejercicio_id ? api.ejerciciosPorIds([t.ejercicio_id]).then((l) => l[0] || null).catch(() => null) : Promise.resolve(null)), [t.ejercicio_id]);
  const pideSalud = (t.tipo === 'foto' || t.tipo === 'medida') && !salud;
  const completar = (archivoId = null) => una(async () => {
    try {
      await api.completarTarea(t.id, { respuesta, archivoId });
      aviso('Tarea hecha: tu coach ya lo ve');
      alCambiar?.(); alCerrar();
    } catch (e) { aviso(e.message, 'error'); }
  });
  const deshacer = () => una(async () => {
    try { await api.completarTarea(t.id, { hecha: false }); aviso('Tarea pendiente otra vez'); alCambiar?.(); alCerrar(); } catch (e) { aviso(e.message, 'error'); }
  });
  if (fotos) {
    return <NuevaFoto fotos={fotos} alCerrar={() => setFotos(null)} alSubir={(a) => { setFotos(null); completar(a?.id || null); }} />;
  }
  return (
    <Hoja titulo={t.titulo} alCerrar={alCerrar}>
      <div class="pila">
        <p class="tarea-tipo"><Icono n={ICONO_TAREA[t.tipo]} /><span><strong>{NOMBRE_TIPO_TAREA[t.tipo]}</strong>{ejercicio.datos ? `: ${ejercicio.datos.nombre}` : ''}. <span class="secundario">{hecha ? `Hecha ${cuando(t.hecha_en)}` : cuandoTarea(t)}</span></span></p>
        {t.detalle && <p class="nota-coach"><Icono n="mensaje" /><span><strong>Tu coach: </strong>{t.detalle}</span></p>}
        {hecha ? (
          <>
            {t.respuesta && <p class="cita">«{t.respuesta}»</p>}
            <p class="peq secundario">{t.revisada_en ? 'Tu coach ya la ha visto.' : 'Tu coach la verá en su bandeja.'}</p>
            {!t.revisada_en && !baja && <button class="btn" disabled={ocupado} onClick={deshacer}><Icono n="reiniciar" /> Deshacer (no la he hecho)</button>}
          </>
        ) : baja ? (
          <p class="peq secundario">Tu cuenta está de baja: puedes ver tus tareas, pero no marcarlas.</p>
        ) : t.fecha > hoyISO() ? (
          <p class="peq secundario">Es para el {fmtConDia(t.fecha)}: ese día te saldrá en «Tu día».</p>
        ) : pideSalud ? (
          <div class="pila-s">
            <p class="peq secundario">Las fotos, el peso y las medidas son datos de salud: para guardarlos hace falta tu consentimiento.</p>
            {darConsentimiento && <button class="btn btn-primario" onClick={darConsentimiento}>Dar mi consentimiento</button>}
          </div>
        ) : (
          <>
            {t.tipo === 'medida' && (
              <div class="rejilla-campos">
                <div class="campo"><label for="tarea-kg">Peso (kg)</label><Paso id="tarea-kg" valor={kg} paso={0.1} min={25} max={350} dec={1} etiqueta="peso en kilos" alCambiar={setKg} /></div>
                <div class="campo"><label for="tarea-cintura">Cintura (cm)</label><Paso id="tarea-cintura" valor={cintura} paso={0.5} min={30} max={250} dec={1} etiqueta="cintura en centímetros" alCambiar={setCintura} /></div>
              </div>
            )}
            <div class="campo">
              <label for="tarea-respuesta">{t.tipo === 'texto' ? 'Tu respuesta (opcional)' : 'Algo que contarle (opcional)'}</label>
              <textarea id="tarea-respuesta" class="area" rows={3} maxLength={MAX_RESPUESTA} value={respuesta} onInput={(e) => setRespuesta(e.currentTarget.value)} />
            </div>
            {t.tipo === 'foto' && <button class="btn btn-primario btn-grande" disabled={ocupado} onClick={async () => setFotos(await api.archivos(atleta.id, 'foto_progreso').catch(() => []))}><Icono n="camara" /> Hacer las fotos</button>}
            {t.tipo === 'video' && (
              <SubirArchivo atletaId={atleta.id} ejercicioId={t.ejercicio_id} titulo={`Vídeo: ${ejercicio.datos?.nombre || t.titulo}`} etiqueta="Grabar o elegir el vídeo" clase="btn btn-primario btn-grande"
                alSubir={(a) => (a?.id ? completar(a.id) : aviso('El vídeo se enviará solo cuando haya cobertura: marca la tarea cuando haya salido.'))} />
            )}
            {t.tipo === 'medida' && (
              <button class="btn btn-primario btn-grande" disabled={ocupado || (!kg && !cintura)} onClick={() => una(async () => {
                try {
                  if (kg) await api.guardarPeso(atleta.id, hoyISO(), kg);
                  if (cintura) await api.guardarMedidas(atleta.id, hoyISO(), { cintura_cm: cintura });
                  await api.completarTarea(t.id, { respuesta });
                  aviso('Guardado y tarea hecha'); alCambiar?.(); alCerrar();
                } catch (e) { aviso(e.message, 'error'); }
              })}><Icono n="bascula" /> Guardar y marcarla hecha</button>
            )}
            {t.tipo === 'texto' && <button class="btn btn-primario btn-grande" disabled={ocupado} onClick={() => completar(null)}><Icono n="hecho" /> Marcar como hecha</button>}
          </>
        )}
      </div>
    </Hoja>
  );
}

// ---------------------------------------------------------------- coach
// En Seguimiento: sus tareas (hechas, pendientes y las que vienen) y poner una nueva
export function TareasCoach({ atleta, alCambiar }) {
  const { api, aviso } = useApp();
  const lista = useCarga(() => api.tareas(atleta.id), [atleta.id]);
  const [nueva, setNueva] = useState(null); // null | {} | tarea (para corregirla)
  const [abierta, setAbierta] = useState(null);
  const [todas, setTodas] = useState(false);
  const tareas = lista.datos || [];
  const r = resumenTareas(tareas);
  const visibles = todas ? tareas : tareas.slice(0, 6);
  const recargar = () => { lista.recargar(true); alCambiar?.(); };
  return (
    <section class="seccion" aria-labelledby="tareas-coach">
      <div class="seccion-cab">
        <h2 id="tareas-coach">Tareas</h2>
        {atleta.estado !== 'baja' && <button class="btn-texto" onClick={() => setNueva({})}><Icono n="mas" /> Poner una tarea</button>}
      </div>
      <div class="panel">
        {lista.cargando && !lista.datos ? <div class="panel-pad"><Cargando /></div> : !tareas.length ? (
          <Vacio icono="checkin" titulo="Sin tareas todavía">Una cosa concreta para un día: una foto, su peso, un vídeo de un ejercicio o que te cuente algo. Le sale en «Tu día» hasta que la hace.</Vacio>
        ) : (
          <>
            <p class="panel-pad mini terciario">{[r.pendiente + r.atrasada ? `${r.pendiente + r.atrasada} por hacer` : null, r.hecha ? `${r.hecha} hechas` : null, r.proxima ? `${r.proxima} para más adelante` : null].filter(Boolean).join(' · ')}</p>
            <ul class="lista">
              {visibles.map((t) => {
                const e = estadoTarea(t);
                return (
                  <li key={t.id}>
                    <button class="fila-tarea" onClick={() => setAbierta(t)}>
                      <span class={`dia-marca ${e === 'hecha' ? 'hecho' : ''}`} aria-hidden="true"><Icono n={e === 'hecha' ? 'hecho' : ICONO_TAREA[t.tipo]} /></span>
                      <span class="pila-xs"><strong>{t.titulo}</strong><span class="mini terciario">{NOMBRE_TIPO_TAREA[t.tipo]} · {e === 'hecha' ? `hecha ${cuando(t.hecha_en)}` : cuandoTarea(t).toLowerCase()}</span></span>
                      <span class={`chip ${e === 'hecha' ? (t.revisada_en ? 'ok' : 'morado') : e === 'atrasada' ? 'aviso' : ''}`}>{e === 'hecha' ? (t.revisada_en ? 'Revisada' : 'Hecha') : e === 'atrasada' ? 'Pendiente' : e === 'pendiente' ? 'Hoy' : 'Más adelante'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {!todas && tareas.length > 6 && <div class="panel-pad"><button class="btn-texto" onClick={() => setTodas(true)}>Ver las {tareas.length - 6} anteriores</button></div>}
          </>
        )}
      </div>
      {nueva && <HojaNuevaTarea atleta={atleta} inicial={nueva} alCerrar={(hecho) => { setNueva(null); if (hecho) recargar(); }} />}
      {abierta && (
        <DetalleTarea tarea={abierta} atleta={atleta} alCerrar={() => setAbierta(null)} alCambiar={recargar}
          alCorregir={() => { setNueva(abierta); setAbierta(null); }}
          alBorrar={async () => { try { await api.borrarTarea(abierta.id); aviso('Tarea quitada'); setAbierta(null); recargar(); } catch (e) { aviso(e.message, 'error'); } }} />
      )}
    </section>
  );
}

function DetalleTarea({ tarea: t, atleta, alCerrar, alCambiar, alCorregir, alBorrar }) {
  const { api, aviso } = useApp();
  const archivo = useCarga(() => (t.archivo_id ? api.archivos(atleta.id).then((l) => l.find((a) => a.id === t.archivo_id) || null) : Promise.resolve(null)), [t.archivo_id]);
  const [confirmar, setConfirmar] = useState(false);
  return (
    <Hoja titulo={t.titulo} alCerrar={alCerrar} ancho={620}>
      <div class="pila">
        <p class="tarea-tipo"><Icono n={ICONO_TAREA[t.tipo]} /><span><strong>{NOMBRE_TIPO_TAREA[t.tipo]}</strong>. {t.hecha_en ? `Hecha ${cuando(t.hecha_en)}` : cuandoTarea(t)}</span></p>
        {t.detalle && <p class="peq secundario">{t.detalle}</p>}
        {archivo.datos && <VerArchivo archivo={archivo.datos} />}
        {t.respuesta && <p class="cita">«{t.respuesta}»</p>}
        {t.hecha_en && !t.revisada_en && <button class="btn btn-primario" onClick={async () => { try { await api.marcarRevisado('tarea', t.id); aviso('Tarea revisada'); alCambiar?.(); alCerrar(); } catch (e) { aviso(e.message, 'error'); } }}><Icono n="hecho" /> Marcar revisada</button>}
        <div class="fila-envolver">
          {!t.hecha_en && <button class="btn" onClick={alCorregir}><Icono n="editar" /> Cambiarla</button>}
          {confirmar
            ? <><span class="peq">¿Quitar esta tarea?</span><button class="btn btn-peq" onClick={() => setConfirmar(false)}>No</button><button class="btn btn-peq btn-peligro" onClick={alBorrar}>Sí, quitarla</button></>
            : <button class="btn btn-peligro" onClick={() => setConfirmar(true)}><Icono n="basura" /> Quitarla</button>}
        </div>
      </div>
    </Hoja>
  );
}

// Poner (o cambiar) una tarea: tipo, título, detalle, día y, si es un vídeo, de qué ejercicio. Con las plantillas
// guardadas (y unas sugeridas) para no escribirlo cada vez.
export function HojaNuevaTarea({ atleta, inicial = {}, alCerrar }) {
  const { api, aviso } = useApp();
  const plantillas = useCarga(() => api.plantillasTareas(), []);
  const biblioteca = useCarga(() => api.biblioteca().catch(() => []), []);
  const [f, setF] = useState({ tipo: inicial.tipo || 'foto', titulo: inicial.titulo || '', detalle: inicial.detalle || '', fecha: inicial.fecha || hoyISO(), ejercicio_id: inicial.ejercicio_id || '' });
  const [guardarPlantilla, setGuardarPlantilla] = useState(false);
  const [ocupado, una] = useUnaVez();
  const editando = !!inicial.id;
  const lista = plantillas.datos?.length ? plantillas.datos : PLANTILLAS_SUGERIDAS;
  const usar = (p) => setF({ ...f, tipo: p.tipo, titulo: p.titulo, detalle: p.detalle || '', ejercicio_id: p.ejercicio_id || f.ejercicio_id });
  const guardar = (e) => {
    e.preventDefault();
    una(async () => {
      try {
        const datos = { ...f, ejercicio_id: f.tipo === 'video' ? f.ejercicio_id || null : null };
        await api.ponerTarea(atleta.id, datos, editando ? inicial.id : null);
        if (guardarPlantilla) await api.guardarPlantillaTarea(datos).catch((err) => aviso(err.message, 'error'));
        aviso(editando ? 'Tarea cambiada' : `Tarea puesta: le sale en «Tu día» ${f.fecha === hoyISO() ? 'desde hoy' : `el ${fmtConDia(f.fecha)}`}`);
        alCerrar(true);
      } catch (err) { aviso(err.message, 'error'); }
    });
  };
  return (
    <Hoja titulo={editando ? 'Cambiar la tarea' : `Una tarea para ${atleta.nombre.split(' ')[0]}`} alCerrar={() => alCerrar(false)} ancho={620}>
      <form class="pila" onSubmit={guardar}>
        {!editando && (
          <div class="pila-s">
            <span class="peq secundario">{plantillas.datos?.length ? 'Tus plantillas' : 'Para empezar'}</span>
            <div class="selector-chips" role="group" aria-label="Plantillas de tareas">
              {lista.map((p, i) => <button type="button" key={p.id || i} aria-pressed={f.titulo === p.titulo && f.tipo === p.tipo ? 'true' : 'false'} onClick={() => usar(p)}>{p.titulo}</button>)}
            </div>
          </div>
        )}
        <div class="campo"><span class="etq">Qué tiene que hacer</span>
          <Segmentos etiqueta="Tipo de tarea" valor={f.tipo} alCambiar={(v) => v && setF({ ...f, tipo: v })} opciones={TIPOS_TAREA.map(([v, t]) => [v, t])} clase="segmentos-envolver" />
          <span class="ayuda">{TIPOS_TAREA.find(([v]) => v === f.tipo)?.[3]}</span>
        </div>
        {f.tipo === 'video' && (
          <div class="campo"><label for="tarea-ej">Ejercicio</label>
            <select id="tarea-ej" class="selector" required value={f.ejercicio_id} onChange={(e) => setF({ ...f, ejercicio_id: e.currentTarget.value })}>
              <option value="">Elige un ejercicio</option>
              {(biblioteca.datos || []).filter((x) => x.activo !== false).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select></div>
        )}
        <div class="campo"><label for="tarea-titulo">Título</label>
          <input id="tarea-titulo" class="entrada" required maxLength={120} value={f.titulo} onInput={(e) => setF({ ...f, titulo: e.currentTarget.value })} placeholder="Fotos de progreso de este mes" /></div>
        <div class="campo"><label for="tarea-detalle">Detalle (opcional)</label>
          <textarea id="tarea-detalle" class="area" rows={2} maxLength={600} value={f.detalle} onInput={(e) => setF({ ...f, detalle: e.currentTarget.value })} placeholder="Con la misma luz que la última vez" /></div>
        <div class="campo"><label for="tarea-fecha">Le sale desde el</label>
          <input id="tarea-fecha" class="entrada" type="date" required value={f.fecha} min={editando ? undefined : hoyISO()} max={sumarDias(hoyISO(), 120)} onInput={(e) => setF({ ...f, fecha: e.currentTarget.value })} />
          <span class="ayuda">Le llega una notificación al ponerla (sin el texto). Si no la hace ese día, le sigue saliendo sin agobiar.</span></div>
        {!editando && <label class="casilla"><input type="checkbox" checked={guardarPlantilla} onChange={(e) => setGuardarPlantilla(e.currentTarget.checked)} /><span>Guardarla también como plantilla</span></label>}
        <button class="btn btn-primario btn-grande" disabled={ocupado || !f.titulo.trim() || (f.tipo === 'video' && !f.ejercicio_id)}>{editando ? 'Guardar' : 'Poner la tarea'}</button>
      </form>
    </Hoja>
  );
}

// En Revisar: una tarea hecha, con lo que ha contestado y la foto o el vídeo
export function TarjetaTarea({ t, recargar, abrirAtleta }) {
  const { api, aviso } = useApp();
  const [respuesta, setRespuesta] = useState('');
  const [abierta, setAbierta] = useState(false);
  const [ocupado, una] = useUnaVez();
  return (
    <article class="panel panel-pad tarjeta-revisar pila-s" tabIndex={0} aria-label={`Tarea de ${t.atleta.nombre}: ${t.titulo}`}>
      <div class="separa">
        <button class="btn-texto nombre-atleta" onClick={() => abrirAtleta(t.atleta.id, 'seguimiento')}><strong>{t.atleta.nombre}</strong></button>
        <span class="mini terciario">{cuando(t.hecha_en)}</span>
      </div>
      <p class="tarea-tipo"><Icono n={ICONO_TAREA[t.tipo]} /><span><strong>{t.titulo}</strong> <span class="secundario">({NOMBRE_TIPO_TAREA[t.tipo].toLowerCase()}{t.ejercicio ? `: ${t.ejercicio.nombre}` : ''})</span></span></p>
      {t.respuesta && <p class="cita">«{t.respuesta}»</p>}
      {t.archivo && <VerArchivo archivo={t.archivo} />}
      {abierta && (
        <div class="pila-s">
          <label class="sr" for={`tarea-resp-${t.id}`}>Tu respuesta a {t.atleta.nombre}</label>
          <textarea id={`tarea-resp-${t.id}`} class="area" rows={2} value={respuesta} onInput={(e) => setRespuesta(e.currentTarget.value)} placeholder={`Escribe a ${t.atleta.nombre.split(' ')[0]}…`} />
          <button class="btn btn-primario" disabled={ocupado || !respuesta.trim()} onClick={() => una(async () => {
            try {
              await api.enviarMensaje(t.atleta.id, { texto: `Sobre «${t.titulo}»: ${respuesta.trim()}`, autor: 'coach' });
              await api.marcarRevisado('tarea', t.id);
              aviso('Respondido y revisado'); recargar();
            } catch (e) { aviso(e.message, 'error'); }
          })}><Icono n="enviar" /> Responder por el chat</button>
        </div>
      )}
      <div class="fila-envolver">
        {!abierta && <button class="btn btn-peq" aria-expanded="false" onClick={() => setAbierta(true)}><Icono n="mensaje" /> Responder</button>}
        <button class="btn btn-peq revisar-hecho" onClick={async () => { try { await api.marcarRevisado('tarea', t.id); aviso('Tarea revisada', 'ok', { texto: 'Deshacer', fn: async () => { await api.marcarRevisado('tarea', t.id, false); recargar(); } }); recargar(); } catch (e) { aviso(e.message, 'error'); } }}><Icono n="hecho" /> Revisada</button>
      </div>
    </article>
  );
}

