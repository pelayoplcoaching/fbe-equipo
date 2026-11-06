// Service worker: la app abre sin conexión. Las llamadas a Supabase no se cachean nunca.
const VERSION = '__VERSION__';
const ARCHIVOS = __ARCHIVOS__;
const CACHE = `fbe-atletas-${VERSION}`;
// (v0.65) lo que se espera a la red al abrir la app si ya hay una página guardada
// (pulido 3.8: de 1,5 s a 0,7 s; con mala cobertura era segundo y medio de pantalla en blanco en cada arranque)
const ESPERA_RED_MS = 700;
// (pulido 3.7) La huella (SHA-256, en hexadecimal) de cada archivo de ARCHIVOS tal como sale de la construcción: al
// actualizar, lo que ya está guardado de la versión anterior con el mismo contenido no se vuelve a descargar
const HUELLAS = typeof __HUELLAS__ !== 'undefined' ? __HUELLAS__ : {};
// (pulido 3.7) El código que solo usa la demo (sus datos de ejemplo y su «base» en memoria, más de medio mega): no se
// descarga al instalar ni al actualizar; se guarda la primera vez que se abre la demo (mensaje «guardar-demo»)
const DEMO = typeof __DEMO_ARCHIVOS__ !== 'undefined' ? __DEMO_ARCHIVOS__ : [];
// v0.58: el modelo de los puntos del cuerpo (modelos/pose-<versión>/, unos 12 MB): no se descarga al instalar la app,
// sino la primera vez que se usa, y entonces se guarda aquí (una caché por versión del modelo, que sobrevive a las
// actualizaciones de la app)
const MODELOS = typeof __MODELOS__ !== 'undefined' ? __MODELOS__ : 'fbe-modelos';
// (revisión de seguridad v0.58) Solo los archivos del modelo, en su carpeta bajo el alcance de la app, sin lo que vaya tras
// «?» (la clave es la dirección limpia), y solo si llegan con el tipo de un modelo (no una página de error)
const MODELO_DIR = typeof __MODELO_DIR__ !== 'undefined' ? __MODELO_DIR__ : 'modelos/pose/';
const MODELO_ARCHIVOS = typeof __MODELO_ARCHIVOS__ !== 'undefined' ? __MODELO_ARCHIVOS__ : ['pose.js', 'pose_solution_packed_assets_loader.js', 'pose_solution_packed_assets.data',
  'pose_solution_simd_wasm_bin.js', 'pose_solution_simd_wasm_bin.wasm', 'pose_solution_wasm_bin.js', 'pose_solution_wasm_bin.wasm', 'pose_web.binarypb', 'pose_landmark_lite.tflite'];
const TIPO_MODELO = /^(text\/javascript|application\/javascript|application\/wasm|application\/octet-stream)\s*(;|$)/i;
function claveModelo(url) {
  const base = new URL(MODELO_DIR, self.registration.scope);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return null;
  const nombre = url.pathname.slice(base.pathname.length);
  return MODELO_ARCHIVOS.includes(nombre) ? base.href + nombre : null;
}

// (pulido 3.7) ¿Es esta respuesta guardada, byte a byte, el archivo de esta versión?
async function igualQueAhora(r, u) {
  const esperada = HUELLAS[u];
  if (!esperada || !r || !r.ok || r.status !== 200) return false;
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', await r.clone().arrayBuffer()));
  let hex = '';
  for (const x of bytes) hex += x.toString(16).padStart(2, '0');
  return hex === esperada;
}
// Instalar la versión nueva sin volver a descargar lo que no ha cambiado: cada archivo se busca en lo guardado de las
// versiones anteriores y, si es idéntico al de ahora (se comprueba su contenido, no su nombre), se copia; si no, se
// descarga. Antes, cada actualización bajaba la app entera (unos 4 MB), aunque hubiera cambiado una línea.
async function instalarReutilizando() {
  const nueva = await caches.open(CACHE);
  const viejas = await Promise.all((await caches.keys()).filter((k) => k.startsWith('fbe-atletas-') && k !== CACHE).map((k) => caches.open(k)));
  await Promise.all(ARCHIVOS.map(async (u) => {
    let r = null;
    for (const c of viejas) {
      try { const x = await c.match(u); if (x && await igualQueAhora(x, u)) { r = x; break; } } catch { /* se descarga */ }
    }
    if (!r) {
      r = await fetch(new Request(u, { cache: 'reload' }));
      if (!r.ok) throw new TypeError('descarga fallida');
    }
    await nueva.put(u, r);
  }));
}
self.addEventListener('install', (e) => {
  // La versión nueva se descarga y espera: la app ofrece «Actualizar» (o se activa sola al abrirla de cero)
  // (si reutilizar falla por lo que sea, se instala como siempre: todo de la red, o nada)
  const entera = () => caches.open(CACHE).then((c) => c.addAll(ARCHIVOS.map((u) => new Request(u, { cache: 'reload' }))));
  e.waitUntil(Object.keys(HUELLAS).length ? instalarReutilizando().catch(() => entera()) : entera());
});

