// «Rellenar la semana»: la propuesta del menú con el recetario del atleta. Lógica pura, y lectura y guardado contra la demo.
//   node test/rellenar.test.mjs
import { rellenarSemana, opcionesDe, cambiarPropuesta, filasDePropuesta, totalesDePropuesta, descuadreDePlan, textoPropuesta,
  MODOS_RELLENO, NOMBRE_MODO_RELLENO, OPCIONES_LIGERAS, DESCUADRE_AVISO } from '../web/src/logica/rellenar/index.js';
import { recetarioPorToma, diasDeSemana } from '../web/src/logica/comidas.js';
import { sumarDias, hoyISO, lunesDe } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.stack); process.exit(1); });

const LUNES = '2026-11-09';
const D = diasDeSemana(LUNES);
// Un recetario de prueba: n recetas por comida, todas con las mismas kcal dentro de su comida
const KCAL = { desayuno: 400, media_manana: 200, comida: 700, merienda: 300, cena: 600 };
function recetario(cuantas, { tomas = ['desayuno', 'comida', 'merienda', 'cena'], opcional = null, extra = [] } = {}) {
  const recetas = [], asignaciones = [];
  for (const [t, n] of Object.entries(cuantas)) for (let i = 1; i <= n; i++) {
    const id = `${t}-${String(i).padStart(2, '0')}`;
    recetas.push({ id, nombre: `${t} ${i}`, kcal: KCAL[t], proteina_g: KCAL[t] / 20, carbos_g: KCAL[t] / 10, grasa_g: KCAL[t] / 30 });
    asignaciones.push({ id: `a-${id}`, atleta_id: 'at', receta_id: id, toma: t, factor: 1, favorita: false, orden: i, variante: null });
  }
  for (const x of extra) { if (x.receta) recetas.push(x.receta); asignaciones.push({ atleta_id: 'at', factor: 1, favorita: false, orden: 99, variante: null, ...x.asignacion }); }
  return { tomas, opcional, porToma: recetarioPorToma(asignaciones, recetas), asignaciones, recetas };
}
const E = (fecha, toma, receta_id, extra = {}) => ({ id: `e-${fecha}-${toma}`, fecha, toma, receta_id, texto: receta_id || 'algo', raciones: 1, kcal: KCAL[toma], proteina_g: 10, carbos_g: 10, grasa_g: 10, hecho: false, orden: 0, ...extra });
const de = (r, toma) => r.propuestas.filter((p) => p.toma === toma).map((p) => p.asignacion.receta_id);
const base = (extra = {}) => ({ recetario: recetario({ desayuno: 5, comida: 10, merienda: 5, cena: 10 }), lunes: LUNES, hoy: '2026-11-05', atletaId: 'at', ...extra });

console.log('La semana entera, variada');
{
  const r = rellenarSemana(base());
  check(r.propuestas.length === 28 && r.huecos === 28 && r.dias.length === 7 && r.sinRecetas.length === 0, 'una semana vacía y futura: las 28 comidas (7 días × 4)');
  check(new Set(de(r, 'comida')).size === 7 && new Set(de(r, 'cena')).size === 7, 'comidas y cenas: una receta distinta cada día');
  check(new Set(de(r, 'desayuno')).size === OPCIONES_LIGERAS && new Set(de(r, 'merienda')).size === 2, 'desayunos y meriendas: dos opciones');
  const des = de(r, 'desayuno');
  check(des.every((x, i) => x === des[i % 2]) && des[0] !== des[1], 'que se alternan por días');
  check(r.recetas === 18 && r.cocinar === 14 && textoPropuesta(r) === '28 comidas: 18 recetas distintas, 14 veces de cocinar comidas y cenas', 'el resumen: recetas distintas y veces de cocinar');
  check(igual(r.propuestas.map((p) => p.fecha), [...r.propuestas.map((p) => p.fecha)].sort()) && igual(r.propuestas.slice(0, 4).map((p) => p.toma), ['desayuno', 'comida', 'merienda', 'cena']), 'ordenada por día y, dentro del día, por comida');
  check(r.propuestas.every((p) => p.asignacion.receta && p.repite === false), 'cada propuesta lleva su asignación (con la receta dentro)');
  check(igual(rellenarSemana(base()), r), 'la misma entrada da la misma propuesta');
  const otra = rellenarSemana(base({ intento: 1 }));
  check(!igual(otra.propuestas.map((p) => p.asignacion.receta_id), r.propuestas.map((p) => p.asignacion.receta_id)) && otra.propuestas.length === 28, '«Otra propuesta» (otro intento) cambia las recetas');
  check(!igual(rellenarSemana(base({ atletaId: 'otro' })).propuestas.map((p) => p.asignacion.receta_id), r.propuestas.map((p) => p.asignacion.receta_id)), 'cada atleta tiene la suya');
  // Con menos recetas que días: se repite lo justo y nunca dos días seguidos
  const pocas = rellenarSemana(base({ recetario: recetario({ desayuno: 1, comida: 3, merienda: 2, cena: 2 }) }));
  const com = de(pocas, 'comida'), cen = de(pocas, 'cena');
  const cuenta = (xs) => Object.values(xs.reduce((o, k) => { o[k] = (o[k] || 0) + 1; return o; }, {})).sort();
  check(igual(cuenta(com), [2, 2, 3]) && igual(cuenta(cen), [3, 4]) && com.every((x, i) => i === 0 || x !== com[i - 1]) && cen.every((x, i) => i === 0 || x !== cen[i - 1]), 'con pocas recetas reparte por igual y no repite dos días seguidos');
  check(new Set(de(pocas, 'desayuno')).size === 1 && de(pocas, 'desayuno').length === 7, 'con una sola opción de desayuno, esa todos los días');
}

