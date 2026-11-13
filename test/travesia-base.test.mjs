// La travesía al nivel de los mejores, en la base (migración 062) en un Postgres local (PGlite): el rango y los logros que
// se juntan sin pisarse, la etapa del día (tres intentos, cuenta el mejor) y su clasificación, y aullar a un compañero.
// Uso: node test/travesia-base.test.mjs
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
  const p1 = await api.guardarPerfilTravesia({ rango: 1, hechas: 3, activas: [{ id: 'lejos', valor: 200 }], logros: { km1: '2026-11-10' }, potenciadores: ['iman'] });
  const p2 = await api.guardarPerfilTravesia({ rango: 1, hechas: 1, activas: [{ id: 'lejos', valor: 90 }], logros: { nocturno: '2026-11-12' }, potenciadores: ['luna'] });
  check(p1.rango === 1 && p2.activas[0].valor === 200 && p2.logros.km1 && p2.logros.nocturno && p2.hechas === 3 && p2.potenciadores.length === 2, 'el rango y los logros se juntan como en la base');
  const d1 = await api.etapaDelDia(300, 3), d2 = await api.etapaDelDia(500, 4), d3 = await api.etapaDelDia(100), d4 = await api.etapaDelDia(900);
  check(d1.intentos === 1 && d2.metros === 500 && d3.intentos === 3 && d4.metros === 500, 'la etapa del día: tres intentos, cuenta el mejor');
  check(await api.clasifEtapaDelDia() === null, 'fuera de la comunidad, sin clasificación del día');
  await api.entrarComunidad('Ana L.');
  const c = await api.clasifEtapaDelDia();
  check(c.filas.some((f) => f.yo && f.metros === 500), 'dentro, la clasificación del día (con su intento)');
  const m = await api.travesiaManada();
  const otro = m.filas.find((f) => !f.yo && f.perfil);
  check(otro && await api.aullar(otro.perfil) === true && await lanza(() => api.aullar(otro.perfil)), `aúlla a ${otro?.nombre} (una vez al día)`);
  const datos = await api.exportar(ana.id);
  check(datos.travesia_perfil?.length === 1 && datos.travesia_dia?.length === 1, 'el rango y la etapa del día van en la descarga de sus datos');
  check(await lanza(() => b.insert('travesia_perfil', [{ atleta_id: ana.id, rango: 9 }])) && await lanza(() => b.insert('travesia_dia', [{ atleta_id: ana.id, dia: '2026-11-13', metros: 2000 }])), 'nadie las escribe a mano');
  await b.auth.salir();
}

const { PGlite } = await import('@electric-sql/pglite');
const { aplicarEsquema } = await import('./esquema.mjs');
const db = new PGlite();
await aplicarEsquema(db, { repetirMigraciones: true });
check(true, 'esquema y migraciones (con la 062) aplicados, también al repetirlas');
const claims = (uid, aal) => `select set_config('request.jwt.claim.sub', '${uid}', false); select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, aal }) : ''}', false);`;
const su = async () => db.exec(`reset role; ${claims('', '')}`);
const como = async (uid, aal = 'aal1') => db.exec(`reset role; ${claims(uid, aal)} set role authenticated;`);
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const falla = async (sql, params = []) => { try { await db.query(sql, params); return false; } catch { return true; } };
const anon = async (sql) => { await db.exec(`reset role; ${claims('', '')} set role anon;`); return falla(sql); };
const usuario = async (email) => { await su(); return (await q('insert into auth.users (email) values ($1) returning id', [email]))[0].id; };
const atleta = async (perfil, nombre, estado = 'activo') => { await su(); return (await q(`insert into public.atletas (nombre, perfil_id, estado) values ($1, $2, $3) returning id`, [nombre, perfil, estado]))[0].id; };

const coach = await usuario('coach@x.test');
await q(`update public.perfiles set rol = 'coach', nombre = 'Coach' where id = $1`, [coach]);
const ana = await usuario('a@x.test'); const atletaA = await atleta(ana, 'Ana');
const bea = await usuario('b@x.test'); const atletaB = await atleta(bea, 'Bea');
const cai = await usuario('c@x.test'); await atleta(cai, 'Cai');
const dan = await usuario('d@x.test'); await atleta(dan, 'Dan', 'baja');
const eva = await usuario('e@x.test'); await atleta(eva, 'Eva');
const suelto = await usuario('s@x.test');

