// FBE Esencial (acompañamiento, tanda 4, v0.245): el porqué de cada decisión, en palabras. Las frases de cada caso (sube,
// suma repeticiones, se queda igual y por qué, baja, descarga, vuelta, marcas, ejercicio nuevo), «Tu revisión de la
// semana», «Tu sesión, en claro», «¿Cómo ha ido?» y «Lo de hoy». Y en la demo, con un reloj que adelanta las semanas, que
// la revisión de Tomás cuenta lo mismo que la app le ha preparado (los kilos de cada ejercicio de su semana nueva).
const RealDate = Date;
let desfase = 0;
class Falsa extends RealDate {
  constructor(...a) { if (a.length === 0) super(RealDate.now() + desfase); else super(...a); }
  static now() { return RealDate.now() + desfase; }
}
globalThis.Date = Falsa;
const { explicar, revisionDe, focoDe, FOCOS, hechoDe, casa, enClaro, resumenEnClaro, COMO_HA_IDO, respuestaComoHaIdo, loDeHoy, pesoEnContexto } = await import('../web/src/logica/esencial-porque.js');
const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
const { crearApi } = await import('../web/src/datos/api.js');
const { hoyISO, fechaMadrid } = await import('../web/src/logica/fechas.js');
const datos = await import('../web/src/datos/api-esencial.js');

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

// Un hecho de ejemplo: prensa, 3 × 10 a 12 con 80 kg
const h = (mas = {}) => ({ sesion: 0, sesion_nombre: 'Día 1', ejercicio_id: 'e1', nuevo_id: 'e1', nombre: 'Prensa de piernas', por_tiempo: false, tipo: 'mantener', diagnostico: 'en_rango',
  frenos: [], mal_dia: false, molestia: false, semana: 'normal', novato: false, estancado: false, hecho: [{ kg: 80, reps: 11, rpe: 8 }, { kg: 80, reps: 10, rpe: 8 }, { kg: 80, reps: 10, rpe: 9 }],
  antes: { kg: 80, min: 10, max: 12, series: 3 }, despues: { kg: 80, min: 10, max: 12, series: 3 }, ...mas });
const doce = [{ kg: 80, reps: 12, rpe: 8 }, { kg: 80, reps: 12, rpe: 8 }, { kg: 80, reps: 12, rpe: 8 }];

console.log('El porqué de cada ejercicio');
let x = explicar(h({ tipo: 'subir', diagnostico: 'superado', hecho: doce, despues: { kg: 82.5, min: 10, max: 10, series: 3 } }));
check(x.clase === 'sube' && x.corto === 'Sube a 82,5 kg' && /Subes de 80 kg a 82,5 kg: hiciste 12, 12 y 12 y cumpliste en todas tus series/.test(x.texto) && /el objetivo de esta semana baja a 10 repeticiones/.test(x.texto) && x.queda === '82,5 kg · 3 × 10 repeticiones',
  `sube de peso: de cuánto a cuánto, lo que hizo y el objetivo nuevo («${x.texto}»)`);
