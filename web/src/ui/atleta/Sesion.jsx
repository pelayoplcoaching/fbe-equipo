import { leerTravesia } from '../travesia.js';
import { textoDistancia } from '../../logica/travesia.js';
import { Fragment } from 'preact';
import { GuiaSugerida } from '../Guias.jsx';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Siluetas, useApp, useCarga, Icono, Disco, Cargando, ErrorCaja, Hoja, Paso, Segmentos, usePreferencia, Pista, CifraSube, Odometro } from '../comunes.jsx';
import { BandaConexion } from '../App.jsx';
import { Hilo } from '../Hilo.jsx';
import { SubirArchivo } from '../Archivos.jsx';
import { RecuerdaEjercicio } from '../tecnica/Recordatorios.jsx';
import { BotonModelo } from '../tecnica/Modelos.jsx';
import { recordatoriosPorEjercicio } from '../../logica/correccion.js';
import { textoSerieVideo } from '../../logica/tecnica.js';
import { EVENTO_PENDIENTES, listarPendientes } from '../../datos/pendientes.js';
import { Calculadora, Aproximacion, HistorialEjercicio, Placas } from '../Herramientas.jsx';
import { HojaCompartir, dibujarTarjeta } from '../Compartir.jsx';
import { datosRecordDeSesion, PREF_RECORDATORIO } from '../../logica/compartir.js';
import { guardarPreferencia } from '../preferencias.js';
import { leerAutoCompartir } from '../comunidad-local.js';
import { perezoso } from '../perezoso.jsx';
import { PictoEjercicio } from '../Pictograma.jsx';
import { prepararAudio, celebrar, sonarSerie, sonarFinSesion, usePantallaEncendida, useAhora, problemaSerie, Temporizador, prepararEjercicio, NotaFijada } from './sesion-comun.jsx';
import { FilaSerie } from './FilaSerie.jsx';
import { useTecladoApp } from './Teclado.jsx';
import { pasoPeso, tipoCarga, pideRpe, discoMinimoValido, DISCO_MINIMO_DEFECTO, discosCon } from '../../logica/teclado.js';
import { enLibras, vista, deVista, pesoTxt } from '../../logica/unidades.js';
import { textoAjuste } from '../../logica/ajuste-vivo.js';
import { propagarCambio, aplicarPropagacion, deshacerPropagacion, textoPropagacion } from '../../logica/propagar.js';
import { ahoraToca, serieQueToca } from '../../logica/ahora-toca.js';
import { leerExtras, guardarExtras, borrarExtras, conExtras, filasHechas } from '../../logica/series-extra.js';
import { duracionDesdeSeries, fraseRpe, textoCierreAuto } from '../../logica/cierre.js';
import { Dictar } from '../Dictar.jsx';
import { aplicarOrden, moverAlFinal, moverBloque, reordenarPendientes, puedeDejarLuego, bloquesPendientes, proximaTrasReordenar } from '../../logica/orden-sesion.js';
import { OrdenarSesion } from './OrdenarSesion.jsx';
import { Enfoque } from './Enfoque.jsx';
import { Metronomo } from './Metronomo.jsx';
import { Intervalos } from './Intervalos.jsx';
import { leerIntervalos, textoIntervalos } from '../../logica/intervalos.js';
import { tempoDe } from '../../logica/tempo.js';
import { MapaMuscular } from '../MapaMuscular.jsx';
import { Preparacion, ConsejoDia } from './Preparacion.jsx';
import { consejoPreparacion, subeCarga } from '../../logica/preparacion.js';
import { esBarra, pauta, textoSerie, num, mmss, e1rm, inicioDeTanda, gruposSuperserie, etiquetasSuperserie, descansoGrupo, trasSerie, recordsDeSesion, NOMBRE_PRIORIDAD, NOMBRE_INTENCION, NOMBRE_GRUPO, NOMBRE_TIPO_SESION,
  descansoEfectivo, resolverDescanso, textoDescanso, DESCANSOS_ATLETA } from '../../logica/calculos.js';
import { leerAjustes } from '../ajustes.js';
import { leerDescansos, guardarDescanso } from '../descansos.js';
import { fmtCorta, hoyISO, lunesDe, sumarDias } from '../../logica/fechas.js';
import { pesoAnterior } from '../../logica/nivel.js';
import { MODALIDADES, NOMBRE_MODALIDAD, cardioValido, cardioHechoValido, limpiarCardioHecho, textoCardio, textoCardioHecho, textoSaludCardio, cardioHechoPublico, palabrasEsfuerzo, ritmo } from '../../logica/cardio.js';
import { DetalleCarreraSesion, pautaDeCarrera, leerSemaforo, olvidarSemaforo } from './Carrera.jsx';
import { TiempoSesion } from './Tiempo.jsx';
import { deFuera } from '../../logica/tiempo.js';
import { SEMAFORO } from '../../logica/carrera.js';
import { DondeEntrenas } from './DondeEntrenas.jsx';
import { adaptarSesion, textoAdaptacion } from '../../logica/material.js';
import { fraseSerie } from '../../logica/voz.js';
import { hablar } from '../voz.js';
import { TextoConEnlaces } from '../Enlaces.jsx';
import { vibrar } from '../hapticos.js';
import { conTransicion } from '../transiciones.js';
import { seVe } from '../../logica/vistas.js';
import { guardarEnCurso, borrarEnCurso, cambiarDescansoEnCurso, leerEnCurso } from '../en-curso.js';
import { descansoGuardable } from '../../logica/actividad.js';
import { sincronizarPista, prepararPista, EVENTO_PISTA } from '../pista-descanso.js';
import { textoAviso, pausaVigente } from '../../logica/pista.js';
import { resumenSeries, compararConAnterior, textoComparacion, pautadasHechas, seriesPautadasHechas } from '../../logica/visual.js';
import { tramosSesion, prepDeHoy, conSeriesDeHoy } from '../../logica/tablero.js';
import { resumenPautas } from '../../logica/diseno.js';
import { EscenaFinal, hayEscenaFinal } from './EscenaFinal.jsx';
import { lanzarEscenaInicio } from './EscenaInicio.js';
import { Portada, ArteSesion } from './Portada.jsx';
import { LOBO } from '../marca-lobo.js';
import { familiaPortada, imagenPortada, selloSesion, imagenCelebracion, imagenEjercicio } from '../../logica/imagenes.js';
import { Imagen, hayImagen } from '../Imagen.jsx';
import { MensajeCoach, RecuerdoProgreso } from './Personal.jsx';
import { Cadencia, CancionRecord, BotonMusica } from './Musica.jsx';
import { AnadirASalud } from './Conexiones.jsx';
import { prepMarcadas, marcarPrepHoy, desmarcarPrepHoy } from './prep-hoy.js';
import { apuntarRecord } from '../Bienvenida.jsx';
import { sesionConCola, enColaDe } from '../../logica/sin-red.js';
import { VideoYoutube, MiniGlobal, abrirMini } from '../YouTube.jsx';
import { esYoutube, videoDe } from '../../logica/youtube.js';

// (pulido 2.10) «Compartir con el equipo», al terminar: es de la pantalla Equipo, que se carga cuando hace falta
const HojaCompartirEquipo = perezoso(() => import('../Comunidad.jsx'), 'HojaCompartirEquipo', { mientras: null });

