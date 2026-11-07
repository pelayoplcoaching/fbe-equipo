// Medir cómo va la app en cada dispositivo (pulido 4). Como el registro de errores (registro-errores.js): la app
// apunta sola, mientras se usa, cuánto tarda en abrir, en enseñar cada pantalla, en contestar la base y en guardar, y
// el coach lo ve en Cuenta → Cómo va la app, sin nombres. Solo tiempos, el tipo de dispositivo y la versión.
//   · Los tiempos del día se guardan en el propio dispositivo (localStorage), ya resumidos por tramos.
//   · Se mandan a la base como mucho cada diez minutos, al dejar la app y, si quedó algo sin mandar, al abrirla: una
//     fila por dispositivo y día, que se sustituye entera (mandarla dos veces no cuenta doble).
//   · Medir nunca rompe nada: cualquier fallo aquí se calla.
import { metricaVacia, apuntarTiempo, leerDatos, nombreValido, entornoDe, MAX_METRICAS } from './logica/rendimiento.js';

const CLAVE = 'fbe-rend-v1';
const CLAVE_ID = 'fbe-rend-id';
const CADA_MS = 10 * 60 * 1000;

let estado = null;      // { dia, datos: { nombre: medida }, sucio, quien }
let destino = null;     // (fila) => Promise<boolean>
let version = '';
let reloj = () => new Date();
let guardarEn = null;   // temporizador de guardar en el dispositivo
let enviando = null;
let fueOculta = typeof document !== 'undefined' && document.visibilityState === 'hidden';

const hoyDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const almacen = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };
function cargar() {
  if (estado) return estado;
  let x = null;
  try { x = JSON.parse(almacen()?.getItem(CLAVE) || 'null'); } catch { x = null; }
  estado = x && typeof x === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(x.dia || '')
    ? { dia: x.dia, datos: leerDatos(x.datos), sucio: x.sucio === true, quien: typeof x.quien === 'string' ? x.quien.slice(0, 40) : null }
    : { dia: hoyDe(reloj()), datos: {}, sucio: false, quien: null };
  return estado;
}
function guardarYa() {
  clearTimeout(guardarEn); guardarEn = null;
  try { if (estado) almacen()?.setItem(CLAVE, JSON.stringify(estado)); } catch { /* sin sitio: se pierde lo de hoy */ }
}
const guardarLuego = () => { if (!guardarEn && typeof setTimeout === 'function') guardarEn = setTimeout(guardarYa, 5000); };

// El identificador de este dispositivo: al azar, solo para que su fila del día se sustituya a sí misma
function dispositivo() {
  try {
    const a = almacen();
    let id = a?.getItem(CLAVE_ID);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id || '')) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
      a?.setItem(CLAVE_ID, id);
    }
    return id;
  } catch { return null; }
}
function entorno() {
  try {
    const n = typeof navigator !== 'undefined' ? navigator : {};
    const instalada = (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) || n.standalone === true;
    return entornoDe({ ua: n.userAgent, tactil: n.maxTouchPoints > 1, instalada, red: n.connection?.effectiveType, memoria: n.deviceMemory, nucleos: n.hardwareConcurrency });
  } catch { return entornoDe(); }
}

// Apunta un tiempo (ms) en una medida. Si ha cambiado el día, lo de ayer se manda y se empieza de cero
export function medir(nombre, ms) {
  try {
    if (!nombreValido(nombre)) return;
    const e = cargar();
    const hoy = hoyDe(reloj());
    if (e.dia !== hoy) { cerrarDia(); }
    const s = cargar();
    if (!s.datos[nombre]) { if (Object.keys(s.datos).length >= MAX_METRICAS) return; s.datos[nombre] = metricaVacia(); }
    const antes = s.datos[nombre].n;
    apuntarTiempo(s.datos[nombre], ms);
    if (s.datos[nombre].n !== antes) { s.sucio = true; guardarLuego(); }
  } catch { /* medir nunca rompe nada */ }
}
// Un cronómetro: const fin = cronometro('guardar'); … fin()  (solo cuenta la primera vez que se para)
export function cronometro(nombre) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let hecho = false;
  return (otro = null) => { if (hecho) return; hecho = true; medir(otro || nombre, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0); };
}
// El arranque: de que se empieza a cargar la página a que se ve la primera pantalla con sus datos. Una vez por
// carga, y solo si la app ha estado a la vista todo el rato (abierta en segundo plano no dice nada)
let arrancada = false;
export function hitoArranque() {
  if (arrancada) return;
  arrancada = true;
  try { if (!fueOculta && typeof performance !== 'undefined') medir('arranque', performance.now()); } catch { /* */ }
}

