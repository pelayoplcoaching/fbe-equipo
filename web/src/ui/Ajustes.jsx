/* global __APP_VERSION__ */
import { useEffect, useState } from 'preact/hooks';
import { Segmentos, Icono, useApp, Hoja, GrupoIos, FilaIos, IcoIos } from './comunes.jsx';
import { leerAjustes, guardarAjustes, TAMANOS_LETRA } from './ajustes.js';
import { prepararAudio, pitar, SONIDOS_DESCANSO } from './atleta/sesion-comun.jsx';
import { hayVoz, hablar } from './voz.js';
import { plataformaPistaAqui, prepararPista, probarPista, frasesDelCoach, pararPista, descansoSonando } from './pista-descanso.js';
import { ACENTOS } from '../logica/acentos.js';
import { puedeVibrar, vibrar } from './hapticos.js';
import { DESCANSOS_ATLETA, mmss } from '../logica/calculos.js';
import { puedeDifuminar } from './tecnica/Difuminar.jsx';
import { leerRed, mostrarOpcionWifi } from '../logica/red.js';

const TEMAS = [['sistema', 'Sistema'], ['claro', 'Claro'], ['oscuro', 'Oscuro']];
export const VERSION_APP = typeof __APP_VERSION__ === 'undefined' ? '' : String(__APP_VERSION__);

// icono (v0.50): con él, la fila lleva su cuadrito a la izquierda, como el resto de la lista agrupada
export function Interruptor({ id, texto, ayuda, valor, alCambiar, desactivado = false, icono = null, tono = '' }) {
  return (
    <li class={`panel-pad interruptor-fila${icono ? ' fila-ios con-ico' : ''}`}>
      {icono && <IcoIos n={icono} tono={tono} />}
      <label for={id} class="pila-xs"><span>{texto}</span>{ayuda && <span class="peq terciario">{ayuda}</span>}</label>
      <input id={id} type="checkbox" role="switch" class="interruptor" checked={valor} disabled={desactivado} onChange={(e) => alCambiar(e.currentTarget.checked)} />
    </li>
  );
}

