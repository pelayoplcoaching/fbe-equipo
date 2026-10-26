import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { ChipLlegada } from '../atleta/Preparacion.jsx';
import { CumplimientoYBloques } from './Cumplimiento.jsx';
import { Actividad } from './Actividad.jsx';
import { CompararFotos } from '../CompararFotos.jsx';
import { CompararVideos } from '../Archivos.jsx';
import { useUnaVez, Pestanas, useAncho, Siluetas, useApp, useCarga, Icono, ErrorCaja, Hoja, Vacio, Paso, Segmentos, HojaExportar, Avatar } from '../comunes.jsx';
import { EditorBloque, ElegirEjercicio } from './Editor.jsx';
import { textoMarca, REPS_MAX_OBJETIVO } from '../../logica/objetivos.js';
import { Invitacion } from './Panel.jsx';
import { VistaProgreso } from '../atleta/Progreso.jsx';
import { Hilo } from '../Hilo.jsx';
import { Chat } from '../Chat.jsx';
import { Diario } from '../Diario.jsx';
import { cardioHechoValido, textoCardioHecho, NOMBRE_MODALIDAD } from '../../logica/cardio.js';
import { VerArchivo } from '../Archivos.jsx';
import { num, signo, pauta, textoSerie, ESCALAS, NOMBRE_ZONA, ESTADOS_OBJETIVO, NOMBRE_ESTADO_OBJETIVO, etiquetasSuperserie, GRUPOS, rangoVolumen, limpiarObjetivo, VOLUMEN_DEFECTO } from '../../logica/calculos.js';
import { fmtConDia, fmtCorta, hoyISO, lunesDe, sumarDias, rangoSemana, aISO } from '../../logica/fechas.js';
import { HabitosCoach } from './HabitosCoach.jsx';
import { NutricionCoach } from './NutricionCoach.jsx';
import { CuestionarioCoach, CheckinAMedida, ParaProgramar, LoQueUsa } from './CuestionarioCoach.jsx';
import { respuestasDe } from '../../logica/preguntas.js';

const PESTANAS = [['programa', 'Programa'], ['mensajes', 'Mensajes'], ['actividad', 'Actividad'], ['registro', 'Registro'], ['seguimiento', 'Seguimiento'], ['nutricion', 'Nutrición'], ['videos', 'Vídeos y fotos'], ['objetivos', 'Objetivos'], ['notas', 'Notas'], ['datos', 'Datos']];

