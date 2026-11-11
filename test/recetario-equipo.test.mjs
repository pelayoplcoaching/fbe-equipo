// El recetario del equipo (migración 055): recetas del coach a la vista de todos sus atletas. La lógica pura
// (logica/recetario-equipo.js), la migración en un Postgres local (PGlite): quién ve qué, las favoritas y el menú, y lo
// mismo en la demo (backend en memoria).
// Uso: node test/recetario-equipo.test.mjs
import { capituloDe, bloqueDe, ordenarRecetas, porCapitulos, capitulos, buscarRecetas, filtrarRecetas, esRapida, esParaVariosDias, textoTiempo, textoBatch,
  lineasIngredientes, pasosDe, comoAsignacion, resumenRecetario, limpiarLibro, SIN_CAPITULO, PESO_TOMA, kcalDeLaToma, sinAjuste, factorParaTi, ajusteParaTi } from '../web/src/logica/recetario-equipo.js';
import { entradaMenu, factorDeEntrada, listaCompra } from '../web/src/logica/comidas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('La lógica pura');
const R = [
  { id: 'c', nombre: 'Crema de calabaza', tomas: ['cena'], raciones: 4, minutos: 40, kcal: 300, proteina_g: 20, carbos_g: 30, grasa_g: 10, etiquetas: [],
    ingredientes: [{ nombre: 'Calabaza', cantidad: 800, unidad: 'g' }, { nombre: 'Sal (al gusto)' }], preparacion: '1. Cocer.\n2) Triturar.\n\nServir.',
    libro: { codigo: '05.02', capitulo: 'Cenas', bloque: 'Reconfortantes', batch: 'Sí (4 porciones)', medidas: ['1 calabaza pequeña', null] } },
  { id: 'a', nombre: 'Yogur con avena', tomas: ['desayuno'], raciones: 1, minutos: 3, kcal: 495, proteina_g: 26, carbos_g: 56, grasa_g: 20, etiquetas: ['Rápida'],
    ingredientes: [{ nombre: 'Yogur griego', cantidad: 200, unidad: 'g' }, { nombre: 'Plátano', cantidad: 1, unidad: 'ud' }], preparacion: 'Mezclar.',
    libro: { codigo: '03.01', capitulo: 'Desayunos', bloque: 'Rápidos', batch: 'No', medidas: ['1 envase', null] } },
  { id: 'b', nombre: 'Tortitas de avena', tomas: ['desayuno'], raciones: 1, minutos: 20, etiquetas: [], ingredientes: [], libro: { codigo: '03.07', capitulo: 'Desayunos', bloque: 'Fin de semana', batch: 'Parcial (masa)' } },
  { id: 'd', nombre: 'Croquetas', tomas: ['comida', 'cena'], raciones: 2, minutos: 180, etiquetas: [], ingredientes: [], libro: { codigo: '07.07', capitulo: 'Tu 20% en casa', tiempo: '3 h (incl. reposo)' } },
  { id: 'e', nombre: 'Bocadillo suelto', tomas: ['merienda'], raciones: 1, minutos: 90, etiquetas: [], ingredientes: [], libro: null },
  { id: 'f', nombre: 'Aliño', tomas: [], raciones: 1, etiquetas: [], ingredientes: [] },
];

