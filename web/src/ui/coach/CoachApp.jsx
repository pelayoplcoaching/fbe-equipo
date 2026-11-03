import { useEffect, useRef, useState } from 'preact/hooks';
import { CabeceraGrande, useApp, useCarga, Icono, Marca, Insignia, usePildora } from '../comunes.jsx';
import { conTransicion } from '../transiciones.js';
import { Panel } from './Panel.jsx';
import { Ficha } from './Ficha.jsx';
import { Revisar } from './Revisar.jsx';
import { Plantillas } from './Plantillas.jsx';
import { Biblioteca } from './Biblioteca.jsx';
import { Cuenta } from './Cuenta.jsx';
import { Buscador } from './Buscador.jsx';
import { Conversaciones } from './Conversaciones.jsx';
import { EquipoCoach } from './EquipoCoach.jsx';
import { pideCompartido, borrarCompartido, limpiarDireccion } from '../Compartido.jsx';
import { ponerInsignia } from '../insignia-app.js';

// Cuenta solo está en la barra en pantallas anchas; en el móvil se abre desde el avatar de Atletas
// Modo atleta (v0.37): el coach entrena con la app de atleta, con su propia ficha (solo entrenamiento)
// Equipo (v0.43): el muro de la comunidad, solo con ella abierta (se abre en Cuenta → Comunidad)
const TODAS = [['atletas', 'Atletas', 'atletas'], ['revisar', 'Revisar', 'bandeja'], ['mensajes', 'Mensajes', 'mensaje'], ['equipo', 'Equipo', 'equipo'], ['plantillas', 'Plantillas', 'plantillas'], ['biblioteca', 'Biblioteca', 'biblioteca'], ['modo-atleta', 'Modo atleta', 'hoy'], ['cuenta', 'Cuenta', 'perfil']];
const TABS = TODAS.filter(([t]) => t !== 'equipo');

