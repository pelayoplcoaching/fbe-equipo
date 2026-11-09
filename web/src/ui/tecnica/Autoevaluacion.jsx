// v0.59 (12, migración 037): la valoración del atleta antes de enviar su vídeo («¿Cómo la has notado?»): el esfuerzo de esa
// serie (el RPE que apuntó en ella, si el vídeo va con su serie; si no, de 6 a 10), lo que nota él y si tiene alguna
// molestia (y dónde). Lo de la molestia es un dato de salud: sin su consentimiento no se pregunta (como «¿cómo llegas
// hoy?»), y la base tampoco lo guarda. El coach la ve arriba de la revisión, junto a su nota de técnica.
import { useEffect, useId, useState } from 'preact/hooks';
import { useApp, useCarga, Icono } from '../comunes.jsx';
import { RPES_AUTO, MAX_NOTA_AUTO, ZONAS_MOLESTIA, limpiarAutoevaluacion, textoAutoevaluacion, compararAutoevaluacion } from '../../logica/correccion.js';

const coma = (x) => String(x).replace('.', ',');
// ¿Tiene dado el consentimiento de datos de salud? (el atleta, el suyo)
export function useSalud() {
  const { api, perfil } = useApp();
  const c = useCarga(() => (perfil?.rol === 'coach' ? Promise.resolve([]) : api.consentimientos().catch(() => [])), [perfil?.id]);
  return (c.datos || []).some((x) => x.tipo === 'datos_salud' && !x.revocado_en);
}

