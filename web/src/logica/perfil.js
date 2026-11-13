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
  out.push(...hitosAcumulados(hechos, hoy)); // v0.116: también las series y las toneladas redondas
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

// ================================================================ v0.116: otras 15 para el perfil
const restarAnio = (iso) => `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`;
// Tus cifras frente al periodo de antes, hasta el mismo día: la semana pasada (de lunes al mismo día de la semana) y el
// año pasado (del 1 de enero al mismo día). «Siempre» no tiene con qué compararse
export function comparacionPeriodo(entrenos = [], hoy) {
  const con = (entrenos || []).filter((x) => x?.fecha);
  const entre = (a, b) => sumar(con.filter((x) => x.fecha >= a && x.fecha <= b));
  const lunes = lunesDe(hoy);
  const enero = `${hoy.slice(0, 4)}-01-01`;
  return {
    semana: entre(sumarDias(lunes, -7), sumarDias(hoy, -7)),
    anio: entre(restarAnio(enero), restarAnio(hoy)),
    siempre: null,
  };
}
// «+2», «−1», «=»: la diferencia de una cifra frente a su periodo de antes
export function textoDiferencia(ahora, antes) {
  const d = Math.round((Number(ahora) || 0) - (Number(antes) || 0));
  return d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '=';
}

// Los días entrenados de los últimos 12 meses (53 semanas, de lunes a domingo), con su nivel 0–3 por sesiones ese día
export function anioDias(entrenos = [], hoy, semanas = 53) {
  const dias = {};
  for (const x of entrenos || []) if (x?.fecha && x.fecha <= hoy) dias[x.fecha] = (dias[x.fecha] || 0) + 1;
  const primero = sumarDias(lunesDe(hoy), -7 * (semanas - 1));
  const out = Array.from({ length: semanas }, (_, i) => {
    const l = sumarDias(primero, 7 * i);
    return { lunes: l, dias: Array.from({ length: 7 }, (_, d) => { const iso = sumarDias(l, d); const n = dias[iso] || 0; return { iso, n, nivel: iso > hoy ? -1 : n >= 2 ? 3 : n === 1 ? 2 : 0 }; }) };
  });
  const total = out.reduce((t, w) => t + w.dias.filter((d) => d.n > 0).length, 0);
  return { semanas: out, diasEntrenados: total };
}

// La hora de Madrid de una marca de tiempo (0–23), o null
export function horaMadrid(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return Number(new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: 'numeric', hourCycle: 'h23' }).format(d));
}
export const FRANJAS = [['manana', 'Por la mañana', 5, 12], ['mediodia', 'A mediodía', 12, 16], ['tarde', 'Por la tarde', 16, 21], ['noche', 'Por la noche', 21, 29]];
export const franjaDe = (h) => (h == null ? null : (FRANJAS.find(([, , a, b]) => (h < 5 ? h + 24 : h) >= a && (h < 5 ? h + 24 : h) < b) || [null])[0]);
export const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
// Tus costumbres: en qué días de la semana y a qué hora sueles entrenar, y cuánto te duran las sesiones
export function costumbres(entrenos = [], hoy) {
  const con = (entrenos || []).filter((x) => x?.fecha && x.fecha <= hoy);
  const dias = [0, 0, 0, 0, 0, 0, 0];
  const franjas = Object.fromEntries(FRANJAS.map(([k]) => [k, 0]));
  for (const x of con) {
    const dow = (new Date(`${x.fecha}T12:00:00Z`).getUTCDay() + 6) % 7;
    dias[dow] += 1;
    const f = franjaDe(horaMadrid(x.inicio));
    if (f) franjas[f] += 1;
  }
  const max = Math.max(...dias);
  const favoritos = max > 0 ? dias.map((n, i) => [n, i]).filter(([n]) => n >= max * 0.8 && n > 0).map(([, i]) => i) : [];
  const conHora = Object.values(franjas).reduce((t, n) => t + n, 0);
  const franja = conHora >= 3 ? Object.entries(franjas).sort((a, b) => b[1] - a[1])[0][0] : null;
  const duraciones = con.map((x) => Number(x.duracion_min) || 0).filter((m) => m > 0);
  const media = duraciones.length ? Math.round(duraciones.reduce((t, m) => t + m, 0) / duraciones.length) : null;
  const larga = con.filter((x) => Number(x.duracion_min) > 0).sort((a, b) => b.duracion_min - a.duracion_min)[0] || null;
  return { sesiones: con.length, dias, favoritos, franjas, franja, media, larga };
}
export function textoFavoritos(favoritos = []) {
  const n = favoritos.map((i) => DIAS_LARGOS[i]);
  if (!n.length) return null;
  return n.length === 1 ? `los ${n[0]}` : `los ${n.slice(0, -1).join(', ')} y los ${n.at(-1)}`;
}