export function CoachApp() {
  const { api, propioCoach, entrarModoAtleta, pedidoCoach, consumirPedidoCoach } = useApp();
  const comunidad = useCarga(() => api.comunidad(), []);
  const pestanas = comunidad.datos?.activa ? TODAS : TABS;
  const pestanasRef = useRef(pestanas);
  pestanasRef.current = pestanas;
  // Al volver del modo atleta con «Programarlo», se abre su ficha en el Programa
  const [tab, setTab] = useState(() => { if (pedidoCoach) return 'atletas'; const h = location.hash.slice(1); return TODAS.some(([t]) => t === h) && h !== 'modo-atleta' ? h : 'atletas'; });
  // (#equipo con la comunidad cerrada, o sin la migración 027: a Atletas)
  useEffect(() => { if (comunidad.datos && tab === 'equipo' && !comunidad.datos.activa) setTab('atletas'); }, [comunidad.datos]);
  const [ficha, setFicha] = useState(() => (pedidoCoach ? { atletaId: pedidoCoach.atletaId, pestana: pedidoCoach.pestana || 'programa' } : null)); // { atletaId, pestana }
  useEffect(() => { if (pedidoCoach) consumirPedidoCoach(); }, []);
  // v0.54 (revisión): al abrir, lo que quedó en la cola de Storage (fotos y vídeos ya quitados de la tabla) se borra
  useEffect(() => { Promise.resolve(api.limpiarAlmacenamiento?.()).catch(() => {}); }, []);
  const bandeja = useCarga(() => api.bandeja(), []);
  const sinLeer = useCarga(() => api.mensajesSinLeer().catch(() => 0), []);
  // v0.48: el número del icono de la app (lo que espera tu respuesta y los mensajes sin leer)
  useEffect(() => { if (bandeja.datos) ponerInsignia((bandeja.datos.total || 0) + (sinLeer.datos || 0)); }, [bandeja.datos, sinLeer.datos]);
  // «Compartir → FBE Equipo» es para tus atletas: desde la cuenta del coach no se envía nada (y se borra del móvil)
  const { aviso } = useApp();
  useEffect(() => {
    if (!pideCompartido()) return;
    limpiarDireccion(['compartido', 'accion']);
    borrarCompartido();
    aviso('Compartir un vídeo con FBE Equipo es para tus atletas: desde tu cuenta no se envía nada.');
  }, []);
  useEffect(() => { try { history.replaceState(null, '', `#${tab}`); } catch { /* */ } window.scrollTo(0, 0); }, [tab, ficha?.atletaId]);
  // La bandeja se refresca al cambiar de sección (no al montar: ya se carga sola)
  const montado = useRef(false);
  useEffect(() => { if (montado.current) { bandeja.recargar(true); sinLeer.recargar(true); } montado.current = true; }, [tab, ficha?.atletaId]);
  // La insignia de Mensajes se pone al día al momento (Realtime) y al leer
  useEffect(() => {
    const al = () => sinLeer.recargar(true);
    for (const ev of ['fbe-mensaje', 'fbe-cambio']) window.addEventListener(ev, al);
    return () => { for (const ev of ['fbe-mensaje', 'fbe-cambio']) window.removeEventListener(ev, al); };
  }, []);
  // Al tocar una notificación con la app abierta, se va a su sección (y la bandeja se pone al día)
  useEffect(() => {
    const ir = () => { const h = location.hash.slice(1); if (pestanasRef.current.some(([t]) => t === h)) { setFicha(null); setTab(h); bandeja.recargar(true); } };
    const llega = () => { bandeja.recargar(true); sinLeer.recargar(true); };
    window.addEventListener('hashchange', ir);
    window.addEventListener('fbe-notificacion', llega);
    return () => { window.removeEventListener('hashchange', ir); window.removeEventListener('fbe-notificacion', llega); };
  }, []);

  // v0.49: abrir y cerrar una ficha, y cambiar de sección, con una transición corta (donde se puede)
  // v0.52: desde el panel, su foto pasa a la de la cabecera de la ficha (elemento compartido)
  const abrirAtleta = (atletaId, pestana = 'programa', foto = null) => {
    conTransicion(() => { setTab('atletas'); setFicha({ atletaId, pestana }); setPeticion(null); }, 'abrir',
      foto ? [{ nombre: 'vt-avatar', desde: foto, hasta: '.avatar-estado .avatar' }] : null);
  };
  // v0.49: los resúmenes que ya cargó el panel, para la cabecera de la ficha (si se abre desde otro sitio, la ficha
  // pide solo los de ese atleta)
  const resumenesPanel = useRef(null);
  const cerrarFicha = () => conTransicion(() => { setFicha(null); setPeticion(null); }, 'cerrar');
  const total = bandeja.datos?.total || 0;

  // Búsqueda rápida: Ctrl/Cmd + K en cualquier sitio, o «/» si no se está escribiendo
  const [buscar, setBuscar] = useState(false);
  // Al cerrar sin elegir nada, el foco vuelve a donde estaba
  const focoPrevio = useRef(null);
  const abrirBuscar = () => { focoPrevio.current = document.activeElement; setBuscar(true); };
  const cerrarBuscar = ({ navegar = false } = {}) => {
    setBuscar(false);
    const el = focoPrevio.current;
    if (!navegar) setTimeout(() => { if (el?.isConnected && el !== document.body) el.focus(); }, 0);
  };
  const [peticion, setPeticion] = useState(null); // lo que pide la búsqueda a la sección de destino
  useEffect(() => {
    const tecla = (e) => {
      const escribiendo = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); if (document.querySelector('.paleta')) cerrarBuscar(); else abrirBuscar(); }
      else if (e.key === '/' && !escribiendo && !e.ctrlKey && !e.metaKey && !document.querySelector('[aria-modal="true"]')) { e.preventDefault(); abrirBuscar(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);
  const ir = (d) => {
    setTab(d.tab);
    setFicha(d.atletaId ? { atletaId: d.atletaId, pestana: d.pestana || 'programa', n: Date.now() } : null);
    setPeticion({ ...d, id: Date.now() });
  };
  const pide = (t) => (peticion?.tab === t ? peticion : null);
  const mac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  const barra = usePildora(`${tab}:${pestanas.length}`);

  return (
    <>
    <div class="app coach" inert={buscar ? '' : undefined} aria-hidden={buscar ? 'true' : undefined}>
      <nav class="tabs" aria-label="Secciones">
        <div ref={barra} class={`tabs-in ${pestanas.filter(([t]) => t !== 'cuenta').length >= 7 ? 'tabs-muchas' : ''}`}>
          <span class="tabs-pildora" aria-hidden="true" />
          <Marca />
          <button class="tab-buscar" onClick={abrirBuscar} aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}>
            <Icono n="buscar" /><span>Buscar</span><kbd>{mac ? '⌘' : 'Ctrl'} K</kbd>
          </button>
          {pestanas.map(([id, texto, icono]) => (
            <button key={id} class={`tab ${id === 'cuenta' ? 'tab-cuenta' : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => {
              // Con su ficha ya creada, la pestaña entra directamente en el modo atleta
              if (id === 'modo-atleta' && propioCoach) { entrarModoAtleta(); return; }
              if (id === tab && !ficha) return;
              const orden = pestanas.map(([t]) => t);
              conTransicion(() => { setTab(id); setFicha(null); setPeticion(null); }, orden.indexOf(id) < orden.indexOf(tab) ? 'atras' : id === tab ? 'cerrar' : 'adelante');
            }}>
              <span class="tab-ico"><Icono n={icono} class={`ico-${icono}`} />{id === 'revisar' && <Insignia n={total} etiqueta={`${total} por revisar`} />}{id === 'mensajes' && <Insignia n={sinLeer.datos || 0} etiqueta={`${sinLeer.datos || 0} mensajes sin leer`} />}</span>{texto}
            </button>
          ))}
        </div>
      </nav>
      <main key={tab} class="vista">
      {tab === 'atletas' && (ficha
        ? <Ficha key={`${ficha.atletaId}:${ficha.n || 0}`} atletaId={ficha.atletaId} pestanaInicial={ficha.pestana} resumenInicial={resumenesPanel.current?.find((r) => r.atleta_id === ficha.atletaId) || null} alVolver={cerrarFicha} alCambiar={() => bandeja.recargar(true)} />
        : <Panel abrir={abrirAtleta} pendientes={bandeja.datos?.porAtleta || {}} porRevisar={bandeja.datos ? total : null}
            irARevisar={() => conTransicion(() => { setTab('revisar'); setFicha(null); setPeticion(null); }, 'adelante')} peticion={pide('atletas')} alBuscar={abrirBuscar} abrirCuenta={() => { setTab('cuenta'); setFicha(null); }} alCargar={(l) => { resumenesPanel.current = l; }} />)}
      {tab === 'revisar' && <Revisar bandeja={bandeja} abrirAtleta={abrirAtleta} />}
      {tab === 'mensajes' && <Conversaciones abrirAtleta={abrirAtleta} alCambiar={() => { bandeja.recargar(true); sinLeer.recargar(true); }} peticion={pide('mensajes')} />}
      {tab === 'plantillas' && <Plantillas peticion={pide('plantillas')} />}
      {tab === 'biblioteca' && <Biblioteca peticion={pide('biblioteca')} />}
      {tab === 'cuenta' && <Cuenta abrirAtleta={abrirAtleta} alCambiarComunidad={() => comunidad.recargar(true)} />}
      {tab === 'equipo' && <EquipoCoach />}
      {tab === 'modo-atleta' && <EmpezarModoAtleta />}
      </main>
    </div>
    {buscar && <Buscador alCerrar={cerrarBuscar} ir={ir} />}
    </>
  );
}

// La primera vez: crear su ficha de atleta (vinculada a su cuenta) y entrar
function EmpezarModoAtleta() {
  const { api, aviso, entrarModoAtleta } = useApp();
  const [ocupado, setOcupado] = useState(false);
  return (
    <div class="contenido">
      <CabeceraGrande><div class="titulo"><h1>Modo atleta</h1></div></CabeceraGrande>
      <section class="panel panel-pad pila">
        <p>Entrena con la app como uno de tus atletas, sin otra cuenta: te programas desde aquí, como a cualquiera, y en el modo atleta ves y registras tu entrenamiento (Hoy, Semana y Progreso).</p>
        <p class="peq secundario">Es solo entrenamiento: sin nutrición, check-in, mensajes, vídeos ni cobros. Tu ficha no sale en Atletas, Revisar, Mensajes ni Cobros. Para programarte, toca «Programarlo» arriba, en el modo atleta.</p>
        <p class="peq secundario">Al crearla quedan anotados tus consentimientos de privacidad y de datos de salud (son tus propios datos), para que se guarde cómo llegas a cada sesión.</p>
        <button class="btn btn-primario btn-grande" disabled={ocupado} onClick={async () => {
          setOcupado(true);
          try { const propio = await api.crearAtletaPropio(); entrarModoAtleta(propio); aviso('Tu ficha de atleta está lista'); }
          catch (e) { aviso(e.message, 'error'); setOcupado(false); }
        }}><Icono n="hoy" /> Crear mi ficha y entrar</button>
      </section>
    </div>
  );
}
