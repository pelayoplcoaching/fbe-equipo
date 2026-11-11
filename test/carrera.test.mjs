// La carrera (v0.133, migración 056): la lógica pura (logica/carrera.js y lo nuevo de logica/cardio.js) y la migración
// en un Postgres local (PGlite): la forma de la pauta y de lo hecho, la FC y el dolor solo con consentimiento, quién ve y
// quién cambia cada tabla, las semanas del plan y la biblioteca de partida (la misma en la demo).
// Uso: node test/carrera.test.mjs
import { readFileSync } from 'node:fs';
import * as C from '../web/src/logica/carrera.js';
import { cardioValido, cardioHechoValido, pautaValida, parteValida, limpiarCardio, limpiarCardioHecho, textoCardio, textoCardioHecho, textoSaludCardio, cardioHechoPublico, solo013, CLAVES_HECHO_013 } from '../web/src/logica/cardio.js';
import { RECETAS_CARRERA, semillaDemo } from '../web/src/datos/semilla-demo.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('La lógica pura');
const z = C.zonasFC({ lthr: 181 });
check(z.map(C.textoRangoZona).join(' | ') === '≤153 ppm | 154–162 ppm | 163–171 ppm | 172–180 ppm | ≥181 ppm', 'las zonas de Friel desde la FC umbral (181: las mismas del plan de un atleta real)');
check(C.zonasFC({ lthr: 181, zonas: [150, 160, 170, 180] })[1].min === 150 && C.zonasFC({}) === null && C.zonaDeFC(175, z) === 4, 'las zonas a mano mandan; sin FC umbral, ninguna; en qué zona cae una FC');
check(C.textoZona(1, 2, z) === 'Z1–Z2 (≤162 ppm)' && C.textoZona(4, null, z) === 'Z4 (172–180 ppm)' && C.textoZona(3) === 'Z3', 'el texto de una zona (o dos), con sus pulsaciones');
check(C.fmtRitmo(310) === '5:10' && C.textoRitmo([320, 310]) === '5:10–5:20 min/km' && C.leerRitmo('5.41') === 341 && C.leerRitmo('5:61') === null
  && JSON.stringify(C.leerRangoRitmo('5:10-5:20')) === '[310,320]' && C.leerRangoRitmo('rápido') === undefined && C.leerRangoRitmo('') === null, 'ritmos: escribir y leer (5:10, 5.41, 5:10-5:20)');
check(C.leerTiempo('58:75') === null && C.leerTiempo('1:61:00') === null && C.leerTiempo('1:59:00') === 7140 && C.leerTiempo('58:30') === 3510 && C.leerTiempo('1h58') === 7080 && C.fmtTiempo(7140) === '1:59:00' && C.fmtTiempo(3510) === '58:30', 'tiempos: 1:59:00, 58:30, 1h58');
check(C.fmtDuracion(20) === '20 s' && C.fmtDuracion(360) === '6 min' && C.fmtDuracion(90) === '1:30 min' && C.fmtDuracion(3900) === '1 h 5 min' && C.fmtDistancia(2000) === '2 km' && C.fmtDistancia(400) === '400 m', 'duraciones y distancias legibles');
const parte = { fase: 'bloque', reps: 2, seg: 360, zona: 4, ritmo: [310, 320], rec_seg: 120, rec: 'trote suave' };
check(C.textoParte(parte, z) === '2 × 6 min · Z4 (172–180 ppm) · 5:10–5:20 min/km · rec. 2 min trote suave' && C.segundosParte(parte) === 840, 'una parte en palabras y lo que dura (2 × 6 min con 2 de recuperación: 14 min)');
check(!parteValida({ fase: 'bloque' }) && !parteValida({ fase: 'otra', seg: 60 }) && !parteValida({ fase: 'bloque', seg: 60, zona: 3, zona_hasta: 2 }) && parteValida({ fase: 'libre', nota: 'A sensaciones' }), 'una parte necesita duración, distancia o nota; fase y zonas válidas');
const lp = C.limpiarParte({ fase: 'bloque', reps: '2', min: '6', zona: '4', ritmo: '5:10-5:20', rec_min: '2', rec: 'trote' });
check(lp.error === null && JSON.stringify(lp.parte) === JSON.stringify({ fase: 'bloque', reps: 2, seg: 360, zona: 4, ritmo: [310, 320], rec_seg: 120, rec: 'trote' })
  && C.limpiarParte({ fase: 'bloque' }).error && C.limpiarParte({ fase: 'bloque', min: '5', ritmo: 'deprisa' }).error, 'del editor a una parte (y lo que falta, en palabras)');
