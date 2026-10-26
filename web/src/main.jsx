import { render } from 'preact';
import './estilos.css';
import { App } from './ui/App.jsx';
import { aplicarTema } from './ui/ajustes.js';

aplicarTema();
import { crearApi } from './datos/api.js';
import { crearCola } from './datos/cola.js';

/* global __DEMO__ */
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
  }
  await backend.iniciar();
  const api = crearApi(backend);
  const cola = crearCola(api);
  render(<App backend={backend} api={api} cola={cola} />, document.getElementById('app'));

  if (!__DEMO__ && 'serviceWorker' in navigator && location.protocol === 'https:') {
    // Versiones nuevas (v0.19): la nueva se instala en segundo plano y espera. Al abrir la app de cero ya se carga
    // la última (la página va primero a la red), así que la que espera se activa sin más. Con la app abierta (lo
    // normal en el móvil: días sin cerrarla), se comprueba al volver a ella y cada media hora, y se ofrece
    // «Actualizar» (AvisoVersion, en App.jsx).
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
        if (/^#[a-z]+$/.test(h) && h !== location.hash) location.hash = h;
        else window.dispatchEvent(new Event('fbe-notificacion'));
      }
      if (d.tipo === 'notificacion') window.dispatchEvent(new Event('fbe-notificacion'));
    });
  }
}

arrancar().catch((e) => {
  document.getElementById('app').innerHTML = `<div style="padding:24px;font-family:system-ui">No se ha podido iniciar la app: ${String(e.message || e).replace(/</g, '&lt;')}</div>`;
});