console.log('\nEl rango, las misiones y los logros');
{
  await como(ana);
  const [{ r: r1 }] = await q(`select guardar_travesia_perfil(1, 3, '[{"id":"lejos","valor":200},{"id":"etapas","valor":2},{"id":"rio1","valor":0}]', '{"km1":"2026-11-10"}', '{iman}') as r`);
  check(r1.rango === 1 && r1.activas.length === 3 && r1.logros.km1 === '2026-11-10' && r1.potenciadores.join() === 'iman', 'se guarda lo del móvil (rango, misiones, logros y potenciadores)');
  // Otro móvil, con el mismo rango y otro avance: se junta (cada misión, el valor más alto; los logros, los dos)
  const [{ r: r2 }] = await q(`select guardar_travesia_perfil(1, 2, '[{"id":"lejos","valor":100},{"id":"etapas","valor":4},{"id":"rio1","valor":1}]', '{"km1":"2026-11-12","nocturno":"2026-11-12"}', '{luna}') as r`);
  const v = Object.fromEntries(r2.activas.map((a) => [a.id, a.valor]));
  check(v.lejos === 200 && v.etapas === 4 && v.rio1 === 1 && r2.hechas === 3, 'dos móviles con el mismo rango: cada misión con el valor más alto (y las hechas, el máximo)');
  check(r2.logros.km1 === '2026-11-10' && r2.logros.nocturno === '2026-11-12' && r2.potenciadores.sort().join() === 'iman,luna', 'los logros de los dos (con la fecha más antigua) y todos los potenciadores');
  // Un móvil viejo, con un rango menor, no baja el rango ni pisa las misiones
  // (revisión) los logros, con tope: muchas llamadas con logros inventados no hacen crecer la fila sin fin; ni fechas imposibles
  for (let n = 0; n < 4; n++) {
    const muchos = JSON.stringify(Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`x${n}y${i}`, '2026-11-12'])));
    await q('select guardar_travesia_perfil(1, 3, $1::jsonb, $2::jsonb, $3)', ['[]', muchos, '{}']);
  }
  const [{ n: nLogros }] = await q(`select count(*)::int as n from travesia_perfil, jsonb_object_keys(logros)`);
  const [{ r: rMal }] = await q(`select guardar_travesia_perfil(1, 3, '[]', '{"raro":"9999-99-99"}', '{}') as r`);
  check(nLogros <= 100 && !('raro' in rMal.logros), `los logros, con tope (${nLogros}) y sin fechas imposibles`);
  await su(); await q(`update travesia_perfil set logros = '{"km1":"2026-11-10","nocturno":"2026-11-12"}'::jsonb`); await como(ana);
  const [{ r: r3 }] = await q(`select guardar_travesia_perfil(0, 0, '[{"id":"limpia","valor":1}]', '{}', '{}') as r`);
  check(r3.rango === 1 && r3.activas.some((a) => a.id === 'lejos'), 'un móvil con un rango menor no lo baja ni pisa sus misiones');
  const [{ r: r4 }] = await q(`select guardar_travesia_perfil(2, 6, '[{"id":"combo","valor":0}]', '{}', '{}') as r`);
  check(r4.rango === 2 && r4.activas.length === 1 && r4.activas[0].id === 'combo' && r4.logros.km1, 'con un rango mayor, sus misiones nuevas (y los logros se quedan)');
  // Lo que llega raro se limpia
  const [{ r: r5 }] = await q(`select guardar_travesia_perfil(5000, -3, '[{"id":"<script>","valor":9},{"id":"a","valor":99999999999},{"id":"b"},{"id":"c"},{"id":"d"}]', '{"inventado!":"ayer","ok":"2026-01-01"}', '{iman,trampa}') as r`);
  check(r5.rango === 999 && r5.activas.length <= 3 && !r5.activas.some((a) => a.id === '<script>') && !('inventado!' in r5.logros) && r5.logros.ok && !r5.potenciadores.includes('trampa'), 'lo que llega raro se limpia (topes, ids, fechas y potenciadores)');
  await como(bea);
  check((await q('select * from travesia_perfil')).length === 0, 'cada atleta ve solo lo suyo');
  await como(coach, 'aal2');
  check((await q('select * from travesia_perfil')).length === 1, 'el coach lo ve');
  await como(dan);
  check((await q(`select guardar_travesia_perfil(1, 0, '[]', '{}', '{}') as r`))[0].r === null, 'de baja, no se guarda nada');
  await como(suelto);
  check((await q(`select guardar_travesia_perfil(1, 0, '[]', '{}', '{}') as r`))[0].r === null, 'sin ficha de atleta, tampoco');
  check(await falla(`insert into travesia_perfil (atleta_id) values ('${atletaB}')`), 'nadie escribe la tabla a mano');
  check(await anon(`select guardar_travesia_perfil(1, 0, '[]', '{}', '{}')`) && await anon('select * from travesia_perfil'), 'sin sesión, nada');
}

