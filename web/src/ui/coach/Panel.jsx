import { useEffect, useRef, useState } from 'preact/hooks';
import { HojaAvisos } from '../Avisos.jsx';
import { useEstrecha } from '../BarraMas.jsx';
import { CabeceraGrande, useUnaVez, Siluetas, Reserva, useApp, useCarga, Icono, Cargando, ErrorCaja, Hoja, Vacio, copiar, Avatar, Segmentos, DegradadoAro } from '../comunes.jsx';
import { NIVELES, AYUDA_NIVEL, SERVICIOS, CAMPOS_SERVICIO } from '../../logica/nivel.js';
import { BandaDemo } from '../App.jsx';
import { num, signo, NOMBRE_FOCO, ESCALAS } from '../../logica/calculos.js';
import { hace, fmtCorta } from '../../logica/fechas.js';
import { fmtEuros } from '../../logica/cobros.js';
import { estadoAtleta, NOMBRE_ESTADO, chispaSuave } from '../../logica/visual.js';
import { equipoHoy, arcoDial } from '../../logica/tablero.js';
import { hoyISO } from '../../logica/fechas.js';
import { AvisoAlmacenamientoPanel } from '../tecnica/Limpieza.jsx';
import { CumplesHoy } from './PersonalCoach.jsx';

// v0.49: minigráficas del panel (solo las ve el coach): el peso de las últimas semanas y las sesiones hechas de las
// programadas en las 6 últimas, con su texto para los lectores de pantalla
export function ChispaPeso({ puntos = [] }) {
  if (puntos.length < 2) return null;
  const ys = puntos.map((p) => p.y);
  const dif = ys[ys.length - 1] - ys[0];
  return (
    <svg class={`chispa chispa-peso ${dif < -0.05 ? 'baja' : dif > 0.05 ? 'sube' : ''}`} viewBox="0 0 64 20" width="64" height="20" role="img"
      aria-label={`Peso en ${puntos.length} semanas: de ${num(ys[0])} a ${num(ys[ys.length - 1])} kg`}>
      {(() => { const c = chispaSuave(ys, 64, 20, 3); return <><path d={c.d} />{c.fin && <circle class="chispa-fin" cx={c.fin[0]} cy={c.fin[1]} r="2.4" />}</>; })()}
    </svg>
  );
}
export function ChispaSesiones({ semanas = [] }) {
  if (!semanas.some((w) => w.total > 0)) return null;
  const w = 64 / semanas.length;
  return (
    <svg class="chispa chispa-sesiones" viewBox="0 0 64 20" width="64" height="20" role="img"
      aria-label={`Sesiones en las ${semanas.length} últimas semanas: ${semanas.map((x) => (x.total ? `${x.hechas} de ${x.total}` : 'sin programar')).join(', ')}`}>
      {semanas.map((x, i) => {
        const h = x.total ? Math.max(2, (Math.min(x.hechas, x.total) / x.total) * 18) : 2;
        return <rect key={x.lunes} class={!x.total ? 'vacia' : x.hechas >= x.total ? 'llena' : ''} x={i * w + 1.5} y={20 - h - 1} width={w - 3} height={h} rx="1.5" />;
      })}
    </svg>
  );
}

function Pips({ hechas, total }) {
  if (!total) return <span class="terciario">—</span>;
  return <span class="pips" role="img" aria-label={`${hechas} de ${total} sesiones`}>{Array.from({ length: total }, (_, i) => <i key={i} class={i < hechas ? 'hecha' : ''} />)}</span>;
}

