// «Aprende» (migración 057): las guías del coach y la ficha de técnica de cada ejercicio. La lógica pura (logica/guias.js),
// la migración en un Postgres local (PGlite): quién ve y escribe qué, y lo mismo en la demo (backend en memoria).
// Uso: node test/guias.test.mjs
import { porEstantes, estanteDe, indiceDeGuia, buscarEnGuias, mitosDeGuia, mitoDeLaSemana, numeroDeSemana, OCASIONES, ocasionesDeCheckin } from '../web/src/logica/guias.js';
import { trozos, sinMarcas, bloquesDe, guiaParaLeer, fichaParaLeer, fichaConContenido, ordenarGuias, buscarFichas, guiaDeGrupo, cuantosEjercicios, fichasParecidas,
  erroresDeFicha, frasesDeFicha, resumenTabla, avisosMolestia, tipoDeRutina } from '../web/src/logica/guias.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('La lógica pura');
check(igual(trozos('Los **codos** a 45'), [{ t: 'Los ' }, { t: 'codos', n: true }, { t: ' a 45' }]) && igual(trozos('**Todo**'), [{ t: 'Todo', n: true }]) && igual(trozos('sin marca'), [{ t: 'sin marca' }])
  && igual(trozos(''), []) && igual(trozos(null), []), 'el texto se trocea por su negrita');
check(igual(trozos('una **marca sin cerrar'), [{ t: 'una marca sin cerrar' }]) && sinMarcas('a **b** c') === 'a b c' && igual(trozos('<b>x</b>'), [{ t: '<b>x</b>' }]), 'una marca sin cerrar no pone negrita ni deja asteriscos; el HTML es solo texto');
const bs = bloquesDe([{ t: 'p', x: ' Hola ' }, { t: 'p', x: '' }, { t: 'script', x: 'x' }, { t: 'ul', xs: ['a', '', 7] }, { t: 'ol', xs: [] }, { t: 'h', x: 'Título' },
  { t: 'caja', tono: 'raro', titulo: 'T', bloques: [{ t: 'p', x: 'dentro' }, { t: 'caja', titulo: 'otra', bloques: [] }] }, { t: 'caja', bloques: [] }, null, 'x']);
check(igual(bs, [{ t: 'p', x: 'Hola' }, { t: 'ul', xs: ['a'] }, { t: 'h', x: 'Título' }, { t: 'caja', tono: 'nota', titulo: 'T', bloques: [{ t: 'p', x: 'dentro' }] }]), 'los bloques: solo los tipos conocidos y con algo dentro; las cajas no se anidan');
const fichas = [{ id: 'f2', orden: 2, nombre: 'Press inclinado', ficha: { cabecera: 'PRESS INCLINADO', patron: 'Empuje inclinado' }, guia_titulo: 'Pectoral' },
  { id: 'f1', orden: 1, nombre: 'Press de banca con barra', ficha: { principales: 'Pectoral mayor' }, guia_titulo: 'Pectoral' }, { id: 'f3', orden: 3, nombre: 'Fondos', ficha: {}, guia_titulo: 'Pectoral' }];
const g = guiaParaLeer({ contenido: { entrada: ' Una entrada ', cita: 'Una cita', secciones: [{ titulo: 'Uno', bloques: [{ t: 'p', x: 'a' }] }, { titulo: 'Ejercicios', subtitulo: 'Los que hay', bloques: [], fichas: [1, 2, 99] }, { bloques: [] }],
  ideas: [{ titulo: 'Idea', x: 'texto' }, {}] } }, fichas);
check(g.entrada === 'Una entrada' && g.cita === 'Una cita' && g.secciones.length === 2 && g.secciones[1].fichas.map((f) => f.id).join() === 'f1,f2' && g.sueltas.map((f) => f.id).join() === 'f3' && g.ideas.length === 1,
  'una guía para leer: sus secciones con sus fichas en orden, las fichas sueltas al final y las ideas clave');