console.log('Ajustadas a ti (recetas del equipo a las kcal de cada comida)');
{
  const cuatro = ['desayuno', 'comida', 'merienda', 'cena'];
  check(kcalDeLaToma(2400, 'comida', cuatro) === Math.round(2400 * 35 / 102) && kcalDeLaToma(2400, 'merienda', cuatro) === Math.round(2400 * 12 / 102), 'reparto fijo: con cuatro comidas, la comida un 34 % y la merienda un 12 %');
  const tres = ['desayuno', 'comida', 'cena'];
  check(Math.abs(['desayuno', 'comida', 'cena'].reduce((s, t) => s + kcalDeLaToma(2000, t, tres), 0) - 2000) <= 1, 'entre las comidas que hace él suman las kcal del día');
  check(kcalDeLaToma(2400, 'recena', cuatro) === null && kcalDeLaToma(null, 'comida', cuatro) === null && kcalDeLaToma(0, 'comida', cuatro) === null, 'sin kcal o en una comida que no hace, nada');
  check(Object.keys(PESO_TOMA).length === 6, 'un peso para cada una de las seis comidas');
  // Yogur con avena (495 kcal, desayuno): 2400 kcal y cuatro comidas → 588 kcal → ×1,2
  const aj = ajusteParaTi(R[1], { tomas: cuatro, kcalDia: 2400 });
  check(aj && aj.toma === 'desayuno' && aj.kcalToma === 588 && aj.factor === 1.2, 'el yogur con avena, para 2.400 kcal: su desayuno ronda las 588 kcal → ×1,2');
  check(ajusteParaTi(R[1], { tomas: cuatro, kcalDia: 1500 }).factor === 0.75, 'para 1.500 kcal, ×0,75');
  check(factorParaTi(R[1], 5000) === 2.5 && factorParaTi(R[1], 100) === 0.5, 'nunca más de ×2,5 ni menos de ×0,5');
  check(sinAjuste(R[3]) && ajusteParaTi(R[3], { tomas: cuatro, kcalDia: 2400 }) === null && sinAjuste({ libro: { capitulo: 'Salsas y básicos' } }) && !sinAjuste(R[0]), 'el «20 %» y las salsas y básicos no se ajustan');
  check(ajusteParaTi(R[2], { tomas: cuatro, kcalDia: 2400 }) === null && ajusteParaTi(R[1], { tomas: cuatro, kcalDia: null }) === null, 'sin kcal en la receta o en su plan, la receta tal cual');
  check(ajusteParaTi(R[0], { tomas: cuatro, kcalDia: 2400, toma: 'comida' }).toma === 'comida', 'si la pone en otra comida, se ajusta a esa');
  // Ingredientes a su medida: la crema (4 raciones, 800 g) ×1,5 para una ración → 300 g; las medidas caseras solo tal cual
  const l = lineasIngredientes(R[0], 1, 1.5);
  check(l[0].texto.includes('300') && l[0].medida === null && lineasIngredientes(R[0])[0].medida === '1 calabaza pequeña', 'los ingredientes van a su medida (y sin la medida casera, que ya no vale)');
  // En el menú: las kcal se apuntan ajustadas y la lista de la compra lo sabe, aunque no haya asignación
  const e = entradaMenu({ fecha: '2026-11-12', toma: 'desayuno', asignacion: { ...comoAsignacion(R[1], cuatro), factor: 1.2 }, raciones: 1 });
  check(e.kcal === 594 && factorDeEntrada(e, R[1]) === 1.2, 'apuntada en el menú: 594 kcal, y de ahí se sabe su factor');
  const compra = listaCompra([e], [R[1]], []);
  check(compra.items.find((i) => /yogur/i.test(i.nombre))?.cantidad === 240, 'la lista de la compra pide 240 g de yogur (200 × 1,2)');
  check(factorDeEntrada({ kcal: null, raciones: 1 }, R[1]) === null && factorDeEntrada({ kcal: 495, raciones: 1 }, R[1]) === 1, 'sin kcal apuntadas, no se sabe; tal cual, ×1');
}

check(capituloDe(R[0]) === 'Cenas' && bloqueDe(R[0]) === 'Reconfortantes' && capituloDe(R[4]) === 'Entre horas' && capituloDe(R[5]) === SIN_CAPITULO && bloqueDe(R[4]) === '', 'capítulo y bloque: los del recetario; sin ellos, el de su comida del día (o «Otras recetas»)');
check(ordenarRecetas(R).map((r) => r.id).join('') === 'abcdef', 'en el orden del recetario (por su código); las sueltas, detrás');
const caps = porCapitulos(R);
check(caps.map((c) => `${c.capitulo}:${c.n}`).join('|') === 'Desayunos:2|Cenas:1|Tu 20% en casa:1|Entre horas:1|Otras recetas:1' && caps[0].bloques.map((b) => b.bloque).join() === 'Rápidos,Fin de semana'
  && capitulos(R).length === 5, 'por capítulos y, dentro, por bloques');
