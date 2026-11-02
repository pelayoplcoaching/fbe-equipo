import { Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Siluetas, useApp, useCarga, Icono, Disco, Cargando, ErrorCaja, Hoja, Paso, Segmentos, usePreferencia, Pista } from '../comunes.jsx';
import { BandaConexion } from '../App.jsx';
import { Hilo } from '../Hilo.jsx';
import { SubirArchivo } from '../Archivos.jsx';
import { EVENTO_PENDIENTES, listarPendientes } from '../../datos/pendientes.js';
import { Calculadora, Aproximacion, HistorialEjercicio, Placas } from '../Herramientas.jsx';
import { HojaCompartir } from '../Compartir.jsx';
import { HojaCompartirEquipo } from '../Comunidad.jsx';
import { PictoEjercicio } from '../Pictograma.jsx';
import { RPES, prepararAudio, celebrar, usePantallaEncendida, useAhora, aNumero, problemaSerie, Temporizador, prepararEjercicio, NotaFijada } from './sesion-comun.jsx';
import { Enfoque } from './Enfoque.jsx';
import { Metronomo } from './Metronomo.jsx';
import { Intervalos } from './Intervalos.jsx';
import { leerIntervalos, textoIntervalos } from '../../logica/intervalos.js';
import { tempoDe } from '../../logica/tempo.js';
import { MapaMuscular } from '../MapaMuscular.jsx';
import { Preparacion, ConsejoDia } from './Preparacion.jsx';
import { consejoPreparacion, subeCarga } from '../../logica/preparacion.js';
import { pauta, textoSerie, num, mmss, e1rm, inicioDeTanda, gruposSuperserie, etiquetasSuperserie, descansoGrupo, trasSerie, recordsDeSesion, NOMBRE_PRIORIDAD, NOMBRE_INTENCION, NOMBRE_GRUPO, NOMBRE_TIPO_SESION } from '../../logica/calculos.js';
import { fmtCorta, hoyISO, lunesDe, sumarDias, fechaMadrid } from '../../logica/fechas.js';
import { pesoAnterior } from '../../logica/nivel.js';
import { MODALIDADES, NOMBRE_MODALIDAD, cardioValido, cardioHechoValido, limpiarCardioHecho, textoCardio, textoCardioHecho, palabrasEsfuerzo, ritmo } from '../../logica/cardio.js';
import { DondeEntrenas } from './DondeEntrenas.jsx';
import { adaptarSesion, textoAdaptacion } from '../../logica/material.js';
import { fraseSerie } from '../../logica/voz.js';
import { hablar } from '../voz.js';
import { TextoConEnlaces } from '../Enlaces.jsx';
import { vibrar } from '../hapticos.js';
import { conTransicion } from '../transiciones.js';
import { seVe } from '../../logica/vistas.js';
import { guardarEnCurso, borrarEnCurso, cambiarDescansoEnCurso, leerEnCurso } from '../en-curso.js';
import { resumenSeries, compararConAnterior, textoComparacion, pautadasHechas, seriesPautadasHechas } from '../../logica/visual.js';
import { tramosSesion, prepDeHoy, conSeriesDeHoy } from '../../logica/tablero.js';
import { resumenPautas } from '../../logica/diseno.js';
import { Portada } from './Portada.jsx';
import { prepMarcadas, marcarPrepHoy, desmarcarPrepHoy } from './prep-hoy.js';

