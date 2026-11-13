// Los descansos en la base: la migración 060 en un Postgres local (PGlite): la novedad de la semana, la travesía por
// semanas y los apuntes vistos, con sus permisos. Uso: node test/descansos.test.mjs
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

// ------------------------------------------------------------ la lógica: novedades y lo que va y viene de la base
import { apuntesDeNovedades, novedadPendiente, elegirApunte, apunteDelDia, apuntarVisto, limpiarVistos, pendienteDeSubir, conServidor } from '../web/src/logica/apuntes.js';
import { sumarEtapa, porSubir, trasSubir, conBase, metrosDeLaSemana, limpiarTravesia, prepararEnvio } from '../web/src/logica/travesia.js';
import { ENLACE_NOVEDAD } from '../web/src/logica/apuntes.js';

console.log('La novedad de la semana, como apunte');
{
  const hoy = '2026-11-12';
  const filas = [
    { id: 'a1', titulo: 'Vieja', texto: 'De hace un mes.', publicada: true, publicada_en: '2026-10-10T09:00:00Z' },
    { id: 'a2', titulo: 'Dormir poco resta **fuerza**', texto: 'Un ensayo: tras dormir 4 horas, menos repeticiones.', fuente: 'Apellido et al., Revista, 2026', enlace: 'https://pubmed.ncbi.nlm.nih.gov/1/', publicada: true, publicada_en: '2026-11-10T09:00:00Z' },
    { id: 'a3', titulo: 'Borrador', texto: 'x', publicada: false, publicada_en: null },
    { id: 'a4', titulo: 'Con enlace raro', texto: 'x', enlace: 'javascript:alert(1)', publicada: true, publicada_en: '2026-10-20T09:00:00Z' },
  ];
  const n = apuntesDeNovedades(filas);
  check(n.length === 3 && n[0].id === 'n:a2' && n[0].tipo === 'novedad' && n[0].titulo === 'Dormir poco resta fuerza' && n[0].fuente.startsWith('Apellido') && n[0].enlace === 'https://pubmed.ncbi.nlm.nih.gov/1/' && n[0].dia === '2026-11-10', 'las publicadas, la última primero, con su fuente y su enlace (los borradores, no)');
  check(n.find((x) => x.id === 'n:a4').enlace === null, 'un enlace que no es https no sale');
  const ideas = [{ id: 'i:a:0', tipo: 'idea', titulo: 'A', texto: 'a' }, { id: 'p:f:0', tipo: 'clave', titulo: '', texto: 'c' }];
  const todos = [...n, ...ideas];
  check(novedadPendiente(todos, null, hoy)?.id === 'n:a2' && elegirApunte(todos, null, { hoy }).id === 'n:a2', 'la de esta semana que aún no ha visto sale la primera en el descanso');
  const visto = apuntarVisto(null, 'n:a2', hoy);
  check(novedadPendiente(todos, visto, hoy) === null && elegirApunte(todos, visto, { hoy, excluir: ['n:a2'] }).id === 'p:f:0', 'una vez vista, lo de siempre (las antiguas no salen solas)');
  check(apunteDelDia(todos, hoy, null).id === 'n:a2' && apunteDelDia(todos, hoy, visto).id === 'n:a2' && apunteDelDia(todos, '2026-11-13', visto).id === 'i:a:0', 'es el apunte del día hasta que la lee (y ese día, también); después, uno de las guías');
  check(novedadPendiente(todos, null, '2026-11-30') === null && apunteDelDia(todos, '2026-11-20', null).id === 'i:a:0', 'pasados unos días ya no se adelanta');
}

console.log('Los apuntes vistos, con la base');
{
  let e = apuntarVisto(null, 'i:a:0', '2026-11-10');
  e = pendienteDeSubir(e, 'i:a:0', null);
  e = pendienteDeSubir(e, 'm:1', false);
  check(e.porSubir['m:1'] === false && e.porSubir['i:a:0'] === null && limpiarVistos(JSON.parse(JSON.stringify(e))).porSubir['m:1'] === false, 'lo que no se pudo subir queda pendiente (y sobrevive a guardarse)');
  e = pendienteDeSubir(e, 'i:a:0', null, true);
  check(!('i:a:0' in e.porSubir) && 'm:1' in e.porSubir && apuntarVisto(e, 'x:1', '2026-11-11').porSubir['m:1'] === false, 'al subirse, sale de la cola; ver otro apunte no la toca');
  check(!('porSubir' in pendienteDeSubir(e, 'm:1', null, true)), 'sin nada pendiente, no se guarda la cola');
  const j = conServidor(e, [{ apunte: 'i:a:0', veces: 3, ultimo: '2026-11-08', sabia: null }, { apunte: 'm:9', veces: 2, ultimo: '2026-11-11', sabia: false }, { apunte: 'i:a:1', veces: 1, ultimo: '2026-11-12T00:00:00', sabia: null }, { apunte: '', ultimo: 'mal' }]);
  check(j.vistos['i:a:0'].t === '2026-11-10' && j.vistos['i:a:0'].n === 3 && j.vistos['m:9'].s === false && j.vistos['m:9'].n === 2 && j.vistos['i:a:1'].t === '2026-11-12' && Object.keys(j.vistos).length === 3, 'lo de otro móvil se junta: de cada apunte, lo más reciente y las veces que más');
  check(JSON.stringify(conServidor(j, [])) === JSON.stringify(limpiarVistos(j)), 'sin nada en la base, lo del móvil tal cual');
}

