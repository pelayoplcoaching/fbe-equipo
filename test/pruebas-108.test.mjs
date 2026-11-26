// «Tus pruebas» de FBE Esencial, migración 108, contra el esquema real (PGlite, con RLS): pruebas_fisicas (cada uno ve las
// suyas, el coach todas, nadie las escribe a mano) y guardar_prueba() con quién puede, su consentimiento de salud y los
// límites de cada prueba. Y que lo que calcula el móvil (logica/esencial-pruebas.js: filaPrueba) se guarda tal cual.
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import * as pr from '../web/src/datos/api-pruebas.js';
import { filaPrueba } from '../web/src/logica/esencial-pruebas.js';
import { hoyISO, sumarDias, lunesDe } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.message); process.exit(1); });
const db = await crearPglite();
const b = crearBackendPglite(db);
const api = crearApi(b);
const q = (sql, p = []) => b.sql(sql, p);
const SQL = (n) => readFileSync(new URL(`../supabase/migraciones/${n}`, import.meta.url), 'utf8');
const falla = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };
const superusuario = `reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`;
await db.exec('reset role;');
await db.exec('delete from fbe_migraciones where numero > 108;');
await db.exec(SQL('108_pruebas.sql'));
await db.exec(SQL('108_pruebas.sql'));   // (se puede repetir)

console.log('La 108');
await db.exec(superusuario);
const priv = (await db.query(`select has_function_privilege('anon', 'public.guardar_prueba(jsonb, uuid)', 'execute') a1,
  has_function_privilege('authenticated', 'public.guardar_prueba(jsonb, uuid)', 'execute') u1,
  (select relrowsecurity from pg_class where oid = 'public.pruebas_fisicas'::regclass) rls, (select max(numero) from fbe_migraciones) n`)).rows[0];
check(!priv.a1 && priv.u1 && priv.rls && Number(priv.n) === 108, 'sin sesión, nada; las pruebas, con RLS; la base queda en la 108');

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

console.log('\nGuardar sus pruebas (guardar_prueba)');
await como('ana');
check(await pr.hay108(b) === true, 'la app ve que está la 108');
const yo = { edad: 66, sexo: 'mujer' };
const silla = filaPrueba('silla', { veces: 13, ...yo });
const g1 = await pr.guardarPrueba(b, silla, yo);
check(g1?.atleta_id === id.ana && g1.prueba === 'silla' && Number(g1.valor) === 13 && g1.detalle === null && g1.edad === 66 && g1.sexo === 'mujer' && g1.fecha === hoyISO(),
  'Ana guarda la silla: 13 veces, con su edad y su sexo, con la fecha de hoy');
const eq = filaPrueba('equilibrio', { intentos: [4, 10], edad: 66 });
const g2 = await pr.guardarPrueba(b, eq, yo);
check(Number(g2.valor) === 10 && JSON.stringify(g2.detalle.intentos) === '[4,10]', 'el equilibrio: conseguido al segundo intento (10 s, con sus intentos)');
const g3 = await pr.guardarPrueba(b, filaPrueba('equilibrio', { intentos: [4, 6, 7.5], edad: 66 }), yo);
check(Number(g3.valor) === 7.5 && g3.id === g2.id && (await pr.pruebas(b, id.ana)).filter((x) => x.prueba === 'equilibrio').length === 1,
  'si la repite el mismo día, se queda la última (una por prueba y día)');
const g4 = await pr.guardarPrueba(b, filaPrueba('cintura', { cintura: 88, altura: 170 }), yo);
check(Number(g4.valor) === 0.52 && Number(g4.detalle.cintura) === 88 && Number(g4.detalle.altura) === 170, 'cintura y altura: el índice (0,52), con las dos medidas');
const g5 = await pr.guardarPrueba(b, filaPrueba('prension', { intentos: [15.5, 17, 16], sexo: 'mujer' }), yo);
check(Number(g5.valor) === 17 && g5.detalle.intentos.length === 3, 'la prensión: el mejor de sus tres intentos');
const g6 = await pr.guardarPrueba(b, filaPrueba('sppb', { lado: 10, semi: 10, tandem: 5, marcha: [5.1, 4.9], silla: 12.5 }), yo);
check(Number(g6.valor) === 9 && g6.detalle.partes.equilibrio === 3 && g6.detalle.partes.marcha === 3 && g6.detalle.partes.silla === 3, 'el SPPB: 9 de 12, con sus tres partes');
const mias = await pr.pruebas(b, id.ana);
check(mias.length === 5 && mias.every((x) => typeof x.valor === 'number'), 'y las lee: cinco, con su valor como número');
// (una de otro día, para «la vez anterior»)
await db.exec(superusuario);
await db.query(`insert into pruebas_fisicas (atleta_id, fecha, prueba, valor, edad, sexo) values ($1, $2, 'silla', 11, 66, 'mujer')`, [id.ana, sumarDias(hoyISO(), -84)]);
await como('ana');
const dos = (await pr.pruebas(b, id.ana)).filter((x) => x.prueba === 'silla');
check(dos.length === 2 && dos[0].fecha === hoyISO() && dos[1].valor === 11, 'de la más reciente a la más antigua');

console.log('\nQuién las ve y quién las escribe');
check(/row-level security|permission|42501|violates/i.test((await falla(() => b.insert('pruebas_fisicas', { atleta_id: id.ana, prueba: 'silla', valor: 30 })))?.message || '')
  && !(await pr.pruebas(b, id.ana)).some((x) => Number(x.valor) === 30), 'a mano, Ana no las escribe (solo con guardar_prueba)');
