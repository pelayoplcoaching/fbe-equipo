import { useEffect, useRef, useState } from 'preact/hooks';
import { Siluetas, useApp, useCarga, Icono, Disco, Cargando, Vacio, ErrorCaja, Marca, Hoja, Anillo, Paso, usePreferencia, cuando, Pista, Avatar } from '../comunes.jsx';
import { resumenDia } from '../../logica/dia.js';
import { BandaConexion, BandaDemo } from '../App.jsx';
import { Hilo } from '../Hilo.jsx';
import { VerArchivo } from '../Archivos.jsx';
import { TarjetaSemana, HistoriaSemana } from './TuSemana.jsx';
import { Bienvenida, PrimerosPasos } from './Bienvenida.jsx';
import { AvisoLogros } from '../Logros.jsx';
import { AvisosCoach } from '../Avisos.jsx';
import { InformeBloque, TarjetaBloque } from '../InformeBloque.jsx';
import { pauta, NOMBRE_FOCO, NOMBRE_INTENCION, NOMBRE_PRIORIDAD, NOMBRE_TIPO_SESION, etiquetasSuperserie, duracionEstimada, tendenciaPeso, ritmoPeso, num, signo } from '../../logica/calculos.js';
import { diaDeCheckin, fmtConDia, hoyISO, desdeISO, rangoSemana, diasEntre, sumarDias } from '../../logica/fechas.js';
import { queToca, diaPrevistoValido, cuandoDia } from '../../logica/plan.js';
import { PlanSemana } from './Plan.jsx';
import { HabitosHoy } from './Habitos.jsx';
import { TarjetaNotificaciones } from '../Notificaciones.jsx';
import { NutricionHoy } from './Nutricion.jsx';
import { HojaCuestionario, TarjetaCuestionario, pendiente } from './Cuestionario.jsx';
import { TarjetaCardio } from './Sesion.jsx';
import { cardioValido, cardioHechoValido, textoCardio, textoCardioHecho } from '../../logica/cardio.js';

// Minutos aproximados: cada serie ~40 s de trabajo más su descanso
export { duracionEstimada };

