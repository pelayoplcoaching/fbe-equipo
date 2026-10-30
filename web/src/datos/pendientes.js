// Vídeos y fotos que no se han podido enviar por falta de cobertura (v0.33): se guardan en el propio móvil
// (IndexedDB, que admite archivos grandes) y la app los envía sola cuando vuelve la conexión. Cada uno lleva su
// atleta (solo se envían con la cuenta de ese atleta abierta) y su ruta: reintentar es seguro (ver api.subirArchivo).
// El vídeo se guarda ANTES de empezar a subirlo: si el móvil cierra la app a medias, no se pierde.
const BASE = 'fbe-pendientes', ALMACEN = 'archivos', ERRORES = 'errores';
export const EVENTO_PENDIENTES = 'fbe-pendientes-archivos';

function abrir() {
  return new Promise((ok, mal) => {
    if (typeof indexedDB === 'undefined') { mal(new Error('Este navegador no puede guardar archivos en el móvil')); return; }
    const r = indexedDB.open(BASE, 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(ALMACEN)) r.result.createObjectStore(ALMACEN, { keyPath: 'id' });
      // El motivo de un envío rechazado va aparte: así no se reescribe el vídeo entero para apuntarlo
      if (!r.result.objectStoreNames.contains(ERRORES)) r.result.createObjectStore(ERRORES, { keyPath: 'id' });
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
    const [todos, errores] = await Promise.all([
      operar([ALMACEN], 'readonly', (tx) => tx.objectStore(ALMACEN).getAll()),
      operar([ERRORES], 'readonly', (tx) => tx.objectStore(ERRORES).getAll()),
    ]);
    const E = Object.fromEntries((errores || []).map((x) => [x.id, x.error]));
    return (todos || []).filter((p) => p.atletaId === atletaId).map((p) => ({ ...p, error: E[p.id] || null }))
      .sort((a, b) => (a.creado < b.creado ? -1 : 1));
  } catch { return []; }
}
export async function quitarPendiente(id) {
  await operar([ALMACEN, ERRORES], 'readwrite', (tx) => { tx.objectStore(ALMACEN).delete(id); tx.objectStore(ERRORES).delete(id); });
  avisar();
}
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
