// Temporizador de intervalos: EMOM, AMRAP, Tabata o intervalos de trabajo y descanso.
// Una configuración se convierte en una lista de fases con su duración; la pantalla solo las recorre.
//   { modo: 'intervalos', rondas, trabajo, descanso }  (segundos)
//   { modo: 'emom', minutos, cada }                     (cada = 60 s; «E2MOM» = 120)
//   { modo: 'amrap', minutos }
//   { modo: 'tabata' }                                  (8 × 20 s / 10 s)
// Todas llevan una cuenta atrás de preparación (preparar, 10 s por defecto).

export const MODOS_INTERVALOS = [
  ['intervalos', 'Intervalos'], ['emom', 'EMOM'], ['amrap', 'AMRAP'], ['tabata', 'Tabata'],
];

export const POR_DEFECTO = {
  intervalos: { modo: 'intervalos', rondas: 8, trabajo: 30, descanso: 90 },
  emom: { modo: 'emom', minutos: 12, cada: 60 },
  amrap: { modo: 'amrap', minutos: 12 },
  tabata: { modo: 'tabata', rondas: 8, trabajo: 20, descanso: 10 },
};

const limitar = (v, a, b) => Math.max(a, Math.min(b, Math.round(Number(v) || 0)));

export function normalizar(c) {
  const modo = POR_DEFECTO[c?.modo] ? c.modo : 'intervalos';
  const d = { ...POR_DEFECTO[modo], ...c, modo };
  if (modo === 'intervalos' || modo === 'tabata') return { modo, rondas: limitar(d.rondas, 1, 50), trabajo: limitar(d.trabajo, 5, 3600), descanso: limitar(d.descanso, 0, 3600), preparar: limitar(d.preparar ?? 10, 0, 60) };
  if (modo === 'emom') return { modo, minutos: limitar(d.minutos, 1, 90), cada: [60, 90, 120, 180].includes(Number(d.cada)) ? Number(d.cada) : 60, preparar: limitar(d.preparar ?? 10, 0, 60) };
  return { modo, minutos: limitar(d.minutos, 1, 90), preparar: limitar(d.preparar ?? 10, 0, 60) };
}

// Fases: [{ tipo: 'preparar' | 'trabajo' | 'descanso', s, ronda, rondas }]
export function fases(config) {
  const c = normalizar(config);
  const out = c.preparar ? [{ tipo: 'preparar', s: c.preparar, ronda: 0, rondas: 0 }] : [];
  if (c.modo === 'amrap') {
    out.push({ tipo: 'trabajo', s: c.minutos * 60, ronda: 1, rondas: 1 });
    return out;
  }
  if (c.modo === 'emom') {
    const rondas = Math.max(1, Math.floor((c.minutos * 60) / c.cada));
    for (let r = 1; r <= rondas; r++) out.push({ tipo: 'trabajo', s: c.cada, ronda: r, rondas });
    return out;
  }
  for (let r = 1; r <= c.rondas; r++) {
    out.push({ tipo: 'trabajo', s: c.trabajo, ronda: r, rondas: c.rondas });
    // Tras la última ronda no hay descanso
    if (c.descanso && r < c.rondas) out.push({ tipo: 'descanso', s: c.descanso, ronda: r, rondas: c.rondas });
  }
  return out;
}

export const duracionTotal = (config) => fases(config).reduce((t, f) => t + f.s, 0);

// Dónde se está a los t segundos de empezar: { i, fase, quedan, transcurrido, fin }
export function enCurso(lista, t) {
  let acum = 0;
  for (let i = 0; i < lista.length; i++) {
    if (t < acum + lista[i].s) return { i, fase: lista[i], quedan: acum + lista[i].s - t, transcurrido: t - acum, fin: false };
    acum += lista[i].s;
  }
  return { i: lista.length, fase: null, quedan: 0, transcurrido: 0, fin: true };
}

