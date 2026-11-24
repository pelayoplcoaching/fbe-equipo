// FBE Esencial, tanda 3 (logica/esencial-semana.js): qué toca preparar al abrir la app y desde qué lunes, y cómo sube la
// plancha (su regla: hasta 50 s; después, peso).
import { siguientePaso, planchaSiguiente, planchaDeLaSemana, semanaDesdePropuesta, PLANCHA } from '../web/src/logica/esencial-semana.js';
import { NOVATO_2, filasPrimeras4, NOMBRE_NOVATO_2 } from '../web/src/logica/esencial-plantilla.js';
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, lunesDe, fechaMadrid, sumarDias } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('La plantilla de la semana 5 (propuesta)');
const f = filasPrimeras4(NOVATO_2);
check(f.length === 1 && f[0].sesiones.length === 2 && f[0].sesiones.every((s) => s.ejercicios.length === 5), 'una semana, dos días iguales, los cinco ejercicios');
check(f[0].sesiones[0].ejercicios.map((e) => e.series).join() === '3,3,3,3,2' && f[0].sesiones[0].ejercicios.slice(0, 4).every((e) => e.rir_objetivo === 2 && e.reps_min === 10 && e.reps_max === 12),
  'tres series en los cuatro primeros, 10-12, te sobran 2');
check(f[0].sesiones[0].ejercicios[4].por_tiempo && f[0].sesiones[0].ejercicios[4].reps_min === 40 && f[0].sesiones[0].ejercicios[4].reps_max === 50, 'la plancha, 2 × 40-50 s');
check(NOVATO_2.nombre === NOMBRE_NOVATO_2, 'se llama «Novato 2 días · FBE Esencial»');

console.log('\nQué toca preparar');
const P4 = { id: 'b1', nombre: 'Primeras 4 semanas' };
const semanasP4 = [1, 2, 3, 4].map((n) => ({ id: `w${n}`, bloque_id: 'b1', numero: n, fecha_inicio: ['2027-01-11', '2027-01-18', '2027-01-25', '2027-02-01'][n - 1], programacion: 'programada', marcas: n === 4 }));
const ses = (hechas) => Object.fromEntries(semanasP4.map((w) => [w.id, [{ completada: hechas.includes(w.numero) }, { completada: hechas.includes(w.numero) }]]));
check(siguientePaso({ bloque: P4, semanas: semanasP4, sesiones: ses([1, 2]), hoy: '2027-01-27' }) === null, 'durante las cuatro semanas de la guía, nada (ya están publicadas)');
const n5 = siguientePaso({ bloque: P4, semanas: semanasP4, sesiones: ses([1, 2, 3, 4]), hoy: '2027-02-04' });
check(n5?.tipo === 'novato' && n5.inicio === '2027-02-08' && n5.base.id === 'w4', 'con la semana 4 hecha (jueves 4/2): el bloque de novato desde el lunes 8/2, desde sus marcas');
check(siguientePaso({ bloque: P4, semanas: semanasP4, sesiones: ses([1, 2, 3]), hoy: '2027-02-06' }) === null, 'con la semana 4 a medias, el sábado, aún nada');
check(siguientePaso({ bloque: P4, semanas: semanasP4, sesiones: ses([1, 2, 3]), hoy: '2027-02-08' })?.inicio === '2027-02-08', 'el lunes siguiente, aunque no la haya acabado');
check(siguientePaso({ bloque: P4, semanas: semanasP4, sesiones: ses([1, 2, 3]), hoy: '2027-02-24' })?.inicio === '2027-02-22', 'si lleva semanas sin abrirla, desde el lunes de esta semana');
const NV = { id: 'b2', nombre: NOMBRE_NOVATO_2 };
const semNV = [{ id: 'v1', bloque_id: 'b2', numero: 1, fecha_inicio: '2027-02-08', programacion: 'programada' }];
const s1 = siguientePaso({ bloque: NV, semanas: semNV, sesiones: { v1: [{ completada: true }, { completada: true }] }, hoy: '2027-02-12' });
check(s1?.tipo === 'siguiente' && s1.inicio === '2027-02-15', 'después, cada semana: la siguiente, desde el lunes que viene');
check(siguientePaso({ bloque: NV, semanas: [...semNV, { id: 'v2', bloque_id: 'b2', numero: 2, fecha_inicio: '2027-02-15', programacion: 'programada' }], sesiones: { v1: [{ completada: true }] }, hoy: '2027-02-13' }) === null,
  'si la siguiente ya está, nada');