// Lo de la demo que falte, a la caché de esta versión (lo pide la página cuando arranca en modo demo)
async function guardarDemo() {
  const c = await caches.open(CACHE);
  const faltan = [];
  for (const u of DEMO) { if (!(await c.match(u))) faltan.push(u); }
  if (faltan.length) await c.addAll(faltan);
}
self.addEventListener('message', (e) => {
  if (e.data === 'activar') self.skipWaiting();
  if (e.data === 'guardar-demo' && DEMO.length) e.waitUntil(guardarDemo().catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => (k.startsWith('fbe-atletas-') && k !== CACHE) || (k.startsWith('fbe-modelos-') && k !== MODELOS)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// v0.48: «Compartir → FBE Equipo» (Android): lo compartido llega aquí en un POST; se guarda en una caché aparte (solo
// en este móvil, hasta que la app lo coge, y entonces se borra) y se abre la app. Con «nosniff» y bajo una dirección que
// no existe (no se puede pedir desde ninguna página: nadie la sirve).
// v0.56: fotos, vídeos y PDF, hasta 10, para el chat (el coach elige la conversación); un vídeo solo, el atleta puede
// enviarlo también como vídeo de técnica. Solo los tipos y tamaños de los adjuntos de siempre: vídeo MP4, MOV o WebM y
// foto JPEG, PNG, WebP o HEIC de hasta LIMITE_MB (como LIMITE_ARCHIVO_MB en api.js: una prueba comprueba que
// coinciden), PDF de hasta LIMITE_PDF_MB (como PDF_MAX_MB). Lo demás no se guarda. (/compartir-video, el de la v0.48,
// sigue valiendo para quien tenga el manifiesto de antes.)
const COMPARTIDO = 'fbe-compartido';
const CLAVE_LISTA = 'https://fbe-compartido.invalid/lista';
const claveArchivo = (i) => `https://fbe-compartido.invalid/archivo/${i}`;
const TIPOS_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm'];
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const LIMITE_MB = 200;
const LIMITE_PDF_MB = 20;
const MAX_COMPARTIDOS = 10;
const valeCompartido = (x) => {
  if (!x || typeof x !== 'object' || !(x.size > 0)) return false;
  const t = String(x.type || '').toLowerCase();
  if (t === 'application/pdf') return x.size <= LIMITE_PDF_MB * 1024 * 1024;
  return (TIPOS_VIDEO.includes(t) || TIPOS_FOTO.includes(t)) && x.size <= LIMITE_MB * 1024 * 1024;
};
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.origin === self.location.origin && (url.pathname.endsWith('/compartir-video') || url.pathname.endsWith('/compartir'))) {
    e.respondWith((async () => {
      let n = 0;
      try {
        const datos = await e.request.formData();
        const fs = [...datos.getAll('archivos'), ...datos.getAll('video')].filter(valeCompartido).slice(0, MAX_COMPARTIDOS);
        const c = await caches.open(COMPARTIDO);
        // Lo de un «Compartir» anterior que no se llegó a coger, fuera
        for (const k of await c.keys()) await c.delete(k);
        for (const f of fs) {
          await c.put(claveArchivo(n), new Response(f, { headers: { 'content-type': String(f.type).toLowerCase(), 'x-content-type-options': 'nosniff', 'x-nombre': encodeURIComponent(String(f.name || 'archivo').slice(0, 120)) } }));
          n++;
        }
        if (n) await c.put(CLAVE_LISTA, new Response(JSON.stringify({ n }), { headers: { 'content-type': 'application/json', 'x-content-type-options': 'nosniff' } }));
      } catch { n = 0; }
      return Response.redirect(new URL(`./?compartido=${n ? '1' : '0'}#mensajes`, self.registration.scope).href, 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // La página y la configuración: primero red, para coger siempre la última versión
  // (v0.65) pero sin esperarla más de ESPERA_RED_MS si ya hay una guardada: con una cobertura que va y viene (la del gimnasio),
  // la app abre con la guardada al momento y la de la red, si llega, se queda para la próxima vez
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/config.js')) {
    const clave = e.request.mode === 'navigate' ? './' : e.request;
    const red = fetch(e.request).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(clave, copia)).catch(() => {}); }
      return r;
    });
    e.waitUntil(red.then(() => {}, () => {}));
    e.respondWith(caches.open(CACHE).then((c) => c.match(clave)).then((guardada) => {
      if (!guardada) return red;
      return Promise.race([red.catch(() => guardada), new Promise((ok) => { setTimeout(() => ok(guardada), ESPERA_RED_MS); })]);
    }));
    return;
  }
  // (v0.58) El modelo de los puntos del cuerpo: de su caché si ya está; si no, de la red, y se guarda para la próxima vez
  const clave = claveModelo(url);
  if (clave) {
    e.respondWith(caches.open(MODELOS).then((c) => c.match(clave).then((r) => r || fetch(clave, { credentials: 'same-origin' }).then((x) => {
      if (x.ok && x.status === 200 && TIPO_MODELO.test(x.headers.get('content-type') || '')) c.put(clave, x.clone()).catch(() => {});
      return x;
    }))));
    return;
  }
  // Lo demás (código, estilos, fuentes, iconos): de la caché de la app si está (nunca de otra, como la de lo compartido)
  e.respondWith(caches.open(CACHE).then((c) => c.match(e.request)).then((r) => r || fetch(e.request)));
});

