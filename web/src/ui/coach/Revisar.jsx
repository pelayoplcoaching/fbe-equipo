import { createContext } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { ChipLlegada } from '../atleta/Preparacion.jsx';
import { CabeceraGrande, Siluetas, Reserva, useApp, useCarga, Icono, ErrorCaja, cuando, Avatar, Hoja, usePreferencia, Vacio } from '../comunes.jsx';
import { agruparPorAtleta, textoTipos, esDeslizar, duracionCorta } from '../../logica/diseno.js';
import { vibrar } from '../hapticos.js';
import { salirSuave } from '../transiciones.js';
import { cardioHechoValido, textoCardioHecho, NOMBRE_MODALIDAD } from '../../logica/cardio.js';
import { BandaDemo } from '../App.jsx';
import { Hilo } from '../Hilo.jsx';
import { VerArchivo, CompararVideos } from '../Archivos.jsx';
import { PanelCorreccion } from '../tecnica/Correccion.jsx';
import { RevisionSeguida } from '../tecnica/RevisionSeguida.jsx';
import { RevisionSesion } from '../tecnica/RevisionSesion.jsx';
import { RevisionEnColumnas } from '../tecnica/RevisionColumnas.jsx';
import { agruparPorSesion, tituloSesion } from '../../logica/sesionVideos.js';
import { videosQueEsperan } from '../../logica/cierre.js';
import { CabCoach } from './CabCoach.jsx';
import { ESCALAS, NOMBRE_ZONA, num } from '../../logica/calculos.js';
import { fmtConDia, rangoSemana, hoyISO } from '../../logica/fechas.js';
import { NOMBRE_TOMA } from '../../logica/comidas.js';
import { TarjetaTarea } from '../Tareas.jsx';
import { HojaPropuesta } from './PropuestasObjetivo.jsx';
import { textoPropuesta, NOMBRE_TIPO_PROPUESTA } from '../../logica/objetivos-atleta.js';
import { fmtCorta } from '../../logica/fechas.js';
import { horasEsperando, textoEspera, nivelEspera, NOMBRE_NIVEL_ESPERA, ordenarGruposPorEspera, OBJETIVOS_REVISION, OBJETIVO_REVISION, textoHoras, textoAutoevaluacion } from '../../logica/correccion.js';
import {
  fechaItem, urgenciaItem, urgenciaGrupo, ordenarUrgente, pesoUrgencia, agruparPorDia, pospuestosVigentes, posponer, sinPosponer, coincideNombre,
  separarNuevas, revisablesDe, bandejaSin, textoContexto, textoCuentaDia,
  apartadaHoy, fijada as esFijada, MOTIVOS_REVISAR, cumpleMotivo, frasesPara, conDia, rachaCeros, textoRacha, textoResumenTanda,
  borradorTarjeta, variablesDe, rellenarFrase, siguienteImportante, minutosRestantes, textoRestante, etiquetasDe, esDeslizarIzquierda, conOp,
} from '../../logica/revisar.js';
import { DetalleSesion, MarcasSesion, CambiosCheckin, LoQueLeDijiste, HojaVoz, HojaRevisadosHoy, useFrasesRevisar } from './RevisarExtra.jsx';
import { useApartados, usePreferenciasFrases, HojaFrases, MasAcciones, HojaNotaRevision, HojaTiempos, HojaAtajos, HojaFotos, UltimosMensajes, UnoAUno, ListaColumnas, HojaContestarVarias, HojaProgramada, HojaEtiqueta, HojaChat } from './RevisarMas.jsx';
import { HojaNuevaTarea } from '../Tareas.jsx';
import { AudiosSinEscuchar } from './RevisionTodo.jsx';
import { Linea } from './RevisionProgreso.jsx';
import { textoCardio } from '../../logica/cardio.js';
import { HojaProgramar } from './RevisionTodo.jsx';

// «Deshacer» en el aviso: vuelve a dejarlo pendiente
// (los botones cuya acción tiene «Deshacer» llevan data-deshacer: solo esos se pueden pulsar deslizando la tarjeta)
// (v0.196) el último «Deshacer» se recuerda: la tecla «u» lo hace
let ultimoDeshacer = null;
const recordarDeshacer = (d) => { ultimoDeshacer = d; return d; };
const deshacer = (api, tipo, id, recargar) => recordarDeshacer({ texto: 'Deshacer', fn: async () => { await api.marcarRevisado(tipo, id, false); recargar(); } });