check(guiaParaLeer(null).secciones.length === 0 && guiaParaLeer({ contenido: 'x' }, null).sueltas.length === 0, 'sin contenido (o con uno raro), una guía vacía y nada se rompe');
const f = fichaParaLeer({ ficha: { descripcion: 'd', pasos: ['uno', '', 'dos'], errores: 'x', niveles: { avanzado: 'a', principiante: 'p', otro: 'o' }, si: 's', tabla: [{ objetivo: 'Fuerza', reps: '3-6' }, { reps: '9' }] } });
check(f.pasos.length === 2 && f.errores.length === 0 && f.niveles.map((n) => n.nivel).join() === 'principiante,avanzado' && f.si === 's' && f.no === '' && f.tabla.length === 1 && f.tabla[0].rpe === '', 'la ficha, limpia: lo que falta, vacío; los niveles en su orden');
check(fichaConContenido({ ficha: { pasos: ['x'] } }) && !fichaConContenido({ ficha: { cabecera: 'solo esto' } }) && !fichaConContenido(null), 'una ficha tiene contenido si hay algo que enseñar');
check(buscarFichas(fichas, 'PRESS inclinádo')[0].id === 'f2' && buscarFichas(fichas, 'pectoral mayor')[0].id === 'f1' && buscarFichas(fichas, 'pectoral').length === 3 && buscarFichas(fichas, 'zzz').length === 0 && buscarFichas(fichas, ' ').length === 3,
  'buscar ejercicios: sin tildes, todas las palabras, en el nombre, el patrón, los músculos o la guía');
const gs = [{ clave: 'b', titulo: 'B', orden: 2, grupo: 'pectoral' }, { clave: 'a', titulo: 'A', orden: 1, grupo: null }, { clave: 'c', titulo: 'C', orden: 2, grupo: 'pectoral' }];
check(ordenarGuias(gs).map((x) => x.clave).join('') === 'abc' && guiaDeGrupo(gs, 'pectoral').clave === 'b' && guiaDeGrupo(gs, 'gemelo') === null && cuantosEjercicios(1) === '1 ejercicio' && cuantosEjercicios(9) === '9 ejercicios',
  'las guías en su orden y la de cada grupo muscular');
check(fichasParecidas(fichas, 'Press banca')[0].id === 'f1' && fichasParecidas(fichas, 'Press inclinado con mancuernas')[0].id === 'f2' && fichasParecidas(fichas, '').length === 3, 'para enlazar un ejercicio, las fichas que más se parecen a su nombre van primero');

// Las tablas, los errores típicos, la ayuda al programar y el tipo de rutina
const tb = bloquesDe([{ t: 'tabla', cab: ['Día', 'Sesión'], filas: [['Lunes', 'Torso', 'sobra'], ['Martes'], [], 'x'] }, { t: 'tabla', cab: ['Sola'], filas: [['a']] }, { t: 'tabla', cab: ['A', 'B'], filas: [] }]);
check(igual(tb, [{ t: 'tabla', cab: ['Día', 'Sesión'], filas: [['Lunes', 'Torso'], ['Martes', '']] }]), 'una tabla: todas las filas con las columnas de la cabecera; sin filas o con una sola columna, no se pinta');
check(guiaParaLeer({ contenido: { secciones: [{ clave: 'ppl-6', titulo: 'PPL', bloques: [] }] } }).secciones[0].clave === 'ppl-6', 'cada sección conserva su clave (para abrirla sola)');
const fe = { ficha: { errores: ['**Codos abiertos a 90º del torso**: el error más frecuente.', '**Rebotar** la barra en el pecho.', 'Sin negrita: algo más', ''], no: 'Patología activa de hombro (impingement) o dolor lumbar agudo.',
  tabla: [{ objetivo: 'Fuerza', reps: '3-6' }, { objetivo: 'Hipertrofia', reps: '6-12' }, { objetivo: 'Sin reps' }] } };
