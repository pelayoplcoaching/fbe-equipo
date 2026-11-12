import { useState } from 'preact/hooks';
import { useApp, IcoIos } from '../comunes.jsx';
import { perezoso } from '../perezoso.jsx';
import { hoyISO } from '../../logica/fechas.js';
import { resumenApuntes, textoApuntes } from '../../logica/apuntes.js';
import { leerApuntes } from '../apuntes.js';

// «Apuntes»: su pantalla (y la lectura de las guías que necesita) solo se pide al abrirla
export const Apuntes = perezoso(() => import('./Apuntes.jsx'), 'Apuntes', { mientras: null });

// La tarjeta de los apuntes fuera de la sesión. En Hoy, «El apunte de hoy» (una línea); en Semana, lo que lleva vistos
// y «Repasar» (los que no sabía y los de esta semana). Lo que enseña sale de lo guardado en el móvil.
export function TarjetaApuntes({ repaso = false }) {
  const { atleta } = useApp() || {};
  const [abierta, setAbierta] = useState(false);
  const [r, setR] = useState(() => (atleta?.id ? resumenApuntes(leerApuntes(atleta.id), hoyISO()) : null));
  if (!atleta?.id || !r) return null;
  const cerrar = () => { setAbierta(false); setR(resumenApuntes(leerApuntes(atleta.id), hoyISO())); };
  const nada = repaso && !r.vistos;
  return (
    <section class={`apuntes-tarjeta panel${repaso ? ' repaso' : ''}`} aria-label={repaso ? 'Tus apuntes' : 'El apunte de hoy'}>
      <IcoIos n="biblioteca" />
      <div class="apuntes-tarjeta-texto">
        <strong>{repaso ? 'Tus apuntes' : 'El apunte de hoy'}</strong>
        <span class="peq secundario">{repaso
          ? (nada ? 'Lo que aprendes en los descansos, para repasarlo' : `${textoApuntes(r.semana)} esta semana · ${r.vistos} en total${r.repasar ? ` · ${r.repasar} por repasar` : ''}`)
          : 'Medio minuto para aprender algo'}</span>
      </div>
      <button type="button" class="btn btn-peq" disabled={nada} onClick={() => setAbierta(true)}>{repaso ? 'Repasar' : 'Leer'}</button>
      {abierta && <Apuntes atletaId={atleta.id} modo={repaso ? 'repaso' : 'dia'} alCerrar={cerrar} />}
    </section>
  );
}