check(siguientePaso({ bloque: null, semanas: [], hoy: '2027-02-13' }) === null, 'sin plan, nada (eso es de antes de empezar)');

console.log('\nEn la demo: Tomás, tras sus cuatro semanas');
const bd = crearBackendMemoria({ semilla: () => semillaDemo(hoyISO(), { esencial: true }), persistir: false });
const apiD = crearApi(bd);
await bd.auth.entrar('tomas@fbe.demo', 'demo');
const tomas = (await bd.select('atletas', { eq: { email: 'tomas@fbe.demo' } }))[0];
const r = await apiD.prepararSemanaEsencial(tomas.id);
const pT = await apiD.programa(tomas.id);
check(r?.tipo === 'novato' && pT.bloque?.nombre === NOMBRE_NOVATO_2 && pT.bloque.fecha_inicio === lunesDe(fechaMadrid()) && pT.actual?.numero === 1,
  'al abrir la app, su plan desde la semana 5: «Novato 2 días · FBE Esencial», desde este lunes');
const sesT = await apiD.sesion(pT.sesiones[pT.actual.id][0].id, tomas.id);
const kg = Object.fromEntries(sesT.ejercicios.map((e) => [e.ejercicio.nombre, Number(e.carga_sugerida_kg) || null]));
check(kg['Prensa de piernas'] === 85 && kg['Jalón al pecho'] === 40 && kg['Plancha abdominal'] === null && sesT.ejercicios.map((e) => e.series).join() === '3,3,3,3,2',
  'con los kilos de sus marcas (prensa 85, jalón 40) y la plantilla (3-3-3-3-2)');
check((await apiD.prepararSemanaEsencial(tomas.id)) === null, 'otra vez, nada');

console.log('\nLa plancha: 5 s más hasta 50; después, peso');
const pl = (reps_min, reps_max, kg = null, series = 2) => ({ series, reps_min, reps_max, carga_sugerida_kg: kg });
const hizo = (...xs) => xs.map(([reps, kg = null], i) => ({ numero: i + 1, reps, kg }));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check(igual(planchaSiguiente(pl(30, 40), hizo([40], [42])), { reps_min: 35, reps_max: 45, carga_sugerida_kg: null }), 'llega arriba en las dos series (40 de 30-40): 35-45 s');
check(igual(planchaSiguiente(pl(35, 45), hizo([45], [45])), { reps_min: 40, reps_max: 50, carga_sugerida_kg: null }), 'y de 35-45 a 40-50');
check(igual(planchaSiguiente(pl(38, 48), hizo([48], [50])), { reps_min: 40, reps_max: 50, carga_sugerida_kg: null }), 'nunca por encima de 50 s (de 38-48, a 40-50)');
check(igual(planchaSiguiente(pl(40, 50), hizo([50], [55])), { reps_min: 35, reps_max: 45, carga_sugerida_kg: 5 }), 'con 50 s en las dos: 5 kg encima y vuelta a 35-45');
check(igual(planchaSiguiente(pl(35, 45, 5), hizo([45, 5], [46, 5])), { reps_min: 40, reps_max: 50, carga_sugerida_kg: 5 }), 'con peso, otra vez de 5 en 5 segundos (5 kg, 40-50)');
check(igual(planchaSiguiente(pl(40, 50, 5), hizo([50, 5], [50, 7.5])), { reps_min: 35, reps_max: 45, carga_sugerida_kg: 7.5 }), 'y a los 50 s con 5 kg, 2,5 kg más (7,5 kg, 35-45)');
check(planchaSiguiente(pl(40, 50), hizo([50], [48])) === null, 'si una serie no llega arriba, igual');
check(planchaSiguiente(pl(40, 50), hizo([50])) === null, 'si hizo una de las dos series, igual');
check(planchaSiguiente(pl(40, 50, 5), hizo([50, 0], [50, 0])) === null, 'si la hizo sin el peso pautado (la versión difícil, apuntando 0 kg), igual');
check(planchaSiguiente(pl(40, 50), [{ numero: 1, reps: 12, kg: 8, sustituto_id: 'curl' }, { numero: 2, reps: 12, kg: 8, sustituto_id: 'curl' }]) === null, 'si hizo la alternativa (el curl), igual');
check(planchaSiguiente(pl(40, 50), hizo([50], [50]), { normal: false }) === null, 'en una semana que no es normal (descarga, a medias, tras un parón), igual');
check(planchaSiguiente(pl(40, 50), hizo([50], [50], [20])) !== null, 'una serie de más que no llega, no cuenta');
let techo = true;
for (let a = 5; a <= 60; a += 5) for (let k of [0, 2.5, 5, 10]) {
  const r = planchaSiguiente(pl(Math.max(1, a - 10), a, k || null), hizo([a, k], [a + 3, k]));
  if (r && (r.reps_max > Math.max(PLANCHA.techo, a) || (r.carga_sugerida_kg || 0) - k > PLANCHA.primerPeso)) techo = false;
}
check(techo, 'en ninguna combinación pasa de 50 s ni sube más de 5 kg de una vez');
const molestia = { tipo: 'mantener', avisos: [{ tipo: 'molestia', zona: 'zona_lumbar' }] };
check(planchaDeLaSemana({ p: pl(40, 50), fila: molestia, hechas: hizo([50], [50]) }) === null, 'con una molestia en su zona, igual');
check(planchaDeLaSemana({ p: pl(40, 50), fila: { tipo: 'pregunta' }, hechas: hizo([50], [50]) }) === null, 'con una posible errata por confirmar, igual');
check(planchaDeLaSemana({ p: pl(40, 50), soloKilos: true, hechas: hizo([50], [50]) }) === null, 'en la semana 5 manda la plantilla');
const sd = semanaDesdePropuesta({ sesiones: [{ id: 's1', orden: 1, nombre: 'Día 1' }], pautas: { s1: [{ id: 'q1', ejercicio_id: 'pl', orden: 5, ...pl(40, 50) }] },
  pares: { q1: { tipo: 'reps', propuesta: { series: 2, reps_min: 60, reps_max: 80 } } }, ejercicios: { pl: { por_tiempo: true } }, hechas: { q1: hizo([50], [50]) } });
