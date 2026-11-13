// «La travesía», el remate (las 20 de claude/descansos-mejoras-5.md), sin pantalla. Uso: node test/travesia-remate.test.mjs
import * as E from '../web/src/logica/travesia-efectos.js';
import { PATRONES } from '../web/src/ui/hapticos.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('\nTanda 5 · el final, la vuelta y la cámara');
{
  check(E.metaFinal(100, 8, 5) === 140 && E.metaFinal(100, 8, 11) === null && E.metaFinal(100, 8, 0) === null && E.metaFinal(100, 8, NaN) === null, 'la meta, solo en los diez últimos segundos y donde estará el lobo al acabar');
  check(E.cuentaVuelta(0) === 3 && E.cuentaVuelta(0.6) === 2 && E.cuentaVuelta(1.1) === 1 && E.cuentaVuelta(E.VUELTA) === 0 && E.cuentaVuelta(null) === 0, 'la vuelta suave cuenta 3, 2, 1 (medio segundo cada uno) y se acaba');
  check(E.zoomDe([{ tipo: 'estampida', x: 120 }], 100) < 1 && E.zoomDe([{ tipo: 'tormenta', x: 120 }], 100) === 1 && E.zoomDe([{ tipo: 'puente', x: 300 }], 100) === 1 && E.zoomDe([{ tipo: 'estampida', x: 90 }], 100) < 1, 'la cámara se aleja en la estampida y el puente (no en la tormenta), y solo cerca');
}

console.log('\nTanda 5 · jugar sin mirar y las vibraciones');
{
  const obs = [{ x: 20, w: 1, tipo: 'pico' }, { x: 40, w: 2.4, tipo: 'monte' }];
  const sonaron = [];
  for (let x = 0; x < 45; x += 0.08) sonaron.push(...E.pitidos(obs, x, 8).map((p) => `${p.tipo}:${p.cerca.toFixed(1)}`));
  check(sonaron.join() === 'pico:0.0,pico:0.5,pico:1.0,monte:0.0,monte:0.5,monte:1.0', `cada obstáculo avisa tres veces, cada vez más cerca (${sonaron.join(' ')})`);
  check(E.pitidos(obs, 0, 0).length === 0 && E.pitidos([{ x: 5, w: 1, tipo: 'roca', apartado: true }], 0, 8).length === 0, 'parado no suena; lo apartado por el aullido, tampoco');
  check(['tv-salto', 'tv-doble', 'tv-roce', 'tv-estrella', 'tv-combo', 'tv-tropiezo', 'tv-prepara', 'tv-meta'].every((k) => PATRONES[k] != null) && new Set(['tv-salto', 'tv-doble', 'tv-roce', 'tv-combo', 'tv-tropiezo', 'tv-meta'].map((k) => JSON.stringify(PATRONES[k]))).size === 6, 'una vibración distinta para cada cosa del juego');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