check(buscarRecetas(R, 'YOGUR platano').length === 1 && buscarRecetas(R, 'cálabaza').length === 1 && buscarRecetas(R, 'reconfortantes')[0].id === 'c' && buscarRecetas(R, 'rapida')[0].id === 'a'
  && buscarRecetas(R, '   ').length === 6 && buscarRecetas(R, 'pizza').length === 0, 'buscar: sin tildes ni mayúsculas, todas las palabras, en nombre, ingredientes, capítulo, bloque y etiquetas');
check(esRapida(R[1]) && !esRapida(R[0]) && !esRapida(R[5]) && esParaVariosDias(R[0]) && !esParaVariosDias(R[1]) && !esParaVariosDias(R[2]), 'rápida: 15 minutos o menos; para varios días: las que el recetario dice que sí');
check(filtrarRecetas(R, { filtro: 'rapidas' }).length === 1 && filtrarRecetas(R, { filtro: 'varios_dias' })[0].id === 'c' && filtrarRecetas(R, { filtro: 'favoritas', favoritas: ['b', 'zz'] })[0].id === 'b'
  && filtrarRecetas(R, { filtro: 'favoritas', favoritas: new Set() }).length === 0 && filtrarRecetas(R, { capitulo: 'Desayunos', texto: 'avena' }).length === 2 && filtrarRecetas(R).length === 6, 'los filtros se suman: capítulo, texto y uno de un toque');
check(textoTiempo(R[1]) === '3 min' && textoTiempo(R[3]) === '3 h (incl. reposo)' && textoTiempo(R[4]) === '1 h 30 min' && textoTiempo({ minutos: 60 }) === '1 h' && textoTiempo(R[5]) === '', 'el tiempo: en minutos, en horas o como lo diga el recetario');
check(textoBatch(R[0]) === 'Para varios días (4 porciones)' && textoBatch(R[2]) === 'Se adelanta en parte (masa)' && textoBatch(R[1]) === '' && textoBatch(R[5]) === '', 'para varios días, en parte o nada');
const l1 = lineasIngredientes(R[1]);
check(l1[0].texto === '200 g de yogur griego' && l1[0].medida === '1 envase' && l1[1].texto === '1 plátano' && l1[1].medida === null, 'los ingredientes como se escriben, con su medida casera');
const l2 = lineasIngredientes(R[1], 2);
check(l2[0].texto === '400 g de yogur griego' && l2[0].medida === null, 'con otras raciones, las cantidades cambian y la medida casera no sale');
const l3 = lineasIngredientes(R[0]);
check(l3[0].texto === '800 g de calabaza' && l3[0].medida === '1 calabaza pequeña' && lineasIngredientes(R[0], 2)[0].texto === '400 g de calabaza' && l3[1].texto === 'Sal (al gusto)', 'una receta de varias raciones se enseña entera; la mitad, la mitad');
check(lineasIngredientes({ ...R[1], libro: { medidas: ['1 envase'] } })[0].medida === null, 'si las medidas ya no casan con los ingredientes, no se enseñan');
check(pasosDe(R[0]).join('|') === 'Cocer.|Triturar.|Servir.' && pasosDe({}).length === 0, 'los pasos, uno por línea y sin su número');
const as = comoAsignacion(R[3], ['desayuno', 'cena']);
check(as.toma === 'cena' && as.factor === 1 && as.receta === R[3] && comoAsignacion(R[5], ['desayuno', 'comida']).toma === 'desayuno' && comoAsignacion(R[1], []).toma === 'desayuno', 'para el menú: en la primera comida suya en la que encaja (o la primera que haga)');
const em = entradaMenu({ fecha: '2026-11-11', toma: as.toma, asignacion: comoAsignacion(R[0], ['cena']), raciones: 2 });
check(em.receta_id === 'c' && em.texto === 'Crema de calabaza' && em.kcal === 600 && em.proteina_g === 40, 'se apunta como cualquier receta: sus macros por ración, por las raciones que come');
check(resumenRecetario(R) === '6 recetas en 5 capítulos' && resumenRecetario([R[0]]) === '1 receta' && resumenRecetario([]) === '', 'el resumen de arriba');
const ll = limpiarLibro({ capitulo: ' Cenas ', bloque: '', otra: 'x', nota: 'n'.repeat(2000), medidas: ['1 lata', '', 7] });
check(ll.capitulo === 'Cenas' && !('bloque' in ll) && !('otra' in ll) && ll.nota.length === 1200 && JSON.stringify(ll.medidas) === '["1 lata",null,null]' && limpiarLibro({}) === null && limpiarLibro(null) === null, 'lo que se guarda del recetario: solo lo conocido, recortado');

