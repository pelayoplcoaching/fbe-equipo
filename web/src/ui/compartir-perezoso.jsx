// (v0.207, rendimiento) La hoja de compartir (la tarjeta, sus plantillas y fondos: más de 40 KB) en su propio trozo: se
// carga al abrirla, o antes por detrás con la app quieta. Lo que está en Hoy (o lo que sale de Hoy) la pide de aquí, así
// no entra en el arranque; las pantallas que ya se cargan al abrirlas pueden seguir usando la de Compartir.jsx.
import { perezoso } from './perezoso.jsx';

export const HojaCompartir = perezoso(() => import('./Compartir.jsx'), 'HojaCompartir', { mientras: null });
