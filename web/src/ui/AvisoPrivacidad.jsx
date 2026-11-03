import { useEffect, useRef, useState } from 'preact/hooks';
import { Hoja, Icono, useApp } from './comunes.jsx';
import { TextoPrivacidad } from './Acceso.jsx';
import { VERSION_LEGAL } from '../legal.js';
import { debeAvisarPrivacidad, NOVEDADES_PRIVACIDAD } from '../logica/privacidad.js';

// (v0.56) Las novedades de la política, UNA vez por versión (Pelayo: «que lo pregunte una vez, no cada vez que se abre»).
// Cerrarla de cualquier forma (Entendido, Escape, fuera o la X) cuenta como vista, en todos sus móviles (va a la base).
// No pide aceptar nada: lo que necesita permiso (el micro) se pide al usarlo.
export function AvisoPrivacidad() {
  const { api } = useApp();
  const [ver, setVer] = useState(false);
  const [completa, setCompleta] = useState(false);
  const hecho = useRef(false);
  useEffect(() => {
    let vivo = true;
    api.privacidadVista().then((v) => { if (vivo && debeAvisarPrivacidad(v?.version, VERSION_LEGAL)) setVer(true); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  if (!ver) return null;
  const cerrar = () => {
    if (hecho.current) return;
    hecho.current = true;
    setVer(false);
    api.marcarPrivacidadVista(VERSION_LEGAL).catch(() => {});
  };
  return (
    <Hoja titulo="Novedades de privacidad" alCerrar={cerrar} clase="hoja-aviso-privacidad">
      <p class="secundario">Hemos actualizado la política de privacidad por lo nuevo del chat. En corto:</p>
      <ul class="lista-novedades-privacidad">
        {NOVEDADES_PRIVACIDAD.map(([icono, titulo, texto]) => (
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