export function Sesion({ id, alCerrar, alLeer, salud = false }) {
  const { api, atleta, cola, aviso, propio } = useApp();
  // (v0.65) sin cobertura, de la copia del móvil; y en los dos casos, con lo que espera en la cola encima (lo apuntado sin
  // conexión sigue ahí al volver a abrir la sesión, aunque se haya cerrado la app)
  const det = useCarga(() => api.sesion(id, atleta.id).then((d) => sesionConCola(d, cola.operaciones())), [id]);
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
  // v0.62: y la pista de «Avisar aunque bloquees el móvil», en el mismo toque (en el iPhone, el audio solo arranca ahí)
  const avisosPista = () => (api?.programarDescanso && typeof Notification !== 'undefined' && Notification.permission === 'granted'
    ? { programar: (f, t) => api.programarDescanso(f, t), cancelar: () => api.cancelarDescanso?.() } : null);
  const cambiarDescanso = (d) => { setDescanso(d); cambiarDescansoEnCurso(atleta.id, id, d); sincronizarPista(d, { atletaId: atleta.id, sesionId: id, avisos: avisosPista() }); };
  const cambiarRef = useRef(cambiarDescanso);
  cambiarRef.current = cambiarDescanso;
  useEffect(() => {
    prepararPista();
    // Lo que piden los botones de la pantalla de bloqueo (pausa, ±15 s, saltar), con la sesión abierta: como en la app
    const remoto = (e) => { e.preventDefault(); cambiarRef.current(e.detail); };
    window.addEventListener(EVENTO_PISTA, remoto);
    return () => window.removeEventListener(EVENTO_PISTA, remoto);
  }, []);
  // v0.52: lo que dice la píldora (se calcula al pintar, más abajo) y se guarda en el móvil tras cada pintado
  const enCurso = useRef(null);
  enCurso.current = null;
  // (hasta que las series de la sesión están en su sitio no se sabe si está a medias: no se borra nada antes)
  const seriesListas = useRef(false);
  useEffect(() => {
    if (!det.datos || !seriesListas.current) return;
    const x = enCurso.current;
    if (!x) { borrarEnCurso(atleta.id, id); return; }
    guardarEnCurso(atleta.id, { ...x, descanso: descansoGuardable(descanso) });
  });
  const [terminando, setTerminando] = useState(false);
  const [resumen, setResumen] = useState(null);
  // (diseño, tanda 43) la escena del final (la luna y el lobo): null | { records, semana, saliendo }. El resumen se monta
  // cuando la escena empieza a irse (o al momento, si no hay escena)
  const [escena, setEscena] = useState(null);
  // (diseño, tanda 47) el ejercicio (o la superserie) que se acaba de completar: su tramo de la barra y su tarjeta lo
  // celebran un momento. Los tramos se calculan más abajo (tras los retornos tempranos): aquí llegan por una referencia.
  const tramosRef = useRef(null);
  const completosAntes = useRef(null);
  const [recienTramo, setRecienTramo] = useState(null);
  useEffect(() => {
    const ahora = (tramosRef.current || []).filter((t) => t.completo).map((t) => t.id);
    const antes = completosAntes.current;
    completosAntes.current = ahora;
    if (!antes || !tramosRef.current) return;
    const nuevo = ahora.find((x) => !antes.includes(x));
    if (nuevo != null) setRecienTramo(nuevo);
  });
  useEffect(() => { if (recienTramo == null) return undefined; const t = setTimeout(() => setRecienTramo(null), 1600); return () => clearTimeout(t); }, [recienTramo]);
  const [verDinamica, setVerDinamica] = useState(true);
  const [calculadora, setCalculadora] = useState(false); // false | true | { kg } (desde el teclado: los discos de esa carga)
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
  // v0.63: el teclado de la app (un ajuste del móvil) y el disco más pequeño de cada sitio (gimnasio, casa, viaje), en el móvil
  const tecladoApp = useTecladoApp();
  const [discosLugar, setDiscosLugar] = usePreferencia(`fbe-discos-${atleta.id}`, {});
  // v0.64 (4): el orden de los ejercicios de esta sesión, si el atleta lo ha cambiado («Máquina ocupada · hacerlo luego» o
  // «Cambiar el orden»): solo en este móvil y para esta sesión (la pauta del coach no cambia); null = el del coach
  const [ordenSes, setOrdenSes] = usePreferencia(`fbe-orden-${id}`, null);
  const [ordenando, setOrdenando] = useState(false);
  // Ejercicios elegidos fuera de las alternativas (de la biblioteca) y su «última vez»
  const [extra, setExtra] = useState({ ejercicios: {}, ultimas: {} });
  // Las series añadidas («Añadir serie») de cada ejercicio, guardadas en el móvil mientras dura la sesión (antes vivían en
  // la tarjeta y se perdían al plegarse o al recargar; y el descanso no las contaba)
  const [extras, setExtras] = useState(() => leerExtras(id));
  // (054) el esfuerzo de la sesión dicho en un toque al acabar la última serie (antes de «Terminar»): se guarda ya
  const [rpeRapido, setRpeRapido] = useState(null);
  const cambiarExtra = (seId, n) => setExtras((x) => guardarExtras(id, { ...x, [seId]: n }));
  // Notas fijadas del atleta por ejercicio (se cargan con la sesión y se guardan al momento)
  const [notas, setNotas] = useState({});
  // v0.52.2: el descanso que eligió para cada ejercicio (ejercicio_id → segundos), en este móvil
  const [descansosPropios, setDescansosPropios] = useState(() => leerDescansos(atleta.id));
  // (revisión L3) el último aviso del cambio que pasa a las siguientes series: { texto, fn, t }
  const cambioReciente = useRef(null);
  usePantallaEncendida();
  // v0.49: al completar las series pautadas de un ejercicio, su tarjeta se pliega un momento después. El temporizador
  // de cada uno se guarda para cancelarlo (si se desmarca, si falla el guardado o al salir) y, al cumplirse, se
  // vuelve a mirar con lo que hay entonces.
  const hechasRef = useRef({});
  hechasRef.current = hechas;
  // (v0.64, revisión) el descanso de ahora, para «Deshacer» del orden: no se vuelve al de cuando se tocó «Máquina ocupada»
  const descansoRef = useRef(null);
  descansoRef.current = descanso;
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
  // v0.59 (037): los recordatorios de técnica de tu coach («Recuerda: …») y sus vídeos modelo, por ejercicio
  const idsEjSesion = [...new Set((det.datos?.ejercicios || []).map((e) => e.ejercicio?.id).concat(Object.values(sustitutos || {})).filter(Boolean))];
  const tecnica037 = useCarga(async () => {
    if (!idsEjSesion.length || propio) return { recs: {}, modelos: {} };
    const [recs, mods] = await Promise.all([api.recordatoriosActivos(atleta.id).catch(() => []), api.videosModelo(idsEjSesion).catch(() => [])]);
    const modelos = {};
    for (const m of mods) (modelos[m.ejercicio_id] ||= []).push(m);
    return { recs: recordatoriosPorEjercicio(recs), modelos };
  }, [id, idsEjSesion.join(',')]);
  // «¿Cómo llegas hoy?»: lo contestado (se guarda en la sesión), si se saltó y si se está cambiando
  const [prep, setPrep] = useState(undefined);
  // v0.51: «Ahora no» vale para ese día (se guarda la fecha de Madrid; lo de antes, «true», ya no cuenta)
  const [prepSaltadaDia, setPrepSaltadaDia] = usePreferencia(`fbe-prep-saltada-${id}`, false);
  const prepSaltada = prepSaltadaDia === hoyISO();  // (v0.143) el día del móvil, como la sesión
  const setPrepSaltada = (v) => setPrepSaltadaDia(v ? hoyISO() : false);
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
    setEnCola(enColaDe(det.datos, cola.operaciones()));
    seriesListas.current = true;
    // Si ya hay series hechas con una alternativa, esa es la que se está usando
    const desdeSeries = {};
    for (const e of det.datos.ejercicios) {
      const ultima = [...e.hechas].reverse().find((s) => s.sustituto_id);
      if (ultima && !(e.id in sustitutos)) desdeSeries[e.id] = ultima.sustituto_id;
    }
    if (Object.keys(desdeSeries).length) setSustitutos({ ...sustitutos, ...desdeSeries });
    // v0.52: al volver a la sesión con un descanso en marcha (lo llevaba la píldora de arriba), sigue donde iba (v0.62: o en pausa, si se pausó hace menos de media hora)
    const ec = leerEnCurso(atleta.id);
    if (ec?.id === id && ec.descanso && ((!Number.isFinite(ec.descanso.pausa) && ec.descanso.fin > Date.now() - 6000) || pausaVigente(ec.descanso)) && !det.datos.sesion.completada && det.datos.ejercicios.some((x) => x.hechas.length)) setDescanso(ec.descanso);
    if (abiertos === null) {
      const lista = aplicarOrden(det.datos.ejercicios, ordenSes);
      const primero = lista.find((e) => e.hechas.length < e.series) || lista[0];
      setAbiertos(new Set(primero ? [primero.id] : []));
    }
  }, [det.datos]);

  if (det.cargando && !det.datos) return <div class="contenido"><Siluetas forma="sesion" texto="Cargando la sesión" /></div>;
  if (det.error) return <div class="contenido"><ErrorCaja error={det.error} reintentar={det.recargar} /><button class="btn" onClick={alCerrar}>Volver</button></div>;
  const { sesion, semana, progresionAuto } = det.datos;
  // v0.64 (4): todo lo de la sesión sale de esta lista, en el orden de hoy (la serie que toca, «Ahora toca», la píldora, la
  // pantalla de bloqueo, los tramos y el modo enfoque)
  const ejercicios = aplicarOrden(det.datos.ejercicios, ordenSes);
  const ejerciciosPorId = { ...det.datos.ejerciciosPorId, ...extra.ejercicios };
  const ultimas = { ...det.datos.ultimas, ...extra.ultimas };
  if (resumen) return <>{escena && <EscenaFinal key="escena" nombre={sesion?.nombre} records={escena.records} semana={escena.semana} alSalir={() => setEscena((x) => x && { ...x, saliendo: true })} alAcabar={() => setEscena(null)} />}{(!escena || escena.saliendo) && <Resumen key="resumen" resumen={resumen} sesion={sesion} familia={familiaPortada({ tipo: sesion?.tipo || 'fuerza', pautas: ejercicios, cardio: !!cardioHechoValido(resumen.cardio) })} alCerrar={alCerrar} />}</>;


  const todas = Object.values(hechas).flatMap((m) => Object.values(m));
  // El cronómetro cuenta desde la primera serie de la tanda en curso (pasar la medianoche no lo reinicia;
  // retomar la sesión horas después, sí)
  const inicio = inicioDeTanda(todas);
  const totalPautadas = ejercicios.reduce((t, e) => t + e.series, 0);
  const actualDe = (e) => (sustitutos[e.id] && ejerciciosPorId[sustitutos[e.id]]) || e.ejercicio;
  // v0.52.2: el descanso que vale para cada pauta: el del coach; si no puso, el que eligió el atleta para el ejercicio
  // que está haciendo; si no, el de por defecto de este móvil (Perfil → Sonido y vibración)
  const descansoDefecto = leerAjustes().descansoDefecto;
  const infoDescanso = (x) => descansoEfectivo(x, { propio: descansosPropios[actualDe(x).id] ?? null, defecto: descansoDefecto });
  const descansoDe = resolverDescanso({ propios: descansosPropios, defecto: descansoDefecto, ejercicioDe: (x) => actualDe(x).id });
  function elegirDescanso(ej, seg) {
    setDescansosPropios(guardarDescanso(atleta.id, ej.id, seg));
    aviso(seg == null ? `${ej.nombre}: el descanso por defecto (${textoDescanso(descansoDefecto)})` : `Descanso de ${ej.nombre}: ${textoDescanso(seg)}`);
  }

  const etiquetas = etiquetasSuperserie(ejercicios);
  // La serie que toca ahora: la que dijo la última serie marcada (si sigue sin hacer) o la primera sin hacer
  // (v0.63: la misma regla en logica/ahora-toca.js, para la tarjeta «Ahora toca» del descanso)
  // (con las series añadidas sumadas: una añadida sin hacer también «toca»)
  const ejerciciosConExtras = conExtras(ejercicios, extras);
  const prox = serieQueToca(ejerciciosConExtras, hechas, proxima, { completada: sesion.completada });
  const grupos = gruposSuperserie(ejercicios);
  // v0.51: antes de empezar, la portada (no en las hechas, ni con series, ni de baja)
  if (!sesion.completada && !empezada && todas.length === 0 && atleta.estado !== 'baja') {
    return (
      <Portada sesion={sesion} semana={semana} ejercicios={ejercicios} etiquetas={etiquetas} alCerrar={alCerrar}
        alEmpezar={() => {
          // (diseño, tanda 45) la escena de empezar: la noche se abre desde el botón pulsado (si se empieza desde él)
          lanzarEscenaInicio(document.activeElement?.closest?.('.portada-empezar .btn') || document.querySelector('.portada-empezar .btn'));
          prepararAudio(); setRecienEmpezada(true); setEmpezada(true); window.scrollTo(0, 0);
          requestAnimationFrame(() => document.querySelector('.sesion-vista .cabecera h1')?.focus({ preventScroll: true }));
        }} />
    );
  }
  // v0.51: un tramo por ejercicio (o superserie) arriba; tocarlo lleva a ese ejercicio
  const tramos = !sesion.completada && ejercicios.length > 0 ? tramosSesion(ejercicios, hechas, prox?.id || null) : [];
  tramosRef.current = tramos;
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
  // La propuesta de una serie (kilos y repeticiones que te propone la app), la misma para la píldora «Sesión en curso», la
  // pantalla de bloqueo (al marcar, en guardar) y la tarjeta «Ahora toca» del descanso
  const ultimasDe = (x) => { const a = actualDe(x); return a.id !== x.ejercicio.id ? ultimas[a.id] || null : x.ultimas; };
  const propuestaDe = (pe, numero, h = hechas[pe.id] || {}) => {
    const a = actualDe(pe), cambiado = a.id !== pe.ejercicio.id;
    return prepararEjercicio(pe, cambiado ? a : null, ultimasDe(pe), semana?.foco, progresionAuto && !cambiado && !frenar).propuesta(numero, h);
  };
  // v0.52: lo que dirá la píldora «Sesión en curso» si sale de la sesión: el ejercicio y la serie que tocan
  if (!sesion.completada && todas.length > 0 && atleta.estado !== 'baja') {
    const pe = prox && pautaDe[prox.id];
    let siguienteTxt = null;
    if (pe) {
      siguienteTxt = `Serie ${prox.numero} de ${pe.series}`;
      try {
        const prop = propuestaDe(pe, prox.numero);
        if (prop?.kg) siguienteTxt += `: ${pesoTxt(prop.kg, 2)} × ${prop.reps}`;
        else if (prop?.reps) siguienteTxt += `: ${prop.reps} repeticiones`;
      } catch { /* sin propuesta: la serie */ }
    }
    enCurso.current = { id, nombre: sesion.nombre, ejercicio: pe ? actualDe(pe).nombre : null, siguiente: siguienteTxt, hechas: todas.length, total: totalPautadas };
  }
  // v0.63 (8): «Ahora toca» en el descanso: la serie que toca (la de la píldora), con su propuesta, la última vez, el
  // recordatorio o la nota de tu coach y los discos por lado
  const ahora = descanso && !sesion.completada ? ahoraToca({
    ejercicios: ejerciciosConExtras, hechas, proxima, completada: sesion.completada, tras: descanso.tras, etiquetas,
    propuestaDe: (pe, k) => propuestaDe(pe, k), nombreDe: (x) => actualDe(x).nombre, ultimasDe,
    recordatoriosDe: (x) => tecnica037.datos?.recs?.[actualDe(x).id] || [], barraDe: (x) => esBarra(actualDe(x).nombre),
  }) : null;
  // v0.63: el disco más pequeño de donde entrena hoy y lo que el teclado necesita de la sesión
  const discoMinimo = discoMinimoValido(discosLugar?.[lugar]) ? Number(discosLugar[lugar]) : DISCO_MINIMO_DEFECTO;
  const teclado = { app: tecladoApp, discoMinimo, lugar,
    alDisco: (d) => { setDiscosLugar({ ...(discosLugar || {}), [lugar]: d }); aviso(`Disco más pequeño ${lugar === 'casa' ? 'en casa' : lugar === 'viaje' ? 'de viaje' : 'en el gimnasio'}: ${num(d, 2)} kg`); },
    alCalculadora: (kg) => setCalculadora({ kg }) };
  // Tocar «Ahora toca»: a esa serie, con el teclado en los kilos (o, con el del móvil, el campo enfocado)
  function irASerie(seId, numero) {
    // (revisión L4) con el teclado del móvil, el campo se enfoca en el mismo toque (en el iPhone, si no, no sale el teclado)
    const yaFila = document.querySelector(`[data-se="${seId}"] .serie[data-n="${numero}"]`);
    if (yaFila && !tecladoApp) {
      const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      yaFila.querySelector('input.celda')?.focus({ preventScroll: true });
      yaFila.scrollIntoView({ block: 'center', behavior: quieto ? 'auto' : 'smooth' });
      return;
    }
    setAbiertos((a) => new Set([...(a || []), seId]));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const fila = document.querySelector(`[data-se="${seId}"] .serie[data-n="${numero}"]`);
      if (!fila) { irAEjercicio(seId); return; }
      const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (!tecladoApp) fila.scrollIntoView({ block: 'center', behavior: quieto ? 'auto' : 'smooth' });
      fila.querySelector('input.celda')?.focus({ preventScroll: true });
    }));
  }
  const preguntarPrep = salud && ejercicios.length > 0 && !sesion.completada && atleta.estado !== 'baja'
    && ((!prep && !prepSaltada && todas.length === 0) || editandoPrep);
  // El modo enfoque espera a que conteste (o salte) cómo llega
  const verEnfoque = enfoque && ejercicios.length > 0 && !sesion.completada && !terminando && !preguntarPrep && (empezada || todas.length > 0);
  // Abrir el modo enfoque a mano cuenta como «ahora no» a la pregunta de cómo llega
  const abrirEnfoque = () => { prepararAudio(); setSeFoco(null); setEnfoque(true); if (preguntarPrep) { setPrepSaltada(true); setEditandoPrep(false); quitarPrepAntigua(); } };

  // (revisión L3) el aviso de la serie (récord, «sin descanso») junta el del cambio que pasa a las siguientes si acaba de
  // salir en el mismo toque (solo se ve un aviso a la vez): así «Deshacer» sigue a mano y el récord se ve
  const avisarCambio = (texto, fn) => { cambioReciente.current = { texto, fn, t: Date.now() }; aviso(texto, 'ok', { texto: 'Deshacer', fn }); };
  const avisoConCambio = (texto, tipo = 'ok') => {
    const c = cambioReciente.current;
    cambioReciente.current = null;
    if (c && Date.now() - c.t < 2000) aviso(`${texto} · ${c.texto}`, tipo, { texto: 'Deshacer', fn: c.fn });
    else aviso(texto, tipo);
  };
  async function guardar(e, numero, valoresVista) {
    // v0.112: lo de la fila y del modo enfoque llega en la unidad de la app (en libras, si las tiene puestas); la base, en kilos
    const valores = enLibras() && valoresVista.kg != null && valoresVista.kg !== '' ? { ...valoresVista, kg: deVista(valoresVista.kg) } : valoresVista;
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
    if (!previa) { vibrar('serie'); sonarSerie(); }   // (pulido 7: y un tic suave)
    if (!previa) quitarPrepAntigua();
    // v0.49: al completar las series pautadas (las de «Añadir serie» no cuentan), la tarjeta se pliega en una línea
    // un momento después, para ver el check
    // (y con una serie añadida sin hacer, tampoco: se pliega cuando están todas las filas)
    if (!previa && !filasHechas(e, extras[e.id], hechas[e.id]) && filasHechas(e, extras[e.id], { ...hechas[e.id], [numero]: local })) {
      cancelarPlegado(e.id);
      plegar.current[e.id] = setTimeout(() => { delete plegar.current[e.id]; plegarTarjeta(e); }, 700);
    }
    if (!previa && previas.datos) {
      const r = recordsDeSesion(enOrden({ ...hechas, [e.id]: { ...hechas[e.id], [numero]: local } }), previas.datos, claveSerie)[`${e.id}-${numero}`];
      if (r) { celebrar(); avisoConCambio(`¡Récord en ${actualDe(e).nombre}!`, 'record'); if (!propio) apuntarRecord(atleta.id, actualDe(e).nombre); }
    }
    if (!previa) {
      // Qué toca ahora: en una superserie se pasa al siguiente ejercicio de la ronda sin descanso
      const cuenta = Object.fromEntries(ejercicios.map((x) => [x.id, Object.keys(hechas[x.id] || {}).length]));
      cuenta[e.id] += 1;
      const r = trasSerie(ejercicios, cuenta, e.id, descansoDe);
      // La serie que toca, contando las pautadas y las añadidas (una serie guardada más allá no adelanta al ejercicio
      // siguiente; una añadida sin hacer, tampoco: «Después: serie 5 de press militar»)
      const lista = ejerciciosConExtras;
      const cuentaP = Object.fromEntries(lista.map((x) => [x.id, seriesPautadasHechas(x, x.id === e.id ? { ...hechas[e.id], [numero]: local } : hechas[x.id])]));
      const rP = trasSerie(lista, cuentaP, e.id, descansoDe);
      setProxima(rP.siguiente ? { id: rP.siguiente.id, numero: rP.siguiente.numero } : null);
      // (revisión L1) la siguiente, con la misma regla que la sesión, la píldora y «Ahora toca» (serieQueToca, con lo hecho ya
      // contando esta): así la pantalla de bloqueo, el aviso al móvil y la voz dicen la misma serie que la tarjeta (antes, al
      // saltarse una, contaban las hechas y decían otra). El descanso y la ronda, como siempre (trasSerie)
      const hechasTras = { ...hechas, [e.id]: { ...hechas[e.id], [numero]: local } };
      const { sig, texto, voz, aviso: avisoMovil } = textosSiguiente(lista, hechasTras, rP.siguiente, e.id);
      // v0.50: el temporizador sale en la página, debajo de este ejercicio (o de su superserie)
      if (r.descanso) cambiarDescanso({ fin: Date.now() + r.descanso * 1000, total: r.descanso, prioridad: e.prioridad, texto, voz, aviso: avisoMovil, tras: e.id, inicio: Date.now() });
      else if (r.enRonda) { cambiarDescanso(null); avisoConCambio(`Ahora ${nombreCon(sig)}, sin descanso`); hablar(`Sin descanso. ${voz}`); }
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

  // Lo que viene tras una serie (o tras reordenar en un descanso): la serie que toca y lo que dicen el temporizador
  // («Después: …»), la voz al acabar el descanso, el aviso al móvil y la pantalla de bloqueo. lista: los ejercicios en el orden
  // de ahora; sugerida: la que dijo trasSerie; tras: el ejercicio tras el que se descansa
  function textosSiguiente(lista, hechasTras, sugerida, tras) {
    const nx = serieQueToca(lista, hechasTras, sugerida);
    const sig = nx && lista.find((x) => x.id === nx.id);
    const texto = !sig ? 'terminar la sesión' : sig.id === tras || nx.numero > 1 ? `serie ${nx.numero} de ${nombreCon(sig)}` : nombreCon(sig);
    // v0.48: lo que dirá el entrenador por voz al acabar el descanso («Serie 3 de press banca: 80 kilos por 6»)
    let voz = '¡Sesión terminada! Buen trabajo.';
    // v0.62: el aviso al móvil y la pantalla de bloqueo, con la carga que le propone («serie 3 de press banca · 80 kg × 6»)
    let avisoMovil = texto;
    if (sig) {
      try {
        const a = actualDe(sig);
        const prop = propuestaDe(sig, nx.numero, hechasTras[sig.id] || {});
        voz = fraseSerie({ numero: nx.numero, series: sig.pautadas ?? sig.series, nombre: a.nombre, kg: prop?.kg, reps: prop?.reps });
        avisoMovil = textoAviso({ texto, kg: prop?.kg, reps: prop?.reps }) || texto;
      } catch { voz = `Ahora, ${texto}.`; }
    }
    return { nx, sig, texto, voz, aviso: avisoMovil };
  }

  // v0.64 (4): cambiar el orden de lo que queda (nunca la pauta del coach). La serie que había dicho la última marcada se
  // olvida si su ejercicio ya no es el primero de lo que queda; con un descanso en marcha, lo que dice que viene después (el
  // temporizador, la voz, el aviso al móvil y la pantalla de bloqueo) pasa a ser lo del orden nuevo
  function cambiarOrden(nuevoOrden, { texto = null, deshacer = true, foco = false } = {}) {
    const antes = { orden: ordenSes, proxima };
    const lista = aplicarOrden(det.datos.ejercicios, nuevoOrden);
    const prox2 = proximaTrasReordenar(lista, hechas, proxima);
    setOrdenSes(nuevoOrden);
    setProxima(prox2);
    if (descanso && !sesion.completada) {
      const t = textosSiguiente(lista, hechas, prox2, descanso.tras);
      cambiarDescanso({ ...descanso, texto: t.texto, voz: t.voz, aviso: t.aviso });
    }
    const nx = serieQueToca(conExtras(lista, extras), hechas, prox2);
    if (foco && nx) {
      // Se abre lo que toca ahora y se lleva la vista a él
      setAbiertos((a) => new Set([...(a || []), nx.id]));
      // (revisión) con un descanso en marcha, la vista va al temporizador (va con el ejercicio que se acaba de hacer, que puede
      // haber pasado al final): ahí está la cuenta atrás y «Ahora toca», que lleva a la serie siguiente con un toque
      const conDescanso = descansoRef.current && !sesion.completada;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const reloj = conDescanso && document.querySelector('.temporizador');
        if (reloj) reloj.scrollIntoView({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        else irAEjercicio(nx.id);
      }));
    }
    if (texto) {
      aviso(texto, 'ok', deshacer ? { texto: 'Deshacer', fn: () => {
        setOrdenSes(antes.orden); setProxima(antes.proxima);
        // (solo si hay un descanso en marcha ahora: uno saltado o terminado entretanto no vuelve, y uno nuevo se queda)
        const d = descansoRef.current;
        if (d && !sesion.completada) {
          const lista0 = aplicarOrden(det.datos.ejercicios, antes.orden);
          const t = textosSiguiente(lista0, hechasRef.current, antes.proxima, d.tras);
          cambiarDescanso({ ...d, texto: t.texto, voz: t.voz, aviso: t.aviso });
        }
      } } : undefined);
    }
  }
  // «Máquina ocupada · hacerlo luego»: el ejercicio (o su superserie) pasa detrás de lo que queda
  function dejarLuego(e) {
    const o = moverAlFinal(ejercicios, hechas, e.id);
    if (!o) return;
    const lista = aplicarOrden(det.datos.ejercicios, o);
    const nx = serieQueToca(conExtras(lista, extras), hechas, proximaTrasReordenar(lista, hechas, proxima));
    const sig = nx && lista.find((x) => x.id === nx.id);
    // La tarjeta que se deja para luego se cierra (si no tiene series): así lo siguiente queda a la vista
    if (!Object.keys(hechas[e.id] || {}).length) setAbiertos((a) => { const n = new Set(a || []); n.delete(e.id); return n; });
    cambiarOrden(o, { texto: `${actualDe(e).nombre}, para luego${sig ? `. Ahora: ${nombreCon(sig)}` : ''}`, foco: true });
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
    if (!filasHechas(e, extras[e.id], hechasRef.current[e.id])) return;
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
    <div class={`contenido sesion-vista ${recienEmpezada ? 'sesion-tras-portada' : ''} ${sesion.completada ? 'sesion-hecha' : ''}`} inert={verEnfoque ? '' : undefined} aria-hidden={verEnfoque ? 'true' : undefined}>
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
                    <a href={`#ej-${t.id}`} class={`${t.completo ? 'completo' : ''}${t.id === recienTramo ? ' recien' : ''}`} aria-current={t.actual ? 'step' : undefined}
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
      {/* (054) la sesión que se cerró sola: pedir cómo fue */}
      {(() => { const c = textoCierreAuto(sesion); return c && (
        <section class="panel panel-pad cierre-auto pila-xs" aria-label="Sesión cerrada por la app">
          <p class="peq"><strong>{c.titulo}</strong> · {c.texto}</p>
          <button type="button" class="btn btn-peq btn-primario" style="justify-self:start" onClick={() => setTerminando(true)}><Icono n="editar" /> {sesion.rpe_sesion == null ? 'Decir cómo fue' : 'Corregir o añadir una nota'}</button>
        </section>
      ); })()}
      {/* (YouTube) «sigue este vídeo»: el que pone el coach a la sesión (un calentamiento, movilidad, un cardio) */}
      {sesion.video_url && <VideoDeSesion sesion={sesion} />}
      {!sesion.completada && ejercicios.length > 0 && <Pista id="sesion" icono="hoy">Cada ejercicio trae lo que te toca (series, repeticiones y esfuerzo). Apunta los kilos y las repeticiones de cada serie y márcala como hecha: el descanso arranca solo. El esfuerzo (RPE) va del 6 al 10: 10 es que no podías hacer ni una más; 8, que te quedaban dos.</Pista>}
      <BandaConexion />

      {sesion.dinamica && (
        <div class="nota-coach con-lobo">
          <img class="nota-lobo" src={LOBO} alt="" width="24" height="24" aria-hidden="true" />
          <div>
            <button class="btn-texto" style="padding:0;min-height:0;color:var(--tinta);font-weight:700" onClick={() => setVerDinamica(!verDinamica)} aria-expanded={verDinamica}>Cómo es la sesión</button>
            {verDinamica && <p style="margin-top:4px;white-space:pre-line">{sesion.dinamica}</p>}
          </div>
        </div>
      )}

      {preguntarPrep ? <Preparacion inicial={prep} alGuardar={guardarPrep} alSaltar={editandoPrep ? () => setEditandoPrep(false) : () => { setPrepSaltada(true); quitarPrepAntigua(); }} />
        : consejo && !sesion.completada && <ConsejoDia consejo={consejo} eleccion={eleccionCarga} alElegir={(v) => { setEleccionCarga(v); aviso(v === 'subir' ? 'Hoy vas con la carga que toca' : 'Hoy vas con los pesos de la última vez'); }} alCambiar={() => setEditandoPrep(true)} alQuitar={async () => { await guardarPrep(null); setPrepSaltada(true); }} />}

      {/* (v0.129) la música de la portada, a mano durante la sesión */}
      {!sesion.completada && (
        <BotonMusica sesion={sesion} semana={semana} cardio={cardioValido(sesion.cardio) ? sesion.cardio : null}
          familia={familiaPortada({ tipo: sesion.tipo || 'fuerza', pautas: ejercicios, cardio: cardioValido(sesion.cardio) })} />
      )}
      {delCoach && !sesion.completada && (
        <button class="tarjeta-intervalos" onClick={() => setIntervalos({ inicial: delCoach })}>
          <Icono n="intervalos" />
          <span class="pila-xs"><strong>Intervalos de hoy</strong><span class="num">{textoIntervalos(delCoach)}</span></span>
          <span class="btn btn-peq btn-primario" aria-hidden="true">Abrir</span>
        </button>
      )}
      {cardioValido(sesion.cardio) && <TarjetaCardio pauta={sesion.cardio} hecho={sesion.cardio_hecho} completada={sesion.completada} sesionId={sesion.id} />}
      {!sesion.completada && ejercicios.length > 0 && atleta.estado !== 'baja' && (
        <DondeEntrenas atletaId={atleta.id} lugar={lugar} alElegir={elegirLugar}
          cambios={Object.fromEntries(Object.entries(porLugar).filter(([k, v]) => sustitutos[k] === v))} sinAlternativa={sinAlternativa} />
      )}
      {!ejercicios.length && !cardioValido(sesion.cardio) && (
        <div class="panel panel-pad pila-s">
          <strong>{sesion.tipo === 'cardio' ? 'Sesión de cardio' : sesion.tipo === 'movilidad' ? 'Sesión de movilidad' : 'Sesión sin ejercicios'}</strong>
          <p class="secundario peq">Haz lo que indica tu coach arriba. Al terminar, apunta cuánto ha durado y cuánto te ha costado.</p>
          {/* (filosofía) en una sesión de cardio, cómo se combina con la fuerza */}
          {sesion.tipo === 'cardio' && !delCoach && <GuiaSugerida ocasion="cardio" />}
          {!delCoach && !sesion.completada && <button class="btn btn-peq" style="justify-self:start" onClick={() => setIntervalos({ inicial: null })}><Icono n="intervalos" /> Temporizador de intervalos</button>}
        </div>
      )}

      {grupos.map((g) => {
        const tarjetas = g.items.map((e) => {
          const actual = actualDe(e);
          const cambiado = actual.id !== e.ejercicio.id;
          return (
            <Ejercicio key={e.id} recienHecho={!!recienTramo && tramos.some((t) => t.id === recienTramo && t.ids.includes(e.id))} e={e} actual={cambiado ? actual : null} ultimas={cambiado ? ultimas[actual.id] || null : e.ultimas}
              foco={semana?.foco} progresionAuto={progresionAuto && !cambiado && !frenar} etiqueta={etiquetas[e.id]} records={records}
              nota={notas[actual.id]} guardarNota={(t) => guardarNota(actual.id, t)}
              coach={det.datos.coach?.[actual.id] || null}
              recordatorios={tecnica037.datos?.recs?.[actual.id] || []} modelos={tecnica037.datos?.modelos?.[actual.id] || []}
              descanso={infoDescanso(e)} descansoPropio={descansosPropios[actual.id] ?? null} descansoDefecto={descansoDefecto} elegirDescanso={(seg) => elegirDescanso(actual, seg)}
              lugar={porLugar[e.id] && sustitutos[e.id] === porLugar[e.id] ? lugar : null} deshacerLugar={() => deshacerLugar(e.id)}
              sinMaterial={lugar !== 'gimnasio' && sinAlternativa.includes(e.id) && !cambiado ? lugar : null}
              videos={videos.enviados[e.id] || 0} videosPendientes={videos.pendientes[e.id] || 0} alSubirVideo={() => setRecontarVideos((n) => n + 1)}
              hechas={hechas[e.id] || {}} enCola={enCola} abierto={abiertos?.has(e.id)} siguiente={prox?.id === e.id ? prox.numero : null} teclado={teclado} avisarCambio={avisarCambio}
              extra={extras[e.id] || 0} setExtra={(n) => cambiarExtra(e.id, n)}
              luego={!sesion.completada && atleta.estado !== 'baja' && puedeDejarLuego(ejercicios, hechas, e.id) ? () => dejarLuego(e) : null}
              ordenar={!sesion.completada && atleta.estado !== 'baja' && bloquesPendientes(ejercicios, hechas).length > 1 ? () => setOrdenando(true) : null}
              alternar={() => alternar(e.id)} guardar={(n, v) => guardar(e, n, v)} quitar={(n) => quitar(e, n)}
              cambiar={(ej) => {
                setSustitutos({ ...sustitutos, [e.id]: ej.id === e.ejercicio.id ? null : ej.id });
                if (ej.id !== e.ejercicio.id && !ejerciciosPorId[ej.id]) cargarExtra([ej.id], [ej]);
              }} />
          );
        });
        const conReloj = descanso && !verEnfoque && g.items.some((e) => e.id === descanso.tras);
        const reloj = conReloj && <Temporizador key={`reloj-${descanso.tras}`} {...descanso} alCambiar={cambiarDescanso} toca={ahora} alToca={irASerie} discoMinimo={discoMinimo} sesionId={id} />;
        if (!g.letra) return reloj ? [...tarjetas, reloj] : tarjetas;
        const d = descansoGrupo(g, descansoDe);
        // (tuyo): si el de la ronda no es uno que puso el coach
        const dTuyo = d && !g.items.some((x) => { const i = infoDescanso(x); return i.origen === 'coach' && i.seg === d; });
        return [
          <section class="superserie" key={`ss-${g.items[0].id}`} aria-label={`Superserie ${g.letra}`}>
            <div class="superserie-cab">
              <span class="ss-letra" aria-hidden="true">{g.letra}</span>
              <span><strong>Superserie</strong>: alterna una serie de cada ejercicio{d ? ` y descansa ${mmss(d)}${dTuyo ? ' (tuyo)' : ''} al acabar la ronda` : ' y descansa al acabar la ronda'}.</span>
            </div>
            {tarjetas}
          </section>,
          reloj,
        ];
      })}
      {/* (un descanso sin su ejercicio en la lista, por si acaso: antes de terminar) */}
      {descanso && !verEnfoque && !ejercicios.some((e) => e.id === descanso.tras) && <Temporizador {...descanso} alCambiar={cambiarDescanso} toca={ahora} alToca={irASerie} discoMinimo={discoMinimo} sesionId={id} />}

      {/* (054) con todas las pautadas hechas, el esfuerzo de la sesión en un toque (y la duración sale sola de las series) */}
      {!sesion.completada && totalPautadas > 0 && todas.length >= totalPautadas && atleta.estado !== 'baja' && (
        <section class="panel panel-pad rpe-rapido pila-xs" aria-labelledby="rpe-rapido-t">
          <p id="rpe-rapido-t" class="peq"><strong>¿Cuánto te ha costado la sesión entera?</strong> {rpeRapido == null && sesion.rpe_sesion == null ? 'Un toque y listo; lo demás, en «Terminar».' : <>{fraseRpe(rpeRapido ?? sesion.rpe_sesion)} · guardado</>}</p>
          <Segmentos etiqueta="Esfuerzo de la sesión" valor={rpeRapido ?? sesion.rpe_sesion ?? null} alCambiar={(v) => { if (v == null) return; setRpeRapido(v); vibrar('serie'); cola.enviar({ tipo: 'sesion', datos: { id: sesion.id, cambios: { rpe_sesion: v } }, atletaId: atleta.id }).catch(() => {}); }}
            opciones={[5, 6, 7, 8, 9, 10].map((x) => [x, String(x)])} />
        </section>
      )}
      <button class={`btn btn-primario btn-grande btn-ancho btn-terminar${!sesion.completada && totalPautadas > 0 && todas.length >= totalPautadas ? ' lista' : ''}`} onClick={() => setTerminando(true)}>
        <Icono n="hecho" /> {sesion.completada ? 'Cambiar la valoración' : 'Terminar sesión'}
      </button>
      {sesion.completada && todas.length > 0 && (
        <button class="btn btn-ancho" onClick={() => setCompartir(true)}><Icono n="compartir" /> Compartir la sesión</button>
      )}

      {!propio && (
        <section class="seccion">
          <h2 class="h2-con-lobo"><img class="h2-lobo" src={LOBO} alt="" />Comentarios con tu coach</h2>
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
      {calculadora && <Calculadora inicial={calculadora.kg ? { kg: calculadora.kg, reps: 5, rpe: 8 } : ultimaHecha ? { kg: vista(Number(ultimaHecha.kg)) || (enLibras() ? 135 : 60), reps: ultimaHecha.reps || 5, rpe: ultimaHecha.rpe ? Math.round(ultimaHecha.rpe) : 8 } : {}}
        discos={discosCon(discoMinimo)} alCerrar={() => setCalculadora(false)} />}
      {ordenando && (
        <OrdenarSesion ejercicios={ejercicios} hechas={hechas} etiquetas={etiquetas} nombreDe={(x) => actualDe(x).nombre}
          alMover={(o) => cambiarOrden(o, { deshacer: false })}
          reordenar={(claves) => reordenarPendientes(ejercicios, hechas, claves)} subir={(seId, d) => moverBloque(ejercicios, hechas, seId, d)}
          alCerrar={() => setOrdenando(false)} />
      )}
      {terminando && (
        <Terminar sesion={rpeRapido != null && sesion.rpe_sesion == null ? { ...sesion, rpe_sesion: rpeRapido } : sesion} semana={semana} inicio={inicio} minutosSugeridos={minutosHechos} duracionSeries={duracionDesdeSeries(hechas)} conEjercicios={ejercicios.length > 0} salud={salud} alCerrar={() => { setTerminando(false); setMinutosHechos(null); }}
          alGuardar={async (cambios) => {
            const r = await cola.enviar({ tipo: 'sesion', datos: { id: sesion.id, cambios }, atletaId: atleta.id });
            setTerminando(false);
            cambiarDescanso(null);
            borrarExtras(sesion.id);
            // La sesión ya está guardada: si el resumen falla por lo que sea, se enseña uno mínimo (nunca se queda colgada)
            let res;
            // (diseño, tanda 43) la escena del final solo la primera vez que se termina (no al cambiar la valoración); y,
            // con conexión, se mira a la vez si con esta sesión se completa la semana (para que llegue la manada)
            const conEscena = !sesion.completada && hayEscenaFinal();
            // (v0.124) con un tope de 2,5 s: si la red se queda colgada justo después de guardar, la escena sale sin manada
            // y el resumen no espera
            const semanaHecha = conEscena && !r.enCola ? Promise.race([
              api.constancia(atleta.id).then((c) => (c?.actual?.completa && c.actual.hechas === c.actual.objetivo ? { hechas: c.actual.hechas } : null)),
              new Promise((ok) => setTimeout(() => ok(null), 2500)),
            ]).catch(() => null) : null;
            try { res = await calcularResumen(api, atleta.id, ejercicios, hechas, cambios, r.enCola, ejerciciosPorId, records, sesion); }
            catch (e) {
              console.error('No se pudo preparar el resumen', e);
              res = { series: Object.values(hechas).reduce((n, h) => n + Object.keys(h || {}).length, 0), tonelaje: 0, minutos: cambios.duracion_min, rpe: cambios.rpe_sesion, cardio: cardioHechoPublico(cambios.cardio_hecho), records: [], enCola: r.enCola, musculos: {}, tarjeta: null };
            }
            if (conEscena) setEscena({ records: res.records?.length || 0, semana: await semanaHecha });
            setResumen(res);
            sonarFinSesion();   // (pulido 7)
          }} />
      )}
    </div>
    {verEnfoque && (
        <Enfoque ejercicios={ejercicios} extras={extras} hechas={hechas} records={records} etiquetas={etiquetas} actualDe={actualDe}
          ultimasDe={(x) => { const a = actualDe(x); return a.id !== x.ejercicio.id ? ultimas[a.id] || null : x.ultimas; }}
          foco={semana?.foco} progresionAuto={progresionAuto && !frenar} notas={notas} guardarNota={guardarNota}
          guardar={guardar} quitar={quitar} descanso={descanso} setDescanso={cambiarDescanso} ahora={ahora} teclado={teclado} sesionId={id}
          seId={seActual} setSeId={setSeFoco} inicio={inicio} alTerminar={() => setTerminando(true)}
          alSalir={() => { setEnfoque(false); setAbiertos((a) => new Set([...(a || []), seActual])); llevarA(seActual); }} />
      )}
      {/* (YouTube) el vídeo de un ejercicio, en pequeño encima de todo, mientras se sigue apuntando y descansando */}
      <MiniGlobal />
    </>
  );
}

function Cronometro({ inicio, minutos, hechas, total }) {
  const ahora = useAhora(1000);
  return (
    <div class="crono" style="text-align:right">
      <div class={`num crono-reloj${minutos == null && inicio ? ' corre' : ''}`} style="font-size:1.0625rem">{minutos != null ? `${minutos} min` : inicio ? mmss((ahora - inicio) / 1000) : '0:00'}</div>
      <div class="sesion-cab-num"><Odometro texto={String(hechas)} />/{total} series</div>
    </div>
  );
}

// (diseño, tanda 47) La misma serie de la última vez (kilos en la unidad que se ve y repeticiones), para la pastilla
// «+2,5 kg que la última vez» de FilaSerie; null si ese día no hizo esa serie
function serieDeAntes(ultimas, numero) {
  const x = (ultimas?.series || []).find((q) => Number(q.numero) === numero);
  if (!x || x.reps == null) return null;
  // (sin kilos, con el peso del cuerpo: cuentan las repeticiones)
  const kg = Number(x.kg) > 0 ? Number(x.kg) : 0;
  return { kg: kg && enLibras() ? vista(kg) : kg, reps: Number(x.reps) };
}

function Ejercicio({ recienHecho = false, e, actual, ultimas, foco, progresionAuto, etiqueta, records = {}, hechas, enCola, abierto, siguiente = null, alternar, guardar, quitar, cambiar, nota, guardarNota, videos = 0, videosPendientes = 0, alSubirVideo, coach = null, lugar = null, deshacerLugar, sinMaterial = null, recordatorios = [], modelos = [],
  descanso = { seg: null, origen: null }, descansoPropio = null, descansoDefecto = null, elegirDescanso, teclado = null, avisarCambio = null,
  luego = null, ordenar = null, extra = 0, setExtra = () => {} }) {
  const { atleta, propio, aviso } = useApp();
  const [hoja, setHoja] = useState(null); // tecnica | cambiar | historial | aproximacion
  const [editandoNota, setEditandoNota] = useState(false);
  const pa = pauta(e);
  const n = Object.keys(hechas).length;
  // (las series añadidas las lleva la sesión, guardadas en el móvil: no se pierden al plegar la tarjeta ni al recargar)
  // Las series añadidas suman a las pautadas; marcar una añadida no abre otra fila vacía detrás
  const filas = Math.max(e.series + extra, ...Object.keys(hechas).map(Number), 0);
  // La última fila se puede quitar si es una añadida sin hacer (si está hecha, primero se desmarca)
  const quitable = filas > e.series && !hechas[filas] && !enCola[`${e.id}-${filas}`] ? filas : null;
  const activa = Array.from({ length: filas }, (_, i) => i + 1).find((k) => !hechas[k]);
  const { ej, prescripcion, sugerencia, barra, conAproximacion, kgTrabajo, propuesta, top } = prepararEjercicio(e, actual, ultimas, foco, progresionAuto);
  // v0.63: lo escrito en cada serie (lo lleva el ejercicio, no cada fila: un cambio puede pasar a las siguientes). Las hechas
  // se rellenan con lo guardado cada vez que cambia la serie guardada (como antes en cada fila)
  const fmtV = (v, d) => (v == null ? '' : num(v, d));
  // v0.112: en libras, todo lo que ve y escribe la fila va en libras (enV); se pasa a kilos al guardar
  const enV = (p) => (!p || !enLibras() || p.kg == null || p.kg === '' ? p : { ...p, kg: vista(p.kg) });
  const deHecha = (h) => ({ kg: fmtV(enLibras() ? vista(h.kg) : h.kg, 2), reps: fmtV(h.reps, 0), rpe: h.rpe ?? '' });
  const sincronizadas = useRef(null);
  const [borr, setBorr] = useState(() => {
    sincronizadas.current = {};
    const b = {};
    for (const [k, h] of Object.entries(hechas)) if (h) { b[k] = deHecha(h); sincronizadas.current[k] = h.id; }
    return b;
  });
  const firmaHechas = Object.entries(hechas).map(([k, h]) => `${k}:${h?.id ?? ''}`).join(',');
  useEffect(() => {
    let nuevos = null;
    for (const [k, h] of Object.entries(hechas)) {
      if (!h || sincronizadas.current[k] === h.id) continue;
      sincronizadas.current[k] = h.id;
      (nuevos ||= {})[k] = deHecha(h);
    }
    for (const k of Object.keys(sincronizadas.current)) if (!hechas[k]) delete sincronizadas.current[k];
    if (nuevos) setBorr((b) => ({ ...b, ...nuevos }));
  }, [firmaHechas]);
  const hechasEj = useRef(hechas);
  hechasEj.current = hechas;
  const cambiarBorr = (k, c, t) => setBorr((b) => ({ ...b, [k]: { ...(b[k] || { kg: '', reps: '', rpe: '' }), [c]: t } }));
  // v0.63 (2): al soltar los kilos o las repeticiones de una serie sin hacer, el cambio pasa a las siguientes sin hacer que
  // llevaban lo mismo (misma pauta y sin tocar), con «Deshacer» en el aviso
  function comprometer(k, c, antes, despues) {
    const filasP = Array.from({ length: filas }, (_, i) => i + 1).map((x) => ({
      numero: x, hecha: !!hechas[x], pautada: x <= e.series, tipo: tipoDe(x),
      prescrito: (() => { try { return enV(propuesta(x, hechas))?.[c] ?? null; } catch { return null; } })(),
      texto: x === k ? antes : String(borr[x]?.[c] ?? ''),
    }));
    const cambios = propagarCambio(filasP, k, antes, despues);
    if (!cambios.length) return;
    setBorr((b) => aplicarPropagacion(b, c, cambios));
    const deshacer = () => {
      // (las que ya se han marcado como hechas no se tocan: lo guardado manda)
      const vivos = cambios.filter((x) => !hechasEj.current[x.numero]);
      setBorr((b) => deshacerPropagacion(b, c, vivos));
    };
    if (avisarCambio) avisarCambio(textoPropagacion(cambios.map((x) => x.numero)), deshacer);
    else aviso(textoPropagacion(cambios.map((x) => x.numero)), 'ok', { texto: 'Deshacer', fn: deshacer });
  }
  const conRpe = pideRpe(prescripcion);
  const conDiscos = tipoCarga(ej.nombre) === 'discos';
  // Sin carga pautada (a RPE): en cada serie, su peso de la última vez como referencia
  const conAnterior = prescripcion.carga_sugerida_kg == null;
  const tipoDe = (k) => (!top || k > e.series ? null : k === 1 ? 'top' : 'backoff');
  const kgBackoff = top ? propuesta(2, hechas)?.kg : null;
  const tempo = tempoDe(e);
  // v0.49: hecho del todo y cerrado, el ejercicio es una sola línea (nombre, lo hecho y el check); se abre al tocarlo
  // (con una serie añadida sin hacer, no está completo: ni se pliega ni se da por terminado)
  const completo = pautadasHechas(e, hechas) && filasHechas(e, extra, hechas);
  const nPautadas = seriesPautadasHechas(e, hechas);
  const plegado = !abierto && completo;
  // Las herramientas del ejercicio, en la hoja «Más» (fuera de la tarjeta, para que no estorben entre serie y serie)
  // v0.52.2: el descanso: el del coach se ve y no se cambia aquí (en el temporizador, sí, con ±15 s y ±1 min);
  // sin él, el que eliges tú para este ejercicio (o el de por defecto)
  const delCoach = descanso.origen === 'coach';
  const detalleDescanso = delCoach ? `Te lo ha puesto tu coach: ${textoDescanso(descanso.seg, { delCoach: true })}`
    : descanso.origen === 'propio' ? `Tuyo: ${textoDescanso(descanso.seg)}` : `Por defecto: ${textoDescanso(descanso.seg)}`;
  const herramientas = [
    // v0.64 (4): dejarlo para luego y cambiar el orden de lo que queda (solo hoy: la pauta de tu coach no cambia)
    luego && !completo && { id: 'luego', ico: 'reloj', texto: 'Máquina ocupada · hacerlo luego', detalle: etiqueta ? 'La superserie entera pasa detrás de lo que te queda' : 'Pasa detrás de lo que te queda; tu coach verá el orden en que lo hiciste' },
    ordenar && { id: 'orden', ico: 'ordenar', texto: 'Cambiar el orden', detalle: 'De lo que te queda de la sesión, solo hoy' },
    { id: 'cambiar', ico: 'intercambiar', texto: 'Cambiar', detalle: 'Por una alternativa, si la máquina está ocupada o algo no te sienta bien' },
    { id: 'historial', ico: 'historial', texto: 'Historial', detalle: 'Tus series, gráficas y récords de este ejercicio' },
    { id: 'descanso', ico: 'reloj', texto: 'Descanso', detalle: detalleDescanso, fijo: delCoach },
    tempo && { id: 'tempo', ico: 'altavoz', texto: `Tempo ${tempo.texto}`, nombre: `Metrónomo de tempo ${tempo.texto}`, detalle: 'Metrónomo que marca la bajada, la pausa y la subida' },
    !nota && !editandoNota && { id: 'nota', ico: 'chincheta', texto: 'Nota', detalle: 'Una nota fija para ti en este ejercicio (la silla en el 4, el agarre…)' },
    conAproximacion && kgTrabajo > 0 && { id: 'aproximacion', ico: 'llama', texto: 'Aproximación', detalle: `Series de calentamiento hasta ${pesoTxt(kgTrabajo, 2)}` },
    (ej.instrucciones || ej.errores) && { id: 'tecnica', ico: 'biblioteca', texto: 'Técnica', detalle: 'Las claves y los errores comunes' },
    ej.video_url && (esYoutube(ej.video_url) ? { id: 'tutorial', ico: 'video', texto: 'Tutorial', detalle: 'El vídeo del ejercicio, en pequeño mientras sigues entrenando' } : { id: 'tutorial', ico: 'video', texto: 'Tutorial', detalle: 'El vídeo del ejercicio (se abre aparte)', href: ej.video_url }),
  ].filter(Boolean);
  const usar = (h) => {
    if (h.id === 'tempo') prepararAudio();
    if (h.id === 'tutorial' && !h.href) { setHoja(null); abrirMini({ url: ej.video_url, titulo: ej.nombre, notas: [ej.instrucciones, ej.errores].filter(Boolean).join('\n') }); return; }
    if (h.id === 'nota') { setHoja(null); setEditandoNota(true); return; }
    if (h.id === 'luego') { setHoja(null); luego?.(); return; }
    if (h.id === 'orden') { setHoja(null); ordenar?.(); return; }
    // v0.52: el nombre y el pictograma del ejercicio pasan a la cabecera de su ficha (elemento compartido)
    // (si la cabecera de la tarjeta se ha quedado fuera de la pantalla, el nombre sale del título de la hoja «Más»)
    if (h.id === 'historial') {
      const cab = document.querySelector(`[data-se="${e.id}"] .ejercicio-cab`);
      const aLaVista = (el) => !!el && seVe(el.getBoundingClientRect(), innerWidth, innerHeight);
      const nombre = cab?.querySelector('.nombre');
      const tituloMas = [...document.querySelectorAll('.hoja-dialogo .hoja-cab h2')].pop();
      conTransicion(() => setHoja('historial'), 'morph', [
        { nombre: 'vt-ej-nombre', desde: aLaVista(nombre) ? nombre : tituloMas, hasta: '.ficha-ejercicio .hoja-cab h2' },
        // (v0.127) con la imagen del ejercicio, la miniatura de la tarjeta crece hasta la figura de la ficha; sin ella, el pictograma
        cab?.querySelector('img.miniatura-ej')
          ? { nombre: 'vt-ej-picto', desde: cab.querySelector('img.miniatura-ej'), hasta: '.ficha-ejercicio .ficha-ej-foto-btn img' }
          : { nombre: 'vt-ej-picto', desde: cab?.querySelector('.picto'), hasta: '.ficha-ejercicio .ficha-ej-cab .picto' },
      ]);
      return;
    }
    setHoja(h.id);
  };

  return (
    <article id={`ej-${e.id}`} class={`ejercicio ${plegado ? 'plegado' : ''} ${siguiente ? 'en-curso' : ''} ${recienHecho ? 'recien-hecho' : ''}`} data-se={e.id} aria-label={etiqueta ? `${etiqueta}: ${ej.nombre}` : ej.nombre}>
      <button class="ejercicio-cab" onClick={alternar} aria-expanded={abierto ? 'true' : 'false'}>
        {/* v0.50: el pictograma de su patrón de movimiento, con el disco de la prioridad en la esquina */}
        <span class="ej-marca"><Imagen id={imagenEjercicio(ej)} clase="miniatura-ej ej-mini" tamanos="40px" alternativa={<PictoEjercicio ejercicio={ej} />} /><Disco prioridad={e.prioridad} titulo={NOMBRE_PRIORIDAD[e.prioridad]} /></span>
        <span>
          <span class="nombre">{etiqueta && <span class="ss-etq">{etiqueta}</span>}{ej.nombre}</span>
          {plegado && <span class="resumen-ej num">{resumenSeries(Object.keys(hechas).map(Number).sort((a, b) => a - b).map((k) => hechas[k]))}</span>}
          {!plegado && actual && <span class="cambiado">{lugar ? `Por tu material ${lugar === 'viaje' ? 'de viaje' : 'de casa'}: en lugar de` : 'En lugar de'} {e.ejercicio.nombre}</span>}
          {!plegado && sinMaterial && <span class="video-aviso pendiente"><Icono n="alerta" />Sin alternativa con tu material {sinMaterial === 'viaje' ? 'de viaje' : 'de casa'}</span>}
          {!plegado && e.variante && <span class="variante">{e.variante}</span>}
          {!plegado && e.tempo && tempo && <span class="variante variante-tempo">Tempo {tempo.texto}</span>}
          {!plegado && <span class="pauta">
            <span class="num">{pa.series}</span>
            {pa.detalle && <span>serie a serie</span>}
            {pa.esfuerzo && <span>{pa.esfuerzo}</span>}
            {pa.carga && !actual && <span class="num">{pa.carga}</span>}
            {descanso.seg && !etiqueta && <span class="pauta-descanso">descanso {mmss(descanso.seg)}{delCoach ? '' : ' (tuyo)'}</span>}
          </span>}
          {videosPendientes > 0
            ? <span class="video-aviso pendiente"><Icono n="reloj" />{videosPendientes === 1 ? 'Vídeo guardado en el móvil, sin enviar' : `${videosPendientes} vídeos guardados en el móvil, sin enviar`}</span>
            : videos > 0 && <span class="video-aviso"><Icono n="hecho" />{videos === 1 ? 'Vídeo enviado' : `${videos} vídeos enviados`}</span>}
        </span>
        <span class={`progreso-series ${completo ? 'hecho' : ''}`} style={{ '--f': Math.min(1, nPautadas / (e.series || 1)) }}>{completo ? <Icono n="hecho" width="22" height="22" titulo="Hecho" /> : `${nPautadas}/${e.series}`}</span>
      </button>
      {abierto && (
        <div class="ejercicio-cuerpo">
          <RecuerdaEjercicio recordatorios={recordatorios} />
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
          {/* v0.63 (3): la primera vez, en el móvil (con el dedo), cómo marcar sin apuntar y cómo abrir el teclado */}
          {siguiente && !completo && tactil() && <Pista id="deslizar-serie" icono="hecho">Desliza una serie a la derecha para marcarla como hecha (lo mismo que ✓: con lo que hayas escrito o, si no, con lo que te propone).{teclado?.app ? ' Mantenla pulsada para abrir el teclado en los kilos.' : ''}</Pista>}
          <div class="series-cab" aria-hidden="true"><span>Serie</span><span>{enLibras() ? 'Lb' : 'Kg'}</span><span>Reps</span><span>Esfuerzo</span><span /></div>
          {Array.from({ length: filas }, (_, i) => i + 1).map((k) => {
            const prop = enV(propuesta(k, hechas));
            return (
              <Fragment key={k}>
                <FilaSerie numero={k} hecha={enV(hechas[k])} propuesta={prop} activa={k === activa} siguiente={k === siguiente} barra={barra} record={hechas[k] ? records[`${e.id}-${k}`] : null}
                  anterior={conAnterior ? (enLibras() ? vista(pesoAnterior(ultimas, k)) : pesoAnterior(ultimas, k)) : null}
                  ultima={serieDeAntes(ultimas, k)}
                  pendiente={enCola[`${e.id}-${k}`]} nombre={ej.nombre} tipo={tipoDe(k)}
                  guardar={(v) => guardar(k, v)} quitar={() => quitar(k)}
                  valores={borr[k] || VACIA} cambiar={(c, t) => cambiarBorr(k, c, t)} alComprometer={comprometer}
                  teclado={teclado} conRpe={conRpe || prop?.rpe != null} objetivoEsfuerzo={pa.esfuerzo} conDiscos={conDiscos}
                  paso={pasoPeso({ nombre: ej.nombre, valor: aNum((borr[k] || VACIA).kg) ?? prop?.kg ?? null, discoMinimo: teclado?.discoMinimo })} />
                {/* (ajuste en vivo) la serie que toca, corregida porque la anterior se fue del RPE pautado */}
                {prop?.ajuste && k === activa && !hechas[k] && (() => {
                  // (si ya hay kilos escritos en esa serie, p. ej. pasados desde la primera, se ofrece usar los ajustados)
                  const escrito = aNum((borr[k] || VACIA).kg);
                  const otro = escrito != null && Math.abs(escrito - Number(prop.kg)) > 1e-9;
                  return (
                    <p class="backoff-nota ajuste-nota" role="status">
                      <Icono n={prop.ajuste.sentido === 'bajar' ? 'abajo' : 'arriba'} />
                      <span>{textoAjuste(prop.ajuste, pesoTxt(propuesta(k, hechas)?.kg ?? prop.ajuste.kg, 2))}.</span>
                      {otro && <button type="button" class="btn btn-peq" onClick={() => cambiarBorr(k, 'kg', fmtV(prop.kg, 2))}>Usar {fmtV(prop.kg, 2)}</button>}
                    </p>
                  );
                })()}
                {k === 1 && top && n < e.series && (
                  <p class="backoff-nota">
                    <Icono n="abajo" />
                    {hechas[1]
                      ? <span>Back-off: un {num(e.backoff_pct)} % menos que tu top, <strong class="num">{pesoTxt(kgBackoff, 2)}</strong>.</span>
                      : <span>Las back-off se calculan con lo que hagas en la top ({num(e.backoff_pct)} % menos).</span>}
                  </p>
                )}
              </Fragment>
            );
          })}
          <div class="series-acciones">
            {luego && !completo && <button class="btn-texto btn-luego" onClick={luego} aria-label={`Máquina ocupada: hacer ${etiqueta ? 'la superserie' : ej.nombre} luego`}><Icono n="reloj" /> Máquina ocupada · hacerlo luego</button>}
            <button class="btn-texto" onClick={() => setExtra(filas - e.series + 1)}><Icono n="mas" /> Añadir serie</button>
            {quitable && <button class="btn-texto btn-quitar-serie" onClick={() => { setExtra(Math.max(0, quitable - 1 - e.series)); setBorr((b) => { const n = { ...b }; delete n[quitable]; return n; }); }} aria-label={`Quitar la serie ${quitable}, la añadida`}><Icono n="menos" /> Quitar serie {quitable}</button>}
          </div>
          <div class="acciones-ej">
            {!propio && <SubirArchivo atletaId={atleta.id} sesionEjercicioId={e.id} ejercicioId={ej.id} titulo={`Vídeo: ${ej.nombre}`} etiqueta={videos + videosPendientes > 0 ? 'Enviar otro vídeo' : undefined} alSubir={alSubirVideo}
              ejercicio={ej} series={Array.from({ length: filas }, (_, i) => i + 1).map((k) => ({ numero: k, texto: hechas[k] ? textoSerieVideo(hechas[k]) : null, rpe: hechas[k]?.rpe != null && Number(hechas[k].rpe) > 0 ? Number(hechas[k].rpe) : null }))}
              serieInicial={Math.max(0, ...Object.keys(hechas).map(Number).filter((k) => hechas[k])) || null} />}
            <BotonModelo ejercicio={ej} modelos={modelos} clase="btn-texto" />
            <button class="btn-texto btn-mas" onClick={() => setHoja('mas')} aria-haspopup="dialog" aria-label={`Más herramientas de ${ej.nombre}`}><Icono n="opciones" /> Más</button>
          </div>
        </div>
      )}
      {hoja === 'mas' && (
        <Hoja titulo={ej.nombre} alCerrar={() => setHoja(null)}>
          <ul class="lista hoja-acciones">
            {herramientas.map((h) => (
              <li key={h.id} data-h={h.id}>
                {h.fijo ? (
                  <div class="accion-fila accion-fija">
                    <span class="ico"><Icono n={h.ico} /></span>
                    <span class="pila-xs"><strong>{h.texto}</strong><span class="peq secundario">{h.detalle}</span><span class="peq terciario">En el descanso puedes alargarlo o acortarlo con ±15 s y ±1 min.</span></span>
                    <span />
                  </div>
                ) : h.href
                  ? <a class="accion-fila" href={h.href} target="_blank" rel="noopener" onClick={() => setHoja(null)}><span class="ico"><Icono n={h.ico} /></span><span class="pila-xs"><strong>{h.texto}</strong><span class="peq secundario">{h.detalle}</span></span><Icono n="enlace" class="cola" /></a>
                  : <button class="accion-fila" aria-label={h.nombre || h.texto} aria-describedby={`acc-${e.id}-${h.id}`} onClick={() => usar(h)}><span class="ico"><Icono n={h.ico} /></span><span class="pila-xs"><strong>{h.texto}</strong><span class="peq secundario" id={`acc-${e.id}-${h.id}`}>{h.detalle}</span></span><Icono n="derecha" class="cola" /></button>}
              </li>
            ))}
          </ul>
        </Hoja>
      )}
      {hoja === 'tecnica' && <Tecnica ej={ej} alCerrar={() => setHoja(null)} />}
      {hoja === 'descanso' && <ElegirDescanso nombre={ej.nombre} propio={descansoPropio} defecto={descansoDefecto}
        alElegir={(seg) => { elegirDescanso(seg); setHoja(null); }} alCerrar={() => setHoja(null)} />}
      {hoja === 'cambiar' && <Cambiar e={e} actual={ej} alCerrar={() => setHoja(null)} alElegir={(x) => { cambiar(x); setHoja(null); }} />}
      {hoja === 'historial' && <HistorialEjercicio atletaId={atleta.id} ejercicio={ej} inicial="historial" alCerrar={() => setHoja(null)} />}
      {hoja === 'tempo' && <Metronomo tempo={tempo} nombre={ej.nombre} reps={e.reps_max ?? e.reps_min ?? 8} alCerrar={() => setHoja(null)} />}
      {hoja === 'aproximacion' && <Aproximacion nombre={ej.nombre} kg={kgTrabajo} reps={e.reps_max ?? e.reps_min ?? 5} conBarra={barra} alCerrar={() => setHoja(null)} />}
    </article>
  );
}

const VACIA = { kg: '', reps: '', rpe: '' };
const tactil = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const aNum = (t) => { const x = String(t ?? '').replace(',', '.').trim(); return x === '' || !Number.isFinite(Number(x)) ? null : Number(x); };

// «Lo que te dijo tu coach» (v0.48): sus últimos comentarios de este ejercicio (en tus vídeos o en sesiones
// anteriores en que lo nombró)
// (YouTube) El vídeo de la sesión: plegado en una fila hasta que se toca; al acabarlo (o verlo casi entero), «Hecho».
// Lo hecho sale de lo visto (videos_vistos), así se ve igual en otro móvil y lo ve el coach.
function VideoDeSesion({ sesion }) {
  const { api, atleta } = useApp();
  const v = videoDe(sesion.video_url);
  const vistos = useCarga(() => (atleta?.id ? api.videosVistos(atleta.id) : Promise.resolve([])), [atleta?.id, sesion.id]);
  const [abierto, setAbierto] = useState(false);
  const [hecho, setHecho] = useState(false);
  if (!v) return null;
  const visto = hecho || (vistos.datos || []).some((x) => x.video === v.id && x.completo);
  const titulo = sesion.video_titulo || 'Sigue este vídeo';
  return (
    <section class={`panel panel-pad pila-s video-sesion ${visto ? 'hecho' : ''}`} aria-labelledby={`video-sesion-${sesion.id}`}>
      <button type="button" class="separa video-sesion-cab" aria-expanded={abierto ? 'true' : 'false'} onClick={() => setAbierto(!abierto)}>
        <span class="pila-xs"><span class="mini terciario">Tu coach te pone este vídeo</span><strong id={`video-sesion-${sesion.id}`}>{titulo}</strong></span>
        {visto ? <span class="chip ok"><Icono n="hecho" />Hecho</span> : <Icono n={abierto ? 'arriba' : 'play'} />}
      </button>
      {abierto && <VideoYoutube url={sesion.video_url} titulo={`${sesion.nombre}: ${titulo}`} abierto alTerminar={() => setHecho(true)} />}
    </section>
  );
}

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
        {ej.video_url && (esYoutube(ej.video_url) ? (
          <>
            <VideoYoutube url={ej.video_url} titulo={`Técnica: ${ej.nombre}`} notas={[ej.instrucciones, ej.errores].filter(Boolean).join('\n')} />
            <button class="btn btn-ancho" onClick={() => { alCerrar(); abrirMini({ url: ej.video_url, titulo: ej.nombre, notas: [ej.instrucciones, ej.errores].filter(Boolean).join('\n') }); }}><Icono n="video" /> Verlo en pequeño mientras entrenas</button>
          </>
        ) : <a class="btn btn-ancho" href={ej.video_url} target="_blank" rel="noopener"><Icono n="video" /> Ver el vídeo</a>)}
      </div>
    </Hoja>
  );
}