console.log('\nLa migración 055 (PGlite)');
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
const ana = await usuario('a@x.test');   // entrenamiento y nutrición
const atletaA = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo') returning id`, [ana]))[0].id;
const bea = await usuario('b@x.test');   // solo entrenamiento
const atletaB = (await q(`insert into public.atletas (nombre, perfil_id, estado, nutricion) values ('Bea', $1, 'activo', false) returning id`, [bea]))[0].id;
const suelto = await usuario('c@x.test'); // con cuenta y sin ficha de atleta
await q(`insert into consentimientos (perfil_id, tipo, version) values ($1, 'datos_salud', '2026-10')`, [ana]);

await como(coach, 'aal2');
const libro = { capitulo: 'Desayunos', bloque: 'Rápidos', codigo: '03.01', descripcion: 'Una entrada.', nota: 'Una nota.', dificultad: 'Fácil', batch: 'No', objetivo: 'Todos', medidas: ['1 envase', null] };
const [rEq] = await q(`insert into recetas (nombre, tomas, kcal, proteina_g, ingredientes, para_todos, libro) values ('Yogur del equipo', '{desayuno}', 495, 26, '[{"nombre":"Yogur","cantidad":200,"unidad":"g"},{"nombre":"Canela"}]', true, $1) returning id, para_todos, libro`, [JSON.stringify(libro)]);
const [rSuya] = await q(`insert into recetas (nombre, tomas) values ('Solo de Ana', '{comida}') returning id, para_todos, libro`);
const [rNadie] = await q(`insert into recetas (nombre, tomas) values ('De la biblioteca', '{cena}') returning id`);
await q(`insert into recetas_atleta (atleta_id, receta_id, toma) values ($1, $2, 'comida')`, [atletaA, rSuya.id]);
check(rEq.para_todos === true && rEq.libro.capitulo === 'Desayunos' && rSuya.para_todos === false && rSuya.libro === null, 'una receta puede ser para todo el equipo y llevar lo de su recetario; las demás, como siempre');
check(await falla(`update recetas set libro = '{"sorpresa":"x"}' where id = $1`, [rEq.id]) && await falla(`update recetas set libro = '{"capitulo":""}' where id = $1`, [rEq.id])
  && await falla(`update recetas set libro = '[]' where id = $1`, [rEq.id]) && await falla(`update recetas set libro = $2 where id = $1`, [rEq.id, JSON.stringify({ nota: 'x'.repeat(1201) })])
  && await falla(`update recetas set libro = '{"capitulo":7}' where id = $1`, [rEq.id]) && await falla(`update recetas set libro = '{"medidas":[1]}' where id = $1`, [rEq.id])
  && await falla(`update recetas set libro = $2 where id = $1`, [rEq.id, JSON.stringify({ medidas: Array(41).fill('x') })]), 'lo del recetario: solo claves conocidas, textos con algo y cortos, medidas de texto');

