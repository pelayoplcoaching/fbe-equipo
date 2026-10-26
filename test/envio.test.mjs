// La función que envía las notificaciones (supabase/functions/enviar-notificaciones): el cifrado contra el
// ejemplo del RFC 8291 y contra otra implementación independiente (http_ece), la firma VAPID con Node, los
// reintentos y móviles caducados, el email, quién puede llamarla y, de principio a fin, con la base real.
// Uso: node test/envio.test.mjs
import { createRequire } from 'node:module';
import nodeCrypto from 'node:crypto';
import { PGlite, types } from '@electric-sql/pglite';
import { aplicarEsquema } from './esquema.mjs';
import { cifrar, cabeceraVapid, enviarPush, b64url, deB64url, MAX_MENSAJE } from '../supabase/functions/enviar-notificaciones/webpush.js';
import { atender, enviarPendientes, componerEmail, iguales, clienteBase } from '../supabase/functions/enviar-notificaciones/envio.js';

const ece = createRequire(import.meta.url)('http_ece');
let ok = 0, fallos = 0;
const check = (cond, msg) => { if (cond) { ok++; console.log('  ✓', msg); } else { fallos++; console.log('  ✗', msg); } };
const lanza = async (fn) => { try { await fn(); return false; } catch { return true; } };

// Un «navegador»: su par de claves y su secreto, como los crea el móvil al activar las notificaciones
function navegador(n = 1) {
  const ecdh = nodeCrypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = nodeCrypto.randomBytes(16);
  return {
    ecdh, authBuf: auth,
    sub: { id: `sub-${n}`, endpoint: `https://fcm.googleapis.com/fcm/send/movil-${n}`, p256dh: b64url(ecdh.getPublicKey()), auth: b64url(auth) },
    descifrar: (cuerpo) => ece.decrypt(Buffer.from(cuerpo), { version: 'aes128gcm', privateKey: ecdh, authSecret: auth }).toString('utf8'),
  };
}
const parVapid = async () => {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
  return { publica: b64url(Buffer.concat([Buffer.from([4]), deB64url(jwk.x), deB64url(jwk.y)])), privada: jwk.d, contacto: 'mailto:coach@fbe.test' };
};
const vapid = await parVapid();

console.log('Cifrado (RFC 8291)');
{
  // El ejemplo del propio RFC 8291 (sección 5), byte a byte
  const asPriv = 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw';
  const asPub = deB64url('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
  const efimeras = {
    privateKey: await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: asPriv, x: b64url(asPub.slice(1, 33)), y: b64url(asPub.slice(33)), ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']),
    publicKey: await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, true, []),
  };
  const cuerpo = await cifrar('When I grow up, I want to be a watermelon',
    { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' },
    { sal: deB64url('DGv6ra1nlYgDCS1FRnbzlw'), efimeras });
  check(b64url(cuerpo) === 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    'da exactamente el resultado del ejemplo del RFC 8291');
  const nav = navegador();
  const texto = JSON.stringify({ titulo: 'Pelayo te ha respondido', cuerpo: 'En Pierna A · ñandú 💪', url: '#hoy' });
  check(nav.descifrar(await cifrar(texto, nav.sub)) === texto, 'otra implementación independiente (http_ece) lo descifra con las claves del navegador (también tildes y emojis)');
  const c1 = await cifrar(texto, nav.sub);
  const c2 = await cifrar(texto, nav.sub);
  check(Buffer.compare(Buffer.from(c1.slice(0, 16)), Buffer.from(c2.slice(0, 16))) !== 0 && Buffer.compare(Buffer.from(c1.slice(21, 86)), Buffer.from(c2.slice(21, 86))) !== 0,
    'cada envío lleva su propia sal y su clave efímera');
  check(new DataView(c1.buffer).getUint32(16) === 4096 && c1[20] === 65 && c1[21] === 4, 'cabecera aes128gcm: registro de 4096 y la clave pública efímera');
  check(nav.descifrar(await cifrar('', nav.sub)) === '' && nav.descifrar(await cifrar('x'.repeat(MAX_MENSAJE), nav.sub)) === 'x'.repeat(MAX_MENSAJE), 'del mensaje vacío al más largo que cabe');
  check(await lanza(() => cifrar('x'.repeat(MAX_MENSAJE + 1), nav.sub)), 'uno más largo, no');
  check(await lanza(() => cifrar('x', { p256dh: nav.sub.p256dh, auth: 'corta' })) && await lanza(() => cifrar('x', { p256dh: b64url(Buffer.alloc(65, 1)), auth: nav.sub.auth })),
    'claves de suscripción mal formadas, rechazadas');
  const otro = navegador(2);
  check(await lanza(async () => otro.descifrar(await cifrar(texto, nav.sub))), 'nadie más puede leerlo (otro navegador no lo descifra)');
}

console.log('\nFirma VAPID (RFC 8292)');
{
  const ahora = Date.now();
  const cab = await cabeceraVapid('https://fcm.googleapis.com/fcm/send/abc', vapid, ahora);
  const [, jwt, k] = cab.match(/^vapid t=([^,]+), k=(.+)$/) || [];
  const [h, p, firma] = jwt.split('.');
  const claims = JSON.parse(Buffer.from(p, 'base64url'));
  const pub = deB64url(vapid.publica);
  const clave = nodeCrypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33)) }, format: 'jwk' });
  const valida = nodeCrypto.verify('sha256', Buffer.from(`${h}.${p}`), { key: clave, dsaEncoding: 'ieee-p1363' }, Buffer.from(firma, 'base64url'));
  check(valida && JSON.parse(Buffer.from(h, 'base64url')).alg === 'ES256', 'Node verifica la firma ES256 con la clave pública');
  check(claims.aud === 'https://fcm.googleapis.com' && claims.sub === 'mailto:coach@fbe.test' && claims.exp === Math.floor(ahora / 1000) + 43200 && k === vapid.publica,
    'para el origen del servicio de push, con contacto, válida 12 horas, y con la clave pública');
  check(await lanza(() => cabeceraVapid('https://fcm.googleapis.com/x', { ...vapid, contacto: '' })) && await lanza(() => cabeceraVapid('https://fcm.googleapis.com/x', { ...vapid, privada: 'abc' })),
    'sin contacto o con claves mal puestas, no firma');
}