console.log('La travesía, con la base');
{
  let t = sumarEtapa(null, { sesion: 's1', metros: 800, estrellas: 5 });
  t = sumarEtapa(t, { sesion: 's1', metros: 950, estrellas: 7 });
  t = sumarEtapa(t, { metros: 400 });   // práctica: no se sube
  check(t.pend.metros === 1750 && t.pend.estrellas === 12 && t.pend.etapas === 2 && t.pend.mejor === 950, 'lo jugado en sesión queda pendiente de subir (la práctica, no)');
  const envio = porSubir(t);
  check(envio.metros === 1750 && envio.etapas === 2 && envio.mejor === 950 && porSubir(null) === null, 'el envío: lo pendiente');
  const t2 = sumarEtapa(t, { sesion: 's1', metros: 300, estrellas: 1 });   // entra otra etapa mientras sube
  const t3 = trasSubir(t2, envio);
  check(t3.pend.metros === 300 && t3.pend.estrellas === 1 && t3.total === 2050 && trasSubir(t, envio).pend.metros === 0, 'al subirse se descuenta; lo que entró entretanto sigue pendiente');
  let mucho = null; for (let i = 0; i < 100; i++) mucho = sumarEtapa(mucho, { sesion: 'x', metros: 900 });
  const e2 = porSubir(mucho);
  check(e2.metros === 60000 && e2.etapas === 60 && trasSubir(mucho, e2).pend.metros === 30000, 'con mucho atrasado, en envíos que la base admite (60 km y 60 etapas)');
  const base = [{ semana: '2026-11-09', metros: 5000, estrellas: 40, mejor: 1200 }, { semana: '2026-11-02', metros: 3000, estrellas: 10, mejor: 900 }];
  const nuevo = conBase(null, base);
  check(nuevo.total === 8000 && nuevo.estrellas === 50 && nuevo.mejor === 1200, 'en un móvil nuevo, el total sale de la base');
  const conPend = conBase(sumarEtapa(null, { sesion: 's', metros: 700, estrellas: 2 }), base);
  check(conPend.total === 8700 && conPend.estrellas === 52 && conPend.pend.metros === 700, 'y lo que aún no se ha subido se suma encima');
  check(conBase(trasSubir(t, envio), [{ semana: '2026-11-09', metros: 1750, estrellas: 12, mejor: 950 }]).total === 1750 && conBase(t, []).total === 1750, 'en el mismo móvil, con todo subido, no cambia (ni cuenta doble)');
  check(metrosDeLaSemana(conPend, base, '2026-11-09') === 5700 && metrosDeLaSemana(null, base, '2026-11-16') === 0, 'lo de esta semana: su fila más lo pendiente');
  check(limpiarTravesia({ total: 5, pend: { metros: 'x', etapas: -3 } }).pend.metros === 0, 'lo pendiente ilegible se sanea');
  // (v0.148, revisión) el envío con identificador, fijado hasta que la base lo confirma
  const ID1 = '11111111-1111-4111-8111-111111111111', ID2 = '22222222-2222-4222-8222-222222222222';
  const f1 = prepararEnvio(t, ID1);
  check(f1.envio?.id === ID1 && f1.envio.metros === 1750 && prepararEnvio(f1, ID2).envio.id === ID1 && limpiarTravesia(JSON.parse(JSON.stringify(f1))).envio.id === ID1, 'el envío se prepara con su identificador y se queda fijado (aunque se pida otro, y al guardarse)');
  check(!prepararEnvio(null, ID1).envio && !prepararEnvio(t, 'no-es-un-id').envio && !limpiarTravesia({ envio: { id: 'x', metros: 5 } }).envio, 'sin nada pendiente o sin un identificador válido, no hay envío');
  const f2 = sumarEtapa(f1, { sesion: 's3', metros: 300, estrellas: 1 });
  const f3 = trasSubir(f2, f1.envio);
  check(!f3.envio && f3.pend.metros === 300 && trasSubir(f3, f1.envio).pend.metros === 300, 'confirmado, se descuenta una sola vez (si otra pestaña ya lo descontó, no se vuelve a descontar)');
  check(ENLACE_NOVEDAD.test('https://x.co?y=1') && ENLACE_NOVEDAD.test('https://doi.org/10.1/a#b') && !ENLACE_NOVEDAD.test('https://x.co/a b') && !ENLACE_NOVEDAD.test('https://x.co/\u00a0') && !ENLACE_NOVEDAD.test('https://user@x.co'), 'el enlace de una novedad, como lo admite la base');
}

