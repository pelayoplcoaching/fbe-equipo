/* global __APP_VERSION__ */
import { useEffect, useRef, useState } from 'preact/hooks';
import { Segmentos, Icono, useApp, Hoja, GrupoIos, FilaIos, IcoIos } from './comunes.jsx';
import { leerAjustes, guardarAjustes, TAMANOS_LETRA } from './ajustes.js';
import { prepararAudio, pitar, sonarSerie, SONIDOS_DESCANSO } from './atleta/sesion-comun.jsx';
import { hayVoz, hablar, vocesEspanol } from './voz.js';
import { PruebaSonido } from './PruebaSonido.jsx';
import { sonarFBE, sonarTanda, empezarPaisaje } from './sonido.js';
import { APARTADOS, PERFILES, perfilDe, ESCUCHAR } from '../logica/sonido.js';
import { plataformaPistaAqui, prepararPista, probarPista, frasesDelCoach, pararPista, descansoSonando } from './pista-descanso.js';
import { ACENTOS } from '../logica/acentos.js';
import { puedeVibrar, puedeTocar, vibrar } from './hapticos.js';
import { sinMovimiento } from './transiciones.js';
import { DESCANSOS_ATLETA, mmss } from '../logica/calculos.js';
import { puedeDifuminar } from './tecnica/Difuminar.jsx';
import { leerRed, mostrarOpcionWifi } from '../logica/red.js';

