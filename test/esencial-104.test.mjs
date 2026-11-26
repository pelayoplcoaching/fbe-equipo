// FBE Esencial, migración 104, contra el esquema real (PGlite, con RLS): la comida acompañada. La nota 'celebracion' (cada
// atleta, la suya), la comida en tu panel (solo recuentos y solo el coach) y el aviso «¿Te pesas esta semana?» (nunca con
// antecedente de TCA, una vez por semana, no si se ha pesado y dentro del tope de avisos).
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import * as datos from '../web/src/datos/api-esencial.js';
import { panelComida } from '../web/src/logica/esencial-comida.js';
import { hoyISO, sumarDias, lunesDe, fechaMadrid } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.message); process.exit(1); });
if (hoyISO() !== fechaMadrid()) { console.log('  (ahora mismo, el día de este ordenador no es el de Madrid: se salta)'); process.exit(0); }
const db = await crearPglite();
const b = crearBackendPglite(db);
const api = crearApi(b);
const q = (sql, p = []) => b.sql(sql, p);
const SQL = (n) => readFileSync(new URL(`../supabase/migraciones/${n}`, import.meta.url), 'utf8');
const falla = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };
const superusuario = `reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`;
const servidor = `${superusuario} set role service_role;`;
const hoy = hoyISO(), lunes = lunesDe(hoy);
await db.exec('reset role;');
await db.exec('delete from fbe_migraciones where numero > 104;');
await db.exec(SQL('104_esencial_comida.sql'));
await db.exec(SQL('104_esencial_comida.sql'));   // (se puede repetir)

console.log('La 104');
await db.exec(superusuario);
const priv = (await db.query(`select has_function_privilege('anon', 'public.esencial_comida_panel()', 'execute') a1,
  has_function_privilege('authenticated', 'public.esencial_comida_panel()', 'execute') u1, (select max(numero) from fbe_migraciones) n`)).rows[0];
check(!priv.a1 && priv.u1 && Number(priv.n) === 104, 'sin sesión, nada; la base queda en la 104');
{
  const de = (txt) => { const i = txt.lastIndexOf('create or replace function public.crear_recordatorios(p_ahora'); return txt.slice(i, txt.indexOf('\nend $$;', i)); };
  const f103 = de(SQL('103_esencial_panel.sql')), f104 = de(SQL('104_esencial_comida.sql'));
  const i = f104.indexOf('  -- (104) FBE Esencial con nutrición'), j = f104.indexOf('  -- (103) Tu lunes de FBE Esencial:');
  check(i > 0 && j > i && f104.slice(0, i) + f104.slice(j) === f103 && /fbe_privado\.esencial_tope\(a\.id, v_hoy\)/.test(f104.slice(i, j)) && /c\.tca is false/.test(f104.slice(i, j)),
    'crear_recordatorios es la de la 103 con el aviso para pesarse (con el tope y solo sin antecedente de TCA) antes de «Tu lunes»');
}

await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
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
// Ana y Berta llevan nutrición, con su plan de comida desde hace diez días; Berta tiene antecedente de TCA. Carla, sin nutrición
await db.exec(superusuario);
for (const [n, tca] of [['ana', false], ['berta', true]]) {
  await db.query('update atletas set nutricion = true where id = $1', [id[n]]);
  await db.query('insert into cuestionarios (atleta_id, tca) values ($1, $2) on conflict (atleta_id) do update set tca = excluded.tca', [id[n], tca]);
  await db.query(`insert into planes_nutricion (atleta_id, desde, modo, fase, ritmo_pct, kcal, proteina_g, carbos_g, grasa_g, motivo)
    values ($1, $2, 'macros', $3, $4, 1838, 130, 190, 62, 'Plan de partida, con tus datos.')`, [id[n], sumarDias(hoy, -10), tca ? 'mantener' : 'perder', tca ? 0 : -0.5]);
  await db.query('insert into pesos (atleta_id, fecha, kg) values ($1, $2, 70.2)', [id[n], sumarDias(hoy, -9)]);
}
await db.query('update atletas set nutricion = false where id = $1', [id.carla]);
await db.query(`insert into planes_nutricion (atleta_id, desde, modo, fase, ritmo_pct, kcal, proteina_g, carbos_g, grasa_g, motivo)
  values ($1, $2, 'macros', 'perder', -0.5, 1690, 130, 153, 62, 'Ajuste de la semana: gastas unas 2040 kcal al día y, para bajar un 0,5 % del peso a la semana, te tocan unas 1690: bajas 148 kcal.')`, [id.ana, sumarDias(hoy, -2)]);
await db.query(`insert into registros_nutricion (atleta_id, fecha, kcal, proteina_g) values ($1, $2, 1700, 120), ($1, $3, 1750, 125)`, [id.ana, sumarDias(hoy, -1), sumarDias(hoy, -2)]);

