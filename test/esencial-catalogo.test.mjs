// FBE Esencial sin coach, tanda 3 (lógica pura): el catálogo de rutinas (las 63 plantillas de la base, con sus textos), la
// criba (quién necesita «Primeras 4 semanas») y el algoritmo que recomienda dos o tres (logica/esencial-catalogo.js).
import { RUTINAS, rutinaDe, GUSTOS, preguntasGustos, limpiarGustos, gustosCompletos, necesitaPrimeras, recomendar, catalogoPara, consejoCambio, nivelDe, textoMaterial,
  DE_TEMPORADA, SEMANAS_RUTINA, NOMBRE_NIVEL } from '../web/src/logica/esencial-catalogo.js';
import { plantillaEsencial } from '../web/src/logica/esencial-alta.js';
import { NOVATOS } from '../web/src/logica/esencial-semana.js';
import { NOMBRE_PRIMERAS_4 } from '../web/src/logica/esencial.js';
import { EXPERIENCIA, MATERIAL } from '../web/src/logica/cuestionario.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('El catálogo');
const nombres = RUTINAS.map((r) => r.nombre);
check(RUTINAS.length === 63 && new Set(nombres).size === 63 && new Set(RUTINAS.map((r) => r.imagen)).size === 63, 'las 63 rutinas de la base, cada una con su imagen');
check([NOMBRE_PRIMERAS_4, NOVATOS[2], NOVATOS[3]].every((n) => nombres.includes(n)), 'con las tres de FBE Esencial');
check(RUTINAS.filter((r) => r.opcion).length === 33 && ['A', 'B', 'C'].every((o) => RUTINAS.filter((r) => r.opcion === o).length === 11), '11 repartos con sus tres opciones (A, B y C)');
check(RUTINAS.every((r) => r.dias >= 2 && r.dias <= 6 && (r.familia === 'primeras' || r.familia === 'novato' || r.nombre.startsWith(`${r.dias} días · `))), 'los días de cada una son los de su nombre');
check(RUTINAS.every((r) => r.titulo && r.texto.length > 40 && r.texto.endsWith('.') && !/tu coach|\bPPL\b/.test(`${r.titulo} ${r.texto}`)), 'cada una, con su título y su texto en llano (sin «tu coach» ni «PPL» a secas)');
check(RUTINAS.filter((r) => /PHAT|PHUL|Density/.test(r.titulo)).every((r) => /\(.+\)/.test(r.titulo)), 'los nombres raros (PHAT, PHUL, Density) van explicados y entre paréntesis');
check(RUTINAS.every((r) => ['g', 'c'].includes(r.donde) && r.nivel >= 0 && r.nivel <= 4 && r.para.length > 0 && r.material.every((m) => MATERIAL.some(([k]) => k === m))), 'dónde se hace, desde qué nivel, para quién y un material que existe en el cuestionario');
check(RUTINAS.filter((r) => r.opcion === 'A').every((r) => r.material.includes('barra') && r.nivel >= 2) && RUTINAS.filter((r) => r.opcion === 'B').every((r) => !r.material.length), 'la opción A pide barra y al menos un año; la B, nada especial');
check(rutinaDe(NOVATOS[3])?.titulo === 'Novato, 3 días' && rutinaDe('no existe') === null && textoMaterial(rutinaDe('3 días · Full body con gomas')) === 'Gomas' && NOMBRE_NIVEL.length === 5, 'se busca por su nombre exacto');
// Las que elige hoy la app con el cuestionario (plantillaEsencial) están todas
const deHoy = new Set();
for (const [e] of EXPERIENCIA) for (const d of [2, 3, 4, 5, 6]) for (const lugar of ['gimnasio', 'casa']) for (const material of [[], ['barra'], ['gomas'], ['mancuernas', 'banco']]) deHoy.add(plantillaEsencial({ experiencia: e, dias_semana: d, lugar, material }));
check([...deHoy].every((n) => nombres.includes(n)), `las ${deHoy.size} que ya asignaba la app con el cuestionario están en el catálogo`);

console.log('\nTus gustos y la criba');
const c0 = { experiencia: 'ninguna', lugar: 'gimnasio' }, c2 = { experiencia: '1_3', lugar: 'gimnasio' }, casa = { experiencia: '1_3', lugar: 'casa' };
check(GUSTOS.length === 6 && preguntasGustos(c0).map((p) => p.id).join() === 'prioridad,otro,mayor' && preguntasGustos(c2).length === 6 && !preguntasGustos(casa).some((p) => p.id === 'barra'),
  'a quien nunca ha entrenado no se le pregunta por su técnica; en casa, tampoco por la barra');
check(JSON.stringify(limpiarGustos({ ahora: 'si', barra: 'quizá', prioridad: 'gluteo', otra: 1 }, c2)) === '{"ahora":"si","prioridad":"gluteo"}' && JSON.stringify(limpiarGustos({ ahora: 'si', prioridad: 'salud' }, c0)) === '{"prioridad":"salud"}',
  'solo se guarda lo que vale (y lo que se le pregunta)');
