import { useEffect, useRef, useState } from 'preact/hooks';
import { useCambioDeDia, Siluetas, useApp, useCarga, Icono, Marca, Insignia, usePildora, medirPantalla } from '../comunes.jsx';
import { hitoArranque } from '../../rendimiento.js';
import { conTransicion } from '../transiciones.js';
import { usePosicion, subirArriba } from '../posiciones.js';
import { useAtras, ponerRuta } from '../atras.js';
import { Mensajes } from './Mensajes.jsx';
import { Hoy } from './Hoy.jsx';
import { Sesion } from './Sesion.jsx';
import { Semana } from './Semana.jsx';
import { Progreso } from './Progreso.jsx';
import { Perfil } from './Perfil.jsx';
import { Comidas, Recetas } from './Comidas.jsx';
import { hayRecetarioEquipo } from '../../datos/recetario-equipo.js';
import { leerVistoEquipo } from '../comunidad-local.js';
import { perezoso, precargarEnReposo } from '../perezoso.jsx';
import { conEntrenamiento, conNutricion } from '../../logica/nivel.js';
import { TextoPrivacidad } from '../Acceso.jsx';
import { AvisoPrivacidad } from '../AvisoPrivacidad.jsx';
import { AvisoNovedades, prepararVersionVista } from '../Novedades.jsx';
import { programaConCola, CLAVES_COPIA } from '../../logica/sin-red.js';
import { usePendientesArchivos, BandaPendientes, PildoraSubida } from '../Pendientes.jsx';
import { TEXTO_CONSENTIMIENTO_SALUD } from '../../legal.js';
import { hoyISO, semanaCheckin, diaDeCheckin } from '../../logica/fechas.js';
import { RecibirCompartido, limpiarDireccion } from '../Compartido.jsx';
import { ponerInsignia } from '../insignia-app.js';
import { queToca } from '../../logica/plan.js';
import { tareasDelDia } from '../../logica/tareas.js';
import { ActividadSesion, useEnCurso, comprobarEnCurso } from './EnCurso.jsx';
import { estadoActividad } from '../../logica/actividad.js';
import { leerEnlaceVideo } from '../../logica/tecnica.js';
import { repartirPestanas, PREFERIDAS_ATLETA } from '../../logica/pestanas.js';
import { useEstrecha, BotonMas, HojaMas } from '../BarraMas.jsx';
import { VideoEnlazado } from '../tecnica/MiTecnica.jsx';
import { leerAjustes, EVENTO_AJUSTES } from '../ajustes.js';
import { fijarUnidadPeso } from '../../logica/unidades.js';

// (pulido 2.10) Equipo (el muro, los retos, el ranking: lo más grande después del chat) y el check-in de la semana se
// cargan al abrirlos, y por detrás en cuanto la app se queda quieta: no hacen falta para arrancar
const Equipo = perezoso(() => import('../Comunidad.jsx'), 'Equipo');
const Checkin = perezoso(() => import('./Checkin.jsx'), 'Checkin');

// Perfil solo está en la barra en pantallas anchas; en el móvil se abre desde el avatar de arriba (como en cualquier app).
// Comidas (v0.26), a quien le llevas la nutrición; Semana, a quien le llevas el entrenamiento. Equipo (v0.43), solo con
// la comunidad abierta y a quien no está de baja.
// Pulido 9: las pestañas de consulta, donde tirar hacia abajo pone al día lo que se ve (ui/tirar.js)
const TIRAR = ['hoy', 'semana', 'progreso', 'comidas', 'equipo'];
const TODAS = [
  ['hoy', 'Hoy', 'hoy'], ['semana', 'Semana', 'semana'], ['comidas', 'Comidas', 'receta'], ['recetas', 'Recetas', 'receta'], ['checkin', 'Check-in', 'checkin'],
  ['progreso', 'Progreso', 'progreso'], ['mensajes', 'Mensajes', 'mensaje'], ['equipo', 'Equipo', 'equipo'], ['perfil', 'Perfil', 'perfil'],
];
// (055) «Recetas»: el recetario del equipo, para quien no tiene Comidas (ahí va dentro) y solo si hay recetas
export const pestanasAtleta = (atleta, { equipo = false, recetas = false } = {}) => TODAS.filter(([t]) => (t !== 'semana' || conEntrenamiento(atleta)) && (t !== 'comidas' || conNutricion(atleta))
  && (t !== 'recetas' || (recetas && !conNutricion(atleta)))
  && (t !== 'equipo' || (equipo && atleta?.estado !== 'baja')));
