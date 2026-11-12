import { useEffect, useState } from 'preact/hooks';
import { useApp, useCarga, IcoIos } from '../comunes.jsx';
import { perezoso } from '../perezoso.jsx';
import { hoyISO } from '../../logica/fechas.js';
import { resumenApuntes, textoApuntes, apuntesDeNovedades, novedadPendiente } from '../../logica/apuntes.js';
import { leerApuntes, sincronizarApuntes } from '../apuntes.js';

// «Apuntes»: su pantalla (y la lectura de las guías que necesita) solo se pide al abrirla
export const Apuntes = perezoso(() => import('./Apuntes.jsx'), 'Apuntes', { mientras: null });

// La tarjeta de los apuntes fuera de la sesión. En Hoy, «El apunte de hoy» (una línea); en Semana, lo que lleva vistos
// y «Repasar» (los que no sabía y los de esta semana). Lo que enseña sale de lo guardado en el móvil.
export function TarjetaApuntes({ repaso = false }) {
  const { atleta, api } = useApp() || {};
  const [abierta, setAbierta] = useState(false);
  const [r, setR] = useState(() => (atleta?.id ? resumenApuntes(leerApuntes(atleta.id), hoyISO()) : null));
  // (060) lo visto en otros móviles y, en Hoy, si hay una novedad de la semana que aún no ha leído
  const [vez, setVez] = useState(0);
  useEffect(() => {
    if (!atleta?.id) return undefined;
    let vivo = true;
    sincronizarApuntes(api, atleta.id).then((e) => { if (vivo) { setR(resumenApuntes(e, hoyISO())); setVez((n) => n + 1); } });
    return () => { vivo = false; };
  }, [atleta?.id]);
  const novedades = useCarga(() => (!repaso && atleta?.id && api?.novedades ? api.novedades().catch(() => []) : Promise.resolve([])), [atleta?.id, repaso], { recuerdo: !repaso && atleta?.id ? 'apuntes-novedades' : null });
  const novedad = !repaso && atleta?.id && vez >= 0 ? novedadPendiente(apuntesDeNovedades(novedades.datos || []), leerApuntes(atleta.id), hoyISO(), 7) : null;
  if (!atleta?.id || !r) return null;
  const cerrar = () => { setAbierta(false); setR(resumenApuntes(leerApuntes(atleta.id), hoyISO())); setVez((n) => n + 1); };
  const nada = repaso && !r.vistos;
  return (
    <section class={`apuntes-tarjeta panel${repaso ? ' repaso' : ''}${novedad ? ' con-novedad' : ''}`} aria-label={repaso ? 'Tus apuntes' : 'El apunte de hoy'}>
      <IcoIos n="biblioteca" />
      <div class="apuntes-tarjeta-texto">
        <strong>{repaso ? 'Tus apuntes' : novedad ? 'Novedad de la semana' : 'El apunte de hoy'}</strong>
        <span class="peq secundario">{repaso
          ? (nada ? 'Lo que aprendes en los descansos, para repasarlo' : `${textoApuntes(r.semana)} esta semana · ${r.vistos} en total${r.repasar ? ` · ${r.repasar} por repasar` : ''}`)
          : novedad ? novedad.titulo : 'Medio minuto para aprender algo'}</span>
      </div>
      <button type="button" class="btn btn-peq" disabled={nada} onClick={() => setAbierta(true)}>{repaso ? 'Repasar' : 'Leer'}</button>
      {abierta && <Apuntes atletaId={atleta.id} modo={repaso ? 'repaso' : 'dia'} alCerrar={cerrar} />}
    </section>
  );
}
