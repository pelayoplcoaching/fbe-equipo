// Integraciones (v0.105): la lógica pura (logica/integraciones.js), la migración 051 en un Postgres local (PGlite),
// la función «integraciones» de Supabase de punta a punta (con la base de PGlite detrás, como la clave de servicio) y
// la api con el modo demo (backend-memoria).
// Uso: node test/integraciones.test.mjs
import { numero, minutosSueno, fechaDe, limpiarSalud, urlSalud, urlsCalendario, urlAtajoEntreno, tipoSalud, telefonoWa, limpiarTelefono,
  enlaceWhatsApp, semanaSalud, resumenSalud, horasSuenoTramo, textoSueno, haceDias, URL_ATAJO } from '../web/src/logica/integraciones.js';
import { calendarioICS } from '../web/src/logica/plan.js';
import { sumarDias, lunesDe } from '../web/src/logica/fechas.js';
import { readFileSync } from 'node:fs';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const lanza = (f) => { try { f(); return false; } catch { return true; } };

console.log('Los números y las fechas como los manda Atajos');
check(numero(8432) === 8432 && numero('8.432', { entero: true }) === 8432 && numero('8,432', { entero: true }) === 8432 && numero('12.345.678') === 12345678, 'pasos: el punto (y la coma) de los miles');
check(numero('72,5') === 72.5 && numero('72.5') === 72.5 && numero('72,5 kg') === 72.5 && numero('1.234,5') === 1234.5 && numero('1,234.5') === 1234.5, 'decimales con coma o punto, con la unidad detrás o con los dos signos');
check(numero('hola') === null && numero(null) === null && numero(NaN) === null && numero('') === null, 'lo que no es un número, nada');
check(minutosSueno(452) === 452 && minutosSueno(7.5) === 450 && minutosSueno('7 h 32 min') === 452 && minutosSueno('7:32') === 452 && minutosSueno('7,5', { horas: true }) === 450 && minutosSueno('45 min') === 45 && minutosSueno(27120) === 452, 'el sueño: minutos, horas, segundos, «7 h 32 min» o «7:32»');
check(fechaDe('2026-11-08') === '2026-11-08' && fechaDe('2026-11-08T07:00:00+01:00') === '2026-11-08' && fechaDe('8/11/2026') === '2026-11-08' && fechaDe('08-11-2026') === '2026-11-08', 'fechas: ISO y día/mes/año');
check(fechaDe('2026-02-30') === null && fechaDe('mañana') === null && fechaDe(5) === null, 'una fecha que no existe o no se entiende, nada');

console.log('\nLo que manda el atajo, limpio');
const hoy = '2026-11-08';
const l1 = limpiarSalud({ fecha: hoy, pasos_ayer: '9.120', sueno_min: '7 h 10 min', fc_reposo: '58', hrv: '47,3', peso: '72,40 kg' }, hoy);
check(l1.length === 2 && l1[0].fecha === hoy && l1[0].sueno_min === 430 && l1[0].fc_reposo === 58 && l1[0].hrv === 47.3 && l1[0].peso_kg === 72.4 && !('pasos' in l1[0]), 'un día: el sueño, el pulso, la HRV y el peso de hoy');
check(l1[1].fecha === '2026-11-07' && l1[1].pasos === 9120, 'y los pasos de ayer, en ayer');
const l2 = limpiarSalud({ dias: [{ fecha: '2026-11-06', steps: 100, sleep: 6.5 }, { fecha: '2026-11-06', pasos: 8000 }, { date: '2026-11-05', weight: 70 }] }, hoy);
check(l2.length === 2 && l2[0].pasos === 8000 && l2[0].sueno_min === 390 && l2[1].peso_kg === 70, 'varios días, nombres en inglés y el mismo día dos veces (los pasos, el mayor)');
check(limpiarSalud({ fc_reposo: 300, peso: 10, pasos: -5, hrv: 0 }, hoy).length === 0, 'fuera de rango, nada (y sin nada, no hay día)');
check(limpiarSalud({ fecha: '2026-08-01', pasos: 5000 }, hoy).length === 0 && limpiarSalud({ fecha: '2026-11-10', pasos: 5000 }, hoy).length === 0, 'ni de hace más de 60 días ni del futuro');
check(limpiarSalud({ pasos: 5000 }, hoy)[0]?.fecha === hoy && limpiarSalud('basura', hoy).length === 0 && limpiarSalud(null, hoy).length === 0, 'sin fecha, hoy; lo que no es un objeto, nada');
check(limpiarSalud(Array.from({ length: 50 }, (_, i) => ({ fecha: sumarDias(hoy, -i), pasos: 1000 + i })), hoy).length === 31, 'como mucho 31 días');

