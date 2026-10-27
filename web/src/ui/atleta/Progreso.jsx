import { useState } from 'preact/hooks';
import { Logros } from '../Logros.jsx';
import { TarjetaObjetivo } from '../Objetivos.jsx';
import { InformeBloque, ListaInformes } from '../InformeBloque.jsx';
import { Siluetas, useApp, useCarga, ErrorCaja, Grafica, GraficaPeso, Vacio, Icono, Hoja, Paso, Segmentos, Pista, useAncho } from '../comunes.jsx';
import { HistorialEjercicio } from '../Herramientas.jsx';
import { MapaMuscular } from '../MapaMuscular.jsx';
import { HistoriaSemana, rangoLargo } from './TuSemana.jsx';
import { VerArchivo, CompararVideos } from '../Archivos.jsx';
import { Diario } from '../Diario.jsx';
import { NutricionProgreso } from './Nutricion.jsx';
import { conNutricion } from '../../logica/nivel.js';
import { HabitosMes } from './Habitos.jsx';
import { Hilo } from '../Hilo.jsx';
import { num, signo, GRUPOS, MEDIDAS, e1rm, rangoVolumen, estadoVolumen, tendenciaPeso, ritmoPeso } from '../../logica/calculos.js';
import { fmtCorta, hoyISO, diasEntre, desdeISO, fmtConDia } from '../../logica/fechas.js';