x = explicar(h({ tipo: 'reps', despues: { kg: 80, min: 11, max: 11, series: 3 } }));
check(x.clase === 'reps' && /Mismo peso \(80 kg\) y un poco más de repeticiones: la semana pasada hiciste 11, 10 y 10; esta, a por 11\./.test(x.texto), `mismo peso y más repeticiones («${x.texto}»)`);
x = explicar(h({ tipo: 'series', diagnostico: 'superado', hecho: doce, despues: { kg: 80, min: 10, max: 12, series: 4 } }));
check(x.clase === 'serie' && /Una serie más \(4 en total\)/.test(x.texto), 'una serie más');
x = explicar(h());
check(x.clase === 'igual' && x.corto === 'Repites 80 kg' && /Repites 80 kg y el mismo objetivo: hiciste 11, 10 y 10/.test(x.texto), `se queda igual, dentro de lo previsto («${x.texto}»)`);
x = explicar(h({ diagnostico: 'por_debajo', hecho: [{ kg: 80, reps: 10 }, { kg: 80, reps: 9 }, { kg: 80, reps: 8 }] }));
check(x.clase === 'igual' && /en alguna serie no llegaste a 10\. Si vuelve a pasar, la app baja un poco el peso/.test(x.texto), `no llegó al mínimo: repite, y dice qué pasa si se repite («${x.texto}»)`);
check(/mal día/.test(explicar(h({ diagnostico: 'por_debajo', mal_dia: true })).texto), 'un mal día no cuenta');
check(/apretando más de lo previsto/.test(explicar(h({ diagnostico: 'pasado' })).texto), 'apretó de más: repite');
check(/te faltó alguna serie/.test(explicar(h({ diagnostico: 'a_medias', hecho: doce.slice(0, 2) })).texto) && /no apuntaste este ejercicio/.test(explicar(h({ diagnostico: 'sin_registrar', hecho: [] })).texto)
  && /lo cambiaste por otro ejercicio/.test(explicar(h({ diagnostico: 'cambiado', hecho: [] })).texto), 'series sin hacer, sin apuntar o cambiado por otro: se queda igual y dice por qué');
check(/parecía una errata/.test(explicar(h({ tipo: 'pregunta' })).texto), 'una posible errata: no se ha usado para decidir');
x = explicar(h({ tipo: 'bajar', diagnostico: 'por_debajo', despues: { kg: 77.5, min: 10, max: 12, series: 3 } }));
check(x.clase === 'baja' && /Bajas de 80 kg a 77,5 kg: llevas dos semanas sin llegar al mínimo \(10 repeticiones\)/.test(x.texto), `dos semanas por debajo: baja («${x.texto}»)`);
x = explicar(h({ estancado: true, despues: { kg: 72.5, min: 10, max: 12, series: 3 } }));
check(x.clase === 'baja' && /llevabas tres semanas con el mismo peso y las mismas repeticiones/.test(x.texto), 'tres semanas igual: baja un poco para volver a subir');
check(explicar(h({ semana: 'descarga' })).clase === 'descarga' && explicar(h({ semana: 'vuelta' })).clase === 'vuelta' && /a medias/.test(explicar(h({ semana: 'repetir' })).texto), 'la descarga, la vuelta tras un parón y la semana a medias');
check(/tope de series/.test(explicar(h({ frenos: ['tope_semana'] })).texto) && /check-in venía bajo/.test(explicar(h({ frenos: ['checkin_bajo'] })).texto)
  && /molestia apuntada en esa zona/.test(explicar(h({ frenos: ['molestia'] })).texto) && /semana de descarga/.test(explicar(h({ frenos: ['tras_descarga'] })).texto), 'los frenos (tope de series, check-in bajo, molestia y tras la descarga), cada uno con su frase');
check(!/molestia/.test(explicar(h({ molestia: true, diagnostico: 'superado', hecho: doce })).texto), 'una molestia que solo se avisa (y no ha frenado nada) no se cuenta como motivo');
x = explicar(h({ por_tiempo: true, nombre: 'Plancha abdominal', hecho: [{ kg: null, reps: 45 }, { kg: null, reps: 45 }], antes: { kg: null, min: 35, max: 45, series: 2 }, despues: { kg: null, min: 40, max: 50, series: 2 } }));
check(x.clase === 'sube' && x.corto === '5 segundos más' && /Aguantaste 45 segundos en todas tus series: ahora, de 40 a 50 segundos/.test(x.texto), `la plancha sube 5 segundos («${x.texto}»)`);
x = explicar(h({ por_tiempo: true, hecho: [{ kg: null, reps: 50 }, { kg: null, reps: 50 }], antes: { kg: null, min: 40, max: 50, series: 2 }, despues: { kg: 5, min: 35, max: 45, series: 2 } }));
check(x.clase === 'sube' && /ahora con peso \(5 kg\) y otra vez de 35 a 45 segundos/.test(x.texto), 'la plancha, con peso al llegar a 50 segundos');
x = explicar(h({ novato: true, despues: { kg: 85, min: 10, max: 12, series: 3 } }));
check(x.clase === 'marca' && x.corto === 'Sales con 85 kg' && /sale de lo que moviste en tu semana de marcas/.test(x.texto), 'la semana 5: los kilos salen de sus marcas');
check(explicar({ nuevo: true, nombre: 'Curl', hecho: [], antes: {}, despues: { kg: null, min: 10, max: 12, series: 2 } }).clase === 'cambio' && /busca tu peso como el primer día/.test(explicar({ nuevo: true, hecho: [], antes: {}, despues: { kg: null, min: 10, max: 12, series: 2 } }).texto),
  'un ejercicio nuevo: sin kilos, que busque su peso');
