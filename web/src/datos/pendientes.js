// Vídeos y fotos que no se han podido enviar por falta de cobertura (v0.33): se guardan en el propio móvil
// (IndexedDB, que admite archivos grandes) y la app los envía sola cuando vuelve la conexión. Cada uno lleva su
// atleta (solo se envían con la cuenta de ese atleta abierta) y su ruta: reintentar es seguro (ver api.subirArchivo).
// El vídeo se guarda ANTES de empezar a subirlo: si el móvil cierra la app a medias, no se pierde.
// v0.57: con la dirección de su subida por trozos (TUS): al volver la cobertura, o al abrir la app otra vez, sigue por el
// trozo en que iba (no desde el principio). Se borra todo al cerrar la sesión.
const BASE = 'fbe-pendientes', ALMACEN = 'archivos', ERRORES = 'errores', SUBIDAS = 'subidas';
export const EVENTO_PENDIENTES = 'fbe-pendientes-archivos';

function abrir() {
  return new Promise((ok, mal) => {
    if (typeof indexedDB === 'undefined') { mal(new Error('Este navegador no puede guardar archivos en el móvil')); return; }
    const r = indexedDB.open(BASE, 3);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(ALMACEN)) r.result.createObjectStore(ALMACEN, { keyPath: 'id' });
      // El motivo de un envío rechazado va aparte: así no se reescribe el vídeo entero para apuntarlo
      if (!r.result.objectStoreNames.contains(ERRORES)) r.result.createObjectStore(ERRORES, { keyPath: 'id' });
      // (v0.57) y la dirección de su subida, también aparte (cambia mientras sube)
      if (!r.result.objectStoreNames.contains(SUBIDAS)) r.result.createObjectStore(SUBIDAS, { keyPath: 'id' });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error || new Error('No se puede abrir el almacén del móvil'));
  });
}
// Una transacción sin esperas dentro (en Safari, esperar algo ajeno la cierra)
async function operar(almacenes, modo, fn) {
  const db = await abrir();
  try {
    return await new Promise((ok, mal) => {
      const tx = db.transaction(almacenes, modo);
      const r = fn(tx);
      tx.oncomplete = () => ok(r?.result);
      tx.onerror = () => mal(tx.error || new Error('No se ha podido guardar en el móvil'));
      tx.onabort = () => mal(tx.error || new Error('No hay espacio en el móvil para guardarlo'));
    });
  } finally { db.close(); }
}
const avisar = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_PENDIENTES)); };
export const avisarPendientes = avisar;

// { atletaId, archivo (File/Blob: IndexedDB copia el contenido al guardarlo, sin cargarlo entero en memoria),
//   opciones: { tipo, sesion_ejercicio_id, ejercicio_id, nota_atleta, duracion_seg, fecha, ruta } } → id
export async function guardarPendiente({ atletaId, archivo, opciones }) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await operar([ALMACEN], 'readwrite', (tx) => tx.objectStore(ALMACEN).put({ id, atletaId, archivo, nombre: archivo.name || 'video.mp4', mime: archivo.type || '', opciones, creado: new Date().toISOString() }));
  avisar();
  return id;
}
export async function listarPendientes(atletaId) {
  try {
    const [todos, errores, subidas] = await Promise.all([
      operar([ALMACEN], 'readonly', (tx) => tx.objectStore(ALMACEN).getAll()),
      operar([ERRORES], 'readonly', (tx) => tx.objectStore(ERRORES).getAll()),
      operar([SUBIDAS], 'readonly', (tx) => tx.objectStore(SUBIDAS).getAll()).catch(() => []),
    ]);
    const E = Object.fromEntries((errores || []).map((x) => [x.id, x.error]));
    const S = Object.fromEntries((subidas || []).map((x) => [x.id, x]));
    return (todos || []).filter((p) => p.atletaId === atletaId).map((p) => ({ ...p, error: E[p.id] || null, urlSubida: S[p.id]?.url || null, progreso: S[p.id]?.progreso ?? null, forzado: S[p.id]?.forzado === true }))
      .sort((a, b) => (a.creado < b.creado ? -1 : 1));
  } catch { return []; }
}
export async function quitarPendiente(id) {
  await operar([ALMACEN, ERRORES, SUBIDAS], 'readwrite', (tx) => { tx.objectStore(ALMACEN).delete(id); tx.objectStore(ERRORES).delete(id); tx.objectStore(SUBIDAS).delete(id); });
  avisar();
}
// (v0.57) La dirección de su subida por trozos y lo que lleva subido (0…1): para seguir por ahí
// (v0.61, revisión L1) y si se ha pedido «Subir ahora» aunque no haya wifi (forzado: se queda con él hasta que sale)
export async function ponerSubida(id, { url = undefined, progreso = undefined, forzado = undefined } = {}) {
  if (!id) return;
  const antes = await operar([SUBIDAS], 'readonly', (tx) => tx.objectStore(SUBIDAS).get(id)).catch(() => null);
  await operar([SUBIDAS], 'readwrite', (tx) => tx.objectStore(SUBIDAS).put({ id, url: url !== undefined ? url : antes?.url || null, progreso: progreso !== undefined ? progreso : antes?.progreso ?? null,
    forzado: forzado !== undefined ? forzado === true : antes?.forzado === true }));
}
// ¿Se puede leer aún el vídeo guardado? (si el navegador lo ha perdido, hay que volver a elegirlo)
export async function sigueEnElMovil(p) {
  try { if (!p?.archivo || !(p.archivo.size > 0)) return false; await p.archivo.slice(0, 1).arrayBuffer(); return true; } catch { return false; }
}
// Al cerrar la sesión: nada de nadie se queda en el móvil (los vídeos sin enviar, tampoco)
export async function borrarPendientes() {
  try { await operar([ALMACEN, ERRORES, SUBIDAS], 'readwrite', (tx) => { tx.objectStore(ALMACEN).clear(); tx.objectStore(ERRORES).clear(); tx.objectStore(SUBIDAS).clear(); }); } catch { /* sin almacén: nada que borrar */ }
  avisar();
}
export const PERDIDO = 'El vídeo ya no está en este móvil: vuelve a elegirlo de la galería para enviarlo.';
export async function marcarPendiente(id, error) {
  await operar([ERRORES], 'readwrite', (tx) => (error ? tx.objectStore(ERRORES).put({ id, error }) : tx.objectStore(ERRORES).delete(id)));
  avisar();
}
// Un archivo guardado, listo para subirlo
export const archivoDe = (p) => new File([p.archivo], p.nombre, { type: p.mime || p.archivo.type || '' });

// Un envío a la vez por archivo, también entre pestañas (Web Locks; sin ellos, en esta pestaña): si ya se está
// enviando (la hoja de subir, la cola, otra pestaña), devuelve 'ocupado' sin esperar
const enCurso = new Set();
export async function conCerrojo(id, fn) {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(`fbe-pendiente-${id}`, { ifAvailable: true }, (cerrojo) => (cerrojo ? fn() : 'ocupado'));
  }
  if (enCurso.has(id)) return 'ocupado';
  enCurso.add(id);
  try { return await fn(); } finally { enCurso.delete(id); }
}
