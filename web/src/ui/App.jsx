import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { Ctx, Cargando, Icono } from './comunes.jsx';
import { Acceso, Vincular, NuevaPassword, SegundoPaso } from './Acceso.jsx';
import { AtletaApp } from './atleta/AtletaApp.jsx';
import { CoachApp } from './coach/CoachApp.jsx';
import { quitarPortada } from './portada.js';
import { desactivarPush, desactivarPushLocal, sincronizarPush } from '../datos/push.js';

const CLAVE_ACTIVACION = 'fbe-activacion-pendiente';
export function guardarActivacionPendiente(datos) { try { localStorage.setItem(CLAVE_ACTIVACION, JSON.stringify(datos)); } catch { /* */ } }
function leerActivacionPendiente() { try { return JSON.parse(localStorage.getItem(CLAVE_ACTIVACION) || 'null'); } catch { return null; } }
function borrarActivacionPendiente() { try { localStorage.removeItem(CLAVE_ACTIVACION); } catch { /* */ } }
// Modo atleta del coach (v0.37): si lo dejó abierto, la app vuelve a él (en este dispositivo)
const CLAVE_MODO_ATLETA = 'fbe-modo-atleta';
const leerModoAtleta = () => { try { return localStorage.getItem(CLAVE_MODO_ATLETA) === '1'; } catch { return false; } };
const guardarModoAtleta = (v) => { try { if (v) localStorage.setItem(CLAVE_MODO_ATLETA, '1'); else localStorage.removeItem(CLAVE_MODO_ATLETA); } catch { /* */ } };

