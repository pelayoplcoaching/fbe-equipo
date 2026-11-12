import { TarjetaTravesia } from './TravesiaTarjeta.jsx';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Fragment } from 'preact';
import { VideoSemanaHoy, DirectoHoy } from '../Videos.jsx';
import { GuiaSugerida, MitoDeLaSemana } from '../Guias.jsx';
import { pedirSubProgreso } from './sub-progreso.js';
import { FinDePagina, Siluetas, Reserva, useApp, useCarga, Icono, Disco, Cargando, Vacio, ErrorCaja, Marca, Hoja, Paso, usePreferencia, cuando, Pista, Avatar, useApuntar, IcoIos, CapaIcono } from '../comunes.jsx';
import { resumenDia, ordenDia, colocarDia } from '../../logica/dia.js';
import { BandaConexion, BandaDemo } from '../App.jsx';
import { Hilo } from '../Hilo.jsx';
import { VerArchivo } from '../Archivos.jsx';
import { TarjetaSemana, HistoriaSemana } from './TuSemana.jsx';
import { Bienvenida, PrimerosPasos } from './Bienvenida.jsx';
import { AvisoLogros } from '../Logros.jsx';
import { AvisosCoach } from '../Avisos.jsx';
import { InformeBloque, TarjetaBloque } from '../InformeBloque.jsx';
import { NOMBRE_GRUPO, pauta, NOMBRE_FOCO, NOMBRE_INTENCION, NOMBRE_PRIORIDAD, NOMBRE_TIPO_SESION, etiquetasSuperserie, duracionEstimada, tendenciaPeso, ritmoPeso, estadoPeso, num, signo } from '../../logica/calculos.js';
import { Bienvenida as BienvenidaDia, useBienvenida } from '../Bienvenida.jsx';
import { leerEnCurso } from '../en-curso.js';
import { sinMovimiento } from '../transiciones.js';
import { LOBO } from '../marca-lobo.js';
import { diaDeCheckin, fmtConDia, hoyISO, desdeISO, rangoSemana, diasEntre, sumarDias } from '../../logica/fechas.js';
import { queToca, diaPrevistoValido, cuandoDia } from '../../logica/plan.js';
import { PlanSemana } from './Plan.jsx';
import { HabitosHoy } from './Habitos.jsx';
import { TarjetaNotificaciones } from '../Notificaciones.jsx';
import { NutricionHoy } from './Nutricion.jsx';
import { conNutricion, conEntrenamiento } from '../../logica/nivel.js';
import { conCarrera } from '../../logica/carrera.js';
import { CarreraHoy, TuCarrera } from './Carrera.jsx';
import { MenuHoy } from './Comidas.jsx';
import { planVigente } from '../../logica/nutricion.js';
import { ajuste } from '../ajustes.js';
import { AvisoCobro } from './Cobro.jsx';
import { HojaCuestionario, TarjetaCuestionario, pendiente } from './Cuestionario.jsx';
import { TarjetaCardio } from './Sesion.jsx';
import { ArteSesion } from './Portada.jsx';
import { cardioValido, cardioHechoValido, textoCardio, textoCardioHecho } from '../../logica/cardio.js';
import { HojaTarea } from '../Tareas.jsx';
import { TarjetaMes } from './TuMes.jsx';
import { TarjetaAnio } from './TuAnio.jsx';
import { RecordatorioCompartir } from '../Compartir.jsx';
import { textoCierreAuto } from '../../logica/cierre.js';
import { TarjetaAniversario } from '../Celebracion.jsx';
import { HojaBloque } from './TuBloque.jsx';
import { PantallaRacha, HitoRacha, useHitoRacha } from './Racha.jsx';
import { lanzarConfeti } from '../confeti.js';
import { TextoConEnlaces } from '../Enlaces.jsx';
import { Ilustracion } from '../Ilustraciones.jsx';
import { imagenEjercicio, imagenIcono } from '../../logica/imagenes.js';
import { Imagen, hayImagen } from '../Imagen.jsx';
import { Pictograma, PictoEjercicio } from '../Pictograma.jsx';
import { estadoHoy, sugerenciaDescanso, urlSegura, resumenPautas } from '../../logica/diseno.js';
import { panelBienvenida, panelNutricion } from '../../logica/bienvenida.js';
import { Diales } from './Diales.jsx';
import { OrdenarHoy } from './OrdenarHoy.jsx';
import { leerPanel, seccionesHoy, alternarSeccion } from '../../logica/hoy-panel.js';
import { deFuera } from '../../logica/tiempo.js';
import { useTiempo, TiempoHoy, resumenParaHoy } from './Tiempo.jsx';
import { AvisoViaje } from './Viaje.jsx';
import { semanasObjetivo, semanaEnCurso } from '../../logica/semana-natural.js';
import { sesionConCola, CLAVES_COPIA } from '../../logica/sin-red.js';

// Minutos aproximados: cada serie ~40 s de trabajo más su descanso
export { duracionEstimada };

export function Hoy({ programa, abrirSesion, irA, checkinSemana, salud, noLeidos, releer, recargarConsentimientos }) {
  const { api, atleta, perfil, propio } = useApp();
  const { datos: p, cargando, error, recargar } = programa;
  // Solo nutrición (v0.26): sin nada de entrenamiento
  const entrena = conEntrenamiento(atleta);
  // Atleta nuevo: bienvenida (una vez) y primeros pasos hasta completarlos u ocultarlos
  const hechos = useCarga(() => api.primerosPasos(atleta.id).catch(() => null), [atleta.id, p, checkinSemana.datos], { recuerdo: `pasos:${atleta.id}` });
  // Cuestionario inicial: un paso de los primeros pasos y, si el coach lo pide, una tarjeta
  const cuestionario = useCarga(() => api.cuestionario(atleta.id).catch(() => null), [atleta.id], { recuerdo: `cuestionario:${atleta.id}` });
  const [verCuestionario, setVerCuestionario] = useState(false);
  const [bienvenidaVista, setBienvenidaVista] = usePreferencia('fbe-bienvenida-vista', false);
  const [pasosOcultos, setPasosOcultos] = usePreferencia('fbe-primeros-pasos-oculto', false);
  const [instalada, setInstalada] = usePreferencia('fbe-instalada', false);
  const [faqVista, setFaqVista] = usePreferencia('fbe-faq-vista', false);
  const esApp = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone);
  const siguienteId = p?.actual ? (p.sesiones[p.actual.id] || []).find((x) => !x.completada)?.id : null;
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const pasos = hechos.datos ? [
    { id: 'cuenta', texto: 'Activa tu cuenta', hecho: true },
    { id: 'cuestionario', texto: 'Rellena tu cuestionario inicial', hecho: hechos.datos.cuestionario, etiqueta: 'Empezar', accion: () => setVerCuestionario(true) },
    { id: 'instalar', texto: 'Ponla en tu pantalla de inicio', hecho: esApp || instalada, etiqueta: 'Ya la tengo', accion: () => setInstalada(true),
      ayuda: ios ? 'En Safari, toca Compartir y luego «Añadir a pantalla de inicio».' : 'En Chrome, toca el menú ⋮ y luego «Instalar aplicación».' },
    ...(entrena ? [{ id: 'sesion', texto: 'Haz tu primera sesión', hecho: hechos.datos.sesion, etiqueta: 'Empezar', accion: siguienteId ? () => abrirSesion(siguienteId) : null }] : []),
    ...(salud ? [
      { id: 'peso', texto: 'Apunta tu peso', hecho: hechos.datos.peso, etiqueta: 'Apuntar', accion: () => { abrirPlegableHoy('peso'); const el = document.querySelector('.peso-hoy button'); el?.scrollIntoView({ block: 'center' }); el?.click(); } },
      { id: 'checkin', texto: 'Envía tu primer check-in', hecho: hechos.datos.checkin, etiqueta: 'Ir', accion: () => irA('checkin') },
    ] : []),
    { id: 'faq', texto: 'Echa un vistazo a las preguntas frecuentes', hecho: faqVista, etiqueta: 'Ver', accion: () => { setFaqVista(true); irA('perfil'); } },
  ] : null;
  // Solo para quien acaba de llegar (su primer mes): a quien ya lleva tiempo no se le enseña
  const nuevo = !atleta.fecha_alta || diasEntre(atleta.fecha_alta, hoyISO()) <= 30;
  // En el modo atleta del coach no hay bienvenida, primeros pasos, avisos, cuestionario ni respuestas: es él
  const verPasos = !propio && pasos && nuevo && !pasosOcultos && pasos.some((x) => !x.hecho);
  const verBienvenida = !propio && hechos.datos && (!entrena || !hechos.datos.sesion) && !bienvenidaVista;

  return (
    <>
    <div class="contenido" inert={verBienvenida ? '' : undefined} aria-hidden={verBienvenida ? 'true' : undefined}>
      <header class="cabecera">
        <h1 class="sr">Hoy</h1>
        <div class="titulo"><Marca /></div>
        <span class="sub">{fmtConDia(hoyISO())}</span>
        {!propio && <button class="btn-avatar" onClick={() => irA('perfil')} aria-label="Tu perfil"><Avatar nombre={atleta.nombre} foto={perfil?.foto} /></button>}
      </header>
      <BandaDemo />
      <BandaConexion />
      <ErrorCaja error={error} reintentar={recargar} />
      {/* v0.73: el día de su aniversario en FBE (1 mes, 6 meses, 1 año…), con su confeti */}
      {!verBienvenida && <TarjetaAniversario />}
      {atleta.estado !== 'baja' && !propio && <AvisoCobro irA={irA} />}
      {atleta.estado === 'baja' && (
        <div class="nota-coach"><Icono n="alerta" /><div>Tu cuenta está de baja: puedes ver tu historial y descargar tus datos desde Perfil, pero ya no se guarda nada nuevo. Si quieres volver, escribe a tu coach.</div></div>
      )}
      {verPasos ? <PrimerosPasos pasos={pasos} alOcultar={() => setPasosOcultos(true)} /> : !propio && <AvisoInstalar />}
      {!propio && (verPasos || (!p && !cargando) || !entrena) && <Reserva id="hoy-avisos"><AvisosCoach /></Reserva>}
      {!entrena ? (
        <ContenidoNutricion irA={irA} checkinSemana={checkinSemana} salud={salud} recargarConsentimientos={recargarConsentimientos}
          sinBienvenida={propio || !hechos.datos || verBienvenida}
          entre={(
            <>
              {!verPasos && atleta.estado !== 'baja' && <Reserva id="hoy-tu-dia"><TuDia p={null} salud={salud} checkinSemana={checkinSemana} abrirSesion={abrirSesion} irA={irA} abrirCuestionario={() => setVerCuestionario(true)} version={cuestionario.datos?.actualizado_en} recargarConsentimientos={recargarConsentimientos} /></Reserva>}
              {!propio && <Reserva id="hoy-mes"><TarjetaMes salud={salud} /></Reserva>}
              {pendiente(cuestionario.datos) && !(verPasos && !hechos.datos?.cuestionario) && <TarjetaCuestionario cuestionario={cuestionario.datos} abrir={() => setVerCuestionario(true)} />}
              {noLeidos.some((c) => !api.esMensaje(c)) && <Respuestas noLeidos={noLeidos.filter((c) => !api.esMensaje(c))} programa={p} releer={releer} abrirSesion={abrirSesion} />}
              {!verPasos && <TarjetaNotificaciones />}
            </>
          )} />
      ) : cargando && !p ? <Siluetas forma="hoy" texto="Cargando tu programa" /> : p && (
        <Contenido p={p} atleta={atleta} abrirSesion={abrirSesion} irA={irA} checkinSemana={checkinSemana} salud={salud} noLeidos={noLeidos} recargar={() => recargar(true)}
          sinBienvenida={propio || !hechos.datos || verBienvenida}
          entre={(
            <>
              {!verPasos && !propio && <Reserva id="hoy-avisos"><AvisosCoach /></Reserva>}
              {!verPasos && atleta.estado !== 'baja' && <Reserva id="hoy-tu-dia"><TuDia p={p} salud={salud} checkinSemana={checkinSemana} abrirSesion={abrirSesion} irA={irA} abrirCuestionario={() => setVerCuestionario(true)} version={cuestionario.datos?.actualizado_en} recargarConsentimientos={recargarConsentimientos} /></Reserva>}
              {pendiente(cuestionario.datos) && !(verPasos && !hechos.datos?.cuestionario) && <TarjetaCuestionario cuestionario={cuestionario.datos} abrir={() => setVerCuestionario(true)} />}
              {noLeidos.some((c) => !api.esMensaje(c)) && <Respuestas noLeidos={noLeidos.filter((c) => !api.esMensaje(c))} programa={p} releer={releer} abrirSesion={abrirSesion} />}
              {!verPasos && !propio && hechos.datos?.sesion && <TarjetaNotificaciones />}
            </>
          )} />
      )}
      {p && <FinDePagina texto="Eso es todo por hoy." />}
    </div>
    {verBienvenida && <Bienvenida nombre={(perfil?.nombre || atleta.nombre || '').split(' ')[0]} alTerminar={() => setBienvenidaVista(true)} />}
    {verCuestionario && (
      <HojaCuestionario inicial={cuestionario.datos} salud={salud} darConsentimiento={async () => { await api.darConsentimientos(['datos_salud']); recargarConsentimientos?.(); }}
        alCerrar={() => setVerCuestionario(false)} alGuardar={() => { cuestionario.recargar(true); hechos.recargar(true); }} />
    )}
    <AvisoLogros salud={salud} irA={irA} pausado={!hechos.datos || verBienvenida} />
    </>
  );
}

