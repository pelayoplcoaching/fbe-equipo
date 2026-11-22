// (v0.207, datos que crecen) Más de 1000 filas de golpe (el historial de un atleta con años de entrenos): Supabase da como
// mucho 1000 por consulta, así que se pagina. Antes, una página detrás de otra (con 8000 series, 8 esperas seguidas a la
// base); ahora, a la vez que la segunda se pide la cuenta y las demás van a la vez. Con el adaptador de Supabase de verdad
// y una base de mentira que pagina como PostgREST (offset, limit y la cuenta en Content-Range).
import { crearBackendSupabase } from '../web/src/datos/backend-supabase.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e?.stack || e); process.exit(1); });

const usuario = { id: '11111111-1111-4111-8111-111111111111', email: 'coach@fbe.demo', aud: 'authenticated', role: 'authenticated' };
const sesion = { access_token: 't1', refresh_token: 'r1', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: usuario };
const json = (cuerpo, status = 200, cab = {}) => new Response(cuerpo == null ? null : JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json', ...cab } });
const TABLAS = { series: Array.from({ length: 2500 }, (_, i) => ({ id: `s${String(i).padStart(5, '0')}`, kg: i })), pesos: Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, kg: 70 })) };
const red = { pedidas: [], enVuelo: 0, maxVuelo: 0, sinCuenta: false, lenta: 15 };
globalThis.fetch = async (url, op = {}) => {
  const u = new URL(String(url));
  if (u.pathname === '/auth/v1/token') return json(sesion);
  if (u.pathname.startsWith('/auth/v1/')) return json({});
  const tabla = u.pathname.replace('/rest/v1/', '');
  const filas = TABLAS[tabla] || [];
  const cab = op.headers instanceof Headers ? Object.fromEntries(op.headers) : Object.fromEntries(Object.entries(op.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const cuenta = /count=exact/.test(cab.prefer || '');
  const metodo = op.method || 'GET';
  red.pedidas.push({ metodo, cuenta, offset: Number(u.searchParams.get('offset') || 0), limit: Number(u.searchParams.get('limit') || 0) });
  red.enVuelo++; red.maxVuelo = Math.max(red.maxVuelo, red.enVuelo);
  await new Promise((r) => setTimeout(r, red.lenta));
  red.enVuelo--;
  if (metodo === 'HEAD') return red.sinCuenta ? json({ message: 'no' }, 500) : new Response(null, { status: 200, headers: { 'content-range': `*/${filas.length}` } });
  const desde = Number(u.searchParams.get('offset') || 0), n = Number(u.searchParams.get('limit') || filas.length);
  const trozo = filas.slice(desde, desde + n);
  return json(trozo, 200, { 'content-range': `${desde}-${desde + trozo.length - 1}/${cuenta ? filas.length : '*'}` });
};

const b = crearBackendSupabase({ url: 'https://demo.supabase.co', anonKey: 'anon' });
await b.auth.entrar('coach@fbe.demo', 'demo');

console.log('Más de 1000 filas: las páginas, a la vez');
{
  red.pedidas = []; red.maxVuelo = 0;
  const t0 = Date.now();
  const filas = await b.select('series', { order: [['id', 'asc']] });
  const gets = red.pedidas.filter((x) => x.metodo === 'GET'), heads = red.pedidas.filter((x) => x.metodo === 'HEAD');
  check(filas.length === 2500 && filas.every((x, i) => x.kg === i), `llegan las 2500, enteras y en su orden (${filas.length})`);
  check(gets.length === 3 && heads.length === 1 && gets.map((x) => x.offset).join() === '0,1000,2000' && red.maxVuelo === 2, `3 páginas y una cuenta (sin filas), la cuenta a la vez que la segunda (como mucho ${red.maxVuelo} a la vez)`);
  console.log(`    (${Date.now() - t0} ms con 15 ms por petición)`);
}
{
  TABLAS.series = Array.from({ length: 8200 }, (_, i) => ({ id: `s${String(i).padStart(5, '0')}`, kg: i }));
  red.pedidas = []; red.maxVuelo = 0;
  const filas = await b.select('series', { order: [['id', 'asc']] });
  const gets = red.pedidas.filter((x) => x.metodo === 'GET');
  check(filas.length === 8200 && filas.every((x, i) => x.kg === i), `con 8200 (dos años de historial), llegan todas y en su orden (${filas.length})`);
  check(gets.length === 9 && red.maxVuelo === 6, `9 páginas, de seis en seis después de la segunda (${red.maxVuelo} a la vez; antes, 1): 4 esperas seguidas en vez de 9`);
}
{
  red.pedidas = [];
  const filas = await b.select('pesos', {});
  check(filas.length === 40 && red.pedidas.length === 1 && !red.pedidas[0].cuenta, 'con menos de 1000, una sola petición y sin cuenta (como siempre)');
  red.pedidas = [];
  const lim = await b.select('series', { order: [['id', 'asc']], limit: 2300 });
  check(lim.length === 2300 && lim[2299].kg === 2299 && red.pedidas.filter((x) => x.metodo === 'GET').length === 3, `con un límite (2300), hasta el límite (${lim.length})`);
}
{
  red.sinCuenta = true; red.pedidas = []; red.maxVuelo = 0;
  TABLAS.series = Array.from({ length: 3100 }, (_, i) => ({ id: `s${String(i).padStart(5, '0')}`, kg: i }));
  const filas = await b.select('series', { order: [['id', 'asc']] });
  check(filas.length === 3100 && filas.every((x, i) => x.kg === i) && red.pedidas.filter((x) => x.metodo === 'GET').length === 4, 'si la cuenta falla, las demás páginas una detrás de otra, como antes (y llegan todas)');
  red.sinCuenta = false;
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
process.exit(0);
