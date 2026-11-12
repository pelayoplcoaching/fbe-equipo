// FBE Equipo · función «youtube-canal» en un solo archivo (generado; no lo edites a mano).
// Supabase → Edge Functions → Deploy a new function → Via Editor → nombre: youtube-canal → pega TODO este
// archivo → Deploy. Deja «Verify JWT» PUESTO (la llaman la app del coach y la de sus atletas, con su sesión).
// No necesita secretos. El código fuente está en supabase/functions/youtube-canal.
// supabase/functions/youtube-canal/canal.js
var CACHE_MS = 30 * 60 * 1e3;
var cache = /* @__PURE__ */ new Map();
var desescapar = (t) => String(t || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").trim();
var etiqueta = (xml, nombre) => {
  const m = new RegExp(`<${nombre}[^>]*>([\\s\\S]*?)</${nombre}>`).exec(xml);
  return m ? desescapar(m[1]) : null;
};
function leerFeed(xml) {
  const x = String(xml || "");
  const cab = x.split("<entry")[0];
  const titulo = (etiqueta(cab, "title") || "").slice(0, 100) || null;
  const videos = [];
  for (const trozo of x.split("<entry").slice(1)) {
    const id = etiqueta(trozo, "yt:videoId");
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) continue;
    const t = (etiqueta(trozo, "title") || "").slice(0, 140);
    const publicado = etiqueta(trozo, "published");
    const desc = (etiqueta(trozo, "media:description") || "").replace(/\s+/g, " ").slice(0, 300);
    const vistas = Number((/<media:statistics[^>]*views="(\d+)"/.exec(trozo) || [])[1]) || null;
    videos.push({ id, titulo: t || "Vídeo", publicado: publicado && !Number.isNaN(Date.parse(publicado)) ? publicado : null, descripcion: desc || null, vistas });
    if (videos.length >= 15) break;
  }
  return { titulo, videos };
}
function idDePagina(html) {
  const s = String(html || "");
  const m = /feeds\/videos\.xml\?channel_id=(UC[A-Za-z0-9_-]{22})/.exec(s) || /"(?:externalId|channelId)":"(UC[A-Za-z0-9_-]{22})"/.exec(s);
  return m ? m[1] : null;
}
var canalValido = (c) => /^UC[A-Za-z0-9_-]{22}$/.test(String(c || "")) || /^@[A-Za-z0-9._-]{3,30}$/.test(String(c || ""));
var json = (cuerpo, estado, cabeceras) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...cabeceras, "content-type": "application/json; charset=utf-8" } });
async function atender(req, { env, fetch: f = globalThis.fetch, ahora = Date.now } = {}) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-region",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Usa POST" }, 405, cors);
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return json({ error: "Faltan SUPABASE_URL o SUPABASE_ANON_KEY" }, 500, cors);
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+\.\S+\.\S+$/.test(auth)) return json({ error: "No autorizado" }, 401, cors);
  const r = await f(`${env.SUPABASE_URL}/rest/v1/youtube_canal?select=canal,activo,titulo`, { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: auth } }).catch(() => null);
  if (!r || r.status === 401) return json({ error: "No autorizado" }, 401, cors);
  if (!r.ok) return json({ canal: null, videos: [] }, 200, cors);
  const fila = (await r.json().catch(() => []))[0];
  if (!fila || !canalValido(fila.canal)) return json({ canal: null, videos: [] }, 200, cors);
  const guardado = cache.get(fila.canal);
  if (guardado && ahora() - guardado.en < CACHE_MS) return json(guardado.datos.error ? { error: guardado.datos.error } : guardado.datos, guardado.datos.error ? 502 : 200, cors);
  const cabYT = { "accept-language": "es-ES,es;q=0.9", cookie: "SOCS=CAE=", "user-agent": "Mozilla/5.0 (compatible; FBE-Equipo/1.0)" };
  const conPlazo = () => ({ headers: cabYT, ...typeof AbortSignal !== "undefined" && AbortSignal.timeout ? { signal: AbortSignal.timeout(8e3) } : {} });
  const fallo = (mensaje) => {
    cache.set(fila.canal, { en: ahora() - CACHE_MS + 5 * 6e4, datos: { canal: null, videos: [], error: mensaje } });
    return json({ error: mensaje }, 502, cors);
  };
  let id = fila.canal;
  if (id.startsWith("@")) {
    const p = await f(`https://www.youtube.com/${id}`, conPlazo()).catch(() => null);
    id = p?.ok ? idDePagina(await p.text().catch(() => "")) : null;
    if (!id) return fallo("No encuentro ese canal: prueba con su id (UC…)");
  }
  const feed = await f(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, conPlazo()).catch(() => null);
  if (!feed?.ok) return fallo("YouTube no ha contestado; prueba más tarde");
  const { titulo, videos } = leerFeed(await feed.text().catch(() => ""));
  const datos = { canal: { id, nombre: fila.canal, titulo: titulo || fila.titulo || null }, videos };
  cache.set(fila.canal, { en: ahora(), datos });
  return json(datos, 200, cors);
}

// supabase/functions/youtube-canal/index.ts
Deno.serve((req) => atender(req, { env: Deno.env.toObject() }));
