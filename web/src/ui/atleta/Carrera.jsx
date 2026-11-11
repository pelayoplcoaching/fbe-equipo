// La carrera del atleta (v0.133, migración 056): la sesión de carrera por partes con sus zonas y el semáforo antes de
// entrenar; en Hoy, su carrera con la cuenta atrás; y «Tu carrera»: zonas, carreras, plan por semanas y revisiones.
import { useMemo, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Hoja, Siluetas, ErrorCaja } from '../comunes.jsx';
import { TablaZonas, Macrociclo, ListaPartes } from '../CarreraComun.jsx';
import { fmtConDia, fmtCorta, hoyISO, lunesDe, sumarDias } from '../../logica/fechas.js';
import { num } from '../../logica/calculos.js';
import { textoCardio } from '../../logica/cardio.js';
import {
  zonasFC, textoZona, textoRitmo, NOMBRE_TIPO, NOMBRE_TEST, SEMAFORO, ALARMA, pautaAmbar, minutosPauta, semanasConPlan, semanaDelPlan, faseDe,
  macrociclo, carreraObjetivo, proximaCarrera, textoCuentaAtras, textoObjetivoCarrera, textoResultado, textoKm, carreraHechaPorSemana, estadoKm,
  NOMBRE_DECISION, NOMBRE_ESTADO_REVISION, conCarrera,
} from '../../logica/carrera.js';

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
  const zonas = carrera.datos?.perfil ? zonasFC(carrera.datos.perfil) : null;
  const [semaforo, setSemaforo] = useState(() => (hecho?.semaforo || leerSemaforo(sesionId)));
  const ambar = semaforo === 'ambar';
  const elegir = (v) => { const n = v === semaforo ? null : v; setSemaforo(n); guardarSemaforo(sesionId, n); };
  return (
    <div class="detalle-carrera pila-s">
      <div class="fila-envolver">
        {pauta.tipo && <span class="chip tipo-carrera" data-tipo={pauta.tipo}>{NOMBRE_TIPO[pauta.tipo]}</span>}
        {pauta.zona && <span class="chip num zona-chip" data-zona={pauta.zona}>{textoZona(pauta.zona, pauta.zona_hasta, zonas)}</span>}
        {pauta.opcional && <span class="chip">Opcional</span>}
        {!pauta.minutos && minutosPauta(pauta) ? <span class="chip num">Unos {minutosPauta(pauta)} min</span> : null}
      </div>
      {pauta.ritmo && <p class="peq num">Ritmo: {textoRitmo(pauta.ritmo)}</p>}
      <ListaPartes partes={pauta.partes || []} zonas={zonas} ambar={ambar && !completada} />
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

// ---------- en Hoy: su carrera ----------
export function CarreraHoy({ abrir }) {
  const carrera = useCarreraMia();
  const d = carrera.datos;
  const hoy = hoyISO();
  if (!d || d.falta056) return null;
  const obj = carreraObjetivo(d.eventos, hoy) || proximaCarrera(d.eventos, hoy);
  const n = semanaDelPlan(d.perfil, hoy);
  const fase = faseDe(d.perfil, hoy);
  const total = macrociclo(d.perfil).reduce((a, f) => a + f.semanas, 0);
  const semana = (d.semanas || []).find((s) => s.lunes === lunesDe(hoy));
  const hecho = carreraHechaPorSemana(d.hechas || [])[lunesDe(hoy)];
  if (!obj && !fase && !semana && !d.perfil) return null;
  return (
    <button type="button" class="panel tarjeta-carrera-hoy" onClick={abrir}>
      <span class="ios-ico" aria-hidden="true"><Icono n="pasos" /></span>
      <span class="pila-xs" style="min-width:0;flex:1">
        <span class="peq secundario">Tu carrera{fase && n >= 1 && n <= total ? ` · semana ${n} de ${total}, ${fase.nombre.toLowerCase()}` : ''}</span>
        {obj ? <strong>{obj.nombre}: {textoCuentaAtras(obj.fecha, hoy).replace(/^F/, 'f')}</strong> : <strong>Tus zonas y tu plan</strong>}
        {(semana || hecho) && <span class="mini terciario num">{[semana?.etiqueta, textoKm(semana?.km_min, semana?.km_max) && `${textoKm(semana.km_min, semana.km_max)} esta semana`, hecho && `${num(hecho.km, hecho.km % 1 ? 1 : 0)} km hechos`].filter(Boolean).join(' · ')}</span>}
      </span>
      <Icono n="derecha" />
    </button>
  );
}

// ---------- «Tu carrera» ----------
export function TuCarrera({ alCerrar }) {
  const carrera = useCarreraMia();
  const d = carrera.datos;
  return (
    <Hoja titulo="Tu carrera" alCerrar={alCerrar} clase="hoja-tu-carrera">
      {carrera.error ? <ErrorCaja error={carrera.error} reintentar={carrera.recargar} /> : !d ? <Siluetas forma="tarjetas" n={3} texto="Cargando tu carrera" /> : <ContenidoCarrera d={d} />}
    </Hoja>
  );
}

function ContenidoCarrera({ d }) {
  const hoy = hoyISO();
  const lunesHoy = lunesDe(hoy);
  const obj = carreraObjetivo(d.eventos, hoy) || proximaCarrera(d.eventos, hoy);
  const zonas = zonasFC(d.perfil);
  const hecho = useMemo(() => carreraHechaPorSemana(d.hechas || []), [d.hechas]);
  const semanas = semanasConPlan(d.perfil, d.semanas);
  const actual = semanas.find((s) => s.lunes === lunesHoy);
  const vienen = semanas.filter((s) => s.lunes > lunesHoy).slice(0, 3);
  const p = d.perfil || {};
  return (
    <div class="pila tu-carrera">
      {obj && (
        <section class="carrera-objetivo" aria-label="Tu carrera objetivo">
          <span class="peq">{obj.prioridad === 'A' ? 'Tu carrera objetivo' : 'Tu próxima carrera'}</span>
          <strong class="carrera-objetivo-nombre">{obj.nombre}</strong>
          <span class="carrera-cuenta num">{textoCuentaAtras(obj.fecha, hoy)}</span>
          <span class="peq">{fmtConDia(obj.fecha)}{textoObjetivoCarrera(obj) ? ` · ${textoObjetivoCarrera(obj)}` : ''}</span>
        </section>
      )}
      {macrociclo(p).length > 0 && <section class="pila-s" aria-labelledby="tc-plan"><h3 id="tc-plan" class="h-panel">{p.plan_nombre || 'Tu plan'}</h3><Macrociclo perfil={p} /></section>}

      {actual && (
        <section class="panel panel-pad pila-s" aria-labelledby="tc-semana">
          <h3 id="tc-semana" class="h-panel">Esta semana{actual.n ? ` (semana ${actual.n})` : ''}</h3>
          <SemanaCarrera s={actual} hecho={hecho[actual.lunes]} zonas={zonas} abierta />
        </section>
      )}

      {zonas && (
        <section class="panel panel-pad pila-s" aria-labelledby="tc-zonas">
          <h3 id="tc-zonas" class="h-panel">Tus zonas</h3>
          <TablaZonas zonas={zonas} umbral={p.umbral} />
          <p class="mini terciario">{[p.test_fecha && `Del test del ${fmtConDia(p.test_fecha)}${p.test_tipo ? ` (${NOMBRE_TEST[p.test_tipo].toLowerCase()})` : ''}`, p.fc_max && `FC máxima ${p.fc_max}`, p.lthr && `FC umbral ${p.lthr}`].filter(Boolean).join(' · ')}</p>
        </section>
      )}

      {d.eventos.length > 0 && (
        <section class="panel panel-pad pila-s" aria-labelledby="tc-carreras">
          <h3 id="tc-carreras" class="h-panel">Tus carreras</h3>
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
        <h3 id="tc-semaforo" class="h-panel">El semáforo</h3>
        <ul class="lista-semaforo">{['verde', 'ambar', 'rojo'].map((k) => <li key={k}><span class="semaforo-punto" data-estado={k} aria-hidden="true" /><span class="peq"><strong>{SEMAFORO[k].titulo}:</strong> {SEMAFORO[k].texto}</span></li>)}</ul>
        <p class="mini aviso-texto">{ALARMA}</p>
      </section>

      {p.nota && <section class="panel panel-pad pila-s" aria-labelledby="tc-nota"><h3 id="tc-nota" class="h-panel">Carrera y fuerza</h3><p class="peq" style="white-space:pre-line">{p.nota}</p></section>}
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
