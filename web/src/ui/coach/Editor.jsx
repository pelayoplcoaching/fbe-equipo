import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Siluetas, useApp, useCarga, Icono, Disco, Cargando, ErrorCaja, Hoja, Paso, Segmentos } from '../comunes.jsx';
import { FOCOS, INTENCIONES, PRIORIDADES, NOMBRE_GRUPO, GRUPOS, TIPOS_SESION, LETRAS_SUPERSERIE, etiquetasSuperserie, seriesPautadasPorGrupo, rangoVolumen, estadoVolumen, num, mmss } from '../../logica/calculos.js';
import { rangoSemana, lunesDe, fmtCorta, fmtConDia, sumarDias } from '../../logica/fechas.js';
import { sugerirCargas } from '../../logica/sugerencias.js';
import { leerTempo, explicarTempo } from '../../logica/tempo.js';
import { NOMBRE_NIVEL, AYUDA_NIVEL, modoCarga, columnasEditor } from '../../logica/nivel.js';
import { progresarPauta } from '../../logica/progresion.js';
import { MODALIDADES, limpiarCardio, textoCardio, palabrasEsfuerzo } from '../../logica/cardio.js';

const DESCANSOS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
const ESTADOS_BLOQUE = [['planificado', 'Planificado'], ['activo', 'Activo'], ['ajustado', 'Ajustado'], ['finalizado', 'Finalizado'], ['cancelado', 'Cancelado']];
const ESTADO_SEMANA = { programada: 'Publicada', en_programacion: 'Borrador', no_iniciada: 'Sin empezar' };
const normal = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const nulo = (v) => (v === '' || v === undefined ? null : v);

