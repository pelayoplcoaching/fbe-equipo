import { PropuestasDe } from './PropuestasObjetivo.jsx';
import { tipoDeObjetivo, textoPropuesta } from '../../logica/objetivos-atleta.js';
import { VideosVistosAtleta } from '../Videos.jsx';
import { cacheChat } from '../../datos/cacheChat.js';
import { VERSION_LEGAL } from '../../legal-version.js';
import { textoPrivacidadVista } from '../../logica/privacidad.js';
import { useEffect, useState } from 'preact/hooks';
import { CumplimientoYBloques } from './Cumplimiento.jsx';
import { Actividad } from './Actividad.jsx';
import { Registro } from './RegistroCoach.jsx';
import { SeccionesFicha } from './SeccionesFicha.jsx';
import { CompararFotos } from '../CompararFotos.jsx';
import { CompararVideos } from '../Archivos.jsx';
import { CabeceraGrande, useUnaVez, useAncho, Siluetas, Reserva, useApp, useCarga, Icono, ErrorCaja, Hoja, Vacio, Paso, Segmentos, HojaExportar, Avatar } from '../comunes.jsx';
import { useEtiquetasAtleta, Etiquetas } from './PanelLista.jsx';
import { EditorBloque, ElegirEjercicio } from './Editor.jsx';
import { textoMarca, REPS_MAX_OBJETIVO } from '../../logica/objetivos.js';
import { Invitacion } from './Panel.jsx';
import { VistaProgreso } from '../atleta/Progreso.jsx';
import { Hilo } from '../Hilo.jsx';
import { Chat } from '../Chat.jsx';
import { Diario } from '../Diario.jsx';
import { MiTecnica } from '../tecnica/MiTecnica.jsx';
import { VerArchivo } from '../Archivos.jsx';
import { num, signo, ESCALAS, NOMBRE_ZONA, ESTADOS_OBJETIVO, NOMBRE_ESTADO_OBJETIVO, GRUPOS, rangoVolumen, limpiarObjetivo, VOLUMEN_DEFECTO } from '../../logica/calculos.js';
import { fmtConDia, fmtCorta, hoyISO, lunesDe, sumarDias, rangoSemana, aISO, hace } from '../../logica/fechas.js';
import { escribirPendiente, MAX_PENDIENTE } from '../../logica/radar/pendientes.js';
import { pendienteHecho, contactoDeAtleta } from '../../datos/radar.js';
import { HabitosCoach } from './HabitosCoach.jsx';
import { SuplementosCoach } from './SuplementosCoach.jsx';
import { PausaCoach } from '../Pausas.jsx';
import { CuestionarioCoach, CheckinAMedida, ParaProgramar, LoQueUsa, EsencialCoach } from './CuestionarioCoach.jsx';
import { respuestasDe } from '../../logica/preguntas.js';
import { NIVELES, NOMBRE_NIVEL, AYUDA_NIVEL, conNutricion, conEntrenamiento, SERVICIOS, servicioDe, CAMPOS_SERVICIO } from '../../logica/nivel.js';
import { DIAS_SEMANA, diasSemanaValido, textoDiasSemana } from '../../logica/semana-natural.js';
import { vecinos } from '../../logica/panel-atletas.js';
import { NutricionFicha } from './ComidasCoach.jsx';
import { CobrosAtleta } from './Cobros.jsx';
import { TareasCoach } from '../Tareas.jsx';
import { TusMeses } from '../atleta/TuMes.jsx';
import { CompararCheckins } from './CompararCheckins.jsx';
import { ChispaPeso } from './Panel.jsx';
import { estadoAtleta, NOMBRE_ESTADO } from '../../logica/visual.js';
import { LoSuyo, ParaHablarle } from './PersonalCoach.jsx';
import { AMedida } from './AMedidaCoach.jsx';
import { SaludDelMovil, ContactoAtleta } from './Integraciones.jsx';
import { CarreraFicha } from './CarreraCoach.jsx';
import { conCarrera, leerTiempo, fmtTiempo } from '../../logica/carrera.js';
import { IndiceSeguimiento, TendenciasCheckin, ModoLlamada } from './SeguimientoPiezas.jsx';
import { nivelCheckin, adherenciaMedia, zonaCarga, fueraDeZona } from '../../logica/seguimiento-visual.js';

// Las de entrenamiento, fuera a quien solo le llevas la nutrición (v0.26); Nutrición, a quien solo el entrenamiento
const DE_ENTRENAMIENTO = ['programa', 'actividad', 'registro', 'objetivos'];
const PESTANAS = [['programa', 'Programa'], ['mensajes', 'Mensajes'], ['actividad', 'Actividad'], ['registro', 'Registro'], ['carrera', 'Carrera'], ['seguimiento', 'Seguimiento'], ['nutricion', 'Nutrición'], ['videos', 'Vídeos y fotos'], ['objetivos', 'Objetivos'], ['notas', 'Notas'], ['cobros', 'Cobros'], ['datos', 'Datos']];
// (v0.133) Carrera, solo a quien se la llevas
export const pestanasFicha = (a) => PESTANAS.filter(([k]) => (conNutricion(a) || k !== 'nutricion') && (conEntrenamiento(a) || !DE_ENTRENAMIENTO.includes(k)) && (k !== 'carrera' || conCarrera(a)));

// (v0.198) El anterior y el que viene de tu lista de Atletas
function VecinosFicha({ lista, atletaId, nombreDe, ir }) {
  const v = vecinos(lista, atletaId);
  if (!v.puesto || v.total < 2) return null;
  const primer = (id) => (nombreDe?.(id) || '').split(' ')[0] || 'otro atleta';
  return (
    <div class="vecinos-ficha fila" role="group" aria-label={`Atleta ${v.puesto} de ${v.total} de tu lista`}>
      <button type="button" class="btn btn-icono plano" disabled={!v.anterior} onClick={() => v.anterior && ir(v.anterior)} aria-label={v.anterior ? `Atleta anterior de tu lista: ${primer(v.anterior)}` : 'Es el primero de tu lista'} title={v.anterior ? primer(v.anterior) : undefined}><Icono n="atras" /></button>
      <span class="mini terciario num" aria-hidden="true">{v.puesto}/{v.total}</span>
      <button type="button" class="btn btn-icono plano" disabled={!v.siguiente} onClick={() => v.siguiente && ir(v.siguiente)} aria-label={v.siguiente ? `Próximo atleta de tu lista: ${primer(v.siguiente)}` : 'Es el último de tu lista'} title={v.siguiente ? primer(v.siguiente) : undefined}><Icono n="derecha" /></button>
    </div>
  );
}

