// Cómo va la app en los dispositivos de verdad (pulido 4): cuánto tarda en abrir, en enseñar cada pantalla, en
// contestar la base y en guardar. Cada dispositivo apunta sus tiempos y manda, como mucho una fila por día, un resumen
// en forma de recuento por tramos (cuántas veces tardó menos de 50 ms, de 100, de 200…). Los recuentos de varios
// dispositivos y días se suman sin más, y de la suma salen «lo normal» (la mitad de las veces tarda eso o menos) y «lo
// lento» (una de cada diez veces tarda eso o más). Aquí no hay nada de la persona ni de lo que hace: solo tiempos, el
// tipo de dispositivo y la versión de la app. Sin pantalla ni red: funciones puras (las usa también la base de la demo).

// Los tramos, en milisegundos (el último recoge todo lo que pase del mayor)
export const CORTES = [50, 100, 200, 400, 800, 1500, 3000, 6000, 12000];
const TRAMOS = CORTES.length + 1;
export const MAX_METRICAS = 40;
export const TOPE_MS = 10 * 60 * 1000;   // nada de la app tarda diez minutos: un tiempo así es un reloj cambiado o la app dormida
const NOMBRE = /^[a-z][a-z0-9:_-]{0,39}$/;
export const nombreValido = (n) => typeof n === 'string' && NOMBRE.test(n);

export const metricaVacia = () => ({ n: 0, h: new Array(TRAMOS).fill(0), max: 0 });
const tramoDe = (ms) => { for (let i = 0; i < CORTES.length; i++) if (ms < CORTES[i]) return i; return CORTES.length; };

// Apunta un tiempo en una medida (la cambia y la devuelve). Lo que no es un tiempo razonable no se apunta
export function apuntarTiempo(m, ms) {
  const x = ms;
  if (!m || typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > TOPE_MS) return m;
  m.n++;
  m.h[tramoDe(x)]++;
  if (x > m.max) m.max = Math.round(x);
  return m;
}

// Una medida que viene de fuera (del móvil guardado, de la base), saneada; null si no lo es
export function leerMetrica(x) {
  if (!x || typeof x !== 'object' || !Array.isArray(x.h) || x.h.length !== TRAMOS) return null;
  const h = x.h.map((v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(1e7, Math.floor(Number(v))) : 0));
  const n = h.reduce((a, b) => a + b, 0);
  if (!n) return null;
  const max = Number.isFinite(Number(x.max)) ? Math.max(0, Math.min(TOPE_MS, Math.round(Number(x.max)))) : 0;
  return { n, h, max };
}
// El conjunto de medidas de un dispositivo y un día: { nombre: medida }
export function leerDatos(datos) {
  const out = {};
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return out;
  for (const [k, v] of Object.entries(datos)) {
    if (Object.keys(out).length >= MAX_METRICAS) break;
    const m = nombreValido(k) ? leerMetrica(v) : null;
    if (m) out[k] = m;
  }
  return out;
}

export function sumarMetricas(a, b) {
  if (!a) return b ? { n: b.n, h: [...b.h], max: b.max } : metricaVacia();
  if (!b) return { n: a.n, h: [...a.h], max: a.max };
  return { n: a.n + b.n, h: a.h.map((v, i) => v + b.h[i]), max: Math.max(a.max, b.max) };
}
export function sumarDatos(a, b) {
  const out = {};
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) out[k] = sumarMetricas(a?.[k], b?.[k]);
  return out;
}

// El tiempo por debajo del cual queda la fracción p de las veces (0,5: lo normal; 0,9: lo lento). Se estima dentro de
// su tramo, repartiendo las veces por igual; en el último tramo, hasta el máximo visto. null si no hay nada apuntado
export function percentil(m, p) {
  if (!m || !m.n) return null;
  const objetivo = Math.max(1, Math.ceil(m.n * Math.min(1, Math.max(0, p))));
  let acumulado = 0;
  for (let i = 0; i < TRAMOS; i++) {
    const c = m.h[i];
    if (!c) continue;
    if (acumulado + c >= objetivo) {
      const desde = i === 0 ? 0 : CORTES[i - 1];
      const hasta = Math.min(i < CORTES.length ? CORTES[i] : Math.max(m.max, desde), Math.max(m.max, desde));
      return Math.round(desde + (hasta - desde) * ((objetivo - acumulado) / c));
    }
    acumulado += c;
  }
  return m.max;
}

