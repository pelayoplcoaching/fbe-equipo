// v0.224: carrera, mejora 13 de las 20: el modo guiado de series. De las partes de una sesión de carrera, la lista de
// tramos con su tiempo para el cronómetro (calentar, cada serie con su recuperación, las rectas, enfriar) y lo que dice la
// voz al empezar cada uno. Los tramos por distancia (1.000 m) o sin tiempo no se cronometran: se pasan con «Hecho». Puro.
const ZONA = (p) => (p?.zona ? (p.zona_hasta && p.zona_hasta !== p.zona ? `Z${p.zona}-Z${p.zona_hasta}` : `Z${p.zona}`) : '');
const ZONA_VOZ = (p) => (p?.zona ? (p.zona_hasta && p.zona_hasta !== p.zona ? `en zona ${p.zona} a ${p.zona_hasta}` : `en zona ${p.zona}`) : '');
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
// «15 minutos», «90 segundos», «1 minuto y 30 segundos»
export function duracionVoz(s) {
  const m = Math.floor(s / 60), r = s % 60;
  if (!m) return `${r} segundos`;
  const tm = `${m} ${m === 1 ? 'minuto' : 'minutos'}`;
  return r ? `${tm} y ${r} segundos` : tm;
}
const duracionCorta = (s) => (s % 60 ? (s < 60 ? `${s} s` : mmss(s)) : `${s / 60} min`);
const metros = (m) => (m >= 1000 ? `${String(m / 1000).replace('.', ',')} km` : `${m} m`);
const metrosVoz = (m) => (m >= 1000 ? `${String(m / 1000).replace('.', ',')} kilómetros` : `${m} metros`);

// → [{ k: 'calentar' | 'trabajo' | 'recupera' | 'rectas' | 'enfriar' | 'libre', titulo, detalle, seg (o null: se pasa a mano), voz, nota }]
export function tramosGuiados(pauta) {
  const partes = Array.isArray(pauta?.partes) ? pauta.partes : [];
  const out = [];
  const nSeries = partes.filter((p) => p.fase === 'bloque').length;
  let iBloque = 0;
  for (const p of partes) {
    const z = ZONA(p), zv = ZONA_VOZ(p);
    if (p.fase === 'calentar' || p.fase === 'enfriar') {
      const t = p.fase === 'calentar' ? 'Calentar' : 'Enfriar';
      out.push({ k: p.fase, titulo: t, detalle: [p.seg ? duracionCorta(p.seg) : p.m ? metros(p.m) : '', z].filter(Boolean).join(' · '), seg: p.seg || null,
        voz: `${t}${p.seg ? `, ${duracionVoz(p.seg)}` : p.m ? `, ${metrosVoz(p.m)}` : ''}${zv ? ` ${zv}` : ', suave'}.`, nota: p.nota || null });
      continue;
    }
    if (p.fase === 'libre') { out.push({ k: 'libre', titulo: 'A tu aire', detalle: p.nota || '', seg: p.seg || null, voz: p.nota ? `${p.nota}.` : 'A tu aire.', nota: p.nota || null }); continue; }
    const rectas = p.fase === 'strides';
    if (!rectas) iBloque++;
    const reps = p.reps || 1;
    const nombre = rectas ? 'Recta' : reps > 1 ? 'Serie' : nSeries > 1 ? `Bloque ${iBloque}` : 'Bloque';
    for (let r = 1; r <= reps; r++) {
      const cuenta = reps > 1 ? ` ${r} de ${reps}` : '';
      const vol = p.seg ? duracionCorta(p.seg) : p.m ? metros(p.m) : '';
      out.push({ k: rectas ? 'rectas' : 'trabajo', titulo: `${nombre}${cuenta}`, detalle: [vol, z].filter(Boolean).join(' · '), seg: p.seg || null,
        voz: `${nombre}${cuenta}: ${p.seg ? duracionVoz(p.seg) : p.m ? metrosVoz(p.m) : ''}${zv ? ` ${zv}` : rectas ? ', rápida y suelta' : ''}.`, nota: p.nota || null });
      if (r < reps && p.rec_seg) {
        out.push({ k: 'recupera', titulo: 'Recupera', detalle: [duracionCorta(p.rec_seg), p.rec || ''].filter(Boolean).join(' · '), seg: p.rec_seg,
          voz: `Recupera ${duracionVoz(p.rec_seg)}${p.rec ? `, ${p.rec}` : ''}.`, nota: null });
      }
    }
  }
  return out;
}
// Lo que dura lo cronometrado (s) y cuántos tramos se pasan a mano
export function resumenGuiado(tramos = []) {
  return { seg: tramos.reduce((a, t) => a + (t.seg || 0), 0), aMano: tramos.filter((t) => !t.seg).length, n: tramos.length };
}
export { mmss as mmssGuiado };
