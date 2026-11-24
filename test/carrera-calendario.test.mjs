// v0.218: «la carrera va por calendario». A quien va por microciclos (objetivo de días por semana) y tiene plan de carrera,
// la app del coach le pone cada semana las carreras de esa semana de su plan dentro del microciclo que esté haciendo
// (api.carreraAlDia), y Hoy y Semana las enseñan por su fecha. Contra el esquema real (PGlite, con RLS y los triggers del
// día previsto: que caiga dentro de su semana y que se mueva con ella).
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import { carrerasDeLaSemana } from '../web/src/logica/semana-natural.js';
import { hoyISO, lunesDe, sumarDias } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.message); process.exit(1); });

const db = await crearPglite();
const b = crearBackendPglite(db);
const api = crearApi(b);
const hoy = hoyISO();
const L = lunesDe(hoy);
const q = (sql, p = []) => b.sql(sql, p);
const sesionesDe = async (semanaId) => q('select id, nombre, tipo, completada, fecha_realizada, dia_previsto, orden, cardio from public.sesiones where semana_id = $1 order by orden', [semanaId]);

await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
const coachId = b.auth.sesion().user.id;
await q(`update perfiles set rol = 'coach' where id = $1`, [coachId]);

console.log('Preparación: microciclos de 2 días a 3 por semana... y un plan de carrera');
const hugo = await api.crearAtleta({ nombre: 'Hugo Ruiz', email: 'hugo@test' });
const codigo = await api.crearInvitacion(hugo.id);
// (el objetivo de días se le pone después de preparar su pasado: con él, publicar ya le pondría la carrera al día)
await api.actualizarAtleta(hugo.id, { carrera: true });
const bloque = await api.nuevoBloque(hugo.id, { nombre: 'Base', foco: 'adaptacion', fecha_inicio: sumarDias(L, -14), semanas: 4, sesionesPorSemana: 2 });
await api.activarBloque(bloque.id, hugo.id);
let completo = await api.bloqueCompleto(bloque.id);
const [w1, w2, w3, w4] = completo.semanas;
check([w1, w2, w3, w4].map((w) => w.fecha_inicio).join() === [sumarDias(L, -14), sumarDias(L, -7), L, sumarDias(L, 7)].join(), 'el bloque nace con 4 semanas de 7 en 7 (la 3.ª, la de esta semana)');
// Las semanas 2 a 4 nacen vacías: se rellenan como lo hace el coach, duplicando
await api.duplicarSemana(w1.id);
completo = await api.bloqueCompleto(bloque.id);
check((completo.sesiones[w2.id] || []).length === 2, 'duplicar la 1.ª rellena la 2.ª (vacía) con sus 2 días');
await api.publicarSemana(w1.id);
await api.publicarSemana(w2.id);
// Las carreras de la 2.ª, como antes (botón «Añadir las sesiones de carrera», por la fecha de esa semana)
await api.anadirCarreraASemana(w2.id, [{ tipo: 'facil', titulo: 'Rodaje de la pasada', dia: 2, minutos: 30 }, { tipo: 'calidad', titulo: 'Cuestas de la pasada', dia: 4, minutos: 40 }]);
let s2 = await sesionesDe(w2.id);
check(s2.filter((x) => x.tipo === 'cardio').map((x) => x.dia_previsto).join() === [sumarDias(L, -6), sumarDias(L, -4)].join(), 'la 2.ª lleva dos carreras de la semana pasada (con su día)');
// El plan de esta semana: dos con día y una sin él
const PLAN = [{ tipo: 'facil', titulo: 'Rodaje suave', dia: 2, minutos: 40, zona: 2 }, { tipo: 'calidad', titulo: 'Series 6x800', dia: 4, minutos: 50 }, { tipo: 'larga', titulo: 'Tirada larga', km: 12 }];
// (se guarda con la cuenta del coach; al ser la semana en curso, ya la pone al día: se comprueba abajo)

