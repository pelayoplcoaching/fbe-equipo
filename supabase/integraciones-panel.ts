// FBE Equipo · función «integraciones» en un solo archivo (generado; no lo edites a mano).
// Supabase → Edge Functions → Deploy a new function → Via Editor → nombre: integraciones → pega TODO este
// archivo → Deploy. Después, en sus ajustes, desactiva «Verify JWT» (la llaman un calendario o un atajo, con el
// enlace personal de cada atleta). No necesita secretos. El código fuente está en supabase/functions/integraciones.
// supabase/functions/enviar-notificaciones/webpush.js
var te = new TextEncoder();
var CERO = new Uint8Array([0]);
var UNO = new Uint8Array([1]);
var MAX_MENSAJE = 4096 - 86 - 16 - 1;

// supabase/functions/enviar-notificaciones/envio.js
var RECORDATORIOS = /* @__PURE__ */ new Set(["sesion_hoy", "checkin", "habitos", "nutricion"]);
var DE_UNA_EN_UNA = /* @__PURE__ */ new Set([...RECORDATORIOS, "descanso"]);
var ESPERA_MS = 1e4;
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
      const texto2 = await r.text();
      if (!r.ok) throw new Error(`${nombre}: HTTP ${r.status} ${texto2.slice(0, 200)}`);
      return texto2 ? JSON.parse(texto2) : null;
    },
    // ¿Es una sesión válida de la app? (la comprueba el servidor de autenticación de Supabase)
    async usuario(token) {
      const r = await f(`${url}/auth/v1/user`, { headers: { apikey: clave, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(ESPERA_MS) });
      return r.ok ? r.json() : null;
    }
  };
}

// web/src/logica/fechas.js
var pad = (n) => String(n).padStart(2, "0");
function aISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function desdeISO(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}
function hoyISO(ahora = /* @__PURE__ */ new Date()) {
  return aISO(ahora);
}
function fechaMadrid(instante = /* @__PURE__ */ new Date()) {
  const d = instante instanceof Date ? instante : new Date(instante);
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  } catch {
    return aISO(d);
  }
}
function sumarDias(iso, n) {
  const d = desdeISO(iso);
  d.setDate(d.getDate() + n);
  return aISO(d);
}

// web/src/logica/plan.js
var escapar = (t) => String(t || "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/\\/g, "\\\\").replace(/\r\n?|\n/g, "\\n").replace(/([,;])/g, "\\$1");
var compacta = (iso) => iso.replace(/-/g, "");
function plegar(linea) {
  const enc = new TextEncoder();
  const out = [];
  let actual = "", octetos = 0;
  for (const c of linea) {
    const b = enc.encode(c).length;
    if (octetos + b > 75) {
      out.push(actual);
      actual = " " + c;
      octetos = 1 + b;
    } else {
      actual += c;
      octetos += b;
    }
  }
  out.push(actual);
  return out.join("\r\n");
}
function calendarioICS(eventos, { hora = "18:00", minutos = 60, avisoMin = 30, url = "", nombre = "", refrescoMin = 0 } = {}) {
  const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}${String(m % 60).padStart(2, "0")}00`;
  const sello = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lineas2 = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FBE Coaching//FBE Equipo//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  if (nombre) lineas2.push(`X-WR-CALNAME:${escapar(nombre)}`, `NAME:${escapar(nombre)}`);
  if (refrescoMin > 0) lineas2.push(`REFRESH-INTERVAL;VALUE=DURATION:PT${Math.round(refrescoMin)}M`, `X-PUBLISHED-TTL:PT${Math.round(refrescoMin)}M`);
  for (const e of eventos) {
    const [hh, mm] = String(e.hora || hora).split(":").map((x) => Number(x) || 0);
    const ini = hh * 60 + mm, fin = ini + (e.minutos || minutos);
    const diaFin = fin >= 24 * 60 ? sumarDias(e.dia, 1) : e.dia;
    lineas2.push(
      "BEGIN:VEVENT",
      `UID:fbe-${e.id}@fbe-atletas`,
      `DTSTAMP:${sello}`,
      `DTSTART:${compacta(e.dia)}T${hhmm(ini)}`,
      `DTEND:${compacta(diaFin)}T${hhmm(fin % (24 * 60))}`,
      `SUMMARY:${escapar(e.titulo || `Entreno: ${e.nombre}`)}`,
      `DESCRIPTION:${escapar(e.descripcion || "Sesión de FBE Equipo.")}`,
      ...e.lugar ? [`LOCATION:${escapar(e.lugar)}`] : [],
      ...url ? [`URL:${escapar(url)}`] : [],
      ...e.avisoMin === null ? [] : ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapar(e.aviso || `Hoy entrenas: ${e.nombre}`)}`, `TRIGGER:-PT${Math.max(0, e.avisoMin ?? avisoMin)}M`, "END:VALARM"],
      "END:VEVENT"
    );
  }
  lineas2.push("END:VCALENDAR");
  return lineas2.map(plegar).join("\r\n") + "\r\n";
}