check(sd[0].pautas[0].reps_min === 35 && sd[0].pautas[0].reps_max === 45 && sd[0].pautas[0].carga_sugerida_kg === 5 && sd[0].pautas[0].series === 2,
  'en la semana que se guarda, su regla y no lo del motor (que cuenta repeticiones)');

console.log('\nEn la demo: Tomás aguanta 50 s en la semana 5');
const w5T = pT.actual;
for (const s of pT.sesiones[w5T.id]) {
  const ses = await apiD.sesion(s.id, tomas.id);
  for (const e of ses.ejercicios) {
    for (let n = 1; n <= e.series; n++) {
      const plancha = !!e.ejercicio.por_tiempo;
      await apiD.guardarSerie({ sesion_ejercicio_id: e.id, numero: n, kg: plancha ? null : Number(e.carga_sugerida_kg), reps: plancha ? 50 : 11, rpe: plancha ? null : 8 }, tomas.id);
    }
  }
  await apiD.marcarSesion(s.id, { completada: true, fecha_realizada: hoyISO() });
}
const r6 = await apiD.prepararSemanaEsencial(tomas.id);
const pT6 = await apiD.programa(tomas.id);
const w6T = pT6.semanas.find((w) => w.bloque_id === pT6.bloque.id && w.numero === 2);
check(r6?.tipo === 'siguiente' && w6T?.fecha_inicio === lunesDe(sumarDias(fechaMadrid(), 7)), 'con la semana hecha, la siguiente desde el lunes que viene');
const ses6 = w6T ? await apiD.sesion(pT6.sesiones[w6T.id][0].id, tomas.id) : null;
const pl6 = ses6?.ejercicios.find((e) => e.ejercicio.por_tiempo);
check(pl6?.reps_min === 35 && pl6.reps_max === 45 && Number(pl6.carga_sugerida_kg) === 5, `la plancha, con 5 kg y de 35 a 45 s (${pl6?.reps_min}-${pl6?.reps_max} s, ${pl6?.carga_sugerida_kg} kg)`);
check(/en la plancha, con peso: 5 kg encima y otra vez de 35 a 45 segundos/i.test(w6T?.nota_coach || ''), `y la nota lo cuenta («${w6T?.nota_coach}»)`);

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
