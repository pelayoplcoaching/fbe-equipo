// «La travesía», el juego del descanso: el juego sin pantalla (logica/travesia.js). Uso: node test/travesia.test.mjs
import {
  nuevaEtapa, avanzar, saltar, agachar, pulsar, resultado, perfil, azar, textoDistancia, limpiarTravesia, sumarEtapa, TRAVESIA_VACIA,
  OBSTACULOS, LOBO, V_BASE, V_MAX, V_SALTO, GRAVEDAD, V_CALMA, CADA_RIO, retoDelDia, progresoReto, hoyDe, RETOS, faseLuna, climaDe, ambiente,
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
      if (o && o.tipo === 'rama') { if (e.agachado < 0.3 && o.x - o.w / 2 - (e.x + LOBO.medio) < 0.5) agachar(e); }
      else if (o && o.x - e.x < 9) {
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
  // (para medir el terreno tal cual: sin tropezar, que afloja la dificultad, y sin racha, que la aprieta)
  const g = nuevaEtapa(5); const todos = []; let ultimo = -1;
  while (g.x < 3000) { g.inmune = 9; g.racha = 0; g.reto = 0; for (const o of g.obstaculos) if (o.x > ultimo) { todos.push({ ...o }); ultimo = o.x; } avanzar(g, 0.1); }
  const huecos = todos.slice(1).map((o, i) => (o.x - o.w / 2) - (todos[i].x + todos[i].w / 2));
  check(Math.min(...huecos) >= 7.49 && Math.max(...huecos) <= 18.51, `entre dos obstáculos, de ${Math.min(...huecos).toFixed(1)} a ${Math.max(...huecos).toFixed(1)} m: da para caer y volver a saltar`);
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
  check(media > 1700 && media < 180 * (V_MAX + 1), `y en 3 minutos recorre unos ${Math.round(media)} m (va cogiendo ritmo hasta ${V_MAX} m/s, y uno más si va sobrado)`);
  check(estrellas / 40 > 15, `cogiendo estrellas por el camino (${Math.round(estrellas / 40)} de media)`);
  check(rachaMax > 100, `con rachas largas (${rachaMax} seguidos)`);
  const e = jugarSolo(nuevaEtapa(11), 30);
  check(e.v > V_BASE + 1.5 && e.v <= V_MAX + 1, `saltando seguido corre más (${e.v.toFixed(1)} m/s a los 30 s)`);
  const r = resultado(e);
  check(Number.isInteger(r.metros) && r.metros === Math.round(e.x) && r.estrellas === e.estrellasCogidas && r.racha === e.mejorRacha, 'el resultado: metros enteros, estrellas y la mejor racha');
}

console.log('(tanda 1) El río, cada kilómetro de travesía');
{
  const g = nuevaEtapa(8, { km0: 600 }); const rios = []; let ultimo = -1;
  while (g.x < 2600) { g.inmune = 9; g.racha = 0; for (const o of g.obstaculos) if (o.x > ultimo) { if (o.tipo === 'rio') rios.push(o.x); ultimo = o.x; } avanzar(g, 0.1); }
  check(rios.length === 3 && rios.every((x, i) => Math.abs(600 + x - (i + 1) * CADA_RIO) < 60), `con 600 m ya hechos, el primer río llega a los ${Math.round(rios[0])} m de la etapa (el km 1 de su travesía) y después uno por kilómetro`);
  const e = jugarSolo(nuevaEtapa(21, { km0: 900 }), 60);
  check(e.rios >= 1 && e.tropiezos === 0 && resultado(e).rios === e.rios, `el jugador perfecto lo cruza (${e.rios}) y cuenta en el resultado`);
  const sin = nuevaEtapa(8); let hay = false; while (sin.x < 800) { sin.inmune = 9; if (sin.obstaculos.some((o) => o.tipo === 'rio')) hay = true; avanzar(sin, 0.1); }
  check(!hay, 'en los primeros 800 m de una travesía nueva no hay río');
}

console.log('(tanda 1) Las ramas: agacharse');
{
  let ramas = 0, trop = 0, sinMov = 0;
  for (let s = 1; s <= 12; s++) {
    const e = jugarSolo(nuevaEtapa(s * 131, { movimientos: true }), 150); trop += e.tropiezos;
    const g = nuevaEtapa(s * 131, { movimientos: true }); while (g.x < 1500) { g.inmune = 9; g.racha = 0; avanzar(g, 0.1); ramas += g.obstaculos.filter((o) => o.tipo === 'rama' && !o.contada && (o.contada = true)).length; }
    const n = nuevaEtapa(s * 131); while (n.x < 1500) { n.inmune = 9; avanzar(n, 0.1); sinMov += n.obstaculos.filter((o) => o.tipo === 'rama').length; }
  }
  check(ramas > 20 && sinMov === 0, `con «movimientos» salen ramas (${ramas} en 12 etapas); sin ellos, ninguna`);
  check(trop === 0, `agachándose a tiempo, el jugador perfecto no tropieza (${trop})`);
  const e = nuevaEtapa(3, { movimientos: true });
  e.obstaculos = [{ x: 20, tipo: 'rama', ...OBSTACULOS.rama, pasado: false }]; e.estrellas = []; e.hasta = 1e9;
  while (e.x < 26) avanzar(e, 1 / 60);
  check(e.tropiezos === 1, 'de pie, la rama da en la cabeza');
  const a = nuevaEtapa(3, { movimientos: true });
  a.obstaculos = [{ x: 20, tipo: 'rama', ...OBSTACULOS.rama, pasado: false }]; a.estrellas = []; a.hasta = 1e9;
  while (a.x < 26) { if (a.x > 18.2 && a.agachado === 0 && a.x < 19) agachar(a); avanzar(a, 1 / 60); }
  check(a.tropiezos === 0 && a.saltados === 1, 'agachado, pasa por debajo');
  const j = nuevaEtapa(3); saltar(j); for (let i = 0; i < 20; i++) avanzar(j, 1 / 60);
  check(!agachar(j) && j.agachado === 0 && j.saltos === 1, 'en pleno salto no se agacha');
  const k2 = nuevaEtapa(3); saltar(k2); avanzar(k2, 1 / 60);
  check(agachar(k2) && k2.saltos === 0 && k2.y === 0 && k2.agachado > 0, 'si el dedo toca y baja enseguida, el salto recién empezado se deshace y se agacha');
  agachar(k2); saltar(k2);
  check(k2.agachado === 0 && k2.saltos === 1, 'y al saltar se levanta');
}

console.log('(tanda 1) El entreno empuja: ritmo de salida y escudos');
{
  const n = nuevaEtapa(4), r = nuevaEtapa(4, { racha0: 10 });
  check(n.v === V_BASE && r.v > V_BASE + 1.5 && r.racha === 10 && nuevaEtapa(4, { racha0: 999 }).racha === 18, `tras un récord sale con el ritmo cogido (${r.v.toFixed(1)} m/s en vez de ${n.v})`);
  const e = nuevaEtapa(3, { escudos: 1 });
  while (e.escudosUsados === 0 && e.t < 30) avanzar(e, 1 / 60);
  const v1 = e.v;
  check(e.escudos === 0 && e.escudosUsados === 1 && e.tropiezos === 0 && e.tropiezo === 0 && e.sucesos.includes('escudo') && v1 >= V_BASE - 0.01, 'con un escudo, el primer tropiezo se perdona: ni frena ni cuenta');
  while (e.tropiezos === 0 && e.t < 60) avanzar(e, 1 / 60);
  check(e.tropiezos === 1, 'el segundo ya no');
  check(nuevaEtapa(1, { escudos: 9 }).escudos === 3 && nuevaEtapa(1, { escudos: -2 }).escudos === 0, 'como mucho tres escudos');
}

console.log('(tanda 1) La dificultad se adapta');
{
  const e = nuevaEtapa(3);
  while (e.t < 45) avanzar(e, 1 / 60);
  check(e.ayuda >= 0.34 && e.tropiezos >= 3, `tres tropiezos en medio minuto y afloja (ayuda ${e.ayuda.toFixed(2)})`);
  const lejos = e.obstaculos.filter((o) => o.x > e.x + 20);
  const s = jugarSolo(nuevaEtapa(5), 120);
  check(s.reto > 0 && s.tropiezos === 0, `si va sobrado (25 seguidos), aprieta un punto (reto ${s.reto}) y sigue siendo saltable`);
  const f = nuevaEtapa(9); f.ayuda = 1; f.hasta = 200; f.obstaculos = []; avanzar(f, 0.01);
  while (f.x < 900) { f.inmune = 9; f.racha = 0; f.ayuda = 1; avanzar(f, 0.1); }
  check(!f.obstaculos.some((o) => o.tipo === 'monte') && lejos.length >= 0, 'con la ayuda a tope no salen montes');
}

console.log('(tanda 1) Mantener pulsado y el modo calma');
{
  const largo = (pulsa) => { const e = nuevaEtapa(1); e.obstaculos = []; e.hasta = 1e9; pulsar(e, pulsa); saltar(e); const x0 = e.x; let alto = 0; while (e.saltos) { avanzar(e, 1 / 120); alto = Math.max(alto, e.y); } return [e.x - x0, alto]; };
  const [c, ac] = largo(false), [l, al] = largo(true);
  check(l > c * 1.2 && al > ac * 1.3, `mantener pulsado alarga el salto (de ${c.toFixed(1)} a ${l.toFixed(1)} m; sube ${al.toFixed(1)} m)`);
  const k = nuevaEtapa(6, { calma: true, escudos: 2, racha0: 9 });
  while (k.t < 60) avanzar(k, 1 / 60);
  check(k.obstaculos.length === 0 && k.tropiezos === 0 && Math.abs(k.x - 60 * V_CALMA) < 1 && k.estrellasCogidas > 5 && !saltar(k) && !agachar(k) && resultado(k).calma === true, `en calma no hay obstáculos: va al paso (${Math.round(k.x)} m en un minuto) y coge estrellas (${k.estrellasCogidas})`);
  const r = resultado(jugarSolo(nuevaEtapa(2), 20));
  check(r.segundos === 20 && r.tropiezos === 0 && r.rios === 0 && r.calma === false, 'el resultado trae también los segundos, los tropiezos y los ríos');
}

console.log('(tanda 1) El reto del día, el ritmo y lo de hoy');
{
  const d = '2026-11-12';
  check(retoDelDia(d).id === retoDelDia(d).id && new Set(['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16'].map((x) => retoDelDia(x).id)).size === RETOS.length && retoDelDia('mal').id === RETOS[0].id, 'un reto distinto cada día, el mismo para todos; en cinco días salen los cinco');
  let t = sumarEtapa(null, { sesion: 's', metros: 500, estrellas: 5, segundos: 60, tropiezos: 0, dia: d });
  t = sumarEtapa(t, { sesion: 's', metros: 700, estrellas: 8, segundos: 90, tropiezos: 2, rios: 1, dia: d });
  const h = hoyDe(t, d);
  check(h.metros === 1200 && h.estrellas === 13 && h.etapas === 2 && h.limpias === 1 && h.mejor === 700 && h.rios === 1 && t.rios === 1, 'lo de hoy: metros, estrellas, etapas, las limpias, la mejor y los ríos');
  check(t.ritmo === 833, `su mejor ritmo (${t.ritmo / 100} m/s), de las etapas de medio minuto o más`);
  check(sumarEtapa(t, { sesion: 's', metros: 300, segundos: 10, dia: d }).ritmo === 833 && sumarEtapa(t, { sesion: 's', metros: 900, segundos: 60, calma: true, dia: d }).ritmo === 833, 'una etapa muy corta o en calma no lo cambia');
  const lejos = RETOS.find((r) => r.id === 'lejos'), est = RETOS.find((r) => r.id === 'estrellas');
  check(progresoReto(lejos, h).hecho && progresoReto(lejos, h).valor === 600 && progresoReto(est, h).hecho && !progresoReto(RETOS.find((r) => r.id === 'etapas'), h).hecho, 'el progreso de cada reto con lo de hoy (sin pasarse de la meta)');
  // el día cuyo reto es «lejos»
  const dl = ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16'].find((x) => retoDelDia(x).id === 'lejos');
  let r = sumarEtapa(null, { sesion: 's', metros: 400, segundos: 60, tropiezos: 1, dia: dl });
  check(!r.hoy.retoHecho && r.retos === 0, 'sin llegar, el reto sigue abierto');
  r = sumarEtapa(r, { sesion: 's', metros: 650, segundos: 70, tropiezos: 0, dia: dl });
  const r2 = sumarEtapa(r, { sesion: 's', metros: 800, segundos: 80, tropiezos: 0, dia: dl });
  check(r.hoy.retoHecho && r.retos === 1 && r2.retos === 1, 'al llegar queda hecho y cuenta una vez');
  const otro = sumarEtapa(r2, { sesion: 's', metros: 100, segundos: 30, dia: '2026-12-01' });
  check(otro.hoy.dia === '2026-12-01' && otro.hoy.metros === 100 && !otro.hoy.retoHecho && otro.retos === 1 && hoyDe(r2, '2026-12-01').metros === 0, 'al día siguiente, la cuenta de hoy empieza de cero');
  check(sumarEtapa(null, { metros: 900, segundos: 60, dia: d }).hoy.dia === '' , 'la práctica no cuenta para el reto');
  check(limpiarTravesia({ hoy: { dia: 'x', metros: 5 }, ritmo: 99999, retos: 'a' }).hoy.dia === '' && limpiarTravesia({ ritmo: 99999 }).ritmo === 1500, 'lo guardado ilegible se sanea');
}

console.log('(tanda 1) El cielo de verdad');
{
  const llena = faseLuna(Date.UTC(2026, 10, 24, 14, 53)), nueva = faseLuna(Date.UTC(2026, 10, 9, 7, 2));
  check(llena.ilum > 0.97 && nueva.ilum < 0.03, `la luna: llena el 24 de noviembre de 2026 (${llena.ilum.toFixed(2)}) y nueva el 9 (${nueva.ilum.toFixed(2)})`);
  check(faseLuna(Date.UTC(2026, 10, 16)).creciente && !faseLuna(Date.UTC(2026, 10, 30)).creciente, 'creciente entre la nueva y la llena; menguante después');
  check(climaDe(63) === 'lluvia' && climaDe(81) === 'lluvia' && climaDe(73) === 'nieve' && climaDe(86) === 'nieve' && climaDe(45) === 'niebla' && climaDe(96) === 'tormenta' && climaDe(2) === null && climaDe(null) === null && climaDe('x') === null, 'lo que cae, del código del tiempo');
  check(ambiente({ hora: 23 }).fase === 'noche' && ambiente({ hora: 7 }).fase === 'alba' && ambiente({ hora: 13 }).fase === 'dia' && ambiente({ hora: 20 }).fase === 'ocaso', 'el cielo, según la hora');
  check(ambiente({ hora: 17, esDia: false }).fase === 'ocaso' && ambiente({ hora: 19, esDia: false }).fase === 'noche', 'y si la previsión dice que ya no es de día (invierno), se adelanta');
  check(ambiente({ total: 0 }).paisaje === 0 && ambiente({ total: 5200 }).paisaje === 1 && ambiente({ total: 12000 }).paisaje === 2 && ambiente({ total: 16000 }).paisaje === 3 && ambiente({ total: 21000 }).paisaje === 0, 'el paisaje cambia cada 5 km: montaña, bosque, nieve, amanecer y vuelta');
  check(ambiente({ total: 12000, hora: 13 }).clima === 'nieve' && ambiente({ total: 16000, hora: 23 }).fase === 'alba' && ambiente({ codigo: 63, hora: 13 }).clima === 'lluvia', 'en la nieve, nieva; en el amanecer, amanece; y si fuera llueve, llueve');
}

console.log('(tanda 3) El mapa y las postales');
{
  const R = await import('../web/src/logica/travesia-ruta.js');
  const p0 = R.posicionEnRuta(0);
  check(p0.ruta.id === 'mieres-madrid' && p0.km === 0 && p0.anterior[0] === 'Mieres' && p0.siguiente[0] === 'Pola de Lena' && p0.faltan === 12 && p0.pasados === 1, 'la travesía sale de Mieres; lo siguiente, Pola de Lena, a 12 km');
  const p1 = R.posicionEnRuta(40500);
  check(p1.km === 40.5 && p1.anterior[0] === 'Puerto de Pajares' && p1.siguiente[0] === 'La Robla' && p1.faltan === 44.5 && Math.abs(p1.pct - 0.09) < 0.001, 'con 40,5 km: pasado Pajares, camino de La Robla');
  const p2 = R.posicionEnRuta(450000), p3 = R.posicionEnRuta(460000);
  check(p2.ruta.id === 'madrid-valencia' && p2.km === 0 && p3.km === 10 && p3.n === 1 && p3.siguiente[0] === 'Arganda', 'al llegar a Madrid empieza la ruta a Valencia');
  const fin = R.posicionEnRuta((450 + 355 + 350) * 1000 + 5000);
  // (remate, tanda 6: tras Barcelona ya no se vuelve a empezar; siguen las rutas nuevas)
  check(fin.ruta.id === 'picos' && fin.n === 3 && fin.km === 5 && R.posicionEnRuta((450 + 355 + 350) * 1000 + 5000, ['camino']).ruta.id === 'camino', 'y tras Barcelona, la ruta nueva que se elija (sin elegir, los Picos de Europa)');
  check(R.RUTAS.every((r) => r.hitos[0][1] === 0 && r.hitos.every(([, k], i) => i === 0 || k > r.hitos[i - 1][1])), 'los hitos de cada ruta van en orden');
  const post = R.postales(40500);
  check(post.length === 3 && post[0].lugar === 'Puerto de Pajares' && post[2].lugar === 'Mieres' && post.every((x) => /^mes-(0[1-9]|1[0-2])$/.test(x.imagen)), 'una postal por hito alcanzado, la última primero, con su ilustración');
  check(R.postales(460000).length === 10 && R.postales(460000)[0].lugar === 'Madrid' && R.postales(480000)[0].lugar === 'Arganda' && R.postales(480000).length === 11 && new Set(R.postales(480000).map((x) => x.id)).size === 11, 'la llegada de una ruta es la salida de la siguiente (una sola postal)');
  check(R.textoRuta(p0) === 'Tu lobo sale de Mieres. Lo primero, Pola de Lena, a 12 km.' && R.textoRuta(p1) === 'Va por el km 40,5 de 450: pasado Puerto de Pajares, a 44,5 km de La Robla.', 'dónde va, en una frase');
  check(R.textoParaCompartir({ total: 40500, estrellas: 47 }) === 'Mi lobo lleva 40,5 km en La travesía (de Mieres a Madrid): ha pasado Puerto de Pajares y va camino de La Robla. 47 estrellas por el camino. Avanza solo cuando entreno.' && R.textoParaCompartir(null) === '', 'y para contarlo fuera');
  const nuevas = R.postalesNuevas(11000, 39000);
  check(nuevas.map((x) => x.lugar).join() === 'Puerto de Pajares,Pola de Lena' && R.postalesNuevas(39000, 39500).length === 0, 'las postales nuevas de una etapa');
}

console.log('(tanda 3) Los lobos, las constelaciones y la manada');
{
  const R = await import('../web/src/logica/travesia-ruta.js');
  const l0 = R.lobosDe(null), l1 = R.lobosDe({ total: 26000, estrellas: 120, retos: 5, rios: 2 });
  check(l0.filter((x) => x.tiene).map((x) => x.id).join() === 'tiza' && l1.filter((x) => x.tiene).map((x) => x.id).join() === 'tiza,lavanda,oro,nieve', 'los lobos se van ganando: con 26 km y 5 retos, el lavanda, el dorado y el de nieve');
  check(R.loboElegido(l1 && { total: 26000, retos: 5 }, 'oro').id === 'oro' && R.loboElegido({ total: 100 }, 'oro').id === 'tiza' && R.loboElegido(null, 'no-existe').id === 'tiza', 'el elegido, si lo tiene; si no, el de tiza');
  check(R.LOBOS.every((l) => /^#[0-9A-F]{6}$/i.test(l.claro) && /^#[0-9A-F]{6}$/i.test(l.sombra)) && new Set(R.LOBOS.map((l) => l.id)).size === R.LOBOS.length, 'cada lobo, con sus dos colores');
  const c0 = R.constelaciones(0), c1 = R.constelaciones(47);
  check(c0.every((c) => !c.completa && c.cogidas === 0) && c1[0].completa && c1[0].total === 40 && c1[1].estrellas === 7 && c1[1].cogidas === 1 && !c1[1].completa && R.constelacionesCompletas(47) === 1, 'las estrellas completan constelaciones en orden: la primera con 40; con 47, una estrella de la segunda');
  check(R.constelaciones(1e6).every((c) => c.completa) && R.CONSTELACIONES.every((c) => c.lineas.every(([a, b]) => a < c.puntos.length && b < c.puntos.length) && c.puntos.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1)), 'todas se pueden completar y sus líneas unen puntos que existen');
  check(R.manadaPropia(0) === 0 && R.manadaPropia(3) === 3 && R.manadaPropia(9) === 4 && R.manadaPropia(null) === 0, 'tu manada: un lobo por semana completa seguida, hasta cuatro');
  const filas = [{ nombre: 'Fer M.', metros: 3000, hoy: true }, { nombre: 'Ana L.', metros: 1200, yo: true, hoy: true }, { nombre: 'Gus R.', metros: 800, hoy: false }];
  check(R.miPuesto(filas) === 2 && R.miPuesto([]) === null && R.correnHoy(filas).join() === 'Fer M.', 'mi puesto en la semana y quién más ha corrido hoy');
  check(R.duelo(filas, 'Gus R.', 2000).yo === 2000 && R.duelo(filas, 'Gus R.', 100).yo === 1200, 'en el duelo, lo mío es lo que más lleve: el móvil o la base');
  const d = R.duelo(filas, 'Fer M.');
  check(d.yo === 1200 && d.el === 3000 && d.diferencia === -1800 && !d.gano && R.duelo(filas, 'Gus R.').gano && R.duelo(filas, 'Nadie') === null && R.duelo(filas, 'Ana L.') === null, 'el duelo de la semana con un compañero');
  const eq = R.equipoDelMes({ metros: 30000, miembros: 5 });
  check(eq.meta === 75000 && Math.abs(eq.pct - 0.4) < 1e-9 && !eq.hecho && R.equipoDelMes({ metros: 60000, miembros: 2 }).hecho && R.equipoDelMes(null).meta === 50000, 'la travesía en equipo: 15 km por cabeza al mes (50 como poco)');
}

console.log('(tanda 3) Las semanas seguidas');
{
  const T = await import('../web/src/logica/travesia.js');
  let g = T.sumarEtapa(null, { sesion: 's1', metros: 300, dia: '2026-11-04' });
  g = T.sumarEtapa(g, { sesion: 's2', metros: 200, dia: '2026-11-06' });
  check(g.semanas['2026-11-02'] === 500 && T.rachaSemanas(g, '2026-11-08') === 1 && T.rachaSemanas(g, '2026-11-10') === 1 && T.rachaSemanas(g, '2026-11-17') === 0, 'los metros de la semana se guardan por su lunes; la racha aguanta la semana siguiente mientras no pase entera');
  g = T.sumarEtapa(g, { sesion: 's3', metros: 100, dia: '2026-11-11' });
  check(T.rachaSemanas(g, '2026-11-13') === 2, 'dos semanas seguidas');
  const b = T.conBase(g, [{ semana: '2026-10-26', metros: 900 }, { semana: '2026-10-12', metros: 400 }, { semana: '2026-11-02', metros: 100 }]);
  check(b.semanas['2026-10-26'] === 900 && b.semanas['2026-11-02'] === 500 && T.rachaSemanas(b, '2026-11-13') === 3, 'con las semanas de la base (la que más tenga), tres seguidas: la del 12 de octubre no enlaza');
  check(T.rachaSemanas(T.sumarEtapa(null, { metros: 300, dia: '2026-11-04' }), '2026-11-04') === 0 && T.rachaSemanas(null, '2026-11-04') === 0 && T.rachaSemanas(g, 'ayer') === 0, 'la práctica no cuenta, y sin nada no hay racha');
  let muchas = null;
  for (let i = 0; i < 14; i++) muchas = T.sumarEtapa(muchas, { sesion: `s${i}`, metros: 50, dia: T.limpiarTravesia && `2026-0${1 + Math.floor(i / 4)}-${String(5 + (i % 4) * 7).padStart(2, '0')}` });
  check(Object.keys(muchas.semanas).length === 10 && Object.keys(T.limpiarTravesia({ semanas: { mal: 5, '2026-11-02': -3, '2026-11-09': 7 } }).semanas).join() === '2026-11-09', 'solo se guardan las diez últimas, y lo ilegible se descarta');
}

console.log('(tanda 5) Los efectos, en números');
{
  const E = await import('../web/src/logica/travesia-efectos.js');
  check(E.dado(3, 1) === E.dado(3, 1) && E.dado(3, 1) !== E.dado(4, 1) && [0, 1, 2, 50, 999].every((n) => E.dado(n, 7) >= 0 && E.dado(n, 7) < 1), 'el dado: el mismo número siempre para lo mismo, entre 0 y 1');
  check(E.suave(0) === 0 && E.suave(1) === 1 && E.suave(0.5) === 0.5 && E.suave(-3) === 0 && E.suave(9) === 1 && E.suave(0.25) < 0.25, 'la curva suave sale despacio y llega despacio');
  // estrellas fugaces: en diez minutos, unas cuantas, cada una de menos de un segundo, dentro del cielo y avanzando
  let n = 0, antes = null, dentro = true, avanza = true, maxSeguidos = 0, seguidos = 0;
  for (let t = 0; t < 600; t += 0.05) {
    const f = E.fugaz(t, 5);
    if (f) { seguidos += 1; maxSeguidos = Math.max(maxSeguidos, seguidos); if (!antes) n += 1; else if (f.k < antes.k) n += 1; else avanza = avanza && f.x >= antes.x && f.y >= antes.y;
      dentro = dentro && f.x > 0 && f.x < 1.1 && f.y > 0 && f.y < 0.6 && f.k >= 0 && f.k <= 1; } else seguidos = 0;
    antes = f;
  }
  check(n >= 20 && n <= 50 && dentro && avanza && maxSeguidos <= Math.ceil(E.DURA_FUGAZ / 0.05) + 1, `en diez minutos cruzan ${n} estrellas fugaces, cada una en menos de un segundo`);
  check(E.fugaz(-1) === null && E.fugaz(NaN) === null && JSON.stringify(E.fugaz(37.2, 5)) === JSON.stringify(E.fugaz(37.2, 5)), 'y siempre las mismas para el mismo momento');
  const sube = E.estirar({ vy: 14, enAire: true }), cae = E.estirar({ vy: 0, enAire: false, desdeCaer: 0.11 }), quieto = E.estirar({ vy: 0, enAire: false, desdeCaer: 0.5 });
  check(sube.sx > 1 && sube.sx < 1.12 && cae.sx > 1.1 && cae.sy < 0.9 && cae.sy > 0.8 && quieto.sx === 1 && quieto.sy === 1 && E.estirar().sx === 1, 'el lobo se estira en el salto, se aplasta al caer (un 14 % como mucho) y vuelve');
  let parpadeos = 0, cerrado = 0, a = false;
  for (let t = 0; t < 60; t += 0.02) { const p = E.parpadea(t, 2); if (p && !a) parpadeos += 1; if (p) cerrado += 1; a = p; }
  check(parpadeos >= 12 && parpadeos <= 16 && cerrado * 0.02 < 2.5 && !E.parpadea(-1), `parpadea cada cuatro segundos más o menos (${parpadeos} veces en un minuto)`);
  check(E.colaAlViento({ fase: 0, vy: -14, enAire: true }) > 0.5 && E.colaAlViento({ fase: 0, vy: 14, enAire: true }) < -0.5 && Math.abs(E.colaAlViento({ fase: 1 })) <= 0.4 && E.colaAlViento({ fase: 2, racha: 99 }) <= 1, 'la cola va detrás del cuerpo: sube al caer y baja al subir');
  check(E.impetu(0) === 0 && E.impetu(4) === 0 && E.impetu(18) === 1 && E.impetu(11) === 0.5 && E.impetu(40) === 1, 'el ímpetu de la racha: de 5 en adelante, a tope con 18');
  const s0 = E.sacudida(0.02), s1 = E.sacudida(0.3), s2 = E.sacudida(0.4);
  check(Math.hypot(s0.dx, s0.dy) > Math.hypot(s1.dx, s1.dy) && Math.hypot(s0.dx, s0.dy) <= 9 && s2.dx === 0 && s2.dy === 0 && E.sacudida(-1).dx === 0 && E.sacudida(null).dx === 0, 'la sacudida del tropiezo se apaga en un tercio de segundo');
  check(E.entrada(0) === 0 && E.entrada(1.4) === 1 && E.entrada(0.7) === 0.5 && E.entrada(null) === 1, 'la entrada dura 1,4 s');
  check(E.rodar(0, 100, 0.016) > 0 && E.rodar(0, 100, 0.016) < 100 && E.rodar(99.5, 100, 0.016) === 100 && E.rodar(100, 100, 0.016) === 100 && E.rodar(100, 40, 0.016) < 100 && E.rodar(5, 9, 0) === 9, 'las cifras ruedan hacia el número de verdad, sin pasarse');
  let v = 0; for (let i = 0; i < 120; i++) v = E.rodar(v, 730, 1 / 60);
  check(v === 730, 'y llegan en menos de dos segundos');
  check(E.cartelDeHito({ metros: 249 }, { metros: 251 }).texto === '250 m' && E.cartelDeHito({ metros: 999 }, { metros: 1001 }).texto === '1 km' && E.cartelDeHito({ metros: 999 }, { metros: 1001 }).grande === true && E.cartelDeHito({ metros: 100 }, { metros: 140 }) === null, 'un cartel cada 250 m; el kilómetro, más grande');
  check(E.cartelDeHito({ metros: 10, racha: 9 }, { metros: 12, racha: 10 }).texto === 'Racha ×10' && E.cartelDeHito({ metros: 10, racha: 10 }, { metros: 12, racha: 11 }) === null && E.cartelDeHito(null, null) === null, 'y al llegar a una racha de diez');
  check(E.nombrePaisaje(0) === 'La montaña' && E.nombrePaisaje(2) === 'Las cumbres nevadas' && E.nombrePaisaje(5) === 'El bosque' && E.NOMBRES_PAISAJE.length === 4, 'cada paisaje, con su nombre');
  check(E.vidaCartel(0) === 0 && E.vidaCartel(1) === 1 && E.vidaCartel(2.2) === 0 && E.vidaCartel(2) > 0 && E.vidaCartel(2) < 1 && E.vidaCartel(-1) === 0, 'el cartel entra, se queda y se va');
  check(E.hayAurora({ fase: 'noche', paisaje: 2, luna: { ilum: 0.9 } }) && !E.hayAurora({ fase: 'dia', paisaje: 2 }) && !E.hayAurora({ fase: 'noche', paisaje: 0, luna: { ilum: 0.9 } }) && E.hayAurora({ fase: 'noche', paisaje: 0, luna: { ilum: 0.05 } }) && !E.hayAurora({ fase: 'noche', paisaje: 2, clima: 'lluvia' }) && !E.hayAurora(null),
    'la aurora: de noche en las cumbres nevadas, o con luna nueva; con lluvia, no');
  let media = null; for (let i = 0; i < 200; i++) media = E.mediaCuadro(media, 16.7);
  let lenta = null; for (let i = 0; i < 200; i++) lenta = E.mediaCuadro(lenta, 40);
  check(Math.abs(media - 16.7) < 0.01 && !E.convieneAligerar(media, 200) && E.convieneAligerar(lenta, 200) && !E.convieneAligerar(lenta, 30) && E.convieneAligerar(media, 200, true) && E.mediaCuadro(16, 5000) < 23,
    'si el móvil va justo (más de 26 ms por cuadro tras los primeros 90), se pinta ligero; un tirón suelto no cuenta');
  check(E.alturaAstro('alba') > E.alturaAstro('noche') && E.alturaAstro('ocaso') === E.alturaAstro('alba') && E.alturaAstro('dia') === E.alturaAstro('noche'), 'al alba y al ocaso, el sol va bajo');
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
