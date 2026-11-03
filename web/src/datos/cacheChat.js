// La copia del chat en el móvil (v0.56): al abrir una conversación salen al momento (también sin cobertura) los últimos
// mensajes que ya se vieron; después llega la base y manda ella. Solo textos y datos de los mensajes (quién, cuándo, los
// ✓, de qué foto o PDF es), nunca las fotos, los vídeos, los PDF ni sus enlaces firmados. Por cuenta (lo de otra
// persona en el mismo móvil no se ve) y se borra entera al cerrar la sesión o cuando caduca.
export const MAX_CACHE = 200;
const BASE = 'fbe-chat-v1';
const ALMACEN = 'conversaciones';
// Lo que se guarda de cada mensaje (lo demás, fuera)
const CAMPOS = ['id', 'atleta_id', 'autor', 'texto', 'creado_en', 'leido_en', 'entregado_en', 'escuchado_en', 'editado_en', 'eliminado_en', 'enviar_en', 'responde_a',
  'sesion_id', 'checkin_id', 'archivo_id', 'archivoId', 'adjunto', 'cliente_id', 'reenviado', 'programado', 'medio', 'reacciones', 'destacado', 'contexto', 'encuesta'];
const CAMPOS_ARCHIVO = ['id', 'atleta_id', 'tipo', 'ruta', 'mime', 'bytes', 'poster_ruta', 'duracion_seg', 'nombre', 'paginas', 'onda', 'subido_por'];
const elegir = (x, campos) => Object.fromEntries(campos.filter((k) => x[k] !== undefined).map((k) => [k, x[k]]));
// Los últimos MAX_CACHE (sin lo que aún está saliendo: eso lo guarda la bandeja de salida)
export function paraCache(mensajes = [], max = MAX_CACHE) {
  return mensajes.filter((c) => c && c.id && !c.pendiente && !c.fallo && !String(c.id).startsWith('pendiente-')).slice(-max)
    .map((c) => ({ ...elegir(c, CAMPOS), archivo: c.archivo ? elegir(c.archivo, CAMPOS_ARCHIVO) : null }));
}
export const claveCache = (perfil, atleta) => `${perfil}:${atleta}`;

// (revisión) Lo guardado caduca a los 30 días de la última vez que se abrió esa conversación
export const CADUCA_DIAS = 30;
const DIA = 86400000;
export const caducada = (x, ahora = Date.now()) => !x?.guardado_en || !(ahora - Date.parse(x.guardado_en) < CADUCA_DIAS * DIA);

// (revisión) Cerrada: al salir se cierra AL MOMENTO (sin esperar a nada), así un guardado que llega tarde no vuelve a crear
// la base con lo de la sesión anterior. Se reabre al entrar.
let cerrada = false;
let epoca = 0;
export const cacheCerrada = () => cerrada;