// Los avisos de un atleta. En la tabla del escritorio van en su columna con max={2}: se ven los dos primeros (lo que
// hay por revisar y lo más urgente, que es como llegan ordenados) y un «+N» con el resto al pasar el ratón; los demás
// siguen en la página para los lectores de pantalla (diseno.css, bloque 10). En las tarjetas del móvil, todos.
function Alertas({ r, pendientes, max = 0 }) {
  if (!r.alertas.length && !pendientes) return null;
  const textos = [...(pendientes > 0 ? [`${pendientes} por revisar`] : []), ...r.alertas.map((a) => a.texto)];
  const resto = max > 0 ? textos.slice(max) : [];
  return (
    <div class="alertas" data-max={max || undefined}>
      {pendientes > 0 && <span class="chip morado" title={max ? textos[0] : undefined}><Icono n="bandeja" /><span class="chip-txt">{pendientes} por revisar</span></span>}
      {r.alertas.map((a) => <span key={a.tipo} class={`chip ${a.nivel}`} title={max ? a.texto : undefined}>{a.nivel !== 'info' && <Icono n="alerta" />}<span class="chip-txt">{a.texto}</span></span>)}
      {resto.length > 0 && <span class="chip mas num" aria-hidden="true" title={resto.join(' · ')}>+{resto.length}</span>}
    </div>
  );
}

const sueno = (h) => (h ? `${h.replace('-', '–')} h` : '—');
const MOLESTIA = ['Sin dolor', 'Leve', 'Moderada', 'Grave'];