await como('berta');
check((await pr.pruebas(b, id.ana)).length === 0, 'Berta no ve las de Ana');
check(/propias/.test((await falla(() => b.rpc('guardar_prueba', { p: silla, p_atleta: id.ana })))?.message || ''), 'ni las puede guardar por ella');
await como('carla');
check(/consentimiento/.test((await falla(() => pr.guardarPrueba(b, silla, yo)))?.message || ''), 'sin su consentimiento de salud, Carla no puede guardarlas');
await como('coach');
check((await pr.pruebas(b, id.ana)).length === 6, 'el coach las ve');
const gc = await pr.guardarPrueba(b, filaPrueba('silla', { veces: 18, edad: 61, sexo: 'hombre' }), { edad: 61, sexo: 'hombre' }, id.berta);
check(gc.atleta_id === id.berta && Number(gc.valor) === 18, 'y puede guardar una por un atleta (con su consentimiento)');

console.log('\nBorrarlas');
await como('berta');
await pr.borrarPruebas(b, id.ana).catch(() => null);
await como('coach');
check((await pr.pruebas(b, id.ana)).length === 6, 'Berta no puede borrar las de Ana');
await como('ana');
await pr.borrarPruebas(b, id.ana, dos[1].id);
check((await pr.pruebas(b, id.ana)).length === 5, 'Ana borra una suya');
await pr.borrarPruebas(b, id.ana);
check((await pr.pruebas(b, id.ana)).length === 0, 'y todas');
await como('carla');
await db.exec(superusuario);
await db.query(`insert into pruebas_fisicas (atleta_id, prueba, valor) values ($1, 'silla', 12)`, [id.carla]);
await como('carla');
await pr.borrarPruebas(b, id.carla);
await db.exec(superusuario);
check(Number((await db.query('select count(*) n from pruebas_fisicas where atleta_id = $1', [id.carla])).rows[0].n) === 0, 'también sin consentimiento (Carla borra las suyas)');

console.log('\nSus límites');
await como('ana');
const mal = async (p, m) => check(/no vale/.test((await falla(() => b.rpc('guardar_prueba', { p })))?.message || ''), m);
await mal({ prueba: 'salto', valor: 3 }, 'una prueba que no existe: no');
await mal({ prueba: 'silla', valor: 61 }, 'la silla, más de 60: no');
await mal({ prueba: 'silla', valor: 12.5 }, 'la silla, media vez: no');
await mal({ prueba: 'silla', valor: '12' }, 'un valor que no es un número: no');
await mal({ prueba: 'silla', valor: 12, edad: 15 }, 'una edad de menos de 18: no');
await mal({ prueba: 'silla', valor: 12, edad: 66.5 }, 'una edad con decimales: no');
await mal({ prueba: 'silla', valor: 12, sexo: 'otro' }, 'un sexo que no es hombre o mujer: no');
await mal({ prueba: 'equilibrio', valor: 10, detalle: { intentos: [4] } }, 'el equilibrio, 10 s sin haberlo conseguido: no');
await mal({ prueba: 'equilibrio', valor: 6, detalle: { intentos: [4, 6] } }, 'sin conseguirlo, con menos de tres intentos: no');
await mal({ prueba: 'equilibrio', valor: 6, detalle: { intentos: [4, 6, 7] } }, 'sin conseguirlo, un valor que no es el mejor: no');
await mal({ prueba: 'equilibrio', valor: 10, detalle: { intentos: [4, 6, 7, 10] } }, 'más de tres intentos: no');
await mal({ prueba: 'equilibrio', valor: 10, detalle: { intentos: [11] } }, 'un intento de más de 10 s: no');
await mal({ prueba: 'cintura', valor: 0.52, detalle: { cintura: 88 } }, 'cintura sin altura: no');
await mal({ prueba: 'cintura', valor: 0.6, detalle: { cintura: 88, altura: 170 } }, 'un índice que no cuadra con las medidas: no');
await mal({ prueba: 'cintura', valor: 0.9, detalle: { cintura: 88, altura: 98 } }, 'una altura de menos de 100 cm: no');
await mal({ prueba: 'prension', valor: 20, detalle: { intentos: [18, 19] } }, 'la prensión, un valor que no es el mejor: no');
await mal({ prueba: 'prension', valor: 200, detalle: { intentos: [200] } }, 'la prensión, 200 kg o más: no');
await mal({ prueba: 'prension', valor: 0, detalle: { intentos: [0] } }, 'la prensión, 0: no');
await mal({ prueba: 'sppb', valor: 9, detalle: { partes: { equilibrio: 3, marcha: 3 } } }, 'el SPPB sin una de sus partes: no');
await mal({ prueba: 'sppb', valor: 10, detalle: { partes: { equilibrio: 3, marcha: 3, silla: 3 } } }, 'el SPPB, un total que no es la suma: no');
await mal({ prueba: 'sppb', valor: 15, detalle: { partes: { equilibrio: 5, marcha: 5, silla: 5 } } }, 'el SPPB, una parte de más de 4: no');
const raro = await pr.guardarPrueba(b, { prueba: 'silla', valor: 12, detalle: { cualquier: 'cosa' } }, {});
check(raro.detalle === null && raro.edad === null && raro.sexo === null, 'en la silla, el detalle no se guarda; sin edad ni sexo, también vale');
const redondo = await pr.guardarPrueba(b, { prueba: 'cintura', valor: 0.5176, detalle: { cintura: 88, altura: 170, otra: 1 } }, {});
check(Number(redondo.valor) === 0.52 && redondo.detalle.otra === undefined, 'la cintura se redondea a dos decimales y su detalle, solo con las dos medidas');

console.log('\nSi se borra el atleta, se borran sus pruebas');
await db.exec(superusuario);
await db.query('delete from atletas where id = $1', [id.berta]);
check(Number((await db.query('select count(*) n from pruebas_fisicas where atleta_id = $1', [id.berta])).rows[0].n) === 0, 'sin rastro');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
