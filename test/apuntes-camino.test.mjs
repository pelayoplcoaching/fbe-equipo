// «Apuntes», tanda C: temas y dominio, prueba de nivel, ruta «Fundamentos FBE» con certificado, objetivo diario con
// puntos y comodín, y «Tu mes en apuntes». Lógica pura. Uso: node test/apuntes-camino.test.mjs
import * as C from '../web/src/logica/apuntes-camino.js';
import { apuntesDeGuias, apuntesDeGlosario, apuntarVisto, limpiarVistos } from '../web/src/logica/apuntes.js';
import { GUIAS_DEMO } from '../web/src/datos/semilla-guias.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const todos = [...apuntesDeGuias(GUIAS_DEMO), ...apuntesDeGlosario()];

// temas
check(C.temaDe({ tipo: 'clave' }) === 'tecnica' && C.temaDe({ tipo: 'glosario' }) === 'programacion' && C.temaDe({ tipo: 'idea', guia: 'composicion' }) === 'nutricion'
  && C.temaDe({ tipo: 'idea', guia: 'sueno' }) === 'recuperacion' && C.temaDe({ tipo: 'idea', guia: 'motivacion' }) === 'mentalidad' && C.temaDe({ tipo: 'duda' }) === null && C.temaDe({ tipo: 'emparejar', efimero: true }) === null,
  'cada apunte, su tema (técnica, programación, nutrición, recuperación, mentalidad); las dudas de la app y los ejercicios, sin tema');
check(C.temaDe({ tipo: 'mito', guia: 'mitos', de: 'Nutrición', titulo: '«Cenar tarde engorda»' }) === 'nutricion', 'los mitos, por su tema');

// dominio
let e = null;
const glos = todos.filter((a) => a.tipo === 'glosario');
for (const a of glos.slice(0, 6)) e = apuntarVisto(e, a.id, '2026-11-01', null, 'bien');
e = limpiarVistos({ ...e, vistos: { ...e.vistos, [glos[0].id]: { n: 4, t: '2026-11-10', c: 3, p: '2026-12-01' } } });
const prog = C.dominio(todos, e).find((t) => t.tema === 'programacion');
check(prog.vistos === 6 && prog.practicados === 6 && prog.dominados === 1 && prog.total >= 10 && prog.nivel === 'empezando', `el dominio de un tema: vistos, practicados y dominados (${prog.vistos}/${prog.practicados}/${prog.dominados} de ${prog.total}, «${prog.etiqueta}»)`);
check(C.dominio(todos, null).every((t) => t.nivel === 'nuevo' && t.etiqueta === 'Sin empezar'), 'sin nada visto, todos «Sin empezar»');

