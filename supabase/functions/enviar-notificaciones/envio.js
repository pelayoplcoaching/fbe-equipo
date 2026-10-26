// La función «enviar-notificaciones»: crea los recordatorios que tocan, toma de la base las notificaciones
// pendientes y las envía a los móviles de cada cuenta (Web Push) o, si alguien lo ha pedido y no tiene ningún
// móvil que funcione, por email (Resend, opcional). Después le dice a la base qué ha pasado con cada una.
//
// La llaman: el programador de Supabase cada minuto (con la cabecera x-fbe-secreto) y la propia app justo
// después de algo que avisa (con la sesión de quien lo hace), para que llegue al momento. Con la sesión no
// se crean recordatorios: solo se envía lo que ya está en la cola, y la respuesta no dice nada de nadie.
//
// Secretos (Supabase → Edge Functions → Secrets): VAPID_PUBLICA, VAPID_PRIVADA, AVISOS_SECRETO,
// AVISOS_CONTACTO (mailto:…), APP_URL (una o varias direcciones de la app, separadas por comas) y, para el
// email, RESEND_API_KEY y AVISOS_REMITENTE. SUPABASE_URL y la clave de servicio los pone Supabase solo.
import { enviarPush, comprobarVapid, ENDPOINT_VALIDO } from './webpush.js';

const RECORDATORIOS = new Set(['sesion_hoy', 'checkin', 'habitos', 'nutricion']);
// Las que conviene que lleguen ya aunque el móvil esté en ahorro de batería
const URGENTES = new Set(['respuesta', 'mensaje', 'prueba', 'sesion_hoy', 'checkin', 'habitos', 'nutricion']);
const ESPERA_MS = 10000;      // lo más que se espera a cada servicio (push, email, la base)
const PLAZO_MS = 90000;       // a partir de aquí no se empieza nada nuevo (Supabase corta a los 150 s)

