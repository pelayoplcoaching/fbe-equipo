// Las fechas con trampa con que se pasan las pruebas (test/por-fechas.mjs, y cada lunes en GitHub: .github/workflows/fechas.yml)
// Fechas con trampa: cada día de la semana, el cambio de día en Madrid frente a UTC, principio, mitad y fin de mes,
// Navidad, fin de año, año nuevo y las dos semanas del cambio de hora.
export const FECHAS = [
  '2026-11-23T08:00', // lunes
  '2026-11-24T13:00', // martes
  '2026-11-25T19:00', // miércoles
  '2026-11-26T10:00', // jueves
  '2026-11-27T22:00', // viernes, noche
  '2026-11-28T10:00', // sábado
  '2026-11-29T21:00', // domingo, noche
  '2026-11-23T00:20', // lunes de madrugada (en UTC aún es domingo)
  '2026-11-29T23:50', // domingo a punto de medianoche (cruza al lunes durante la pasada)
  '2026-11-30T09:00', // último día del mes, lunes
  '2026-12-01T09:00', // día 1
  '2026-12-15T09:00', // día 15
  '2026-12-24T18:00', // Nochebuena
  '2026-12-30T12:00', // un 30 cuyo mañana no tiene igual 6 meses antes (no hay 31 de junio)
  '2026-12-31T23:30', // fin de año (cruza al 2027)
  '2027-01-01T10:00', // año nuevo, viernes
  '2027-03-28T10:00', // domingo del cambio a horario de verano
  '2027-03-29T08:00', // lunes después del cambio
  '2027-10-31T10:00', // domingo del cambio a horario de invierno
  '2027-06-15T12:00', // dentro de unos meses: las fechas fijas escritas en las pruebas ya han pasado
  '2028-02-29T12:00', // un 29 de febrero
];

export const conZona = (f) => (/[zZ]|[+-]\d\d:\d\d$/.test(f) ? f : `${f}:00${desfaseMadrid(f)}`);
function desfaseMadrid(f) {
  // La hora de Madrid es +01:00 en invierno y +02:00 en verano: se prueba con las dos y se queda la que cuadra.
  for (const z of ['+01:00', '+02:00']) {
    const d = new Date(`${f}:00${z}`);
    const h = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
    if (h === f.slice(11, 16)) return z;
  }
  return '+01:00';
}

