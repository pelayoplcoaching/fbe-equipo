import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icono, useApp } from './comunes.jsx';
import { textoMomento, partirMomentos } from '../logica/momentos.js';
import { grados, rectImagen, limpiarDibujo, describirDibujo, dibujoVisible, dibujoValido, MAX_FORMAS, MAX_TEXTO_DIBUJO, COLORES_DIBUJO, HEX_COLOR, COLOR_DIBUJO } from '../logica/dibujo.js';
import { marcadores, marcaVecina, tiempoVoz, limitarZoom, limitarPan, ZOOM_MAX } from '../logica/tecnica.js';
import { useCorrecciones } from './tecnica/correcciones.js';
import { useCapa } from './tecnica/capas.js';
import { marcasRepeticiones, peorRepeticion, indicePeor, repVecina, repActual, anadirRepManual, etiquetaRep, NOMBRE_FUENTE_REPS } from '../logica/repeticiones.js';
import { TiraMiniaturas } from './tecnica/Tira.jsx';
import { useEstela, CapaEstela, MandosEstela, estelaParaCompositor } from './tecnica/Estela.jsx';
export { textoMomento };

// Reproductor para revisar técnica: cámara lenta (0,25×, 0,5×, 1×), fotograma a fotograma, bucle y
// «marcar el momento» para comentarlo. Los comentarios con un minuto («0:04 …») saltan a ese punto.
// Cada reproductor se registra por el id del archivo para que la conversación de al lado lo encuentre.
// Desde la v0.14, líneas y ángulos sobre un fotograma: se dibujan en pausa y van con el comentario; al
// abrir un comentario con dibujo, el vídeo salta a ese momento y lo enseña encima.
// v0.57: las correcciones como marcas en la barra de tiempo (tocar una lleva a su momento), más herramientas (flecha,
// círculo, lápiz y texto, en cinco colores, y visibles durante un tramo), la voz del coach al ritmo del vídeo (pausar
// el vídeo la pausa; ir a otro momento la lleva ahí), zoom (pellizcar, dos toques o + y −, y mover la imagen) y un
// ajuste fino para ir fotograma a fotograma arrastrando. Las capas de análisis (v0.58: trayectoria de la barra,
// velocidad, puntos del cuerpo) irán en «capas», entre el vídeo y los dibujos, con el mismo rectángulo de la imagen.
// v0.58: así es: el análisis automático pone su capa (tecnica/capas.js) y, para empezar, pide «elegir un punto» de la
// imagen (el disco de la barra): un toque sobre el vídeo en pausa, que da sus coordenadas de 0 a 1.
// v0.60: lo que se ve en el reproductor (estado(): las formas dibujadas, el zoom, el tamaño y la velocidad), para grabarlo
// con «Grabar la revisión»; con cors, el vídeo de un enlace firmado se lee con CORS (para pintarlo en un lienzo); un vídeo
// grabado en cámara lenta se abre a su velocidad (velocidadInicial); compacto: sin la tira ni el ajuste fino (dos ángulos).
// v0.59: una marca por repetición encima de la barra de tiempo («Rep 1…n», del análisis, del tempo o marcadas a mano), ir
// a la anterior o a la siguiente (con los botones o con [ y ]; las correcciones, con { y }), «la peor» señalada y, debajo,
// la tira de miniaturas para ir a un momento de un toque.
// v0.61: la «Estela del movimiento» (la trayectoria de la barra o de una articulación en los últimos fotogramas, que se va
// apagando; con «reducir movimiento», entera y quieta), encima de la imagen y en lo que graba el compositor; y j y l, un
// segundo atrás o adelante (k o espacio, reproducir o pausar).

// (v0.57) por id, una pila: el mismo vídeo puede estar a la vez en su tarjeta y en «Comparar»; manda el último abierto y, al
// cerrarse, vuelve el de antes
const reproductores = new Map(); // archivoId → [{ ahora(), ir(t), mostrar(dibujo), dibujar(alTerminar), fotograma(), … }]
export const reproductorDe = (archivoId) => reproductores.get(archivoId)?.at(-1) || null;