// Tus mejores marcas de constancia: la semana con más sesiones y el mes con más sesiones
export function mejoresConstancia(entrenos = [], hoy) {
  const porSemana = {}, porMes = {};
  for (const x of entrenos || []) {
    if (!x?.fecha || x.fecha > hoy) continue;
    const l = lunesDe(x.fecha);
    porSemana[l] = (porSemana[l] || 0) + 1;
    const m = x.fecha.slice(0, 7);
    porMes[m] = (porMes[m] || 0) + 1;
  }
  const mejor = (o) => Object.entries(o).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0] || null;
  const s = mejor(porSemana), m = mejor(porMes);
  return { semana: s ? { lunes: s[0], sesiones: s[1] } : null, mes: m ? { mes: m[0], sesiones: m[1] } : null };
}

// Lo que más entrenas: las series por grupo muscular de los últimos `dias` días (principal 1, secundarios 0,5)
export function gruposRecientes(entrenos = [], hoy, dias = 28) {
  const desde = sumarDias(hoy, -(dias - 1));
  const t = {};
  for (const x of entrenos || []) {
    if (!x?.fecha || x.fecha < desde || x.fecha > hoy) continue;
    for (const [g, n] of Object.entries(x.grupos || {})) t[g] = (t[g] || 0) + (Number(n) || 0);
  }
  return Object.entries(t).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([g, n]) => ({ grupo: g, series: Math.round(n * 2) / 2 }));
}

// Tus ejercicios más repetidos: en cuántas sesiones has hecho cada uno
export function ejerciciosMasHechos(entrenos = [], n = 5) {
  const t = new Map();
  for (const x of entrenos || []) for (const e of x.ejercicios || []) {
    const v = t.get(e.id) || { id: e.id, nombre: e.nombre || 'Ejercicio', sesiones: 0, ultima: null };
    v.sesiones += 1;
    if (x.fecha && (!v.ultima || x.fecha > v.ultima)) v.ultima = x.fecha;
    t.set(e.id, v);
  }
  return [...t.values()].sort((a, b) => b.sesiones - a.sesiones || (a.nombre < b.nombre ? -1 : 1)).slice(0, n);
}

// Más hitos: las series y las toneladas acumuladas
export const HITOS_SERIES = [100, 500, 1000, 2500, 5000];
export const HITOS_TONELADAS = [10, 50, 100, 250, 500, 1000];
export function hitosAcumulados(entrenos = [], hoy) {
  const hechos = (entrenos || []).filter((x) => x?.fecha && x.fecha <= hoy).sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  const out = [];
  let series = 0, kg = 0, iS = 0, iT = 0;
  for (const x of hechos) {
    series += Number(x.series) || 0;
    kg += Number(x.tonelaje) || 0;
    while (iS < HITOS_SERIES.length && series >= HITOS_SERIES[iS]) { out.push({ id: `series-${HITOS_SERIES[iS]}`, fecha: x.fecha, icono: 'hecho', texto: `${HITOS_SERIES[iS].toLocaleString('es-ES')} series hechas` }); iS++; }
    while (iT < HITOS_TONELADAS.length && kg / 1000 >= HITOS_TONELADAS[iT]) { out.push({ id: `toneladas-${HITOS_TONELADAS[iT]}`, fecha: x.fecha, icono: 'disco', texto: `${HITOS_TONELADAS[iT].toLocaleString('es-ES')} toneladas movidas` }); iT++; }
  }
  return out;
}