// El tipo de dispositivo, sin identificarlo: sistema, si la app está instalada, la red que dice tener y poco más.
// ua: navigator.userAgent (solo se mira, no se guarda); tactil: maxTouchPoints > 1 (un iPad dice ser un Mac)
export function entornoDe({ ua = '', tactil = false, instalada = false, red = null, memoria = null, nucleos = null } = {}) {
  const u = String(ua);
  const so = /iPhone|iPad|iPod/.test(u) || (/Macintosh/.test(u) && tactil) ? 'ios' : /Android/.test(u) ? 'android' : 'otro';
  const e = { so, instalada: !!instalada };
  if (typeof red === 'string' && /^(slow-2g|2g|3g|4g)$/.test(red)) e.red = red;
  if (Number.isFinite(Number(memoria)) && Number(memoria) > 0) e.memoria = Math.min(64, Number(memoria));
  if (Number.isFinite(Number(nucleos)) && Number(nucleos) > 0) e.nucleos = Math.min(128, Math.round(Number(nucleos)));
  return e;
}
export function leerEntorno(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return { so: 'otro', instalada: false };
  return entornoDe({ ua: x.so === 'ios' ? 'iPhone' : x.so === 'android' ? 'Android' : '', instalada: x.instalada === true, red: x.red, memoria: x.memoria, nucleos: x.nucleos });
}
export const claseDe = (entorno) => (entorno?.so === 'ios' ? 'iPhone o iPad' : entorno?.so === 'android' ? 'Android' : 'Ordenador u otro');

// Lo que se enseña, por su orden, con su nombre de la calle. Las pantallas (pantalla:<cuál>) se nombran aparte
export const MEDIDAS = [
  ['arranque', 'Abrir la app'],
  ['consulta', 'Cada consulta a la base'],
  ['guardar', 'Guardar algo'],
  ['sin-red', 'Consultas que fallan por la conexión'],
  ['bloqueo', 'Bloqueos (la app sin responder)'],
  ['toque-lento', 'Toques que tardan en responder'],
];
const PANTALLAS = { hoy: 'Hoy', semana: 'Semana', progreso: 'Progreso', mensajes: 'Mensajes', comidas: 'Comidas', equipo: 'Equipo', perfil: 'Perfil', sesion: 'una sesión',
  atletas: 'la lista de atletas', ficha: 'la ficha de un atleta', revisar: 'Revisar', revision: 'Revisión semanal', radar: 'A quién escribir', plantillas: 'Plantillas', biblioteca: 'Biblioteca', cuenta: 'Cuenta' };