// «Tu día»: lo que toca hoy, en una lista corta. Tocar una fila lleva a esa parte de la pantalla (o abre la sesión).
const ICONO_DIA = { sesion: 'hoy', habitos: 'llama', nutricion: 'nutricion', menu: 'receta', peso: 'bascula', checkin: 'checkin', cuestionario: 'pregunta' };
function TuDia({ p, salud, checkinSemana, abrirSesion, irA, abrirCuestionario, version, recargarConsentimientos }) {
  const { api, atleta } = useApp();
  // v0.48: la tarea del coach abierta
  const [tarea, setTarea] = useState(null);
  const dia = useCarga(() => api.tuDia(atleta.id, { programa: p, checkin: checkinSemana.datos, salud, nutricion: conNutricion(atleta), entrenamiento: conEntrenamiento(atleta), pesoDiario: atleta.peso_frecuencia !== 'semanal' }).catch(() => null), [atleta.id, p, checkinSemana.datos, salud, version, atleta.peso_frecuencia], { recuerdo: `tu-dia:${atleta.id}` });
  // Tras apuntar algo en cualquier parte de la pantalla (un hábito, la nutrición, el peso), la lista se pone al día
  const recargarRef = useRef(null);
  recargarRef.current = dia.recargar;
  // Con todo hecho, la lista se recoge en una línea (antes se quedaba entera, tachada, hasta el día siguiente)
  const [verHecho, setVerHecho] = useState(false);
  useEffect(() => {
    let t = null;
    const alCambiar = () => { clearTimeout(t); t = setTimeout(() => recargarRef.current?.(true), 700); };
    window.addEventListener('fbe-cambio', alCambiar);
    return () => { clearTimeout(t); window.removeEventListener('fbe-cambio', alCambiar); };
  }, []);
  // (tanda 24) Lo que acaba de pasar a hecho (no lo que ya lo estaba al llegar) da un salto con su ✓
  const estados = useRef(null), recien = useRef({});
  if (dia.datos && estados.current) for (const x of dia.datos) if (x.estado === 'hecho' && estados.current[x.id] && estados.current[x.id] !== 'hecho' && !recien.current[x.id]) recien.current[x.id] = Date.now();
  useEffect(() => {
    if (!dia.datos) return;
    estados.current = Object.fromEntries(dia.datos.map((x) => [x.id, x.estado]));
    for (const x of dia.datos) if (x.estado !== 'hecho') delete recien.current[x.id];
  });
  // (belleza de hoy) Lo que queda, arriba; lo hecho, debajo. El orden se fija al llegar (con lo que diga la base): lo
  // que se va marcando con la pantalla abierta se queda en su sitio con su ✓, sin que la lista salte bajo el dedo.
  const orden = useRef(null);
  const fecha = new Date().toDateString();   // (con la app abierta de un día para otro, la lista nueva se ordena de nuevo)
  if (dia.datos && orden.current?.fecha !== fecha) orden.current = Object.assign(ordenDia(dia.datos), { fecha });
  const items = dia.datos && colocarDia(dia.datos, orden.current);
  if (!items || !items.length) return null;
  const r = resumenDia(items);
  // (tanda 25) La sección se abre creciendo (bloque 53 de diseno.css): el desplazamiento empezaba con la página aún corta
  // y se quedaba a medias. Se desplaza al abrirse y otra vez al acabar de crecer, que continúa el mismo movimiento.
  const bajarA = (sel) => {
    const ir = (enfocar) => { const el = document.querySelector(sel); if (!el) return; el.scrollIntoView({ behavior: sinMovimiento() ? 'auto' : 'smooth', block: 'start' }); if (enfocar) el.focus?.({ preventScroll: true }); };
    requestAnimationFrame(() => requestAnimationFrame(() => ir(true)));
    if (!sinMovimiento()) setTimeout(() => ir(false), 320);
  };
  const ir = (x) => {
    if (x.accion === 'sesion' && x.sesionId) abrirSesion(x.sesionId);
    else if (x.accion === 'sesion' || x.accion === 'semana' || x.accion === 'plan') { abrirPlegableHoy('semana'); bajarA('.semana-dias'); }
    else if (x.accion === 'habitos') { abrirPlegableHoy('habitos'); bajarA('.seccion-habitos'); }
    else if (x.accion === 'nutricion') { abrirPlegableHoy('nutricion'); bajarA('.seccion-nutricion'); }
    else if (x.accion === 'peso') { abrirPlegableHoy('peso'); const el = document.querySelector('.peso-hoy button'); el?.scrollIntoView({ block: 'center' }); if (!items.find((y) => y.id === 'peso' && y.estado === 'hecho')) el?.click(); }
    else if (x.accion === 'checkin') irA('checkin');
    else if (x.accion === 'comidas') irA('comidas');
    else if (x.accion === 'cuestionario') abrirCuestionario();
    else if (x.accion === 'tarea') api.tareas(atleta.id).then((l) => setTarea(l.find((t) => t.id === x.tareaId) || null));
  };
  return (
    <section class="panel tu-dia" aria-label="Tu día">
      <div class="panel-pad separa">
        <strong>Tu día</strong>
        {r && <span class="tu-dia-cuenta"><AnilloDia hechas={r.hechas} total={r.total} />{!r.todo && <span class="peq num secundario">{`${r.hechas} de ${r.total}`}</span>}</span>}
      </div>
      {r?.todo && (
        <div class="panel-pad tu-dia-hecho">
          <span class="dia-marca" aria-hidden="true"><Icono n="hecho" /></span>
          <span class="pila-xs"><strong>Todo hecho por hoy</strong><span class="mini terciario">Mañana tendrás tu lista nueva.</span></span>
          <button class="btn-texto" aria-expanded={verHecho} onClick={() => setVerHecho(!verHecho)}>{verHecho ? 'Ocultar' : 'Ver lo de hoy'}</button>
        </div>
      )}
      {(!r?.todo || verHecho) && <ul class="lista">
        {items.map((x) => (
          <li key={x.id}>
            <button class={`fila-dia ${x.estado}${Date.now() - (recien.current[x.id] || 0) < 1500 ? ' recien' : ''}`} data-tipo={x.accion === 'tarea' ? 'tarea' : x.id} onClick={() => ir(x)}>
              <span class={`dia-marca${x.estado !== 'hecho' && hayImagen(imagenIcono(x.icono || ICONO_DIA[x.id] || 'hoy')) ? ' con-img' : ''}`} aria-hidden="true">{x.estado === 'hecho' ? <Icono n="hecho" /> : <><Icono n={x.icono || ICONO_DIA[x.id] || 'hoy'} /><CapaIcono n={x.icono || ICONO_DIA[x.id] || 'hoy'} /></>}</span>
              <span class="pila-xs"><span class={x.estado === 'hecho' ? 'tachado' : ''}>{x.texto}</span><span class="mini terciario">{x.detalle}</span></span>
              <span class="sr">{x.estado === 'hecho' ? 'hecho' : x.estado === 'toca' ? 'pendiente' : ''}</span>
              {x.estado === 'toca' && <span class="punto-dia" aria-hidden="true" />}
              <Icono n="derecha" />
            </button>
          </li>
        ))}
      </ul>}
      <Pista id="tu-dia">Esta lista es lo que te toca hoy. Lo demás de esta pantalla es detalle: puedes mirarlo o no.</Pista>
      {tarea && <HojaTarea tarea={tarea} salud={salud} alCerrar={() => setTarea(null)} alCambiar={() => dia.recargar(true)}
        darConsentimiento={async () => { await api.darConsentimientos(['datos_salud']); recargarConsentimientos?.(); }} />}
    </section>
  );
}

