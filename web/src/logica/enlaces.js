// Enlaces en los mensajes y en las notas del coach (v0.48): se pueden tocar y los de YouTube llevan su miniatura
// (i.ytimg.com, sin más llamadas a nadie). Solo se reconocen direcciones http(s) completas.

// http(s)://… hasta un espacio; sin la puntuación del final de la frase
const URL_RE = /https?:\/\/[^\s<>"']+/gi;
// (v0.54: tampoco los signos del formato de WhatsApp, «*» y «~», ni la comilla del monoespaciado: «*mira https://…*»)
const recortar = (u) => u.replace(/[).,;:!?\u00bb*~`]+$/, '');

// El id de un vídeo de YouTube (11 caracteres) en youtube.com/watch?v=, youtu.be/, /shorts/, /embed/ o /live/; si no, null
export function idYoutube(url) {
  let u;
  try { u = new URL(String(url)); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1] || null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else { const m = /^\/(shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname); id = m ? m[2] : null; }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

// La miniatura (la mediana, 320 × 180)
export const miniaturaYoutube = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

// El texto en trozos: [{ tipo: 'texto', valor } | { tipo: 'enlace', valor, youtube }]
export function trozosConEnlaces(texto) {
  const t = String(texto ?? '');
  const out = [];
  let i = 0;
  for (const m of t.matchAll(URL_RE)) {
    const url = recortar(m[0]);
    if (m.index > i) out.push({ tipo: 'texto', valor: t.slice(i, m.index) });
    out.push({ tipo: 'enlace', valor: url, youtube: idYoutube(url) });
    i = m.index + url.length;
  }
  if (i < t.length) out.push({ tipo: 'texto', valor: t.slice(i) });
  return out;
}

// Los vídeos de YouTube de un texto (sin repetir, como mucho 3)
export const videosYoutube = (texto) => [...new Set(trozosConEnlaces(texto).filter((x) => x.youtube).map((x) => x.youtube))].slice(0, 3);