export function Ficha({ atletaId, alVolver, pestanaInicial = 'programa', alCambiar, resumenInicial = null, lista = [], nombreDe = null, irA = null }) {
  const { api } = useApp();
  // (pulido 4) una ficha que ya se abrió se enseña al momento y se pone al día por detrás
  const ficha = useCarga(() => api.ficha(atletaId), [atletaId], { recuerdo: `ficha:${api.uid()}:${atletaId}` });
  // (v0.200) sus etiquetas de la lista: la cabecera toma el color de la primera
  const etq = useEtiquetasAtleta(atletaId);
  // v0.49: su resumen del panel (bloque, cumplimiento, peso y última actividad) para la cabecera; solo el coach. Se
  // reutiliza el que ya cargó el panel; si no lo hay (búsqueda, notificación), se piden solo las filas de este atleta
  const resumen = useCarga(() => (resumenInicial ? Promise.resolve(resumenInicial) : api.resumenes(undefined, { soloAtleta: atletaId }).then((x) => x[0] || null).catch(() => null)), [atletaId]);
  const r = resumen.datos;
  const [pest, setPest] = useState(pestanaInicial);
  // (v0.205) desde Actividad, a qué ir justo: { sesionId, bloqueId } en Registro, { checkinId } en Seguimiento, { archivoId } en Vídeos
  const [foco, setFoco] = useState(null);
  const irDesdeActividad = (pestana, f = null) => { setFoco(f); setPest(pestana); };
  const [invitar, setInvitar] = useState(false);
  const a = ficha.datos?.atleta;
  // Abierta en Nutrición (desde la búsqueda) a quien solo le llevas el entrenamiento: a Datos, donde se cambia
  // A quien solo le llevas la nutrición, lo de entrenamiento lleva a Nutrición
  useEffect(() => {
    if (!a) return;
    if (!conNutricion(a) && pest === 'nutricion') setPest('datos');
    else if (!conEntrenamiento(a) && DE_ENTRENAMIENTO.includes(pest)) setPest('nutricion');
    else if (!conCarrera(a) && pest === 'carrera') setPest('datos');
  }, [a?.nutricion, a?.entrenamiento, a?.carrera, pest]);

  return (
    <div class="contenido coach">
      <CabeceraGrande clase={etq.color ? `cab-etiqueta cab-etq-${etq.color}` : ''}>
        <button class="btn btn-icono plano" onClick={alVolver} aria-label="Volver a atletas"><Icono n="atras" /></button>
        {a ? <span class={`avatar-estado estado-${r ? estadoAtleta(r) : 'cargando'}`}><Avatar nombre={a.nombre} foto={a.foto} ampliable perfilId={a.perfil_id || null} /></span>
          /* (pulido 2.3) mientras llega la ficha, la foto y la línea de debajo del nombre ya tienen su sitio */
          : !ficha.error && <span class="avatar-estado estado-cargando" aria-hidden="true"><Avatar nombre="" /></span>}
        <div class="titulo">
          <h1>{a?.nombre || 'Atleta'}</h1>
          <div class="sub">{r?.semana ? `${r.bloque?.nombre ? `${r.bloque.nombre} · ` : ''}Semana ${r.semana.numero} de ${r.semana.total}` : a?.objetivo || (a && !a.perfil_id ? 'Pendiente de activar su cuenta' : !a || (resumen.cargando && !r) ? '\u00a0' : '')}</div>
          {!a && !ficha.error && <div class="mini terciario" aria-hidden="true">&nbsp;</div>}
          {a && etq.etiquetas.length > 0 && <div class="ficha-etiquetas"><Etiquetas etiquetas={etq.etiquetas} colores={etq.colores} /></div>}
          {a && (a.nivel || servicioDe(a) !== 'completo' || (conEntrenamiento(a) && diasSemanaValido(a.dias_semana))) && <div class="mini terciario">{[conEntrenamiento(a) && a.nivel && `Nivel ${NOMBRE_NIVEL[a.nivel].toLowerCase()}`, conEntrenamiento(a) && diasSemanaValido(a.dias_semana) && textoDiasSemana(diasSemanaValido(a.dias_semana)), servicioDe(a) !== 'completo' && Object.fromEntries(SERVICIOS)[servicioDe(a)]].filter(Boolean).join(' · ')}</div>}
        </div>
        {/* Sin cuenta vinculada (aunque se haya cambiado su estado a mano), siempre se le puede dar un código */}
        {a && !a.perfil_id && a.estado !== 'baja' && <button class="btn btn-primario btn-peq btn-codigo" onClick={() => setInvitar(true)}><Icono n="enviar" /> <span class="btn-codigo-txt">Código</span></button>}
        {/* (v0.198) repasar a todos sin volver a la lista: el anterior y el que viene, en el orden en que la dejaste */}
        {irA && <VecinosFicha lista={lista} atletaId={atletaId} nombreDe={nombreDe} ir={(id) => irA(id, pest)} />}
      </CabeceraGrande>
      {/* (pulido 2.3) las cifras de arriba guardan su sitio mientras llega la ficha: las pestañas no bajan */}
      <Reserva id="ficha-chips" cargando={!a && !ficha.error}>{a && <ChipsFicha r={r} cargando={resumen.cargando && !r} />}</Reserva>
      <ErrorCaja error={ficha.error} reintentar={ficha.recargar} />
      <SeccionesFicha opciones={a ? pestanasFicha(a) : PESTANAS} valor={pest} alCambiar={setPest} />
      {!a ? <Siluetas forma="tarjetas" n={3} texto="Cargando la ficha" /> : (
        <div class="pestana-panel" role="tabpanel" id="pest-panel" aria-labelledby={`pest-${pest}`} key={pest}>
          {pest === 'programa' && <Programa atleta={a} />}
          {pest === 'mensajes' && (
            <section class="seccion chat-en-ficha">
              <h2 class="sr">Mensajes</h2>
              <Chat atletaId={a.id} nombreAtleta={a.nombre} fotoOtro={a.foto} perfilOtro={a.perfil_id || null} alCambiar={alCambiar} irContexto={(ctx) => setPest(ctx.tipo === 'sesion' ? 'registro' : ctx.tipo === 'checkin' ? 'seguimiento' : 'videos')} />
            </section>
          )}
          {pest === 'actividad' && <Actividad atleta={a} irA={irDesdeActividad} />}
          {pest === 'registro' && <Registro atleta={a} alCambiar={alCambiar} foco={foco?.sesionId || foco?.bloqueId ? foco : null} alUsarFoco={() => setFoco(null)} />}
          {pest === 'carrera' && conCarrera(a) && <CarreraFicha atleta={a} />}
          {pest === 'seguimiento' && <><SaludDelMovil atleta={a} /><Seguimiento atleta={a} ficha={ficha.datos} alCambiar={alCambiar} recargarFicha={() => ficha.recargar(true)} checkinInicial={foco?.checkinId || null} alUsarFoco={() => setFoco(null)} /></>}
          {pest === 'nutricion' && (conNutricion(a) ? <NutricionFicha atleta={a} /> : <SinNutricion irADatos={() => setPest('datos')} />)}
          {pest === 'videos' && <><MiTecnica atletaId={a.id} nombreAtleta={a.nombre} esCoach /><Diario atletaId={a.id} nombreAtleta={a.nombre} esCoach alCambiar={alCambiar} abrirInicial={foco?.archivoId || null} alUsarFoco={() => setFoco(null)} />{/* (YouTube) los vídeos de YouTube que ha visto en la app */}<VideosVistosAtleta atletaId={a.id} /></>}
          {pest === 'objetivos' && <><ParaHablarle atleta={a} /><LoSuyo atletaId={a.id} />{/* (080) lo que tú le escribes a este atleta: frases, imágenes y márgenes de peso */}<AMedida atleta={a} recargar={() => ficha.recargar(true)} /><Objetivos atleta={a} /></>}
          {pest === 'cobros' && <CobrosAtleta atleta={a} />}
          {pest === 'notas' && <Notas atleta={a} notas={ficha.datos.notas} pendientes={ficha.datos.pendientes || []} recargar={() => ficha.recargar(true)} />}
          {pest === 'datos' && <ContactoAtleta atleta={a} />}
          {pest === 'datos' && <Datos atleta={a} recargar={() => ficha.recargar(true)} alBorrar={alVolver} invitar={() => setInvitar(true)} alCambiar={alCambiar} />}
        </div>
      )}
      {invitar && a && <Invitacion atleta={a} alCerrar={() => setInvitar(false)} />}
    </div>
  );
}

// v0.49: las tres cifras que más dicen de un vistazo: cumplimiento (4 semanas), peso y última actividad
function ChipsFicha({ r, cargando }) {
  if (cargando) return <div class="ficha-chips" aria-hidden="true"><span class="sil" style="width:88px;height:30px;border-radius:999px" /><span class="sil" style="width:110px;height:30px;border-radius:999px" /><span class="sil" style="width:96px;height:30px;border-radius:999px" /></div>;
  if (!r) return null;
  const pct = r.cumplimiento?.series?.pct;
  const est = estadoAtleta(r);
  return (
    <ul class="ficha-chips" aria-label="Resumen del atleta">
      <li class={`chip estado-chip estado-${est}`}><span class="punto-estado" aria-hidden="true" />{NOMBRE_ESTADO[est]}</li>
      <li class={`chip num ${pct == null ? '' : pct >= 90 ? 'ok' : pct >= 75 ? '' : 'aviso'}`} title="Series pautadas hechas en las 4 últimas semanas"><Icono n="diana" />{pct == null ? 'Sin cumplimiento aún' : `${pct} % cumplido`}</li>
      <li class="chip num"><Icono n="bascula" />{r.peso ? (r.peso.ritmo ? `${signo(r.peso.ritmo.kgSemana, 2)} kg/sem` : `${num(r.peso.kg)} kg`) : 'Sin pesos'}<ChispaPeso puntos={r.chispas?.peso} /></li>
      <li class="chip"><Icono n="reloj" />{r.ultimaSerie ? `Entrenó ${hace(r.ultimaSerie)}` : 'Sin series aún'}</li>
    </ul>
  );
}

function Programa({ atleta }) {
  const { api } = useApp();
  const bloques = useCarga(() => api.bloquesDe(atleta.id), [atleta.id], { recuerdo: `bloques:${api.uid()}:${atleta.id}` });
  const [bloqueId, setBloqueId] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  useEffect(() => {
    if (!bloques.datos) return;
    if (!bloqueId || !bloques.datos.some((b) => b.id === bloqueId)) {
      const activo = bloques.datos.find((b) => ['activo', 'ajustado'].includes(b.estado)) || bloques.datos[0];
      setBloqueId(activo?.id || null);
    }
  }, [bloques.datos]);
  if (bloques.cargando && !bloques.datos) return <Siluetas forma="tarjetas" n={2} texto="Cargando sus bloques" />;
  const lista = bloques.datos || [];
  return (
    <div class="pila">
      <Reserva id="ficha-para-programar"><ParaProgramar atleta={atleta} /></Reserva>
      <div class="separa" style="flex-wrap:wrap">
        {lista.length > 0 && (
          <select class="selector" style="max-width:420px" aria-label="Bloque" value={bloqueId || ''} onChange={(e) => setBloqueId(e.currentTarget.value)}>
            {lista.map((b) => <option key={b.id} value={b.id}>Bloque {b.numero}: {b.nombre}{['activo', 'ajustado'].includes(b.estado) ? ' (activo)' : b.estado === 'finalizado' ? ' (finalizado)' : ''}</option>)}
          </select>
        )}
        {lista.length > 0 && <button class="btn" onClick={() => setNuevo(true)}><Icono n="mas" /> Nuevo bloque</button>}
      </div>
      {!lista.length ? (
        <div class="panel"><Vacio ilustracion="plantillas" titulo="Sin bloques todavía" accion={<button class="btn btn-primario" onClick={() => setNuevo(true)}>Crear su primer bloque</button>}>
          Crea un bloque desde una plantilla o desde cero. El atleta verá las semanas que publiques.
        </Vacio></div>
      ) : bloqueId && <EditorBloque key={bloqueId} bloqueId={bloqueId} volumenObjetivo={atleta.volumen_objetivo} nivel={atleta.nivel || null} carreraDe={conCarrera(atleta) ? atleta.id : null} alBorrar={() => { setBloqueId(null); bloques.recargar(true); }} alCambiarBloque={() => bloques.recargar(true)} />}
      {nuevo && <NuevoBloque atleta={atleta} bloques={lista} alCerrar={(id) => { setNuevo(false); if (id) { setBloqueId(id); bloques.recargar(true); } }} />}
    </div>
  );
}

