import { Fragment } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { mapaConstancia } from '../../logica/visual.js';
import { esPorSuCuenta } from '../../logica/esencial.js';
import { Logros } from '../Logros.jsx';
import { AnillosSemana } from './Anillos.jsx';
import { TarjetaObjetivo } from '../Objetivos.jsx';
import { PropuestasTuyas } from './ObjetivosTuyos.jsx';
import { InformeBloque, ListaInformes } from '../InformeBloque.jsx';
import { usePestanasDeslizables } from '../deslizar.js';
import { FinDePagina, CabeceraGrande, Siluetas, Reserva, useApp, useCarga, ErrorCaja, Grafica, GraficaPeso, GraficaFantasma, Vacio, Icono, Hoja, Paso, Segmentos, Pista, useAncho, Odometro, CifraSube, Pestanas } from '../comunes.jsx';
import { metaFuerza, metaPeso, ritmoFrenteMeta, CuerpoEnCifras, MiniLinea, BloqueAros, LineaAncha } from './ProgresoPiezas.jsx';
import { Ampliable, GraficaComparar, FlechaCifra, DiasSemanaMini, EscaleraRecords, PodioRecords, useTrofeosNuevos } from './ProgresoPiezas2.jsx';
import { periodoAnterior, compararEjercicios, cifrasFrente, serieCifras, escaleraRecords, musculosRecord, diasCheckin } from '../../logica/progreso-visual-2.js';
import { SUBS_PROGRESO, EVENTO_SUB_PROGRESO, tomarSubProgreso } from './sub-progreso.js';
import { Conexiones } from './Conexiones.jsx';
import { GrupoReloj } from './Reloj.jsx';
import { RANGOS_GRAFICA, filtrarRango, rangoConDatos } from '../../logica/rangos.js';
import { destacados as calcularDestacados, tonelajePorSemana } from '../../logica/destacados.js';
import { unirUnidades } from '../../logica/formato-numero.js';
import { calendarioRacha } from '../../logica/racha.js';
import { PantallaRacha } from './Racha.jsx';
import { HistorialEjercicio } from '../Herramientas.jsx';
import { MapaMuscular } from '../MapaMuscular.jsx';
import { DetalleMusculo, DosSemanas } from './datos-vista.jsx';
import { elegirSemana } from '../../logica/datos-vista.js';
import { sinMovimiento } from '../transiciones.js';
import { GuiasDeGrupos } from '../Guias.jsx';
import { HistoriaSemana, rangoLargo } from './TuSemana.jsx';
import { TusMeses } from './TusMeses.jsx';
import { VerArchivo, CompararVideos } from '../Archivos.jsx';
import { Diario } from '../Diario.jsx';
import { MiTecnica } from '../tecnica/MiTecnica.jsx';
import { NutricionProgreso } from './Nutricion.jsx';
import { conNutricion, conEntrenamiento } from '../../logica/nivel.js';
import { HabitosMes } from './Habitos.jsx';
import { Hilo } from '../Hilo.jsx';
import { num, signo, GRUPOS, MEDIDAS, e1rm, rangoVolumen, estadoVolumen, tendenciaPeso, ritmoPeso } from '../../logica/calculos.js';
import { historiaRecords } from '../../logica/diseno.js';
import { HojaCompartir } from '../Compartir.jsx';
import { datosRecord } from '../../logica/compartir.js';
import { fmtCorta, hoyISO, diasEntre, fmtConDia, lunesDe, sumarDias } from '../../logica/fechas.js';
import { CifraObjetivo, TusEjercicios } from './Personal.jsx';
import { FilaTuAnio } from './TuAnio.jsx';
import { enLibras, pesoNum, pesoTxt, etiquetaPeso, difVista, deVista, vista, nombrePeso } from '../../logica/unidades.js';
import { Imagen, hayImagen } from '../Imagen.jsx';
import { anadirImagenes } from '../../logica/imagenes.js';
import LISTA_TROZOS from '../../datos/imagenes-trozos.json';

// (belleza 175) las cabeceras ilustradas de las pestañas: su lista viaja con Progreso (datos/imagenes-trozos.json)
anadirImagenes(LISTA_TROZOS);

// La explicación de una gráfica, plegada bajo «Cómo se calcula» (antes, un párrafo fijo debajo de cada una)
function NotaGrafica({ titulo = 'Cómo se calcula', children }) {
  return <details class="nota-grafica"><summary><Icono n="pregunta" />{titulo}</summary><p class="mini terciario">{children}</p></details>;
}
// Un trozo de Progreso con su sub-pestaña (o varias, separadas por espacios): no pinta caja, solo lo agrupa
function Grupo({ g, children }) { return <div class="prog-grupo" data-grupo={g}>{children}</div>; }