// Cambiar el ejercicio por una alternativa equivalente (las que marca el coach en la biblioteca)
// v0.52.2: el descanso de un ejercicio en el que el coach no ha puesto uno (se guarda en este móvil, para ese
// ejercicio en todas las sesiones). Elegir uno lo guarda y cierra, como «Cambiar».
function ElegirDescanso({ nombre, propio, defecto, alElegir, alCerrar }) {
  const tuyo = DESCANSOS_ATLETA.includes(propio) ? propio : null;
  const Opcion = ({ valor, texto, nota = null }) => {
    const elegida = valor === tuyo;
    return (
      <button type="button" class={elegida ? 'elegida' : ''} aria-pressed={elegida ? 'true' : 'false'} onClick={() => alElegir(valor)}>
        <span class="separa"><span style="font-weight:600">{texto}</span>{elegida && <Icono n="hecho" />}</span>
        {nota && <span class="mini terciario">{nota}</span>}
      </button>
    );
  };
  return (
    <Hoja titulo="Descanso" alCerrar={alCerrar}>
      <p class="peq secundario">Tu coach no te ha puesto descanso en {nombre}. El que elijas arranca solo al marcar cada serie, en todas tus sesiones, y se guarda en este móvil.</p>
      <div class="lista-elegir lista-descansos" role="group" aria-label={`Descanso de ${nombre}`}>
        <Opcion valor={null} texto="Usar el de por defecto" nota={`Ahora, ${textoDescanso(defecto)}. Se cambia en Perfil, en «Sonido y vibración».`} />
        {DESCANSOS_ATLETA.map((s) => <Opcion key={s} valor={s} texto={s ? mmss(s) : 'Sin descanso automático'} />)}
      </div>
    </Hoja>
  );
}

