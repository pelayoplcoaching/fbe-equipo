// Pasa una o varias partes de la prueba de punta a punta sueltas, las veces que se quiera, sobre dist/ ya compilado.
// Sirve para reproducir las que fallan a ratos (y, con test/fecha-simulada.mjs, las que dependen de la fecha).
//
//   node test/suelta.mjs e2e-viaje                    una vez (busca la función exportada probar…)
//   node test/suelta.mjs e2e-viaje 10                 diez veces seguidas
//   node test/suelta.mjs e2e-viaje,e2e-tiempo 5       varias partes, en ese orden, cinco veces
//   CARGA=1 node test/suelta.mjs e2e-viaje 10         con la máquina ocupada (un bucle en cada núcleo menos uno)
//
// Al final dice cuántas vueltas salieron limpias y qué comprobaciones fallaron (y cuántas veces).
import { chromium } from 'playwright';
import { cpus } from 'node:os';
import { Worker } from 'node:worker_threads';
import { servir } from './servidor.mjs';

const [nombres = '', vecesTxt = '1'] = process.argv.slice(2);
if (!nombres) { console.log('Uso: node test/suelta.mjs e2e-viaje[,e2e-otra] [veces]'); process.exit(2); }
const veces = Math.max(1, Number(vecesTxt) || 1);
const partes = [];
for (const n of nombres.split(',')) {
  const mod = await import(new URL(`./${n.replace(/\.mjs$/, '')}.mjs`, import.meta.url));
  const fn = Object.entries(mod).find(([k, v]) => typeof v === 'function' && /^probar/.test(k));
  if (!fn) throw new Error(`${n}: no exporta ninguna función probar…`);
  partes.push({ n, nombre: fn[0], fn: fn[1] });
}

const ocupar = process.env.CARGA
  ? Array.from({ length: Math.max(1, cpus().length - 1) }, () => new Worker('for (;;) { Math.sqrt(Math.random()); }', { eval: true }))
  : [];
const srv = await servir(new URL('../dist', import.meta.url).pathname, 4174);
const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const fallidas = new Map();
let limpias = 0;
try {
  for (let i = 1; i <= veces; i++) {
    let fallosVuelta = 0;
    const check = (c, m) => {
      if (c) return;
      fallosVuelta++;
      const clave = String(m).replace(/\(.*?\)|«.*?»/g, '…').slice(0, 160);
      fallidas.set(clave, (fallidas.get(clave) || 0) + 1);
      console.log(`  ✗ [${i}] ${String(m).slice(0, 300)}`);
    };
    const t0 = Date.now();
    for (const p of partes) {
      try { await p.fn({ navegador, check }); } catch (e) { check(false, `${p.n}: ${e.message.split('\n').slice(0, 4).join(' / ')}`); }
    }
    if (!fallosVuelta) limpias++;
    console.log(`vuelta ${i}/${veces}: ${fallosVuelta ? `${fallosVuelta} fallo(s)` : 'limpia'} (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
} finally {
  await navegador.close();
  srv.close();
  for (const w of ocupar) w.terminate();
}
console.log(`\n${nombres}: ${limpias}/${veces} vueltas limpias`);
for (const [m, n] of [...fallidas].sort((a, b) => b[1] - a[1])) console.log(`  ${n}× ${m}`);
process.exit(limpias === veces ? 0 : 1);
