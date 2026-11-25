// FBE Esencial sin coach, tanda 3, en la demo (la api y el espejo de la migración 099 en la demo): el catálogo, elegir
// rutina antes de empezar (el plan se rehace), cambiarla con la semana en marcha y con la siguiente ya preparada, «Tu
// rutina» y lo que ve Pelayo (el catálogo en Plantillas y «Sus rutinas» en el panel).
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, fechaMadrid, lunesDe, sumarDias } from '../web/src/logica/fechas.js';
import { recomendar, rutinaDe } from '../web/src/logica/esencial-catalogo.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
if (hoyISO() !== fechaMadrid()) { console.log('  (ahora mismo, el día de este ordenador no es el de Madrid: se salta)'); process.exit(0); }
const falla = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };

const bd = crearBackendMemoria({ semilla: () => semillaDemo(hoyISO(), { esencial: true }), persistir: false });
const api = crearApi(bd);
const hoy = hoyISO(), lunes = lunesDe(hoy), proximo = sumarDias(lunes, 7), enDos = sumarDias(lunes, 14);
const coach = () => bd.auth.entrar('pelayo@fbe.demo', 'demo');
const bloquesDe = async (id) => { await coach(); return (await bd.select('bloques', { eq: { atleta_id: id, es_plantilla: false } })).sort((x, y) => (x.numero || 0) - (y.numero || 0)); };

console.log('El catálogo, y Pelayo lo decide en Plantillas');
await coach();
const atletas = await bd.select('atletas', { eq: { modalidad: 'por_su_cuenta' } });
const marina = atletas.find((a) => a.email === 'marina@fbe.demo'), tomas = atletas.find((a) => a.email === 'tomas@fbe.demo');
const plantillas = await api.plantillas();
const dentro = plantillas.filter((p) => p.esencial_catalogo);
check(dentro.length >= 12 && plantillas.every((p) => typeof p.esencial_catalogo === 'boolean'), `en la demo, las de FBE Esencial y las de muestra de la biblioteca están en el catálogo (${dentro.length} de ${plantillas.length})`);
const cat0 = await api.esencialCatalogo();
const viaje = plantillas.find((p) => /De viaje/.test(p.nombre));
await api.esencialPlantillaEnCatalogo(viaje.id, false);
const cat1 = await api.esencialCatalogo();
check(cat0.length === dentro.length && cat1.length === cat0.length - 1 && !cat1.some((x) => x.nombre === viaje.nombre), 'al sacar una del catálogo, deja de salir');
await api.esencialPlantillaEnCatalogo(viaje.id, true);
check((await api.esencialCatalogo()).length === cat0.length && cat0.every((x) => x.sesiones.length === x.dias && x.sesiones.every((s) => s.ejercicios.length > 0 && s.ejercicios.every((e) => e.nombre && e.series > 0 && 'descanso_seg' in e))),
  'y vuelve al meterla; cada rutina, con sus días y sus ejercicios (series, repeticiones y descanso, para estimar lo que dura)');
check(cat0.every((x) => rutinaDe(x.nombre)), 'todas las de la demo son rutinas del catálogo de la app (con su texto y su imagen)');