console.log('\nLa etapa del día');
await su();
const [{ v: version }] = await q('select public.comunidad_version() as v'); const [{ v: normas }] = await q('select public.comunidad_normas_version() as v');
await como(coach, 'aal2'); await q('update comunidad_ajustes set activa = true');
for (const [u, nombre] of [[ana, 'Ana L.'], [bea, 'Bea M.'], [cai, 'Cai R.']]) { await como(u); await q('select comunidad_unirme($1, $2, $3)', [nombre, version, normas]); }
{
  await como(ana);
  const i1 = (await q('select sumar_etapa_del_dia(320, 4) as r'))[0].r;
  const i2 = (await q('select sumar_etapa_del_dia(450, 6) as r'))[0].r;
  const i3 = (await q('select sumar_etapa_del_dia(200, 9) as r'))[0].r;
  const i4 = (await q('select sumar_etapa_del_dia(900, 9) as r'))[0].r;
  check(i1.intentos === 1 && i2.metros === 450 && i3.metros === 450 && i3.estrellas === 6 && i3.intentos === 3, 'tres intentos al día: cuenta el mejor (y sus estrellas)');
  check(i4.intentos === 3 && i4.metros === 450, 'un cuarto intento no cuenta');
  check((await q('select sumar_etapa_del_dia(999999) as r'))[0].r.metros === 450, 'con topes');
  await como(bea); await q('select sumar_etapa_del_dia(600, 8)');
  await como(cai); await q('select sumar_etapa_del_dia(500, 1)');
  await como(eva); await q('select sumar_etapa_del_dia(800, 1)');
  await su(); await q('update comunidad_miembros set sin_ranking = true where perfil_id = $1', [cai]);
  await como(ana);
  const [{ c }] = await q('select travesia_dia_clasif() as c');
  check(c.filas.length === 2 && c.filas[0].nombre === 'Bea M.' && c.filas[0].metros === 600 && c.filas[1].yo && !c.filas.some((f) => f.nombre === 'Cai R.'), 'la clasificación del día: los de la comunidad, de más a menos; quien no sale en el ranking, no; quien está fuera, tampoco');
  await como(cai);
  check((await q('select travesia_dia_clasif() as c'))[0].c.filas.some((f) => f.yo && f.metros === 500), 'quien no sale en el ranking sí se ve a sí mismo');
  await como(eva);
  check((await q('select travesia_dia_clasif() as c'))[0].c === null, 'fuera de la comunidad, sin clasificación (pero su intento queda)');
  // Los de hace más de ocho días se borran al apuntar
  await su(); await q(`insert into travesia_dia (atleta_id, dia, metros, intentos) values ($1, current_date - 20, 100, 1)`, [atletaA]);
  await como(ana); await q('select sumar_etapa_del_dia(10)');
  check((await q('select count(*)::int as n from travesia_dia where dia < current_date - 8'))[0].n === 0, 'solo se guardan los últimos ocho días');
  check(await anon('select sumar_etapa_del_dia(10)') && await anon('select travesia_dia_clasif()'), 'sin sesión, nada');
  // (revisión) borrar lo de hoy no da intentos de más; y el tope de un minuto
  await como(ana); await q('delete from travesia_dia');
  const [{ r: tras }] = await q('select sumar_etapa_del_dia(700) as r');
  check(tras.intentos === 3 && tras.metros === 450, 'el atleta no borra lo de hoy (no le daría intentos de más)');
  await como(bea);
  check((await q('select sumar_etapa_del_dia(5000) as r'))[0].r.metros === 800, 'como mucho 800 m: lo que da de sí un minuto');
  // (revisión) lo caducado se borra aunque su dueño no vuelva a jugar
  await su(); await q(`insert into travesia_dia (atleta_id, dia, metros, intentos) values ($1, current_date - 12, 100, 1)`, [atletaB]);
  await como(ana); await q('select sumar_etapa_del_dia(10)');
  check((await q('select count(*)::int as n from travesia_dia where dia < current_date - 7'))[0].n === 0, 'lo de hace más de ocho días se borra, de todos');
  await su(); await q(`insert into travesia_dia (atleta_id, dia, metros, intentos) values ($1, current_date - 12, 100, 1)`, [atletaB]);
  await q('select fbe_privado.travesia_limpiar()');
  check((await q('select count(*)::int as n from travesia_dia where dia < current_date - 7'))[0].n === 0, 'y también con la limpieza diaria (aunque nadie juegue)');
  await como(ana); check(await falla('select fbe_privado.travesia_limpiar()'), 'la limpieza no la lanza un atleta');
}