// (diseño, tanda 21) con su icono: el sol y la luna giran al elegirse (diseno.css, bloque 64)
const TEMAS = [['sistema', <><Icono n="movil" class="seg-ico" /> Sistema</>], ['claro', <><Icono n="sol" class="seg-ico" /> Claro</>], ['oscuro', <><Icono n="luna" class="seg-ico" /> Oscuro</>]];
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
  // (sonido, tanda 1) varios a la vez (un perfil de sonido)
  const cambiarVarios = (o) => { const n = { ...a, ...o }; setA(n); guardarAjustes(n); };
  // (diseño, tanda 21) el tema cambia fundiéndose (transición de vista de todo el documento), no a golpe
  const cambiarTema = (t) => {
    const r = typeof document !== 'undefined' ? document.documentElement : null;
    if (!r || typeof document.startViewTransition !== 'function' || sinMovimiento() || r.dataset.vt) { cambiar('tema', t); return; }
    r.dataset.vt = 'tema';
    let vt;
    try { vt = document.startViewTransition(() => cambiar('tema', t)); } catch { delete r.dataset.vt; cambiar('tema', t); return; }
    const fin = () => { if (r.dataset.vt === 'tema') delete r.dataset.vt; };
    vt.finished.then(fin, fin);
  };
  const resumenSonido = [a.sonido ? 'Sonido' : 'Sin sonido', a.voz && hayVoz() ? 'voz' : null, a.sonido && a.vozBloqueo && plataformaPistaAqui() ? 'avisa con el móvil bloqueado' : null, a.vibracion ? 'vibración' : null,
    a.descansoDefecto ? `descanso ${mmss(a.descansoDefecto)}` : 'sin descanso automático'].filter(Boolean).join(', ');
  return (
    <>
    <GrupoIos titulo={`Este ${coach ? 'dispositivo' : 'móvil'}`} id="grupo-este-movil">
      {antes}
      <FilaIos icono="tema" titulo="Tema" detalle="Con «Sistema», claro u oscuro según tu móvil u ordenador."
        bloque={<Segmentos opciones={TEMAS} valor={a.tema} etiqueta="Tema" alCambiar={(v) => cambiarTema(v || 'sistema')} />} />
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
      {/* (color, mejoras 17 y 18) más contraste y ayuda para daltonismo */}
      <Interruptor id="aj-contraste" icono="sol" texto="Alto contraste" ayuda="Textos y líneas al máximo, para ver mejor o entrenar con mucha luz" valor={!!a.altoContraste} alCambiar={(v) => cambiar('altoContraste', v)} />
      <Interruptor id="aj-daltonismo" icono="ojo-abierto" texto="Ayuda para daltonismo" ayuda="Lo hecho, en azul, y lo que falta o va mal, en naranja, en vez de verde y rojo" valor={!!a.daltonismo} alCambiar={(v) => cambiar('daltonismo', v)} />
      {/* v0.50: el tamaño de la letra de toda la app (se guarda en este móvil, como el tema) */}
      <FilaIos icono="letra" titulo="Tamaño de la letra" detalle="Para toda la app. Las cifras y los botones crecen con ella."
        bloque={<Segmentos clase="segmentos-letra" opciones={TAMANOS_LETRA.map(([k, t]) => [k, t])} valor={a.letra || 'normal'} etiqueta="Tamaño de la letra" alCambiar={(v) => cambiar('letra', v || 'normal')} />} />
      {/* v0.66: modo gimnasio */}
      {!coach && <Interruptor id="aj-gimnasio" icono="hoy" texto="Modo gimnasio" valor={!!a.gimnasio} alCambiar={(v) => cambiar('gimnasio', v)}
        ayuda="En la sesión: cifras y botones más grandes y más contraste, para leer con poca luz o con el móvil en el banco." />}
      {!coach && (
        <>
          <FilaIos icono="altavoz" titulo="Sonido y vibración" detalle={resumenSonido} alTocar={() => setSonido(true)} etiqueta={`Sonido y vibración: ${resumenSonido}`} />
          <Interruptor id="aj-pantalla" icono="movil" texto="Pantalla encendida durante la sesión" ayuda="Para no tener que desbloquear el móvil entre series" valor={a.pantalla} alCambiar={(v) => cambiar('pantalla', v)} />
          {/* v0.63 (1): el teclado de la app al apuntar las series (apagado, el del móvil, como antes) */}
          <Interruptor id="aj-teclado" icono="teclado" texto="Teclado de la app al apuntar las series" ayuda="Teclas grandes, −/+ con el salto de cada ejercicio y «Siguiente» de los kilos a las repeticiones, al RPE y a marcar la serie. Apagado, sale el teclado del móvil" valor={a.tecladoApp !== false} alCambiar={(v) => cambiar('tecladoApp', v)} />
          {/* v0.112: kilos o libras para las cargas del entreno (en este móvil; la base y tu coach, en kilos) */}
          <FilaIos icono="disco" titulo="Unidad de las cargas" detalle={a.unidadPeso === 'lb' ? 'En libras: lo que apuntas se guarda en kilos (tu coach lo ve en kilos). Tu peso corporal sigue en kilos.' : 'Si tus discos y mancuernas van en libras, cámbialo aquí. Tu coach lo seguirá viendo en kilos.'}
            bloque={<Segmentos opciones={[['kg', 'Kilos (kg)'], ['lb', 'Libras (lb)']]} valor={a.unidadPeso === 'lb' ? 'lb' : 'kg'} etiqueta="Unidad de las cargas" alCambiar={(v) => cambiar('unidadPeso', v || 'kg')} />} />
          {/* v0.60 (13): «Difuminar la cara» encendido de serie al enviar un vídeo (en este móvil) */}
          {puedeDifuminar(modo === 'demo') && <Interruptor id="aj-difuminar" icono="cara" texto="Difuminar la cara al enviar un vídeo" ayuda="Encendido de serie en la hoja de enviar (puedes apagarlo en cada vídeo). Se hace en el móvil: el original no sale de él" valor={!!a.difuminarCara} alCambiar={(v) => cambiar('difuminarCara', v)} />}
          {/* v0.61 (20): solo donde el navegador dice si la conexión es wifi o datos móviles (Chrome de Android); en el iPhone
              y en el ordenador no se puede saber, así que no sale (no funcionaría) */}
          {mostrarOpcionWifi(leerRed()) && <Interruptor id="aj-solo-wifi" icono="enviar" texto="Subir los vídeos solo con wifi" ayuda={`Con datos móviles, el vídeo espera en el móvil («Esperando wifi») y sale solo al conectarte a una wifi; puedes subirlo antes con «Subir ahora».${leerRed().ahorro ? ' Tienes el ahorro de datos del móvil activado: con esta opción encendida, los vídeos no gastan tus datos.' : ''}`} valor={!!a.soloWifi} alCambiar={(v) => cambiar('soloWifi', v)} />}
          <Interruptor id="aj-peso-cifra" icono="bascula" texto="Ver los kilos en Hoy" ayuda="Y en el resumen de tu semana. De serie, te dice cómo va tu peso respecto a tu objetivo, sin la cifra; la gráfica sigue en Progreso" valor={a.pesoCifra} alCambiar={(v) => cambiar('pesoCifra', v)} />
        </>
      )}
    </GrupoIos>
    {sonido && <HojaSonido a={a} cambiar={cambiar} cambiarVarios={cambiarVarios} alCerrar={() => setSonido(false)} />}
    </>
  );
}