console.log('\nEnvío a un móvil');
{
  const nav = navegador();
  const peticiones = [];
  const f = async (url, op) => { peticiones.push({ url, op }); return new Response('', { status: 201 }); };
  const r = await enviarPush(nav.sub, '{"titulo":"Hola"}', vapid, { ttl: 3600, tema: 'habitos', fetch: f });
  const { url, op } = peticiones[0];
  check(r.ok && url === nav.sub.endpoint && op.method === 'POST', 'POST a la dirección del navegador');
  check(op.headers['Content-Encoding'] === 'aes128gcm' && op.headers.TTL === '3600' && op.headers.Urgency === 'normal' && op.headers.Topic === 'habitos' && /^vapid t=/.test(op.headers.Authorization),
    'con cifrado aes128gcm, TTL, urgencia, tema y VAPID');
  check(nav.descifrar(op.body) === '{"titulo":"Hola"}', 'y el móvil puede leerlo');
  check(await lanza(() => enviarPush({ ...nav.sub, endpoint: 'https://atacante.example.com/x' }, 'x', vapid, { fetch: f })) && peticiones.length === 1,
    'a una dirección que no es de un servicio de push no se envía nada');
}

console.log('\nUna pasada de envío');
const lote = (navs) => [
  { id: 'n1', usuario_id: 'u-ana', tipo: 'respuesta', titulo: 'Pelayo te ha respondido', cuerpo: 'En Pierna A', url: '#hoy', caduca_en: new Date(Date.now() + 864e5).toISOString(), email: null, suscripciones: [navs.a1.sub, navs.a2.sub] },
  { id: 'n2', usuario_id: 'u-ana', tipo: 'habitos', titulo: 'Te quedan 2 hábitos de hoy', cuerpo: 'Apúntalo en Hoy.', url: '#hoy', caduca_en: new Date(Date.now() + 3 * 3600e3).toISOString(), email: null, suscripciones: [navs.a1.sub, navs.a2.sub] },
  { id: 'n3', usuario_id: 'u-luis', tipo: 'semana', titulo: 'Tu semana ya está lista', cuerpo: null, url: '#semana', caduca_en: new Date(Date.now() + 864e5).toISOString(), email: null, suscripciones: [navs.l.sub] },
  { id: 'n4', usuario_id: 'u-rosa', tipo: 'aviso', titulo: 'Aviso de Pelayo', cuerpo: 'Sin check-in <esta> semana', url: '#hoy', caduca_en: new Date(Date.now() + 864e5).toISOString(), email: 'rosa@test', suscripciones: [] },
  { id: 'n5', usuario_id: 'u-rosa', tipo: 'respuesta', titulo: 'Pelayo te ha respondido', cuerpo: 'En tu vídeo', url: '#hoy', caduca_en: new Date(Date.now() + 864e5).toISOString(), email: 'rosa@test', suscripciones: [] },
  { id: 'n6', usuario_id: 'u-mar', tipo: 'semana', titulo: 'Tu semana ya está lista', cuerpo: null, url: '#semana', caduca_en: new Date(Date.now() + 864e5).toISOString(), email: null, suscripciones: [navs.m.sub] },
];
{
  const navs = { a1: navegador(1), a2: navegador(2), l: navegador(3), m: navegador(4) };
  navs.a2.sub.endpoint = 'https://updates.push.services.mozilla.com/wpush/v2/caducada';
  navs.l.sub.endpoint = 'https://web.push.apple.com/ocupado';
  navs.m.sub.endpoint = 'https://fcm.googleapis.com/fcm/send/mal';
  const llamadas = [];
  const db = {
    async rpc(nombre, args) {
      llamadas.push([nombre, args]);
      if (nombre === 'crear_recordatorios') return 2;
      if (nombre === 'notificaciones_por_enviar') return lote(navs);
      return null;
    },
  };
  const recibido = [];
  const emails = [];
  const f = async (url, op) => {
    if (url === 'https://api.resend.com/emails') { emails.push(JSON.parse(op.body)); return new Response('{"id":"e1"}', { status: 200 }); }
    if (url.includes('caducada')) return new Response('', { status: 410 });
    if (url.includes('ocupado')) return new Response('slow down', { status: 429 });
    if (url.includes('/mal')) return new Response('bad jwt', { status: 403 });
    recibido.push({ url, op, texto: navs.a1.descifrar(op.body) });
    return new Response('', { status: 201 });
  };
  const env = { VAPID_PUBLICA: vapid.publica, VAPID_PRIVADA: vapid.privada, AVISOS_CONTACTO: vapid.contacto, RESEND_API_KEY: 're_x', AVISOS_REMITENTE: 'FBE Equipo <avisos@fbe.test>', APP_URL: 'https://atletas.fbe.test' };
  const resumen = await enviarPendientes({ env, db, fetch: f });
  const res = llamadas.find(([n]) => n === 'notificaciones_resultado')[1].p_resultado;
  check(llamadas[0][0] === 'crear_recordatorios' && llamadas[1][1].p_email === true, 'crea los recordatorios que tocan y toma la cola (con email, porque está configurado)');
  const msgs = recibido.map((x) => JSON.parse(x.texto));
  check(msgs.length === 2 && msgs[0].titulo === 'Pelayo te ha respondido' && msgs[0].url === '#hoy' && msgs[0].etiqueta === 'n1' && msgs[1].etiqueta === 'habitos',
    'a Ana le llegan las dos (cada respuesta con su etiqueta; los recordatorios, con la del tipo, para que el de hoy sustituya al de ayer)');
  check(recibido[1].op.headers.Topic === 'habitos' && !recibido[0].op.headers.Topic && Number(recibido[1].op.headers.TTL) <= 3 * 3600, 'el recordatorio, con tema y caducidad cortos');
  check(res.enviadas.some((x) => x.id === 'n1' && x.canal === 'push') && res.suscripciones_ok.join() === 'sub-1' && res.suscripciones_caducadas.join() === 'sub-2',
    'el móvil que el servicio da por desaparecido (410) se borra y no se reintenta con él');
  check(res.reintentar.some((x) => x.id === 'n3' && x.error.startsWith('HTTP 429')), 'si el servicio está ocupado (429 o 5xx), se reintenta más tarde');
  check(res.fallidas.some((x) => x.id === 'n6' && x.error.startsWith('HTTP 403')) && res.suscripciones_error.some((x) => x.id === 'sub-4'), 'un rechazo (403) es un fallo, y queda apuntado en ese móvil');
  check(emails.length === 1 && emails[0].to[0] === 'rosa@test' && emails[0].subject === '2 novedades en FBE Equipo' && emails[0].from === env.AVISOS_REMITENTE,
    'Rosa (sin móvil, con email) recibe un solo email con las dos');
  check(emails[0].html.includes('&lt;esta&gt;') && !emails[0].html.includes('<esta>') && emails[0].text.includes('https://atletas.fbe.test/#hoy'), 'el texto va escapado en el HTML, con el enlace a la app');
  check(res.enviadas.filter((x) => x.canal === 'email').length === 2, 'y se apuntan como enviadas por email (la base no le manda otro en una hora)');
  check(resumen.tomadas === 6 && resumen.enviadas === 4 && resumen.recordatorios === 2 && resumen.moviles_borrados === 1, 'devuelve un resumen');
  llamadas.length = 0;
  emails.length = 0;
  await enviarPendientes({ env: { ...env, RESEND_API_KEY: '' }, db, fetch: f, recordatorios: false });
  const res2 = llamadas.find(([n]) => n === 'notificaciones_resultado')[1].p_resultado;
  check(!llamadas.some(([n]) => n === 'crear_recordatorios') && llamadas[0][1].p_email === false && emails.length === 0 && res2.fallidas.some((x) => x.id === 'n4'),
    'sin email configurado, no se envían emails; y si no se piden, no se crean recordatorios');
  const vacio = { rpc: async (n) => (n === 'notificaciones_por_enviar' ? [] : 0) };
  const llamadasVacio = [];
  await enviarPendientes({ env, db: { rpc: async (n, a) => { llamadasVacio.push(n); return vacio.rpc(n, a); } }, fetch: f });
  check(!llamadasVacio.includes('notificaciones_resultado'), 'sin nada en la cola, no hace nada más');
  check(componerEmail([{ titulo: 'Aviso de Pelayo', cuerpo: null, url: '#hoy' }]).asunto === 'Aviso de Pelayo', 'con una sola, el asunto es su título');
  check(iguales('abc', 'abc') && !iguales('abc', 'abd') && !iguales('abc', 'abcd') && !iguales('', 'a'), 'el secreto se compara entero');
}

