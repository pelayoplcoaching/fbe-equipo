// «La travesía», el remate (las 20 de claude/descansos-mejoras-5.md), sin pantalla. Uso: node test/travesia-remate.test.mjs
import * as E from '../web/src/logica/travesia-efectos.js';
import { PATRONES } from '../web/src/ui/hapticos.js';
import { nuevaEtapa, avanzar, saltar, pulsar, resultado, VENTISCA, SECRETO, MOMENTO_CADA } from '../web/src/logica/travesia.js';
import * as R from '../web/src/logica/travesia-ruta.js';
import * as M from '../web/src/logica/travesia-meta.js';

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

console.log('\nTanda 6 · la ventisca');
{
  // La cuarta de los momentos raros: la ventisca persigue durante VENTISCA.largo m
  const e = nuevaEtapa(3, { variedad: true, km0: MOMENTO_CADA * 3 + MOMENTO_CADA / 2 - 300 });
  let vista = null;
  while (e.x < 700 && !vista) { e.inmune = 9; avanzar(e, 0.1); vista = e.ventisca; }
  check(vista && vista.hasta - vista.desde === VENTISCA.largo && e.momentos.some((m) => m.tipo === 'ventisca'), `cada ${MOMENTO_CADA * 4} m, la ventisca (dura ${VENTISCA.largo} m)`);
  // Sin tropezar, se escapa; tropezando mucho, te alcanza y se lleva estrellas (la etapa sigue)
  const huye = nuevaEtapa(1); huye.obstaculos = []; huye.hasta = 1e9; huye.ventisca = { desde: huye.x + 1, hasta: huye.x + 60, distancia: VENTISCA.ventaja, empezada: false };
  while (huye.x < 80) avanzar(huye, 1 / 60);
  check(huye.escapadas === 1 && huye.alcanzado === 0 && resultado(huye).escapadas === 1, 'sin tropezar, se escapa (y cuenta para su logro)');
  const cae = nuevaEtapa(1); cae.obstaculos = []; cae.hasta = 1e9; cae.estrellasCogidas = 10; cae.ventisca = { desde: cae.x, hasta: cae.x + 100, distancia: 2, empezada: true };
  cae.ventisca.distancia = -0.1; avanzar(cae, 1 / 60);
  check(cae.alcanzado === 1 && cae.estrellasCogidas === 10 - VENTISCA.pierde && cae.ventisca.distancia > 0 && cae.sucesos.includes('alcanzado'), `si alcanza, se lleva ${VENTISCA.pierde} estrellas y se aparta (la etapa sigue)`);
}

console.log('\nTanda 6 · los secretos y la etapa dorada');
{
  const e = nuevaEtapa(5, { variedad: true, km0: SECRETO.cada - 120 });
  let alta = null;
  while (e.x < 300 && !alta) { e.inmune = 9; avanzar(e, 0.1); alta = e.cornisas.find((c) => c.alta); }
  const dorada = alta && e.estrellas.find((x) => x.dorada);
  check(alta && alta.h === SECRETO.alto && dorada && Math.abs(dorada.x - alta.x) < 0.01, `cada ${SECRETO.cada} m, una cornisa altísima con su estrella dorada`);
  // Con el doble salto y sin mantener el dedo no se llega; manteniendo el dedo y con el doble, sí
  const llega = (mantiene) => { const g = nuevaEtapa(1); g.obstaculos = []; g.estrellas = []; g.hasta = 1e9; pulsar(g, mantiene); saltar(g); let alto = 0, doble = false; for (let i = 0; i < 400; i++) { if (!doble && g.vy <= 0) { saltar(g); doble = true; } avanzar(g, 1 / 120); alto = Math.max(alto, g.y); } return alto; };
  check(llega(false) < SECRETO.alto && llega(true) > SECRETO.alto, `solo con el salto largo más el doble se llega (sin mantener: ${llega(false).toFixed(1)} m; manteniendo: ${llega(true).toFixed(1)} m)`);
  const c = nuevaEtapa(1); c.obstaculos = []; c.hasta = 1e9; c.estrellas = [{ x: c.x + 1, y: 0.4, cogida: false, dorada: true }];
  for (let i = 0; i < 60; i++) avanzar(c, 1 / 60);
  check(c.doradas === 1 && c.estrellasCogidas === 10 && resultado(c).doradas === 1, 'la estrella dorada vale diez y se cuenta aparte');
  const d = nuevaEtapa(1, { estrellasPor: 2 }); d.obstaculos = []; d.hasta = 1e9; d.estrellas = [{ x: d.x + 1, y: 0.4, cogida: false }];
  for (let i = 0; i < 60; i++) avanzar(d, 1 / 60);
  check(d.estrellasCogidas === 2, 'en la etapa dorada (o con luna llena), cada estrella vale doble');
}

console.log('\nTanda 6 · fechas especiales, rutas nuevas y logros');
{
  check(E.fechaEspecial('2026-12-24') === 'navidad' && E.fechaEspecial('2027-01-05') === 'navidad' && E.fechaEspecial('2026-10-31') === 'halloween' && E.fechaEspecial('2026-11-02') === 'halloween'
    && E.fechaEspecial('2026-11-13') === null && E.fechaEspecial('2026-11-13', { ilum: 0.99 }, 'noche') === 'lunallena' && E.fechaEspecial('2026-11-13', { ilum: 0.99 }, 'dia') === null, 'Navidad, Halloween y la luna llena de verdad (solo de noche)');
  const tras = (450 + 355 + 350) * 1000;
  check(R.posicionEnRuta(tras + 1000).ruta.id === 'picos' && R.posicionEnRuta(tras + 1000, ['pirineos']).ruta.id === 'pirineos' && R.rutaPorElegir(1000) === null && R.rutaPorElegir((450 + 355) * 1000 + 10).n === 3,
    'tras Barcelona, la ruta que se elija; se elige desde la última ruta de siempre');
  const m = M.elegirRuta(M.META_VACIA(), 4, 'camino');
  check(m.rutas.join() === 'picos,camino' && M.elegirRuta(m, 3, 'pirineos').rutas.join() === 'pirineos' && M.elegirRuta(m, 2, 'camino').rutas.join() === 'picos,camino', 'elegir una ruta guarda las de antes (por orden si no se eligieron) y quita las de después');
  check(R.RUTAS_NUEVAS.every((r) => r.hitos[0][1] === 0 && r.hitos.every(([, k], i) => i === 0 || k > r.hitos[i - 1][1])) && R.postales(tras + 30000).some((p) => p.lugar === 'Covadonga'), 'las rutas nuevas, con sus hitos en orden y sus postales');
  const x = M.sumarMeta(M.META_VACIA(), { metros: 100, estrellas: 12, segundos: 40, tropiezos: 1, calma: false, combo: 1, roces: 0, arriba: 0, potenciadores: [], rios: 0, doradas: 1, escapadas: 1 }, { total: 100, estrellas: 12 }, { dorada: true, fecha: 'navidad' });
  check(['dorada1', 'ventisca', 'dorado', 'fiestas'].every((k) => x.meta.logros[k]) && x.meta.doradas === 1, 'los logros nuevos: el primer secreto, la ventisca, el día dorado y las fiestas');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
