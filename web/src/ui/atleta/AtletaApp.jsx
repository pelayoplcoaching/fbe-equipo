import { useEffect, useState } from 'preact/hooks';
import { useCambioDeDia, Siluetas, useApp, useCarga, Icono, Marca, Insignia } from '../comunes.jsx';
import { Mensajes } from './Mensajes.jsx';
import { Hoy } from './Hoy.jsx';
import { Sesion } from './Sesion.jsx';
import { Semana } from './Semana.jsx';
import { Checkin } from './Checkin.jsx';
import { Progreso } from './Progreso.jsx';
import { Perfil } from './Perfil.jsx';
import { Comidas } from './Comidas.jsx';
import { conEntrenamiento, conNutricion } from '../../logica/nivel.js';
import { TextoPrivacidad } from '../Acceso.jsx';
import { usePendientesArchivos, BandaPendientes } from '../Pendientes.jsx';
import { TEXTO_CONSENTIMIENTO_SALUD } from '../../legal.js';
import { hoyISO, semanaCheckin, diaDeCheckin } from '../../logica/fechas.js';

// Perfil solo está en la barra en pantallas anchas; en el móvil se abre desde el avatar de arriba (como en cualquier app).
// Comidas (v0.26), a quien le llevas la nutrición; Semana, a quien le llevas el entrenamiento.
const TODAS = [
  ['hoy', 'Hoy', 'hoy'], ['semana', 'Semana', 'semana'], ['comidas', 'Comidas', 'receta'], ['checkin', 'Check-in', 'checkin'],
  ['progreso', 'Progreso', 'progreso'], ['mensajes', 'Mensajes', 'mensaje'], ['perfil', 'Perfil', 'perfil'],
];
export const pestanasAtleta = (atleta) => TODAS.filter(([t]) => (t !== 'semana' || conEntrenamiento(atleta)) && (t !== 'comidas' || conNutricion(atleta)));

function tabInicial(tabs) {
  const h = (typeof location !== 'undefined' ? location.hash : '').slice(1);
  return tabs.some(([t]) => t === h) ? h : 'hoy';
}

export function AtletaApp() {
  const { api, atleta, aviso } = useApp();
  // Vídeos guardados en el móvil sin cobertura: se envían solos (en cualquier pestaña)
  const pendientesArchivos = usePendientesArchivos(api, atleta?.id, aviso);
  const TABS = pestanasAtleta(atleta);
  const [tab, setTab] = useState(() => tabInicial(TABS));
  // Si el coach cambia su servicio con la app abierta y la pestaña ya no está, a Hoy
  useEffect(() => { if (!TABS.some(([t]) => t === tab)) setTab('hoy'); }, [atleta.entrenamiento, atleta.nutricion]);
  const [sesionId, setSesionId] = useState(null);
  const consentimientos = useCarga(() => api.consentimientos(), []);
  // Si la app se queda abierta de un día para otro (o se vuelve a ella por la mañana), todo se recalcula con el día nuevo
  const [dia, setDia] = useState(hoyISO);
  useCambioDeDia(setDia);
  const programa = useCarga(() => api.programa(atleta.id), [atleta.id, dia]);
  const checkinSemana = useCarga(() => api.checkin(atleta.id, semanaCheckin(hoyISO())), [atleta.id, dia]);
  const noLeidos = useCarga(() => api.noLeidos(atleta.id).catch(() => []), [atleta.id, dia]);

  useEffect(() => {
    try { history.replaceState(null, '', `#${tab}`); } catch { /* */ }
    window.scrollTo(0, 0);
  }, [tab]);
  // Al tocar una notificación con la app abierta, se va a su pestaña; si llega una, se ponen al día las respuestas
  useEffect(() => {
    // (con una sesión abierta no se sale de ella: la pestaña queda elegida para cuando la cierre)
    const ir = () => { const h = location.hash.slice(1); if (TABS.some(([t]) => t === h)) { setTab(h); noLeidos.recargar(true); } };
    const llega = () => { noLeidos.recargar(true); programa.recargar(true); };
    window.addEventListener('hashchange', ir);
    window.addEventListener('fbe-notificacion', llega);
    return () => { window.removeEventListener('hashchange', ir); window.removeEventListener('fbe-notificacion', llega); };
  }, []);

  if (consentimientos.cargando && !consentimientos.datos) return <div class="app"><div class="contenido"><Siluetas forma="hoy" /></div></div>;
  const activos = (consentimientos.datos || []).filter((c) => !c.revocado_en);
  if (consentimientos.datos && !activos.some((c) => c.tipo === 'privacidad')) {
    return <Consentimiento alTerminar={() => consentimientos.recargar()} />;
  }
  const salud = activos.some((c) => c.tipo === 'datos_salud');
  const checkinPendiente = salud && checkinSemana.datos && !checkinSemana.datos.checkin && diaDeCheckin();

  // A quien solo lleva la nutrición no se le abren sesiones (una respuesta antigua en una sesión se lee en Mensajes)
  const abrirSesion = (id) => { if (!conEntrenamiento(atleta)) { setTab('mensajes'); return; } setSesionId(id); window.scrollTo(0, 0); };
  const cerrarSesion = () => { setSesionId(null); programa.recargar(true); noLeidos.recargar(true); };
  const releer = () => noLeidos.recargar(true);

  // Los mensajes sueltos del coach cuentan en Mensajes; los de sesiones, check-ins y vídeos, en Hoy
  const mensajesSinLeer = (noLeidos.datos || []).filter((c) => api.esMensaje(c)).length;
  const respuestasSueltas = (noLeidos.datos || []).some((c) => !api.esMensaje(c));
  const compartido = {
    programa, salud, recargarConsentimientos: () => consentimientos.recargar(true), irA: setTab, abrirSesion, checkinSemana,
    noLeidos: noLeidos.datos || [], releer,
  };

  return (
    <div class={`app ${sesionId ? 'en-sesion' : ''}`}>
      {sesionId ? <main><BandaPendientes pendientes={pendientesArchivos} /><Sesion id={sesionId} alCerrar={cerrarSesion} alLeer={releer} salud={salud} /></main> : (
        <>
          <main key={`${tab}:${dia}`} class="vista">
            <BandaPendientes pendientes={pendientesArchivos} />
            {tab === 'hoy' && <Hoy {...compartido} />}
            {tab === 'semana' && <Semana {...compartido} />}
            {tab === 'comidas' && <Comidas {...compartido} />}
            {tab === 'checkin' && <Checkin {...compartido} />}
            {tab === 'progreso' && <Progreso {...compartido} />}
            {tab === 'mensajes' && <Mensajes {...compartido} />}
            {tab === 'perfil' && <Perfil {...compartido} />}
          </main>
          <nav class="tabs" aria-label="Secciones">
            <div class="tabs-in">
              {TABS.map(([id, texto, icono]) => (
                <button key={id} class={`tab ${id === 'perfil' ? 'tab-perfil' : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
                  <span class={`tab-ico ${(id === 'checkin' && checkinPendiente) || (id === 'hoy' && respuestasSueltas) ? 'punto' : ''}`}>
                    <Icono n={icono} />{id === 'mensajes' && <Insignia n={mensajesSinLeer} etiqueta={`${mensajesSinLeer} mensajes sin leer`} />}
                  </span>
                  {texto}
                </button>
              ))}
            </div>
          </nav>
        </>
      )}
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