// Ajustes de este dispositivo (v0.50, en lista agrupada): tema, negro puro, acento y tamaño de la letra; en el móvil
// del atleta, además, «Sonido y vibración» (en su hoja), la pantalla encendida y los kilos en Hoy. El coach solo ve
// lo de la pantalla. antes: filas que van al principio del grupo (las notificaciones de este móvil).
export function AjustesDispositivo({ coach = false, antes = null }) {
  const { modo } = useApp() || {};
  const [a, setA] = useState(leerAjustes);
  const [sonido, setSonido] = useState(false);
  const cambiar = (k, v) => { const n = { ...a, [k]: v }; setA(n); guardarAjustes(n); };
  const resumenSonido = [a.sonido ? 'Sonido' : 'Sin sonido', a.voz && hayVoz() ? 'voz' : null, a.sonido && a.vozBloqueo && plataformaPistaAqui() ? 'avisa con el móvil bloqueado' : null, a.vibracion ? 'vibración' : null,
    a.descansoDefecto ? `descanso ${mmss(a.descansoDefecto)}` : 'sin descanso automático'].filter(Boolean).join(', ');
  return (
    <>
    <GrupoIos titulo={`Este ${coach ? 'dispositivo' : 'móvil'}`} id="grupo-este-movil">
      {antes}
      <FilaIos icono="tema" titulo="Tema" detalle="Con «Sistema», claro u oscuro según tu móvil u ordenador."
        bloque={<Segmentos opciones={TEMAS} valor={a.tema} etiqueta="Tema" alCambiar={(v) => cambiar('tema', v || 'sistema')} />} />
      {/* v0.49: negro puro para pantallas OLED, cuando se ve el tema oscuro */}
      {a.tema !== 'claro' && (
        <Interruptor id="aj-oled" icono="sueno" texto="Negro puro (OLED)" valor={!!a.oled} alCambiar={(v) => cambiar('oled', v)}
          ayuda={a.tema === 'oscuro' ? 'El fondo, negro del todo: en pantallas OLED gasta menos batería.' : 'Cuando tu móvil esté en oscuro, el fondo será negro del todo (en pantallas OLED gasta menos batería).'} />
      )}
      <li class="fila-ios fila-ios-bloque">
        <IcoIos n="paleta" />
        <fieldset class="acentos fila-ios-texto">
          <legend class="fila-ios-titulo">Color de acento</legend>
          <div class="acentos-lista">
            {ACENTOS.map((c) => (
              <label key={c.id} class="acento-op" style={{ '--m-claro': c.claro.morado, '--m-oscuro': c.oscuro.morado }}>
                <input type="radio" name="aj-acento" class="sr" value={c.id} checked={(a.acento || 'morado') === c.id} onChange={() => cambiar('acento', c.id)} />
                <span class="acento-muestra" aria-hidden="true"><Icono n="hecho" /></span>
                <span class="acento-nombre">{c.nombre}</span>
              </label>
            ))}
          </div>
          <span class="peq terciario">El color de los botones, los enlaces y lo que eliges. Todos se leen bien en claro y en oscuro.</span>
        </fieldset>
      </li>
      {/* v0.50: el tamaño de la letra de toda la app (se guarda en este móvil, como el tema) */}
      <FilaIos icono="letra" titulo="Tamaño de la letra" detalle="Para toda la app. Las cifras y los botones crecen con ella."
        bloque={<Segmentos clase="segmentos-letra" opciones={TAMANOS_LETRA.map(([k, t]) => [k, t])} valor={a.letra || 'normal'} etiqueta="Tamaño de la letra" alCambiar={(v) => cambiar('letra', v || 'normal')} />} />
      {!coach && (
        <>
          <FilaIos icono="altavoz" titulo="Sonido y vibración" detalle={resumenSonido} alTocar={() => setSonido(true)} etiqueta={`Sonido y vibración: ${resumenSonido}`} />
          <Interruptor id="aj-pantalla" icono="movil" texto="Pantalla encendida durante la sesión" ayuda="Para no tener que desbloquear el móvil entre series" valor={a.pantalla} alCambiar={(v) => cambiar('pantalla', v)} />
          {/* v0.63 (1): el teclado de la app al apuntar las series (apagado, el del móvil, como antes) */}
          <Interruptor id="aj-teclado" icono="teclado" texto="Teclado de la app al apuntar las series" ayuda="Teclas grandes, −/+ con el salto de cada ejercicio y «Siguiente» de los kilos a las repeticiones, al RPE y a marcar la serie. Apagado, sale el teclado del móvil" valor={a.tecladoApp !== false} alCambiar={(v) => cambiar('tecladoApp', v)} />
          {/* v0.60 (13): «Difuminar la cara» encendido de serie al enviar un vídeo (en este móvil) */}
          {puedeDifuminar(modo === 'demo') && <Interruptor id="aj-difuminar" icono="cara" texto="Difuminar la cara al enviar un vídeo" ayuda="Encendido de serie en la hoja de enviar (puedes apagarlo en cada vídeo). Se hace en el móvil: el original no sale de él" valor={!!a.difuminarCara} alCambiar={(v) => cambiar('difuminarCara', v)} />}
          {/* v0.61 (20): solo donde el navegador dice si la conexión es wifi o datos móviles (Chrome de Android); en el iPhone
              y en el ordenador no se puede saber, así que no sale (no funcionaría) */}
          {mostrarOpcionWifi(leerRed()) && <Interruptor id="aj-solo-wifi" icono="enviar" texto="Subir los vídeos solo con wifi" ayuda={`Con datos móviles, el vídeo espera en el móvil («Esperando wifi») y sale solo al conectarte a una wifi; puedes subirlo antes con «Subir ahora».${leerRed().ahorro ? ' Tienes el ahorro de datos del móvil activado: con esta opción encendida, los vídeos no gastan tus datos.' : ''}`} valor={!!a.soloWifi} alCambiar={(v) => cambiar('soloWifi', v)} />}
          <Interruptor id="aj-peso-cifra" icono="bascula" texto="Ver los kilos en Hoy" ayuda="Y en el resumen de tu semana. De serie, te dice cómo va tu peso respecto a tu objetivo, sin la cifra; la gráfica sigue en Progreso" valor={a.pesoCifra} alCambiar={(v) => cambiar('pesoCifra', v)} />
        </>
      )}
    </GrupoIos>
    {sonido && <HojaSonido a={a} cambiar={cambiar} alCerrar={() => setSonido(false)} />}
    </>
  );
}

