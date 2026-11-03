import { Fragment } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Cargando, Hoja, cuando, Vacio, copiar, Pestanas } from './comunes.jsx';
import { Hilo, HojaRespuestas } from './Hilo.jsx';
import { VerArchivo, capturarPoster } from './Archivos.jsx';
import { LIMITE_ARCHIVO_MB } from '../datos/api.js';
import { aISO, fmtProgramado } from '../logica/fechas.js';
import { TextoChat } from './Enlaces.jsx';
import { HojaProgramar } from './Programar.jsx';
import { gruposChat } from '../logica/visual.js';
import { sinMovimiento } from './transiciones.js';
import { leerAjustes } from './ajustes.js';
import { vibrar } from './hapticos.js';
import {
  REACCIONES_CHAT, MAX_FOTOS, extractoCita, separadorNoLeidos, textoNoLeidos, coincidencias, resumenReacciones, puedeEditar, puedeEliminar,
  puedeReaccionar, infoMensaje, estadoConexion, enlacesDe, mediosDe, consultaRapida, filtrarRapidas, leerBorrador, guardarBorrador, borrarBorrador,
  esMarcador, cuandoInfo,
} from '../logica/mensajes.js';
import {
  soloEmojis, recortarLargo, etiquetaDia, estadoEnvio, TEXTO_ESTADO, conPendientes, reenviable, accionesSeleccion, textoCopiado,
  esPdf, paginasPdf, PDF_MAX_MB, tamanoTexto, nombreSeguroPdf, DURACIONES_FIJAR, fijadoVigente, silenciado, textoSilencio,
} from '../logica/chat.js';
import { apuntarReciente, insertarEnTexto } from '../logica/emojis.js';
import { textoPlano } from '../logica/formato.js';
import { salidaDe } from '../datos/salida.js';
import { PanelEmojis, BotonEmojis } from './chat/Emojis.jsx';
import { Visor } from './chat/Visor.jsx';
import { HojaReenviar } from './chat/Reenviar.jsx';
import { InfoContacto, HojaSilenciar } from './chat/InfoContacto.jsx';
import { DocumentoChat } from './chat/Documento.jsx';
import { useGrabadora, BotonMicro, PanelGrabando, PanelRevisar, NotaVozChat } from './chat/NotaVoz.jsx';
import { EditorFoto } from './chat/EditorFoto.jsx';
import { EncuestaChat, HojaEncuesta } from './chat/Encuesta.jsx';
import { HojaReaccionesRapidas } from './chat/Emojis.jsx';
import { cacheChat } from '../datos/cacheChat.js';
import { tomarParaChat } from './Compartido.jsx';
import { sonar } from './sonidos.js';
import { prepararFoto } from './fotos.js';
import { debeSonar, porTipo, TIPOS_BUSQUEDA, primeroDesde, ultimoEditable } from '../logica/chat.js';
import { leerReacciones, emojiValido } from '../logica/emojis.js';
import { comprimible } from '../logica/imagen.js';

// El chat (v0.18): todos los mensajes con una persona en un solo hilo, como en WhatsApp. Lo que viene de una sesión,
// un check-in o un vídeo lleva su etiqueta, que abre ese sitio; lo que se escribe aquí es un mensaje general.
// v0.54, como WhatsApp: responder (deslizando la burbuja a la derecha o desde su menú), reacciones, menú al mantener
// pulsado (o con el botón derecho, «Más opciones» o Mayús+F10), editar (15 min), eliminar para todos (48 h), destacados,
// info, formato (*negrita*…), «escribiendo…» y «en línea», «N MENSAJES SIN LEER», buscar, archivos y enlaces, fondo con
// dibujos, borradores, varias fotos con un pie y, para el coach, respuestas rápidas con «/».
// v0.55, aún más WhatsApp: el mensaje sale al momento (⏱ → ✓ → ✓✓ gris al llegarle → ✓✓ azul al leerlo), sin cobertura
// espera en la bandeja de salida y sale solo; si falla, «!» con «Reintentar» o «Eliminar»; emojis, adjuntar (cámara,
// galería y PDF), la hora y los ✓ dentro de la burbuja, el pico en la primera de cada grupo, los mensajes de 1 a 3
// emojis en grande, «Leer más» en los largos, la píldora del día y el botón ⌄ con lo nuevo, el visor de fotos y vídeos,
// fijar un mensaje (el coach), seleccionar varios, «Info del contacto», reenviar (el coach), silenciar y animaciones.
// v0.56: abre al momento (y sin cobertura) con lo guardado en el móvil; carga lo anterior al subir sin saltos; tonos al
// enviar y al recibir; las fotos se reducen (sin EXIF) con «HD» y un editor (recortar, girar, dibujar, texto); el progreso
// de cada envío dentro de su burbuja, con «Cancelar»; pegar o soltar archivos (ordenador); encuestas (el coach); ir a una
// fecha y buscar por tipo; tonos de piel y tus seis reacciones; Ctrl/Cmd+F, Escape y ↑ para editar; y notas de voz de
// hasta un minuto.
// yo: 'coach' o 'atleta'. irContexto({tipo, id}): abrir la sesión, el check-in o el archivo.
// cabecera: { izquierda, titulo, sub, derecha, verFicha } para pintar aquí la cabecera de la pantalla (con su estado, la
// búsqueda y el menú); sin ella (en la ficha), una fila de herramientas. perfilOtro: el perfil del atleta (para el coach).
const NOMBRE_EMOJI_FIJO = { '❤️': 'corazón', '👍': 'pulgar arriba', '💪': 'bíceps', '😂': 'risa', '😮': 'sorpresa', '🙏': 'gracias' };
// (v0.56: cualquier emoji; de los que no tienen nombre aquí, el propio emoji)
const NOMBRE_EMOJI = new Proxy(NOMBRE_EMOJI_FIJO, { get: (o, k) => o[k] || String(k) });
const almacen = () => { try { return window.localStorage; } catch { return null; } };
// En el ordenador (ratón y teclado), Enter envía; en el móvil, salta de línea (como WhatsApp)
const enOrdenador = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
const ahorroDatos = () => typeof navigator !== 'undefined' && !!navigator.connection?.saveData;