console.log('\nLas direcciones');
const E = 'a'.repeat(64);
check(urlSalud('https://x.supabase.co/', E) === `https://x.supabase.co/functions/v1/integraciones/salud?t=${E}` && urlSalud(null, E) === null && urlSalud('https://x.supabase.co', 'corto') === null, 'la de Salud (y sin base o con un enlace raro, nada)');
const uc = urlsCalendario('https://x.supabase.co', E);
check(uc.webcal === `webcal://x.supabase.co/functions/v1/integraciones/calendario?t=${E}` && uc.google.startsWith('https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2F'), 'la del calendario: webcal para el iPhone y la de Google');
const at = urlAtajoEntreno({ nombre: 'Pierna A', minutos: 62, fin: new Date('2026-11-08T19:00:00Z'), tipo: 'fuerza' });
const datosAt = JSON.parse(decodeURIComponent(at.split('&text=')[1]));
check(at.startsWith('shortcuts://run-shortcut?name=FBE%20a%20Salud&input=text&text=') && datosAt.minutos === 62 && datosAt.inicio === '2026-11-08T17:58:00.000Z' && datosAt.tipo === 'fuerza', 'el atajo «FBE a Salud», con la sesión, su inicio y su duración');
check(tipoSalud({ tipo: 'fuerza' }) === 'fuerza' && tipoSalud({ tipo: 'cardio', modalidad: 'carrera' }) === 'carrera' && tipoSalud({ tipo: 'cardio', modalidad: 'nada' }) === 'cardio' && tipoSalud({ tipo: 'movilidad' }) === 'flexibilidad', 'el tipo de entreno para Salud');
check(URL_ATAJO.test('https://www.icloud.com/shortcuts/0123456789abcdef0123456789abcdef') && !URL_ATAJO.test('https://malo.example/shortcuts/x') && !URL_ATAJO.test('http://www.icloud.com/shortcuts/0123456789abcdef'), 'el enlace de un atajo, solo de iCloud');

console.log('\nWhatsApp');
check(telefonoWa('612 345 678') === '34612345678' && telefonoWa('+33 6 12 34 56 78') === '33612345678' && telefonoWa('0034612345678') === '34612345678' && telefonoWa('') === null && telefonoWa('abc') === null, 'el número como lo quiere wa.me (un móvil español, con el 34)');
check(enlaceWhatsApp('612345678', '¡Feliz cumple, Ana!') === 'https://wa.me/34612345678?text=%C2%A1Feliz%20cumple%2C%20Ana!' && enlaceWhatsApp(null, 'Hola') === 'https://wa.me/?text=Hola', 'el enlace: directo a él o, sin número, WhatsApp pregunta a quién');
check(limpiarTelefono(' 612-34-56-78 ') === '612345678' && limpiarTelefono('0033612345678') === '+33612345678' && limpiarTelefono('') === '' && lanza(() => limpiarTelefono('hola')), 'el teléfono que se guarda');

console.log('\nLo que llegó, para el check-in y la ficha');
const lunes = lunesDe(hoy);   // 2026-11-02
const dias = [
  { fecha: '2026-11-08', pasos: 2000, sueno_min: 420, fc_reposo: 60, hrv: 40, peso_kg: 72.1 },
  { fecha: '2026-11-07', pasos: 10000, sueno_min: 480, fc_reposo: 58, hrv: 50 },
  { fecha: '2026-11-03', pasos: 8000, sueno_min: 360, fc_reposo: 56, hrv: 45, peso_kg: 72.6 },
  { fecha: '2026-10-30', pasos: 99999, sueno_min: 60 },
];
const sm = semanaSalud(dias, lunes, hoy);
check(sm.pasos_media === 9000 && sm.dias_pasos === 2, 'los pasos: media de los días acabados de la semana (hoy no)');
check(sm.sueno_min === 420 && sm.horas_sueno === '7-8' && sm.fc_reposo === 58 && sm.hrv === 45 && sm.peso === 72.1 && sm.hay, 'el sueño en su tramo del check-in, el pulso, la HRV y el último peso');
check(!semanaSalud([], lunes, hoy).hay && horasSuenoTramo(299) === '<5' && horasSuenoTramo(480) === '>8' && horasSuenoTramo(null) === null, 'sin datos, nada; los tramos');
const rs = resumenSalud(dias, hoy);
check(rs.ultimos.pasos === 9000 && rs.ultimos.dias === 3 && rs.anteriores.pasos === 99999, 'la ficha: los 7 últimos días y los 7 anteriores');
check(textoSueno(452) === '7 h 32' && textoSueno(null) === '—' && haceDias('2026-11-08', hoy) === 'hoy' && haceDias('2026-11-07', hoy) === 'ayer' && haceDias('2026-11-01', hoy) === 'hace 7 días', 'los textos');