// web/src/logica/integraciones.js
var ENLACE = /^[0-9a-f]{64}$/;
var LARGO_VALOR = 32;
function numero(v, { entero = false } = {}) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || v.length > LARGO_VALOR) return null;
  const m = v.trim().replace(/ | /g, " ").match(/^[+-]?\d[\d.,' ]*/);
  if (!m) return null;
  let t = m[0].replace(/[' ]/g, "");
  const punto = t.lastIndexOf("."), coma = t.lastIndexOf(",");
  if (punto >= 0 && coma >= 0) {
    t = punto > coma ? t.replace(/,/g, "") : t.replace(/\./g, "").replace(",", ".");
  } else if (punto >= 0 || coma >= 0) {
    const sep = punto >= 0 ? "." : ",";
    const grupos = new RegExp(`^[+-]?\\d{1,3}(\\${sep}\\d{3})+$`).test(t);
    if (grupos && (entero || t.split(sep).length > 2)) t = t.split(sep).join("");
    else if (sep === ",") t = t.replace(",", ".");
    if (t.split(".").length > 2) return null;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
function minutosSueno(v, { horas = false } = {}) {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    if (v.length > LARGO_VALOR) return null;
    const s = v.trim().toLowerCase();
    const hm = s.match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/);
    if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
    const h = s.match(/(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hora|horas)\b/);
    const mi = s.match(/(\d+)\s*(min|mins|minutos|m)\b/);
    if (h || mi) return Math.round((h ? numero(h[1]) * 60 : 0) + (mi ? Number(mi[1]) : 0));
  }
  const n = numero(v);
  if (n == null) return null;
  return Math.round(horas || n <= 24 ? n * 60 : n > 1080 ? n / 60 : n);
}
function fechaDe(v) {
  if (typeof v !== "string" || v.length > LARGO_VALOR) return null;
  const s = v.trim();
  let a, m, d;
  let r = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (r) [, a, m, d] = r;
  else if (r = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/)) [, d, m, a] = r;
  else return null;
  const iso = `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const f = /* @__PURE__ */ new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(f.getTime()) && f.toISOString().slice(0, 10) === iso ? iso : null;
}
var RANGOS = { pasos: [0, 1e5], sueno_min: [1, 1080], fc_reposo: [25, 150], hrv: [1, 300], peso_kg: [25, 350] };
var enRango = (k, n) => n != null && n >= RANGOS[k][0] && n <= RANGOS[k][1] ? n : null;
var red = (n, dec) => n == null ? null : Math.round(n * 10 ** dec) / 10 ** dec;
var MAX_MUESTRAS = 5e3;
function lineas(v) {
  if (Array.isArray(v)) return v.slice(0, MAX_MUESTRAS).map((x) => String(x ?? ""));
  if (typeof v === "string") return v.split(/\r?\n/).slice(0, MAX_MUESTRAS);
  if (typeof v === "number") return [String(v)];
  return null;
}
function pasosPorOrigen(origenes, valores) {
  const o = lineas(origenes), v = lineas(valores);
  if (!o || !v || !v.length || o.length !== v.length) return null;
  const suma = /* @__PURE__ */ new Map();
  v.forEach((t, i) => {
    const n = numero(t.trim(), { entero: true });
    if (n == null || n < 0) return;
    const k = o[i].trim().slice(0, 80) || "?";
    suma.set(k, (suma.get(k) || 0) + n);
  });
  return suma.size ? Math.round(Math.max(...suma.values())) : null;
}
var NO_DORMIDO = /* @__PURE__ */ new Set(["en la cama", "en cama", "in bed", "inbed", "vigilia", "despierto", "awake"]);
var sinTildes = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
function segundosDuracion(t) {
  const s = String(t ?? "").trim();
  if (!s || s.length > LARGO_VALOR) return null;
  if (/^\d{1,3}(:\d{1,2}){1,2}$/.test(s)) {
    const p = s.split(":").map(Number);
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  }
  const n = numero(s);
  return n != null && n >= 0 ? n : null;
}
function suenoPorOrigen(valores, duraciones, origenes) {
  const v = lineas(valores), d = lineas(duraciones);
  if (!v || !d || !d.length || v.length !== d.length) return null;
  let o = lineas(origenes);
  if (!o || o.length !== d.length) o = d.map(() => "");
  const suma = /* @__PURE__ */ new Map();
  d.forEach((t, i) => {
    if (NO_DORMIDO.has(sinTildes(v[i]))) return;
    const seg = segundosDuracion(t);
    if (seg == null) return;
    const k = o[i].trim().slice(0, 80) || "?";
    suma.set(k, (suma.get(k) || 0) + seg);
  });
  return suma.size ? Math.round(Math.max(...suma.values()) / 60) : null;
}
function limpiarSalud(cuerpo, hoy = hoyISO()) {
  let lista = Array.isArray(cuerpo) ? cuerpo : cuerpo && typeof cuerpo === "object" ? Array.isArray(cuerpo.dias) ? cuerpo.dias : [cuerpo] : [];
  lista = lista.slice(0, 62);
  const porFecha = /* @__PURE__ */ new Map();
  const poner = (fecha, k, n) => {
    if (n == null || !fecha || fecha < sumarDias(hoy, -60) || fecha > sumarDias(hoy, 1)) return;
    const d = porFecha.get(fecha) || { fecha };
    d[k] = k === "pasos" ? Math.max(d.pasos ?? 0, n) : n;
    porFecha.set(fecha, d);
  };
  for (const x of lista) {
    if (!x || typeof x !== "object" || Array.isArray(x)) continue;
    const fecha = x.fecha != null || x.date != null ? fechaDe(String(x.fecha ?? x.date)) : hoy;
    if (!fecha) continue;
    const pasos = enRango("pasos", pasosPorOrigen(x.pasos_origen, x.pasos_valor)) ?? enRango("pasos", red(numero(x.pasos ?? x.steps, { entero: true }), 0));
    const ayer = enRango("pasos", pasosPorOrigen(x.pasos_ayer_origen, x.pasos_ayer_valor)) ?? enRango("pasos", red(numero(x.pasos_ayer ?? x.steps_yesterday, { entero: true }), 0));
    const sueno = enRango("sueno_min", suenoPorOrigen(x.sueno_valor, x.sueno_duracion, x.sueno_origen)) ?? enRango("sueno_min", x.sueno_h != null || x.sleep_h != null ? minutosSueno(x.sueno_h ?? x.sleep_h, { horas: true }) : minutosSueno(x.sueno_min ?? x.sueno ?? x.sleep_min ?? x.sleep));
    const fc = enRango("fc_reposo", red(numero(x.fc_reposo ?? x.resting_hr ?? x.fc), 0));
    const hrv = enRango("hrv", red(numero(x.hrv), 1));
    poner(fecha, "pasos", pasos);
    poner(sumarDias(fecha, -1), "pasos", ayer);
    poner(fecha, "sueno_min", sueno);
    poner(fecha, "fc_reposo", fc);
    poner(fecha, "hrv", hrv);
  }
  return [...porFecha.values()].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 31);
}

// supabase/functions/integraciones/integraciones.js
var MAX_CUERPO = 256 * 1024;
var texto = (t, estado = 200, extra = {}) => new Response(t, { status: estado, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...extra } });
var json = (d, estado = 200) => new Response(JSON.stringify(d), { status: estado, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
function enlaceDe(req, url) {
  const t = (req.headers.get("x-fbe-enlace") || url.searchParams.get("t") || "").trim();
  return ENLACE.test(t) ? t : null;
}
function componerCalendario(datos) {
  const eventos = (datos?.eventos || []).map((e) => ({
    id: e.id,
    dia: e.dia,
    nombre: e.nombre,
    titulo: `${e.hecha ? "Hecho" : e.tipo === "cardio" ? "Cardio" : e.tipo === "movilidad" ? "Movilidad" : "Entreno"}: ${e.nombre}`,
    descripcion: e.descripcion || "Sesión de FBE Equipo.",
    avisoMin: e.hecha ? null : void 0
  }));
  return calendarioICS(eventos, { hora: datos?.hora || "18:00", minutos: datos?.minutos || 75, avisoMin: datos?.aviso ?? 30, nombre: "FBE · Entrenos", refrescoMin: 360 });
}
var MENSAJES = {
  enlace: "Esta clave ya no vale: copia la nueva en la app (Perfil → Conexiones → Salud del iPhone) y pégala en el atajo.",
  baja: "Tu cuenta está de baja: ya no se guardan datos nuevos.",
  consentimiento: "Falta tu consentimiento de datos de salud: dalo en la app (Perfil → Privacidad) y vuelve a probar.",
  datos: "No ha llegado nada que se pueda guardar (revisa el atajo: fecha, pasos, sueño, FC en reposo o HRV).",
  demasiados: "Demasiados días de una vez: como mucho 31."
};
function fraseGuardado(r) {
  const partes = [`${r.dias} ${r.dias === 1 ? "día" : "días"}`];
  if (r.habitos) partes.push(`${r.habitos} en tus hábitos`);
  if (r.pesos) partes.push(`${r.pesos} ${r.pesos === 1 ? "peso" : "pesos"}`);
  return `FBE: guardado (${partes.join(", ")}).`;
}
async function atender(req, { env = {}, f = globalThis.fetch, hoy = null } = {}) {
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/\/+$/, "");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { Allow: "GET, POST, OPTIONS" } });
  if (!env.SUPABASE_URL || !claveServicio(env)) return texto("Falta la configuración de Supabase en la función", 500);
  const base = clienteBase(env, f);
  if (/\/calendario(\.ics)?$/.test(ruta)) {
    if (req.method !== "GET" && req.method !== "HEAD") return texto("Usa GET", 405, { Allow: "GET" });
    const enlace = enlaceDe(req, url);
    if (!enlace) return texto("Falta el enlace del calendario", 404);
    let datos;
    try {
      datos = await base.rpc("calendario_de", { p_enlace: enlace });
    } catch {
      return texto("No se ha podido leer el calendario: prueba más tarde", 503, { "Retry-After": "600" });
    }
    if (!datos) return texto("Este enlace del calendario ya no vale: crea uno nuevo en la app", 404);
    const ics = componerCalendario(datos);
    return new Response(req.method === "HEAD" ? null : ics, { status: 200, headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="fbe-entrenos.ics"',
      "Cache-Control": "private, max-age=900"
    } });
  }
  if (/\/salud$/.test(ruta)) {
    if (req.method !== "POST") return texto("Usa POST", 405, { Allow: "POST" });
    const enlace = enlaceDe(req, url);
    if (!enlace) return json({ ok: false, mensaje: MENSAJES.enlace }, 401);
    if (Number(req.headers.get("content-length") || 0) > MAX_CUERPO) return json({ ok: false, mensaje: "Demasiados datos de una vez" }, 413);
    const crudo = await req.text();
    if (crudo.length > MAX_CUERPO) return json({ ok: false, mensaje: "Demasiados datos de una vez" }, 413);
    let cuerpo;
    try {
      cuerpo = JSON.parse(crudo);
    } catch {
      return json({ ok: false, mensaje: "El atajo tiene que mandar un JSON (Obtener contenido de URL → Cuerpo de la solicitud: JSON)" }, 400);
    }
    const dias = limpiarSalud(cuerpo, hoy || fechaMadrid());
    if (!dias.length) return json({ ok: false, mensaje: MENSAJES.datos }, 422);
    let r;
    try {
      r = await base.rpc("salud_recibir", { p_enlace: enlace, p_dias: dias });
    } catch {
      return json({ ok: false, mensaje: "No se ha podido guardar: prueba más tarde" }, 503);
    }
    if (!r?.ok) return json({ ok: false, mensaje: MENSAJES[r?.error] || "No se ha podido guardar" }, r?.error === "enlace" ? 401 : r?.error === "baja" || r?.error === "consentimiento" ? 403 : 422);
    return json({ ok: true, dias: r.dias, habitos: r.habitos, pesos: r.pesos, mensaje: fraseGuardado(r) });
  }
  return texto("No existe", 404);
}

// supabase/functions/integraciones/index.ts
Deno.serve((req) => atender(req, { env: Deno.env.toObject() }));