export function App({ backend, api, cola }) {
  const [estado, setEstado] = useState({ fase: 'cargando' });
  const [toast, setToast] = useState(null);
  const [pendientes, setPendientes] = useState(cola.pendientes());
  const [enLinea, setEnLinea] = useState(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
  const ultimoUid = useRef(undefined);
  const [modoAtleta, setModoAtleta] = useState(leerModoAtleta);
  const [pedidoCoach, setPedidoCoach] = useState(null); // al volver del modo atleta: abrir algo en la vista de coach

  // accion: { texto, fn } añade un botón al aviso (p. ej. «Deshacer»)
  const aviso = (texto, tipo = 'ok', accion = null) => setToast({ texto, tipo, accion, id: Date.now() });
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.accion ? 6000 : toast.tipo === 'error' || toast.tipo === 'record' ? 5000 : 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // Decide qué pantalla toca según la sesión. Serializado: los avisos de Auth y las recargas pueden llegar a la vez.
  const cadena = useRef(Promise.resolve());
  function resolver(forzar = false) {
    cadena.current = cadena.current.then(() => resolverYa(forzar)).catch(() => {});
    return cadena.current;
  }
  async function resolverYa(forzar) {
    const s = backend.auth.sesion();
    const uid = s?.user.id || null;
    if (!forzar && uid === ultimoUid.current) return;
    ultimoUid.current = uid;
    if (!s) {
      // Sin sesión, este móvil no debe seguir recibiendo las notificaciones de nadie
      if (backend.modo === 'supabase') desactivarPushLocal();
      setEstado({ fase: 'fuera' });
      return;
    }
    if (backend.auth.enRecuperacion?.()) { setEstado({ fase: 'nueva-password' }); return; }
    try {
      // Con la verificación en dos pasos activada, primero el código
      const nivel = await backend.auth.mfa?.nivel?.().catch(() => undefined); // undefined = no se ha podido saber
      if (nivel && nivel.siguiente === 'aal2' && nivel.actual !== 'aal2') { setEstado({ fase: 'mfa' }); return; }
      const perfil = await api.perfil();
      if (perfil?.rol === 'coach') {
        borrarActivacionPendiente();
        // Si no se ha podido comprobar el segundo paso, no se entra a ciegas (vería el panel vacío): se pide reintentar
        if (perfil.exige_2fa && nivel === undefined && backend.auth.mfa) { setEstado({ fase: 'error', error: new Error('no se ha podido comprobar la verificación en dos pasos. Revisa la conexión y vuelve a intentarlo') }); return; }
        // La base exige el segundo paso pero ya no hay ningún dispositivo: solo se arregla desde Supabase
        if (perfil.exige_2fa && nivel && nivel.actual !== 'aal2') { setEstado({ fase: 'sin-2fa', perfil }); return; }
        // Con dispositivos verificados, la base debe exigirlos siempre (por si se activó antes de la v0.3)
        if (nivel?.actual === 'aal2' && !perfil.exige_2fa) api.exigirDosPasos(true).catch(() => {});
        // Su propia ficha de atleta, si la tiene (modo atleta)
        const propio = await api.miAtleta().catch(() => null);
        setEstado({ fase: 'coach', perfil, propio });
        return;
      }
      let atleta = await api.miAtleta();
      const pendiente = leerActivacionPendiente();
      let codigoFallido = false;
      if (!atleta && pendiente?.codigo) {
        const id = await api.canjearCodigo(pendiente.codigo).catch(() => null);
        if (id) atleta = await api.miAtleta();
        else { codigoFallido = true; borrarActivacionPendiente(); }
      }
      if (atleta && pendiente) {
        const tipos = [...(pendiente.privacidad ? ['privacidad'] : []), ...(pendiente.salud ? ['datos_salud'] : [])];
        const dados = await api.consentimientos();
        const faltan = tipos.filter((t) => !dados.some((d) => d.tipo === t && !d.revocado_en));
        if (faltan.length) await api.darConsentimientos(faltan);
        borrarActivacionPendiente();
      }
      setEstado(atleta ? { fase: 'atleta', perfil, atleta } : { fase: 'vincular', perfil, codigoFallido });
    } catch (e) {
      setEstado({ fase: 'error', error: e });
    }
  }

  useEffect(() => {
    resolver(true);
    const quitar = backend.auth.alCambiar(() => resolver());
    const quitarCola = cola.alCambiar(setPendientes);
    // Si el servidor rechaza algo que estaba guardado en el móvil, se avisa (no se pierde en silencio)
    const quitarRechazo = cola.alRechazo((op, e) => setToast({
      texto: op.tipo === 'serie' ? `No se ha podido guardar la serie ${op.datos.numero}: ${e?.message || 'error del servidor'}` : `No se ha podido guardar un cambio: ${e?.message || 'error del servidor'}`,
      tipo: 'error', id: Date.now(),
    }));
    // Red de seguridad: un error que ninguna pantalla ha recogido (un botón de borrar sin conexión, por ejemplo)
    // se enseña en un aviso en lugar de perderse en silencio
    const sinRecoger = (e) => {
      const m = e.reason?.message || String(e.reason || '');
      if (!m || e.reason?.name === 'AbortError') return;
      setToast({ texto: e.reason?.sinConexion ? 'Sin conexión: no se ha podido hacer. Prueba de nuevo cuando vuelva.' : `No se ha podido hacer: ${m}`, tipo: 'error', id: Date.now() });
    };
    window.addEventListener('unhandledrejection', sinRecoger);
    const on = () => setEnLinea(true), off = () => setEnLinea(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { quitar(); quitarCola(); quitarRechazo(); window.removeEventListener('unhandledrejection', sinRecoger); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  // El coach en modo atleta (v0.37): la app de atleta con su propia ficha
  const enModoAtleta = estado.fase === 'coach' && modoAtleta && !!estado.propio;
  // La cola solo envía lo del atleta con la sesión abierta
  const atletaId = estado.fase === 'atleta' ? estado.atleta?.id : enModoAtleta ? estado.propio.id : null;
  useEffect(() => { cola.fijarAtleta(atletaId); }, [atletaId]);
  // Con la sesión dentro, si este móvil tiene las notificaciones activadas, la base se queda con su suscripción al día
  const dentro = estado.fase === 'atleta' || estado.fase === 'coach';
  useEffect(() => { if (dentro) sincronizarPush(api, backend.modo); }, [dentro, ultimoUid.current]);
  // La ficha del atleta (servicio, estado…) la cambia el coach: se vuelve a leer al volver a la app y cada media
  // hora, para que, por ejemplo, la nutrición aparezca o desaparezca sin tener que cerrar la app (v0.22)
  useEffect(() => {
    if (!atletaId) return undefined;
    const releer = async () => {
      if (document.visibilityState !== 'visible') return;
      const nueva = await api.miAtleta().catch(() => null);
      if (!nueva || nueva.id !== atletaId) return;
      setEstado((e) => {
        if (e.fase !== 'atleta' || e.atleta?.id !== nueva.id) return e;
        const cambia = ['nutricion', 'nivel', 'estado', 'nombre', 'checkin_apartados'].some((k) => JSON.stringify(e.atleta[k]) !== JSON.stringify(nueva[k]));
        return cambia ? { ...e, atleta: { ...e.atleta, ...nueva } } : e;
      });
    };
    document.addEventListener('visibilitychange', releer);
    const t = setInterval(releer, 30 * 60 * 1000);
    return () => { document.removeEventListener('visibilitychange', releer); clearInterval(t); };
  }, [atletaId]);

  const ctx = {
    api, backend, cola, aviso, enLinea, pendientes,
    modo: backend.modo,
    perfil: estado.perfil, atleta: estado.atleta, codigoFallido: estado.codigoFallido,
    recargar: () => resolver(true),
    // Tras cambiar la foto o el nombre: el perfil nuevo, sin recargar toda la cuenta
    fijarPerfil: (p) => setEstado((e) => ({ ...e, perfil: p })),
    // Al cerrar sesión, este móvil deja de recibir las notificaciones de esa cuenta
    salir: async () => { if (backend.modo === 'supabase') await desactivarPush(api); await backend.auth.salir(); resolver(true); },
    reiniciarDemo: () => { backend.reiniciar?.(); ultimoUid.current = undefined; resolver(true); },
    // Modo atleta del coach (v0.37)
    propioCoach: estado.fase === 'coach' ? estado.propio || null : null,
    entrarModoAtleta: (propio = null) => {
      if (propio) setEstado((e) => ({ ...e, propio }));
      setModoAtleta(true); guardarModoAtleta(true); window.scrollTo(0, 0);
    },
    salirModoAtleta: (pedido = null) => { setPedidoCoach(pedido); setModoAtleta(false); guardarModoAtleta(false); },
    pedidoCoach, consumirPedidoCoach: () => setPedidoCoach(null),
  };
  // Dentro del modo atleta, para la app de atleta: su ficha es «el atleta» y propio = true
  const ctxAtleta = enModoAtleta ? { ...ctx, atleta: estado.propio, propio: true } : ctx;

  // La portada de arranque se va cuando hay algo que enseñar: el acceso enseguida; la cuenta, con sus datos
  useEffect(() => {
    if (estado.fase !== 'cargando') quitarPortada({ esperarDatos: estado.fase === 'atleta' || estado.fase === 'coach' });
  }, [estado.fase]);

  let vista;
  if (estado.fase === 'cargando') vista = <div class="acceso"><Cargando /></div>;
  else if (estado.fase === 'fuera') vista = <Acceso />;
  else if (estado.fase === 'vincular') vista = <Vincular />;
  else if (estado.fase === 'nueva-password') vista = <NuevaPassword />;
  else if (estado.fase === 'mfa') vista = <SegundoPaso />;
  else if (estado.fase === 'sin-2fa') vista = (
    <div class="acceso"><div class="acceso-caja pila">
      <h1 class="peq">Falta tu dispositivo de verificación</h1>
      <p class="secundario">Tu cuenta de coach exige la verificación en dos pasos, pero no tiene ningún dispositivo. Para volver a entrar, quita la exigencia desde el SQL Editor de Supabase (está en el README, «Si pierdes el móvil de la verificación en dos pasos») y actívala de nuevo desde Cuenta.</p>
      <button class="btn" onClick={ctx.salir}>Cerrar sesión</button>
    </div></div>
  );
  else if (estado.fase === 'coach') vista = enModoAtleta ? <Ctx.Provider value={ctxAtleta}><AtletaApp key="modo-atleta" /></Ctx.Provider> : <CoachApp />;
  else if (estado.fase === 'atleta') vista = <AtletaApp />;
  else vista = (
    <div class="acceso"><div class="acceso-caja">
      <div class="error" role="alert">No se ha podido cargar tu cuenta: {estado.error?.message}</div>
      <button class="btn" onClick={() => resolver(true)}>Reintentar</button>
      <button class="btn-texto" onClick={ctx.salir}>Cerrar sesión</button>
    </div></div>
  );

  return (
    <Ctx.Provider value={ctx}>
      {estado.fase === 'coach' || estado.fase === 'atleta' ? vista : <main>{vista}</main>}
      <AvisoVersion />
      {toast && <div class={`toast ${toast.tipo === 'error' || toast.tipo === 'record' ? toast.tipo : ''}`} role="status" key={toast.id}>{toast.tipo === 'record' && <Icono n="trofeo" />}{toast.texto}
        {toast.accion && <button class="toast-accion" onClick={() => { const a = toast.accion; setToast(null); a.fn(); }}>{toast.accion.texto}</button>}</div>}
    </Ctx.Provider>
  );
}

// Versión nueva publicada (v0.19): con la app abierta, el service worker la descarga en segundo plano y aquí se
// ofrece «Actualizar»; al tocarlo, la nueva toma el control y la página se recarga (lo pendiente sin conexión
// sigue guardado en el móvil). Al abrir la app de cero ya arranca con la última versión, sin aviso.
function AvisoVersion() {
  const [nueva, setNueva] = useState(() => (typeof window !== 'undefined' && window.__fbeVersionNueva) || null);
  const [actualizando, setActualizando] = useState(false);
  useEffect(() => {
    const llega = (e) => setNueva(e.detail || window.__fbeVersionNueva || null);
    window.addEventListener('fbe-version', llega);
    return () => window.removeEventListener('fbe-version', llega);
  }, []);
  if (!nueva) return null;
  return (
    <div class="aviso-version" role="status">
      <span>Hay una versión nueva de FBE Equipo.</span>
      <button class="btn btn-peq btn-primario" disabled={actualizando} onClick={() => {
        setActualizando(true);
        window.__fbeActualizando = true;
        try { nueva.postMessage('activar'); } catch { location.reload(); }
        // Por si el navegador no avisa del cambio: recargar igualmente
        setTimeout(() => location.reload(), 4000);
      }}>{actualizando ? 'Actualizando…' : 'Actualizar'}</button>
      {!actualizando && <button class="btn btn-icono plano aviso-version-cerrar" aria-label="Ahora no" onClick={() => setNueva(null)}><Icono n="cerrar" /></button>}
    </div>
  );
}

// Banda de estado: sin conexión o con series pendientes de enviar
export function BandaConexion() {
  const { enLinea, pendientes } = useAppCtx();
  if (enLinea && !pendientes) return null;
  return (
    <div class="banda-conexion" role="status">
      <Icono n="sinred" />
      {!enLinea
        ? `Sin conexión. Lo que registres se guarda en el móvil${pendientes ? ` (${pendientes} pendiente${pendientes > 1 ? 's' : ''})` : ''} y se enviará solo.`
        : `Enviando ${pendientes} registro${pendientes > 1 ? 's' : ''} guardado${pendientes > 1 ? 's' : ''} sin conexión…`}
    </div>
  );
}

function useAppCtx() { return useContext(Ctx); }

export function BandaDemo() {
  const { modo, salir, reiniciarDemo } = useAppCtx();
  const [confirmar, setConfirmar] = useState(false);
  if (modo !== 'demo') return null;
  return (
    <div class="banda-demo">
      <span>Demo: lo que hagas se queda en este navegador.</span>
      <span class="fila">
        {confirmar
          ? <><button class="btn btn-peq" onClick={() => setConfirmar(false)}>No</button><button class="btn btn-peq btn-primario" onClick={reiniciarDemo}>Sí, reiniciar</button></>
          : <><button class="btn btn-peq" onClick={() => setConfirmar(true)}>Reiniciar</button><button class="btn btn-peq" onClick={salir}>Cambiar de cuenta</button></>}
      </span>
    </div>
  );
}
