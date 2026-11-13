// El remate de La travesía, en la base (migración 063) en un Postgres local (PGlite) y en la demo: las rutas y las
// doradas del perfil, el fantasma de un compañero en la etapa del día, las ligas de la semana, el reto del coach y la
// fiesta de la manada. Uso: node test/travesia-remate-base.test.mjs
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

// ------------------------------------------------------------ en la demo (backend en memoria): lo mismo que la base
console.log('En la demo');
{
  const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
  const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
  const { crearApi } = await import('../web/src/datos/api.js');
  const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const api = crearApi(b);
  const lanza = async (fn) => { try { await fn(); return false; } catch { return true; } };
  await b.auth.entrar('ana@fbe.demo', 'demo');
  const ana = await api.miAtleta();
  const p1 = await api.guardarPerfilTravesia({ rango: 1, hechas: 1, activas: [], logros: {}, rutas: ['picos', 'camino', 'trampa'], doradas: 3 });
  const p2 = await api.guardarPerfilTravesia({ rango: 1, hechas: 1, activas: [], logros: {}, rutas: ['picos'], doradas: 1 });
  check(p1.rutas.join() === 'picos,camino' && p2.rutas.join() === 'picos,camino' && p2.doradas === 3, 'las rutas elegidas y las doradas se guardan y no se pierden');
  check(await api.fantasmaDelDia() === null && await api.ligaTravesia() === null && await api.equipoTravesia() === null, 'fuera de la comunidad, ni fantasma, ni liga, ni reto');
  await api.entrarComunidad('Ana L.');
  await api.etapaDelDia(300, 2, [0, 0, 20, 0, 40, 50]);
  const liga = await api.ligaTravesia();
  check(liga?.nivel === 0 && liga.grupo.some((f) => f.yo) && liga.grupo.length <= 5, `dentro, su liga de la semana (bronce, grupo de ${liga?.grupo?.length})`);
  const eq = await api.equipoTravesia();
  check(eq && eq.reto === null && typeof eq.semana === 'number', 'sin reto del coach, el equipo sin reto');
  check(await lanza(() => api.ponerRetoTravesia(40000, 'Hasta Covadonga')), 'un atleta no pone el reto del equipo');
  const datos = await api.exportar(ana.id);
  check(datos.travesia_liga?.length === 1 && datos.travesia_dia?.[0]?.rastro?.length === 6, 'la liga y el rastro van en la descarga de sus datos');
  check(await lanza(() => b.insert('travesia_liga', [{ atleta_id: ana.id, semana: '2026-11-09', nivel: 2 }])), 'nadie escribe su liga a mano');
  await b.auth.salir();
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  await api.ponerRetoTravesia(40000, 'Hasta Covadonga');
  const eq2 = await api.equipoTravesia();
  check(eq2.reto?.metros === 40000 && eq2.reto.texto === 'Hasta Covadonga', 'el coach pone el reto de la semana y lo ve');
  check(await lanza(() => api.ponerRetoTravesia(10, '')), 'con un mínimo de un kilómetro');
  await b.auth.salir();
}

const { PGlite } = await import('@electric-sql/pglite');
const { aplicarEsquema } = await import('./esquema.mjs');
const db = new PGlite();
await aplicarEsquema(db, { repetirMigraciones: true });
check(true, 'esquema y migraciones (con la 063) aplicados, también al repetirlas');
const claims = (uid, aal) => `select set_config('request.jwt.claim.sub', '${uid}', false); select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, aal }) : ''}', false);`;
const su = async () => db.exec(`reset role; ${claims('', '')}`);
const como = async (uid, aal = 'aal1') => db.exec(`reset role; ${claims(uid, aal)} set role authenticated;`);
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const falla = async (sql, params = []) => { try { await db.query(sql, params); return false; } catch { return true; } };
const anon = async (sql) => { await db.exec(`reset role; ${claims('', '')} set role anon;`); return falla(sql); };
const usuario = async (email) => { await su(); return (await q('insert into auth.users (email) values ($1) returning id', [email]))[0].id; };
const atleta = async (perfil, nombre) => { await su(); return (await q(`insert into public.atletas (nombre, perfil_id, estado) values ($1, $2, 'activo') returning id`, [nombre, perfil]))[0].id; };

