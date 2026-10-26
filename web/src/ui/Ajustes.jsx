import { useState } from 'preact/hooks';
import { Segmentos } from './comunes.jsx';
import { leerAjustes, guardarAjustes } from './ajustes.js';
import { prepararAudio, pitar } from './atleta/sesion-comun.jsx';

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