console.log('\nEl calendario de la suscripción');
const ics = calendarioICS([{ id: 's1', dia: '2026-11-09', nombre: 'Pierna A' }, { id: 's2', dia: '2026-11-03', nombre: 'Torso', avisoMin: null }], { hora: '18:00', minutos: 75, avisoMin: 30, nombre: 'FBE · Entrenos', refrescoMin: 360 });
check(ics.includes('X-WR-CALNAME:FBE · Entrenos') && ics.includes('REFRESH-INTERVAL;VALUE=DURATION:PT360M') && ics.includes('X-PUBLISHED-TTL:PT360M'), 'con su nombre y cada cuánto revisarlo');
check((ics.match(/BEGIN:VALARM/g) || []).length === 1 && ics.includes('DTSTART:20261109T180000'), 'una sesión ya hecha, sin aviso; la otra, a su hora');

// ---------- La migración 051 en un Postgres local ----------
console.log('\nLa migración 051 (PGlite)');
const { PGlite } = await import('@electric-sql/pglite');
const { aplicarEsquema } = await import('./esquema.mjs');
const db = new PGlite();
await aplicarEsquema(db, { repetirMigraciones: true });
check(true, 'esquema y migraciones aplicados, también al repetirlas');
const claims = (uid, aal) => `select set_config('request.jwt.claim.sub', '${uid}', false); select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, aal }) : ''}', false);`;
const su = async () => db.exec(`reset role; ${claims('', '')}`);
const como = async (uid, aal = 'aal1') => db.exec(`reset role; ${claims(uid, aal)} set role authenticated;`);
const servicio = async () => db.exec(`reset role; ${claims('', '')} set role service_role;`);
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const falla = async (sql, params = []) => { try { await db.query(sql, params); return false; } catch { return true; } };
const uno = async (sql, params = []) => (await q(sql, params))[0]?.r;
const usuario = async (email) => { await su(); return (await q('insert into auth.users (email) values ($1) returning id', [email]))[0].id; };
const coach = await usuario('coach@x.test');
await q(`update public.perfiles set rol = 'coach', nombre = 'Coach' where id = $1`, [coach]);
const ua = await usuario('a@x.test'), ub = await usuario('b@x.test');
const aa = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo') returning id`, [ua]))[0].id;
const ab = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Bea', $1, 'activo') returning id`, [ub]))[0].id;
const hoyM = (await q(`select (now() at time zone 'Europe/Madrid')::date::text as d`))[0].d;
// Ana: hábito de pasos y de sueño; una sesión con día esta semana
const hp = (await q(`insert into public.habitos (atleta_id, nombre, tipo, objetivo, unidad, icono) values ($1, 'Pasos', 'numero', 8000, 'pasos', 'pasos') returning id`, [aa]))[0].id;
const hs = (await q(`insert into public.habitos (atleta_id, nombre, tipo, objetivo, unidad, icono) values ($1, 'Dormir', 'numero', 7.5, 'h', 'sueno') returning id`, [aa]))[0].id;
const lunesM = lunesDe(hoyM);
const bl = (await q(`insert into public.bloques (atleta_id, nombre, estado, fecha_inicio) values ($1, 'Bloque 1', 'activo', $2) returning id`, [aa, lunesM]))[0].id;
const se = (await q(`insert into public.semanas (bloque_id, numero, fecha_inicio, programacion) values ($1, 1, $2, 'programada') returning id`, [bl, lunesM]))[0].id;
const se2 = (await q(`insert into public.semanas (bloque_id, numero, fecha_inicio, programacion) values ($1, 2, $2, 'en_programacion') returning id`, [bl, sumarDias(lunesM, 7)]))[0].id;
await q(`insert into public.sesiones (semana_id, orden, nombre, dia_previsto, dinamica) values ($1, 1, 'Pierna A', $2, 'Calienta bien'), ($1, 2, 'Torso A', null, null)`, [se, sumarDias(lunesM, 2)]);
await q(`insert into public.sesiones (semana_id, orden, nombre, dia_previsto) values ($1, 1, 'Pierna B (sin publicar)', $2)`, [se2, sumarDias(lunesM, 9)]);

