// La carrera en la ficha del coach (v0.133, migración 055): zonas y test, el plan (macrociclo y semanas), las carreras,
// las revisiones y la biblioteca de sesiones de calidad. Y lo que usa el editor: las partes de una sesión de carrera y
// las sesiones del plan de la semana que se edita.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Icono, ErrorCaja, Hoja, Vacio, Siluetas, Segmentos } from '../comunes.jsx';
import { TablaZonas, Macrociclo } from '../CarreraComun.jsx';
import { fmtConDia, fmtCorta, hoyISO, lunesDe, sumarDias } from '../../logica/fechas.js';
import { num } from '../../logica/calculos.js';
import { textoCardio, textoCardioHecho, textoSaludCardio } from '../../logica/cardio.js';
import {
  TIPOS_CARRERA, NOMBRE_TIPO, FASES, TESTS, NOMBRE_TEST, PRIORIDADES, DECISIONES, NOMBRE_DECISION, ESTADOS_REVISION, NOMBRE_ESTADO_REVISION,
  zonasFC, textoRangoZona, textoZona, textoParte, limpiarParte, parteAEditor, fmtRitmo, textoRitmo, fmtTiempo, macrociclo, semanasConPlan,
  semanaDelPlan, faseDe, textoCuentaAtras, textoObjetivoCarrera, textoResultado, proximaCarrera, carreraObjetivo, textoKm, carreraHechaPorSemana,
  estadoKm, minutosPauta, pautaDeReceta, SEMAFORO,
} from '../../logica/carrera.js';

