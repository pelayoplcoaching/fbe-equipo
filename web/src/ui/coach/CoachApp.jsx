import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp, useCarga, Icono, Marca, Insignia } from '../comunes.jsx';
import { Panel } from './Panel.jsx';
import { Ficha } from './Ficha.jsx';
import { Revisar } from './Revisar.jsx';
import { Plantillas } from './Plantillas.jsx';
import { Biblioteca } from './Biblioteca.jsx';
import { Cuenta } from './Cuenta.jsx';
import { Buscador } from './Buscador.jsx';
import { Conversaciones } from './Conversaciones.jsx';

// Cuenta solo está en la barra en pantallas anchas; en el móvil se abre desde el avatar de Atletas
// Modo atleta (v0.37): el coach entrena con la app de atleta, con su propia ficha (solo entrenamiento)
const TABS = [['atletas', 'Atletas', 'atletas'], ['revisar', 'Revisar', 'bandeja'], ['mensajes', 'Mensajes', 'mensaje'], ['plantillas', 'Plantillas', 'plantillas'], ['biblioteca', 'Biblioteca', 'biblioteca'], ['modo-atleta', 'Modo atleta', 'hoy'], ['cuenta', 'Cuenta', 'perfil']];

export function CoachApp() {
  const { api, propioCoach, entrarModoAtleta, pedidoCoach, consumirPedidoCoach } = useApp();
  // Al volver del modo atleta con «Programarlo», se abre su ficha en el Programa
  const [tab, setTab] = useState(() => { if (pedidoCoach) return 'atletas'; const h = location.hash.slice(1); return TABS.some(([t]) => t === h) && h !== 'modo-atleta' ? h : 'atletas'; });
  const [ficha, setFicha] = useState(() => (pedidoCoach ? { atletaId: pedidoCoach.atletaId, pestana: pedidoCoach.pestana || 'programa' } : null)); // { atletaId, pestana }
  useEffect(() => { if (pedidoCoach) consumirPedidoCoach(); }, []);
  const bandeja = useCarga(() => api.bandeja(), []);
  const sinLeer = useCarga(() => api.mensajesSinLeer().catch(() => 0), []);
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
    const ir = () => { const h = location.hash.slice(1); if (TABS.some(([t]) => t === h)) { setFicha(null); setTab(h); bandeja.recargar(true); } };
    const llega = () => { bandeja.recargar(true); sinLeer.recargar(true); };
    window.addEventListener('hashchange', ir);
    window.addEventListener('fbe-notificacion', llega);
    return () => { window.removeEventListener('hashchange', ir); window.removeEventListener('fbe-notificacion', llega); };
  }, []);

  const abrirAtleta = (atletaId, pestana = 'programa') => { setTab('atletas'); setFicha({ atletaId, pestana }); setPeticion(null); };
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

  return (
    <>
    <div class="app coach" inert={buscar ? '' : undefined} aria-hidden={buscar ? 'true' : undefined}>
      <nav class="tabs" aria-label="Secciones">
        <div class="tabs-in">
          <Marca />
          <button class="tab-buscar" onClick={abrirBuscar} aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}>
            <Icono n="buscar" /><span>Buscar</span><kbd>{mac ? '⌘' : 'Ctrl'} K</kbd>
          </button>
          {TABS.map(([id, texto, icono]) => (
            <button key={id} class={`tab ${id === 'cuenta' ? 'tab-cuenta' : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => {
              // Con su ficha ya creada, la pestaña entra directamente en el modo atleta
              if (id === 'modo-atleta' && propioCoach) { entrarModoAtleta(); return; }
              setTab(id); setFicha(null); setPeticion(null);
            }}>
              <span class="tab-ico"><Icono n={icono} />{id === 'revisar' && <Insignia n={total} etiqueta={`${total} por revisar`} />}{id === 'mensajes' && <Insignia n={sinLeer.datos || 0} etiqueta={`${sinLeer.datos || 0} mensajes sin leer`} />}</span>{texto}
            </button>
          ))}
        </div>
      </nav>
      <main key={tab} class="vista">
      {tab === 'atletas' && (ficha
        ? <Ficha key={`${ficha.atletaId}:${ficha.n || 0}`} atletaId={ficha.atletaId} pestanaInicial={ficha.pestana} alVolver={() => { setFicha(null); setPeticion(null); }} alCambiar={() => bandeja.recargar(true)} />
        : <Panel abrir={abrirAtleta} pendientes={bandeja.datos?.porAtleta || {}} peticion={pide('atletas')} alBuscar={abrirBuscar} abrirCuenta={() => { setTab('cuenta'); setFicha(null); }} />)}
      {tab === 'revisar' && <Revisar bandeja={bandeja} abrirAtleta={abrirAtleta} />}
      {tab === 'mensajes' && <Conversaciones abrirAtleta={abrirAtleta} alCambiar={() => { bandeja.recargar(true); sinLeer.recargar(true); }} peticion={pide('mensajes')} />}
      {tab === 'plantillas' && <Plantillas peticion={pide('plantillas')} />}
      {tab === 'biblioteca' && <Biblioteca peticion={pide('biblioteca')} />}
      {tab === 'cuenta' && <Cuenta abrirAtleta={abrirAtleta} />}
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
      <header class="cabecera"><div class="titulo"><h1>Modo atleta</h1></div></header>
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
