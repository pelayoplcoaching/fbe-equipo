// Notificaciones al móvil: la fila de Perfil (y de Cuenta), la hoja con los ajustes y la tarjeta de Hoy que
// propone activarlas. Lo de la cuenta (qué tipos, a qué hora, «no molestar») se guarda en la base; activarlas
// es de cada navegador.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, Cargando } from './comunes.jsx';
import { Interruptor } from './Ajustes.jsx';
import { conNutricion } from '../logica/nivel.js';
import { TIPOS_ATLETA, TIPOS_COACH, DIAS_CHECKIN, ESTADO_NOTIFICACION, RECORDATORIOS, momentoNotificacion } from '../logica/notificaciones.js';
import { estadoPush, activarPush, desactivarPush, suscripcionActual, conEmail } from '../datos/push.js';

const textoEstado = (coach) => ({
  demo: 'En la demo no se envían a ningún móvil: aquí ves cómo se eligen.',
  sin_configurar: coach ? 'Falta ponerlas en marcha en Supabase: está en el README, «Notificaciones al móvil».' : 'Tu coach aún no las ha puesto en marcha.',
  ios_instalar: 'En iPhone y iPad solo llegan a la app instalada: en Safari, toca Compartir y «Añadir a pantalla de inicio», ábrela desde ahí y vuelve a esta pantalla.',
  no_soportado: 'Este navegador no permite notificaciones. Prueba con Chrome, Edge, Firefox o Safari al día.',
  bloqueado: 'Las has bloqueado para esta web. Permítelas en los ajustes del navegador (el candado junto a la dirección) o del móvil, y vuelve aquí.',
});

// Los tipos que puede elegir: a quien solo le llevas el entrenamiento, sin el de nutrición
const tiposDe = (coach, atleta) => (coach ? TIPOS_COACH : TIPOS_ATLETA.filter(([t]) => t !== 'nutricion' || conNutricion(atleta)));