function NuevoBloque({ atleta, bloques, alCerrar }) {
  const { api, aviso } = useApp();
  const plantillas = useCarga(() => api.plantillas(), []);
  const lunesSiguiente = sumarDias(lunesDe(hoyISO()), 7);
  const [origen, setOrigen] = useState(bloques.length ? 'copia' : 'plantilla');
  const [f, setF] = useState({ nombre: '', fecha: lunesSiguiente, semanas: 4, sesiones: 3, plantilla: '', copia: bloques[0]?.id || '' });
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { if (plantillas.datos?.length && !f.plantilla) setF((x) => ({ ...x, plantilla: plantillas.datos[0].id })); }, [plantillas.datos]);
  if (origen === 'plantilla' && plantillas.datos && !plantillas.datos.length) setOrigen('vacio');
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  async function crear(e) {
    e.preventDefault();
    setOcupado(true);
    try {
      let b;
      if (origen === 'vacio') b = await api.nuevoBloque(atleta.id, { nombre: f.nombre || 'Nuevo bloque', fecha_inicio: f.fecha, semanas: Number(f.semanas), sesionesPorSemana: Number(f.sesiones) });
      else b = await api.copiarBloque(origen === 'plantilla' ? f.plantilla : f.copia, { atleta_id: atleta.id, fecha_inicio: f.fecha, nombre: f.nombre || null });
      aviso('Bloque creado como borrador: publica cada semana cuando esté lista');
      alCerrar(b.id);
    } catch (err) { aviso(err.message, 'error'); setOcupado(false); }
  }
  return (
    <Hoja titulo="Nuevo bloque" alCerrar={() => alCerrar(null)}>
      <form class="pila" onSubmit={crear}>
        <div class="segmentos" role="group" aria-label="Origen del bloque">
          {plantillas.datos?.length > 0 && <button type="button" aria-pressed={origen === 'plantilla' ? 'true' : 'false'} onClick={() => setOrigen('plantilla')}>Plantilla</button>}
          {bloques.length > 0 && <button type="button" aria-pressed={origen === 'copia' ? 'true' : 'false'} onClick={() => setOrigen('copia')}>Copiar bloque</button>}
          <button type="button" aria-pressed={origen === 'vacio' ? 'true' : 'false'} onClick={() => setOrigen('vacio')}>Vacío</button>
        </div>
        {origen === 'plantilla' && (
          <div class="campo"><label for="nb-pl">Plantilla</label>
            <select id="nb-pl" class="selector" value={f.plantilla} onChange={cambiar('plantilla')}>{(plantillas.datos || []).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
        )}
        {origen === 'copia' && (
          <div class="campo"><label for="nb-cp">Bloque a copiar</label>
            <select id="nb-cp" class="selector" value={f.copia} onChange={cambiar('copia')}>{bloques.map((b) => <option key={b.id} value={b.id}>Bloque {b.numero}: {b.nombre}</option>)}</select></div>
        )}
        {origen === 'vacio' && (
          <div class="rejilla-campos">
            <div class="campo"><label for="nb-sem">Semanas</label><Paso id="nb-sem" valor={Number(f.semanas)} paso={1} min={1} max={16} dec={0} etiqueta="semanas" alCambiar={(v) => setF({ ...f, semanas: v || 1 })} /></div>
            <div class="campo"><label for="nb-ses">Sesiones por semana</label><Paso id="nb-ses" valor={Number(f.sesiones)} paso={1} min={1} max={7} dec={0} etiqueta="sesiones por semana" alCambiar={(v) => setF({ ...f, sesiones: v || 1 })} /></div>
          </div>
        )}
        <div class="campo"><label for="nb-nombre">Nombre</label><input id="nb-nombre" class="entrada" placeholder={origen === 'vacio' ? 'Fuerza base' : 'Igual que el original'} value={f.nombre} onInput={cambiar('nombre')} /></div>
        <div class="campo"><label for="nb-fecha">Empieza el lunes</label><input id="nb-fecha" class="entrada" type="date" required value={f.fecha} onInput={cambiar('fecha')} /></div>
        <button class="btn btn-primario btn-grande" disabled={ocupado}>{ocupado ? 'Creando…' : 'Crear bloque'}</button>
      </form>
    </Hoja>
  );
}

// (v0.205) El registro, sesión a sesión, vive en RegistroCoach.jsx

// Carga de entrenamiento semanal: RPE de la sesión × minutos (Foster y cols., 2001)
function CargaEntreno({ atletaId }) {
  const { api } = useApp();
  const c = useCarga(() => api.carga(atletaId).catch(() => null), [atletaId]);
  const [W, ref] = useAncho();
  if (!c.datos) return null;
  const { semanas, cambio } = c.datos;
  const hay = semanas.some((w) => w.carga > 0);
  const H = 170, izq = 8, der = 8, arr = 18, abj = 22;
  // (v0.203) la zona normal alrededor de su media (de la mitad a vez y media): lo que se sale, en ámbar
  const zona = cambio ? zonaCarga(cambio.media) : null;
  const max = Math.max(1, ...semanas.map((w) => w.carga), cambio?.media || 0, zona ? Math.min(zona.hasta, Math.max(1, ...semanas.map((w) => w.carga)) * 1.15) : 0);
  const ancho = (W - izq - der) / semanas.length;
  const Y = (v) => arr + (1 - v / max) * (H - arr - abj);
  const fuera = cambio && (cambio.ratio >= 1.5 || cambio.ratio <= 0.5);
  return (
    <section class="seccion">
      <div class="seccion-cab">
        <h2>Carga de entrenamiento</h2>
        {cambio && <span class={`chip num ${fuera ? 'aviso' : ''}`}>{!cambio.carga ? 'Sin carga la semana pasada' : `Semana pasada: ${cambio.ratio === 1 ? 'igual que su media' : `${signo(Math.round((cambio.ratio - 1) * 100), 0)} % frente a su media`}`}</span>}
      </div>
      <div class="panel panel-pad pila">
        {!hay ? <p class="secundario">Aparece cuando termine sesiones con su esfuerzo (RPE de la sesión) y su duración.</p> : (
          <svg class="grafica grafica-carga" ref={ref} viewBox={`0 0 ${W} ${H}`} role="img"
            aria-label={`Carga semanal de las últimas ${semanas.length} semanas${cambio ? `; la semana pasada, ${cambio.carga} UA, ${num(cambio.ratio)} veces su media de ${cambio.media}` : ''}${zona ? `; zona normal, de ${Math.round(zona.desde)} a ${Math.round(zona.hasta)} UA${semanas.some((w) => !w.enCurso && fueraDeZona(w.carga, zona)) ? `, fuera de ella: ${semanas.filter((w) => !w.enCurso && fueraDeZona(w.carga, zona)).map((w) => fmtCorta(w.lunes)).join(', ')}` : ''}` : ''}`}>
            <defs><linearGradient id="deg-carga-fuera" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="deg-fuera-a" /><stop offset="1" class="deg-fuera-b" /></linearGradient></defs>
            {zona && <rect class="zona-carga" x={izq} width={W - izq - der} y={Y(Math.min(zona.hasta, max))} height={Math.max(0, Y(zona.desde) - Y(Math.min(zona.hasta, max)))} rx="6" />}
            {semanas.map((w, i) => {
              const x = izq + i * ancho + ancho * 0.18, bw = ancho * 0.64;
              const sale = !w.enCurso && fueraDeZona(w.carga, zona);
              return (
                <g key={w.lunes}>
                  {w.carga > 0 && <rect class={`barra ${w.enCurso ? 'en-curso' : ''} ${w.lunes === cambio?.semana ? 'ultima' : ''} ${sale ? 'fuera' : ''}`} x={x} y={Y(w.carga)} width={bw} height={H - abj - Y(w.carga)} rx="4" />}
                  {!(w.carga > 0) && !w.enCurso && <rect class="sin-carga" x={x} y={H - abj - 2} width={bw} height="2" rx="1" />}
                  {w.carga > 0 && <text class="valor-barra" x={x + bw / 2} y={Y(w.carga) - 5} text-anchor="middle">{w.carga}</text>}
                  {(i % 2 === 1 || i === semanas.length - 1) && <text x={x + bw / 2} y={H - 5} text-anchor="middle">{fmtCorta(w.lunes)}</text>}
                </g>
              );
            })}
            {cambio && <line class="media" x1={izq} x2={W - der} y1={Y(cambio.media)} y2={Y(cambio.media)} stroke-dasharray="5 4" />}
          </svg>
        )}
        <p class="mini terciario">RPE de cada sesión (1 a 10) por sus minutos, sumado por semana (Foster y cols., 2001), en unidades arbitrarias. La línea es la media de las cuatro semanas anteriores a la última completa; la franja de fondo, su zona normal (de la mitad a vez y media de esa media), y las semanas que se salen van en ámbar. La semana en curso va en claro; una raya en el suelo, semana sin carga. Sirve para ver saltos bruscos, no para predecir lesiones.</p>
      </div>
    </section>
  );
}

