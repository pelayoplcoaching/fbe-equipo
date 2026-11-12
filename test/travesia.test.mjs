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
  const j = nuevaEtapa(3); saltar(j); check(!agachar(j) && j.agachado === 0, 'en el aire no se agacha; y al saltar se levanta');
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