console.log('\nLo que encontraron las revisiones');
{
  const base = { VAPID_PUBLICA: vapid.publica, VAPID_PRIVADA: vapid.privada, AVISOS_CONTACTO: vapid.contacto };
  const noti = (id, usuario, subs, extra = {}) => ({ id, usuario_id: usuario, tipo: 'respuesta', titulo: 'Pelayo te ha respondido', cuerpo: 'En Pierna A', url: '#hoy', caduca_en: new Date(Date.now() + 864e5).toISOString(), email: null, suscripciones: subs, ...extra });
  const dbCon = (lote, { fallarResultado = 0 } = {}) => {
    const resultados = [];
    let fallos = fallarResultado;
    return { resultados, rpc: async (n, a) => {
      if (n === 'notificaciones_por_enviar') return lote;
      if (n === 'notificaciones_resultado') { if (fallos-- > 0) throw new Error('HTTP 503'); resultados.push(a.p_resultado); }
      return 0;
    } };
  };
  // Un servicio que no contesta no deja a los demás sin su notificación ni la pasada sin apuntar
  const lenta = navegador(21); lenta.sub.endpoint = 'https://wns2-par02p.notify.windows.com/w/?token=cuelga';
  const rapida = navegador(22);
  const db1 = dbCon([noti('a1', 'u-lenta', [lenta.sub]), noti('a2', 'u-rapida', [rapida.sub])]);
  const fCuelga = (url, op) => (url.includes('cuelga')
    ? new Promise((_, rej) => op.signal.addEventListener('abort', () => rej(op.signal.reason)))
    : Promise.resolve(new Response('', { status: 201 })));
  const t0 = Date.now();
  const vivo = setInterval(() => {}, 50); // (en Node, el temporizador de AbortSignal.timeout no mantiene vivo el proceso)
  await enviarPendientes({ env: base, db: db1, fetch: fCuelga, recordatorios: false, espera: 150 });
  clearInterval(vivo);
  const r1 = db1.resultados.flatMap((x) => [...x.enviadas, ...x.reintentar.map((y) => ({ ...y, reintentar: true }))]);
  check(Date.now() - t0 < 3000 && r1.some((x) => x.id === 'a2' && x.canal === 'push') && r1.some((x) => x.id === 'a1' && x.reintentar),
    'un servicio de push que no contesta se abandona a los pocos segundos (se reintenta luego) y los demás reciben la suya');
  // El resultado se apunta por tandas, con reintentos
  const db2 = dbCon([noti('b1', 'u1', [navegador(23).sub]), noti('b2', 'u2', [navegador(24).sub]), noti('b3', 'u3', [navegador(25).sub])], { fallarResultado: 1 });
  await enviarPendientes({ env: base, db: db2, fetch: async () => new Response('', { status: 201 }), recordatorios: false, enParalelo: 1 });
  check(db2.resultados.length === 3 && db2.resultados.every((x) => x.enviadas.length === 1), 'lo que se envía se apunta según se envía (por tandas), y si la base falla un momento se reintenta');
  // Sin tiempo: lo que falta se deja para el siguiente minuto
  const db3 = dbCon([noti('c1', 'u1', [navegador(26).sub])]);
  let llamadas = 0;
  await enviarPendientes({ env: base, db: db3, fetch: async () => { llamadas++; return new Response('', { status: 201 }); }, recordatorios: false, plazoMs: -1 });
  check(llamadas === 0 && db3.resultados[0].reintentar[0]?.id === 'c1', 'si se acaba el tiempo de la pasada, lo que falta queda para la siguiente');
  // Claves VAPID cambiadas: los móviles activados con la anterior ya no pueden recibir nada
  const viejo = navegador(27); viejo.sub.vapid = 'B' + 'Z'.repeat(86);
  const db4 = dbCon([noti('d1', 'u-rosa', [viejo.sub], { email: 'rosa@test' })]);
  let aViejo = 0; const emails4 = [];
  await enviarPendientes({ env: { ...base, RESEND_API_KEY: 're', AVISOS_REMITENTE: 'x <x@fbe.test>' }, db: db4, recordatorios: false,
    fetch: async (url, op) => { if (url.includes('resend')) { emails4.push(op); return new Response('{}', { status: 200 }); } aViejo++; return new Response('', { status: 403 }); } });
  check(aViejo === 0 && db4.resultados[0].suscripciones_caducadas.includes(viejo.sub.id) && emails4.length === 1 && db4.resultados[0].enviadas[0]?.canal === 'email',
    'un móvil activado con otras claves VAPID se retira sin intentarlo, y si la cuenta tiene el email, le llega por email');
  // Rechazos 401/403 repetidos: al tercero seguido, fuera
  const rechaza = navegador(28); rechaza.sub.fallos = 2;
  const db5 = dbCon([noti('e1', 'u5', [rechaza.sub])]);
  await enviarPendientes({ env: base, db: db5, recordatorios: false, fetch: async () => new Response('bad', { status: 403 }) });
  check(db5.resultados[0].suscripciones_caducadas.includes(rechaza.sub.id) && db5.resultados[0].fallidas[0]?.id === 'e1', 'un móvil que el servicio rechaza tres veces seguidas (401/403) se retira');
  // Claves del navegador que no valen: no se reintenta
  const rota = navegador(29); rota.sub.p256dh = 'B' + 'A'.repeat(86);
  const db6 = dbCon([noti('f1', 'u6', [rota.sub])]);
  await enviarPendientes({ env: base, db: db6, recordatorios: false, fetch: async () => new Response('', { status: 201 }) });
  check(db6.resultados[0].suscripciones_caducadas.includes(rota.sub.id) && db6.resultados[0].fallidas[0]?.id === 'f1' && !db6.resultados[0].reintentar.length,
    'un error que no es de red (claves que no son un punto de la curva) no se reintenta: se retira ese móvil');
  // Retry-After
  const ocupado = navegador(30);
  const db7 = dbCon([noti('g1', 'u7', [ocupado.sub])]);
  await enviarPendientes({ env: base, db: db7, recordatorios: false, fetch: async () => new Response('', { status: 429, headers: { 'Retry-After': '120' } }) });
  check(db7.resultados[0].reintentar[0]?.esperar === 120, 'si el servicio pide esperar (Retry-After), se espera lo que pide');
  // Las claves VAPID tienen que ser pareja
  const otra = await parVapid();
  check(await lanza(() => enviarPendientes({ env: { ...base, VAPID_PRIVADA: otra.privada }, db: dbCon([]), recordatorios: false })), 'si VAPID_PUBLICA y VAPID_PRIVADA no son pareja, no se envía nada (y se dice)');
  // Urgencia y recordatorios que avisan otra vez
  const urg = navegador(31); const vistos = [];
  const db8 = dbCon([noti('h1', 'u8', [urg.sub]), noti('h2', 'u8', [urg.sub], { tipo: 'semana', titulo: 'Tu semana ya está lista' }), noti('h3', 'u8', [urg.sub], { tipo: 'habitos', titulo: 'Te queda un hábito de hoy' })]);
  await enviarPendientes({ env: base, db: db8, recordatorios: false, fetch: async (url, op) => { vistos.push({ u: op.headers.Urgency, m: JSON.parse(urg.descifrar(op.body)) }); return new Response('', { status: 201 }); } });
  check(vistos[0].u === 'high' && vistos[1].u === 'normal' && vistos[2].m.repetir === true && !vistos[0].m.repetir, 'las respuestas y los recordatorios, con prioridad alta (llegan aunque el móvil ahorre batería); el recordatorio vuelve a sonar aunque siga el de ayer');
}

