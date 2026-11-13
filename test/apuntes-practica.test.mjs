// «Apuntes», tanda B: practicar (emparejar, ordenar, hueco, verdadero o falso, microlecciones), las tres explicaciones y
// las tres claves antes de un ejercicio nuevo. Lógica pura. Uso: node test/apuntes-practica.test.mjs
import * as P from '../web/src/logica/apuntes-practica.js';
import { apuntesDeGuias, apuntesDeGlosario, apuntarVisto, GLOSARIO } from '../web/src/logica/apuntes.js';
import { GUIAS_DEMO } from '../web/src/datos/semilla-guias.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const todos = [...apuntesDeGuias(GUIAS_DEMO), ...apuntesDeGlosario()];

// barajar: el mismo orden con la misma semilla, todos los elementos
const b1 = P.barajar([1, 2, 3, 4, 5, 6], 9), b2 = P.barajar([1, 2, 3, 4, 5, 6], 9);
check(b1.join() === b2.join() && [...b1].sort().join() === '1,2,3,4,5,6' && P.barajar([1, 2, 3, 4, 5, 6], 10).join() !== b1.join(), 'barajar: misma semilla, mismo orden; con otra, otro');
check(P.primeraFrase('Uno dos. Tres cuatro.') === 'Uno dos' && P.primeraFrase('a '.repeat(100), 40).endsWith('…') && P.primeraFrase('a '.repeat(100), 40).length <= 41, 'la primera frase, cortada en un espacio si es larga');

// emparejar
const v = apuntarVisto(apuntarVisto(null, 'g:tempo', '2026-11-10'), 'g:descarga', '2026-11-10');
const e = P.emparejarDe(v, 4);
check(e.tipo === 'emparejar' && e.efimero && e.pares.length === 4 && e.pares.some((p) => p.termino === 'Tempo') && e.pares.some((p) => p.termino === 'Descarga')
  && e.pares.every((p) => GLOSARIO.some(([t, x]) => t === p.termino && x.startsWith(p.definicion.replace(/…$/, '')))), 'emparejar: cuatro términos con su definición (los que ya ha visto, dentro)');
check(P.notaEmparejar(e.pares, 0, 20).bien && !P.notaEmparejar(e.pares, 1, 20).bien && !P.notaEmparejar(e.pares, 0, 50).bien && P.notaEmparejar(e.pares, 2, 30).fallos === 2, 'emparejar: bien si todas a la primera y a tiempo');

// ordenar
const ficha = { id: 'f1', nombre: 'Press banca', ficha: { pasos: ['Pies firmes.', 'Escápulas **juntas** y abajo.', 'Baja al esternón.', 'Empuja hacia arriba y atrás.'] } };
const o = P.ordenarDe(ficha, 'Press banca', 3);
check(o.tipo === 'ordenar' && o.pasos.length === 4 && o.pasos[1] === 'Escápulas juntas y abajo' && o.mezcla.length === 4 && !o.mezcla.every((x, i) => x === i) && /Press banca/.test(o.titulo), 'ordenar: los pasos de la ficha (sin marcas), mezclados (nunca ya en orden)');
check(P.ordenBueno([0, 1, 2, 3]) && !P.ordenBueno([1, 0, 2, 3]) && P.ordenarDe({ id: 'f2', ficha: { pasos: ['Uno.', 'Dos.'] } }) === null, 'ordenar: se comprueba el orden; con menos de tres pasos, no hay');

// hueco
let huecos = 0, bienHechos = 0;
for (let s = 1; s <= 12; s++) {
  const h = P.huecoDe(todos, s);
  if (!h) continue;
  huecos++;
  const palabra = h.opciones[h.correcta];
  if (h.tipo === 'test' && h.efimero && h.hueco && h.titulo.includes('_____') && h.titulo.replace('_____', palabra) === h.texto.replace(/\.$/, '') && new Set(h.opciones).size === 3) bienHechos++;
}
check(huecos >= 10 && bienHechos === huecos, `completar el hueco: una frase de una idea con la palabra tapada y tres opciones distintas (${bienHechos}/${huecos})`);