const coach = await usuario('coach@x.test');
await q(`update public.perfiles set rol = 'coach', nombre = 'Coach' where id = $1`, [coach]);
const gente = {};
for (const n of ['Ana', 'Bea', 'Cai', 'Eva', 'Fer', 'Gil', 'Hugo', 'Iris', 'Juan']) { const u = await usuario(`${n.toLowerCase()}@x.test`); gente[n] = { u, a: await atleta(u, n) }; }
const fuera = await usuario('fuera@x.test'); const atletaFuera = await atleta(fuera, 'Fuera');
await su();
const [{ v: version }] = await q('select public.comunidad_version() as v'); const [{ v: normas }] = await q('select public.comunidad_normas_version() as v');
const [{ hoy, lunes }] = await q(`select (now() at time zone 'Europe/Madrid')::date::text as hoy, ((now() at time zone 'Europe/Madrid')::date - (extract(isodow from (now() at time zone 'Europe/Madrid')::date)::integer - 1))::text as lunes`);
const [{ antes }] = await q(`select ($1::date - 7)::text as antes`, [lunes]);

console.log('\nLas rutas y las doradas en el perfil del lobo');
{
  await como(gente.Ana.u);
  const r1 = (await q(`select guardar_travesia_perfil(1, 0, '[]', '{}', '{}', '{picos,camino,trampa}', 4) as r`))[0].r;
  check(r1.rutas.join() === 'picos,camino' && r1.doradas === 4, 'se guardan las rutas elegidas (solo las que hay) y las doradas');
  const r2 = (await q(`select guardar_travesia_perfil(1, 0, '[]', '{}', '{}', '{pirineos}', 1) as r`))[0].r;
  const r3 = (await q(`select guardar_travesia_perfil(1, 0, '[]', '{}', '{}') as r`))[0].r;
  check(r2.rutas.join() === 'picos,camino' && r2.doradas === 4 && r3.rutas.join() === 'picos,camino', 'un móvil con menos rutas o menos doradas no las pisa; uno de antes de la 063, tampoco');
  const r4 = (await q(`select guardar_travesia_perfil(1, 0, '[]', '{}', '{}', '{picos,pirineos}', 999999) as r`))[0].r;
  check(r4.rutas.join() === 'picos,pirineos' && r4.doradas === 100000, 'con las mismas rutas, la última elección; las doradas, con tope');
}

console.log('\nEl fantasma de un compañero');
await como(coach, 'aal2'); await q('update comunidad_ajustes set activa = true');
for (const [n, g] of Object.entries(gente)) { await como(g.u); await q('select comunidad_unirme($1, $2, $3)', [`${n} X.`, version, normas]); }
await su(); await q('update comunidad_miembros set sin_ranking = true where perfil_id = $1', [gente.Cai.u]);
{
  const rastro = (m) => `{${Array.from({ length: 8 }, (_, i) => `${Math.round(m * 10 * i / 7)},${i % 2 ? 80 : 0}`).join(',')}}`;
  await como(gente.Ana.u); await q(`select sumar_etapa_del_dia(450, 3, $1::smallint[])`, [rastro(450)]);
  await como(gente.Bea.u); await q(`select sumar_etapa_del_dia(600, 3, $1::smallint[])`, [rastro(600)]);
  await como(gente.Eva.u); await q(`select sumar_etapa_del_dia(800, 3, $1::smallint[])`, [rastro(800)]);
  await como(gente.Cai.u); await q(`select sumar_etapa_del_dia(700, 3, $1::smallint[])`, [rastro(700)]);
  await como(fuera); await q(`select sumar_etapa_del_dia(650, 3, $1::smallint[])`, [rastro(650)]);
  await como(gente.Fer.u); await q(`select sumar_etapa_del_dia(100, 0, '{1,2,3}'::smallint[])`);
  await su();
  check((await q('select rastro from travesia_dia where atleta_id = $1', [gente.Fer.a]))[0].rastro === null && (await q('select cardinality(rastro) as n from travesia_dia where atleta_id = $1', [gente.Ana.a]))[0].n === 16, 'el rastro se guarda solo si tiene sentido (parejas)');
  await como(gente.Ana.u);
  const f1 = (await q('select travesia_dia_fantasma() as f'))[0].f;
  check(f1?.nombre === 'Bea X.' && f1.metros === 600 && f1.rastro.length === 16, 'a Ana le toca el lobo de quien va justo por delante (Bea, no Eva)');
  await como(gente.Eva.u);
  check((await q('select travesia_dia_fantasma() as f'))[0].f?.nombre === 'Bea X.', 'quien va la primera corre con el mejor de los demás (nunca con quien no sale en el ranking ni con quien está fuera)');
  await como(gente.Gil.u);
  check((await q('select travesia_dia_fantasma() as f'))[0].f?.nombre === 'Ana X.', 'quien aún no ha corrido, con el que menos lleva (el que va justo por delante de cero)');
  await como(gente.Ana.u); await q(`select sumar_etapa_del_dia(300, 1, $1::smallint[])`, [rastro(300)]);
  await su();
  check((await q('select metros, cardinality(rastro) as n, rastro[15] as x from travesia_dia where atleta_id = $1', [gente.Ana.a]))[0].x === 4500, 'un intento peor no cambia el rastro guardado');
  await como(fuera);
  check((await q('select travesia_dia_fantasma() as f'))[0].f === null, 'fuera de la comunidad, sin fantasma');
  await como(coach, 'aal2');
  check((await q('select travesia_dia_fantasma() as f'))[0].f === null, 'el coach no corre la etapa del día');
  check(await anon('select travesia_dia_fantasma()'), 'sin sesión, nada');
}