// Contenido de progreso, reutilizado en la ficha del atleta del panel del coach
// entrenamiento: false a quien solo le llevas la nutrición (v0.26): sin fuerza, series, constancia ni cardio
// v0.52: el selector de rango de las gráficas (1M · 3M · 6M · Todo), como en Revolut o Robinhood
function SelectorRango({ valor, alCambiar, etiqueta }) {
  return <Segmentos opciones={RANGOS_GRAFICA.map(([k, t, , largo]) => [k, t, largo])} valor={valor} alCambiar={(v) => v && alCambiar(v)} etiqueta={etiqueta} clase="seg-compacto seg-rango" />;
}
const nombreRango = (k) => RANGOS_GRAFICA.find(([x]) => x === k)?.[3] || '';
// (v0.204) el periodo de antes, para la línea en gris detrás de la de ahora
const PREVIO = { '1m': 'el mes anterior', '3m': 'los 3 meses anteriores', '6m': 'los 6 meses anteriores' };
// (vista 266) la última pesada que se ha visto caer en la gráfica (solo su fecha)
const CLAVE_PESO_VISTO = 'fbe-peso-visto';
const conSigno = (v, dec = 1) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${num(Math.abs(v), dec)}`;

// (v0.204) llamada: en el modo llamada del coach (pantalla completa para compartirla con él): sin lo que solo es para el
// coach (apuntar o borrar marcas, la nota de dónde se ajusta el volumen)
export function VistaProgreso({ atletaId, programa, esCoach = false, constanciaDada = null, entrenamiento = true, irA = null, progresoDado = null, salud = false, objetivosDados = null, llamada = false }) {
  const { api, atleta, propio: modoAtletaCoach } = useApp();
  // (v0.213) con recuerdo: al volver a esta vista (o a la ficha del mismo atleta) sale al momento y se pone al día por detrás
  const rv = (que, si = true) => (si ? { recuerdo: `vista-progreso:${api.uid()}:${atletaId}:${que}` } : {});
  const propio = useCarga(() => (progresoDado ? Promise.resolve(null) : api.progreso(atletaId)), [atletaId, !!progresoDado], rv('progreso', !progresoDado));
  const { datos, cargando, error, recargar } = progresoDado || propio;
  const objetivosPropios = useCarga(() => (objetivosDados ? Promise.resolve(null) : api.objetivos(atletaId).catch(() => [])), [atletaId, !!objetivosDados], rv('objetivos', !objetivosDados));
  const objetivos = objetivosDados || objetivosPropios;
  const constanciaPropia = useCarga(() => (constanciaDada ? Promise.resolve(null) : api.constancia(atletaId).catch(() => null)), [atletaId, !!constanciaDada], rv('constancia', !constanciaDada));
  const cardio = useCarga(() => api.cardioSemanas(atletaId, 8).catch(() => []), [atletaId], rv('cardio'));
  const constanciaTotal = constanciaDada || constanciaPropia;
  const [ejId, setEjId] = useState(null);
  const [semanaVer, setSemanaVer] = useState(null);  // (belleza 181) el lunes de la semana que se abre desde una gráfica
  const [historial, setHistorial] = useState(null);
  const [medida, setMedida] = useState('cintura_cm');
  // v0.52: el rango de cada gráfica (el de entrada, 3 meses; si no hay dos puntos ahí, el siguiente que los tenga)
  const [rangoPeso, setRangoPeso] = useState(null);
  const [rangoFuerza, setRangoFuerza] = useState(null);
  const [rangoTon, setRangoTon] = useState(null);
  // (v0.203) los bloques (sus franjas de fondo en 6M y Todo), las marcas de test (rombos en el 1RM) y qué semana de
  // series por músculo se ve
  const bloques = useCarga(() => api.bloquesDe(atletaId).catch(() => []), [atletaId], rv('bloques'));
  const marcas = useCarga(() => api.marcas(atletaId).catch(() => []), [atletaId], rv('marcas'));
  const [semanaVol, setSemanaVol] = useState('esta');
  // (vista 260 y 268) el músculo que se ha tocado (en el mapa o en su barra): { g, desde: 'mapa' | 'barra' }
  const [musc, setMusc] = useState(null);
  const mapaRef = useRef(null);
  useLayoutEffect(() => {
    const m = mapaRef.current;
    if (!m) return;
    for (const el of m.querySelectorAll('.musculo[data-g]')) { if (musc && el.dataset.g === musc.g) el.setAttribute('data-on', ''); else el.removeAttribute('data-on'); }
  });
  // (v0.204) comparar dos o tres ejercicios en la misma gráfica (en % desde el principio del rango)
  const [comparar, setComparar] = useState(false);
  const [elegidos, setElegidos] = useState([]);
  const [fasePeso, setFasePeso] = useState({ fecha: null, fase: null });
  const pesoRef = useRef(null);
  useEffect(() => {
    if (!datos?.pesos?.length || fasePeso.fecha !== null) return;
    const ult = datos.pesos[datos.pesos.length - 1]?.fecha;
    let visto = null;
    try { visto = localStorage.getItem(CLAVE_PESO_VISTO); } catch { /* */ }
    const reciente = ult && diasEntre(ult, hoyISO()) <= 3;
    if (!ult || !reciente || (visto && visto >= ult) || sinMovimiento()) { setFasePeso({ fecha: '', fase: null }); try { if (ult) localStorage.setItem(CLAVE_PESO_VISTO, ult); } catch { /* */ } return; }
    setFasePeso({ fecha: ult, fase: 'antes' });
  }, [datos?.pesos]);
  useEffect(() => {
    if (fasePeso.fase !== 'antes' || !pesoRef.current) return undefined;
    let t = 0;
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      t = setTimeout(() => {
        setFasePeso((f) => ({ ...f, fase: 'despues' }));
        try { localStorage.setItem(CLAVE_PESO_VISTO, fasePeso.fecha); } catch { /* */ }
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const c = pesoRef.current?.querySelector(`circle.pesada[data-f="${fasePeso.fecha}"]`);
          try { c?.animate([{ transform: 'translateY(-36px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1, offset: 0.7 }, { transform: 'translateY(-4px)' }, { transform: 'none' }], { duration: 620, easing: 'cubic-bezier(.3, .8, .4, 1)' }); } catch { /* */ }
        }));
      }, 380);
    }, { threshold: 0.35 });
    io.observe(pesoRef.current);
    return () => { io.disconnect(); clearTimeout(t); };
  }, [fasePeso.fase, fasePeso.fecha]);
  if (cargando && !datos) return <Siluetas forma="tarjetas" n={4} texto="Cargando tu progreso" />;
  if (error) return <ErrorCaja error={error} reintentar={recargar} />;
  const { pesos, ejercicios, volumen, medidas } = datos;
  const ej = ejercicios.find((e) => e.id === ejId) || ejercicios[0];
  const seriePeso = tendenciaPeso(pesos);
  const ultPeso = seriePeso[seriePeso.length - 1] || null;
  const hoy = hoyISO();
  const rP = rangoPeso || rangoConDatos(seriePeso, '3m', hoy, { clave: 'fecha' });
  const ventanaPeso = filtrarRango(seriePeso, rP, hoy, { clave: 'fecha' });
  const cambioPeso = ventanaPeso.length > 1 ? ventanaPeso[ventanaPeso.length - 1].tendencia - ventanaPeso[0].tendencia : null;
  // (vista 266) el peso que acabas de apuntar cae en tu línea: la gráfica sale sin él y, al verse, el punto cae en su sitio y
  // la tendencia se recoloca (solo el atleta, una vez por pesada nueva; en el móvil solo se guarda la fecha vista)
  const nuevoPeso = !esCoach && !llamada && fasePeso.fecha && ventanaPeso.length >= 3 && ventanaPeso[ventanaPeso.length - 1].fecha === fasePeso.fecha ? fasePeso : null;
  const pesoVista = nuevoPeso?.fase === 'antes' ? ventanaPeso.slice(0, -1) : ventanaPeso;
  const semanasTon = tonelajePorSemana(datos.tonelaje || {});
  const rT = rangoTon || rangoConDatos(semanasTon, '3m', hoy, { clave: 'semana', semanal: true });
  const ventanaTon = filtrarRango(semanasTon, rT, hoy, { clave: 'semana', semanal: true });
  // (v0.203) la semana de ahora aún no ha acabado: en la gráfica va en claro y no baja la media
  const tonEnCurso = ventanaTon.length > 0 && ventanaTon[ventanaTon.length - 1].semana === lunesDe(hoy);
  const cerradasTon = tonEnCurso && ventanaTon.length > 1 ? ventanaTon.slice(0, -1) : ventanaTon;
  const mediaTon = cerradasTon.length ? cerradasTon.reduce((t, w) => t + w.valor, 0) / cerradasTon.length / 1000 : 0;
  const mejorTon = ventanaTon.length ? Math.max(...ventanaTon.map((w) => w.valor)) / 1000 : 0;
  const ritmo = ritmoPeso(seriePeso);
  // (v0.203) esta semana (aún en curso) o la pasada (cerrada)
  const volPasada = semanaVol === 'pasada';
  const volFuente = volPasada ? volumen.anterior : volumen.estaSemana;
  const grupos = GRUPOS.map(([g, n]) => [g, n, volFuente[g] || 0, volPasada ? 0 : volumen.anterior[g] || 0]).filter(([, , a, b]) => a || b);
  const objetivoVol = datos.volumenObjetivo;
  const maxVol = Math.max(24, ...grupos.map(([g, , a, b]) => Math.max(a, b, rangoVolumen(objetivoVol, g)[1] + 4)));
  const conMedida = MEDIDAS.filter(([k]) => medidas.some((m) => m[k] != null));
  // (v0.203) si la elegida no tiene datos (de serie, la cintura), la primera que los tenga
  const medidaV = conMedida.some(([k]) => k === medida) ? medida : conMedida[0]?.[0] || medida;
  const puntosMedida = medidas.filter((m) => m[medidaV] != null).map((m) => ({ x: m.fecha, y: Number(m[medidaV]) }));
  const objActivos = (objetivos.datos || []).filter((o) => o.estado !== 'descartado');
  const largo = (r) => r === '6m' || r === 'todo';
  const metaP = metaPeso(objActivos);
  const frenteMeta = ritmoFrenteMeta(ritmo, ultPeso?.tendencia, metaP);

  // (v0.204) el periodo anterior detrás de la línea (peso y tonelaje) y los días con pesada del rango
  const previoPeso = periodoAnterior(seriePeso, rP, hoy, { clave: 'fecha' });
  const diasPesadaRango = new Set(ventanaPeso.map((p) => p.fecha)).size;
  const graficaPeso = (alto) => (
    <GraficaPeso serie={pesoVista} clave={nuevoPeso ? `${rP}:${nuevoPeso.fase}` : rP} meta={metaP} bloques={largo(rP) ? bloques.datos : null} previo={previoPeso} textoPrevio={PREVIO[rP]} alto={alto}
      etiqueta={`Peso: tendencia ${num(ultPeso.tendencia)} kg${ritmo ? `, ${signo(ritmo.kgSemana, 2)} kg por semana` : ''}`} />
  );
  const previoTon = periodoAnterior(semanasTon, rT, hoy, { clave: 'semana', semanal: true }).map((w) => ({ x: w.semana, y: Math.round(w.valor / 100) / 10 }));
  // (belleza 181) tocar un punto de una gráfica semanal abre lo que hiciste esa semana (las ya cerradas; el atleta)
  const abrirSemana = (pts) => (!esCoach && !llamada ? { alAbrir: (i) => setSemanaVer(pts[i].x), abrible: (i) => !!pts[i] && pts[i].x < lunesDe(hoy), textoAbrir: (i) => `Ver la semana del ${fmtCorta(pts[i].x)}` } : {});
  const ptsTon = ventanaTon.map((w) => ({ x: w.semana, y: Math.round(w.valor / 100) / 10 }));
  const graficaTon = (alto) => <Grafica records clave={rT} enCurso={tonEnCurso} bloques={largo(rT) ? bloques.datos : null} previo={previoTon} textoPrevio={PREVIO[rT]} alto={alto} puntos={ptsTon} unidad="t" etiqueta="Tonelaje por semana" {...abrirSemana(ptsTon)} />;
  // la fuerza: con su rango, su objetivo dentro de la gráfica (v0.203), sus tests como rombos y, en 6M y Todo, los bloques
  // de fondo; o, al comparar, dos o tres ejercicios en % desde el principio del rango (v0.204)
  const rFuerzaV = ej ? rangoFuerza || rangoConDatos(ej.puntos, '3m', hoy, { clave: 'semana', semanal: true }) : '3m';
  const ptsF = ej ? filtrarRango(ej.puntos, rFuerzaV, hoy, { clave: 'semana', semanal: true }) : [];
  const metaF = ej ? metaFuerza(objActivos, ej.id) : null;
  const marcasEj = ej ? filtrarRango((marcas.datos || []).filter((m) => m.ejercicio_id === ej.id && Number(m.kg) > 0)
    .map((m) => ({ x: m.fecha, y: difVista(e1rm({ kg: Number(m.kg), reps: Number(m.reps) || 1, rir: 0 }) ?? Number(m.kg)), texto: `${pesoTxt(m.kg, 2)} × ${m.reps}` })), rFuerzaV, hoy, { clave: 'x' }) : [];
  const eleccionInicial = () => [ej.id, ...ejercicios.filter((e) => e.id !== ej.id && e.puntos.length > 1).map((e) => e.id)].filter((id) => ejercicios.find((e) => e.id === id)?.puntos.length > 1).slice(0, 2);
  const seriesComparar = comparar ? compararEjercicios(ejercicios, elegidos, rFuerzaV, hoy) : [];
  const previoF = ej ? periodoAnterior(ej.puntos, rFuerzaV, hoy, { clave: 'semana', semanal: true }).map((w) => ({ x: w.semana, y: difVista(w.valor) })) : [];
  const graficaFuerza = (alto) => (comparar
    ? (seriesComparar.length ? <GraficaComparar series={seriesComparar} alto={alto} /> : <p class="peq secundario">Elige dos o tres ejercicios con al menos dos semanas de datos en este rango.</p>)
    : <Grafica records clave={`${rFuerzaV}:${ej.id}`} puntos={ptsF.map((p) => ({ x: p.semana, y: difVista(p.valor), texto: p.kg > 0 && p.reps > 0 ? `${pesoTxt(p.kg, 2)} × ${p.reps}` : '' }))} unidad={etiquetaPeso()} etiqueta={`1RM estimado en ${ej.nombre}`}
      meta={metaF} marcas={marcasEj} bloques={largo(rFuerzaV) ? bloques.datos : null} previo={previoF} textoPrevio={PREVIO[rFuerzaV]} alto={alto} {...abrirSemana(ptsF.map((p) => ({ x: p.semana })))} />);
  const graficaMedida = (alto) => <Grafica puntos={puntosMedida} unidad="cm" alto={alto} etiqueta={`Evolución de ${medidaV.replace('_cm', '')}`} />;

  let constancia = null;
  if (programa?.semanas?.length) {
    const filas = programa.semanas.map((s) => { const ss = programa.sesiones[s.id] || []; return { n: s.numero, hechas: ss.filter((x) => x.completada).length, total: ss.length, fecha_inicio: s.fecha_inicio || null }; });
    const hechas = filas.reduce((t, f) => t + f.hechas, 0), total = filas.reduce((t, f) => t + f.total, 0);
    constancia = { filas, hechas, total };
  }

  return (
    <>
      {(objActivos.length > 0 || (!esCoach && !modoAtletaCoach && !esPorSuCuenta(atleta))) && (
        <section class="seccion seccion-objetivos" data-grupo="logros">
          <h2>{esCoach ? 'Objetivos' : 'Tus objetivos'}</h2>
          {objActivos.length > 0 && <div class="panel"><ul class="lista">
            {objActivos.map((o) => <TarjetaObjetivo key={o.id} o={o} esCoach={esCoach} />)}
          </ul></div>}
          {/* (v0.173) lo que propone él: lo que espera a su coach, lo que le ha contestado y «Proponer un objetivo» */}
          {!esCoach && !modoAtletaCoach && !esPorSuCuenta(atleta) && <PropuestasTuyas salud={salud} />}
        </section>
      )}

      <section class="seccion seccion-peso" data-grupo="cuerpo">
        <div class="seccion-cab">
          <h2>Peso corporal</h2>
          {ultPeso && seriePeso.length > 1 && <Ampliable titulo="Peso corporal">{(alto) => <>{graficaPeso(alto)}<SelectorRango valor={rP} alCambiar={setRangoPeso} etiqueta="Rango de la gráfica del peso" /></>}</Ampliable>}
        </div>
        <div class="panel panel-pad pila">
          {!ultPeso ? <GraficaFantasma forma="baja" texto="Aún no hay pesos registrados. Se apuntan desde Hoy o en el check-in semanal." /> : (
            <>
              <div class="cifra">
                <span class="v num">{num(ultPeso.tendencia)}</span><span class="u">kg de tendencia</span>
                {ritmo && <span class={`chip num ${frenteMeta === 'hacia' ? 'ok' : frenteMeta === 'contra' ? 'aviso' : ''}`}>{frenteMeta && <Icono n="diana" />}{signo(ritmo.kgSemana, 2)} kg por semana ({signo(ritmo.pctSemana)} %){frenteMeta && <span class="sr">{frenteMeta === 'hacia' ? ', hacia el objetivo' : ', en el otro sentido del objetivo'}</span>}</span>}
              </div>
              {cambioPeso != null && <p class="cambio-rango peq secundario"><Odometro texto={`${conSigno(cambioPeso)} kg`} clase="num" /> de tendencia en {nombreRango(rP)}</p>}
              <div ref={pesoRef} class="pnu-raiz">{graficaPeso()}</div>
              {ventanaPeso.length > 0 && <p class="mini terciario dias-bascula-txt num">{diasPesadaRango} {diasPesadaRango === 1 ? 'día' : 'días'} con pesada en {nombreRango(rP)}{previoPeso.length > 1 ? `; en gris, ${PREVIO[rP]}` : ''}</p>}
              {seriePeso.length > 1 && <SelectorRango valor={rP} alCambiar={setRangoPeso} etiqueta="Rango de la gráfica del peso" />}
              <NotaGrafica>Cada punto es una pesada; la línea, la tendencia (media que suaviza el agua y la sal del día a día). El ritmo sale de las pesadas de las últimas 3 semanas. Las marcas de abajo, sobre el eje, son los días que te pesaste.{metaP ? ' La línea discontinua es la meta de tu objetivo y la punteada, hacia dónde vas a este ritmo; el ritmo sale en verde si va hacia ella y en ámbar si va en el otro sentido.' : ''} En 1M, 3M y 6M, la línea gris es la tendencia del periodo anterior, puesta debajo para comparar. En 6M y Todo, las franjas de fondo son los bloques (B1, B2…).</NotaGrafica>
            </>
          )}
        </div>
      </section>

      {conMedida.length > 0 && (
        <section class="seccion" data-grupo="cuerpo">
          <div class="seccion-cab">
            <h2>Medidas</h2>
            {puntosMedida.length > 1 && <Ampliable titulo={`Medidas: ${(MEDIDAS.find(([k]) => k === medidaV)?.[1] || medidaV.replace('_cm', '')).toLowerCase()}`}>{(alto) => graficaMedida(alto)}</Ampliable>}
          </div>
          <div class="panel panel-pad pila">
            {/* (v0.203) tu cuerpo en cifras: cada medida en su sitio de la figura, con su cambio; tocar una la elige */}
            <CuerpoEnCifras medidas={medidas} claves={conMedida} elegida={puntosMedida.length ? medidaV : null} alElegir={setMedida} />
            {puntosMedida.length > 0 && (
              <div class="cifra">
                <span class="v num">{num(puntosMedida[puntosMedida.length - 1].y)}</span><span class="u">cm, el {fmtCorta(puntosMedida[puntosMedida.length - 1].x)}</span>
                {puntosMedida.length > 1 && <span class="chip num">{signo(puntosMedida[puntosMedida.length - 1].y - puntosMedida[0].y)} cm desde el {fmtCorta(puntosMedida[0].x)}</span>}
              </div>
            )}
            {puntosMedida.length > 1 ? graficaMedida()
              : <GraficaFantasma forma="baja" texto="Con dos mediciones aparece la gráfica. Se apuntan en el check-in cada 4 semanas." />}
          </div>
        </section>
      )}

      {entrenamiento && (<>
      <section class="seccion" data-grupo="fuerza">
        <div class="seccion-cab">
          <h2>Fuerza (1RM estimado)</h2>
          {ejercicios.length > 0 && (comparar || ptsF.length > 1) && <Ampliable titulo={comparar ? 'Comparar ejercicios' : `Fuerza: ${ej.nombre}`}>{(alto) => <>{graficaFuerza(alto)}<SelectorRango valor={rFuerzaV} alCambiar={setRangoFuerza} etiqueta="Rango de la gráfica del 1RM estimado" /></>}</Ampliable>}
        </div>
        {!ejercicios.length ? <div class="panel"><Vacio ilustracion="progreso" imagen="vacio-progreso" titulo="Sin datos todavía">Cuando registres series, aquí verás tu 1RM estimado semana a semana.</Vacio></div> : (
          <div class="panel panel-pad pila">
            {ejercicios.filter((e) => e.puntos.length > 1).length >= 2 && (
              <button type="button" class="btn-texto btn-comparar" aria-pressed={comparar ? 'true' : 'false'} onClick={() => { if (!comparar && !elegidos.length) setElegidos(eleccionInicial()); setComparar(!comparar); }}>
                <Icono n="duplicar" /> {comparar ? 'Ver uno solo' : 'Comparar ejercicios'}
              </button>
            )}
            {comparar ? (
              <div class="selector-chips chips-comparar" role="group" aria-label="Ejercicios que comparar (hasta 3)">
                {ejercicios.filter((e) => e.puntos.length > 1).slice(0, 12).map((e) => {
                  const k = elegidos.indexOf(e.id);
                  return <button key={e.id} class={k >= 0 ? `c${k + 1}` : ''} aria-pressed={k >= 0 ? 'true' : 'false'} disabled={k < 0 && elegidos.length >= 3}
                    onClick={() => setElegidos(k >= 0 ? elegidos.filter((x) => x !== e.id) : [...elegidos, e.id].slice(0, 3))}>{e.nombre}</button>;
                })}
              </div>
            ) : (
              <div class="selector-chips" role="group" aria-label="Ejercicio">
                {ejercicios.slice(0, 12).map((e) => (
                  <button key={e.id} aria-pressed={e.id === ej.id ? 'true' : 'false'} onClick={() => setEjId(e.id)}>{e.nombre}</button>
                ))}
              </div>
            )}
            {comparar ? graficaFuerza() : (() => {
              // v0.52: con su rango; la cifra rueda al cambiar de ejercicio y lo ganado en el rango, al cambiar de rango
              const rF = rFuerzaV, pts = ptsF;
              const ult = ej.puntos[ej.puntos.length - 1];
              const ganado = pts.length > 1 ? pts[pts.length - 1].valor - pts[0].valor : null;
              return (
                <>
                  <div class="cifra">
                    <CifraSube texto={pesoNum(ult.valor, 1)} clase="v num" /><span class="u">{etiquetaPeso()}, semana del {fmtCorta(ult.semana)}</span>
                    {ganado != null && <span class={`chip num ${ganado > 0 ? 'ok' : ''}`}><Odometro texto={`${conSigno(difVista(ganado))} ${etiquetaPeso()}`} /> en {nombreRango(rF)}</span>}
                  </div>
                  {pts.length > 1 ? graficaFuerza()
                    : ej.puntos.length > 1 ? <p class="peq secundario">En este rango hay menos de dos semanas con datos: prueba uno más amplio.</p>
                      : <GraficaFantasma texto="Con dos semanas de datos aparece la gráfica." />}
                  {ej.puntos.length > 1 && <SelectorRango valor={rF} alCambiar={setRangoFuerza} etiqueta="Rango de la gráfica del 1RM estimado" />}
                </>
              );
            })()}
            {comparar && <SelectorRango valor={rFuerzaV} alCambiar={setRangoFuerza} etiqueta="Rango de la comparación" />}
            {!comparar && <button class="btn-texto" style="justify-self:start" onClick={() => setHistorial(ej)}><Icono n="historial" /> Gráficas, récords e historial</button>}
            <NotaGrafica>Mejor serie de cada semana, con la fórmula de Epley y contando las repeticiones en recámara (RIR = 10 − RPE). Cada punto va en su semana: si hubo un parón, el tramo sale discontinuo. Los rombos dorados son tus marcas de test o competición y los puntos dorados, tus récords (al tocarlos, la serie que lo consiguió); en 1M, 3M y 6M, la línea gris es el periodo anterior, puesto debajo para comparar; la línea discontinua, la meta de tu objetivo de ese ejercicio y la punteada, hacia dónde vas a este ritmo. En 6M y Todo, las franjas de fondo son los bloques (B1, B2…). Al comparar, cada ejercicio sale en % desde su primera semana del rango, para poder ponerlos juntos aunque muevan kilos muy distintos.</NotaGrafica>
          </div>
        )}
      </section>

      {semanasTon.length === 1 && (
        <section class="seccion" data-grupo="fuerza">
          <h2>Tonelaje por semana</h2>
          <div class="panel panel-pad"><GraficaFantasma texto="Con dos semanas entrenando aparece la gráfica de las toneladas que mueves cada semana." /></div>
        </section>
      )}
      {semanasTon.length > 1 && (
        <section class="seccion" data-grupo="fuerza">
          <div class="seccion-cab">
            <h2>Tonelaje por semana</h2>
            {ventanaTon.length > 1 && <Ampliable titulo="Tonelaje por semana">{(alto) => <>{graficaTon(alto)}<SelectorRango valor={rT} alCambiar={setRangoTon} etiqueta="Rango de la gráfica del tonelaje" /></>}</Ampliable>}
          </div>
          <div class="panel panel-pad pila">
            <div class="cifra">
              <CifraSube texto={num(mediaTon, 1)} clase="v num" /><span class="u">t de media por semana en {nombreRango(rT)}</span>
              {ventanaTon.length > 1 && <span class="chip num chip-mejor">Mejor semana: <Odometro texto={`${num(mejorTon, 1)} t`} /></span>}
            </div>
            {ventanaTon.length > 1 ? graficaTon()
              : <p class="peq secundario">En este rango hay menos de dos semanas con datos: prueba uno más amplio.</p>}
            <SelectorRango valor={rT} alCambiar={setRangoTon} etiqueta="Rango de la gráfica del tonelaje" />
            <NotaGrafica>Toneladas movidas cada semana: carga × repeticiones de todas tus series. La semana de ahora va en claro y discontinua hasta que acaba, y no cuenta en la media. En 1M, 3M y 6M, la línea gris es el periodo anterior, puesto debajo para comparar.</NotaGrafica>
          </div>
        </section>
      )}

      <Vitrina datos={datos.vitrina} ejercicios={ejercicios} esCoach={esCoach} atletaId={atletaId} irA={irA} abrirHistorial={(x) => setHistorial({ id: x.id, nombre: x.nombre })} />

      <Marcas atletaId={atletaId} ejercicios={ejercicios} esCoach={esCoach} marcas={marcas} llamada={llamada} />

      <section class="seccion" data-grupo="fuerza">
        <div class="seccion-cab">
          <h2>Series por músculo</h2>
          {/* (v0.203) esta semana, aún en curso, o la pasada, ya cerrada */}
          <Segmentos opciones={[['esta', 'Esta semana'], ['pasada', 'La pasada']]} valor={semanaVol} alCambiar={(v) => { if (v) { setSemanaVol(v); setMusc(null); } }} etiqueta="Qué semana de series ver" clase="seg-compacto" />
        </div>
        <div class="panel panel-pad pila">
          {/* (vista 260) el mapa se toca: el músculo se ilumina y, debajo, sus series y con qué ejercicios (con el teclado o el
              lector de pantalla, lo mismo desde su barra, más abajo) */}
          {grupos.length > 0 && (
            <div class="mmt-raiz" ref={mapaRef} data-sel={musc?.g || undefined}
              onClick={(ev) => { const g = ev.target.closest?.('.musculo[data-g]')?.dataset.g; if (!g || !(volFuente[g] > 0)) { if (musc?.desde === 'mapa') setMusc(null); return; } setMusc(musc?.g === g && musc.desde === 'mapa' ? null : { g, desde: 'mapa' }); }}>
              <MapaMuscular series={volFuente} etiqueta={volPasada ? 'Series por músculo la semana pasada' : 'Series por músculo esta semana'} />
            </div>
          )}
          {musc?.desde === 'mapa' && <DetalleMusculo g={musc.g} lunes={volPasada ? sumarDias(lunesDe(hoy), -7) : lunesDe(hoy)} total={volFuente[musc.g] || 0} cuando={volPasada ? 'la semana pasada' : 'esta semana'} atletaId={atletaId} alCerrar={() => setMusc(null)} />}
          {/* (057) las guías de los músculos que ha entrenado */}
          {grupos.length > 0 && <GuiasDeGrupos grupos={grupos.map(([g]) => g)} />}
          {!grupos.length ? <p class="secundario">{volPasada ? 'Sin series registradas la semana pasada.' : 'Sin series registradas estas dos semanas.'}</p> : (
            <div class="barras">
              {grupos.map(([g, nombre, a, b]) => {
                const [min, max] = rangoVolumen(objetivoVol, g);
                // (v0.203) mientras la semana no acaba, quedarse por debajo no es «poco»: la barra va rayada, en curso
                const est0 = estadoVolumen(a, [min, max]);
                const estado = !volPasada && est0 === 'bajo' ? 'curso' : est0;
                const abierta = musc?.g === g && musc.desde === 'barra';
                const lbl = `${nombre}: ${num(a)} series ${volPasada ? 'la semana pasada' : 'esta semana'} (objetivo de ${min} a ${max})${estado === 'curso' ? ', semana en curso' : ''}${volPasada ? '' : `, ${num(b)} la anterior`}`;
                return (
                  <Fragment key={g}>
                    {/* (vista 268) cada barra se toca: abre los ejercicios que sumaron esa semana */}
                    <button type="button" class={`barra-fila mmt-fila vol-${estado}`} aria-expanded={abierta ? 'true' : 'false'} aria-label={lbl}
                      onClick={() => setMusc(abierta ? null : { g, desde: 'barra' })}>
                      <span>{nombre}</span>
                      <span class="pista" aria-hidden="true">
                        <span class="banda" style={{ left: `${(min / maxVol) * 100}%`, width: `${((max - min) / maxVol) * 100}%` }} />
                        <span class="relleno" style={{ width: `${(a / maxVol) * 100}%` }} />
                        {b > 0 && <span class="previo" style={{ left: `calc(${(b / maxVol) * 100}% - 1px)` }} />}
                      </span>
                      <span class="v">{num(a)}</span>
                    </button>
                    {abierta && <DetalleMusculo g={g} lunes={volPasada ? sumarDias(lunesDe(hoy), -7) : lunesDe(hoy)} total={a} cuando={volPasada ? 'la semana pasada' : 'esta semana'} atletaId={atletaId} alCerrar={() => setMusc(null)} />}
                  </Fragment>
                );
              })}
            </div>
          )}
          <p class="mini terciario">La franja es {objetivoVol ? (esPorSuCuenta(atleta) ? 'el rango de series semanales de tu plan' : 'el rango de series semanales que te ha marcado tu coach') : 'un rango orientativo de 10 a 20 series semanales por músculo'}{esCoach && !llamada ? ' (se ajusta abajo, en «Volumen objetivo»)' : ''}.{volPasada ? '' : ' Mientras la semana no acaba, lo que aún no llega va rayado (en curso), no en gris. La marca vertical, la semana pasada.'} El músculo principal de cada ejercicio cuenta 1 serie y los secundarios, media.</p>
        </div>
      </section>

      {(constanciaTotal.datos || constancia) && (
        <section class="seccion" data-grupo="logros">
          <div class="seccion-cab">
            <h2>Constancia</h2>
            {constanciaTotal.datos?.racha > 0 && <span class="racha"><Icono n="llama" />{constanciaTotal.datos.racha === 1 ? '1 semana completa' : `${constanciaTotal.datos.racha} semanas completas seguidas`}</span>}
          </div>
          <div class="panel panel-pad pila">
            {constanciaTotal.datos && (
              <>
                <MapaConstancia atletaId={atletaId} esCoach={esCoach} records={datos.diasRecord} checkins={diasCheckin(datos.checkins)} />
              </>
            )}
            {constancia && (
              <div class="pila-s">
                <span class="peq secundario">En este bloque, {constancia.hechas} de {constancia.total} sesiones</span>
                {/* (v0.203) una semana, un aro (como en «Tus semanas»), con la de ahora resaltada */}
                <BloqueAros filas={constancia.filas} />
              </div>
            )}
          </div>
        </section>
      )}
      {cardio.datos?.some((w) => w.sesiones > 0) && (
        <section class="seccion" data-grupo="fuerza">
          <h2>Cardio</h2>
          <div class="panel panel-pad pila">
            <GraficaCardio semanas={cardio.datos} />
            <TotalesCardio semanas={cardio.datos} />
            <NotaGrafica>Minutos de cardio por semana (y los kilómetros, si los apuntas), de lo que registras al terminar cada sesión.</NotaGrafica>
          </div>
        </section>
      )}
      </>)}
      {historial && <HistorialEjercicio atletaId={atletaId} ejercicio={historial} compartir={!esCoach} alCerrar={() => setHistorial(null)} />}
      {semanaVer && <HojaSemanaGrafica atletaId={atletaId} lunes={semanaVer} salud={salud} alCerrar={() => setSemanaVer(null)} />}
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
  // (v0.203) la semana de ahora, en claro (aún no ha acabado)
  const lunesHoy = lunesDe(hoyISO());
  const curso = semanas[n - 1]?.lunes === lunesHoy;
  return (
    <svg class="grafica grafica-cardio" ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Cardio por semana: ${semanas.map((w) => `${w.minutos} minutos`).join(', ')}${curso ? ' (la última semana, aún en curso)' : ''}`}>
      {semanas.map((w, i) => {
        const x = izq + i * ancho + ancho * 0.18, bw = ancho * 0.64;
        const vacia = !w.minutos;
        const enCurso = curso && i === n - 1;
        return (
          <g key={w.lunes}>
            <rect class={`barra ${vacia ? 'vacia' : ''} ${i === n - 1 && !enCurso ? 'ultima' : ''} ${enCurso && !vacia ? 'en-curso' : ''}`} x={x} width={bw} y={vacia ? H - abj - 3 : Y(w.minutos)} height={vacia ? 3 : H - abj - Y(w.minutos)} rx="5" />
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

// v0.49: 16 semanas de lunes a domingo, como en GitHub o Strava; cada cuadro, un día, más intenso con más sesiones
// hechas (ninguna, una, dos o más). Tocar un día dice qué se hizo; con el teclado, las flechas mueven por los días.
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
// (v0.204) records y checkins: los días con récord (un punto dorado) y con check-in (su marca en la esquina)
export function MapaConstancia({ atletaId, esCoach = false, records = null, checkins = null }) {
  const { api } = useApp();
  const hoy = hoyISO();  // (v0.143) el día del móvil, como la fecha de las sesiones hechas
  // Solo las sesiones de estas 16 semanas (no el historial entero)
  const datos = useCarga(() => api.sesionesHechas(atletaId, { desde: sumarDias(lunesDe(hoy), -7 * 15) }).catch(() => []), [atletaId]);
  const [elegido, setElegido] = useState(null);
  const [foco, setFoco] = useState(hoy);
  const rejilla = useRef(null);
  if (datos.cargando && !datos.datos) return <div class="sil" style="height:150px;border-radius:12px" />;
  const m = mapaConstancia((datos.datos || []).map((x) => ({ fecha: x.fecha, nombre: x.nombre, series: x.series, cardio: !!x.cardio_hecho })), hoy, 16);
  const pasados = m.semanas.flatMap((w) => w.dias).filter((d) => d.nivel >= 0);
  const dia = elegido ? pasados.find((d) => d.iso === elegido) : null;
  // (v0.210) Los cuadros son pequeños para el dedo (16 semanas caben en un móvil a 16 px): con un día elegido, «‹ ›»
  // de 32 px pasan al de antes o al de después, para corregir un toque que cayó en el de al lado sin apuntar de nuevo
  const iDia = dia ? pasados.indexOf(dia) : -1;
  const pasoDia = (n) => { const sig = pasados[iDia + n]; if (sig) { setElegido(sig.iso); setFoco(sig.iso); } };
  const conRecord = new Set(records || []), conCheckin = new Set(checkins || []);
  const extras = (iso) => `${conRecord.has(iso) ? ', con récord' : ''}${conCheckin.has(iso) ? ', check-in enviado' : ''}`;
  const textoDia = (d) => `${fmtConDia(d.iso)}: ${d.n ? d.sesiones.map((x) => x.nombre).join(', ') : 'descanso'}${extras(d.iso)}`;
  const recordsVista = pasados.filter((d) => conRecord.has(d.iso)).length, checkinsVista = pasados.filter((d) => conCheckin.has(d.iso)).length;
  const mover = (e) => {
    const paso = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!paso) return;
    e.preventDefault();
    const idx = pasados.findIndex((d) => d.iso === foco);
    const sig = pasados[Math.max(0, Math.min(pasados.length - 1, idx + paso))];
    if (!sig) return;
    setFoco(sig.iso);
    requestAnimationFrame(() => rejilla.current?.querySelector(`[data-dia="${sig.iso}"]`)?.focus());
  };
  return (
    <div class="pila-s mapa-constancia">
      <div class="constancia-rejilla" ref={rejilla} role="group" aria-label={`Constancia de las últimas 16 semanas: ${m.diasActivos} días con sesión. Usa las flechas para moverte por los días`} onKeyDown={mover}>
        {m.meses.map((x) => <span key={x.col} class="cr-mes" aria-hidden="true" style={{ gridColumn: `${x.col + 2} / span 3` }}>{x.texto}</span>)}
        {DIAS_SEMANA.map((d, r) => <span key={d} class="cr-dia" aria-hidden="true" style={{ gridRow: r + 2 }}>{r % 2 === 0 ? d : ''}</span>)}
        {m.semanas.map((w, c) => w.dias.map((d, r) => (d.nivel < 0
          ? <span key={d.iso} class="cr-celda futuro" aria-hidden="true" style={{ gridColumn: c + 2, gridRow: r + 2 }} />
          : <button type="button" key={d.iso} data-dia={d.iso} class={`cr-celda n${d.nivel} ${d.iso === hoy ? 'hoy' : ''} ${d.iso === elegido ? 'elegida' : ''} ${conRecord.has(d.iso) ? 'con-record' : ''} ${conCheckin.has(d.iso) ? 'con-checkin' : ''}`}
            style={{ gridColumn: c + 2, gridRow: r + 2 }} tabIndex={d.iso === foco ? 0 : -1} aria-label={textoDia(d)} aria-pressed={d.iso === elegido ? 'true' : 'false'}
            onClick={() => { setFoco(d.iso); setElegido(elegido === d.iso ? null : d.iso); }} />)))}
      </div>
      <div class="separa cr-pie">
        <span class="mini terciario">{m.diasActivos} {m.diasActivos === 1 ? 'día' : 'días'} con sesión en 16 semanas{recordsVista ? `, ${recordsVista} con récord` : ''}{checkinsVista ? `, ${checkinsVista} ${checkinsVista === 1 ? 'check-in' : 'check-ins'}` : ''}</span>
        <span class="cr-leyenda mini terciario" aria-hidden="true">Menos <i class="cr-celda n0" /><i class="cr-celda n1" /><i class="cr-celda n2" /> Más</span>
      </div>
      {(recordsVista > 0 || checkinsVista > 0) && (
        <span class="cr-marcas mini terciario" aria-hidden="true">
          {recordsVista > 0 && <span><i class="cr-celda n1 con-record" /> Récord</span>}
          {checkinsVista > 0 && <span><i class="cr-celda n1 con-checkin" /> Check-in</span>}
        </span>
      )}
      <div class="cr-detalle-fila">
        <p class="cr-detalle peq" aria-live="polite">
          {dia ? <><strong>{fmtConDia(dia.iso)}</strong>{dia.n ? `: ${dia.sesiones.map((x) => `${x.nombre}${x.series ? ` (${x.series} ${x.series === 1 ? 'serie' : 'series'})` : x.cardio ? ' (cardio)' : ''}`).join(', ')}` : ': descanso'}{extras(dia.iso)}</>
            : <span class="terciario">{esCoach ? 'Toca un día para ver qué hizo.' : 'Toca un día para ver qué hiciste.'}</span>}
        </p>
        {dia && (
          <span class="cr-pasos">
            <button type="button" class="btn btn-icono plano cr-paso" aria-label="Día anterior" disabled={iDia <= 0} onClick={() => pasoDia(-1)}><Icono n="atras" /></button>
            <button type="button" class="btn btn-icono plano cr-paso" aria-label="Día siguiente" disabled={iDia >= pasados.length - 1} onClick={() => pasoDia(1)}><Icono n="derecha" /></button>
          </span>
        )}
      </div>
    </div>
  );
}

// La vitrina de récords (v0.50): una tarjeta por ejercicio, como un trofeo: su mejor marca (el 1RM estimado de su
// mejor serie, o las repeticiones si va sin carga), la serie y el día, y «Nuevo» si la batió hace menos de 30 días.
// Al tocarla, una hoja con cómo ha ido subiendo (la gráfica táctil) y cada vez que la batió.
function Vitrina({ datos, ejercicios = [], esCoach, atletaId, abrirHistorial, irA }) {
  const [todas, setTodas] = useState(false);
  const [abierta, setAbierta] = useState(null);
  // (v0.204) el trofeo de un récord nuevo (desde la última vez que lo viste en este móvil) destella una vez
  const { nuevos, rejilla } = useTrofeosNuevos(`fbe-trofeos-vistos:${atletaId}`, datos?.ejercicios || [], !esCoach);
  if (!datos) return null;
  if (!datos.ejercicios.length) {
    return (
      <section class="seccion" data-grupo="fuerza">
        <h2>Vitrina de récords</h2>
        <div class="panel"><Vacio ilustracion="records" imagen="vacio-records" titulo={esCoach ? 'Aún no tiene récords' : 'Aún no tienes récords'}
          accion={!esCoach && irA ? <button class="btn btn-peq" onClick={() => irA('hoy')}><Icono n="play" /> Ir a tu sesión de hoy</button> : null}>
          {esCoach ? 'Con dos sesiones del mismo ejercicio, sus mejores marcas saldrán aquí.' : 'Cuando superes una marca tuya, saldrá aquí como un trofeo.'}
        </Vacio></div>
      </section>
    );
  }
  const hace30 = new Set(datos.recientes.map((r) => r.ejercicio_id));
  // (v0.203) en cada trofeo, su minilínea (el 1RM de sus últimas semanas) y cuánto subió la última vez que lo batió
  const puntosDe = Object.fromEntries((ejercicios || []).map((e) => [e.id, (e.puntos || []).slice(-8).map((p) => p.valor)]));
  const subidaDe = (x) => {
    const u = x.subida;
    if (!u || !(u.valor > u.antes)) return null;
    if (u.tipo === 'e1rm' && x.e1rm && Math.abs(u.valor - x.e1rm.valor) < 0.05) return `+${num(difVista(u.valor - u.antes), 1)} ${etiquetaPeso()}`;
    if (u.tipo === 'reps' && !x.e1rm && u.valor === x.repsSinCarga) return `+${u.valor - u.antes} rep`;
    return null;
  };
  const lista = todas ? datos.ejercicios : datos.ejercicios.slice(0, 6);
  // (v0.204) los músculos con récord en estos 30 días, en dorado
  const musculosRec = musculosRecord(datos.recientes, ejercicios);
  const nMusc = Object.keys(musculosRec).length;
  return (
    <section class="seccion" data-grupo="fuerza">
      <div class="seccion-cab">
        <h2>Vitrina de récords</h2>
        {datos.recientes.length > 0 && <span class="chip morado num">{datos.recientes.length} {datos.recientes.length === 1 ? 'récord' : 'récords'} en 30 días</span>}
      </div>
      <ul class="vitrina-rejilla" ref={rejilla}>
        {lista.map((x) => {
          const reciente = hace30.has(x.id);
          const fecha = x.e1rm?.fecha || x.ultimoRecord;
          return (
            <li key={x.id}>
              <button class={`trofeo-tarjeta ${reciente ? 'reciente' : ''} ${nuevos.has(x.id) ? 'por-destellar' : ''}`} data-trofeo={x.id} onClick={() => setAbierta(x)} aria-label={`${x.nombre}: ${x.e1rm ? `${pesoNum(x.e1rm.valor, 1)} ${nombrePeso()} de 1RM estimado` : `${x.repsSinCarga} repeticiones`}${reciente ? ', récord nuevo' : ''}${subidaDe(x) ? `, ${subidaDe(x)} frente al récord anterior` : ''}. Ver cómo ha ido`}>
                <span class="trofeo-ico" aria-hidden="true"><Icono n="trofeo" /></span>
                {reciente && <span class="trofeo-nuevo" aria-hidden="true">Nuevo</span>}
                <span class="trofeo-nombre" aria-hidden="true">{x.nombre}</span>
                <span class="trofeo-valor num" aria-hidden="true">{x.e1rm ? <>{pesoNum(x.e1rm.valor, 1)}<small> {etiquetaPeso()}</small></> : <>{x.repsSinCarga}<small> rep</small></>}</span>
                <span class="trofeo-detalle num" aria-hidden="true">{x.e1rm ? `${pesoTxt(x.e1rm.kg, 2)} × ${x.e1rm.reps}${x.e1rm.rpe ? ` @${num(x.e1rm.rpe)}` : ''}` : 'Sin carga'}{fecha && <span class="trofeo-fecha">{fmtCorta(fecha)}</span>}</span>
                {(subidaDe(x) || (puntosDe[x.id] || []).length > 1) && (
                  <span class="trofeo-pie" aria-hidden="true">
                    {subidaDe(x) && <span class="trofeo-subida num"><Icono n="arriba" />{subidaDe(x)}</span>}
                    <MiniLinea valores={puntosDe[x.id]} ancho={64} alto={22} clase="trofeo-linea" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {!todas && datos.ejercicios.length > 6 && <button class="btn-texto" style="justify-self:start" onClick={() => setTodas(true)}>Ver los {datos.ejercicios.length} ejercicios</button>}
      {nMusc > 0 && (
        <div class="panel panel-pad mapa-records">
          <MapaMuscular series={musculosRec} etiqueta="Músculos con récord en los últimos 30 días" leyenda={false} tono="oro" unidad="récord" nivel={(v) => (v > 0 ? 4 : 0)} />
          <div class="pila-xs">
            <strong class="peq">{nMusc === 1 ? 'Un músculo con récord' : `${nMusc} músculos con récord`} en 30 días</strong>
            <span class="mini terciario">{GRUPOS.filter(([g]) => musculosRec[g]).map(([g, nm]) => `${nm}${musculosRec[g] > 1 ? ` (${musculosRec[g]})` : ''}`).join(', ')}</span>
          </div>
        </div>
      )}
      <p class="mini terciario">{esCoach ? 'Mejor serie de cada ejercicio' : 'Tu mejor serie de cada ejercicio'} (1RM estimado). «Nuevo»: batido en los últimos 30 días. Toca uno para ver cómo ha ido.</p>
      {abierta && <HojaRecord atletaId={atletaId} x={abierta} esCoach={esCoach} reciente={hace30.has(abierta.id)} alCerrar={() => setAbierta(null)}
        abrirHistorial={() => { const x = abierta; setAbierta(null); abrirHistorial(x); }} />}
    </section>
  );
}

// La evolución de un récord: su mejor marca hasta cada día en que subió y la lista de cada vez que lo batió
function HojaRecord({ atletaId, x, reciente, alCerrar, abrirHistorial, esCoach = false }) {
  const { api } = useApp();
  const h = useCarga(() => api.historial(atletaId).then((series) => historiaRecords(series, x.id)), [atletaId, x.id]);
  const d = h.datos;
  // (compartir) el récord como tarjeta: para redes o para el equipo (el atleta, no el coach)
  const [compartir, setCompartir] = useState(false);
  return (
    <Hoja titulo={x.nombre} alCerrar={alCerrar} medio>
      <div class={`record-cab ${reciente ? 'reciente' : ''}`}>
        <span class="trofeo-ico" aria-hidden="true"><Icono n="trofeo" /></span>
        <span class="pila-xs">
          <span class="record-valor num">{x.e1rm ? <>{pesoNum(x.e1rm.valor, 1)}<small> {etiquetaPeso()}</small></> : <>{x.repsSinCarga}<small> rep</small></>}</span>
          <span class="peq secundario">{x.e1rm ? `1RM estimado, de ${pesoTxt(x.e1rm.kg, 2)} × ${x.e1rm.reps}${x.e1rm.rpe ? ` @${num(x.e1rm.rpe)}` : ''}${x.e1rm.fecha ? `, el ${fmtCorta(x.e1rm.fecha)}` : ''}` : 'Máximo de repeticiones sin carga'}</span>
        </span>
        {reciente && <span class="chip morado">Nuevo</span>}
      </div>
      {h.cargando && !d ? <Siluetas forma="grafica" texto="Cargando sus récords" /> : d && (
        <>
          {d.puntos.length > 1 ? <Grafica records puntos={d.unidad === 'kg' ? d.puntos.map((p) => ({ ...p, y: difVista(p.y) })) : d.puntos} unidad={d.unidad === 'kg' ? etiquetaPeso() : d.unidad} etiqueta={`Récord de ${x.nombre}: cómo ha subido`} />
            : <p class="peq secundario">Con una sesión más de este ejercicio verás cómo sube.</p>}
          {/* (belleza 176) sus tres mejores marcas, en podio (con dos, las dos) */}
          {d.puntos.length > 1 && (
            <section class="seccion">
              <h3 class="sub-seccion">{esCoach ? 'Sus' : 'Tus'} {d.puntos.length > 2 ? 'tres' : 'dos'} mejores marcas</h3>
              <PodioRecords puntos={d.puntos} unidad={d.unidad} />
            </section>
          )}
          <section class="seccion">
            <h3 class="sub-seccion">{d.veces.length === 1 ? 'La vez que lo batiste' : d.veces.length ? `Las ${d.veces.length} veces que lo batiste` : 'Aún no lo has batido'}</h3>
            {/* (v0.204) como escalones que suben, de la primera vez a la última, cada uno con su cifra y su fecha */}
            {d.veces.length > 0 ? <EscaleraRecords escalones={escaleraRecords(d.veces)} /> : <p class="peq secundario">Lo de la primera vez que haces un ejercicio es tu punto de partida: el récord llega al superarlo.</p>}
          </section>
        </>
      )}
      <div class="fila-envolver">
        <button class="btn" onClick={abrirHistorial}><Icono n="historial" /> Gráficas, récords e historial</button>
        {!esCoach && d && (x.e1rm || x.repsSinCarga > 0) && <button class="btn btn-primario" onClick={() => setCompartir(true)}><Icono n="compartir" /> Compartir el récord</button>}
      </div>
      {compartir && <HojaCompartir logro tipo="record" titulo="Compartir el récord" datos={datosRecord(x, d)} equipo={{ tema: 'logros' }} alCerrar={() => setCompartir(false)} />}
    </Hoja>
  );
}

// Marcas de test o competición. El 1RM estimado de las series va aparte (arriba).
// (v0.203) cada una como tarjeta con su sello (Test o Competición) y el 1RM que supone; borrarla, desde su hoja
function Marcas({ atletaId, ejercicios, esCoach, marcas: dadas = null, llamada = false }) {
  const { api, aviso } = useApp();
  const propias = useCarga(() => (dadas ? Promise.resolve(null) : api.marcas(atletaId).catch(() => [])), [atletaId, !!dadas]);
  const marcas = dadas || propias;
  const [nueva, setNueva] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const lista = marcas.datos || [];
  if (!lista.length && !ejercicios.length && esCoach) return null;
  const rm = (m) => (Number(m.reps) > 1 ? e1rm({ kg: Number(m.kg), reps: Number(m.reps), rir: 0 }) : null);
  return (
    <section class="seccion" data-grupo="fuerza">
      <div class="seccion-cab"><h2>Marcas</h2>{!llamada && <button class="btn-texto" onClick={() => setNueva(true)}><Icono n="mas" /> Apuntar marca</button>}</div>
      {!lista.length ? <div class="panel"><p class="panel-pad peq secundario">Los tests y las competiciones van aquí: lo que levantas de verdad a 1, 3 o 5 repeticiones.</p></div> : (
        <ul class="marcas-rejilla">
          {lista.map((m) => (
            <li key={m.id}>
              <button type="button" class={`marca-tarjeta ${m.tipo === 'competicion' ? 'competicion' : 'test'}`} onClick={() => setAbierta(m)}
                aria-label={`${m.ejercicio}: ${pesoTxt(m.kg, 2)} × ${m.reps}, ${m.tipo === 'competicion' ? 'en competición' : 'test'}, el ${fmtCorta(m.fecha)}${rm(m) ? `; equivale a un 1RM de ${pesoTxt(rm(m), 1)}` : ''}. Ver la marca`}>
                <span class="marca-sello" aria-hidden="true"><Icono n={m.tipo === 'competicion' ? 'trofeo' : 'diana'} />{m.tipo === 'competicion' ? 'Competición' : 'Test'}</span>
                <span class="marca-nombre" aria-hidden="true">{m.ejercicio}</span>
                <span class="marca-valor num" aria-hidden="true">{pesoNum(m.kg, 2)}<small> {etiquetaPeso()} × {m.reps}</small></span>
                <span class="mini terciario num" aria-hidden="true">{rm(m) ? `1RM ${pesoTxt(rm(m), 1)} · ` : Number(m.reps) === 1 ? '1RM real · ' : ''}{fmtCorta(m.fecha)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {abierta && (
        <Hoja titulo={abierta.ejercicio} alCerrar={() => setAbierta(null)}>
          <div class="pila">
            <p class="marca-valor num">{pesoNum(abierta.kg, 2)}<small> {etiquetaPeso()} × {abierta.reps}</small></p>
            <p class="peq secundario">{abierta.tipo === 'competicion' ? 'En competición' : 'Test'}, el {fmtCorta(abierta.fecha)}{rm(abierta) ? `. Equivale a un 1RM estimado de ${pesoTxt(rm(abierta), 1)}` : Number(abierta.reps) === 1 ? '. Es tu 1RM de verdad' : ''}.</p>
            {abierta.notas && <p class="cita">«{abierta.notas}»</p>}
            {!llamada && <button class="btn btn-peligro" onClick={async () => { try { await api.borrarMarca(abierta.id); setAbierta(null); marcas.recargar(true); aviso('Marca borrada'); } catch (e) { aviso(e.message, 'error'); } }}><Icono n="basura" /> Borrar la marca</button>}
          </div>
        </Hoja>
      )}
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
        try { await api.guardarMarca({ atleta_id: atletaId, ejercicio_id: ejercicioId, kg: deVista(f.kg), reps: f.reps || 1, tipo: f.tipo, fecha: f.fecha, notas: f.notas.trim() || null }); aviso('Marca guardada'); alCerrar(true); }
        catch (err) { aviso(err.message, 'error'); }
      }}>
        <div class="campo"><label for="mr-ej">Ejercicio</label>
          <select id="mr-ej" class="selector" value={ejercicioId} onChange={(e) => setF({ ...f, ejercicio_id: e.currentTarget.value })}>
            {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select></div>
        <div class="rejilla-campos">
          <div class="campo"><label for="mr-kg">{enLibras() ? 'Lb' : 'Kg'}</label><Paso id="mr-kg" valor={f.kg} paso={enLibras() ? 5 : 2.5} min={0} max={enLibras() ? 1100 : 500} dec={2} etiqueta={`${nombrePeso()} de la marca`} alCambiar={(v) => setF({ ...f, kg: v })} /></div>
          <div class="campo"><label for="mr-reps">Repeticiones</label><Paso id="mr-reps" valor={f.reps} paso={1} min={1} max={20} dec={0} etiqueta="repeticiones de la marca" alCambiar={(v) => setF({ ...f, reps: v || 1 })} /></div>
        </div>
        {f.kg > 0 && f.reps > 1 && f.reps <= 12 && <p class="peq secundario">Equivale a un 1RM estimado de {num(e1rm({ kg: f.kg, reps: f.reps, rir: 0 }))} {etiquetaPeso()}.</p>}
        <div class="campo"><span class="etq">Dónde</span><Segmentos etiqueta="Tipo de marca" valor={f.tipo} alCambiar={(v) => setF({ ...f, tipo: v || 'test' })} opciones={[['test', 'Test'], ['competicion', 'Competición']]} /></div>
        <div class="campo"><label for="mr-fecha">Fecha</label><input id="mr-fecha" type="date" class="entrada" value={f.fecha} max={hoyISO()} onInput={(e) => setF({ ...f, fecha: e.currentTarget.value })} /></div>
        <div class="campo"><label for="mr-notas">Nota</label><input id="mr-notas" class="entrada" value={f.notas} onInput={(e) => setF({ ...f, notas: e.currentTarget.value })} placeholder="Con cinturón, en casa, válida…" /></div>
        <button class="btn btn-primario btn-grande" disabled={!f.kg}>Guardar marca</button>
      </form>
    </Hoja>
  );
}

// (belleza 175) Cada pestaña de Progreso con su cabecera ilustrada, si ha llegado su imagen: la escena a la derecha y, a la
// izquierda, lo que hay en ella (un adorno: lo de la pestaña ya lo dice su nombre). Los id, enteros (no «progreso-» + pestaña:
// el reparto de estilos creería que cualquier clase «progreso-…» puede salir de aquí)
const CAB_PROG = { resumen: ['progreso-resumen', 'Tus semanas, tus cifras y tus bloques'], fuerza: ['progreso-fuerza', 'Tu fuerza y tus récords'], cuerpo: ['progreso-cuerpo', 'Tu cuerpo y tus hábitos'], logros: ['progreso-logros', 'Tus medallas y tus objetivos'] };
function CabeceraProgreso({ sub }) {
  const [id, texto] = CAB_PROG[sub] || [];
  if (!id || !hayImagen(id)) return null;
  return (
    <div class="amb-cab-prog" aria-hidden="true">
      <Imagen key={id} id={id} clase="amb-cab-prog-img" tamanos="(min-width: 720px) 680px, 100vw" />
      <span class="amb-cab-prog-t">{texto}</span>
    </div>
  );
}

// (belleza 181) Lo que hiciste la semana de un punto de una gráfica: su historia, como en «Tus semanas» (si esa semana no
// tiene nada apuntado, lo dice)
function HojaSemanaGrafica({ atletaId, lunes, salud, alCerrar }) {
  const { api } = useApp();
  const atras = Math.max(1, Math.round(diasEntre(lunes, lunesDe(hoyISO())) / 7));
  const r = useCarga(() => api.resumenesSemanales(atletaId, atras).then((l) => (l || []).find((x) => x.lunes === lunes) || null).catch(() => null), [atletaId, lunes]);
  if (r.datos) return <HistoriaSemana resumen={r.datos} salud={salud} alCerrar={alCerrar} />;
  return (
    <Hoja titulo={`Semana del ${fmtCorta(lunes)}`} alCerrar={alCerrar} medio>
      {r.cargando ? <Siluetas forma="lista" n={3} texto="Cargando esa semana" /> : <p class="peq secundario">No hay nada apuntado esa semana.</p>}
    </Hoja>
  );
}

// Vídeos que el atleta ha enviado, con la respuesta del coach
// Resúmenes de las últimas semanas (cada uno se abre como historia)
// (v0.204) las 4 últimas semanas acabadas (se cargan 8, para comparar las cifras con las 4 de antes); cada una con sus
// días de lunes a domingo en miniatura
// (vista 267) «Comparar dos»: tocar dos semanas las pone lado a lado (sesiones, series, toneladas y récords)
function TusSemanas({ salud, lista }) {
  const [abierta, setAbierta] = useState(null);
  const [comparando, setComparando] = useState(false);
  const [elegidas, setElegidas] = useState([]);
  const corte = sumarDias(lunesDe(hoyISO()), -28);
  const ult = (lista.datos || []).filter((r) => r.lunes >= corte);
  if (!ult.length) return null;
  const dos = elegidas.length === 2 ? elegidas.map((l) => ult.find((r) => r.lunes === l)).filter(Boolean) : [];
  const salir = () => { setComparando(false); setElegidas([]); };
  return (
    <section class="seccion">
      <div class="seccion-cab">
        <h2>Tus semanas</h2>
        {ult.length >= 2 && <button type="button" class="btn-texto csm-boton" aria-pressed={comparando ? 'true' : 'false'} onClick={() => (comparando ? salir() : setComparando(true))}><Icono n={comparando ? 'hecho' : 'intercambiar'} />{comparando ? 'Listo' : 'Comparar dos'}</button>}
      </div>
      {comparando && dos.length < 2 && <p class="peq secundario csm-pista" role="status">{elegidas.length ? 'Ahora, la otra semana.' : 'Toca las dos semanas que quieres comparar.'}</p>}
      {dos.length === 2 && <DosSemanas a={dos[0]} b={dos[1]} rango={(r) => rangoLargo(r.lunes, r.domingo)} alCerrar={salir} />}
      <div class="panel">
        <ul class="lista">
          {ult.map((r) => (
            <li key={r.lunes}>
              {/* (belleza 179) su borde, del color de su constancia: completa, a medias o sin sesiones */}
              <button class={`fila-semana amb-con-sello amb-sem${comparando ? ' csm-fila' : ''}`} data-c={r.sesiones.total > 0 && r.sesiones.hechas >= r.sesiones.total ? 'completa' : r.sesiones.hechas > 0 ? 'media' : 'pausa'}
                aria-pressed={comparando ? (elegidas.includes(r.lunes) ? 'true' : 'false') : undefined} onClick={() => (comparando ? setElegidas(elegirSemana(elegidas, r.lunes)) : setAbierta(r))}>
                <span class="pila-xs">
                  <strong>Semana {rangoLargo(r.lunes, r.domingo)}</strong>
                  <span class="peq secundario">{r.sesiones.hechas} de {r.sesiones.total} sesiones, {r.series} series{r.records.length ? `, ${r.records.length} ${r.records.length === 1 ? 'récord' : 'récords'}` : ''}</span>
                  {r.dias && <DiasSemanaMini lunes={r.lunes} dias={r.dias} />}
                </span>
                <SelloSemana hechas={r.sesiones.hechas} total={r.sesiones.total} records={r.records.length} />
              </button>
            </li>
          ))}
        </ul>
      </div>
      {abierta && <HistoriaSemana resumen={abierta} salud={salud} alCerrar={() => setAbierta(null)} />}
    </section>
  );
}

// (visual 9) La miniatura de cada semana: su aro de sesiones (entero y con los colores del Amanecer si la completaste)
// y, si hubo récords, su medalla con cuántos. Antes, el mismo lobo en todas.
function SelloSemana({ hechas, total, records }) {
  const p = total ? Math.min(1, hechas / total) : 0;
  return (
    <span class={`sello-semana ${p >= 1 ? 'completa' : ''}`} style={{ '--p': p.toFixed(3) }} aria-hidden="true">
      <span class="ss-n num">{hechas}<small>/{total}</small></span>
      {records > 0 && <span class="ss-record num"><Icono n="trofeo" />{records}</span>}
    </span>
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

// (belleza 178) Las barritas de una cifra: una por semana, de la más antigua a la última (que va en el color de la cifra),
// siempre en el sitio de 8 y pegadas a la derecha (con pocas semanas, no se ensanchan)
function MiniBarras({ v }) {
  const max = Math.max(1, ...v);
  return (
    <svg class="amb-mini" viewBox="0 0 23 12" preserveAspectRatio="none" aria-hidden="true">
      {v.slice(-8).map((x, i, w) => { const h = Math.max(1, (x / max) * 12); return <rect key={i} x={(8 - w.length + i) * 3} y={12 - h} width="2" height={h} rx="0.6" />; })}
    </svg>
  );
}

// Las cifras de arriba: lo que más dice de la constancia, de un vistazo
// (v0.204) las de las 4 últimas semanas, con su flecha frente a las 4 de antes (si entonces ya entrenaba)
function Cifras({ constancia, semanas }) {
  const c = constancia.datos;
  const { ahora, antes, ult } = cifrasFrente(semanas.datos || [], hoyISO());
  if (!c && !ult.length) return null;
  const { records, series, dias } = ahora;
  // (belleza 178) detrás de cada cifra, sus 8 semanas en barritas (la última, en su color)
  const serie = serieCifras(semanas.datos || [], hoyISO());
  const celdas = [
    c && { v: c.racha, k: c.racha === 1 ? 'semana completa seguida' : 'semanas completas seguidas', ico: 'llama', destaca: c.racha > 0 },
    ult.length > 0 ? { v: dias, k: dias === 1 ? 'día entrenado en 4 semanas' : 'días entrenados en 4 semanas', ico: 'calendario', antes: antes?.dias }
      : c && { v: c.diasEntrenados, k: 'días entrenados en 12 semanas', ico: 'calendario' },
    ult.length > 0 && { v: series, k: 'series en 4 semanas', ico: 'hoy', antes: antes?.series },
    ult.length > 0 && { v: records, k: records === 1 ? 'récord en 4 semanas' : 'récords en 4 semanas', ico: 'trofeo', destaca: records > 0, antes: antes?.records },
  ].filter(Boolean);
  return (
    <dl class="cifras panel" aria-label="Tus cifras">
      {celdas.map((x) => (
        <div key={x.k} class={`${x.destaca ? 'destaca' : ''}${serie[x.ico]?.length >= 2 ? ' amb-cifra' : ''}`} data-ico={x.ico}>
          <dd class="num"><CifraSube texto={x.v} /><FlechaCifra v={x.v} antes={x.antes} />{serie[x.ico]?.length >= 2 && <MiniBarras v={serie[x.ico]} />}</dd>
          <dt><Icono n={x.ico} />{x.k}</dt>
        </div>
      ))}
    </dl>
  );
}

export function Progreso({ programa, salud, irA, checkinSemana }) {
  const { api, atleta, propio } = useApp();
  const entrena = conEntrenamiento(atleta);
  // (pulido 4) al volver a Progreso se enseña al momento lo último cargado y se pone al día por detrás
  const rec = (que) => ({ recuerdo: `progreso:${api.uid()}:${atleta.id}:${que}:${entrena ? 1 : 0}` });
  const constancia = useCarga(() => (entrena ? api.constancia(atleta.id).catch(() => null) : Promise.resolve(null)), [atleta.id, entrena], rec('constancia'));
  // v0.52: lo de Progreso se carga una vez para la vista y para los destacados
  const progreso = useCarga(() => api.progreso(atleta.id), [atleta.id], rec('progreso'));
  // (v0.204) 8 semanas: las 4 últimas (las que se ven) y las 4 de antes (para la flecha de cada cifra)
  const semanas = useCarga(() => (entrena ? api.resumenesSemanales(atleta.id, 8).catch(() => []) : Promise.resolve([])), [atleta.id, entrena], rec('semanas8'));
  // (v0.203) sus objetivos, una vez: para la cifra de arriba (su camino) y para las gráficas (la meta)
  const objetivos = useCarga(() => api.objetivos(atleta.id).catch(() => []), [atleta.id]);
  const llegando = [progreso, constancia, semanas].some((c) => c.cargando && !c.datos);
  // La sub-pestaña: Resumen, salvo que se haya pedido otra al venir («Ver la gráfica» del peso, «Ver mis logros»)
  const [sub, setSub] = useState(() => tomarSubProgreso() || 'resumen');
  const desliz = usePestanasDeslizables(SUBS_PROGRESO, sub, setSub);
  useEffect(() => {
    const al = (e) => { const pedida = tomarSubProgreso() || e.detail; if (SUBS_PROGRESO.some(([k]) => k === pedida)) { setSub(pedida); window.scrollTo(0, 0); } };
    window.addEventListener(EVENTO_SUB_PROGRESO, al);
    return () => window.removeEventListener(EVENTO_SUB_PROGRESO, al);
  }, []);
  return (
    <div class="contenido">
      <CabeceraGrande><div class="titulo"><h1>Tu progreso</h1></div></CabeceraGrande>
      {entrena ? <Pista id="progreso" icono="progreso">Todo lo de aquí sale solo de lo que apuntas en cada sesión y en el check-in. No tienes que rellenar nada: entra de vez en cuando a ver cómo vas.</Pista>
        : <Pista id="progreso-nutricion" icono="progreso">Aquí ves tu peso, tus medidas y tu nutrición: sale de lo que apuntas en Hoy y en el check-in.</Pista>}
      {/* Cuatro sub-pestañas en lugar de una página de once pantallas. Todo sigue pintado (las cifras y las gráficas ya
          están cargadas): la sub-pestaña solo decide qué grupo se ve (diseno.css). A quien solo se le lleva la nutrición
          le queda una página corta, sin sub-pestañas. */}
      {entrena && <Pestanas opciones={SUBS_PROGRESO} valor={sub} alCambiar={desliz.cambiar} etiqueta="Qué ver de tu progreso" idBase="prog" clase="pestanas-progreso pestanas-justas" />}
      {entrena && <CabeceraProgreso sub={sub} />}
      {/* (diseño, tanda 21) deslizar el panel a los lados cambia de sub-pestaña (ui/deslizar.js) */}
      <div class={`progreso-panel ${entrena ? 'deslizable' : ''}`} id="prog-panel" role={entrena ? 'tabpanel' : undefined} aria-labelledby={entrena ? `prog-${sub}` : undefined} data-sub={entrena ? sub : undefined} ref={desliz.panel} {...(entrena ? desliz.gesto : {})}>
        <Grupo g="resumen">
          {/* (pulido 2.3) cada bloque del resumen guarda, mientras llega, el sitio que ocupó la última vez: ya no se van
              empujando unos a otros según cargan */}
          {/* (v0.104) lo de su objetivo del cuestionario (la cifra que le importa) y sus tres ejercicios */}
          {entrena && <Reserva id="prog-personal" cargando={llegando}><CifraObjetivo progreso={progreso.datos} constancia={constancia.datos} salud={salud} objetivos={objetivos.datos || []} /><TusEjercicios progreso={progreso.datos} /></Reserva>}
          {entrena && <Reserva id="prog-destacados" cargando={llegando}><Destacados progreso={progreso.datos} constancia={constancia.datos} programa={programa.datos} /></Reserva>}
          {entrena && <Reserva id="prog-anillos" cargando={llegando}><AnillosSemana programa={programa} salud={salud} checkinSemana={checkinSemana} constancia={constancia} /></Reserva>}
          {entrena && <Reserva id="prog-cifras" cargando={llegando}><Cifras constancia={constancia} semanas={semanas} /></Reserva>}
          {entrena && <Reserva id="prog-semanas" cargando={llegando}><TusSemanas salud={salud} lista={semanas} /></Reserva>}
          {entrena && <Reserva id="prog-tu-anio"><FilaTuAnio /></Reserva>}
          <Reserva id="prog-meses"><TusMeses salud={salud} /></Reserva>
          {entrena && <Reserva id="prog-bloques"><TusBloques salud={salud} /></Reserva>}
        </Grupo>
        <Grupo g="logros">{entrena && <Logros salud={salud} />}</Grupo>
        <VistaProgreso atletaId={atleta.id} programa={programa.datos} constanciaDada={constancia} progresoDado={progreso} entrenamiento={entrena} irA={irA} salud={salud} objetivosDados={objetivos} />
        <Grupo g="cuerpo">
          {salud && <HabitosMes />}
          {salud && conNutricion(atleta) && <NutricionProgreso />}
          {/* (conexiones del coach) el coach no tiene Perfil en su modo atleta: su Salud del iPhone y su calendario, aquí */}
          {propio && <div id="prog-conexiones"><Conexiones salud={salud} /></div>}
        </Grupo>
        <Grupo g="fuerza">{entrena && <MiTecnica atletaId={atleta.id} nombreAtleta={atleta.nombre} />}
          {/* (058) y su Apple Watch: la clave del atajo «FBE Reloj», para probarlo antes de compartirlo */}
          {propio && entrena && <div id="prog-reloj"><GrupoReloj /></div>}
        </Grupo>
        {/* El diario lleva los vídeos de técnica y las fotos de progreso: se ve en Fuerza y en Cuerpo */}
        {/* (v0.204) con su peso y sus medidas: cada foto con la tendencia de ese día y, en «Antes y después», lo que cambió */}
        <Grupo g="fuerza cuerpo"><Diario atletaId={atleta.id} nombreAtleta={atleta.nombre} salud={salud} cuerpo={salud && progreso.datos ? { pesos: progreso.datos.pesos, medidas: progreso.datos.medidas } : null} /></Grupo>
      </div>
      <FinDePagina texto="Hasta aquí, de momento." />
    </div>
  );
}

// v0.52: «Destacados», como los de Apple Salud: de dos a cuatro frases sobre lo que ha cambiado de verdad, cada una con
// una gráfica pequeña (decorativa: lo que dice va en la frase). Solo entrenamiento; cada una con sus mínimos
// (logica/destacados.js): si no hay datos suficientes o el cambio no se nota, no sale.
function Destacados({ progreso, constancia, programa }) {
  const [verRacha, setVerRacha] = useState(false);
  if (!progreso) return null;
  const hoy = hoyISO();
  const calendario = constancia?.semanas ? calendarioRacha(constancia.semanas, hoy, 8) : [];
  // Las semanas del bloque que ya cuentan: las acabadas y la de ahora si está completa. v0.53: con objetivo de días por
  // semana, las semanas de lunes a domingo desde que empezó el bloque, con su objetivo
  const inicioBloque = programa?.bloque?.fecha_inicio || (programa?.semanas || []).map((w) => w.fecha_inicio).filter(Boolean).sort()[0] || null;
  const bloque = constancia?.diasSemana
    ? (constancia.semanas || []).filter((w) => inicioBloque && w.fecha_inicio >= lunesDe(inicioBloque) && w.total && (w.fecha_inicio < lunesDe(hoy) || w.hechas >= w.total))
      .map((w, i) => ({ numero: i + 1, hechas: Math.min(w.hechas, w.total), total: w.total }))
    : (programa?.semanas || []).filter((w) => w.fecha_inicio && w.fecha_inicio <= hoy).map((w) => {
      const ss = programa.sesiones?.[w.id] || [];
      return { numero: w.numero, hechas: ss.filter((x) => x.completada).length, total: ss.length, acabada: sumarDias(w.fecha_inicio, 6) < hoy };
    }).filter((w) => w.acabada || (w.total && w.hechas >= w.total));
  const nombres = Object.fromEntries((progreso.vitrina?.ejercicios || []).map((e) => [e.id, e.nombre]));
  const lista = calcularDestacados({ dias: progreso.tonelaje || {}, ejercicios: progreso.ejercicios, racha: constancia?.racha, calendario, bloque, recientes: progreso.vitrina?.recientes, nombres }, hoy);
  if (!lista.length) return null;
  // (belleza B89) las semanas de las barras de los récords: las tres de antes por su lunes y la de ahora
  const semanasRecords = [3, 2, 1, 0].map((k) => (k ? fmtCorta(sumarDias(lunesDe(hoy), -7 * k)) : 'Esta semana'));
  return (
    <section class="seccion destacados" aria-labelledby="destacados-t">
      <h2 id="destacados-t">Destacados</h2>
      <ul class="destacados-lista">
        {lista.map((d, i) => (
          <li key={d.id} class="destacado panel" data-tipo={d.id} style={{ '--i': i }}>
            <p class="destacado-sobre"><Icono n={d.icono} />{d.sobre}</p>
            <p class="destacado-texto">{unirUnidades(d.texto)}</p>
            <MiniGrafica g={d.grafica} semanas={d.id === 'records' ? semanasRecords : null} />
            {d.id === 'racha' && constancia && <button type="button" class="btn-texto destacado-ir" onClick={() => setVerRacha(true)}>Ver tu racha <Icono n="derecha" /></button>}
          </li>
        ))}
      </ul>
      {verRacha && <PantallaRacha racha={constancia?.racha || 0} semanas={constancia?.semanas || []} diasSemana={constancia?.diasSemana || null} hoy={hoy} alCerrar={() => setVerRacha(false)} />}
    </section>
  );
}

// La gráfica pequeña de un destacado: una línea, unas barras (la de ahora, resaltada) o las semanas como casillas.
// (belleza B88) A todo el ancho de la tarjeta y del color de lo que cuenta (--t): la línea con su área y el punto de
// ahora; las barras con la punta redonda y la de ahora en su color. (B89) En los récords, cada barra con su cifra encima
// y su semana debajo (la de ahora, en dorado).
function MiniGrafica({ g, semanas = null }) {
  if (!g?.valores?.length) return null;
  const vs = g.valores;
  if (g.tipo === 'pips') {
    return (
      <span class="mini-grafica pips" aria-hidden="true">
        {vs.map((v, i) => <i key={i} class={v === 1 ? 'pip-lleno' : v === 0 ? 'pip-vacio' : 'pip-nada'} />)}
      </span>
    );
  }
  if (g.tipo === 'barras') {
    const W = 300, Hb = 44, cifras = !!semanas && semanas.length === vs.length, arr = cifras ? 18 : 2, abj = cifras ? 20 : 0, H = arr + Hb + abj;
    const max = g.max || Math.max(1, ...vs);
    const hueco = W / vs.length, bw = Math.min(hueco * 0.58, 40);
    return (
      <svg class={`mini-grafica amb-mg ${cifras ? 'amb-mg-cifras' : ''}`} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
        {vs.map((v, i) => {
          const h = Math.max(4, (v / max) * Hb), x = i * hueco + (hueco - bw) / 2, y = arr + Hb - h;
          return (
            <g key={i}>
              <rect class={i === g.resaltado ? 'resaltada' : ''} x={x.toFixed(1)} y={y.toFixed(1)} width={bw.toFixed(1)} height={h.toFixed(1)} rx={Math.min(6, bw / 2).toFixed(1)} />
              {cifras && <text class="amb-mg-n" x={(x + bw / 2).toFixed(1)} y={(y - 5).toFixed(1)} text-anchor="middle">{v}</text>}
              {cifras && <text class={i === g.resaltado ? 'amb-mg-e amb-mg-e-si' : 'amb-mg-e'} x={(x + bw / 2).toFixed(1)} y={H - 4} text-anchor="middle">{semanas[i]}</text>}
            </g>
          );
        })}
      </svg>
    );
  }
  return <LineaAncha valores={vs} clase="mini-grafica amb-mg" />;
}