x = explicar(h({ sin_motivo: true, despues: { kg: 90, min: 8, max: 10, series: 3 } }));
check(x.clase === 'otra' && /Esta semana toca 90 kg · 3 × 8 a 10 repeticiones\. La semana pasada hiciste 11, 10 y 10 con 80 kg\./.test(x.texto), 'si lo que tiene delante no casa con lo apuntado (lo corrigió después), solo se cuenta lo que se ve');
check(explicar(null) === null && explicar(h({ despues: null })) === null, 'sin nada que contar, nada');
check(casa(h(), { carga_sugerida_kg: 80, reps_max: 12, series: 3 }) && !casa(h(), { carga_sugerida_kg: 82.5, reps_max: 12, series: 3 }) && casa(h({ novato: true }), { carga_sugerida_kg: 80, reps_max: 15, series: 4 }),
  'casa(): los kilos, las repeticiones y las series de lo explicado son los de su pauta (en la semana 5, solo los kilos)');
check(hechoDe([h({ sesion: 0 }), h({ sesion: 1, hecho: doce })], { sesion: 1, ejercicioId: 'e1' }).hecho === doce && hechoDe([h({ sesion: 0 })], { sesion: 3, ejercicioId: 'e1' }).sesion === 0 && hechoDe([h()], { sesion: 0, ejercicioId: 'otro' }) === null,
  'hechoDe(): el de su día y, si no, el de ese ejercicio en otro día');

console.log('\nTu revisión de la semana');
const sube = h({ tipo: 'subir', diagnostico: 'superado', hecho: doce, despues: { kg: 82.5, min: 10, max: 10, series: 3 } });
const igual = h({ nombre: 'Jalón al pecho', ejercicio_id: 'e2', nuevo_id: 'e2' });
let r = revisionDe({ numero: 6, tipo: 'siguiente', semana: 'normal', hechas: 2, total: 2, porque: [sube, { ...sube, sesion: 1, sesion_nombre: 'Día 2' }, igual], nota: 'Esta semana subes kilos en prensa.' });
check(r.titulo === 'Subes de peso en 1 ejercicio' && r.sube.length === 1 && r.sube[0].dia === null && r.igual.length === 1 && r.hiciste === 'Hiciste tus 2 sesiones y apuntaste 9 de 9 series.' && r.foco === FOCOS.sube && r.nota,
  `un ejercicio que sube igual en sus dos días sale una vez; el titular, lo hecho y el foco («${r.titulo}» · «${r.hiciste}»)`);
r = revisionDe({ tipo: 'siguiente', hechas: 1, total: 2, porque: [sube, { ...igual, nombre: 'Prensa de piernas', sesion: 1, sesion_nombre: 'Día 2' }] });
check(r.sube[0].dia === 'Día 1' && r.igual[0].dia === 'Día 2' && /Hiciste 1 de tus 2 sesiones/.test(r.hiciste), 'si en cada día pasa algo distinto, una línea por día');
check(revisionDe({ tipo: 'novato', porque: [h({ novato: true })] }).titulo === 'Tu plan desde hoy sale de tus marcas' && revisionDe({ tipo: 'novato', porque: [h({ novato: true })] }).foco === FOCOS.marca
  && revisionDe({ semana: 'descarga', porque: [h({ semana: 'descarga' })] }).titulo === 'Semana de descarga: toca recuperar' && revisionDe({ tipo: 'primera', porque: [] }).titulo === 'Tu primera semana con esta rutina', 'los titulares de la semana 5, la descarga y la primera semana de una rutina');