console.log('Lo que va y viene, sin contar dos veces (revisión)');
{
  const { sincronizarTravesia, leerTravesia, apuntarEtapa } = await import('../web/src/ui/travesia.js');
  const { guardarVisto, sincronizarApuntes, leerApuntes } = await import('../web/src/ui/apuntes.js');
  const sumado = new Map(); let perder = 1; const llegados = [];
  const apiFalsa = {
    async sumarTravesia(e) { llegados.push(e.id); if (!sumado.has(e.id)) sumado.set(e.id, e.metros); if (perder-- > 0) return false; return true; },   // la primera respuesta se pierde
    async travesiaDe() { return [{ semana: '2026-11-09', metros: [...sumado.values()].reduce((a, b) => a + b, 0), estrellas: 0, mejor: 0 }]; },
  };
  apuntarEtapa('atl-x', { sesion: 's1', metros: 900, estrellas: 2 });
  await sincronizarTravesia(apiFalsa, 'atl-x', { traer: true });
  check(leerTravesia('atl-x').envio && leerTravesia('atl-x').total === 900, 'se perdió la respuesta: el envío sigue fijado y no se junta con la base (no cuenta doble)');
  await sincronizarTravesia(apiFalsa, 'atl-x');
  const fin = leerTravesia('atl-x');
  check(llegados.length === 2 && llegados[0] === llegados[1] && [...sumado.values()].reduce((a, b) => a + b, 0) === 900 && !fin.envio && fin.pend.metros === 0 && fin.total === 900, 'se repite el mismo envío (mismo identificador): la base lo suma una vez');
  // apuntes: uno que la base no admite sale de la cola y no la atasca; lo nuevo en cola no se pierde al confirmar lo de antes
  const subidos = [];
  let soltar; const espera = new Promise((r) => { soltar = r; });
  const apiA = { async apuntarApunte(id, sabia) { if (id === 'm:9') { await espera; } subidos.push([id, sabia]); return id === 'i:raro' ? 'rechazado' : true; }, async apuntesVistos() { return []; } };
  guardarVisto('atl-y', 'm:9', '2026-11-12', true, apiA);
  guardarVisto('atl-y', 'm:9', '2026-11-12', false, { apuntarApunte: () => new Promise(() => {}) });
  soltar(); await new Promise((r) => setTimeout(r, 10));
  check(leerApuntes('atl-y').porSubir?.['m:9'] === false, 'se confirma lo de antes (lo sabía) y lo nuevo (no lo sabía) sigue en cola para subirse');
  const apiB = { async apuntarApunte(id, sabia) { subidos.push([id, sabia]); return id === 'i:raro' ? 'rechazado' : true; }, async apuntesVistos() { return []; } };
  guardarVisto('atl-z', 'i:raro', '2026-11-12', null, { apuntarApunte: () => Promise.resolve(false) });
  guardarVisto('atl-z', 'm:1', '2026-11-12', null, { apuntarApunte: () => Promise.resolve(false) });
  await new Promise((r) => setTimeout(r, 5));
  await sincronizarApuntes(apiB, 'atl-z');
  check(!leerApuntes('atl-z').porSubir && subidos.some(([id]) => id === 'm:1'), 'uno que la base rechaza sale de la cola y los demás se suben igual');
}

