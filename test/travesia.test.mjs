// «La travesía», el juego del descanso: el juego sin pantalla (logica/travesia.js). Uso: node test/travesia.test.mjs
import {
  nuevaEtapa, avanzar, saltar, resultado, perfil, azar, textoDistancia, limpiarTravesia, sumarEtapa, TRAVESIA_VACIA,
  OBSTACULOS, LOBO, V_BASE, V_MAX, V_SALTO, GRAVEDAD,
} from '../web/src/logica/travesia.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

// Un jugador de prueba que ve el futuro: copia la etapa (sin generar más terreno) y prueba si, saltando ahora y dando el
// segundo salto en algún momento, pasa el obstáculo que viene. Salta en el primer cuadro en el que hay una manera.
const DT = 1 / 60;
const copia = (e) => ({ ...e, rnd: () => 0.5, hasta: Infinity, obstaculos: e.obstaculos.map((o) => ({ ...o })), estrellas: [], sucesos: [] });
function pasaCon(e, o, doble) {
  const c = copia(e);
  const mio = c.obstaculos.find((q) => q.x === o.x);
  saltar(c);
  for (let i = 0; i < 240; i++) {
    if (doble != null && c.saltos === 1 && i * DT >= doble) saltar(c);
    avanzar(c, DT);
    if (c.tropiezos > e.tropiezos) return false;
    if (mio.pasado) return true;
    if (c.saltos === 0 && c.x + LOBO.medio < mio.x - mio.w / 2) return false;   // cayó antes de llegar
  }
  return false;
}
function jugarSolo(e, segundos) {
  const fin = e.t + segundos;
  let plan = null;   // { en: momento del segundo salto }
  while (e.t < fin) {
    if (e.saltos === 0 && e.tropiezo === 0) {
      plan = null;
      const o = e.obstaculos.find((q) => !q.pasado && !q.chocado);
      if (o && o.x - e.x < 9) {
        const dobles = [null, 0.12, 0.2, 0.28, 0.36, 0.44];
        const d = dobles.find((q) => pasaCon(e, o, q));
        if (d !== undefined) { saltar(e); plan = d == null ? null : { en: e.t + d }; }
      }
    } else if (plan && e.saltos === 1 && e.t >= plan.en) { saltar(e); plan = null; }
    avanzar(e, DT);
  }
  return e;
}

console.log('La etapa sale de su semilla');
{
  const a = nuevaEtapa(42), b = nuevaEtapa(42), c = nuevaEtapa(43);
  const toques = [0.8, 1.9, 2.0, 3.4, 5.1, 6.6, 6.75, 8.2];
  for (const e of [a, b, c]) { let i = 0; while (e.t < 10) { if (i < toques.length && e.t >= toques[i]) { saltar(e); i++; } avanzar(e, 1 / 60); } }
  check(a.x === b.x && a.estrellasCogidas === b.estrellasCogidas && a.tropiezos === b.tropiezos && JSON.stringify(a.obstaculos) === JSON.stringify(b.obstaculos), 'misma semilla y mismos toques: la misma etapa, al milímetro');
  check(JSON.stringify(a.obstaculos.map((o) => o.x)) !== JSON.stringify(c.obstaculos.map((o) => o.x)), 'otra semilla, otro terreno');
  const r = azar(7); const xs = Array.from({ length: 1000 }, r);
  check(xs.every((v) => v >= 0 && v < 1) && Math.abs(xs.reduce((s, v) => s + v, 0) / 1000 - 0.5) < 0.05, 'el azar con semilla da números entre 0 y 1, bien repartidos');
}