const corta = h({ diagnostico: 'por_debajo' });
check(focoDe({ porque: [corta, corta, igual] }) === FOCOS.por_debajo && focoDe({ porque: [h({ diagnostico: 'pasado' }), h({ diagnostico: 'pasado' })] }) === FOCOS.pasado
  && focoDe({ porque: [h({ diagnostico: 'sin_registrar', hecho: [] }), h({ diagnostico: 'a_medias' })] }) === FOCOS.sin_apuntar && focoDe({ porque: [igual] }) === FOCOS.igual && focoDe({ semana: 'vuelta', porque: [] }) === FOCOS.vuelta,
  'una sola cosa en la que fijarse: lo que más se repite en lo apuntado (corto de repeticiones, al límite, sin apuntar) o lo de su semana');
check(Object.values(FOCOS).every((t) => t.length <= 190 && !/coach/i.test(t)), 'los focos, cortos y sin «tu coach»');

console.log('\nTu sesión, en claro');
check(enClaro(h({ diagnostico: 'superado', hecho: doce })).estado === 'arriba' && /cumplido en todas tus series/.test(enClaro(h({ diagnostico: 'superado', hecho: doce })).hecho) && /te pida un poco más/.test(enClaro(h({ diagnostico: 'superado', hecho: doce })).app),
  'cumplió en todas: lo que pasó y, aparte, lo que suele hacer la app');
check(enClaro(h()).estado === 'bien' && enClaro(corta).estado === 'corta' && enClaro(h({ diagnostico: 'pasado' })).estado === 'de_mas' && enClaro(h({ diagnostico: 'a_medias', hecho: doce.slice(0, 1) })).estado === 'falta'
  && enClaro(h({ hecho: [], diagnostico: 'sin_registrar' })).estado === 'falta' && enClaro(h({ diagnostico: 'cambiado' })).estado === 'nada', 'cada lectura, con su estado');
check(enClaro(h()).texto === `${enClaro(h()).hecho} ${enClaro(h()).app}` && enClaro(null) === null, 'el texto entero es lo que pasó y lo que hace la app (en las cuatro semanas de la guía se enseña solo lo primero)');
check(resumenEnClaro([{ estado: 'arriba' }, { estado: 'arriba' }, { estado: 'bien' }]) === 'Muy buena sesión: en la mayoría has cumplido en todas las series.' && resumenEnClaro([{ estado: 'corta' }, { estado: 'corta' }, { estado: 'bien' }, { estado: 'bien' }, { estado: 'bien' }]).includes('se te quedó grande')
  && resumenEnClaro([]) === null, 'el resumen de la sesión, en una frase');

console.log('\n¿Cómo ha ido? y Lo de hoy');
check(COMO_HA_IDO.length === 4 && COMO_HA_IDO.every(([id, t, texto]) => id && t && texto.length <= 230 && !/coach/i.test(texto)) && respuestaComoHaIdo('dura') && respuestaComoHaIdo('nada') === null, 'cuatro opciones de un toque, cada una con su respuesta');
const ej = (nombre, mas = {}) => ({ id: `p-${nombre}`, ejercicio: { id: nombre, nombre }, series: 3, descanso_seg: 90, carga_sugerida_kg: 40, reps_max: 12, prioridad: 'media', ...mas });
const hoy = loDeHoy({ ejercicios: [ej('Prensa', { prioridad: 'alta' }), ej('Jalón'), ej('Curl', { carga_sugerida_kg: null, series: 2 })] });
check(hoy.minutos === 25 && hoy.ejercicios === 3 && hoy.series === 8 && hoy.importante === 'Prensa' && hoy.sinKilos === 1 && loDeHoy({ ejercicios: [] }) === null, `lo de hoy: unos ${hoy.minutos} minutos, lo importante y lo que va sin kilos`);