function Cambiar({ e, actual, alCerrar, alElegir }) {
  const { api } = useApp();
  const [otros, setOtros] = useState(false);
  const biblioteca = useCarga(() => (otros ? api.biblioteca() : Promise.resolve([])), [otros]);
  const principal = e.ejercicio.grupos_musculares?.[0];
  const delGrupo = (biblioteca.datos || []).filter((x) => x.activo !== false && x.grupos_musculares?.[0] === principal && x.id !== e.ejercicio.id && !e.alternativas.some((a) => a.id === x.id));
  // (YouTube) cada variante lleva su propio vídeo: se dice cuál lo tiene y se puede ver antes de elegirla
  const [verVideo, setVerVideo] = useState(null);
  const Opcion = ({ x, nota }) => (
    <div class="opcion-con-video">
      <button key={x.id} class={x.id === actual.id ? 'elegida' : ''} aria-pressed={x.id === actual.id ? 'true' : 'false'} onClick={() => alElegir(x)}>
        <span style="font-weight:600">{x.nombre}</span>
        <span class="mini terciario">{nota || (x.grupos_musculares || []).map((g) => NOMBRE_GRUPO[g]).join(', ')}</span>
      </button>
      {x.video_url && esYoutube(x.video_url) && <button type="button" class="btn btn-icono plano" aria-label={`Ver el vídeo de ${x.nombre}`} onClick={() => setVerVideo(x)}><Icono n="video" /></button>}
    </div>
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
      {verVideo && (
        <Hoja titulo={verVideo.nombre} alCerrar={() => setVerVideo(null)}>
          <div class="pila"><VideoYoutube url={verVideo.video_url} titulo={`Técnica: ${verVideo.nombre}`} notas={[verVideo.instrucciones, verVideo.errores].filter(Boolean).join('\n')} abierto />
            <button class="btn btn-primario btn-grande" onClick={() => { setVerVideo(null); alElegir(verVideo); }}>Hacer este</button></div>
        </Hoja>
      )}
    </Hoja>
  );
}

