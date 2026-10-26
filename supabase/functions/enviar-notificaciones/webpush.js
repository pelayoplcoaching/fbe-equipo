// Web Push sin dependencias: el mensaje cifrado de extremo a extremo con «aes128gcm» (RFC 8188 y RFC 8291) y
// firmado con VAPID (RFC 8292), solo con WebCrypto. Funciona igual en Deno (la función de Supabase) y en
// Node 20 o posterior (las pruebas, que lo descifran con otra implementación independiente).
const te = new TextEncoder();
const sutil = () => globalThis.crypto.subtle;

// Las direcciones de los servicios de push de los navegadores (las mismas que acepta la base de datos)
export const ENDPOINT_VALIDO = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\/[!-~]+$/;

export function b64url(bytes) {
  const b = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function deB64url(s) {
  const t = String(s).replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function juntar(...partes) {
  const out = new Uint8Array(partes.reduce((t, p) => t + p.length, 0));
  let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}

const CERO = new Uint8Array([0]);
const UNO = new Uint8Array([1]);

async function hmac(clave, datos) {
  const k = await sutil().importKey('raw', clave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await sutil().sign('HMAC', k, datos));
}

// HKDF-SHA-256 (RFC 5869) para salidas de hasta 32 bytes: un solo bloque
async function hkdf(sal, ikm, info, largo) {
  const prk = await hmac(sal, ikm);
  return (await hmac(prk, juntar(info, UNO))).slice(0, largo);
}

// Lo más que cabe: 4096 bytes en total, menos la cabecera (86), la etiqueta de AES-GCM (16) y el delimitador (1)
export const MAX_MENSAJE = 4096 - 86 - 16 - 1;

// Cifra el mensaje para una suscripción ({ p256dh, auth } en base64url). Devuelve el cuerpo de la petición:
// sal (16) · tamaño de registro (4) · largo de la clave (1) · clave pública efímera (65) · registro cifrado.
// «sal» y «efimeras» solo se pasan en las pruebas.
export async function cifrar(mensaje, { p256dh, auth }, { sal = null, efimeras = null } = {}) {
  const uaPublica = deB64url(p256dh);
  const secreto = deB64url(auth);
  if (uaPublica.length !== 65 || uaPublica[0] !== 4 || secreto.length !== 16) throw new Error('Claves de la suscripción no válidas');
  const datos = typeof mensaje === 'string' ? te.encode(mensaje) : new Uint8Array(mensaje);
  if (datos.length > MAX_MENSAJE) throw new Error('Mensaje demasiado largo para una notificación');
  const par = efimeras || await sutil().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublica = new Uint8Array(await sutil().exportKey('raw', par.publicKey));
  const uaClave = await sutil().importKey('raw', uaPublica, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const compartido = new Uint8Array(await sutil().deriveBits({ name: 'ECDH', public: uaClave }, par.privateKey, 256));
  // RFC 8291, 3.4: la clave de entrada sale del secreto ECDH, el secreto de autenticación y las dos claves públicas
  const ikm = await hkdf(secreto, compartido, juntar(te.encode('WebPush: info'), CERO, uaPublica, asPublica), 32);
  const s = sal || globalThis.crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(s, ikm, juntar(te.encode('Content-Encoding: aes128gcm'), CERO), 16);
  const nonce = await hkdf(s, ikm, juntar(te.encode('Content-Encoding: nonce'), CERO), 12);
  const clave = await sutil().importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // Un solo registro, el último: el mensaje y el delimitador 2, sin relleno
  const cifrado = new Uint8Array(await sutil().encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, clave, juntar(datos, new Uint8Array([2]))));
  const cabecera = new Uint8Array(16 + 4 + 1 + 65);
  cabecera.set(s, 0);
  new DataView(cabecera.buffer).setUint32(16, 4096);
  cabecera[20] = 65;
  cabecera.set(asPublica, 21);
  return juntar(cabecera, cifrado);
}

// Cabecera Authorization de VAPID: un JWT ES256 para el origen del servicio de push, válido 12 horas.
// vapid: { publica (65 bytes en base64url), privada (32 bytes en base64url), contacto ('mailto:…' o 'https://…') }
export async function cabeceraVapid(endpoint, { publica, privada, contacto }, ahora = Date.now()) {
  const pub = deB64url(publica);
  if (pub.length !== 65 || pub[0] !== 4 || deB64url(privada).length !== 32) throw new Error('Claves VAPID no válidas');
  if (!/^(mailto:|https:\/\/)/.test(contacto || '')) throw new Error('Falta el contacto de VAPID (mailto:… o https://…)');
  const cab = b64url(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const cuerpo = b64url(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(ahora / 1000) + 12 * 3600, sub: contacto })));
  const jwk = { kty: 'EC', crv: 'P-256', x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), d: privada, ext: true };
  const clave = await sutil().importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  // WebCrypto firma ya en el formato de JWS (r y s, 32 bytes cada uno)
  const firma = new Uint8Array(await sutil().sign({ name: 'ECDSA', hash: 'SHA-256' }, clave, te.encode(`${cab}.${cuerpo}`)));
  return `vapid t=${cab}.${cuerpo}.${b64url(firma)}, k=${publica}`;
}