const ee = erroresDeFicha(fe);
check(ee.length === 3 && ee[0].titulo === 'Codos abiertos a 90º del torso' && ee[0].x === 'el error más frecuente.' && !ee[0].seguido && ee[1].titulo === 'Rebotar' && ee[1].x === 'la barra en el pecho.' && ee[1].seguido && ee[2].titulo === 'Sin negrita' && erroresDeFicha(null).length === 0, 'los errores típicos: su título (lo que va en negrita) y el resto');
check(igual(frasesDeFicha(fe, ['CODOS abiertos a 90º del torso']), ['Rebotar', 'Sin negrita']) && frasesDeFicha({ ficha: { errores: [`**${'x'.repeat(200)}**: y`] } })[0].length === 140, 'como frases de corrección: sin las que el coach ya tiene y de 140 letras como mucho');
check(resumenTabla(fe) === 'Fuerza 3-6 · Hipertrofia 6-12' && resumenTabla({}) === '', 'la tabla de la ficha, en una línea');
const av = avisosMolestia(fe, [{ zona: 'hombros', intensidad: 1 }, { zona: 'hombros', intensidad: 2 }, { zona: 'cuadriceps', intensidad: 3 }, { zona: 'zona_lumbar', intensidad: 0 }, { zona: 'otra', intensidad: 3 }]);
check(igual(av, [{ zona: 'hombros', intensidad: 2 }]) && avisosMolestia(fe, [{ zona: 'zona_lumbar', intensidad: 1 }])[0].zona === 'zona_lumbar' && avisosMolestia({ ficha: {} }, [{ zona: 'hombros', intensidad: 3 }]).length === 0 && avisosMolestia(fe, null).length === 0,
  'el aviso al programar: solo las molestias (de intensidad 1 o más) que la ficha nombra en su «no lo prescribo cuando», con la peor intensidad');
const ses = (...ns) => ns.map((n) => (n.endsWith('(c)') ? { nombre: n, tipo: 'cardio' } : { nombre: n }));
check(tipoDeRutina(ses('Full body A', 'Full Body B'))?.clave === 'full-body-2' && tipoDeRutina(ses('Cuerpo entero 1', 'Cuerpo completo 2', 'FB C'))?.clave === 'full-body-3'
  && tipoDeRutina(ses('Torso A', 'Pierna A', 'Torso B', 'Pierna B'))?.clave === 'upper-lower-4' && tipoDeRutina(ses('Upper', 'Lower', 'Push', 'Pull', 'Legs'))?.clave === 'hibrida-5'
  && tipoDeRutina(ses('Push', 'Pull', 'Legs', 'Empuje 2', 'Tracción 2', 'Pierna 2'))?.clave === 'ppl-6' && tipoDeRutina(ses('Full body A', 'Full body B', 'Rodaje suave(c)'))?.clave === 'con-cardio',
  'el tipo de rutina, por los nombres de las sesiones de la semana');
check(tipoDeRutina(ses('Torso A', 'Pierna A', 'Torso B')) === null && tipoDeRutina(ses('Día 1', 'Día 2', 'Día 3')) === null && tipoDeRutina(ses('Full body')) === null && tipoDeRutina([]) === null && tipoDeRutina(null) === null,
  'si no se reconoce, no se supone nada');

console.log('\nLa migración 057 (PGlite)');
const { PGlite } = await import('@electric-sql/pglite');
const { aplicarEsquema } = await import('./esquema.mjs');
const db = new PGlite();
await aplicarEsquema(db, { repetirMigraciones: true });
check(true, 'esquema y migraciones aplicados, también al repetirlas');
const claims = (uid, aal) => `select set_config('request.jwt.claim.sub', '${uid}', false); select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, aal }) : ''}', false);`;
const su = async () => db.exec(`reset role; ${claims('', '')}`);
const como = async (uid, aal = 'aal1') => db.exec(`reset role; ${claims(uid, aal)} set role authenticated;`);
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const falla = async (sql, params = []) => { try { await db.query(sql, params); return false; } catch { return true; } };
const usuario = async (email) => { await su(); return (await q('insert into auth.users (email) values ($1) returning id', [email]))[0].id; };
const coach = await usuario('coach@x.test');
await q(`update public.perfiles set rol = 'coach', nombre = 'Coach' where id = $1`, [coach]);
const ana = await usuario('a@x.test');
await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo')`, [ana]);
const suelto = await usuario('c@x.test');
const [ej] = await q(`insert into ejercicios (nombre, grupos_musculares) values ('Press banca', '{pectoral}') returning id`);
const [ej2] = await q(`insert into ejercicios (nombre, grupos_musculares) values ('Sentadilla', '{cuadriceps}') returning id`);

