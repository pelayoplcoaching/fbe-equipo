// v0.225 (migración 088): la carrera de la semana, desde la base. carrera_al_dia hace lo mismo que api.carreraAlDia de la
// v0.218: cada caso se prepara dos veces, igual, en dos atletas; a uno se le pone al día con la app (como hasta ahora) y al
// otro con la función de la base, y lo que queda (semanas, sesiones y lo que devuelve) tiene que ser lo mismo. Después,
// quién puede llamarla: el coach, para cualquiera; el atleta, solo para sí mismo y sin refrescar; y sin la función, la app
// lo sigue haciendo como antes. Contra el esquema real (PGlite, con RLS y los triggers del día previsto).
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, lunesDe, sumarDias, fechaMadrid } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.message); process.exit(1); });
// La base usa el día de Madrid: en la hora en que el de este ordenador es otro, no se pueden comparar
if (hoyISO() !== fechaMadrid()) {
  console.log('  (ahora mismo, el día de este ordenador no es el de Madrid: se salta la comparación)');
  process.exit(0);
}

const db = await crearPglite();
const b = crearBackendPglite(db);
const api = crearApi(b);
const L = lunesDe(hoyISO());
const d = (n) => sumarDias(L, n);
const q = (sql, p = []) => b.sql(sql, p);

await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
const coachId = b.auth.sesion().user.id;
await q(`update perfiles set rol = 'coach' where id = $1`, [coachId]);

