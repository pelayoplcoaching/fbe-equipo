import { useState } from 'preact/hooks';
import { Icono } from '../comunes.jsx';
import { fmtConDia } from '../../logica/fechas.js';
import { PUNTOS, TEXTO_ESTADO_PROGRESO, textoRitmo, num, conSigno, MENSAJE_MEDIDAS } from '../../logica/progreso-revision.js';

// v0.194: el progreso del atleta en la revisión semanal, sin ir a su ficha. Siempre a la vista, el semáforo de cuatro
// puntos y la frase; al abrirlo, peso, medidas, comida y descanso comparados con las semanas anteriores.

const COLOR = { verde: 'ok', ambar: 'aviso', rojo: 'alerta', gris: 'gris' };
const fecha = (iso) => (iso ? fmtConDia(iso) : '');
const flecha = (x, al_reves = false) => (x == null || x === 0 ? '' : (x > 0) !== al_reves ? 'sube' : 'baja');

export function Semaforo({ progreso, compacto = false }) {
  if (!progreso) return null;
  return (
    <ul class={`rev-semaforo ${compacto ? 'compacto' : ''}`} aria-label="Progreso de un vistazo">
      {PUNTOS.map(([k, t]) => {
        const e = progreso.semaforo[k] || 'gris';
        return <li key={k} class={`punto ${COLOR[e]}`} title={`${t}: ${TEXTO_ESTADO_PROGRESO[e]}`}><span class="luz" aria-hidden="true" /><span class="etq">{t}</span><span class="sr">: {TEXTO_ESTADO_PROGRESO[e]}</span></li>;
      })}
    </ul>
  );
}

