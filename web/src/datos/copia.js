// La copia de tu semana en el móvil (v0.65): para que Hoy y la sesión abran al momento también sin cobertura. Lo que la
// app ya pide a la base para enseñártelo (tu perfil y tu ficha, tus consentimientos, el programa, las sesiones de esta
// semana con sus ejercicios, «ant.» y las notas, tus marcas y los «Recuerda» de tu coach) se guarda tal cual al llegar, por
// cuenta. Va en la misma base del navegador que la copia del chat (cacheChat.js): se borra entera con ella al cerrar la
// sesión, y lo que lleva más de CADUCA_COPIA_DIAS sin ponerse al día, al abrir la app.
import { almacenIdb, hayIdb, cacheCerrada, ALMACEN_COPIA } from './cacheChat.js';
import { copiaVale, clavesAPodar } from '../logica/sin-red.js';

const claveDe = (uid, clave) => `${uid}|${clave}`;

// almacen: { leer, guardar, borrar, todo } (en las pruebas, uno en memoria)
export function crearCopia({ almacen = hayIdb() ? almacenIdb(ALMACEN_COPIA) : null, ahora = () => Date.now(), estaCerrada = cacheCerrada } = {}) {
  return {
    // { datos, t } o null
    async leer(uid, clave) {
      if (!almacen || !uid || estaCerrada()) return null;
      try {
        const x = await almacen.leer(claveDe(uid, clave));
        return copiaVale(x, uid, ahora()) && x.clave === clave ? { datos: x.datos, t: x.t } : null;
      } catch { return null; }
    },
    async guardar(uid, clave, datos) {
      if (!almacen || !uid || estaCerrada() || datos === undefined) return false;
      try { await almacen.guardar(claveDe(uid, clave), { uid, clave, t: ahora(), datos }); return true; } catch { return false; }
    },
    // Fuera lo caducado y las sesiones de más (al abrir la app)
    async podar() {
      if (!almacen?.todo || estaCerrada()) return 0;
      try {
        const fuera = clavesAPodar(await almacen.todo(), ahora());
        for (const k of fuera) await almacen.borrar(k).catch(() => {});
        return fuera.length;
      } catch { return 0; }
    },
  };
}
let unica = null;
export const copia = () => (unica ||= crearCopia());