// ------------------------------------------------------------ la demo (backend en memoria): lo mismo que la base
console.log('En la demo');
{
  const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
  const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
  const { crearApi } = await import('../web/src/datos/api.js');
  const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const api = crearApi(b);
  const lanza = async (fn) => { try { await fn(); return false; } catch { return true; } };
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const n1 = await api.guardarNovedad({ titulo: '  Dormir poco   resta fuerza ', texto: 'Tras dormir 4 horas, menos repeticiones.', fuente: 'Apellido et al., 2026', enlace: 'https://pubmed.ncbi.nlm.nih.gov/1/', publicada: false });
  check(n1.id && n1.titulo === 'Dormir poco resta fuerza' && n1.publicada === false && n1.publicada_en === null, 'el coach guarda un borrador (con el título limpio)');
  check(await lanza(() => api.guardarNovedad({ titulo: '', texto: 'x' })) && await lanza(() => api.guardarNovedad({ titulo: 't', texto: 'x', enlace: 'http://sin-s.test' })), 'sin título, o con un enlace que no es https, no');
  const n2 = await api.guardarNovedad({ ...n1, publicada: true });
  const n3 = await api.guardarNovedad({ ...n2, titulo: 'Dormir poco resta fuerza al día siguiente' });
  check(n2.publicada && n2.publicada_en && n3.publicada_en === n2.publicada_en && (await api.novedades()).length === 1, 'al publicarla se apunta cuándo; corregirla no cambia la fecha');
  const borrador = await api.guardarNovedad({ titulo: 'Otra', texto: 'En borrador.', publicada: false });
  await b.auth.salir();
  await b.auth.entrar('ana@fbe.demo', 'demo');
  const ana = await api.miAtleta();
  const vistas = await api.novedades();
  check(vistas.length === 1 && vistas[0].titulo.endsWith('al día siguiente'), 'el atleta ve las publicadas (el borrador, no)');
  check(await lanza(() => api.guardarNovedad({ titulo: 'x', texto: 'y' })) && await lanza(() => api.borrarNovedad(n1.id).then(async () => { if ((await api.novedades()).length) throw new Error('sigue'); })), 'y no puede escribirlas ni borrarlas');
  check(await api.sumarTravesia({ metros: 800, estrellas: 5 }) === true && await api.sumarTravesia({ metros: 950, estrellas: 7 }) === true && await api.sumarTravesia({ metros: 0 }) === false, 'sube sus etapas');
  const sem = await api.travesiaDe(ana.id);
  check(sem.length === 1 && sem[0].metros === 1750 && sem[0].estrellas === 12 && sem[0].etapas === 2 && sem[0].mejor === 950 && new Date(`${sem[0].semana}T12:00:00Z`).getUTCDay() === 1, 'y quedan en su semana (un lunes)');
  check(await api.apuntarApunte('m:3', false) === true && await api.apuntarApunte('m:3') === true && await api.apuntarApunte(`n:${n1.id}`) === true && await api.apuntarApunte('') === false, 'apunta lo que ve');
  const av = await api.apuntesVistos(ana.id);
  check(av.length === 2 && av.find((x) => x.apunte === 'm:3').veces === 1 && av.find((x) => x.apunte === 'm:3').sabia === false, 'el mismo día cuenta una vez; lo que no sabía, apuntado');
  check(await api.apuntarApunte('no vale') === 'rechazado' && await api.apuntarApunte('X:1') === 'rechazado' && await api.apuntarApunte('m:a b') === 'rechazado', 'lo que no es un apunte no se apunta (y no rompe nada: «rechazado», para sacarlo de la cola)');
  // (v0.148) un envío repetido no suma dos veces
  const idEnv = '33333333-3333-4333-8333-333333333333';
  check(await api.sumarTravesia({ id: idEnv, metros: 100 }) === true && await api.sumarTravesia({ id: idEnv, metros: 100 }) === true && (await api.travesiaDe(ana.id))[0].metros === 1850, 'el mismo envío dos veces suma una vez');
  const datos = await api.exportar(ana.id);
  check((Array.isArray(datos.travesia_semanas) && datos.travesia_semanas.length === 1 && Array.isArray(datos.apuntes_vistos) && datos.apuntes_vistos.length === 2), 'y va en la descarga de sus datos');
  await b.auth.salir();
  await b.auth.entrar('carlos@fbe.demo', 'demo');
  const carlos = await api.miAtleta();
  check((await api.travesiaDe(ana.id)).length === 0 && (await api.apuntesVistos(ana.id)).length === 0 && (await api.travesiaDe(carlos.id)).every((x) => x.atleta_id === carlos.id), 'otro atleta no ve lo de Ana (solo lo suyo)');
  // (revisión) como en la base: nadie escribe estas tablas a mano, y el atleta solo borra lo suyo
  check(await lanza(() => b.insert('travesia_semanas', [{ atleta_id: ana.id, semana: '2026-11-09', metros: 5 }])) && await lanza(() => b.insert('apuntes_vistos', [{ atleta_id: carlos.id, apunte: 'zzz' }]))
    && await lanza(() => b.update('travesia_semanas', { metros: 9 }, { eq: { atleta_id: carlos.id } })) && await lanza(() => b.select('travesia_envios', {}).then((f) => { if (f.length) throw new Error('se ve'); }).then(() => b.insert('travesia_envios', [{ atleta_id: carlos.id, envio: idEnv }]))),
  'en la demo tampoco se escriben a mano (ni los envíos)');
  await b.delete('travesia_semanas', { eq: { atleta_id: ana.id } }); await b.delete('apuntes_vistos', { eq: { atleta_id: ana.id } });
  await b.auth.salir();
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  check((await api.travesiaDe(ana.id)).length === 1 && (await api.apuntesVistos(ana.id)).length === 2 && (await api.novedades()).length === 2, 'el coach, sí (y sus dos novedades, con el borrador)');
  await api.borrarNovedad(borrador.id);
  check((await api.novedades()).length === 1, 'y puede borrarlas');
  // (061) la manada en la travesía
  await b.auth.salir();
  await b.auth.entrar('ana@fbe.demo', 'demo');
  check(await api.travesiaManada() === null, '(061) fuera de la comunidad no hay clasificación');
  await api.entrarComunidad('Ana L.');
  const m1 = await api.travesiaManada();
  check(m1.filas.length === 4 && m1.filas[0].nombre === 'Rubén M.' && m1.filas[0].metros === 4200 && m1.filas[0].hoy === true && !m1.filas[0].yo && m1.filas.every((f, i) => i === 0 || f.metros <= m1.filas[i - 1].metros), 'dentro, la clasificación de la semana, de más a menos');
  const yo = m1.filas.find((f) => f.yo);
  check(yo && yo.nombre === 'Ana L.' && yo.metros === 1850 && m1.filas.filter((f) => f.yo).length === 1 && m1.filas.every((f) => Object.keys(f).sort().join() === 'estrellas,hoy,mejor,metros,nombre,yo'), 'con mi fila marcada y solo el nombre del equipo y los metros de cada uno');
  check(m1.equipo.miembros === 4 && m1.equipo.metros >= 4200 + 2600 + 900 + 1850 && /^\d{4}-\d{2}-01$/.test(m1.equipo.mes) && new Date(`${m1.semana}T12:00:00Z`).getUTCDay() === 1, 'y lo que suma el equipo en el mes');
  await api.ajustesComunidad({ sinRanking: true });
  check((await api.travesiaManada()).filas.some((f) => f.yo), 'quien no quiere salir en el ranking se sigue viendo a sí mismo');
  await b.auth.salir();
  await b.auth.entrar('carlos@fbe.demo', 'demo');
  const m2 = await api.travesiaManada();
  check(m2.filas.length === 3 && !m2.filas.some((f) => f.nombre === 'Ana L.') && m2.filas.find((f) => f.yo).nombre === 'Carlos V.' && m2.equipo.miembros === 3 && m2.equipo.metros === m1.equipo.metros - 1850, 'pero los demás no le ven (y, siendo la única sin salir, lo suyo no suma en el equipo: restando se sabría)');
  await b.auth.salir();
}