// (belleza de hoy) Al bajar por la pantalla, el botón de empezar se queda a mano: una barra fina sobre las pestañas con
// el nombre de la sesión, que sale cuando el botón grande ya no se ve y se va al volver arriba.
function BarraEmpezar({ nombre, empezada, abrir }) {
  const [fuera, setFuera] = useState(false);
  useEffect(() => {
    const boton = document.querySelector('.hero-dia .btn-hero');
    if (!boton || typeof IntersectionObserver === 'undefined') return undefined;
    // solo cuenta si se ha ido por arriba (al bajar): si aún no ha entrado en pantalla, no hace falta
    const o = new IntersectionObserver(([x]) => setFuera(!x.isIntersecting && x.boundingClientRect.bottom < 0));
    o.observe(boton);
    return () => o.disconnect();
  }, []);
  return (
    <>
      {fuera && (
        <button class="hoy-a-mano" onClick={abrir} aria-label={`${empezada ? 'Continuar' : 'Empezar'} ${nombre}`}>
          <span class="hoy-a-mano-texto"><span class="mini">{empezada ? 'A medias' : 'Tu sesión'}</span><strong>{nombre}</strong></span>
          <span class="hoy-a-mano-ir"><Icono n="play" />{empezada ? 'Continuar' : 'Empezar'}</span>
        </button>
      )}
    </>
  );
}

// Anillo pequeño de «Tu día»: cuánto de lo de hoy está hecho
function AnilloDia({ hechas, total }) {
  const R = 10, C = 2 * Math.PI * R;
  const f = total ? hechas / total : 0;
  return (
    <svg class={`anillo-dia ${total && hechas >= total ? 'todo' : ''}`} viewBox="0 0 26 26" aria-hidden="true">
      <circle class="pista" cx="13" cy="13" r={R} />
      <circle class="lleno" cx="13" cy="13" r={R} stroke-dasharray={C} stroke-dashoffset={C * (1 - f)} transform="rotate(-90 13 13)" />
    </svg>
  );
}

// Lo que el coach ha contestado y aún no has leído
function Respuestas({ noLeidos, programa, releer, abrirSesion }) {
  const { atleta } = useApp();
  const [abierta, setAbierta] = useState(null);
  const sesiones = Object.values(programa?.sesiones || {}).flat();
  const grupos = [];
  for (const c of noLeidos) {
    const clave = c.sesion_id || c.checkin_id || c.archivo_id || 'general';
    let g = grupos.find((x) => x.clave === clave);
    if (!g) { g = { clave, c, n: 0 }; grupos.push(g); }
    g.n++;
  }
  const titulo = (c) => {
    if (c.sesion_id) return sesiones.find((s) => s.id === c.sesion_id)?.nombre || 'Una sesión';
    if (c.checkin_id) return 'Tu check-in';
    if (c.archivo_id) return 'Tu vídeo de técnica';
    return 'Mensaje de tu coach';
  };
  return (
    <section class="panel respuestas" aria-label="Respuestas de tu coach">
      <div class="panel-pad separa"><strong><Icono n="mensaje" /> Tu coach te ha respondido</strong></div>
      <ul class="lista">
        {grupos.map(({ clave, c, n }) => (
          <li key={clave}>
            <button class="respuesta respuesta-coach" onClick={() => setAbierta(c)}>
              <img class="respuesta-lobo" src={LOBO} alt="" width="36" height="36" aria-hidden="true" />
              <span class="respuesta-cab"><span class="nombre">{titulo(c)}</span><span class="mini terciario">{cuando(c.creado_en)}</span></span>
              <span class="detalle">«{c.texto.length > 90 ? c.texto.slice(0, 88) + '…' : c.texto}»{n > 1 ? ` y ${n - 1} más` : ''}</span>
            </button>
          </li>
        ))}
      </ul>
      {abierta && (
        <Hoja titulo={titulo(abierta)} alCerrar={() => { setAbierta(null); releer(); }}>
          {abierta.archivo_id && <ArchivoDe id={abierta.archivo_id} />}
          <Hilo atletaId={atleta.id} sesionId={abierta.sesion_id} checkinId={abierta.checkin_id} archivoId={abierta.archivo_id} />
          {abierta.sesion_id && sesiones.some((s) => s.id === abierta.sesion_id) && (
            <button class="btn" onClick={() => { const id = abierta.sesion_id; setAbierta(null); abrirSesion(id); }}>Abrir la sesión</button>
          )}
        </Hoja>
      )}
    </section>
  );
}

function ArchivoDe({ id }) {
  const { api, atleta } = useApp();
  const a = useCarga(() => api.archivos(atleta.id).then((l) => l.find((x) => x.id === id) || null), [id]);
  return a.datos ? <VerArchivo archivo={a.datos} /> : null;
}

// Aviso para instalar la app en el móvil (solo fuera de la demo y si aún no está instalada)
function AvisoInstalar() {
  const { modo } = useApp();
  const [cerrado, setCerrado] = usePreferencia('fbe-aviso-instalar', false);
  const [ver, setVer] = useState(false);
  const instalada = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone);
  if (modo === 'demo' || cerrado || instalada) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const prompt = window.__fbeInstalar;
  return (
    <div class="aviso-instalar">
      <Icono n="movil" />
      <div class="pila-s">
        <strong>Ponla en tu pantalla de inicio</strong>
        <span class="peq secundario">Se abre como una app, a pantalla completa, y funciona sin cobertura.</span>
        {ver && (ios
          ? <span class="peq">En Safari, toca <strong>Compartir</strong> y luego <strong>Añadir a pantalla de inicio</strong>.</span>
          : <span class="peq">En Chrome, toca el menú <strong>⋮</strong> y luego <strong>Instalar aplicación</strong>.</span>)}
        <span class="fila-envolver">
          {prompt && !ios
            ? <button class="btn btn-peq btn-primario" onClick={async () => { try { await prompt.prompt(); } catch { /* */ } window.__fbeInstalar = null; setCerrado(true); }}>Instalar</button>
            : !ver && <button class="btn btn-peq" onClick={() => setVer(true)}>Cómo se hace</button>}
          <button class="btn btn-peq plano" onClick={() => setCerrado(true)}>Ahora no</button>
        </span>
      </div>
    </div>
  );
}

// Hoy de quien solo lleva la nutrición (v0.26): su menú de hoy, su nutrición, hábitos y peso
function ContenidoNutricion({ irA, checkinSemana, salud, recargarConsentimientos, entre = null, sinBienvenida = false }) {
  const { api, atleta, propio } = useApp();
  const checkinHecho = !!checkinSemana.datos?.checkin;
  // (diseño, tanda 14) la bienvenida del día también para quien solo lleva nutrición: su menú de hoy, las comidas hechas
  // y la semana. Pide lo mismo que piden «Tu menú de hoy» y «Nutrición de hoy» (solo el día que sale la bienvenida).
  const [verDia, cerrarDia] = useBienvenida(sinBienvenida ? null : api.uid());
  const hoy = hoyISO();
  const conPanel = verDia && !!salud;
  const paraDia = useCarga(() => (conPanel ? Promise.all([api.menuSemana(atleta.id, hoy).catch(() => []), api.resumenNutricion(atleta.id, hoy, { entrenaHoy: false }).catch(() => null)]) : Promise.resolve(null)), [atleta.id, conPanel]);
  const panelDia = conPanel && paraDia.datos ? panelNutricion({
    menu: (paraDia.datos[0] || []).filter((e) => e.fecha === hoy), objetivo: paraDia.datos[1]?.objetivoHoy || null, semana: paraDia.datos[1]?.semana || null,
  }) : null;
  return (
    <>
      {verDia && <BienvenidaDia nombre={atleta.nombre} atletaId={atleta.id} datos={{ estado: 'nutricion' }} panel={panelDia} alCerrar={cerrarDia} />}
      <Reserva id="hoy-menu"><MenuHoy irA={irA} salud={salud} darConsentimiento={async () => { await api.darConsentimientos(['datos_salud']); recargarConsentimientos?.(); }} /></Reserva>
      {/* (YouTube) un directo de tu coach: desde el día antes y, a su hora, para verlo aquí */}
      {!propio && <DirectoHoy />}
      {entre}
      {salud && <Reserva id="hoy-nutricion"><NutricionHoy /></Reserva>}
      {salud && <Reserva id="hoy-habitos"><HabitosHoy /></Reserva>}
      {salud && <Reserva id="hoy-peso"><PesoHoy irA={irA} /></Reserva>}
      {salud && !checkinHecho && diaDeCheckin() && (
        <button class="nota-coach" style="border:0;text-align:left;cursor:pointer" onClick={() => irA('checkin')}>
          <Icono n="checkin" /><div><strong>Check-in semanal pendiente.</strong> Un minuto: peso, sueño, energía y cómo vas.</div>
        </button>
      )}
      {urlSegura(atleta.notion_url) && <a class="btn btn-ancho plano" href={urlSegura(atleta.notion_url)} target="_blank" rel="noopener">Abrir mi página de Notion</a>}
    </>
  );
}

