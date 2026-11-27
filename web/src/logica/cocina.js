// (tacto 237-241, v0.272) Recetas con las manos: los ingredientes se tachan, las cantidades ruedan al cambiar las
// raciones, los tiempos de los pasos se tocan y arrancan su temporizador, y el modo cocina (un paso por pantalla). Aquí,
// lo que no depende de la pantalla (probado en test/tacto.test.mjs).

// (241) «150 g de arroz» -> la cifra (que rueda) y lo demás. Sin cifra delante («Sal»), todo es lo demás
export function cifraIngrediente(texto) {
  const t = String(texto ?? '');
  const m = /^(\d+(?:,\d+)?)(.*)$/.exec(t);
  return m ? { cifra: m[1], resto: m[2] } : { cifra: null, resto: t };
}

// (239) Los tiempos que dice un paso («10 minutos», «8-10 min», «de 2 a 3 horas», «30 segundos»). De un intervalo se
// toma lo menos (se mira y, si falta, se le da más tiempo). Devuelve el paso en trozos: [{ t }, { t: '10 minutos', seg: 600 }, …]
const TIEMPO = /(\d+(?:[.,]\d+)?)(?:\s*(?:-|\u2013|a|o)\s*(\d+(?:[.,]\d+)?))?\s*(minutos?|min|segundos?|seg|horas?|h)(?![a-z\u00e0-\u00ff])/gi;
const SEGUNDOS = (u) => (/^h/i.test(u) ? 3600 : /^s/i.test(u) ? 1 : 60);
export function trozosDePaso(texto) {
  const t = String(texto ?? '');
  const out = [];
  let fin = 0;
  for (const m of t.matchAll(TIEMPO)) {
    const seg = Math.round(Number(m[1].replace(',', '.')) * SEGUNDOS(m[3]));
    // (ni una pizca ni media tarde: de 5 segundos a 4 horas)
    if (!(seg >= 5 && seg <= 4 * 3600)) continue;
    if (m.index > fin) out.push({ t: t.slice(fin, m.index) });
    out.push({ t: m[0], seg });
    fin = m.index + m[0].length;
  }
  if (fin < t.length || !out.length) out.push({ t: t.slice(fin) });
  return out;
}
export const tiemposDePaso = (texto) => trozosDePaso(texto).filter((x) => x.seg);

// Lo que queda, para verlo: «9:59», «1:05:00»
export function textoReloj(seg) {
  const s = Math.max(0, Math.ceil(Number(seg) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const dos = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${dos(m)}:${dos(r)}` : `${m}:${dos(r)}`;
}
// Y para decirlo: «10 minutos», «1 hora y 5 minutos», «30 segundos»
export function textoDuracion(seg) {
  const s = Math.max(0, Math.round(Number(seg) || 0));
  if (s < 60) return `${s} ${s === 1 ? 'segundo' : 'segundos'}`;
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  const hs = h ? `${h} ${h === 1 ? 'hora' : 'horas'}` : '', ms = m ? `${m} ${m === 1 ? 'minuto' : 'minutos'}` : '';
  return hs && ms ? `${hs} y ${ms}` : hs || ms;
}

// (237) Lo que ya tienes en casa, tachado: se recuerda en este móvil por receta y solo ese día (mañana, la lista limpia).
// guardado: { [recetaId]: { f: 'AAAA-MM-DD', k: [índices] } }
export function tengoDe(guardado, id, hoy) {
  const x = guardado && typeof guardado === 'object' ? guardado[id] : null;
  return x && x.f === hoy && Array.isArray(x.k) ? x.k.filter((n) => Number.isInteger(n) && n >= 0) : [];
}
export function tengoCon(guardado, id, hoy, indice, si) {
  const antes = tengoDe(guardado, id, hoy);
  const k = si ? [...new Set([...antes, indice])].sort((a, b) => a - b) : antes.filter((n) => n !== indice);
  // (solo lo de hoy: lo de otros días ya no sirve)
  const limpio = Object.fromEntries(Object.entries(guardado && typeof guardado === 'object' ? guardado : {}).filter(([, v]) => v && v.f === hoy));
  if (k.length) limpio[id] = { f: hoy, k }; else delete limpio[id];
  return limpio;
}

// El temporizador de un paso: { id, nombre, fin (ms), total (s) }. Lo que queda (s) y si ya ha acabado
export const quedaDe = (r, ahora) => (r ? Math.max(0, (r.fin - ahora) / 1000) : 0);
