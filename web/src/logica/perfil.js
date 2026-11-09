// v0.114: el perfil del atleta, más bonito y más social (como Strava, Hevy o Apple Fitness). Aquí, lo que no depende de
// la pantalla (probado en test/logica.test.mjs): sus cifras por periodo, las 12 semanas de la gráfica, sus hitos y el
// anillo de la racha. Todo sale de sus entrenos hechos (api.entrenamientos: fecha, minutos, series, tonelaje, récords).
import { lunesDe, sumarDias, diasEntre } from './fechas.js';

const sumar = (lista) => ({
  sesiones: lista.length,
  minutos: lista.reduce((t, x) => t + (Number(x.duracion_min) || 0), 0),
  tonelaje: lista.reduce((t, x) => t + (Number(x.tonelaje) || 0), 0),
  series: lista.reduce((t, x) => t + (Number(x.series) || 0), 0),
  records: lista.reduce((t, x) => t + (Number(x.records) || 0), 0),
});

// Esta semana (de lunes a hoy), este año (desde el 1 de enero) y siempre
export function cifrasPeriodo(entrenos = [], hoy) {
  const con = (entrenos || []).filter((x) => x?.fecha && x.fecha <= hoy);
  const lunes = lunesDe(hoy);
  const enero = `${hoy.slice(0, 4)}-01-01`;
  return {
    semana: sumar(con.filter((x) => x.fecha >= lunes)),
    anio: sumar(con.filter((x) => x.fecha >= enero)),
    siempre: sumar(con),
  };
}

// Las últimas n semanas (de la más antigua a la actual), con sus sesiones, minutos y tonelaje
export function semanasPerfil(entrenos = [], hoy, n = 12) {
  const primero = sumarDias(lunesDe(hoy), -7 * (n - 1));
  const semanas = Array.from({ length: n }, (_, i) => ({ lunes: sumarDias(primero, 7 * i), sesiones: 0, minutos: 0, tonelaje: 0 }));
  for (const x of entrenos || []) {
    if (!x?.fecha || x.fecha < primero || x.fecha > hoy) continue;
    const i = Math.floor(diasEntre(primero, x.fecha) / 7);
    const w = semanas[i];
    if (!w) continue;
    w.sesiones += 1;
    w.minutos += Number(x.duracion_min) || 0;
    w.tonelaje += Number(x.tonelaje) || 0;
  }
  return semanas;
}

// Horas («3 h 20 min», «45 min», «0 min») y toneladas («12,4 t»; por debajo de una, en kilos)
export function textoHoras(min) {
  const m = Math.round(Number(min) || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
export const HITOS_SESIONES = [1, 10, 25, 50, 100, 200, 300, 500];

// Los hitos de su historia en FBE, del más reciente al más antiguo: el alta, la primera sesión, el primer récord, las
// sesiones redondas (10, 25, 50, 100…) y cada año en FBE. fechaAlta: la de «Cliente de FBE desde» (atletas.fecha_alta).
export function hitosDe({ fechaAlta = null, entrenos = [] } = {}, hoy) {
  const hechos = (entrenos || []).filter((x) => x?.fecha && x.fecha <= hoy).sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  const out = [];
  if (fechaAlta && fechaAlta <= hoy) {
    out.push({ id: 'alta', fecha: fechaAlta, icono: 'estrella', texto: 'Empiezas en FBE' });
    for (let a = 1; a <= 30; a++) {
      const f = `${Number(fechaAlta.slice(0, 4)) + a}${fechaAlta.slice(4)}`;
      if (f > hoy) break;
      out.push({ id: `anio-${a}`, fecha: f, icono: 'trofeo', texto: a === 1 ? 'Un año en FBE' : `${a} años en FBE` });
    }
  }
  HITOS_SESIONES.forEach((n) => {
    const x = hechos[n - 1];
    if (x) out.push({ id: `sesiones-${n}`, fecha: x.fecha, icono: n === 1 ? 'play' : 'hecho', texto: n === 1 ? `Tu primera sesión: ${x.nombre || 'entreno'}` : `${n} sesiones hechas` });
  });
  const conRecord = hechos.find((x) => Number(x.records) > 0);
  if (conRecord) out.push({ id: 'record', fecha: conRecord.fecha, icono: 'trofeo', texto: `Tu primer récord, en ${conRecord.nombre || 'un entreno'}` });
  return out.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

// El anillo de la foto: cuánto se cierra (la racha frente al siguiente hito de 4, 8, 12, 26 o 52 semanas) y su tono
export const HITOS_RACHA = [4, 8, 12, 26, 52];
export function anilloRacha(racha) {
  const r = Math.max(0, Math.floor(Number(racha) || 0));
  if (!r) return { racha: 0, fraccion: 0, tono: 'apagado', meta: HITOS_RACHA[0] };
  const meta = HITOS_RACHA.find((h) => h > r) || null;
  const antes = [...HITOS_RACHA].reverse().find((h) => h <= r) || 0;
  const fraccion = meta ? (r - antes) / (meta - antes) : 1;
  return { racha: r, fraccion: Math.round(fraccion * 100) / 100, tono: r >= 12 ? 'fuego' : r >= 4 ? 'caliente' : 'templado', meta };
}

// Los tres mejores récords de la vitrina (por 1RM estimado), para la cabecera
export function mejoresRecords(vitrina, n = 3) {
  return [...(vitrina?.ejercicios || [])].filter((x) => x.e1rm?.valor > 0).sort((a, b) => b.e1rm.valor - a.e1rm.valor).slice(0, n);
}