const DIAS = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [7, 'Domingo']];
const DIA_CORTO = { 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S', 7: 'D' };
const v = (x) => (x == null ? '' : String(x));

// ---------------------------------------------------------------- la pestaña Carrera de la ficha
export function CarreraFicha({ atleta }) {
  const { api } = useApp();
  const datos = useCarga(() => api.carrera(atleta.id), [atleta.id], { recuerdo: `carrera:${api.uid()}:${atleta.id}` });
  const d = datos.datos;
  const recargar = () => datos.recargar(true);
  if (datos.error) return <ErrorCaja error={datos.error} reintentar={datos.recargar} />;
  if (!d) return <Siluetas forma="tarjetas" n={3} texto="Cargando su carrera" />;
  if (d.falta055) return <div class="panel"><Vacio icono="pasos" titulo="Falta la migración 055">Para llevarle la carrera, ejecuta en Supabase supabase/migraciones/055_carrera.sql.</Vacio></div>;
  return (
    <div class="pila carrera-ficha">
      <ResumenCarrera d={d} />
      <ZonasCoach atleta={atleta} perfil={d.perfil} alGuardar={recargar} />
      <PlanCoach atleta={atleta} perfil={d.perfil} alGuardar={recargar} />
      <SemanasCoach atleta={atleta} d={d} alGuardar={recargar} />
      <CarrerasCoach atleta={atleta} eventos={d.eventos} alGuardar={recargar} />
      <RevisionesCoach atleta={atleta} revisiones={d.revisiones} alGuardar={recargar} />
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
  const zonas = zonasFC({ lthr: Number(f.lthr) || null, zonas: [f.z2, f.z3, f.z4, f.z5].every((x) => x !== '') ? [f.z2, f.z3, f.z4, f.z5].map(Number) : null });
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
        {zonas ? <TablaZonas zonas={zonas} umbral={p.umbral} /> : <p class="mini terciario">Con la FC umbral (por ejemplo, la FC media de los últimos 20 minutos de un test de 30) salen sus cinco zonas.</p>}
        <button class="btn btn-primario" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar zonas'}</button>
      </form>
      {p.test_fecha && <p class="mini terciario">Test del {fmtConDia(p.test_fecha)}{p.test_tipo ? ` (${NOMBRE_TEST[p.test_tipo].toLowerCase()})` : ''}.</p>}
    </section>
  );
}
// El plan, tal cual está, para no pisarlo al guardar las zonas (y al revés)
const planDe = (p) => ({ plan_nombre: p.plan_nombre || '', plan_inicio: p.plan_inicio || '', ventanas: v(p.ventanas), nota: p.nota || '', fases: p.fases || [] });
const zonasDe = (p) => ({ lthr: v(p.lthr), fc_max: v(p.fc_max), fc_reposo: v(p.fc_reposo), test_fecha: p.test_fecha || '', test_tipo: p.test_tipo || '',
  umbral: p.umbral ? p.umbral.map(fmtRitmo).join('-') : '', z2: v(p.zonas?.[0]), z3: v(p.zonas?.[1]), z4: v(p.zonas?.[2]), z5: v(p.zonas?.[3]) });

// ---------------------------------------------------------------- el plan: nombre, inicio y macrociclo
function PlanCoach({ atleta, perfil, alGuardar }) {
  const { api, aviso } = useApp();
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
      <h2 id="cp-titulo" class="h-panel">El plan</h2>
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

// ---------------------------------------------------------------- las semanas del plan
function SemanasCoach({ atleta, d, alGuardar }) {
  const [editar, setEditar] = useState(null); // { lunes, ...semana }
  const hoy = hoyISO();
  const lista = semanasConPlan(d.perfil, d.semanas);
  const hecho = useMemo(() => carreraHechaPorSemana(d.hechas || []), [d.hechas]);
  const lunesHoy = lunesDe(hoy);
  return (
    <section class="panel panel-pad pila carrera-semanas" aria-labelledby="cs-titulo">
      <div class="fila-envolver" style="justify-content:space-between">
        <h2 id="cs-titulo" class="h-panel">Semanas</h2>
        <button class="btn btn-peq" onClick={() => setEditar({ lunes: lunesHoy, sesiones: [] })}><Icono n="mas" /> Semana suelta</button>
      </div>
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
      {editar && <HojaSemana atleta={atleta} semana={editar} perfil={d.perfil} alCerrar={(cambio) => { setEditar(null); if (cambio) alGuardar(); }} />}
    </section>
  );
}

function HojaSemana({ atleta, semana, perfil, alCerrar }) {
  const { api, aviso } = useApp();
  const [f, setF] = useState({ lunes: semana.lunes, etiqueta: semana.etiqueta || '', km_min: v(semana.km_min), km_max: v(semana.km_max), ab: semana.ab || null, clave: semana.clave || '', nota: semana.nota || '' });
  const [sesiones, setSesiones] = useState(() => (semana.sesiones || []).map((x) => ({ ...x })));
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const zonas = zonasFC(perfil);
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
        <fieldset class="carrera-fases pila-s">
          <legend class="peq">Sesiones de carrera ({sesiones.length} de 7)</legend>
          {sesiones.map((s, i) => <SesionPlan key={i} s={s} i={i} zonas={zonas} alCambiar={(n) => setSesiones(sesiones.map((x, j) => (j === i ? n : x)))} alQuitar={() => setSesiones(sesiones.filter((_, j) => j !== i))} />)}
          {sesiones.length < 7 && <div class="fila-envolver">
            <button type="button" class="btn btn-peq" onClick={() => setSesiones([...sesiones, { tipo: 'facil', titulo: 'Fácil' }])}><Icono n="mas" /> Sesión</button>
            <button type="button" class="btn btn-peq plano" onClick={() => setSesiones([...sesiones, { tipo: 'descanso', titulo: 'Descanso' }])}>Descanso</button>
          </div>}
        </fieldset>
        <div class="fila-envolver">
          <button class="btn btn-primario" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar la semana'}</button>
          {existe && <button type="button" class="btn btn-peligro plano" disabled={ocupado} onClick={() => una(async () => {
            try { await api.borrarCarreraSemana(atleta.id, semana.lunes); aviso('Semana vaciada'); alCerrar(true); } catch (err) { setError(err.message); }
          })}>Vaciar la semana</button>}
        </div>
      </form>
    </Hoja>
  );
}

// Una sesión prevista en la semana del plan: tipo, título, día, volumen (con rango), zona, partes y nota
function SesionPlan({ s, i, zonas, alCambiar, alQuitar }) {
  const descanso = s.tipo === 'descanso';
  const [txt, setTxt] = useState({ minutos: v(s.minutos), minutos_max: v(s.minutos_max), km: v(s.km), km_max: v(s.km_max) });
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
    const res = nuevas.map(limpiarParte);
    const err = Object.fromEntries(res.map((r, i) => [i, r.error]).filter(([, e]) => e));
    setErrores(err);
    if (Object.keys(err).length) return;
    alCambiar(res.map((r) => r.parte));
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
          <select class="selector" value="" onFocus={cargarRecetas} onPointerDown={cargarRecetas} onChange={(e) => { const r = (recetas || []).find((x) => x.id === e.currentTarget.value); if (r) alReceta(r); }}>
            <option value="">Desde la biblioteca…</option>
            {(recetas || []).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
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
      {editar && <HojaEvento atleta={atleta} evento={editar} alCerrar={(c) => { setEditar(null); if (c) alGuardar(); }} />}
    </section>
  );
}

function HojaEvento({ atleta, evento, alCerrar }) {
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

// ---------------------------------------------------------------- las revisiones
function RevisionesCoach({ atleta, revisiones, alGuardar }) {
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
      {editar && <HojaRevision atleta={atleta} revision={editar} alCerrar={(c) => { setEditar(null); if (c) alGuardar(); }} />}
    </section>
  );
}

function HojaRevision({ atleta, revision, alCerrar }) {
  const { api, aviso } = useApp();
  const r0 = revision || {};
  const [f, setF] = useState({ fecha: r0.fecha || hoyISO(), titulo: r0.titulo || '', criterio: r0.criterio || '', decision: r0.decision || '', estado: r0.estado || 'pendiente' });
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
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
      <p class="mini terciario">Las usas desde el editor y desde las semanas del plan con «Desde la biblioteca». Para añadir una, prepárala en una sesión y toca «Guardar en la biblioteca». Solo la ves tú.</p>
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

// ---------------------------------------------------------------- en el editor: lo del plan para la semana que se edita
// Lo que el plan de carrera prevé para la semana (por su lunes), con el botón que pasa sus sesiones a la semana de entreno
export function PlanCarreraSemana({ carrera, semana, sesiones = [], estructura }) {
  const { api } = useApp();
  if (!carrera || carrera.falta055 || !semana?.fecha_inicio) return null;
  const lunes = lunesDe(semana.fecha_inicio);
  const s = (carrera.semanas || []).find((x) => x.lunes === lunes);
  const n = semanaDelPlan(carrera.perfil, lunes);
  const fase = faseDe(carrera.perfil, lunes);
  const total = macrociclo(carrera.perfil).reduce((a, f) => a + f.semanas, 0);
  if (!s && !fase) return null;
  const items = (s?.sesiones || []).filter((x) => x.tipo !== 'descanso');
  const ya = new Set(sesiones.filter((x) => x.tipo === 'cardio').map((x) => x.nombre));
  const faltan = items.filter((x) => !ya.has((x.titulo || `Carrera ${NOMBRE_TIPO[x.tipo].toLowerCase()}`).slice(0, 60)));
  return (
    <section class="panel panel-pad pila-s plan-carrera-semana" aria-label="Carrera de esta semana">
      <div class="peq"><Icono n="pasos" /> <strong>Carrera</strong>{n >= 1 && n <= total ? ` · semana ${n} de ${total}` : ''}{fase && n >= 1 && n <= total ? ` · ${fase.nombre}` : ''}
        {s?.etiqueta ? <span class="chip etiqueta-carrera">{s.etiqueta}</span> : null}{s?.ab ? <span class="chip">Fuerza {s.ab}</span> : null}{textoKm(s?.km_min, s?.km_max) ? <span class="chip num">{textoKm(s.km_min, s.km_max)}</span> : null}</div>
      {s?.clave && <p class="mini secundario">{s.clave}</p>}
      {items.length > 0 && <ul class="mini terciario plan-carrera-items">{items.map((x, i) => <li key={i}>{x.dia ? `${DIA_CORTO[x.dia]} · ` : ''}<strong>{x.titulo || NOMBRE_TIPO[x.tipo]}</strong>{x.minutos || x.km || x.partes ? ` — ${textoCardio({ modalidad: 'carrera', ...Object.fromEntries(Object.entries(x).filter(([k]) => !['titulo', 'dia'].includes(k))) })}` : ''}</li>)}</ul>}
      {faltan.length > 0 ? <button class="btn btn-peq" style="justify-self:start" onClick={() => estructura(() => api.anadirCarreraASemana(semana.id, faltan), faltan.length === 1 ? 'Sesión de carrera añadida a la semana' : `${faltan.length} sesiones de carrera añadidas a la semana`)}>
        <Icono n="mas" /> {faltan.length === items.length ? `Añadir ${faltan.length === 1 ? 'la sesión' : `las ${faltan.length} sesiones`} de carrera` : `Añadir las ${faltan.length} que faltan`}</button>
        : items.length > 0 ? <span class="mini terciario"><Icono n="hecho" width="14" height="14" /> Ya están en la semana.</span> : <span class="mini terciario">Sin sesiones de carrera previstas: prepáralas en la ficha, pestaña Carrera.</span>}
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
