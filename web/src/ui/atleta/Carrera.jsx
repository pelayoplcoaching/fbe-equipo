// La carrera del atleta (v0.133, migración 056): la sesión de carrera por partes con sus zonas y el semáforo antes de
// entrenar; en Hoy, su carrera con la cuenta atrás; y «Tu carrera»: zonas, carreras, plan por semanas y revisiones.
import { useMemo, useState } from 'preact/hooks';
import { useApp, useCarga, useUnaVez, Segmentos, Icono, Hoja, Siluetas, ErrorCaja, IcoIos, descargar as descargarArchivo } from '../comunes.jsx';
import { Imagen } from '../Imagen.jsx';
import { TablaZonas, Macrociclo, ListaPartes, GraficaForma } from '../CarreraComun.jsx';
import { fmtConDia, fmtCorta, hoyISO, lunesDe, sumarDias } from '../../logica/fechas.js';
import { num } from '../../logica/calculos.js';
import { textoCardio } from '../../logica/cardio.js';
import { porqueDe } from '../../logica/carrera-biblioteca.js';
import { eventosCalendarioCarrera, serieEficiencia } from '../../logica/carrera-seguimiento.js';
import { tramosGuiados } from '../../logica/carrera-guiada.js';
import { GuiaCarrera } from './GuiaCarrera.jsx';
import { calendarioICS } from '../../logica/plan.js';
import {
  zonasDe, textoZona, textoRitmo, NOMBRE_TIPO, NOMBRE_TEST, SEMAFORO, ALARMA, pautaAmbar, minutosPauta, semanasConPlan, semanaDelPlan, faseDe,
  macrociclo, carreraObjetivo, proximaCarrera, textoCuentaAtras, textoObjetivoCarrera, textoResultado, textoKm, carreraHechaPorSemana, estadoKm,
  NOMBRE_DECISION, NOMBRE_ESTADO_REVISION, conCarrera, predecirTiempo, ultimaConResultado, fmtTiempo, fuenteZonas, umbralCaducado, saludCarrera,
} from '../../logica/carrera.js';
import { kmMedio } from '../../logica/carrera-avisos.js';
import { mananaPendiente, limpiarManana, respuestaManana, DONDE_MANANA, PIERNA_MANANA, COMO_MANANA } from '../../logica/carrera-salud.js';
import { planDiaCarrera, esSemanaDeCarrera, trasLaCarrera } from '../../logica/carrera-dia.js';

