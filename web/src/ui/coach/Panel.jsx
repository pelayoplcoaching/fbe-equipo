import { useEffect, useState } from 'preact/hooks';
import { HojaAvisos } from '../Avisos.jsx';
import { useUnaVez, Siluetas, useApp, useCarga, Icono, Cargando, ErrorCaja, Hoja, Vacio, copiar, Avatar, Segmentos } from '../comunes.jsx';
import { NIVELES, AYUDA_NIVEL, SERVICIOS, CAMPOS_SERVICIO } from '../../logica/nivel.js';
import { BandaDemo } from '../App.jsx';
import { num, signo, NOMBRE_FOCO, ESCALAS } from '../../logica/calculos.js';
import { hace, fmtCorta } from '../../logica/fechas.js';
import { fmtEuros } from '../../logica/cobros.js';

function Pips({ hechas, total }) {
  if (!total) return <span class="terciario">—</span>;
  return <span class="pips" role="img" aria-label={`${hechas} de ${total} sesiones`}>{Array.from({ length: total }, (_, i) => <i key={i} class={i < hechas ? 'hecha' : ''} />)}</span>;
}

function Alertas({ r, pendientes }) {
  if (!r.alertas.length && !pendientes) return null;
  return (
    <div class="alertas">
      {pendientes > 0 && <span class="chip morado"><Icono n="bandeja" />{pendientes} por revisar</span>}
      {r.alertas.map((a) => <span key={a.tipo} class={`chip ${a.nivel}`}>{a.nivel !== 'info' && <Icono n="alerta" />}{a.texto}</span>)}
    </div>
  );
}

const sueno = (h) => (h ? `${h.replace('-', '–')} h` : '—');
const MOLESTIA = ['Sin dolor', 'Leve', 'Moderada', 'Grave'];