// Contenido de progreso, reutilizado en la ficha del atleta del panel del coach
export function VistaProgreso({ atletaId, programa, esCoach = false, constanciaDada = null }) {
  const { api } = useApp();
  const { datos, cargando, error, recargar } = useCarga(() => api.progreso(atletaId), [atletaId]);
  const objetivos = useCarga(() => api.objetivos(atletaId).catch(() => []), [atletaId]);
  const constanciaPropia = useCarga(() => (constanciaDada ? Promise.resolve(null) : api.constancia(atletaId).catch(() => null)), [atletaId, !!constanciaDada]);
  const cardio = useCarga(() => api.cardioSemanas(atletaId, 8).catch(() => []), [atletaId]);
  const constanciaTotal = constanciaDada || constanciaPropia;
  const [ejId, setEjId] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [medida, setMedida] = useState('cintura_cm');
  if (cargando && !datos) return <Siluetas forma="tarjetas" n={4} texto="Cargando tu progreso" />;
  if (error) return <ErrorCaja error={error} reintentar={recargar} />;
  const { pesos, ejercicios, volumen, medidas } = datos;
  const ej = ejercicios.find((e) => e.id === ejId) || ejercicios[0];
  const seriePeso = tendenciaPeso(pesos);
  const ultPeso = seriePeso[seriePeso.length - 1] || null;
  const ventanaPeso = seriePeso.filter((p) => ultPeso && diasEntre(p.fecha, ultPeso.fecha) <= 63);
  const ritmo = ritmoPeso(seriePeso);
  const grupos = GRUPOS.map(([g, n]) => [g, n, volumen.estaSemana[g] || 0, volumen.anterior[g] || 0]).filter(([, , a, b]) => a || b);
  const objetivoVol = datos.volumenObjetivo;
  const maxVol = Math.max(24, ...grupos.map(([g, , a, b]) => Math.max(a, b, rangoVolumen(objetivoVol, g)[1] + 4)));
  const conMedida = MEDIDAS.filter(([k]) => medidas.some((m) => m[k] != null));
  const puntosMedida = medidas.filter((m) => m[medida] != null).map((m) => ({ x: m.fecha, y: Number(m[medida]) }));
  const objActivos = (objetivos.datos || []).filter((o) => o.estado !== 'descartado');

  let constancia = null;
  if (programa?.semanas?.length) {
    const filas = programa.semanas.map((s) => { const ss = programa.sesiones[s.id] || []; return { n: s.numero, hechas: ss.filter((x) => x.completada).length, total: ss.length }; });
    const hechas = filas.reduce((t, f) => t + f.hechas, 0), total = filas.reduce((t, f) => t + f.total, 0);
    constancia = { filas, hechas, total };
  }

  return (
    <>
      {objActivos.length > 0 && (
        <section class="seccion">
          <h2>{esCoach ? 'Objetivos' : 'Tus objetivos'}</h2>
          <div class="panel"><ul class="lista">
            {objActivos.map((o) => <TarjetaObjetivo key={o.id} o={o} esCoach={esCoach} />)}
          </ul></div>
        </section>
      )}

      <section class="seccion">
        <h2>Peso corporal</h2>
        <div class="panel panel-pad pila">
          {!ultPeso ? <p class="secundario">Aún no hay pesos registrados. Se apuntan desde Hoy o en el check-in semanal.</p> : (
            <>
              <div class="cifra">
                <span class="v num">{num(ultPeso.tendencia)}</span><span class="u">kg de tendencia</span>
                {ritmo && <span class="chip num">{signo(ritmo.kgSemana, 2)} kg por semana ({signo(ritmo.pctSemana)} %)</span>}
              </div>
              <GraficaPeso serie={ventanaPeso} etiqueta={`Peso: tendencia ${num(ultPeso.tendencia)} kg${ritmo ? `, ${signo(ritmo.kgSemana, 2)} kg por semana` : ''}`} />
              <p class="mini terciario">Cada punto es una pesada; la línea, la tendencia (media que suaviza el agua y la sal del día a día). El ritmo sale de las pesadas de las últimas 3 semanas.</p>
            </>
          )}
        </div>
      </section>

      {conMedida.length > 0 && (
        <section class="seccion">
          <h2>Medidas</h2>
          <div class="panel panel-pad pila">
            <div class="selector-chips" role="group" aria-label="Medida">
              {conMedida.map(([k, t]) => <button key={k} aria-pressed={k === medida ? 'true' : 'false'} onClick={() => setMedida(k)}>{t}</button>)}
            </div>
            {puntosMedida.length > 0 && (
              <div class="cifra">
                <span class="v num">{num(puntosMedida[puntosMedida.length - 1].y)}</span><span class="u">cm, el {fmtCorta(puntosMedida[puntosMedida.length - 1].x)}</span>
                {puntosMedida.length > 1 && <span class="chip num">{signo(puntosMedida[puntosMedida.length - 1].y - puntosMedida[0].y)} cm desde el {fmtCorta(puntosMedida[0].x)}</span>}
              </div>
            )}
            {puntosMedida.length > 1 ? <Grafica puntos={puntosMedida} unidad="cm" etiqueta={`Evolución de ${medida.replace('_cm', '')}`} />
              : <p class="peq secundario">Con dos mediciones aparece la gráfica. Se apuntan en el check-in cada 4 semanas.</p>}
          </div>
        </section>
      )}

      <section class="seccion">
        <h2>Fuerza (1RM estimado)</h2>
        {!ejercicios.length ? <div class="panel"><Vacio icono="progreso" titulo="Sin datos todavía">Cuando registres series, aquí verás tu 1RM estimado semana a semana.</Vacio></div> : (
          <div class="panel panel-pad pila">
            <div class="selector-chips" role="group" aria-label="Ejercicio">
              {ejercicios.slice(0, 12).map((e) => (
                <button key={e.id} aria-pressed={e.id === ej.id ? 'true' : 'false'} onClick={() => setEjId(e.id)}>{e.nombre}</button>
              ))}
            </div>
            <div class="cifra">
              <span class="v num">{num(ej.puntos[ej.puntos.length - 1].valor)}</span><span class="u">kg, semana del {fmtCorta(ej.puntos[ej.puntos.length - 1].semana)}</span>
              {ej.puntos.length > 1 && <span class="chip ok num">{signo(ej.puntos[ej.puntos.length - 1].valor - ej.puntos[0].valor)} kg desde el inicio</span>}
            </div>
            {ej.puntos.length > 1 ? <Grafica puntos={ej.puntos.map((p) => ({ x: p.semana, y: p.valor }))} unidad="kg" etiqueta={`1RM estimado en ${ej.nombre}`} />
              : <p class="peq secundario">Con dos semanas de datos aparece la gráfica.</p>}
            <button class="btn-texto" style="justify-self:start" onClick={() => setHistorial(ej)}><Icono n="historial" /> Gráficas, récords e historial</button>
            <p class="mini terciario">Mejor serie de cada semana, con la fórmula de Epley y contando las repeticiones en recámara (RIR = 10 − RPE).</p>
          </div>
        )}
      </section>

      <Vitrina datos={datos.vitrina} esCoach={esCoach} abrir={(x) => setHistorial({ id: x.id, nombre: x.nombre })} />

      <Marcas atletaId={atletaId} ejercicios={ejercicios} esCoach={esCoach} />

      <section class="seccion">
        <h2>Series por músculo esta semana</h2>
        <div class="panel panel-pad pila">
          {grupos.length > 0 && <MapaMuscular series={volumen.estaSemana} etiqueta="Series por músculo esta semana" />}
          {!grupos.length ? <p class="secundario">Sin series registradas estas dos semanas.</p> : (
            <div class="barras">
              {grupos.map(([g, nombre, a, b]) => {
                const [min, max] = rangoVolumen(objetivoVol, g);
                const estado = estadoVolumen(a, [min, max]);
                return (
                  <div class={`barra-fila vol-${estado}`} key={g}>
                    <span>{nombre}</span>
                    <span class="pista" role="img" aria-label={`${nombre}: ${num(a)} series esta semana (objetivo de ${min} a ${max}), ${num(b)} la anterior`}>
                      <span class="banda" style={{ left: `${(min / maxVol) * 100}%`, width: `${((max - min) / maxVol) * 100}%` }} />
                      <span class="relleno" style={{ width: `${(a / maxVol) * 100}%` }} />
                      {b > 0 && <span class="previo" style={{ left: `calc(${(b / maxVol) * 100}% - 1px)` }} />}
                    </span>
                    <span class="v">{num(a)}</span>
                  </div>
                );
              })}
            </div>
          )}
          <p class="mini terciario">La franja es {objetivoVol ? 'el rango de series semanales que te ha marcado tu coach' : 'un rango orientativo de 10 a 20 series semanales por músculo'}{esCoach ? ' (se ajusta abajo, en «Volumen objetivo»)' : ''}. La marca vertical, la semana pasada. El músculo principal de cada ejercicio cuenta 1 serie y los secundarios, media.</p>
        </div>
      </section>

      {(constanciaTotal.datos || constancia) && (
        <section class="seccion">
          <div class="seccion-cab">
            <h2>Constancia</h2>
            {constanciaTotal.datos?.racha > 0 && <span class="racha"><Icono n="llama" />{constanciaTotal.datos.racha === 1 ? '1 semana completa' : `${constanciaTotal.datos.racha} semanas completas seguidas`}</span>}
          </div>
          <div class="panel panel-pad pila">
            {constanciaTotal.datos && (
              <>
                <Calendario mapa={constanciaTotal.datos.mapa} />
                <p class="mini terciario">Últimas 12 semanas: {constanciaTotal.datos.diasEntrenados} {constanciaTotal.datos.diasEntrenados === 1 ? 'día entrenado' : 'días entrenados'}. Más oscuro, más series ese día.</p>
              </>
            )}
            {constancia && (
              <div class="pila-s">
                <span class="peq secundario">En este bloque, {constancia.hechas} de {constancia.total} sesiones</span>
                {constancia.filas.map((f) => (
                  <div class="separa" key={f.n}>
                    <span class="peq">Semana {f.n}</span>
                    <span class="pips" role="img" aria-label={`${f.hechas} de ${f.total} sesiones`}>{Array.from({ length: f.total }, (_, i) => <i key={i} class={i < f.hechas ? 'hecha' : ''} />)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
      {cardio.datos?.some((w) => w.sesiones > 0) && (
        <section class="seccion">
          <h2>Cardio</h2>
          <div class="panel panel-pad pila">
            <GraficaCardio semanas={cardio.datos} />
            <TotalesCardio semanas={cardio.datos} />
            <p class="mini terciario">Minutos de cardio por semana (y los kilómetros, si los apuntas), de lo que registras al terminar cada sesión.</p>
          </div>
        </section>
      )}
      {historial && <HistorialEjercicio atletaId={atletaId} ejercicio={historial} alCerrar={() => setHistorial(null)} />}
    </>
  );
}

// Minutos de cardio por semana, en barras; los km, encima de cada barra
function GraficaCardio({ semanas }) {
  const [W, ref] = useAncho();
  const H = 160, izq = 8, der = 8, arr = 34, abj = 20;
  const max = Math.max(30, ...semanas.map((w) => w.minutos));
  const n = semanas.length;
  const ancho = (W - izq - der) / n;
  const Y = (v) => arr + (1 - v / max) * (H - arr - abj);
  return (
    <svg class="grafica grafica-cardio" ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Cardio por semana: ${semanas.map((w) => `${w.minutos} minutos`).join(', ')}`}>
      {semanas.map((w, i) => {
        const x = izq + i * ancho + ancho * 0.18, bw = ancho * 0.64;
        const vacia = !w.minutos;
        return (
          <g key={w.lunes}>
            <rect class={`barra ${vacia ? 'vacia' : ''} ${i === n - 1 ? 'ultima' : ''}`} x={x} width={bw} y={vacia ? H - abj - 3 : Y(w.minutos)} height={vacia ? 3 : H - abj - Y(w.minutos)} rx="5" />
            {!vacia && <text class="v" x={x + bw / 2} y={Y(w.minutos) - 6} text-anchor="middle">{w.minutos}'</text>}
            {!vacia && w.km > 0 && <text x={x + bw / 2} y={Y(w.minutos) - 19} text-anchor="middle">{num(w.km, 1)} km</text>}
            {(i === 0 || i === n - 1 || i === Math.floor((n - 1) / 2)) && <text x={x + bw / 2} y={H - 5} text-anchor="middle">{fmtCorta(w.lunes)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function TotalesCardio({ semanas }) {
  const con = semanas.filter((w) => w.sesiones > 0);
  const ult = semanas[semanas.length - 1];
  const media = Math.round(semanas.reduce((t, w) => t + w.minutos, 0) / semanas.length);
  const km = Math.round(semanas.reduce((t, w) => t + w.km, 0) * 10) / 10;
  return (
    <div class="cardio-totales">
      <span>Esta semana: <b>{ult.minutos} min</b>{ult.km ? <> y <b>{num(ult.km, 1)} km</b></> : null}</span>
      <span>Media de {semanas.length} semanas: <b>{media} min</b></span>
      {km > 0 && <span>Total: <b>{num(km, 1)} km</b></span>}
      <span><b>{con.reduce((t, w) => t + w.sesiones, 0)}</b> sesiones</span>
    </div>
  );
}

// 12 semanas de lunes a domingo; cada cuadro, un día (más oscuro, más series)
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function Calendario({ mapa }) {
  const hoy = hoyISO();
  const entrenados = mapa.flatMap((w) => w.dias).filter((d) => d.nivel > 0).length;
  return (
    <div class="calendario" role="img" aria-label={`Días entrenados en las últimas 12 semanas: ${entrenados}`}>
      <span />
      {mapa.map((w, i) => {
        const m = desdeISO(w.lunes).getMonth();
        const nuevo = i === 0 || m !== desdeISO(mapa[i - 1].lunes).getMonth();
        return <span class="cal-mes" key={w.lunes}>{nuevo && i < mapa.length - 1 ? MESES[m] : ''}</span>;
      })}
      {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, r) => [
        <span class="cal-dia" key={`d${r}`}>{r % 2 === 0 ? d : ''}</span>,
        ...mapa.map((w) => {
          const c = w.dias[r];
          return <i key={c.iso} class={`cal-celda ${c.nivel < 0 ? 'futuro' : `n${c.nivel}`} ${c.iso === hoy ? 'hoy' : ''}`} title={c.nivel < 0 ? '' : `${fmtConDia(c.iso)}: ${c.n ? `${c.n} ${c.n === 1 ? 'serie' : 'series'}` : 'descanso'}`} />;
        }),
      ])}
    </div>
  );
}

// La mejor marca de cada ejercicio; en morado, las conseguidas en los últimos 30 días
function Vitrina({ datos, esCoach, abrir }) {
  const [todas, setTodas] = useState(false);
  if (!datos?.ejercicios.length) return null;
  const hace30 = new Set(datos.recientes.map((r) => r.ejercicio_id));
  const lista = todas ? datos.ejercicios : datos.ejercicios.slice(0, 6);
  return (
    <section class="seccion">
      <div class="seccion-cab">
        <h2>Vitrina de récords</h2>
        {datos.recientes.length > 0 && <span class="chip morado num">{datos.recientes.length} {datos.recientes.length === 1 ? 'récord' : 'récords'} en 30 días</span>}
      </div>
      <div class="panel">
        <ul class="lista">
          {lista.map((x) => (
            <li key={x.id}>
              <button class={`vitrina-fila ${hace30.has(x.id) ? 'reciente' : ''}`} onClick={() => abrir(x)}>
                <span class="ico"><Icono n="trofeo" /></span>
                <span class="texto">
                  <strong>{x.nombre}</strong>
                  <span class="peq secundario">
                    {x.e1rm ? `${num(x.e1rm.kg, 2)} kg × ${x.e1rm.reps}${x.e1rm.rpe ? ` @${num(x.e1rm.rpe)}` : ''}${x.e1rm.fecha ? `, ${fmtCorta(x.e1rm.fecha)}` : ''}` : 'Sin carga'}
                  </span>
                </span>
                <span class="valor num">{x.e1rm ? <>{num(x.e1rm.valor)}<small> kg</small></> : <>{x.repsSinCarga}<small> rep</small></>}</span>
              </button>
            </li>
          ))}
        </ul>
        {!todas && datos.ejercicios.length > 6 && <div class="panel-pad" style="padding-top:0"><button class="btn-texto" onClick={() => setTodas(true)}>Ver los {datos.ejercicios.length} ejercicios</button></div>}
      </div>
      <p class="mini terciario">{esCoach ? 'Mejor serie de cada ejercicio' : 'Tu mejor serie de cada ejercicio'} (1RM estimado). En morado, los récords de los últimos 30 días. Toca uno para ver su historial.</p>
    </section>
  );
}

// Marcas de test o competición. El 1RM estimado de las series va aparte (arriba).
function Marcas({ atletaId, ejercicios, esCoach }) {
  const { api, aviso } = useApp();
  const marcas = useCarga(() => api.marcas(atletaId).catch(() => []), [atletaId]);
  const [nueva, setNueva] = useState(false);
  const lista = marcas.datos || [];
  if (!lista.length && !ejercicios.length && esCoach) return null;
  return (
    <section class="seccion">
      <div class="seccion-cab"><h2>Marcas</h2><button class="btn-texto" onClick={() => setNueva(true)}><Icono n="mas" /> Apuntar marca</button></div>
      <div class="panel">
        {!lista.length ? <p class="panel-pad peq secundario">Los tests y las competiciones van aquí: lo que levantas de verdad a 1, 3 o 5 repeticiones.</p> : (
          <ul class="lista">
            {lista.map((m) => (
              <li key={m.id} class="marca-fila">
                <span class="ico"><Icono n="trofeo" /></span>
                <span><strong>{m.ejercicio}</strong><br /><span class="peq secundario">{fmtCorta(m.fecha)}{m.tipo === 'competicion' ? ', en competición' : ', test'}{m.notas ? `. ${m.notas}` : ''}</span></span>
                <span class="num">{num(m.kg, 2)} kg × {m.reps}</span>
                <button class="btn btn-icono plano" aria-label={`Borrar la marca de ${m.ejercicio}`} onClick={async () => { await api.borrarMarca(m.id); marcas.recargar(true); aviso('Marca borrada'); }}><Icono n="basura" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {nueva && <NuevaMarca atletaId={atletaId} ejercicios={ejercicios} alCerrar={(hecha) => { setNueva(false); if (hecha) marcas.recargar(true); }} />}
    </section>
  );
}

function NuevaMarca({ atletaId, ejercicios, alCerrar }) {
  const { api, aviso } = useApp();
  const biblioteca = useCarga(() => (ejercicios.length ? Promise.resolve([]) : api.biblioteca()), []);
  const opciones = ejercicios.length ? ejercicios.map((e) => ({ id: e.id, nombre: e.nombre })) : (biblioteca.datos || []);
  const [f, setF] = useState({ ejercicio_id: '', kg: null, reps: 1, tipo: 'test', fecha: hoyISO(), notas: '' });
  const ejercicioId = f.ejercicio_id || opciones[0]?.id || '';
  return (
    <Hoja titulo="Apuntar marca" alCerrar={() => alCerrar(false)}>
      <form class="pila" onSubmit={async (e) => {
        e.preventDefault();
        if (!f.kg || !ejercicioId) return;
        try { await api.guardarMarca({ atleta_id: atletaId, ejercicio_id: ejercicioId, kg: f.kg, reps: f.reps || 1, tipo: f.tipo, fecha: f.fecha, notas: f.notas.trim() || null }); aviso('Marca guardada'); alCerrar(true); }
        catch (err) { aviso(err.message, 'error'); }
      }}>
        <div class="campo"><label for="mr-ej">Ejercicio</label>
          <select id="mr-ej" class="selector" value={ejercicioId} onChange={(e) => setF({ ...f, ejercicio_id: e.currentTarget.value })}>
            {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select></div>
        <div class="rejilla-campos">
          <div class="campo"><label for="mr-kg">Kg</label><Paso id="mr-kg" valor={f.kg} paso={2.5} min={0} max={500} dec={2} etiqueta="kilos de la marca" alCambiar={(v) => setF({ ...f, kg: v })} /></div>
          <div class="campo"><label for="mr-reps">Repeticiones</label><Paso id="mr-reps" valor={f.reps} paso={1} min={1} max={20} dec={0} etiqueta="repeticiones de la marca" alCambiar={(v) => setF({ ...f, reps: v || 1 })} /></div>
        </div>
        {f.kg > 0 && f.reps > 1 && f.reps <= 12 && <p class="peq secundario">Equivale a un 1RM estimado de {num(e1rm({ kg: f.kg, reps: f.reps, rir: 0 }))} kg.</p>}
        <div class="campo"><span class="etq">Dónde</span><Segmentos etiqueta="Tipo de marca" valor={f.tipo} alCambiar={(v) => setF({ ...f, tipo: v || 'test' })} opciones={[['test', 'Test'], ['competicion', 'Competición']]} /></div>
        <div class="campo"><label for="mr-fecha">Fecha</label><input id="mr-fecha" type="date" class="entrada" value={f.fecha} max={hoyISO()} onInput={(e) => setF({ ...f, fecha: e.currentTarget.value })} /></div>
        <div class="campo"><label for="mr-notas">Nota</label><input id="mr-notas" class="entrada" value={f.notas} onInput={(e) => setF({ ...f, notas: e.currentTarget.value })} placeholder="Con cinturón, en casa, válida…" /></div>
        <button class="btn btn-primario btn-grande" disabled={!f.kg}>Guardar marca</button>
      </form>
    </Hoja>
  );
}

// Vídeos que el atleta ha enviado, con la respuesta del coach
// Resúmenes de las últimas semanas (cada uno se abre como historia)
function TusSemanas({ salud, lista }) {
  const [abierta, setAbierta] = useState(null);
  if (!lista.datos?.length) return null;
  return (
    <section class="seccion">
      <h2>Tus semanas</h2>
      <div class="panel">
        <ul class="lista">
          {lista.datos.map((r) => (
            <li key={r.lunes}>
              <button class="fila-semana" onClick={() => setAbierta(r)}>
                <span class="pila-xs">
                  <strong>Semana {rangoLargo(r.lunes, r.domingo)}</strong>
                  <span class="peq secundario">{r.sesiones.hechas} de {r.sesiones.total} sesiones, {r.series} series{r.records.length ? `, ${r.records.length} ${r.records.length === 1 ? 'récord' : 'récords'}` : ''}</span>
                </span>
                <Icono n="play" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      {abierta && <HistoriaSemana resumen={abierta} salud={salud} alCerrar={() => setAbierta(null)} />}
    </section>
  );
}

function TusBloques({ salud }) {
  const { api, atleta } = useApp();
  const lista = useCarga(() => api.informes(atleta.id, { salud }).catch(() => []), [atleta.id, salud]);
  const [abierto, setAbierto] = useState(null);
  const informes = (lista.datos || []).filter((r) => !r.vacio);
  if (!informes.length) return null;
  return (
    <section class="seccion">
      <h2>Tus bloques</h2>
      <ListaInformes informes={informes} alAbrir={setAbierto} />
      {abierto && <InformeBloque informe={abierto} salud={salud} alCerrar={() => setAbierto(null)} />}
    </section>
  );
}

// Las cifras de arriba: lo que más dice de la constancia, de un vistazo
function Cifras({ constancia, semanas }) {
  const c = constancia.datos;
  const ult = (semanas.datos || []).slice(0, 4);
  if (!c && !ult.length) return null;
  const records = ult.reduce((n, r) => n + (r.records?.length || 0), 0);
  const series = ult.reduce((n, r) => n + (r.series || 0), 0);
  const celdas = [
    c && { v: c.racha, k: c.racha === 1 ? 'semana completa seguida' : 'semanas completas seguidas', ico: 'llama', destaca: c.racha > 0 },
    c && { v: c.diasEntrenados, k: 'días entrenados en 12 semanas', ico: 'calendario' },
    ult.length > 0 && { v: series, k: `series en ${ult.length === 1 ? 'la última semana' : `${ult.length} semanas`}`, ico: 'hoy' },
    ult.length > 0 && { v: records, k: records === 1 ? 'récord reciente' : 'récords recientes', ico: 'trofeo', destaca: records > 0 },
  ].filter(Boolean);
  return (
    <dl class="cifras panel" aria-label="Tus cifras">
      {celdas.map((x) => (
        <div key={x.k} class={x.destaca ? 'destaca' : ''}>
          <dd class="num">{x.v}</dd>
          <dt><Icono n={x.ico} />{x.k}</dt>
        </div>
      ))}
    </dl>
  );
}

export function Progreso({ programa, salud }) {
  const { api, atleta } = useApp();
  const constancia = useCarga(() => api.constancia(atleta.id).catch(() => null), [atleta.id]);
  const semanas = useCarga(() => api.resumenesSemanales(atleta.id, 4).catch(() => []), [atleta.id]);
  return (
    <div class="contenido">
      <header class="cabecera"><div class="titulo"><h1>Tu progreso</h1></div></header>
      <Pista id="progreso" icono="progreso">Todo lo de aquí sale solo de lo que apuntas en cada sesión y en el check-in. No tienes que rellenar nada: entra de vez en cuando a ver cómo vas.</Pista>
      <Cifras constancia={constancia} semanas={semanas} />
      <TusSemanas salud={salud} lista={semanas} />
      <TusBloques salud={salud} />
      <Logros salud={salud} />
      <VistaProgreso atletaId={atleta.id} programa={programa.datos} constanciaDada={constancia} />
      {salud && <HabitosMes />}
      {salud && conNutricion(atleta) && <NutricionProgreso />}
      <Diario atletaId={atleta.id} nombreAtleta={atleta.nombre} salud={salud} />
    </div>
  );
}
