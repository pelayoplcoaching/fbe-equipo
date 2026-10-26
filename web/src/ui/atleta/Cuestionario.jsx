// Cuestionario inicial del atleta: objetivo, experiencia y tiempo, dónde entrena y con qué, su salud (cribado
// previo al ejercicio de la ACSM, 2015) y lesiones. Cada paso se guarda al pasar al siguiente.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Icono, Segmentos, cuando } from '../comunes.jsx';
import { OBJETIVOS, EXPERIENCIA, LUGARES, MATERIAL, SINTOMAS, OTRAS, ZONAS_LESION, LIMITA, MINUTOS, MENSAJE_ATLETA, conSalud, pendiente, objetivosDe } from '../../logica/cuestionario.js';
import { TEXTO_CONSENTIMIENTO_SALUD } from '../../legal.js';

const PASOS = [
  ['objetivo', 'Tus objetivos', ['objetivos', 'objetivo_detalle']],
  ['tiempo', 'Experiencia y tiempo', ['experiencia', 'dias_semana', 'minutos_sesion', 'otros_deportes']],
  ['lugar', 'Dónde y con qué', ['lugar', 'material']],
  ['salud', 'Tu salud', ['activo', 'enfermedad', 'enfermedad_detalle', 'sintomas', 'otras', 'medicacion_detalle']],
  ['lesiones', 'Lesiones y alergias', ['lesiones', 'alergias']],
];
const SI_NO = [[true, 'Sí'], [false, 'No']];
const NIVEL = { sin_valoracion: 'ok', valorar_antes_vigoroso: 'aviso', valorar_antes: 'aviso', parar_y_valorar: 'alerta' };

// «hoy, 9:30», «ayer, 9:30» o «el 3 sep»
export const fechaCuando = (iso) => { const t = cuando(iso); return /^\d/.test(t) ? `el ${t}` : t; };

export { pendiente };

// Opciones grandes (una sola elegida)
function Opciones({ opciones, valor, alCambiar, etiqueta }) {
  return (
    <div class="opciones" role="group" aria-label={etiqueta}>
      {opciones.map(([v, t]) => <button type="button" key={v} aria-pressed={valor === v ? 'true' : 'false'} onClick={() => alCambiar(valor === v ? null : v)}>{t}</button>)}
    </div>
  );
}

// Casillas de una lista, con «Ninguna» (null = sin responder; [] = ninguna)
function Marcar({ id, opciones, valor, alCambiar }) {
  const lista = valor || [];
  return (
    <div class="lista-marcar" role="group" aria-labelledby={id}>
      {opciones.map(([v, t]) => (
        <label class="casilla" key={v}>
          <input type="checkbox" checked={lista.includes(v)} onChange={(e) => { const r = e.currentTarget.checked ? [...lista, v] : lista.filter((x) => x !== v); alCambiar(r.length ? r : null); }} />
          <span>{t}</span>
        </label>
      ))}
      <label class="casilla ninguna">
        <input type="checkbox" checked={Array.isArray(valor) && !valor.length} onChange={(e) => alCambiar(e.currentTarget.checked ? [] : null)} />
        <span>Ninguna de estas</span>
      </label>
    </div>
  );
}