check(gustosCompletos({ prioridad: 'salud', otro: 'no', mayor: 'no' }, c0) && !gustosCompletos({ prioridad: 'salud' }, c0), 'completos cuando ha contestado todo lo suyo');
check(necesitaPrimeras({ experiencia: 'ninguna' }) && necesitaPrimeras({}) && necesitaPrimeras({ experiencia: 'menos_1', gustos: { ahora: 'parado', tecnica: 'si' } }) && necesitaPrimeras({ experiencia: 'menos_1', gustos: { ahora: 'si', tecnica: 'no' } }),
  '«Primeras 4 semanas»: quien nunca ha entrenado, y quien lleva menos de un año y está parado o no se maneja');
check(!necesitaPrimeras({ experiencia: 'menos_1', gustos: { ahora: 'si', tecnica: 'algunos' } }) && !necesitaPrimeras({ experiencia: '1_3', gustos: { ahora: 'parado', tecnica: 'no' } }) && !necesitaPrimeras({ experiencia: 'mas_5' }),
  'los demás no pasan por ellas: van directos a elegir (con un año o más, aunque vuelvan de un parón)');

console.log('\nEl algoritmo');
const rec = (c, g = {}, mas = {}) => recomendar({ cuestionario: c, gustos: g, ...mas });
const ns = (xs) => xs.map((x) => x.rutina.nombre);
const g0 = { ahora: 'si', tecnica: 'si', barra: 'no', prioridad: 'equilibrado', otro: 'no', mayor: 'no' };
let r = rec({ experiencia: '1_3', dias_semana: 4, lugar: 'gimnasio', material: ['barra', 'maquinas'] }, g0);
check(r.length === 3 && r[0].rutina.nombre === '4 días · Torso-pierna · B · Máquinas y mancuernas' && r.every((x) => x.rutina.dias === 4 && x.rutina.opcion === 'B' && x.porque.length >= 1 && x.nota === null),
  'un año o más, cuatro días y sin los básicos con barra: torso-pierna B la primera, y otras dos de cuatro días');
check(ns(rec({ experiencia: '1_3', dias_semana: 4, lugar: 'gimnasio', material: ['barra'] }, { ...g0, prioridad: 'gluteo' }))[0] === '4 días · Torso-pierna · C · Énfasis glúteo y pierna', 'con prioridad de glúteo y pierna: la opción C');
check(ns(rec({ experiencia: '3_5', dias_semana: 4, lugar: 'gimnasio', material: ['barra'] }, { ...g0, barra: 'si' }))[0] === '4 días · Torso-pierna · A · Barra y básicos', 'con tres años o más y los básicos dominados: la opción A');
r = rec({ experiencia: '1_3', dias_semana: 4, lugar: 'gimnasio', material: ['barra'] }, { ...g0, otro: 'correr' });
check(r[0].rutina.nombre === '3 días · Fuerza para corredores' && /quien corre/.test(r[0].porque[0]) && /tus días pasan a ser 3/.test(r[0].nota || ''), 'quien corre: la de corredores, la primera (y se le avisa de que es de tres días)');
check(ns(rec({ experiencia: 'menos_1', dias_semana: 2, lugar: 'gimnasio', material: [] }, { ...g0, otro: 'deporte' }))[0] === '2 días · Complemento a otro deporte (pádel, fútbol)', 'quien hace otro deporte, con dos días: su complemento');
check(ns(rec({ experiencia: 'menos_1', dias_semana: 3, lugar: 'gimnasio', material: [] }, { ...g0, mayor: 'si' }))[0] === '3 días · Salud y mayores de 60', 'con 60 años o más: «Salud y mayores de 60»');
check(ns(rec({ experiencia: '3_5', dias_semana: 3, lugar: 'gimnasio', material: ['barra'] }, { ...g0, barra: 'si', prioridad: 'fuerza' })).includes('3 días · Fuerza en básicos'), 'para subir marcas, con los básicos dominados: «Fuerza en básicos» entre las suyas');
r = rec({ experiencia: 'menos_1', dias_semana: 6, lugar: 'gimnasio', material: [] }, g0);
check(r.every((x) => x.rutina.dias <= 4 && x.rutina.nivel <= 1) && /mejor 4 días que 6/.test(r[0].porque.join(' ')) && /tus días pasan a ser 4/.test(r[0].nota || ''), 'con menos de un año no se le dan seis días: cuatro como mucho, y se le dice');
r = rec({ experiencia: '1_3', dias_semana: 3, lugar: 'casa', material: ['gomas'] }, g0);
check(r.length >= 2 && r[0].rutina.nombre === '3 días · Full body con gomas' && r.every((x) => x.rutina.donde === 'c' && x.rutina.material.every((m) => m === 'gomas')), 'en casa con gomas: la de gomas, y solo cosas que puede hacer con lo que tiene');
check(ns(rec({ experiencia: '1_3', dias_semana: 4, lugar: 'gimnasio', material: [] }, g0, { actual: '4 días · Torso-pierna · B · Máquinas y mancuernas' })).every((n) => n !== '4 días · Torso-pierna · B · Máquinas y mancuernas'), 'la que ya lleva no se le recomienda otra vez');
const pocas = [NOVATOS[2], NOVATOS[3], '3 días · Full body · B · Máquinas y mancuernas', '4 días · Torso-pierna · B · Máquinas y mancuernas'];
r = rec({ experiencia: '1_3', dias_semana: 5, lugar: 'gimnasio', material: [] }, g0, { disponibles: pocas });
check(r.length >= 2 && ns(r).every((n) => pocas.includes(n)), 'si Pelayo deja pocas en el catálogo, solo se recomiendan esas');

