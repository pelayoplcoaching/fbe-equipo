// «La travesía» al nivel de los mejores (las 20 de claude/descansos-mejoras-4.md), sin pantalla. Uso: node test/travesia-top.test.mjs
import {
  nuevaEtapa, avanzar, saltar, resultado, perfil, V_SALTO, V_BASE, GUARDA_TOQUE, COYOTE, ROCE, comboDe, COMBO_CADA, COMBO_MAX, TROPIEZO,
} from '../web/src/logica/travesia.js';
import * as E from '../web/src/logica/travesia-efectos.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const llano = (semilla = 1, op = {}) => { const e = nuevaEtapa(semilla, op); e.obstaculos = []; e.estrellas = []; e.hasta = 1e9; return e; };
const hasta = (e, cond, max = 10) => { let n = 0; while (!cond(e) && n < max * 240) { avanzar(e, 1 / 240); n++; } return cond(e); };

console.log('\nTanda 1 · el salto que perdona');
{
  // El toque de justo antes de caer, guardado: salta al tocar el suelo
  const e = llano();
  saltar(e); hasta(e, (x) => x.vy < 0); saltar(e);   // (el doble)
  hasta(e, (x) => x.y < 0.25 && x.vy < 0);
  const guarda = saltar(e);                          // (ni uno más en el aire: se guarda)
  const antes = e.guardado != null;
  hasta(e, (x) => x.sucesos.includes('cae'), 3);
  check(!guarda && antes && e.saltos === 1 && e.vy > 0 && e.sucesos.includes('salto'), 'un toque justo antes de caer no se pierde: salta al tocar el suelo');
  // Uno que llega demasiado pronto, no
  const f = llano();
  saltar(f); saltar(f); saltar(f);                   // (el tercero, en lo alto)
  hasta(f, (x) => x.sucesos.includes('cae'), 3);
  check(f.saltos === 0 && f.y === 0, `uno de mucho antes (más de ${GUARDA_TOQUE} s) se olvida: cae y se queda en el suelo`);
  // Al rehacerse de un tropiezo, el toque del final salta
  const g = llano(); g.tropiezo = 0.05; g.inmune = 1;
  saltar(g);
  avanzar(g, 0.06);
  check(g.saltos === 1 && g.tropiezo === 0, 'el toque al final de un tropiezo salta en cuanto se rehace');
  // Coyote: recién dejado el suelo sin saltar (lo que pasa al bajar de una cornisa), aún vale el primer salto
  const k = llano(); k.y = 0.3; k.tSuelo = k.t; k.t += COYOTE * 0.5;
  const sk = saltar(k);
  const k2 = llano(); k2.y = 0.3; k2.tSuelo = k2.t; k2.t += COYOTE * 2;
  check(sk && k.vy === V_SALTO && !saltar(k2), `recién dejado el suelo (menos de ${COYOTE} s), aún vale el primer salto; después, no`);
}

console.log('\nTanda 1 · por los pelos');
{
  // Un pico justo a la medida: el salto lo pasa con muy poco hueco
  const ajuste = (x) => {
    const e = llano(7); e.v = V_BASE;
    e.obstaculos = [{ x, tipo: 'roca', w: 0.9, h: 0.7, plano: 0.5, pasado: false }];
    saltar(e);
    let lentoVisto = false;
    hasta(e, (q) => { if (q.lento > 0) lentoVisto = true; return q.obstaculos[0].pasado; }, 4);
    return { e, lentoVisto, holgura: e.obstaculos[0].holgura };
  };
  let roza = null, holgado = null;
  for (let x = 1; x < 6 && (!roza || !holgado); x += 0.05) {
    const r = ajuste(x);
    if (r.e.tropiezos) continue;
    if (!roza && r.holgura >= 0 && r.holgura < ROCE) roza = r;
    if (!holgado && r.holgura >= ROCE + 0.3) holgado = r;
  }
  check(roza && roza.e.roces === 1 && roza.lentoVisto && resultado(roza.e).roces === 1, `pasar rozando (${roza?.holgura.toFixed(2)} m) da «por los pelos»: un instante a cámara lenta y queda contado`);
  check(holgado && holgado.e.roces === 0, 'pasar con hueco de sobra, no');
  // La cámara lenta: el juego va más despacio, el tiempo de verdad no
  const a = llano(), b = llano();
  a.lento = 0.2; avanzar(a, 0.2); avanzar(b, 0.2);
  check(a.t < b.t * 0.6 && a.lento === 0, 'la cámara lenta: el juego avanza menos en el mismo tiempo, y se acaba');
}