// Lo que te falta para los siguientes hitos: sesiones, series y toneladas (el más cercano de cada uno)
export function proximosHitos(entrenos = [], hoy) {
  const c = cifrasPeriodo(entrenos, hoy).siempre;
  const sig = (lista, v) => lista.find((h) => h > v) ?? null;
  const out = [];
  const s = sig(HITOS_SESIONES, c.sesiones);
  if (s) out.push({ id: 'sesiones', texto: `${s} sesiones`, actual: c.sesiones, meta: s, falta: `te faltan ${s - c.sesiones}` });
  const se = sig(HITOS_SERIES, c.series);
  if (se) out.push({ id: 'series', texto: `${se.toLocaleString('es-ES')} series`, actual: c.series, meta: se, falta: `te faltan ${se - c.series}` });
  const t = sig(HITOS_TONELADAS, c.tonelaje / 1000);
  if (t) {
    const falta = Math.max(0.1, Math.round((t - c.tonelaje / 1000) * 10) / 10);
    out.push({ id: 'toneladas', texto: `${t.toLocaleString('es-ES')} toneladas`, actual: Math.round(c.tonelaje / 100) / 10, meta: t, falta: `te faltan ${String(falta).replace('.', ',')} t` });
  }
  return out;
}

// La actividad por meses («noviembre de 2026»), con un filtro por tipo: 'todo', 'fuerza' (con series) o 'cardio'
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const esCardio = (x) => x?.tipo === 'cardio' || (!!x?.cardio_hecho && !(Number(x.series) > 0));
export function actividadPorMes(entrenos = [], filtro = 'todo') {
  const lista = (entrenos || []).filter((x) => (filtro === 'cardio' ? esCardio(x) : filtro === 'fuerza' ? !esCardio(x) : true));
  const grupos = [];
  for (const x of lista) {
    const m = (x.fecha || '').slice(0, 7);
    const titulo = m ? `${MESES_LARGOS[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}` : 'Sin fecha';
    const g = grupos.at(-1);
    if (g && g.mes === m) g.entrenos.push(x); else grupos.push({ mes: m, titulo, entrenos: [x] });
  }
  return grupos;
}

// La tarjeta para compartir tu perfil («Mi año en FBE»): para HojaCompartir (logro)
export function datosPerfilCompartir({ nombre = '', entrenos = [], racha = 0, mejor = null, hoy }) {
  const c = cifrasPeriodo(entrenos, hoy).anio;
  const lineas = [`${textoHoras(c.minutos)} entrenando`, `${String(Math.round(c.tonelaje / 100) / 10).replace('.', ',')} toneladas movidas`];
  if (c.records) lineas.push(`${c.records} ${c.records === 1 ? 'récord' : 'récords'}`);
  if (racha >= 2) lineas.push(`${racha} semanas seguidas sin fallar`);
  if (mejor) lineas.push(`Mejor marca: ${mejor}`);
  return { tipo: 'perfil', etiqueta: nombre || 'Tu perfil', nombre: `Mi ${hoy.slice(0, 4)} en FBE`, fecha: hoy, cifra: { v: String(c.sesiones), u: '', t: c.sesiones === 1 ? 'sesión este año' : 'sesiones este año' }, lineas: lineas.slice(0, 4), subtitulo: null, llama: racha >= 2 };
}

// La portada que eliges para tu perfil (solo en este móvil)
export const PORTADAS = [['noche', 'Noche'], ['aurora', 'Aurora'], ['atardecer', 'Atardecer'], ['bosque', 'Bosque'], ['oceano', 'Océano']];
export const portadaValida = (v) => (PORTADAS.some(([k]) => k === v) ? v : 'noche');
