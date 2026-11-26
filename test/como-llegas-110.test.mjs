// «¿Cómo llegas hoy?» de un toque, migración 110, contra el esquema real (PGlite, con RLS): la columna de siempre admite
// las tres preguntas (005) y la forma de un toque (la cara y, si quiere, las horas de 2 a 14 de media en media hora, las
// agujetas y lo que eligió), y nada más; sigue haciendo falta su consentimiento de salud; la función para saber que la
// base la admite (sin sesión, no); y la app la detecta.
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import { hay110 } from '../web/src/datos/api-como-llegas.js';
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
await db.exec('delete from fbe_migraciones where numero > 110;');
await db.exec(SQL('110_como_llegas.sql'));
await db.exec(SQL('110_como_llegas.sql'));   // (se puede repetir)

console.log('La 110');
await db.exec(superusuario);
const priv = (await db.query(`select has_function_privilege('anon', 'public.preparacion_un_toque()', 'execute') a1,
  has_function_privilege('authenticated', 'public.preparacion_un_toque()', 'execute') u1, (select max(numero) from fbe_migraciones) n`)).rows[0];
check(!priv.a1 && priv.u1 && Number(priv.n) === 110, 'sin sesión, nada; con sesión, la función que dice que la base la admite; la base queda en la 110');

await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const lunes = lunesDe(hoyISO());
const alta = {};
for (const n of ['ana', 'carla']) alta[n] = await api.crearAtletaEsencial({ nombre: `${n} Llega`, email: `${n}@test`, inicio: sumarDias(lunes, -14) });
const id = {};
const entrar = async (n, codigo) => {
  await b.auth.registrar(`${n}@test`, `clave-${n}@test`, n);
  await api.canjearCodigo(codigo);
  await api.darConsentimientos();
  id[n] = (await q('select id from atletas where email = $1', [`${n}@test`]))[0].id;
};
const como = (n) => b.auth.entrar(`${n}@test`, `clave-${n}@test`);
for (const n of ['ana', 'carla']) await entrar(n, alta[n].codigo);
await db.exec(superusuario);
await db.query(`update consentimientos set revocado_en = now() where tipo = 'datos_salud' and perfil_id = (select perfil_id from atletas where id = $1)`, [id.carla]);
const sesionDe = async (atleta) => {
  const bl = (await db.query(`insert into bloques (atleta_id, nombre, estado) values ($1, 'Plan', 'activo') returning id`, [atleta])).rows[0].id;
  const se = (await db.query(`insert into semanas (bloque_id, numero, programacion) values ($1, 1, 'programada') returning id`, [bl])).rows[0].id;
  return (await db.query(`insert into sesiones (semana_id, orden, nombre) values ($1, 1, 'Día 1') returning id`, [se])).rows[0].id;
};
const sAna = await sesionDe(id.ana), sCarla = await sesionDe(id.carla);

console.log('\nLo que admite la columna');
await como('ana');
check(await hay110(b), 'la app ve que la base la admite');
const vale = async (p, m) => { const e = await falla(() => api.guardarPreparacion(sAna, p)); check(!e, `${m}${e ? ` (${e.message})` : ''}`); };
const noVale = async (p, m) => check(/sesiones_preparacion_valida|check constraint/i.test((await falla(() => api.guardarPreparacion(sAna, p)))?.message || ''), m);
await vale({ sueno: 1, energia: 2, molestias: 3 }, 'las tres preguntas, como siempre');
await vale({ cara: 'regular' }, 'de un toque: solo la cara');
await vale({ cara: 'bien', horas: 5.5, agujetas: true, asi: true }, 'con las horas (de media en media), las agujetas y lo que eligió');
await vale({ cara: 'mal', horas: null, asi: false }, 'las horas y lo que eligió, también vacíos');
await vale(null, 'y vaciarla');
await noVale({ cara: 'fatal' }, 'una cara que no es: no');
await noVale({ horas: 7 }, 'sin la cara: no');
await noVale({ cara: 'bien', horas: 1.5 }, 'menos de 2 horas: no');
await noVale({ cara: 'bien', horas: 15 }, 'más de 14: no');
await noVale({ cara: 'bien', horas: 7.3 }, 'horas que no van de media en media: no');
await noVale({ cara: 'bien', horas: '7' }, 'horas como texto: no');
await noVale({ cara: 'bien', agujetas: 'si' }, 'agujetas que no son sí o no: no');
await noVale({ cara: 'bien', nota: 'x' }, 'nada más: no');
await noVale({ cara: 'bien', sueno: 3 }, 'ni mezclada con las tres preguntas');
await noVale({ sueno: 1, energia: 2 }, 'las tres preguntas, incompletas: no (como en la 005)');
const fila = (await db.query('select preparacion from sesiones where id = $1', [sAna])).rows[0]?.preparacion;
check(fila === null || fila === undefined, 'después de vaciarla, vacía');

console.log('\nSu consentimiento de salud');
await como('carla');
check(/consentimiento/i.test((await falla(() => api.guardarPreparacion(sCarla, { cara: 'bien' })))?.message || ''), 'sin consentimiento de salud, no se guarda (como las tres preguntas)');
await como('ana');
check(/permission|row-level|0 filas|no existe|not found|No se ha/i.test((await falla(async () => { const r = await api.guardarPreparacion(sCarla, { cara: 'bien' }); if (!r) throw new Error('0 filas'); }))?.message || ''), 'y la de otra, tampoco');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