await como(ua);
check(await falla(`select * from public.integraciones`) && await falla(`select * from public.salud_diaria`) && await falla(`select * from public.contacto_atleta`) && await falla(`select * from public.atajos_coach`), 'nadie lee las tablas directamente');
const ini = await uno(`select public.integraciones_mias() as r`);
check(ini && ini.salud.activa === false && ini.calendario.activo === false && ini.calendario.hora === '18:00', 'al principio, nada conectado');
check(await falla(`select public.integracion_crear('salud')`), 'sin consentimiento de salud, no se conecta Salud');
await su();
await q(`insert into public.consentimientos (perfil_id, tipo, version) values ($1, 'datos_salud', '2026-10')`, [ua]);
await como(ua);
const enlaceS = await uno(`select public.integracion_crear('salud') as r`);
check(/^[0-9a-f]{64}$/.test(enlaceS), 'con él, crea su enlace de Salud (64 caracteres)');
const enlaceC = await uno(`select public.integracion_crear('calendario', '{"hora":"07:30","minutos":60,"aviso":15}'::jsonb) as r`);
const tras = await uno(`select public.integraciones_mias() as r`);
check(tras.salud.activa && tras.calendario.activo && tras.calendario.hora === '07:30' && tras.calendario.minutos === 60 && !JSON.stringify(tras).includes(enlaceS), 'los dos conectados, con sus opciones (y el enlace no vuelve a salir)');
check(await falla(`select public.integracion_crear('calendario', '{"hora":"25:00"}'::jsonb)`) && await falla(`select public.calendario_opciones('{"minutos":5}'::jsonb)`) && await falla(`select public.integracion_crear('otro')`), 'la base rechaza opciones que no valen y tipos raros');
check((await uno(`select public.calendario_opciones('{"hora":"19:00"}'::jsonb) as r`)).hora === '19:00', 'cambia la hora sin cambiar el enlace');
check(await falla(`select public.salud_recibir($1, '[]'::jsonb)`, [enlaceS]) && await falla(`select public.calendario_de($1)`, [enlaceC]), 'un atleta no puede llamar a lo de la función');
await su();
const huellas = (await q(`select salud_huella, calendario_huella from public.integraciones where atleta_id = $1`, [aa]))[0];
check(huellas.salud_huella !== enlaceS && huellas.salud_huella.length === 64, 'la base guarda la huella, no el enlace');

await servicio();
const dSalud = limpiarSalud({ fecha: hoyM, pasos_ayer: 9100, sueno_min: 425, fc_reposo: 57, hrv: 51, peso: 63.2 }, hoyM);
const r1 = await uno(`select public.salud_recibir($1, $2::jsonb) as r`, [enlaceS, JSON.stringify(dSalud)]);
check(r1?.ok && r1.dias === 2 && r1.pesos === 1 && r1.habitos === 2, 'la función guarda los días, los pasos y el sueño en sus hábitos y el peso');
const r2 = await uno(`select public.salud_recibir($1, $2::jsonb) as r`, [enlaceS, JSON.stringify([{ fecha: sumarDias(hoyM, -1), pasos: 5000 }, { fecha: hoyM, peso_kg: 99, fc_reposo: 400 }])]);
check(r2?.ok && r2.habitos === 0 && r2.pesos === 0, 'los pasos no bajan, el peso de un día ya apuntado no se cambia y lo que se sale de rango se ignora');
check((await uno(`select public.salud_recibir($1, $2::jsonb) as r`, ['b'.repeat(64), JSON.stringify(dSalud)]))?.error === 'enlace' && (await uno(`select public.salud_recibir($1, $2::jsonb) as r`, ['corto', '[]']))?.error === 'enlace', 'con otro enlace, nada');
check((await uno(`select public.salud_recibir($1, $2::jsonb) as r`, [enlaceS, JSON.stringify(Array.from({ length: 32 }, () => ({ fecha: hoyM, pasos: 1 })))]))?.error === 'demasiados', 'más de 31 días de una vez, no');
await su();
const regs = await q(`select habito_id, valor::float as v from public.registros_habito where atleta_id = $1 order by habito_id`, [aa]);
check(regs.some((x) => x.habito_id === hp && x.v === 9100) && regs.some((x) => x.habito_id === hs && x.v === 7.1), 'en sus hábitos: 9100 pasos ayer y 7,1 h de sueño hoy');
check((await q(`select kg::float as kg, notas from public.pesos where atleta_id = $1`, [aa]))[0]?.kg === 63.2, 'y su peso, «Desde Salud»');
const sd = (await q(`select * from public.salud_diaria where atleta_id = $1 and fecha = $2`, [aa, hoyM]))[0];
check(sd.peso_kg == 99 && sd.fc_reposo === 57, 'en lo que llegó de Salud, lo último (el peso nuevo) y lo que no valía, fuera');

await servicio();
const cal = await uno(`select public.calendario_de($1) as r`, [enlaceC]);
check(cal && cal.hora === '19:00' && cal.minutos === 60 && cal.aviso === 15 && cal.eventos.length === 1 && cal.eventos[0].nombre === 'Pierna A' && cal.eventos[0].descripcion === '', 'el calendario: solo las sesiones con día de semanas publicadas, con su hora');
await como(ua);
check((await uno(`select public.calendario_opciones('{"detalle":true}'::jsonb) as r`)).detalle === true && await falla(`select public.calendario_opciones('{"detalle":"si"}'::jsonb)`), 'el atleta elige si su calendario lleva las indicaciones del coach (por defecto, no)');
await servicio();
check((await uno(`select public.calendario_de($1) as r`, [enlaceC])).eventos[0].descripcion === 'Calienta bien', 'y con eso, el evento las lleva');
check((await uno(`select public.calendario_de($1) as r`, ['c'.repeat(64)])) === null, 'con otro enlace, nada');

