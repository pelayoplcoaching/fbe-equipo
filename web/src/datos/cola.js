// Cola de escrituras sin conexión: si el gimnasio no tiene cobertura, las series se guardan en el móvil
// y se envían en orden al recuperarla. Los upserts por (sesión-ejercicio, número) hacen que reenviar sea seguro.
//  · Todo pasa por una sola cadena: una corrección y un borrado de la misma serie nunca llegan desordenados.
//  · Cada operación lleva su atleta: solo se envían con la sesión de ese atleta abierta (si en el móvil entra
//    otra persona, lo de la primera espera a que vuelva).
//  · Si el servidor rechaza algo (no por falta de conexión ni de sesión), no se pierde en silencio: se guarda
//    aparte y se avisa con alRechazo.

function leer(clave) {
  try { return JSON.parse(localStorage.getItem(clave) || '[]'); } catch { return []; }
}
function guardar(clave, ops) {
  try { localStorage.setItem(clave, JSON.stringify(ops)); } catch { /* sin almacenamiento */ }
}

// Errores que no son culpa de la operación: sin conexión, o la sesión ha caducado o no hay sesión
const esTemporal = (e) => !!e?.sinConexion || e?.status === 401 || /jwt|not authenticated|refresh token|sesi\u00f3n ha caducado/i.test(e?.message || '');

export function crearCola(api, { clave = 'fbe-cola-v1', claveRechazos = 'fbe-cola-rechazadas-v1' } = {}) {
  let ops = leer(clave);
  const oyentes = new Set();
  const oyentesRechazo = new Set();
  let atleta = null;          // el atleta con la sesión abierta (null = nadie: no se envía nada)
  let vaciando = false;
  let reintento = null;
  let cadena = Promise.resolve();

  const mias = () => ops.filter((o) => o.atletaId === atleta);
  const avisar = () => { guardar(clave, ops); const n = mias().length; oyentes.forEach((f) => f(n)); };

  async function ejecutar(op) {
    if (op.tipo === 'serie') return api.guardarSerie(op.datos, op.atletaId);
    if (op.tipo === 'borrarSerie') return api.borrarSerie(op.datos.sesion_ejercicio_id, op.datos.numero);
    if (op.tipo === 'sesion') return api.marcarSesion(op.datos.id, op.datos.cambios);
    throw new Error('Operación desconocida');
  }

  function programarReintento() {
    clearTimeout(reintento);
    if (mias().length) reintento = setTimeout(() => { encadenar(vaciarYa); }, 20000);
  }

  function rechazar(op, e) {
    const lista = leer(claveRechazos);
    lista.push({ ...op, error: e?.message || String(e), rechazada_en: new Date().toISOString() });
    guardar(claveRechazos, lista.slice(-50));
    console.warn('Operación rechazada por el servidor:', e?.message, op);
    oyentesRechazo.forEach((f) => f(op, e));
  }

  // Envía lo pendiente de este atleta, en orden; se para (sin perder nada) si falta conexión o sesión
  async function vaciarYa() {
    if (vaciando || !atleta) return;
    vaciando = true;
    try {
      for (;;) {
        const op = ops.find((o) => o.atletaId === atleta);
        if (!op) break;
        try {
          await ejecutar(op);
        } catch (e) {
          if (esTemporal(e)) break;
          rechazar(op, e);
        }
        ops = ops.filter((o) => o !== op);
        avisar();
      }
    } finally {
      vaciando = false;
      programarReintento();
    }
  }

  function encadenar(fn) {
    const p = cadena.then(fn);
    cadena = p.catch(() => {});
    return p;
  }

  async function enviarYa(op) {
    if (op.atletaId !== atleta) throw new Error('No hay ninguna sesión de atleta abierta');
    if (mias().length) {
      ops.push(op); avisar();
      await vaciarYa();
      return { enCola: ops.includes(op) };
    }
    try {
      const r = await ejecutar(op);
      return { enCola: false, r };
    } catch (e) {
      if (!esTemporal(e)) throw e;
      ops.push(op);
      avisar();
      programarReintento();
      return { enCola: true };
    }
  }

  if (typeof window !== 'undefined') window.addEventListener('online', () => encadenar(vaciarYa));

  return {
    pendientes: () => mias().length,
    alCambiar(f) { oyentes.add(f); return () => oyentes.delete(f); },
    alRechazo(f) { oyentesRechazo.add(f); return () => oyentesRechazo.delete(f); },
    rechazadas: () => leer(claveRechazos),
    // La app dice quién tiene la sesión abierta (o null al salir); al entrar se envía lo que tuviera pendiente
    fijarAtleta(id) {
      atleta = id || null;
      avisar();
      if (atleta) encadenar(vaciarYa);
      else clearTimeout(reintento);
    },
    vaciar: () => encadenar(vaciarYa),
    // Ejecuta ya si se puede; si no hay conexión, encola. Devuelve { enCola }.
    enviar: (op) => encadenar(() => enviarYa(op)),
  };
}