// «Respuestas, semana y 3 recordatorios»
function resumenTipos(p, coach, atleta = null) {
  if (!p) return '';
  const tipos = tiposDe(coach, atleta).filter(([t]) => !p.desactivados.includes(t));
  if (!tipos.length) return 'Ninguna activada';
  const avisos = tipos.filter(([t]) => !RECORDATORIOS.includes(t)).map(([, n]) => n.split(' ')[0].toLowerCase());
  const rec = tipos.filter(([t]) => RECORDATORIOS.includes(t)).length;
  const partes = [...avisos, ...(rec ? [`${rec} ${rec === 1 ? 'recordatorio' : 'recordatorios'}`] : [])];
  const texto = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}` : partes[0];
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function SeccionNotificaciones({ coach = false }) {
  const { api, modo, atleta } = useApp();
  const [abierta, setAbierta] = useState(false);
  const [aqui, setAqui] = useState(null);
  const prefs = useCarga(() => api.preferenciasNotificaciones(), [abierta]);
  // Lo último que se ha elegido en la hoja (puede que aún se esté guardando al cerrarla)
  const [local, setLocal] = useState(null);
  const estado = estadoPush(modo);
  useEffect(() => { if (estado === 'ok') suscripcionActual().then((s) => setAqui(!!s)); }, [abierta]);
  const disp = coach ? 'dispositivo' : 'móvil';
  const titulo = estado === 'ok' ? (aqui ? `Activadas en este ${disp}` : `Desactivadas en este ${disp}`) : 'Qué te llega y cuándo';
  return (
    <section class="seccion">
      <h2>Notificaciones</h2>
      <div class="panel">
        <ul class="lista">
          <li class="panel-pad separa">
            <div><div>{titulo}</div><div class="peq terciario">{resumenTipos(local || prefs.datos, coach, atleta)}</div></div>
            <button class="btn btn-peq" onClick={() => setAbierta(true)}><Icono n="campana" /> {estado === 'ok' && aqui === false ? 'Activar' : 'Ajustes'}</button>
          </li>
        </ul>
      </div>
      {abierta && <HojaNotificaciones coach={coach} alCerrar={() => setAbierta(false)} alCambiar={setLocal} />}
    </section>
  );
}

// Una hora: se guarda al salir del campo (al teclearla, el navegador va dando horas a medias: «02:00», «22:00»…)
function Hora({ id, valor, min, max, alCambiar }) {
  const [v, setV] = useState(valor || '');
  useEffect(() => { setV(valor || ''); }, [valor]);
  const fuera = !!v && ((min && v < min) || (max && v > max));
  return (
    <span class="pila-xs" style="justify-items:end">
      <input id={id} type="time" class="entrada entrada-hora" min={min} max={max} step="300" value={v}
        aria-invalid={fuera ? 'true' : undefined} aria-describedby={fuera ? `${id}-error` : undefined}
        onInput={(e) => setV(e.currentTarget.value)} onChange={(e) => setV(e.currentTarget.value)}
        onBlur={() => { if (v && !fuera && v !== valor) alCambiar(v); }} />
      {fuera && <span id={`${id}-error`} class="mini error-campo">De {min} a {max}</span>}
    </span>
  );
}

export function HojaNotificaciones({ coach = false, alCerrar, alCambiar }) {
  const { api, aviso, modo, atleta } = useApp();
  const [estado, setEstado] = useState(() => estadoPush(modo));
  const prefs = useCarga(() => api.preferenciasNotificaciones(), []);
  const subs = useCarga(() => api.suscripcionesPush(), []);
  const ultimas = useCarga(() => api.ultimasNotificaciones(10), []);
  const [p, setP] = useState(null);
  const pRef = useRef(null);
  const [esta, setEsta] = useState(undefined); // undefined: aún no se sabe (no se enseña nada que luego cambie)
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { if (prefs.datos) { pRef.current = prefs.datos; setP(prefs.datos); } }, [prefs.datos]);
  useEffect(() => { if (estado === 'ok') suscripcionActual().then((s) => setEsta(s?.endpoint || null)); }, [estado]);
  const sabido = estado !== 'ok' || (esta !== undefined && !!subs.datos);
  const activadaAqui = !!esta && (subs.datos || []).some((s) => s.endpoint === esta);
  const disp = coach ? 'dispositivo' : 'móvil';

  // Los cambios se guardan de uno en uno y en orden (dos toques seguidos no se pisan)
  const cola = useRef(Promise.resolve());
  const ultimo = useRef(0);
  function guardar(cambios) {
    const nuevo = { ...pRef.current, ...cambios };
    pRef.current = nuevo;
    setP(nuevo);
    alCambiar?.(nuevo);
    const n = ++ultimo.current;
    cola.current = cola.current.then(() => api.guardarPreferenciasNotificaciones(nuevo))
      .then((g) => { if (n === ultimo.current) { pRef.current = g; setP(g); alCambiar?.(g); } })
      .catch((e) => { aviso(e.message, 'error'); alCambiar?.(null); if (n === ultimo.current) prefs.recargar(true); });
  }
  const quiere = (t) => !!p && !p.desactivados.includes(t);
  // Sobre lo último elegido (dos toques seguidos, antes de volver a pintar, no se pisan)
  const alternar = (t, v) => { const d = pRef.current.desactivados; guardar({ desactivados: v ? d.filter((x) => x !== t) : [...d, t] }); };

  async function activar() {
    setOcupado(true);
    try {
      const r = await activarPush(api);
      if (r === 'bloqueado') setEstado('bloqueado');
      if (r === 'activadas') {
        setEsta((await suscripcionActual())?.endpoint || null);
        subs.recargar(true);
        // Una de prueba, para ver que llega
        await api.probarNotificacion().catch(() => null);
        ultimas.recargar(true);
        aviso(`Activadas en este ${disp}: te llegará una de prueba`);
      }
    } catch (e) {
      aviso(`No se han podido activar: ${e.message}`, 'error');
    } finally { setOcupado(false); }
  }
  async function desactivar() {
    setOcupado(true);
    try { await desactivarPush(api); setEsta(null); subs.recargar(true); aviso(`Desactivadas en este ${disp}`); } finally { setOcupado(false); }
  }
  async function probar() {
    const r = await api.probarNotificacion().catch((e) => { aviso(e.message, 'error'); return null; });
    if (r === 'ok') aviso('Enviada: te llegará en unos segundos');
    else if (r === 'espera') aviso('Ya te hemos enviado una hace un momento');
    else if (r === 'sin_canal') aviso(`Antes, actívalas en este ${disp}`, 'error');
    ultimas.recargar(true);
  }
  async function quitar(s) {
    try { await api.quitarDispositivo(s.id); subs.recargar(true); aviso('Quitado: ya no le llegarán'); } catch (e) { aviso(e.message, 'error'); }
  }

  const tipos = tiposDe(coach, atleta);
  const conNut = coach || conNutricion(atleta);
  const tarde = quiere('habitos') || (conNut && quiere('nutricion')) || quiere('checkin');
  return (
    <Hoja titulo="Notificaciones" alCerrar={alCerrar}>
      <div class="pila">
        <div class="panel panel-pad pila-s estado-notificaciones" aria-busy={sabido ? undefined : 'true'}>
          {!sabido ? <Cargando /> : estado === 'ok' ? (activadaAqui ? (
            <>
              <p class="fila-icono"><Icono n="campana" /><span><strong>Activadas en este {disp}.</strong> Te llegan aunque tengas la app cerrada.</span></p>
              <span class="fila">
                <button class="btn btn-peq" onClick={probar} disabled={ocupado}>Enviarme una de prueba</button>
                <button class="btn btn-peq" onClick={desactivar} disabled={ocupado}>Desactivar aquí</button>
              </span>
            </>
          ) : (
            <>
              <p class="peq secundario">Te llegan aunque tengas la app cerrada. Solo dicen quién y dónde («{coach ? 'Ana te ha escrito · En Pierna A' : 'Pelayo te ha respondido · En Pierna A'}»): nunca el texto de los mensajes ni datos de salud.</p>
              <button class="btn btn-primario" style="justify-self:start" onClick={activar} disabled={ocupado}><Icono n="campana" /> Activar en este {disp}</button>
            </>
          )) : <p class="fila-icono peq secundario"><Icono n="campana" /><span>{textoEstado(coach)[estado]}</span></p>}
        </div>

        {!p ? <Cargando /> : (
          <>
            <section class="pila-s">
              <h3 class="sub-seccion">Qué te llega</h3>
              <div class="panel"><ul class="lista">
                {tipos.map(([t, nombre, ayuda]) => <Interruptor key={t} id={`nt-${t}`} texto={nombre} ayuda={ayuda} valor={quiere(t)} alCambiar={(v) => alternar(t, v)} />)}
              </ul></div>
            </section>

            {!coach && (quiere('sesion_hoy') || tarde) && (
              <section class="pila-s">
                <h3 class="sub-seccion">Recordatorios</h3>
                <div class="panel"><ul class="lista">
                  {quiere('sesion_hoy') && (
                    <li class="panel-pad separa"><label for="nt-manana">Sesión de hoy, a las</label>
                      <Hora id="nt-manana" valor={p.hora_manana} min="05:00" max="12:00" alCambiar={(v) => guardar({ hora_manana: v })} /></li>
                  )}
                  {tarde && (
                    <li class="panel-pad separa"><label for="nt-tarde">{quiere('habitos') || (conNut && quiere('nutricion')) ? (conNut ? 'Hábitos y nutrición, a las' : 'Hábitos, a las') : 'Check-in, a las'}</label>
                      <Hora id="nt-tarde" valor={p.hora_tarde} min="12:00" max="23:30" alCambiar={(v) => guardar({ hora_tarde: v })} /></li>
                  )}
                  {quiere('checkin') && (
                    <li class="panel-pad separa"><label for="nt-dia">Check-in, el</label>
                      <select id="nt-dia" class="selector entrada-hora" value={p.dia_checkin} onChange={(e) => guardar({ dia_checkin: Number(e.currentTarget.value) })}>
                        {DIAS_CHECKIN.map(([d, n]) => <option key={d} value={d}>{n}</option>)}
                      </select></li>
                  )}
                </ul></div>
                <p class="mini terciario">Solo si aún te falta algo. Llegan a la hora que elijas (el «no molestar» no los retrasa).</p>
              </section>
            )}

            <section class="pila-s">
              <h3 class="sub-seccion">No molestar</h3>
              <div class="panel"><ul class="lista">
                <Interruptor id="nt-silencio" texto="De noche, sin notificaciones" ayuda="Lo que pase a esas horas te llega al acabar" valor={!!p.silencio_desde}
                  alCambiar={(v) => guardar(v ? { silencio_desde: '22:30', silencio_hasta: '08:00' } : { silencio_desde: null, silencio_hasta: null })} />
                {p.silencio_desde && (
                  <>
                    <li class="panel-pad separa"><label for="nt-desde">Desde las</label><Hora id="nt-desde" valor={p.silencio_desde} alCambiar={(v) => guardar({ silencio_desde: v })} /></li>
                    <li class="panel-pad separa"><label for="nt-hasta">Hasta las</label><Hora id="nt-hasta" valor={p.silencio_hasta} alCambiar={(v) => guardar({ silencio_hasta: v })} /></li>
                  </>
                )}
              </ul></div>
            </section>

            {conEmail() && (
              <section class="pila-s">
                <h3 class="sub-seccion">Por email</h3>
                <div class="panel"><ul class="lista">
                  <Interruptor id="nt-email" texto="Si no las tengo activadas en ningún móvil" ayuda="Como mucho un email por hora, con todo lo pendiente" valor={p.email} alCambiar={(v) => guardar({ email: v })} />
                </ul></div>
              </section>
            )}
          </>
        )}

        {(subs.datos || []).length > 0 && (
          <section class="pila-s">
            <h3 class="sub-seccion">Dónde están activadas</h3>
            <div class="panel"><ul class="lista">
              {subs.datos.map((s) => (
                <li key={s.id} class="panel-pad separa">
                  <div><div>{s.dispositivo || 'Navegador'}{s.endpoint === esta && <span class="chip morado chip-mini">Este</span>}</div>
                    <div class="peq terciario">{s.fallos > 0 ? 'Da error al enviar: si no te llegan, desactívalas y vuelve a activarlas' : s.usada_en ? `Última: ${momentoNotificacion(s.usada_en)}` : `Desde ${momentoNotificacion(s.creada_en)}`}</div></div>
                  {s.endpoint === esta
                    ? <button class="btn btn-peq" onClick={desactivar} disabled={ocupado}>Desactivar</button>
                    : <button class="btn btn-peq" onClick={() => quitar(s)}>Quitar</button>}
                </li>
              ))}
            </ul></div>
          </section>
        )}

        <section class="pila-s">
          <h3 class="sub-seccion">Las últimas</h3>
          {ultimas.cargando && !ultimas.datos ? <Cargando /> : (ultimas.datos || []).length ? (
            <div class="panel"><ul class="lista lista-notificaciones">
              {ultimas.datos.map((n) => (
                <li key={n.id} class="panel-pad pila-xs">
                  <span class="separa"><strong class="peq">{n.titulo}</strong><span class="mini terciario">{momentoNotificacion(n.enviada_en || n.enviar_desde || n.creado_en)}</span></span>
                  {(n.cuerpo || n.estado !== 'enviada' || n.canal === 'email') && (
                    <span class="peq secundario">{[n.cuerpo, n.estado !== 'enviada' ? ESTADO_NOTIFICACION[n.estado] : null, n.canal === 'email' ? 'por email' : null,
                      coach && n.estado === 'fallida' && n.error ? `(${n.error})` : null].filter(Boolean).join(' · ')}</span>
                  )}
                </li>
              ))}
            </ul></div>
          ) : <p class="peq terciario">Aún no te ha llegado ninguna.</p>}
        </section>
      </div>
    </Hoja>
  );
}

// En Hoy, una vez el atleta ya ha entrenado con la app: proponer activarlas (el permiso del navegador se pide
// solo al tocar «Activar», nunca al abrir la app). «Ahora no» la esconde un mes.
const CLAVE_TARJETA = 'fbe-notificaciones-tarjeta';
const descartadaHace = () => { try { return Date.now() - Number(localStorage.getItem(CLAVE_TARJETA) || 0); } catch { return Infinity; } };
export function TarjetaNotificaciones() {
  const { api, modo, aviso } = useApp();
  const [visible, setVisible] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (estadoPush(modo) !== 'ok' || window.Notification?.permission !== 'default' || descartadaHace() < 30 * 864e5) return;
    suscripcionActual().then((s) => setVisible(!s));
  }, []);
  if (!visible) return null;
  const ocultar = () => { try { localStorage.setItem(CLAVE_TARJETA, String(Date.now())); } catch { /* */ } setVisible(false); };
  return (
    <section class="panel panel-pad pila-s tarjeta-notificaciones" aria-label="Notificaciones">
      <p class="fila-icono"><Icono n="campana" /><strong>¿Te aviso cuando tu coach te responda?</strong></p>
      <p class="peq secundario">Y cuando publique tu semana, o si se te pasa apuntar algo. Tú eliges qué te llega y a qué hora.</p>
      <span class="fila">
        <button class="btn btn-primario btn-peq" disabled={ocupado} onClick={async () => {
          setOcupado(true);
          try {
            const r = await activarPush(api);
            if (r === 'activadas') { api.probarNotificacion().catch(() => {}); aviso('Activadas: te llegará una de prueba'); setVisible(false); }
            else if (r === 'bloqueado') { aviso('Las has bloqueado: puedes permitirlas en los ajustes del navegador', 'error'); ocultar(); }
          } catch (e) { aviso(`No se han podido activar: ${e.message}`, 'error'); } finally { setOcupado(false); }
        }}>Activar</button>
        <button class="btn btn-peq" onClick={ocultar}>Ahora no</button>
      </span>
    </section>
  );
}