await como(coach, 'aal2');
const [g1] = await q(`insert into guias (clave, titulo, subtitulo, grupo, orden, contenido) values ('pectoral', 'Pectoral', 'Empuje', 'pectoral', 1, '{"entrada":"e","secciones":[]}') returning id, publicada`);
const [g2] = await q(`insert into guias (clave, titulo, publicada) values ('borrador', 'En borrador', false) returning id`);
const [f1] = await q(`insert into fichas_ejercicio (guia_id, orden, nombre, ficha) values ($1, 1, 'Press de banca', '{"pasos":["uno"]}') returning id`, [g1.id]);
const [f2] = await q(`insert into fichas_ejercicio (guia_id, orden, nombre) values ($1, 1, 'Oculta') returning id`, [g2.id]);
await q(`insert into ejercicios_fichas (ejercicio_id, ficha_id) values ($1, $2), ($3, $4)`, [ej.id, f1.id, ej2.id, f2.id]);
check(g1.publicada === true, 'el coach crea guías (publicadas de serie), fichas y enlaces');
check(await falla(`insert into guias (clave, titulo) values ('pectoral', 'Otra')`) && await falla(`insert into guias (clave, titulo) values ('Con Mayúsculas', 'X')`) && await falla(`insert into guias (clave, titulo) values ('x', '')`)
  && await falla(`insert into guias (clave, titulo, grupo) values ('y', 'Y', 'cuello')`) && await falla(`insert into guias (clave, titulo, contenido) values ('z', 'Z', '[]')`)
  && await falla(`insert into fichas_ejercicio (guia_id, orden, nombre) values ($1, 1, 'Repetida')`, [g1.id]) && await falla(`insert into fichas_ejercicio (guia_id, orden, nombre, ficha) values ($1, 5, 'X', '"texto"')`, [g1.id])
  && await falla(`insert into ejercicios_fichas (ejercicio_id, ficha_id) values ($1, $2)`, [ej.id, f2.id]),
  'con sentido: una guía por clave (en minúsculas), con título, grupo conocido y contenido de objeto; una ficha por orden; una ficha por ejercicio');
const antes = (await q(`select actualizada_en from guias where id = $1`, [g1.id]))[0].actualizada_en;
await q(`update guias set titulo = 'Pectoral', actualizada_en = '2000-01-01' where id = $1`, [g1.id]);
check(new Date((await q(`select actualizada_en from guias where id = $1`, [g1.id]))[0].actualizada_en) >= new Date(antes), 'la fecha del último cambio la pone la base');

await como(ana);
check((await q(`select clave from guias`)).map((x) => x.clave).join() === 'pectoral' && (await q(`select nombre from fichas_ejercicio`)).map((x) => x.nombre).join() === 'Press de banca'
  && (await q(`select ejercicio_id from ejercicios_fichas`)).map((x) => x.ejercicio_id).join() === ej.id, 'el atleta ve las guías publicadas, sus fichas y sus enlaces; lo de una guía sin publicar, no');
check(await falla(`insert into guias (clave, titulo) values ('mia', 'Mía')`) && (await q(`update guias set titulo = 'Cambiada' returning id`)).length === 0 && (await q(`delete from guias returning id`)).length === 0
  && await falla(`insert into fichas_ejercicio (guia_id, orden, nombre) values ($1, 9, 'Mía')`, [g1.id]) && (await q(`update fichas_ejercicio set nombre = 'x' returning id`)).length === 0
  && await falla(`insert into ejercicios_fichas (ejercicio_id, ficha_id) values ($1, $2)`, [ej2.id, f1.id]) && (await q(`delete from ejercicios_fichas returning ejercicio_id`)).length === 0,
  'y no escribe nada: ni guías, ni fichas, ni enlaces');
