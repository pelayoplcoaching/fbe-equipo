// Personalización 3, tanda 8: el reto del mes hecho para él, su compañero afín y su álbum de hitos. Lógica pura.
//   node test/compania.test.mjs
import * as C from '../web/src/logica/compania.js';
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const f = (d) => new Date(Date.UTC(2026, 8, 7 + d)).toISOString().slice(0, 10); // lunes 7 sep 2026
const hoy = '2026-11-13';

// 14. el reto del mes
const ent = [];
for (let w = 0; w < 8; w++) { ent.push({ fecha: f(w * 7) }); ent.push({ fecha: f(w * 7 + 2) }); if (w % 2) ent.push({ fecha: f(w * 7 + 3) }); }
ent.push({ fecha: '2026-11-05' }, { fecha: '2026-11-12' }, { fecha: '2026-11-02' });
const r = C.retoDelMes({ entrenos: ent, hoy });
check(r.tipo === 'dia' && r.titulo === 'Este mes, todos los jueves' && r.objetivo === 4 && r.hechos === 2, 'su día flojo (el que entrena la mitad de las semanas): «todos los jueves», con lo que lleva');
const fijo = []; for (let w = 0; w < 8; w++) { fijo.push({ fecha: f(w * 7) }); fijo.push({ fecha: f(w * 7 + 2) }); }
const r2 = C.retoDelMes({ entrenos: fijo, hoy });
check(r2.tipo === 'sesiones' && r2.objetivo === 10 && /una más que tu media/.test(r2.texto), 'sin día flojo: sesiones del mes (su media y una más)');
const rc = C.retoDelMes({ entrenos: ent, hoy, agenda: [{ tipo: 'reto', fecha: '2026-11-02', titulo: 'Todas las series de espalda', creado_en: '2026-11-02T10:00:00Z' }, { tipo: 'reto', fecha: '2026-10-02', titulo: 'Viejo' }] });
check(rc.tipo === 'coach' && rc.titulo === 'Todas las series de espalda', 'el del coach (de este mes) manda');
check(C.retoDelMes({ entrenos: ent.slice(0, 3), hoy }) === null, 'con pocas sesiones, aún no');

// 15. afines
const yo = { franja: 'tarde', dias: [1, 3], por_semana: 3 };
check(C.puntuarAfin(yo, { franja: 'tarde', dias: [1, 3], por_semana: 3.5 }) > C.puntuarAfin(yo, { franja: 'manana', dias: [1], por_semana: 1 }), 'más afín: misma franja, mismos días, ritmo parecido');
const o = C.ordenarAfines({ afines: [{ perfil_id: 'y', nombre: 'Yo', yo: true, ...yo }, { perfil_id: 'a', nombre: 'Ana L.', franja: 'manana', dias: [6] }, { perfil_id: 'b', nombre: 'Bea M.', franja: 'tarde', dias: [1, 3], por_semana: 3 }] });
check(o.yo.perfil_id === 'y' && o.afines[0].nombre === 'Bea M.' && o.afines.length === 2, 'los afines, de más a menos (sin uno mismo)');
check(C.textoAfin({ franja: 'tarde', dias: [1, 4], por_semana: 2.5 }, yo) === 'Entrena por la tarde, sobre todo los lunes y jueves, 2,5 por semana · a tu misma hora' && C.textoAfin({}) === 'Aún sin entrenos recientes', 'cómo entrena, en una línea');

// 16. álbum
const muchas = Array.from({ length: 55 }, (_, i) => ({ fecha: f(i), records: i === 4 ? 1 : 0 }));
const prog = { ejercicios: [{ nombre: 'Sentadilla', puntos: [{ semana: '2026-09-14', valor: 90 }, { semana: '2026-10-05', valor: 101 }] }, { nombre: 'Dominadas pronas', puntos: [{ semana: '2026-09-21', valor: 10 }] }] };
const al = C.albumHitos({ entrenos: muchas, progreso: prog, fechaAlta: '2025-11-01', agenda: [{ id: 'h1', tipo: 'hito', fecha: '2026-10-20', titulo: 'Mi primera media maratón', autor: 'atleta' }, { id: 'h2', tipo: 'hito', fecha: '2026-12-01', titulo: 'Futuro' }], hoy });
const claves = al.map((x) => x.clave);
check(['primera', 'ses-10', 'ses-50', 'record', 'cien', 'dominada', 'aniv-6', 'aniv-12'].every((k) => claves.includes(k)), 'sus primeras veces: primera sesión, la 10 y la 50, primer récord, 100 kg, dominadas y aniversarios');
check(al.some((x) => x.titulo === 'Mi primera media maratón' && x.suyo) && !al.some((x) => x.titulo === 'Futuro'), 'y los suyos (no los de fechas futuras)');
check(al[0].fecha >= al[al.length - 1].fecha && /sentadilla/.test(al.find((x) => x.clave === 'cien').titulo), 'de lo más reciente a lo primero');
check(/^Mi álbum en FBE\n· /.test(C.textoAlbum(al)), 'para compartir');
console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