export function HojaCuestionario({ inicial, salud, darConsentimiento, alCerrar, alGuardar }) {
  const { api, atleta } = useApp();
  const [paso, setPaso] = useState(0);
  const [f, setF] = useState(() => ({ material: [], ...(inicial || {}), objetivos: objetivosDe(inicial) }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [final, setFinal] = useState(null);
  // La recomendación en cuanto se guarda lo de salud (no hace falta llegar al final para verla)
  const [tras, setTras] = useState(null);
  const [dando, setDando] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const [clave, titulo, campos] = PASOS[paso] || [];
  const deSalud = clave === 'salud' || clave === 'lesiones';
  const ultimo = paso === PASOS.length - 1;

  function falta() {
    if (clave === 'objetivo' && !f.objetivos?.length) return 'Elige al menos un objetivo.';
    if (clave === 'tiempo' && (!f.experiencia || !f.dias_semana || !f.minutos_sesion)) return 'Dinos tu experiencia, cuántos días puedes entrenar y cuánto tiempo.';
    if (clave === 'lugar' && !f.lugar) return 'Elige dónde vas a entrenar.';
    if (clave === 'salud' && salud && (f.activo == null || f.enfermedad == null || f.sintomas == null || f.otras == null)) return 'Responde las cuatro preguntas. Si no te pasa nada de una lista, marca «Ninguna de estas».';
    if (clave === 'lesiones' && salud && (f.lesiones || []).some((l) => !l.zona)) return 'Elige la zona de cada lesión (o quítala).';
    return null;
  }

  async function siguiente(e) {
    e.preventDefault();
    setError(null);
    const m = falta();
    if (m) { setError(m); return; }
    // Sin consentimiento, lo de salud no se manda (y el paso se salta)
    const aGuardar = deSalud && !salud ? [] : campos;
    if (!aGuardar.length && !ultimo) { setPaso(paso + 1); return; }
    const datos = Object.fromEntries(aGuardar.map((k) => [k, k === 'lesiones' ? f.lesiones || [] : f[k] ?? null]));
    setGuardando(true);
    try {
      const fila = await api.guardarCuestionario(atleta.id, datos, { completar: ultimo });
      alGuardar?.(fila);  // lo de fuera se pone al día en cada paso (si cierra a medias, al volver ve lo guardado)
      if (clave === 'salud') setTras(fila.resultado && fila.resultado !== 'sin_valoracion' ? fila.resultado : null);
      if (ultimo) setFinal(fila); else setPaso(paso + 1);
    } catch (err) { setError(err.message); } finally { setGuardando(false); }
  }

  if (final) {
    return (
      <Hoja titulo="Cuestionario enviado" alCerrar={alCerrar}>
        <div class="pila">
          {final.resultado ? (
            <div class={`resultado-cribado ${NIVEL[final.resultado]}`} role="status">
              <Icono n={final.resultado === 'sin_valoracion' ? 'hecho' : 'alerta'} />
              <p>{MENSAJE_ATLETA[final.resultado]}</p>
            </div>
          ) : (
            <p>Tu coach ya tiene tus respuestas. Te falta la parte de salud: cuando des el consentimiento de datos de salud, complétala desde Perfil.</p>
          )}
          <p class="peq secundario">Si algo cambia (una lesión, una medicación nueva, un embarazo…), actualízalo desde Perfil: tu coach lo verá.</p>
          <button class="btn btn-primario btn-grande" onClick={alCerrar}>Hecho</button>
        </div>
      </Hoja>
    );
  }

  return (
    <Hoja titulo="Tu cuestionario inicial" alCerrar={alCerrar}>
      <form class="pila cuestionario" onSubmit={siguiente} noValidate>
        <div class="pila-s">
          <div class="separa"><strong>{titulo}</strong><span class="peq secundario num">Paso {paso + 1} de {PASOS.length}</span></div>
          <div class="progreso-barra" role="img" aria-label={`Paso ${paso + 1} de ${PASOS.length}`}><span style={{ width: `${((paso + 1) / PASOS.length) * 100}%` }} /></div>
        </div>

        {clave === 'objetivo' && (
          <>
            <div class="campo"><span class="etq" id="cu-obj">¿Qué quieres conseguir?</span>
              <div class="opciones" role="group" aria-labelledby="cu-obj">
                {OBJETIVOS.map(([v, t]) => {
                  const lista = f.objetivos || [];
                  const i = lista.indexOf(v);
                  return (
                    <button type="button" key={v} aria-pressed={i >= 0 ? 'true' : 'false'}
                      onClick={() => set('objetivos')(i >= 0 ? lista.filter((x) => x !== v) : [...lista, v])}>
                      {t}{i === 0 && lista.length > 1 && <span class="chip morado mini objetivo-principal">Principal</span>}
                    </button>
                  );
                })}
              </div>
              <span class="ayuda">Marca todos los que quieras. El primero que marques es el principal.</span></div>
            <div class="campo"><label for="cu-obj-det">Cuéntalo con tus palabras (si quieres)</label>
              <textarea id="cu-obj-det" class="area" maxLength={600} value={f.objetivo_detalle || ''} onInput={(e) => set('objetivo_detalle')(e.currentTarget.value)}
                placeholder="Una marca, una fecha, una prueba, cómo te quieres sentir…" /></div>
          </>
        )}

        {clave === 'tiempo' && (
          <>
            <div class="campo"><span class="etq">¿Cuánto tiempo llevas entrenando fuerza?</span>
              <Opciones etiqueta="Experiencia entrenando fuerza" opciones={EXPERIENCIA} valor={f.experiencia ?? null} alCambiar={set('experiencia')} /></div>
            <div class="campo"><span class="etq">¿Cuántos días a la semana puedes entrenar?</span>
              <Segmentos etiqueta="Días a la semana" opciones={[1, 2, 3, 4, 5, 6, 7].map((n) => [n, String(n)])} valor={f.dias_semana ?? null} alCambiar={set('dias_semana')} /></div>
            <div class="campo"><span class="etq">¿Cuántos minutos por sesión?</span>
              <Segmentos etiqueta="Minutos por sesión" opciones={MINUTOS.map((n) => [n, String(n), `${n} minutos`])} valor={f.minutos_sesion ?? null} alCambiar={set('minutos_sesion')} />
              <span class="ayuda">Con el calentamiento incluido.</span></div>
            <div class="campo"><label for="cu-dep">¿Haces otro deporte? (si quieres)</label>
              <input id="cu-dep" class="entrada" maxLength={200} value={f.otros_deportes || ''} onInput={(e) => set('otros_deportes')(e.currentTarget.value)} placeholder="Pádel los domingos, corro 2 días…" /></div>
          </>
        )}

        {clave === 'lugar' && (
          <>
            <div class="campo"><span class="etq">¿Dónde vas a entrenar?</span>
              <Opciones etiqueta="Dónde vas a entrenar" opciones={LUGARES} valor={f.lugar ?? null} alCambiar={set('lugar')} /></div>
            <div class="campo"><span class="etq" id="cu-mat">¿Qué material tienes a mano?</span>
              <div class="zonas elegir" role="group" aria-labelledby="cu-mat">
                {MATERIAL.map(([v, t]) => (
                  <button type="button" key={v} aria-pressed={f.material?.includes(v) ? 'true' : 'false'}
                    onClick={() => set('material')(f.material?.includes(v) ? f.material.filter((x) => x !== v) : [...(f.material || []), v])}>{t}</button>
                ))}
              </div>
              <span class="ayuda">Marca todo lo que puedas usar. Así tu coach elige ejercicios que puedas hacer.</span></div>
          </>
        )}

        {deSalud && !salud && (
          <div class="panel panel-pad pila-s">
            <p>Esta parte es sobre tu salud: para responderla hace falta tu consentimiento de datos de salud.</p>
            <p class="peq secundario">{TEXTO_CONSENTIMIENTO_SALUD}</p>
            <button type="button" class="btn btn-primario" disabled={dando} onClick={async () => { setDando(true); try { await darConsentimiento(); } catch (err) { setError(err.message); } finally { setDando(false); } }}>Dar consentimiento</button>
            <span class="peq terciario">O sigue sin responderla: tu coach verá el resto.</span>
          </div>
        )}

        {clave === 'salud' && salud && (
          <>
            <p class="peq secundario">Son las preguntas que recomienda el American College of Sports Medicine para saber si conviene que te vea un médico antes de empezar o de subir la intensidad. No sustituyen a una consulta médica.</p>
            <div class="campo"><span class="etq">¿Haces ejercicio de forma regular desde hace al menos 3 meses?</span>
              <Segmentos etiqueta="Ejercicio regular desde hace 3 meses" opciones={SI_NO} valor={f.activo ?? null} alCambiar={set('activo')} />
              <span class="ayuda">Ejercicio planificado: al menos 3 días a la semana, 30 minutos o más, con un esfuerzo en el que respiras más rápido pero aún puedes hablar.</span></div>
            <div class="campo"><span class="etq">¿Te ha diagnosticado un médico alguna enfermedad del corazón o de las arterias, diabetes o una enfermedad del riñón?</span>
              <Segmentos etiqueta="Enfermedad diagnosticada" opciones={SI_NO} valor={f.enfermedad ?? null} alCambiar={set('enfermedad')} />
              <span class="ayuda">Por ejemplo: infarto, angina, arritmia, insuficiencia cardiaca, ictus, enfermedad arterial de las piernas, diabetes tipo 1 o 2, insuficiencia renal. La tensión alta o el colesterol, solos, no cuentan aquí (si tomas medicación, dilo más abajo).</span></div>
            {f.enfermedad && (
              <div class="campo"><label for="cu-enf">¿Cuál?</label>
                <input id="cu-enf" class="entrada" maxLength={300} value={f.enfermedad_detalle || ''} onInput={(e) => set('enfermedad_detalle')(e.currentTarget.value)} /></div>
            )}
            <div class="campo"><span class="etq" id="cu-sint">¿Has notado alguna de estas cosas, en reposo o al esforzarte?</span>
              <Marcar id="cu-sint" opciones={SINTOMAS} valor={f.sintomas ?? null} alCambiar={set('sintomas')} /></div>
            {f.sintomas?.length > 0 && (
              <div class="nota-coach alerta-suave" role="note"><Icono n="alerta" /><div>Si ahora mismo tienes dolor en el pecho o te falta mucho el aire, llama al 112. Si no, sigue: al terminar te decimos qué hacer.</div></div>
            )}
            <div class="campo"><span class="etq" id="cu-otras">¿Te pasa alguna de estas?</span>
              <Marcar id="cu-otras" opciones={OTRAS} valor={f.otras ?? null} alCambiar={set('otras')} /></div>
            {f.otras?.includes('medicacion') && (
              <div class="campo"><label for="cu-med">¿Qué medicación y para qué?</label>
                <input id="cu-med" class="entrada" maxLength={300} value={f.medicacion_detalle || ''} onInput={(e) => set('medicacion_detalle')(e.currentTarget.value)} placeholder="Nombre, dosis y para qué la tomas" /></div>
            )}
          </>
        )}

        {clave === 'lesiones' && tras && (
          <div class={`resultado-cribado ${NIVEL[tras]}`} role="status"><Icono n="alerta" /><p>{MENSAJE_ATLETA[tras]}</p></div>
        )}

        {clave === 'lesiones' && salud && (
          <>
            <div class="campo"><span class="etq">¿Tienes alguna lesión o molestia que tu coach deba conocer?</span>
              {!(f.lesiones || []).length && <span class="peq terciario">Ninguna. Si tienes alguna, añádela.</span>}
              <div class="pila-s">
                {(f.lesiones || []).map((l, i) => {
                  const cambiar = (k, v) => set('lesiones')(f.lesiones.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
                  return (
                    <div class="lesion" key={i}>
                      <div class="separa">
                        <select class="selector" aria-label={`Zona de la lesión ${i + 1}`} value={l.zona || ''} onChange={(e) => cambiar('zona', e.currentTarget.value || null)}>
                          <option value="">Elige la zona</option>
                          {ZONAS_LESION.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                        </select>
                        <button type="button" class="btn btn-icono plano" aria-label={`Quitar la lesión ${i + 1}`} onClick={() => set('lesiones')(f.lesiones.filter((_, j) => j !== i))}><Icono n="basura" /></button>
                      </div>
                      <Segmentos etiqueta={`Cuánto te limita la lesión ${i + 1}`} opciones={LIMITA.map((t, k) => [k, t])} valor={l.limita ?? 0} alCambiar={(v) => cambiar('limita', v ?? 0)} />
                      <input class="entrada" aria-label={`Nota de la lesión ${i + 1}`} maxLength={200} value={l.nota || ''} onInput={(e) => cambiar('nota', e.currentTarget.value)} placeholder="Qué pasó, qué movimientos te molestan…" />
                    </div>
                  );
                })}
              </div>
              {(f.lesiones || []).length < 10 && (
                <button type="button" class="btn btn-peq" style="justify-self:start" onClick={() => set('lesiones')([...(f.lesiones || []), { zona: null, limita: 0, nota: '' }])}><Icono n="mas" /> Añadir una lesión o molestia</button>
              )}
            </div>
            <div class="campo"><label for="cu-ale">Alergias o intolerancias alimentarias (si tienes)</label>
              <input id="cu-ale" class="entrada" maxLength={300} value={f.alergias || ''} onInput={(e) => set('alergias')(e.currentTarget.value)} placeholder="Lactosa, frutos secos…" /></div>
          </>
        )}

        {error && <div class="error" role="alert">{error}</div>}
        <div class="fila-botones">
          {paso > 0 && <button type="button" class="btn" onClick={() => { setError(null); setPaso(paso - 1); }}><Icono n="atras" /> Atrás</button>}
          <button class="btn btn-primario btn-grande" disabled={guardando}>{guardando ? 'Guardando…' : ultimo ? 'Enviar a tu coach' : 'Siguiente'}</button>
        </div>
      </form>
    </Hoja>
  );
}

// Tarjeta de Hoy: el coach lo pide (o pide que se actualice)
export function TarjetaCuestionario({ cuestionario, abrir }) {
  const actualizar = !!cuestionario?.completado_en;
  return (
    <section class="nota-coach tarjeta-cuestionario" aria-label="Cuestionario">
      <Icono n="pregunta" />
      <div class="pila-s">
        <strong>{actualizar ? 'Tu coach te pide que actualices tu cuestionario' : 'Tu coach te pide tu cuestionario inicial'}</strong>
        <span class="peq">{actualizar ? 'Revisa si algo ha cambiado: objetivo, tiempo, lesiones o salud.' : 'Son unos minutos: tu objetivo, tu tiempo, tu material y tu salud.'}</span>
        <button class="btn btn-primario btn-peq" style="justify-self:start" onClick={abrir}>{actualizar ? 'Revisarlo' : 'Empezar'}</button>
      </div>
    </section>
  );
}

// Fila de Perfil
export function FilaCuestionario({ salud, recargarConsentimientos }) {
  const { api, atleta, aviso } = useApp();
  const c = useCarga(() => api.cuestionario(atleta.id).catch(() => null), [atleta.id]);
  const [abierto, setAbierto] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const d = c.datos;
  return (
    <li class="panel-pad pila-s">
      <div class="separa">
        <div><div>Tu cuestionario inicial</div>
          <div class="peq terciario">{d?.completado_en ? `Enviado ${fechaCuando(d.completado_en)}${pendiente(d) ? '. Tu coach te pide que lo actualices' : ''}` : d ? 'Empezado, sin enviar' : 'Sin rellenar'}</div></div>
        <button class={`btn btn-peq ${!d?.completado_en || pendiente(d) ? 'btn-primario' : ''}`} disabled={c.cargando && !d} onClick={() => setAbierto(true)}>{d?.completado_en ? 'Revisar' : d ? 'Seguir' : 'Rellenar'}</button>
      </div>
      {/* Sin consentimiento de salud (por ejemplo, tras retirarlo), lo de salud que ya estaba se puede borrar */}
      {!salud && conSalud(d) && (!borrar
        ? <button class="btn-texto peq" style="justify-self:start" onClick={() => setBorrar(true)}>Borrar mis respuestas de salud</button>
        : <div class="nota pila-s"><span>Se borra lo que contaste de tu salud, lesiones y alergias. Tu coach dejará de verlo.</span>
            <span class="fila"><button class="btn btn-peq" onClick={() => setBorrar(false)}>Cancelar</button>
              <button class="btn btn-peq btn-peligro" onClick={async () => { try { await api.borrarSaludCuestionario(atleta.id); setBorrar(false); c.recargar(true); aviso('Respuestas de salud borradas'); } catch (e) { aviso(e.message, 'error'); } }}>Borrar</button></span></div>)}
      {abierto && (
        <HojaCuestionario inicial={d} salud={salud} darConsentimiento={async () => { await api.darConsentimientos(['datos_salud']); recargarConsentimientos(); }}
          alCerrar={() => setAbierto(false)} alGuardar={() => c.recargar(true)} />
      )}
    </li>
  );
}