console.log('La migración 060 (PGlite)');
const { PGlite } = await import('@electric-sql/pglite');
const { aplicarEsquema } = await import('./esquema.mjs');
const db = new PGlite();
await aplicarEsquema(db, { repetirMigraciones: true });
check(true, 'esquema y migraciones aplicados, también al repetirlas');
const claims = (uid, aal) => `select set_config('request.jwt.claim.sub', '${uid}', false); select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, aal }) : ''}', false);`;
const su = async () => db.exec(`reset role; ${claims('', '')}`);
const como = async (uid, aal = 'aal1') => db.exec(`reset role; ${claims(uid, aal)} set role authenticated;`);
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const falla = async (sql, params = []) => { try { await db.query(sql, params); return false; } catch { return true; } };
const usuario = async (email) => { await su(); return (await q('insert into auth.users (email) values ($1) returning id', [email]))[0].id; };
const coach = await usuario('coach@x.test');
await q(`update public.perfiles set rol = 'coach', nombre = 'Coach' where id = $1`, [coach]);
const ana = await usuario('a@x.test');
const atletaA = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo') returning id`, [ana]))[0].id;
const bea = await usuario('b@x.test');
const atletaB = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Bea', $1, 'activo') returning id`, [bea]))[0].id;
const baja = await usuario('d@x.test');
const atletaD = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Dani', $1, 'baja') returning id`, [baja]))[0].id;
const suelto = await usuario('c@x.test');

console.log('La novedad de la semana');
await como(coach, 'aal2');
const [n1] = await q(`insert into novedades (titulo, texto, fuente, enlace) values ('Dormir poco resta fuerza', 'Un ensayo con 20 personas: tras dormir 4 horas, menos repeticiones.', 'Apellido et al., Revista, 2026', 'https://pubmed.ncbi.nlm.nih.gov/12345678/') returning id, publicada, publicada_en`);
check(n1.publicada === false && n1.publicada_en === null, 'el coach la escribe; nace sin publicar');
await como(ana);
check((await q('select id from novedades')).length === 0, 'sin publicar, el atleta no la ve');
await como(coach, 'aal2');
const [n1p] = await q('update novedades set publicada = true where id = $1 returning publicada_en', [n1.id]);
check(n1p.publicada_en !== null, 'al publicarla, la base apunta cuándo');
const [n1q] = await q(`update novedades set titulo = 'Dormir poco resta fuerza al día siguiente' where id = $1 returning publicada_en`, [n1.id]);
check(String(n1q.publicada_en) === String(n1p.publicada_en), 'corregirla después no le cambia la fecha');
await como(ana);
check((await q('select titulo, fuente from novedades'))[0]?.fuente === 'Apellido et al., Revista, 2026', 'publicada, la ven sus atletas');
check(await falla(`insert into novedades (titulo, texto) values ('x', 'y')`) && (await q(`update novedades set titulo = 'cambiada' returning id`)).length === 0 && (await q('delete from novedades returning id')).length === 0, 'el atleta no puede escribirla, cambiarla ni borrarla');
await como(suelto);
check((await q('select id from novedades')).length === 0, 'una cuenta sin ficha de atleta no la ve');
await como(coach, 'aal2');
check(await falla(`insert into novedades (titulo, texto) values ('', 'x')`) && await falla(`insert into novedades (titulo, texto) values ($1, 'x')`, ['t'.repeat(91)]) && await falla(`insert into novedades (titulo, texto) values ('t', $1)`, ['x'.repeat(501)]), 'título de 1 a 90 letras y texto de 1 a 500');
check(await falla(`insert into novedades (titulo, texto, enlace) values ('t', 'x', 'http://sin-s.test/a')`) && await falla(`insert into novedades (titulo, texto, enlace) values ('t', 'x', 'javascript:alert(1)')`) && await falla(`insert into novedades (titulo, texto, enlace) values ('t', 'x', 'https://con espacio.test')`), 'el enlace, solo https y sin espacios');
{
  // (revisión) ni espacios invisibles ni caracteres de control; sí ?consulta, #ancla y puerto
  const malos = ['https://x.co/\u00a0a', 'https://x.co/\u200ba', 'https://x.co/\u0001', 'https://user@x.co/', 'https://x.co\\@evil.test'];
  const buenos = ['https://x.co?y=1', 'https://x.co#a', 'https://x.co:443/a', 'https://doi.org/10.1000/xyz(1)'];
  let bien = true;
  for (const e of malos) bien = bien && await falla(`insert into novedades (titulo, texto, enlace) values ('t', 'x', $1)`, [e]);
  for (const e of buenos) bien = bien && !(await falla(`insert into novedades (titulo, texto, enlace) values ('t', 'x', $1)`, [e]));
  check(bien, 'el enlace: ni espacios invisibles ni caracteres de control ni usuario@; sí ?consulta, #ancla y puerto');
  await q(`delete from novedades where titulo = 't'`);
  const [f] = await q(`insert into novedades (titulo, texto, publicada, publicada_en, creada_en) values ('fecha', 'x', true, '2100-01-01', '1990-01-01') returning id, publicada_en, creada_en`);
  const [g] = await q(`update novedades set publicada_en = '1999-01-01', creada_en = '1990-01-01', id = gen_random_uuid() where id = $1 returning id, publicada_en, creada_en`, [f.id]);
  check(new Date(f.publicada_en).getFullYear() < 2100 && new Date(f.creada_en).getFullYear() > 2000 && g.id === f.id && String(g.publicada_en) === String(f.publicada_en) && String(g.creada_en) === String(f.creada_en), 'las fechas las pone la base (ni adelantarlas ni atrasarlas) y el id no cambia');
  await q('delete from novedades where id = $1', [f.id]);
}
const [n1d] = await q('update novedades set publicada = false where id = $1 returning publicada_en', [n1.id]);
check(n1d.publicada_en === null, 'al despublicarla se le quita la fecha');
await q('update novedades set publicada = true where id = $1', [n1.id]);

