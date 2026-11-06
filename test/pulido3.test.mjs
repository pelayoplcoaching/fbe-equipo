// Pulido, tercera tanda: lo que se puede comprobar sin navegador (la capa de datos sobre la demo en memoria).
//   node test/pulido3.test.mjs
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.stack); process.exit(1); });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Un backend en memoria que cuenta las lecturas por tabla y las funciones; sin048: como una base sin la migración 048
const DATOS = semillaDemo();   // (los mismos datos para todos: la demo se inventa ids nuevos cada vez)
function montar({ sin048 = false } = {}) {
  const b = crearBackendMemoria({ semilla: () => structuredClone(DATOS), persistir: false });
  const cuenta = {};
  const sel = b.select.bind(b), rpc = b.rpc.bind(b);
  b.select = (t, ...a) => { cuenta[t] = (cuenta[t] || 0) + 1; return sel(t, ...a); };
  b.rpc = (n, ...a) => {
    cuenta[`rpc:${n}`] = (cuenta[`rpc:${n}`] || 0) + 1;
    if (sin048 && /^(conversaciones_resumen|ultimas_series)$/.test(n)) return Promise.reject(new Error(`Could not find the function public.${n} in the schema cache`));
    return rpc(n, ...a);
  };
  return { b, api: crearApi(b), cuenta, n: (t) => cuenta[t] || 0 };
}
const sinVolatil = (x) => JSON.parse(JSON.stringify(x, (k, v) => (k === 'foto' ? undefined : v)));

console.log('2. La lista de conversaciones, resumida en la base (migración 048)');
{
  const con = montar(), sin = montar({ sin048: true });
  for (const m of [con, sin]) await m.b.auth.entrar('pelayo@fbe.demo', 'demo');
  // Algo más de variedad que la demo: un programado, uno eliminado y uno largo
  for (const m of [con, sin]) {
    const ana = (await m.api.atletas()).find((a) => a.nombre === 'Ana López');
    await m.b.insert('comentarios', [{ atleta_id: ana.id, autor: 'coach', texto: 'Para mañana', enviar_en: new Date(Date.now() + 86400000).toISOString() }]);
  }
  const a = await con.api.conversaciones(), s = await sin.api.conversaciones();
  const corta = (l) => l.map((x) => ({ atleta: x.atleta.nombre, ultimo: x.ultimo ? { autor: x.ultimo.autor, texto: String(x.ultimo.texto).slice(0, 300), medio: x.ultimo.medio || null, eliminado: !!x.ultimo.eliminado_en } : null, sinLeer: x.sinLeer, programados: x.programados, estado: x.estado }));
  check(a.length > 3 && JSON.stringify(corta(a)) === JSON.stringify(corta(s)), `la lista sale igual con la función nueva que contando los mensajes como antes (${a.length} conversaciones, mismo orden, último, no leídos y programados)`);
  check(a.some((x) => x.programados >= 1) && a.some((x) => x.sinLeer > 0) && a.every((x) => !x.ultimo || !x.ultimo.enviar_en || Date.parse(x.ultimo.enviar_en) <= Date.now()), 'con sus programados aparte (nunca como último mensaje) y sus no leídos');
  check(con.n('rpc:conversaciones_resumen') === 1 && con.n('comentarios') === 0, 'con la migración, la lista no baja ni un mensaje: una sola llamada');
  check(sin.n('comentarios') >= 1, 'sin la migración, lo pide como hasta ahora (y funciona igual)');
  await espera(2100);
  const antes = sin.n('rpc:conversaciones_resumen');
  await sin.api.conversaciones();
  check(sin.n('rpc:conversaciones_resumen') === antes, 'y no vuelve a intentar la función que no está en cada visita');
  // Un atleta también puede llamarla y solo recibe lo suyo (la app no lo usa, pero la base lo permite)
  await con.b.auth.entrar('ana@fbe.demo', 'demo');
  const deAna = await con.b.rpc('conversaciones_resumen');
  check(deAna.length <= 1, 'un atleta solo recibe su conversación');
}

console.log('3. La lista del coach: la última serie de todos en una consulta');
{
  const con = montar(), sin = montar({ sin048: true });
  for (const m of [con, sin]) await m.b.auth.entrar('pelayo@fbe.demo', 'demo');
  const a = await con.api.resumenes(), s = await sin.api.resumenes();
  check(a.length > 3 && JSON.stringify(sinVolatil(a)) === JSON.stringify(sinVolatil(s)), `el resumen de cada atleta sale idéntico por las dos vías (${a.length} atletas)`);
  check(a.some((r) => r.ultimaSerie), 'con la fecha de su última serie');
  const atletas = a.length;
  check(con.n('rpc:ultimas_series') === 1 && sin.n('series') >= con.n('series') + atletas - 1, `con la migración, ${atletas} consultas de «última serie» pasan a ser una (${sin.n('series')} lecturas de series → ${con.n('series')})`);
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