// La otra atleta y el coach
await como(ub);
check((await uno(`select public.salud_diaria_de($1) as r`, [aa])).dias.length === 0 && (await uno(`select public.salud_diaria_de($1) as r`, [aa])).conectada === false, 'otra atleta no ve lo de Ana');
check(await falla(`select public.contactos()`) && await falla(`select public.atajo_guardar('salud', 'https://www.icloud.com/shortcuts/0123456789abcdef')`), 'un atleta no ve teléfonos ni pone atajos');
await como(ua);
check((await uno(`select public.salud_diaria_de($1) as r`, [aa])).dias.length === 2, 'Ana ve lo suyo');
await como(coach, 'aal2');
const deAna = await uno(`select public.salud_diaria_de($1) as r`, [aa]);
check(deAna.conectada && deAna.dias.length === 2 && deAna.ultimo, 'el coach ve lo que llegó de Ana y cuándo');
await q(`select public.atajo_guardar('salud', 'https://www.icloud.com/shortcuts/0123456789abcdef0123456789abcdef')`);
check(await falla(`select public.atajo_guardar('salud', 'https://malo.example/x')`) && await falla(`select public.atajo_guardar('otro', 'https://www.icloud.com/shortcuts/0123456789abcdef')`), 'el coach guarda su atajo (y uno raro, no)');
await q(`select public.contacto_guardar($1, '612 34 56 78')`, [aa]);
await q(`select public.contacto_guardar($1, '0033612345678')`, [ab]);
const tels = await uno(`select public.contactos() as r`);
check(tels[aa] === '612345678' && tels[ab] === '+33612345678', 'y los teléfonos (limpios)');
check(await falla(`select public.contacto_guardar($1, 'hola')`, [aa]), 'un teléfono que no vale, no');
await q(`select public.contacto_guardar($1, '')`, [ab]);
check(!(await uno(`select public.contactos() as r`))[ab], 'vacío, lo quita');
check(await falla(`select public.integracion_crear('salud')`), 'el coach no crea enlaces de nadie');
await como(ua);
check(Object.keys((await uno(`select public.integraciones_mias() as r`)).atajos).includes('salud'), 'Ana ve el atajo de su coach');

// (revisión) Las copias en sus hábitos y pesos se apuntan, con lo que había antes, para poder deshacerlas
await como(ua);
check((await uno(`select public.contacto_mio() as r`)) === '612345678', 'Ana ve su teléfono (para su descarga)');
check(await falla(`select public.copia_privada()`), 'la copia privada, solo el coach');
const d2 = sumarDias(hoyM, -3), d3 = sumarDias(hoyM, -4);
await q(`insert into public.registros_habito (habito_id, fecha, valor) values ($1, $2, 3000)`, [hp, d2]);
await servicio();
await uno(`select public.salud_recibir($1, $2::jsonb) as r`, [enlaceS, JSON.stringify([{ fecha: d2, pasos: 7000 }, { fecha: d3, pasos: 4000 }])]);
const paso = async (f) => (await q(`select valor::float as v from public.registros_habito where habito_id = $1 and fecha = $2`, [hp, f]))[0]?.v ?? null;
check(await paso(d2) === 7000 && await paso(d3) === 4000, 'el atajo sube los pasos (7000 sobre los 3000 que apuntó ella; 4000 un día sin nada)');
await como(ua);
await q(`update public.registros_habito set valor = 4500 where habito_id = $1 and fecha = $2`, [hp, d3]);
await como(coach, 'aal2');
const cp = await uno(`select public.copia_privada() as r`);
check(cp.salud_diaria.length >= 2 && cp.salud_copias.length >= 4 && cp.contacto_atleta.length >= 1 && cp.integraciones.every((x) => !('salud_huella' in x) && !('calendario_huella' in x)) && Array.isArray(cp.personal_atleta),
  'la copia completa del coach lleva las tablas de la 050 y la 051 (sin las huellas de los enlaces)');

// Al retirar el consentimiento: se desconecta Salud y se borra lo que llegó, con sus copias (lo que cambió ella se queda)
await su();
await q(`update public.consentimientos set revocado_en = now() where perfil_id = $1`, [ua]);
const regsTras = await q(`select habito_id, fecha::text as f, valor::float as v from public.registros_habito where atleta_id = $1`, [aa]);
check(await paso(d2) === 3000 && await paso(d3) === 4500 && await paso(sumarDias(hoyM, -1)) === null && !regsTras.some((x) => x.habito_id === hs),
  'al retirar el consentimiento, sus pasos vuelven a lo que apuntó ella (3000), lo que cambió ella se queda (4500) y lo que puso solo el atajo se va (pasos y sueño)');
check((await q(`select count(*)::int as n from public.pesos where atleta_id = $1 and notas = 'Desde Salud'`, [aa]))[0].n === 0
  && (await q(`select count(*)::int as n from public.salud_diaria where atleta_id = $1`, [aa]))[0].n === 0
  && (await q(`select count(*)::int as n from public.salud_copias where atleta_id = $1`, [aa]))[0].n === 0
  && (await q(`select salud_huella from public.integraciones where atleta_id = $1`, [aa]))[0].salud_huella === null,
  'y se van su peso «Desde Salud», todo lo que llegó de Salud y su clave');
