// Pasa las pruebas de `npm test` (cada archivo por separado, para que un fallo no esconda los demás) con varias fechas
// simuladas y resume qué falla en cada una. Sirve para cazar pruebas que solo fallan un día de la semana, a una hora,
// un día del mes o en fechas especiales (fin de mes, Navidad, fin de año, cambio de hora).
//
//   node test/por-fechas.mjs                      todas las fechas de la lista
//   node test/por-fechas.mjs 2026-11-23T08:00     solo esas (hora de Madrid si no lleva zona)
//   SOLO=radar,logica node test/por-fechas.mjs    solo los archivos cuyo nombre contenga alguna de esas palabras
//
// Usa test/fecha-simulada.mjs. La zona es siempre Europe/Madrid, como en GitHub.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const precarga = fileURLToPath(new URL('./fecha-simulada.mjs', import.meta.url));

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
  '2026-12-31T23:30', // fin de año (cruza al 2027)
  '2027-01-01T10:00', // año nuevo, viernes
  '2027-03-28T10:00', // domingo del cambio a horario de verano
  '2027-03-29T08:00', // lunes después del cambio
  '2027-10-31T10:00', // domingo del cambio a horario de invierno
];

const conZona = (f) => (/[zZ]|[+-]\d\d:\d\d$/.test(f) ? f : `${f}:00${desfaseMadrid(f)}`);
function desfaseMadrid(f) {
  // La hora de Madrid es +01:00 en invierno y +02:00 en verano: se prueba con las dos y se queda la que cuadra.
  for (const z of ['+01:00', '+02:00']) {
    const d = new Date(`${f}:00${z}`);
    const h = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
    if (h === f.slice(11, 16)) return z;
  }
  return '+01:00';
}

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const solo = (process.env.SOLO || '').split(',').map((s) => s.trim()).filter(Boolean);
const comandos = pkg.scripts.test.split('&&').map((c) => c.trim())
  .filter((c) => !solo.length || solo.some((s) => c.includes(s)));
const fechas = process.argv.slice(2).length ? process.argv.slice(2) : FECHAS;

const correr = (cmd, fecha) => new Promise((resolve) => {
  const [bin, ...args] = cmd.split(/\s+/);
  const env = { ...process.env, TZ: 'Europe/Madrid', FBE_FECHA: conZona(fecha), NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --import ${precarga}`.trim() };
  const hijo = spawn(bin, args, { cwd: raiz, env });
  let salida = '';
  hijo.stdout.on('data', (d) => { salida += d; });
  hijo.stderr.on('data', (d) => { salida += d; });
  hijo.on('close', (codigo) => resolve({ codigo, salida }));
});

const informe = [];
for (const fecha of fechas) {
  const t0 = Date.now();
  const fallos = [];
  for (const cmd of comandos) {
    const { codigo, salida } = await correr(cmd, fecha);
    if (codigo !== 0) {
      const lineas = salida.split('\n').filter((l) => /✗|Error|assert/i.test(l)).slice(0, 8).map((l) => l.trim().slice(0, 220));
      fallos.push({ archivo: cmd.replace('node ', ''), lineas: lineas.length ? lineas : salida.trim().split('\n').slice(-5) });
    }
  }
  const linea = `${fecha} (${Math.round((Date.now() - t0) / 1000)} s): ${fallos.length ? `${fallos.length} archivo(s) con fallos` : 'todo bien'}`;
  console.log(linea);
  for (const f of fallos) { console.log(`  · ${f.archivo}`); for (const l of f.lineas) console.log(`      ${l}`); }
  informe.push({ fecha, fallos });
  if (process.env.INFORME) writeFileSync(process.env.INFORME, JSON.stringify(informe, null, 1));
}
process.exit(informe.some((i) => i.fallos.length) ? 1 : 0);
