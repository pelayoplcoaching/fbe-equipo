// (personalización 2) Cómo le hablamos al atleta de esta cuenta: su nombre (o apodo), su género y su tono, con lo que
// ha elegido en «Lo tuyo» (api.personal, que se recuerda un minuto). Sin nada elegido (o sin la 050), su nombre de pila,
// sin marcar el género y en el tono de siempre.
import { useApp, useCarga } from './comunes.jsx';
import { tratoDe } from '../logica/trato.js';

export function useTrato() {
  const { api, atleta, perfil } = useApp() || {};
  const conAtleta = !!atleta?.id && perfil?.rol !== 'coach' && !!api?.personal;
  const p = useCarga(() => (conAtleta ? api.personal().catch(() => null) : Promise.resolve(null)), [atleta?.id, conAtleta], { recuerdo: conAtleta ? `trato:${atleta.id}` : null });
  return { ...tratoDe(p.datos || null, atleta?.nombre || ''), personal: p.datos || null };
}