// verdadero o falso
const vf = P.vfDe(todos, 5);
check(vf.tipo === 'vf' && vf.frases.length === 5 && vf.frases.some((f) => f.verdadero) && vf.frases.some((f) => !f.verdadero) && vf.frases.every((f) => f.frase && f.porque), 'verdadero o falso: cinco frases, de las dos, cada una con su porqué');
check(vf.frases.filter((f) => !f.verdadero && /^No: /.test(f.porque)).every((f) => { const t = f.frase.split(':')[0]; return f.porque.startsWith(`No: ${t} es `); }), 'las falsas del glosario dicen qué es de verdad ese término');

// microlecciones
const c = P.calc1rmDe({ nombre: 'Sentadilla', ultima: '100 kg × 5 @8' });
check(c.kg === 100 && c.reps === 5 && P.calc1rmDe(null).kg === 60, 'tu 1RM: arranca con los números de este ejercicio (o 60 kg × 8)');
const cu = P.cuentas1rm({ kg: 100, reps: 5, rir: 2 });
check(cu.uno === 123.3 && cu.tabla.length === 4 && cu.tabla[0].kg > cu.tabla[3].kg, 'las cuentas: 100 kg × 5 con dos en recámara ≈ 123,3 kg; y lo que moverías a 3, 5, 8 y 12');
check(P.filaRirpe(2)[1] === 8 && P.filaRirpe(0)[1] === 10 && P.filaRirpe(9)[0] === 4, 'RIR ↔ RPE: RIR 2 = RPE 8');
const ps = P.practicasDe({ apuntes: todos, estado: v, ficha, ejercicio: { nombre: 'Press banca' }, semilla: 2 });
check(['emparejar', 'ordenar', 'test', 'vf', 'calc1rm', 'rirpe'].every((t) => ps.some((p) => p.tipo === t)) && ps.every((p) => p.efimero), 'los seis ejercicios, todos efímeros (no cuentan como vistos)');
check(P.elegirPractica(ps, 0) === ps[0] && P.elegirPractica(ps, ps.length + 1) === ps[1] && P.elegirPractica([], 3) === null, 'se van turnando');

// tres explicaciones
const rir = todos.find((a) => a.id === 'g:rir');
const n = P.nivelesDe(rir, todos);
check(n && n.facil === 'Repeticiones en recámara.' && n.normal === rir.texto, 'glosario: «Más fácil» es la primera frase');
check(P.masFacil('Haz tus series a RIR 2. Y descansa.') === 'Haz tus series a RIR (repeticiones en recámara) 2.', '«Más fácil»: las palabras técnicas, explicadas, y solo lo primero');
const idea = { id: 'i:x:0', tipo: 'idea', titulo: 'Para', texto: 'Para a RIR 2 casi siempre.' };
check(P.nivelesDe(idea, todos)?.fondo?.includes('RIR: Repeticiones en recámara'), '«A fondo»: lo que significan sus palabras técnicas');
check(P.nivelesDe({ tipo: 'test', texto: 'x' }) === null && P.nivelesDe({ tipo: 'mito', vuelta: true, texto: 'x' }) === null && P.nivelesDe({ tipo: 'idea', texto: 'Corto.' }, []) === null, 'sin niveles en preguntas, mitos o si no cambia nada');
const larga = apuntesDeGuias([{ clave: 'g', titulo: 'G', contenido: { ideas: [{ titulo: 'T', x: 'Una frase larga de verdad. '.repeat(25) }] } }])[0];
check(larga.textoLargo && P.nivelesDe(larga).fondo === larga.textoLargo.trim(), '«A fondo»: el texto entero si el apunte se recortó');

// antes de un ejercicio nuevo
check(P.tresClaves('1. Pies firmes.\n2. **Escápulas** juntas.\n3. Baja controlado.\n4. Empuja.').join('|') === 'Pies firmes|Escápulas juntas|Baja controlado', 'las tres claves: las tres primeras líneas, sin números ni marcas');
check(P.tresClaves('Pies firmes. Escápulas juntas. Baja controlado. Empuja.').length === 3 && P.tresClaves('').length === 0, 'en un párrafo, las tres primeras frases');

check(P.clavesDeFicha(ficha).join('|') === 'Pies firmes|Escápulas juntas y abajo|Baja al esternón' && P.clavesDeFicha(null).length === 0, 'o de la ficha de técnica: sus tres primeros pasos');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