// Editor de un bloque (de un atleta o plantilla): semanas, sesiones y prescripción, con guardado al salir de cada campo.
export function EditorBloque({ bloqueId, alBorrar, alCrearPlantilla, alCambiarBloque, volumenObjetivo = null, nivel = null }) {
  const { api, aviso } = useApp();
  const carga = useCarga(() => api.bloqueCompleto(bloqueId), [bloqueId]);
  const biblioteca = useCarga(() => api.biblioteca(), []);
  const [d, setD] = useState(null);
  const [semanaId, setSemanaId] = useState(null);
  const [estado, setEstado] = useState('');
  const [duplicar, setDuplicar] = useState(false);
  const [elegir, setElegir] = useState(null); // { sesionId, pautaId? }
  const [confirmarBorrado, setConfirmarBorrado] = useState(null);
  const [sugerir, setSugerir] = useState(false);
  const [version, setVersion] = useState(0); // cambia al aplicar cambios en bloque, para refrescar los campos
  const [publicarEn, setPublicarEn] = useState(null); // semana a publicar en un bloque que aún no es el activo

  useEffect(() => {
    if (!carga.datos) return;
    setD(carga.datos);
    if (!semanaId || !carga.datos.semanas.some((s) => s.id === semanaId)) {
      const sem = carga.datos.semanas;
      const borrador = sem.find((s) => s.programacion !== 'programada');
      setSemanaId((borrador || sem[sem.length - 1] || {}).id || null);
    }
  }, [carga.datos]);

  const ejercicios = useMemo(() => Object.fromEntries((biblioteca.datos || []).map((e) => [e.id, e])), [biblioteca.datos]);
  // Lo que hizo el atleta la última vez en cada ejercicio de esta semana (antes de ella: en la semana anterior o en
  // otro bloque), para pautar la siguiente con sus kilos y RPE a la vista
  const atletaId = d && !d.bloque.es_plantilla ? d.bloque.atleta_id : null;
  const sesionesSemana = d && semanaId ? d.sesiones[semanaId] || [] : [];
  // Hasta el final de la semana que se mira (para no enseñar como «última vez» algo de semanas posteriores)
  const fechaSemana = d && semanaId ? d.semanas.find((w) => w.id === semanaId)?.fecha_inicio : null;
  const finSemana = fechaSemana ? `${sumarDias(fechaSemana, 7)}T00:00:00` : null;
  const idsSemana = [...new Set(sesionesSemana.flatMap((x) => (d.pautas[x.id] || []).map((p) => p.ejercicio_id)))].filter(Boolean).sort();
  const ultimas = useCarga(() => (atletaId && idsSemana.length ? api.ultimasPorEjercicio(atletaId, idsSemana, sesionesSemana.map((x) => x.id), finSemana).catch(() => ({})) : Promise.resolve({})),
    [atletaId, semanaId, idsSemana.join(',')]);

  if (carga.cargando && !d) return <Siluetas forma="tarjetas" n={3} texto="Cargando el bloque" />;
  if (carga.error) return <ErrorCaja error={carga.error} reintentar={carga.recargar} />;
  if (!d) return null;
  const { bloque } = d;
  const semana = d.semanas.find((s) => s.id === semanaId);
  const sesiones = semana ? d.sesiones[semana.id] || [] : [];
  // La semana anterior del bloque y si tiene algo registrado (para las cargas sugeridas)
  const anterior = semana ? d.semanas.find((w) => w.numero === semana.numero - 1) : null;
  const sesionesAnt = anterior ? d.sesiones[anterior.id] || [] : [];
  // Con nivel, las cargas sugeridas son para lo que se pauta con kg (los de RPE los carga el atleta, salvo que les pongas kg)
  const conKg = (p) => bloque.es_plantilla || modoCarga(nivel, p.prioridad) !== 'rpe' || p.carga_sugerida_kg != null;
  const conDatos = !bloque.es_plantilla && sesionesAnt.some((x) => (d.pautas[x.id] || []).some((p) => (d.series[p.id] || []).length))
    && sesiones.some((x) => (d.pautas[x.id] || []).some(conKg));

  // Guarda un campo y lo refleja en local sin recargar (los inputs no pierden el foco)
  async function guardar(tabla, id, cambios) {
    setEstado('Guardando…');
    try {
      await api.actualizar(tabla, id, cambios);
      setD((x) => parchear(x, tabla, id, cambios));
      setEstado('Guardado');
      if (tabla === 'bloques') alCambiarBloque?.(); // el nombre o el estado salen en el selector de bloques
    } catch (e) {
      // Si la base no lo acepta, los campos vuelven a lo que hay guardado (no se queda a la vista un valor que no vale)
      setEstado(''); aviso(e.message, 'error'); setVersion((v) => v + 1);
    }
  }
  // Cambios de estructura (semanas, sesiones, publicar…): uno cada vez; un doble toque no duplica nada
  const enCurso = useRef(false);
  async function estructura(fn, mensaje) {
    if (enCurso.current) return null;
    enCurso.current = true;
    setEstado('Guardando…');
    try { const r = await fn(); await carga.recargar(true); setEstado('Guardado'); if (mensaje) aviso(mensaje); alCambiarBloque?.(); return r; } catch (e) { setEstado(''); aviso(e.message, 'error'); return null; }
    finally { enCurso.current = false; }
  }

  return (
    <div class="pila">
      <div class="panel panel-pad pila">
        <div class="separa">
          <strong>{bloque.es_plantilla ? 'Plantilla' : `Bloque ${bloque.numero ?? ''}`}</strong>
          <span class={`guardado ${estado === 'Guardado' ? 'ok' : ''}`} role="status">{estado === 'Guardado' && <Icono n="hecho" width="16" height="16" />}{estado}</span>
        </div>
        <div class="rejilla-campos">
          <div class="campo"><label for={`b-nombre-${bloque.id}`}>Nombre</label>
            <input id={`b-nombre-${bloque.id}`} class="entrada" defaultValue={bloque.nombre} onChange={(e) => guardar('bloques', bloque.id, { nombre: e.currentTarget.value.trim() || bloque.nombre })} /></div>
          <div class="campo"><label for={`b-foco-${bloque.id}`}>Foco</label>
            <select id={`b-foco-${bloque.id}`} class="selector" value={bloque.foco || ''} onChange={(e) => guardar('bloques', bloque.id, { foco: nulo(e.currentTarget.value) })}>
              <option value="">Sin foco</option>{FOCOS.filter(([f]) => !['evaluacion', 'peaking'].includes(f)).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select></div>
          {!bloque.es_plantilla && (
            <>
              <div class="campo"><label for={`b-ini-${bloque.id}`}>Empieza el lunes</label>
                <input id={`b-ini-${bloque.id}`} class="entrada" type="date" key={bloque.fecha_inicio} defaultValue={bloque.fecha_inicio || ''} onChange={(e) => {
                  const v = nulo(e.currentTarget.value);
                  const lunes = v ? lunesDe(v) : null;
                  estructura(() => api.cambiarInicioBloque(bloque.id, v), lunes && lunes !== v ? `Las semanas van de lunes a domingo: empieza el lunes ${fmtCorta(lunes)} y sus semanas se han movido con él` : 'Fechas del bloque y de sus semanas actualizadas');
                }} /></div>
              <div class="campo"><label for={`b-est-${bloque.id}`}>Estado</label>
                <select id={`b-est-${bloque.id}`} class="selector" value={bloque.estado} onChange={async (e) => {
                  const v = e.currentTarget.value;
                  if (v === 'activo') await estructura(() => api.activarBloque(bloque.id, bloque.atleta_id), 'Bloque activo: es el que ve el atleta');
                  else guardar('bloques', bloque.id, { estado: v });
                }}>{ESTADOS_BLOQUE.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
            </>
          )}
        </div>
        <div class="campo"><label for={`b-obj-${bloque.id}`}>Objetivo del bloque</label>
          <input id={`b-obj-${bloque.id}`} class="entrada" defaultValue={bloque.objetivo || ''} placeholder="Lo verá el atleta en su programa" onChange={(e) => guardar('bloques', bloque.id, { objetivo: nulo(e.currentTarget.value.trim()) })} /></div>
        <div class="fila-envolver">
          {!bloque.es_plantilla && <button class="btn btn-peq" onClick={async () => { const p = await estructura(() => api.copiarBloque(bloque.id, { nombre: bloque.nombre }), 'Guardado como plantilla'); if (p) alCrearPlantilla?.(p); }}><Icono n="plantillas" /> Guardar como plantilla</button>}
          <button class="btn btn-peq btn-peligro" onClick={() => setConfirmarBorrado({ tipo: 'bloque' })}><Icono n="basura" /> Borrar {bloque.es_plantilla ? 'plantilla' : 'bloque'}</button>
        </div>
      </div>

      <div class="separa">
        <div class="semanas-tabs" role="group" aria-label="Semanas">
          {d.semanas.map((s) => (
            <button key={s.id} class={s.programacion === 'programada' ? 'programada' : ''} aria-pressed={s.id === semanaId ? 'true' : 'false'} onClick={() => setSemanaId(s.id)}>
              S{s.numero}<span class="est">{bloque.es_plantilla ? `${(d.sesiones[s.id] || []).length} días` : ESTADO_SEMANA[s.programacion]}</span>
            </button>
          ))}
          <button onClick={async () => { const s = await estructura(() => api.nuevaSemana(bloque.id)); if (s) setSemanaId(s.id); }} aria-label="Añadir semana vacía"><Icono n="mas" width="18" height="18" /><span class="est">Vacía</span></button>
        </div>
      </div>
      {d.semanas.some((s, i) => s.numero !== i + 1) && (
        <div class="aviso-semanas separa">
          <span class="peq secundario">Las semanas no van seguidas (empiezan en la {d.semanas[0].numero} o falta alguna).</span>
          <button class="btn btn-peq" onClick={() => estructura(() => api.renumerarSemanas(bloque.id), bloque.fecha_inicio ? 'Semanas renumeradas desde la 1, una por semana desde el inicio del bloque' : 'Semanas renumeradas desde la 1')}>Renumerar desde la 1</button>
        </div>
      )}

      {semana && (
        <div class="panel panel-pad pila" key={semana.id}>
          <div class="separa" style="flex-wrap:wrap">
            <div>
              <strong style="font-size:18px">Semana {semana.numero}</strong>
              {semana.fecha_inicio && <span class="secundario peq">{'  '}{rangoSemana(semana.fecha_inicio)}</span>}
            </div>
            <div class="fila-envolver">
              {!bloque.es_plantilla && (semana.programacion === 'programada'
                ? <button class="btn btn-peq" onClick={() => {
                  // Con series ya registradas, retirarla le escondería al atleta esos entrenamientos (y su historial)
                  const conSeries = sesiones.some((x) => (d.pautas[x.id] || []).some((p) => (d.series[p.id] || []).length));
                  if (conSeries) { aviso('Esta semana ya tiene series registradas: si la retiras, el atleta dejaría de ver esos entrenamientos. Edítala sin retirarla.', 'error'); return; }
                  estructura(() => api.publicarSemana(semana.id, false), 'Semana retirada: el atleta ya no la ve');
                }}>Retirar</button>
                : <button class="btn btn-peq btn-primario" onClick={() => {
                  // El atleta solo ve el bloque activo: si este no lo es, se pregunta
                  if (!['activo', 'ajustado'].includes(bloque.estado)) { setPublicarEn(semana); return; }
                  estructura(() => api.publicarSemana(semana.id, true), `Semana ${semana.numero} publicada`);
                }}><Icono n="enviar" /> Publicar al atleta</button>)}
              <button class="btn btn-peq" onClick={() => setDuplicar(true)}><Icono n="duplicar" /> Preparar las siguientes</button>
              {conDatos && <button class="btn btn-peq" onClick={() => setSugerir(true)}><Icono n="rayo" /> Cargas sugeridas</button>}
              <button class="btn btn-peq btn-icono btn-peligro" aria-label={`Borrar semana ${semana.numero}`} onClick={() => setConfirmarBorrado({ tipo: 'semana', id: semana.id })}><Icono n="basura" /></button>
            </div>
          </div>
          {!bloque.es_plantilla && semana.programacion !== 'programada' && <p class="peq secundario">Borrador: el atleta no verá esta semana hasta que la publiques.</p>}
          <div class="rejilla-campos">
            <div class="campo"><label for={`s-foco-${semana.id}`}>Foco semanal</label>
              <select id={`s-foco-${semana.id}`} class="selector" value={semana.foco || ''} onChange={(e) => guardar('semanas', semana.id, { foco: nulo(e.currentTarget.value) })}>
                <option value="">Sin foco</option>{FOCOS.filter(([f]) => f !== 'mixto').map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select></div>
            {!bloque.es_plantilla && <div class="campo"><label for={`s-ini-${semana.id}`}>Empieza el lunes</label>
              <input id={`s-ini-${semana.id}`} class="entrada" type="date" key={semana.fecha_inicio} defaultValue={semana.fecha_inicio || ''} onChange={(e) => {
                const v = nulo(e.currentTarget.value);
                const lunes = v ? lunesDe(v) : null;
                if (lunes && lunes !== v) aviso(`Las semanas van de lunes a domingo: empieza el lunes ${fmtCorta(lunes)}`);
                guardar('semanas', semana.id, { fecha_inicio: lunes });
              }} /></div>}
          </div>
          <div class="campo"><label for={`s-nota-${semana.id}`}>Nota para el atleta</label>
            <textarea id={`s-nota-${semana.id}`} class="area" style="min-height:64px" defaultValue={semana.nota_coach || ''} placeholder="Aparece arriba en su pantalla de hoy" onChange={(e) => guardar('semanas', semana.id, { nota_coach: nulo(e.currentTarget.value.trim()) })} /></div>
        </div>
      )}

      {semana && <VolumenSemana pautas={sesiones.flatMap((s) => d.pautas[s.id] || [])} ejercicios={ejercicios} objetivo={bloque.es_plantilla ? null : volumenObjetivo} />}
      {semana && nivel && !bloque.es_plantilla && (
        <p class="peq secundario aviso-nivel"><Icono n="diana" /><span><strong>Nivel {NOMBRE_NIVEL[nivel].toLowerCase()}:</strong> {AYUDA_NIVEL[nivel].charAt(0).toLowerCase() + AYUDA_NIVEL[nivel].slice(1)}.
          {nivel !== 'novato' && ' Donde no pongas kg, el atleta ve en cada serie su peso de la última vez.'} Lo cambias en Datos.</span></p>
      )}

      {semana && sesiones.map((s) => (
        <EditorSesion key={`${s.id}-${version}`} sesion={s} pautas={d.pautas[s.id] || []} series={d.series} ejercicios={ejercicios} nivel={bloque.es_plantilla ? null : nivel} ultimas={ultimas.datos || {}}
          guardar={guardar} estructura={estructura} elegir={(pautaId) => setElegir({ sesionId: s.id, pautaId })}
          borrar={() => setConfirmarBorrado({ tipo: 'sesion', id: s.id, nombre: s.nombre })} />
      ))}
      {semana && <button class="btn btn-ancho" onClick={() => estructura(() => api.nuevaSesion(semana.id))}><Icono n="mas" /> Añadir sesión</button>}

      {sugerir && semana && anterior && (
        <CargasSugeridas filas={sugerirCargas({
          // Con nivel, solo los ejercicios que se pautan con kg (los de RPE los carga el atleta)
          ahora: sesiones.flatMap((x) => d.pautas[x.id] || []).filter(conKg), antes: sesionesAnt.flatMap((x) => d.pautas[x.id] || []),
          series: d.series, sesionesAhora: sesiones, sesionesAntes: sesionesAnt,
          nombres: Object.fromEntries(Object.values(ejercicios).map((e) => [e.id, e.nombre])), foco: semana.foco,
        })} sesiones={sesiones} semana={semana} anterior={anterior} alCerrar={() => setSugerir(false)}
          alAplicar={async (cambios) => {
            setSugerir(false);
            await estructura(async () => { for (const [id, kg] of cambios) await api.actualizar('sesion_ejercicios', id, { carga_sugerida_kg: kg }); },
              `${cambios.length} ${cambios.length === 1 ? 'carga actualizada' : 'cargas actualizadas'}`);
            setVersion((v) => v + 1);
          }} />
      )}
      {duplicar && semana && <Duplicar semana={semana} pautas={sesiones.flatMap((x) => d.pautas[x.id] || [])} ejercicios={ejercicios} alCerrar={() => setDuplicar(false)} alHacer={async (prog) => {
        setDuplicar(false);
        const nuevas = await estructura(() => api.prepararSemanas(semana.id, prog));
        if (nuevas?.length) {
          setSemanaId(nuevas[0].id);
          aviso(nuevas.length === 1 ? `Semana ${nuevas[0].numero} preparada, en borrador` : `Semanas ${nuevas.map((w) => w.numero).join(', ')} preparadas, en borrador: revísalas y publícalas`);
        }
      }} />}
      {elegir && <ElegirEjercicio biblioteca={biblioteca} alCerrar={() => setElegir(null)} alElegir={async (ej) => {
        const { sesionId, pautaId } = elegir;
        setElegir(null);
        if (pautaId) await guardar('sesion_ejercicios', pautaId, { ejercicio_id: ej.id });
        else await estructura(() => api.nuevaPauta(sesionId, ej.id));
      }} />}
      {publicarEn && (
        <Hoja titulo="Este bloque aún no es el activo" alCerrar={() => setPublicarEn(null)}>
          <p class="peq secundario">El atleta solo ve las semanas publicadas de su bloque activo. Si lo activas ahora, el bloque que tenía activo pasa a finalizado y en su programa verá este.</p>
          <div class="pila-s">
            <button class="btn btn-primario btn-grande" onClick={async () => {
              const w = publicarEn; setPublicarEn(null);
              await estructura(async () => { await api.publicarSemana(w.id, true); await api.activarBloque(bloque.id, bloque.atleta_id); }, `Semana ${w.numero} publicada y bloque activado`);
            }}><Icono n="enviar" /> Publicar y activar este bloque</button>
            <button class="btn" onClick={async () => {
              const w = publicarEn; setPublicarEn(null);
              await estructura(() => api.publicarSemana(w.id, true), `Semana ${w.numero} publicada (el atleta la verá cuando actives el bloque)`);
            }}>Solo publicar</button>
          </div>
        </Hoja>
      )}
      {confirmarBorrado && (
        <Hoja titulo="¿Seguro?" alCerrar={() => setConfirmarBorrado(null)}>
          <p>{confirmarBorrado.tipo === 'bloque' ? `Se borrará ${bloque.es_plantilla ? 'la plantilla' : 'el bloque'} entero con todas sus semanas${bloque.es_plantilla ? '' : ' y las series registradas'}.`
            : confirmarBorrado.tipo === 'semana' ? 'Se borrará la semana con sus sesiones y lo que se haya registrado en ella. Las siguientes suben un puesto (y una semana antes).'
              : `Se borrará la sesión «${confirmarBorrado.nombre}» y lo registrado en ella.`} No se puede deshacer.</p>
          <div class="fila-envolver">
            <button class="btn" onClick={() => setConfirmarBorrado(null)}>Cancelar</button>
            <button class="btn btn-peligro" onClick={async () => {
              const c = confirmarBorrado; setConfirmarBorrado(null);
              if (c.tipo === 'bloque') { await api.borrar('bloques', bloque.id); aviso('Borrado'); alBorrar?.(); }
              else if (c.tipo === 'semana') await estructura(() => api.borrarSemana(c.id), 'Semana borrada: las siguientes suben un puesto');
              else await estructura(() => api.borrar('sesiones', c.id), 'Borrado');
            }}><Icono n="basura" /> Borrar</button>
          </div>
        </Hoja>
      )}
    </div>
  );
}

// Cargas sugeridas: la propuesta de cada ejercicio con su motivo; el coach marca cuáles aplicar
function CargasSugeridas({ filas, sesiones, semana, anterior, alCerrar, alAplicar }) {
  // Marcadas de entrada: las que suben, las de descarga y las que no tenían carga; rebajar lo pautado se decide a mano
  const [marcadas, setMarcadas] = useState(() => new Set(filas.filter((f) => f.propuesta != null && f.cambia && (f.tipo !== 'mantener' || f.actual == null)).map((f) => f.pauta_id)));
  const nombreSesion = Object.fromEntries(sesiones.map((x) => [x.id, x.nombre]));
  const conPropuesta = filas.filter((f) => f.propuesta != null);
  const alternar = (id) => setMarcadas((m) => { const n = new Set(m); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <Hoja titulo={`Cargas sugeridas para la semana ${semana.numero}`} alCerrar={alCerrar} ancho={720}>
      <p class="peq secundario">A partir de lo que registró en la semana {anterior.numero}. Marca las que quieras aplicar; las demás se quedan como están.</p>
      {!conPropuesta.length ? <p class="peq">No hay ejercicios con series de la semana anterior para proponer cargas.</p> : (
        <ul class="lista cargas-sug">
          {filas.map((f) => (
            <li key={f.pauta_id} class={`carga-sug ${f.propuesta == null ? 'sin' : ''}`}>
              {f.propuesta != null
                ? <input type="checkbox" checked={marcadas.has(f.pauta_id)} onChange={() => alternar(f.pauta_id)} aria-label={`Aplicar ${num(f.propuesta, 2)} kg en ${f.ejercicio}`} />
                : <span />}
              <span class="pila-xs">
                <strong>{f.ejercicio}</strong>
                <span class="mini terciario">{nombreSesion[f.sesion_id]}{f.antes ? `. Semana ${anterior.numero}: ${f.antes}` : ''}</span>
                <span class={`mini ${f.tipo === 'subir' ? 'ok-t' : f.tipo === 'bajar' ? 'secundario' : 'secundario'}`}>{f.motivo}</span>
              </span>
              <span class="carga-sug-kg num">
                {f.propuesta != null ? <>
                  <span class="terciario">{f.actual != null ? `${num(f.actual, 2)} →` : '— →'}</span>
                  <b class={f.tipo === 'subir' ? 'ok-t' : ''}>{num(f.propuesta, 2)} kg</b>
                </> : <span class="terciario">—</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div class="fila-envolver">
        <button class="btn" onClick={alCerrar}>Cancelar</button>
        <button class="btn btn-primario" disabled={!marcadas.size} onClick={() => alAplicar(filas.filter((f) => marcadas.has(f.pauta_id)).map((f) => [f.pauta_id, f.propuesta]))}>
          <Icono n="hecho" /> {marcadas.size ? `Aplicar ${marcadas.size} ${marcadas.size === 1 ? 'carga' : 'cargas'}` : 'Marca las que quieras aplicar'}
        </button>
      </div>
    </Hoja>
  );
}

// Nota del coach para un ejercicio: el campo aparece al pedirlo (o si ya hay nota), para no alargar la tabla
function NotaPauta({ valor, alGuardar }) {
  const [abierta, setAbierta] = useState(!!valor);
  if (!abierta) return <button type="button" class="btn-texto mini nota-pauta" onClick={() => setAbierta(true)}><Icono n="mas" width="14" height="14" /> Nota para el atleta</button>;
  return (
    <input class="variante" aria-label="Nota para el atleta" placeholder="Nota para el atleta" defaultValue={valor || ''} autoFocus={!valor}
      onChange={(e) => alGuardar(nulo(e.currentTarget.value.trim()))} onBlur={(e) => { if (!e.currentTarget.value.trim()) setAbierta(false); }} />
  );
}

// Tempo de la repetición (3-1-1, 31X0…): se guarda normalizado y el atleta lo tiene con metrónomo
const BACKOFFS = [5, 7.5, 10, 12.5, 15, 20, 25];

function CampoTempo({ valor, alGuardar }) {
  const { aviso } = useApp();
  const [mal, setMal] = useState(false);
  const t = leerTempo(valor);
  return (
    <input class={`tempo ${mal ? 'invalido' : ''}`} aria-label="Tempo (bajada, pausa, subida)" placeholder="Tempo" title={t ? explicarTempo(t) : 'Por ejemplo, 3-1-1: baja en 3 s, 1 s abajo y sube en 1 s (X = explosiva)'}
      aria-invalid={mal ? 'true' : 'false'} defaultValue={t?.texto || valor || ''} maxLength={9} inputMode="text" autoComplete="off" spellcheck={false}
      onInput={() => mal && setMal(false)}
      onChange={(e) => {
        const v = e.currentTarget.value.trim();
        if (!v) { setMal(false); alGuardar(null); return; }
        const l = leerTempo(v);
        if (!l) { setMal(true); aviso('Escribe el tempo con 3 o 4 cifras, por ejemplo 3-1-1 o 31X0 (X = explosiva)', 'error'); return; }
        setMal(false); e.currentTarget.value = l.texto; alGuardar(l.texto);
      }} />
  );
}

// Series pautadas por músculo en la semana que se edita, frente al rango objetivo del atleta
function VolumenSemana({ pautas, ejercicios, objetivo }) {
  const cuenta = seriesPautadasPorGrupo(pautas, ejercicios);
  const grupos = GRUPOS.filter(([g]) => cuenta[g]);
  if (!grupos.length) return null;
  return (
    <div class="panel panel-pad pila-s">
      <span class="peq secundario">Series semanales pautadas por músculo{objetivo ? ' (frente al rango de este atleta)' : ' (frente al rango general, 10–20)'}</span>
      <div class="vol-chips">
        {grupos.map(([g, n]) => {
          const r = rangoVolumen(objetivo, g);
          const est = estadoVolumen(cuenta[g], r);
          return (
            <span key={g} class={`vol-chip vol-${est}`} title={est === 'bajo' ? 'Por debajo del rango' : est === 'alto' ? 'Por encima del rango' : 'Dentro del rango'}>
              {n} <strong>{num(cuenta[g])}</strong><span class="mini">{r[0]}–{r[1]}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// La pauta de cardio de una sesión: modalidad, minutos u objetivo de km, esfuerzo objetivo y una nota. Se guarda al salir de cada campo.
function PautaCardio({ sesion, guardar }) {
  const c = sesion.cardio || {};
  const [f, setF] = useState({ modalidad: c.modalidad || 'carrera', minutos: c.minutos ?? '', km: c.km ?? '', esfuerzo: c.esfuerzo ?? '', nota: c.nota || '' });
  const [error, setError] = useState(null);
  useEffect(() => { const x = sesion.cardio || {}; setF({ modalidad: x.modalidad || 'carrera', minutos: x.minutos ?? '', km: x.km ?? '', esfuerzo: x.esfuerzo ?? '', nota: x.nota || '' }); }, [sesion.id]);
  const fijar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const enviar = (nuevo = f) => {
    const { pauta, error: err } = limpiarCardio(nuevo);
    setError(err);
    if (err) return;
    if (JSON.stringify(pauta) !== JSON.stringify(sesion.cardio || null)) guardar('sesiones', sesion.id, { cardio: pauta });
  };
  const alCambiarSelect = (k) => (e) => { const nuevo = { ...f, [k]: e.currentTarget.value }; setF(nuevo); enviar(nuevo); };
  return (
    <div class="pauta-cardio" aria-label="Pauta de cardio">
      <div class="pauta-cardio-campos">
        <label class="campo"><span class="etq">Modalidad</span>
          <select class="selector" value={f.modalidad} onChange={alCambiarSelect('modalidad')}>{MODALIDADES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <label class="campo"><span class="etq">Minutos</span>
          <input class="entrada" inputMode="numeric" placeholder="30" value={f.minutos} onInput={fijar('minutos')} onBlur={() => enviar()} /></label>
        <label class="campo"><span class="etq">Kilómetros</span>
          <input class="entrada" inputMode="decimal" placeholder="—" value={f.km} onInput={fijar('km')} onBlur={() => enviar()} /></label>
        <label class="campo"><span class="etq">Esfuerzo (RPE)</span>
          <select class="selector" value={f.esfuerzo} onChange={alCambiarSelect('esfuerzo')}><option value="">—</option>{[3, 4, 5, 6, 7, 8, 9, 10].map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
      </div>
      <label class="campo"><span class="etq">Nota del cardio</span>
        <input class="entrada" placeholder="Llano, sin cuestas; si puedes, al aire libre" maxLength={300} value={f.nota} onInput={fijar('nota')} onBlur={() => enviar()} /></label>
      {error ? <span class="error-campo">{error}</span>
        : sesion.cardio ? <span class="mini terciario">El atleta verá: «{textoCardio(sesion.cardio)}»{sesion.cardio.esfuerzo ? ` (${palabrasEsfuerzo(sesion.cardio.esfuerzo)})` : ''}. Al terminar apuntará minutos, kilómetros y esfuerzo.</span>
        : <span class="mini terciario">Pon los minutos o los kilómetros: el atleta lo verá en su sesión y apuntará lo que haga.</span>}
    </div>
  );
}

function parchear(d, tabla, id, cambios) {
  if (tabla === 'bloques') return { ...d, bloque: { ...d.bloque, ...cambios } };
  if (tabla === 'semanas') return { ...d, semanas: d.semanas.map((s) => (s.id === id ? { ...s, ...cambios } : s)) };
  if (tabla === 'sesiones') return { ...d, sesiones: Object.fromEntries(Object.entries(d.sesiones).map(([k, v]) => [k, v.map((s) => (s.id === id ? { ...s, ...cambios } : s))])) };
  if (tabla === 'sesion_ejercicios') return { ...d, pautas: Object.fromEntries(Object.entries(d.pautas).map(([k, v]) => [k, v.map((p) => (p.id === id ? { ...p, ...cambios } : p))])) };
  return d;
}

// «25×10 @8», «12 reps @7» (sin kilos) o «25×10» (sin RPE)
const textoSerieHecha = (x) => `${x.kg != null ? `${num(x.kg, 2)}×${x.reps ?? '–'}` : `${x.reps ?? '–'} reps`}${x.rpe != null ? ` @${num(x.rpe, 1)}` : ''}`;

function EditorSesion({ sesion, pautas, series, ejercicios, guardar, estructura, elegir, borrar, nivel = null, ultimas = {} }) {
  const { api } = useApp();
  const numero = (pautaId, campo, dec = false) => (e) => {
    const t = e.currentTarget.value.replace(',', '.').trim();
    const v = t === '' ? null : dec ? Number(t) : parseInt(t, 10);
    if (v !== null && Number.isNaN(v)) return;
    guardar('sesion_ejercicios', pautaId, { [campo]: v });
  };
  const hechas = pautas.reduce((t, p) => t + (series[p.id]?.length || 0), 0);
  // Con nivel, solo las columnas que se usan; en cada fila, la que no toca por su prioridad queda atenuada
  const col = columnasEditor(nivel, pautas);
  const fuera = (p, campo) => {
    const m = modoCarga(nivel, p.prioridad);
    return m && p[campo] == null && (campo === 'carga_sugerida_kg' ? m === 'rpe' : m === 'kg');
  };
  const titulo = (p, campo) => (fuera(p, campo) ? (campo === 'carga_sugerida_kg' ? 'A RPE: la carga la elige el atleta (verá su peso anterior)' : 'Con kg pautados: el RPE lo rellena el atleta') : undefined);
  const [conCardio, setConCardio] = useState(false); // «Añadir cardio al final» en una sesión que no es de cardio
  const etiquetas = etiquetasSuperserie(pautas);
  const sueltas = pautas.filter((p) => p.superserie && !etiquetas[p.id]);
  return (
    <section class="panel panel-pad editor-sesion" aria-label={sesion.nombre}>
      <div class="editor-sesion-cab">
        <input class="entrada" aria-label="Nombre de la sesión" style="font-weight:700" defaultValue={sesion.nombre} onChange={(e) => guardar('sesiones', sesion.id, { nombre: e.currentTarget.value.trim() || sesion.nombre })} />
        <select class="selector" aria-label="Tipo de sesión" value={sesion.tipo || 'fuerza'} onChange={(e) => guardar('sesiones', sesion.id, { tipo: e.currentTarget.value })}>
          {TIPOS_SESION.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        <select class="selector" aria-label="Intención" value={sesion.intencion || ''} onChange={(e) => guardar('sesiones', sesion.id, { intencion: nulo(e.currentTarget.value) })}>
          <option value="">Intención</option>{INTENCIONES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        <button class="btn btn-icono plano btn-peligro" aria-label={`Borrar ${sesion.nombre}`} onClick={borrar}><Icono n="basura" /></button>
      </div>
      {sesion.completada && <p class="peq" style="color:var(--ok)">Hecha por el atleta{hechas ? `: ${hechas} series registradas` : ''}.</p>}
      {!sesion.completada && sesion.dia_previsto && <p class="mini terciario plan-coach"><Icono n="calendario" /> El atleta la tiene prevista el {fmtConDia(sesion.dia_previsto)}.</p>}
      <textarea class="area" style="min-height:56px" aria-label="Dinámica de la sesión" placeholder={sesion.tipo === 'cardio' ? 'Qué hacer: por ejemplo, 30 min en zona 2 (puedes hablar sin ahogarte) o 6 × 2 min fuerte con 2 min suave' : 'Dinámica: calentamiento, orden, indicaciones…'} defaultValue={sesion.dinamica || ''}
        onChange={(e) => guardar('sesiones', sesion.id, { dinamica: nulo(e.currentTarget.value.trim()) })} />
      {(sesion.tipo === 'cardio' || sesion.cardio || conCardio) ? <PautaCardio sesion={sesion} guardar={guardar} />
        : <button class="btn-texto" style="justify-self:start" onClick={() => setConCardio(true)}><Icono n="intervalos" /> Añadir cardio al final</button>}
      {pautas.length > 0 && (
        <div class="tabla-pauta-env">
          <table class="tabla-pauta">
            <thead><tr>
              <th style="width:168px">Prioridad</th><th style="width:74px" title="Misma letra en ejercicios seguidos: se alternan y se descansa al acabar la ronda">Súper.</th><th class="col-ejercicio">Ejercicio</th><th style="width:64px">Series</th><th style="width:66px">Reps mín.</th><th style="width:66px">Reps máx.</th>
              {col.rir && <th style="width:58px">RIR</th>}{col.rpe && <th style="width:58px">RPE</th>}{col.kg && <th style="width:76px">Kg</th>}<th style="width:88px">Descanso</th><th style="width:110px"><span class="sr">Acciones</span></th>
            </tr></thead>
            <tbody>
              {pautas.map((p, i) => (
                <tr key={p.id}>
                  <td><span class="sel-prioridad"><Disco prioridad={p.prioridad} />
                    <select aria-label="Prioridad" value={p.prioridad} onChange={(e) => guardar('sesion_ejercicios', p.id, { prioridad: e.currentTarget.value })}>
                      {PRIORIDADES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select></span></td>
                  <td><select aria-label="Superserie" value={p.superserie || ''} class={etiquetas[p.id] ? 'ss-activa' : ''} onChange={(e) => guardar('sesion_ejercicios', p.id, { superserie: nulo(e.currentTarget.value) })}>
                    <option value="">—</option>{LETRAS_SUPERSERIE.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select></td>
                  <td class="col-ejercicio"><button class="btn btn-peq btn-ejercicio" onClick={() => elegir(p.id)}>{ejercicios[p.ejercicio_id]?.nombre || 'Elegir ejercicio'}</button>
                    <div class="variante-tempo">
                      <input class="variante" aria-label="Variante" placeholder="Variante: pausa, agarre…" defaultValue={p.variante || ''} onChange={(e) => guardar('sesion_ejercicios', p.id, { variante: nulo(e.currentTarget.value.trim()) })} />
                      <CampoTempo valor={p.tempo} alGuardar={(v) => guardar('sesion_ejercicios', p.id, { tempo: v })} />
                      <select class={`backoff ${p.backoff_pct != null ? 'activo' : ''}`} aria-label="Serie top y back-off" title="La primera serie es la top; las demás, un % por debajo de lo que el atleta haga en ella (la app calcula la carga)"
                        value={p.backoff_pct == null ? '' : String(Number(p.backoff_pct))}
                        onChange={(e) => {
                          const v = e.currentTarget.value === '' ? null : Number(e.currentTarget.value);
                          guardar('sesion_ejercicios', p.id, v == null ? { backoff_pct: null } : { backoff_pct: v, series: Math.max(2, p.series || 0) });
                        }}>
                        <option value="">Series iguales</option>
                        {BACKOFFS.map((x) => <option key={x} value={String(x)}>Top + back-off −{num(x)} %</option>)}
                      </select>
                    </div>
                    <NotaPauta valor={p.notas_coach} alGuardar={(v) => guardar('sesion_ejercicios', p.id, { notas_coach: v })} />
                    {ultimas[p.ejercicio_id]?.series.length > 0 && <div class="mini registro-serie ultima-vez" title="Lo que hizo la última vez antes de esta semana">
                      <span class="terciario">Última vez{ultimas[p.ejercicio_id].fecha ? ` (${fmtCorta(ultimas[p.ejercicio_id].fecha)})` : ''}: </span>{ultimas[p.ejercicio_id].series.map(textoSerieHecha).join(' · ')}</div>}
                    {series[p.id]?.length > 0 && <div class="mini registro-serie hecho-semana" style="margin-top:3px"><span class="terciario">Esta semana: </span>{[...series[p.id]].sort((a, c) => a.numero - c.numero).map(textoSerieHecha).join(' · ')}</div>}</td>
                  <td><input class="n" inputMode="numeric" aria-label="Series" key={`series-${p.series}`} defaultValue={p.series} onChange={(e) => {
                    // Con top + back-off hacen falta al menos dos series: con una sola, deja de serlo.
                    // La «key» lo vuelve a pintar si las series cambian desde fuera (elegir back-off las sube a 2)
                    const v = parseInt(e.currentTarget.value, 10);
                    if (!Number.isNaN(v) && v < 2 && p.backoff_pct != null) guardar('sesion_ejercicios', p.id, { series: v, backoff_pct: null });
                    else numero(p.id, 'series')(e);
                  }} /></td>
                  <td><input class="n" inputMode="numeric" aria-label="Repeticiones mínimas" defaultValue={p.reps_min ?? ''} onChange={numero(p.id, 'reps_min')} /></td>
                  <td><input class="n" inputMode="numeric" aria-label="Repeticiones máximas" defaultValue={p.reps_max ?? ''} onChange={numero(p.id, 'reps_max')} /></td>
                  {col.rir && <td><input class="n" inputMode="decimal" aria-label="RIR objetivo" defaultValue={p.rir_objetivo == null ? '' : num(p.rir_objetivo, 1)} onChange={numero(p.id, 'rir_objetivo', true)} /></td>}
                  {col.rpe && <td><input class={`n ${fuera(p, 'rpe_objetivo') ? 'fuera-nivel' : ''}`} inputMode="decimal" aria-label="RPE objetivo" title={titulo(p, 'rpe_objetivo')} placeholder={fuera(p, 'rpe_objetivo') ? '·' : ''} defaultValue={p.rpe_objetivo == null ? '' : num(p.rpe_objetivo, 1)} onChange={numero(p.id, 'rpe_objetivo', true)} /></td>}
                  {col.kg && <td><input class={`n ${fuera(p, 'carga_sugerida_kg') ? 'fuera-nivel' : ''}`} inputMode="decimal" aria-label="Carga sugerida en kg" title={titulo(p, 'carga_sugerida_kg')} placeholder={fuera(p, 'carga_sugerida_kg') ? '·' : ''} defaultValue={p.carga_sugerida_kg == null ? '' : num(p.carga_sugerida_kg, 2)} onChange={numero(p.id, 'carga_sugerida_kg', true)} /></td>}
                  <td><select aria-label="Descanso" value={p.descanso_seg ?? ''} onChange={(e) => guardar('sesion_ejercicios', p.id, { descanso_seg: e.currentTarget.value === '' ? null : Number(e.currentTarget.value) })}>
                    <option value="">—</option>{DESCANSOS.map((s) => <option key={s} value={s}>{s ? mmss(s) : 'Sin descanso'}</option>)}
                  </select></td>
                  <td><span class="fila" style="gap:2px">
                    <button class="btn btn-icono plano" aria-label="Subir" disabled={i === 0} onClick={() => estructura(() => api.moverPauta(sesion.id, p.id, -1))}><Icono n="arriba" /></button>
                    <button class="btn btn-icono plano" aria-label="Bajar" disabled={i === pautas.length - 1} onClick={() => estructura(() => api.moverPauta(sesion.id, p.id, 1))}><Icono n="abajo" /></button>
                    <button class="btn btn-icono plano btn-peligro" aria-label="Quitar ejercicio" onClick={() => estructura(() => api.borrar('sesion_ejercicios', p.id))}><Icono n="cerrar" /></button>
                  </span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sueltas.length > 0 && <p class="mini terciario">La letra {sueltas[0].superserie} solo está en un ejercicio (o no van seguidos): para una superserie, pon la misma letra a dos o más ejercicios seguidos.</p>}
      <button class="btn-texto" onClick={() => elegir(null)}><Icono n="mas" /> Añadir ejercicio</button>
    </section>
  );
}

// Preparar las semanas siguientes (una o el mes de golpe): cada una sale de la anterior con su progresión.
// Enseña solo los controles de lo que tiene la semana (kg, RPE, RIR) y cómo quedaría un ejercicio de cada tipo.
function Duplicar({ semana, pautas = [], ejercicios = {}, alCerrar, alHacer }) {
  const conKg = pautas.filter((p) => p.carga_sugerida_kg != null);
  const [n, setN] = useState(1);
  const cuantos = (k) => `${k} ${k === 1 ? 'ejercicio' : 'ejercicios'}`;
  const [modoKg, setModoKg] = useState('salto');
  const [kgFijo, setKgFijo] = useState(2.5);
  // El esfuerzo solo cambia en lo que no sube de kilos
  const subeKg = (p) => p.carga_sugerida_kg != null && (modoKg === 'salto' || (modoKg === 'fijo' && !!kgFijo));
  const conRpe = pautas.filter((p) => p.rpe_objetivo != null && !subeKg(p));
  const conRir = pautas.filter((p) => p.rir_objetivo != null && !subeKg(p));
  const [rpe, setRpe] = useState(pautas.some((p) => p.rpe_objetivo != null && p.carga_sugerida_kg == null) ? 0.5 : 0);
  const [rir, setRir] = useState(0);
  const [reps, setReps] = useState(0);
  const [descarga, setDescarga] = useState(false);
  const opciones = { kg: modoKg === 'fijo' ? kgFijo : modoKg, rpe, rir, reps };
  // Cómo quedaría, semana a semana, un ejercicio con kg y uno con RPE (o RIR)
  const ejemplo = (p, texto) => {
    if (!p) return null;
    const nombre = ejercicios[p.ejercicio_id]?.nombre || 'Ejercicio';
    const pasos = [];
    let x = p;
    for (let i = 1; i <= n; i++) { x = progresarPauta(x, opciones, { nombre, descarga: descarga && i === n }); pasos.push(texto(x)); }
    return <li key={p.id}><strong>{nombre}</strong>: {texto(p)} → {pasos.join(' → ')}{descarga ? ' (descarga)' : ''}</li>;
  };
  const kgTxt = (x) => `${num(x.carga_sugerida_kg, 2)} kg${x.rpe_objetivo != null ? ` @${num(x.rpe_objetivo)}` : x.rir_objetivo != null ? ` RIR ${num(x.rir_objetivo)}` : ''}`;
  const esfTxt = (x) => (x.rpe_objetivo != null ? `RPE ${num(x.rpe_objetivo)}` : `RIR ${num(x.rir_objetivo)}`);
  const conEsfuerzo = conRpe.find((p) => p.carga_sugerida_kg == null) || conRpe[0] || conRir.find((p) => p.carga_sugerida_kg == null) || conRir[0];
  return (
    <Hoja titulo={`Preparar desde la semana ${semana.numero}`} alCerrar={alCerrar}>
      <p class="secundario">Crea las semanas siguientes en borrador, cada una a partir de la anterior con estos cambios. Rellena las semanas vacías que vienen detrás (una que ya sea de descarga se prepara como descarga); si la siguiente ya tiene sesiones, se añaden al final del bloque.</p>
      <div class="campo"><span class="etq">Cuántas semanas</span><Segmentos etiqueta="Cuántas semanas" valor={n} alCambiar={(v) => v && setN(v)} opciones={[[1, '1'], [2, '2'], [3, '3 (el mes)'], [4, '4']]} /></div>
      {conKg.length > 0 && (
        <div class="campo"><span class="etq">Kilos ({cuantos(conKg.length)} con carga)</span>
          <Segmentos etiqueta="Kilos" valor={modoKg} alCambiar={(v) => v && setModoKg(v)} opciones={[['salto', 'Un salto por semana', '2,5 kg en barra, 2 kg en mancuernas, 2,5 o 5 kg en máquinas'], ['igual', 'Igual'], ['fijo', 'Otra cantidad']]} />
          {modoKg === 'fijo' && <Paso id="dup-kg" valor={kgFijo} paso={0.5} min={-20} max={20} dec={2} etiqueta="kilos a sumar cada semana" alCambiar={(v) => setKgFijo(v ?? 0)} />}
          <span class="ayuda">{modoKg === 'salto' ? 'El salto de cada ejercicio: 2,5 kg en barra, 2 kg en mancuernas, 2,5 o 5 kg en máquinas y poleas. Su RPE o RIR se queda igual.' : modoKg === 'fijo' ? 'Los mismos kilos en todos, cada semana. Su RPE o RIR se queda igual.' : 'Los kilos se quedan como están.'}</span></div>
      )}
      {conRpe.length > 0 && (
        <div class="campo"><span class="etq">RPE objetivo ({cuantos(conRpe.length)} a RPE)</span>
          <Segmentos etiqueta="RPE objetivo" valor={rpe} alCambiar={(v) => setRpe(v ?? 0)} opciones={[[0, 'Igual'], [0.5, '+0,5 por semana'], [1, '+1 por semana']]} />
          <span class="ayuda">Nunca pasa de 10.</span></div>
      )}
      {conRir.length > 0 && (
        <div class="campo"><span class="etq">RIR objetivo ({cuantos(conRir.length)} a RIR)</span>
          <Segmentos etiqueta="RIR" valor={rir} alCambiar={(v) => setRir(v ?? 0)} opciones={[[-1, '−1 (más duro)'], [0, 'Igual'], [1, '+1 (más suave)']]} /></div>
      )}
      <div class="campo"><span class="etq">Repeticiones</span><Segmentos etiqueta="Repeticiones" valor={reps} alCambiar={(v) => setReps(v ?? 0)} opciones={[[-2, '−2'], [-1, '−1'], [0, 'Igual'], [1, '+1'], [2, '+2']]} /></div>
      <label class="casilla"><input type="checkbox" checked={descarga} onChange={(e) => setDescarga(e.currentTarget.checked)} />
        <span>{n === 1 ? 'Que sea de descarga' : `La última (la ${n}.ª), de descarga`}<br /><span class="peq terciario">Sobre la semana anterior: un 10 % menos de kilos, una serie menos por ejercicio, RPE objetivo 1 punto menos y RIR 1 más. Las repeticiones, igual.</span></span></label>
      {(conKg.length > 0 || conEsfuerzo) && (
        <div class="pila-xs">
          <span class="peq">Así quedaría</span>
          <ul class="lista-ejemplo peq secundario">{ejemplo(conKg[0], kgTxt)}{conEsfuerzo && conEsfuerzo !== conKg[0] && ejemplo(conEsfuerzo, esfTxt)}</ul>
        </div>
      )}
      <button class="btn btn-primario btn-grande" onClick={() => alHacer({ n, ...opciones, descargaUltima: descarga })}><Icono n="duplicar" /> {n === 1 ? 'Preparar la semana siguiente' : `Preparar ${n} semanas`}</button>
    </Hoja>
  );
}

export function ElegirEjercicio({ biblioteca, alCerrar, alElegir }) {
  const { api, aviso } = useApp();
  const [q, setQ] = useState('');
  const [grupo, setGrupo] = useState(null);
  const [creando, setCreando] = useState(false);
  const lista = (biblioteca.datos || []).filter((e) => e.activo !== false)
    .filter((e) => !grupo || e.grupos_musculares?.[0] === grupo || (grupo && e.grupos_musculares?.includes(grupo)))
    .filter((e) => !q || normal(e.nombre).includes(normal(q)));
  return (
    <Hoja titulo="Elegir ejercicio" alCerrar={alCerrar} ancho={640}>
      <div class="buscador"><Icono n="buscar" /><input class="entrada" type="search" aria-label="Buscar ejercicio" placeholder="Buscar en tu biblioteca" value={q} onInput={(e) => setQ(e.currentTarget.value)} /></div>
      <div class="selector-chips" role="group" aria-label="Grupo muscular">
        <button aria-pressed={!grupo ? 'true' : 'false'} onClick={() => setGrupo(null)}>Todos</button>
        {GRUPOS.map(([g, n]) => <button key={g} aria-pressed={grupo === g ? 'true' : 'false'} onClick={() => setGrupo(g)}>{n}</button>)}
      </div>
      {biblioteca.cargando ? <Cargando /> : (
        <div class="lista-elegir">
          {lista.slice(0, 80).map((e) => (
            <button key={e.id} onClick={() => alElegir(e)}>
              <span style="font-weight:600">{e.nombre}</span>
              <span class="mini terciario">{(e.grupos_musculares || []).map((g) => NOMBRE_GRUPO[g]).join(', ') || 'Sin grupo'}{(e.tipo || []).includes('basico') ? '; básico' : ''}{e.rango_reps ? `; ${e.rango_reps.toLowerCase()}` : ''}{e.video_url ? '; con vídeo' : ''}</span>
            </button>
          ))}
          {!lista.length && <div class="panel-pad secundario">Ningún ejercicio coincide.</div>}
        </div>
      )}
      {q.trim() && !creando && <button class="btn-texto" onClick={() => setCreando(true)}><Icono n="mas" /> Crear «{q.trim()}» en la biblioteca</button>}
      {creando && (
        <div class="nota pila-s">
          <span>Grupo principal de «{q.trim()}»:</span>
          <div class="selector-chips">{GRUPOS.map(([g, n]) => (
            <button key={g} onClick={async () => {
              try { const e = await api.crear('ejercicios', { nombre: q.trim(), grupos_musculares: [g] }); biblioteca.recargar(true); alElegir(e); }
              catch (err) { aviso(err.message, 'error'); }
            }}>{n}</button>
          ))}</div>
        </div>
      )}
    </Hoja>
  );
}