// La pauta de cardio del coach, en una tarjeta: qué toca, cuánto y a qué esfuerzo; y, hecha, lo que se hizo
export function TarjetaCardio({ pauta, hecho, completada, sesionId = null }) {
  const h = cardioHechoValido(hecho) ? hecho : null;
  const kmTxt = (k) => num(k, k % 1 ? 1 : 0);
  return (
    <div class="panel panel-pad tarjeta-cardio">
      <span class="ico" aria-hidden="true"><Icono n="intervalos" /></span>
      <div class="pila-s">
        <div>
          <div class="peq secundario">{NOMBRE_MODALIDAD[pauta.modalidad]}</div>
          <div class="cifra-cardio">
            {pauta.minutos ? <>{pauta.minutos}{pauta.minutos_max ? `–${pauta.minutos_max}` : ''}<small>min</small></> : null}
            {pauta.minutos && pauta.km ? <small> y </small> : null}
            {pauta.km ? <>{kmTxt(pauta.km)}{pauta.km_max ? `–${kmTxt(pauta.km_max)}` : ''}<small>km</small></> : null}
          </div>
        </div>
        {/* (v0.133) la carrera: tipo, zona con sus pulsaciones, las partes y el semáforo antes de salir */}
        {pautaDeCarrera(pauta) && sesionId && <DetalleCarreraSesion pauta={pauta} sesionId={sesionId} completada={completada} hecho={h} />}
        {pauta.esfuerzo && <p class="peq">Esfuerzo {num(pauta.esfuerzo)} de 10: {palabrasEsfuerzo(pauta.esfuerzo)}.</p>}
        {/* (v0.142) si sale fuera y eligió su zona en Hoy: el tiempo de ahora y sus avisos (calor, frío, lluvia, viento, aire) */}
        {!h && !completada && deFuera(pauta) && <TiempoSesion modalidad={pauta.modalidad} />}
        {pauta.nota && <p class="peq secundario">{pauta.nota}</p>}
        {h ? <span class="chip ok"><Icono n="hecho" />Hecho: {NOMBRE_MODALIDAD[h.modalidad].toLowerCase()}, {textoCardioHecho(h)}{textoSaludCardio(h) ? ` · ${textoSaludCardio(h)}` : ''}</span>
          : !completada && <p class="mini terciario">Al terminar, apunta los minutos, los kilómetros y cuánto te ha costado.</p>}
        {/* (v0.104) el metrónomo de cadencia: pasos, pedaladas, zancadas, paladas o saltos por minuto */}
        {!h && !completada && <Cadencia modalidad={pauta.modalidad} />}
      </div>
    </div>
  );
}

