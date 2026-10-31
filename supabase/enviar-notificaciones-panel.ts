// FBE Equipo · función «enviar-notificaciones» en un solo archivo (generado; no lo edites a mano).
// Supabase → Edge Functions → Deploy a new function → Via Editor → nombre: enviar-notificaciones →
// pega TODO este archivo → Deploy. Después, en sus ajustes, desactiva «Verify JWT» (la función comprueba
// ella misma quién la llama). El código fuente está en supabase/functions/enviar-notificaciones.
// supabase/functions/enviar-notificaciones/webpush.js
var te = new TextEncoder();
var sutil = () => globalThis.crypto.subtle;
var ENDPOINT_VALIDO = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\/[!-~]+$/;
function b64url(bytes) {
  const b = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function deB64url(s) {
  const t = String(s).replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  const bin = atob(t + "=".repeat((4 - t.length % 4) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function juntar(...partes) {
  const out = new Uint8Array(partes.reduce((t, p) => t + p.length, 0));
  let o = 0;
  for (const p of partes) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
var CERO = new Uint8Array([0]);
var UNO = new Uint8Array([1]);
async function hmac(clave, datos) {
  const k = await sutil().importKey("raw", clave, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await sutil().sign("HMAC", k, datos));
}
async function hkdf(sal, ikm, info, largo) {
  const prk = await hmac(sal, ikm);
  return (await hmac(prk, juntar(info, UNO))).slice(0, largo);
}
var MAX_MENSAJE = 4096 - 86 - 16 - 1;
async function cifrar(mensaje, { p256dh, auth }, { sal = null, efimeras = null } = {}) {
  const uaPublica = deB64url(p256dh);
  const secreto = deB64url(auth);
  if (uaPublica.length !== 65 || uaPublica[0] !== 4 || secreto.length !== 16) throw new Error("Claves de la suscripción no válidas");
  const datos = typeof mensaje === "string" ? te.encode(mensaje) : new Uint8Array(mensaje);
  if (datos.length > MAX_MENSAJE) throw new Error("Mensaje demasiado largo para una notificación");
  const par = efimeras || await sutil().generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublica = new Uint8Array(await sutil().exportKey("raw", par.publicKey));
  const uaClave = await sutil().importKey("raw", uaPublica, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const compartido = new Uint8Array(await sutil().deriveBits({ name: "ECDH", public: uaClave }, par.privateKey, 256));
  const ikm = await hkdf(secreto, compartido, juntar(te.encode("WebPush: info"), CERO, uaPublica, asPublica), 32);
  const s = sal || globalThis.crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(s, ikm, juntar(te.encode("Content-Encoding: aes128gcm"), CERO), 16);
  const nonce = await hkdf(s, ikm, juntar(te.encode("Content-Encoding: nonce"), CERO), 12);
  const clave = await sutil().importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cifrado = new Uint8Array(await sutil().encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, clave, juntar(datos, new Uint8Array([2]))));
  const cabecera = new Uint8Array(16 + 4 + 1 + 65);
  cabecera.set(s, 0);
  new DataView(cabecera.buffer).setUint32(16, 4096);
  cabecera[20] = 65;
  cabecera.set(asPublica, 21);
  return juntar(cabecera, cifrado);
}
async function cabeceraVapid(endpoint, { publica, privada, contacto }, ahora = Date.now()) {
  const pub = deB64url(publica);
  if (pub.length !== 65 || pub[0] !== 4 || deB64url(privada).length !== 32) throw new Error("Claves VAPID no válidas");
  if (!/^(mailto:|https:\/\/)/.test(contacto || "")) throw new Error("Falta el contacto de VAPID (mailto:… o https://…)");
  const cab = b64url(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const cuerpo = b64url(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(ahora / 1e3) + 12 * 3600, sub: contacto })));
  const jwk = { kty: "EC", crv: "P-256", x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), d: privada, ext: true };
  const clave = await sutil().importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const firma = new Uint8Array(await sutil().sign({ name: "ECDSA", hash: "SHA-256" }, clave, te.encode(`${cab}.${cuerpo}`)));
  return `vapid t=${cab}.${cuerpo}.${b64url(firma)}, k=${publica}`;
}
async function comprobarVapid({ publica, privada }) {
  const pub = deB64url(publica);
  if (pub.length !== 65 || pub[0] !== 4 || deB64url(privada).length !== 32) throw new Error("Claves VAPID no válidas");
  const jwk = { kty: "EC", crv: "P-256", x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), d: privada, ext: true };
  const priv = await sutil().importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const verif = await sutil().importKey("raw", pub, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const datos = te.encode("fbe");
  const firma = await sutil().sign({ name: "ECDSA", hash: "SHA-256" }, priv, datos);
  if (!await sutil().verify({ name: "ECDSA", hash: "SHA-256" }, verif, firma, datos)) {
    throw new Error("VAPID_PUBLICA y VAPID_PRIVADA no son pareja: vuelve a ponerlas con lo que dio «npm run claves-push»");
  }
}
async function enviarPush(sub, mensaje, vapid, { ttl = 86400, urgencia = "normal", tema = null, fetch: f = globalThis.fetch, espera = 1e4 } = {}) {
  let cuerpo, autorizacion;
  try {
    if (!ENDPOINT_VALIDO.test(sub.endpoint || "")) throw new Error("Dirección de push no permitida");
    cuerpo = await cifrar(mensaje, sub);
    autorizacion = await cabeceraVapid(sub.endpoint, vapid);
  } catch (e) {
    e.local = true;
    throw e;
  }
  const cabeceras = {
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    TTL: String(Math.max(0, Math.round(ttl))),
    Urgency: urgencia,
    Authorization: autorizacion
  };
  if (tema) cabeceras.Topic = tema;
  const r = await f(sub.endpoint, { method: "POST", headers: cabeceras, body: cuerpo, redirect: "error", signal: AbortSignal.timeout(espera) });
  const ok = r.status >= 200 && r.status < 300;
  const texto = ok ? "" : (await r.text().catch(() => "")).slice(0, 120);
  if (ok) await r.body?.cancel?.().catch(() => {
  });
  const ra = Number(r.headers?.get?.("retry-after"));
  return { estado: r.status, ok, texto, esperar: Number.isFinite(ra) && ra > 0 ? Math.min(ra, 3600) : 0 };
}

// supabase/functions/enviar-notificaciones/envio.js
var RECORDATORIOS = /* @__PURE__ */ new Set(["sesion_hoy", "checkin", "habitos", "nutricion"]);
var URGENTES = /* @__PURE__ */ new Set(["respuesta", "mensaje", "prueba", "sesion_hoy", "checkin", "habitos", "nutricion", "descanso"]);
var DE_UNA_EN_UNA = /* @__PURE__ */ new Set([...RECORDATORIOS, "descanso"]);
var ESPERA_MS = 1e4;
var PLAZO_MS = 9e4;
var json = (datos, estado, cabeceras) => new Response(JSON.stringify(datos), { status: estado, headers: { ...cabeceras, "Content-Type": "application/json" } });
var pausa = (ms) => new Promise((r) => setTimeout(r, ms));
function iguales(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}
function claveServicio(env) {
  try {
    const k = JSON.parse(env.SUPABASE_SECRET_KEYS || "null");
    const v = k && (k.default || Object.values(k)[0]);
    if (v) return String(v);
  } catch {
  }
  return env.SUPABASE_SERVICE_ROLE_KEY || "";
}
function clienteBase(env, f = globalThis.fetch) {
  const clave = claveServicio(env);
  const cab = { apikey: clave, "Content-Type": "application/json" };
  if (clave.split(".").length === 3) cab.Authorization = `Bearer ${clave}`;
  const url = String(env.SUPABASE_URL).replace(/\/+$/, "");
  return {
    async rpc(nombre, args = {}) {
      const r = await f(`${url}/rest/v1/rpc/${nombre}`, { method: "POST", headers: cab, body: JSON.stringify(args), signal: AbortSignal.timeout(ESPERA_MS * 2) });
      const texto = await r.text();
      if (!r.ok) throw new Error(`${nombre}: HTTP ${r.status} ${texto.slice(0, 200)}`);
      return texto ? JSON.parse(texto) : null;
    },
    // ¿Es una sesión válida de la app? (la comprueba el servidor de autenticación de Supabase)
    async usuario(token) {
      const r = await f(`${url}/auth/v1/user`, { headers: { apikey: clave, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(ESPERA_MS) });
      return r.ok ? r.json() : null;
    }
  };
}
var escapar = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var direcciones = (appUrl) => String(appUrl || "").split(",").map((x) => x.trim()).filter(Boolean);
function componerEmail(notis, appUrl = "") {
  const asunto = notis.length === 1 ? notis[0].titulo : `${notis.length} novedades en FBE Equipo`;
  const lineas = notis.map((n) => `${n.titulo}${n.cuerpo ? `: ${n.cuerpo}` : ""}`);
  const base = direcciones(appUrl)[0] || "";
  const enlace = base ? `${base.replace(/\/+$/, "")}/${notis[0].url || ""}` : "";
  const pie = "Puedes elegir qué te llega en la app, en Notificaciones.";
  const texto = [...lineas.map((l) => `- ${l}`), "", enlace ? `Ábrela: ${enlace}` : "", "", pie].filter((l, i, a) => l || a[i - 1]).join("\n");
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.5;color:#1d1b2e">
<ul style="padding-left:20px">${notis.map((n) => `<li><strong>${escapar(n.titulo)}</strong>${n.cuerpo ? `<br>${escapar(n.cuerpo)}` : ""}</li>`).join("")}</ul>
${enlace ? `<p><a href="${escapar(enlace)}" style="color:#4f3ad9">Abrir FBE Equipo</a></p>` : ""}
<p style="color:#6b6880;font-size:13px">${escapar(pie)}</p></div>`;
  return { asunto, texto, html };
}
async function enviarEmail(env, f, para, notis, espera = ESPERA_MS) {
  const { asunto, texto, html } = componerEmail(notis, env.APP_URL);
  const r = await f("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.AVISOS_REMITENTE, to: [para], subject: asunto, text: texto, html }),
    signal: AbortSignal.timeout(espera)
  });
  await r.body?.cancel?.().catch(() => {
  });
  return { estado: r.status, ok: r.ok };
}
var reintentable = (estado) => estado === 429 || estado >= 500 || estado === 0;
var nuevoResultado = () => ({ enviadas: [], reintentar: [], fallidas: [], suscripciones_ok: [], suscripciones_caducadas: [], suscripciones_error: [] });
async function enviarDeUsuario(notis, { env, f, vapid, conEmail, res, sinTiempo, espera }) {
  const email = conEmail ? notis[0].email : null;
  const fallos = /* @__PURE__ */ new Map();
  let subs = [];
  let motivo = "";
  for (const s of notis[0].suscripciones || []) {
    if (!ENDPOINT_VALIDO.test(s.endpoint) || s.vapid && s.vapid !== vapid.publica) {
      res.suscripciones_caducadas.push(s.id);
      if (s.vapid && s.vapid !== vapid.publica) motivo = "Activada con otra clave VAPID (revisa vapidPublica en web/config.js o vuelve a activarlas)";
    } else {
      subs.push(s);
      fallos.set(s.id, Number(s.fallos) || 0);
    }
  }
  const paraEmail = [];
  for (const n of notis) {
    if (sinTiempo()) {
      res.reintentar.push({ id: n.id, error: "Sin tiempo en esta pasada", esperar: 0 });
      continue;
    }
    const recordatorio = DE_UNA_EN_UNA.has(n.tipo);
    const mensaje = JSON.stringify({ id: n.id, titulo: n.titulo, cuerpo: n.cuerpo || "", url: n.url, etiqueta: recordatorio ? n.tipo : n.id, repetir: recordatorio });
    const ttl = Math.max(60, Math.min(2 * 86400, (new Date(n.caduca_en) - Date.now()) / 1e3));
    let llegada = false;
    let repetir = false;
    let esperar = 0;
    let error = motivo;
    for (const s of subs) {
      let r;
      try {
        r = await enviarPush(s, mensaje, vapid, { ttl, urgencia: URGENTES.has(n.tipo) ? "high" : "normal", tema: recordatorio ? n.tipo : null, fetch: f, espera });
      } catch (e) {
        r = { estado: 0, ok: false, texto: String(e.message || e).slice(0, 120), local: !!e.local };
      }
      if (r.ok) {
        llegada = true;
        fallos.set(s.id, 0);
        if (!res.suscripciones_ok.includes(s.id)) res.suscripciones_ok.push(s.id);
      } else if (r.estado === 404 || r.estado === 410 || r.local) {
        res.suscripciones_caducadas.push(s.id);
        error = r.local ? r.texto : `HTTP ${r.estado}`;
      } else {
        error = r.estado ? `HTTP ${r.estado}${r.texto ? ` ${r.texto}` : ""}` : r.texto;
        res.suscripciones_error.push({ id: s.id, error: error.slice(0, 200) });
        if (reintentable(r.estado)) {
          repetir = true;
          esperar = Math.max(esperar, r.esperar || 0);
        } else if (r.estado === 401 || r.estado === 403) {
          fallos.set(s.id, fallos.get(s.id) + 1);
          if (fallos.get(s.id) >= 3) res.suscripciones_caducadas.push(s.id);
        }
      }
    }
    subs = subs.filter((s) => !res.suscripciones_caducadas.includes(s.id));
    if (llegada) res.enviadas.push({ id: n.id, canal: "push" });
    else if (repetir) res.reintentar.push({ id: n.id, error: error.slice(0, 200), esperar });
    else if (email) paraEmail.push(n);
    else res.fallidas.push({ id: n.id, error: (error || "Sin móviles activados").slice(0, 200) });
  }
  if (paraEmail.length) {
    let r;
    try {
      r = await enviarEmail(env, f, email, paraEmail, espera);
    } catch {
      r = { estado: 0, ok: false };
    }
    if (r.ok) {
      for (const n of paraEmail) res.enviadas.push({ id: n.id, canal: "email" });
    } else {
      for (const n of paraEmail) (reintentable(r.estado) ? res.reintentar : res.fallidas).push({ id: n.id, error: `Email: HTTP ${r.estado}`, esperar: 0 });
    }
  }
}
async function apuntar(db, res) {
  if (!Object.values(res).some((x) => x.length)) return;
  for (let i = 0; ; i++) {
    try {
      await db.rpc("notificaciones_resultado", { p_resultado: res });
      return;
    } catch (e) {
      if (i >= 2) throw e;
      await pausa(300 * (i + 1) ** 2);
    }
  }
}
async function enviarPendientes({ env, db, fetch: f = globalThis.fetch, recordatorios = true, limite = 100, enParalelo = 6, plazoMs = PLAZO_MS, espera = ESPERA_MS }) {
  const inicio = Date.now();
  const sinTiempo = () => Date.now() - inicio > plazoMs;
  const conEmail = !!(env.RESEND_API_KEY && env.AVISOS_REMITENTE);
  const vapid = { publica: env.VAPID_PUBLICA, privada: env.VAPID_PRIVADA, contacto: env.AVISOS_CONTACTO || direcciones(env.APP_URL)[0] };
  await comprobarVapid(vapid);
  const creados = recordatorios ? Number(await db.rpc("crear_recordatorios", {})) || 0 : 0;
  const lote = await db.rpc("notificaciones_por_enviar", { p_limite: limite, p_email: conEmail }) || [];
  const total = nuevoResultado();
  const porUsuario = /* @__PURE__ */ new Map();
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
    recordatorios: creados,
    tomadas: lote.length,
    enviadas: total.enviadas.length,
    reintentar: total.reintentar.length,
    fallidas: total.fallidas.length,
    moviles_borrados: new Set(total.suscripciones_caducadas).size
  };
}
var ultimaDeSesion = 0;
async function atender(req, { env, fetch: f = globalThis.fetch } = {}) {
  const permitidas = direcciones(env.APP_URL).map((u) => {
    try {
      return new URL(u).origin;
    } catch {
      return null;
    }
  }).filter(Boolean);
  const origen = req.headers.get("origin");
  const cors = {
    "Access-Control-Allow-Origin": !permitidas.length ? "*" : permitidas.includes(origen) ? origen : permitidas[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-fbe-secreto, x-region",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin"
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Usa POST" }, 405, cors);
  const secreto = req.headers.get("x-fbe-secreto");
  const faltan = ["SUPABASE_URL", "VAPID_PUBLICA", "VAPID_PRIVADA"].filter((k) => !env[k]);
  if (!claveServicio(env)) faltan.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!env.AVISOS_CONTACTO && !env.APP_URL) faltan.push("AVISOS_CONTACTO");
  if (secreto && !env.AVISOS_SECRETO) faltan.push("AVISOS_SECRETO");
  if (faltan.length) return json({ error: `Faltan secretos de la función: ${faltan.join(", ")}` }, 500, cors);
  const db = clienteBase(env, f);
  const programado = !!(env.AVISOS_SECRETO && secreto && iguales(secreto, env.AVISOS_SECRETO));
  if (!programado) {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const usuario = token.split(".").length === 3 ? await db.usuario(token).catch(() => null) : null;
    if (!usuario?.id) return json({ error: "No autorizado" }, 401, cors);
    if (Date.now() - ultimaDeSesion < 3e3) return json({ ok: true }, 200, cors);
    ultimaDeSesion = Date.now();
  }
  try {
    const resumen = await enviarPendientes({ env, db, fetch: f, recordatorios: programado });
    return json(programado ? resumen : { ok: true }, 200, cors);
  } catch (e) {
    console.error("enviar-notificaciones:", e);
    const vapidMal = /VAPID/.test(String(e?.message));
    return json({ error: vapidMal ? e.message : "No se han podido enviar las notificaciones" }, 500, cors);
  }
}

// supabase/functions/enviar-notificaciones/index.ts
Deno.serve((req) => atender(req, { env: Deno.env.toObject() }));