export function nombreMedida(k) {
  const fija = MEDIDAS.find(([id]) => id === k);
  if (fija) return fija[1];
  const p = /^pantalla:([a-z0-9_-]+)$/.exec(k);
  if (p) return `Abrir ${PANTALLAS[p[1]] || p[1]}`;
  return k;
}
export const textoMs = (ms) => (ms == null ? '—' : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0).replace('.', ',')} s`);

// De una medida sumada: cuántas veces, lo normal, lo lento y lo peor
export const cifras = (m) => (m && m.n ? { n: m.n, normal: percentil(m, 0.5), lento: percentil(m, 0.9), peor: m.max } : null);

// filas: lo que da la base ({ dispositivo, dia, rol, version, entorno, datos }), una por dispositivo y día.
// Devuelve el resumen del equipo: en total, por tipo de dispositivo, por papel y por versión, más los dispositivos
// (sin nombre: un código) ordenados del que peor abre al que mejor.
export function resumenRendimiento(filas) {
  const validas = (Array.isArray(filas) ? filas : []).map((f) => ({
    dispositivo: String(f?.dispositivo || '').slice(0, 16) || '?', dia: String(f?.dia || '').slice(0, 10), rol: f?.rol === 'coach' ? 'coach' : 'atleta',
    version: String(f?.version || '').slice(0, 40), entorno: leerEntorno(f?.entorno), datos: leerDatos(f?.datos),
  })).filter((f) => Object.keys(f.datos).length);
  const grupo = (clave) => {
    const g = new Map();
    for (const f of validas) {
      const k = clave(f);
      const x = g.get(k) || { clave: k, dispositivos: new Set(), dias: 0, datos: {} };
      x.dispositivos.add(f.dispositivo); x.dias++; x.datos = sumarDatos(x.datos, f.datos);
      g.set(k, x);
    }
    return [...g.values()].map((x) => ({ clave: x.clave, dispositivos: x.dispositivos.size, dias: x.dias, datos: x.datos })).sort((a, b) => b.dias - a.dias || String(a.clave).localeCompare(String(b.clave)));
  };
  const todo = grupo(() => 'todo')[0] || { clave: 'todo', dispositivos: 0, dias: 0, datos: {} };
  const porDispositivo = grupo((f) => f.dispositivo).map((d) => {
    const ultima = validas.filter((f) => f.dispositivo === d.clave).sort((a, b) => (a.dia < b.dia ? 1 : -1))[0];
    return { ...d, clase: claseDe(ultima.entorno), entorno: ultima.entorno, rol: ultima.rol, version: ultima.version, arranque: percentil(d.datos.arranque, 0.5) };
  }).sort((a, b) => (b.arranque ?? -1) - (a.arranque ?? -1));
  return {
    filas: validas.length, desde: validas.map((f) => f.dia).sort()[0] || null, hasta: validas.map((f) => f.dia).sort().at(-1) || null,
    todo, porClase: grupo((f) => `${claseDe(f.entorno)}${f.entorno.so !== 'otro' ? (f.entorno.instalada ? ', instalada' : ', en el navegador') : ''}`),
    porRol: grupo((f) => f.rol), porVersion: grupo((f) => f.version || '?'), dispositivos: porDispositivo,
  };
}

// Las medidas de un grupo, en el orden en que se enseñan: las fijas y luego las pantallas, de la más usada a la menos
export function medidasDe(datos) {
  const fijas = MEDIDAS.map(([k]) => k).filter((k) => datos?.[k]?.n);
  const pantallas = Object.keys(datos || {}).filter((k) => k.startsWith('pantalla:') && datos[k].n).sort((a, b) => datos[b].n - datos[a].n);
  return [...fijas.slice(0, 1), ...pantallas, ...fijas.slice(1)].map((k) => ({ k, nombre: nombreMedida(k), ...cifras(datos[k]) }));
}

// Para pegárselo a Claude: solo cifras
export function textoRendimiento(r) {
  if (!r || !r.filas) return 'Sin medidas todavía.';
  const linea = (x) => `  ${x.nombre}: normal ${textoMs(x.normal)}, lento ${textoMs(x.lento)}, peor ${textoMs(x.peor)} (${x.n} veces)`;
  const bloque = (titulo, g) => [`${titulo} (${g.dispositivos} ${g.dispositivos === 1 ? 'dispositivo' : 'dispositivos'}, ${g.dias} ${g.dias === 1 ? 'día' : 'días'} de uso)`, ...medidasDe(g.datos).map(linea)].join('\n');
  return [
    `Rendimiento de FBE Equipo, del ${r.desde} al ${r.hasta}. «Normal»: la mitad de las veces tarda eso o menos. «Lento»: una de cada diez tarda eso o más.`,
    bloque('TODOS', r.todo),
    ...r.porClase.map((g) => bloque(g.clave.toUpperCase(), g)),
    ...r.porRol.map((g) => bloque(g.clave === 'coach' ? 'CUENTA DE COACH' : 'ATLETAS', g)),
    ...r.porVersion.slice(0, 4).map((g) => bloque(`VERSIÓN ${g.clave}`, g)),
    'LOS QUE PEOR ABREN', ...r.dispositivos.slice(0, 8).map((d) => `  ${d.clave} · ${d.clase}${d.entorno.instalada ? ', instalada' : ''}${d.entorno.red ? `, red ${d.entorno.red}` : ''}${d.entorno.memoria ? `, ${d.entorno.memoria} GB` : ''} · ${d.rol} · abre en ${textoMs(d.arranque)} · consulta ${textoMs(percentil(d.datos.consulta, 0.5))}`),
  ].join('\n');
}