// Rango de series semanales por músculo para este atleta (lo ve en su progreso y tú en el editor)
function VolumenObjetivo({ atleta, alGuardar }) {
  const { api, aviso } = useApp();
  const inicial = () => Object.fromEntries(GRUPOS.map(([g]) => [g, rangoVolumen(atleta.volumen_objetivo, g).map(String)]));
  const [obj, setObj] = useState(inicial);
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const propios = atleta.volumen_objetivo ? Object.keys(atleta.volumen_objetivo) : [];
  const guardar = async (valor) => {
    setOcupado(true);
    try {
      await api.actualizar('atletas', atleta.id, { volumen_objetivo: valor });
      aviso('Volumen objetivo guardado');
      setAbierto(false);
      alGuardar?.();
    } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  const cambiar = (g, i, v) => setObj((o) => ({ ...o, [g]: o[g].map((x, k) => (k === i ? v.replace(/[^0-9]/g, '') : x)) }));
  return (
    <section class="seccion">
      <div class="seccion-cab">
        <h2>Volumen objetivo</h2>
        <button class="btn-texto" aria-expanded={abierto ? 'true' : 'false'} onClick={() => { setObj(inicial()); setAbierto(!abierto); }}>{abierto ? 'Cerrar' : 'Ajustar'}</button>
      </div>
      {!abierto ? (
        <p class="peq secundario">{propios.length
          ? `Rangos propios en ${propios.map((g) => GRUPOS.find(([x]) => x === g)?.[1].toLowerCase()).filter(Boolean).join(', ')}; el resto, ${VOLUMEN_DEFECTO[0]} a ${VOLUMEN_DEFECTO[1]} series semanales (antebrazo, aductores y lumbares, sin mínimo).`
          : `Rango general: de ${VOLUMEN_DEFECTO[0]} a ${VOLUMEN_DEFECTO[1]} series semanales por músculo (antebrazo, aductores y lumbares, sin mínimo: hasta ${VOLUMEN_DEFECTO[1]}).`}</p>
      ) : (
        <div class="panel panel-pad pila">
          <span class="peq secundario">Mínimo y máximo de series semanales por músculo</span>
          <div class="rejilla-volumen">
            {GRUPOS.map(([g, n]) => (
              <div class="fila-vol" key={g}>
                <span>{n}</span>
                <input inputMode="numeric" aria-label={`${n}: mínimo de series semanales`} value={obj[g][0]} onInput={(e) => cambiar(g, 0, e.currentTarget.value)} />
                <span class="terciario" aria-hidden="true">–</span>
                <input inputMode="numeric" aria-label={`${n}: máximo de series semanales`} value={obj[g][1]} onInput={(e) => cambiar(g, 1, e.currentTarget.value)} />
              </div>
            ))}
          </div>
          <div class="fila-envolver">
            <button class="btn btn-primario" disabled={ocupado} onClick={() => guardar(limpiarObjetivo(Object.fromEntries(Object.entries(obj).map(([g, r]) => [g, r.map(Number)]))))}>Guardar</button>
            {propios.length > 0 && <button class="btn" disabled={ocupado} onClick={() => guardar(null)}>Volver al general</button>}
          </div>
          <p class="mini terciario">Series semanales por músculo: el principal de cada ejercicio cuenta 1 y los secundarios, media. Un rango vacío o al revés (mínimo mayor que máximo) se ignora. El atleta ve la franja en su progreso y tú, en el editor del programa.</p>
        </div>
      )}
    </section>
  );
}

function Seguimiento({ atleta, ficha, alCambiar, recargarFicha, checkinInicial = null, alUsarFoco = null }) {
  const { api, aviso } = useApp();
  const [versionVol, setVersionVol] = useState(0);
  const { molestias } = ficha;
  const checkins = useCarga(() => api.ficha(atleta.id).then((f) => f.checkins), [atleta.id]);
  const preguntas = useCarga(() => api.preguntasCheckin(atleta.id, { archivadas: true }).catch(() => []), [atleta.id]);
  const [abierto, setAbierto] = useState(null);
  const lista = checkins.datos || ficha.checkins;
  // (v0.205) desde Actividad: ese check-in, abierto
  useEffect(() => {
    if (!checkinInicial) return;
    const c = (lista || []).find((x) => x.id === checkinInicial);
    if (c) { setAbierto(c); alUsarFoco?.(); }
  }, [checkinInicial, lista]);
  const respuestasAbierto = abierto ? respuestasDe(abierto, Object.fromEntries((preguntas.datos || []).map((p) => [p.id, p]))) : [];
  const media = (c) => { const v = [c.adherencia_desayuno, c.adherencia_comida, c.adherencia_merienda, c.adherencia_cena].filter(Boolean); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const porSemana = molestias.reduce((m, x) => ((m[x.semana_inicio] ||= []).push(x), m), {});
  const recargar = () => { checkins.recargar(true); alCambiar?.(); };
  const [comparar, setComparar] = useState(false);
  const entrena = conEntrenamiento(atleta);
  // (v0.203) el índice que se queda arriba: a qué apartado ir sin bajar a mano (la pestaña mide varias pantallas)
  const apartados = [entrena && ['seg-a-cumplimiento', 'Cumplimiento'], ['seg-a-habitos', 'Hábitos'], ['seg-a-progreso', 'Progreso'], entrena && ['seg-a-carga', 'Carga'], ['seg-a-checkins', 'Check-ins'], ['seg-a-meses', 'Meses']].filter(Boolean);
  // (v0.204) el modo llamada: su progreso a pantalla completa para enseñárselo en una videollamada
  const [llamada, setLlamada] = useState(false);
  return (
    <div class="pila">
      <IndiceSeguimiento apartados={apartados} />
      <div class="llamada-fila">
        <button type="button" class="btn btn-peq" onClick={() => setLlamada(true)}><Icono n="video" /> Ver con {(atleta.nombre || 'él').split(' ')[0]}</button>
        <span class="mini terciario">Su progreso a pantalla completa y sin tus notas, para compartir pantalla en una videollamada.</span>
      </div>
      {llamada && <ModoLlamada atleta={atleta} entrena={entrena} alCerrar={() => setLlamada(false)} />}
      {/* (pulido 2.3) cada bloque guarda, mientras carga, el sitio que ocupó la última vez: no se empujan al llegar */}
      <Reserva id="seg-tareas"><TareasCoach atleta={atleta} alCambiar={alCambiar} /></Reserva>
      {entrena && <div id="seg-a-cumplimiento" class="seg-apartado"><Reserva id="seg-cumplimiento"><CumplimientoYBloques atletaId={atleta.id} diasSemana={diasSemanaValido(atleta.dias_semana)} /></Reserva></div>}
      <div id="seg-a-habitos" class="seg-apartado"><Reserva id="seg-habitos"><HabitosCoach atleta={atleta} /></Reserva></div>
      {/* (v0.174, 077) lo que toma: lo pauta el coach o lo añade el atleta */}
      <SuplementosCoach atleta={atleta} />
      <div id="seg-a-progreso" class="seg-apartado"><Reserva id="seg-progreso"><VistaProgreso key={versionVol} atletaId={atleta.id} esCoach entrenamiento={entrena} /></Reserva></div>
      {entrena && <div id="seg-a-carga" class="seg-apartado"><Reserva id="seg-carga"><CargaEntreno atletaId={atleta.id} /></Reserva></div>}
      {conEntrenamiento(atleta) && <Reserva id="seg-volumen"><VolumenObjetivo atleta={atleta} alGuardar={() => { setVersionVol((v) => v + 1); recargarFicha?.(); }} /></Reserva>}
      <Reserva id="seg-checkin" cargando={preguntas.cargando && !preguntas.datos}><CheckinAMedida atleta={atleta} preguntas={preguntas} checkins={lista} recargarFicha={recargarFicha} /></Reserva>
      <section class="seccion seg-apartado" id="seg-a-checkins">
        <div class="seccion-cab">
          <h2>Check-ins</h2>
          {lista.length >= 2 && <button class="btn-texto" onClick={() => setComparar(true)}><Icono n="intercambiar" /> Comparar dos</button>}
        </div>
        {/* (v0.203) cómo van sus respuestas, de un vistazo: una minilínea de 8 semanas por dato */}
        {lista.length >= 2 && <TendenciasCheckin checkins={lista} />}
        {!lista.length ? <div class="panel"><Vacio ilustracion="checkins" titulo="Sin check-ins todavía">Cuando envíe el primero, lo verás aquí con su peso, sus respuestas y sus fotos de esas fechas.</Vacio></div> : (
          <div class="panel"><div class="tabla-env" tabIndex={0} role="region" aria-label="Sus check-ins, semana a semana">
            <table class="tabla-simple tabla-clic tabla-checkins">
              <thead><tr><th>Semana</th><th>Sueño</th><th>Energía</th><th>Recup.</th><th>Motivación</th><th>Adherencia</th><th>Pasos</th><th>Molestias</th><th><span class="sr">Estado</span></th></tr></thead>
              <tbody>
                {lista.map((c) => {
                  const m = media(c);
                  const mol = (porSemana[c.semana_inicio] || []).filter((x) => x.intensidad > 0);
                  // (v0.203) cada casilla con el color de su escala (bien, regular o mal); en el móvil, una tarjeta por semana
                  const nv = (campo, v) => { const n = nivelCheckin(campo, v); return n ? `nivel-${n}` : ''; };
                  return (
                    <tr key={c.id} tabIndex={0} onClick={() => setAbierto(c)} onKeyDown={(e) => { if (e.key === 'Enter') setAbierto(c); }}>
                      <td class="ck-semana" data-etq="Semana">{rangoSemana(c.semana_inicio)}</td>
                      <td class={nv('sueno', c.horas_sueno)} data-etq="Sueño">{c.horas_sueno ? `${c.horas_sueno.replace('-', '–')} h` : '—'}</td>
                      <td class={nv('energia', c.energia)} data-etq="Energía">{c.energia ?? '—'}</td>
                      <td class={nv('recuperacion', c.recuperacion)} data-etq="Recup.">{c.recuperacion ?? '—'}</td>
                      <td class={nv('motivacion', c.motivacion)} data-etq="Motivación">{c.motivacion ? ESCALAS.motivacion[c.motivacion - 1] : '—'}</td>
                      <td class={nv('adherencia', adherenciaMedia(c))} data-etq="Adherencia">{m ? ESCALAS.adherencia[Math.round(m) - 1] : '—'}</td>
                      <td class={nv('pasos', c.pasos_media)} data-etq="Pasos">{c.pasos_media ? num(c.pasos_media, 0) : '—'}</td>
                      <td class={nv('molestias', mol.length ? Math.max(...mol.map((x) => x.intensidad)) : null)} data-etq="Molestias">{mol.length ? mol.map((x) => `${NOMBRE_ZONA[x.zona]} ${x.intensidad}`).join(', ') : '—'}</td>
                      <td class="ck-estado">{c.revisado_en ? <Icono n="hecho" width="18" height="18" titulo="Revisado" /> : <span class="chip morado">Pendiente</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div></div>
        )}
        {lista.some((c) => c.notas) && (
          <div class="pila-s">{lista.filter((c) => c.notas).slice(0, 6).map((c) => (
            <div class="nota" key={c.id}><strong>{rangoSemana(c.semana_inicio)}: </strong>{c.notas}</div>
          ))}</div>
        )}
        <p class="mini terciario">Energía y recuperación de 1 (peor) a 5 (mejor). Molestias de 0 a 3. En verde, lo que va bien; en ámbar, lo regular; en rojo suave, lo que conviene mirar (sueño de menos de 6 horas, escalas de 2 o menos, menos de 5000 pasos, molestia moderada o más). Toca una semana para comentarla.</p>
      </section>
      {comparar && <CompararCheckins atleta={atleta} checkins={lista} alCerrar={() => setComparar(false)} />}
      <div id="seg-a-meses" class="seg-apartado"><TusMeses atleta={atleta} atletaId={atleta.id} esCoach /></div>
      {abierto && (
        <Hoja titulo={`Check-in, ${rangoSemana(abierto.semana_inicio)}`} alCerrar={() => setAbierto(null)}>
          {respuestasAbierto.length > 0 && (
            <dl class="respuestas-checkin">
              {respuestasAbierto.map((r) => <div key={r.pregunta.id}><dt>{r.pregunta.texto}</dt><dd>{r.texto}</dd></div>)}
            </dl>
          )}
          {abierto.notas && <p class="cita">«{abierto.notas}»</p>}
          <Hilo atletaId={atleta.id} checkinId={abierto.id} nombreAtleta={atleta.nombre} alCambiar={recargar} vacio="Sin comentarios en este check-in." />
          {!abierto.revisado_en && <button class="btn" onClick={async () => { try { await api.marcarRevisado('checkin', abierto.id); aviso('Check-in revisado'); setAbierto(null); recargar(); } catch (e) { aviso(e.message, 'error'); } }}><Icono n="hecho" /> Marcar revisado</button>}
        </Hoja>
      )}
    </div>
  );
}

// Vídeos de técnica y fotos de progreso del atleta, con su conversación
// Objetivos del atleta: los ve en su pantalla de progreso
function Objetivos({ atleta }) {
  const { api, aviso } = useApp();
  const lista = useCarga(() => api.objetivos(atleta.id), [atleta.id]);
  const [editar, setEditar] = useState(null);
  return (
    <div class="pila">
      {/* (v0.173, 076) lo que propone el atleta y espera respuesta */}
      <PropuestasDe atleta={atleta} alCambiar={() => lista.recargar(true)} />
      <div class="separa"><p class="peq secundario">Los objetivos los ve el atleta en su progreso, con la barra y los días que quedan.</p><button class="btn btn-primario btn-peq" onClick={() => setEditar({})}><Icono n="mas" /> Nuevo objetivo</button></div>
      {!(lista.datos || []).length ? <div class="panel"><Vacio ilustracion="objetivos" icono="diana" titulo="Sin objetivos">Por ejemplo: «Press banca 70 kg a una repetición» para el final del bloque.</Vacio></div> : (
        <div class="panel"><ul class="lista">
          {lista.datos.map((o) => (
            <li key={o.id}>
              <button class="respuesta objetivo-fila" data-hecho={o.auto?.conseguido || o.estado === 'completado' ? '' : undefined} style={{ '--f': Math.min(1, Math.max(0, (o.auto ? o.auto.pct : o.autoPeso ? (o.estado === 'completado' ? 100 : o.autoPeso.pct) : o.progreso_pct || 0) / 100)) }} onClick={() => setEditar(o)}>
                <span><span class="nombre">{o.titulo}</span><br /><span class="detalle">{o.auto?.conseguido ? `Conseguido el ${fmtCorta(o.auto.conseguido.fecha)}` : NOMBRE_ESTADO_OBJETIVO[o.estado]}, {o.auto ? o.auto.pct : o.autoPeso ? (o.estado === 'completado' ? 100 : o.autoPeso.pct) : o.progreso_pct} %{o.auto || o.autoPeso ? ' (automático)' : ''}{o.propuesto_por_atleta ? ', lo propuso el atleta' : ''}{o.fecha_limite ? `, para el ${fmtCorta(o.fecha_limite)}` : ''}</span></span>
                <Icono n="editar" />
              </button>
            </li>
          ))}
        </ul></div>
      )}
      {editar && <EditarObjetivo atleta={atleta} objetivo={editar} alCerrar={(cambio) => { setEditar(null); if (cambio) { lista.recargar(true); aviso('Objetivo guardado'); } }} />}
    </div>
  );
}

function EditarObjetivo({ atleta, objetivo, alCerrar }) {
  const { api, aviso } = useApp();
  const nuevo = !objetivo.id;
  const biblioteca = useCarga(() => api.biblioteca(), []);
  // (v0.173) los objetivos de peso corporal, solo con la migración 076
  const con076 = useCarga(() => api.objetivos076().catch(() => null), []);
  const [f, setF] = useState({
    titulo: objetivo.titulo || '', descripcion: objetivo.descripcion || '', fecha_limite: objetivo.fecha_limite || '', progreso_pct: objetivo.progreso_pct ?? 0, estado: objetivo.estado || 'en_curso',
    tipo: objetivo.ejercicio_id ? 'marca' : nuevo ? 'marca' : tipoDeObjetivo(objetivo) === 'peso' ? 'peso' : 'manual',
    // (v0.173, 076) los de peso corporal (progreso automático con su tendencia) y los de carrera (distancia y tiempo)
    peso: objetivo.peso_objetivo != null ? Number(objetivo.peso_objetivo) : null, km: objetivo.distancia_km != null ? Number(objetivo.distancia_km) : null, tiempo: objetivo.tiempo_seg ? fmtTiempo(objetivo.tiempo_seg) : '',
    ejercicio_id: objetivo.ejercicio_id || null, ejercicio: objetivo.ejercicio || null, kg: objetivo.kg_objetivo != null ? Number(objetivo.kg_objetivo) : null, reps: objetivo.reps_objetivo ?? 1,
  });
  const [elegir, setElegir] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const marca = f.tipo === 'marca', dePeso = f.tipo === 'peso', deCarrera = f.tipo === 'manual' && objetivo.tipo === 'carrera';
  const sugerido = marca && f.ejercicio && f.kg ? `${f.ejercicio} ${textoMarca(f.kg, f.reps)}` : dePeso && f.peso ? textoPropuesta({ tipo: 'peso', peso_kg: f.peso }) : '';
  const segCarrera = deCarrera ? leerTiempo(f.tiempo) : null;
  const valido = (f.titulo.trim() || sugerido) && (!marca || (f.ejercicio_id && f.kg > 0 && f.reps >= 1 && f.reps <= REPS_MAX_OBJETIVO))
    && (!dePeso || (f.peso >= 30 && f.peso <= 300)) && (!deCarrera || (f.km >= 0.1 && f.km <= 500 && segCarrera >= 30));
  async function guardar(e) {
    e.preventDefault();
    if (!valido || guardando) return;
    setGuardando(true);
    const fila = { titulo: (f.titulo.trim() || sugerido), descripcion: f.descripcion.trim() || null, fecha_limite: f.fecha_limite || null, estado: f.estado };
    if (marca) {
      Object.assign(fila, { ejercicio_id: f.ejercicio_id, kg_objetivo: f.kg, reps_objetivo: f.reps });
      // El punto de partida se fija al enlazar (o al cambiar de ejercicio)
      // y desde ese momento cuentan las series para darlo por conseguido
      if (nuevo || f.ejercicio_id !== objetivo.ejercicio_id) {
        fila.e1rm_inicio = await api.e1rmActual(atleta.id, f.ejercicio_id).catch(() => null);
        if (!nuevo) fila.creado_en = new Date().toISOString();
      }
    } else if (dePeso) {
      Object.assign(fila, { ejercicio_id: null, kg_objetivo: null, reps_objetivo: null, e1rm_inicio: null, tipo: 'peso', peso_objetivo: f.peso });
      // El punto de partida, su tendencia de hoy (al crearlo o al pasarlo a objetivo de peso)
      if (nuevo || tipoDeObjetivo(objetivo) !== 'peso') {
        fila.peso_inicio = await api.tendenciaPesoActual(atleta.id).catch(() => null);
        if (!nuevo) fila.creado_en = new Date().toISOString();
      }
    } else {
      Object.assign(fila, { ejercicio_id: null, kg_objetivo: null, reps_objetivo: null, e1rm_inicio: null, progreso_pct: Math.round(f.progreso_pct || 0) });
      if (deCarrera) Object.assign(fila, { distancia_km: f.km, tiempo_seg: segCarrera });
      else if (!nuevo && tipoDeObjetivo(objetivo) === 'peso') Object.assign(fila, { tipo: 'libre', peso_objetivo: null, peso_inicio: null });
      // (revisión) una marca que pasa a «Otro» deja de ser de fuerza
      else if (!nuevo && objetivo.tipo === 'fuerza') fila.tipo = 'libre';
    }
    // (revisión) uno de carrera que pasa a marca o a peso suelta su distancia y su tiempo
    if (!nuevo && objetivo.tipo === 'carrera' && (marca || dePeso)) Object.assign(fila, { distancia_km: null, tiempo_seg: null });
    // (sin la 076 no hay columna «tipo»: solo se toca si el objetivo ya tenía uno distinto)
    if (marca && objetivo.tipo && objetivo.tipo !== 'fuerza') fila.tipo = 'fuerza';
    if (marca && !nuevo && tipoDeObjetivo(objetivo) === 'peso') Object.assign(fila, { peso_objetivo: null, peso_inicio: null });
    try {
      if (nuevo) await api.crear('objetivos', { ...fila, atleta_id: atleta.id }); else await api.actualizar('objetivos', objetivo.id, fila);
      alCerrar(true);
    } catch (err) { aviso(err.message, 'error'); setGuardando(false); }
  }
  return (
    <>
    <Hoja titulo={nuevo ? 'Nuevo objetivo' : 'Editar objetivo'} alCerrar={() => alCerrar(false)}>
      <form class="pila" onSubmit={guardar}>
        <Segmentos etiqueta="Tipo de objetivo" valor={f.tipo} alCambiar={(v) => v && setF({ ...f, tipo: v })}
          opciones={[['marca', 'Marca en un ejercicio'], ...(con076.datos === true || dePeso ? [['peso', 'Peso corporal']] : []), ['manual', 'Otro (lo marcas tú)']]} />
        {marca && (
          <div class="pila-s objetivo-marca">
            <div class="campo"><span class="etq">Ejercicio</span>
              <button type="button" class="btn" style="justify-self:start" onClick={() => setElegir(true)}><Icono n="biblioteca" /> {f.ejercicio || 'Elegir ejercicio'}</button></div>
            <div class="rejilla-campos">
              <div class="campo"><label for="ob-kg">Kilos</label><Paso id="ob-kg" valor={f.kg} paso={2.5} min={0.5} max={1000} dec={2} etiqueta="kilos del objetivo" alCambiar={(v) => setF({ ...f, kg: v })} /></div>
              <div class="campo"><label for="ob-reps">Repeticiones</label><Paso id="ob-reps" valor={f.reps} paso={1} min={1} max={REPS_MAX_OBJETIVO} dec={0} etiqueta="repeticiones del objetivo" alCambiar={(v) => setF({ ...f, reps: v ?? 1 })} /></div>
            </div>
            <p class="mini terciario">El progreso se calcula solo con su 1RM estimado en este ejercicio (de 1 a {REPS_MAX_OBJETIVO} repeticiones), desde el que tenga hoy; se da por conseguido cuando haga una serie con al menos esa carga y esas repeticiones. En dominadas o fondos, la marca son los kilos de lastre; si es solo con el peso del cuerpo, usa «Otro».</p>
          </div>
        )}
        {dePeso && (
          <div class="pila-s objetivo-marca">
            <div class="campo"><label for="ob-peso">Peso al que quiere llegar (kg)</label><Paso id="ob-peso" valor={f.peso} paso={0.5} min={30} max={300} dec={1} etiqueta="kilos del objetivo de peso" alCambiar={(v) => setF({ ...f, peso: v })} /></div>
            <p class="mini terciario">El progreso se calcula solo con su tendencia de peso, desde la que tenga hoy, y le sale la previsión («a este ritmo, hacia el…») si se pesa al menos una vez por semana.</p>
          </div>
        )}
        {deCarrera && (
          <div class="rejilla-campos">
            <div class="campo"><label for="ob-km">Distancia (km)</label><Paso id="ob-km" valor={f.km} paso={1} min={0.1} max={500} dec={2} etiqueta="kilómetros del objetivo" alCambiar={(v) => setF({ ...f, km: v })} /></div>
            <div class="campo"><label for="ob-tiempo">Tiempo</label><input id="ob-tiempo" class="entrada" maxLength={8} value={f.tiempo} onInput={(e) => setF({ ...f, tiempo: e.currentTarget.value })} placeholder="50:00" /></div>
          </div>
        )}
        <div class="campo"><label for="ob-titulo">Objetivo</label><input id="ob-titulo" class="entrada" required={!sugerido} value={f.titulo} onInput={(e) => setF({ ...f, titulo: e.currentTarget.value })} placeholder={sugerido || 'Sentadilla 100 kg × 3'} /></div>
        <div class="campo"><label for="ob-desc">Detalle (opcional)</label><input id="ob-desc" class="entrada" value={f.descripcion} onInput={(e) => setF({ ...f, descripcion: e.currentTarget.value })} /></div>
        <div class="rejilla-campos">
          <div class="campo"><label for="ob-fecha">Para el</label><input id="ob-fecha" type="date" class="entrada" value={f.fecha_limite} onInput={(e) => setF({ ...f, fecha_limite: e.currentTarget.value })} /></div>
          {!marca && !dePeso && <div class="campo"><label for="ob-pct">Progreso (%)</label><Paso id="ob-pct" valor={f.progreso_pct} paso={10} min={0} max={100} dec={0} etiqueta="porcentaje de progreso" alCambiar={(v) => setF({ ...f, progreso_pct: v ?? 0 })} /></div>}
        </div>
        {objetivo.auto?.conseguido && objetivo.estado !== 'completado' && <p class="mini ok-t">Lo consiguió el {fmtCorta(objetivo.auto.conseguido.fecha)}: ponle el estado «Conseguido» para cerrarlo.</p>}
        <div class="campo"><span class="etq">Estado</span><Segmentos etiqueta="Estado del objetivo" valor={f.estado} alCambiar={(v) => setF({ ...f, estado: v || f.estado })} opciones={ESTADOS_OBJETIVO} /></div>
        <button class="btn btn-primario btn-grande" disabled={!valido || guardando}>Guardar</button>
        {!nuevo && <button type="button" class="btn btn-peligro" onClick={async () => { await api.borrar('objetivos', objetivo.id); alCerrar(true); }}><Icono n="basura" /> Borrar objetivo</button>}
      </form>
    </Hoja>
    {elegir && <ElegirEjercicio biblioteca={biblioteca} alCerrar={() => setElegir(false)} alElegir={(ej) => { setElegir(false); setF((x) => ({ ...x, ejercicio_id: ej.id, ejercicio: ej.nombre })); }} />}
    </>
  );
}

function Notas({ atleta, notas, pendientes = [], recargar }) {
  const { api, aviso } = useApp();
  const [texto, setTexto] = useState('');
  // (v0.201) un tema pendiente de hablar con él: sale en «A quién escribir» hasta que lo hablas
  const [esPendiente, setEsPendiente] = useState(false);
  const [ocupado, una] = useUnaVez();
  const hoy = hoyISO();
  const abiertos = pendientes.filter((p) => !p.hecho);
  const hablados = pendientes.filter((p) => p.hecho).sort((a, b) => (a.hecho < b.hecho ? 1 : -1));
  const nombre = String(atleta?.nombre || '').split(' ')[0] || 'el atleta';
  return (
    <div class="pila">
      <form class="panel panel-pad pila nota-nueva-form" onSubmit={(e) => {
        e.preventDefault();
        if (!texto.trim()) return;
        una(async () => {
          try {
            await api.crearNota(atleta.id, esPendiente ? escribirPendiente(texto, { desde: hoy }) : texto.trim());
            setTexto(''); if (esPendiente) aviso(`Apuntado: te saldrá en «A quién escribir» hasta que lo habléis`, 'ok');
            recargar();
          } catch (err) { aviso(err.message, 'error'); }
        });
      }}>
        <div class="campo"><label for="nota-nueva">{esPendiente ? `Tema pendiente de hablar con ${nombre}` : 'Nota privada'}</label>
          <textarea id="nota-nueva" class="area" value={texto} maxLength={esPendiente ? MAX_PENDIENTE : undefined} onInput={(e) => setTexto(e.currentTarget.value)} placeholder={esPendiente ? 'Por ejemplo: preguntarle por la boda' : 'Solo la ves tú. El atleta no sabe que existe.'} /></div>
        <label class="fila-envolver peq"><input type="checkbox" checked={esPendiente} onChange={(e) => setEsPendiente(e.currentTarget.checked)} /> Es un tema pendiente de hablar con {nombre} (te sale en «A quién escribir»)</label>
        <button class="btn btn-primario" disabled={!texto.trim() || ocupado}>{esPendiente ? 'Apuntar tema' : 'Guardar nota'}</button>
      </form>
      <ContactoFicha atleta={atleta} nombre={nombre} />
      {(abiertos.length > 0 || hablados.length > 0) && (
        <div class="panel panel-pad pila-s">
          <strong class="peq">Pendiente de hablar con {nombre}</strong>
          {abiertos.length ? abiertos.map((p) => (
            <div key={p.id} class="separa">
              <span>{p.texto}<span class="mini terciario">{p.desde > hoy ? ` · te sale el ${fmtCorta(p.desde)}` : ` · desde el ${fmtCorta(p.desde)}`}</span></span>
              <button class="btn btn-peq" disabled={ocupado} onClick={() => una(async () => { try { await pendienteHecho({ api }, p, { hoy }); recargar(); } catch (err) { aviso(err.message, 'error'); } })}><Icono n="hecho" /> Hecho</button>
            </div>
          )) : <span class="peq secundario">Nada pendiente.</span>}
          {hablados.length > 0 && (
            <details class="peq secundario">
              <summary>Ya hablados ({hablados.length})</summary>
              <ul style={{ margin: '8px 0 0', paddingLeft: '18px' }}>{hablados.slice(0, 20).map((p) => <li key={p.id}>{p.texto} · el {fmtCorta(p.hecho)}</li>)}</ul>
            </details>
          )}
        </div>
      )}
      {notas.map((n) => (
        <div class="panel panel-pad pila-s nota-privada" key={n.id}>
          <div class="separa"><span class="peq terciario">{fmtCorta(aISO(new Date(n.creado_en)))}</span>
            <button class="btn btn-icono plano btn-peligro" aria-label="Borrar nota" onClick={async () => { await api.borrarNota(n.id); recargar(); }}><Icono n="basura" /></button></div>
          <p style="white-space:pre-line">{n.texto}</p>
        </div>
      ))}
    </div>
  );
}

// (v0.202) El contacto con él, de un vistazo: tus días de contacto en las 8 últimas semanas y tu último mensaje
function ContactoFicha({ atleta, nombre }) {
  const { api, backend } = useApp();
  const c = useCarga(() => contactoDeAtleta({ api, backend }, atleta.id), [atleta.id]);
  if (!c.datos) return null;
  const { semanas, ultimo, objetivo } = c.datos;
  const total = semanas.reduce((a, b) => a + b, 0);
  return (
    <div class="panel panel-pad pila-s contacto-ficha">
      <strong class="peq">Contacto con {nombre}</strong>
      <div class="contacto-semanas" role="img" aria-label={`Días de contacto por semana, de hace 8 semanas a esta: ${semanas.join(', ')}`}>
        {semanas.map((n, i) => <span key={i} class={`contacto-sem ${n >= objetivo ? 'llega' : n > 0 ? 'algo' : ''}`} title={`${n} ${n === 1 ? 'día' : 'días'}`}>{n}</span>)}
      </div>
      <span class="peq secundario">{total} {total === 1 ? 'día' : 'días'} de contacto en 8 semanas (tu objetivo con {nombre}: {objetivo} por semana){ultimo ? `; tu último mensaje, ${ultimo}` : '; ningún mensaje tuyo en 8 semanas'}.</span>
    </div>
  );
}

// Lo que le llevas (solo entrenamiento o también nutrición) y su nivel, que decide cómo pautas en el editor.
// Se guarda al tocar; el atleta no ve su nivel, solo su tabla.
function ServicioYNivel({ atleta, recargar }) {
  const { api, aviso } = useApp();
  const [ocupado, setOcupado] = useState(false);
  const guardar = async (cambios, texto) => {
    setOcupado(true);
    try { await api.actualizarAtleta(atleta.id, cambios); aviso(texto); recargar(); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  const servicio = servicioDe(atleta);
  // (v0.133) La carrera, solo con la migración 056
  const con056 = useCarga(() => api.carrera056().catch(() => null), []);
  const TEXTO_CAMBIO = { entrenamiento: 'Solo entrenamiento: ya no ve nada de nutrición', completo: 'Ahora ve entrenamiento y nutrición', nutricion: 'Solo nutrición: ya no ve nada de entrenamiento' };
  const AYUDA = {
    entrenamiento: 'No ve nada de nutrición ni le llegan recordatorios de apuntarla. Lo que tuviera se guarda por si vuelves a llevársela.',
    completo: 'Ve su entrenamiento y, en Comidas y en Hoy, su plan de nutrición, sus recetas y su menú.',
    nutricion: 'No ve nada de entrenamiento (ni Semana, ni sesiones, ni fuerza): su Hoy es su menú, su nutrición, sus hábitos y su peso. Lo que tuviera de entrenamiento se guarda.',
  };
  return (
    <section class="panel panel-pad pila servicio-nivel" aria-labelledby="servicio-nivel" aria-busy={ocupado ? 'true' : 'false'}>
      <h2 id="servicio-nivel" class="h-panel">Lo que le llevas</h2>
      <div class="pila-s">
        <span class="peq">Servicio</span>
        <Segmentos etiqueta="Servicio" clase="segmentos-servicio" valor={servicio} opciones={SERVICIOS}
          alCambiar={(v) => {
            if (!v || v === servicio) return;
            // Sin la migración 022 la columna «entrenamiento» no existe: solo se manda si cambia
            const campos = { ...CAMPOS_SERVICIO[v] };
            if (campos.entrenamiento && atleta.entrenamiento === undefined) delete campos.entrenamiento;
            guardar(campos, TEXTO_CAMBIO[v]);
          }} />
        <span class="mini terciario">{AYUDA[servicio]}</span>
      </div>
      {conEntrenamiento(atleta) && (con056.datos === true || atleta.carrera) && <div class="pila-s campo-carrera-servicio">
        <label class="fila-envolver interruptor-linea" for="d-carrera">
          <span class="pila-xs" style="flex:1;min-width:0"><span class="peq">También le llevas la carrera</span>
            <span class="mini terciario">{atleta.carrera ? 'Ve «Tu carrera» (zonas, carreras, plan y revisiones) y sus sesiones de carrera por partes. En la ficha tienes la pestaña Carrera.' : 'Para quien prepara una carrera a la vez que la fuerza: zonas, plan por semanas, sesiones por partes, semáforo y revisiones.'}</span></span>
          <input id="d-carrera" type="checkbox" role="switch" class="interruptor" checked={!!atleta.carrera} disabled={ocupado}
            onChange={(e) => guardar({ carrera: e.currentTarget.checked }, e.currentTarget.checked ? 'Carrera encendida: ya ve «Tu carrera»' : 'Carrera apagada: lo que tenía se guarda')} />
        </label>
      </div>}
      {conEntrenamiento(atleta) && <div class="pila-s">
        <span class="peq">Nivel</span>
        <Segmentos etiqueta="Nivel" clase="segmentos-nivel" valor={atleta.nivel || null} opciones={NIVELES}
          alCambiar={(v) => guardar({ nivel: v }, v ? `Nivel ${NOMBRE_NIVEL[v].toLowerCase()}` : 'Sin nivel')} />
        <span class="mini terciario">{atleta.nivel ? `${AYUDA_NIVEL[atleta.nivel]}. Donde no le pongas carga, verá en cada serie su peso de la última vez. Él no ve su nivel.` : 'Sin nivel, el editor te enseña todas las columnas (RIR, RPE y kg). Toca uno para que la tabla se adapte a cómo le programas.'}</span>
      </div>}
      {conEntrenamiento(atleta) && <div class="pila-s campo-dias-semana">
        <label class="peq" for="d-dias-semana">Días de entreno por semana</label>
        <select id="d-dias-semana" class="selector" aria-describedby="d-dias-semana-ayuda" disabled={ocupado}
          value={diasSemanaValido(atleta.dias_semana) == null ? '' : String(diasSemanaValido(atleta.dias_semana))}
          onChange={(e) => {
            const v = diasSemanaValido(e.currentTarget.value);
            if (v === diasSemanaValido(atleta.dias_semana)) return;
            guardar({ dias_semana: v }, v ? `Su semana: ${textoDiasSemana(v)}, de lunes a domingo` : 'Su semana: la de cada semana programada');
          }}>
          <option value="">Automático (los de cada semana programada)</option>
          {DIAS_SEMANA.map((n) => <option key={n} value={String(n)}>{n}</option>)}
        </select>
        <span class="mini terciario" id="d-dias-semana-ayuda">Para quien lleva microciclos que no caben en una semana natural (por ejemplo, 4 sesiones repartidas a 3 días por semana): la constancia, la racha y los anillos se cuentan por semanas de lunes a domingo con este objetivo.</span>
      </div>}
    </section>
  );
}

function SinNutricion({ irADatos }) {
  return (
    <div class="panel"><Vacio ilustracion="nutricion" icono="nutricion" titulo="Solo le llevas el entrenamiento" accion={<button class="btn" onClick={irADatos}>Cambiarlo en Datos</button>}>
      No ve nada de nutrición en su app. Si empiezas a llevársela, cámbialo en Datos.
    </Vacio></div>
  );
}

function Datos({ atleta, recargar, alBorrar, invitar, alCambiar }) {
  const { api, aviso, perfil } = useApp();
  // (v0.56) si ha visto las novedades de la política (con la 034)
  const vistaPrivacidad = useCarga(() => (atleta.perfil_id ? api.privacidadVistaDe(atleta.perfil_id) : Promise.resolve(null)), [atleta.perfil_id]);
  // (v0.59) la vigente para esta base (2026-12.1 con la 037; sin ella, 2026-12)
  const versionVigente = useCarga(() => api.versionLegal().catch(() => VERSION_LEGAL), []);
  const [f, setF] = useState({ nombre: atleta.nombre, email: atleta.email || '', objetivo: atleta.objetivo || '', notion_url: atleta.notion_url || '', estado: atleta.estado, progresion_auto: atleta.progresion_auto !== false, fecha_alta: atleta.fecha_alta || '' });
  const [borrar, setBorrar] = useState(false);
  const [confirmacion, setConfirmacion] = useState('');
  const [exportado, setExportado] = useState(null);
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const fecha = hoyISO();
  const base = atleta.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
  return (
    <div class="pila">
      {/* (FBE Esencial) quien va por su cuenta: su cuestionario, su visto bueno y su plan */}
      {atleta.modalidad === 'por_su_cuenta' && <EsencialCoach atleta={atleta} alCambiar={() => { recargar(); alCambiar?.(); }} />}
      <ServicioYNivel atleta={atleta} recargar={recargar} />
      {/* (v0.175, 078) pausar la asesoría: sin recordatorios ni alertas, y la racha no se rompe */}
      <PausaCoach atleta={atleta} alCambiar={() => { recargar(); alCambiar?.(); }} />
      <CuestionarioCoach atleta={atleta} alCambiar={alCambiar} />
      <LoQueUsa atleta={atleta} />
      <form class="panel panel-pad pila" onSubmit={async (e) => {
        e.preventDefault();
        try {
          // El estado solo se envía si se ha cambiado aquí (si el atleta activó su cuenta mientras tanto, no se pisa)
          await api.actualizarAtleta(atleta.id, { nombre: f.nombre.trim(), email: f.email.trim() || null, objetivo: f.objetivo.trim() || null, notion_url: f.notion_url.trim() || null, ...(f.estado !== atleta.estado ? { estado: f.estado } : {}), ...(f.fecha_alta && f.fecha_alta !== atleta.fecha_alta ? { fecha_alta: f.fecha_alta } : {}), progresion_auto: f.progresion_auto });
          aviso('Datos guardados'); recargar();
        } catch (err) { aviso(err.message, 'error'); }
      }}>
        <div class="rejilla-campos">
          <div class="campo"><label for="d-nombre">Nombre</label><input id="d-nombre" class="entrada" required value={f.nombre} onInput={cambiar('nombre')} /></div>
          <div class="campo"><label for="d-email">Email</label><input id="d-email" class="entrada" type="email" value={f.email} onInput={cambiar('email')} /></div>
          <div class="campo"><label for="d-estado">Estado</label>
            <select id="d-estado" class="selector" value={f.estado} onChange={cambiar('estado')}>
              {(atleta.estado === 'invitado' || !atleta.perfil_id) && <option value="invitado">Invitado (sin activar)</option>}
              <option value="activo">Activo</option><option value="pausado">Pausado</option><option value="baja">Baja</option>
            </select></div>
        </div>
        <div class="campo"><label for="d-alta">Cliente de FBE desde</label>
          <input id="d-alta" class="entrada" type="date" required max={fecha} value={f.fecha_alta} onInput={cambiar('fecha_alta')} aria-describedby="d-alta-ayuda" />
          <span id="d-alta-ayuda" class="peq terciario">El día que contrató el servicio. Cuenta para sus aniversarios en FBE (1 mes, 6 meses, 1 año…) y su carnet.</span></div>
        <div class="campo"><label for="d-obj">Objetivo</label><input id="d-obj" class="entrada" value={f.objetivo} onInput={cambiar('objetivo')} /></div>
        <div class="campo"><label for="d-notion">Página de Notion</label><input id="d-notion" class="entrada" type="url" value={f.notion_url} onInput={cambiar('notion_url')} /></div>
        <label class="casilla"><input type="checkbox" checked={f.progresion_auto} onChange={(e) => setF({ ...f, progresion_auto: e.currentTarget.checked })} />
          <span>Sugerirle subir carga cuando llegue al tope del rango (doble progresión)<br /><span class="peq terciario">Si lo quitas, la app solo le propone lo pautado y lo de la última vez.</span></span></label>
        <button class="btn btn-primario">Guardar</button>
      </form>
      {atleta.perfil_id && !vistaPrivacidad.cargando && versionVigente.datos && <p class="peq terciario ficha-privacidad-vista">{textoPrivacidadVista(vistaPrivacidad.datos, versionVigente.datos)}</p>}
      {!atleta.perfil_id && atleta.estado !== 'baja' && (
        <div class="panel panel-pad separa"><span>Aún no ha activado su cuenta.</span><button class="btn" onClick={invitar}><Icono n="enviar" /> Generar código nuevo</button></div>
      )}
      <div class="panel panel-pad pila-s">
        <strong>Exportar</strong>
        <p class="peq secundario">Todo lo suyo en un archivo (derecho de acceso y portabilidad), o sus series en una hoja de cálculo.</p>
        <div class="fila-envolver">
          <button class="btn btn-peq" onClick={async () => { try { setExportado({ nombre: `${base}-${fecha}.json`, contenido: JSON.stringify(await api.exportar(atleta.id), null, 2), tipo: 'application/json' }); } catch (e) { aviso(e.message, 'error'); } }}><Icono n="descargar" /> Datos completos (JSON)</button>
          <button class="btn btn-peq" onClick={async () => { try { setExportado({ nombre: `${base}-series-${fecha}.csv`, contenido: await api.seriesCsv(atleta.id), tipo: 'text/csv;charset=utf-8' }); } catch (e) { aviso(e.message, 'error'); } }}><Icono n="descargar" /> Series (CSV para Excel)</button>
        </div>
      </div>
      <div class="panel panel-pad pila-s">
        <strong>Borrar atleta</strong>
        <p class="peq secundario">Borra su ficha, sus bloques, todo lo que ha registrado y sus vídeos y fotos. Úsalo cuando pida la supresión de sus datos; para una baja normal, cambia el estado a «Baja».</p>
        {!borrar ? <button class="btn btn-peligro" style="justify-self:start" onClick={() => setBorrar(true)}><Icono n="basura" /> Borrar todos sus datos</button> : (
          <div class="pila-s">
            <label for="d-confirma" class="peq">Escribe su nombre para confirmar: <strong>{atleta.nombre}</strong></label>
            <input id="d-confirma" class="entrada" value={confirmacion} onInput={(e) => setConfirmacion(e.currentTarget.value)} />
            <div class="fila-envolver">
              <button class="btn" onClick={() => { setBorrar(false); setConfirmacion(''); }}>Cancelar</button>
              <button class="btn btn-peligro" disabled={confirmacion.trim() !== atleta.nombre} onClick={async () => { await api.borrarAtleta(atleta.id); cacheChat().quitarAtleta(perfil?.id, atleta.id).catch(() => {}); aviso('Atleta borrado'); alBorrar(); }}>Borrar definitivamente</button>
            </div>
          </div>
        )}
      </div>
      {exportado && <HojaExportar titulo="Exportar" {...exportado} alCerrar={() => setExportado(null)} />}
    </div>
  );
}
