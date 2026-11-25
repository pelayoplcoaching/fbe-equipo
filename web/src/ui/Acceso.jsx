import { useEffect, useState } from 'preact/hooks';
import { Cargando } from './comunes.jsx';
import { perezoso } from './perezoso.jsx';

// (alta, v0.239) Las pantallas de entrada (entrar, activar la cuenta, recuperar la contraseña, vincular el código y el
// segundo paso) van en su propio trozo, Entrada.jsx: quien ya tiene la sesión iniciada (casi siempre) no las descarga al
// abrir la app. Aquí se queda lo que usa el resto de la app: la política, el enlace de la invitación y si alguien ha
// entrado ya en este móvil.
const mientras = <div class="acceso"><Cargando /></div>;
export const Acceso = perezoso(() => import('./Entrada.jsx'), 'Acceso', { mientras });
export const Vincular = perezoso(() => import('./Entrada.jsx'), 'Vincular', { mientras });
export const NuevaPassword = perezoso(() => import('./Entrada.jsx'), 'NuevaPassword', { mientras });
export const SegundoPaso = perezoso(() => import('./Entrada.jsx'), 'SegundoPaso', { mientras });

// (alta, 1 y 2) El enlace de la invitación: «?codigo=FBE-…» (y «&plan=esencial» si es de FBE Esencial). Se lee una vez al
// abrir, se quita de la dirección (no se queda a la vista ni en el historial) y se recuerda en esta pestaña hasta usarlo.
const CLAVE_ENLACE = 'fbe-enlace-invitacion';
let enlaceLeido;
export function invitacionDelEnlace() {
  if (enlaceLeido !== undefined) return enlaceLeido;
  enlaceLeido = null;
  try {
    const u = new URL(location.href);
    const c = u.searchParams.get('codigo');
    if (c && /^[A-Za-z0-9 -]{6,24}$/.test(c.trim())) {
      enlaceLeido = { codigo: c.trim().toUpperCase(), esencial: u.searchParams.get('plan') === 'esencial' };
      try { sessionStorage.setItem(CLAVE_ENLACE, JSON.stringify(enlaceLeido)); } catch { /* sin almacenamiento: vale para esta vez */ }
      u.searchParams.delete('codigo'); u.searchParams.delete('plan');
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    } else enlaceLeido = JSON.parse(sessionStorage.getItem(CLAVE_ENLACE) || 'null');
  } catch { /* sin dirección ni almacenamiento: sin enlace */ }
  return enlaceLeido;
}
export function olvidarEnlace() { enlaceLeido = null; try { sessionStorage.removeItem(CLAVE_ENLACE); } catch { /* */ } }

// (alta, 19) ¿Ha entrado alguien alguna vez en este móvil? (lo apunta App al entrar). La primera vez, «Activa tu cuenta»
// sale arriba y bien visible; después, abajo, para quien ya tiene cuenta.
export const CLAVE_ALGUNA_VEZ = 'fbe-alguna-vez';

// (v0.208, rendimiento) El texto de la política (unos 50 KB) se carga al leerla, no al abrir la app
let privacidadCargada = null;
let pidiendoPrivacidad = null;
// (v0.209) Se puede pedir antes, al enseñar el enlace o el aviso que lleva a ella: así, al tocar, ya está
export function precargarPrivacidad() {
  if (privacidadCargada) return Promise.resolve(privacidadCargada);
  pidiendoPrivacidad ||= import('../legal.js').then((m) => (privacidadCargada = m.PRIVACIDAD)).catch((e) => { pidiendoPrivacidad = null; throw e; });
  return pidiendoPrivacidad;
}
export function TextoPrivacidad() {
  const [texto, setTexto] = useState(privacidadCargada);
  const [error, setError] = useState(false);
  const traer = () => { setError(false); precargarPrivacidad().then(setTexto, () => setError(true)); };
  useEffect(() => { if (!texto) traer(); }, []);
  if (error) {
    return (
      <div class="pila">
        <div class="error" role="alert">No se ha podido cargar la política. Comprueba la conexión y vuelve a intentarlo.</div>
        <button type="button" class="btn" onClick={traer}>Reintentar</button>
      </div>
    );
  }
  if (!texto) return <Cargando texto="Cargando la política de privacidad" />;
  return (
    <div class="pila">
      <div class="nota">Borrador pendiente de revisión: faltan los datos de contacto del responsable.</div>
      {texto.map(([t, d]) => <div class="pila-s" key={t}><strong>{t}</strong><p class="secundario">{d}</p></div>)}
    </div>
  );
}
