// FBE Esencial (acompañamiento, tanda 6, punto 60): «un mes en la vida», de punta a punta, en la demo y con un reloj que
// adelanta los días. Inés empieza de cero («Primeras 4 semanas») y llega a su semana 5; Tomás, que ya lleva sus cuatro
// primeras, se va de viaje diez días y vuelve. En cada paso se mira lo que la app le dice (el saludo del
// día, las agujetas, su lección, sus marcas, el final de sus cuatro semanas, su revisión, sus hitos, el diario…) y que
// nunca se quede sin nada que decirle.
const RealDate = Date;
let desfase = 0;
class Falsa extends RealDate {
  constructor(...a) { if (a.length === 0) super(RealDate.now() + desfase); else super(...a); }
  static now() { return RealDate.now() + desfase; }
}
globalThis.Date = Falsa;
const DIA = 864e5;
const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
const { crearApi } = await import('../web/src/datos/api.js');
const { hoyISO, lunesDe, sumarDias } = await import('../web/src/logica/fechas.js');
const datos = await import('../web/src/datos/api-esencial.js');
const cerca = await import('../web/src/logica/esencial-cerca.js');
const vida = await import('../web/src/logica/esencial-vida.js');
const { revisionDe } = await import('../web/src/logica/esencial-porque.js');
const { leccionDe, semanaDelPlan } = await import('../web/src/logica/esencial-lecciones.js');

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.stack || e.message); process.exit(1); });

// Se empieza en lunes (el de esta semana): así el mes cae igual se ejecute el día que se ejecute
const LUNES = RealDate.parse(`${lunesDe(hoyISO())}T09:00:00Z`) - RealDate.now();
desfase = LUNES;
let bd = crearBackendMemoria({ semilla: () => semillaDemo(hoyISO(), { esencial: true }), persistir: false });
let api = crearApi(bd);
const entrar = async (correo) => { await bd.auth.entrar(correo, 'demo'); return (await bd.select('atletas', { eq: { email: correo } }))[0]; };
const saludo = (p) => cerca.saludoDe({ hoy: hoyISO(), actual: p.actual, semanas: p.semanas, sesiones: p.sesiones });
const hacer = async (yo, s, rpe = 8) => {
  const d = await api.sesion(s.id, yo.id);
  for (const e of d.ejercicios) {
    const kg = e.carga_sugerida_kg == null ? 20 : Number(e.carga_sugerida_kg);
    for (let n = 1; n <= e.series; n++) await api.guardarSerie({ sesion_ejercicio_id: e.id, numero: n, kg, reps: e.reps_max, rpe: e.ejercicio.por_tiempo ? null : 8 }, yo.id);
  }
  await api.marcarSesion(s.id, { completada: true, fecha_realizada: hoyISO(), rpe_sesion: rpe });
};

