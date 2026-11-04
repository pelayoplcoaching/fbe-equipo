// v0.61 (20): «Subir los vídeos solo con wifi» y el ahorro de datos. Lo que dice el navegador de la conexión (la Network
// Information API: navigator.connection.type solo existe en Chrome de Android y ChromeOS; en el iPhone y en el ordenador no
// se sabe si es wifi o datos móviles) y si un vídeo espera o se sube. Sin pantalla, para poder probarlo.

// Los tipos que gastan datos del móvil (bluetooth suele ser compartir los datos del móvil; wimax, una red móvil)
const DATOS_MOVILES = ['cellular', 'wimax', 'bluetooth'];
const SIN_DATOS = ['wifi', 'ethernet'];

// { tipo, conocida, celular, wifi, ahorro, enLinea } de navigator (o de uno de prueba)
export function leerRed(nav = typeof navigator !== 'undefined' ? navigator : null) {
  const c = nav?.connection || nav?.mozConnection || nav?.webkitConnection || null;
  const tipo = typeof c?.type === 'string' && c.type ? c.type : null;
  return {
    tipo,
    conocida: !!tipo && tipo !== 'unknown',
    celular: !!tipo && DATOS_MOVILES.includes(tipo),
    wifi: !!tipo && SIN_DATOS.includes(tipo),
    ahorro: c?.saveData === true,
    enLinea: nav ? nav.onLine !== false : true,
  };
}
// ¿Sale la opción? Solo donde el navegador dice el tipo de conexión (Chrome de Android): en el iPhone y en el ordenador no
// funcionaría (no se sabe si es wifi), así que no se enseña.
export const mostrarOpcionWifi = (red) => !!red && red.tipo != null;
// ¿Espera este envío? null (se sube) | 'wifi' (solo con wifi y está con datos móviles) | 'ahorro' (el móvil tiene el
// ahorro de datos y no consta que sea wifi). forzado: «Subir ahora» lo sube igual.
export function motivoEspera({ soloWifi = false, red = null, forzado = false } = {}) {
  if (forzado || !red) return null;
  if (red.wifi) return null;
  if (soloWifi && red.celular) return 'wifi';
  if (red.ahorro) return 'ahorro';
  return null;
}
export const TEXTO_ESPERA = {
  wifi: 'Esperando wifi: se enviará solo al conectarte a una red wifi.',
  ahorro: 'Esperando: tu móvil tiene activado el ahorro de datos. Se enviará solo con wifi (o cuando lo quites).',
};
export const ETIQUETA_ESPERA = { wifi: 'Esperando wifi', ahorro: 'Ahorro de datos' };
