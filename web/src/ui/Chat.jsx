import { Fragment } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Cargando, Hoja, cuando, Vacio, copiar, Pestanas } from './comunes.jsx';
import { Hilo, HojaRespuestas } from './Hilo.jsx';
import { VerArchivo, capturarPoster } from './Archivos.jsx';
import { LIMITE_ARCHIVO_MB } from '../datos/api.js';
import { hoyISO, sumarDias, fmtConDia, aISO, fmtProgramado } from '../logica/fechas.js';
import { TextoChat } from './Enlaces.jsx';
import { HojaProgramar } from './Programar.jsx';
import { gruposChat } from '../logica/visual.js';
import { sinMovimiento } from './transiciones.js';
import { leerAjustes } from './ajustes.js';
import {
  REACCIONES_CHAT, MAX_FOTOS, extractoCita, separadorNoLeidos, textoNoLeidos, coincidencias, resumenReacciones, puedeEditar, puedeEliminar,
  puedeReaccionar, infoMensaje, estadoConexion, enlacesDe, mediosDe, consultaRapida, filtrarRapidas, leerBorrador, guardarBorrador, borrarBorrador,
  esMarcador, cuandoInfo,
} from '../logica/mensajes.js';
import { textoPlano } from '../logica/formato.js';

// El chat (v0.18): todos los mensajes con una persona en un solo hilo, como en WhatsApp. Lo que viene de una sesión,
// un check-in o un vídeo lleva su etiqueta, que abre ese sitio; lo que se escribe aquí es un mensaje general.
// v0.54, como WhatsApp: responder (deslizando la burbuja a la derecha o desde su menú), reacciones, menú al mantener
// pulsado (o con el botón derecho, «Más opciones» o Mayús+F10), editar (15 min), eliminar para todos (48 h), destacados,
// info, formato (*negrita*…), «escribiendo…» y «en línea», «N MENSAJES SIN LEER», buscar, archivos y enlaces, fondo con
// dibujos, borradores, varias fotos con un pie y, para el coach, respuestas rápidas con «/».
// yo: 'coach' o 'atleta'. irContexto({tipo, id}): abrir la sesión, el check-in o el archivo.
// cabecera (v0.54): { izquierda, titulo, sub, derecha } para pintar aquí la cabecera de la pantalla (con su estado, la
// búsqueda y el menú); sin ella (en la ficha), una fila de herramientas. perfilOtro: el perfil del atleta (para el coach).
const NOMBRE_EMOJI = { '❤️': 'corazón', '👍': 'pulgar arriba', '💪': 'bíceps', '😂': 'risa', '😮': 'sorpresa', '🙏': 'gracias' };
const almacen = () => { try { return window.localStorage; } catch { return null; } };