await como(suelto);
check((await q(`select count(*)::int n from guias`))[0].n === 0 && (await q(`select count(*)::int n from fichas_ejercicio`))[0].n === 0 && (await q(`select count(*)::int n from ejercicios_fichas`))[0].n === 0, 'una cuenta sin ficha de atleta no ve nada');
await db.exec(`reset role; ${claims('', '')} set role anon;`);
check(await falla(`select count(*) from guias`) || (await q(`select count(*)::int n from guias`))[0].n === 0, 'ni nadie sin entrar');
await como(coach, 'aal2');
await q(`update guias set publicada = false where id = $1`, [g1.id]);
await como(ana);
check((await q(`select count(*)::int n from guias`))[0].n === 0 && (await q(`select count(*)::int n from fichas_ejercicio`))[0].n === 0 && (await q(`select count(*)::int n from ejercicios_fichas`))[0].n === 0, 'al esconder una guía, sus fichas dejan de verse también en los ejercicios');
await como(coach, 'aal2');
await q(`delete from ejercicios where id = $1`, [ej2.id]);
check((await q(`select count(*)::int n from ejercicios_fichas`))[0].n === 1, 'al borrar un ejercicio, su enlace se va');
await q(`delete from guias where id = $1`, [g1.id]);
check((await q(`select count(*)::int n from fichas_ejercicio where guia_id = $1`, [g1.id]))[0].n === 0 && (await q(`select count(*)::int n from ejercicios_fichas`))[0].n === 0 && (await q(`select count(*)::int n from ejercicios where id = $1`, [ej.id]))[0].n === 1,
  'al borrar una guía se van sus fichas y sus enlaces; el ejercicio se queda');
await db.close();

// ------------------------------------------------------------ la filosofía: estanterías, buscar en el texto, mitos y guías a cuento
console.log('\nEstanterías, buscar dentro de las guías, el mito de la semana y la guía que viene a cuento');
check(bloquesDe([{ t: 'cita', x: ' Una **cita** ' }, { t: 'cita', x: '' }, { t: 'caja', bloques: [{ t: 'cita', x: 'dentro' }] }]).map((x) => x.t === 'caja' ? `caja:${x.bloques[0].t}` : `${x.t}:${x.x}`).join('|') === 'cita:Una **cita**|caja:cita',
  'una cita es un bloque más (también dentro de una caja); vacía, no sale');
const varias = [{ clave: 'manual', orden: 101 }, { clave: 'bienvenida', orden: 100 }, { clave: 'pectoral', grupo: 'pectoral', orden: 5, fichas: 9 }, { clave: 'antebrazo', grupo: null, orden: 11, fichas: 3 },
  { clave: 'rutinas', orden: 0 }, { clave: 'mitos', orden: 143 }, { clave: 'una-nueva', orden: 7 }, { clave: 'sueno', orden: 130 }, { clave: 'composicion', orden: 121 }];
check(porEstantes(varias).map((e) => `${e.id}:${e.guias.map((x) => x.clave).join('+')}`).join(' ') === 'empieza:bienvenida+manual entrenar:rutinas musculos:pectoral+antebrazo comer:composicion cabeza:sueno salud:mitos mas:una-nueva'
  && estanteDe({ clave: 'x', grupo: 'gluteo' }) === 'musculos' && estanteDe({ clave: 'x' }) === 'mas' && estanteDe(null) === 'mas' && porEstantes([]).length === 0,
  'cada guía va a su estantería (por su clave, por llevar fichas o grupo, o a «Más guías»), en orden y sin estanterías vacías');
