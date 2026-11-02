// v0.52: la pantalla de la racha (como la de Duolingo) y sus hitos. La racha es la de siempre (`racha()` de
// calculos.js: semanas seguidas con todo lo programado hecho; la semana en curso suma al completarse y no rompe; las
// semanas sin nada programado ni suman ni rompen). Aquí, solo cómo se enseña.
import { lunesDe, sumarDias } from './fechas.js';

export const HITOS_RACHA = [4, 8, 12, 26, 52];

// La próxima meta y cuánto falta (la barra va del hito anterior al siguiente). Pasado el último, de 52 en 52.
export function proximoHito(racha) {
  const n = Math.max(0, Math.floor(Number(racha) || 0));
  let hito = HITOS_RACHA.find((h) => h > n);
  if (!hito) hito = (Math.floor(n / 52) + 1) * 52;
  const anterior = [0, ...HITOS_RACHA].filter((h) => h < hito && h <= n).pop() ?? 0;
  const base = hito > 52 ? hito - 52 : anterior;
  return { hito, anterior: base, faltan: hito - n, frac: Math.max(0, Math.min(1, (n - base) / (hito - base))) };
}

// El hito que toca celebrar: el más alto alcanzado que este móvil aún no ha celebrado. Si se llega a varios de golpe
// (al instalar la app con 9 semanas), solo el más alto: los de debajo se dan por vistos con él.
export function hitoPorCelebrar(racha, vistos = []) {
  const n = Math.max(0, Math.floor(Number(racha) || 0));
  const ya = new Set((Array.isArray(vistos) ? vistos : []).map(Number));
  const alcanzados = HITOS_RACHA.filter((h) => h <= n);
  const alto = alcanzados[alcanzados.length - 1];
  if (!alto || ya.has(alto)) return null;
  return alto;
}
// Lo que queda visto tras celebrar uno: él y todos los de debajo
export function marcarHitos(hito, vistos = []) {
  const ya = new Set((Array.isArray(vistos) ? vistos : []).map(Number).filter((x) => HITOS_RACHA.includes(x)));
  for (const h of HITOS_RACHA) if (h <= hito) ya.add(h);
  return [...ya].sort((a, b) => a - b);
}

// Las últimas n semanas (de la más antigua a la actual), cada una como la ve la racha:
// completa · incompleta · en_curso (la de ahora, a medias) · sin_plan (nada programado)
// semanas: [{ fecha_inicio, total, hechas }] (varias del mismo lunes se suman)
export function calendarioRacha(semanas = [], hoy, n = 12) {
  const lunes = lunesDe(hoy);
  const por = new Map();
  for (const s of semanas || []) {
    if (!s?.fecha_inicio || !s.total) continue;
    const k = lunesDe(s.fecha_inicio);
    const x = por.get(k) || { total: 0, hechas: 0 };
    x.total += s.total; x.hechas += s.hechas || 0;
    por.set(k, x);
  }
  return Array.from({ length: n }, (_, i) => {
    const l = sumarDias(lunes, -7 * (n - 1 - i));
    const x = por.get(l);
    const actual = l === lunes;
    let estado = 'sin_plan';
    if (x) estado = x.hechas >= x.total ? 'completa' : actual ? 'en_curso' : 'incompleta';
    return { lunes: l, estado, hechas: x?.hechas || 0, total: x?.total || 0, actual };
  });
}

export const NOMBRE_ESTADO_SEMANA = { completa: 'completa', incompleta: 'sin completar', en_curso: 'en curso', sin_plan: 'sin nada programado' };

export const textoSemanas = (n) => (n === 1 ? '1 semana' : `${n} semanas`);