console.log('Inés, de cero: sus cuatro primeras semanas y la quinta');
const ines = await entrar('ines@fbe.demo');
const visto = [];
for (let k = 1; k <= 5; k++) {
  // lunes
  const prep = await api.prepararSemanaEsencial(ines.id);
  let p = await api.programa(ines.id);
  const ss = [...(p.sesiones[p.actual.id] || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const s0 = saludo(p);
  const n = semanaDelPlan(p.bloques, p.actual.fecha_inicio);
  const rev = await datos.revision(api, bd, ines.id);
  await hacer(ines, ss[0]);
  p = await api.programa(ines.id);
  const sHecha = saludo(p);
  // martes: el día después
  desfase += DIA;
  p = await api.programa(ines.id);
  const sDespues = saludo(p);
  const hechas1 = await datos.hechas(bd, ines.id);
  const ag = cerca.agujetasDe({ hoy: hoyISO(), hechas: hechas1 });
  // jueves: la segunda
  desfase += 2 * DIA;
  await hacer(ines, ss[1]);
  p = await api.programa(ines.id);
  const sCompleta = saludo(p);
  const fin = vida.finPrimeras({ bloque: p.bloque.nombre, actual: p.actual, semanas: p.semanas, sesiones: p.sesiones });
  const hechas2 = await datos.hechas(bd, ines.id);
  visto.push({ k, prep: prep?.tipo || null, bloque: p.bloque.nombre, numero: p.actual.numero, n, total: ss.length, s0, sHecha, sDespues, ag, sCompleta, fin, rev, hechas: hechas2.length,
    vuelta: cerca.vueltaDe({ hoy: hoyISO(), actual: p.actual, ss: p.sesiones[p.actual.id], hechas: hechas2, inicio: p.bloques.map((b) => b.fecha_inicio).filter(Boolean).sort()[0] }),
    ritmo: cerca.ritmoDe({ actual: p.actual, semanas: p.semanas, sesiones: p.sesiones }), reto: cerca.retoSemana({ ss: p.sesiones[p.actual.id] }), p });
  // al lunes siguiente
  desfase += 4 * DIA;
}
const [w1, w2, w3, w4, w5] = visto;
check(visto.slice(0, 4).every((w, i) => w.bloque === 'Primeras 4 semanas' && w.numero === i + 1 && w.n === i + 1 && w.total === 2), 'semanas 1 a 4: «Primeras 4 semanas», dos sesiones cada una');
check(visto.every((w) => w.s0?.texto && w.sHecha?.tipo === 'hecha' && /Sesión de hoy, hecha/.test(w.sHecha.texto) && w.sDespues?.tipo === 'despues' && /^Semana hecha/.test(w.sCompleta?.texto || '')),
  `cada semana, la app le habla cada día: al empezar («${w1.s0?.texto}»), con la sesión hecha, el día después y con la semana completa`);
check(w1.ag?.motivo === 'primera' && visto.slice(1).every((w) => w.ag === null), 'el día después de su primera sesión le pregunta por las agujetas (y solo ese día: las demás, a 8, no)');
check([1, 2, 3, 4, 5].every((n) => !!leccionDe(n)?.titulo) && visto.every((w) => w.vuelta === null && w.ritmo === null && w.reto?.hecho === true), 'cada semana tiene su lección; yendo a todo, nadie le habla de volver ni de bajar el ritmo, y su reto queda conseguido');
check(visto.slice(0, 3).every((w) => w.fin === null) && !!w4.fin && w4.fin.sesiones === 8 && w4.fin.total === 8 && /8 sesiones hechas de 8/.test(w4.fin.lineas[0]), `al acabar la cuarta: «Tus cuatro primeras semanas, hechas» (${w4.fin?.lineas[0]})`);
check(w5.prep === 'novato' && w5.bloque === 'Novato 2 días · FBE Esencial' && w5.n === 5 && w5.fin === null && w5.rev?.tipo === 'novato' && revisionDe(w5.rev).titulo === 'Tu plan desde hoy sale de tus marcas',
  'la quinta la prepara la app con sus marcas: rutina de novato, y su revisión lo cuenta');
check(w1.rev?.tipo === 'primera' && [w2, w3, w4].every((w) => w.rev === null || ['primera', 'siguiente', 'novato'].includes(w.rev.tipo)), 'en sus cuatro primeras, la revisión no inventa cambios (son las de la guía)');
check(w5.hechas === 10 && !!cerca.hitoDe(w5.hechas) && visto.slice(0, 4).every((w) => !cerca.hitoDe(w.hechas)), `al acabar la quinta lleva diez sesiones: su primer hito («${cerca.hitoDe(10)}»)`);
{
  const marcas = await api.marcasEsencial(ines.id);
  check(!!marcas && marcas.completa && marcas.marcas.length >= 5 && marcas.semana.numero === 4, `sus marcas de la semana 4, guardadas (${marcas?.marcas.length} ejercicios)`);
  const p = w5.p;
  const diario = cerca.diarioDe({ bloques: p.bloques, semanas: p.semanas, sesiones: p.sesiones, hoy: hoyISO() });
  check(diario.length >= 1 && diario.every((x) => x.fecha && x.titulo && x.texto) && cerca.comoVamosToca({ n: 5, notas: [] }) === 'mes' && cerca.comoVamosToca({ n: 3, notas: [] }) === null,
    `«Lo que la app ha hecho por ti» tiene qué contar (${diario.length} cosas) y, al mes, le pregunta cómo vamos`);
  const antes = await datos.marcasAntesYAhora(api, bd, ines.id);
  check(!!antes && antes.desde === 4 && antes.filas.length >= 4, `y ya puede comparar sus marcas con lo de ahora (${antes?.filas.length} ejercicios)`);
  check(vida.subirNivel({ rutina: p.bloque.nombre, actual: p.actual, semanas: p.semanas, sesiones: p.sesiones }) === null, 'pasar a tres días aún no se le propone (lleva una semana con su rutina)');
}

console.log('\nTomás: se va de viaje diez días y vuelve');
// (otra demo, otra vez desde este lunes: Tomás acaba de terminar sus cuatro primeras semanas)
desfase = LUNES;
bd = crearBackendMemoria({ semilla: () => semillaDemo(hoyISO(), { esencial: true }), persistir: false });
api = crearApi(bd);
const tomas = await entrar('tomas@fbe.demo');
await api.prepararSemanaEsencial(tomas.id);
let p = await api.programa(tomas.id);
const hoy0 = hoyISO();
check(p.actual && p.bloque.nombre === 'Novato 2 días · FBE Esencial', `Tomás, en su rutina («${p.bloque?.nombre}», semana ${p.actual?.numero})`);
// apunta un viaje de mañana a dentro de nueve días, sin entrenar
await datos.apuntarViaje(bd, tomas.id, { desde: sumarDias(hoy0, 1), hasta: sumarDias(hoy0, 9), modo: 'pausa' });
let nv = await datos.notasVida(bd, tomas.id);
let vj = vida.viajeDe(nv.viaje, hoyISO());
check(vj?.estado === 'antes' && vj.faltan === 1 && vida.textoViaje(vj).titulo === 'Mañana te vas' && !vida.viajeCalla(vj), 'la víspera: «Mañana te vas» (los avisos, aún como siempre)');
desfase += 3 * DIA;
vj = vida.viajeDe(nv.viaje, hoyISO());
p = await api.programa(tomas.id);
check(vj?.estado === 'durante' && vida.viajeCalla(vj) && /De viaje hasta el/.test(vida.textoViaje(vj).titulo), `fuera: «${vida.textoViaje(vj).titulo}», con los avisos de entreno callados`);
// vuelve: han pasado diez días desde que se fue
desfase += 8 * DIA;
vj = vida.viajeDe(nv.viaje, hoyISO());
check(vj?.estado === 'vuelta' && vida.textoViaje(vj).titulo === '¿Ya de vuelta?', 'a la vuelta: «¿Ya de vuelta?»');
const prep = await api.prepararSemanaEsencial(tomas.id);
p = await api.programa(tomas.id);
const hechasT = await datos.hechas(bd, tomas.id);
const inicioT = p.bloques.map((b) => b.fecha_inicio).filter(Boolean).sort()[0];
const vuelta = cerca.vueltaDe({ hoy: hoyISO(), actual: p.actual, ss: p.sesiones[p.actual.id] || [], hechas: hechasT, inicio: inicioT });
check(!!p.actual && String(p.actual.fecha_inicio).slice(0, 10) <= hoyISO() && (p.sesiones[p.actual.id] || []).length >= 2 && (p.sesiones[p.actual.id] || []).every((s) => !s.completada),
  `la app le tiene su semana preparada al volver (${prep?.tipo || 'la que tenía'}; semana ${p.actual?.numero})`);
check(!!vuelta && vuelta.dias >= 7 && !!vuelta.sesion && !vuelta.nunca, `y, como lleva ${vuelta?.dias} días sin entrenar, le propone hacer solo la siguiente («${vuelta?.sesion?.nombre}»)`);
const rev = await datos.revision(api, bd, tomas.id);
check(rev === null || (Array.isArray(rev.porque) && rev.porque.every((f) => f.sin_motivo || f.nuevo || f.despues)), 'su revisión, si la hay, cuenta lo que tiene delante');
// hace la primera y la app vuelve a hablarle con normalidad
await hacer(tomas, [...(p.sesiones[p.actual.id] || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))[0]);
p = await api.programa(tomas.id);
check(saludo(p)?.tipo === 'hecha' && cerca.vueltaDe({ hoy: hoyISO(), actual: p.actual, ss: p.sesiones[p.actual.id], hechas: await datos.hechas(bd, tomas.id), inicio: inicioT }) === null, 'hecha la primera, vuelve a lo de siempre: «Sesión de hoy, hecha»');
desfase += 4 * DIA;
check(vida.viajeDe(nv.viaje, hoyISO()) === null, 'y del viaje ya no se habla');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
