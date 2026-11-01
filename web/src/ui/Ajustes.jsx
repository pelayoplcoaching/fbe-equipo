/* global __APP_VERSION__ */
import { useState } from 'preact/hooks';
import { Segmentos, Icono, useApp } from './comunes.jsx';
import { leerAjustes, guardarAjustes } from './ajustes.js';
import { prepararAudio, pitar, SONIDOS_DESCANSO } from './atleta/sesion-comun.jsx';
import { hayVoz, hablar } from './voz.js';
import { ACENTOS } from '../logica/acentos.js';
import { puedeVibrar, vibrar } from './hapticos.js';

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
  const { aviso } = useApp();
  const cambiar = (k, v) => { const n = { ...a, [k]: v }; setA(n); guardarAjustes(n); };
  const nombreSonido = (k) => (SONIDOS_DESCANSO.find(([v]) => v === k) || [])[1] || k;
  // Suena el que se ve elegido (no el guardado: por si este navegador no deja guardar) y lo dice
  const probar = (k = a.sonidoDescanso) => { prepararAudio(); pitar(k); aviso(`Suena: ${nombreSonido(k)}`); };
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
          {/* v0.49: negro puro para pantallas OLED, cuando se ve el tema oscuro */}
          {a.tema !== 'claro' && (
            <Interruptor id="aj-oled" texto="Negro puro (OLED)" valor={!!a.oled} alCambiar={(v) => cambiar('oled', v)}
              ayuda={a.tema === 'oscuro' ? 'El fondo, negro del todo: en pantallas OLED gasta menos batería.' : 'Cuando tu móvil esté en oscuro, el fondo será negro del todo (en pantallas OLED gasta menos batería).'} />
          )}
          <li class="panel-pad pila-s">
            <fieldset class="acentos">
              <legend>Color de acento</legend>
              <div class="acentos-lista">
                {ACENTOS.map((c) => (
                  <label key={c.id} class="acento-op" style={{ '--m-claro': c.claro.morado, '--m-oscuro': c.oscuro.morado }}>
                    <input type="radio" name="aj-acento" class="sr" value={c.id} checked={(a.acento || 'morado') === c.id} onChange={() => cambiar('acento', c.id)} />
                    <span class="acento-muestra" aria-hidden="true"><Icono n="hecho" /></span>
                    <span class="acento-nombre">{c.nombre}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <span class="peq terciario">El color de los botones, los enlaces y lo que eliges. Todos se leen bien en claro y en oscuro.</span>
          </li>
          {!coach && (
            <>
              <Interruptor id="aj-sonido" texto="Sonido al acabar el descanso" ayuda="Y al batir un récord o ganar un disco" valor={a.sonido} alCambiar={(v) => cambiar('sonido', v)} />
              {a.sonido && (
                <li class="panel-pad pila-s">
                  <label for="aj-sonido-descanso">Qué suena</label>
                  <div class="fila-envolver">
                    <select id="aj-sonido-descanso" class="selector" style="flex:1;min-width:180px" value={a.sonidoDescanso} onChange={(e) => { const v = e.currentTarget.value; cambiar('sonidoDescanso', v); probar(v); }}>
                      {SONIDOS_DESCANSO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                    <button class="btn btn-peq" onClick={() => probar()}><Icono n="altavoz" /> Probar</button>
                  </div>
                  <label for="aj-volumen" class="separa"><span>Volumen</span><span class="peq terciario num">{Math.round((Number(a.volumen) || 1) * 100)} %</span></label>
                  <input id="aj-volumen" type="range" min="0.1" max="1" step="0.1" value={a.volumen} onChange={(e) => cambiar('volumen', Number(e.currentTarget.value))} />
                  <span class="peq terciario">Los mismos sonidos que FBE Timer. Si se oye bajo, sube también el volumen del móvil.</span>
                </li>
              )}
              {a.sonido && <Interruptor id="aj-cuenta" texto="Pitidos en los 3 últimos segundos" ayuda="Para saber que el descanso se acaba sin mirar el móvil" valor={a.cuentaAtras} alCambiar={(v) => cambiar('cuentaAtras', v)} />}
              {/* v0.48: el entrenador por voz (Web Speech), apagado de entrada; donde el navegador no habla, desactivado */}
              <Interruptor id="aj-voz" texto="Entrenador por voz" desactivado={!hayVoz()}
                ayuda={hayVoz() ? 'Te dice la siguiente serie («Serie 3 de press banca: 80 kilos por 6»), los últimos segundos del descanso y la última serie. La música sigue sonando (baja un momento mientras habla).' : 'Este navegador no puede hablar: los avisos del descanso siguen con su sonido.'}
                valor={!!a.voz && hayVoz()} alCambiar={(v) => { cambiar('voz', v); if (v) hablar('Serie 1 de press banca: 60 kilos por 8.', { forzar: true }); }} />
              {a.voz && hayVoz() && <li class="panel-pad separa"><span class="peq secundario">¿Se oye bien?</span><button class="btn btn-peq" onClick={() => hablar('Serie 3 de sentadilla: 80 kilos por 6. Última serie.', { forzar: true })}><Icono n="altavoz" /> Probar la voz</button></li>}
              <Interruptor id="aj-vibracion" texto="Vibración al acabar el descanso" ayuda="Y en el metrónomo y los intervalos, en los móviles que la permiten" valor={a.vibracion} alCambiar={(v) => cambiar('vibracion', v)} />
              {/* v0.49: la vibración al tocar, con su propio interruptor (de serie, encendida) */}
              <Interruptor id="aj-hapticos" texto="Vibración al tocar" desactivado={!puedeVibrar()}
                ayuda={puedeVibrar() ? 'Un toque corto al marcar una serie, al batir un récord y al enviar el check-in.' : 'Este navegador no deja vibrar a las webs (en iPhone, Safari no lo permite).'}
                valor={a.hapticos !== false && puedeVibrar()} alCambiar={(v) => { cambiar('hapticos', v); if (v) setTimeout(() => vibrar('serie'), 0); }} />
              <Interruptor id="aj-pantalla" texto="Pantalla encendida durante la sesión" ayuda="Para no tener que desbloquear el móvil entre series" valor={a.pantalla} alCambiar={(v) => cambiar('pantalla', v)} />
              <Interruptor id="aj-peso-cifra" texto="Ver los kilos en Hoy" ayuda="Y en el resumen de tu semana. De serie, te dice cómo va tu peso respecto a tu objetivo, sin la cifra; la gráfica sigue en Progreso" valor={a.pesoCifra} alCambiar={(v) => cambiar('pesoCifra', v)} />
              <li class="panel-pad separa">
                <span class="peq secundario">¿Se oye y vibra bien?</span>
                <button class="btn btn-peq" onClick={() => probar()}>Probar el aviso</button>
              </li>
              <li class="panel-pad"><span class="mini terciario">FBE Equipo, versión {String(__APP_VERSION__)}</span></li>
            </>
          )}
        </ul>
      </div>
    </section>
  );
}