console.log('\nSu peso, en contexto');
const kgs = [['2027-02-01', 80.4], ['2027-02-04', 79.8], ['2027-02-09', 80.1], ['2027-02-15', 79.2], ['2027-02-20', 78.9], ['2027-02-26', 78.6]].map(([fecha, kg]) => ({ fecha, kg }));
const pc = pesoEnContexto(kgs, '2027-02-27');
check(pc && pc.n === 6 && pc.dif < 0 && /^Tu tendencia está en \d+(,\d+)? kg: ha bajado \d+(,\d)? kg en las últimas 4 semanas \(6 pesajes\)\./.test(pc.texto) && /lo que cuenta es la tendencia/.test(pc.texto), `la tendencia de sus últimas cuatro semanas, no el dato de un día («${pc?.texto.slice(0, 90)}…»)`);
check(pesoEnContexto(kgs.slice(0, 2), '2027-02-05') === null && pesoEnContexto([], '2027-02-05') === null && pesoEnContexto(kgs, '2027-06-01') === null && /se mantiene/.test(pesoEnContexto([['2027-02-01', 80], ['2027-02-08', 80.1], ['2027-02-15', 79.9]].map(([fecha, kg]) => ({ fecha, kg })), '2027-02-16').texto),
  'con menos de tres pesajes recientes no se dice nada; si casi no cambia, «se mantiene»');

if (hoyISO() !== fechaMadrid()) {
  console.log('  (ahora mismo, el día de este ordenador no es el de Madrid: se salta la demo)');
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
}

console.log('\nEn la demo: la revisión de Tomás, semana a semana');
const bd = crearBackendMemoria({ semilla: () => semillaDemo(hoyISO(), { esencial: true }), persistir: false });
const api = crearApi(bd);
await bd.auth.entrar('tomas@fbe.demo', 'demo');
const yo = (await bd.select('atletas', { eq: { email: 'tomas@fbe.demo' } }))[0];
const vistas = [];
for (let k = 0; k < 4; k++) {
  const prep = await api.prepararSemanaEsencial(yo.id);
  const pr = await api.programa(yo.id);
  const w = pr.actual;
  const rev = await datos.revision(api, bd, yo.id);
  const v = revisionDe(rev);
  // lo que tiene delante: los kilos de cada ejercicio de su semana nueva
  const pautas = [];
  let primera = null;
  for (const s of pr.sesiones[w.id] || []) {
    const d = await api.sesion(s.id, yo.id);
    for (const e of d.ejercicios) pautas.push(e);
    primera ||= { s, d };
  }
  vistas.push({ prep: prep?.tipo, rev, v, pautas, w });
  // (k par: cumple en todas; impar: se queda una por debajo del objetivo en la última serie)
  for (const s of pr.sesiones[w.id] || []) {
    const d = await api.sesion(s.id, yo.id);
    for (const e of d.ejercicios) {
      const kg = e.carga_sugerida_kg == null ? 20 : Number(e.carga_sugerida_kg);
      for (let n = 1; n <= e.series; n++) await api.guardarSerie({ sesion_ejercicio_id: e.id, numero: n, kg, reps: k % 2 === 0 || n < e.series ? e.reps_max : e.reps_max - 1, rpe: e.ejercicio.por_tiempo ? null : 8 }, yo.id);
    }
    await api.marcarSesion(s.id, { completada: true, fecha_realizada: hoyISO() });
  }
  if (k === 0) {
    const c = await datos.sesionEnClaro(api, bd, yo.id, primera.s.id);
    check(c && c.guia === false && c.filas.length === primera.d.ejercicios.length && c.filas.every((f) => enClaro(f)?.estado === 'arriba'), 'al terminar una sesión, «Tu sesión, en claro» lee cada ejercicio de esa sesión (aquí, todo cumplido)');
    const una = await datos.revision(api, bd, yo.id, { sesionId: primera.s.id });
    check(una?.id === w.id && una.porque.some((f) => f.pauta_id === primera.d.ejercicios[0].id), 'el «¿Por qué?» de un ejercicio se pide por su sesión y sale por su pauta');
  }
  desfase += 7 * 864e5;
}
const [s5, s6, s7] = vistas;
check(s5.prep === 'novato' && s5.rev.tipo === 'novato' && s5.rev.numero === 5 && s5.v.titulo === 'Tu plan desde hoy sale de tus marcas' && s5.v.otras.length >= 5 && s5.v.otras.every((f) => f.clase === 'marca'),
  `la semana 5: tipo «novato», con cada ejercicio saliendo de sus marcas («${s5.v.otras[0]?.texto}»)`);