const conTexto = [
  { id: 'a', clave: 'sueno', titulo: 'Dormir mejor', subtitulo: 's', orden: 2, contenido: { secciones: [
    { titulo: 'Hábitos', subtitulo: 'Lo sencillo', bloques: [{ t: 'ul', xs: ['**Horario regular**.', 'La **cafeína**, por la mañana: después de comer ya estorba y además tarda horas en irse del cuerpo, así que conviene no tomarla por la tarde.'] }] },
    { titulo: 'Cuándo consultar', bloques: [{ t: 'caja', titulo: 'Ronquidos', bloques: [{ t: 'p', x: 'Si roncas mucho, consulta.' }] }, { t: 'tabla', cab: ['Edad', 'Horas'], filas: [['Adultos', '7 a 9']] }] }],
    ideas: [{ titulo: 'Regularidad', x: 'El horario manda.' }] } },
  { id: 'b', clave: 'cafe', titulo: 'La cafeína', orden: 1, contenido: { secciones: [{ titulo: 'Dosis', bloques: [{ t: 'p', x: 'Con poco basta.' }] }] } },
];
const idx = indiceDeGuia(conTexto[0]);
check(idx.length === 3 && idx[0].parrafos[0] === 'Lo sencillo' && idx[0].parrafos[1] === 'Horario regular.' && idx[1].parrafos.join('|') === 'Ronquidos|Si roncas mucho, consulta.|Edad · Horas|Adultos · 7 a 9' && idx[2].i === -1 && idx[2].parrafos[0] === 'Regularidad. El horario manda.',
  'de una guía se busca en sus secciones (subtítulo, párrafos, listas, cajas y tablas, sin las marcas de negrita) y en sus ideas clave');
const h = buscarEnGuias(conTexto, 'CAFEINA');
check(h.length === 2 && h[0].guia.clave === 'cafe' && h[0].enTitulo && h[0].seccion === 0 && h[1].guia.clave === 'sueno' && h[1].titulo === 'Hábitos' && h[1].hallado === 'cafeína' && h[1].antes === 'La ' && h[1].despues.endsWith('…') && h[1].despues.length < 100,
  'buscar no mira tildes ni mayúsculas; lo hallado en el título va primero y cada resultado trae el trozo de alrededor');
check(buscarEnGuias(conTexto, 'horario ronc').length === 0 && buscarEnGuias(conTexto, 'roncas consulta')[0].seccion === 1 && buscarEnGuias(conTexto, 'adultos')[0].hallado === 'Adultos' && buscarEnGuias(conTexto, 'regularidad')[0].seccion === -1
  && buscarEnGuias(conTexto, ' ').length === 0 && buscarEnGuias(conTexto, 'a').length === 0 && buscarEnGuias([], 'x y').length === 0 && buscarEnGuias(conTexto, 'cafeína', 1).length === 1,
  'todas las palabras tienen que estar en la misma sección; sin palabras (o de una letra) no se busca; hay un tope de resultados');
const guiaMitos = { contenido: { secciones: [
  { titulo: 'Comer', bloques: [{ t: 'p', x: 'Antes' }, { t: 'caja', titulo: 'MITO 2 · "Cenar tarde engorda"', bloques: [{ t: 'p', x: 'No.' }] }, { t: 'caja', titulo: 'Una caja cualquiera', bloques: [{ t: 'p', x: 'x' }] }] },
  { titulo: 'Entrenar', bloques: [{ t: 'caja', titulo: 'MITO 1 · “Sin agujetas no vale”', bloques: [{ t: 'p', x: 'Tampoco.' }, { t: 'ul', xs: ['a'] }] }, { t: 'caja', titulo: 'MITO 3 · "Vacío"', bloques: [] }] }] } };
const ms = mitosDeGuia(guiaMitos);
check(ms.map((x) => `${x.n}:${x.mito}:${x.tema}:${x.bloques.length}`).join('|') === '1:Sin agujetas no vale:Entrenar:2|2:Cenar tarde engorda:Comer:1' && mitosDeGuia(null).length === 0 && mitosDeGuia({ contenido: {} }).length === 0,
  'los mitos salen de las cajas «MITO n · "…"» de la guía, en su orden, con su tema y sin comillas; los vacíos no cuentan');
check(numeroDeSemana('2026-11-09') === numeroDeSemana('2026-11-15') && numeroDeSemana('2026-11-16') === numeroDeSemana('2026-11-09') + 1 && numeroDeSemana('2026-11-08') === numeroDeSemana('2026-11-09') - 1 && numeroDeSemana('') === 0
  && mitoDeLaSemana(ms, '2026-11-11') === mitoDeLaSemana(ms, '2026-11-15') && mitoDeLaSemana(ms, '2026-11-11') !== mitoDeLaSemana(ms, '2026-11-18') && mitoDeLaSemana(ms, '2026-11-11') === mitoDeLaSemana(ms, '2026-11-25') && mitoDeLaSemana([], '2026-11-11') === null,
  'el mito es el mismo de lunes a domingo, cambia cada lunes y va rotando');