console.log('\nTanda 1 · el combo');
{
  check(comboDe(0) === 1 && comboDe(COMBO_CADA - 1) === 1 && comboDe(COMBO_CADA) === 2 && comboDe(COMBO_CADA * 2) === 3 && comboDe(1000) === COMBO_MAX, `×1, ×2 a los ${COMBO_CADA} seguidos, ×3 a los ${COMBO_CADA * 2}, y como mucho ×${COMBO_MAX}`);
  // Un jugador que nunca falla: el combo sube, y las estrellas valen más
  const e = llano(3); e.obstaculos = [];
  e.serie = COMBO_CADA * 2; e.combo = comboDe(e.serie);
  e.estrellas = [{ x: e.x + 2, y: 0.4, cogida: false }];
  hasta(e, (q) => q.estrellasCogidas > 0, 2);
  check(e.estrellasCogidas === 3, 'con ×3, una estrella cuenta tres');
  // Al tropezar, vuelve a ×1
  const f = llano(3); f.serie = 20; f.combo = comboDe(20);
  f.obstaculos = [{ x: f.x + 1.2, tipo: 'pico', w: 1.4, h: 1.3, plano: 0.1, pasado: false }];
  hasta(f, (q) => q.tropiezos > 0, 3);
  check(f.combo === 1 && f.serie === 0 && f.sucesos.includes('combo-fuera'), 'al tropezar, el combo vuelve a ×1');
  // El combo sale en el cartel (en lugar del de la racha) y en el resultado
  check(E.cartelDeHito({ metros: 10, combo: 1 }, { metros: 12, combo: 2 }).texto === 'Combo ×2' && E.cartelDeHito({ metros: 10, racha: 9, combo: 1 }, { metros: 12, racha: 10, combo: 1 }) === null
    && E.cartelDeHito({ metros: 249, combo: 2 }, { metros: 251, combo: 2 }).texto === '250 m', 'el cartel dice «Combo ×2» al subir; con combo, la racha ya no tiene cartel; los metros, sí');
  const g = nuevaEtapa(5); g.comboMax = 3;
  check(resultado(g).combo === 3, 'el mejor combo de la etapa, en su resultado');
}

console.log('\nTanda 1 · avisos y un solo toque');
{
  const obs = [{ x: 30, w: 2.4, tipo: 'monte', pasado: false }, { x: 50, w: 1, tipo: 'rama', pasado: false }];
  const a = E.avisoDe(obs, 25), b = E.avisoDe(obs, 20), c = E.avisoDe(obs, 42), d = E.avisoDe([{ x: 30, w: 1, tipo: 'roca' }], 25);
  check(a?.tipo === 'monte' && a.cerca > 0.4 && b && b.cerca < a.cerca && c?.tipo === 'rama' && d === null && E.avisoDe(obs, 10) === null,
    'el aviso: el monte o la rama que aún no se ven, más fuerte cuanto más cerca; lo de un salto normal, sin aviso');
  // Un solo toque: nada pide doble salto ni agacharse, y no hay doble salto
  const u = nuevaEtapa(11, { unToque: true, movimientos: true });
  let tipos = new Set();
  for (let i = 0; i < 4000; i++) { avanzar(u, 1 / 30); u.obstaculos.forEach((o) => tipos.add(o.tipo)); if (u.saltos === 0) saltar(u); }
  const r = u.obstaculos.find((o) => o.tipo === 'rio') || { w: 2.2 };
  const v = nuevaEtapa(1, { unToque: true }); saltar(v); avanzar(v, 0.05);
  check(!tipos.has('monte') && !tipos.has('rama') && r.w <= 2.2 && !saltar(v) && v.saltos === 1, `en «un solo toque», ni montes ni ramas (${[...tipos].join(', ')}), ríos más estrechos y sin doble salto`);
}

console.log('\nTanda 1 · la calidad, a tres niveles');
{
  let c = E.CALIDAD_INICIAL();
  for (let i = 0; i < 200; i++) c = E.calidad(c, 16.7);
  const alta = c.nivel;
  for (let i = 0; i < 60; i++) c = E.calidad(c, 40);
  const ligero = c.nivel;
  for (let i = 0; i < 200; i++) c = E.calidad(c, 40);
  const minimo = c.nivel;
  for (let i = 0; i < 400; i++) c = E.calidad(c, 10);
  const vuelve = c.nivel;
  for (let i = 0; i < 400; i++) c = E.calidad(c, 40);
  for (let i = 0; i < 400; i++) c = E.calidad(c, 10);
  check(alta === 2 && ligero === 1 && minimo === 0 && vuelve === 1 && c.nivel === 0, 'con 60 cuadros, todo; si va justo, ligero y luego mínimo; si mejora, sube uno (una sola vez por etapa)');
  const oculta = E.calidad(E.CALIDAD_INICIAL(), 900, false);
  check(oculta.cuadros === 0 && oculta.nivel === 2, 'con la pantalla oculta no cuenta');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