// Notificaciones (Web Push). El servidor manda { id, titulo, cuerpo, url, etiqueta }, cifrado de extremo a
// extremo: el navegador lo descifra y aquí solo se muestra. Siempre se muestra (Safari retira el permiso a las
// webs que reciben avisos sin enseñarlos); si la app está abierta, además se le dice para que se ponga al día.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { cuerpo: e.data ? e.data.text() : '' }; }
  // (v0.55) «#mensajes/<atleta>»: la conversación de un mensaje (la del coach); (v0.57) «#videos/<vídeo>@<segundos>»: el
  // momento corregido de un vídeo; el resto, una pestaña
  const destino = typeof d.url === 'string' && (/^#[a-z]+(\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/.test(d.url)
    || /^#videos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(@[0-9]{1,4}(\.[0-9])?)?$/.test(d.url)) ? d.url : '';
  const url = new URL('./' + destino, self.registration.scope).href;
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) v.postMessage({ tipo: 'notificacion', url });
    // v0.48: una marca en el icono de la app (donde se puede); al abrirla, la app pone el número de verdad
    try { if (self.navigator && 'setAppBadge' in self.navigator) await self.navigator.setAppBadge().catch(() => {}); } catch { /* */ }
    const abiertas = typeof self.registration.getNotifications === 'function' ? await self.registration.getNotifications().catch(() => []) : [];
    const aviso = agruparChat(d, destino, abiertas);
    await self.registration.showNotification(aviso.titulo, {
      body: aviso.cuerpo, tag: aviso.tag, renotify: aviso.renotify, icon: 'icono-192.png', badge: 'insignia-96.png', lang: 'es', data: { url, n: aviso.n },
    });
  })());
});

// v0.55: los mensajes de una misma conversación se juntan en una sola notificación («3 mensajes nuevos de Ana»), con su
// etiqueta por conversación (#mensajes, la del atleta con su coach; #mensajes/<atleta>, la del coach con ese atleta).
// Sin el texto de los mensajes, como siempre (eso no sale nunca del servidor). El resto, como antes: su etiqueta.
function agruparChat(d, destino, abiertas) {
  const titulo = d.titulo || 'FBE Equipo';
  if (!/^#mensajes/.test(destino) || !['respuesta', 'mensaje'].includes(d.tipo || (/te ha (escrito|respondido)$/.test(titulo) ? 'mensaje' : ''))) {
    const tag = d.etiqueta || d.id || undefined;
    return { titulo, cuerpo: d.cuerpo || '', tag, renotify: !!(tag && d.repetir), n: 1 };
  }
  const tag = `chat:${destino}`;
  const previa = abiertas.find((x) => x.tag === tag);
  const n = Math.min(99, (Number(previa?.data?.n) || (previa ? 1 : 0)) + 1);
  const quien = (/^(.{1,30}) te ha (escrito|respondido)$/.exec(titulo) || [])[1] || '';
  const cuerpo = n === 1 ? (d.cuerpo || 'Mensaje nuevo') : `${n} mensajes nuevos${quien ? ` de ${quien}` : ''}`;
  return { titulo, cuerpo, tag, renotify: true, n };
}

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