function Contenido({ p, atleta, abrirSesion, irA, checkinSemana, salud, noLeidos, recargar, entre = null, sinBienvenida = false }) {
  const { api, propio, cola } = useApp();
  const constancia = useCarga(() => api.constancia(atleta.id).catch(() => null), [atleta.id, p], { recuerdo: `constancia:${atleta.id}` });
  // v0.68: la bienvenida del día (la primera vez que abre la app hoy; nunca con una sesión a medias ni en el modo atleta del coach)
  const [verDia, cerrarDia] = useBienvenida(sinBienvenida ? null : api.uid(), { sesionEnCurso: !!leerEnCurso(atleta.id) });
  const [planAbierto, setPlanAbierto] = useState(false);
  const [bloqueAbierto, setBloqueAbierto] = useState(false);
  const [carreraAbierta, setCarreraAbierta] = useState(false);  // (v0.133) «Tu carrera»
  // (v0.140) Hoy a tu gusto: el orden y lo oculto, en este móvil (por cuenta: el coach en su modo atleta tiene el suyo)
  const [panel, fijarPanel] = usePreferencia(`fbe-hoy-panel:${api.uid()}`, null);
  const P = leerPanel(panel);
  const [ordenando, setOrdenando] = useState(false);
  // v0.52: la pantalla de la racha y, al llegar a un hito (4, 8, 12, 26 o 52 semanas), su momento, una vez en este móvil
  const [verRacha, setVerRacha] = useState(false);
  const [hito, hitoVisto] = useHitoRacha(atleta.id, constancia.datos ? constancia.datos.racha : null);
  // Detalle de la siguiente sesión (ejercicios, duración): lo usan la tarjeta del día y la lista de debajo
  const hoy = hoyISO();
  const semana = p.actual;
  const sesiones = semana ? (p.sesiones[semana.id] || []) : [];
  const toca = semana ? queToca(sesiones, semana, hoy) : { siguiente: null };
  const siguiente = toca.siguiente;
  // (v0.65) con lo apuntado sin conexión encima («Continuar sesión» y las series hechas, también sin cobertura)
  const conCola = (d) => sesionConCola(d, cola.operaciones());
  const det = useCarga(() => (siguiente ? api.sesion(siguiente.id, atleta.id).then(conCola) : Promise.resolve(null)), [siguiente?.id],
    { copia: siguiente ? CLAVES_COPIA.sesion(siguiente.id) : null, transformar: conCola, recuerdo: siguiente ? `sesion-hoy:${atleta.id}:${siguiente.id}` : null });
  // v0.50: la tarjeta de arriba según cómo va el día (entreno, descanso, hecha, semana completa o sin semana)
  const e0 = estadoHoy({ bloque: p.bloque, semana, sesiones, hoy });
  // v0.53: con objetivo de días por semana (microciclos), la semana de lunes a domingo con ese objetivo: la de la
  // constancia (de todos sus bloques) o, mientras carga, la de este bloque. La sesión que sigue es la de su microciclo
  // (p.actual ya es el que le toca); con la semana natural hecha, la tarjeta de arriba dice «Semana hecha» y cuál sigue.
  const dias = p.diasSemana || null;
  const natural = !dias ? null : constancia.datos ? constancia.datos.actual
    : semanaEnCurso(semanasObjetivo({ diasSemana: dias, sesiones: Object.values(p.sesiones || {}).flat(), semanas: p.semanas || [], hoy }), hoy);
  const e = natural?.completa && !['sin_semana', 'semana'].includes(e0.tipo) ? { ...e0, tipo: 'semana', siguienteMicrociclo: e0.siguiente || toca.siguiente } : e0;
  // (diseño, tanda 20) La semana completa se celebra una vez: confeti la primera vez que Hoy la enseña (y la tarjeta
  // lo recuerda, por atleta y semana), no cada vez que se vuelve. Con «reducir movimiento», el confeti no sale.
  const [semanaCelebrada, setSemanaCelebrada] = usePreferencia('fbe-semana-celebrada', null);
  // (diseño, tanda 47) se vuelve del resumen de la sesión recién terminada («Volver a hoy»): la tarjeta lo celebra una vez
  const recienHecha = useRef(null);
  if (recienHecha.current === null) { try { recienHecha.current = sessionStorage.getItem('fbe-recien-hecha') === '1'; sessionStorage.removeItem('fbe-recien-hecha'); } catch { recienHecha.current = false; } }
  // (con objetivo de días por semana, se espera a la constancia: la clave lleva el lunes de la semana natural)
  const claveSemana = e.tipo === 'semana' && semana && (!dias || constancia.datos) ? `${atleta.id}:${semana.id}:${natural?.lunes || semana.fecha_inicio || ''}` : null;
  useEffect(() => {
    if (!claveSemana || semanaCelebrada === claveSemana) return;
    setSemanaCelebrada(claveSemana);
    const t = setTimeout(() => lanzarConfeti({ vibracion: 'anillo' }), 420);
    return () => clearTimeout(t);
  }, [claveSemana]);
  if (e.tipo === 'sin_semana') {
    return (
      <>
        <HeroEspera bloque={p.bloque} notion={urlSegura(atleta.notion_url)} irA={irA} propio={propio} />
        {/* (YouTube) un directo de tu coach: desde el día antes y, a su hora, para verlo aquí */}
        {!propio && <DirectoHoy />}
        {entre}
        {salud && conNutricion(atleta) && <MenuHoy irA={irA} salud={salud} compacto />}
        {salud && conNutricion(atleta) && <NutricionHoy />}
      </>
    );
  }
  // Con plan: la de hoy, una atrasada o la próxima prevista; sin plan, la primera pendiente
  const enSemana = !!semana.fecha_inicio && semana.fecha_inicio <= hoy && hoy <= sumarDias(semana.fecha_inicio, 6);
  const descanso = e.tipo === 'descanso';
  const previsto = siguiente && diaPrevistoValido(siguiente, semana);
  const hechas = sesiones.filter((s) => s.completada).length;
  const checkinHecho = !!checkinSemana.datos?.checkin;
  const conMensajes = new Set(noLeidos.map((c) => c.sesion_id).filter(Boolean));

  const ejercicios = det.datos?.ejercicios || [];
  const empezada = ejercicios.some((e) => e.hechas.length);

  // (la bienvenida del día: con lo que ya carga Hoy, sin consultas nuevas)
  const datosDia = constancia.datos ? {
    primeraVez: !constancia.datos.algunaVez, ultimoDia: constancia.datos.ultimoDia || null, haceMucho: !!constancia.datos.algunaVez && !constancia.datos.ultimoDia,
    racha: constancia.datos.racha || 0, estado: e.tipo, toca: e.tipo === 'entreno' ? (e.siguiente?.nombre || siguiente?.nombre || null) : null,
  } : null;
  // (tanda 11 de diseño) y su panel: lo que toca o lo siguiente, la semana, la racha, el bloque y sus últimas 12 semanas
  const sigue = e.tipo === 'semana' ? (e.siguienteMicrociclo || null) : (e.siguiente || siguiente || null);
  const resumenSigue = sigue && det.datos && siguiente?.id === sigue.id ? resumenPautas(ejercicios) : null;
  // (el atleta solo ve las semanas ya publicadas: cuántas tiene el bloque sale de sus fechas, si las tiene)
  const semanasBloque = p.bloque?.fecha_inicio && p.bloque?.fecha_fin && p.bloque.fecha_fin >= p.bloque.fecha_inicio ? Math.ceil((diasEntre(p.bloque.fecha_inicio, p.bloque.fecha_fin) + 1) / 7) : null;
  const panelDia = verDia && constancia.datos ? panelBienvenida({
    hoy, estado: e.tipo, racha: constancia.datos.racha || 0, semanas: constancia.datos.semanas || [],
    ultimoDia: constancia.datos.ultimoDia || null, primeraVez: !constancia.datos.algunaVez, haceMucho: !!constancia.datos.algunaVez && !constancia.datos.ultimoDia,
    sigue: sigue ? { nombre: sigue.nombre, minutos: resumenSigue?.minutos || 0, ejercicios: resumenSigue?.ejercicios || 0, grupos: (resumenSigue?.grupos || []).map((g) => NOMBRE_GRUPO[g] || g) } : null,
    semana: natural ? { hechas: natural.hechas, objetivo: natural.objetivo } : { hechas, objetivo: sesiones.length },
    bloque: semana?.numero ? { semana: semana.numero, de: semanasBloque } : null,
  }) : null;
  // (v0.140) Las secciones de debajo, cada una con su condición de siempre; el orden y lo oculto, los del atleta
  const tarjetaMes = <Reserva id="hoy-mes"><TarjetaMes salud={salud} /></Reserva>;
  const tarjetaMito = <Reserva id="hoy-mito"><MitoDeLaSemana /></Reserva>;
  const bloquesHoy = {
    sesion: e.tipo === 'entreno' && siguiente ? (
      <Plegable id="sesion" titulo="Lo que vas a hacer" icono="hoy" detalle={ejercicios.length ? `${ejercicios.length} ${ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}, uno a uno` : 'La sesión que te toca'}>
        <SiguienteSesion sesion={siguiente} ejercicios={ejercicios} cargando={det.cargando && !det.datos} />
      </Plegable>
    ) : null,
    semana: (
      <Plegable id="semana" titulo="Esta semana" icono="semana" detalle={`${dias && natural ? natural.hechas : hechas} de ${dias && natural ? natural.objetivo : sesiones.length} sesiones hechas`}>
      <section class="seccion">
        <div class="seccion-cab">
          <h2>Esta semana</h2>
          <span class="fila-envolver">
            <button class="btn-texto" onClick={() => setBloqueAbierto(true)}><Icono n="semana" /> Tu bloque</button>
            {enSemana && sesiones.some((s) => !s.completada) && <button class="btn-texto" onClick={() => setPlanAbierto(true)}><Icono n="calendario" /> {sesiones.some((s) => diaPrevistoValido(s, semana)) ? 'Tu plan' : 'Planificar'}</button>}
          </span>
        </div>
        <div class="semana-dias">
          {sesiones.map((s) => <DiaSesion key={s.id} sesion={s} semana={semana} actual={e.tipo === 'entreno' && s.id === siguiente?.id} mensajes={conMensajes.has(s.id)} abrir={() => abrirSesion(s.id)} />)}
        </div>
      </section>
      </Plegable>
    ),
    // (v0.142) el tiempo para salir: si lo que toca es cardio de fuera, o si corre (carrera)
    tiempo: (e.tipo === 'entreno' && deFuera(siguiente?.cardio)) || (conCarrera(atleta) && !propio)
      ? <SeccionTiempo modalidad={e.tipo === 'entreno' && deFuera(siguiente?.cardio) ? siguiente.cardio.modalidad : 'carrera'} ocultar={() => fijarPanel(alternarSeccion(panel, 'tiempo'))} />
      : null,
    carrera: conCarrera(atleta) && !propio ? <CarreraHoy abrir={() => setCarreraAbierta(true)} /> : null,
    menu: salud && conNutricion(atleta) ? <Plegable id="menu" titulo="Tu menú de hoy" icono="receta" detalle="Lo que tienes para comer hoy"><MenuHoy irA={irA} salud={salud} compacto /></Plegable> : null,
    nutricion: salud && conNutricion(atleta) ? (
      <Plegable id="nutricion" titulo="Nutrición de hoy" icono="nutricion" detalle="Apunta lo que has comido">
        <NutricionHoy entrenaHoy={enSemana && (!!toca.hoy || sesiones.some((s) => s.completada && s.fecha_realizada === hoy))} />
      </Plegable>
    ) : null,
    habitos: salud ? <Plegable id="habitos" titulo="Tus hábitos" icono="llama" detalle="Márcalos según los vas haciendo"><HabitosHoy /></Plegable> : null,
    peso: salud ? <Plegable id="peso" titulo="Tu peso" icono="bascula" detalle="Apúntalo y mira cómo va tu tendencia"><PesoHoy irA={irA} /></Plegable> : null,
  };
  const disponibles = Object.keys(bloquesHoy).filter((id) => bloquesHoy[id]);
  const { visibles, ocultas: ocultasAbajo } = seccionesHoy(panel, disponibles);
  const ocultasHoy = [...(propio ? [] : ['mes', 'mito'].filter((id) => P.ocultas.has(id))), ...ocultasAbajo];
  return (
    <>
      {verDia && <BienvenidaDia nombre={atleta.nombre} atletaId={atleta.id} datos={datosDia} panel={panelDia} alCerrar={cerrarDia} />}
      <section class={`hero-dia hero-${e.tipo}${recienHecha.current ? ' recien-hecha' : ''}`} aria-label={e.tipo === 'entreno' ? 'Tu sesión de hoy' : e.tipo === 'descanso' ? 'Hoy descansas' : e.tipo === 'hecha' ? 'Sesión de hoy hecha' : 'Semana completa'}>
        {e.tipo !== 'entreno' && <Ilustracion n={e.tipo === 'hecha' ? 'hecha' : e.tipo === 'semana' ? 'semana' : 'descanso'} clase="hero-ilu" />}
        {/* (diseño, tanda 15) el dibujo de la sesión (el mismo de su portada), al fondo de la tarjeta: cada día, el suyo.
            Sale cuando ya se sabe qué ejercicios lleva (su patrón principal decide el dibujo): así es el mismo que verá al abrirla */}
        {e.tipo === 'entreno' && siguiente && det.datos && <ArteSesion nombre={siguiente.nombre} tipo={siguiente.tipo || 'fuerza'} patron={resumenSigue?.patrones?.[0] || null} clase="hero-arte" />}
        <div class="titular">
          <div class="contexto">
            <span>Bloque {p.bloque.numero}: {p.bloque.nombre}</span>
            <span>Semana {semana.numero}</span>
            {semana.foco && <span>Foco: {NOMBRE_FOCO[semana.foco]?.toLowerCase()}</span>}
          </div>
          {/* (054) el objetivo del bloque, a la vista cada día */}
          {p.bloque.objetivo && <p class="hero-objetivo"><Icono n="bandera" /> {p.bloque.objetivo}</p>}
          {e.tipo === 'entreno' && enSemana && toca.hoy && <span class="chip toca-hoy"><Icono n="calendario" />Hoy toca</span>}
          {e.tipo === 'descanso' && <span class="chip toca-hoy descanso"><Icono n="sueno" />Día de descanso</span>}
          {e.tipo === 'hecha' && <span class="chip toca-hoy hecha"><Icono n="hecho" />Hecha hoy</span>}
          {e.tipo === 'semana' && <span class="chip toca-hoy hecha"><Icono n="llama" />Semana completa</span>}
          <h2>{e.tipo === 'descanso' ? 'Hoy descansas' : e.tipo === 'hecha' ? '¡Sesión hecha!' : e.tipo === 'semana' ? (dias && natural && !natural.completa ? '¡Todo hecho!' : '¡Semana completa!') : siguiente ? siguiente.nombre : 'Semana completada'}</h2>
          {e.tipo === 'entreno' && !toca.hoy && previsto && <p class="peq secundario">{previsto > hoy ? `Prevista para ${cuandoDia(previsto, hoy)}.` : `La tenías prevista ${cuandoDia(previsto, hoy)}.`}</p>}
          {e.tipo === 'semana' && !dias && <p class="peq secundario">Has hecho las {hechas} sesiones de esta semana.</p>}
          {e.tipo === 'semana' && dias && (
            <p class="peq secundario">
              {natural ? `Semana hecha: ${natural.hechas} de ${natural.objetivo}.` : 'Has hecho todo lo que tienes publicado.'}
              {e.siguienteMicrociclo ? <> La siguiente, <strong>{e.siguienteMicrociclo.nombre}</strong>, cuando te toque.</> : natural && !natural.completa ? ' Tu coach publicará lo siguiente.' : ''}
            </p>
          )}
        </div>
        {semana.nota_coach && (
          <div class="nota-coach con-lobo"><img class="nota-lobo" src={LOBO} alt="" width="24" height="24" aria-hidden="true" /><div><strong>Tu coach: </strong><TextoConEnlaces texto={semana.nota_coach} como="span" /></div></div>
        )}
        {e.tipo === 'descanso' ? (
          <HeroDescanso proxima={e.proxima} hoy={hoy} abrirSesion={abrirSesion} abrirPlan={enSemana && sesiones.some((s) => !s.completada) ? () => setPlanAbierto(true) : null} />
        ) : e.tipo === 'hecha' ? (
          <HeroHecha sesion={e.hechaHoy} proxima={e.proxima} hoy={hoy} abrirSesion={abrirSesion} />
        ) : e.tipo === 'semana' ? (
          <div class="pila-s">
            {salud && !propio && !checkinHecho && <div class="hero-acciones"><button class="btn btn-grande btn-hero" onClick={() => irA('checkin')}><Icono n="checkin" /> Hacer el check-in semanal</button></div>}
            {checkinHecho && !propio && <p class="peq secundario">Check-in de la semana enviado. Tu coach prepara lo siguiente con lo que has registrado.</p>}
            {(checkinHecho || !salud || propio) && <div class="hero-acciones"><button class="btn btn-grande btn-hero" onClick={() => irA('progreso')}><Icono n="progreso" /> Ver tu progreso</button></div>}
            {e.hechaHoy && <div class="hero-acciones"><button class="btn btn-sobre-hero" onClick={() => abrirSesion(e.hechaHoy.id)}><Icono n="hecho" /> Ver la de hoy</button></div>}
            {e.siguienteMicrociclo && <div class="hero-acciones"><button class="btn btn-sobre-hero" onClick={() => abrirSesion(e.siguienteMicrociclo.id)}><Icono n="play" /> Adelantar {e.siguienteMicrociclo.nombre}</button></div>}
          </div>
        ) : siguiente ? (
          <>
            {(ejercicios.length > 0 || siguiente.dinamica || cardioValido(siguiente.cardio) || (det.cargando && !det.datos)) && (
              <div class="hero-meta">
                {det.cargando && !det.datos && !cardioValido(siguiente.cardio) && <span aria-hidden="true">&nbsp;</span>}
                {cardioValido(siguiente.cardio) && <span><b>{textoCardio(siguiente.cardio)}</b></span>}
                {ejercicios.length > 0 && <><span><b>{ejercicios.length}</b> ejercicios</span><span>unos <b>{duracionEstimada(ejercicios)}</b> min</span></>}
                {empezada && <span><b>{ejercicios.reduce((n, x) => n + x.hechas.length, 0)}</b> series ya hechas</span>}
              </div>
            )}
            <div class="hero-acciones">
              <button class="btn btn-grande btn-hero" onClick={(ev) => { const h = ev.currentTarget.closest('.hero-dia'); abrirSesion(siguiente.id, h?.querySelector('.titular h2'), h?.querySelector('.hero-arte')); }}>
                <Icono n="play" /> {empezada ? 'Continuar sesión' : 'Empezar sesión'}
              </button>
            </div>
          </>
        ) : null}
        {(dias ? !!natural : sesiones.length > 0) && <ResumenSemana hechas={dias ? natural.hechas : hechas} total={dias ? natural.objetivo : sesiones.length} objetivo={dias} racha={constancia.datos?.racha ?? null} cargando={constancia.cargando && !constancia.datos} abrirRacha={constancia.datos ? () => setVerRacha(true) : null} />}
      </section>
      {e.tipo === 'entreno' && siguiente && <BarraEmpezar key={siguiente.id} nombre={siguiente.nombre} empezada={empezada} abrir={() => abrirSesion(siguiente.id)} />}
      <Diales sesiones={sesiones} semana={semana} siguiente={siguiente} previstaHoy={enSemana ? toca.hoy : null} ejerciciosSiguiente={ejercicios} bloques={p.bloques || []} salud={salud} hoy={hoy} alContestar={recargar}
        ocultos={P.dialesOcultos} entrenaHoy={enSemana && (!!toca.hoy || sesiones.some((s) => s.completada && s.fecha_realizada === hoy))}
        natural={dias ? { semana: natural, dias, semanas: p.semanas || [], sesionesPorSemana: p.sesiones || {} } : null} />

      {/* (v0.143) de viaje, en otra zona horaria: qué hora es en cada sitio y las notificaciones de noche */}
      <AvisoViaje />
      {/* (YouTube) un directo de tu coach: desde el día antes y, a su hora, para verlo aquí */}
      {!propio && <DirectoHoy />}
      {entre}
      {!propio && !P.ocultas.has('mes') && tarjetaMes}
      {/* (v0.104) en diciembre y enero, tu año en FBE */}
      {!propio && <TarjetaAnio />}
      {/* (compartir) «tu récord de ayer merece una historia», una vez y se puede quitar */}
      {!propio && <RecordatorioCompartir />}
      {/* (filosofía) de vuelta tras un parón, las dos reglas de oro; y el mito de la semana, hasta que se lee */}
      {!propio && constancia.datos?.algunaVez && !constancia.datos?.ultimoDia && <GuiaSugerida ocasion="vuelta" />}
      {!propio && !P.ocultas.has('mito') && tarjetaMito}
      {/* (YouTube) el vídeo de la semana de tu coach */}
      {!propio && <VideoSemanaHoy />}
      {/* (054) una sesión que la app cerró sola (todas las series hechas, 3 horas sin tocar): pedir cómo fue */}
      <CerradasPorTi sesiones={Object.values(p.sesiones || {}).flat()} hoy={hoy} abrirSesion={abrirSesion} />
      <Reserva id="hoy-informes"><BloqueTerminado salud={salud} /><SemanaPasada salud={salud} /></Reserva>
      {/* (diseño 9) Lo de debajo es detalle: va plegado en filas que se abren al tocarlas (y «Tu día» las abre al ir a ellas).
          (v0.140) en el orden que haya elegido el atleta («Ordenar Hoy»); lo que oculta, plegado al final */}
      {visibles.map((id) => <Fragment key={id}>{bloquesHoy[id]}</Fragment>)}
      {carreraAbierta && <TuCarrera alCerrar={() => setCarreraAbierta(false)} />}
      {verRacha && <PantallaRacha racha={constancia.datos?.racha || 0} semanas={constancia.datos?.semanas || []} diasSemana={constancia.datos?.diasSemana || null} hoy={hoy} alCerrar={() => setVerRacha(false)} />}
      {hito && !verRacha && <HitoRacha hito={hito} alCerrar={hitoVisto} />}
      {bloqueAbierto && <HojaBloque alCerrar={() => setBloqueAbierto(false)} abrirSesion={(id) => { setBloqueAbierto(false); abrirSesion(id); }} />}
      {planAbierto && (
        <Hoja titulo={`Tu plan, ${rangoSemana(semana.fecha_inicio)}`} alCerrar={() => setPlanAbierto(false)}>
          <PlanSemana semana={semana} sesiones={sesiones} alCambiar={recargar} compacto />
        </Hoja>
      )}

      {salud && !propio && !checkinHecho && siguiente && diaDeCheckin() && (
        <button class="nota-coach" style="border:0;text-align:left;cursor:pointer" onClick={() => irA('checkin')}>
          <Icono n="checkin" /><div><strong>Check-in semanal pendiente.</strong> Un minuto: peso, sueño, energía y molestias.</div>
        </button>
      )}
      {ocultasHoy.length > 0 && (
        <details class="ocultas-hoy" data-ocultas-hoy="">
          <summary><Icono n="ojo" /> Lo que has ocultado ({ocultasHoy.length})<Icono n="abajo" class="plegable-flecha" /></summary>
          <div class="pila-s">{ocultasHoy.map((id) => <Fragment key={id}>{id === 'mes' ? tarjetaMes : id === 'mito' ? tarjetaMito : bloquesHoy[id]}</Fragment>)}</div>
        </details>
      )}
      {/* «La travesía»: el juego de los descansos, en una línea (lo que lleva su lobo y un minuto de práctica) */}
      <TarjetaTravesia compacta />
      <div class="ordenar-hoy-pie">
        <button type="button" class="btn-texto" onClick={() => setOrdenando(true)}><Icono n="ordenar" /> Ordenar Hoy</button>
      </div>
      {ordenando && <OrdenarHoy pref={panel} fijar={fijarPanel} disponibles={disponibles} arriba={propio ? [] : ['mes', 'mito']}
        diales={['constancia', 'carga', ...(salud ? ['llegas'] : []), ...(salud && conNutricion(atleta) ? ['comida'] : []), ...(salud ? ['pasos', 'sueno'] : [])]} alCerrar={() => setOrdenando(false)} />}
    </>
  );
}