console.log('\nAntes de empezar: elegir y cambiar de idea');
// (Marina empieza dentro de dos semanas: su plan aún no ha empezado, sea el día que sea hoy)
await bd.update('atletas', { esencial_inicio: enDos }, { eq: { id: marina.id } });
await bd.auth.entrar('marina@fbe.demo', 'demo');
const gustos = { ahora: 'si', tecnica: 'si', barra: 'no', prioridad: 'equilibrado', otro: 'no', mayor: 'no' };
const c = await api.guardarCuestionario(marina.id, { objetivos: ['salud'], experiencia: '1_3', dias_semana: 3, minutos_sesion: 60, lugar: 'gimnasio', material: [], activo: false, enfermedad: false, sintomas: [], otras: [], lesiones: [], gustos }, { completar: true });
check(c.gustos?.prioridad === 'equilibrado' && c.resultado === 'sin_valoracion', '«Tus gustos» se guardan con su cuestionario');
const rec = recomendar({ cuestionario: c, gustos: c.gustos, disponibles: cat0.map((x) => x.nombre) });
check(rec.length >= 2 && rec.length <= 3 && rec.every((x) => cat0.some((y) => y.nombre === x.rutina.nombre)), `con el catálogo de la demo: ${rec.length} recomendadas (${rec.map((x) => x.rutina.titulo).join(' | ')})`);
let r = await api.esencialElegirRutina(rec[0].rutina.nombre);
const plan = await api.esencialAsignarPlan();
let bs = await bloquesDe(marina.id);
check(r.rutina === rec[0].rutina.nombre && !r.rehecho && plan.nuevo && bs.length === 1 && bs[0].nombre === rec[0].rutina.nombre && String(bs[0].fecha_inicio).slice(0, 10) === enDos, 'elige y la app le prepara su plan con esa rutina, desde su lunes');
await bd.auth.entrar('marina@fbe.demo', 'demo');
const pautas = Object.values((await api.bloqueCompleto(bs[0].id)).pautas || {}).flat();
check(pautas.length > 0 && pautas.filter((x) => x.rir_objetivo != null).length >= pautas.length - 3 && pautas.every((x) => x.rir_objetivo == null || Number(x.rir_objetivo) === 2.5), 'con «te sobran 2-3» de partida (menos en lo que va por tiempo)');
let est = await api.esencialRutina(marina.id, { bloqueId: bs[0].id });
check(est.con099 && est.elegida === rec[0].rutina.nombre && est.estancados === 0, '«Tu rutina»: la que ha elegido');
r = await api.esencialElegirRutina(rec[1].rutina.nombre);
bs = await bloquesDe(marina.id);
check(r.rehecho === true && bs.length === 1 && bs[0].nombre === rec[1].rutina.nombre && String(bs[0].fecha_inicio).slice(0, 10) === enDos && r.bloque === bs[0].id, 'cambia de idea antes de su lunes: el plan se rehace con la nueva (y sigue teniendo uno solo)');
await bd.auth.entrar('marina@fbe.demo', 'demo');
r = await api.esencialElegirRutina(rec[1].rutina.nombre);
check(!r.rehecho && (await bloquesDe(marina.id))[0].id === bs[0].id, 'elegir la que ya tiene no rehace nada');
await bd.auth.entrar('marina@fbe.demo', 'demo');
check(/no está en el catálogo/.test((await falla(() => api.esencialElegirRutina('Primeras 4 semanas')))?.message || '') && /no está en el catálogo/.test((await falla(() => api.esencialElegirRutina('Una inventada')))?.message || ''),
  'solo se elige una del catálogo (y «Primeras 4 semanas» no se elige)');

console.log('\nCon su plan en marcha: el cambio entra el lunes');
// Tomás acabó «Primeras 4 semanas»: la app le prepara la de novato para este lunes
await bd.auth.entrar('tomas@fbe.demo', 'demo');
const s5 = await api.prepararSemanaEsencial(tomas.id);
bs = await bloquesDe(tomas.id);
const novato = bs[bs.length - 1];
check(s5?.tipo === 'novato' && /^Novato 2/.test(novato.nombre) && String(novato.fecha_inicio).slice(0, 10) === lunes, 'tras sus cuatro primeras semanas, sin elegir nada: la de novato de sus días, como siempre');
await bd.auth.entrar('tomas@fbe.demo', 'demo');
const X = '3 días · Full body · B · Máquinas y mancuernas', Y = '2 días · Full body · C · Énfasis glúteo y pierna';
r = await api.esencialElegirRutina(X);
check(r.rutina === X && !r.rehecho && (await bloquesDe(tomas.id)).length === bs.length, 'elige otra con su semana en marcha: no se toca nada todavía');
await bd.auth.entrar('tomas@fbe.demo', 'demo');
check((await api.prepararSemanaEsencial(tomas.id)) === null, 'y hasta acabar su semana (o que llegue el lunes) la app no prepara la siguiente');
// acaba su semana el mismo día: la app le prepara ya la del lunes, con la rutina elegida
await coach();
const prog = await api.programa(tomas.id);
for (const s of prog.sesiones[prog.actual.id]) await bd.update('sesiones', { completada: true, fecha_realizada: hoy }, { eq: { id: s.id } });
await bd.auth.entrar('tomas@fbe.demo', 'demo');
const cambio = await api.prepararSemanaEsencial(tomas.id);
bs = await bloquesDe(tomas.id);
check(cambio?.tipo === 'cambio' && cambio.plantilla === X && bs[bs.length - 1].nombre === X && String(bs[bs.length - 1].fecha_inicio).slice(0, 10) === proximo && bs[bs.length - 2].estado === 'finalizado',
  'al acabar su semana: su plan pasa a la rutina elegida desde el lunes que viene');
