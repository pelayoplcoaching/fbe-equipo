import { useState } from 'preact/hooks';
import { Segmentos, Icono } from './comunes.jsx';
import { leerAjustes, guardarAjustes } from './ajustes.js';
import { prepararAudio, pitar, SONIDOS_DESCANSO } from './atleta/sesion-comun.jsx';

const TEMAS = [['sistema', 'Sistema'], ['claro', 'Claro'], ['oscuro', 'Oscuro']];

export function Interruptor({ id, texto, ayuda, valor, alCambiar, desactivado = false }) {
  return (
    <li class="panel-pad interruptor-fila">
      <label for={id} class="pila-xs"><span>{texto}</span>{ayuda && <span class="peq terciario">{ayuda}</span>}</label>
      <input id={id} type="checkbox" role="switch" class="interruptor" checked={valor} disabled={desactivado} onChange={(e) => alCambiar(e.currentTarget.checked)} />
    </li>
  );
}

// Ajustes de este dispositivo: tema, sonido, vibración y pantalla encendida (el coach solo ve el tema)
export function AjustesDispositivo({ coach = false }) {
  const [a, setA] = useState(leerAjustes);
  const cambiar = (k, v) => { const n = { ...a, [k]: v }; setA(n); guardarAjustes(n); };
  return (
    <section class="seccion">
      <h2>En este {coach ? 'dispositivo' : 'móvil'}</h2>
      <div class="panel">
        <ul class="lista">
          <li class="panel-pad pila-s">
            <span>Tema</span>
            <Segmentos opciones={TEMAS} valor={a.tema} etiqueta="Tema" alCambiar={(v) => cambiar('tema', v || 'sistema')} />
            <span class="peq terciario">Con «Sistema», claro u oscuro según tu móvil u ordenador.</span>
          </li>
          {!coach && (
            <>
              <Interruptor id="aj-sonido" texto="Sonido al acabar el descanso" ayuda="Y al batir un récord o ganar un disco" valor={a.sonido} alCambiar={(v) => cambiar('sonido', v)} />
              {a.sonido && (
                <li class="panel-pad pila-s">
                  <label for="aj-sonido-descanso">Qué suena</label>
                  <div class="fila-envolver">
                    <select id="aj-sonido-descanso" class="selector" style="flex:1;min-width:180px" value={a.sonidoDescanso} onChange={(e) => { const v = e.currentTarget.value; cambiar('sonidoDescanso', v); prepararAudio(); setTimeout(() => pitar(v), 60); }}>
                      {SONIDOS_DESCANSO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                    <button class="btn btn-peq" onClick={() => { prepararAudio(); setTimeout(() => pitar(), 60); }}><Icono n="altavoz" /> Probar</button>
                  </div>
                  <label for="aj-volumen" class="separa"><span>Volumen</span><span class="peq terciario num">{Math.round((Number(a.volumen) || 1) * 100)} %</span></label>
                  <input id="aj-volumen" type="range" min="0.1" max="1" step="0.1" value={a.volumen} onChange={(e) => cambiar('volumen', Number(e.currentTarget.value))} />
                  <span class="peq terciario">Los mismos sonidos que FBE Timer. Suenan con el volumen multimedia del móvil (en iPhone, el de los botones laterales manda).</span>
                </li>
              )}
              {a.sonido && <Interruptor id="aj-cuenta" texto="Pitidos en los 3 últimos segundos" ayuda="Para saber que el descanso se acaba sin mirar el móvil" valor={a.cuentaAtras} alCambiar={(v) => cambiar('cuentaAtras', v)} />}
              <Interruptor id="aj-vibracion" texto="Vibración" ayuda="En los móviles que la permiten" valor={a.vibracion} alCambiar={(v) => cambiar('vibracion', v)} />
              <Interruptor id="aj-pantalla" texto="Pantalla encendida durante la sesión" ayuda="Para no tener que desbloquear el móvil entre series" valor={a.pantalla} alCambiar={(v) => cambiar('pantalla', v)} />
              <li class="panel-pad separa">
                <span class="peq secundario">¿Se oye y vibra bien?</span>
                <button class="btn btn-peq" onClick={() => { prepararAudio(); setTimeout(pitar, 60); }}>Probar el aviso</button>
              </li>
            </>
          )}
        </ul>
      </div>
    </section>
  );
}