// El almacén de IndexedDB (o nada, si el navegador no deja: entonces el chat abre como siempre, esperando a la base)
function almacenIdb() {
  let db = null;
  const abrir = () => {
    if (cerrada) return Promise.reject(new Error('cerrada'));
    if (db) return db;
    db = new Promise((ok, mal) => {
      try {
        const r = indexedDB.open(BASE, 1);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(ALMACEN)) r.result.createObjectStore(ALMACEN); };
        r.onsuccess = () => {
          const d = r.result;
          // (revisión) otra pestaña la borra o la cambia de versión: se suelta para no bloquearla
          d.onversionchange = () => { try { d.close(); } catch { /* */ } db = null; };
          if (cerrada) { try { d.close(); } catch { /* */ } mal(new Error('cerrada')); return; }
          ok(d);
        };
        r.onerror = () => mal(r.error);
        r.onblocked = () => mal(new Error('bloqueada'));
      } catch (e) { mal(e); }
    });
    db.catch(() => { db = null; });
    return db;
  };
  const tx = async (modo, f) => {
    const e = epoca;
    const d = await abrir();
    // (por si se ha salido mientras se abría)
    if (cerrada || e !== epoca) throw new Error('cerrada');
    return new Promise((ok, mal) => {
      const t = d.transaction(ALMACEN, modo);
      const r = f(t.objectStore(ALMACEN));
      t.oncomplete = () => ok(r?.result);
      t.onerror = () => mal(t.error);
      t.onabort = () => mal(t.error);
    });
  };
  return {
    leer: (k) => tx('readonly', (s) => s.get(k)),
    guardar: (k, v) => tx('readwrite', (s) => s.put(v, k)),
    borrar: (k) => tx('readwrite', (s) => s.delete(k)),
    // [[clave, valor]] de todo lo guardado (para la limpieza)
    todo: () => tx('readonly', (s) => {
      const out = [];
      const c = s.openCursor();
      c.onsuccess = () => { const x = c.result; if (x) { out.push([x.key, x.value]); x.continue(); } };
      return { get result() { return out; } };
    }),
    async borrarTodo() {
      try { const d = await db; d?.close?.(); } catch { /* */ }
      db = null;
      await new Promise((ok) => { try { const r = indexedDB.deleteDatabase(BASE); r.onsuccess = r.onerror = r.onblocked = () => ok(); } catch { ok(); } });
    },
  };
}
const hayIdb = () => { try { return typeof indexedDB !== 'undefined' && !!indexedDB; } catch { return false; } };

// almacen: { leer(clave), guardar(clave, valor), borrar(clave), todo(), borrarTodo() } (en las pruebas, uno en memoria)
// estaCerrada: en la app, la marca de arriba (en las pruebas, la que se quiera)
export function crearCacheChat({ almacen = hayIdb() ? almacenIdb() : null, max = MAX_CACHE, estaCerrada = () => cerrada, ahora = () => Date.now() } = {}) {
  const quitar = async (k) => { try { await almacen.borrar?.(k); } catch { /* */ } };
  return {
    async leer(perfil, atleta) {
      if (!almacen || !perfil || !atleta || estaCerrada()) return null;
      try {
        const x = await almacen.leer(claveCache(perfil, atleta));
        if (!(x && x.perfil === perfil && Array.isArray(x.mensajes))) return null;
        if (caducada(x, ahora())) { await quitar(claveCache(perfil, atleta)); return null; }
        return x;
      } catch { return null; }
    },
    async guardar(perfil, atleta, mensajes) {
      if (!almacen || !perfil || !atleta || estaCerrada()) return false;
      try { await almacen.guardar(claveCache(perfil, atleta), { perfil, atleta, guardado_en: new Date(ahora()).toISOString(), mensajes: paraCache(mensajes, max) }); return true; } catch { return false; }
    },
    // (revisión) Limpieza: fuera lo caducado y, en el móvil del coach, las conversaciones de quien ya no está (borrado o
    // de baja). conservar: los ids de atleta que siguen (null = no mirar eso). Devuelve cuántas quita.
    async purgar(perfil, { conservar = null } = {}) {
      if (!almacen?.todo || estaCerrada()) return 0;
      let n = 0;
      try {
        const sigue = conservar ? new Set(conservar) : null;
        for (const [k, x] of await almacen.todo()) {
          const fuera = caducada(x, ahora()) || (sigue && perfil && x?.perfil === perfil && !sigue.has(x.atleta));
          if (fuera) { await quitar(k); n += 1; }
        }
      } catch { /* */ }
      return n;
    },
    async quitarAtleta(perfil, atleta) { if (almacen && perfil && atleta) await quitar(claveCache(perfil, atleta)); },
    async borrarTodo() { try { await almacen?.borrarTodo(); } catch { /* */ } },
  };
}
let unica = null;
export const cacheChat = () => (unica ||= crearCacheChat());
// Al cerrar la sesión (o caducar): fuera todo, aunque no se haya abierto ningún chat. La marca se pone ya (síncrona).
export async function borrarCacheChat() {
  cerrada = true;
  epoca += 1;
  if (unica) { await unica.borrarTodo(); return; }
  if (hayIdb()) await almacenIdb().borrarTodo();
}
// Al entrar con una cuenta
export function reabrirCacheChat() { cerrada = false; }