export const FOTOGRAMA = 1 / 30;
const VELOCIDADES = [[0.25, '0,25×'], [0.5, '0,5×'], [1, '1×']];
const HERRAMIENTAS = [['linea', 'Línea'], ['angulo', 'Ángulo'], ['flecha', 'Flecha'], ['circulo', 'Círculo'], ['lapiz', 'Lápiz'], ['texto', 'Texto']];
const PX_FOTOGRAMA = 8; // el ajuste fino: un fotograma cada 8 px de arrastre
const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Reproductor({ src, archivoId = null, serie = null, capas = null, repeticiones = false, cors = false, velocidadInicial = 1, compacto = false, etiqueta = null }) {
  const app = useApp();
  const v = useRef(null);
  const marco = useRef(null);
  const capaZoom = useRef(null);
  const audio = useRef(null);
  const [listo, setListo] = useState(false);
  const [jugando, setJugando] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [vel, setVel] = useState(VELOCIDADES.some(([x]) => x === velocidadInicial) ? velocidadInicial : 1);
  const [bucle, setBucle] = useState(true);
  // Dibujo: el que se enseña (de un comentario) o el que se está haciendo
  const [caja, setCaja] = useState({ w: 0, h: 0, vw: 0, vh: 0 });
  const [visto, setVisto] = useState(null);          // dibujo de un comentario, con su momento
  const [edicion, setEdicion] = useState(null);      // { formas, herramienta, color, enCurso, alTerminar, t0, hasta, texto }
  const edicionRef = useRef(null);
  edicionRef.current = edicion;
  // (v0.58) Elegir un punto de la imagen para el análisis: { texto, alElegir }
  const [eleccion, setEleccion] = useState(null);
  const eleccionRef = useRef(null);
  eleccionRef.current = eleccion;
  const capaAnalisis = useCapa(archivoId);
  const [zoom, setZoom] = useState({ z: 1, x: 0, y: 0 });
  const zoomRefVal = useRef(zoom);
  zoomRefVal.current = zoom;
  const gesto = useRef({ punteros: new Map(), inicio: null, toque: null });
  const ultimo = useRef({}); // lo de este pintado, para la API del reproductor (que se registra una vez)
  // Lo que corrige el coach (los comentarios del hilo y la corrección): marcas, dibujos con tramo y la voz
  const corr = useCorrecciones(archivoId);
  const marcas = useMemo(() => marcadores({ comentarios: corr.comentarios || [], revision: corr.revision || null, duracion: dur || null }), [corr.comentarios, corr.revision, dur]);
  const tramos = useMemo(() => (corr.comentarios || []).filter((c) => !c.eliminado_en && dibujoValido(c.dibujo) && c.dibujo.hasta != null).map((c) => c.dibujo), [corr.comentarios]);
  const r = corr.revision || null;
  // (v0.61) La estela del movimiento: del análisis guardado o del de esta sesión (y de sus puntos del cuerpo)
  const estela = useEstela(corr);
  // (v0.59) Las repeticiones: del análisis de esta sesión o del guardado, del tempo o marcadas a mano (el coach las guarda
  // en la corrección; el atleta, solo en su móvil)
  const esCoachRep = app?.perfil?.rol === 'coach';
  const [repsLocal, setRepsLocal] = useState([]);
  const manualActual = corr.repsManual?.length ? corr.repsManual : repsLocal;
  const repsTodas = useMemo(() => marcasRepeticiones({ sesion: corr.repsSesion || null, analisis: r?.analisis || null, tempo: r?.tempo || null, manual: manualActual, duracion: dur || null }),
    [corr.repsSesion, r?.analisis, r?.tempo, manualActual, dur]);
  const reps = repeticiones ? repsTodas : { fuente: 'no', reps: [] };
  const peor = useMemo(() => {
    const p = peorRepeticion({ reps: reps.reps, pose: corr.poseSesion || r?.analisis?.pose || null });
    const i = indicePeor(reps.reps, p);
    return p && i >= 0 ? { ...p, i } : null;
  }, [reps, corr.poseSesion, r?.analisis]);
  const voz = r?.voz_archivo_id && (r.voz?.ruta || r.vozUrl) ? { ruta: r.voz?.ruta || null, url: r.vozUrl || null, inicio: Number(r.voz_inicio) || 0, dur: Number(r.voz?.duracion_seg) || 0 } : null;
  const [vozActiva, setVozActiva] = useState(true);
  const [urlVoz, setUrlVoz] = useState(null);
  const clave = voz ? voz.url || voz.ruta : null;
  useEffect(() => {
    let vivo = true;
    setUrlVoz(voz?.url || null);
    if (voz && !voz.url && voz.ruta && app?.api) app.api.urlArchivo(voz.ruta, { tipo: 'audio' }).then((u) => vivo && setUrlVoz(u)).catch(() => {});
    return () => { vivo = false; };
  }, [clave]);

  // La voz, al ritmo del vídeo: suena mientras el vídeo pasa por su tramo, se pausa con él y va adonde va él
  const sincronizar = () => {
    const a = audio.current, x = v.current;
    if (!a || !x) return;
    if (!voz || !vozActiva) { if (!a.paused) a.pause(); return; }
    const tv = tiempoVoz(x.currentTime, voz.inicio, voz.dur || a.duration || 0);
    if (tv == null || x.paused || x.ended) { if (!a.paused) a.pause(); if (tv != null && Math.abs(a.currentTime - tv) > 0.05) { try { a.currentTime = tv; } catch { /* */ } } return; }
    try { if (Math.abs(a.currentTime - tv) > 0.25) a.currentTime = tv; a.playbackRate = x.playbackRate; } catch { /* */ }
    if (a.paused) a.play().catch(() => {});
  };
  useEffect(() => { sincronizar(); }, [vozActiva, urlVoz]);

  useEffect(() => {
    if (!archivoId) return undefined;
    const api = {
      ahora: () => v.current?.currentTime || 0,
      duracion: () => v.current?.duration || 0,
      ir: (seg) => {
        const el = v.current; if (!el) return;
        el.pause(); el.currentTime = Math.min(Math.max(0, seg), el.duration || seg);
        el.scrollIntoView?.({ block: 'nearest' });
      },
      reproducir: () => { const el = v.current; if (el && !edicionRef.current) el.play().catch(() => {}); },
      pausar: () => v.current?.pause(),
      velocidad: (x) => fijarVel(x),
      proporcion: () => { const el = v.current; return el?.videoWidth && el?.videoHeight ? el.videoWidth / el.videoHeight : 1; },
      // Si había un dibujo a medias, quien lo pidió se entera de que se ha descartado
      mostrar: (dibujo) => { edicionRef.current?.alTerminar?.(null); setEdicion(null); setVisto(dibujo); api.ir(dibujo.t); },
      dibujar: (alTerminar) => {
        edicionRef.current?.alTerminar?.(null); v.current?.pause(); setVisto(null);
        setEdicion({ formas: [], herramienta: 'linea', color: COLOR_DIBUJO, enCurso: null, alTerminar, t0: v.current?.currentTime || 0, hasta: null, texto: '' });
        v.current?.scrollIntoView?.({ block: 'nearest' });
      },
      // Este fotograma con lo que se ve dibujado encima, como imagen JPEG (para mandarla o guardarla)
      fotograma: () => ultimo.current.exportar(),
      // (v0.60) Lo que se ve ahora: para pintarlo igual en un lienzo («Grabar la revisión»)
      // (v0.61) y la estela, si está encendida: { puntos, ventana, estatica }
      estado: () => { const u = ultimo.current; return { formas: u.formas || [], zoom: u.zoom || { z: 1, x: 0, y: 0 }, caja: u.caja || { w: 0, h: 0 }, rect: u.rect || null, proporcion: u.proporcion || 1, vel: u.vel || 1, dibujando: !!u.dibujando, estela: u.estela || null }; },
      // (v0.58) Para el análisis: el vídeo (su dirección y el elemento) y elegir un punto de la imagen con un toque. Da
      // [x, y] de 0 a 1, o null si se cancela (o se pide otro)
      fuente: () => ultimo.current.src || null,
      elemento: () => v.current || null,
      elegirPunto: ({ texto = 'Toca la imagen' } = {}) => new Promise((ok) => {
        eleccionRef.current?.alElegir?.(null);
        edicionRef.current?.alTerminar?.(null); setEdicion(null);
        v.current?.pause();
        setEleccion({ texto, alElegir: ok });
        v.current?.scrollIntoView?.({ block: 'nearest' });
      }),
      cancelarEleccion: () => { const e = eleccionRef.current; setEleccion(null); e?.alElegir?.(null); },
    };
    reproductores.set(archivoId, [...(reproductores.get(archivoId) || []), api]);
    return () => {
      eleccionRef.current?.alElegir?.(null);
      const resto = (reproductores.get(archivoId) || []).filter((x) => x !== api);
      if (resto.length) reproductores.set(archivoId, resto); else reproductores.delete(archivoId);
    };
  }, [archivoId]);

  // El tamaño del vídeo en pantalla (para que el dibujo caiga sobre la imagen, no sobre las bandas negras)
  useEffect(() => {
    const el = v.current; if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const medir = () => setCaja({ w: el.clientWidth, h: el.clientHeight, vw: el.videoWidth, vh: el.videoHeight });
    const ro = new ResizeObserver(medir); ro.observe(el); medir();
    return () => ro.disconnect();
  }, [listo]);

  const el = () => v.current;
  const alternar = () => { const x = el(); if (!x || edicion) return; if (x.paused) x.play().catch(() => {}); else x.pause(); };
  const irA = (seg) => { const x = el(); if (!x) return; x.pause(); x.currentTime = Math.min(Math.max(0, seg), x.duration || 0); };
  const paso = (n) => { const x = el(); if (!x) return; irA(x.currentTime + n * FOTOGRAMA); };
  const fijarVel = (rr) => { setVel(rr); if (el()) el().playbackRate = rr; sincronizar(); };
  const ponerZoom = (z, centro = null) => {
    const zz = limitarZoom(z);
    setZoom((a) => {
      let x = a.x, y = a.y;
      // Acercar hacia un punto (dos toques, pellizco): ese punto se queda donde estaba
      if (centro && caja.w) { const k = zz / a.z; x = centro.x - (centro.x - a.x) * k; y = centro.y - (centro.y - a.y) * k; }
      if (zz === 1) { x = 0; y = 0; }
      return { z: zz, ...limitarPan({ x, y }, zz, caja.w, caja.h) };
    });
  };
  const tecla = (e) => {
    const tag = e.target.tagName;
    if (tag === 'TEXTAREA' || (tag === 'INPUT' && e.target.type !== 'range') || e.target.closest?.('.rep-jog')) return;
    if (tag === 'INPUT' && e.target.type === 'range' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); alternar(); }
    else if (e.key === ',' || (e.key === 'ArrowLeft' && !e.shiftKey)) { e.preventDefault(); paso(-1); }
    else if (e.key === '.' || (e.key === 'ArrowRight' && !e.shiftKey)) { e.preventDefault(); paso(1); }
    else if (e.key === 'j' || e.key === 'l') { e.preventDefault(); irA((el()?.currentTime || 0) + (e.key === 'l' ? 1 : -1)); }
    else if (e.key === 'ArrowLeft' && e.shiftKey) { e.preventDefault(); irA((el()?.currentTime || 0) - 0.5); }
    else if (e.key === 'ArrowRight' && e.shiftKey) { e.preventDefault(); irA((el()?.currentTime || 0) + 0.5); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); ponerZoom(zoom.z + 0.5); }
    else if (e.key === '-') { e.preventDefault(); ponerZoom(zoom.z - 0.5); }
    else if (e.key === '0') { e.preventDefault(); ponerZoom(1); }
    else if ((e.key === '[' || e.key === ']') && reps.reps.length) { const m = repVecina(reps.reps, el()?.currentTime || 0, e.key === ']' ? 1 : -1); e.preventDefault(); if (m) irA(m.t); }
    else if (e.key === '[' || e.key === ']' || e.key === '{' || e.key === '}') { const m = marcaVecina(marcas, el()?.currentTime || 0, e.key === ']' || e.key === '}' ? 1 : -1); if (m) { e.preventDefault(); irMarca(m); } }
  };
  // «Marcar rep» (a mano, si no salen solas): el coach las guarda en la corrección (si puede); el atleta, solo aquí
  const marcarRep = () => {
    const nuevo = anadirRepManual(manualActual, Math.round((el()?.currentTime || 0) * 100) / 100);
    if (esCoachRep && corr.guardarRepsManual) corr.guardarRepsManual(nuevo); else setRepsLocal(nuevo);
  };
  const borrarReps = () => { if (esCoachRep && corr.guardarRepsManual && corr.repsManual?.length) corr.guardarRepsManual([]); setRepsLocal([]); };
  // Un dibujo enseñado se quita al reproducir o al irse lejos de su momento (uno con tramo, al salir de él)
  const alTiempo = (tt) => { setT(tt); if (visto && !dibujoVisible(visto, tt)) setVisto(null); sincronizar(); };
  const irMarca = (m) => {
    const c = m.tipo === 'dibujo' ? (corr.comentarios || []).find((x) => x.id === m.id) : null;
    if (c && dibujoValido(c.dibujo)) { edicionRef.current?.alTerminar?.(null); setEdicion(null); setVisto(c.dibujo); }
    irA(m.t);
  };

  const rect = rectImagen(caja.w, caja.h, caja.vw, caja.vh);
  const proporcion = rect.h ? rect.w / rect.h : 1;
  const formas = edicion ? [...edicion.formas, ...(edicion.enCurso ? [edicion.enCurso] : [])]
    : [...(visto?.formas || []), ...tramos.filter((d) => d !== visto && dibujoVisible(d, t)).flatMap((d) => d.formas)];

  // Dibujar: una línea, una flecha o un círculo se arrastran; el lápiz sigue al dedo; un ángulo son tres toques (vértice
  // y los dos extremos); un texto, un toque donde va
  const aNorm = (e) => {
    const b = (capaZoom.current || marco.current).getBoundingClientRect();
    const lx = (e.clientX - b.left) * (caja.w / (b.width || 1)), ly = (e.clientY - b.top) * (caja.h / (b.height || 1));
    return [Math.min(1, Math.max(0, (lx - rect.x) / rect.w)), Math.min(1, Math.max(0, (ly - rect.y) / rect.h))];
  };
  const conColor = (f, ed) => (ed.color && ed.color !== COLOR_DIBUJO ? { ...f, c: ed.color } : f);
  const anadir = (ed, f) => (ed.formas.length < MAX_FORMAS ? [...ed.formas, conColor(f, ed)] : ed.formas);
  const alBajar = (e) => {
    const ed = edicionRef.current; if (!ed || !rect.w) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
    const p = aNorm(e);
    if (['linea', 'flecha', 'circulo'].includes(ed.herramienta)) setEdicion({ ...ed, enCurso: conColor({ tipo: ed.herramienta, p: [p, p], nuevo: true }, ed) });
    else if (ed.herramienta === 'lapiz') setEdicion({ ...ed, enCurso: conColor({ tipo: 'lapiz', p: [p], nuevo: true }, ed) });
    else if (ed.herramienta === 'texto') {
      const x = ed.texto.trim();
      if (x) setEdicion({ ...ed, formas: anadir(ed, { tipo: 'texto', p: [p], x: [...x].slice(0, MAX_TEXTO_DIBUJO).join('') }), texto: '' });
    } else {
      const actual = ed.enCurso && ed.enCurso.tipo === 'angulo' ? ed.enCurso : null;
      if (!actual) setEdicion({ ...ed, enCurso: conColor({ tipo: 'angulo', p: [p] }, ed) });
      else if (actual.p.length === 1) setEdicion({ ...ed, enCurso: { ...actual, p: [actual.p[0], p] } });
      else setEdicion({ ...ed, formas: anadir(ed, { tipo: 'angulo', p: [actual.p[0], actual.p[1], p] }), enCurso: null });
    }
  };
  const alMover = (e) => {
    const ed = edicionRef.current; if (!ed?.enCurso?.nuevo) return;
    const p = aNorm(e);
    if (ed.enCurso.tipo === 'lapiz') {
      const u = ed.enCurso.p[ed.enCurso.p.length - 1];
      if (Math.hypot((p[0] - u[0]) * proporcion, p[1] - u[1]) < 0.006) return;
      setEdicion({ ...ed, enCurso: { ...ed.enCurso, p: [...ed.enCurso.p, p] } });
    } else setEdicion({ ...ed, enCurso: { ...ed.enCurso, p: [ed.enCurso.p[0], p] } });
  };
  const alSoltar = (e) => {
    const ed = edicionRef.current; if (!ed?.enCurso?.nuevo) return;
    const { nuevo, ...f } = ed.enCurso;
    if (f.tipo === 'lapiz') { setEdicion({ ...ed, formas: f.p.length >= 2 ? anadir(ed, f) : ed.formas, enCurso: null }); return; }
    const [a, b] = [f.p[0], aNorm(e)];
    const larga = Math.hypot((a[0] - b[0]) * proporcion, a[1] - b[1]) > 0.03;
    setEdicion({ ...ed, formas: larga ? anadir(ed, { ...f, p: [a, b] }) : ed.formas, enCurso: null });
  };
  // Un gesto cancelado (la palma, el sistema) no deja nada
  const alCancelar = () => { const ed = edicionRef.current; if (ed?.enCurso) setEdicion({ ...ed, enCurso: null }); };
  const terminar = () => {
    // Con tramo, desde donde se empezó a dibujar hasta «Hasta aquí»; si no, en el fotograma en que está el vídeo
    const t0 = edicion.hasta != null ? edicion.t0 : el()?.currentTime || 0;
    const d = limpiarDibujo(t0, edicion.formas, { hasta: edicion.hasta });
    edicion.alTerminar?.(d);
    setEdicion(null);
    if (d) setVisto(d);
  };

  // Zoom y mover la imagen: pellizcar (dos dedos), dos toques (o doble clic) y arrastrar con zoom; nunca mientras se dibuja
  const centroDe = (e) => { const b = marco.current.getBoundingClientRect(); return { x: e.clientX - b.left - b.width / 2, y: e.clientY - b.top - b.height / 2 }; };
  const gBajar = (e) => {
    if (edicionRef.current || eleccionRef.current || e.button > 0) return;
    const g = gesto.current;
    g.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.punteros.size === 2) {
      const [a, b] = [...g.punteros.values()];
      g.inicio = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: zoomRefVal.current.z, pan: { x: zoomRefVal.current.x, y: zoomRefVal.current.y }, c: centroDe({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }), movido: true };
    } else if (g.punteros.size === 1) g.inicio = { x: e.clientX, y: e.clientY, pan: { x: zoomRefVal.current.x, y: zoomRefVal.current.y }, t: performance.now(), movido: false };
  };
  const gMover = (e) => {
    const g = gesto.current;
    if (!g.punteros.has(e.pointerId) || !g.inicio) return;
    g.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.punteros.size === 2 && g.inicio.d) {
      const [a, b] = [...g.punteros.values()];
      const z = limitarZoom(g.inicio.z * (Math.hypot(a.x - b.x, a.y - b.y) / g.inicio.d));
      const k = z / g.inicio.z, c = g.inicio.c;
      setZoom({ z, ...limitarPan({ x: c.x - (c.x - g.inicio.pan.x) * k, y: c.y - (c.y - g.inicio.pan.y) * k }, z, caja.w, caja.h) });
    } else if (g.punteros.size === 1 && zoomRefVal.current.z > 1 && g.inicio.x != null) {
      const dx = e.clientX - g.inicio.x, dy = e.clientY - g.inicio.y;
      if (Math.hypot(dx, dy) > 6) g.inicio.movido = true;
      if (g.inicio.movido) setZoom((zz) => ({ ...zz, ...limitarPan({ x: g.inicio.pan.x + dx, y: g.inicio.pan.y + dy }, zz.z, caja.w, caja.h) }));
    }
  };
  const gSoltar = (e) => {
    const g = gesto.current;
    const ini = g.inicio;
    g.punteros.delete(e.pointerId);
    if (g.punteros.size === 0) g.inicio = null;
    // Dos toques seguidos con el dedo: acerca a ese punto (o vuelve al tamaño normal)
    if (e.pointerType === 'touch' && ini && !ini.movido && ini.t && performance.now() - ini.t < 260) {
      const ahora = performance.now();
      const prev = g.toque;
      if (prev && ahora - prev.t < 320 && Math.hypot(prev.x - e.clientX, prev.y - e.clientY) < 30) {
        g.toque = null; g.zoomEn = ahora;
        ponerZoom(zoomRefVal.current.z > 1 ? 1 : 2.5, centroDe(e));
      } else g.toque = { t: ahora, x: e.clientX, y: e.clientY };
    }
    if (ini?.movido) g.arrastrado = performance.now();
  };
  // El clic en el vídeo reproduce o pausa (no si acaba de moverse la imagen con el zoom)
  const clicVideo = () => { if (performance.now() - (gesto.current.arrastrado || 0) < 250) return; alternar(); };
  const dobleClic = (e) => { if (performance.now() - (gesto.current.zoomEn || 0) < 500) return; ponerZoom(zoom.z > 1 ? 1 : 2.5, centroDe(e)); };

  // Este fotograma (y lo que se ve dibujado) en un lienzo, como JPEG. El vídeo de un enlace firmado de Storage se lee con
  // CORS en otro <video> (crossOrigin): si el servidor no lo deja, el lienzo quedaría «manchado» y no se podría exportar.
  async function exportarFotograma() {
    const x = el();
    if (!x?.videoWidth) throw new Error('El vídeo aún no está listo');
    const w = x.videoWidth, h = x.videoHeight, k = Math.min(1, 1600 / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    const ctx = c.getContext('2d');
    const mismoOrigen = /^blob:|^data:/.test(x.currentSrc || src || '');
    const fuente = mismoOrigen ? x : await videoConCors(src, x.currentTime);
    try {
      ctx.drawImage(fuente, 0, 0, c.width, c.height);
      pintarFormas(ctx, formas, c.width, c.height, proporcion);
      return await new Promise((ok, mal) => {
        try { c.toBlob((b) => (b ? ok(b) : mal(new Error('No se ha podido preparar la imagen'))), 'image/jpeg', 0.9); } catch (e) { mal(e); }
      });
    } catch (e) {
      if (e?.name === 'SecurityError') throw new Error('Este navegador no deja sacar la imagen de este vídeo: haz una captura de pantalla.');
      throw e;
    } finally { if (fuente !== x) { try { fuente.removeAttribute('src'); fuente.load(); } catch { /* */ } } }
  }

  ultimo.current.exportar = exportarFotograma;
  ultimo.current.src = src;
  Object.assign(ultimo.current, { formas, zoom, caja, rect, proporcion, vel, dibujando: !!edicion, estela: estelaParaCompositor(estela) });
  const elegir = (e) => {
    const el2 = eleccionRef.current; if (!el2 || !rect.w) return;
    e.preventDefault(); e.stopPropagation();
    const p = aNorm(e);
    setEleccion(null);
    el2.alElegir?.(p);
  };
  const pintarCapa = capas || capaAnalisis;
  const zoomEstilo = zoom.z > 1 || zoom.x || zoom.y ? { transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.z})` } : undefined;
  const totalFotogramas = Math.max(1, Math.round((dur || 0) / FOTOGRAMA));
  return (
    <div class={`reproductor ${edicion ? 'dibujando' : ''} ${eleccion ? 'eligiendo' : ''} ${zoom.z > 1 ? 'con-zoom' : ''}`} onKeyDown={tecla}>
      <div class="rep-marco" ref={marco} onPointerDown={gBajar} onPointerMove={gMover} onPointerUp={gSoltar} onPointerCancel={gSoltar}>
        <div class={`rep-zoom ${sinMovimiento() ? '' : 'suave'}`} ref={capaZoom} style={zoomEstilo}>
          <video class="medio" ref={v} src={src} playsInline preload="metadata" loop={bucle} crossOrigin={cors && !/^blob:|^data:/.test(src || '') ? 'anonymous' : undefined}
            aria-label={etiqueta || undefined}
            onLoadedMetadata={(e) => { setDur(e.currentTarget.duration || 0); setListo(true); e.currentTarget.playbackRate = vel; }}
            onTimeUpdate={(e) => alTiempo(e.currentTarget.currentTime)} onSeeked={(e) => alTiempo(e.currentTarget.currentTime)}
            onPlay={() => { setJugando(true); if (visto && visto.hasta == null) setVisto(null); sincronizar(); }} onPause={() => { setJugando(false); sincronizar(); }}
            onRateChange={sincronizar} onClick={clicVideo} onDblClick={dobleClic} />
          {pintarCapa && rect.w > 0 && <div class="rep-capas" aria-hidden="true">{pintarCapa({ rect, caja, t, dur, proporcion, video: v.current, jugando })}</div>}
          {estela.activa && rect.w > 0 && <div class="rep-capas rep-capa-estela" aria-hidden="true"><CapaEstela estela={estela} rect={rect} caja={caja} t={t} video={v.current} /></div>}
          {(formas.length > 0 || edicion) && rect.w > 0 && (
            <svg class={`rep-lienzo ${edicion ? '' : 'solo-ver'}`} viewBox={`0 0 ${caja.w} ${caja.h}`} role="img" aria-label={formas.length ? `Dibujo: ${describirDibujo({ formas }, proporcion)}` : 'Lienzo para dibujar sobre el vídeo'}
              onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alCancelar}>
              {formas.map((f, i) => <Forma key={i} f={f} rect={rect} proporcion={proporcion} />)}
            </svg>
          )}
        </div>
        {eleccion && rect.w > 0 && (
          <div class="rep-elegir" onPointerDown={elegir}>
            <span class="rep-elegir-texto" role="status">{eleccion.texto}</span>
          </div>
        )}
        {serie && <span class="rep-serie num">{serie}</span>}
        {zoom.z > 1 && <span class="rep-zoom-nivel num" aria-hidden="true">{String(Math.round(zoom.z * 10) / 10).replace('.', ',')}×</span>}
      </div>
      {edicion ? (
        <BarraDibujo edicion={edicion} setEdicion={setEdicion} terminar={terminar} ahora={t} />
      ) : (
        <div class="rep-barra">
          <button class="btn btn-icono plano" onClick={alternar} aria-label={jugando ? 'Pausar' : 'Reproducir'} disabled={!listo}><Icono n={jugando ? 'pausa' : 'play'} /></button>
          <div class={`rep-pista-tiempo ${marcas.length ? 'con-marcas' : ''} ${reps.reps.length && dur > 0 ? 'con-reps' : ''}`}>
            {reps.reps.length > 0 && dur > 0 && (
              <div class="rep-reps-marcas" role="group" aria-label={`Repeticiones (${reps.reps.length})`}>
                {reps.reps.map((m, i) => (
                  <button key={`rep-${m.n}-${m.t}`} type="button" class={`rep-rep ${peor?.i === i ? 'peor' : ''} ${repActual(reps.reps, t) === i ? 'actual' : ''}`} style={{ left: `${Math.min(100, (m.t / dur) * 100)}%` }}
                    aria-label={etiquetaRep(m, peor?.i === i)} title={etiquetaRep(m, peor?.i === i)} onClick={() => irA(m.t)}>
                    <span aria-hidden="true">{reps.reps.length <= 12 ? m.n : ''}</span>
                  </button>
                ))}
              </div>
            )}
            <input type="range" class="rep-tiempo" min="0" max={dur || 0} step="0.01" value={t} aria-label="Momento del vídeo" aria-valuetext={textoMomento(t, true)}
              onInput={(e) => { const x = el(); if (x) { x.pause(); x.currentTime = Number(e.currentTarget.value); } }} disabled={!listo} />
            {marcas.length > 0 && dur > 0 && (
              <div class="rep-marcas" role="group" aria-label={`Correcciones en el vídeo (${marcas.length})`}>
                {marcas.map((m) => (
                  <button key={`${m.tipo}-${m.id}-${m.t}`} type="button" class={`rep-marca rep-marca-${m.tipo}`} style={{ left: `${Math.min(100, (m.t / dur) * 100)}%` }}
                    aria-label={`Ir a: ${m.etiqueta}`} title={m.etiqueta} onClick={() => irMarca(m)}><span aria-hidden="true" /></button>
                ))}
              </div>
            )}
          </div>
          <span class="num mini rep-reloj">{textoMomento(t, vel < 1)}<span class="terciario"> / {textoMomento(dur)}</span></span>
        </div>
      )}
      {!compacto && <AjusteFino t={t} dur={dur} total={totalFotogramas} irA={irA} listo={listo} ahora={() => el()?.currentTime || 0} />}
      {!edicion && !compacto && <TiraMiniaturas src={src} clave={archivoId || src} dur={dur} t={t} irA={irA} listo={listo} />}
      {repeticiones && !edicion && listo && (reps.reps.length > 0 || reps.fuente == null) && (
        <div class="rep-reps-mando fila-envolver" role="group" aria-label="Repeticiones">
          {reps.reps.length > 0 && (
            <>
              <button type="button" class="btn btn-peq" aria-label="Repetición anterior" onClick={() => { const m = repVecina(reps.reps, el()?.currentTime || 0, -1); if (m) irA(m.t); }}><Icono n="atras" /> Rep.</button>
              <span class="mini num rep-reps-cual" aria-live="polite">{repActual(reps.reps, t) >= 0 ? `Rep. ${repActual(reps.reps, t) + 1} de ${reps.reps.length}` : `${reps.reps.length} rep.`}<span class="terciario"> {NOMBRE_FUENTE_REPS[reps.fuente] || ''}</span></span>
              <button type="button" class="btn btn-peq" aria-label="Repetición siguiente" onClick={() => { const m = repVecina(reps.reps, el()?.currentTime || 0, 1); if (m) irA(m.t); }}>Rep. <Icono n="derecha" /></button>
              {peor && <button type="button" class="btn btn-peq rep-peor" onClick={() => irA(reps.reps[peor.i].t)}><Icono n="alerta" /> La peor: la {peor.i + 1}.ª, {peor.texto}</button>}
            </>
          )}
          {(reps.fuente == null || reps.fuente === 'manual') && (
            <>
              <button type="button" class="btn btn-peq plano" onClick={marcarRep} aria-label="Marcar una repetición aquí"><Icono n="chincheta" /> Marcar rep</button>
              {reps.fuente === 'manual' && <button type="button" class="btn btn-peq plano" onClick={borrarReps}>Borrar las marcas</button>}
              {reps.fuente == null && <span class="mini terciario">Para el vídeo al empezar cada repetición y márcala{esCoachRep ? '' : ' (solo en tu móvil)'}.</span>}
            </>
          )}
        </div>
      )}
      <div class="rep-controles">
        <div class="segmentos rep-vel" role="group" aria-label="Velocidad">
          {VELOCIDADES.map(([rr, txt]) => <button key={rr} type="button" aria-pressed={vel === rr ? 'true' : 'false'} onClick={() => fijarVel(rr)} disabled={!!edicion}>{txt}</button>)}
        </div>
        <button class="btn btn-icono" onClick={() => paso(-1)} aria-label="Fotograma anterior" disabled={!listo}><Icono n="atras" /></button>
        <button class="btn btn-icono" onClick={() => paso(1)} aria-label="Fotograma siguiente" disabled={!listo}><Icono n="derecha" /></button>
        <button class="btn btn-icono" aria-pressed={bucle ? 'true' : 'false'} onClick={() => setBucle(!bucle)} aria-label="Repetir en bucle" disabled={!!edicion}><Icono n="reiniciar" /></button>
        <span class="rep-zoom-botones" role="group" aria-label="Zoom">
          <button class="btn btn-icono" onClick={() => ponerZoom(zoom.z - 0.5)} aria-label="Alejar la imagen" disabled={!listo || zoom.z <= 1}><Icono n="menos" /></button>
          <button class="btn btn-icono" onClick={() => ponerZoom(zoom.z + 0.5)} aria-label="Acercar la imagen" disabled={!listo || zoom.z >= ZOOM_MAX}><Icono n="mas" /></button>
          {zoom.z > 1 && <button class="btn btn-peq" onClick={() => ponerZoom(1)}>Tamaño normal</button>}
        </span>
        <MandosEstela estela={estela} desactivado={!!edicion} />
        {voz && (
          <button class="btn btn-peq rep-voz" aria-pressed={vozActiva ? 'true' : 'false'} onClick={() => setVozActiva(!vozActiva)}>
            <Icono n="micro" /> Voz del coach{vozActiva ? '' : ' (silenciada)'}
          </button>
        )}
        {visto && !edicion && <button class="btn btn-peq" onClick={() => setVisto(null)}><Icono n="cerrar" /> Quitar el dibujo</button>}
      </div>
      {voz && urlVoz && <audio ref={audio} src={urlVoz} preload="auto" onLoadedMetadata={sincronizar} aria-hidden="true" />}
    </div>
  );
}

// El ajuste fino: arrastrar a los lados mueve fotograma a fotograma (como una rueda de edición); con el teclado, ← → un
// fotograma, Re Pág / Av Pág diez, Inicio y Fin
function AjusteFino({ t, dur, total, irA, listo, ahora }) {
  const g = useRef(null);
  const actual = Math.round(t / FOTOGRAMA);
  // (desde donde está el vídeo de verdad: varias pulsaciones seguidas no esperan a que se pinte)
  const deVerdad = () => Math.round(ahora() / FOTOGRAMA);
  const ir = (n) => irA(Math.max(0, Math.min(total, n)) * FOTOGRAMA);
  const tecla = (e) => {
    const m = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 }[e.key];
    if (m != null) { e.preventDefault(); e.stopPropagation(); ir(deVerdad() + m); }
    else if (e.key === 'Home') { e.preventDefault(); e.stopPropagation(); ir(0); }
    else if (e.key === 'End') { e.preventDefault(); e.stopPropagation(); ir(total); }
  };
  return (
    <div class="rep-jog" role="slider" tabIndex={listo ? 0 : -1} aria-label="Ajuste fino, fotograma a fotograma" aria-disabled={listo ? undefined : 'true'}
      aria-valuemin={0} aria-valuemax={total} aria-valuenow={actual} aria-valuetext={`Fotograma ${actual}, ${textoMomento(t, true)}`}
      style={{ '--jog': `${-(actual % 12) * PX_FOTOGRAMA}px` }} onKeyDown={tecla}
      onPointerDown={(e) => { if (!listo || e.button > 0) return; g.current = { x: e.clientX, n: actual }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ } }}
      onPointerMove={(e) => { const x = g.current; if (!x) return; const n = x.n + Math.round((e.clientX - x.x) / PX_FOTOGRAMA); if (n !== actual) ir(n); }}
      onPointerUp={() => { g.current = null; }} onPointerCancel={() => { g.current = null; }}>
      <span class="rep-jog-rayas" aria-hidden="true" />
      <span class="rep-jog-centro" aria-hidden="true" />
      <span class="mini terciario rep-jog-texto" aria-hidden="true">‹ arrastra · fotograma {actual} ›</span>
    </div>
  );
}

// Las herramientas mientras se dibuja: la forma, el color, «Hasta aquí» (el tramo), deshacer, cancelar y «Hecho»
function BarraDibujo({ edicion, setEdicion, terminar, ahora }) {
  const ed = edicion;
  const cambiar = (c) => setEdicion({ ...ed, ...c });
  const pista = ed.formas.length >= MAX_FORMAS ? `Ya hay ${MAX_FORMAS} formas: deshaz alguna para añadir otra. ` : '';
  const que = {
    linea: 'Arrastra para trazar una línea.', flecha: 'Arrastra desde donde empieza la flecha hasta adonde apunta.', circulo: 'Arrastra desde el centro hasta el borde.',
    lapiz: 'Dibuja con el dedo.', texto: ed.texto.trim() ? 'Toca donde va el texto.' : 'Escribe el texto y toca donde va.',
    angulo: ed.enCurso ? (ed.enCurso.p.length === 1 ? 'Ahora, un extremo.' : 'Y el otro extremo.') : 'Toca el vértice del ángulo.',
  }[ed.herramienta];
  return (
    <div class="rep-dibujo" role="group" aria-label="Dibujar sobre el vídeo">
      <div class="segmentos rep-herramientas" role="group" aria-label="Herramienta">
        {HERRAMIENTAS.map(([k, txt]) => <button key={k} type="button" aria-pressed={ed.herramienta === k ? 'true' : 'false'} onClick={() => cambiar({ herramienta: k, enCurso: null })}>{txt}</button>)}
      </div>
      <div class="rep-colores" role="group" aria-label="Color">
        {COLORES_DIBUJO.map(([k, nombre, hex]) => (
          <button key={k} type="button" class="rep-color" aria-pressed={ed.color === k ? 'true' : 'false'} aria-label={nombre} title={nombre} style={{ '--c': hex }} onClick={() => cambiar({ color: k })}><span aria-hidden="true" /></button>
        ))}
      </div>
      {ed.herramienta === 'texto' && (
        <input class="entrada rep-texto" type="text" maxLength={MAX_TEXTO_DIBUJO} value={ed.texto} aria-label="Texto de la etiqueta" placeholder="Por ejemplo: rodillas fuera"
          onInput={(e) => cambiar({ texto: e.currentTarget.value })} />
      )}
      <div class="rep-tramo">
        {ed.hasta != null
          ? <span class="mini">Visible de <b class="num">{textoMomento(ed.t0, true)}</b> a <b class="num">{textoMomento(ed.hasta, true)}</b> <button type="button" class="btn-texto mini" onClick={() => cambiar({ hasta: null })}>Quitar el tramo</button></span>
          : <span class="mini secundario">Se verá en este fotograma.</span>}
        <button type="button" class="btn btn-peq" disabled={!(ahora > ed.t0 + 0.1)} onClick={() => cambiar({ hasta: ahora })} aria-label="Que se vea hasta este momento">Hasta aquí</button>
      </div>
      <button type="button" class="btn btn-icono" aria-label="Deshacer la última forma" disabled={!ed.formas.length && !ed.enCurso} onClick={() => cambiar({ formas: ed.enCurso ? ed.formas : ed.formas.slice(0, -1), enCurso: null })}><Icono n="reiniciar" /></button>
      <button type="button" class="btn" onClick={() => { ed.alTerminar?.(null); setEdicion(null); }}>Cancelar</button>
      <button type="button" class="btn btn-primario" disabled={!ed.formas.length} onClick={terminar}><Icono n="hecho" /> Hecho</button>
      <span class="mini secundario rep-pista">{pista}{que}{' '}Mueve el vídeo con los botones de fotograma{ed.hasta == null ? ' (y, para que se vea un rato, «Hasta aquí»)' : ''}.</span>
    </div>
  );
}

// Una forma en píxeles de la imagen, con su color
function Forma({ f, rect, proporcion }) {
  const X = (p) => rect.x + p[0] * rect.w, Y = (p) => rect.y + p[1] * rect.h;
  const puntos = f.p.map((p) => [X(p), Y(p)]);
  const estilo = { '--c': HEX_COLOR[f.c] || HEX_COLOR[COLOR_DIBUJO] };
  if (f.tipo === 'linea') {
    const [a, b] = puntos;
    return <g class="forma" style={estilo}><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} /><circle cx={a[0]} cy={a[1]} r="4" /><circle cx={b[0]} cy={b[1]} r="4" /></g>;
  }
  if (f.tipo === 'flecha') {
    const [a, b] = puntos;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = 14;
    const p1 = [b[0] - L * Math.cos(ang - 0.45), b[1] - L * Math.sin(ang - 0.45)], p2 = [b[0] - L * Math.cos(ang + 0.45), b[1] - L * Math.sin(ang + 0.45)];
    return <g class="forma flecha" style={estilo}><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} /><polygon points={`${b[0]},${b[1]} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`} /></g>;
  }
  if (f.tipo === 'circulo') {
    const [c, b] = puntos;
    return <g class="forma aro" style={estilo}><circle class="aro" cx={c[0]} cy={c[1]} r={Math.max(4, Math.hypot(b[0] - c[0], b[1] - c[1]))} /></g>;
  }
  if (f.tipo === 'lapiz') return <g class="forma trazo" style={estilo}><polyline points={puntos.map((p) => p.join(',')).join(' ')} /></g>;
  if (f.tipo === 'texto') { const [p] = puntos; return <g class="forma etiqueta" style={estilo}><text x={p[0]} y={p[1]}>{f.x}</text></g>; }
  const [v, a, b] = puntos;
  const g = f.p.length === 3 ? grados(f.p, proporcion) : null;
  // El arco del ángulo, pequeño, en el vértice
  let arco = null;
  if (a && b) {
    const r = Math.min(28, Math.hypot(a[0] - v[0], a[1] - v[1]) * 0.5, Math.hypot(b[0] - v[0], b[1] - v[1]) * 0.5);
    const a1 = Math.atan2(a[1] - v[1], a[0] - v[0]), a2 = Math.atan2(b[1] - v[1], b[0] - v[0]);
    let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    const p1 = [v[0] + r * Math.cos(a1), v[1] + r * Math.sin(a1)], p2 = [v[0] + r * Math.cos(a2), v[1] + r * Math.sin(a2)];
    arco = <path class="arco" d={`M${p1[0]} ${p1[1]} A${r} ${r} 0 0 ${d > 0 ? 1 : 0} ${p2[0]} ${p2[1]}`} />;
  }
  return (
    <g class="forma" style={estilo}>
      {a && <line x1={v[0]} y1={v[1]} x2={a[0]} y2={a[1]} />}
      {b && <line x1={v[0]} y1={v[1]} x2={b[0]} y2={b[1]} />}
      {arco}
      {puntos.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === 0 ? 5 : 4} />)}
      {g != null && <text x={v[0] + 10} y={v[1] - 10} class="num">{g}°</text>}
    </g>
  );
}

// Las mismas formas en un lienzo (para exportar el fotograma), en píxeles de la imagen
export function pintarFormas(ctx, formas, W, H, proporcion = 1) {
  const k = Math.max(1, W / 360);
  const X = (p) => p[0] * W, Y = (p) => p[1] * H;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const f of formas || []) {
    const color = HEX_COLOR[f.c] || HEX_COLOR[COLOR_DIBUJO];
    const ps = f.p.map((p) => [X(p), Y(p)]);
    const trazo = (dib) => { ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 5 * k; ctx.beginPath(); dib(); ctx.stroke(); ctx.strokeStyle = color; ctx.lineWidth = 3 * k; ctx.beginPath(); dib(); ctx.stroke(); ctx.restore(); };
    if (f.tipo === 'linea' || f.tipo === 'flecha' || f.tipo === 'angulo') {
      const pares = f.tipo === 'angulo' ? ps.slice(1).map((p) => [ps[0], p]) : [[ps[0], ps[1]]];
      for (const [a, b] of pares) trazo(() => { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); });
      if (f.tipo === 'flecha') {
        const [a, b] = ps; const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); const L = 14 * k;
        ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(b[0], b[1]);
        ctx.lineTo(b[0] - L * Math.cos(ang - 0.45), b[1] - L * Math.sin(ang - 0.45)); ctx.lineTo(b[0] - L * Math.cos(ang + 0.45), b[1] - L * Math.sin(ang + 0.45)); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      if (f.tipo === 'angulo') {
        const gr = grados(f.p, proporcion);
        if (gr != null) { ctx.save(); ctx.font = `700 ${Math.round(15 * k)}px system-ui, sans-serif`; ctx.lineWidth = 3 * k; ctx.strokeStyle = '#1D1933'; ctx.fillStyle = '#fff'; ctx.strokeText(`${gr}°`, ps[0][0] + 10 * k, ps[0][1] - 10 * k); ctx.fillText(`${gr}°`, ps[0][0] + 10 * k, ps[0][1] - 10 * k); ctx.restore(); }
      }
    } else if (f.tipo === 'circulo') {
      const [c, b] = ps; const rr = Math.max(4, Math.hypot(b[0] - c[0], b[1] - c[1]));
      trazo(() => ctx.arc(c[0], c[1], rr, 0, Math.PI * 2));
    } else if (f.tipo === 'lapiz') {
      trazo(() => { ps.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); });
    } else if (f.tipo === 'texto') {
      ctx.save(); ctx.font = `800 ${Math.round(16 * k)}px system-ui, sans-serif`; ctx.lineWidth = 4 * k; ctx.strokeStyle = '#1D1933'; ctx.fillStyle = color;
      ctx.strokeText(f.x, ps[0][0], ps[0][1]); ctx.fillText(f.x, ps[0][0], ps[0][1]); ctx.restore();
    }
  }
}

// Otro <video> del mismo archivo, leído con CORS, en el momento t (para exportar un fotograma de un enlace firmado)
function videoConCors(src, t) {
  return new Promise((ok, mal) => {
    const x = document.createElement('video');
    x.crossOrigin = 'anonymous'; x.muted = true; x.playsInline = true; x.preload = 'auto';
    const fin = setTimeout(() => mal(new Error('El vídeo no responde: prueba otra vez')), 12000);
    x.onerror = () => { clearTimeout(fin); mal(new Error('Este navegador no deja sacar la imagen de este vídeo: haz una captura de pantalla.')); };
    x.onloadeddata = () => { try { x.currentTime = t; } catch { clearTimeout(fin); mal(new Error('No se ha podido ir a ese momento')); } };
    x.onseeked = () => { clearTimeout(fin); ok(x); };
    x.src = src;
  });
}

// Texto de un comentario con sus minutos como botones que llevan al momento del vídeo
export function TextoConMomentos({ texto, archivoId }) {
  const partes = partirMomentos(texto);
  if (!archivoId || !partes.some((p) => p.momento)) return texto;
  return partes.map((p, i) => (p.momento
    ? <button key={i} type="button" class="marca-tiempo num" onClick={() => reproductorDe(archivoId)?.ir(p.t)} aria-label={`Ir al ${p.momento} del vídeo`}>{p.momento}</button>
    : p.texto));
}

// El botón de un comentario con dibujo: «Ver el dibujo (0:04)»
export function BotonDibujo({ dibujo, archivoId }) {
  if (!dibujo || !archivoId) return null;
  return (
    <button type="button" class="btn btn-peq boton-dibujo" onClick={() => reproductorDe(archivoId)?.mostrar(dibujo)}>
      <Icono n="regla" /> Ver el dibujo <span class="num">({textoMomento(dibujo.t, true)}{dibujo.hasta != null ? `–${textoMomento(dibujo.hasta, true)}` : ''})</span>
    </button>
  );
}