// Una línea pequeña (SVG) con sus puntos; meta: una línea discontinua (el peso al que quiere llegar)
export function Linea({ puntos, meta = null, etiqueta, min = null, max = null, alto = 44, decimales = 1, unidad = '', rangoMin = 0 }) {
  const vals = puntos.map((p) => p.valor).filter((v) => v != null);
  if (vals.length < 2) return <p class="peq secundario">{etiqueta}: aún no hay datos para la gráfica.</p>;
  let lo = min ?? Math.min(...vals, ...(meta != null ? [meta] : [])), hi = max ?? Math.max(...vals, ...(meta != null ? [meta] : []));
  // (que medio kilo no parezca un precipicio: un rango mínimo, centrado)
  if (hi - lo < rangoMin) { const c = (hi + lo) / 2; lo = c - rangoMin / 2; hi = c + rangoMin / 2; }
  const rango = hi - lo || 1, W = 240, H = alto, pad = 4;
  const x = (i) => pad + (i * (W - 2 * pad)) / Math.max(1, puntos.length - 1);
  const y = (v) => pad + (1 - (v - lo) / rango) * (H - 2 * pad);
  const tramos = [];
  let actual = [];
  puntos.forEach((p, i) => { if (p.valor == null) { if (actual.length) tramos.push(actual); actual = []; } else actual.push([x(i), y(p.valor)]); });
  if (actual.length) tramos.push(actual);
  const ultimo = [...puntos].reverse().find((p) => p.valor != null);
  const primero = puntos.find((p) => p.valor != null);
  return (
    <figure class="rev-linea">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${etiqueta}: de ${num(primero.valor, decimales)}${unidad} a ${num(ultimo.valor, decimales)}${unidad}${meta != null ? `; objetivo ${num(meta, decimales)}${unidad}` : ''}`} preserveAspectRatio="none">
        {meta != null && <line class="meta" x1={pad} x2={W - pad} y1={y(meta)} y2={y(meta)} />}
        {tramos.map((t, i) => <polyline key={i} class="trazo" points={t.map((p) => p.join(',')).join(' ')} />)}
        {puntos.map((p, i) => p.valor != null && <circle key={i} class={p === ultimo ? 'ultimo' : 'punto'} cx={x(i)} cy={y(p.valor)} r={p === ultimo ? 3.2 : 2.2} />)}
      </svg>
      <figcaption class="peq secundario">{etiqueta}: de {num(primero.valor, decimales)} a {num(ultimo.valor, decimales)}{unidad}{meta != null ? ` · discontinua, su objetivo (${num(meta, decimales)}${unidad})` : ''}</figcaption>
    </figure>
  );
}

function Comparado({ etiqueta, valor, antes, dif, unidad = '', decimales = 1, alReves = false, extra = null, tono = null }) {
  const sentido = flecha(dif, alReves);
  return (
    <div class={`rev-cifra ${tono ? `t-${tono}` : ''}`}>
      <dt>{etiqueta}</dt>
      <dd><strong class="num">{valor == null ? '-' : `${num(valor, decimales)}${unidad}`}</strong>
        {antes != null && <span class="peq secundario"> antes {num(antes, decimales)}{unidad}{dif != null && dif !== 0 ? ` (${conSigno(dif, decimales)})` : ''}</span>}
        {sentido && <span class="sr"> ({sentido === 'sube' ? 'mejora' : 'empeora'})</span>}
        {extra && <span class="peq secundario"> {extra}</span>}
      </dd>
    </div>
  );
}

export function ProgresoRevision({ f, abierto: abiertoInicial = false, alPedir = null }) {
  const p = f.progreso;
  const [abierto, setAbierto] = useState(abiertoInicial);
  if (!p) return <p class="peq secundario rev-progreso-espera" role="status">Calculando su progreso...</p>;
  const { peso, medidas, comida, descanso } = p;
  return (
    <section class={`rev-prog ${abierto ? 'abierto' : ''}`} aria-label={`Progreso de ${f.nombre}`}>
      <button type="button" class="rev-prog-cab" aria-expanded={abierto ? 'true' : 'false'} onClick={() => setAbierto((v) => !v)}>
        <Semaforo progreso={p} />
        <span class="rev-prog-frase">{p.frase || 'Sin datos de progreso esta semana.'}</span>
        <span class="rev-prog-abrir peq"><Icono n={abierto ? 'arriba' : 'abajo'} /> {abierto ? 'Ocultar' : 'Ver el progreso'}</span>
      </button>
      {abierto && (
        <div class="rev-prog-cuerpo">
          {/* ------------------------------------------------ peso */}
          <section class={`rev-prog-bloque e-${COLOR[peso.estado]}`} aria-label="Peso">
            <h2><span class="luz" aria-hidden="true" />Peso</h2>
            {peso.sinPesos ? <p class="peq secundario">No se ha pesado en las últimas semanas.</p> : (
              <>
                <dl class="rev-cifras">
                  <Comparado etiqueta={peso.esta ? `Media, semana del ${fecha(peso.esta.lunes)}` : 'Media de la semana'} valor={peso.esta?.media} antes={peso.antes?.media} dif={peso.dif} unidad=" kg" decimales={1}
                    extra={peso.difPct != null && peso.dif !== 0 ? `${conSigno(peso.difPct)} %` : null} />
                  <div class="rev-cifra"><dt>Días que se ha pesado</dt><dd><strong class="num">{peso.diasEsta} de 7</strong>{peso.diasEsta < 3 && <span class="peq secundario"> (la media dice poco)</span>}</dd></div>
                  {peso.meta != null && (
                    <div class="rev-cifra"><dt>Hasta su objetivo ({num(peso.meta)} kg)</dt><dd>
                      <strong class="num">{peso.llegado ? 'Llegado' : peso.falta != null ? `${conSigno(peso.falta)} kg` : '-'}</strong>
                      {!peso.llegado && peso.prevision && <span class="peq secundario"> a este ritmo, unas {peso.prevision.semanas} semanas{peso.prevision.aTiempo === false ? ' (después de su fecha)' : ''}</span>}
                      {!peso.llegado && peso.alejandose && <span class="peq"> va alejándose</span>}
                    </dd></div>
                  )}
                </dl>
                <p class={`chip ${COLOR[peso.estado] === 'gris' ? 'info' : COLOR[peso.estado]}`}>{textoRitmo(peso)}{peso.contrario ? ' (dos semanas en contra)' : ''}</p>
                <Linea puntos={peso.semanas.map((w) => ({ valor: w.media }))} meta={peso.meta} etiqueta="Media semanal, 8 semanas" unidad=" kg" rangoMin={2} />
              </>
            )}
          </section>

          {/* ------------------------------------------------ medidas */}
          <section class={`rev-prog-bloque e-${COLOR[medidas.estado]}`} aria-label="Medidas">
            <h2><span class="luz" aria-hidden="true" />Medidas</h2>
            {medidas.nunca ? <p class="peq secundario">Aún no tiene medidas apuntadas.</p> : (
              <>
                <p class="peq secundario">Última, el {fecha(medidas.ultima)} (hace {medidas.diasDesde === 1 ? '1 día' : `${medidas.diasDesde} días`}){medidas.anterior ? `; la anterior, el ${fecha(medidas.anterior)}` : ''}{medidas.primeraBloque ? `; la primera del bloque, el ${fecha(medidas.primeraBloque)}` : ''}.</p>
                <div class="rev-tabla-env">
                  <table class="rev-tabla rev-medidas">
                    <thead><tr><th scope="col">Perímetro</th><th scope="col">Última</th><th scope="col">Frente a la anterior</th>{medidas.primeraBloque && <th scope="col">Desde el inicio del bloque</th>}</tr></thead>
                    <tbody>{medidas.cambios.map((c) => (
                      <tr key={c.clave}><th scope="row">{c.etiqueta}</th><td class="num">{num(c.ultima)} cm</td><td class="num">{c.dif == null ? '-' : `${conSigno(c.dif)} cm`}</td>{medidas.primeraBloque && <td class="num">{c.difBloque == null ? '-' : `${conSigno(c.difBloque)} cm`}</td>}</tr>
                    ))}</tbody>
                  </table>
                </div>
                {medidas.juntos && <p class="peq rev-juntos">{medidas.juntos}.</p>}
              </>
            )}
            {(medidas.pedir || medidas.nunca) && alPedir && <button type="button" class="btn btn-peq" onClick={() => alPedir(MENSAJE_MEDIDAS(f.nombre))}><Icono n="enviar" /> Pedirle las medidas</button>}
          </section>

          {/* ------------------------------------------------ comida */}
          {!comida.fuera && (
            <section class={`rev-prog-bloque e-${COLOR[comida.estado]}`} aria-label="Alimentación">
              <h2><span class="luz" aria-hidden="true" />Alimentación</h2>
              <dl class="rev-cifras">
                <Comparado etiqueta={`Adherencia${comida.deEstaSemana ? '' : ' (check-in de la semana pasada)'}`} valor={comida.adherencia.esta} antes={comida.adherencia.antes} dif={comida.adherencia.esta != null && comida.adherencia.antes != null ? Math.round((comida.adherencia.esta - comida.adherencia.antes) * 10) / 10 : null} unidad="/5" />
                {comida.menu.total > 0 && <Comparado etiqueta="Comidas del menú hechas" valor={comida.menu.pct} antes={comida.menu.pctAntes} dif={comida.menu.pct != null && comida.menu.pctAntes != null ? comida.menu.pct - comida.menu.pctAntes : null} unidad=" %" decimales={0} extra={`(${comida.menu.hechas} de ${comida.menu.total})`} />}
                {comida.kcal && <div class="rev-cifra"><dt>Calorías al día{comida.kcal.fuente === 'registro' ? ` (apuntadas ${comida.kcal.dias} días)` : ' (check-in)'}</dt><dd><strong class="num">{num(comida.kcal.media, 0)} kcal</strong>{comida.kcal.plan ? <span class="peq secundario"> su plan: {num(comida.kcal.plan, 0)} ({conSigno(comida.kcal.dif, 0)})</span> : null}</dd></div>}
                {comida.saciedad != null && <Comparado etiqueta="Saciedad" valor={comida.saciedad} antes={comida.saciedadAntes} dif={comida.saciedadAntes != null ? comida.saciedad - comida.saciedadAntes : null} unidad="/4" decimales={0} />}
              </dl>
              {comida.adherencia.porComida.length > 0 && (
                <ul class="rev-progreso">{comida.adherencia.porComida.map((x) => (
                  <li key={x.clave} class={`chip num ${comida.adherencia.peor?.clave === x.clave && x.esta < 4 ? 'aviso' : ''}`}>{x.etiqueta}: {x.esta}/5{x.antes != null && x.antes !== x.esta ? ` (antes ${x.antes})` : ''}{comida.adherencia.peor?.clave === x.clave && x.esta < 4 ? ' · la que más falla' : ''}</li>
                ))}</ul>
              )}
              {comida.menu.total > 0 && (
                <ol class="rev-tira" aria-label="Menú de la semana, día a día">
                  {comida.menu.dias.map((d) => <li key={d.fecha} class={d.total === 0 ? 'nada' : d.hechas >= d.total ? 'todo' : d.hechas > 0 ? 'parte' : 'cero'}><span class="dia">{['L', 'M', 'X', 'J', 'V', 'S', 'D'][comida.menu.dias.indexOf(d)]}</span><span class="cuenta num">{d.total ? `${d.hechas}/${d.total}` : '-'}</span></li>)}
                </ol>
              )}
              <Linea puntos={comida.serie} etiqueta="Adherencia del check-in, 6 semanas" min={1} max={5} unidad="/5" />
            </section>
          )}

          {/* ------------------------------------------------ descanso */}
          <section class={`rev-prog-bloque e-${COLOR[descanso.estado]}`} aria-label="Descanso y recuperación">
            <h2><span class="luz" aria-hidden="true" />Descanso y recuperación</h2>
            <dl class="rev-cifras">
              {descanso.sueno ? <Comparado etiqueta={`Sueño por noche (${descanso.sueno.fuente === 'salud' ? 'del iPhone' : 'del check-in'})`} valor={descanso.sueno.esta} antes={descanso.sueno.antes} dif={descanso.sueno.esta != null && descanso.sueno.antes != null ? Math.round((descanso.sueno.esta - descanso.sueno.antes) * 10) / 10 : null} unidad=" h"
                extra={descanso.sueno.fuente === 'salud' ? (descanso.sueno.cortas ? `${descanso.sueno.cortas} de ${descanso.sueno.noches} noches por debajo de 6 h` : null) : descanso.sueno.tramo ? `(tramo ${descanso.sueno.tramo} h)` : null} />
                : <div class="rev-cifra"><dt>Sueño</dt><dd class="peq secundario">Sin datos</dd></div>}
              {descanso.pasos && <Comparado etiqueta={`Pasos al día (${descanso.pasos.fuente === 'salud' ? 'del iPhone' : 'del check-in'})`} valor={descanso.pasos.esta} antes={descanso.pasos.antes} dif={descanso.pasos.antes != null ? descanso.pasos.esta - descanso.pasos.antes : null} decimales={0}
                extra={descanso.pasos.objetivo ? `objetivo ${num(descanso.pasos.objetivo, 0)}${descanso.pasos.esta >= descanso.pasos.objetivo ? ' (cumplido)' : ''}` : null} />}
              {descanso.fc && <Comparado etiqueta="Pulso en reposo (frente a sus 4 semanas anteriores)" valor={descanso.fc.esta} antes={descanso.fc.base} dif={descanso.fc.dif} unidad=" ppm" decimales={0} alReves />}
              {descanso.hrv && <Comparado etiqueta="VFC (frente a sus 4 semanas anteriores)" valor={descanso.hrv.esta} antes={descanso.hrv.base} dif={descanso.hrv.dif} unidad=" ms" decimales={0} />}
            </dl>
            {descanso.avisos.length > 0 && <p class="chip aviso">{descanso.avisos.join(' · ')}</p>}
            <div class="rev-lineas">
              <Linea puntos={descanso.series.energia} etiqueta="Energía, 6 semanas" min={1} max={5} unidad="/5" decimales={0} />
              <Linea puntos={descanso.series.recuperacion} etiqueta="Recuperación, 6 semanas" min={1} max={5} unidad="/5" decimales={0} />
              <Linea puntos={descanso.series.motivacion} etiqueta="Motivación, 6 semanas" min={1} max={5} unidad="/5" decimales={0} />
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
