// v0.228 (migración 089): la ficha de salud para correr (R44) y la mañana siguiente (R45), contra el esquema real (PGlite,
// con RLS y los triggers). La ficha la escribe el coach y la ve el atleta; sin el consentimiento de salud del atleta, la
// base no la guarda. La mañana siguiente la escribe el propio atleta (con su consentimiento, de esa semana y de una salida
// suya) y la ve su coach; otro atleta no la ve. Y sin la 089, la app sigue como antes.
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, lunesDe, sumarDias, fechaMadrid } from '../web/src/logica/fechas.js';
import { VERSION_LEGAL, VERSION_LEGAL_SIN_089 } from '../web/src/legal-version.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.message); process.exit(1); });
if (hoyISO() !== fechaMadrid()) {
  console.log('  (ahora mismo, el día de este ordenador no es el de Madrid: se salta)');
  process.exit(0);
}
const db = await crearPglite();
const b = crearBackendPglite(db);
const api = crearApi(b);
const q = (sql, p = []) => b.sql(sql, p);
const hoy = hoyISO();
const falla = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };

await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const ana = await api.crearAtleta({ nombre: 'Ana Ruiz', email: 'ana@test' });
const luis = await api.crearAtleta({ nombre: 'Luis Gil', email: 'luis@test' });
const codAna = await api.crearInvitacion(ana.id);
const codLuis = await api.crearInvitacion(luis.id);
// una salida de Ana de ayer (en su bloque)
const [bl] = await q(`insert into bloques (atleta_id, numero, nombre, fecha_inicio, estado) values ($1, 1, 'Base', $2, 'activo') returning id`, [ana.id, lunesDe(sumarDias(hoy, -1))]);
const [w] = await q(`insert into semanas (bloque_id, numero, fecha_inicio, programacion) values ($1, 1, $2, 'programada') returning id`, [bl.id, lunesDe(sumarDias(hoy, -1))]);
const [ses] = await q(`insert into sesiones (semana_id, orden, nombre, tipo, cardio, completada, fecha_realizada, cardio_hecho) values ($1, 1, 'Tirada larga', 'cardio', $2, true, $3, $4) returning id`,
  [w.id, JSON.stringify({ modalidad: 'carrera', tipo: 'larga', minutos: 60 }), sumarDias(hoy, -1), JSON.stringify({ modalidad: 'carrera', minutos: 62, km: 10 })]);

console.log('La ficha de salud para correr (R44)');
check(await api.carrera089() === true && await api.versionLegal() === VERSION_LEGAL && VERSION_LEGAL === '2026-12.43', 'con la 089 (y las 091, 093, 094 y 105 de después): la app la ve y la política es la vigente, la 2026-12.42');
const sinC = await api.guardarCarreraSalud(ana.id, { salud_riesgo: true, farmaco_pulso: true, farmaco_cambio: sumarDias(hoy, -20), prudente: true });
const fila0 = (await q(`select * from carrera_atleta where atleta_id = $1`, [ana.id]))[0];
check(sinC.sinConsentimiento && fila0 && fila0.salud_riesgo === null && fila0.farmaco_pulso === null && fila0.prudente === null,
  'sin el consentimiento de salud de Ana, la base no guarda su ficha de salud (aunque la escriba el coach)');
await b.auth.registrar('ana@test', 'contraseña-ana-1', 'Ana');
await api.canjearCodigo(codAna);
await api.darConsentimientos();
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');
const conC = await api.guardarCarreraSalud(ana.id, { salud_riesgo: true, salud_visto_bueno: '', farmaco_pulso: true, farmaco_cambio: sumarDias(hoy, -20), prudente: true });
check(!conC.sinConsentimiento && conC.fila.salud_riesgo === true && conC.fila.salud_visto_bueno === null && conC.fila.farmaco_pulso === true && conC.fila.prudente === true,
  'con su consentimiento, se guarda: enfermedad o síntomas (sin visto bueno aún), el fármaco con su cambio de dosis y «más de 60 o lesión»');
await api.guardarCarreraPerfil(ana.id, { lthr: 170, umbral: '5:00' });
const tras = (await api.carrera(ana.id)).perfil;
check(tras.lthr === 170 && tras.salud_riesgo === true && tras.farmaco_pulso === true, 'guardar las zonas no borra la ficha de salud (ni al revés)');

