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
    navigator.serviceWorker.register('./sw.js').catch(() => {});
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