console.log('El terreno');
{
  const e = nuevaEtapa(5);
  check(e.obstaculos[0].x - e.obstaculos[0].w / 2 >= 14 + 7.5, `los primeros metros, despejados (el primer obstáculo, a ${e.obstaculos[0].x.toFixed(1)} m)`);
  // 3 km de terreno sin jugar: huecos y tipos
  while (e.x < 3000) avanzar(e, 0.1);
  const g = nuevaEtapa(5); const todos = []; let ultimo = -1;
  while (g.x < 3000) { for (const o of g.obstaculos) if (o.x > ultimo) { todos.push({ ...o }); ultimo = o.x; } avanzar(g, 0.1); }
  const huecos = todos.slice(1).map((o, i) => (o.x - o.w / 2) - (todos[i].x + todos[i].w / 2));
  check(Math.min(...huecos) >= 7.49 && Math.max(...huecos) <= 17.01, `entre dos obstáculos, de ${Math.min(...huecos).toFixed(1)} a ${Math.max(...huecos).toFixed(1)} m: da para caer y volver a saltar`);
  const tipos = todos.reduce((m, o) => ({ ...m, [o.tipo]: (m[o.tipo] || 0) + 1 }), {});
  check(tipos.roca > 60 && tipos.pico > 60 && tipos.monte > 15 && tipos.monte < tipos.pico, `rocas, picos y algún monte (${tipos.roca}, ${tipos.pico}, ${tipos.monte})`);
  check(todos.filter((o) => o.tipo === 'monte').every((o) => o.x > OBSTACULOS.monte.desde), `los montes (piden doble salto) no salen en los primeros ${OBSTACULOS.monte.desde} m`);
  check(e.obstaculos.length < 12 && e.estrellas.length < 12, `lo que queda atrás se suelta (en memoria, ${e.obstaculos.length} obstáculos y ${e.estrellas.length} estrellas)`);
  const o = { x: 10, ...OBSTACULOS.pico };
  check(perfil(o, 10) === o.h && perfil(o, 10.01 + o.w / 2) === 0 && perfil(o, 9) === 0 && perfil(o, 10.3) < o.h && perfil(o, 10.3) > 0, 'la silueta: arriba en el centro, en cuesta a los lados, nada fuera');
}

console.log('Saltar');
{
  const e = nuevaEtapa(1);
  check(saltar(e) && e.saltos === 1 && e.vy === V_SALTO, 'un toque en el suelo: salta');
  let alto = 0; for (let i = 0; i < 20; i++) { avanzar(e, 1 / 60); alto = Math.max(alto, e.y); }
  check(saltar(e) && e.saltos === 2 && !saltar(e), 'otro en el aire: el doble salto, y ni uno más');
  while (e.saltos) { avanzar(e, 1 / 60); alto = Math.max(alto, e.y); }
  check(e.y === 0 && e.vy === 0 && saltar(e), 'al caer, puede volver a saltar');
  const s = nuevaEtapa(1); saltar(s); let t = 0, cima = 0; while (s.saltos) { avanzar(s, 1 / 120); t += 1 / 120; cima = Math.max(cima, s.y); }
  check(Math.abs(cima - (V_SALTO ** 2) / (2 * GRAVEDAD)) < 0.06 && Math.abs(t - (2 * V_SALTO) / GRAVEDAD) < 0.03, `el salto sube ${cima.toFixed(2)} m y dura ${t.toFixed(2)} s`);
  check(alto > cima + 0.6, `con el doble llega más alto (${alto.toFixed(2)} m)`);
}

console.log('Tropezar no acaba la etapa');
{
  const e = nuevaEtapa(3);
  while (e.t < 60) avanzar(e, 1 / 60);
  check(e.tropiezos > 10 && e.x > 150 && e.racha === 0 && e.saltados === 0, `sin tocar la pantalla un minuto: tropieza con todo (${e.tropiezos}) y aun así avanza ${Math.round(e.x)} m`);
  const q = nuevaEtapa(3);
  while (!q.tropiezos) avanzar(q, 1 / 60);
  check(q.tropiezo > 0 && !saltar(q) && q.sucesos.includes('tropiezo'), 'al tropezar, un momento sin poder saltar');
  const v0 = q.v; for (let i = 0; i < 20; i++) avanzar(q, 1 / 60);
  check(q.v < v0 && q.v < V_BASE, `y pierde el ritmo (de ${v0.toFixed(1)} a ${q.v.toFixed(1)} m/s)`);
  const x0 = q.x; for (let i = 0; i < 600; i++) avanzar(q, 1 / 60);
  check(q.x > x0 + 30, 'después sigue corriendo');
  const c = nuevaEtapa(9); for (let i = 0; i < 30; i++) avanzar(c, 5);   // cuadros lentísimos
  check(Number.isFinite(c.x) && c.x < 30 * 0.25 * V_MAX + 1, 'un cuadro muy lento (la app en segundo plano) no da un salto de kilómetros');
}