console.log('\nUna celebración (110): la nota de cada uno');
await como('ana');
const n1 = await datos.anotar(b, id.ana, 'celebracion', { desde: sumarDias(hoy, 3), hasta: sumarDias(hoy, 3) });
check(n1?.id && n1.tipo === 'celebracion' && n1.desde === sumarDias(hoy, 3), 'Ana apunta su celebración (el día, en desde y hasta)');
let e = await falla(() => datos.anotar(b, id.berta, 'celebracion', { desde: hoy, hasta: hoy }));
check(!!e, 'no puede apuntar una a nombre de otra persona');
e = await falla(() => datos.anotar(b, id.ana, 'comida_secreta', {}));
check(!!e, 'ni un tipo de nota que no existe');
check((await datos.notas(b, id.ana, 'celebracion')).length === 1, 'y la lee (la suya)');

console.log('\nLa comida en tu panel (118): solo recuentos y solo el coach');
check((await datos.comidaPanel(b)).length === 0, 'un atleta no ve nada (ni lo suyo)');
await como('coach');
const filas = await datos.comidaPanel(b);
const fa = filas.find((f) => f.atleta_id === id.ana), fb = filas.find((f) => f.atleta_id === id.berta);
check(filas.length === 2 && !filas.some((f) => f.atleta_id === id.carla), 'Pelayo ve a las dos que llevan nutrición (Carla no lleva)');
check(fa.plan === true && fa.tca === false && fa.pesadas_14 === 1 && fa.dias_7 === 2 && fa.ajustes === 1 && fa.ajustes_7 === 1, `Ana: plan, una pesada en dos semanas, dos días apuntados y un ajuste de la app esta semana (${JSON.stringify(fa)})`);
check(fb.tca === true && fb.ajustes === 0 && Object.keys(fb).sort().join() === 'ajustes,ajustes_7,atleta_id,dias_7,pesadas_14,plan,tca', 'Berta, con su antecedente; y nada más que recuentos (ni pesos ni lo que come)');
const pc = panelComida(filas, { [id.ana]: 'Ana', [id.berta]: 'Berta' });
check(pc.total === 2 && pc.conPlan === 2 && pc.sinPesar.length === 0 && pc.ajustes === 1, 'en el panel: dos con plan, nadie «sin pesarse» (las dos tienen una pesada en dos semanas), un ajuste');

console.log('\n«¿Te pesas esta semana?» (108)');
await db.exec(superusuario);
const P = {};
for (const n of ['ana', 'berta']) {
  P[n] = (await db.query('select perfil_id from atletas where id = $1', [id[n]])).rows[0].perfil_id;
  await db.query(`insert into preferencias_notificaciones (usuario_id, email, silencio_desde, silencio_hasta) values ($1, true, null, null) on conflict (usuario_id) do update set email = true`, [P[n]]);
}
const llamar = async (h) => { await db.exec(servidor); await db.query('select public.crear_recordatorios($1::timestamptz)', [`${hoy} ${h}:00 Europe/Madrid`]); await db.exec(superusuario); };
const avisos = async (n) => (await db.query(`select tipo, titulo, cuerpo, url from notificaciones where usuario_id = $1 and clave = $2`, [P[n], `esencial_pesarse:${lunes}`])).rows;
await llamar('07:00');
check((await avisos('ana')).length === 0, 'antes de su hora de la mañana, nada');
await llamar('09:00');
const a1 = await avisos('ana');
check(a1.length === 1 && a1[0].tipo === 'nutricion' && a1[0].titulo === '¿Te pesas esta semana?' && a1[0].url === '#hoy/pesarme' && a1[0].cuerpo.length <= 160,
  'Ana, nueve días sin pesarse y su plan de hace diez: «¿Te pesas esta semana?», que lleva a «¿Cuándo me peso?»');
check((await avisos('berta')).length === 0, 'Berta, con antecedente de TCA, nunca');
await llamar('09:30');
check((await avisos('ana')).length === 1, 'una vez por semana (no se repite)');
await db.query('delete from notificaciones where clave = $1', [`esencial_pesarse:${lunes}`]);
await db.query('insert into pesos (atleta_id, fecha, kg) values ($1, $2, 70.0)', [id.ana, sumarDias(hoy, -1)]);
await llamar('09:00');
check((await avisos('ana')).length === 0, 'si se ha pesado en la última semana, no');
await db.query('delete from pesos where atleta_id = $1 and fecha = $2', [id.ana, sumarDias(hoy, -1)]);
await db.query(`insert into notificaciones (usuario_id, tipo, titulo, clave, enviar_desde, caduca_en) values ($1, 'sesion_hoy', 'Hoy toca', 'esencial_prueba:1', now(), now() + interval '1 day')`, [P.ana]);
await db.query(`insert into esencial_ajustes (clave, encendido) values ('tope_dia', true)`);
await llamar('09:00');
check((await avisos('ana')).length === 0, 'con «como mucho un aviso al día» encendido y otro ya hoy, tampoco');
await db.query(`delete from esencial_ajustes where clave = 'tope_dia'`);
await llamar('09:00');
check((await avisos('ana')).length === 1, 'sin el tope, sí');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
