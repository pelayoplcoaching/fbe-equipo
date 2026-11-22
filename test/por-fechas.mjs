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

// (las fechas y cómo se les pone la zona de Madrid, en test/fechas-lista.mjs)
import { FECHAS, conZona } from './fechas-lista.mjs';
export { FECHAS };

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
      // Las comprobaciones que fallan (✗) y, si no hay, los errores que no sean de una comprobación que pasa
      const todas = salida.split('\n');
      const cruces = todas.filter((l) => /✗/.test(l));
      const lineas = (cruces.length ? cruces : todas.filter((l) => /Error|assert/i.test(l) && !/✓/.test(l))).slice(0, 8).map((l) => l.trim().slice(0, 220));
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