console.log('\nQuién puede llamarla');
{
  const env = { SUPABASE_URL: 'https://ref.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_xyz', VAPID_PUBLICA: vapid.publica, VAPID_PRIVADA: vapid.privada,
    AVISOS_CONTACTO: vapid.contacto, AVISOS_SECRETO: 'secreto-largo-del-programador', APP_URL: 'https://atletas.fbe.test/app/' };
  const vistas = [];
  const f = async (url, op = {}) => {
    vistas.push({ url, op });
    if (url.endsWith('/auth/v1/user')) return op.headers.Authorization === 'Bearer a.b.c' ? Response.json({ id: 'u1' }) : new Response('{}', { status: 401 });
    if (url.endsWith('/rpc/crear_recordatorios')) return Response.json(0);
    if (url.endsWith('/rpc/notificaciones_por_enviar')) return Response.json([]);
    return new Response('', { status: 500 });
  };
  const pedir = (cab = {}, metodo = 'POST') => atender(new Request('https://ref.supabase.co/functions/v1/enviar-notificaciones', { method: metodo, headers: cab, body: metodo === 'POST' ? '{}' : undefined }), { env, fetch: f });
  const pre = await pedir({}, 'OPTIONS');
  check(pre.status === 204 && pre.headers.get('Access-Control-Allow-Origin') === 'https://atletas.fbe.test' && /authorization/.test(pre.headers.get('Access-Control-Allow-Headers')), 'la app puede llamarla desde su dominio (CORS)');
  check((await pedir({}, 'GET')).status === 405, 'solo con POST');
  check((await pedir()).status === 401 && (await pedir({ 'x-fbe-secreto': 'otro' })).status === 401 && (await pedir({ Authorization: 'Bearer x.y.z' })).status === 401,
    'sin secreto ni sesión válidos: no autorizado');
  vistas.length = 0;
  const prog = await pedir({ 'x-fbe-secreto': env.AVISOS_SECRETO });
  check(prog.status === 200 && vistas.some((v) => v.url.endsWith('/rpc/crear_recordatorios')), 'el programador (con su secreto) envía y crea los recordatorios');
  const rpcCab = vistas.find((v) => v.url.includes('/rpc/')).op.headers;
  check(rpcCab.apikey === env.SUPABASE_SERVICE_ROLE_KEY && !rpcCab.Authorization, 'con las claves nuevas de Supabase, la de servicio va solo en «apikey»');
  check((await clienteBase({ ...env, SUPABASE_SERVICE_ROLE_KEY: 'h.p.f' }, async (u, op) => Response.json(op.headers.Authorization)).rpc('x')) === 'Bearer h.p.f',
    'con la antigua (un JWT), también como Bearer');
  vistas.length = 0;
  const usr = await pedir({ Authorization: 'Bearer a.b.c' });
  check(usr.status === 200 && !vistas.some((v) => v.url.endsWith('/rpc/crear_recordatorios')) && vistas.some((v) => v.url.endsWith('/rpc/notificaciones_por_enviar')),
    'una sesión de la app solo envía lo que ya está en la cola (para que llegue al momento)');
  check(JSON.stringify(await usr.json()) === '{"ok":true}', 'y no le cuenta nada de las notificaciones de los demás');
  vistas.length = 0;
  const otraVez = await pedir({ Authorization: 'Bearer a.b.c' });
  check(otraVez.status === 200 && !vistas.some((v) => v.url.includes('/rpc/')), 'dos llamadas seguidas desde la app: la segunda no hace nada (el programador se encarga del resto)');
  const nuevaClave = clienteBase({ ...env, SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_nueva' }) }, async (u, op) => Response.json(op.headers.apikey));
  check((await nuevaClave.rpc('x')) === 'sb_secret_nueva', 'con las claves nuevas de Supabase, la de servicio sale de SUPABASE_SECRET_KEYS');
  const sinSecreto = await atender(new Request('https://x/f', { method: 'POST', headers: { 'x-fbe-secreto': 'algo' } }), { env: { ...env, AVISOS_SECRETO: '' }, fetch: f });
  check(sinSecreto.status === 500 && (await sinSecreto.json()).error.includes('AVISOS_SECRETO'), 'si el programador llama y falta AVISOS_SECRETO, se dice');
  const dosApps = await atender(new Request('https://x/f', { method: 'OPTIONS', headers: { Origin: 'https://pelayo.github.io' } }), { env: { ...env, APP_URL: 'https://atletas.fbe.test, https://pelayo.github.io/atletas/' }, fetch: f });
  check(dosApps.headers.get('Access-Control-Allow-Origin') === 'https://pelayo.github.io', 'la app puede estar en más de una dirección (APP_URL con comas)');
  const mal = await atender(new Request('https://x/f', { method: 'POST', headers: { 'x-fbe-secreto': env.AVISOS_SECRETO } }), { env: { ...env, VAPID_PRIVADA: '' }, fetch: f });
  check(mal.status === 500 && (await mal.json()).error.includes('VAPID_PRIVADA'), 'si falta un secreto, dice cuál');
  const errorOriginal = console.error;
  console.error = () => {};
  const roto = await atender(new Request('https://x/f', { method: 'POST', headers: { 'x-fbe-secreto': env.AVISOS_SECRETO } }), { env, fetch: async () => new Response('detalle interno', { status: 500 }) });
  console.error = errorOriginal;
  check(roto.status === 500 && !(await roto.text()).includes('detalle interno'), 'si la base falla, responde con un error sin detalles internos');
}

console.log('\nEl service worker (lo que pasa en el móvil)');
{
  const { readFileSync } = await import('node:fs');
  const codigo = readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8').replace('__VERSION__', 'x').replace('__ARCHIVOS__', '[]');
  const oyentes = {};
  const mostradas = [];
  const mensajes = [];
  let abierta = null;
  let enfocada = 0;
  const ventanas = [];
  const self = {
    addEventListener: (t, f) => { oyentes[t] = f; },
    registration: { scope: 'https://atletas.fbe.test/app/', showNotification: async (t, o) => { mostradas.push({ t, o }); } },
    clients: { matchAll: async () => ventanas, openWindow: async (u) => { abierta = u; }, claim: async () => {} },
    skipWaiting: () => {}, location: { origin: 'https://atletas.fbe.test' },
  };
  new Function('self', 'caches', codigo)(self, {});
  const push = async (datos) => {
    let pr;
    oyentes.push({ data: { json: () => JSON.parse(datos), text: () => datos }, waitUntil: (x) => { pr = x; } });
    await pr;
  };
  await push(JSON.stringify({ id: 'n1', titulo: 'Pelayo te ha respondido', cuerpo: 'En Pierna A', url: '#hoy', etiqueta: 'n1' }));
  check(mostradas[0]?.t === 'Pelayo te ha respondido' && mostradas[0].o.body === 'En Pierna A' && mostradas[0].o.tag === 'n1' && mostradas[0].o.data.url === 'https://atletas.fbe.test/app/#hoy',
    'muestra la notificación con su título, texto, etiqueta y a dónde lleva');
  await push(JSON.stringify({ titulo: 'Te queda un hábito de hoy', url: '#hoy', etiqueta: 'habitos', repetir: true }));
  check(mostradas.at(-1).o.renotify === true && mostradas.at(-1).o.tag === 'habitos' && mostradas[0].o.renotify === false && mostradas[0].o.badge === 'insignia-96.png',
    'el recordatorio sustituye al de ayer y vuelve a sonar; todas con su insignia para la barra de Android');
  mostradas.pop();
  await push(JSON.stringify({ titulo: 'x', url: 'javascript:alert(1)' }));
  check(mostradas[1].o.data.url === 'https://atletas.fbe.test/app/', 'una dirección rara no se sigue: lleva al inicio de la app');
  await push('esto no es JSON');
  check(mostradas[2].t === 'FBE Equipo' && mostradas[2].o.body === 'esto no es JSON', 'un mensaje que no se entiende se muestra igual (Safari retira el permiso si no)');
  const ventana = { url: 'https://atletas.fbe.test/app/#semana', focus: async () => { enfocada++; }, postMessage: (m) => mensajes.push(m) };
  ventanas.push(ventana);
  await push(JSON.stringify({ titulo: 'Tu semana ya está lista', url: '#semana' }));
  check(mostradas.length === 4 && mensajes.some((m) => m.tipo === 'notificacion'), 'con la app abierta, también se lo dice a la app (que se pone al día)');
  let pc;
  oyentes.notificationclick({ notification: { close: () => {}, data: { url: 'https://atletas.fbe.test/app/#checkin' } }, waitUntil: (x) => { pc = x; } });
  await pc;
  check(enfocada === 1 && mensajes.at(-1).tipo === 'abrir' && mensajes.at(-1).url.endsWith('#checkin') && abierta === null, 'al tocarla con la app abierta, la trae delante y va a esa pestaña');
  ventanas.length = 0;
  oyentes.notificationclick({ notification: { close: () => {}, data: { url: 'https://atletas.fbe.test/app/#hoy' } }, waitUntil: (x) => { pc = x; } });
  await pc;
  check(abierta === 'https://atletas.fbe.test/app/#hoy', 'con la app cerrada, la abre ahí');
}

console.log('\nEn el navegador: activar, poner al día y quitar (push.js)');
{
  // Un navegador de mentira, con lo justo de lo que usa push.js
  const almacen = new Map();
  let suscripcion = null;
  let siguiente = 1;
  const clave = (b64) => { const t = b64.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(t + '='.repeat((4 - t.length % 4) % 4)), (c) => c.charCodeAt(0)).buffer; };
  const crearSub = (k, endpoint = `https://fcm.googleapis.com/fcm/send/nav-${siguiente++}`) => {
    const nav = navegador(siguiente + 40);
    const sub = { endpoint, options: { applicationServerKey: clave(k) }, toJSON: () => ({ endpoint, keys: { p256dh: nav.sub.p256dh, auth: nav.sub.auth } }), unsubscribe: async () => { if (suscripcion === sub) suscripcion = null; return true; } };
    return sub;
  };
  const reg = { pushManager: { getSubscription: async () => suscripcion, subscribe: async ({ applicationServerKey }) => { suscripcion = crearSub(btoa(String.fromCharCode(...applicationServerKey)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')); return suscripcion; } } };
  const vapid2 = await parVapid();
  Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/129.0 Mobile', maxTouchPoints: 5, serviceWorker: { getRegistration: async () => reg, register: async () => reg, ready: Promise.resolve(reg) } }, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, String(v)), removeItem: (k) => almacen.delete(k) }, configurable: true });
  globalThis.location = { protocol: 'https:' };
  globalThis.PushManager = function PushManager() {};
  globalThis.Notification = { permission: 'default', requestPermission: async () => { globalThis.Notification.permission = 'granted'; return 'granted'; } };
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.FBE_CONFIG = { vapidPublica: vapid.publica };
  const { activarPush, sincronizarPush, desactivarPushLocal, estadoPush } = await import('../web/src/datos/push.js');
  // El servidor: las filas de suscripciones por cuenta
  const filas = new Map();
  let uid = 'u-ana';
  const llamadas = [];
  const api = {
    uid: () => uid,
    registrarSuscripcion: async (d) => { llamadas.push(['registrar', d]); filas.set(d.endpoint, { ...d, usuario: uid }); },
    actualizarSuscripcion: async (d) => { llamadas.push(['actualizar', d]); const f = filas.get(d.anterior); if (!f || f.usuario !== uid) return false; filas.delete(d.anterior); filas.set(d.endpoint, { ...f, ...d }); return true; },
    borrarSuscripcion: async (e) => { llamadas.push(['borrar', e]); filas.delete(e); },
  };
  check(estadoPush('supabase') === 'ok' && await activarPush(api) === 'activadas' && filas.size === 1 && [...filas.values()][0].vapid === vapid.publica && [...filas.values()][0].dispositivo === 'Android · Chrome',
    'activa: pide permiso, se suscribe con la clave VAPID y la apunta (con la clave y el móvil)');
  llamadas.length = 0;
  await sincronizarPush(api, 'supabase');
  check(llamadas.length === 1 && llamadas[0][0] === 'actualizar' && suscripcion, 'al abrir la app, la pone al día (sin crear otra)');
  filas.clear();
  await sincronizarPush(api, 'supabase');
  check(!suscripcion && !almacen.size, 'si se quitó desde otro móvil, al abrir la app aquí también se quita (no vuelve sola)');
  await activarPush(api);
  uid = 'u-luis';
  llamadas.length = 0;
  await sincronizarPush(api, 'supabase');
  check(!suscripcion && !llamadas.some(([n]) => n === 'registrar' || n === 'actualizar'), 'si entra otra persona en este móvil, no se le activan solas y deja de llegar lo de la anterior');
  uid = 'u-ana';
  await activarPush(api);
  const antes = suscripcion.endpoint;
  globalThis.FBE_CONFIG = { vapidPublica: vapid2.publica };
  llamadas.length = 0;
  await sincronizarPush(api, 'supabase');
  check(suscripcion && suscripcion.endpoint !== antes && llamadas.some(([n, d]) => n === 'registrar' && d.vapid === vapid2.publica), 'si se cambian las claves VAPID, se rehace sola con las nuevas (el permiso ya estaba dado)');
  const marca = JSON.parse(almacen.get('fbe-push-v1'));
  suscripcion = null; // el navegador la ha perdido
  llamadas.length = 0;
  await sincronizarPush(api, 'supabase');
  check(suscripcion && llamadas[0]?.[0] === 'actualizar' && llamadas[0][1].anterior === marca.endpoint && filas.has(suscripcion.endpoint), 'si el navegador la pierde, se rehace y la fila de la base pasa a la nueva');
  await desactivarPushLocal();
  check(!suscripcion && !almacen.size, 'sin sesión (cerrada en otro sitio), este móvil deja de recibirlas');
  reg.pushManager.subscribe = async () => { suscripcion = crearSub(vapid2.publica, 'https://push.otro-servicio.example/x'); return suscripcion; };
  check(/no admite/.test((await activarPush(api).catch((e) => e.message)) || ''), 'un navegador con un servicio de push que la app no admite lo dice claro');
  for (const k of ['window', 'navigator', 'localStorage']) delete globalThis[k];
}

console.log('\nDe principio a fin, con la base real');
{
  const db = new PGlite({ parsers: { [types.TIMESTAMPTZ]: (v) => v, [types.DATE]: (v) => v } });
  await aplicarEsquema(db);
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const claims = (uid) => `select set_config('request.jwt.claim.sub', '${uid}', false); select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, aal: 'aal1' }) : ''}', false);`;
  const [coach] = await q(`insert into auth.users (email) values ('coach@fbe.test') returning id`);
  const [atl] = await q(`insert into auth.users (email) values ('ana@fbe.test') returning id`);
  await q(`update perfiles set rol = 'coach', nombre = 'Pelayo Pérez' where id = $1`, [coach.id]);
  const [ficha] = await q(`insert into atletas (nombre, perfil_id, estado) values ('Ana López', $1, 'activo') returning id`, [atl.id]);
  const nav = navegador(9);
  await db.exec(`reset role; ${claims(atl.id)} set role authenticated;`);
  await q(`select registrar_suscripcion_push($1, $2, $3, 'Android · Chrome')`, [nav.sub.endpoint, nav.sub.p256dh, nav.sub.auth]);
  await q(`insert into preferencias_notificaciones (silencio_desde, silencio_hasta) values (null, null)`);
  await db.exec(`reset role; ${claims(coach.id)} set role authenticated;`);
  await q(`insert into comentarios (atleta_id, texto) values ($1, 'Mañana descansa')`, [ficha.id]);
  await q(`insert into avisos (texto) values ('Esta semana no hay check-in')`);
  const base = {
    async rpc(nombre, args) {
      await db.exec(`reset role; ${claims('')} set role service_role;`);
      try {
        if (nombre === 'crear_recordatorios') return (await q(`select crear_recordatorios() n`))[0].n;
        if (nombre === 'notificaciones_por_enviar') return q(`select * from notificaciones_por_enviar($1, $2)`, [args.p_limite, args.p_email]);
        if (nombre === 'notificaciones_resultado') return q(`select notificaciones_resultado($1)`, [JSON.stringify(args.p_resultado)]);
      } finally { await db.exec('reset role;'); }
      throw new Error(nombre);
    },
  };
  const llegan = [];
  const f = async (url, op) => { llegan.push(JSON.parse(nav.descifrar(op.body))); return new Response('', { status: 201 }); };
  const r = await enviarPendientes({ env: { VAPID_PUBLICA: vapid.publica, VAPID_PRIVADA: vapid.privada, AVISOS_CONTACTO: vapid.contacto }, db: base, fetch: f });
  // (v0.18: un mensaje suelto del coach es «te ha escrito» y lleva a Mensajes; en una sesión sigue siendo «te ha respondido»)
  check(r.enviadas === 2 && llegan.map((x) => x.titulo).sort().join(' | ') === 'Aviso de Pelayo | Pelayo te ha escrito',
    'el coach escribe y publica un aviso: al móvil de Ana le llegan los dos, cifrados, y los lee');
  check(llegan.find((x) => x.titulo === 'Pelayo te ha escrito').cuerpo === 'Mensaje nuevo' && !JSON.stringify(llegan).includes('descansa') && !JSON.stringify(llegan).includes('no hay check-in'),
    'sin el texto del mensaje ni el del aviso');
  const est = await q(`select estado, canal, url, tipo from notificaciones`);
  check(est.length === 2 && est.every((x) => x.estado === 'enviada' && x.canal === 'push'), 'y la base las apunta como enviadas por push');
  check(est.find((x) => x.tipo === 'respuesta')?.url === '#mensajes', 'el mensaje suelto lleva a la pestaña Mensajes (v0.18)');
  check((await enviarPendientes({ env: { VAPID_PUBLICA: vapid.publica, VAPID_PRIVADA: vapid.privada, AVISOS_CONTACTO: vapid.contacto }, db: base, fetch: f })).tomadas === 0 && llegan.length === 2,
    'en la siguiente pasada no se repiten');
  await db.close();
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