console.log('\nLas ligas de la semana');
{
  // La semana pasada: cinco en bronce (Ana, Bea, Eva, Fer, Gil) y tres en plata (Hugo, Iris, Juan)
  await su();
  const nivelAntes = { Ana: 0, Bea: 0, Eva: 0, Fer: 0, Gil: 0, Hugo: 1, Iris: 1, Juan: 1 };
  const metrosAntes = { Ana: 900, Bea: 300, Eva: 0, Fer: 200, Gil: 100, Hugo: 50, Iris: 700, Juan: 400 };
  for (const [n, nivel] of Object.entries(nivelAntes)) {
    await q('insert into travesia_liga (atleta_id, semana, nivel) values ($1, $2, $3)', [gente[n].a, antes, nivel]);
    if (metrosAntes[n]) await q('insert into travesia_semanas (atleta_id, semana, metros) values ($1, $2, $3)', [gente[n].a, antes, metrosAntes[n]]);
  }
  await q(`insert into travesia_liga (atleta_id, semana, nivel) values ($1, $2::date - 35, 2)`, [gente.Ana.a, lunes]);
  await como(gente.Bea.u);
  const l = (await q('select travesia_liga() as l'))[0].l;
  await su();
  const niveles = Object.fromEntries((await q(`select a.nombre, l.nivel from travesia_liga l join atletas a on a.id = l.atleta_id where l.semana = $1`, [lunes])).map((x) => [x.nombre, x.nivel]));
  check(niveles.Ana === 1 && niveles.Bea === 0 && niveles.Gil === 0, `en bronce: el primero sube a plata y el último no baja (${JSON.stringify(niveles)})`);
  check(niveles.Iris === 2 && niveles.Juan === 1 && niveles.Hugo === 0, 'en plata (grupo de tres): el primero sube a oro y el último baja a bronce');
  check(niveles.Cai === undefined, 'quien no sale en el ranking no está en las ligas');
  check(l.nivel === 0 && l.grupo.some((f) => f.yo) && l.grupo.length >= 2 && l.grupo.length <= 5, `Bea ve su grupo de bronce (${l.grupo.length})`);
  check((await q('select count(*)::int as n from travesia_liga where semana < $1::date - 28', [lunes]))[0].n === 0, 'se guardan cuatro semanas');
  await como(gente.Ana.u); await q('select sumar_travesia(500, 2)');
  const la = (await q('select travesia_liga() as l'))[0].l;
  check(la.nivel === 1 && la.grupo.find((f) => f.yo)?.metros === 500 && la.grupo.every((f) => typeof f.nombre === 'string'), 'Ana, en plata, con lo que lleva esta semana');
  await como(gente.Cai.u);
  check((await q('select travesia_liga() as l'))[0].l.fuera === true, 'quien no sale en el ranking: «fuera»');
  await como(fuera);
  check((await q('select travesia_liga() as l'))[0].l === null, 'fuera de la comunidad, sin liga');
  await como(gente.Bea.u);
  check((await q('select * from travesia_liga'))[0] && (await q('select count(distinct atleta_id)::int as n from travesia_liga'))[0].n === 1, 'cada uno ve solo sus filas de la liga');
  check(await falla(`insert into travesia_liga (atleta_id, semana, nivel) values ('${gente.Bea.a}', '${lunes}', 2)`), 'nadie se pone de liga a mano');
  check(await anon('select travesia_liga()'), 'sin sesión, nada');
}

