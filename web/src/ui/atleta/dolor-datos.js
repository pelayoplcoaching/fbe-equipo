// (v0.257) Las lecturas de dolor de quien va por su cuenta (con la 109): lo que ha apuntado fuera del check-in y las de sus
// check-ins, de las últimas seis semanas. Lo usan «Me duele algo» (EsencialDolor.jsx) y el motor de molestias en la sesión
// y en Hoy (EsencialDolorSesion.jsx). Sin clases ni estilos: compartirlo no cambia a qué trozo van los estilos.
import { useApp, useCarga } from '../comunes.jsx';
import { hoyISO, sumarDias, lunesDe } from '../../logica/fechas.js';

export function useDolor(vuelta = 0) {
  const { backend, atleta } = useApp();
  return useCarga(async () => {
    const m = await import('../../datos/api-dolor.js');
    const hay = await m.hay109(backend).catch(() => false);
    if (!hay) return { m, hay };
    const hoy = hoyISO();
    const [registros, checkins] = await Promise.all([
      m.registros(backend, atleta.id, sumarDias(hoy, -42)).catch(() => []),
      m.molestiasCheckin(backend, atleta.id, sumarDias(lunesDe(hoy), -42)).catch(() => []),
    ]);
    return { m, hay, registros, checkins };
  }, [atleta.id, vuelta]);
}
