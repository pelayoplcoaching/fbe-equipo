// Notificaciones en este navegador: comprobar si se pueden activar, activarlas (pedir permiso, suscribirse al
// servicio de push con la clave VAPID y apuntarlo en la base) y desactivarlas. Lo usan la hoja de
// Notificaciones, la tarjeta de Hoy y App (al entrar y al salir).
//
// En el navegador se guarda de quién es la suscripción ({ uid, endpoint }): así, al abrir la app, solo se
// pone al día la de la cuenta que la activó (si otra persona entra en este móvil, no se le activan solas, y
// si alguien la quitó desde otro móvil, no vuelve).
import { soportePush, esIos, claveServidor, normalizarB64url, describirDispositivo } from '../logica/notificaciones.js';
import { reportarError } from '../registro-errores.js';

// Al acabar de poner al día la suscripción al abrir la app (la hoja de Notificaciones se vuelve a leer)
export const EVENTO_PUSH = 'fbe-push-sincronizado';
const avisarHoja = () => { try { window.dispatchEvent(new Event(EVENTO_PUSH)); } catch { /* */ } };

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
// VAPID hay que rehacerla).
// v0.45 (aviso de un atleta: «se me desactivan cada vez que cierro la app», Android con la app instalada): al abrir ya
// no se quita nunca la suscripción por una señal dudosa. Antes, si el navegador decía un momento que el permiso no
// estaba dado, o si la base no encontraba la suscripción (p. ej. la había borrado el servidor por un fallo del
// servicio de push), se daba de baja aquí y había que volver a activarlas a mano. Ahora: sin permiso, no se toca
// nada (si de verdad se quitó, el servicio de push lo dirá al enviar y la base la borra); sin la suscripción en la
// base, se vuelve a apuntar. Cada caso raro se apunta en Errores de la app para poder verlo.
const rara = (mensaje) => reportarError(new Error(mensaje), 'push');
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
    if (Notification.permission !== 'granted') { rara(`push: al abrir, el permiso dice «${Notification.permission}» (no se toca la suscripción)`); return; }
    const clave = claveServidor(vapidPublica());
    if (sub && !mismaClave(sub.options?.applicationServerKey, clave)) {
      // Se cambiaron las claves: se rehace con las nuevas (con el permiso ya dado, no hace falta preguntar)
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
    if (!sub) { rara('push: al abrir, el navegador no tenía la suscripción: se rehace'); sub = await suscribir(await registro()); }
    const d = datosDe(sub);
    const sigue = await api.actualizarSuscripcion({ anterior: marca.endpoint, ...d, vapid: vapidPublica() });
    if (!sigue) {
      // La base ya no la tenía (la borró el servidor tras un fallo del servicio de push, o se quitó desde otro sitio):
      // con el permiso dado y la marca de esta cuenta, se vuelve a apuntar
      rara('push: al abrir, la base no tenía esta suscripción: se vuelve a apuntar');
      await api.registrarSuscripcion({ ...d, dispositivo: describirDispositivo(navigator.userAgent), vapid: vapidPublica() });
    }
    guardarMarca({ uid: marca.uid, endpoint: d.endpoint });
  } catch (e) { reportarError(e, 'push'); /* sin conexión o sin permiso para suscribirse sin tocar un botón: ya se hará la próxima vez */ }
  finally { avisarHoja(); }
}