console.log('Solo los huecos, y solo desde hoy');
{
  const entradas = [E(D[0], 'comida', 'comida-03'), E(D[0], 'cena', null, { texto: 'Cena fuera' }), E(D[2], 'desayuno', 'desayuno-04'), E(D[6], 'merienda', 'merienda-02', { hecho: true })];
  const r = rellenarSemana(base({ entradas }));
  check(r.propuestas.length === 24 && r.huecos === 24, 'lo ya apuntado se respeta: 24 huecos de 28');
  check(!r.propuestas.some((p) => (p.fecha === D[0] && ['comida', 'cena'].includes(p.toma)) || (p.fecha === D[2] && p.toma === 'desayuno') || (p.fecha === D[6] && p.toma === 'merienda')), 'ningún hueco ocupado recibe propuesta (tampoco si lo apuntado es un texto libre)');
  check(!de(r, 'comida').includes('comida-03'), 'la comida que ya tiene esa semana no se le vuelve a proponer');
  check(de(r, 'desayuno').includes('desayuno-04') && new Set(de(r, 'desayuno')).size === 2, 'el desayuno que ya tiene apuntado es una de las dos opciones');
  // Semana en curso: desde hoy
  const enCurso = rellenarSemana(base({ hoy: D[3] }));
  check(enCurso.dias.length === 4 && enCurso.propuestas.length === 16 && enCurso.propuestas.every((p) => p.fecha >= D[3]), 'en la semana en curso solo se rellena desde hoy');
  const pasada = rellenarSemana(base({ hoy: sumarDias(D[6], 1) }));
  check(pasada.dias.length === 0 && pasada.propuestas.length === 0 && textoPropuesta(pasada) === 'No hay huecos que rellenar', 'una semana ya pasada no se rellena');
  check(rellenarSemana(base({ hoy: null })).propuestas.length === 28, 'sin «hoy», toda la semana');
  const llena = rellenarSemana(base({ entradas: D.flatMap((d) => ['desayuno', 'comida', 'merienda', 'cena'].map((t) => E(d, t, `${t}-01`))) }));
  check(llena.propuestas.length === 0 && llena.huecos === 0, 'con la semana completa no propone nada');
  // Lo de otra semana no cuenta como apuntado
  check(rellenarSemana(base({ entradas: [E(sumarDias(D[0], -1), 'comida', 'comida-03')] })).propuestas.length === 28, 'una entrada de otra semana no ocupa hueco');
}

