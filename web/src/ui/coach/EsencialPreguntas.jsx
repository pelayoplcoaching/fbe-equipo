// FBE Esencial (acompañamiento, tanda 4; migración 100): en el panel del coach, las preguntas que quienes van por su cuenta
// mandan para el directo del mes. Verlas juntas, apuntar lo que contestó y, si quiere, sacarla en «Respuestas» para todos
// (sin el nombre de quien preguntó y con la pregunta escrita por él). Estilos: ayuda.css (clases ecp-*).
import { useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez } from '../comunes.jsx';
import { fechaLarga } from '../../logica/esencial-alta.js';
import { hoyISO, diasEntre } from '../../logica/fechas.js';
import { aQuienEscribir, comoVamosResumen } from '../../logica/esencial-cerca.js';
import { resumenCoach } from '../../logica/esencial-vida.js';
import * as datos from '../../datos/api-esencial.js';

// (para el panel del coach) Las preguntas para el directo: verlas juntas, contestarlas y, si quiere, hacerlas públicas
export function PreguntasDirecto() {
  const { backend, aviso } = useApp();
  const d = useCarga(() => datos.preguntasDirecto(backend), []);
  const [edita, setEdita] = useState(null);   // { id, respuesta, pregunta_publica, publica }
  const [ocupado, una] = useUnaVez();
  if (!d.datos?.length) return null;
  const pendientes = d.datos.filter((x) => !x.respondida_en).length;
  const guardarla = () => una(async () => {
    try { await datos.responderPregunta(backend, edita.id, edita); setEdita(null); d.recargar(true); aviso('Guardado'); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <section class="ecp-caja" data-ecp="directo" aria-labelledby="ecp-t">
      <h2 id="ecp-t" class="etq">Preguntas para el directo{pendientes ? ` · ${pendientes} sin contestar` : ''}</h2>
      <ul class="ecp-lista">
        {d.datos.map((x) => (
          <li key={x.id} class="ecp-fila">
            <span class="peq"><strong>{x.nombre || 'Sin nombre'}</strong> <span class="mini terciario">· {fechaLarga(String(x.creada_en).slice(0, 10))}</span></span>
            <span class="peq">{x.texto}</span>
            {x.respuesta && edita?.id !== x.id && <span class="peq ecp-resp"><strong>Tu respuesta{x.publica ? ' (pública)' : ''}: </strong>{x.respuesta}</span>}
            {edita?.id === x.id ? (
              <div class="pila-s">
                <textarea class="ecp-area" rows="3" maxlength="3000" value={edita.respuesta} onInput={(e) => setEdita({ ...edita, respuesta: e.currentTarget.value })} placeholder="Lo que contestaste en el directo, en corto" aria-label="Tu respuesta" />
                <label class="peq"><input type="checkbox" checked={edita.publica} onChange={(e) => setEdita({ ...edita, publica: e.currentTarget.checked })} /> Sacarla en «Respuestas» para todos los de FBE Esencial (sin su nombre)</label>
                {edita.publica && <input class="ecp-campo" type="text" maxlength="300" value={edita.pregunta_publica} onInput={(e) => setEdita({ ...edita, pregunta_publica: e.currentTarget.value })} placeholder="La pregunta, como quieres que se lea (sin datos personales)" aria-label="La pregunta, para todos" />}
                <div class="fila-envolver">
                  <button type="button" class="btn btn-primario btn-peq" disabled={ocupado || (edita.publica && !edita.pregunta_publica.trim())} onClick={guardarla}>Guardar</button>
                  <button type="button" class="btn btn-peq" onClick={() => setEdita(null)}>Cancelar</button>
                </div>
              </div>
            ) : <button type="button" class="btn-texto mini" style="justify-self:start" onClick={() => setEdita({ id: x.id, respuesta: x.respuesta || '', pregunta_publica: x.pregunta_publica || '', publica: !!x.publica })}>{x.respuesta ? 'Cambiar la respuesta' : 'Contestar'}</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- (v0.246, 38) A quién escribir: el toque humano donde más rinde ----------
// lista: los resúmenes de quienes van por su cuenta (los de Atletas). Quién ha marcado una molestia grave, quién lleva diez
// días sin entrenar, quién lleva dos semanas flojas y quién no ha empezado. Con un mensaje preparado para copiar y mandarle
// desde su correo (lo manda Pelayo: la app no envía nada).
export function AQuienEscribir({ lista = [], abrir }) {
  const { backend, aviso } = useApp();
  const hoy = hoyISO();
  const ids = lista.filter((r) => r.estado !== 'baja' && r.estado !== 'invitado').map((r) => r.atleta_id);
  const mas = useCarga(() => (ids.length ? datos.paraEscribir(backend, ids).catch(() => ({ flojos: {}, correos: {} })) : Promise.resolve({ flojos: {}, correos: {} })), [ids.join()], { recuerdo: `escribir-esencial:${ids.join()}` });
  const [abierto, setAbierto] = useState(null);
  if (!mas.datos) return null;
  const filas = aQuienEscribir(lista.filter((r) => ids.includes(r.atleta_id)).map((r) => ({
    atleta_id: r.atleta_id, nombre: r.nombre, estado: r.estado, email: mas.datos.correos[r.atleta_id] || null,
    dias: r.ultimaSesion ? diasEntre(r.ultimaSesion, hoy) : null,
    grave: (r.alertas || []).some((a) => a.tipo === 'molestia' && a.nivel === 'alerta'),
    semanasFalladas: mas.datos.flojos[r.atleta_id] ? 2 : 0,
    sinEmpezar: !r.ultimaSesion && !!r.bloque && (r.semana?.numero || 0) >= 1,
  })));
  if (!filas.length) return null;
  const copiar = async (f) => { try { await navigator.clipboard.writeText(f.cuerpo); aviso('Mensaje copiado: pégalo en tu correo'); } catch { aviso('No se ha podido copiar: selecciónalo a mano', 'error'); } };
  return (
    <section class="ecp-caja" data-ecp="escribir" aria-labelledby="ecp-escribir-t">
      <h2 id="ecp-escribir-t" class="etq">A quién escribir ({filas.length})</h2>
      <ul class="ecp-lista">
        {filas.map((f) => (
          <li key={f.atleta_id} class="ecp-fila">
            <span class="peq"><button type="button" class="btn-texto peq" onClick={() => abrir?.(f.atleta_id)}>{f.nombre}</button> <span class="mini terciario">· {f.motivo}</span></span>
            {abierto === f.atleta_id ? (
              <div class="pila-s">
                <textarea class="ecp-area" rows="8" readOnly value={f.cuerpo} aria-label={`Mensaje para ${f.nombre}`} />
                <div class="fila-envolver">
                  <button type="button" class="btn btn-primario btn-peq" onClick={() => copiar(f)}>Copiar el mensaje</button>
                  <a class="btn btn-peq" href={`mailto:${f.email}?subject=${encodeURIComponent(f.asunto)}`}>Abrir mi correo</a>
                  <button type="button" class="btn btn-peq" onClick={() => setAbierto(null)}>Cerrar</button>
                </div>
                <span class="mini terciario">Es un borrador: cámbialo a tu gusto antes de mandarlo. La app no envía nada.</span>
              </div>
            ) : <button type="button" class="btn-texto mini" style="justify-self:start" onClick={() => setAbierto(f.atleta_id)}>Ver el mensaje preparado</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- (v0.246, 39; migración 100) «¿Cómo vamos?»: la nota que le ponen y lo que echan de menos ----------
export function ComoVamosCoach() {
  const { backend } = useApp();
  const d = useCarga(() => datos.comoVamos(backend), []);
  const r = comoVamosResumen(d.datos || []);
  if (!r) return null;
  return (
    <section class="ecp-caja" data-ecp="vamos" aria-labelledby="ecp-vamos-t">
      <h2 id="ecp-vamos-t" class="etq">«¿Cómo vamos?»: {String(r.media).replace('.', ',')} de 10 ({r.n === 1 ? 'una respuesta' : `${r.n} respuestas`})</h2>
      {r.textos.length > 0 && (
        <ul class="ecp-lista">
          {r.textos.map((t, i) => <li key={i} class="ecp-fila"><span class="peq"><strong>{t.nombre || 'Sin nombre'}</strong> <span class="mini terciario">· {t.nota} de 10</span></span><span class="peq">{t.texto}</span></li>)}
        </ul>
      )}
    </section>
  );
}

// ---------- (59; v0.247) La semana de FBE Esencial, de un vistazo ----------
// Cuántos tienen la semana en marcha, cuántos han entrenado, cuántos la tienen completa, quién está en pausa o de viaje y
// lo que hay por contestar. Sin nombres: para eso están «A quién escribir» y la lista de abajo.
export function ResumenSemana() {
  const { backend } = useApp();
  const d = useCarga(() => datos.semanaDeTodos(backend).catch(() => null), []);
  if (!d.datos) return null;
  const r = resumenCoach(d.datos);
  if (!r.total) return null;
  const cifras = [
    [r.entrenando, 'han entrenado'], [r.completas, 'semana completa'], [r.sinEmpezar, 'sin empezarla'],
    ...(r.pausa ? [[r.pausa, 'en pausa']] : []), ...(r.viaje ? [[r.viaje, 'de viaje']] : []), ...(r.parados ? [[r.parados, 'diez días o más sin entrenar']] : []),
  ];
  return (
    <section class="ecp-caja" data-ecp="semana" aria-labelledby="ecp-semana-t">
      <h2 id="ecp-semana-t" class="etq">Esta semana, en FBE Esencial</h2>
      <p class="peq">{r.frase}</p>
      <ul class="ecp-cifras" aria-label="La semana, en cifras">
        {cifras.map(([n, t]) => <li key={t} class="ecp-cifra"><strong class="num">{n}</strong><span class="mini terciario">{t}</span></li>)}
      </ul>
      {(r.preguntas > 0 || r.nota != null) && (
        <p class="mini terciario">
          {r.preguntas > 0 ? `${r.preguntas === 1 ? 'Una pregunta' : `${r.preguntas} preguntas`} para el directo sin contestar. ` : ''}
          {r.nota != null ? `«¿Cómo vamos?», este mes: ${String(r.nota).replace('.', ',')} de 10 (${r.notas === 1 ? 'una respuesta' : `${r.notas} respuestas`}).` : ''}
        </p>
      )}
    </section>
  );
}
