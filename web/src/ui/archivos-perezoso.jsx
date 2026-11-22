// (v0.207, rendimiento) Ver y subir archivos (y la captura de la portada de un vídeo) en su propio trozo: Hoy, las tareas,
// lo compartido y las subidas pendientes los piden de aquí, así Archivos.jsx (con el recorte y la valoración del vídeo)
// no entra en el arranque. Se carga al usarlos (los dos componentes salen en hojas que se abren al tocar algo).
import { perezoso } from './perezoso.jsx';

export const VerArchivo = perezoso(() => import('./Archivos.jsx'), 'VerArchivo', { mientras: null });
export const SubirArchivo = perezoso(() => import('./Archivos.jsx'), 'SubirArchivo', { mientras: null });
export const capturarPoster = async (...a) => (await import('./Archivos.jsx')).capturarPoster(...a);