// Lo que se rellena (sin guardar): valor = { rpe, nota, molestia, zona }; rpeSerie: el de la serie del vídeo, si lo hay
export function CamposAutoevaluacion({ valor, setValor, rpeSerie = null, salud = false, idBase = 'auto' }) {
  const id = useId();
  const v = valor || {};
  const poner = (c) => setValor({ ...v, ...c });
  const largo = [...String(v.nota || '')].length;
  return (
    <div class="pila-s autoevaluacion-campos">
      <div class="campo">
        <span class="etq" id={`${id}-rpe`}>Esfuerzo de esa serie (RPE)</span>
        {rpeSerie != null ? (
          <span class="ayuda">Lo apuntaste en la serie: <b class="num">RPE {coma(rpeSerie)}</b>. Tu coach lo verá aquí también.</span>
        ) : (
          <>
            <div class="segmentos autoevaluacion-rpe" role="group" aria-labelledby={`${id}-rpe`}>
              {RPES_AUTO.map((r) => <button key={r} type="button" class="num" aria-pressed={v.rpe === r ? 'true' : 'false'} aria-label={`RPE ${coma(r)}`} onClick={() => poner({ rpe: v.rpe === r ? null : r })}>{coma(r)}</button>)}
            </div>
            <span class="ayuda">10: no podías hacer ni una más; 8: te quedaban dos.</span>
          </>
        )}
      </div>
      <div class="campo">
        <label for={`${idBase}-nota`}>¿Qué notas tú?</label>
        <textarea id={`${idBase}-nota`} class="area" style="min-height:56px" maxLength={MAX_NOTA_AUTO} value={v.nota || ''} onInput={(e) => poner({ nota: e.currentTarget.value })}
          placeholder="Por ejemplo: en la última se me van las rodillas hacia dentro" />
        <span class="ayuda num" aria-live="polite">{largo > MAX_NOTA_AUTO - 40 ? `${largo}/${MAX_NOTA_AUTO}` : ''}</span>
      </div>
      {salud && (
        <div class="campo">
          <span class="etq" id={`${id}-mol`}>¿Alguna molestia?</span>
          <div class="segmentos" role="group" aria-labelledby={`${id}-mol`}>
            <button type="button" aria-pressed={v.molestia === false ? 'true' : 'false'} onClick={() => poner({ molestia: v.molestia === false ? null : false, zona: null })}>No</button>
            <button type="button" aria-pressed={v.molestia === true ? 'true' : 'false'} onClick={() => poner({ molestia: v.molestia === true ? null : true })}>Sí</button>
          </div>
          {v.molestia === true && (
            <select class="selector" aria-label="Dónde (opcional)" value={v.zona || ''} onChange={(e) => poner({ zona: e.currentTarget.value || null })}>
              <option value="">Dónde (opcional)</option>
              {ZONAS_MOLESTIA.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          )}
          <span class="ayuda">Es un dato de salud: lo ve solo tu coach.</span>
        </div>
      )}
    </div>
  );
}

// En la hoja de enviar el vídeo: plegada, opcional. Devuelve lo que hay que guardar con alCambiar(limpio | null).
export function AutoevaluacionEnvio({ rpeSerie = null, alCambiar }) {
  const { api, perfil } = useApp();
  const con037 = useCarga(() => (perfil?.rol === 'coach' ? Promise.resolve(false) : api.video037().catch(() => false)), []);
  const salud = useSalud();
  const [abierta, setAbierta] = useState(false);
  const [valor, setValor] = useState({});
  useEffect(() => { alCambiar?.(con037.datos ? limpiarAutoevaluacion({ ...valor, rpe: rpeSerie ?? valor.rpe ?? null }, { salud }) : null); }, [valor, rpeSerie, salud, con037.datos]);
  if (perfil?.rol === 'coach' || !con037.datos) return null;
  return (
    <div class="autoevaluacion panel-pad">
      <button type="button" class="btn-texto autoevaluacion-abrir" aria-expanded={abierta ? 'true' : 'false'} onClick={() => setAbierta(!abierta)}>
        <Icono n={abierta ? 'abajo' : 'derecha'} /> ¿Cómo la has notado? <span class="terciario">(opcional)</span>
      </button>
      {abierta && <CamposAutoevaluacion valor={valor} setValor={setValor} rpeSerie={rpeSerie} salud={salud} idBase="envio-auto" />}
    </div>
  );
}

// Para el coach, arriba de la revisión: «Ana nota: …», su esfuerzo, si nota molestias y, junto a tu nota de técnica
export function AutoevaluacionCoach({ auto, nombreAtleta, puntuacion = null, rpeSerie = null }) {
  if (!auto) return null;
  const x = textoAutoevaluacion({ ...auto, rpe: auto.rpe ?? rpeSerie }, nombreAtleta);
  const comp = compararAutoevaluacion({ rpe: auto.rpe ?? rpeSerie }, puntuacion);
  return (
    <section class="autoevaluacion-coach pila-xs" aria-label={`Lo que nota ${String(nombreAtleta || 'tu atleta').split(' ')[0]}`}>
      <span class="etq">{x.titulo}</span>
      {x.nota && <p class="cita">«{x.nota}»</p>}
      <div class="fila-envolver">
        {x.rpe && <span class="chip num auto-rpe" data-rpe={Math.min(10, Math.max(5, Math.floor(auto.rpe ?? rpeSerie ?? 0)))}>{x.rpe}</span>}
        {x.molestia && <span class={`chip ${auto.molestia ? 'alerta' : 'ok'}`}>{auto.molestia && <Icono n="alerta" />}{x.molestia}</span>}
      </div>
      {comp && <p class="mini secundario autoevaluacion-comparar">Para leerlos juntos: {comp.texto}.{comp.lectura ? ` ${comp.lectura}` : ''}</p>}
    </section>
  );
}

// El atleta, en su vídeo: la ve y la cambia mientras su coach no lo ha revisado
export function AutoevaluacionAtleta({ video, rpeSerie = null }) {
  const { api, aviso } = useApp();
  const con037 = useCarga(() => api.video037().catch(() => false), []);
  const a = useCarga(() => api.autoevaluacion(video.id).catch(() => null), [video.id]);
  const salud = useSalud();
  const [editar, setEditar] = useState(false);
  const [valor, setValor] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  if (!con037.datos) return null;
  const revisado = !!video.revisado_en || !!video.revision?.corregido_el;
  const x = a.datos ? textoAutoevaluacion(a.datos, 'Tú') : null;
  if (revisado && !a.datos) return null;
  const guardar = async () => {
    setOcupado(true);
    try { await api.guardarAutoevaluacion(video, { ...valor, rpe: rpeSerie ?? valor.rpe ?? null }, { salud }); aviso('Valoración guardada'); setEditar(false); await a.recargar(true); }
    catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  // (borrarla, cuando quiera: también después de que la revise su coach; es suya)
  const borrar = async () => {
    setOcupado(true);
    try { await api.guardarAutoevaluacion(video, null); aviso('Valoración borrada'); setConfirmar(false); await a.recargar(true); }
    catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  return (
    <section class="autoevaluacion-atleta pila-xs" aria-label="Tu valoración">
      <div class="separa"><span class="etq">Tu valoración</span>
        {!editar && <span class="fila-envolver">
          {!revisado && <button type="button" class="btn-texto mini" onClick={() => { setValor({ rpe: a.datos?.rpe != null ? Number(a.datos.rpe) : null, nota: a.datos?.nota || '', molestia: a.datos?.molestia ?? null, zona: a.datos?.zona || null }); setEditar(true); }}><Icono n="editar" /> {a.datos ? 'Cambiarla' : 'Añadirla'}</button>}
          {a.datos && (confirmar
            ? <><span class="mini">¿Borrarla?</span><button type="button" class="btn-texto mini btn-peligro" disabled={ocupado} onClick={borrar}>Sí, borrar</button><button type="button" class="btn-texto mini" onClick={() => setConfirmar(false)}>No</button></>
            : <button type="button" class="btn-texto mini" onClick={() => setConfirmar(true)}><Icono n="basura" /> Borrarla</button>)}
        </span>}</div>
      {editar ? (
        <>
          <CamposAutoevaluacion valor={valor} setValor={setValor} rpeSerie={rpeSerie} salud={salud} idBase={`auto-${video.id}`} />
          <div class="fila-envolver">
            <button type="button" class="btn btn-peq btn-primario" disabled={ocupado} onClick={guardar}><Icono n="hecho" /> Guardar</button>
            <button type="button" class="btn btn-peq plano" onClick={() => setEditar(false)}>Cancelar</button>
          </div>
        </>
      ) : x ? (
        <p class="peq secundario">{[x.rpe, x.nota ? `«${x.nota}»` : null, x.molestia].filter(Boolean).join(' · ')}{revisado ? ' (puedes borrarla cuando quieras)' : ' (puedes cambiarla hasta que tu coach lo revise y borrarla cuando quieras)'}</p>
      ) : <p class="mini terciario">Cuéntale a tu coach cómo la has notado (hasta que lo revise).</p>}
    </section>
  );
}
