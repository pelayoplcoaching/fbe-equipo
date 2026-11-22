// (v0.207) La travesía: ningún óvalo ni arco con radio negativo. En la 0.153, uno así cortó el dibujo del juego con un
// error del navegador («IndexSizeError»). Se juega con un lienzo de mentira que, como el navegador, no acepta radios
// negativos: con todos los momentos raros, el cielo de cada hora, la calma, la vuelta a casa y el lobo de la hoja.
// Y por si algún dibujo nuevo los saca, los lienzos del juego los dejan en 0 (sinRadiosNegativos).
import { nuevaEtapa, avanzar, saltar, agachar, pulsar, azar } from '../web/src/logica/travesia.js';
import { pintar, pintarVuelta, pintarLobo, nuevoPaisaje, sinRadiosNegativos } from '../web/src/ui/atleta/travesia-pinta.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

// Un lienzo que no dibuja nada y apunta cada radio negativo (con la línea del dibujo que lo pidió)
function lienzoFalso({ estricto = false, sitios = new Map() } = {}) {
  const grad = { addColorStop() {} };
  const apunta = () => { const k = (new Error().stack.split('\n')[3] || '').trim().replace(/^at /, '').replace(/.*web\/src\//, ''); sitios.set(k, (sitios.get(k) || 0) + 1); };
  const base = {
    getTransform: () => ({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }),
    createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => ({}),
    measureText: (t) => ({ width: String(t).length * 6 }), getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    ellipse(x, y, rx, ry) { if (rx < 0 || ry < 0) { if (estricto) throw new RangeError('IndexSizeError: radius is negative'); apunta(); } },
    arc(x, y, r) { if (r < 0) { if (estricto) throw new RangeError('IndexSizeError: radius is negative'); apunta(); } },
  };
  // (sin la protección, para ver si algún dibujo los pide)
  if (!estricto) base.__radiosSeguros = true;
  return new Proxy(base, {
    get(o, k) { if (k in o) return o[k]; return typeof k === 'string' && /^[a-z]/.test(k) ? (o[k] = () => {}) : undefined; },
    set(o, k, v) { o[k] = v; return true; },
  });
}

console.log('La travesía: ningún óvalo con radio negativo');
{
  const sitios = new Map();
  const c = lienzoFalso({ sitios });
  const momentos = new Set();
  let cuadros = 0;
  const fases = ['noche', 'alba', 'dia', 'ocaso'];
  for (const [i, semilla] of [1, 7, 42, 99, 123, 2024].entries()) {
    // (km0: cada partida empieza justo antes de uno de los momentos raros, que salen cada 1500 m)
    const e = nuevaEtapa(semilla, { variedad: true, movimientos: semilla % 2 === 0, estrellasPor: semilla === 7 ? 2 : 1, racha0: semilla % 3 ? 0 : 10, escudos: semilla % 2, km0: i * 1500 + 650 });
    const p = nuevoPaisaje(semilla % 1000);
    const r = azar(semilla * 31);
    for (let n = 0; n < 60 * 80; n++) {
      const dt = r() < 0.01 ? 0.1 : r() < 0.05 ? 1 / 30 : 1 / 60;
      if (r() < 0.06) saltar(e); else if (r() < 0.02) agachar(e);
      pulsar(e, r() < 0.3);
      avanzar(e, dt);
      for (const m of e.momentos || []) momentos.add(m.tipo);
      const amb = { fase: fases[Math.floor(n / 1200) % 4], luna: (n % 4800) / 4800, clima: semilla % 3 === 0 ? 'nieve' : semilla % 3 === 1 ? 'lluvia' : null, paisaje: i % 4 };
      pintar(c, e, p, { w: 390, h: 300, t: e.t, dt, amb, ligero: semilla % 2 === 0, minimo: semilla === 99, contraste: semilla === 123, combo: e.combo, quedan: Math.max(0, 80 - e.t),
        adornos: [], marcas: [{ x: 200, nombre: 'Marca', tipo: 'mejor' }], fantasma: semilla % 2 ? e.t * 7 : null, amigo: semilla === 42 ? { x: e.x - 5, y: 0, nombre: 'Amigo' } : null,
        pueblo: { x: 400, nombre: 'Pueblo', tipo: 'pueblo' }, seguidores: semilla % 5, corren: semilla % 3, especial: semilla === 7 ? 'lunallena' : null, dorada: semilla === 2024, fin: e.t > 76 });
      cuadros++;
    }
  }
  // La calma (va al paso) y lo que no es la partida: la vuelta a casa y el lobo de la hoja
  const e = nuevaEtapa(5, { calma: true, variedad: true });
  const p = nuevoPaisaje(5);
  for (let n = 0; n < 900; n++) { avanzar(e, 1 / 60); pintar(c, e, p, { w: 390, h: 300, t: e.t, dt: 1 / 60, amb: { fase: 'noche', luna: 0.5, clima: null, paisaje: 0 }, quedan: 30 }); cuadros++; }
  for (const fase of fases) for (let k = 0; k <= 1.0001; k += 0.02) { pintarVuelta(c, { w: 390, h: 220, k, t: k * 3, fase, paisaje: 1 }); cuadros++; }
  pintarLobo(c, { w: 120, h: 90 });
  check(momentos.size === 5, `se juegan los cinco momentos raros (${[...momentos].join(', ')}), con el cielo de cada hora, la calma y la vuelta a casa (${cuadros} cuadros)`);
  check(sitios.size === 0, `ningún óvalo ni arco pide un radio negativo${sitios.size ? `: ${[...sitios].slice(0, 4).map(([k, n]) => `${k} (${n})`).join('; ')}` : ''}`);
}

// Y si un dibujo nuevo lo pidiera, el lienzo del juego no se rompe: ese trozo no se ve y lo demás sigue
{
  const c = sinRadiosNegativos(lienzoFalso({ estricto: true }));
  let roto = null;
  try { c.beginPath(); c.ellipse(10, 10, -0.4, 3, 0, 0, 6.3); c.arc(5, 5, -1, 0, 6.3); c.ellipse(1, 1, 2, 2, 0, 0, 6.3); } catch (x) { roto = x; }
  check(!roto, 'con un radio negativo, el lienzo del juego lo deja en 0 en vez de cortar el dibujo');
  check(sinRadiosNegativos(c) === c && sinRadiosNegativos(null) === null, 'y protegerlo dos veces (o sin lienzo) no hace nada raro');
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