export function Chat({ atletaId, nombreAtleta = 'Atleta', nombreCoach = 'Tu coach', fotoOtro = null, irContexto, alLeer, alCambiar, cabecera = null, perfilOtro = null, saltarA = null }) {
  const { api, perfil, aviso, modo } = useApp();
  const yo = perfil?.rol === 'coach' ? 'coach' : 'atleta';
  const miId = perfil?.id || null;
  const [limite, setLimite] = useState(400);
  const conv = useCarga(() => api.conversacion(atletaId, { limite }), [atletaId, limite]);
  const borradorInicial = useMemo(() => leerBorrador(almacen(), miId, atletaId), [miId, atletaId]);
  const [texto, setTexto] = useState(borradorInicial?.texto || '');
  const [adjuntos, setAdjuntos] = useState([]);      // [{ id, archivo, url, esVideo }]
  const [enDiario, setEnDiario] = useState(true);    // los vídeos del atleta, a su diario (como vídeo de técnica)
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState(null);    // { i, n } al enviar varias
  const [guardadas, setGuardadas] = useState(false);
  const [abierto, setAbierto] = useState(null);      // archivo abierto a pantalla completa
  const [programar, setProgramar] = useState(null);  // v0.48: null | { nuevo: true } | mensaje programado a cambiar
  const [citando, setCitando] = useState(null);      // v0.54: el mensaje al que se responde
  const [editando, setEditando] = useState(null);
  const [menu, setMenu] = useState(null);            // el mensaje con su menú abierto
  const [eliminar, setEliminar] = useState(null);
  const [info, setInfo] = useState(null);
  const [quien, setQuien] = useState(null);          // quién ha reaccionado a un mensaje
  const [hoja, setHoja] = useState(null);            // 'menu' | 'destacados' | 'archivos'
  const [buscando, setBuscando] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [actualId, setActualId] = useState(null);
  const [resaltada, setResaltada] = useState(null);
  const [rapidas, setRapidas] = useState(null);
  const [iRapida, setIRapida] = useState(0);
  const [rapidasFuera, setRapidasFuera] = useState(false);
  const lista = useRef(null);
  const raiz = useRef(null);
  const fin = useRef(null);
  // v0.49: «Mensajes nuevos» cuando llega algo y estás leyendo más arriba; se va al llegar abajo
  const [nuevos, setNuevos] = useState(false);
  const [abajo, setAbajo] = useState(true);
  const area = useRef(null);
  const input = useRef(null);
  const inputBusqueda = useRef(null);
  const recargar = useRef(null);
  recargar.current = conv.recargar;
  const fondo = leerAjustes().fondoChat !== 'liso';

  const mensajes = conv.datos || [];
  const porId = useMemo(() => Object.fromEntries(mensajes.map((c) => [c.id, c])), [mensajes]);
  const hayMas = mensajes.length >= limite;
  const primerNombre = nombreAtleta.split(' ')[0];
  const otro = yo === 'coach' ? primerNombre : nombreCoach;
  const nombreDe = (autor) => (autor === yo ? 'Tú' : yo === 'coach' ? primerNombre : 'Tu coach');

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
  // llega un mensaje estando ya cerca del final (si estás leyendo más arriba, no te mueve). Al cargar mensajes
  // anteriores (arriba), tampoco.
  const ultimoId = mensajes.length ? mensajes[mensajes.length - 1].id : null;
  const ultimoMio = mensajes.length ? mensajes[mensajes.length - 1].autor === yo : false;
  const primeraCarga = useRef(true);
  const ultimoPrevio = useRef(null);
  useLayoutEffect(() => {
    if (!conv.datos) return;
    const doc = document.documentElement;
    if (primeraCarga.current) {
      primeraCarga.current = false;
      const sep = separador.current ? document.getElementById('chat-sin-leer') : null;
      if (sep) {
        const cab = document.querySelector('.cabecera');
        window.scrollTo(0, Math.max(0, sep.getBoundingClientRect().top + window.scrollY - (cab?.getBoundingClientRect().height || 0) - 12));
      } else window.scrollTo(0, doc.scrollHeight);
    } else if (ultimoId !== ultimoPrevio.current) {
      const cerca = doc.scrollHeight - doc.scrollTop - window.innerHeight < 240;
      if (cerca || ultimoMio) window.scrollTo(0, doc.scrollHeight);
      else setNuevos(true);
      // Lo que acaba de llegar de la otra parte quita su «escribiendo…»
      if (!ultimoMio) setEscribe(false);
    }
    ultimoPrevio.current = ultimoId;
  }, [ultimoId, !!conv.datos]);
  useLayoutEffect(() => { if (adjuntos.length) window.scrollTo(0, document.documentElement.scrollHeight); }, [adjuntos.length]);
  // El final de la lista a la vista (sin escuchar el scroll)
  useEffect(() => {
    const el = fin.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => { setAbajo(e.isIntersecting); if (e.isIntersecting) setNuevos(false); }, { rootMargin: '0px 0px 120px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [!!conv.datos]);
  // Los separadores de día se quedan pegados justo debajo de la cabecera de la pantalla (mida lo que mida)
  useLayoutEffect(() => {
    const cab = document.querySelector('.cabecera');
    const el = raiz.current;
    if (!cab || !el) return undefined;
    const poner = () => el.style.setProperty('--chat-sep-top', `${Math.round(cab.getBoundingClientRect().height)}px`);
    poner();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(poner) : null;
    ro?.observe(cab);
    return () => ro?.disconnect();
  }, []);
  const irAbajo = () => { setNuevos(false); window.scrollTo({ top: document.documentElement.scrollHeight, behavior: sinMovimiento() ? 'auto' : 'smooth' }); };

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
  const encontrados = useMemo(() => (buscando ? coincidencias(mensajes, consulta).reverse() : []), [buscando, mensajes, consulta]);
  const pos = actualId ? encontrados.indexOf(actualId) : -1;
  const masAntiguos = useRef(false);
  useEffect(() => { setActualId(encontrados[0] || null); }, [consulta, buscando]);
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
  const abrirBusqueda = () => { setHoja(null); setBuscando(true); setTimeout(() => inputBusqueda.current?.focus(), 0); };
  const cerrarBusqueda = () => { setBuscando(false); setConsulta(''); setActualId(null); };
  const contador = consulta.trim().length < 2 ? '' : encontrados.length ? `${pos + 1} de ${encontrados.length}${hayMas ? '+' : ''}` : hayMas ? 'Sin resultados aquí' : 'Sin resultados';

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
      alCambio: () => recargar.current?.(true),
      alEstado: (ok) => { if (!ok) { setEscribe(false); setEnLinea(false); } },
    });
    canal.current = h;
    return () => { clearTimeout(t); h?.soltar(); canal.current = null; setEnLinea(false); setEscribe(false); };
  }, [atletaId, miVisible, rtVersion]);
  const ultima = useCarga(() => (!miVisible || (yo === 'coach' && !perfilOtro) ? Promise.resolve(null) : api.ultimaConexion(yo === 'coach' ? perfilOtro : null)), [perfilOtro, miVisible, rtVersion, minuto]);
  const estado = estadoConexion({ escribiendo: escribe, enLinea: enLinea && miVisible, ultima: ultima.datos });
  const avisarCambio = () => { canal.current?.cambio(); alCambiar?.(); };

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

  // Las fotos y los vídeos (v0.54: varios a la vez, hasta 10, con un pie para todos)
  useEffect(() => () => { for (const a of adjuntosRef.current) if (a.url) URL.revokeObjectURL(a.url); }, []);
  const adjuntosRef = useRef([]);
  adjuntosRef.current = adjuntos;
  function elegido(e) {
    const archivos = [...(e.currentTarget.files || [])];
    e.currentTarget.value = '';
    if (!archivos.length) return;
    const nuevos = [];
    for (const f of archivos) {
      if (!/^(image|video)\//.test(f.type || '')) { aviso('Solo fotos y vídeos', 'error'); continue; }
      if (f.size > LIMITE_ARCHIVO_MB * 1024 * 1024) { aviso(`Pesa más de ${LIMITE_ARCHIVO_MB} MB. Graba solo la serie (unos 30 segundos).`, 'error'); continue; }
      if (adjuntos.length + nuevos.length >= MAX_FOTOS) { aviso(`Como mucho ${MAX_FOTOS} a la vez`, 'error'); break; }
      let url = null;
      try { url = URL.createObjectURL(f); } catch { /* */ }
      nuevos.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, archivo: f, url, esVideo: /^video\//.test(f.type || '') });
    }
    if (!nuevos.length) return;
    if (editando) { setEditando(null); setTexto(''); }
    setAdjuntos((xs) => [...xs, ...nuevos]);
    area.current?.focus();
  }
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
    setEnviando(true);
    const cita = citando;
    try {
      if (adjuntos.length) {
        const pendientes = [...adjuntos];
        for (let i = 0; i < pendientes.length; i++) {
          const a = pendientes[i];
          if (pendientes.length > 1) setProgreso({ i: i + 1, n: pendientes.length });
          let poster = null, duracion_seg = null;
          if (a.esVideo) {
            const cap = await capturarPoster(a.archivo).catch(() => null);
            poster = cap?.poster || null; duracion_seg = cap?.duracion ?? null;
          }
          // El pie va con la primera (como WhatsApp con varias fotos); la cita, también
          await api.enviarMensaje(atletaId, { texto: i === 0 ? t : '', archivo: a.archivo, autor: yo, enDiario: a.esVideo && yo === 'atleta' && enDiario, poster, duracion_seg,
            respondeA: i === 0 && cita && enElChat(cita) ? cita.id : null });
          quitarAdjunto(a);
          if (i === 0) limpiarCompositor();
        }
      } else if (cita && !enElChat(cita)) {
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

  // v0.54: lo del menú de cada mensaje
  const responder = (c) => { setMenu(null); setEditando(null); setCitando(c); setTimeout(() => area.current?.focus(), 0); };
  const editar = (c) => { setMenu(null); setCitando(null); setAdjuntos([]); setEditando(c); setTexto(c.texto); setTimeout(() => { if (area.current) { ajustarAlto(area.current); area.current.focus(); } }, 0); };
  async function reaccionar(c, emoji) {
    setMenu(null);
    try { await api.reaccionarMensaje(c.id, emoji); await conv.recargar(true); avisarCambio(); } catch (err) { aviso(err.message, 'error'); }
  }
  async function destacar(c) {
    setMenu(null);
    try { await api.destacar(c.id, !c.destacado); aviso(c.destacado ? 'Ya no está destacado' : 'Destacado'); await conv.recargar(true); } catch (err) { aviso(err.message, 'error'); }
  }
  async function confirmarEliminar(c) {
    try {
      const r = await api.eliminarMensaje(c);
      setEliminar(null);
      if (citando?.id === c.id) setCitando(null);
      // (si el coach no ha podido borrar la foto de Storage, lo dice: queda en la cola y se reintenta)
      if (yo === 'coach' && r.almacenamiento === 'pendiente') aviso('No se pudo borrar el archivo del almacenamiento; se reintentará', 'error');
      else aviso(r.estado === 'cancelado' ? 'Envío cancelado' : 'Mensaje eliminado');
      await conv.recargar(true); avisarCambio();
    } catch (err) { aviso(err.message, 'error'); }
  }
  const copiarMensaje = async (c) => { setMenu(null); aviso((await copiar(c.texto)) ? 'Copiado' : 'No se ha podido copiar'); };

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
    if (e.key === 'Escape' && (editando || citando)) { e.preventDefault(); if (editando) limpiarCompositor(); else setCitando(null); return; }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) enviar(e);
  }

  // Separadores por día
  const hoy = hoyISO(), ayer = sumarDias(hoy, -1);
  const diaDe = (iso) => { const d = aISO(new Date(iso)); return d === hoy ? 'Hoy' : d === ayer ? 'Ayer' : fmtConDia(d); };
  const grupos = [];
  for (const c of mensajes) {
    const dia = diaDe(c.creado_en);
    const g = grupos[grupos.length - 1];
    if (g && g.dia === dia) g.items.push(c); else grupos.push({ dia, items: [c] });
  }
  const etiqueta = (c) => {
    if (!c.contexto) return null;
    if (c.contexto.tipo === 'sesion') return `En ${c.contexto.nombre}`;
    if (c.contexto.tipo === 'checkin') return yo === 'coach' ? 'En su check-in' : 'En tu check-in';
    if (!c.contexto.nombre) return null;
    return yo === 'coach' ? `En su ${c.contexto.nombre}` : `En tu ${c.contexto.nombre}`;
  };
  // v0.49: los mensajes seguidos de la misma persona van juntos (solo el último lleva el pico y la hora)
  const agrupado = Object.fromEntries(gruposChat(mensajes.map((c) => ({ ...c, contexto: etiqueta(c) ? c.contexto : null })), { dia: (iso) => aISO(new Date(iso)) }).map((x) => [x.id, x]));
  const sep = separador.current;

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

  return (
    <div class={`chat ${fondo && cabecera ? 'con-fondo' : ''}`} ref={raiz} aria-label={`Chat con ${otro}`}>
      {fondo && cabecera && <FondoChat />}
      {cabecera ? (
        <header class={`cabecera cabecera-chat ${buscando ? 'buscando' : ''}`}>
          {buscando ? <><h1 class="sr">{cabecera.titulo}</h1>{barraBusqueda}</> : (
            <>
              {cabecera.izquierda}
              <div class="titulo"><h1>{cabecera.titulo}</h1><div class={`sub ${escribe ? 'escribiendo' : ''}`}>{estado || cabecera.sub || ''}</div></div>
              {cabecera.derecha}
              {herramientas}
            </>
          )}
        </header>
      ) : (
        <div class="chat-herramientas">
          {buscando ? barraBusqueda : <><span class={`peq secundario chat-estado ${escribe ? 'escribiendo' : ''}`}>{estado || ''}</span>{herramientas}</>}
        </div>
      )}
      <div class="chat-lista" ref={lista}>
        {hayMas && !conv.cargando && (
          <button type="button" class="btn btn-peq chat-anteriores" onClick={() => setLimite((l) => l + 400)}><Icono n="arriba" /> Ver mensajes anteriores</button>
        )}
        {conv.cargando && !conv.datos ? <Cargando texto="Cargando los mensajes" /> : !mensajes.length ? (
          <div class="chat-vacio">
            <Vacio ilustracion="mensajes" titulo={yo === 'coach' ? `Tu conversación con ${primerNombre}` : `Tu conversación con ${nombreCoach}`}
              accion={<button type="button" class="btn btn-peq" onClick={() => raiz.current?.querySelector('.chat-area')?.focus()}><Icono n="editar" /> Escribir el primer mensaje</button>}>
              {yo === 'coach'
                ? 'Para lo que no es de una sesión concreta: le llega al momento, y lo de sus sesiones, check-ins y vídeos también sale aquí.'
                : 'Para lo que no es de una sesión concreta (un viaje, una molestia, una duda): tu coach lo recibe al momento, también fotos y vídeos.'}
            </Vacio>
          </div>
        ) : grupos.map((g) => (
          <section key={g.dia} class="chat-dia" aria-label={g.dia}>
            <span class="chat-sep">{g.dia}</span>
            {g.items.map((c) => (
              <Fragment key={c.id}>
                {sep?.id === c.id && <div id="chat-sin-leer" class="chat-sin-leer" role="separator" aria-label={textoNoLeidos(sep.n).toLowerCase()}><span>{textoNoLeidos(sep.n)}</span></div>}
                <Burbuja c={c} yo={yo} miId={miId} gr={agrupado[c.id] || { primero: true, ultimo: true }} etq={etiqueta(c)} citado={c.responde_a ? porId[c.responde_a] || null : null}
                  nombreDe={nombreDe} consulta={buscando ? consulta : ''} actual={buscando && actualId === c.id} resaltada={resaltada === c.id} hayMas={hayMas}
                  alMenu={() => setMenu(c)} alResponder={() => responder(c)} alIrA={irA} alAbrir={() => setAbierto(c)} alContexto={() => (c.contexto.tipo === 'archivo' ? setAbierto(c) : irContexto?.(c.contexto))}
                  alReacciones={() => setQuien(c)} />
              </Fragment>
            ))}
          </section>
        ))}
        {modo === 'demo' && !conv.cargando && <p class="mini terciario chat-nota">En la demo no hay nadie al otro lado: lo que escribas se queda aquí.</p>}
        <span ref={fin} class="chat-fin" aria-hidden="true" />
      </div>
      {nuevos && !abajo && <button type="button" class="chat-nuevos" onClick={irAbajo}>Mensajes nuevos <Icono n="abajo" /></button>}
      <p class="sr" aria-live="polite">{nuevos && !abajo ? 'Hay mensajes nuevos más abajo' : ''}</p>

      <form class="chat-barra" onSubmit={enviar}>
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
                    <div key={a.id} class="chat-adjunto-item" role="listitem">
                      {a.url && (a.esVideo ? <video src={a.url} muted playsInline preload="metadata" /> : <img src={a.url} alt="" />)}
                      {a.esVideo && <span class="chat-adjunto-video" aria-hidden="true"><Icono n="video" /></span>}
                      <button type="button" class="chat-adjunto-quitar" aria-label={`Quitar ${a.esVideo ? 'el vídeo' : 'la foto'} ${i + 1}`} onClick={() => quitarAdjunto(a)}><Icono n="cerrar" /></button>
                    </div>
                  ))}
                </div>
                {adjuntos.length < MAX_FOTOS && <button type="button" class="chat-adjunto-mas" aria-label="Añadir más fotos o vídeos" onClick={() => input.current?.click()}><Icono n="mas" /></button>}
              </div>
              <div class="pila-xs chat-adjunto-pie">
                <strong class="peq">{adjuntos.length === 1 ? (adjuntos[0].esVideo ? 'Vídeo' : 'Foto') : `${adjuntos.length} fotos y vídeos`} <span class="terciario">({mb(adjuntos.reduce((t, a) => t + a.archivo.size, 0))} MB{adjuntos.length > 1 ? `, máx. ${MAX_FOTOS}` : ''})</span></strong>
                {adjuntos.some((a) => a.esVideo) && yo === 'atleta' && (
                  <label class="casilla mini"><input type="checkbox" checked={enDiario} onChange={(e) => setEnDiario(e.currentTarget.checked)} /><span>{adjuntos.filter((a) => a.esVideo).length > 1 ? 'Guardar los vídeos en mi diario como vídeos de técnica (tu coach los revisa)' : 'Guardarlo en mi diario como vídeo de técnica (tu coach lo revisa)'}</span></label>
                )}
                {progreso && <span class="mini secundario" role="status">Enviando {progreso.i} de {progreso.n}…</span>}
              </div>
            </div>
          )}
          <div class="chat-escribir">
            <input ref={input} type="file" accept="image/*,video/*" multiple class="sr" tabIndex={-1} aria-label="Archivo para adjuntar" onChange={elegido} />
            <button type="button" class="btn btn-icono plano" aria-label="Adjuntar fotos o vídeos" disabled={!!editando} onClick={() => input.current?.click()}><Icono n="camara" /></button>
            {yo === 'coach' && <button type="button" class="btn btn-icono plano" aria-label="Respuestas guardadas" onClick={() => setGuardadas(true)}><Icono n="rayo" /></button>}
            {yo === 'coach' && <button type="button" class="btn btn-icono plano" aria-label="Programar envío" title="Programar envío" disabled={!texto.trim() || !!adjuntos.length || !!editando} onClick={() => setProgramar({ nuevo: true })}><Icono n="reloj" /></button>}
            <textarea ref={area} class="area chat-area" rows={1} aria-label={editando ? 'Editar el mensaje' : yo === 'coach' ? `Escribir a ${primerNombre}` : 'Escribir a tu coach'}
              aria-autocomplete={yo === 'coach' ? 'list' : undefined} aria-controls={verRapidas ? 'chat-rapidas' : undefined}
              aria-activedescendant={verRapidas && filtradas[iRapida] ? `rapida-${filtradas[iRapida].id}` : undefined}
              placeholder={adjuntos.length ? 'Pie de foto (opcional)…' : yo === 'coach' ? `Escribe a ${primerNombre}… («/» para tus respuestas)` : 'Escribe a tu coach…'} value={texto}
              onInput={(e) => { setTexto(e.currentTarget.value); setRapidasFuera(false); ajustarAlto(e.currentTarget); if (e.currentTarget.value.trim()) canal.current?.escribiendo(yo); }}
              onKeyDown={teclaArea} />
            <button class="btn btn-primario btn-icono chat-enviar" aria-label={editando ? 'Guardar el cambio' : 'Enviar'} disabled={enviando || (!texto.trim() && !adjuntos.length)}><Icono n={editando ? 'hecho' : 'enviar'} /></button>
          </div>
        </div>
      </form>

      {abierto && (
        <Hoja titulo={abierto.archivo?.tipo === 'adjunto' ? (/^image\//.test(abierto.archivo.mime || '') ? 'Foto' : 'Vídeo') : abierto.archivo?.tipo === 'foto_progreso' ? 'Foto de progreso' : 'Vídeo de técnica'} alCerrar={() => setAbierto(null)} ancho={760}>
          {abierto.archivo && <VerArchivo archivo={abierto.archivo} />}
          {abierto.archivo?.tipo !== 'adjunto' && <Hilo atletaId={atletaId} archivoId={abierto.archivoId} nombreAtleta={nombreAtleta} alCambiar={() => { conv.recargar(true); alCambiar?.(); }} vacio="Sin comentarios en este vídeo." />}
        </Hoja>
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
      {menu && (
        <HojaMensaje c={menu} yo={yo} miId={miId} alCerrar={() => setMenu(null)} alResponder={() => responder(menu)} alReaccionar={(e) => reaccionar(menu, e)}
          alCopiar={() => copiarMensaje(menu)} alEditar={() => editar(menu)} alEliminar={() => { setMenu(null); setEliminar(menu); }} alDestacar={() => destacar(menu)}
          alInfo={() => { setMenu(null); setInfo(menu); }} alCambiar={() => { setMenu(null); setProgramar(menu); }} />
      )}
      {eliminar && (
        <Hoja titulo={eliminar.programado ? 'Cancelar el envío' : '¿Eliminar para todos?'} alCerrar={() => setEliminar(null)}>
          <p class="secundario">{eliminar.programado ? `No le llegará a ${primerNombre}: el mensaje se borra.` : `Se quitará también del chat de ${otro}. En su lugar quedará «Se eliminó este mensaje».`}</p>
          <div class="fila-envolver">
            <button type="button" class="btn btn-peligro" onClick={() => confirmarEliminar(eliminar)}><Icono n="basura" /> {eliminar.programado ? 'Cancelar el envío' : 'Eliminar para todos'}</button>
            <button type="button" class="btn plano" onClick={() => setEliminar(null)}>{eliminar.programado ? 'Mantenerlo' : 'No eliminar'}</button>
          </div>
        </Hoja>
      )}
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
            <li><button type="button" class="accion-fila" onClick={abrirBusqueda}><span class="ico"><Icono n="buscar" /></span><span class="pila-xs"><strong>Buscar en el chat</strong></span><Icono n="derecha" class="cola" /></button></li>
            <li><button type="button" class="accion-fila" onClick={() => setHoja('destacados')}><span class="ico"><Icono n="estrella" /></span><span class="pila-xs"><strong>Mensajes destacados</strong><span class="peq secundario">Los que has marcado con la estrella (solo los ves tú)</span></span><Icono n="derecha" class="cola" /></button></li>
            <li><button type="button" class="accion-fila" onClick={() => setHoja('archivos')}><span class="ico"><Icono n="imagen" /></span><span class="pila-xs"><strong>Archivos, enlaces y documentos</strong></span><Icono n="derecha" class="cola" /></button></li>
          </ul>
        </Hoja>
      )}
      {hoja === 'destacados' && <HojaDestacados atletaId={atletaId} nombreDe={nombreDe} alCerrar={() => setHoja(null)} alIr={(id) => { setHoja(null); setTimeout(() => irA(id), 60); }} />}
      {hoja === 'archivos' && <HojaArchivosChat mensajes={mensajes} hayMas={hayMas} alCerrar={() => setHoja(null)} alAbrir={(c) => { setHoja(null); setAbierto(c); }}
        alIr={(id) => { setHoja(null); setTimeout(() => irA(id), 60); }} alMas={() => setLimite((l) => l + 400)} />}
    </div>
  );
}

