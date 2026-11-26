// Tu medicación y el ejercicio, migración 107, contra el esquema real (PGlite, con RLS): la lista que confirma el atleta
// (medicacion_atleta: cada uno ve la suya, el coach todas, y nadie la escribe a mano) y guardar_medicacion() con quién
// puede, su consentimiento de salud y los límites de cada medicamento. Y que lo que reconoce el móvil se guarda tal cual.
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import * as med from '../web/src/datos/api-medicacion.js';
import { reconocer, limpiarLista } from '../web/src/logica/medicacion.js';
import { hoyISO, sumarDias, lunesDe } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.message); process.exit(1); });
const db = await crearPglite();
const b = crearBackendPglite(db);
const api = crearApi(b);
const q = (sql, p = []) => b.sql(sql, p);
const SQL = (n) => readFileSync(new URL(`../supabase/migraciones/${n}`, import.meta.url), 'utf8');
// (jsonb guarda las claves en su orden: se comparan ordenadas)
const igual = (a, b2) => { const o = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([p], [q2]) => p.localeCompare(q2))) : v)); return o(a) === o(b2); };
const falla = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };
const superusuario = `reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`;
const base = JSON.parse(readFileSync(new URL('../web/src/datos/pauta-activa-nombres.json', import.meta.url), 'utf8'));
await db.exec('reset role;');
await db.exec('delete from fbe_migraciones where numero > 107;');
await db.exec(SQL('107_medicacion.sql'));
await db.exec(SQL('107_medicacion.sql'));   // (se puede repetir)

console.log('La 107');
await db.exec(superusuario);
const priv = (await db.query(`select has_function_privilege('anon', 'public.guardar_medicacion(jsonb, text, uuid)', 'execute') a1,
  has_function_privilege('authenticated', 'public.guardar_medicacion(jsonb, text, uuid)', 'execute') u1,
  (select relrowsecurity from pg_class where oid = 'public.medicacion_atleta'::regclass) rls, (select max(numero) from fbe_migraciones) n`)).rows[0];
check(!priv.a1 && priv.u1 && priv.rls && Number(priv.n) === 107, 'sin sesión, nada; la lista, con RLS; la base queda en la 107');

await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const lunes = lunesDe(hoyISO());
const alta = {};
for (const n of ['ana', 'berta', 'carla']) alta[n] = await api.crearAtletaEsencial({ nombre: `${n} Prueba`, email: `${n}@test`, inicio: sumarDias(lunes, -14) });
const id = {};
const entrar = async (n, codigo) => {
  await b.auth.registrar(`${n}@test`, `clave-${n}@test`, n);
  await api.canjearCodigo(codigo);
  await api.darConsentimientos();
  id[n] = (await q('select id from atletas where email = $1', [`${n}@test`]))[0].id;
};
const como = (n) => (n === 'coach' ? b.auth.entrar('coach@fbe.test', 'contraseña-coach') : b.auth.entrar(`${n}@test`, `clave-${n}@test`));
for (const n of ['ana', 'berta', 'carla']) await entrar(n, alta[n].codigo);
// Carla retira su consentimiento de salud
await db.exec(superusuario);
await db.query(`update consentimientos set revocado_en = now() where tipo = 'datos_salud' and perfil_id = (select perfil_id from atletas where id = $1)`, [id.carla]);

console.log('\nGuardar su lista (guardar_medicacion)');
const texto = 'Bisoprolol 5 mg 1-0-0\nMetformina 850 mg 1-0-1\nAdiro 100\nUn jarabe para la tos';
const r = reconocer(texto, base);
check(r.encontrados.map((x) => x.pid).join() === 'bisoprolol,metformina,aas' && r.sinReconocer.length === 1, 'el móvil reconoce tres de su texto (y lo que no conoce lo deja aparte)');
await como('ana');
check(await med.hay107(b) === true, 'la app ve que está la 107');
const g1 = await med.guardarMedicacion(b, r.encontrados, base.version);
const fila = await med.medicacion(b, id.ana);
check(g1?.atleta_id === id.ana && fila && igual(fila.lista, limpiarLista(r.encontrados)) && fila.version_base === base.version,
  'Ana guarda su lista: queda tal cual la reconoció el móvil, con la versión de la base de Pauta Activa');