export function Panel({ abrir, pendientes = {}, peticion = null, alBuscar, abrirCuenta }) {
  const { api, perfil } = useApp();
  const res = useCarga(() => api.resumenes(), []);
  const [filtro, setFiltro] = useState('todos');
  const [nuevo, setNuevo] = useState(false);
  const [avisos, setAvisos] = useState(false);
  useEffect(() => { if (peticion?.nuevo) setNuevo(true); if (peticion?.avisos) setAvisos(true); }, [peticion?.id]);
  const lista = res.datos || [];
  const atencion = lista.filter((r) => r.alertas.some((a) => a.nivel !== 'info'));
  const invitados = lista.filter((r) => r.estado === 'invitado');
  const deBaja = lista.filter((r) => r.estado === 'baja');
  // Columna de pagos solo si hay alguno apuntado (v0.25)
  const vista = filtro === 'atencion' ? atencion : filtro === 'invitados' ? invitados : filtro === 'baja' ? deBaja : lista.filter((r) => r.estado !== 'baja');
  const conCobros = lista.some((r) => r.cobro);

  return (
    <div class="contenido coach">
      <header class="cabecera">
        <div class="titulo"><h1>Atletas</h1><div class="sub">{lista.filter((r) => r.estado === 'activo').length} activos{atencion.length ? `, ${atencion.length} necesitan atención` : ''}</div></div>
        <div class="fila" style="gap:8px">
          {alBuscar && <button class="btn btn-icono solo-estrecho" onClick={alBuscar} aria-label="Buscar"><Icono n="buscar" /></button>}
          <button class="btn" onClick={() => setAvisos(true)} aria-label="Avisos para tus atletas"><Icono n="altavoz" /><span class="solo-ancho">Avisos</span></button>
          <button class="btn btn-primario" onClick={() => setNuevo(true)}><Icono n="mas" /><span class="solo-ancho">Añadir atleta</span><span class="sr">Añadir atleta</span></button>
          {abrirCuenta && <button class="btn-avatar solo-estrecho" onClick={abrirCuenta} aria-label="Tu cuenta"><Avatar foto={perfil?.foto} nombre={perfil?.nombre || 'Coach'} /></button>}
        </div>
      </header>
      <BandaDemo />
      <ErrorCaja error={res.error} reintentar={res.recargar} />
      <div class="selector-chips" role="group" aria-label="Filtrar atletas">
        <button aria-pressed={filtro === 'todos' ? 'true' : 'false'} onClick={() => setFiltro('todos')}>Todos</button>
        <button aria-pressed={filtro === 'atencion' ? 'true' : 'false'} onClick={() => setFiltro('atencion')}>Necesitan atención ({atencion.length})</button>
        {invitados.length > 0 && <button aria-pressed={filtro === 'invitados' ? 'true' : 'false'} onClick={() => setFiltro('invitados')}>Sin activar ({invitados.length})</button>}
        {deBaja.length > 0 && <button aria-pressed={filtro === 'baja' ? 'true' : 'false'} onClick={() => setFiltro('baja')}>De baja ({deBaja.length})</button>}
      </div>

      {res.cargando && !res.datos ? <Siluetas forma="lista" n={4} texto="Cargando tus atletas" /> : !vista.length ? (
        <div class="panel"><Vacio icono="atletas" titulo={lista.length ? 'Nadie en esta lista' : 'Aún no hay atletas'}
          accion={!lista.length && <button class="btn btn-primario" onClick={() => setNuevo(true)}>Añadir el primero</button>}>
          {lista.length ? 'Todo en orden por aquí.' : 'Dales de alta y envíales su código de invitación.'}
        </Vacio></div>
      ) : (
        <>
          <div class="panel solo-ancho">
            <div class="tabla-env">
              <table class="atletas-tabla">
                <thead><tr><th>Atleta</th>{conCobros && <th>Pagos</th>}<th>Semana</th><th>Sesiones</th><th>Peso</th><th>Sueño</th><th>Motivación</th><th>Molestias</th><th>Último registro</th></tr></thead>
                <tbody>
                  {vista.map((r) => (
                    <tr key={r.atleta_id} onClick={() => abrir(r.atleta_id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') abrir(r.atleta_id); }}>
                      <td><div class="nombre"><Avatar nombre={r.nombre} foto={r.foto} /><span>{r.nombre}</span></div><Alertas r={r} pendientes={pendientes[r.atleta_id]} /></td>
                      {conCobros && <td><CobroPanel c={r.cobro} /></td>}
                      {r.servicio === 'nutricion' ? (
                        <td colSpan={2}><span class="chip morado">Solo nutrición</span>{r.diasNutricion != null && <div class="mini terciario">{r.diasNutricion}/7 días apuntados</div>}</td>
                      ) : (
                        <>
                          <td class="num-c">{r.semana ? <>S{r.semana.numero}/{r.semana.total}<div class="mini terciario">{r.semana.foco ? NOMBRE_FOCO[r.semana.foco] : r.bloque?.nombre}</div></> : '—'}</td>
                          <td><Pips hechas={r.sesiones.completadas} total={r.sesiones.total} /><Cumple c={r.cumplimiento} /></td>
                        </>
                      )}
                      <td class="num-c">{r.peso ? <>{num(r.peso.kg)} kg{r.peso.ritmo ? <div class="mini terciario">{signo(r.peso.ritmo.kgSemana, 2)}/sem</div> : r.peso.cambio != null && <div class="mini terciario">{signo(r.peso.cambio)}</div>}</> : '—'}</td>
                      <td class="num-c">{sueno(r.checkin?.horas_sueno)}</td>
                      <td>{r.checkin?.motivacion ? ESCALAS.motivacion[r.checkin.motivacion - 1] : '—'}</td>
                      <td>{r.maxMolestia ? <span class={`chip ${r.maxMolestia >= 2 ? 'aviso' : 'info'}`}>{MOLESTIA[r.maxMolestia]}</span> : <span class="terciario">—</span>}</td>
                      <td class="num-c">{r.ultimaSerie ? hace(r.ultimaSerie) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div class="pila solo-estrecho">
            {vista.map((r) => (
              <button class="tarjeta-atleta" key={r.atleta_id} onClick={() => abrir(r.atleta_id)}>
                <div class="cab">
                  <Avatar nombre={r.nombre} foto={r.foto} />
                  <span><strong>{r.nombre}</strong>{r.servicio === 'nutricion' && r.estado === 'activo' ? <span class="mini terciario">Solo nutrición</span> : r.semana ? <span class="mini terciario">Semana {r.semana.numero} de {r.semana.total}{r.semana.foco ? `, ${NOMBRE_FOCO[r.semana.foco].toLowerCase()}` : r.bloque?.nombre ? `, ${r.bloque.nombre}` : ''}</span> : r.estado === 'invitado' ? <span class="mini terciario">Sin activar</span> : r.estado === 'baja' ? <span class="mini terciario">De baja</span> : null}</span>
                  {r.semana && <span class="peq secundario num">S{r.semana.numero}/{r.semana.total}</span>}
                </div>
                <Alertas r={r} pendientes={pendientes[r.atleta_id]} />
                {r.estado === 'activo' && (
                  <div class="datos">
                    {r.servicio === 'nutricion'
                      ? <div><div class="k">Nutrición</div><div class="v">{r.diasNutricion != null ? `${r.diasNutricion}/7 días` : '—'}</div></div>
                      : <div><div class="k">Sesiones</div><div class="v"><Pips hechas={r.sesiones.completadas} total={r.sesiones.total} /><Cumple c={r.cumplimiento} corto /></div></div>}
                    <div><div class="k">Peso</div><div class="v">{r.peso ? `${num(r.peso.kg)}${r.peso.ritmo ? ` (${signo(r.peso.ritmo.kgSemana, 2)}/sem)` : r.peso.cambio != null ? ` (${signo(r.peso.cambio)})` : ''}` : '—'}</div></div>
                    {r.servicio !== 'nutricion' && <div><div class="k">Último registro</div><div class="v">{r.ultimaSerie ? hace(r.ultimaSerie) : '—'}</div></div>}
                  </div>
                )}
                {r.cobro && <div class="cobro-tarjeta"><span class="k">Pagos</span><CobroPanel c={r.cobro} enLinea /></div>}
              </button>
            ))}
          </div>
        </>
      )}
      {avisos && <HojaAvisos alCerrar={() => setAvisos(false)} />}
      {nuevo && <NuevoAtleta alCerrar={(id) => { setNuevo(false); res.recargar(true); if (id) abrir(id); }} />}
    </div>
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
  const codigo = useCarga(() => api.crearInvitacion(atleta.id), [atleta.id]);
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
