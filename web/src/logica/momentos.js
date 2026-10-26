// Momentos de un vídeo en los comentarios: «0:04 rodillas hacia dentro» lleva al segundo 4.

// «0:04» o «1:02,5»
export function textoMomento(t, decimas = false) {
  // En décimas enteras (con un margen para el redondeo de coma flotante: 4,3 s no debe salir «0:04,2»)
  const dec = Math.floor(Math.max(0, t) * 10 + 1e-6);
  const m = Math.floor(dec / 600), seg = Math.floor((dec % 600) / 10), d = dec % 10;
  return `${m}:${String(seg).padStart(2, '0')}${decimas ? `,${d}` : ''}`;
}
// Partes de un texto con los minutos marcados: [{ texto } | { momento, t }]
export function partirMomentos(texto) {
  const out = [];
  const re = /(^|[^\d:])(\d{1,2}):([0-5]\d)(?:[,.](\d))?(?![\d:])/g;
  let ultimo = 0, m;
  while ((m = re.exec(texto))) {
    if (Number(m[2]) >= 10) continue; // los vídeos de técnica duran segundos: «a las 18:00» es una hora, no un momento
    const ini = m.index + m[1].length;
    if (ini > ultimo) out.push({ texto: texto.slice(ultimo, ini) });
    const t = Number(m[2]) * 60 + Number(m[3]) + (m[4] ? Number(m[4]) / 10 : 0);
    out.push({ momento: texto.slice(ini, re.lastIndex), t });
    ultimo = re.lastIndex;
  }
  if (ultimo < texto.length) out.push({ texto: texto.slice(ultimo) });
  return out;
}
