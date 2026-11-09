// «Conexiones» (v0.105, migración 051): Salud del iPhone (por la app Atajos) y el calendario que se actualiza solo.
//   * Salud → app: el atajo «FBE Salud» del coach lee de Salud los pasos, el sueño, la FC en reposo, la HRV y el peso y
//     los manda con el enlace personal del atleta. El check-in viene relleno, los pasos se apuntan solos y su coach ve
//     cómo descansa. Hace falta su consentimiento de datos de salud.
//   * App → Salud: el atajo «FBE a Salud» apunta en Salud el entreno al terminarlo (un botón en el resumen de la sesión).
//   * Calendario: una dirección personal a la que se suscribe su calendario; si el plan cambia, el calendario cambia solo.
// Sin la 051, no sale nada.
// (conexiones del coach) El coach, en su modo atleta, también conecta su Salud y su calendario (Progreso → Cuerpo): es
// su propia ficha de atleta (mi_atleta_id), con sus consentimientos; sirve para usarlo y para probar sus atajos.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Icono, GrupoIos, FilaIos, Segmentos, copiar, usePreferencia } from '../comunes.jsx';
import { urlSalud, urlsCalendario, urlAtajoEntreno, tipoSalud, ATAJO_SALUD, ATAJO_ENTRENO, haceDias, textoSueno } from '../../logica/integraciones.js';
import { conEntrenamiento } from '../../logica/nivel.js';
import { esIOS } from '../pulido.js';
import { fmtCorta } from '../../logica/fechas.js';
import { num } from '../../logica/calculos.js';

export const PREF_ATAJO_ENTRENO = 'fbe-atajo-entreno';

// (api.integraciones: undefined sin la 051)
export function useIntegraciones(deps = []) {
  const { api, atleta, propio } = useApp();
  return useCarga(() => (!atleta?.id ? Promise.resolve({ sin: true }) : api.integraciones().then((i) => (i === undefined || i === null ? { sin: true } : i)).catch(() => ({ sin: true }))), [atleta?.id, ...deps]);
}

export function Conexiones({ salud }) {
  const { atleta, propio } = useApp();
  const datos = useIntegraciones();
  const [abrir, setAbrir] = useState(null);
  if (!datos.datos || datos.datos.sin) return null;
  const i = datos.datos;
  const entrena = conEntrenamiento(atleta);
  const cerrar = () => { setAbrir(null); datos.recargar(true); };
  return (
    <GrupoIos titulo="Conexiones" id="grupo-conexiones" pie={propio ? 'Tu ficha de atleta: lo que llegue de tu iPhone va a tus hábitos, tus pesos y tu progreso. Sirve también para probar tus atajos antes de compartirlos.' : 'Tus datos solo van de tu móvil a la app y los ve tu coach. Lo puedes quitar cuando quieras.'}>
      <FilaIos icono="pasos" tono={i.salud?.activa ? 'ok' : ''} titulo="Salud del iPhone"
        detalle={i.salud?.activa ? (i.salud.ultimo ? `Conectada · último envío ${haceDias(i.salud.ultimo)}` : 'Conectada · aún no ha llegado nada') : 'Pasos, sueño, pulso y peso, sin apuntarlos'}
        alTocar={() => setAbrir('salud')} etiqueta="Salud del iPhone: conectar o ver" />
      {entrena && <FilaIos icono="calendario" tono={i.calendario?.activo ? 'ok' : ''} titulo="Tus entrenos en tu calendario"
        detalle={i.calendario?.activo ? `Suscrito · ${i.calendario.hora}` : 'Se actualiza solo cuando cambia el plan'}
        alTocar={() => setAbrir('calendario')} etiqueta="Tus entrenos en tu calendario: suscribirte o ver" />}
      {abrir === 'salud' && <HojaSalud estado={i} salud={salud} alCerrar={cerrar} />}
      {abrir === 'calendario' && <HojaSuscripcion estado={i} alCerrar={cerrar} />}
    </GrupoIos>
  );
}