// (diseño 9) Una sección secundaria de Hoy, plegada en una fila: se abre al tocarla y este móvil recuerda las que dejas
// abiertas. Si lo de dentro no pinta nada (sin hábitos, sin menú), la fila no sale. El título de dentro se esconde
// (diseno.css): manda el de la fila, que es el que se ve abierta y cerrada.
// (v0.142) El tiempo para salir, en su plegable: el resumen (grados y mejor hora) se ve aunque esté cerrado
function SeccionTiempo({ modalidad, ocultar }) {
  const t = useTiempo();
  const { detalle, icono } = resumenParaHoy(t);
  return <Plegable id="tiempo" titulo="El tiempo para salir" icono={icono} detalle={detalle}><TiempoHoy t={t} modalidad={modalidad} ocultar={ocultar} /></Plegable>;
}

function Plegable({ id, titulo, icono, detalle = null, children }) {
  const [abierta, setAbierta] = usePreferencia(`fbe-hoy-abierta-${id}`, false);
  const cuerpo = useRef(null);
  const [vacia, setVacia] = useState(true);
  useLayoutEffect(() => {
    const el = cuerpo.current;
    if (!el) return undefined;
    const mirar = () => setVacia(el.childElementCount === 0);
    mirar();
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(mirar) : null;
    mo?.observe(el, { childList: true });
    return () => mo?.disconnect();
  }, []);
  return (
    <Reserva id={`hoy-plegable-${id}`} clase="reserva-plegable">
    <details class="plegable-hoy" data-plegable={id} open={abierta} hidden={vacia} onToggle={(ev) => { const o = ev.currentTarget.open; if (o !== abierta) setAbierta(o); }}>
      <summary>
        <IcoIos n={icono} />
        <span class="plegable-texto"><h2>{titulo}</h2>{detalle && <span class="mini terciario">{detalle}</span>}</span>
        <Icono n="abajo" class="plegable-flecha" />
      </summary>
      <div class="plegable-cuerpo" ref={cuerpo}>{children}</div>
    </details>
    </Reserva>
  );
}

