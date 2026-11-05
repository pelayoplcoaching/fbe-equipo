// v0.72 (migración 044): la cuarta tanda de mejoras de la comunidad, «para ti como coach». Lo usan Comunidad.jsx (el muro, el
// perfil y la pestaña Equipo del atleta) y coach/EquipoCoach.jsx (las pestañas Panel y Moderar). Sin la 044, lo de los atletas no
// sale y el coach ve «Disponible tras la migración 044». Los permisos los pone la base: aquí solo se enseña o se esconde.
//   · Eventos y quedadas: «Próximos» arriba de Equipo, la tarjeta en el muro, «Me apunto» / «No voy», quién va y el .ics.
//   · Programados y plantillas (el coach, en el muro).
//   · Panel de la comunidad (recuentos) y el atleta de la semana.
//   · Moderación: silenciar, palabras filtradas, modo lento y lo retenido.
import { useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, Hoja, Vacio, Cargando, Siluetas, descargar } from './comunes.jsx';
import { HojaProgramar } from './Programar.jsx';
import {
  eventosProximos, estadoEvento, plazasLibres, datosICSEvento, quienes, textoDestacado, SILENCIOS, MODOS_LENTO, MAX_TITULO_EVENTO, MAX_LUGAR_EVENTO,
  MAX_DESCRIPCION_EVENTO, MAX_PLAZAS_EVENTO, MAX_MOTIVO_DESTACADO, MAX_PLANTILLAS, eventoValido,
} from '../logica/comunidad.js';
import { calendarioICS } from '../logica/plan.js';
import { fmtProgramado, partesMadrid, fechaMadrid, sumarDias, fmtCorta, fmtConDia } from '../logica/fechas.js';
import { AVISO_044 } from '../datos/api.js';