// Modo atleta del coach (v0.37): solo el entrenamiento (sin check-in, mensajes, perfil ni nutrición, que son cosas
// entre atleta y coach), y una pestaña para volver a la vista de coach
const PESTANAS_PROPIO = [['hoy', 'Hoy', 'hoy'], ['semana', 'Semana', 'semana'], ['progreso', 'Progreso', 'progreso']];

function tabInicial(tabs) {
  const h = (typeof location !== 'undefined' ? location.hash : '').slice(1);
  // (v0.57) el vídeo de un aviso (#videos/<id>@<s>) se abre sobre Progreso
  if (leerEnlaceVideo(`#${h}`) && tabs.some(([t]) => t === 'progreso')) return 'progreso';
  return tabs.some(([t]) => t === h) ? h : 'hoy';
}

export function AtletaApp() {
  const { api, atleta, aviso, propio, salirModoAtleta, cola } = useApp();
  // v0.112: kilos o libras para las cargas del entreno (el ajuste de este móvil, Perfil → Este móvil); el modo atleta del
  // coach, en kilos. Al cambiarlo, se vuelve a pintar todo con la unidad nueva
  const [, setUnidad] = useState(() => fijarUnidadPeso(propio ? 'kg' : leerAjustes().unidadPeso));
  useEffect(() => {
    if (propio) return undefined;
    const leer = () => setUnidad(fijarUnidadPeso(leerAjustes().unidadPeso));
    window.addEventListener(EVENTO_AJUSTES, leer);
    return () => window.removeEventListener(EVENTO_AJUSTES, leer);
  }, [propio]);
  // (v0.65) la versión de la app que vio esta cuenta en este móvil (para «Novedades»), antes de nada; y el aviso de privacidad
  // va primero: las novedades esperan a que no esté (y a estar en Hoy, fuera de una sesión)
  useState(() => { if (!propio) prepararVersionVista(api.uid()); });
  const [privacidadLista, setPrivacidadLista] = useState(false);
  // Vídeos guardados en el móvil sin cobertura: se envían solos (en cualquier pestaña)
  const pendientesArchivos = usePendientesArchivos(api, atleta?.id, aviso);
  // La comunidad (v0.43): la pestaña Equipo solo si está abierta (sin la migración 027, nunca). El coach la puede
  // cerrar con la app abierta: se vuelve a mirar al volver a la app.
  const comunidad = useCarga(() => (propio || atleta.estado === 'baja' ? Promise.resolve({ activa: false }) : api.comunidad()), [atleta.id, atleta.estado]);
  // (pulido 2.10) con la app ya quieta, se van trayendo por detrás las pantallas que se cargan al abrirlas
  useEffect(() => precargarEnReposo([...(comunidad.datos?.activa ? [Equipo] : []), Checkin]), [!!comunidad.datos?.activa]);
  useEffect(() => {
    const al = () => { if (document.visibilityState === 'visible') comunidad.recargar(true); };
    document.addEventListener('visibilitychange', al);
    return () => document.removeEventListener('visibilitychange', al);
  }, []);
  const equipo = !!comunidad.datos?.activa;
  // v0.47: cuántas publicaciones nuevas de los demás hay desde su última visita al muro (lo recuerda este móvil),
  // solo con la comunidad abierta y estando dentro
  const [nuevasEquipo, setNuevasEquipo] = useState(0);
  // (055) ¿hay recetario del equipo? Solo hace falta saberlo para quien no lleva la nutrición (su pestaña «Recetas»)
  const { backend } = useApp();
  const hayRecetas = useCarga(() => (propio || conNutricion(atleta) ? Promise.resolve(false) : hayRecetarioEquipo({ backend }).catch(() => false)), [atleta.id], { recuerdo: `hay-recetario-equipo:${atleta.id}` });
  const TABS = propio ? PESTANAS_PROPIO : pestanasAtleta(atleta, { equipo, recetas: !!hayRecetas.datos });
  const tabsRef = useRef(TABS);
  tabsRef.current = TABS;
  const inicial = useRef(typeof location !== 'undefined' ? location.hash.slice(1) : '');
  const [tab, setTab] = useState(() => tabInicial(TABS));
  const [videoEnlace, setVideoEnlace] = useState(() => (typeof location !== 'undefined' && !propio ? leerEnlaceVideo(location.hash) : null));
  // Si el coach cambia su servicio (o cierra la comunidad) con la app abierta y la pestaña ya no está, a Hoy; si
  // se abrió la app en #equipo (una notificación), se va ahí en cuanto se sabe que está abierta
  useEffect(() => {
    if (equipo && inicial.current === 'equipo') { inicial.current = ''; setTab('equipo'); return; }
    // (055) y en #recetas, en cuanto se sabe que hay recetario del equipo
    if (hayRecetas.datos && inicial.current === 'recetas') { inicial.current = ''; setTab('recetas'); return; }
    if (!comunidad.cargando && !TABS.some(([t]) => t === tab)) setTab('hoy');
  }, [atleta.entrenamiento, atleta.nutricion, equipo, comunidad.cargando, hayRecetas.datos]);
  useEffect(() => {
    if (!equipo || propio) { setNuevasEquipo(0); return undefined; }
    let vivo = true;
    const contar = () => {
      const desde = leerVistoEquipo(api.uid());
      if (!desde) { setNuevasEquipo(0); return; }
      api.novedadesComunidad(desde).then((n) => { if (vivo) setNuevasEquipo(n); }).catch(() => {});
    };
    contar();
    const al = () => { if (document.visibilityState === 'visible') contar(); };
    window.addEventListener('fbe-equipo-visto', contar);
    document.addEventListener('visibilitychange', al);
    return () => { vivo = false; window.removeEventListener('fbe-equipo-visto', contar); document.removeEventListener('visibilitychange', al); };
  }, [equipo, propio, tab]);
  const [sesionId, setSesionId] = useState(null);
  // (pulido 3.8) al abrir la app salen de la copia del móvil; lo de la base llega enseguida («fbe-copia») y se pone en su sitio
  const consentimientos = useCarga(() => api.consentimientos(), [], { copia: CLAVES_COPIA.consentimientos() });
  // Si la app se queda abierta de un día para otro (o se vuelve a ella por la mañana), todo se recalcula con el día nuevo
  const [dia, setDia] = useState(hoyISO);
  useCambioDeDia(setDia);
  // (v0.65) con lo marcado sin conexión encima (una sesión terminada sin cobertura sale terminada); sin red, de la copia del móvil,
  // y lo de la base, en cuanto llega
  const conCola = (p) => programaConCola(p, cola.operaciones());
  const programa = useCarga(() => api.programa(atleta.id).then(conCola), [atleta.id, dia], { copia: CLAVES_COPIA.programa(atleta.id), transformar: conCola });
  // (pulido 4, rendimiento) la app ha arrancado cuando el programa está: de abrir la página a aquí, «arranque»
  useEffect(() => { if (!programa.cargando) hitoArranque(); }, [programa.cargando]);
  const checkinSemana = useCarga(() => (propio ? Promise.resolve(null) : api.checkin(atleta.id, semanaCheckin(hoyISO()))), [atleta.id, dia]);
  const noLeidos = useCarga(() => (propio ? Promise.resolve([]) : api.noLeidos(atleta.id).catch(() => [])), [atleta.id, dia]);
  // v0.48: las tareas del coach que ya tocan (para el número del icono de la app)
  const tareas = useCarga(() => (propio ? Promise.resolve([]) : api.tareas(atleta.id)), [atleta.id, dia, tab]);
  useEffect(() => {
    let t = null;
    const al = () => { clearTimeout(t); t = setTimeout(() => tareas.recargar(true), 800); };
    window.addEventListener('fbe-cambio', al);
    return () => { clearTimeout(t); window.removeEventListener('fbe-cambio', al); };
  }, []);
  // v0.48: el acceso directo «Empezar la sesión de hoy» (?accion=sesion): en cuanto está el programa, a la sesión que toca
  const accion = useRef(typeof location !== 'undefined' ? new URLSearchParams(location.search).get('accion') : null);
  useEffect(() => {
    if (accion.current !== 'sesion' || !programa.datos) return;
    accion.current = null;
    limpiarDireccion(['accion']);
    const p = programa.datos;
    const sig = p.actual ? queToca(p.sesiones[p.actual.id] || [], p.actual).siguiente : null;
    if (sig && conEntrenamiento(atleta)) setSesionId(sig.id);
  }, [programa.datos]);

  // (v0.65) Tras una visita con conexión, la semana se queda en el móvil (las sesiones que quedan, con «ant.», marcas y
  // recordatorios), sin estorbar a lo que se está pintando; al volver la cobertura, Hoy se pone al día solo
  useEffect(() => {
    if (!programa.datos) return undefined;
    const t = setTimeout(() => { Promise.resolve(api.prepararSinRed?.(programa.datos)).catch(() => {}); }, 3000);
    return () => clearTimeout(t);
  }, [programa.datos]);
  useEffect(() => {
    const vuelve = () => { programa.recargar(true); noLeidos.recargar(true); };
    window.addEventListener('online', vuelve);
    return () => window.removeEventListener('online', vuelve);
  }, []);

  useEffect(() => {
    ponerRuta(`#${tab}`);
  }, [tab]);
  // Pulido 2: cada pestaña recuerda por dónde iba (al volver de otra o al cerrar una sesión); la sesión y el chat, no
  usePosicion(sesionId ? `sesion:${sesionId}` : tab, !sesionId && tab !== 'mensajes');
  // Pulido 3: «atrás» en el móvil cierra la sesión abierta y, si no, vuelve a la primera pestaña (las ventanas se
  // cierran solas antes: atras.js). (Lo que hace cada uno se define más abajo, tras los retornos tempranos)
  const alAtras = useRef({});
  useAtras(!sesionId && tab !== TABS[0]?.[0], () => alAtras.current.inicio?.(), 0);
  useAtras(!!sesionId, () => alAtras.current.sesion?.(), 1);
  // Al tocar una notificación con la app abierta, se va a su pestaña; si llega una, se ponen al día las respuestas
  useEffect(() => {
    // (con una sesión abierta no se sale de ella: la pestaña queda elegida para cuando la cierre)
    const ir = () => {
      const h = location.hash.slice(1);
      const v = leerEnlaceVideo(location.hash);
      if (v && !propio) { if (tabsRef.current.some(([t]) => t === 'progreso')) setTab('progreso'); setVideoEnlace(v); noLeidos.recargar(true); return; }
      if (tabsRef.current.some(([t]) => t === h)) { setTab(h); noLeidos.recargar(true); }
    };
    const llega = () => { noLeidos.recargar(true); programa.recargar(true); };
    window.addEventListener('hashchange', ir);
    window.addEventListener('fbe-notificacion', llega);
    return () => { window.removeEventListener('hashchange', ir); window.removeEventListener('fbe-notificacion', llega); };
  }, []);

  if (consentimientos.cargando && !consentimientos.datos) return <div class="app"><div class="contenido"><Siluetas forma="hoy" /></div></div>;
  const activos = (consentimientos.datos || []).filter((c) => !c.revocado_en);
  // El coach en su modo atleta no ve la pantalla de consentimientos: los dejó al crear su ficha
  if (!propio && consentimientos.datos && !activos.some((c) => c.tipo === 'privacidad')) {
    return <Consentimiento alTerminar={() => consentimientos.recargar()} />;
  }
  const salud = activos.some((c) => c.tipo === 'datos_salud');
  const checkinPendiente = salud && checkinSemana.datos && !checkinSemana.datos.checkin && diaDeCheckin();

  // A quien solo lleva la nutrición no se le abren sesiones (una respuesta antigua en una sesión se lee en Mensajes)
  // v0.49: abrir y cerrar la sesión, y cambiar de pestaña, con una transición corta (donde se puede)
  // v0.52: desde la tarjeta de Hoy, su título pasa al de la portada (o al de la sesión, si ya está empezada)
  // (diseño, tanda 19) desde la tarjeta de Hoy viajan el título y el dibujo de la sesión (arte: el .hero-arte de la tarjeta)
  const abrirSesion = (id, titulo = null, arte = null) => {
    if (!conEntrenamiento(atleta)) { setTab('mensajes'); return; }
    medirPantalla('sesion');
    const compartidos = [];
    if (titulo) compartidos.push({ nombre: 'vt-titulo-sesion', desde: titulo, hasta: '.portada-sesion h1, .sesion-vista > .cabecera h1' });
    if (arte) compartidos.push({ nombre: 'vt-arte-sesion', desde: arte, hasta: '.portada-sesion .portada-arte' });
    conTransicion(() => { setSesionId(id); window.scrollTo(0, 0); }, 'abrir', compartidos.length ? compartidos : null);
  };
  const cerrarSesion = () => { conTransicion(() => setSesionId(null), 'cerrar'); programa.recargar(true); noLeidos.recargar(true); };
  const irAPestana = (id) => {
    if (id === tab) { subirArriba(); return; }   // tocar la pestaña en la que ya se está: arriba
    const orden = TABS.map(([t]) => t);
    medirPantalla(id);
    conTransicion(() => setTab(id), orden.indexOf(id) < orden.indexOf(tab) ? 'atras' : 'adelante');
  };
  const releer = () => noLeidos.recargar(true);
  alAtras.current = { inicio: () => irAPestana(TABS[0][0]), sesion: cerrarSesion };

  // Los mensajes sueltos del coach cuentan en Mensajes; los de sesiones, check-ins y vídeos, en Hoy
  const mensajesSinLeer = (noLeidos.datos || []).filter((c) => api.esMensaje(c)).length;
  const respuestasSueltas = (noLeidos.datos || []).some((c) => !api.esMensaje(c));
  // El número del icono (v0.48): lo sin leer de tu coach y lo que tienes pendiente (sus tareas y el check-in)
  const pendientesTareas = tareasDelDia(tareas.datos || []).filter((t) => !t.hecha_en).length;
  const insignia = (noLeidos.datos || []).length + pendientesTareas + (checkinPendiente ? 1 : 0);
  const compartido = {
    programa, salud, recargarConsentimientos: () => consentimientos.recargar(true), irA: irAPestana, abrirSesion, checkinSemana,
    noLeidos: noLeidos.datos || [], releer,
  };
  return (
    <>
      <Pantallas {...{ sesionId, pendientesArchivos, propio, compartido, cerrarSesion, releer, salud, tab, dia, TABS, checkinPendiente, respuestasSueltas, mensajesSinLeer, nuevasEquipo, irAPestana, salirModoAtleta, insignia, atletaId: atleta.id }} />
      {videoEnlace && <VideoEnlazado key={`${videoEnlace.id}@${videoEnlace.t}`} id={videoEnlace.id} t={videoEnlace.t} alCerrar={() => setVideoEnlace(null)} />}
      {/* (v0.56) las novedades de la política, una vez (el coach en su modo atleta, no) */}
      {!propio && <AvisoPrivacidad alTerminar={() => setPrivacidadLista(true)} />}
      {/* (v0.65) y después, las de la app tras actualizarla: en Hoy, nunca en mitad de una sesión */}
      {!propio && privacidadLista && !sesionId && tab === 'hoy' && <AvisoNovedades uid={api.uid()} rol="atleta" />}
    </>
  );
}

