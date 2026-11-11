import { render } from 'preact';
import './estilos.css';
import './diseno.css';
import './pulido.css';
import './imagenes.css';
import './personal.css';
import './perfil.css';
import './equipo-belleza.css';
import './comunidad-viva.css';
import './estrecho.css';
import './recetario-equipo.css';
import './guias.css';
import './productos.css';
import './carrera.css';
import { App } from './ui/App.jsx';
import { aplicarTema } from './ui/ajustes.js';
import { instalarPulido } from './ui/pulido.js';
import { instalarLlegada } from './ui/llegada.js';
import { instalarPastilla } from './ui/pastilla.js';
import { instalarTacto } from './ui/tacto.js';
import { instalarPantalla } from './ui/pantalla.js';

aplicarTema();
instalarPulido();
instalarLlegada();
instalarPastilla();
instalarTacto();
instalarPantalla();
import { crearApi } from './datos/api.js';
import { crearCola } from './datos/cola.js';
import { instalarRegistro } from './registro-errores.js';
import { instalarRendimiento, enviarRendimiento } from './rendimiento.js';

/* global __DEMO__, __APP_VERSION__ */
// Android/Chrome avisa de que la app se puede instalar: se guarda para ofrecer el botón «Instalar»
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__fbeInstalar = e; });

async function arrancar() {
  const cfg = window.FBE_CONFIG || {};
  const conSupabase = !__DEMO__ && cfg.supabaseUrl && cfg.supabaseAnonKey && !new URLSearchParams(location.search).has('demo');
  let backend;
  if (conSupabase) {
    const { crearBackendSupabase } = await import('./datos/backend-supabase.js');
    backend = crearBackendSupabase({ url: cfg.supabaseUrl, anonKey: cfg.supabaseAnonKey });
  } else {
    const [{ crearBackendMemoria }, { semillaDemo }] = await Promise.all([import('./datos/backend-memoria.js'), import('./datos/semilla-demo.js')]);
    backend = crearBackendMemoria({ semilla: () => semillaDemo() });
    // (solo en la demo, para las pruebas: lo que haría el coach desde el SQL Editor, como pasar un vídeo a otro atleta)
    globalThis.__fbeDemo = backend;
    // (y mandar ya lo medido en este dispositivo: en la demo no se manda solo)
    globalThis.__fbeRendimiento = enviarRendimiento;
  }
  await backend.iniciar();
  const api = crearApi(backend);
  // Los errores que se escapen se apuntan en la base (Cuenta → Errores de la app); en la demo, no
  instalarRegistro((d) => api.registrarError(d), String(__APP_VERSION__));
  // (pulido 4) y cómo va la app en este dispositivo (Cuenta → Cómo va la app); en la demo solo se manda al abrir esa pantalla
  instalarRendimiento((fila) => api.apuntarRendimiento(fila), String(__APP_VERSION__), { automatico: backend.modo !== 'demo' });
  const cola = crearCola(api);
  // (pulido 3.9) lo apuntado sin conexión se ve encima de lo que diga la base hasta que se envía
  api.usarCola(() => cola.operaciones());
  render(<App backend={backend} api={api} cola={cola} />, document.getElementById('app'));

  // (v0.65) en localhost solo si se pide (localStorage «fbe-sw-local» = 1): para probar «abrir sin cobertura» con la app empaquetada
  const swLocal = location.hostname === 'localhost' && (() => { try { return localStorage.getItem('fbe-sw-local') === '1'; } catch { return false; } })();
  if (!__DEMO__ && 'serviceWorker' in navigator && (location.protocol === 'https:' || swLocal)) {
    // Versiones nuevas (v0.19): la nueva se instala en segundo plano y espera. Al abrir la app de cero ya se carga
    // la última (la página va primero a la red), así que la que espera se activa sin más. Con la app abierta (lo
    // normal en el móvil: días sin cerrarla), se comprueba al volver a ella y cada media hora, y se ofrece
    // «Actualizar» (AvisoVersion, en App.jsx).
    // (pulido 3.7) el código de la demo no va en la instalación: si esto es la demo, se le pide que lo guarde ahora
    if (!conSupabase) navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage('guardar-demo')).catch(() => {});
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      const ofrecer = (sw) => { window.__fbeVersionNueva = sw; window.dispatchEvent(new CustomEvent('fbe-version', { detail: sw })); };
      const vigilar = (sw) => sw?.addEventListener('statechange', () => { if (sw.state === 'installed' && navigator.serviceWorker.controller) ofrecer(sw); });
      if (reg.waiting && navigator.serviceWorker.controller) reg.waiting.postMessage('activar');
      vigilar(reg.installing);
      reg.addEventListener('updatefound', () => vigilar(reg.installing));
      const comprobar = () => { reg.update().catch(() => {}); };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') comprobar(); });
      setInterval(comprobar, 30 * 60 * 1000);
    }).catch(() => {});
    // Solo se recarga si lo ha pedido la persona («Actualizar»); el primer arranque también cambia de control
    let recargando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (recargando || !window.__fbeActualizando) return;
      recargando = true;
      location.reload();
    });
    // Lo que manda el service worker: «abrir» (se tocó una notificación con la app ya abierta) o «notificacion»
    // (ha llegado una con la app a la vista)
    navigator.serviceWorker.addEventListener('message', (e) => {
      const d = e.data || {};
      if (d.tipo === 'abrir' && typeof d.url === 'string') {
        const h = new URL(d.url, location.href).hash;
        // (v0.55) también «#mensajes/<atleta>»: la conversación de esa notificación; (v0.57) y «#videos/<vídeo>@<segundos>»
        if ((/^#[a-z]+(\/[0-9a-f-]{36})?$/.test(h) || /^#videos\/[0-9a-f-]{36}(@[0-9]{1,4}(\.[0-9])?)?$/.test(h)) && h !== location.hash) location.hash = h;
        else window.dispatchEvent(new Event('fbe-notificacion'));
      }
      if (d.tipo === 'notificacion') window.dispatchEvent(new Event('fbe-notificacion'));
    });
  }
}

arrancar().catch((e) => {
  document.getElementById('portada')?.remove(); document.getElementById('tc-portada')?.remove();
  document.getElementById('app').innerHTML = `<div style="padding:24px;font-family:system-ui">No se ha podido iniciar la app: ${String(e.message || e).replace(/</g, '&lt;')}</div>`;
});
