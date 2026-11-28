// (belleza B84, v0.286) La lectura de la gráfica de fuerza, en una línea encima: lo que dice la propia línea de tus
// semanas, sin cifras nuevas. «Sube desde hace 3 semanas» si las últimas tres semanas o más no bajan y en total suben;
// «Estable desde hace 4 semanas» si llevan tres semanas o más sin moverse más de un 1 %. Si baja, nada: la gráfica ya se
// ve y quien interpreta un bajón es tu coach (o la app, en FBE Esencial, con sus avisos de siempre).
import { diasEntre } from './fechas.js';

const ESTABLE = 0.01;   // un 1 % del valor: menos que eso, «estable»
const MIN_PUNTOS = 3;   // tres semanas con datos como poco (dos pasos)

// puntos: [{ semana: 'AAAA-MM-DD', valor }] en orden de fecha (los de la gráfica, ya en su rango)
export function tendenciaFuerza(puntos = []) {
  const p = (puntos || []).filter((x) => x && x.semana && Number.isFinite(Number(x.valor)));
  if (p.length < MIN_PUNTOS) return null;
  const v = p.map((x) => Number(x.valor));
  const ult = v.length - 1;
  // lo que llevan subiendo (sin bajar ningún paso)
  let i = ult;
  while (i > 0 && v[i] >= v[i - 1]) i--;
  if (ult - i >= MIN_PUNTOS - 1 && v[ult] - v[i] > ESTABLE * v[i]) {
    const semanas = Math.max(1, Math.round(diasEntre(p[i].semana, p[ult].semana) / 7));
    return { tipo: 'sube', semanas };
  }
  // lo que llevan sin moverse (cada paso y el total, dentro del 1 %)
  let j = ult;
  while (j > 0 && Math.abs(v[j] - v[j - 1]) <= ESTABLE * Math.max(v[j], v[j - 1]) && Math.abs(v[ult] - v[j - 1]) <= ESTABLE * Math.max(v[ult], v[j - 1])) j--;
  if (ult - j >= MIN_PUNTOS - 1) {
    const semanas = Math.max(1, Math.round(diasEntre(p[j].semana, p[ult].semana) / 7));
    return { tipo: 'estable', semanas };
  }
  return null;
}

export function textoTendencia(t, nombre = '') {
  if (!t) return '';
  const cuando = `desde hace ${t.semanas} ${t.semanas === 1 ? 'semana' : 'semanas'}`;
  const que = t.tipo === 'sube' ? 'sube' : 'estable';
  return nombre ? `${nombre}: ${que} ${cuando}` : `${que[0].toUpperCase()}${que.slice(1)} ${cuando}`;
}
