import { useEffect, useRef, useState } from 'preact/hooks';
import { Hoja, Icono } from './comunes.jsx';
import { NOVEDADES } from '../novedades.js';
import { novedadesQueVer, claveVersionVista, versionVistaInicial } from '../logica/novedades-app.js';
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
export function AvisoNovedades({ uid, rol = 'atleta' }) {
  const [lista] = useState(() => (uid ? novedadesQueVer(NOVEDADES, { vista: leer(claveVersionVista(uid)), actual: VERSION_APP, rol }) : []));
  const [ver, setVer] = useState(lista.length > 0);
  const hecho = useRef(false);
  // Sin nada que contar de esta versión (un arreglo, o nada para el coach), queda vista igualmente
  useEffect(() => { if (uid && !lista.length) guardar(claveVersionVista(uid), VERSION_APP); }, []);
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
        {lista.map((t) => <li key={t}><Icono n="hecho" /><span>{t}</span></li>)}
      </ul>
      <button type="button" class="btn btn-primario btn-grande" onClick={cerrar}>Vale</button>
    </Hoja>
  );
}