// objetivo diario, puntos y comodín
check(C.metaDe(null) === 3 && C.metaDe(C.elegirMeta(null, 5)) === 5 && C.metaDe(C.elegirMeta(null, 4)) === 3, 'el objetivo: 1, 3 o 5 al día (3 de entrada)');
let d = null;
d = C.sumarDiario(d, '2026-11-13', 'visto'); d = C.sumarDiario(d, '2026-11-13', 'sabia');
check(JSON.stringify(C.hoyEnApuntes(d, '2026-11-13')) === JSON.stringify({ n: 2, meta: 3, hecho: false, xp: 15, falta: 1 }), 'hoy: 2 de 3, con sus puntos (5 por leer, 10 por acertar)');
d = C.sumarDiario(d, '2026-11-13', 'no');
check(C.hoyEnApuntes(d, '2026-11-13').hecho && C.hoyEnApuntes(d, '2026-11-13').xp === 17 + C.PREMIO_META && C.puntosTotales(d) === 37, 'al cumplirlo, el premio del día');
let r = null;
const cumplir = (s, dia) => { for (let i = 0; i < 3; i++) s = C.sumarDiario(s, dia, 'visto'); return s; };
for (const dia of ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']) r = cumplir(r, dia);
// el sábado 7 y el domingo 8 no: sin comodín todavía (se gana al acabar la semana), la racha se rompe el sábado
for (const dia of ['2026-11-09', '2026-11-10']) r = cumplir(r, dia);
check(C.rachaDiaria(r, '2026-11-11').dias === 2 && C.rachaDiaria(r, '2026-11-11').comodines === 1, 'cinco días en una semana dan un comodín (para la siguiente); sin él, un día sin cumplir rompe la racha');
r = cumplir(cumplir(r, '2026-11-11'), '2026-11-12');
check(C.rachaDiaria(r, '2026-11-14').dias === 4 && C.rachaDiaria(r, '2026-11-14').usados === 1 && C.rachaDiaria(r, '2026-11-14').comodines === 0, 'un día sin cumplir (el 13) se tapa solo con el comodín');
check(C.rachaDiaria(r, '2026-11-13').dias === 4 && !C.rachaDiaria(r, '2026-11-13').hoyHecho, 'hoy, si aún no lo ha cumplido, no rompe la racha');
check(C.rachaDiaria(cumplir(r, '2026-11-13'), '2026-11-13').dias === 5 && C.rachaDiaria(cumplir(r, '2026-11-13'), '2026-11-13').hoyHecho, 'y al cumplirlo hoy, suma');

// prueba de nivel
check(C.puedeHacerPrueba(null) && !C.puedeHacerPrueba(e), 'la prueba de nivel se ofrece al empezar (menos de cinco vistos)');
const pq = C.pruebaDeNivel(todos, '2026-11-13');
check(pq.length >= 4 && pq.length <= 8 && pq.every((q) => q.tipo === 'test' && q.tema && q.etiqueta === 'Prueba de nivel' && q.opciones.length >= 2) && new Set(pq.map((q) => q.tema)).size >= 2, `la prueba: preguntas de varios temas (${pq.length})`);
const resp = pq.map((q) => q.tema === 'programacion');
const tras = C.aplicarNivel(null, pq, resp, todos, '2026-11-13');
const deProg = todos.filter((a) => C.temaDe(a) === 'programacion' && ['idea', 'glosario'].includes(a.tipo));
check(tras.prueba.saltados.join() === 'programacion' && deProg.every((a) => tras.vistos[a.id]?.c === 2 && tras.vistos[a.id].p === '2026-11-20') && !todos.some((a) => C.temaDe(a) === 'tecnica' && tras.vistos[a.id]),
  'acertando todo Programación: lo básico de ese tema queda visto (vuelve en una semana); lo demás, no');
check(!C.puedeHacerPrueba(tras), 'y no se vuelve a ofrecer');

// ruta y certificado
const ruta = C.rutaFundamentos(todos);
check(ruta.length >= 1 && ruta.length <= 6, `la ruta: los cursos de las guías, de lo básico a lo demás (${ruta.map((m) => m.clave).join(', ')})`);
const orden = C.rutaFundamentos([{ id: 'i:mitos:0', tipo: 'mito', guia: 'mitos', titulo: 'a' }, { id: 'i:mitos:1', tipo: 'mito', guia: 'mitos', titulo: 'b' },
  { id: 'i:manual:0', tipo: 'idea', guia: 'manual', de: 'Manual', titulo: 'a' }, { id: 'i:manual:1', tipo: 'idea', guia: 'manual', de: 'Manual', titulo: 'b' }]);
check(orden.map((m) => m.clave).join() === 'manual,mitos', 'el manual va antes que los mitos');
let pr = C.progresoRuta(ruta, null);
check(pr.hechos === 0 && !pr.todo && pr.siguiente?.clave === ruta[0].clave, 'al principio, ningún módulo hecho; sigue el primero');
let hecho = null;
for (const m of ruta) for (const id of m.lecciones) hecho = apuntarVisto(hecho, id, '2026-11-12');
pr = C.progresoRuta(ruta, hecho);
check(pr.todo && pr.hechos === ruta.length && !pr.certificado, 'con todas las lecciones, la ruta hecha (falta el examen)');
const fin = C.examenFinal(ruta, todos, hecho, '2026-11-13');
check(fin && fin.length >= 4 && fin.every((q) => q.etiqueta === 'Examen final'), `el examen final (${fin?.length} preguntas)`);
check(!C.apuntarFinal(hecho, { dia: '2026-11-13', aciertos: 7, total: 10 }).certificado && C.apuntarFinal(hecho, { dia: '2026-11-13', aciertos: 8, total: 10 }).certificado?.aciertos === 8,
  'con el 80 %, el certificado; con menos, no');
const conCert = C.apuntarFinal(hecho, { dia: '2026-11-13', aciertos: 9, total: 10 });
check(C.apuntarFinal(conCert, { dia: '2026-11-14', aciertos: 8, total: 10 }).certificado.aciertos === 9 && C.progresoRuta(ruta, conCert).certificado.dia === '2026-11-13', 'se queda con la mejor nota');

// tu mes
const mes = C.tuMesApuntes(r, todos, '2026-11');
check(mes.dias === 9 && mes.apuntes === 27 && mes.rachaMax === 5 && mes.metaDias === 9 && mes.puntos === 9 * (15 + C.PREMIO_META), `tu mes: apuntes, días, racha, objetivo cumplido y puntos (${JSON.stringify({ d: mes.dias, a: mes.apuntes, r: mes.rachaMax, p: mes.puntos })})`);
const mesTema = C.tuMesApuntes(e, todos, '2026-11');
check(mesTema.temaFuerte?.tema === 'programacion' && C.tuMesApuntes(r, todos, '2026-10').dias === 0, 'el tema que más ha trabajado; otro mes, vacío');
check(limpiarVistos({ meta: 7, diario: { x: { n: 1 }, '2026-11-01': { n: 2, xp: 10 } }, prueba: { dia: 'mal' }, certificado: { dia: '2026-11-01', aciertos: 50, total: 10 } }).certificado.aciertos === 10
  && !limpiarVistos({ meta: 7 }).meta && Object.keys(limpiarVistos({ diario: { x: { n: 1 }, '2026-11-01': { n: 2, xp: 10 } } }).diario).join() === '2026-11-01', 'lo guardado se limpia (objetivo, días, prueba y certificado)');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