console.log('La semana pasada, las favoritas y la misma receta el mismo día');
{
  const anteriores = ['comida-01', 'comida-02', 'comida-03'].map((id, i) => E(sumarDias(D[i], -7), 'comida', id)).concat([E(sumarDias(D[0], -7), 'desayuno', 'desayuno-01'), E(sumarDias(D[1], -7), 'desayuno', 'desayuno-02')]);
  const r = rellenarSemana(base({ anteriores }));
  check(!de(r, 'comida').some((x) => ['comida-01', 'comida-02', 'comida-03'].includes(x)), 'con recetas de sobra, las comidas de la semana pasada no vuelven a salir');
  check(!de(r, 'desayuno').some((x) => ['desayuno-01', 'desayuno-02'].includes(x)), 'ni los dos desayunos de la semana pasada');
  const justo = rellenarSemana(base({ recetario: recetario({ desayuno: 2, comida: 8, merienda: 2, cena: 8 }), anteriores }));
  check(de(justo, 'comida').filter((x) => ['comida-01', 'comida-02', 'comida-03'].includes(x)).length === 2 && new Set(de(justo, 'comida')).size === 7, 'si no hay bastantes, antes repite una de la semana pasada que una de esta');
  // Favoritas
  const fav = recetario({ desayuno: 5, comida: 10, merienda: 5, cena: 10 });
  for (const a of fav.asignaciones) if (['desayuno-05', 'merienda-04', 'comida-09'].includes(a.receta_id)) a.favorita = true;
  fav.porToma = recetarioPorToma(fav.asignaciones, fav.recetas);
  const rf = rellenarSemana(base({ recetario: fav }));
  check(de(rf, 'desayuno')[0] === 'desayuno-05' && de(rf, 'merienda')[0] === 'merienda-04', 'la favorita es la primera opción de desayuno y de merienda');
  check(de(rf, 'comida')[0] === 'comida-09', 'y la primera comida de la semana');
  const rf2 = rellenarSemana(base({ recetario: fav, anteriores: [E(sumarDias(D[0], -7), 'comida', 'comida-09')] }));
  check(de(rf2, 'comida')[0] !== 'comida-09', 'no repetir lo de la semana pasada pesa más que ser favorita');
  // La misma receta en comida y cena: nunca el mismo día
  const comp = recetario({ desayuno: 1, comida: 2, merienda: 1, cena: 0 }, { extra: [{ asignacion: { id: 'x1', receta_id: 'comida-01', toma: 'cena' } }, { asignacion: { id: 'x2', receta_id: 'comida-02', toma: 'cena' } }] });
  const rc = rellenarSemana(base({ recetario: comp }));
  const porDia = D.map((d) => rc.propuestas.filter((p) => p.fecha === d && ['comida', 'cena'].includes(p.toma)).map((p) => p.asignacion.receta_id));
  check(porDia.every((x) => x.length === 2 && x[0] !== x[1]), 'una receta que está en comida y en cena no sale dos veces el mismo día');
}

console.log('Cocinar para dos días');
{
  const r = rellenarSemana(base({ modo: 'dos_dias' }));
  const com = de(r, 'comida'), cen = de(r, 'cena');
  check(com[0] === com[1] && com[2] === com[3] && com[4] === com[5] && new Set(com).size === 4, 'comidas: lunes-martes, miércoles-jueves, viernes-sábado y una el domingo');
  check(cen[1] === cen[2] && cen[3] === cen[4] && cen[5] === cen[6] && new Set(cen).size === 4 && cen[0] !== cen[1], 'cenas: un día desplazadas (lunes sola, martes-miércoles, jueves-viernes, sábado-domingo)');
  check(r.cocinar === 8 && r.recetas === 12 && r.propuestas.filter((p) => p.repite).length === 6, 'se cocina 8 veces en vez de 14');
  check(r.propuestas.filter((p) => p.repite).every((p) => ['comida', 'cena'].includes(p.toma)), 'los desayunos y las meriendas siguen alternándose');
  const cocinaPorDia = D.map((d) => r.propuestas.filter((p) => p.fecha === d && ['comida', 'cena'].includes(p.toma) && !p.repite).length);
  check(igual(cocinaPorDia, [2, 1, 1, 1, 1, 1, 1]), 'salvo el primer día, cada día se cocina una sola cosa');
  // Un hueco ocupado en medio rompe la pareja
  const conHueco = rellenarSemana(base({ modo: 'dos_dias', entradas: [E(D[1], 'comida', null, { texto: 'Comida de empresa' })] }));
  const c2 = conHueco.propuestas.filter((p) => p.toma === 'comida');
  check(c2.length === 6 && c2[0].fecha === D[0] && !c2[1].repite && c2[1].fecha === D[2] && c2[2].repite, 'si un día ya está ocupado, la pareja no salta por encima: empieza otra');
  check(igual(MODOS_RELLENO, ['variada', 'dos_dias']) && NOMBRE_MODO_RELLENO.dos_dias === 'Cocinar para dos días', 'los dos modos');
}

