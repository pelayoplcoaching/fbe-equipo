// v0.51: tres diales en Hoy, como los de WHOOP: Constancia (sesiones hechas de las de la semana), Carga (la de esta
// semana frente a lo que sueles llevar a estas alturas) y Cómo llegas (lo que contestaste hoy en «¿Cómo llegas hoy?»).
// Tocar uno abre una hoja con lo que lo alimenta y una explicación corta. Solo los ve el atleta (en su Hoy): «Cómo
// llegas» es dato de salud y solo sale con su consentimiento.
import { useState } from 'preact/hooks';
import { useApp, useCarga, Hoja, Icono } from '../comunes.jsx';
import { prepMarcadas, marcarPrepHoy } from './prep-hoy.js';
import { Preparacion } from './Preparacion.jsx';
import { dialConstancia, dialCarga, dialComoLlegas, preparacionDeHoy, sesionParaContestar, conSeriesDeHoy, arcoDial, BANDA_CARGA } from '../../logica/tablero.js';
import { consejoPreparacion } from '../../logica/preparacion.js';
import { num, cargaSemanal } from '../../logica/calculos.js';
import { fmtConDia, fmtCorta, lunesDe, sumarDias } from '../../logica/fechas.js';

// La esfera: un arco de 270° (abierto por abajo); con banda, la zona de «En tu media» y una aguja
function Esfera({ frac, banda = null, aguja = false, children }) {
  const T = 64, G = 7;
  const a = arcoDial(frac, T, G);
  return (
    <span class="dial-esfera" aria-hidden="true">
      <svg viewBox={`0 0 ${T} ${T}`}>
        <path class="dial-pista" d={a.d} stroke-width={G} />
        {banda && <path class="dial-banda" d={a.d} stroke-width={G} stroke-dasharray={`0 ${a.largo * banda[0]} ${a.largo * (banda[1] - banda[0])} ${a.largo}`} />}
        {!aguja && frac > 0 && <path class="dial-arco" d={a.d} stroke-width={G} stroke-dasharray={`${a.lleno} ${a.largo + 10}`} />}
        {aguja && <circle class="dial-aguja" cx={a.punto.x} cy={a.punto.y} r="5.5" />}
      </svg>
      <span class="dial-centro marcador">{children}</span>
    </span>
  );
}