const json = (datos, estado, cabeceras) => new Response(JSON.stringify(datos), { status: estado, headers: { ...cabeceras, 'Content-Type': 'application/json' } });
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// Comparación sin atajos (que el tiempo de respuesta no diga cuántas letras del secreto se han acertado)
export function iguales(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

// La clave de servicio: con las claves nuevas de Supabase llega en SUPABASE_SECRET_KEYS (un JSON por nombre);
// con las antiguas, en SUPABASE_SERVICE_ROLE_KEY
export function claveServicio(env) {
  try {
    const k = JSON.parse(env.SUPABASE_SECRET_KEYS || 'null');
    const v = k && (k.default || Object.values(k)[0]);
    if (v) return String(v);
  } catch { /* no es JSON: se usa la antigua */ }
  return env.SUPABASE_SERVICE_ROLE_KEY || '';
}

// La base de datos por su API (PostgREST), con la clave de servicio. La nueva (sb_secret_…) va solo en
// «apikey»; la antigua (un JWT), también como Bearer.
export function clienteBase(env, f = globalThis.fetch) {
  const clave = claveServicio(env);
  const cab = { apikey: clave, 'Content-Type': 'application/json' };
  if (clave.split('.').length === 3) cab.Authorization = `Bearer ${clave}`;
  const url = String(env.SUPABASE_URL).replace(/\/+$/, '');
  return {
    async rpc(nombre, args = {}) {
      const r = await f(`${url}/rest/v1/rpc/${nombre}`, { method: 'POST', headers: cab, body: JSON.stringify(args), signal: AbortSignal.timeout(ESPERA_MS * 2) });
      const texto = await r.text();
      if (!r.ok) throw new Error(`${nombre}: HTTP ${r.status} ${texto.slice(0, 200)}`);
      return texto ? JSON.parse(texto) : null;
    },
    // ¿Es una sesión válida de la app? (la comprueba el servidor de autenticación de Supabase)
    async usuario(token) {
      const r = await f(`${url}/auth/v1/user`, { headers: { apikey: clave, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(ESPERA_MS) });
      return r.ok ? r.json() : null;
    },
  };
}

const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const direcciones = (appUrl) => String(appUrl || '').split(',').map((x) => x.trim()).filter(Boolean);

// Un email con todas las pendientes de esa cuenta
export function componerEmail(notis, appUrl = '') {
  const asunto = notis.length === 1 ? notis[0].titulo : `${notis.length} novedades en FBE Equipo`;
  const lineas = notis.map((n) => `${n.titulo}${n.cuerpo ? `: ${n.cuerpo}` : ''}`);
  const base = direcciones(appUrl)[0] || '';
  const enlace = base ? `${base.replace(/\/+$/, '')}/${notis[0].url || ''}` : '';
  const pie = 'Puedes elegir qué te llega en la app, en Notificaciones.';
  const texto = [...lineas.map((l) => `- ${l}`), '', enlace ? `Ábrela: ${enlace}` : '', '', pie].filter((l, i, a) => l || a[i - 1]).join('\n');
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.5;color:#1d1b2e">
<ul style="padding-left:20px">${notis.map((n) => `<li><strong>${escapar(n.titulo)}</strong>${n.cuerpo ? `<br>${escapar(n.cuerpo)}` : ''}</li>`).join('')}</ul>
${enlace ? `<p><a href="${escapar(enlace)}" style="color:#4f3ad9">Abrir FBE Equipo</a></p>` : ''}
<p style="color:#6b6880;font-size:13px">${escapar(pie)}</p></div>`;
  return { asunto, texto, html };
}

async function enviarEmail(env, f, para, notis, espera = ESPERA_MS) {
  const { asunto, texto, html } = componerEmail(notis, env.APP_URL);
  const r = await f('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.AVISOS_REMITENTE, to: [para], subject: asunto, text: texto, html }),
    signal: AbortSignal.timeout(espera),
  });
  await r.body?.cancel?.().catch(() => {});
  return { estado: r.status, ok: r.ok };
}

const reintentable = (estado) => estado === 429 || estado >= 500 || estado === 0;
const nuevoResultado = () => ({ enviadas: [], reintentar: [], fallidas: [], suscripciones_ok: [], suscripciones_caducadas: [], suscripciones_error: [] });

// Envía lo de una cuenta y apunta el resultado en «res». sinTiempo(): si ya no queda, lo que falta se deja
// para el siguiente minuto.
async function enviarDeUsuario(notis, { env, f, vapid, conEmail, res, sinTiempo, espera }) {
  const email = conEmail ? notis[0].email : null;
  // Los móviles de esta cuenta. Uno activado con otra clave VAPID (se cambiaron las claves) ya no puede
  // recibir nada: fuera. Y uno que el servicio rechaza 3 veces seguidas (401/403), también.
  const fallos = new Map();
  let subs = [];
  let motivo = '';
  for (const s of notis[0].suscripciones || []) {
    if (!ENDPOINT_VALIDO.test(s.endpoint) || (s.vapid && s.vapid !== vapid.publica)) {
      res.suscripciones_caducadas.push(s.id);
      if (s.vapid && s.vapid !== vapid.publica) motivo = 'Activada con otra clave VAPID (revisa vapidPublica en web/config.js o vuelve a activarlas)';
    } else { subs.push(s); fallos.set(s.id, Number(s.fallos) || 0); }
  }
  const paraEmail = [];
  for (const n of notis) {
    if (sinTiempo()) { res.reintentar.push({ id: n.id, error: 'Sin tiempo en esta pasada', esperar: 0 }); continue; }
    const recordatorio = RECORDATORIOS.has(n.tipo);
    const mensaje = JSON.stringify({ id: n.id, titulo: n.titulo, cuerpo: n.cuerpo || '', url: n.url, etiqueta: recordatorio ? n.tipo : n.id, repetir: recordatorio });
    const ttl = Math.max(60, Math.min(2 * 86400, (new Date(n.caduca_en) - Date.now()) / 1000));
    let llegada = false;
    let repetir = false;
    let esperar = 0;
    let error = motivo;
    for (const s of subs) {
      let r;
      try {
        r = await enviarPush(s, mensaje, vapid, { ttl, urgencia: URGENTES.has(n.tipo) ? 'high' : 'normal', tema: recordatorio ? n.tipo : null, fetch: f, espera });
      } catch (e) {
        r = { estado: 0, ok: false, texto: String(e.message || e).slice(0, 120), local: !!e.local };
      }
      if (r.ok) {
        llegada = true;
        fallos.set(s.id, 0);
        if (!res.suscripciones_ok.includes(s.id)) res.suscripciones_ok.push(s.id);
      } else if (r.estado === 404 || r.estado === 410 || r.local) {
        // El navegador ya no la tiene (desinstalada, permiso quitado…) o sus claves no valen: no sirve
        res.suscripciones_caducadas.push(s.id);
        error = r.local ? r.texto : `HTTP ${r.estado}`;
      } else {
        error = r.estado ? `HTTP ${r.estado}${r.texto ? ` ${r.texto}` : ''}` : r.texto;
        res.suscripciones_error.push({ id: s.id, error: error.slice(0, 200) });
        if (reintentable(r.estado)) { repetir = true; esperar = Math.max(esperar, r.esperar || 0); }
        else if (r.estado === 401 || r.estado === 403) {
          fallos.set(s.id, fallos.get(s.id) + 1);
          if (fallos.get(s.id) >= 3) res.suscripciones_caducadas.push(s.id);
        }
      }
    }
    subs = subs.filter((s) => !res.suscripciones_caducadas.includes(s.id));
    if (llegada) res.enviadas.push({ id: n.id, canal: 'push' });
    else if (repetir) res.reintentar.push({ id: n.id, error: error.slice(0, 200), esperar });
    // Ningún móvil la puede recibir (o no hay ninguno): por email, si lo quiere
    else if (email) paraEmail.push(n);
    else res.fallidas.push({ id: n.id, error: (error || 'Sin móviles activados').slice(0, 200) });
  }
  if (paraEmail.length) {
    let r;
    try { r = await enviarEmail(env, f, email, paraEmail, espera); } catch { r = { estado: 0, ok: false }; }
    if (r.ok) {
      // (la base cuenta los emails enviados para no mandar otro en una hora)
      for (const n of paraEmail) res.enviadas.push({ id: n.id, canal: 'email' });
    } else {
      for (const n of paraEmail) (reintentable(r.estado) ? res.reintentar : res.fallidas).push({ id: n.id, error: `Email: HTTP ${r.estado}`, esperar: 0 });
    }
  }
}

// Apunta en la base lo que ha pasado (con un par de reintentos: si no se apunta, se volvería a enviar)
async function apuntar(db, res) {
  if (!Object.values(res).some((x) => x.length)) return;
  for (let i = 0; ; i++) {
    try { await db.rpc('notificaciones_resultado', { p_resultado: res }); return; } catch (e) {
      if (i >= 2) throw e;
      await pausa(300 * (i + 1) ** 2);
    }
  }
}

// Una pasada: recordatorios (si se piden), tomar la cola, enviar y apuntar (por tandas, según se envían).
// Devuelve un resumen.
export async function enviarPendientes({ env, db, fetch: f = globalThis.fetch, recordatorios = true, limite = 100, enParalelo = 6, plazoMs = PLAZO_MS, espera = ESPERA_MS }) {
  const inicio = Date.now();
  const sinTiempo = () => Date.now() - inicio > plazoMs;
  const conEmail = !!(env.RESEND_API_KEY && env.AVISOS_REMITENTE);
  const vapid = { publica: env.VAPID_PUBLICA, privada: env.VAPID_PRIVADA, contacto: env.AVISOS_CONTACTO || direcciones(env.APP_URL)[0] };
  await comprobarVapid(vapid);
  const creados = recordatorios ? Number(await db.rpc('crear_recordatorios', {})) || 0 : 0;
  const lote = (await db.rpc('notificaciones_por_enviar', { p_limite: limite, p_email: conEmail })) || [];
  const total = nuevoResultado();
  const porUsuario = new Map();
  for (const n of lote) {
    if (!porUsuario.has(n.usuario_id)) porUsuario.set(n.usuario_id, []);
    porUsuario.get(n.usuario_id).push(n);
  }
  const grupos = [...porUsuario.values()];
  for (let i = 0; i < grupos.length; i += enParalelo) {
    const res = nuevoResultado();
    try {
      await Promise.all(grupos.slice(i, i + enParalelo).map((notis) => enviarDeUsuario(notis, { env, f, vapid, conEmail, res, sinTiempo, espera })));
    } finally {
      await apuntar(db, res);
      for (const k of Object.keys(total)) total[k].push(...res[k]);
    }
  }
  return {
    recordatorios: creados, tomadas: lote.length, enviadas: total.enviadas.length, reintentar: total.reintentar.length,
    fallidas: total.fallidas.length, moviles_borrados: new Set(total.suscripciones_caducadas).size,
  };
}

// La petición HTTP
let ultimaDeSesion = 0;
export async function atender(req, { env, fetch: f = globalThis.fetch } = {}) {
  // CORS: la dirección (o direcciones) de la app
  const permitidas = direcciones(env.APP_URL).map((u) => { try { return new URL(u).origin; } catch { return null; } }).filter(Boolean);
  const origen = req.headers.get('origin');
  const cors = {
    'Access-Control-Allow-Origin': !permitidas.length ? '*' : permitidas.includes(origen) ? origen : permitidas[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-fbe-secreto, x-region',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405, cors);
  const secreto = req.headers.get('x-fbe-secreto');
  const faltan = ['SUPABASE_URL', 'VAPID_PUBLICA', 'VAPID_PRIVADA'].filter((k) => !env[k]);
  if (!claveServicio(env)) faltan.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!env.AVISOS_CONTACTO && !env.APP_URL) faltan.push('AVISOS_CONTACTO');
  if (secreto && !env.AVISOS_SECRETO) faltan.push('AVISOS_SECRETO');
  if (faltan.length) return json({ error: `Faltan secretos de la función: ${faltan.join(', ')}` }, 500, cors);
  const db = clienteBase(env, f);
  const programado = !!(env.AVISOS_SECRETO && secreto && iguales(secreto, env.AVISOS_SECRETO));
  if (!programado) {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const usuario = token.split('.').length === 3 ? await db.usuario(token).catch(() => null) : null;
    if (!usuario?.id) return json({ error: 'No autorizado' }, 401, cors);
    // Desde la app basta con una pasada cada pocos segundos (el programador hace el resto)
    if (Date.now() - ultimaDeSesion < 3000) return json({ ok: true }, 200, cors);
    ultimaDeSesion = Date.now();
  }
  try {
    const resumen = await enviarPendientes({ env, db, fetch: f, recordatorios: programado });
    return json(programado ? resumen : { ok: true }, 200, cors);
  } catch (e) {
    console.error('enviar-notificaciones:', e);
    const vapidMal = /VAPID/.test(String(e?.message));
    return json({ error: vapidMal ? e.message : 'No se han podido enviar las notificaciones' }, 500, cors);
  }
}