export function Chat({ atletaId, nombreAtleta = 'Atleta', nombreCoach = 'Tu coach', fotoOtro = null, irContexto, alLeer, alCambiar, cabecera = null, perfilOtro = null, saltarA = null, archivosIniciales = null }) {
  const { api, perfil, aviso, modo } = useApp();
  const yo = perfil?.rol === 'coach' ? 'coach' : 'atleta';
  const miId = perfil?.id || null;
  const [limite, setLimite] = useState(400);
  const conv = useCarga(() => api.conversacion(atletaId, { limite }), [atletaId, limite]);
  const borradorInicial = useMemo(() => leerBorrador(almacen(), miId, atletaId), [miId, atletaId]);
  const [texto, setTexto] = useState(borradorInicial?.texto || '');
  const [adjuntos, setAdjuntos] = useState([]);      // [{ id, archivo, url, esVideo, esPdf, paginas }]
  const [enDiario, setEnDiario] = useState(true);    // los vídeos del atleta, a su diario (como vídeo de técnica)
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState(null);    // { i, n } al enviar varias
  const [guardadas, setGuardadas] = useState(false);
  const [abierto, setAbierto] = useState(null);      // un vídeo o foto del diario (con su hilo)
  const [visor, setVisor] = useState(null);          // v0.55: { inicio } el visor de fotos y vídeos del chat
  const [programar, setProgramar] = useState(null);  // v0.48: null | { nuevo: true } | mensaje programado a cambiar
  const [citando, setCitando] = useState(null);      // v0.54: el mensaje al que se responde
  const [editando, setEditando] = useState(null);
  const [menu, setMenu] = useState(null);            // el mensaje con su menú abierto
  const [eliminar, setEliminar] = useState(null);    // [mensajes] a eliminar para todos
  const [info, setInfo] = useState(null);
  const [quien, setQuien] = useState(null);          // quién ha reaccionado a un mensaje
  const [hoja, setHoja] = useState(null);            // 'menu' | 'destacados' | 'archivos' | 'contacto' | 'adjuntar' | 'silenciar'
  const [pestArchivos, setPestArchivos] = useState('multimedia');
  const [buscando, setBuscando] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [actualId, setActualId] = useState(null);
  const [resaltada, setResaltada] = useState(null);
  const [rapidas, setRapidas] = useState(null);
  const [iRapida, setIRapida] = useState(0);
  const [rapidasFuera, setRapidasFuera] = useState(false);
  const [emojis, setEmojis] = useState(false);       // v0.55: el panel de emojis
  const [seleccion, setSeleccion] = useState(null);  // v0.55: null | Set de ids (modo seleccionar)
  const [reenviar, setReenviar] = useState(null);    // v0.55: [mensajes] a reenviar (el coach)
  const [fijar, setFijar] = useState(null);          // v0.55: el mensaje a fijar (elegir cuánto)
  const [fallido, setFallido] = useState(null);      // v0.55: el mensaje que no salió («Reintentar» / «Eliminar»)
  const [subidas, setSubidas] = useState([]);        // v0.56: fotos, vídeos, PDF y notas de voz saliendo (con su progreso)
  const [editarFoto, setEditarFoto] = useState(null); // v0.56: el adjunto que se está editando
  const [hd, setHd] = useState(() => leerAjustes().fotosHd === true);
  const [filtroTipo, setFiltroTipo] = useState(null); // v0.56: buscar por tipo (foto, vídeo, enlace, documento, audio)
  const [soltando, setSoltando] = useState(false);   // v0.56: arrastrando archivos encima (ordenador)
  const [rapidasEmoji, setRapidasEmoji] = useState(() => leerReacciones(almacen(), perfil?.id));
  const lista = useRef(null);
  const raiz = useRef(null);
  const fin = useRef(null);
  const barra = useRef(null);
  // v0.49 + v0.55: lo nuevo que llega mientras lees más arriba (el número del botón ⌄) y el primero de ello
  const [nuevos, setNuevos] = useState(0);
  const primerNuevo = useRef(null);
  const [abajo, setAbajo] = useState(true);
  const abajoRef = useRef(true);
  abajoRef.current = abajo;
  const area = useRef(null);
  const input = useRef(null);
  const inputCamara = useRef(null);
  const inputDoc = useRef(null);
  const inputBusqueda = useRef(null);
  const recargar = useRef(null);
  recargar.current = conv.recargar;
  const [fondo, setFondo] = useState(leerAjustes().fondoChat !== 'liso');

  // v0.56: lo guardado en el móvil, mientras llega la base (o si no hay cobertura)
  const [enCache, setEnCache] = useState(null);
  useEffect(() => { let vivo = true; setEnCache(null); cacheChat().leer(miId, atletaId).then((x) => vivo && x && setEnCache(x.mensajes)); return () => { vivo = false; }; }, [miId, atletaId]);
  useEffect(() => { if (conv.datos) cacheChat().guardar(miId, atletaId, conv.datos); }, [conv.datos]);
  const datos = conv.datos || enCache;
  const desdeCache = !conv.datos && !!enCache;
  const mensajes = datos || [];
  const porId = useMemo(() => Object.fromEntries(mensajes.map((c) => [c.id, c])), [mensajes]);
  const hayMas = mensajes.length >= limite;
  const primerNombre = nombreAtleta.split(' ')[0];
  const otro = yo === 'coach' ? primerNombre : nombreCoach;
  const nombreDe = (autor) => (autor === yo ? 'Tú' : yo === 'coach' ? primerNombre : 'Tu coach');

  // v0.55: la bandeja de salida (lo que se está enviando, o espera la cobertura) y lo recién salido (con su ✓ hasta que
  // llega la conversación de la base)
  const salida = useMemo(() => salidaDe(api), [api]);
  const [pend, setPend] = useState(() => salida?.pendientes(atletaId) || []);
  const pendRef = useRef(pend);
  pendRef.current = pend;
  const [recien, setRecien] = useState([]);
  useEffect(() => {
    if (!salida) return undefined;
    setPend(salida.pendientes(atletaId));
    const quitar = salida.oir(() => setPend(salida.pendientes(atletaId)));
    const enviado = (e) => {
      if (e.detail?.atletaId !== atletaId) return;
      const x = pendRef.current.find((p) => p.cliente_id === e.detail.cliente_id);
      if (x) { setRecien((r) => [...r.filter((y) => y.cliente_id !== x.cliente_id), { ...x, estado: 'enviado' }]); sonarSi('enviado'); }
      recargar.current?.(true);
      alCambiar?.();
    };
    window.addEventListener('fbe-salida-enviado', enviado);
    salida.vaciar();
    return () => { quitar(); window.removeEventListener('fbe-salida-enviado', enviado); };
  }, [salida, atletaId]);
  useEffect(() => {
    salida?.confirmar(mensajes);
    if (!recien.length) return;
    const ids = new Set(mensajes.map((c) => c.cliente_id).filter(Boolean));
    if (recien.some((x) => ids.has(x.cliente_id))) setRecien((r) => r.filter((x) => !ids.has(x.cliente_id)));
  }, [mensajes]);
  // v0.56: y lo que se está subiendo (fotos, vídeos, PDF, notas de voz), con su progreso, antes de lo programado
  const vista = useMemo(() => {
    const base = conPendientes(mensajes, [...pend, ...recien], { perfil: miId, atletaId });
    if (!subidas.length) return base;
    const futuro = base.findIndex((c) => c.programado);
    const extra = subidas.map((x) => ({ id: `subida-${x.id}`, cliente_id: `subida-${x.id}`, atleta_id: atletaId, autor: yo, texto: x.texto || '', creado_en: x.creado_en,
      pendiente: true, subida: x, archivo: null, leido_en: null, reacciones: [], responde_a: x.respondeA || null }));
    return futuro < 0 ? [...base, ...extra] : [...base.slice(0, futuro), ...extra, ...base.slice(futuro)];
  }, [mensajes, pend, recien, subidas, miId, atletaId]);

  // Al momento: por Realtime (fbe-mensaje), tras cualquier escritura propia (fbe-cambio), al llegar una
  // notificación y, por si acaso, cada medio minuto mientras la pantalla está visible
  useEffect(() => {
    let t = null;
    const pronto = () => { clearTimeout(t); t = setTimeout(() => recargar.current?.(true), 250); };
    const cada = setInterval(() => { if (document.visibilityState === 'visible') recargar.current?.(true); }, 30000);
    const visible = () => { if (document.visibilityState === 'visible') pronto(); };
    for (const ev of ['fbe-mensaje', 'fbe-notificacion']) window.addEventListener(ev, pronto);
    document.addEventListener('visibilitychange', visible);
    return () => { clearTimeout(t); clearInterval(cada); for (const ev of ['fbe-mensaje', 'fbe-notificacion']) window.removeEventListener(ev, pronto); document.removeEventListener('visibilitychange', visible); };
  }, []);

  // v0.54: el separador «N MENSAJES SIN LEER», calculado una vez al abrir (antes de marcarlos leídos); se va al enviar
  const separador = useRef(undefined);
  if (separador.current === undefined && conv.datos) separador.current = separadorNoLeidos(conv.datos, yo);

  // Lo que escribió la otra parte queda leído al verlo: solo con la pantalla a la vista (un mensaje que llega
  // con la pestaña en segundo plano sigue sin leer hasta que vuelves)
  useEffect(() => {
    const marcar = () => {
      if (document.visibilityState !== 'visible') return;
      const ids = (conv.datos || []).filter((c) => c.autor !== yo && !c.leido_en).map((c) => c.id);
      if (ids.length) api.marcarLeidos(ids).then(() => alLeer?.()).catch(() => {});
    };
    marcar();
    document.addEventListener('visibilitychange', marcar);
    return () => document.removeEventListener('visibilitychange', marcar);
  }, [conv.datos]);

  // Al abrir, en el separador de los sin leer (si los hay) o abajo del todo; después, abajo al mandar algo y cuando
  // llega un mensaje estando ya cerca del final (si estás leyendo más arriba, no te mueve: lo cuenta el botón ⌄). Al
  // cargar mensajes anteriores (arriba), tampoco.
  const ultimo = vista.length ? vista[vista.length - 1] : null;
  const ultimoClave = ultimo ? ultimo.cliente_id || ultimo.id : null;
  const ultimoMio = ultimo ? ultimo.autor === yo : false;
  const primeraCarga = useRef(true);
  const ultimoPrevio = useRef(null);
  const cuantosPrevio = useRef(0);
  useLayoutEffect(() => {
    if (!datos) return;
    const doc = document.documentElement;
    // (v0.56) con lo guardado en el móvil, abajo del todo al momento; al llegar la base, ya en su sitio (los sin leer)
    if (primeraCarga.current && !conv.datos) { window.scrollTo(0, doc.scrollHeight); return; }
    if (primeraCarga.current) {
      primeraCarga.current = false;
      const sep = separador.current ? document.getElementById('chat-sin-leer') : null;
      if (sep) {
        const cab = document.querySelector('.cabecera');
        window.scrollTo(0, Math.max(0, sep.getBoundingClientRect().top + window.scrollY - (cab?.getBoundingClientRect().height || 0) - 12));
      } else window.scrollTo(0, doc.scrollHeight);
    } else if (ultimoClave !== ultimoPrevio.current) {
      const cerca = doc.scrollHeight - doc.scrollTop - window.innerHeight < 240;
      if (cerca || ultimoMio) window.scrollTo(0, doc.scrollHeight);
      else {
        const llegados = vista.slice(cuantosPrevio.current).filter((c) => c.autor !== yo);
        if (llegados.length) { primerNuevo.current ||= llegados[0].id; setNuevos((n) => n + llegados.length); }
      }
      // (v0.56) un tono suave por lo que acaba de llegar de la otra parte (nunca al abrir ni al cargar lo anterior)
      if (!ultimoMio && vista.slice(cuantosPrevio.current).some((c) => c.autor !== yo && !c.eliminado_en)) sonarSi('recibido');
      // Lo que acaba de llegar de la otra parte quita su «escribiendo…»
      if (!ultimoMio) setEscribe(false);
    }
    ultimoPrevio.current = ultimoClave;
    cuantosPrevio.current = vista.length;
  }, [ultimoClave, !!conv.datos, !!datos]);
  useLayoutEffect(() => { if (adjuntos.length) window.scrollTo(0, document.documentElement.scrollHeight); }, [adjuntos.length]);
  // v0.56: lo anterior se carga solo al llegar arriba y la pantalla se queda donde estaba (sin saltos): se guarda lo que
  // queda por debajo y, al llegar, se vuelve a poner ahí
  const ancla = useRef(null);
  const tope = useRef(null);
  const cargarAnteriores = () => {
    if (!hayMas || conv.cargando || ancla.current) return;
    ancla.current = document.documentElement.scrollHeight - window.scrollY;
    setLimite((l) => l + 200);
  };
  useLayoutEffect(() => {
    if (ancla.current == null || conv.cargando) return;
    const d = ancla.current;
    ancla.current = null;
    window.scrollTo(0, Math.max(0, document.documentElement.scrollHeight - d));
  }, [mensajes.length, conv.cargando]);
  useEffect(() => {
    const el = tope.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !primeraCarga.current) cargarAnteriores(); }, { rootMargin: '300px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hayMas, conv.cargando, !!datos]);
  // El final de la lista a la vista (sin escuchar el scroll)
  useEffect(() => {
    const el = fin.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => { setAbajo(e.isIntersecting); if (e.isIntersecting) { setNuevos(0); primerNuevo.current = null; } }, { rootMargin: '0px 0px 120px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [!!datos]);
  // Lo que mide la cabecera (y la barra del mensaje fijado): ahí se quedan la píldora del día y lo fijado
  useLayoutEffect(() => {
    const cab = document.querySelector('.cabecera');
    const el = raiz.current;
    if (!cab || !el) return undefined;
    const poner = () => el.style.setProperty('--chat-sep-top', `${Math.round(cab.getBoundingClientRect().height)}px`);
    poner();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(poner) : null;
    ro?.observe(cab);
    return () => ro?.disconnect();
  }, [!!seleccion]);
  const irAbajo = () => {
    const destino = primerNuevo.current && document.getElementById(`msg-${primerNuevo.current}`);
    setNuevos(0); primerNuevo.current = null;
    const sep = !destino && separador.current ? document.getElementById('chat-sin-leer') : null;
    const objetivo = destino || (sep && sep.getBoundingClientRect().top > window.innerHeight ? sep : null);
    if (objetivo) objetivo.scrollIntoView({ block: 'center', behavior: sinMovimiento() ? 'auto' : 'smooth' });
    else window.scrollTo({ top: document.documentElement.scrollHeight, behavior: sinMovimiento() ? 'auto' : 'smooth' });
  };

  // v0.55: la píldora del día arriba mientras se desplaza (se va al parar). Solo transform y opacidad; lo que se mide va
  // en un requestAnimationFrame y el estado solo cambia cuando cambia el día o aparece/se va
  const [pildora, setPildora] = useState({ dia: '', ver: false });
  useEffect(() => {
    let raf = 0, t = null;
    const medir = () => {
      raf = 0;
      const tope = (document.querySelector('.cabecera')?.getBoundingClientRect().bottom || 0) + (document.querySelector('.chat-fijado')?.getBoundingClientRect().height || 0) + 8;
      let dia = '';
      for (const s of document.querySelectorAll('.chat-lista .chat-dia')) { if (s.getBoundingClientRect().top <= tope) dia = s.dataset.dia || ''; else break; }
      setPildora((p) => (p.dia === dia && p.ver === !!dia ? p : { dia, ver: !!dia }));
      clearTimeout(t);
      t = setTimeout(() => setPildora((p) => (p.ver ? { ...p, ver: false } : p)), 1300);
    };
    const al = () => { if (!raf) raf = requestAnimationFrame(medir); };
    window.addEventListener('scroll', al, { passive: true });
    return () => { window.removeEventListener('scroll', al); cancelAnimationFrame(raf); clearTimeout(t); };
  }, []);

  // v0.55: el cuadro de escribir, pegado encima del teclado del móvil (visualViewport: lo que tapa el teclado se pone
  // en --teclado y la barra sube eso); si estabas abajo del todo, sigues abajo al abrirse
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const raizDoc = document.documentElement;
    let raf = 0;
    const poner = () => {
      raf = 0;
      // (lo que tapa menos de 80 px es la barra del navegador o un pellizco, no el teclado)
      const medida = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      const tapa = medida > 80 && vv.scale <= 1.01 ? medida : 0;
      const estaba = abajoRef.current;
      raizDoc.style.setProperty('--teclado', `${tapa}px`);
      if (tapa) raizDoc.dataset.teclado = ''; else delete raizDoc.dataset.teclado;
      if (estaba) requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight));
    };
    const al = () => { if (!raf) raf = requestAnimationFrame(poner); };
    vv.addEventListener('resize', al);
    vv.addEventListener('scroll', al);
    return () => { vv.removeEventListener('resize', al); vv.removeEventListener('scroll', al); cancelAnimationFrame(raf); raizDoc.style.removeProperty('--teclado'); delete raizDoc.dataset.teclado; };
  }, []);

  // v0.54: ir a un mensaje (una cita, un destacado, la búsqueda): se desplaza a él y lo resalta un momento. Si es más
  // antiguo que lo cargado, se cargan los anteriores (hasta encontrarlo)
  const salto = useRef(null);
  const tResalte = useRef(null);
  function irA(id, { resaltar = true } = {}) {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      salto.current = null;
      el.scrollIntoView({ block: 'center', behavior: sinMovimiento() ? 'auto' : 'smooth' });
      el.focus({ preventScroll: true });
      if (resaltar) { setResaltada(id); clearTimeout(tResalte.current); tResalte.current = setTimeout(() => setResaltada(null), 1800); }
      return true;
    }
    if (hayMas && (!salto.current || salto.current.intentos < 6)) {
      salto.current = { id, resaltar, intentos: (salto.current?.id === id ? salto.current.intentos : 0) + 1 };
      setLimite((l) => l + 400);
      return false;
    }
    salto.current = null;
    aviso('Ese mensaje ya no está en el chat');
    return false;
  }
  useEffect(() => { if (salto.current && conv.datos && !conv.cargando) { const s = salto.current; setTimeout(() => irA(s.id, { resaltar: s.resaltar }), 0); } }, [conv.datos]);
  useEffect(() => () => clearTimeout(tResalte.current), []);
  // Al abrir desde la búsqueda de la lista de conversaciones: directo a ese mensaje
  const saltoInicial = useRef(saltarA);
  useEffect(() => { if (saltoInicial.current && conv.datos) { const id = saltoInicial.current; saltoInicial.current = null; setTimeout(() => irA(id), 80); } }, [!!conv.datos]);

  // v0.54: buscar en el chat (de lo más reciente a lo más antiguo, como WhatsApp); al llegar a lo más antiguo
  // cargado, carga los anteriores
  // (v0.56) también por tipo (fotos, vídeos, enlaces, documentos, notas de voz), con o sin texto
  const encontrados = useMemo(() => {
    if (!buscando) return [];
    if (!filtroTipo) return coincidencias(mensajes, consulta).reverse();
    const delTipo = porTipo(mensajes, filtroTipo);
    if (consulta.trim().length < 2) return delTipo;
    const conTexto = new Set(coincidencias(mensajes, consulta));
    return delTipo.filter((id) => conTexto.has(id));
  }, [buscando, mensajes, consulta, filtroTipo]);
  const pos = actualId ? encontrados.indexOf(actualId) : -1;
  const masAntiguos = useRef(false);
  useEffect(() => { setActualId(encontrados[0] || null); }, [consulta, buscando, filtroTipo]);
  useEffect(() => {
    if (masAntiguos.current && !conv.cargando) {
      masAntiguos.current = false;
      const i = encontrados.indexOf(actualId);
      if (i >= 0 && encontrados[i + 1]) setActualId(encontrados[i + 1]);
    }
  }, [encontrados.length, conv.cargando]);
  useEffect(() => { if (actualId) setTimeout(() => irA(actualId, { resaltar: false }), 0); }, [actualId]);
  const anterior = () => {
    if (pos >= 0 && pos + 1 < encontrados.length) setActualId(encontrados[pos + 1]);
    else if (hayMas) { masAntiguos.current = true; setLimite((l) => l + 400); }
  };
  const siguiente = () => { if (pos > 0) setActualId(encontrados[pos - 1]); };
  const abrirBusqueda = () => { setHoja(null); setSeleccion(null); setBuscando(true); setTimeout(() => inputBusqueda.current?.focus(), 0); };
  const cerrarBusqueda = () => { setBuscando(false); setConsulta(''); setActualId(null); setFiltroTipo(null); };
  // v0.56: ir a una fecha (el calendario de la búsqueda): el primer mensaje de ese día (o del siguiente que tenga); si es
  // más antiguo que lo cargado, se carga hasta ahí
  const fechaPendiente = useRef(null);
  async function irAFecha(fecha) {
    if (!fecha) return;
    const id = primeroDesde(mensajes, fecha, (iso) => aISO(new Date(iso)));
    const primero = mensajes[0];
    if (hayMas && (!primero || aISO(new Date(primero.creado_en)) > fecha)) {
      try {
        const n = await api.mensajesDesde(atletaId, new Date(`${fecha}T00:00:00`).toISOString());
        fechaPendiente.current = fecha;
        setLimite((l) => Math.max(l, n + 50));
        return;
      } catch { /* con lo cargado */ }
    }
    if (id) irA(id); else aviso('No hay mensajes desde ese día');
  }
  useEffect(() => { if (fechaPendiente.current && conv.datos && !conv.cargando) { const f = fechaPendiente.current; fechaPendiente.current = null; setTimeout(() => irAFecha(f), 0); } }, [conv.datos, conv.cargando]);
  // v0.56: Ctrl/Cmd+F busca en el chat (en lugar de en la página) y Escape cierra la búsqueda
  useEffect(() => {
    const tecla = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'f' || e.key === 'F') && !document.querySelector('[aria-modal="true"]')) { e.preventDefault(); abrirBusqueda(); return; }
      if (e.key === 'Escape' && buscando && !document.querySelector('[aria-modal="true"]') && !e.defaultPrevented) { e.preventDefault(); cerrarBusqueda(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [buscando]);
  const contador = consulta.trim().length < 2 && !filtroTipo ? '' : encontrados.length ? `${pos + 1} de ${encontrados.length}${hayMas ? '+' : ''}` : hayMas ? 'Sin resultados aquí' : 'Sin resultados';

  // v0.54: «escribiendo…», «en línea» y «últ. vez» (canal privado de la conversación). «Mostrar cuándo estoy en línea»
  // apagado: ni se comparte la mía ni se ve la del otro (lo impone también la base)
  const [rtVersion, setRtVersion] = useState(0);
  const [miVisible, setMiVisible] = useState(true);
  const [escribe, setEscribe] = useState(false);
  const [enLinea, setEnLinea] = useState(false);
  const [minuto, setMinuto] = useState(0);
  const canal = useRef(null);
  useEffect(() => {
    const ev = () => setRtVersion((v) => v + 1);
    window.addEventListener('fbe-presencia', ev);
    const t = setInterval(() => { if (document.visibilityState === 'visible') setMinuto((m) => m + 1); }, 60000);
    return () => { window.removeEventListener('fbe-presencia', ev); clearInterval(t); };
  }, []);
  useEffect(() => { let vivo = true; api.miPresencia().then((p) => vivo && setMiVisible(p.visible !== false)).catch(() => {}); return () => { vivo = false; }; }, [rtVersion]);
  useEffect(() => {
    let t = null;
    const h = api.canalChat(atletaId, {
      rol: yo, visible: miVisible,
      alEscribir: (q) => { if (q === yo) return; setEscribe(true); clearTimeout(t); t = setTimeout(() => setEscribe(false), 5000); },
      alPresencia: (x) => setEnLinea(!!x),
      alCambio: () => { recargar.current?.(true); fijado.recargar(true); },
      alEstado: (ok) => { if (!ok) { setEscribe(false); setEnLinea(false); } },
    });
    canal.current = h;
    return () => { clearTimeout(t); h?.soltar(); canal.current = null; setEnLinea(false); setEscribe(false); };
  }, [atletaId, miVisible, rtVersion]);
  const ultima = useCarga(() => (!miVisible || (yo === 'coach' && !perfilOtro) ? Promise.resolve(null) : api.ultimaConexion(yo === 'coach' ? perfilOtro : null)), [perfilOtro, miVisible, rtVersion, minuto]);
  const estado = estadoConexion({ escribiendo: escribe, enLinea: enLinea && miVisible, ultima: ultima.datos });
  const avisarCambio = () => { canal.current?.cambio(); alCambiar?.(); };

  // v0.55: el mensaje fijado (lo ven los dos; lo pone el coach), si esta conversación está silenciada, y el nombre del
  // coach (para «Info del contacto» del atleta)
  const fijado = useCarga(() => api.fijado(atletaId), [atletaId]);
  const silencios = useCarga(() => api.silencios(), [atletaId]);
  const silencio = silencios.datos?.[atletaId] || null;
  // v0.56: los tonos, si toca (con el chat a la vista, los sonidos activados y la conversación sin silenciar)
  const silencioRef = useRef(null);
  silencioRef.current = silencio;
  const sonarSi = (tipo) => { if (debeSonar({ activado: leerAjustes().sonidosChat !== false, silenciada: silenciado(silencioRef.current), visible: document.visibilityState === 'visible' })) sonar(tipo); };
  const nombreDelCoach = useCarga(() => (yo === 'atleta' ? api.nombreCoach() : Promise.resolve(null)), [yo]);

  // v0.54: el borrador de esta conversación se queda en el móvil (no lo que se está editando)
  useEffect(() => {
    if (editando) return undefined;
    const t = setTimeout(() => guardarBorrador(almacen(), miId, atletaId, texto, { respondeA: citando?.id || null }), 400);
    return () => clearTimeout(t);
  }, [texto, citando?.id, !!editando]);
  // La cita del borrador, cuando ya está cargado su mensaje
  const citaBorrador = useRef(borradorInicial?.respondeA || null);
  useEffect(() => { if (citaBorrador.current && porId[citaBorrador.current]) { setCitando(porId[citaBorrador.current]); citaBorrador.current = null; } }, [porId]);
  useLayoutEffect(() => { if (area.current && texto) ajustarAlto(area.current); }, []);

  // Las fotos, los vídeos y (v0.55) los PDF: varios a la vez, hasta 10, con un pie para todos
  useEffect(() => () => { for (const a of adjuntosRef.current) if (a.url) URL.revokeObjectURL(a.url); }, []);
  const adjuntosRef = useRef([]);
  adjuntosRef.current = adjuntos;
  function anadir(nuevosArchivos) {
    if (!nuevosArchivos.length) return;
    if (editando) { setEditando(null); setTexto(''); }
    setAdjuntos((xs) => [...xs, ...nuevosArchivos].slice(0, MAX_FOTOS));
    setEmojis(false);
    area.current?.focus();
  }
  // v0.56: de la galería, la cámara, el PDF, al pegar (Ctrl/Cmd+V) o al soltarlos encima: fotos, vídeos y PDF, con las
  // mismas comprobaciones de siempre (tipo, tamaño, que un PDF lo sea de verdad), hasta 10 a la vez
  async function anadirArchivos(archivos) {
    const nuevas = [];
    for (const f of archivos) {
      if (adjuntos.length + nuevas.length >= MAX_FOTOS) { aviso(`Como mucho ${MAX_FOTOS} a la vez`, 'error'); break; }
      const pdf = f.type === 'application/pdf' || (!f.type && /\.pdf$/i.test(f.name || ''));
      if (pdf) {
        if (f.size > PDF_MAX_MB * 1024 * 1024) { aviso(`El PDF pesa más de ${PDF_MAX_MB} MB`, 'error'); continue; }
        let cab;
        try { cab = new Uint8Array(await f.slice(0, 1024).arrayBuffer()); } catch { cab = new Uint8Array(); }
        if (!esPdf(cab)) { aviso(`«${nombreSeguroPdf(f.name)}» no es un PDF`, 'error'); continue; }
        let paginas = null;
        try { if (f.size <= 8 * 1048576) paginas = paginasPdf(new TextDecoder('latin1').decode(await f.arrayBuffer())); } catch { /* sin páginas */ }
        const doc = f.type === 'application/pdf' ? f : new File([f], f.name, { type: 'application/pdf' });
        nuevas.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, archivo: doc, esPdf: true, paginas, nombre: nombreSeguroPdf(f.name) });
        continue;
      }
      if (!/^(image|video)\//.test(f.type || '')) { aviso('Solo fotos, vídeos y PDF', 'error'); continue; }
      if (f.size > LIMITE_ARCHIVO_MB * 1024 * 1024) { aviso(`Pesa más de ${LIMITE_ARCHIVO_MB} MB. Graba solo la serie (unos 30 segundos).`, 'error'); continue; }
      let url = null;
      try { url = URL.createObjectURL(f); } catch { /* */ }
      nuevas.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, archivo: f, url, esVideo: /^video\//.test(f.type || '') });
    }
    anadir(nuevas);
  }
  function elegido(e) {
    const archivos = [...(e.currentTarget.files || [])];
    e.currentTarget.value = '';
    if (!archivos.length) return;
    const malos = archivos.filter((f) => !/^(image|video)\//.test(f.type || ''));
    if (malos.length) aviso('Solo fotos y vídeos', 'error');
    anadirArchivos(archivos.filter((f) => /^(image|video)\//.test(f.type || '')));
  }
  async function elegidoDoc(e) {
    const archivos = [...(e.currentTarget.files || [])];
    e.currentTarget.value = '';
    const malos = archivos.filter((f) => f.type && f.type !== 'application/pdf');
    for (const f of malos) aviso(`«${nombreSeguroPdf(f.name)}» no es un PDF`, 'error');
    await anadirArchivos(archivos.filter((f) => !f.type || f.type === 'application/pdf').map((f) => (f.type ? f : new File([f], f.name || 'documento.pdf', { type: 'application/pdf' }))));
  }
  // v0.56: pegar una captura (o un archivo) en el cuadro de escribir y soltar archivos encima del chat (ordenador)
  const pegar = (e) => {
    const fs = [...(e.clipboardData?.files || [])];
    if (!fs.length || editando) return;
    e.preventDefault();
    anadirArchivos(fs);
  };
  const conArchivos = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  const arrastrar = {
    onDragEnter: (e) => { if (conArchivos(e) && !editando) { e.preventDefault(); setSoltando(true); } },
    onDragOver: (e) => { if (conArchivos(e) && !editando) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } },
    onDragLeave: (e) => { if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget)) setSoltando(false); },
    onDrop: (e) => { if (!conArchivos(e)) return; e.preventDefault(); setSoltando(false); if (!editando) anadirArchivos([...(e.dataTransfer.files || [])]); },
  };
  // v0.56: lo que llega desde «Compartir» (Android) para esta conversación: a la bandeja de adjuntos, sin enviarlo
  useEffect(() => {
    if (archivosIniciales?.length) anadirArchivos(archivosIniciales);
    const coger = () => { const fs = tomarParaChat(atletaId); if (fs?.length) anadirArchivos(fs); };
    coger();
    window.addEventListener('fbe-compartidos', coger);
    return () => window.removeEventListener('fbe-compartidos', coger);
  }, [archivosIniciales, atletaId]);
  const quitarAdjunto = (a) => { if (a.url) URL.revokeObjectURL(a.url); setAdjuntos((xs) => xs.filter((x) => x.id !== a.id)); };

  // Un mensaje de una sesión, un check-in o un vídeo del diario se contesta en ese mismo hilo (lo pide la base)
  const enElChat = (c) => !c || (!c.sesion_id && !c.checkin_id && (!c.archivo_id || c.adjunto));
  const limpiarCompositor = () => {
    setTexto(''); setCitando(null); setEditando(null); setRapidasFuera(false);
    borrarBorrador(almacen(), miId, atletaId);
    if (area.current) area.current.style.height = 'auto';
  };

  async function enviar(e) {
    e?.preventDefault();
    if (enviando) return;
    const t = texto.trim();
    if (editando) {
      if (!t) return;
      setEnviando(true);
      try {
        await api.editarMensaje(editando.id, t);
        limpiarCompositor();
        await conv.recargar(true); avisarCambio();
      } catch (err) { aviso(err.message, 'error'); } finally { setEnviando(false); }
      return;
    }
    if ((!t && !adjuntos.length)) return;
    const cita = citando;
    // v0.55: el texto suelto, a la bandeja de salida: sale en el chat al momento (⏱) y se envía (o espera la cobertura)
    if (!adjuntos.length && enElChat(cita) && salida) {
      try { salida.encolar({ atletaId, autor: yo, texto: t, respondeA: cita?.id || null }); } catch (err) { aviso(err.message, 'error'); return; }
      limpiarCompositor();
      separador.current = null;
      requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight));
      return;
    }
    // v0.56: las fotos, los vídeos y los PDF salen al momento como burbujas con su progreso (y «Cancelar»); el pie va con
    // la primera (como WhatsApp con varias fotos), y la cita también
    if (adjuntos.length) {
      const pendientes = [...adjuntos];
      const citaId = cita && enElChat(cita) ? cita.id : null;
      setAdjuntos([]);
      limpiarCompositor();
      separador.current = null;
      encolarSubidas(pendientes.map((a, i) => ({ ...a, texto: i === 0 ? t : '', respondeA: i === 0 ? citaId : null, enDiario: a.esVideo && yo === 'atleta' && enDiario, hd })));
      return;
    }
    setEnviando(true);
    try {
      if (cita && !enElChat(cita)) {
        await api.comentar({ atletaId, sesionId: cita.sesion_id, checkinId: cita.checkin_id, archivoId: cita.archivo_id, texto: t, autor: yo, respondeA: cita.id });
      } else {
        await api.enviarMensaje(atletaId, { texto: t, autor: yo, respondeA: cita?.id || null });
      }
      limpiarCompositor();
      separador.current = null;
      await conv.recargar(true);
      alCambiar?.();
    } catch (err) { aviso(err.message, 'error'); } finally { setEnviando(false); setProgreso(null); }
  }

  // v0.48: el coach programa el mensaje para más tarde (solo texto)
  async function enviarProgramado({ enviarEn }) {
    const t = texto.trim();
    try {
      await api.enviarMensaje(atletaId, { texto: t, autor: yo, enviarEn, respondeA: citando && enElChat(citando) ? citando.id : null });
      limpiarCompositor(); setProgramar(null);
      aviso(`Programado para el ${fmtProgramado(enviarEn)}`);
      await conv.recargar(true); alCambiar?.();
    } catch (err) { aviso(err.message, 'error'); }
  }
  async function reprogramar(c, cambios) {
    try {
      await api.reprogramarMensaje(c.id, cambios);
      setProgramar(null);
      aviso(cambios.enviarEn ? `Ahora sale el ${fmtProgramado(cambios.enviarEn)}` : 'Enviado');
      await conv.recargar(true); alCambiar?.();
    } catch (err) { aviso(err.message, 'error'); }
  }

  // v0.56: la cola de lo que se sube (una a una, en orden): cada una con su progreso y «Cancelar». Sin cobertura, o si la
  // base lo rechaza, se queda con «!» para reintentarla o quitarla. Las fotos se reducen antes (sin EXIF), salvo las ya
  // editadas (ya lo están).
  const subidasRef = useRef([]);
  subidasRef.current = subidas;
  const senales = useRef(new Map());
  const subiendo = useRef(false);
  const cambiarSubida = (id, c) => setSubidas((xs) => xs.map((x) => (x.id === id ? { ...x, ...c } : x)));
  const quitarSubida = (id) => { const x = subidasRef.current.find((y) => y.id === id); if (x?.url && !x.compartidaUrl) URL.revokeObjectURL(x.url); setSubidas((xs) => xs.filter((y) => y.id !== id)); };
  function encolarSubidas(items) {
    const ahora = Date.now();
    const nuevas = items.map((a, i) => ({ id: `${ahora}-${i}-${Math.random().toString(36).slice(2, 8)}`, archivo: a.archivo, url: a.url || null, esVideo: !!a.esVideo, esPdf: !!a.esPdf,
      esAudio: !!a.esAudio, nombre: a.nombre || null, paginas: a.paginas || null, seg: a.seg || null, onda: a.onda || null, editada: !!a.editada, hd: !!a.hd, enDiario: !!a.enDiario,
      texto: a.texto || '', respondeA: a.respondeA || null, progreso: 0, estado: 'espera', error: null, creado_en: new Date(ahora + i).toISOString() }));
    subidasRef.current = [...subidasRef.current, ...nuevas];
    setSubidas(subidasRef.current);
    requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight));
    procesarSubidas();
  }
  async function procesarSubidas() {
    if (subiendo.current) return;
    subiendo.current = true;
    try {
      for (;;) {
        const x = subidasRef.current.find((y) => y.estado === 'espera');
        if (!x) break;
        cambiarSubida(x.id, { estado: 'subiendo', progreso: 0.02 });
        subidasRef.current = subidasRef.current.map((y) => (y.id === x.id ? { ...y, estado: 'subiendo' } : y));
        const senal = {};
        senales.current.set(x.id, senal);
        try {
          let archivo = x.archivo, poster = null, duracion_seg = x.seg;
          if (!x.esVideo && !x.esPdf && !x.esAudio && !x.editada && comprimible(archivo.type)) archivo = (await prepararFoto(archivo, { hd: x.hd })).archivo;
          if (x.esVideo) { const cap = await capturarPoster(archivo).catch(() => null); poster = cap?.poster || null; duracion_seg = cap?.duracion ?? null; }
          if (!subidasRef.current.some((y) => y.id === x.id)) continue; // cancelada mientras se preparaba
          await api.enviarMensaje(atletaId, { texto: x.texto, archivo, autor: yo, enDiario: x.enDiario, poster, duracion_seg, paginas: x.paginas, onda: x.onda, respondeA: x.respondeA,
            alProgreso: (p) => cambiarSubida(x.id, { progreso: Math.max(0.02, Math.min(1, p)) }), senal });
          quitarSubida(x.id);
          subidasRef.current = subidasRef.current.filter((y) => y.id !== x.id);
          sonarSi('enviado');
          await conv.recargar(true);
          alCambiar?.();
        } catch (err) {
          if (err?.cancelado || !subidasRef.current.some((y) => y.id === x.id)) continue;
          const m = err?.sinConexion ? 'Sin conexión: se ha quedado sin enviar' : err?.message || 'No se ha podido enviar';
          cambiarSubida(x.id, { estado: 'fallo', error: m });
          subidasRef.current = subidasRef.current.map((y) => (y.id === x.id ? { ...y, estado: 'fallo' } : y));
        } finally { senales.current.delete(x.id); }
      }
    } finally { subiendo.current = false; }
  }
  const cancelarSubida = (id) => {
    const senal = senales.current.get(id);
    subidasRef.current = subidasRef.current.filter((y) => y.id !== id);
    quitarSubida(id);
    if (senal) senal.cancelada = true;
    try { senal?.abortar?.(); } catch { /* */ }
    aviso('Envío cancelado');
  };
  const reintentarSubida = (id) => { cambiarSubida(id, { estado: 'espera', error: null, progreso: 0 }); subidasRef.current = subidasRef.current.map((y) => (y.id === id ? { ...y, estado: 'espera', error: null } : y)); procesarSubidas(); };

  // v0.56: las notas de voz (hasta un minuto); al enviarla, sale como las fotos: al momento, con su progreso
  const grab = useGrabadora({ alError: (m) => aviso(m, 'error') });
  const enviarVoz = (x) => {
    const archivo = new File([x.blob], `nota-de-voz.${x.ext}`, { type: x.tipo });
    let url = null;
    try { url = URL.createObjectURL(x.blob); } catch { /* */ }
    grab.descartar();
    const citaId = citando && enElChat(citando) ? citando.id : null;
    setCitando(null);
    encolarSubidas([{ archivo, url, esAudio: true, seg: x.seg, onda: x.onda, respondeA: citaId }]);
  };

  // v0.54: lo del menú de cada mensaje
  const responder = (c) => { setMenu(null); setEditando(null); setSeleccion(null); setCitando(c); setTimeout(() => area.current?.focus(), 0); };
  const editar = (c) => { setMenu(null); setCitando(null); setAdjuntos([]); setEditando(c); setTexto(c.texto); setTimeout(() => { if (area.current) { ajustarAlto(area.current); area.current.focus(); } }, 0); };
  async function reaccionar(c, emoji) {
    setMenu(null);
    try { await api.reaccionarMensaje(c.id, emoji); await conv.recargar(true); avisarCambio(); } catch (err) { aviso(err.message, 'error'); }
  }
  async function destacar(cs, si = null) {
    setMenu(null);
    const lista = Array.isArray(cs) ? cs : [cs];
    const poner = si ?? !lista.every((c) => c.destacado);
    try {
      for (const c of lista) if (!!c.destacado !== poner) await api.destacar(c.id, poner);
      aviso(poner ? (lista.length > 1 ? `${lista.length} destacados` : 'Destacado') : 'Ya no está destacado');
      setSeleccion(null);
      await conv.recargar(true);
    } catch (err) { aviso(err.message, 'error'); }
  }
  async function confirmarEliminar(cs) {
    let pendienteStorage = false, cancelados = 0, n = 0;
    try {
      for (const c of cs) {
        const r = await api.eliminarMensaje(c);
        n++;
        if (r.estado === 'cancelado') cancelados++;
        if (yo === 'coach' && r.almacenamiento === 'pendiente') pendienteStorage = true;
        if (citando?.id === c.id) setCitando(null);
      }
      // (si el coach no ha podido borrar la foto de Storage, lo dice: queda en la cola y se reintenta)
      if (pendienteStorage) aviso('No se pudo borrar el archivo del almacenamiento; se reintentará', 'error');
      else aviso(cancelados && cancelados === n ? 'Envío cancelado' : n > 1 ? `${n} mensajes eliminados` : 'Mensaje eliminado');
    } catch (err) { aviso(err.message, 'error'); }
    setEliminar(null); setSeleccion(null);
    await conv.recargar(true); fijado.recargar(true); avisarCambio();
  }
  const copiarMensaje = async (c) => { setMenu(null); aviso((await copiar(c.texto)) ? 'Copiado' : 'No se ha podido copiar'); };
  async function fijarCon(c, duracion) {
    setFijar(null);
    try { await api.fijarMensaje(atletaId, c.id, duracion); aviso(`Fijado ${DURACIONES_FIJAR.find(([k]) => k === duracion)?.[1] || ''}`.trim()); await fijado.recargar(true); avisarCambio(); }
    catch (err) { aviso(err.message, 'error'); }
  }
  async function desfijar() {
    setMenu(null);
    try { await api.desfijarMensaje(atletaId); aviso('Ya no está fijado'); await fijado.recargar(true); avisarCambio(); } catch (err) { aviso(err.message, 'error'); }
  }
  async function silenciar(opcion) {
    setHoja((h) => (h === 'silenciar' ? null : h));
    try { await api.silenciar(atletaId, opcion); aviso(opcion ? 'Silenciado: no te sonará nada de esta conversación' : 'Notificaciones activadas'); await silencios.recargar(true); alCambiar?.(); }
    catch (err) { aviso(err.message, 'error'); }
  }

  // v0.55: seleccionar varios (desde el menú de un mensaje); Escape sale
  const elegidos = seleccion ? vista.filter((c) => seleccion.has(c.id)) : [];
  const acciones = accionesSeleccion(elegidos, yo);
  const alternar = (c) => setSeleccion((s) => { const n = new Set(s || []); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; });
  const seleccionar = (c) => { setMenu(null); setBuscando(false); setSeleccion(new Set([c.id])); };
  useEffect(() => {
    if (!seleccion) return undefined;
    const tecla = (e) => { if (e.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) { e.preventDefault(); setSeleccion(null); } };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [!!seleccion]);
  async function copiarSeleccion() {
    const t = textoCopiado(elegidos, nombreDe);
    aviso((await copiar(t)) ? (elegidos.length > 1 ? `${elegidos.length} mensajes copiados` : 'Copiado') : 'No se ha podido copiar');
    setSeleccion(null);
  }

  // v0.55: lo que no salió: reintentar o eliminar (de la bandeja)
  const reintentar = (c) => { setFallido(null); salida?.reintentar(c.cliente_id); };
  const descartar = (c) => { setFallido(null); salida?.descartar(c.cliente_id); };

  // v0.55: emojis donde está el cursor (y a los recientes)
  const cursor = useRef({ a: null, b: null });
  const recordarCursor = () => { const el = area.current; if (el) cursor.current = { a: el.selectionStart, b: el.selectionEnd }; };
  function ponerEmoji(e) {
    const { texto: t, cursor: k } = insertarEnTexto(texto, e, cursor.current.a, cursor.current.b);
    setTexto(t);
    cursor.current = { a: k, b: k };
    apuntarReciente(almacen(), e);
    setTimeout(() => { const el = area.current; if (el) { ajustarAlto(el); if (enOrdenador()) { el.focus(); el.setSelectionRange(k, k); } } }, 0);
  }
  const alternarEmojis = () => {
    if (emojis) { setEmojis(false); setTimeout(() => area.current?.focus(), 0); return; }
    recordarCursor();
    // En el móvil, el panel ocupa el sitio del teclado: el cuadro deja de tener el foco y el teclado se va
    if (!enOrdenador()) area.current?.blur();
    setEmojis(true);
    requestAnimationFrame(() => { if (abajoRef.current) window.scrollTo(0, document.documentElement.scrollHeight); });
  };

  // v0.54: respuestas rápidas con «/» al principio (el coach)
  const qRapida = yo === 'coach' && !editando && !rapidasFuera ? consultaRapida(texto) : null;
  useEffect(() => { if (qRapida !== null && rapidas === null) api.respuestasGuardadas().then(setRapidas).catch(() => setRapidas([])); }, [qRapida !== null]);
  const filtradas = qRapida !== null ? filtrarRapidas(rapidas || [], qRapida).slice(0, 5) : [];
  const verRapidas = qRapida !== null && filtradas.length > 0;
  useEffect(() => { setIRapida(0); }, [qRapida]);
  const rellenar = (t) => String(t || '').replace(/\{nombre\}/g, primerNombre);
  const elegirRapida = (r) => { setTexto(rellenar(r.texto)); setTimeout(() => { if (area.current) { ajustarAlto(area.current); area.current.focus(); } }, 0); };
  function teclaArea(e) {
    if (verRapidas) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIRapida((i) => (i + 1) % filtradas.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIRapida((i) => (i - 1 + filtradas.length) % filtradas.length); return; }
      if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) { e.preventDefault(); elegirRapida(filtradas[Math.min(iRapida, filtradas.length - 1)]); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setRapidasFuera(true); return; }
    }
    if (e.key === 'Escape' && emojis) { e.preventDefault(); setEmojis(false); return; }
    if (e.key === 'Escape' && (editando || citando)) { e.preventDefault(); if (editando) limpiarCompositor(); else setCitando(null); return; }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { enviar(e); return; }
    // (v0.56) ↑ con el cuadro vacío: editar tu último mensaje (si aún se puede, en sus 15 minutos)
    if (e.key === 'ArrowUp' && !texto && !adjuntos.length && !editando && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
      const c = ultimoEditable(vista, yo, (x) => puedeEditar(x, yo) && !x.encuesta);
      if (c) { e.preventDefault(); editar(c); }
      return;
    }
    // (v0.55) En el ordenador, Enter envía (Mayús+Enter salta de línea); en el móvil, Enter salta de línea
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.isComposing && enOrdenador()) { e.preventDefault(); enviar(e); }
  }

  // Separadores por día (v0.55: «Hoy», «Ayer», «martes», «12 de octubre»)
  const grupos = [];
  for (const c of vista) {
    const clave = aISO(new Date(c.creado_en));
    const g = grupos[grupos.length - 1];
    if (g && g.clave === clave) g.items.push(c); else grupos.push({ clave, dia: etiquetaDia(c.creado_en), items: [c] });
  }
  const etiqueta = (c) => {
    if (!c.contexto) return null;
    if (c.contexto.tipo === 'sesion') return `En ${c.contexto.nombre}`;
    if (c.contexto.tipo === 'checkin') return yo === 'coach' ? 'En su check-in' : 'En tu check-in';
    if (!c.contexto.nombre) return null;
    return yo === 'coach' ? `En su ${c.contexto.nombre}` : `En tu ${c.contexto.nombre}`;
  };
  // v0.49: los mensajes seguidos de la misma persona van juntos (v0.55: el pico, en el primero de cada grupo)
  const agrupado = Object.fromEntries(gruposChat(vista.map((c) => ({ ...c, contexto: etiqueta(c) ? c.contexto : null })), { dia: (iso) => aISO(new Date(iso)) }).map((x) => [x.id, x]));
  const sep = separador.current;
  // v0.55: lo nuevo desde que se abrió el chat entra deslizándose (lo que ya estaba, o lo anterior que se carga, no)
  const conocidos = useRef(null);
  const abiertoEn = useRef(Date.now());
  if (!conocidos.current && conv.datos) conocidos.current = new Set(vista.map((c) => c.cliente_id || c.id));
  const esNueva = (c) => !!conocidos.current && !conocidos.current.has(c.cliente_id || c.id) && (c.pendiente || c.fallo || Date.parse(c.creado_en) >= abiertoEn.current - 5000);

  // v0.55: las fotos y los vídeos del chat, en orden, para el visor
  const medios = useMemo(() => mediosDe(mensajes).filter((m) => m.tipo === 'foto' || m.tipo === 'video').reverse().map((m) => ({ mensaje: porId[m.mensajeId], archivo: m.archivo })), [mensajes]);
  const abrirMedio = (c) => {
    if (!c.archivo) return;
    if (c.archivo.tipo === 'video_tecnica' || c.archivo.tipo === 'foto_progreso') { setAbierto(c); return; }
    const i = medios.findIndex((m) => m.archivo.id === c.archivo.id);
    if (i >= 0) setVisor({ inicio: i }); else setAbierto(c);
  };
  const cuentas = useMemo(() => {
    const ms = mediosDe(mensajes);
    return { medios: ms.filter((m) => m.tipo === 'foto' || m.tipo === 'video').length, docs: ms.filter((m) => m.tipo === 'documento' || m.tipo === 'archivo').length, enlaces: enlacesDe(mensajes).length };
  }, [mensajes]);
  const vigente = fijadoVigente(fijado.datos) ? fijado.datos : null;

  const herramientas = (
    <>
      <button type="button" class="btn btn-icono plano" aria-label="Buscar en el chat" onClick={abrirBusqueda}><Icono n="buscar" /></button>
      <button type="button" class="btn btn-icono plano" aria-label="Más opciones del chat" onClick={() => setHoja('menu')}><Icono n="opciones" /></button>
    </>
  );
  const barraBusqueda = (
    <div class="chat-busqueda" role="search">
      <input ref={inputBusqueda} class="entrada" type="search" aria-label="Buscar en el chat" placeholder="Buscar en el chat…" value={consulta}
        onInput={(e) => setConsulta(e.currentTarget.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) siguiente(); else anterior(); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarBusqueda(); } }} />
      <span class="mini secundario num chat-busqueda-n" role="status">{contador}</span>
      <button type="button" class="btn btn-icono plano" aria-label="Coincidencia anterior (más antigua)" disabled={!encontrados.length || (pos + 1 >= encontrados.length && !hayMas)} onClick={anterior}><Icono n="arriba" /></button>
      <button type="button" class="btn btn-icono plano" aria-label="Coincidencia siguiente (más reciente)" disabled={pos <= 0} onClick={siguiente}><Icono n="abajo" /></button>
      <button type="button" class="btn btn-icono plano" aria-label="Cerrar la búsqueda" onClick={cerrarBusqueda}><Icono n="cerrar" /></button>
    </div>
  );
  // v0.56: debajo de la búsqueda, buscar por tipo e ir a una fecha
  const filtrosBusqueda = buscando && (
    <div class="chat-busqueda-filtros" role="group" aria-label="Buscar por tipo o ir a una fecha">
      <div class="chat-busqueda-tipos" role="radiogroup" aria-label="Qué buscar">
        {[[null, 'Todo'], ...TIPOS_BUSQUEDA].map(([k, t]) => (
          <button key={k || 'todo'} type="button" role="radio" aria-checked={filtroTipo === k ? 'true' : 'false'} class={`btn btn-peq chip ${filtroTipo === k ? 'activo' : ''}`} onClick={() => setFiltroTipo(k)}>{t}</button>
        ))}
      </div>
      <label class="chat-busqueda-fecha"><Icono n="calendario" /><span class="sr">Ir a una fecha</span>
        <input type="date" class="entrada" max={aISO(new Date())} aria-label="Ir a una fecha" onChange={(e) => irAFecha(e.currentTarget.value)} /></label>
    </div>
  );
  // v0.55: con mensajes seleccionados, la cabecera dice cuántos y qué se puede hacer con ellos
  const barraSeleccion = seleccion && (
    <div class="chat-seleccion" role="toolbar" aria-label="Mensajes seleccionados">
      <button type="button" class="btn btn-icono plano" aria-label="Salir de la selección" onClick={() => setSeleccion(null)}><Icono n="cerrar" /></button>
      <strong class="chat-seleccion-n" role="status">{elegidos.length === 1 ? '1 seleccionado' : `${elegidos.length} seleccionados`}</strong>
      <button type="button" class="btn btn-icono plano" aria-label="Copiar" disabled={!acciones.copiar} onClick={copiarSeleccion}><Icono n="copiar" /></button>
      <button type="button" class="btn btn-icono plano" aria-label={elegidos.length && elegidos.every((c) => c.destacado) ? 'Quitar destacado' : 'Destacar'} disabled={!acciones.destacar} onClick={() => destacar(elegidos)}><Icono n="estrella" /></button>
      <button type="button" class={`btn btn-icono plano ${acciones.eliminar.ok ? '' : 'no-disponible'}`} aria-label={acciones.eliminar.ok ? 'Eliminar para todos' : `Eliminar para todos (no disponible: ${acciones.eliminar.motivo})`}
        aria-disabled={acciones.eliminar.ok ? undefined : 'true'} title={acciones.eliminar.motivo || 'Eliminar para todos'}
        onClick={() => (acciones.eliminar.ok ? setEliminar(elegidos) : aviso(acciones.eliminar.motivo))}><Icono n="basura" /></button>
      {yo === 'coach' && <button type="button" class="btn btn-icono plano" aria-label="Reenviar" disabled={!acciones.reenviar} onClick={() => setReenviar(elegidos)}><Icono n="reenviar" /></button>}
    </div>
  );
  const abrirContacto = () => { setHoja('contacto'); };

  const conTexto = !!texto.trim();
  const mostrarEnviar = conTexto || adjuntos.length > 0 || !!editando;
  const grabandoVoz = grab.estado === 'grabando' || grab.estado === 'pidiendo';
  return (
    <div class={`chat ${fondo && cabecera ? 'con-fondo' : ''} ${seleccion ? 'seleccionando' : ''} ${emojis ? 'con-emojis' : ''} ${soltando ? 'soltando' : ''}`} ref={raiz} aria-label={`Chat con ${otro}`} {...arrastrar}>
      {soltando && <div class="chat-soltar" aria-hidden="true"><Icono n="clip" /><strong>Suelta aquí para adjuntarlo</strong><span class="peq">Fotos, vídeos o PDF</span></div>}
      {fondo && cabecera && <FondoChat />}
      {cabecera ? (
        <header class={`cabecera cabecera-chat ${buscando ? 'buscando' : ''} ${seleccion ? 'eligiendo' : ''}`}>
          {seleccion ? <><h1 class="sr">{cabecera.titulo}</h1>{barraSeleccion}</> : buscando ? <><h1 class="sr">{cabecera.titulo}</h1>{barraBusqueda}</> : (
            <>
              {cabecera.izquierda}
              <div class="titulo cabecera-contacto">
                <h1><button type="button" class="cabecera-contacto-boton" aria-haspopup="dialog" aria-label={`${cabecera.titulo}: info del contacto`} onClick={abrirContacto}>{cabecera.titulo}</button></h1>
                <div class={`sub ${escribe ? 'escribiendo' : ''}`}>{silenciado(silencio) && <Icono n="silencio" titulo="Silenciada" class="sub-silencio" />}{estado || cabecera.sub || ''}</div>
              </div>
              {cabecera.derecha}
              {herramientas}
            </>
          )}
        </header>
      ) : (
        <div class="chat-herramientas">
          {seleccion ? barraSeleccion : buscando ? barraBusqueda : <><span class={`peq secundario chat-estado ${escribe ? 'escribiendo' : ''}`}>{estado || ''}</span>{herramientas}</>}
        </div>
      )}
      {filtrosBusqueda}
      {desdeCache && conv.error && <p class="chat-sin-red mini" role="status"><Icono n="sinred" /> Sin conexión: esto es lo guardado en este móvil</p>}
      {vigente && (
        <div class="chat-fijado">
          <button type="button" class="chat-fijado-ir" onClick={() => irA(vigente.comentario_id)} aria-label={`Mensaje fijado: ${extractoCita(porId[vigente.comentario_id] || vigente.mensaje, 80)}. Ir al mensaje`}>
            <Icono n="chincheta" /><span class="pila-xs"><strong class="mini">Mensaje fijado</strong><span class="peq chat-fijado-texto">{extractoCita(porId[vigente.comentario_id] || vigente.mensaje, 120)}</span></span>
          </button>
          {yo === 'coach' && <button type="button" class="btn btn-icono plano" aria-label="Desfijar el mensaje" onClick={desfijar}><Icono n="cerrar" /></button>}
        </div>
      )}
      <div class="chat-lista" ref={lista}>
        <span ref={tope} class="chat-tope" aria-hidden="true" />
        {hayMas && conv.datos && (
          <button type="button" class="btn btn-peq chat-anteriores" disabled={conv.cargando} onClick={cargarAnteriores}><Icono n="arriba" /> {conv.cargando ? 'Cargando los anteriores…' : 'Ver mensajes anteriores'}</button>
        )}
        {!datos && (conv.cargando || !conv.error) ? <Cargando texto="Cargando los mensajes" /> : !vista.length ? (
          <div class="chat-vacio">
            <Vacio ilustracion="mensajes" titulo={yo === 'coach' ? `Tu conversación con ${primerNombre}` : `Tu conversación con ${nombreCoach}`}
              accion={<button type="button" class="btn btn-peq" onClick={() => raiz.current?.querySelector('.chat-area')?.focus()}><Icono n="editar" /> Escribir el primer mensaje</button>}>
              {yo === 'coach'
                ? 'Para lo que no es de una sesión concreta: le llega al momento, y lo de sus sesiones, check-ins y vídeos también sale aquí.'
                : 'Para lo que no es de una sesión concreta (un viaje, una molestia, una duda): tu coach lo recibe al momento, también fotos, vídeos y PDF.'}
            </Vacio>
          </div>
        ) : grupos.map((g) => (
          <section key={g.clave} class="chat-dia" data-dia={g.dia} aria-label={g.dia}>
            <span class="chat-sep">{g.dia}</span>
            {g.items.map((c) => (
              <Fragment key={c.cliente_id || c.id}>
                {sep?.id === c.id && <div id="chat-sin-leer" class="chat-sin-leer" role="separator" aria-label={textoNoLeidos(sep.n).toLowerCase()}><span>{textoNoLeidos(sep.n)}</span></div>}
                <Burbuja c={c} yo={yo} miId={miId} gr={agrupado[c.id] || { primero: true, ultimo: true }} etq={etiqueta(c)} citado={c.responde_a ? porId[c.responde_a] || null : null}
                  nombreDe={nombreDe} consulta={buscando ? consulta : ''} actual={buscando && actualId === c.id} resaltada={resaltada === c.id} hayMas={hayMas}
                  nueva={esNueva(c)} fijado={vigente?.comentario_id === c.id}
                  seleccionando={!!seleccion} seleccionado={!!seleccion?.has(c.id)} alAlternar={() => alternar(c)}
                  alMenu={() => (c.fallo ? setFallido(c) : c.pendiente ? null : setMenu(c))} alResponder={() => responder(c)} alIrA={irA} alAbrir={() => abrirMedio(c)}
                  alContexto={() => (c.contexto.tipo === 'archivo' ? setAbierto(c) : irContexto?.(c.contexto))} alReacciones={() => setQuien(c)} alFallo={() => setFallido(c)}
                  alCancelarSubida={cancelarSubida} alReintentarSubida={reintentarSubida} alRecargar={() => { conv.recargar(true); avisarCambio(); }} />
              </Fragment>
            ))}
          </section>
        ))}
        {modo === 'demo' && !conv.cargando && <p class="mini terciario chat-nota">En la demo no hay nadie al otro lado: lo que escribas se queda aquí.</p>}
        <span ref={fin} class="chat-fin" aria-hidden="true" />
      </div>
      <span class={`chat-dia-flotante ${pildora.ver ? 'visible' : ''}`} aria-hidden="true">{pildora.dia}</span>
      {!abajo && !!conv.datos && vista.length > 0 && (
        <button type="button" class="chat-abajo" onClick={irAbajo} aria-label={nuevos ? `${nuevos} ${nuevos === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}: ir al primero` : 'Ir al final del chat'}>
          <Icono n="abajo" />{nuevos > 0 && <span class="chat-abajo-n num" aria-hidden="true">{nuevos > 99 ? '99+' : nuevos}</span>}
        </button>
      )}
      <p class="sr" aria-live="polite">{nuevos && !abajo ? 'Hay mensajes nuevos más abajo' : ''}</p>

      <form class="chat-barra" ref={barra} onSubmit={enviar}>
        <div class="chat-barra-in">
          {verRapidas && (
            <ul class="chat-rapidas" id="chat-rapidas" role="listbox" aria-label="Respuestas rápidas">
              {filtradas.map((r, i) => (
                <li key={r.id} id={`rapida-${r.id}`} role="option" aria-selected={i === iRapida ? 'true' : 'false'} class={i === iRapida ? 'activa' : ''}
                  onMouseDown={(e) => e.preventDefault()} onClick={() => elegirRapida(r)}>
                  <strong>{r.titulo}</strong><span class="mini secundario">{rellenar(r.texto).slice(0, 90)}{r.texto.length > 90 ? '…' : ''}</span>
                </li>
              ))}
            </ul>
          )}
          {(citando || editando) && (
            <div class={`chat-cita-compositor ${editando ? 'editando' : ''}`}>
              <Icono n={editando ? 'editar' : 'mensaje'} />
              <div class="pila-xs">
                <strong class="peq">{editando ? 'Editando el mensaje' : citando.autor === yo ? 'Respondiendo a tu mensaje' : `Respondiendo a ${nombreDe(citando.autor).replace(/^Tu coach$/, 'tu coach')}`}</strong>
                <span class="mini secundario chat-cita-texto">{extractoCita(editando || citando)}</span>
              </div>
              <button type="button" class="btn btn-icono plano" aria-label={editando ? 'Cancelar la edición' : 'Cancelar la respuesta'} onClick={() => (editando ? limpiarCompositor() : setCitando(null))}><Icono n="cerrar" /></button>
            </div>
          )}
          {adjuntos.length > 0 && (
            <div class="chat-adjunto">
              <div class="chat-adjunto-tira">
                <div class="chat-adjunto-lista" role="list" aria-label={`${adjuntos.length} ${adjuntos.length === 1 ? 'archivo' : 'archivos'} para enviar`}>
                  {adjuntos.map((a, i) => (
                    <div key={a.id} class={`chat-adjunto-item ${a.esPdf ? 'es-pdf' : ''}`} role="listitem">
                      {a.esPdf ? <span class="chat-adjunto-pdf" title={a.nombre}><Icono n="documento" /><span class="mini">PDF</span></span>
                        : a.url && (a.esVideo ? <video src={a.url} muted playsInline preload="metadata" /> : <img src={a.url} alt="" />)}
                      {a.esVideo && <span class="chat-adjunto-video" aria-hidden="true"><Icono n="video" /></span>}
                      {!a.esVideo && !a.esPdf && comprimible(a.archivo.type) && <button type="button" class="chat-adjunto-editar" aria-label={`Editar la foto ${i + 1} (recortar, girar, dibujar, texto)`} onClick={() => setEditarFoto(a)}><Icono n="editar" /></button>}
                      <button type="button" class="chat-adjunto-quitar" aria-label={`Quitar ${a.esPdf ? `el documento ${a.nombre}` : a.esVideo ? 'el vídeo' : 'la foto'} ${i + 1}`} onClick={() => quitarAdjunto(a)}><Icono n="cerrar" /></button>
                    </div>
                  ))}
                </div>
                {adjuntos.length < MAX_FOTOS && <button type="button" class="chat-adjunto-mas" aria-label="Añadir más archivos" onClick={() => setHoja('adjuntar')}><Icono n="mas" /></button>}
              </div>
              <div class="pila-xs chat-adjunto-pie">
                <strong class="peq">{textoAdjuntos(adjuntos)} <span class="terciario">({mb(adjuntos.reduce((t, a) => t + a.archivo.size, 0))} MB{adjuntos.length > 1 ? `, máx. ${MAX_FOTOS}` : ''})</span></strong>
                {adjuntos.length === 1 && adjuntos[0].esPdf && <span class="mini secundario">{[adjuntos[0].nombre, adjuntos[0].paginas ? `${adjuntos[0].paginas} ${adjuntos[0].paginas === 1 ? 'página' : 'páginas'}` : null].filter(Boolean).join(' · ')}</span>}
                {adjuntos.some((a) => a.esVideo) && yo === 'atleta' && (
                  <label class="casilla mini"><input type="checkbox" checked={enDiario} onChange={(e) => setEnDiario(e.currentTarget.checked)} /><span>{adjuntos.filter((a) => a.esVideo).length > 1 ? 'Guardar los vídeos en mi diario como vídeos de técnica (tu coach los revisa)' : 'Guardarlo en mi diario como vídeo de técnica (tu coach lo revisa)'}</span></label>
                )}
                {adjuntos.some((a) => !a.esVideo && !a.esPdf) && (
                  <button type="button" class={`btn btn-peq chat-hd ${hd ? 'activo' : ''}`} aria-pressed={hd ? 'true' : 'false'} onClick={() => setHd((v) => !v)}
                    title={hd ? 'Las fotos salen en HD (más grandes)' : 'Las fotos salen reducidas (pesan menos)'}><Icono n="hd" /> HD</button>
                )}
              </div>
            </div>
          )}
          {grab.estado === 'revisar' ? <PanelRevisar g={grab} alEnviar={enviarVoz} /> : (
          <div class="chat-escribir">
            <input ref={input} type="file" accept="image/*,video/*" multiple class="sr" tabIndex={-1} aria-label="Elegir fotos o vídeos de la galería" onChange={elegido} />
            <input ref={inputCamara} type="file" accept="video/*,image/*" capture="environment" class="sr" tabIndex={-1} aria-label="Hacer una foto o un vídeo" onChange={elegido} />
            <input ref={inputDoc} type="file" accept="application/pdf,.pdf" multiple class="sr" tabIndex={-1} aria-label="Elegir un PDF" onChange={elegidoDoc} />
            {grabandoVoz ? <PanelGrabando g={grab} /> : (
            <div class="chat-campo">
              <BotonEmojis abierto={emojis} alCambiar={alternarEmojis} />
              <textarea ref={area} class="area chat-area" rows={1} aria-label={editando ? 'Editar el mensaje' : yo === 'coach' ? `Escribir a ${primerNombre}` : 'Escribir a tu coach'}
                aria-autocomplete={yo === 'coach' ? 'list' : undefined} aria-controls={verRapidas ? 'chat-rapidas' : undefined}
                aria-activedescendant={verRapidas && filtradas[iRapida] ? `rapida-${filtradas[iRapida].id}` : undefined}
                placeholder={adjuntos.length ? 'Pie (opcional)…' : yo === 'coach' ? `Escribe a ${primerNombre}… («/» para tus respuestas)` : 'Escribe a tu coach…'} value={texto}
                onFocus={() => { if (emojis && !enOrdenador()) setEmojis(false); }} onSelect={recordarCursor} onKeyUp={recordarCursor} onClick={recordarCursor}
                onInput={(e) => { setTexto(e.currentTarget.value); setRapidasFuera(false); ajustarAlto(e.currentTarget); recordarCursor(); if (e.currentTarget.value.trim()) canal.current?.escribiendo(yo); }}
                onKeyDown={teclaArea} onPaste={pegar} />
              <button type="button" class="btn btn-icono plano" aria-label="Adjuntar" aria-haspopup="dialog" disabled={!!editando} onClick={() => setHoja('adjuntar')}><Icono n="clip" /></button>
              {!conTexto && !adjuntos.length && !editando && <button type="button" class="btn btn-icono plano chat-camara" aria-label="Cámara" onClick={() => inputCamara.current?.click()}><Icono n="camara" /></button>}
              {yo === 'coach' && conTexto && !adjuntos.length && !editando && <button type="button" class="btn btn-icono plano" aria-label="Programar envío" title="Programar envío" onClick={() => setProgramar({ nuevo: true })}><Icono n="reloj" /></button>}
            </div>
            )}
            {mostrarEnviar ? <button class="btn btn-primario btn-icono chat-enviar" aria-label={editando ? 'Guardar el cambio' : 'Enviar'} disabled={enviando || (!conTexto && !adjuntos.length)}><Icono n={editando ? 'hecho' : 'enviar'} /></button>
              : !(grabandoVoz && grab.bloqueada) && <BotonMicro g={grab} />}
          </div>
          )}
          {emojis && <PanelEmojis alElegir={ponerEmoji} />}
        </div>
      </form>

      {abierto && (
        <Hoja titulo={abierto.archivo?.tipo === 'adjunto' ? (/^image\//.test(abierto.archivo.mime || '') ? 'Foto' : 'Vídeo') : abierto.archivo?.tipo === 'foto_progreso' ? 'Foto de progreso' : 'Vídeo de técnica'} alCerrar={() => setAbierto(null)} ancho={760}>
          {abierto.archivo && <VerArchivo archivo={abierto.archivo} />}
          {abierto.archivo?.tipo !== 'adjunto' && <Hilo atletaId={atletaId} archivoId={abierto.archivoId} nombreAtleta={nombreAtleta} alCambiar={() => { conv.recargar(true); alCambiar?.(); }} vacio="Sin comentarios en este vídeo." />}
        </Hoja>
      )}
      {visor && medios.length > 0 && (
        <Visor medios={medios} inicio={visor.inicio} nombreDe={nombreDe} alCerrar={() => setVisor(null)} alResponder={(c) => responder(c)}
          alReenviar={yo === 'coach' ? (c) => setReenviar([c]) : null} puedeReenviar={(c) => reenviable(c, yo)} />
      )}
      {programar?.nuevo && <HojaProgramar titulo={`Programar el mensaje a ${primerNombre}`} alCerrar={() => setProgramar(null)} alGuardar={enviarProgramado} />}
      {programar && !programar.nuevo && (
        <HojaProgramar titulo="Cambiar el mensaje programado" inicial={programar.enviar_en} conTexto texto={programar.texto} boton="Guardar"
          alCerrar={() => setProgramar(null)} alGuardar={({ enviarEn, texto: t }) => reprogramar(programar, { enviarEn, texto: t })}
          alEnviarYa={({ texto: t }) => reprogramar(programar, { enviarEn: null, texto: t })} />
      )}
      {guardadas && (
        <HojaRespuestas nombre={primerNombre} texto={texto} alCerrar={() => setGuardadas(false)}
          alElegir={(t) => { setTexto((x) => (x.trim() ? `${x.trimEnd()}\n\n${t}` : t)); setGuardadas(false); area.current?.focus(); }} />
      )}
      {hoja === 'adjuntar' && (
        <Hoja titulo="Adjuntar" alCerrar={() => setHoja(null)}>
          <ul class="lista hoja-acciones chat-adjuntar">
            <li><button type="button" class="accion-fila" onClick={() => { setHoja(null); inputCamara.current?.click(); }}><span class="ico"><Icono n="camara" /></span><span class="pila-xs"><strong>Cámara</strong><span class="peq secundario">Hacer una foto o un vídeo</span></span><span /></button></li>
            <li><button type="button" class="accion-fila" onClick={() => { setHoja(null); input.current?.click(); }}><span class="ico"><Icono n="imagen" /></span><span class="pila-xs"><strong>Galería</strong><span class="peq secundario">Fotos y vídeos (hasta {MAX_FOTOS} a la vez)</span></span><span /></button></li>
            <li><button type="button" class="accion-fila" onClick={() => { setHoja(null); inputDoc.current?.click(); }}><span class="ico"><Icono n="documento" /></span><span class="pila-xs"><strong>Documento</strong><span class="peq secundario">Un PDF de hasta {PDF_MAX_MB} MB</span></span><span /></button></li>
            {yo === 'coach' && <li><button type="button" class="accion-fila" onClick={() => setHoja('encuesta')}><span class="ico"><Icono n="encuesta" /></span><span class="pila-xs"><strong>Encuesta</strong><span class="peq secundario">Una pregunta con opciones (de 2 a 12)</span></span><span /></button></li>}
            {yo === 'coach' && <li><button type="button" class="accion-fila" onClick={() => { setHoja(null); setGuardadas(true); }}><span class="ico"><Icono n="rayo" /></span><span class="pila-xs"><strong>Respuestas guardadas</strong></span><span /></button></li>}
          </ul>
        </Hoja>
      )}
      {menu && (
        <HojaMensaje c={menu} yo={yo} miId={miId} fijado={vigente?.comentario_id === menu.id} rapidas={rapidasEmoji} alElegirReacciones={() => { setMenu(null); setHoja('reacciones'); }} alCerrar={() => setMenu(null)} alResponder={() => responder(menu)} alReaccionar={(e) => reaccionar(menu, e)}
          alCopiar={() => copiarMensaje(menu)} alEditar={() => editar(menu)} alEliminar={() => { setMenu(null); setEliminar([menu]); }} alDestacar={() => destacar(menu)}
          alInfo={() => { setMenu(null); setInfo(menu); }} alCambiar={() => { setMenu(null); setProgramar(menu); }} alSeleccionar={() => seleccionar(menu)}
          alFijar={() => { setMenu(null); setFijar(menu); }} alDesfijar={desfijar} alReenviar={() => { setMenu(null); setReenviar([menu]); }} />
      )}
      {fijar && (
        <Hoja titulo="Fijar el mensaje" alCerrar={() => setFijar(null)}>
          <p class="peq secundario">Sale arriba del chat, para los dos, hasta que lo quites o pase el tiempo{vigente ? ' (sustituye al que está fijado ahora)' : ''}.</p>
          <ul class="lista hoja-acciones">
            {DURACIONES_FIJAR.map(([k, t]) => <li key={k}><button type="button" class="accion-fila" onClick={() => fijarCon(fijar, k)}><span class="ico"><Icono n="chincheta" /></span><span class="pila-xs"><strong>{t}</strong></span><span /></button></li>)}
          </ul>
        </Hoja>
      )}
      {fallido && (
        <Hoja titulo="No se ha enviado" alCerrar={() => setFallido(null)}>
          <p class="peq secundario">{fallido.error || 'El mensaje no ha podido salir.'}</p>
          <div class="fila-envolver">
            <button type="button" class="btn btn-primario" onClick={() => reintentar(fallido)}><Icono n="reiniciar" /> Reintentar</button>
            <button type="button" class="btn btn-peligro" onClick={() => descartar(fallido)}><Icono n="basura" /> Eliminar</button>
          </div>
        </Hoja>
      )}
      {eliminar && (() => {
        const prog = eliminar.length === 1 && eliminar[0].programado;
        return (
          <Hoja titulo={prog ? 'Cancelar el envío' : '¿Eliminar para todos?'} alCerrar={() => setEliminar(null)}>
            <p class="secundario">{prog ? `No le llegará a ${primerNombre}: el mensaje se borra.` : `${eliminar.length > 1 ? `Los ${eliminar.length} mensajes se quitarán` : 'Se quitará'} también del chat de ${otro}. En su lugar quedará «Se eliminó este mensaje».`}</p>
            <div class="fila-envolver">
              <button type="button" class="btn btn-peligro" onClick={() => confirmarEliminar(eliminar)}><Icono n="basura" /> {prog ? 'Cancelar el envío' : 'Eliminar para todos'}</button>
              <button type="button" class="btn plano" onClick={() => setEliminar(null)}>{prog ? 'Mantenerlo' : 'No eliminar'}</button>
            </div>
          </Hoja>
        );
      })()}
      {info && (
        <Hoja titulo="Info del mensaje" alCerrar={() => setInfo(null)}>
          <p class="peq secundario chat-info-texto">{extractoCita(porId[info.id] || info)}</p>
          <dl class="chat-info">
            {infoMensaje(porId[info.id] || info, Date.now(), { horaLeido: miVisible }).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </Hoja>
      )}
      {quien && (
        <Hoja titulo="Reacciones" alCerrar={() => setQuien(null)}>
          <ul class="lista chat-quien">
            {(porId[quien.id]?.reacciones || []).map((r) => (
              <li key={r.usuario_id} class="panel-pad separa">
                <span><span class="chat-quien-emoji" aria-hidden="true">{r.emoji}</span> {r.usuario_id === miId ? 'Tú' : yo === 'coach' ? primerNombre : 'Tu coach'}<span class="sr">: {NOMBRE_EMOJI[r.emoji] || r.emoji}</span></span>
                {r.usuario_id === miId && <button type="button" class="btn btn-peq" onClick={() => { setQuien(null); reaccionar(quien, r.emoji); }}>Quitar la mía</button>}
              </li>
            ))}
          </ul>
        </Hoja>
      )}
      {hoja === 'menu' && (
        <Hoja titulo="Opciones del chat" alCerrar={() => setHoja(null)}>
          <ul class="lista hoja-acciones">
            <li><button type="button" class="accion-fila" onClick={() => setHoja('contacto')}><span class="ico"><Icono n="perfil" /></span><span class="pila-xs"><strong>Info del contacto</strong></span><Icono n="derecha" class="cola" /></button></li>
            <li><button type="button" class="accion-fila" onClick={abrirBusqueda}><span class="ico"><Icono n="buscar" /></span><span class="pila-xs"><strong>Buscar en el chat</strong></span><Icono n="derecha" class="cola" /></button></li>
            <li><button type="button" class="accion-fila" onClick={() => setHoja('destacados')}><span class="ico"><Icono n="estrella" /></span><span class="pila-xs"><strong>Mensajes destacados</strong><span class="peq secundario">Los que has marcado con la estrella (solo los ves tú)</span></span><Icono n="derecha" class="cola" /></button></li>
            <li><button type="button" class="accion-fila" onClick={() => { setPestArchivos('multimedia'); setHoja('archivos'); }}><span class="ico"><Icono n="imagen" /></span><span class="pila-xs"><strong>Archivos, enlaces y documentos</strong></span><Icono n="derecha" class="cola" /></button></li>
            <li><button type="button" class="accion-fila" onClick={() => (silenciado(silencio) ? silenciar(null) : setHoja('silenciar'))}><span class="ico"><Icono n={silenciado(silencio) ? 'campana' : 'silencio'} /></span><span class="pila-xs"><strong>{silenciado(silencio) ? 'Activar las notificaciones' : 'Silenciar notificaciones'}</strong>{silenciado(silencio) && <span class="peq secundario">{textoSilencio(silencio)}</span>}</span><span /></button></li>
          </ul>
        </Hoja>
      )}
      {hoja === 'silenciar' && <HojaSilenciar alCerrar={() => setHoja(null)} alElegir={silenciar} />}
      {hoja === 'contacto' && (
        <InfoContacto yo={yo} nombre={yo === 'coach' ? nombreAtleta : nombreDelCoach.datos || 'Tu coach'} foto={fotoOtro} estado={estado} cuentas={cuentas} silencio={silencio}
          alSilenciar={silenciar} alCerrar={() => setHoja(null)} alBuscar={abrirBusqueda} alDestacados={() => setHoja('destacados')}
          alArchivos={(p) => { setPestArchivos(p); setHoja('archivos'); }} alFondo={(v) => setFondo(v !== 'liso')}
          alVerFicha={yo === 'coach' && cabecera?.verFicha ? () => { setHoja(null); cabecera.verFicha(); } : null} />
      )}
      {hoja === 'destacados' && <HojaDestacados atletaId={atletaId} nombreDe={nombreDe} alCerrar={() => setHoja(null)} alIr={(id) => { setHoja(null); setTimeout(() => irA(id), 60); }} />}
      {hoja === 'archivos' && <HojaArchivosChat mensajes={mensajes} hayMas={hayMas} pestana={pestArchivos} yo={yo} alCerrar={() => setHoja(null)} alAbrir={(c) => { setHoja(null); abrirMedio(c); }}
        alIr={(id) => { setHoja(null); setTimeout(() => irA(id), 60); }} alMas={() => setLimite((l) => l + 400)} />}
      {reenviar && <HojaReenviar mensajes={reenviar} alCerrar={() => setReenviar(null)} alHecho={() => { setReenviar(null); setSeleccion(null); alCambiar?.(); }} />}
      {editarFoto && (
        <EditorFoto archivo={editarFoto.archivo} hd={hd} alCerrar={() => setEditarFoto(null)}
          alListo={(f) => {
            const a = editarFoto;
            let url = null;
            try { url = URL.createObjectURL(f); } catch { /* */ }
            if (a.url) URL.revokeObjectURL(a.url);
            setAdjuntos((xs) => xs.map((x) => (x.id === a.id ? { ...x, archivo: f, url, editada: true } : x)));
            setEditarFoto(null);
          }} />
      )}
      {hoja === 'encuesta' && <HojaEncuesta atletaId={atletaId} para={primerNombre} alCerrar={() => setHoja(null)} alEnviada={() => { setHoja(null); conv.recargar(true); alCambiar?.(); sonarSi('enviado'); }} />}
      {hoja === 'reacciones' && <HojaReaccionesRapidas uid={miId} alCerrar={() => { setRapidasEmoji(leerReacciones(almacen(), miId)); setHoja(null); }} />}
    </div>
  );
}

function ajustarAlto(el) {
  // Hasta unas 6 líneas; después, se desplaza dentro
  const max = Math.round(parseFloat(getComputedStyle(el).lineHeight || '20') * 6 + 20) || 150;
  el.style.height = 'auto';
  el.style.height = `${Math.min(max, el.scrollHeight)}px`;
}
const textoAdjuntos = (xs) => {
  if (xs.length === 1) return xs[0].esPdf ? 'Documento PDF' : xs[0].esVideo ? 'Vídeo' : 'Foto';
  if (xs.every((a) => a.esPdf)) return `${xs.length} documentos`;
  if (xs.some((a) => a.esPdf)) return `${xs.length} archivos`;
  return `${xs.length} fotos y vídeos`;
};

// Los ✓ de un mensaje propio: ⏱ (sale), ✓ (en la base), ✓✓ gris (le ha llegado), ✓✓ azul (lo ha leído)
function Ticks({ estado: e }) {
  if (!e) return null;
  if (e === 'pendiente') return <span class="visto pendiente" role="img" aria-label="enviando" title="Enviando"><Icono n="reloj" /></span>;
  if (e === 'fallo') return null;
  return <span class={`visto ${e === 'leido' ? 'leido' : e === 'entregado' ? 'entregado' : ''}`} title={TEXTO_ESTADO[e][0].toUpperCase() + TEXTO_ESTADO[e].slice(1)} aria-label={e === 'leido' ? 'visto' : TEXTO_ESTADO[e]}>{e === 'enviado' ? '✓' : '✓✓'}</span>;
}

// Una burbuja: deslizarla a la derecha responde (dedo o lápiz; touch-action: pan-y deja el desplazamiento vertical al
// navegador); mantenerla pulsada, el botón derecho, «Más opciones» o Mayús+F10 abren su menú. v0.55: la hora y los ✓
// dentro, abajo a la derecha (el texto deja su hueco), el pico en la primera del grupo, 1 a 3 emojis en grande y sin
// burbuja, «Leer más», «↪ Reenviado», los PDF y, al seleccionar varios, se marcan al tocarlas.
function Burbuja({ c, yo, miId, gr, etq, citado, nombreDe, consulta, actual, resaltada, hayMas, nueva, fijado, seleccionando, seleccionado, alAlternar, alMenu, alResponder, alIrA, alAbrir, alContexto, alReacciones, alFallo,
  alCancelarSubida, alReintentarSubida, alRecargar }) {
  const mio = c.autor === yo;
  const eliminado = !!c.eliminado_en;
  const ref = useRef(null);
  const gesto = useRef(null);
  const suprimirClic = useRef(false);
  const [entero, setEntero] = useState(false);
  const responder = !eliminado && !c.programado && !c.pendiente && !c.fallo && !seleccionando;
  const conMenu = (!eliminado || mio) && !c.pendiente;
  const reacciones = resumenReacciones(c.reacciones, miId);
  const est = estadoEnvio(c, yo);
  const emojis = !c.archivo && !citado && !etq && !eliminado && !c.responde_a && !c.reenviado ? soloEmojis(c.texto) : 0;
  const largo = !eliminado && !entero && !esMarcador(c) ? recortarLargo(c.texto) : { texto: c.texto, cortado: false };
  const esDoc = c.archivo && (c.archivo.tipo === 'documento' || c.archivo.mime === 'application/pdf');
  // (v0.56) una nota de voz, una encuesta o algo que aún se está subiendo
  const esVoz = !!c.archivo && (c.archivo.tipo === 'audio' || /^audio\//.test(c.archivo.mime || ''));
  const conEncuesta = !!c.encuesta && !eliminado;
  const sub = c.subida || null;
  const soloMedio = !!c.archivo && !esDoc && !esVoz && esMarcador(c) && !eliminado;
  const soltar = () => {
    const g = gesto.current;
    gesto.current = null;
    if (!g) return;
    clearTimeout(g.t);
    // El clic que sigue a soltar (tras deslizar o mantener pulsado) no cuenta; el siguiente, sí
    if (suprimirClic.current) setTimeout(() => { suprimirClic.current = false; }, 350);
    const el = ref.current;
    if (g.activo && el) {
      el.classList.remove('arrastrando');
      el.style.transform = '';
      el.style.removeProperty('--deslizado');
      if (g.dx > 56) alResponder();
    }
  };
  const bajar = (e) => {
    if (e.button > 0 || !conMenu || seleccionando) return;
    if (e.target.closest('a, input, textarea')) return;
    const tipo = e.pointerType || 'mouse';
    gesto.current = { x0: e.clientX, y0: e.clientY, tipo, dx: 0, activo: false, largo: false, umbral: false, id: e.pointerId,
      t: tipo === 'mouse' ? null : setTimeout(() => { if (gesto.current) { gesto.current.largo = true; suprimirClic.current = true; vibrar('toque'); alMenu(); } }, 480) };
  };
  const mover = (e) => {
    const g = gesto.current;
    if (!g) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimeout(g.t);
    if (!g.activo && g.tipo !== 'mouse' && responder && dx > 12 && Math.abs(dy) < 20) {
      g.activo = true;
      ref.current?.classList.add('arrastrando');
      try { ref.current?.setPointerCapture?.(g.id); } catch { /* */ }
    }
    if (g.activo) {
      g.dx = Math.max(0, dx);
      const x = Math.min(80, g.dx);
      ref.current.style.transform = `translateX(${x}px)`;
      ref.current.style.setProperty('--deslizado', String(Math.min(1, x / 56)));
      // (v0.55) al llegar al punto en que suelta y responde, un toque suave (con «Vibración al tocar»)
      if (!g.umbral && g.dx > 56) { g.umbral = true; vibrar('toque'); ref.current.classList.add('umbral'); }
      else if (g.umbral && g.dx <= 56) { g.umbral = false; ref.current.classList.remove('umbral'); }
      suprimirClic.current = true;
    }
  };
  const tecla = (e) => { if (conMenu && !seleccionando && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) { e.preventDefault(); alMenu(); } };
  const clases = ['burbuja', mio ? 'mia' : 'suya', c.archivo || (sub && !sub.esAudio && !sub.esPdf) ? 'con-medio' : '', esVoz || sub?.esAudio ? 'con-voz' : '', conEncuesta ? 'con-encuesta' : '', sub ? 'subiendo' : '', soloMedio ? 'solo-medio' : '', c.programado ? 'programada' : '', gr.primero ? 'cola' : 'sigue sin-cola',
    eliminado ? 'eliminada' : '', reacciones.length ? 'con-reacciones' : '', actual ? 'actual' : '', resaltada ? 'resaltada' : '', emojis ? `solo-emojis emojis-${emojis}` : '',
    nueva ? 'nueva' : '', c.pendiente ? 'pendiente' : '', c.fallo ? 'fallida' : '', seleccionado ? 'seleccionada' : ''].filter(Boolean).join(' ');
  const hora = horaDe(c.creado_en);
  const pieDentro = (
    <>
      {fijado && <span class="burbuja-fijada" title="Fijado"><Icono n="chincheta" /><span class="sr">Fijado</span></span>}
      {c.destacado && <span class="burbuja-estrella" title="Destacado"><Icono n="estrella" /><span class="sr">Destacado</span></span>}
      {c.editado_en && !eliminado && <span class="burbuja-editado">Editado</span>}
      {c.programado ? <span class="programado"><Icono n="reloj" />Programado para el {fmtProgramado(c.enviar_en)}</span> : <span class="burbuja-hora">{hora}</span>}
      <Ticks estado={est} />
    </>
  );
  const textoVisible = largo.texto;
  // El hueco al final del texto (lo que ocupan la hora y los ✓, que van encima, abajo a la derecha)
  const anchoPie = 3.3 + (est ? 1.5 : 0) + (c.editado_en && !eliminado ? 3.9 : 0) + (c.destacado ? 1.2 : 0) + (fijado ? 1.2 : 0);
  const hueco = <span class="burbuja-hueco" aria-hidden="true" style={{ width: `${anchoPie.toFixed(1)}em` }} />;
  return (
    <article id={`msg-${c.id}`} ref={ref} tabIndex={-1} class={clases}
      onPointerDown={bajar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar} onKeyDown={tecla}
      onContextMenu={(e) => { if (!conMenu || seleccionando) return; e.preventDefault(); if (!gesto.current?.largo) { soltar(); alMenu(); } }}
      onClickCapture={(e) => { if (suprimirClic.current) { suprimirClic.current = false; e.preventDefault(); e.stopPropagation(); } }}>
      {responder && <span class="burbuja-deslizar" aria-hidden="true"><Icono n="mensaje" /></span>}
      {seleccionando && (
        <button type="button" class="burbuja-elegir" aria-pressed={seleccionado ? 'true' : 'false'} onClick={alAlternar}
          aria-label={`${seleccionado ? 'Quitar de la selección' : 'Seleccionar'}: ${nombreDe(c.autor)}, ${hora}, ${extractoCita(c, 60)}`}>
          <span class="burbuja-elegir-marca" aria-hidden="true">{seleccionado && <Icono n="hecho" />}</span>
        </button>
      )}
      {c.fallo && <button type="button" class="burbuja-fallo" aria-label="No se ha enviado: reintentar o eliminar" onClick={alFallo}>!</button>}
      {c.reenviado && !eliminado && <span class="burbuja-reenviado"><Icono n="reenviar" />Reenviado</span>}
      {c.responde_a && !eliminado && (
        <button type="button" class={`burbuja-cita ${citado?.autor === yo ? 'de-mi' : ''}`} onClick={() => alIrA(c.responde_a)}
          aria-label={citado ? `Responde a ${nombreDe(citado.autor) === 'Tú' ? 'tu mensaje' : `${nombreDe(citado.autor)}`}: ${extractoCita(citado)}. Ir al mensaje` : 'Responde a un mensaje anterior. Ir al mensaje'}>
          <strong>{citado ? nombreDe(citado.autor) : 'Mensaje anterior'}</strong>
          <span>{citado ? extractoCita(citado) : hayMas ? 'Tócalo para cargarlo' : 'Ya no está en el chat'}</span>
        </button>
      )}
      {etq && !eliminado && (
        <button type="button" class="burbuja-ctx" onClick={alContexto}>
          <Icono n={c.contexto.tipo === 'sesion' ? 'hoy' : c.contexto.tipo === 'checkin' ? 'checkin' : 'video'} />{etq}
        </button>
      )}
      {sub && <SubidaChat x={sub} alCancelar={() => alCancelarSubida(sub.id)} alReintentar={() => alReintentarSubida(sub.id)} />}
      {c.archivo && !eliminado && (esDoc ? <DocumentoChat archivo={c.archivo} /> : esVoz ? <NotaVozChat c={c} mio={mio} alEscuchada={alRecargar} /> : <MedioChat archivo={c.archivo} alAbrir={alAbrir} />)}
      {conEncuesta && <EncuestaChat key={`${c.encuesta.id}:${(c.encuesta.voto || []).join(',')}`} c={c} yo={yo} alVotado={alRecargar} />}
      {eliminado ? <p class="burbuja-texto burbuja-eliminada"><span aria-hidden="true">🚫 </span><em>Se eliminó este mensaje</em>{hueco}</p>
        : conEncuesta || (sub && !c.texto) ? null
        : !esMarcador(c) ? (
          <div class="burbuja-cuerpo">
            <TextoChat id={entero || !largo.cortado ? c.id : `${c.id}-corto`} texto={textoVisible} clase="burbuja-texto" resaltar={consulta} fin={largo.cortado || c.programado ? null : hueco} />
            {largo.cortado && <button type="button" class="burbuja-leer-mas" onClick={() => setEntero(true)}>Leer más</button>}
          </div>
        ) : null}
      <span class={`burbuja-pie ${c.programado ? 'pie-bloque' : ''} ${soloMedio ? 'sobre-medio' : ''}`}>{pieDentro}</span>
      {conMenu && !seleccionando && <button type="button" class="burbuja-mas" aria-label="Más opciones" aria-haspopup="dialog" onClick={alMenu}><Icono n="abajo" /></button>}
      {reacciones.length > 0 && (
        <button type="button" class="burbuja-reacciones" key={reacciones.map((r) => r.emoji).join('')} onClick={alReacciones}
          aria-label={`Reacciones: ${reacciones.map((r) => `${NOMBRE_EMOJI[r.emoji]} ${r.n}`).join(', ')}. Ver quién ha reaccionado`}>
          {reacciones.map((r) => <span key={r.emoji} aria-hidden="true">{r.emoji}</span>)}
          {c.reacciones.length > 1 && <span class="num" aria-hidden="true">{c.reacciones.length}</span>}
        </button>
      )}
    </article>
  );
}

// El menú de un mensaje (una hoja: en el móvil, abajo): las reacciones arriba y, debajo, lo que se puede hacer
function HojaMensaje({ c, yo, miId, fijado, rapidas = REACCIONES_CHAT, alElegirReacciones, alCerrar, alResponder, alReaccionar, alCopiar, alEditar, alEliminar, alDestacar, alInfo, alCambiar, alSeleccionar, alFijar, alDesfijar, alReenviar }) {
  const mio = c.autor === yo;
  const eliminado = !!c.eliminado_en;
  const mia = (c.reacciones || []).find((r) => r.usuario_id === miId)?.emoji || null;
  const [todos, setTodos] = useState(false);
  const acciones = [
    !eliminado && !c.programado && ['responder', 'mensaje', 'Responder', alResponder],
    !eliminado && !esMarcador(c) && ['copiar', 'copiar', 'Copiar', alCopiar],
    reenviable(c, yo) && ['reenviar', 'reenviar', 'Reenviar', alReenviar],
    yo === 'coach' && puedeReaccionar(c) && (fijado ? ['desfijar', 'chincheta', 'Desfijar', alDesfijar] : ['fijar', 'chincheta', 'Fijar', alFijar]),
    c.programado && mio && ['cambiar', 'reloj', 'Cambiar el texto o la hora', alCambiar],
    puedeEditar(c, yo) && !c.encuesta && ['editar', 'editar', 'Editar', alEditar],
    puedeReaccionar(c) && ['destacar', 'estrella', c.destacado ? 'Quitar destacado' : 'Destacar', alDestacar],
    ['seleccionar', 'seleccionar', 'Seleccionar', alSeleccionar],
    mio && !c.programado && ['info', 'pregunta', 'Info', alInfo],
    puedeEliminar(c, yo) && ['eliminar', 'basura', c.programado ? 'Cancelar el envío' : 'Eliminar para todos', alEliminar],
  ].filter(Boolean);
  return (
    <Hoja titulo="Mensaje" alCerrar={alCerrar} clase="hoja-mensaje">
      <p class="peq secundario hoja-mensaje-texto">{extractoCita(c)}</p>
      {puedeReaccionar(c) && (
        <div class="menu-reacciones" role="group" aria-label="Reaccionar">
          {/* v0.56: tus seis (y la tuya, si es otra); «+» para cualquier emoji */}
          {[...rapidas, ...(mia && !rapidas.includes(mia) ? [mia] : [])].map((e) => (
            <button key={e} type="button" class="menu-reaccion" aria-pressed={mia === e ? 'true' : 'false'} aria-label={mia === e ? `Quitar tu reacción (${NOMBRE_EMOJI[e]})` : `Reaccionar con ${NOMBRE_EMOJI[e]}`} onClick={() => alReaccionar(e)}>
              <span aria-hidden="true">{e}</span>
            </button>
          ))}
          <button type="button" class="menu-reaccion menu-reaccion-mas" aria-expanded={todos ? 'true' : 'false'} aria-label="Reaccionar con otro emoji" onClick={() => setTodos((v) => !v)}><Icono n="mas" /></button>
        </div>
      )}
      {todos && puedeReaccionar(c) && (
        <div class="pila-xs">
          <PanelEmojis alElegir={(e) => { if (emojiValido(e)) alReaccionar(e); }} />
          <button type="button" class="btn btn-peq" onClick={alElegirReacciones}><Icono n="editar" /> Elegir tus seis reacciones</button>
        </div>
      )}
      <ul class="lista hoja-acciones">
        {acciones.map(([id, ico, t, f]) => (
          <li key={id}><button type="button" class={`accion-fila accion-${id}`} onClick={f}><span class="ico"><Icono n={ico} /></span><span class="pila-xs"><strong>{t}</strong></span><span /></button></li>
        ))}
      </ul>
    </Hoja>
  );
}

// Mis destacados de esta conversación: tocar uno lleva a su mensaje
function HojaDestacados({ atletaId, nombreDe, alCerrar, alIr }) {
  const { api } = useApp();
  const lista = useCarga(() => api.destacados(atletaId), [atletaId]);
  return (
    <Hoja titulo="Mensajes destacados" alCerrar={alCerrar}>
      {lista.cargando && !lista.datos ? <Cargando /> : !lista.datos?.length ? (
        <Vacio icono="estrella" titulo="Sin mensajes destacados">Mantén pulsado un mensaje (o abre su menú) y toca «Destacar» para encontrarlo aquí. Solo los ves tú.</Vacio>
      ) : (
        <ul class="lista chat-destacados">
          {lista.datos.map((c) => (
            <li key={c.id}>
              <button type="button" class="chat-destacado" onClick={() => alIr(c.id)}>
                <span class="separa"><strong class="peq">{nombreDe(c.autor)}</strong><span class="mini terciario">{cuandoInfo(c.creado_en)}</span></span>
                <span class="peq secundario">{extractoCita(c)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Hoja>
  );
}

// «Archivos, enlaces y documentos»: lo de los mensajes cargados (lo que ya se puede ver), en tres pestañas
function HojaArchivosChat({ mensajes, hayMas, pestana = 'multimedia', yo, alCerrar, alAbrir, alIr, alMas }) {
  const [pest, setPest] = useState(pestana);
  const medios = mediosDe(mensajes).filter((m) => m.tipo === 'foto' || m.tipo === 'video');
  const docs = mediosDe(mensajes).filter((m) => m.tipo === 'documento' || m.tipo === 'archivo');
  const enlaces = enlacesDe(mensajes);
  const voces = mediosDe(mensajes).filter((m) => m.tipo === 'audio');
  const porId = Object.fromEntries(mensajes.map((c) => [c.id, c]));
  return (
    <Hoja titulo="Archivos, enlaces y documentos" alCerrar={alCerrar} ancho={720}>
      <Pestanas opciones={[['multimedia', `Multimedia (${medios.length})`], ['enlaces', `Enlaces (${enlaces.length})`], ['documentos', `Documentos (${docs.length})`], ['voz', `Notas de voz (${voces.length})`]]} valor={pest} alCambiar={setPest} etiqueta="Qué ver" idBase="chat-arch" />
      <div role="tabpanel" id="chat-arch-panel" aria-labelledby={`chat-arch-${pest}`} class="chat-arch-panel">
        {pest === 'multimedia' && (!medios.length ? <Vacio icono="imagen" titulo="Sin fotos ni vídeos">Las fotos y los vídeos que os enviéis por aquí salen en esta pestaña.</Vacio> : (
          <ul class="chat-rejilla">
            {medios.map((m) => <li key={m.archivo.id}><MedioChat archivo={m.archivo} mini alAbrir={() => alAbrir(porId[m.mensajeId])} /></li>)}
          </ul>
        ))}
        {pest === 'enlaces' && (!enlaces.length ? <Vacio icono="enlace" titulo="Sin enlaces">Los enlaces que os mandéis (vídeos de YouTube, artículos…) salen aquí.</Vacio> : (
          <ul class="lista chat-enlaces">
            {enlaces.map((x) => (
              <li key={x.url} class="panel-pad chat-enlace">
                <a href={x.url} target="_blank" rel="noopener noreferrer" class="enlace-texto">{x.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 70)}</a>
                <span class="mini terciario">{cuandoInfo(x.creado_en)}</span>
                <button type="button" class="btn btn-peq" onClick={() => alIr(x.mensajeId)}>Ir al mensaje</button>
              </li>
            ))}
          </ul>
        ))}
        {pest === 'documentos' && (!docs.length ? <Vacio icono="bandeja" titulo="Sin documentos">Los PDF que os mandéis por el chat (un plan, una analítica, una guía) salen aquí.</Vacio> : (
          <ul class="lista chat-docs">
            {docs.map((m) => (
              <li key={m.archivo.id} class="panel-pad chat-doc">
                {m.tipo === 'documento' ? <DocumentoChat archivo={m.archivo} mini /> : <span>📄 Archivo</span>}
                <span class="mini terciario">{cuandoInfo(porId[m.mensajeId]?.creado_en)}</span>
                <button type="button" class="btn btn-peq" onClick={() => alIr(m.mensajeId)}>Ir al mensaje</button>
              </li>
            ))}
          </ul>
        ))}
        {pest === 'voz' && (!voces.length ? <Vacio icono="micro" titulo="Sin notas de voz">Las notas de voz que os mandéis (de hasta un minuto) salen aquí.</Vacio> : (
          <ul class="lista chat-docs">
            {voces.map((m) => (
              <li key={m.archivo.id} class="panel-pad chat-doc">
                <NotaVozChat c={porId[m.mensajeId] || { id: m.mensajeId, archivo: m.archivo }} mio={porId[m.mensajeId]?.autor === yo} />
                <span class="mini terciario">{cuandoInfo(porId[m.mensajeId]?.creado_en)}</span>
                <button type="button" class="btn btn-peq" onClick={() => alIr(m.mensajeId)}>Ir al mensaje</button>
              </li>
            ))}
          </ul>
        ))}
        {hayMas && <button type="button" class="btn btn-peq" onClick={alMas}><Icono n="arriba" /> Buscar también en los mensajes anteriores</button>}
      </div>
    </Hoja>
  );
}

// v0.54: el fondo del chat, con dibujos propios de FBE (pesas, un disco, una kettlebell, el pulso…), muy suaves y del
// color de acento; dibujado en la propia página (sin imágenes de fuera). Con el negro puro (OLED), sin dibujos.
function FondoChat() {
  return (
    <div class="chat-fondo" aria-hidden="true">
      <svg width="100%" height="100%">
        <defs>
          <pattern id="fbe-chat-dibujos" width="240" height="240" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 40h30M16 32v16M58 32v16M10 36v8M64 36v8" transform="rotate(-18 37 40)" />
              <path d="M142 46c0-9 18-9 18 0M151 78a15 15 0 1 0 0-30a15 15 0 1 0 0 30" />
              <path d="M30 128h16l6-12 8 24 6-12h18" />
              <path d="M196 108h10M195 113h12v30a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3z" transform="rotate(12 201 127)" />
              <path d="M112 206a16 16 0 1 0 0-32a16 16 0 1 0 0 32M112 194a4 4 0 1 0 0-8a4 4 0 1 0 0 8" />
              <path d="M40 178l-9 15h8l-3 13 10-17h-8l4-11z" />
              <path d="M98 34l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
              <path d="M198 222a11 11 0 1 0 0-22a11 11 0 1 0 0 22M198 194v6M198 206v-5l3 3" />
              <path d="M160 156h24a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4h-14l-6 5v-5h-4a4 4 0 0 1-4-4v-12a4 4 0 0 1 4-4z" />
              <path d="M226 64c-3-5-10-4-10 2 0 5 10 10 10 10s10-5 10-10c0-6-7-7-10-2z" transform="translate(-20 0)" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#fbe-chat-dibujos)" />
      </svg>
    </div>
  );
}

// v0.56: lo que se está enviando, al momento en el chat (como WhatsApp): su vista previa (lo que está en el móvil), un
// anillo con lo que lleva subido y «Cancelar»; si no sale, «!» con «Reintentar» o «Quitar»
function SubidaChat({ x, alCancelar, alReintentar }) {
  const pct = Math.round((x.progreso || 0) * 100);
  const R = 18, C = 2 * Math.PI * R;
  const que = x.esAudio ? 'la nota de voz' : x.esPdf ? `el PDF ${x.nombre || ''}`.trim() : x.esVideo ? 'el vídeo' : 'la foto';
  return (
    <div class={`subida-chat ${x.esAudio ? 'es-voz' : x.esPdf ? 'es-pdf' : ''} ${x.estado === 'fallo' ? 'fallida' : ''}`}>
      {x.esAudio ? <span class="subida-icono"><Icono n="micro" /><span class="mini num">{mmssCorto(x.seg || 0)}</span></span>
        : x.esPdf ? <span class="subida-icono"><Icono n="documento" /><span class="mini">{x.nombre || 'PDF'}</span></span>
        : x.url ? (x.esVideo ? <video src={x.url} muted playsInline preload="metadata" aria-hidden="true" /> : <img src={x.url} alt="" />) : <span class="subida-icono"><Icono n="imagen" /></span>}
      {x.estado === 'fallo' ? (
        <span class="subida-fallo" role="alert">
          <span class="mini">{x.error}</span>
          <span class="fila-envolver">
            <button type="button" class="btn btn-peq" onClick={alReintentar}><Icono n="reiniciar" /> Reintentar</button>
            <button type="button" class="btn btn-peq" onClick={alCancelar}><Icono n="basura" /> Quitar</button>
          </span>
        </span>
      ) : (
        <span class="subida-anillo">
          <svg viewBox="0 0 44 44" aria-hidden="true"><circle class="pista" cx="22" cy="22" r={R} /><circle class="hecho" cx="22" cy="22" r={R} stroke-dasharray={C} stroke-dashoffset={C * (1 - (x.progreso || 0))} transform="rotate(-90 22 22)" /></svg>
          <button type="button" class="subida-cancelar" aria-label={`Cancelar el envío de ${que}`} onClick={alCancelar}><Icono n="cerrar" /></button>
          <span class="sr" role="progressbar" aria-label={`Enviando ${que}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={pct}>{pct} %</span>
        </span>
      )}
    </div>
  );
}

// La foto o el vídeo dentro de la burbuja: la miniatura si la hay; si no (o si no carga), el propio archivo.
// v0.49: mientras llega, un hueco neutro con un brillo suave; al cargar, aparece fundido; si falla, lo dice con
// «Reintentar» (en lugar del icono de imagen rota del navegador). mini (v0.54): en la rejilla de «Multimedia».
// v0.55: un vídeo sale con su miniatura, su duración y el ▶ (nunca se reproduce solo); sin miniatura, del vídeo solo se
// pide lo justo para el primer fotograma (y nada con el «ahorro de datos» del móvil) hasta que se toca.
function MedioChat({ archivo, alAbrir, mini = false }) {
  const { api } = useApp();
  const [url, setUrl] = useState(null);
  const [sinPoster, setSinPoster] = useState(false);
  const [lista, setLista] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);
  const esFoto = archivo.tipo === 'foto_progreso' || /^image\//.test(archivo.mime || '');
  const conPoster = !!archivo.poster_ruta && !sinPoster;
  const ahorro = !esFoto && !conPoster && ahorroDatos();
  useEffect(() => {
    let vivo = true;
    setUrl(null); setLista(false); setFallo(false);
    if (ahorro) return undefined;
    api.urlArchivo(conPoster ? archivo.poster_ruta : archivo.ruta).then((u) => vivo && setUrl(u)).catch(() => { if (!vivo) return; if (conPoster) setSinPoster(true); else setFallo(true); });
    return () => { vivo = false; };
  }, [archivo.ruta, archivo.poster_ruta, conPoster, intento]);
  const error = () => { if (conPoster) setSinPoster(true); else setFallo(true); };
  if (fallo) {
    return (
      <div class={`medio-chat medio-fallo ${mini ? 'mini' : ''}`} role="group" aria-label={esFoto ? 'Imagen no disponible' : 'Vídeo no disponible'}>
        <Icono n={esFoto ? 'imagen' : 'video'} />
        {!mini && <span class="peq">{esFoto ? 'No se pudo cargar la imagen' : 'No se pudo cargar el vídeo'}</span>}
        {/* «Abrir» como siempre: un vídeo HEVC o una foto HEIC que aquí no se pintan pueden verse o descargarse en el visor */}
        <span class="fila-envolver medio-fallo-acciones">
          {!mini && <button type="button" class="btn btn-peq" onClick={() => setIntento((x) => x + 1)}><Icono n="reiniciar" /> Reintentar</button>}
          <button type="button" class="btn btn-peq" onClick={alAbrir} aria-label={esFoto ? 'Abrir la foto' : 'Abrir el vídeo'}><Icono n="ojo" /> Abrir</button>
        </span>
      </div>
    );
  }
  return (
    <button type="button" class={`medio-chat ${lista ? 'listo' : ''} ${mini ? 'mini' : ''} ${esFoto ? '' : 'es-video'}`} data-tipo={archivo.tipo} onClick={alAbrir} aria-label={esFoto ? 'Abrir la foto' : `Reproducir el vídeo${archivo.duracion_seg ? ` (${mmssCorto(archivo.duracion_seg)})` : ''}`}>
      <span class="medio-chat-hueco" aria-hidden="true" />
      {url && (esFoto || conPoster
        ? <img key={`${url}:${intento}`} src={url} alt="" loading="lazy" onLoad={() => setLista(true)} onError={error} />
        : <video key={`${url}:${intento}`} src={url} muted playsInline preload="metadata" onLoadedData={() => setLista(true)} onError={error} />)}
      {!esFoto && <span class="medio-chat-reproducir" aria-hidden="true"><Icono n="play" /></span>}
      {!esFoto && archivo.duracion_seg ? <span class="medio-chat-play" aria-hidden="true"><Icono n="video" /><span class="num">{mmssCorto(archivo.duracion_seg)}</span></span> : null}
    </button>
  );
}

const horaDe = (iso) => { const d = new Date(iso); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const mb = (bytes) => (bytes < 104858 ? '<0,1' : (bytes / 1048576).toLocaleString('es-ES', { maximumFractionDigits: 1 }));
export const mmssCorto = (seg) => `${Math.floor(seg / 60)}:${String(Math.round(seg % 60)).padStart(2, '0')}`;
export { cuando, textoPlano, tamanoTexto };
