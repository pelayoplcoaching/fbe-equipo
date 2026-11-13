// (personalización 2) En «Lo tuyo»: cómo te hablamos (en qué género y con qué tono) y qué celebrar y cómo. El género y
// el tono van a la base (los ve su coach); lo de celebrar, a este móvil.
import { useState } from 'preact/hooks';
import { Hoja, useApp } from '../comunes.jsx';
import { GENEROS, TONOS, MOMENTOS_CELEBRAR, MODOS_CELEBRAR, limpiarCelebrar, tratoDe, titularResumen } from '../../logica/trato.js';
import { leerAjustes, guardarAjustes } from '../ajustes.js';
import { vibrar } from '../hapticos.js';

export function HojaTrato({ actual, alCerrar, alGuardar }) {
  const { api, aviso, atleta } = useApp();
  const [genero, setGenero] = useState(actual?.genero || 'n');
  const [tono, setTono] = useState(actual?.tono || 'cercano');
  const [guardando, setGuardando] = useState(false);
  const ejemplo = titularResumen(tratoDe({ ...actual, genero, tono }, atleta?.nombre), { records: 1 });
  const guardar = async () => {
    setGuardando(true);
    try { await api.guardarTrato({ genero, tono }); vibrar('hecho'); aviso('Guardado: a partir de ahora te hablamos así'); alGuardar?.(); }
    catch (e) { aviso(e.message, 'error'); } finally { setGuardando(false); }
  };
  return (
    <Hoja titulo="Cómo te hablamos" alCerrar={alCerrar}>
      <div class="pila trato-hoja">
        <fieldset class="campo"><legend>En qué género</legend>
          <div class="segmentos" role="group" aria-label="En qué género">
            {GENEROS.map(([k, n]) => <button type="button" key={k} aria-pressed={genero === k ? 'true' : 'false'} onClick={() => setGenero(k)}>{n}</button>)}
          </div>
          <span class="mini secundario">Solo para la gramática («¡Bienvenida!», «Estás listo»…). Sin marcar, la app busca formas que no lo marquen.</span>
        </fieldset>
        <fieldset class="campo"><legend>Con qué tono</legend>
          <div class="trato-tonos" role="radiogroup" aria-label="Con qué tono">
            {TONOS.map(([k, n, d]) => (
              <label key={k} class={`trato-tono${tono === k ? ' elegido' : ''}`}>
                <input type="radio" name="trato-tono" checked={tono === k} onChange={() => setTono(k)} />
                <span class="pila-xs"><strong>{n}</strong><span class="mini secundario">{d}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <p class="trato-ejemplo" aria-live="polite"><span class="mini secundario">Así te lo diríamos tras un récord:</span><strong>{ejemplo.titulo}</strong>{ejemplo.sub ? <span> {ejemplo.sub}</span> : null}</p>
        <button type="button" class="btn btn-primario" disabled={guardando} onClick={guardar}>Guardar</button>
      </div>
    </Hoja>
  );
}

export function HojaCelebrar({ alCerrar }) {
  const [c, setC] = useState(() => limpiarCelebrar(leerAjustes().celebrar));
  const cambiar = (k, v) => { const n = { ...c, [k]: v }; setC(n); guardarAjustes({ ...leerAjustes(), celebrar: n }); vibrar('elegir'); };
  return (
    <Hoja titulo="Qué celebrar" alCerrar={alCerrar}>
      <div class="pila celebrar-hoja">
        <p class="peq secundario">Para cada momento, cómo quieres que lo celebremos. Se guarda en este móvil.</p>
        {MOMENTOS_CELEBRAR.map(([k, n]) => (
          <div class="celebrar-fila" key={k}>
            <strong>{n}</strong>
            <div class="segmentos" role="group" aria-label={n}>
              {MODOS_CELEBRAR.map(([m, nm]) => <button type="button" key={m} aria-pressed={c[k] === m ? 'true' : 'false'} onClick={() => cambiar(k, m)}>{nm}</button>)}
            </div>
          </div>
        ))}
      </div>
    </Hoja>
  );
}
export const textoCelebrar = (c) => {
  const v = Object.values(limpiarCelebrar(c));
  return v.every((x) => x === 'todo') ? 'Todo, con todo' : v.every((x) => x === 'nada') ? 'Nada' : 'A tu manera';
};