check(JSON.stringify(C.limpiarParte(C.parteAEditor(parte)).parte) === JSON.stringify(parte), 'y de la parte al editor y vuelta, igual');
check(C.minutosPauta({ partes: [{ fase: 'calentar', seg: 900 }, parte, { fase: 'enfriar', seg: 600 }] }) === 39 && C.minutosPauta({ minutos: 30 }) === 30, 'los minutos de una pauta: los suyos o la suma de sus partes');

console.log('\nLa pauta y lo hecho (cardio.js, como la 056)');
const pauta = { modalidad: 'carrera', tipo: 'facil', minutos: 35, minutos_max: 45, zona: 2 };
check(cardioValido(pauta) && textoCardio(pauta) === '35–45 min de carrera fácil en Z2' && textoCardio({ modalidad: 'carrera', minutos: 30, esfuerzo: 6 }) === '30 min de correr a esfuerzo 6', 'la pauta con tipo, rango y zona (y la de antes, igual)');
check(!cardioValido({ ...pauta, minutos_max: 30 }) && !cardioValido({ modalidad: 'carrera', km_max: 10 }) && cardioValido({ modalidad: 'carrera', partes: [parte] }) && !cardioValido({ modalidad: 'carrera', tipo: 'paseo', minutos: 30 }), 'rangos al derecho, el máximo con su mínimo; con partes vale sin minutos; tipos cerrados');
check(pautaValida({ modalidad: 'carrera', tipo: 'facil' }, false) && !pautaValida({ modalidad: 'carrera', tipo: 'facil' }, true), 'una sesión del plan puede ir sin volumen; la de la semana, no');
const { pauta: p1 } = limpiarCardio({ modalidad: 'carrera', minutos: '35', carrera: { tipo: 'facil', minutos_max: '45', zona: 2, partes: [] } });
check(JSON.stringify(p1) === JSON.stringify({ modalidad: 'carrera', minutos: 35, tipo: 'facil', zona: 2, minutos_max: 45 }) && limpiarCardio({ modalidad: 'carrera', carrera: { partes: [parte] } }).pauta?.partes?.length === 1, 'el editor guarda lo de carrera (y con partes no pide minutos)');
const h = limpiarCardioHecho({ modalidad: 'carrera', minutos: 58, seg: 12, km: '10,2'.replace(',', '.'), fc_media: '158', fc_max: 176, dolor: 2, semaforo: 'ambar', desnivel: 80 });
check(cardioHechoValido(h) && textoCardioHecho(h) === '58:12 min, 10,2 km, +80 m (5:42 min/km)' && textoSaludCardio(h) === 'FC media 158, máx. 176 · dolor 2/10', 'lo hecho: segundos, desnivel, FC, dolor y semáforo; la FC y el dolor, en su propio texto');
check(!cardioHechoValido({ modalidad: 'carrera', minutos: 30, fc_media: 170, fc_max: 160 }) && !cardioHechoValido({ modalidad: 'carrera', minutos: 30, dolor: 11 }) && !cardioHechoValido({ modalidad: 'carrera', minutos: 30, semaforo: 'azul' }), 'FC máxima por debajo de la media, dolor de 11 o un semáforo raro: no');
check(JSON.stringify(cardioHechoPublico(h)) === JSON.stringify({ modalidad: 'carrera', minutos: 58, km: 10.2, seg: 12, desnivel: 80 }) && JSON.stringify(solo013(h, CLAVES_HECHO_013)) === JSON.stringify({ modalidad: 'carrera', minutos: 58, km: 10.2 }),
  'lo que se comparte va sin la FC, el dolor ni el semáforo; para una base sin la 056, solo lo de la 013');

