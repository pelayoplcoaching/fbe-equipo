// Service worker: la app abre sin conexión. Las llamadas a Supabase no se cachean nunca.
const VERSION = '__VERSION__';
const ARCHIVOS = __ARCHIVOS__;
const CACHE = `fbe-atletas-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('fbe-atletas-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // La página y la configuración: primero red, para coger siempre la última versión
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/config.js')) {
    e.respondWith(fetch(e.request).then((r) => {
      const copia = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request.mode === 'navigate' ? './' : e.request, copia));
      return r;
    }).catch(() => caches.match(e.request.mode === 'navigate' ? './' : e.request)));
    return;
  }
  // Lo demás (código, estilos, fuentes, iconos): de la caché si está
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});

// Notificaciones (Web Push). El servidor manda { id, titulo, cuerpo, url, etiqueta }, cifrado de extremo a
// extremo: el navegador lo descifra y aquí solo se muestra. Siempre se muestra (Safari retira el permiso a las
// webs que reciben avisos sin enseñarlos); si la app está abierta, además se le dice para que se ponga al día.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { cuerpo: e.data ? e.data.text() : '' }; }
  const destino = typeof d.url === 'string' && /^#[a-z]+$/.test(d.url) ? d.url : '';
  const url = new URL('./' + destino, self.registration.scope).href;
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) v.postMessage({ tipo: 'notificacion', url });
    const tag = d.etiqueta || d.id || undefined;
    await self.registration.showNotification(d.titulo || 'FBE Equipo', {
      body: d.cuerpo || '', tag, renotify: !!(tag && d.repetir), icon: 'icono-192.png', badge: 'insignia-96.png', lang: 'es', data: { url },
    });
  })());
});

// Al tocarla: si la app ya está abierta, se trae delante y va a esa pestaña; si no, se abre ahí
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = ventanas.find((v) => v.url.startsWith(self.registration.scope));
    if (app) {
      await app.focus();
      app.postMessage({ tipo: 'abrir', url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