console.log('Días sin la comida opcional y comidas sin recetas');
{
  // Merienda opcional: recetas para todos, y comidas más grandes para los días sin merienda
  const rec = recetario({ desayuno: 2, comida: 4, merienda: 2, cena: 4 }, { opcional: 'merienda', extra: [
    { receta: { id: 'comida-g1', nombre: 'comida grande 1', kcal: 850 }, asignacion: { id: 'g1', receta_id: 'comida-g1', toma: 'comida', variante: 'sin' } },
    { receta: { id: 'comida-g2', nombre: 'comida grande 2', kcal: 850 }, asignacion: { id: 'g2', receta_id: 'comida-g2', toma: 'comida', variante: 'sin' } },
  ] });
  for (const a of rec.asignaciones) if (a.toma === 'comida' && !a.variante) a.variante = 'con';
  rec.porToma = recetarioPorToma(rec.asignaciones, rec.recetas);
  const r = rellenarSemana(base({ recetario: rec, diasSin: [D[2], D[5]] }));
  check(r.propuestas.length === 26 && !r.propuestas.some((p) => p.toma === 'merienda' && [D[2], D[5]].includes(p.fecha)), 'los días sin merienda no reciben merienda');
  check(r.propuestas.filter((p) => p.toma === 'comida' && [D[2], D[5]].includes(p.fecha)).every((p) => p.asignacion.variante === 'sin')
    && r.propuestas.filter((p) => p.toma === 'comida' && ![D[2], D[5]].includes(p.fecha)).every((p) => p.asignacion.variante === 'con'), 'y llevan las comidas de ese tipo de día (las grandes); los demás, las suyas');
  check(rellenarSemana(base({ recetario: { ...rec, opcional: null }, diasSin: [D[2]] })).propuestas.filter((p) => p.toma === 'merienda').length === 7, 'sin comida opcional, los «días sin» no cuentan');
  // Una comida sin recetas se queda sin rellenar, y se dice
  const sinCena = rellenarSemana(base({ recetario: recetario({ desayuno: 2, comida: 4, merienda: 2 }) }));
  check(sinCena.propuestas.length === 21 && igual(sinCena.sinRecetas, ['cena']) && sinCena.huecos === 28, 'una comida sin recetas en el recetario se queda sin rellenar, y lo dice');
  const vacio = rellenarSemana(base({ recetario: { tomas: ['comida'], opcional: null, porToma: {} } }));
  check(vacio.propuestas.length === 0 && igual(vacio.sinRecetas, ['comida']), 'con el recetario vacío no propone nada');
  check(rellenarSemana({ recetario: null, lunes: LUNES }).propuestas.length === 0, 'sin recetario no rompe');
  // Cinco comidas al día
  const cinco = rellenarSemana(base({ recetario: recetario({ desayuno: 5, media_manana: 5, comida: 14, merienda: 5, cena: 14 }, { tomas: ['desayuno', 'media_manana', 'comida', 'merienda', 'cena'] }) }));
  check(cinco.propuestas.length === 35 && cinco.recetas === 20, 'con cinco comidas al día: 35 comidas, 20 recetas');
}