console.log('\nEl atleta va por detrás: la 1.ª hecha, la 2.ª a medias (le queda fuerza y una carrera de la semana pasada)');
await b.auth.registrar('hugo@test', 'contraseña-hugo-1', 'Hugo');
await api.canjearCodigo(codigo);
await api.darConsentimientos();
const s1 = await sesionesDe(w1.id);
for (const s of s1) await api.marcarSesion(s.id, { completada: true, fecha_realizada: sumarDias(L, -12) });
s2 = await sesionesDe(w2.id);
const [f2a] = s2.filter((x) => x.tipo !== 'cardio');
const rodajePasada = s2.find((x) => x.nombre === 'Rodaje de la pasada');
await api.marcarSesion(f2a.id, { completada: true, fecha_realizada: sumarDias(L, -5) });
await api.marcarSesion(rodajePasada.id, { completada: true, fecha_realizada: sumarDias(L, -6), cardio_hecho: { modalidad: 'carrera', minutos: 31, km: 5.1 } });
let p = await api.programa(hugo.id);
check(p.carril === false && p.actual.id === w2.id, 'sin objetivo de días, su carrera no va por calendario (lo de siempre)');

console.log('\nCon microciclos (3 días por semana), la app del coach pone al día su carrera');
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');
await api.actualizarAtleta(hugo.id, { dias_semana: 3 });
await b.auth.entrar('hugo@test', 'contraseña-hugo-1');
p = await api.programa(hugo.id);
check(p.carril === true && p.actual.id === w2.id, 'su programa: la carrera va por calendario y su microciclo es el 2.º');
check(carrerasDeLaSemana(p, hoy).length === 0, 'antes de ponerlas, no tiene carreras de esta semana (las de su microciclo son de la pasada)');
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');
await api.guardarCarreraSemana(hugo.id, { lunes: L, sesiones: PLAN });
completo = await api.bloqueCompleto(bloque.id);
const fechas = Object.fromEntries(completo.semanas.map((w) => [w.numero, w.fecha_inicio]));
check(fechas[2] === L && fechas[3] === sumarDias(L, 7) && fechas[4] === sumarDias(L, 14) && fechas[1] === sumarDias(L, -14),
  'su microciclo en curso pasa a esta semana y los de detrás, a las siguientes (los de antes, igual)');
s2 = await sesionesDe(w2.id);
const carreras2 = s2.filter((x) => x.tipo === 'cardio');
check(carreras2.map((x) => x.nombre).join() === 'Rodaje de la pasada,Rodaje suave,Series 6x800,Tirada larga', 'en su microciclo: la hecha de la pasada y las tres de esta semana');
check(carreras2.find((x) => x.nombre === 'Rodaje suave').dia_previsto === sumarDias(L, 1) && carreras2.find((x) => x.nombre === 'Series 6x800').dia_previsto === sumarDias(L, 3)
  && carreras2.find((x) => x.nombre === 'Tirada larga').dia_previsto === null, 'con su día de esta semana (la que no tiene, sin día)');
check(carreras2.find((x) => x.nombre === 'Rodaje de la pasada').dia_previsto === null, 'la hecha de la pasada pierde el día previsto (no se mueve a esta semana con la suya)');
const s1b = await sesionesDe(w1.id);
const cuestas = s1b.find((x) => x.nombre === 'Cuestas de la pasada');
check(!!cuestas && !cuestas.completada && cuestas.dia_previsto === null && !s2.some((x) => x.nombre === 'Cuestas de la pasada'),
  'la que no hizo de la pasada pasa a la semana de antes (sin día): ya no sale en esta, pero se puede apuntar aún');
check(s2.map((x) => x.orden).length === new Set(s2.map((x) => x.orden)).size, 'sin órdenes repetidos');
const otra = await api.carreraAlDia(hugo.id);
check(otra.puestas === 0 && !otra.movida && otra.semana === 2, 'otra vez, nada: lo que ya está no se repite');
check((await api.carrerasAlDia())[hugo.id]?.puestas === 0, 'y lo mismo para todos (lo que hace la app del coach al abrir)');