export function Diales({ sesiones = [], semana = null, siguiente = null, previstaHoy = null, ejerciciosSiguiente = [], bloques = [], salud = false, hoy, alContestar }) {
  const { api, atleta, aviso } = useApp();
  const [abierto, setAbierto] = useState(null);
  const carga = useCarga(() => api.cargaHoy(atleta.id, { bloques, hoy }).catch(() => null), [atleta.id, hoy, sesiones.filter((s) => s.completada).length]);
  const c = dialConstancia(sesiones);
  const k = carga.datos ? dialCarga(carga.datos, hoy, 4) : null;
  // La regla de «de hoy» (la misma que la sesión): hecha hoy, con series de hoy o contestada hoy en este móvil
  const seriesHoy = siguiente && ejerciciosSiguiente.some((e) => conSeriesDeHoy(e.hechas)) ? [siguiente.id] : [];
  const prep = salud ? preparacionDeHoy(sesiones, hoy, { marcadas: prepMarcadas(), seriesHoy }) : null;
  const l = salud ? dialComoLlegas(prep) : null;
  // Solo se contesta desde aquí para la sesión prevista para hoy (o la que ya tiene series de hoy), y nunca de baja
  const pendiente = sesionParaContestar({ previstaHoy, siguiente, seriesHoy, baja: atleta.estado === 'baja' });
  const pct = k && k.ratio != null ? Math.round(k.ratio * 100) : null;
  const n = salud ? 3 : 2;
  return (
    <section class="panel diales" style={{ '--n': n }} aria-label="Tu semana de un vistazo">
      <button type="button" class="dial" data-estado={c.estado} onClick={() => setAbierto('constancia')}
        aria-label={`Constancia: ${c.hechas} de ${c.total} sesiones de esta semana. ${c.etiqueta}. Ver de dónde sale`}>
        <Esfera frac={c.valor}><span>{c.hechas}<span class="u">/{c.total}</span></span></Esfera>
        <span class="dial-nombre">Constancia</span>
        <span class="dial-estado">{c.etiqueta}</span>
      </button>
      <button type="button" class="dial" data-estado={k ? k.estado : 'cargando'} onClick={() => setAbierto('carga')}
        aria-label={`Carga: ${!k ? 'cargando' : k.estado === 'sin_media' ? 'aún sin media para comparar' : `${pct} % de lo que sueles llevar a estas alturas, ${k.etiqueta.toLowerCase()}`}. Ver de dónde sale`}>
        <Esfera frac={k?.valor || 0} banda={k && k.estado !== 'sin_media' ? [BANDA_CARGA[0] / 2, BANDA_CARGA[1] / 2] : null} aguja={!!k && k.estado !== 'sin_media'}>
          {!k || k.estado === 'sin_media' ? <span>—</span> : <span>{pct}<span class="u">%</span></span>}
        </Esfera>
        <span class="dial-nombre">Carga</span>
        <span class="dial-estado">{k ? k.etiqueta : '…'}</span>
      </button>
      {salud && (
        <button type="button" class="dial" data-estado={l.estado} onClick={() => setAbierto('llegas')}
          aria-label={l.estado === 'sin_respuesta' ? `Cómo llegas: sin contestar hoy. ${pendiente ? 'Contestar' : 'Ver qué es'}` : `Cómo llegas: ${l.etiqueta}. Ver tus respuestas`}>
          <Esfera frac={l.valor}>{l.estado === 'sin_respuesta' ? <Icono n="pregunta" /> : <span>{l.total}<span class="u">/9</span></span>}</Esfera>
          <span class="dial-nombre">Cómo llegas</span>
          <span class="dial-estado">{l.estado === 'sin_respuesta' ? (pendiente ? 'Contestar' : 'Sin contestar') : l.etiqueta}</span>
        </button>
      )}
      {abierto === 'constancia' && <HojaConstancia c={c} sesiones={sesiones} semana={semana} alCerrar={() => setAbierto(null)} />}
      {abierto === 'carga' && <HojaCarga k={k} datos={carga.datos} hoy={hoy} alCerrar={() => setAbierto(null)} />}
      {abierto === 'llegas' && (
        <HojaLlegas l={l} prep={prep} pendiente={pendiente} baja={atleta.estado === 'baja'} hoy={hoy} alCerrar={() => setAbierto(null)}
          alGuardar={async (p) => {
            // Como en la sesión: si no se puede guardar (sin conexión, sin el consentimiento), lo dice; el consejo vale igual
            try { await api.guardarPreparacion(pendiente.id, p); marcarPrepHoy(pendiente.id); alContestar?.(); return true; }
            catch (err) { aviso(`No se ha podido guardar (${err.message}). El consejo vale igual.`, 'error'); return false; }
          }} />
      )}
    </section>
  );
}

function HojaConstancia({ c, sesiones, semana, alCerrar }) {
  return (
    <Hoja titulo="Constancia" alCerrar={alCerrar}>
      <p class="secundario">Las sesiones que has hecho de las que tu coach ha publicado esta semana{semana?.fecha_inicio ? ` (del ${fmtCorta(semana.fecha_inicio)} al ${fmtCorta(sumarDias(semana.fecha_inicio, 6))})` : ''}. Al completarlas todas, sumas una semana a tu racha.</p>
      <dl class="dial-hoja-cifras">
        <div><dt>Hechas</dt><dd class="marcador">{c.hechas}</dd></div>
        <div><dt>De la semana</dt><dd class="marcador">{c.total}</dd></div>
      </dl>
      {sesiones.length > 0 && (
        <ul class="dial-hoja-lista">
          {sesiones.map((s) => (
            <li key={s.id} class={s.completada ? 'hecha' : ''}>
              <span class="marca-mini" aria-hidden="true">{s.completada ? <Icono n="hecho" /> : s.orden}</span>
              <span>{s.nombre}</span>
              <span class="peq secundario">{s.completada ? `Hecha${s.fecha_realizada ? ` el ${fmtConDia(s.fecha_realizada)}` : ''}` : 'Pendiente'}</span>
            </li>
          ))}
        </ul>
      )}
    </Hoja>
  );
}