// «8 × 30 s / 90 s», «EMOM 12», «AMRAP 15 min»… en una frase
export function textoIntervalos(config) {
  const c = normalizar(config);
  const t = (s) => (s % 60 === 0 ? `${s / 60} min` : s > 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min` : `${s} s`);
  if (c.modo === 'amrap') return `AMRAP ${c.minutos} min`;
  // Cada 1:30 durante 10 min son 6 rondas (9 min): se dice lo que de verdad se hace
  if (c.modo === 'emom') return c.cada === 60 ? `EMOM ${c.minutos} min` : `Cada ${t(c.cada)}: ${Math.max(1, Math.floor((c.minutos * 60) / c.cada))} rondas`;
  if (c.modo === 'tabata') return `Tabata: ${c.rondas} × ${t(c.trabajo)} / ${t(c.descanso)}`;
  return c.descanso ? `${c.rondas} × ${t(c.trabajo)} / ${t(c.descanso)}` : `${c.rondas} × ${t(c.trabajo)}`;
}

// Lee los intervalos de lo que escribe el coach en la sesión («6 × 2 min fuerte con 2 min suave»,
// «EMOM 12», «AMRAP 15», «Tabata», «10x30/30»). Devuelve la configuración o null.
// Se lee en todas las sesiones (también en las de fuerza), así que ante la duda no ve nada:
//  · «5x5, descanso 3 min», «3 x 10 con 60 s»: las repeticiones no llevan unidad de tiempo → no es un intervalo;
//  · «8 × 400 m con 90 s»: es una distancia (la «m» nunca son minutos) → no se adivina;
//  · solo «10x30/30» (con barra) se entiende sin unidades: segundos, si los dos pasan de 10.
const UNIDAD = '(s|seg|segundos?|"|min|minutos?|\')?';
const aSeg = (n, u) => {
  const v = Number(String(n).replace(',', '.'));
  return /^(min|minutos?|')$/i.test(u || '') ? Math.round(v * 60) : Math.round(v);
};
const CADA_EMOM = [60, 90, 120, 180];
export function leerIntervalos(texto) {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!t.trim()) return null;
  // EMOM 12 · EMOM: 12 · E2MOM 20 (un E4MOM no lo sabe hacer: mejor nada que uno distinto)
  let m = t.match(/\be(\d)?mom\b\s*:?\s*(?:de\s*)?(\d{1,2})/);
  if (m) {
    const cada = (Number(m[1]) || 1) * 60;
    return CADA_EMOM.includes(cada) ? normalizar({ modo: 'emom', minutos: Number(m[2]), cada }) : null;
  }
  // «Cada 90 s durante 12 min»
  m = t.match(/\bcada\s*(\d+(?:[.,]\d+)?)\s*(s|seg|segundos?|min|minutos?|')\s*,?\s*(?:durante|x|\u00d7)\s*(\d{1,2})\s*(?:min|minutos?|')/);
  if (m) {
    const cada = aSeg(m[1], m[2]);
    return CADA_EMOM.includes(cada) ? normalizar({ modo: 'emom', minutos: Number(m[3]), cada }) : null;
  }
  m = t.match(/\bamrap\b\s*:?\s*(?:de\s*)?(\d{1,2})/);
  if (m) return normalizar({ modo: 'amrap', minutos: Number(m[1]) });
  if (/\btabata\b/.test(t)) return normalizar(POR_DEFECTO.tabata);
  const n = '(\\d+(?:[.,]\\d+)?)\\s*';
  const distancia = /^\s*(m|km|metros?|kilometros?)\b/;
  // «8 x 30 s / 90 s», «10x30/30» (con barra)
  m = t.match(new RegExp(`(\\d{1,2})\\s*(?:x|\\u00d7)\\s*${n}${UNIDAD}\\s*/\\s*${n}${UNIDAD}`));
  if (m && !distancia.test(t.slice(m.index + m[0].length))) {
    const u1 = m[3] || m[5], u2 = m[5] || m[3];
    if (u1 || (Number(m[2]) >= 10 && Number(m[4]) >= 10)) {
      return normalizar({ modo: 'intervalos', rondas: Number(m[1]), trabajo: aSeg(m[2], u1 || 's'), descanso: aSeg(m[4], u2 || 's') });
    }
  }
  // «6 × 2 min fuerte con 2 min suave», «8 x 1 min fuerte, 1 min suave», «5 series de 3 min, descanso 2 min»,
  // «4 x 4 min a 90-95 % FCmax con 3 min de recuperación»: aquí el trabajo tiene que llevar su unidad de tiempo
  m = t.match(new RegExp(`(\\d{1,2})\\s*(?:x|\\u00d7|series de|rondas de)\\s*${n}(s|seg|segundos?|"|min|minutos?|')(?![a-z])[^/]{0,40}?(?:/|,|\\bcon\\b|\\by\\b|\\bdescanso\\b|\\brecuperacion\\b|\\bpausa\\b)\\s*(?:de\\s*)?${n}${UNIDAD}`));
  if (m && !distancia.test(t.slice(m.index + m[0].length))) {
    return normalizar({ modo: 'intervalos', rondas: Number(m[1]), trabajo: aSeg(m[2], m[3]), descanso: aSeg(m[4], m[5] || m[3]) });
  }
  return null;
}