check(s5.rev.porque.every((f) => !f.sin_motivo) && s5.rev.porque.every((f) => { const p = s5.pautas.find((e) => e.id === f.pauta_id); return p && (f.por_tiempo || (f.despues.kg ?? null) === (p.carga_sugerida_kg == null ? null : Number(p.carga_sugerida_kg))); }),
  'y lo que cuenta de cada ejercicio son los kilos que tiene delante');
check(s6.rev.tipo === 'siguiente' && s6.rev.numero === 6 && s6.rev.hechas === 2 && s6.rev.total === 2 && s6.v.sube.length >= 3 && /Subes de peso en \d/.test(s6.v.titulo) && s6.v.hiciste.startsWith('Hiciste tus 2 sesiones'),
  `la semana 6, tras cumplir en todo: «${s6.v.titulo}» (${s6.v.sube.length} líneas que suben)`);
check(s6.rev.porque.length === s6.pautas.length && s6.rev.porque.every((f) => !f.sin_motivo && !f.nuevo), 'cada ejercicio de su semana tiene su explicación, y todas casan con lo que la app le preparó');
check(s6.rev.nota === (s6.w.nota_coach || null) && (s6.rev.anteriores || []).length === 2 && s6.rev.anteriores[0].numero === 6, 'con la nota de la semana y las semanas anteriores para releerlas');
check(s7.v.igual.length >= 1 || s7.v.sube.some((f) => f.clase === 'reps'), `la semana 7, tras quedarse a una repetición en la última serie: ${s7.v.igual.length} se quedan igual y ${s7.v.sube.length} suben («${(s7.v.igual[0] || s7.v.sube[0])?.texto}»)`);
const antigua = await datos.revision(api, bd, yo.id, { semanaId: s6.w.id });
check(antigua?.numero === 6 && revisionDe(antigua).titulo === s6.v.titulo, 'una revisión anterior se puede releer y dice lo mismo que dijo');
// Si corrige algo de la semana anterior después de que se la prepararan, no se inventa el motivo
const ult = vistas[3];
const base = (await api.bloqueCompleto(ult.w.bloque_id));
const wPrev = base.semanas.find((s) => s.numero === ult.w.numero - 1);
const sPrev = base.sesiones[wPrev.id][0];
const pPrev = base.pautas[sPrev.id][0];
for (const fila of base.series[pPrev.id] || []) await bd.update('series', { reps: 3 }, { eq: { id: fila.id } });
const tras = await datos.revision(api, bd, yo.id, { semanaId: ult.w.id });
const tocada = tras.porque.find((f) => f.sesion === 0 && f.ejercicio_id === pPrev.ejercicio_id);
check(!!tocada && (tocada.sin_motivo ? explicar(tocada).clase === 'otra' : true) && tras.porque.every((f) => (f.despues.kg ?? null) === (ult.pautas.find((e) => e.id === f.pauta_id)?.carga_sugerida_kg == null ? null : Number(ult.pautas.find((e) => e.id === f.pauta_id).carga_sugerida_kg))),
  `si corrige la semana anterior después, la revisión enseña siempre lo que tiene delante${tocada?.sin_motivo ? ' y, donde ya no casa, sin motivo inventado' : ''}`);

// Marina, sin plan: nada que revisar
await bd.auth.salir?.();
await bd.auth.entrar('marina@fbe.demo', 'demo');
const marina = (await bd.select('atletas', { eq: { email: 'marina@fbe.demo' } }))[0];
check((await datos.revision(api, bd, marina.id)) === null && (await datos.sesionEnClaro(api, bd, marina.id, 'ninguna')) === null, 'sin plan, no hay revisión');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