function HojaCarga({ k, datos, hoy, alCerrar }) {
  const lunes = lunesDe(hoy);
  const semanas = cargaSemanal(datos || [], hoy, 5);
  const max = Math.max(1, ...semanas.map((w) => w.carga));
  return (
    <Hoja titulo="Carga de la semana" alCerrar={alCerrar}>
      <p class="secundario">Cada sesión suma su esfuerzo (el RPE que pones al terminar, de 1 a 10) por sus minutos. Se compara con lo que sueles llevar <strong>a estas alturas de la semana</strong>: la media de tus semanas anteriores hasta el mismo día, así un lunes no sale bajo solo porque la semana acaba de empezar.</p>
      {!k ? <p class="peq secundario">Cargando…</p> : k.estado === 'sin_media' ? (
        <p class="nota">Aún no hay con qué comparar: hacen falta al menos dos semanas con sesiones terminadas (con su esfuerzo y su duración). Esta semana llevas <strong class="num">{num(k.actual, 0)}</strong>.</p>
      ) : (
        <>
          <dl class="dial-hoja-cifras">
            <div><dt>Esta semana</dt><dd class="marcador">{num(k.actual, 0)}</dd></div>
            <div><dt>Lo habitual a estas alturas</dt><dd class="marcador">{num(k.esperado, 0)}</dd></div>
            <div><dt>Resultado</dt><dd class="marcador">{Math.round(k.ratio * 100)}<span class="peq"> %</span></dd></div>
          </dl>
          <p class="peq"><strong>{k.etiqueta}.</strong> «En tu media» va del {num(BANDA_CARGA[0] * 100, 0)} al {num(BANDA_CARGA[1] * 100, 0)} % de lo habitual (la media de {k.semanas} {k.semanas === 1 ? 'semana' : 'semanas'}). Es para mirarlo, no una nota: lo que manda es lo que te pauta tu coach.</p>
        </>
      )}
      {semanas.some((w) => w.carga > 0) && (
        <div class="barras-carga" style={{ '--n': semanas.length }} role="img"
          aria-label={`Carga por semanas: ${semanas.map((w) => `${w.lunes === lunes ? 'esta semana' : `semana del ${fmtCorta(w.lunes)}`}, ${num(w.carga, 0)}`).join('; ')}`}>
          {semanas.map((w) => (
            <div key={w.lunes} class={w.lunes === lunes ? 'actual' : ''}>
              <span class="b" style={{ height: `${Math.max(3, (w.carga / max) * 100)}%` }} />
              <span class="k">{w.lunes === lunes ? 'Esta' : fmtCorta(w.lunes)}</span>
            </div>
          ))}
        </div>
      )}
      <p class="mini terciario">Método de la carga por sesión (Foster y cols., 2001). Las sesiones sin esfuerzo o sin duración no suman.</p>
    </Hoja>
  );
}

function HojaLlegas({ l, prep, pendiente, baja = false, alGuardar, alCerrar }) {
  const [hecho, setHecho] = useState(null);
  const consejo = consejoPreparacion(hecho || prep);
  return (
    <Hoja titulo="Cómo llegas hoy" alCerrar={alCerrar}>
      {l.estado === 'sin_respuesta' && !hecho ? (
        pendiente ? (
          <>
            <p class="secundario">Tres toques antes de entrenar: cómo has dormido, la energía y si tienes agujetas o molestias. Se guarda con {pendiente.nombre} y te da un consejo para hoy.</p>
            <Preparacion alGuardar={async (p) => { await alGuardar(p); setHecho(p); }} />
          </>
        ) : baja ? <p class="secundario">Tu cuenta está de baja: ya no se guarda nada nuevo.</p> : <p class="secundario">Hoy no tienes una sesión prevista. El día que entrenes, contesta «¿Cómo llegas hoy?» al empezar la sesión y aquí verás cómo llegas.</p>
      ) : (
        <>
          <ul class="dial-hoja-lista">
            {dialComoLlegas(hecho || prep).respuestas.map((r) => (
              <li key={r.id}>
                <span class="marca-mini" aria-hidden="true">{r.valor}</span>
                <span>{r.pregunta}</span>
                <strong class="peq">{r.texto}</strong>
              </li>
            ))}
          </ul>
          {consejo && <div class={`consejo-dia ${consejo.nivel}`}><Icono n={consejo.nivel === 'bien' ? 'hecho' : 'alerta'} /><div class="pila-xs"><strong>{consejo.titulo}</strong><span class="peq">{consejo.texto}</span></div></div>}
        </>
      )}
      <p class="mini terciario">Es una ayuda para regular el día, no un diagnóstico. Solo lo ves tú aquí; tu coach lo ve con la sesión.</p>
    </Hoja>
  );
}
