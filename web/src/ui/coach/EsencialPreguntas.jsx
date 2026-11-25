// FBE Esencial (acompañamiento, tanda 4; migración 100): en el panel del coach, las preguntas que quienes van por su cuenta
// mandan para el directo del mes. Verlas juntas, apuntar lo que contestó y, si quiere, sacarla en «Respuestas» para todos
// (sin el nombre de quien preguntó y con la pregunta escrita por él). Estilos: ayuda.css (clases ecp-*).
import { useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez } from '../comunes.jsx';
import { fechaLarga } from '../../logica/esencial-alta.js';
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
    <section class="ecp-caja" aria-labelledby="ecp-t">
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