await servicio();
check((await uno(`select public.salud_recibir($1, $2::jsonb) as r`, [enlaceS, JSON.stringify(dSalud)]))?.error === 'enlace', 'si retira el consentimiento, ya no entra nada');
await su();
await q(`insert into public.consentimientos (perfil_id, tipo, version) values ($1, 'datos_salud', '2026-10')`, [ua]);
await como(ua);
const enlaceS2 = await uno(`select public.integracion_crear('salud') as r`);
await su();
await q(`update public.atletas set estado = 'baja' where id = $1`, [aa]);
await servicio();
check((await uno(`select public.salud_recibir($1, $2::jsonb) as r`, [enlaceS2, JSON.stringify(dSalud)]))?.error === 'baja' && (await uno(`select public.calendario_de($1) as r`, [enlaceC])).eventos.length === 0, 'de baja: nada nuevo de Salud y el calendario, vacío');
await su();
await q(`update public.atletas set estado = 'activo' where id = $1`, [aa]);
await como(ua);
const nuevo = await uno(`select public.integracion_crear('salud') as r`);
await servicio();
check((await uno(`select public.salud_recibir($1, $2::jsonb) as r`, [enlaceS, JSON.stringify(dSalud)]))?.error === 'enlace' && (await uno(`select public.salud_recibir($1, $2::jsonb) as r`, [nuevo, JSON.stringify(dSalud)]))?.ok, 'con un enlace nuevo, el viejo deja de valer');
await como(ua);
await q(`select public.integracion_quitar('salud', true)`);
await q(`select public.integracion_quitar('calendario')`);
const fin = await uno(`select public.integraciones_mias() as r`);
check(!fin.salud.activa && !fin.calendario.activo && (await uno(`select public.salud_diaria_de($1) as r`, [aa])).dias.length === 0, 'desconecta los dos y borra lo que llegó de Salud');
await servicio();
check((await uno(`select public.calendario_de($1) as r`, [enlaceC])) === null, 'y su calendario ya no recibe nada');
// (segunda revisión) Lo que el atleta borró no vuelve; consentimientos duplicados; borrar la cuenta
await como(ua);
const e3 = await uno(`select public.integracion_crear('salud') as r`);
const d5 = sumarDias(hoyM, -6), d6 = sumarDias(hoyM, -7);
await q(`insert into public.registros_habito (habito_id, fecha, valor) values ($1, $2, 3000)`, [hp, d5]);
await servicio();
await uno(`select public.salud_recibir($1, $2::jsonb) as r`, [e3, JSON.stringify([{ fecha: d5, pasos: 7000 }, { fecha: d6, sueno_min: 420 }])]);
await como(ua);
await q(`delete from public.registros_habito where fecha in ($1, $2) and atleta_id = $3`, [d5, d6, aa]);
await servicio();
await uno(`select public.salud_recibir($1, $2::jsonb) as r`, [e3, JSON.stringify([{ fecha: d5, pasos: 6000 }, { fecha: d6, sueno_min: 360 }])]);
const regDe = async (h, f) => (await q(`select valor::float as v from public.registros_habito where habito_id = $1 and fecha = $2`, [h, f]))[0]?.v ?? null;
check(await regDe(hp, d5) === 6000 && await regDe(hs, d6) === 6, 'si ella borró el día y el atajo lo vuelve a poner, queda lo del atajo');
// dos consentimientos de salud a la vez: retirar uno no borra nada; retirar el otro, sí
await su();
const cons = await q(`insert into public.consentimientos (perfil_id, tipo, version) values ($1, 'datos_salud', '2026-11') returning id`, [ua]);
await q(`update public.consentimientos set revocado_en = now() where id = $1`, [cons[0].id]);
const nSalud = async () => (await q(`select count(*)::int as n from public.salud_diaria where atleta_id = $1`, [aa]))[0].n;
check(await nSalud() > 0, 'con otro consentimiento de salud aún vigente, retirar uno no borra nada');
await q(`update public.consentimientos set revocado_en = now() where perfil_id = $1 and tipo = 'datos_salud' and revocado_en is null`, [ua]);
check(await nSalud() === 0 && await regDe(hp, d5) === null && await regDe(hs, d6) === null, 'al retirar el último, se borra todo, y lo que ella había borrado no vuelve (ni sus 3000 pasos ni el sueño)');
// borrar la cuenta (la ficha se queda sin cuenta): lo de Salud se va
await q(`insert into public.consentimientos (perfil_id, tipo, version) values ($1, 'datos_salud', '2026-11')`, [ua]);
await como(ua);
const e4 = await uno(`select public.integracion_crear('salud') as r`);
await servicio();
await uno(`select public.salud_recibir($1, $2::jsonb) as r`, [e4, JSON.stringify([{ fecha: hoyM, fc_reposo: 56 }])]);
await su();
await q(`update public.atletas set perfil_id = null where id = $1`, [aa]);
check(await nSalud() === 0 && (await q(`select salud_huella from public.integraciones where atleta_id = $1`, [aa]))[0].salud_huella === null, 'si la ficha se queda sin cuenta (se borra la cuenta), lo de Salud y su clave se van');
await q(`update public.atletas set perfil_id = $1 where id = $2`, [ua, aa]);
await su();
await q(`delete from public.atletas where id = $1`, [ab]);
check((await q(`select count(*)::int as n from public.contacto_atleta where atleta_id = $1`, [ab]))[0].n === 0, 'al borrar la ficha, lo suyo se va con ella');
await su();

