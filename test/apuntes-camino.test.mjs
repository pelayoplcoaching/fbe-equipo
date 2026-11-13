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

// (tanda D) la liga y los duelos
let w = null;
for (const dia of ['2026-11-09', '2026-11-10']) for (let i = 0; i < 3; i++) w = C.sumarDiario(w, dia, 'sabia');
w = C.sumarDiario(w, '2026-11-08', 'visto');
check(JSON.stringify(C.puntosDeSemana(w, '2026-11-09')) === JSON.stringify({ puntos: 2 * (30 + C.PREMIO_META), apuntes: 6 }) && C.puntosDeSemana(w, '2026-11-02').apuntes === 1, 'los puntos de una semana (de lunes a domingo, con el premio de cada día cumplido)');
const d1 = C.dueloDe(42), d2 = C.dueloDe(42);
check(d1.length === 5 && JSON.stringify(d1) === JSON.stringify(d2) && JSON.stringify(C.dueloDe(43)) !== JSON.stringify(d1) && d1.every((q) => q.efimero && q.opciones.length === 3 && q.opciones[q.correcta] && /^¿Qué es «/.test(q.titulo)) && new Set(d1.map((q) => q.titulo)).size === 5,
  'un duelo: cinco preguntas del glosario, las mismas para los dos (de la semilla)');
check(C.estadoDuelo({ mios: null, acabado: false, soy_retador: false, rival_nombre: 'Bea' }).estado === 'jugar' && C.estadoDuelo({ mios: 3, suyos: null, acabado: false, rival_nombre: 'Bea' }).texto === 'Esperando a Bea (tú, 3 de 5)'
  && C.estadoDuelo({ mios: 4, suyos: 2, acabado: true, rival_nombre: 'Bea' }).texto === 'Ganaste con Bea: 4–2' && C.estadoDuelo({ mios: 2, suyos: 2, acabado: true, rival_nombre: 'Bea' }).estado === 'empate'
  && C.estadoDuelo({ mios: null, acabado: true, rival_nombre: 'Bea' }).estado === 'caducado', 'cómo va un duelo, en palabras');
// historias
const h = C.historiaDeNovedad({ titulo: 'Descansa más', etiqueta: 'Novedad de la semana', texto: 'Uno. Dos dos. '.repeat(20), fuente: 'Autor, 2026', enlace: 'https://x.org' });
check(h[0].clase === 'portada' && h[0].titulo === 'Descansa más' && h.filter((d) => d.clase === 'texto').length <= 4 && h.at(-1).clase === 'fuente' && h.at(-1).enlace === 'https://x.org', 'una novedad como historia: portada, su texto en diapositivas y de dónde sale');
const hl = C.historiaDeLecciones(todos.filter((a) => a.tipo === 'mito').slice(0, 3), 'Mitos');
check(hl.length === 4 && hl[0].texto === '3 lecciones' && hl.slice(1).every((d) => d.id && d.titulo), 'unas lecciones como historia: una diapositiva por lección');
// notas y subrayados
let n = C.ponerNota(null, 'g:rir', '  Parar con dos en recámara  ');
check(n.notas['g:rir'] === 'Parar con dos en recámara' && n.guardados.includes('g:rir'), 'tu nota se guarda (y el apunte pasa a «Guardados»)');
n = C.ponerNota(n, 'g:rir', '');
check(!n.notas && n.guardados.includes('g:rir'), 'vacía, la nota se quita');
n = C.alternarSubrayado(C.alternarSubrayado(null, 'g:rpe', 1), 'g:rpe', 0);
check(JSON.stringify(n.subrayados['g:rpe']) === '[0,1]' && n.guardados.includes('g:rpe') && !C.alternarSubrayado(n, 'g:rpe', 0).subrayados['g:rpe'].includes(0), 'subrayar una frase y quitarla');
check(C.frasesDe('Uno dos. ¿Tres? Cuatro!').length === 3, 'las frases de un texto');
// el dominio del equipo
const de = C.dominioEquipo([{ apunte: 'g:rir', atletas: 4, caja_media: 3, dominan: 3 }, { apunte: 'g:rpe', atletas: 2, caja_media: 1, dominan: 0 }, { apunte: 'i:pectoral:0', atletas: 3, caja_media: 0.5, dominan: 0 }, { apunte: 'i:pectoral:1', atletas: 1, caja_media: 1, dominan: 0 }, { apunte: 'z:raro', atletas: 9, caja_media: 5, dominan: 9 }], todos);
const pg = de.temas.find((t) => t.tema === 'programacion'), tc = de.temas.find((t) => t.tema === 'tecnica');
check(pg.apuntes === 2 && pg.vistas === 6 && pg.cajaMedia === 2.3 && pg.pctDominio === 50 && tc.cajaMedia === 0.6 && de.flojo.tema === 'tecnica' && !de.temas.some((t) => t.vistas >= 9),
  'el equipo por temas: vistas, caja media y dominio; lo más flojo, para publicar después (lo que no se sabe nombrar, fuera)');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
