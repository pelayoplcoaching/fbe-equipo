// Lo de carrera que ven el coach y el atleta (v0.133): la tabla de zonas, la barra del macrociclo y las partes de una sesión
import { fmtCorta, hoyISO } from '../logica/fechas.js';
import { textoRangoZona, textoRitmo, fmtRitmo, macrociclo, semanaDelPlan, textoParte, NOMBRE_FASE, ritmo5k, saludCarrera, textoEsfuerzo } from '../logica/carrera.js';
import { serieEficiencia } from '../logica/carrera-seguimiento.js';

// (v0.219) Con ritmo umbral, una columna con el ritmo de cada zona; sin pulsómetro (zonas de ritmo), sin la de FC
export function TablaZonas({ zonas, umbral = null }) {
  const conFC = !zonas.some((z) => z.sinFC);
  const conRitmo = zonas.some((z) => z.ritmo);
  // (v0.228, R44) por esfuerzo y el test del habla (con un fármaco que cambia el pulso)
  const conEsfuerzo = zonas.some((z) => z.esfuerzo);
  const r5k = conRitmo && umbral ? ritmo5k({ umbral }) : null;
  // (v0.227, R1 y R4) Cuándo no fiarse del pulso ni del ritmo
  const notas = [conEsfuerzo && 'Con un fármaco que cambia el pulso, el pulso no vale para las zonas: manda el esfuerzo y el test del habla.',
    conFC && 'En series de menos de 4 minutos el pulso llega tarde: manda el ritmo o el esfuerzo.',
    conRitmo && 'En cuestas, tierra, viento o con calor (20 °C o más), manda el esfuerzo, no el ritmo.'].filter(Boolean).join(' ');
  return (
    <div class="tabla-zonas-env">
      <table class="tabla-zonas">
        <caption class="sr">{conFC ? 'Zonas de frecuencia cardiaca' : conEsfuerzo ? 'Zonas por esfuerzo' : 'Zonas de ritmo'}</caption>
        <thead><tr><th scope="col">Zona y cómo se siente</th>{conFC && <th scope="col">FC</th>}{conEsfuerzo && <th scope="col">Esfuerzo (0-10)</th>}{conRitmo && <th scope="col">Ritmo</th>}</tr></thead>
        <tbody>
          {zonas.map((z) => (
            <tr key={z.z} data-zona={z.z}>
              <th scope="row"><span class="zona-pastilla" data-zona={z.z}>Z{z.z}</span> {z.nombre}<span class="zona-siente mini secundario">{z.siente}</span></th>
              {conFC && <td class="num">{textoRangoZona(z)}{!conRitmo && z.z === 4 && umbral ? <span class="zona-umbral mini secundario">{textoRitmo(umbral)}</span> : null}</td>}
              {conEsfuerzo && <td class="num">{textoEsfuerzo(z.esfuerzo)}</td>}
              {conRitmo && <td class="num zona-ritmo"><CeldaRitmo r={z.ritmo} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {conRitmo && <p class="mini terciario">Ritmos en minutos por kilómetro, a partir del ritmo umbral.{r5k ? ` Las series de Z5, a ritmo de 5 km: unos ${fmtRitmo(r5k)}.` : ''}</p>}
      <p class="mini terciario zonas-notas">{notas}</p>
    </div>
  );
}

// El ritmo de una zona en la tabla: los tramos abiertos («más lento de», «más rápido de») en una línea pequeña encima,
// para que la columna quepa a 360 px
function CeldaRitmo({ r }) {
  if (!r || (r.rapido == null && r.lento == null)) return null;
  if (r.rapido == null) return <><span class="zona-ritmo-mas mini secundario">más rápido de</span> {fmtRitmo(r.lento)}</>;
  if (r.lento == null) return <><span class="zona-ritmo-mas mini secundario">más lento de</span> {fmtRitmo(r.rapido)}</>;
  return `${fmtRitmo(r.rapido)}–${fmtRitmo(r.lento)}`;
}

// La barra del macrociclo: cada fase con su ancho por semanas, y la semana de hoy marcada
export function Macrociclo({ perfil, hoy = hoyISO() }) {
  const fases = macrociclo(perfil);
  if (!fases.length) return null;
  const total = fases.reduce((a, f) => a + f.semanas, 0);
  const n = semanaDelPlan(perfil, hoy);
  const dentro = n >= 1 && n <= total;
  return (
    <div class="macrociclo" role="img" aria-label={`Macrociclo de ${total} semanas: ${fases.map((f) => `${f.nombre}, ${f.semanas}`).join('; ')}${dentro ? `. Ahora, semana ${n}` : ''}`}>
      <div class="macro-barra">
        {fases.map((f, i) => <span key={i} class={`macro-fase${dentro && n >= f.primera && n <= f.ultima ? ' actual' : ''}`} data-i={i % 6} style={`flex-grow:${f.semanas}`}><span class="macro-nombre">{f.nombre}</span><span class="macro-sem num">{f.semanas} sem.</span></span>)}
        {dentro && <span class="macro-hoy" style={`left:${((n - 0.5) / total) * 100}%`} aria-hidden="true" />}
      </div>
      <div class="macro-fechas mini terciario num"><span>{fmtCorta(fases[0].desde)}</span><span>{fmtCorta(fases[fases.length - 1].hasta)}</span></div>
    </div>
  );
}


// Las partes de una sesión de carrera, en orden: la fase y lo que toca (con la FC de cada zona si se saben)
export function ListaPartes({ partes = [], zonas = null, ambar = false }) {
  if (!partes.length) return null;
  return (
    <ol class={`lista-partes${ambar ? ' en-ambar' : ''}`}>
      {partes.map((p, i) => (
        <li key={i} class="parte" data-fase={p.fase}>
          <span class="parte-fase">{NOMBRE_FASE[p.fase]}</span>
          <span class="pila-xs" style="min-width:0">
            <span class="parte-que num">{textoParte(p, zonas)}</span>
            {p.nota && <span class="mini secundario">{p.nota}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

// (v0.223) Su forma aeróbica: los metros que avanza con cada latido en los rodajes suaves con pulso (la media de 4 en 4).
// Si sube, corre más rápido con el mismo pulso. tu: el texto para el atleta (tú) o para el coach.
export function GraficaForma({ hechas = [], tu = false, perfil = null }) {
  const serie = serieEficiencia(hechas);
  // (v0.228, R44) con un fármaco que cambia el pulso, los metros por latido no dicen nada
  if (serie.length < 3 || saludCarrera(perfil).farmaco) return null;
  const W = 320, H = 110, PX = 6, PY = 10;
  const vals = serie.map((x) => x.media);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const rango = Math.max(0.04, hi - lo);
  const x = (i) => PX + (i * (W - 2 * PX)) / Math.max(1, serie.length - 1);
  const y = (v) => H - PY - ((v - (lo - rango * 0.15)) * (H - 2 * PY)) / (rango * 1.3);
  const puntos = serie.map((p, i) => `${x(i).toFixed(1)},${y(p.media).toFixed(1)}`).join(' ');
  const ini = serie[0].media, fin = serie[serie.length - 1].media;
  const cambio = Math.round((fin / ini - 1) * 1000) / 10;
  const f = (v) => v.toFixed(2).replace('.', ',');
  const que = cambio >= 2 ? (tu ? 'corres más rápido con el mismo pulso' : 'corre más rápido con el mismo pulso') : cambio <= -3 ? (tu ? 'te cuesta algo más que antes' : 'le cuesta algo más que antes') : 'se mantiene';
  return (
    <figure class="forma-aerobica pila-xs">
      <svg class="forma-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
        aria-label={`Metros por latido en ${tu ? 'tus' : 'sus'} rodajes suaves: de ${f(ini)} a ${f(fin)} en ${serie.length} salidas (${cambio > 0 ? '+' : cambio < 0 ? '\u2212' : ''}${String(Math.abs(cambio)).replace('.', ',')} %)`}>
        <polyline class="forma-linea" points={puntos} />
        {serie.map((p, i) => <circle key={i} class="forma-punto" cx={x(i).toFixed(1)} cy={y(p.ef).toFixed(1)} r="2.5" />)}
      </svg>
      <figcaption class="mini secundario">De {f(ini)} a {f(fin)} metros por latido ({cambio > 0 ? '+' : cambio < 0 ? '\u2212' : ''}{String(Math.abs(cambio)).replace('.', ',')} %): {que}. Cuenta {tu ? 'tus' : 'sus'} rodajes suaves con pulso; si sube, {tu ? 'vas' : 'va'} más rápido con las mismas pulsaciones.</figcaption>
    </figure>
  );
}

