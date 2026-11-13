// «La travesía», el jugo (las 20 de claude/descansos-mejoras-6.md), sin pantalla. Uso: node test/travesia-jugo.test.mjs
import * as E from '../web/src/logica/travesia-efectos.js';
import * as R from '../web/src/logica/travesia-ruta.js';
import * as M from '../web/src/logica/travesia-meta.js';
import { nuevaEtapa, avanzar, saltar, resultado, MOMENTOS, MOMENTO_CADA, CONSTELACION, LLUVIA } from '../web/src/logica/travesia.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const limpia = (semilla = 3) => { const e = nuevaEtapa(semilla, {}); e.obstaculos = []; e.estrellas = []; e.hasta = 1e9; return e; };
const correr = (e, s, cada = null) => { const sucesos = []; for (let i = 0; i < s * 60; i++) { cada?.(e, i); avanzar(e, 1 / 60); sucesos.push(...e.sucesos); e.sucesos.length = 0; } return sucesos; };

console.log('\nTanda 9 · al saltar, al caer y al coger');
{
  const e = limpia(); correr(e, 0.3);
  e.obstaculos.push({ x: e.x + 2.2, tipo: 'roca', w: 0.9, h: 0.7, plano: 0.5, pasado: false });
  saltar(e);
  const s = correr(e, 1.2);
  check(s.includes('limpio') && resultado(e).limpios === 1, 'saltar algo y caer sin tropezar: «¡Limpio!» (y se cuenta)');
  const f = limpia(); correr(f, 0.3); saltar(f);
  check(!correr(f, 1.2).includes('limpio'), 'un salto sin nada debajo no es caída limpia');
  const g = limpia(); correr(g, 0.3);
  const x0 = g.x + 3;
  CONSTELACION.alturas.forEach((y, i) => g.estrellas.push({ x: x0 + i * 0.4, y: 0.8, cogida: false, grupo: 7 }));
  const antes = g.estrellasCogidas, sg = correr(g, 1.5);
  check(sg.includes('constelacion') && g.constelaciones === 1 && g.estrellasCogidas === antes + CONSTELACION.alturas.length + CONSTELACION.premio && g.grupoHecho === 7, 'la constelación del camino completa da su premio (cinco más)');
  const h = limpia(); correr(h, 0.3);
  [0, 1].forEach((i) => h.estrellas.push({ x: h.x + 3 + i * 0.4, y: 0.8, cogida: false, grupo: 2 })); h.estrellas.push({ x: h.x + 30, y: 6, cogida: false, grupo: 2 });
  check(!correr(h, 1.5).includes('constelacion'), 'si falta una, no hay premio');
  check(h.valeUltima === 1, 'cada estrella dice lo que vale (para el «+1» que sube)');
  // Las constelaciones aparecen solas en el camino, con su arco alcanzable
  let grupos = 0; for (let k = 1; k < 25; k++) { const v = nuevaEtapa(k, { variedad: true }); for (let i = 0; i < 60 * 60 && v.x < 600; i++) { avanzar(v, 1 / 60); v.sucesos.length = 0; if (v.tropiezo) v.tropiezo = 0; } grupos += v.grupos || 0; }
  check(grupos > 5 && Math.max(...CONSTELACION.alturas) < 2.6, `las constelaciones salen en el camino (${grupos} en 24 etapas) y se alcanzan de un salto`);
  const notas = [0, 1, 2, 3, 4, 5].map((n) => E.notaEscala(n));
  check(notas.every((x, i) => i === 0 || x > notas[i - 1]) && notas[5] === 1760 && E.notaEscala(99) === E.notaEscala(10), 'las estrellas seguidas suben de nota (pentatónica, hasta dos octavas)');
  check(E.hayGolpe(['salto', 'dorada']) && !E.hayGolpe(['salto', 'estrella']) && E.GOLPE.dura <= 0.08, 'el golpe del momento: con la dorada, el combo, el roce o la constelación, y muy corto');
}

console.log('\nTanda 9 · la lluvia de estrellas');
{
  check(MOMENTOS.includes('lluvia') && MOMENTOS.length === 5, 'la lluvia de estrellas es un momento raro más');
  const i = MOMENTOS.indexOf('lluvia');
  const e = nuevaEtapa(4, { variedad: true, km0: MOMENTO_CADA * i + MOMENTO_CADA / 2 - 70 });
  for (let k = 0; k < 60 * 30 && !e.lluvia; k++) { avanzar(e, 1 / 60); e.sucesos.length = 0; }
  const enLluvia = e.lluvia ? e.estrellas.filter((s) => s.cae && s.x >= e.lluvia.desde && s.x <= e.lluvia.hasta) : [];
  const nada = e.lluvia ? e.obstaculos.filter((o) => o.x > e.lluvia.desde && o.x < e.lluvia.hasta) : [1];
  check(!!e.lluvia && enLluvia.length === LLUVIA.estrellas && nada.length === 0, `un tramo despejado con ${enLluvia.length} estrellas que caen`);
}

console.log('\nTanda 11 · los sitios de la ruta y el sello');
{
  check(R.siluetaDe('Peñíscola') === 'castillo' && R.siluetaDe('Santiago de Compostela') === 'catedral' && R.siluetaDe('Madrid') === 'ciudad' && R.siluetaDe('Pola de Lena') === 'pueblo', 'cada sitio con su silueta (castillo, catedral, ciudad… y el pueblo de siempre)');
  const p = R.proximoSitio(40537);
  check(p.nombre === 'La Robla' && p.metros === 44463 && p.desde === 38 && p.hasta === 85 && Math.abs(p.km - 40.537) < 1e-9, 'el próximo sitio, a cuántos metros de donde empieza la etapa (exacto, no redondeado)');
  const ultimo = R.proximoSitio(0, []);
  check(ultimo.nombre === 'Pola de Lena' && ultimo.desde === 0, 'al empezar, el primero');
  const g = { sesiones: { a: { metros: 1000, etapas: 2 }, b: { metros: 500, etapas: 1 }, hoy: { metros: 9999, etapas: 5 } } };
  const md = M.mediaEtapa(g, 'hoy');
  check(md.media === 500 && md.etapas === 3, 'la media de sus etapas, sin la sesión de ahora');
  check(M.selloDe(600, md) === 'oro' && M.selloDe(450, md) === 'plata' && M.selloDe(300, md) === 'bronce' && M.selloDe(600, { media: 500, etapas: 2 }) === null && M.selloDe(0, md) === null, 'el sello: oro, plata o bronce frente a su propia media (con tres etapas de antes, como poco)');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