check(fila.lista[0].dosis === 5 && fila.lista[0].tomas === 1 && fila.lista[1].tomas === 2 && fila.lista[2].dosis === null, 'con su dosis en mg y sus tomas al día (y sin dosis si no la escribió)');
const antes = fila.confirmado_en;
const g2 = await med.guardarMedicacion(b, r.encontrados.slice(0, 1), base.version);
check(g2.lista.length === 1 && (await med.medicacion(b, id.ana)).lista.length === 1 && g2.confirmado_en >= antes, 'si la cambia, se sustituye (una fila por atleta)');
check((await med.guardarMedicacion(b, [], base.version)).lista.length === 0, 'una lista vacía también vale («no tomo nada de esto»)');
await med.guardarMedicacion(b, r.encontrados, base.version);

console.log('\nQuién la ve y quién la escribe');
check(/row-level security|permission|42501|violates/i.test((await falla(() => b.insert('medicacion_atleta', { atleta_id: id.ana, lista: [] })))?.message || '')
  || (await med.medicacion(b, id.ana)).lista.length === 3, 'a mano, Ana no la escribe (solo con guardar_medicacion)');
await como('berta');
check(await med.medicacion(b, id.ana) === null && (await med.medicaciones(b)).length === 0, 'Berta no ve la de Ana');
check(/propia/.test((await falla(() => b.rpc('guardar_medicacion', { p_lista: [], p_atleta: id.ana })))?.message || ''), 'ni la puede guardar por ella');
await como('carla');
check(/consentimiento/.test((await falla(() => med.guardarMedicacion(b, r.encontrados)))?.message || ''), 'sin su consentimiento de salud, Carla no puede guardarla');
await como('coach');
check((await med.medicacion(b, id.ana))?.lista.length === 3 && (await med.medicaciones(b)).length === 1, 'el coach la ve');
const gc = await med.guardarMedicacion(b, r.encontrados.slice(1), base.version, id.berta);
check(gc.atleta_id === id.berta && gc.lista.length === 2, 'y la puede guardar por un atleta (con su consentimiento)');

console.log('\nBorrarla');
await como('berta');
await b.delete('medicacion_atleta', { eq: { atleta_id: id.ana } }).catch(() => null);
await como('coach');
check((await med.medicacion(b, id.ana))?.lista.length === 3, 'Berta no puede borrar la de Ana');
await como('ana');
await api.borrarSaludCuestionario(id.ana);
check(await med.medicacion(b, id.ana) === null, 'al borrar sus respuestas de salud, Ana borra también su lista');
await med.guardarMedicacion(b, r.encontrados, base.version);

console.log('\nSus límites');
await como('ana');
const uno = { pid: 'bisoprolol', nombre: 'Bisoprolol', dosis: 5, tomas: 1, texto: 'Bisoprolol 5 mg' };
const mal = async (lista, m) => check(/no vale/.test((await falla(() => b.rpc('guardar_medicacion', { p_lista: lista })))?.message || ''), m);
await mal(Array.from({ length: 31 }, (_, i) => ({ ...uno, pid: `p${i}x` })), 'más de 30: no');
await mal([uno, uno], 'el mismo dos veces: no');
await mal([{ ...uno, pid: 'Bisoprolol!' }], 'un id raro: no');
await mal([{ ...uno, nombre: '  ' }], 'sin nombre: no');
await mal([{ ...uno, nombre: 'x'.repeat(81) }], 'un nombre de más de 80: no');
await mal([{ ...uno, texto: 'x'.repeat(81) }], 'un texto de más de 80: no');
await mal([{ ...uno, dosis: 0 }], 'una dosis de 0: no');
await mal([{ ...uno, dosis: 100001 }], 'una dosis de más de 100.000 mg: no');
await mal([{ ...uno, dosis: '5' }], 'una dosis que no es un número: no');
await mal([{ ...uno, tomas: 1.5 }], 'media toma: no');
await mal([{ ...uno, tomas: 13 }], 'más de 12 tomas: no');
await mal({ pid: 'x' }, 'algo que no es una lista: no');
check((await falla(() => b.rpc('guardar_medicacion', { p_lista: [{ ...uno, dosis: null, tomas: null, texto: null }] }))) === null, 'sin dosis, sin tomas y sin texto: sí');

console.log('\nSi se borra el atleta, se borra su lista');
await db.exec(superusuario);
await db.query('delete from atletas where id = $1', [id.berta]);
check(Number((await db.query('select count(*) n from medicacion_atleta where atleta_id = $1', [id.berta])).rows[0].n) === 0, 'sin rastro');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