// Sonido, voz y vibración del descanso (v0.50: en su hoja, para que el perfil se lea de un vistazo). v0.52.2: y el
// descanso que arranca solo si el coach no ha puesto uno
function HojaSonido({ a, cambiar, cambiarVarios, alCerrar }) {
  const { aviso } = useApp();
  // (sonido, tanda 1) «Escuchar todos»: la familia entera, en orden, con el nombre de lo que suena
  const [oyendo, setOyendo] = useState(null);
  const pararTanda = useRef(null);
  useEffect(() => () => pararTanda.current?.(), []);
  const escucharTodos = () => {
    if (pararTanda.current) { pararTanda.current(); pararTanda.current = null; return; }
    prepararAudio();
    const lista = ESCUCHAR.flatMap(([k, nombre, datos]) => (datos || [{}]).map((d, i) => [k, d, nombre + (datos && datos.length > 1 ? ` (${i + 1})` : '')]));
    pararTanda.current = sonarTanda(lista, { cada: 950, alSonar: (n) => { setOyendo(n); if (!n) pararTanda.current = null; } });
  };
  const perfil = perfilDe(a);
  const [prueba, setPrueba] = useState(false);
  // (las voces del móvil a veces llegan tarde: «voiceschanged»)
  const [voces, setVoces] = useState(vocesEspanol);
  useEffect(() => {
    const ss = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (!ss?.addEventListener) return undefined;
    const al = () => setVoces(vocesEspanol());
    ss.addEventListener('voiceschanged', al);
    return () => ss.removeEventListener?.('voiceschanged', al);
  }, []);
  const probarApartado = (k) => { prepararAudio(); sonarFBE({ entreno: 'serie', juego: 'cuenta', chat: 'recibido', avisos: 'animo' }[k], k === 'juego' ? { segundo: 1 } : { n: 2, total: 4 }, { forzar: true }); };
  const nombreSonido = (k) => (SONIDOS_DESCANSO.find(([v]) => v === k) || [])[1] || k;
  // Suena el que se ve elegido (no el guardado: por si este navegador no deja guardar) y lo dice
  const probar = (k = a.sonidoDescanso) => { prepararAudio(); pitar(k); aviso(`Suena: ${nombreSonido(k)}`); };
  const plataforma = plataformaPistaAqui();
  return (
    <Hoja titulo="Sonido y vibración" alCerrar={alCerrar}>
      {/* (sonido, tanda 1) tres perfiles de un toque */}
      <div class="panel panel-pad pila-s aj-perfil-sonido">
        <span id="aj-perfil-t">Cuánto suena la app</span>
        <Segmentos etiqueta="Cuánto suena la app" valor={perfil} opciones={Object.entries(PERFILES).map(([k, p]) => [k, p.nombre, p.ayuda])}
          alCambiar={(v) => { if (!v) return; cambiarVarios(PERFILES[v].ajustes); prepararAudio(); sonarFBE('ui', {}, { forzar: true }); aviso(`${PERFILES[v].nombre}: ${PERFILES[v].ayuda.toLowerCase()}`); }} />
        <span class="peq terciario">{perfil ? PERFILES[perfil].ayuda : 'A tu manera: lo has elegido tú, uno a uno, aquí abajo'}.</span>
        <button type="button" class="btn btn-peq aj-escuchar" onClick={escucharTodos} aria-pressed={oyendo ? 'true' : 'false'}><Icono n="altavoz" />{oyendo ? 'Parar' : 'Escuchar todos'}</button>
        {oyendo && <span class="peq secundario" role="status">Suena: {oyendo}</span>}
        <button type="button" class="btn btn-peq plano" style="justify-self:start" onClick={() => setPrueba(true)}><Icono n="altavoz" /> Prueba de sonido</button>
      </div>
      {prueba && <PruebaSonido alCerrar={() => { setPrueba(false); cambiarVarios(leerAjustes()); }} />}
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
          {/* pulido 7 */}
          <Interruptor id="aj-sonido-serie" icono="altavoz" texto="Sonido al marcar una serie" ayuda="Un tic suave, y unas notas al terminar la sesión. No corta tu música" valor={a.sonidoSerie !== false}
            alCambiar={(v) => { cambiar('sonidoSerie', v); if (v) { prepararAudio(); sonarSerie(); } }} />
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
              <span class="peq terciario">«FBE» es el motivo de la app; los demás, los de FBE Timer. Si se oye bajo, sube también el volumen del móvil.</span>
              {/* (sonido, tanda 1) el volumen de cada apartado (por debajo del general) */}
              <fieldset class="aj-apartados">
                <legend class="peq secundario">Cada apartado</legend>
                {APARTADOS.map(([k, t]) => (
                  <div key={k} class="aj-apartado">
                    <label for={`aj-vol-${k}`}><span>{t}</span><span class="peq terciario num">{Math.round((a.volumenes?.[k] ?? 1) * 100)} %</span></label>
                    <input id={`aj-vol-${k}`} type="range" min="0" max="1" step="0.1" value={a.volumenes?.[k] ?? 1} onChange={(e) => cambiar('volumenes', { ...a.volumenes, [k]: Number(e.currentTarget.value) })} />
                    <button type="button" class="btn btn-peq btn-icono plano" onClick={() => probarApartado(k)} aria-label={`Probar: ${t}`}><Icono n="altavoz" /></button>
                  </div>
                ))}
              </fieldset>
            </li>
          )}
          {a.sonido && <Interruptor id="aj-brillante" icono="altavoz" texto="Modo gimnasio con ruido" ayuda="Sonidos más brillantes y un poco más fuertes, para oírlos por encima de la música de la sala" valor={!!a.sonidoBrillante}
            alCambiar={(v) => { cambiar('sonidoBrillante', v); prepararAudio(); setTimeout(() => sonarFBE('serie', { n: 4, total: 4 }, { forzar: true, ajustes: { ...leerAjustes(), sonidoBrillante: v } }), 30); }} />}
          {a.sonido && <Interruptor id="aj-mitad" icono="reloj" texto="Aviso a mitad del descanso" ayuda="Una nota grave y suave, en los descansos de 40 segundos o más" valor={!!a.avisoMitad} alCambiar={(v) => { cambiar('avisoMitad', v); if (v) { prepararAudio(); sonarFBE('mitad', {}, { forzar: true }); } }} />}
          {a.sonido && <Interruptor id="aj-diez" icono="reloj" texto="Aviso a falta de 10 segundos" ayuda="Dos notas suaves, para ir preparándote (con la voz, lo dice ella)" valor={a.avisoDiez !== false} alCambiar={(v) => { cambiar('avisoDiez', v); if (v) { prepararAudio(); sonarFBE('diez', {}, { forzar: true }); } }} />}
          {a.sonido && <Interruptor id="aj-respira-sonido" icono="sueno" texto="Sonido de «Respira»" ayuda="Con «Respira» puesto en el descanso, un soplo suave que sube al inspirar y baja al soltar" valor={a.respiraSonido !== false} alCambiar={(v) => { cambiar('respiraSonido', v); if (v) { prepararAudio(); sonarFBE('respira-dentro', { dura: 2 }, { forzar: true }); } }} />}
          <Interruptor id="aj-avisos" icono="trofeo" texto="Sonidos de logros y comunidad" ayuda="Al conseguir un logro, recibir un ánimo o cumplir un reto del equipo, con la app abierta" valor={a.sonidosAvisos !== false} alCambiar={(v) => { cambiar('sonidosAvisos', v); if (v) { prepararAudio(); sonarFBE('logro', { nivel: 2 }, { forzar: true }); } }} />
          <Interruptor id="aj-interfaz" icono="hecho" texto="Sonidos de la interfaz" ayuda="Un toque casi imperceptible al marcar un hábito, enviar el check-in, cerrar una tarea o guardar el peso" valor={!!a.sonidosInterfaz} alCambiar={(v) => { cambiar('sonidosInterfaz', v); if (v) { prepararAudio(); sonarFBE('ui', {}, { forzar: true }); } }} />
          {/* (sonido 2) el clic del teclado, «¿Seguimos?», el paisaje sonoro del descanso y el horario sin sonidos */}
          <Interruptor id="aj-teclado-clic" icono="teclado" texto="Clic del teclado" ayuda="Un clic casi imperceptible en cada tecla del teclado de la app" valor={!!a.sonidoTeclado} alCambiar={(v) => { cambiar('sonidoTeclado', v); if (v) { prepararAudio(); sonarFBE('tecla', {}, { forzar: true }); } }} />
          {a.sonido && <Interruptor id="aj-seguimos" icono="reloj" texto="«¿Seguimos?»" ayuda="Si acaba el descanso y pasa un minuto sin marcar la serie, un recordatorio suave (y otro a los tres minutos)" valor={a.avisoSeguimos !== false} alCambiar={(v) => { cambiar('avisoSeguimos', v); if (v) { prepararAudio(); sonarFBE('seguimos', {}, { forzar: true }); } }} />}
          {a.sonido && (
            <li class="panel-pad pila-s">
              <label for="aj-paisaje">Sonido de fondo en el descanso</label>
              <div class="fila-envolver">
                <select id="aj-paisaje" class="selector" style="flex:1;min-width:11rem" value={a.paisajeDescanso || ''} onChange={(e) => { const v = e.currentTarget.value || null; cambiar('paisajeDescanso', v); if (v) { prepararAudio(); const parar = empezarPaisaje(v); setTimeout(parar, 3500); } }}>
                  <option value="">Ninguno</option><option value="marron">Ruido marrón</option><option value="lluvia">Lluvia</option><option value="bosque">Bosque</option>
                </select>
              </div>
              <span class="peq terciario">Muy suave, mientras dura el descanso, y se apaga al acabar. Para quien entrena en casa o en silencio. Gasta algo más de batería.</span>
            </li>
          )}
          <Interruptor id="aj-silencio" icono="sueno" texto="Horario sin sonidos" ayuda="En esas horas no suenan el chat, los logros, la comunidad ni la interfaz; lo del entreno, sí" valor={!!a.silencioActivo} alCambiar={(v) => cambiar('silencioActivo', v)} />
          {a.silencioActivo && (
            <li class="panel-pad aj-horario">
              <label for="aj-silencio-desde">De</label><input id="aj-silencio-desde" type="time" class="entrada" value={a.silencioDesde} onChange={(e) => cambiar('silencioDesde', e.currentTarget.value || '23:00')} />
              <label for="aj-silencio-hasta">a</label><input id="aj-silencio-hasta" type="time" class="entrada" value={a.silencioHasta} onChange={(e) => cambiar('silencioHasta', e.currentTarget.value || '08:00')} />
            </li>
          )}
          {a.sonido && <Interruptor id="aj-cuenta" icono="reloj" texto="Cuenta atrás en los últimos segundos" ayuda="Notas que suben en los cinco últimos (tres en los descansos cortos), para saber que se acaba sin mirar el móvil" valor={a.cuentaAtras} alCambiar={(v) => { cambiar('cuentaAtras', v); if (v) { prepararAudio(); [5, 4, 3, 2, 1].forEach((sg, i) => setTimeout(() => sonarFBE('cuenta', { segundo: sg }, { forzar: true }), i * 260)); } }} />}
          {/* v0.48: el entrenador por voz (Web Speech), apagado de entrada; donde el navegador no habla, desactivado */}
          <Interruptor id="aj-voz" icono="mensaje" texto="Entrenador por voz" desactivado={!hayVoz()}
            ayuda={hayVoz() ? 'Te dice la siguiente serie («Serie 3 de press banca: 80 kilos por 6»), los últimos segundos del descanso y la última serie. La música sigue sonando (baja un momento mientras habla).' : 'Este navegador no puede hablar: los avisos del descanso siguen con su sonido.'}
            valor={!!a.voz && hayVoz()} alCambiar={(v) => { cambiar('voz', v); if (v) hablar('Serie 1 de press banca: 60 kilos por 8.', { forzar: true }); }} />
          {a.voz && hayVoz() && <li class="panel-pad separa"><span class="peq secundario">¿Se oye bien?</span><button class="btn btn-peq" onClick={() => hablar('Serie 3 de sentadilla: 80 kilos por 6. Última serie.', { forzar: true })}><Icono n="altavoz" /> Probar la voz</button></li>}
          {/* (sonido 2, tanda 6) la voz del móvil: cuál (de las que tenga en español) y a qué velocidad; y contar las repeticiones */}
          {a.voz && hayVoz() && (
            <li class="panel-pad pila-s">
              {voces.length > 1 && <><label for="aj-voz-nombre">Qué voz</label>
                <select id="aj-voz-nombre" class="selector" value={a.vozNombre || ''} onChange={(e) => { cambiar('vozNombre', e.currentTarget.value || null); setTimeout(() => hablar('Serie 2 de remo: 50 kilos por 10.', { forzar: true }), 50); }}>
                  <option value="">La del móvil</option>
                  {voces.map((v) => <option key={v.nombre} value={v.nombre}>{v.nombre} ({v.idioma})</option>)}
                </select></>}
              <span id="aj-voz-vel-t">Velocidad</span>
              <Segmentos etiqueta="Velocidad de la voz" valor={Number(a.vozVelocidad) || 1} opciones={[[0.85, 'Más despacio'], [1, 'Normal'], [1.15, 'Más rápido']]} alCambiar={(v) => { if (v == null) return; cambiar('vozVelocidad', v); setTimeout(() => hablar('Serie 2 de remo: 50 kilos por 10.', { forzar: true }), 50); }} />
            </li>
          )}
          {hayVoz() && <Interruptor id="aj-contar" icono="mensaje" texto="Contar las repeticiones con el metrónomo" ayuda="Con el metrónomo de tempo, la voz dice cada repetición al empezarla" valor={!!a.contarReps} alCambiar={(v) => cambiar('contarReps', v)} />}
          {/* (sonido, tanda 3) las frases que grabe el coach, con su voz */}
          <Interruptor id="aj-voz-coach" icono="micro" texto="Frases de tu coach, con su voz" ayuda="Si tu coach las ha grabado: «¡Vamos!», «Última serie», «¡Récord!»… en su momento de la sesión" valor={a.vozCoach !== false} alCambiar={(v) => cambiar('vozCoach', v)} />
          {/* v0.62: el aviso con el móvil bloqueado (la pista del descanso). Solo donde puede funcionar: iPhone con Safari 16.4 o
              más (la app de inicio o Safari) y Android; en el ordenador no sale. Apagado de serie: pausa la música de otras apps */}
          {a.sonido && plataforma && (
            <Interruptor id="aj-bloqueo" icono="candado" texto="Avisar aunque bloquees el móvil" valor={!!a.vozBloqueo}
              ayuda={`Suena el aviso al acabar el descanso aunque el móvil esté bloqueado${plataforma === 'ios' ? ' o en silencio' : ''}, y la pantalla de bloqueo enseña lo que queda. A cambio, tu música (${plataforma === 'ios' ? 'Spotify, Apple Music' : 'Spotify, YouTube Music'}…) se pausa en cada descanso y tienes que volver a darle a play.${a.voz && frasesDelCoach() ? ' Con el móvil bloqueado, la cuenta y el final los dice la voz grabada de tu coach.' : ' Con el móvil bloqueado suena el aviso (un sonido), no la voz: la voz del móvil solo habla con la app delante.'}`}
              alCambiar={(v) => { cambiar('vozBloqueo', v); if (v) setTimeout(() => prepararPista(), 0); else pararPista(); }} />
          )}
          {/* (sonido 2, tanda 7) con la pista, marcar la serie desde el botón de los auriculares */}
          {a.sonido && plataforma && a.vozBloqueo && (
            <Interruptor id="aj-auriculares" icono="play" texto="Marcar la serie desde los auriculares" valor={!!a.auricularesSerie}
              ayuda="Pasado el aviso del descanso, el botón de pausa de los auriculares (o de la pantalla de bloqueo) marca la serie que toca con lo propuesto, y la voz lo confirma. La pista sigue minuto y medio más en silencio para que llegue el botón (tu música sigue en pausa ese rato). Depende del móvil y de los auriculares."
              alCambiar={(v) => cambiar('auricularesSerie', v)} />
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
          {/* pulido 6: también en los interruptores, las casillas y los «+» y «−»; en iPhone, donde iOS lo deja */}
          <Interruptor id="aj-hapticos" icono="vibrar" texto="Vibración al tocar" desactivado={!puedeTocar()}
            ayuda={puedeVibrar() ? 'Un toque corto al marcar una serie o una casilla, al cambiar un interruptor, al batir un récord y al enviar el check-in.'
              : puedeTocar() ? 'Un toque corto al marcar una serie o una casilla y al cambiar un interruptor. En iPhone depende de la versión de iOS: si no lo notas, tu iPhone no lo permite.'
                : 'Este navegador no deja vibrar a las webs (en iPhone, Safari no lo permite).'}
            valor={a.hapticos !== false && puedeTocar()} alCambiar={(v) => { cambiar('hapticos', v); if (v) vibrar('serie'); }} />
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
