// (pulido 2.10) Pantallas que se cargan al abrirlas. Lo que no hace falta para arrancar (la pestaña Equipo, el
// check-in de la semana) va en su propio trozo: no se descarga ni se procesa al abrir la app, sino al entrar en esa
// pantalla o, antes, en cuanto la app se queda quieta (precargarEnReposo), para que al tocarla ya esté. El service
// worker guarda esos trozos con lo demás, así que también abren sin conexión.
//   const Equipo = perezoso(() => import('./Comunidad.jsx'), 'Equipo');
//   <Equipo …/>   ·   Equipo.precargar()
import { useEffect, useState } from 'preact/hooks';
import { Siluetas } from './comunes.jsx';

// cargar: () => import(…); nombre: lo que exporta el módulo; mientras: lo que se pinta mientras llega (de serie, unas
// siluetas de pantalla; null para una hoja o algo que sale encima de otra cosa)
export function perezoso(cargar, nombre, { mientras } = {}) {
  let Cargado = null;
  let pidiendo = null;
  const pedir = () => {
    pidiendo ||= cargar().then((m) => { Cargado = m[nombre]; return Cargado; }).catch((e) => { pidiendo = null; throw e; });
    return pidiendo;
  };
  function Perezoso(props) {
    const [C, setC] = useState(() => Cargado);
    const [error, setError] = useState(null);
    const traer = () => { setError(null); pedir().then((x) => setC(() => x)).catch(setError); };
    useEffect(() => { if (!C) traer(); }, []);
    if (C) return <C {...props} />;
    if (mientras === null) return null;
    if (error) {
      return (
        <div class="contenido"><div class="pila">
          <div class="error" role="alert">No se ha podido cargar esta pantalla. Comprueba la conexión y vuelve a intentarlo.</div>
          <button class="btn" onClick={traer}>Reintentar</button>
        </div></div>
      );
    }
    return mientras === undefined ? <div class="contenido"><Siluetas forma="lista" n={4} texto="Cargando" /></div> : mientras;
  }
  Perezoso.precargar = () => pedir().then(() => true, () => false);
  return Perezoso;
}

// Pide por detrás, una a una y sin prisa, las pantallas perezosas (o cualquier función que devuelva una promesa),
// cuando la app lleva un momento quieta. Devuelve cómo cancelarlo.
export function precargarEnReposo(lista, { espera = 2500 } = {}) {
  if (typeof window === 'undefined') return () => {};
  let vivo = true;
  const reposo = (fn) => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 300));
  const t = setTimeout(async () => {
    for (const x of lista) {
      if (!vivo) return;
      await new Promise((ok) => { reposo(ok); });
      if (!vivo) return;
      try { await (x.precargar ? x.precargar() : x()); } catch { /* ya se pedirá al abrirla */ }
    }
  }, espera);
  return () => { vivo = false; clearTimeout(t); };
}