console.log('La travesía, por semanas');
await como(ana);
await q('select sumar_travesia(800, 5)');
await q('select sumar_travesia(950, 7)');
const [t1] = await q('select * from travesia_semanas');
check(t1.atleta_id === atletaA && t1.metros === 1750 && t1.estrellas === 12 && t1.etapas === 2 && t1.mejor === 950, 'dos etapas en la semana: se suman metros, estrellas y etapas; la mejor etapa');
const [dia] = await q(`select extract(isodow from semana)::int as d, (semana <= current_date and semana > current_date - 8) as esta from travesia_semanas`);
check(dia.d === 1 && dia.esta, 'la semana es su lunes');
await q('select sumar_travesia(999999, 99999)');
const [t2] = await q('select metros, estrellas, mejor from travesia_semanas');
check(t2.metros === 1750 + 5000 && t2.estrellas === 12 + 400 && t2.mejor === 5000, 'una etapa no pasa de 5 km ni de 400 estrellas, mande lo que mande');
await q('select sumar_travesia(30000, 100, 10, 1200)');
const [t3] = await q('select metros, etapas, mejor from travesia_semanas');
check(t3.metros === 36750 && t3.etapas === 13 && t3.mejor === 5000, 'varias etapas de golpe (el móvil llevaba un rato sin subirlas): suman, con su tope por etapa');
await q('select sumar_travesia(0, 3)'); await q('select sumar_travesia(-50, 3)'); await q('select sumar_travesia(null, 3)');
check((await q('select metros, estrellas from travesia_semanas'))[0].metros === 36750, 'cero, negativo o nada: no suma');
check(await falla(`insert into travesia_semanas (atleta_id, semana, metros) values ($1, '2026-11-09', 5)`, [atletaA]) && await falla('update travesia_semanas set metros = 9'), 'el atleta no escribe la tabla a mano: solo con sumar_travesia()');
{
  // (revisión) un envío repetido no suma dos veces
  const e = '44444444-4444-4444-8444-444444444444';
  await q('select sumar_travesia(100, 0, 1, 100, $1)', [e]); await q('select sumar_travesia(100, 0, 1, 100, $1)', [e]);
  check((await q('select metros from travesia_semanas'))[0].metros === 36850, 'el mismo envío (mismo identificador) dos veces suma una vez');
  check(await falla('select * from travesia_envios') && await falla(`insert into travesia_envios values ($1, gen_random_uuid())`, [atletaA]), 'los envíos ya sumados no los lee ni los escribe nadie');
}
await como(bea);
check((await q('select * from travesia_semanas')).length === 0, 'otra atleta no ve lo de Ana');
await q('select sumar_travesia(300, 1)');
await como(baja);
await q('select sumar_travesia(300, 1)');
await como(suelto);
await q('select sumar_travesia(300, 1)');
await como(coach, 'aal2');
await q('select sumar_travesia(300, 1)');
check(await falla('select * from travesia_envios'), 'ni el coach');
const todas = await q('select atleta_id, metros from travesia_semanas order by metros desc');
check(todas.length === 2 && todas[0].atleta_id === atletaA && todas[1].atleta_id === atletaB && todas[1].metros === 300, 'el coach ve las de todas; de baja, sin ficha o el propio coach no apuntan nada');

