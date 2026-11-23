// (v0.208) Lecturas que se cubren (web/src/datos/lecturas.js): lo que se saca en el móvil de todo el ámbito tiene que
// salir igual que si se pidiera a la base. Se comprueba contra el esquema real (PGlite, con RLS) con pesadas, check-ins,
// semanas y sesiones de un atleta, y una lista de filtros como los de la app; y, aparte, que lo que no se sabe hacer igual
// (texto ordenado, fechas con hora sin zona, columnas que no existen…) se deja a la base.
//   node test/lecturas.test.mjs
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import { AMPLIAR, ambitoDe, derivar, cubre, esCompleta, idsDe } from '../web/src/datos/lecturas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e?.stack || e); process.exit(1); });

console.log('Lo que no se sabe hacer igual que la base, se deja a la base');
{
  const filas = [{ id: 'b', atleta_id: 'a1', nombre: 'Zeta', fecha: '2026-11-02', kg: 70, creado_en: '2026-11-02T10:00:00+00:00' },
    { id: 'a', atleta_id: 'a1', nombre: 'ála', fecha: '2026-11-01', kg: null, creado_en: '2026-11-01T23:30:00+00:00' }];
  check(derivar(filas, { eq: { atleta_id: 'a1' }, order: [['nombre', 'asc']] }) === null, 'ordenar por un texto (la base ordena con su intercalación): a la base');
  check(derivar(filas, { eq: { atleta_id: 'a1' }, gte: { creado_en: '2026-11-02T00:00:00' } }) === null, 'una fecha con hora sin zona: a la base');
  check(derivar(filas, { eq: { atleta_id: 'a1' }, cols: 'id,no_existe' }) === null, 'una columna que no existe (la base daría error): a la base');
  check(derivar(filas, { eq: { atleta_id: 'a1' }, gte: { nombre: 'b' } }) === null, 'mayor que un texto: a la base');
  check(derivar([{ id: 'x', atleta_id: 'a1', fecha_realizada: '2026-09-12' }], { eq: { atleta_id: 'a1' }, gte: { fecha_realizada: '2026-09-12T12:00:00Z' } }) === null, 'una columna de fecha con una fecha y hora: a la base (la base convierte)');
  check(ambitoDe('pesos', { eq: { atleta_id: 'a1' }, or: 'x' }) === null && ambitoDe('series', { eq: { atleta_id: 'a1' }, cols: 'id,ejercicio:ejercicios(nombre)' }) === null, 'otros filtros o columnas relacionadas: ni se intenta');
  check(ambitoDe('comentarios', { eq: { atleta_id: 'a1' } }) === null, 'una tabla que no está en la lista: como siempre');
  const d = derivar(filas, { eq: { atleta_id: 'a1' }, order: [['kg', 'desc']], cols: 'id,kg' });
  check(JSON.stringify(d) === '[{"id":"b","kg":70},{"id":"a","kg":null}]', `bajando, los vacíos al final, como la base (${JSON.stringify(d)})`);
  const t = derivar(filas, { eq: { atleta_id: 'a1' }, gte: { creado_en: '2026-11-02' }, cols: 'id' });
  check(JSON.stringify(t) === '[{"id":"b"}]', 'fecha y hora desde un día: como instantes (la medianoche en UTC, como la base)');
  check(esCompleta('series', { eq: { atleta_id: 'a1' }, order: [['registrada_en', 'asc']] }) && !esCompleta('series', { eq: { atleta_id: 'a1' }, limit: 5 }), 'la lectura de todo el ámbito se reconoce (con orden, sí; con límite, no)');
  check(JSON.stringify(idsDe('sesiones', { in: { id: ['x', 'y', 'x'] }, cols: 'id' })) === '["x","y"]' && idsDe('atletas', { eq: { id: 'x' } }) === null, 'las pedidas por su identificador');
  const g = ambitoDe('sesiones', { in: { semana_id: ['s1', 's2', 's3'] } }), c = ambitoDe('sesiones', { eq: { semana_id: 's2' }, cols: 'id' });
  check(cubre(g, c) && !cubre(c, g), 'las sesiones de una semana están dentro de las de tres');
  check(AMPLIAR.series === undefined, 'las series nunca se piden enteras por esto (pueden ser miles)');
}