// ---------- La función «integraciones», de punta a punta ----------
console.log('\nLa función «integraciones» (con la base de PGlite detrás)');
const { atender, componerCalendario, fraseGuardado } = await import('../supabase/functions/integraciones/integraciones.js');
// Hace de PostgREST: cada /rest/v1/rpc/<nombre> se ejecuta en PGlite con la clave de servicio
const llamadas = [];
const fetchFalso = async (url, op = {}) => {
  const m = String(url).match(/\/rest\/v1\/rpc\/([a-z_]+)$/);
  if (!m) return new Response('no', { status: 404 });
  llamadas.push(m[1]);
  const args = JSON.parse(op.body || '{}');
  const nombres = Object.keys(args);
  await servicio();
  try {
    const r = await q(`select public.${m[1]}(${nombres.map((k, i) => `${k} => $${i + 1}${typeof args[k] === 'object' && args[k] !== null ? '::jsonb' : ''}`).join(', ')}) as r`,
      nombres.map((k) => (typeof args[k] === 'object' && args[k] !== null ? JSON.stringify(args[k]) : args[k])));
    return new Response(JSON.stringify(r[0].r), { status: 200 });
  } catch (e) { return new Response(JSON.stringify({ message: e.message }), { status: 400 }); } finally { await su(); }
};
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'servicio' };
await como(ua);
const eSalud = await uno(`select public.integracion_crear('salud') as r`);
const eCal = await uno(`select public.integracion_crear('calendario') as r`);
await su();
const base = 'https://x.supabase.co/functions/v1/integraciones';
const pedir = (ruta, op = {}) => atender(new Request(`${base}${ruta}`, op), { env, f: fetchFalso, hoy: hoyM });

let r = await pedir(`/calendario?t=${eCal}`);
let cuerpo = await r.text();
check(r.status === 200 && r.headers.get('content-type').startsWith('text/calendar') && cuerpo.includes('SUMMARY:Entreno: Pierna A') && cuerpo.includes('X-WR-CALNAME'), 'GET /calendario: el .ics con sus entrenos');
r = await pedir(`/calendario?t=${'d'.repeat(64)}`);
check(r.status === 404, 'con un enlace que no vale, 404');
r = await pedir('/calendario');
check(r.status === 404, 'sin enlace, 404');
r = await pedir(`/salud?t=${eSalud}`, { method: 'POST', body: JSON.stringify({ fecha: hoyM, pasos_ayer: '10.250', sueno_min: '6 h 50 min', fc_reposo: 55 }) });
cuerpo = await r.json();
check(r.status === 200 && cuerpo.ok && cuerpo.dias === 2 && /^FBE: guardado/.test(cuerpo.mensaje), 'POST /salud: guarda y responde con una frase para el atajo');
r = await pedir(`/salud?t=${eSalud}`, { method: 'POST', body: 'no es json' });
check(r.status === 400 && /JSON/.test((await r.json()).mensaje), 'si no manda JSON, se lo dice');
r = await pedir(`/salud?t=${eSalud}`, { method: 'POST', body: JSON.stringify({ hola: 1 }) });
check(r.status === 422, 'sin nada que guardar, 422');
r = await pedir(`/salud?t=${'e'.repeat(64)}`, { method: 'POST', body: JSON.stringify({ pasos: 1000 }) });
check(r.status === 401 && /ya no vale/.test((await r.json()).mensaje), 'con un enlace viejo, 401 y cómo arreglarlo');
r = await pedir('/salud', { method: 'POST', headers: { 'x-fbe-enlace': eSalud }, body: JSON.stringify({ fecha: hoyM, fc_reposo: 54 }) });
check(r.status === 200 && (await r.json()).ok, 'POST /salud con la clave en la cabecera x-fbe-enlace (la del atajo: así no queda en los registros)');
r = await pedir('/salud', { method: 'POST', headers: { 'x-fbe-enlace': eSalud, 'content-length': String(20 * 1024) }, body: JSON.stringify({ fecha: hoyM }) });
check(r.status === 413, 'un cuerpo de más de 16 KB, ni se lee (413)');
// (revisión) el texto que dejaba la función 4 s pensando antes de mirar la clave: un «sueño» de miles de cifras y una letra
const raro = '1'.repeat(15000) + 'x';
let t0 = Date.now();
r = await pedir('/salud', { method: 'POST', headers: { 'x-fbe-enlace': 'f'.repeat(64) }, body: JSON.stringify({ fecha: hoyM, sueno: raro }) });
const msRaro = Date.now() - t0;
t0 = Date.now();
const sinPensar = minutosSueno('1'.repeat(64 * 1024) + 'x') === null && numero('1'.repeat(64 * 1024)) === null && fechaDe('1'.repeat(64 * 1024)) === null;
const msDirecto = Date.now() - t0;
check(r.status === 422 && msRaro < 300 && sinPensar && msDirecto < 50, `el texto que la dejaba 4 s pensando ya no: ${msRaro} ms de punta a punta, ${msDirecto} ms leyéndolo`);
r = await pedir(`/salud?t=${eSalud}`, { method: 'GET' });
check(r.status === 405, 'Salud solo con POST');
r = await pedir('/otra');
check(r.status === 404, 'otra ruta, 404');
r = await atender(new Request(`${base}/calendario?t=${eCal}`), { env: {}, f: fetchFalso });
check(r.status === 500, 'sin la configuración de Supabase, lo dice');
r = await atender(new Request(`${base}/calendario?t=${eCal}`), { env, f: async () => { throw new Error('caída'); } });
check(r.status === 503, 'si la base no responde, 503 (el calendario lo reintenta)');
check(!/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(componerCalendario({ eventos: [{ id: 'y', dia: '2026-11-09', nombre: 'Pier\u0000na\u0007', descripcion: 'a\u001bb', tipo: 'fuerza', hecha: false }] }).replace(/\r\n/g, '')), 'en el calendario no se cuela ningún carácter de control');
check(componerCalendario({ eventos: [{ id: 'x', dia: '2026-11-09', nombre: 'Remo', tipo: 'cardio', hecha: false }] }).includes('SUMMARY:Cardio: Remo') && fraseGuardado({ dias: 1, habitos: 0, pesos: 1 }) === 'FBE: guardado (1 día, 1 peso).', 'los títulos y la frase');