// Abre una de esas filas desde fuera («Tu día», los primeros pasos) antes de bajar a ella
function abrirPlegableHoy(id) {
  const d = typeof document !== 'undefined' ? document.querySelector(`details[data-plegable="${id}"]`) : null;
  if (d && !d.open) d.open = true;
  // (v0.140) si el atleta la ocultó, está dentro de «Lo que has ocultado»: se abre también
  const fuera = d?.parentElement?.closest('details');
  if (fuera && !fuera.open) fuera.open = true;
  return d;
}

// La semana pasada en una tarjeta, hasta que la ves o la ocultas
// Al terminar un bloque (hasta 3 semanas después), su informe en una tarjeta
function BloqueTerminado({ salud }) {
  const { api, atleta } = useApp();
  const [visto, setVisto] = usePreferencia('fbe-informe-visto', null);
  const [abierto, setAbierto] = useState(false);
  const res = useCarga(() => api.informes(atleta.id, { salud }).catch(() => []), [atleta.id], { recuerdo: `informes-hoy:${atleta.id}` });
  const r = (res.datos || []).find((x) => x.terminado && !x.vacio && diasEntre(x.fin, hoyISO()) <= 21);
  if (!r || (visto === r.bloque.id && !abierto)) return null;
  return (
    <>
      <TarjetaBloque informe={r} alAbrir={() => { setAbierto(true); if (visto !== r.bloque.id) lanzarConfeti({ vibracion: 'anillo' }); }} alQuitar={() => setVisto(r.bloque.id)} />
      {abierto && <InformeBloque informe={r} salud={salud} alCerrar={() => { setAbierto(false); setVisto(r.bloque.id); }} />}
    </>
  );
}