console.log('Cambiar una propuesta');
{
  const b = base();
  const r = rellenarSemana(b);
  const datos = { recetario: b.recetario, lunes: LUNES, propuestas: r.propuestas };
  const actual = r.propuestas.find((p) => p.fecha === D[0] && p.toma === 'comida').asignacion.receta_id;
  const ops = opcionesDe({ ...datos, fecha: D[0], toma: 'comida' });
  check(ops.length === 9 && !ops.some((a) => a.receta_id === actual), 'las otras recetas de esa comida (todas menos la que hay)');
  const usadas = new Set(de(r, 'comida'));
  check(ops.slice(0, 3).every((a) => !usadas.has(a.receta_id)) && ops.slice(3).every((a) => usadas.has(a.receta_id)), 'primero las que no salen en el resto de la semana');
  const x1 = cambiarPropuesta(datos, { fecha: D[0], toma: 'comida' });
  const nueva = x1.propuestas.find((p) => p.fecha === D[0] && p.toma === 'comida').asignacion.receta_id;
  check(nueva === ops[0].receta_id && nueva !== actual && igual(x1.vistas, [actual]) && x1.propuestas.length === 28, '«Cambiar» pone la mejor alternativa y apunta la que había');
  check(igual(x1.propuestas.filter((p) => !(p.fecha === D[0] && p.toma === 'comida')), r.propuestas.filter((p) => !(p.fecha === D[0] && p.toma === 'comida'))) && r.propuestas.find((p) => p.fecha === D[0] && p.toma === 'comida').asignacion.receta_id === actual, 'sin tocar las demás (ni la propuesta original)');
  // Dándole muchas veces pasa por todas antes de repetir
  let estado = { propuestas: r.propuestas, vistas: [] }; const vistasTodas = [actual];
  for (let i = 0; i < 9; i++) { estado = cambiarPropuesta({ ...datos, propuestas: estado.propuestas }, { fecha: D[0], toma: 'comida', vistas: estado.vistas }); vistasTodas.push(estado.propuestas.find((p) => p.fecha === D[0] && p.toma === 'comida').asignacion.receta_id); }
  check(new Set(vistasTodas).size === 10, 'dándole nueve veces pasa por las diez recetas, sin repetir ninguna');
  estado = cambiarPropuesta({ ...datos, propuestas: estado.propuestas }, { fecha: D[0], toma: 'comida', vistas: estado.vistas });
  check(estado.vistas.length === 1 && estado.propuestas.length === 28, 'y a la décima vuelve a empezar');
  // En «dos días», cambiar el segundo día deja de ser «la misma que ayer»
  const dos = rellenarSemana(base({ modo: 'dos_dias' }));
  const xd = cambiarPropuesta({ ...datos, propuestas: dos.propuestas }, { fecha: D[1], toma: 'comida' });
  check(dos.propuestas.find((p) => p.fecha === D[1] && p.toma === 'comida').repite && !xd.propuestas.find((p) => p.fecha === D[1] && p.toma === 'comida').repite, 'al cambiar el segundo día de una pareja deja de ser «la misma que el día anterior»');
  // Sin alternativas, o un hueco que no está: se queda igual
  const una = rellenarSemana(base({ recetario: recetario({ desayuno: 1, comida: 1, merienda: 1, cena: 1 }) }));
  const d1 = { recetario: recetario({ desayuno: 1, comida: 1, merienda: 1, cena: 1 }), lunes: LUNES, propuestas: una.propuestas };
  check(cambiarPropuesta(d1, { fecha: D[0], toma: 'comida' }).propuestas === una.propuestas && cambiarPropuesta(datos, { fecha: '2030-01-01', toma: 'comida' }).propuestas === r.propuestas, 'con una sola receta (o un hueco que no existe) no cambia nada');
  // Lo que ya está apuntado ese día va al final de las opciones
  const conCena = opcionesDe({ recetario: recetario({ comida: 3 }, { tomas: ['comida', 'cena'], extra: [{ asignacion: { id: 'c1', receta_id: 'comida-02', toma: 'cena' } }] }), lunes: LUNES, entradas: [E(D[0], 'cena', 'comida-02')], propuestas: [], fecha: D[0], toma: 'comida' });
  check(conCena.length === 3 && conCena[2].receta_id === 'comida-02', 'lo que ya come ese día va lo último');
}

console.log('Guardar, totales y plan');
{
  const b = base();
  const r = rellenarSemana(b);
  const filas = filasDePropuesta('at', r.propuestas);
  check(filas.length === 28 && filas.every((f) => f.atleta_id === 'at' && f.receta_id && f.texto && f.raciones === 1 && f.hecho === false && f.kcal === KCAL[f.toma] && !('id' in f) && !('asignacion' in f)), 'las filas que se guardan: las mismas que al apuntar una receta a mano (con sus macros)');
  const conFactor = recetario({ comida: 1 }, { tomas: ['comida'] }); conFactor.asignaciones[0].factor = 1.5; conFactor.porToma = recetarioPorToma(conFactor.asignaciones, conFactor.recetas);
  check(filasDePropuesta('at', rellenarSemana(base({ recetario: conFactor })).propuestas)[0].kcal === 1050, 'con el factor del atleta ya aplicado');
  check(filasDePropuesta('at', []).length === 0, 'sin propuestas, nada que guardar');
  const tot = totalesDePropuesta({ recetario: b.recetario, lunes: LUNES, propuestas: r.propuestas });
  check(Object.keys(tot).length === 7 && Object.values(tot).every((t) => t.kcal === 2000 && t.completo && t.total === 4), 'los totales de cada día con lo propuesto: 2.000 kcal y completos');
  const mixto = totalesDePropuesta({ recetario: b.recetario, lunes: LUNES, entradas: [E(D[0], 'comida', 'comida-01')], propuestas: r.propuestas.filter((p) => p.fecha === D[0] && p.toma !== 'comida' && p.toma !== 'cena') });
  check(mixto[D[0]].kcal === 1400 && !mixto[D[0]].completo && mixto[D[1]].total === 0 && !mixto[D[1]].completo, 'suman lo ya apuntado y lo propuesto; un día al que le falta una comida no está completo');
  const plan = (kcal) => [{ desde: '2026-01-01', modo: 'macros', kcal, proteina_g: 150, carbos_g: 200, grasa_g: 60 }];
  check(igual(descuadreDePlan(tot, plan(2000)), { pct: 0, kcal: 2000, objetivo: 2000, dias: 7 }), 'un recetario que cuadra con su plan: 0 %');
  check(descuadreDePlan(tot, plan(1800)).pct === 11.1 && descuadreDePlan(tot, plan(2200)).pct === -9.1 && DESCUADRE_AVISO === 5, 'si el recetario da más (o menos) que el plan, cuánto');
  check(descuadreDePlan(mixto, plan(2000)) === null && descuadreDePlan(tot, []) === null && descuadreDePlan(tot, [{ desde: '2026-01-01', modo: 'sin_contar' }]) === null, 'sin días completos o sin plan con kcal, no dice nada');
  check(textoPropuesta({ propuestas: [1], recetas: 1, cocinar: 1 }) === '1 comida: 1 receta, 1 vez de cocinar comidas y cenas' && textoPropuesta({ propuestas: [1, 2], recetas: 2, cocinar: 0 }) === '2 comidas: 2 recetas distintas' && textoPropuesta(null) === 'No hay huecos que rellenar', 'el resumen, también en singular');
}