// cambia de idea antes del lunes: lo preparado sin empezar se quita y se prepara otra vez con la nueva
await bd.auth.entrar('tomas@fbe.demo', 'demo');
r = await api.esencialElegirRutina(Y);
let bs2 = await bloquesDe(tomas.id);
check(r.rehecho === true && r.preparar === true && bs2.length === bs.length - 1 && bs2[bs2.length - 1].id === novato.id && bs2[bs2.length - 1].estado === 'activo', 'cambia de idea antes del lunes: lo preparado y sin empezar se quita y vuelve a su plan de antes');
await bd.auth.entrar('tomas@fbe.demo', 'demo');
const otra = await api.prepararSemanaEsencial(tomas.id);
bs2 = await bloquesDe(tomas.id);
check(otra?.tipo === 'cambio' && otra.plantilla === Y && bs2.length === bs.length && bs2[bs2.length - 1].nombre === Y && String(bs2[bs2.length - 1].fecha_inicio).slice(0, 10) === proximo, 'y la app lo prepara otra vez con la nueva: empieza con ella el lunes, no una semana después');
// seguir con la de antes: igual
await bd.auth.entrar('tomas@fbe.demo', 'demo');
r = await api.esencialElegirRutina(novato.nombre);
await api.prepararSemanaEsencial(tomas.id);
bs2 = await bloquesDe(tomas.id);
const semanasNovato = (await bd.select('semanas', { eq: { bloque_id: novato.id } })).length;
check(r.preparar === true && bs2[bs2.length - 1].id === novato.id && bs2[bs2.length - 1].estado === 'activo' && semanasNovato === 2, '«Seguir con la mía»: vuelve a su rutina de antes, con su semana siguiente preparada');
// con algo ya hecho en lo preparado, no se rehace
await coach();
const w2 = (await bd.select('semanas', { eq: { bloque_id: novato.id } })).sort((x, y) => y.numero - x.numero)[0];
const s1 = (await bd.select('sesiones', { eq: { semana_id: w2.id } })).sort((x, y) => x.orden - y.orden)[0];
await bd.update('sesiones', { completada: true, fecha_realizada: hoy }, { eq: { id: s1.id } });
await bd.auth.entrar('tomas@fbe.demo', 'demo');
r = await api.esencialElegirRutina(X);
check(!r.rehecho && (await bd.select('semanas', { eq: { bloque_id: novato.id } })).length === 2, 'si ya adelantó una sesión de la semana que viene, no se quita: el cambio entra con la siguiente');

console.log('\nLo que ve Pelayo: «Sus rutinas»');
await coach();
const filas = await api.esencialRutinas();
const fm = filas.find((x) => x.atleta_id === marina.id), ft = filas.find((x) => x.atleta_id === tomas.id);
check(!!fm && fm.rutina === rec[1].rutina.nombre && fm.recomendada === true && fm.inicio === enDos && fm.semanas === 0 && fm.cambios === 0, 'Marina: su rutina, que es de sus recomendadas y aún no ha empezado');
check(!!ft && /^Novato 2/.test(ft.rutina) && ft.recomendada === null && ft.despues === X && /Cuerpo entero/.test(ft.despuesTitulo || ''), 'Tomás: la de novato (su camino de serie) y la que ha elegido para después');
// una fuera de lo recomendado: Marina (de 1 a 3 años, en el gimnasio) se pone la de casa
await bd.auth.entrar('marina@fbe.demo', 'demo');
await api.esencialElegirRutina('3 días · Full body en casa, sin material');
await coach();
const filas2 = await api.esencialRutinas();
check(filas2[0].atleta_id === marina.id && filas2[0].recomendada === false, 'y si alguien se pone una que no es de sus recomendadas, sale la primera y marcada');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