check(ocasionesDeCheckin({ horas_sueno: '<5', motivacion: 1 }).join() === 'sueno,motivacion' && ocasionesDeCheckin({ horas_sueno: '5-6', motivacion: 3 }).join() === 'sueno' && ocasionesDeCheckin({ horas_sueno: '6-7', motivacion: 2 }).join() === 'motivacion'
  && ocasionesDeCheckin({ horas_sueno: '7-8', motivacion: 5 }).length === 0 && ocasionesDeCheckin({}).length === 0 && ocasionesDeCheckin(null).length === 0,
  'tras el check-in, con poco sueño o pocas ganas, viene a cuento su guía; sin contestar, ninguna');
check(Object.values(OCASIONES).every((o) => o.clave && o.seccion && o.cuando && o.titulo && o.detalle) && ['descarga', 'sueno', 'motivacion', 'vuelta', 'perder', 'mantener', 'ganar', 'cardio'].every((k) => OCASIONES[k]), 'cada ocasión lleva su guía, su sección y sus textos');

console.log('\nEn la demo (backend en memoria)');
const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
const { crearApi } = await import('../web/src/datos/api.js');
const G = await import('../web/src/datos/guias.js');
const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
const api = crearApi(b);
const lanza = async (fn) => { try { await fn(); return false; } catch { return true; } };
await b.auth.entrar('ana@fbe.demo', 'demo');
const lista = await G.listaGuias({ backend: b });
check(await G.hayGuias({ backend: b }) && lista.map((x) => `${x.clave}:${x.fichas}`).join() === 'rutinas:0,pectoral:2,cuadriceps:1,manual:0,deload:0,volver:0,cardio:0,composicion:0,sueno:0,motivacion:0,mitos:0' && !('contenido' in lista[0]), 'Ana ve las guías de la demo, con cuántos ejercicios tiene cada una (sin bajar su contenido)');
const entera = await G.guiaEntera({ backend: b }, 'pectoral');
const leer = guiaParaLeer(entera.guia, entera.fichas);
check(leer.secciones.length === 3 && leer.secciones[2].fichas.length === 2 && leer.ideas.length === 2 && leer.sueltas.length === 0 && await G.guiaEntera({ backend: b }, 'no-existe') === null, 'una guía entera, lista para leer');
const ejs = await b.select('ejercicios', {});
const banca = ejs.find((e) => e.nombre === 'Press banca');
const fb = await G.fichaDeEjercicio({ backend: b }, banca.id);
const sinFicha = ejs.find((e) => e.nombre === 'Remo con barra');
check(fb.ficha.nombre === 'Press de banca con barra' && fb.guia.clave === 'pectoral' && fichaConContenido(fb.ficha) && await G.fichaDeEjercicio({ backend: b }, sinFicha.id) === null && await G.fichaDeEjercicio({ backend: b }, null) === null,
  'el ejercicio enlazado trae su ficha y su guía; el que no, nada');
