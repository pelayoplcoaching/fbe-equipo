// (vista 276, v0.277) Las hojas de los diales de Hoy (comida, tu reloj, constancia, carga y cómo llegas), en su propio
// trozo: no hace falta descargarlas al abrir la app. Diales.jsx las pide al tocar un dial (y antes, en cuanto la app se
// queda quieta), así que al abrir una ya están. Lo que necesitan de tablero.js y de semana-natural.js les llega en `kit`
// (Diales.jsx): si lo importaran aquí, esos dos módulos del arranque se partirían en dos archivos más al abrir la app.
import { useState } from 'preact/hooks';
import { useApp, Hoja, Icono, useSinCoach } from '../comunes.jsx';
import { Preparacion } from './Preparacion.jsx';
import { consejoPreparacion } from '../../logica/preparacion.js';
import { esPorSuCuenta } from '../../logica/esencial.js';
import { textoConsejo } from '../../logica/esencial-primera.js';
import { num, cargaSemanal } from '../../logica/calculos.js';
import { fmtConDia, fmtCorta, lunesDe, sumarDias } from '../../logica/fechas.js';

// (v0.140) El detalle de los dos diales nuevos
export function HojaComida({ m, objetivo, alCerrar, arriba = null }) {
  return (
    <Hoja titulo="Comida de hoy" alCerrar={alCerrar}>
      {arriba}
      <p class="secundario">Lo que llevas apuntado hoy frente a las kcal de tu plan para hoy{objetivo?.descanso ? ' (día de descanso)' : ''}. Se apunta en «Nutrición de hoy».</p>
      <dl class="dial-hoja-cifras">
        <div><dt>Apuntado</dt><dd class="marcador">{num(m.comido, 0)}<span class="peq"> kcal</span></dd></div>
        <div><dt>Tu objetivo</dt><dd class="marcador">{num(m.objetivo, 0)}<span class="peq"> kcal</span></dd></div>
        <div><dt>{m.quedan >= 0 ? 'Te quedan' : 'Por encima'}</dt><dd class="marcador">{num(Math.abs(m.quedan), 0)}<span class="peq"> kcal</span></dd></div>
      </dl>
      {m.proteina != null && <p class="peq">{m.proteina > 0 ? <>Proteína: te quedan <strong class="num">{num(m.proteina, 0)} g</strong> para llegar a la de tu plan.</> : <>Proteína: ya has llegado a la de tu plan.</>}</p>}
      <p class="peq terciario">«En tu objetivo» va desde un 10 % antes de llegar hasta pasarte un 5 %.</p>
    </Hoja>
  );
}
// (v0.141) Tu reloj de un vistazo: lo de hoy (o anoche) frente a tu media de 14 días; solo lo que llega de Salud
const filasReloj = (horasMin) => ({ pasos: ['Pasos hoy', (v) => num(v, 0)], sueno_min: ['Sueño anoche', (v) => `${horasMin(v)} h`], fc_reposo: ['Pulso en reposo', (v) => `${num(v, 0)} lpm`], hrv: ['HRV', (v) => `${num(v, 0)} ms`] });
export function HojaReloj({ filas, ultimo, kit, alCerrar, arriba = null }) {
  const sinCoach = useSinCoach();
  const FILAS_RELOJ = filasReloj(kit.horasMin);
  return (
    <Hoja titulo="Tu reloj, de un vistazo" alCerrar={alCerrar}>
      {arriba}
      <p class="secundario">Lo que llega de Salud del iPhone (Perfil → Conexiones){ultimo ? `; lo último, ${fmtConDia(String(ultimo).slice(0, 10))}` : ''}, frente a tu media de los últimos 14 días. No son objetivos: sirven para ver si hoy es un día normal para ti.</p>
      <table class="tabla-reloj">
        <thead><tr><th scope="col"><span class="sr">Dato</span></th><th scope="col">Hoy</th><th scope="col">Tu media</th></tr></thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.clave}><th scope="row">{FILAS_RELOJ[f.clave][0]}</th><td class="num">{f.hoy != null ? FILAS_RELOJ[f.clave][1](f.hoy) : '—'}</td><td class="num secundario">{f.media != null ? FILAS_RELOJ[f.clave][1](f.media) : '—'}</td></tr>
          ))}
        </tbody>
      </table>
      <p class="peq terciario">La media sale con 3 días al menos de las dos últimas semanas. Solo lo ves tú (y {sinCoach ? 'Pelayo' : 'tu coach'}, como el resto de lo que llega de Salud).</p>
    </Hoja>
  );
}