console.log('Con la demo (lo que lee y lo que guarda)');
{
  const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
  const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
  const { crearApi } = await import('../web/src/datos/api.js');
  const { menuAnterior, guardarRelleno } = await import('../web/src/datos/rellenar.js');
  const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const api = crearApi(b);
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const lucia = (await api.atletas()).find((a) => a.nombre === 'Lucía Ferrer');
  const rec = await api.recetario(lucia.id);
  const lunes = sumarDias(lunesDe(hoyISO()), 7);
  const anteriores = await menuAnterior({ api }, lucia.id, lunes);
  check(anteriores.length > 0 && anteriores.every((e) => e.fecha < lunes), 'lee el menú de la semana anterior');
  const r = rellenarSemana({ recetario: rec, entradas: await api.menuSemana(lucia.id, lunes), anteriores, lunes, hoy: hoyISO(), atletaId: lucia.id });
  check(r.propuestas.length === 28 && r.sinRecetas.length === 0, 'la semana que viene de Lucía: 28 comidas con su recetario');
  const g = await guardarRelleno({ api, backend: b }, lucia.id, lunes, r.propuestas);
  const guardado = await api.menuSemana(lucia.id, lunes);
  check(g.guardadas === 28 && g.saltadas === 0 && guardado.length === 28 && guardado.every((e) => e.receta_id && e.kcal > 0 && !e.hecho), 'se guarda de una vez, con sus macros');
  const otraVez = await guardarRelleno({ api, backend: b }, lucia.id, lunes, r.propuestas);
  check(otraVez.guardadas === 0 && otraVez.saltadas === 28 && (await api.menuSemana(lucia.id, lunes)).length === 28, 'guardar dos veces no duplica: los huecos ya ocupados se saltan');
  check(rellenarSemana({ recetario: rec, entradas: guardado, anteriores, lunes, hoy: hoyISO(), atletaId: lucia.id }).propuestas.length === 0, 'y la semana ya no tiene huecos');
  check((await guardarRelleno({ api, backend: b }, lucia.id, lunes, [])).guardadas === 0, 'sin propuestas no hace nada');
  // La atleta, desde su app, con su propio recetario
  await b.auth.salir();
  await b.auth.entrar('lucia@fbe.demo', 'demo');
  const l2 = sumarDias(lunes, 7);
  const rec2 = await api.recetario(lucia.id);
  const r2 = rellenarSemana({ recetario: rec2, entradas: await api.menuSemana(lucia.id, l2), anteriores: await menuAnterior({ api }, lucia.id, l2), lunes: l2, hoy: hoyISO(), modo: 'dos_dias', atletaId: lucia.id });
  const g2 = await guardarRelleno({ api, backend: b }, lucia.id, l2, r2.propuestas);
  check(g2.guardadas === 28 && (await api.menuSemana(lucia.id, l2)).length === 28, 'la atleta también puede rellenar y guardar su semana');
  check(r2.cocinar <= 8 && r2.propuestas.some((p) => p.repite), 'en «cocinar para dos días», como mucho 8 veces de cocinar');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