// La pantalla: la sesión abierta o la pestaña elegida con la barra de abajo (aparte, para la píldora de la barra)
function Pantallas({ sesionId, pendientesArchivos, propio, compartido, cerrarSesion, releer, salud, tab, dia, TABS, checkinPendiente, respuestasSueltas, mensajesSinLeer, nuevasEquipo, irAPestana, salirModoAtleta, insignia, atletaId }) {
  // En el móvil la barra tiene cinco huecos: las cuatro de cada día y «Más» con el resto (en pantallas anchas caben todas)
  const estrecha = useEstrecha();
  const reparto = repartirPestanas(TABS, PREFERIDAS_ATLETA, { estrecha });
  const [verMas, setVerMas] = useState(false);
  useEffect(() => { if (!estrecha) setVerMas(false); }, [estrecha]);   // al ensanchar la pantalla, «Más» deja de existir
  const enMas = (id) => reparto.mas.some(([t]) => t === id);
  const nuevasEnMas = enMas('equipo') && tab !== 'equipo' ? nuevasEquipo : 0;
  const barra = usePildora(sesionId ? null : `${tab}:${reparto.barra.length}:${reparto.mas.length}`);
  // v0.52: «Sesión en curso» (fuera de la sesión, con series hechas y sin terminar): la píldora de arriba
  const enCurso = useEnCurso(atletaId);
  const programa = compartido.programa.datos;
  useEffect(() => { comprobarEnCurso(atletaId, programa); }, [programa]);
  const conActividad = !sesionId && !!estadoActividad(enCurso);

  return (
    <div class={`app ${sesionId ? 'en-sesion' : ''} ${conActividad ? 'con-actividad' : ''}`}>
      {conActividad && <ActividadSesion datos={enCurso} alVolver={(id) => compartido.abrirSesion(id)} />}
      <InsigniaApp n={propio ? 0 : insignia} />
      <PildoraSubida />
      {!propio && <RecibirCompartido programa={compartido.programa} />}
      {sesionId ? <main><BandaPendientes pendientes={pendientesArchivos} /><Sesion id={sesionId} alCerrar={cerrarSesion} alLeer={releer} salud={salud} /></main> : (
        <>
          <main key={`${tab}:${dia}`} class="vista" data-tirar={TIRAR.includes(tab) ? '' : undefined}>
            <BandaPendientes pendientes={pendientesArchivos} />
            {propio && <BandaModoAtleta />}
            {tab === 'hoy' && <Hoy {...compartido} />}
            {tab === 'semana' && <Semana {...compartido} />}
            {tab === 'comidas' && <Comidas {...compartido} />}
            {tab === 'recetas' && <Recetas />}
            {tab === 'checkin' && <Checkin {...compartido} />}
            {tab === 'progreso' && <Progreso {...compartido} />}
            {tab === 'mensajes' && <Mensajes {...compartido} />}
            {tab === 'equipo' && <Equipo {...compartido} />}
            {tab === 'perfil' && <Perfil {...compartido} />}
          </main>
          <nav class="tabs" aria-label="Secciones">
            <div ref={barra} class={`tabs-in ${reparto.barra.filter(([t]) => t !== 'perfil').length >= 7 ? 'tabs-muchas' : ''}`}>
              <span class="tabs-pildora" aria-hidden="true" />
              {reparto.barra.map(([id, texto, icono]) => (
                <button key={id} class={`tab ${id === 'perfil' ? 'tab-perfil' : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => irAPestana(id)}>
                  <span class={`tab-ico ${(id === 'checkin' && checkinPendiente) || (id === 'hoy' && respuestasSueltas) ? 'punto' : ''}`}>
                    <Icono n={icono} class={`ico-${icono}`} />{id === 'mensajes' && <Insignia n={mensajesSinLeer} etiqueta={`${mensajesSinLeer} mensajes sin leer`} />}
                    {id === 'equipo' && tab !== 'equipo' && <Insignia n={nuevasEquipo} etiqueta={`${nuevasEquipo} ${nuevasEquipo === 1 ? 'publicación nueva' : 'publicaciones nuevas'} en el equipo`} />}
                  </span>
                  {texto}
                </button>
              ))}
              {reparto.mas.length > 0 && (
                <BotonMas activa={enMas(tab)} abierta={verMas} n={nuevasEnMas} punto={enMas('checkin') && checkinPendiente}
                  etiqueta={`${nuevasEnMas} ${nuevasEnMas === 1 ? 'publicación nueva' : 'publicaciones nuevas'} en el equipo`} alAbrir={() => setVerMas(true)} />
              )}
              {propio && (
                <button class="tab" onClick={() => salirModoAtleta()}>
                  <span class="tab-ico"><Icono n="atletas" /></span>Entrenador
                </button>
              )}
            </div>
          </nav>
          {verMas && reparto.mas.length > 0 && (
            <HojaMas pestanas={reparto.mas} actual={tab} alCerrar={() => setVerMas(false)} alElegir={(id) => { setVerMas(false); irAPestana(id); }}
              detalles={{ comidas: 'Tu menú de la semana y tus recetas', recetas: 'Recetas para todos, con sus cantidades y sus pasos', checkin: 'Tu repaso de la semana para tu coach', equipo: 'El muro de los atletas de FBE', perfil: 'Tu cuenta y los ajustes de este móvil' }}
              valores={{
                checkin: checkinPendiente ? <span class="chip aviso">Pendiente</span> : null,
                equipo: nuevasEnMas ? <span class="chip morado num">{nuevasEnMas > 99 ? '99+' : nuevasEnMas} {nuevasEnMas === 1 ? 'nueva' : 'nuevas'}</span> : null,
              }} />
          )}
        </>
      )}
    </div>
  );
}

// El número en el icono de la app (donde se puede): se pone al día con lo que hay
function InsigniaApp({ n }) {
  useEffect(() => { ponerInsignia(n); }, [n]);
  return null;
}

// Arriba en el modo atleta del coach: qué es y cómo programarse o volver
function BandaModoAtleta() {
  const { atleta, salirModoAtleta } = useApp();
  return (
    <div class="banda-modo-atleta" role="note">
      <span><Icono n="hoy" /> Modo atleta</span>
      <span class="fila">
        <button class="btn btn-peq" onClick={() => salirModoAtleta({ atletaId: atleta.id, pestana: 'programa' })}><Icono n="editar" /> Programarlo</button>
        <button class="btn btn-peq" onClick={() => salirModoAtleta()} title="Volver a la vista de entrenador">Salir</button>
      </span>
    </div>
  );
}

function Consentimiento({ alTerminar }) {
  const { api, salir } = useApp();
  const [privacidad, setPrivacidad] = useState(false);
  const [salud, setSalud] = useState(false);
  const [error, setError] = useState(null);
  async function aceptar(e) {
    e.preventDefault();
    if (!privacidad) { setError('Para usar la app tienes que aceptar la política de privacidad.'); return; }
    try { await api.darConsentimientos(['privacidad', ...(salud ? ['datos_salud'] : [])]); alTerminar(); } catch (err) { setError(err.message); }
  }
  return (
    <div class="app"><div class="acceso"><form class="acceso-caja" onSubmit={aceptar}>
      <Marca />
      <h1>Antes de empezar</h1>
      <TextoPrivacidad />
      {error && <div class="error" role="alert">{error}</div>}
      <label class="casilla"><input type="checkbox" checked={privacidad} onChange={(e) => setPrivacidad(e.currentTarget.checked)} /><span>He leído y acepto la política de privacidad.</span></label>
      <label class="casilla"><input type="checkbox" checked={salud} onChange={(e) => setSalud(e.currentTarget.checked)} /><span>{TEXTO_CONSENTIMIENTO_SALUD}</span></label>
      <button class="btn btn-primario btn-grande">Continuar</button>
      <button type="button" class="btn-texto" onClick={salir}><Icono n="salir" /> Cerrar sesión</button>
    </form></div></div>
  );
}
