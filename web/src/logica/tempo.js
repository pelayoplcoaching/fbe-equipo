// Tempo de una repetición: «3-1-1» o «31X0» = bajada, pausa abajo, subida y pausa arriba, en segundos
// (X = explosiva, se cuenta como 1 s). Se lee de la pauta (tempo) o, si no, de la variante o la nota
// («Tempo 3-1-1: baja en 3 s»).

const NOMBRES = ['Baja', 'Pausa abajo', 'Sube', 'Pausa arriba'];
const SEP = /\s*[-/:.\s]\s*/;
const EN_TEXTO = /tempo\s*:?\s*([0-9xX](?:\s*[-/:.]?\s*[0-9xX]){2,3})/i;

export function leerTempo(texto) {
  // O todo separado («3-1-1», «3 1 1») o todo junto («311», «31X0»): «10-1-1» no es un tempo
  const limpio = String(texto || '').trim();
  const v = SEP.test(limpio) ? limpio.split(SEP) : limpio.split('');
  if (v.length < 3 || v.length > 4 || !v.every((x) => /^[0-9xX]$/.test(x))) return null;
  const fases = v.map((x, i) => ({ nombre: NOMBRES[i], s: /x/i.test(x) ? 1 : Number(x), explosiva: /x/i.test(x) }));
  if (!fases.some((f) => f.s > 0) || fases.some((f) => f.s > 9)) return null;
  const total = fases.reduce((t, f) => t + f.s, 0);
  const sep = SEP.test(limpio) ? '-' : '';
  return { texto: v.join(sep).toUpperCase(), fases, total };
}

export function tempoDe(pauta) {
  return leerTempo(pauta?.tempo) || leerTempo(String(pauta?.variante || '').match(EN_TEXTO)?.[1]) || leerTempo(String(pauta?.notas_coach || '').match(EN_TEXTO)?.[1]);
}

// «Baja en 3 s, 1 s abajo y sube en 1 s» (para leerlo de un vistazo)
export function explicarTempo(t) {
  if (!t) return '';
  const [b, pa, s, pr] = t.fases;
  const partes = [`baja en ${b.s} s`];
  if (pa?.s) partes.push(`${pa.s} s abajo`);
  if (s) partes.push(s.explosiva ? 'sube lo más rápido que puedas' : `sube en ${s.s} s`);
  if (pr?.s) partes.push(`${pr.s} s arriba`);
  const txt = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : partes[0];
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

// Dónde va el metrónomo a los `t` segundos de empezar (tras la cuenta atrás): repetición, fase y segundo de la fase
export function posicionTempo(t, tempo) {
  if (!tempo?.total || t < 0) return null;
  const rep = Math.floor(t / tempo.total);
  let r = t - rep * tempo.total;
  for (let i = 0; i < tempo.fases.length; i++) {
    const f = tempo.fases[i];
    if (r < f.s) return { rep, fase: i, enFase: r, quedan: f.s - r };
    r -= f.s;
  }
  return { rep: rep + 1, fase: 0, enFase: 0, quedan: tempo.fases[0].s };
}