// ---------- terminar ----------
function Terminar({ sesion, semana, inicio, minutosSugeridos = null, duracionSeries = null, conEjercicios = false, alCerrar, alGuardar, salud = false }) {
  const { propio } = useApp();
  // (054) la duración sale de las series guardadas (de la primera a la última): vale aunque la app se haya recargado o
  // se termine otro día; si no hay series, del cronómetro de la sesión; si no, lo de siempre
  const estimado = minutosSugeridos || duracionSeries || (inicio ? Math.max(5, Math.round((Date.now() - inicio) / 60000) + 5) : sesion.cardio?.minutos || (sesion.tipo !== 'fuerza' ? 40 : null));
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
  // (v0.133) Carrera: cómo llegó (el semáforo que eligió al empezar), los segundos (en una carrera o un test), el desnivel
  // y, con su consentimiento de datos de salud, la FC media y máxima y el dolor
  const [semaforo, setSemaforo] = useState(h0?.semaforo || leerSemaforo(sesion.id));
  const [segExtra, setSegExtra] = useState(h0?.seg ?? null);
  const [desnivel, setDesnivel] = useState(h0?.desnivel ?? null);
  const [fcMedia, setFcMedia] = useState(h0?.fc_media ?? null);
  const [fcMax, setFcMax] = useState(h0?.fc_max ?? null);
  const [dolor, setDolor] = useState(h0?.dolor ?? null);
  const esCarrera = conCardio && modalidad === 'carrera';
  const conSegundos = esCarrera && ['carrera', 'test'].includes(sesion.cardio?.tipo);
  const guardarTodo = async () => {
    const cambios = { completada: true, fecha_realizada: fecha > hoy ? hoy : fecha, rpe_sesion: rpe, duracion_min: min, nota_atleta: nota.trim() || null };
    if (conCardio) {
      const minutos = cardioAparte ? minCardio : min;
      if (!minutos) throw new Error('Para el cardio hacen falta los minutos.');
      const extra = esCarrera ? { desnivel, ...(conSegundos ? { seg: segExtra } : {}), ...(salud ? { semaforo, fc_media: fcMedia || null, fc_max: fcMax || null, dolor } : {}) } : {};
      if (extra.fc_media && extra.fc_max && extra.fc_max < extra.fc_media) throw new Error('La FC máxima no puede ser menor que la media.');
      const hecho = limpiarCardioHecho({ modalidad, minutos, km, ...extra });
      if (!hecho) throw new Error(esCarrera ? 'Revisa lo de la carrera: minutos, kilómetros y, si las pones, pulsaciones de 40 a 240.' : 'Revisa los minutos y los kilómetros del cardio.');
      cambios.cardio_hecho = hecho;
    }
    await alGuardar(cambios);
    olvidarSemaforo(sesion.id);
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
      {esCarrera && (
        <div class="campo campos-carrera-hecho">
          {salud && <>
            <span class="etq">¿Cómo llegaste?</span>
            <Segmentos etiqueta="Cómo llegaste" valor={semaforo} alCambiar={(x) => setSemaforo(x === semaforo ? null : x)} opciones={['verde', 'ambar', 'rojo'].map((k) => [k, SEMAFORO[k].titulo])} />
          </>}
          {conSegundos && <div class="fila-campos"><span class="peq secundario" style="align-self:center">Y segundos (para tu tiempo exacto)</span><Paso id="t-seg" valor={segExtra} paso={1} min={0} max={59} dec={0} etiqueta="segundos" alCambiar={setSegExtra} /></div>}
          <details class="mas-carrera" open={!!(h0?.fc_media || h0?.fc_max || h0?.dolor != null || h0?.desnivel)}>
            <summary class="peq">{salud ? 'Pulsaciones, dolor y desnivel' : 'Desnivel'}</summary>
            <div class="pila-s">
              {salud ? <>
                <div class="fila-campos"><span class="peq secundario" style="align-self:center">FC media</span><Paso id="t-fc-media" valor={fcMedia} paso={1} min={0} max={230} dec={0} etiqueta="pulsaciones medias" alCambiar={setFcMedia} /></div>
                <div class="fila-campos"><span class="peq secundario" style="align-self:center">FC máxima</span><Paso id="t-fc-max" valor={fcMax} paso={1} min={0} max={240} dec={0} etiqueta="pulsaciones máximas" alCambiar={setFcMax} /></div>
                <label class="fila-campos" for="t-dolor"><span class="peq secundario" style="align-self:center">Dolor (0 nada, 10 máximo)</span>
                  <select id="t-dolor" class="selector" value={dolor == null ? '' : String(dolor)} onChange={(e) => setDolor(e.currentTarget.value === '' ? null : Number(e.currentTarget.value))}>
                    <option value="">—</option>{Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                  </select></label>
                <span class="ayuda">Lo ve solo tu coach. Si el dolor pasa de 3, cuéntale dónde en la nota.</span>
              </> : <span class="ayuda">Para apuntar cómo llegaste, las pulsaciones y el dolor hace falta tu consentimiento de datos de salud (en tu perfil).</span>}
              <div class="fila-campos"><span class="peq secundario" style="align-self:center">Desnivel positivo (m)</span><Paso id="t-desnivel" valor={desnivel} paso={10} min={0} max={10000} dec={0} etiqueta="metros de desnivel" alCambiar={setDesnivel} /></div>
            </div>
          </details>
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
        <div class="separa"><label for="t-nota">{propio ? 'Nota' : 'Nota para tu coach'}</label><Dictar alTexto={(t) => setNota((n) => (n ? `${n.trimEnd()} ${t}` : t))} etiqueta="Dictar la nota" /></div>
        <textarea id="t-nota" class="area" placeholder="Cómo te has sentido, molestias, cambios que hayas hecho…" value={nota} onInput={(e) => setNota(e.currentTarget.value)} />
        {duracionSeries && !sesion.completada && <span class="ayuda">La duración la hemos sacado de tus series (de la primera a la última). Cámbiala si no cuadra.</span>}
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
    series: series.length, tonelaje, minutos: cambios.duracion_min, rpe: cambios.rpe_sesion, cardio: cardioHechoPublico(cambios.cardio_hecho), records: Object.values(porEjercicio), enCola, musculos,
    // (compartir) la tarjeta de una sesión de cardio lleva lo hecho (minutos, km y ritmo)
    tarjeta: { ...datosTarjeta({ ...sesion, ...cambios }, ejercicios, hechas, records, ejerciciosPorId, cambios.duracion_min), cardio: cardioHechoPublico(cambios.cardio_hecho) },
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

// v0.69: las sesiones compartidas solas que se han deshecho (para no volver a compartirlas al volver a este resumen)
const deshechasEquipo = new Set();

// (diseño, tanda 17) La tarjeta para compartir, en pequeño, asomando en su botón: se pinta en el móvil con lo mismo que la
// hoja de compartir (no sale de él) un momento después de abrir el resumen. Si no se puede pintar, no sale y ya está.
function MiniTarjeta({ datos }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let vivo = true, hecha = null;
    const t = setTimeout(() => {
      dibujarTarjeta(datos, { plantilla: 'cifras' }).then((blob) => { if (!vivo) return; hecha = URL.createObjectURL(blob); setUrl(hecha); }).catch(() => {});
    }, 700);
    return () => { vivo = false; clearTimeout(t); if (hecha) URL.revokeObjectURL(hecha); };
  }, []);
  return url ? <img class="resumen-mini" src={url} alt="" aria-hidden="true" width="36" height="45" /> : null;
}

function Resumen({ resumen, sesion, familia, alCerrar }) {
  const { api, atleta, propio, aviso } = useApp();
  const travesia = leerTravesia(atleta.id).sesiones[sesion.id] || null;
  const [compartir, setCompartir] = useState(false);
  // (compartir) un récord suelto, como tarjeta de logro; y el recordatorio de Hoy («tu récord de ayer merece una historia»)
  const [compartirRecord, setCompartirRecord] = useState(null);
  useEffect(() => {
    if (propio || !sesion?.id || !resumen?.records?.length || resumen.enCola) return;
    const fecha = resumen.tarjeta?.fecha || hoyISO();
    guardarPreferencia(PREF_RECORDATORIO, { sesionId: sesion.id, fecha, records: resumen.records.map((x) => x.nombre), tarjetas: resumen.records.slice(0, 3).map((x) => datosRecordDeSesion(x, fecha)), compartida: false });
  }, [sesion?.id]);
  const marcarCompartida = () => guardarPreferencia(PREF_RECORDATORIO, null);
  // v0.43: «Compartir con el equipo», si la comunidad está abierta y está dentro (y la sesión no está ya compartida)
  const [equipo, setEquipo] = useState(false);
  const [compartida, setCompartida] = useState(false);
  const equipoPosible = !propio && atleta?.estado !== 'baja' && resumen.series > 0 && !!resumen.tarjeta && !resumen.enCola && !!sesion?.id;
  const estadoEquipo = useCarga(async () => {
    if (!equipoPosible) return false;
    const [c, m] = await Promise.all([api.comunidad(), api.miembroComunidad()]);
    return c.activa && api.dentroDeComunidad(m) && !(await api.sesionCompartida(sesion.id));
  }, [sesion?.id]);
  // v0.69: «Compartir mis entrenos sin preguntar» (Equipo → ajustes, en este móvil): se comparte sola, sin los kilos, con
  // «Deshacer» (borra la publicación). Solo estando dentro del equipo y una vez por sesión.
  const auto = useRef(false);
  useEffect(() => {
    if (estadoEquipo.datos !== true || auto.current || deshechasEquipo.has(sesion.id) || !leerAutoCompartir(api.uid())) return;
    auto.current = true;
    (async () => {
      try {
        const id = await api.compartirEnEquipo(sesion.id, { texto: '', kilos: false });
        setCompartida(true);
        aviso('Compartido con el equipo', 'ok', { texto: 'Deshacer', fn: async () => {
          try { await api.borrarDeComunidad({ id }); deshechasEquipo.add(sesion.id); setCompartida(false); aviso('Ya no está en el muro'); } catch (e) { aviso(e.message, 'error'); }
        } });
      } catch (e) { aviso(`No se ha podido compartir con el equipo: ${e.message}`, 'error'); }
    })();
  }, [estadoEquipo.datos]);
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
  // (imágenes) el sello: la copa si hay récord; el farol la primera vez que hace esta sesión (lo mismo que dice abajo)
  const primera = !cardio && resumen.series > 0 && !resumen.enCola && !anteriores.cargando && !!anteriores.datos && !comparacion;
  const sello = selloSesion({ records: nRecords, primera });
  return (
    <div class="contenido resumen-sesion">
      <section class={`resumen-hero ${nRecords ? 'con-record' : ''}`} aria-labelledby="resumen-titulo" style={{ '--i': 0 }}>
        {/* (diseño, tanda 17) el dibujo de la sesión, de fondo, como en la tarjeta de Hoy */}
        {/* (imágenes) la ilustración de la sesión, la misma de su portada; si no se puede, el dibujo */}
        {sesion?.nombre && <Imagen key={imagenPortada(familia, resumen.cardio?.modalidad || sesion?.cardio?.modalidad)} id={imagenPortada(familia, resumen.cardio?.modalidad || sesion?.cardio?.modalidad)} clase="hero-arte hero-foto" tamanos="(min-width: 600px) 420px, 70vw"
          alternativa={<ArteSesion nombre={sesion.nombre} tipo={sesion.tipo || (cardio ? 'cardio' : 'fuerza')} patron={null} clase="hero-arte" />} />}
        {/* (ilustraciones vivas) al levantarse el telón, un barrido de luz cruza la portada del resumen */}
        {sesion?.nombre && <span class="hero-brillo" aria-hidden="true" />}
        <span class={`resumen-medalla ${hayImagen(sello) ? 'con-ilu' : ''}`} aria-hidden="true">
          <Imagen key={sello} id={sello} clase="resumen-medalla-img" tamanos="72px" alternativa={<Icono n={nRecords ? 'trofeo' : 'hecho'} />} />
        </span>
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
            <dd><span class="v num"><CifraSube texto={c.v} espera={380 + i * 90} /></span>{c.u && <span class="u">{c.u}</span>}</dd>
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
      {/* «La travesía»: lo que ha corrido su lobo en los descansos de esta sesión (si ha jugado) */}
      {travesia?.metros > 0 && (
        <p class="resumen-compara resumen-travesia" style={{ '--i': 5 }}>
          <Icono n="luna" /><span>En los descansos, tu lobo ha recorrido <strong class="num">{textoDistancia(travesia.metros)}</strong>{travesia.estrellas > 0 ? ` y ha cogido ${travesia.estrellas} ${travesia.estrellas === 1 ? 'estrella' : 'estrellas'}` : ''}.</span>
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
                  {!propio && <button type="button" class="btn btn-icono plano resumen-record-compartir" aria-label={`Compartir el récord en ${x.nombre}`} onClick={() => setCompartirRecord(x)}><Icono n="compartir" /></button>}
                </li>
              ))}
            </ul>
          </div>
          <p class="peq secundario">1RM estimado con la fórmula de Epley, contando las repeticiones que te quedaban en recámara.</p>
          {/* (v0.104) lo que tu coach dejó escrito para un récord */}
          <MensajeCoach momento="record" ejercicio={resumen.records[0]?.nombre || ''} />
          {/* (v0.104) y su canción de récord, si la eligió */}
          <CancionRecord />
        </section>
      )}
      {/* (v0.104) «Hace seis meses…»: el ejercicio de hoy que más ha subido desde entonces */}
      {!cardio && resumen.series > 0 && !resumen.enCola && <div style={{ '--i': 6 }} class="resumen-recuerdo"><RecuerdoProgreso sesionId={sesion.id} /></div>}
      {/* (v0.105) apuntar el entreno en Salud del iPhone, con su atajo */}
      <AnadirASalud sesion={sesion} resumen={resumen} />
      {Object.keys(resumen.musculos || {}).length > 0 && (
        <section class="seccion resumen-musculos" style={{ '--i': 7 }}>
          <h2>Músculos de hoy</h2>
          <div class="panel panel-pad"><MapaMuscular series={resumen.musculos} etiqueta="Series por músculo de hoy" /></div>
        </section>
      )}
      {resumen.enCola && <div class="banda-conexion"><Icono n="sinred" />Guardado en el móvil. Se enviará a tu coach cuando vuelva la conexión.</div>}
      <div class="resumen-acciones pila" style={{ '--i': 8 }}>
        {(resumen.series > 0 || cardio) && resumen.tarjeta && <button class="btn btn-grande btn-compartir-sesion" onClick={() => setCompartir(true)}><MiniTarjeta datos={resumen.tarjeta} /><Icono n="compartir" /> Compartir la sesión</button>}
        {compartida ? <p class="nota peq compartida-equipo"><Icono n="hecho" /> Compartida con el equipo</p>
          : estadoEquipo.datos === true && <button class="btn btn-grande" onClick={() => setEquipo(true)}><Icono n="equipo" /> Compartir con el equipo</button>}
        <button class="btn btn-primario btn-grande" onClick={() => { try { sessionStorage.setItem('fbe-recien-hecha', '1'); } catch { /* */ } alCerrar(); }}>Volver a hoy</button>
      </div>
      {compartir && <HojaCompartir plantillas datos={resumen.tarjeta} alCerrar={() => { setCompartir(false); marcarCompartida(); }} />}
      {compartirRecord && <HojaCompartir logro tipo="record" titulo="Compartir el récord" datos={datosRecordDeSesion(compartirRecord, resumen.tarjeta?.fecha || hoyISO())} equipo={estadoEquipo.datos === true || compartida ? { tema: 'logros' } : null} alCerrar={() => { setCompartirRecord(null); marcarCompartida(); }} />}
      {equipo && (
        <HojaCompartirEquipo alCerrar={() => setEquipo(false)} alCompartir={() => { setEquipo(false); setCompartida(true); }}
          datos={{ sesionId: sesion.id, nombre: resumen.tarjeta.nombre, fecha: resumen.tarjeta.fecha, minutos: resumen.minutos ?? resumen.tarjeta.minutos, series: resumen.series,
            mejores: resumen.tarjeta.mejores }} />
      )}
    </div>
  );
}