console.log('\nContra el esquema real: lo derivado sale igual que de la base');
const db = await crearPglite();
const b = crearBackendPglite(db);
const api = crearApi(b);
await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await b.sql(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const ana = await api.crearAtleta({ nombre: 'Ana Prueba', email: 'ana@fbe.test' });
const bloque = await api.nuevoBloque(ana.id, { nombre: 'Base', foco: 'adaptacion', fecha_inicio: '2026-09-07', semanas: 4, sesionesPorSemana: 3 });
// Pesadas (con huecos), check-ins y sesiones hechas a distintas horas (y alguna sin hacer)
for (let i = 0; i < 40; i++) {
  const f = new Date(Date.UTC(2026, 8, 1 + i * 2)).toISOString().slice(0, 10);
  await b.sql(`insert into pesos (atleta_id, fecha, kg) values ($1, $2, $3)`, [ana.id, f, i % 7 === 0 ? 71.5 : 70 + (i % 5) * 0.4]);
}
for (let i = 0; i < 6; i++) await b.sql(`insert into checkins (atleta_id, semana_inicio, energia, creado_en) values ($1, $2, $3, $4)`, [ana.id, new Date(Date.UTC(2026, 8, 7 + 7 * i)).toISOString().slice(0, 10), i % 3 === 0 ? null : 3 + (i % 2), new Date(Date.UTC(2026, 8, 8 + 7 * i, i % 2 ? 0 : 19, 30)).toISOString()]);
const sems = await b.select('semanas', { eq: { bloque_id: bloque.id }, order: [['numero', 'asc']] });
const sess = await b.select('sesiones', { in: { semana_id: sems.map((s) => s.id) } });
for (const [i, s] of sess.entries()) if (i % 3) await b.sql(`update sesiones set completada = true, fecha_realizada = $2 where id = $1`, [s.id, new Date(Date.UTC(2026, 8, 8 + i, i % 2 ? 0 : 18, 0, 0)).toISOString()]);
const lunes = sems.map((s) => s.fecha_inicio).filter(Boolean);
const CASOS = [
  ['pesos', { eq: { atleta_id: ana.id }, order: [['fecha', 'desc']], limit: 1 }],
  ['pesos', { eq: { atleta_id: ana.id }, cols: 'fecha' }],
  ['pesos', { eq: { atleta_id: ana.id, fecha: '2026-09-15' }, cols: 'id', limit: 1 }],
  ['pesos', { eq: { atleta_id: ana.id }, gte: { fecha: '2026-09-24' }, order: [['fecha', 'asc']] }],
  ['pesos', { eq: { atleta_id: ana.id }, gte: { fecha: '2026-09-10' }, lte: { fecha: '2026-10-01' }, order: [['kg', 'desc'], ['fecha', 'asc']] }],
  ['pesos', { eq: { atleta_id: ana.id, kg: 71.5 }, order: [['fecha', 'asc']] }],
  ['checkins', { eq: { atleta_id: ana.id, semana_inicio: '2026-09-14' } }],
  ['checkins', { eq: { atleta_id: ana.id }, cols: 'id', limit: 1 }],
  ['checkins', { eq: { atleta_id: ana.id }, nulo: ['energia'], cols: 'id,semana_inicio', order: [['semana_inicio', 'asc']] }],
  ['checkins', { eq: { atleta_id: ana.id }, nonulo: ['energia'], order: [['energia', 'desc'], ['semana_inicio', 'desc']] }],
  ['bloques', { eq: { atleta_id: ana.id, es_plantilla: false }, cols: 'id' }],
  ['semanas', { eq: { bloque_id: bloque.id }, order: [['numero', 'asc']] }],
  ['semanas', { in: { bloque_id: [bloque.id] }, gte: { fecha_inicio: lunes[1] || '2026-09-14' }, cols: 'id,numero' }],
  ['semanas', { eq: { bloque_id: bloque.id }, neq: { numero: 2 }, cols: 'id,numero', order: [['numero', 'desc']] }],
  ['sesiones', { in: { semana_id: sems.map((s) => s.id) }, eq: { completada: true }, order: [['fecha_realizada', 'desc']], cols: 'id,fecha_realizada' }],
  ['sesiones', { in: { semana_id: sems.slice(0, 2).map((s) => s.id) }, gte: { fecha_realizada: '2026-09-12' }, cols: 'id' }],
  // (fecha_realizada es una fecha: con una hora, a la base; creado_en de los check-ins sí es fecha y hora)
  ['checkins', { eq: { atleta_id: ana.id }, gte: { creado_en: '2026-09-15T12:00:00Z' }, lte: { creado_en: '2026-10-05T00:00:00+00:00' }, order: [['creado_en', 'asc']], cols: 'id,creado_en' }],
  ['checkins', { eq: { atleta_id: ana.id }, gte: { creado_en: '2026-09-22' }, order: [['creado_en', 'desc']], cols: 'id' }],
  ['sesiones', { in: { semana_id: sems.map((s) => s.id) }, nulo: ['fecha_realizada'], cols: 'id' }],
];
const ordenar = (xs, f) => (f.order?.length ? xs : [...xs].sort((a, c) => String(a.id ?? JSON.stringify(a)).localeCompare(String(c.id ?? JSON.stringify(c)))));
for (const [t, f] of CASOS) {
  const de = await b.select(t, f);
  const a = ambitoDe(t, f);
  const todo = await b.select(t, a.amplio);
  const der = derivar(todo, f);
  const bien = der !== null && JSON.stringify(ordenar(der, f)) === JSON.stringify(ordenar(de, f));
  check(bien, `${t} ${JSON.stringify({ ...f, eq: f.eq && Object.keys(f.eq), in: f.in && Object.keys(f.in) })}: ${de.length} filas${bien ? '' : ` (derivado: ${der === null ? 'null' : JSON.stringify(der).slice(0, 200)}; base: ${JSON.stringify(de).slice(0, 200)})`}`);
}

console.log('\nCon la app: lo de un mismo ámbito, una sola consulta');
{
  const cuenta = new Map();
  const contado = Object.create(b);
  contado.select = (t, f) => { cuenta.set(t, (cuenta.get(t) || 0) + 1); return b.select(t, f); };
  const api2 = crearApi(contado);
  const [ultimos, todos] = await Promise.all([api2.pesos(ana.id, 30), api2.pesos(ana.id)]);
  check(Array.isArray(ultimos) && Array.isArray(todos) && todos.length >= ultimos.length, `api.pesos con dos ventanas (${ultimos.length} y ${todos.length})`);
  check(cuenta.get('pesos') === 1, `las pesadas, una sola consulta a la base (${cuenta.get('pesos')})`);
}

console.log('\nSin conexión, ningún error sin recoger');
{
  // (la prueba completa lo vio: sin conexión, la lectura del ámbito entero que pedía el historial fallaba sin que nadie la
  // esperara, y salía el aviso «Sin conexión: no se ha podido hacer» al abrir la app)
  const sinRecoger = [];
  const apuntar = (e) => sinRecoger.push(String(e?.message || e));
  process.removeAllListeners('unhandledRejection');
  process.on('unhandledRejection', apuntar);
  const sinRed = () => Object.assign(new Error('Sin conexión.'), { sinConexion: true });
  const caido = { modo: 'prueba', url: 'x', auth: { sesion: () => ({ user: { id: 'u1' } }), alCambiar: () => () => {} },
    async select() { throw sinRed(); }, async rpc() { throw sinRed(); }, async insert() { throw sinRed(); }, async update() { throw sinRed(); }, async upsert() { throw sinRed(); }, async delete() { throw sinRed(); } };
  const api3 = crearApi(caido);
  const fallan = await Promise.all([api3.pesos('a1'), api3.pesos('a1', 30), api3.historial('a1'), api3.medidas('a1')].map((x) => Promise.resolve(x).then(() => false, (e) => e?.sinConexion === true)));
  await new Promise((r) => setTimeout(r, 50));
  check(fallan.every(Boolean) && !sinRecoger.length, `cada lectura falla para quien la pidió y ninguna queda sin recoger${sinRecoger.length ? ` (${sinRecoger.length}: ${sinRecoger[0]})` : ''}`);
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