// ---------------------------------------------------------------- eventos y quedadas
// La fecha corta de un evento («sáb 8 nov, 10:00», hora de Madrid) y su día en dos líneas para la tarjeta
const cuandoEvento = (e) => fmtProgramado(e.empieza_en);
function DiaEvento({ e }) {
  const p = partesMadrid(e.empieza_en);
  const d = new Date(`${p.fecha}T12:00:00`);
  return (
    <span class="ev-dia" aria-hidden="true">
      <span class="ev-dia-mes">{d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}</span>
      <span class="ev-dia-n">{d.getDate()}</span>
    </span>
  );
}
// Un enlace (si el sitio es una dirección web) o el texto del sitio
function Lugar({ lugar }) {
  const url = /^https?:\/\/\S+$/i.test(String(lugar || '').trim()) ? String(lugar).trim() : null;
  return url ? <a href={url} target="_blank" rel="noopener noreferrer" class="ev-lugar">{url.replace(/^https?:\/\//, '')}</a> : <span class="ev-lugar">{lugar}</span>;
}

// La tarjeta de un evento (en el muro y en su hoja): cuándo, dónde, quién va, «Me apunto» / «No voy» y «Añadir al calendario».
// El coach: «Cambiar» y «Cancelar».
export function TarjetaEvento({ e, coach = false, alCambiar, alEditar = null }) {
  const { api, aviso } = useApp();
  const [ocupado, una] = useUnaVez();
  const [cancelar, setCancelar] = useState(false);
  const [verQuien, setVerQuien] = useState(false);
  const estado = estadoEvento(e);
  const libres = plazasLibres(e);
  const responder = (va) => una(async () => {
    try {
      const v = await api.responderEvento(e.id, e.miRespuesta === va ? null : va);
      aviso(v === true ? '¡Apuntado! Te avisamos 2 horas antes' : v === false ? 'Hecho: no vas' : 'Respuesta quitada');
      await alCambiar?.();
    } catch (err) { aviso(err.message, 'error'); }
  });
  const calendario = () => {
    const url = typeof location !== 'undefined' ? location.origin + location.pathname : '';
    descargar(`evento-${partesMadrid(e.empieza_en).fecha}.ics`, calendarioICS([datosICSEvento(e, partesMadrid)], { url }), 'text/calendar;charset=utf-8');
  };
  const anular = () => una(async () => {
    try { await api.cancelarEvento(e.id); aviso('Evento cancelado: a quien iba le llega un aviso'); setCancelar(false); await alCambiar?.(); } catch (err) { aviso(err.message, 'error'); }
  });
  return (
    <article class={`panel panel-pad pila-s evento-equipo ${estado}`} aria-label={`Evento: ${e.titulo}`}>
      <div class="ev-cab">
        <DiaEvento e={e} />
        <div class="pila-xs ev-texto">
          <span class="mini le-k">{estado === 'cancelado' ? 'Evento cancelado' : estado === 'pasado' ? 'Evento pasado' : 'Evento del equipo'}</span>
          <strong class="ev-titulo">{e.titulo}</strong>
          <span class="peq secundario"><Icono n="calendario" /> {cuandoEvento(e)}</span>
          <span class="peq secundario ev-donde"><Icono n="enlace" /> <Lugar lugar={e.lugar} /></span>
        </div>
      </div>
      {e.descripcion && <p class="peq post-texto">{e.descripcion}</p>}
      <div class="ev-quien">
        {e.van.length || (coach && e.noVan.length)
          ? <button type="button" class="btn-texto mini" onClick={() => setVerQuien(true)}>{e.van.length ? `${e.van.length === 1 ? 'Va' : 'Van'} ${quienes(e.van, 3)}` : 'Nadie va todavía'}</button>
          : <span class="mini terciario">Aún no se ha apuntado nadie</span>}
        {libres != null && estado === 'proximo' && <span class="mini terciario">{libres ? `${libres} ${libres === 1 ? 'plaza libre' : 'plazas libres'}` : 'Completo'}</span>}
      </div>
      {estado === 'proximo' && (
        <div class="fila-envolver ev-acciones">
          {!coach && (
            <>
              <button type="button" class={`btn btn-peq ${e.miRespuesta === true ? 'btn-primario' : ''}`} aria-pressed={e.miRespuesta === true ? 'true' : 'false'}
                disabled={ocupado || (libres === 0 && e.miRespuesta !== true)} onClick={() => responder(true)}>{e.miRespuesta === true ? <><Icono n="hecho" /> Vas</> : 'Me apunto'}</button>
              <button type="button" class="btn btn-peq" aria-pressed={e.miRespuesta === false ? 'true' : 'false'} disabled={ocupado} onClick={() => responder(false)}>No voy</button>
            </>
          )}
          <button type="button" class="btn btn-peq plano" onClick={calendario}><Icono n="calendario" /> Añadir al calendario</button>
          {coach && alEditar && <button type="button" class="btn btn-peq" onClick={() => alEditar(e)}><Icono n="editar" /> Cambiar</button>}
          {coach && !cancelar && <button type="button" class="btn btn-peq btn-peligro" onClick={() => setCancelar(true)}>Cancelar</button>}
        </div>
      )}
      {cancelar && (
        <div class="nota pila-s" role="group" aria-label="Cancelar el evento">
          <span class="peq">¿Cancelar «{e.titulo}»? A quien va le llega un aviso; el evento queda como cancelado.</span>
          <span class="fila-envolver">
            <button type="button" class="btn btn-peq" onClick={() => setCancelar(false)}>No</button>
            <button type="button" class="btn btn-peq btn-peligro" disabled={ocupado} onClick={anular}>Sí, cancelarlo</button>
          </span>
        </div>
      )}
      {verQuien && (
        <Hoja titulo="Quién va" alCerrar={() => setVerQuien(false)}>
          <div class="pila-s">
            <p class="peq"><strong>Van ({e.van.length}):</strong> {e.van.length ? e.van.join(', ') : 'nadie todavía'}</p>
            {coach && <p class="peq secundario"><strong>No van ({e.noVan.length}):</strong> {e.noVan.length ? e.noVan.join(', ') : 'nadie'}</p>}
            <p class="mini terciario">Solo salen quienes siguen en el equipo.</p>
          </div>
        </Hoja>
      )}
    </article>
  );
}

// Arriba de Equipo: los próximos eventos en pequeño (tocar uno abre su tarjeta); el coach, con «Nuevo evento». Sin la 044, al
// atleta no le sale nada.
export function Proximos({ coach = false, cambios = 0, alCambiar = null }) {
  const { api } = useApp();
  const [vuelta, setVuelta] = useState(0);
  const lista = useCarga(() => api.eventosComunidad(), [vuelta, cambios]);
  const [abierto, setAbierto] = useState(null);
  const [editar, setEditar] = useState(null); // {} nuevo · evento
  const recargar = async () => { setVuelta((v) => v + 1); alCambiar?.(); };
  if (lista.datos === null && !lista.cargando) return coach ? <p class="mini terciario">Eventos y quedadas: {AVISO_044}.</p> : null;
  const proximos = eventosProximos(lista.datos || []);
  if (!coach && !proximos.length) return null;
  const actual = abierto && (lista.datos || []).find((x) => x.id === abierto);
  return (
    <section class="panel panel-pad pila-s proximos" aria-labelledby="eq-proximos-t">
      <div class="separa">
        <h2 id="eq-proximos-t" class="pr-t"><Icono n="calendario" /> Próximos</h2>
        {coach && <button type="button" class="btn btn-peq" onClick={() => setEditar({})}><Icono n="mas" /> Nuevo evento</button>}
      </div>
      {!proximos.length ? <p class="peq secundario">Crea una quedada o un evento: tus atletas lo verán aquí y en el muro, y podrán apuntarse.</p> : (
        <ul class="lista pr-lista">
          {proximos.slice(0, 3).map((e) => (
            <li key={e.id}>
              <button type="button" class="pr-item" onClick={() => setAbierto(e.id)}>
                <DiaEvento e={e} />
                <span class="pila-xs pr-texto">
                  <span class="pr-titulo">{e.titulo}</span>
                  <span class="mini terciario">{cuandoEvento(e)} · {e.miRespuesta === true ? 'Vas' : `${e.van.length} ${e.van.length === 1 ? 'va' : 'van'}`}</span>
                </span>
                <Icono n="derecha" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {actual && (
        <Hoja titulo="Evento" alCerrar={() => setAbierto(null)}>
          <TarjetaEvento e={actual} coach={coach} alCambiar={recargar} alEditar={(e) => { setAbierto(null); setEditar(e); }} />
        </Hoja>
      )}
      {editar && <HojaEvento evento={editar.id ? editar : null} alCerrar={() => setEditar(null)} alGuardar={() => { setEditar(null); recargar(); }} />}
    </section>
  );
}

// Crear o cambiar un evento (el coach): título, día y hora (de Madrid), sitio o enlace, descripción y plazas (opcionales)
export function HojaEvento({ evento = null, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const p0 = evento ? partesMadrid(evento.empieza_en) : { fecha: sumarDias(fechaMadrid(), 3), hora: '10:00' };
  const [f, setF] = useState({ titulo: evento?.titulo || '', fecha: p0.fecha, hora: p0.hora, lugar: evento?.lugar || '', descripcion: evento?.descripcion || '', plazas: evento?.plazas ?? '' });
  const [ocupado, una] = useUnaVez();
  const c = (k) => (ev) => setF({ ...f, [k]: ev.currentTarget.value });
  const problema = eventoValido(f);
  const guardar = (ev) => {
    ev.preventDefault();
    una(async () => {
      try { await api.guardarEvento(f, evento?.id || null); aviso(evento ? 'Evento guardado' : 'Evento creado: ya lo ven en el muro'); alGuardar(); } catch (err) { aviso(err.message, 'error'); }
    });
  };
  return (
    <Hoja titulo={evento ? 'Cambiar el evento' : 'Nuevo evento'} alCerrar={alCerrar}>
      <form class="pila" onSubmit={guardar}>
        <div class="campo"><label for="ev-titulo">Título</label>
          <input id="ev-titulo" class="entrada" maxLength={MAX_TITULO_EVENTO} required value={f.titulo} onInput={c('titulo')} placeholder="Quedada en el parque" /></div>
        <div class="rejilla-campos">
          <div class="campo"><label for="ev-fecha">Día</label><input id="ev-fecha" type="date" class="entrada" required min={fechaMadrid()} value={f.fecha} onInput={c('fecha')} /></div>
          <div class="campo"><label for="ev-hora">Hora</label><input id="ev-hora" type="time" class="entrada" required step="300" value={f.hora} onInput={c('hora')} /></div>
        </div>
        <div class="campo"><label for="ev-lugar">Sitio o enlace</label>
          <input id="ev-lugar" class="entrada" maxLength={MAX_LUGAR_EVENTO} required value={f.lugar} onInput={c('lugar')} placeholder="Parque del Retiro, puerta de Alcalá" /></div>
        <div class="campo"><label for="ev-desc">Descripción (opcional)</label>
          <textarea id="ev-desc" class="area" rows={3} maxLength={MAX_DESCRIPCION_EVENTO} value={f.descripcion} onInput={c('descripcion')} /></div>
        <div class="campo"><label for="ev-plazas">Plazas (opcional)</label>
          <input id="ev-plazas" type="number" inputMode="numeric" min="1" max={MAX_PLAZAS_EVENTO} class="entrada entrada-num" value={f.plazas} onInput={c('plazas')} placeholder="Sin límite" /></div>
        <p class="mini terciario">Hora de Madrid. Lo ven los del equipo en el muro y en «Próximos»; a quien se apunta le llega un recordatorio 2 horas antes.</p>
        <button class="btn btn-primario" disabled={ocupado || !!problema}>{evento ? 'Guardar' : 'Crear el evento'}</button>
      </form>
    </Hoja>
  );
}

// ---------------------------------------------------------------- programados y plantillas (el coach, en el muro)
// Lo programado que aún no ha salido: cuándo sale, el texto, «Cambiar» (texto y hora) y «Cancelar» (lo borra)
export function Programados({ cambios = 0, alCambiar }) {
  const { api, aviso } = useApp();
  const [vuelta, setVuelta] = useState(0);
  const lista = useCarga(() => api.programadosComunidad(), [vuelta, cambios]);
  const [cambiar, setCambiar] = useState(null);
  const [ocupado, una] = useUnaVez();
  const filas = lista.datos || [];
  if (!filas.length) return null;
  const recargar = () => { setVuelta((v) => v + 1); alCambiar?.(); };
  const borrar = (x) => una(async () => {
    try { await api.borrarDeComunidad(x); aviso('Cancelado: ya no se publicará'); recargar(); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <section class="panel panel-pad pila-s programados" aria-labelledby="eq-programados-t">
      <h2 id="eq-programados-t" class="pr-t"><Icono n="reloj" /> Programados ({filas.length})</h2>
      <ul class="lista prog-lista">
        {filas.map((x) => (
          <li key={x.id} class="pila-xs">
            <span class="mini terciario">{x.tipo === 'encuesta' ? 'Encuesta' : 'Aviso'} · sale el {fmtProgramado(x.publicar_en)}</span>
            <span class="peq prog-texto">{String(x.texto || '').slice(0, 200)}</span>
            <span class="fila-envolver">
              <button type="button" class="btn btn-peq" onClick={() => setCambiar(x)} aria-label={`Cambiar lo programado para el ${fmtProgramado(x.publicar_en)}`}><Icono n="editar" /> Cambiar</button>
              <button type="button" class="btn btn-peq btn-peligro" disabled={ocupado} onClick={() => borrar(x)} aria-label={`Cancelar lo programado para el ${fmtProgramado(x.publicar_en)}`}>Cancelar</button>
            </span>
          </li>
        ))}
      </ul>
      {cambiar && (
        <HojaProgramar titulo={cambiar.tipo === 'encuesta' ? 'Cambiar la encuesta programada' : 'Cambiar el aviso programado'} inicial={cambiar.publicar_en} conTexto={cambiar.tipo !== 'encuesta'} texto={cambiar.texto} boton="Guardar"
          alCerrar={() => setCambiar(null)}
          alGuardar={async ({ enviarEn, texto }) => { try { await api.cambiarProgramado(cambiar.id, { texto: cambiar.tipo === 'encuesta' ? null : texto, publicarEn: enviarEn }); aviso(`Saldrá el ${fmtProgramado(enviarEn)}`); setCambiar(null); recargar(); } catch (e) { aviso(e.message, 'error'); } }}
          alEnviarYa={async ({ texto }) => { try { await api.cambiarProgramado(cambiar.id, { texto: cambiar.tipo === 'encuesta' ? null : texto, publicarEn: null }); aviso('Publicado en el muro'); setCambiar(null); recargar(); } catch (e) { aviso(e.message, 'error'); } }} />
      )}
    </section>
  );
}

// Las plantillas de avisos: «Usar» rellena el aviso; se pueden borrar. alUsar(texto)
export function HojaPlantillas({ alUsar, alCerrar }) {
  const { api, aviso } = useApp();
  const [vuelta, setVuelta] = useState(0);
  const lista = useCarga(() => api.plantillasComunidad(), [vuelta]);
  const [ocupado, una] = useUnaVez();
  const filas = lista.datos || [];
  const borrar = (x) => una(async () => {
    try { await api.borrarPlantilla(x.id); aviso('Plantilla borrada'); setVuelta((v) => v + 1); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <Hoja titulo="Plantillas de avisos" alCerrar={alCerrar}>
      {lista.cargando && !lista.datos ? <Cargando texto="Cargando las plantillas" /> : lista.datos === null ? <p class="secundario">{AVISO_044}.</p> : !filas.length ? (
        <p class="secundario">Aún no tienes plantillas. Escribe un aviso y toca «Guardar como plantilla» (hasta {MAX_PLANTILLAS}).</p>
      ) : (
        <ul class="lista plantillas-avisos">
          {filas.map((x, i) => (
            <li key={x.id} class="pila-xs">
              <span class="peq prog-texto">{x.texto}</span>
              <span class="fila-envolver">
                <button type="button" class="btn btn-peq btn-primario" aria-label={`Usar la plantilla ${i + 1}`} onClick={() => alUsar(x.texto)}>Usar</button>
                <button type="button" class="btn btn-peq btn-peligro" aria-label={`Borrar la plantilla ${i + 1}`} disabled={ocupado} onClick={() => borrar(x)}><Icono n="basura" /> Borrar</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p class="mini terciario">Las plantillas son tuyas: no las ve nadie más ({filas.length} de {MAX_PLANTILLAS}).</p>
    </Hoja>
  );
}

// ---------------------------------------------------------------- el atleta de la semana
// La tarjeta especial, fijada arriba del muro durante 7 días
export function TarjetaDestacado({ d, alAbrirPerfil = null }) {
  if (!d) return null;
  return (
    <section class="panel panel-pad destacado-semana" aria-label={textoDestacado(d.nombre, d.motivo)}>
      <span class="ds-ico" aria-hidden="true">🏅</span>
      <div class="pila-xs">
        <span class="mini le-k">Atleta de la semana</span>
        {alAbrirPerfil
          ? <button type="button" class="btn-texto ds-nombre" onClick={() => alAbrirPerfil(d.perfil_id)}><span class="sr">Ver el perfil de </span>{d.nombre}</button>
          : <strong class="ds-nombre">{d.nombre}</strong>}
        <span class="peq ds-motivo">{d.motivo}</span>
        <span class="mini terciario">Hasta el {fmtConDia(fechaMadrid(new Date(d.hasta)))}</span>
      </div>
    </section>
  );
}

// Elegir el atleta de la semana (el coach): a quién (de dentro y que sale en el ranking) y una línea
export function HojaDestacar({ perfilId = null, alCerrar, alGuardar }) {
  const { api, aviso } = useApp();
  const personas = useCarga(() => Promise.all([api.personasComunidad(), api.miembrosComunidad()]), []);
  const [quien, setQuien] = useState(perfilId || '');
  const [motivo, setMotivo] = useState('');
  const [ocupado, una] = useUnaVez();
  const [per, miembros] = personas.datos || [{}, []];
  const sinRanking = new Set((miembros || []).filter((m) => m.sin_ranking).map((m) => m.perfil_id));
  const lista = Object.entries(per).filter(([, p]) => !p.coach).map(([id, p]) => ({ id, ...p })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const guardar = (e) => {
    e.preventDefault();
    una(async () => {
      try { await api.destacarAtleta(quien, motivo); aviso('Atleta de la semana elegido: le llega un aviso'); alGuardar(); } catch (err) { aviso(err.message, 'error'); }
    });
  };
  return (
    <Hoja titulo="Atleta de la semana" alCerrar={alCerrar}>
      {personas.cargando && !personas.datos ? <Cargando texto="Cargando el equipo" /> : (
        <form class="pila" onSubmit={guardar}>
          <div class="campo"><label for="ds-quien">Quién</label>
            <select id="ds-quien" class="entrada" required value={quien} onChange={(e) => setQuien(e.currentTarget.value)}>
              <option value="">Elige a alguien del equipo</option>
              {lista.map((p) => <option key={p.id} value={p.id} disabled={sinRanking.has(p.id)}>{p.nombre}{sinRanking.has(p.id) ? ' (no sale en el ranking)' : ''}</option>)}
            </select></div>
          <div class="campo"><label for="ds-motivo">Por qué (una línea)</label>
            <input id="ds-motivo" class="entrada" maxLength={MAX_MOTIVO_DESTACADO} required value={motivo} onInput={(e) => setMotivo(e.currentTarget.value)} placeholder="Por no fallar ni un día" />
            <span class="ayuda">{motivo.length} de {MAX_MOTIVO_DESTACADO}</span></div>
          <p class="mini terciario">Sale fijado arriba del muro 7 días y le llega un aviso. Si ya hay uno, lo sustituye. Quien no sale en el ranking no se puede elegir.</p>
          <button class="btn btn-primario" disabled={ocupado || !quien || !motivo.trim()}>🏅 Elegir</button>
        </form>
      )}
    </Hoja>
  );
}

// ---------------------------------------------------------------- moderación
// Silenciar a alguien (24 h o 7 días) o quitarle el silencio. hasta: hasta cuándo está silenciado ahora (o null)
export function HojaSilenciar({ perfilId, nombre, hasta = null, alCerrar, alCambiar }) {
  const { api, aviso } = useApp();
  const [ocupado, una] = useUnaVez();
  const hacer = (horas) => una(async () => {
    try {
      const h = await api.silenciarComunidad(perfilId, horas);
      aviso(h ? `${nombre} no podrá publicar ni comentar hasta el ${fmtProgramado(h)}` : `${nombre} ya puede publicar y comentar`);
      alCambiar?.(h); alCerrar();
    } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <Hoja titulo={`Silenciar a ${nombre}`} alCerrar={alCerrar}>
      <div class="pila">
        <p class="peq secundario">Mientras, puede leer y reaccionar, pero no publicar ni comentar. Lo ve en su muro con una línea tranquila; los demás no lo saben.</p>
        {hasta && <p class="nota peq">Silenciado hasta el {fmtProgramado(hasta)}.</p>}
        <div class="fila-envolver">
          {SILENCIOS.map(([h, t]) => <button key={h} type="button" class="btn" disabled={ocupado} onClick={() => hacer(h)}>Silenciar {t}</button>)}
        </div>
        {hasta && <button type="button" class="btn btn-primario" style="justify-self:start" disabled={ocupado} onClick={() => hacer(0)}>Quitar el silencio</button>}
      </div>
    </Hoja>
  );
}

// La línea que ve el silenciado en lugar del compositor
export function LineaSilencio({ hasta }) {
  return <p class="nota peq silencio-linea" role="status">Tu coach ha pausado tus publicaciones y comentarios hasta el {fmtProgramado(hasta)}. Mientras, puedes leer y reaccionar.</p>;
}

// La pestaña «Moderar» del coach: lo retenido (aprobar o borrar), quién está silenciado, las palabras filtradas y el modo lento
export function ModerarComunidad() {
  const { api, aviso } = useApp();
  const [vuelta, setVuelta] = useState(0);
  const datos = useCarga(() => Promise.all([api.moderacionComunidad(), api.retenidosComunidad(), api.silenciadosComunidad()]), [vuelta]);
  const [texto, setTexto] = useState(null);
  const [lento, setLento] = useState(null);
  const [ocupado, una] = useUnaVez();
  if (datos.cargando && !datos.datos) return <Siluetas forma="tarjetas" n={2} texto="Cargando la moderación" />;
  const [mod, retenidos, silenciados] = datos.datos || [null, [], []];
  if (!mod) return <Vacio icono="escudo" titulo="Moderar">{AVISO_044}.</Vacio>;
  const palabras = texto ?? (mod.palabras || []).join('\n');
  const minutos = lento ?? mod.lento_min ?? 0;
  const recargar = () => setVuelta((v) => v + 1);
  const guardar = (e) => {
    e.preventDefault();
    una(async () => {
      try { const m = await api.guardarModeracion({ palabras, lento: minutos }); setTexto((m?.palabras || []).join('\n')); setLento(null); aviso('Moderación guardada'); recargar(); } catch (err) { aviso(err.message, 'error'); }
    });
  };
  const aprobar = (x) => una(async () => {
    try { await api.aprobarComunidad(x.clase === 'post' ? { postId: x.id } : { comentarioId: x.id }); aviso('Aprobado: ya se ve'); recargar(); } catch (e) { aviso(e.message, 'error'); }
  });
  const borrar = (x) => una(async () => {
    try { if (x.clase === 'post') await api.borrarDeComunidad(x); else await api.borrarComentarioComunidad(x.id); aviso('Borrado'); recargar(); } catch (e) { aviso(e.message, 'error'); }
  });
  const quitarSilencio = (s) => una(async () => {
    try { await api.silenciarComunidad(s.perfil_id, 0); aviso(`${s.nombre} ya puede publicar y comentar`); recargar(); } catch (e) { aviso(e.message, 'error'); }
  });
  return (
    <div class="pila moderar">
      <section class="pila-s" aria-labelledby="mod-retenido-t">
        <h2 id="mod-retenido-t" class="pr-t">Pendiente de revisión</h2>
        {!retenidos.length ? <p class="peq secundario">Nada pendiente. Lo que lleve alguna de tus palabras filtradas se queda aquí: solo lo ves tú (y su autor, que sabe que está pendiente).</p> : (
          <ul class="lista mod-lista">
            {retenidos.map((x) => (
              <li key={x.id} class="panel panel-pad pila-xs">
                <span class="mini terciario">{x.clase === 'post' ? 'Publicación' : 'Comentario'} de {x.autor}</span>
                <span class="peq prog-texto">{x.texto || 'Una foto'}</span>
                <span class="fila-envolver">
                  <button type="button" class="btn btn-peq btn-primario" disabled={ocupado} onClick={() => aprobar(x)} aria-label={`Aprobar ${x.clase === 'post' ? 'la publicación' : 'el comentario'} de ${x.autor}`}><Icono n="hecho" /> Aprobar</button>
                  <button type="button" class="btn btn-peq btn-peligro" disabled={ocupado} onClick={() => borrar(x)} aria-label={`Borrar ${x.clase === 'post' ? 'la publicación' : 'el comentario'} de ${x.autor}`}><Icono n="basura" /> Borrar</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {silenciados.length > 0 && (
        <section class="pila-s" aria-labelledby="mod-silencio-t">
          <h2 id="mod-silencio-t" class="pr-t">Silenciados</h2>
          <ul class="lista mod-lista">
            {silenciados.map((s) => (
              <li key={s.perfil_id} class="panel panel-pad separa">
                <span class="pila-xs"><span>{s.nombre}</span><span class="mini terciario">Hasta el {fmtProgramado(s.silenciado_hasta)}</span></span>
                <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => quitarSilencio(s)} aria-label={`Quitar el silencio a ${s.nombre}`}>Quitar</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <form class="panel panel-pad pila-s" onSubmit={guardar} aria-labelledby="mod-ajustes-t">
        <h2 id="mod-ajustes-t" class="pr-t">Palabras filtradas y modo lento</h2>
        <div class="campo"><label for="mod-palabras">Palabras filtradas (una por línea o separadas por comas)</label>
          <textarea id="mod-palabras" class="area" rows={4} value={palabras} onInput={(e) => setTexto(e.currentTarget.value)} placeholder={'insulto\notra palabra'} />
          <span class="ayuda">Palabras enteras, sin distinguir mayúsculas ni tildes. Lo que las lleve no se publica: queda pendiente hasta que lo apruebes.</span></div>
        <div class="campo"><label for="mod-lento">Modo lento</label>
          <select id="mod-lento" class="entrada" value={minutos} onChange={(e) => setLento(Number(e.currentTarget.value))}>
            {MODOS_LENTO.map(([m, t]) => <option key={m} value={m}>{m ? `Una publicación cada ${t}` : t}</option>)}
          </select>
          <span class="ayuda">Cada atleta, como mucho una publicación cada tantos minutos (los comentarios, los entrenos y los logros, no).</span></div>
        <button class="btn btn-primario" style="justify-self:start" disabled={ocupado}>Guardar</button>
      </form>
      <p class="mini terciario">Para silenciar a alguien 24 horas o 7 días: desde su perfil, una publicación suya o un comentario.</p>
    </div>
  );
}

// ---------------------------------------------------------------- el panel de la comunidad (el coach)
// Las 4 últimas semanas, en recuentos (sin contenido), quién falta, lo pendiente y los más activos; arriba, el atleta de la semana
export function PanelComunidad() {
  const { api } = useApp();
  const [vuelta, setVuelta] = useState(0);
  const panel = useCarga(() => api.panelComunidad(), [vuelta]);
  const dest = useCarga(() => api.destacadoComunidad(), [vuelta]);
  const [elegir, setElegir] = useState(false);
  const [ocupado, una] = useUnaVez();
  const { aviso } = useApp();
  if (panel.cargando && !panel.datos) return <Siluetas forma="tarjetas" n={3} texto="Cargando el panel" />;
  const x = panel.datos;
  if (!x) return <Vacio icono="progreso" titulo="Panel de la comunidad">{AVISO_044}.</Vacio>;
  const actual = dest.datos?.actual || null;
  const historial = (dest.datos?.historial || []).filter((d) => d.id !== actual?.id).slice(0, 8);
  const quitar = () => una(async () => { try { await api.quitarDestacado(); aviso('Ya no hay atleta de la semana'); setVuelta((v) => v + 1); } catch (e) { aviso(e.message, 'error'); } });
  const filas = [['activos', 'Activos'], ['publicaciones', 'Publicaciones'], ['reacciones', 'Reacciones'], ['comentarios', 'Comentarios']];
  return (
    <div class="pila panel-comunidad">
      <section class="pila-s" aria-labelledby="pc-destacado-t">
        <div class="separa">
          <h2 id="pc-destacado-t" class="pr-t">🏅 Atleta de la semana</h2>
          <button type="button" class="btn btn-peq" onClick={() => setElegir(true)}>{actual ? 'Elegir otro' : 'Elegir'}</button>
        </div>
        {actual ? <><TarjetaDestacado d={actual} /><button type="button" class="btn-texto mini peligro" style="justify-self:start" disabled={ocupado} onClick={quitar}>Quitarlo antes de tiempo</button></>
          : <p class="peq secundario">Nadie esta semana. Elige a alguien con una línea: sale arriba del muro 7 días.</p>}
        {historial.length > 0 && (
          <details class="pc-historial"><summary class="peq">Los de antes ({historial.length})</summary>
            <ul class="lista">{historial.map((d) => <li key={d.id} class="peq">{fmtCorta(fechaMadrid(new Date(d.desde)))}: <strong>{d.nombre}</strong> · {d.motivo}</li>)}</ul>
          </details>
        )}
      </section>
      <section class="panel panel-pad pila-s" aria-labelledby="pc-semanas-t">
        <h2 id="pc-semanas-t" class="pr-t">Las últimas 4 semanas</h2>
        <div class="pc-tabla-caja">
          <table class="pc-tabla">
            <caption class="sr">Actividad de los atletas por semana (solo recuentos)</caption>
            <thead><tr><th scope="col"><span class="sr">Qué</span></th>{x.semanas.map((s, i) => <th scope="col" key={s.lunes}>{i === x.semanas.length - 1 ? 'Esta' : fmtCorta(s.lunes)}</th>)}</tr></thead>
            <tbody>{filas.map(([k, t]) => <tr key={k}><th scope="row">{t}</th>{x.semanas.map((s) => <td key={s.lunes} class="num">{s[k]}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p class="mini terciario">Activos: atletas que han publicado, comentado o reaccionado esa semana (de {x.miembros} dentro). Solo recuentos, nada de contenido.</p>
      </section>
      <dl class="pc-cifras">
        <div><dt>Dentro</dt><dd class="num">{x.miembros}</dd></div>
        <div><dt>Avisos sin resolver</dt><dd class="num">{x.reportes}</dd></div>
        <div><dt>Pendiente de revisión</dt><dd class="num">{x.retenidos}</dd></div>
      </dl>
      <section class="panel panel-pad pila-s" aria-labelledby="pc-activos-t">
        <h2 id="pc-activos-t" class="pr-t">Los más activos (28 días)</h2>
        {!x.activos.length ? <p class="peq secundario">Nadie todavía.</p> : (
          <ol class="lista pc-activos">
            {x.activos.map((a) => <li key={a.perfil_id} class="separa"><span>{a.nombre}{a.sin_ranking && <span class="chip chip-mini">Sin ranking</span>}</span><span class="mini terciario num">{a.publicaciones} publ. · {a.comentarios} com. · {a.reacciones} reac.</span></li>)}
          </ol>
        )}
      </section>
      <section class="panel panel-pad pila-s" aria-labelledby="pc-faltan-t">
        <h2 id="pc-faltan-t" class="pr-t">Quién falta</h2>
        <p class="peq"><strong>Nunca han entrado ({x.nunca.length}):</strong> {x.nunca.length ? x.nunca.map((a) => a.nombre).join(', ') : 'nadie'}</p>
        <p class="peq"><strong>Sin publicar, comentar ni reaccionar en 30 días ({x.inactivos.length}):</strong> {x.inactivos.length ? x.inactivos.map((a) => a.nombre).join(', ') : 'nadie'}</p>
      </section>
      {elegir && <HojaDestacar alCerrar={() => setElegir(false)} alGuardar={() => { setElegir(false); setVuelta((v) => v + 1); }} />}
    </div>
  );
}