function SemanaPasada({ salud }) {
  const { api, atleta } = useApp();
  const [vista, setVista] = usePreferencia('fbe-tu-semana-vista', null);
  const [abierta, setAbierta] = useState(false);
  const res = useCarga(() => api.resumenesSemanales(atleta.id, 1).catch(() => []), [atleta.id], { recuerdo: `semana-pasada:${atleta.id}` });
  const r = res.datos?.[0];
  if (!r || (vista === r.lunes && !abierta)) return null;
  return (
    <>
      <TarjetaSemana resumen={r} alAbrir={() => setAbierta(true)} alQuitar={() => setVista(r.lunes)} />
      {abierta && <HistoriaSemana resumen={r} salud={salud} alCerrar={() => { setAbierta(false); setVista(r.lunes); }} />}
    </>
  );
}

// Peso de hoy en un toque y la tendencia de las últimas semanas
function PesoHoy({ irA }) {
  const { api, atleta, aviso } = useApp();
  const apuntar = useApuntar();
  const pesos = useCarga(() => api.pesos(atleta.id, 60).catch(() => []), [atleta.id], { recuerdo: `pesos-hoy:${atleta.id}` });
  const nutri = conNutricion(atleta);
  const planes = useCarga(() => (nutri ? api.planesNutricion(atleta.id).catch(() => []) : Promise.resolve([])), [atleta.id, nutri], { recuerdo: `planes-hoy:${atleta.id}:${nutri}` });
  const [abierto, setAbierto] = useState(false);
  // La cifra, solo para quien la quiere ver (Ajustes): de serie, cómo va respecto a su objetivo, sin números
  const conCifra = !!ajuste('pesoCifra');
  const serie = tendenciaPeso(pesos.datos || []);
  const ult = serie[serie.length - 1];
  const hoy = hoyISO();
  const deHoy = ult?.fecha === hoy ? ult : null;
  const ritmo = ritmoPeso(serie);
  const e = estadoPeso(ritmo, planVigente(planes.datos || [], hoy), ult ? diasEntre(ult.fecha, hoy) : 0);
  return (
    <section class="seccion">
      <div class="seccion-cab"><h2>Tu peso</h2>{serie.length > 1 && <button class="btn-texto" onClick={() => { pedirSubProgreso('cuerpo'); irA('progreso'); }}>Ver la gráfica</button>}</div>
      <div class="panel panel-pad peso-hoy">
        {pesos.datos == null || planes.datos == null ? <span class="peso-cargando" aria-hidden="true" />
          : !ult ? <p class="peq secundario">Pésate por la mañana, en ayunas, y apúntalo aquí. Con unos días verás tu tendencia, que es lo que importa.</p>
          : conCifra ? (
            <div class="pila-xs">
              <div class="cifra"><span class="v num">{num(ult.tendencia)}</span><span class="u">kg de tendencia</span></div>
              <span class="ritmo">{ritmo ? <>{signo(ritmo.kgSemana, 2)} kg por semana ({signo(ritmo.pctSemana)} %)</> : deHoy ? `Hoy, ${num(deHoy.kg)} kg` : `Último: ${num(ult.kg)} kg`}</span>
            </div>
          ) : (
            <div class={`peso-estado ${e.tono}`}>
              <span class="peso-marca" aria-hidden="true"><Icono n={e.tono === 'ok' ? 'diana' : e.tono === 'aviso' ? 'alerta' : 'progreso'} /></span>
              <span class="pila-xs"><strong>{e.titulo}</strong><span class="mini secundario">{e.detalle}</span></span>
            </div>
          )}
        {deHoy ? <button class="chip ok" onClick={() => setAbierto(true)} aria-label={conCifra ? `Hoy ${num(deHoy.kg)} kilos. Cambiarlo` : 'Peso de hoy apuntado. Cambiarlo'}><Icono n="hecho" />{conCifra ? `Hoy ${num(deHoy.kg)}` : 'Apuntado'}</button>
          : <button class="btn btn-peq btn-primario" onClick={() => setAbierto(true)}><Icono n="bascula" /> Apuntar el de hoy</button>}
      </div>
      {abierto && (
        <HojaPeso inicial={deHoy?.kg ?? ult?.kg ?? null} alCerrar={() => setAbierto(false)} alGuardar={async (kg) => {
          // (pulido 3.9) sin conexión, se guarda en el móvil y se envía al volver (el aviso lo da useApuntar)
          const cambio = (xs) => [...xs.filter((x) => x.fecha !== hoy), { ...(xs.find((x) => x.fecha === hoy) || { id: `local-peso-${hoy}`, atleta_id: atleta.id, fecha: hoy }), kg: Number(kg) }].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
          try {
            const r = await pesos.alMomento(cambio, () => apuntar(atleta.id, 'peso', { fecha: hoy, kg: Number(kg) }, () => api.guardarPeso(atleta.id, hoy, kg)));
            if (!r?.enCola) aviso('Peso guardado');
            setAbierto(false);
          } catch (e) { aviso(e.message, 'error'); }
        }} />
      )}
    </section>
  );
}

function HojaPeso({ inicial, alCerrar, alGuardar }) {
  const [kg, setKg] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  return (
    <Hoja titulo="Peso de hoy" alCerrar={alCerrar}>
      <div class="campo">
        <label for="peso-hoy">Kilos, en ayunas</label>
        <Paso id="peso-hoy" valor={kg} paso={0.1} min={25} max={350} dec={1} etiqueta="peso en kilos" alCambiar={setKg} />
        <span class="ayuda">Por la mañana, después de ir al baño y antes de comer o beber. El peso de un día sube y baja con el agua y la sal: mira la tendencia, no la cifra suelta.</span>
      </div>
      <button class="btn btn-primario btn-grande" disabled={!kg || ocupado} onClick={async () => { setOcupado(true); await alGuardar(kg); setOcupado(false); }}>Guardar</button>
    </Hoja>
  );
}

// v0.50: el día de descanso: una idea para hoy (moverse un poco, movilidad, dormir, comer) y lo que viene
function HeroDescanso({ proxima, hoy, abrirSesion, abrirPlan }) {
  const idea = sugerenciaDescanso(hoy);
  return (
    <div class="pila">
      <div class="hero-sugerencia">
        <span class="hero-sugerencia-ico" aria-hidden="true"><Icono n={idea.icono} /></span>
        <span class="pila-xs"><strong>{idea.titulo}</strong><span class="peq">{idea.texto}</span></span>
      </div>
      <p class="hero-siguiente peq">
        {proxima ? <>Lo siguiente: <strong>{proxima.sesion.nombre}</strong>{proxima.dia ? `, ${cuandoDia(proxima.dia, hoy)}` : ''}.</> : 'Esta semana no tienes más sesiones. Descansar también es entrenar.'}
      </p>
      <span class="hero-acciones">
        {abrirPlan && <button class="btn btn-grande btn-hero" onClick={abrirPlan}><Icono n="calendario" /> Ver tu plan de la semana</button>}
        {proxima && <button class="btn btn-sobre-hero" onClick={() => abrirSesion(proxima.sesion.id)}><Icono n="play" /> Entrenar hoy igualmente</button>}
      </span>
    </div>
  );
}

// v0.50: la sesión de hoy ya está hecha: sus cifras (solo las sesiones hechas hoy, no el historial entero), «Ver
// resumen» y lo que viene (o lo que se quedó atrás)
function HeroHecha({ sesion, proxima, hoy, abrirSesion }) {
  const { api, atleta } = useApp();
  const res = useCarga(() => api.sesionesHechas(atleta.id, { desde: hoy }).then((l) => l.find((x) => x.id === sesion.id) || null).catch(() => null), [atleta.id, sesion.id]);
  const r = res.datos;
  const cifras = r ? [
    r.duracion_min ? ['min', r.duracion_min, 'min'] : null,
    r.series ? ['series', r.series, r.series === 1 ? 'serie' : 'series'] : null,
    r.tonelaje ? ['t', num(Math.round(r.tonelaje / 100) / 10, 1), 't'] : null,
  ].filter(Boolean) : [];
  return (
    <div class="pila">
      <p class="hero-hecha-nombre"><strong>{sesion.nombre}</strong></p>
      {cifras.length > 0 && (
        <dl class="hero-cifras">
          {cifras.map(([k, v, u]) => <div key={k}><dt class="sr">{u}</dt><dd><span class="num">{v}</span> <span class="u">{u}</span></dd></div>)}
        </dl>
      )}
      {proxima && (proxima.atrasada
        ? <p class="hero-siguiente peq">Te queda pendiente: <strong>{proxima.sesion.nombre}</strong>{proxima.dia ? ` (la tenías prevista ${cuandoDia(proxima.dia, hoy)})` : ''}.</p>
        : <p class="hero-siguiente peq">Lo siguiente: <strong>{proxima.sesion.nombre}</strong>{proxima.dia ? `, ${cuandoDia(proxima.dia, hoy)}` : ', cuando quieras'}.</p>)}
      <span class="hero-acciones">
        <button class="btn btn-grande btn-hero" onClick={() => abrirSesion(sesion.id)}><Icono n="hecho" /> Ver resumen</button>
        {proxima && <button class="btn btn-sobre-hero" onClick={() => abrirSesion(proxima.sesion.id)}><Icono n="play" /> Adelantar {proxima.sesion.nombre}</button>}
      </span>
    </div>
  );
}

