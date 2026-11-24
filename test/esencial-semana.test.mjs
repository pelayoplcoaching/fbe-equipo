// FBE Esencial, tanda 3 (logica/esencial-semana.js): qué toca preparar al abrir la app y desde qué lunes.
import { siguientePaso } from '../web/src/logica/esencial-semana.js';
import { NOVATO_2, filasPrimeras4, NOMBRE_NOVATO_2 } from '../web/src/logica/esencial-plantilla.js';

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

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
