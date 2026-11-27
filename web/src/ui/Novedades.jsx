import { useEffect, useRef, useState } from 'preact/hooks';
import { Hoja, Icono, IcoIos } from './comunes.jsx';
import { novedadesQueVer, claveVersionVista, versionVistaInicial, dondeNovedad } from '../logica/novedades-app.js';
import { clavePrivacidadLocal } from '../logica/privacidad.js';

/* global __APP_VERSION__ */
const VERSION_APP = typeof __APP_VERSION__ !== 'undefined' ? String(__APP_VERSION__) : '0.0.0';
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: no sale más en esta visita */ } };

// (v0.65) Al entrar con una cuenta: si este móvil aún no sabe qué versión vio esa cuenta, lo apunta ya (antes de que el aviso de
// privacidad cambie la política vista, que es de donde se deduce para quien ya usaba la app). La primera vez, la actual: no sale.
export function prepararVersionVista(uid) {
  if (!uid || leer(claveVersionVista(uid))) return;
  guardar(claveVersionVista(uid), versionVistaInicial({ politicaVista: leer(clavePrivacidadLocal(uid)), actual: VERSION_APP }));
}

// La hoja «Novedades», una vez por versión (cerrarla de cualquier forma cuenta como vista, en este móvil)
// (v0.207, rendimiento) La lista de novedades (novedades.js, unos 55 KB) solo se pide si esta versión aún no se ha visto en
// este móvil: casi siempre ni se carga
export function AvisoNovedades({ uid, rol = 'atleta' }) {
  const [lista, setLista] = useState([]);
  const [ver, setVer] = useState(false);
  const hecho = useRef(false);
  useEffect(() => {
    if (!uid) return undefined;
    const vista = leer(claveVersionVista(uid));
    if (vista === VERSION_APP) return undefined;
    let vivo = true;
    import('../novedades.js').then(({ NOVEDADES }) => {
      if (!vivo) return;
      const l = novedadesQueVer(NOVEDADES, { vista, actual: VERSION_APP, rol });
      // Sin nada que contar de esta versión (un arreglo, o nada para el coach), queda vista igualmente
      if (!l.length) { guardar(claveVersionVista(uid), VERSION_APP); return; }
      setLista(l);
      setVer(true);
    }).catch(() => { /* sin la lista (sin conexión y sin guardar): ya saldrá la próxima vez */ });
    return () => { vivo = false; };
  }, []);
  if (!ver) return null;
  const cerrar = () => {
    if (hecho.current) return;
    hecho.current = true;
    guardar(claveVersionVista(uid), VERSION_APP);
    setVer(false);
  };
  return (
    <Hoja titulo="Novedades" alCerrar={cerrar} clase="hoja-novedades">
      <ul class="lista-novedades-app">
        {/* (belleza 341) cada frase, con el icono y el nombre del sitio donde está lo nuevo (si se sabe) */}
        {lista.map((t) => {
          const d = dondeNovedad(t);
          return d ? (
            <li key={t} style="grid-template-columns:auto 1fr"><IcoIos n={d[0]} /><span class="pila-xs"><span>{t}</span><span class="mini terciario">{d[1]}</span></span></li>
          ) : <li key={t}><Icono n="hecho" /><span>{t}</span></li>;
        })}
      </ul>
      <button type="button" class="btn btn-primario btn-grande" onClick={cerrar}>Vale</button>
    </Hoja>
  );
}