export function Ficha({ atletaId, alVolver, pestanaInicial = 'programa', alCambiar }) {
  const { api } = useApp();
  const ficha = useCarga(() => api.ficha(atletaId), [atletaId]);
  const [pest, setPest] = useState(pestanaInicial);
  const [invitar, setInvitar] = useState(false);
  const a = ficha.datos?.atleta;

  return (
    <div class="contenido coach">
      <header class="cabecera">
        <button class="btn btn-icono plano" onClick={alVolver} aria-label="Volver a atletas"><Icono n="atras" /></button>
        {a && <Avatar nombre={a.nombre} foto={a.foto} />}
        <div class="titulo">
          <h1>{a?.nombre || 'Atleta'}</h1>
          <div class="sub">{a?.objetivo || (a && !a.perfil_id ? 'Pendiente de activar su cuenta' : '')}</div>
        </div>
        {/* Sin cuenta vinculada (aunque se haya cambiado su estado a mano), siempre se le puede dar un código */}
        {a && !a.perfil_id && a.estado !== 'baja' && <button class="btn btn-primario btn-peq" onClick={() => setInvitar(true)}><Icono n="enviar" /> Código</button>}
      </header>
      <ErrorCaja error={ficha.error} reintentar={ficha.recargar} />
      <Pestanas opciones={PESTANAS} valor={pest} alCambiar={setPest} etiqueta="Secciones de la ficha" />
      {!a ? <Siluetas forma="tarjetas" n={3} texto="Cargando la ficha" /> : (
        <div class="pestana-panel" role="tabpanel" id="pest-panel" aria-labelledby={`pest-${pest}`} key={pest}>
          {pest === 'programa' && <Programa atleta={a} />}
          {pest === 'mensajes' && (
            <section class="seccion chat-en-ficha">
              <h2 class="sr">Mensajes</h2>
              <Chat atletaId={a.id} nombreAtleta={a.nombre} fotoOtro={a.foto} alCambiar={alCambiar} irContexto={(ctx) => setPest(ctx.tipo === 'sesion' ? 'registro' : ctx.tipo === 'checkin' ? 'seguimiento' : 'videos')} />
            </section>
          )}
          {pest === 'actividad' && <Actividad atleta={a} irA={setPest} />}
          {pest === 'registro' && <Registro atleta={a} alCambiar={alCambiar} />}
          {pest === 'seguimiento' && <Seguimiento atleta={a} ficha={ficha.datos} alCambiar={alCambiar} recargarFicha={() => ficha.recargar(true)} />}
          {pest === 'nutricion' && <NutricionCoach atleta={a} />}
          {pest === 'videos' && <Diario atletaId={a.id} nombreAtleta={a.nombre} esCoach alCambiar={alCambiar} />}
          {pest === 'objetivos' && <Objetivos atleta={a} />}
          {pest === 'notas' && <Notas atleta={a} notas={ficha.datos.notas} recargar={() => ficha.recargar(true)} />}
          {pest === 'datos' && <Datos atleta={a} recargar={() => ficha.recargar(true)} alBorrar={alVolver} invitar={() => setInvitar(true)} alCambiar={alCambiar} />}
        </div>
      )}
      {invitar && a && <Invitacion atleta={a} alCerrar={() => setInvitar(false)} />}
    </div>
  );
}