console.log('\nEl atleta ve su carrera de esta semana');
await b.auth.entrar('hugo@test', 'contraseña-hugo-1');
p = await api.programa(hugo.id);
const deEsta = carrerasDeLaSemana(p, hoy);
check(deEsta.map((x) => x.sesion.nombre).join() === 'Rodaje suave,Series 6x800,Tirada larga' && p.actual.id === w2.id, 'Hoy y Semana: sus tres carreras de esta semana, y la fuerza de su microciclo');
const rodaje = deEsta[0].sesion;
await api.marcarSesion(rodaje.id, { completada: true, fecha_realizada: hoy, cardio_hecho: { modalidad: 'carrera', minutos: 41, km: 7 } });
const [f2b] = (await sesionesDe(w2.id)).filter((x) => x.tipo !== 'cardio' && !x.completada);
await api.marcarSesion(f2b.id, { completada: true, fecha_realizada: hoy });
p = await api.programa(hugo.id);
check(p.actual.id === w2.id && carrerasDeLaSemana(p, hoy).find((x) => x.sesion.id === rodaje.id)?.sesion.completada, 'con la fuerza hecha y carreras pendientes, su microciclo no se queda atascado por ellas (no hay otro publicado aún)');

console.log('\nEl coach cambia el plan de esta semana y prepara el microciclo siguiente');
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');
await api.guardarCarreraSemana(hugo.id, { lunes: L, sesiones: [PLAN[0], { tipo: 'calidad', titulo: 'Fartlek', dia: 5, minutos: 45 }] });
s2 = await sesionesDe(w2.id);
check(s2.filter((x) => x.tipo === 'cardio').map((x) => `${x.nombre}${x.completada ? '+' : ''}`).join() === 'Rodaje de la pasada+,Rodaje suave+,Fartlek',
  'al cambiar el plan de esta semana: las pendientes se cambian por las del plan nuevo; las hechas se quedan');
await api.duplicarSemana(w2.id);
const s3 = await sesionesDe(w3.id);
check(s3.length === 2 && s3.every((x) => x.tipo !== 'cardio'), 'duplicar su microciclo no copia las carreras (le llegan de su plan)');
await api.publicarSemana(w3.id);
p = await api.programa(hugo.id);
check(p.actual.id === w3.id, 'publicado el siguiente, su microciclo es el 3.º');
check(carrerasDeLaSemana(p, hoy).map((x) => x.sesion.nombre).join() === 'Rodaje suave,Fartlek', 'y sus carreras de esta semana siguen saliendo (están en el 2.º)');
check((await sesionesDe(w3.id)).every((x) => x.tipo !== 'cardio'), 'al publicarlo no se le ponen otra vez');

console.log('\nA quien no le va la carrera por calendario, nada');
const eva = await api.crearAtleta({ nombre: 'Eva Gil', email: 'eva@test' });
await api.actualizarAtleta(eva.id, { carrera: true });
check((await api.carreraAlDia(eva.id)).motivo === 'no-aplica', 'con plan de carrera pero sin objetivo de días (semanas normales), nada');
const leo = await api.crearAtleta({ nombre: 'Leo Sanz', email: 'leo@test' });
await api.actualizarAtleta(leo.id, { carrera: true, dias_semana: 3 });
check((await api.carreraAlDia(leo.id)).motivo === 'sin-bloque', 'sin bloque, nada');
const bl2 = await api.nuevoBloque(leo.id, { nombre: 'Base', foco: 'adaptacion', fecha_inicio: L, semanas: 2, sesionesPorSemana: 2 });
await api.activarBloque(bl2.id, leo.id);
check((await api.carreraAlDia(leo.id)).motivo === 'sin-publicar', 'sin semanas publicadas, nada');
const [lw1] = (await api.bloqueCompleto(bl2.id)).semanas;
await api.publicarSemana(lw1.id);
const lw1b = (await api.bloqueCompleto(bl2.id)).semanas[0];
check((await api.carreraAlDia(leo.id, { hoy: sumarDias(L, 7) })).motivo === 'sin-carreras' && lw1b.fecha_inicio === L
  && (await api.bloqueCompleto(bl2.id)).semanas[0].fecha_inicio === L, 'sin carreras en su plan esa semana, nada se mueve (ni la fecha de su microciclo)');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