console.log('Los apuntes vistos');
await como(ana);
await q(`select apuntar_apunte('i:sueno:0')`);
await q(`select apuntar_apunte('i:sueno:0')`);
await q(`select apuntar_apunte('m:3', false)`);
const av = await q('select apunte, veces, sabia, ultimo = (now() at time zone \'Europe/Madrid\')::date as hoy from apuntes_vistos order by apunte');
check(av.length === 2 && av[0].veces === 1 && av[0].sabia === null && av[0].hoy && av[1].sabia === false, 'verlo dos veces el mismo día cuenta una; el que no sabía queda apuntado');
await su();
await q(`update apuntes_vistos set ultimo = ultimo - 3 where apunte = 'm:3'`);
await como(ana);
await q(`select apuntar_apunte('m:3')`);
const [m3] = await q(`select veces, sabia from apuntes_vistos where apunte = 'm:3'`);
check(m3.veces === 2 && m3.sabia === false, 'otro día, otra vez; pasar de largo no borra que no lo sabía');
await q(`select apuntar_apunte('m:3', true)`);
check((await q(`select sabia from apuntes_vistos where apunte = 'm:3'`))[0].sabia === true, 'hasta que dice que ya lo sabe');
await q(`select apuntar_apunte($1)`, [`p:${atletaA}:0`]); await q(`select apuntar_apunte($1)`, [`n:${n1.id}`]);
check((await q('select count(*)::int as n from apuntes_vistos'))[0].n === 4, 'valen los de ficha (p:, e:), guía (i:), mito (m:) y novedad (n:)');
check(await falla(`select apuntar_apunte('X:1')`) && await falla(`select apuntar_apunte('i:con espacio')`) && await falla(`select apuntar_apunte(null)`) && await falla(`select apuntar_apunte($1)`, [`i:${'a'.repeat(80)}`]), 'lo que no es un apunte, no');
check(await falla(`insert into apuntes_vistos (atleta_id, apunte) values ($1, 'i:x:1')`, [atletaA]) && await falla('update apuntes_vistos set veces = 50'), 'tampoco se escribe a mano');
await como(bea);
check((await q('select * from apuntes_vistos')).length === 0, 'otra atleta no ve lo de Ana');
await q(`select apuntar_apunte('m:3', false)`);
await como(coach, 'aal2');
const fallados = await q(`select apunte, count(*) filter (where sabia = false)::int as no from apuntes_vistos group by apunte having count(*) filter (where sabia = false) > 0`);
check(fallados.length === 1 && fallados[0].apunte === 'm:3' && fallados[0].no === 1, 'el coach ve qué se falla (sin escribir nada)');
await como(ana);
check((await q(`delete from apuntes_vistos where apunte = 'i:sueno:0' returning apunte`)).length === 1 && (await q('delete from travesia_semanas returning semana')).length === 1, 'el atleta puede borrar lo suyo');
await su();
await q('delete from public.atletas where id = $1', [atletaB]);
check((await q('select count(*)::int as n from apuntes_vistos where atleta_id = $1', [atletaB]))[0].n === 0 && (await q('select count(*)::int as n from travesia_semanas where atleta_id = $1', [atletaB]))[0].n === 0, 'al borrar la ficha de un atleta se va lo suyo');
const anon = async (sql) => { await db.exec(`reset role; ${claims('', '')} set role anon;`); return falla(sql); };
check(await anon('select * from novedades') && await anon('select * from travesia_semanas') && await anon('select * from apuntes_vistos') && await anon('select sumar_travesia(10)') && await anon(`select apuntar_apunte('m:1')`), 'sin sesión, nada');
await su();
check((await q(`select count(*)::int as n from fbe_migraciones where numero = 60`))[0].n === 1, 'la 060 queda apuntada');
console.log('La migración 061: la manada en la travesía');
{
  // Ana y dos más, dentro de la comunidad; Eva, fuera
  const eva = await usuario('e@x.test'); const atletaE = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Eva', $1, 'activo') returning id`, [eva]))[0].id;
  const fer = await usuario('f@x.test'); await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Fer', $1, 'activo')`, [fer]);
  const gus = await usuario('g@x.test'); await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Gus', $1, 'activo')`, [gus]);
  await su();
  const [{ v: version }] = await q('select public.comunidad_version() as v'); const [{ v: normas }] = await q('select public.comunidad_normas_version() as v');
  await como(coach, 'aal2'); await q('update comunidad_ajustes set activa = true');
  for (const [u, nombre] of [[ana, 'Ana L.'], [fer, 'Fer M.'], [gus, 'Gus R.']]) { await como(u); await q('select comunidad_unirme($1, $2, $3)', [nombre, version, normas]); }
  await como(ana); await q('select sumar_travesia(1200, 9)');
  await como(fer); await q('select sumar_travesia(3000, 20)');
  await como(gus); await q('select sumar_travesia(800, 2)');
  await como(eva); await q('select sumar_travesia(5000, 30)');
  await su(); await q('update comunidad_miembros set sin_ranking = true where perfil_id = $1', [gus]);
  await q(`update travesia_semanas set actualizada_en = now() - interval '3 days' where atleta_id = (select id from atletas where perfil_id = $1)`, [fer]);
  await como(ana);
  const [{ m }] = await q('select travesia_manada() as m');
  check(m.filas.length === 2 && m.filas[0].nombre === 'Fer M.' && m.filas[0].metros === 3000 && m.filas[1].nombre === 'Ana L.' && m.filas[1].yo === true && m.filas[0].yo === false, 'la clasificación de la semana, con el nombre de la comunidad, de más a menos; quien está fuera de la comunidad no sale');
  check(m.filas[1].hoy === true && m.filas[0].hoy === false, 'dice quién ha corrido hoy');
  check(!m.filas.some((f) => f.nombre === 'Gus R.') && m.equipo.metros === m.filas[0].metros + m.filas[1].metros && m.equipo.miembros === 2, 'quien no quiere salir en el ranking no sale, y siendo uno solo lo suyo no suma en el equipo (restando se sabría)');
  await su(); await q('update comunidad_miembros set sin_ranking = true where perfil_id in ($1, $2)', [ana, fer]);
  await como(ana);
  const [{ m: m3 }] = await q('select travesia_manada() as m');
  check(m3.filas.length === 1 && m3.filas[0].yo && m3.equipo.metros === 5000 && m3.equipo.miembros === 3, 'con tres o más sin salir, lo suyo sí suma (5 km entre los tres), sin decir de quién');
  await su(); await q('update comunidad_miembros set sin_ranking = false where perfil_id in ($1, $2)', [ana, fer]);
  await como(ana);
  check(new Date(`${m.semana}T12:00:00Z`).getUTCDay() === 1 && /^\d{4}-\d\d-01/.test(m.equipo.mes), 'con el lunes de la semana y el mes del equipo');
  await como(gus);
  const [{ m: mg }] = await q('select travesia_manada() as m');
  check(mg.filas.some((f) => f.nombre === 'Gus R.' && f.yo) && mg.filas.length === 3, 'él sí se ve a sí mismo');
  await como(eva);
  check((await q('select travesia_manada() as m'))[0].m === null, 'quien no está en la comunidad no ve nada');
  await como(coach, 'aal2');
  check((await q('select travesia_manada() as m'))[0].m.filas.length === 2, 'el coach ve la clasificación (sin los que no quieren salir)');
  check(await anon('select travesia_manada()'), 'sin sesión, nada');
  // (revisión) «Lo que más se falla»: solo cuentas, de dos atletas en adelante, y solo el coach
  await como(coach, 'aal2');
  const fall = await q('select * from apuntes_fallados()');
  check(fall.every((x) => Object.keys(x).sort().join() === 'apunte,atletas' && x.atletas >= 2), 'lo que más se falla: el apunte y cuántos atletas (nunca quién), de dos en adelante');
  await como(ana);
  check((await q('select * from apuntes_fallados()')).length === 0, 'un atleta no ve nada');
  check(await anon('select * from apuntes_fallados()'), 'sin sesión, nada');
}

