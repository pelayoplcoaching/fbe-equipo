import { useEffect, useRef, useState } from 'preact/hooks';
import { Hoja, Icono, useApp } from './comunes.jsx';
import { TextoPrivacidad } from './Acceso.jsx';
import { debeAvisarPrivacidad, novedadesDesde } from '../logica/privacidad.js';

// (v0.56) Las novedades de la política, UNA vez por versión (Pelayo: «que lo pregunte una vez, no cada vez que se abre»).
// Cerrarla de cualquier forma (Entendido, Escape, fuera o la X) cuenta como vista, en todos sus móviles (va a la base).
// No pide aceptar nada: lo que necesita permiso (el micro) se pide al usarlo.
// (v0.65) alTerminar: cuando ya no hay aviso (no tocaba o se ha cerrado), para que la hoja de novedades salga después y nunca a la vez
export function AvisoPrivacidad({ alTerminar = null }) {
  const { api } = useApp();
  const [ver, setVer] = useState(false);
  const [vista, setVista] = useState(null);
  // (v0.59) La vigente para esta base: 2026-12.1 con la 037; sin ella, 2026-12 (api.versionLegal)
  const [actual, setActual] = useState(null);
  const [completa, setCompleta] = useState(false);
  const hecho = useRef(false);
  useEffect(() => {
    let vivo = true;
    Promise.all([api.privacidadVista(), api.versionLegal()]).then(([v, a]) => {
      if (!vivo) return;
      // (v0.65) sin conexión y sin saber qué vio (la base no contesta y en este móvil no hay nada), no se avisa: ya se sabrá
      const sinSaber = !v?.enBase && !v?.version && typeof navigator !== 'undefined' && navigator.onLine === false;
      if (!sinSaber && debeAvisarPrivacidad(v?.version, a)) { setActual(a); setVista(v?.version || null); setVer(true); } else alTerminar?.();
    }).catch(() => { if (vivo) alTerminar?.(); });
    return () => { vivo = false; };
  }, []);
  if (!ver) return null;
  const cerrar = () => {
    if (hecho.current) return;
    hecho.current = true;
    setVer(false);
    api.marcarPrivacidadVista(actual).catch(() => {});
    alTerminar?.();
  };
  return (
    <Hoja titulo="Novedades de privacidad" alCerrar={cerrar} clase="hoja-aviso-privacidad">
      <p class="secundario">Hemos actualizado la política de privacidad. En corto, lo nuevo:</p>
      <ul class="lista-novedades-privacidad">
        {novedadesDesde(vista, actual).map(([icono, titulo, texto]) => (
          <li key={titulo}><Icono n={icono} /><div><strong>{titulo}</strong><p class="peq secundario">{texto}</p></div></li>
        ))}
      </ul>
      {completa ? <TextoPrivacidad /> : (
        <button type="button" class="btn-texto" onClick={() => setCompleta(true)}>Leer la política completa</button>
      )}
      <button type="button" class="btn btn-primario btn-grande" onClick={cerrar}>Entendido</button>
    </Hoja>
  );
}