// (v0.195) lo que comparten las tarjetas: tus frases, los récords de cada sesión, apartar hasta mañana, la nota de voz,
// programar y contestar «Visto»
const CtxRevisar = createContext({});
const nuevoId = (p) => globalThis.crypto?.randomUUID?.() || `${p}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const sinMovimiento = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } };

// La tarjeta que viene después de esta (o la de antes, si era la última): a ella pasa el foco cuando esta se va
function tarjetaSiguiente(caja, el) {
  const t = [...(caja?.querySelectorAll('.tarjeta-revisar') || [])];
  const yo = el?.querySelector?.('.tarjeta-revisar') || el?.closest?.('.tarjeta-revisar') || null;
  const i = t.indexOf(yo);
  if (i < 0) return null;
  return t[i + 1] || t[i - 1] || null;
}
function irA(t) {
  if (!t?.isConnected) return;
  t.focus({ preventScroll: true });
  t.scrollIntoView({ block: 'nearest', behavior: sinMovimiento() ? 'auto' : 'smooth' });
}

// Atajos de teclado (como en Superhuman o Linear): j/k moverse, r responder, e revisado, o abrir la ficha
// v0.50: «r», «e» y «o» solo actúan sobre la tarjeta que tiene el foco (tras plegar un grupo o cambiar el filtro, la
// posición de antes ya no es la misma tarjeta); clave: lo que cambia la lista (filtro y grupos plegados)
// (v0.195) y «v» contesta «Visto», «m» lo deja para mañana
// (v0.196) y «p» programar, «u» deshacer lo último, «b» buscar (la «/» ya abre el buscador de la app), «?» ver las teclas; en dos columnas, j/k cambian de tarjeta
function useAtajos(caja, n, clave = '', extra = {}) {
  const [i, setI] = useState(-1);
  const extraRef = useRef(extra);
  extraRef.current = extra;
  useEffect(() => { setI(-1); }, [clave]);
  useEffect(() => {
    const tarjetas = () => [...(caja.current?.querySelectorAll('.tarjeta-revisar') || [])];
    const enfocar = (k) => { const t = tarjetas(); if (!t.length) return; const j = Math.max(0, Math.min(t.length - 1, k)); setI(j); t[j].focus({ preventScroll: true }); t[j].scrollIntoView({ block: 'nearest' }); };
    const tecla = (e) => {
      // El reproductor de vídeo usa sus propias teclas (k = reproducir): si ya las ha usado, aquí no se hace nada
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable="true"], .reproductor') || document.querySelector('[aria-modal="true"]')) return;
      const t = tarjetas();
      const actual = t.indexOf(document.activeElement?.closest?.('.tarjeta-revisar'));
      const k = actual >= 0 ? actual : i;
      const x = extraRef.current;
      if (e.key === 'b') { e.preventDefault(); x.buscar?.(); return; }
      if (e.key === '?') { e.preventDefault(); x.ayuda?.(); return; }
      if (e.key === 'u') { if (ultimoDeshacer) { e.preventDefault(); const d = ultimoDeshacer; ultimoDeshacer = null; d.fn(); x.deshecho?.(); } return; }
      if (x.mover && (e.key === 'j' || e.key === 'k')) { e.preventDefault(); x.mover(e.key === 'j' ? 1 : -1); return; }
      if (e.key === 'j' || (e.key === 'ArrowDown' && actual >= 0)) { e.preventDefault(); enfocar(k + 1); }
      else if (e.key === 'k' || (e.key === 'ArrowUp' && actual >= 0)) { e.preventDefault(); enfocar(k <= 0 ? 0 : k - 1); }
      else if (actual >= 0 && t[actual]) {
        const boton = (sel) => t[k].querySelector(sel);
        if (e.key === 'r') { e.preventDefault(); const b = boton('button[aria-expanded="false"]'); b?.click(); setTimeout(() => t[k].querySelector('textarea')?.focus(), 60); }
        else if (e.key === 'e' || e.key === 'v' || e.key === 'm') {
          const b = boton(e.key === 'e' ? 'button.revisar-hecho' : e.key === 'v' ? 'button.revisar-visto' : 'button.revisar-manana');
          if (b) {
            e.preventDefault();
            const antes = t[k];
            b.click();
            // El foco pasa a la tarjeta que ocupa su sitio cuando la lista se actualiza (con conexión lenta, tarda)
            const intentar = (n) => { if (!antes.isConnected || n >= 20) enfocar(k); else setTimeout(() => intentar(n + 1), 150); };
            setTimeout(() => intentar(0), 150);
          }
        }
        else if (e.key === 'o') { e.preventDefault(); boton('.nombre-atleta')?.click(); }
        else if (e.key === 'p') { const b = boton('button.revisar-programar'); if (b) { e.preventDefault(); b.click(); } }
      }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [i, n]);
  return i;
}

const FILTROS = [['todo', 'Todo'], ['mensajes', 'Mensajes'], ['sesiones', 'Sesiones'], ['checkins', 'Check-ins'], ['videos', 'Vídeos'], ['tareas', 'Tareas'], ['recetas', 'Recetas'], ['objetivos', 'Objetivos'], ['comunidad', 'Equipo']];
const ORDENES_REVISAR = [['reciente', 'Lo más reciente primero'], ['urgente', 'Lo urgente primero'], ['espera', 'Más tiempo esperando']];

// Bandeja del coach: todo lo que espera tu respuesta, de todos los atletas, en un sitio.
// v0.50: agrupado por atleta (cada uno con su cabecera, que se pliega, y cuántas cosas tiene); deslizar una tarjeta a
// la derecha la da por revisada (con el «Deshacer» de siempre; el botón «Revisado» sigue ahí); los vídeos, con su
// miniatura y su duración.
// v0.195: buscar, ordenar por urgencia, agrupar por día, vista compacta, elegir varias, apartar hasta mañana, lo nuevo
// que llega sin mover la lista, el contexto de cada atleta y lo revisado hoy
export function Revisar({ bandeja, abrirAtleta }) {
  const { api, aviso } = useApp();
  const [filtro, setFiltro] = useState('todo');
  const [plegados, setPlegados] = useState(() => new Set());
  const [seguidos, setSeguidos] = useState(false);
  // (v0.61) las sesiones que el coach ha pedido ver uno a uno (sus vídeos, cada uno en su tarjeta de siempre)
  const [separadas, setSeparadas] = useState(() => new Set());
  // (v0.59) los vídeos, por más tiempo esperando (o como siempre), con el objetivo de revisión del coach (24 o 48 h)
  // (v0.195) el orden vale ya para todo, y también «Lo urgente primero»
  const [orden, setOrden] = usePreferencia('fbe-revisar-orden', 'reciente');
  const [objetivo, setObjetivo] = usePreferencia('fbe-objetivo-revision', OBJETIVO_REVISION);
  const [agrupar, setAgrupar] = usePreferencia('fbe-revisar-agrupar', 'atleta');
  const [compacta, setCompacta] = usePreferencia('fbe-revisar-compacta', false);
  // (v0.196) lo apartado y lo fijado: en la base con la 083 (igual en todos tus aparatos)
  const hoyAp = hoyISO();
  const ap = useApartados(hoyAp);
  const [verPospuestas, setVerPospuestas] = useState(false);
  const [vista, setVista] = usePreferencia('fbe-revisar-vista', 'tarjetas');
  const [ancho, setAncho] = useState(() => { try { return matchMedia('(min-width: 1100px)').matches; } catch { return false; } });
  useEffect(() => { try { const m = matchMedia('(min-width: 1100px)'); const f = () => setAncho(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); } catch { return undefined; } }, []);
  const columnas = vista === 'columnas' && ancho;
  const [sel, setSel] = useState(null);
  const selIdx = useRef(0);
  const [uno, setUno] = useState(false);
  const [motivo, setMotivo] = useState(null);
  const tanda = useRef({ revisadas: 0, contestadas: 0, desde: null });
  const [, setTandaV] = useState(0);
  const anotar = (k, n = 1) => { const t = tanda.current; if (!t.desde) t.desde = Date.now(); t[k] += n; setTandaV((v) => v + 1); };
  const [verResumen, setVerResumen] = useState(false);
  const [ceros, setCeros] = usePreferencia('fbe-revisar-ceros', []);
  const pf = usePreferenciasFrases();
  // (v0.197) filtrar por tu etiqueta, y lo que hagas sin conexión, en cola hasta que vuelva
  const [etqFiltro, setEtqFiltro] = useState(null);
  const [cola, setCola] = usePreferencia('fbe-revisar-cola', []);
  const colaRef = useRef(cola);
  colaRef.current = cola;
  const OPS = {
    revisar: (a) => api.marcarRevisado(a[0], a[1]),
    comentar: (a) => api.comentar(a),
    leidos: (a) => api.marcarLeidos(a),
    mensaje: (a) => api.enviarMensaje(a.atletaId, a.datos),
    reaccion: (a) => api.reaccionarMensaje(a.id, a.emoji),
  };
  const enviar = async (op, args) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { const n = conOp(colaRef.current, op, args); colaRef.current = n; setCola(n); return { enCola: true }; }
    return OPS[op](args);
  };
  useEffect(() => {
    const vaciar = async () => {
      const pend = colaRef.current || [];
      if (!pend.length || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
      const quedan = [];
      for (const x of pend) { try { await OPS[x.op]?.(x.args); } catch { quedan.push(x); } }
      colaRef.current = quedan;
      setCola(quedan);
      if (pend.length > quedan.length) { aviso(pend.length - quedan.length === 1 ? 'Enviado lo que hiciste sin conexión' : `Enviadas las ${pend.length - quedan.length} cosas que hiciste sin conexión`, 'ok'); bandeja.recargar(true); }
    };
    window.addEventListener('online', vaciar);
    vaciar();
    return () => window.removeEventListener('online', vaciar);
  }, []);
  const [buscar, setBuscar] = useState('');
  const [eligiendo, setEligiendo] = useState(false);
  const [elegidas, setElegidas] = useState(() => new Set());
  const [hoja, setHoja] = useState(null);   // { tipo: 'voz' | 'programar' | 'hoy', ... }
  const d = bandeja.datos;
  const hoy = hoyISO();
  const caja = useRef(null);
  const moverRef = useRef(null);
  useAtajos(caja, d?.total || 0, `${filtro}|${agrupar}|${orden}|${[...plegados].sort().join(',')}`, {
    buscar: () => document.querySelector('.revisar-buscar input')?.focus(),
    ayuda: () => setHoja({ tipo: 'teclas' }),
    deshecho: () => aviso('Deshecho'),
    mover: columnas ? (k) => moverRef.current?.(k) : null,
  });
  const recargar = () => bandeja.recargar(true);
  const fr = useFrasesRevisar();
  const frases = fr.frases;

  // Lo que llega mientras miras se queda aparte (no mueve la lista). Lo que llega al entrar (la recarga de la pestaña)
  // cuenta como ya visto
  const conocidas = useRef(null);
  const aceptando = useRef(true);
  const [, setVersion] = useState(0);
  useEffect(() => { const t = setTimeout(() => { aceptando.current = false; }, 10000); return () => clearTimeout(t); }, []);
  // Se pone al día sola cada minuto mientras la tienes delante
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible' && !document.querySelector('[aria-modal="true"]')) bandeja.recargar(true); }, 60000);
    return () => clearInterval(t);
  }, []);

  // El contexto de cada atleta (semana del bloque y tu última respuesta) y los récords de cada sesión
  const idsAtletas = [...new Set([...(d?.sesiones || []), ...(d?.checkins || []), ...(d?.archivos || []), ...(d?.comentarios || []), ...(d?.tareas || []), ...(d?.objetivos || []), ...(d?.recetas || [])]
    .map((x) => x.atleta?.id || x.atleta_id).filter(Boolean))].sort();
  const ctx = useCarga(() => (idsAtletas.length ? api.contextoRevisar(idsAtletas) : Promise.resolve({})), [idsAtletas.join(',')]);
  const patrones = useCarga(() => (idsAtletas.length ? api.patronesRevisar(idsAtletas).catch(() => ({})) : Promise.resolve({})), [idsAtletas.join(',')]);
  const idsSes = (d?.sesiones || []).map((s) => s.id).sort().join(',');
  const marcas = useCarga(() => (idsSes ? api.marcasSesiones(d.sesiones) : Promise.resolve({})), [idsSes]);
  const cuentaHoy = useCarga(() => (d && !d.total ? api.revisadosHoy().then((x) => x.length).catch(() => 0) : Promise.resolve(null)), [d ? d.total : -1]);

  // (pulido 5) lo que se marca como revisado sale de la lista al momento y se guarda por detrás (si no se puede
  // guardar, vuelve a la lista y se avisa)
  // (pulido 3.10) y se va encogiéndose (lo de debajo sube a su sitio), en vez de desaparecer de golpe
  // (mientras se encoge sigue en la página: un segundo toque en ese rato no la marca dos veces, espera a la primera)
  // (v0.195) y el foco pasa a la tarjeta siguiente
  const saliendo = useRef(new Map());
  const quitar = (lista, id, guardar) => {
    if (saliendo.current.has(id)) return saliendo.current.get(id);
    const hecho = (async () => {
      const el = caja.current?.querySelector(`[data-item$="-${id}"]`);
      const sig = tarjetaSiguiente(caja.current, el);
      const salida = salirSuave(el);
      await salida.fin;
      try {
        const r = await bandeja.alMomento((x) => {
          const queda = (x[lista] || []).filter((i) => i.id !== id);
          return queda.length === (x[lista] || []).length ? x : { ...x, [lista]: queda, total: Math.max(0, (x.total || 0) - 1) };
        }, guardar);
        requestAnimationFrame(() => irA(sig));
        return r;
      } catch (e) { salida.deshacer(); throw e; }
    })().finally(() => { saliendo.current.delete(id); });
    saliendo.current.set(id, hecho);
    return hecho;
  };
  // Una conversación sale de la lista (sus mensajes, leídos)
  const quitarHilo = async (h, guardar) => {
    const ids = new Set(h.ids);
    const el = caja.current?.querySelector(`[data-item="m-${h.clave}"]`);
    const sig = tarjetaSiguiente(caja.current, el);
    await bandeja.alMomento((x) => {
      const queda = (x.comentarios || []).filter((c) => !ids.has(c.id));
      return queda.length === (x.comentarios || []).length ? x : { ...x, comentarios: queda, total: Math.max(0, (x.total || 0) - 1) };
    }, guardar);
    requestAnimationFrame(() => irA(sig));
  };
  // Varias a la vez (elegidas, o todo lo de un atleta), con su «Deshacer»
  const revisarVarias = async (lista, texto) => {
    const marcasR = lista.flatMap((x) => x.marcas);
    if (!marcasR.length) return;
    try {
      await bandeja.alMomento((x) => bandejaSin(x, marcasR), async () => { for (const m of marcasR) await api.marcarRevisado(m.tipo, m.id); });
      anotar('revisadas', lista.length);
      aviso(texto, 'ok', recordarDeshacer({ texto: 'Deshacer', fn: async () => { await api.deshacerRevisados(marcasR); recargar(); } }));
    } catch (e) { aviso(e.message, 'error'); }
  };
  const apartar = (clave, dias = 1) => {
    const el = caja.current?.querySelector(`[data-item="${clave}"]`);
    const sig = tarjetaSiguiente(caja.current, el);
    const antes = ap.previo(clave);
    ap.apartar(clave, dias);
    aviso(dias === 1 ? 'Te lo recuerdo mañana' : `Te lo recuerdo en ${dias} días`, 'ok', recordarDeshacer({ texto: 'Deshacer', fn: () => ap.poner(clave, antes) }));
    requestAnimationFrame(() => irA(sig));
  };
  const compartido = {
    frases, marcas: marcas.datos || {}, apartar, quitar, quitarHilo, abrirAtleta, recargar, anotar, hoy: hoyAp,
    visto: pf.visto,
    frasesDe: (tipo) => { const l = frasesPara(tipo, pf.porTipo, fr.generales); return l.length ? l : frases; },
    esFijada: (clave) => esFijada(ap.mapa, clave),
    fijar: (clave) => { const v = !esFijada(ap.mapa, clave); ap.fijar(clave); aviso(v ? 'Fijada arriba' : 'Ya no está fijada'); },
    voz: (x) => setHoja({ tipo: 'voz', ...x }),
    programar: (atleta) => setHoja({ tipo: 'programar', atleta }),
    tarea: (atleta, inicial = {}) => setHoja({ tipo: 'tarea', atleta, inicial }),
    nota: (atleta, texto = '') => setHoja({ tipo: 'nota', atleta, texto }),
    fotos: (foto) => setHoja({ tipo: 'fotos', foto }),
    enviar,
    programada: (atleta, cita = null, alEnviado = null) => setHoja({ tipo: 'programada', atleta, cita, alEnviado }),
    etiquetaDe: (clave) => ap.mapa[clave]?.etiqueta || null,
    etiquetar: (clave) => setHoja({ tipo: 'etiqueta', clave }),
    chat: (atleta) => setHoja({ tipo: 'chat', atleta }),
    borradorDe: (x, nombre) => borradorTarjeta(x, marcas.datos || {}, nombre),
    variablesDe: (x) => variablesDe(x, marcas.datos || {}),
  };

  // (v0.196) después de pintar: la racha de dejarla a cero y quitar el «fijada» a lo que ya no está por revisar
  const tras = useRef({});
  useEffect(() => {
    const t = tras.current;
    if (!t.listo) return;
    if (t.aCero && !(ceros || []).includes(hoyAp)) setCeros(conDia(ceros, hoyAp));
    for (const k of t.fijadasFuera || []) ap.poner(k, { hasta: ap.mapa[k]?.hasta || null, fijada: false });
  });

  if (bandeja.cargando && !d) return <div class="contenido coach"><Siluetas forma="tarjetas" n={3} texto="Cargando lo que tienes por revisar" /></div>;

  // Los mensajes se agrupan por conversación
  const hilos = [];
  for (const c of d?.comentarios || []) {
    const clave = c.sesion_id || c.checkin_id || c.archivo_id || `general-${c.atleta_id}`;
    let h = hilos.find((x) => x.clave === clave);
    if (!h) { h = { clave, ultimo: c, n: 0, ids: [], audios: [] }; hilos.push(h); }
    h.n++;
    h.ids.push(c.id);
    if (c.audio) h.audios.push({ ...c.audio, comentario_id: c.id });
  }
  const todos = d ? [
    ...hilos.map((h) => ({ tipo: 'mensajes', clave: `m-${h.clave}`, atleta: h.ultimo.atleta ? { ...h.ultimo.atleta, id: h.ultimo.atleta.id || h.ultimo.atleta_id } : null, h })),
    ...d.sesiones.map((s) => ({ tipo: 'sesiones', clave: `s-${s.id}`, atleta: s.atleta, s })),
    ...d.checkins.map((c) => ({ tipo: 'checkins', clave: `c-${c.id}`, atleta: c.atleta, c })),
    ...itemsVideos(d.archivos, separadas),
    ...(d.tareas || []).map((t) => ({ tipo: 'tareas', clave: `t-${t.id}`, atleta: t.atleta, t })),
    ...(d.recetas || []).map((r) => ({ tipo: 'recetas', clave: `r-${r.id}`, atleta: r.atleta, r })),
    ...(d.objetivos || []).map((o) => ({ tipo: 'objetivos', clave: `o-${o.id}`, atleta: o.atleta, o })),
    ...(d.comunidad || []).map((r) => ({ tipo: 'comunidad', clave: `e-${r.id}`, atleta: null, r })),
  ] : [];
  // Lo nuevo, aparte (salvo al entrar)
  if (d && (!conocidas.current || aceptando.current)) conocidas.current = new Set([...(conocidas.current || []), ...todos.map((x) => x.clave)]);
  const { vistas, nuevas } = separarNuevas(todos, conocidas.current);
  const verNuevas = () => { for (const x of nuevas) conocidas.current.add(x.clave); setVersion((v) => v + 1); };
  // Apartadas hasta mañana: fuera de la lista (salvo que las quieras ver)
  const esPospuesta = (x) => apartadaHoy(ap.mapa, x.clave, hoy);
  const nPosp = vistas.filter(esPospuesta).length;
  const enLista = vistas.filter((x) => (verPospuestas ? esPospuesta(x) : !esPospuesta(x)));
  const ahora = new Date();
  const porNombre = buscar.trim() ? enLista.filter((x) => x.atleta && coincideNombre(x.atleta.nombre, buscar)) : enLista;
  // (v0.196) por motivo: molestias, preguntas, RPE 10 o lo que lleva más de 3 días
  const cuentaMotivo = Object.fromEntries(MOTIVOS_REVISAR.map(([k]) => [k, porNombre.filter((x) => cumpleMotivo(x, k, ahora)).length]));
  const etiquetas = etiquetasDe(ap.mapa);
  const porMotivo = motivo ? porNombre.filter((x) => cumpleMotivo(x, motivo, ahora)) : porNombre;
  const buscados = etqFiltro ? porMotivo.filter((x) => ap.mapa[x.clave]?.etiqueta === etqFiltro) : porMotivo;

  const cuentas = { mensajes: 0, sesiones: 0, checkins: 0, videos: 0, recetas: 0, comunidad: 0, tareas: 0, objetivos: 0 };
  for (const x of buscados) {
    if (x.tipo === 'videos') cuentas.videos += x.g ? x.g.videos.length : 1;
    else cuentas[x.tipo] = (cuentas[x.tipo] || 0) + 1;
  }
  const ver = (k) => filtro === 'todo' || filtro === k;
  const items = buscados.filter((x) => ver(x.tipo));
  const visibles = items.length;
  const conVideos = (d?.archivos || []).some((a) => a.tipo === 'video_tecnica');
  const esperan = videosQueEsperan((d?.archivos || []).filter((a) => a.tipo === 'video_tecnica'));   // (054) los que llevan 3 días o más
  const claveEspera = (x) => { const f = fechaItem(x); return f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? `${f}T12:00:00` : f; };
  let grupos;
  if (agrupar === 'dia') {
    grupos = agruparPorDia(items, hoy);
    if (orden === 'urgente') grupos = grupos.map((g) => ({ ...g, items: [...g.items].sort((a, b) => pesoUrgencia(urgenciaItem(b, ahora)) - pesoUrgencia(urgenciaItem(a, ahora))) }));
    else if (orden === 'espera') grupos = [...grupos].reverse().map((g) => ({ ...g, items: [...g.items].reverse() }));
  } else {
    grupos = agruparPorAtleta(items);
    if (orden === 'espera') grupos = ordenarGruposPorEspera(grupos, claveEspera);
    else if (orden === 'urgente') grupos = ordenarUrgente(grupos, ahora);
  }
  // (v0.196) lo fijado, arriba del todo
  const fijadas = items.filter((x) => esFijada(ap.mapa, x.clave));
  if (fijadas.length) {
    const fuera = new Set(fijadas.map((x) => x.clave));
    grupos = [{ id: 'fijadas', titulo: 'Fijadas arriba', icono: 'chincheta', atleta: null, items: fijadas, n: fijadas.length, tipos: fijadas.reduce((t, x) => ({ ...t, [x.tipo]: (t[x.tipo] || 0) + 1 }), {}) },
      ...grupos.map((g) => { const its = g.items.filter((x) => !fuera.has(x.clave)); return { ...g, items: its, n: its.length }; }).filter((g) => g.items.length)];
  }
  // Todas, en el orden en que se ven (para uno a uno y la vista en dos columnas)
  const plano = grupos.flatMap((g) => (plegados.has(g.id) && !columnas ? [] : g.items));
  // En dos columnas: la elegida (o, si se ha ido, la que ocupa su sitio)
  let iSel = plano.findIndex((x) => x.clave === sel);
  if (iSel < 0) iSel = Math.min(selIdx.current, plano.length - 1);
  const elegidaCol = columnas ? plano[iSel] || null : null;
  if (columnas) selIdx.current = Math.max(0, iSel);
  moverRef.current = (k) => {
    const j = Math.max(0, Math.min(plano.length - 1, iSel + k));
    setSel(plano[j]?.clave || null);
    selIdx.current = j;
    requestAnimationFrame(() => irA(caja.current?.querySelector('.revisar-col-panel .tarjeta-revisar')));
  };
  const revisables = new Map(revisablesDe(items).map((x) => [x.clave, x]));
  const alternar = (id) => setPlegados((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const alternarElegida = (clave) => setElegidas((s) => { const n = new Set(s); if (n.has(clave)) n.delete(clave); else n.add(clave); return n; });
  const elegidasVivas = [...elegidas].filter((k) => revisables.has(k));
  const salirDeElegir = () => { setEligiendo(false); setElegidas(new Set()); };
  const tarjeta = (x) => {
    if (x.tipo === 'mensajes') return <TarjetaMensaje h={x.h} recargar={recargar} abrirAtleta={abrirAtleta} />;
    if (x.tipo === 'sesiones') return <TarjetaSesion s={x.s} recargar={recargar} quitar={quitar} abrirAtleta={abrirAtleta} />;
    if (x.tipo === 'checkins') return <TarjetaCheckin c={x.c} recargar={recargar} quitar={quitar} abrirAtleta={abrirAtleta} />;
    if (x.tipo === 'videos' && x.g) {
      return <TarjetaSesionVideos g={x.g} recargar={recargar} abrirAtleta={abrirAtleta} objetivo={objetivo} clave={x.clave} separar={() => {
        for (const v of x.g.videos) conocidas.current?.add(`v-${v.id}`);
        setSeparadas((s) => new Set(s).add(x.g.sesionId));
      }} />;
    }
    if (x.tipo === 'videos') return <TarjetaVideo a={x.a} recargar={recargar} quitar={quitar} abrirAtleta={abrirAtleta} objetivo={objetivo} />;
    if (x.tipo === 'tareas') return <TarjetaTarea t={x.t} recargar={recargar} abrirAtleta={abrirAtleta} />;
    if (x.tipo === 'recetas') return <TarjetaCambioReceta r={x.r} recargar={recargar} abrirAtleta={abrirAtleta} />;
    if (x.tipo === 'objetivos') return <TarjetaPropuesta o={x.o} recargar={recargar} abrirAtleta={abrirAtleta} />;
    return <TarjetaReporte r={x.r} recargar={recargar} />;
  };
  const visibleTotal = vistas.length - nPosp;
  const atletaHoja = hoja?.tipo === 'programar' ? hoja.atleta : null;
  const restante = textoRestante(minutosRestantes(items.filter((x) => !esPospuesta(x)), tanda.current));
  const irASiguiente = () => {
    const x = siguienteImportante(plano.length ? plano : items, ahora);
    if (!x) return;
    if (columnas) { setSel(x.clave); selIdx.current = plano.findIndex((y) => y.clave === x.clave); requestAnimationFrame(() => irA(caja.current?.querySelector('.revisar-col-panel .tarjeta-revisar'))); return; }
    const g = grupos.find((gg) => gg.items.some((y) => y.clave === x.clave));
    if (g && plegados.has(g.id)) alternar(g.id);
    requestAnimationFrame(() => requestAnimationFrame(() => irA(caja.current?.querySelector(`[data-item="${x.clave}"] .tarjeta-revisar`))));
  };
  // Contestar a varias elegidas con el mismo mensaje (sesiones, check-ins y vídeos sueltos)
  const contestables = (claves) => claves.map((k) => items.find((x) => x.clave === k)).filter((x) => x && (x.tipo === 'sesiones' || x.tipo === 'checkins' || (x.tipo === 'videos' && x.a?.tipo === 'video_tecnica')));
  const contestarVarias = async (lista, texto) => {
    const marcasR = revisablesDe(lista).flatMap((r) => r.marcas);
    try {
      await bandeja.alMomento((x) => bandejaSin(x, marcasR), async () => {
        let enCola = false;
        for (const x of lista) {
          const t = rellenarFrase(texto, x.atleta?.nombre || '', variablesDe(x, marcas.datos || {}));
          const base = { atletaId: x.atleta.id, texto: t, autor: 'coach', clienteId: nuevoId('varias') };
          const r = await enviar('comentar', x.tipo === 'sesiones' ? { ...base, sesionId: x.s.id } : x.tipo === 'checkins' ? { ...base, checkinId: x.c.id } : { ...base, archivoId: x.a.id });
          if (r?.enCola) enCola = true;
        }
        return enCola ? { enCola: true } : null;
      });
      anotar('contestadas', lista.length);
      aviso(lista.length === 1 ? 'Contestada' : `Contestadas las ${lista.length}`, 'ok');
    } catch (e) { aviso(e.message, 'error'); }
  };
  // Todo lo de un atleta, hasta mañana
  const apartarTodo = async (g) => {
    const antes = g.items.map((x) => [x.clave, ap.previo(x.clave)]);
    for (const x of g.items) await ap.apartar(x.clave, 1);
    aviso(`Lo de ${g.atleta.nombre.split(' ')[0]}, para mañana`, 'ok', recordarDeshacer({ texto: 'Deshacer', fn: async () => { for (const [k, v] of antes) await ap.poner(k, v); } }));
  };
  tras.current = {
    listo: !!d && !bandeja.cargando,
    aCero: !!d && d.total != null && visibleTotal === 0 && !nuevas.length,
    fijadasFuera: d ? Object.keys(ap.mapa).filter((k) => ap.mapa[k]?.fijada && !todos.some((x) => x.clave === k)) : [],
  };
  const racha = textoRacha(rachaCeros(visibleTotal === 0 && d ? conDia(ceros, hoy) : ceros, hoy));
  const hayTanda = tanda.current.revisadas + tanda.current.contestadas > 0;
  const resumenTanda = hayTanda ? textoResumenTanda({ ...tanda.current, quedan: visibleTotal }) : '';

  return (
    <CtxRevisar.Provider value={compartido}>
      <div class={`contenido coach ${eligiendo ? 'revisar-con-barra' : ''}`}>
        <CabeceraGrande>
          <div class="titulo"><h1>Revisar</h1><div class="sub">{visibleTotal ? (visibleTotal === 1 ? '1 cosa espera tu respuesta' : `${visibleTotal} cosas esperan tu respuesta`) : 'Al día'}</div></div>
        </CabeceraGrande>
        <BandaDemo />
        {/* (imágenes, bloque S) la mesa de revisar: lo que espera y cómo ir más rápido */}
        {d && <CabCoach id="coach-revisar" titulo={visibleTotal ? (visibleTotal === 1 ? 'Una cosa espera tu respuesta' : `${visibleTotal} cosas esperan tu respuesta`) : 'Todo revisado'}>
          <span class="peq">{visibleTotal ? 'Sesiones, check-ins, vídeos y mensajes, agrupados por atleta.' : 'Lo nuevo que te manden tus atletas aparecerá aquí.'}</span>
        </CabCoach>}
        <ErrorCaja error={bandeja.error} reintentar={recargar} />
        {/* (v0.195) lo que ha llegado mientras mirabas: no mueve la lista hasta que lo pides */}
        <div aria-live="polite">
          {nuevas.length > 0 && (
            <button type="button" class="revisar-nuevas" onClick={verNuevas}>
              <Icono n="campana" /><span class="peq"><strong>{nuevas.length === 1 ? 'Ha llegado 1 cosa nueva' : `Han llegado ${nuevas.length} cosas nuevas`}</strong>. Tocar para verlas.</span>
            </button>
          )}
        </div>
        {d?.total > 0 && (
          <div class="revisar-herramientas">
            <label class="revisar-buscar">
              <Icono n="buscar" />
              <input type="search" class="entrada" placeholder="Buscar un atleta" aria-label="Buscar por atleta" value={buscar} onInput={(e) => setBuscar(e.currentTarget.value)} />
            </label>
            <label class="campo-linea"><span class="mini">Orden</span>
              <select class="selector" value={orden} onChange={(ev) => setOrden(ev.currentTarget.value)} aria-label="Cómo ordenar lo que hay por revisar">
                {ORDENES_REVISAR.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </label>
            <div class="segmentos" role="group" aria-label="Agrupar lo que hay por revisar">
              <button type="button" aria-pressed={agrupar !== 'dia' ? 'true' : 'false'} onClick={() => setAgrupar('atleta')}>Por atleta</button>
              <button type="button" aria-pressed={agrupar === 'dia' ? 'true' : 'false'} onClick={() => setAgrupar('dia')}>Por día</button>
            </div>
            <button type="button" class="btn btn-peq solo-ancho" aria-pressed={compacta ? 'true' : 'false'} onClick={() => setCompacta(!compacta)}><Icono n="vista" /> Vista compacta</button>
            {ancho && <button type="button" class="btn btn-peq revisar-columnas-btn" aria-pressed={columnas ? 'true' : 'false'} onClick={() => setVista(columnas ? 'tarjetas' : 'columnas')}><Icono n="enfoque" /> Dos columnas</button>}
            <button type="button" class="btn btn-peq revisar-uno-btn" onClick={() => setUno(true)} aria-haspopup="dialog" disabled={!plano.length}><Icono n="play" /> Uno a uno</button>
            <button type="button" class="btn btn-peq revisar-siguiente-btn" onClick={irASiguiente} disabled={!items.length}><Icono n="diana" /> Lo siguiente más importante</button>
            {restante && <span class="mini secundario revisar-restante" aria-live="polite">{restante}</span>}
            <button type="button" class="btn btn-peq revisar-elegir-btn" aria-pressed={eligiendo ? 'true' : 'false'} onClick={() => (eligiendo ? salirDeElegir() : setEligiendo(true))}><Icono n="hecho" /> {eligiendo ? 'Dejar de elegir' : 'Elegir varias'}</button>
          </div>
        )}
        <div class="selector-chips" role="group" aria-label="Qué revisar">
          {FILTROS.map(([k, t]) => (k === 'todo' || cuentas[k] > 0) && (
            <button key={k} aria-pressed={filtro === k ? 'true' : 'false'} onClick={() => setFiltro(k)}>{t}{k !== 'todo' ? ` (${cuentas[k]})` : ''}</button>
          ))}
        </div>
        {(motivo || MOTIVOS_REVISAR.some(([k]) => cuentaMotivo[k] > 0)) && (
          <div class="selector-chips revisar-motivos-chips" role="group" aria-label="Por motivo">
            {MOTIVOS_REVISAR.map(([k, t]) => (cuentaMotivo[k] > 0 || motivo === k) && (
              <button key={k} type="button" aria-pressed={motivo === k ? 'true' : 'false'} onClick={() => setMotivo(motivo === k ? null : k)}>{t} ({cuentaMotivo[k]})</button>
            ))}
          </div>
        )}
        {cola.length > 0 && <p class="revisar-cola peq" role="status"><Icono n="sinred" /> {cola.length === 1 ? '1 cosa sin enviar' : `${cola.length} cosas sin enviar`}: se mandan solas al volver la conexión.</p>}
        {(etiquetas.length > 0 || etqFiltro) && (
          <div class="selector-chips revisar-etiquetas-chips" role="group" aria-label="Tus etiquetas">
            {etiquetas.map((e) => <button key={e} type="button" aria-pressed={etqFiltro === e ? 'true' : 'false'} onClick={() => setEtqFiltro(etqFiltro === e ? null : e)}><Icono n="bandera" /> {e}</button>)}
          </div>
        )}
        {(nPosp > 0 || verPospuestas) && (
          <button type="button" class="btn-texto mini revisar-pospuestas" aria-pressed={verPospuestas ? 'true' : 'false'} onClick={() => setVerPospuestas(!verPospuestas)}>
            <Icono n="reloj" /> {verPospuestas ? 'Volver a lo de hoy' : nPosp === 1 ? 'Ver la que has dejado para otro día' : `Ver las ${nPosp} que has dejado para otro día`}
          </button>
        )}
        {/* (054) arriba, lo que más espera: vídeos de técnica de hace 3 días o más */}
        {esperan && !verPospuestas && (filtro === 'todo' || filtro === 'videos') && (
          <button type="button" class="revisar-esperan" onClick={() => { setFiltro('videos'); setOrden('espera'); }}>
            <Icono n="reloj" /><span class="peq"><strong>{esperan.texto}</strong>. Tocar para verlos primero.</span>
          </button>
        )}
        {filtro === 'todo' && <Reserva id="revisar-variantes"><VariantesPorRevisar abrirAtleta={abrirAtleta} /></Reserva>}
        {/* v0.57: los vídeos por revisar, uno detrás de otro */}
        {conVideos && (filtro === 'todo' || filtro === 'videos') && (
          <button type="button" class="btn btn-peq revisar-seguidos" onClick={() => setSeguidos(true)} aria-haspopup="dialog">
            <Icono n="video" /> Revisar los vídeos seguidos ({d.archivos.filter((a) => a.tipo === 'video_tecnica').length})
          </button>
        )}
        {conVideos && (filtro === 'todo' || filtro === 'videos') && <TiemposRevision objetivo={objetivo} setObjetivo={setObjetivo} />}
        {seguidos && <RevisionSeguida videos={d.archivos.filter((a) => a.tipo === 'video_tecnica')} abrirAtleta={abrirAtleta} alCerrar={() => { setSeguidos(false); recargar(); }} />}
        {!d?.total ? <BandejaVacia cuenta={cuentaHoy.datos} racha={racha} tanda={resumenTanda} /> : !visibles ? (
          <div class="panel panel-pad revisar-sin-resultados" role="status">
            <p class="peq">{buscar.trim() ? `Nada por revisar de «${buscar.trim()}».` : verPospuestas ? 'No has dejado nada para otro día.' : visibleTotal === 0 ? 'Lo de hoy, al día: solo queda lo que has dejado para otro día.' : 'Nada por revisar con este filtro.'}</p>
            {buscar.trim() && <button type="button" class="btn btn-peq" onClick={() => setBuscar('')}>Quitar la búsqueda</button>}
            {visibleTotal === 0 && racha && <p class="peq revisar-racha">{racha}.</p>}
          </div>
        ) : columnas ? (
          <div class="revisar-columnas" ref={caja}>
            <ListaColumnas items={plano} sel={elegidaCol?.clave || null} ahora={ahora} alElegir={(k) => { setSel(k); selIdx.current = plano.findIndex((x) => x.clave === k); requestAnimationFrame(() => irA(caja.current?.querySelector('.revisar-col-panel .tarjeta-revisar'))); }} />
            <div class="revisar-col-panel">
              {elegidaCol && (
                <>
                  {elegidaCol.atleta && ctx.datos?.[elegidaCol.atleta.id] && <p class="mini secundario revisar-col-ctx">{textoContexto(ctx.datos[elegidaCol.atleta.id], ahora)}</p>}
                  <Deslizable key={elegidaCol.clave} clave={elegidaCol.clave}>{tarjeta(elegidaCol)}</Deslizable>
                </>
              )}
            </div>
          </div>
        ) : (
          <div class={`rejilla-revisar ${compacta ? 'revisar-compacta' : ''}`} ref={caja}>
            {grupos.map((g) => {
              const c = g.atleta ? ctx.datos?.[g.atleta.id] : null;
              const suyas = g.items.map((x) => revisables.get(x.clave)).filter(Boolean);
              return (
                <GrupoRevisar key={g.id} g={g} abierto={!plegados.has(g.id)} alternar={() => alternar(g.id)} urg={g.id === 'fijadas' ? null : urgenciaGrupo(g.items, ahora)}
                  contexto={c ? textoContexto(c, ahora) : ''} patrones={g.atleta ? patrones.datos?.[g.atleta.id] || [] : []}
                  acciones={g.atleta && !eligiendo ? (
                    <>
                      <button type="button" class="btn btn-peq btn-texto grupo-chat" onClick={() => compartido.chat(g.atleta)} aria-haspopup="dialog"><Icono n="mensaje" /> Chat</button>
                      {g.atleta.entrenamiento !== false && <button type="button" class="btn btn-peq btn-texto" onClick={() => compartido.programar(g.atleta)}><Icono n="editar" /> Programar</button>}
                      <button type="button" class="btn btn-peq btn-texto grupo-manana" onClick={() => apartarTodo(g)}><Icono n="reloj" /> Todo a mañana</button>
                      {suyas.length > 1 && <button type="button" class="btn btn-peq btn-texto grupo-todo-revisado" onClick={() => revisarVarias(suyas, `${suyas.length} cosas de ${g.atleta.nombre.split(' ')[0]} revisadas`)}><Icono n="hecho" /> Todo revisado ({suyas.length})</button>}
                    </>
                  ) : null}>
                  {g.items.map((x) => {
                    const rv = revisables.get(x.clave);
                    if (!eligiendo || !rv) return <Deslizable key={x.clave} clave={x.clave}>{tarjeta(x)}</Deslizable>;
                    return (
                      <div key={`e-${x.clave}`} class={`revisar-item eligiendo ${elegidas.has(x.clave) ? 'elegida' : ''}`}>
                        <label class="revisar-elegir"><input type="checkbox" checked={elegidas.has(x.clave)} onChange={() => alternarElegida(x.clave)} /><span class="sr">Elegir esta tarjeta{x.atleta ? ` de ${x.atleta.nombre}` : ''}</span></label>
                        <Deslizable clave={x.clave}>{tarjeta(x)}</Deslizable>
                      </div>
                    );
                  })}
                </GrupoRevisar>
              );
            })}
          </div>
        )}
        {eligiendo && (
          <div class="revisar-barra-elegir" role="region" aria-label="Las tarjetas elegidas">
            <span class="peq num">{elegidasVivas.length === 1 ? '1 elegida' : `${elegidasVivas.length} elegidas`}</span>
            <button type="button" class="btn btn-peq btn-texto" onClick={() => setElegidas(new Set(revisables.keys()))}>Elegir todas ({revisables.size})</button>
            <button type="button" class="btn btn-peq btn-primario" disabled={!elegidasVivas.length} onClick={async () => {
              const lista = elegidasVivas.map((k) => revisables.get(k));
              salirDeElegir();
              await revisarVarias(lista, lista.length === 1 ? '1 cosa revisada' : `${lista.length} cosas revisadas`);
            }}><Icono n="hecho" /> Dar por revisadas</button>
            <button type="button" class="btn btn-peq" disabled={!contestables(elegidasVivas).length} onClick={() => setHoja({ tipo: 'varias', claves: [...elegidasVivas] })} aria-haspopup="dialog"><Icono n="mensaje" /> Contestar a todas</button>
            <button type="button" class="btn btn-peq" onClick={salirDeElegir}>Cancelar</button>
          </div>
        )}
        {verResumen && resumenTanda && <p class="panel panel-pad peq revisar-resumen" role="status"><strong>Esta tanda:</strong> {resumenTanda}</p>}
        <div class="fila-envolver revisar-pie">
          <button type="button" class="btn-texto mini" onClick={() => setHoja({ tipo: 'hoy' })} aria-haspopup="dialog"><Icono n="historial" /> Lo que has revisado hoy</button>
          <button type="button" class="btn-texto mini" onClick={() => setHoja({ tipo: 'tiempos' })} aria-haspopup="dialog"><Icono n="reloj" /> Tus tiempos</button>
          <button type="button" class="btn-texto mini" onClick={() => setHoja({ tipo: 'frases' })} aria-haspopup="dialog"><Icono n="mensaje" /> Tus frases</button>
          <button type="button" class="btn-texto mini solo-ancho" onClick={() => setHoja({ tipo: 'teclas' })} aria-haspopup="dialog"><Icono n="teclado" /> Teclas</button>
          {hayTanda && <button type="button" class="btn-texto mini" aria-expanded={verResumen ? 'true' : 'false'} onClick={() => setVerResumen(!verResumen)}><Icono n="progreso" /> Resumen de esta tanda</button>}
          {racha && visibleTotal > 0 && <span class="mini secundario revisar-racha-chip"><Icono n="llama" /> {racha}</span>}
        </div>
        <p class="mini terciario">Comentar algo lo da por revisado; deslizar una tarjeta a la derecha, también. «Mañana» la aparta hasta mañana{ap.enBase ? '' : ' (en este aparato)'}. Las sesiones y los check-ins de más de 4 semanas salen de la bandeja solos.</p>
        {d?.total > 0 && <p class="mini terciario solo-ancho atajos">Con el teclado: <kbd>j</kbd> <kbd>k</kbd> para moverte, <kbd>r</kbd> responder, <kbd>e</kbd> revisado, <kbd>v</kbd> visto, <kbd>m</kbd> mañana, <kbd>p</kbd> programar, <kbd>u</kbd> deshacer, <kbd>b</kbd> buscar, <kbd>?</kbd> todas, <kbd>o</kbd> abrir su ficha.</p>}
        {uno && <UnoAUno items={plano} render={(x) => <Deslizable clave={x.clave}>{tarjeta(x)}</Deslizable>} alCerrar={() => setUno(false)} />}
        {hoja?.tipo === 'voz' && <HojaVoz atleta={hoja.atleta} cita={hoja.cita || null} respondeA={hoja.respondeA || null} alCerrar={() => setHoja(null)} alEnviado={hoja.alEnviado} />}
        {hoja?.tipo === 'hoy' && <HojaRevisadosHoy alCerrar={() => setHoja(null)} alCambio={recargar} />}
        {hoja?.tipo === 'tiempos' && <HojaTiempos alCerrar={() => setHoja(null)} racha={racha} />}
        {hoja?.tipo === 'teclas' && <HojaAtajos alCerrar={() => setHoja(null)} />}
        {hoja?.tipo === 'frases' && <HojaFrases generales={fr.generales} guardarGenerales={fr.guardar} porTipo={pf.porTipo} setPorTipo={pf.setPorTipo} vistoPropio={pf.vistoPropio} setVisto={pf.setVisto} alCerrar={() => setHoja(null)} />}
        {hoja?.tipo === 'tarea' && <HojaNuevaTarea atleta={hoja.atleta} inicial={hoja.inicial || {}} alCerrar={() => setHoja(null)} />}
        {hoja?.tipo === 'nota' && <HojaNotaRevision atleta={hoja.atleta} texto={hoja.texto || ''} alCerrar={() => setHoja(null)} />}
        {hoja?.tipo === 'fotos' && <HojaFotos foto={hoja.foto} alCerrar={() => setHoja(null)} />}
        {hoja?.tipo === 'programada' && <HojaProgramada atleta={hoja.atleta} cita={hoja.cita} alCerrar={() => setHoja(null)} alEnviado={hoja.alEnviado} />}
        {hoja?.tipo === 'etiqueta' && <HojaEtiqueta actual={ap.mapa[hoja.clave]?.etiqueta || null} todas={etiquetas} enBase={ap.enBase} alCerrar={() => setHoja(null)} alElegir={(e) => ap.etiquetar(hoja.clave, e)} />}
        {hoja?.tipo === 'chat' && <HojaChat atleta={hoja.atleta} alCerrar={() => setHoja(null)} alEnviado={() => recargar()} />}
        {hoja?.tipo === 'varias' && (() => {
          const lista = contestables(hoja.claves);
          return <HojaContestarVarias n={lista.length} frases={frasesPara('todo', pf.porTipo, fr.generales)} alCerrar={() => setHoja(null)} alEnviar={async (t) => { salirDeElegir(); await contestarVarias(lista, t); }} />;
        })()}
        {atletaHoja && (
          <HojaProgramar f={{ atleta_id: atletaHoja.id, nombre: atletaHoja.nombre || 'Atleta', servicio: atletaHoja.entrenamiento === false ? 'nutricion' : 'ambos', bloque: ctx.datos?.[atletaHoja.id]?.bloqueId ? { id: ctx.datos[atletaHoja.id].bloqueId } : null }}
            abrirAtleta={(id, p, x) => { setHoja(null); abrirAtleta(id, p, x); }} alCerrar={() => setHoja(null)} />
        )}
      </div>
    </CtxRevisar.Provider>
  );
}

// Lo de un atleta en la bandeja: su cabecera (que pliega y despliega) con cuántas cosas tiene y de qué
// (v0.195) con un punto si algo es urgente, en qué semana va y cuándo le contestaste, «Programar» y «Todo revisado»;
// agrupando por día, la cabecera es el día
function GrupoRevisar({ g, abierto, alternar, children, urg = null, contexto = '', acciones = null, patrones = [] }) {
  const id = `rev-${g.id}`;
  const nombre = g.titulo || g.atleta?.nombre || 'El equipo';
  const tipos = textoTipos(g.tipos);
  return (
    <section class={`grupo-revisar ${abierto ? '' : 'plegado'} ${g.titulo ? 'grupo-dia' : ''}`} aria-labelledby={`${id}-cab`}>
      <h2 class="grupo-revisar-h">
        <button type="button" id={`${id}-cab`} class="grupo-revisar-cab" aria-expanded={abierto ? 'true' : 'false'} aria-controls={abierto ? id : undefined} onClick={alternar}>
          {g.titulo ? <span class="ico-reporte ico-dia" aria-hidden="true"><Icono n={g.icono || 'calendario'} /></span> : g.atleta ? <Avatar nombre={nombre} foto={g.atleta.foto} /> : <span class="ico-reporte" aria-hidden="true"><Icono n="bandera" /></span>}
          <span class="pila-xs grupo-revisar-quien">
            <span class="grupo-revisar-nombre">{nombre}{urg?.nivel && <span class={`revisar-urg urg-${urg.nivel}`} title={urg.motivos.join(' · ')} aria-hidden="true" />}</span>
            <span class="mini terciario">{tipos}</span>
          </span>
          <span class="grupo-revisar-n num" aria-hidden="true">{g.n}</span>
          <span class="sr">, {g.n === 1 ? '1 pendiente' : `${g.n} pendientes`}{urg?.nivel ? `. ${urg.nivel === 'alta' ? 'Urgente' : 'A mirar pronto'}: ${urg.motivos.join(', ')}` : ''}</span>
          <Icono n="abajo" class="grupo-revisar-chevron" />
        </button>
      </h2>
      {abierto && patrones.length > 0 && (
        <ul class="revisar-patrones" aria-label="Avisos de patrón">
          {patrones.map((x) => <li key={x.clave} class={`mini patron-${x.nivel || 'info'}`}><Icono n="alerta" /> {x.texto}{x.sesiones?.length > 1 ? `: ${x.sesiones.slice(0, 3).join(', ')}${x.sesiones.length > 3 ? '…' : ''}` : ''}</li>)}
        </ul>
      )}
      {abierto && (contexto || acciones) && (
        <div class="grupo-revisar-ctx">
          {contexto && <span class="mini secundario">{contexto}{urg?.motivos?.length ? <span class={`revisar-motivos urg-t-${urg.nivel}`}>. {urg.motivos.join(', ')}</span> : null}</span>}
          {acciones && <span class="fila-envolver grupo-revisar-acciones">{acciones}</span>}
        </div>
      )}
      {abierto && <div id={id} class="grupo-revisar-items">{children}</div>}
    </section>
  );
}

// Deslizar a la derecha para dar por revisado (con el dedo; con el ratón, el botón): solo en las tarjetas cuyo botón
// tiene «Deshacer» (data-deshacer: sesiones, check-ins, vídeos y tareas; no las recetas ni los avisos del equipo), y
// lo que hace es pulsar ese botón, así el aviso y el «Deshacer» son los de siempre. Nada de lo que pasa dentro de una
// hoja cuenta (ya van en su capa, pero por si acaso).
function Deslizable({ children, clave = null }) {
  const ref = useRef(null);
  const g = useRef(null);
  const [dx, setDx] = useState(0);
  const [hecho, setHecho] = useState(false);
  const boton = () => ref.current?.querySelector('.tarjeta-revisar button.revisar-hecho[data-deshacer]:not([disabled])');
  // (v0.197) a la izquierda, «Mañana»
  const botonManana = () => ref.current?.querySelector('.tarjeta-revisar button.revisar-manana:not([disabled])');
  const fin = (e) => {
    const s = g.current;
    g.current = null;
    if (!s?.activo) { setDx(0); return; }
    const ancho = ref.current?.offsetWidth || 360;
    const crudo = e.clientX - s.x, y = e.clientY - s.y;
    if (esDeslizarIzquierda(crudo, y, ancho) && botonManana()) {
      setHecho(true); setDx(-ancho);
      vibrar('serie');
      const b = botonManana();
      setTimeout(() => { b?.click(); setTimeout(() => { if (ref.current) { setHecho(false); setDx(0); } }, 400); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160);
      return;
    }
    const x = Math.max(0, crudo);
    if (esDeslizar(x, y, ancho) && boton()) {
      setHecho(true); setDx(ancho);
      vibrar('serie');
      const b = boton();
      setTimeout(() => { b?.click(); setTimeout(() => { if (ref.current) { setHecho(false); setDx(0); } }, 400); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160);
    } else setDx(0);
  };
  return (
    <div ref={ref} data-item={clave} class={`deslizable ${dx ? 'moviendo' : ''} ${hecho ? 'hecho' : ''} ${g.current?.activo ? 'arrastrando' : ''}`} style={{ '--dx': `${dx}px` }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' || e.button > 0 || !(boton() || botonManana()) || e.target.closest('textarea, input, select, video, .reproductor, .rep-lienzo, .velo, [aria-modal="true"]')) return;
        g.current = { x: e.clientX, y: e.clientY, id: e.pointerId, activo: false };
      }}
      onPointerMove={(e) => {
        const s = g.current;
        if (!s || s.id !== e.pointerId) return;
        const x = e.clientX - s.x, y = e.clientY - s.y;
        if (!s.activo) {
          if (Math.abs(y) > 14 && Math.abs(y) > Math.abs(x)) { g.current = null; return; }
          if (Math.abs(x) > 12 && Math.abs(x) > Math.abs(y) * 1.4 && (x > 0 ? !!boton() : !!botonManana())) { s.activo = true; s.lado = x > 0 ? 1 : -1; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ } }
        }
        if (s.activo) setDx(s.lado > 0 ? Math.max(0, x) : Math.min(0, x));
      }}
      onPointerUp={fin} onPointerCancel={() => { g.current = null; setDx(0); }}>
      {dx < 0 ? <div class="deslizable-fondo izquierda" aria-hidden="true"><span>Mañana</span><Icono n="reloj" /></div> : <div class="deslizable-fondo" aria-hidden="true"><Icono n="hecho" /><span>Revisado</span></div>}
      {children}
    </div>
  );
}

// Variantes de material que no cuadran (v0.30): en los bloques en marcha o por empezar, ejercicios cuya variante
// nombra otro material («Press militar sentado con mancuernas», variante «En máquina»). Se arreglan en todo el bloque.
// «Dejar así» se recuerda en este dispositivo.
function VariantesPorRevisar({ abrirAtleta }) {
  const { api, aviso } = useApp();
  const lista = useCarga(() => api.variantesPorRevisar(), [], { recuerdo: `variantes-revisar:${api.uid()}` });
  const [ignoradas, setIgnoradas] = usePreferencia('fbe-variantes-ignoradas', []);
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const pendientes = (lista.datos || []).filter((x) => !ignoradas.includes(x.clave));
  if (!pendientes.length && !abierto) return null;
  async function corregir(x, nuevo) {
    if (ocupado) return;
    setOcupado(true);
    try {
      const n = await api.corregirVariante({ bloqueId: x.bloque.id, ejercicioId: x.ejercicio.id, variante: x.variante, nuevoEjercicioId: nuevo?.id || null });
      aviso(nuevo ? `${x.atleta.nombre}: cambiado a ${nuevo.nombre}${n > 1 ? ` en ${n} sesiones` : ''}` : `${x.atleta.nombre}: variante quitada`);
      await lista.recargar(true);
    } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  }
  return (
    <>
      {pendientes.length > 0 && (
        <div class="panel panel-pad aviso-variante" role="note">
          <span><b>{pendientes.length === 1 ? '1 ejercicio tiene' : `${pendientes.length} ejercicios tienen`} una variante con otro material</b> (por ejemplo, con mancuernas pero «En máquina»). Cada material es un ejercicio aparte: sus kilos no se mezclan.</span>
          <div class="aviso-variante-botones"><button type="button" class="btn btn-peq" onClick={() => setAbierto(true)}>Revisarlos</button></div>
        </div>
      )}
      {abierto && (
        <Hoja titulo="Variantes con otro material" alCerrar={() => setAbierto(false)}>
          {!pendientes.length ? <p class="peq secundario">Ya no queda ninguno.</p> : (
            <div class="lista-variantes">
              {pendientes.map((x) => (
                <div key={x.clave} class="fila-variante">
                  <button type="button" class="btn-texto nombre-atleta" onClick={() => { setAbierto(false); abrirAtleta(x.atleta.id, 'programa'); }}><Avatar nombre={x.atleta.nombre} foto={x.atleta.foto} clase="peq" />{x.atleta.nombre}</button>
                  <p class="peq"><b>{x.ejercicio.nombre}</b>, variante «{x.variante}»{x.sesion ? <span class="terciario"> ({x.sesion}{x.pautas > 1 ? `, ${x.pautas} veces en el bloque` : ''})</span> : null}</p>
                  <p class="mini secundario">{x.revision.texto}</p>
                  <div class="aviso-variante-botones">
                    {x.revision.propuestas.map((e) => <button key={e.id} type="button" class="btn btn-peq" disabled={ocupado} onClick={() => corregir(x, e)}>Cambiar a {e.nombre}</button>)}
                    <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => corregir(x, null)}>Quitar la variante</button>
                    <button type="button" class="btn btn-peq btn-texto" onClick={() => setIgnoradas([...ignoradas, x.clave])}>Dejar así</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p class="mini terciario">Se cambia en todas las semanas del bloque. Lo que el atleta ya ha registrado pasa al ejercicio nuevo, que es el que hizo de verdad.</p>
        </Hoja>
      )}
    </>
  );
}

function Cabecera({ atleta, tipo, cuando: c, abrirAtleta, pestana }) {
  return (
    <div class="separa revisar-cab">
      <button class="btn-texto nombre-atleta" onClick={() => abrirAtleta(atleta.id, pestana)}><Avatar nombre={atleta.nombre} foto={atleta.foto} clase="peq" />{atleta.nombre}</button>
      <span class="mini terciario">{tipo}{c ? `, ${c}` : ''}</span>
    </div>
  );
}

// Los botones de cada tarjeta: comentar, «Visto 💪» (contesta y lo da por revisado), revisado, nota de voz y «Mañana»
function Acciones({ abierto, setAbierto, revisar, etiquetaComentar = 'Comentar', visto = null, voz = null, manana = null, extra = null, mas = null }) {
  const x = useContext(CtxRevisar);
  return (
    <div class="fila-envolver revisar-acciones">
      {mas?.etiquetaActual && <button type="button" class="chip revisar-etiqueta" onClick={mas.etiqueta} aria-label={`Etiqueta: ${mas.etiquetaActual}. Cambiarla`}><Icono n="bandera" /> {mas.etiquetaActual}</button>}
      <button class="btn btn-peq" aria-expanded={abierto ? 'true' : 'false'} onClick={() => setAbierto(!abierto)}><Icono n="mensaje" /> {abierto ? 'Cerrar' : etiquetaComentar}</button>
      {visto && <button type="button" class="btn btn-peq revisar-visto" onClick={visto}>{x.visto || 'Visto 💪'}</button>}
      {revisar && <button class="btn btn-peq revisar-hecho" data-deshacer="" onClick={revisar}><Icono n="hecho" /> Revisado</button>}
      {voz && <button type="button" class="btn btn-peq revisar-voz" onClick={voz} aria-haspopup="dialog"><Icono n="micro" /> Voz</button>}
      {manana && <button type="button" class="btn btn-peq btn-texto revisar-manana" onClick={() => manana(1)}><Icono n="reloj" /> Mañana</button>}
      {extra}
      {mas && <MasAcciones hoy={x.hoy} {...mas} apartar={manana} />}
    </div>
  );
}

function TarjetaMensaje({ h, recargar, abrirAtleta }) {
  const { api, aviso } = useApp();
  const x = useContext(CtxRevisar);
  const [abierto, setAbierto] = useState(false);
  const leido = useRef(false);
  // Al abrirla se marcan como leídos; la bandeja se actualiza al cerrarla (no mientras lo lees)
  const alternar = (v) => { setAbierto(v); if (!v && leido.current) recargar(); };
  const c = h.ultimo;
  // (v0.55) una foto, un vídeo o un PDF que manda por el chat se contesta en el chat, citándolo (la base no deja «pegar»
  // la respuesta del coach a un archivo que subió el atleta: saldría como si lo mandara él)
  const archivoId = c.adjunto ? null : c.archivo_id;
  const contexto = c.sesion_id ? `en ${c.sesion?.nombre || 'una sesión'}` : c.checkin_id ? 'en su check-in' : archivoId ? 'en un vídeo' : 'mensaje';
  const primer = c.atleta.nombre.split(' ')[0];
  // (v0.195) «Visto 💪»: le contesta donde escribió (en su sesión, su check-in, su vídeo o el chat) y sus mensajes quedan leídos
  const contestar = async (texto) => {
    try {
      await x.quitarHilo(h, async () => {
        const r = c.sesion_id || c.checkin_id || archivoId
          ? await x.enviar('comentar', { atletaId: c.atleta_id, sesionId: c.sesion_id || null, checkinId: c.checkin_id || null, archivoId, texto, autor: 'coach', clienteId: nuevoId('visto') })
          : await x.enviar('mensaje', { atletaId: c.atleta_id, datos: { texto, autor: 'coach', respondeA: c.id, clienteId: nuevoId('visto') } });
        await x.enviar('leidos', h.ids);
        return r?.enCola ? r : null;
      });
      x.anotar('contestadas');
      aviso(`Contestado a ${primer}`, 'ok');
    } catch (e) { aviso(e.message, 'error'); }
  };
  const visto = () => contestar(x.visto || 'Visto 💪');
  // (v0.196) un emoji: en un mensaje del chat, como reacción a su último mensaje; si va pegado a algo, como respuesta
  const emoji = async (e) => {
    if (c.sesion_id || c.checkin_id || archivoId) return contestar(e);
    try {
      await x.quitarHilo(h, async () => { const r = await x.enviar('reaccion', { id: c.id, emoji: e }); await x.enviar('leidos', h.ids); return r?.enCola ? r : null; });
      x.anotar('contestadas');
      aviso(`${e} a ${primer}`, 'ok');
    } catch (err) { aviso(err.message, 'error'); }
  };
  const voz = () => x.voz({ atleta: c.atleta, respondeA: c.id, alEnviado: () => { x.anotar('contestadas'); x.quitarHilo(h, () => api.marcarLeidos(h.ids)).catch(() => {}); } });
  const [ultimos, setUltimos] = useState(false);
  const clave = `m-${h.clave}`;
  return (
    <article tabIndex={-1} class="panel panel-pad pila-s tarjeta-revisar mensaje-pendiente">
      <Cabecera atleta={c.atleta} tipo={contexto} cuando={cuando(c.creado_en)} abrirAtleta={abrirAtleta} pestana={c.sesion_id ? 'registro' : c.checkin_id ? 'seguimiento' : archivoId ? 'videos' : 'programa'} />
      {!abierto && (c.texto ? <p class="cita">«{c.texto}»{h.n > 1 ? <span class="terciario"> y {h.n - 1} más</span> : ''}</p> : h.n > 1 ? <p class="peq terciario">{h.n} mensajes</p> : null)}
      {!abierto && h.audios?.length > 0 && <AudiosSinEscuchar audios={h.audios} />}
      {!abierto && <button type="button" class="btn-texto mini revisar-ultimos-btn" aria-expanded={ultimos ? 'true' : 'false'} onClick={() => setUltimos(!ultimos)}>{ultimos ? 'Ocultar lo anterior' : 'Lo último que os habéis dicho'}</button>}
      {!abierto && ultimos && <UltimosMensajes atletaId={c.atleta_id} nombre={c.atleta.nombre} />}
      {abierto && <Hilo atletaId={c.atleta_id} sesionId={c.sesion_id} checkinId={c.checkin_id} archivoId={c.archivo_id} enChat={!!c.adjunto} nombreAtleta={c.atleta.nombre} alCambiar={() => { x.anotar('contestadas'); recargar(); }} alLeer={() => { leido.current = true; }} frasesRapidas={x.frasesDe('todo')} borrador={x.borradorDe({ tipo: 'mensajes', h, atleta: c.atleta }, c.atleta.nombre)} />}
      <Acciones abierto={abierto} setAbierto={alternar} etiquetaComentar="Responder" visto={visto} voz={voz} manana={(dias) => x.apartar(clave, dias)}
        mas={{ emoji, tarea: () => x.tarea(c.atleta), nota: () => x.nota(c.atleta, c.texto ? `Su mensaje: «${c.texto.slice(0, 120)}»` : ''), fijada: x.esFijada(clave), fijar: () => x.fijar(clave),
          programada: () => x.programada(c.atleta, null, () => { x.anotar('contestadas'); x.quitarHilo(h, () => api.marcarLeidos(h.ids)).catch(() => {}); }), etiqueta: () => x.etiquetar(clave), etiquetaActual: x.etiquetaDe(clave) }} />
    </article>
  );
}

function TarjetaSesion({ s, recargar, quitar, abrirAtleta }) {
  const { api, aviso } = useApp();
  const x = useContext(CtxRevisar);
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState(false);
  const primer = s.atleta.nombre.split(' ')[0];
  const revisar = async () => { try { await quitar('sesiones', s.id, () => x.enviar('revisar', ['sesion', s.id])); x.anotar('revisadas'); aviso('Sesión revisada', 'ok', deshacer(api, 'sesion', s.id, recargar)); } catch (e) { aviso(e.message, 'error'); } };
  const contestar = async (texto) => { try { await quitar('sesiones', s.id, () => x.enviar('comentar', { atletaId: s.atleta.id, sesionId: s.id, texto: rellenarFrase(texto, s.atleta.nombre, x.variablesDe(item)), autor: 'coach', clienteId: nuevoId('visto') })); x.anotar('contestadas'); aviso(`Contestado a ${primer}`, 'ok'); } catch (e) { aviso(e.message, 'error'); } };
  const visto = () => contestar(x.visto || 'Visto 💪');
  const voz = () => x.voz({ atleta: s.atleta, cita: `Sobre tu sesión «${s.nombre}» 👆`, alEnviado: () => { x.anotar('contestadas'); quitar('sesiones', s.id, () => api.marcarRevisado('sesion', s.id)).catch(() => {}); } });
  // (v0.195) al comentar, la tarjeta se va (la base ya la da por revisada) y el foco pasa a la siguiente
  const comentado = () => { x.anotar('contestadas'); quitar('sesiones', s.id, async () => {}).catch(() => {}); };
  const clave = `s-${s.id}`;
  const m = x.marcas?.[s.id];
  const item = { tipo: 'sesiones', s, atleta: s.atleta };
  const pauta = s.cardio ? textoCardio(s.cardio) : '';
  return (
    <article tabIndex={-1} class="panel panel-pad pila-s tarjeta-revisar">
      <Cabecera atleta={s.atleta} tipo={`S${s.semana?.numero ?? '?'}`} cuando={fmtConDia(s.fecha_realizada)} abrirAtleta={abrirAtleta} pestana="registro" />
      <strong>{s.nombre}</strong>
      <div class="fila-envolver">
        <span class="chip num">{s.series.hechas}/{s.series.pautadas} series</span>
        {s.rpe_sesion && <span class={`chip num ${s.rpe_sesion >= 9 ? 'aviso' : ''}`}>Esfuerzo {num(s.rpe_sesion)}/10</span>}
        {cardioHechoValido(s.cardio_hecho) ? <span class="chip num">{NOMBRE_MODALIDAD[s.cardio_hecho.modalidad]}: {textoCardioHecho(s.cardio_hecho)}</span> : s.duracion_min && <span class="chip num">{s.duracion_min} min</span>}
        {s.rpeMax >= 10 && <span class="chip aviso">Alguna serie a RPE 10</span>}
        {s.cortas > 0 && <span class="chip aviso">{s.cortas} por debajo del rango</span>}
      </div>
      {pauta && <p class="mini secundario revisar-cardio"><span>Pautado: {pauta}</span>{cardioHechoValido(s.cardio_hecho) && <span> · Hecho: {textoCardioHecho(s.cardio_hecho)}</span>}</p>}
      <MarcasSesion m={m} />
      {s.preparacion && <ChipLlegada preparacion={s.preparacion} soloAvisos />}
      {s.nota_atleta && <p class="cita">«{s.nota_atleta}»</p>}
      {s.series.pautadas > 0 && <button type="button" class="btn-texto mini revisar-ver-series" aria-expanded={detalle ? 'true' : 'false'} onClick={() => setDetalle(!detalle)}><Icono n={detalle ? 'arriba' : 'abajo'} /> {detalle ? 'Ocultar las series' : 'Ver serie a serie'}</button>}
      {detalle && m?.principal && <Linea puntos={m.principal.puntos} etiqueta={`${m.principal.ejercicio}, 1RM estimado`} unidad=" kg" rangoMin={5} />}
      {detalle && <DetalleSesion s={s} m={m} />}
      {abierto && <Hilo atletaId={s.atleta.id} sesionId={s.id} nombreAtleta={s.atleta.nombre} alCambiar={comentado} frasesRapidas={x.frasesDe('sesiones')} variables={x.variablesDe(item)} borrador={x.borradorDe(item, s.atleta.nombre)} />}
      <Acciones abierto={abierto} setAbierto={setAbierto} revisar={revisar} visto={visto} voz={voz} manana={(dias) => x.apartar(clave, dias)}
        mas={{ emoji: contestar, tarea: () => x.tarea(s.atleta), video: () => x.tarea(s.atleta, { tipo: 'video', titulo: m?.principal ? `Grábame ${m.principal.ejercicio.toLowerCase()}` : 'Grábame un vídeo de técnica', ejercicio_id: m?.principal?.ejercicio_id || '' }),
          nota: () => x.nota(s.atleta, `${s.nombre}${s.rpe_sesion ? `, esfuerzo ${num(s.rpe_sesion)}` : ''}${s.nota_atleta ? `: «${s.nota_atleta.slice(0, 100)}»` : ''}`), fijada: x.esFijada(clave), fijar: () => x.fijar(clave),
          programada: () => x.programada(s.atleta, `Sobre tu sesión «${s.nombre}»:`, () => { x.anotar('contestadas'); quitar('sesiones', s.id, () => api.marcarRevisado('sesion', s.id)).catch(() => {}); }), etiqueta: () => x.etiquetar(clave), etiquetaActual: x.etiquetaDe(clave) }}
        extra={s.atleta.entrenamiento !== false ? <button type="button" class="btn btn-peq btn-texto revisar-programar" onClick={() => x.programar(s.atleta)}><Icono n="editar" /> Programar</button> : null} />
    </article>
  );
}

function TarjetaCheckin({ c, recargar, quitar, abrirAtleta }) {
  const { api, aviso } = useApp();
  const x = useContext(CtxRevisar);
  const [abierto, setAbierto] = useState(false);
  const primer = c.atleta.nombre.split(' ')[0];
  const revisar = async () => { try { await quitar('checkins', c.id, () => x.enviar('revisar', ['checkin', c.id])); x.anotar('revisadas'); aviso('Check-in revisado', 'ok', deshacer(api, 'checkin', c.id, recargar)); } catch (e) { aviso(e.message, 'error'); } };
  const contestar = async (texto) => { try { await quitar('checkins', c.id, () => x.enviar('comentar', { atletaId: c.atleta.id, checkinId: c.id, texto: rellenarFrase(texto, c.atleta.nombre, {}), autor: 'coach', clienteId: nuevoId('visto') })); x.anotar('contestadas'); aviso(`Contestado a ${primer}`, 'ok'); } catch (e) { aviso(e.message, 'error'); } };
  const visto = () => contestar(x.visto || 'Visto 💪');
  const voz = () => x.voz({ atleta: c.atleta, cita: 'Sobre tu check-in 👆', alEnviado: () => { x.anotar('contestadas'); quitar('checkins', c.id, () => api.marcarRevisado('checkin', c.id)).catch(() => {}); } });
  const comentado = () => { x.anotar('contestadas'); quitar('checkins', c.id, async () => {}).catch(() => {}); };
  const clave = `c-${c.id}`;
  const adh = [c.adherencia_desayuno, c.adherencia_comida, c.adherencia_merienda, c.adherencia_cena].filter(Boolean);
  const mediaAdh = adh.length ? Math.round(adh.reduce((a, b) => a + b, 0) / adh.length) : null;
  return (
    <article tabIndex={-1} class="panel panel-pad pila-s tarjeta-revisar">
      <Cabecera atleta={c.atleta} tipo="Check-in" cuando={rangoSemana(c.semana_inicio)} abrirAtleta={abrirAtleta} pestana="seguimiento" />
      <div class="fila-envolver">
        {c.horas_sueno && <span class="chip">Sueño {c.horas_sueno.replace('-', '–')} h</span>}
        {c.energia && <span class={`chip ${c.energia <= 2 ? 'aviso' : ''}`}>Energía {c.energia}/5</span>}
        {c.recuperacion && <span class={`chip ${c.recuperacion <= 2 ? 'aviso' : ''}`}>Recuperación {c.recuperacion}/5</span>}
        {c.motivacion && <span class={`chip ${c.motivacion <= 2 ? 'aviso' : ''}`}>{ESCALAS.motivacion[c.motivacion - 1]}</span>}
        {mediaAdh && <span class="chip">Dieta {ESCALAS.adherencia[mediaAdh - 1]}</span>}
        {c.molestias.map((m) => <span key={m.id} class={`chip ${m.intensidad >= 2 ? (m.intensidad >= 3 ? 'alerta' : 'aviso') : ''}`}>{NOMBRE_ZONA[m.zona] || m.zona}: {m.valor != null ? `${m.valor} de 10` : ESCALAS.molestia[m.intensidad].toLowerCase()}</span>)}
        {(c.respuestasLeidas || []).filter((r) => r.pregunta.tipo !== 'texto').map((r) => <span key={r.pregunta.id} class="chip chip-respuesta">{r.pregunta.texto}: {r.texto}</span>)}
      </div>
      <CambiosCheckin c={c} />
      {(c.respuestasLeidas || []).filter((r) => r.pregunta.tipo === 'texto').map((r) => <p key={r.pregunta.id} class="peq"><span class="secundario">{r.pregunta.texto}</span> «{r.texto}»</p>)}
      {c.notas && <p class="cita">«{c.notas}»</p>}
      {abierto && <Hilo atletaId={c.atleta.id} checkinId={c.id} nombreAtleta={c.atleta.nombre} alCambiar={comentado} frasesRapidas={x.frasesDe('checkins')} borrador={x.borradorDe({ tipo: 'checkins', c, atleta: c.atleta }, c.atleta.nombre)} />}
      <Acciones abierto={abierto} setAbierto={setAbierto} revisar={revisar} visto={visto} voz={voz} manana={(dias) => x.apartar(clave, dias)}
        mas={{ emoji: contestar, tarea: () => x.tarea(c.atleta), nota: () => x.nota(c.atleta, c.notas ? `Del check-in: «${c.notas.slice(0, 120)}»` : 'Del check-in: '), fijada: x.esFijada(clave), fijar: () => x.fijar(clave),
          programada: () => x.programada(c.atleta, 'Sobre tu check-in:', () => { x.anotar('contestadas'); quitar('checkins', c.id, () => api.marcarRevisado('checkin', c.id)).catch(() => {}); }), etiqueta: () => x.etiquetar(clave), etiquetaActual: x.etiquetaDe(clave) }}
        extra={c.atleta.entrenamiento !== false ? <button type="button" class="btn btn-peq btn-texto revisar-programar" onClick={() => x.programar(c.atleta)}><Icono n="editar" /> Programar</button> : null} />
    </article>
  );
}

function TarjetaVideo({ a, recargar, quitar, abrirAtleta, objetivo = OBJETIVO_REVISION }) {
  const { api, aviso } = useApp();
  const x = useContext(CtxRevisar);
  const [abierto, setAbierto] = useState(false);
  // (v0.57) una repetición de un vídeo corregido: lado a lado con el original
  const [comparar, setComparar] = useState(null);
  const verOriginal = async () => { try { const o = await api.archivo(a.repite_de); if (!o) { aviso('El original ya no está', 'error'); return; } setComparar([o, a]); } catch (e) { aviso(e.message, 'error'); } };
  const revisar = async () => { try { await quitar('archivos', a.id, () => x.enviar('revisar', ['archivo', a.id])); x.anotar('revisadas'); aviso('Vídeo revisado', 'ok', deshacer(api, 'archivo', a.id, recargar)); } catch (e) { aviso(e.message, 'error'); } };
  const primer = a.atleta.nombre.split(' ')[0];
  const esVideo = a.tipo === 'video_tecnica';
  const contestar = async (texto) => { try { await quitar('archivos', a.id, () => x.enviar('comentar', { atletaId: a.atleta.id, archivoId: a.id, texto: rellenarFrase(texto, a.atleta.nombre, x.variablesDe({ tipo: 'videos', a })), autor: 'coach', clienteId: nuevoId('visto') })); x.anotar('contestadas'); aviso(`Contestado a ${primer}`, 'ok'); } catch (e) { aviso(e.message, 'error'); } };
  const visto = esVideo ? () => contestar(x.visto || 'Visto 💪') : null;
  const voz = () => x.voz({ atleta: a.atleta, cita: `Sobre tu ${esVideo ? `vídeo${a.ejercicio?.nombre ? ` de ${a.ejercicio.nombre}` : ''}` : 'foto de progreso'} 👆`, alEnviado: () => { x.anotar('contestadas'); quitar('archivos', a.id, () => api.marcarRevisado('archivo', a.id)).catch(() => {}); } });
  const clave = `v-${a.id}`;
  return (
    <article tabIndex={-1} class="panel panel-pad pila-s tarjeta-revisar">
      <Cabecera atleta={a.atleta} tipo={a.tipo === 'foto_progreso' ? 'Foto de progreso' : a.ejercicio?.nombre ? `Vídeo: ${a.ejercicio.nombre}` : 'Vídeo de técnica'} cuando={fmtConDia(a.fecha)} abrirAtleta={abrirAtleta} pestana="videos" />
      {(a.serie || a.repite_de || a.tipo === 'video_tecnica') && (
        <div class="fila-envolver">
          {a.tipo === 'video_tecnica' && <ChipEspera creado={a.creado_en} objetivo={objetivo} />}
          {a.serie && <span class="chip num">Serie {a.serie.numero}{a.serie.texto ? `: ${a.serie.texto}` : ''}</span>}
          {a.autoevaluacion?.molestia && <span class="chip alerta"><Icono n="alerta" />{textoAutoevaluacion(a.autoevaluacion, a.atleta?.nombre).molestia}</span>}
          {a.repite_de && <button type="button" class="btn btn-peq" onClick={verOriginal}><Icono n="duplicar" /> Repetición: comparar con el original</button>}
        </div>
      )}
      {a.tipo === 'foto_progreso' && <button type="button" class="btn-texto mini revisar-fotos-btn" onClick={() => x.fotos(a)} aria-haspopup="dialog"><Icono n="imagen" /> Comparar con la anterior</button>}
      {comparar && <CompararVideos videos={comparar} nombreDe={(v) => (v.id === a.id ? 'Repetición' : 'Original')} inicialA={a.id} inicialB={comparar[0].id} alCerrar={() => setComparar(null)} />}
      {!abierto ? (
        <div class="revisar-video">
          <MiniaturaRevisar a={a} alAbrir={() => setAbierto(true)} />
          {a.nota_atleta ? <p class="cita">«{a.nota_atleta}»</p> : !a.autoevaluacion?.nota && <p class="peq terciario">Sin nota.</p>}
          {!abierto && a.autoevaluacion && (a.autoevaluacion.nota || a.autoevaluacion.rpe != null) && <p class="peq secundario">{textoAutoevaluacion(a.autoevaluacion, a.atleta?.nombre).titulo} {[a.autoevaluacion.rpe != null ? textoAutoevaluacion(a.autoevaluacion).rpe : null, a.autoevaluacion.nota ? `«${a.autoevaluacion.nota}»` : null].filter(Boolean).join(' · ')}</p>}
        </div>
      ) : !esVideo && a.nota_atleta && <p class="cita">«{a.nota_atleta}»</p>}
      {abierto && (() => {
        const propsHilo = { atletaId: a.atleta.id, archivoId: a.id, nombreAtleta: a.atleta.nombre, placeholder: 'Qué corregir, qué está bien…', ejercicio: a.ejercicio || null, frasesRapidas: x.frasesDe('videos'), variables: x.variablesDe({ tipo: 'videos', a }), borrador: x.borradorDe({ tipo: 'videos', a, atleta: a.atleta }, a.atleta.nombre), alCambiar: () => { x.anotar('contestadas'); recargar(); } };
        if (!esVideo) return <><VerArchivo archivo={a} /><Hilo {...propsHilo} /></>;
        // (v0.220) El vídeo abierto, en el ordenador: ocupa toda la fila y va en columnas (vídeo, corrección e hilo); (v0.226) la
        // parte de escribir, debajo del vídeo
        return (
          <RevisionEnColumnas clase="revdos-tarjeta" ver={<>{a.nota_atleta && <p class="cita">«{a.nota_atleta}»</p>}<VerArchivo archivo={a} /></>}
            corregir={<><LoQueLeDijiste a={a} /><PanelCorreccion video={a} esCoach nombreAtleta={a.atleta.nombre} /></>} hilo={propsHilo} />
        );
      })()}
      <Acciones abierto={abierto} setAbierto={setAbierto} revisar={revisar} etiquetaComentar="Ver y comentar" visto={visto} voz={voz} manana={(dias) => x.apartar(clave, dias)}
        mas={{ emoji: esVideo ? contestar : null, tarea: () => x.tarea(a.atleta), video: esVideo ? () => x.tarea(a.atleta, { tipo: 'video', titulo: a.ejercicio?.nombre ? `Repíteme ${a.ejercicio.nombre.toLowerCase()}` : 'Repíteme el vídeo', ejercicio_id: a.ejercicio?.id || a.ejercicio_id || '' }) : null,
          nota: () => x.nota(a.atleta, esVideo ? `Vídeo de ${a.ejercicio?.nombre || 'técnica'}${a.nota_atleta ? `: «${a.nota_atleta.slice(0, 100)}»` : ''}` : 'Foto de progreso nueva'), fijada: x.esFijada(clave), fijar: () => x.fijar(clave),
          programada: () => x.programada(a.atleta, `Sobre tu ${esVideo ? 'vídeo' : 'foto'}:`, () => { x.anotar('contestadas'); quitar('archivos', a.id, () => api.marcarRevisado('archivo', a.id)).catch(() => {}); }), etiqueta: () => x.etiquetar(clave), etiquetaActual: x.etiquetaDe(clave) }} />
    </article>
  );
}

// (v0.61, 5) Los vídeos de la bandeja: los de una misma sesión (dos o más, del mismo atleta) van en una sola tarjeta, donde
// iría el primero; los demás, uno a uno como siempre
function itemsVideos(archivos = [], separadas = new Set()) {
  const pautas = Object.fromEntries(archivos.filter((a) => a.pauta && a.sesion_ejercicio_id && !separadas.has(a.pauta.sesion_id)).map((a) => [a.sesion_ejercicio_id, a.pauta]));
  const { grupos } = agruparPorSesion(archivos, pautas);
  const deVideo = new Map(grupos.flatMap((g) => g.videos.map((v) => [v.id, g])));
  const puestos = new Set();
  const out = [];
  for (const a of archivos) {
    const g = deVideo.get(a.id);
    if (!g) { out.push({ tipo: 'videos', clave: `v-${a.id}`, atleta: a.atleta, a }); continue; }
    if (puestos.has(g)) continue;
    puestos.add(g);
    out.push({ tipo: 'videos', clave: `sv-${g.sesionId}`, atleta: g.videos[0].atleta, g });
  }
  return out;
}

// (v0.61, 5) Una sesión con varios vídeos: «Sesión del martes · 4 vídeos», los ejercicios en su orden y «Revisar la sesión»
// (uno detrás de otro, con las series de la sesión y, al final, un solo resumen para el atleta)
function TarjetaSesionVideos({ g, recargar, abrirAtleta, objetivo = OBJETIVO_REVISION, separar, clave = null }) {
  const x = useContext(CtxRevisar);
  const [abierta, setAbierta] = useState(false);
  const v0 = g.videos[0];
  const fecha = v0.sesionVideo?.fecha || v0.fecha;
  const titulo = tituloSesion(fecha, g.videos.length);
  const masAntiguo = g.videos.map((v) => v.creado_en).filter(Boolean).sort()[0] || null;
  const molestia = g.videos.find((v) => v.autoevaluacion?.molestia);
  return (
    <article tabIndex={-1} class="panel panel-pad pila-s tarjeta-revisar tarjeta-sesion-videos">
      <Cabecera atleta={v0.atleta} tipo={titulo} cuando={v0.sesionVideo?.nombre || null} abrirAtleta={abrirAtleta} pestana="videos" />
      <div class="fila-envolver">
        {masAntiguo && <ChipEspera creado={masAntiguo} objetivo={objetivo} />}
        {molestia && <span class="chip alerta"><Icono n="alerta" />{textoAutoevaluacion(molestia.autoevaluacion, v0.atleta?.nombre).molestia}</span>}
      </div>
      <ol class="sesion-videos-lista">
        {g.videos.map((v) => (
          <li key={v.id}>
            <Icono n="video" />
            <span class="peq">{v.ejercicio?.nombre || 'Vídeo'}</span>
            {v.serie && <span class="chip num">Serie {v.serie.numero}{v.serie.texto ? `: ${v.serie.texto}` : ''}</span>}
            {v.revision?.corregido_el && <span class="chip morado">Corregido</span>}
          </li>
        ))}
      </ol>
      {abierta && <RevisionSesion grupo={g} abrirAtleta={abrirAtleta} alCerrar={() => { setAbierta(false); recargar(); }} />}
      <div class="fila-envolver">
        <button type="button" class="btn btn-peq btn-primario" onClick={() => setAbierta(true)} aria-haspopup="dialog"><Icono n="video" /> Revisar la sesión</button>
        {separar && <button type="button" class="btn btn-peq" onClick={separar}>Ver uno a uno</button>}
        {clave && <button type="button" class="btn btn-peq btn-texto revisar-manana" onClick={() => x.apartar(clave, 1)}><Icono n="reloj" /> Mañana</button>}
        {clave && <button type="button" class="btn btn-peq btn-texto revisar-fijar" aria-pressed={x.esFijada(clave) ? 'true' : 'false'} onClick={() => x.fijar(clave)}><Icono n="chincheta" /> {x.esFijada(clave) ? 'Quitar de arriba' : 'Fijar arriba'}</button>}
      </div>
    </article>
  );
}

// v0.59 (18): cuánto lleva esperando («hace 26 h»), con el color del objetivo del coach: a tiempo, cerca o pasado
function ChipEspera({ creado, objetivo }) {
  const h = horasEsperando(creado);
  if (h == null) return null;
  const n = nivelEspera(h, objetivo);
  return <span class={`chip num espera espera-${n}`} title={`Esperando: ${NOMBRE_NIVEL_ESPERA[n]} (objetivo ${objetivo} h)`}><Icono n="reloj" />{textoEspera(h)}<span class="sr">, {NOMBRE_NIVEL_ESPERA[n]}</span></span>;
}

// Los tiempos de la cola (solo el coach): el objetivo (el orden está arriba, para todo, desde la v0.195), la mediana y el p90 de lo que tardas en revisar (30
// días), los revisados esta semana y el que más lleva esperando
function TiemposRevision({ objetivo, setObjetivo }) {
  const { api } = useApp();
  const [abierto, setAbierto] = useState(false);
  const est = useCarga(() => (abierto ? api.estadisticasRevision() : Promise.resolve(null)), [abierto]);
  const e = est.datos;
  return (
    <div class="tiempos-revision panel panel-pad pila-s">
      <div class="fila-envolver">
        <span class="mini" id="objetivo-revision">Objetivo</span>
        <div class="segmentos" role="group" aria-labelledby="objetivo-revision">
          {OBJETIVOS_REVISION.map((h) => <button key={h} type="button" aria-pressed={objetivo === h ? 'true' : 'false'} onClick={() => setObjetivo(h)}>{h} h</button>)}
        </div>
        <button type="button" class="btn-texto mini" aria-expanded={abierto ? 'true' : 'false'} onClick={() => setAbierto(!abierto)}><Icono n="historial" /> Tus tiempos de revisión</button>
      </div>
      {abierto && (e ? (
        <dl class="tiempos-datos" aria-label="Tus tiempos de revisión">
          <div><dt>Mediana (30 días)</dt><dd class="num">{textoHoras(e.mediana)}</dd></div>
          <div><dt>P90 (30 días)</dt><dd class="num">{textoHoras(e.p90)}</dd></div>
          <div><dt>Revisados esta semana</dt><dd class="num">{e.semana}</dd></div>
          <div><dt>El que más espera</dt><dd class={`num espera-${nivelEspera(e.masAntiguo, objetivo) || 'ok'}`}>{e.masAntiguo != null ? textoHoras(e.masAntiguo) : '—'}</dd></div>
        </dl>
      ) : <p class="mini terciario" role="status">Calculando…</p>)}
      {abierto && e && <p class="mini terciario">De que llega el vídeo a que lo das por revisado (o lo corriges), en los {e.n30} que has revisado en los últimos 30 días. Verde: dentro de la mitad del objetivo; ámbar: antes del objetivo; rojo: pasado.</p>}
    </div>
  );
}

// v0.50: la miniatura del vídeo (la que guardó el móvil al subirlo) o, si no hay, un hueco neutro; con su duración.
// No descarga el vídeo: eso, al abrirlo. Las fotos de progreso se ven tal cual.
function MiniaturaRevisar({ a, alAbrir }) {
  const { api } = useApp();
  const esFoto = a.tipo === 'foto_progreso';
  // Las fotos de progreso (el cuerpo) no se cargan solas en una pantalla que puede ver otro: hueco hasta que la abres
  const ruta = esFoto ? null : a.poster_ruta;
  const [url, setUrl] = useState(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    let vivo = true;
    setUrl(null); setFallo(false);
    if (ruta) api.urlArchivo(ruta).then((u) => vivo && setUrl(u)).catch(() => vivo && setFallo(true));
    return () => { vivo = false; };
  }, [ruta]);
  const nombre = a.atleta?.nombre?.split(' ')[0] || 'tu atleta';
  return (
    <button type="button" class={`revisar-mini ${esFoto ? 'foto' : ''}`} onClick={alAbrir}
      aria-label={esFoto ? `Ver la foto de ${nombre}` : `Reproducir el vídeo de ${nombre}${a.duracion_seg ? ` (${duracionCorta(a.duracion_seg)})` : ''}`}>
      {url && !fallo ? <img src={url} alt="" loading="lazy" onError={() => setFallo(true)} /> : <span class="revisar-mini-hueco" aria-hidden="true"><Icono n={esFoto ? 'imagen' : 'video'} /></span>}
      {!esFoto && <span class="revisar-mini-play" aria-hidden="true"><Icono n="play" /></span>}
      {!esFoto && a.duracion_seg ? <span class="revisar-mini-dur num" aria-hidden="true">{duracionCorta(a.duracion_seg)}</span> : null}
    </button>
  );
}

// Una receta que el atleta pide cambiar (v0.26): se ajusta en su ficha (Nutrición → Recetario) o se da por resuelta
function TarjetaCambioReceta({ r, recargar, abrirAtleta }) {
  const { api, aviso } = useApp();
  const resolver = async () => { try { await api.resolverCambioReceta(r.id); aviso('Petición resuelta'); recargar(); } catch (e) { aviso(e.message, 'error'); } };
  return (
    <article tabIndex={-1} class="panel panel-pad pila-s tarjeta-revisar">
      <Cabecera atleta={r.atleta} tipo={`Pide cambiar una receta (${NOMBRE_TOMA[r.toma]?.toLowerCase() || r.toma})`} cuando={cuando(r.cambio_pedido_en)} abrirAtleta={abrirAtleta} pestana="nutricion" />
      <p class="peq"><strong>{r.receta.nombre}</strong></p>
      {r.cambio_nota && <p class="cita">«{r.cambio_nota}»</p>}
      <div class="fila-envolver">
        <button class="btn btn-peq" onClick={() => abrirAtleta(r.atleta.id, 'nutricion')}><Icono n="receta" /> Ir a su recetario</button>
        <button class="btn btn-peq revisar-hecho" onClick={resolver}><Icono n="hecho" /> Resuelto</button>
      </div>
    </article>
  );
}

// (v0.173, 076) Un objetivo que propone el atleta: se contesta en su hoja (aceptar, ajustando si hace falta, o descartar)
function TarjetaPropuesta({ o, recargar, abrirAtleta }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <article tabIndex={-1} class="panel panel-pad pila-s tarjeta-revisar">
      <Cabecera atleta={o.atleta} tipo={`Propone un objetivo (${NOMBRE_TIPO_PROPUESTA[o.tipo].toLowerCase()})`} cuando={cuando(o.creado_en)} abrirAtleta={abrirAtleta} pestana="objetivos" />
      <p class="peq"><strong>{textoPropuesta(o)}</strong>{o.fecha ? `, para el ${fmtCorta(o.fecha)}` : ''}</p>
      {o.motivo && <p class="cita">«{o.motivo}»</p>}
      <div class="fila-envolver">
        <button class="btn btn-peq btn-primario" onClick={() => setAbierta(true)}><Icono n="diana" /> Contestar</button>
        <button class="btn btn-peq" onClick={() => abrirAtleta(o.atleta.id, 'objetivos')}>Ver sus objetivos</button>
      </div>
      {abierta && <HojaPropuesta p={o} alCerrar={(cambio) => { setAbierta(false); if (cambio) recargar(); }} />}
    </article>
  );
}

// «Avisar al coach» en la comunidad (v0.43): lo avisado, quién lo escribió y quién avisa. Ocultarlo (o borrarlo) lo
// quita del muro; «Resuelto», si está bien así. Si su autor lo ha borrado, sale la copia que guardó la base.
function TarjetaReporte({ r, recargar }) {
  const { api, aviso } = useApp();
  const [ocupado, setOcupado] = useState(false);
  const oculto = r.borrado ? false : r.de_comentario ? r.comentario.oculto : r.post.oculta;
  const hacer = async (fn, t) => {
    if (ocupado) return;
    setOcupado(true);
    try { await fn(); aviso(t); recargar(); } catch (e) { aviso(e.message, 'error'); } finally { setOcupado(false); }
  };
  const ocultar = () => hacer(async () => {
    if (r.de_comentario) await api.ocultarComentarioComunidad(r.comentario.id, true); else await api.ocultarEnComunidad(r.post.id, true);
    await api.resolverReporte(r);
  }, r.de_comentario ? 'Comentario oculto' : 'Publicación oculta');
  const borrar = () => hacer(async () => {
    if (r.de_comentario) await api.borrarComentarioComunidad(r.comentario.id); else await api.borrarDeComunidad(r.post);
    await api.resolverReporte({ ...r, post_id: r.de_comentario ? r.post_id : null });
  }, 'Borrado del muro');
  return (
    <article tabIndex={-1} class="panel panel-pad pila-s tarjeta-revisar tarjeta-reporte">
      <div class="revisar-cab">
        <span class="ico-reporte" aria-hidden="true"><Icono n="bandera" /></span>
        <span class="pila-xs"><strong>{r.de_comentario ? 'Un comentario en el equipo' : 'Una publicación en el equipo'}</strong><span class="mini terciario">De {r.autor} · avisa {r.quienAvisa} · {cuando(r.creado_en)}</span></span>
      </div>
      {r.borrado && <p class="mini terciario"><strong>Borrado por su autor</strong> después del aviso: esto es lo que había.</p>}
      {r.texto && <p class="cita">«{r.texto.length > 300 ? `${r.texto.slice(0, 300)}…` : r.texto}»</p>}
      {(r.fotos || (r.foto ? [r.foto] : [])).map((f, i, l) => <FotoAvisada key={f} ruta={f} n={l.length > 1 ? i + 1 : 0} total={l.length} />)}
      {r.motivo && <p class="peq"><strong>Por qué:</strong> {r.motivo}</p>}
      {oculto && <p class="mini terciario">Ya está oculto.</p>}
      <div class="fila-envolver">
        {!r.borrado && !oculto && <button class="btn btn-peq" disabled={ocupado} onClick={ocultar}><Icono n="ojo" /> Ocultar</button>}
        {!r.borrado && <button class="btn btn-peq btn-peligro" disabled={ocupado} onClick={borrar}><Icono n="basura" /> Borrar</button>}
        <button class="btn btn-peq revisar-hecho" disabled={ocupado} onClick={() => hacer(() => api.resolverReporte(r), 'Aviso resuelto')}><Icono n="hecho" /> Resuelto</button>
      </div>
    </article>
  );
}

// La foto de lo avisado (el coach la puede ver mientras el aviso esté abierto, aunque su autor la haya borrado)
function FotoAvisada({ ruta, n = 0, total = 0 }) {
  const { api } = useApp();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let vivo = true;
    api.urlFotoComunidad(ruta).then((u) => vivo && setUrl(u)).catch(() => vivo && setError(true));
    return () => { vivo = false; };
  }, [ruta]);
  if (error) return <p class="mini terciario">La foto ya no está disponible.</p>;
  return url ? <img class="post-foto" src={url} alt={n ? `Foto ${n} de ${total} de lo avisado` : 'La foto de lo avisado'} loading="lazy" /> : null;
}

// Bandeja vacía (v0.50): «Todo al día», con la barra en su soporte en línea y el lobo
// (v0.195) y lo que llevas revisado hoy
function BandejaVacia({ cuenta = null, racha = '', tanda = '' }) {
  return (
    <div class="panel bandeja-vacia">
      <Vacio ilustracion="todo" titulo="Todo al día">Tus atletas tienen respuesta: aquí saldrá lo nuevo de sus sesiones, check-ins, mensajes y vídeos.</Vacio>
      {cuenta > 0 && <p class="peq revisar-cuenta-dia" role="status">{textoCuentaDia(cuenta)}</p>}
      {tanda && <p class="peq revisar-cuenta-dia"><strong>Esta tanda:</strong> {tanda}</p>}
      {racha && <p class="peq revisar-racha"><Icono n="llama" /> {racha}.</p>}
    </div>
  );
}
