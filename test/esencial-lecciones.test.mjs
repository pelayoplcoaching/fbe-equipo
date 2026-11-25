// FBE Esencial, una lección por semana (logica/esencial-lecciones.js y la demo): las ocho de las guías de Pelayo, aprobadas
// el 25/11, y la semana del plan contada desde el lunes en que empezó «Primeras 4 semanas» (también tras cambiar de días).
import { LECCIONES, semanaDelPlan, leccionDe } from '../web/src/logica/esencial-lecciones.js';
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('Las lecciones');
check(LECCIONES.length === 8 && LECCIONES.every((l, i) => l.semana === i + 1 && l.titulo && l.texto.length <= 400 && (!l.mas || (l.mas.titulo && l.mas.texto))), 'ocho, de la semana 1 a la 8, cortas y con su «Leer más» si lo tienen');
check(/te sobren 4 o 5/.test(leccionDe(1).texto) && /tus marcas/.test(leccionDe(4).texto) && /Desde esta semana, la app/.test(leccionDe(5).texto) && /semáforo del dolor/.test(leccionDe(7).mas.texto),
  'con los textos de las guías (te sobren 4 o 5; tus marcas; desde la semana 5, la app; el semáforo del dolor)');
check(leccionDe(0) === null && leccionDe(9) === null, 'antes de la 1 o después de la 8, ninguna');

console.log('\nLa semana del plan');
const b = (nombre, fecha_inicio) => ({ nombre, fecha_inicio });
const primeras = b('Primeras 4 semanas', '2027-01-11');
check(semanaDelPlan([primeras], '2027-01-11') === 1 && semanaDelPlan([primeras], '2027-02-01') === 4 && semanaDelPlan([primeras, b('Novato 2 días · FBE Esencial', '2027-02-08')], '2027-02-08') === 5,
  'desde el lunes en que empezó «Primeras 4 semanas»: la 1, la 4 y, ya con «Novato 2 días», la 5');
check(semanaDelPlan([primeras, b('Novato 2 días · FBE Esencial', '2027-02-08'), b('Novato 3 días · FBE Esencial', '2027-03-01')], '2027-03-01') === 8, 'tras pasar a tres días sigue contando (la 8)');
check(semanaDelPlan([b('3 días · Full body · B · Máquinas y mancuernas', '2027-01-11')], '2027-01-11') === null && semanaDelPlan([primeras], '2027-01-04') === null, 'sin «Primeras 4 semanas» (quien ya entrenaba) o antes de empezar, ninguna');

console.log('\nEn la demo');
const bd = crearBackendMemoria({ semilla: () => semillaDemo(hoyISO(), { esencial: true }), persistir: false });
const api = crearApi(bd);
await bd.auth.entrar('tomas@fbe.demo', 'demo');
const tomas = (await bd.select('atletas', { eq: { email: 'tomas@fbe.demo' } }))[0];
await api.prepararSemanaEsencial(tomas.id);
const p = await api.programa(tomas.id);
check(semanaDelPlan(p.bloques, p.actual?.fecha_inicio) === 5 && leccionDe(5).titulo === 'Desde aquí, la app', 'Tomás, en su semana 5: «Desde aquí, la app»');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