console.log('\nEl plan, las carreras y el semáforo');
const perfil = { plan_inicio: '2026-10-12', fases: [{ nombre: 'Recuperar', semanas: 3 }, { nombre: 'Base', semanas: 5 }, { nombre: 'Construir', semanas: 4 }, { nombre: 'Específico', semanas: 4 }, { nombre: 'Afinar', semanas: 3 }, { nombre: 'Taper', semanas: 2 }] };
const macro = C.macrociclo(perfil);
check(macro.length === 6 && macro[1].primera === 4 && macro[1].desde === '2026-11-02' && macro[5].hasta === '2027-03-07', 'el macrociclo: cada fase con sus semanas y sus fechas (21 semanas, del 12 oct al 7 mar)');
check(C.semanaDelPlan(perfil, '2026-11-11') === 5 && C.faseDe(perfil, '2026-11-11').nombre === 'Base' && C.semanasConPlan(perfil, [{ lunes: '2026-11-09', etiqueta: 'X', sesiones: [] }]).find((s) => s.n === 5).etiqueta === 'X', 'la semana de hoy (5, Base) y las semanas del plan con lo que tiene cada una');
check(!C.fasesValidas([{ nombre: 'Base', semanas: 31 }]) && !C.fasesValidas([{ nombre: '', semanas: 3 }]) && !C.fasesValidas(Array.from({ length: 13 }, () => ({ nombre: 'F', semanas: 1 }))), 'fases: de 1 a 30 semanas, con nombre, 12 como mucho');
const desc = C.sesionDesdePlan({ tipo: 'descanso', titulo: 'Descanso' });
const facil = C.sesionDesdePlan({ tipo: 'facil', titulo: 'Fácil + strides', dia: 2, minutos: 35, minutos_max: 45, zona: 2 });
check(desc === null && facil.nombre === 'Fácil + strides' && facil.tipo === 'cardio' && cardioValido(facil.cardio) && facil.dia === 2, 'del plan a la semana: el descanso no; las demás, como sesión de cardio con su pauta');
check(C.sesionPlanValida({ tipo: 'calidad', titulo: 'Umbral' }) && !C.sesionPlanValida({ tipo: 'descanso', minutos: 30 }) && !C.sesionPlanValida({ tipo: 'facil' }) && !C.sesionPlanValida({ tipo: 'facil', titulo: 'x', dia: 8 }), 'las sesiones del plan: con título o volumen; el descanso, sin volumen; días de 1 a 7');
const ev = [{ nombre: 'Getafe', fecha: '2027-01-31', prioridad: 'B', decision: 'va', distancia_km: 21.1 }, { nombre: 'Salamanca', fecha: '2027-03-07', prioridad: 'A', decision: 'va', distancia_km: 21.1, objetivo_ritmo: 341 }, { nombre: 'Los Caenes', fecha: '2026-11-15', prioridad: 'C', decision: 'no' }];
check(C.proximaCarrera(ev, '2026-11-11').nombre === 'Getafe' && C.carreraObjetivo(ev, '2026-11-11').nombre === 'Salamanca', 'la próxima carrera que cuenta (no la que no va) y la objetivo (A)');
check(C.textoCuentaAtras('2027-03-07', '2026-11-11') === 'Faltan 16 semanas y 4 días' && C.textoCuentaAtras('2026-11-12', '2026-11-11') === 'Mañana' && C.textoCuentaAtras('2026-11-01', '2026-11-11') === '', 'la cuenta atrás');
check(C.textoObjetivoCarrera(ev[1]) === '21,1 km · a 5:41 min/km' && C.textoObjetivoCarrera({ distancia_km: 21.1, objetivo_seg: 7140 }) === '21,1 km · objetivo 1:59:00 (5:38 min/km)' && C.textoResultado({ resultado_seg: 7123, distancia_km: 21.1 }) === '1:58:43 (5:38 min/km)', 'el objetivo y el resultado de una carrera, con su ritmo');
const hechas = [{ completada: true, fecha_realizada: '2026-11-10', cardio_hecho: { modalidad: 'carrera', minutos: 40, km: 7 } }, { completada: true, fecha_realizada: '2026-11-13', cardio_hecho: { modalidad: 'carrera', minutos: 60, km: 10.5 } }, { completada: true, fecha_realizada: '2026-11-13', cardio_hecho: { modalidad: 'bici', minutos: 60, km: 25 } }];
const hs = C.carreraHechaPorSemana(hechas);
check(hs['2026-11-09'].km === 17.5 && hs['2026-11-09'].sesiones === 2 && C.estadoKm(hs['2026-11-09'], { km_min: 16, km_max: 18 }) === 'bien' && C.estadoKm({ km: 10 }, { km_min: 16, km_max: 18 }) === 'corta', 'los km de carrera de cada semana (la bici no cuenta) frente a lo previsto');
check(C.pautaAmbar({ minutos: 45 }).texto.startsWith('27–36 min suaves en Z1–Z2') && C.SEMAFORO.rojo.texto.includes('no entrenes') && C.ALARMA.includes('dolor en el pecho'), 'el semáforo: en ámbar, un 20–40 % menos y sin series; en rojo, no entrenar; las señales de alarma');
const lpf = C.limpiarPerfil({ lthr: '181', fc_max: '194', umbral: '5:10-5:20', fases: perfil.fases, plan_inicio: '2026-10-14' });
check(lpf.error === null && lpf.perfil.plan_inicio === '2026-10-12' && JSON.stringify(lpf.perfil.umbral) === '[310,320]' && C.limpiarPerfil({ lthr: '90' }).error && C.limpiarPerfil({ z2: '150', z3: '140', z4: '170', z5: '180' }).error, 'el perfil: el inicio, al lunes; el umbral leído; FC fuera de rango o zonas al revés, no');
check(C.limpiarEvento({ nombre: 'Salamanca', fecha: '2027-03-07', distancia_km: '21,1', objetivo: '1:59:00', prioridad: 'A' }).evento.objetivo_seg === 7140 && C.limpiarEvento({ nombre: 'X', fecha: '2027-01-01', objetivo: 'rápido' }).error && C.limpiarEvento({ fecha: '2027-01-01' }).error, 'una carrera: tiempo objetivo leído; mal escrito o sin nombre, no');
check(C.limpiarSemana({ lunes: '2026-11-11', km_min: '18', km_max: '16' }).error && C.limpiarSemana({ lunes: '2026-11-11', km_min: '16', km_max: '18', sesiones: [{ tipo: 'facil', titulo: 'F' }] }).semana.lunes === '2026-11-09', 'una semana: km al derecho; al lunes');
check(C.conCarrera({ carrera: true }) && !C.conCarrera({ carrera: true, entrenamiento: false }) && !C.conCarrera({}), 'la carrera se ve con ella encendida y llevándole el entrenamiento');