// v0.50: aún no hay semana publicada: tu coach la está preparando
function HeroEspera({ bloque, notion, irA, propio }) {
  return (
    <section class="hero-dia hero-espera" aria-label="Tu semana, en camino">
      <Ilustracion n="espera" clase="hero-ilu" />
      <div class="titular">
        {bloque && <div class="contexto"><span>Bloque {bloque.numero}: {bloque.nombre}</span></div>}
        <span class="chip toca-hoy descanso"><Icono n="reloj" />En preparación</span>
        <h2>Tu semana está en camino</h2>
        <p class="peq secundario">Tu programa aún no está publicado: tu coach lo publicará aquí.{notion ? ' Mientras tanto, tu plan sigue en tu página de Notion.' : ''}</p>
      </div>
      <span class="hero-acciones">
        {notion ? <a class="btn btn-grande btn-hero" href={notion} target="_blank" rel="noopener"><Icono n="enlace" /> Abrir mi página de Notion</a>
          : !propio && <button class="btn btn-grande btn-hero" onClick={() => irA('mensajes')}><Icono n="mensaje" /> Escribir a tu coach</button>}
      </span>
    </section>
  );
}

// Lo que queda de la semana y la racha de semanas completas (v0.51: el anillo pasa al dial «Constancia», justo debajo)
// v0.52: la racha es un botón que abre su pantalla (como en Duolingo)
// v0.53: objetivo (días por semana, si lo tiene): las que le quedan para llegar a él, de lunes a domingo
function ResumenSemana({ hechas, total, racha, abrirRacha = null, objetivo = null, cargando = false }) {
  const quedan = Math.max(0, total - hechas);
  const empezar = objetivo ? `Llega a ${total} esta semana para empezar una racha de semanas completas.` : 'Termínalas todas para empezar una racha de semanas completas.';
  const texto = racha === 1 ? '1 semana completa' : `${racha} semanas completas seguidas`;
  return (
    <div class="semana-resumen sin-anillo">
      <div class="pila-xs">
        <strong>{quedan ? `Te ${quedan === 1 ? 'queda 1 sesión' : `quedan ${quedan} sesiones`}` : 'Semana completa'}</strong>
        {/* (pulido 2.3) la racha llega después (con la constancia): su línea ya tiene sitio */}
        <Reserva id="hoy-racha" liso cargando={cargando}>
        {racha > 0 ? (
          abrirRacha
            ? <button type="button" class="racha racha-boton" onClick={abrirRacha} aria-label={`${texto}. Ver tu racha`}><Icono n="llama" />{texto}<Icono n="derecha" class="racha-chevron" /></button>
            : <span class="racha"><Icono n="llama" />{texto}</span>
        ) : racha === 0 && quedan > 0 && (
          abrirRacha
            ? <button type="button" class="racha-boton racha-cero" onClick={abrirRacha}>{empezar}</button>
            : <span class="peq secundario">{empezar}</span>
        )}
        </Reserva>
      </div>
    </div>
  );
}

// resumen (v0.50, en Semana): los músculos que más trabaja, los minutos estimados y los pictogramas de sus ejercicios
export function DiaSesion({ sesion, semana = null, actual, abrir, mensajes, resumen = null, llegando = null }) {
  const hecha = sesion.completada;
  const previsto = !hecha && semana ? diaPrevistoValido(sesion, semana) : null;
  const conResumen = resumen && resumen.ejercicios > 0;
  const cuerpoResumen = conResumen && (
    <span class="dia-resumen">
      <span class="dia-pictos">{resumen.patrones.map((pt) => <Pictograma key={pt} patron={pt} />)}</span>
      <span class="dia-chips">
        {resumen.grupos.map((g) => <span key={g} class="chip-musculo">{NOMBRE_GRUPO[g] || g}</span>)}
        <span class="chip-min num"><Icono n="reloj" />{resumen.minutos ? `unos ${resumen.minutos} min` : `${resumen.ejercicios} ejercicios`}</span>
      </span>
    </span>
  );
  return (
    <button class={`dia ${hecha ? 'hecha' : ''} ${actual ? 'actual' : ''} ${conResumen ? 'con-resumen' : ''}`} onClick={abrir}>
      <span class="marca-dia">{hecha ? <Icono n="hecho" /> : sesion.orden}</span>
      <span class="dia-cuerpo">
        <span class="nombre">{sesion.nombre}</span>
        <span class="detalle">
          {hecha ? `Hecha el ${fmtConDia(sesion.fecha_realizada)}${cardioHechoValido(sesion.cardio_hecho) ? `, ${textoCardioHecho(sesion.cardio_hecho)}` : ''}${sesion.rpe_sesion ? `, esfuerzo ${sesion.rpe_sesion}/10` : ''}`
            : previsto ? `${actual ? 'Siguiente, prevista' : 'Prevista'} ${cuandoDia(previsto)}`
            : actual ? 'Siguiente' : sesion.tipo && sesion.tipo !== 'fuerza' ? NOMBRE_TIPO_SESION[sesion.tipo] : NOMBRE_INTENCION[sesion.intencion] || 'Pendiente'}
        </span>
        {/* (pulido 2.3) lo que trae la sesión llega después (en Semana; llegando dice si aún se espera): su sitio ya
            está, por el puesto de la sesión en la semana, y los días de debajo no bajan */}
        {llegando == null ? cuerpoResumen : <Reserva id={`dia-resumen-${sesion.orden}`} liso cargando={llegando}>{cuerpoResumen}</Reserva>}
      </span>
      {mensajes ? <span class="chip morado"><Icono n="mensaje" />Nuevo</span> : <Icono n="derecha" width="20" height="20" class="terciario" />}
    </button>
  );
}

function SiguienteSesion({ sesion, ejercicios, cargando }) {
  const etiquetas = etiquetasSuperserie(ejercicios);
  const cardio = cardioValido(sesion.cardio) ? sesion.cardio : null;
  if (!cargando && !ejercicios.length && !sesion.dinamica && !cardio) return null;
  return (
    <section class="seccion">
      <h2>Lo que vas a hacer</h2>
      {cardio && <TarjetaCardio pauta={cardio} hecho={sesion.cardio_hecho} completada={sesion.completada} sesionId={sesion.id} />}
      {cargando || ejercicios.length > 0 ? (
        <div class="panel lista-ejercicios-hoy">
          {cargando ? <Cargando /> : (
            <ul class="lista">
              {ejercicios.map((e) => {
                const pa = pauta(e);
                return (
                  <li class="ej-fila" key={e.id}>
                    <span class="ej-marca"><Imagen id={imagenEjercicio(e.ejercicio)} clase="miniatura-ej ej-mini" tamanos="40px" alternativa={<PictoEjercicio ejercicio={e.ejercicio} />} /><Disco prioridad={e.prioridad} titulo={NOMBRE_PRIORIDAD[e.prioridad]} /></span>
                    <div>
                      <div class="nombre">{etiquetas[e.id] && <span class="ss-etq">{etiquetas[e.id]}</span>}{e.ejercicio.nombre}</div>
                      <div class="pauta"><span class="num">{pa.series}</span>{pa.esfuerzo && <span>{pa.esfuerzo}</span>}{pa.carga && <span class="num">{pa.carga}</span>}{e.variante && <span>{e.variante}</span>}</div>
                    </div>
                    {e.hechas.length > 0 && <span class={`estado-series ${e.hechas.length >= e.series ? 'hecho' : ''}`} style={{ '--f': Math.min(1, e.hechas.length / (e.series || 1)) }}>{e.hechas.length}/{e.series}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : sesion.dinamica && <div class="nota-coach"><Icono n="mensaje" /><div style="white-space:pre-line">{sesion.dinamica}</div></div>}
      {ejercicios.length > 0 && <p class="mini terciario">El disco de color marca la prioridad: rojo obligatorio, azul muy importante, amarillo accesorio, verde prescindible.</p>}
    </section>
  );
}

export const diaSemana = (iso) => desdeISO(iso).getDay();
export { rangoSemana };


// (054) Las sesiones que la app cerró sola en los últimos 3 días: una tarjeta por sesión (hasta 2) para decir cómo fue;
// se quita al tocarla, al escribir la nota o al descartarla (y queda descartada en este móvil)
const VISTO_CIERRE = (id) => `fbe-cierre-visto-${id}`;
const vistoCierre = (id) => { try { return !!localStorage.getItem(VISTO_CIERRE(id)); } catch { return false; } };
function CerradasPorTi({ sesiones = [], hoy, abrirSesion }) {
  const [, setV] = useState(0);
  const xs = sesiones.filter((s) => s.completada && s.cerrada_sola_en && !s.nota_atleta && !vistoCierre(s.id)).map((s) => ({ s, c: textoCierreAuto(s, hoy) })).filter((x) => x.c).slice(0, 2);
  if (!xs.length) return null;
  const quitar = (id) => { try { localStorage.setItem(VISTO_CIERRE(id), '1'); } catch { /* nada */ } setV((v) => v + 1); };
  return (
    <>
      {xs.map(({ s, c }) => (
        <section key={s.id} class="panel panel-pad cierre-auto pila-xs" aria-label={c.titulo}>
          <div class="separa">
            <p class="peq"><strong>{c.titulo}</strong> · {c.texto}</p>
            <button type="button" class="btn btn-icono plano" aria-label="Descartar" onClick={() => quitar(s.id)}><Icono n="cerrar" /></button>
          </div>
          <button type="button" class="btn btn-peq btn-primario" style="justify-self:start" onClick={() => { quitar(s.id); abrirSesion(s.id); }}><Icono n="editar" /> Decir cómo fue</button>
        </section>
      ))}
    </>
  );
}