export function HojaConstancia({ c, sesiones, semana, kit, alCerrar, arriba = null, natural = null }) {
  const sinCoach = useSinCoach();
  const rango = semana?.fecha_inicio ? ` (del ${fmtCorta(semana.fecha_inicio)} al ${fmtCorta(sumarDias(semana.fecha_inicio, 6))})` : '';
  return (
    <Hoja titulo="Constancia" alCerrar={alCerrar}>
      {arriba}
      {natural
        ? <p class="secundario">Tu coach te programa por microciclos: tu semana se cuenta de lunes a domingo{rango}, con un objetivo de {kit.textoDiasSemana(natural.dias)}{c.total && c.total < natural.dias ? ` (esta semana, ${c.total}: no tienes más publicadas)` : ''}. Al llegar a él, sumas una semana a tu racha. Las sesiones van en el orden de tu programa.</p>
        : <p class="secundario">Las sesiones que has hecho de las {sinCoach ? 'de tu plan' : 'que tu coach ha publicado'} esta semana{rango}. Al completarlas todas, sumas una semana a tu racha.</p>}
      <dl class="dial-hoja-cifras">
        <div><dt>Hechas</dt><dd class="marcador">{c.hechas}</dd></div>
        <div><dt>{natural ? 'Tu objetivo' : 'De la semana'}</dt><dd class="marcador">{c.total}</dd></div>
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

export function HojaCarga({ k, datos, hoy, kit, alCerrar, arriba = null }) {
  const BANDA_CARGA = kit.BANDA_CARGA;
  const sinCoach = useSinCoach();
  const lunes = lunesDe(hoy);
  const semanas = cargaSemanal(datos || [], hoy, 5);
  // (vista 276) la franja de «tu media»: la media de las semanas enteras de antes que tienen carga (las mismas que mira el
  // dial: las cuatro anteriores), de BANDA_CARGA[0] a BANDA_CARGA[1]. Solo detrás de las semanas ya acabadas: la de ahora
  // va a medias (el dial la compara con lo que llevabas el mismo día)
  const previas = semanas.filter((w) => w.lunes !== lunes && w.carga > 0);
  const media = previas.length >= 2 ? previas.reduce((t, w) => t + w.carga, 0) / previas.length : 0;
  const max = Math.max(1, ...semanas.map((w) => w.carga), media * BANDA_CARGA[1]);
  const franja = media > 0 ? { bottom: `${(media * BANDA_CARGA[0] / max) * 100}%`, height: `${(media * (BANDA_CARGA[1] - BANDA_CARGA[0]) / max) * 100}%` } : null;
  return (
    <Hoja titulo="Carga de la semana" alCerrar={alCerrar}>
      {arriba}
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
          <p class="peq"><strong>{k.etiqueta}.</strong> «En tu media» va del {num(BANDA_CARGA[0] * 100, 0)} al {num(BANDA_CARGA[1] * 100, 0)} % de lo habitual (la media de {k.semanas} {k.semanas === 1 ? 'semana' : 'semanas'}). Es para mirarlo, no una nota: lo que manda es {sinCoach ? 'tu plan' : 'lo que te pauta tu coach'}.</p>
        </>
      )}
      {semanas.some((w) => w.carga > 0) && (
        <div class="barras-carga" style={{ '--n': semanas.length }} role="img"
          aria-label={`Carga por semanas: ${semanas.map((w) => `${w.lunes === lunes ? 'esta semana' : `semana del ${fmtCorta(w.lunes)}`}, ${num(w.carga, 0)}`).join('; ')}`}>
          {semanas.map((w) => (
            <div key={w.lunes} class={w.lunes === lunes ? 'actual bc-ahora' : ''}>
              <span class="bc-pista">{franja && w.lunes !== lunes && <i class="bc-franja" style={franja} />}<span class="b" style={{ height: `${Math.max(3, (w.carga / max) * 100)}%` }} /></span>
              <span class="k">{w.lunes === lunes ? 'Esta' : fmtCorta(w.lunes)}</span>
            </div>
          ))}
        </div>
      )}
      {franja && <p class="mini terciario bc-ley"><i class="bc-franja" aria-hidden="true" />La franja es tu media de antes (del {num(BANDA_CARGA[0] * 100, 0)} al {num(BANDA_CARGA[1] * 100, 0)} %).</p>}
      <p class="mini terciario">Método de la carga por sesión (Foster y cols., 2001). Las sesiones sin esfuerzo o sin duración no suman.</p>
    </Hoja>
  );
}

export function HojaLlegas({ l, prep, pendiente, baja = false, kit, alGuardar, alCerrar, arriba = null }) {
  const { atleta } = useApp();
  const [hecho, setHecho] = useState(null);
  const consejo = consejoPreparacion(hecho || prep);
  return (
    <Hoja titulo="Cómo llegas hoy" alCerrar={alCerrar}>
      {arriba}
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
            {kit.dialComoLlegas(hecho || prep).respuestas.map((r) => (
              <li key={r.id}>
                <span class="marca-mini" aria-hidden="true">{r.valor}</span>
                <span>{r.pregunta}</span>
                <strong class="peq">{r.texto}</strong>
              </li>
            ))}
          </ul>
          {consejo && <div class={`consejo-dia ${consejo.nivel}`}><Icono n={consejo.nivel === 'bien' ? 'hecho' : 'alerta'} /><div class="pila-xs"><strong>{consejo.titulo}</strong><span class="peq">{textoConsejo(consejo, esPorSuCuenta(atleta))}</span></div></div>}
        </>
      )}
      <p class="mini terciario">Es una ayuda para regular el día, no un diagnóstico. {esPorSuCuenta(atleta) ? 'Solo lo ves tú aquí.' : 'Solo lo ves tú aquí; tu coach lo ve con la sesión.'}</p>
    </Hoja>
  );
}

