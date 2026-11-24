// La carrera en la ficha del coach (v0.133, migración 056): zonas y test, el plan (macrociclo y semanas), las carreras,
// las revisiones y la biblioteca de sesiones de calidad. Y lo que usa el editor: las partes de una sesión de carrera y
// las sesiones del plan de la semana que se edita.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, ErrorCaja, Hoja, Vacio, Siluetas, Segmentos } from '../comunes.jsx';
import { TablaZonas, Macrociclo, GraficaForma } from '../CarreraComun.jsx';
import { fmtConDia, fmtCorta, hoyISO, lunesDe, sumarDias, diasEntre } from '../../logica/fechas.js';
import { num, leerNumero } from '../../logica/calculos.js';
import { textoCardio, textoCardioHecho, textoSaludCardio } from '../../logica/cardio.js';
import {
  TIPOS_CARRERA, NOMBRE_TIPO, FASES, TESTS, NOMBRE_TEST, PRIORIDADES, DECISIONES, NOMBRE_DECISION, ESTADOS_REVISION, NOMBRE_ESTADO_REVISION,
  zonasFC, textoRangoZona, textoZona, textoParte, limpiarParte, parteAEditor, fmtRitmo, textoRitmo, fmtTiempo, leerRitmo, leerTiempo, macrociclo, semanasConPlan,
  semanaDelPlan, faseDe, textoCuentaAtras, textoObjetivoCarrera, textoResultado, proximaCarrera, carreraObjetivo, textoKm, carreraHechaPorSemana,
  estadoKm, minutosPauta, pautaDeReceta, SEMAFORO, semanasPlan, zonasDe as zonasVer, fuenteZonas, umbralDesdeCarrera, rangoUmbral, leerRangoRitmo, predecirTiempo, ultimaConResultado,
} from '../../logica/carrera.js';
import { BIBLIOTECA_FBE } from '../../logica/carrera-biblioteca.js';
import { proponerPlan, rehacerDesde, kmRecientes, progresarSemana, textoSemanaPlan, DISTANCIAS_PLAN, NIVELES_PLAN } from '../../logica/carrera-plan.js';
import { avisosCarrera, ajusteSiguiente, aplicarPropuesta, choquesFuerza } from '../../logica/carrera-avisos.js';
import { revisionAuto, NOMBRE_COLOR } from '../../logica/carrera-seguimiento.js';