await como(ana);
const veAna = (await q(`select nombre from recetas order by nombre`)).map((x) => x.nombre).join();
check(veAna === 'Solo de Ana,Yogur del equipo', `quien lleva la nutrición ve las de su recetario y las del equipo (${veAna})`);
await como(bea);
const veBea = (await q(`select nombre, libro from recetas order by nombre`));
check(veBea.length === 1 && veBea[0].nombre === 'Yogur del equipo' && veBea[0].libro.nota === 'Una nota.', 'quien solo entrena ve las del equipo, enteras, y ninguna más');
await como(suelto);
check((await q(`select count(*)::int n from recetas`))[0].n === 0, 'una cuenta sin ficha de atleta no ve ninguna');
await db.exec(`reset role; ${claims('', '')} set role anon;`);
check(await falla(`select count(*) from recetas`) || (await q(`select count(*)::int n from recetas`))[0].n === 0, 'ni nadie sin entrar');
await como(bea);
check(await falla(`insert into recetas (nombre, para_todos) values ('Mía', true)`) && (await q(`update recetas set para_todos = false where id = $1 returning id`, [rEq.id])).length === 0
  && (await q(`update recetas set nombre = 'Cambiada' where id = $1 returning id`, [rEq.id])).length === 0 && (await q(`delete from recetas where id = $1 returning id`, [rEq.id])).length === 0,
  'el atleta no crea, cambia ni borra recetas del equipo');

// Favoritas
await q(`insert into recetas_favoritas (atleta_id, receta_id) values ($1, $2)`, [atletaB, rEq.id]);
check(await falla(`insert into recetas_favoritas (atleta_id, receta_id) values ($1, $2)`, [atletaB, rEq.id]) && await falla(`insert into recetas_favoritas (atleta_id, receta_id) values ($1, $2)`, [atletaA, rEq.id])
  && await falla(`insert into recetas_favoritas (atleta_id, receta_id) values ($1, $2)`, [atletaB, rNadie.id]), 'se guarda una receta del equipo: una vez, solo para sí y solo si es del equipo');
check(await falla(`update recetas_favoritas set creada_en = now()`), 'una guardada no se cambia: se pone o se quita');
await como(ana);
check((await q(`select count(*)::int n from recetas_favoritas`))[0].n === 0 && (await q(`delete from recetas_favoritas returning receta_id`)).length === 0, 'Ana no ve ni quita las de Bea');
check(await falla(`insert into recetas_favoritas (atleta_id, receta_id) values ($1, $2)`, [atletaA, rSuya.id]), 'las de su recetario no van aquí (ya tienen su favorita)');
await q(`insert into recetas_favoritas (atleta_id, receta_id) values ($1, $2)`, [atletaA, rEq.id]);
await como(coach, 'aal2');
check((await q(`select count(*)::int n from recetas_favoritas`))[0].n === 2 && await falla(`insert into recetas_favoritas (atleta_id, receta_id) values ($1, $2)`, [atletaB, rEq.id])
  && (await q(`delete from recetas_favoritas returning receta_id`)).length === 0, 'el coach ve cuáles se guarda cada uno, pero no las pone ni las quita');
await como(bea);
check((await q(`delete from recetas_favoritas where receta_id = $1 returning receta_id`, [rEq.id])).length === 1 && (await q(`select count(*)::int n from recetas_favoritas`))[0].n === 0, 'y cada uno quita las suyas');
await q(`insert into recetas_favoritas (atleta_id, receta_id) values ($1, $2)`, [atletaB, rEq.id]);
await su();
await q(`update atletas set estado = 'baja' where id = $1`, [atletaB]);
await como(bea);
check(await falla(`insert into recetas_favoritas (atleta_id, receta_id) values ($1, $2)`, [atletaB, rNadie.id]) && (await q(`select count(*)::int n from recetas`))[0].n === 1, 'de baja, sigue viendo el recetario pero no guarda');
await su();
await q(`update atletas set estado = 'activo' where id = $1`, [atletaB]);

