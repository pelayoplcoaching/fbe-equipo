// (v0.208) La etapa del día de La travesía sin conexión: no se pierde. Se guarda en el móvil (la mejor del día) y se manda
// al volver la red; si ya es otro día, se tira (la base la contaría como intento de hoy).
//   node test/etapa-sin-red.test.mjs
import { crearApi } from '../web/src/datos/api.js';
import { fechaMadrid } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

// Un localStorage de mentira (en el navegador es el de verdad)
const guardado = new Map();
globalThis.localStorage = { getItem: (k) => (guardado.has(k) ? guardado.get(k) : null), setItem: (k, v) => guardado.set(k, String(v)), removeItem: (k) => guardado.delete(k), key: () => null, length: 0 };

const red = { sin: false, llamadas: [] };
const sinRed = () => { const e = new Error('Sin conexión.'); e.sinConexion = true; return e; };
const backend = {
  modo: 'prueba',
  auth: { sesion: () => ({ user: { id: 'u1' } }), alCambiar: () => () => {} },
  async select() { return []; },
  async insert() { return []; }, async update() { return []; }, async upsert() { return []; }, async delete() {},
  async rpc(nombre, args) {
    if (red.sin) throw sinRed();
    red.llamadas.push([nombre, args]);
    if (nombre === 'sumar_etapa_del_dia') return { dia: fechaMadrid(), metros: args.p_metros, intentos: 1 };
    return null;
  },
};
const api = crearApi(backend);

console.log('La etapa del día sin conexión');
red.sin = true;
check(await api.etapaDelDia(420, 3) === null, 'sin red no falla (devuelve null, como antes)');
await api.etapaDelDia(380, 2);
await api.etapaDelDia(510, 5, [0, 0, 100, 10]);
const p = JSON.parse(guardado.get('fbe-etapa-pendiente:u1') || 'null');
check(p && p.metros === 510 && p.estrellas === 5 && p.dia === fechaMadrid() && p.rastro?.length === 4, `se queda la mejor del día en el móvil (${p?.metros} m)`);
check(await api.enviarEtapaPendiente() === false && guardado.has('fbe-etapa-pendiente:u1'), 'sin red todavía, se sigue guardando');
red.sin = false;
check(await api.enviarEtapaPendiente() === true, 'al volver la red, se manda');
const llamada = red.llamadas.find(([n]) => n === 'sumar_etapa_del_dia');
check(llamada && llamada[1].p_metros === 510 && llamada[1].p_estrellas === 5, 'con sus metros y sus estrellas (una sola vez)');
check(!guardado.has('fbe-etapa-pendiente:u1') && await api.enviarEtapaPendiente() === false, 'y ya no queda nada pendiente');

console.log('\nDe otro día, no');
guardado.set('fbe-etapa-pendiente:u1', JSON.stringify({ dia: '2020-01-01', metros: 700, estrellas: 1, rastro: null }));
const antes = red.llamadas.length;
check(await api.enviarEtapaPendiente() === false && red.llamadas.length === antes && !guardado.has('fbe-etapa-pendiente:u1'), 'una etapa de otro día se tira sin mandarla');

console.log('\nCon red, como siempre');
const r = await api.etapaDelDia(300, 1);
check(r?.metros === 300 && !guardado.has('fbe-etapa-pendiente:u1'), 'se manda al momento y no se guarda nada');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