console.log('\nLa mañana siguiente (R45)');
await b.auth.entrar('ana@test', 'contraseña-ana-1');
const apiAna = crearApi(b);
const verAna = (await apiAna.carrera(ana.id)).perfil;
check(verAna?.salud_riesgo === true && verAna.prudente === true, 'Ana ve su ficha de salud para correr');
const m1 = await apiAna.guardarManana(ana.id, { fecha: hoy, sesion_id: ses.id, dolor: 4, como: 'peor', donde: 'tibia', hueso: true, salto: false });
check(m1?.dolor === 4 && m1.como === 'peor' && m1.hueso === true && m1.sesion_id === ses.id, 'Ana apunta cómo se ha levantado tras la tirada de ayer');
const m2 = await apiAna.guardarManana(ana.id, { fecha: hoy, sesion_id: ses.id, dolor: 2, como: 'igual', donde: 'tibia' });
const suyas = await q(`select count(*)::int n from carrera_mananas where atleta_id = $1`, [ana.id]);
check(m2?.dolor === 2 && suyas[0].n === 1, 'si la cambia esa mañana, se cambia (una por mañana)');
check(!!(await falla(() => apiAna.guardarManana(ana.id, { fecha: sumarDias(hoy, -9), dolor: 1, como: 'igual' }))), 'de hace más de una semana, no');
check(!!(await falla(() => apiAna.guardarManana(luis.id, { fecha: hoy, dolor: 1, como: 'igual' }))), 'la de otro atleta, no');
const [otraSes] = await q(`insert into sesiones (semana_id, orden, nombre, tipo, completada) values ($1, 2, 'Ajena', 'fuerza', false) returning id`, [w.id]);
const [blL] = await q(`insert into bloques (atleta_id, numero, nombre, fecha_inicio, estado) values ($1, 1, 'Base', $2, 'activo') returning id`, [luis.id, lunesDe(hoy)]);
const [wL] = await q(`insert into semanas (bloque_id, numero, fecha_inicio, programacion) values ($1, 1, $2, 'programada') returning id`, [blL.id, lunesDe(hoy)]);
const [sesL] = await q(`insert into sesiones (semana_id, orden, nombre, tipo, completada) values ($1, 1, 'De Luis', 'fuerza', false) returning id`, [wL.id]);
check(!!otraSes && !!(await falla(() => apiAna.guardarManana(ana.id, { fecha: sumarDias(hoy, -1), sesion_id: sesL.id, dolor: 1, como: 'igual' }))), 'ni con una sesión de otro');
await apiAna.revocarConsentimiento((await apiAna.consentimientos()).find((c) => c.tipo === 'datos_salud').id);
check(!!(await falla(() => apiAna.guardarManana(ana.id, { fecha: sumarDias(hoy, -1), dolor: 1, como: 'igual' }))), 'sin su consentimiento de salud, no se guarda');

console.log('\nQuién la ve');
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');
const dC = await api.carrera(ana.id);
check(dC.mananas.length === 1 && dC.mananas[0].dolor === 2 && dC.falta089 === false, 'su coach la ve en su carrera');
await b.auth.registrar('luis@test', 'contraseña-luis-1', 'Luis');
await api.canjearCodigo(codLuis);
await api.darConsentimientos();
check((await crearApi(b).carrera(ana.id)).mananas?.length === 0, 'otro atleta no ve las de Ana');
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');
const datos = await api.exportar(ana.id).catch((e) => ({ error: e.message }));
check((datos?.carrera_mananas || []).length === 1 && (datos?.carrera_atleta || [])[0]?.salud_riesgo === true, `va en su descarga de datos, con su ficha de salud${datos?.error ? ` (${datos.error})` : ''}`);
await q(`delete from atletas where id = $1`, [ana.id]);
check((await q(`select count(*)::int n from carrera_mananas`))[0].n === 0, 'y se borra con su ficha');

console.log('\nSin la 089 (una base que aún no la tiene)');
await q('drop table public.carrera_mananas');
const apiSin = crearApi(b);
check(await apiSin.carrera089() === false && await apiSin.versionLegal() === VERSION_LEGAL_SIN_089, 'la app lo nota y la política es la 2026-12.38');
const dSin = await apiSin.carrera(luis.id);
check(dSin.falta089 === true && Array.isArray(dSin.mananas) && dSin.mananas.length === 0, 'su carrera se abre igual, sin mañanas');
check(/089/.test((await falla(() => apiSin.guardarCarreraSalud(luis.id, { prudente: true })))?.message || ''), 'y guardar la ficha de salud dice que falta la 089');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