// Si al abrir no había sesión (hay que escribir la contraseña o elegir cuenta), el arranque no dice nada: no se apunta
export function sinArranque() { arrancada = true; }

// Lo del día que se cierra se manda (si se puede) y se empieza el nuevo
function cerrarDia() {
  const viejo = estado;
  estado = { dia: hoyDe(reloj()), datos: {}, sucio: false, quien: viejo?.quien || null };
  guardarYa();
  if (viejo?.sucio && destino) mandar(viejo).catch(() => {});
}
async function mandar(e) {
  const id = dispositivo();
  if (!destino || !id || !Object.keys(e.datos).length) return false;
  return (await destino({ dia: e.dia, dispositivo: id, version, entorno: entorno(), datos: e.datos })) === true;
}
// Manda lo de hoy si hay algo nuevo desde la última vez. Devuelve si se mandó
export function enviarRendimiento({ forzar = false } = {}) {
  if (enviando) return enviando;
  const e = cargar();
  if (e.dia !== hoyDe(reloj())) cerrarDia();
  const s = cargar();
  if (!destino || (!s.sucio && !forzar) || !Object.keys(s.datos).length) return Promise.resolve(false);
  const n = JSON.stringify(s.datos);
  enviando = mandar(s).then((ok) => {
    // (si mientras tanto se ha apuntado algo más, sigue pendiente)
    if (ok && estado === s && JSON.stringify(s.datos) === n) { s.sucio = false; guardarYa(); }
    return ok;
  }, () => false).finally(() => { enviando = null; });
  return enviando;
}

// Se conecta una vez al arrancar, con la función que lo guarda en la base (devuelve true si lo guardó).
// automatico: mandar solo (cada diez minutos, al dejar la app y, si quedó algo pendiente, al poco de abrirla). En
// la demo no: allí solo se manda al abrir Cuenta → Cómo va la app.
export function instalarRendimiento(enviar, v = '', { automatico = true, ahora = null } = {}) {
  destino = (fila) => Promise.resolve().then(() => enviar(fila)).then((r) => r === true, () => false);
  version = String(v || '').slice(0, 40);
  if (ahora) reloj = ahora;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { fueOculta = true; guardarYa(); if (automatico) enviarRendimiento().catch(() => {}); }
  });
  window.addEventListener('pagehide', guardarYa);
  // Bloqueos (la app sin responder más de 50 ms) y toques que tardan más de 100 ms en verse: solo donde el navegador lo dice
  try {
    if (typeof PerformanceObserver === 'function') {
      const tipos = PerformanceObserver.supportedEntryTypes || [];
      if (tipos.includes('longtask')) new PerformanceObserver((l) => { for (const x of l.getEntries()) medir('bloqueo', x.duration); }).observe({ type: 'longtask', buffered: true });
      if (tipos.includes('event')) {
        new PerformanceObserver((l) => { for (const x of l.getEntries()) if (x.interactionId && /^(pointerup|click|keydown)$/.test(x.name)) medir('toque-lento', x.duration); })
          .observe({ type: 'event', durationThreshold: 100, buffered: true });
      }
    }
  } catch { /* sin esas medidas */ }
  if (!automatico) return;
  setInterval(() => { if (document.visibilityState === 'visible') enviarRendimiento().catch(() => {}); }, CADA_MS);
  setTimeout(() => { enviarRendimiento().catch(() => {}); }, 15000);
}

// De quién es lo que se mide: la cuenta que tiene la sesión (su identificador, o null si no hay nadie). Lo medido con
// otra cuenta en este mismo dispositivo no se le apunta a esta: al cambiar de cuenta o salir, se empieza de cero
// (lo que no se llegó a mandar de la anterior se pierde: ya no se puede mandar a su nombre)
export function rendimientoDe(uid) {
  try {
    const e = cargar();
    const quien = uid ? String(uid).slice(0, 40) : null;
    if (e.quien === quien) return;
    if (e.quien) estado = { dia: hoyDe(reloj()), datos: {}, sucio: false, quien };
    else e.quien = quien;
    guardarYa();
  } catch { /* */ }
}

// Para las pruebas: empezar de cero
export function reiniciarRendimiento() { estado = null; destino = null; arrancada = false; enviando = null; clearTimeout(guardarEn); guardarEn = null; reloj = () => new Date(); }