function Programa({ atleta }) {
  const { api } = useApp();
  const bloques = useCarga(() => api.bloquesDe(atleta.id), [atleta.id]);
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
      <ParaProgramar atleta={atleta} />
      <div class="separa" style="flex-wrap:wrap">
        {lista.length > 0 && (
          <select class="selector" style="max-width:420px" aria-label="Bloque" value={bloqueId || ''} onChange={(e) => setBloqueId(e.currentTarget.value)}>
            {lista.map((b) => <option key={b.id} value={b.id}>Bloque {b.numero}: {b.nombre}{['activo', 'ajustado'].includes(b.estado) ? ' (activo)' : b.estado === 'finalizado' ? ' (finalizado)' : ''}</option>)}
          </select>
        )}
        {lista.length > 0 && <button class="btn" onClick={() => setNuevo(true)}><Icono n="mas" /> Nuevo bloque</button>}
      </div>
      {!lista.length ? (
        <div class="panel"><Vacio icono="plantillas" titulo="Sin bloques todavía" accion={<button class="btn btn-primario" onClick={() => setNuevo(true)}>Crear su primer bloque</button>}>
          Crea un bloque desde una plantilla o desde cero. El atleta verá las semanas que publiques.
        </Vacio></div>
      ) : bloqueId && <EditorBloque key={bloqueId} bloqueId={bloqueId} volumenObjetivo={atleta.volumen_objetivo} alBorrar={() => { setBloqueId(null); bloques.recargar(true); }} alCambiarBloque={() => bloques.recargar(true)} />}
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

// Lo registrado frente a lo pautado, sesión a sesión (las más recientes primero)
function Registro({ atleta, alCambiar }) {
  const { api } = useApp();
  const datos = useCarga(async () => {
    const bloques = await api.bloquesDe(atleta.id);
    const activo = bloques.find((b) => ['activo', 'ajustado'].includes(b.estado)) || bloques[0];
    if (!activo) return null;
    const [completo, biblioteca] = await Promise.all([api.bloqueCompleto(activo.id), api.biblioteca()]);
    return { completo, ejercicios: Object.fromEntries(biblioteca.map((e) => [e.id, e])) };
  }, [atleta.id]);
  if (datos.cargando && !datos.datos) return <Siluetas forma="tarjetas" n={3} />;
  if (!datos.datos) return <div class="panel"><Vacio icono="semana" titulo="Sin bloque">Cuando tenga un bloque, aquí verás lo que registra frente a lo pautado.</Vacio></div>;
  const { completo, ejercicios } = datos.datos;
  const sesiones = completo.semanas.slice().reverse().flatMap((w) => (completo.sesiones[w.id] || []).slice().reverse().map((s) => ({ ...s, semana: w })))
    .filter((s) => s.completada || (completo.pautas[s.id] || []).some((p) => completo.series[p.id]?.length));
  if (!sesiones.length) return <div class="panel"><Vacio icono="semana" titulo="Todavía no ha registrado nada en este bloque" /></div>;
  return <ListaRegistro atleta={atleta} sesiones={sesiones} completo={completo} ejercicios={ejercicios} recargar={() => { datos.recargar(true); alCambiar?.(); }} />;
}

// RPE de la serie por encima del pautado (medio punto de margen)
const pasado = (p, h) => {
  if (h.rpe == null) return false;
  const objetivo = p.rpe_objetivo != null ? Number(p.rpe_objetivo) : p.rir_objetivo != null ? 10 - Number(p.rir_objetivo) : null;
  return objetivo != null && Number(h.rpe) > objetivo + 0.5;
};

function ListaRegistro({ atleta, sesiones, completo, ejercicios, recargar }) {
  const { api, aviso } = useApp();
  const [todas, setTodas] = useState(false);
  const [hilo, setHilo] = useState(null);
  const visibles = todas ? sesiones : sesiones.slice(0, 6);
  return (
    <div class="pila">
      {visibles.map((s) => (
        <section class="panel panel-pad pila-s" key={s.id}>
          <div class="separa" style="flex-wrap:wrap">
            <strong>S{s.semana.numero}: {s.nombre}</strong>
            <span class="peq secundario">{s.fecha_realizada ? fmtConDia(s.fecha_realizada) : 'En curso'}{s.rpe_sesion ? `, esfuerzo ${s.rpe_sesion}/10` : ''}{cardioHechoValido(s.cardio_hecho) ? `, ${NOMBRE_MODALIDAD[s.cardio_hecho.modalidad].toLowerCase()}: ${textoCardioHecho(s.cardio_hecho)}` : s.duracion_min ? `, ${s.duracion_min} min` : ''}</span>
          </div>
          {s.preparacion && <ChipLlegada preparacion={s.preparacion} />}
          {s.nota_atleta && <div class="nota-coach"><Icono n="mensaje" /><div>{s.nota_atleta}</div></div>}
          {(completo.pautas[s.id] || []).length > 0 && (
            <div class="tabla-env">
              <table class="tabla-simple tabla-registro">
                <thead><tr><th>Ejercicio</th><th>Pautado</th><th>Hecho</th></tr></thead>
                <tbody>
                  {(completo.pautas[s.id] || []).map((p, _, lista) => {
                    const pa = pauta(p);
                    const etq = etiquetasSuperserie(lista)[p.id];
                    const hechas = completo.series[p.id] || [];
                    const cambios = [...new Set(hechas.map((h) => h.sustituto_id).filter(Boolean))].map((id) => ejercicios[id]?.nombre).filter(Boolean);
                    return (
                      <tr key={p.id}>
                        <td>{etq && <span class="ss-etq">{etq}</span>}{ejercicios[p.ejercicio_id]?.nombre}{cambios.length > 0 && <div class="mini cambio">Hecho como {cambios.join(', ')}</div>}</td>
                        <td class="registro-serie" data-etq="Pautado">{pa.series}{pa.esfuerzo ? `, ${pa.esfuerzo}` : ''}{pa.carga ? `, ${pa.carga}` : ''}</td>
                        <td class="registro-serie" data-etq="Hecho">{hechas.length ? hechas.map((h, i) => (
                          <Fragment key={i}>{i ? ', ' : ''}<span class={(p.reps_min != null && h.reps < p.reps_min) || pasado(p, h) ? 'corto' : ''}>{textoSerie(h)}</span></Fragment>
                        )) : <span class="terciario">—</span>}
                          {hechas.length > 0 && hechas.length < p.series && <span class="corto"> ({hechas.length}/{p.series})</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div class="fila-envolver">
            <button class="btn btn-peq" aria-expanded={hilo === s.id ? 'true' : 'false'} onClick={() => setHilo(hilo === s.id ? null : s.id)}><Icono n="mensaje" /> Comentarios</button>
            {s.completada && (s.revisada_en
              ? <span class="chip ok"><Icono n="hecho" />Revisada</span>
              : <button class="btn btn-peq" onClick={async () => { try { await api.marcarRevisado('sesion', s.id); aviso('Sesión revisada'); recargar(); } catch (e) { aviso(e.message, 'error'); } }}><Icono n="hecho" /> Marcar revisada</button>)}
          </div>
          {hilo === s.id && <Hilo atletaId={atleta.id} sesionId={s.id} nombreAtleta={atleta.nombre} alCambiar={recargar} vacio="Sin comentarios en esta sesión." />}
        </section>
      ))}
      {!todas && sesiones.length > 6 && <button class="btn" onClick={() => setTodas(true)}>Ver las {sesiones.length - 6} sesiones anteriores</button>}
      <p class="mini terciario">En naranja, las series por debajo del rango de repeticiones, por encima del esfuerzo pautado o los ejercicios con menos series de las pautadas.</p>
    </div>
  );
}

// Carga de entrenamiento semanal: RPE de la sesión × minutos (Foster y cols., 2001)
function CargaEntreno({ atletaId }) {
  const { api } = useApp();
  const c = useCarga(() => api.carga(atletaId).catch(() => null), [atletaId]);
  const [W, ref] = useAncho();
  if (!c.datos) return null;
  const { semanas, cambio } = c.datos;
  const hay = semanas.some((w) => w.carga > 0);
  const H = 170, izq = 8, der = 8, arr = 18, abj = 22;
  const max = Math.max(1, ...semanas.map((w) => w.carga), cambio?.media || 0);
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
            aria-label={`Carga semanal de las últimas ${semanas.length} semanas${cambio ? `; la semana pasada, ${cambio.carga} UA, ${num(cambio.ratio)} veces su media de ${cambio.media}` : ''}`}>
            {semanas.map((w, i) => {
              const x = izq + i * ancho + ancho * 0.18, bw = ancho * 0.64;
              return (
                <g key={w.lunes}>
                  {w.carga > 0 && <rect class={`barra ${w.enCurso ? 'en-curso' : ''} ${w.lunes === cambio?.semana ? 'ultima' : ''}`} x={x} y={Y(w.carga)} width={bw} height={H - abj - Y(w.carga)} rx="4" />}
                  {w.carga > 0 && <text class="valor-barra" x={x + bw / 2} y={Y(w.carga) - 5} text-anchor="middle">{w.carga}</text>}
                  {(i % 2 === 1 || i === semanas.length - 1) && <text x={x + bw / 2} y={H - 5} text-anchor="middle">{fmtCorta(w.lunes)}</text>}
                </g>
              );
            })}
            {cambio && <line class="media" x1={izq} x2={W - der} y1={Y(cambio.media)} y2={Y(cambio.media)} stroke-dasharray="5 4" />}
          </svg>
        )}
        <p class="mini terciario">RPE de cada sesión (1 a 10) por sus minutos, sumado por semana (Foster y cols., 2001), en unidades arbitrarias. La línea es la media de las cuatro semanas anteriores a la última completa; la semana en curso va en claro. Sirve para ver saltos bruscos, no para predecir lesiones.</p>
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
          ? `Rangos propios en ${propios.map((g) => GRUPOS.find(([x]) => x === g)?.[1].toLowerCase()).filter(Boolean).join(', ')}; el resto, ${VOLUMEN_DEFECTO[0]} a ${VOLUMEN_DEFECTO[1]} series semanales.`
          : `Rango general: de ${VOLUMEN_DEFECTO[0]} a ${VOLUMEN_DEFECTO[1]} series semanales por músculo.`}</p>
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

function Seguimiento({ atleta, ficha, alCambiar, recargarFicha }) {
  const { api, aviso } = useApp();
  const [versionVol, setVersionVol] = useState(0);
  const { molestias } = ficha;
  const checkins = useCarga(() => api.ficha(atleta.id).then((f) => f.checkins), [atleta.id]);
  const preguntas = useCarga(() => api.preguntasCheckin(atleta.id, { archivadas: true }).catch(() => []), [atleta.id]);
  const [abierto, setAbierto] = useState(null);
  const lista = checkins.datos || ficha.checkins;
  const respuestasAbierto = abierto ? respuestasDe(abierto, Object.fromEntries((preguntas.datos || []).map((p) => [p.id, p]))) : [];
  const media = (c) => { const v = [c.adherencia_desayuno, c.adherencia_comida, c.adherencia_merienda, c.adherencia_cena].filter(Boolean); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const porSemana = molestias.reduce((m, x) => ((m[x.semana_inicio] ||= []).push(x), m), {});
  const recargar = () => { checkins.recargar(true); alCambiar?.(); };
  return (
    <div class="pila">
      <CumplimientoYBloques atletaId={atleta.id} />
      <HabitosCoach atleta={atleta} />
      <VistaProgreso key={versionVol} atletaId={atleta.id} esCoach />
      <CargaEntreno atletaId={atleta.id} />
      <VolumenObjetivo atleta={atleta} alGuardar={() => { setVersionVol((v) => v + 1); recargarFicha?.(); }} />
      <CheckinAMedida atleta={atleta} preguntas={preguntas} checkins={lista} recargarFicha={recargarFicha} />
      <section class="seccion">
        <h2>Check-ins</h2>
        {!lista.length ? <div class="panel"><Vacio icono="checkin" titulo="Sin check-ins todavía" /></div> : (
          <div class="panel"><div class="tabla-env">
            <table class="tabla-simple tabla-clic">
              <thead><tr><th>Semana</th><th>Sueño</th><th>Energía</th><th>Recup.</th><th>Motivación</th><th>Adherencia</th><th>Pasos</th><th>Molestias</th><th><span class="sr">Estado</span></th></tr></thead>
              <tbody>
                {lista.map((c) => {
                  const m = media(c);
                  const mol = (porSemana[c.semana_inicio] || []).filter((x) => x.intensidad > 0);
                  return (
                    <tr key={c.id} tabIndex={0} onClick={() => setAbierto(c)} onKeyDown={(e) => { if (e.key === 'Enter') setAbierto(c); }}>
                      <td>{rangoSemana(c.semana_inicio)}</td>
                      <td>{c.horas_sueno ? `${c.horas_sueno.replace('-', '–')} h` : '—'}</td>
                      <td>{c.energia ?? '—'}</td>
                      <td>{c.recuperacion ?? '—'}</td>
                      <td>{c.motivacion ? ESCALAS.motivacion[c.motivacion - 1] : '—'}</td>
                      <td>{m ? ESCALAS.adherencia[Math.round(m) - 1] : '—'}</td>
                      <td>{c.pasos_media ? num(c.pasos_media, 0) : '—'}</td>
                      <td>{mol.length ? mol.map((x) => `${NOMBRE_ZONA[x.zona]} ${x.intensidad}`).join(', ') : '—'}</td>
                      <td>{c.revisado_en ? <Icono n="hecho" width="18" height="18" titulo="Revisado" /> : <span class="chip morado">Pendiente</span>}</td>
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
        <p class="mini terciario">Energía y recuperación de 1 (peor) a 5 (mejor). Molestias de 0 a 3. Toca una semana para comentarla.</p>
      </section>
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
      <div class="separa"><p class="peq secundario">Los objetivos los ve el atleta en su progreso, con la barra y los días que quedan.</p><button class="btn btn-primario btn-peq" onClick={() => setEditar({})}><Icono n="mas" /> Nuevo objetivo</button></div>
      {!(lista.datos || []).length ? <div class="panel"><Vacio icono="diana" titulo="Sin objetivos">Por ejemplo: «Press banca 70 kg a una repetición» para el final del bloque.</Vacio></div> : (
        <div class="panel"><ul class="lista">
          {lista.datos.map((o) => (
            <li key={o.id}>
              <button class="respuesta" onClick={() => setEditar(o)}>
                <span><span class="nombre">{o.titulo}</span><br /><span class="detalle">{o.auto?.conseguido ? `Conseguido el ${fmtCorta(o.auto.conseguido.fecha)}` : NOMBRE_ESTADO_OBJETIVO[o.estado]}, {o.auto ? o.auto.pct : o.progreso_pct} %{o.auto ? ' (automático)' : ''}{o.fecha_limite ? `, para el ${fmtCorta(o.fecha_limite)}` : ''}</span></span>
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
  const [f, setF] = useState({
    titulo: objetivo.titulo || '', descripcion: objetivo.descripcion || '', fecha_limite: objetivo.fecha_limite || '', progreso_pct: objetivo.progreso_pct ?? 0, estado: objetivo.estado || 'en_curso',
    tipo: objetivo.ejercicio_id ? 'marca' : nuevo ? 'marca' : 'manual',
    ejercicio_id: objetivo.ejercicio_id || null, ejercicio: objetivo.ejercicio || null, kg: objetivo.kg_objetivo != null ? Number(objetivo.kg_objetivo) : null, reps: objetivo.reps_objetivo ?? 1,
  });
  const [elegir, setElegir] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const marca = f.tipo === 'marca';
  const sugerido = marca && f.ejercicio && f.kg ? `${f.ejercicio} ${textoMarca(f.kg, f.reps)}` : '';
  const valido = (f.titulo.trim() || sugerido) && (!marca || (f.ejercicio_id && f.kg > 0 && f.reps >= 1 && f.reps <= REPS_MAX_OBJETIVO));
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
    } else Object.assign(fila, { ejercicio_id: null, kg_objetivo: null, reps_objetivo: null, e1rm_inicio: null, progreso_pct: Math.round(f.progreso_pct || 0) });
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
          opciones={[['marca', 'Marca en un ejercicio'], ['manual', 'Otro (lo marcas tú)']]} />
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
        <div class="campo"><label for="ob-titulo">Objetivo</label><input id="ob-titulo" class="entrada" required={!sugerido} value={f.titulo} onInput={(e) => setF({ ...f, titulo: e.currentTarget.value })} placeholder={sugerido || 'Sentadilla 100 kg × 3'} /></div>
        <div class="campo"><label for="ob-desc">Detalle (opcional)</label><input id="ob-desc" class="entrada" value={f.descripcion} onInput={(e) => setF({ ...f, descripcion: e.currentTarget.value })} /></div>
        <div class="rejilla-campos">
          <div class="campo"><label for="ob-fecha">Para el</label><input id="ob-fecha" type="date" class="entrada" value={f.fecha_limite} onInput={(e) => setF({ ...f, fecha_limite: e.currentTarget.value })} /></div>
          {!marca && <div class="campo"><label for="ob-pct">Progreso (%)</label><Paso id="ob-pct" valor={f.progreso_pct} paso={10} min={0} max={100} dec={0} etiqueta="porcentaje de progreso" alCambiar={(v) => setF({ ...f, progreso_pct: v ?? 0 })} /></div>}
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

function Notas({ atleta, notas, recargar }) {
  const { api, aviso } = useApp();
  const [texto, setTexto] = useState('');
  const [ocupado, una] = useUnaVez();
  return (
    <div class="pila">
      <form class="panel panel-pad pila" onSubmit={(e) => {
        e.preventDefault();
        if (!texto.trim()) return;
        una(async () => { try { await api.crearNota(atleta.id, texto.trim()); setTexto(''); recargar(); } catch (err) { aviso(err.message, 'error'); } });
      }}>
        <div class="campo"><label for="nota-nueva">Nota privada</label>
          <textarea id="nota-nueva" class="area" value={texto} onInput={(e) => setTexto(e.currentTarget.value)} placeholder="Solo la ves tú. El atleta no sabe que existe." /></div>
        <button class="btn btn-primario" disabled={!texto.trim() || ocupado}>Guardar nota</button>
      </form>
      {notas.map((n) => (
        <div class="panel panel-pad pila-s" key={n.id}>
          <div class="separa"><span class="peq terciario">{fmtCorta(aISO(new Date(n.creado_en)))}</span>
            <button class="btn btn-icono plano btn-peligro" aria-label="Borrar nota" onClick={async () => { await api.borrarNota(n.id); recargar(); }}><Icono n="basura" /></button></div>
          <p style="white-space:pre-line">{n.texto}</p>
        </div>
      ))}
    </div>
  );
}

function Datos({ atleta, recargar, alBorrar, invitar, alCambiar }) {
  const { api, aviso } = useApp();
  const [f, setF] = useState({ nombre: atleta.nombre, email: atleta.email || '', objetivo: atleta.objetivo || '', notion_url: atleta.notion_url || '', estado: atleta.estado, progresion_auto: atleta.progresion_auto !== false });
  const [borrar, setBorrar] = useState(false);
  const [confirmacion, setConfirmacion] = useState('');
  const [exportado, setExportado] = useState(null);
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const fecha = hoyISO();
  const base = atleta.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
  return (
    <div class="pila">
      <CuestionarioCoach atleta={atleta} alCambiar={alCambiar} />
      <LoQueUsa atleta={atleta} />
      <form class="panel panel-pad pila" onSubmit={async (e) => {
        e.preventDefault();
        try {
          // El estado solo se envía si se ha cambiado aquí (si el atleta activó su cuenta mientras tanto, no se pisa)
          await api.actualizarAtleta(atleta.id, { nombre: f.nombre.trim(), email: f.email.trim() || null, objetivo: f.objetivo.trim() || null, notion_url: f.notion_url.trim() || null, ...(f.estado !== atleta.estado ? { estado: f.estado } : {}), progresion_auto: f.progresion_auto });
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
        <div class="campo"><label for="d-obj">Objetivo</label><input id="d-obj" class="entrada" value={f.objetivo} onInput={cambiar('objetivo')} /></div>
        <div class="campo"><label for="d-notion">Página de Notion</label><input id="d-notion" class="entrada" type="url" value={f.notion_url} onInput={cambiar('notion_url')} /></div>
        <label class="casilla"><input type="checkbox" checked={f.progresion_auto} onChange={(e) => setF({ ...f, progresion_auto: e.currentTarget.checked })} />
          <span>Sugerirle subir carga cuando llegue al tope del rango (doble progresión)<br /><span class="peq terciario">Si lo quitas, la app solo le propone lo pautado y lo de la última vez.</span></span></label>
        <button class="btn btn-primario">Guardar</button>
      </form>
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
              <button class="btn btn-peligro" disabled={confirmacion.trim() !== atleta.nombre} onClick={async () => { await api.borrarAtleta(atleta.id); aviso('Atleta borrado'); alBorrar(); }}>Borrar definitivamente</button>
            </div>
          </div>
        )}
      </div>
      {exportado && <HojaExportar titulo="Exportar" {...exportado} alCerrar={() => setExportado(null)} />}
    </div>
  );
}
