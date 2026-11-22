// (v0.207) «JWT expired»: con el móvil dormido más de una hora, la primera consulta podía salir antes de que Supabase
// renovara la sesión, y fallaba (4 veces en un mes, a 3 personas). Ahora se renueva la sesión y se repite una vez.
// Primero la regla suelta; luego el adaptador de Supabase de verdad, con una red de mentira.
import { sesionCaducada, repetirSiCaduca, crearBackendSupabase } from '../web/src/datos/backend-supabase.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e?.stack || e); process.exit(1); });

console.log('Sesión caducada: la regla');
check(sesionCaducada({ code: 'PGRST301', message: 'JWT expired' }), 'el «JWT expired» de la base (PGRST301) es sesión caducada');
check(sesionCaducada({ statusCode: '400', error: 'InvalidJWT', message: 'jwt expired' }), 'y el de los archivos (Storage), también');
check(!sesionCaducada({ code: '42501', message: 'permission denied for table series' }) && !sesionCaducada({ message: 'Failed to fetch' }) && !sesionCaducada(null),
  'un permiso denegado, la falta de cobertura o nada no lo son');
{
  let n = 0, r = 0;
  const caduca = { error: { code: 'PGRST301', message: 'JWT expired' } };
  const res = await repetirSiCaduca(async () => (++n === 1 ? caduca : { data: [1] }), async () => { r++; return true; });
  check(n === 2 && r === 1 && res.data?.[0] === 1, 'si caduca, se renueva una vez y se repite una vez');
  n = 0; r = 0;
  const res2 = await repetirSiCaduca(async () => { n++; return caduca; }, async () => { r++; return true; });
  check(n === 2 && r === 1 && res2 === caduca, 'si vuelve a fallar, no se repite más (el error de la segunda vez)');
  n = 0;
  const res3 = await repetirSiCaduca(async () => { n++; return caduca; }, async () => false);
  const res4 = await repetirSiCaduca(async () => caduca, async () => { throw new Error('sin red'); });
  check(n === 1 && res3 === caduca && res4 === caduca, 'si no se puede renovar (o la renovación falla), no se repite: el error de siempre');
  n = 0; r = 0;
  await repetirSiCaduca(async () => { n++; return { error: { code: '42501', message: 'permission denied' } }; }, async () => { r++; return true; });
  await repetirSiCaduca(async () => { n++; return { data: [] }; }, async () => { r++; return true; });
  check(n === 2 && r === 0, 'con otro error o sin error, ni se renueva ni se repite');
}

// El adaptador de verdad: una base de mentira que da por caducado el primer permiso
console.log('\nSesión caducada: el adaptador de Supabase');
const URL_B = 'https://demo.supabase.co';
const usuario = { id: '11111111-1111-4111-8111-111111111111', email: 'atleta@fbe.demo', aud: 'authenticated', role: 'authenticated' };
const sesionNueva = (token) => ({ access_token: token, refresh_token: `r-${token}`, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: usuario });
const red = { tokens: [], renovaciones: 0, caducado: new Set(['t1']), lecturas: 0, escrituras: [] };
const json = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, op = {}) => {
  const u = new URL(String(url));
  const auth = (op.headers instanceof Headers ? op.headers.get('authorization') : (op.headers?.Authorization || op.headers?.authorization)) || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'password') return json(sesionNueva('t1'));
  if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'refresh_token') { red.renovaciones++; await new Promise((r) => setTimeout(r, 20)); return json(sesionNueva(`t${1 + red.renovaciones}`)); }
  if (u.pathname.startsWith('/auth/v1/')) return json({});
  if (u.pathname.startsWith('/rest/v1/')) {
    red.tokens.push(token);
    if (red.caducado.has(token)) return json({ code: 'PGRST301', details: null, hint: null, message: 'JWT expired' }, 401);
    if ((op.method || 'GET') === 'GET') { red.lecturas++; return json([{ id: 'a', nombre: 'Ana' }]); }
    if (u.pathname.startsWith('/rest/v1/rpc/')) return json(42);
    red.escrituras.push(op.method);
    return json([{ id: 'b' }], 201);
  }
  return json({ message: 'no' }, 404);
};
{
  const b = crearBackendSupabase({ url: URL_B, anonKey: 'anon' });
  await b.auth.entrar('atleta@fbe.demo', 'demo');
  // Varias consultas a la vez con el permiso caducado (lo que hace Hoy al despertar el móvil): una sola renovación
  const [l1, l2, l3] = await Promise.all([b.select('atletas', {}), b.select('series', {}), b.rpc('mi_funcion', {})]);
  check(l1.length === 1 && l2.length === 1 && l3 === 42, 'tres consultas a la vez con la sesión caducada: se renueva y las tres salen bien');
  check(red.renovaciones === 1, `una sola renovación para las tres (${red.renovaciones})`);
  check(red.tokens.filter((t) => t === 't1').length === 3 && red.tokens.filter((t) => t === 't2').length === 3, 'cada una se repite una sola vez, ya con el permiso nuevo');
  // Una escritura rechazada por el permiso caducado no llegó a hacerse: se repite y se hace una vez
  red.caducado.add('t2');
  const ins = await b.insert('series', [{ x: 1 }]);
  check(ins[0]?.id === 'b' && red.escrituras.length === 1 && red.renovaciones === 2, 'una escritura con la sesión caducada se hace una sola vez, tras renovar');
  // Si la renovación no sirve (la base sigue rechazándola), el error se dice en claro, sin bucles
  red.caducado.add('t3').add('t4');
  const antes = red.tokens.length;
  const e = await b.select('atletas', {}).then(() => null, (x) => x);
  check(e?.sesionCaducada && /caducado/.test(e.message) && red.tokens.length - antes === 2, `si ni así vale, un aviso claro («${e?.message}») tras un solo reintento`);
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
process.exit(0);