const rut = await G.guiaEntera({ backend: b }, 'rutinas');
check(guiaParaLeer(rut.guia, rut.fichas).secciones.find((x) => x.clave === 'upper-lower-4').bloques.some((x) => x.t === 'tabla'), 'la guía de rutinas trae cada distribución en su sección, con su tabla');
check((await G.todasLasFichas({ backend: b })).length === 3 && (await G.todasLasFichas({ backend: b }, { conFicha: true }))[0].ficha.pasos.length === 5, 'todas las fichas, ligeras o con su contenido');
check(await lanza(() => G.enlazarFicha({ backend: b }, sinFicha.id, fb.ficha.id)) || (await G.fichaDeEjercicio({ backend: b }, sinFicha.id)) === null, 'el atleta no enlaza fichas');
check((await G.publicarGuia({ backend: b }, entera.guia.id, false)) === undefined && (await G.listaGuias({ backend: b })).length === 11, 'ni esconde guías');
await b.auth.salir();
await b.auth.entrar('pelayo@fbe.demo', 'demo');
const enl = await G.enlacesFichas({ backend: b });
check(Object.keys(enl).length === 3 && enl[banca.id] === fb.ficha.id, 'el coach ve qué ficha lleva cada ejercicio');
await G.enlazarFicha({ backend: b }, sinFicha.id, fb.ficha.id);
await G.enlazarFicha({ backend: b }, banca.id, null);
const enl2 = await G.enlacesFichas({ backend: b });
check(enl2[sinFicha.id] === fb.ficha.id && !(banca.id in enl2), 'enlaza un ejercicio con una ficha y le quita la suya a otro');
await G.publicarGuia({ backend: b }, entera.guia.id, false);
await b.auth.salir();
await b.auth.entrar('ana@fbe.demo', 'demo');
check((await G.listaGuias({ backend: b })).map((x) => x.clave).join() === 'rutinas,cuadriceps,manual,deload,volver,cardio,composicion,sueno,motivacion,mitos' && await G.fichaDeEjercicio({ backend: b }, sinFicha.id) === null, 'con la guía escondida, Ana no la ve ni ve su ficha en el ejercicio');
await b.auth.salir();
await b.auth.entrar('pelayo@fbe.demo', 'demo');
// (filosofía) las guías con su texto, una por su clave y la lista mínima; las de la demo llevan las secciones de cada ocasión
await b.auth.salir();
await b.auth.entrar('ana@fbe.demo', 'demo');
const conSuTexto = await G.guiasConTexto({ backend: b });
check(conSuTexto.length === 10 && conSuTexto.every((x) => x.contenido && x.publicada) && buscarEnGuias(conSuTexto, 'cafeina')[0].guia.clave === 'sueno', 'para buscar se piden las guías con su texto (Ana, solo las publicadas)');
const laDeMitos = await G.guiaPorClave({ backend: b }, 'mitos');
check(mitosDeGuia(laDeMitos).length === 3 && await G.guiaPorClave({ backend: b }, 'no-existe') === null, 'la guía de los mitos se pide sola, por su clave');
const ligeras = await G.guiasLigeras({ backend: b });
check(ligeras.length === 10 && !('contenido' in ligeras[0]) && Object.values(OCASIONES).every((o) => conSuTexto.find((x) => x.clave === o.clave)?.contenido.secciones.some((x) => x.clave === o.seccion)),
  'la lista mínima de guías no trae su contenido; en la demo, cada ocasión tiene su guía y su sección');
await b.auth.salir();
await b.auth.entrar('pelayo@fbe.demo', 'demo');
const sin0 = { select: async (t) => { throw new Error(`Could not find the table 'public.${t}' in the schema cache`); } };
check((await G.guiasConTexto({ backend: sin0 })).length === 0 && await G.guiaPorClave({ backend: sin0 }, 'mitos') === null && (await G.guiasLigeras({ backend: sin0 })).length === 0, 'sin la migración 057, tampoco esto se rompe');
const completa = await api.copiaCompleta();
check(completa.guias.length === 11 && completa.fichas_ejercicio.length === 3 && Array.isArray(completa.ejercicios_fichas), 'las guías, las fichas y los enlaces van en la copia completa');
// Una base sin la 057: todo vacío y sin romper
const sin = { select: async (t) => { throw new Error(`Could not find the table 'public.${t}' in the schema cache`); }, delete: async () => { throw new Error('relation "public.ejercicios_fichas" does not exist'); } };
check(await G.hayGuias({ backend: sin }) === false && (await G.listaGuias({ backend: sin })).length === 0 && await G.guiaEntera({ backend: sin }, 'x') === null && await G.fichaDeEjercicio({ backend: sin }, 'x') === null
  && (await G.todasLasFichas({ backend: sin })).length === 0 && await G.enlacesFichas({ backend: sin }) === null && /migración 057/.test(await G.enlazarFicha({ backend: sin }, 'x', 'y').catch((e) => e.message)),
  'sin la migración 057 en la base, no hay guías y nada se rompe');
const roto = { select: async () => { throw new Error('Failed to fetch'); } };
check(await lanza(() => G.listaGuias({ backend: roto })) && await lanza(() => G.hayGuias({ backend: roto })), 'un fallo de red no se confunde con «no hay guías»');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