console.log('La migración 061: los apuntes sueltos del coach y las claves nuevas');
{
  await como(coach, 'aal2');
  const [ej] = await q(`insert into ejercicios (nombre, grupos_musculares) values ('Press banca v061', '{pectoral}') returning id`);
  const [ap] = await q(`insert into novedades (titulo, texto, tipo, ejercicio_id, publicada) values ('Codos a 45 grados', 'Ni pegados ni en cruz.', 'apunte', $1, true) returning id, tipo, publicada_en`, [ej.id]);
  check(ap.tipo === 'apunte' && ap.publicada_en !== null, 'el coach escribe un apunte suelto, ligado a un ejercicio');
  check(await falla(`insert into novedades (titulo, texto, tipo) values ('x', 'y', 'otra')`) && await falla(`insert into novedades (titulo, texto, ejercicio_id) values ('x', 'y', $1)`, [ej.id]), 'solo «novedad» o «apunte»; una novedad no va ligada a un ejercicio');
  check((await q(`select tipo from novedades where id = $1`, [n1.id]))[0].tipo === 'novedad', 'las que ya había siguen siendo novedades');
  await q('delete from ejercicios where id = $1', [ej.id]);
  check((await q('select ejercicio_id from novedades where id = $1', [ap.id]))[0].ejercicio_id === null, 'si se borra el ejercicio, el apunte se queda (sin ejercicio)');
  await como(ana);
  await q(`select apuntar_apunte('d:3')`); await q(`select apuntar_apunte('g:rir')`); await q(`select apuntar_apunte($1, true)`, [`a:${ap.id}`]); await q(`select apuntar_apunte('x:bloque-12:q3', false)`);
  check((await q(`select count(*)::int as n from apuntes_vistos where apunte ~ '^[adgx]:'`))[0].n === 4, 'se apuntan también las dudas, el glosario, los apuntes del coach y los exámenes');
  check(await falla(`select apuntar_apunte('A:1')`) && await falla(`select apuntar_apunte('1:x')`) && await falla(`select apuntar_apunte('dd:x')`), 'lo que no es una clave de apunte sigue sin valer');
  await su();
  check((await q(`select count(*)::int as n from fbe_migraciones where numero = 61`))[0].n === 1, 'la 061 queda apuntada');
}


console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
process.exit(0);
