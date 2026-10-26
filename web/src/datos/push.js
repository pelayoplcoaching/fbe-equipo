// Notificaciones en este navegador: comprobar si se pueden activar, activarlas (pedir permiso, suscribirse al
// servicio de push con la clave VAPID y apuntarlo en la base) y desactivarlas. Lo usan la hoja de
// Notificaciones, la tarjeta de Hoy y App (al entrar y al salir).
//
// En el navegador se guarda de quién es la suscripción ({ uid, endpoint }): así, al abrir la app, solo se
// pone al día la de la cuenta que la activó (si otra persona entra en este móvil, no se le activan solas, y
// si alguien la quitó desde otro móvil, no vuelve).
import { soportePush, esIos, claveServidor, normalizarB64url, describirDispositivo } from '../logica/notificaciones.js';

const ENDPOINT_VALIDO = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\/[!-~]+$/;
const CLAVE_LOCAL = 'fbe-push-v1';

export const vapidPublica = () => (typeof window !== 'undefined' && window.FBE_CONFIG?.vapidPublica) || '';
export const conEmail = () => !!(typeof window !== 'undefined' && window.FBE_CONFIG?.notificacionesEmail);

const leerMarca = () => { try { return JSON.parse(localStorage.getItem(CLAVE_LOCAL) || 'null'); } catch { return null; } };
const guardarMarca = (m) => { try { if (m) localStorage.setItem(CLAVE_LOCAL, JSON.stringify(m)); else localStorage.removeItem(CLAVE_LOCAL); } catch { /* */ } };

export function estadoPush(modo) {
  if (typeof window === 'undefined') return 'no_soportado';
  const nav = window.navigator;
  return soportePush({
    demo: modo === 'demo',
    vapid: vapidPublica(),
    sw: 'serviceWorker' in nav && window.location.protocol === 'https:',
    push: 'PushManager' in window,
    notificaciones: 'Notification' in window,
    permiso: 'Notification' in window ? window.Notification.permission : 'default',
    ios: esIos(nav.userAgent, nav.maxTouchPoints || 0),
    instalada: window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true,
  });
}

// El service worker activo (la primera vez que se abre la app instalada puede estar aún instalándose)
async function registro() {
  if (!(await navigator.serviceWorker.getRegistration())) await navigator.serviceWorker.register('./sw.js');
  const listo = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 15000))]);
  if (!listo) throw new Error('la app aún se está preparando en este móvil: vuelve a intentarlo en unos segundos');
  return listo;
}

export async function suscripcionActual() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    return reg ? await reg.pushManager.getSubscription() : null;
  } catch { return null; }
}

const mismaClave = (a, b) => {
  if (!a || !b) return false;
  const x = new Uint8Array(a), y = new Uint8Array(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

function datosDe(sub) {
  const j = sub.toJSON();
  if (!ENDPOINT_VALIDO.test(j.endpoint || '')) throw new Error('este navegador usa un servicio de notificaciones que la app no admite (prueba con Chrome, Edge, Firefox o Safari)');
  return { endpoint: j.endpoint, p256dh: normalizarB64url(j.keys?.p256dh), auth: normalizarB64url(j.keys?.auth) };
}

async function suscribir(reg) {
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveServidor(vapidPublica()) });
}

// Pide permiso (tiene que ser al tocar un botón) y suscribe este navegador. Devuelve 'activadas', 'bloqueado'
// o 'cancelado' (cerró la pregunta sin elegir).
export async function activarPush(api) {
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueado' : 'cancelado';
  const reg = await registro();
  let sub = await reg.pushManager.getSubscription();
  // Una suscripción hecha con otra clave (si se cambiaron las claves VAPID) ya no sirve
  if (sub && !mismaClave(sub.options?.applicationServerKey, claveServidor(vapidPublica()))) { await sub.unsubscribe().catch(() => {}); sub = null; }
  sub ||= await suscribir(reg);
  const d = datosDe(sub);
  await api.registrarSuscripcion({ ...d, dispositivo: describirDispositivo(navigator.userAgent), vapid: vapidPublica() });
  guardarMarca({ uid: api.uid(), endpoint: d.endpoint });
  return 'activadas';
}

// Quita este navegador (de la base y del servicio de push). No falla nunca: al cerrar sesión no debe molestar.
export async function desactivarPush(api) {
  const sub = await suscripcionActual();
  if (sub) {
    await api.borrarSuscripcion(sub.endpoint).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  guardarMarca(null);
}

// Sin sesión (se cerró en otro sitio, caducó, se cambió la contraseña): este móvil deja de recibir las de esa
// cuenta. La base no se puede tocar sin sesión; el servicio de push le dirá a la función que ya no existe.
export async function desactivarPushLocal() {
  try {
    const sub = await suscripcionActual();
    if (sub) await sub.unsubscribe();
  } catch { /* */ }
  guardarMarca(null);
}

// Al abrir la app con la sesión dentro: si este navegador tiene las notificaciones de esta cuenta, la base se
// queda con su suscripción al día (los navegadores la renuevan de vez en cuando, y si se cambiaron las claves
// VAPID hay que rehacerla). Si se quitaron desde otro móvil, aquí también se quitan.
export async function sincronizarPush(api, modo) {
  try {
    if (estadoPush(modo) !== 'ok') return;
    const marca = leerMarca();
    let sub = await suscripcionActual();
    if (!marca || marca.uid !== api.uid()) {
      // De otra cuenta (o de antes de saber de quién era): fuera, que nadie reciba lo de otro
      if (sub && marca) await desactivarPushLocal();
      return;
    }
    if (Notification.permission !== 'granted') { await desactivarPushLocal(); return; }
    const clave = claveServidor(vapidPublica());
    if (sub && !mismaClave(sub.options?.applicationServerKey, clave)) {
      // Se cambiaron las claves: se rehace con las nuevas (con el permiso ya dado, no hace falta preguntar)
      await sub.unsubscribe().catch(() => {});
      const reg = await registro();
      sub = await suscribir(reg);
      const d = datosDe(sub);
      await api.registrarSuscripcion({ ...d, dispositivo: describirDispositivo(navigator.userAgent), vapid: vapidPublica() });
      guardarMarca({ uid: marca.uid, endpoint: d.endpoint });
      return;
    }
    if (!sub) sub = await suscribir(await registro()); // el navegador la perdió: se rehace
    const d = datosDe(sub);
    const sigue = await api.actualizarSuscripcion({ anterior: marca.endpoint, ...d, vapid: vapidPublica() });
    if (!sigue) { await desactivarPushLocal(); return; }
    guardarMarca({ uid: marca.uid, endpoint: d.endpoint });
  } catch { /* sin conexión o sin permiso para suscribirse sin tocar un botón: ya se hará la próxima vez */ }
}