// Comprueba que la clave pública y la privada VAPID son pareja (un error al pegarlas haría que todos los
// servicios de push rechazaran los envíos): firma con la privada y verifica con la pública.
export async function comprobarVapid({ publica, privada }) {
  const pub = deB64url(publica);
  if (pub.length !== 65 || pub[0] !== 4 || deB64url(privada).length !== 32) throw new Error('Claves VAPID no válidas');
  const jwk = { kty: 'EC', crv: 'P-256', x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), d: privada, ext: true };
  const priv = await sutil().importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const verif = await sutil().importKey('raw', pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const datos = te.encode('fbe');
  const firma = await sutil().sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, datos);
  if (!(await sutil().verify({ name: 'ECDSA', hash: 'SHA-256' }, verif, firma, datos))) {
    throw new Error('VAPID_PUBLICA y VAPID_PRIVADA no son pareja: vuelve a ponerlas con lo que dio «npm run claves-push»');
  }
}

// Envía una notificación a una suscripción ({ endpoint, p256dh, auth }). Devuelve { estado, ok, texto, esperar }
// (esperar: los segundos que pide el servicio con Retry-After, si los pide).
// ttl: segundos que el servicio de push la guarda si el móvil está apagado; tema: las que comparten tema se
// sustituyen en el servicio (para recordatorios que se quedan viejos). Un error que no es de red (claves que
// no valen, dirección no permitida) sale con «local»: reintentarlo daría lo mismo.
export async function enviarPush(sub, mensaje, vapid, { ttl = 86400, urgencia = 'normal', tema = null, fetch: f = globalThis.fetch, espera = 10000 } = {}) {
  let cuerpo, autorizacion;
  try {
    if (!ENDPOINT_VALIDO.test(sub.endpoint || '')) throw new Error('Dirección de push no permitida');
    cuerpo = await cifrar(mensaje, sub);
    autorizacion = await cabeceraVapid(sub.endpoint, vapid);
  } catch (e) {
    e.local = true;
    throw e;
  }
  const cabeceras = {
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(Math.max(0, Math.round(ttl))),
    Urgency: urgencia,
    Authorization: autorizacion,
  };
  if (tema) cabeceras.Topic = tema;
  // Sin seguir redirecciones: el mensaje solo va a la dirección del servicio de push
  const r = await f(sub.endpoint, { method: 'POST', headers: cabeceras, body: cuerpo, redirect: 'error', signal: AbortSignal.timeout(espera) });
  const ok = r.status >= 200 && r.status < 300;
  const texto = ok ? '' : (await r.text().catch(() => '')).slice(0, 120);
  if (ok) await r.body?.cancel?.().catch(() => {});
  const ra = Number(r.headers?.get?.('retry-after'));
  return { estado: r.status, ok, texto, esperar: Number.isFinite(ra) && ra > 0 ? Math.min(ra, 3600) : 0 };
}