// Todas las combinaciones: siempre dos o tres, que existen, distintas y que puede hacer
let combos = 0, malas = [];
const materiales = { gimnasio: [[], ['barra', 'rack', 'maquinas']], casa: [[], ['gomas'], ['mancuernas', 'banco'], ['dominadas'], ['gomas', 'mancuernas', 'banco', 'dominadas']] };
for (const [e] of EXPERIENCIA) for (const d of [2, 3, 4, 5, 6]) for (const lugar of ['gimnasio', 'casa']) for (const material of materiales[lugar])
  for (const ahora of ['si', 'poco', 'parado']) for (const tecnica of ['si', 'algunos', 'no']) for (const barra of ['si', 'no'])
    for (const prioridad of ['equilibrado', 'gluteo', 'torso', 'fuerza', 'salud']) for (const otro of ['no', 'correr', 'deporte']) for (const mayor of ['no', 'si']) {
      combos++;
      const c = { experiencia: e, dias_semana: d, lugar, material }, g = { ahora, tecnica, barra, prioridad, otro, mayor };
      const x = recomendar({ cuestionario: c, gustos: g });
      const n = Math.max(1, nivelDe(e) - (ahora === 'parado' || tecnica === 'no' ? 1 : 0));
      const bien = x.length >= 2 && x.length <= 3 && new Set(x.map((y) => y.rutina.nombre)).size === x.length
        && x.every((y) => RUTINAS.includes(y.rutina) && y.rutina.familia !== 'primeras' && !DE_TEMPORADA.includes(y.rutina.familia) && y.porque.length >= 1 && y.porque.length <= 2
          && (lugar === 'gimnasio' ? y.rutina.donde === 'g' : y.rutina.donde === 'c') && y.rutina.nivel <= n
          && (lugar === 'gimnasio' || y.rutina.material.every((m) => material.includes(m)))
          && (!y.rutina.material.includes('barra') || (barra === 'si' && nivelDe(e) >= 2)));
      if (!bien && malas.length < 3) malas.push(`${JSON.stringify(c)} ${JSON.stringify(g)} → ${x.map((y) => y.rutina.nombre).join(' | ')}`);
      if (!bien) malas.total = (malas.total || 0) + 1;
    }
check(!malas.length, `las ${combos} combinaciones dan dos o tres rutinas distintas que existen y que puede hacer (su sitio, su material y su nivel)${malas.length ? `: ${malas.total} mal, p. ej. ${malas.join(' ;; ')}` : ''}`);

console.log('\nTodo el catálogo y cuánto mantenerla');
const cat = catalogoPara({ cuestionario: { experiencia: 'menos_1', lugar: 'casa', material: ['gomas'] }, gustos: g0 });
const av = (n) => cat.find((x) => x.rutina.nombre === n)?.aviso;
check(cat.length === 62 && !cat.some((x) => x.rutina.familia === 'primeras'), 'todas menos «Primeras 4 semanas» (a esa se llega por la criba)');
check(av('3 días · Full body con gomas') === null && /de gimnasio/.test(av('6 días · PPL ×2 · A · Barra y básicos')) && /Con tres años o más/.test(av('6 días · PPL ×2 · A · Barra y básicos'))
  && /Pide mancuernas y banco/.test(av('3 días · Full body con mancuernas y banco')) && /unas semanas/.test(av('4 días · Especialización de glúteo')), 'cada una con su aviso si no es para él (nivel, sitio, material o solo para unas semanas)');
check(catalogoPara({ cuestionario: { experiencia: '1_3', lugar: 'gimnasio' }, gustos: g0, disponibles: pocas }).length === 4, 'y solo las que Pelayo tiene en el catálogo');
check(SEMANAS_RUTINA === 12 && /al menos 12/.test(consejoCambio({ semanas: 3 })) && /una semana/.test(consejoCambio({ semanas: 1 })) && /ya puedes cambiar/.test(consejoCambio({ semanas: 12 }))
  && /descarga/.test(consejoCambio({ semanas: 5, estancado: true })) && /temporada/.test(consejoCambio({ temporada: true })), 'mantenerla al menos 12 semanas; antes, solo si se estanca (Pelayo, 25/11)');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