console.log('\nLa demo');
const demo = semillaDemo('2026-11-11');
const carlos = demo.atletas.find((a) => a.nombre === 'Carlos Vera');
check(carlos.carrera === true && demo.atletas.filter((a) => a.carrera).length === 1 && demo.carrera_semanas.every((s) => C.semanaPlanValida(s)) && C.fasesValidas(demo.carrera_atleta[0].fases), 'Carlos lleva la carrera, con su plan (semanas y fases válidas)');
check(demo.carrera_recetas.length === 10 && demo.carrera_recetas.every((r) => cardioValido(r.pauta) && r.pauta.partes.length), 'la biblioteca de partida de la demo: 10 sesiones con sus partes');
const sqlRecetas = [...readFileSync(new URL('../supabase/migraciones/056_carrera.sql', import.meta.url), 'utf8').matchAll(/\('([^']+)', (\d+), '(\{.*?\})'\)/g)].map((m) => [m[1], JSON.parse(m[3])]);
check(sqlRecetas.length === 10 && JSON.stringify(sqlRecetas) === JSON.stringify(RECETAS_CARRERA), 'son las mismas, en el mismo orden, que pone la migración 056');

console.log('\nLa migración 056 (PGlite)');
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
const atletaA = (await q(`insert into public.atletas (nombre, perfil_id, estado, carrera) values ('Ana', $1, 'activo', true) returning id`, [ana]))[0].id;
const bea = await usuario('b@x.test');
const atletaB = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Bea', $1, 'activo') returning id`, [bea]))[0].id;
await q(`insert into public.consentimientos (perfil_id, tipo, version) values ($1, 'datos_salud', 'x'), ($1, 'privacidad', 'x'), ($2, 'privacidad', 'x')`, [ana, bea]);
check((await q(`select carrera from public.atletas where id = $1`, [atletaB]))[0].carrera === false && (await q(`select count(*)::int n from public.carrera_recetas`))[0].n === 10, 'atletas.carrera (apagada de entrada) y la biblioteca de partida, sin repetirse');
check((await q(`select public.cardio_valido($1::jsonb) a, public.cardio_valido($2::jsonb) b, public.cardio_valido($3::jsonb) c, public.cardio_valido($4::jsonb) d`,
  [JSON.stringify(pauta), JSON.stringify({ ...pauta, minutos_max: 30 }), JSON.stringify({ modalidad: 'carrera', partes: [parte] }), JSON.stringify({ modalidad: 'carrera', minutos: 30, nota: 'x', esfuerzo: 6 })]))
  .every((r) => r.a && !r.b && r.c && r.d), 'la base comprueba la pauta igual que la app (y la de antes sigue valiendo)');
for (const x of [h, { modalidad: 'carrera', minutos: 30, fc_media: 170, fc_max: 160 }, { modalidad: 'carrera', minutos: 30, dolor: 11 }, { modalidad: 'bici', minutos: 30, km: 12 }]) {
  check((await q(`select public.cardio_hecho_valido($1::jsonb) v`, [JSON.stringify(x)]))[0].v === cardioHechoValido(x), `lo hecho ${JSON.stringify(x).slice(0, 60)}…: la base dice lo mismo que la app`);
}
for (const s of [...demo.carrera_semanas.flatMap((x) => x.sesiones), { tipo: 'descanso', minutos: 30 }, { tipo: 'facil' }]) {
  if ((await q(`select public.carrera_sesion_plan_valida($1::jsonb) v`, [JSON.stringify(s)]))[0].v !== C.sesionPlanValida(s)) check(false, `sesión del plan distinta en la base y en la app: ${JSON.stringify(s)}`);
}
check(true, 'las sesiones del plan de la demo (y dos que no valen): la base y la app dicen lo mismo');

// Una semana programada de cada atleta con una sesión de carrera
await su();
const sesion = async (atleta) => {
  const bl = (await q(`insert into public.bloques (atleta_id, nombre, estado, fecha_inicio) values ($1, 'B', 'activo', '2026-11-09') returning id`, [atleta]))[0].id;
  const se = (await q(`insert into public.semanas (bloque_id, numero, fecha_inicio, programacion) values ($1, 1, '2026-11-09', 'programada') returning id`, [bl]))[0].id;
  return (await q(`insert into public.sesiones (semana_id, orden, nombre, tipo, cardio) values ($1, 1, 'Umbral', 'cardio', $2) returning id`, [se, JSON.stringify({ modalidad: 'carrera', tipo: 'calidad', partes: [parte] })]))[0].id;
};
const sA = await sesion(atletaA), sB = await sesion(atletaB);
await como(ana);
await q(`update public.sesiones set completada = true, fecha_realizada = '2026-11-10', cardio_hecho = $2 where id = $1`, [sA, JSON.stringify(h)]);
const hA = (await q(`select cardio_hecho from public.sesiones where id = $1`, [sA]))[0].cardio_hecho;
check(hA.fc_media === 158 && hA.dolor === 2 && hA.semaforo === 'ambar', 'con su consentimiento de salud, la FC y el dolor se guardan');
check(await falla(`update public.sesiones set cardio = '{"modalidad":"carrera","minutos":10}' where id = $1`, [sA]), 'la pauta de carrera la cambia solo el coach');
await como(bea);
await q(`update public.sesiones set completada = true, fecha_realizada = '2026-11-10', cardio_hecho = $2 where id = $1`, [sB, JSON.stringify(h)]);
const hB = (await q(`select cardio_hecho from public.sesiones where id = $1`, [sB]))[0].cardio_hecho;
check(!('fc_media' in hB) && !('fc_max' in hB) && !('dolor' in hB) && !('semaforo' in hB) && hB.km === 10.2 && hB.desnivel === 80, 'sin consentimiento, la base quita la FC, el dolor y el semáforo (y guarda lo demás)');
await como(coach);
await q(`update public.sesiones set cardio_hecho = $2 where id = $1`, [sB, JSON.stringify(h)]);
const hB2 = (await q(`select cardio_hecho from public.sesiones where id = $1`, [sB]))[0].cardio_hecho;
await q(`update public.sesiones set cardio_hecho = $2 where id = $1`, [sA, JSON.stringify({ ...h, fc_media: 160 })]);
const hA2 = (await q(`select cardio_hecho from public.sesiones where id = $1`, [sA]))[0].cardio_hecho;
check(!('fc_media' in hB2) && !('dolor' in hB2) && hA2.fc_media === 160, 'tampoco el coach los guarda sin el consentimiento del atleta (con él, sí)');

// Lo de carrera: el coach escribe; el atleta lee lo suyo; la biblioteca, solo el coach
await como(coach);
await q(`insert into public.carrera_atleta (atleta_id, lthr, fc_max, umbral, plan_inicio, fases) values ($1, 181, 194, '{310,320}', '2026-10-12', $2)`, [atletaA, JSON.stringify(perfil.fases)]);
await q(`insert into public.carrera_eventos (atleta_id, nombre, fecha, distancia_km, prioridad, objetivo_ritmo) values ($1, 'Salamanca', '2027-03-07', 21.1, 'A', 341)`, [atletaA]);
await q(`insert into public.carrera_semanas (atleta_id, lunes, etiqueta, km_min, km_max, sesiones) values ($1, '2026-11-09', 'Base', 16, 18, $2)`, [atletaA, JSON.stringify([{ tipo: 'calidad', titulo: 'Umbral 2 × 6', partes: [parte] }, { tipo: 'descanso' }])]);
await q(`insert into public.carrera_revisiones (atleta_id, fecha, titulo, estado) values ($1, '2026-11-16', 'Primera calidad', 'pendiente')`, [atletaA]);
check(await falla(`insert into public.carrera_semanas (atleta_id, lunes) values ($1, '2026-11-11')`, [atletaA]), 'una semana del plan empieza en lunes');
check(await falla(`insert into public.carrera_semanas (atleta_id, lunes, sesiones) values ($1, '2026-11-16', '[{"tipo":"facil"}]')`, [atletaA])
  && await falla(`insert into public.carrera_semanas (atleta_id, lunes, km_min, km_max) values ($1, '2026-11-23', 20, 10)`, [atletaA]), 'y sus sesiones y km se comprueban');
check(await falla(`update public.carrera_atleta set fases = '[{"nombre":"X","semanas":40}]' where atleta_id = $1`, [atletaA])
  && await falla(`update public.carrera_atleta set plan_inicio = '2026-10-14' where atleta_id = $1`, [atletaA])
  && await falla(`update public.carrera_atleta set zonas = '{160,150,170,180}' where atleta_id = $1`, [atletaA]), 'el perfil: fases de hasta 30 semanas, inicio en lunes, zonas de menos a más');
await como(ana);
check((await q(`select count(*)::int n from public.carrera_atleta`))[0].n === 1 && (await q(`select count(*)::int n from public.carrera_eventos`))[0].n === 1
  && (await q(`select count(*)::int n from public.carrera_semanas`))[0].n === 1 && (await q(`select count(*)::int n from public.carrera_revisiones`))[0].n === 1, 'el atleta lee lo suyo: perfil, carreras, semanas y revisiones');
check((await q(`select count(*)::int n from public.carrera_recetas`))[0].n === 0, 'pero no la biblioteca del coach');
check(await falla(`insert into public.carrera_eventos (atleta_id, nombre, fecha) values ($1, 'Mía', '2027-01-01')`, [atletaA])
  && (await q(`update public.carrera_atleta set lthr = 150 returning atleta_id`)).length === 0
  && (await q(`delete from public.carrera_semanas returning atleta_id`)).length === 0, 'ni escribe, cambia ni borra nada de carrera');
await como(bea);
check((await q(`select count(*)::int n from public.carrera_atleta`))[0].n === 0 && (await q(`select count(*)::int n from public.carrera_eventos`))[0].n === 0, 'otro atleta no ve lo de carrera de nadie más');
await su();
check((await q(`select count(*)::int n from information_schema.role_table_grants where table_name like 'carrera_%' and grantee in ('anon', 'PUBLIC')`))[0].n === 0
  && (await q(`select count(*)::int n from pg_class where relname like 'carrera_%' and relkind = 'r' and relrowsecurity`))[0].n === 5, 'las 5 tablas, con permisos por fila y nada para anon');
await q(`delete from public.atletas where id = $1`, [atletaA]);
check((await q(`select (select count(*) from public.carrera_atleta) + (select count(*) from public.carrera_eventos) + (select count(*) from public.carrera_semanas) + (select count(*) from public.carrera_revisiones) as n`))[0].n == 0, 'y se borra con la ficha');

await db.close();

console.log('\nLa api (PGlite)');
{
  const { crearPglite, crearBackendPglite } = await import('./backend-pglite.mjs');
  const { crearApi } = await import('../web/src/datos/api.js');
  const { hoyISO, lunesDe, sumarDias } = await import('../web/src/logica/fechas.js');
  const db2 = await crearPglite();
  const b = crearBackendPglite(db2);
  const api = crearApi(b);
  const lunes = lunesDe(hoyISO());
  await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
  await b.sql(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
  check(await api.carrera056() === true, 'la api ve la 056');
  const dani = await api.crearAtleta({ nombre: 'Atleta de carrera', carrera: true });
  check(dani.carrera === true, 'el coach crea la ficha con la carrera encendida');
  await api.guardarCarreraPerfil(dani.id, { lthr: '181', fc_max: '194', umbral: '5:10-5:20', plan_nombre: 'Media', plan_inicio: sumarDias(lunes, -14), fases: [{ nombre: 'Base', semanas: '5' }, { nombre: 'Taper', semanas: '2' }] });
  await api.guardarCarreraEvento(dani.id, { nombre: 'Media de primavera', fecha: sumarDias(lunes, 40), distancia_km: '21,1', objetivo: '1:59:00', prioridad: 'A' });
  await api.guardarCarreraSemana(dani.id, { lunes, etiqueta: 'Calidad', km_min: '16', km_max: '18', sesiones: [{ tipo: 'calidad', titulo: 'Umbral 2 × 6 min', dia: 3, partes: [parte], minutos: 45 }, { tipo: 'facil', titulo: 'Rodaje', dia: 6, minutos: 40 }, { tipo: 'descanso', titulo: 'Descanso', dia: 7 }] });
  await api.guardarCarreraRevision(dani.id, { fecha: sumarDias(lunes, 7), titulo: 'Primera calidad' });
  let d = await api.carrera(dani.id);
  check(d.perfil.lthr === 181 && d.perfil.fases.length === 2 && d.eventos[0].objetivo_seg === 7140 && d.semanas[0].sesiones.length === 3 && d.revisiones.length === 1, 'guarda y lee su perfil, sus carreras, sus semanas y sus revisiones');
  await check(await api.guardarCarreraSemana(dani.id, { lunes, km_min: '20', km_max: '10' }).then(() => false, () => true), 'una semana mal (km al revés) no se guarda');
  // La semana de entreno: las sesiones de carrera del plan, una vez
  const bl = await api.crear('bloques', { atleta_id: dani.id, nombre: 'Fuerza', estado: 'activo', fecha_inicio: lunes });
  const w = await api.crear('semanas', { bloque_id: bl.id, numero: 1, fecha_inicio: lunes, programacion: 'programada' });
  check(await api.anadirCarreraASemana(w.id, d.semanas[0].sesiones) === 2 && await api.anadirCarreraASemana(w.id, d.semanas[0].sesiones) === 0, 'pasa las 2 sesiones de carrera del plan a la semana de entreno (el descanso no) y no las repite');
  const ses = await b.sql(`select nombre, tipo, cardio, dia_previsto::text d from public.sesiones where semana_id = $1 order by orden`, [w.id]);
  check(ses.length === 2 && ses[0].tipo === 'cardio' && ses[0].cardio.partes.length === 1 && ses[0].d === sumarDias(lunes, 2) && ses[1].cardio.minutos === 40, 'con su pauta por partes y el día previsto del plan');
  // Una semana que no empieza en lunes: el día previsto, solo si cae dentro (como la 008); las sesiones entran igual
  const w2 = await api.crear('semanas', { bloque_id: bl.id, numero: 2, fecha_inicio: sumarDias(lunes, 11), programacion: 'en_programacion' });
  check(await api.anadirCarreraASemana(w2.id, d.semanas[0].sesiones) === 2, 'en una semana que empieza en viernes, las sesiones entran igual');
  const ses2 = await b.sql(`select dia_previsto::text d from public.sesiones where semana_id = $1 order by orden`, [w2.id]);
  check(ses2[0].d === null && ses2[1].d === sumarDias(lunes, 12), 'y el día previsto, solo el que cae dentro de esa semana');
  // Biblioteca
  const recetas = await api.carreraRecetas();
  await api.guardarCarreraReceta({ nombre: 'Mi umbral', pauta: ses[0].cardio });
  check(recetas.length === 10 && (await api.carreraRecetas()).length === 11, 'la biblioteca: las 10 de partida y la que guarda el coach');
  check(await api.guardarCarreraReceta({ nombre: 'Mi umbral', pauta: ses[0].cardio }).then(() => false, (e) => /Ya tienes/.test(e.message)), 'un nombre repetido, en palabras');
  check(await api.guardarCarreraReceta({ nombre: 'Sin partes', pauta: { modalidad: 'carrera', minutos: 30 } }).then(() => false, () => true), 'sin partes no va a la biblioteca');
  const exp = await api.exportar(dani.id);
  check(exp.carrera_atleta.length === 1 && exp.carrera_eventos.length === 1 && exp.carrera_semanas.length === 1 && exp.carrera_revisiones.length === 1, 'va en «Descargar mis datos»');
  await api.borrarCarreraEvento(d.eventos[0].id);
  await api.borrarCarreraSemana(dani.id, lunes);
  d = await api.carrera(dani.id);
  check(!d.eventos.length && !d.semanas.length, 'borrar una carrera y vaciar una semana');
  await db2.close();
}

console.log(`\n${ok} comprobaciones bien, ${fallos} mal`);
process.exit(fallos ? 1 : 0);