// Un paso numerado de las instrucciones
function Paso({ n, titulo, children, hecho = false }) {
  return (
    <li class={`conexion-paso ${hecho ? 'hecho' : ''}`}>
      <span class="conexion-num num" aria-hidden="true">{hecho ? <Icono n="hecho" /> : n}</span>
      <div class="pila-s"><strong>{titulo}</strong>{children}</div>
    </li>
  );
}

// El enlace recién creado: se enseña una vez, para copiarlo
function EnlaceNuevo({ url, etiqueta }) {
  const { aviso } = useApp();
  return (
    <div class="pila-s">
      <div class="nota conexion-enlace num" style="user-select:all">{url}</div>
      <button type="button" class="btn btn-primario" onClick={async () => aviso((await copiar(url)) ? `${etiqueta} copiado` : 'Selecciona el texto y cópialo')}><Icono n="copiar" /> Copiar {etiqueta.toLowerCase()}</button>
    </div>
  );
}

export function HojaSalud({ estado, salud, alCerrar }) {
  const { api, atleta, aviso, modo, propio } = useApp();
  const [enlace, setEnlace] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(null);   // 'nuevo' | 'quitar'
  const [borrar, setBorrar] = useState(false);
  const [atajoEntreno, setAtajoEntreno] = usePreferencia(PREF_ATAJO_ENTRENO, false);
  const activa = !!estado.salud?.activa;
  const base = api.urlIntegraciones();
  const dias = useCarga(() => (activa ? api.saludDiaria(atleta.id).then((r) => r?.dias || []).catch(() => []) : Promise.resolve([])), [activa]);
  const atajoSalud = estado.atajos?.salud || null, atajoEnt = estado.atajos?.entreno || null;
  const ios = esIOS();

  async function crear() {
    setOcupado(true);
    try { const t = await api.crearIntegracion('salud'); setEnlace(t); setConfirmar(null); aviso('Enlace creado'); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  }
  async function quitar() {
    setOcupado(true);
    try { await api.quitarIntegracion('salud', borrar); aviso(borrar ? 'Desconectada y borrado lo que llegó' : 'Desconectada'); alCerrar(); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  }
  const url = enlace ? urlSalud(base, enlace) : null;
  return (
    <Hoja titulo="Salud del iPhone" alCerrar={alCerrar}>
      <div class="pila conexiones">
        <p class="peq secundario">Tu iPhone le pasa a la app, una vez al día, tus <strong>pasos</strong>, cuánto has <strong>dormido</strong>, tu <strong>pulso en reposo</strong>, tu <strong>variabilidad (HRV)</strong> y tu <strong>peso</strong>. {propio ? 'Así tus pasos, tu sueño y tu peso se apuntan solos en tu ficha.' : 'Así el check-in viene relleno, tus pasos se apuntan solos en tus hábitos y tu coach ve cómo descansas sin preguntarte.'} Se hace con la app Atajos, que ya viene en el iPhone.</p>
        {!ios && <p class="nota peq">Esto es para iPhone: Apple lo deja hacer con Atajos. En Android, una web no puede leer los datos de salud del móvil.</p>}
        {!salud ? (
          <p class="nota peq">Para traer datos de Salud hace falta tu consentimiento de datos de salud (en tu perfil, en Cuenta → Datos de salud).</p>
        ) : (
          <ol class="conexion-pasos">
            <Paso n={1} titulo={`Instala el atajo «${ATAJO_SALUD}»`}>
              {atajoSalud ? <a class="btn" href={atajoSalud} target="_blank" rel="noopener"><Icono n="descargar" /> Instalar el atajo</a>
                : <span class="peq secundario">{propio ? 'Mientras lo montas, sáltate este paso: crea tu clave (paso 2) y pégala en el atajo de tu iPhone para probarlo. Cuando lo compartas, pon el enlace en Cuenta → Atajos del iPhone.' : 'Tu coach aún no lo ha preparado. Pídeselo y vuelve aquí.'}</span>}
              <span class="mini terciario">Al instalarlo te pedirá tu clave personal (la del paso 2) y permiso para leer Salud: deja marcados los datos que quieras compartir.</span>
            </Paso>
            <Paso n={2} titulo="Copia tu clave personal" hecho={activa && !enlace}>
              {/* (revisión) solo la clave: el atajo ya lleva la dirección y la manda en una cabecera, así no queda en los registros */}
              {enlace ? (modo !== 'demo' ? <EnlaceNuevo url={enlace} etiqueta="Clave" /> : <p class="nota peq">En la demo no se crea una clave de verdad: en tu app, aquí saldría la tuya para copiarla.</p>)
                : activa ? (
                  <span class="peq secundario">Ya tienes una{estado.salud.ultimo ? ` (último envío ${haceDias(estado.salud.ultimo)})` : ''}. Solo se enseña al crearla: si la perdiste o cambias de iPhone, crea otra y pégala en el atajo.</span>
                ) : <button type="button" class="btn btn-primario" disabled={ocupado} onClick={crear}><Icono n="enlace" /> Crear mi clave</button>}
              {(enlace || !activa) && <span class="mini terciario">Es como una llave: no la compartas, ni compartas el atajo después de pegarla. Si creas otra, esta deja de valer.</span>}
              {activa && !enlace && confirmar !== 'nuevo' && <button type="button" class="btn-texto" onClick={() => setConfirmar('nuevo')}>Crear una clave nueva</button>}
              {confirmar === 'nuevo' && (
                <div class="nota pila-s">
                  <span class="peq">El que tienes en el atajo dejará de valer: tendrás que pegar el nuevo.</span>
                  <span class="fila"><button type="button" class="btn btn-peq" onClick={() => setConfirmar(null)}>Cancelar</button><button type="button" class="btn btn-peq btn-primario" disabled={ocupado} onClick={crear}>Crear otro</button></span>
                </div>
              )}
            </Paso>
            <Paso n={3} titulo="Que vaya solo cada mañana">
              <span class="peq secundario">En Atajos: <strong>Automatización</strong> → <strong>+</strong> → <strong>Hora del día</strong> (por ejemplo, las 9:00, cada día) → <strong>Ejecutar inmediatamente</strong> → elige «{ATAJO_SALUD}». Manda los pasos de ayer y el sueño, el pulso y el peso de hoy.</span>
            </Paso>
          </ol>
        )}

        {activa && dias.datos?.length > 0 && (
          <section class="pila-s">
            <h3 class="peq">Lo que ha llegado</h3>
            <TablaSalud dias={dias.datos.slice(0, 7)} />
          </section>
        )}

        {conEntrenamiento(atleta) && (
          <section class="pila-s conexion-otra">
            <h3 class="peq">Tus entrenos, en Salud</h3>
            <p class="peq secundario">Con el atajo «{ATAJO_ENTRENO}», al terminar una sesión tocas «Apuntar en Salud» y queda como entreno de fuerza (o de cardio) en Salud, con su duración. Cuenta para los anillos del Apple Watch.</p>
            {atajoEnt ? <a class="btn" href={atajoEnt} target="_blank" rel="noopener"><Icono n="descargar" /> Instalar «{ATAJO_ENTRENO}»</a>
              : <span class="peq secundario">{propio ? 'Cuando lo compartas, pon el enlace en Cuenta → Atajos del iPhone.' : 'Tu coach aún no lo ha preparado.'}</span>}
            <label class="fila conexion-check">
              <input type="checkbox" checked={!!atajoEntreno} onChange={(e) => setAtajoEntreno(e.currentTarget.checked)} />
              <span class="peq">Ya lo tengo: enséñame «Apuntar en Salud» al terminar cada sesión (en este móvil)</span>
            </label>
          </section>
        )}

        {activa && (confirmar === 'quitar' ? (
          <div class="nota pila-s">
            <span class="peq">El atajo dejará de poder mandar nada. Bórralo también de Atajos si ya no lo quieres.</span>
            <label class="fila conexion-check"><input type="checkbox" checked={borrar} onChange={(e) => setBorrar(e.currentTarget.checked)} /><span class="peq">Borrar también lo que ha llegado de Salud (y lo que puso en tus hábitos y pesos, si no lo has cambiado tú)</span></label>
            <span class="fila"><button type="button" class="btn btn-peq" onClick={() => setConfirmar(null)}>Cancelar</button><button type="button" class="btn btn-peq btn-peligro" disabled={ocupado} onClick={quitar}>Desconectar</button></span>
          </div>
        ) : <button type="button" class="btn btn-plano peligro" onClick={() => setConfirmar('quitar')}>Desconectar Salud</button>)}
      </div>
    </Hoja>
  );
}

// Los días que llegaron, en una tabla pequeña (la usa también la ficha del coach)
export function TablaSalud({ dias }) {
  return (
    <div class="tabla-salud-caja">
      <table class="tabla-salud num">
        <thead><tr><th scope="col">Día</th><th scope="col">Pasos</th><th scope="col">Sueño</th><th scope="col">Pulso</th><th scope="col">HRV</th><th scope="col">Peso</th></tr></thead>
        <tbody>
          {dias.map((d) => (
            <tr key={d.fecha}>
              <th scope="row">{fmtCorta(d.fecha)}</th>
              <td>{d.pasos != null ? num(d.pasos, 0) : '—'}</td>
              <td>{d.sueno_min != null ? textoSueno(d.sueno_min) : '—'}</td>
              <td>{d.fc_reposo ?? '—'}</td>
              <td>{d.hrv != null ? num(d.hrv, 0) : '—'}</td>
              <td>{d.peso_kg != null ? num(d.peso_kg, 1) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- el calendario que se actualiza solo
const DURACIONES = [[45, '45 min'], [60, '1 h'], [75, '1 h 15'], [90, '1 h 30']];
const AVISOS = [[15, '15 min antes'], [30, '30 min'], [60, '1 h'], [120, '2 h']];

export function HojaSuscripcion({ estado, alCerrar }) {
  const { api, aviso, modo } = useApp();
  const cal = estado.calendario || {};
  const [hora, setHora] = useState(cal.hora || '18:00');
  const [minutos, setMinutos] = useState(cal.minutos || 75);
  const [avisoMin, setAvisoMin] = useState(cal.aviso ?? 30);
  const [detalle, setDetalle] = useState(!!cal.detalle);
  const [enlace, setEnlace] = useState(null);
  const [activo, setActivo] = useState(!!cal.activo);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const base = api.urlIntegraciones();
  const cambiado = activo && (hora !== cal.hora || minutos !== cal.minutos || avisoMin !== cal.aviso || detalle !== !!cal.detalle);
  const opciones = { hora, minutos, aviso: avisoMin, detalle };

  async function crear() {
    setOcupado(true);
    try { setEnlace(await api.crearIntegracion('calendario', opciones)); setActivo(true); setConfirmar(null); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  }
  async function guardarOpciones() {
    setOcupado(true);
    try { await api.opcionesCalendario(opciones); Object.assign(cal, opciones); aviso('Guardado: tu calendario lo verá en su próxima revisión'); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  }
  async function quitar() {
    setOcupado(true);
    try { await api.quitarIntegracion('calendario'); aviso('Quitada: borra también la suscripción de tu calendario'); alCerrar(); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  }
  const urls = enlace ? urlsCalendario(base, enlace) : null;
  return (
    <Hoja titulo="Tus entrenos en tu calendario" alCerrar={alCerrar}>
      <div class="pila conexiones">
        <p class="peq secundario">Tu calendario (el del iPhone, Google Calendar…) se suscribe a una dirección tuya y cada sesión con día sale como un evento, con su aviso. Cuando cambias el día de una sesión o tu coach publica la semana, el calendario cambia solo la próxima vez que lo revise (suele ser cada pocas horas).</p>
        <div class="campo">
          <label for="sus-hora">Hora a la que sueles entrenar</label>
          <input id="sus-hora" class="entrada" type="time" value={hora} onInput={(e) => setHora(e.currentTarget.value || '18:00')} />
        </div>
        <div class="campo"><span class="etq">Duración</span><Segmentos etiqueta="Duración" valor={minutos} alCambiar={(v) => setMinutos(v ?? 75)} opciones={DURACIONES} /></div>
        <div class="campo"><span class="etq">Aviso</span><Segmentos etiqueta="Aviso" valor={avisoMin} alCambiar={(v) => setAvisoMin(v ?? 30)} opciones={AVISOS} /></div>
        {/* (revisión) las indicaciones del coach, solo si las quiere: las guarda su calendario (Apple, Google…) */}
        <label class="fila conexion-check"><input type="checkbox" checked={detalle} onChange={(e) => setDetalle(e.currentTarget.checked)} /><span class="peq">Incluir las indicaciones de tu coach en cada evento<span class="mini terciario" style="display:block">Si lo marcas, tu calendario (Apple, Google…) guardará también lo que tu coach escribe en cada sesión. Si no, solo el nombre y la hora.</span></span></label>

        {urls ? (
          <div class="pila-s">
            <a class="btn btn-primario btn-grande" href={urls.webcal}><Icono n="calendario" /> Añadir al calendario del iPhone</a>
            <a class="btn" href={urls.google} target="_blank" rel="noopener"><Icono n="calendario" /> Añadir a Google Calendar</a>
            <EnlaceNuevo url={urls.https} etiqueta="Dirección" />
            <span class="mini terciario">En el iPhone, toca «Suscribirse». En Google Calendar (desde el ordenador), «Añadir». La dirección solo se enseña ahora: es personal, no la compartas.</span>
          </div>
        ) : enlace ? (
          <p class="nota peq">{modo === 'demo' ? 'En la demo no se crea una dirección de verdad: en tu app, aquí tendrías los botones para suscribirte.' : 'Falta la dirección de Supabase en la configuración de la app.'}</p>
        ) : activo ? (
          <div class="pila-s">
            <p class="peq"><Icono n="hecho" /> Ya estás suscrito{cal.ultimo ? ` (tu calendario lo revisó ${haceDias(cal.ultimo)})` : ''}.</p>
            {cambiado && <button type="button" class="btn btn-primario" disabled={ocupado} onClick={guardarOpciones}>Guardar los cambios</button>}
            {confirmar === 'nuevo' ? (
              <div class="nota pila-s">
                <span class="peq">La dirección que tiene tu calendario dejará de valer: quita esa suscripción y añade la nueva.</span>
                <span class="fila"><button type="button" class="btn btn-peq" onClick={() => setConfirmar(null)}>Cancelar</button><button type="button" class="btn btn-peq btn-primario" disabled={ocupado} onClick={crear}>Crear otra</button></span>
              </div>
            ) : <button type="button" class="btn-texto" onClick={() => setConfirmar('nuevo')}>Crear una dirección nueva (otro móvil, o la perdiste)</button>}
            {confirmar === 'quitar' ? (
              <div class="nota pila-s">
                <span class="peq">Tu calendario dejará de recibir los entrenos (los que ya tenga se quedarán hasta que quites la suscripción).</span>
                <span class="fila"><button type="button" class="btn btn-peq" onClick={() => setConfirmar(null)}>Cancelar</button><button type="button" class="btn btn-peq btn-peligro" disabled={ocupado} onClick={quitar}>Quitar</button></span>
              </div>
            ) : <button type="button" class="btn btn-plano peligro" onClick={() => setConfirmar('quitar')}>Quitar la suscripción</button>}
          </div>
        ) : (
          <button type="button" class="btn btn-primario btn-grande" disabled={ocupado} onClick={crear}><Icono n="calendario" /> Suscribirme</button>
        )}
      </div>
    </Hoja>
  );
}

// ---------------------------------------------------------------- «Apuntar en Salud», al terminar la sesión
export function AnadirASalud({ sesion, resumen }) {
  const [tiene] = usePreferencia(PREF_ATAJO_ENTRENO, false);
  if (!tiene || !esIOS() || !sesion) return null;
  const minutos = resumen?.cardio?.minutos || resumen?.minutos || sesion.duracion_min || 60;
  const href = urlAtajoEntreno({ nombre: sesion.nombre, minutos, tipo: tipoSalud({ tipo: sesion.tipo, modalidad: resumen?.cardio?.modalidad }) });
  return (
    <p class="resumen-salud">
      <a class="btn" href={href}><Icono n="pasos" /> Apuntar en Salud</a>
      <span class="mini terciario">Con tu atajo «{ATAJO_ENTRENO}»: {minutos} min de {tipoSalud({ tipo: sesion.tipo, modalidad: resumen?.cardio?.modalidad }) === 'fuerza' ? 'fuerza' : 'entreno'}.</span>
    </p>
  );
}