console.log('Todo lo que sale se puede saltar');
{
  let tropiezos = 0, peor = 0, metros = [], estrellas = 0, rachaMax = 0;
  for (let s = 1; s <= 40; s++) {
    const e = jugarSolo(nuevaEtapa(s * 977), 180);
    tropiezos += e.tropiezos; peor = Math.max(peor, e.tropiezos); metros.push(e.x); estrellas += e.estrellasCogidas; rachaMax = Math.max(rachaMax, e.mejorRacha);
  }
  check(tropiezos === 0, `un jugador perfecto no tropieza nunca en 40 etapas de 3 minutos (${tropiezos} tropiezos; la peor, ${peor})`);
  const media = metros.reduce((a, b) => a + b, 0) / metros.length;
  check(media > 1700 && media < 180 * V_MAX, `y en 3 minutos recorre unos ${Math.round(media)} m (va cogiendo ritmo hasta ${V_MAX} m/s)`);
  check(estrellas / 40 > 15, `cogiendo estrellas por el camino (${Math.round(estrellas / 40)} de media)`);
  check(rachaMax > 100, `con rachas largas (${rachaMax} seguidos)`);
  const e = jugarSolo(nuevaEtapa(11), 30);
  check(e.v > V_BASE + 1.5 && e.v <= V_MAX, `saltando seguido corre más (${e.v.toFixed(1)} m/s a los 30 s)`);
  const r = resultado(e);
  check(Number.isInteger(r.metros) && r.metros === Math.round(e.x) && r.estrellas === e.estrellasCogidas && r.racha === e.mejorRacha, 'el resultado: metros enteros, estrellas y la mejor racha');
}

console.log('La distancia, en palabras');
check(textoDistancia(0) === '0 m' && textoDistancia(870.4) === '870 m' && textoDistancia(999) === '999 m', '«870 m»');
check(textoDistancia(1000) === '1 km' && textoDistancia(2340) === '2,3 km' && textoDistancia(9960) === '10 km' && textoDistancia(12400) === '12 km', '«2,3 km», «12 km»');
check(textoDistancia(-5) === '0 m' && textoDistancia('x') === '0 m' && textoDistancia(null) === '0 m', 'lo que no es una distancia, «0 m»');

console.log('Lo que se recuerda en el móvil');
{
  let t = sumarEtapa(null, { sesion: 's1', metros: 800, estrellas: 5 });
  t = sumarEtapa(t, { sesion: 's1', metros: 950.4, estrellas: 7 });
  check(t.total === 1750 && t.estrellas === 12 && t.mejor === 950 && t.sesiones.s1.metros === 1750 && t.sesiones.s1.etapas === 2, 'dos etapas de una sesión: se suman en la sesión y en el total; la mejor etapa');
  const p = sumarEtapa(t, { metros: 400, estrellas: 3 });
  check(p.total === 1750 && p.estrellas === 12 && p.practica === 400 && sumarEtapa(p, { metros: 300 }).practica === 400, 'el modo práctica no suma: solo guarda su mejor marca');
  let m = t; for (let i = 0; i < 20; i++) m = sumarEtapa(m, { sesion: `x${i}`, metros: 100 });
  check(Object.keys(m.sesiones).length === 12 && !m.sesiones.s1 && m.sesiones.x19 && m.total === 1750 + 2000, 'solo se guardan las 12 últimas sesiones; el total no se pierde');
  const l = limpiarTravesia({ total: 'mucho', estrellas: -4, mejor: 1e12, sesiones: { a: { metros: 'x' }, b: null, c: { metros: 12.6, estrellas: 2, etapas: 1 } }, otra: 1 });
  check(l.total === 0 && l.estrellas === 0 && l.mejor === 1e5 && l.sesiones.a.metros === 0 && !l.sesiones.b && l.sesiones.c.metros === 13 && !('otra' in l), 'lo guardado ilegible o absurdo se sanea');
  check(JSON.stringify(limpiarTravesia('roto')) === JSON.stringify(TRAVESIA_VACIA()) && JSON.stringify(limpiarTravesia(undefined)) === JSON.stringify(TRAVESIA_VACIA()), 'y sin nada guardado, vacía');
  const antes = JSON.stringify(t); sumarEtapa(t, { sesion: 's2', metros: 5 });
  check(JSON.stringify(t) === antes, 'sumar no cambia lo que se le pasa (devuelve otro)');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
