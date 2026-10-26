import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { Ctx, Cargando, Icono } from './comunes.jsx';
import { Acceso, Vincular, NuevaPassword, SegundoPaso } from './Acceso.jsx';
import { AtletaApp } from './atleta/AtletaApp.jsx';
import { CoachApp } from './coach/CoachApp.jsx';
import { desactivarPush, desactivarPushLocal, sincronizarPush } from '../datos/push.js';

const CLAVE_ACTIVACION = 'fbe-activacion-pendiente';
export function guardarActivacionPendiente(datos) { try { localStorage.setItem(CLAVE_ACTIVACION, JSON.stringify(datos)); } catch { /* */ } }
function leerActivacionPendiente() { try { return JSON.parse(localStorage.getItem(CLAVE_ACTIVACION) || 'null'); } catch { return null; } }
function borrarActivacionPendiente() { try { localStorage.removeItem(CLAVE_ACTIVACION); } catch { /* */ } }

export function App({ backend, api, cola }) {
  const [estado, setEstado] = useState({ fase: 'cargando' });
  const [toast, setToast] = useState(null);
  const [pendientes, setPendientes] = useState(cola.pendientes());
  const [enLinea, setEnLinea] = useState(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
  const ultimoUid = useRef(undefined);

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
        setEstado({ fase: 'coach', perfil });
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
  // La cola solo envía lo del atleta con la sesión abierta
  const atletaId = estado.fase === 'atleta' ? estado.atleta?.id : null;
  useEffect(() => { cola.fijarAtleta(atletaId); }, [atletaId]);
  // Con la sesión dentro, si este móvil tiene las notificaciones activadas, la base se queda con su suscripción al día
  const dentro = estado.fase === 'atleta' || estado.fase === 'coach';
  useEffect(() => { if (dentro) sincronizarPush(api, backend.modo); }, [dentro, ultimoUid.current]);

  const ctx = {
    api, backend, cola, aviso, enLinea, pendientes,
    modo: backend.modo,
    perfil: estado.perfil, atleta: estado.atleta, codigoFallido: estado.codigoFallido,
    recargar: () => resolver(true),
    // Al cerrar sesión, este móvil deja de recibir las notificaciones de esa cuenta
    salir: async () => { if (backend.modo === 'supabase') await desactivarPush(api); await backend.auth.salir(); resolver(true); },
    reiniciarDemo: () => { backend.reiniciar?.(); ultimoUid.current = undefined; resolver(true); },
  };

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
  else if (estado.fase === 'coach') vista = <CoachApp />;
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
      {toast && <div class={`toast ${toast.tipo === 'error' || toast.tipo === 'record' ? toast.tipo : ''}`} role="status" key={toast.id}>{toast.tipo === 'record' && <Icono n="trofeo" />}{toast.texto}
        {toast.accion && <button class="toast-accion" onClick={() => { const a = toast.accion; setToast(null); a.fn(); }}>{toast.accion.texto}</button>}</div>}
    </Ctx.Provider>
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