// Sonido, voz y vibración del descanso (v0.50: en su hoja, para que el perfil se lea de un vistazo). v0.52.2: y el
// descanso que arranca solo si el coach no ha puesto uno
function HojaSonido({ a, cambiar, alCerrar }) {
  const { aviso } = useApp();
  const nombreSonido = (k) => (SONIDOS_DESCANSO.find(([v]) => v === k) || [])[1] || k;
  // Suena el que se ve elegido (no el guardado: por si este navegador no deja guardar) y lo dice
  const probar = (k = a.sonidoDescanso) => { prepararAudio(); pitar(k); aviso(`Suena: ${nombreSonido(k)}`); };
  const plataforma = plataformaPistaAqui();
  return (
    <Hoja titulo="Sonido y vibración" alCerrar={alCerrar}>
      <div class="panel grupo-ios-hoja">
        <ul class="lista">
          <li class="panel-pad pila-s">
            <label for="aj-descanso-defecto">Descanso si tu coach no lo pone</label>
            <select id="aj-descanso-defecto" class="selector" aria-describedby="aj-descanso-defecto-ayuda" value={String(a.descansoDefecto)}
              onChange={(e) => { const v = Number(e.currentTarget.value); cambiar('descansoDefecto', v); }}>
              {DESCANSOS_ATLETA.map((v) => <option key={v} value={String(v)}>{v ? mmss(v) : 'Sin descanso automático'}</option>)}
            </select>
            <span class="peq terciario" id="aj-descanso-defecto-ayuda">Arranca solo al marcar una serie de un ejercicio en el que tu coach no te ha puesto descanso. Para un ejercicio en concreto, elige otro en su «Más», en «Descanso».</span>
          </li>
          <Interruptor id="aj-sonido" icono="altavoz" texto="Sonido al acabar el descanso" ayuda="Y al batir un récord o ganar un disco" valor={a.sonido} alCambiar={(v) => cambiar('sonido', v)} />
          {a.sonido && (
            <li class="panel-pad pila-s">
              <label for="aj-sonido-descanso">Qué suena</label>
              <div class="fila-envolver">
                <select id="aj-sonido-descanso" class="selector" style="flex:1;min-width:11rem" value={a.sonidoDescanso} onChange={(e) => { const v = e.currentTarget.value; cambiar('sonidoDescanso', v); probar(v); }}>
                  {SONIDOS_DESCANSO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
                <button class="btn btn-peq" onClick={() => probar()}><Icono n="altavoz" /> Probar</button>
              </div>
              <label for="aj-volumen" class="separa"><span>Volumen</span><span class="peq terciario num">{Math.round((Number(a.volumen) || 1) * 100)} %</span></label>
              <input id="aj-volumen" type="range" min="0.1" max="1" step="0.1" value={a.volumen} onChange={(e) => cambiar('volumen', Number(e.currentTarget.value))} />
              <span class="peq terciario">Los mismos sonidos que FBE Timer. Si se oye bajo, sube también el volumen del móvil.</span>
            </li>
          )}
          {a.sonido && <Interruptor id="aj-cuenta" icono="reloj" texto="Pitidos en los 3 últimos segundos" ayuda="Para saber que el descanso se acaba sin mirar el móvil" valor={a.cuentaAtras} alCambiar={(v) => cambiar('cuentaAtras', v)} />}
          {/* v0.48: el entrenador por voz (Web Speech), apagado de entrada; donde el navegador no habla, desactivado */}
          <Interruptor id="aj-voz" icono="mensaje" texto="Entrenador por voz" desactivado={!hayVoz()}
            ayuda={hayVoz() ? 'Te dice la siguiente serie («Serie 3 de press banca: 80 kilos por 6»), los últimos segundos del descanso y la última serie. La música sigue sonando (baja un momento mientras habla).' : 'Este navegador no puede hablar: los avisos del descanso siguen con su sonido.'}
            valor={!!a.voz && hayVoz()} alCambiar={(v) => { cambiar('voz', v); if (v) hablar('Serie 1 de press banca: 60 kilos por 8.', { forzar: true }); }} />
          {a.voz && hayVoz() && <li class="panel-pad separa"><span class="peq secundario">¿Se oye bien?</span><button class="btn btn-peq" onClick={() => hablar('Serie 3 de sentadilla: 80 kilos por 6. Última serie.', { forzar: true })}><Icono n="altavoz" /> Probar la voz</button></li>}
          {/* v0.62: el aviso con el móvil bloqueado (la pista del descanso). Solo donde puede funcionar: iPhone con Safari 16.4 o
              más (la app de inicio o Safari) y Android; en el ordenador no sale. Apagado de serie: pausa la música de otras apps */}
          {a.sonido && plataforma && (
            <Interruptor id="aj-bloqueo" icono="candado" texto="Avisar aunque bloquees el móvil" valor={!!a.vozBloqueo}
              ayuda={`Suena el aviso al acabar el descanso aunque el móvil esté bloqueado${plataforma === 'ios' ? ' o en silencio' : ''}, y la pantalla de bloqueo enseña lo que queda. A cambio, tu música (${plataforma === 'ios' ? 'Spotify, Apple Music' : 'Spotify, YouTube Music'}…) se pausa en cada descanso y tienes que volver a darle a play.${a.voz && frasesDelCoach() ? ' Con el móvil bloqueado, la cuenta y el final los dice la voz grabada de tu coach.' : ' Con el móvil bloqueado suena el aviso (un sonido), no la voz: la voz del móvil solo habla con la app delante.'}`}
              alCambiar={(v) => { cambiar('vozBloqueo', v); if (v) setTimeout(() => prepararPista(), 0); else pararPista(); }} />
          )}
          {a.sonido && plataforma && a.vozBloqueo && (() => {
            // (con un descanso de verdad sonando, no: la prueba lo cambiaría por la suya)
            const ocupado = descansoSonando();
            return (
              <li class="panel-pad separa">
                <span class="peq secundario" id="aj-probar-bloqueo-ayuda">{ocupado ? 'Tienes un descanso en marcha: pruébalo cuando acabe' : 'Bloquea el móvil y espera 10 segundos'}</span>
                <button class="btn btn-peq" disabled={ocupado} aria-describedby="aj-probar-bloqueo-ayuda" onClick={() => {
                  prepararAudio();
                  const r = probarPista(10);
                  if (r === 'ocupado') aviso('Tienes un descanso en marcha: pruébalo cuando acabe', 'error');
                  else aviso(r ? 'Bloquea el móvil: en 10 segundos suena el aviso' : 'Aún se está preparando: vuelve a probar en un momento', r ? undefined : 'error');
                }}><Icono n="candado" /> Probar con el móvil bloqueado</button>
              </li>
            );
          })()}
          <Interruptor id="aj-vibracion" icono="vibrar" texto="Vibración al acabar el descanso" ayuda="Y en el metrónomo y los intervalos, en los móviles que la permiten" valor={a.vibracion} alCambiar={(v) => cambiar('vibracion', v)} />
          {/* v0.49: la vibración al tocar, con su propio interruptor (de serie, encendida) */}
          <Interruptor id="aj-hapticos" icono="vibrar" texto="Vibración al tocar" desactivado={!puedeVibrar()}
            ayuda={puedeVibrar() ? 'Un toque corto al marcar una serie, al batir un récord y al enviar el check-in.' : 'Este navegador no deja vibrar a las webs (en iPhone, Safari no lo permite).'}
            valor={a.hapticos !== false && puedeVibrar()} alCambiar={(v) => { cambiar('hapticos', v); if (v) setTimeout(() => vibrar('serie'), 0); }} />
          <li class="panel-pad separa">
            <span class="peq secundario">¿Se oye y vibra bien?</span>
            <button class="btn btn-peq" onClick={() => probar()}>Probar el aviso</button>
          </li>
        </ul>
      </div>
    </Hoja>
  );
}

// v0.54: los mensajes. «Mostrar cuándo estoy en línea» se guarda en la cuenta (la base la respeta: sin ella, no se
// guarda tu última conexión ni compartes «en línea», y tampoco ves la de la otra parte, como en WhatsApp); «Fondo del
// chat», en este móvil.
export function AjustesMensajes({ coach = false }) {
  const { api, aviso } = useApp();
  const [a, setA] = useState(leerAjustes);
  const [visible, setVisible] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { let vivo = true; api.miPresencia().then((p) => vivo && setVisible(p.visible !== false)).catch(() => vivo && setVisible(true)); return () => { vivo = false; }; }, []);
  const cambiar = (k, v) => { const n = { ...a, [k]: v }; setA(n); guardarAjustes(n); };
  async function cambiarVisible(v) {
    setOcupado(true);
    try {
      const r = await api.marcarPresencia(v);
      setVisible(r?.visible !== false);
      api.reiniciarChats?.();
      window.dispatchEvent(new Event('fbe-presencia'));
      aviso(v ? 'Ahora se ve cuándo estás en línea' : 'Ya no se ve cuándo estás en línea');
    } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  }
  const otro = coach ? 'tus atletas' : 'tu coach';
  return (
    <GrupoIos titulo="Mensajes" id="grupo-mensajes" pie="El fondo, los sonidos y las fotos en HD se guardan en este móvil; lo de «en línea», en tu cuenta.">
      <Interruptor id="aj-en-linea" icono="ojo" texto="Mostrar cuándo estoy en línea" valor={visible !== false} desactivado={visible === null || ocupado}
        ayuda={`Con esto, ${otro} ve${coach ? 'n' : ''} cuándo estás en el chat y tu última conexión («últ. vez hoy a las 18:42»). Si lo apagas, no se guarda y tú tampoco verás la suya.`}
        alCambiar={cambiarVisible} />
      <FilaIos icono="imagen" titulo="Fondo del chat" detalle={a.fondoChat === 'liso' ? 'Liso' : 'Con dibujos de FBE, muy suaves (con el negro puro, liso)'}
        bloque={<Segmentos opciones={[['dibujos', 'Con dibujos'], ['liso', 'Liso']]} valor={a.fondoChat || 'dibujos'} etiqueta="Fondo del chat" alCambiar={(v) => cambiar('fondoChat', v || 'dibujos')} />} />
      <Interruptor id="aj-sonidos-chat" icono="altavoz" texto="Sonidos del chat" valor={a.sonidosChat !== false}
        ayuda="Un tono suave al enviar y al recibir un mensaje, solo con el chat abierto (nunca en una conversación silenciada)." alCambiar={(v) => cambiar('sonidosChat', v)} />
      <Interruptor id="aj-fotos-hd" icono="imagen" texto="Enviar las fotos en HD" valor={a.fotosHd === true}
        ayuda="Más grandes (y más pesadas). Siempre se envían sin los datos de la foto (ubicación, móvil)." alCambiar={(v) => cambiar('fotosHd', v)} />
    </GrupoIos>
  );
}