function ajustarAlto(el) { el.style.height = 'auto'; el.style.height = `${Math.min(140, el.scrollHeight)}px`; }

// Una burbuja: deslizarla a la derecha responde (dedo o lápiz; touch-action: pan-y deja el desplazamiento vertical al
// navegador); mantenerla pulsada, el botón derecho, «Más opciones» o Mayús+F10 abren su menú
function Burbuja({ c, yo, miId, gr, etq, citado, nombreDe, consulta, actual, resaltada, hayMas, alMenu, alResponder, alIrA, alAbrir, alContexto, alReacciones }) {
  const mio = c.autor === yo;
  const eliminado = !!c.eliminado_en;
  const ref = useRef(null);
  const gesto = useRef(null);
  const suprimirClic = useRef(false);
  const responder = !eliminado && !c.programado;
  const conMenu = !eliminado || mio;
  const reacciones = resumenReacciones(c.reacciones, miId);
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
    if (e.button > 0 || !conMenu) return;
    if (e.target.closest('a, input, textarea')) return;
    const tipo = e.pointerType || 'mouse';
    gesto.current = { x0: e.clientX, y0: e.clientY, tipo, dx: 0, activo: false, largo: false, id: e.pointerId,
      t: tipo === 'mouse' ? null : setTimeout(() => { if (gesto.current) { gesto.current.largo = true; suprimirClic.current = true; alMenu(); } }, 480) };
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
      suprimirClic.current = true;
    }
  };
  const tecla = (e) => { if (conMenu && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) { e.preventDefault(); alMenu(); } };
  const clases = ['burbuja', mio ? 'mia' : 'suya', c.archivo ? 'con-medio' : '', c.programado ? 'programada' : '', gr.primero ? '' : 'sigue', gr.ultimo ? 'cola' : 'sin-cola',
    eliminado ? 'eliminada' : '', reacciones.length ? 'con-reacciones' : '', actual ? 'actual' : '', resaltada ? 'resaltada' : ''].filter(Boolean).join(' ');
  return (
    <article id={`msg-${c.id}`} ref={ref} tabIndex={-1} class={clases}
      onPointerDown={bajar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar} onKeyDown={tecla}
      onContextMenu={(e) => { if (!conMenu) return; e.preventDefault(); if (!gesto.current?.largo) { soltar(); alMenu(); } }}
      onClickCapture={(e) => { if (suprimirClic.current) { suprimirClic.current = false; e.preventDefault(); e.stopPropagation(); } }}>
      {responder && <span class="burbuja-deslizar" aria-hidden="true"><Icono n="mensaje" /></span>}
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
      {c.archivo && !eliminado && <MedioChat archivo={c.archivo} alAbrir={alAbrir} />}
      {eliminado ? <p class="burbuja-texto burbuja-eliminada"><span aria-hidden="true">🚫 </span><em>Se eliminó este mensaje</em></p>
        : !esMarcador(c) && <TextoChat id={c.id} texto={c.texto} clase="burbuja-texto" resaltar={consulta} />}
      <span class="burbuja-pie">
        {c.destacado && <span class="burbuja-estrella" title="Destacado"><Icono n="estrella" /><span class="sr">Destacado</span></span>}
        {c.editado_en && !eliminado && <span class="burbuja-editado">Editado</span>}
        {c.programado ? <span class="programado"><Icono n="reloj" />Programado para el {fmtProgramado(c.enviar_en)}</span> : <span class={gr.ultimo ? '' : 'sr'}>{horaDe(c.creado_en)}</span>}
        {mio && !c.programado && !gr.ultimo && <span class="sr">{c.leido_en ? 'visto' : 'enviado'}</span>}
        {mio && !c.programado && gr.ultimo && <span class="visto" title={c.leido_en ? 'Visto' : 'Enviado'} aria-label={c.leido_en ? 'visto' : 'enviado'}>{c.leido_en ? '✓✓' : '✓'}</span>}
      </span>
      {conMenu && <button type="button" class="burbuja-mas" aria-label="Más opciones" aria-haspopup="dialog" onClick={alMenu}><Icono n="abajo" /></button>}
      {reacciones.length > 0 && (
        <button type="button" class="burbuja-reacciones" onClick={alReacciones}
          aria-label={`Reacciones: ${reacciones.map((r) => `${NOMBRE_EMOJI[r.emoji]} ${r.n}`).join(', ')}. Ver quién ha reaccionado`}>
          {reacciones.map((r) => <span key={r.emoji} aria-hidden="true">{r.emoji}</span>)}
          {c.reacciones.length > 1 && <span class="num" aria-hidden="true">{c.reacciones.length}</span>}
        </button>
      )}
    </article>
  );
}