console.log('\nAullar a un compañero');
{
  await como(ana);
  const [{ m }] = await q('select travesia_manada() as m');
  // (Ana aún no tiene metros esta semana en la manada: se le suman para salir)
  await q('select sumar_travesia(400, 2)');
  await como(bea); await q('select sumar_travesia(900, 4)');
  await como(ana);
  const [{ m: m2 }] = await q('select travesia_manada() as m');
  const beaFila = m2.filas.find((f) => f.nombre === 'Bea M.'), yo = m2.filas.find((f) => f.yo);
  check(beaFila?.perfil === bea && yo && yo.perfil === null && Array.isArray(m?.filas), 'la manada lleva el perfil de cada uno (para aullarle), el mío no');
  await q('select travesia_aullar($1)', [bea]);
  check(await falla('select travesia_aullar($1)', [bea]), 'una vez por compañero y día');
  check(await falla('select travesia_aullar($1)', [ana]), 'a uno mismo, no');
  check(await falla('select travesia_aullar($1)', [cai]), 'a quien no sale en el ranking, no');
  check(await falla('select travesia_aullar($1)', [eva]), 'a quien está fuera de la comunidad, no');
  // (revisión) borrar lo mandado no da aullidos de más
  await q('delete from travesia_aullidos');
  check(await falla('select travesia_aullar($1)', [bea]), 'quien aúlla no borra sus aullidos (no le daría otro)');
  await como(coach, 'aal2');
  check(await falla('select travesia_aullar($1)', [bea]), 'el coach no aúlla (no le llegaría a nadie)');
  await su(); await q(`update comunidad_miembros set silenciado_hasta = now() + interval '1 day' where perfil_id = $1`, [bea]);
  await como(bea);
  check(await falla('select travesia_aullar($1)', [ana]), 'quien está silenciado no aúlla');
  await su(); await q('update comunidad_miembros set silenciado_hasta = null where perfil_id = $1', [bea]);
  await como(bea);
  const [{ r }] = await q('select travesia_aullidos_recibidos() as r');
  check(r.length === 1 && r[0].nombre === 'Ana L.', 'a Bea le llega el aullido, con el nombre de la comunidad de quien aúlla');
  await su(); await q('update comunidad_ajustes set activa = false'); await como(bea);
  check((await q('select travesia_aullidos_recibidos() as r'))[0].r.length === 0, 'con la comunidad cerrada (o fuera de ella), no le llega');
  await su(); await q('update comunidad_ajustes set activa = true'); await como(bea);
  check((await q('select * from travesia_aullidos')).length === 0, 'los recibidos no se leen de la tabla, solo con su función');
  await como(eva);
  check(await falla('select travesia_aullar($1)', [bea]), 'quien está fuera de la comunidad no aúlla');
  await como(cai);
  check((await q('select travesia_aullidos_recibidos() as r'))[0].r.length === 0, 'a los demás no les llega nada');
  await su(); await q('delete from atletas where perfil_id = $1', [ana]);
  await como(bea);
  check((await q('select travesia_aullidos_recibidos() as r'))[0].r.length === 0 && (await q('select count(*)::int as n from travesia_perfil'))[0].n === 0, 'al borrar la ficha, se va su perfil del juego y sus aullidos');
  check(await anon('select travesia_aullar(gen_random_uuid())') && await anon('select travesia_aullidos_recibidos()'), 'sin sesión, nada');
  await su();
  check((await q(`select count(*)::int as n from fbe_migraciones where numero = 62`))[0].n === 1, 'la 062 queda apuntada');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
