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

// El almacén de IndexedDB (o nada, si el navegador no deja: entonces el chat abre como siempre, esperando a la base)
function almacenIdb() {
  let db = null;
  const abrir = () => {
    if (db) return db;
    db = new Promise((ok, mal) => {
      try {
        const r = indexedDB.open(BASE, 1);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(ALMACEN)) r.result.createObjectStore(ALMACEN); };
        r.onsuccess = () => ok(r.result);
        r.onerror = () => mal(r.error);
        r.onblocked = () => mal(new Error('bloqueada'));
      } catch (e) { mal(e); }
    });
    db.catch(() => { db = null; });
    return db;
  };
  const tx = async (modo, f) => {
    const d = await abrir();
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
    async borrarTodo() {
      try { const d = await db; d?.close?.(); } catch { /* */ }
      db = null;
      await new Promise((ok) => { try { const r = indexedDB.deleteDatabase(BASE); r.onsuccess = r.onerror = r.onblocked = () => ok(); } catch { ok(); } });
    },
  };
}
const hayIdb = () => { try { return typeof indexedDB !== 'undefined' && !!indexedDB; } catch { return false; } };

// almacen: { leer(clave), guardar(clave, valor), borrarTodo() } (en las pruebas, uno en memoria)
export function crearCacheChat({ almacen = hayIdb() ? almacenIdb() : null, max = MAX_CACHE } = {}) {
  return {
    async leer(perfil, atleta) {
      if (!almacen || !perfil || !atleta) return null;
      try {
        const x = await almacen.leer(claveCache(perfil, atleta));
        return x && x.perfil === perfil && Array.isArray(x.mensajes) ? x : null;
      } catch { return null; }
    },
    async guardar(perfil, atleta, mensajes) {
      if (!almacen || !perfil || !atleta) return false;
      try { await almacen.guardar(claveCache(perfil, atleta), { perfil, atleta, guardado_en: new Date().toISOString(), mensajes: paraCache(mensajes, max) }); return true; } catch { return false; }
    },
    async borrarTodo() { try { await almacen?.borrarTodo(); } catch { /* */ } },
  };
}
let unica = null;
export const cacheChat = () => (unica ||= crearCacheChat());
// Al cerrar la sesión (o caducar): fuera todo, aunque no se haya abierto ningún chat
export async function borrarCacheChat() {
  if (unica) { await unica.borrarTodo(); return; }
  if (hayIdb()) await almacenIdb().borrarTodo();
}