console.log('\nEl reto del coach y la fiesta de la manada');
{
  await como(gente.Ana.u);
  check(await falla(`select travesia_poner_reto(40000, 'Hasta Covadonga')`), 'un atleta no pone el reto');
  check((await q('select travesia_equipo() as e'))[0].e.reto === null, 'sin reto, nada');
  await como(coach, 'aal2');
  check(await falla(`select travesia_poner_reto(500, '')`) && await falla(`select travesia_poner_reto(20000000, '')`), 'el reto va de 1 a 10.000 km');
  await q(`select travesia_poner_reto(40000, $1)`, ['  Entre todos, hasta Covadonga  ' + 'x'.repeat(100)]);
  await como(gente.Bea.u); await q('select sumar_travesia(700, 1)');
  await como(gente.Ana.u);
  const e1 = (await q('select travesia_equipo() as e'))[0].e;
  check(e1.reto.metros === 40000 && e1.reto.texto.startsWith('Entre todos') && e1.reto.texto.length === 80 && e1.reto.hecho === 1200, `el reto, con lo que lleva el equipo esta semana (${e1.reto.hecho} m)`);
  check(e1.fiesta === null, 'sin meta del mes, sin fiesta');
  await como(coach, 'aal2'); await q('select travesia_poner_reto(30000)');
  check((await q('select metros from travesia_reto_equipo'))[0].metros === 30000, 'el coach lo cambia');
  // La meta del mes: 15 km por cada uno que ha corrido (como poco 50 km). Hugo corre 150 km esta semana
  await su(); await q(`insert into travesia_semanas (atleta_id, semana, metros) values ($1, $2, 150000) on conflict (atleta_id, semana) do update set metros = 150000`, [gente.Hugo.a, lunes]);
  await como(gente.Ana.u);
  const e2 = (await q('select travesia_equipo() as e'))[0].e;
  const mes = `${hoy.slice(0, 7)}-01`;
  // (si la semana empezó el mes pasado, su jueves puede caer en otro mes: entonces no cuenta para este)
  const [{ jueves }] = await q(`select to_char($1::date + 3, 'YYYY-MM') as jueves`, [lunes]);
  if (jueves === hoy.slice(0, 7)) check(e2.fiesta?.mes === mes && e2.fiesta.dia === hoy, 'el equipo cumple la meta del mes: hoy es el día de la fiesta');
  else check(true, '(esta semana cuenta para otro mes: la fiesta se prueba otro día)');
  await como(fuera);
  check((await q('select travesia_equipo() as e'))[0].e === null, 'fuera de la comunidad, nada');
  await como(gente.Ana.u);
  check((await q('select * from travesia_reto_equipo')).length === 0 && (await q('select * from travesia_fiesta')).length === 0, 'el reto y la fiesta no se leen de la tabla, solo con su función');
  check(await anon('select travesia_equipo()') && await anon(`select travesia_poner_reto(40000)`), 'sin sesión, nada');
  await como(coach, 'aal2'); await q('select travesia_poner_reto(0)');
  check((await q('select count(*)::int as n from travesia_reto_equipo'))[0].n === 0, 'con 0, el reto se quita');
}

console.log('\nAl borrar');
{
  await su(); await q('delete from atletas where id = $1', [gente.Ana.a]);
  check((await q('select count(*)::int as n from travesia_liga where atleta_id = $1', [gente.Ana.a]))[0].n === 0, 'al borrar la ficha, se van sus ligas');
  void atletaFuera;
  check((await q(`select count(*)::int as n from fbe_migraciones where numero = 63`))[0].n === 1, 'la 063 queda apuntada');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