export function Sesion({ id, alCerrar, alLeer, salud = false }) {
  const { api, atleta, cola, aviso, propio } = useApp();
  const det = useCarga(() => api.sesion(id, atleta.id), [id]);
  // Mejores marcas hasta hoy (sin esta sesión): para avisar de un récord en cuanto se registra la serie
  const previas = useCarga(() => api.marcasPrevias(atleta.id, id).catch(() => null), [id]);
  const [hechas, setHechas] = useState({});        // sesion_ejercicio_id → { numero → serie }
  const [enCola, setEnCola] = useState({});        // `${seId}-${n}` → true si quedó guardada en el móvil
  // Cuando la cola se vacía (ya se ha enviado todo), las series dejan de marcarse como «guardada en el móvil»
  useEffect(() => cola.alCambiar((n) => { if (!n) setEnCola({}); }), []);
  const [abiertos, setAbiertos] = useState(null);
  const [descanso, setDescanso] = useState(null);  // { fin, total, prioridad, texto }
  // v0.52: el descanso también queda en «Sesión en curso» (al momento: si se quita, el aviso al móvil se anula; si se
  // sale de la sesión con él en marcha, lo lleva la píldora de arriba)
  const cambiarDescanso = (d) => { setDescanso(d); cambiarDescansoEnCurso(atleta.id, id, d); };
  // v0.52: lo que dice la píldora (se calcula al pintar, más abajo) y se guarda en el móvil tras cada pintado
  const enCurso = useRef(null);
  enCurso.current = null;
  // (hasta que las series de la sesión están en su sitio no se sabe si está a medias: no se borra nada antes)
  const seriesListas = useRef(false);
  useEffect(() => {
    if (!det.datos || !seriesListas.current) return;
    const x = enCurso.current;
    if (!x) { borrarEnCurso(atleta.id, id); return; }
    guardarEnCurso(atleta.id, { ...x, descanso: descanso ? { fin: descanso.fin, total: descanso.total, prioridad: descanso.prioridad || null, texto: descanso.texto || null, voz: descanso.voz || null, tras: descanso.tras || null, inicio: descanso.inicio || null } : null });
  });
  const [terminando, setTerminando] = useState(false);
  const [resumen, setResumen] = useState(null);
  const [verDinamica, setVerDinamica] = useState(true);
  const [calculadora, setCalculadora] = useState(false);
  const [intervalos, setIntervalos] = useState(null);       // null | { inicial }
  const [minutosHechos, setMinutosHechos] = useState(null); // lo que duró el temporizador de intervalos
  const [compartir, setCompartir] = useState(false);
  // v0.49: la serie que toca ahora (la que dijo trasSerie al marcar la anterior), para resaltarla
  const [proxima, setProxima] = useState(null);
  // Modo enfoque: se recuerda si el atleta lo prefiere; seFoco es el ejercicio que se ve
  const [enfoque, setEnfoque] = usePreferencia('fbe-enfoque', false);
  const [seFoco, setSeFoco] = useState(null);
  // Ejercicio con el que se está haciendo cada pauta, si se cambió por una alternativa (se recuerda en el móvil)
  const [sustitutos, setSustitutos] = usePreferencia(`fbe-sustitutos-${id}`, {});
  // v0.48: dónde entrena hoy (gimnasio, casa o viaje) y lo que se cambió por su material (para poder deshacerlo)
  const [lugar, setLugar] = usePreferencia(`fbe-lugar-${id}`, 'gimnasio');
  const [porLugar, setPorLugar] = usePreferencia(`fbe-lugar-cambios-${id}`, {});
  const [sinAlternativa, setSinAlternativa] = usePreferencia(`fbe-lugar-sin-${id}`, []);
  // Ejercicios elegidos fuera de las alternativas (de la biblioteca) y su «última vez»
  const [extra, setExtra] = useState({ ejercicios: {}, ultimas: {} });
  // Notas fijadas del atleta por ejercicio (se cargan con la sesión y se guardan al momento)
  const [notas, setNotas] = useState({});
  usePantallaEncendida();
  // v0.49: al completar las series pautadas de un ejercicio, su tarjeta se pliega un momento después. El temporizador
  // de cada uno se guarda para cancelarlo (si se desmarca, si falla el guardado o al salir) y, al cumplirse, se
  // vuelve a mirar con lo que hay entonces.
  const hechasRef = useRef({});
  hechasRef.current = hechas;
  const plegar = useRef({});
  const cancelarPlegado = (seId) => { clearTimeout(plegar.current[seId]); delete plegar.current[seId]; };
  useEffect(() => () => { for (const t of Object.values(plegar.current)) clearTimeout(t); plegar.current = {}; }, []);
  useEffect(() => { if (det.datos?.notas) setNotas(det.datos.notas); }, [det.datos]);
  // v0.41: vídeos de técnica de cada ejercicio, enviados y guardados en el móvil sin enviar (se recuentan al
  // subir uno y cada vez que cambia la cola de pendientes: así el aviso pasa solo de «sin enviar» a «enviado»)
  const [videos, setVideos] = useState({ enviados: {}, pendientes: {} }); // seId → número
  const [recontarVideos, setRecontarVideos] = useState(0);
  useEffect(() => {
    if (!det.datos) return undefined;
    const ids = det.datos.ejercicios.map((e) => e.id);
    let vivo = true;
    const contar = async () => {
      const [enviados, guardados] = await Promise.all([api.videosSesion(atleta.id, ids).catch(() => null), listarPendientes(atleta.id)]);
      if (!vivo) return;
      const pendientes = {};
      for (const g of guardados) {
        const se = g.opciones?.sesion_ejercicio_id;
        if (se && ids.includes(se)) pendientes[se] = (pendientes[se] || 0) + 1;
      }
      setVideos((v) => ({ enviados: enviados || v.enviados, pendientes }));
    };
    contar();
    window.addEventListener(EVENTO_PENDIENTES, contar);
    return () => { vivo = false; window.removeEventListener(EVENTO_PENDIENTES, contar); };
  }, [det.datos, recontarVideos]);
  // «¿Cómo llegas hoy?»: lo contestado (se guarda en la sesión), si se saltó y si se está cambiando
  const [prep, setPrep] = useState(undefined);
  // v0.51: «Ahora no» vale para ese día (se guarda la fecha de Madrid; lo de antes, «true», ya no cuenta)
  const [prepSaltadaDia, setPrepSaltadaDia] = usePreferencia(`fbe-prep-saltada-${id}`, false);
  const prepSaltada = prepSaltadaDia === fechaMadrid();
  const setPrepSaltada = (v) => setPrepSaltadaDia(v ? fechaMadrid() : false);
  // v0.51: lo guardado de otro día (sin series): no cuenta como de hoy; se vuelve a preguntar y, si no contesta, se
  // borra al saltar la pregunta o al marcar la primera serie (el coach no lo verá como de esta sesión)
  const [prepAntigua, setPrepAntigua] = useState(false);
  const [editandoPrep, setEditandoPrep] = useState(false);
  // En un día flojo o malo, si sube la carga o va con los pesos de la última vez (lo elige el atleta; se recuerda en el móvil)
  const [eleccionCarga, setEleccionCarga] = usePreferencia(`fbe-carga-dia-${id}`, null);
  // v0.51: la portada antes de empezar; al tocar «Empezar» (o con alguna serie hecha) se pasa a la sesión de siempre
  const [empezada, setEmpezada] = usePreferencia(`fbe-empezada-${id}`, false);
  const [recienEmpezada, setRecienEmpezada] = useState(false);
  // v0.51: la altura real de la cabecera pegada (con los tramos y la letra grande), para que lo que se lleva a la vista
  // (scroll-margin-top de cada ejercicio) quede debajo y no tapado
  useEffect(() => {
    const cab = document.querySelector('.sesion-vista > .cabecera');
    if (!cab || typeof ResizeObserver === 'undefined') return undefined;
    const raiz = document.documentElement;
    const ro = new ResizeObserver(() => raiz.style.setProperty('--alto-cab', `${Math.ceil(cab.getBoundingClientRect().height)}px`));
    ro.observe(cab);
    return () => { ro.disconnect(); raiz.style.removeProperty('--alto-cab'); };
  }, [!!det.datos, empezada]);
  // La regla de «de hoy», la misma que el dial de Hoy (logica/tablero.js, prepDeHoy)
  useEffect(() => {
    if (!det.datos || prep !== undefined) return;
    const s = det.datos.sesion;
    const conSeries = det.datos.ejercicios.some((e) => e.hechas.length);
    const seriesHoy = det.datos.ejercicios.some((e) => conSeriesDeHoy(e.hechas)) ? [s.id] : [];
    if (s.completada || prepDeHoy(s, hoyISO(), { marcadas: prepMarcadas(), seriesHoy })) setPrep(s.preparacion || null);
    else { setPrep(null); setPrepAntigua(!!s.preparacion && !conSeries); }
  }, [det.datos]);
  async function guardarPrep(p) {
    setPrep(p); setEditandoPrep(false); setPrepAntigua(false);
    if (p) marcarPrepHoy(id); else desmarcarPrepHoy(id);
    try { await api.guardarPreparacion(id, p); } catch (err) { aviso(`No se ha podido guardar (${err.message}). El consejo vale igual.`, 'error'); }
  }
  // Lo de otro día que no se ha vuelto a contestar: fuera (sin avisar: no es nada que haya hecho hoy)
  function quitarPrepAntigua() {
    if (!prepAntigua) return;
    setPrepAntigua(false);
    api.guardarPreparacion(id, null).catch(() => {});
  }
  async function guardarNota(ejercicioId, texto) {
    try {
      const n = await api.guardarNotaEjercicio(atleta.id, ejercicioId, texto);
      setNotas((m) => { const x = { ...m }; if (n) x[ejercicioId] = n; else delete x[ejercicioId]; return x; });
      aviso(n ? 'Nota guardada' : 'Nota quitada');
    } catch (err) { aviso(err.message, 'error'); throw err; }
  }

  // Si se eligió un ejercicio que no venía con la sesión (p. ej. tras recargar), se carga
  useEffect(() => {
    if (!det.datos) return;
    const faltan = Object.values(sustitutos).filter((x) => x && !det.datos.ejerciciosPorId[x] && !extra.ejercicios[x]);
    if (faltan.length) cargarExtra(faltan);
  }, [det.datos]);
  async function cargarExtra(ids, objetos = []) {
    try {
      const [ejs, ult] = await Promise.all([
        objetos.length ? objetos : api.ejerciciosPorIds(ids),
        api.ultimasPorEjercicio(atleta.id, ids, id),
      ]);
      setExtra((x) => ({ ejercicios: { ...x.ejercicios, ...Object.fromEntries(ejs.map((e) => [e.id, e])) }, ultimas: { ...x.ultimas, ...ult } }));
    } catch { /* sin conexión: se queda con lo que hay */ }
  }

  useEffect(() => {
    if (!det.datos) return;
    const m = {};
    for (const e of det.datos.ejercicios) m[e.id] = Object.fromEntries(e.hechas.map((s) => [s.numero, s]));
    setHechas(m);
    seriesListas.current = true;
    // Si ya hay series hechas con una alternativa, esa es la que se está usando
    const desdeSeries = {};
    for (const e of det.datos.ejercicios) {
      const ultima = [...e.hechas].reverse().find((s) => s.sustituto_id);
      if (ultima && !(e.id in sustitutos)) desdeSeries[e.id] = ultima.sustituto_id;
    }
    if (Object.keys(desdeSeries).length) setSustitutos({ ...sustitutos, ...desdeSeries });
    // v0.52: al volver a la sesión con un descanso en marcha (lo llevaba la píldora de arriba), sigue donde iba
    const ec = leerEnCurso(atleta.id);
    if (ec?.id === id && ec.descanso && ec.descanso.fin > Date.now() - 6000 && !det.datos.sesion.completada && det.datos.ejercicios.some((x) => x.hechas.length)) setDescanso(ec.descanso);
    if (abiertos === null) {
      const primero = det.datos.ejercicios.find((e) => e.hechas.length < e.series) || det.datos.ejercicios[0];
      setAbiertos(new Set(primero ? [primero.id] : []));
    }
  }, [det.datos]);

  if (det.cargando && !det.datos) return <div class="contenido"><Siluetas forma="sesion" texto="Cargando la sesión" /></div>;
  if (det.error) return <div class="contenido"><ErrorCaja error={det.error} reintentar={det.recargar} /><button class="btn" onClick={alCerrar}>Volver</button></div>;
  const { sesion, ejercicios, semana, progresionAuto } = det.datos;
  const ejerciciosPorId = { ...det.datos.ejerciciosPorId, ...extra.ejercicios };
  const ultimas = { ...det.datos.ultimas, ...extra.ultimas };
  if (resumen) return <Resumen resumen={resumen} sesion={sesion} alCerrar={alCerrar} />;


  const todas = Object.values(hechas).flatMap((m) => Object.values(m));
  // El cronómetro cuenta desde la primera serie de la tanda en curso (pasar la medianoche no lo reinicia;
  // retomar la sesión horas después, sí)
  const inicio = inicioDeTanda(todas);
  const totalPautadas = ejercicios.reduce((t, e) => t + e.series, 0);
  const actualDe = (e) => (sustitutos[e.id] && ejerciciosPorId[sustitutos[e.id]]) || e.ejercicio;

  const etiquetas = etiquetasSuperserie(ejercicios);
  // La serie que toca ahora: la que dijo la última serie marcada (si sigue sin hacer) o la primera sin hacer
  const pendienteDe = (x) => Array.from({ length: x.series }, (_, i) => i + 1).find((k) => !hechas[x.id]?.[k]);
  let prox = proxima && ejercicios.some((x) => x.id === proxima.id && proxima.numero <= x.series) && !hechas[proxima.id]?.[proxima.numero] ? proxima : null;
  if (!prox) { const x = ejercicios.find((y) => pendienteDe(y)); if (x) prox = { id: x.id, numero: pendienteDe(x) }; }
  if (sesion.completada) prox = null;
  const grupos = gruposSuperserie(ejercicios);
  // v0.51: antes de empezar, la portada (no en las hechas, ni con series, ni de baja)
  if (!sesion.completada && !empezada && todas.length === 0 && atleta.estado !== 'baja') {
    return (
      <Portada sesion={sesion} semana={semana} ejercicios={ejercicios} etiquetas={etiquetas} alCerrar={alCerrar}
        alEmpezar={() => {
          prepararAudio(); setRecienEmpezada(true); setEmpezada(true); window.scrollTo(0, 0);
          requestAnimationFrame(() => document.querySelector('.sesion-vista .cabecera h1')?.focus({ preventScroll: true }));
        }} />
    );
  }
  // v0.51: un tramo por ejercicio (o superserie) arriba; tocarlo lleva a ese ejercicio
  const tramos = !sesion.completada && ejercicios.length > 0 ? tramosSesion(ejercicios, hechas, prox?.id || null) : [];
  function irAEjercicio(seId) {
    const art = document.querySelector(`[data-se="${seId}"]`);
    if (!art) return;
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Con la altura real de la cabecera pegada (crece con la letra y con los tramos): la cabecera del ejercicio queda
    // justo debajo, nunca tapada
    const cab = document.querySelector('.sesion-vista > .cabecera');
    const tapa = cab ? cab.getBoundingClientRect().height + (parseFloat(getComputedStyle(cab).top) || 0) : 0;
    window.scrollTo({ top: Math.max(0, window.scrollY + art.getBoundingClientRect().top - tapa - 8), behavior: quieto ? 'auto' : 'smooth' });
    art.querySelector('.ejercicio-cab')?.focus({ preventScroll: true });
  }
  // Lleva la vista a la serie que toca del siguiente ejercicio (tras abrirlo)
  function llevarA(seId) {
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.querySelector(`[data-se="${seId}"] .serie.activa`) || document.querySelector(`[data-se="${seId}"]`);
      el?.scrollIntoView({ block: 'center', behavior: quieto ? 'auto' : 'smooth' });
    }));
  }
  const nombreCon = (x) => `${etiquetas[x.id] ? `${etiquetas[x.id]} ` : ''}${actualDe(x).nombre}`;
  // Series de hoy en el orden en que se hicieron, con el ejercicio con que se hicieron
  const pautaDe = Object.fromEntries(ejercicios.map((x) => [x.id, x]));
  const enOrden = (h) => Object.values(h).flatMap((m) => Object.values(m))
    .map((x) => ({ ...x, ejercicio_id: x.sustituto_id || pautaDe[x.sesion_ejercicio_id]?.ejercicio_id }))
    .sort((a, b) => (a.registrada_en < b.registrada_en ? -1 : a.registrada_en > b.registrada_en ? 1 : a.numero - b.numero));
  const claveSerie = (x) => `${x.sesion_ejercicio_id}-${x.numero}`;
  const records = previas.datos ? recordsDeSesion(enOrden(hechas), previas.datos, claveSerie) : {};
  // Ejercicio del modo enfoque: el elegido o el primero con series pendientes
  const seActual = (seFoco && pautaDe[seFoco] ? seFoco : null)
    || (ejercicios.find((x) => Object.keys(hechas[x.id] || {}).length < x.series) || ejercicios[0])?.id;
  // En un día flojo o malo no se propone subir carga
  // Sin consentimiento de salud (p. ej. si lo retiró) lo guardado no se usa
  const consejo = salud ? consejoPreparacion(prep) : null;
  const frenar = !subeCarga(consejo, eleccionCarga);
  // v0.52: lo que dirá la píldora «Sesión en curso» si sale de la sesión: el ejercicio y la serie que tocan
  if (!sesion.completada && todas.length > 0 && atleta.estado !== 'baja') {
    const pe = prox && pautaDe[prox.id];
    let siguienteTxt = null;
    if (pe) {
      siguienteTxt = `Serie ${prox.numero} de ${pe.series}`;
      try {
        const a = actualDe(pe), cambiado = a.id !== pe.ejercicio.id;
        const prop = prepararEjercicio(pe, cambiado ? a : null, cambiado ? ultimas[a.id] || null : pe.ultimas, semana?.foco, progresionAuto && !cambiado && !frenar).propuesta(prox.numero, hechas[pe.id] || {});
        if (prop?.kg) siguienteTxt += `: ${num(prop.kg, 2)} kg × ${prop.reps}`;
        else if (prop?.reps) siguienteTxt += `: ${prop.reps} repeticiones`;
      } catch { /* sin propuesta: la serie */ }
    }
    enCurso.current = { id, nombre: sesion.nombre, ejercicio: pe ? actualDe(pe).nombre : null, siguiente: siguienteTxt, hechas: todas.length, total: totalPautadas };
  }
  const preguntarPrep = salud && ejercicios.length > 0 && !sesion.completada && atleta.estado !== 'baja'
    && ((!prep && !prepSaltada && todas.length === 0) || editandoPrep);
  // El modo enfoque espera a que conteste (o salte) cómo llega
  const verEnfoque = enfoque && ejercicios.length > 0 && !sesion.completada && !terminando && !preguntarPrep && (empezada || todas.length > 0);
  // Abrir el modo enfoque a mano cuenta como «ahora no» a la pregunta de cómo llega
  const abrirEnfoque = () => { prepararAudio(); setSeFoco(null); setEnfoque(true); if (preguntarPrep) { setPrepSaltada(true); setEditandoPrep(false); quitarPrepAntigua(); } };

  async function guardar(e, numero, valores) {
    const problema = problemaSerie(valores);
    if (problema) { aviso(problema, 'error'); return; }
    prepararAudio();
    const sust = sustitutos[e.id] || null;
    const previa = hechas[e.id]?.[numero];
    // La hora de la serie es la de cuando se marcó por primera vez (corregirla no la cambia)
    const datos = { sesion_ejercicio_id: e.id, numero, kg: valores.kg, reps: valores.reps, rpe: valores.rpe === '' ? null : valores.rpe, sustituto_id: sust,
      registrada_en: previa?.registrada_en || new Date().toISOString() };
    const local = { ...datos, id: previa?.id || `local-${e.id}-${numero}` };
    setHechas((h) => ({ ...h, [e.id]: { ...h[e.id], [numero]: local } }));
    if (!previa) vibrar('serie');
    if (!previa) quitarPrepAntigua();
    // v0.49: al completar las series pautadas (las de «Añadir serie» no cuentan), la tarjeta se pliega en una línea
    // un momento después, para ver el check
    if (!previa && numero <= e.series && !pautadasHechas(e, hechas[e.id]) && pautadasHechas(e, { ...hechas[e.id], [numero]: local })) {
      cancelarPlegado(e.id);
      plegar.current[e.id] = setTimeout(() => { delete plegar.current[e.id]; plegarTarjeta(e); }, 700);
    }
    if (!previa && previas.datos) {
      const r = recordsDeSesion(enOrden({ ...hechas, [e.id]: { ...hechas[e.id], [numero]: local } }), previas.datos, claveSerie)[`${e.id}-${numero}`];
      if (r) { celebrar(); aviso(`¡Récord en ${actualDe(e).nombre}!`, 'record'); }
    }
    if (!previa) {
      // Qué toca ahora: en una superserie se pasa al siguiente ejercicio de la ronda sin descanso
      const cuenta = Object.fromEntries(ejercicios.map((x) => [x.id, Object.keys(hechas[x.id] || {}).length]));
      cuenta[e.id] += 1;
      const r = trasSerie(ejercicios, cuenta, e.id);
      const sig = r.siguiente && ejercicios.find((x) => x.id === r.siguiente.id);
      // La serie que toca, contando solo las pautadas (una de más no adelanta al ejercicio siguiente)
      const cuentaP = Object.fromEntries(ejercicios.map((x) => [x.id, seriesPautadasHechas(x, x.id === e.id ? { ...hechas[e.id], [numero]: local } : hechas[x.id])]));
      const rP = trasSerie(ejercicios, cuentaP, e.id);
      setProxima(rP.siguiente ? { id: rP.siguiente.id, numero: rP.siguiente.numero } : null);
      const texto = !sig ? 'terminar la sesión' : sig.id === e.id || r.siguiente.numero > 1 ? `serie ${r.siguiente.numero} de ${nombreCon(sig)}` : nombreCon(sig);
      // v0.48: lo que dirá el entrenador por voz al acabar el descanso («Serie 3 de press banca: 80 kilos por 6»)
      let voz = '¡Sesión terminada! Buen trabajo.';
      if (sig) {
        try {
          const a = actualDe(sig), cambiado = a.id !== sig.ejercicio.id;
          const hSig = sig.id === e.id ? { ...hechas[e.id], [numero]: local } : (hechas[sig.id] || {});
          const prop = prepararEjercicio(sig, cambiado ? a : null, cambiado ? ultimas[a.id] || null : sig.ultimas, semana?.foco, progresionAuto && !cambiado && !frenar).propuesta(r.siguiente.numero, hSig);
          voz = fraseSerie({ numero: r.siguiente.numero, series: sig.series, nombre: a.nombre, kg: prop?.kg, reps: prop?.reps });
        } catch { voz = `Ahora, ${texto}.`; }
      }
      // v0.50: el temporizador sale en la página, debajo de este ejercicio (o de su superserie)
      if (r.descanso) cambiarDescanso({ fin: Date.now() + r.descanso * 1000, total: r.descanso, prioridad: e.prioridad, texto, voz, tras: e.id, inicio: Date.now() });
      else if (r.enRonda) { cambiarDescanso(null); aviso(`Ahora ${nombreCon(sig)}, sin descanso`); hablar(`Sin descanso. ${voz}`); }
      else hablar(voz);
      if (sig && sig.id !== e.id) {
        setAbiertos((a) => new Set([...a, sig.id]));
        if (r.enRonda) llevarA(sig.id);
      }
    }
    try {
      const r = await cola.enviar({ tipo: 'serie', datos, atletaId: atleta.id });
      setEnCola((c) => ({ ...c, [`${e.id}-${numero}`]: r.enCola }));
    } catch (err) {
      aviso(err.message, 'error');
      cancelarPlegado(e.id);
      setHechas((h) => { const m = { ...h[e.id] }; if (previa) m[numero] = previa; else delete m[numero]; return { ...h, [e.id]: m }; });
    }
  }

  async function quitar(e, numero) {
    const previa = hechas[e.id]?.[numero];
    cancelarPlegado(e.id);
    setHechas((h) => { const m = { ...h[e.id] }; delete m[numero]; return { ...h, [e.id]: m }; });
    try {
      await cola.enviar({ tipo: 'borrarSerie', datos: { sesion_ejercicio_id: e.id, numero }, atletaId: atleta.id });
      aviso(`Serie ${numero} quitada`);
    } catch (err) {
      aviso(err.message, 'error');
      setHechas((h) => ({ ...h, [e.id]: { ...h[e.id], [numero]: previa } }));
    }
  }

  // Pliega la tarjeta si sigue completa: antes, el foco pasa a su cabecera (el botón que la vuelve a abrir) para que no
  // se pierda; y si la tarjeta empieza por encima de la pantalla (ya se ha bajado al siguiente), se compensa lo que
  // encoge para que lo que se está viendo no salte
  function plegarTarjeta(e) {
    if (!pautadasHechas(e, hechasRef.current[e.id])) return;
    const art = document.querySelector(`[data-se="${e.id}"]`);
    const cab = art?.querySelector('.ejercicio-cab');
    if (art && cab && art.contains(document.activeElement) && document.activeElement !== cab) cab.focus({ preventScroll: true });
    const antes = art?.getBoundingClientRect();
    setAbiertos((a) => { const n = new Set(a || []); n.delete(e.id); return n; });
    if (!antes || antes.top >= 0) return;
    requestAnimationFrame(() => {
      const despues = art.isConnected ? art.getBoundingClientRect() : null;
      if (despues && despues.height < antes.height) window.scrollBy({ top: despues.height - antes.height, behavior: 'instant' });
    });
  }
  const alternar = (eid) => { cancelarPlegado(eid); setAbiertos((a) => { const n = new Set(a); n.has(eid) ? n.delete(eid) : n.add(eid); return n; }); };
  // v0.48: «¿Dónde entrenas hoy?». Se deshace lo que puso el lugar anterior (si aún no tiene series) y, fuera del
  // gimnasio, se cambia lo que no se puede hacer con ese material por la primera alternativa del coach que sí;
  // lo que se cambió a mano, o ya tiene series, no se toca
  function elegirLugar(nuevo, perfiles) {
    const s = { ...sustitutos };
    for (const [seId, ejId] of Object.entries(porLugar)) if (s[seId] === ejId && !Object.keys(hechas[seId] || {}).length) s[seId] = null;
    let cambios = {}, sin = [];
    if (nuevo !== 'gimnasio') {
      const fijos = new Set(Object.entries(s).filter(([, v]) => v).map(([k]) => k));
      const r = adaptarSesion(ejercicios.map((x) => ({ ...x, hechas: Object.values(hechas[x.id] || {}) })), perfiles?.[nuevo] || [], { fijos });
      for (const [seId, alt] of Object.entries(r.cambios)) { s[seId] = alt.id; cambios[seId] = alt.id; if (!ejerciciosPorId[alt.id]) cargarExtra([alt.id], [alt]); }
      sin = r.sinAlternativa;
      aviso(textoAdaptacion(r, nuevo));
    } else if (lugar !== 'gimnasio') aviso('En el gimnasio: la sesión tal y como la pautó tu coach');
    setSustitutos(s); setPorLugar(cambios); setSinAlternativa(sin); setLugar(nuevo);
  }
  const deshacerLugar = (seId) => {
    setSustitutos({ ...sustitutos, [seId]: null });
    const { [seId]: _, ...resto } = porLugar;
    setPorLugar(resto);
    aviso('Vuelve el ejercicio que pautó tu coach');
  };
  const ultimaHecha = todas.sort((a, b) => (a.registrada_en < b.registrada_en ? 1 : -1))[0];
  // Intervalos escritos por el coach en la sesión («8 × 30 s / 90 s», «EMOM 12»…)
  const delCoach = leerIntervalos(sesion.dinamica);

  return (
    <>
    <div class={`contenido sesion-vista ${recienEmpezada ? 'sesion-tras-portada' : ''}`} inert={verEnfoque ? '' : undefined} aria-hidden={verEnfoque ? 'true' : undefined}>
      <header class={`cabecera ${tramos.length ? 'con-tramos' : ''}`}>
        <button class="btn btn-icono plano" onClick={alCerrar} aria-label="Volver"><Icono n="atras" /></button>
        <div class="titulo">
          <h1 tabIndex={-1}>{sesion.nombre}</h1>
          <div class="sub">{sesion.tipo !== 'fuerza' ? NOMBRE_TIPO_SESION[sesion.tipo] : NOMBRE_INTENCION[sesion.intencion] || 'Sesión'}{sesion.completada ? ', hecha' : ''}</div>
        </div>
        {ejercicios.length > 0 && !sesion.completada && <button class="btn btn-icono plano" onClick={() => abrirEnfoque()} aria-label="Modo enfoque"><Icono n="enfoque" /></button>}
        {!ejercicios.length && <button class="btn btn-icono plano" onClick={() => setIntervalos({ inicial: delCoach })} aria-label="Temporizador de intervalos"><Icono n="intervalos" /></button>}
        <button class="btn btn-icono plano" onClick={() => setCalculadora(true)} aria-label="Calculadora"><Icono n="calculadora" /></button>
        {ejercicios.length > 0 && <Cronometro inicio={sesion.completada ? null : inicio} minutos={sesion.completada ? sesion.duracion_min : null} hechas={todas.length} total={totalPautadas} />}
        {tramos.length > 0 ? (
          <nav class="tramos" aria-label="Ejercicios de la sesión">
            <ol>
              {tramos.map((t) => {
                const nombre = t.letra ? `Superserie ${t.letra}: ${t.ids.map((x) => actualDe(pautaDe[x]).nombre).join(' y ')}` : actualDe(pautaDe[t.id]).nombre;
                return (
                  <li key={t.id}>
                    <a href={`#ej-${t.id}`} class={t.completo ? 'completo' : ''} aria-current={t.actual ? 'step' : undefined}
                      aria-label={`${nombre}: ${t.hechas} de ${t.series} series${t.actual ? ', ahora' : ''}`} onClick={(ev) => { ev.preventDefault(); irAEjercicio(t.id); }}>
                      <span class="tramo-barra" aria-hidden="true"><span class="tramo-lleno" style={{ width: `${t.frac * 100}%` }} /></span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : totalPautadas > 0 && (
          <div class="barra-sesion" role="progressbar" aria-label="Series hechas" aria-valuemin="0" aria-valuemax={totalPautadas} aria-valuenow={Math.min(todas.length, totalPautadas)}>
            <span style={{ width: `${Math.min(100, (todas.length / totalPautadas) * 100)}%` }} />
          </div>
        )}
      </header>
      {!sesion.completada && ejercicios.length > 0 && <Pista id="sesion" icono="hoy">Cada ejercicio trae lo que te toca (series, repeticiones y esfuerzo). Apunta los kilos y las repeticiones de cada serie y márcala como hecha: el descanso arranca solo. El esfuerzo (RPE) va del 6 al 10: 10 es que no podías hacer ni una más; 8, que te quedaban dos.</Pista>}
      <BandaConexion />

      {sesion.dinamica && (
        <div class="nota-coach">
          <Icono n="mensaje" />
          <div>
            <button class="btn-texto" style="padding:0;min-height:0;color:var(--tinta);font-weight:700" onClick={() => setVerDinamica(!verDinamica)} aria-expanded={verDinamica}>Cómo es la sesión</button>
            {verDinamica && <p style="margin-top:4px;white-space:pre-line">{sesion.dinamica}</p>}
          </div>
        </div>
      )}

      {preguntarPrep ? <Preparacion inicial={prep} alGuardar={guardarPrep} alSaltar={editandoPrep ? () => setEditandoPrep(false) : () => { setPrepSaltada(true); quitarPrepAntigua(); }} />
        : consejo && !sesion.completada && <ConsejoDia consejo={consejo} eleccion={eleccionCarga} alElegir={(v) => { setEleccionCarga(v); aviso(v === 'subir' ? 'Hoy vas con la carga que toca' : 'Hoy vas con los pesos de la última vez'); }} alCambiar={() => setEditandoPrep(true)} alQuitar={async () => { await guardarPrep(null); setPrepSaltada(true); }} />}

      {delCoach && !sesion.completada && (
        <button class="tarjeta-intervalos" onClick={() => setIntervalos({ inicial: delCoach })}>
          <Icono n="intervalos" />
          <span class="pila-xs"><strong>Intervalos de hoy</strong><span class="num">{textoIntervalos(delCoach)}</span></span>
          <span class="btn btn-peq btn-primario" aria-hidden="true">Abrir</span>
        </button>
      )}
      {cardioValido(sesion.cardio) && <TarjetaCardio pauta={sesion.cardio} hecho={sesion.cardio_hecho} completada={sesion.completada} />}
      {!sesion.completada && ejercicios.length > 0 && atleta.estado !== 'baja' && (
        <DondeEntrenas atletaId={atleta.id} lugar={lugar} alElegir={elegirLugar}
          cambios={Object.fromEntries(Object.entries(porLugar).filter(([k, v]) => sustitutos[k] === v))} sinAlternativa={sinAlternativa} />
      )}
      {!ejercicios.length && !cardioValido(sesion.cardio) && (
        <div class="panel panel-pad pila-s">
          <strong>{sesion.tipo === 'cardio' ? 'Sesión de cardio' : sesion.tipo === 'movilidad' ? 'Sesión de movilidad' : 'Sesión sin ejercicios'}</strong>
          <p class="secundario peq">Haz lo que indica tu coach arriba. Al terminar, apunta cuánto ha durado y cuánto te ha costado.</p>
          {!delCoach && !sesion.completada && <button class="btn btn-peq" style="justify-self:start" onClick={() => setIntervalos({ inicial: null })}><Icono n="intervalos" /> Temporizador de intervalos</button>}
        </div>
      )}

      {grupos.map((g) => {
        const tarjetas = g.items.map((e) => {
          const actual = actualDe(e);
          const cambiado = actual.id !== e.ejercicio.id;
          return (
            <Ejercicio key={e.id} e={e} actual={cambiado ? actual : null} ultimas={cambiado ? ultimas[actual.id] || null : e.ultimas}
              foco={semana?.foco} progresionAuto={progresionAuto && !cambiado && !frenar} etiqueta={etiquetas[e.id]} records={records}
              nota={notas[actual.id]} guardarNota={(t) => guardarNota(actual.id, t)}
              coach={det.datos.coach?.[actual.id] || null}
              lugar={porLugar[e.id] && sustitutos[e.id] === porLugar[e.id] ? lugar : null} deshacerLugar={() => deshacerLugar(e.id)}
              sinMaterial={lugar !== 'gimnasio' && sinAlternativa.includes(e.id) && !cambiado ? lugar : null}
              videos={videos.enviados[e.id] || 0} videosPendientes={videos.pendientes[e.id] || 0} alSubirVideo={() => setRecontarVideos((n) => n + 1)}
              hechas={hechas[e.id] || {}} enCola={enCola} abierto={abiertos?.has(e.id)} siguiente={prox?.id === e.id ? prox.numero : null}
              alternar={() => alternar(e.id)} guardar={(n, v) => guardar(e, n, v)} quitar={(n) => quitar(e, n)}
              cambiar={(ej) => {
                setSustitutos({ ...sustitutos, [e.id]: ej.id === e.ejercicio.id ? null : ej.id });
                if (ej.id !== e.ejercicio.id && !ejerciciosPorId[ej.id]) cargarExtra([ej.id], [ej]);
              }} />
          );
        });
        const conReloj = descanso && !verEnfoque && g.items.some((e) => e.id === descanso.tras);
        const reloj = conReloj && <Temporizador key={`reloj-${descanso.tras}`} {...descanso} alCambiar={cambiarDescanso} />;
        if (!g.letra) return reloj ? [...tarjetas, reloj] : tarjetas;
        const d = descansoGrupo(g);
        return [
          <section class="superserie" key={`ss-${g.items[0].id}`} aria-label={`Superserie ${g.letra}`}>
            <div class="superserie-cab">
              <span class="ss-letra" aria-hidden="true">{g.letra}</span>
              <span><strong>Superserie</strong>: alterna una serie de cada ejercicio{d ? ` y descansa ${mmss(d)} al acabar la ronda` : ' y descansa al acabar la ronda'}.</span>
            </div>
            {tarjetas}
          </section>,
          reloj,
        ];
      })}
      {/* (un descanso sin su ejercicio en la lista, por si acaso: antes de terminar) */}
      {descanso && !verEnfoque && !ejercicios.some((e) => e.id === descanso.tras) && <Temporizador {...descanso} alCambiar={cambiarDescanso} />}

      <button class="btn btn-primario btn-grande btn-ancho" onClick={() => setTerminando(true)}>
        <Icono n="hecho" /> {sesion.completada ? 'Cambiar la valoración' : 'Terminar sesión'}
      </button>
      {sesion.completada && todas.length > 0 && (
        <button class="btn btn-ancho" onClick={() => setCompartir(true)}><Icono n="compartir" /> Compartir la sesión</button>
      )}

      {!propio && (
        <section class="seccion">
          <h2>Comentarios con tu coach</h2>
          <div class="panel panel-pad">
            <Hilo atletaId={atleta.id} sesionId={sesion.id} alLeer={alLeer}
              vacio="¿Algo que contarle de esta sesión? Un cambio, una molestia, una duda. Tu coach te responde aquí." />
          </div>
        </section>
      )}

      {compartir && <HojaCompartir plantillas datos={datosTarjeta(sesion, ejercicios, hechas, records, ejerciciosPorId, sesion.duracion_min)} alCerrar={() => setCompartir(false)} />}
      {intervalos && <Intervalos inicial={intervalos.inicial} alCerrar={() => setIntervalos(null)}
        alTerminar={sesion.completada ? null : ({ minutos }) => {
          // En una sesión con ejercicios, el temporizador es solo una parte (el «para acabar»): manda el reloj de la sesión
          setIntervalos(null); setMinutosHechos(ejercicios.length ? null : minutos + 5); setTerminando(true);
        }} />}
      {calculadora && <Calculadora inicial={ultimaHecha ? { kg: Number(ultimaHecha.kg) || 60, reps: ultimaHecha.reps || 5, rpe: ultimaHecha.rpe ? Math.round(ultimaHecha.rpe) : 8 } : {}} alCerrar={() => setCalculadora(false)} />}
      {terminando && (
        <Terminar sesion={sesion} semana={semana} inicio={inicio} minutosSugeridos={minutosHechos} conEjercicios={ejercicios.length > 0} alCerrar={() => { setTerminando(false); setMinutosHechos(null); }}
          alGuardar={async (cambios) => {
            const r = await cola.enviar({ tipo: 'sesion', datos: { id: sesion.id, cambios }, atletaId: atleta.id });
            setTerminando(false);
            cambiarDescanso(null);
            // La sesión ya está guardada: si el resumen falla por lo que sea, se enseña uno mínimo (nunca se queda colgada)
            let res;
            try { res = await calcularResumen(api, atleta.id, ejercicios, hechas, cambios, r.enCola, ejerciciosPorId, records, sesion); }
            catch (e) {
              console.error('No se pudo preparar el resumen', e);
              res = { series: Object.values(hechas).reduce((n, h) => n + Object.keys(h || {}).length, 0), tonelaje: 0, minutos: cambios.duracion_min, rpe: cambios.rpe_sesion, cardio: cambios.cardio_hecho || null, records: [], enCola: r.enCola, musculos: {}, tarjeta: null };
            }
            setResumen(res);
          }} />
      )}
    </div>
    {verEnfoque && (
        <Enfoque ejercicios={ejercicios} hechas={hechas} records={records} etiquetas={etiquetas} actualDe={actualDe}
          ultimasDe={(x) => { const a = actualDe(x); return a.id !== x.ejercicio.id ? ultimas[a.id] || null : x.ultimas; }}
          foco={semana?.foco} progresionAuto={progresionAuto && !frenar} notas={notas} guardarNota={guardarNota}
          guardar={guardar} quitar={quitar} descanso={descanso} setDescanso={cambiarDescanso}
          seId={seActual} setSeId={setSeFoco} inicio={inicio} alTerminar={() => setTerminando(true)}
          alSalir={() => { setEnfoque(false); setAbiertos((a) => new Set([...(a || []), seActual])); llevarA(seActual); }} />
      )}
    </>
  );
}

function Cronometro({ inicio, minutos, hechas, total }) {
  const ahora = useAhora(1000);
  return (
    <div style="text-align:right">
      <div class="num" style="font-size:1.0625rem">{minutos != null ? `${minutos} min` : inicio ? mmss((ahora - inicio) / 1000) : '0:00'}</div>
      <div class="sesion-cab-num">{hechas}/{total} series</div>
    </div>
  );
}

function Ejercicio({ e, actual, ultimas, foco, progresionAuto, etiqueta, records = {}, hechas, enCola, abierto, siguiente = null, alternar, guardar, quitar, cambiar, nota, guardarNota, videos = 0, videosPendientes = 0, alSubirVideo, coach = null, lugar = null, deshacerLugar, sinMaterial = null }) {
  const { atleta, propio } = useApp();
  const [hoja, setHoja] = useState(null); // tecnica | cambiar | historial | aproximacion
  const [editandoNota, setEditandoNota] = useState(false);
  const pa = pauta(e);
  const n = Object.keys(hechas).length;
  const [extra, setExtra] = useState(0);
  const filas = Math.max(e.series, ...Object.keys(hechas).map(Number), 0) + extra;
  const activa = Array.from({ length: filas }, (_, i) => i + 1).find((k) => !hechas[k]);
  const { ej, prescripcion, sugerencia, barra, conAproximacion, kgTrabajo, propuesta, top } = prepararEjercicio(e, actual, ultimas, foco, progresionAuto);
  // Sin carga pautada (a RPE): en cada serie, su peso de la última vez como referencia
  const conAnterior = prescripcion.carga_sugerida_kg == null;
  const tipoDe = (k) => (!top || k > e.series ? null : k === 1 ? 'top' : 'backoff');
  const kgBackoff = top ? propuesta(2, hechas)?.kg : null;
  const tempo = tempoDe(e);
  // v0.49: hecho del todo y cerrado, el ejercicio es una sola línea (nombre, lo hecho y el check); se abre al tocarlo
  const completo = pautadasHechas(e, hechas);
  const nPautadas = seriesPautadasHechas(e, hechas);
  const plegado = !abierto && completo;
  // Las herramientas del ejercicio, en la hoja «Más» (fuera de la tarjeta, para que no estorben entre serie y serie)
  const herramientas = [
    { id: 'cambiar', ico: 'intercambiar', texto: 'Cambiar', detalle: 'Por una alternativa, si la máquina está ocupada o algo no te sienta bien' },
    { id: 'historial', ico: 'historial', texto: 'Historial', detalle: 'Tus series, gráficas y récords de este ejercicio' },
    tempo && { id: 'tempo', ico: 'altavoz', texto: `Tempo ${tempo.texto}`, nombre: `Metrónomo de tempo ${tempo.texto}`, detalle: 'Metrónomo que marca la bajada, la pausa y la subida' },
    !nota && !editandoNota && { id: 'nota', ico: 'chincheta', texto: 'Nota', detalle: 'Una nota fija para ti en este ejercicio (la silla en el 4, el agarre…)' },
    conAproximacion && kgTrabajo > 0 && { id: 'aproximacion', ico: 'llama', texto: 'Aproximación', detalle: `Series de calentamiento hasta ${num(kgTrabajo, 2)} kg` },
    (ej.instrucciones || ej.errores) && { id: 'tecnica', ico: 'biblioteca', texto: 'Técnica', detalle: 'Las claves y los errores comunes' },
    ej.video_url && { id: 'tutorial', ico: 'video', texto: 'Tutorial', detalle: 'El vídeo del ejercicio (se abre aparte)', href: ej.video_url },
  ].filter(Boolean);
  const usar = (h) => {
    if (h.id === 'tempo') prepararAudio();
    if (h.id === 'nota') { setHoja(null); setEditandoNota(true); return; }
    // v0.52: el nombre y el pictograma del ejercicio pasan a la cabecera de su ficha (elemento compartido)
    // (si la cabecera de la tarjeta se ha quedado fuera de la pantalla, el nombre sale del título de la hoja «Más»)
    if (h.id === 'historial') {
      const cab = document.querySelector(`[data-se="${e.id}"] .ejercicio-cab`);
      const aLaVista = (el) => !!el && seVe(el.getBoundingClientRect(), innerWidth, innerHeight);
      const nombre = cab?.querySelector('.nombre');
      const tituloMas = [...document.querySelectorAll('.hoja-dialogo .hoja-cab h2')].pop();
      conTransicion(() => setHoja('historial'), 'morph', [
        { nombre: 'vt-ej-nombre', desde: aLaVista(nombre) ? nombre : tituloMas, hasta: '.ficha-ejercicio .hoja-cab h2' },
        { nombre: 'vt-ej-picto', desde: cab?.querySelector('.picto'), hasta: '.ficha-ejercicio .ficha-ej-cab .picto' },
      ]);
      return;
    }
    setHoja(h.id);
  };

  return (
    <article id={`ej-${e.id}`} class={`ejercicio ${plegado ? 'plegado' : ''} ${siguiente ? 'en-curso' : ''}`} data-se={e.id} aria-label={etiqueta ? `${etiqueta}: ${ej.nombre}` : ej.nombre}>
      <button class="ejercicio-cab" onClick={alternar} aria-expanded={abierto ? 'true' : 'false'}>
        {/* v0.50: el pictograma de su patrón de movimiento, con el disco de la prioridad en la esquina */}
        <span class="ej-marca"><PictoEjercicio ejercicio={ej} /><Disco prioridad={e.prioridad} titulo={NOMBRE_PRIORIDAD[e.prioridad]} /></span>
        <span>
          <span class="nombre">{etiqueta && <span class="ss-etq">{etiqueta}</span>}{ej.nombre}</span>
          {plegado && <span class="resumen-ej num">{resumenSeries(Object.keys(hechas).map(Number).sort((a, b) => a - b).map((k) => hechas[k]))}</span>}
          {!plegado && actual && <span class="cambiado">{lugar ? `Por tu material ${lugar === 'viaje' ? 'de viaje' : 'de casa'}: en lugar de` : 'En lugar de'} {e.ejercicio.nombre}</span>}
          {!plegado && sinMaterial && <span class="video-aviso pendiente"><Icono n="alerta" />Sin alternativa con tu material {sinMaterial === 'viaje' ? 'de viaje' : 'de casa'}</span>}
          {!plegado && e.variante && <span class="variante">{e.variante}</span>}
          {!plegado && e.tempo && tempo && <span class="variante">Tempo {tempo.texto}</span>}
          {!plegado && <span class="pauta">
            <span class="num">{pa.series}</span>
            {pa.detalle && <span>serie a serie</span>}
            {pa.esfuerzo && <span>{pa.esfuerzo}</span>}
            {pa.carga && !actual && <span class="num">{pa.carga}</span>}
            {pa.descanso && !etiqueta && <span>descanso {pa.descanso}</span>}
          </span>}
          {videosPendientes > 0
            ? <span class="video-aviso pendiente"><Icono n="reloj" />{videosPendientes === 1 ? 'Vídeo guardado en el móvil, sin enviar' : `${videosPendientes} vídeos guardados en el móvil, sin enviar`}</span>
            : videos > 0 && <span class="video-aviso"><Icono n="hecho" />{videos === 1 ? 'Vídeo enviado' : `${videos} vídeos enviados`}</span>}
        </span>
        <span class={`progreso-series ${completo ? 'hecho' : ''}`}>{completo ? <Icono n="hecho" width="22" height="22" titulo="Hecho" /> : `${nPautadas}/${e.series}`}</span>
      </button>
      {abierto && (
        <div class="ejercicio-cuerpo">
          <NotaFijada nota={nota} alGuardar={guardarNota} editando={editandoNota} alEditar={setEditandoNota} />
          {lugar && <p class="cambio-lugar"><span>Cambiado por tu material. Lo que apuntes queda como {ej.nombre}.</span><button class="btn-texto" onClick={deshacerLugar}><Icono n="reiniciar" /> Deshacer</button></p>}
          {sinMaterial && <p class="cambio-lugar"><span>Tu coach no ha marcado una alternativa que puedas hacer con tu material. Hazlo como puedas, cámbialo tú o coméntaselo.</span></p>}
          {coach?.lista?.length > 0 && <LoQueTeDijo coach={coach} nombre={ej.nombre} />}
          {(e.notas_coach || e.prioridad === 'muy_baja') && (
            <div class="ejercicio-extra">
              {e.notas_coach && <p><strong>Nota: </strong><TextoConEnlaces texto={e.notas_coach} como="span" /></p>}
              {e.prioridad === 'muy_baja' && <p>Si vas justo de tiempo, este es el que puedes saltarte.</p>}
            </div>
          )}
          {ultimas && (
            <p class="ultima-vez">
              La última vez ({fmtCorta(ultimas.fecha)}):{' '}
              {ultimas.series.map((s, i) => <span key={i}>{i ? ', ' : ''}<span class="num">{textoSerie({ ...s, rpe: null })}</span>{s.rpe ? ` @${num(s.rpe)}` : ''}</span>)}
            </p>
          )}
          {/* Se queda hasta acabar el ejercicio: si desapareciera tras la primera serie, las filas subirían bajo el dedo */}
          {sugerencia && n < e.series && <p class={`sugerencia ${sugerencia.tipo}`}><Icono n={sugerencia.tipo === 'subir' ? 'arriba' : 'reiniciar'} />{sugerencia.texto}</p>}
          <div class="series-cab" aria-hidden="true"><span>Serie</span><span>Kg</span><span>Reps</span><span>Esfuerzo</span><span /></div>
          {Array.from({ length: filas }, (_, i) => i + 1).map((k) => {
            const prop = propuesta(k, hechas);
            return (
              <Fragment key={k}>
                <FilaSerie numero={k} hecha={hechas[k]} propuesta={prop} activa={k === activa} siguiente={k === siguiente} barra={barra} record={hechas[k] ? records[`${e.id}-${k}`] : null}
                  anterior={conAnterior ? pesoAnterior(ultimas, k) : null}
                  pendiente={enCola[`${e.id}-${k}`]} nombre={ej.nombre} tipo={tipoDe(k)}
                  guardar={(v) => guardar(k, v)} quitar={() => quitar(k)} />
                {k === 1 && top && n < e.series && (
                  <p class="backoff-nota">
                    <Icono n="abajo" />
                    {hechas[1]
                      ? <span>Back-off: un {num(e.backoff_pct)} % menos que tu top, <strong class="num">{num(kgBackoff, 2)} kg</strong>.</span>
                      : <span>Las back-off se calculan con lo que hagas en la top ({num(e.backoff_pct)} % menos).</span>}
                  </p>
                )}
              </Fragment>
            );
          })}
          <button class="btn-texto" style="justify-self:start" onClick={() => setExtra(extra + 1)}><Icono n="mas" /> Añadir serie</button>
          <div class="acciones-ej">
            {!propio && <SubirArchivo atletaId={atleta.id} sesionEjercicioId={e.id} ejercicioId={ej.id} titulo={`Vídeo: ${ej.nombre}`} etiqueta={videos + videosPendientes > 0 ? 'Enviar otro vídeo' : undefined} alSubir={alSubirVideo} />}
            <button class="btn-texto btn-mas" onClick={() => setHoja('mas')} aria-haspopup="dialog" aria-label={`Más herramientas de ${ej.nombre}`}><Icono n="opciones" /> Más</button>
          </div>
        </div>
      )}
      {hoja === 'mas' && (
        <Hoja titulo={ej.nombre} alCerrar={() => setHoja(null)}>
          <ul class="lista hoja-acciones">
            {herramientas.map((h) => (
              <li key={h.id}>
                {h.href
                  ? <a class="accion-fila" href={h.href} target="_blank" rel="noopener" onClick={() => setHoja(null)}><span class="ico"><Icono n={h.ico} /></span><span class="pila-xs"><strong>{h.texto}</strong><span class="peq secundario">{h.detalle}</span></span><Icono n="enlace" class="cola" /></a>
                  : <button class="accion-fila" aria-label={h.nombre || h.texto} aria-describedby={`acc-${e.id}-${h.id}`} onClick={() => usar(h)}><span class="ico"><Icono n={h.ico} /></span><span class="pila-xs"><strong>{h.texto}</strong><span class="peq secundario" id={`acc-${e.id}-${h.id}`}>{h.detalle}</span></span><Icono n="derecha" class="cola" /></button>}
              </li>
            ))}
          </ul>
        </Hoja>
      )}
      {hoja === 'tecnica' && <Tecnica ej={ej} alCerrar={() => setHoja(null)} />}
      {hoja === 'cambiar' && <Cambiar e={e} actual={ej} alCerrar={() => setHoja(null)} alElegir={(x) => { cambiar(x); setHoja(null); }} />}
      {hoja === 'historial' && <HistorialEjercicio atletaId={atleta.id} ejercicio={ej} inicial="historial" alCerrar={() => setHoja(null)} />}
      {hoja === 'tempo' && <Metronomo tempo={tempo} nombre={ej.nombre} reps={e.reps_max ?? e.reps_min ?? 8} alCerrar={() => setHoja(null)} />}
      {hoja === 'aproximacion' && <Aproximacion nombre={ej.nombre} kg={kgTrabajo} reps={e.reps_max ?? e.reps_min ?? 5} conBarra={barra} alCerrar={() => setHoja(null)} />}
    </article>
  );
}

// «Lo que te dijo tu coach» (v0.48): sus últimos comentarios de este ejercicio (en tus vídeos o en sesiones
// anteriores en que lo nombró)
function LoQueTeDijo({ coach, nombre }) {
  const [abierto, setAbierto] = useState(false);
  const [x, ...resto] = coach.lista;
  const corto = (t) => (t.length > 140 ? `${t.slice(0, 138)}…` : t);
  return (
    <div class="dijo-coach">
      <span class="mini dijo-coach-cab"><Icono n="mensaje" /> Lo que te dijo tu coach <span class="terciario">· {x.donde}, {fmtCorta(x.fecha)}</span></span>
      <p class="peq">«{corto(x.texto)}»</p>
      {(resto.length > 0 || x.texto.length > 140 || coach.total > coach.lista.length) && <button class="btn-texto mini" onClick={() => setAbierto(true)}>Ver {coach.total > 1 ? `lo que te ha dicho (${coach.total})` : 'entero'}</button>}
      {abierto && (
        <Hoja titulo={`Tu coach sobre ${nombre}`} alCerrar={() => setAbierto(false)}>
          <ul class="lista">
            {coach.lista.map((c, i) => <li key={i} class="panel-pad pila-xs"><span class="mini terciario">{c.donde}, {fmtCorta(c.fecha)}</span><TextoConEnlaces texto={c.texto} clase="peq" /></li>)}
          </ul>
          {coach.total > coach.lista.length && <p class="mini terciario">Y {coach.total - coach.lista.length} más en tus mensajes.</p>}
        </Hoja>
      )}
    </div>
  );
}

function Tecnica({ ej, alCerrar }) {
  return (
    <Hoja titulo={ej.nombre} alCerrar={alCerrar}>
      <div class="pila">
        {ej.rango_reps && <p class="peq"><span class="terciario">Rango recomendado: </span>{ej.rango_reps}</p>}
        {ej.instrucciones && <section class="pila-s"><h3 class="peq">Claves</h3>{ej.instrucciones.split(/\n{2,}/).map((p, i) => <p key={i} class="secundario" style="white-space:pre-line">{p}</p>)}</section>}
        {ej.errores && <section class="pila-s"><h3 class="peq">Errores comunes</h3>{ej.errores.split(/\n{2,}/).map((p, i) => <p key={i} class="secundario" style="white-space:pre-line">{p}</p>)}</section>}
        {ej.video_url && <a class="btn btn-ancho" href={ej.video_url} target="_blank" rel="noopener"><Icono n="video" /> Ver el vídeo</a>}
      </div>
    </Hoja>
  );
}

// Cambiar el ejercicio por una alternativa equivalente (las que marca el coach en la biblioteca)
function Cambiar({ e, actual, alCerrar, alElegir }) {
  const { api } = useApp();
  const [otros, setOtros] = useState(false);
  const biblioteca = useCarga(() => (otros ? api.biblioteca() : Promise.resolve([])), [otros]);
  const principal = e.ejercicio.grupos_musculares?.[0];
  const delGrupo = (biblioteca.datos || []).filter((x) => x.activo !== false && x.grupos_musculares?.[0] === principal && x.id !== e.ejercicio.id && !e.alternativas.some((a) => a.id === x.id));
  const Opcion = ({ x, nota }) => (
    <button key={x.id} class={x.id === actual.id ? 'elegida' : ''} aria-pressed={x.id === actual.id ? 'true' : 'false'} onClick={() => alElegir(x)}>
      <span style="font-weight:600">{x.nombre}</span>
      <span class="mini terciario">{nota || (x.grupos_musculares || []).map((g) => NOMBRE_GRUPO[g]).join(', ')}</span>
    </button>
  );
  return (
    <Hoja titulo="Cambiar ejercicio" alCerrar={alCerrar}>
      <p class="peq secundario">Si la máquina está ocupada o algo no te sienta bien, cámbialo. Las series que registres quedarán a nombre del ejercicio que hagas y tu coach verá el cambio.</p>
      <div class="lista-elegir">
        <Opcion x={e.ejercicio} nota="El que tienes pautado" />
        {e.alternativas.map((x) => <Opcion x={x} key={x.id} />)}
        {!e.alternativas.length && <div class="panel-pad peq secundario">Tu coach no ha marcado alternativas para este ejercicio.</div>}
      </div>
      {!otros ? (
        principal && <button class="btn-texto" onClick={() => setOtros(true)}><Icono n="buscar" /> Ver otros de {NOMBRE_GRUPO[principal]?.toLowerCase()}</button>
      ) : biblioteca.cargando ? <Cargando /> : delGrupo.length > 0 && (
        <div class="pila-s">
          <span class="peq secundario">Otros ejercicios de {NOMBRE_GRUPO[principal]?.toLowerCase()} (coméntaselo a tu coach)</span>
          <div class="lista-elegir">{delGrupo.map((x) => <Opcion x={x} key={x.id} />)}</div>
        </div>
      )}
    </Hoja>
  );
}

// Una serie: kilos y repeticiones con lo propuesto como pista gris (lo pautado o lo de la vez anterior).
// Al marcarla con los campos vacíos se usa la pista, como en un cuaderno.
// anterior: el peso de esta serie la última vez, en un recuadro pequeño (solo si el coach no ha pautado carga)
function FilaSerie({ numero, hecha, propuesta, activa, siguiente = false, pendiente, guardar, quitar, nombre, barra, record, tipo = null, anterior = null }) {
  const { aviso } = useApp();
  const fmt = (v, d) => (v == null ? '' : num(v, d));
  const [kg, setKg] = useState(hecha ? fmt(hecha.kg, 2) : '');
  const [reps, setReps] = useState(hecha ? fmt(hecha.reps, 0) : '');
  const [rpe, setRpe] = useState(hecha?.rpe ?? '');
  useEffect(() => { if (hecha) { setKg(fmt(hecha.kg, 2)); setReps(fmt(hecha.reps, 0)); setRpe(hecha.rpe ?? ''); } }, [hecha?.id]);
  const valores = (k = kg, r = reps, e = rpe) => ({
    kg: aNumero(k) ?? propuesta.kg ?? null,
    reps: aNumero(r) ?? propuesta.reps ?? null,
    rpe: e === '' ? '' : Number(e),
  });
  // Si ya está hecha, cada cambio se guarda al momento
  const confirmar = (k, r, e) => {
    if (!hecha) return;
    const v = valores(k, r, e);
    const problema = problemaSerie(v);
    // Si lo escrito no vale, se avisa y se vuelve a lo guardado
    if (problema) { aviso(problema, 'error'); setKg(fmt(hecha.kg, 2)); setReps(fmt(hecha.reps, 0)); return; }
    guardar(v);
  };
  const [recien, setRecien] = useState(false);
  useEffect(() => { if (!recien) return undefined; const t = setTimeout(() => setRecien(false), 600); return () => clearTimeout(t); }, [recien]);
  const marcar = () => {
    if (hecha) { quitar(); return; }
    const v = valores();
    if (v.reps == null) return;
    const problema = problemaSerie(v);
    if (problema) { aviso(problema, 'error'); return; }
    setKg(fmt(v.kg, 2)); setReps(fmt(v.reps, 0));
    setRecien(true);
    guardar(v);
  };
  return (
    <>
      <div class={`serie ${hecha ? 'hecha' : ''} ${activa ? 'activa' : ''} ${siguiente && !hecha ? 'siguiente' : ''} ${recien ? 'recien' : ''} ${record && recien ? 'con-record' : ''} ${tipo ? `serie-${tipo}` : ''}`} role="group" aria-current={siguiente && !hecha ? 'step' : undefined}
        aria-label={`${nombre}, serie ${numero}${tipo === 'top' ? ' (top)' : tipo === 'backoff' ? ' (back-off)' : ''}`}>
        <span class="n" title={tipo === 'top' ? 'Serie top' : tipo === 'backoff' ? 'Back-off' : undefined}>{tipo === 'top' ? 'T' : tipo === 'backoff' ? 'B' : numero}</span>
        <span class="celda-kg">
          <input class="celda" inputMode="decimal" enterKeyHint="next" aria-label={`Kilos de la serie ${numero}${anterior != null ? ` (la última vez, ${num(anterior, 2)} kg)` : ''}`} value={kg}
            placeholder={fmt(propuesta.kg, 2) || '–'} onInput={(e) => setKg(e.currentTarget.value)}
            onChange={(e) => confirmar(e.currentTarget.value, reps, rpe)} onFocus={(e) => e.currentTarget.select()} />
          {anterior != null && <span class="peso-anterior" aria-hidden="true" title="Tu peso de la última vez en esta serie"><small>ant.</small> {num(anterior, 2)}</span>}
        </span>
        <input class="celda" inputMode="numeric" enterKeyHint="done" aria-label={`Repeticiones de la serie ${numero}`} value={reps}
          placeholder={fmt(propuesta.reps, 0) || '–'} onInput={(e) => setReps(e.currentTarget.value)}
          onChange={(e) => confirmar(kg, e.currentTarget.value, rpe)} onFocus={(e) => e.currentTarget.select()} />
        <select class={`rpe ${propuesta.rpe != null && rpe === '' ? 'rpe-objetivo' : ''}`} aria-label={`RPE de la serie ${numero}${propuesta.rpe != null ? ` (objetivo ${num(propuesta.rpe)})` : ''}`} value={rpe} onChange={(e) => {
          const v = e.currentTarget.value === '' ? '' : Number(e.currentTarget.value);
          setRpe(v); confirmar(kg, reps, v);
        }}>
          {RPES.map((r) => <option key={r} value={r}>{r === '' ? (propuesta.rpe != null ? `→ ${num(propuesta.rpe)}` : 'RPE') : num(r)}</option>)}
        </select>
        <button class="hecho-btn" onClick={marcar} aria-pressed={hecha ? 'true' : 'false'}
          aria-label={hecha ? `Quitar la serie ${numero}` : `Marcar la serie ${numero} como hecha`}>
          <Icono n="hecho" />
        </button>
      </div>
      {record && <div class="record-serie"><Icono n="trofeo" /><span><strong>Récord</strong>: {record.texto}</span></div>}
      {activa && barra && !hecha && <div class="serie-discos"><Placas kg={aNumero(kg) ?? propuesta.kg} /></div>}
      {pendiente && hecha && <div class="pendiente-envio">Serie {numero} guardada en el móvil; se enviará al volver la conexión.</div>}
    </>
  );
}

// La pauta de cardio del coach, en una tarjeta: qué toca, cuánto y a qué esfuerzo; y, hecha, lo que se hizo
export function TarjetaCardio({ pauta, hecho, completada }) {
  const h = cardioHechoValido(hecho) ? hecho : null;
  return (
    <div class="panel panel-pad tarjeta-cardio">
      <span class="ico" aria-hidden="true"><Icono n="intervalos" /></span>
      <div class="pila-s">
        <div>
          <div class="peq secundario">{NOMBRE_MODALIDAD[pauta.modalidad]}</div>
          <div class="cifra-cardio">
            {pauta.minutos ? <>{pauta.minutos}<small>min</small></> : null}
            {pauta.minutos && pauta.km ? <small> y </small> : null}
            {pauta.km ? <>{num(pauta.km, pauta.km % 1 ? 1 : 0)}<small>km</small></> : null}
          </div>
        </div>
        {pauta.esfuerzo && <p class="peq">Esfuerzo {num(pauta.esfuerzo)} de 10: {palabrasEsfuerzo(pauta.esfuerzo)}.</p>}
        {pauta.nota && <p class="peq secundario">{pauta.nota}</p>}
        {h ? <span class="chip ok"><Icono n="hecho" />Hecho: {NOMBRE_MODALIDAD[h.modalidad].toLowerCase()}, {textoCardioHecho(h)}</span>
          : !completada && <p class="mini terciario">Al terminar, apunta los minutos, los kilómetros y cuánto te ha costado.</p>}
      </div>
    </div>
  );
}

// ---------- terminar ----------
function Terminar({ sesion, semana, inicio, minutosSugeridos = null, conEjercicios = false, alCerrar, alGuardar }) {
  const { propio } = useApp();
  const estimado = minutosSugeridos || (inicio ? Math.max(5, Math.round((Date.now() - inicio) / 60000) + 5) : sesion.cardio?.minutos || (sesion.tipo !== 'fuerza' ? 40 : null));
  const hoy = hoyISO();
  // Si la sesión es de otra semana (se apunta una que se hizo otro día), se pregunta el día
  const deOtraSemana = !!semana?.fecha_inicio && semana.fecha_inicio !== lunesDe(hoy);
  // Por defecto: lo que ya tuviera; si es de una semana pasada, su domingo; si no, hoy
  const finSemana = semana?.fecha_inicio ? sumarDias(semana.fecha_inicio, 6) : hoy;
  const [fecha, setFecha] = useState(sesion.fecha_realizada || (deOtraSemana && finSemana < hoy ? finSemana : hoy));
  const [rpe, setRpe] = useState(sesion.rpe_sesion ?? null);
  const [min, setMin] = useState(sesion.duracion_min ?? estimado);
  const [nota, setNota] = useState(sesion.nota_atleta || '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  // Cardio: si la sesión lo lleva pautado (o es de cardio), se apunta modalidad y kilómetros; los minutos son los de la sesión
  const conCardio = cardioValido(sesion.cardio) || sesion.tipo === 'cardio';
  // En una sesión con ejercicios y cardio al final, los minutos de cardio van aparte de la duración de la sesión;
  // en una sesión solo de cardio, son los mismos
  const cardioAparte = conCardio && conEjercicios;
  const h0 = cardioHechoValido(sesion.cardio_hecho) ? sesion.cardio_hecho : null;
  const [modalidad, setModalidad] = useState(h0?.modalidad || sesion.cardio?.modalidad || 'carrera');
  // Si ya lo registró sin kilómetros, no se le vuelven a proponer los de la pauta
  const [km, setKm] = useState(h0 ? (h0.km ?? null) : (sesion.cardio?.km ?? null));
  const [minCardio, setMinCardio] = useState(h0?.minutos ?? sesion.cardio?.minutos ?? null);
  const guardarTodo = async () => {
    const cambios = { completada: true, fecha_realizada: fecha > hoy ? hoy : fecha, rpe_sesion: rpe, duracion_min: min, nota_atleta: nota.trim() || null };
    if (conCardio) {
      const minutos = cardioAparte ? minCardio : min;
      if (!minutos) throw new Error('Para el cardio hacen falta los minutos.');
      const hecho = limpiarCardioHecho({ modalidad, minutos, km });
      if (!hecho) throw new Error('Revisa los minutos y los kilómetros del cardio.');
      cambios.cardio_hecho = hecho;
    }
    await alGuardar(cambios);
  };
  return (
    <Hoja titulo={sesion.completada ? 'Valoración de la sesión' : 'Terminar sesión'} alCerrar={alCerrar}>
      {conCardio && (
        <div class="campo">
          <span class="etq">{cardioAparte ? 'Cardio al final' : 'Qué has hecho'}</span>
          <div class="fila-campos">
            <select class="selector" aria-label="Modalidad de cardio" value={modalidad} onChange={(e) => setModalidad(e.currentTarget.value)}>{MODALIDADES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            {cardioAparte ? <Paso id="t-min-cardio" valor={minCardio} paso={1} min={0} max={600} dec={0} etiqueta="minutos de cardio" alCambiar={setMinCardio} />
              : <Paso id="t-km" valor={km} paso={0.5} min={0} max={200} dec={1} etiqueta="kilómetros" alCambiar={setKm} />}
          </div>
          {cardioAparte && <div class="fila-campos"><span class="peq secundario" style="align-self:center">Kilómetros, si los sabes</span><Paso id="t-km" valor={km} paso={0.5} min={0} max={200} dec={1} etiqueta="kilómetros" alCambiar={setKm} /></div>}
          <span class="ayuda">{km && (cardioAparte ? minCardio : min) ? `Ritmo: ${ritmo(cardioAparte ? minCardio : min, km, modalidad)}` : cardioAparte ? 'Minutos de cardio aparte de la sesión; los kilómetros, si los sabes (si no, déjalos a 0).' : 'Kilómetros, si los sabes (si no, déjalo a 0).'}</span>
        </div>
      )}
      <div class="campo">
        <span class="etq" id="t-rpe">¿Cuánto te ha costado la sesión entera? (RPE)</span>
        <Segmentos etiqueta="RPE de la sesión" valor={rpe} alCambiar={setRpe} opciones={[5, 6, 7, 8, 9, 10].map((x) => [x, String(x)])} />
        <span class="escala-frase">{rpe == null ? 'Elige un valor del 5 (cómoda) al 10 (máxima).' : ['Cómoda', 'Moderada', 'Exigente', 'Dura', 'Muy dura', 'Máxima'][rpe - 5]}</span>
      </div>
      {(deOtraSemana || sesion.fecha_realizada) && (
        <div class="campo">
          <label for="t-fecha">Día en que la hiciste</label>
          <input id="t-fecha" type="date" class="entrada" value={fecha} max={hoy} onInput={(e) => setFecha(e.currentTarget.value || hoy)} />
        </div>
      )}
      <div class="campo">
        <label for="t-min">{conCardio && !cardioAparte ? 'Minutos de cardio' : 'Duración (minutos)'}</label>
        <Paso id="t-min" valor={min} paso={conCardio && !cardioAparte ? 1 : 5} max={conCardio && !cardioAparte ? 600 : 300} dec={0} etiqueta={conCardio && !cardioAparte ? 'minutos de cardio' : 'minutos de sesión'} alCambiar={setMin} />
      </div>
      <div class="campo">
        <label for="t-nota">{propio ? 'Nota' : 'Nota para tu coach'}</label>
        <textarea id="t-nota" class="area" placeholder="Cómo te has sentido, molestias, cambios que hayas hecho…" value={nota} onInput={(e) => setNota(e.currentTarget.value)} />
      </div>
      {error && <div class="error" role="alert">{error}</div>}
      <button class="btn btn-primario btn-grande" disabled={ocupado} onClick={async () => {
        setOcupado(true); setError(null);
        try { await guardarTodo(); }
        catch (e) { setError(e.message); setOcupado(false); }
      }}>{sesion.completada ? 'Guardar' : 'Guardar y terminar'}</button>
    </Hoja>
  );
}

async function calcularResumen(api, atletaId, ejercicios, hechas, cambios, enCola, ejerciciosPorId, records = {}, sesion = {}) {
  const series = ejercicios.flatMap((e) => Object.values(hechas[e.id] || {}).map((s) => ({
    ...s, ejercicio_id: s.sustituto_id || e.ejercicio_id,
    nombre: (s.sustituto_id && ejerciciosPorId[s.sustituto_id]?.nombre) || e.ejercicio.nombre,
  })));
  const tonelaje = series.reduce((t, s) => t + (Number(s.kg) || 0) * (Number(s.reps) || 0), 0);
  // Un récord por ejercicio: el de 1RM estimado si lo hay; si no, el primero
  const porEjercicio = {};
  for (const s of series) {
    const r = records[`${s.sesion_ejercicio_id}-${s.numero}`];
    if (!r) continue;
    const ya = porEjercicio[s.ejercicio_id];
    if (!ya || (r.tipo === 'e1rm' && (ya.r.tipo !== 'e1rm' || r.valor > ya.r.valor))) porEjercicio[s.ejercicio_id] = { nombre: s.nombre, s, r };
  }
  // Series por músculo de hoy (el principal cuenta 1 y los secundarios, media)
  const musculos = {};
  for (const s of series) {
    if (!(Number(s.reps) > 0)) continue;
    const grupos = ejerciciosPorId[s.ejercicio_id]?.grupos_musculares || ejercicios.find((e) => e.ejercicio_id === s.ejercicio_id)?.ejercicio.grupos_musculares || [];
    grupos.forEach((g, i) => { musculos[g] = (musculos[g] || 0) + (i === 0 ? 1 : 0.5); });
  }
  return {
    series: series.length, tonelaje, minutos: cambios.duracion_min, rpe: cambios.rpe_sesion, cardio: cambios.cardio_hecho || null, records: Object.values(porEjercicio), enCola, musculos,
    tarjeta: datosTarjeta({ ...sesion, ...cambios }, ejercicios, hechas, records, ejerciciosPorId, cambios.duracion_min),
  };
}

// Lo que va en la tarjeta para compartir: sin datos de salud (ni peso corporal ni esfuerzo)
function datosTarjeta(sesion, ejercicios, hechas, records, ejerciciosPorId, minutos) {
  const series = ejercicios.flatMap((e) => Object.values(hechas[e.id] || {}).map((s) => ({
    ...s, ejercicio_id: s.sustituto_id || e.ejercicio_id,
    nombre: (s.sustituto_id && ejerciciosPorId[s.sustituto_id]?.nombre) || e.ejercicio.nombre,
  })));
  const porEjercicio = new Map();
  for (const s of series) {
    const x = porEjercicio.get(s.ejercicio_id) || { ejercicio_id: s.ejercicio_id, nombre: s.nombre, mejor: null, record: null };
    const valor = e1rm({ ...s, rpe: s.rpe ?? null }) ?? (Number(s.reps) || 0);
    if (!x.mejor || valor > x.valor) { x.mejor = s; x.valor = valor; }
    const r = records[`${s.sesion_ejercicio_id}-${s.numero}`];
    if (r && (!x.record || (r.tipo === 'e1rm' && (x.record.tipo !== 'e1rm' || r.valor > x.record.valor)))) x.record = r;
    porEjercicio.set(s.ejercicio_id, x);
  }
  const lista = [...porEjercicio.values()];
  return {
    nombre: sesion.nombre,
    // v0.51: el tipo y el patrón principal, para el dibujo de las plantillas (el mismo de la portada)
    tipo: sesion.tipo || 'fuerza', patron: resumenPautas(ejercicios).patrones[0] || null,
    subtitulo: sesion.tipo && sesion.tipo !== 'fuerza' ? NOMBRE_TIPO_SESION[sesion.tipo] : NOMBRE_INTENCION[sesion.intencion] || null,
    fecha: sesion.fecha_realizada || hoyISO(),  // sesion ya trae los cambios encima
    series: series.length,
    tonelaje: series.reduce((t, s) => t + (Number(s.kg) || 0) * (Number(s.reps) || 0), 0),
    minutos,
    records: lista.filter((x) => x.record).map((x) => ({ nombre: x.nombre, texto: x.record.texto })),
    mejores: lista.map((x) => ({ ejercicio_id: x.ejercicio_id, nombre: x.nombre, serie: textoSerie({ ...x.mejor, rpe: null }), kg: Number(x.mejor.kg) > 0 ? Number(x.mejor.kg) : null, reps: x.mejor.reps ?? null, e1rm: e1rm({ ...x.mejor, rpe: x.mejor.rpe ?? null }) })),
  };
}

function Resumen({ resumen, sesion, alCerrar }) {
  const { api, atleta, propio } = useApp();
  const [compartir, setCompartir] = useState(false);
  // v0.43: «Compartir con el equipo», si la comunidad está abierta y está dentro (y la sesión no está ya compartida)
  const [equipo, setEquipo] = useState(false);
  const [compartida, setCompartida] = useState(false);
  const equipoPosible = !propio && atleta?.estado !== 'baja' && resumen.series > 0 && !!resumen.tarjeta && !resumen.enCola && !!sesion?.id;
  const estadoEquipo = useCarga(async () => {
    if (!equipoPosible) return false;
    const [c, m] = await Promise.all([api.comunidad(), api.miembroComunidad()]);
    return c.activa && !!m && !m.salido_en && !(await api.sesionCompartida(sesion.id));
  }, [sesion?.id]);
  // v0.49: comparado con la última vez que hizo esta misma sesión (sale de sus entrenamientos; sin conexión, no sale)
  const cardio = cardioHechoValido(resumen.cardio);
  // (solo las de ese nombre, las más recientes: no hace falta el historial entero)
  const anteriores = useCarga(() => (cardio || !resumen.series || resumen.enCola ? Promise.resolve([]) : api.sesionesHechas(atleta.id, { nombre: sesion.nombre, limite: 4 }).catch(() => [])), [sesion?.id]);
  const comparacion = anteriores.datos ? compararConAnterior({ id: sesion.id, nombre: sesion.nombre, fecha: resumen.tarjeta?.fecha, tonelaje: resumen.tonelaje, series: resumen.series, minutos: resumen.minutos }, anteriores.datos) : null;
  const cifras = cardio ? [
    { k: 'minutos', v: resumen.cardio.minutos, u: 'min', t: NOMBRE_MODALIDAD[resumen.cardio.modalidad] },
    resumen.cardio.km && { k: 'km', v: num(resumen.cardio.km, 1), u: 'km', t: 'Distancia' },
    resumen.cardio.km && { k: 'ritmo', v: ritmo(resumen.cardio.minutos, resumen.cardio.km, resumen.cardio.modalidad).split(' ')[0], u: ritmo(resumen.cardio.minutos, resumen.cardio.km, resumen.cardio.modalidad).split(' ')[1], t: 'Ritmo' },
  ] : [
    { k: 'minutos', v: resumen.minutos ?? '—', u: resumen.minutos != null ? 'min' : '', t: 'Duración' },
    { k: 'series', v: resumen.series, u: '', t: resumen.series === 1 ? 'Serie' : 'Series' },
    { k: 'tonelaje', v: num(Math.round(resumen.tonelaje / 10) / 100, 1), u: 't', t: 'Tonelaje' },
  ];
  const nRecords = resumen.records.length;
  return (
    <div class="contenido resumen-sesion">
      <section class="resumen-hero" aria-labelledby="resumen-titulo" style={{ '--i': 0 }}>
        <span class="resumen-medalla" aria-hidden="true"><Icono n={nRecords ? 'trofeo' : 'hecho'} /></span>
        <div class="pila-xs">
          <h1 id="resumen-titulo">Sesión terminada</h1>
          <p class="resumen-sub">{sesion.nombre}{resumen.tarjeta?.fecha ? ` · ${fmtCorta(resumen.tarjeta.fecha)}` : ''}</p>
        </div>
        {nRecords > 0 && <span class="resumen-pr num" style={{ '--i': 1 }}><Icono n="trofeo" />{nRecords === 1 ? '1 récord' : `${nRecords} récords`}</span>}
      </section>
      <dl class="resumen-num">
        {cifras.filter(Boolean).map((c, i) => (
          <div key={c.k} data-k={c.k} style={{ '--i': i + 2 }}>
            <dt>{c.t}</dt>
            <dd><span class="v num">{c.v}</span>{c.u && <span class="u">{c.u}</span>}</dd>
          </div>
        ))}
      </dl>
      {!cardio && resumen.series > 0 && !resumen.enCola && (
        <p class={`resumen-compara ${!comparacion ? 'vacia' : comparacion.tonelaje > 0 ? 'sube' : comparacion.tonelaje < 0 ? 'baja' : ''}`} style={{ '--i': 5 }} aria-live="polite">
          {anteriores.cargando && !anteriores.datos ? <span class="sil" style="width:70%;height:14px" />
            : comparacion ? <><Icono n={comparacion.tonelaje >= 0 ? 'arriba' : 'abajo'} /><span><strong class="num">{textoComparacion(comparacion)}</strong>{comparacion.fecha ? <span class="secundario"> ({fmtCorta(comparacion.fecha)}{comparacion.series ? `, ${comparacion.series > 0 ? '+' : ''}${comparacion.series} ${Math.abs(comparacion.series) === 1 ? 'serie' : 'series'}` : ''})</span> : null}</span></>
              : <><Icono n="estrella" /><span>La primera vez que haces esta sesión: la próxima te dirá cómo vas.</span></>}
        </p>
      )}
      {nRecords > 0 && (
        <section class="seccion resumen-records" style={{ '--i': 6 }}>
          <h2>{nRecords === 1 ? 'Récord de hoy' : `${nRecords} récords hoy`}</h2>
          <div class="panel">
            <ul class="lista">
              {resumen.records.map((x) => (
                <li class="record" key={x.nombre}>
                  <span class="ico"><Icono n="trofeo" /></span>
                  <span><strong>{x.nombre}</strong><br /><span class="peq secundario">{x.r.texto}</span></span>
                  <span class="num peq">{textoSerie(x.s)}</span>
                </li>
              ))}
            </ul>
          </div>
          <p class="peq secundario">1RM estimado con la fórmula de Epley, contando las repeticiones que te quedaban en recámara.</p>
        </section>
      )}
      {Object.keys(resumen.musculos || {}).length > 0 && (
        <section class="seccion" style={{ '--i': 7 }}>
          <h2>Músculos de hoy</h2>
          <div class="panel panel-pad"><MapaMuscular series={resumen.musculos} etiqueta="Series por músculo de hoy" /></div>
        </section>
      )}
      {resumen.enCola && <div class="banda-conexion"><Icono n="sinred" />Guardado en el móvil. Se enviará a tu coach cuando vuelva la conexión.</div>}
      <div class="resumen-acciones pila" style={{ '--i': 8 }}>
        {resumen.series > 0 && resumen.tarjeta && <button class="btn btn-grande" onClick={() => setCompartir(true)}><Icono n="compartir" /> Compartir la sesión</button>}
        {compartida ? <p class="nota peq compartida-equipo"><Icono n="hecho" /> Compartida con el equipo</p>
          : estadoEquipo.datos === true && <button class="btn btn-grande" onClick={() => setEquipo(true)}><Icono n="equipo" /> Compartir con el equipo</button>}
        <button class="btn btn-primario btn-grande" onClick={alCerrar}>Volver a hoy</button>
      </div>
      {compartir && <HojaCompartir plantillas datos={resumen.tarjeta} alCerrar={() => setCompartir(false)} />}
      {equipo && (
        <HojaCompartirEquipo alCerrar={() => setEquipo(false)} alCompartir={() => { setEquipo(false); setCompartida(true); }}
          datos={{ sesionId: sesion.id, nombre: resumen.tarjeta.nombre, fecha: resumen.tarjeta.fecha, minutos: resumen.minutos ?? resumen.tarjeta.minutos, series: resumen.series,
            mejores: resumen.tarjeta.mejores }} />
      )}
    </div>
  );
}