export function Hoy({ programa, abrirSesion, irA, checkinSemana, salud, noLeidos, releer, recargarConsentimientos }) {
  const { api, atleta, perfil } = useApp();
  const { datos: p, cargando, error, recargar } = programa;
  // Atleta nuevo: bienvenida (una vez) y primeros pasos hasta completarlos u ocultarlos
  const hechos = useCarga(() => api.primerosPasos(atleta.id).catch(() => null), [atleta.id, p, checkinSemana.datos]);
  // Cuestionario inicial: un paso de los primeros pasos y, si el coach lo pide, una tarjeta
  const cuestionario = useCarga(() => api.cuestionario(atleta.id).catch(() => null), [atleta.id]);
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
    { id: 'sesion', texto: 'Haz tu primera sesión', hecho: hechos.datos.sesion, etiqueta: 'Empezar', accion: siguienteId ? () => abrirSesion(siguienteId) : null },
    ...(salud ? [
      { id: 'peso', texto: 'Apunta tu peso', hecho: hechos.datos.peso, etiqueta: 'Apuntar', accion: () => { const el = document.querySelector('.peso-hoy button'); el?.scrollIntoView({ block: 'center' }); el?.click(); } },
      { id: 'checkin', texto: 'Envía tu primer check-in', hecho: hechos.datos.checkin, etiqueta: 'Ir', accion: () => irA('checkin') },
    ] : []),
    { id: 'faq', texto: 'Echa un vistazo a las preguntas frecuentes', hecho: faqVista, etiqueta: 'Ver', accion: () => { setFaqVista(true); irA('perfil'); } },
  ] : null;
  // Solo para quien acaba de llegar (su primer mes): a quien ya lleva tiempo no se le enseña
  const nuevo = !atleta.fecha_alta || diasEntre(atleta.fecha_alta, hoyISO()) <= 30;
  const verPasos = pasos && nuevo && !pasosOcultos && pasos.some((x) => !x.hecho);
  const verBienvenida = hechos.datos && !hechos.datos.sesion && !bienvenidaVista;

  return (
    <>
    <div class="contenido" inert={verBienvenida ? '' : undefined} aria-hidden={verBienvenida ? 'true' : undefined}>
      <header class="cabecera">
        <h1 class="sr">Hoy</h1>
        <div class="titulo"><Marca /></div>
        <span class="sub">{fmtConDia(hoyISO())}</span>
        <button class="btn-avatar" onClick={() => irA('perfil')} aria-label="Tu perfil"><Avatar nombre={atleta.nombre} foto={perfil?.foto} /></button>
      </header>
      <BandaDemo />
      <BandaConexion />
      <ErrorCaja error={error} reintentar={recargar} />
      {atleta.estado === 'baja' && (
        <div class="nota-coach"><Icono n="alerta" /><div>Tu cuenta está de baja: puedes ver tu historial y descargar tus datos desde Perfil, pero ya no se guarda nada nuevo. Si quieres volver, escribe a tu coach.</div></div>
      )}
      {verPasos ? <PrimerosPasos pasos={pasos} alOcultar={() => setPasosOcultos(true)} /> : <AvisoInstalar />}
      {(verPasos || (!p && !cargando)) && <AvisosCoach />}
      {cargando && !p ? <Siluetas forma="hoy" texto="Cargando tu programa" /> : p && (
        <Contenido p={p} atleta={atleta} abrirSesion={abrirSesion} irA={irA} checkinSemana={checkinSemana} salud={salud} noLeidos={noLeidos} recargar={() => recargar(true)}
          entre={(
            <>
              {!verPasos && <AvisosCoach />}
              {!verPasos && atleta.estado !== 'baja' && <TuDia p={p} salud={salud} checkinSemana={checkinSemana} abrirSesion={abrirSesion} irA={irA} abrirCuestionario={() => setVerCuestionario(true)} version={cuestionario.datos?.actualizado_en} />}
              {pendiente(cuestionario.datos) && !(verPasos && !hechos.datos?.cuestionario) && <TarjetaCuestionario cuestionario={cuestionario.datos} abrir={() => setVerCuestionario(true)} />}
              {noLeidos.some((c) => !api.esMensaje(c)) && <Respuestas noLeidos={noLeidos.filter((c) => !api.esMensaje(c))} programa={p} releer={releer} abrirSesion={abrirSesion} />}
              {!verPasos && hechos.datos?.sesion && <TarjetaNotificaciones />}
            </>
          )} />
      )}
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
const ICONO_DIA = { sesion: 'hoy', habitos: 'llama', nutricion: 'nutricion', peso: 'bascula', checkin: 'checkin', cuestionario: 'pregunta' };
function TuDia({ p, salud, checkinSemana, abrirSesion, irA, abrirCuestionario, version }) {
  const { api, atleta } = useApp();
  const dia = useCarga(() => api.tuDia(atleta.id, { programa: p, checkin: checkinSemana.datos, salud }).catch(() => null), [atleta.id, p, checkinSemana.datos, salud, version]);
  // Tras apuntar algo en cualquier parte de la pantalla (un hábito, la nutrición, el peso), la lista se pone al día
  const recargarRef = useRef(null);
  recargarRef.current = dia.recargar;
  useEffect(() => {
    let t = null;
    const alCambiar = () => { clearTimeout(t); t = setTimeout(() => recargarRef.current?.(true), 700); };
    window.addEventListener('fbe-cambio', alCambiar);
    return () => { clearTimeout(t); window.removeEventListener('fbe-cambio', alCambiar); };
  }, []);
  const items = dia.datos;
  if (!items || !items.length) return null;
  const r = resumenDia(items);
  const bajarA = (sel) => { const el = document.querySelector(sel); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.focus?.({ preventScroll: true }); } };
  const ir = (x) => {
    if (x.accion === 'sesion' && x.sesionId) abrirSesion(x.sesionId);
    else if (x.accion === 'sesion' || x.accion === 'semana' || x.accion === 'plan') bajarA('.semana-dias');
    else if (x.accion === 'habitos') bajarA('.seccion-habitos');
    else if (x.accion === 'nutricion') bajarA('.seccion-nutricion');
    else if (x.accion === 'peso') { const el = document.querySelector('.peso-hoy button'); el?.scrollIntoView({ block: 'center' }); if (!items.find((y) => y.id === 'peso' && y.estado === 'hecho')) el?.click(); }
    else if (x.accion === 'checkin') irA('checkin');
    else if (x.accion === 'cuestionario') abrirCuestionario();
  };
  return (
    <section class="panel tu-dia" aria-label="Tu día">
      <div class="panel-pad separa">
        <strong>Tu día</strong>
        {r && <span class="tu-dia-cuenta"><AnilloDia hechas={r.hechas} total={r.total} /><span class={`peq num ${r.todo ? 'texto-ok' : 'secundario'}`}>{r.todo ? 'Todo hecho' : `${r.hechas} de ${r.total}`}</span></span>}
      </div>
      <ul class="lista">
        {items.map((x) => (
          <li key={x.id}>
            <button class={`fila-dia ${x.estado}`} onClick={() => ir(x)}>
              <span class="dia-marca" aria-hidden="true">{x.estado === 'hecho' ? <Icono n="hecho" /> : <Icono n={ICONO_DIA[x.id] || 'hoy'} />}</span>
              <span class="pila-xs"><span class={x.estado === 'hecho' ? 'tachado' : ''}>{x.texto}</span><span class="mini terciario">{x.detalle}</span></span>
              <span class="sr">{x.estado === 'hecho' ? 'hecho' : x.estado === 'toca' ? 'pendiente' : ''}</span>
              {x.estado === 'toca' && <span class="punto-dia" aria-hidden="true" />}
              <Icono n="derecha" />
            </button>
          </li>
        ))}
      </ul>
      <Pista id="tu-dia">Esta lista es lo que te toca hoy. Lo demás de esta pantalla es detalle: puedes mirarlo o no.</Pista>
    </section>
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

function Contenido({ p, atleta, abrirSesion, irA, checkinSemana, salud, noLeidos, recargar, entre = null }) {
  const { api } = useApp();
  const constancia = useCarga(() => api.constancia(atleta.id).catch(() => null), [atleta.id, p]);
  const [planAbierto, setPlanAbierto] = useState(false);
  // Detalle de la siguiente sesión (ejercicios, duración): lo usan la tarjeta del día y la lista de debajo
  const hoy = hoyISO();
  const semana = p.actual;
  const sesiones = semana ? (p.sesiones[semana.id] || []) : [];
  const toca = semana ? queToca(sesiones, semana, hoy) : { siguiente: null };
  const siguiente = toca.siguiente;
  const det = useCarga(() => (siguiente ? api.sesion(siguiente.id, atleta.id) : Promise.resolve(null)), [siguiente?.id]);
  if (!p.bloque || !p.actual) {
    return (
      <>
        {entre}
        <div class="panel">
          <Vacio icono="semana" titulo="Tu programa aún no está publicado">
            Tu coach lo publicará aquí. Mientras tanto, tu plan sigue en tu página de Notion.
          </Vacio>
          {atleta.notion_url && <div class="panel-pad"><a class="btn btn-ancho" href={atleta.notion_url} target="_blank" rel="noopener">Abrir mi página de Notion</a></div>}
        </div>
        {salud && <NutricionHoy />}
      </>
    );
  }
  // Con plan: la de hoy, una atrasada o la próxima prevista; sin plan, la primera pendiente
  const enSemana = !!semana.fecha_inicio && semana.fecha_inicio <= hoy && hoy <= sumarDias(semana.fecha_inicio, 6);
  const descanso = enSemana && toca.descanso;
  const previsto = siguiente && diaPrevistoValido(siguiente, semana);
  const hechas = sesiones.filter((s) => s.completada).length;
  const checkinHecho = !!checkinSemana.datos?.checkin;
  const conMensajes = new Set(noLeidos.map((c) => c.sesion_id).filter(Boolean));

  const ejercicios = det.datos?.ejercicios || [];
  const empezada = ejercicios.some((e) => e.hechas.length);

  return (
    <>
      <section class="hero-dia" aria-label="Tu sesión de hoy">
        <div class="titular">
          <div class="contexto">
            <span>Bloque {p.bloque.numero}: {p.bloque.nombre}</span>
            <span>Semana {semana.numero}</span>
            {semana.foco && <span>Foco: {NOMBRE_FOCO[semana.foco]?.toLowerCase()}</span>}
          </div>
          {enSemana && toca.hoy && !descanso && <span class="chip toca-hoy"><Icono n="calendario" />Hoy toca</span>}
          {descanso && <span class="chip toca-hoy descanso"><Icono n="sueno" />Día de descanso</span>}
          <h2>{descanso ? 'Hoy descansas' : siguiente ? siguiente.nombre : 'Semana completada'}</h2>
          {!descanso && !toca.hoy && previsto && <p class="peq secundario">{previsto > hoy ? `Prevista para ${cuandoDia(previsto, hoy)}.` : `La tenías prevista ${cuandoDia(previsto, hoy)}.`}</p>}
        </div>
        {semana.nota_coach && (
          <div class="nota-coach"><Icono n="mensaje" /><div><strong>Tu coach: </strong>{semana.nota_coach}</div></div>
        )}
        {descanso ? (
          <div class="descanso-hoy">
            <Icono n="sueno" />
            <div class="pila-s">
              <p><strong>Descansar también es entrenar.</strong> Tu próxima sesión es <strong>{toca.proxima.sesion.nombre}</strong>, {cuandoDia(toca.proxima.dia, hoy)}.</p>
              <span class="hero-acciones">
                <button class="btn btn-sobre-hero" onClick={() => abrirSesion(toca.proxima.sesion.id)}><Icono n="play" /> Entrenar hoy igualmente</button>
                <button class="btn btn-sobre-hero" onClick={() => setPlanAbierto(true)}><Icono n="calendario" /> Cambiar el plan</button>
              </span>
            </div>
          </div>
        ) : siguiente ? (
          <>
            {(ejercicios.length > 0 || siguiente.dinamica || cardioValido(siguiente.cardio)) && (
              <div class="hero-meta">
                {cardioValido(siguiente.cardio) && <span><b>{textoCardio(siguiente.cardio)}</b></span>}
                {ejercicios.length > 0 && <><span><b>{ejercicios.length}</b> ejercicios</span><span>unos <b>{duracionEstimada(ejercicios)}</b> min</span></>}
                {empezada && <span><b>{ejercicios.reduce((n, e) => n + e.hechas.length, 0)}</b> series ya hechas</span>}
              </div>
            )}
            <div class="hero-acciones">
              <button class="btn btn-grande btn-hero" onClick={() => abrirSesion(siguiente.id)}>
                <Icono n="play" /> {empezada ? 'Continuar sesión' : 'Empezar sesión'}
              </button>
            </div>
          </>
        ) : (
          <div class="pila-s">
            <p class="peq">Has hecho las {hechas} sesiones de esta semana.</p>
            {salud && !checkinHecho && <div class="hero-acciones"><button class="btn btn-grande btn-hero" onClick={() => irA('checkin')}><Icono n="checkin" /> Hacer el check-in semanal</button></div>}
            {checkinHecho && <p class="peq secundario">Check-in de la semana enviado. Tu coach prepara lo siguiente con lo que has registrado.</p>}
          </div>
        )}
        {sesiones.length > 0 && <ResumenSemana hechas={hechas} total={sesiones.length} racha={constancia.datos?.racha ?? null} />}
      </section>

      {entre}
      <BloqueTerminado salud={salud} />
      <SemanaPasada salud={salud} />
      {!descanso && siguiente && <SiguienteSesion sesion={siguiente} ejercicios={ejercicios} cargando={det.cargando && !det.datos} />}

      <section class="seccion">
        <div class="seccion-cab">
          <h2>Esta semana</h2>
          {enSemana && sesiones.some((s) => !s.completada) && <button class="btn-texto" onClick={() => setPlanAbierto(true)}><Icono n="calendario" /> {sesiones.some((s) => diaPrevistoValido(s, semana)) ? 'Tu plan' : 'Planificar'}</button>}
        </div>
        <div class="semana-dias">
          {sesiones.map((s) => <DiaSesion key={s.id} sesion={s} semana={semana} actual={!descanso && s.id === siguiente?.id} mensajes={conMensajes.has(s.id)} abrir={() => abrirSesion(s.id)} />)}
        </div>
      </section>
      {planAbierto && (
        <Hoja titulo={`Tu plan, ${rangoSemana(semana.fecha_inicio)}`} alCerrar={() => setPlanAbierto(false)}>
          <PlanSemana semana={semana} sesiones={sesiones} alCambiar={recargar} compacto />
        </Hoja>
      )}

      {salud && <NutricionHoy entrenaHoy={enSemana && (!!toca.hoy || sesiones.some((s) => s.completada && s.fecha_realizada === hoy))} />}

      {salud && <HabitosHoy />}

      {salud && <PesoHoy irA={irA} />}

      {salud && !checkinHecho && siguiente && diaDeCheckin() && (
        <button class="nota-coach" style="border:0;text-align:left;cursor:pointer" onClick={() => irA('checkin')}>
          <Icono n="checkin" /><div><strong>Check-in semanal pendiente.</strong> Un minuto: peso, sueño, energía y molestias.</div>
        </button>
      )}
    </>
  );
}

// La semana pasada en una tarjeta, hasta que la ves o la ocultas
// Al terminar un bloque (hasta 3 semanas después), su informe en una tarjeta
function BloqueTerminado({ salud }) {
  const { api, atleta } = useApp();
  const [visto, setVisto] = usePreferencia('fbe-informe-visto', null);
  const [abierto, setAbierto] = useState(false);
  const res = useCarga(() => api.informes(atleta.id, { salud }).catch(() => []), [atleta.id]);
  const r = (res.datos || []).find((x) => x.terminado && !x.vacio && diasEntre(x.fin, hoyISO()) <= 21);
  if (!r || (visto === r.bloque.id && !abierto)) return null;
  return (
    <>
      <TarjetaBloque informe={r} alAbrir={() => setAbierto(true)} alQuitar={() => setVisto(r.bloque.id)} />
      {abierto && <InformeBloque informe={r} salud={salud} alCerrar={() => { setAbierto(false); setVisto(r.bloque.id); }} />}
    </>
  );
}

function SemanaPasada({ salud }) {
  const { api, atleta } = useApp();
  const [vista, setVista] = usePreferencia('fbe-tu-semana-vista', null);
  const [abierta, setAbierta] = useState(false);
  const res = useCarga(() => api.resumenesSemanales(atleta.id, 1).catch(() => []), [atleta.id]);
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
  const pesos = useCarga(() => api.pesos(atleta.id, 60).catch(() => []), [atleta.id]);
  const [abierto, setAbierto] = useState(false);
  const serie = tendenciaPeso(pesos.datos || []);
  const ult = serie[serie.length - 1];
  const hoy = hoyISO();
  const deHoy = ult?.fecha === hoy ? ult : null;
  const ritmo = ritmoPeso(serie);
  return (
    <section class="seccion">
      <div class="seccion-cab"><h2>Tu peso</h2>{serie.length > 1 && <button class="btn-texto" onClick={() => irA('progreso')}>Ver la gráfica</button>}</div>
      <div class="panel panel-pad peso-hoy">
        {ult ? (
          <div class="pila-xs">
            <div class="cifra"><span class="v num">{num(ult.tendencia)}</span><span class="u">kg de tendencia</span></div>
            <span class="ritmo">{ritmo ? <>{signo(ritmo.kgSemana, 2)} kg por semana ({signo(ritmo.pctSemana)} %)</> : deHoy ? `Hoy, ${num(deHoy.kg)} kg` : `Último: ${num(ult.kg)} kg`}</span>
          </div>
        ) : <p class="peq secundario">Pésate por la mañana, en ayunas, y apúntalo aquí. Con unos días verás tu tendencia, que es lo que importa.</p>}
        {deHoy ? <button class="chip ok" onClick={() => setAbierto(true)} aria-label={`Hoy ${num(deHoy.kg)} kilos. Cambiarlo`}><Icono n="hecho" />Hoy {num(deHoy.kg)}</button>
          : <button class="btn btn-peq btn-primario" onClick={() => setAbierto(true)}><Icono n="bascula" /> Apuntar el de hoy</button>}
      </div>
      {abierto && (
        <HojaPeso inicial={deHoy?.kg ?? ult?.kg ?? null} alCerrar={() => setAbierto(false)} alGuardar={async (kg) => {
          try { await api.guardarPeso(atleta.id, hoy, kg); aviso('Peso guardado'); setAbierto(false); pesos.recargar(true); }
          catch (e) { aviso(e.message, 'error'); }
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

// Anillo de la semana y racha de semanas completas
function ResumenSemana({ hechas, total, racha }) {
  const quedan = total - hechas;
  return (
    <div class="semana-resumen">
      <Anillo hechas={hechas} total={total} />
      <div class="pila-xs">
        <strong>{quedan ? `Te ${quedan === 1 ? 'queda 1 sesión' : `quedan ${quedan} sesiones`}` : 'Semana completa'}</strong>
        {racha > 0 ? (
          <span class="racha"><Icono n="llama" />{racha === 1 ? '1 semana completa' : `${racha} semanas completas seguidas`}</span>
        ) : racha === 0 && quedan > 0 && (
          <span class="peq secundario">Termínalas todas para empezar una racha de semanas completas.</span>
        )}
      </div>
    </div>
  );
}

export function DiaSesion({ sesion, semana = null, actual, abrir, mensajes }) {
  const hecha = sesion.completada;
  const previsto = !hecha && semana ? diaPrevistoValido(sesion, semana) : null;
  return (
    <button class={`dia ${hecha ? 'hecha' : ''} ${actual ? 'actual' : ''}`} onClick={abrir}>
      <span class="marca-dia">{hecha ? <Icono n="hecho" /> : sesion.orden}</span>
      <span>
        <span class="nombre">{sesion.nombre}</span><br />
        <span class="detalle">
          {hecha ? `Hecha el ${fmtConDia(sesion.fecha_realizada)}${cardioHechoValido(sesion.cardio_hecho) ? `, ${textoCardioHecho(sesion.cardio_hecho)}` : ''}${sesion.rpe_sesion ? `, esfuerzo ${sesion.rpe_sesion}/10` : ''}`
            : previsto ? `${actual ? 'Siguiente, prevista' : 'Prevista'} ${cuandoDia(previsto)}`
            : actual ? 'Siguiente' : sesion.tipo && sesion.tipo !== 'fuerza' ? NOMBRE_TIPO_SESION[sesion.tipo] : NOMBRE_INTENCION[sesion.intencion] || 'Pendiente'}
        </span>
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
      {cardio && <TarjetaCardio pauta={cardio} hecho={sesion.cardio_hecho} completada={sesion.completada} />}
      {cargando || ejercicios.length > 0 ? (
        <div class="panel lista-ejercicios-hoy">
          {cargando ? <Cargando /> : (
            <ul class="lista">
              {ejercicios.map((e) => {
                const pa = pauta(e);
                return (
                  <li class="ej-fila" key={e.id}>
                    <Disco prioridad={e.prioridad} titulo={NOMBRE_PRIORIDAD[e.prioridad]} />
                    <div>
                      <div class="nombre">{etiquetas[e.id] && <span class="ss-etq">{etiquetas[e.id]}</span>}{e.ejercicio.nombre}</div>
                      <div class="pauta"><span class="num">{pa.series}</span>{pa.esfuerzo && <span>{pa.esfuerzo}</span>}{pa.carga && <span class="num">{pa.carga}</span>}{e.variante && <span>{e.variante}</span>}</div>
                    </div>
                    {e.hechas.length > 0 && <span class={`estado-series ${e.hechas.length >= e.series ? 'hecho' : ''}`}>{e.hechas.length}/{e.series}</span>}
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