// El menú
await como(ana);
const [m1] = await q(`insert into menu_comidas (atleta_id, fecha, toma, receta_id, texto, kcal) values ($1, current_date, 'desayuno', $2, 'Yogur del equipo', 495) returning id, receta_id`, [atletaA, rEq.id]);
check(m1.receta_id === rEq.id, 'quien lleva la nutrición apunta en su menú una receta del equipo, aunque no esté en su recetario');
check(await falla(`insert into menu_comidas (atleta_id, fecha, toma, receta_id, texto) values ($1, current_date, 'cena', $2, 'De la biblioteca')`, [atletaA, rNadie.id]), 'pero no una de la biblioteca que no es ni suya ni del equipo');
await como(bea);
check(await falla(`insert into menu_comidas (atleta_id, fecha, toma, receta_id, texto) values ($1, current_date, 'desayuno', $2, 'Yogur del equipo')`, [atletaB, rEq.id]), 'el menú sigue pidiendo el consentimiento de datos de salud');

// El coach la quita del equipo o la borra
await como(coach, 'aal2');
await q(`update recetas set para_todos = false where id = $1`, [rEq.id]);
await como(bea);
check((await q(`select count(*)::int n from recetas`))[0].n === 0, 'al quitarla del equipo, deja de verse');
await como(ana);
check(await falla(`insert into menu_comidas (atleta_id, fecha, toma, receta_id, texto) values ($1, current_date, 'cena', $2, 'Yogur del equipo')`, [atletaA, rEq.id])
  && (await q(`select texto from menu_comidas where id = $1`, [m1.id]))[0].texto === 'Yogur del equipo', 'ni se puede apuntar de nuevo; lo ya apuntado se queda');
await como(coach, 'aal2');
await q(`update recetas set para_todos = true where id = $1`, [rEq.id]);
await q(`delete from recetas where id = $1`, [rEq.id]);
check((await q(`select count(*)::int n from recetas_favoritas`))[0].n === 0 && (await q(`select receta_id, texto from menu_comidas where id = $1`, [m1.id]))[0].receta_id === null, 'al borrarla, se va de las guardadas y en el menú queda su nombre');
const [rEq2] = await q(`insert into recetas (nombre, para_todos) values ('Otra del equipo', true) returning id`);
await como(bea);
await q(`insert into recetas_favoritas (atleta_id, receta_id) values ($1, $2)`, [atletaB, rEq2.id]);
await su();
await q(`delete from atletas where id = $1`, [atletaB]);
check((await q(`select count(*)::int n from recetas_favoritas`))[0].n === 0, 'al borrar al atleta, sus guardadas se van con él');
await db.close();

console.log('\nEn la demo (backend en memoria)');
const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
const { crearApi } = await import('../web/src/datos/api.js');
const { hayRecetarioEquipo, recetarioEquipo, fotosRecetarioEquipo, guardarFavoritaEquipo, idsRecetasEquipo, ponerParaTodos } = await import('../web/src/datos/recetario-equipo.js');
const { hoyISO } = await import('../web/src/logica/fechas.js');
const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
const api = crearApi(b);
const lanza = async (fn) => { try { await fn(); return false; } catch { return true; } };
await b.auth.entrar('carlos@fbe.demo', 'demo');
const carlos = (await b.select('atletas', {})).find((a) => a.nombre.startsWith('Carlos'));
check(carlos.nutricion === false && await hayRecetarioEquipo({ backend: b }), 'Carlos solo entrena, y hay recetario del equipo');
const rc = await recetarioEquipo({ backend: b }, carlos.id);
check(rc.recetas.length === 10 && rc.favoritas.length === 0 && rc.recetas.every((r) => r.para_todos && r.libro?.capitulo && r.ingredientes.length && !('foto' in r) && !('foto_mini' in r)) && capitulos(rc.recetas).length === 4,
  'lo ve entero: 10 recetas en 4 capítulos, con sus ingredientes y sin fotos');
const fotosEq = await fotosRecetarioEquipo({ backend: b });
check(Object.keys(fotosEq).length > 0 && Object.keys(fotosEq).every((id) => rc.recetas.some((r) => r.id === id)) && Object.values(fotosEq).every((f) => f.startsWith('data:image/')),
  'las miniaturas van aparte, solo las de las recetas del equipo que tienen foto');