// El menú de un mensaje (una hoja: en el móvil, abajo): las reacciones arriba y, debajo, lo que se puede hacer
function HojaMensaje({ c, yo, miId, alCerrar, alResponder, alReaccionar, alCopiar, alEditar, alEliminar, alDestacar, alInfo, alCambiar }) {
  const mio = c.autor === yo;
  const eliminado = !!c.eliminado_en;
  const mia = (c.reacciones || []).find((r) => r.usuario_id === miId)?.emoji || null;
  const acciones = [
    !eliminado && !c.programado && ['responder', 'mensaje', 'Responder', alResponder],
    !eliminado && !esMarcador(c) && ['copiar', 'copiar', 'Copiar', alCopiar],
    c.programado && mio && ['cambiar', 'reloj', 'Cambiar el texto o la hora', alCambiar],
    puedeEditar(c, yo) && ['editar', 'editar', 'Editar', alEditar],
    puedeReaccionar(c) && ['destacar', 'estrella', c.destacado ? 'Quitar destacado' : 'Destacar', alDestacar],
    mio && !c.programado && ['info', 'pregunta', 'Info', alInfo],
    puedeEliminar(c, yo) && ['eliminar', 'basura', c.programado ? 'Cancelar el envío' : 'Eliminar para todos', alEliminar],
  ].filter(Boolean);
  return (
    <Hoja titulo="Mensaje" alCerrar={alCerrar} clase="hoja-mensaje">
      <p class="peq secundario hoja-mensaje-texto">{extractoCita(c)}</p>
      {puedeReaccionar(c) && (
        <div class="menu-reacciones" role="group" aria-label="Reaccionar">
          {REACCIONES_CHAT.map((e) => (
            <button key={e} type="button" class="menu-reaccion" aria-pressed={mia === e ? 'true' : 'false'} aria-label={mia === e ? `Quitar tu reacción (${NOMBRE_EMOJI[e]})` : `Reaccionar con ${NOMBRE_EMOJI[e]}`} onClick={() => alReaccionar(e)}>
              <span aria-hidden="true">{e}</span>
            </button>
          ))}
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
function HojaArchivosChat({ mensajes, hayMas, alCerrar, alAbrir, alIr, alMas }) {
  const [pest, setPest] = useState('multimedia');
  const medios = mediosDe(mensajes).filter((m) => m.tipo === 'foto' || m.tipo === 'video');
  const docs = mediosDe(mensajes).filter((m) => m.tipo === 'archivo');
  const enlaces = enlacesDe(mensajes);
  const porId = Object.fromEntries(mensajes.map((c) => [c.id, c]));
  return (
    <Hoja titulo="Archivos, enlaces y documentos" alCerrar={alCerrar} ancho={720}>
      <Pestanas opciones={[['multimedia', `Multimedia (${medios.length})`], ['enlaces', `Enlaces (${enlaces.length})`], ['documentos', `Documentos (${docs.length})`]]} valor={pest} alCambiar={setPest} etiqueta="Qué ver" idBase="chat-arch" />
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
        {pest === 'documentos' && (!docs.length ? <Vacio icono="bandeja" titulo="Sin documentos">Por el chat se envían fotos y vídeos; si algún día llega otro tipo de archivo, saldrá aquí.</Vacio> : (
          <ul class="lista">{docs.map((m) => <li key={m.archivo.id} class="panel-pad separa"><span>📄 Archivo</span><button type="button" class="btn btn-peq" onClick={() => alIr(m.mensajeId)}>Ir al mensaje</button></li>)}</ul>
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

// La foto o el vídeo dentro de la burbuja: la miniatura si la hay; si no (o si no carga), el propio archivo.
// v0.49: mientras llega, un hueco neutro con un brillo suave; al cargar, aparece fundido; si falla, lo dice con
// «Reintentar» (en lugar del icono de imagen rota del navegador). mini (v0.54): en la rejilla de «Multimedia».
function MedioChat({ archivo, alAbrir, mini = false }) {
  const { api } = useApp();
  const [url, setUrl] = useState(null);
  const [sinPoster, setSinPoster] = useState(false);
  const [lista, setLista] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);
  const esFoto = archivo.tipo === 'foto_progreso' || /^image\//.test(archivo.mime || '');
  const conPoster = !!archivo.poster_ruta && !sinPoster;
  useEffect(() => {
    let vivo = true;
    setUrl(null); setLista(false); setFallo(false);
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
    <button type="button" class={`medio-chat ${lista ? 'listo' : ''} ${mini ? 'mini' : ''}`} onClick={alAbrir} aria-label={esFoto ? 'Abrir la foto' : 'Abrir el vídeo'}>
      <span class="medio-chat-hueco" aria-hidden="true" />
      {url && (esFoto || conPoster
        ? <img key={`${url}:${intento}`} src={url} alt="" loading="lazy" onLoad={() => setLista(true)} onError={error} />
        : <video key={`${url}:${intento}`} src={url} muted playsInline preload="metadata" onLoadedData={() => setLista(true)} onError={error} />)}
      {!esFoto && <span class="medio-chat-play" aria-hidden="true"><Icono n="play" />{archivo.duracion_seg ? <span class="num">{mmssCorto(archivo.duracion_seg)}</span> : null}</span>}
    </button>
  );
}

const horaDe = (iso) => { const d = new Date(iso); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const mb = (bytes) => (bytes < 104858 ? '<0,1' : (bytes / 1048576).toLocaleString('es-ES', { maximumFractionDigits: 1 }));
export const mmssCorto = (seg) => `${Math.floor(seg / 60)}:${String(Math.round(seg % 60)).padStart(2, '0')}`;
export { cuando, textoPlano };