// ---------- cómo se prepara un caso ----------
const fuerza = (nombre, x = {}) => ({ nombre, tipo: 'fuerza', ...x });
const carrera = (nombre, x = {}) => ({ nombre, tipo: 'cardio', cardio: { modalidad: 'carrera', tipo: 'facil', minutos: 30 }, ...x });
const HECHO = { modalidad: 'carrera', minutos: 31, km: 5.1 };
async function nuevoAtleta(nombre) {
  const [a] = await q(`insert into atletas (nombre, estado) values ($1, 'activo') returning id`, [nombre]);
  return a.id;
}
// semanas: [{ fecha?, publicada?, sesiones: [{ nombre, tipo, cardio?, dinamica?, dia?, hecha? (fecha), mensaje? }] }]
async function bloque(atletaId, inicio, semanas, { estado = 'activo', numero = 1 } = {}) {
  const [bl] = await q(`insert into bloques (atleta_id, numero, nombre, fecha_inicio, estado) values ($1, $2, 'Base', $3, $4) returning id`, [atletaId, numero, inicio, estado]);
  for (const [i, w] of semanas.entries()) {
    const [x] = await q(`insert into semanas (bloque_id, numero, fecha_inicio, programacion) values ($1, $2, $3, $4) returning id`,
      [bl.id, i + 1, w.fecha === undefined ? sumarDias(inicio, 7 * i) : w.fecha, w.publicada === false ? 'en_programacion' : 'programada']);
    for (const [j, s] of (w.sesiones || []).entries()) {
      const [ses] = await q(`insert into sesiones (semana_id, orden, nombre, tipo, cardio, dinamica, dia_previsto, completada, fecha_realizada, cardio_hecho)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [x.id, j + 1, s.nombre, s.tipo, s.cardio ? JSON.stringify(s.cardio) : null, s.dinamica ?? null, s.dia ?? null, !!s.hecha, s.hecha ?? null,
        s.hecha && s.tipo === 'cardio' ? JSON.stringify(HECHO) : null]);
      // (un mensaje del coach en la sesión: la base comprueba quién escribe, así que con su sesión)
      if (s.mensaje) await b.guion(`select set_config('request.jwt.claim.sub', '${coachId}', false); select set_config('request.jwt.claims', '{"sub":"${coachId}"}', false);
        insert into public.comentarios (atleta_id, sesion_id, autor, texto) values ('${atletaId}', '${ses.id}', 'coach', '¿Qué tal fue?');`);
    }
  }
  return bl.id;
}
const plan = (atletaId, sesiones, lunes = L) => q(`insert into carrera_semanas (atleta_id, lunes, sesiones) values ($1, $2, $3)
  on conflict (atleta_id, lunes) do update set sesiones = excluded.sesiones`, [atletaId, lunes, JSON.stringify(sesiones)]);
// (el objetivo de días y la carrera, al final: así nada de lo de antes pone la semana al día)
const carril = (atletaId, dias = 3) => q(`update atletas set carrera = true, dias_semana = $2 where id = $1`, [atletaId, dias]);

// Todo lo del atleta, sin ids: sus bloques, sus semanas y sus sesiones (con cuántos mensajes tiene cada una)
async function estado(atletaId) {
  const filas = await q(`select bl.numero bn, w.numero, w.fecha_inicio, w.programacion, s.orden, s.nombre, s.tipo, s.completada, s.fecha_realizada,
      s.dia_previsto, s.cardio, s.dinamica, (select count(*) from comentarios c where c.sesion_id = s.id) mensajes
    from bloques bl join semanas w on w.bloque_id = bl.id left join sesiones s on s.semana_id = w.id
    where bl.atleta_id = $1 order by bl.numero, w.numero, s.orden`, [atletaId]);
  return JSON.stringify(filas.map((f) => ({ ...f, cardio: f.cardio ? JSON.stringify(f.cardio) : null })));
}
const ordenado = (r) => JSON.stringify(r && typeof r === 'object' ? Object.fromEntries(Object.entries(r).sort()) : r);
// El mismo caso en dos atletas: uno con la app (local) y otro con la base
async function comparar(titulo, preparar, { refrescar = false, despues } = {}) {
  const app = await nuevoAtleta(`${titulo} (app)`), base = await nuevoAtleta(`${titulo} (base)`);
  await preparar(app);
  await preparar(base);
  api._v088 = undefined;
  const rApp = await api.carreraAlDia(app, { local: true, refrescar });
  const rBase = await api.carreraAlDia(base, { refrescar });
  const usoBase = api._v088 === true;
  const [eApp, eBase] = [await estado(app), await estado(base)];
  const igual = ordenado(rApp) === ordenado(rBase) && eApp === eBase;
  check(igual && usoBase, `${titulo}: lo mismo con la base que con la app (${ordenado(rBase)})${usoBase ? '' : ' [no usó la base]'}`);
  if (!igual) {
    console.log('     app :', ordenado(rApp), eApp);
    console.log('     base:', ordenado(rBase), eBase);
  }
  if (despues) await despues({ app, base, r: rBase, estado: JSON.parse(eBase) });
  return { app, base, r: rBase };
}
const delBase = async (atletaId) => JSON.parse(await estado(atletaId));

console.log('La base hace lo mismo que la app');
const PLAN = [{ tipo: 'facil', titulo: 'Rodaje suave', dia: 2, minutos: 40, zona: 2 }, { tipo: 'calidad', titulo: 'Series 6x800', dia: 4, minutos: 50 }, { tipo: 'larga', titulo: 'Tirada larga', km: 12 }];

await comparar('Va por detrás, con la semana de antes publicada', async (id) => {
  await bloque(id, d(-14), [
    { sesiones: [fuerza('Día 1', { hecha: d(-12) }), fuerza('Día 2', { hecha: d(-11) })] },
    { sesiones: [fuerza('Día 1', { hecha: d(-5) }), fuerza('Día 2', { dia: d(-4) }), carrera('Rodaje de la pasada', { dia: d(-6), hecha: d(-6) }),
      carrera('Cuestas de la pasada', { dia: d(-4) }), carrera('Series de la pasada', { mensaje: true })] },
    { publicada: false, sesiones: [fuerza('Día 1')] },
    { publicada: false },
  ]);
  await plan(id, PLAN);
  await carril(id);
}, {
  despues: async ({ r, estado: e }) => {
    const w = (n) => e.filter((x) => x.numero === n);
    check(r.puestas === 3 && r.quitadas === 2 && r.movida === true && r.semana === 2, 'pone las tres de su plan, saca las dos que no hizo de la pasada y mueve su microciclo');
    check(w(1).filter((x) => x.tipo === 'cardio').map((x) => `${x.nombre}:${x.dia_previsto}:${x.mensajes}`).join() === 'Cuestas de la pasada:null:0,Series de la pasada:null:1'
      && w(2)[0].fecha_inicio === L && w(3)[0].fecha_inicio === d(7) && w(4)[0].fecha_inicio === d(14),
    'las que no hizo pasan a la semana de antes (sin día y con sus mensajes); su microciclo, a esta semana, y los de detrás, a las siguientes');
  },
});

await comparar('Va por detrás y no hay semana de antes', async (id) => {
  await bloque(id, d(-7), [
    { sesiones: [fuerza('Día 1', { dia: d(-6) }), carrera('Rodaje viejo', { dia: d(-5) }), fuerza('Día 2')] },
    { publicada: false },
  ]);
  await plan(id, [{ tipo: 'facil', titulo: 'Rodaje suave', dia: 1, minutos: 30 }, { tipo: 'facil', minutos: 25, dia: 3 }]);
  await carril(id);
}, {
  despues: async ({ estado: e }) => {
    check(!e.some((x) => x.nombre === 'Rodaje viejo') && e.some((x) => x.nombre === 'Carrera fácil' && x.dia_previsto === d(2)) && e.find((x) => x.nombre === 'Día 1').dia_previsto === d(1),
      'sin semana de antes, la que no hizo (sin mensajes) se quita; la fuerza se mueve con su semana y la de su plan sin título se llama «Carrera fácil»');
  },
});

await comparar('Va por delante, con una semana publicada de esta', async (id) => {
  await bloque(id, d(-7), [
    { sesiones: [fuerza('Día 1', { hecha: d(-6) })] },
    { sesiones: [fuerza('Día 1', { hecha: d(0) })] },
    { sesiones: [fuerza('Día 1')] },
  ]);
  await plan(id, [{ tipo: 'facil', titulo: 'Rodaje suave', dia: 3, minutos: 30 }, { tipo: 'calidad', titulo: 'Umbral', dia: 5, minutos: 45 }]);
  await carril(id);
}, {
  despues: async ({ r, estado: e }) => check(r.semana === 2 && !r.movida && e.filter((x) => x.numero === 2 && x.tipo === 'cardio').length === 2,
    'van a la semana publicada con la fecha de esta (la 2.ª), sin mover nada'),
});

await comparar('Va por delante y no hay semana de esta', async (id) => {
  await bloque(id, d(7), [{ sesiones: [fuerza('Día 1', { dia: d(8) })] }, { sesiones: [fuerza('Día 1')] }]);
  await plan(id, [{ tipo: 'facil', titulo: 'Rodaje suave', dia: 2, minutos: 30 }]);
  await carril(id);
}, {
  despues: async ({ r, estado: e }) => check(r.movida && e.find((x) => x.numero === 1).fecha_inicio === L && e.find((x) => x.numero === 2).fecha_inicio === d(14)
    && e.find((x) => x.nombre === 'Día 1' && x.numero === 1).dia_previsto === d(1), 'su microciclo vuelve a esta semana (solo él; la fuerza, con su semana)'),
});

const PLAN5 = [
  { tipo: 'facil', titulo: 'Rodaje suave', dia: 4, minutos: 40 },
  { tipo: 'calidad', titulo: 'Series 6x800', dia: 5, minutos: 50 },
  { tipo: 'larga', titulo: 'Tirada larga', dia: 7, km: 14 },
  { tipo: 'tecnica', titulo: 'Técnica de carrera', dia: 1, nota: 'Skipping y talones, 10 min' },
  { tipo: 'descanso', dia: 6, nota: 'Descansa' },
  { tipo: 'recuperacion', minutos: 20 },
];
const prepararAlDia = async (id) => {
  await bloque(id, d(2), [
    { sesiones: [fuerza('Día 1', { dia: d(3) }), carrera('Rodaje suave', { dia: d(3) }), carrera('Series 6x800', { dia: d(2), hecha: d(2) }), carrera('Cuestas', { dia: d(4), mensaje: true })] },
    { sesiones: [fuerza('Día 1')] },
  ]);
  await plan(id, PLAN5);
  await carril(id);
};
await comparar('Al día (su semana empieza un miércoles), con parte ya puesta', prepararAlDia, {
  despues: async ({ r, estado: e }) => {
    const c = e.filter((x) => x.tipo === 'cardio');
    check(r.puestas === 3 && c.filter((x) => x.nombre === 'Rodaje suave').length === 1 && c.filter((x) => x.nombre === 'Series 6x800').length === 1,
      'lo que ya está (por nombre y día, o por nombre) no se repite');
    const tec = c.find((x) => x.nombre === 'Técnica de carrera');
    check(c.find((x) => x.nombre === 'Tirada larga')?.dia_previsto === d(6) && tec && tec.cardio === null && tec.dinamica === 'Skipping y talones, 10 min' && tec.dia_previsto === null
      && c.some((x) => x.nombre === 'Carrera recuperación' && x.dia_previsto === null) && !c.some((x) => /Descans/.test(x.nombre)),
    'con su día si cae dentro de su semana; la que solo trae título y nota, con la nota como dinámica; la de descanso, ninguna');
  },
});
await comparar('Al cambiar el plan de esta semana (refrescar)', async (id) => {
  await prepararAlDia(id);
  await plan(id, [{ tipo: 'facil', titulo: 'Rodaje suave', dia: 4, minutos: 35 }, { tipo: 'calidad', titulo: 'Fartlek', dia: 6, minutos: 45 }]);
}, {
  refrescar: true,
  despues: async ({ estado: e }) => check(e.filter((x) => x.tipo === 'cardio').map((x) => `${x.nombre}${x.completada ? '+' : ''}`).sort().join() === 'Cuestas,Fartlek,Rodaje suave,Series 6x800+',
    'las pendientes sin mensajes se cambian por las del plan nuevo; la hecha y la que tiene mensajes se quedan'),
});
await comparar('Refrescar sin carreras en su plan esta semana', async (id) => {
  await prepararAlDia(id);
  await plan(id, []);
}, {
  refrescar: true,
  despues: async ({ r, estado: e }) => check(r.quitadas === 1 && r.movida === false && e.filter((x) => x.tipo === 'cardio').map((x) => x.nombre).sort().join() === 'Cuestas,Series 6x800',
    'solo se quitan las pendientes de esta semana sin mensajes'),
});

console.log('\nCuando no hace nada, por lo mismo');
await comparar('Sin plan de carrera', async (id) => { await bloque(id, L, [{ sesiones: [fuerza('Día 1')] }]); await plan(id, PLAN); });
await comparar('Sin objetivo de días', async (id) => { await bloque(id, L, [{ sesiones: [fuerza('Día 1')] }]); await plan(id, PLAN); await q(`update atletas set carrera = true where id = $1`, [id]); });
await comparar('Sin bloque', async (id) => { await plan(id, PLAN); await carril(id); });
await comparar('Sin semanas publicadas', async (id) => { await bloque(id, L, [{ publicada: false, sesiones: [fuerza('Día 1')] }]); await plan(id, PLAN); await carril(id); });
await comparar('Sin carreras en su plan esta semana', async (id) => { await bloque(id, d(-7), [{ sesiones: [fuerza('Día 1')] }]); await plan(id, PLAN, d(7)); await carril(id); }, {
  despues: async ({ r, estado: e }) => check(r.motivo === 'sin-carreras' && e[0].fecha_inicio === d(-7), 'sin carreras esta semana, su microciclo no se mueve'),
});

console.log('\nUna que la app no veía: sin semana de antes, la pendiente con mensajes se queda y lo nuevo no choca con ella');
await comparar('Sin semana de antes y una pendiente con mensajes', async (id) => {
  await bloque(id, d(-7), [{ sesiones: [fuerza('Día 1', { dia: d(-6) }), carrera('Rodaje viejo', { dia: d(-5) }), carrera('Charla', { mensaje: true })] }]);
  await plan(id, [{ tipo: 'facil', titulo: 'Rodaje suave', dia: 2, minutos: 30 }, { tipo: 'facil', titulo: 'Charla', dia: 4, minutos: 20 }]);
  await carril(id);
}, {
  despues: async ({ r, estado: e }) => check(r.puestas === 1 && e.filter((x) => x.nombre === 'Charla').length === 1 && new Set(e.map((x) => x.orden)).size === e.length,
    'la que tiene mensajes se queda y cuenta como ya puesta (no se repite); sin órdenes repetidos'),
});

console.log('\nQuién la puede llamar');
const ana = await api.crearAtleta({ nombre: 'Ana Ruiz', email: 'ana@test' });
const codigo = await api.crearInvitacion(ana.id);
await bloque(ana.id, d(-7), [{ sesiones: [fuerza('Día 1', { hecha: d(-6) }), fuerza('Día 2', { dia: d(-5) })] }, { publicada: false }]);
await plan(ana.id, PLAN);
await carril(ana.id);
const otro = await nuevoAtleta('Otro');
await b.auth.registrar('ana@test', 'contraseña-ana-1', 'Ana');
await api.canjearCodigo(codigo);
await api.darConsentimientos();
const apiAna = crearApi(b);
const r1 = await apiAna.miCarreraAlDia();
const tras = await delBase(ana.id);
check(r1?.puestas === 3 && r1.movida === true && tras.filter((x) => x.tipo === 'cardio').length === 3 && tras[0].fecha_inicio === L,
  `el móvil del atleta, al abrirse, se pone sus tres carreras de esta semana y su microciclo pasa a esta (${ordenado(r1)})`);
check((await apiAna.miCarreraAlDia())?.puestas === 0, 'otra vez, nada (lo que ya está no se repite)');
let err = null;
try { await b.rpc('carrera_al_dia', { p_atleta: otro }); } catch (e) { err = e; }
check(/propia carrera/.test(err?.message || ''), 'para otro atleta, no puede');
err = null;
try { await b.rpc('carrera_al_dia', { p_refrescar: true }); } catch (e) { err = e; }
check(/Solo el coach/.test(err?.message || ''), 'y refrescar (cambiar las pendientes por las del plan) solo lo hace el coach');
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');
check((await api.carreraAlDia(ana.id))?.puestas === 0, 'y si después abre la app el coach, tampoco repite nada');
await q(`update atletas set estado = 'baja' where id = $1`, [ana.id]);
await b.auth.entrar('ana@test', 'contraseña-ana-1');
check((await crearApi(b).miCarreraAlDia())?.motivo === 'no-aplica', 'de baja, su móvil no toca nada');

console.log('\nSin la 088 (una base que aún no la tiene)');
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');
await q('drop function public.carrera_al_dia(uuid, boolean)');
const sin = await nuevoAtleta('Sin la 088');
await bloque(sin, d(-7), [{ sesiones: [fuerza('Día 1', { dia: d(-6) })] }]);
await plan(sin, PLAN);
await carril(sin);
const apiSin = crearApi(b);
const rSin = await apiSin.carreraAlDia(sin);
check(rSin?.puestas === 3 && apiSin._v088 === false, 'la app del coach lo hace ella, como antes');
await b.auth.entrar('ana@test', 'contraseña-ana-1');
await q(`update atletas set estado = 'activo' where id = $1`, [ana.id]);
check(await crearApi(b).miCarreraAlDia() === null, 'y el móvil del atleta no hace nada (ni da error)');
await b.guion(readFileSync(new URL('../supabase/migraciones/088_carrera_al_dia.sql', import.meta.url), 'utf8'));
check((await crearApi(b).miCarreraAlDia())?.puestas === 0, 'con la 088 otra vez (se puede repetir), vuelve a ir');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
