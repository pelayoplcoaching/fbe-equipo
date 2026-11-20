import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { HojaAvisos } from '../Avisos.jsx';
import { useEstrecha } from '../BarraMas.jsx';
import { CabeceraGrande, useUnaVez, Siluetas, Reserva, useApp, useCarga, Icono, Cargando, ErrorCaja, Hoja, Vacio, copiar, Avatar, Segmentos, DegradadoAro } from '../comunes.jsx';
import { NIVELES, AYUDA_NIVEL, SERVICIOS, CAMPOS_SERVICIO, NOMBRE_NIVEL } from '../../logica/nivel.js';
import { mensajeParaAlerta } from '../../logica/cierre.js';
import { BandaDemo } from '../App.jsx';
import { leerPreferencia, guardarPreferencia } from '../preferencias.js';
import { num, signo, NOMBRE_FOCO, ESCALAS } from '../../logica/calculos.js';
import { hace, fmtCorta } from '../../logica/fechas.js';
import { fmtEuros } from '../../logica/cobros.js';
import { estadoAtleta, NOMBRE_ESTADO, chispaSuave } from '../../logica/visual.js';
import { equipoHoy, arcoDial } from '../../logica/tablero.js';
import { hoyISO, fmtConDia } from '../../logica/fechas.js';
import { horaMadrid } from '../../logica/perfil.js';
import { CabCoach } from './CabCoach.jsx';
import { ConAro } from '../Aro.jsx';
import { resumenDiaCoach, tonoColumna } from '../../logica/belleza.js';
import { AvisoAlmacenamientoPanel } from '../tecnica/Limpieza.jsx';
import { CumplesHoy } from './PersonalCoach.jsx';
import { EnviosPendientes } from '../atleta/CoachSabe.jsx';
import { useContactos } from './Integraciones.jsx';
import { enlaceWhatsApp } from '../../logica/integraciones.js';
import { usePanelCoach, useExtrasPanel, Etiquetas, DetalleAtleta, AccionesRapidas, HojaColumnas, HojaFiltros, HojaVistas, HojaVarios, HojaColores, HojaTeclasPanel,
  HojaChatRapido, HojaVozAtleta, HojaUmbrales, HojaTarjeta } from './PanelLista.jsx';
import { ChatRapido } from './RevisionTodo.jsx';
import { TITULO_COLUMNA, ORDENES, AGRUPAR, CONTADORES, NOMBRE_MARCA, FILTROS_VACIOS, limpiarFiltros, cumpleEstado, cumpleFiltros, coincide, contar, ordenar, agrupar, dirInicial,
  etiquetasUsadas, etiquetasDe, fijado as fijadoDe, sinLeerDe, textoFiltros, conEtiqueta, proximaDe, TEXTO_PROXIMA_CORTO, checkinAlDia, diasSinEntrenar,
  conUmbrales, novedadesDe, recordatorioDe, recordatorioParaHoy, textoRecordatorio, limpiarRecordatorio, textoContacto, textoHito, resumenColumna, csvLista, moverManual,
  cuantosFiltros, limpiarTarjeta, CAMPOS_TARJETA, colorEtiqueta } from '../../logica/panel-atletas.js';

// v0.49: minigráficas del panel (solo las ve el coach): el peso de las últimas semanas y las sesiones hechas de las
// programadas en las 6 últimas, con su texto para los lectores de pantalla
export function ChispaPeso({ puntos = [] }) {
  if (puntos.length < 2) return null;
  const ys = puntos.map((p) => p.y);
  const dif = ys[ys.length - 1] - ys[0];
  return (
    <svg class={`chispa chispa-peso ${dif < -0.05 ? 'baja' : dif > 0.05 ? 'sube' : ''}`} viewBox="0 0 64 20" width="64" height="20" role="img"
      aria-label={`Peso en ${puntos.length} semanas: de ${num(ys[0])} a ${num(ys[ys.length - 1])} kg`}>
      {(() => { const c = chispaSuave(ys, 64, 20, 3); return <><path d={c.d} />{c.fin && <circle class="chispa-fin" cx={c.fin[0]} cy={c.fin[1]} r="2.4" />}</>; })()}
    </svg>
  );
}
export function ChispaSesiones({ semanas = [] }) {
  if (!semanas.some((w) => w.total > 0)) return null;
  const w = 64 / semanas.length;
  return (
    <svg class="chispa chispa-sesiones" viewBox="0 0 64 20" width="64" height="20" role="img"
      aria-label={`Sesiones en las ${semanas.length} últimas semanas: ${semanas.map((x) => (x.total ? `${x.hechas} de ${x.total}` : 'sin programar')).join(', ')}`}>
      {semanas.map((x, i) => {
        const h = x.total ? Math.max(2, (Math.min(x.hechas, x.total) / x.total) * 18) : 2;
        return <rect key={x.lunes} class={!x.total ? 'vacia' : x.hechas >= x.total ? 'llena' : ''} x={i * w + 1.5} y={20 - h - 1} width={w - 3} height={h} rx="1.5" />;
      })}
    </svg>
  );
}

function Pips({ hechas, total }) {
  if (!total) return <span class="terciario">—</span>;
  return <span class="pips" role="img" aria-label={`${hechas} de ${total} sesiones`}>{Array.from({ length: total }, (_, i) => <i key={i} class={i < hechas ? 'hecha' : ''} />)}</span>;
}

// Los avisos de un atleta. En la tabla del escritorio van en su columna con max={2}: se ven los dos primeros (lo que
// hay por revisar y lo más urgente, que es como llegan ordenados) y un «+N» con el resto al pasar el ratón; los demás
// siguen en la página para los lectores de pantalla (diseno.css, bloque 10). En las tarjetas del móvil, todos.
function Alertas({ r, pendientes, max = 0 }) {
  if (!r.alertas.length && !pendientes) return null;
  const textos = [...(pendientes > 0 ? [`${pendientes} por revisar`] : []), ...r.alertas.map((a) => a.texto)];
  const resto = max > 0 ? textos.slice(max) : [];
  return (
    <div class="alertas" data-max={max || undefined}>
      {pendientes > 0 && <span class="chip morado" title={max ? textos[0] : undefined}><Icono n="bandeja" /><span class="chip-txt">{pendientes} por revisar</span></span>}
      {r.alertas.map((a) => <span key={a.tipo} class={`chip ${a.nivel}`} title={max ? a.texto : undefined}>{a.nivel !== 'info' && <Icono n="alerta" />}<span class="chip-txt">{a.texto}</span></span>)}
      {resto.length > 0 && <span class="chip mas num" aria-hidden="true" title={resto.join(' · ')}>+{resto.length}</span>}
    </div>
  );
}

const sueno = (h) => (h ? `${h.replace('-', '–')} h` : '—');
const MOLESTIA = ['Sin dolor', 'Leve', 'Moderada', 'Grave'];

// (v0.198) Lo que se queda al abrir una ficha y volver (mientras la app siga abierta): la búsqueda, el filtro, lo
// desplegado y por dónde ibas
const memoria = { busqueda: '', estado: 'todos', filtros: { ...FILTROS_VACIOS }, abiertos: [], elegir: false, elegidos: [], scroll: 0, volver: false, vistoPrev: undefined, sel: null };

