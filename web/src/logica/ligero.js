// (v0.209, rendimiento) Modo ligero: con el móvil lento, fuera lo decorativo que más cuesta (el cristal esmerilado, el
// cielo que titila, la nieve de temporada, las escenas y los brillos), sin tocar nada útil. Se elige en Ajustes:
// Automático (de serie: se pone solo si este móvil va lento), Siempre o Nunca.
// «Va lento» se decide con lo que la app ya mide (los bloqueos: ratos de más de 50 ms sin responder), en los dos
// primeros minutos de cada vez que se abre, sin contar los primeros segundos (abrir siempre cuesta algo). O, de
// entrada, si el navegador dice que el móvil tiene 2 GB de memoria o menos. Lo decidido vale 30 días y luego se mira otra
// vez. (En el iPhone el navegador no cuenta los bloqueos: allí solo vale «Siempre».)
export const OPCIONES_LIGERO = [['auto', 'Automático'], ['si', 'Siempre'], ['no', 'Nunca']];
export const VENTANA_LIGERO = { desdeMs: 5000, hastaMs: 120000 };
export const UMBRAL_LIGERO = { largos: 8, msLargo: 120, totalMs: 3000 };
export const DIAS_LENTO = 30;

export const opcionLigero = (v) => (OPCIONES_LIGERO.some(([k]) => k === v) ? v : 'auto');

// ¿Va lento? bloqueos: [{ inicio, duracion }] (ms desde que se abrió la página)
export function vaLento(bloqueos = [], u = UMBRAL_LIGERO, v = VENTANA_LIGERO) {
  const dentro = (Array.isArray(bloqueos) ? bloqueos : []).filter((b) => Number.isFinite(b?.inicio) && Number.isFinite(b?.duracion) && b.inicio >= v.desdeMs && b.inicio <= v.hastaMs);
  const largos = dentro.filter((b) => b.duracion >= u.msLargo).length;
  const total = dentro.reduce((t, b) => t + b.duracion, 0);
  return largos >= u.largos || total >= u.totalMs;
}
export const memoriaBaja = (gb) => Number.isFinite(gb) && gb > 0 && gb <= 2;

// Lo guardado ({ lento: true, desde: 'AAAA-MM-DD', por: 'bloqueos' | 'memoria' }), si sigue valiendo hoy
export function lentoVigente(estado, hoy) {
  if (!estado || estado.lento !== true || !/^\d{4}-\d{2}-\d{2}$/.test(estado.desde || '') || !/^\d{4}-\d{2}-\d{2}$/.test(hoy || '')) return false;
  const dias = (Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${estado.desde}T12:00:00Z`)) / 86400000;
  return dias >= 0 && dias < DIAS_LENTO;
}
export const ligeroActivo = (opcion, lento) => opcion === 'si' || (opcion !== 'no' && !!lento);