console.log('\nLa función en un solo archivo, al día');
const { generarFuncionPanel } = await import('../scripts/funcion-panel.mjs');
check(readFileSync(new URL('../supabase/integraciones-panel.ts', import.meta.url), 'utf8') === await generarFuncionPanel('integraciones'), 'supabase/integraciones-panel.ts está al día (si no, «npm run funcion-panel»)');

// ---------- La api con el modo demo ----------
console.log('\nLa api en el modo demo');
const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
const { crearApi } = await import('../web/src/datos/api.js');
const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
const api = crearApi(b);
await b.auth.entrar('ana@fbe.demo', 'demo');
const yo = (await b.select('atletas', {}))[0];
const iDemo = await api.integraciones();
check(iDemo?.salud?.activa === true && iDemo.calendario.activo === false, 'Ana trae Salud conectada en la demo');
const sDemo = await api.saludDiaria(yo.id);
check(sDemo?.conectada && sDemo.dias.length >= 10, 'y lo que llegó de su iPhone (inventado)');
check(api.urlIntegraciones() === null, 'en la demo no hay dirección de verdad');
const tDemo = await api.crearIntegracion('calendario', { hora: '07:00' });
check(/^[0-9a-f]{64}$/.test(tDemo) && (await api.integraciones()).calendario.hora === '07:00', 'se suscribe al calendario (con su hora)');
let noTel = false; try { await api.contactos(); } catch { noTel = true; }
check(noTel, 'el atleta no ve teléfonos');
const exD = await api.exportar(yo.id).catch(() => null);
check(exD && Array.isArray(exD.salud_diaria) && exD.salud_diaria.length >= 10, 'lo de Salud sale en «Descargar mis datos»');
await api.quitarIntegracion('salud', true);
check(!(await api.integraciones()).salud.activa && (await api.saludDiaria(yo.id)).dias.length === 0, 'desconecta y borra');
await b.auth.salir();
await b.auth.entrar('pelayo@fbe.demo', 'demo');
await api.guardarAtajo('entreno', 'https://www.icloud.com/shortcuts/0123456789abcdef0123456789abcdef');
check((await api.atajos()).entreno, 'el coach pone el enlace de su atajo');
let malAt = null; try { await api.guardarAtajo('salud', 'https://malo.example/x'); } catch (e) { malAt = e.message; }
check(/iCloud/.test(malAt || ''), 'uno raro, con su motivo');
await api.guardarContacto(yo.id, '612 345 678');
check((await api.contactos())[yo.id] === '612345678', 'guarda el teléfono de Ana');
let malTel = null; try { await api.guardarContacto(yo.id, 'abc'); } catch (e) { malTel = e.message; }
check(/cifras/.test(malTel || ''), 'un teléfono raro, con su motivo');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