export function Panel({ abrir: abrirFicha, pendientes = {}, porRevisar = null, irARevisar = null, peticion = null, alBuscar, abrirCuenta, alCargar, alOrden }) {
  const { api, perfil, aviso } = useApp();
  const [pedir, setPedir] = useState(null);   // (054) { r, alerta } al que pedirle algo desde un aviso
  // (pulido 4) al volver a la lista se enseña al momento la última cargada y se pone al día por detrás
  const res = useCarga(() => api.resumenes(), [], { recuerdo: `resumenes:${api.uid()}` });
  // (pulido 3.10) Al poner el dedo sobre un atleta (unas décimas antes de que se abra su ficha) se empieza a pedir:
  // cuando la pantalla se abre, la respuesta ya está de camino (las consultas iguales se comparten). Solo si el dedo
  // se queda quieto un instante (si es para desplazar la lista, no se pide nada) y una vez por atleta cada pocos segundos
  const adelanto = useRef({ t: null, x: 0, y: 0, hechos: new Map() });
  const soltarAdelanto = () => { clearTimeout(adelanto.current.t); adelanto.current.t = null; };
  const adelantar = (id, e) => {
    const a = adelanto.current;
    soltarAdelanto();
    if (Date.now() - (a.hechos.get(id) || 0) < 8000) return;
    a.x = e.clientX; a.y = e.clientY;
    a.t = setTimeout(() => { a.t = null; a.hechos.set(id, Date.now()); api.ficha(id).catch(() => {}); api.bloquesDe(id).catch(() => {}); }, 80);
  };
  const moverAdelanto = (e) => { const a = adelanto.current; if (a.t && Math.hypot(e.clientX - a.x, e.clientY - a.y) > 6) soltarAdelanto(); };
  useEffect(() => soltarAdelanto, []);
  // (pulido 2.9) al abrir la app, mientras llega la lista de ahora se enseña la última que se cargó en este
  // dispositivo (datos/api.js, resumenesGuardados): la lista sale al momento y se pone al día sola
  const guardada = useCarga(() => (res.datos ? Promise.resolve(null) : api.resumenesGuardados().catch(() => null)), [], { tirar: false });
  const datos = res.datos || guardada.datos || null;   // (si la de ahora no llega, sin conexión, la guardada sigue ahí, con el aviso)
  const cargando = res.cargando && !datos;
  // v0.49: lo cargado se queda en CoachApp para la cabecera de la ficha (sin volver a pedirlo)
  useEffect(() => { if (datos) alCargar?.(datos); }, [datos]);
  const estrecha = useEstrecha(899);   // (el mismo corte que .solo-ancho / .solo-estrecho en estilos.css)
  const muyEstrecha = useEstrecha(1099);   // (v0.199) el panel de al lado, solo desde 1100 px
  const [nuevo, setNuevo] = useState(false);
  const [avisos, setAvisos] = useState(false);
  useEffect(() => { if (peticion?.nuevo) setNuevo(true); if (peticion?.avisos) setAvisos(true); }, [peticion?.id]);
  const hoy = hoyISO();

  // (v0.198) A tu gusto: lo tuyo de cada atleta y cómo ves la lista (con la 085, igual en el móvil y en el ordenador)
  const pc = usePanelCoach();
  const aj = pc.ajustes;
  // (v0.199) tus avisos: los de días sin entrenar, cumplimiento y molestias, con tus umbrales
  const lista = (datos || []).map((r) => conUmbrales(r, aj.umbrales, hoy));
  // (el semáforo de progreso se pide solo si lo miras: su columna, su filtro, su tarjeta o su orden)
  const conProgreso = aj.columnas.includes('progreso') || aj.orden.col === 'progreso' || (!!memoria.filtros?.marcas?.includes('progresoRojo')) || aj.tarjeta.includes('progreso');
  const ex = useExtrasPanel(datos, { conProgreso });
  // (v0.199) lo nuevo desde tu última visita: la de antes se guarda al entrar (una vez por sesión de la app)
  // (en cada aparato: así no se escribe nada en la base solo por entrar)
  if (memoria.vistoPrev === undefined) {
    memoria.vistoPrev = leerPreferencia('fbe-panel-visto', null);
    guardarPreferencia('fbe-panel-visto', new Date().toISOString());
  }
  const extraBase = { sinLeer: ex.sinLeer, proxima: ex.proxima, panel: pc.panel, pendientes, hoy: ex.hoy, contacto: ex.contacto, hitos: ex.hitos, progreso: ex.progreso,
    recordatorios: aj.recordatorios, ordenManual: aj.ordenManual };
  const extra = { ...extraBase, novedades: Object.fromEntries(lista.map((r) => [r.atleta_id, novedadesDe(r, extraBase, memoria.vistoPrev)])) };
  const [busqueda, setBusquedaE] = useState(memoria.busqueda);
  const [filtro, setFiltroE] = useState(memoria.estado);
  const [filtros, setFiltrosE] = useState(memoria.filtros);
  const [abiertos, setAbiertosE] = useState(memoria.abiertos);
  const [elegir, setElegirE] = useState(memoria.elegir);
  const [elegidos, setElegidosE] = useState(memoria.elegidos);
  const setBusqueda = (v) => { memoria.busqueda = v; setBusquedaE(v); };
  const setFiltro = (v) => { memoria.estado = v; setFiltroE(v); };
  const setFiltros = (v) => { const l = limpiarFiltros(v); memoria.filtros = l; setFiltrosE(l); };
  const setAbiertos = (v) => { memoria.abiertos = v; setAbiertosE(v); };
  const setElegir = (v) => { memoria.elegir = v; setElegirE(v); if (!v) { memoria.elegidos = []; setElegidosE([]); } };
  const setElegidos = (v) => { memoria.elegidos = v; setElegidosE(v); };
  const [hoja, setHoja] = useState(null);   // 'columnas' | 'filtros' | 'vistas' | 'varios' | 'colores' | 'teclas' | 'avisos' | 'tarjeta'
  const [para, setPara] = useState(null);   // (v0.199) { tipo: 'chat' | 'voz' | 'codigo', r }
  const [sel, setSelE] = useState(memoria.sel);   // (v0.199) el elegido en el panel de al lado
  const setSel = (id) => { memoria.sel = id; setSelE(id); };
  const buscador = useRef(null);
  const caja = useRef(null);
  // Abrir una ficha desde aquí: al volver, la lista sigue donde estaba
  const abrir = (id, pestana, foto) => { memoria.volver = true; memoria.scroll = window.scrollY; abrirFicha(id, pestana, foto); };
  useLayoutEffect(() => {
    if (!memoria.volver || !datos) return;
    memoria.volver = false;
    const y = memoria.scroll;
    if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
  }, [!!datos]);

  const atencion = lista.filter((r) => r.alertas.some((a) => a.nivel !== 'info'));
  // (v0.200) el día del equipo para el saludo: los que tienen sesión hoy y los que te han escrito
  const diaCoach = (() => {
    const d = resumenDiaCoach({ filas: lista, hoy: ex.hoy || {}, sinLeer: ex.sinLeer || {}, atencion: 0 });
    const t = [d.entrenan ? `${d.entrenan} ${d.entrenan === 1 ? 'tiene' : 'tienen'} sesión hoy${d.hechas ? ` (${d.hechas} ya ${d.hechas === 1 ? 'la ha hecho' : 'la han hecho'})` : ''}` : '', d.escritos ? `${d.escritos} ${d.escritos === 1 ? 'te ha escrito' : 'te han escrito'}` : ''].filter(Boolean);
    return { ...d, trozos: t.length ? `${t.join(' · ').replace(/^./, (c) => c.toUpperCase())}.` : '' };
  })();
  const invitados = lista.filter((r) => r.estado === 'invitado');
  const deBaja = lista.filter((r) => r.estado === 'baja');
  // v0.51: «Hoy en tu equipo» con lo que ya ha cargado el panel (sin consultas nuevas)
  const eq = datos ? equipoHoy(lista, hoy) : null;
  const inactivos = eq ? lista.filter((r) => eq.inactivos.includes(r.atleta_id)) : [];
  const base = lista.filter((r) => cumpleEstado(r, filtro, eq?.inactivos || []) && coincide(r, busqueda, extra));
  const cuentas = contar(base, extra, hoy);
  const vista = base.filter((r) => cumpleFiltros(r, filtros, extra, hoy));
  const ordenada = ordenar(vista, aj.orden, extra, hoy);
  const grupos = agrupar(ordenada, aj.agrupar, extra);
  const ids = [...new Set(grupos.flatMap((g) => g.items.map((r) => r.atleta_id)))];
  useEffect(() => { alOrden?.(ids); }, [ids.join(',')]);
  // Columna de pagos solo si hay alguno apuntado (v0.25)
  const conCobros = lista.some((r) => r.cobro);
  const columnas = aj.columnas.filter((c) => conCobros || c !== 'pagos');
  const usadas = etiquetasUsadas(pc.panel);
  const colores = aj.colores || {};
  const ponerAjustes = (cambio) => pc.guardarAjustes({ ...aj, ...cambio });
  const ordenarPor = (col) => ponerAjustes({ orden: aj.orden.col === col ? { col, dir: aj.orden.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: dirInicial(col) } });
  const desplegar = (id) => setAbiertos(abiertos.includes(id) ? abiertos.filter((x) => x !== id) : [...abiertos, id]);
  const elegirUno = (id) => { if (!elegir) setElegir(true); setElegidos(elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id]); };
  const fijar = (id) => { const p = pc.panel[id] || { fijado: false, etiquetas: [], nota: null }; pc.guardarAtleta(id, { ...p, fijado: !p.fijado }); };
  const actual = { estado: filtro, filtros, orden: aj.orden, columnas: aj.columnas, agrupar: aj.agrupar, compacta: aj.compacta };
  const aplicarVista = (v) => { setFiltro(v.estado); setFiltros(v.filtros); ponerAjustes({ orden: v.orden, agrupar: v.agrupar, compacta: v.compacta, ...(v.columnas ? { columnas: v.columnas } : {}) }); };
  const vistaActiva = (aj.vistas || []).find((v) => v.estado === filtro && JSON.stringify(v.filtros) === JSON.stringify(filtros) && v.orden.col === aj.orden.col && v.orden.dir === aj.orden.dir && v.agrupar === aj.agrupar);
  const marca = (k) => setFiltros({ ...filtros, marcas: filtros.marcas.includes(k) ? filtros.marcas.filter((x) => x !== k) : [...filtros.marcas, k] });
  const nFiltros = cuantosFiltros(filtros);
  // (v0.199) tu orden a mano, los recordatorios, el panel de al lado y exportar
  const mover = (r, dir) => ponerAjustes({ ordenManual: moverManual(aj.ordenManual, ordenada.map((x) => x.atleta_id), r.atleta_id, dir) });
  const recordar = (id, v) => { const rs = { ...(aj.recordatorios || {}) }; const l = v ? limpiarRecordatorio(v) : null; if (l) rs[id] = l; else delete rs[id]; ponerAjustes({ recordatorios: rs }); };
  const lateral = aj.lateral && !muyEstrecha;
  const acciones = { chat: (r) => setPara({ tipo: 'chat', r }), voz: (r) => setPara({ tipo: 'voz', r }), codigo: (r) => setPara({ tipo: 'codigo', r }), abrir, mover: aj.orden.col === 'mano' ? mover : null };
  const exportar = async () => {
    const csv = csvLista(ordenada, columnas, extra, hoy);
    const nombre = `atletas-${hoy}.csv`;
    try {
      const archivo = new File([csv], nombre, { type: 'text/csv;charset=utf-8' });
      if (navigator.canShare?.({ files: [archivo] }) && estrecha) { await navigator.share({ files: [archivo], title: 'Atletas' }); return; }
    } catch { /* sin compartir: se descarga */ }
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  // Teclas (j/k, Intro, c, p, s, d, f, n, x, b, ?)
  const porId = (id) => lista.find((r) => r.atleta_id === id);
  useAtajosPanel(caja, { buscar: () => buscador.current?.focus(), ayuda: () => setHoja('teclas'), abrir, desplegar, fijar, elegirUno, abiertos,
    chat: (id) => { const r = porId(id); if (r && r.estado !== 'invitado') setPara({ tipo: 'chat', r }); }, voz: (id) => { const r = porId(id); if (r && r.estado !== 'invitado') setPara({ tipo: 'voz', r }); },
    mover: aj.orden.col === 'mano' ? (id, dir) => { const r = porId(id); if (r) mover(r, dir); } : null });

  const filaPorId = Object.fromEntries(lista.map((r) => [r.atleta_id, r]));
  const elegidosR = elegidos.map((id) => filaPorId[id]).filter(Boolean);
  const nombreCelda = (r, atajos = null) => (
    <div class="nombre">
      {elegir && <input type="checkbox" class="marcar-atleta" checked={elegidos.includes(r.atleta_id)} onClick={(e) => e.stopPropagation()} onChange={() => elegirUno(r.atleta_id)} aria-label={`Elegir a ${r.nombre.split(' ')[0]}`} />}
      <span class="avatar-env"><ConAro hechas={r.sesiones?.completadas} total={r.estado === 'activo' && r.servicio !== 'nutricion' ? r.sesiones?.total : 0}><Avatar nombre={r.nombre} foto={r.foto} /></ConAro>{(extra.novedades[r.atleta_id] || []).length > 0 && <span class="punto-nuevo" title={extra.novedades[r.atleta_id].join(', ')}><span class="sr">Novedades: {extra.novedades[r.atleta_id].join(', ')}</span></span>}</span>
      <span class="nombre-txt">
        <span class="nombre-linea">{r.nombre}{fijadoDe(r, extra) && <Icono n="chincheta" class="ico-fijado" titulo="Fijado arriba" />}{sinLeerDe(r, extra) > 0 && <span class="cuenta-sin-leer num" title="Mensajes sin leer">{sinLeerDe(r, extra)}<span class="sr"> sin leer</span></span>}</span>
        <span class="sr">. {r.estado === 'pausado' ? 'En pausa' : NOMBRE_ESTADO[estadoAtleta(r)]}</span>
        <Etiquetas etiquetas={etiquetasDe(r, extra)} colores={colores} />
        {pc.panel[r.atleta_id]?.nota && <span class="nota-linea mini">{pc.panel[r.atleta_id].nota}</span>}
        <ExtrasNombre r={r} extra={extra} hoy={hoy} />
        {atajos}
      </span>
    </div>
  );
  const titulo = (col, texto, clase = '') => {
    const activo = aj.orden.col === col;
    return (
      <th class={clase} aria-sort={activo ? (aj.orden.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
        <button type="button" class={`th-orden ${activo ? 'activo' : ''}`} onClick={() => ordenarPor(col)}>{texto}{activo && <Icono n={aj.orden.dir === 'asc' ? 'arriba' : 'abajo'} class="th-flecha" />}</button>
      </th>
    );
  };
  const detalle = (r) => (
    <DetalleAtleta r={r} extra={extra} fila={pc.panel[r.atleta_id]} colores={colores} usadas={usadas} hoy={hoy} id={`detalle-${r.atleta_id}`}
      alGuardar={(f) => pc.guardarAtleta(r.atleta_id, f)} acciones={acciones} telefono={ex.telefonos[r.atleta_id]}
      recordatorio={recordatorioDe(r, extra)} alRecordatorio={(v) => recordar(r.atleta_id, v)} />
  );

  // (v0.199) una tarjeta (en el móvil y en el panel de al lado)
  const tarjeta = (r, enLateral) => {
    const abierto = abiertos.includes(r.atleta_id);
    return (
                    <div key={r.atleta_id} class={`tarjeta-atleta-env ${elegidos.includes(r.atleta_id) ? 'elegida' : ''} ${enLateral && sel === r.atleta_id ? 'seleccionada' : ''}`}>
                      <button class="tarjeta-atleta" data-atleta={r.atleta_id} data-estado={estadoAtleta(r)} onPointerDown={(e) => adelantar(r.atleta_id, e)} onPointerMove={moverAdelanto} onPointerCancel={soltarAdelanto} onClick={(e) => (enLateral ? setSel(r.atleta_id) : abrir(r.atleta_id, undefined, e.currentTarget.querySelector('.avatar')))} aria-pressed={enLateral ? (sel === r.atleta_id ? 'true' : 'false') : undefined}>
                        <div class="cab">
                          <span class="avatar-env"><ConAro hechas={r.sesiones?.completadas} total={r.estado === 'activo' && r.servicio !== 'nutricion' ? r.sesiones?.total : 0}><Avatar nombre={r.nombre} foto={r.foto} /></ConAro>{(extra.novedades[r.atleta_id] || []).length > 0 && <span class="punto-nuevo" title={extra.novedades[r.atleta_id].join(', ')}><span class="sr">Novedades: {extra.novedades[r.atleta_id].join(', ')}</span></span>}</span>
                          <span><strong>{r.nombre}</strong>{fijadoDe(r, extra) && <Icono n="chincheta" class="ico-fijado" titulo="Fijado arriba" />}{sinLeerDe(r, extra) > 0 && <span class="cuenta-sin-leer num">{sinLeerDe(r, extra)}<span class="sr"> sin leer</span></span>}{r.estado === 'pausado' && <span class="chip aviso mini chip-pausa"> En pausa</span>}<span class="sr">. {r.estado === 'pausado' ? 'En pausa' : NOMBRE_ESTADO[estadoAtleta(r)]}.</span>{r.servicio === 'nutricion' && r.estado === 'activo' ? <span class="mini terciario">Solo nutrición</span> : r.semana ? <span class="mini terciario">Semana {r.semana.numero} de {r.semana.total}{r.semana.foco ? `, ${NOMBRE_FOCO[r.semana.foco].toLowerCase()}` : r.bloque?.nombre ? `, ${r.bloque.nombre}` : ''}</span> : r.estado === 'invitado' ? <span class="mini terciario">Sin activar</span> : r.estado === 'baja' ? <span class="mini terciario">De baja</span> : null}</span>
                          {r.semana && <span class="peq secundario num semana-pill" style={{ '--f': Math.min(1, r.semana.numero / (r.semana.total || 1)) }}>S{r.semana.numero}/{r.semana.total}</span>}
                        </div>
                        {(etiquetasDe(r, extra).length > 0 || pc.panel[r.atleta_id]?.nota || recordatorioDe(r, extra) || extra.hitos[r.atleta_id]) && <div class="tuyo-tarjeta"><Etiquetas etiquetas={etiquetasDe(r, extra)} colores={colores} />{pc.panel[r.atleta_id]?.nota && <span class="nota-linea mini">{pc.panel[r.atleta_id].nota}</span>}<ExtrasNombre r={r} extra={extra} hoy={hoy} /></div>}
                        <Alertas r={r} pendientes={pendientes[r.atleta_id]} />
                        {r.estado === 'activo' && (
                          <div class="datos">
                            {aj.tarjeta.map((k) => <CampoTarjeta key={k} k={k} r={r} extra={extra} hoy={hoy} />)}
                          </div>
                        )}
                        {r.cobro && <div class="cobro-tarjeta"><span class="k">Pagos</span><CobroPanel c={r.cobro} enLinea /></div>}
                      </button>
                      <div class="tarjeta-pie">
                        {elegir && <label class="elegir-tarjeta"><input type="checkbox" checked={elegidos.includes(r.atleta_id)} onChange={() => elegirUno(r.atleta_id)} /> <span>Elegir<span class="sr"> a {r.nombre.split(' ')[0]}</span></span></label>}
                        <AccionesRapidas r={r} acciones={acciones} telefono={ex.telefonos[r.atleta_id]} abierto={abierto} alDesplegar={() => desplegar(r.atleta_id)} detalleId={`detalle-${r.atleta_id}`} />
                      </div>
                      {abierto && !enLateral && detalle(r)}
                    </div>
    );
  };

  return (
    <div class={`contenido coach panel-atletas ${aj.compacta ? 'compacta' : ''} ${lateral && !aj.tablero ? 'con-panel-lateral' : ''}`} ref={caja}>
      <CabeceraGrande>
        <div class="titulo"><h1>Atletas</h1><div class="sub">{lista.filter((r) => r.estado === 'activo').length} activos{atencion.length ? `, ${atencion.length} necesitan atención` : ''}</div></div>
        <div class="fila" style="gap:8px">
          {alBuscar && <button class="btn btn-icono solo-estrecho" onClick={alBuscar} aria-label="Buscar"><Icono n="buscar" /></button>}
          <button class="btn" onClick={() => setAvisos(true)} aria-label="Avisos para tus atletas"><Icono n="altavoz" /><span class="solo-ancho">Avisos</span></button>
          <button class="btn btn-primario" onClick={() => setNuevo(true)}><Icono n="mas" /><span class="solo-ancho">Añadir atleta</span><span class="sr">Añadir atleta</span></button>
          {abrirCuenta && <button class="btn-avatar solo-estrecho" onClick={abrirCuenta} aria-label="Tu cuenta"><Avatar foto={perfil?.foto} nombre={perfil?.nombre || 'Coach'} /></button>}
        </div>
      </CabeceraGrande>
      <BandaDemo />
      {/* (imágenes, bloque S) el saludo del día, en tu mesa */}
      <CabCoach id="coach-panel" titulo={`${saludoCoach(horaMadrid(Date.now()))}${perfil?.nombre ? `, ${perfil.nombre.split(' ')[0]}` : ''}`}>
        <span class="peq">{fmtConDia(hoy).replace(/^./, (c) => c.toUpperCase())}{atencion.length ? ` · ${atencion.length} ${atencion.length === 1 ? 'necesita' : 'necesitan'} atención` : ' · Todo en orden'}</span>
        {/* (v0.200) y el día en una frase: quién entrena hoy y quién te ha escrito (solo cuántos) */}
        {!cargando && diaCoach.trozos && <span class="peq cab-coach-dia">{diaCoach.trozos}</span>}
      </CabCoach>
      <AvisoAlmacenamientoPanel abrirCuenta={abrirCuenta} />
      {/* (v0.104) quién cumple años hoy */}
      {!cargando && <CumplesHoy lista={lista} abrir={abrir} />}
      {/* (personalización 3, tanda 9) los hitos que merecen algo de verdad (un año, el día de su meta) */}
      {!cargando && <EnviosPendientes lista={lista} abrir={abrir} />}
      <ErrorCaja error={res.error} reintentar={res.recargar} />
      {/* (pulido 2.3) el resumen del equipo guarda su sitio mientras llega la lista: los filtros no bajan */}
      <Reserva id="panel-equipo-hoy" cargando={cargando}>{eq && eq.activos > 0 && <EquipoHoy eq={eq} porRevisar={porRevisar} irARevisar={irARevisar} filtro={filtro} alFiltrar={setFiltro} />}</Reserva>

      {/* (v0.198) buscar, ordenar, columnas, vista compacta, agrupar, filtros, vistas y varios a la vez */}
      <div class="panel-herramientas">
        <div class="buscar-lista">
          <Icono n="buscar" />
          <label class="sr" for="buscar-atletas">Buscar atletas</label>
          <input id="buscar-atletas" ref={buscador} type="search" class="entrada" placeholder="Nombre, etiqueta o nota" value={busqueda} onInput={(e) => setBusqueda(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Escape' && busqueda) { e.preventDefault(); setBusqueda(''); } if (e.key === 'ArrowDown') { e.preventDefault(); caja.current?.querySelector('[data-atleta]')?.focus(); } }} />
        </div>
        <div class="fila-envolver herramientas-botones">
          <label class="sr" for="orden-atletas">Ordenar la lista por</label>
          <select id="orden-atletas" class="entrada entrada-lista" value={aj.orden.col} onChange={(e) => ponerAjustes({ orden: { col: e.currentTarget.value, dir: dirInicial(e.currentTarget.value) } })}>
            {ORDENES.filter(([k]) => conCobros || k !== 'pagos').map(([k, t]) => <option key={k} value={k}>{k === 'urgencia' ? t : `Por ${t.toLowerCase()}`}</option>)}
          </select>
          {aj.orden.col !== 'urgencia' && <button type="button" class="btn btn-peq btn-icono-texto" onClick={() => ponerAjustes({ orden: { ...aj.orden, dir: aj.orden.dir === 'asc' ? 'desc' : 'asc' } })} aria-label={aj.orden.dir === 'asc' ? 'De menos a más. Darle la vuelta' : 'De más a menos. Darle la vuelta'}><Icono n={aj.orden.dir === 'asc' ? 'arriba' : 'abajo'} /></button>}
          <label class="sr" for="agrupar-atletas">Agrupar la lista</label>
          <select id="agrupar-atletas" class="entrada entrada-lista" value={aj.agrupar} onChange={(e) => ponerAjustes({ agrupar: e.currentTarget.value })}>
            {AGRUPAR.map(([k, t]) => <option key={k} value={k}>{k ? `Agrupar: ${t.toLowerCase()}` : t}</option>)}
          </select>
          <button type="button" class="btn btn-peq" aria-pressed={nFiltros ? 'true' : 'false'} onClick={() => setHoja('filtros')}><Icono n="opciones" /> Filtros{nFiltros ? ` (${nFiltros})` : ''}</button>
          {!estrecha && <button type="button" class="btn btn-peq" onClick={() => setHoja('columnas')}><Icono n="vista" /> Columnas</button>}
          <button type="button" class="btn btn-peq" aria-pressed={aj.compacta ? 'true' : 'false'} onClick={() => ponerAjustes({ compacta: !aj.compacta })}>Vista compacta</button>
          <button type="button" class="btn btn-peq" aria-pressed={elegir ? 'true' : 'false'} onClick={() => setElegir(!elegir)}><Icono n="seleccionar" /> Elegir varios</button>
          <button type="button" class="btn btn-peq" onClick={() => setHoja('vistas')}><Icono n="guardar" /> Tus vistas</button>
          <button type="button" class="btn btn-peq" aria-pressed={aj.tablero ? 'true' : 'false'} onClick={() => ponerAjustes({ tablero: !aj.tablero })}><Icono n="plantillas" /> Tablero</button>
          {!muyEstrecha && <button type="button" class="btn btn-peq" aria-pressed={aj.lateral ? 'true' : 'false'} onClick={() => ponerAjustes({ lateral: !aj.lateral })}><Icono n="vista" /> Panel al lado</button>}
          {!estrecha && <button type="button" class="btn btn-peq" onClick={() => setHoja('avisos')}><Icono n="alerta" /> Tus avisos</button>}
          {!estrecha && <button type="button" class="btn btn-peq" onClick={exportar}><Icono n="descargar" /> Exportar</button>}
          {!estrecha && usadas.length > 0 && <button type="button" class="btn btn-peq" onClick={() => setHoja('colores')}><Icono n="paleta" /> Colores</button>}
          {!estrecha && <button type="button" class="btn btn-peq btn-icono-texto" onClick={() => setHoja('teclas')} aria-label="Teclas de la lista"><Icono n="teclado" /></button>}
          {estrecha && <button type="button" class="btn btn-peq" onClick={() => setHoja('mas')} aria-label="Más de la lista"><Icono n="ajustes" /> Más</button>}
        </div>
      </div>
      {(aj.vistas || []).length > 0 && (
        <div class="selector-chips vistas-chips" role="group" aria-label="Tus vistas guardadas">
          {aj.vistas.map((v) => <button key={v.id} type="button" aria-pressed={vistaActiva?.id === v.id ? 'true' : 'false'} onClick={() => aplicarVista(v)}>{v.nombre}</button>)}
        </div>
      )}
      <div class="selector-chips" role="group" aria-label="Filtrar atletas">
        <button aria-pressed={filtro === 'todos' ? 'true' : 'false'} onClick={() => setFiltro('todos')}>Todos</button>
        <button aria-pressed={filtro === 'atencion' ? 'true' : 'false'} onClick={() => setFiltro('atencion')}>Necesitan atención ({atencion.length})</button>
        {invitados.length > 0 && <button aria-pressed={filtro === 'invitados' ? 'true' : 'false'} onClick={() => setFiltro('invitados')}>Sin activar ({invitados.length})</button>}
        {deBaja.length > 0 && <button aria-pressed={filtro === 'baja' ? 'true' : 'false'} onClick={() => setFiltro('baja')}>De baja ({deBaja.length})</button>}
        {inactivos.length > 0 && <button aria-pressed={filtro === 'inactivos' ? 'true' : 'false'} onClick={() => setFiltro('inactivos')}>Sin actividad ({inactivos.length})</button>}
      </div>
      {/* (v0.198) los contadores que filtran al tocarlos (se suman a lo de arriba) */}
      <div class="contadores-panel" role="group" aria-label="Solo los que…">
        {CONTADORES.map((k) => {
          const n = cuentas[k];
          const espera = (k === 'sinLeer' && ex.cargando) || (k === 'porProgramar' && cargando);
          return (
            <button key={k} type="button" class={`contador-panel ${n ? '' : 'cero'}`} data-k={k} aria-pressed={filtros.marcas.includes(k) ? 'true' : 'false'} disabled={!n && !filtros.marcas.includes(k)} onClick={() => marca(k)}>
              <span class="contador-n num" aria-hidden="true">{espera ? '·' : n}</span><span class="contador-k">{NOMBRE_MARCA[k]}</span><span class="sr">: {espera ? 'cargando' : n}</span>
            </button>
          );
        })}
      </div>
      {nFiltros > 0 && (
        <p class="mini secundario filtros-activos">Solo: {textoFiltros(filtros)}. <button type="button" class="btn-texto mini" onClick={() => setFiltros({ ...FILTROS_VACIOS })}>Quitar los filtros</button></p>
      )}
      {elegir && (
        <div class="barra-elegir panel panel-pad fila-envolver" role="region" aria-label="Varios a la vez">
          <span class="peq"><strong>{elegidos.length}</strong> {elegidos.length === 1 ? 'elegido' : 'elegidos'}</span>
          <button type="button" class="btn btn-peq" onClick={() => setElegidos(elegidos.length === ids.length ? [] : ids)}>{elegidos.length === ids.length && ids.length ? 'Ninguno' : 'Todos los de la lista'}</button>
          <button type="button" class="btn btn-peq btn-primario" disabled={!elegidos.length} onClick={() => setHoja('varios')}><Icono n="mensaje" /> Hacer algo con ellos</button>
          <button type="button" class="btn btn-peq" disabled={!elegidos.length} onClick={async () => aviso((await copiar(elegidosR.map((r) => r.nombre).join('\n'))) ? 'Nombres copiados' : 'No se han podido copiar')}><Icono n="copiar" /> Copiar sus nombres</button>
          <button type="button" class="btn btn-peq" onClick={() => setElegir(false)}>Dejar de elegir</button>
        </div>
      )}

      {/* (054) en «Necesitan atención»: lo que pide cada aviso, para pedírselo con un mensaje hecho (editable) */}
      {filtro === 'atencion' && !cargando && atencion.length > 0 && (
        <section class="panel panel-pad pila-s pedir-lista" aria-label="Pedírselo en un toque">
          <span class="mini terciario">Pedírselo en un toque</span>
          <ul class="lista">
            {atencion.flatMap((r) => r.alertas.filter((a) => a.nivel !== 'info' && mensajeParaAlerta(a, r.nombre)).slice(0, 1).map((a) => (
              <li key={`${r.atleta_id}-${a.tipo}`} class="pedir-fila">
                <span class="pila-xs"><strong class="peq">{r.nombre}</strong><span class="mini secundario">{a.texto}</span></span>
                <button type="button" class="btn btn-peq" onClick={() => setPedir({ r, alerta: a })}><Icono n="mensaje" /> Pedírselo</button>
              </li>
            )))}
          </ul>
        </section>
      )}
      {pedir && <HojaPedir r={pedir.r} alerta={pedir.alerta} alCerrar={() => setPedir(null)} />}

      {cargando ? <Siluetas forma="lista" n={4} texto="Cargando tus atletas" /> : !vista.length ? (
        <div class="panel"><Vacio ilustracion="filtro" titulo={lista.length ? 'Nadie en esta lista' : 'Aún no hay atletas'}
          accion={!lista.length ? <button class="btn btn-primario" onClick={() => setNuevo(true)}>Añadir el primero</button> : <button class="btn btn-peq" onClick={() => { setFiltro('todos'); setFiltros({ ...FILTROS_VACIOS }); setBusqueda(''); }}>Ver a todos</button>}>
          {lista.length ? (busqueda ? `Nadie coincide con «${busqueda}».` : 'Nadie cumple este filtro: todo en orden por aquí.') : 'Dales de alta y envíales su código de invitación.'}
        </Vacio></div>
      ) : (
        <>
          {aj.tablero ? <Tablero grupos={agrupar(ordenada, aj.agrupar || 'proxima', extra)} por={aj.agrupar || 'proxima'} extra={extra} colores={colores} hoy={hoy} abrir={abrir} />
            : lateral ? (
              <div class="con-lateral">
                <div class="pila lista-tarjetas lista-lateral">{grupos.map((g) => (
                  <div key={g.clave || 'todos'} class="pila grupo-tarjetas">
                    {aj.agrupar && <h2 class="titulo-grupo peq">{g.titulo} <span class="terciario num">({g.items.length})</span></h2>}
                    {g.items.map((r) => tarjeta(r, true))}
                  </div>
                ))}</div>
                {(() => { const r = ordenada.find((x) => x.atleta_id === sel) || ordenada[0]; return r ? <AsideAtleta key={r.atleta_id} r={r} detalle={detalle(r)} abrir={abrir} /> : null; })()}
              </div>
            ) : <>
          {/* (pulido 3.3) solo se pinta la que se ve: la tabla en pantalla ancha, las tarjetas en el móvil (antes, las dos
              a la vez y una escondida: el doble de elementos en la lista) */}
          {!estrecha && <div class="panel solo-ancho">
            <div class="tabla-env">
              <table class="atletas-tabla">
                <thead><tr>{titulo('nombre', 'Atleta')}{columnas.map((c) => titulo(c, TITULO_COLUMNA[c], ['sueno', 'motivacion'].includes(c) ? 'col-extra' : ''))}</tr></thead>
                {grupos.map((g) => (
                  <tbody key={g.clave || 'todos'}>
                    {aj.agrupar && <tr class="fila-grupo"><th colSpan={columnas.length + 1} scope="colgroup">{g.titulo} <span class="terciario num">({g.items.length})</span></th></tr>}
                    {g.items.map((r) => {
                      const abierto = abiertos.includes(r.atleta_id);
                      return [
                        <tr key={r.atleta_id} data-atleta={r.atleta_id} data-estado={estadoAtleta(r)} class={elegidos.includes(r.atleta_id) ? 'elegida' : ''} onPointerDown={(e) => adelantar(r.atleta_id, e)} onPointerMove={moverAdelanto} onPointerCancel={soltarAdelanto} onClick={(e) => abrir(r.atleta_id, undefined, e.currentTarget.querySelector('.avatar'))} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) abrir(r.atleta_id, undefined, e.currentTarget.querySelector('.avatar')); }}>
                          <td class="celda-estado">{nombreCelda(r, <AccionesRapidas r={r} acciones={acciones} telefono={ex.telefonos[r.atleta_id]} todas={false} abierto={abierto} alDesplegar={() => desplegar(r.atleta_id)} detalleId={`detalle-${r.atleta_id}`} clase="en-tabla" />)}</td>
                          {columnas.map((c) => <Celda key={c} c={c} r={r} extra={extra} pendientes={pendientes} hoy={hoy} />)}
                        </tr>,
                        abierto && <tr key={`${r.atleta_id}-detalle`} class="fila-detalle"><td colSpan={columnas.length + 1}>{detalle(r)}</td></tr>,
                      ];
                    })}
                  </tbody>
                ))}
                {/* (v0.199) las medias de los que ves */}
                {columnas.some((c) => resumenColumna(c, ordenada, extra, hoy)) && (
                  <tfoot><tr class="fila-medias"><th scope="row" class="peq">De los {ordenada.length}</th>{columnas.map((c) => <td key={c} class={`mini secundario ${['sueno', 'motivacion'].includes(c) ? 'col-extra' : ''}`}>{resumenColumna(c, ordenada, extra, hoy)}</td>)}</tr></tfoot>
                )}
              </table>
            </div>
          </div>}
          {estrecha && <div class="pila solo-estrecho lista-tarjetas">
            {grupos.map((g) => (
              <div key={g.clave || 'todos'} class="pila grupo-tarjetas">
                {aj.agrupar && <h2 class="titulo-grupo peq">{g.titulo} <span class="terciario num">({g.items.length})</span></h2>}
                {g.items.map((r) => tarjeta(r, false))}
              </div>
            ))}
          </div>}
          </>}
          <p class="mini terciario panel-cuantos">{ordenada.length === lista.filter((r) => r.estado !== 'baja').length && !busqueda && !nFiltros ? '' : `${ordenada.length} de ${lista.length} atletas`}{!pc.enBase && pc.listo && (Object.keys(pc.panel).length || (aj.vistas || []).length) ? ' · Tus etiquetas, notas y vistas se guardan en este aparato hasta que ejecutes la migración 085.' : ''}</p>
        </>
      )}
      {hoja === 'columnas' && <HojaColumnas columnas={aj.columnas} conCobros={conCobros} alCambiar={(c) => ponerAjustes({ columnas: c })} alCerrar={() => setHoja(null)} />}
      {hoja === 'filtros' && <HojaFiltros filtros={filtros} usadas={usadas} alCambiar={setFiltros} alCerrar={() => setHoja(null)} />}
      {hoja === 'vistas' && <HojaVistas ajustes={aj} actual={actual} alCambiar={(a) => pc.guardarAjustes(a)} alCerrar={() => setHoja(null)} />}
      {hoja === 'colores' && <HojaColores usadas={usadas} colores={colores} alCambiar={(c) => ponerAjustes({ colores: c })} alCerrar={() => setHoja(null)} />}
      {hoja === 'teclas' && <HojaTeclasPanel alCerrar={() => setHoja(null)} />}
      {hoja === 'varios' && <HojaVarios elegidos={elegidosR} usadas={usadas} colores={colores} alCerrar={() => setHoja(null)} alHecho={() => setElegir(false)}
        alEtiquetar={(e, poner) => pc.guardarVarios(conEtiqueta(pc.panel, elegidos, e, poner))}
        alFijar={(poner) => pc.guardarVarios(Object.fromEntries(elegidos.map((id) => [id, { ...(pc.panel[id] || { etiquetas: [], nota: null }), fijado: poner }])))}
        alCambio={() => res.recargar(true)} />}
      {hoja === 'avisos' && <HojaUmbrales umbrales={aj.umbrales} alCambiar={(u) => ponerAjustes({ umbrales: u })} alCerrar={() => setHoja(null)} />}
      {hoja === 'tarjeta' && <HojaTarjeta tarjeta={aj.tarjeta} alCambiar={(t) => ponerAjustes({ tarjeta: t })} alCerrar={() => setHoja(null)} />}
      {hoja === 'mas' && (
        <Hoja titulo="Más de la lista" alCerrar={() => setHoja(null)} ancho={460}>
          <div class="pila-s">
            <button type="button" class="btn" onClick={() => setHoja('tarjeta')}><Icono n="vista" /> Datos de las tarjetas</button>
            <button type="button" class="btn" onClick={() => setHoja('avisos')}><Icono n="alerta" /> Tus avisos</button>
            {usadas.length > 0 && <button type="button" class="btn" onClick={() => setHoja('colores')}><Icono n="paleta" /> Colores de tus etiquetas</button>}
            <button type="button" class="btn" onClick={() => { setHoja(null); exportar(); }}><Icono n="descargar" /> Exportar la lista</button>
          </div>
        </Hoja>
      )}
      {para?.tipo === 'chat' && <HojaChatRapido r={para.r} alCerrar={() => setPara(null)} alChat={() => { const id = para.r.atleta_id; setPara(null); abrir(id, 'mensajes'); }} alEnviado={() => ex.recargarConv?.()} />}
      {para?.tipo === 'voz' && <HojaVozAtleta r={para.r} alCerrar={() => setPara(null)} />}
      {para?.tipo === 'codigo' && <Invitacion atleta={{ id: para.r.atleta_id, nombre: para.r.nombre }} alCerrar={() => setPara(null)} />}
      {avisos && <HojaAvisos alCerrar={() => setAvisos(false)} />}
      {nuevo && <NuevoAtleta alCerrar={(id) => { setNuevo(false); res.recargar(true); if (id) abrir(id); }} />}
    </div>
  );
}

// (v0.199) Bajo el nombre: el recordatorio (en aviso si toca hoy o ya pasó) y el próximo hito
function ExtrasNombre({ r, extra, hoy }) {
  const rec = recordatorioDe(r, extra);
  const h = extra.hitos?.[r.atleta_id];
  if (!rec && !h) return null;
  return (
    <span class="extras-nombre">
      {rec && <span class={`chip mini recordatorio-chip ${rec.fecha <= hoy ? 'aviso' : 'info'}`}><Icono n="campana" />{textoRecordatorio(rec, hoy)}</span>}
      {h && <span class="mini hito-linea"><Icono n={h.tipo === 'cumple' ? 'estrella' : h.tipo === 'carrera' ? 'bandera' : h.tipo === 'pago' ? 'calendario' : 'trofeo'} />{textoHito(h)}</span>}
    </span>
  );
}

// (v0.199) Los cuatro puntos del semáforo de progreso (peso, medidas, comida, descanso)
const NOMBRE_SEMAFORO = { peso: 'Peso', medidas: 'Medidas', comida: 'Comida', descanso: 'Descanso' };
const NOMBRE_COLOR = { verde: 'bien', ambar: 'regular', rojo: 'mal', gris: 'sin datos' };
function Semaforo({ p }) {
  if (!p) return <span class="terciario">—</span>;
  return (
    <span class="semaforo-panel" title={p.frase || ''}>
      {Object.entries(p.semaforo).map(([k, v]) => <i key={k} class={`sem-punto ${v}`} title={`${NOMBRE_SEMAFORO[k]}: ${NOMBRE_COLOR[v] || v}`} />)}
      <span class="sr">{Object.entries(p.semaforo).map(([k, v]) => `${NOMBRE_SEMAFORO[k]}: ${NOMBRE_COLOR[v] || v}`).join(', ')}</span>
    </span>
  );
}

// (v0.199) Un dato de la tarjeta del móvil (los de siempre, con su mismo aspecto)
function CampoTarjeta({ k, r, extra, hoy }) {
  const nutri = r.servicio === 'nutricion';
  const caja = (titulo, valor) => <div><div class="k">{titulo}</div><div class="v">{valor}</div></div>;
  switch (k) {
    case 'sesiones': return nutri ? caja('Nutrición', r.diasNutricion != null ? `${r.diasNutricion}/7 días` : '—')
      : caja('Sesiones', <><Pips hechas={r.sesiones.completadas} total={r.sesiones.total} /><Cumple c={r.cumplimiento} corto /><ChispaSesiones semanas={r.chispas?.sesiones} /></>);
    case 'peso': return caja('Peso', <>{r.peso ? `${num(r.peso.kg)}${r.peso.ritmo ? ` (${signo(r.peso.ritmo.kgSemana, 2)}/sem)` : r.peso.cambio != null ? ` (${signo(r.peso.cambio)})` : ''}` : '—'}<ChispaPeso puntos={r.chispas?.peso} /></>);
    case 'ultimo': return nutri ? null : caja('Último registro', r.ultimaSerie ? hace(r.ultimaSerie) : '—');
    case 'cumplido': return nutri ? null : caja('% cumplido', r.cumplimiento?.series?.pct != null ? `${r.cumplimiento.series.pct} %` : '—');
    case 'sinEntrenar': { if (nutri) return null; const d = diasSinEntrenar(r, hoy); return caja('Sin entrenar', d == null ? '—' : d === 0 ? 'Hoy entrenó' : `${d} ${d === 1 ? 'día' : 'días'}`); }
    case 'checkin': return caja('Check-in', checkinAlDia(r, hoy) ? 'Al día' : 'Falta');
    case 'energia': return caja('Energía', r.checkin?.energia ? `${r.checkin.energia} de 5` : '—');
    case 'sueno': return caja('Sueño', sueno(r.checkin?.horas_sueno));
    case 'contacto': return caja('Último contacto', textoContacto(extra.contacto?.[r.atleta_id], hoy));
    case 'progreso': return caja('Progreso', <Semaforo p={extra.progreso?.[r.atleta_id]} />);
    case 'proxima': { const p = proximaDe(r, extra); return caja('Semana que viene', p ? TEXTO_PROXIMA_CORTO[p] : '—'); }
    case 'hoy': { const h = extra.hoy?.[r.atleta_id]; return caja('Hoy toca', h ? (h.hecha ? 'Hecha' : h.nombre) : 'Nada'); }
    case 'hito': return caja('Próximo hito', textoHito(extra.hitos?.[r.atleta_id]) || '—');
    default: return null;
  }
}

// (v0.199) El tablero: columnas por cómo está su semana que viene (o como agrupes) y una tarjeta pequeña por atleta
function Tablero({ grupos, por, extra, colores, hoy, abrir }) {
  return (
    <div class="tablero-atletas" role="region" aria-label="Tablero de atletas">
      {grupos.map((g, i) => (
        <section key={g.clave || 'todos'} class="tablero-columna" data-tono={tonoColumna(por, g.clave, i, (k) => colorEtiqueta(k, colores))} aria-label={`${g.titulo}: ${g.items.length}`}>
          {/* (v0.200) cada columna con su color (lo que significa) y su cuenta en una pastilla */}
          <h2 class="peq">{g.titulo} <span class="tablero-cuenta num" aria-hidden="true">{g.items.length}</span></h2>
          <ul class="tablero-lista">
            {g.items.map((r) => (
              <li key={r.atleta_id}>
                <button type="button" class="tablero-tarjeta" data-atleta={r.atleta_id} data-estado={estadoAtleta(r)} onClick={() => abrir(r.atleta_id, por === 'proxima' && r.servicio !== 'nutricion' ? 'programa' : undefined)}>
                  <Avatar nombre={r.nombre} foto={r.foto} />
                  <span class="pila-xs">
                    <span class="peq tablero-nombre">{r.nombre}</span>
                    <span class="mini terciario">{r.semana ? `Semana ${r.semana.numero} de ${r.semana.total}` : r.estado === 'invitado' ? 'Sin activar' : r.servicio === 'nutricion' ? 'Solo nutrición' : 'Sin semana en curso'}</span>
                    <Etiquetas etiquetas={etiquetasDe(r, extra)} colores={colores} />
                    <ExtrasNombre r={r} extra={extra} hoy={hoy} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// (v0.199) El panel de al lado (en el ordenador): lo suyo, lo tuyo y su chat, sin perder la lista
function AsideAtleta({ r, detalle, abrir }) {
  return (
    <aside class="aside-atleta pila" aria-label={`Lo de ${r.nombre}`}>
      <div class="fila-panel">
        <span class="fila aside-cab"><Avatar nombre={r.nombre} foto={r.foto} /><strong>{r.nombre}</strong></span>
        <button type="button" class="btn btn-peq btn-primario" onClick={() => abrir(r.atleta_id)}>Abrir su ficha</button>
      </div>
      <Alertas r={r} pendientes={0} />
      {detalle}
      {r.estado !== 'invitado' && <ChatRapido f={{ atleta_id: r.atleta_id, nombre: r.nombre }} n={6} alChat={() => abrir(r.atleta_id, 'mensajes')} />}
    </aside>
  );
}

// (v0.198) Una celda de la tabla, según su columna
function Celda({ c, r, extra, pendientes, hoy }) {
  const nutri = r.servicio === 'nutricion';
  switch (c) {
    case 'avisos': return <td class="celda-avisos">{r.alertas.length || pendientes[r.atleta_id] ? <Alertas r={r} pendientes={pendientes[r.atleta_id]} max={2} /> : <span class="terciario">—</span>}</td>;
    case 'pagos': return <td><CobroPanel c={r.cobro} /></td>;
    case 'semana': return <td class="num-c">{nutri ? <><span class="peq solo-nutri">Solo nutrición</span>{r.diasNutricion != null && <div class="mini terciario">{r.diasNutricion}/7 días</div>}</> : r.semana ? <><span class="semana-pill" style={{ '--f': Math.min(1, r.semana.numero / (r.semana.total || 1)) }}>S{r.semana.numero}/{r.semana.total}</span><div class="mini terciario">{r.semana.foco ? NOMBRE_FOCO[r.semana.foco] : r.bloque?.nombre}</div></> : '—'}</td>;
    case 'sesiones': return <td>{nutri ? <span class="terciario">—</span> : <div class="celda-sesiones"><Pips hechas={r.sesiones.completadas} total={r.sesiones.total} /><Cumple c={r.cumplimiento} /><ChispaSesiones semanas={r.chispas?.sesiones} /></div>}</td>;
    case 'peso': return <td class="num-c">{r.peso ? <>{num(r.peso.kg)} kg<ChispaPeso puntos={r.chispas?.peso} />{r.peso.ritmo ? <div class="mini terciario">{signo(r.peso.ritmo.kgSemana, 2)}/sem</div> : r.peso.cambio != null && <div class="mini terciario">{signo(r.peso.cambio)}</div>}</> : '—'}</td>;
    case 'sueno': return <td class="num-c col-extra">{sueno(r.checkin?.horas_sueno)}</td>;
    case 'motivacion': return <td class="col-extra">{r.checkin?.motivacion ? ESCALAS.motivacion[r.checkin.motivacion - 1] : '—'}</td>;
    case 'energia': return <td>{r.checkin?.energia ? ESCALAS.energia[r.checkin.energia - 1] : '—'}</td>;
    case 'molestias': return <td>{r.maxMolestia ? <span class={`chip ${r.maxMolestia >= 2 ? 'aviso' : 'info'}`}>{MOLESTIA[r.maxMolestia]}</span> : <span class="terciario">—</span>}</td>;
    case 'ultimo': return <td class="num-c">{r.ultimaSerie ? hace(r.ultimaSerie) : '—'}</td>;
    case 'cumplido': { const p = r.cumplimiento?.series?.pct; return <td class="num-c">{p != null ? <span class={`cumple ${p >= 90 ? 'ok' : p >= 75 ? '' : 'aviso'}`}>{p} %</span> : '—'}</td>; }
    case 'sinEntrenar': { const d = diasSinEntrenar(r, hoy); return <td class="num-c">{d == null ? '—' : d === 0 ? 'Hoy' : <span class={d >= 7 ? 'aviso-lista' : ''}>{d} {d === 1 ? 'día' : 'días'}</span>}</td>; }
    case 'checkin': return <td>{r.estado !== 'activo' ? '—' : checkinAlDia(r, hoy) ? <span class="chip ok">Al día</span> : <span class="chip aviso">Falta</span>}</td>;
    case 'habitos': return <td class="num-c">{r.habitos?.pct != null ? `${r.habitos.pct} %` : '—'}</td>;
    case 'nutricion': return <td class="num-c">{r.diasNutricion != null ? `${r.diasNutricion}/7 días` : '—'}</td>;
    case 'fase': { const f = r.semana?.foco || r.bloque?.foco; return <td>{f ? NOMBRE_FOCO[f] || f : '—'}</td>; }
    case 'proxima': { const p = proximaDe(r, extra); return <td>{p ? <span class={`chip ${p === 'publicada' ? 'ok' : 'aviso'}`}>{TEXTO_PROXIMA_CORTO[p]}</span> : '—'}</td>; }
    case 'mensajes': { const n = sinLeerDe(r, extra); return <td class="num-c">{n ? <span class="chip morado">{n} sin leer</span> : <span class="terciario">—</span>}</td>; }
    case 'nivel': return <td>{r.nivel ? NOMBRE_NIVEL[r.nivel] : '—'}</td>;
    case 'servicio': return <td>{Object.fromEntries(SERVICIOS)[r.servicio] || '—'}</td>;
    case 'alta': return <td class="num-c">{r.fecha_alta ? fmtCorta(r.fecha_alta) : '—'}</td>;
    case 'nota': return <td class="celda-nota">{extra.panel?.[r.atleta_id]?.nota || <span class="terciario">—</span>}</td>;
    case 'progreso': return <td><Semaforo p={extra.progreso?.[r.atleta_id]} /></td>;
    case 'hoy': { const h = extra.hoy?.[r.atleta_id]; return <td>{h ? <span class={`chip ${h.hecha ? 'ok' : 'info'}`}>{h.hecha ? 'Hecha' : h.nombre}</span> : <span class="terciario">—</span>}</td>; }
    case 'contacto': return <td class="mini">{textoContacto(extra.contacto?.[r.atleta_id], hoy)}</td>;
    case 'hito': return <td class="mini">{textoHito(extra.hitos?.[r.atleta_id]) || <span class="terciario">—</span>}</td>;
    case 'recordatorio': { const x = recordatorioDe(r, extra); return <td class="mini">{x ? textoRecordatorio(x, hoy) : <span class="terciario">—</span>}</td>; }
    default: return <td>—</td>;
  }
}

// (v0.198) Las teclas de la lista: j/k (o flechas desde una fila) para moverse, y las de cada atleta
function useAtajosPanel(caja, x) {
  const ref = useRef(x);
  ref.current = x;
  useEffect(() => {
    const filas = () => [...(caja.current?.querySelectorAll('[data-atleta]') || [])].filter((e) => e.getClientRects().length);
    const tecla = (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable="true"], .lista-lateral ~ aside') || document.querySelector('[aria-modal="true"]')) return;
      const t = filas();
      const actual = t.indexOf(document.activeElement?.closest?.('[data-atleta]'));
      const ir = (k) => { if (!t.length) return; const j = Math.max(0, Math.min(t.length - 1, k)); t[j].focus({ preventScroll: true }); t[j].scrollIntoView({ block: 'nearest' }); };
      const o = ref.current;
      if (e.key === 'b') { e.preventDefault(); o.buscar(); return; }
      if (e.key === '?') { e.preventDefault(); o.ayuda(); return; }
      if (e.key === 'j' || (e.key === 'ArrowDown' && actual >= 0)) { e.preventDefault(); ir(actual + 1); return; }
      if (e.key === 'k' || (e.key === 'ArrowUp' && actual >= 0)) { e.preventDefault(); ir(actual <= 0 ? 0 : actual - 1); return; }
      if (actual < 0) return;
      const id = t[actual].dataset.atleta;
      if (e.key === 'c') { e.preventDefault(); o.chat(id); }
      else if (e.key === 'C') { e.preventDefault(); o.abrir(id, 'mensajes'); }
      else if (e.key === 'v') { e.preventDefault(); o.voz(id); }
      else if ((e.key === 'J' || e.key === 'K') && o.mover) { e.preventDefault(); o.mover(id, e.key === 'J' ? 1 : -1); setTimeout(() => document.querySelector(`[data-atleta="${id}"]`)?.focus({ preventScroll: true }), 60); }
      else if (e.key === 'p') { e.preventDefault(); o.abrir(id, 'programa'); }
      else if (e.key === 's') { e.preventDefault(); o.abrir(id, 'seguimiento'); }
      else if (e.key === 'd') { e.preventDefault(); o.desplegar(id); }
      else if (e.key === 'f') { e.preventDefault(); o.fijar(id); }
      else if (e.key === 'x') { e.preventDefault(); o.elegirUno(id); }
      else if (e.key === 'n') {
        e.preventDefault();
        if (!o.abiertos.includes(id)) o.desplegar(id);
        setTimeout(() => document.getElementById(`nota-${id}`)?.focus(), 80);
      }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);
}

// v0.51: «Hoy en tu equipo», como un resumen de WHOOP: cuántos de los activos han entrenado hoy (un dial), lo que
// tienes por revisar (lleva a Revisar) y cuántos llevan 7 días o más sin actividad (filtra la lista)
// El saludo según la hora de Madrid: de 6 a 13:59, días; de 14 a 20:59, tardes; si no, noches
export const saludoCoach = (h) => (h >= 6 && h < 14 ? 'Buenos días' : h >= 14 && h < 21 ? 'Buenas tardes' : 'Buenas noches');

function EquipoHoy({ eq, porRevisar, irARevisar, filtro, alFiltrar }) {
  const a = arcoDial(eq.activos ? eq.entrenaron / eq.activos : 0, 64, 7);
  const n = eq.inactivos.length;
  return (
    <section class="panel equipo-hoy" aria-label="Hoy en tu equipo">
      <div role="img" aria-label={`Han entrenado hoy ${eq.entrenaron} de ${eq.activos} activos`} class="eh-dial">
        <span class="dial-esfera" aria-hidden="true">
          <svg viewBox="0 0 64 64"><DegradadoAro id="aro-equipo-hoy" /><path class="dial-pista" d={a.d} stroke-width="7" />{eq.entrenaron > 0 && <path class="dial-arco" style={{ stroke: 'url(#aro-equipo-hoy)' }} d={a.d} stroke-width="7" stroke-dasharray={`${a.lleno} ${a.largo + 10}`} />}</svg>
          <span class="dial-centro marcador"><span>{eq.entrenaron}<span class="u">/{eq.activos}</span></span></span>
        </span>
        <span class="eh-k" aria-hidden="true">Entrenaron hoy</span>
      </div>
      {irARevisar ? (
        <button type="button" onClick={irARevisar} aria-label={`${porRevisar || 0} por revisar. Ir a Revisar`}>
          <span class={`eh-cifra marcador ${!porRevisar ? 'cero' : ''}`} aria-hidden="true">{porRevisar || 0}</span>
          <span class="eh-k" aria-hidden="true">Por revisar</span>
        </button>
      ) : <div><span class="eh-cifra marcador">{porRevisar || 0}</span><span class="eh-k">Por revisar</span></div>}
      <button type="button" aria-pressed={filtro === 'inactivos' ? 'true' : 'false'} disabled={!n && filtro !== 'inactivos'} onClick={() => alFiltrar(filtro === 'inactivos' ? 'todos' : 'inactivos')}
        aria-label={`${n} sin actividad desde hace 7 días o más.${n ? (filtro === 'inactivos' ? ' Ver a todos' : ' Ver quiénes') : ''}`}>
        <span class={`eh-cifra marcador ${n ? 'alerta' : 'cero'}`} aria-hidden="true">{n}</span>
        <span class="eh-k" aria-hidden="true">Sin actividad ≥ 7 días</span>
      </button>
    </section>
  );
}

// Cómo va con los pagos, en una línea (los mismos estados que en Cobros)
const CLASE_COBRO = { al_dia: 'ok', vence_pronto: 'aviso', pendiente: 'aviso', primer_cobro: 'aviso', vencido: 'aviso', retrasado: 'alerta' };
const CORTO_COBRO = { al_dia: 'Al día', vence_pronto: 'Vence pronto', pendiente: 'Pendiente', primer_cobro: 'Primer cobro', vencido: 'Sin renovar', retrasado: 'Retrasado' };
function CobroPanel({ c, enLinea = false }) {
  if (!c || c.estado === 'sin_datos') return <span class="terciario">—</span>;
  const detalle = c.debe > 0 ? `Debe ${fmtEuros(c.debe)}` : c.pagadoHasta ? `Hasta el ${fmtCorta(c.pagadoHasta)}` : '';
  return (
    <span class={`cobro-panel ${enLinea ? 'en-linea' : ''}`}>
      <span class={`chip ${CLASE_COBRO[c.estado] || 'info'}`}>{CORTO_COBRO[c.estado] || '—'}</span>
      {detalle && <span class="mini terciario num">{detalle}</span>}
    </span>
  );
}

function NuevoAtleta({ alCerrar }) {
  const { api } = useApp();
  const [f, setF] = useState({ nombre: '', email: '', objetivo: '', notion_url: '', servicio: 'completo', nivel: null, carrera: false });
  const con056 = useCarga(() => api.carrera056().catch(() => null), []);   // (v0.133) la carrera, solo con la 056
  const [error, setError] = useState(null);
  const [creado, setCreado] = useState(null);
  const [ocupado, una] = useUnaVez();
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  if (creado) return <Invitacion atleta={creado} alCerrar={() => alCerrar(creado.id)} />;
  return (
    <Hoja titulo="Añadir atleta" alCerrar={() => alCerrar(null)}>
      <form class="pila" onSubmit={(e) => {
        e.preventDefault();
        una(async () => {
          try {
            const a = await api.crearAtleta({ nombre: f.nombre.trim(), email: f.email.trim() || null, objetivo: f.objetivo.trim() || null, notion_url: f.notion_url.trim() || null, ...CAMPOS_SERVICIO[f.servicio], nivel: f.servicio === 'nutricion' ? null : f.nivel, carrera: f.servicio !== 'nutricion' && con056.datos === true && f.carrera });
            setCreado(a);
          } catch (err) { setError(err.message); }
        });
      }}>
        {error && <div class="error" role="alert">{error}</div>}
        <div class="campo"><label for="na-nombre">Nombre y apellidos</label><input id="na-nombre" class="entrada" required value={f.nombre} onInput={cambiar('nombre')} /></div>
        <div class="campo"><label for="na-email">Email</label><input id="na-email" class="entrada" type="email" value={f.email} onInput={cambiar('email')} /><span class="ayuda">Solo para tu referencia; el atleta crea su cuenta con el email que quiera.</span></div>
        <div class="campo"><span class="etq">Servicio</span>
          <Segmentos etiqueta="Servicio" clase="segmentos-servicio" valor={f.servicio} opciones={SERVICIOS}
            alCambiar={(v) => v && setF({ ...f, servicio: v })} /></div>
        {f.servicio !== 'nutricion' && <div class="campo"><span class="etq">Nivel</span>
          <Segmentos etiqueta="Nivel" clase="segmentos-nivel" valor={f.nivel} opciones={NIVELES} alCambiar={(v) => setF({ ...f, nivel: v })} />
          <span class="ayuda">{f.nivel ? AYUDA_NIVEL[f.nivel] : 'Decide cómo pautas la carga en el editor. Puedes elegirlo después, en Datos.'}</span></div>}
        {f.servicio !== 'nutricion' && con056.datos === true && <label class="campo campo-check-largo" for="na-carrera">
          <input id="na-carrera" type="checkbox" role="switch" class="interruptor" checked={f.carrera} onChange={(e) => setF({ ...f, carrera: e.currentTarget.checked })} />
          <span class="pila-xs"><span>También le llevas la carrera</span><span class="ayuda">Zonas, plan por semanas, sesiones por partes y revisiones. Lo puedes cambiar después, en Datos.</span></span>
        </label>}
        <div class="campo"><label for="na-obj">Objetivo</label><input id="na-obj" class="entrada" value={f.objetivo} onInput={cambiar('objetivo')} placeholder="Ganar fuerza y bajar 3 kg" /></div>
        <div class="campo"><label for="na-notion">Su página de Notion</label><input id="na-notion" class="entrada" type="url" value={f.notion_url} onInput={cambiar('notion_url')} placeholder="https://notion.so/…" /><span class="ayuda">La verá en su perfil para la alimentación y los recursos hasta que pasen a la app.</span></div>
        <button class="btn btn-primario btn-grande" disabled={ocupado}>{ocupado ? 'Creando…' : 'Crear y generar código'}</button>
      </form>
    </Hoja>
  );
}

export function Invitacion({ atleta, alCerrar }) {
  const { api, aviso, modo } = useApp();
  const codigo = useCarga(() => api.crearInvitacion(atleta.id), [atleta.id], { tirar: false });   // (no es una consulta: crea el código)
  const contactos = useContactos([atleta.id]);   // (v0.105) con su teléfono, el WhatsApp va directo a él
  const url = typeof location !== 'undefined' ? location.origin + location.pathname : '';
  const nombre = atleta.nombre.split(' ')[0];
  const mensaje = codigo.datos
    ? `Hola, ${nombre}. Ya tienes tu acceso a la app de FBE Coaching. Entra en ${url}, toca «Activa tu cuenta» y escribe este código: ${codigo.datos}. Caduca en 14 días y solo vale una vez.`
    : '';
  return (
    <Hoja titulo={`Invitación para ${nombre}`} alCerrar={alCerrar}>
      {codigo.cargando ? <Cargando /> : codigo.error ? <ErrorCaja error={codigo.error} /> : (
        <div class="pila">
          <div class="codigo-grande num">{codigo.datos}</div>
          <p class="peq secundario">El código caduca en 14 días y solo sirve una vez. Si generas otro, este deja de valer.</p>
          <div class="campo"><span class="etq">Mensaje para enviarle</span><div class="nota" style="user-select:all">{mensaje}</div></div>
          <div class="fila-envolver">
            <button class="btn btn-primario" onClick={async () => aviso((await copiar(mensaje)) ? 'Mensaje copiado' : 'Selecciona el texto y cópialo')}><Icono n="copiar" /> Copiar mensaje</button>
            <a class="btn" href={enlaceWhatsApp(contactos.datos?.[atleta.id], mensaje)} target="_blank" rel="noopener"><Icono n="enviar" /> WhatsApp</a>
          </div>
          {modo === 'demo' && <p class="mini terciario">En la demo, el código funciona en esta misma pestaña: cambia de cuenta y elige «Activa tu cuenta».</p>}
        </div>
      )}
    </Hoja>
  );
}

// Series pautadas hechas en las 4 últimas semanas acabadas
function Cumple({ c, corto = false }) {
  if (!c || c.series.pct == null) return null;
  const clase = c.series.pct >= 90 ? 'ok' : c.series.pct >= 75 ? '' : 'aviso';
  const detalle = `Series pautadas hechas en las 4 últimas semanas: ${c.series.hechas} de ${c.series.pautadas}`;
  return <div class={`mini cumple num ${clase}`} title={detalle}>{c.series.pct} % {corto ? 'hecho' : 'cumplido'}<span class="sr">. {detalle}</span></div>;
}

// (054) El mensaje que pide lo que falta (según el aviso), para retocarlo y mandarlo sin entrar en el chat
function HojaPedir({ r, alerta, alCerrar }) {
  const { api, aviso } = useApp();
  const [texto, setTexto] = useState(() => mensajeParaAlerta(alerta, r.nombre) || '');
  const [ocupado, una] = useUnaVez();
  const primer = r.nombre.split(' ')[0];
  const enviar = () => una(async () => {
    const limpio = texto.trim();
    if (!limpio) return;
    try {
      await api.enviarMensaje(r.atleta_id, { texto: limpio, autor: 'coach', clienteId: globalThis.crypto?.randomUUID?.() || `pedir-${Date.now()}` });
      aviso(`Mensaje enviado a ${primer}`, 'ok');
      alCerrar();
    } catch (e) { aviso(e?.message || 'No se ha podido enviar', 'error'); }
  });
  return (
    <Hoja titulo={`Pedírselo a ${primer}`} alCerrar={alCerrar} ancho={560}>
      <div class="pila">
        <p class="peq secundario pedir-aviso"><Icono n="alerta" width="16" height="16" /> {alerta.texto}</p>
        <div class="pila-xs revision-nota">
          <label class="peq secundario" for="pedir-texto">Mensaje (edítalo a tu gusto)</label>
          <textarea id="pedir-texto" rows="4" maxLength={1000} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} />
        </div>
        <button type="button" class="btn btn-primario" style="justify-self:start" disabled={ocupado || !texto.trim()} onClick={enviar}><Icono n="enviar" /> Enviar</button>
      </div>
    </Hoja>
  );
}
