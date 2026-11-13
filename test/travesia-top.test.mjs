// «La travesía» al nivel de los mejores (las 20 de claude/descansos-mejoras-4.md), sin pantalla. Uso: node test/travesia-top.test.mjs
import {
  nuevaEtapa, avanzar, saltar, agachar, resultado, perfil, V_SALTO, V_BASE, GUARDA_TOQUE, COYOTE, ROCE, comboDe, COMBO_CADA, COMBO_MAX, TROPIEZO, LOBO,
  altoTerreno, pendiente, CORNISA, MOMENTO_CADA, POTENCIADORES,
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
  check(sk && k.vy === V_SALTO && k.saltos === 1 && saltar(k2) && k2.saltos === 2, `recién dejado el suelo (menos de ${COYOTE} s), aún vale el primer salto; después, el toque es el doble`);
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

// ---------- Tanda 2 ----------
// Un jugador que ve el futuro (como el de travesia.test.mjs, con la copia entera: cuestas, cornisas y potenciadores)
const DT = 1 / 60;
const copia = (e) => ({ ...e, rnd: () => 0.5, hasta: Infinity, sucesos: [], tutorial: null, variedad: false,
  obstaculos: e.obstaculos.map((o) => ({ ...o })), estrellas: [], potenciadores: e.potenciadores.map((q) => ({ ...q })), cuestas: e.cuestas.slice(), cornisas: e.cornisas.slice(), momentos: [] });
function pasaCon(e, o, doble) {
  const c = copia(e), mio = c.obstaculos.find((q) => q.x === o.x);
  saltar(c);
  for (let i = 0; i < 240; i++) {
    if (doble != null && c.saltos === 1 && i * DT >= doble) saltar(c);
    avanzar(c, DT);
    if (c.tropiezos > e.tropiezos) return false;
    if (mio.pasado) return true;
    if (c.saltos === 0 && !c.cae && c.x + LOBO.medio < mio.x - mio.w / 2) return false;
  }
  return false;
}
function jugarSolo(e, segundos) {
  const fin = e.t + segundos;
  let plan = null;
  while (e.t < fin) {
    if (e.saltos === 0 && !e.cae && e.tropiezo === 0) {
      plan = null;
      const o = e.obstaculos.find((q) => !q.pasado && !q.chocado && !q.apartado);
      if (o && o.tipo === 'rama') { if (e.agachado < 0.3 && o.x - o.w / 2 - (e.x + LOBO.medio) < 0.5) agachar(e); }
      else if (o && o.x - e.x < 9) {
        const d = [null, 0.12, 0.2, 0.28, 0.36, 0.44].find((q) => pasaCon(e, o, q));
        if (d !== undefined) { saltar(e); plan = d == null ? null : { en: e.t + d }; }
      }
    } else if (plan && e.saltos === 1 && e.t >= plan.en) { saltar(e); plan = null; }
    avanzar(e, DT);
  }
  return e;
}

console.log('\nTanda 2 · el terreno con variedad');
{
  // 4 km sin jugar (sin tropezar: inmune), para ver qué sale
  const g = nuevaEtapa(21, { variedad: true });
  const cuestas = [], cornisas = [], obs = [];
  while (g.x < 4000) {
    g.inmune = 9;
    for (const q of g.cuestas) if (!cuestas.includes(q)) cuestas.push(q);
    for (const q of g.cornisas) if (!cornisas.includes(q)) cornisas.push(q);
    for (const o of g.obstaculos) if (!obs.includes(o)) obs.push(o);
    avanzar(g, 0.1);
  }
  const lomas = cuestas.filter((q) => q.h > 0).length, hondas = cuestas.filter((q) => q.h < 0).length;
  check(lomas > 4 && hondas > 1 && cornisas.filter((c) => !c.puente).length > 3, `en 4 km: ${lomas} lomas, ${hondas} hondonadas y ${cornisas.filter((c) => !c.puente).length} cornisas`);
  const dentro = obs.filter((o) => cuestas.some((q) => o.x + o.w / 2 > q.x0 && o.x - o.w / 2 < q.x1) || cornisas.some((c) => !c.puente && Math.abs(o.x - c.x) < c.w / 2 + o.w / 2));
  check(dentro.length === 0, 'ningún obstáculo cae en una cuesta ni bajo una cornisa');
  const q = cuestas[0], L = q.x1 - q.x0;
  check(altoTerreno({ cuestas: [q] }, q.x0 + 0.001) < 0.01 && Math.abs(altoTerreno({ cuestas: [q] }, q.x0 + L / 2) - q.h) < 1e-9 && altoTerreno({ cuestas: [q] }, q.x1 + 1) === 0
    && Math.abs(pendiente({ cuestas: [q] }, q.x0 + L / 4)) <= 0.4, `la cuesta es suave: empieza y acaba a ras, y no pasa del ${Math.round((Math.PI * Math.abs(q.h)) / L * 100)} % de pendiente`);
  // Cuesta arriba frena, cuesta abajo lanza
  const sube = llano(1), plano = llano(1); sube.cuestas = [{ x0: sube.x, x1: sube.x + 20, h: 2 }];
  const durante = (e, t) => { for (let i = 0; i < t * 120; i++) avanzar(e, 1 / 120); };
  sube.v = plano.v = 8; durante(sube, 0.5); durante(plano, 0.5);
  const baja = llano(1); baja.cuestas = [{ x0: baja.x - 10, x1: baja.x + 10, h: 2 }]; baja.y = 2; baja.v = 8; durante(baja, 0.5);
  check(sube.v < plano.v - 0.3 && baja.v > plano.v + 0.3 && Math.abs(sube.y - altoTerreno(sube, sube.x)) < 1e-6, `cuesta arriba frena (${sube.v.toFixed(1)} m/s), cuesta abajo lanza (${baja.v.toFixed(1)}); y el lobo va pegado al terreno`);
}

console.log('\nTanda 2 · las cornisas');
{
  const e = llano(1); e.v = 8;
  const c = { x: e.x + 7, w: 6, h: CORNISA.alto, grosor: CORNISA.grosor };
  e.cornisas = [c];
  // salta antes de la cornisa y cae encima
  let subio = false;
  for (let i = 0; i < 400; i++) { if (i === 30) saltar(e); avanzar(e, 1 / 120); if (e.sobre === c) { subio = true; break; } }
  const y1 = e.y;
  for (let i = 0; i < 40; i++) avanzar(e, 1 / 120);
  const arriba = e.arriba;
  // se acaba la cornisa: cae (y recién caído, aún vale el primer salto)
  let cayo = false, coyote = false;
  for (let i = 0; i < 400; i++) { avanzar(e, 1 / 120); if (e.cae && !cayo) { cayo = true; coyote = e.t - e.tSuelo <= COYOTE; } if (cayo && e.saltos === 0 && !e.cae) break; }
  check(subio && Math.abs(y1 - c.h) < 1e-9 && arriba > 1 && cayo && coyote && e.y === 0, `se sube de un salto, corre por encima (${arriba.toFixed(1)} m contados) y al acabarse cae al suelo`);
  // por debajo: si salta, se da con la cabeza (no tropieza: solo se para y cae)
  const d = llano(1); d.cornisas = [{ x: d.x + 0.2, w: 6, h: CORNISA.alto, grosor: CORNISA.grosor }];
  saltar(d); for (let i = 0; i < 60; i++) avanzar(d, 1 / 120);
  check(d.cabezazos === 1 && d.tropiezos === 0 && d.y < CORNISA.alto - CORNISA.grosor, 'por debajo se pasa corriendo; si salta, se da con la cabeza y cae (sin tropezar)');
}

console.log('\nTanda 2 · los potenciadores');
{
  const pon = (tipo) => { const e = llano(1); e.potenciadores = [{ x: e.x + 1, y: 0.5, tipo, cogido: false }]; avanzar(e, 0.25); return e; };
  const i = pon('iman'); i.estrellas = [1, 2, 3].map((d) => ({ x: i.x + d * 0.5, y: 2.5, cogida: false })); avanzar(i, 0.05);
  check(i.potCogidos[0] === 'iman' && i.iman > 0 && i.estrellasCogidas === 3, 'el imán: las estrellas de delante vienen solas, aunque estén altas');
  const l = pon('luna'), n = llano(1); for (let k = 0; k < 120; k++) { avanzar(l, 1 / 120); avanzar(n, 1 / 120); } avanzar(n, 0.25);
  check(l.potCogidos[0] === 'luna' && l.t < n.t - 0.25, 'la luna llena: unos segundos más despacio');
  const a = llano(1); a.obstaculos = [{ x: a.x + 6, tipo: 'pico', w: 1.4, h: 1.3, plano: 0.1, pasado: false }]; a.potenciadores = [{ x: a.x + 1, y: 0.5, tipo: 'aullido', cogido: false }];
  for (let k = 0; k < 120; k++) avanzar(a, 1 / 60);
  check(a.obstaculos[0].apartado && a.obstaculos[0].pasado && a.tropiezos === 0 && a.saltados === 1, 'el aullido aparta lo siguiente: se pasa sin saltar y cuenta como saltado');
  // Uno por etapa como mucho; dos de cada tres etapas llevan
  let con = 0, mas = 0;
  for (let sem = 1; sem <= 60; sem++) { const e = nuevaEtapa(sem, { variedad: true }); let vistos = 0; while (e.x < 600) { e.inmune = 9; avanzar(e, 0.1); vistos = Math.max(vistos, e.potenciadores.length); } if (e.potPuesto) con++; if (vistos > 1) mas++; }
  check(con > 30 && con < 52 && mas === 0, `uno por etapa como mucho (${con} de 60 etapas llevan uno)`);
}

console.log('\nTanda 2 · los momentos raros');
{
  const e = nuevaEtapa(3, { variedad: true });
  const vistos = new Set(); let ciervos = 0, puente = null;
  while (e.x < MOMENTO_CADA * 3 + 300) {
    e.inmune = 9;
    for (const m of e.momentos) vistos.add(m.tipo);
    for (const o of e.obstaculos) if (o.tipo === 'ciervo' && !o.contado) { o.contado = true; ciervos++; }
    if (!puente) puente = e.obstaculos.find((o) => o.tipo === 'rio' && o.momento) && e.cornisas.find((c) => c.puente);
    avanzar(e, 0.1);
  }
  check(vistos.has('estampida') && vistos.has('tormenta') && vistos.has('puente') && ciervos === 3 && puente, `cada ${MOMENTO_CADA} m, un momento: estampida (${ciervos} ciervos), tormenta y puente colgante`);
  const r = resultado(e);
  check(r.momentos.includes('estampida') && Array.isArray(r.potenciadores) && typeof r.arriba === 'number', 'y quedan en el resultado de la etapa');
}

console.log('\nTanda 2 · el primer kilómetro que enseña');
{
  const e = nuevaEtapa(4, { tutorial: true });
  const tres = [];
  while (tres.length < 3) { e.inmune = 9; for (const o of e.obstaculos) if (!tres.includes(o)) tres.push(o); avanzar(e, 0.1); }
  check(tres.map((o) => o.tipo).join() === 'roca,pico,monte' && tres.every((o) => o.pista) && /doble/i.test(tres[2].pista), 'los tres primeros enseñan: saltar, otro salto y doble salto (con su letrero)');
  const huecos = tres.slice(1).map((o, i) => (o.x - o.w / 2) - (tres[i].x + tres[i].w / 2));
  check(huecos.every((h) => h >= 14), `con más sitio entre uno y otro (${huecos.map((h) => h.toFixed(1)).join(', ')} m)`);
  const r = nuevaEtapa(4, { movimientos: true, km0: 1100 }); let rama = null;
  while (!rama && r.x < 3000) { r.inmune = 9; rama = r.obstaculos.find((o) => o.tipo === 'rama'); avanzar(r, 0.1); }
  check(rama?.pista && /agáchate/i.test(rama.pista), 'la primera rama, también: «Desliza abajo: agáchate»');
}

console.log('\nTanda 2 · se puede jugar sin tropezar');
{
  for (const sem of [5, 9, 13]) {
    const e = nuevaEtapa(sem, { variedad: true, km0: MOMENTO_CADA / 2 - 200 });
    jugarSolo(e, 120);
    check(e.tropiezos === 0 && e.x > 800, `semilla ${sem}: dos minutos con cuestas, cornisas y momentos raros, ${Math.round(e.x)} m sin tropezar`);
  }
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