export function Panel({ abrir, pendientes = {}, porRevisar = null, irARevisar = null, peticion = null, alBuscar, abrirCuenta, alCargar }) {
  const { api, perfil } = useApp();
  // (pulido 4) al volver a la lista se enseña al momento la última cargada y se pone al día por detrás
  const res = useCarga(() => api.resumenes(), [], { recuerdo: `resumenes:${api.uid()}` });
  // (pulido 3.10) Al poner el dedo sobre un atleta (unas décimas antes de que se abra su ficha) se empieza a pedir:
  // cuando la pantalla se abre, la respuesta ya está de camino (las consultas iguales se comparten). Solo si el dedo
  // se queda quieto un instante (si es para desplazar la lista, no se pide nada) y una vez por atleta cada pocos segundos
  const adelanto = useRef({ t: null, x: 0, y: 0, hechos: new Map() });
  const soltarAdelanto = () => { clearTimeout(adelanto.current.t); adelanto.current.t = null; };
  const adelantar = (id, e) => {
    const a = adelanto.current;
    soltarAdelanto();
    if (Date.now() - (a.hechos.get(id) || 0) < 8000) return;
    a.x = e.clientX; a.y = e.clientY;
    a.t = setTimeout(() => { a.t = null; a.hechos.set(id, Date.now()); api.ficha(id).catch(() => {}); api.bloquesDe(id).catch(() => {}); }, 80);
  };
  const moverAdelanto = (e) => { const a = adelanto.current; if (a.t && Math.hypot(e.clientX - a.x, e.clientY - a.y) > 6) soltarAdelanto(); };
  useEffect(() => soltarAdelanto, []);
  // (pulido 2.9) al abrir la app, mientras llega la lista de ahora se enseña la última que se cargó en este
  // dispositivo (datos/api.js, resumenesGuardados): la lista sale al momento y se pone al día sola
  const guardada = useCarga(() => (res.datos ? Promise.resolve(null) : api.resumenesGuardados().catch(() => null)), [], { tirar: false });
  const datos = res.datos || guardada.datos || null;   // (si la de ahora no llega, sin conexión, la guardada sigue ahí, con el aviso)
  const cargando = res.cargando && !datos;
  // v0.49: lo cargado se queda en CoachApp para la cabecera de la ficha (sin volver a pedirlo)
  useEffect(() => { if (datos) alCargar?.(datos); }, [datos]);
  const [filtro, setFiltro] = useState('todos');
  const estrecha = useEstrecha(899);   // (el mismo corte que .solo-ancho / .solo-estrecho en estilos.css)
  const [nuevo, setNuevo] = useState(false);
  const [avisos, setAvisos] = useState(false);
  useEffect(() => { if (peticion?.nuevo) setNuevo(true); if (peticion?.avisos) setAvisos(true); }, [peticion?.id]);
  const lista = datos || [];
  const atencion = lista.filter((r) => r.alertas.some((a) => a.nivel !== 'info'));
  const invitados = lista.filter((r) => r.estado === 'invitado');
  const deBaja = lista.filter((r) => r.estado === 'baja');
  // Columna de pagos solo si hay alguno apuntado (v0.25)
  // v0.51: «Hoy en tu equipo» con lo que ya ha cargado el panel (sin consultas nuevas)
  const eq = datos ? equipoHoy(lista, hoyISO()) : null;
  const inactivos = eq ? lista.filter((r) => eq.inactivos.includes(r.atleta_id)) : [];
  const vista = filtro === 'atencion' ? atencion : filtro === 'invitados' ? invitados : filtro === 'baja' ? deBaja : filtro === 'inactivos' ? inactivos : lista.filter((r) => r.estado !== 'baja');
  const conCobros = lista.some((r) => r.cobro);

  return (
    <div class="contenido coach">
      <CabeceraGrande>
        <div class="titulo"><h1>Atletas</h1><div class="sub">{lista.filter((r) => r.estado === 'activo').length} activos{atencion.length ? `, ${atencion.length} necesitan atención` : ''}</div></div>
        <div class="fila" style="gap:8px">
          {alBuscar && <button class="btn btn-icono solo-estrecho" onClick={alBuscar} aria-label="Buscar"><Icono n="buscar" /></button>}
          <button class="btn" onClick={() => setAvisos(true)} aria-label="Avisos para tus atletas"><Icono n="altavoz" /><span class="solo-ancho">Avisos</span></button>
          <button class="btn btn-primario" onClick={() => setNuevo(true)}><Icono n="mas" /><span class="solo-ancho">Añadir atleta</span><span class="sr">Añadir atleta</span></button>
          {abrirCuenta && <button class="btn-avatar solo-estrecho" onClick={abrirCuenta} aria-label="Tu cuenta"><Avatar foto={perfil?.foto} nombre={perfil?.nombre || 'Coach'} /></button>}
        </div>
      </CabeceraGrande>
      <BandaDemo />
      <AvisoAlmacenamientoPanel abrirCuenta={abrirCuenta} />
      {/* (v0.104) quién cumple años hoy */}
      {!cargando && <CumplesHoy lista={lista} abrir={abrir} />}
      <ErrorCaja error={res.error} reintentar={res.recargar} />
      {/* (pulido 2.3) el resumen del equipo guarda su sitio mientras llega la lista: los filtros no bajan */}
      <Reserva id="panel-equipo-hoy" cargando={cargando}>{eq && eq.activos > 0 && <EquipoHoy eq={eq} porRevisar={porRevisar} irARevisar={irARevisar} filtro={filtro} alFiltrar={setFiltro} />}</Reserva>
      <div class="selector-chips" role="group" aria-label="Filtrar atletas">
        <button aria-pressed={filtro === 'todos' ? 'true' : 'false'} onClick={() => setFiltro('todos')}>Todos</button>
        <button aria-pressed={filtro === 'atencion' ? 'true' : 'false'} onClick={() => setFiltro('atencion')}>Necesitan atención ({atencion.length})</button>
        {invitados.length > 0 && <button aria-pressed={filtro === 'invitados' ? 'true' : 'false'} onClick={() => setFiltro('invitados')}>Sin activar ({invitados.length})</button>}
        {deBaja.length > 0 && <button aria-pressed={filtro === 'baja' ? 'true' : 'false'} onClick={() => setFiltro('baja')}>De baja ({deBaja.length})</button>}
        {inactivos.length > 0 && <button aria-pressed={filtro === 'inactivos' ? 'true' : 'false'} onClick={() => setFiltro('inactivos')}>Sin actividad ({inactivos.length})</button>}
      </div>

      {cargando ? <Siluetas forma="lista" n={4} texto="Cargando tus atletas" /> : !vista.length ? (
        <div class="panel"><Vacio ilustracion="filtro" titulo={lista.length ? 'Nadie en esta lista' : 'Aún no hay atletas'}
          accion={!lista.length ? <button class="btn btn-primario" onClick={() => setNuevo(true)}>Añadir el primero</button> : <button class="btn btn-peq" onClick={() => setFiltro('todos')}>Ver a todos</button>}>
          {lista.length ? 'Nadie cumple este filtro: todo en orden por aquí.' : 'Dales de alta y envíales su código de invitación.'}
        </Vacio></div>
      ) : (
        <>
          {/* (pulido 3.3) solo se pinta la que se ve: la tabla en pantalla ancha, las tarjetas en el móvil (antes, las dos
              a la vez y una escondida: el doble de elementos en la lista) */}
          {!estrecha && <div class="panel solo-ancho">
            <div class="tabla-env">
              <table class="atletas-tabla">
                <thead><tr><th>Atleta</th><th>Avisos</th>{conCobros && <th>Pagos</th>}<th>Semana</th><th>Sesiones</th><th>Peso</th><th class="col-extra">Sueño</th><th class="col-extra">Motivación</th><th>Molestias</th><th>Último registro</th></tr></thead>
                <tbody>
                  {vista.map((r) => (
                    <tr key={r.atleta_id} data-estado={estadoAtleta(r)} onPointerDown={(e) => adelantar(r.atleta_id, e)} onPointerMove={moverAdelanto} onPointerCancel={soltarAdelanto} onClick={(e) => abrir(r.atleta_id, undefined, e.currentTarget.querySelector('.avatar'))} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') abrir(r.atleta_id, undefined, e.currentTarget.querySelector('.avatar')); }}>
                      <td class="celda-estado"><div class="nombre"><Avatar nombre={r.nombre} foto={r.foto} /><span>{r.nombre}<span class="sr">. {NOMBRE_ESTADO[estadoAtleta(r)]}</span></span></div></td>
                      <td class="celda-avisos">{r.alertas.length || pendientes[r.atleta_id] ? <Alertas r={r} pendientes={pendientes[r.atleta_id]} max={2} /> : <span class="terciario">—</span>}</td>
                      {conCobros && <td><CobroPanel c={r.cobro} /></td>}
                      {r.servicio === 'nutricion' ? (
                        <td colSpan={2}><span class="chip morado">Solo nutrición</span>{r.diasNutricion != null && <div class="mini terciario">{r.diasNutricion}/7 días apuntados</div>}</td>
                      ) : (
                        <>
                          <td class="num-c">{r.semana ? <><span class="semana-pill" style={{ '--f': Math.min(1, r.semana.numero / (r.semana.total || 1)) }}>S{r.semana.numero}/{r.semana.total}</span><div class="mini terciario">{r.semana.foco ? NOMBRE_FOCO[r.semana.foco] : r.bloque?.nombre}</div></> : '—'}</td>
                          <td><div class="celda-sesiones"><Pips hechas={r.sesiones.completadas} total={r.sesiones.total} /><Cumple c={r.cumplimiento} /><ChispaSesiones semanas={r.chispas?.sesiones} /></div></td>
                        </>
                      )}
                      <td class="num-c">{r.peso ? <>{num(r.peso.kg)} kg<ChispaPeso puntos={r.chispas?.peso} />{r.peso.ritmo ? <div class="mini terciario">{signo(r.peso.ritmo.kgSemana, 2)}/sem</div> : r.peso.cambio != null && <div class="mini terciario">{signo(r.peso.cambio)}</div>}</> : '—'}</td>
                      <td class="num-c col-extra">{sueno(r.checkin?.horas_sueno)}</td>
                      <td class="col-extra">{r.checkin?.motivacion ? ESCALAS.motivacion[r.checkin.motivacion - 1] : '—'}</td>
                      <td>{r.maxMolestia ? <span class={`chip ${r.maxMolestia >= 2 ? 'aviso' : 'info'}`}>{MOLESTIA[r.maxMolestia]}</span> : <span class="terciario">—</span>}</td>
                      <td class="num-c">{r.ultimaSerie ? hace(r.ultimaSerie) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}
          {estrecha && <div class="pila solo-estrecho">
            {vista.map((r) => (
              <button class="tarjeta-atleta" key={r.atleta_id} data-estado={estadoAtleta(r)} onPointerDown={(e) => adelantar(r.atleta_id, e)} onPointerMove={moverAdelanto} onPointerCancel={soltarAdelanto} onClick={(e) => abrir(r.atleta_id, undefined, e.currentTarget.querySelector('.avatar'))}>
                <div class="cab">
                  <Avatar nombre={r.nombre} foto={r.foto} />
                  <span><strong>{r.nombre}</strong><span class="sr">. {NOMBRE_ESTADO[estadoAtleta(r)]}.</span>{r.servicio === 'nutricion' && r.estado === 'activo' ? <span class="mini terciario">Solo nutrición</span> : r.semana ? <span class="mini terciario">Semana {r.semana.numero} de {r.semana.total}{r.semana.foco ? `, ${NOMBRE_FOCO[r.semana.foco].toLowerCase()}` : r.bloque?.nombre ? `, ${r.bloque.nombre}` : ''}</span> : r.estado === 'invitado' ? <span class="mini terciario">Sin activar</span> : r.estado === 'baja' ? <span class="mini terciario">De baja</span> : null}</span>
                  {r.semana && <span class="peq secundario num semana-pill" style={{ '--f': Math.min(1, r.semana.numero / (r.semana.total || 1)) }}>S{r.semana.numero}/{r.semana.total}</span>}
                </div>
                <Alertas r={r} pendientes={pendientes[r.atleta_id]} />
                {r.estado === 'activo' && (
                  <div class="datos">
                    {r.servicio === 'nutricion'
                      ? <div><div class="k">Nutrición</div><div class="v">{r.diasNutricion != null ? `${r.diasNutricion}/7 días` : '—'}</div></div>
                      : <div><div class="k">Sesiones</div><div class="v"><Pips hechas={r.sesiones.completadas} total={r.sesiones.total} /><Cumple c={r.cumplimiento} corto /><ChispaSesiones semanas={r.chispas?.sesiones} /></div></div>}
                    <div><div class="k">Peso</div><div class="v">{r.peso ? `${num(r.peso.kg)}${r.peso.ritmo ? ` (${signo(r.peso.ritmo.kgSemana, 2)}/sem)` : r.peso.cambio != null ? ` (${signo(r.peso.cambio)})` : ''}` : '—'}<ChispaPeso puntos={r.chispas?.peso} /></div></div>
                    {r.servicio !== 'nutricion' && <div><div class="k">Último registro</div><div class="v">{r.ultimaSerie ? hace(r.ultimaSerie) : '—'}</div></div>}
                  </div>
                )}
                {r.cobro && <div class="cobro-tarjeta"><span class="k">Pagos</span><CobroPanel c={r.cobro} enLinea /></div>}
              </button>
            ))}
          </div>}
        </>
      )}
      {avisos && <HojaAvisos alCerrar={() => setAvisos(false)} />}
      {nuevo && <NuevoAtleta alCerrar={(id) => { setNuevo(false); res.recargar(true); if (id) abrir(id); }} />}
    </div>
  );
}

// v0.51: «Hoy en tu equipo», como un resumen de WHOOP: cuántos de los activos han entrenado hoy (un dial), lo que
// tienes por revisar (lleva a Revisar) y cuántos llevan 7 días o más sin actividad (filtra la lista)
function EquipoHoy({ eq, porRevisar, irARevisar, filtro, alFiltrar }) {
  const a = arcoDial(eq.activos ? eq.entrenaron / eq.activos : 0, 64, 7);
  const n = eq.inactivos.length;
  return (
    <section class="panel equipo-hoy" aria-label="Hoy en tu equipo">
      <div role="img" aria-label={`Han entrenado hoy ${eq.entrenaron} de ${eq.activos} activos`} class="eh-dial">
        <span class="dial-esfera" aria-hidden="true">
          <svg viewBox="0 0 64 64"><DegradadoAro id="aro-equipo-hoy" /><path class="dial-pista" d={a.d} stroke-width="7" />{eq.entrenaron > 0 && <path class="dial-arco" style={{ stroke: 'url(#aro-equipo-hoy)' }} d={a.d} stroke-width="7" stroke-dasharray={`${a.lleno} ${a.largo + 10}`} />}</svg>
          <span class="dial-centro marcador"><span>{eq.entrenaron}<span class="u">/{eq.activos}</span></span></span>
        </span>
        <span class="eh-k" aria-hidden="true">Entrenaron hoy</span>
      </div>
      {irARevisar ? (
        <button type="button" onClick={irARevisar} aria-label={`${porRevisar || 0} por revisar. Ir a Revisar`}>
          <span class={`eh-cifra marcador ${!porRevisar ? 'cero' : ''}`} aria-hidden="true">{porRevisar || 0}</span>
          <span class="eh-k" aria-hidden="true">Por revisar</span>
        </button>
      ) : <div><span class="eh-cifra marcador">{porRevisar || 0}</span><span class="eh-k">Por revisar</span></div>}
      <button type="button" aria-pressed={filtro === 'inactivos' ? 'true' : 'false'} disabled={!n && filtro !== 'inactivos'} onClick={() => alFiltrar(filtro === 'inactivos' ? 'todos' : 'inactivos')}
        aria-label={`${n} sin actividad desde hace 7 días o más.${n ? (filtro === 'inactivos' ? ' Ver a todos' : ' Ver quiénes') : ''}`}>
        <span class={`eh-cifra marcador ${n ? 'alerta' : 'cero'}`} aria-hidden="true">{n}</span>
        <span class="eh-k" aria-hidden="true">Sin actividad ≥ 7 días</span>
      </button>
    </section>
  );
}

// Cómo va con los pagos, en una línea (los mismos estados que en Cobros)
const CLASE_COBRO = { al_dia: 'ok', vence_pronto: 'aviso', pendiente: 'aviso', primer_cobro: 'aviso', vencido: 'aviso', retrasado: 'alerta' };
const CORTO_COBRO = { al_dia: 'Al día', vence_pronto: 'Vence pronto', pendiente: 'Pendiente', primer_cobro: 'Primer cobro', vencido: 'Sin renovar', retrasado: 'Retrasado' };
function CobroPanel({ c, enLinea = false }) {
  if (!c || c.estado === 'sin_datos') return <span class="terciario">—</span>;
  const detalle = c.debe > 0 ? `Debe ${fmtEuros(c.debe)}` : c.pagadoHasta ? `Hasta el ${fmtCorta(c.pagadoHasta)}` : '';
  return (
    <span class={`cobro-panel ${enLinea ? 'en-linea' : ''}`}>
      <span class={`chip ${CLASE_COBRO[c.estado] || 'info'}`}>{CORTO_COBRO[c.estado] || '—'}</span>
      {detalle && <span class="mini terciario num">{detalle}</span>}
    </span>
  );
}

function NuevoAtleta({ alCerrar }) {
  const { api } = useApp();
  const [f, setF] = useState({ nombre: '', email: '', objetivo: '', notion_url: '', servicio: 'completo', nivel: null });
  const [error, setError] = useState(null);
  const [creado, setCreado] = useState(null);
  const [ocupado, una] = useUnaVez();
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  if (creado) return <Invitacion atleta={creado} alCerrar={() => alCerrar(creado.id)} />;
  return (
    <Hoja titulo="Añadir atleta" alCerrar={() => alCerrar(null)}>
      <form class="pila" onSubmit={(e) => {
        e.preventDefault();
        una(async () => {
          try {
            const a = await api.crearAtleta({ nombre: f.nombre.trim(), email: f.email.trim() || null, objetivo: f.objetivo.trim() || null, notion_url: f.notion_url.trim() || null, ...CAMPOS_SERVICIO[f.servicio], nivel: f.servicio === 'nutricion' ? null : f.nivel });
            setCreado(a);
          } catch (err) { setError(err.message); }
        });
      }}>
        {error && <div class="error" role="alert">{error}</div>}
        <div class="campo"><label for="na-nombre">Nombre y apellidos</label><input id="na-nombre" class="entrada" required value={f.nombre} onInput={cambiar('nombre')} /></div>
        <div class="campo"><label for="na-email">Email</label><input id="na-email" class="entrada" type="email" value={f.email} onInput={cambiar('email')} /><span class="ayuda">Solo para tu referencia; el atleta crea su cuenta con el email que quiera.</span></div>
        <div class="campo"><span class="etq">Servicio</span>
          <Segmentos etiqueta="Servicio" clase="segmentos-servicio" valor={f.servicio} opciones={SERVICIOS}
            alCambiar={(v) => v && setF({ ...f, servicio: v })} /></div>
        {f.servicio !== 'nutricion' && <div class="campo"><span class="etq">Nivel</span>
          <Segmentos etiqueta="Nivel" clase="segmentos-nivel" valor={f.nivel} opciones={NIVELES} alCambiar={(v) => setF({ ...f, nivel: v })} />
          <span class="ayuda">{f.nivel ? AYUDA_NIVEL[f.nivel] : 'Decide cómo pautas la carga en el editor. Puedes elegirlo después, en Datos.'}</span></div>}
        <div class="campo"><label for="na-obj">Objetivo</label><input id="na-obj" class="entrada" value={f.objetivo} onInput={cambiar('objetivo')} placeholder="Ganar fuerza y bajar 3 kg" /></div>
        <div class="campo"><label for="na-notion">Su página de Notion</label><input id="na-notion" class="entrada" type="url" value={f.notion_url} onInput={cambiar('notion_url')} placeholder="https://notion.so/…" /><span class="ayuda">La verá en su perfil para la alimentación y los recursos hasta que pasen a la app.</span></div>
        <button class="btn btn-primario btn-grande" disabled={ocupado}>{ocupado ? 'Creando…' : 'Crear y generar código'}</button>
      </form>
    </Hoja>
  );
}

export function Invitacion({ atleta, alCerrar }) {
  const { api, aviso, modo } = useApp();
  const codigo = useCarga(() => api.crearInvitacion(atleta.id), [atleta.id], { tirar: false });   // (no es una consulta: crea el código)
  const url = typeof location !== 'undefined' ? location.origin + location.pathname : '';
  const nombre = atleta.nombre.split(' ')[0];
  const mensaje = codigo.datos
    ? `Hola, ${nombre}. Ya tienes tu acceso a la app de FBE Coaching. Entra en ${url}, toca «Activa tu cuenta» y escribe este código: ${codigo.datos}. Caduca en 14 días y solo vale una vez.`
    : '';
  return (
    <Hoja titulo={`Invitación para ${nombre}`} alCerrar={alCerrar}>
      {codigo.cargando ? <Cargando /> : codigo.error ? <ErrorCaja error={codigo.error} /> : (
        <div class="pila">
          <div class="codigo-grande num">{codigo.datos}</div>
          <p class="peq secundario">El código caduca en 14 días y solo sirve una vez. Si generas otro, este deja de valer.</p>
          <div class="campo"><span class="etq">Mensaje para enviarle</span><div class="nota" style="user-select:all">{mensaje}</div></div>
          <div class="fila-envolver">
            <button class="btn btn-primario" onClick={async () => aviso((await copiar(mensaje)) ? 'Mensaje copiado' : 'Selecciona el texto y cópialo')}><Icono n="copiar" /> Copiar mensaje</button>
            <a class="btn" href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener"><Icono n="enviar" /> WhatsApp</a>
          </div>
          {modo === 'demo' && <p class="mini terciario">En la demo, el código funciona en esta misma pestaña: cambia de cuenta y elige «Activa tu cuenta».</p>}
        </div>
      )}
    </Hoja>
  );
}

// Series pautadas hechas en las 4 últimas semanas acabadas
function Cumple({ c, corto = false }) {
  if (!c || c.series.pct == null) return null;
  const clase = c.series.pct >= 90 ? 'ok' : c.series.pct >= 75 ? '' : 'aviso';
  const detalle = `Series pautadas hechas en las 4 últimas semanas: ${c.series.hechas} de ${c.series.pautadas}`;
  return <div class={`mini cumple num ${clase}`} title={detalle}>{c.series.pct} % {corto ? 'hecho' : 'cumplido'}<span class="sr">. {detalle}</span></div>;
}