const DIA_CORTO = { 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S', 7: 'D' };
// ¿Es una pauta de carrera con estructura (tipo, zona o partes)?
export const pautaDeCarrera = (p) => !!p && p.modalidad === 'carrera' && !!(p.tipo || p.zona || (Array.isArray(p.partes) && p.partes.length));

// ---------- el semáforo, en este móvil hasta que termina la sesión (y entonces va con lo que apunta) ----------
// Se guarda con el día: vale ese día y el siguiente; después (o al cerrar la sesión de la app) se olvida
const CLAVE_SEMAFORO = (id) => `fbe-semaforo-${id}`;
export function leerSemaforo(sesionId) {
  try {
    const [v, dia] = String(localStorage.getItem(CLAVE_SEMAFORO(sesionId)) || '').split('|');
    if (!['verde', 'ambar', 'rojo'].includes(v) || !dia || dia < sumarDias(hoyISO(), -1)) { localStorage.removeItem(CLAVE_SEMAFORO(sesionId)); return null; }
    return v;
  } catch { return null; }
}
function guardarSemaforo(sesionId, v) {
  try { if (v) localStorage.setItem(CLAVE_SEMAFORO(sesionId), `${v}|${hoyISO()}`); else localStorage.removeItem(CLAVE_SEMAFORO(sesionId)); } catch { /* sin almacenamiento: solo en pantalla */ }
}
export function olvidarSemaforo(sesionId) { guardarSemaforo(sesionId, null); }

// Sus zonas (de su ficha de carrera), recordadas mientras la app está abierta
function useCarreraMia() {
  const { api, atleta } = useApp();
  const activa = conCarrera(atleta);
  return useCarga(() => (activa ? api.carrera(atleta.id).catch(() => null) : Promise.resolve(null)), [atleta?.id, activa], { recuerdo: `carrera-mia:${atleta?.id}` });
}

// ---------- dentro de la sesión ----------
export function DetalleCarreraSesion({ pauta, sesionId, completada = false, hecho = null }) {
  const carrera = useCarreraMia();
  // (v0.219) con su ritmo umbral, cada zona dice también su ritmo; sin pulsómetro, las zonas de ritmo
  const zonas = carrera.datos?.perfil ? zonasDe(carrera.datos.perfil) : null;
  const porque = porqueDe(pauta);
  const [semaforo, setSemaforo] = useState(() => (hecho?.semaforo || leerSemaforo(sesionId)));
  const ambar = semaforo === 'ambar';
  const elegir = (v) => { const n = v === semaforo ? null : v; setSemaforo(n); guardarSemaforo(sesionId, n); };
  // (v0.224) el modo guiado: tramo a tramo, con la voz y el cronómetro (no en ámbar: hoy va suave y sin series)
  const [guia, setGuia] = useState(false);
  const guiable = !completada && !ambar && tramosGuiados(pauta).length > 1;
  return (
    <div class="detalle-carrera pila-s">
      <div class="fila-envolver">
        {pauta.tipo && <span class="chip tipo-carrera" data-tipo={pauta.tipo}>{NOMBRE_TIPO[pauta.tipo]}</span>}
        {pauta.zona && <span class="chip num zona-chip" data-zona={pauta.zona}>{textoZona(pauta.zona, pauta.zona_hasta, zonas)}</span>}
        {pauta.opcional && <span class="chip">Opcional</span>}
        {!pauta.minutos && minutosPauta(pauta) ? <span class="chip num">Unos {minutosPauta(pauta)} min</span> : null}
      </div>
      {porque && <p class="peq secundario carrera-porque">{porque}</p>}
      {pauta.ritmo && <p class="peq num">Ritmo: {textoRitmo(pauta.ritmo)}</p>}
      <ListaPartes partes={pauta.partes || []} zonas={zonas} ambar={ambar && !completada} />
      {guiable && <button type="button" class="btn btn-peq gser-abrir" onClick={() => setGuia(true)} aria-haspopup="dialog"><Icono n="intervalos" /> Guiarme por las partes</button>}
      {guia && <GuiaCarrera pauta={pauta} titulo={NOMBRE_TIPO[pauta.tipo] ? `${NOMBRE_TIPO[pauta.tipo]}${pauta.zona ? ` · ${textoZona(pauta.zona, pauta.zona_hasta, null)}` : ''}` : 'Tu sesión'} alCerrar={() => setGuia(false)} />}
      {!completada && !hecho && (
        <div class="semaforo-carrera pila-s" role="group" aria-labelledby={`sem-${sesionId}`}>
          <span class="peq" id={`sem-${sesionId}`}><strong>Antes de salir: ¿cómo llegas hoy?</strong></span>
          <div class="semaforo-botones">
            {['verde', 'ambar', 'rojo'].map((k) => (
              <button key={k} type="button" class={`semaforo-btn${semaforo === k ? ' elegido' : ''}`} data-estado={k} aria-pressed={semaforo === k ? 'true' : 'false'} onClick={() => elegir(k)}>
                <span class="semaforo-punto" data-estado={k} aria-hidden="true" /><span>{SEMAFORO[k].corto}</span>
              </button>
            ))}
          </div>
          {semaforo && <p class={`peq semaforo-texto${semaforo === 'rojo' ? ' aviso-texto' : ''}`} role="status">
            <strong>{SEMAFORO[semaforo].titulo}:</strong> {semaforo === 'ambar' ? `hoy, ${pautaAmbar(pauta).texto}.` : SEMAFORO[semaforo].texto}
          </p>}
          <p class="mini terciario">{ALARMA}</p>
        </div>
      )}
    </div>
  );
}

// ---------- en Hoy: la mañana siguiente (v0.228, R45) ----------
// Tras una salida con dolor de 3/10 o más, o de calidad, tirada larga, carrera o test: cómo se ha levantado (el dolor de 0 a 10,
// mejor, igual o peor que antes de salir, dónde y, en la pierna, si duele en un punto del hueso o al saltar). Una vez por mañana.
function MananaCarrera({ d, alGuardar }) {
  const { api, atleta } = useApp();
  const hoy = hoyISO();
  const pend = d.falta089 ? null : mananaPendiente({ hechas: d.hechas || [], mananas: d.mananas || [], hoy });
  const [f, setF] = useState({ dolor: 0, como: '', donde: '', hueso: false, salto: false });
  const [hecho, setHecho] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  if (hecho) return <div class="panel panel-pad pila-xs cm-manana" data-nivel={hecho.nivel} role="status"><strong class="peq">Apuntado</strong><span class="mini">{hecho.texto}</span></div>;
  if (!pend) return null;
  const pierna = PIERNA_MANANA.includes(f.donde);
  const guardar = () => una(async () => {
    try {
      const m = { fecha: hoy, sesion_id: pend.id, ...f, donde: f.donde || null };
      await api.guardarManana(atleta.id, m);
      setHecho(respuestaManana(limpiarManana(m).manana, (d.mananas || [])[0] || null));
      setError(null);
      alGuardar?.();
    } catch (e) { setError(e.message); }
  });
  return (
    <section class="panel panel-pad pila-s cm-manana" aria-labelledby="cm-titulo">
      <h3 id="cm-titulo" class="peq cm-titulo"><strong>¿Cómo te has levantado?</strong><span class="mini secundario">Tras «{pend.nombre || 'tu carrera'}» de ayer</span></h3>
      {error && <div class="error" role="alert">{error}</div>}
      <label class="campo"><span class="etq">Dolor ahora: <strong class="num">{f.dolor}/10</strong></span>
        <input class="cm-dolor" type="range" min="0" max="10" step="1" value={f.dolor} aria-valuetext={`${f.dolor} de 10`} onInput={(e) => setF({ ...f, dolor: Number(e.currentTarget.value) })} /></label>
      <div class="campo"><span class="etq">Comparado con antes de salir</span>
        <Segmentos etiqueta="Comparado con antes de salir" valor={f.como} opciones={COMO_MANANA} alCambiar={(x) => setF({ ...f, como: x || '' })} /></div>
      {f.dolor > 0 && <label class="campo"><span class="etq">¿Dónde?</span>
        <select class="selector" value={f.donde} onChange={(e) => setF({ ...f, donde: e.currentTarget.value })}><option value="">Elige</option>{DONDE_MANANA.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>}
      {f.dolor > 0 && pierna && <>
        <label class="campo campo-check"><input type="checkbox" checked={f.hueso} onChange={(e) => setF({ ...f, hueso: e.currentTarget.checked })} /><span class="peq">Duele en un punto concreto del hueso, al apretar</span></label>
        <label class="campo campo-check"><input type="checkbox" checked={f.salto} onChange={(e) => setF({ ...f, salto: e.currentTarget.checked })} /><span class="peq">Duele al saltar a la pata coja</span></label>
      </>}
      <button type="button" class="btn btn-primario" style="justify-self:start" disabled={!f.como || ocupado} onClick={guardar}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
    </section>
  );
}

// ---------- en Hoy: su carrera ----------
export function CarreraHoy({ abrir }) {
  const carrera = useCarreraMia();
  const d = carrera.datos;
  const hoy = hoyISO();
  if (!d || d.falta056) return null;
  const manana = <MananaCarrera d={d} alGuardar={() => carrera.recargar(true)} />;
  const obj = carreraObjetivo(d.eventos, hoy) || proximaCarrera(d.eventos, hoy);
  const n = semanaDelPlan(d.perfil, hoy);
  const fase = faseDe(d.perfil, hoy);
  const total = macrociclo(d.perfil).reduce((a, f) => a + f.semanas, 0);
  const semana = (d.semanas || []).find((s) => s.lunes === lunesDe(hoy));
  const hecho = carreraHechaPorSemana(d.hechas || [])[lunesDe(hoy)];
  if (!obj && !fase && !semana && !d.perfil) return manana;
  return (
    <>
    {manana}
    <button type="button" class="panel tarjeta-carrera-hoy" onClick={abrir}>
      <IcoIos n="pasos" />
      <span class="pila-xs" style="min-width:0;flex:1">
        <span class="peq secundario">Tu carrera{fase && n >= 1 && n <= total ? ` · semana ${n} de ${total}, ${fase.nombre.toLowerCase()}` : ''}</span>
        {obj ? <strong>{obj.nombre}: {textoCuentaAtras(obj.fecha, hoy).replace(/^F/, 'f')}</strong> : <strong>Tus zonas y tu plan</strong>}
        {(semana || hecho) && <span class="mini terciario num">{[semana?.etiqueta, textoKm(semana?.km_min, semana?.km_max) && `${textoKm(semana.km_min, semana.km_max)} esta semana`, hecho && `${num(hecho.km, hecho.km % 1 ? 1 : 0)} km hechos`].filter(Boolean).join(' · ')}</span>}
      </span>
      <Icono n="derecha" />
    </button>
    </>
  );
}

// ---------- «Tu carrera» ----------
export function TuCarrera({ alCerrar }) {
  const carrera = useCarreraMia();
  const d = carrera.datos;
  return (
    <Hoja titulo="Tu carrera" alCerrar={alCerrar} clase="hoja-tu-carrera">
      <Imagen id="carrera" clase="franja-ilu franja-hoja franja-carrera" tamanos="(min-width: 640px) 560px, 92vw" />
      {carrera.error ? <ErrorCaja error={carrera.error} reintentar={carrera.recargar} /> : !d ? <Siluetas forma="tarjetas" n={3} texto="Cargando tu carrera" /> : <ContenidoCarrera d={d} recargar={() => carrera.recargar(true)} />}
    </Hoja>
  );
}

// (v0.229, mejora 16 con R33-R39 y R46) Tu plan para el día de la carrera, la semana de la carrera: calentar, el ritmo y sus
// pasos, comer antes y durante, la cafeína, los analgésicos y qué hacer si va mal. La temperatura prevista a la hora de
// salida la escribes tú y se queda en este móvil; tu último peso (para los gramos), si lo apuntas.
const CLAVE_TEMP = (id) => `fbe-carrera-temp-${id}`;
function PlanDia({ evento, d }) {
  const { api, atleta } = useApp();
  const hoy = hoyISO();
  const [temp, setTemp] = useState(() => { try { return localStorage.getItem(CLAVE_TEMP(evento.id)) || ''; } catch { return ''; } });
  const peso = useCarga(() => api.pesos(atleta.id, 60).then((l) => (l.length ? Number(l[l.length - 1].kg) : null)).catch(() => null), [atleta.id], { recuerdo: `peso-carrera:${atleta.id}` });
  const plan = useMemo(() => planDiaCarrera({ evento, eventos: d.eventos, pesoKg: peso.datos, temperatura: temp === '' ? null : Number(temp), kmSemana: kmMedio(d.hechas || [], hoy) }), [evento, d.eventos, peso.datos, temp]);
  if (!plan) return null;
  const cambiarTemp = (e) => {
    const v = e.currentTarget.value.replace(/[^0-9-]/g, '').slice(0, 3);
    setTemp(v);
    try { if (v) localStorage.setItem(CLAVE_TEMP(evento.id), v); else localStorage.removeItem(CLAVE_TEMP(evento.id)); } catch { /* sin almacenamiento: solo en pantalla */ }
  };
  return (
    <section class="panel panel-pad pila-s plan-dia" aria-labelledby="pd-titulo">
      <h3 id="pd-titulo" class="h-panel">Tu plan para el día</h3>
      <label class="campo pd-temp"><span class="etq">Temperatura prevista a la hora de salir (°C)</span>
        <input class="entrada num" inputMode="numeric" placeholder="15" value={temp} onInput={cambiarTemp} /></label>
      {plan.avisos.map((a) => <p key={a} class="mini pd-aviso"><Icono n="alerta" width="14" height="14" /> {a}</p>)}
      {plan.secciones.map((sec) => (
        <div key={sec.id} class="pila-xs pd-sec" data-sec={sec.id}>
          <strong class="peq">{sec.titulo}</strong>
          <ul class="mini pd-lineas">{sec.lineas.map((l) => <li key={l}>{l}</li>)}</ul>
          {sec.id === 'ritmo' && plan.pasos.length > 1 && (
            <details class="pd-pasos">
              <summary class="mini">{plan.km >= 20 ? 'Tus pasos, cada 5 km' : 'Tus pasos, km a km'}</summary>
              <ol class="mini num pd-tabla">{plan.pasos.map((x) => <li key={x.km}><span>km {String(x.km).replace('.', ',')}</span><span>{fmtTiempo(x.seg)}</span></li>)}</ol>
            </details>
          )}
        </div>
      ))}
    </section>
  );
}

// (v0.230, mejora 17, migración 090) El resultado de tu última carrera (de hoy hacia atrás, hasta 60 días): lo apuntas tú;
// con él, lo que hiciste frente a lo previsto. Tu coach lo ve en su ficha.
function ResultadoCarrera({ d, recargar }) {
  const { api } = useApp();
  const hoy = hoyISO();
  const ev = (d.eventos || []).filter((e) => (e.decision === 'va' || e.decision === 'entreno') && e.fecha <= hoy && e.fecha >= sumarDias(hoy, -60) && Number(e.distancia_km) > 0)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0] || null;
  const [t, setT] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState(null);
  const [ocupado, una] = useUnaVez();
  if (!ev) return null;
  const tras = ev.resultado_seg ? trasLaCarrera({ evento: ev, eventos: d.eventos, kmSemana: kmMedio(d.hechas || [], hoy) }) : null;
  if (ev.resultado_seg && ev.fecha < sumarDias(hoy, -21)) return null;
  const guardar = (e) => {
    e.preventDefault();
    una(async () => {
      try {
        const r = await api.ponerResultadoCarrera(ev.id, { resultado: t, nota });
        if (r?.falta090) { setError('Aún no se puede apuntar desde aquí: díselo a tu coach.'); return; }
        setError(null); recargar?.();
      } catch (err) { setError(err.message); }
    });
  };
  return (
    <section class="panel panel-pad pila-s res-carrera" aria-labelledby="rca-titulo">
      <h3 id="rca-titulo" class="h-panel">{ev.resultado_seg ? `Tu resultado en ${ev.nombre}` : `¿Cuánto hiciste en ${ev.nombre}?`}</h3>
      {ev.resultado_seg ? <p class="peq">Hiciste <strong class="num">{fmtTiempo(ev.resultado_seg)}</strong>{tras?.previsto ? ` (lo previsto era ${fmtTiempo(tras.previsto)})` : ''}{ev.objetivo_seg ? `; tu objetivo, ${fmtTiempo(ev.objetivo_seg)}` : ''}. Tu coach ya lo ve.</p>
        : <form class="pila-s" onSubmit={guardar}>
          {error && <div class="error" role="alert">{error}</div>}
          <div class="rejilla-campos">
            <label class="campo"><span class="etq">Tu tiempo</span><input class="entrada num" inputMode="numeric" placeholder={Number(ev.distancia_km) >= 20 ? '1:52:30' : '48:10'} value={t} onInput={(e) => setT(e.currentTarget.value)} /></label>
            <label class="campo"><span class="etq">Cómo fue (si quieres)</span><input class="entrada" maxLength={500} placeholder="Calor, cuestas, cómo te sentiste…" value={nota} onInput={(e) => setNota(e.currentTarget.value)} /></label>
          </div>
          <button class="btn btn-primario" style="justify-self:start" disabled={!t.trim() || ocupado}>{ocupado ? 'Guardando…' : 'Apuntar mi resultado'}</button>
        </form>}
    </section>
  );
}

function ContenidoCarrera({ d, recargar }) {
  const hoy = hoyISO();
  const lunesHoy = lunesDe(hoy);
  const obj = carreraObjetivo(d.eventos, hoy) || proximaCarrera(d.eventos, hoy);
  const zonas = zonasDe(d.perfil);
  const hecho = useMemo(() => carreraHechaPorSemana(d.hechas || []), [d.hechas]);
  const semanas = semanasConPlan(d.perfil, d.semanas);
  const actual = semanas.find((s) => s.lunes === lunesHoy);
  const vienen = semanas.filter((s) => s.lunes > lunesHoy).slice(0, 3);
  const p = d.perfil || {};
  // (v0.219) su tiempo previsto, con su última carrera con resultado (Riegel; en maratón, una horquilla)
  const base = obj?.distancia_km ? ultimaConResultado(d.eventos, obj.id) : null;
  // (v0.227, R5) en maratón, con sus km de las últimas 8 semanas y si ya ha corrido alguno
  const previsto = base ? predecirTiempo(base.resultado_seg, base.distancia_km, obj.distancia_km, { kmSemana: kmMedio(d.hechas || [], hoy), primero: !(d.eventos || []).some((e) => e.id !== obj.id && e.fecha < hoy && Number(e.distancia_km) >= 40 && Number(e.resultado_seg) > 0) }) : null;
  const prevision = previsto ? { base, p: previsto } : null;
  // (v0.223) Sus carreras y las sesiones clave de su plan, al calendario del móvil (con aviso la víspera de cada carrera)
  const aCalendario = eventosCalendarioCarrera({ eventos: d.eventos, semanas: d.semanas, hoy });
  const alCalendario = () => descargarArchivo('mi-carrera.ics', calendarioICS(aCalendario, { nombre: 'Mi carrera (FBE)' }), 'text/calendar;charset=utf-8');
  return (
    <div class="pila tu-carrera">
      {obj && (
        <section class="carrera-objetivo" aria-label="Tu carrera objetivo">
          <span class="peq">{obj.prioridad === 'A' ? 'Tu carrera objetivo' : 'Tu próxima carrera'}</span>
          <strong class="carrera-objetivo-nombre">{obj.nombre}</strong>
          <span class="carrera-cuenta num">{textoCuentaAtras(obj.fecha, hoy)}</span>
          <span class="peq">{fmtConDia(obj.fecha)}{textoObjetivoCarrera(obj) ? ` · ${textoObjetivoCarrera(obj)}` : ''}</span>
          {prevision && <span class="mini carrera-prevision">Con tu {prevision.base.nombre}, tu tiempo previsto es {fmtTiempo(prevision.p.seg)}{prevision.p.desde ? ` (entre ${fmtTiempo(prevision.p.desde)} y ${fmtTiempo(prevision.p.hasta)})` : ''}</span>}
        </section>
      )}
      <ResultadoCarrera d={d} recargar={recargar} />
      {obj && esSemanaDeCarrera(obj, hoy) && <PlanDia evento={obj} d={d} />}
      {macrociclo(p).length > 0 && <section class="pila-s" aria-labelledby="tc-plan"><h3 id="tc-plan" class="h-panel">{p.plan_nombre || 'Tu plan'}</h3><Macrociclo perfil={p} /></section>}

      {actual && (
        <section class="panel panel-pad pila-s" aria-labelledby="tc-semana">
          <h3 id="tc-semana" class="h-panel">Esta semana{actual.n ? ` (semana ${actual.n})` : ''}</h3>
          <SemanaCarrera s={actual} hecho={hecho[actual.lunes]} zonas={zonas} abierta />
        </section>
      )}

      {zonas && (
        <section class="panel panel-pad pila-s" aria-labelledby="tc-zonas">
          <Imagen id="carrera-zonas" clase="franja-ilu franja-pegada franja-zonas" tamanos="(min-width: 640px) 560px, 100vw" />
          <h3 id="tc-zonas" class="h-panel">Tus zonas</h3>
          <TablaZonas zonas={zonas} umbral={p.umbral} />
          <p class="mini terciario">{[p.test_fecha && `Del test del ${fmtConDia(p.test_fecha)}${p.test_tipo ? ` (${NOMBRE_TEST[p.test_tipo].toLowerCase()})` : ''}`, p.fc_max && `FC máxima ${p.fc_max}${p.test_tipo === 'estimado' && fuenteZonas(p) === 'reserva' ? ' (estimada: zonas aproximadas)' : ''}`, p.lthr && `FC umbral ${p.lthr}`].filter(Boolean).join(' · ')}</p>
          {/* (v0.227, R1) Las zonas de un test de hace más de 6 meses */}
          {umbralCaducado(p, hoy) && <p class="mini aviso-texto">Tu test es de hace más de 6 meses: tu coach puede pedirte repetirlo.</p>}
        </section>
      )}

      {d.eventos.length > 0 && (
        <section class="panel panel-pad pila-s" aria-labelledby="tc-carreras">
          <h3 id="tc-carreras" class="h-panel"><Imagen id="carrera-dorsal" clase="ico-ilu" tamanos="44px" />Tus carreras</h3>
          {aCalendario.length > 0 && (
            <button type="button" class="btn btn-peq tc-calendario" onClick={alCalendario}>
              <Icono n="calendario" /> Al calendario del móvil
            </button>
          )}
          <ul class="lista-eventos">
            {d.eventos.map((e) => (
              <li key={e.id} class={`evento-carrera${e.fecha < hoy ? ' pasada' : ''}`} data-decision={e.decision}>
                <span class="evento-prio" data-prio={e.prioridad}>{e.prioridad}</span>
                <span class="pila-xs" style="min-width:0">
                  <strong>{e.nombre}</strong>
                  <span class="peq secundario">{fmtConDia(e.fecha)}{e.fecha >= hoy && e.decision !== 'no' ? ` · ${textoCuentaAtras(e.fecha, hoy)}` : ''}</span>
                  <span class="mini terciario num">{[textoObjetivoCarrera(e), e.resultado_seg ? `Hiciste ${textoResultado(e)}` : ''].filter(Boolean).join(' · ')}</span>
                  {e.nota && <span class="mini secundario">{e.nota}</span>}
                </span>
                <span class={`chip decision-${e.decision}`}>{NOMBRE_DECISION[e.decision]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {vienen.length > 0 && (
        <section class="panel panel-pad pila-s" aria-labelledby="tc-vienen">
          <h3 id="tc-vienen" class="h-panel">Lo que viene</h3>
          {vienen.map((s) => <SemanaCarrera key={s.lunes} s={s} zonas={zonas} />)}
        </section>
      )}

      {semanas.some((s) => s.lunes < lunesHoy && (s.km_min != null || s.km_max != null || hecho[s.lunes])) && (
        <section class="panel panel-pad pila-s" aria-labelledby="tc-km">
          <h3 id="tc-km" class="h-panel">Tus kilómetros</h3>
          <KmSemanas semanas={semanas.filter((s) => s.lunes <= lunesHoy)} hecho={hecho} />
        </section>
      )}

      {serieEficiencia(d.hechas || []).length >= 3 && !saludCarrera(d.perfil).farmaco && (
        <section class="panel panel-pad pila-s" aria-labelledby="tc-forma">
          <h3 id="tc-forma" class="h-panel">Tu forma aeróbica</h3>
          <GraficaForma hechas={d.hechas} perfil={d.perfil} tu />
        </section>
      )}

      {d.revisiones.length > 0 && (
        <section class="panel panel-pad pila-s" aria-labelledby="tc-rev">
          <h3 id="tc-rev" class="h-panel">Revisiones</h3>
          <ul class="lista-revisiones">
            {d.revisiones.map((r) => (
              <li key={r.id} class="revision-carrera">
                <span class="semaforo-punto" data-estado={r.estado} aria-hidden="true" />
                <span class="pila-xs" style="min-width:0">
                  <span class="peq"><strong>{fmtCorta(r.fecha)}</strong> · {r.titulo} <span class="mini terciario">({NOMBRE_ESTADO_REVISION[r.estado].toLowerCase()})</span></span>
                  {r.criterio && <span class="mini terciario">Para seguir en verde: {r.criterio}</span>}
                  {r.decision && <span class="mini secundario">{r.decision}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section class="panel panel-pad pila-s" aria-labelledby="tc-semaforo">
        <h3 id="tc-semaforo" class="h-panel"><Imagen id="carrera-semaforo" clase="ico-ilu" tamanos="44px" />El semáforo</h3>
        <ul class="lista-semaforo">{['verde', 'ambar', 'rojo'].map((k) => <li key={k}><span class="semaforo-punto" data-estado={k} aria-hidden="true" /><span class="peq"><strong>{SEMAFORO[k].titulo}:</strong> {SEMAFORO[k].texto}</span></li>)}</ul>
        <p class="mini aviso-texto">{ALARMA}</p>
      </section>

      {p.nota && <section class="panel panel-pad pila-s" aria-labelledby="tc-nota"><h3 id="tc-nota" class="h-panel"><Imagen id="carrera-fuerza" clase="ico-ilu" tamanos="44px" />Carrera y fuerza</h3><p class="peq" style="white-space:pre-line">{p.nota}</p></section>}
      {!obj && !zonas && !semanas.length && <p class="peq secundario">Tu coach está preparando tu plan de carrera: aquí verás tus zonas, tus carreras y cada semana.</p>}
    </div>
  );
}

function SemanaCarrera({ s, hecho = null, zonas = null, abierta = false }) {
  const est = estadoKm(hecho, s);
  return (
    <div class="semana-carrera-at pila-xs">
      <span class="peq"><strong>{fmtCorta(s.lunes)}</strong>{s.fase ? ` · ${s.fase}` : ''}{s.etiqueta ? <span class="chip etiqueta-carrera">{s.etiqueta}</span> : null}{s.ab ? <span class="chip">Fuerza {s.ab}</span> : null}</span>
      {(textoKm(s.km_min, s.km_max) || hecho) && <span class="mini num">{[textoKm(s.km_min, s.km_max) && `Previstos ${textoKm(s.km_min, s.km_max)}`, hecho && `llevas ${num(hecho.km, hecho.km % 1 ? 1 : 0)} km`].filter(Boolean).join(' · ')}{est === 'larga' ? ' (más de lo previsto)' : ''}</span>}
      {s.clave && <span class="mini secundario">{s.clave}</span>}
      {(s.sesiones || []).length > 0 && (
        <ul class="sesiones-plan-at">
          {s.sesiones.map((x, i) => (
            <li key={i} data-tipo={x.tipo}>
              <span class="dia-plan">{x.dia ? DIA_CORTO[x.dia] : '·'}</span>
              <span class="pila-xs" style="min-width:0">
                <span class="peq"><strong>{x.titulo || NOMBRE_TIPO[x.tipo]}</strong>{x.opcional ? ' (opcional)' : ''}</span>
                {x.tipo !== 'descanso' && (x.minutos || x.km || x.partes) ? <span class="mini terciario">{textoCardio({ modalidad: 'carrera', ...Object.fromEntries(Object.entries(x).filter(([k]) => !['titulo', 'dia'].includes(k))) })}</span> : null}
                {abierta && x.partes && <ListaPartes partes={x.partes} zonas={zonas} />}
                {x.nota && <span class="mini secundario">{x.nota}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Los km de cada semana: lo previsto (la franja) y lo hecho (la barra)
function KmSemanas({ semanas, hecho }) {
  const max = Math.max(10, ...semanas.map((s) => Math.max(Number(s.km_max ?? s.km_min ?? 0), hecho[s.lunes]?.km || 0)));
  return (
    <ol class="km-semanas" aria-label="Kilómetros por semana, previstos y hechos">
      {semanas.map((s) => {
        const h = hecho[s.lunes]?.km || 0;
        const a = Number(s.km_min ?? s.km_max ?? 0), b = Number(s.km_max ?? s.km_min ?? 0);
        return (
          <li key={s.lunes} class="km-semana">
            <span class="mini num km-sem-etq">{s.n ? `S${s.n}` : fmtCorta(s.lunes)}</span>
            <span class="km-pista" aria-hidden="true">
              {b > 0 && <span class="km-previsto" style={`left:${(a / max) * 100}%;width:${Math.max(1, ((b - a) / max) * 100)}%`} />}
              <span class="km-hecho" style={`width:${(h / max) * 100}%`} />
            </span>
            <span class="mini num km-sem-valor">{num(h, h % 1 ? 1 : 0)}{b > 0 ? ` / ${textoKm(s.km_min, s.km_max)}` : ' km'}</span>
          </li>
        );
      })}
    </ol>
  );
}