await guardarFavoritaEquipo({ backend: b }, carlos.id, rc.recetas[0].id, true);
await guardarFavoritaEquipo({ backend: b }, carlos.id, rc.recetas[0].id, true);
check((await recetarioEquipo({ backend: b }, carlos.id)).favoritas.join() === rc.recetas[0].id, 'se guarda una (y guardarla dos veces no rompe nada)');
await guardarFavoritaEquipo({ backend: b }, carlos.id, rc.recetas[0].id, false);
check((await recetarioEquipo({ backend: b }, carlos.id)).favoritas.length === 0, 'y la quita');
const ana2 = (await b.select('atletas', {})).find((a) => a.nombre === 'Ana López');
check(await lanza(() => b.insert('recetas_favoritas', [{ atleta_id: ana2.id, receta_id: rc.recetas[0].id }])) && (await ponerParaTodos({ backend: b }, rc.recetas[0].id, false)) === undefined && (await recetarioEquipo({ backend: b }, carlos.id)).recetas.length === 10
  && await lanza(() => b.update('recetas_favoritas', { creada_en: 'x' }, {})), 'no guarda por otro, ni quita una receta del equipo, ni cambia una guardada');
await b.auth.salir();
await b.auth.entrar('ana@fbe.demo', 'demo');
const ra = await api.recetario(ana2.id);
const rea = await recetarioEquipo({ backend: b }, ana2.id);
const fuera = rea.recetas.find((r) => !ra.recetas.some((x) => x.id === r.id)) || rea.recetas[0];
const apuntada = await api.apuntarMenu(ana2.id, { fecha: hoyISO(), toma: comoAsignacion(fuera, ra.tomas).toma, asignacion: comoAsignacion(fuera, ra.tomas), raciones: 1 });
check(apuntada.receta_id === fuera.id && apuntada.texto === fuera.nombre && Number(apuntada.kcal) === Number(fuera.kcal), 'Ana (con nutrición) apunta en su menú una receta del equipo, con sus macros');
await b.auth.salir();
await b.auth.entrar('pelayo@fbe.demo', 'demo');
const ids = await idsRecetasEquipo({ backend: b });
check(ids.length === 10 && (await recetarioEquipo({ backend: b })).favoritas.length === 0, 'el coach sabe cuáles ve todo el equipo');
await ponerParaTodos({ backend: b }, ids[0], false);
check((await idsRecetasEquipo({ backend: b })).length === 9 && await lanza(() => b.update('recetas', { libro: { sorpresa: 'x' } }, { eq: { id: ids[1] } })), 'quita una del equipo; lo del recetario, solo con claves conocidas');
const copia = await api.duplicarReceta(ids[1]);
check(copia.para_todos === false && (await idsRecetasEquipo({ backend: b })).length === 9, 'la copia de una receta del equipo no es para todo el equipo');
const completa = await api.copiaCompleta();
check(Array.isArray(completa.recetas_favoritas), 'las guardadas van en la copia completa');
// Una base sin la 055: todo vacío y sin romper
const sin = { select: async () => { throw new Error('column recetas.para_todos does not exist'); }, update: async () => { throw new Error('Could not find the \'para_todos\' column of \'recetas\' in the schema cache'); } };
check(await hayRecetarioEquipo({ backend: sin }) === false && (await recetarioEquipo({ backend: sin }, 'x')).recetas.length === 0 && await idsRecetasEquipo({ backend: sin }) === null
  && Object.keys(await fotosRecetarioEquipo({ backend: sin })).length === 0
  && /migración 055/.test(await ponerParaTodos({ backend: sin }, 'x', true).catch((e) => e.message)), 'sin la migración 055 en la base, no hay recetario y nada se rompe');
const roto = { select: async () => { throw new Error('Failed to fetch'); } };
check(await lanza(() => recetarioEquipo({ backend: roto }, 'x')) && await lanza(() => hayRecetarioEquipo({ backend: roto })), 'un fallo de red no se confunde con «no hay recetario»');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