const DIAS = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [7, 'Domingo']];
const DIA_CORTO = { 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S', 7: 'D' };
const v = (x) => (x == null ? '' : String(x));
let claves = 0;
const claveNueva = () => `s${++claves}`;

// ---------------------------------------------------------------- la pestaña Carrera de la ficha
export function CarreraFicha({ atleta }) {
  const { api } = useApp();
  const datos = useCarga(() => api.carrera(atleta.id), [atleta.id], { recuerdo: `carrera:${api.uid()}:${atleta.id}` });
  const d = datos.datos;
  const recargar = () => datos.recargar(true);
  if (datos.error) return <ErrorCaja error={datos.error} reintentar={datos.recargar} />;
  if (!d) return <Siluetas forma="tarjetas" n={3} texto="Cargando su carrera" />;
  if (d.falta056) return <div class="panel"><Vacio ilustracion="espera" icono="pasos" titulo="Falta la migración 056">Para llevarle la carrera, ejecuta en Supabase supabase/migraciones/056_carrera.sql.</Vacio></div>;
  return (
    <div class="pila carrera-ficha">
      <ResumenCarrera d={d} />
      <AvisosCoach atleta={atleta} d={d} alGuardar={recargar} />
      <ZonasCoach atleta={atleta} perfil={d.perfil} alGuardar={recargar} />
      <PlanCoach atleta={atleta} perfil={d.perfil} d={d} alGuardar={recargar} />
      <SemanasCoach atleta={atleta} d={d} alGuardar={recargar} />
      <CarrerasCoach atleta={atleta} eventos={d.eventos} alGuardar={recargar} />
      <RevisionesCoach atleta={atleta} revisiones={d.revisiones} d={d} alGuardar={recargar} />
      <HechoCarrera d={d} />
      <BibliotecaCarrera />
    </div>
  );
}

// Arriba: su carrera objetivo con la cuenta atrás, la semana del plan y la fase
function ResumenCarrera({ d }) {
  const hoy = hoyISO();
  const obj = carreraObjetivo(d.eventos, hoy) || proximaCarrera(d.eventos, hoy);
  const n = semanaDelPlan(d.perfil, hoy);
  const fase = faseDe(d.perfil, hoy);
  const total = macrociclo(d.perfil).reduce((a, f) => a + f.semanas, 0);
  if (!obj && !fase) return null;
  return (
    <section class="panel panel-pad carrera-resumen" aria-label="Su carrera ahora">
      {obj && <div class="pila-xs">
        <span class="peq secundario">{obj.prioridad === 'A' ? 'Su carrera objetivo' : 'Su próxima carrera'}</span>
        <strong class="carrera-resumen-nombre">{obj.nombre}</strong>
        <span class="peq">{fmtConDia(obj.fecha)} · {textoCuentaAtras(obj.fecha, hoy)}</span>
        {textoObjetivoCarrera(obj) && <span class="mini terciario num">{textoObjetivoCarrera(obj)}</span>}
      </div>}
      {fase && n >= 1 && n <= total && <div class="chip num">Semana {n} de {total} · {fase.nombre}</div>}
    </section>
  );
}

// ---------------------------------------------------------------- zonas y test
function ZonasCoach({ atleta, perfil, alGuardar }) {
  const { api, aviso } = useApp();
  const p = perfil || {};
  const inicial = () => ({ lthr: v(p.lthr), fc_max: v(p.fc_max), fc_reposo: v(p.fc_reposo), test_fecha: p.test_fecha || '', test_tipo: p.test_tipo || '', umbral: p.umbral ? p.umbral.map(fmtRitmo).join('-') : '',
    z2: v(p.zonas?.[0]), z3: v(p.zonas?.[1]), z4: v(p.zonas?.[2]), z5: v(p.zonas?.[3]) });
  const [f, setF] = useState(inicial);
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  useEffect(() => setF(inicial()), [perfil?.actualizado_en]);
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  // (v0.219) la vista previa con todo lo escrito: FC umbral o, sin ella, FC máxima y de reposo; y el ritmo umbral, para los ritmos
  const previa = { lthr: Number(f.lthr) || null, fc_max: f.fc_max === '' ? null : Number(f.fc_max), fc_reposo: f.fc_reposo === '' ? null : Number(f.fc_reposo),
    zonas: [f.z2, f.z3, f.z4, f.z5].every((x) => x !== '') ? [f.z2, f.z3, f.z4, f.z5].map(Number) : null, umbral: leerRangoRitmo(f.umbral) || null };
  const zonas = zonasVer(previa);
  const fuente = fuenteZonas(previa);
  const guardar = (e) => {
    e.preventDefault();
    una(async () => {
      try {
        await api.guardarCarreraPerfil(atleta.id, { ...planDe(p), ...f });
        setError(null); aviso('Zonas guardadas'); alGuardar();
      } catch (err) { setError(err.message); }
    });
  };
  return (
    <section class="panel panel-pad pila carrera-zonas" aria-labelledby="cz-titulo">
      <h2 id="cz-titulo" class="h-panel">Zonas y test</h2>
      <form class="pila" onSubmit={guardar}>
        {error && <div class="error" role="alert">{error}</div>}
        <div class="rejilla-campos rejilla-carrera">
          <label class="campo"><span class="etq">FC umbral (LTHR)</span><input class="entrada num" inputMode="numeric" placeholder="181" value={f.lthr} onInput={cambiar('lthr')} /></label>
          <label class="campo"><span class="etq">FC máxima</span><input class="entrada num" inputMode="numeric" placeholder="194" value={f.fc_max} onInput={cambiar('fc_max')} /></label>
          <label class="campo"><span class="etq">FC en reposo</span><input class="entrada num" inputMode="numeric" placeholder="52" value={f.fc_reposo} onInput={cambiar('fc_reposo')} /></label>
          <label class="campo"><span class="etq">Ritmo umbral (min/km)</span><input class="entrada num" placeholder="5:10-5:20" value={f.umbral} onInput={cambiar('umbral')} /></label>
          <label class="campo"><span class="etq">Fecha del test</span><input class="entrada" type="date" value={f.test_fecha} onInput={cambiar('test_fecha')} /></label>
          <label class="campo"><span class="etq">Tipo de test</span>
            <select class="selector" value={f.test_tipo} onChange={cambiar('test_tipo')}><option value="">—</option>{TESTS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        </div>
        <details class="carrera-zonas-mano">
          <summary class="peq">Zonas a mano (si no, salen de la FC umbral)</summary>
          <div class="rejilla-campos rejilla-carrera">
            {['z2', 'z3', 'z4', 'z5'].map((k) => <label key={k} class="campo"><span class="etq">Empieza {k.toUpperCase()}</span><input class="entrada num" inputMode="numeric" value={f[k]} onInput={cambiar(k)} /></label>)}
          </div>
        </details>
        <UmbralDesdeCarrera alCalcular={(r) => setF({ ...f, umbral: rangoUmbral(r).map(fmtRitmo).join('-') })} />
        {zonas ? <TablaZonas zonas={zonas} umbral={previa.umbral} /> : <p class="mini terciario">Con la FC umbral (por ejemplo, la FC media de los últimos 20 minutos de un test de 30) salen sus cinco zonas; sin ella, con la FC máxima y la de reposo. Con el ritmo umbral, también el ritmo de cada zona.</p>}
        {fuente === 'reserva' && <p class="mini terciario">Zonas por la FC de reserva (Karvonen: 60, 70, 80 y 90 %). Con su FC umbral serían más precisas.</p>}
        <button class="btn btn-primario" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar zonas'}</button>
      </form>
      {p.test_fecha && <p class="mini terciario">Test del {fmtConDia(p.test_fecha)}{p.test_tipo ? ` (${NOMBRE_TEST[p.test_tipo].toLowerCase()})` : ''}.</p>}
    </section>
  );
}
// (v0.219) El ritmo umbral desde una carrera reciente (o el test de 30 minutos): el que aguantaría unos 60 minutos
const DISTANCIAS_UMBRAL = [['5', '5 km'], ['10', '10 km'], ['21.0975', 'Media maratón'], ['42.195', 'Maratón'], ['test', 'Test de 30 min (ritmo de los últimos 20)']];
function UmbralDesdeCarrera({ alCalcular }) {
  const [abierta, setAbierta] = useState(false);
  const [d, setD] = useState('10');
  const [t, setT] = useState('');
  const seg = d === 'test' ? leerRitmo(t) : leerTiempo(t);
  const r = d === 'test' ? seg : seg ? umbralDesdeCarrera(seg, Number(d)) : null;
  if (!abierta) return <button type="button" class="btn-texto mini" style="justify-self:start" onClick={() => setAbierta(true)}><Icono n="calculadora" width="14" height="14" /> Calcular el ritmo umbral desde una carrera</button>;
  return (
    <div class="umbral-carrera panel-sub pila-s">
      <div class="rejilla-campos rejilla-carrera">
        <label class="campo"><span class="etq">Carrera reciente</span>
          <select class="selector" value={d} onChange={(e) => { setD(e.currentTarget.value); setT(''); }}>{DISTANCIAS_UMBRAL.map(([k, x]) => <option key={k} value={k}>{x}</option>)}</select></label>
        <label class="campo"><span class="etq">{d === 'test' ? 'Ritmo (min/km)' : 'Tiempo'}</span><input class="entrada num" placeholder={d === 'test' ? '5:05' : '48:30'} value={t} onInput={(e) => setT(e.currentTarget.value)} /></label>
      </div>
      {t && !r ? <span class="mini aviso-texto">{d === 'test' ? 'Escribe el ritmo como 5:05.' : 'Escribe el tiempo como 48:30 o 1:45:00.'}</span>
        : r ? <span class="mini">Ritmo umbral de unos <strong class="num">{fmtRitmo(r)} min/km</strong>{d === 'test' ? '' : ' (lo que aguantaría unos 60 minutos, por la fórmula de Riegel)'}.</span> : null}
      <div class="fila-envolver">
        <button type="button" class="btn btn-peq" disabled={!r} onClick={() => { alCalcular(r); setAbierta(false); }}>Usarlo</button>
        <button type="button" class="btn btn-peq plano" onClick={() => setAbierta(false)}>Cancelar</button>
      </div>
    </div>
  );
}
// El plan, tal cual está, para no pisarlo al guardar las zonas (y al revés)
const planDe = (p) => ({ plan_nombre: p.plan_nombre || '', plan_inicio: p.plan_inicio || '', ventanas: v(p.ventanas), nota: p.nota || '', fases: p.fases || [] });
const zonasDe = (p) => ({ lthr: v(p.lthr), fc_max: v(p.fc_max), fc_reposo: v(p.fc_reposo), test_fecha: p.test_fecha || '', test_tipo: p.test_tipo || '',
  umbral: p.umbral ? p.umbral.map(fmtRitmo).join('-') : '', z2: v(p.zonas?.[0]), z3: v(p.zonas?.[1]), z4: v(p.zonas?.[2]), z5: v(p.zonas?.[3]) });

// ---------------------------------------------------------------- el plan: nombre, inicio y macrociclo
function PlanCoach({ atleta, perfil, d, alGuardar }) {
  const { api, aviso } = useApp();
  const [asistente, setAsistente] = useState(false);
  const p = perfil || {};
  const inicial = () => ({ plan_nombre: p.plan_nombre || '', plan_inicio: p.plan_inicio || '', ventanas: v(p.ventanas), nota: p.nota || '',
    fases: (p.fases || []).map((x) => ({ nombre: x.nombre, semanas: String(x.semanas), nota: x.nota || '' })) });
  const [f, setF] = useState(inicial);
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  useEffect(() => setF(inicial()), [perfil?.actualizado_en]);
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const cambiarFase = (i, k) => (e) => setF({ ...f, fases: f.fases.map((x, j) => (j === i ? { ...x, [k]: e.currentTarget.value } : x)) });
  const total = f.fases.reduce((a, x) => a + (Number(x.semanas) || 0), 0);
  const guardar = (e) => {
    e.preventDefault();
    una(async () => {
      try {
        await api.guardarCarreraPerfil(atleta.id, { ...zonasDe(p), ...f });
        setError(null); aviso('Plan guardado'); alGuardar();
      } catch (err) { setError(err.message); }
    });
  };
  return (
    <section class="panel panel-pad pila carrera-plan" aria-labelledby="cp-titulo">
      <div class="fila-envolver" style="justify-content:space-between">
        <h2 id="cp-titulo" class="h-panel">El plan</h2>
        <button type="button" class="btn btn-peq asis-abrir" onClick={() => setAsistente(true)} aria-haspopup="dialog"><Icono n="estrella" /> Prepararlo con el asistente</button>
      </div>
      {!semanasPlan(perfil) && <p class="peq secundario">Dile la carrera, los días que puede correr, lo que corre ahora y su nivel, y la app te propone todas las semanas con sus kilómetros y sus sesiones. Tú lo revisas y lo cambias a tu gusto.</p>}
      {asistente && <HojaAsistente atleta={atleta} d={d} alCerrar={(cambio) => { setAsistente(false); if (cambio) alGuardar(); }} />}
      <Macrociclo perfil={perfil} />
      <form class="pila" onSubmit={guardar}>
        {error && <div class="error" role="alert">{error}</div>}
        <div class="rejilla-campos">
          <label class="campo"><span class="etq">Nombre del plan</span><input class="entrada" maxLength={80} placeholder="Media maratón de primavera" value={f.plan_nombre} onInput={cambiar('plan_nombre')} /></label>
          <label class="campo"><span class="etq">Empieza el lunes</span><input class="entrada" type="date" value={f.plan_inicio} onInput={cambiar('plan_inicio')} /></label>
          <label class="campo"><span class="etq">Sesiones de carrera por semana</span>
            <select class="selector" value={f.ventanas} onChange={cambiar('ventanas')}><option value="">—</option>{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        </div>
        <fieldset class="carrera-fases pila-s">
          <legend class="peq">Fases del macrociclo{total ? ` · ${total} semanas` : ''}</legend>
          {f.fases.map((x, i) => (
            <div key={i} class="carrera-fase-fila">
              <input class="entrada" aria-label={`Fase ${i + 1}: nombre`} maxLength={30} placeholder="Base" value={x.nombre} onInput={cambiarFase(i, 'nombre')} />
              <input class="entrada num" aria-label={`Fase ${i + 1}: semanas`} inputMode="numeric" placeholder="4" value={x.semanas} onInput={cambiarFase(i, 'semanas')} />
              <input class="entrada" aria-label={`Fase ${i + 1}: nota`} maxLength={200} placeholder="Qué se busca" value={x.nota} onInput={cambiarFase(i, 'nota')} />
              <button type="button" class="btn btn-icono plano btn-peligro" aria-label={`Quitar la fase ${i + 1}`} onClick={() => setF({ ...f, fases: f.fases.filter((_, j) => j !== i) })}><Icono n="basura" /></button>
            </div>
          ))}
          {f.fases.length < 12 && <button type="button" class="btn btn-peq" style="justify-self:start" onClick={() => setF({ ...f, fases: [...f.fases, { nombre: '', semanas: '', nota: '' }] })}><Icono n="mas" /> Añadir fase</button>}
        </fieldset>
        <label class="campo"><span class="etq">Cómo se integra con la fuerza (lo ve el atleta)</span>
          <textarea class="area" maxLength={2000} placeholder="Semana A: 2 de pierna y 1 de torso. Semana B: 1 de pierna y 2 de torso. La fuerza manda: si hay que quitar algo, que sea carrera." value={f.nota} onInput={cambiar('nota')} /></label>
        <button class="btn btn-primario" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar el plan'}</button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------- avisos y ajuste (v0.222)
// Los avisos de riesgo (subida brusca, dolor, semáforo, cumplimiento, tirada larga, días duros seguidos) y el ajuste
// propuesto de la semana siguiente, cada uno con su propuesta: un toque para aplicarla a la semana del plan que toca.
// Lo aplicado se recuerda en este dispositivo (para no aplicarlo dos veces).
const CLAVE_APLICADO = 'fbe-carrera-aplicado';
const leerAplicado = () => { try { return JSON.parse(localStorage.getItem(CLAVE_APLICADO) || '{}') || {}; } catch { return {}; } };
const NOMBRE_DECISION_AJ = { seguir: 'Seguir el plan', repetir: 'Repetir el volumen', bajar: 'Bajar un 25 %' };
function AvisosCoach({ atleta, d, alGuardar }) {
  const { api, aviso } = useApp();
  const hoy = hoyISO();
  const avisos = useMemo(() => avisosCarrera({ semanas: d.semanas, hechas: d.hechas, hoy }), [d.semanas, d.hechas]);
  const ajuste = useMemo(() => ajusteSiguiente({ semanas: d.semanas, hechas: d.hechas, hoy }), [d.semanas, d.hechas]);
  const [aplicado, setAplicado] = useState(leerAplicado);
  const [rehacer, setRehacer] = useState(false);
  const [semana, setSemana] = useState(null);
  const [ocupado, una] = useUnaVez();
  if (!avisos.length && !ajuste) return null;
  const marca = (k) => `${atleta.id}:${k}`;
  const recordar = (k) => { const n = { ...leerAplicado(), [marca(k)]: hoy }; try { localStorage.setItem(CLAVE_APLICADO, JSON.stringify(n)); } catch { /* sin almacenamiento */ } setAplicado(n); };
  const delPlan = (lunes) => (d.semanas || []).find((x) => x.lunes === lunes) || null;
  const aplicar = (k, nueva, texto) => una(async () => {
    try { await api.guardarCarreraSemana(atleta.id, nueva); recordar(k); aviso(texto); alGuardar(); } catch (err) { aviso(err.message, 'error'); }
  });
  const lista = semanasConPlan(d.perfil, d.semanas);
  return (
    <section class="panel panel-pad pila-s carrera-avisos" aria-labelledby="cav-titulo">
      <h2 id="cav-titulo" class="h-panel">Avisos y ajuste</h2>
      {avisos.length > 0 && (
        <ul class="cav-lista">
          {avisos.map((a) => {
            const p = a.propuesta;
            const k = `${a.id}:${p?.lunes || ''}`;
            const objetivo = p?.lunes ? delPlan(p.lunes) : null;
            const nueva = objetivo && (p.tipo === 'bajar' || p.tipo === 'tope') ? aplicarPropuesta(p, objetivo) : null;
            return (
              <li key={a.id} class="cav-aviso" data-nivel={a.nivel}>
                <Icono n="alerta" />
                <span class="pila-xs" style="min-width:0">
                  <strong class="peq">{a.titulo}</strong>
                  <span class="mini secundario">{a.texto}</span>
                  {p && <span class="fila-envolver cav-prop">
                    {aplicado[marca(k)] ? <span class="mini terciario"><Icono n="hecho" width="14" height="14" /> Aplicado: {p.texto}</span>
                      : nueva ? <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => aplicar(k, nueva, `Aplicado: ${p.texto}`)}>{p.texto}</button>
                        : p.tipo === 'rehacer' ? <button type="button" class="btn btn-peq" onClick={() => setRehacer(true)} aria-haspopup="dialog"><Icono n="rehacer" /> {p.texto}</button>
                          : p.tipo === 'mover' && objetivo ? <button type="button" class="btn btn-peq" onClick={() => setSemana({ ...objetivo, ...(lista.find((x) => x.lunes === objetivo.lunes) || {}) })} aria-haspopup="dialog">Abrir la semana para separarlas</button>
                            : <span class="mini"><strong>{p.texto}</strong></span>}
                  </span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {ajuste && (
        <div class="cav-ajuste panel-sub pila-xs" data-decision={ajuste.decision}>
          <span class="peq"><strong>La semana del {fmtCorta(ajuste.lunes)}: {NOMBRE_DECISION_AJ[ajuste.decision]}</strong></span>
          <span class="mini secundario">Con lo de la semana del {fmtCorta(ajuste.evaluada)}: {ajuste.motivo.charAt(0).toLowerCase() + ajuste.motivo.slice(1)}.</span>
          {(ajuste.nueva || aplicado[marca(`ajuste:${ajuste.lunes}`)]) && (aplicado[marca(`ajuste:${ajuste.lunes}`)]
            ? <span class="mini terciario"><Icono n="hecho" width="14" height="14" /> Aplicado</span>
            : <button type="button" class="btn btn-peq" style="justify-self:start" disabled={ocupado} onClick={() => aplicar(`ajuste:${ajuste.lunes}`, ajuste.nueva, `Semana del ${fmtCorta(ajuste.lunes)}: ${NOMBRE_DECISION_AJ[ajuste.decision].toLowerCase()}`)}>
              Aplicar ({textoKm(ajuste.nueva.km_min, ajuste.nueva.km_max) || 'sus sesiones'})</button>)}
        </div>
      )}
      {rehacer && <HojaAsistente atleta={atleta} d={d} modo="rehacer" alCerrar={(cambio) => { setRehacer(false); if (cambio) { recordar(`cumplimiento:`); alGuardar(); } }} />}
      {semana && <HojaSemana atleta={atleta} semana={semana} perfil={d.perfil} lista={lista} alCerrar={(cambio) => { setSemana(null); if (cambio) alGuardar(); }} />}
    </section>
  );
}

// El panel de corredores (v0.222, mejora 12): en Atletas, todos los que corren de un vistazo (lo de esta semana frente al
// plan, los semáforos, la próxima carrera y los avisos). Un toque abre su pestaña Carrera.
export function CorredoresPanel({ abrir }) {
  const { api } = useApp();
  const datos = useCarga(() => api.panelCorredores().catch(() => []), []);
  const lista = datos.datos || [];
  if (!lista.length) return null;
  const conAvisos = lista.filter((c) => c.avisos.length).length;
  return (
    <details class="panel panel-pad corr-panel" open={conAvisos > 0}>
      <summary class="corr-cab"><Icono n="pasos" /> <strong>Corredores</strong> <span class="mini terciario num">{lista.length}</span>
        {conAvisos > 0 && <span class="chip corr-chip">{conAvisos === 1 ? '1 con avisos' : `${conAvisos} con avisos`}</span>}</summary>
      <ul class="corr-lista">
        {lista.map((c) => (
          <li key={c.atleta.id}>
            <button type="button" class="corr-fila" data-nivel={c.nivel} onClick={() => abrir(c.atleta.id, 'carrera')}>
              <span class="corr-nombre peq">{c.atleta.nombre}</span>
              <span class="mini num corr-km">{num(c.km, c.km % 1 ? 1 : 0)} km{c.plan && textoKm(c.plan.km_min, c.plan.km_max) ? ` de ${textoKm(c.plan.km_min, c.plan.km_max)}` : ''}</span>
              <span class="corr-sem" role="img" aria-label={`Semáforos de esta semana: ${c.semaforos.verde} en verde, ${c.semaforos.ambar} en ámbar, ${c.semaforos.rojo} en rojo`}>
                {['verde', 'ambar', 'rojo'].flatMap((k) => Array.from({ length: c.semaforos[k] }, (_, i) => <i key={`${k}${i}`} data-s={k} />))}
              </span>
              <span class="mini terciario corr-prox">{c.proxima ? `${c.proxima.nombre}: ${textoCuentaAtras(c.proxima.fecha, hoyISO()).toLowerCase()}` : 'Sin carrera a la vista'}</span>
              {c.avisos.length > 0 && <span class="mini corr-avisos">{c.avisos.map((a) => a.titulo).join(' · ')}</span>}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

// ---------------------------------------------------------------- el asistente de plan (v0.221)
// La carrera, los días que puede correr, lo que corre ahora y su nivel → todas las semanas con sus km y sus sesiones, con
// las reglas aprobadas por Pelayo (logica/carrera-plan.js). En modo «rehacer», desde esta semana y sin tocar las de antes,
// con la opción de empezar por la vuelta a correr tras una molestia. Nada se guarda hasta «Guardar el plan».
function HojaAsistente({ atleta, d, modo = 'nuevo', alCerrar }) {
  const { api, aviso } = useApp();
  const hoy = hoyISO();
  const p = d.perfil || {};
  const rehacer = modo === 'rehacer';
  const prio = { A: 0, B: 1, C: 2 };
  const futuras = (d.eventos || []).filter((e) => e.fecha > hoy && e.decision !== 'no' && Number(e.distancia_km) > 0)
    .sort((a, b) => (prio[a.prioridad] ?? 3) - (prio[b.prioridad] ?? 3) || (a.fecha < b.fecha ? -1 : 1));
  const recientes = useMemo(() => kmRecientes(d.hechas || [], hoy), [d.hechas]);
  const [f, setF] = useState(() => ({
    evento: futuras[0]?.id || 'otra', nombre: '', km: '21.0975', fecha: '',
    dias: String(Math.max(2, Math.min(6, Number(p.ventanas) || 3))),
    kmAhora: recientes ? String(Math.round(recientes.media)) : '', larga: recientes ? num(recientes.larga, recientes.larga % 1 ? 1 : 0) : '',
    nivel: 'intermedio', conVuelta: false,
  }));
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const ev = f.evento === 'otra' ? { nombre: f.nombre.trim() || 'La carrera', distancia_km: Number(f.km), fecha: f.fecha } : futuras.find((e) => e.id === f.evento) || null;
  const datos = { evento: ev, dias: Number(f.dias), kmAhora: leerNumero(f.kmAhora) ?? 0, largaAhora: leerNumero(f.larga), nivel: f.nivel, hoy };
  const clave = JSON.stringify([datos, f.conVuelta, modo]);
  const res = useMemo(() => (rehacer ? rehacerDesde(p, { ...datos, desde: lunesDe(hoy), conVuelta: f.conVuelta }) : { plan: proponerPlan(datos) }), [clave]);
  const plan = res.plan;
  const ok = plan && !plan.error;
  const fases = ok ? (rehacer ? res.fases : plan.fases) : [];
  const inicio = ok ? (rehacer ? res.inicio : plan.inicio) : null;
  const desde = ok ? plan.semanas[0].lunes : null;
  const antes = ok && inicio < desde ? Math.round(diasEntre(inicio, desde) / 7) : 0;
  const reemplaza = ok ? (d.semanas || []).filter((s) => s.lunes >= desde).length : 0;
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  const guardar = () => una(async () => {
    try {
      await api.guardarCarreraPerfil(atleta.id, {
        ...zonasDe(p), plan_nombre: rehacer && p.plan_nombre ? p.plan_nombre : String(ev?.nombre || 'Plan de carrera').slice(0, 80),
        plan_inicio: inicio, ventanas: String(plan.dias), nota: p.nota || '', fases: fases.map((x) => ({ nombre: x.nombre, semanas: x.semanas, nota: x.nota || '' })),
      });
      await api.guardarSemanasCarrera(atleta.id, plan.semanas.map(({ fase, ...s }) => s), { borrarDesde: desde });
      aviso(rehacer ? 'Plan rehecho desde esta semana' : 'Plan guardado: revisa y cambia lo que quieras');
      alCerrar(true);
    } catch (err) { setError(err.message); }
  });
  return (
    <Hoja titulo={rehacer ? 'Rehacer el plan desde esta semana' : 'Preparar el plan'} alCerrar={() => alCerrar(false)} ancho={760}>
      <div class="pila asis-hoja">
        {error && <div class="error" role="alert">{error}</div>}
        <p class="peq secundario">{rehacer
          ? 'Las semanas que faltan hasta la carrera, otra vez con las mismas reglas y desde lo que corre ahora. Las de antes no se tocan.'
          : 'La app propone las fases, los kilómetros de cada semana (subiendo poco a poco, con una semana más suave de vez en cuando y el afinado al final) y sus sesiones. Después puedes cambiar cualquier semana.'}</p>
        <div class="rejilla-campos">
          <label class="campo"><span class="etq">La carrera</span>
            <select class="selector" value={f.evento} onChange={cambiar('evento')}>
              {futuras.map((e) => <option key={e.id} value={e.id}>{e.nombre} ({fmtCorta(e.fecha)}, {num(Number(e.distancia_km), Number(e.distancia_km) % 1 ? 1 : 0)} km{e.prioridad ? `, ${e.prioridad}` : ''})</option>)}
              <option value="otra">Otra (escribirla)</option>
            </select></label>
          {f.evento === 'otra' && <>
            <label class="campo"><span class="etq">Nombre</span><input class="entrada" maxLength={60} placeholder="Media de primavera" value={f.nombre} onInput={cambiar('nombre')} /></label>
            <label class="campo"><span class="etq">Distancia</span>
              <select class="selector" value={f.km} onChange={cambiar('km')}>{DISTANCIAS_PLAN.map(([k, t]) => <option key={k} value={String(k)}>{t}</option>)}</select></label>
            <label class="campo"><span class="etq">Fecha</span><input class="entrada" type="date" min={sumarDias(hoy, 1)} value={f.fecha} onInput={cambiar('fecha')} /></label>
          </>}
        </div>
        <div class="campo"><span class="etq">Días que puede correr</span>
          <Segmentos etiqueta="Días que puede correr" valor={f.dias} opciones={['2', '3', '4', '5', '6'].map((x) => [x, x])} alCambiar={(x) => x && setF({ ...f, dias: x })} /></div>
        <div class="pila-xs">
          <div class="rejilla-campos">
            <label class="campo"><span class="etq">Km por semana ahora</span><input class="entrada num" inputMode="decimal" placeholder="20" value={f.kmAhora} onInput={cambiar('kmAhora')} aria-describedby="asis-km-ayuda" /></label>
            <label class="campo"><span class="etq">Su salida más larga reciente (km)</span><input class="entrada num" inputMode="decimal" placeholder="12" value={f.larga} onInput={cambiar('larga')} /></label>
          </div>
          <span class="ayuda" id="asis-km-ayuda">{recientes ? `Lo que ha apuntado las 4 últimas semanas: ${num(recientes.media, recientes.media % 1 ? 1 : 0)} km de media.` : 'Sin carreras apuntadas en las 4 últimas semanas: pon lo que te diga.'}</span>
        </div>
        <div class="campo"><span class="etq">Su nivel</span>
          <Segmentos etiqueta="Su nivel" valor={f.nivel} opciones={NIVELES_PLAN} alCambiar={(x) => x && setF({ ...f, nivel: x })} />
          <span class="ayuda">Empieza: sube un 5 % por semana; intermedio, un 7,5 %; avanzado, un 10 % (y más kilómetros en el pico).</span></div>
        {rehacer && <label class="campo campo-check"><input type="checkbox" checked={f.conVuelta} onChange={(e) => setF({ ...f, conVuelta: e.currentTarget.checked })} />
          <span class="peq">Empezar con la vuelta a correr tras una molestia (de andar 30 minutos a 20-30 minutos seguidos, sin dolor)</span></label>}
        <section class="asis-res panel-sub pila-s" aria-live="polite" aria-label="El plan que propone">
          {!ok ? <p class="peq secundario">{plan?.error || 'Elige la carrera.'}</p> : <>
            <p class="peq"><strong>{plan.semanas.length} {plan.semanas.length === 1 ? 'semana' : 'semanas'}</strong>, del {fmtCorta(desde)} a la de la carrera ({fmtConDia(ev.fecha)}){antes ? `, después de las ${antes} que ya lleva` : ''}.</p>
            <Macrociclo perfil={{ plan_inicio: inicio, fases }} hoy={hoy} />
            {plan.avisos.map((a) => <p key={a} class="asis-aviso peq"><Icono n="alerta" /> {a}</p>)}
            <details class="asis-semanas">
              <summary class="peq">Ver las {plan.semanas.length} semanas</summary>
              <ol class="asis-lista">
                {plan.semanas.map((s, i) => (
                  <li key={s.lunes}>
                    <span class="num asis-n">S{antes + i + 1}</span>
                    <span class="pila-xs" style="min-width:0"><span class="peq"><strong>{fmtCorta(s.lunes)}</strong> · {s.fase}{s.etiqueta && s.etiqueta !== s.fase ? <span class="chip etiqueta-carrera">{s.etiqueta}</span> : null}</span>
                      <span class="mini terciario">{textoSemanaPlan(s)}</span></span>
                  </li>
                ))}
              </ol>
            </details>
            {reemplaza > 0 && <p class="mini secundario">Ya tiene {reemplaza === 1 ? 'una semana puesta' : `${reemplaza} semanas puestas`} desde el {fmtCorta(desde)}: {reemplaza === 1 ? 'se cambia' : 'se cambian'} por {reemplaza === 1 ? 'esta' : 'estas'}.</p>}
          </>}
        </section>
        <div class="fila-envolver">
          <button type="button" class="btn btn-primario" disabled={!ok || ocupado} onClick={guardar}>{ocupado ? 'Guardando…' : rehacer ? 'Guardar desde esta semana' : 'Guardar el plan'}</button>
          <button type="button" class="btn" onClick={() => alCerrar(false)}>Cancelar</button>
        </div>
      </div>
    </Hoja>
  );
}

// ---------------------------------------------------------------- las semanas del plan
function SemanasCoach({ atleta, d, alGuardar }) {
  const [editar, setEditar] = useState(null); // { lunes, ...semana }
  const [rehacer, setRehacer] = useState(false);
  const hoy = hoyISO();
  const lista = semanasConPlan(d.perfil, d.semanas);
  const hecho = useMemo(() => carreraHechaPorSemana(d.hechas || []), [d.hechas]);
  const lunesHoy = lunesDe(hoy);
  return (
    <section class="panel panel-pad pila carrera-semanas" aria-labelledby="cs-titulo">
      <div class="fila-envolver" style="justify-content:space-between">
        <h2 id="cs-titulo" class="h-panel">Semanas</h2>
        <span class="fila-envolver">
          {semanasPlan(d.perfil) > 0 && <button type="button" class="btn btn-peq asis-rehacer" onClick={() => setRehacer(true)} aria-haspopup="dialog"><Icono n="rehacer" /> Rehacer desde esta semana</button>}
          <button class="btn btn-peq" onClick={() => setEditar({ lunes: lunesHoy, sesiones: [] })}><Icono n="mas" /> Semana suelta</button>
        </span>
      </div>
      {rehacer && <HojaAsistente atleta={atleta} d={d} modo="rehacer" alCerrar={(cambio) => { setRehacer(false); if (cambio) alGuardar(); }} />}
      {!lista.length ? <p class="peq secundario">Pon el lunes de inicio y las fases del plan para ver sus semanas, o añade una semana suelta.</p> : (
        <ol class="lista-semanas-carrera">
          {lista.map((s) => {
            const h = hecho[s.lunes];
            const est = estadoKm(h, s);
            return (
              <li key={s.lunes} class={`semana-carrera${s.lunes === lunesHoy ? ' actual' : ''}${s.lunes < lunesHoy ? ' pasada' : ''}`}>
                <button type="button" class="semana-carrera-btn" onClick={() => setEditar(s)} aria-label={`Editar la semana del ${fmtCorta(s.lunes)}`}>
                  <span class="semana-carrera-n num">{s.n ? `S${s.n}` : '·'}</span>
                  <span class="pila-xs" style="min-width:0">
                    <span class="peq"><strong>{fmtCorta(s.lunes)}</strong>{s.fase ? ` · ${s.fase}` : ''}{s.etiqueta ? <span class="chip etiqueta-carrera">{s.etiqueta}</span> : null}{s.ab ? <span class="chip">Fuerza {s.ab}</span> : null}</span>
                    <span class="mini terciario">{[textoKm(s.km_min, s.km_max), (s.sesiones || []).map((x) => `${x.dia ? DIA_CORTO[x.dia] + ' ' : ''}${x.titulo || NOMBRE_TIPO[x.tipo]}`).join(' · ')].filter(Boolean).join(' — ') || 'Sin preparar'}</span>
                    {s.clave && <span class="mini secundario">{s.clave}</span>}
                  </span>
                  {h && <span class={`chip num km-${est || 'ninguno'}`}>{num(h.km, h.km % 1 ? 1 : 0)} km hechos</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {editar && <HojaSemana atleta={atleta} semana={editar} perfil={d.perfil} lista={lista} alCerrar={(cambio) => { setEditar(null); if (cambio) alGuardar(); }} />}
    </section>
  );
}

function HojaSemana({ atleta, semana, perfil, lista = [], alCerrar }) {
  const { api, aviso } = useApp();
  // (v0.221) La semana anterior del plan (con algo puesto), para copiarla con un 5 o un 10 % más; y repetir esta en las siguientes
  const anterior = [...lista].reverse().find((x) => x.lunes < semana.lunes && ((x.sesiones || []).length || x.km_min != null)) || null;
  const [repetir, setRepetir] = useState('1');
  const [f, setF] = useState({ lunes: semana.lunes, etiqueta: semana.etiqueta || '', km_min: v(semana.km_min), km_max: v(semana.km_max), ab: semana.ab || null, clave: semana.clave || '', nota: semana.nota || '' });
  // Cada sesión con una clave fija (para que al quitar una, las demás no hereden sus campos)
  const [filas, setFilas] = useState(() => (semana.sesiones || []).map((x) => ({ k: claveNueva(), s: { ...x } })));
  const sesiones = filas.map((x) => x.s);
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const zonas = zonasVer(perfil);
  const existe = !!semana.actualizado_en;
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  return (
    <Hoja titulo={`Semana del ${fmtCorta(semana.lunes)}${semana.n ? ` (S${semana.n})` : ''}`} alCerrar={() => alCerrar(false)}>
      <form class="pila" onSubmit={(e) => {
        e.preventDefault();
        una(async () => {
          try { await api.guardarCarreraSemana(atleta.id, { ...f, sesiones }); aviso('Semana guardada'); alCerrar(true); } catch (err) { setError(err.message); }
        });
      }}>
        {error && <div class="error" role="alert">{error}</div>}
        {!semana.n && <label class="campo"><span class="etq">Lunes</span><input class="entrada" type="date" value={f.lunes} onInput={(e) => setF({ ...f, lunes: lunesDe(e.currentTarget.value) || f.lunes })} /></label>}
        <div class="rejilla-campos rejilla-carrera">
          <label class="campo"><span class="etq">Etiqueta</span><input class="entrada" maxLength={24} placeholder="Descarga, pico, test…" value={f.etiqueta} onInput={cambiar('etiqueta')} /></label>
          <label class="campo"><span class="etq">Km (mínimo)</span><input class="entrada num" inputMode="decimal" placeholder="18" value={f.km_min} onInput={cambiar('km_min')} /></label>
          <label class="campo"><span class="etq">Km (máximo)</span><input class="entrada num" inputMode="decimal" placeholder="22" value={f.km_max} onInput={cambiar('km_max')} /></label>
        </div>
        <div class="campo"><span class="etq">Semana de fuerza</span>
          <Segmentos etiqueta="Semana de fuerza" valor={f.ab} opciones={[['A', 'A'], ['B', 'B']]} alCambiar={(x) => setF({ ...f, ab: x === f.ab ? null : x })} />
          <span class="ayuda">Si alternas semanas de fuerza (por ejemplo, A con más pierna y B con más torso).</span></div>
        <label class="campo"><span class="etq">La clave de la semana</span><input class="entrada" maxLength={300} placeholder="Que la calidad salga controlada: mejor quedarse corto" value={f.clave} onInput={cambiar('clave')} /></label>
        <label class="campo"><span class="etq">Nota</span><input class="entrada" maxLength={500} value={f.nota} onInput={cambiar('nota')} /></label>
        {anterior && (
          <div class="asis-copiar fila-envolver" role="group" aria-label="Copiar la semana anterior">
            <span class="peq">Como la del {fmtCorta(anterior.lunes)}:</span>
            {[0, 5, 10].map((pct) => (
              <button key={pct} type="button" class="btn btn-peq" onClick={() => {
                const c = progresarSemana(anterior, pct);
                setF({ ...f, etiqueta: f.etiqueta || '', km_min: v(c.km_min), km_max: v(c.km_max), clave: f.clave || c.clave || '', ab: f.ab || c.ab || null });
                setFilas(c.sesiones.map((x) => ({ k: claveNueva(), s: x })));
              }}><Icono n="duplicar" /> {pct ? `Un ${pct} % más` : 'Igual'}</button>
            ))}
          </div>
        )}
        <fieldset class="carrera-fases pila-s">
          <legend class="peq">Sesiones de carrera ({sesiones.length} de 7)</legend>
          {filas.map(({ k, s }, i) => <SesionPlan key={k} s={s} i={i} zonas={zonas} alCambiar={(n) => setFilas((fs) => fs.map((x) => (x.k === k ? { k, s: n } : x)))} alQuitar={() => setFilas((fs) => fs.filter((x) => x.k !== k))} />)}
          {sesiones.length < 7 && <div class="fila-envolver">
            <button type="button" class="btn btn-peq" onClick={() => setFilas([...filas, { k: claveNueva(), s: { tipo: 'facil', titulo: 'Fácil' } }])}><Icono n="mas" /> Sesión</button>
            <button type="button" class="btn btn-peq plano" onClick={() => setFilas([...filas, { k: claveNueva(), s: { tipo: 'descanso', titulo: 'Descanso' } }])}>Descanso</button>
          </div>}
        </fieldset>
        <div class="fila-envolver">
          <button class="btn btn-primario" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar la semana'}</button>
          {existe && <button type="button" class="btn btn-peligro plano" disabled={ocupado} onClick={() => una(async () => {
            try { await api.borrarCarreraSemana(atleta.id, semana.lunes); aviso('Semana vaciada'); alCerrar(true); } catch (err) { setError(err.message); }
          })}>Vaciar la semana</button>}
        </div>
        {sesiones.length > 0 && (
          <div class="asis-repetir fila-envolver">
            <span class="peq">Repetir esta semana en</span>
            <select class="selector selector-peq" aria-label="Cuántas semanas siguientes" value={repetir} onChange={(e) => setRepetir(e.currentTarget.value)}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 1 ? 'la siguiente' : `las ${n} siguientes`}</option>)}
            </select>
            <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => una(async () => {
              try {
                const base = { ...f, sesiones };
                const copias = Array.from({ length: Number(repetir) }, (_, i) => ({ ...progresarSemana(base, 0), lunes: sumarDias(semana.lunes, 7 * (i + 1)) }));
                await api.guardarSemanasCarrera(atleta.id, [{ ...base, lunes: semana.lunes }, ...copias]);
                aviso(Number(repetir) === 1 ? 'Semana guardada y repetida en la siguiente' : `Semana guardada y repetida en las ${repetir} siguientes`);
                alCerrar(true);
              } catch (err) { setError(err.message); }
            })}><Icono n="duplicar" /> Guardar y repetir</button>
            <span class="mini terciario">Si alguna ya tenía algo, se cambia por esta.</span>
          </div>
        )}
      </form>
    </Hoja>
  );
}

// Una sesión prevista en la semana del plan: tipo, título, día, volumen (con rango), zona, partes y nota
function SesionPlan({ s, i, zonas, alCambiar, alQuitar }) {
  const descanso = s.tipo === 'descanso';
  const [txt, setTxt] = useState({ minutos: v(s.minutos), minutos_max: v(s.minutos_max), km: v(s.km), km_max: v(s.km_max) });
  // Si cambian desde fuera (una receta, pasar a descanso), los campos se ponen al día; lo que se está escribiendo, no
  useEffect(() => {
    const num = (t) => { const x = Number(String(t).replace(',', '.')); return String(t).trim() === '' || !Number.isFinite(x) || x <= 0 ? undefined : x; };
    setTxt((t) => {
      const n = { ...t };
      for (const k of ['minutos', 'minutos_max', 'km', 'km_max']) if (num(t[k]) !== s[k] && !(num(t[k]) != null && s[k] != null && Math.abs(num(t[k]) - s[k]) < 0.01)) n[k] = v(s[k]);
      return n;
    });
  }, [s.minutos, s.minutos_max, s.km, s.km_max]);
  const fijar = (cambios) => {
    const n = { ...s, ...cambios };
    for (const k of Object.keys(n)) if (n[k] === '' || n[k] == null || (Array.isArray(n[k]) && !n[k].length)) delete n[k];
    if (n.tipo === 'descanso') for (const k of Object.keys(n)) if (!['tipo', 'titulo', 'dia', 'nota'].includes(k)) delete n[k];
    alCambiar(n);
  };
  const numero = (k, dec = false) => (e) => {
    const t = e.currentTarget.value;
    setTxt({ ...txt, [k]: t });
    const x = Number(String(t).replace(',', '.'));
    fijar({ [k]: t.trim() === '' || !Number.isFinite(x) || x <= 0 ? null : dec ? Math.round(x * 100) / 100 : Math.round(x) });
  };
  return (
    <div class="sesion-plan panel-sub pila-s" data-tipo={s.tipo}>
      <div class="sesion-plan-cab">
        <select class="selector" aria-label={`Sesión ${i + 1}: tipo`} value={s.tipo} onChange={(e) => fijar({ tipo: e.currentTarget.value })}>
          {TIPOS_CARRERA.map(([k, t]) => <option key={k} value={k}>{t}</option>)}<option value="descanso">Descanso</option>
        </select>
        <input class="entrada" aria-label={`Sesión ${i + 1}: título`} maxLength={60} placeholder="Título" value={s.titulo || ''} onInput={(e) => fijar({ titulo: e.currentTarget.value.slice(0, 60) })} />
        <select class="selector" aria-label={`Sesión ${i + 1}: día`} value={v(s.dia)} onChange={(e) => fijar({ dia: e.currentTarget.value ? Number(e.currentTarget.value) : null })}>
          <option value="">Día libre</option>{DIAS.map(([n, t]) => <option key={n} value={n}>{t}</option>)}
        </select>
        <button type="button" class="btn btn-icono plano btn-peligro" aria-label={`Quitar la sesión ${i + 1}`} onClick={alQuitar}><Icono n="basura" /></button>
      </div>
      {!descanso && <div class="sesion-plan-vol">
        <label class="campo"><span class="etq">Min</span><input class="entrada num" inputMode="numeric" value={txt.minutos} onInput={numero('minutos')} /></label>
        <label class="campo"><span class="etq">Hasta min</span><input class="entrada num" inputMode="numeric" value={txt.minutos_max} onInput={numero('minutos_max')} /></label>
        <label class="campo"><span class="etq">Km</span><input class="entrada num" inputMode="decimal" value={txt.km} onInput={numero('km', true)} /></label>
        <label class="campo"><span class="etq">Hasta km</span><input class="entrada num" inputMode="decimal" value={txt.km_max} onInput={numero('km_max', true)} /></label>
        <label class="campo"><span class="etq">Zona</span>
          <select class="selector" value={v(s.zona)} onChange={(e) => fijar({ zona: e.currentTarget.value ? Number(e.currentTarget.value) : null, zona_hasta: null })}><option value="">—</option>{[1, 2, 3, 4, 5].map((z) => <option key={z} value={z}>Z{z}</option>)}</select></label>
        <label class="campo campo-check"><input type="checkbox" checked={!!s.opcional} onChange={(e) => fijar({ opcional: e.currentTarget.checked || null })} /> <span class="peq">Opcional</span></label>
      </div>}
      {!descanso && <PartesEditor partes={s.partes || []} zonas={zonas} alCambiar={(partes) => fijar({ partes })} compacto
        alReceta={(r) => { const p = pautaDeReceta(r); if (p) { setTxt({ ...txt, minutos: v(p.minutos), minutos_max: v(p.minutos_max) }); fijar({ tipo: p.tipo || s.tipo, minutos: p.minutos ?? null, minutos_max: p.minutos_max ?? null, zona: p.zona ?? null, zona_hasta: p.zona_hasta ?? null, partes: p.partes, titulo: s.titulo && s.titulo !== 'Fácil' ? s.titulo : r.nombre.slice(0, 60) }); } }} />}
      <input class="entrada" aria-label={`Sesión ${i + 1}: nota`} maxLength={300} placeholder="Nota" value={s.nota || ''} onInput={(e) => fijar({ nota: e.currentTarget.value.slice(0, 300) })} />
      {!descanso && (s.minutos || s.km || s.partes) ? <span class="mini terciario">{textoCardio({ modalidad: 'carrera', ...Object.fromEntries(Object.entries(s).filter(([k]) => !['titulo', 'dia'].includes(k))) })}</span> : null}
    </div>
  );
}

// ---------------------------------------------------------------- las partes de una sesión (también en el editor)
// partes: las ya limpias; alCambiar(partes limpias) solo cuando todas están bien. alReceta(receta): «Desde la biblioteca».
export function PartesEditor({ partes = [], zonas = null, alCambiar, alReceta = null, alGuardarReceta = null, compacto = false }) {
  const { api } = useApp();
  const [filas, setFilas] = useState(() => partes.map(parteAEditor));
  const [errores, setErrores] = useState({});
  const [abierta, setAbierta] = useState(partes.length > 0 && !compacto);
  const [recetas, setRecetas] = useState(null);
  const clave = JSON.stringify(partes);
  useEffect(() => { setFilas(partes.map(parteAEditor)); setErrores({}); }, [clave]);
  const enviar = (nuevas) => {
    const vacia = (p) => !['reps', 'min', 'seg', 'm', 'zona', 'zona_hasta', 'ritmo', 'rec_min', 'rec_seg', 'rec', 'nota'].some((k) => String(p[k] ?? '').trim());
    const res = nuevas.map((p) => (vacia(p) ? { parte: null, error: null, vacia: true } : limpiarParte(p)));
    const err = Object.fromEntries(res.map((r, i) => [i, r.error]).filter(([, e]) => e));
    setErrores(err);
    if (Object.keys(err).length) return;
    alCambiar(res.filter((r) => !r.vacia).map((r) => r.parte));
  };
  const cambiar = (i, k) => (e) => { const n = filas.map((x, j) => (j === i ? { ...x, [k]: e.currentTarget.value } : x)); setFilas(n); };
  const cambiarYEnviar = (i, k) => (e) => { const n = filas.map((x, j) => (j === i ? { ...x, [k]: e.currentTarget.value } : x)); setFilas(n); enviar(n); };
  const cargarRecetas = async () => { if (recetas) return; try { setRecetas(await api.carreraRecetas()); } catch { setRecetas([]); } };
  if (!abierta) return (
    <div class="fila-envolver partes-cerradas">
      <button type="button" class="btn-texto mini" onClick={() => setAbierta(true)}><Icono n="intervalos" width="14" height="14" /> {partes.length ? `Partes (${partes.length})` : 'Partes: calentar, bloque, enfriar'}</button>
      {partes.length > 0 && <span class="mini terciario">{partes.map((p) => textoParte(p)).join(' + ')}</span>}
    </div>
  );
  return (
    <div class="partes-editor pila-s">
      {filas.map((p, i) => (
        <div key={i} class="parte-fila" data-fase={p.fase}>
          <div class="parte-fila-cab">
            <select class="selector" aria-label={`Parte ${i + 1}: fase`} value={p.fase} onChange={cambiarYEnviar(i, 'fase')}>{FASES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
            <span class="mini terciario parte-resumen">{errores[i] ? '' : textoParte(limpiarParte(p).parte, zonas)}</span>
            <button type="button" class="btn btn-icono plano" aria-label={`Subir la parte ${i + 1}`} disabled={i === 0} onClick={() => { const n = [...filas]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setFilas(n); enviar(n); }}><Icono n="arriba" /></button>
            <button type="button" class="btn btn-icono plano btn-peligro" aria-label={`Quitar la parte ${i + 1}`} onClick={() => { const n = filas.filter((_, j) => j !== i); setFilas(n); enviar(n); }}><Icono n="basura" /></button>
          </div>
          <div class="parte-campos">
            <label class="campo"><span class="etq">Reps</span><input class="entrada num" inputMode="numeric" placeholder="1" value={p.reps} onInput={cambiar(i, 'reps')} onBlur={() => enviar(filas)} /></label>
            <label class="campo"><span class="etq">Min</span><input class="entrada num" inputMode="numeric" value={p.min} onInput={cambiar(i, 'min')} onBlur={() => enviar(filas)} /></label>
            <label class="campo"><span class="etq">Seg</span><input class="entrada num" inputMode="numeric" value={p.seg} onInput={cambiar(i, 'seg')} onBlur={() => enviar(filas)} /></label>
            <label class="campo"><span class="etq">Metros</span><input class="entrada num" inputMode="numeric" value={p.m} onInput={cambiar(i, 'm')} onBlur={() => enviar(filas)} /></label>
            <label class="campo"><span class="etq">Zona</span>
              <select class="selector" value={p.zona} onChange={cambiarYEnviar(i, 'zona')}><option value="">—</option>{[1, 2, 3, 4, 5].map((z) => <option key={z} value={z}>Z{z}</option>)}</select></label>
            <label class="campo"><span class="etq">hasta</span>
              <select class="selector" value={p.zona_hasta} onChange={cambiarYEnviar(i, 'zona_hasta')}><option value="">—</option>{[2, 3, 4, 5].map((z) => <option key={z} value={z}>Z{z}</option>)}</select></label>
            <label class="campo"><span class="etq">Ritmo</span><input class="entrada num" placeholder="5:10-5:20" value={p.ritmo} onInput={cambiar(i, 'ritmo')} onBlur={() => enviar(filas)} /></label>
            <label class="campo"><span class="etq">Rec. min</span><input class="entrada num" inputMode="numeric" value={p.rec_min} onInput={cambiar(i, 'rec_min')} onBlur={() => enviar(filas)} /></label>
            <label class="campo"><span class="etq">Rec. seg</span><input class="entrada num" inputMode="numeric" value={p.rec_seg} onInput={cambiar(i, 'rec_seg')} onBlur={() => enviar(filas)} /></label>
            <label class="campo"><span class="etq">Cómo recupera</span><input class="entrada" maxLength={40} placeholder="trote suave" value={p.rec} onInput={cambiar(i, 'rec')} onBlur={() => enviar(filas)} /></label>
          </div>
          <input class="entrada" aria-label={`Parte ${i + 1}: nota`} maxLength={200} placeholder="Nota de esta parte" value={p.nota} onInput={cambiar(i, 'nota')} onBlur={() => enviar(filas)} />
          {errores[i] && <span class="error-campo">{errores[i]}</span>}
        </div>
      ))}
      <div class="fila-envolver">
        {filas.length < 12 && <button type="button" class="btn btn-peq" onClick={() => setFilas([...filas, parteAEditor({ fase: filas.length ? 'bloque' : 'calentar' })])}><Icono n="mas" /> Parte</button>}
        {alReceta && <label class="campo campo-en-linea"><span class="sr">Desde la biblioteca</span>
          <select class="selector" value="" onFocus={cargarRecetas} onPointerDown={cargarRecetas} onChange={(e) => { const id = e.currentTarget.value; const r = (recetas || []).find((x) => x.id === id) || BIBLIOTECA_FBE.find((x) => x.id === id); if (r) alReceta(r); }}>
            <option value="">Desde la biblioteca…</option>
            {(recetas || []).length > 0 && <optgroup label="Las tuyas">{recetas.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</optgroup>}
            {/* (v0.219) la biblioteca FBE, lista para usar */}
            <optgroup label="Biblioteca FBE">{BIBLIOTECA_FBE.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</optgroup>
          </select></label>}
        {alGuardarReceta && partes.length > 0 && <button type="button" class="btn btn-peq plano" onClick={alGuardarReceta}><Icono n="guardar" /> Guardar en la biblioteca</button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- sus carreras
function CarrerasCoach({ atleta, eventos, alGuardar }) {
  const [editar, setEditar] = useState(null);
  const hoy = hoyISO();
  return (
    <section class="panel panel-pad pila carrera-eventos" aria-labelledby="ce-titulo">
      <div class="fila-envolver" style="justify-content:space-between">
        <h2 id="ce-titulo" class="h-panel">Carreras</h2>
        <button class="btn btn-peq" onClick={() => setEditar({})}><Icono n="mas" /> Carrera</button>
      </div>
      {!eventos.length ? <p class="peq secundario">Añade su carrera objetivo (A) y las de preparación (B y C), con si va o no.</p> : (
        <ul class="lista-eventos">
          {eventos.map((e) => (
            <li key={e.id} class={`evento-carrera${e.fecha < hoy ? ' pasada' : ''}`} data-decision={e.decision}>
              <button type="button" class="evento-btn" onClick={() => setEditar(e)} aria-label={`Editar ${e.nombre}`}>
                <span class="evento-prio" data-prio={e.prioridad}>{e.prioridad}</span>
                <span class="pila-xs" style="min-width:0">
                  <strong>{e.nombre}</strong>
                  <span class="peq secundario">{fmtConDia(e.fecha)}{e.fecha >= hoy ? ` · ${textoCuentaAtras(e.fecha, hoy)}` : ''}</span>
                  <span class="mini terciario num">{[textoObjetivoCarrera(e), e.resultado_seg ? `hizo ${textoResultado(e)}` : ''].filter(Boolean).join(' · ')}</span>
                  {e.nota && <span class="mini secundario">{e.nota}</span>}
                </span>
                <span class={`chip decision-${e.decision}`}>{NOMBRE_DECISION[e.decision]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {editar && <HojaEvento atleta={atleta} evento={editar} eventos={eventos} alCerrar={(c) => { setEditar(null); if (c) alGuardar(); }} />}
    </section>
  );
}

function HojaEvento({ atleta, evento, eventos = [], alCerrar }) {
  const { api, aviso } = useApp();
  const e0 = evento || {};
  const [f, setF] = useState({ nombre: e0.nombre || '', fecha: e0.fecha || '', distancia_km: v(e0.distancia_km), desnivel_m: v(e0.desnivel_m), prioridad: e0.prioridad || 'B', decision: e0.decision || 'va',
    objetivo: e0.objetivo_seg ? fmtTiempo(e0.objetivo_seg) : '', objetivo_ritmo: e0.objetivo_ritmo ? fmtRitmo(e0.objetivo_ritmo) : '', nota: e0.nota || '',
    resultado: e0.resultado_seg ? fmtTiempo(e0.resultado_seg) : '', resultado_nota: e0.resultado_nota || '' });
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  return (
    <Hoja titulo={e0.id ? e0.nombre : 'Nueva carrera'} alCerrar={() => alCerrar(false)}>
      <form class="pila" onSubmit={(e) => {
        e.preventDefault();
        una(async () => { try { await api.guardarCarreraEvento(atleta.id, f, e0.id || null); aviso('Carrera guardada'); alCerrar(true); } catch (err) { setError(err.message); } });
      }}>
        {error && <div class="error" role="alert">{error}</div>}
        <label class="campo"><span class="etq">Nombre</span><input class="entrada" required maxLength={80} placeholder="Media maratón de Salamanca" value={f.nombre} onInput={cambiar('nombre')} /></label>
        <div class="rejilla-campos rejilla-carrera">
          <label class="campo"><span class="etq">Fecha</span><input class="entrada" type="date" required value={f.fecha} onInput={cambiar('fecha')} /></label>
          <label class="campo"><span class="etq">Distancia (km)</span><input class="entrada num" inputMode="decimal" placeholder="21,1" value={f.distancia_km} onInput={cambiar('distancia_km')} /></label>
          <label class="campo"><span class="etq">Desnivel (m)</span><input class="entrada num" inputMode="numeric" placeholder="—" value={f.desnivel_m} onInput={cambiar('desnivel_m')} /></label>
        </div>
        <div class="campo"><span class="etq">Prioridad</span><Segmentos etiqueta="Prioridad" valor={f.prioridad} opciones={PRIORIDADES.map(([k]) => [k, k])} alCambiar={(x) => x && setF({ ...f, prioridad: x })} />
          <span class="ayuda">{Object.fromEntries(PRIORIDADES)[f.prioridad]}</span></div>
        <div class="campo"><span class="etq">¿Va?</span><Segmentos etiqueta="Si va" valor={f.decision} opciones={DECISIONES} alCambiar={(x) => x && setF({ ...f, decision: x })} /></div>
        <div class="rejilla-campos">
          <label class="campo"><span class="etq">Tiempo objetivo</span><input class="entrada num" placeholder="1:59:00" value={f.objetivo} onInput={cambiar('objetivo')} /></label>
          <label class="campo"><span class="etq">Ritmo objetivo (min/km)</span><input class="entrada num" placeholder="5:38" value={f.objetivo_ritmo} onInput={cambiar('objetivo_ritmo')} /></label>
        </div>
        <Prevision eventos={eventos} salvo={e0.id || null} km={f.distancia_km} alUsar={(seg, ritmo) => setF({ ...f, objetivo: fmtTiempo(seg), objetivo_ritmo: fmtRitmo(ritmo) })} />
        <label class="campo"><span class="etq">Nota (el porqué, la estrategia)</span><textarea class="area" maxLength={500} value={f.nota} onInput={cambiar('nota')} /></label>
        {e0.id && <div class="rejilla-campos">
          <label class="campo"><span class="etq">Resultado</span><input class="entrada num" placeholder="1:58:43" value={f.resultado} onInput={cambiar('resultado')} /></label>
          <label class="campo"><span class="etq">Cómo fue</span><input class="entrada" maxLength={500} value={f.resultado_nota} onInput={cambiar('resultado_nota')} /></label>
        </div>}
        <div class="fila-envolver">
          <button class="btn btn-primario" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
          {e0.id && <button type="button" class="btn btn-peligro plano" disabled={ocupado} onClick={() => una(async () => { try { await api.borrarCarreraEvento(e0.id); aviso('Carrera borrada'); alCerrar(true); } catch (err) { setError(err.message); } })}>Borrar</button>}
        </div>
      </form>
    </Hoja>
  );
}

// (v0.219) La previsión con su última carrera con resultado (Riegel; en maratón, una horquilla hasta un 5 % más lenta)
function Prevision({ eventos, salvo, km, alUsar }) {
  const base = ultimaConResultado(eventos, salvo);
  const d = Number(String(km ?? '').replace(',', '.'));
  if (!base || !(d > 0)) return null;
  const p = predecirTiempo(base.resultado_seg, base.distancia_km, d);
  if (!p) return null;
  const objetivo = p.hasta || p.seg;
  return (
    <div class="prevision-carrera panel-sub pila-xs">
      <span class="mini">Con su {base.nombre} ({num(Number(base.distancia_km), Number(base.distancia_km) % 1 ? 1 : 0)} km en {fmtTiempo(base.resultado_seg)}), la previsión para {num(d, d % 1 ? 1 : 0)} km: <strong class="num">{fmtTiempo(p.seg)}{p.hasta ? `–${fmtTiempo(p.hasta)}` : ''}</strong> ({fmtRitmo(Math.round(objetivo / d))} min/km).</span>
      {p.hasta && <span class="mini terciario">En maratón, la fórmula de Riegel suele quedarse corta en corredores populares: mejor apuntar al tiempo más lento.</span>}
      <button type="button" class="btn btn-peq" style="justify-self:start" onClick={() => alUsar(objetivo, Math.round(objetivo / d))}>Usarlo como objetivo</button>
    </div>
  );
}

// ---------------------------------------------------------------- las revisiones
function RevisionesCoach({ atleta, revisiones, d = null, alGuardar }) {
  const [editar, setEditar] = useState(null);
  const hoy = hoyISO();
  return (
    <section class="panel panel-pad pila carrera-revisiones" aria-labelledby="cr-titulo">
      <div class="fila-envolver" style="justify-content:space-between">
        <h2 id="cr-titulo" class="h-panel">Revisiones</h2>
        <button class="btn btn-peq" onClick={() => setEditar({ fecha: hoy })}><Icono n="mas" /> Revisión</button>
      </div>
      {!revisiones.length ? <p class="peq secundario">Las revisiones del plan (por ejemplo, cada dos semanas): qué se mira, el criterio para seguir en verde y lo que decidís.</p> : (
        <ul class="lista-revisiones">
          {revisiones.map((r) => (
            <li key={r.id}>
              <button type="button" class="revision-btn" onClick={() => setEditar(r)} aria-label={`Editar la revisión del ${fmtCorta(r.fecha)}`}>
                <span class="semaforo-punto" data-estado={r.estado} aria-hidden="true" />
                <span class="pila-xs" style="min-width:0">
                  <span class="peq"><strong>{fmtCorta(r.fecha)}</strong> · {r.titulo}</span>
                  {r.criterio && <span class="mini terciario">Verde si: {r.criterio}</span>}
                  {r.decision && <span class="mini secundario">{r.decision}</span>}
                </span>
                <span class="chip">{NOMBRE_ESTADO_REVISION[r.estado]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {editar && <HojaRevision atleta={atleta} revision={editar} d={d} alCerrar={(c) => { setEditar(null); if (c) alGuardar(); }} />}
    </section>
  );
}

function HojaRevision({ atleta, revision, d = null, alCerrar }) {
  const { api, aviso } = useApp();
  const r0 = revision || {};
  const [f, setF] = useState({ fecha: r0.fecha || hoyISO(), titulo: r0.titulo || '', criterio: r0.criterio || '', decision: r0.decision || '', estado: r0.estado || 'pendiente' });
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  // (v0.223) Lo que dicen los datos de las dos semanas antes de la revisión: eficiencia, cumplimiento y semáforos con dolor
  const auto = useMemo(() => (d ? revisionAuto({ semanas: d.semanas, hechas: d.hechas, fecha: f.fecha, hoy: hoyISO() }) : null), [d, f.fecha]);
  return (
    <Hoja titulo={r0.id ? `Revisión del ${fmtCorta(r0.fecha)}` : 'Nueva revisión'} alCerrar={() => alCerrar(false)}>
      <form class="pila" onSubmit={(e) => {
        e.preventDefault();
        una(async () => { try { await api.guardarCarreraRevision(atleta.id, f, r0.id || null); aviso('Revisión guardada'); alCerrar(true); } catch (err) { setError(err.message); } });
      }}>
        {error && <div class="error" role="alert">{error}</div>}
        <div class="rejilla-campos">
          <label class="campo"><span class="etq">Fecha</span><input class="entrada" type="date" required value={f.fecha} onInput={cambiar('fecha')} /></label>
          <label class="campo"><span class="etq">Qué se revisa</span><input class="entrada" required maxLength={80} placeholder="Tolerancia a la primera calidad" value={f.titulo} onInput={cambiar('titulo')} /></label>
        </div>
        <label class="campo"><span class="etq">Criterio para seguir en verde</span><input class="entrada" maxLength={300} placeholder="Sin dolor al día siguiente y la fuerza estable" value={f.criterio} onInput={cambiar('criterio')} /></label>
        {auto && (
          <section class="rev-auto panel-sub pila-xs" aria-label="Lo que dicen los datos">
            <span class="peq"><strong>Lo que dicen los datos</strong> <span class="mini terciario">(del {fmtCorta(auto.desde)} al {fmtCorta(auto.hasta)})</span></span>
            <ul class="rev-auto-lista">
              {auto.partes.map((x) => <li key={x.k} data-color={x.color}><i aria-hidden="true" /><span class="mini"><strong>{x.titulo}:</strong> {x.texto} ({NOMBRE_COLOR[x.color]})</span></li>)}
            </ul>
            <button type="button" class="btn btn-peq" style="justify-self:start" onClick={() => setF({ ...f, estado: auto.estado, decision: f.decision.trim() ? f.decision : auto.texto.slice(0, 500) })}>
              Usar esto: {NOMBRE_COLOR[auto.estado]}{f.decision.trim() ? '' : ' y el texto'}</button>
          </section>
        )}
        <div class="campo"><span class="etq">Cómo salió</span><Segmentos etiqueta="Cómo salió" valor={f.estado} opciones={ESTADOS_REVISION} alCambiar={(x) => x && setF({ ...f, estado: x })} /></div>
        <label class="campo"><span class="etq">Decisión</span><textarea class="area" maxLength={500} placeholder="Se mantiene el plan / se quita una sesión de calidad…" value={f.decision} onInput={cambiar('decision')} /></label>
        <div class="fila-envolver">
          <button class="btn btn-primario" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
          {r0.id && <button type="button" class="btn btn-peligro plano" disabled={ocupado} onClick={() => una(async () => { try { await api.borrarCarreraRevision(r0.id); aviso('Revisión borrada'); alCerrar(true); } catch (err) { setError(err.message); } })}>Borrar</button>}
        </div>
      </form>
    </Hoja>
  );
}

// ---------------------------------------------------------------- lo que ha hecho (con su FC, dolor y semáforo)
function HechoCarrera({ d }) {
  const zonas = zonasFC(d.perfil);
  const lista = (d.hechas || []).slice(0, 12);
  if (!lista.length) return null;
  return (
    <section class="panel panel-pad pila carrera-hecho" aria-labelledby="ch-titulo">
      <h2 id="ch-titulo" class="h-panel">Lo último que ha corrido</h2>
      <GraficaForma hechas={d.hechas} />
      <ul class="lista-hecho-carrera">
        {lista.map((s) => {
          const h = s.cardio_hecho;
          return (
            <li key={s.id} class="pila-xs">
              <span class="peq"><strong>{fmtCorta(s.fecha_realizada)}</strong> · {s.nombre}{h.semaforo ? <span class={`chip semaforo-${h.semaforo}`}>{SEMAFORO[h.semaforo].titulo}</span> : null}</span>
              <span class="mini num">{textoCardioHecho(h)}{s.rpe_sesion ? ` · esfuerzo ${num(s.rpe_sesion)}` : ''}</span>
              {textoSaludCardio(h) && <span class={`mini num ${h.dolor >= 4 ? 'aviso-texto' : 'terciario'}`}>{textoSaludCardio(h)}{h.fc_media && zonas ? ` (Z${zonaDe(h.fc_media, zonas)} de media)` : ''}</span>}
              {s.nota_atleta && <span class="mini secundario">«{s.nota_atleta}»</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
const zonaDe = (fc, zonas) => zonas.find((z) => (z.min == null || fc >= z.min) && (z.max == null || fc <= z.max))?.z ?? '?';

// ---------------------------------------------------------------- la biblioteca de sesiones de calidad
function BibliotecaCarrera() {
  const { api, aviso } = useApp();
  const recetas = useCarga(() => api.carreraRecetas(), []);
  const [abierta, setAbierta] = useState(false);
  const [ocupado, una] = useUnaVez();
  return (
    <section class="panel panel-pad pila carrera-biblioteca" aria-labelledby="cb-titulo">
      <div class="fila-envolver" style="justify-content:space-between">
        <h2 id="cb-titulo" class="h-panel">Tu biblioteca de sesiones</h2>
        <button class="btn btn-peq plano" aria-expanded={abierta ? 'true' : 'false'} onClick={() => setAbierta(!abierta)}>{abierta ? 'Ocultar' : `Ver (${recetas.datos?.length ?? '…'})`}</button>
      </div>
      <p class="mini terciario">Las usas desde el editor y desde las semanas del plan con «Desde la biblioteca». Para añadir una, prepárala en una sesión y toca «Guardar en la biblioteca». Solo la ves tú. Además tienes la biblioteca FBE, lista para usar.</p>
      <BibliotecaFbe />
      {abierta && (recetas.error ? <ErrorCaja error={recetas.error} reintentar={recetas.recargar} /> : !recetas.datos ? <Siluetas n={3} /> : (
        <ul class="lista-recetas-carrera">
          {recetas.datos.map((r) => (
            <li key={r.id} class="pila-xs">
              <div class="fila-envolver" style="justify-content:space-between">
                <strong class="peq">{r.nombre}</strong>
                <button class="btn btn-icono plano btn-peligro" aria-label={`Borrar ${r.nombre} de la biblioteca`} disabled={ocupado} onClick={() => una(async () => {
                  try { await api.borrarCarreraReceta(r.id); aviso('Quitada de la biblioteca'); recetas.recargar(true); } catch (e) { aviso(e.message, 'error'); }
                })}><Icono n="basura" /></button>
              </div>
              <span class="mini terciario">{textoCardio(r.pauta)}{minutosPauta(r.pauta) && !r.pauta.minutos ? ` · unos ${minutosPauta(r.pauta)} min` : ''}</span>
              <ol class="partes-lista mini">{(r.pauta.partes || []).map((p, i) => <li key={i}><span class="fase-nombre">{FASES.find(([k]) => k === p.fase)?.[1]}</span> {textoParte(p)}{p.nota ? ` · ${p.nota}` : ''}</li>)}</ol>
            </li>
          ))}
        </ul>
      ))}
    </section>
  );
}

// (v0.219) Las sesiones de la biblioteca FBE, con su porqué: se usan igual que las tuyas, con «Desde la biblioteca…»
function BibliotecaFbe() {
  const [abierta, setAbierta] = useState(false);
  return (
    <div class="biblioteca-fbe pila-s">
      <button type="button" class="btn-texto peq" style="justify-self:start" aria-expanded={abierta ? 'true' : 'false'} onClick={() => setAbierta(!abierta)}>
        <Icono n={abierta ? 'arriba' : 'abajo'} width="14" height="14" /> Biblioteca FBE ({BIBLIOTECA_FBE.length} sesiones listas para usar)
      </button>
      {abierta && (
        <ul class="lista-recetas-carrera">
          {BIBLIOTECA_FBE.map((r) => (
            <li key={r.id} class="pila-xs">
              <strong class="peq">{r.nombre}</strong>
              <span class="mini secundario">{r.porque}</span>
              <span class="mini terciario">{textoCardio(r.pauta)}{minutosPauta(r.pauta) && !r.pauta.minutos ? ` · unos ${minutosPauta(r.pauta)} min` : ''}</span>
              <ol class="partes-lista mini">{r.pauta.partes.map((p, i) => <li key={i}><span class="fase-nombre">{FASES.find(([k]) => k === p.fase)?.[1]}</span> {textoParte(p)}{p.nota ? ` · ${p.nota}` : ''}</li>)}</ol>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- en el editor: lo del plan para la semana que se edita
// Lo que el plan de carrera prevé para la semana (por su lunes), con el botón que pasa sus sesiones a la semana de entreno
// (v0.218) A quien va por microciclos, su carrera va por calendario: el recuadro lo dice y enseña la de esta semana
export function PlanCarreraSemana({ carrera, semana, sesiones = [], estructura, atletaId = null, fuerza = [], alCambiarPlan = null }) {
  const { api, aviso } = useApp();
  const [moviendo, una] = useUnaVez();
  if (!carrera || carrera.falta056 || !semana?.fecha_inicio) return null;
  if (carrera.carril) return <PlanCarreraCalendario carrera={carrera} atletaId={atletaId} estructura={estructura} />;
  const lunes = lunesDe(semana.fecha_inicio);
  const s = (carrera.semanas || []).find((x) => x.lunes === lunes);
  const n = semanaDelPlan(carrera.perfil, lunes);
  const fase = faseDe(carrera.perfil, lunes);
  const total = macrociclo(carrera.perfil).reduce((a, f) => a + f.semanas, 0);
  if (!s && !fase) return null;
  const items = (s?.sesiones || []).filter((x) => x.tipo !== 'descanso');
  const ya = new Set(sesiones.filter((x) => x.tipo === 'cardio').map((x) => x.nombre));
  const faltan = items.filter((x) => !ya.has((x.titulo || `Carrera ${NOMBRE_TIPO[x.tipo].toLowerCase()}`).slice(0, 60)));
  // (v0.222) La calidad o la tirada larga pegada a un día de pierna pesada: moverla a un día libre
  const choques = s && atletaId ? choquesFuerza({ fuerza, carreras: items }) : [];
  const mover = (c) => una(async () => {
    try {
      await api.guardarCarreraSemana(atletaId, { ...s, sesiones: (s.sesiones || []).map((x) => (x === c.carrera ? { ...x, dia: c.propuesta } : x)) });
      aviso(`${c.carrera.titulo || NOMBRE_TIPO[c.carrera.tipo]}: al ${DIAS.find(([n]) => n === c.propuesta)[1].toLowerCase()}`);
      alCambiarPlan?.();
    } catch (err) { aviso(err.message, 'error'); }
  });
  return (
    <section class="panel panel-pad pila-s plan-carrera-semana" aria-label="Carrera de esta semana">
      <div class="peq"><Icono n="pasos" /> <strong>Carrera</strong>{n >= 1 && n <= total ? ` · semana ${n} de ${total}` : ''}{fase && n >= 1 && n <= total ? ` · ${fase.nombre}` : ''}
        {s?.etiqueta ? <span class="chip etiqueta-carrera">{s.etiqueta}</span> : null}{s?.ab ? <span class="chip">Fuerza {s.ab}</span> : null}{textoKm(s?.km_min, s?.km_max) ? <span class="chip num">{textoKm(s.km_min, s.km_max)}</span> : null}</div>
      {s?.clave && <p class="mini secundario">{s.clave}</p>}
      {choques.map((c, i) => (
        <p key={i} class="cav-choque mini" role="status"><Icono n="alerta" />
          <span>Choque con la fuerza: <strong>{c.carrera.titulo || NOMBRE_TIPO[c.carrera.tipo]}</strong> el {DIAS.find(([n]) => n === c.carrera.dia)[1].toLowerCase()}, pegada a «{c.fuerza.nombre || 'pierna'}» ({DIAS.find(([n]) => n === c.fuerza.dia)[1].toLowerCase()}).
            {c.propuesta ? <> <button type="button" class="btn-texto mini" disabled={moviendo} onClick={() => mover(c)}>Moverla al {DIAS.find(([n]) => n === c.propuesta)[1].toLowerCase()}</button></> : ' Sepáralas un día si puedes.'}</span>
        </p>
      ))}
      {items.length > 0 && <ul class="mini terciario plan-carrera-items">{items.map((x, i) => <li key={i}>{x.dia ? `${DIA_CORTO[x.dia]} · ` : ''}<strong>{x.titulo || NOMBRE_TIPO[x.tipo]}</strong>{x.minutos || x.km || x.partes ? ` — ${textoCardio({ modalidad: 'carrera', ...Object.fromEntries(Object.entries(x).filter(([k]) => !['titulo', 'dia'].includes(k))) })}` : ''}</li>)}</ul>}
      {faltan.length > 0 ? <button class="btn btn-peq" style="justify-self:start" onClick={() => estructura(() => api.anadirCarreraASemana(semana.id, faltan), faltan.length === 1 ? 'Sesión de carrera añadida a la semana' : `${faltan.length} sesiones de carrera añadidas a la semana`)}>
        <Icono n="mas" /> {faltan.length === items.length ? `Añadir ${faltan.length === 1 ? 'la sesión' : `las ${faltan.length} sesiones`} de carrera` : `Añadir las ${faltan.length} que faltan`}</button>
        : items.length > 0 ? <span class="mini terciario"><Icono n="hecho" width="14" height="14" /> Ya están en la semana.</span> : <span class="mini terciario">Sin sesiones de carrera previstas: prepáralas en la ficha, pestaña Carrera.</span>}
    </section>
  );
}

// (v0.218) «La carrera va por calendario»: lo de esta semana de calendario de su plan (no lo de la fecha de la semana que
// se edita) y un botón para comprobar que ya lo tiene en su microciclo (la app del coach lo hace sola al abrir y al publicar)
export function textoCarreraAlDia(r) {
  if (!r) return 'No se ha podido comprobar';
  if (r.motivo === 'sin-publicar') return 'Aún no tiene ninguna semana publicada';
  if (r.motivo === 'sin-bloque') return 'No tiene ningún bloque';
  if (r.motivo === 'sin-carreras') return 'Su plan no tiene carreras esta semana';
  if (r.motivo) return 'Su carrera no va por calendario';
  if (!r.puestas) return 'Ya tiene las carreras de esta semana';
  return `${r.puestas === 1 ? 'Puesta 1 carrera' : `Puestas ${r.puestas} carreras`} en su semana ${r.semana}${r.movida ? ' (con las fechas de esta semana)' : ''}`;
}
function PlanCarreraCalendario({ carrera, atletaId, estructura }) {
  const { api, aviso } = useApp();
  const lunes = lunesDe(hoyISO());
  const s = (carrera.semanas || []).find((x) => x.lunes === lunes);
  const n = semanaDelPlan(carrera.perfil, lunes);
  const fase = faseDe(carrera.perfil, lunes);
  const total = macrociclo(carrera.perfil).reduce((a, f) => a + f.semanas, 0);
  const items = (s?.sesiones || []).filter((x) => x.tipo !== 'descanso');
  return (
    <section class="panel panel-pad pila-s plan-carrera-semana" aria-label="Su carrera de esta semana">
      <div class="peq"><Icono n="pasos" /> <strong>Carrera, por calendario</strong>{n >= 1 && n <= total ? ` · esta semana, la ${n} de ${total}` : ''}{fase && n >= 1 && n <= total ? ` · ${fase.nombre}` : ''}
        {s?.etiqueta ? <span class="chip etiqueta-carrera">{s.etiqueta}</span> : null}{textoKm(s?.km_min, s?.km_max) ? <span class="chip num">{textoKm(s.km_min, s.km_max)}</span> : null}</div>
      <p class="mini secundario">Va por microciclos, así que su carrera no va con esta semana del programa sino con la de calendario: cada semana le salen solas las carreras de esa semana de su plan, dentro del microciclo que esté haciendo. No hace falta añadirlas aquí.</p>
      {items.length > 0 ? <ul class="mini terciario plan-carrera-items">{items.map((x, i) => <li key={i}>{x.dia ? `${DIA_CORTO[x.dia]} · ` : ''}<strong>{x.titulo || NOMBRE_TIPO[x.tipo]}</strong>{x.minutos || x.km || x.partes ? ` — ${textoCardio({ modalidad: 'carrera', ...Object.fromEntries(Object.entries(x).filter(([k]) => !['titulo', 'dia'].includes(k))) })}` : ''}</li>)}</ul>
        : <span class="mini terciario">Su plan no tiene carreras esta semana.</span>}
      {items.length > 0 && atletaId && (
        <button class="btn btn-peq" style="justify-self:start" onClick={() => estructura(async () => { const r = await api.carreraAlDia(atletaId); aviso(textoCarreraAlDia(r)); return r; }, null)}>
          <Icono n="hecho" /> Comprobar que las tiene
        </button>
      )}
    </section>
  );
}

// Lo de carrera de la pauta de una sesión: tipo, rangos, zona, opcional y partes (en el editor, debajo de lo de cardio)
export function CamposCarreraPauta({ f, setF, enviar, zonas = null, alGuardarReceta = null }) {
  const c = f.carrera || {};
  const fijar = (cambios, mandar = true) => { const n = { ...f, carrera: { ...c, ...cambios } }; setF(n); if (mandar) enviar(n); };
  return (
    <div class="campos-carrera pila-s">
      <div class="pauta-cardio-campos">
        <label class="campo"><span class="etq">Tipo</span>
          <select class="selector" value={c.tipo || ''} onChange={(e) => fijar({ tipo: e.currentTarget.value || null })}><option value="">—</option>{TIPOS_CARRERA.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label class="campo"><span class="etq">Hasta (min)</span>
          <input class="entrada" inputMode="numeric" placeholder="—" value={c.minutos_max ?? ''} onInput={(e) => fijar({ minutos_max: e.currentTarget.value }, false)} onBlur={() => enviar(f)} /></label>
        <label class="campo"><span class="etq">Hasta (km)</span>
          <input class="entrada" inputMode="decimal" placeholder="—" value={c.km_max ?? ''} onInput={(e) => fijar({ km_max: e.currentTarget.value }, false)} onBlur={() => enviar(f)} /></label>
        <label class="campo"><span class="etq">Zona</span>
          <select class="selector" value={c.zona ?? ''} onChange={(e) => fijar({ zona: e.currentTarget.value ? Number(e.currentTarget.value) : null, zona_hasta: null })}><option value="">—</option>{[1, 2, 3, 4, 5].map((z) => <option key={z} value={z}>Z{z}</option>)}</select></label>
        <label class="campo"><span class="etq">Hasta zona</span>
          <select class="selector" value={c.zona_hasta ?? ''} disabled={!c.zona} onChange={(e) => fijar({ zona_hasta: e.currentTarget.value ? Number(e.currentTarget.value) : null })}><option value="">—</option>{[2, 3, 4, 5].filter((z) => z > (c.zona || 0)).map((z) => <option key={z} value={z}>Z{z}</option>)}</select></label>
        <label class="campo campo-check"><input type="checkbox" checked={!!c.opcional} onChange={(e) => fijar({ opcional: e.currentTarget.checked })} /> <span class="peq">Opcional</span></label>
      </div>
      {c.zona && zonas ? <span class="mini terciario">{textoZona(c.zona, c.zona_hasta, zonas)}</span> : null}
      <PartesEditor partes={c.partes || []} zonas={zonas} alCambiar={(partes) => fijar({ partes })} alGuardarReceta={alGuardarReceta}
        alReceta={(r) => { const p = pautaDeReceta(r); if (!p) return; const n = { ...f, minutos: p.minutos ?? f.minutos, km: p.km ?? f.km, carrera: { ...c, tipo: p.tipo || c.tipo, minutos_max: p.minutos_max ?? '', zona: p.zona ?? null, zona_hasta: p.zona_hasta ?? null, partes: p.partes } }; setF(n); enviar(n); }} />
    </div>
  );
}
